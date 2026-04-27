"""
Time-travel debugger for pyodide-backed SEBook tutorials.

Loaded once on first Debug click via importScripts in worker-extension.js,
which calls pyodide.runPython() on this source. Defines TimeTravelDebugger
in the pyodide globals; the JS side instantiates and drives it.

Architecture (see plan: .claude/plans/what-would-be-options-temporal-ritchie.md):
- Subclass bdb.Bdb. Instrument every executed line with a snapshot of state.
- Snapshots are deep-serialized to a JSON-safe tree (depth-capped, repr-capped),
  freezing mutable state at the moment of capture so historical UI views are correct.
- Every container/object gets a project-monotonic `oid` so the UI can show aliasing.
  A strong-reference list pins live objects so id() reuse after GC can't fake aliases.
- Watches are pre-evaluated at every snapshot (results frozen alongside locals).
- Diffing: variables whose serialized form matches the previous snapshot at the
  same call_id are emitted as the sentinel string 'UNCHANGED'; UI walks back.
- Snapshots accumulate in a buffer and flush in batches on each `paused` event,
  because the worker can't respond to messages while blocked in Atomics.wait.
- Conditional breakpoints that throw still pause (educational signal); the eval
  error is reported separately so the UI can flag the breakpoint.
"""

import bdb
import ast
import json
import sys
import types

try:
    import ctypes
except Exception:
    ctypes = None


# Sentinel string returned by the diffing logic. UI must walk backward through
# history to find the last non-'UNCHANGED' value for that identifier in the
# same frame. Distinct from any real Python repr.
_UNCHANGED = 'UNCHANGED'

# Filter rule for global variables. We hide: dunder names, modules, and
# anything imported from outside __main__. Tutorial code's globals otherwise
# include hundreds of stdlib symbols. Toggleable from UI by the user.
_HIDDEN_GLOBAL_PREFIXES = ('__',)


_INTERNAL_NAMES = frozenset({
    # debugger machinery (defensive — clean exec globals already exclude these,
    # but cover any tutorials that happen to define a same-named symbol)
    '_ttd_make', '_ttd_run_with_clean_globals', '_ttd_run_pytest', '_ttd_cleanup',
    'TimeTravelDebugger', '_HIDDEN_GLOBAL_PREFIXES', '_INTERNAL_NAMES',
    '_UNCHANGED', '_is_user_global', '__ttd_apply_override',
    # pyodide-worker.js bootstrap leftovers
    '_sys', '_m', '_f', '_k', '__run_capture',
})


def _is_user_global(name, value):
    if name.startswith(_HIDDEN_GLOBAL_PREFIXES):
        return False
    if name in _INTERNAL_NAMES:
        return False
    # Hide top-level functions introduced by `def foo(...)`: they clutter the
    # Globals pane and are already visible in the call stack/source. Keep
    # variables that merely store function values, e.g. `callback = foo` or
    # `predicate = lambda x: ...`, because those are meaningful data.
    if isinstance(value, types.FunctionType):
        if (getattr(value, '__module__', None) == '__main__' and
                getattr(value, '__name__', None) == name and
                getattr(value, '__qualname__', None) == name):
            return False
    mod = getattr(value, '__module__', None)
    if mod is None or mod == '__main__' or mod == 'builtins':
        # __main__ = user-defined; builtins/None covers literals + locals
        # Still hide modules even if they happen to be in __main__.
        if isinstance(value, types.ModuleType):
            return False
        return True
    # Anything else (functions/classes imported from stdlib, etc.) is hidden.
    return False


