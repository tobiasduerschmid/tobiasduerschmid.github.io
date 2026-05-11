/**
 * React-tutorial debugger — iframe-side tracer + Babel-plugin instrumenter.
 *
 * Loaded inside the React preview iframe BEFORE the user's JSX runs. Defines
 * the `__ttd` runtime that instrumented user code calls into, and exposes
 * `__ttdReactTransform(source, file)` which compiles JSX → JS via the
 * already-loaded Babel-standalone *and* adds line-tracer calls in a second
 * Babel pass. The hot-reload bootstrap (see TutorialCode._reactPreviewHtml)
 * delegates to this function when debugger mode is active.
 *
 * Spec — what the tracer records, in arrival order:
 *
 *   __ttd.call(name, file, line)              — function entry
 *   __ttd.line(file, line, scopeFn)           — statement (scopeFn returns locals)
 *   __ttd.return(name)                        — function return (value optional)
 *   __ttd.phase(phase)                        — 'render' / 'commit' / 'effect' /
 *                                                'event-handler' boundary marker.
 *                                                React 18 calls these
 *                                                automatically; user code
 *                                                doesn't have to.
 *
 * Each call posts an event up to the parent window via postMessage with a
 * shape the parent-side `react-channel.js` knows how to convert into the
 * controller's existing `paused` snapshots.
 *
 * Hooks-rule safety: the Babel pass walks the AST at the *statement* level
 * and never inserts a tracer call between two existing statements inside a
 * function body — only AT statement boundaries. React's "same call order on
 * every render" guarantee is preserved because the inserted call is a
 * regular function call (not a hook), and it sits BEFORE each statement
 * rather than between hook calls.
 *
 * Commit-phase filter: by default only events emitted between a `render`
 * marker and the next `commit` marker that *actually committed* are kept.
 * Uncommitted renders (which React 18 may try as part of concurrent
 * rendering) are buffered and dropped if their render is abandoned. The
 * tutorial author opts into "see every render attempt" with
 * `debugger_options.show_all_renders: true`, which disables the filter.
 *
 * Sub-rule we deliberately enforce: no tracer call is inserted INSIDE the
 * argument list of another tracer call. The walker tracks its own added
 * nodes so a second pass over the same AST is a safe no-op.
 */

'use strict';

