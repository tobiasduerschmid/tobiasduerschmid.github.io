/**
 * attachDebuggerToEditor — wires breakpoint gutter, breakpoint decorations,
 * current-line decoration, hover-to-inspect, and debug-readonly toggling onto
 * a Monaco editor instance.
 *
 * Used identically by:
 *   - the main tutorial editor (`t.editor`, `t.editor2`)
 *   - any popped-out tab/pane editor
 *
 * That's the whole point: this is the ONLY place breakpoint visuals + clicks
 * are wired. Add a feature here once and every editor (main + popouts) gets it.
 *
 * State source: a DebuggerSync instance. State changes drive repaints; gutter
 * clicks/right-clicks dispatch action requests. Mirrors round-trip through
 * the channel; the authority handles them locally.
 *
 * Action protocol (subset relevant to editors):
 *   { type: 'toggleBreakpoint', path, line }
 *   { type: 'editBreakpointCondition', path, line }
 *
 * The two callbacks `helpers.basename`, `helpers.normalizePath` and the
 * `getActiveFile()` accessor are passed in so the same module works on a main
 * window (which has `tutorial.activeFileName`) and on a popout (which only has
 * its own state).
 *
 * Pre-set breakpoints (loaded from localStorage / YAML before this attach
 * call, or arriving through a snapshot moments after) appear instantly: we
 * paint synchronously on attach AND repaint on every state change AND repaint
 * once the model becomes available. No need to click the gutter to populate.
 */