class TimeTravelDebugger(bdb.Bdb):
    """
    Drop-in subclass of bdb.Bdb. Instances are not reusable across debug
    sessions — instantiate fresh each `runDebug`. The JS-side `cleanup()`
    drops the instance and clears all bdb.Breakpoint state.

    Constructor params (all from JS):
      post_paused: callable (msg_dict) -> None
        Sends a `paused` postMessage to the main thread.
      wait_for_command: callable () -> int
        Blocks via Atomics.wait, returns command code:
          0=continue, 1=step (into), 2=next (over), 3=return (out),
          4=stop, 5=sync pending UI changes without executing code
      consume_pending: callable () -> dict | None
        Returns any queued {watches, breakpoint_changes} from main thread,
        or None. Called at every pause so live UI updates reach the worker.
      watches: list[str]
        Initial watch expressions.
      opts: dict
        Parsed YAML debugger_options (snapshot_depth, max_history, etc.)
    """

    def __init__(self, post_paused, wait_for_command, consume_pending, watches, opts):
        super().__init__()
        # Wrap the JS callbacks so the Python<->JS bridge always sees plain
        # strings/ints — avoids PyProxy<->Object conversion edge cases.
        self._post = lambda d: post_paused(json.dumps(d))
        self._wait = wait_for_command
        # consume_pending returns a JS object (or None); convert to Python dict
        # via .to_py() if available so we can use normal dict access.
        def _consume_wrapped():
            raw = consume_pending()
            if raw is None:
                return None
            try:
                if hasattr(raw, 'to_py'):
                    raw = raw.to_py()
            except Exception:
                pass
            if isinstance(raw, str):
                try:
                    return json.loads(raw)
                except Exception:
                    return None
            if isinstance(raw, dict):
                return raw
            try:
                text = str(raw)
            except Exception:
                text = ''
            if text and text not in ('None', 'null', 'undefined', '[object Object]'):
                try:
                    return json.loads(text)
                except Exception:
                    return None
            return None
        self._consume_pending = _consume_wrapped
        # Diagnostic helper — logs go to main thread console via a dedicated
        # message type. Cheap and easy to grep for "[ttd]" in DevTools.
        self._log = lambda msg: self._post({'type': 'log', 'msg': str(msg)})
        # watches and opts come from JS as JSON strings (chosen over JsProxy
        # because pyodide's auto-conversion was unreliable across versions —
        # arrays sometimes arrived empty in Python). JSON round-trip is
        # unambiguous and version-independent.
        if isinstance(watches, str):
            try:
                self._watches = list(json.loads(watches))
            except Exception:
                self._watches = []
        else:
            # Backwards compat: if a caller still passes a JsProxy/list
            try:
                self._watches = list(watches.to_py() if hasattr(watches, 'to_py') else (watches or []))
            except Exception:
                self._watches = []
        if isinstance(opts, str):
            try:
                self._opts = json.loads(opts) or {}
            except Exception:
                self._opts = {}
        else:
            self._opts = (opts.to_py() if hasattr(opts, 'to_py') else opts) or {}
        # Confirm wiring at construction — proves which Python module is running
        # and what watches actually arrived (catches stale-SW caching issues).
        self._log('TTD __init__ watches=' + repr(self._watches) +
                  ' opts_keys=' + repr(list(self._opts.keys())))
        # Per-snapshot serialization budget. Deeper structures truncate.
        self._depth = int(self._opts.get('snapshot_depth', 3))
        self._max_history = int(self._opts.get('max_history', 50000))
        self._filter_globals = bool(self._opts.get('filter_globals', True))
        self._max_repr = 200
        self._user_filename = None
        self._user_root = '/tutorial/'
        self._source_injected_lines = set()

        self._buffer = []                # snapshots since last flush
        self._total = 0                  # all-time snapshot count (for cap)
        self._current_location_hit = None
        self._line_hit_counts = {}
        self._cap_warned = False
        self._stop_flag = False
        self._runtime_breaks = {}
        # List of {id, enabled, type, mode} from the UI. Exception events pause
        # only if at least one entry matches; navigation uses the same predicate.
        self._exception_breakpoints = []

        # Per-frame call identity so UI Step-Back-Over knows "same activation".
        self._call_counter = 0
        self._frame_call_id = {}         # id(frame) -> call_id

        # Object identity tracking. Without _held_objects, CPython will reuse
        # id() after GC and we'd assign the same oid to different objects.
        self._oid_counter = 0
        self._oid_map = {}               # id(obj) -> oid
        self._held_objects = []          # strong refs to prevent GC

        # Diff baseline: previous serialized snapshot keyed by call_id, then by
        # variable name, holding the last serialized value emitted for that
        # variable. Used to emit _UNCHANGED markers.
        self._prev_by_call = {}          # call_id -> {var_name: serialized_value}

        # Variable-mutation overrides. Either:
        #   - Pre-set via _ttd_overrides on a re-execution (rewound + edit + step)
        #     in which case format is {snapshot_idx, frame_depth, var, expr}.
        #     Applied when self._total == snapshot_idx during user_line.
        #   - Live-applied via _consume_pending in form {var, expr, target_call_id}
        #     during a single pause to mutate the current frame in place.
        self._overrides = []
        # Track applied overrides so each fires exactly once.
        self._applied_override_indices = set()
        # Function-local edits can be copied back to CPython/Pyodide fast
        # locals only when the trace callback returns. While we are still
        # blocked in the pause loop, keep an explicit overlay so sync snapshots
        # and watch expressions reflect the edit immediately instead of
        # snapping back to stale f_locals values.
        self._live_frame_overrides = {}

    # --- bdb hooks ----------------------------------------------------------

    def set_continue(self):
        """Continue running, but keep tracing so history remains complete."""
        self._set_stopinfo(self.botframe, None, -1)

    def set_break(self, filename, lineno, temporary=False, cond=None,
                  funcname=None, hit_count=None):
        if not filename or not lineno:
            return 'Breakpoint filename and line are required'
        try:
            line = int(lineno)
        except Exception:
            return 'Breakpoint line must be a number'
        key = self.canonic(filename)
        per_file = self._runtime_breaks.setdefault(key, {})
        try:
            hits = int(hit_count) if hit_count else None
        except Exception:
            hits = None
        if hits is not None and hits < 1:
            hits = None
        # Preserve the running hit counter on edits so changing the condition
        # mid-run doesn't reset progress through a long loop.
        prev = per_file.get(line) or {}
        per_file[line] = {
            'file': filename,
            'line': line,
            'condition': cond or None,
            'hit_count': hits,
            '_hits': prev.get('_hits', 0),
        }
        return None

    def clear_break(self, filename, lineno):
        try:
            line = int(lineno)
        except Exception:
            return 'Breakpoint line must be a number'
        key = self.canonic(filename)
        per_file = self._runtime_breaks.get(key)
        if not per_file or line not in per_file:
            return 'There are no breakpoints at {}:{}'.format(filename, line)
        del per_file[line]
        if not per_file:
            self._runtime_breaks.pop(key, None)
        return None

    def dispatch_call(self, frame, arg):
        if self.botframe is None:
            self.botframe = frame.f_back
            return self.trace_dispatch
        if not self._is_user_frame(frame):
            return None
        self.user_call(frame, arg)
        if self.quitting:
            raise bdb.BdbQuit
        return self.trace_dispatch

    def dispatch_line(self, frame):
        if not self._is_user_frame(frame):
            return self.trace_dispatch
        if frame.f_lineno in self._source_injected_lines:
            return self.trace_dispatch
        self._drain_pending_updates(frame, refresh_last_watch=False,
                                    apply_live_edits=False)
        should_pause = self.stop_here(frame) or self._break_here(frame)
        self._handle_line(frame, should_pause)
        if self.quitting:
            raise bdb.BdbQuit
        return self.trace_dispatch

    def dispatch_return(self, frame, arg):
        if self._is_user_frame(frame):
            try:
                self.frame_returning = frame
                self.user_return(frame, arg)
            finally:
                self.frame_returning = None
            if self.quitting:
                raise bdb.BdbQuit
        if self.stop_here(frame) or frame == self.returnframe:
            if self.stopframe is frame and self.stoplineno != -1:
                self._set_stopinfo(None, None)
            if self.stoplineno != -1:
                self._set_caller_tracefunc(frame)
        return self.trace_dispatch

    def dispatch_exception(self, frame, arg):
        # bdb's default only fires user_exception when stop_here() is true,
        # which is False during a normal Continue. We want EVERY exception
        # event in user code to reach user_exception so the Exception
        # Breakpoint filter can decide whether to pause (and so the snapshot
        # is recorded for history navigation regardless).
        if self._is_user_frame(frame):
            # Pick up any in-flight Exception Breakpoint config changes the
            # main thread wrote into the EXCBPS SAB region — without this
            # drain, a raise can fire between line traces and miss a fresh
            # config update by one tick.
            self._drain_pending_updates(frame, refresh_last_watch=False,
                                        apply_live_edits=False)
            self.user_exception(frame, arg)
            if self.quitting:
                raise bdb.BdbQuit
        return self.trace_dispatch

    def user_call(self, frame, args):
        if self._stop_flag:
            return
        self._ensure_call_id(frame)
        self._snapshot(frame, 'call')

    def _ensure_call_id(self, frame):
        frame_id = id(frame)
        if frame_id not in self._frame_call_id:
            self._call_counter += 1
            self._frame_call_id[frame_id] = self._call_counter
        return self._frame_call_id[frame_id]

    def user_line(self, frame):
        self._handle_line(frame, True)

    def _handle_line(self, frame, should_pause):
        if self._stop_flag:
            self.set_quit()
            return
        # Apply any pre-recorded overrides BEFORE snapshotting, so the
        # snapshot reflects the modified state. This is what makes "rewind +
        # edit + step forward" work: the previous session captured the user's
        # edit as an override at this exact snapshot index, and re-execution
        # has now reached that point.
        self._current_location_hit = self._bump_line_hit(frame)
        self._apply_pending_overrides(frame)
        snapped = self._snapshot(frame, 'line')
        if should_pause and snapped:
            self._flush_and_block(frame)

    def _bump_line_hit(self, frame):
        key = (frame.f_code.co_filename, frame.f_code.co_firstlineno,
               frame.f_code.co_name, frame.f_lineno)
        count = self._line_hit_counts.get(key, 0) + 1
        self._line_hit_counts[key] = count
        return count

    def user_return(self, frame, retval):
        if self._stop_flag:
            return
        self._snapshot(frame, 'return', retval=retval)
        self._frame_call_id.pop(id(frame), None)
        self._live_frame_overrides.pop(id(frame), None)
        # Prune diff baseline for completed call so memory doesn't grow forever.
        # The call_id is now historical; UI still has it in `history` but worker
        # won't emit more snapshots for it.

    def user_exception(self, frame, exc_info):
        if self._stop_flag:
            return
        snapped = self._snapshot(frame, 'exception', exc=exc_info[1])
        if not snapped:
            return
        # Pause only if an Exception Breakpoint matches. The snapshot we just
        # appended carries `caught` + `type`, so reuse that for the predicate.
        last = self._buffer[-1] if self._buffer else None
        if not self._exception_breakpoint_matches(last):
            return
        self._flush_and_block(frame)

    def _exception_breakpoint_matches(self, snap):
        if not snap or snap.get('event') != 'exception':
            return False
        info = (snap or {}).get('exception') or {}
        exc_type = str(info.get('type') or '')
        caught = bool(info.get('caught'))
        for eb in (self._exception_breakpoints or []):
            if not eb.get('enabled', True):
                continue
            wanted_type = (eb.get('type') or '').strip()
            if wanted_type and wanted_type != exc_type:
                continue
            mode = eb.get('mode') or 'uncaught'
            if mode == 'uncaught' and caught:
                continue
            return True
        return False

    def _is_user_frame(self, frame):
        filename = frame.f_code.co_filename
        if self._user_filename and filename == self._user_filename:
            return True
        return filename.startswith(self._user_root)

    def _user_frames_from(self, frame):
        frames = []
        f = frame
        while f is not None:
            if self._is_user_frame(f):
                frames.append(f)
            f = f.f_back
        return frames

    def _frame_has_active_handler(self, frame):
        """Best-effort: does this frame have a try/except active for the
        current bytecode offset? Uses the public exception table on 3.11+,
        falls back to dis-analyzing SETUP_FINALLY ranges on older pythons.
        Conservative on failure (returns False — i.e. propagates)."""
        if frame is None:
            return False
        try:
            code = frame.f_code
            lasti = frame.f_lasti
        except Exception:
            return False
        # 3.11+: public co_exceptiontable parsing via dis.Bytecode
        try:
            tab = getattr(code, 'co_exceptiontable', None)
            if tab is not None:
                # Use private parser if available, else manual decode.
                try:
                    import dis
                    entries = dis._parse_exception_table(code) if hasattr(dis, '_parse_exception_table') else []
                except Exception:
                    entries = []
                for e in entries:
                    start = getattr(e, 'start', None)
                    end = getattr(e, 'end', None)
                    if start is None or end is None:
                        continue
                    if start <= lasti < end:
                        return True
                # If we got the table but couldn't parse, treat absence of a
                # parser as "unknown" → assume uncaught (conservative).
                return False
        except Exception:
            pass
        # Pre-3.11 fallback: scan f_code.co_lnotab style SETUP_FINALLY blocks.
        # CPython 3.10 and earlier exposed handler ranges via blockstack at
        # runtime, which isn't directly accessible from Python. Use a
        # heuristic: scan the source for an enclosing try-block via the
        # frame's source. Returns True if the current line falls inside any
        # `try:` block whose body has not yet ended at this line.
        try:
            import linecache
            filename = code.co_filename
            cur_line = frame.f_lineno
            indent_at = lambda s: len(s) - len(s.lstrip())
            cur_src = linecache.getline(filename, cur_line)
            if not cur_src:
                return False
            cur_indent = indent_at(cur_src)
            # Walk upward; if we hit a `try:` at a strictly smaller indent
            # before hitting any non-blank non-comment at smaller-or-equal
            # indent that's not also `try`, we're inside a try.
            ln = cur_line - 1
            while ln >= 1:
                src = linecache.getline(filename, ln)
                if not src or not src.strip() or src.lstrip().startswith('#'):
                    ln -= 1
                    continue
                ind = indent_at(src)
                if ind < cur_indent:
                    stripped = src.lstrip()
                    if stripped.startswith('try:') or stripped.startswith('try '):
                        return True
                    # Any other smaller-indent statement closes the search.
                    return False
                ln -= 1
            return False
        except Exception:
            return False

    def _exception_will_be_caught(self, frame):
        """True if the exception raised at `frame` will be caught somewhere
        in its propagation up the user-frame chain. We walk outward and check
        each frame's active handler set; if any has a handler in scope, the
        exception is caught (or at least intercepted). If propagation reaches
        the outermost user frame with no handler, the exception is uncaught."""
        f = frame
        while f is not None:
            if self._is_user_frame(f) and self._frame_has_active_handler(f):
                return True
            # Stop walking once we leave user code at the outer end.
            if f.f_back is None or not self._is_user_frame(f.f_back):
                # Final frame; if no handler so far, uncaught.
                if self._is_user_frame(f) and self._frame_has_active_handler(f):
                    return True
                return False
            f = f.f_back
        return False

    def _break_here(self, frame):
        filename = self.canonic(frame.f_code.co_filename)
        per_file = self._runtime_breaks.get(filename)
        if not per_file:
            return False
        lineno = frame.f_lineno
        info = per_file.get(lineno)
        if not info:
            return False
        cond = info.get('condition')
        cond_passed = True
        if cond:
            try:
                locals_for_eval = self._effective_locals(frame)
                cond_passed = bool(eval(cond, frame.f_globals, locals_for_eval))
            except Exception as e:
                self._post({
                    'type': 'breakpointError',
                    'file': info.get('file') or frame.f_code.co_filename,
                    'line': lineno,
                    'error': '{}: {}'.format(type(e).__name__, e),
                })
                return True
        if not cond_passed:
            return False
        # Iteration count: only count hits that pass the condition. Fire only
        # once cumulative hits reach the configured threshold.
        info['_hits'] = info.get('_hits', 0) + 1
        threshold = info.get('hit_count')
        if threshold and info['_hits'] < threshold:
            return False
        return True

    # --- snapshot construction ---------------------------------------------

    def _snapshot(self, frame, event, retval=None, exc=None, count=True,
                  force_full=False):
        if count and self._total >= self._max_history:
            if not self._cap_warned:
                self._cap_warned = True
                self._post({
                    'type': 'capReached',
                    'limit': self._max_history,
                })
            return False

        top_call_id = self._ensure_call_id(frame)
        snap = {
            'file': frame.f_code.co_filename,
            'line': frame.f_lineno,
            'event': event,
            'call_id': top_call_id,
            'stack': self._serialize_stack(frame, force_full=force_full),
            'watches': self._eval_watches(frame),
        }
        if event in ('line', 'sync'):
            snap['location_hit'] = self._current_location_hit
        if exc is not None:
            snap['exception'] = {
                'type': type(exc).__name__,
                'message': str(exc),
                'caught': self._exception_will_be_caught(frame),
            }
        if retval is not None and event == 'return':
            snap['return_value'] = self._serialize(retval, self._depth)

        self._buffer.append(snap)
        if count:
            self._total += 1
        return True

    def _serialize_stack(self, frame, force_full=False):
        # Walk f_back chain, OUTERMOST first (so UI's stack[0] is <module>).
        frames = self._user_frames_from(frame)
        frames.reverse()

        out = []
        for f in frames:
            cid = self._ensure_call_id(f)
            is_top = (f is frame)
            locals_dict = self._effective_locals(f)
            if self._filter_globals and f.f_locals is f.f_globals:
                locals_dict = {
                    k: v for k, v in locals_dict.items()
                    if _is_user_global(k, v)
                }
            entry = {
                'function': f.f_code.co_name,
                'file': f.f_code.co_filename,
                'line': f.f_lineno,
                'first_line': f.f_code.co_firstlineno,
                'call_id': cid,
                'locals': self._full_dict(cid, 'locals', locals_dict)
                    if force_full else self._diff_dict(cid, 'locals', locals_dict),
            }
            if is_top:
                gd = f.f_globals
                if self._filter_globals:
                    gd = {k: v for k, v in gd.items() if _is_user_global(k, v)}
                entry['globals'] = self._full_dict(cid, 'globals', gd) \
                    if force_full else self._diff_dict(cid, 'globals', gd)
            out.append(entry)
        return out

    def _full_dict(self, call_id, scope_key, d):
        # Replacement sync snapshots overwrite the history row that diff
        # sentinels would normally resolve through, so they must be
        # self-contained while still advancing the diff baseline.
        baseline_key = (call_id, scope_key)
        result = {}
        new_baseline = {}
        for name, value in d.items():
            try:
                serialized = self._serialize(value, self._depth)
            except Exception as e:
                serialized = {'kind': 'primitive', 'type': 'error',
                              'repr': '<repr error: {}>'.format(e)}
            new_baseline[name] = serialized
            result[name] = serialized
        self._prev_by_call[baseline_key] = new_baseline
        return result

    def _diff_dict(self, call_id, scope_key, d):
        # Compare against last-emitted serialized values for this (call_id, scope).
        # Returns a dict where unchanged vars are 'UNCHANGED' (the sentinel string).
        baseline_key = (call_id, scope_key)
        prev = self._prev_by_call.get(baseline_key, {})
        result = {}
        new_baseline = {}
        for name, value in d.items():
            try:
                serialized = self._serialize(value, self._depth)
            except Exception as e:
                serialized = {'kind': 'primitive', 'type': 'error',
                              'repr': '<repr error: {}>'.format(e)}
            new_baseline[name] = serialized
            # Same-as-previous? Compare the serialized JSON-safe form.
            if name in prev and prev[name] == serialized:
                result[name] = _UNCHANGED
            else:
                result[name] = serialized
        # Names that disappeared: don't emit anything (UI handles missing keys).
        self._prev_by_call[baseline_key] = new_baseline
        return result

    def _serialize(self, value, depth):
        # Returns JSON-safe dict. Each kind:
        #   primitive: int/str/bool/None/float/bytes
        #   collection: list/tuple/dict/set, with `oid` + optional children
        #   object: anything else, with `oid` + optional attrs
        #   truncated: hit depth limit
        # All have `type` and (most) `repr` capped at self._max_repr.
        if value is None or isinstance(value, (bool, int, float)):
            return {
                'kind': 'primitive',
                'type': type(value).__name__,
                'repr': self._capped_repr(value),
            }
        if isinstance(value, str):
            return {
                'kind': 'primitive',
                'type': 'str',
                'repr': self._capped_repr(value),
            }
        if isinstance(value, bytes):
            return {
                'kind': 'primitive',
                'type': 'bytes',
                'repr': self._capped_repr(value),
            }

        oid = self._oid_for(value)

        if depth <= 0:
            return {
                'kind': 'truncated',
                'type': type(value).__name__,
                'oid': oid,
                'repr': self._capped_repr(value),
            }

        if isinstance(value, (list, tuple)):
            kind_type = 'list' if isinstance(value, list) else 'tuple'
            return self._serialize_sequence(value, kind_type, oid, depth)
        if isinstance(value, dict):
            return self._serialize_dict(value, oid, depth)
        if isinstance(value, (set, frozenset)):
            return self._serialize_sequence(list(value), 'set', oid, depth)

        # Generic object — capture instance attributes if any.
        attrs = {}
        try:
            d = vars(value)
        except TypeError:
            d = None
        if d:
            # Cap number of attrs to avoid blowing up on huge objects.
            for i, (k, v) in enumerate(d.items()):
                if i >= 50:
                    break
                if k.startswith('__'):
                    continue
                try:
                    attrs[k] = self._serialize(v, depth - 1)
                except Exception:
                    attrs[k] = {'kind': 'primitive', 'type': 'error', 'repr': '<unrepresentable>'}
        return {
            'kind': 'object',
            'type': type(value).__name__,
            'oid': oid,
            'repr': self._capped_repr(value),
            'attrs': attrs,
        }

    def _serialize_sequence(self, seq, type_name, oid, depth):
        n = len(seq)
        max_children = 100
        children = []
        for i, item in enumerate(seq):
            if i >= max_children:
                break
            try:
                children.append(self._serialize(item, depth - 1))
            except Exception:
                children.append({'kind': 'primitive', 'type': 'error',
                                'repr': '<unrepresentable>'})
        return {
            'kind': 'collection',
            'type': type_name,
            'oid': oid,
            'len': n,
            'preview': self._capped_repr(seq),
            'children': children,
            'truncated': n > max_children,
        }

    def _serialize_dict(self, d, oid, depth):
        n = len(d)
        max_children = 100
        children = []
        for i, (k, v) in enumerate(d.items()):
            if i >= max_children:
                break
            try:
                key_repr = self._capped_repr(k)
                children.append({
                    'key': key_repr,
                    'value': self._serialize(v, depth - 1),
                })
            except Exception:
                children.append({
                    'key': '<bad key>',
                    'value': {'kind': 'primitive', 'type': 'error', 'repr': '<unrepresentable>'},
                })
        return {
            'kind': 'collection',
            'type': 'dict',
            'oid': oid,
            'len': n,
            'preview': self._capped_repr(d),
            'children': children,
            'truncated': n > max_children,
        }

    def _capped_repr(self, value):
        try:
            r = repr(value)
        except Exception as e:
            return '<repr error: {}>'.format(e)
        if len(r) > self._max_repr:
            return r[:self._max_repr] + '... [+%d chars]' % (len(r) - self._max_repr)
        return r

    def _oid_for(self, value):
        # Pin reference + assign a stable monotonic id. Without _held_objects,
        # GC could reuse id() and we'd alias unrelated objects.
        key = id(value)
        if key in self._oid_map:
            return self._oid_map[key]
        self._held_objects.append(value)
        self._oid_counter += 1
        self._oid_map[key] = self._oid_counter
        return self._oid_counter

    # --- watches ------------------------------------------------------------

    def _eval_watches(self, frame):
        out = {}
        locals_for_eval = self._effective_locals(frame)
        for w in self._watches:
            try:
                v = eval(w, frame.f_globals, locals_for_eval)
                out[w] = self._serialize(v, self._depth)
            except Exception as e:
                out[w] = {'error': '{}: {}'.format(type(e).__name__, e)}
        return out

    # --- pause / resume protocol -------------------------------------------

    def _flush_buffer(self, replace_last=False):
        if not self._buffer:
            return
        self._post({
            'type': 'paused',
            'snapshots': self._buffer,
            'replace_last': replace_last,
        })
        self._buffer = []

    def _flush_and_block(self, frame):
        # Drain pending UI updates queued BEFORE this pause (e.g. watches
        # added or breakpoints changed during the previous block window).
        # Live variable edits are deliberately read AFTER `_wait` below, so
        # they reflect what the user does DURING this pause.
        self._drain_pending_updates(frame, refresh_last_watch=True,
                                    apply_live_edits=True)

        self._flush_buffer()

        cmd = self._wait()

        # Drain pending edits queued DURING this pause (after the user clicked
        # the value, typed a new expression, and pressed Enter). We must apply
        # these BEFORE returning control to bdb so the next bytecode reads
        # the new value — without this, edits would lag one full step.
        self._drain_pending_updates(frame, refresh_last_watch=False,
                                    apply_live_edits=True)

        if cmd == 0:
            self.set_continue()
        elif cmd == 1:
            self.set_step()
        elif cmd == 2:
            self.set_next(frame)
        elif cmd == 3:
            self.set_return(frame)
        elif cmd == 4:
            self._stop_flag = True
            self.set_quit()
        elif cmd == 5:
            self._snapshot(frame, 'sync', count=False, force_full=True)
            self._flush_buffer(replace_last=True)
            self._flush_and_block(frame)
        else:
            # Unknown command — fall back to continue rather than block forever.
            self.set_continue()
        if cmd != 4:
            self._reapply_live_overrides()

    def _drain_pending_updates(self, frame, refresh_last_watch=False,
                               apply_live_edits=True):
        pending = self._consume_pending()
        if not pending:
            return False
        new_watches = pending.get('watches')
        if new_watches is not None:
            self._watches = list(new_watches)
            if refresh_last_watch and self._buffer:
                self._buffer[-1]['watches'] = self._eval_watches(frame)
        for change in (pending.get('breakpoint_changes') or []):
            self._apply_bp_change(change)
        new_excbps = pending.get('exception_breakpoints')
        if new_excbps is not None:
            self._exception_breakpoints = list(new_excbps)
        if apply_live_edits:
            self._apply_live_edits(frame, pending.get('live_edits') or [])
        return True

    def _apply_bp_change(self, change):
        op = change.get('op')
        f = change.get('file')
        ln = change.get('line')
        if not f or not ln:
            return
        if op == 'add':
            cond = change.get('condition') or None
            hits = change.get('hitCount') or change.get('hit_count')
            self._clear_bp_at(f, ln)
            err = self.set_break(f, ln, cond=cond, hit_count=hits)
            if err:
                self._post({'type': 'breakpointError', 'file': f,
                            'line': ln, 'error': str(err)})
        elif op == 'remove':
            self._clear_bp_at(f, ln)
        elif op == 'edit':
            self._clear_bp_at(f, ln)
            cond = change.get('condition') or None
            hits = change.get('hitCount') or change.get('hit_count')
            err = self.set_break(f, ln, cond=cond, hit_count=hits)
            if err:
                self._post({'type': 'breakpointError', 'file': f,
                            'line': ln, 'error': str(err)})

    def _clear_bp_at(self, filename, lineno):
        try:
            self.clear_break(filename, lineno)
        except Exception:
            pass

    # --- variable mutation -------------------------------------------------

    def _apply_pending_overrides(self, frame):
        """Apply pre-recorded overrides at their original source location.
        Older payloads can still fall back to snapshot_idx. Called from
        `user_line` BEFORE snapshotting so the emitted snapshot includes the
        edited value. Each override fires at most once."""
        if not self._overrides:
            return
        for i, ov in enumerate(self._overrides):
            if i in self._applied_override_indices:
                continue
            if not self._override_matches_current_location(frame, ov):
                continue
            # Resolve the target frame by depth (0 = top)
            depth = ov.get('frame_depth', 0)
            target = self._frame_at_depth(frame, depth)
            if target is None:
                self._applied_override_indices.add(i)
                continue
            self._apply_one_edit(target, ov.get('var'), ov.get('expr'),
                                  scope=ov.get('scope', 'locals'))
            self._applied_override_indices.add(i)

    def _override_matches_current_location(self, frame, ov):
        line = ov.get('line')
        hit_count = ov.get('hit_count')
        function_name = ov.get('function')
        first_line = ov.get('first_line')
        if line and hit_count:
            try:
                if frame.f_lineno != int(line):
                    return False
                if self._current_location_hit != int(hit_count):
                    return False
                if function_name and frame.f_code.co_name != function_name:
                    return False
                if first_line and frame.f_code.co_firstlineno != int(first_line):
                    return False
                return True
            except Exception:
                return False
        return ov.get('snapshot_idx') == self._total

    def _apply_live_edits(self, frame, edits):
        """Apply edits to the current pause's frames immediately. Called from
        `_flush_and_block` when the UI sends `live_edits` via SAB."""
        for edit in edits:
            depth = edit.get('frame_depth', 0)
            target = self._frame_at_depth(frame, depth)
            if target is None:
                continue
            self._apply_one_edit(target, edit.get('var'), edit.get('expr'),
                                  scope=edit.get('scope', 'locals'))

    def _frame_at_depth(self, top_frame, depth):
        """Walk the call stack INNERMOST -> OUTERMOST (depth=0 is top).
        Note: this matches how the snapshot's `stack` is indexed by the UI:
        UI passes depth measured from the top of the stack."""
        frames = self._user_frames_from(top_frame)
        if depth < 0 or depth >= len(frames):
            return None
        return frames[depth]

    def _apply_one_edit(self, frame, var_name, expr, scope='locals'):
        if not var_name or expr is None:
            return
        try:
            # Evaluate the user's expression in the frame's scope so they can
            # reference other locals/globals (e.g. `len(items) + 1`).
            value = eval(expr, frame.f_globals, self._effective_locals(frame))
        except Exception as e:
            self._post({'type': 'editError',
                        'var': var_name, 'expr': expr,
                        'error': '{}: {}'.format(type(e).__name__, e)})
            return

        # Module-level code can expose the same user namespace through both
        # locals and globals. In Pyodide those mappings are not guaranteed to
        # be the same object, while LOAD_NAME may still prefer locals. Keep
        # them in sync so editing either Variables subsection changes what the
        # next top-level statement actually reads.
        if frame.f_code.co_name == '<module>':
            wrote = False
            errors = []
            for mapping_name, mapping in (('locals', frame.f_locals),
                                          ('globals', frame.f_globals)):
                try:
                    mapping[var_name] = value
                    wrote = True
                except Exception as e:
                    errors.append('{}: {}: {}'.format(
                        mapping_name, type(e).__name__, e
                    ))
            if not wrote:
                self._post({'type': 'editError',
                            'var': var_name, 'expr': expr,
                            'error': '; '.join(errors) or 'module writeback failed'})
            else:
                self._log('edit module[{}] = {!r}'.format(var_name, value))
            return

        # Globals path for function frames: write to the module globals dict.
        if scope == 'globals':
            frame.f_globals[var_name] = value
            actual = frame.f_globals.get(var_name)
            if actual is not value:
                self._post({'type': 'editError',
                            'var': var_name, 'expr': expr,
                            'error': 'globals writeback did not persist'})
            else:
                self._log('edit globals[{}] = {!r}'.format(var_name, value))
            return

        # Locals path: because this runs from the trace callback, CPython/Pyodide
        # may not copy the edit to fast locals until the callback returns. Store
        # an overlay first so sync snapshots and watches show the intended state
        # immediately, then reapply the edit right before execution resumes.
        self._record_local_override(frame, var_name, value)
        d = frame.f_locals
        d[var_name] = value
        force_error = None
        if ctypes is not None:
            try:
                ctypes.pythonapi.PyFrame_LocalsToFast(
                    ctypes.py_object(frame), ctypes.c_int(0)
                )
            except Exception as e:
                force_error = '{}: {}'.format(type(e).__name__, e)

        suffix = ''
        if force_error:
            suffix = ' (deferred trace writeback; PyFrame_LocalsToFast unavailable: {})'.format(force_error)
        self._log('edit locals[{}] = {!r}{}'.format(var_name, value, suffix))


    def _effective_locals(self, frame):
        overrides = self._live_frame_overrides.get(id(frame))
        if not overrides:
            return frame.f_locals
        merged = dict(frame.f_locals)
        merged.update(overrides['values'])
        return merged

    def _record_local_override(self, frame, var_name, value):
        frame_id = id(frame)
        entry = self._live_frame_overrides.get(frame_id)
        if not entry:
            entry = {'frame': frame, 'values': {}}
            self._live_frame_overrides[frame_id] = entry
        entry['values'][var_name] = value

    def _reapply_live_overrides(self):
        for entry in list(self._live_frame_overrides.values()):
            frame = entry['frame']
            values = entry['values']
            try:
                d = frame.f_locals
                for name, value in values.items():
                    d[name] = value
                if ctypes is not None:
                    try:
                        ctypes.pythonapi.PyFrame_LocalsToFast(
                            ctypes.py_object(frame), ctypes.c_int(0)
                        )
                    except Exception:
                        pass
            except Exception:
                pass


