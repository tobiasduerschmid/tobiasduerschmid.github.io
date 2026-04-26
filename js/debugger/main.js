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
 *   Int32 [0]  command (1=continue, 2=step, 3=next, 4=return, 5=stop, 6=sync)
 *   Int32 [1]  watches_dirty
 *   Int32 [2]  bps_dirty
 *   Int32 [3]  edits_dirty
 *   Int32 [4]  watches_len
 *   Int32 [5]  bps_len
 *   Int32 [6]  edits_len
 *   Uint8 [WATCH_OFF .. +32K) watches JSON
 *   Uint8 [BPS_OFF   .. +32K) breakpoint changes JSON
 *   Uint8 [EDITS_OFF .. +32K) live edit JSON
 */

(function () {
  'use strict';

  // ---- SAB layout (must match worker-extension.js) ------------------------
  var SAB_HEADER_BYTES = 32;
  var WATCH_REGION_BYTES = 32 * 1024;
  var BPS_REGION_BYTES = 32 * 1024;
  var EDITS_REGION_BYTES = 32 * 1024;
  var SAB_TOTAL_BYTES = SAB_HEADER_BYTES + WATCH_REGION_BYTES + BPS_REGION_BYTES + EDITS_REGION_BYTES;
  var WATCH_OFF = SAB_HEADER_BYTES;
  var BPS_OFF = WATCH_OFF + WATCH_REGION_BYTES;
  var EDITS_OFF = BPS_OFF + BPS_REGION_BYTES;
  var SLOT_CMD = 0;
  var SLOT_WATCHES_DIRTY = 1, SLOT_BPS_DIRTY = 2, SLOT_EDITS_DIRTY = 3;
  var SLOT_WATCHES_LEN = 4, SLOT_BPS_LEN = 5, SLOT_EDITS_LEN = 6;
  var CMD_CONTINUE = 1, CMD_STEP = 2, CMD_NEXT = 3, CMD_RETURN = 4, CMD_STOP = 5;
  var CMD_SYNC = 6;

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
    this.paused = false;
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
    this.loadConfiguredBreakpoints();
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
    this.paused = false;
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

    // 2. Create the debug views as siblings of `.tvm-steps-view`.
    //    Single combined "Debug" tab contains three stacked, collapsible
    //    sections in this top-to-bottom order: Watch, Call Stack, Variables.
    //    History gets its own tab — it has different ergonomics (scrubber +
    //    long list) and benefits from full vertical real estate.
    var stepsView = instructionsPanel.querySelector('.tvm-steps-view');
    if (!stepsView) return;

    var views = [
      { panel: 'dbg-combined', label: '<i class="fa fa-bug"></i> Debug',
        type: 'combined' },
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
      if (v.type === 'combined') {
        view.innerHTML = self._buildCombinedViewShell();
      } else {
        view.innerHTML = '<div class="tvm-debug-empty">' + (v.empty || '') + '</div>';
      }
      instructionsPanel.appendChild(view);
    });

    // Wire collapse/expand on section headers inside the combined view
    this._wireSectionToggles();

    // Hook other existing left tabs (Steps, UML) to also hide our debug views
    // when clicked. Their existing click handler runs first; ours runs after.
    var existing = tabBar.querySelectorAll('.tvm-left-tab');
    for (var i = 0; i < existing.length; i++) {
      var btn2 = existing[i];
      var panel = btn2.getAttribute('data-panel');
      if (panel !== 'steps' && panel !== 'dbg-combined') {
        btn2.addEventListener('click', (function (p) {
          return function () { self.activateTab(p); };
        })(panel));
      }
    }
  };

  // The combined-view shell. Three sections in order: Watch, Call Stack,
  // Variables. Each section has a clickable header (chevron rotates), a body
  // that hides when the section is collapsed, and a stable `data-section`
  // attribute used by the per-section render methods to find their target.
  // Collapse state persists per-tutorial in localStorage.
  DebuggerController.prototype._buildCombinedViewShell = function () {
    var sections = [
      { key: 'watch',   label: 'Watch',       icon: 'fa-eye',                empty: 'Start debugging to see watches.' },
      { key: 'stack',   label: 'Call Stack',  icon: 'fa-layer-group',        empty: 'Start debugging to see the call stack.' },
      { key: 'vars',    label: 'Variables',   icon: 'fa-list',               empty: 'Start debugging to see variables.' },
      { key: 'history', label: 'History',     icon: 'fa-clock-rotate-left',  empty: 'Start debugging to navigate execution history.' },
    ];
    var self = this;
    return sections.map(function (s) {
      var collapsed = self._isSectionCollapsed(s.key);
      return '<section class="tvm-dbg-section' + (collapsed ? ' collapsed' : '') +
             '" data-section="' + s.key + '">' +
             '<header class="tvm-dbg-section-head" data-section="' + s.key + '">' +
             '<span class="tvm-dbg-section-chevron">▾</span>' +
             '<i class="fa ' + s.icon + '"></i>' +
             '<span class="tvm-dbg-section-title">' + s.label + '</span>' +
             '</header>' +
             '<div class="tvm-dbg-section-body" data-section="' + s.key + '">' +
             '<div class="tvm-debug-empty">' + s.empty + '</div>' +
             '</div>' +
             '</section>';
    }).join('');
  };

  DebuggerController.prototype._sectionStorageKey = function (key) {
    return 'tutorial-debug-section-' + this.t.tutorialId + '-' + key;
  };
  DebuggerController.prototype._isSectionCollapsed = function (key) {
    try { return localStorage.getItem(this._sectionStorageKey(key)) === 'collapsed'; }
    catch (e) { return false; }
  };
  DebuggerController.prototype._setSectionCollapsed = function (key, collapsed) {
    try { localStorage.setItem(this._sectionStorageKey(key), collapsed ? 'collapsed' : 'expanded'); }
    catch (e) { /* private mode etc. — ignore */ }
  };

  DebuggerController.prototype._wireSectionToggles = function () {
    var self = this;
    var combined = this.t.root.querySelector('.tvm-debug-view-dbg-combined');
    if (!combined) return;
    combined.addEventListener('click', function (e) {
      var head = e.target && e.target.closest && e.target.closest('.tvm-dbg-section-head');
      if (!head) return;
      var section = head.parentElement;
      if (!section) return;
      var key = section.getAttribute('data-section');
      var nowCollapsed = !section.classList.contains('collapsed');
      section.classList.toggle('collapsed', nowCollapsed);
      self._setSectionCollapsed(key, nowCollapsed);
    });
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
    // A rewound history row is a different execution cursor. To move forward
    // from there, restart and replay to that snapshot, then issue the command.
    if (this.historyIdx < this.liveIdx) {
      this.restartFromHistory(cmd);
      return;
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

  // Restart the debug session from the beginning and replay to the selected
  // history index. This is required whenever the user wants to execute forward
  // from a rewound snapshot: the live worker is parked at a later point and
  // cannot be retroactively moved back.
  DebuggerController.prototype.restartFromHistory = function (followupCmd) {
    var overrides = (this.session.pendingOverrides || []).slice();
    var resumeAtIdx = this.historyIdx;
    var replayAnchor = this.makeReplayAnchor(resumeAtIdx);
    var replayGuardLimit = Math.max(this.history.length + 1000, resumeAtIdx + 1000, 2000);
    var watches = (this.session.watches || []).slice();
    var args = (this.session.args || []).slice();
    this.setStatus(overrides.length ? 'replaying with edits…' : 'replaying from history…');
    // Stop the current session; on debugComplete we'll start a fresh one.
    var self = this;
    // Save the file path/code we need for the new run from the model now,
    // because endSession() will null `session`.
    var path = this.session.debugFilename || (replayAnchor && replayAnchor.file) || ('/tutorial/' + this.t.activeFileName);
    var filename = path.replace(/^\/tutorial\//, '');
    var model = this.t.editorModels[filename] && this.t.editorModels[filename].model;
    var code = model ? model.getValue() : (this.session.debugCode || '');

    // Temporary one-shot completion handler that fires AFTER current debug
    // ends (because of CMD_STOP) and starts the new run.
    var origComplete = this.onDebugComplete;
    this.onDebugComplete = function (msg) {
      // Restore handler
      self.onDebugComplete = origComplete;
      // Build a fresh session that reuses overrides + watches
      var sab = new SharedArrayBuffer(SAB_TOTAL_BYTES);
      self.session = {
        sab: sab,
        i32: new Int32Array(sab),
        u8: new Uint8Array(sab),
        watches: watches,
        args: args,
        debugFilename: path,
        debugCode: code,
        capReached: false,
        pendingStart: { filename: path, code: code },
        // Re-overrides for the new run; cleared once they fire.
        replayOverrides: overrides,
        // After replay, the user's natural next action is whatever they
        // originally clicked (continue/step/next/return).
        autoFollowup: followupCmd,
        replayTargetIdx: resumeAtIdx,
        replayAnchor: replayAnchor,
        replayGuardLimit: replayGuardLimit,
      };
      self.history = [];
      self.historyIdx = -1;
      self.liveIdx = -1;
      self.paused = false;
      self._pendingOverrideKey = null;
      self.outputDuringDebug = '';
      self.outputLines = 0;
      self.disableStepButtons(true);
      self.t._worker.postMessage({ type: 'enableDebugger' });
    };
    this.sendCommand(CMD_STOP);
  };

  DebuggerController.prototype.makeReplayAnchor = function (idx) {
    var snap = this.history[idx];
    if (!snap || !snap.stack || !snap.stack.length) return null;
    var topIdx = snap.stack.length - 1;
    var top = snap.stack[topIdx];
    var selectedIdx = this.selectedFrameIdx >= 0 ? this.selectedFrameIdx : topIdx;
    var selected = snap.stack[selectedIdx] || top;
    return {
      index: idx,
      event: snap.event === 'sync' ? 'line' : snap.event,
      file: snap.file,
      line: snap.line,
      location_hit: snap.location_hit == null ? null : snap.location_hit,
      top: this.frameAnchor(top),
      selected: this.frameAnchor(selected),
      selected_from_top: topIdx - selectedIdx,
    };
  };

  DebuggerController.prototype.frameAnchor = function (frame) {
    if (!frame) return null;
    return {
      file: frame.file,
      function_name: frame.function,
      first_line: frame.first_line,
      line: frame.line,
    };
  };

  DebuggerController.prototype.snapshotMatchesReplayAnchor = function (snap, anchor) {
    if (!snap || !anchor) return false;
    var event = snap.event === 'sync' ? 'line' : snap.event;
    if (event !== anchor.event) return false;
    if (snap.file !== anchor.file || snap.line !== anchor.line) return false;
    if (anchor.location_hit != null && snap.location_hit !== anchor.location_hit) return false;
    var top = snap.stack && snap.stack[snap.stack.length - 1];
    if (!this.frameMatchesAnchor(top, anchor.top, false)) return false;
    return true;
  };

  DebuggerController.prototype.frameMatchesAnchor = function (frame, anchor, includeLine) {
    if (!frame || !anchor) return false;
    if (frame.file !== anchor.file) return false;
    if (frame.function !== anchor.function_name) return false;
    if (frame.first_line !== anchor.first_line) return false;
    if (includeLine && frame.line !== anchor.line) return false;
    return true;
  };

  DebuggerController.prototype.findReplayAnchor = function (startIdx, endIdx, anchor) {
    if (!anchor) return -1;
    for (var i = Math.max(0, startIdx); i <= endIdx; i++) {
      if (this.snapshotMatchesReplayAnchor(this.history[i], anchor)) return i;
    }
    return -1;
  };

  DebuggerController.prototype.restoreReplayFrameSelection = function (anchor) {
    var snap = this.history[this.historyIdx];
    if (!snap || !snap.stack || !snap.stack.length || !anchor) {
      this.selectedFrameIdx = -1;
      return;
    }
    var topIdx = snap.stack.length - 1;
    var byDepth = topIdx - (anchor.selected_from_top || 0);
    if (byDepth >= 0 && byDepth < snap.stack.length &&
        this.frameMatchesAnchor(snap.stack[byDepth], anchor.selected, false)) {
      this.selectedFrameIdx = byDepth;
      return;
    }
    for (var i = snap.stack.length - 1; i >= 0; i--) {
      if (this.frameMatchesAnchor(snap.stack[i], anchor.selected, false)) {
        this.selectedFrameIdx = i;
        return;
      }
    }
    this.selectedFrameIdx = -1;
  };

  // For replays, each `paused` batch may contain several snapshots. Use the
  // original source location as the primary handoff point; numeric history
  // indices are only a fallback because edits can alter the later trace shape.
  DebuggerController.prototype.handlePausedDuringReplay = function (startIdx, endIdx) {
    if (!this.session) return false;
    var target = this.session.replayTargetIdx;
    var fcmd = this.session.autoFollowup;
    var anchor = this.session.replayAnchor;
    if (target == null || fcmd == null) return false;
    var matchedIdx = this.findReplayAnchor(startIdx, endIdx, anchor);
    if (anchor && matchedIdx < 0) {
      var guard = this.session.replayGuardLimit || Math.max(target + 1000, 2000);
      if (this.liveIdx < guard) {
        this.sendCommand(CMD_STEP);
        this.setStatus('replaying to edited line…');
        return true;
      }
      this.session.replayTargetIdx = null;
      this.session.autoFollowup = null;
      this.session.replayAnchor = null;
      this.paused = true;
      this.disableStepButtons(false);
      this.setStatus('replay paused before target; source location changed');
      this.renderAll();
      return true;
    }
    if (!anchor && matchedIdx < 0 && this.liveIdx < target) {
      // Still replaying — auto-continue silently. CMD_CONTINUE keeps running
      // until the next breakpoint or program end. To honor breakpoints during
      // replay would be confusing; since the override already applied, we
      // just resume to the snapshot count target.
      // To avoid skipping the replay target we step instead, which guarantees
      // each user_line is reported.
      this.sendCommand(CMD_STEP);
      this.setStatus('replaying step ' + (this.liveIdx + 1) + '/' + (target + 1) + '…');
      return true;
    }
    if (matchedIdx >= 0) {
      this.historyIdx = matchedIdx;
    } else if (!anchor && fcmd === '__pause' && target >= 0 && target < this.history.length) {
      this.historyIdx = target;
    }
    // We've reached (or passed) the original rewound point — clear replay
    // markers and let the user's followup play out.
    this.session.replayTargetIdx = null;
    this.session.autoFollowup = null;
    this.session.replayAnchor = null;
    this.session.replayGuardLimit = null;
    this.restoreReplayFrameSelection(anchor);
    if (fcmd === '__pause') {
      this.paused = true;
      this.disableStepButtons(false);
      this.setStatus('paused at line ' + this.history[this.historyIdx].line);
      this.renderAll();
      return true;
    }
    this.setStatus('replay complete — applying ' + fcmd);
    var code = fcmd === 'continue' ? CMD_CONTINUE
            : fcmd === 'step'     ? CMD_STEP
            : fcmd === 'next'     ? CMD_NEXT
            : fcmd === 'return'   ? CMD_RETURN
            : CMD_STEP;
    this.sendCommand(code);
    return true;
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
    if (this.session) {
      if (this.queueBreakpointChange(change)) this.refreshBreakpointsNow();
    }
  };

  DebuggerController.prototype.editBreakpointCondition = function (filename, line) {
    var path = '/tutorial/' + filename;
    var bps = this.breakpoints.get(path);
    if (!bps) {
      bps = new Map();
      this.breakpoints.set(path, bps);
    }
    var wasMissing = !bps.has(line);
    if (wasMissing) {
      // Right-click on empty line → create a breakpoint only if the prompt is
      // accepted, so we do not briefly sync an unconditional breakpoint first.
      bps.set(line, { condition: null });
      bps = this.breakpoints.get(path);
    }
    var current = bps.get(line);
    var existing = (current && current.condition) || '';
    var input = window.prompt('Breakpoint condition (Python expression, empty = unconditional):', existing);
    if (input === null) {
      if (wasMissing) {
        bps.delete(line);
        this.refreshBpDecorations();
      }
      return;   // cancelled
    }
    var cond = input.trim() ? input.trim() : null;
    bps.set(line, { condition: cond });
    this.persistBreakpoints();
    this.refreshBpDecorations();
    if (this.session) {
      var change = { op: wasMissing ? 'add' : 'edit', file: path, line: line, condition: cond };
      if (this.queueBreakpointChange(change)) this.refreshBreakpointsNow();
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
          if (line < 1 || line > model.getLineCount()) return;
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

  DebuggerController.prototype.normalizeBreakpointPath = function (file) {
    var path = String(file || '').trim();
    if (!path) return null;
    if (path.indexOf('/tutorial/') === 0) return path;
    if (path.charAt(0) === '/') return '/tutorial' + path;
    return '/tutorial/' + path;
  };

  DebuggerController.prototype.loadConfiguredBreakpoints = function () {
    var configured = this.opts.initial_breakpoints || this.opts.breakpoints || [];
    if (!Array.isArray(configured)) return;
    var self = this;
    configured.forEach(function (bp) {
      var file = bp && (bp.file || bp.path || bp.filename);
      var path = self.normalizeBreakpointPath(file || self.t.activeFileName);
      var line = parseInt(bp && bp.line, 10);
      if (!path || !line || line < 1) return;
      var condition = bp.condition == null ? null : String(bp.condition).trim();
      if (!condition) condition = null;
      var bps = self.breakpoints.get(path);
      if (!bps) { bps = new Map(); self.breakpoints.set(path, bps); }
      bps.set(line, { condition: condition });
    });
  };

  DebuggerController.prototype.collectBreakpointsForRun = function () {
    var self = this;
    var out = [];
    this.breakpoints.forEach(function (bps, path) {
      var fname = path.replace(/^\/tutorial\//, '');
      var model = self.t.editorModels[fname] && self.t.editorModels[fname].model;
      var maxLine = model ? model.getLineCount() : Infinity;
      bps.forEach(function (info, line) {
        if (line < 1 || line > maxLine) return;
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
      else if (msg.type === 'editError') self.onEditError(msg);
      else if (msg.type === 'log') console.log('[ttd]', msg.msg);
      else if (msg.type === 'debuggerError') console.error('[debugger]', msg.message);
    });
  };

  DebuggerController.prototype.onEditError = function (msg) {
    console.warn('[ttd edit]', msg.var, '=', msg.expr, '→', msg.error);
    this.setStatus('edit failed: ' + (msg.error || 'unknown'));
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
      args: this.collectProgramArgs(),
      debugFilename: path,
      debugCode: code,
      capReached: false,
      pendingStart: { filename: path, code: code },
    };
    this.history = [];
    this.historyIdx = -1;
    this.liveIdx = -1;
    this.paused = false;
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

    // Auto-switch to the combined Debug tab (Watch + Call Stack + Variables
    // stacked). Note: we deliberately do NOT collapse the output panel —
    // prints from the user's program go there and need to stay visible during
    // the debug session. Hiding them caused confusion in earlier iterations.
    this.activateTab('dbg-combined');
    this.disableStepButtons(true);
    this.setStatus('starting…');

    // Load/enable the worker extension first. The extension owns debugInit, so
    // on a fresh worker we must wait for debuggerReady before sending it.
    this.t._worker.postMessage({ type: 'enableDebugger' });
  };

  DebuggerController.prototype.onDebuggerReady = function () {
    if (!this.session || !this.session.pendingStart) return;
    var st = this.session.pendingStart;
    this.session.pendingStart = null;
    this.t._worker.postMessage({ type: 'debugInit', sab: this.session.sab });
    this.t._worker.postMessage({
      type: 'runDebug',
      filename: st.filename,
      code: st.code,
      breakpoints: this.collectBreakpointsForRun(),
      watches: this.session.watches,
      args: this.session.args || [],
      options: this.opts,
      // Variable-mutation overrides recorded by the user during a previous
      // rewound state. The worker applies each at its recorded snapshot index.
      overrides: this.session.replayOverrides || [],
    });
    this.setStatus('running…');
  };

  DebuggerController.prototype.sendCommand = function (cmdCode) {
    if (!this.session) return;
    this.paused = false;
    Atomics.store(this.session.i32, SLOT_CMD, cmdCode);
    Atomics.notify(this.session.i32, SLOT_CMD, 1);
    if (this.session.pendingLiveEdits && this.session.pendingLiveEdits.length) {
      this.session.pendingLiveEdits = [];
    }
    if (this.session.pendingBreakpointChanges && this.session.pendingBreakpointChanges.length) {
      this.session.pendingBreakpointChanges = [];
    }
  };

  DebuggerController.prototype.requestSync = function () {
    if (!this.session || !this.paused || this.historyIdx !== this.liveIdx) return;
    this.disableStepButtons(true);
    this.setStatus('applying…');
    this.sendCommand(CMD_SYNC);
  };

  DebuggerController.prototype.refreshWatchesNow = function () {
    if (!this.session) return;
    if (this.historyIdx >= 0 && this.historyIdx < this.liveIdx) {
      this.setStatus('replaying with watches…');
      this.restartFromHistory('__pause');
      return;
    }
    this.requestSync();
  };

  DebuggerController.prototype.refreshBreakpointsNow = function () {
    if (!this.session) return;
    if (this.historyIdx >= 0 && this.historyIdx < this.liveIdx) {
      this.setStatus('replaying with breakpoints…');
      this.restartFromHistory('__pause');
      return;
    }
    if (this.paused) {
      this.disableStepButtons(true);
      this.setStatus('updating breakpoints…');
      this.sendCommand(CMD_SYNC);
    }
  };

  DebuggerController.prototype.queueBreakpointChange = function (change) {
    if (!this.session) return false;
    this.session.pendingBreakpointChanges = this.session.pendingBreakpointChanges || [];
    this.session.pendingBreakpointChanges.push(change);
    var json = JSON.stringify(this.session.pendingBreakpointChanges);
    if (!this.writePayload(BPS_OFF, BPS_REGION_BYTES, SLOT_BPS_LEN, SLOT_BPS_DIRTY, json, 'breakpoints')) {
      this.session.pendingBreakpointChanges.pop();
      return false;
    }
    return true;
  };

  DebuggerController.prototype.collectProgramArgs = function () {
    var argsInp = this.t.root && this.t.root.querySelector('.tvm-args-input');
    if (!argsInp || argsInp.style.display === 'none') return [];
    var raw = (argsInp.value || '').trim();
    if (!raw) return [];
    var matches = raw.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    return matches.map(function (s) { return s.replace(/^"|"$/g, ''); });
  };

  DebuggerController.prototype.queueWatchUpdate = function () {
    if (!this.session) return false;
    var json = JSON.stringify(this.session.watches);
    return this.writePayload(WATCH_OFF, WATCH_REGION_BYTES, SLOT_WATCHES_LEN, SLOT_WATCHES_DIRTY, json, 'watches');
  };

  DebuggerController.prototype.writePayload = function (offset, capacity, lenSlot, dirtySlot, json, label) {
    var bytes = this.encoder.encode(json);
    if (bytes.length > capacity) {
      this.setStatus(label + ' update too large');
      console.warn('[ttd] ' + label + ' payload too large:', bytes.length, '>', capacity);
      return false;
    }
    this.session.u8.fill(0, offset, offset + capacity);
    this.session.u8.set(bytes, offset);
    Atomics.store(this.session.i32, lenSlot, bytes.length);
    Atomics.store(this.session.i32, dirtySlot, 1);
    return true;
  };

  DebuggerController.prototype.onPaused = function (msg) {
    if (!this.session) return;
    var snaps = msg.snapshots || [];
    var startIdx = this.history.length;
    if (msg.replace_last && snaps.length && this.liveIdx >= 0) {
      startIdx = this.liveIdx;
      this.history[this.liveIdx] = snaps[snaps.length - 1];
    } else {
      for (var i = 0; i < snaps.length; i++) this.history.push(snaps[i]);
      this.liveIdx = this.history.length - 1;
    }
    var endIdx = this.liveIdx;
    this.historyIdx = this.liveIdx;
    // If we're in the middle of a replay (post-edit re-execution), let the
    // replay driver decide whether to auto-step further or hand control back.
    if (this.handlePausedDuringReplay(startIdx, endIdx)) return;
    this.selectedFrameIdx = -1;
    this.paused = true;
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
    this.clearCurrentLineDecoration();
    this.session = null;
    this.paused = false;
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
    var html = this._renderSubsection(
      'locals',
      'Locals · ' + this.escape(frame.function),
      this.renderVarTable(snap, frameIdx, 'locals', frame.locals)
    );
    if (frame.globals) {
      html += this._renderSubsection(
        'globals',
        'Globals',
        this.renderVarTable(snap, frameIdx, 'globals', frame.globals)
      );
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
    this._wireSubsectionToggles(view);
  };

  // Sub-sections inside the Variables section (Locals, Globals).
  // Each is independently collapsible and persists its state.
  DebuggerController.prototype._renderSubsection = function (key, label, contentHtml) {
    var collapsed = this._isSubsectionCollapsed(key);
    return '<div class="tvm-debug-subsection' + (collapsed ? ' collapsed' : '') +
           '" data-subsection="' + key + '">' +
           '<div class="tvm-debug-subsection-head">' +
           '<span class="tvm-debug-subsection-chevron">▾</span>' +
           '<span class="tvm-debug-subsection-title">' + label + '</span>' +
           '</div>' +
           '<div class="tvm-debug-subsection-body">' + contentHtml + '</div>' +
           '</div>';
  };

  DebuggerController.prototype._subsectionStorageKey = function (key) {
    return 'tutorial-debug-subsection-' + this.t.tutorialId + '-' + key;
  };
  DebuggerController.prototype._isSubsectionCollapsed = function (key) {
    try { return localStorage.getItem(this._subsectionStorageKey(key)) === 'collapsed'; }
    catch (e) { return false; }
  };
  DebuggerController.prototype._setSubsectionCollapsed = function (key, collapsed) {
    try { localStorage.setItem(this._subsectionStorageKey(key), collapsed ? 'collapsed' : 'expanded'); }
    catch (e) { /* ignore */ }
  };
  DebuggerController.prototype._wireSubsectionToggles = function (view) {
    var self = this;
    var heads = view.querySelectorAll('.tvm-debug-subsection-head');
    for (var i = 0; i < heads.length; i++) {
      (function (head) {
        head.addEventListener('click', function () {
          var sub = head.parentElement;
          if (!sub) return;
          var key = sub.getAttribute('data-subsection');
          var nowCollapsed = !sub.classList.contains('collapsed');
          sub.classList.toggle('collapsed', nowCollapsed);
          self._setSubsectionCollapsed(key, nowCollapsed);
        });
      })(heads[i]);
    }
  };

  DebuggerController.prototype.renderVarTable = function (snap, frameIdx, scope, dict) {
    if (!dict || !Object.keys(dict).length) {
      return '<div class="tvm-debug-empty-row">(no ' + scope + ')</div>';
    }
    var rows = [];
    var seenOids = {};   // alias detection within scope
    var keys = Object.keys(dict).sort();
    var editable = this.isVarScopeEditable(snap, frameIdx, scope);
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
      // editKey identifies (scope, frameIdx, name) so the click handler knows
      // exactly what to mutate. We pass frameIdx separately so call-stack
      // navigation stays correct.
      var editKey = editable ? (scope + '|' + frameIdx + '|' + name) : '';
      rows.push(this.renderVarRow(name, resolved, aliasBadge, 0, editKey));
    }
    return '<div class="tvm-debug-vars">' + rows.join('') + '</div>';
  };

  DebuggerController.prototype.isVarScopeEditable = function (snap, frameIdx, scope) {
    if (!this.session || !snap || !snap.stack) return false;
    if (snap.event !== 'line' && snap.event !== 'sync') return false;
    var frame = snap.stack[frameIdx];
    if (!frame) return false;
    if (scope === 'globals') return frameIdx === snap.stack.length - 1;
    if (scope !== 'locals') return false;
    if (frame.function === '<module>') return true;
    return frameIdx === snap.stack.length - 1;
  };

  DebuggerController.prototype.renderVarRow = function (name, val, aliasBadge, depth, editKey) {
    if (!val) return '';
    var nameHtml = '<span class="tvm-debug-var-name">' + this.escape(name) + '</span>';
    var typeHtml = '<span class="tvm-debug-var-type">' + this.escape(val.type || val.kind) + '</span>';
    // Editable values are top-level (depth 0) primitives or collections in
    // either Locals or Globals. Nested children are not editable in v1
    // (would require expression paths like `foo.bar[2]`). The editKey carries
    // the (scope, name) tuple so the click handler knows what to mutate.
    var editAttr = editKey ? ' data-edit-key="' + this.escape(editKey) + '" title="Click to edit"' : '';
    var valueHtml = '<span class="tvm-debug-var-value' + (editKey ? ' tvm-debug-var-editable' : '') + '"' + editAttr +
                    '>' + this.escape(val.repr || val.preview || '') + '</span>';
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
    // Click-to-edit on values: replaces the span with an input, applies on
    // Enter, cancels on Escape. Live edits go through SAB; rewound edits get
    // recorded as overrides for the next session restart.
    var self = this;
    var editables = view.querySelectorAll('.tvm-debug-var-editable');
    for (var k = 0; k < editables.length; k++) {
      (function (el) {
        el.addEventListener('click', function () {
          self.startInlineEdit(el);
        });
      })(editables[k]);
    }
  };

  DebuggerController.prototype.startInlineEdit = function (valueEl) {
    if (!this.session) return;   // only meaningful during a debug session
    var key = valueEl.getAttribute('data-edit-key');
    if (!key) return;
    var parts = key.split('|');   // scope|frameIdx|name
    var scope = parts[0], frameIdx = +parts[1], name = parts[2];
    var originalText = valueEl.textContent;
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'tvm-debug-var-edit-input';
    input.value = originalText;
    input.setAttribute('spellcheck', 'false');
    valueEl.replaceWith(input);
    input.focus();
    input.select();
    var self = this;
    var done = false;
    function commit() {
      if (done) return; done = true;
      var expr = input.value;
      // Detect "no change" so we don't queue a no-op edit (which would still
      // re-eval and produce the same value, but adds noise to live_edits).
      var unchanged = expr === originalText;
      // Show the user's edit visually: the value span flips to the new text
      // with a "pending" affordance until the next snapshot arrives, at which
      // point renderAll() replaces it with the worker-confirmed value.
      if (!unchanged) {
        valueEl.textContent = expr;
        valueEl.classList.add('tvm-debug-var-edit-pending');
        valueEl.setAttribute('title', 'Applying edit… (was: ' + originalText + ')');
      }
      input.replaceWith(valueEl);
      if (!unchanged) self.applyVarEdit(scope, frameIdx, name, expr);
    }
    function cancel() {
      if (done) return; done = true;
      input.replaceWith(valueEl);
    }
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    });
    input.addEventListener('blur', commit);
  };

  // Apply a variable edit. Two paths:
  //   - LIVE globals/module locals: mutate through SAB and refresh with CMD_SYNC.
  //   - LIVE function locals: Pyodide cannot write optimized fast locals through
  //     frame.f_locals, so record a source-level override and replay to the
  //     current snapshot with the assignment injected before that line.
  //   - REWOUND (historyIdx < liveIdx): record an override pinned to this
  //     snapshot index + frame depth, then immediately replay to that snapshot
  //     so the edit is visible/applied without an extra user step.
  DebuggerController.prototype.applyVarEdit = function (scope, frameIdx, name, expr) {
    if (!this.session) return;
    var snap = this.history[this.historyIdx];
    if (!snap) return;
    if (!this.isVarScopeEditable(snap, frameIdx, scope)) {
      this.setStatus('edit unavailable for this history row/frame');
      this.renderAll();
      return;
    }
    // Convert UI frame index (outer→inner) to Python frame_depth (top=0,
    // counted from innermost). top frame is stack[stack.length-1].
    var topIdx = snap.stack.length - 1;
    var frameDepth = topIdx - frameIdx;
    var frame = snap.stack[frameIdx];
    var sourceLocal = scope === 'locals' && frame && frame.function !== '<module>' && frameIdx === topIdx;
    var override = {
      snapshot_idx: this.historyIdx,
      frame_depth: frameDepth,
      scope: scope,
      var: name,
      expr: expr,
      line: frame && frame.line,
      function: frame && frame.function,
      first_line: frame && frame.first_line,
      hit_count: snap.location_hit || 1,
    };
    if (sourceLocal) {
      override.source = true;
    }
    var rewound = this.historyIdx < this.liveIdx;
    if (rewound) {
      // Record override and immediately replay to the selected historical
      // snapshot. This keeps rewound edits feeling like live edits.
      this.session.pendingOverrides = this.session.pendingOverrides || [];
      this.session.pendingOverrides.push(override);
      this._pendingOverrideKey = scope + '|' + frameIdx + '|' + name;
      this.setStatus('replaying with edit…');
      this.restartFromHistory('__pause');
    } else if (sourceLocal) {
      this.session.pendingOverrides = this.session.pendingOverrides || [];
      this.session.pendingOverrides.push(override);
      this.setStatus('replaying with edit…');
      this.restartFromHistory('__pause');
    } else {
      // Live: queue via SAB. Will be consumed at the next _flush_and_block.
      if (this.queueLiveEdit({
        frame_depth: frameDepth,
        scope: scope,
        var: name,
        expr: expr,
      })) {
        this.requestSync();
      } else {
        this.renderAll();
      }
    }
  };

  DebuggerController.prototype.queueLiveEdit = function (edit) {
    if (!this.session) return false;
    // Append to any prior queued edits in this same flush window. We always
    // overwrite the SAB region with the full pending set.
    this.session.pendingLiveEdits = this.session.pendingLiveEdits || [];
    this.session.pendingLiveEdits.push(edit);
    var json = JSON.stringify(this.session.pendingLiveEdits);
    if (!this.writePayload(EDITS_OFF, EDITS_REGION_BYTES, SLOT_EDITS_LEN, SLOT_EDITS_DIRTY, json, 'edits')) {
      this.session.pendingLiveEdits.pop();
      return false;
    }
    return true;
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
        if (self.queueWatchUpdate()) {
          self._pendingWatches = self.session.watches.slice();
          self.refreshWatchesNow();
        } else {
          self.session.watches.pop();
        }
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
            var removed = self.session.watches.splice(idx, 1);
            if (self.queueWatchUpdate()) {
              self._pendingWatches = self.session.watches.slice();
              self.refreshWatchesNow();
            } else {
              self.session.watches.splice(idx, 0, removed[0]);
            }
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

  // Resolve render targets. Legacy panel keys map into section bodies of
  // the combined view (so renderVariables/renderCallStack/renderWatch/
  // renderHistory keep their existing single-target write pattern).
  DebuggerController.prototype.viewEl = function (panel) {
    var combinedSectionMap = {
      'dbg-vars':    'vars',
      'dbg-stack':   'stack',
      'dbg-watch':   'watch',
      'dbg-history': 'history',
    };
    if (combinedSectionMap[panel]) {
      return this.t.root.querySelector(
        '.tvm-debug-view-dbg-combined .tvm-dbg-section-body[data-section="' +
        combinedSectionMap[panel] + '"]'
      );
    }
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
