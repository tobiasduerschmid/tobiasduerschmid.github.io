/**
 * Time-travel debugger — main-thread module.
 *
 * Loaded lazily by TutorialCode._loadDebuggerModule() only when the tutorial
 * YAML opts in via `debugger: true`. Exposes a single global:
 *
 *   window.SEBookDebugger.attach(tutorialInstance)
 *   window.SEBookDebugger.onStepChange(tutorialInstance)
 *
 * Architecture (see plan: .claude/plans/what-would-be-options-temporal-ritchie.md):
 *
 *   Main thread (this file)              Pyodide Worker
 *   ------------------------             ----------------
 *   Monaco editor (glyph margin)         pyodide.runPythonAsync(code)
 *   Hover provider                       ↓ instrumented by
 *   Debug button + step toolbar          TimeTravelDebugger(bdb.Bdb)
 *   Variables / Stack / Watch tabs       user_line() →
 *   History scrubber                       postMessage('paused', batched_snaps)
 *   ↕                                      Atomics.wait(SAB[0], 0)
 *   postMessage / SharedArrayBuffer      ← reads cmd; bdb.set_step()/set_next()
 *
 * SAB layout matches js/debugger/worker-extension.js exactly:
 *   Int32 [0]  command (1=continue, 2=step, 3=next, 4=return, 5=stop)
 *   Int32 [1]  watches_dirty
 *   Int32 [2]  bps_dirty
 *   Int32 [3]  watches_len
 *   Int32 [4]  bps_len
 *   Uint8 [32 .. 32+32K)   watches JSON
 *   Uint8 [32+32K .. +32K) bps JSON
 */