def _ttd_compile_with_source_overrides(code_str, filename, overrides):
    source_overrides = [
        dict(ov, _ttd_oid=i)
        for i, ov in enumerate(overrides or [])
        if ov.get('source') and ov.get('scope') in ('locals', 'globals')
    ]
    if not source_overrides:
        return compile(code_str, filename, 'exec'), set(), None

    try:
        tree = ast.parse(code_str, filename=filename, mode='exec')
    except Exception:
        return compile(code_str, filename, 'exec'), set(), None

    injected_lines = set()
    apply_targets = {}
    insert_offsets = {}
    inserted_any = False
    for ov in source_overrides:
        var_name = ov.get('var')
        expr = ov.get('expr')
        line = ov.get('line')
        if not var_name or not str(var_name).isidentifier() or expr is None or not line:
            continue
        scope_body = _ttd_find_scope_body(
            tree,
            ov.get('function'),
            ov.get('first_line'),
        )
        if scope_body is None:
            continue
        try:
            value_expr = ast.parse(str(expr), mode='eval').body
        except Exception:
            continue
        target_body, insert_at = _ttd_find_insertion_body(scope_body, int(line))
        if target_body is None:
            continue

        oid = ov['_ttd_oid']
        synthetic_line = 10_000_000 + oid
        injected_lines.add(synthetic_line)
        apply_targets[oid] = int(ov.get('hit_count') or 1)
        node = ast.If(
            test=ast.Call(
                func=ast.Name(id='__ttd_apply_override', ctx=ast.Load()),
                args=[ast.Constant(value=oid)],
                keywords=[],
            ),
            body=[
                ast.Assign(
                    targets=[ast.Name(id=str(var_name), ctx=ast.Store())],
                    value=value_expr,
                )
            ],
            orelse=[],
        )
        _ttd_set_line_recursive(node, synthetic_line)
        insert_key = (id(target_body), insert_at)
        actual_insert_at = insert_at + insert_offsets.get(insert_key, 0)
        target_body.insert(actual_insert_at, node)
        insert_offsets[insert_key] = insert_offsets.get(insert_key, 0) + 1
        inserted_any = True

    if not inserted_any:
        return compile(code_str, filename, 'exec'), set(), None
    ast.fix_missing_locations(tree)
    hit_counts = {}

    def apply_override(oid):
        hit_counts[oid] = hit_counts.get(oid, 0) + 1
        return hit_counts[oid] == apply_targets.get(oid)

    return compile(tree, filename, 'exec'), injected_lines, apply_override


