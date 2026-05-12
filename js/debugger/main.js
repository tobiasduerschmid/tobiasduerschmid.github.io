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
 *   Int32 [7]  excbps_dirty
 *   Int32 [8]  excbps_len
 *   Uint8 [WATCH_OFF  .. +32K) watches JSON
 *   Uint8 [BPS_OFF    .. +32K) breakpoint changes JSON
 *   Uint8 [EDITS_OFF  .. +32K) live edit JSON
 *   Uint8 [EXCBPS_OFF .. +32K) exception breakpoints JSON
 */

(function () {
  'use strict';

  // ---- SAB layout (must match worker-extension.js) ------------------------
  var SAB_HEADER_BYTES = 64;
  var WATCH_REGION_BYTES = 32 * 1024;
  var BPS_REGION_BYTES = 32 * 1024;
  var EDITS_REGION_BYTES = 32 * 1024;
  var EXCBPS_REGION_BYTES = 32 * 1024;
  var SAB_TOTAL_BYTES = SAB_HEADER_BYTES + WATCH_REGION_BYTES + BPS_REGION_BYTES + EDITS_REGION_BYTES + EXCBPS_REGION_BYTES;
  var WATCH_OFF = SAB_HEADER_BYTES;
  var BPS_OFF = WATCH_OFF + WATCH_REGION_BYTES;
  var EDITS_OFF = BPS_OFF + BPS_REGION_BYTES;
  var EXCBPS_OFF = EDITS_OFF + EDITS_REGION_BYTES;
  var SLOT_CMD = 0;
  var SLOT_WATCHES_DIRTY = 1, SLOT_BPS_DIRTY = 2, SLOT_EDITS_DIRTY = 3;
  var SLOT_WATCHES_LEN = 4, SLOT_BPS_LEN = 5, SLOT_EDITS_LEN = 6;
  var SLOT_EXCBPS_DIRTY = 7, SLOT_EXCBPS_LEN = 8;
  var CMD_CONTINUE = 1, CMD_STEP = 2, CMD_NEXT = 3, CMD_RETURN = 4, CMD_STOP = 5;
  var CMD_SYNC = 6;

  var UNCHANGED = 'UNCHANGED';   // diff sentinel from Python side

  function debugManagerIcon(name) {
    var svg = "<svg class='tvm-debug-manager-svg' xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' aria-hidden='true' focusable='false'>";
    if (name === 'playData') {
      return svg + "<polygon points='5,4 15,12 5,20' fill='currentColor'/>" +
        "<circle cx='17.5' cy='12' r='3.3' fill='none' stroke='currentColor' stroke-width='2.2'/>" +
        "<circle cx='17.5' cy='12' r='1.2' fill='currentColor'/></svg>";
    }
    if (name === 'backData') {
      return svg + "<polygon points='19,4 9,12 19,20' fill='currentColor'/>" +
        "<circle cx='6.5' cy='12' r='3.3' fill='none' stroke='currentColor' stroke-width='2.2'/>" +
        "<circle cx='6.5' cy='12' r='1.2' fill='currentColor'/></svg>";
    }
    if (name === 'plus') {
      return svg + "<path d='M12 5v14M5 12h14' fill='none' stroke='currentColor' stroke-width='2.6' stroke-linecap='round'/></svg>";
    }
    if (name === 'edit') {
      return svg + "<path d='M5 16.5 15.7 5.8a2.1 2.1 0 0 1 3 3L8 19.5H5z' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linejoin='round'/>" +
        "<path d='m14 7.5 2.5 2.5' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round'/></svg>";
    }
    if (name === 'trash') {
      return svg + "<path d='M6 7h12M10 7V5h4v2M8 10l.7 9h6.6L16 10' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/></svg>";
    }
    if (name === 'dataWatch') {
      return svg + "<circle cx='8.5' cy='12' r='4' fill='none' stroke='currentColor' stroke-width='2.2'/>" +
        "<circle cx='8.5' cy='12' r='1.35' fill='currentColor'/>" +
        "<path d='M14 7h5M14 12h5M14 17h5' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round'/></svg>";
    }
    if (name === 'playException') {
      return svg + "<polygon points='5,4 15,12 5,20' fill='currentColor'/>" +
        "<path d='M 18,5.5 L 18,13' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round'/>" +
        "<circle cx='18' cy='17' r='1.4' fill='currentColor'/></svg>";
    }
    if (name === 'backException') {
      return svg + "<polygon points='19,4 9,12 19,20' fill='currentColor'/>" +
        "<path d='M 6,5.5 L 6,13' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round'/>" +
        "<circle cx='6' cy='17' r='1.4' fill='currentColor'/></svg>";
    }
    return '';
  }

  // ---- attach() -----------------------------------------------------------
  function attach(tutorial) {
    if (!window.crossOriginIsolated) {
      // First load on a fresh debugger tutorial — service worker registered
      // but headers don't take effect until reload. Some embedded webviews
      // never grant the isolation headers, so keep the debugger entry points
      // visible and explain the limitation instead of silently hiding them.
      installUnavailableDebuggerUI(tutorial, {
        title: 'Debugger needs browser isolation',
        body: 'This webview has not enabled the browser isolation required by the time-travel debugger yet. Reload this page once; if the message stays here, open the demo in a full browser preview.',
        action: 'Reload to activate debugger'
      });
      return;
    }
    if (!window.SharedArrayBuffer || !window.Atomics) {
      console.warn('[SEBookDebugger] SharedArrayBuffer/Atomics unavailable — debugger disabled');
      installUnavailableDebuggerUI(tutorial, {
        title: 'Debugger unavailable in this webview',
        body: 'This webview does not expose SharedArrayBuffer and Atomics, which the time-travel debugger needs for stepping and rewinding. Open the demo in a full browser preview to use the debugger.',
        action: 'Reload page'
      });
      return;
    }
    if (tutorial._debuggerCtl) return;   // already attached
    tutorial._debuggerCtl = new DebuggerController(tutorial);
    tutorial._debuggerCtl.install();
  }

  function onStepChange(tutorial) {
    if (tutorial._debuggerCtl) tutorial._debuggerCtl.handleStepChange();
  }

  function refreshBreakpoints(tutorial) {
    if (!tutorial._debuggerCtl) return;
    tutorial._debuggerCtl.loadConfiguredBreakpoints();
    tutorial._debuggerCtl.refreshBpDecorations();
    tutorial._debuggerCtl.scheduleBreakpointRefresh();
  }

  function installUnavailableDebuggerUI(tutorial, details) {
    if (!tutorial || tutorial._debuggerUnavailableInstalled) return;
    tutorial._debuggerUnavailableInstalled = true;

    var activateDebugTab = installUnavailableDebuggerTab(tutorial, details);
    installUnavailableDebugButton(tutorial, details, activateDebugTab);
    injectReloadBanner(tutorial, details, activateDebugTab);
  }

  function installUnavailableDebuggerTab(tutorial, details) {
    var instructionsPanel = tutorial.root && tutorial.root.querySelector('.tvm-instructions-panel');
    if (!instructionsPanel) return null;

    var tabBar = instructionsPanel.querySelector('.tvm-left-tab-bar');
    if (!tabBar) {
      tabBar = document.createElement('div');
      tabBar.className = 'tvm-left-tab-bar';

      var stepsTab = document.createElement('button');
      stepsTab.type = 'button';
      stepsTab.className = 'tvm-left-tab active';
      stepsTab.setAttribute('data-panel', 'steps');
      stepsTab.innerHTML = '<i class="fa fa-book-open" aria-hidden="true"></i> Steps';
      tabBar.appendChild(stepsTab);
      instructionsPanel.insertBefore(tabBar, instructionsPanel.firstChild);
    }

    var existing = tabBar.querySelector('.tvm-left-tab[data-panel="dbg-unavailable"], .tvm-left-tab[data-panel="dbg-combined"]');
    if (existing) {
      return function () { existing.click(); };
    }

    var debugTab = document.createElement('button');
    debugTab.type = 'button';
    debugTab.className = 'tvm-left-tab';
    debugTab.setAttribute('data-panel', 'dbg-unavailable');
    debugTab.innerHTML = '<i class="fa fa-bug" aria-hidden="true"></i> Debug';
    tabBar.appendChild(debugTab);

    var view = document.createElement('div');
    view.className = 'tvm-debug-view tvm-debug-view-unavailable';
    view.style.display = 'none';
    view.dataset.panel = 'dbg-unavailable';
    view.setAttribute('role', 'region');
    view.setAttribute('aria-label', 'Debugger availability');

    var box = document.createElement('div');
    box.className = 'tvm-debug-unavailable';
    var title = document.createElement('h2');
    title.textContent = details.title;
    var body = document.createElement('p');
    body.textContent = details.body;
    var reload = document.createElement('button');
    reload.type = 'button';
    reload.className = 'tvm-debug-reload-btn';
    reload.textContent = details.action;
    reload.addEventListener('click', function () { window.location.reload(); });
    box.appendChild(title);
    box.appendChild(body);
    box.appendChild(reload);
    view.appendChild(box);
    instructionsPanel.appendChild(view);

    function activate(panel) {
      var tabs = tabBar.querySelectorAll('.tvm-left-tab');
      for (var i = 0; i < tabs.length; i++) {
        tabs[i].classList.toggle('active', tabs[i].getAttribute('data-panel') === panel);
      }
      var stepsView = instructionsPanel.querySelector('.tvm-steps-view');
      if (stepsView) stepsView.style.display = panel === 'steps' ? 'flex' : 'none';
      var debugViews = instructionsPanel.querySelectorAll('.tvm-debug-view');
      for (var j = 0; j < debugViews.length; j++) {
        debugViews[j].style.display = debugViews[j].dataset.panel === panel ? 'flex' : 'none';
      }
    }

    var stepsTab = tabBar.querySelector('.tvm-left-tab[data-panel="steps"]');
    if (stepsTab && !stepsTab.dataset.dbgUnavailableWired) {
      stepsTab.dataset.dbgUnavailableWired = '1';
      stepsTab.addEventListener('click', function () { activate('steps'); });
    }
    debugTab.addEventListener('click', function () { activate('dbg-unavailable'); });

    var allTabs = tabBar.querySelectorAll('.tvm-left-tab');
    for (var k = 0; k < allTabs.length; k++) {
      if (allTabs[k] !== debugTab && !allTabs[k].dataset.dbgUnavailableHideWired) {
        allTabs[k].dataset.dbgUnavailableHideWired = '1';
        allTabs[k].addEventListener('click', function () {
          debugTab.classList.remove('active');
          view.style.display = 'none';
        });
      }
    }

    return function () { activate('dbg-unavailable'); };
  }

  function installUnavailableDebugButton(tutorial, details, activateDebugTab) {
    var actions = tutorial.root && tutorial.root.querySelector('.tvm-output-actions');
    if (!actions || actions.querySelector('.tvm-debug-btn')) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tvm-debug-btn tvm-debug-btn-unavailable';
    btn.title = details.title;
    btn.innerHTML = '<i class="fa fa-bug" aria-hidden="true"></i> Debug';
    btn.addEventListener('click', function () {
      if (activateDebugTab) activateDebugTab();
    });

    var runBtn = actions.querySelector('.tvm-run-btn');
    if (runBtn) actions.insertBefore(btn, runBtn);
    else actions.appendChild(btn);
  }

  function injectReloadBanner(tutorial, details) {
    // Show a one-time action near the editor toolbar that a reload is needed.
    var hostFinder = function () {
      return tutorial.root && tutorial.root.querySelector('.tvm-output-actions');
    };
    var tries = 0;
    var t = setInterval(function () {
      var host = hostFinder();
      if (host) {
        clearInterval(t);
        if (host.querySelector('.sebook-dbg-reload-note')) return;
        var note = document.createElement('button');
        note.type = 'button';
        note.className = 'sebook-dbg-reload-note';
        note.title = details.title;
        note.textContent = details.action;
        note.addEventListener('click', function () { window.location.reload(); });
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
    this._pendingWatches = [];
    this.watchpoints = [];
    this._nextWatchpointId = 1;
    // Exception Breakpoints: each is {id, enabled, type, mode} where type may be
    // empty (match any) and mode is 'uncaught' or 'all'. Default seed below in
    // loadPersistedExceptionBreakpoints().
    this.exceptionBreakpoints = [];
    this._nextExceptionBpId = 1;

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
    this._editor2WasReadOnly = false;
    this._panelOriginalFlex = '';
  }

  // ---- Lifecycle ------------------------------------------------------------
  DebuggerController.prototype.install = function () {
    this.loadConfiguredBreakpoints();
    this.loadPersistedBreakpoints();
    this.loadPersistedExceptionBreakpoints();
    // Sync bus FIRST so subsequent installation can publish initial state
    // and editors can attach and paint pre-set breakpoints synchronously.
    this._initSync();
    this.installTabs();
    this.installDebugButton();
    // Single attach call replaces the old installGutterClickHandler +
    // installHoverProvider + refreshBpDecorations + scheduleBreakpointRefresh +
    // editor read-only logic. Same call is also used by popped-out editors.
    this._installEditorAttachments();
    // Pick a transport channel based on backend. Pyodide uses a Web Worker +
    // SharedArrayBuffer (legacy in-place code below). BrowserChannel uses
    // acorn instrumentation and also backs WebContainer tutorials because
    // WebContainer's in-browser Node inspector does not reliably service CDP
    // pause/step commands.
    var backend = this.t.config && this.t.config.backend;
    if (backend === 'webcontainer' && window.SEBookBrowserChannel) {
      this.channel = new window.SEBookBrowserChannel(this, this.t);
    } else if (backend === 'webcontainer' && window.SEBookNodeChannel) {
      this.channel = new window.SEBookNodeChannel(this, this.t);
    } else if (backend === 'browser' && window.SEBookBrowserChannel) {
      this.channel = new window.SEBookBrowserChannel(this, this.t);
    } else if (backend === 'v86' && this.t.debuggerKind === 'gdb' && window.SEBookGdbChannel) {
      // C-tutorial GDB/MI channel. The vmIO interface adapts v86's
      // single-byte serial0 listener into the chunk-or-byte API the
      // channel expects; the parser tolerates either shape.
      this.channel = new window.SEBookGdbChannel(this, this._makeV86Io());
    } else if (backend === 'react' && window.SEBookReactChannel) {
      // React-tutorial record-and-replay channel. The iframe posts trace
      // events via window.postMessage; the channel adapts them to
      // onPaused / onDebugComplete.
      this.channel = new window.SEBookReactChannel(this, this.t);
    }
    if (this.channel && typeof this.channel.install === 'function') this.channel.install();
    this.attachWorkerListener();
    // Repaint editor model swaps in main: when the user switches active file,
    // the new file's breakpoints + current-line need to refresh. attach()'s
    // onDidChangeModel handles this for the same editor; the active-file
    // change is published below so the subscriber inside attach() repaints.
    this._publishActiveFile();
  };

  // ===========================================================================
  // Sync bus — single source of truth shared with popped-out windows
  // ===========================================================================

  DebuggerController.prototype._initSync = function () {
    if (!window.DebuggerSync) {
      console.warn('[SEBookDebugger] DebuggerSync not loaded; popouts disabled');
      return;
    }
    var pm = this.t._popoutManager;
    if (!pm || !pm.channel) {
      // Popout manager not ready (no BroadcastChannel). The debugger still
      // works, just without popout sync.
      this.sync = null;
      return;
    }
    var self = this;
    this.sync = new window.DebuggerSync({
      channel: pm.channel,
      sourceId: 'dbg-main-' + Math.random().toString(36).slice(2, 10),
      isAuthority: true,
      initialState: this._buildSyncState(),
    });
    this.sync.onAction(function (action) { self._handleAction(action); });
    this.sync.onHello(function () {
      // A new mirror joined — make sure it gets a fresh full snapshot. The
      // sync bus already replied with state+history; we just refresh in case
      // late-bound state (e.g. activeFile) changed since construction.
      self.sync.replaceState(self._buildSyncState());
    });
  };

  // vmIO adapter used by SEBookGdbChannel. Translates the controller's
  // generic write / onBytes / removeListener API into v86's serial-port
  // primitives. Kept here (not in the channel) so the channel module
  // stays unit-testable without v86 globals.
  DebuggerController.prototype._makeV86Io = function () {
    var t = this.t;
    return {
      write: function (text) {
        if (t.emulator && t.emulator.serial0_send) t.emulator.serial0_send(text);
      },
      onBytes: function (cb) {
        this._cb = cb;
        if (t.emulator && t.emulator.add_listener) {
          t.emulator.add_listener('serial0-output-byte', cb);
        }
      },
      removeListener: function (cb) {
        if (t.emulator && t.emulator.remove_listener) {
          try { t.emulator.remove_listener('serial0-output-byte', cb); } catch (e) { /* ignore */ }
        }
      },
    };
  };

  DebuggerController.prototype._installEditorAttachments = function () {
    if (!window.SEBookDebuggerEditor) {
      console.warn('[SEBookDebugger] SEBookDebuggerEditor not loaded');
      return;
    }
    if (!this.sync) {
      // No sync available: at least install the legacy gutter click handler
      // so the debugger remains usable in a single-window context.
      this.installGutterClickHandler();
      this.installHoverProvider();
      this.refreshBpDecorations();
      this.scheduleBreakpointRefresh();
      return;
    }
    var self = this;
    var helpers = {
      monaco: window.monaco,
      basename: function (p) { return self.basename(p); },
      normalizePath: function (f) { return self.normalizeBreakpointPath(f); },
    };
    if (this.t.editor) {
      this._editorAttach1 = window.SEBookDebuggerEditor.attach(this.t.editor, this.sync, Object.assign({}, helpers, {
        getActiveFile: function () { return self._activeFileForEditor(self.t.editor); },
      }));
    }
    if (this.t.editor2) {
      this._editorAttach2 = window.SEBookDebuggerEditor.attach(this.t.editor2, this.sync, Object.assign({}, helpers, {
        getActiveFile: function () { return self._activeFileForEditor(self.t.editor2); },
      }));
    }
    window.SEBookDebuggerEditor.registerHoverProvider(window.monaco, this.sync, { languages: ['python', 'javascript', 'typescript'] });
    // Repaint when the tutorial's active file changes (Monaco's onDidChangeModel
    // already covers per-editor file swaps; this covers other state changes).
  };

  // Helper for editor-attach `getActiveFile`: returns the filename whose model
  // is currently shown by the given editor instance.
  DebuggerController.prototype._activeFileForEditor = function (editor) {
    if (editor === this.t.editor2) return this.t._rightActiveFile || this.t.activeFileName;
    return this.t._leftActiveFile || this.t.activeFileName;
  };

  // Build the current full sync state from controller fields. Called once on
  // sync init and on hello-snapshot replies.
  DebuggerController.prototype._buildSyncState = function () {
    return {
      tutorialId: this.t.tutorialId,
      backend: this.t.config && this.t.config.backend,
      debuggerEnabled: true,
      activeFile: this.t.activeFileName || null,
      paneForFile: {},
      filesAvailable: this.t.editorModels ? Object.keys(this.t.editorModels) : [],
      breakpoints: this._serializeBreakpoints(),
      watches: this.getNormalWatches(),
      watchpoints: this._serializeWatchpoints(),
      exceptionBreakpoints: this._serializeExceptionBreakpoints(),
      session: this._buildSessionMeta(),
      history: this.history.slice(),
      historyIdx: this.historyIdx,
      liveIdx: this.liveIdx,
      selectedFrameIdx: this.selectedFrameIdx,
      paused: this.paused,
    };
  };

  DebuggerController.prototype._serializeBreakpoints = function () {
    var out = {};
    this.breakpoints.forEach(function (bps, path) {
      if (!bps || !bps.size) return;
      var perFile = {};
      bps.forEach(function (info, line) {
        perFile[line] = {
          condition: info.condition || null,
          condError: info.condError || null,
          hitCount: info.hitCount || null,
        };
      });
      out[path] = perFile;
    });
    return out;
  };

  DebuggerController.prototype._serializeWatchpoints = function () {
    return (this.watchpoints || []).map(function (wp) {
      return {
        id: wp.id,
        expr: wp.expr,
        enabled: wp.enabled !== false,
      };
    });
  };

  DebuggerController.prototype._serializeExceptionBreakpoints = function () {
    return (this.exceptionBreakpoints || []).map(function (eb) {
      return {
        id: eb.id,
        enabled: eb.enabled !== false,
        type: eb.type || '',
        mode: eb.mode === 'all' ? 'all' : 'uncaught',
      };
    });
  };

  DebuggerController.prototype._buildSessionMeta = function () {
    return {
      active: !!this.session,
      capReached: !!(this.session && this.session.capReached),
      status: (this.statusEl && this.statusEl.textContent) || '',
      statusKind: this.session ? (this.paused ? 'paused' : 'running') : 'idle',
      stepButtonsDisabled: this._areStepButtonsDisabled(),
    };
  };

  DebuggerController.prototype._areStepButtonsDisabled = function () {
    if (!this.stepToolbar) return true;
    // Use Continue as a representative non-back/non-stop button.
    var b = this.stepToolbar.querySelector('.tvm-debug-step[data-cmd="continue"]');
    return b ? !!b.disabled : true;
  };

  // ── Publish helpers — call these after mutating internal state. ─────────
  DebuggerController.prototype._publishBreakpoints = function () {
    if (this.sync) this.sync.publish({ breakpoints: this._serializeBreakpoints() });
  };
  DebuggerController.prototype._publishWatches = function () {
    if (this.sync) {
      this.sync.publish({ watches: this.getNormalWatches() });
    }
  };
  DebuggerController.prototype._publishWatchpoints = function () {
    if (this.sync) this.sync.publish({ watchpoints: this._serializeWatchpoints() });
  };
  DebuggerController.prototype._publishExceptionBreakpoints = function () {
    if (this.sync) this.sync.publish({ exceptionBreakpoints: this._serializeExceptionBreakpoints() });
  };
  DebuggerController.prototype._publishSession = function () {
    if (this.sync) this.sync.publish({ session: this._buildSessionMeta() });
  };
  DebuggerController.prototype._publishCursor = function () {
    if (this.sync) {
      this.sync.publish({
        historyIdx: this.historyIdx,
        liveIdx: this.liveIdx,
        selectedFrameIdx: this.selectedFrameIdx,
        paused: this.paused,
      });
    }
  };
  DebuggerController.prototype._publishActiveFile = function () {
    if (this.sync) this.sync.publish({
      activeFile: this.t.activeFileName || null,
      filesAvailable: this.t.editorModels ? Object.keys(this.t.editorModels) : [],
    });
  };
  DebuggerController.prototype._publishHistoryReset = function () {
    if (this.sync) this.sync.replaceState(this._buildSyncState());
  };

  DebuggerController.prototype.getNormalWatches = function () {
    return (this._pendingWatches || []).slice();
  };

  DebuggerController.prototype.getEnabledWatchpoints = function () {
    return (this.watchpoints || []).filter(function (wp) {
      return wp && wp.expr && wp.enabled !== false;
    });
  };

  DebuggerController.prototype.collectBreakpointConditionExpressions = function () {
    var out = [];
    this.breakpoints.forEach(function (bps) {
      bps.forEach(function (info) {
        if (info && info.condition) out.push(info.condition);
      });
    });
    return out;
  };

  DebuggerController.prototype.collectWatchExpressions = function () {
    var out = [];
    var seen = Object.create(null);
    function add(expr) {
      expr = String(expr || '').trim();
      if (!expr || seen[expr]) return;
      seen[expr] = true;
      out.push(expr);
    }
    this.getNormalWatches().forEach(add);
    this.getEnabledWatchpoints().forEach(function (wp) { add(wp.expr); });
    this.collectBreakpointConditionExpressions().forEach(add);
    return out;
  };

  DebuggerController.prototype.updateSessionWatches = function (refresh) {
    if (!this.session) return true;
    var prev = (this.session.watches || []).slice();
    this.session.watches = this.collectWatchExpressions();
    if (!this.queueWatchUpdate()) {
      this.session.watches = prev;
      return false;
    }
    if (refresh) this.refreshWatchesNow();
    return true;
  };

  DebuggerController.prototype.isViewingHistory = function () {
    return this.historyIdx >= 0 && this.historyIdx < this.liveIdx;
  };

  DebuggerController.prototype.addNormalWatch = function (expr, refresh) {
    expr = String(expr || '').trim();
    if (!expr) return false;
    if (refresh == null) refresh = true;
    this._pendingWatches = this._pendingWatches || [];
    this._pendingWatches.push(expr);
    if (!this.updateSessionWatches(refresh)) {
      this._pendingWatches.pop();
      return false;
    }
    this.renderWatch();
    this.renderBreakpointManager();
    this._publishWatches();
    return true;
  };

  DebuggerController.prototype.removeNormalWatch = function (idx, refresh) {
    if (typeof idx !== 'number' || idx < 0) return false;
    if (refresh == null) refresh = true;
    this._pendingWatches = this._pendingWatches || [];
    if (idx >= this._pendingWatches.length) return false;
    var removed = this._pendingWatches.splice(idx, 1)[0];
    if (!this.updateSessionWatches(refresh)) {
      this._pendingWatches.splice(idx, 0, removed);
      return false;
    }
    this.renderWatch();
    this.renderBreakpointManager();
    this._publishWatches();
    return true;
  };

  DebuggerController.prototype.promoteWatchToWatchpoint = function (idx) {
    if (typeof idx !== 'number' || idx < 0) return false;
    var watches = this.getNormalWatches();
    if (idx >= watches.length) return false;
    var expr = watches[idx];
    var refresh = !this.isViewingHistory();
    if (!this.addWatchpoint(expr)) return false;
    return this.removeNormalWatch(idx, refresh);
  };

  DebuggerController.prototype.addWatchpoint = function (expr) {
    expr = String(expr || '').trim();
    if (!expr) return null;
    var existing = null;
    for (var i = 0; i < this.watchpoints.length; i++) {
      if (this.watchpoints[i].expr === expr) {
        existing = this.watchpoints[i];
        break;
      }
    }
    var created = false;
    var prevEnabled = existing ? (existing.enabled !== false) : null;
    if (existing) {
      existing.enabled = true;
    } else {
      existing = { id: 'wp' + (this._nextWatchpointId++), expr: expr, enabled: true };
      this.watchpoints.push(existing);
      created = true;
    }
    var refresh = !this.isViewingHistory();
    if (!this.updateSessionWatches(refresh)) {
      if (created) this.watchpoints.pop();
      else existing.enabled = prevEnabled;
      return null;
    }
    this.renderBreakpointManager();
    this._publishWatchpoints();
    return existing;
  };

  DebuggerController.prototype.removeWatchpoint = function (id) {
    var idx = this.findWatchpointIndex(id);
    if (idx < 0) return false;
    var removed = this.watchpoints.splice(idx, 1)[0];
    var refresh = !this.isViewingHistory();
    if (!this.updateSessionWatches(refresh)) {
      this.watchpoints.splice(idx, 0, removed);
      return false;
    }
    this.renderBreakpointManager();
    this._publishWatchpoints();
    return true;
  };

  DebuggerController.prototype.watchpointRemovePreferenceKey = function () {
    return 'tutorial-debug-watchpoint-remove-choice-' + this.t.tutorialId;
  };

  DebuggerController.prototype.getWatchpointRemovePreference = function () {
    try {
      var choice = localStorage.getItem(this.watchpointRemovePreferenceKey());
      return (choice === 'watch' || choice === 'delete') ? choice : null;
    } catch (e) {
      return null;
    }
  };

  DebuggerController.prototype.setWatchpointRemovePreference = function (choice) {
    try {
      if (choice === 'watch' || choice === 'delete') {
        localStorage.setItem(this.watchpointRemovePreferenceKey(), choice);
      }
    } catch (e) { /* localStorage unavailable */ }
  };

  DebuggerController.prototype.removeWatchpointWithChoice = function (id, choice) {
    var idx = this.findWatchpointIndex(id);
    if (idx < 0) return false;
    var expr = this.watchpoints[idx].expr;
    var shouldAddWatch = choice === 'watch';
    var refresh = !this.isViewingHistory();
    if (shouldAddWatch && this.getNormalWatches().indexOf(expr) === -1) {
      if (!this.addNormalWatch(expr, refresh)) return false;
    }
    return this.removeWatchpoint(id);
  };

  DebuggerController.prototype.requestRemoveWatchpoint = function (id) {
    var idx = this.findWatchpointIndex(id);
    if (idx < 0) return false;
    var pref = this.getWatchpointRemovePreference();
    var self = this;
    if (pref) return this.removeWatchpointWithChoice(id, pref);
    this.showRemoveWatchpointDialog(this.watchpoints[idx]).then(function (result) {
      if (!result || !result.choice) return;
      if (result.remember) self.setWatchpointRemovePreference(result.choice);
      self.removeWatchpointWithChoice(id, result.choice);
    });
    return true;
  };

  DebuggerController.prototype.toggleWatchpoint = function (id) {
    var idx = this.findWatchpointIndex(id);
    if (idx < 0) return false;
    var wp = this.watchpoints[idx];
    var prev = wp.enabled !== false;
    wp.enabled = !prev;
    var refresh = !this.isViewingHistory();
    if (!this.updateSessionWatches(refresh)) {
      wp.enabled = prev;
      return false;
    }
    this.renderBreakpointManager();
    this._publishWatchpoints();
    return true;
  };

  DebuggerController.prototype.findWatchpointIndex = function (id) {
    id = String(id || '');
    for (var i = 0; i < this.watchpoints.length; i++) {
      if (String(this.watchpoints[i].id) === id) return i;
    }
    return -1;
  };

  // ── Exception Breakpoints CRUD ─────────────────────────────────────────
  DebuggerController.prototype.addExceptionBreakpoint = function (params) {
    params = params || {};
    var type = String(params.type || '').trim();
    var mode = params.mode === 'all' ? 'all' : 'uncaught';
    var eb = {
      id: this._nextExceptionBpId++,
      enabled: params.enabled !== false,
      type: type,
      mode: mode,
    };
    this.exceptionBreakpoints.push(eb);
    this.persistExceptionBreakpoints();
    this.renderBreakpointManager();
    this._publishExceptionBreakpoints();
    this._refreshExceptionBpRuntime();
    return eb.id;
  };

  DebuggerController.prototype.findExceptionBreakpointIndex = function (id) {
    id = String(id == null ? '' : id);
    for (var i = 0; i < this.exceptionBreakpoints.length; i++) {
      if (String(this.exceptionBreakpoints[i].id) === id) return i;
    }
    return -1;
  };

  DebuggerController.prototype.removeExceptionBreakpoint = function (id) {
    var idx = this.findExceptionBreakpointIndex(id);
    if (idx < 0) return false;
    this.exceptionBreakpoints.splice(idx, 1);
    this.persistExceptionBreakpoints();
    this.renderBreakpointManager();
    this._publishExceptionBreakpoints();
    this._refreshExceptionBpRuntime();
    return true;
  };

  DebuggerController.prototype.toggleExceptionBreakpoint = function (id) {
    var idx = this.findExceptionBreakpointIndex(id);
    if (idx < 0) return false;
    var eb = this.exceptionBreakpoints[idx];
    eb.enabled = !(eb.enabled !== false);
    this.persistExceptionBreakpoints();
    this.renderBreakpointManager();
    this._publishExceptionBreakpoints();
    this._refreshExceptionBpRuntime();
    return true;
  };

  DebuggerController.prototype.editExceptionBreakpoint = function (id, fields) {
    var idx = this.findExceptionBreakpointIndex(id);
    if (idx < 0) return false;
    var eb = this.exceptionBreakpoints[idx];
    if (fields && Object.prototype.hasOwnProperty.call(fields, 'type')) {
      eb.type = String(fields.type || '').trim();
    }
    if (fields && (fields.mode === 'all' || fields.mode === 'uncaught')) {
      eb.mode = fields.mode;
    }
    this.persistExceptionBreakpoints();
    this.renderBreakpointManager();
    this._publishExceptionBreakpoints();
    this._refreshExceptionBpRuntime();
    return true;
  };

  DebuggerController.prototype.persistExceptionBreakpoints = function () {
    try {
      var payload = this._serializeExceptionBreakpoints();
      localStorage.setItem('tutorial-debug-excbps-' + this.t.tutorialId, JSON.stringify(payload));
    } catch (e) { /* localStorage full or disabled */ }
  };

  DebuggerController.prototype.loadPersistedExceptionBreakpoints = function () {
    var loaded = false;
    try {
      var raw = localStorage.getItem('tutorial-debug-excbps-' + this.t.tutorialId);
      if (raw) {
        var arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length) {
          var maxId = 0;
          var self = this;
          arr.forEach(function (eb) {
            var id = parseInt(eb && eb.id, 10);
            if (!isFinite(id) || id < 1) id = self._nextExceptionBpId++;
            if (id > maxId) maxId = id;
            self.exceptionBreakpoints.push({
              id: id,
              enabled: eb.enabled !== false,
              type: String(eb.type || '').trim(),
              mode: eb.mode === 'all' ? 'all' : 'uncaught',
            });
          });
          if (maxId >= this._nextExceptionBpId) this._nextExceptionBpId = maxId + 1;
          loaded = true;
        }
      }
    } catch (e) { /* ignore */ }
    if (!loaded && !this.exceptionBreakpoints.length) {
      // Default: one entry that pauses on any uncaught exception. Matches the
      // typical Python/Node "stop on uncaught" default.
      this.exceptionBreakpoints.push({
        id: this._nextExceptionBpId++,
        enabled: true,
        type: '',
        mode: 'uncaught',
      });
    }
  };

  // Re-publish exception breakpoint settings to the running runtime so the
  // pause filter updates on the fly. For channel-backed sessions (Node /
  // Browser) we send via the channel; for the Pyodide path we write into
  // the dedicated EXCBPS SAB region and the worker picks it up next pause.
  DebuggerController.prototype._refreshExceptionBpRuntime = function () {
    if (!this.session) return;
    var payload = this._serializeExceptionBreakpoints();
    if (this.channel && typeof this.channel.sendExceptionBreakpoints === 'function') {
      this.channel.sendExceptionBreakpoints(payload);
      this.markRuntimeUpdatePending && this.markRuntimeUpdatePending();
      return;
    }
    var json = JSON.stringify(payload);
    if (this.writePayload(EXCBPS_OFF, EXCBPS_REGION_BYTES, SLOT_EXCBPS_LEN, SLOT_EXCBPS_DIRTY, json, 'exception breakpoints')) {
      this.markRuntimeUpdatePending && this.markRuntimeUpdatePending();
    }
  };

  // Predicate used by both the runtime pause filter (for forward execution)
  // and history navigation (for Run / Run Back to Exception Breakpoint).
  // `snap` should have `event === 'exception'` and an `exception: {type, caught}`.
  DebuggerController.prototype.exceptionMatchesAnyEnabled = function (snap) {
    if (!snap || snap.event !== 'exception' || !snap.exception) return false;
    var enabled = (this.exceptionBreakpoints || []).filter(function (eb) {
      return eb.enabled !== false;
    });
    if (!enabled.length) return false;
    var excType = String(snap.exception.type || '');
    var caught = !!snap.exception.caught;
    for (var i = 0; i < enabled.length; i++) {
      var eb = enabled[i];
      if (eb.type && eb.type !== excType) continue;
      if (eb.mode === 'uncaught' && caught) continue;
      return true;
    }
    return false;
  };

  DebuggerController.prototype._resetExecutionTrace = function (resetOutput) {
    this.history = [];
    this.historyIdx = -1;
    this.liveIdx = -1;
    this.selectedFrameIdx = -1;
    this.paused = false;
    if (resetOutput) {
      this.outputDuringDebug = '';
      this.outputLines = 0;
    }
    this._publishHistoryReset();
  };

  DebuggerController.prototype._appendHistoryToSync = function (snaps, replaceLast, expectedPriorLength) {
    if (!this.sync || !snaps || !snaps.length) return;
    var syncHistory = this.sync.state && this.sync.state.history;
    if (!syncHistory || syncHistory.length !== expectedPriorLength) {
      console.warn('[SEBookDebugger] sync history length mismatch; replacing full debugger state', {
        expected: expectedPriorLength,
        actual: syncHistory ? syncHistory.length : null,
      });
      this._publishHistoryReset();
      return;
    }
    this.sync.appendHistory(snaps, !!replaceLast);
  };

  // ── Action handler — routes popout requests + local dispatches. ─────────
  DebuggerController.prototype._handleAction = function (action) {
    if (!action || !action.type) return;
    var self = this;
    switch (action.type) {
      case 'toggleBreakpoint': {
        var fn = String(action.path || '').replace(/^\/tutorial\//, '');
        if (fn) self.toggleBreakpoint(fn, action.line);
        break;
      }
      case 'editBreakpointCondition': {
        var fn2 = String(action.path || '').replace(/^\/tutorial\//, '');
        if (fn2) self.editBreakpointCondition(fn2, action.line);
        break;
      }
      case 'step': {
        if (action.cmd) self.handleToolbarCmd(action.cmd);
        break;
      }
      case 'setHistoryIdx': {
        if (typeof action.idx === 'number' && action.idx >= 0 && action.idx < self.history.length) {
          self.historyIdx = action.idx;
          self.selectedFrameIdx = -1;
          self.renderAll();
          self._publishCursor();
        }
        break;
      }
      case 'setSelectedFrameIdx': {
        if (typeof action.idx === 'number') {
          self.selectedFrameIdx = action.idx;
          self.renderVariables();
          self.renderCallStack();
          self.renderCurrentLine();
          self._publishCursor();
        }
        break;
      }
      case 'addWatch': {
        var expr = (action.expr || '').trim();
        if (!expr) break;
        self.addNormalWatch(expr);
        break;
      }
      case 'removeWatch': {
        if (typeof action.idx !== 'number') break;
        self.removeNormalWatch(action.idx);
        break;
      }
      case 'promoteWatchToWatchpoint': {
        if (typeof action.idx !== 'number') break;
        self.promoteWatchToWatchpoint(action.idx);
        break;
      }
      case 'addWatchpoint': {
        self.addWatchpoint(action.expr || '');
        break;
      }
      case 'removeWatchpoint': {
        if (action.choice === 'watch' || action.choice === 'delete') {
          if (action.remember) self.setWatchpointRemovePreference(action.choice);
          self.removeWatchpointWithChoice(action.id, action.choice);
          break;
        }
        self.requestRemoveWatchpoint(action.id);
        break;
      }
      case 'toggleWatchpoint': {
        self.toggleWatchpoint(action.id);
        break;
      }
      case 'runBackToWatchpoint': {
        self.runBackToWatchpoint(action.id || null);
        break;
      }
      case 'runToWatchpoint': {
        self.runForwardToWatchpoint(false, action.id || null);
        break;
      }
      case 'removeBreakpoint': {
        var rfn = String(action.path || '').replace(/^\/tutorial\//, '');
        if (rfn && action.line) self.removeBreakpoint(rfn, action.line);
        break;
      }
      case 'addExceptionBreakpoint': {
        self.addExceptionBreakpoint(action || {});
        break;
      }
      case 'removeExceptionBreakpoint': {
        if (action.id != null) self.removeExceptionBreakpoint(action.id);
        break;
      }
      case 'toggleExceptionBreakpoint': {
        if (action.id != null) self.toggleExceptionBreakpoint(action.id);
        break;
      }
      case 'editExceptionBreakpoint': {
        if (action.id != null) {
          var fields = {};
          if (Object.prototype.hasOwnProperty.call(action, 'type')) fields.type = action.type;
          if (action.mode === 'all' || action.mode === 'uncaught') fields.mode = action.mode;
          self.editExceptionBreakpoint(action.id, fields);
        }
        break;
      }
      case 'runToExceptionBreakpoint': {
        self.runForwardToExceptionBreakpoint(action.id || null);
        break;
      }
      case 'runBackToExceptionBreakpoint': {
        self.runBackToExceptionBreakpoint(action.id || null);
        break;
      }
      case 'editVariable': {
        self.applyVarEdit(action.scope, action.frameIdx, action.name, action.expr);
        break;
      }
      case 'startSession': {
        self.startSession();
        break;
      }
      case 'stopSession': {
        self.stopSession();
        break;
      }
      case 'setActiveFile': {
        if (action.filename && self.t.editorModels && self.t.editorModels[action.filename]) {
          if (typeof self.t._setActiveFile === 'function') self.t._setActiveFile(action.filename);
          self._publishActiveFile();
        }
        break;
      }
    }
  };

  // ── Public: open a popout debugger window. ──────────────────────────────
  DebuggerController.prototype.popoutDebugger = function () {
    if (!this.t._popoutManager || !this.t._popoutManager.isAvailable()) {
      console.warn('[SEBookDebugger] popout manager unavailable');
      return null;
    }
    if (!this.sync) {
      console.warn('[SEBookDebugger] sync bus unavailable; cannot pop out');
      return null;
    }
    // Make sure the latest state is in the bus before the popup connects.
    this.sync.replaceState(this._buildSyncState());
    return this.t._popoutManager.detachDebugger();
  };

  DebuggerController.prototype.handleStepChange = function () {
    // Stop any active session, clear history; keep breakpoints.
    if (this.session) this.stopSession();
    this._resetExecutionTrace(true);
    this.loadConfiguredBreakpoints();
    this.renderAll();
    this.refreshBpDecorations();   // breakpoint visuals follow file switches
    this.scheduleBreakpointRefresh();
    this._publishActiveFile();
  };

  DebuggerController.prototype.scheduleBreakpointRefresh = function () {
    var self = this;
    window.setTimeout(function () { self.refreshBpDecorations(); }, 0);
    if (window.requestAnimationFrame) {
      window.requestAnimationFrame(function () { self.refreshBpDecorations(); });
    }
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

  // The combined-view shell. Each section has a clickable header (chevron
  // rotates), a body that hides when the section is collapsed, and a stable
  // `data-section` attribute used by the per-section render methods to find
  // their target.
  // Collapse state persists per-tutorial in localStorage.
  DebuggerController.prototype._buildCombinedViewShell = function () {
    var sections = [
      { key: 'stack',   label: 'Call Stack',  icon: 'fa-layer-group',        empty: 'Start debugging to see the call stack.' },
      { key: 'vars',    label: 'Variables',   icon: 'fa-list',               empty: 'Start debugging to see variables.' },
      { key: 'watch',   label: 'Watch',       icon: 'fa-eye',                empty: 'Start debugging to see watches.' },
      { key: 'breakpoints', label: 'Breakpoints', icon: 'fa-circle-dot',     empty: 'Add breakpoints or data watchpoints.' },
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

    // Pop-out button: opens the debugger view in its own window. Sync bus
    // mirrors all state in real time, so popping out mid-session is safe.
    this.debugPopoutBtn = document.createElement('button');
    this.debugPopoutBtn.className = 'tvm-debug-popout-btn';
    this.debugPopoutBtn.title = 'Open debugger in a separate window';
    this.debugPopoutBtn.innerHTML = '<i class="fa fa-up-right-from-square"></i>';
    this.debugPopoutBtn.style.marginLeft = '4px';
    this.debugPopoutBtn.addEventListener('click', function () { self.popoutDebugger(); });

    // Insert just before the Run button (or at end if not found). Popout
    // button sits adjacent to Debug.
    var runBtn = actions.querySelector('.tvm-run-btn');
    if (runBtn) {
      actions.insertBefore(this.debugBtn, runBtn);
      actions.insertBefore(this.debugPopoutBtn, runBtn);
    } else {
      actions.appendChild(this.debugBtn);
      actions.appendChild(this.debugPopoutBtn);
    }

    // Step toolbar — inserted after Run; hidden until session active.
    this.stepToolbar = document.createElement('div');
    this.stepToolbar.className = 'tvm-debug-toolbar';
    this.stepToolbar.style.display = 'none';
    // Inline SVG glyphs in the canonical VSCode/Chrome DevTools debugger
    // visual language. Use a larger 24x24 viewBox + thicker strokes than
    // before so the shapes read clearly at small render sizes:
    //   continue  ▶ chunky play triangle
    //   stepOver  ⤾ thick arc OVER a prominent dot, arrowhead at end
    //   stepInto  ↓ ▬  fat down-arrow into a horizontal landing line
    //   stepOut   ↑ ▬  fat up-arrow exiting from a horizontal start line
    //   stepBack  ⤿ mirror of stepOver (arrowhead on the left)
    //   stop      ◼ filled square with a slight rounded corner
    var SVG_NS = "xmlns='http://www.w3.org/2000/svg'";

    var svgPlay = "<svg " + SVG_NS + " viewBox='0 0 24 24' aria-hidden='true'>" +
      "<polygon points='5,3 21,12 5,21' fill='currentColor'/></svg>";

    var svgStop = "<svg " + SVG_NS + " viewBox='0 0 24 24' aria-hidden='true'>" +
      "<rect x='4' y='4' width='16' height='16' rx='1.5' fill='currentColor'/></svg>";

    // Step Over: tall arc (peaking near the top) so the curve is unmistakable,
    // landing at a prominent fat arrowhead on the right; the "skipped line"
    // is a fat dot directly under the apex.
    var svgOver = "<svg " + SVG_NS + " viewBox='0 0 24 24' aria-hidden='true'>" +
      "<path d='M 3,16 Q 12,2 20,14' fill='none' stroke='currentColor' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'/>" +
      "<polygon points='20,14 23,9 16,11' fill='currentColor'/>" +
      "<circle cx='12' cy='21' r='2.4' fill='currentColor'/></svg>";

    // Step Into: vertical down-arrow with a horizontal landing bar at the
    // bottom (the "next line you're entering"). Bar + arrow = clear "into".
    var svgInto = "<svg " + SVG_NS + " viewBox='0 0 24 24' aria-hidden='true'>" +
      "<line x1='12' y1='2' x2='12' y2='14' stroke='currentColor' stroke-width='3' stroke-linecap='round'/>" +
      "<polygon points='12,17 6,10 18,10' fill='currentColor'/>" +
      "<rect x='5' y='20' width='14' height='2.5' rx='1' fill='currentColor'/></svg>";

    // Step Out: horizontal start bar at the bottom (the line you're leaving)
    // with a fat up-arrow exiting upward.
    var svgOut = "<svg " + SVG_NS + " viewBox='0 0 24 24' aria-hidden='true'>" +
      "<rect x='5' y='20' width='14' height='2.5' rx='1' fill='currentColor'/>" +
      "<line x1='12' y1='10' x2='12' y2='18' stroke='currentColor' stroke-width='3' stroke-linecap='round'/>" +
      "<polygon points='12,4 6,11 18,11' fill='currentColor'/></svg>";

    // Step Back: mirror of stepOver, arrowhead at left, dot below apex.
    var svgBack = "<svg " + SVG_NS + " viewBox='0 0 24 24' aria-hidden='true'>" +
      "<path d='M 21,16 Q 12,2 4,14' fill='none' stroke='currentColor' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'/>" +
      "<polygon points='4,14 1,9 8,11' fill='currentColor'/>" +
      "<circle cx='12' cy='21' r='2.4' fill='currentColor'/></svg>";

    // Run Back: reverse-time continue. Left-pointing play triangle plus a
    // breakpoint dot means "rewind until a breakpoint, or the first snapshot."
    var svgBackContinue = "<svg " + SVG_NS + " viewBox='0 0 24 24' aria-hidden='true'>" +
      "<polygon points='19,4 7,12 19,20' fill='currentColor'/>" +
      "<circle cx='6' cy='12' r='3' fill='currentColor'/></svg>";

    // Step Back Out: reverse-time step out. The up-arrow says "leave the
    // current frame"; the small left arrow marks that this moves backward
    // through history rather than executing a forward step-out.
    var svgBackOut = "<svg " + SVG_NS + " viewBox='0 0 24 24' aria-hidden='true'>" +
      "<rect x='5' y='20' width='14' height='2.5' rx='1' fill='currentColor'/>" +
      "<line x1='12' y1='10' x2='12' y2='18' stroke='currentColor' stroke-width='3' stroke-linecap='round'/>" +
      "<polygon points='12,4 6,11 18,11' fill='currentColor'/>" +
      "<path d='M 18,7 H 7' fill='none' stroke='currentColor' stroke-width='2.4' stroke-linecap='round'/>" +
      "<polygon points='7,7 12,3.5 12,10.5' fill='currentColor'/></svg>";

    this.stepToolbar.innerHTML =
      '<span class="tvm-debug-status" role="status" aria-live="polite" aria-atomic="true"></span>' +
      '<button class="tvm-debug-step" data-cmd="continue" title="Continue (F5)" aria-label="Continue">' + svgPlay + '</button>' +
      '<button class="tvm-debug-step" data-cmd="next"     title="Step Over (F10)" aria-label="Step Over">' + svgOver + '</button>' +
      '<button class="tvm-debug-step" data-cmd="step"     title="Step Into (F11)" aria-label="Step Into">' + svgInto + '</button>' +
      '<button class="tvm-debug-step" data-cmd="return"   title="Step Out (Shift+F11)" aria-label="Step Out">' + svgOut + '</button>' +
      '<span class="tvm-debug-divider"></span>' +
      '<button class="tvm-debug-step" data-cmd="back"     title="Step Back (Shift+F10)" aria-label="Step Back">' + svgBack + '</button>' +
      '<button class="tvm-debug-step" data-cmd="backContinue" title="Run Back to Breakpoint (Alt+Shift+F5)" aria-label="Run Back to Breakpoint">' + svgBackContinue + '</button>' +
      '<button class="tvm-debug-step" data-cmd="backOut"  title="Step Back Out (Alt+Shift+F10)" aria-label="Step Back Out">' + svgBackOut + '</button>' +
      '<span class="tvm-debug-divider"></span>' +
      '<button class="tvm-debug-step" data-cmd="stop"     title="Stop (Shift+F5)" aria-label="Stop">' + svgStop + '</button>';
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
    this.stepToolbarHome = actions;
    this.stepToolbarHeader = actions.closest && actions.closest('.tvm-output-header');
    this.installResponsiveStepToolbar(actions);

    // Keyboard shortcuts
    document.addEventListener('keydown', function (e) {
      if (!self.session) return;
      if (e.key === 'F5' && !e.shiftKey) { e.preventDefault(); self.handleToolbarCmd('continue'); }
      else if (e.key === 'F5' && e.shiftKey && e.altKey) { e.preventDefault(); self.handleToolbarCmd('backContinue'); }
      else if (e.key === 'F5' && e.shiftKey) { e.preventDefault(); self.handleToolbarCmd('stop'); }
      else if (e.key === 'F10' && !e.shiftKey) { e.preventDefault(); self.handleToolbarCmd('next'); }
      else if (e.key === 'F10' && e.shiftKey && e.altKey) { e.preventDefault(); self.handleToolbarCmd('backOut'); }
      else if (e.key === 'F10' && e.shiftKey) { e.preventDefault(); self.handleToolbarCmd('back'); }
      else if (e.key === 'F11' && !e.shiftKey) { e.preventDefault(); self.handleToolbarCmd('step'); }
      else if (e.key === 'F11' && e.shiftKey) { e.preventDefault(); self.handleToolbarCmd('return'); }
    });
  };

  DebuggerController.prototype.installResponsiveStepToolbar = function (actions) {
    if (!actions || !this.stepToolbar) return;
    var self = this;
    actions.classList.add('tvm-debug-actions');
    var schedule = function () {
      if (self._toolbarLayoutFrame) return;
      var raf = window.requestAnimationFrame || function (fn) { return window.setTimeout(fn, 16); };
      self._toolbarLayoutFrame = raf(function () {
        self._toolbarLayoutFrame = null;
        self.updateResponsiveStepToolbar(actions);
      });
    };
    this._scheduleToolbarLayout = schedule;
    if (window.ResizeObserver) {
      this._toolbarResizeObserver = new ResizeObserver(schedule);
      this._toolbarResizeObserver.observe(actions);
      var header = actions.closest && actions.closest('.tvm-output-header');
      if (header) this._toolbarResizeObserver.observe(header);
    } else {
      window.addEventListener('resize', schedule);
    }
    schedule();
  };

  DebuggerController.prototype.updateResponsiveStepToolbar = function (actions) {
    actions = actions || (this.t.root && this.t.root.querySelector('.tvm-output-actions'));
    if (!actions || !this.stepToolbar) return;
    var toolbar = this.stepToolbar;
    var header = (actions.closest && actions.closest('.tvm-output-header')) || this.stepToolbarHeader;
    if (toolbar.parentNode !== actions) {
      actions.appendChild(toolbar);
    }
    actions.classList.remove('tvm-debug-toolbar-new-row');
    if (header) header.classList.remove('tvm-debug-toolbar-row-host');
    toolbar.classList.remove('tvm-debug-toolbar-new-row');
    if (toolbar.style.display === 'none') return;

    var bounds = header ? header.getBoundingClientRect() : actions.getBoundingClientRect();
    var toolbarBounds = toolbar.getBoundingClientRect();
    var clipped = toolbarBounds.right > bounds.right + 0.5 ||
      toolbarBounds.left < bounds.left - 0.5 ||
      actions.scrollWidth > actions.clientWidth + 1;
    if (clipped) {
      toolbar.classList.add('tvm-debug-toolbar-new-row');
      if (header) {
        header.classList.add('tvm-debug-toolbar-row-host');
        header.appendChild(toolbar);
      } else {
        actions.classList.add('tvm-debug-toolbar-new-row');
      }
    }
  };

  DebuggerController.prototype.handleToolbarCmd = function (cmd) {
    if (!this.session) return;
    if (cmd === 'back') {
      this.stepBack();
      return;
    }
    if (cmd === 'backContinue') {
      this.runBackToBreakpoint();
      return;
    }
    if (cmd === 'backWatch') {
      this.runBackToWatchpoint(null);
      return;
    }
    if (cmd === 'backOut') {
      this.stepBackOut();
      return;
    }
    if (cmd === 'exceptionBack') {
      this.runBackToExceptionBreakpoint();
      return;
    }
    if (cmd === 'exceptionForward') {
      this.runForwardToExceptionBreakpoint();
      return;
    }
    if (cmd === 'stop') {
      this.sendCommand(CMD_STOP);
      this.setStatus('stopping…');
      return;
    }
    if (this.session.runtimeSyncInFlight && this.isForwardDebugCommand(cmd)) {
      this.session.afterRuntimeSync = cmd;
      this.setStatus('applying changes…');
      return;
    }
    // A rewound history row is a different execution cursor. To move forward
    // from there, restart and replay to that snapshot, then issue the command.
    if (this.historyIdx < this.liveIdx) {
      if (cmd === 'watchContinue') {
        this.runForwardToWatchpoint(false, null);
      } else if (cmd === 'continue' && this.hasEnabledWatchpoints()) {
        this.runForwardToWatchpoint(true, null);
      } else {
        this.restartFromHistory(cmd);
      }
      return;
    }
    if (this.needsRuntimeSyncBeforeCommand(cmd)) {
      this.requestRuntimeSync(cmd, 'applying changes…');
      return;
    }
    if (cmd === 'watchContinue') {
      this.runForwardToWatchpoint(false, null);
      return;
    }
    if (cmd === 'continue' && this.hasEnabledWatchpoints()) {
      this.runForwardToWatchpoint(true, null);
      return;
    }
    var code = cmd === 'continue' ? CMD_CONTINUE
            : cmd === 'step'     ? CMD_STEP
            : cmd === 'next'     ? CMD_NEXT
            : cmd === 'return'   ? CMD_RETURN
            : 0;
    if (!code) return;
    if (this.session) {
      this.session.continueThroughRuntimeStops = cmd === 'continue' && !this.hasForwardStopConditions();
    }
    this.sendCommand(code);
    this.setStatus(cmd + '…');
    this.disableStepButtons(true);
  };

  DebuggerController.prototype.isForwardDebugCommand = function (cmd) {
    return cmd === 'continue' || cmd === 'watchContinue' ||
      cmd === 'step' || cmd === 'next' || cmd === 'return';
  };

  DebuggerController.prototype.needsRuntimeSyncBeforeCommand = function (cmd) {
    return !!(this.session &&
      this.isForwardDebugCommand(cmd) &&
      this.session.runtimeUpdatePending &&
      this.paused &&
      this.historyIdx === this.liveIdx);
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
    var pendingWatchpointRun = this.session.pendingWatchpointRun || null;
    var debugPytest = !!this.session.debugPytest;
    var debugPytestArgs = this.session.debugPytestArgs ? this.session.debugPytestArgs.slice() : null;
    this.setStatus(overrides.length ? 'replaying with edits…' : 'replaying from history…');
    // Stop the current session; on debugComplete we'll start a fresh one.
    var self = this;
    // Save the file path/code we need for the new run from the model now,
    // because endSession() will null `session`.
    var path = this.session.debugFilename || (replayAnchor && replayAnchor.file) || ('/tutorial/' + this.t.activeFileName);
    var filename = path.replace(/^\/tutorial\//, '');
    var model = this.t.editorModels[filename] && this.t.editorModels[filename].model;
    var code = model ? model.getValue() : (this.session.debugCode || '');
    var files = this.collectDebugFiles();
    files[path] = code;

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
        debugPytest: debugPytest,
        debugPytestArgs: debugPytestArgs,
        capReached: false,
        pendingStart: {
          filename: path,
          code: code,
          files: files,
          pytest: debugPytest,
          pytestArgs: debugPytestArgs,
        },
        // Re-overrides for the new run, and keep the same list as the durable
        // edit ledger so later replays don't forget earlier variable edits.
        replayOverrides: overrides,
        pendingOverrides: overrides.slice(),
        // After replay, the user's natural next action is whatever they
        // originally clicked (continue/step/next/return).
        autoFollowup: followupCmd,
        replayTargetIdx: resumeAtIdx,
        replayAnchor: replayAnchor,
        replayGuardLimit: replayGuardLimit,
        pendingWatchpointRun: pendingWatchpointRun,
      };
      self._pendingOverrideKey = null;
      // Replay is a fresh execution trace. Reset the shared sync history at
      // the same time as the controller history so editor decorations and
      // popouts do not interpret new replay indices against stale rows.
      self._resetExecutionTrace(true);
      self.disableStepButtons(true);
      self.t._worker.postMessage({ type: 'enableDebugger' });
    };
    // The user has chosen to execute forward from a historical row. Leave the
    // reverse-view presentation immediately; the replay that reconstructs this
    // point is now the active forward execution, even before it reaches the
    // old snapshot location.
    this._resetExecutionTrace(true);
    this.disableStepButtons(true);
    this.renderAll();
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
    var matchedIdx = anchor && this.snapshotMatchesReplayAnchor(this.history[endIdx], anchor)
      ? endIdx
      : -1;
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
      this.selectedFrameIdx = -1;
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
    if (fcmd === '__watchpointContinue') {
      var pendingRun = this.session.pendingWatchpointRun || {};
      this.session.pendingWatchpointRun = null;
      this.beginWatchpointRun(!!pendingRun.includeLineBreakpoints, pendingRun.id || null);
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

  DebuggerController.prototype.stepBackOut = function () {
    if (this.historyIdx <= 0) return;
    var current = this.history[this.historyIdx];
    if (!current || !current.stack || current.stack.length <= 1) {
      this.setStatus('already at outermost frame');
      return;
    }
    var currentDepth = current.stack.length;
    var callerIdx = currentDepth - 2;
    var caller = current.stack[callerIdx];
    var target = -1;
    for (var i = this.historyIdx - 1; i >= 0; i--) {
      var snap = this.history[i];
      if (!snap || !snap.stack || snap.stack.length >= currentDepth) continue;
      if (snap.stack.length <= callerIdx) continue;
      if (!this.sameHistoryFrame(snap.stack[callerIdx], caller)) continue;
      target = i;
      break;
    }
    if (target < 0) {
      this.setStatus('no earlier caller frame in history');
      return;
    }
    this.historyIdx = target;
    this.selectedFrameIdx = -1;
    if (this.session) {
      this.session.preserveReverseCursorOnNextPause = target;
    }
    this.renderAll();
    this.setStatus('rewound out: step ' + (target + 1) + '/' + this.history.length);
  };

  DebuggerController.prototype.runBackToBreakpoint = function () {
    if (this.historyIdx <= 0) {
      this.setStatus('already at first instruction');
      return;
    }
    var current = this.history[this.historyIdx];
    var movedOffCurrentLocation = !current;
    var target = 0;
    var hitBreakpoint = false;
    for (var i = this.historyIdx - 1; i >= 0; i--) {
      var snap = this.history[i];
      if (!movedOffCurrentLocation) {
        if (this.sameHistoryLocation(snap, current)) continue;
        movedOffCurrentLocation = true;
      }
      if (this.snapshotHasBreakpoint(snap)) {
        target = i;
        hitBreakpoint = true;
        break;
      }
    }
    this.historyIdx = target;
    this.selectedFrameIdx = -1;
    if (this.session) {
      this.session.preserveReverseCursorOnNextPause = target;
    }
    this.renderAll();
    var snap = this.history[target];
    if (hitBreakpoint && snap) {
      this.setStatus('rewound to breakpoint at ' + this.basename(snap.file) + ':' + snap.line);
    } else {
      this.setStatus('rewound to first instruction');
    }
  };

  // ── Exception Breakpoints (navigate through recorded exception events) ──
  // Forward and backward navigation through `event === 'exception'` snapshots
  // that match an enabled Exception Breakpoint (type filter + uncaught/all
  // mode). The Python tracer records an exception event at each stack level
  // as the exception propagates, so the FIRST snapshot in a run of exception
  // events corresponds to the throw site — that's what we jump to. Later
  // snapshots in the same run are the propagation up the stack.
  DebuggerController.prototype._exceptionBreakpointMatcher = function (id) {
    var self = this;
    if (id == null || id === '') {
      return function (snap) { return self.exceptionMatchesAnyEnabled(snap); };
    }
    var idx = self.findExceptionBreakpointIndex(id);
    if (idx < 0) {
      return function () { return false; };
    }
    var eb = self.exceptionBreakpoints[idx];
    return function (snap) {
      if (!snap || snap.event !== 'exception' || !snap.exception) return false;
      if (eb.enabled === false) return false;
      if (eb.type && eb.type !== String(snap.exception.type || '')) return false;
      if (eb.mode === 'uncaught' && snap.exception.caught) return false;
      return true;
    };
  };

  DebuggerController.prototype._isExceptionThrowSnapshotFor = function (idx, matchFn) {
    var snap = this.history[idx];
    if (!snap || snap.event !== 'exception') return false;
    if (!matchFn(snap)) return false;
    var prev = idx > 0 ? this.history[idx - 1] : null;
    if (!prev || prev.event !== 'exception') return true;
    return false;
  };

  DebuggerController.prototype.runBackToExceptionBreakpoint = function (id) {
    if (this.historyIdx <= 0) {
      this.setStatus('already at first instruction');
      return;
    }
    var match = this._exceptionBreakpointMatcher(id);
    var target = -1;
    for (var i = this.historyIdx - 1; i >= 0; i--) {
      if (this._isExceptionThrowSnapshotFor(i, match)) { target = i; break; }
    }
    if (target < 0) {
      this.setStatus('no earlier matching exception in history');
      return;
    }
    this.historyIdx = target;
    this.selectedFrameIdx = -1;
    if (this.session) {
      this.session.preserveReverseCursorOnNextPause = target;
    }
    this.renderAll();
    var snap = this.history[target];
    var label = snap && snap.exception ? (snap.exception.type + ': ' + snap.exception.message) : 'throw';
    this.setStatus('rewound to ' + label + ' at ' + this.basename(snap.file) + ':' + snap.line);
  };

  DebuggerController.prototype.runForwardToExceptionBreakpoint = function (id) {
    var n = this.history.length;
    var match = this._exceptionBreakpointMatcher(id);
    if (this.historyIdx + 1 >= n) {
      if (this.session && this.historyIdx === this.liveIdx) {
        this.handleToolbarCmd('continue');
        return;
      }
      this.setStatus('no later matching exception in history');
      return;
    }
    var target = -1;
    for (var i = this.historyIdx + 1; i < n; i++) {
      if (this._isExceptionThrowSnapshotFor(i, match)) { target = i; break; }
    }
    if (target < 0) {
      if (this.session && this.historyIdx === this.liveIdx) {
        this.handleToolbarCmd('continue');
        return;
      }
      this.setStatus('no later matching exception in history');
      return;
    }
    this.historyIdx = target;
    this.selectedFrameIdx = -1;
    if (this.session) {
      this.session.preserveReverseCursorOnNextPause = target;
    }
    this.renderAll();
    var snap = this.history[target];
    var label = snap && snap.exception ? (snap.exception.type + ': ' + snap.exception.message) : 'throw';
    this.setStatus('jumped to ' + label + ' at ' + this.basename(snap.file) + ':' + snap.line);
  };

  DebuggerController.prototype.hasEnabledWatchpoints = function () {
    return this.getEnabledWatchpoints().length > 0;
  };

  DebuggerController.prototype.hasCodeBreakpoints = function () {
    var found = false;
    this.breakpoints.forEach(function (bps) {
      if (bps && bps.size) found = true;
    });
    return found;
  };

  DebuggerController.prototype.hasEnabledExceptionBreakpoints = function () {
    return (this.exceptionBreakpoints || []).some(function (eb) {
      return eb && eb.enabled !== false;
    });
  };

  DebuggerController.prototype.hasForwardStopConditions = function () {
    return this.hasEnabledWatchpoints() || this.hasCodeBreakpoints() ||
      this.hasEnabledExceptionBreakpoints();
  };

  DebuggerController.prototype.runBackToWatchpoint = function (id) {
    if (this.historyIdx <= 0) {
      this.setStatus('already at first instruction');
      return;
    }
    var watchpoints = this.watchpointsForRun(id);
    if (!watchpoints.length) {
      this.setStatus('no data watchpoints enabled');
      return;
    }
    var target = 0;
    var hit = null;
    for (var i = this.historyIdx - 1; i >= 0; i--) {
      hit = this.watchpointHitAt(i, watchpoints);
      if (hit) {
        target = i;
        break;
      }
    }
    this.historyIdx = target;
    if (hit) this.applyWatchpointOrigin(hit);
    this.selectedFrameIdx = -1;
    if (this.session) {
      this.session.preserveReverseCursorOnNextPause = target;
    }
    this.renderAll();
    if (hit) {
      var origin = hit.origin || {};
      this.setStatus('rewound to data change at ' + this.basename(origin.file) + ':' + origin.line + ': ' + hit.expr);
    } else {
      this.setStatus('rewound to first instruction');
    }
  };

  DebuggerController.prototype.runForwardToWatchpoint = function (includeLineBreakpoints, id) {
    if (!this.session) return;
    var watchpoints = this.watchpointsForRun(id);
    var canStopOnLineBreakpoint = !!includeLineBreakpoints && this.hasCodeBreakpoints();
    if (!watchpoints.length && !canStopOnLineBreakpoint) {
      this.setStatus('no data watchpoints enabled');
      return;
    }
    if (this.historyIdx < this.liveIdx) {
      var existing = this.findForwardPauseTarget(this.historyIdx + 1, this.liveIdx, includeLineBreakpoints, watchpoints);
      if (existing) {
        this.pauseAtForwardTarget(existing);
        return;
      }
      this.session.pendingWatchpointRun = {
        includeLineBreakpoints: !!includeLineBreakpoints,
        id: id || null,
      };
      this.restartFromHistory('__watchpointContinue');
      return;
    }
    this.beginWatchpointRun(includeLineBreakpoints, id);
  };

  DebuggerController.prototype.beginWatchpointRun = function (includeLineBreakpoints, id) {
    if (!this.session) return;
    var watchpoints = this.watchpointsForRun(id);
    var canStopOnLineBreakpoint = !!includeLineBreakpoints && this.hasCodeBreakpoints();
    if (!watchpoints.length && !canStopOnLineBreakpoint) {
      this.setStatus('no data watchpoints enabled');
      return;
    }
    this.session.watchpointRun = {
      includeLineBreakpoints: !!includeLineBreakpoints,
      id: id || null,
      startIdx: this.historyIdx,
    };
    this.disableStepButtons(true);
    this.setStatus(this.watchpointRunStatus(this.session.watchpointRun));
    this.sendCommand(CMD_STEP);
  };

  DebuggerController.prototype.watchpointRunStatus = function (run) {
    if (run && run.includeLineBreakpoints && !this.watchpointsForRun(run.id || null).length) {
      return 'running to breakpoint…';
    }
    return 'running to data change…';
  };

  DebuggerController.prototype.handlePausedDuringWatchpointRun = function (startIdx, endIdx) {
    if (!this.session || !this.session.watchpointRun) return false;
    var run = this.session.watchpointRun;
    var watchpoints = this.watchpointsForRun(run.id || null);
    var hit = this.findForwardPauseTarget(startIdx, endIdx, run.includeLineBreakpoints, watchpoints);
    if (hit) {
      this.session.watchpointRun = null;
      this.pauseAtForwardTarget(hit);
      return true;
    }
    this.sendCommand(CMD_STEP);
    this.setStatus(this.watchpointRunStatus(run));
    return true;
  };

  DebuggerController.prototype.pauseAtForwardTarget = function (hit) {
    if (!hit) return;
    if (hit.kind === 'watchpoint') this.applyWatchpointOrigin(hit);
    this.historyIdx = hit.idx;
    this.selectedFrameIdx = -1;
    this.paused = true;
    this.disableStepButtons(false);
    this.renderAll();
    if (hit.kind === 'breakpoint') {
      var snap = this.history[hit.idx];
      this.setStatus('paused at breakpoint at ' + this.basename(snap.file) + ':' + snap.line);
    } else {
      var origin = hit.origin || {};
      this.setStatus('data watchpoint changed at ' + this.basename(origin.file) + ':' + origin.line + ': ' + hit.expr);
    }
    this._publishCursor();
    this._publishSession();
  };

  DebuggerController.prototype.findForwardPauseTarget = function (fromIdx, toIdx, includeLineBreakpoints, watchpoints) {
    var end = Math.min(toIdx, this.history.length - 1);
    for (var i = Math.max(0, fromIdx); i <= end; i++) {
      var watchHit = this.watchpointHitAt(i, watchpoints);
      if (watchHit) return {
        kind: 'watchpoint',
        idx: i,
        expr: watchHit.expr,
        id: watchHit.id,
        origin: watchHit.origin,
      };
      if (includeLineBreakpoints && this.snapshotBreakpointMatch(this.history[i])) {
        return { kind: 'breakpoint', idx: i };
      }
    }
    return null;
  };

  DebuggerController.prototype.watchpointsForRun = function (id) {
    var enabled = this.getEnabledWatchpoints();
    if (!id) return enabled;
    id = String(id);
    return enabled.filter(function (wp) { return String(wp.id) === id; });
  };

  DebuggerController.prototype.watchpointHitAt = function (idx, watchpoints) {
    watchpoints = watchpoints || this.getEnabledWatchpoints();
    for (var i = 0; i < watchpoints.length; i++) {
      var wp = watchpoints[i];
      var origin = this.watchpointOriginForHit(idx);
      if (this.watchpointChangedAt(idx, wp, origin)) {
        return {
          id: wp.id,
          expr: wp.expr,
          watchpoint: wp,
          origin: origin,
        };
      }
    }
    return null;
  };

  DebuggerController.prototype.watchpointOriginForHit = function (idx) {
    var cur = this.history[idx];
    var source = idx > 0 ? this.history[idx - 1] : this.history[idx];
    if (!source) return null;
    var curFrame = cur && cur.stack && cur.stack.length ? cur.stack[cur.stack.length - 1] : null;
    var frame = null;
    if (curFrame && curFrame.call_id != null && source.stack && source.stack.length) {
      for (var i = source.stack.length - 1; i >= 0; i--) {
        if (source.stack[i] && source.stack[i].call_id === curFrame.call_id) {
          frame = source.stack[i];
          break;
        }
      }
    }
    if (!frame) frame = source.stack && source.stack.length ? source.stack[source.stack.length - 1] : null;
    return {
      file: (frame && frame.file) || source.file,
      line: (frame && frame.line) || source.line,
      function: frame && frame.function,
      call_id: frame && frame.call_id,
    };
  };

  DebuggerController.prototype.applyWatchpointOrigin = function (hit) {
    if (!hit || hit.idx == null || !hit.origin) return;
    var snap = this.history[hit.idx];
    if (!snap) return;
    snap.watchpoint_origin = hit.origin;
    if (this.sync) this._publishHistoryReset();
  };

  DebuggerController.prototype.displayFrameForSnapshot = function (snap, frameIdx) {
    if (!snap || !snap.stack) return null;
    var frame = snap.stack[frameIdx];
    if (!frame) return null;
    var topIdx = snap.stack.length - 1;
    if (frameIdx === topIdx && snap.watchpoint_origin) {
      return Object.assign({}, frame, {
        file: snap.watchpoint_origin.file || frame.file,
        line: snap.watchpoint_origin.line || frame.line,
      });
    }
    return frame;
  };

  DebuggerController.prototype.displayLocationForSnapshot = function (snap) {
    if (!snap) return null;
    var origin = snap.watchpoint_origin;
    return {
      file: (origin && origin.file) || snap.file,
      line: (origin && origin.line) || snap.line,
    };
  };

  DebuggerController.prototype.watchpointChangedAt = function (idx, wp, origin) {
    if (!wp || !wp.expr || idx < 0 || idx >= this.history.length) return false;
    if (idx <= 0) return false;
    var curRaw = this.watchValueAt(idx, wp.expr);
    var cur = this.watchValueComparable(curRaw);
    if (!cur || cur.state !== 'value') return false;
    var prev = this.previousWatchValueComparable(idx, wp.expr);
    if (!prev) return this.watchpointFirstObservationChangedAt(wp.expr, curRaw, origin);
    return cur.key !== prev.key;
  };

  DebuggerController.prototype.watchpointFirstObservationChangedAt = function (expr, value, origin) {
    return this.watchValueTruthy(value) &&
      this.watchpointOriginWritesExpression(expr, origin);
  };

  DebuggerController.prototype.watchpointOriginWritesExpression = function (expr, origin) {
    if (!origin || !origin.file || !origin.line) return false;
    var line = this.sourceLineForDebuggerFile(origin.file, origin.line);
    if (!line) return false;
    return this.sourceLineAssignsWatchExpression(line, expr);
  };

  DebuggerController.prototype.sourceLineForDebuggerFile = function (file, line) {
    var fname = String(file || '').replace(/^\/tutorial\//, '');
    var model = this.t.editorModels && this.t.editorModels[fname] && this.t.editorModels[fname].model;
    if (!model || line < 1 || line > model.getLineCount()) return '';
    return model.getLineContent(line) || '';
  };

  DebuggerController.prototype.sourceLineAssignsWatchExpression = function (line, expr) {
    expr = String(expr || '').trim();
    var stripped = String(line || '').replace(/#.*$/, '').trim();
    if (!stripped) return false;
    var assigned = this.assignedWatchTargetsFromLine(stripped);
    if (!assigned.length) return false;
    if (/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(expr)) {
      for (var a = 0; a < assigned.length; a++) {
        if (assigned[a] === expr) return true;
      }
    }
    var refs = this.watchExpressionIdentifierSet(expr);
    for (var i = 0; i < assigned.length; i++) {
      var name = assigned[i];
      var base = name.split('.')[0];
      if (refs[name] || refs[base]) return true;
    }
    return false;
  };

  DebuggerController.prototype.assignedWatchTargetsFromLine = function (stripped) {
    var eq = this.assignmentEqualsIndex(stripped);
    if (eq < 0) return [];
    var opStart = eq;
    while (opStart > 0 && /[+\-*\/%&|^<>]/.test(stripped.charAt(opStart - 1))) opStart--;
    var lhs = stripped.slice(0, opStart).trim()
      .replace(/^(?:let|const|var)\s+/, '')
      .replace(/^\s*\((.*)\)\s*$/, '$1')
      .trim();
    if (!lhs || lhs.indexOf('(') !== -1) return [];
    var parts = lhs.split(',');
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i].trim();
      if (/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(part)) out.push(part);
    }
    return out;
  };

  DebuggerController.prototype.watchExpressionIdentifierSet = function (expr) {
    var out = Object.create(null);
    var keywords = {
      'True': true, 'False': true, 'None': true,
      'true': true, 'false': true, 'null': true, 'undefined': true,
    };
    String(expr || '').replace(/[A-Za-z_$][\w$]*/g, function (name, offset, full) {
      if (offset > 0 && full.charAt(offset - 1) === '.') return name;
      if (!keywords[name]) out[name] = true;
      return name;
    });
    return out;
  };

  DebuggerController.prototype.assignmentEqualsIndex = function (line) {
    for (var i = 0; i < line.length; i++) {
      if (line.charAt(i) !== '=') continue;
      var prev = i > 0 ? line.charAt(i - 1) : '';
      var next = i + 1 < line.length ? line.charAt(i + 1) : '';
      if (next === '=' || next === '>' || prev === '=' || prev === '!' ||
          prev === '<' || prev === '>') {
        continue;
      }
      return i;
    }
    return -1;
  };

  DebuggerController.prototype.watchValueAt = function (idx, expr) {
    var snap = this.history[idx];
    return snap && snap.watches ? snap.watches[expr] : null;
  };

  DebuggerController.prototype.watchValueComparable = function (value) {
    if (!value) return null;
    if (value.error) return { state: 'error', key: String(value.error) };
    return { state: 'value', key: this.stableValueKey(value) };
  };

  DebuggerController.prototype.previousWatchValueComparable = function (idx, expr) {
    for (var i = idx - 1; i >= 0; i--) {
      var prev = this.watchValueComparable(this.watchValueAt(i, expr));
      if (prev && prev.state === 'value') return prev;
    }
    return null;
  };

  DebuggerController.prototype.stableValueKey = function (value) {
    if (value == null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) {
      return '[' + value.map(this.stableValueKey, this).join(',') + ']';
    }
    var keys = Object.keys(value).sort();
    var parts = [];
    for (var i = 0; i < keys.length; i++) {
      parts.push(JSON.stringify(keys[i]) + ':' + this.stableValueKey(value[keys[i]]));
    }
    return '{' + parts.join(',') + '}';
  };

  DebuggerController.prototype.watchValueTruthy = function (value) {
    if (!value || value.error) return false;
    var repr = String(value.repr != null ? value.repr : (value.preview != null ? value.preview : '')).trim();
    var type = String(value.type || value.kind || '').toLowerCase();
    if (!repr) return false;
    if (type === 'bool' || type === 'boolean') return repr === 'True' || repr === 'true';
    if (type === 'int' || type === 'float' || type === 'number' || type === 'bigint') {
      var n = Number(repr.replace(/n$/, ''));
      return !!n && !isNaN(n);
    }
    if (type === 'str' || type === 'string') return repr !== "''" && repr !== '""';
    return !/^(False|false|None|null|undefined|0|0\.0|NaN|nan)$/.test(repr);
  };

  DebuggerController.prototype.snapshotBreakpointMatch = function (snap) {
    if (!snap || !snap.file || !snap.line) return false;
    var bps = this.breakpoints.get(snap.file);
    if (!bps) {
      var fname = String(snap.file).replace(/^\/tutorial\//, '');
      bps = this.breakpoints.get('/tutorial/' + fname);
    }
    if (!bps || !bps.has(snap.line)) return false;
    var info = bps.get(snap.line) || {};
    if (!info.condition) return true;
    var val = snap.watches && snap.watches[info.condition];
    if (val && val.error) {
      info.condError = val.error;
      this.refreshBpDecorations();
      this._publishBreakpoints();
      return true;
    }
    return this.watchValueTruthy(val);
  };

  DebuggerController.prototype.snapshotHasBreakpoint = function (snap) {
    if (!snap || !snap.file || !snap.line) return false;
    var bps = this.breakpoints.get(snap.file);
    if (!bps) {
      var fname = String(snap.file).replace(/^\/tutorial\//, '');
      bps = this.breakpoints.get('/tutorial/' + fname);
    }
    return !!(bps && bps.has(snap.line));
  };

  DebuggerController.prototype.sameHistoryLocation = function (a, b) {
    if (!a || !b) return false;
    return this.normalizeBreakpointPath(a.file) === this.normalizeBreakpointPath(b.file) &&
      a.line === b.line;
  };

  DebuggerController.prototype.sameHistoryFrame = function (a, b) {
    if (!a || !b) return false;
    if (a.call_id != null && b.call_id != null) return a.call_id === b.call_id;
    return a.file === b.file &&
      a.function === b.function &&
      a.first_line === b.first_line;
  };

  DebuggerController.prototype.disableStepButtons = function (disabled) {
    if (!this.stepToolbar) return;
    var btns = this.stepToolbar.querySelectorAll('.tvm-debug-step');
    for (var i = 0; i < btns.length; i++) {
      var cmd = btns[i].getAttribute('data-cmd');
      // Step Back & Stop are always available (back is UI-only; stop must work mid-block).
      if (cmd === 'back' || cmd === 'backContinue' || cmd === 'backWatch' || cmd === 'backOut' ||
          cmd === 'exceptionBack' || cmd === 'exceptionForward' || cmd === 'stop') continue;
      btns[i].disabled = disabled;
    }
    this._publishSession();
  };

  DebuggerController.prototype.setStatus = function (text) {
    if (this.statusEl) {
      this.statusEl.textContent = text || '';
      this.statusEl.title = text || '';
    }
    if (this._scheduleToolbarLayout) this._scheduleToolbarLayout();
    this._publishSession();
  };

  // ===========================================================================
  // Breakpoint gutter (inline manager — no third-party lib)
  // ===========================================================================
  DebuggerController.prototype.installGutterClickHandler = function () {
    var self = this;
    var debuggerEditor = window.SEBookDebuggerEditor || {};
    var breakpointMouseHit = debuggerEditor.breakpointMouseHit;
    var clearBreakpointPreview = debuggerEditor.clearBreakpointPreview;
    var installBreakpointHoverPreview = debuggerEditor.installBreakpointHoverPreview;
    var stopBreakpointMouseEvent = function (e) {
      var mouseEvent = (e && e.event) || e || {};
      var browserEvent = mouseEvent.browserEvent || null;
      if (mouseEvent.preventDefault) mouseEvent.preventDefault();
      if (mouseEvent.stopPropagation) mouseEvent.stopPropagation();
      if (browserEvent && browserEvent !== mouseEvent) {
        if (browserEvent.preventDefault) browserEvent.preventDefault();
        if (browserEvent.stopPropagation) browserEvent.stopPropagation();
      }
    };
    var hookEditor = function (editor) {
      if (!editor) return;
      var handleBreakpointMouseDown = function (e) {
        var hit = breakpointMouseHit ? breakpointMouseHit(editor, e) : null;
        if (!hit && !breakpointMouseHit &&
            e.target && e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
          var fallbackLine = e.target.position && e.target.position.lineNumber;
          if (fallbackLine) {
            hit = { line: fallbackLine, rightButton: !!(e.event && e.event.rightButton) };
          }
        }
        if (!hit) return;
        var filename = self.activeFileForEditor(editor);
        if (!filename) return;
        stopBreakpointMouseEvent(e);
        if (clearBreakpointPreview) clearBreakpointPreview(editor);
        if (hit.rightButton) {
          self.editBreakpointCondition(filename, hit.line);
        } else {
          self.toggleBreakpoint(filename, hit.line);
        }
      };
      var dom = editor.getDomNode && editor.getDomNode();
      if (dom) dom.addEventListener('mousedown', handleBreakpointMouseDown, true);
      editor.onMouseDown(handleBreakpointMouseDown);
      if (installBreakpointHoverPreview) {
        installBreakpointHoverPreview(editor, {
          monaco: monaco,
          shouldShow: function (line) {
            var model = editor.getModel(); if (!model) return false;
            line = self.normalizeBreakpointLine(line);
            if (!line || line > model.getLineCount()) return false;
            var filename = self.activeFileForEditor(editor);
            var path = self.normalizeBreakpointPath(filename);
            if (!path) return false;
            var bps = self.breakpoints.get(path);
            if (bps && bps.has(line)) return false;
            var curSnap = (self.historyIdx >= 0 && self.history[self.historyIdx]) || null;
            var curFrameIdx = curSnap && curSnap.stack && curSnap.stack.length
              ? (self.selectedFrameIdx >= 0 ? self.selectedFrameIdx : curSnap.stack.length - 1)
              : -1;
            var curFrame = curFrameIdx >= 0 ? self.displayFrameForSnapshot(curSnap, curFrameIdx) : null;
            return !(curFrame && curFrame.file === path && curFrame.line === line);
          },
        });
      }
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
    var path = this.normalizeBreakpointPath(filename);
    line = this.normalizeBreakpointLine(line);
    if (!path || !line) return;
    var bps = this.breakpoints.get(path);
    if (!bps) { bps = new Map(); this.breakpoints.set(path, bps); }
    var change;
    if (bps.has(line)) {
      bps.delete(line);
      if (bps.size === 0) this.breakpoints.delete(path);
      change = { op: 'remove', file: path, line: line };
    } else {
      bps.set(line, { condition: null, hitCount: null });
      change = { op: 'add', file: path, line: line, condition: null, hitCount: null };
    }
    this.persistBreakpoints();
    this.refreshBpDecorations();
    this.renderCurrentLine();
    this.renderBreakpointManager();
    this._publishBreakpoints();
    this.updateSessionWatches(false);
    if (this.session) {
      if (this.queueBreakpointChange(change)) this.refreshBreakpointsNow();
    }
  };

  DebuggerController.prototype.editBreakpointCondition = function (filename, line) {
    var path = this.normalizeBreakpointPath(filename);
    line = this.normalizeBreakpointLine(line);
    if (!path || !line) return;
    var bps = this.breakpoints.get(path);
    if (!bps) {
      bps = new Map();
      this.breakpoints.set(path, bps);
    }
    var wasMissing = !bps.has(line);
    var current = bps.get(line);
    var existing = (current && current.condition) || '';
    var existingHits = (current && current.hitCount) || null;
    var self = this;
    this.showBreakpointConditionDialog(path.replace(/^\/tutorial\//, ''), line, existing, current && current.condError, existingHits).then(function (result) {
      if (!result) {
        if (wasMissing && bps.size === 0) self.breakpoints.delete(path);
        return;
      }
      var cond = result.condition && result.condition.trim() ? result.condition.trim() : null;
      var hits = parseInt(result.hitCount, 10);
      if (!isFinite(hits) || hits < 1) hits = null;
      bps.set(line, { condition: cond, hitCount: hits });
      self.persistBreakpoints();
      self.refreshBpDecorations();
      self.renderBreakpointManager();
      self._publishBreakpoints();
      self.updateSessionWatches(false);
      if (self.session) {
        var change = { op: wasMissing ? 'add' : 'edit', file: path, line: line, condition: cond, hitCount: hits };
        if (self.queueBreakpointChange(change)) self.refreshBreakpointsNow();
      }
    });
  };

  DebuggerController.prototype.showBreakpointConditionDialog = function (filename, line, existing, condError, existingHitCount) {
    var old = document.querySelector('.tvm-bp-dialog-backdrop');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    var self = this;
    return new Promise(function (resolve) {
      var done = false;
      var previousFocus = document.activeElement;
      var backdrop = document.createElement('div');
      backdrop.className = 'tvm-bp-dialog-backdrop';
      backdrop.setAttribute('role', 'presentation');

      var dialog = document.createElement('div');
      dialog.className = 'tvm-bp-dialog';
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-labelledby', 'tvm-bp-dialog-title');

      var header = document.createElement('div');
      header.className = 'tvm-bp-dialog-header';

      var marker = document.createElement('span');
      marker.className = 'tvm-bp-dialog-marker';
      marker.textContent = '?';
      header.appendChild(marker);

      var titleWrap = document.createElement('div');
      titleWrap.className = 'tvm-bp-dialog-title-wrap';
      var title = document.createElement('h3');
      title.id = 'tvm-bp-dialog-title';
      title.className = 'tvm-bp-dialog-title';
      title.textContent = 'Breakpoint Condition';
      var loc = document.createElement('div');
      loc.className = 'tvm-bp-dialog-location';
      loc.textContent = self.basename(filename) + ':' + line;
      titleWrap.appendChild(title);
      titleWrap.appendChild(loc);
      header.appendChild(titleWrap);

      var body = document.createElement('div');
      body.className = 'tvm-bp-dialog-body';
      var label = document.createElement('label');
      label.className = 'tvm-bp-dialog-label';
      label.setAttribute('for', 'tvm-bp-condition-input');
      label.textContent = 'Python expression';
      var input = document.createElement('input');
      input.id = 'tvm-bp-condition-input';
      input.className = 'tvm-bp-dialog-input';
      input.type = 'text';
      input.value = existing || '';
      input.placeholder = 'score >= 90 and attempts < 3';
      input.setAttribute('spellcheck', 'false');
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('autocapitalize', 'off');
      if (condError) {
        input.setAttribute('aria-describedby', 'tvm-bp-condition-error');
        input.setAttribute('aria-invalid', 'true');
      }
      body.appendChild(label);
      body.appendChild(input);
      if (condError) {
        var error = document.createElement('div');
        error.id = 'tvm-bp-condition-error';
        error.className = 'tvm-bp-dialog-error';
        error.setAttribute('role', 'alert');
        error.setAttribute('aria-live', 'assertive');
        error.textContent = condError;
        body.appendChild(error);
      }
      var hitLabel = document.createElement('label');
      hitLabel.className = 'tvm-bp-dialog-label';
      hitLabel.setAttribute('for', 'tvm-bp-hitcount-input');
      hitLabel.textContent = 'Iteration count (skip first N−1 hits)';
      var hitInput = document.createElement('input');
      hitInput.id = 'tvm-bp-hitcount-input';
      // Distinct class from the condition input so existing tests/selectors
      // that target `.tvm-bp-dialog-input` continue to match a single field.
      hitInput.className = 'tvm-bp-dialog-hitcount-input';
      hitInput.type = 'number';
      hitInput.min = '1';
      hitInput.step = '1';
      hitInput.value = existingHitCount ? String(existingHitCount) : '';
      hitInput.placeholder = '1';
      hitInput.setAttribute('autocomplete', 'off');
      body.appendChild(hitLabel);
      body.appendChild(hitInput);

      var actions = document.createElement('div');
      actions.className = 'tvm-bp-dialog-actions';
      var clear = document.createElement('button');
      clear.type = 'button';
      clear.className = 'tvm-bp-dialog-btn tvm-bp-dialog-clear';
      clear.textContent = 'Clear';
      clear.disabled = !((existing && existing.trim()) || existingHitCount);
      var cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'tvm-bp-dialog-btn tvm-bp-dialog-cancel';
      cancel.textContent = 'Cancel';
      var save = document.createElement('button');
      save.type = 'button';
      save.className = 'tvm-bp-dialog-btn tvm-bp-dialog-save';
      save.textContent = 'Save';
      actions.appendChild(clear);
      actions.appendChild(cancel);
      actions.appendChild(save);

      dialog.appendChild(header);
      dialog.appendChild(body);
      dialog.appendChild(actions);
      backdrop.appendChild(dialog);
      document.body.appendChild(backdrop);

      function close(result) {
        if (done) return;
        done = true;
        backdrop.removeEventListener('keydown', onKeydown);
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
        try {
          if (previousFocus && previousFocus.focus) previousFocus.focus();
        } catch (e) {}
        resolve(result);
      }
      function onKeydown(e) {
        if (e.key === 'Escape') {
          e.preventDefault();
          close(null);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          close({ condition: input.value, hitCount: hitInput.value });
        }
      }

      backdrop.addEventListener('keydown', onKeydown);
      backdrop.addEventListener('mousedown', function (e) {
        if (e.target === backdrop) close(null);
      });
      cancel.addEventListener('click', function () { close(null); });
      clear.addEventListener('click', function () { close({ condition: '', hitCount: '' }); });
      save.addEventListener('click', function () { close({ condition: input.value, hitCount: hitInput.value }); });
      window.setTimeout(function () {
        input.focus();
        input.select();
      }, 0);
    });
  };

  DebuggerController.prototype.showRemoveWatchpointDialog = function (watchpoint) {
    var old = document.querySelector('.tvm-bp-dialog-backdrop');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    return new Promise(function (resolve) {
      var done = false;
      var previousFocus = document.activeElement;
      var backdrop = document.createElement('div');
      backdrop.className = 'tvm-bp-dialog-backdrop';
      backdrop.setAttribute('role', 'presentation');

      var dialog = document.createElement('div');
      dialog.className = 'tvm-bp-dialog';
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-labelledby', 'tvm-wp-remove-dialog-title');

      var header = document.createElement('div');
      header.className = 'tvm-bp-dialog-header';
      var marker = document.createElement('span');
      marker.className = 'tvm-bp-dialog-marker tvm-bp-dialog-marker-watchpoint';
      marker.innerHTML = debugManagerIcon('dataWatch');
      header.appendChild(marker);

      var titleWrap = document.createElement('div');
      titleWrap.className = 'tvm-bp-dialog-title-wrap';
      var title = document.createElement('h3');
      title.id = 'tvm-wp-remove-dialog-title';
      title.className = 'tvm-bp-dialog-title';
      title.textContent = 'Remove Data Watchpoint';
      var loc = document.createElement('div');
      loc.className = 'tvm-bp-dialog-location';
      loc.textContent = watchpoint && watchpoint.expr ? watchpoint.expr : '';
      titleWrap.appendChild(title);
      titleWrap.appendChild(loc);
      header.appendChild(titleWrap);

      var body = document.createElement('div');
      body.className = 'tvm-bp-dialog-body';
      var prompt = document.createElement('div');
      prompt.className = 'tvm-bp-dialog-copy';
      prompt.textContent = 'Do you want to keep this expression as a normal watch?';
      body.appendChild(prompt);
      var rememberLabel = document.createElement('label');
      rememberLabel.className = 'tvm-bp-dialog-check';
      var remember = document.createElement('input');
      remember.type = 'checkbox';
      var rememberText = document.createElement('span');
      rememberText.textContent = "Don't ask again";
      rememberLabel.appendChild(remember);
      rememberLabel.appendChild(rememberText);
      body.appendChild(rememberLabel);

      var actions = document.createElement('div');
      actions.className = 'tvm-bp-dialog-actions';
      var cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'tvm-bp-dialog-btn tvm-bp-dialog-cancel';
      cancel.textContent = 'Cancel';
      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'tvm-bp-dialog-btn tvm-bp-dialog-clear';
      del.textContent = 'Delete';
      var keep = document.createElement('button');
      keep.type = 'button';
      keep.className = 'tvm-bp-dialog-btn tvm-bp-dialog-save';
      keep.textContent = 'Turn into Watch';
      actions.appendChild(cancel);
      actions.appendChild(del);
      actions.appendChild(keep);

      dialog.appendChild(header);
      dialog.appendChild(body);
      dialog.appendChild(actions);
      backdrop.appendChild(dialog);
      document.body.appendChild(backdrop);

      function close(result) {
        if (done) return;
        done = true;
        backdrop.removeEventListener('keydown', onKeydown);
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
        try {
          if (previousFocus && previousFocus.focus) previousFocus.focus();
        } catch (e) {}
        resolve(result);
      }
      function choice(which) {
        close({ choice: which, remember: !!remember.checked });
      }
      function onKeydown(e) {
        if (e.key === 'Escape') {
          e.preventDefault();
          close(null);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          choice('watch');
        }
      }

      backdrop.addEventListener('keydown', onKeydown);
      backdrop.addEventListener('mousedown', function (e) {
        if (e.target === backdrop) close(null);
      });
      cancel.addEventListener('click', function () { close(null); });
      del.addEventListener('click', function () { choice('delete'); });
      keep.addEventListener('click', function () { choice('watch'); });
      window.setTimeout(function () { keep.focus(); }, 0);
    });
  };

  DebuggerController.prototype.refreshBpDecorations = function () {
    var self = this;
    // Design rule: the bright STANDALONE breakpoint dot (full size) shows
    // when there's no chevron over it. When the current step lands on a
    // breakpoint, we suppress the standalone dot — the chevron's combined
    // `-on-bp` variant draws a smaller dot INSIDE its outline instead.
    var curSnap = (self.historyIdx >= 0 && self.history[self.historyIdx]) || null;
    var curFrameIdx = curSnap && curSnap.stack && curSnap.stack.length
      ? (self.selectedFrameIdx >= 0 ? self.selectedFrameIdx : curSnap.stack.length - 1)
      : -1;
    var curFrame = curFrameIdx >= 0 ? self.displayFrameForSnapshot(curSnap, curFrameIdx) : null;
    var curFile = curFrame ? curFrame.file : null;
    var curLine = curFrame ? curFrame.line : 0;
    function paint(editor) {
      if (!editor) return;
      var model = editor.getModel(); if (!model) return;
      var fname = self.activeFileForEditor(editor); if (!fname) return;
      var path = self.normalizeBreakpointPath(fname);
      if (!path) return;
      var bps = self.breakpoints.get(path);
      var decos = [];
      if (bps) {
        bps.forEach(function (info, line) {
          line = self.normalizeBreakpointLine(line);
          if (!line) return;
          if (line < 1 || line > model.getLineCount()) return;
          // Suppress standalone bp on the current line (live or rewound).
          // The combined chevron+inner-dot glyph handles that slot.
          if (curFile === path && curLine === line) return;
          var hasModifier = !!(info.condition || info.hitCount);
          var glyphClass = hasModifier
            ? 'tvm-bp-glyph tvm-bp-cond' + (info.condError ? ' tvm-bp-error' : '')
            : 'tvm-bp-glyph';
          var msgParts = [];
          if (info.condition) msgParts.push('when `' + info.condition + '`');
          if (info.hitCount) msgParts.push('after ' + info.hitCount + ' hits');
          var msg = msgParts.length
            ? 'Breakpoint (' + msgParts.join(', ') + ')'
            : 'Breakpoint';
          if (info.condError) msg += '\n\n⚠️ ' + info.condError;
          decos.push({
            range: new monaco.Range(line, 1, line, 1),
            options: {
              glyphMarginClassName: glyphClass,
              glyphMarginHoverMessage: { value: msg },
            },
          });
        });
      }
      // Reuse a per-editor decoration id list. Use a property on the editor.
      var key = '_dbgBpIds';
      var prev = editor[key] || [];
      editor[key] = editor.deltaDecorations(prev, decos);
      if (editor._dbgBpPreviewRefresh) editor._dbgBpPreviewRefresh();
    }
    paint(this.t.editor);
    paint(this.t.editor2);
  };

  DebuggerController.prototype.persistBreakpoints = function () {
    var self = this;
    var ser = [];
    this.breakpoints.forEach(function (bps, path) {
      bps.forEach(function (info, line) {
        var normalizedPath = self.normalizeBreakpointPath(path);
        var normalizedLine = self.normalizeBreakpointLine(line);
        if (!normalizedPath || !normalizedLine) return;
        ser.push({ path: normalizedPath, line: normalizedLine, condition: info.condition || null, hitCount: info.hitCount || null });
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
      if (!Array.isArray(arr)) return;
      var self = this;
      arr.forEach(function (b) {
        var path = self.normalizeBreakpointPath(b && (b.path || b.file || b.filename));
        var line = self.normalizeBreakpointLine(b && b.line);
        if (!path || !line) return;
        var bps = self.breakpoints.get(path);
        if (!bps) { bps = new Map(); self.breakpoints.set(path, bps); }
        var hits = parseInt(b.hitCount != null ? b.hitCount : b.hit_count, 10);
        if (!isFinite(hits) || hits < 1) hits = null;
        var condition = b.condition == null ? null : String(b.condition).trim();
        if (!condition) condition = null;
        bps.set(line, { condition: condition, hitCount: hits });
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

  DebuggerController.prototype.normalizeBreakpointLine = function (line) {
    var n = Number(line);
    return isFinite(n) && Math.floor(n) === n && n >= 1 ? n : null;
  };

  DebuggerController.prototype.loadConfiguredBreakpoints = function () {
    var configured = this.opts.initial_breakpoints || this.opts.breakpoints || [];
    if (!Array.isArray(configured)) return;
    var self = this;
    configured.forEach(function (bp) {
      var file = bp && (bp.file || bp.path || bp.filename);
      var path = self.normalizeBreakpointPath(file || self.t.activeFileName);
      var line = self.normalizeBreakpointLine(bp && bp.line);
      if (!path || !line || line < 1) return;
      var condition = bp.condition == null ? null : String(bp.condition).trim();
      if (!condition) condition = null;
      var hits = parseInt(bp && (bp.hitCount != null ? bp.hitCount : bp.hit_count), 10);
      if (!isFinite(hits) || hits < 1) hits = null;
      var bps = self.breakpoints.get(path);
      if (!bps) { bps = new Map(); self.breakpoints.set(path, bps); }
      bps.set(line, { condition: condition, hitCount: hits });
    });
  };

  DebuggerController.prototype.collectBreakpointsForRun = function () {
    var self = this;
    var out = [];
    this.breakpoints.forEach(function (bps, path) {
      path = self.normalizeBreakpointPath(path);
      if (!path) return;
      var fname = path.replace(/^\/tutorial\//, '');
      var model = self.t.editorModels[fname] && self.t.editorModels[fname].model;
      var maxLine = model ? model.getLineCount() : Infinity;
      bps.forEach(function (info, line) {
        line = self.normalizeBreakpointLine(line);
        if (!line) return;
        if (line < 1 || line > maxLine) return;
        out.push({
          file: path,
          line: line,
          condition: info.condition || null,
          hitCount: info.hitCount || null,
        });
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
    // When a channel is in use (e.g. NodeChannel for webcontainer), it owns
    // its own dispatch path — paused/log/editError etc. are routed via the
    // channel's stdout parser, not via the worker's postMessage stream.
    if (this.channel) return;
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
    // For pyodide we need a Worker reference; for webcontainer (NodeChannel)
    // we need the WebContainer to be booted; for browser we just need the
    // BrowserChannel module loaded (no async runtime to wait on).
    var backend = this.t.config && this.t.config.backend;
    if (!this.channel && !this.t._worker) { this.setStatus('Pyodide not ready yet. Wait a moment, then try again.'); return; }
    var usingNodeChannel = this.channel && window.SEBookNodeChannel && this.channel instanceof window.SEBookNodeChannel;
    if (usingNodeChannel && backend === 'webcontainer' && !this.t._webcontainer) {
      this.setStatus('WebContainer is not ready yet. Wait a moment, then try again.'); return;
    }

    var step = this.t.steps && this.t.steps[this.t.currentStep >= 0 ? this.t.currentStep : 0];
    var filename = (step && step.run_file) ? step.run_file : this.t.activeFileName;
    if (!filename) { this.setStatus('Open a file in the editor before debugging.'); return; }
    filename = String(filename).replace(/^\/tutorial\//, '').replace(/^\/+/, '');
    var model = this.t.editorModels[filename] && this.t.editorModels[filename].model;
    if (!model) { this.setStatus('Cannot locate code for ' + filename + '. Switch to a Python file and try again.'); return; }
    var code = model.getValue();
    var path = this.normalizeBreakpointPath(filename);
    var files = this.collectDebugFiles();
    var runAsPytest = this.shouldDebugWithPytest(filename);
    files[path] = code;

    // SAB only matters for the pyodide (worker) path. For NodeChannel the
    // session object holds metadata only — the channel owns its own pipes.
    var sab = null, i32 = null, u8 = null;
    if (!this.channel) {
      sab = new SharedArrayBuffer(SAB_TOTAL_BYTES);
      i32 = new Int32Array(sab);
      u8 = new Uint8Array(sab);
    }

    this.session = {
      sab: sab, i32: i32, u8: u8,
      // Seed from normal watches, data watchpoints, and conditional breakpoint
      // expressions so all debugger stop conditions are present in snapshots.
      watches: this.collectWatchExpressions(),
      args: this.collectProgramArgs(),
      debugFilename: path,
      debugCode: code,
      debugPytest: runAsPytest,
      debugPytestArgs: runAsPytest ? this.pytestArgsForDebug(path) : null,
      capReached: false,
      pendingStart: {
        filename: path,
        code: code,
        files: files,
        pytest: runAsPytest,
        pytestArgs: runAsPytest ? this.pytestArgsForDebug(path) : null,
      },
    };
    this._resetExecutionTrace(true);

    // Lock editor read-only. When the sync/editor-attach path is available it
    // owns read-only state per editor; doing it here first would cause the
    // attachment to save "true" as the original value and leave the editor
    // locked after Stop. The fallback path still needs the legacy lock.
    if (!this.sync) {
      if (this.t.editor) {
        this._editorWasReadOnly = !!this.t.editor.getOption(monaco.editor.EditorOption.readOnly);
        this.t.editor.updateOptions({ readOnly: true });
      }
      if (this.t.editor2) {
        this._editor2WasReadOnly = !!this.t.editor2.getOption(monaco.editor.EditorOption.readOnly);
        this.t.editor2.updateOptions({ readOnly: true });
      }
    }

    // Disable Run/Test
    var runBtn = this.t.root.querySelector('.tvm-run-btn');
    if (runBtn) { runBtn.disabled = true; runBtn.title = 'Stop the debugger to run/test'; }

    // Show step toolbar; hide Debug button
    if (this.debugBtn) this.debugBtn.style.display = 'none';
    if (this.stepToolbar) this.stepToolbar.style.display = 'flex';
    if (this._scheduleToolbarLayout) this._scheduleToolbarLayout();

    this.activateTab('dbg-combined');
    this.disableStepButtons(true);
    this.setStatus('starting…');
    this._publishWatches();
    this._publishCursor();

    if (this.channel) {
      // NodeChannel: bypasses debugInit/runDebug postMessage handshake.
      this.session.pendingStart = null;
      // gdb channel also reads `executable` from the tutorial's
      // debugger_options (YAML). Per-step `debugger_options:` overrides the
      // top-level value so a multi-binary tutorial (e.g. the C tutorial,
      // where each chapter compiles a different binary) can target the
      // right executable per chapter. For other channels this is ignored —
      // extra cfg fields are harmless.
      var tutDbgOpts = (this.t.debuggerOptions || this.t.config && this.t.config.debuggerOptions) || {};
      var stepDbgOpts = (step && step.debugger_options) || {};
      var dbgOpts = Object.assign({}, tutDbgOpts, stepDbgOpts);
      this.channel.startSession({
        filename: path,
        code: code,
        files: files,
        breakpoints: this.collectBreakpointsForRun(),
        watches: this.session.watches,
        args: this.session.args || [],
        executable: dbgOpts.executable || null,
        options: this.opts,
        serverMode: !!(step && step.http_client),
        overrides: this.session.replayOverrides || [],
        exceptionBreakpoints: this._serializeExceptionBreakpoints(),
        pytest: runAsPytest,
        pytestArgs: runAsPytest ? this.pytestArgsForDebug(path) : null,
      });
    } else {
      // Pyodide: load/enable the worker extension first; debugInit waits for
      // debuggerReady so a fresh worker has time to importScripts.
      this.t._worker.postMessage({ type: 'enableDebugger' });
    }
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
      files: st.files || {},
      breakpoints: this.collectBreakpointsForRun(),
      watches: this.session.watches,
      args: this.session.args || [],
      options: this.opts,
      pytest: !!st.pytest,
      pytestArgs: st.pytestArgs || null,
      // Variable-mutation overrides recorded by the user during a previous
      // rewound state. The worker applies each at its recorded snapshot index.
      overrides: this.session.replayOverrides || [],
      exceptionBreakpoints: this._serializeExceptionBreakpoints(),
    });
    this.setStatus('running…');
  };

  DebuggerController.prototype.sendCommand = function (cmdCode) {
    if (!this.session) return;
    if (cmdCode !== CMD_SYNC) {
      this.session.preserveReverseCursorOnNextPause = null;
    }
    this.paused = false;
    if (this.channel) {
      this.channel.sendCommand(cmdCode);
    } else {
      Atomics.store(this.session.i32, SLOT_CMD, cmdCode);
      Atomics.notify(this.session.i32, SLOT_CMD, 1);
    }
    if (this.session.pendingLiveEdits && this.session.pendingLiveEdits.length) {
      this.session.pendingLiveEdits = [];
    }
    if (this.session.pendingBreakpointChanges && this.session.pendingBreakpointChanges.length) {
      this.session.pendingBreakpointChanges = [];
    }
    // Publish user-visible cursor movement for real commands. Internal replay
    // steps should stay visually parked on the user's selected line until the
    // replay reaches its anchor; otherwise edits appear to jump back to line 1.
    if (!this.session || this.session.replayTargetIdx == null) {
      this._publishCursor();
    }
  };

  DebuggerController.prototype.requestSync = function () {
    if (!this.session || !this.paused || this.historyIdx !== this.liveIdx) return;
    this.requestRuntimeSync(null, 'applying…');
  };

  DebuggerController.prototype.requestRuntimeSync = function (followupCmd, status) {
    if (!this.session || this.historyIdx !== this.liveIdx) return;
    if (followupCmd) this.session.afterRuntimeSync = followupCmd;
    if (this.session.runtimeSyncInFlight) return;
    this.session.runtimeSyncInFlight = true;
    this.disableStepButtons(true);
    this.setStatus(status || 'applying…');
    // Defer the CMD_SYNC notify to a microtask so that all synchronous SAB
    // writes from the current task (e.g. removeBreakpoint+addWatchpoint+
    // handleToolbarCmd) complete BEFORE the worker is woken up. Otherwise
    // the worker can race ahead and read SAB while a subsequent main-thread
    // _writeJson is mid-fill, causing JSON.parse to fail and the DIRTY flag
    // to be silently reset — losing the update entirely.
    var self = this;
    queueMicrotask(function () {
      if (!self.session || !self.session.runtimeSyncInFlight) return;
      self.session.runtimeSyncTargetVersion = self.session.runtimeUpdateVersion || 0;
      self.sendCommand(CMD_SYNC);
    });
  };

  DebuggerController.prototype.markRuntimeUpdatePending = function () {
    if (!this.session) return;
    this.session.runtimeUpdatePending = true;
    this.session.runtimeUpdateVersion = (this.session.runtimeUpdateVersion || 0) + 1;
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
      // Breakpoint edits while viewing history should not force a replay.
      // The current worker can accept the breakpoint table update, and if the
      // user later executes forward from this rewound snapshot we already
      // restart from history with the latest breakpoint set.
      this.disableStepButtons(false);
      this.setStatus('breakpoints updated');
      return;
    }
    if (this.paused) {
      this.requestRuntimeSync(null, 'updating breakpoints…');
    }
  };

  DebuggerController.prototype.queueBreakpointChange = function (change) {
    if (!this.session) return false;
    this.session.pendingBreakpointChanges = this.session.pendingBreakpointChanges || [];
    this.session.pendingBreakpointChanges.push(change);
    if (this.channel) {
      var ok = this.channel.sendBreakpointChanges([change]);
      if (!ok) this.session.pendingBreakpointChanges.pop();
      else this.markRuntimeUpdatePending();
      return ok;
    }
    var json = JSON.stringify(this.session.pendingBreakpointChanges);
    if (!this.writePayload(BPS_OFF, BPS_REGION_BYTES, SLOT_BPS_LEN, SLOT_BPS_DIRTY, json, 'breakpoints')) {
      this.session.pendingBreakpointChanges.pop();
      return false;
    }
    this.markRuntimeUpdatePending();
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

  DebuggerController.prototype.collectDebugFiles = function () {
    var files = {};
    var models = this.t.editorModels || {};
    Object.keys(models).forEach(function (filename) {
      var entry = models[filename];
      if (entry && entry.model) {
        files['/tutorial/' + filename] = entry.model.getValue();
      }
    });
    return files;
  };

  DebuggerController.prototype.shouldDebugWithPytest = function (filename) {
    return !!(this.t && this.t._pytestMode && this.isPytestFile(filename));
  };

  DebuggerController.prototype.pytestArgsForDebug = function (path) {
    return [path, '-v', '--tb=short', '--no-header'];
  };

  DebuggerController.prototype.isPytestFile = function (filename) {
    if (!filename) return false;
    var base = String(filename).split('/').pop();
    return /^test_.+\.py$/i.test(base) || /_test\.py$/i.test(base);
  };

  DebuggerController.prototype.queueWatchUpdate = function () {
    if (!this.session) return false;
    if (this.channel) {
      var ok = this.channel.sendWatches(this.session.watches);
      if (ok) this.markRuntimeUpdatePending();
      return ok;
    }
    var json = JSON.stringify(this.session.watches);
    var wrote = this.writePayload(WATCH_OFF, WATCH_REGION_BYTES, SLOT_WATCHES_LEN, SLOT_WATCHES_DIRTY, json, 'watches');
    if (wrote) this.markRuntimeUpdatePending();
    return wrote;
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
    var priorHistoryLength = this.history.length;
    var startIdx = priorHistoryLength;
    if (msg.replace_last && snaps.length && this.liveIdx >= 0) {
      startIdx = this.liveIdx;
      if (this.history[this.liveIdx] && this.history[this.liveIdx].watchpoint_origin && !snaps[0].watchpoint_origin) {
        snaps[0].watchpoint_origin = this.history[this.liveIdx].watchpoint_origin;
      }
      this.history[this.liveIdx] = snaps[0];
      for (var r = 1; r < snaps.length; r++) this.history.push(snaps[r]);
      this.liveIdx = this.history.length - 1;
    } else {
      for (var i = 0; i < snaps.length; i++) this.history.push(snaps[i]);
      this.liveIdx = this.history.length - 1;
    }
    var endIdx = this.liveIdx;
    this.historyIdx = this.liveIdx;
    var syncTargetVersion = this.session.runtimeSyncTargetVersion || 0;
    if (!this.session.runtimeSyncInFlight ||
        (this.session.runtimeUpdateVersion || 0) <= syncTargetVersion) {
      this.session.runtimeUpdatePending = false;
    }
    this.session.runtimeSyncInFlight = false;
    this.session.runtimeSyncTargetVersion = null;
    // Cheap incremental broadcast — popouts learn about new snapshots
    // without us re-shipping the entire history array each tick.
    this._appendHistoryToSync(snaps, !!msg.replace_last, priorHistoryLength);
    // If we're in the middle of a replay (post-edit re-execution), let the
    // replay driver decide whether to auto-step further or hand control back.
    if (this.handlePausedDuringReplay(startIdx, endIdx)) return;
    if (this.handlePausedDuringWatchpointRun(startIdx, endIdx)) return;
    if (this.session && this.session.continueThroughRuntimeStops && !this.hasForwardStopConditions()) {
      this.paused = false;
      this.sendCommand(CMD_CONTINUE);
      this.setStatus('continue…');
      return;
    }
    if (this.session) this.session.continueThroughRuntimeStops = false;
    this.selectedFrameIdx = -1;
    this.paused = true;
    var preserveIdx = this.session && this.session.preserveReverseCursorOnNextPause;
    var preservedReverseCursor = typeof preserveIdx === 'number' &&
      preserveIdx >= 0 &&
      preserveIdx < this.history.length &&
      preserveIdx < this.liveIdx;
    if (preservedReverseCursor) {
      this.historyIdx = preserveIdx;
    }
    if (this.session) this.session.preserveReverseCursorOnNextPause = null;
    this.disableStepButtons(false);
    if (!preservedReverseCursor) {
      var liveSnap = this.history[this.liveIdx];
      if (this.snapshotBreakpointMatch(liveSnap)) {
        this.setStatus('paused at breakpoint at ' + this.basename(liveSnap.file) + ':' + liveSnap.line);
      } else {
        this.setStatus('paused at line ' + liveSnap.line);
      }
    }
    this.renderAll(!preservedReverseCursor);
    this._publishCursor();
    this._publishSession();
    var followup = this.session && this.session.afterRuntimeSync;
    if (followup) {
      this.session.afterRuntimeSync = null;
      this.handleToolbarCmd(followup);
    }
  };

  DebuggerController.prototype.onDebugComplete = function (msg) {
    this.disableStepButtons(true);
    this.endSession(false);
  };

  DebuggerController.prototype.onCapReached = function (msg) {
    if (!this.session) return;
    this.session.capReached = true;
    this.setStatus('snapshot cap (' + msg.limit + ') — back-in-time disabled');
  };

  DebuggerController.prototype.onBreakpointError = function (msg) {
    var path = this.normalizeBreakpointPath(msg && msg.file);
    var line = this.normalizeBreakpointLine(msg && msg.line);
    var bps = path ? this.breakpoints.get(path) : null;
    if (bps && line && bps.has(line)) {
      var info = bps.get(line);
      info.condError = msg.error;
      this.refreshBpDecorations();
      this._publishBreakpoints();
    }
  };

  DebuggerController.prototype.stopSession = function () {
    if (!this.session) return;
    this.sendCommand(CMD_STOP);
  };

  DebuggerController.prototype.endSession = function (keepHistory) {
    // Restore editor + UI state
    if (!this.sync) {
      if (this.t.editor) this.t.editor.updateOptions({ readOnly: this._editorWasReadOnly });
      if (this.t.editor2) this.t.editor2.updateOptions({ readOnly: this._editor2WasReadOnly });
    }
    var runBtn = this.t.root.querySelector('.tvm-run-btn');
    if (runBtn) { runBtn.disabled = false; runBtn.title = 'Run current file (Ctrl+Enter)'; }
    if (this.stepToolbar) this.stepToolbar.style.display = 'none';
    var actions = this.t.root && this.t.root.querySelector('.tvm-output-actions');
    if (actions) actions.classList.remove('tvm-debug-toolbar-new-row');
    if (this.stepToolbarHeader) this.stepToolbarHeader.classList.remove('tvm-debug-toolbar-row-host');
    if (this.stepToolbar) this.stepToolbar.classList.remove('tvm-debug-toolbar-new-row');
    if (actions && this.stepToolbar && this.stepToolbar.parentNode !== actions) {
      actions.appendChild(this.stepToolbar);
    }
    if (this.debugBtn) this.debugBtn.style.display = '';
    this.clearCurrentLineDecoration();
    // For NodeChannel, kill the spawned Node process. Pyodide's worker stays
    // alive across sessions (just resets its state via _ttd_cleanup).
    if (this.channel && typeof this.channel.dispose === 'function') {
      try { this.channel.dispose(); } catch (e) {}
    }
    this.session = null;
    this.paused = false;
    if (this.statusEl) {
      this.statusEl.textContent = '';
      this.statusEl.title = '';
    }
    if (!keepHistory) {
      this._resetExecutionTrace(false);
      this.renderAll();
    } else {
      this._publishHistoryReset();
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
  DebuggerController.prototype.renderAll = function (revealCurrentLine) {
    this.renderVariables();
    this.renderCallStack();
    this.renderWatch();
    this.renderBreakpointManager();
    this.renderHistory();
    this.renderCurrentLine(!!revealCurrentLine);
    // Re-emit breakpoint decorations so the suppression of the standalone bp
    // glyph on the CURRENT-step line takes effect (otherwise the standalone
    // bp + the combined chevron-on-bp both render at the same gutter slot).
    this.refreshBpDecorations();
    // Auto-publish cursor + session AFTER any local re-render. This ensures
    // popouts always see fresh state without each mutation site having to
    // remember to publish — pre-existing paths like stepBack and the replay
    // machinery used to mutate historyIdx without calling _publishCursor,
    // which left popout variables/stack/etc. stale.
    this._publishCursor();
    this._publishSession();
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
  //   - LIVE globals/module locals: mutate through the runtime and refresh with CMD_SYNC.
  //   - LIVE Python function locals: Pyodide cannot write optimized fast locals through
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
    var backend = this.t.config && this.t.config.backend;
    var sourceReplay = backend === 'pyodide' && scope === 'locals' &&
      frame && frameIdx === topIdx;
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
    if (sourceReplay) {
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
    } else if (sourceReplay) {
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
    if (this.channel) {
      var ok = this.channel.sendLiveEdits([edit]);
      if (!ok) this.session.pendingLiveEdits.pop();
      else this.markRuntimeUpdatePending();
      return ok;
    }
    var json = JSON.stringify(this.session.pendingLiveEdits);
    if (!this.writePayload(EDITS_OFF, EDITS_REGION_BYTES, SLOT_EDITS_LEN, SLOT_EDITS_DIRTY, json, 'edits')) {
      this.session.pendingLiveEdits.pop();
      return false;
    }
    this.markRuntimeUpdatePending();
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
      var f = this.displayFrameForSnapshot(snap, i);
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
          self._publishCursor();
        });
      })(frames[j]);
    }
  };

  DebuggerController.prototype.renderWatch = function () {
    var view = this.viewEl('dbg-watch');
    if (!view) return;
    var snap = this.historyIdx >= 0 ? this.history[this.historyIdx] : null;
    var watches = this.getNormalWatches();
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
                '<button class="tvm-debug-watch-action tvm-debug-watch-promote" data-i="' + i + '" title="Watch for data value changes" aria-label="Watch for data value changes">' + debugManagerIcon('dataWatch') + '</button>' +
                '<button class="tvm-debug-watch-action tvm-debug-watch-remove" data-i="' + i + '" title="Remove" aria-label="Remove">' + debugManagerIcon('trash') + '</button>' +
                '</div>');
    }
    view.innerHTML =
      '<div class="tvm-debug-watch-list">' + rows.join('') + '</div>' +
      '<div class="tvm-debug-watch-add">' +
      '<input type="text" class="tvm-debug-watch-input" placeholder="Add a Python expression to watch (e.g. len(items))" title="Watch expression" aria-label="Watch expression" />' +
      '<button class="tvm-debug-watch-add-btn">+ Add</button>' +
      '</div>' +
      (watches.length === 0 ? '<div class="tvm-debug-empty">Watches are evaluated on every step. Avoid expressions with side effects.</div>' : '');

    var self = this;
    var input = view.querySelector('.tvm-debug-watch-input');
    var addBtn = view.querySelector('.tvm-debug-watch-add-btn');
    function add() {
      var expr = (input.value || '').trim();
      if (!expr) return;
      self.addNormalWatch(expr);
      input.value = '';
    }
    if (addBtn) addBtn.addEventListener('click', add);
    if (input) input.addEventListener('keydown', function (e) { if (e.key === 'Enter') add(); });
    var removeBtns = view.querySelectorAll('.tvm-debug-watch-remove');
    for (var i = 0; i < removeBtns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var idx = +btn.getAttribute('data-i');
          self.removeNormalWatch(idx);
        });
      })(removeBtns[i]);
    }
    var promoteBtns = view.querySelectorAll('.tvm-debug-watch-promote');
    for (var p = 0; p < promoteBtns.length; p++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var idx = +btn.getAttribute('data-i');
          self.promoteWatchToWatchpoint(idx);
        });
      })(promoteBtns[p]);
    }
  };

  DebuggerController.prototype.removeBreakpoint = function (filename, line) {
    var path = this.normalizeBreakpointPath(filename);
    line = this.normalizeBreakpointLine(line);
    if (!path || !line) return;
    var bps = this.breakpoints.get(path);
    if (!bps || !bps.has(line)) return;
    bps.delete(line);
    if (bps.size === 0) this.breakpoints.delete(path);
    this.persistBreakpoints();
    this.refreshBpDecorations();
    this.renderCurrentLine();
    this.renderBreakpointManager();
    this._publishBreakpoints();
    this.updateSessionWatches(false);
    if (this.session) {
      if (this.queueBreakpointChange({ op: 'remove', file: path, line: line })) this.refreshBreakpointsNow();
    }
  };

  DebuggerController.prototype.renderBreakpointManager = function () {
    var view = this.viewEl('dbg-breakpoints');
    if (!view) return;
    var snap = this.historyIdx >= 0 ? this.history[this.historyIdx] : null;
    var bpRows = [];
    var self = this;
    this.breakpoints.forEach(function (bps, path) {
      var lines = Array.from(bps.keys()).sort(function (a, b) { return a - b; });
      lines.forEach(function (line) {
        var info = bps.get(line) || {};
        var cond = info.condition
          ? '<span class="tvm-debug-manager-condition">when ' + self.escape(info.condition) + '</span>'
          : (info.hitCount ? '' : '<span class="tvm-debug-manager-muted">unconditional</span>');
        var hits = info.hitCount
          ? '<span class="tvm-debug-manager-hitcount">after ' + info.hitCount + ' hits</span>'
          : '';
        var err = info.condError
          ? '<span class="tvm-debug-manager-error">' + self.escape(info.condError) + '</span>'
          : '';
        bpRows.push(
          '<div class="tvm-debug-manager-row tvm-debug-manager-code-row">' +
          '<span class="tvm-debug-manager-dot"></span>' +
          '<span class="tvm-debug-manager-main">' +
          '<span class="tvm-debug-manager-title">' + self.escape(self.basename(path)) + ':' + line + '</span>' +
          cond + hits + err +
          '</span>' +
          '<button class="tvm-debug-manager-icon" data-bp-edit="1" data-path="' + self.escape(path) + '" data-line="' + line + '" title="Edit condition" aria-label="Edit condition">' + debugManagerIcon('edit') + '</button>' +
          '<button class="tvm-debug-manager-icon tvm-debug-manager-danger" data-bp-remove="1" data-path="' + self.escape(path) + '" data-line="' + line + '" title="Remove breakpoint" aria-label="Remove breakpoint">' + debugManagerIcon('trash') + '</button>' +
          '</div>'
        );
      });
    });
    var wpRows = this.watchpoints.map(function (wp) {
      var v = snap && snap.watches ? snap.watches[wp.expr] : null;
      var val = self.renderWatchValue(v);
      var disabled = wp.enabled === false;
      var toggleLabel = disabled ? 'Enable data watchpoint' : 'Disable data watchpoint';
      return '<div class="tvm-debug-manager-row tvm-debug-manager-watchpoint-row' + (disabled ? ' disabled' : '') + '">' +
        '<label class="tvm-debug-manager-toggle" title="' + toggleLabel + '">' +
        '<input type="checkbox" aria-label="' + toggleLabel + '" data-wp-toggle="' + self.escape(wp.id) + '"' + (disabled ? '' : ' checked') + '>' +
        '<span></span><em class="sr-only">' + toggleLabel + '</em>' +
        '</label>' +
        '<span class="tvm-debug-manager-main">' +
        '<span class="tvm-debug-manager-title">' + self.escape(wp.expr) + '</span>' +
        '<span class="tvm-debug-manager-value">' + val + '</span>' +
        '</span>' +
        '<button class="tvm-debug-manager-icon" data-wp-run="' + self.escape(wp.id) + '" title="Run to this data value change" aria-label="Run to this data value change">' + debugManagerIcon('playData') + '</button>' +
        '<button class="tvm-debug-manager-icon" data-wp-back="' + self.escape(wp.id) + '" title="Run back to this data value change" aria-label="Run back to this data value change">' + debugManagerIcon('backData') + '</button>' +
        '<button class="tvm-debug-manager-icon tvm-debug-manager-danger" data-wp-remove="' + self.escape(wp.id) + '" title="Remove data watchpoint" aria-label="Remove data watchpoint">' + debugManagerIcon('trash') + '</button>' +
        '</div>';
    });
    var watchpointControls =
      '<div class="tvm-debug-manager-add">' +
      '<input type="text" class="tvm-debug-watchpoint-input" placeholder="Break when expression changes value" title="Data watchpoint expression" aria-label="Data watchpoint expression" />' +
      '<button class="tvm-debug-watchpoint-add-btn">' + debugManagerIcon('plus') + '<span>Add Data Watchpoint</span></button>' +
      '</div>' +
      '<div class="tvm-debug-manager-actions">' +
      '<button class="tvm-debug-manager-run" data-wp-run-all="1">' + debugManagerIcon('playData') + '<span>Run to Data Change</span></button>' +
      '<button class="tvm-debug-manager-run" data-wp-back-all="1">' + debugManagerIcon('backData') + '<span>Run Back to Data Change</span></button>' +
      '</div>';

    var ebRows = (this.exceptionBreakpoints || []).map(function (eb) {
      var disabled = eb.enabled === false;
      var typeAttr = self.escape(eb.type || '');
      var modeAll = eb.mode === 'all';
      var toggleLabel = disabled ? 'Enable exception breakpoint' : 'Disable exception breakpoint';
      return '<div class="tvm-debug-manager-row tvm-debug-manager-exception-row' + (disabled ? ' disabled' : '') + '" data-exc-bp="' + eb.id + '">' +
        '<label class="tvm-debug-manager-toggle" title="' + toggleLabel + '">' +
        '<input type="checkbox" aria-label="' + toggleLabel + '" data-exc-toggle="' + eb.id + '"' + (disabled ? '' : ' checked') + '>' +
        '<span></span><em class="sr-only">' + toggleLabel + '</em>' +
        '</label>' +
        '<span class="tvm-debug-manager-main">' +
        '<input type="text" class="tvm-debug-manager-exc-type" placeholder="Any exception type" title="Exception type filter" aria-label="Exception type filter" value="' + typeAttr + '" data-exc-type="' + eb.id + '" spellcheck="false" autocomplete="off">' +
        '<span class="tvm-debug-manager-exc-modes">' +
        '<label><input type="radio" name="exc-mode-' + eb.id + '" value="uncaught" data-exc-mode="' + eb.id + '"' + (modeAll ? '' : ' checked') + '>Uncaught</label>' +
        '<label><input type="radio" name="exc-mode-' + eb.id + '" value="all" data-exc-mode="' + eb.id + '"' + (modeAll ? ' checked' : '') + '>All raised</label>' +
        '</span>' +
        '</span>' +
        '<button class="tvm-debug-manager-icon" data-exc-run="' + eb.id + '" title="Run to this exception" aria-label="Run to this exception">' + debugManagerIcon('playException') + '</button>' +
        '<button class="tvm-debug-manager-icon" data-exc-back="' + eb.id + '" title="Run back to this exception" aria-label="Run back to this exception">' + debugManagerIcon('backException') + '</button>' +
        '<button class="tvm-debug-manager-icon tvm-debug-manager-danger" data-exc-remove="' + eb.id + '" title="Remove exception breakpoint" aria-label="Remove exception breakpoint">' + debugManagerIcon('trash') + '</button>' +
        '</div>';
    });
    var exceptionControls =
      '<div class="tvm-debug-manager-actions">' +
      '<button class="tvm-debug-manager-run" data-exc-add="1">' + debugManagerIcon('plus') + '<span>Add Exception Breakpoint</span></button>' +
      '<button class="tvm-debug-manager-run" data-exc-run-all="1">' + debugManagerIcon('playException') + '<span>Run to Exception</span></button>' +
      '<button class="tvm-debug-manager-run" data-exc-back-all="1">' + debugManagerIcon('backException') + '<span>Run Back to Exception</span></button>' +
      '</div>';

    view.innerHTML =
      '<div class="tvm-debug-manager">' +
      this.renderBreakpointManagerGroup('manager-code-breakpoints', 'Code Breakpoints',
        bpRows.length ? bpRows.join('') : '<div class="tvm-debug-empty-row">No code breakpoints.</div>') +
      this.renderBreakpointManagerGroup('manager-data-watchpoints', 'Data Watchpoints',
        (wpRows.length ? wpRows.join('') : '<div class="tvm-debug-empty-row">No data watchpoints.</div>') + watchpointControls) +
      this.renderBreakpointManagerGroup('manager-exception-breakpoints', 'Exception Breakpoints',
        (ebRows.length ? ebRows.join('') : '<div class="tvm-debug-empty-row">No exception breakpoints.</div>') + exceptionControls) +
      '</div>';

    var input = view.querySelector('.tvm-debug-watchpoint-input');
    var addBtn = view.querySelector('.tvm-debug-watchpoint-add-btn');
    function add() {
      var expr = (input && input.value || '').trim();
      if (!expr) return;
      self.addWatchpoint(expr);
      if (input) input.value = '';
    }
    if (addBtn) addBtn.addEventListener('click', add);
    if (input) input.addEventListener('keydown', function (e) { if (e.key === 'Enter') add(); });
    var editBtns = view.querySelectorAll('[data-bp-edit]');
    for (var i = 0; i < editBtns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          self.editBreakpointCondition(
            String(btn.getAttribute('data-path') || '').replace(/^\/tutorial\//, ''),
            +btn.getAttribute('data-line')
          );
        });
      })(editBtns[i]);
    }
    var removeBtns = view.querySelectorAll('[data-bp-remove]');
    for (var j = 0; j < removeBtns.length; j++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          self.removeBreakpoint(
            String(btn.getAttribute('data-path') || '').replace(/^\/tutorial\//, ''),
            +btn.getAttribute('data-line')
          );
        });
      })(removeBtns[j]);
    }
    var toggles = view.querySelectorAll('[data-wp-toggle]');
    for (var k = 0; k < toggles.length; k++) {
      (function (el) {
        el.addEventListener('change', function () { self.toggleWatchpoint(el.getAttribute('data-wp-toggle')); });
      })(toggles[k]);
    }
    var runBtns = view.querySelectorAll('[data-wp-run]');
    for (var r = 0; r < runBtns.length; r++) {
      (function (btn) {
        btn.addEventListener('click', function () { self.runForwardToWatchpoint(false, btn.getAttribute('data-wp-run')); });
      })(runBtns[r]);
    }
    var backBtns = view.querySelectorAll('[data-wp-back]');
    for (var b = 0; b < backBtns.length; b++) {
      (function (btn) {
        btn.addEventListener('click', function () { self.runBackToWatchpoint(btn.getAttribute('data-wp-back')); });
      })(backBtns[b]);
    }
    var wpRemoveBtns = view.querySelectorAll('[data-wp-remove]');
    for (var w = 0; w < wpRemoveBtns.length; w++) {
      (function (btn) {
        btn.addEventListener('click', function () { self.requestRemoveWatchpoint(btn.getAttribute('data-wp-remove')); });
      })(wpRemoveBtns[w]);
    }
    var runAll = view.querySelector('[data-wp-run-all]');
    if (runAll) runAll.addEventListener('click', function () { self.runForwardToWatchpoint(false, null); });
    var backAll = view.querySelector('[data-wp-back-all]');
    if (backAll) backAll.addEventListener('click', function () { self.runBackToWatchpoint(null); });

    var excToggles = view.querySelectorAll('[data-exc-toggle]');
    for (var et = 0; et < excToggles.length; et++) {
      (function (el) {
        el.addEventListener('change', function () { self.toggleExceptionBreakpoint(el.getAttribute('data-exc-toggle')); });
      })(excToggles[et]);
    }
    var excTypes = view.querySelectorAll('[data-exc-type]');
    for (var ety = 0; ety < excTypes.length; ety++) {
      (function (el) {
        var commit = function () { self.editExceptionBreakpoint(el.getAttribute('data-exc-type'), { type: el.value }); };
        el.addEventListener('change', commit);
        el.addEventListener('blur', commit);
        el.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } });
      })(excTypes[ety]);
    }
    var excModes = view.querySelectorAll('[data-exc-mode]');
    for (var em = 0; em < excModes.length; em++) {
      (function (el) {
        el.addEventListener('change', function () {
          if (!el.checked) return;
          self.editExceptionBreakpoint(el.getAttribute('data-exc-mode'), { mode: el.value });
        });
      })(excModes[em]);
    }
    var excRunBtns = view.querySelectorAll('[data-exc-run]');
    for (var er = 0; er < excRunBtns.length; er++) {
      (function (btn) {
        btn.addEventListener('click', function () { self.runForwardToExceptionBreakpoint(btn.getAttribute('data-exc-run')); });
      })(excRunBtns[er]);
    }
    var excBackBtns = view.querySelectorAll('[data-exc-back]');
    for (var eb2 = 0; eb2 < excBackBtns.length; eb2++) {
      (function (btn) {
        btn.addEventListener('click', function () { self.runBackToExceptionBreakpoint(btn.getAttribute('data-exc-back')); });
      })(excBackBtns[eb2]);
    }
    var excRemoveBtns = view.querySelectorAll('[data-exc-remove]');
    for (var ex = 0; ex < excRemoveBtns.length; ex++) {
      (function (btn) {
        btn.addEventListener('click', function () { self.removeExceptionBreakpoint(btn.getAttribute('data-exc-remove')); });
      })(excRemoveBtns[ex]);
    }
    var excAddBtn = view.querySelector('[data-exc-add]');
    if (excAddBtn) excAddBtn.addEventListener('click', function () { self.addExceptionBreakpoint({ mode: 'uncaught' }); });
    var excRunAll = view.querySelector('[data-exc-run-all]');
    if (excRunAll) excRunAll.addEventListener('click', function () { self.runForwardToExceptionBreakpoint(); });
    var excBackAll = view.querySelector('[data-exc-back-all]');
    if (excBackAll) excBackAll.addEventListener('click', function () { self.runBackToExceptionBreakpoint(); });

    this.wireBreakpointManagerGroups(view);
  };

  DebuggerController.prototype.renderBreakpointManagerGroup = function (key, label, bodyHtml) {
    var collapsed = this._isSubsectionCollapsed(key);
    return '<section class="tvm-debug-manager-group' + (collapsed ? ' collapsed' : '') + '" data-manager-group="' + this.escape(key) + '">' +
      '<button type="button" class="tvm-debug-manager-heading" data-manager-group-toggle="' + this.escape(key) + '">' +
      '<span class="tvm-debug-manager-chevron">▾</span>' +
      '<span>' + this.escape(label) + '</span>' +
      '</button>' +
      '<div class="tvm-debug-manager-group-body">' + bodyHtml + '</div>' +
      '</section>';
  };

  DebuggerController.prototype.wireBreakpointManagerGroups = function (view) {
    var self = this;
    var heads = view.querySelectorAll('[data-manager-group-toggle]');
    for (var i = 0; i < heads.length; i++) {
      (function (head) {
        head.addEventListener('click', function () {
          var key = head.getAttribute('data-manager-group-toggle');
          var group = head.closest && head.closest('.tvm-debug-manager-group');
          if (!group) return;
          var nowCollapsed = !group.classList.contains('collapsed');
          group.classList.toggle('collapsed', nowCollapsed);
          self._setSubsectionCollapsed(key, nowCollapsed);
        });
      })(heads[i]);
    }
  };

  DebuggerController.prototype.renderWatchValue = function (v) {
    if (!v) return '<span class="tvm-debug-watch-na">—</span>';
    if (v.error) return '<span class="tvm-debug-watch-error">' + this.escape(v.error) + '</span>';
    return this.escape(v.repr || v.preview || '');
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
      '<input type="range" class="tvm-debug-history-slider" min="0" max="' + (n - 1) + '" value="' + this.historyIdx + '" title="Execution history position" aria-label="Execution history position">' +
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
      var loc = this.displayLocationForSnapshot(s);
      var marker = (i === this.historyIdx) ? ' active' : '';
      var ev = s.event === 'call' ? '↳' : s.event === 'return' ? '↰' : s.event === 'exception' ? '⚠' : '·';
      html += '<div class="tvm-debug-history-item' + marker + '" data-i="' + i + '">' +
              '<span class="tvm-debug-history-i">' + (i + 1) + '</span>' +
              '<span class="tvm-debug-history-ev">' + ev + '</span>' +
              '<span class="tvm-debug-history-loc">' + this.escape(this.basename(loc.file)) + ':' + loc.line + '</span>' +
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

  DebuggerController.prototype.renderCurrentLine = function (revealLine) {
    if (!this.t.editor) return;
    if (this.historyIdx < 0) { this.clearCurrentLineDecoration(); return; }
    var snap = this.history[this.historyIdx];
    var frameIdx = this.selectedFrameIdx >= 0 ? this.selectedFrameIdx : (snap.stack.length - 1);
    var frame = this.displayFrameForSnapshot(snap, frameIdx);
    if (!frame) { this.clearCurrentLineDecoration(); return; }
    var line = frame.line;
    // Map worker filename (`/tutorial/foo.py`) to Monaco model URI
    var fname = frame.file.replace(/^\/tutorial\//, '');
    var activeBefore = this.t.activeFileName;
    var leftBefore = this.t._leftActiveFile;
    var rightBefore = this.t._rightActiveFile;
    var editor = this.ensureFrameFileVisible(fname);
    if (!editor) { this.clearCurrentLineDecoration(); return; }
    var activeChanged = this.t.activeFileName !== activeBefore ||
      this.t._leftActiveFile !== leftBefore ||
      this.t._rightActiveFile !== rightBefore;
    var model = editor.getModel && editor.getModel();
    if (!model || line < 1 || line > model.getLineCount()) {
      this.clearCurrentLineDecoration();
      return;
    }
    var rewound = this.historyIdx < this.liveIdx;
    var afterLine = !!(snap.watchpoint_origin && frameIdx === snap.stack.length - 1);
    var cls = afterLine ? 'tvm-debug-current-line-after'
      : (rewound ? 'tvm-debug-current-line-rewound' : 'tvm-debug-current-line');
    var glyph = afterLine ? 'tvm-debug-current-glyph-after'
      : (rewound ? 'tvm-debug-current-glyph-rewound' : 'tvm-debug-current-glyph');
    // If the current line sits on a breakpoint, use a combined chevron glyph
    // that paints the smaller red dot inside it. This applies to both forward
    // and rewound history cursors so the dot never grows under the chevron.
    var bpsForFile = this.breakpoints.get(frame.file);
    if (!afterLine && bpsForFile && bpsForFile.has(line)) {
      glyph = rewound ? 'tvm-debug-current-glyph-rewound-on-bp' : 'tvm-debug-current-glyph-on-bp';
    }
    var deco = [
      {
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          className: cls,
        },
      },
      {
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: false,
          glyphMarginClassName: glyph,
        },
      },
    ];
    this.clearCurrentLineDecoration();
    var prev = editor._dbgCurrentLineIds || [];
    editor._dbgCurrentLineIds = editor.deltaDecorations(prev, deco);
    this.currentLineDecoIds = editor._dbgCurrentLineIds;
    if (revealLine && editor.revealLineInCenterIfOutsideViewport) {
      editor.revealLineInCenterIfOutsideViewport(line);
    }
    if (activeChanged) this._publishActiveFile();
    // Repaint breakpoints so the dot on the current line shrinks (or restores
    // to full size if the current line moved away from a breakpoint).
    this.refreshBpDecorations();
  };

  DebuggerController.prototype.ensureFrameFileVisible = function (fname) {
    if (!fname || !this.t.editorModels || !this.t.editorModels[fname]) return null;
    var split = !!(this.t._splitActive && this.t.editor2);
    var pane = split && this.t._paneForFile ? this.t._paneForFile(fname) : 'left';
    var editor = split && pane === 'right' ? this.t.editor2 : this.t.editor;
    var entry = this.t.editorModels[fname];
    var current = this.activeFileForEditor(editor);
    if (current !== fname || editor.getModel() !== entry.model) {
      if (typeof this.t._setActiveFile === 'function') {
        this.t._setActiveFile(fname);
      } else {
        editor.setModel(entry.model);
      }
      if (this.t._renderTabs) this.t._renderTabs();
    }
    return split && pane === 'right' ? this.t.editor2 : this.t.editor;
  };

  DebuggerController.prototype.clearCurrentLineDecoration = function () {
    var editors = [this.t.editor, this.t.editor2];
    for (var i = 0; i < editors.length; i++) {
      var editor = editors[i];
      if (!editor) continue;
      editor._dbgCurrentLineIds = editor.deltaDecorations(editor._dbgCurrentLineIds || [], []);
    }
    this.currentLineDecoIds = [];
  };

  // Resolve render targets. Legacy panel keys map into section bodies of
  // the combined view (so renderVariables/renderCallStack/renderWatch/
  // renderHistory keep their existing single-target write pattern).
  DebuggerController.prototype.viewEl = function (panel) {
    var combinedSectionMap = {
      'dbg-vars':    'vars',
      'dbg-stack':   'stack',
      'dbg-watch':   'watch',
      'dbg-breakpoints': 'breakpoints',
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
    refreshBreakpoints: refreshBreakpoints,
  };
})();
