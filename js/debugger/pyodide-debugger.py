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
import json
import sys


# Sentinel string returned by the diffing logic. UI must walk backward through
# history to find the last non-'UNCHANGED' value for that identifier in the
# same frame. Distinct from any real Python repr.
_UNCHANGED = 'UNCHANGED'

# Filter rule for global variables. We hide: dunder names, modules, and
# anything imported from outside __main__. Tutorial code's globals otherwise
# include hundreds of stdlib symbols. Toggleable from UI by the user.
_HIDDEN_GLOBAL_PREFIXES = ('__',)


def _is_user_global(name, value):
    if name.startswith(_HIDDEN_GLOBAL_PREFIXES):
        return False
    mod = getattr(value, '__module__', None)
    if mod is None or mod == '__main__' or mod == 'builtins':
        # __main__ = user-defined; builtins/None covers literals + locals
        return True
    # Module objects — always hide unless they're user-authored
    import types
    if isinstance(value, types.ModuleType):
        return False
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
          0=continue, 1=step (into), 2=next (over), 3=return (out), 4=stop
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
                return raw.to_py()
            except AttributeError:
                return raw
        self._consume_pending = _consume_wrapped
        # watches comes from JS as a JsProxy of an Array; coerce to Python list.
        # opts comes as a JsProxy of a plain Object; coerce to Python dict.
        self._watches = list(watches.to_py() if hasattr(watches, 'to_py') else (watches or []))
        self._opts = (opts.to_py() if hasattr(opts, 'to_py') else opts) or {}
        # Per-snapshot serialization budget. Deeper structures truncate.
        self._depth = int(self._opts.get('snapshot_depth', 3))
        self._max_history = int(self._opts.get('max_history', 50000))
        self._filter_globals = bool(self._opts.get('filter_globals', True))
        self._max_repr = 200

        self._buffer = []                # snapshots since last flush
        self._total = 0                  # all-time snapshot count (for cap)
        self._cap_warned = False
        self._stop_flag = False

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

    # --- bdb hooks ----------------------------------------------------------

    def user_call(self, frame, args):
        if self._stop_flag:
            return
        self._call_counter += 1
        self._frame_call_id[id(frame)] = self._call_counter
        self._snapshot(frame, 'call')

    def user_line(self, frame):
        if self._stop_flag:
            self.set_quit()
            return
        self._snapshot(frame, 'line')
        # bdb has already determined we should pause here (breakpoint condition
        # met, or we're stepping). All non-stopping lines also reach user_line
        # only when stepping; bdb's dispatch_line skips otherwise.
        self._flush_and_block(frame)

    def user_return(self, frame, retval):
        if self._stop_flag:
            return
        self._snapshot(frame, 'return', retval=retval)
        self._frame_call_id.pop(id(frame), None)
        # Prune diff baseline for completed call so memory doesn't grow forever.
        # The call_id is now historical; UI still has it in `history` but worker
        # won't emit more snapshots for it.

    def user_exception(self, frame, exc_info):
        if self._stop_flag:
            return
        self._snapshot(frame, 'exception', exc=exc_info[1])
        self._flush_and_block(frame)

    # --- snapshot construction ---------------------------------------------

    def _snapshot(self, frame, event, retval=None, exc=None):
        if self._total >= self._max_history:
            if not self._cap_warned:
                self._cap_warned = True
                self._post({
                    'type': 'capReached',
                    'limit': self._max_history,
                })
            return

        top_call_id = self._frame_call_id.get(id(frame), 0)
        snap = {
            'file': frame.f_code.co_filename,
            'line': frame.f_lineno,
            'event': event,
            'call_id': top_call_id,
            'stack': self._serialize_stack(frame),
            'watches': self._eval_watches(frame),
        }
        if exc is not None:
            snap['exception'] = {
                'type': type(exc).__name__,
                'message': str(exc),
            }
        if retval is not None and event == 'return':
            snap['return_value'] = self._serialize(retval, self._depth)

        self._buffer.append(snap)
        self._total += 1

    def _serialize_stack(self, frame):
        # Walk f_back chain, OUTERMOST first (so UI's stack[0] is <module>).
        frames = []
        f = frame
        while f is not None:
            frames.append(f)
            f = f.f_back
        frames.reverse()

        out = []
        for f in frames:
            cid = self._frame_call_id.get(id(f), 0)
            is_top = (f is frame)
            entry = {
                'function': f.f_code.co_name,
                'file': f.f_code.co_filename,
                'line': f.f_lineno,
                'call_id': cid,
                'locals': self._diff_dict(cid, 'locals', f.f_locals),
            }
            if is_top:
                gd = f.f_globals
                if self._filter_globals:
                    gd = {k: v for k, v in gd.items() if _is_user_global(k, v)}
                entry['globals'] = self._diff_dict(cid, 'globals', gd)
            out.append(entry)
        return out

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
        for w in self._watches:
            try:
                v = eval(w, frame.f_globals, frame.f_locals)
                out[w] = self._serialize(v, self._depth)
            except Exception as e:
                out[w] = {'error': '{}: {}'.format(type(e).__name__, e)}
        return out

    # --- pause / resume protocol -------------------------------------------

    def _flush_and_block(self, frame):
        # Apply any UI-queued changes (new watches, new breakpoints) BEFORE we
        # report state, so the snapshot we send already reflects them.
        pending = self._consume_pending()
        if pending:
            new_watches = pending.get('watches')
            if new_watches is not None:
                self._watches = list(new_watches)
                # Re-eval watches for the snapshot we're about to send so the
                # user sees results immediately on this very pause.
                if self._buffer:
                    self._buffer[-1]['watches'] = self._eval_watches(frame)
            for change in (pending.get('breakpoint_changes') or []):
                self._apply_bp_change(change)

        self._post({'type': 'paused', 'snapshots': self._buffer})
        self._buffer = []

        cmd = self._wait()
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
        else:
            # Unknown command — fall back to continue rather than block forever.
            self.set_continue()

    def _apply_bp_change(self, change):
        op = change.get('op')
        f = change.get('file')
        ln = change.get('line')
        if op == 'add':
            cond = change.get('condition') or None
            self.set_break(f, ln, cond=cond)
        elif op == 'remove':
            self.clear_break(f, ln)
        elif op == 'edit':
            self.clear_break(f, ln)
            cond = change.get('condition') or None
            self.set_break(f, ln, cond=cond)


def _ttd_make(post_paused, wait_for_command, consume_pending, watches, opts):
    """Factory called from JS. Returns the constructed instance. Avoids JS
    needing to know Python class-construction semantics across the bridge."""
    return TimeTravelDebugger(post_paused, wait_for_command, consume_pending,
                              watches, opts)


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