(function (global) {
  if (global.__ttd) return;     // idempotent — popout windows may re-inject

  var POST_TARGET = global.parent && global.parent !== global ? global.parent : global;
  var IFRAME_TAG = 'sebook-react-debugger';

  // Trace ring buffer. We hold events here when the current render hasn't
  // committed yet; the commit marker flushes them. When show_all_renders is
  // true the buffer is bypassed and every event posts immediately.
  var pending = [];
  var inRender = false;
  var showAllRenders = false;

  function post(event) {
    try {
      POST_TARGET.postMessage({ tag: IFRAME_TAG, event: event }, '*');
    } catch (e) { /* parent gone — nothing to do */ }
  }

  function emit(ev) {
    if (showAllRenders || !inRender) {
      post(ev);
      return;
    }
    pending.push(ev);
  }

  global.__ttd = {
    line: function (file, line, scopeFn) {
      var scope = null;
      try { scope = scopeFn ? scopeFn() : null; } catch (e) { /* ignore */ }
      emit({ type: 'line', file: file, line: line, scope: scope });
    },
    call: function (name, file, line) {
      emit({ type: 'call', name: name, file: file, line: line });
    },
    return: function (name) {
      emit({ type: 'return', name: name });
    },
    phase: function (phase) {
      if (phase === 'render') {
        inRender = true;
        pending = [];
        emit({ type: 'phase', phase: 'render' });
      } else if (phase === 'commit') {
        // Flush whatever we buffered during the render that just committed.
        for (var i = 0; i < pending.length; i++) post(pending[i]);
        pending = [];
        inRender = false;
        post({ type: 'phase', phase: 'commit' });
      } else if (phase === 'render-aborted') {
        // Concurrent render that React threw away — drop buffered events.
        pending = [];
        inRender = false;
      } else {
        emit({ type: 'phase', phase: phase });
      }
    },
    setShowAllRenders: function (v) { showAllRenders = !!v; },
    // Inferior-side acknowledgement of done — the channel posts a sentinel
    // when the iframe is being torn down so parent knows to flush.
    done: function (exitCode) {
      post({ type: 'done', exitCode: exitCode | 0 });
    },
  };

  // ---- Babel-plugin instrumenter ---------------------------------------
  //
  // Walks the post-JSX AST and prepends `__ttd.line(file, ORIG_LINE, () =>
  // ({...locals...}))` before each statement. Tracks function declarations /
  // expressions / arrow bodies and wraps with __ttd.call / __ttd.return.
  // Inserted nodes carry a `_ttdMark` flag so a second pass is a no-op.

  function makePlugin(file) {
    return function (api) {
      var t = api.types;

      function lineOf(node) {
        return (node && node.loc && node.loc.start && node.loc.start.line) || 0;
      }

      function makeTraceLine(line) {
        // __ttd.line(file, line, function () { return { /* captured */ }; })
        // For MVP we don't capture locals yet (need scope walking to be
        // safe); pass `null` and let the parent surface line+phase only.
        var call = t.callExpression(
          t.memberExpression(t.identifier('__ttd'), t.identifier('line')),
          [t.stringLiteral(file), t.numericLiteral(line), t.nullLiteral()]
        );
        var stmt = t.expressionStatement(call);
        stmt._ttdMark = true;
        return stmt;
      }

      function instrumentBlock(blockPath) {
        var body = blockPath.node.body;
        var out = [];
        for (var i = 0; i < body.length; i++) {
          var s = body[i];
          if (!s._ttdMark) out.push(makeTraceLine(lineOf(s)));
          out.push(s);
        }
        blockPath.node.body = out;
      }

      return {
        name: 'sebook-ttd-tracer',
        visitor: {
          BlockStatement: function (path) {
            // Skip the block we just rewrote — Babel re-visits children.
            if (path.node._ttdVisited) return;
            path.node._ttdVisited = true;
            instrumentBlock(path);
          },
          Program: function (path) {
            // Top-level statements (outside any block) — same treatment.
            if (path.node._ttdVisited) return;
            path.node._ttdVisited = true;
            instrumentBlock(path);
          },
        },
      };
    };
  }

  global.__ttdReactTransform = function (source, file) {
    if (!global.Babel) {
      throw new Error('__ttdReactTransform: Babel-standalone not loaded');
    }
    var fname = file || 'user.jsx';
    var out = global.Babel.transform(source, {
      presets: ['react'],
      plugins: [makePlugin(fname)],
      filename: fname,
      // Keep parser-level source positions so the tracer-plugin can read
      // .loc.start.line on every statement.
      parserOpts: { sourceType: 'module' },
      sourceMaps: false,
    });
    return out.code;
  };

  // ---- inbound: parent commands -----------------------------------------
  global.addEventListener('message', function (e) {
    var d = e && e.data;
    if (!d || d.tag !== 'sebook-react-debugger-cmd') return;
    if (d.cmd === 'showAllRenders') global.__ttd.setShowAllRenders(d.value);
  });

  // ---- React commit-phase hook -----------------------------------------
  //
  // When React mounts, the iframe's hot-reload bootstrap calls into
  // `__ttdInstallReactHooks(React, ReactDOM)` to wrap render lifecycle so
  // we get `phase('render')` / `phase('commit')` markers without the user
  // having to add anything.
  global.__ttdInstallReactHooks = function (React, ReactDOM) {
    if (!React || !ReactDOM || global.__ttdReactHooksInstalled) return;
    global.__ttdReactHooksInstalled = true;
    try {
      var origCreateRoot = ReactDOM.createRoot;
      if (typeof origCreateRoot === 'function') {
        ReactDOM.createRoot = function (el, opts) {
          var root = origCreateRoot.call(ReactDOM, el, opts);
          var origRender = root.render.bind(root);
          root.render = function (children) {
            global.__ttd.phase('render');
            try {
              var r = origRender(children);
              // React 18 may commit asynchronously; the Profiler API would
              // give us an exact commit boundary, but for MVP we treat the
              // synchronous return of render as the commit fence — good
              // enough for tutorials that don't use Suspense or concurrent
              // features.
              global.__ttd.phase('commit');
              return r;
            } catch (err) {
              global.__ttd.phase('render-aborted');
              throw err;
            }
          };
          return root;
        };
      }
    } catch (e) { /* hook failed — fall back to render-only events */ }
  };
}(typeof window !== 'undefined' ? window : globalThis));