def _ttd_find_scope_body(tree, function_name, first_line):
    if function_name in (None, '<module>'):
        return tree.body
    try:
        first_line = int(first_line)
    except Exception:
        first_line = None
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if node.name == function_name and (first_line is None or node.lineno == first_line):
                return node.body
    return None


def _ttd_find_insertion_body(body, line):
    for index, stmt in enumerate(body):
        start = getattr(stmt, 'lineno', None)
        end = getattr(stmt, 'end_lineno', start)
        if start is None:
            continue
        if start <= line <= end:
            for child_body in _ttd_child_bodies(stmt):
                found_body, found_index = _ttd_find_insertion_body(child_body, line)
                if found_body is not None:
                    return found_body, found_index
            return body, index
        if start > line:
            return body, index
    return body, len(body)


def _ttd_child_bodies(stmt):
    bodies = []
    for attr in ('body', 'orelse', 'finalbody'):
        child = getattr(stmt, attr, None)
        if isinstance(child, list) and child:
            bodies.append(child)
    handlers = getattr(stmt, 'handlers', None)
    if handlers:
        for handler in handlers:
            if getattr(handler, 'body', None):
                bodies.append(handler.body)
    cases = getattr(stmt, 'cases', None)
    if cases:
        for case in cases:
            if getattr(case, 'body', None):
                bodies.append(case.body)
    return bodies