(function () {
  'use strict';

  // ---- SAB layout (must match worker-extension.js) ------------------------
  var SAB_HEADER_BYTES = 32;
  var WATCH_REGION_BYTES = 32 * 1024;
  var BPS_REGION_BYTES = 32 * 1024;
  var SAB_TOTAL_BYTES = SAB_HEADER_BYTES + WATCH_REGION_BYTES + BPS_REGION_BYTES;
  var WATCH_OFF = SAB_HEADER_BYTES;
  var BPS_OFF = WATCH_OFF + WATCH_REGION_BYTES;
  var SLOT_CMD = 0, SLOT_WATCHES_DIRTY = 1, SLOT_BPS_DIRTY = 2;
  var SLOT_WATCHES_LEN = 3, SLOT_BPS_LEN = 4;
  var CMD_CONTINUE = 1, CMD_STEP = 2, CMD_NEXT = 3, CMD_RETURN = 4, CMD_STOP = 5;

  var UNCHANGED = 'UNCHANGED';   // diff sentinel from Python side

  // ---- attach() -----------------------------------------------------------
  function attach(tutorial) {
    if (!window.crossOriginIsolated) {
      // First load on a fresh debugger tutorial — service worker registered
      // but headers don't take effect until reload. Tutorial usable; just no
      // Debug button. The COI shim's auto-reload (in coi-serviceworker.js)
      // typically handles this transparently.
      injectReloadBanner(tutorial);
      return;
    }
    if (!window.SharedArrayBuffer || !window.Atomics) {
      console.warn('[SEBookDebugger] SharedArrayBuffer/Atomics unavailable — debugger disabled');
      return;
    }
    if (tutorial._debuggerCtl) return;   // already attached
    tutorial._debuggerCtl = new DebuggerController(tutorial);
    tutorial._debuggerCtl.install();
  }

  function onStepChange(tutorial) {
    if (tutorial._debuggerCtl) tutorial._debuggerCtl.handleStepChange();
  }

  function injectReloadBanner(tutorial) {
    // Show a small one-time hint near the editor toolbar that a reload is needed.
    var hostFinder = function () {
      return tutorial.root && tutorial.root.querySelector('.tvm-output-actions');
    };
    var tries = 0;
    var t = setInterval(function () {
      var host = hostFinder();
      if (host) {
        clearInterval(t);
        var note = document.createElement('span');
        note.className = 'sebook-dbg-reload-note';
        note.title = 'The debugger needs cross-origin isolation. Reload the page once to activate it.';
        note.textContent = 'Debugger: reload to activate';
        host.appendChild(note);
      }
      if (++tries > 50) clearInterval(t);
    }, 100);
  }

  // ===========================================================================
  // DebuggerController
  // ===========================================================================
  function DebuggerController(tutorial) {
    this.t = tutorial;
    this.opts = tutorial.debuggerOptions || {};
    this.encoder = new TextEncoder();
    this.decoder = new TextDecoder();

    // Per-file breakpoint state. filename -> Map<line, {condition: string|null}>
    this.breakpoints = new Map();

    // History (frozen snapshots from worker). selectedFrameIdx is per-pause
    // selection within stack[].
    this.history = [];          // Snapshot[]
    this.historyIdx = -1;
    this.liveIdx = -1;          // last index that's actually "live" (worker is paused there)
    this.selectedFrameIdx = -1; // top of stack by default; -1 means top
    this.session = null;        // {sab, i32, u8, watches:Set<string>, capReached:boolean}
    this.outputDuringDebug = '';// buffered stdout (output panel collapsed)
    this.outputLines = 0;

    // Decorations: glyph + current-line
    this.bpDecorationIds = [];
    this.currentLineDecoIds = [];

    // Editor state to restore on debug stop
    this._editorWasReadOnly = false;
    this._panelOriginalFlex = '';
  }

  // ---- Lifecycle ------------------------------------------------------------
  DebuggerController.prototype.install = function () {
    this.loadPersistedBreakpoints();
    this.installTabs();
    this.installDebugButton();
    this.installGutterClickHandler();
    this.installHoverProvider();
    this.attachWorkerListener();
    this.refreshBpDecorations();
  };

  DebuggerController.prototype.handleStepChange = function () {
    // Stop any active session, clear history; keep breakpoints.
    if (this.session) this.stopSession();
    this.history = [];
    this.historyIdx = -1;
    this.liveIdx = -1;
    this.outputDuringDebug = '';
    this.outputLines = 0;
    this.renderAll();
    this.refreshBpDecorations();   // breakpoint visuals follow file switches
  };

  // ===========================================================================
  // Tab construction
  // ===========================================================================
  DebuggerController.prototype.installTabs = function () {
    var instructionsPanel = this.t.root.querySelector('.tvm-instructions-panel');
    if (!instructionsPanel) return;

    // 1. Ensure a tab bar exists. If the tutorial already has one (UML left
    //    layout), reuse it — append our 4 tabs after the existing Steps tab.
    //    If not, create one and prepend.
    var tabBar = instructionsPanel.querySelector('.tvm-left-tab-bar');
    if (!tabBar) {
      tabBar = document.createElement('div');
      tabBar.className = 'tvm-left-tab-bar';
      var stepsTab = document.createElement('button');
      stepsTab.className = 'tvm-left-tab active';
      stepsTab.setAttribute('data-panel', 'steps');
      stepsTab.innerHTML = '<i class="fa fa-book-open"></i> Steps';
      tabBar.appendChild(stepsTab);
      instructionsPanel.insertBefore(tabBar, instructionsPanel.firstChild);

      // Wire the click for the Steps tab so it correctly hides debug views
      // (the existing handler only ever cares about UML/steps).
      var self = this;
      stepsTab.addEventListener('click', function () {
        self.activateTab('steps');
      });
    }
    this.tabBar = tabBar;

    // 2. Create the 4 debug view divs as siblings of `.tvm-steps-view`.
    var stepsView = instructionsPanel.querySelector('.tvm-steps-view');
    if (!stepsView) return;

    var views = [
      { panel: 'dbg-vars',    label: '<i class="fa fa-list"></i> Variables',
        empty: 'Start debugging to see variables.' },
      { panel: 'dbg-stack',   label: '<i class="fa fa-layer-group"></i> Call Stack',
        empty: 'Start debugging to see the call stack.' },
      { panel: 'dbg-watch',   label: '<i class="fa fa-eye"></i> Watch',
        empty: '' /* watch panel always shows the input even when empty */ },
      { panel: 'dbg-history', label: '<i class="fa fa-clock-rotate-left"></i> History',
        empty: 'Start debugging to navigate execution history.' },
    ];
    var self = this;
    views.forEach(function (v) {
      var btn = document.createElement('button');
      btn.className = 'tvm-left-tab';
      btn.setAttribute('data-panel', v.panel);
      btn.innerHTML = v.label;
      btn.addEventListener('click', function () { self.activateTab(v.panel); });
      tabBar.appendChild(btn);

      var view = document.createElement('div');
      view.className = 'tvm-debug-view tvm-debug-view-' + v.panel;
      view.style.display = 'none';
      view.dataset.panel = v.panel;
      view.innerHTML = '<div class="tvm-debug-empty">' + v.empty + '</div>';
      // Insert AFTER stepsView so layout flow stays consistent
      instructionsPanel.appendChild(view);
    });

    // Hook other existing left tabs (Steps, UML) to also hide our debug views
    // when clicked. Their existing click handler runs first; ours runs after.
    var existing = tabBar.querySelectorAll('.tvm-left-tab');
    for (var i = 0; i < existing.length; i++) {
      var btn2 = existing[i];
      var panel = btn2.getAttribute('data-panel');
      if (panel !== 'steps' && panel !== 'dbg-vars' && panel !== 'dbg-stack' && panel !== 'dbg-watch' && panel !== 'dbg-history') {
        btn2.addEventListener('click', (function (p) {
          return function () { self.activateTab(p); };
        })(panel));
      }
    }
  };

  DebuggerController.prototype.activateTab = function (panel) {
    if (!this.tabBar) return;
    // Toggle active state on tabs
    var tabs = this.tabBar.querySelectorAll('.tvm-left-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('active', tabs[i].getAttribute('data-panel') === panel);
    }
    // Show/hide views
    var instructionsPanel = this.t.root.querySelector('.tvm-instructions-panel');
    var stepsView = instructionsPanel.querySelector('.tvm-steps-view');
    var umlView = instructionsPanel.querySelector('.tvm-uml-left-view');
    var debugViews = instructionsPanel.querySelectorAll('.tvm-debug-view');
    if (stepsView) stepsView.style.display = (panel === 'steps') ? 'flex' : 'none';
    if (umlView) umlView.style.display = (panel === 'uml') ? 'flex' : 'none';
    for (var j = 0; j < debugViews.length; j++) {
      debugViews[j].style.display = (debugViews[j].dataset.panel === panel) ? 'flex' : 'none';
    }
  };

  // ===========================================================================
  // Debug button + toolbar (in editor toolbar, next to Run/Test)
  // ===========================================================================
  DebuggerController.prototype.installDebugButton = function () {
    var actions = this.t.root.querySelector('.tvm-output-actions');
    if (!actions) return;
    var self = this;

    // Debug button — sits next to Run.
    this.debugBtn = document.createElement('button');
    this.debugBtn.className = 'tvm-debug-btn';
    this.debugBtn.title = 'Start debugger (F5)';
    this.debugBtn.innerHTML = '<i class="fa fa-bug"></i> Debug';
    this.debugBtn.addEventListener('click', function () { self.startSession(); });

    // Insert just before the Run button (or at end if not found)
    var runBtn = actions.querySelector('.tvm-run-btn');
    if (runBtn) actions.insertBefore(this.debugBtn, runBtn);
    else actions.appendChild(this.debugBtn);

    // Step toolbar — inserted after Run; hidden until session active.
    this.stepToolbar = document.createElement('div');
    this.stepToolbar.className = 'tvm-debug-toolbar';
    this.stepToolbar.style.display = 'none';
    this.stepToolbar.innerHTML =
      '<button class="tvm-debug-step" data-cmd="continue" title="Continue (F5)"><i class="fa fa-play"></i></button>' +
      '<button class="tvm-debug-step" data-cmd="next"     title="Step Over (F10)"><i class="fa fa-forward-step"></i></button>' +
      '<button class="tvm-debug-step" data-cmd="step"     title="Step Into (F11)"><i class="fa fa-arrow-down"></i></button>' +
      '<button class="tvm-debug-step" data-cmd="return"   title="Step Out (Shift+F11)"><i class="fa fa-arrow-up"></i></button>' +
      '<span class="tvm-debug-divider"></span>' +
      '<button class="tvm-debug-step" data-cmd="back"     title="Step Back (Shift+F10)"><i class="fa fa-backward-step"></i></button>' +
      '<span class="tvm-debug-divider"></span>' +
      '<button class="tvm-debug-step" data-cmd="stop"     title="Stop (Shift+F5)"><i class="fa fa-stop"></i></button>' +
      '<span class="tvm-debug-status"></span>';
    actions.appendChild(this.stepToolbar);

    var btns = this.stepToolbar.querySelectorAll('.tvm-debug-step');
    for (var i = 0; i < btns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          self.handleToolbarCmd(btn.getAttribute('data-cmd'));
        });
      })(btns[i]);
    }
    this.statusEl = this.stepToolbar.querySelector('.tvm-debug-status');

    // Keyboard shortcuts
    document.addEventListener('keydown', function (e) {
      if (!self.session) return;
      if (e.key === 'F5' && !e.shiftKey) { e.preventDefault(); self.handleToolbarCmd('continue'); }
      else if (e.key === 'F5' && e.shiftKey) { e.preventDefault(); self.handleToolbarCmd('stop'); }
      else if (e.key === 'F10' && !e.shiftKey) { e.preventDefault(); self.handleToolbarCmd('next'); }
      else if (e.key === 'F10' && e.shiftKey) { e.preventDefault(); self.handleToolbarCmd('back'); }
      else if (e.key === 'F11' && !e.shiftKey) { e.preventDefault(); self.handleToolbarCmd('step'); }
      else if (e.key === 'F11' && e.shiftKey) { e.preventDefault(); self.handleToolbarCmd('return'); }
    });
  };

  DebuggerController.prototype.handleToolbarCmd = function (cmd) {
    if (!this.session) return;
    if (cmd === 'back') {
      this.stepBack();
      return;
    }
    if (cmd === 'stop') {
      this.sendCommand(CMD_STOP);
      this.setStatus('stopping…');
      return;
    }
    // Forward commands need a snap-to-live first if user is rewound.
    if (this.historyIdx < this.liveIdx) {
      this.historyIdx = this.liveIdx;
      this.renderAll();
    }
    var code = cmd === 'continue' ? CMD_CONTINUE
            : cmd === 'step'     ? CMD_STEP
            : cmd === 'next'     ? CMD_NEXT
            : cmd === 'return'   ? CMD_RETURN
            : 0;
    if (!code) return;
    this.sendCommand(code);
    this.setStatus(cmd + '…');
    this.disableStepButtons(true);
  };

  DebuggerController.prototype.stepBack = function () {
    if (this.historyIdx <= 0) return;
    var current = this.history[this.historyIdx];
    var currentCallId = current && current.call_id;
    // Scan backward for the previous snapshot in the SAME call (Step Back-Over).
    // If we exhaust the current call, fall back to one snapshot earlier (effectively Step Back-Out).
    var i = this.historyIdx - 1;
    while (i >= 0 && this.history[i].call_id !== currentCallId) i--;
    if (i < 0) i = this.historyIdx - 1;   // fallback: just one snapshot back
    this.historyIdx = i;
    this.selectedFrameIdx = -1;
    this.renderAll();
    this.setStatus('rewound: step ' + (i + 1) + '/' + this.history.length);
  };

  DebuggerController.prototype.disableStepButtons = function (disabled) {
    if (!this.stepToolbar) return;
    var btns = this.stepToolbar.querySelectorAll('.tvm-debug-step');
    for (var i = 0; i < btns.length; i++) {
      var cmd = btns[i].getAttribute('data-cmd');
      // Step Back & Stop are always available (back is UI-only; stop must work mid-block).
      if (cmd === 'back' || cmd === 'stop') continue;
      btns[i].disabled = disabled;
    }
  };

  DebuggerController.prototype.setStatus = function (text) {
    if (this.statusEl) this.statusEl.textContent = text || '';
  };

  // ===========================================================================
  // Breakpoint gutter (inline manager — no third-party lib)
  // ===========================================================================
  DebuggerController.prototype.installGutterClickHandler = function () {
    var self = this;
    var hookEditor = function (editor) {
      if (!editor) return;
      editor.onMouseDown(function (e) {
        if (!e.target || e.target.type !== monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) return;
        var line = e.target.position && e.target.position.lineNumber;
        if (!line) return;
        var filename = self.activeFileForEditor(editor);
        if (!filename) return;
        if (e.event && e.event.rightButton) {
          self.editBreakpointCondition(filename, line);
        } else {
          self.toggleBreakpoint(filename, line);
        }
      });
    };
    hookEditor(this.t.editor);
    if (this.t.editor2) hookEditor(this.t.editor2);
    // Repaint decorations whenever Monaco's model changes (file switch)
    var refresh = function () { self.refreshBpDecorations(); };
    if (this.t.editor) this.t.editor.onDidChangeModel(refresh);
    if (this.t.editor2) this.t.editor2.onDidChangeModel(refresh);
  };

  DebuggerController.prototype.activeFileForEditor = function (editor) {
    if (editor === this.t.editor2) return this.t._rightActiveFile || this.t.activeFileName;
    return this.t._leftActiveFile || this.t.activeFileName;
  };

  DebuggerController.prototype.toggleBreakpoint = function (filename, line) {
    var path = '/tutorial/' + filename;
    var bps = this.breakpoints.get(path);
    if (!bps) { bps = new Map(); this.breakpoints.set(path, bps); }
    var change;
    if (bps.has(line)) {
      bps.delete(line);
      change = { op: 'remove', file: path, line: line };
    } else {
      bps.set(line, { condition: null });
      change = { op: 'add', file: path, line: line, condition: null };
    }
    this.persistBreakpoints();
    this.refreshBpDecorations();
    if (this.session) this.queueBreakpointChange(change);
  };

  DebuggerController.prototype.editBreakpointCondition = function (filename, line) {
    var path = '/tutorial/' + filename;
    var bps = this.breakpoints.get(path);
    if (!bps || !bps.has(line)) {
      // Right-click on empty line → set unconditional first (like clicking)
      this.toggleBreakpoint(filename, line);
      bps = this.breakpoints.get(path);
    }
    var current = bps.get(line);
    var existing = (current && current.condition) || '';
    var input = window.prompt('Breakpoint condition (Python expression, empty = unconditional):', existing);
    if (input === null) return;   // cancelled
    var cond = input.trim() ? input.trim() : null;
    bps.set(line, { condition: cond });
    this.persistBreakpoints();
    this.refreshBpDecorations();
    if (this.session) {
      this.queueBreakpointChange({ op: 'edit', file: path, line: line, condition: cond });
    }
  };

  DebuggerController.prototype.refreshBpDecorations = function () {
    var self = this;
    function paint(editor) {
      if (!editor) return;
      var model = editor.getModel(); if (!model) return;
      var fname = self.activeFileForEditor(editor); if (!fname) return;
      var path = '/tutorial/' + fname;
      var bps = self.breakpoints.get(path);
      var decos = [];
      if (bps) {
        bps.forEach(function (info, line) {
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
        });
      }
      // Reuse a per-editor decoration id list. Use a property on the editor.
      var key = '_dbgBpIds';
      var prev = editor[key] || [];
      editor[key] = editor.deltaDecorations(prev, decos);
    }
    paint(this.t.editor);
    paint(this.t.editor2);
  };

  DebuggerController.prototype.persistBreakpoints = function () {
    var ser = [];
    this.breakpoints.forEach(function (bps, path) {
      bps.forEach(function (info, line) {
        ser.push({ path: path, line: line, condition: info.condition || null });
      });
    });
    try {
      localStorage.setItem('tutorial-debug-bps-' + this.t.tutorialId, JSON.stringify(ser));
    } catch (e) { /* localStorage full or disabled */ }
  };

  DebuggerController.prototype.loadPersistedBreakpoints = function () {
    try {
      var raw = localStorage.getItem('tutorial-debug-bps-' + this.t.tutorialId);
      if (!raw) return;
      var arr = JSON.parse(raw);
      var self = this;
      arr.forEach(function (b) {
        var bps = self.breakpoints.get(b.path);
        if (!bps) { bps = new Map(); self.breakpoints.set(b.path, bps); }
        bps.set(b.line, { condition: b.condition || null });
      });
    } catch (e) { /* ignore */ }
  };

  DebuggerController.prototype.collectBreakpointsForRun = function () {
    var out = [];
    this.breakpoints.forEach(function (bps, path) {
      bps.forEach(function (info, line) {
        out.push({ file: path, line: line, condition: info.condition || null });
      });
    });
    return out;
  };

  // ===========================================================================
  // Hover-to-inspect
  // ===========================================================================
  DebuggerController.prototype.installHoverProvider = function () {
    var self = this;
    monaco.languages.registerHoverProvider('python', {
      provideHover: function (model, position) {
        if (self.historyIdx < 0) return null;
        var word = model.getWordAtPosition(position);
        if (!word) return null;
        var snap = self.history[self.historyIdx];
        if (!snap) return null;
        var frameIdx = self.selectedFrameIdx >= 0 ? self.selectedFrameIdx : (snap.stack.length - 1);
        var frame = snap.stack[frameIdx];
        if (!frame) return null;
        var name = word.word;
        // Resolve through diff-aware lookup: walk back through history if UNCHANGED.
        var resolved = self.resolveVar(snap, frameIdx, 'locals', name);
        if (!resolved) {
          resolved = self.resolveVar(snap, frameIdx, 'globals', name);
        }
        if (!resolved) return null;
        var md = '**`' + name + '`** _' + (resolved.type || resolved.kind) + '_\n\n' +
                 '```python\n' + (resolved.repr || resolved.preview || '') + '\n```';
        return {
          range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
          contents: [{ value: md }],
        };
      },
    });
  };

  // Walk history backward to resolve UNCHANGED diff sentinels into actual values.
  DebuggerController.prototype.resolveVar = function (snap, frameIdx, scope, name) {
    var idx = this.historyIdx;
    var callId = snap.stack[frameIdx] && snap.stack[frameIdx].call_id;
    while (idx >= 0) {
      var s = this.history[idx];
      if (!s || !s.stack) { idx--; continue; }
      // Find the same call in this snapshot's stack
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
  };

  // ===========================================================================
  // Worker protocol — start session, listen for paused/complete
  // ===========================================================================
  DebuggerController.prototype.attachWorkerListener = function () {
    if (!this.t._worker) return;
    var self = this;
    this.t._worker.addEventListener('message', function (e) {
      var msg = e.data;
      if (msg.type === 'debuggerReady') self.onDebuggerReady();
      else if (msg.type === 'paused') self.onPaused(msg);
      else if (msg.type === 'debugComplete') self.onDebugComplete(msg);
      else if (msg.type === 'capReached') self.onCapReached(msg);
      else if (msg.type === 'breakpointError') self.onBreakpointError(msg);
      else if (msg.type === 'debuggerError') console.error('[debugger]', msg.message);
    });
  };

  DebuggerController.prototype.startSession = function () {
    if (this.session) return;   // already active
    if (!this.t._worker) { alert('Pyodide not ready yet'); return; }

    // Sync the active file content to the worker filesystem before debug.
    // The tutorial's existing flow writes files via the `write` message; we
    // ensure the active editor model is also written so the path matches what
    // bdb sees in frame.f_code.co_filename.
    var filename = this.t.activeFileName;
    if (!filename) { alert('No active file to debug'); return; }
    var model = this.t.editorModels[filename] && this.t.editorModels[filename].model;
    if (!model) { alert('Cannot locate code for ' + filename); return; }
    var code = model.getValue();
    var path = '/tutorial/' + filename;

    // Set up SAB
    var sab = new SharedArrayBuffer(SAB_TOTAL_BYTES);
    var i32 = new Int32Array(sab);
    var u8 = new Uint8Array(sab);

    this.session = {
      sab: sab, i32: i32, u8: u8,
      // Seed from any watches the user added BEFORE starting the session.
      watches: (this._pendingWatches || []).slice(),
      capReached: false,
      pendingStart: { filename: path, code: code },
    };
    this.history = [];
    this.historyIdx = -1;
    this.liveIdx = -1;
    this.outputDuringDebug = '';
    this.outputLines = 0;

    // Lock editor read-only
    if (this.t.editor) {
      this._editorWasReadOnly = !!this.t.editor.getOption(monaco.editor.EditorOption.readOnly);
      this.t.editor.updateOptions({ readOnly: true });
    }
    if (this.t.editor2) this.t.editor2.updateOptions({ readOnly: true });

    // Disable Run/Test
    var runBtn = this.t.root.querySelector('.tvm-run-btn');
    if (runBtn) { runBtn.disabled = true; runBtn.title = 'Stop the debugger to run/test'; }

    // Show step toolbar; hide Debug button
    if (this.debugBtn) this.debugBtn.style.display = 'none';
    if (this.stepToolbar) this.stepToolbar.style.display = 'flex';

    // Auto-switch to Variables tab; collapse output panel
    this.activateTab('dbg-vars');
    this.collapseOutputPanel(true);
    this.disableStepButtons(true);
    this.setStatus('starting…');

    // Send init then enableDebugger; the worker responds with debuggerReady.
    this.t._worker.postMessage({ type: 'debugInit', sab: sab });
    this.t._worker.postMessage({ type: 'enableDebugger' });
  };

  DebuggerController.prototype.onDebuggerReady = function () {
    if (!this.session || !this.session.pendingStart) return;
    var st = this.session.pendingStart;
    this.session.pendingStart = null;
    this.t._worker.postMessage({
      type: 'runDebug',
      filename: st.filename,
      code: st.code,
      breakpoints: this.collectBreakpointsForRun(),
      watches: this.session.watches,
      options: this.opts,
    });
    this.setStatus('running…');
  };

  DebuggerController.prototype.sendCommand = function (cmdCode) {
    if (!this.session) return;
    Atomics.store(this.session.i32, SLOT_CMD, cmdCode);
    Atomics.notify(this.session.i32, SLOT_CMD, 1);
  };

  DebuggerController.prototype.queueBreakpointChange = function (change) {
    if (!this.session) return;
    // Read existing pending list (if any), append, re-encode.
    // For simplicity we always overwrite with a single-change array.
    var json = JSON.stringify([change]);
    var bytes = this.encoder.encode(json);
    this.session.u8.set(bytes, BPS_OFF);
    Atomics.store(this.session.i32, SLOT_BPS_LEN, bytes.length);
    Atomics.store(this.session.i32, SLOT_BPS_DIRTY, 1);
  };

  DebuggerController.prototype.queueWatchUpdate = function () {
    if (!this.session) return;
    var json = JSON.stringify(this.session.watches);
    var bytes = this.encoder.encode(json);
    this.session.u8.set(bytes, WATCH_OFF);
    Atomics.store(this.session.i32, SLOT_WATCHES_LEN, bytes.length);
    Atomics.store(this.session.i32, SLOT_WATCHES_DIRTY, 1);
  };

  DebuggerController.prototype.onPaused = function (msg) {
    if (!this.session) return;
    var snaps = msg.snapshots || [];
    for (var i = 0; i < snaps.length; i++) this.history.push(snaps[i]);
    this.liveIdx = this.history.length - 1;
    this.historyIdx = this.liveIdx;
    this.selectedFrameIdx = -1;
    this.disableStepButtons(false);
    this.setStatus('paused at line ' + this.history[this.liveIdx].line);
    this.renderAll();
  };

  DebuggerController.prototype.onDebugComplete = function (msg) {
    this.setStatus(msg.exitCode === 0 ? 'finished' : ('error: ' + (msg.error || '')));
    this.disableStepButtons(true);
    // Keep history viewable in review mode; user can click "Restart Debug" via Debug button.
    this.endSession(true);
  };

  DebuggerController.prototype.onCapReached = function (msg) {
    if (!this.session) return;
    this.session.capReached = true;
    this.setStatus('snapshot cap (' + msg.limit + ') — back-in-time disabled');
  };

  DebuggerController.prototype.onBreakpointError = function (msg) {
    var bps = this.breakpoints.get(msg.file);
    if (bps && bps.has(msg.line)) {
      var info = bps.get(msg.line);
      info.condError = msg.error;
      this.refreshBpDecorations();
    }
  };

  DebuggerController.prototype.stopSession = function () {
    if (!this.session) return;
    this.sendCommand(CMD_STOP);
  };

  DebuggerController.prototype.endSession = function (keepHistory) {
    // Restore editor + UI state
    if (this.t.editor) this.t.editor.updateOptions({ readOnly: this._editorWasReadOnly });
    if (this.t.editor2) this.t.editor2.updateOptions({ readOnly: this._editorWasReadOnly });
    var runBtn = this.t.root.querySelector('.tvm-run-btn');
    if (runBtn) { runBtn.disabled = false; runBtn.title = 'Run current file (Ctrl+Enter)'; }
    if (this.stepToolbar) this.stepToolbar.style.display = 'none';
    if (this.debugBtn) this.debugBtn.style.display = '';
    this.collapseOutputPanel(false);
    this.clearCurrentLineDecoration();
    this.session = null;
    if (!keepHistory) {
      this.history = [];
      this.historyIdx = -1;
      this.liveIdx = -1;
      this.renderAll();
    }
  };

  // ===========================================================================
  // Output panel collapse
  // ===========================================================================
  DebuggerController.prototype.collapseOutputPanel = function (collapse) {
    var panel = this.t.root.querySelector('.tvm-output-panel');
    if (!panel) return;
    if (collapse) {
      this._panelOriginalFlex = panel.style.flex || '';
      panel.style.flex = '0 0 32px';
      panel.classList.add('tvm-debug-collapsed');
    } else {
      panel.style.flex = this._panelOriginalFlex;
      panel.classList.remove('tvm-debug-collapsed');
    }
  };

  // ===========================================================================
  // Rendering
  // ===========================================================================
  DebuggerController.prototype.renderAll = function () {
    this.renderVariables();
    this.renderCallStack();
    this.renderWatch();
    this.renderHistory();
    this.renderCurrentLine();
  };

  DebuggerController.prototype.renderVariables = function () {
    var view = this.viewEl('dbg-vars');
    if (!view) return;
    if (this.historyIdx < 0) {
      view.innerHTML = '<div class="tvm-debug-empty">Start debugging to see variables.</div>';
      return;
    }
    var snap = this.history[this.historyIdx];
    var frameIdx = this.selectedFrameIdx >= 0 ? this.selectedFrameIdx : (snap.stack.length - 1);
    var frame = snap.stack[frameIdx];
    if (!frame) { view.innerHTML = '<div class="tvm-debug-empty">No frame.</div>'; return; }
    var html = '<div class="tvm-debug-section-head">Locals · ' + this.escape(frame.function) + '</div>';
    html += this.renderVarTable(snap, frameIdx, 'locals', frame.locals);
    if (frame.globals) {
      html += '<div class="tvm-debug-section-head">Globals</div>';
      html += this.renderVarTable(snap, frameIdx, 'globals', frame.globals);
    }
    if (snap.exception) {
      html = '<div class="tvm-debug-exception">⚠️ ' + this.escape(snap.exception.type) + ': ' +
             this.escape(snap.exception.message) + '</div>' + html;
    }
    if (snap.event === 'return' && snap.return_value) {
      html = '<div class="tvm-debug-return">→ returned ' +
             this.escape(snap.return_value.repr || '') + '</div>' + html;
    }
    view.innerHTML = html;
    this.wireExpanders(view);
  };

  DebuggerController.prototype.renderVarTable = function (snap, frameIdx, scope, dict) {
    if (!dict || !Object.keys(dict).length) {
      return '<div class="tvm-debug-empty-row">(no ' + scope + ')</div>';
    }
    var rows = [];
    var seenOids = {};   // alias detection within scope
    var keys = Object.keys(dict).sort();
    for (var i = 0; i < keys.length; i++) {
      var name = keys[i];
      var resolved = (dict[name] === UNCHANGED)
        ? this.resolveVar(snap, frameIdx, scope, name)
        : dict[name];
      if (!resolved) continue;
      var oid = resolved.oid;
      var aliasBadge = '';
      if (oid && seenOids[oid]) {
        aliasBadge = ' <span class="tvm-debug-alias" title="Same object as ' +
                     this.escape(seenOids[oid]) + ' (oid ' + oid + ')">↔ ' +
                     this.escape(seenOids[oid]) + '</span>';
      } else if (oid) {
        seenOids[oid] = name;
      }
      rows.push(this.renderVarRow(name, resolved, aliasBadge, 0));
    }
    return '<div class="tvm-debug-vars">' + rows.join('') + '</div>';
  };

  DebuggerController.prototype.renderVarRow = function (name, val, aliasBadge, depth) {
    if (!val) return '';
    var nameHtml = '<span class="tvm-debug-var-name">' + this.escape(name) + '</span>';
    var typeHtml = '<span class="tvm-debug-var-type">' + this.escape(val.type || val.kind) + '</span>';
    var valueHtml = '<span class="tvm-debug-var-value">' + this.escape(val.repr || val.preview || '') + '</span>';
    var hasChildren = val.kind === 'collection' || (val.kind === 'object' && val.attrs && Object.keys(val.attrs).length);
    var expander = hasChildren
      ? '<span class="tvm-debug-expander" data-expanded="false">▶</span>'
      : '<span class="tvm-debug-expander-spacer"></span>';
    var row = '<div class="tvm-debug-var-row" style="padding-left:' + (depth * 14) + 'px">' +
              expander + nameHtml + typeHtml + valueHtml + (aliasBadge || '') + '</div>';
    if (hasChildren) {
      var childHtml = this.renderChildren(val, depth + 1);
      row += '<div class="tvm-debug-var-children" style="display:none">' + childHtml + '</div>';
    }
    return row;
  };

  DebuggerController.prototype.renderChildren = function (val, depth) {
    if (val.kind === 'collection') {
      if (val.type === 'dict') {
        var rows = [];
        for (var i = 0; i < val.children.length; i++) {
          var entry = val.children[i];
          rows.push(this.renderVarRow(entry.key, entry.value, '', depth));
        }
        if (val.truncated) rows.push('<div class="tvm-debug-truncated" style="padding-left:' + (depth * 14) + 'px">… +' + (val.len - val.children.length) + ' more</div>');
        return rows.join('');
      } else {
        var rows = [];
        for (var i = 0; i < val.children.length; i++) {
          rows.push(this.renderVarRow('[' + i + ']', val.children[i], '', depth));
        }
        if (val.truncated) rows.push('<div class="tvm-debug-truncated" style="padding-left:' + (depth * 14) + 'px">… +' + (val.len - val.children.length) + ' more</div>');
        return rows.join('');
      }
    } else if (val.kind === 'object' && val.attrs) {
      var keys = Object.keys(val.attrs).sort();
      var rows = [];
      for (var i = 0; i < keys.length; i++) {
        rows.push(this.renderVarRow(keys[i], val.attrs[keys[i]], '', depth));
      }
      return rows.join('');
    }
    return '';
  };

  DebuggerController.prototype.wireExpanders = function (view) {
    var expanders = view.querySelectorAll('.tvm-debug-expander');
    for (var i = 0; i < expanders.length; i++) {
      (function (ex) {
        ex.addEventListener('click', function () {
          var expanded = ex.getAttribute('data-expanded') === 'true';
          ex.setAttribute('data-expanded', !expanded);
          ex.textContent = expanded ? '▶' : '▼';
          var children = ex.parentElement.nextElementSibling;
          if (children && children.classList.contains('tvm-debug-var-children')) {
            children.style.display = expanded ? 'none' : 'block';
          }
        });
      })(expanders[i]);
    }
  };

  DebuggerController.prototype.renderCallStack = function () {
    var view = this.viewEl('dbg-stack');
    if (!view) return;
    if (this.historyIdx < 0) {
      view.innerHTML = '<div class="tvm-debug-empty">Start debugging to see the call stack.</div>';
      return;
    }
    var snap = this.history[this.historyIdx];
    var rows = [];
    var selectedIdx = this.selectedFrameIdx >= 0 ? this.selectedFrameIdx : (snap.stack.length - 1);
    for (var i = snap.stack.length - 1; i >= 0; i--) {
      var f = snap.stack[i];
      var cls = 'tvm-debug-frame' + (i === selectedIdx ? ' active' : '');
      rows.push('<div class="' + cls + '" data-frame-idx="' + i + '">' +
                '<span class="tvm-debug-frame-fn">' + this.escape(f.function) + '</span>' +
                '<span class="tvm-debug-frame-loc">' + this.escape(this.basename(f.file)) + ':' + f.line + '</span>' +
                '</div>');
    }
    view.innerHTML = '<div class="tvm-debug-stack">' + rows.join('') + '</div>';
    var self = this;
    var frames = view.querySelectorAll('.tvm-debug-frame');
    for (var j = 0; j < frames.length; j++) {
      (function (frame) {
        frame.addEventListener('click', function () {
          self.selectedFrameIdx = +frame.getAttribute('data-frame-idx');
          self.renderVariables();
          self.renderCallStack();
          self.renderCurrentLine();
        });
      })(frames[j]);
    }
  };

  DebuggerController.prototype.renderWatch = function () {
    var view = this.viewEl('dbg-watch');
    if (!view) return;
    var snap = this.historyIdx >= 0 ? this.history[this.historyIdx] : null;
    // Show in-session watches if available, else pre-session "pending" ones.
    var watches = (this.session && this.session.watches)
                  || this._pendingWatches
                  || [];
    var rows = [];
    for (var i = 0; i < watches.length; i++) {
      var expr = watches[i];
      var v = snap && snap.watches ? snap.watches[expr] : null;
      var valStr = v
        ? (v.error
            ? '<span class="tvm-debug-watch-error">' + this.escape(v.error) + '</span>'
            : this.escape(v.repr || v.preview || ''))
        : '<span class="tvm-debug-watch-na">—</span>';
      rows.push('<div class="tvm-debug-watch-row">' +
                '<span class="tvm-debug-watch-expr">' + this.escape(expr) + '</span>' +
                '<span class="tvm-debug-watch-arrow">→</span>' +
                '<span class="tvm-debug-watch-val">' + valStr + '</span>' +
                '<button class="tvm-debug-watch-remove" data-i="' + i + '" title="Remove">×</button>' +
                '</div>');
    }
    view.innerHTML =
      '<div class="tvm-debug-watch-list">' + rows.join('') + '</div>' +
      '<div class="tvm-debug-watch-add">' +
      '<input type="text" class="tvm-debug-watch-input" placeholder="Add a Python expression to watch (e.g. len(items))" />' +
      '<button class="tvm-debug-watch-add-btn">+ Add</button>' +
      '</div>' +
      (watches.length === 0 ? '<div class="tvm-debug-empty">Watches are evaluated on every step. Avoid expressions with side effects.</div>' : '');

    var self = this;
    var input = view.querySelector('.tvm-debug-watch-input');
    var addBtn = view.querySelector('.tvm-debug-watch-add-btn');
    function add() {
      var expr = (input.value || '').trim();
      if (!expr) return;
      if (!self.session) {
        // No session yet: store on a pending list so next session picks them up.
        self._pendingWatches = self._pendingWatches || [];
        self._pendingWatches.push(expr);
      } else {
        self.session.watches.push(expr);
        // Also keep pendingWatches in sync so the same list survives a future
        // session restart without requiring the user to re-type.
        self._pendingWatches = self.session.watches.slice();
        self.queueWatchUpdate();
      }
      input.value = '';
      self.renderWatch();
    }
    if (addBtn) addBtn.addEventListener('click', add);
    if (input) input.addEventListener('keydown', function (e) { if (e.key === 'Enter') add(); });
    var removeBtns = view.querySelectorAll('.tvm-debug-watch-remove');
    for (var i = 0; i < removeBtns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var idx = +btn.getAttribute('data-i');
          if (self.session) {
            self.session.watches.splice(idx, 1);
            self._pendingWatches = self.session.watches.slice();
            self.queueWatchUpdate();
          } else if (self._pendingWatches) {
            self._pendingWatches.splice(idx, 1);
          }
          self.renderWatch();
        });
      })(removeBtns[i]);
    }
  };

  DebuggerController.prototype.renderHistory = function () {
    var view = this.viewEl('dbg-history');
    if (!view) return;
    if (this.historyIdx < 0 || this.history.length === 0) {
      view.innerHTML = '<div class="tvm-debug-empty">Start debugging to navigate execution history.</div>';
      return;
    }
    var n = this.history.length;
    var html = '<div class="tvm-debug-history-controls">' +
      '<input type="range" class="tvm-debug-history-slider" min="0" max="' + (n - 1) + '" value="' + this.historyIdx + '">' +
      '<span class="tvm-debug-history-pos">' + (this.historyIdx + 1) + ' / ' + n + '</span>' +
      (this.historyIdx === this.liveIdx
        ? '<span class="tvm-debug-history-live">● live</span>'
        : '<span class="tvm-debug-history-rewound">⏮ rewound</span>') +
      '</div>';
    // Compact list of recent events
    html += '<div class="tvm-debug-history-list">';
    var start = Math.max(0, this.historyIdx - 50);
    var end = Math.min(n, start + 100);
    for (var i = start; i < end; i++) {
      var s = this.history[i];
      var marker = (i === this.historyIdx) ? ' active' : '';
      var ev = s.event === 'call' ? '↳' : s.event === 'return' ? '↰' : s.event === 'exception' ? '⚠' : '·';
      html += '<div class="tvm-debug-history-item' + marker + '" data-i="' + i + '">' +
              '<span class="tvm-debug-history-i">' + (i + 1) + '</span>' +
              '<span class="tvm-debug-history-ev">' + ev + '</span>' +
              '<span class="tvm-debug-history-loc">' + this.escape(this.basename(s.file)) + ':' + s.line + '</span>' +
              '</div>';
    }
    html += '</div>';
    view.innerHTML = html;
    var self = this;
    var slider = view.querySelector('.tvm-debug-history-slider');
    if (slider) slider.addEventListener('input', function () {
      self.historyIdx = +slider.value;
      self.selectedFrameIdx = -1;
      self.renderAll();
    });
    var items = view.querySelectorAll('.tvm-debug-history-item');
    for (var i = 0; i < items.length; i++) {
      (function (it) {
        it.addEventListener('click', function () {
          self.historyIdx = +it.getAttribute('data-i');
          self.selectedFrameIdx = -1;
          self.renderAll();
        });
      })(items[i]);
    }
  };

  DebuggerController.prototype.renderCurrentLine = function () {
    if (!this.t.editor) return;
    if (this.historyIdx < 0) { this.clearCurrentLineDecoration(); return; }
    var snap = this.history[this.historyIdx];
    var frameIdx = this.selectedFrameIdx >= 0 ? this.selectedFrameIdx : (snap.stack.length - 1);
    var frame = snap.stack[frameIdx];
    if (!frame) return;
    var line = frame.line;
    // Map worker filename (`/tutorial/foo.py`) to Monaco model URI
    var fname = frame.file.replace(/^\/tutorial\//, '');
    if (fname !== this.t.activeFileName) {
      // Could switch the file — for v1, just show in current editor only when
      // the current file matches.
    }
    var rewound = this.historyIdx < this.liveIdx;
    var cls = rewound ? 'tvm-debug-current-line-rewound' : 'tvm-debug-current-line';
    var glyph = rewound ? 'tvm-debug-current-glyph-rewound' : 'tvm-debug-current-glyph';
    var deco = [{
      range: new monaco.Range(line, 1, line, 1),
      options: {
        isWholeLine: true,
        className: cls,
        glyphMarginClassName: glyph,
      },
    }];
    this.currentLineDecoIds = this.t.editor.deltaDecorations(this.currentLineDecoIds, deco);
    // Reveal the line so it's in view
    this.t.editor.revealLineInCenterIfOutsideViewport(line);
  };

  DebuggerController.prototype.clearCurrentLineDecoration = function () {
    if (this.t.editor) {
      this.currentLineDecoIds = this.t.editor.deltaDecorations(this.currentLineDecoIds, []);
    }
  };

  DebuggerController.prototype.viewEl = function (panel) {
    return this.t.root.querySelector('.tvm-debug-view-' + panel);
  };

  DebuggerController.prototype.escape = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  DebuggerController.prototype.basename = function (p) {
    if (!p) return '';
    var i = p.lastIndexOf('/');
    return i >= 0 ? p.substring(i + 1) : p;
  };

  // ===========================================================================
  // Public API
  // ===========================================================================
  window.SEBookDebugger = {
    attach: attach,
    onStepChange: onStepChange,
  };
})();