(function () {
  'use strict';

  function attachDebuggerToEditor(editor, sync, opts) {
    if (!editor || !sync) return { dispose: function () {} };
    opts = opts || {};
    var monaco = opts.monaco || window.monaco;
    if (!monaco) {
      console.warn('[debugger/editor-attach] no monaco; deferring');
      return { dispose: function () {} };
    }
    var getActiveFile = opts.getActiveFile || function () { return null; };
    var basename = opts.basename || function (p) {
      if (!p) return '';
      var i = String(p).lastIndexOf('/');
      return i >= 0 ? String(p).substring(i + 1) : String(p);
    };
    var normalizePath = opts.normalizePath || function (file) {
      var p = String(file || '').trim();
      if (!p) return null;
      if (p.indexOf('/tutorial/') === 0) return p;
      if (p.charAt(0) === '/') return '/tutorial' + p;
      return '/tutorial/' + p;
    };
    var disposers = [];

    function displayFrameForSnapshot(snap, frameIdx) {
      if (!snap || !snap.stack) return null;
      var frame = snap.stack[frameIdx];
      if (!frame) return null;
      var topIdx = snap.stack.length - 1;
      if (frameIdx === topIdx && snap.watchpoint_origin) {
        var copy = {};
        for (var k in frame) copy[k] = frame[k];
        copy.file = snap.watchpoint_origin.file || frame.file;
        copy.line = snap.watchpoint_origin.line || frame.line;
        return copy;
      }
      return frame;
    }

    function currentLineState() {
      var s = sync.state || {};
      if (s.historyIdx == null || s.historyIdx < 0 || !s.history || !s.history.length) return null;
      var snap = s.history[s.historyIdx];
      if (!snap || !snap.stack || !snap.stack.length) return null;
      var frameIdx = (s.selectedFrameIdx != null && s.selectedFrameIdx >= 0)
        ? s.selectedFrameIdx
        : (snap.stack.length - 1);
      var frame = displayFrameForSnapshot(snap, frameIdx);
      if (!frame || !frame.file || !frame.line) return null;
      return {
        path: frame.file,
        line: frame.line,
      };
    }

    // ── Gutter click → toggleBreakpoint / editBreakpointCondition ─────────
    var clickD = editor.onMouseDown(function (e) {
      if (!e.target || e.target.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) return;
      var line = e.target.position && e.target.position.lineNumber;
      if (!line) return;
      var fname = getActiveFile();
      if (!fname) return;
      var path = normalizePath(fname);
      if (!path) return;
      if (e.event && e.event.rightButton) {
        sync.dispatch({ type: 'editBreakpointCondition', path: path, line: line });
      } else {
        sync.dispatch({ type: 'toggleBreakpoint', path: path, line: line });
      }
    });
    disposers.push(function () { try { clickD.dispose(); } catch (e) {} });

    // ── Breakpoint decorations (red dots in glyph margin) ──────────────────
    function paintBreakpoints() {
      var model = editor.getModel(); if (!model) return;
      var fname = getActiveFile(); if (!fname) return;
      var path = normalizePath(fname); if (!path) return;
      var bps = (sync.state.breakpoints || {})[path] || {};
      var decos = [];
      var lines = Object.keys(bps);
      var maxLine = model.getLineCount();
      var cur = currentLineState();
      for (var i = 0; i < lines.length; i++) {
        var line = +lines[i];
        if (!line || line < 1 || line > maxLine) continue;
        if (cur && cur.path === path && cur.line === line) continue;
        var info = bps[line] || {};
        var glyphClass = info.condition
          ? 'tvm-bp-glyph tvm-bp-cond' + (info.condError ? ' tvm-bp-error' : '')
          : 'tvm-bp-glyph';
        decos.push({
          range: new monaco.Range(line, 1, line, 1),
          options: {
            glyphMarginClassName: glyphClass,
            glyphMarginHoverMessage: { value: info.condition
              ? 'Breakpoint (when `' + info.condition + '`)' + (info.condError ? '\n\n⚠️ ' + info.condError : '')
              : 'Breakpoint' },
          },
        });
      }
      var prev = editor._dbgBpIds || [];
      editor._dbgBpIds = editor.deltaDecorations(prev, decos);
    }

    // ── Current-line decoration (yellow line where execution is) ───────────
    function paintCurrentLine(revealLine) {
      var model = editor.getModel(); if (!model) {
        if (editor._dbgCurrentLineIds && editor._dbgCurrentLineIds.length) {
          editor._dbgCurrentLineIds = [];
        }
        return;
      }
      var fname = getActiveFile(); if (!fname) return;
      var path = normalizePath(fname);
      var s = sync.state;
      if (s.historyIdx == null || s.historyIdx < 0 || !s.history || !s.history.length) {
        editor._dbgCurrentLineIds = editor.deltaDecorations(editor._dbgCurrentLineIds || [], []);
        return;
      }
      var snap = s.history[s.historyIdx];
      if (!snap || !snap.stack || !snap.stack.length) {
        editor._dbgCurrentLineIds = editor.deltaDecorations(editor._dbgCurrentLineIds || [], []);
        return;
      }
      var frameIdx = (s.selectedFrameIdx != null && s.selectedFrameIdx >= 0)
        ? s.selectedFrameIdx
        : (snap.stack.length - 1);
      var frame = displayFrameForSnapshot(snap, frameIdx);
      if (!frame) {
        editor._dbgCurrentLineIds = editor.deltaDecorations(editor._dbgCurrentLineIds || [], []);
        return;
      }
      // Only paint if this editor is showing the file the frame is in.
      if (frame.file !== path) {
        editor._dbgCurrentLineIds = editor.deltaDecorations(editor._dbgCurrentLineIds || [], []);
        return;
      }
      var line = frame.line;
      if (!line || line < 1 || line > model.getLineCount()) {
        editor._dbgCurrentLineIds = editor.deltaDecorations(editor._dbgCurrentLineIds || [], []);
        return;
      }
      var rewound = s.historyIdx < (s.liveIdx == null ? -1 : s.liveIdx);
      var afterLine = !!(snap.watchpoint_origin && frameIdx === snap.stack.length - 1);
      var cls = afterLine ? 'tvm-debug-current-line-after'
        : (rewound ? 'tvm-debug-current-line-rewound' : 'tvm-debug-current-line');
      var glyph = afterLine ? 'tvm-debug-current-glyph-after'
        : (rewound ? 'tvm-debug-current-glyph-rewound' : 'tvm-debug-current-glyph');
      var bps = (s.breakpoints || {})[path] || {};
      if (!afterLine && bps[line]) {
        glyph = rewound ? 'tvm-debug-current-glyph-rewound-on-bp' : 'tvm-debug-current-glyph-on-bp';
      }
      editor._dbgCurrentLineIds = editor.deltaDecorations(editor._dbgCurrentLineIds || [], [{
        range: new monaco.Range(line, 1, line, 1),
        options: { isWholeLine: true, className: cls, glyphMarginClassName: glyph },
      }]);
      if (revealLine && editor.revealLineInCenterIfOutsideViewport) {
        editor.revealLineInCenterIfOutsideViewport(line);
      }
    }

    // ── Read-only during debug session ─────────────────────────────────────
    var savedReadOnly = null;
    function applyReadOnly() {
      var s = sync.state;
      var sessionActive = s.session && s.session.active;
      if (sessionActive) {
        if (savedReadOnly == null) {
          savedReadOnly = !!editor.getOption(monaco.editor.EditorOption.readOnly);
        }
        editor.updateOptions({ readOnly: true });
      } else {
        if (savedReadOnly != null) {
          editor.updateOptions({ readOnly: savedReadOnly });
          savedReadOnly = null;
        }
      }
    }

    // ── Initial paint (synchronous if model exists) ────────────────────────
    paintBreakpoints();
    paintCurrentLine();
    applyReadOnly();

    // ── If model isn't ready yet, poll until it is, then paint once. ───────
    if (!editor.getModel()) {
      var pollT = setInterval(function () {
        if (editor.getModel()) {
          clearInterval(pollT);
          paintBreakpoints();
          paintCurrentLine();
        }
      }, 16);
      var killT = setTimeout(function () { clearInterval(pollT); }, 5000);
      disposers.push(function () { clearInterval(pollT); clearTimeout(killT); });
    }

    // ── Repaint on state change (covers remote updates AND local). ─────────
    var unsub = sync.subscribe(function (s, changedKeys) {
      if (changedKeys.has('breakpoints') || changedKeys.has('activeFile') || changedKeys.has('paneForFile')) {
        paintBreakpoints();
        paintCurrentLine(false);
      }
      if (changedKeys.has('history') || changedKeys.has('historyIdx') || changedKeys.has('liveIdx')
          || changedKeys.has('selectedFrameIdx') || changedKeys.has('paused') || changedKeys.has('activeFile')) {
        paintCurrentLine(changedKeys.has('history') || changedKeys.has('historyIdx') || changedKeys.has('liveIdx'));
        paintBreakpoints();
      }
      if (changedKeys.has('session')) {
        applyReadOnly();
      }
    });
    disposers.push(unsub);

    // ── Repaint on Monaco model swap (file switch within this editor). ─────
    var modelD = editor.onDidChangeModel(function () {
      paintBreakpoints();
      paintCurrentLine();
    });
    disposers.push(function () { try { modelD.dispose(); } catch (e) {} });

    return {
      paintBreakpoints: paintBreakpoints,
      paintCurrentLine: paintCurrentLine,
      dispose: function () {
        for (var i = 0; i < disposers.length; i++) {
          try { disposers[i](); } catch (e) {}
        }
        disposers = [];
      },
    };
  }

  // ── Hover provider — registered once per Monaco language, globally. ────
  // Lives outside attachDebuggerToEditor because Monaco hover providers are
  // per-language, not per-editor. The provider closure reads from a registered
  // sync instance — multiple syncs (rare, but possible) all get a chance.
  var registeredHoverLangs = {};
  var hoverSyncs = [];

  function registerHoverProvider(monaco, sync, helpers) {
    if (!monaco || !sync) return;
    if (hoverSyncs.indexOf(sync) === -1) hoverSyncs.push(sync);
    helpers = helpers || {};
    var langs = helpers.languages || ['python'];
    langs.forEach(function (lang) {
      if (registeredHoverLangs[lang]) return;
      registeredHoverLangs[lang] = true;
      monaco.languages.registerHoverProvider(lang, {
        provideHover: function (model, position) {
          // Use the most recently active sync that has history.
          var s = null;
          for (var i = hoverSyncs.length - 1; i >= 0; i--) {
            var st = hoverSyncs[i].state;
            if (st && st.history && st.history.length && st.historyIdx >= 0) {
              s = st; break;
            }
          }
          if (!s) return null;
          var word = model.getWordAtPosition(position);
          if (!word) return null;
          var snap = s.history[s.historyIdx];
          if (!snap || !snap.stack || !snap.stack.length) return null;
          var frameIdx = s.selectedFrameIdx >= 0 ? s.selectedFrameIdx : (snap.stack.length - 1);
          var frame = snap.stack[frameIdx];
          if (!frame) return null;
          var name = word.word;
          var resolved = resolveVar(s, snap, frameIdx, 'locals', name)
                      || resolveVar(s, snap, frameIdx, 'globals', name);
          if (!resolved) return null;
          var md = '**`' + name + '`** _' + (resolved.type || resolved.kind || '') + '_\n\n' +
                   '```python\n' + (resolved.repr || resolved.preview || '') + '\n```';
          return {
            range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
            contents: [{ value: md }],
          };
        },
      });
    });
  }

  // Walk history backward through the same call to resolve UNCHANGED diff
  // sentinels. Mirrors DebuggerController.resolveVar.
  var UNCHANGED = 'UNCHANGED';
  function resolveVar(state, snap, frameIdx, scope, name) {
    var idx = state.historyIdx;
    var callId = snap.stack[frameIdx] && snap.stack[frameIdx].call_id;
    while (idx >= 0) {
      var s = state.history[idx];
      if (!s || !s.stack) { idx--; continue; }
      var f = null;
      for (var i = s.stack.length - 1; i >= 0; i--) {
        if (s.stack[i].call_id === callId) { f = s.stack[i]; break; }
      }
      if (f) {
        var d = f[scope];
        if (d && Object.prototype.hasOwnProperty.call(d, name)) {
          var v = d[name];
          if (v !== UNCHANGED) return v;
        }
      }
      idx--;
    }
    return null;
  }

  window.SEBookDebuggerEditor = {
    attach: attachDebuggerToEditor,
    registerHoverProvider: registerHoverProvider,
    resolveVar: resolveVar,
  };
})();