def _ttd_set_line_recursive(node, line):
    for child in ast.walk(node):
        if hasattr(child, 'lineno'):
            child.lineno = line
        if hasattr(child, 'end_lineno'):
            child.end_lineno = line
        if hasattr(child, 'col_offset'):
            child.col_offset = 0
        if hasattr(child, 'end_col_offset'):
            child.end_col_offset = 0


def _ttd_make(post_paused, wait_for_command, consume_pending, watches, opts):
    """Factory called from JS. Returns the constructed instance. Avoids JS
    needing to know Python class-construction semantics across the bridge."""
    return TimeTravelDebugger(post_paused, wait_for_command, consume_pending,
                              watches, opts)


def _ttd_set_exc_bps(dbg, payload):
    """JS bridge: hand the debugger the current Exception Breakpoints config
    as a JSON string. Each entry is {id, enabled, type, mode}."""
    try:
        arr = json.loads(payload) if isinstance(payload, str) else payload
    except Exception:
        arr = []
    try:
        dbg._exception_breakpoints = list(arr or [])
    except Exception:
        pass


def _ttd_run_with_clean_globals(dbg, code_str, filename, overrides):
    """
    Run user code under the debugger with a FRESH globals dict so the user's
    view of `globals()` doesn't include any of our debugger machinery
    (TimeTravelDebugger, bdb, json, _ttd_make, _f, _k, _m, ...) that lives in
    pyodide's `__main__`.

    Compiles the source with the user-facing filename so bdb breakpoints
    keyed on that path actually match `frame.f_code.co_filename`.

    `overrides` is a JSON string of variable mutations to apply at specific
    points during execution. Format:
      [{ snapshot_idx: int, frame_depth: int (0=top), var: str, expr: str,
         scope: 'locals' | 'globals' }, ...]
    The debugger applies them in `user_line` when `self._total == snapshot_idx`.
    """
    if isinstance(overrides, str):
        try:
            py_overrides = list(json.loads(overrides))
        except Exception:
            py_overrides = []
    else:
        try:
            py_overrides = overrides.to_py() if hasattr(overrides, 'to_py') else list(overrides or [])
        except Exception:
            py_overrides = []
    compiled, injected_lines, apply_override = _ttd_compile_with_source_overrides(
        code_str, filename, py_overrides
    )
    dbg._overrides = [ov for ov in py_overrides if not ov.get('source')]
    dbg._source_injected_lines = set(injected_lines)
    dbg._user_filename = filename

    # Fresh, minimal globals — only what user code legitimately expects.
    user_globals = {
        '__name__': '__main__',
        '__doc__': None,
        '__package__': None,
        '__loader__': None,
        '__spec__': None,
        '__builtins__': __builtins__,
        '__file__': filename,
    }
    if apply_override is not None:
        user_globals['__ttd_apply_override'] = apply_override
    try:
        dbg.run(compiled, user_globals)
    finally:
        dbg._flush_buffer()


def _ttd_run_pytest(dbg, pytest_args, filename, overrides):
    """
    Run real pytest under the debugger. Unlike the normal source runner, this
    does not compile a synthetic entry file; pytest performs its usual
    collection/import/call flow, while the debugger traces user frames under
    /tutorial/.
    """
    if isinstance(pytest_args, str):
        try:
            py_args = list(json.loads(pytest_args))
        except Exception:
            py_args = [filename]
    else:
        try:
            py_args = list(pytest_args.to_py() if hasattr(pytest_args, 'to_py') else (pytest_args or [filename]))
        except Exception:
            py_args = [filename]

    if isinstance(overrides, str):
        try:
            py_overrides = list(json.loads(overrides))
        except Exception:
            py_overrides = []
    else:
        try:
            py_overrides = overrides.to_py() if hasattr(overrides, 'to_py') else list(overrides or [])
        except Exception:
            py_overrides = []

    dbg._overrides = [ov for ov in py_overrides if not ov.get('source')]
    dbg._source_injected_lines = set()
    dbg._user_filename = filename

    import pytest
    try:
        code = dbg.runcall(pytest.main, py_args)
        if code:
            raise SystemExit(code)
    finally:
        dbg._flush_buffer()


def _ttd_cleanup():
    """Drop trace fn + clear bdb's class-level breakpoint state. Called from
    JS after each debug session (including stops/exceptions) so a subsequent
    plain `runCode` is unaffected."""
    sys.settrace(None)
    try:
        bdb.Breakpoint.next = 1
        bdb.Breakpoint.bplist = {}
        bdb.Breakpoint.bpbynumber = [None]
    except Exception:
        pass
