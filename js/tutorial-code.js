/**
 * TutorialCode — Unified interactive tutorial engine
 *
 * Supports three pluggable execution backends, selected via the YAML field
 * `backend`:
 *
 *   backend: v86          (default) Full Linux VM via v86 emulator
 *   backend: pyodide      Python in-browser via Pyodide + Web Worker.
 *                         Uses an output panel instead of a terminal.
 *   backend: webcontainer Node.js via StackBlitz WebContainers.
 *                         Requires Cross-Origin Isolation (COOP/COEP).
 *
 * The UI (Monaco editor, split panels, step navigation, quizzes, tests) is
 * identical across backends. Only the execution layer differs.
 *
 * This file is the single tutorial runtime, including the v86 backend.
 */
(function () {
  'use strict';

  // URL of this script — used to resolve sibling worker URLs (uml-worker.js)
  // even when tutorial-code.js is served from a non-standard path.
  var SCRIPT_URL = (typeof document !== 'undefined'
    && document.currentScript && document.currentScript.src) || '';

  // ---------------------------------------------------------------------------
  // CDN URLs
  // ---------------------------------------------------------------------------
  var CDN = {
    XTERM_JS: 'https://cdn.jsdelivr.net/npm/xterm@4.19.0/lib/xterm.min.js',
    XTERM_CSS: 'https://cdn.jsdelivr.net/npm/xterm@4.19.0/css/xterm.css',
    XTERM_FIT: 'https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.5.0/lib/xterm-addon-fit.min.js',
    MONACO_LOADER: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs/loader.min.js',
    MONACO_VS: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs',
    MARKED: 'https://cdn.jsdelivr.net/npm/marked@9.1.6/marked.min.js',
    WEBCONTAINER: 'https://cdn.jsdelivr.net/npm/@webcontainer/api@1.6.4/dist/index.js',
  };

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------
  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[src="' + url + '"]')) { resolve(); return; }
      var s = document.createElement('script');
      s.src = url; s.onload = resolve;
      s.onerror = function () { reject(new Error('Failed to load: ' + url)); };
      // For cross-origin scripts, request CORS so the response works under
      // COEP=credentialless (used by webcontainer + debugger tutorials). Public
      // CDNs (jsdelivr, unpkg, cdnjs) all serve `Access-Control-Allow-Origin: *`,
      // so this is safe everywhere — including non-COEP pages where the
      // attribute is simply ignored.
      try {
        var u = new URL(url, window.location.href);
        if (u.origin !== window.location.origin) s.crossOrigin = 'anonymous';
      } catch (e) { /* invalid URL — let load attempt fail naturally */ }
      document.head.appendChild(s);
    });
  }

  function loadCSS(url) {
    if (document.querySelector('link[href="' + url + '"]')) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = url;
    try {
      var u = new URL(url, window.location.href);
      if (u.origin !== window.location.origin) l.crossOrigin = 'anonymous';
    } catch (e) { /* ignore */ }
    document.head.appendChild(l);
  }

  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function shellQuote(s) {
    return "'" + String(s).replace(/'/g, "'\\''") + "'";
  }

  function b64EncodeUtf8(s) {
    var bytes = new TextEncoder().encode(String(s));
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function b64DecodeUtf8(s) {
    var bin = atob(String(s || ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }

  function tutorialShellBatch(commands) {
    return (commands || [])
      .map(function (cmd) { return String(cmd).replace(/^git /, 'git --no-pager '); })
      .join('\n');
  }

  var V86_SNAPSHOT_CACHE_VERSION = 4;

  function hashString(s) {
    var h = 2166136261;
    s = String(s || '');
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }

  function responseValidatorId(response) {
    if (!response || !response.headers) return '';
    return [
      response.headers.get('ETag') || '',
      response.headers.get('Last-Modified') || '',
      response.headers.get('Content-Length') || ''
    ].join('|');
  }

  var LANG_MAP = {
    sh: 'shell-sebook', bash: 'shell-sebook', zsh: 'shell-sebook',
    py: 'python', js: 'javascript', jsx: 'jsx', json: 'json',
    ts: 'typescript', tsx: 'jsx',
    yml: 'yaml', yaml: 'yaml', md: 'markdown',
    css: 'css', txt: 'plaintext', c: 'c', h: 'c', cpp: 'cpp',
    makefile: 'makefile', Makefile: 'makefile',
    pl: 'prolog', pro: 'prolog',
    java: 'java',
  };

  function detectLanguage(filename) {
    if (/^[Mm]akefile$/.test(filename)) return 'makefile';
    var ext = filename.split('.').pop().toLowerCase();
    return LANG_MAP[ext] || 'plaintext';
  }

  // ---------------------------------------------------------------------------
  // TutorialCode — constructor
  // ---------------------------------------------------------------------------
  function TutorialCode(element, options) {
    this.root = typeof element === 'string'
      ? document.querySelector(element) : element;
    if (!this.root) throw new Error('TutorialCode: container element not found');

    var backend = options.backend || 'v86';

    this.config = {
      backend: backend,
      v86Path: options.v86Path || '/assets/v86',
      vmPath: options.vmPath || '/vm/dist',
      // 192 MB strikes the right balance: enough headroom for Linux to
      // unpack the ~30 MB-compressed initramfs into tmpfs (which expands to
      // ~120 MB) without panicking, while still saving ~25% on save_state /
      // restore_state cost vs 256. 128 MB triggers "Initramfs unpacking
      // failed: write error" → kernel panic; don't lower further without
      // also slimming the rootfs.
      memoryMB: options.memoryMB || 192,
      fontSize: options.fontSize || 14,
      // Restore from a pre-booted snapshot (gzipped) if available, skipping
      // the kernel boot. Set useSnapshot: false to force a fresh boot.
      useSnapshot: options.useSnapshot !== false,
      snapshotName: options.snapshotName || 'state.bin.gz',
      workerPath: options.workerPath || '/js/pyodide-worker.js',
      sqlWorkerPath: options.sqlWorkerPath || '/js/sql-worker.js',
      prologWorkerPath: options.prologWorkerPath || '/js/prolog-worker.js',
      javaWorkerPath: options.javaWorkerPath || '/js/java-worker.js',
      // Derived flags
      useTerminal: (backend === 'v86' || (backend === 'webcontainer' && options.terminal === true)),
      usePreview: (backend === 'react'),    // live iframe preview for React tutorials
      umlPopupUrl: options.umlPopupUrl || '/uml-popup.html',
      // Editor IDE features (opt-in via YAML).
      //   linter: true / "pyflakes"  → live diagnostics in Monaco gutter
      //   gitGutter: true            → +/-/~ markers next to changed lines
      //                                (requires git_graph; auto-disabled if absent)
      enableLinter:  options.linter === true || options.linter === 'pyflakes' ||
                     options.linter === 'on'  || options.linter === 'enabled',
      enableGitGutter: !!options.gitGutter && !!options.gitGraph,
    };

    this.steps = options.steps || [];
    this.setupCommands = options.setupCommands || [];
    this.requireTests = options.requireTests || false;
    this.instructorMode = options.instructorMode || false;
    this.disableQuiz = options.disableQuiz || false;
    this.lectureMode = options.lectureMode || false;
    this.tutorialId = options.tutorialId || 'default';
    this._stepsPassed = new Set();
    this._quizPassed = new Set();
    this._stepsUnlocked = new Set([0]);   // step 0 is always unlocked
    this._stepsVisited = new Set();      // tracks first-time entry
    this.currentStep = -1;
    // autosaveType: falsy = disabled, "files" = save/restore files only (default),
    //              "commands-and-files" = replay solution commands on restore
    this.autosaveType = options.autosaveType || null;   // tutorial-level mode
    this.allowAutosave = !!this.autosaveType;            // computed convenience flag
    // resetType: "files" = reset only starter files (default),
    //            "commands" = replay all prior solutions + setup_commands (like autosave restore)
    this.resetType = options.resetType || 'files';
    this.autoSaveEnabled = this.allowAutosave;             // toggled from navbar
    this._originalContent = {};           // tracks original file content for dirty detection
    this.booted = false;
    this._httpEnabled = this.steps.some(function (s) { return s.http_client; });

    // v86 state
    this.emulator = null;
    this._muteCount = 0;           // >0 ⇒ suppress serial→xterm output
    this._executableFiles = new Set();
    this._inputLine = '';
    this._silentQueue = [];          // queued _runSilent Promises
    this._silentRunning = false;      // true while a silent cmd is in-flight
    this._silentListeners = [];       // in-flight _runSilent listener registrations
    this._resetInProgress = false;    // guard against concurrent resetStep() calls
    this._visFilterMarker = null;     // string to suppress from xterm output
    this._visFilterBuf = '';       // partial-match buffer for _visFilterMarker
    this._rpcPending = {};            // virtio-console RPC id -> callbacks
    this._rpcBuf = '';                // partial virtio-console line buffer
    this._rpcSeq = 0;
    this._rpcAvail = undefined;
    this._rpcAvailPromise = null;
    this._rpcNegativeUntil = 0;
    this._rpcListenerInstalled = false;
    this._backgroundShellCwd = null;
    this._snapshotDBPromise = null;
    this._snapshotCacheIdentity = null;
    this._vmSnapshotAssetId = '';

    // xterm state
    this.term = null;
    this.fitAddon = null;
    this._terminalReadyForInput = false; // true once the prompt is visible to the student
    this._legacySerialBackgroundSkipLogged = false;

    // Monaco state
    this.editor = null;
    this.editorModels = {};
    this.activeFileName = null;
    this._suppressAutoSave = false;

    // Split-editor state (two Monaco editors side-by-side: tests left, code right).
    // Enabled per-tutorial via `editor_split: true` in YAML. Students can toggle
    // between split and unified-tabs view; the preference is persisted per tutorial.
    this.editorSplitSupported = !!options.editorSplit;
    this._splitActive = this.editorSplitSupported;
    if (this.editorSplitSupported) {
      try {
        var _splitPref = localStorage.getItem('tutorial-editor-split-' + this.tutorialId);
        if (_splitPref === 'true') this._splitActive = true;
        else if (_splitPref === 'false') this._splitActive = false;
      } catch (e) { /* localStorage unavailable — keep default */ }
    }
    this.editor2 = null;                // secondary Monaco editor (right pane)
    this._leftActiveFile = null;         // file shown in left pane
    this._rightActiveFile = null;        // file shown in right pane
    this._filePaneOverrides = {};        // filename → 'left'|'right' (from YAML `pane:`)

    // Per-tutorial override for the output/terminal panel's height (e.g. "40%",
    // "320px"). When set, the bottom panel uses this as its flex-basis and the
    // editor panel fills the rest. Tutorials that want more runtime output
    // visible (like TDD, which shows multiple passing/failing tests) opt in.
    this.outputHeight = options.outputHeight || null;

    // Reverse sync (v86 / webcontainer)
    this._reverseSyncTimer = null;
    this._reverseSyncBusy = false;

    // Test runner
    this._testListening = false;
    this._testBuffer = '';
    this._testResults = [];
    this._testCallbacks = [];

    // Pyodide worker state
    this._worker = null;
    this._workerMsgId = 0;
    this._workerCallbacks = {};

    // WebContainers state
    this._webcontainer = null;
    this._shellProcess = null;
    this._shellWriter = null;
    this._webcontainerRunProcess = null;
    this._webcontainerServerUrls = {};
    this._webcontainerServerReadyUnsub = null;

    // Git graph state
    this.gitGraphPath = options.gitGraphPath || null;
    this.gitSetupCommands = options.gitSetupCommands || [];
    this._gitGraph = null;
    this._currentView = 'editor';
    this._gitGraphAutoRefreshTimer = null;
    this._gitGraphRefreshing = false;
    this._lastGitGraphStateText = null;
    this._gitGraphStateDirty = false;
    this._gitGraphRefreshPending = false;
    this._gitGraphRefreshGeneration = 0;
    this._gitGraphHookInstalled = false;
    this._gitGraphHookMode = null;
    this._promptDetectBuf = '';
    this._promptRedrawTimer = null;
    this._backgroundSyncPauseCount = 0;
    this._restartFileWatchOnResume = false;

    // User-command listener (git-playground pattern). When configured globally
    // or per-step, each user-typed terminal command is piped (as stdin) to
    // the listener shell expression via a PROMPT_COMMAND hook installed in
    // _setupFilesystem — backend-run commands are excluded by HISTIGNORE so
    // only real user input flows through.
    this.userCommandListener = options.userCommandListener || null;
    this._activeUserCmdListener = '';

    // Post-fileload setup commands. Run silently AFTER a step's files have
    // been synced to the VM (first-visit, reset, and autosave-restore paths).
    // Lets a tutorial like git-playground replay a saved script on top of a
    // freshly-restored VM.
    this.postFileloadSetupCommands = options.postFileloadSetupCommands || [];

    // Per-step VM snapshot cache (v86 only, in-memory for this session).
    // Keyed by step index; value is a v86 save_state() result. Populated
    // whenever we finish producing the "clean entry state" of a step —
    // first-visit setup_commands completing, or a reset/restore replay
    // finishing. Reset / autosave-restore check this first and restore
    // directly instead of replaying prior steps.
    this._stepEntrySnapshots = {};

    // UML diagram state
    this._umlDiagramEnabled = options.uml_diagram || false;
    this._umlPositionRight = options.uml_position === 'right'; // diagram in right bottom tab
    this._umlPositionBelow = options.uml_position === 'below'; // diagram below instructions (always visible)
    this._umlPositionBottomLeft = options.uml_position === 'bottom-left'; // diagram pane below left panel (always visible)
    // bottom-right SWAPS the UML and Output panels: UML goes below editors (workspace),
    // and Output moves below instructions (left column). Use when the live class
    // diagram is more important than test output during the work cycle.
    // Independent of UML positioning: hoist the Output panel into the left column
    // (below instructions). When combined with `uml_position: 'right'`, the right
    // tabbed panel reduces to UML-only (no Output tab/view), giving you a clean
    // Output-bottom-left / UML-bottom-right layout.
    this._outputPositionBottomLeft = options.output_position === 'bottom-left';
    // Optional override of the Run button label (e.g. "Test" for pytest-driven tutorials).
    this._runLabel = options.run_label || 'Run';
    // Auto-pytest mode: when true and backend is pyodide, clicking Run on a
    // file matching test_*.py / *_test.py invokes `pytest.main([path, "-v"])`
    // instead of exec'ing the file as a script. The Run button also relabels
    // itself to "Test" automatically when the active file is a test file.
    this._pytestMode = !!options.pytest;
    this.playwrightConfig = options.playwright
      ? (typeof options.playwright === 'object' ? options.playwright : { enabled: true })
      : null;
    this._playwrightMode = !!(this.playwrightConfig && this.playwrightConfig.enabled !== false);
    this._umlDefaultView = options.uml_default_view || false; // UML tab shown by default instead of Output
    this._umlContainer = null;
    this._umlContentEl = null;
    this._umlRefreshTimer = null;
    this._umlActiveType = options.uml_default_type === 'sequence' ? 'sequence' : 'class'; // 'class' or 'sequence'
    this._umlWatchedFiles = [];         // Set per-step from YAML uml_files
    this._umlLanguage = 'python';      // 'python' or 'js' — auto-detected from file extensions
    this._umlClassLayoutPreference = options.uml_class_layout || 'portrait';
    this._umlClassLayoutDefault = this._umlClassLayoutPreference; // global fallback for per-step overrides
    this._umlHideFlags = [];             // Per-step hide flags: ['visibility'], ['multiplicity'], etc.
    this._umlLastDiagrams = null;       // {classDiagram, sequenceDiagram}
    this._umlAnalysisRequestId = 0;     // monotonic id; later analyses supersede earlier ones
    this._umlRenderRequestId = 0;       // monotonic id; later renders supersede earlier ones
    this._umlViewActive = false;        // true when UML tab is selected
    this._umlMermaidCounter = 0;        // unique id for mermaid.render calls
    this._umlZoom = 1;                  // current zoom level (inline view)
    this._umlFsZoom = 1;               // current zoom level (fullscreen view)
    this._umlFullscreenEl = null;       // fullscreen overlay element
    this._umlFsContentEl = null;        // fullscreen diagram content element
    this._umlCustomColor = this._loadUMLColorCookie(); // user-chosen accent color (null = default)
    this._umlChannel = null;       // BroadcastChannel for popup sync
    this._umlPopupWindow = null;   // reference to pop-out window

    // React preview state
    this._previewFrame = null;
    this._previewTestBtn = null;
    this._reactRebuildTimer = null;

    // Browser JS runner state
    this._jsRunnerFrame = null;
    this._jsRunnerMsgId = 0;

    // Time-travel debugger opt-in. Supported backends:
    //   - pyodide (Python, via bdb + sys.settrace, in a Web Worker + SAB)
    //   - webcontainer (Node.js, via in-process V8 inspector + JSON-over-stdio)
    //   - browser (in-page sandboxed JS, via acorn AST instrumentation +
    //     sibling iframe + SAB for sync pause)
    // When false, no debugger code is loaded — see js/debugger/main.js. When
    // true, _buildUI() lazy-loads the debugger module after the base UI is
    // constructed.
    this.debuggerEnabled = !!options.debugger && (
      backend === 'pyodide' || backend === 'webcontainer' || backend === 'browser'
    );
    this.debuggerOptions = options.debuggerOptions || {};
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------
  TutorialCode.prototype.start = function () {
    var self = this;
    this._buildUI();
    this._showLoading('Loading tutorial environment…');

    return this._loadDependencies()
      .then(function () {
        if (self.config.useTerminal) {
          self._showLoading('Starting terminal…');
          self._initTerminal();
        }
        return self._initEditor();
      })
      .then(function () {
        return self._initBackend();
      })
      .then(function () {
        // Time-travel debugger lazy-load. When `debugger: true` in YAML, fetch
        // the debugger module + stylesheet on demand and let it attach to the
        // already-built UI + Monaco instance + worker. When false, this is a no-op.
        if (self.debuggerEnabled) return self._loadDebuggerModule();
      })
      .then(function () {
        // Watch for dark-mode class changes and re-theme Monaco + terminal (all backends).
        // Also rebuild the React iframe preview so its body colours update.
        if (window.MutationObserver) {
          var mo = new MutationObserver(function () {
            self._applyTheme(self._isDarkMode());
            if (self.config.usePreview) self._rebuildReactPreview();
          });
          mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        }
        if (self.steps.length > 0) {
          // URL hash (e.g. #express-routing) is explicit user intent — always honour it
          var hashStep = self._resolveStepFromHash();

          // Respect the user's navbar toggle preference (persisted as 'tutorial-autosave').
          // Default is on; only skip restore when the user has explicitly set it to 'false'.
          var userAutosavePref = localStorage.getItem('tutorial-autosave');
          var userAutosaveOn = userAutosavePref !== 'false';
          if (!userAutosaveOn) self.autoSaveEnabled = false; // keep in sync before navbar wires up
          var saved = (hashStep < 0 && self.allowAutosave && userAutosaveOn) ? self._loadSavedProgress() : null;
          if (saved) {
            if (saved.stepsUnlocked) self._stepsUnlocked = new Set(saved.stepsUnlocked);
            // Always ensure all steps up to the saved step are unlocked
            // (handles old saves AND incomplete unlock data)
            for (var si = 0; si <= saved.step; si++) self._stepsUnlocked.add(si);
            if (saved.stepsVisited) self._stepsVisited = new Set(saved.stepsVisited);
            if (saved.stepsPassed) self._stepsPassed = new Set(saved.stepsPassed);
            if (saved.quizPassed) self._quizPassed = new Set(saved.quizPassed);
            // Mark saved step as already visited so loadStep won't override files
            self._stepsVisited.add(saved.step);
            // Suppress autosave for the entire restore sequence so loadStep's
            // end-of-step _autoSaveProgress cannot clobber localStorage with
            // starter-file content before the saved files have been applied.
            self._suppressAutoSave = true;
            self._pauseBackgroundSync();
            self.loadStep(saved.step);
            if (self.autosaveType === 'commands-and-files') {
              // _restoreCommandsAndFiles re-enables autosave after _applySavedFiles
              self._restoreCommandsAndFiles(saved).then(function () {
                var curStep = self.steps[saved.step];
                return self._runStepDir(curStep).then(function () {
                  return self._ensureGitGraphPromptHook();
                }).then(function () {
                  return self._refreshPrompt();
                }).then(function () {
                  self._hideLoading();
                  self._resumeBackgroundSync();
                  self._refreshGitGraph();
                });
              }, function (err) {
                self._resumeBackgroundSync();
                self._showError('Failed to restore progress: ' + (err && err.message || err));
                console.error('TutorialCode restore error:', err);
              });
            } else {
              self._applySavedFiles(saved.files, saved.activeFile).then(function () {
                self._suppressAutoSave = false;
                // Persist the correctly-restored state immediately
                self._autoSaveProgress();
                var curStep = self.steps[saved.step];
                return self._runStepDir(curStep).then(function () {
                  return self._ensureGitGraphPromptHook();
                }).then(function () {
                  return self._refreshPrompt();
                }).then(function () {
                  self._hideLoading();
                  self._resumeBackgroundSync();
                  self._refreshGitGraph();
                });
              }, function (err) {
                self._resumeBackgroundSync();
                self._showError('Failed to restore progress: ' + (err && err.message || err));
                console.error('TutorialCode restore error:', err);
              });
            }
          } else {
            if (hashStep >= 0) {
              // Unlock all steps up to the hash target so loadStep doesn't reject
              for (var hi = 0; hi <= hashStep; hi++) self._stepsUnlocked.add(hi);
            }
            self.loadStep(hashStep >= 0 ? hashStep : 0);
            Promise.resolve(self._refreshPrompt()).then(function () {
              self._hideLoading();
            });
          }
        } else {
          self._hideLoading();
        }
      })
      .catch(function (err) {
        self._showError('Failed to start tutorial: ' + err.message);
        console.error('TutorialCode error:', err);
      });
  };

  // ---------------------------------------------------------------------------
  // v86 snapshot cache (IndexedDB)
  // ---------------------------------------------------------------------------

  TutorialCode.prototype._snapshotCacheKey = function (kind, step) {
    if (this.config.backend !== 'v86') return null;
    if (typeof indexedDB === 'undefined') return null;
    if (!this._snapshotCacheIdentity) {
      var stepShape = (this.steps || []).map(function (s) {
        return {
          title: s.title || '',
          files: (s.files || []).map(function (f) {
            return [f.path, f.content || '', f.language || '', !!f.persistent].join('\u0001');
          }),
          setup: s.setup_commands || [],
          post: s.post_fileload_setup || [],
          solutionFiles: ((s.solution && s.solution.files) || []).map(function (f) {
            return [f.path, f.content || '', f.language || ''].join('\u0001');
          }),
          solutionCommands: (s.solution && s.solution.commands) || [],
        };
      });
      this._snapshotCacheIdentity = hashString(JSON.stringify({
        version: V86_SNAPSHOT_CACHE_VERSION,
        tutorialId: this.tutorialId,
        memoryMB: this.config.memoryMB,
        snapshotName: this.config.snapshotName,
        vmSnapshotAssetId: this._vmSnapshotAssetId || '',
        setupCommands: this.setupCommands,
        steps: stepShape,
      }));
    }
    return [
      'v86',
      V86_SNAPSHOT_CACHE_VERSION,
      this.tutorialId,
      this.config.memoryMB,
      this.config.snapshotName,
      this._snapshotCacheIdentity,
      kind,
      step == null ? '' : step
    ].join('|');
  };

  TutorialCode.prototype._openSnapshotDB = function () {
    if (typeof indexedDB === 'undefined') return Promise.resolve(null);
    if (this._snapshotDBPromise) return this._snapshotDBPromise;
    this._snapshotDBPromise = new Promise(function (resolve) {
      var req;
      try {
        req = indexedDB.open('sebook-tutorial-vm-snapshots', 1);
      } catch (e) {
        resolve(null);
        return;
      }
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('snapshots')) {
          db.createObjectStore('snapshots', { keyPath: 'key' });
        }
      };
      req.onerror = function () { resolve(null); };
      req.onsuccess = function () { resolve(req.result); };
    });
    return this._snapshotDBPromise;
  };

  TutorialCode.prototype._packSnapshotState = function (state) {
    if (!state) return Promise.resolve(null);
    if (typeof CompressionStream === 'undefined') {
      return Promise.resolve({ format: 'raw', data: state.slice ? state.slice(0) : state });
    }
    try {
      var stream = new Blob([state]).stream().pipeThrough(new CompressionStream('gzip'));
      return new Response(stream).arrayBuffer().then(function (buf) {
        return { format: 'gzip', data: buf };
      });
    } catch (e) {
      return Promise.resolve({ format: 'raw', data: state.slice ? state.slice(0) : state });
    }
  };

  TutorialCode.prototype._unpackSnapshotState = function (record) {
    if (!record || !record.data) return Promise.resolve(null);
    if (record.format !== 'gzip') return Promise.resolve(record.data);
    if (typeof DecompressionStream === 'undefined') return Promise.resolve(null);
    try {
      var stream = new Blob([record.data]).stream().pipeThrough(new DecompressionStream('gzip'));
      return new Response(stream).arrayBuffer();
    } catch (e) {
      return Promise.resolve(null);
    }
  };

  TutorialCode.prototype._loadCachedSnapshot = function (kind, step) {
    var key = this._snapshotCacheKey(kind, step);
    if (!key) return Promise.resolve(null);
    var self = this;
    return this._openSnapshotDB().then(function (db) {
      if (!db) return null;
      return new Promise(function (resolve) {
        var tx;
        try { tx = db.transaction('snapshots', 'readonly'); }
        catch (e) { resolve(null); return; }
        var req = tx.objectStore('snapshots').get(key);
        req.onerror = function () { resolve(null); };
        req.onsuccess = function () {
          var rec = req.result;
          if (!rec || rec.version !== V86_SNAPSHOT_CACHE_VERSION) {
            resolve(null);
            return;
          }
          self._unpackSnapshotState(rec).then(resolve, function () { resolve(null); });
        };
      });
    }).catch(function () { return null; });
  };

  TutorialCode.prototype._storeCachedSnapshot = function (kind, step, state) {
    var key = this._snapshotCacheKey(kind, step);
    if (!key || !state) return Promise.resolve();
    var self = this;
    return this._openSnapshotDB().then(function (db) {
      if (!db) return null;
      return self._packSnapshotState(state).then(function (packed) {
        if (!packed || !packed.data) return null;
        return new Promise(function (resolve) {
          var tx;
          try { tx = db.transaction('snapshots', 'readwrite'); }
          catch (e) { resolve(null); return; }
          tx.objectStore('snapshots').put({
            key: key,
            version: V86_SNAPSHOT_CACHE_VERSION,
            tutorialId: self.tutorialId,
            kind: kind,
            step: step,
            format: packed.format,
            data: packed.data,
            createdAt: Date.now()
          });
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function () { resolve(null); };
          tx.onabort = function () { resolve(null); };
        });
      });
    }).catch(function () { return null; });
  };

  TutorialCode.prototype._isBackgroundSyncPaused = function () {
    return this._backgroundSyncPauseCount > 0;
  };

  TutorialCode.prototype._markGitGraphStateDirty = function () {
    if (!this.gitGraphPath) return;
    this._gitGraphStateDirty = true;
    this._gitGraphRefreshPending = true;
    this._gitGraphRefreshGeneration++;
    this._gitGraphRefreshing = false;
    this._lastGitGraphStateText = null;
    if (this.gitGraphContainerEl) this.gitGraphContainerEl.innerHTML = '';
  };

  TutorialCode.prototype._pauseBackgroundSync = function () {
    this._backgroundSyncPauseCount++;
    this._markGitGraphStateDirty();
    clearTimeout(this._gitGraphAutoRefreshTimer);
    clearTimeout(this._gitGutterPromptTimer);
    if (this._reverseSyncTimer) {
      this._restartFileWatchOnResume = true;
      this._stopFileWatch();
    }
  };

  TutorialCode.prototype._resumeBackgroundSync = function () {
    if (this._backgroundSyncPauseCount > 0) this._backgroundSyncPauseCount--;
    if (this._backgroundSyncPauseCount !== 0) return;
    var refreshGraph = this._gitGraphRefreshPending || this._gitGraphStateDirty;
    this._gitGraphRefreshPending = false;
    if (this._restartFileWatchOnResume && this.config.backend === 'v86' && this.booted) {
      this._restartFileWatchOnResume = false;
      this._startFileWatch(2000);
    }
    if (refreshGraph && this.gitGraphPath && this.booted) {
      this._refreshGitGraph();
    }
  };

  TutorialCode.prototype.destroy = function () {
    this._stopFileWatch();
    if (this.emulator) { this.emulator.stop(); this.emulator = null; }
    if (this._worker) { this._worker.terminate(); this._worker = null; }
    if (this._shellProcess) { this._shellProcess = null; }
    if (this.editor) { this.editor.dispose(); this.editor = null; }
    if (this.editor2) { this.editor2.dispose(); this.editor2 = null; }
    for (var n in this.editorModels) {
      if (this.editorModels.hasOwnProperty(n)) this.editorModels[n].model.dispose();
    }
    this.editorModels = {};
    if (this.term) { this.term.dispose(); this.term = null; }
  };

  // ---------------------------------------------------------------------------
  // UML Color Cookie Helpers
  // ---------------------------------------------------------------------------
  TutorialCode.prototype._loadUMLColorCookie = function () {
    try {
      var match = document.cookie.match(/(?:^|;\s*)uml-accent-color=([^;]+)/);
      return match ? decodeURIComponent(match[1]) : null;
    } catch (e) { return null; }
  };

  TutorialCode.prototype._saveUMLColorCookie = function (color) {
    try {
      var maxAge = 60 * 60 * 24 * 365; // 1 year
      document.cookie = 'uml-accent-color=' + encodeURIComponent(color) +
        '; max-age=' + maxAge + '; path=/; SameSite=Lax';
    } catch (e) { }
  };

  TutorialCode.prototype._clearUMLColorCookie = function () {
    try {
      document.cookie = 'uml-accent-color=; max-age=0; path=/; SameSite=Lax';
    } catch (e) { }
  };

  /**
   * Apply the current custom color (or default) to a diagram container by setting
   * CSS custom properties, then re-render by calling the given render function.
   */
  TutorialCode.prototype._applyUMLColors = function (containerEl) {
    if (!containerEl) return;
    var color = this._umlCustomColor;
    if (color) {
      // Derive lighter shades from the chosen hex color for fill / header
      var r = parseInt(color.slice(1, 3), 16);
      var g = parseInt(color.slice(3, 5), 16);
      var b = parseInt(color.slice(5, 7), 16);
      var headerFill = 'rgba(' + r + ',' + g + ',' + b + ',0.18)';
      var secondaryFill = 'rgba(' + r + ',' + g + ',' + b + ',0.09)';
      var labelBg = 'rgba(255,255,255,0.94)';
      var labelStroke = 'rgba(' + r + ',' + g + ',' + b + ',0.25)';
      containerEl.style.setProperty('--uml-stroke', color);
      containerEl.style.setProperty('--uml-line', color);
      containerEl.style.setProperty('--uml-header-fill', headerFill);
      containerEl.style.setProperty('--uml-secondary-fill', secondaryFill);
      containerEl.style.setProperty('--uml-label-stroke', labelStroke);
      containerEl.style.setProperty('--uml-label-fill', labelBg);
    } else {
      containerEl.style.removeProperty('--uml-stroke');
      containerEl.style.removeProperty('--uml-line');
      containerEl.style.removeProperty('--uml-header-fill');
      containerEl.style.removeProperty('--uml-secondary-fill');
      containerEl.style.removeProperty('--uml-label-stroke');
      containerEl.style.removeProperty('--uml-label-fill');
    }
  };

  /** Sync all color inputs in the UI to the current color value */
  TutorialCode.prototype._syncColorInputs = function () {
    var inputs = this.root ? this.root.querySelectorAll('.tvm-diagram-color-input') : [];
    var val = this._umlCustomColor || '#4060a0';
    for (var i = 0; i < inputs.length; i++) inputs[i].value = val;
    // Also sync any that escaped to body (fullscreen overlay)
    var fsInputs = document.querySelectorAll('.tvm-diagram-fs-color-input');
    for (var j = 0; j < fsInputs.length; j++) fsInputs[j].value = val;
  };

  // ---------------------------------------------------------------------------
  // UI Construction
  // ---------------------------------------------------------------------------
  TutorialCode.prototype._buildUI = function () {
    this.root.classList.add('tvm-root');
    if (this.editorSplitSupported && this._splitActive) {
      this.root.classList.add('tvm-split-layout-three-col');
    }

    var terminalHtml;
    if (this.config.useTerminal) {
      // Terminal (xterm-backed: v86 / webcontainer) is intentionally NOT
      // popout-able — a true detach would require routing keystrokes back to
      // main and replicating xterm's escape-sequence handling in the popup.
      // Skipping for now; pop the output PRE for non-xterm backends instead.
      terminalHtml = '<div class="tvm-terminal-panel">' +
        '<div class="tvm-terminal-header"><span>Terminal</span></div>' +
        '<div class="tvm-terminal-container"></div>' +
        '</div>';
    } else if (this.config.usePreview) {
      terminalHtml = '<div class="tvm-preview-panel">' +
        '<div class="tvm-preview-header">' +
        '<span>Live Preview</span>' +
        '<div class="tvm-preview-actions">' +
        (this._playwrightMode ? '<button class="tvm-preview-test-btn" title="Run Playwright tests from the test files">✓ Test</button>' : '') +
        '<button class="tvm-refresh-btn" title="Rebuild preview">\u21bb Refresh</button>' +
        '<button class="tvm-output-popout-btn" title="Open preview in separate window">\u29c9<span class="sr-only">Open preview in separate window</span></button>' +
        '</div></div>' +
        '<div class="tvm-preview-test-panel" style="display:none"></div>' +
        '<div class="tvm-preview-container">' +
        '<iframe class="tvm-preview-frame" title="Live preview" aria-label="Live preview" data-no-tooltip="true" sandbox="allow-scripts allow-same-origin"></iframe>' +
        '</div></div>';
    } else if (this._umlPositionRight && this._umlDiagramEnabled && !this._outputPositionBottomLeft) {
      // Right-positioned UML, default Output placement: output + UML share a
      // tabbed bottom panel in the workspace. (When `output_position: bottom-left`
      // is ALSO set, this branch is skipped — the simple Output panel below is
      // built for the left column, and a standalone UML pane is rendered in
      // the workspace bottom-pane block further down.)
      var umlRightToolbar =
        '<div class="tvm-diagram-toolbar">' +
        '<button class="tvm-diagram-type-btn' + (this._umlActiveType === 'class' ? ' active' : '') + '" data-type="class" aria-pressed="' + (this._umlActiveType === 'class' ? 'true' : 'false') + '">Class Diagram</button>' +
        '<button class="tvm-diagram-type-btn' + (this._umlActiveType === 'sequence' ? ' active' : '') + '" data-type="sequence" aria-pressed="' + (this._umlActiveType === 'sequence' ? 'true' : 'false') + '">Sequence Diagram</button>' +
        '<div class="tvm-diagram-zoom-controls">' +
        '<button class="tvm-diagram-zoom-btn" data-zoom="out" title="Zoom out">\u2212</button>' +
        '<span class="tvm-diagram-zoom-label">100%</span>' +
        '<button class="tvm-diagram-zoom-btn" data-zoom="in" title="Zoom in" aria-label="Zoom in">+</button>' +
        '<button class="tvm-diagram-zoom-btn" data-zoom="reset" title="Reset zoom">\u2715</button>' +
        '</div>' +
        '<button class="tvm-diagram-fullscreen-btn" title="Fullscreen">\u26f6</button>' +
        '<button class="tvm-diagram-popout-btn" title="Open in separate window">\u29c9</button>' +
        '<button class="tvm-diagram-refresh-btn" title="Re-analyze code">\u21bb Refresh</button>' +
        '<label class="tvm-diagram-color-btn" title="Diagram accent color"><span class="sr-only">Diagram accent color</span><input type="color" class="tvm-diagram-color-input" aria-label="Diagram accent color"></label>' +
        '<button class="tvm-diagram-color-reset-btn" title="Reset to default color">\u21bb</button>' +
        '</div>';

      terminalHtml =
        '<div class="tvm-output-panel tvm-right-tabbed-panel">' +
        '<div class="tvm-right-tab-bar">' +
        '<button class="tvm-right-tab active" data-panel="output"><i class="fa fa-terminal"></i> Output</button>' +
        '<button class="tvm-right-tab" data-panel="uml" style="display:none"><i class="fa fa-diagram-project"></i> UML Diagram</button>' +
        '</div>' +
        '<div class="tvm-output-view">' +
        '<div class="tvm-output-header">' +
        '<div class="tvm-output-actions">' +
        '<span class="tvm-args-label" style="display:none; font-size:11px; color:#888; font-family:\'Fira Code\', \'Cascadia Code\', Menlo, monospace;">args:</span>' +
        '<input type="text" class="tvm-args-input" placeholder="Program args..." style="display:none;" title="Command-line arguments (sys.argv)" aria-label="Command-line arguments (sys.argv)" />' +
        '<select class="tvm-stream-filter" style="display:none;" title="Filter output streams" aria-label="Filter output streams">' +
        '<option value="all">All Output</option>' +
        '<option value="stdout">Stdout Only</option>' +
        '<option value="stderr">Stderr Only</option>' +
        '</select>' +
        '<button class="tvm-run-btn" title="Run current file (Ctrl+Enter)">&#9654; ' + this._runLabel + '</button>' +
        '<button class="tvm-stop-btn" title="Stop execution" style="display:none;">&#9208; Stop</button>' +
        '<button class="tvm-clear-btn" title="Clear output">Clear</button>' +
        '<button class="tvm-output-popout-btn" title="Open output in separate window">⧉<span class="sr-only">Open output in separate window</span></button>' +
        '</div></div>' +
        '<div class="tvm-output-container"><pre class="tvm-output-pre"></pre></div>' +
        '</div>' +
        '<div class="tvm-uml-right-view" style="display:none">' +
        umlRightToolbar +
        '<div class="tvm-diagram-content"></div>' +
        '</div>' +
        '</div>';
    } else {
      // Build the standard Output view body (used both standalone and inside
      // the Output↔Terminal tabbed panel for pyodide+git tutorials).
      var outputBody =
        '<div class="tvm-output-header">' +
        '<span>Output</span>' +
        '<div class="tvm-output-actions">' +
        '<span class="tvm-args-label" style="display:none; font-size:11px; color:#888; font-family:\'Fira Code\', \'Cascadia Code\', Menlo, monospace;">args:</span>' +
        '<input type="text" class="tvm-args-input" placeholder="Program args..." style="display:none;" title="Command-line arguments (sys.argv)" aria-label="Command-line arguments (sys.argv)" />' +
        '<select class="tvm-stream-filter" style="display:none;" title="Filter output streams" aria-label="Filter output streams">' +
        '<option value="all">All Output</option>' +
        '<option value="stdout">Stdout Only</option>' +
        '<option value="stderr">Stderr Only</option>' +
        '</select>' +
        '<button class="tvm-run-btn" title="Run current file (Ctrl+Enter)">&#9654; ' + this._runLabel + '</button>' +
        '<button class="tvm-stop-btn" title="Stop execution" style="display:none;">&#9208; Stop</button>' +
        '<button class="tvm-clear-btn" title="Clear output">Clear</button>' +
        '<button class="tvm-output-popout-btn" title="Open output in separate window">⧉<span class="sr-only">Open output in separate window</span></button>' +
        '</div></div>' +
        '<div class="tvm-output-container"><pre class="tvm-output-pre"></pre></div>';

      var hasGitTerminal = this.gitGraphPath && this.config.backend !== 'v86';
      if (hasGitTerminal) {
        // Tabbed: Output + Terminal share this panel area. The Terminal tab
        // is the natural default for pyodide+git tutorials, but we open on
        // Output so the run button is immediately visible until students
        // switch to the git workflow.
        terminalHtml =
          '<div class="tvm-output-panel tvm-out-term-tabbed">' +
          '<div class="tvm-out-term-tab-bar">' +
          '<button class="tvm-out-term-tab active" data-panel="output"><i class="fa fa-terminal"></i> Output</button>' +
          '<button class="tvm-out-term-tab" data-panel="terminal"><i class="fa fa-code-branch"></i> Terminal</button>' +
          '</div>' +
          '<div class="tvm-output-view">' + outputBody + '</div>' +
          '<div class="tvm-terminal-view" style="display:none">' +
          '<div class="tvm-git-terminal-container"></div>' +
          '</div>' +
          '</div>';
      } else {
        terminalHtml = '<div class="tvm-output-panel">' + outputBody + '</div>';
      }
    }

    var useLeftUml = this._umlDiagramEnabled && !this._umlPositionRight && !this._umlPositionBelow && !this._umlPositionBottomLeft;
    var useBelowUml = this._umlDiagramEnabled && this._umlPositionBelow;
    var useBottomLeftUml = this._umlDiagramEnabled && this._umlPositionBottomLeft;
    // Independent: when set, the Output panel is rendered in the left column
    // (below instructions) instead of below the editors in the workspace.
    // Combined with `uml_position: 'right'`, you get the recommended layout:
    // editors top-right, UML bottom-right (no tabs), Output bottom-left.
    var useBottomLeftOutput = this._outputPositionBottomLeft;
    this.root.innerHTML =
      '<div class="tvm-loading" role="status" aria-live="polite" aria-atomic="true">' +
      '<div class="tvm-loading-spinner"></div>' +
      '<div class="tvm-loading-text">Loading\u2026</div>' +
      '</div>' +
      '<div class="tvm-container" style="visibility:hidden">' +
      '<div class="tvm-instructions-panel">' +
      (useLeftUml
        ? '<div class="tvm-left-tab-bar">' +
          '<button class="tvm-left-tab active" data-panel="steps"><i class="fa fa-book-open"></i> Steps</button>' +
          '<button class="tvm-left-tab" data-panel="uml"><i class="fa fa-diagram-project"></i> UML Diagram</button>' +
          '</div>'
        : '') +
      '<div class="tvm-steps-view">' +
      '<div class="tvm-step-nav-bar">' +
      '<div class="tvm-step-nav"></div>' +
      '<button class="tvm-instructions-popout-btn" title="Open instructions in separate window">⧉<span class="sr-only">Open instructions in separate window</span></button>' +
      '</div>' +
      '<div class="tvm-step-content-wrap scrollable-region-focus-target" tabindex="0"><div class="tvm-step-content"></div></div>' +
      (useBelowUml
        ? '<div class="tvm-uml-below-view">' +
          '<div class="tvm-diagram-toolbar">' +
          '<button class="tvm-diagram-type-btn' + (this._umlActiveType === 'class' ? ' active' : '') + '" data-type="class" aria-pressed="' + (this._umlActiveType === 'class' ? 'true' : 'false') + '">Class Diagram</button>' +
          '<button class="tvm-diagram-type-btn' + (this._umlActiveType === 'sequence' ? ' active' : '') + '" data-type="sequence" aria-pressed="' + (this._umlActiveType === 'sequence' ? 'true' : 'false') + '">Sequence Diagram</button>' +
          '<div class="tvm-diagram-zoom-controls">' +
          '<button class="tvm-diagram-zoom-btn" data-zoom="out" title="Zoom out">\u2212</button>' +
          '<span class="tvm-diagram-zoom-label">100%</span>' +
          '<button class="tvm-diagram-zoom-btn" data-zoom="in" title="Zoom in" aria-label="Zoom in">+</button>' +
          '<button class="tvm-diagram-zoom-btn" data-zoom="reset" title="Reset zoom">\u2715</button>' +
          '</div>' +
          '<button class="tvm-diagram-fullscreen-btn" title="Fullscreen">\u26f6</button>' +
          '<button class="tvm-diagram-popout-btn" title="Open in separate window">\u29c9</button>' +
          '<button class="tvm-diagram-refresh-btn" title="Re-analyze code">\u21bb Refresh</button>' +
          '<label class="tvm-diagram-color-btn" title="Diagram accent color"><span class="sr-only">Diagram accent color</span><input type="color" class="tvm-diagram-color-input" aria-label="Diagram accent color"></label>' +
        '<button class="tvm-diagram-color-reset-btn" title="Reset to default color">\u21bb</button>' +
          '</div>' +
          '<div class="tvm-diagram-content"></div>' +
          '</div>'
        : '') +
      '<div class="tvm-http-splitter" style="display:none"></div>' +
      '<div class="tvm-http-sidebar-view" style="display:none">' +
      '<div class="tvm-http-toolbar">' +
      '<select class="tvm-http-method-select" aria-label="HTTP request method"><option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option></select>' +
      '<input type="text" class="tvm-http-url-input" placeholder="http://localhost:3000/" value="/" aria-label="Request URL">' +
      '<button class="tvm-http-send-btn"><i class="fa fa-paper-plane"></i> Send</button>' +
      '</div>' +
      '<div class="tvm-http-content">' +
      '<div class="tvm-http-section-header">Request Body</div>' +
      '<div class="tvm-http-body-editor"></div>' +
      '<div class="tvm-http-response-area">' +
      '<div class="tvm-http-section-header"><span>Response</span><div class="tvm-http-response-meta"></div></div>' +
      '<pre class="tvm-http-response-body"></pre>' +
      '<div class="tvm-http-empty-state"><i class="fa fa-bolt"></i><span>Send a request to see the response</span></div>' +
      '</div>' +
      '</div></div>' +
      '<div class="tvm-quiz-panel" style="display:none"></div>' +
      '<div class="tvm-step-controls-bar"><div class="tvm-step-controls"></div></div>' +
      '</div>' +
      (useLeftUml
        ? '<div class="tvm-uml-left-view" style="display:none">' +
          '<div class="tvm-diagram-toolbar">' +
          '<button class="tvm-diagram-type-btn' + (this._umlActiveType === 'class' ? ' active' : '') + '" data-type="class" aria-pressed="' + (this._umlActiveType === 'class' ? 'true' : 'false') + '">Class Diagram</button>' +
          '<button class="tvm-diagram-type-btn' + (this._umlActiveType === 'sequence' ? ' active' : '') + '" data-type="sequence" aria-pressed="' + (this._umlActiveType === 'sequence' ? 'true' : 'false') + '">Sequence Diagram</button>' +
          '<div class="tvm-diagram-zoom-controls">' +
          '<button class="tvm-diagram-zoom-btn" data-zoom="out" title="Zoom out">\u2212</button>' +
          '<span class="tvm-diagram-zoom-label">100%</span>' +
          '<button class="tvm-diagram-zoom-btn" data-zoom="in" title="Zoom in" aria-label="Zoom in">+</button>' +
          '<button class="tvm-diagram-zoom-btn" data-zoom="reset" title="Reset zoom">\u2715</button>' +
          '</div>' +
          '<button class="tvm-diagram-fullscreen-btn" title="Fullscreen">\u26f6</button>' +
          '<button class="tvm-diagram-popout-btn" title="Open in separate window">\u29c9</button>' +
          '<button class="tvm-diagram-refresh-btn" title="Re-analyze code">\u21bb Refresh</button>' +
          '<label class="tvm-diagram-color-btn" title="Diagram accent color"><span class="sr-only">Diagram accent color</span><input type="color" class="tvm-diagram-color-input" aria-label="Diagram accent color"></label>' +
        '<button class="tvm-diagram-color-reset-btn" title="Reset to default color">\u21bb</button>' +
          '</div>' +
          '<div class="tvm-diagram-content"></div>' +
          '</div>'
        : '') +
      (useBottomLeftUml
        ? '<div class="tvm-uml-bottom-left-splitter" title="Drag to resize"></div>' +
          '<div class="tvm-uml-bottom-left-view">' +
          '<div class="tvm-diagram-toolbar">' +
          '<button class="tvm-diagram-type-btn' + (this._umlActiveType === 'class' ? ' active' : '') + '" data-type="class" aria-pressed="' + (this._umlActiveType === 'class' ? 'true' : 'false') + '">Class Diagram</button>' +
          '<button class="tvm-diagram-type-btn' + (this._umlActiveType === 'sequence' ? ' active' : '') + '" data-type="sequence" aria-pressed="' + (this._umlActiveType === 'sequence' ? 'true' : 'false') + '">Sequence Diagram</button>' +
          '<div class="tvm-diagram-zoom-controls">' +
          '<button class="tvm-diagram-zoom-btn" data-zoom="out" title="Zoom out">\u2212</button>' +
          '<span class="tvm-diagram-zoom-label">100%</span>' +
          '<button class="tvm-diagram-zoom-btn" data-zoom="in" title="Zoom in" aria-label="Zoom in">+</button>' +
          '<button class="tvm-diagram-zoom-btn" data-zoom="reset" title="Reset zoom">\u2715</button>' +
          '</div>' +
          '<button class="tvm-diagram-fullscreen-btn" title="Fullscreen">\u26f6</button>' +
          '<button class="tvm-diagram-popout-btn" title="Open in separate window">\u29c9</button>' +
          '<button class="tvm-diagram-refresh-btn" title="Re-analyze code">\u21bb Refresh</button>' +
          '<label class="tvm-diagram-color-btn" title="Diagram accent color"><span class="sr-only">Diagram accent color</span><input type="color" class="tvm-diagram-color-input" aria-label="Diagram accent color"></label>' +
          '<button class="tvm-diagram-color-reset-btn" title="Reset to default color">\u21bb</button>' +
          '</div>' +
          '<div class="tvm-diagram-content"></div>' +
          '</div>'
        : '') +
      // Independent option: when output_position: bottom-left is set, the Output
      // panel is hoisted into the left column (below instructions). It uses the
      // SAME splitter class as the bottom-left UML mode (`.tvm-uml-bottom-left-splitter`)
      // and inserts the Output panel directly — all existing CSS rules and the
      // splitter-resize wiring just work.
      (useBottomLeftOutput
        ? '<div class="tvm-uml-bottom-left-splitter" title="Drag to resize"></div>' +
          terminalHtml
        : '') +
      '</div>' +
      '<div class="tvm-hsplitter" title="Drag to resize"></div>' +
      '<div class="tvm-workspace' + (this._umlPositionRight ? ' tvm-uml-right' : '') + '">' +
      (this.gitGraphPath
        ? '<div class="tvm-view-toggle">' +
          '<button class="tvm-view-btn tvm-view-btn-editor active" data-view="editor">' +
          '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M1 2.5A1.5 1.5 0 012.5 1h11A1.5 1.5 0 0115 2.5v11a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 13.5v-11zM2.5 2a.5.5 0 00-.5.5v11a.5.5 0 00.5.5h11a.5.5 0 00.5-.5v-11a.5.5 0 00-.5-.5h-11z"/><path d="M4 5.5a.5.5 0 01.5-.5h7a.5.5 0 010 1h-7a.5.5 0 01-.5-.5zm0 3a.5.5 0 01.5-.5h4a.5.5 0 010 1h-4a.5.5 0 01-.5-.5z"/></svg>' +
          ' Editor</button>' +
          '<button class="tvm-view-btn tvm-view-btn-graph" data-view="git_graph">' +
          '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
          '<line x1="4" y1="3" x2="4" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
          '<path d="M4 6 Q4 9.5 11 9.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>' +
          '<circle cx="4" cy="3" r="2" fill="currentColor"/>' +
          '<circle cx="4" cy="10" r="2" fill="currentColor"/>' +
          '<circle cx="4" cy="13" r="2" fill="currentColor" opacity="0.5"/>' +
          '<circle cx="11" cy="9.5" r="2" fill="currentColor"/>' +
          '</svg>' +
          ' Git Graph</button>' +
          '</div>'
        : '') +
      '<div class="tvm-editor-panel' +
        (this.editorSplitSupported ? ' tvm-editor-split-supported' : '') +
        (this.editorSplitSupported && this._splitActive ? ' tvm-editor-split-active' : '') + '">' +
      '<div class="tvm-editor-body">' +
      '<div class="tvm-editor-pane tvm-editor-pane-left">' +
      (this.editorSplitSupported
        ? '<div class="tvm-editor-pane-tab-row">' +
          '<div class="tvm-editor-pane-label" data-pane="left">' +
            '<span class="tvm-editor-pane-label-text">Code</span>' +
            '<button class="tvm-editor-pane-popout-btn" data-pane="left" title="Open this pane in separate window">⧉<span class="sr-only">Open code pane in separate window</span></button>' +
          '</div>' +
          '<div class="tvm-editor-tabs"></div>' +
          '</div>'
        : '<div class="tvm-editor-tabs"></div>') +
      '<div class="tvm-editor-container"></div>' +
      '</div>' +
      (this.editorSplitSupported
        ? '<div class="tvm-editor-pane-divider" title="Drag to resize"></div>' +
          '<div class="tvm-editor-pane tvm-editor-pane-right">' +
          '<div class="tvm-editor-pane-tab-row">' +
          '<div class="tvm-editor-pane-label" data-pane="right">' +
            '<span class="tvm-editor-pane-label-text">Tests</span>' +
            '<button class="tvm-editor-pane-popout-btn" data-pane="right" title="Open this pane in separate window">⧉<span class="sr-only">Open tests pane in separate window</span></button>' +
          '</div>' +
          '<div class="tvm-editor-tabs tvm-editor-tabs-right"></div>' +
          '</div>' +
          '<div class="tvm-editor-container tvm-editor-container-right"></div>' +
          '</div>'
        : '') +
      '</div>' +
      (this.editorSplitSupported
        ? '<div class="tvm-editor-mode-toggle" role="group" aria-label="Editor layout">' +
          '<button class="tvm-editor-mode-btn' + (!this._splitActive ? ' active' : '') +
            '" data-mode="tabs" aria-pressed="' + (!this._splitActive ? 'true' : 'false') + '" title="Tab view — single editor, tabs for every file">' +
            '<i class="fa fa-window-maximize"></i> Tabs</button>' +
          '<button class="tvm-editor-mode-btn' + (this._splitActive ? ' active' : '') +
            '" data-mode="split" aria-pressed="' + (this._splitActive ? 'true' : 'false') + '" title="Split view — code on the left, tests on the right">' +
            '<i class="fa fa-columns"></i> Split</button>' +
          '</div>'
        : '') +
      '</div>' +
      '<div class="tvm-diagram-fullscreen-overlay" style="display:none">' +
      '<div class="tvm-diagram-fs-toolbar">' +
      '<button class="tvm-diagram-fs-type-btn' + (this._umlActiveType === 'class' ? ' active' : '') + '" data-type="class" aria-pressed="' + (this._umlActiveType === 'class' ? 'true' : 'false') + '">Class Diagram</button>' +
      '<button class="tvm-diagram-fs-type-btn' + (this._umlActiveType === 'sequence' ? ' active' : '') + '" data-type="sequence" aria-pressed="' + (this._umlActiveType === 'sequence' ? 'true' : 'false') + '">Sequence Diagram</button>' +
      '<div class="tvm-diagram-zoom-controls">' +
      '<button class="tvm-diagram-fs-zoom-btn" data-zoom="out" title="Zoom out">\u2212</button>' +
      '<span class="tvm-diagram-fs-zoom-label">100%</span>' +
      '<button class="tvm-diagram-fs-zoom-btn" data-zoom="in" title="Zoom in">+</button>' +
      '<button class="tvm-diagram-fs-zoom-btn" data-zoom="reset" title="Reset zoom">\u2715</button>' +
      '</div>' +
      '<button class="tvm-diagram-fs-close" title="Exit fullscreen">\u2715 Close</button>' +
      '<label class="tvm-diagram-color-btn" title="Diagram accent color"><span class="sr-only">Diagram accent color</span><input type="color" class="tvm-diagram-color-input tvm-diagram-fs-color-input" aria-label="Diagram accent color"></label>' +
      '<button class="tvm-diagram-color-reset-btn" title="Reset to default color">\u21bb</button>' +
      '</div>' +
      '<div class="tvm-diagram-fs-content"></div>' +
      '</div>' +
      (this.gitGraphPath
        ? '<div class="tvm-git-graph-panel" style="display:none">' +
          '<div class="tvm-git-graph-header">' +
          '<span>Git Graph</span>' +
          '<div class="tvm-git-graph-header-actions">' +
          '<button class="tvm-git-graph-refresh" title="Refresh graph">&#x21bb; Refresh</button>' +
          '<button class="tvm-git-graph-popout-btn" title="Pop out git graph to a new window">&#x29c9;</button>' +
          '</div>' +
          '</div>' +
          '<div class="tvm-git-graph-container"></div>' +
          // For non-v86 backends the embedded git terminal lives in the
          // shared Output↔Terminal tabbed panel below the editor (same
          // place as Output) — see the `hasGitTerminal` branch above.
          '</div>'
        : '') +
      '<div class="tvm-vsplitter" title="Drag to resize"></div>' +
      // Workspace bottom-pane:
      //   - If Output was hoisted to bottom-left AND uml_position is 'right',
      //     render the SAME UML pane that the bottom-left mode uses (same
      //     class `.tvm-uml-bottom-left-view`, same HTML, same wiring). Only
      //     the parent container differs — that's the entire point of using
      //     the same class: every CSS rule, every JS handler (popout,
      //     fullscreen, zoom, splitter resolution) works automatically.
      //   - If Output was hoisted to bottom-left WITHOUT a right-mode UML,
      //     leave the workspace editor-only.
      //   - Otherwise render the regular Output panel (which may itself be
      //     a right-tabbed panel containing UML, see the `_umlPositionRight`
      //     branch above).
      ((useBottomLeftOutput && this._umlPositionRight && this._umlDiagramEnabled)
        ? '<div class="tvm-uml-bottom-left-view">' +
          '<div class="tvm-diagram-toolbar">' +
          '<button class="tvm-diagram-type-btn' + (this._umlActiveType === 'class' ? ' active' : '') + '" data-type="class" aria-pressed="' + (this._umlActiveType === 'class' ? 'true' : 'false') + '">Class Diagram</button>' +
          '<button class="tvm-diagram-type-btn' + (this._umlActiveType === 'sequence' ? ' active' : '') + '" data-type="sequence" aria-pressed="' + (this._umlActiveType === 'sequence' ? 'true' : 'false') + '">Sequence Diagram</button>' +
          '<div class="tvm-diagram-zoom-controls">' +
          '<button class="tvm-diagram-zoom-btn" data-zoom="out" title="Zoom out" aria-label="Zoom out">−</button>' +
          '<span class="tvm-diagram-zoom-label">100%</span>' +
          '<button class="tvm-diagram-zoom-btn" data-zoom="in" title="Zoom in" aria-label="Zoom in">+</button>' +
          '<button class="tvm-diagram-zoom-btn" data-zoom="reset" title="Reset zoom" aria-label="Reset zoom">✕</button>' +
          '</div>' +
          '<button class="tvm-diagram-fullscreen-btn" title="Fullscreen" aria-label="Toggle fullscreen diagram view">⛶</button>' +
          '<button class="tvm-diagram-popout-btn" title="Open in separate window" aria-label="Open diagram in separate window">⧉</button>' +
          '<button class="tvm-diagram-refresh-btn" title="Re-analyze code">↻ Refresh</button>' +
          '<label class="tvm-diagram-color-btn" title="Diagram accent color"><span class="sr-only">Diagram accent color</span><input type="color" class="tvm-diagram-color-input" aria-label="Diagram accent color"></label>' +
          '<button class="tvm-diagram-color-reset-btn" title="Reset to default color" aria-label="Reset diagram accent colour to default">↻</button>' +
          '</div>' +
          '<div class="tvm-diagram-content"></div>' +
          '</div>'
        : useBottomLeftOutput
        ? ''
        : terminalHtml) +
      '</div>' +
      '</div>';

    this.loadingEl = this.root.querySelector('.tvm-loading');
    this.containerEl = this.root.querySelector('.tvm-container');
    this.stepNavEl = this.root.querySelector('.tvm-step-nav');
    this.stepContentEl = this.root.querySelector('.tvm-step-content');
    this.stepContentWrapEl = this.root.querySelector('.tvm-step-content-wrap');
    this.quizPanelEl = this.root.querySelector('.tvm-quiz-panel');
    this.stepControlsEl = this.root.querySelector('.tvm-step-controls');
    this.editorTabsEl = this.root.querySelector('.tvm-editor-tabs');
    this.editorContainerEl = this.root.querySelector('.tvm-editor-container');
    this.editorPanelEl = this.root.querySelector('.tvm-editor-panel');
    this.editorTabsElRight = this.root.querySelector('.tvm-editor-tabs-right');
    this.editorContainerElRight = this.root.querySelector('.tvm-editor-container-right');
    this.gitGraphPanelEl = this.root.querySelector('.tvm-git-graph-panel');
    this.gitGraphContainerEl = this.root.querySelector('.tvm-git-graph-container');
    this._umlContainer = this._umlPositionRight
      // Right mode normally uses .tvm-uml-right-view (inside the right-tabbed
      // panel). When `output_position: bottom-left` is also set, the right
      // tabbed panel is suppressed and a standalone UML pane is rendered in
      // the workspace using the SAME class (`.tvm-uml-bottom-left-view`) that
      // bottom-left mode uses — same HTML, same wiring, same CSS, only the
      // parent container differs.
      ? (this.root.querySelector('.tvm-uml-right-view') ||
         this.root.querySelector('.tvm-uml-bottom-left-view'))
      : this._umlPositionBelow
        ? this.root.querySelector('.tvm-uml-below-view')
        : this._umlPositionBottomLeft
          ? this.root.querySelector('.tvm-uml-bottom-left-view')
          : this.root.querySelector('.tvm-uml-left-view');
    this._umlContentEl = this.root.querySelector('.tvm-diagram-content');
    this._umlFullscreenEl = this.root.querySelector('.tvm-diagram-fullscreen-overlay');
    this._umlFsContentEl = this.root.querySelector('.tvm-diagram-fs-content');
    this._stepsViewEl = this.root.querySelector('.tvm-steps-view');
    this._leftTabBarEl = this.root.querySelector('.tvm-left-tab-bar');
    this._rightTabBarEl = this.root.querySelector('.tvm-right-tab-bar');
    this._httpViewEl = this.root.querySelector('.tvm-http-sidebar-view');
    this._outputViewEl = this.root.querySelector('.tvm-output-view');

    // Lecture mode: hide step number nav bar and step controls bar entirely
    if (this.lectureMode) {
      var stepNavBar = this.root.querySelector('.tvm-step-nav-bar');
      if (stepNavBar) stepNavBar.style.display = 'none';
      var stepControlsBar = this.root.querySelector('.tvm-step-controls-bar');
      if (stepControlsBar) stepControlsBar.style.display = 'none';
    }

    var self = this;

    // HTTP Client initialization
    if (this._httpViewEl) {
      this._httpMethodEl = this._httpViewEl.querySelector('.tvm-http-method-select');
      this._httpUrlEl = this._httpViewEl.querySelector('.tvm-http-url-input');
      this._httpSendBtn = this._httpViewEl.querySelector('.tvm-http-send-btn');
      this._httpBodyContainerEl = this._httpViewEl.querySelector('.tvm-http-body-editor');
      this._httpBodyHeaderEl = this._httpViewEl.querySelector('.tvm-http-content > .tvm-http-section-header');
      this._httpResponseMetaEl = this._httpViewEl.querySelector('.tvm-http-response-meta');
      this._httpResponseBodyEl = this._httpViewEl.querySelector('.tvm-http-response-body');
      this._httpEmptyEl = this._httpViewEl.querySelector('.tvm-http-empty-state');

      this._httpSendBtn.addEventListener('click', function () { self._sendHttpRequest(); });

      this._httpSplitterEl = this._stepsViewEl.querySelector('.tvm-http-splitter');
      // HTTP splitter is horizontal (splits top/bottom)
      this._makeDraggable(this._httpSplitterEl, 'horizontal', this.stepContentWrapEl, this._httpViewEl);

      // Tab bar events
      if (this._rightTabBarEl) {
        var rtabs = this._rightTabBarEl.querySelectorAll('.tvm-right-tab');
        for (var ri = 0; ri < rtabs.length; ri++) {
          (function (btn) {
            btn.addEventListener('click', function () {
              var panel = btn.getAttribute('data-panel');
              self._showRightPanel(panel);
            });
          })(rtabs[ri]);
        }
      }
    }

    var self = this;

    // UML diagram toolbar events
    if (this._umlContainer) {
      var typeBtns = this._umlContainer.querySelectorAll('.tvm-diagram-type-btn');
      for (var ti = 0; ti < typeBtns.length; ti++) {
        (function (btn) {
          btn.addEventListener('click', function () {
            self._umlActiveType = btn.getAttribute('data-type');
            for (var j = 0; j < typeBtns.length; j++) {
              typeBtns[j].classList.toggle('active', typeBtns[j] === btn);
              typeBtns[j].setAttribute('aria-pressed', typeBtns[j] === btn ? 'true' : 'false');
            }
            self._renderCurrentUMLDiagram();
          });
        })(typeBtns[ti]);
      }
      var refreshBtn = this._umlContainer.querySelector('.tvm-diagram-refresh-btn');
      if (refreshBtn) refreshBtn.addEventListener('click', function () { self._refreshUMLDiagram(); });

      // Inline zoom controls
      var zoomLabel = this._umlContainer.querySelector('.tvm-diagram-zoom-label');
      var zoomBtns = this._umlContainer.querySelectorAll('.tvm-diagram-zoom-btn');
      for (var zi = 0; zi < zoomBtns.length; zi++) {
        (function (btn) {
          btn.addEventListener('click', function () {
            var dir = btn.getAttribute('data-zoom');
            if (dir === 'in') self._umlZoom = Math.min(4, parseFloat((self._umlZoom + 0.1).toFixed(2)));
            else if (dir === 'out') self._umlZoom = Math.max(0.1, parseFloat((self._umlZoom - 0.1).toFixed(2)));
            else self._umlZoom = 1;
            self._applyUMLZoom(self._umlContentEl, self._umlZoom, zoomLabel);
          });
        })(zoomBtns[zi]);
      }
      // Mouse-wheel zoom on the inline diagram area
      if (this._umlContentEl) {
        this._umlContentEl.addEventListener('wheel', function (e) {
          if (!e.ctrlKey && !e.metaKey) return;
          e.preventDefault();
          self._umlZoom = e.deltaY < 0
            ? Math.min(4, parseFloat((self._umlZoom + 0.05).toFixed(2)))
            : Math.max(0.1, parseFloat((self._umlZoom - 0.05).toFixed(2)));
          self._applyUMLZoom(self._umlContentEl, self._umlZoom, zoomLabel);
        }, { passive: false });
        self._installUMLPan(this._umlContentEl);
      }

      // Fullscreen button
      var fsBtn = this._umlContainer.querySelector('.tvm-diagram-fullscreen-btn');
      if (fsBtn) {
        fsBtn.addEventListener('click', function () { self._openUMLFullscreen(); });
      }

      // Popout button
      var popoutBtn = this._umlContainer.querySelector('.tvm-diagram-popout-btn');
      if (popoutBtn) {
        popoutBtn.addEventListener('click', function () { self._openUMLPopout(); });
      }
    }

    // Fullscreen overlay controls
    if (this._umlFullscreenEl) {
      var fsTypeBtns = this._umlFullscreenEl.querySelectorAll('.tvm-diagram-fs-type-btn');
      for (var fti = 0; fti < fsTypeBtns.length; fti++) {
        (function (btn) {
          btn.addEventListener('click', function () {
            self._umlActiveType = btn.getAttribute('data-type');
            for (var j = 0; j < fsTypeBtns.length; j++) {
              fsTypeBtns[j].classList.toggle('active', fsTypeBtns[j] === btn);
              fsTypeBtns[j].setAttribute('aria-pressed', fsTypeBtns[j] === btn ? 'true' : 'false');
            }
            // Sync inline type buttons too
            var inlineBtns = self._umlContainer ? self._umlContainer.querySelectorAll('.tvm-diagram-type-btn') : [];
            for (var k = 0; k < inlineBtns.length; k++) {
              inlineBtns[k].classList.toggle('active', inlineBtns[k].getAttribute('data-type') === self._umlActiveType);
              inlineBtns[k].setAttribute('aria-pressed', inlineBtns[k].getAttribute('data-type') === self._umlActiveType ? 'true' : 'false');
            }
            // Re-render in fullscreen view
            self._renderUMLInFullscreen();
          });
        })(fsTypeBtns[fti]);
      }

      var fzLabel = this._umlFullscreenEl.querySelector('.tvm-diagram-fs-zoom-label');
      var fzBtns = this._umlFullscreenEl.querySelectorAll('.tvm-diagram-fs-zoom-btn');
      for (var fzi = 0; fzi < fzBtns.length; fzi++) {
        (function (btn) {
          btn.addEventListener('click', function () {
            var dir = btn.getAttribute('data-zoom');
            if (dir === 'in') self._umlFsZoom = Math.min(4, parseFloat((self._umlFsZoom + 0.1).toFixed(2)));
            else if (dir === 'out') self._umlFsZoom = Math.max(0.1, parseFloat((self._umlFsZoom - 0.1).toFixed(2)));
            else self._umlFsZoom = 1;
            self._applyUMLZoom(self._umlFsContentEl, self._umlFsZoom, fzLabel);
          });
        })(fzBtns[fzi]);
      }
      if (this._umlFsContentEl) {
        this._umlFsContentEl.addEventListener('wheel', function (e) {
          if (!e.ctrlKey && !e.metaKey) return;
          e.preventDefault();
          self._umlFsZoom = e.deltaY < 0
            ? Math.min(4, parseFloat((self._umlFsZoom + 0.05).toFixed(2)))
            : Math.max(0.1, parseFloat((self._umlFsZoom - 0.05).toFixed(2)));
          self._applyUMLZoom(self._umlFsContentEl, self._umlFsZoom, fzLabel);
        }, { passive: false });
        self._installUMLPan(this._umlFsContentEl);
      }

      var fsClose = this._umlFullscreenEl.querySelector('.tvm-diagram-fs-close');
      if (fsClose) fsClose.addEventListener('click', function () { self._closeUMLFullscreen(); });

      // Close on Escape key
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && self._umlFullscreenEl && self._umlFullscreenEl.style.display !== 'none') {
          self._closeUMLFullscreen();
        }
      });
    }

    // Wire all color pickers (inline + fullscreen share a single handler via event delegation)
    if (this._umlDiagramEnabled) {
      var self2 = self;
      function onColorChange(e) {
        if (!e.target || e.target.className.indexOf('tvm-diagram-color-input') === -1) return;
        self2._umlCustomColor = e.target.value;
        self2._saveUMLColorCookie(e.target.value);
        self2._syncColorInputs();
        self2._renderCurrentUMLDiagram();
        if (self2._umlFullscreenEl && self2._umlFullscreenEl.style.display !== 'none') {
          self2._renderUMLInFullscreen();
        }
      }
      function onColorReset(e) {
        var target = e.target && e.target.closest && e.target.closest('.tvm-diagram-color-reset-btn');
        if (!target) return;
        self2._umlCustomColor = null;
        self2._clearUMLColorCookie();
        self2._syncColorInputs();
        self2._renderCurrentUMLDiagram();
        if (self2._umlFullscreenEl && self2._umlFullscreenEl.style.display !== 'none') {
          self2._renderUMLInFullscreen();
        }
      }
      if (this.root) {
        this.root.addEventListener('change', onColorChange);
        this.root.addEventListener('click', onColorReset);
      }
      // Also catch events from the fs overlay once it's moved to body
      document.addEventListener('change', function (e) {
        if (!e.target || e.target.className.indexOf('tvm-diagram-color-input') === -1) return;
        if (self2.root && self2.root.contains(e.target)) return;
        self2._umlCustomColor = e.target.value;
        self2._saveUMLColorCookie(e.target.value);
        self2._syncColorInputs();
        self2._renderCurrentUMLDiagram();
        self2._renderUMLInFullscreen();
      });
      document.addEventListener('click', function (e) {
        var target = e.target && e.target.closest && e.target.closest('.tvm-diagram-color-reset-btn');
        if (!target) return;
        if (self2.root && self2.root.contains(target)) return;
        self2._umlCustomColor = null;
        self2._clearUMLColorCookie();
        self2._syncColorInputs();
        self2._renderCurrentUMLDiagram();
        self2._renderUMLInFullscreen();
      });
      // Set initial value from cookie
      this._syncColorInputs();
    }

    // Left-panel tab switcher (Steps ↔ UML Diagram)
    if (this._leftTabBarEl) {
      var leftTabs = this._leftTabBarEl.querySelectorAll('.tvm-left-tab');
      for (var lti = 0; lti < leftTabs.length; lti++) {
        (function (tab) {
          tab.addEventListener('click', function () {
            var panel = tab.getAttribute('data-panel');
            for (var j = 0; j < leftTabs.length; j++) {
              leftTabs[j].classList.toggle('active', leftTabs[j] === tab);
            }
            if (panel === 'uml') {
              self._umlViewActive = true;
              if (self._stepsViewEl) self._stepsViewEl.style.display = 'none';
              if (self._umlContainer) self._umlContainer.style.display = 'flex';
              self._refreshUMLDiagram();
            } else {
              self._umlViewActive = false;
              if (self._umlContainer) self._umlContainer.style.display = 'none';
              if (self._stepsViewEl) self._stepsViewEl.style.display = 'flex';
            }
          });
        })(leftTabs[lti]);
      }
    }

    // Right-panel tab switcher (Output ↔ UML Diagram) — used when uml_position: right
    var rightTabBarEl = this.root.querySelector('.tvm-right-tab-bar');
    if (rightTabBarEl) {
      var rightTabs = rightTabBarEl.querySelectorAll('.tvm-right-tab');
      for (var rti = 0; rti < rightTabs.length; rti++) {
        (function (tab) {
          tab.addEventListener('click', function () {
            var panel = tab.getAttribute('data-panel');
            for (var j = 0; j < rightTabs.length; j++) {
              rightTabs[j].classList.toggle('active', rightTabs[j] === tab);
            }
            var outputView = self.root.querySelector('.tvm-output-view');
            var umlRightView = self.root.querySelector('.tvm-uml-right-view');
            if (panel === 'uml') {
              self._umlViewActive = true;
              if (outputView) outputView.style.display = 'none';
              if (umlRightView) umlRightView.style.display = 'flex';
              self._refreshUMLDiagram();
            } else {
              self._umlViewActive = false;
              if (umlRightView) umlRightView.style.display = 'none';
              if (outputView) outputView.style.display = 'flex';
            }
          });
        })(rightTabs[rti]);
      }
    }

    // Editor layout mode toggle (Tabs ↔ Split) — only when editor_split is enabled
    if (this.editorSplitSupported) {
      var modeBtns = this.root.querySelectorAll('.tvm-editor-mode-btn');
      for (var mi = 0; mi < modeBtns.length; mi++) {
        (function (btn) {
          btn.addEventListener('click', function () {
            var mode = btn.getAttribute('data-mode');
            self._setSplitActive(mode === 'split');
          });
        })(modeBtns[mi]);
      }
    }

    // Git graph toggle buttons
    var viewBtns = this.root.querySelectorAll('.tvm-view-btn');
    for (var vi = 0; vi < viewBtns.length; vi++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          self._setView(btn.getAttribute('data-view'));
        });
      })(viewBtns[vi]);
    }

    // Git graph refresh button
    var gitRefreshBtn = this.root.querySelector('.tvm-git-graph-refresh');
    if (gitRefreshBtn) gitRefreshBtn.addEventListener('click', function () { self._refreshGitGraph(); });
    var gitGraphPopoutBtn = this.root.querySelector('.tvm-git-graph-popout-btn');
    if (gitGraphPopoutBtn) gitGraphPopoutBtn.addEventListener('click', function () { self._popoutGraph(); });

    // Output ↔ Terminal tab toggle (pyodide tutorials with git_graph).
    var outTermTabs = this.root.querySelectorAll('.tvm-out-term-tab');
    for (var ti = 0; ti < outTermTabs.length; ti++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          self._showOutputTermPanel(btn.getAttribute('data-panel'));
        });
      })(outTermTabs[ti]);
    }

    if (this.config.useTerminal) {
      this.terminalContainerEl = this.root.querySelector('.tvm-terminal-container');
    } else if (this.config.usePreview) {
      this._previewFrame = this.root.querySelector('.tvm-preview-frame');
      if (this._previewFrame && !this._previewFrame.getAttribute('title')) {
        this._previewFrame.setAttribute('title', 'Live preview');
      }
      if (this._previewFrame && !this._previewFrame.getAttribute('aria-label')) {
        this._previewFrame.setAttribute('aria-label', 'Live preview');
      }
      if (this._previewFrame) {
        this._previewFrame.setAttribute('data-no-tooltip', 'true');
      }
      this._previewTestBtn = this.root.querySelector('.tvm-preview-test-btn');
      var refreshBtn = this.root.querySelector('.tvm-refresh-btn');
      if (refreshBtn) refreshBtn.addEventListener('click', function () { self._rebuildReactPreview(); });
      if (this._previewTestBtn) {
        this._previewTestBtn.addEventListener('click', function () { self._runStudentPlaywrightTests(); });
      }
    } else {
      this.outputPre = this.root.querySelector('.tvm-output-pre');
      this.outputPanel = this.root.querySelector('.tvm-output-panel');
      var runBtn = this.root.querySelector('.tvm-run-btn');
      var stopBtn = this.root.querySelector('.tvm-stop-btn');
      var clearBtn = this.root.querySelector('.tvm-clear-btn');
      if (runBtn) runBtn.addEventListener('click', function () { self._runCurrentFile(); });
      if (stopBtn) stopBtn.addEventListener('click', function () { self._stopExecution(); });
      if (clearBtn) clearBtn.addEventListener('click', function () { self._clearOutput(); });

      var filterSel = this.root.querySelector('.tvm-stream-filter');
      if (filterSel) {
        filterSel.addEventListener('change', function () {
          var c = self.root.querySelector('.tvm-output-container');
          if (c) {
            c.classList.remove('tvm-filter-stdout-only', 'tvm-filter-stderr-only');
            if (this.value === 'stdout') c.classList.add('tvm-filter-stdout-only');
            if (this.value === 'stderr') c.classList.add('tvm-filter-stderr-only');
          }
        });
      }
    }

    this._initSplitters();
  };

  TutorialCode.prototype._showLoading = function (msg) {
    if (this.loadingEl) {
      this.loadingEl.style.display = 'flex';
      this.loadingEl.querySelector('.tvm-loading-text').textContent = msg;
    }
    if (this.containerEl) {
      this.containerEl.style.display = '';
      this.containerEl.style.visibility = 'hidden';
    }
  };

  TutorialCode.prototype._hideLoading = function () {
    var self = this;
    if (this.loadingEl) this.loadingEl.style.display = 'none';
    if (this.containerEl) {
      this.containerEl.style.display = '';
      this.containerEl.style.visibility = '';
    }
    requestAnimationFrame(function () {
      if (self.fitAddon) { try { self.fitAddon.fit(); } catch (e) { } }
      if (self.editor) self.editor.layout();
    });
  };

  /**
   * Terminal-scoped loading overlay. Covers only the terminal panel so
   * instructions and git-graph remain visible and interactive. Used while
   * step setup_commands are running silently — the terminal should be inert
   * and the commands should not flash by.
   */
  TutorialCode.prototype._showTerminalLoading = function (msg) {
    var panel = this.root && this.root.querySelector('.tvm-terminal-panel');
    if (!panel) return;
    var overlay = panel.querySelector('.tvm-terminal-loading');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'tvm-terminal-loading';
      overlay.innerHTML =
        '<div class="tvm-loading-spinner"></div>' +
        '<div class="tvm-loading-text"></div>';
      overlay.setAttribute('role', 'status');
      overlay.setAttribute('aria-live', 'polite');
      overlay.setAttribute('aria-atomic', 'true');
      panel.appendChild(overlay);
    }
    overlay.querySelector('.tvm-loading-text').textContent = msg || 'Loading\u2026';
    overlay.style.display = 'flex';
  };

  TutorialCode.prototype._hideTerminalLoading = function () {
    var panel = this.root && this.root.querySelector('.tvm-terminal-panel');
    if (!panel) return;
    var overlay = panel.querySelector('.tvm-terminal-loading');
    if (overlay) overlay.style.display = 'none';
  };

  /**
   * Save a v86 snapshot of the VM at the clean "entry state" of a step —
   * the state right after that step's setup_commands have completed on top
   * of a fresh VM + all prior steps' solution commands. Subsequent Reset
   * or autosave-restore operations targeting this step can restore this
   * snapshot directly, skipping the replay entirely.
   * No-op for non-v86 backends or if save_state is unavailable.
   */
  TutorialCode.prototype._saveStepEntrySnapshot = function (idx, opts) {
    var self = this;
    opts = opts || {};
    if (self.resetType !== 'commands') return Promise.resolve();
    if (!self.emulator || !self.emulator.save_state) return Promise.resolve();
    if (idx == null || idx < 0) return Promise.resolve();
    return self.emulator.save_state().then(function (state) {
      self._stepEntrySnapshots[idx] = state;
      if (opts.persist !== false) {
        self._storeCachedSnapshot('step-entry', idx, state);
      }
    }).catch(function () { /* ignore snapshot failures */ });
  };

  TutorialCode.prototype._canCacheLiveStepEntrySnapshot = function (idx) {
    if (this.resetType !== 'commands') return true;
    if (idx == null || idx <= 0) return true;
    if (!this.requireTests) return false;
    for (var i = 0; i < idx; i++) {
      var step = this.steps[i];
      if (this._stepHasTests(step) && !this._stepsPassed.has(i)) {
        return false;
      }
    }
    return true;
  };

  /**
   * Restore a cached step-entry snapshot. Returns a Promise that resolves
   * to true on success, false if no snapshot is cached (caller should fall
   * back to the replay path).
   */
  TutorialCode.prototype._restoreStepEntrySnapshot = function (idx) {
    var self = this;
    var state = self._stepEntrySnapshots[idx];
    if (!self.emulator || !self.emulator.restore_state) {
      return Promise.resolve(false);
    }
    var statePromise = state
      ? Promise.resolve(state)
      : self._loadCachedSnapshot('step-entry', idx).then(function (cached) {
          if (cached) self._stepEntrySnapshots[idx] = cached;
          return cached;
        });
    return statePromise.then(function (snapshot) {
      if (!snapshot) return false;
      return self.emulator.restore_state(snapshot).then(function () {
        self._resetSerialState();
        // Defensive: if the snapshot was taken with residual input in-flight
        // (unterminated quote, heredoc, or PS2 continuation), sending Ctrl-C
        // clears it before any caller queues new commands. Harmless on a
        // clean prompt. One byte, no round-trip wait.
        if (self.emulator && self.emulator.serial0_send) {
          self.emulator.serial0_send('\x03');
        }
        return true;
      }).catch(function () { return false; });
    }).catch(function () { return false; });
  };

  TutorialCode.prototype._showError = function (msg) {
    this.root.innerHTML =
      '<div class="tvm-error"><h3>Tutorial Error</h3><p>' + msg + '</p>' +
      '<button onclick="location.reload()">Retry</button></div>';
  };

  // ---------------------------------------------------------------------------
  // Splitters
  // ---------------------------------------------------------------------------
  TutorialCode.prototype._initSplitters = function () {
    var hsplitter = this.root.querySelector('.tvm-hsplitter');
    var instructions = this.root.querySelector('.tvm-instructions-panel');
    var workspace = this.root.querySelector('.tvm-workspace');
    this._makeDraggable(hsplitter, 'vertical', instructions, workspace);

    // Workspace vsplitter — sits between the editor panel (top) and whatever
    // happens to be in the workspace bottom slot. Find that bottom element by
    // checking actual children of the workspace, not by guessing class names.
    // This way the splitter just works regardless of whether the bottom is an
    // Output panel, a terminal, a preview, or a UML pane (re-using the same
    // .tvm-uml-bottom-left-view class as everywhere else).
    var vsplitter = this.root.querySelector('.tvm-vsplitter');
    var editorPanel = this.root.querySelector('.tvm-editor-panel');
    var workspaceEl = this.root.querySelector('.tvm-workspace');
    var workspaceBottom = null;
    if (workspaceEl && vsplitter) {
      var sibling = vsplitter.nextElementSibling;
      while (sibling) {
        if (sibling.matches(
              '.tvm-output-panel, .tvm-terminal-panel, .tvm-preview-panel,' +
              ' .tvm-uml-bottom-left-view, .tvm-uml-below-view')) {
          workspaceBottom = sibling;
          break;
        }
        sibling = sibling.nextElementSibling;
      }
    }
    if (vsplitter && editorPanel && workspaceBottom) {
      this._makeDraggable(vsplitter, 'horizontal', editorPanel, workspaceBottom);
    } else if (vsplitter) {
      // No bottom panel exists (workspace is editor-only because Output was
      // hoisted away and no UML pane took its place) — hide the vsplitter so
      // it can't be dragged into a broken state.
      vsplitter.style.display = 'none';
    }

    // Bottom-left splitter — sits in the left column between the steps view
    // and the always-visible UML pane (when uml_position: bottom-left) OR the
    // hoisted Output panel (when output_position: bottom-left). The same
    // splitter element handles both: it just resizes whatever sibling sits
    // beneath it.
    var umlBottomLeftSplitter = this.root.querySelector('.tvm-uml-bottom-left-splitter');
    if (umlBottomLeftSplitter) {
      var stepsView = this.root.querySelector('.tvm-steps-view');
      // The element directly after the splitter is what gets resized.
      var resizeTarget = umlBottomLeftSplitter.nextElementSibling;
      if (stepsView && resizeTarget) {
        this._makeDraggable(umlBottomLeftSplitter, 'horizontal', stepsView, resizeTarget);
      }
    }

    // Split-editor divider — drag to resize the two panes
    var editorPaneDivider = this.root.querySelector('.tvm-editor-pane-divider');
    if (editorPaneDivider) {
      var leftPane = this.root.querySelector('.tvm-editor-pane-left');
      var rightPane = this.root.querySelector('.tvm-editor-pane-right');
      this._makeDraggable(editorPaneDivider, 'vertical', leftPane, rightPane);
    }

    // Per-tutorial output-panel height override (YAML `output_height: "50%"`).
    // Set the bottom panel's flex-basis and let the editor panel absorb the rest.
    if (this.outputHeight) {
      var bottomPanel = this.root.querySelector(
        this.config.useTerminal ? '.tvm-terminal-panel' :
          this.config.usePreview ? '.tvm-preview-panel' : '.tvm-output-panel');
      var editorPanelEl = this.root.querySelector('.tvm-editor-panel');
      if (bottomPanel) bottomPanel.style.flex = '0 0 ' + this.outputHeight;
      if (editorPanelEl) editorPanelEl.style.flex = '1 1 auto';
    }

    this._initUMLBroadcastChannel();
    this._initPopoutManager();
    this._wireInstructionsPopoutButton();
    this._wirePanePopoutButtons();
    this._wireOutputPopoutButton();
  };

  TutorialCode.prototype._makeDraggable = function (splitter, direction, beforeEl, afterEl) {
    var self = this;
    var startPos, startSizeBefore;
    splitter.setAttribute('role', 'separator');
    splitter.setAttribute('tabindex', '0');
    splitter.setAttribute('aria-orientation', direction === 'vertical' ? 'vertical' : 'horizontal');
    splitter.setAttribute('aria-valuemin', '0');
    splitter.setAttribute('aria-valuemax', '100');
    splitter.setAttribute('aria-label', direction === 'vertical'
      ? 'Resize editor panes'
      : 'Resize tutorial panels');
    function updateSeparatorValue() {
      var parentRect = beforeEl.parentElement.getBoundingClientRect();
      var beforeRect = beforeEl.getBoundingClientRect();
      var total = direction === 'vertical' ? parentRect.width : parentRect.height;
      var current = direction === 'vertical' ? beforeRect.width : beforeRect.height;
      if (total > 0) splitter.setAttribute('aria-valuenow', String(Math.round((current / total) * 100)));
    }
    function applySize(sz) {
      var parent = beforeEl.parentElement;
      var parentRect = parent.getBoundingClientRect();
      var otherSpace = 0;
      Array.prototype.forEach.call(parent.children, function(child) {
        if (child !== beforeEl && child !== afterEl &&
            window.getComputedStyle(child).display !== 'none' &&
            window.getComputedStyle(child).position !== 'absolute') {
          otherSpace += (direction === 'vertical' ? child.offsetWidth : child.offsetHeight);
        }
      });
      var totalAvailable = (direction === 'vertical' ? parentRect.width : parentRect.height) - otherSpace;
      var minSZ = 80;
      var maxSZ = totalAvailable - 100;
      var clamped = Math.min(maxSZ, Math.max(minSZ, sz));
      beforeEl.style.flex = '0 0 ' + clamped + 'px';
      afterEl.style.flex = '1 1 0';
      updateSeparatorValue();
      if (self.fitAddon) self.fitAddon.fit();
      if (self.editor) self.editor.layout();
      if (self.editor2) self.editor2.layout();
    }
    updateSeparatorValue();
    function onMouseDown(e) {
      e.preventDefault();
      startPos = direction === 'vertical' ? e.clientX : e.clientY;
      startSizeBefore = direction === 'vertical'
        ? beforeEl.getBoundingClientRect().width
        : beforeEl.getBoundingClientRect().height;
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      splitter.classList.add('active');
      document.body.style.cursor = direction === 'vertical' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    }
    function onMouseMove(e) {
      var cur = direction === 'vertical' ? e.clientX : e.clientY;
      applySize(startSizeBefore + (cur - startPos));
    }
    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      splitter.classList.remove('active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    splitter.addEventListener('mousedown', onMouseDown);
    splitter.addEventListener('keydown', function (e) {
      var beforeRect = beforeEl.getBoundingClientRect();
      var current = direction === 'vertical' ? beforeRect.width : beforeRect.height;
      var step = e.shiftKey ? 50 : 20;
      var handled = true;
      if (direction === 'vertical' && e.key === 'ArrowLeft') applySize(current - step);
      else if (direction === 'vertical' && e.key === 'ArrowRight') applySize(current + step);
      else if (direction !== 'vertical' && e.key === 'ArrowUp') applySize(current - step);
      else if (direction !== 'vertical' && e.key === 'ArrowDown') applySize(current + step);
      else if (e.key === 'Home') applySize(80);
      else if (e.key === 'End') applySize(100000);
      else handled = false;
      if (handled) e.preventDefault();
    });
  };

  // ---------------------------------------------------------------------------
  // Dependency Loading
  // ---------------------------------------------------------------------------
  TutorialCode.prototype._loadDependencies = function () {
    var self = this;
    self._showLoading('Loading dependencies\u2026');

    // xterm must load before Monaco's AMD loader or its UMD bundle breaks.
    // Also needed for the embedded git terminal that pyodide tutorials with
    // git_graph render below the gitgraph panel.
    var needsXterm = this.config.useTerminal
      || (this.gitGraphPath && this.config.backend !== 'v86');
    var prereqPromise;
    if (needsXterm) {
      loadCSS(CDN.XTERM_CSS);
      prereqPromise = loadScript(CDN.XTERM_JS)
        .then(function () { return loadScript(CDN.XTERM_FIT); })
        .then(function () { return loadScript(CDN.MARKED); });
    } else {
      prereqPromise = loadScript(CDN.MARKED);
    }

    return prereqPromise.then(function () {
      // v86 and Monaco can load in parallel
      var v86Promise = (self.config.backend === 'v86')
        ? loadScript(self.config.v86Path + '/libv86.js')
        : Promise.resolve();

      var monacoPromise = loadScript(CDN.MONACO_LOADER).then(function () {
        return new Promise(function (resolve) {
          window.require.config({ paths: { vs: CDN.MONACO_VS } });
          window.require(['vs/editor/editor.main'], function () {
            self._registerMonacoLanguages();
            resolve();
          });
        });
      });

      var playwrightPromise = self._playwrightMode
        ? loadScript('/js/playwright-compat/runner.js')
        : Promise.resolve();

      return Promise.all([v86Promise, monacoPromise, playwrightPromise]);
    });
  };

  TutorialCode.prototype._registerMonacoLanguages = function () {
    // Delegated to js/monaco-sebook-langs.js so popup windows can register
    // the same languages/themes against their own Monaco instance.
    if (window.SebookMonacoLangs) {
      window.SebookMonacoLangs.register(monaco);
      return;
    }
    // Fallback: keep the inline registration below if the shared file
    // didn't load for some reason.
    monaco.languages.register({ id: 'shell-sebook' });
    monaco.languages.setLanguageConfiguration('shell-sebook', {
      brackets: [['{', '}'], ['[', ']']],
      autoClosingPairs: [{ open: '{', close: '}' }, { open: '[', close: ']' },
      { open: '(', close: ')' }, { open: '"', close: '"' }, { open: "'", close: "'" }],
      surroundingPairs: [{ open: '{', close: '}' }, { open: '[', close: ']' }, { open: '(', close: ')' }],
    });
    monaco.languages.setMonarchTokensProvider('shell-sebook', {
      keywords: ['if', 'then', 'else', 'elif', 'fi', 'for', 'in', 'do', 'done', 'case', 'esac', 'while', 'until', 'function'],
      builtins: ['echo', 'set', 'cd', 'pwd', 'export', 'local', 'read', 'return', 'exit', 'grep', 'wc',
        'head', 'sort', 'uniq', 'cut', 'cat', 'mkdir', 'touch', 'rm', 'cp', 'mv', 'whoami', 'date', 'sleep', 'which'],
      tokenizer: {
        root: [
          [/^#!.*$/, 'comment.shell-sebook'],
          [/\b(if|then|else|elif|fi|for|in|do|done|case|esac|while|until|function)\b/, 'keyword.shell-sebook'],
          [/[\[\]]/, 'keyword.shell-sebook'],
          [/[a-zA-Z_][\w]*(?==)/, 'variable.shell-sebook'],
          [/[a-zA-Z_][\w]*/, { cases: { '@builtins': 'command.shell-sebook', '@default': 'command.shell-sebook' } }],
          [/\$([#?@$!*0-9]|\{?[\w]+\}?)/, 'variable.shell-sebook'],
          [/\$\(/, { token: 'variable.shell-sebook', next: '@interpolation' }],
          [/#.*$/, 'comment.shell-sebook'],
          [/"/, { token: 'string.shell-sebook', next: '@string' }],
          [/'/, { token: 'string.shell-sebook', next: '@sstring' }],
          [/\d+/, 'command.shell-sebook'],
          [/;;/, 'command.shell-sebook'],
          [/[ \t\r\n]+/, 'white'],
          [/[{}()]/, 'command.shell-sebook'],
          [/[<>|&;$]/, 'operator.shell-sebook'],
          [/-[\w-]+/, 'attribute.name.shell-sebook'],
          [/\+[\w-]+/, 'attribute.name.shell-sebook'],
        ],
        string: [
          [/\$\(/, { token: 'variable.shell-sebook', next: '@interpolation' }],
          [/\$([#?@$!*0-9]|\{?[\w]+\}?)/, 'variable.shell-sebook'],
          [/[^\\"$]+/, 'string.shell-sebook'],
          [/\\./, 'string.shell-sebook'],
          [/"/, { token: 'string.shell-sebook', next: '@pop' }],
        ],
        sstring: [
          [/[^\\']+/, 'string.shell-sebook'],
          [/\\./, 'string.shell-sebook'],
          [/'/, { token: 'string.shell-sebook', next: '@pop' }],
        ],
        interpolation: [
          [/\)/, { token: 'variable.shell-sebook', next: '@pop' }],
          { include: 'root' },
        ],
      },
    });

    // ---- Prolog Monarch tokenizer ----
    monaco.languages.register({ id: 'prolog' });
    monaco.languages.setLanguageConfiguration('prolog', {
      comments: { lineComment: '%', blockComment: ['/*', '*/'] },
      brackets: [['(', ')'], ['{', '}'], ['[', ']']],
      autoClosingPairs: [
        { open: '(', close: ')' }, { open: '[', close: ']' }, { open: '{', close: '}' },
        { open: '"', close: '"' }, { open: "'", close: "'" }
      ],
      surroundingPairs: [
        { open: '(', close: ')' }, { open: '[', close: ']' }, { open: '{', close: '}' }
      ],
    });
    monaco.languages.setMonarchTokensProvider('prolog', {
      keywords: ['is', 'not', 'true', 'fail', 'halt', 'assert', 'retract', 'asserta', 'assertz',
        'retractall', 'findall', 'bagof', 'setof', 'forall', 'between', 'succ', 'plus',
        'length', 'append', 'member', 'last', 'reverse', 'msort', 'sort', 'nth0', 'nth1',
        'write', 'writeln', 'nl', 'read', 'atom', 'number', 'var', 'nonvar', 'integer', 'float',
        'atom_string', 'atom_chars', 'atom_length', 'number_chars', 'number_codes',
        'char_code', 'sub_atom', 'atom_concat', 'copy_term', 'functor', 'arg',
        'ground', 'compound', 'callable', 'throw', 'catch'],
      operators: [':-', '?-', '-->', '->', ';', '\\+', '=', '\\=', '==', '\\==', '=:=', '=\\=',
        '<', '>', '>=', '=<', '@<', '@>', '@>=', '@=<', '+', '-', '*', '/', '//', 'mod',
        'rem', '**', 'is', '=..', '\\'],
      tokenizer: {
        root: [
          [/%.*$/, 'comment'],
          [/\/\*/, 'comment', '@blockComment'],
          [/\?-/, 'keyword'],
          [/:-/, 'keyword'],
          [/!/, 'keyword'],           // cut
          [/_[A-Za-z0-9_]*/, 'variable'], // anonymous / underscore vars
          [/[A-Z_][A-Za-z0-9_]*/, 'variable'], // variables
          [/'/, 'string', '@quotedAtom'],
          [/"/, 'string', '@string'],
          [/\d+(\.\d+)?([eE][+-]?\d+)?/, 'number'],
          [/0[xX][0-9a-fA-F]+/, 'number'],
          [/0[oO][0-7]+/, 'number'],
          [/0[bB][01]+/, 'number'],
          [/0'[^\s]/, 'number'],      // character code 0'a
          [/[a-z][A-Za-z0-9_]*/, {
            cases: {
              '@keywords': 'keyword',
              '@default': 'atom'
            }
          }],
          [/[+\-*/\\^<>=~:.?@#$&]+/, 'operator'],
          [/[\[\](){}|,;.]/, 'delimiter'],
          [/\s+/, 'white'],
        ],
        blockComment: [
          [/[^/*]+/, 'comment'],
          [/\*\//, 'comment', '@pop'],
          [/./, 'comment'],
        ],
        quotedAtom: [
          [/\\./, 'string'],
          [/[^'\\]+/, 'string'],
          [/'/, 'string', '@pop'],
        ],
        string: [
          [/\\./, 'string'],
          [/[^"\\]+/, 'string'],
          [/"/, 'string', '@pop'],
        ],
      },
    });

    // ---- Python Monarch tokenizer with f-string interpolation support ----
    monaco.languages.setMonarchTokensProvider('python', {
      defaultToken: '',
      tokenizer: {
        root: [
          // f-strings — rf/fr prefixes included, triple-quoted first
          [/[fF][rR]?"""/, { token: 'string.fstring', next: '@fstr_tdq' }],
          [/[rR][fF]"""/, { token: 'string.fstring', next: '@fstr_tdq' }],
          [/[fF][rR]?'''/, { token: 'string.fstring', next: '@fstr_tsq' }],
          [/[rR][fF]'''/, { token: 'string.fstring', next: '@fstr_tsq' }],
          [/[fF][rR]?"/, { token: 'string.fstring', next: '@fstr_dq' }],
          [/[rR][fF]?"/, { token: 'string.fstring', next: '@fstr_dq' }],
          [/[fF][rR]?'/, { token: 'string.fstring', next: '@fstr_sq' }],
          [/[rR][fF]?'/, { token: 'string.fstring', next: '@fstr_sq' }],
          // Regular strings
          [/[bBrRuU]{0,2}"""/, { token: 'string', next: '@str_tdq' }],
          [/[bBrRuU]{0,2}'''/, { token: 'string', next: '@str_tsq' }],
          [/[bBrRuU]{0,2}"/, { token: 'string', next: '@str_dq' }],
          [/[bBrRuU]{0,2}'/, { token: 'string', next: '@str_sq' }],
          // Comments
          [/#.*$/, 'comment'],
          // Decorators
          [/@[A-Za-z_][\w.]*/, 'tag'],
          // Keywords
          [/\b(?:False|None|True|and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield)\b/, 'keyword'],
          // Built-in functions
          [/\b(?:abs|all|any|ascii|bin|bool|breakpoint|bytearray|bytes|callable|chr|classmethod|compile|complex|delattr|dict|dir|divmod|enumerate|eval|exec|filter|float|format|frozenset|getattr|globals|hasattr|hash|help|hex|id|input|int|isinstance|issubclass|iter|len|list|locals|map|max|memoryview|min|next|object|oct|open|ord|pow|print|property|range|repr|reversed|round|set|setattr|slice|sorted|staticmethod|str|sum|super|tuple|type|vars|zip)\b/, 'support.function'],
          // self / cls
          [/\b(?:self|cls)\b/, 'variable.language'],
          // Numbers
          [/\b0[xX][0-9a-fA-F_]+\b/, 'number.hex'],
          [/\b0[bBoO][01_]+\b/, 'number'],
          [/\b\d[\d_]*\.[\d_]*(?:[eE][+-]?[\d_]+)?\b/, 'number.float'],
          [/\b\d[\d_]*[eE][+-]?[\d_]+\b/, 'number.float'],
          [/\b\d[\d_]*\b/, 'number'],
          // Identifiers
          [/[A-Za-z_]\w*/, 'identifier'],
          // Operators
          [/[+\-*/%&|^~<>=!@]+/, 'operator'],
          [/[,;:.]/, 'delimiter'],
          [/[(){}\[\]]/, '@brackets'],
          [/\s+/, ''],
        ],

        // f-string body states — {{ and }} are escaped literal braces
        fstr_dq: [
          [/"/, { token: 'string.fstring', next: '@pop' }],
          [/\\./, 'string.escape'],
          [/\{\{|\}\}/, 'string.fstring'],
          [/\{/, { token: 'string.fstring.delimiter', next: '@fstr_expr' }],
          [/[^"\\{]+/, 'string.fstring'],
        ],
        fstr_sq: [
          [/'/, { token: 'string.fstring', next: '@pop' }],
          [/\\./, 'string.escape'],
          [/\{\{|\}\}/, 'string.fstring'],
          [/\{/, { token: 'string.fstring.delimiter', next: '@fstr_expr' }],
          [/[^'\\{]+/, 'string.fstring'],
        ],
        fstr_tdq: [
          [/"""/, { token: 'string.fstring', next: '@pop' }],
          [/\\./, 'string.escape'],
          [/\{\{|\}\}/, 'string.fstring'],
          [/\{/, { token: 'string.fstring.delimiter', next: '@fstr_expr' }],
          [/"(?!"")/, 'string.fstring'],
          [/[^"\\{]+/, 'string.fstring'],
        ],
        fstr_tsq: [
          [/'''/, { token: 'string.fstring', next: '@pop' }],
          [/\\./, 'string.escape'],
          [/\{\{|\}\}/, 'string.fstring'],
          [/\{/, { token: 'string.fstring.delimiter', next: '@fstr_expr' }],
          [/'(?!'')/, 'string.fstring'],
          [/[^'\\{]+/, 'string.fstring'],
        ],

        // Inside {expression} — highlight as code
        fstr_expr: [
          [/}/, { token: 'string.fstring.delimiter', next: '@pop' }],
          // Track nested parens/brackets so inner } doesn't close the expression
          [/\(/, { token: '@brackets', next: '@fstr_paren' }],
          [/\[/, { token: '@brackets', next: '@fstr_bracket' }],
          // Inline strings in format spec
          [/"[^"]*"/, 'string'],
          [/'[^']*'/, 'string'],
          // Code tokens inside expression
          [/\b(?:not|and|or|in|is|if|else|for|lambda|None|True|False)\b/, 'keyword'],
          [/[A-Za-z_]\w*/, 'identifier'],
          [/\d[\d_]*\.[\d_]*(?:[eE][+-]?[\d_]+)?/, 'number.float'],
          [/\d[\d_]*/, 'number'],
          [/[+\-*/%&|^~<>=!@,.: ]+/, 'operator'],
        ],
        fstr_paren: [
          [/\)/, { token: '@brackets', next: '@pop' }],
          [/\(/, { token: '@brackets', next: '@push' }],
          [/[^()]*/, 'identifier'],
        ],
        fstr_bracket: [
          [/\]/, { token: '@brackets', next: '@pop' }],
          [/\[/, { token: '@brackets', next: '@push' }],
          [/[^[\]]*/, 'identifier'],
        ],

        // Regular string body states
        str_dq: [
          [/"/, { token: 'string', next: '@pop' }], [/\\./, 'string.escape'], [/[^"\\]+/, 'string'],
        ],
        str_sq: [
          [/'/, { token: 'string', next: '@pop' }], [/\\./, 'string.escape'], [/[^'\\]+/, 'string'],
        ],
        str_tdq: [
          [/"""/, { token: 'string', next: '@pop' }], [/\\./, 'string.escape'],
          [/"(?!"")/, 'string'], [/[^"\\]+/, 'string'],
        ],
        str_tsq: [
          [/'''/, { token: 'string', next: '@pop' }], [/\\./, 'string.escape'],
          [/'(?!'')/, 'string'], [/[^'\\]+/, 'string'],
        ],
      },
    });

    // JSX / TSX — custom Monarch tokenizer for JavaScript + JSX syntax
    monaco.languages.register({ id: 'jsx' });
    monaco.languages.setLanguageConfiguration('jsx', {
      comments: { lineComment: '//', blockComment: ['/*', '*/'] },
      brackets: [['{', '}'], ['[', ']'], ['(', ')'], ['<', '>']],
      autoClosingPairs: [
        { open: '{', close: '}' }, { open: '[', close: ']' },
        { open: '(', close: ')' }, { open: '"', close: '"' },
        { open: "'", close: "'" }, { open: '`', close: '`' },
      ],
      surroundingPairs: [
        { open: '{', close: '}' }, { open: '[', close: ']' },
        { open: '(', close: ')' }, { open: '"', close: '"' },
        { open: "'", close: "'" }, { open: '`', close: '`' },
        { open: '<', close: '>' },
      ],
      indentationRules: {
        increaseIndentPattern: /^.*(\{[^}"']*|\([^)"']*)$/,
        decreaseIndentPattern: /^\s*[}\)]/,
      },
    });
    monaco.languages.setMonarchTokensProvider('jsx', {
      defaultToken: '',
      tokenPostfix: '.jsx',
      keywords: [
        'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
        'default', 'delete', 'do', 'else', 'enum', 'export', 'extends',
        'false', 'finally', 'for', 'from', 'function', 'get', 'if',
        'implements', 'import', 'in', 'instanceof', 'interface', 'let',
        'new', 'null', 'of', 'package', 'private', 'protected', 'public',
        'return', 'set', 'static', 'super', 'switch', 'this', 'throw',
        'true', 'try', 'typeof', 'undefined', 'var', 'void', 'while',
        'with', 'yield', 'async', 'await',
      ],
      typeKeywords: ['any', 'boolean', 'number', 'object', 'string', 'symbol'],
      operators: [
        '<=', '>=', '==', '!=', '===', '!==', '=>', '+', '-', '**',
        '*', '/', '%', '++', '--', '<<', '>>', '>>>', '&', '|', '^',
        '!', '~', '&&', '||', '??', '?', ':', '=', '+=', '-=', '*=',
        '**=', '/=', '%=', '<<=', '>>=', '>>>=', '&=', '|=', '^=',
        '&&=', '||=', '??=', '...', '?.', 'as',
      ],
      symbols: /[=><!~?:&|+\-*\/\^%]+/,
      escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
      digits: /\d+(_+\d+)*/,

      tokenizer: {
        root: [
          // JSX self-closing: <Component ... />
          [/(<)(\/?)([A-Z][a-zA-Z0-9.]*)/, ['delimiter.tag', 'delimiter.tag', { token: 'type.identifier.tag', next: '@jsxTag' }]],
          // JSX HTML tags: <div ...>
          [/(<)(\/?)([a-z][a-zA-Z0-9\-]*)/, ['delimiter.tag', 'delimiter.tag', { token: 'tag', next: '@jsxTag' }]],
          // JSX fragment: <> or </>
          [/<\/>/, 'delimiter.tag'],
          [/<>/, 'delimiter.tag'],
          // identifiers and keywords
          [/[a-zA-Z_$][\w$]*/, {
            cases: {
              '@keywords': 'keyword',
              '@typeKeywords': 'type',
              '@default': 'identifier',
            },
          }],
          // whitespace & comments
          { include: '@whitespace' },
          // numbers
          [/(@digits)[eE]([\-+]?(@digits))?/, 'number.float'],
          [/(@digits)\.(@digits)([eE][\-+]?(@digits))?/, 'number.float'],
          [/0[xX][\da-fA-F]+/, 'number.hex'],
          [/0[oO][0-7]+/, 'number.octal'],
          [/0[bB][01]+/, 'number.binary'],
          [/@digits/, 'number'],
          // strings
          [/"([^"\\]|\\.)*$/, 'string.invalid'],
          [/'([^'\\]|\\.)*$/, 'string.invalid'],
          [/"/, 'string', '@string_dq'],
          [/'/, 'string', '@string_sq'],
          [/`/, 'string.template', '@string_bt'],
          // delimiter/operators
          [/[{}()\[\]]/, '@brackets'],
          [/@symbols/, {
            cases: {
              '@operators': 'operator',
              '@default': '',
            },
          }],
          [/[;,.]/, 'delimiter'],
        ],

        // Inside a JSX tag (attributes)
        jsxTag: [
          [/\s+/, ''],
          [/([\w\-]+)(\s*)(=)/, ['attribute.name', '', 'delimiter']],
          [/"[^"]*"/, 'attribute.value'],
          [/'[^']*'/, 'attribute.value'],
          [/\{/, { token: 'delimiter.bracket', next: '@jsxExpr' }],
          [/\/?>/, { token: 'delimiter.tag', next: '@pop' }],
          [/[\w\-]+/, 'attribute.name'],
        ],

        // JSX expression { ... } inside tags
        jsxExpr: [
          [/\{/, 'delimiter.bracket', '@push'],
          [/\}/, 'delimiter.bracket', '@pop'],
          { include: 'root' },
        ],

        whitespace: [
          [/[ \t\r\n]+/, ''],
          [/\/\*/, 'comment', '@comment'],
          [/\/\/.*$/, 'comment'],
        ],

        comment: [
          [/[^\/*]+/, 'comment'],
          [/\*\//, 'comment', '@pop'],
          [/[\/*]/, 'comment'],
        ],

        string_dq: [
          [/[^\\"]+/, 'string'],
          [/@escapes/, 'string.escape'],
          [/\\./, 'string.escape.invalid'],
          [/"/, 'string', '@pop'],
        ],

        string_sq: [
          [/[^\\']+/, 'string'],
          [/@escapes/, 'string.escape'],
          [/\\./, 'string.escape.invalid'],
          [/'/, 'string', '@pop'],
        ],

        string_bt: [
          [/\$\{/, { token: 'string.template.delimiter', next: '@templateExpr' }],
          [/[^\\`$]+/, 'string.template'],
          [/@escapes/, 'string.escape'],
          [/\\./, 'string.escape.invalid'],
          [/`/, 'string.template', '@pop'],
        ],

        templateExpr: [
          [/\{/, 'delimiter.bracket', '@push'],
          [/\}/, { token: 'string.template.delimiter', next: '@pop' }],
          { include: 'root' },
        ],
      },
    });

    monaco.editor.defineTheme('sebook-light', {
      base: 'vs', inherit: true,
      rules: [
        { token: 'keyword.shell-sebook', foreground: '0000ff' },
        { token: 'command.shell-sebook', foreground: '267f99' },
        { token: 'variable.shell-sebook', foreground: '001080' },
        { token: 'attribute.name.shell-sebook', foreground: 'a31515' },
        { token: 'string.shell-sebook', foreground: 'a31515' },
        { token: 'comment.shell-sebook', foreground: '008000' },
        // f-string interpolation delimiters — blue to signal "code zone"
        { token: 'string.fstring.delimiter', foreground: '0451a5' },
        // Prolog tokens
        { token: 'atom', foreground: 'a31515' },
        // JSX tokens
        { token: 'tag.jsx', foreground: '800000' },
        { token: 'type.identifier.tag.jsx', foreground: '267f99' },
        { token: 'delimiter.tag.jsx', foreground: '800000' },
        { token: 'attribute.name.jsx', foreground: 'e50000' },
        { token: 'attribute.value.jsx', foreground: '0451a5' },
      ],
      colors: {},
    });
    monaco.editor.defineTheme('sebook-dark', {
      base: 'vs-dark', inherit: true,
      rules: [
        // Plain text / identifiers / operators: pure white. Against #08090c
        // background that's a 19.6:1 contrast — well past WCAG-AAA.
        { token: '', foreground: 'ffffff' },
        // Override the common vs-dark token colors with high-saturation,
        // high-luminance values so EVERY language (Python, JS, Java, C, …)
        // gets the bumped contrast — not just shell-sebook.
        { token: 'keyword',     foreground: '8ec5ff' },   // was #569cd6
        { token: 'comment',     foreground: 'a8d8a8' },   // was #6a9955
        { token: 'string',      foreground: 'ffb88c' },   // was #ce9178
        { token: 'number',      foreground: 'd4f0b0' },   // was #b5cea8
        { token: 'type',        foreground: '7eecd0' },   // was #4ec9b0
        { token: 'function',    foreground: 'fff0a0' },
        { token: 'variable',    foreground: 'ffffff' },
        { token: 'identifier',  foreground: 'ffffff' },
        { token: 'delimiter',   foreground: 'd0d0d0' },
        { token: 'operator',    foreground: 'd0d0d0' },
        { token: 'constant',    foreground: 'c8b0ff' },
        { token: 'tag',         foreground: '8ec5ff' },
        { token: 'attribute',   foreground: 'd4f0b0' },
        // Custom shell-sebook tokens.
        { token: 'keyword.shell-sebook',        foreground: '8ec5ff' },
        { token: 'command.shell-sebook',        foreground: '7eecd0' },
        { token: 'variable.shell-sebook',       foreground: 'd4eaff' },
        { token: 'attribute.name.shell-sebook', foreground: 'ff8e8e' },
        { token: 'string.shell-sebook',         foreground: 'ffb88c' },
        { token: 'comment.shell-sebook',        foreground: 'a8d8a8' },
        { token: 'string.fstring.delimiter',    foreground: '8ec5ff' },
        { token: 'atom',                        foreground: 'ffb88c' },
        // JSX
        { token: 'tag.jsx',                     foreground: '8ec5ff' },
        { token: 'type.identifier.tag.jsx',     foreground: '7eecd0' },
        { token: 'delimiter.tag.jsx',           foreground: 'b5b5b5' },
        { token: 'attribute.name.jsx',          foreground: 'd4eaff' },
        { token: 'attribute.value.jsx',         foreground: 'ffb88c' },
      ],
      colors: {
        // Near-true-black background. Pushed all the way down to #050608 so
        // the new pure-white foreground reads at near-max contrast (~20.4:1).
        'editor.background':                    '#050608',
        'editor.foreground':                    '#ffffff',
        // Gutter / line numbers — visible against the darker background.
        'editorLineNumber.foreground':          '#8a8d96',
        'editorLineNumber.activeForeground':    '#ffffff',
        'editorIndentGuide.background':         '#1c1d22',
        'editorIndentGuide.activeBackground':   '#3e404a',
        // Selection bumped to a slightly brighter blue so it pops on near-black.
        'editor.selectionBackground':           '#3a5a8c',
        'editor.inactiveSelectionBackground':   '#2c3e5e',
        'editor.lineHighlightBackground':       '#0d0e13',
        'editor.lineHighlightBorder':           '#0d0e13',
        'editorCursor.foreground':              '#ffffff',
        // Bracket pair colorization stays distinct against pure black.
        'editorBracketHighlight.foreground1':   '#ffe066',
        'editorBracketHighlight.foreground2':   '#ff8c66',
        'editorBracketHighlight.foreground3':   '#a78bfa',
        // Find/replace match highlight visible without washing out.
        'editor.findMatchBackground':           '#5e4a18',
        'editor.findMatchHighlightBackground':  '#3a2e10',
      },
    });
  };

  // ---------------------------------------------------------------------------
  // Terminal (xterm.js) — v86 + webcontainer only
  // ---------------------------------------------------------------------------
  var THEMES = {
    dark: {
      monaco: 'sebook-dark',
      xterm: {
        background: '#1e1e1e', foreground: '#d4d4d4', cursor: '#d4d4d4', selectionBackground: '#264f78',
        black: '#1e1e1e', red: '#f44747', green: '#6a9955', yellow: '#d7ba7d', blue: '#569cd6',
        magenta: '#c586c0', cyan: '#4ec9b0', white: '#d4d4d4',
        brightBlack: '#808080', brightRed: '#f44747', brightGreen: '#b5cea8',
        brightYellow: '#d7ba7d', brightBlue: '#9cdcfe', brightMagenta: '#c586c0',
        brightCyan: '#4fc1ff', brightWhite: '#e6e6e6'
      }
    },
    light: {
      monaco: 'sebook-light',
      xterm: {
        background: '#ffffff', foreground: '#383a42', cursor: '#383a42', selectionBackground: '#add6ff',
        black: '#383a42', red: '#e45649', green: '#50a14f', yellow: '#986801', blue: '#4078f2',
        magenta: '#a626a4', cyan: '#0184bc', white: '#fafafa',
        brightBlack: '#4f525e', brightRed: '#e06c75', brightGreen: '#98c379',
        brightYellow: '#e5c07b', brightBlue: '#61afef', brightMagenta: '#c678dd',
        brightCyan: '#56b6c2', brightWhite: '#ffffff'
      }
    },
  };

  TutorialCode.prototype._isDarkMode = function () {
    return document.documentElement.classList.contains('dark-mode');
  };

  TutorialCode.prototype._applyTheme = function (isDark) {
    var theme = isDark ? THEMES.dark : THEMES.light;
    if (this.editor) monaco.editor.setTheme(theme.monaco);
    if (this.term) {
      if (typeof this.term.setOption === 'function') this.term.setOption('theme', theme.xterm);
      else this.term.options.theme = theme.xterm;
    }
    if (this.gitTerm) {
      if (typeof this.gitTerm.setOption === 'function') this.gitTerm.setOption('theme', theme.xterm);
      else this.gitTerm.options.theme = theme.xterm;
    }
  };

  TutorialCode.prototype._initTerminal = function () {
    var self = this;
    var isDark = this._isDarkMode();
    var TermClass = window.Terminal;
    this.term = new TermClass({
      cursorBlink: true,
      fontSize: this.config.fontSize,
      fontFamily: "'Fira Code', 'Cascadia Code', Menlo, monospace",
      theme: isDark ? THEMES.dark.xterm : THEMES.light.xterm,
      scrollback: 5000,
      convertEol: true,
    });
    var FitAddonClass = (window.FitAddon && window.FitAddon.FitAddon)
      ? window.FitAddon.FitAddon : window.FitAddon;
    this.fitAddon = new FitAddonClass();
    this.term.loadAddon(this.fitAddon);
    this.term.open(this.terminalContainerEl);
    this.term.focus();
    // Sync terminal size to the backend whenever xterm reports a resize
    this.term.onResize(function (size) {
      self._syncTerminalSize(size.cols, size.rows);
    });
    setTimeout(function () { self.fitAddon.fit(); }, 100);
    if (window.ResizeObserver) {
      var t; var ro = new ResizeObserver(function () {
        clearTimeout(t); t = setTimeout(function () {
          if (self.fitAddon) { try { self.fitAddon.fit(); } catch (e) { } }
        }, 50);
      });
      ro.observe(this.terminalContainerEl);
    }
  };

  // Send terminal dimensions to the active backend so readline/bash wrap correctly.
  TutorialCode.prototype._syncTerminalSize = function (cols, rows) {
    // Skip if dimensions haven't changed
    if (this._lastStty && this._lastStty.cols === cols && this._lastStty.rows === rows) return;
    this._lastStty = { cols: cols, rows: rows };
    var backend = this.config.backend;
    if (backend === 'v86') {
      if (this.emulator && this.booted) {
        this._runSilent('stty cols ' + cols + ' rows ' + rows);
      } else {
        // Store so _setupFilesystem can apply it after boot
        this._pendingStty = { cols: cols, rows: rows };
      }
    } else if (backend === 'webcontainer') {
      if (this._shellProcess && typeof this._shellProcess.resize === 'function') {
        try { this._shellProcess.resize({ cols: cols, rows: rows }); } catch (e) { }
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Backend Initialisation — routes to v86 / pyodide / webcontainer
  // ---------------------------------------------------------------------------
  TutorialCode.prototype._initBackend = function () {
    var backend = this.config.backend;
    if (backend === 'v86') return this._initV86();
    if (backend === 'pyodide') return this._initPyodide();
    if (backend === 'webcontainer') {
      var self = this;
      return this._initWebContainer().catch(function (err) {
        self._webcontainerUnavailableReason = err && (err.message || String(err)) || 'unknown error';
        console.warn('[TutorialCode] WebContainer unavailable; falling back to browser backend:', err);
        self.config.backend = 'browser';
        self.config.useTerminal = false;
        self._showLoading('WebContainer unavailable — using browser Node sandbox…');
        return self._initBrowserBackend();
      });
    }
    if (backend === 'react') return this._initReactBackend();
    if (backend === 'browser') return this._initBrowserBackend();
    if (backend === 'sql') return this._initSQL();
    if (backend === 'prolog') return this._initProlog();
    if (backend === 'java') return this._initJava();
    return Promise.reject(new Error('Unknown backend: ' + backend));
  };

  // ---- v86 backend ----------------------------------------------------------
  TutorialCode.prototype._loadSnapshot = function () {
    if (!this.config.useSnapshot) return Promise.resolve(null);
    if (typeof DecompressionStream === 'undefined') return Promise.resolve(null);
    var self = this;
    var url = this.config.vmPath + '/' + this.config.snapshotName;
    return fetch(url).then(function (r) {
      if (!r.ok) return null;
      self._vmSnapshotAssetId = responseValidatorId(r);
      var stream = r.body.pipeThrough(new DecompressionStream('gzip'));
      return new Response(stream).arrayBuffer();
    }).then(function (buf) {
      // Feed v86 the ArrayBuffer directly. A blob URL makes v86 fetch the
      // already-decompressed state a second time, adding avoidable copy/IO
      // overhead on the startup path.
      return buf || null;
    }).catch(function () { return null; });
  };

  TutorialCode.prototype._initV86 = function () {
    var self = this;
    this._showLoading('Booting Linux \u2014 this may take a few seconds\u2026');
    return self._loadSnapshot().then(function (snapshotBuffer) {
      self._usingSnapshot = !!snapshotBuffer;
      if (snapshotBuffer) {
        self._showLoading('Restoring VM snapshot\u2026');
      }
      return new Promise(function (resolve, reject) {
      try {
        var v86Config = {
          wasm_path: self.config.v86Path + '/v86.wasm',
          memory_size: self.config.memoryMB * 1024 * 1024,
          vga_memory_size: 2 * 1024 * 1024,
          bios: { url: self.config.v86Path + '/seabios.bin' },
          vga_bios: { url: self.config.v86Path + '/vgabios.bin' },
          cmdline: 'console=ttyS0 rw quiet',
          autostart: true, disable_keyboard: true,
          disable_mouse: true, disable_speaker: true, screen_dummy: true,
          virtio_console: true,
          filesystem: {},
        };
        if (snapshotBuffer) {
          // Snapshot already contains the kernel + extracted initrd in RAM,
          // so skip the bzImage + rootfs.cpio.gz fetches (~44 MB saved).
          v86Config.initial_state = { buffer: snapshotBuffer };
        } else {
          v86Config.bzimage = { url: self.config.vmPath + '/bzImage' };
          v86Config.initrd  = { url: self.config.vmPath + '/rootfs.cpio.gz' };
        }
        self.emulator = new V86(v86Config);
        if (self._initRPCChannel) self._initRPCChannel();

        // xterm ↔ serial
        self.term.onData(function (data) {
          self.emulator.serial0_send(data);
          if (data === '\r' || data === '\n') {
            var m = self._inputLine.match(/chmod\s+\+x\s+(\S+)/);
            if (m) self._executableFiles.add(m[1].replace(/^\.\//, '').replace(/^\/tutorial\//, ''));
            self._inputLine = '';
          } else if (data === '\x7f' || data === '\b') {
            self._inputLine = self._inputLine.slice(0, -1);
          } else { self._inputLine += data; }
        });

        self._muteCount = 1;  // mute all output until _setupFilesystem clears and unmutes
        self.emulator.add_listener('serial0-output-byte', function (byte) {
          var ch = String.fromCharCode(byte);
          var serialMuted = self._muteCount > 0 ||
            (self._silentListeners && self._silentListeners.length > 0);
          if (!serialMuted) {
            if (self._visFilterMarker) {
              // Buffer all bytes until the marker appears somewhere in the stream.
              // Using indexOf lets us find the marker regardless of where it sits
              // in the line (e.g. "git init myproject #__VIS_xxx").
              self._visFilterBuf += ch;
              var mi = self._visFilterBuf.indexOf(self._visFilterMarker);
              if (mi !== -1) {
                // Write everything before the marker, suppress the marker itself
                if (mi > 0) self.term.write(self._visFilterBuf.slice(0, mi));
                self._visFilterBuf = '';
                self._visFilterMarker = null;
              }
              // else: keep buffering
            } else {
              self.term.write(ch);
            }
          }
          if (self._testListening) { self._testBuffer += ch; self._parseTestOutput(); }
          // On every shell prompt: refresh open editor files and (if visible) the git graph.
          if (!serialMuted) {
            self._promptDetectBuf = (self._promptDetectBuf || '') + ch;
            if (self._promptDetectBuf.length > 40) {
              self._promptDetectBuf = self._promptDetectBuf.slice(-40);
            }
            if (/[#$] $/.test(self._promptDetectBuf)) {
              self._promptDetectBuf = '';
              self._pollWatchedFiles();
              if (self._currentView === 'git_graph' && !self._gitGraphRefreshing) {
                self._maybeAutoRefreshGitGraph();
              }
              // Git gutter: any user command may have moved HEAD (commit /
              // checkout / reset) or changed the working tree (checkout / mv
              // / external editor). Schedule a debounced refresh so we don't
              // spam the silent-command queue when the user types many
              // commands in quick succession.
              //
              // Skip while a refresh is already in flight — each gutter refresh
              // queues N silent commands (one per open file), and every silent
              // command's marker-detected unmute leaves a fresh prompt visible
              // to this listener. Without the guard, that prompt schedules
              // another refresh in 250ms, which schedules another, forever.
              // Mirrors the !_gitGraphRefreshing check just above.
              if (self.config.enableGitGutter && !self._gitGutterRefreshing && !self._isBackgroundSyncPaused()) {
                clearTimeout(self._gitGutterPromptTimer);
                self._gitGutterPromptTimer = setTimeout(function () {
                  self._refreshAllGitGutters();
                }, 250);
              }
            }
          }
        });

        var bootOutput = '', promptDetected = false;
        function onBoot(byte) {
          bootOutput += String.fromCharCode(byte);
          if (!promptDetected && (bootOutput.includes('$ ') || bootOutput.includes('# ') || bootOutput.includes(':~'))) {
            promptDetected = true; self.booted = true;
            self.emulator.remove_listener('serial0-output-byte', onBoot);
            self._setupFilesystem().then(resolve);
          }
        }
        self.emulator.add_listener('serial0-output-byte', onBoot);

        // After snapshot restore, the shell is already running and won't
        // re-emit boot output. Nudge with a newline so onBoot can detect
        // the fresh prompt the shell prints in response.
        if (snapshotBuffer) {
          setTimeout(function () {
            if (!promptDetected) self.emulator.serial0_send('\n');
          }, 500);
        }

        setTimeout(function () {
          if (!promptDetected) {
            self.emulator.remove_listener('serial0-output-byte', onBoot);
            self.booted = true;
            console.warn('TutorialCode: boot prompt not detected, continuing anyway.');
            self._setupFilesystem().then(resolve);
          }
        }, 30000);
      } catch (err) { reject(err); }
      });
    });
  };

  TutorialCode.prototype._setupFilesystem = function () {
    var self = this;
    if (self._usingSnapshot) {
      self._showLoading('Preparing tutorial\u2026');
    }
    // Sync terminal dimensions so bash/readline wraps at the correct column
    var cols = (this._pendingStty && this._pendingStty.cols) || (this.term && this.term.cols) || 80;
    var rows = (this._pendingStty && this._pendingStty.rows) || (this.term && this.term.rows) || 24;
    this._pendingStty = null;
    this._lastStty = { cols: cols, rows: rows };
    // Batch all init commands into a single _runSilent call so there is only
    // one marker/prompt detection cycle regardless of how many setup commands
    // there are.  Once the shell confirms they have all completed, clear the
    // terminal immediately via xterm so the user always starts with a clean slate.
    // HISTIGNORE pattern matches the marker suffix that every _runSilent /
    // _runVisible call appends (e.g. " #__SIL_a1b2c3d4"), so bash skips those
    // lines at history-insert time regardless of whether HISTCONTROL is in
    // effect yet — closes the chicken-and-egg gap on the very first boot line.
    var histIgnore = "'*#__SIL_*:*#__VIS_*'";
    // User-command-listener PROMPT_COMMAND hook. Baked into the boot init so
    // it's captured by the post-boot snapshot used for "commands" resets.
    // Stays idle — the function returns immediately — until a step sets
    // $__USER_CMD_LISTENER via _updateUserCmdListener, so tutorials that
    // don't use this feature pay nothing. HISTIGNORE above excludes every
    // _runSilent / _runVisible call (they carry a #__SIL_* marker), so
    // `history 1` always returns the last USER-typed command.
    var userCmdHook =
      '__USER_CMD_LISTENER=""; __LAST_HISTCMD=""; ' +
      '__record_user_cmd() { ' +
        '[ -z "$__USER_CMD_LISTENER" ] && return; ' +
        'local h num cmd; ' +
        'h=$(HISTTIMEFORMAT= history 1) || return; ' +
        'num=$(printf "%s" "$h" | sed -n "s/^[[:space:]]*\\([0-9][0-9]*\\).*/\\1/p"); ' +
        'cmd=$(printf "%s" "$h" | sed "s/^[[:space:]]*[0-9][0-9]*[[:space:]]*//"); ' +
        '[ -z "$cmd" ] && return; ' +
        '[ "$num" = "$__LAST_HISTCMD" ] && return; ' +
        '__LAST_HISTCMD="$num"; ' +
        'printf "%s\\n" "$cmd" | eval "$__USER_CMD_LISTENER"; ' +
      '}; ' +
      'case ";$PROMPT_COMMAND;" in *";__record_user_cmd;"*) ;; *) PROMPT_COMMAND="__record_user_cmd${PROMPT_COMMAND:+;$PROMPT_COMMAND}";; esac';
    var setupCommands = self.setupCommands || [];
    var setupBatch = setupCommands.join('\n');
    var startDir = self.gitGraphPath
      ? 'cd ' + shellQuote(self.gitGraphPath) + ' 2>/dev/null || cd /tutorial'
      : 'cd /tutorial';
    var initParts = [startDir,
                     'export LANG=C.UTF-8',
                     'export LESSCHARSET=utf-8',
                     'export HISTCONTROL=ignoreboth',
                     'export HISTIGNORE=' + histIgnore,
                     'stty cols ' + cols + ' rows ' + rows,
                     userCmdHook];
    function runInteractiveInit(extraCommands) {
      var parts = initParts.slice();
      if (extraCommands && extraCommands.length) parts = parts.concat(extraCommands);
      return self._runSilent(parts.join('\n')).then(function () {
        return self._runSilent('history -c');
      });
    }
    function saveInitialState() {
      if (self.resetType === 'commands' && self.emulator && self.emulator.save_state) {
        return self.emulator.save_state().then(function (state) {
          self._initialVMState = state;
          self._storeCachedSnapshot('initial', 0, state);
        });
      }
      return Promise.resolve();
    }
    function installInitialShellHooks() {
      if (self.gitGraphPath) return self._installGitGraphPromptHook();
      return Promise.resolve();
    }
    var cachedInitial = Promise.resolve(false);
    if (self.resetType === 'commands' && self.emulator && self.emulator.restore_state) {
      cachedInitial = self._loadCachedSnapshot('initial', 0).then(function (state) {
        if (!state) return false;
        return self.emulator.restore_state(state).then(function () {
          self._initialVMState = state;
          self._resetSerialState('cached initial VM state');
          return runInteractiveInit()
            .then(installInitialShellHooks)
            .then(function () { return true; });
        }).catch(function () { return false; });
      });
    }
    // Stay muted after setup — _refreshPrompt will clear and unmute once
    // the full restore sequence (files + commands) has finished.
    return cachedInitial.then(function (restoredFromCache) {
      if (restoredFromCache) return Promise.resolve();
      var setupPromise = Promise.resolve(false);
      if (setupBatch && self.config.backend === 'v86') {
        setupPromise = self._probeRPCDaemon().then(function (avail) {
          if (!avail) return false;
          return self._runRPC(setupBatch, { timeout: 60000 }).then(
            function () { return true; },
            function () { return false; }
          );
        });
      }
      return setupPromise.then(function (setupRanOutOfBand) {
        return runInteractiveInit(setupRanOutOfBand ? [] : setupCommands);
      }).then(installInitialShellHooks).then(saveInitialState);
    });
  };

  // Clear the terminal, unmute output, then redraw the bash prompt.
  // Called once the full init + restore sequence is done.
  /**
   * Reset all JS-side serial/queue state after a VM restore_state().
   * The VM is back to its post-boot snapshot, so any in-flight _runSilent
   * listeners will never fire.  We must clear the queue, reset mute count,
   * and mark shell-level hooks (like the git-graph PROMPT_COMMAND) as
   * uninstalled since the shell no longer has them.
   */
  TutorialCode.prototype._resetSerialState = function () {
    var self = this;
    // Remove every in-flight _runSilent listener and its timer BEFORE
    // resetting muteCount. The VM state was restored so their markers will
    // never arrive; left alone their 30s timers would fire later and
    // decrement muteCount below zero, permanently muting the terminal (and
    // causing silent commands like the periodic stty to echo visibly).
    // We do NOT call entry.resolve() — the chained .then() callbacks
    // (e.g. _saveStepEntrySnapshot after a setup_commands batch) were
    // designed for the pre-restore VM and would do the wrong thing now.
    if (self._silentListeners && self._silentListeners.length > 0) {
      self._silentListeners.forEach(function (reg) {
        reg.cleaned = true;
        if (self.emulator && reg.onByte) {
          try { self.emulator.remove_listener('serial0-output-byte', reg.onByte); } catch (e) { }
        }
        if (reg.timer) clearTimeout(reg.timer);
      });
    }
    self._silentListeners = [];
    // Keep output muted until the restore sequence finishes. _refreshPrompt
    // will set this back to 0 and redraw the prompt exactly once.
    this._muteCount = 1;
    this._silentQueue = [];
    this._silentRunning = false;
    this._gitGraphHookInstalled = false;
    this._gitGraphHookMode = null;
    this._activeUserCmdListener = '';
    this._resetRPCState('VM restored');
    // Clear the in-flight refresh guard. An active _refreshGitGraph chain
    // was waiting on a _runSilent(dumpCmd) whose listener we just removed,
    // so its .then that would have cleared this flag will never fire —
    // without this, the reveal's _refreshGitGraph() returns early for up
    // to 10s (the safety timeout) and the graph never re-renders.
    this._gitGraphRefreshing = false;
    // _lastStty is a JS-side cache of the last stty dimensions pushed to the
    // VM. After restore_state the VM's actual stty is whatever was captured
    // in the snapshot — if xterm has since resized, _syncTerminalSize will
    // skip the re-send because it thinks dimensions match. Clear the cache
    // so the next fit() re-syncs.
    this._lastStty = null;
  };

  TutorialCode.prototype._refreshPrompt = function () {
    if (this.config.backend === 'v86') {
      var self = this;
      this._terminalReadyForInput = false;
      if (this._silentRunning || (this._silentQueue && this._silentQueue.length > 0)) {
        return this._waitForSilentIdle(2500).then(function (idle) {
          return idle ? self._refreshPrompt() : false;
        });
      }
      if (this.term) this.term.clear();
      this._muteCount = 0;
      this._promptDetectBuf = '';
      if (this.emulator) {
        this.emulator.serial0_send('\n');
        this._schedulePromptRedrawFallback();
      }
      return this._waitForTerminalText(2500).then(function (visible) {
        self._terminalReadyForInput = true;
        return visible;
      });
    } else if (this.config.backend === 'webcontainer') {
      if (this._shellWriter) this._shellWriter.write('\n');
    }
    return Promise.resolve();
  };

  TutorialCode.prototype._canRunLegacyBackgroundSerial = function () {
    return this.config.backend === 'v86' &&
      (!this._terminalReadyForInput || this._isBackgroundSyncPaused());
  };

  TutorialCode.prototype._logLegacyBackgroundSerialSkip = function (feature) {
    if (this._legacySerialBackgroundSkipLogged) return;
    this._legacySerialBackgroundSkipLogged = true;
    console.info(
      '[TutorialCode] Skipping legacy serial fallback for ' + feature +
      ' because the interactive terminal is ready. Background git features ' +
      'will retry through the daemon or use cached state instead.'
    );
  };

  TutorialCode.prototype._terminalHasVisibleText = function () {
    if (!this.term || !this.term.buffer || !this.term.buffer.active) return false;
    var buffer = this.term.buffer.active;
    for (var i = 0; i < buffer.length; i++) {
      var line = buffer.getLine(i);
      if (line && line.translateToString(true).trim()) return true;
    }
    return false;
  };

  TutorialCode.prototype._schedulePromptRedrawFallback = function () {
    var self = this;
    clearTimeout(this._promptRedrawTimer);
    this._promptRedrawTimer = setTimeout(function () {
      if (self.config.backend !== 'v86') return;
      if (!self.emulator || !self.term) return;
      if (self._muteCount !== 0) return;
      if (self._terminalHasVisibleText()) return;
      self.emulator.serial0_send('\n');
    }, 250);
  };

  TutorialCode.prototype._waitForTerminalText = function (timeoutMs) {
    var self = this;
    var started = Date.now();
    return new Promise(function (resolve) {
      function check() {
        if (self._terminalHasVisibleText()) {
          resolve(true);
          return;
        }
        if (Date.now() - started >= (timeoutMs || 0)) {
          resolve(false);
          return;
        }
        setTimeout(check, 50);
      }
      check();
    });
  };

  TutorialCode.prototype._waitForSilentIdle = function (timeoutMs) {
    var self = this;
    var started = Date.now();
    return new Promise(function (resolve) {
      function check() {
        var pending = self._silentRunning ||
          (self._silentQueue && self._silentQueue.length > 0) ||
          (self._silentListeners && self._silentListeners.length > 0);
        if (!pending) {
          resolve(true);
          return;
        }
        if (Date.now() - started >= (timeoutMs || 0)) {
          resolve(false);
          return;
        }
        setTimeout(check, 50);
      }
      check();
    });
  };

  TutorialCode.prototype.sendCommand = function (cmd) {
    if (this.config.backend === 'v86') {
      if (this.emulator) this.emulator.serial0_send(cmd + '\n');
    } else if (this.config.backend === 'webcontainer') {
      if (this._shellWriter) this._shellWriter.write(cmd + '\n');
    }
    // pyodide: no interactive shell command
  };

  // ---------------------------------------------------------------------------
  // RPC daemon — out-of-band channel for background sync queries
  //
  // Why: v86 has one serial port shared by user input, user output, and (until
  // now) every "silent" sync command we ran from JS. Muting the terminal while
  // a silent command was in flight ate the user's keystroke echoes if they
  // typed concurrently. The daemon (vm/overlay/gg-daemon, started by /init)
  // runs in a separate process, communicating with JS via virtio-console:
  //
  //   JS      → daemon: R <id> <base64 shell script>
  //   daemon  → JS:     D <id> <exit-code> <base64 stdout+stderr>
  //   daemon  → JS:     G <base64 repo path> <base64 git graph state>
  //
  // No serial traffic. No muting. Zero interference with user typing.
  //
  // Old snapshots (without the daemon or virtio console) still work during
  // boot/setup: probe failures can fall back to _runSilent while the terminal
  // is hidden. Once the interactive prompt is visible, background git features
  // must not use serial fallback; they retry the daemon or use cached state.
  // ---------------------------------------------------------------------------

  TutorialCode.prototype._initRPCChannel = function () {
    if (!this.emulator || this._rpcListenerInstalled) return;
    var self = this;
    this._rpcListenerInstalled = true;
    this.emulator.add_listener('virtio-console0-output-bytes', function (bytes) {
      var chunk = '';
      try { chunk = new TextDecoder('utf-8').decode(bytes); }
      catch (e) { return; }
      self._rpcBuf += chunk;
      var idx;
      while ((idx = self._rpcBuf.indexOf('\n')) !== -1) {
        var line = self._rpcBuf.slice(0, idx).replace(/\r$/, '');
        self._rpcBuf = self._rpcBuf.slice(idx + 1);
        if (line) self._handleRPCLine(line);
      }
      if (self._rpcBuf.length > 1024 * 1024) self._rpcBuf = '';
    });
  };

  TutorialCode.prototype._handleRPCLine = function (line) {
    var parts = line.split(' ');
    var kind = parts[0];
    if (kind === 'D') {
      var id = parts[1];
      var status = parseInt(parts[2] || '0', 10);
      var payload = parts.slice(3).join('');
      var pending = this._rpcPending && this._rpcPending[id];
      if (!pending) return;
      delete this._rpcPending[id];
      clearTimeout(pending.timer);
      var text = '';
      try { text = b64DecodeUtf8(payload); }
      catch (e) { text = ''; }
      pending.resolve({ status: isNaN(status) ? 0 : status, text: text });
      return;
    }
    if (kind === 'G') {
      var repo = '';
      var state = '';
      try {
        repo = b64DecodeUtf8(parts[1] || '');
        state = b64DecodeUtf8(parts.slice(2).join(''));
      } catch (e2) { return; }
      var currentRepo = this.gitGraphPath || '/tutorial';
      if (repo && repo !== currentRepo) return;
      if (this._isBackgroundSyncPaused() || this._gitGraphStateDirty) {
        this._gitGraphRefreshPending = true;
        return;
      }
      this._lastGitGraphStateText = state;
      if (this._currentView === 'git_graph' && this.booted && window.GitGraph) {
        this._renderGitGraphFromText(state);
      }
    }
  };

  TutorialCode.prototype._resetRPCState = function (reason) {
    Object.keys(this._rpcPending || {}).forEach(function (id) {
      var p = this._rpcPending[id];
      clearTimeout(p.timer);
      p.reject(new Error(reason || 'RPC reset'));
    }, this);
    this._rpcPending = {};
    this._rpcBuf = '';
    this._rpcAvail = undefined;
    this._rpcAvailPromise = null;
    this._rpcNegativeUntil = 0;
    this._backgroundShellCwd = null;
  };

  TutorialCode.prototype._pingRPCDaemon = function (timeoutMs) {
    var self = this;
    if (!this.emulator || !this.emulator.bus || !this.emulator.bus.send) {
      return Promise.resolve(false);
    }
    self._initRPCChannel();
    var id = 'p' + (++self._rpcSeq).toString(36) + Date.now().toString(36);
    return new Promise(function (resolve) {
      var timer = setTimeout(function () {
        delete self._rpcPending[id];
        resolve(false);
      }, timeoutMs || 500);
      self._rpcPending[id] = {
        timer: timer,
        resolve: function (result) { resolve(result.status === 0 && result.text === 'PONG'); },
        reject: function () { resolve(false); },
      };
      try {
        self.emulator.bus.send('virtio-console0-input-bytes', new TextEncoder().encode('P ' + id + '\n'));
      } catch (e) {
        clearTimeout(timer);
        delete self._rpcPending[id];
        resolve(false);
      }
    });
  };

  TutorialCode.prototype._runRPCResult = function (cmd, opts) {
    opts = opts || {};
    var timeoutMs = opts.timeout || 30000;
    if (this.config.backend !== 'v86') {
      return Promise.reject(new Error('RPC: only available on v86 backend'));
    }
    if (!this.emulator || !this.emulator.bus || !this.emulator.bus.send) {
      return Promise.reject(new Error('RPC: virtio console not ready'));
    }
    var self = this;
    self._initRPCChannel();
    var id = 'r' + (++self._rpcSeq).toString(36) + Date.now().toString(36);
    var line = 'R ' + id + ' ' + b64EncodeUtf8(cmd) + '\n';
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        delete self._rpcPending[id];
        reject(new Error('RPC timeout: ' + cmd.slice(0, 60)));
      }, timeoutMs);
      self._rpcPending[id] = { timer: timer, resolve: resolve, reject: reject };
      try {
        self.emulator.bus.send('virtio-console0-input-bytes', new TextEncoder().encode(line));
      } catch (e) {
        clearTimeout(timer);
        delete self._rpcPending[id];
        reject(e);
      }
    });
  };

  // Keep _runRPC's public behavior as "resolve stdout text". Internally,
  // _runRPCResult can inspect exit status for probes or future callers.
  TutorialCode.prototype._runRPC = function (cmd, opts) {
    return this._runRPCResult(cmd, opts).then(function (result) {
      return result.text;
    });
  };

  TutorialCode.prototype._runRPCShellWithCwd = function (cmd, opts) {
    var self = this;
    var marker = '__TVM_CWD_' + Math.random().toString(36).substr(2, 10) + '__';
    var cwd = self._backgroundShellCwd || '/tutorial';
    var wrapped = [
      'cd ' + shellQuote(cwd) + ' 2>/dev/null || cd /tutorial',
      cmd,
      'printf "\\n' + marker + '%s\\n" "$PWD"'
    ].join('\n');
    return self._runRPCResult(wrapped, opts).then(function (result) {
      var text = result.text || '';
      var idx = text.lastIndexOf(marker);
      if (idx !== -1) {
        var before = text.slice(0, idx).replace(/\n$/, '');
        var after = text.slice(idx + marker.length);
        var nextCwd = (after.split(/\r?\n/)[0] || '').trim();
        if (/^\/tutorial(?:\/|$)/.test(nextCwd)) {
          self._backgroundShellCwd = nextCwd;
        }
        return before;
      }
      return text;
    });
  };

  TutorialCode.prototype._runBackgroundShell = function (cmd, opts) {
    var self = this;
    if (this.config.backend === 'v86') {
      return this._probeRPCDaemon().then(function (avail) {
        return avail ? self._runRPCShellWithCwd(cmd, opts || { timeout: 60000 }) : self._runSilent(cmd);
      });
    }
    if (this.config.backend === 'webcontainer') {
      return this._runSilent(cmd);
    }
    return Promise.resolve();
  };

  TutorialCode.prototype._runStepSetupCommands = function (step, opts) {
    if (!step || !step.setup_commands || step.setup_commands.length === 0) {
      return Promise.resolve();
    }
    if (this.config.backend !== 'v86' && this.config.backend !== 'webcontainer') {
      return Promise.resolve();
    }
    return this._runBackgroundShell(tutorialShellBatch(step.setup_commands), opts || { timeout: 120000 });
  };

  TutorialCode.prototype._runStepDir = function (step) {
    if (!step || !step.step_dir) return Promise.resolve();
    if (this.config.backend !== 'v86' && this.config.backend !== 'webcontainer') {
      return Promise.resolve();
    }
    return this._runSilent('[ "$(pwd)" = ' + shellQuote(step.step_dir) + ' ] || cd ' + shellQuote(step.step_dir));
  };

  TutorialCode.prototype._probeRPCDaemon = function () {
    if (this.config.backend !== 'v86') return Promise.resolve(false);
    if (this._rpcAvail === true) return Promise.resolve(true);
    if (this._rpcAvailPromise) return this._rpcAvailPromise;
    if (Date.now() < (this._rpcNegativeUntil || 0)) return Promise.resolve(false);

    var self = this;
    var attempts = 0;
    function tryProbe() {
      attempts++;
      return self._pingRPCDaemon(400).then(function (ok) {
        if (ok) return true;
        if (attempts >= 5) return false;
        return delay(100).then(tryProbe);
      });
    }
    this._rpcAvailPromise = tryProbe().then(function (ok) {
      self._rpcAvailPromise = null;
      if (ok) {
        self._rpcAvail = true;
        console.info('[gg-daemon] alive on virtio console');
        return true;
      }
      self._rpcNegativeUntil = Date.now() + 1000;
      console.info('[gg-daemon] not available yet — using legacy _runSilent path');
      return false;
    });
    return this._rpcAvailPromise;
  };

  /**
   * Run a command in the v86 terminal without any visible output.
   * Returns a Promise that resolves when the command completes.
   * Calls are serialized via a queue so overlapping invocations
   * never race on the mute state.
   */
  TutorialCode.prototype._runSilent = function (cmd) {
    var self = this;
    if (this.config.backend !== 'v86') return Promise.resolve();
    return new Promise(function (resolve) {
      self._silentQueue.push({ cmd: cmd, resolve: resolve });
      if (!self._silentRunning) self._drainSilentQueue();
    });
  };

  TutorialCode.prototype._drainSilentQueue = function () {
    if (this._silentQueue.length === 0) { this._silentRunning = false; return; }
    this._silentRunning = true;
    var self = this;
    var entry = this._silentQueue.shift();
    var marker = '__SIL_' + Math.random().toString(36).substr(2, 8);
    var buf = '';
    // Tracked registration so _resetSerialState can clean up in-flight
    // listeners after a VM restore_state(). Without this, orphaned listeners
    // would time out 30s later and decrement muteCount below zero,
    // permanently muting the terminal (and making stty echoes visible).
    var reg = { onByte: null, timer: null, cleaned: false };

    self._muteCount++;
    function onByte(byte) {
      if (reg.cleaned) return;  // defensive: listener should already be removed
      buf += String.fromCharCode(byte);
      var mi = buf.indexOf(marker);
      if (mi !== -1) {
        var tail = buf.substring(mi + marker.length);
        if (tail.includes('# ') || tail.includes('$ ')) {
          reg.cleaned = true;
          self.emulator.remove_listener('serial0-output-byte', onByte);
          clearTimeout(timer);
          var idx = self._silentListeners.indexOf(reg);
          if (idx >= 0) self._silentListeners.splice(idx, 1);
          self._muteCount = Math.max(0, self._muteCount - 1);
          entry.resolve();
          self._drainSilentQueue();
        }
      }
    }
    self.emulator.add_listener('serial0-output-byte', onByte);
    var timer = setTimeout(function () {
      if (reg.cleaned) return;  // already cleaned up by reset or marker match
      reg.cleaned = true;
      self.emulator.remove_listener('serial0-output-byte', onByte);
      var idx = self._silentListeners.indexOf(reg);
      if (idx >= 0) self._silentListeners.splice(idx, 1);
      self._muteCount = Math.max(0, self._muteCount - 1);
      entry.resolve();
      self._drainSilentQueue();
    }, 30000);
    reg.onByte = onByte;
    reg.timer = timer;
    self._silentListeners.push(reg);
    // Heredocs and embedded newlines make it unsafe to append ` #marker` to
    // the same line — a trailing "EOF #marker" no longer matches the heredoc
    // terminator and the shell hangs at a PS2 `>` prompt forever. In those
    // cases, send the marker as a separate no-op line that prints after the
    // previous command's prompt returns.
    if (/<<|\n/.test(entry.cmd)) {
      self.sendCommand(' ' + entry.cmd);
      self.sendCommand(': #' + marker);
    } else {
      self.sendCommand(' ' + entry.cmd + ' #' + marker);
    }
  };

  /**
   * Run a command in the v86/webcontainer terminal with full visible output.
   * Returns a Promise that resolves when the shell prompt returns.
   * Uses the same marker-after-command technique as _runSilent, but without
   * muting, so the command and its output appear in the terminal.
   */
  TutorialCode.prototype._runVisible = function (cmd) {
    var self = this;
    if (this.config.backend === 'v86') {
      var useScript = (/<<|\n/.test(cmd) || String(cmd).length > 160);
      if (useScript && this.emulator && this.emulator.create_file) {
        var scriptTag = Math.random().toString(36).substr(2, 10);
        var scriptRel = '.tvm-visible-' + scriptTag + '.sh';
        var scriptVMPath = '/tutorial/' + scriptRel;
        var bytes = new TextEncoder().encode(String(cmd).replace(/\s+$/, '') + '\n');
        return this.emulator.create_file('/' + scriptRel, bytes).then(function () {
          return self._runVisible('. ' + shellQuote(scriptVMPath) + '; rm -f ' + shellQuote(scriptVMPath));
        }).catch(function () {
          return self._runVisibleInline(cmd);
        });
      }
      return self._runVisibleInline(cmd);
    } else if (this.config.backend === 'webcontainer') {
      self.sendCommand(cmd);
      return delay(800);
    }
    return Promise.resolve();
  };

  TutorialCode.prototype._runVisibleInline = function (cmd) {
    var self = this;
    if (this.config.backend === 'v86') {
      return new Promise(function (resolve) {
        var marker = '__VIS_' + Math.random().toString(36).substr(2, 8);
        var buf = '';
        function onByte(byte) {
          buf += String.fromCharCode(byte);
          var mi = buf.indexOf(marker);
          if (mi !== -1) {
            var tail = buf.substring(mi + marker.length);
            if (tail.includes('# ') || tail.includes('$ ')) {
              self.emulator.remove_listener('serial0-output-byte', onByte);
              clearTimeout(timer);
              resolve();
            }
          }
        }
        self.emulator.add_listener('serial0-output-byte', onByte);
        var timer = setTimeout(function () {
          self.emulator.remove_listener('serial0-output-byte', onByte);
          // Flush any partially-buffered filter content on timeout
          if (self._visFilterBuf) { self.term.write(self._visFilterBuf); }
          self._visFilterMarker = null;
          self._visFilterBuf = '';
          resolve();
        }, 30000);
        // Arm the filter before sending so the echo is suppressed immediately
        var multiline = /<<|\n/.test(cmd);
        self._visFilterMarker = (multiline ? ': #' : ' #') + marker;
        self._visFilterBuf = '';
        if (multiline) {
          self.sendCommand(' ' + cmd);
          self.sendCommand(': #' + marker);
        } else {
          self.sendCommand(' ' + cmd + ' #' + marker);
        }
      });
    }
    return Promise.resolve();
  };

  // ---- Pyodide backend -------------------------------------------------------
  TutorialCode.prototype._initPyodide = function () {
    var self = this;
    this._showLoading('Loading Python runtime\u2026 (first load may take a moment)');
    return new Promise(function (resolve, reject) {
      self._worker = new Worker(self.config.workerPath);

      self._worker.onmessage = function (e) {
        var msg = e.data;
        if (msg.type === 'loading') {
          self._showLoading(msg.message);
          return;
        }
        if (msg.type === 'ready') {
          self.booted = true;
          // Run global setup (treated as Python code for pyodide backend)
          var setupCmds = self.setupCommands;
          var pythonSetup = setupCmds.length > 0
            ? new Promise(function (r) {
                self._postWorker({ type: 'runCode', code: setupCmds.join('\n'), silent: true }, function () { r(); });
              })
            : Promise.resolve();
          // Git bring-up runs after Python setup so user-supplied imports
          // can't race with the FS adapter being attached. The git terminal
          // is created on the main thread; the worker side only needs the
          // iso-git module loaded and dir registered.
          var gitSetup = self.gitGraphPath
            ? pythonSetup.then(function () {
                return new Promise(function (r) {
                  self._postWorker({ type: 'gitInit', dir: self.gitGraphPath }, function () { r(); });
                });
              }).then(function () {
                self._initGitTerminal();
                if (self.gitSetupCommands && self.gitSetupCommands.length) {
                  return self._runGitSetup(self.gitSetupCommands);
                }
              }).then(function () {
                // First paint of the gitgraph (in case the user lands on
                // graph view from a step's `view: git_graph`).
                if (window.GitGraph) self._lightRefreshGitGraph();
                // Now that git is initialised, retry any gutter refreshes
                // that landed early and got the "notReady" reply.
                if (self.config.enableGitGutter) {
                  setTimeout(function () { self._refreshAllGitGutters(); }, 50);
                }
              })
            : pythonSetup;
          gitSetup.then(function () { resolve(); });
          return;
        }
        if (msg.type === 'stdout') {
          self._appendOutput(msg.text, 'stdout');
          return;
        }
        if (msg.type === 'stderr') {
          self._appendOutput(msg.text, 'stderr');
          return;
        }
        if (msg.type === 'error') {
          reject(new Error(msg.message));
          return;
        }
        // Routed callback by id
        if (msg.id !== undefined && self._workerCallbacks[msg.id]) {
          var cb = self._workerCallbacks[msg.id];
          delete self._workerCallbacks[msg.id];
          cb(msg);
        }
      };

      self._worker.onerror = function (err) {
        reject(new Error('Pyodide worker error: ' + (err.message || err)));
      };
    });
  };

  // ---- SQL backend -----------------------------------------------------------
  TutorialCode.prototype._initSQL = function () {
    var self = this;
    this._showLoading('Loading SQL runtime\u2026 (first load may take a moment)');
    return new Promise(function (resolve, reject) {
      self._worker = new Worker(self.config.sqlWorkerPath);

      self._worker.onmessage = function (e) {
        var msg = e.data;
        if (msg.type === 'loading') { self._showLoading(msg.message); return; }
        if (msg.type === 'ready') {
          self.booted = true;
          var setupCmds = self.setupCommands;
          if (setupCmds && setupCmds.length > 0) {
            self._postWorker(
              { type: 'runSQL', sql: setupCmds.join('\n'), silent: true },
              function () { resolve(); }
            );
          } else {
            resolve();
          }
          return;
        }
        if (msg.type === 'stdout') { self._appendOutput(msg.text, 'stdout'); return; }
        if (msg.type === 'stderr') { self._appendOutput(msg.text, 'stderr'); return; }
        if (msg.type === 'table') { self._appendTable(msg.columns, msg.rows); return; }
        if (msg.type === 'error') { reject(new Error(msg.message)); return; }
        if (msg.id !== undefined && self._workerCallbacks[msg.id]) {
          var cb = self._workerCallbacks[msg.id];
          delete self._workerCallbacks[msg.id];
          cb(msg);
        }
      };

      self._worker.onerror = function (err) {
        reject(new Error('SQL worker error: ' + (err.message || err)));
      };
    });
  };

  // ---- Prolog backend (Tau Prolog via Web Worker) ----------------------------
  TutorialCode.prototype._initProlog = function () {
    var self = this;
    this._showLoading('Loading Prolog runtime\u2026 (first load may take a moment)');
    return new Promise(function (resolve, reject) {
      self._worker = new Worker(self.config.prologWorkerPath);

      self._worker.onmessage = function (e) {
        var msg = e.data;
        if (msg.type === 'loading') { self._showLoading(msg.message); return; }
        if (msg.type === 'ready') {
          self.booted = true;
          var setupCmds = self.setupCommands;
          if (setupCmds && setupCmds.length > 0) {
            self._postWorker(
              { type: 'runProlog', code: setupCmds.join('\n'), silent: true },
              function () { resolve(); }
            );
          } else {
            resolve();
          }
          return;
        }
        if (msg.type === 'stdout') { self._appendOutput(msg.text, 'stdout'); return; }
        if (msg.type === 'stderr') { self._appendOutput(msg.text, 'stderr'); return; }
        if (msg.type === 'error') { reject(new Error(msg.message)); return; }
        if (msg.id !== undefined && self._workerCallbacks[msg.id]) {
          var cb = self._workerCallbacks[msg.id];
          delete self._workerCallbacks[msg.id];
          cb(msg);
        }
      };

      self._worker.onerror = function (err) {
        reject(new Error('Prolog worker error: ' + (err.message || err)));
      };
    });
  };

  // ---- Java backend (Java-to-JS transpiler via Web Worker) ------------------
  TutorialCode.prototype._initJava = function () {
    var self = this;
    this._showLoading('Loading Java runtime… (first load may take a moment)');
    return new Promise(function (resolve, reject) {
      self._worker = new Worker(self.config.javaWorkerPath);

      self._worker.onmessage = function (e) {
        var msg = e.data;
        if (msg.type === 'loading') { self._showLoading(msg.message); return; }
        if (msg.type === 'ready') {
          self.booted = true;
          var setupCmds = self.setupCommands;
          if (setupCmds && setupCmds.length > 0) {
            self._postWorker(
              { type: 'runCode', code: setupCmds.join('\n'), silent: true },
              function () { resolve(); }
            );
          } else {
            resolve();
          }
          return;
        }
        if (msg.type === 'stdout') { self._appendOutput(msg.text, 'stdout'); return; }
        if (msg.type === 'stderr') { self._appendOutput(msg.text, 'stderr'); return; }
        if (msg.type === 'error') { reject(new Error(msg.message)); return; }
        if (msg.id !== undefined && self._workerCallbacks[msg.id]) {
          var cb = self._workerCallbacks[msg.id];
          delete self._workerCallbacks[msg.id];
          cb(msg);
        }
      };

      self._worker.onerror = function (err) {
        reject(new Error('Java worker error: ' + (err.message || err)));
      };
    });
  };

  /** Render a SQL result set as a table inside the output panel. */
  TutorialCode.prototype._appendTable = function (columns, rows) {
    if (!this.outputPre) return;
    var wrapper = document.createElement('div');
    wrapper.className = 'tvm-sql-table-wrapper';

    var table = document.createElement('table');
    table.className = 'tvm-sql-table';

    // Header
    var thead = document.createElement('thead');
    var headerTr = document.createElement('tr');
    (columns || []).forEach(function (col) {
      var th = document.createElement('th');
      th.textContent = col;
      headerTr.appendChild(th);
    });
    thead.appendChild(headerTr);
    table.appendChild(thead);

    // Body
    var tbody = document.createElement('tbody');
    if (rows && rows.length > 0) {
      rows.forEach(function (row) {
        var tr = document.createElement('tr');
        row.forEach(function (cell) {
          var td = document.createElement('td');
          if (cell === null) { td.textContent = 'NULL'; td.classList.add('tvm-sql-null'); }
          else { td.textContent = String(cell); }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    } else {
      var emptyTr = document.createElement('tr');
      var emptyTd = document.createElement('td');
      emptyTd.colSpan = (columns || []).length || 1;
      emptyTd.className = 'tvm-sql-empty';
      emptyTd.textContent = '(0 rows)';
      emptyTr.appendChild(emptyTd);
      tbody.appendChild(emptyTr);
    }
    table.appendChild(tbody);
    wrapper.appendChild(table);

    // Row count
    if (rows && rows.length > 0) {
      var footer = document.createElement('span');
      footer.className = 'tvm-out-info';
      footer.textContent = rows.length + ' row' + (rows.length === 1 ? '' : 's') + '\n';
      wrapper.appendChild(footer);
    }

    this.outputPre.appendChild(wrapper);
    var container = this.outputPre.parentElement;
    if (container) container.scrollTop = container.scrollHeight;
  };

  /** Post a message to the Pyodide worker; optional callback on response. */
  TutorialCode.prototype._postWorker = function (msg, callback) {
    if (!this._worker) return;
    var id = ++this._workerMsgId;
    msg.id = id;
    if (callback) this._workerCallbacks[id] = callback;
    this._worker.postMessage(msg);
    return id;
  };

  /** Append text to Python output panel. type: 'stdout' | 'stderr' | 'info' */
  TutorialCode.prototype._appendOutput = function (text, type) {
    if (!this.outputPre) return;
    var wrapper = document.createElement('span');
    wrapper.className = 'tvm-out-' + (type || 'stdout');
    // Parse ANSI escape codes (used by pytest, rich, click, colorama, etc.)
    // and render as styled child spans.  Plain text without ANSI codes goes
    // straight in via textContent so we don't pay the parsing cost on every
    // print() call.
    if (text && text.indexOf('\x1b[') !== -1) {
      _ansiToDom(text, wrapper, this._isDarkMode());
    } else {
      wrapper.textContent = text;
    }
    this.outputPre.appendChild(wrapper);
    var container = this.outputPre.parentElement;
    if (container) container.scrollTop = container.scrollHeight;
  };

  // ANSI -> DOM parser. Handles SGR (Select Graphic Rendition) sequences:
  //   \x1b[<n>;<n>;…m  set color/style attributes
  //   \x1b[<n>m        single attribute
  //   \x1b[m / \x1b[0m reset all
  // Everything else (cursor moves, clears, etc.) is dropped — we just want
  // colors. This is sufficient for pytest, rich, click, colorama output.
  //
  // Two palettes: a darker "light-theme-friendly" set tuned for readability
  // on white backgrounds, and a brighter "dark-theme" set. Both are taken
  // from VS Code's terminal palette — battle-tested for legibility.
  var _ANSI_LIGHT = {
    fg: {
      30: '#000000', 31: '#cd3131', 32: '#00bc00', 33: '#949800',
      34: '#0451a5', 35: '#bc05bc', 36: '#0598bc', 37: '#555555',
      90: '#666666', 91: '#cd3131', 92: '#14ce14', 93: '#b5ba00',
      94: '#0451a5', 95: '#bc05bc', 96: '#0598bc', 97: '#a5a5a5',
    },
    bg: {
      40: '#000000', 41: '#cd3131', 42: '#00bc00', 43: '#949800',
      44: '#0451a5', 45: '#bc05bc', 46: '#0598bc', 47: '#cccccc',
      100: '#666666', 101: '#cd3131', 102: '#14ce14', 103: '#b5ba00',
      104: '#0451a5', 105: '#bc05bc', 106: '#0598bc', 107: '#dddddd',
    },
  };
  var _ANSI_DARK = {
    fg: {
      30: '#666666', 31: '#f14c4c', 32: '#23d18b', 33: '#f5f543',
      34: '#3b8eea', 35: '#d670d6', 36: '#29b8db', 37: '#e5e5e5',
      90: '#888888', 91: '#ff6b6b', 92: '#5af78e', 93: '#fffd76',
      94: '#5fb3ff', 95: '#ff8aff', 96: '#56d4f0', 97: '#ffffff',
    },
    bg: {
      40: '#000000', 41: '#cd3131', 42: '#0dbc79', 43: '#e5e510',
      44: '#2472c8', 45: '#bc3fbc', 46: '#11a8cd', 47: '#e5e5e5',
      100: '#666666', 101: '#f14c4c', 102: '#23d18b', 103: '#f5f543',
      104: '#3b8eea', 105: '#d670d6', 106: '#29b8db', 107: '#ffffff',
    },
  };

  function _ansiToDom(text, parent, isDark) {
    var palette = isDark ? _ANSI_DARK : _ANSI_LIGHT;
    var fgMap = palette.fg, bgMap = palette.bg;
    // Match SGR escape sequences:  ESC '[' digits/semicolons 'm'
    var re = /\x1b\[([0-9;]*)m/g;
    var lastIdx = 0;
    var style = { fg: null, bg: null, bold: false, dim: false, italic: false, underline: false };
    var match;
    function emit(chunk) {
      if (!chunk) return;
      var span = document.createElement('span');
      var css = '';
      if (style.fg) css += 'color:' + style.fg + ';';
      if (style.bg) css += 'background:' + style.bg + ';';
      if (style.bold) css += 'font-weight:bold;';
      if (style.dim) css += 'opacity:0.6;';
      if (style.italic) css += 'font-style:italic;';
      if (style.underline) css += 'text-decoration:underline;';
      if (css) span.style.cssText = css;
      span.textContent = chunk;
      parent.appendChild(span);
    }
    while ((match = re.exec(text)) !== null) {
      emit(text.substring(lastIdx, match.index));
      var codes = match[1] === '' ? [0] : match[1].split(';').map(function (s) { return parseInt(s, 10) || 0; });
      // Walk codes; some are stateful (38;5;N for 256-color, 38;2;R;G;B for truecolor).
      for (var i = 0; i < codes.length; i++) {
        var c = codes[i];
        if (c === 0)               { style = { fg: null, bg: null, bold: false, dim: false, italic: false, underline: false }; continue; }
        if (c === 1)               { style.bold = true; continue; }
        if (c === 2)               { style.dim = true; continue; }
        if (c === 3)               { style.italic = true; continue; }
        if (c === 4)               { style.underline = true; continue; }
        if (c === 22)              { style.bold = false; style.dim = false; continue; }
        if (c === 23)              { style.italic = false; continue; }
        if (c === 24)              { style.underline = false; continue; }
        if (c === 39)              { style.fg = null; continue; }
        if (c === 49)              { style.bg = null; continue; }
        if (fgMap[c])              { style.fg = fgMap[c]; continue; }
        if (bgMap[c])              { style.bg = bgMap[c]; continue; }
        // 38;5;N (256-color fg) / 48;5;N (256-color bg)
        if (c === 38 && codes[i + 1] === 5) { style.fg = _xterm256(codes[i + 2]); i += 2; continue; }
        if (c === 48 && codes[i + 1] === 5) { style.bg = _xterm256(codes[i + 2]); i += 2; continue; }
        // 38;2;R;G;B (truecolor)
        if (c === 38 && codes[i + 1] === 2) {
          style.fg = 'rgb(' + codes[i + 2] + ',' + codes[i + 3] + ',' + codes[i + 4] + ')';
          i += 4; continue;
        }
        if (c === 48 && codes[i + 1] === 2) {
          style.bg = 'rgb(' + codes[i + 2] + ',' + codes[i + 3] + ',' + codes[i + 4] + ')';
          i += 4; continue;
        }
        // Unknown — skip
      }
      lastIdx = match.index + match[0].length;
    }
    emit(text.substring(lastIdx));
  }

  // Map xterm 256-color palette index to CSS color.
  function _xterm256(n) {
    if (n < 16) {
      var basic = ['#000','#a00','#0a0','#a50','#00a','#a0a','#0aa','#aaa',
                   '#555','#f55','#5f5','#ff5','#55f','#f5f','#5ff','#fff'];
      return basic[n];
    }
    if (n < 232) {
      n -= 16;
      var r = Math.floor(n / 36), g = Math.floor((n % 36) / 6), b = n % 6;
      var lvl = [0, 95, 135, 175, 215, 255];
      return 'rgb(' + lvl[r] + ',' + lvl[g] + ',' + lvl[b] + ')';
    }
    var v = 8 + (n - 232) * 10;
    return 'rgb(' + v + ',' + v + ',' + v + ')';
  }

  TutorialCode.prototype._clearOutput = function () {
    if (this.outputPre) this.outputPre.innerHTML = '';
  };

  TutorialCode.prototype._runCurrentFile = function () {
    if (!this.activeFileName) return;
    var backend = this.config.backend;
    var self = this;
    var step = this.steps[this.currentStep >= 0 ? this.currentStep : 0];
    var runFile = (step && step.run_file) ? step.run_file : this.activeFileName;
    var filename = runFile;

    if (backend === 'browser') {
      var code = this.editorModels[filename] ? this.editorModels[filename].model.getValue() : '';
      self._clearOutput();
      self._appendOutput('\u25b6 ' + filename + '\n', 'info');
      var runBtn = self.root.querySelector('.tvm-run-btn');
      var stopBtn = self.root.querySelector('.tvm-stop-btn');
      if (runBtn) { runBtn.disabled = true; runBtn.textContent = '\u23f3 Running\u2026'; }
      if (stopBtn) { stopBtn.style.display = 'inline-block'; }
      self._runBrowserCode(code, function (text, kind) {
        self._appendOutput(text, kind === 'stderr' ? 'err' : 'out');
      }, function () {
        if (runBtn) { runBtn.disabled = false; runBtn.textContent = '\u25b6 ' + self._runLabel; }
        if (stopBtn) { stopBtn.style.display = 'none'; }
      });
      return;
    }

    if (backend === 'webcontainer') {
      self._clearOutput();
      self._appendOutput('\u25b6 ' + filename + '\n', 'info');
      var wcRunBtn = self.root.querySelector('.tvm-run-btn');
      var wcStopBtn = self.root.querySelector('.tvm-stop-btn');
      if (wcRunBtn) { wcRunBtn.disabled = true; wcRunBtn.textContent = '\u23f3 Running\u2026'; }
      if (wcStopBtn) { wcStopBtn.style.display = 'inline-block'; }
      self._runWebContainerNodeFile(filename, {
        serverStep: !!(step && step.http_client),
        echoOutput: true,
      }).then(function () {
        if (wcRunBtn) { wcRunBtn.disabled = false; wcRunBtn.textContent = '\u25b6 ' + self._effectiveRunLabel(); }
        if (wcStopBtn) { wcStopBtn.style.display = 'none'; }
      }).catch(function (err) {
        self._appendOutput(String(err && err.message || err) + '\n', 'err');
        if (wcRunBtn) { wcRunBtn.disabled = false; wcRunBtn.textContent = '\u25b6 ' + self._effectiveRunLabel(); }
        if (wcStopBtn) { wcStopBtn.style.display = 'none'; }
      });
      return;
    }

    if (backend === 'sql') {
      var sqlPath = '/tutorial/' + filename;
      this._syncFileToBackend(filename, function () {
        self._clearOutput();
        self._appendOutput('\u25b6 ' + filename + '\n', 'info');
        var runBtn = self.root.querySelector('.tvm-run-btn');
        if (runBtn) { runBtn.disabled = true; runBtn.textContent = '\u23f3 Running\u2026'; }
        self._postWorker({ type: 'run', path: sqlPath }, function (msg) {
          if (runBtn) { runBtn.disabled = false; runBtn.textContent = '\u25b6 ' + self._runLabel; }
          if (msg.exitCode !== 0) self._appendOutput('\n\u2717 Error\n', 'err');
        });
      });
      return;
    }

    if (backend === 'prolog') {
      var plPath = '/tutorial/' + filename;
      this._syncFileToBackend(filename, function () {
        self._clearOutput();
        self._appendOutput('\u25b6 ' + filename + '\n', 'info');
        var runBtn = self.root.querySelector('.tvm-run-btn');
        if (runBtn) { runBtn.disabled = true; runBtn.textContent = '\u23f3 Running\u2026'; }
        var query = '';
        var argsInp = self.root.querySelector('.tvm-args-input');
        if (argsInp) query = argsInp.value.trim();
        self._postWorker({ type: 'run', path: plPath, query: query }, function (msg) {
          if (runBtn) { runBtn.disabled = false; runBtn.textContent = '\u25b6 ' + self._runLabel; }
          if (msg.exitCode !== 0 && !query) self._appendOutput('\n\u2717 Error\n', 'err');
        });
      });
      return;
    }

    if (backend === 'java') {
      var javaPath = '/tutorial/' + filename;
      // Sync ALL files first (Java may need multiple .java files compiled together)
      var allFiles = Object.keys(self.editorModels);
      var syncChain = Promise.resolve();
      allFiles.forEach(function (f) {
        syncChain = syncChain.then(function () { return self._syncFileToBackend(f); });
      });
      syncChain.then(function () {
        self._clearOutput();
        self._appendOutput('\u25b6 ' + filename + '\n', 'info');
        var runBtn = self.root.querySelector('.tvm-run-btn');
        if (runBtn) { runBtn.disabled = true; runBtn.textContent = '\u23f3 Compiling…'; }
        self._postWorker({ type: 'run', path: javaPath }, function (msg) {
          if (runBtn) { runBtn.disabled = false; runBtn.textContent = '\u25b6 ' + self._runLabel; }
          if (msg.exitCode === 0) {
            self._appendOutput('\n\u2713 Done\n', 'info');
          } else {
            self._appendOutput('\n\u2717 Exited with error\n', 'err');
          }
        });
      });
      return;
    }

    if (backend !== 'pyodide') return;
    var path = '/tutorial/' + filename;
    var runAsPytest = self._pytestMode && self._isPytestFile(filename);

    // Sync first, then run
    this._syncFileToBackend(filename, function () {
      self._clearOutput();
      self._appendOutput('\u25b6 ' + filename + (runAsPytest ? ' (pytest)' : '') + '\n', 'info');

      var runBtn = self.root.querySelector('.tvm-run-btn');
      var runningLabel = runAsPytest ? '\u23f3 Testing\u2026' : '\u23f3 Running\u2026';
      if (runBtn) { runBtn.disabled = true; runBtn.textContent = runningLabel; }

      if (runAsPytest) {
        // Run pytest on the file directly. The pytest module-cache patch from
        // setup_commands ensures fresh source on every invocation.
        var pyCode = 'import pytest; raise SystemExit(pytest.main([' +
          JSON.stringify(path) + ', "-v"]))';
        self._postWorker({ type: 'runCode', code: pyCode }, function (msg) {
          if (runBtn) {
            runBtn.disabled = false;
            runBtn.textContent = '\u25b6 ' + self._effectiveRunLabel();
          }
          if (msg.exitCode === 0) {
            self._appendOutput('\n\u2713 All tests passed\n', 'info');
          } else {
            // pytest exits 1 on test failure, 2 on usage error, etc. \u2014 all "not green".
            self._appendOutput('\n\u2717 Tests failed\n', 'err');
          }
        });
        return;
      }

      var args = [];
      var argsInp = self.root.querySelector('.tvm-args-input');
      if (argsInp && argsInp.style.display !== 'none' && argsInp.value.trim() !== '') {
        var matches = argsInp.value.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
        args = matches.map(function (s) { return s.replace(/^"|"$/g, ''); });
      }

      self._postWorker({ type: 'run', path: path, args: args }, function (msg) {
        if (runBtn) {
          runBtn.disabled = false;
          runBtn.textContent = '\u25b6 ' + self._effectiveRunLabel();
        }
        if (msg.exitCode === 0) {
          self._appendOutput('\n\u2713 Done\n', 'info');
        } else {
          self._appendOutput('\n\u2717 Exited with error\n', 'err');
        }
      });
    });
  };

  TutorialCode.prototype._syncAllEditorFilesToWebContainer = function () {
    var self = this;
    var files = Object.keys(this.editorModels || {});
    var chain = Promise.resolve();
    files.forEach(function (file) {
      chain = chain.then(function () { return self._syncFileToBackend(file); });
    });
    return chain;
  };

  TutorialCode.prototype._runWebContainerNodeFile = function (filename, opts) {
    opts = opts || {};
    var self = this;
    if (!this._webcontainer) return Promise.reject(new Error('WebContainer is not ready yet'));
    if (this._webcontainerRunProcess) {
      try { this._webcontainerRunProcess.kill(); } catch (e) { }
      this._webcontainerRunProcess = null;
    }
    return this._syncAllEditorFilesToWebContainer()
      .then(function () { return self._ensureWebContainerNodeRuntime(); })
      .then(function () {
        return self._webcontainer.spawn('node', [filename], { cwd: '/tutorial' });
      })
      .then(function (proc) {
        self._webcontainerRunProcess = proc;
        var output = '';
        var reader = proc.output.getReader();
        var settled = false;
        return new Promise(function (resolve) {
          function finish(exitCode) {
            if (settled) return;
            settled = true;
            if (self._webcontainerRunProcess === proc) self._webcontainerRunProcess = null;
            try { reader.cancel(); } catch (e) { }
            resolve({ exitCode: exitCode == null ? 0 : exitCode, output: output });
          }
          (function readLoop() {
            reader.read().then(function (result) {
              if (result.done) return;
              var text = result.value || '';
              output += text;
              if (opts.echoOutput) self._appendOutput(text, 'out');
              readLoop();
            }).catch(function () {});
          })();
          proc.exit.then(function (exitCode) {
            finish(exitCode);
          }).catch(function () {
            finish(1);
          });
          if (opts.serverStep) {
            setTimeout(function () {
              if (opts.keepAlive) return;
              try { proc.kill(); } catch (e) { }
              finish(0);
            }, opts.serverTimeout || 3600000);
          } else if (opts.timeout) {
            setTimeout(function () {
              try { proc.kill(); } catch (e) { }
              finish(124);
            }, opts.timeout);
          }
        });
      });
  };

  // Match `test_*.py` (prefix convention) or `*_test.py` (suffix convention).
  TutorialCode.prototype._isPytestFile = function (filename) {
    if (!filename) return false;
    var base = filename.split('/').pop();
    return /^test_.+\.py$/i.test(base) || /_test\.py$/i.test(base);
  };

  // The effective label for the Run button \u2014 "Test" when pytest mode is on
  // and the file that would actually run (run_file or activeFileName) is a
  // test_*.py / *_test.py. Otherwise the configured `run_label` (default "Run").
  TutorialCode.prototype._effectiveRunLabel = function () {
    if (this._pytestMode) {
      var step = this.steps && this.steps[this.currentStep >= 0 ? this.currentStep : 0];
      var runFile = (step && step.run_file) ? step.run_file : this.activeFileName;
      if (this._isPytestFile(runFile)) return 'Test';
    }
    return this._runLabel;
  };

  // Refresh the Run button text in place. Called whenever the active file
  // changes so the label can flip between "Run" and "Test" as the student
  // switches tabs in pytest-mode tutorials.
  TutorialCode.prototype._refreshRunButtonLabel = function () {
    if (!this.root) return;
    var btn = this.root.querySelector('.tvm-run-btn');
    if (!btn || btn.disabled) return; // don't clobber "\u23f3 Running\u2026"
    btn.textContent = '\u25b6 ' + this._effectiveRunLabel();
  };

  // ---- WebContainers backend -------------------------------------------------
  TutorialCode.prototype._initWebContainer = function () {
    var self = this;
    this._showLoading('Booting WebContainers\u2026');

    // Under COEP=credentialless (set by the COI service worker), dynamic
    // `import()` of cross-origin ESM defaults to a no-cors fetch and the
    // browser refuses to instantiate the resulting opaque response as a
    // module. Prepending a `<link rel="modulepreload" crossorigin="anonymous">`
    // forces a CORS fetch (jsdelivr serves `Access-Control-Allow-Origin: *`),
    // and the dynamic import then reuses the CORS-fetched copy from cache.
    function preloadModule(url) {
      return new Promise(function (resolve, reject) {
        var existing = document.querySelector('link[rel="modulepreload"][href="' + url + '"]');
        if (existing) return resolve();
        var link = document.createElement('link');
        link.rel = 'modulepreload';
        link.href = url;
        link.crossOrigin = 'anonymous';
        link.onload = resolve;
        link.onerror = function () { reject(new Error('Failed to preload: ' + url)); };
        document.head.appendChild(link);
      });
    }

    return preloadModule(CDN.WEBCONTAINER)
      .catch(function () { /* preload failed \u2014 try import anyway */ })
      .then(function () { return import(CDN.WEBCONTAINER); })
      .then(function (module) {
      var WebContainer = module.WebContainer;
      return WebContainer.boot();
    }).then(function (wc) {
      self._webcontainer = wc;
      self._webcontainerServerUrls = {};
      if (wc && typeof wc.on === 'function') {
        try {
          self._webcontainerServerReadyUnsub = wc.on('server-ready', function (port, url) {
            self._webcontainerServerUrls[String(port)] = url;
            if (self._debuggerCtl && self._debuggerCtl.session && typeof self._debuggerCtl.setStatus === 'function') {
              self._debuggerCtl.setStatus('server running');
            }
          });
        } catch (e) { /* older WebContainer API shape */ }
      }

      // Pre-create /tutorial directory
      return wc.fs.mkdir('tutorial', { recursive: true }).then(function () {
        return self.config.useTerminal ? self._startWebContainerShell() : Promise.resolve();
      });
    }).then(function () {
      self.booted = true;

      // Run setup commands in the shell
      if (self.setupCommands.length > 0) {
        if (self.config.useTerminal) {
          self.setupCommands.forEach(function (cmd) { self.sendCommand(cmd); });
        } else {
          var setupChain = Promise.resolve();
          self.setupCommands.forEach(function (cmd) {
            setupChain = setupChain.then(function () { return self._runWebContainerShellCommand(cmd); });
          });
          return setupChain.then(function () { return delay(300); });
        }
      }
      return delay(300);
    });
  };

  TutorialCode.prototype._startWebContainerShell = function () {
    var self = this;
    return this._webcontainer.spawn('jsh', {
      terminal: { cols: self.term ? self.term.cols : 80, rows: self.term ? self.term.rows : 24 },
    }).then(function (process) {
      self._shellProcess = process;

      // Wire xterm → shell stdin
      var writer = process.input.getWriter();
      self._shellWriter = { write: function (data) { writer.write(data); } };
      self.term.onData(function (data) { writer.write(data); });

      // Wire shell stdout → xterm
      var reader = process.output.getReader();
      (function readLoop() {
        reader.read().then(function (result) {
          if (result.done) return;
          self.term.write(result.value);
          readLoop();
        }).catch(function () { });
      })();

      // Change to /tutorial dir
      writer.write('cd tutorial\n');
    });
  };

  TutorialCode.prototype._runWebContainerShellCommand = function (cmd) {
    if (!this._webcontainer) return Promise.resolve({ exitCode: 1, output: '' });
    return this._webcontainer.spawn('sh', ['-c', cmd], { cwd: '/tutorial' })
      .then(function (proc) {
        var output = '';
        var reader = proc.output.getReader();
        (function readLoop() {
          reader.read().then(function (result) {
            if (result.done) return;
            output += result.value || '';
            readLoop();
          }).catch(function () {});
        })();
        return proc.exit.then(function (exitCode) {
          try { reader.cancel(); } catch (e) {}
          return { exitCode: exitCode, output: output };
        });
      });
  };

  TutorialCode.prototype._ensureWebContainerNodeRuntime = function () {
    if (!this._webcontainer) return Promise.resolve();
    var wc = this._webcontainer;
    var expressPath = 'tutorial/node_modules/express/index.js';
    var shim = [
      "'use strict';",
      "const http = require('http');",
      "function parseQuery(search) {",
      "  const out = {};",
      "  if (!search) return out;",
      "  for (const part of search.split('&')) {",
      "    if (!part) continue;",
      "    const pieces = part.split('=');",
      "    const key = decodeURIComponent((pieces.shift() || '').replace(/\\+/g, ' '));",
      "    if (!key) continue;",
      "    out[key] = decodeURIComponent((pieces.join('=') || '').replace(/\\+/g, ' '));",
      "  }",
      "  return out;",
      "}",
      "function matchRoute(pattern, pathname) {",
      "  if (!pattern || pattern === '*') return {};",
      "  const pp = String(pattern).split('/');",
      "  const up = String(pathname).split('/');",
      "  if (pp.length !== up.length) return null;",
      "  const params = {};",
      "  for (let i = 0; i < pp.length; i++) {",
      "    if (pp[i] && pp[i][0] === ':') params[pp[i].slice(1)] = decodeURIComponent(up[i]);",
      "    else if (pp[i] !== up[i]) return null;",
      "  }",
      "  return params;",
      "}",
      "function makeRouter() {",
      "  const routes = [];",
      "  return {",
      "    get: (p, h) => routes.push({ method: 'GET', path: p, handler: h }),",
      "    post: (p, h) => routes.push({ method: 'POST', path: p, handler: h }),",
      "    put: (p, h) => routes.push({ method: 'PUT', path: p, handler: h }),",
      "    delete: (p, h) => routes.push({ method: 'DELETE', path: p, handler: h }),",
      "    all: (p, h) => ['GET', 'POST', 'PUT', 'DELETE'].forEach(method => routes.push({ method, path: p, handler: h })),",
      "    use: function(p, h) { if (typeof p === 'function') { h = p; p = '*'; } if (h && h.__routes) routes.push({ method: 'MOUNT', path: p, router: h.__routes }); else if (h) routes.push({ method: 'USE', path: p, handler: h }); },",
      "    __routes: routes",
      "  };",
      "}",
      "function decorateResponse(res) {",
      "  res.status = function(code) { this.statusCode = code; return this; };",
      "  res.json = function(obj) { if (!this.headersSent) this.setHeader('Content-Type', 'application/json'); this.end(JSON.stringify(obj, null, 2)); return this; };",
      "  res.send = function(body) { if (body && typeof body === 'object') return this.json(body); this.end(String(body)); return this; };",
      "  return res;",
      "}",
      "function dispatch(routes, req, res) {",
      "  const parsed = new URL(req.url, 'http://localhost');",
      "  req.path = parsed.pathname;",
      "  req.query = parseQuery(parsed.search.slice(1));",
      "  for (const route of routes) {",
      "    if (route.method === 'MOUNT') {",
      "      let sub = req.path;",
      "      if (sub === route.path) sub = '/';",
      "      else if (sub.indexOf(route.path + '/') === 0) sub = sub.slice(route.path.length);",
      "      else continue;",
      "      const prevPath = req.path;",
      "      req.path = sub;",
      "      for (const child of route.router) {",
      "        if (child.method !== req.method) continue;",
      "        const params = matchRoute(child.path, sub);",
      "        if (params !== null) { req.params = params; return child.handler(req, res); }",
      "      }",
      "      req.path = prevPath;",
      "    } else if (route.method === req.method) {",
      "      const params = matchRoute(route.path, req.path);",
      "      if (params !== null) { req.params = params; return route.handler(req, res); }",
      "    }",
      "  }",
      "  res.statusCode = 404;",
      "  res.end('Cannot ' + req.method + ' ' + req.path);",
      "}",
      "function express() {",
      "  const routes = [];",
      "  const app = makeRouter();",
      "  app.__routes = routes;",
      "  app.get = (p, h) => routes.push({ method: 'GET', path: p, handler: h });",
      "  app.post = (p, h) => routes.push({ method: 'POST', path: p, handler: h });",
      "  app.put = (p, h) => routes.push({ method: 'PUT', path: p, handler: h });",
      "  app.delete = (p, h) => routes.push({ method: 'DELETE', path: p, handler: h });",
      "  app.all = (p, h) => ['GET', 'POST', 'PUT', 'DELETE'].forEach(method => routes.push({ method, path: p, handler: h }));",
      "  app.use = function(p, h) { if (typeof p === 'function') { h = p; p = '*'; } if (h && h.__routes) routes.push({ method: 'MOUNT', path: p, router: h.__routes }); else if (h) routes.push({ method: 'USE', path: p, handler: h }); };",
      "  app.listen = function(port, host, cb) {",
      "    if (typeof host === 'function') { cb = host; host = undefined; }",
      "    const server = http.createServer((req, res) => {",
      "      decorateResponse(res);",
      "      let raw = '';",
      "      req.on('data', chunk => { raw += chunk; });",
      "      req.on('end', () => {",
      "        try { req.body = raw && /^\\s*[\\[{]/.test(raw) ? JSON.parse(raw) : raw; } catch (e) { req.body = raw; }",
      "        Promise.resolve(dispatch(routes, req, res)).catch(err => { if (!res.writableEnded) res.status(500).send(err && (err.stack || err.message) || String(err)); });",
      "      });",
      "    });",
      "    return server.listen(port, host, cb);",
      "  };",
      "  return app;",
      "}",
      "express.Router = makeRouter;",
      "express.json = () => (req, res, next) => next && next();",
      "module.exports = express;",
      ""
    ].join('\n');
    return wc.fs.readFile(expressPath, 'utf8')
      .then(function () {})
      .catch(function () {
        return wc.fs.mkdir('tutorial/node_modules/express', { recursive: true })
          .then(function () { return wc.fs.writeFile(expressPath, shim); });
      });
  };

  // ---- React backend (in-browser JSX live preview) --------------------------
  TutorialCode.prototype._initReactBackend = function () {
    this.booted = true;
    return Promise.resolve();
  };

  // ---- Browser JS backend (in-browser JS runner with output panel) ----------
  TutorialCode.prototype._initBrowserBackend = function () {
    this.booted = true;
    return Promise.resolve();
  };

  /**
   * Run `code` in a sandboxed hidden iframe.
   * Console output is forwarded via postMessage.
   * `onOutput(text, 'stdout'|'stderr')` is called for each line.
   * `onDone()` fires 1.5 s after the iframe loads (enough for short async code).
   */
  TutorialCode.prototype._stopExecution = function () {
    if (this._webcontainerRunProcess) {
      try { this._webcontainerRunProcess.kill(); } catch (e) { }
      this._webcontainerRunProcess = null;
      var runBtnWc = this.root && this.root.querySelector('.tvm-run-btn');
      var stopBtnWc = this.root && this.root.querySelector('.tvm-stop-btn');
      if (runBtnWc && (!this._debuggerCtl || !this._debuggerCtl.session)) {
        runBtnWc.disabled = false;
        runBtnWc.textContent = '\u25b6 ' + this._effectiveRunLabel();
      }
      if (stopBtnWc) stopBtnWc.style.display = 'none';
    }
    if (this._jsFinish) {
      this._jsFinish();
      this._jsFinish = null;
    }
    if (this._jsRunnerFrame) {
      try { document.body.removeChild(this._jsRunnerFrame); } catch (e) { }
      this._jsRunnerFrame = null;
    }
  };

  TutorialCode.prototype._runBrowserCode = function (code, onOutput, onDone, timeoutOverride) {
    var self = this;
    if (this._jsFinish) {
      this._jsFinish();
    }
    if (this._jsRunnerFrame) {
      try { document.body.removeChild(this._jsRunnerFrame); } catch (e) { }
      this._jsRunnerFrame = null;
    }

    var frame = document.createElement('iframe');
    frame.style.cssText = 'display:none;position:absolute;left:-9999px;width:1px;height:1px;';
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('title', 'Hidden JavaScript execution sandbox');
    document.body.appendChild(frame);
    this._jsRunnerFrame = frame;

    var runId = ++this._jsRunnerMsgId;
    var rid = runId;
    var done = false;

    function finish() {
      if (done) return;
      done = true;
      if (self._jsSafetyTimer) { clearTimeout(self._jsSafetyTimer); self._jsSafetyTimer = null; }
      window.removeEventListener('message', msgListener);
      if (onDone) onDone();
    }
    this._jsFinish = finish;

    var step = this.steps[this.currentStep >= 0 ? this.currentStep : 0];
    var isServerStep = step && (step.http_client === true || step.terminal === true);
    var safetyTimeoutVal = timeoutOverride || (isServerStep ? 3600000 : 5000);
    var sandboxTimeoutVal = timeoutOverride || (isServerStep ? 3600000 : 5500);

    var safetyTimer = setTimeout(finish, safetyTimeoutVal);
    this._jsSafetyTimer = safetyTimer;

    function msgListener(e) {
      if (!e.data || e.data.__jsrun !== true || e.data.__rid !== runId) return;
      if (e.data.type === 'done') { finish(); return; }
      if (e.data.type === 'sync_done') {
        if (!isServerStep) {
          // Give a short grace period (200ms) for any pending console logs
          // or setTimeout(0) calls to finish before we kill the frame.
          setTimeout(finish, 200);
        }
        return;
      }
      if (e.data.type === 'http_response') {
        self._handleHttpResponse(e.data);
        return;
      }
      if (onOutput) onOutput(e.data.text || '', e.data.type === 'stderr' ? 'stderr' : 'stdout');
    }
    window.addEventListener('message', msgListener);

    // Build file maps for the sandbox module system and fs mock
    var jsFiles = {}, fsFiles = {};
    for (var fn in self.editorModels) {
      if (self.editorModels.hasOwnProperty(fn)) {
        var fc = self.editorModels[fn].model.getValue();
        if (/\.js$/.test(fn)) { jsFiles[fn] = fc; } else { fsFiles[fn] = fc; }
      }
    }

    var escaped = code.split('<\/script>').join('<\\/script>');

    var sandboxScript =
      '(function(){\n' +
      '  var rid=' + rid + ';\n' +
      '  function __s(t,x){parent.postMessage({__jsrun:true,__rid:rid,type:t,text:x},"*");}\n' +
      '  function __f(a){return Array.from(a).map(function(v){\n' +
      '    return typeof v==="object"&&v!==null?JSON.stringify(v,null,2):String(v);\n' +
      '  }).join(" ");}\n' +
      '  console.log =function(){__s("stdout",__f(arguments)+"\\n");};\n' +
      '  console.info =function(){__s("stdout",__f(arguments)+"\\n");};\n' +
      '  console.warn =function(){__s("stdout","[warn] "+__f(arguments)+"\\n");};\n' +
      '  console.error=function(){__s("stderr",__f(arguments)+"\\n");};\n' +
      '  window.onerror=function(m,src,l,c,e){\n' +
      '    __s("stderr",(e&&(e.stack||e.message)?e.stack||e.message:m)+"\\n");\n' +
      '    return true;\n' +
      '  };\n' +
      '  window.addEventListener("unhandledrejection",function(e){\n' +
      '    __s("stderr","UnhandledPromiseRejection: "+(e.reason?e.reason.message||String(e.reason):"Unknown")+"\\n");\n' +
      '  });\n' +

      '  // Node.js globals\n' +
      '  var module = { exports: {} }; var exports = module.exports;\n' +
      '  // Mock Node.js modules\n' +
      '  var __server_handler = null;\n' +
      '  var __jsFiles = ' + JSON.stringify(jsFiles) + ';\n' +
      '  var __fsFiles = ' + JSON.stringify(fsFiles) + ';\n' +
      '  var __moduleCache = {};\n' +
      '  function __matchRoute(pat, url) {\n' +
      '    if (!pat || pat === "*") return {};\n' +
      '    var pp = pat.split("/"), up = url.split("/");\n' +
      '    if (pp.length !== up.length) return null;\n' +
      '    var prms = {};\n' +
      '    for (var i = 0; i < pp.length; i++) {\n' +
      '      if (pp[i] && pp[i][0] === ":") { prms[pp[i].slice(1)] = decodeURIComponent(up[i]); }\n' +
      '      else if (pp[i] !== up[i]) return null;\n' +
      '    }\n' +
      '    return prms;\n' +
      '  }\n' +
      '  function __makeRouter() {\n' +
      '    var rr = [];\n' +
      '    return {\n' +
      '      get:    function(p,h){rr.push({m:"GET",p:p,h:h});},\n' +
      '      post:   function(p,h){rr.push({m:"POST",p:p,h:h});},\n' +
      '      put:    function(p,h){rr.push({m:"PUT",p:p,h:h});},\n' +
      '      "delete": function(p,h){rr.push({m:"DELETE",p:p,h:h});},\n' +
      '      use:    function(p,h){if(typeof p==="function"){h=p;p="*";}if(h)rr.push({m:"USE",p:p,h:h});},\n' +
      '      __routes: rr\n' +
      '    };\n' +
      '  }\n' +
      '  window.require = function(m) {\n' +
      '    if (m === "http") return {\n' +
      '      createServer: function(h) { __server_handler = h; return { listen: function(p, h, c) { var cb = typeof h === "function" ? h : c; console.log("HTTP server listening on port " + p); if (cb) cb(); } }; }\n' +
      '    };\n' +
      '    if (m === "express") {\n' +
      '      var ef = function() {\n' +
      '        var routes = [];\n' +
      '        var app = {\n' +
      '          get:    function(p, h) { routes.push({ m: "GET",    p: p, h: h }); },\n' +
      '          post:   function(p, h) { routes.push({ m: "POST",   p: p, h: h }); },\n' +
      '          put:    function(p, h) { routes.push({ m: "PUT",    p: p, h: h }); },\n' +
      '          "delete": function(p, h) { routes.push({ m: "DELETE", p: p, h: h }); },\n' +
      '          all: function(p, h) {\n' +
      '            ["GET", "POST", "PUT", "DELETE"].forEach(function(m) {\n' +
      '              routes.push({ m: m, p: p, h: h });\n' +
      '            });\n' +
      '          },\n' +
      '          use:    function(p, h) {\n' +
      '            if (typeof p === "function") { h = p; p = "*"; }\n' +
      '            if (!h) return;\n' +
      '            if (h.__routes) { routes.push({ m: "MOUNT", p: p, router: h.__routes }); }\n' +
      '            else { routes.push({ m: "USE", p: p, h: h }); }\n' +
      '          },\n' +
      '          listen: function(port, host, cb) {\n' +
      '            var actualCb = typeof host === "function" ? host : cb;\n' +
      '            console.log("Express server listening on port " + port);\n' +
      '            if (actualCb) actualCb();\n' +
      '            __server_handler = function(req, res) {\n' +
      '              res.status = function(s) { this._status = s; this.writeHead(s); return this; };\n' +
      '              res.json   = function(obj) { this.writeHead(this._status||200); this.end(JSON.stringify(obj, null, 2)); };\n' +
      '              res.send   = function(body) {\n' +
      '                if (typeof body === "object") return this.json(body);\n' +
      '                this.end(String(body));\n' +
      '              };\n' +
      '              var found = null, foundParams = {};\n' +
      '              outer: for (var ri = 0; ri < routes.length; ri++) {\n' +
      '                var r = routes[ri];\n' +
      '                if (r.m === "MOUNT") {\n' +
      '                  var pfx = r.p, sub = req.url;\n' +
      '                  if (sub === pfx) sub = "/";\n' +
      '                  else if (sub.indexOf(pfx + "/") === 0) sub = sub.slice(pfx.length);\n' +
      '                  else continue;\n' +
      '                  for (var rj = 0; rj < r.router.length; rj++) {\n' +
      '                    var sr = r.router[rj];\n' +
      '                    if (sr.m === req.method) {\n' +
      '                      var sp = __matchRoute(sr.p, sub);\n' +
      '                      if (sp !== null) { found = sr.h; foundParams = sp; break outer; }\n' +
      '                    }\n' +
      '                  }\n' +
      '                } else if (r.m === req.method) {\n' +
      '                  var rp = __matchRoute(r.p, req.url);\n' +
      '                  if (rp !== null) { found = r.h; foundParams = rp; break; }\n' +
      '                }\n' +
      '              }\n' +
      '              if (found) { req.params = foundParams; found(req, res); }\n' +
      '              else { res.writeHead(404); res.end("404 Not Found"); }\n' +
      '            };\n' +
      '          }\n' +
      '        };\n' +
      '        return app;\n' +
      '      };\n' +
      '      ef.Router = __makeRouter;\n' +
      '      ef.json = function() { return function(req, res, next) { if (next) next(); }; };\n' +
      '      return ef;\n' +
      '    }\n' +
      '    if (m === "fs") {\n' +
      '      return {\n' +
      '        readFile: function(p, e, cb) {\n' +
      '          if (typeof e === "function") { cb = e; }\n' +
      '          setTimeout(function() {\n' +
      '            var d = __fsFiles[p];\n' +
      '            if (d === undefined) cb(new Error("ENOENT: no such file or directory, open \'" + p + "\'"), null);\n' +
      '            else cb(null, d);\n' +
      '          }, 0);\n' +
      '        },\n' +
      '        readFileSync: function(p, e) {\n' +
      '          var d = __fsFiles[p];\n' +
      '          if (d === undefined) throw new Error("ENOENT: no such file: \'" + p + "\'");\n' +
      '          return d;\n' +
      '        },\n' +
      '        writeFile: function(p, data, e, cb) {\n' +
      '          if (typeof e === "function") { cb = e; }\n' +
      '          __fsFiles[p] = String(data);\n' +
      '          setTimeout(function() { if (cb) cb(null); }, 0);\n' +
      '        },\n' +
      '        promises: {\n' +
      '          readFile: function(p, e) {\n' +
      '            return new Promise(function(ok, err) {\n' +
      '              setTimeout(function() {\n' +
      '                var d = __fsFiles[p];\n' +
      '                if (d === undefined) err(new Error("ENOENT: no such file or directory, open \'" + p + "\'"));\n' +
      '                else ok(d);\n' +
      '              }, 0);\n' +
      '            });\n' +
      '          }\n' +
      '        }\n' +
      '      };\n' +
      '    }\n' +
      '    if (typeof m === "string" && m.indexOf("./") === 0) {\n' +
      '      var mkey = m.replace(/^\\.\\//,"").replace(/\\.js$/,"");\n' +
      '      if (__moduleCache.hasOwnProperty(mkey)) return __moduleCache[mkey];\n' +
      '      var msrc = __jsFiles[mkey + ".js"] || __jsFiles[mkey];\n' +
      '      if (msrc === undefined) throw new Error("Cannot find module: " + m);\n' +
      '      var mod = { exports: {} };\n' +
      '      __moduleCache[mkey] = mod.exports;\n' +
      '      (new Function("require","module","exports", msrc))(window.require, mod, mod.exports);\n' +
      '      __moduleCache[mkey] = mod.exports;\n' +
      '      return mod.exports;\n' +
      '    }\n' +
      '    throw new Error("Module not found: " + m);\n' +
      '  };\n' +

      '  window.addEventListener("message", function(e) {\n' +
      '    if (!e.data || e.data.type !== "http_request" || !__server_handler) return;\n' +
      '    var rawUrl = e.data.url;\n' +
      '    if (rawUrl.indexOf("http") === 0) {\n' +
      '      try { var u = new URL(rawUrl); rawUrl = u.pathname + u.search; } catch(err) { }\n' +
      '    }\n' +
      '    var urlParts = rawUrl.split("?");\n' +
      '    var query = {};\n' +
      '    if (urlParts[1]) {\n' +
      '      urlParts[1].split("&").forEach(function(p) {\n' +
      '        var pair = p.split("=");\n' +
      '        query[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || "");\n' +
      '      });\n' +
      '    }\n' +
      '    var body = e.data.body;\n' +
      '    try {\n' +
      '      if (typeof body === "string" && (body.trim().indexOf("{") === 0 || body.trim().indexOf("[") === 0)) {\n' +
      '        body = JSON.parse(body);\n' +
      '      }\n' +
      '    } catch(err) { }\n' +
      '    var req = { method: e.data.method, url: urlParts[0], query: query, params: {}, body: body, headers: {} };\n' +
      '    var res = {\n' +
      '      _body: "", _status: 200, \n' +
      '      writeHead: function(s) { this._status = s; },\n' +
      '      end: function(b) {\n' +
      '        this._body = b || this._body;\n' +
      '        parent.postMessage({__jsrun:true,__rid:rid,type:"http_response",status:this._status,body:this._body},"*");\n' +
      '      }\n' +
      '    };\n' +
      '    try { __server_handler(req, res); } catch(err) { res.status(500).send(err.stack || err.message); }\n' +
      '  });\n' +
      '})();';

    frame.srcdoc = '<!DOCTYPE html><html><head><script>' + sandboxScript + '<\/script></head><body><script>' +
      'try{\n' + escaped + '\n}catch(e){console.error(e.stack||e.message);}\n' +
      'parent.postMessage({__jsrun:true,__rid:' + rid + ',type:"sync_done"},"*");\n' +
      'setTimeout(function(){parent.postMessage({__jsrun:true,__rid:' + rid + ',type:"done"},"*");},' + sandboxTimeoutVal + ');' +
      '<\/script></body></html>';
  };

  TutorialCode.prototype._rebuildReactPreview = function (onReady) {
    if (!this._previewFrame) return;
    var self = this;
    var step = this.steps[this.currentStep >= 0 ? this.currentStep : 0];
    var srcdoc = this._buildReactSrcdoc(step);
    if (onReady) {
      var fired = false;
      var safetyTimeout = setTimeout(function () {
        if (!fired) { fired = true; onReady(); }
      }, 2000);
      this._previewFrame.onload = function () {
        clearTimeout(safetyTimeout);
        if (!fired) { fired = true; setTimeout(onReady, 700); }
      };
    }
    this._previewFrame.srcdoc = srcdoc;
  };

  TutorialCode.prototype._getReactPreviewFileOrder = function (step) {
    var self = this;
    var fileOrder;
    var pwCfg = this._playwrightStepConfig ? this._playwrightStepConfig(step) : {};
    var appFiles = pwCfg && (pwCfg.app_files || pwCfg.appFiles);
    if (this._playwrightMode && appFiles && appFiles.length) {
      fileOrder = appFiles.slice();
    } else if (step && step.react_files) {
      fileOrder = step.react_files;
    } else if (step && step.files) {
      fileOrder = step.files.map(function (f) { return f.path; });
    } else {
      fileOrder = Object.keys(self.editorModels);
    }
    if (this._playwrightMode) {
      fileOrder = fileOrder.filter(function (filename) {
        if (self._isPlaywrightTestFile(filename, step)) return false;
        if (/(?:^|\/)playwright\.config\.[cm]?[jt]s$/i.test(filename)) return false;
        if (/(?:^|\/)package(?:-lock)?\.json$/i.test(filename)) return false;
        return true;
      });
    }
    return fileOrder;
  };

  /**
   * Hot-patch the live preview via postMessage instead of replacing srcdoc.
   * Falls back to a full rebuild if the frame isn't ready (Babel not loaded yet).
   */
  TutorialCode.prototype._patchReactPreview = function () {
    if (!this._previewFrame) return;
    // Check if Babel is available in the frame — if not, fall back to full rebuild
    var fw;
    try { fw = this._previewFrame.contentWindow; } catch (e) { fw = null; }
    if (!fw || !fw.Babel) { return this._rebuildReactPreview(); }

    var self = this;
    var step = this.steps[this.currentStep >= 0 ? this.currentStep : 0];
    var fileOrder = this._getReactPreviewFileOrder(step);

    var stepIdx = this.currentStep >= 0 ? this.currentStep : 0;
    var appAlias = 'App_s' + stepIdx;

    var userCss = [];
    var files = fileOrder.map(function (filename) {
      var entry = self.editorModels[filename];
      if (!entry) return null;
      var content = entry.model.getValue();
      if (filename.endsWith('.css')) { userCss.push(content); return null; }
      content = content.replace(/^\s*import\s+.*$/gm, '');
      content = content.replace(/^\s*export\s+\{[^}]*\};?\s*$/gm, '');
      content = content.replace(/^\s*export\s+(?:default\s+)?/gm, '');
      content = content.replace(/\bApp\b/g, appAlias);
      return content;
    }).filter(Boolean);

    var isDark = this._isDarkMode();
    var bodyBg = isDark ? '#1e1e1e' : '#fff';
    var bodyColor = isDark ? '#d4d4d4' : '#333';
    var customStyles = ((step && step.preview_styles) || '') + '\n' + userCss.join('\n');
    var css = '* { box-sizing: border-box; }\n' +
      'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;' +
      ' padding: 0; margin: 0; background: ' + bodyBg + '; color: ' + bodyColor + '; }\n' +
      customStyles;

    var payload = { type: 'react-hot-reload', files: files, css: css, appAlias: appAlias };
    fw.postMessage(payload, '*');
    // If a preview popout is open, forward the patch over BroadcastChannel
    // so the popup's iframe re-renders too — same hot-reload, near-instant.
    if (this._popoutManager && this._popoutManager.isDetached('output')) {
      this._popoutManager.broadcastReactPatch(payload);
    }
  };

  TutorialCode.prototype._buildReactSrcdoc = function (step) {
    var self = this;
    var fileOrder = this._getReactPreviewFileOrder(step);

    // Give the App component a step-unique name so it never collides across
    // steps when Babel compiles all <script type="text/babel"> tags into the
    // same global scope.  e.g. step 0 → App_s0, step 2 → App_s2.
    var stepIdx = this.currentStep >= 0 ? this.currentStep : 0;
    var appAlias = 'App_s' + stepIdx;

    var userCss = [];
    var scripts = fileOrder.map(function (filename) {
      var entry = self.editorModels[filename];
      if (!entry) return '';
      var content = entry.model.getValue();
      // CSS files go into a <style> tag, not a script tag
      if (filename.endsWith('.css')) {
        userCss.push(content);
        return '';
      }
      // Strip ES module import/export (global-script approach for browser sandbox)
      content = content.replace(/^\s*import\s+.*$/gm, '');
      content = content.replace(/^\s*export\s+\{[^}]*\};?\s*$/gm, '');
      content = content.replace(/^\s*export\s+(?:default\s+)?/gm, '');
      // Rename the top-level App component/class to the step-scoped alias so
      // that re-builds on the same or adjacent steps never hit a "already
      // defined" collision in the shared Babel global scope.
      content = content.replace(/\bApp\b/g, appAlias);
      // Escape </script> closing tags inside content to avoid breaking the outer tag
      content = content.split('<\/script>').join('<\\/script>');
      return '<script type="text/babel">\n' + content + '\n<\/script>';
    }).join('\n');

    var customStyles = ((step && step.preview_styles) || '') + '\n' + userCss.join('\n');

    var isDark = this._isDarkMode();
    var bodyBg = isDark ? '#1e1e1e' : '#fff';
    var bodyColor = isDark ? '#d4d4d4' : '#333';
    var bsTheme = isDark ? 'dark' : 'light';
    var pwCfg = this._playwrightStepConfig ? this._playwrightStepConfig(step) : {};
    var playwrightAgent = '';
    if (this._playwrightMode && window.SEBookPlaywrightCompat && window.SEBookPlaywrightCompat.agentScript) {
      playwrightAgent = '<script>\n' + window.SEBookPlaywrightCompat.agentScript({
        testIdAttribute: pwCfg.test_id_attribute || pwCfg.testIdAttribute || 'data-testid',
      }) + '\n<\/script>\n';
    }

    return '<!DOCTYPE html>\n<html lang="en" data-bs-theme="' + bsTheme + '">\n<head>\n' +
      '<meta charset="UTF-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
      '<script>\n' +
      'window.addEventListener("error", function(e) {\n' +
      '  var r = document.getElementById("root");\n' +
      '  if (!r) return;\n' +
      '  var msg = (e.error ? e.error.message : e.message) || "";\n' +
      '  msg = msg.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");\n' +
      '  r.innerHTML = \'<div style="color:#c0392b;background:#fdf2f2;border-left:4px \' +\n' +
      '    \'solid #c0392b;padding:16px;margin:16px;font-family:monospace;font-size:13px;\' +\n' +
      '    \'border-radius:4px;white-space:pre-wrap"><strong>Error:</strong><br>\' +\n' +
      '    msg + \'</div>\';\n' +
      '});\n' +
      '<\/script>\n' +
      playwrightAgent +
      '<script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"><\/script>\n' +
      '<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\/script>\n' +
      '<script>\n' +
      '/* Hot-reload: cache createRoot + listen for file patches from the tutorial host */\n' +
      '(function(){\n' +
      '  if(window.ReactDOM&&typeof ReactDOM.createRoot==="function"){\n' +
      '    var _oCR=ReactDOM.createRoot.bind(ReactDOM);\n' +
      '    ReactDOM.createRoot=function(el){if(!window.__rr)window.__rr=_oCR(el);return window.__rr;};\n' +
      '  }\n' +
      '  window.addEventListener("message",function(e){\n' +
      '    if(!e.data||e.data.type!=="react-hot-reload")return;\n' +
      '    if(!window.Babel)return;\n' +
      '    var s=document.getElementById("__user-styles__");\n' +
      '    if(s&&e.data.css!==undefined)s.textContent=e.data.css;\n' +
      '    var files=e.data.files||[];\n' +
      '    var alias=e.data.appAlias;\n' +
      '    var rootEl=document.getElementById("root");\n' +
      '    try{\n' +
      '      for(var i=0;i<files.length;i++){\n' +
      '        var t=Babel.transform(files[i],{presets:["react"],filename:"hot.jsx"}).code;\n' +
      '        (0,eval)(t);\n' +
      '      }\n' +
      '      if(window.__rr&&alias&&window[alias]){\n' +
      '        window.__rr.render(React.createElement(window[alias],null));\n' +
      '      }\n' +
      '    }catch(err){\n' +
      '      var m=(err.message||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");\n' +
      '      rootEl.innerHTML=\'<div style="color:#c0392b;background:#fdf2f2;border-left:4px solid \'+\n' +
      '        \'#c0392b;padding:16px;margin:16px;font-family:monospace;font-size:13px;\'+\n' +
      '        \'border-radius:4px;white-space:pre-wrap"><strong>Error:</strong><br>\'+m+\'</div>\';\n' +
      '    }\n' +
      '  });\n' +
      '})();\n' +
      '<\/script>\n' +
      '<script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>\n' +
      '<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">\n' +
      '<script src="https://cdn.jsdelivr.net/npm/react-bootstrap@2.10.7/dist/react-bootstrap.min.js"><\/script>\n' +
      '<style id="__user-styles__">\n* { box-sizing: border-box; }\n' +
      'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;\n' +
      '       padding: 0; margin: 0; background: ' + bodyBg + '; color: ' + bodyColor + '; }\n' +
      customStyles + '\n</style>\n</head>\n<body>\n<div id="root"></div>\n' +
      scripts + '\n</body>\n</html>';
  };

  // ---------------------------------------------------------------------------
  // Monaco Editor
  // ---------------------------------------------------------------------------
  TutorialCode.prototype._monacoEditorOptions = function () {
    var opts = {
      language: this.config.backend === 'pyodide' ? 'python' :
        this.config.backend === 'react' ? 'jsx' :
          (this.config.backend === 'browser' || this.config.backend === 'webcontainer') ? 'javascript' :
            this.config.backend === 'prolog' ? 'prolog' :
              this.config.backend === 'java' ? 'java' : 'shell-sebook',
      theme: this._isDarkMode() ? THEMES.dark.monaco : THEMES.light.monaco,
      fontSize: this.config.fontSize,
      fontFamily: "'Fira Code', 'Cascadia Code', Menlo, monospace",
      minimap: { enabled: false },
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      wordWrap: 'on',
      padding: { top: 8 },
      // Glyph margin is the click-target column for breakpoints. Only enable
      // when the time-travel debugger is opted in — otherwise an empty grey
      // column would appear next to line numbers in non-debugger tutorials.
      glyphMargin: !!this.debuggerEnabled,
      // Reserve a wider line-decorations gutter when the git-gutter feature
      // is on so our 4px-wide bar with 4px margin always fits.
      lineDecorationsWidth: this.config.enableGitGutter ? 14 : 10,
    };
    if (this.debuggerEnabled) {
      opts.lineHeight = Math.max(24, Math.ceil(this.config.fontSize * 1.5));
    }
    return opts;
  };

  // Lazy-load the time-travel debugger module. Inserts <script> + <link> for
  // js/debugger/{main.js,debugger.css}, then awaits `window.SEBookDebugger`
  // global and calls its `attach(this)` hook. No-op when debuggerEnabled is
  // false — the `start()` chain skips this method entirely. See plan file at
  // .claude/plans/what-would-be-options-temporal-ritchie.md for architecture.
  TutorialCode.prototype._loadDebuggerModule = function () {
    var self = this;
    var needsNodeChannel = false;
    var needsBrowserChannel = self.config.backend === 'browser' || self.config.backend === 'webcontainer';
    return new Promise(function (resolve, reject) {
      var dbgAssetVersion = String(Date.now());
      function ensureCss() {
        var existing = document.querySelector('link[data-sebook-debugger-css="true"]');
        if (existing) return;
        var css = document.createElement('link');
        css.rel = 'stylesheet';
        css.setAttribute('data-sebook-debugger-css', 'true');
        css.href = '/js/debugger/debugger.css?v=' + dbgAssetVersion;
        document.head.appendChild(css);
      }
      function loadScriptOnce(src) {
        return new Promise(function (res, rej) {
          var s = document.createElement('script');
          s.src = src;
          s.onload = res;
          s.onerror = function () { rej(new Error('Failed to load: ' + src)); };
          document.head.appendChild(s);
        });
      }
      function attach() {
        ensureCss();
        if (window.SEBookDebugger && typeof window.SEBookDebugger.attach === 'function') {
          try { window.SEBookDebugger.attach(self); } catch (e) { return reject(e); }
          resolve();
        } else {
          reject(new Error('SEBookDebugger global not found after script load'));
        }
      }
      ensureCss();
      // Load shared modules (sync bus, editor-attach, ui-render) in parallel
      // BEFORE main.js — main.js wires them together in install(). The same
      // modules are also loaded by tutorial-debugger-popup.html so popouts
      // share the exact same code path.
      var sharedScripts = Promise.all([
        window.DebuggerSync ? null : loadScriptOnce('/js/debugger/sync.js?v=' + dbgAssetVersion),
        window.SEBookDebuggerEditor ? null : loadScriptOnce('/js/debugger/editor-attach.js?v=' + dbgAssetVersion),
        window.SEBookDebuggerUI ? null : loadScriptOnce('/js/debugger/ui-render.js?v=' + dbgAssetVersion),
      ]);
      var p = sharedScripts.then(function () {
        if (window.SEBookDebugger) return null;
        return loadScriptOnce('/js/debugger/main.js?v=' + dbgAssetVersion);
      });
      // The WebContainer runtime is used for Run/Test, but its in-browser Node
      // inspector does not reliably support CDP pause/step commands. Debugging
      // webcontainer JavaScript therefore uses the same instrumented browser
      // channel as the browser backend.
      if (needsNodeChannel) {
        p = p.then(function () {
          if (window.SEBookNodeChannel) return null;
          return loadScriptOnce('/js/debugger/node-channel.js?v=' + dbgAssetVersion);
        });
      }
      // Browser-backend tutorials use the browser channel (sandboxed iframe
      // + acorn AST instrumentation + SAB for synchronous step pause).
      if (needsBrowserChannel) {
        p = p.then(function () {
          if (window.SEBookBrowserChannel) return null;
          return loadScriptOnce('/js/debugger/browser-channel.js?v=' + dbgAssetVersion);
        });
      }
      p.then(attach).catch(reject);
    });
  };

  TutorialCode.prototype._initEditor = function () {
    var self = this;
    var opts = this._monacoEditorOptions();
    opts.value = '// Follow the tutorial steps on the left.\n';
    this.editor = monaco.editor.create(this.editorContainerEl, opts);
    this._attachEditorCommands(this.editor);

    // Clicking/focusing inside the left editor promotes its file to "active" —
    // this drives Run, Save, and test-runner actions on the focused pane.
    this.editor.onDidFocusEditorText(function () {
      if (self._leftActiveFile) self.activeFileName = self._leftActiveFile;
    });

    if (this.editorSplitSupported) {
      var opts2 = this._monacoEditorOptions();
      opts2.value = '';
      this.editor2 = monaco.editor.create(this.editorContainerElRight, opts2);
      this._attachEditorCommands(this.editor2);
      this.editor2.onDidFocusEditorText(function () {
        if (self._rightActiveFile) self.activeFileName = self._rightActiveFile;
      });
    }

    this._initRefactorings();
    return Promise.resolve();
  };

  TutorialCode.prototype._attachEditorCommands = function (editor) {
    var self = this;
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      function () { self._saveCurrentFile(); }
    );
    if (this.config.backend === 'pyodide' || this.config.backend === 'browser' || this.config.backend === 'java') {
      editor.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
        function () { self._runCurrentFile(); }
      );
    }
  };

  TutorialCode.prototype._initRefactorings = function () {
    if (!window.SebookRefactorings || this._refactoringController) return;
    var self = this;
    var editors = [this.editor];
    if (this.editor2) editors.push(this.editor2);
    this._refactoringController = window.SebookRefactorings.attach({
      monaco: monaco,
      editors: editors,
      getActiveFileName: function (editor) {
        if (editor === self.editor2) return self._rightActiveFile || self.activeFileName;
        return self._leftActiveFile || self.activeFileName;
      },
      getWorkspace: function (ctx) {
        return self._buildRefactoringWorkspace({
          activeFile: ctx && ctx.activeFile,
        });
      },
      applyEdits: function (edits, plan) {
        return self._applyRefactoringEdits(edits, plan);
      },
    });
  };

  /**
   * Classify a file as 'left' (code / implementation) or 'right' (tests).
   * Explicit `pane:` overrides from YAML file specs take precedence; otherwise
   * match common test-file naming conventions across Python, JS/TS, and Java.
   */
  TutorialCode.prototype._paneForFile = function (filename) {
    if (this._filePaneOverrides && this._filePaneOverrides[filename]) {
      return this._filePaneOverrides[filename];
    }
    if (/(?:^|\/)test_[^\/]+\.[a-z]+$/i.test(filename)) return 'right';
    if (/_test\.[a-z]+$/i.test(filename)) return 'right';
    if (/\.test\.[a-z]+$/i.test(filename)) return 'right';
    if (/\.spec\.[a-z]+$/i.test(filename)) return 'right';
    if (/Test\.java$/i.test(filename)) return 'right';
    if (/(?:^|\/)tests?\//i.test(filename)) return 'right';
    return 'left';
  };

  TutorialCode.prototype.openFile = function (filename, content, language, fileSpec) {
    // If a JSX/TSX file is explicitly tagged "javascript"/"typescript", use the
    // JSX Monarch tokenizer so tags like <div> get proper syntax highlighting.
    if (language === 'javascript' && /\.jsx$/i.test(filename)) language = 'jsx';
    if ((language === 'javascript' || language === 'typescript') && /\.tsx$/i.test(filename)) language = 'jsx';
    language = language || detectLanguage(filename);
    // Record per-file pane override (e.g. YAML: `pane: left`) before classification
    if (fileSpec && fileSpec.pane && (fileSpec.pane === 'left' || fileSpec.pane === 'right')) {
      this._filePaneOverrides[filename] = fileSpec.pane;
    }
    if (!this.editorModels[filename]) {
      var uri = monaco.Uri.parse('file:///' + filename);
      var existing = monaco.editor.getModel(uri);
      if (existing) existing.dispose();
      var model = monaco.editor.createModel(content || '', language, uri);
      this.editorModels[filename] = { model: model, filename: filename, lastSyncContent: content || '' };
      var self = this;
      var saveTimer;
      var lintTimer;
      var gutterTimer;
      model.onDidChangeContent(function () {
        // Lint + gutter reflect CURRENT content, regardless of who changed
        // it — so they run even during programmatic edits (step transitions,
        // Apply Solution, popup-driven setValue) when _suppressAutoSave is on.
        // Save is the only thing gated by _suppressAutoSave, since we don't
        // want programmatic changes to cascade back to disk.
        if (self.config.enableLinter && self._isPythonFile(filename)) {
          clearTimeout(lintTimer);
          lintTimer = setTimeout(function () { self._lintFile(filename); }, 400);
        }
        if (self.config.enableGitGutter) {
          clearTimeout(gutterTimer);
          gutterTimer = setTimeout(function () { self._refreshGitGutter(filename); }, 300);
        }
        if (self._suppressAutoSave) return;
        clearTimeout(saveTimer);
        saveTimer = setTimeout(function () { self._syncFileToBackend(filename); }, 800);
        // UML refresh is deferred to explicit save (_saveCurrentFile) — not on every keystroke.
        // React preview is also save-only — popups send a request-save via Ctrl+S.
      });
      // Initial lint pass when the file first opens.
      if (this.config.enableLinter && this._isPythonFile(filename)) {
        var initSelf = self;
        setTimeout(function () { initSelf._lintFile(filename); }, 100);
      }
      if (this.config.enableGitGutter) {
        var ggSelf = self;
        setTimeout(function () { ggSelf._refreshGitGutter(filename); }, 200);
      }
    } else if (content !== undefined) {
      this.editorModels[filename].model.setValue(content);
    }
    this._setActiveFile(filename);
    this._renderTabs();
    // Push fresh snapshots to any popups that reference this file. Covers
    // step-load, Reset Step, Apply Solution, autosave-restore — without
    // this, a popup would keep displaying stale content after the user
    // resets a step in main.
    if (this._popoutManager) {
      // Tab popup: deterministic role 'tab:<filename>'.
      if (this._popoutManager.isDetached('tab:' + filename)) {
        var fmeta = this._fileMeta(filename);
        if (fmeta) this._popoutManager._sendFileSnapshot(filename, fmeta);
      }
      // Pane popup: split-mode tutorials only.
      if (this._splitActive) {
        var pane = this._paneForFile(filename);
        if (this._isPaneDetached(pane)) {
          var meta = this._paneMeta(pane);
          if (meta) this._popoutManager._sendPaneSnapshot(pane, meta);
        }
      }
    }
  };

  TutorialCode.prototype._setActiveFile = function (filename) {
    var entry = this.editorModels[filename];
    if (!entry) return;
    this.activeFileName = filename;
    if (this._splitActive && this.editor2) {
      var pane = this._paneForFile(filename);
      if (pane === 'left') {
        this._leftActiveFile = filename;
        this.editor.setModel(entry.model);
      } else {
        this._rightActiveFile = filename;
        this.editor2.setModel(entry.model);
      }
    } else {
      // Tabs mode: single editor hosts every file
      this._leftActiveFile = filename;
      this.editor.setModel(entry.model);
    }
    if (this.debuggerEnabled && window.SEBookDebugger &&
        typeof window.SEBookDebugger.refreshBreakpoints === 'function') {
      window.SEBookDebugger.refreshBreakpoints(this);
    }
    this._refreshRunButtonLabel();
  };

  TutorialCode.prototype._renderTabs = function () {
    var self = this;
    this.editorTabsEl.innerHTML = '';
    if (this.editorTabsElRight) this.editorTabsElRight.innerHTML = '';
    if (this.editorTabsElRight) {
    }

    var splitMode = !!(this._splitActive && this.editor2);

    function makeTab(filename, isActive) {
      var detached = self._popoutManager && self._popoutManager.isDetached('tab:' + filename);
      var tab = document.createElement('div');
      tab.className = 'tvm-tab'
        + (isActive && !detached ? ' active' : '')
        + (detached ? ' detached' : '');
      tab.setAttribute('role', 'presentation');
      tab.title = detached ? filename + ' (open in popup window \u2014 click to focus)' : filename;
      var label = document.createElement('button');
      label.type = 'button';
      label.className = 'tvm-tab-label';
      label.textContent = detached ? (filename + ' \u2937') : filename;
      label.setAttribute('tabindex', isActive && !detached ? '0' : '-1');
      label.setAttribute('aria-current', isActive && !detached ? 'true' : 'false');
      tab.appendChild(label);

      function activateTab() {
        if (detached) {
          // Focus the popup window
          var entry = self._popoutManager._popups['tab:' + filename];
          if (entry && entry.window && !entry.window.closed) {
            try { entry.window.focus(); } catch (e) { /* ignore */ }
          }
          return;
        }
        self._setActiveFile(filename);
        self._renderTabs();
      }

      tab.addEventListener('click', activateTab);
      label.addEventListener('click', function (e) {
        e.stopPropagation();
        activateTab();
      });
      label.addEventListener('keydown', function (e) {
        var tabs = Array.prototype.slice.call(tab.parentElement.querySelectorAll('.tvm-tab-label'));
        var idx = tabs.indexOf(label);
        var nextIdx = idx;
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          activateTab();
          return;
        }
        if (e.key === 'ArrowRight') nextIdx = Math.min(tabs.length - 1, idx + 1);
        else if (e.key === 'ArrowLeft') nextIdx = Math.max(0, idx - 1);
        else if (e.key === 'Home') nextIdx = 0;
        else if (e.key === 'End') nextIdx = tabs.length - 1;
        else return;
        e.preventDefault();
        if (tabs[nextIdx]) {
          tabs[nextIdx].tabIndex = 0;
          tabs[nextIdx].focus();
        }
      });

      // In split mode, the pane-level \u29c9 button replaces per-tab popout \u2014 the
      // user pops out the whole pane, not individual files. Three cases below:
      //   detached \u2192 badge + reattach
      //   non-detached + non-split \u2192 popout button + drag handlers
      //   non-detached + split \u2192 no extra controls (pane button handles it)
      if (detached) {
        var badgeOnly = document.createElement('span');
        badgeOnly.className = 'tvm-tab-detached-badge';
        badgeOnly.textContent = '(detached)';
        tab.appendChild(badgeOnly);
        var reattachOnly = document.createElement('button');
        reattachOnly.type = 'button';
        reattachOnly.className = 'tvm-tab-reattach';
        reattachOnly.textContent = '\u21a9';
        reattachOnly.title = 'Bring file back to this window';
        reattachOnly.setAttribute('aria-label', 'Bring ' + filename + ' back to this window');
        reattachOnly.addEventListener('click', function (e) {
          e.stopPropagation();
          self._popoutManager.requestPopupClose('tab:' + filename);
        });
        tab.appendChild(reattachOnly);
      } else if (!splitMode) {
        // Pop-out button (mirrors UML's \u29c9 control)
        var pop = document.createElement('button');
        pop.type = 'button';
        pop.className = 'tvm-tab-popout';
        pop.textContent = '\u29c9';
        pop.title = 'Open file in separate window';
        pop.setAttribute('aria-label', 'Open ' + filename + ' in a separate window');
        pop.addEventListener('click', function (e) {
          e.stopPropagation();
          self._popoutFile(filename);
        });
        tab.appendChild(pop);

        // Drag-out detach: dragend with no drop target outside the window
        tab.draggable = true;
        tab.addEventListener('dragstart', function (e) {
          try { e.dataTransfer.setData('text/plain', filename); } catch (e2) { /* ignore */ }
          if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
          tab.classList.add('drag-source');
          self._tabDragState = {
            filename: filename,
            startX: e.clientX,
            startY: e.clientY,
            winW: window.innerWidth,
            winH: window.innerHeight,
          };
        });
        tab.addEventListener('dragend', function (e) {
          tab.classList.remove('drag-source');
          var ds = self._tabDragState;
          self._tabDragState = null;
          if (!ds) return;
          var x = e.clientX, y = e.clientY;
          var outside = (x <= 0 || y <= 0 || x >= ds.winW || y >= ds.winH);
          var dropEffect = e.dataTransfer && e.dataTransfer.dropEffect;
          // Some browsers report 0,0 when drop happens outside the window. Treat
          // a "none" dropEffect with a sufficiently long drag as also outside.
          var dragDist = Math.abs(x - ds.startX) + Math.abs(y - ds.startY);
          if (!outside && dropEffect === 'none' && dragDist > 60) {
            // ambiguous \u2014 only detach if clearly off the tab bar (mouseY above/below)
            outside = (y < 0) || (y > ds.winH - 20);
          }
          if (outside) self._popoutFile(ds.filename);
        });
      }
      return tab;
    }

    Object.keys(this.editorModels).forEach(function (filename) {
      if (self._splitActive && self.editor2) {
        var pane = self._paneForFile(filename);
        // Skip files whose pane is currently detached into a popup window
        if (self._isPaneDetached(pane)) return;
        var active = filename === (pane === 'left' ? self._leftActiveFile : self._rightActiveFile);
        var target = pane === 'left' ? self.editorTabsEl : self.editorTabsElRight;
        if (target) target.appendChild(makeTab(filename, active));
      } else {
        self.editorTabsEl.appendChild(makeTab(filename, filename === self.activeFileName));
      }
    });

    // Update editor-panel CSS classes for pane-detached state and surface a
    // "(detached) ↩" indicator inside the pane label so the user can click to
    // reattach without finding the popup window.
    var panel = this.root && this.root.querySelector('.tvm-editor-panel');
    var leftDet = this._isPaneDetached('left');
    var rightDet = this._isPaneDetached('right');
    if (panel) {
      panel.classList.toggle('tvm-editor-pane-detached-left', leftDet);
      panel.classList.toggle('tvm-editor-pane-detached-right', rightDet);
      // Both panes detached → editor area shrinks to its labels so the
      // output panel below can use the freed vertical space.
      panel.classList.toggle('tvm-editor-pane-detached-all', leftDet && rightDet);
    }
    ['left', 'right'].forEach(function (p) {
      var paneEl = self.root && self.root.querySelector('.tvm-editor-pane-' + p);
      if (!paneEl) return;
      var label = paneEl.querySelector('.tvm-editor-pane-label');
      if (!label) return;
      var detached = self._isPaneDetached(p);
      // Clear any inline flex/width set by a prior splitter drag so the
      // detached/reattached pane sizes from CSS, not from stale pixels.
      paneEl.style.flex = '';
      paneEl.style.width = '';
      var existing = label.querySelector('.tvm-pane-detached-indicator');
      if (detached) {
        if (!existing) {
          var ind = document.createElement('span');
          ind.className = 'tvm-pane-detached-indicator';
          ind.innerHTML = '<span class="tvm-tab-detached-badge">(detached)</span>'
            + '<button class="tvm-tab-reattach" type="button" title="Bring this pane back to the main view">↩</button>';
          label.appendChild(ind);
          ind.querySelector('.tvm-tab-reattach').addEventListener('click', function (e) {
            e.stopPropagation();
            self._popoutManager.requestPopupClose('pane:' + p);
          });
        }
      } else if (existing) {
        existing.parentNode.removeChild(existing);
      }
    });
    // After any detach state change, re-fit Monaco / xterm so they pick up the
    // new available size.
    if ((leftDet || rightDet) && this.editor && this.editor.layout) {
      try { this.editor.layout(); } catch (e) { /* ignore */ }
    }
    if ((leftDet || rightDet) && this.editor2 && this.editor2.layout) {
      try { this.editor2.layout(); } catch (e) { /* ignore */ }
    }
    if (this.fitAddon && this.fitAddon.fit) {
      try { this.fitAddon.fit(); } catch (e) { /* ignore */ }
    }

    // Update left-panel UML tab visibility based on whether files are being watched
    if (this._leftTabBarEl) {
      var umlLeftTab = this._leftTabBarEl.querySelector('[data-panel="uml"]');
      if (umlLeftTab) {
        umlLeftTab.style.display = this._umlWatchedFiles.length > 0 ? '' : 'none';
      }
    }

    // Update below-instructions UML view visibility (uml_position: below / bottom-left)
    if ((this._umlPositionBelow || this._umlPositionBottomLeft) && this._umlContainer) {
      var hasFiles = this._umlWatchedFiles.length > 0;
      this._umlContainer.style.display = hasFiles ? '' : 'none';
      if (hasFiles) {
        this._umlViewActive = true;
        this._scheduleUMLRefresh();
      }
    }

    // Update right-panel UML tab visibility (uml_position: right)
    var rightTabBar = this.root ? this.root.querySelector('.tvm-right-tab-bar') : null;
    if (rightTabBar) {
      var umlRightTab = rightTabBar.querySelector('[data-panel="uml"]');
      if (umlRightTab) {
        umlRightTab.style.display = this._umlWatchedFiles.length > 0 ? '' : 'none';
      }
    }

    // Ensure the active tab is always visible — scroll it into view horizontally
    // without affecting page-level vertical scroll (block: 'nearest').
    var activeTab = this.editorTabsEl.querySelector('.tvm-tab.active');
    if (activeTab) activeTab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (this.editorTabsElRight) {
      var activeTabRight = this.editorTabsElRight.querySelector('.tvm-tab.active');
      if (activeTabRight) activeTabRight.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  };

  /**
   * Switch between unified-tabs view (one editor) and split view (tests left,
   * code right). Persists the preference and re-syncs both Monaco editors so
   * each pane shows the right file.
   */
  TutorialCode.prototype._setSplitActive = function (active) {
    if (!this.editorSplitSupported) return;
    if (!!active === this._splitActive) return;
    // Pulled-out tabs and panes belong to the previous layout — close them
    // so the new layout starts with a clean, consistent view of every file.
    if (this._popoutManager) this._popoutManager.closeEditorPopups();
    this._splitActive = !!active;

    if (this.editorPanelEl) {
      this.editorPanelEl.classList.toggle('tvm-editor-split-active', this._splitActive);
    }
    // Three-column layout (instructions | tests | code) only in split mode.
    // In tabs mode the existing instructions/workspace ratio is preserved.
    if (this.root) {
      this.root.classList.toggle('tvm-split-layout-three-col', this._splitActive);
      // Clear any pixel-based inline flex set by prior splitter drags so the
      // CSS defaults for the new layout take effect.
      var instrPanel = this.root.querySelector('.tvm-instructions-panel');
      if (instrPanel) instrPanel.style.flex = '';
      var leftPane = this.root.querySelector('.tvm-editor-pane-left');
      var rightPane = this.root.querySelector('.tvm-editor-pane-right');
      if (leftPane) leftPane.style.flex = '';
      if (rightPane) rightPane.style.flex = '';
    }
    var btns = this.root.querySelectorAll('.tvm-editor-mode-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].getAttribute('data-mode') === (this._splitActive ? 'split' : 'tabs'));
      btns[i].setAttribute('aria-pressed', btns[i].classList.contains('active') ? 'true' : 'false');
    }

    try {
      localStorage.setItem('tutorial-editor-split-' + this.tutorialId, this._splitActive ? 'true' : 'false');
    } catch (e) { /* ignore */ }

    if (this._splitActive && this.editor2) {
      // Route the most-recently-active file into its natural pane, then pick a
      // sensible default for the other pane from any already-open files.
      var seed = this.activeFileName;
      var names = Object.keys(this.editorModels);
      var leftPick = null, rightPick = null;
      for (var j = 0; j < names.length; j++) {
        var p = this._paneForFile(names[j]);
        if (p === 'left' && !leftPick) leftPick = names[j];
        else if (p === 'right' && !rightPick) rightPick = names[j];
      }
      if (seed) {
        if (this._paneForFile(seed) === 'left') leftPick = seed;
        else rightPick = seed;
      }
      if (leftPick && this.editorModels[leftPick]) {
        this._leftActiveFile = leftPick;
        this.editor.setModel(this.editorModels[leftPick].model);
      }
      if (rightPick && this.editorModels[rightPick]) {
        this._rightActiveFile = rightPick;
        this.editor2.setModel(this.editorModels[rightPick].model);
      }
    } else if (!this._splitActive) {
      // Back to unified view — show whichever file was most recently active.
      var keep = this.activeFileName || this._leftActiveFile || this._rightActiveFile;
      if (keep && this.editorModels[keep]) {
        this.activeFileName = keep;
        this.editor.setModel(this.editorModels[keep].model);
      }
    }

    this._renderTabs();
    if (this.editor) this.editor.layout();
    if (this.editor2) this.editor2.layout();
  };

  TutorialCode.prototype._closeFile = function (filename) {
    var entry = this.editorModels[filename];
    if (!entry) return;
    entry.model.dispose();
    delete this.editorModels[filename];
    if (this._leftActiveFile === filename) this._leftActiveFile = null;
    if (this._rightActiveFile === filename) this._rightActiveFile = null;
    if (this.activeFileName === filename) {
      var remaining = Object.keys(this.editorModels);
      if (remaining.length > 0) this._setActiveFile(remaining[0]);
      else { this.activeFileName = null; this.editor.setModel(monaco.editor.createModel('')); }
    }
    this._renderTabs();
  };

  // Close editor files that are not visible for this step. Visibility can come
  // from starter files, explicit open_file, or watched backend files.
  TutorialCode.prototype._closeNonStepFiles = function (step) {
    var stepPaths = {};
    var visibleFiles = this._getStepVisibleFiles ? this._getStepVisibleFiles(step) : [];
    if (visibleFiles.length > 0) {
      visibleFiles.forEach(function (path) { stepPaths[path] = true; });
    } else if (step && step.files) {
      step.files.forEach(function (f) { stepPaths[f.path] = true; });
    }
    var self = this;
    Object.keys(this.editorModels).forEach(function (path) {
      if (!stepPaths[path]) self._closeFile(path);
    });
  };

  TutorialCode.prototype._saveCurrentFile = function () {
    if (!this.activeFileName) return;
    this._syncFileToBackend(this.activeFileName);
    var tab = this.editorTabsEl.querySelector('.tvm-tab.active');
    if (!tab && this.editorTabsElRight) tab = this.editorTabsElRight.querySelector('.tvm-tab.active');
    if (tab) { tab.classList.add('saved'); setTimeout(function () { tab.classList.remove('saved'); }, 1200); }
    if (this.autoSaveEnabled) this._saveFile(this.activeFileName);
    if (this.config.backend === 'react') this._patchReactPreview();
    // UML: refresh on explicit save if this file is watched
    if (this._umlWatchedFiles.indexOf(this.activeFileName) !== -1) {
      this._scheduleUMLRefresh(true);
    }
  };

  // ---------------------------------------------------------------------------
  // UML Popup / BroadcastChannel
  // ---------------------------------------------------------------------------

  TutorialCode.prototype._initUMLBroadcastChannel = function () {
    if (!window.BroadcastChannel || !this._umlDiagramEnabled) return;
    var self = this;
    this._umlChannel = new BroadcastChannel('uml-sync-' + window.location.pathname);
    this._umlChannel.addEventListener('message', function (e) {
      if (e.data.type === 'uml-ready') self._broadcastUMLState();
    });
  };

  TutorialCode.prototype._broadcastUMLState = function () {
    if (!this._umlChannel || !this._umlLastDiagrams) return;
    this._umlChannel.postMessage({
      type: 'uml-update',
      classDiagram: this._umlLastDiagrams.classDiagram
        ? this._applyTutorialClassLayout(this._umlLastDiagrams.classDiagram)
        : null,
      sequenceDiagram: this._umlLastDiagrams.sequenceDiagram || null,
      activeType: this._umlActiveType,
      color: this._umlCustomColor,
      darkMode: document.documentElement.classList.contains('dark-mode')
    });
  };

  TutorialCode.prototype._openUMLPopout = function () {
    var url = this.config.umlPopupUrl;
    if (!url) return;
    var channelName = 'uml-sync-' + window.location.pathname;
    var fullUrl = url + '?channel=' + encodeURIComponent(channelName);
    if (this._umlPopupWindow && !this._umlPopupWindow.closed) {
      this._umlPopupWindow.focus();
      this._broadcastUMLState();
      return;
    }
    this._umlPopupWindow = window.open(fullUrl, 'uml-popup',
      'width=900,height=700,resizable=yes,scrollbars=yes');
  };

  // ---------------------------------------------------------------------------
  // Tab / Instructions Pop-Out (TutorialPopoutManager bridge)
  // ---------------------------------------------------------------------------

  TutorialCode.prototype._popoutFile = function (filename) {
    if (!this._popoutManager || !this._popoutManager.isAvailable()) return;
    var meta = this._fileMeta(filename);
    if (!meta) return;
    var win = this._popoutManager.detachFile(filename, meta);
    if (!win) {
      this._showPopupBlockedToast('Popup blocked — click to detach ' + filename, (function (self) {
        return function () { self._popoutFile(filename); };
      })(this));
      return;
    }
    this._renderTabs();
    if (this._splitActive) {
      // If the detached file was the active file in its pane, swap to another file
      var pane = this._paneForFile(filename);
      if (pane === 'left' && this._leftActiveFile === filename) this._pickPaneActive('left');
      if (pane === 'right' && this._rightActiveFile === filename) this._pickPaneActive('right');
    } else if (this.activeFileName === filename) {
      var rest = Object.keys(this.editorModels).filter(function (f) {
        return f !== filename;
      });
      if (rest.length) this._setActiveFile(rest[0]);
    }
  };

  TutorialCode.prototype._isPaneDetached = function (pane) {
    if (!this._popoutManager) return false;
    return this._popoutManager.isDetached('pane:' + pane);
  };

  TutorialCode.prototype._popoutPane = function (pane) {
    if (!this._popoutManager || !this._popoutManager.isAvailable()) return;
    if (!this._splitActive) return;
    var self = this;
    var files = Object.keys(this.editorModels)
      .filter(function (f) { return self._paneForFile(f) === pane; });
    if (!files.length) return;
    var meta = files.map(function (f) {
      var entry = self.editorModels[f];
      return {
        filename: f,
        content: entry.model.getValue(),
        language: entry.model.getLanguageId
          ? entry.model.getLanguageId()
          : (entry.model._languageId || ''),
      };
    });
    var activeFile = pane === 'left' ? this._leftActiveFile : this._rightActiveFile;
    if (!activeFile || files.indexOf(activeFile) === -1) activeFile = files[0];
    var win = this._popoutManager.detachPane(pane, {
      files: meta,
      activeFile: activeFile,
      darkMode: document.documentElement.classList.contains('dark-mode'),
    });
    if (!win) {
      this._showPopupBlockedToast('Popup blocked — click to detach ' + pane + ' pane',
        (function (s, p) { return function () { s._popoutPane(p); }; })(this, pane));
      return;
    }
    this._renderTabs();
    // Layout the remaining pane to fill the freed width
    if (this.editor && this.editor.layout) try { this.editor.layout(); } catch (e) {/*ignore*/}
    if (this.editor2 && this.editor2.layout) try { this.editor2.layout(); } catch (e) {/*ignore*/}
  };

  TutorialCode.prototype._wirePanePopoutButtons = function () {
    if (!this.root) return;
    var self = this;
    var btns = this.root.querySelectorAll('.tvm-editor-pane-popout-btn');
    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var pane = btn.getAttribute('data-pane');
        if (pane) self._popoutPane(pane);
      });
    });
  };

  TutorialCode.prototype._wireOutputPopoutButton = function () {
    if (!this.root) return;
    var self = this;
    var btns = this.root.querySelectorAll('.tvm-output-popout-btn');
    btns.forEach(function (btn) {
      btn.addEventListener('click', function () { self._popoutOutput(); });
    });
  };

  TutorialCode.prototype._popoutOutput = function () {
    if (!this._popoutManager || !this._popoutManager.isAvailable()) return;
    var meta = this._outputMeta();
    if (!meta) return;
    var win = this._popoutManager.detachOutput(meta);
    if (!win) {
      this._showPopupBlockedToast('Popup blocked — click to detach output',
        this._popoutOutput.bind(this));
      return;
    }
    this._refreshOutputDetachedState();
    this._installOutputObserver();
  };

  TutorialCode.prototype._graphMeta = function () {
    if (!this.gitGraphContainerEl) return null;
    return {
      html: this.gitGraphContainerEl.innerHTML || '',
      darkMode: document.documentElement.classList.contains('dark-mode'),
    };
  };

  TutorialCode.prototype._isGraphDetached = function () {
    return !!(this._popoutManager && this._popoutManager.isDetached('graph'));
  };

  TutorialCode.prototype._popoutGraph = function () {
    if (!this._popoutManager || !this._popoutManager.isAvailable()) return;
    var meta = this._graphMeta();
    if (!meta) return;
    var win = this._popoutManager.detachGraph(meta);
    if (!win) {
      this._showPopupBlockedToast('Popup blocked — click to detach git graph',
        this._popoutGraph.bind(this));
      return;
    }
    // Trigger a fresh render so the popup gets the latest state, even if
    // nothing has changed since the last refresh.
    if (this._refreshGitGraph) this._refreshGitGraph();
  };

  TutorialCode.prototype._collectOutputControlsState = function () {
    if (!this.root) return {};
    var argsInput = this.root.querySelector('.tvm-args-input');
    var streamSel = this.root.querySelector('.tvm-stream-filter');
    var runBtn = this.root.querySelector('.tvm-run-btn');
    var stopBtn = this.root.querySelector('.tvm-stop-btn');
    return {
      argsVisible: !!(argsInput && argsInput.style.display !== 'none'),
      args: argsInput ? argsInput.value : '',
      streamFilterVisible: !!(streamSel && streamSel.style.display !== 'none'),
      streamFilter: streamSel ? streamSel.value : 'all',
      runDisabled: !!(runBtn && runBtn.disabled),
      stopVisible: !!(stopBtn && stopBtn.style.display !== 'none'),
    };
  };

  TutorialCode.prototype._outputMeta = function () {
    var pre = this.root && this.root.querySelector('.tvm-output-pre');
    var termContainer = this.root && this.root.querySelector('.tvm-terminal-container');
    var previewFrame = this.root && this.root.querySelector('.tvm-preview-frame');
    var kind, content;
    if (previewFrame) {
      // Live preview (react): main renders into iframe.srcdoc (not .src).
      // Broadcast the srcdoc string so the popup's iframe can mount the same
      // bundled HTML. Refreshes/edits in main re-fire the iframe's load
      // event, which re-broadcasts the latest srcdoc to the popup.
      kind = 'preview';
      content = previewFrame.srcdoc || previewFrame.src || '';
    } else if (pre) {
      kind = 'output';
      content = pre.innerHTML;
    } else if (termContainer && this.term && this.term.buffer) {
      kind = 'terminal';
      content = this._serializeTerminal();
    } else {
      return null;
    }
    return {
      kind: kind,
      content: content,
      darkMode: document.documentElement.classList.contains('dark-mode'),
    };
  };

  TutorialCode.prototype._serializeTerminal = function () {
    if (!this.term || !this.term.buffer || !this.term.buffer.active) return '';
    var buf = this.term.buffer.active;
    var lines = [];
    for (var i = 0; i < buf.length; i++) {
      var line = buf.getLine(i);
      if (line) lines.push(line.translateToString(true));
    }
    return lines.join('\n');
  };

  TutorialCode.prototype._installOutputObserver = function () {
    if (this._outputObserver || this._termRenderDispose || this._previewFrameSync) return;
    var self = this;
    var pre = this.root && this.root.querySelector('.tvm-output-pre');
    var previewFrame = this.root && this.root.querySelector('.tvm-preview-frame');
    if (previewFrame) {
      // Preview: re-broadcast the iframe srcdoc whenever it loads (build /
      // hot-patch / refresh).
      this._previewFrameSync = function () {
        if (self._popoutManager && self._popoutManager.isDetached('output')) {
          self._popoutManager.broadcastOutputUpdate({
            kind: 'preview',
            content: previewFrame.srcdoc || previewFrame.src || '',
          });
        }
      };
      previewFrame.addEventListener('load', this._previewFrameSync);
    }
    if (pre) {
      var debounced;
      this._outputObserver = new MutationObserver(function () {
        clearTimeout(debounced);
        debounced = setTimeout(function () {
          if (self._popoutManager && self._popoutManager.isDetached('output')) {
            self._popoutManager.broadcastOutputUpdate({
              kind: 'output',
              content: pre.innerHTML,
            });
            self._popoutManager.broadcastOutputControlsState(self._collectOutputControlsState());
          }
        }, 60);
      });
      this._outputObserver.observe(pre, { childList: true, characterData: true, subtree: true });
    }
    if (this.term && this.term.onRender) {
      // Terminal: re-serialize on every refresh tick (xterm fires onRender).
      var termDebounced;
      this._termRenderDispose = this.term.onRender(function () {
        clearTimeout(termDebounced);
        termDebounced = setTimeout(function () {
          if (self._popoutManager && self._popoutManager.isDetached('output')) {
            self._popoutManager.broadcastOutputUpdate({
              kind: 'terminal',
              content: self._serializeTerminal(),
            });
          }
        }, 60);
      });
    }
  };

  TutorialCode.prototype._uninstallOutputObserver = function () {
    if (this._outputObserver) {
      this._outputObserver.disconnect();
      this._outputObserver = null;
    }
    if (this._termRenderDispose && this._termRenderDispose.dispose) {
      try { this._termRenderDispose.dispose(); } catch (e) { /* ignore */ }
      this._termRenderDispose = null;
    }
    if (this._previewFrameSync) {
      var pf = this.root && this.root.querySelector('.tvm-preview-frame');
      if (pf) try { pf.removeEventListener('load', this._previewFrameSync); } catch (e) {/*ignore*/}
      this._previewFrameSync = null;
    }
  };

  TutorialCode.prototype._refreshOutputDetachedState = function () {
    var detached = this._popoutManager && this._popoutManager.isDetached('output');
    var panel = this.root && (
      this.root.querySelector('.tvm-output-panel')
      || this.root.querySelector('.tvm-terminal-panel')
      || this.root.querySelector('.tvm-preview-panel')
    );
    if (!panel) return;
    panel.classList.toggle('tvm-output-detached', !!detached);
    var workspace = this.root.querySelector('.tvm-workspace');
    if (workspace) workspace.classList.toggle('tvm-workspace-output-detached', !!detached);

    // Floating reattach chip — anchored to the workspace corner. Replaces
    // the in-panel indicator since the panel itself is now display: none.
    var chip = workspace && workspace.querySelector(':scope > .tvm-output-detached-chip');
    if (detached) {
      if (workspace && !chip) {
        chip = document.createElement('div');
        chip.className = 'tvm-output-detached-chip';
        var label = panel.classList.contains('tvm-preview-panel') ? 'Live preview'
          : panel.classList.contains('tvm-terminal-panel') ? 'Terminal'
          : 'Output';
        chip.innerHTML = '<span class="tvm-tab-detached-badge">' + label + ' detached</span>'
          + '<button class="tvm-tab-reattach" type="button" title="Bring it back to the main view">↩</button>';
        workspace.appendChild(chip);
        var self = this;
        chip.querySelector('.tvm-tab-reattach').addEventListener('click', function (e) {
          e.stopPropagation();
          self._popoutManager.requestPopupClose('output');
        });
      }
    } else if (chip) {
      chip.parentNode.removeChild(chip);
    }
  };

  TutorialCode.prototype._popoutInstructions = function () {
    if (!this._popoutManager || !this._popoutManager.isAvailable()) return;
    var win = this._popoutManager.detachInstructions();
    if (!win) {
      this._showPopupBlockedToast('Popup blocked — click to detach instructions',
        this._popoutInstructions.bind(this));
      return;
    }
    this._refreshInstructionsDetachedState();
  };

  TutorialCode.prototype._paneMeta = function (pane) {
    var self = this;
    var files = Object.keys(this.editorModels)
      .filter(function (f) { return self._paneForFile(f) === pane; })
      .map(function (f) {
        var entry = self.editorModels[f];
        return {
          filename: f,
          content: entry.model.getValue(),
          language: entry.model.getLanguageId
            ? entry.model.getLanguageId()
            : (entry.model._languageId || ''),
        };
      });
    if (!files.length) return null;
    var activeFile = pane === 'left' ? this._leftActiveFile : this._rightActiveFile;
    if (!activeFile || !files.find(function (f) { return f.filename === activeFile; })) {
      activeFile = files[0].filename;
    }
    return {
      pane: pane,
      files: files,
      activeFile: activeFile,
      darkMode: document.documentElement.classList.contains('dark-mode'),
    };
  };

  TutorialCode.prototype._fileMeta = function (filename) {
    var entry = this.editorModels[filename];
    if (!entry) return null;
    return {
      content: entry.model.getValue(),
      language: entry.model.getLanguageId ? entry.model.getLanguageId()
              : (entry.model._languageId || ''),
      darkMode: document.documentElement.classList.contains('dark-mode'),
    };
  };

  TutorialCode.prototype._buildRefactoringWorkspace = function (request) {
    request = request || {};
    var step = this.steps[this.currentStep] || {};
    var paths = [];
    if (step.files && step.files.length) {
      paths = step.files.map(function (f) { return f.path; });
    } else {
      paths = Object.keys(this.editorModels);
    }
    var seen = {};
    var files = [];
    for (var i = 0; i < paths.length; i++) {
      var filename = paths[i];
      if (!filename || seen[filename]) continue;
      seen[filename] = true;
      var entry = this.editorModels[filename];
      var spec = null;
      if (step.files) {
        for (var s = 0; s < step.files.length; s++) {
          if (step.files[s].path === filename) { spec = step.files[s]; break; }
        }
      }
      var content = entry ? entry.model.getValue() : ((spec && spec.content) || '');
      if (request.activeFile === filename && typeof request.activeContent === 'string') {
        content = request.activeContent;
      }
      var language = entry && entry.model.getLanguageId
        ? entry.model.getLanguageId()
        : ((spec && spec.language) || detectLanguage(filename));
      files.push({ filename: filename, content: content, language: language });
    }
    return {
      activeFile: request.activeFile || this.activeFileName || (files[0] && files[0].filename) || null,
      files: files,
      stepIndex: this.currentStep,
      tutorialId: this.tutorialId,
    };
  };

  TutorialCode.prototype._applyRefactoringEdits = function (edits, plan, request) {
    edits = edits || [];
    request = request || {};
    if (request.activeFile && typeof request.activeContent === 'string' && this.editorModels[request.activeFile]) {
      this._applyFileEditFromPopup(request.activeFile, request.activeContent);
    }
    var self = this;
    var byFile = {};
    edits.forEach(function (edit) {
      if (!edit || !edit.filename || !edit.range) return;
      if (!byFile[edit.filename]) byFile[edit.filename] = [];
      byFile[edit.filename].push(edit);
    });
    var changed = [];
    Object.keys(byFile).forEach(function (filename) {
      var entry = self.editorModels[filename];
      if (!entry || !entry.model) return;
      var model = entry.model;
      var ops = byFile[filename].map(function (edit) {
        return {
          range: new monaco.Range(
            edit.range.startLineNumber,
            edit.range.startColumn,
            edit.range.endLineNumber,
            edit.range.endColumn
          ),
          text: edit.text || '',
          forceMoveMarkers: true,
        };
      });
      model.pushEditOperations([], ops, function () { return null; });
      changed.push(filename);
    });
    var syncs = changed.map(function (filename) {
      return Promise.resolve(self._syncFileToBackend(filename));
    });
    if (this.autoSaveEnabled && changed.length) this._autoSaveProgress();
    if (this._popoutManager) {
      changed.forEach(function (filename) {
        if (self._popoutManager.isDetached('tab:' + filename)) {
          var meta = self._fileMeta(filename);
          if (meta) self._popoutManager._sendFileSnapshot(filename, meta);
        }
      });
      this._rebroadcastDetachedPanes();
    }
    if (this._umlDiagramEnabled && changed.some(function (f) { return self._umlWatchedFiles.indexOf(f) !== -1; })) {
      this._scheduleUMLRefresh(true);
    }
    return Promise.all(syncs).then(function () {
      return { changedFiles: changed };
    });
  };

  TutorialCode.prototype._pickPaneActive = function (pane) {
    var self = this;
    var candidates = Object.keys(this.editorModels).filter(function (f) {
      if (self._popoutManager && self._popoutManager.isDetached('tab:' + f)) return false;
      return self._paneForFile(f) === pane;
    });
    if (pane === 'left') {
      this._leftActiveFile = candidates[0] || null;
      if (this.editor && candidates[0]) this.editor.setModel(this.editorModels[candidates[0]].model);
      else if (this.editor) this.editor.setModel(monaco.editor.createModel(''));
    } else {
      this._rightActiveFile = candidates[0] || null;
      if (this.editor2 && candidates[0]) this.editor2.setModel(this.editorModels[candidates[0]].model);
      else if (this.editor2) this.editor2.setModel(monaco.editor.createModel(''));
    }
    this._renderTabs();
  };

  TutorialCode.prototype._showPopupBlockedToast = function (msg, retry) {
    if (this._popupBlockedToast) {
      try { document.body.removeChild(this._popupBlockedToast); } catch (e) { /* ignore */ }
      this._popupBlockedToast = null;
    }
    var toast = document.createElement('div');
    toast.className = 'tvm-popup-blocked-toast';
    toast.textContent = msg;
    toast.addEventListener('click', function () {
      try { document.body.removeChild(toast); } catch (e) { /* ignore */ }
      retry();
    });
    document.body.appendChild(toast);
    this._popupBlockedToast = toast;
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 8000);
  };

  TutorialCode.prototype._playwrightStepConfig = function (step) {
    var base = this.playwrightConfig || {};
    var local = (step && step.playwright && typeof step.playwright === 'object') ? step.playwright : {};
    var out = {};
    Object.keys(base).forEach(function (key) { out[key] = base[key]; });
    Object.keys(local).forEach(function (key) { out[key] = local[key]; });
    return out;
  };

  TutorialCode.prototype._globToRegExp = function (glob) {
    var s = String(glob || '').replace(/[.+^${}()|[\]\\]/g, '\\$&');
    s = s.replace(/\*\*/g, '\u0000');
    s = s.replace(/\*/g, '[^/]*');
    s = s.replace(/\u0000/g, '.*');
    return new RegExp('^' + s + '$');
  };

  TutorialCode.prototype._isPlaywrightTestFile = function (filename, step) {
    if (!this._playwrightMode || !filename) return false;
    var cfg = this._playwrightStepConfig(step);
    var patterns = cfg.test_files || cfg.testFiles || [];
    if (!Array.isArray(patterns)) patterns = [patterns];
    if (patterns.length > 0) {
      for (var i = 0; i < patterns.length; i++) {
        if (this._globToRegExp(patterns[i]).test(filename)) return true;
      }
      return false;
    }
    return /(?:^|\/)tests?\//i.test(filename) || /\.(spec|test)\.[jt]sx?$/i.test(filename);
  };

  TutorialCode.prototype._getPlaywrightTestFiles = function (step) {
    if (!this._playwrightMode) return [];
    var seen = {};
    var files = [];
    function add(name) {
      if (!name || seen[name]) return;
      seen[name] = true;
      files.push(name);
    }
    if (step && step.files) {
      for (var i = 0; i < step.files.length; i++) {
        if (this._isPlaywrightTestFile(step.files[i].path, step)) add(step.files[i].path);
      }
    }
    Object.keys(this.editorModels || {}).forEach(function (name) {
      if (this._isPlaywrightTestFile(name, step)) add(name);
    }, this);
    return files;
  };

  TutorialCode.prototype._stepHasTests = function (step) {
    return !!(step && step.tests && step.tests.length > 0);
  };

  TutorialCode.prototype._stepHasStudentPlaywrightTests = function (step) {
    return !!(this._playwrightMode && this._getPlaywrightTestFiles(step).length > 0);
  };

  TutorialCode.prototype._updatePreviewTestButton = function () {
    if (!this._previewTestBtn) return;
    var step = this.steps[this.currentStep];
    var hasStudentTests = this._stepHasStudentPlaywrightTests(step);
    this._previewTestBtn.style.display = hasStudentTests ? '' : 'none';
    this._previewTestBtn.disabled = !hasStudentTests;
  };

  TutorialCode.prototype._clearStudentTestPanel = function () {
    var panel = this.root && this.root.querySelector('.tvm-preview-test-panel');
    if (!panel) return;
    panel.style.display = 'none';
    panel.innerHTML = '';
  };

  TutorialCode.prototype._buildInstructionsSnapshot = function () {
    var self = this;
    return {
      currentStep: this.currentStep,
      darkMode: document.documentElement.classList.contains('dark-mode'),
      stepsUnlocked: Array.from(this._stepsUnlocked || []),
      hasTests: this._stepHasTests(this.steps[this.currentStep]),
      nextLocked: this._isNextStepLocked(),
      steps: this.steps.map(function (step) {
        return {
          title: step.title || '',
          instructionsHTML: self._stepInstructionsHTML(step),
        };
      }),
    };
  };

  TutorialCode.prototype._isNextStepLocked = function () {
    var idx = this.currentStep;
    var nextStepUnlocked = !this.requireTests || this.instructorMode || this._stepsUnlocked.has(idx + 1);
    return !nextStepUnlocked;
  };

  TutorialCode.prototype._broadcastStepState = function () {
    if (!this._popoutManager) return;
    var step = this.steps[this.currentStep];
    if (!step) return;
    var fileList = (step.files || []).map(function (f) { return f.path; });
    this._popoutManager.broadcastStepChange({
      stepIndex: this.currentStep,
      stepData: {
        title: step.title || '',
        instructionsHTML: this._stepInstructionsHTML(step),
      },
      stepsUnlocked: Array.from(this._stepsUnlocked || []),
      hasTests: this._stepHasTests(step),
      nextLocked: this._isNextStepLocked(),
      fileList: fileList,
    });
    // Detached pane popups need a fresh file list / contents whenever the
    // step changes — otherwise they show stale files from the previous step.
    this._rebroadcastDetachedPanes();
  };

  TutorialCode.prototype._rebroadcastDetachedPanes = function () {
    if (!this._popoutManager) return;
    var self = this;
    ['left', 'right'].forEach(function (p) {
      if (!self._isPaneDetached(p)) return;
      var meta = self._paneMeta(p);
      if (meta) self._popoutManager._sendPaneSnapshot(p, meta);
    });
  };

  TutorialCode.prototype._broadcastNavState = function () {
    if (!this._popoutManager) return;
    this._popoutManager.broadcastNavState({
      stepsUnlocked: Array.from(this._stepsUnlocked || []),
      nextLocked: this._isNextStepLocked(),
    });
  };

  TutorialCode.prototype._refreshInstructionsDetachedState = function () {
    var detached = this._popoutManager && this._popoutManager.isDetached('instructions');
    var panel = this.root && this.root.querySelector('.tvm-instructions-panel');
    if (!panel) return;
    // When a UML view is stacked below instructions, the panel's outer dimension
    // is still width but the steps-view shares that column with UML. Shrink the
    // steps-view height instead, so UML below expands. Otherwise shrink the
    // whole panel's width to a thin strip.
    var verticalShrink = !!(this._umlPositionBelow || this._umlPositionBottomLeft);
    // Debugger-mode: when the time-travel debugger is enabled, popping out the
    // instructions should NOT collapse the left panel — there's still useful
    // content to show there (Watch / Call Stack / Variables / History). Keep
    // the panel full-width and just hide the Steps view + auto-switch to the
    // Debug tab. A compact "instructions popped out" pill replaces the Steps
    // tab so the user can re-attach with one click.
    var debuggerMode = !!this.debuggerEnabled;
    if (detached) {
      if (!panel.querySelector('.tvm-instructions-detached-placeholder')) {
        var placeholder = document.createElement('div');
        placeholder.className = 'tvm-instructions-detached-placeholder';
        placeholder.innerHTML = '<button class="tvm-btn tvm-btn-reattach" title="Bring instructions back to this window">↩</button>'
          + '<div class="tvm-detached-msg">Instructions popped out</div>';
        // Insert before the steps-view so the placeholder stays visible while
        // steps-view is hidden by CSS in the detached state.
        var stepsView = panel.querySelector('.tvm-steps-view');
        if (stepsView) panel.insertBefore(placeholder, stepsView);
        else panel.appendChild(placeholder);
        var self = this;
        placeholder.querySelector('.tvm-btn-reattach').addEventListener('click', function () {
          self._popoutManager.requestPopupClose('instructions');
        });
      }
      panel.classList.add('tvm-instructions-detached');
      // In debugger mode, override the layout-shrink classes — keep full size
      // and just toggle which inner views are visible (handled by CSS keyed
      // on tvm-instructions-detached-debugger).
      panel.classList.toggle('tvm-instructions-detached-debugger', debuggerMode);
      panel.classList.toggle('tvm-instructions-detached-vertical', !debuggerMode && verticalShrink);
      panel.classList.toggle('tvm-instructions-detached-horizontal', !debuggerMode && !verticalShrink);
      // If the user was viewing Steps when they popped out, send them to the
      // Debug tab so they have something to look at.
      if (debuggerMode && this._debuggerCtl) {
        var activeTab = panel.querySelector('.tvm-left-tab.active');
        if (activeTab && activeTab.getAttribute('data-panel') === 'steps') {
          this._debuggerCtl.activateTab('dbg-combined');
        }
      }
    } else {
      panel.classList.remove('tvm-instructions-detached');
      panel.classList.remove('tvm-instructions-detached-debugger');
      panel.classList.remove('tvm-instructions-detached-vertical');
      panel.classList.remove('tvm-instructions-detached-horizontal');
      var ph = panel.querySelector('.tvm-instructions-detached-placeholder');
      if (ph) ph.parentNode.removeChild(ph);
    }
    // Re-fit Monaco / xterm after a size change
    if (this.editor && this.editor.layout) try { this.editor.layout(); } catch (e) { /* ignore */ }
    if (this.editor2 && this.editor2.layout) try { this.editor2.layout(); } catch (e) { /* ignore */ }
    if (this.fitAddon && this.fitAddon.fit) try { this.fitAddon.fit(); } catch (e) { /* ignore */ }
  };

  TutorialCode.prototype._applyFileEditFromPopup = function (filename, content, version) {
    var entry = this.editorModels[filename];
    if (!entry) return;
    if (entry.model.getValue() === content) return;
    // Apply normally so the model's onDidChangeContent fires — drives the
    // standard syncFileToBackend / autosave / React-patch chain (which then
    // re-broadcasts the rebuilt preview srcdoc to any preview popouts).
    entry.model.setValue(content);
    if (this.autoSaveEnabled) this._autoSaveProgress();
  };

  TutorialCode.prototype._handlePopupClosed = function (role, finalContent) {
    if (role && role.indexOf('pane:') === 0) {
      // Pane popup closed — finalContent is a {filename: content} map
      if (finalContent && typeof finalContent === 'object') {
        var self = this;
        Object.keys(finalContent).forEach(function (fn) {
          self._applyFileEditFromPopup(fn, finalContent[fn]);
        });
      }
      this._renderTabs();
      // Restore active files in the now-visible pane
      var pane = role.slice(5);
      if (pane === 'left') this._pickPaneActive('left');
      else if (pane === 'right') this._pickPaneActive('right');
      if (this.editor && this.editor.layout) try { this.editor.layout(); } catch (e) {/*ignore*/}
      if (this.editor2 && this.editor2.layout) try { this.editor2.layout(); } catch (e) {/*ignore*/}
      return;
    }
    if (role && role.indexOf('tab:') === 0) {
      var filename = role.slice(4);
      if (typeof finalContent === 'string') {
        this._applyFileEditFromPopup(filename, finalContent, null);
      }
      this._renderTabs();
      var entry = this.editorModels[filename];
      if (entry) {
        if (this._splitActive && this.editor2) {
          var pane = this._paneForFile(filename);
          if (pane === 'left' && !this._leftActiveFile) {
            this._leftActiveFile = filename;
            this.editor.setModel(entry.model);
          } else if (pane === 'right' && !this._rightActiveFile) {
            this._rightActiveFile = filename;
            this.editor2.setModel(entry.model);
          }
        } else if (!this.activeFileName) {
          this._setActiveFile(filename);
        }
      }
    } else if (role === 'instructions') {
      this._refreshInstructionsDetachedState();
    } else if (role === 'output') {
      this._uninstallOutputObserver();
      this._refreshOutputDetachedState();
    }
  };

  TutorialCode.prototype._wireInstructionsPopoutButton = function () {
    if (!this.root) return;
    var btn = this.root.querySelector('.tvm-instructions-popout-btn');
    if (!btn) return;
    var self = this;
    btn.addEventListener('click', function () { self._popoutInstructions(); });

    // Drag-out detach on the step-nav-bar (the strip above instructions)
    var bar = this.root.querySelector('.tvm-step-nav-bar');
    if (bar && !bar.draggable) {
      bar.draggable = true;
      bar.addEventListener('dragstart', function (e) {
        // Only initiate if drag started on the bar itself (not on a step button)
        if (e.target.closest('.tvm-step-btn')) { e.preventDefault(); return; }
        try { e.dataTransfer.setData('text/plain', 'instructions'); } catch (e2) { /* ignore */ }
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
        self._instrDragState = {
          startX: e.clientX, startY: e.clientY,
          winW: window.innerWidth, winH: window.innerHeight,
        };
      });
      bar.addEventListener('dragend', function (e) {
        var ds = self._instrDragState;
        self._instrDragState = null;
        if (!ds) return;
        var x = e.clientX, y = e.clientY;
        var outside = (x <= 0 || y <= 0 || x >= ds.winW || y >= ds.winH);
        if (outside) self._popoutInstructions();
      });
    }
  };

  TutorialCode.prototype._deriveTutorialTitle = function () {
    // Prefer the navbar's tutorial title (cleanest, no "| SE Book" suffix);
    // fall back to splitting <title> on the " | " separator.
    var navTitle = document.querySelector('.navbar-brand[style*="font-weight: 600"]');
    if (navTitle && navTitle.textContent.trim()) return navTitle.textContent.trim();
    var t = (document.title || '').split(' | ')[0];
    return t || '';
  };

  TutorialCode.prototype._initPopoutManager = function () {
    if (!window.TutorialPopoutManager || !window.BroadcastChannel) return;
    var self = this;
    this._popoutManager = new TutorialPopoutManager({
      tutorialId: this.tutorialId,
      pathname: window.location.pathname,
      tabPopupUrl: this.config.tabPopupUrl || '/tutorial-tab-popup.html',
      instructionsPopupUrl: this.config.instructionsPopupUrl || '/tutorial-instructions-popup.html',
      panePopupUrl: this.config.panePopupUrl || '/tutorial-pane-popup.html',
      outputPopupUrl: this.config.outputPopupUrl || '/tutorial-output-popup.html',
      graphPopupUrl: this.config.graphPopupUrl || '/tutorial-graph-popup.html',
      debuggerPopupUrl: this.config.debuggerPopupUrl || '/tutorial-debugger-popup.html',
      tutorialTitle: this.config.tutorialTitle || this._deriveTutorialTitle(),
      hooks: {
        onStepChangeRequest: function (idx) {
          if (typeof idx === 'number') self.loadStep(idx);
        },
        onPrevStepRequest: function () {
          if (self.currentStep > 0) self.loadStep(self.currentStep - 1);
        },
        onNextStepRequest: function () {
          // Mirror Next button behavior — only advance if not locked
          if (self._isNextStepLocked()) {
            // Tell popups Next was a no-op so they can re-sync (in case
            // their lock state was stale). The popup will pull the latest
            // nav-state and disable the button accordingly.
            self._broadcastNavState();
            return;
          }
          var step = self.steps[self.currentStep];
          var hasQuiz = !self.disableQuiz && step && step.quiz
            && step.quiz.questions && step.quiz.questions.length > 0;
          if (hasQuiz && !self._quizPassed.has(self.currentStep)) {
            // _showStepQuiz now broadcasts 'quiz-show' itself so any open
            // instructions popup mounts the same quiz and the user can
            // take it in either window.
            self._showStepQuiz(self.currentStep);
            return;
          }
          self._stepsUnlocked.add(self.currentStep + 1);
          if (self.autoSaveEnabled) self._autoSaveProgress();
          self.loadStep(self.currentStep + 1);
        },
        onRunTestsRequest: function () { self._runTests(); },
        onQuizPassedFromPopup: function (stepIndex) {
          if (typeof stepIndex === 'number') self._completeQuiz(stepIndex);
        },
        onSaveFileRequest: function (filename) {
          // Save the file the popup tells us about — temporarily make it the
          // active file so _saveCurrentFile triggers the right side effects
          // (sync, autosave, react patch, UML refresh).
          if (!filename || !self.editorModels[filename]) {
            console.warn('[popout] request-save for unknown file:', filename);
            return;
          }
          var prev = self.activeFileName;
          self.activeFileName = filename;
          try {
            self._saveCurrentFile();
          } finally {
            self.activeFileName = prev;
          }
          // Confirm back to popups so they can flash a "Saved ✓" indicator.
          self._popoutManager._post('save-confirmed', { filename: filename });
        },
        onFileEditFromPopup: function (filename, content) {
          self._applyFileEditFromPopup(filename, content);
        },
        onPopupOpened: function (role) {
          if (role === 'instructions') self._refreshInstructionsDetachedState();
          else self._renderTabs();
        },
        onPopupClosed: function (role, finalContent) {
          self._handlePopupClosed(role, finalContent);
        },
        getFileMeta: function (filename) { return self._fileMeta(filename); },
        getInstructionsSnapshot: function () { return self._buildInstructionsSnapshot(); },
        getPaneMeta: function (pane) { return self._paneMeta(pane); },
        getOutputMeta: function () {
          var m = self._outputMeta();
          if (m) m.controls = self._collectOutputControlsState();
          return m;
        },
        getGraphMeta: function () { return self._graphMeta(); },
        onRunOutputRequest: function (args) {
          if (typeof args === 'string') {
            var argsInput = self.root && self.root.querySelector('.tvm-args-input');
            if (argsInput) argsInput.value = args;
          }
          if (typeof self._runCurrentFile === 'function') self._runCurrentFile();
          else {
            // Fallback: click the in-DOM Run button
            var runBtn = self.root && self.root.querySelector('.tvm-run-btn');
            if (runBtn) runBtn.click();
          }
        },
        onStopOutputRequest: function () {
          var stopBtn = self.root && self.root.querySelector('.tvm-stop-btn');
          if (stopBtn) stopBtn.click();
        },
        onClearOutputRequest: function () {
          var clearBtn = self.root && self.root.querySelector('.tvm-clear-btn');
          if (clearBtn) clearBtn.click();
          else {
            var pre = self.root && self.root.querySelector('.tvm-output-pre');
            if (pre) pre.innerHTML = '';
          }
        },
        onRefreshOutputRequest: function () {
          var rb = self.root && self.root.querySelector('.tvm-refresh-btn');
          if (rb) rb.click();
        },
        onArgsChange: function (args) {
          var argsInput = self.root && self.root.querySelector('.tvm-args-input');
          if (argsInput) argsInput.value = args;
        },
        onStreamFilterChange: function (filter) {
          var sel = self.root && self.root.querySelector('.tvm-stream-filter');
          if (sel) { sel.value = filter; sel.dispatchEvent(new Event('change', { bubbles: true })); }
        },
        getRefactorWorkspace: function (request) {
          return self._buildRefactoringWorkspace(request || {});
        },
        onApplyRefactorEdits: function (edits, meta, request) {
          return self._applyRefactoringEdits(edits, meta, request || {});
        },
      },
    });
    this._popoutManager.init();

    // Mirror dark-mode changes to popups by watching the html class attribute
    if (window.MutationObserver) {
      var lastDark = document.documentElement.classList.contains('dark-mode');
      var mo = new MutationObserver(function () {
        var d = document.documentElement.classList.contains('dark-mode');
        if (d !== lastDark) {
          lastDark = d;
          self._popoutManager.broadcastDarkMode(d);
        }
      });
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    }
  };

  // ---------------------------------------------------------------------------
  // UML Diagram Methods
  // ---------------------------------------------------------------------------

  /** Show UML diagram — switches left tab (default) or right tab (uml_position: right) */
  TutorialCode.prototype._showDiagramHideEditor = function () {
    // Below / bottom-left mode: diagram is always visible — nothing to toggle
    if (this._umlPositionBelow || this._umlPositionBottomLeft) return;
    if (this._umlPositionRight) {
      // Right mode: switch bottom-right tab to UML; steps panel stays visible
      var outputView = this.root.querySelector('.tvm-output-view');
      var umlRightView = this.root.querySelector('.tvm-uml-right-view');
      if (outputView) outputView.style.display = 'none';
      if (umlRightView) umlRightView.style.display = 'flex';
      if (this._umlContainer) this._umlContainer.style.display = 'flex';
      var rightTabBar = this.root.querySelector('.tvm-right-tab-bar');
      if (rightTabBar) {
        var rtabs = rightTabBar.querySelectorAll('.tvm-right-tab');
        for (var ri = 0; ri < rtabs.length; ri++) {
          rtabs[ri].classList.toggle('active', rtabs[ri].getAttribute('data-panel') === 'uml');
        }
      }
      return;
    }
    if (this._stepsViewEl) this._stepsViewEl.style.display = 'none';
    if (this._umlContainer) this._umlContainer.style.display = 'flex';
    // Sync left tab buttons
    if (this._leftTabBarEl) {
      var tabs = this._leftTabBarEl.querySelectorAll('.tvm-left-tab');
      for (var i = 0; i < tabs.length; i++) {
        tabs[i].classList.toggle('active', tabs[i].getAttribute('data-panel') === 'uml');
      }
    }
  };

  /** Show steps — switches left tab (default) or right tab to Output (uml_position: right) */
  TutorialCode.prototype._showEditorHideDiagram = function () {
    if (this._umlPositionRight) {
      // Right mode: switch bottom-right tab to Output; steps panel stays visible
      var outputView = this.root.querySelector('.tvm-output-view');
      var umlRightView = this.root.querySelector('.tvm-uml-right-view');
      if (umlRightView) umlRightView.style.display = 'none';
      if (outputView) outputView.style.display = 'flex';
      if (this._umlContainer) this._umlContainer.style.display = 'none';
      var rightTabBar = this.root.querySelector('.tvm-right-tab-bar');
      if (rightTabBar) {
        var rtabs = rightTabBar.querySelectorAll('.tvm-right-tab');
        for (var ri = 0; ri < rtabs.length; ri++) {
          rtabs[ri].classList.toggle('active', rtabs[ri].getAttribute('data-panel') === 'output');
        }
      }
      return;
    }
    if (this._umlContainer) this._umlContainer.style.display = 'none';
    if (this._stepsViewEl) this._stepsViewEl.style.display = 'flex';
    // Sync left tab buttons
    if (this._leftTabBarEl) {
      var tabs = this._leftTabBarEl.querySelectorAll('.tvm-left-tab');
      for (var i = 0; i < tabs.length; i++) {
        tabs[i].classList.toggle('active', tabs[i].getAttribute('data-panel') === 'steps');
      }
    }
  };

  // ---------------------------------------------------------------------------
  // UML worker service — moves both UML analysis AND SVG rendering off the
  // main thread. Two independent coalescing pipelines (analyze + render)
  // share one Worker instance.
  //
  // Coalescing single-flight pipeline (per kind):
  //   - At most one in-flight + at most one queued. Newest wins.
  //   - Older queued requests are rejected with `umlSuperseded` so callers
  //     can no-op rather than treat as failure.
  //   - Identical-payload requests dedupe against in-flight or queued.
  //   - Single-slot content-hash cache short-circuits identical re-runs.
  // Keeps the worker queue from growing during a Ctrl+S spam-burst.
  // ---------------------------------------------------------------------------
  function umlWorkerUrl() {
    if (SCRIPT_URL && typeof URL === 'function') {
      try { return new URL('uml-worker.js', SCRIPT_URL).href; } catch (e) { /* fall through */ }
    }
    return '/js/uml-worker.js';
  }

  function umlHashString(str) {
    var h = 0;
    if (!str) return 0;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h |= 0;
    }
    return h;
  }

  function umlSupersededError() {
    var e = new Error('superseded');
    e.umlSuperseded = true;
    return e;
  }
  function isUMLSuperseded(err) { return !!(err && err.umlSuperseded); }

  var UMLWorkerService = (function () {
    var worker = null;
    var supported = (typeof Worker !== 'undefined');
    var nextId = 1;

    var inflight = { analyze: null, render: null };
    var queued = { analyze: null, render: null };
    var cacheKey = { analyze: '', render: '' };
    var cacheValue = { analyze: null, render: null };
    var REPLY_KIND = { analysis: 'analyze', renderResult: 'render' };
    var SEND_TYPE = { analyze: 'analyze', render: 'renderDiagram' };
    var RESULT_FIELD = { analyze: 'result', render: 'svg' };

    function ensureWorker() {
      if (worker || !supported) return worker;
      try {
        worker = new Worker(umlWorkerUrl());
      } catch (e) {
        supported = false;
        return null;
      }
      worker.onmessage = function (event) {
        var msg = event.data || {};
        var kind = REPLY_KIND[msg.type];
        if (!kind) return;
        var slot = inflight[kind];
        if (!slot || slot.id !== msg.id) return;
        inflight[kind] = null;
        clearTimeout(slot.timer);
        if (msg.ok) {
          cacheKey[kind] = slot.key;
          cacheValue[kind] = msg[RESULT_FIELD[kind]];
          slot.resolve(msg[RESULT_FIELD[kind]]);
        } else {
          slot.reject(new Error(msg.error || 'UML ' + kind + ' failed.'));
        }
        drainQueue(kind);
      };
      worker.onerror = function (event) {
        var err = new Error(event.message || 'UML worker failed.');
        ['analyze', 'render'].forEach(function (kind) {
          if (inflight[kind]) {
            clearTimeout(inflight[kind].timer);
            inflight[kind].reject(err);
            inflight[kind] = null;
          }
          if (queued[kind]) { queued[kind].reject(err); queued[kind] = null; }
        });
      };
      return worker;
    }

    function dispatch(kind, req) {
      var w = ensureWorker();
      if (!w) { req.reject(new Error('UML worker not available')); return; }
      if (cacheValue[kind] && req.key === cacheKey[kind]) {
        req.resolve(cacheValue[kind]);
        return;
      }
      var id = nextId++;
      inflight[kind] = {
        id: id, key: req.key,
        resolve: req.resolve, reject: req.reject,
        timer: setTimeout(function () {
          if (!inflight[kind] || inflight[kind].id !== id) return;
          var slot = inflight[kind];
          inflight[kind] = null;
          slot.reject(new Error('UML ' + kind + ' timed out.'));
          drainQueue(kind);
        }, 60000),
      };
      var msg = { type: SEND_TYPE[kind], id: id };
      Object.keys(req.payload).forEach(function (k) { msg[k] = req.payload[k]; });
      w.postMessage(msg);
    }

    function drainQueue(kind) {
      if (inflight[kind] || !queued[kind]) return;
      var next = queued[kind];
      queued[kind] = null;
      dispatch(kind, next);
    }

    function submit(kind, key, payload) {
      if (!supported) return Promise.reject(new Error('UML worker not available'));

      if (cacheValue[kind] && key === cacheKey[kind]) {
        return Promise.resolve(cacheValue[kind]);
      }

      var dup = inflight[kind] && inflight[kind].key === key ? inflight[kind] : null;
      if (!dup && queued[kind] && queued[kind].key === key) dup = queued[kind];
      if (dup) {
        return new Promise(function (resolve, reject) {
          var oR = dup.resolve, oJ = dup.reject;
          dup.resolve = function (v) { oR(v); resolve(v); };
          dup.reject  = function (e) { oJ(e); reject(e); };
        });
      }

      return new Promise(function (resolve, reject) {
        var req = { key: key, payload: payload, resolve: resolve, reject: reject };
        if (inflight[kind]) {
          if (queued[kind]) queued[kind].reject(umlSupersededError());
          queued[kind] = req;
        } else {
          dispatch(kind, req);
        }
      });
    }

    function analyzeKey(lang, sources, options) {
      var parts = [lang];
      Object.keys(sources).sort().forEach(function (fn) {
        var s = sources[fn] || '';
        parts.push(fn + ':' + s.length + ':' + umlHashString(s));
      });
      if (options) parts.push(JSON.stringify(options));
      return parts.join('|');
    }

    function renderKey(diagramType, syntax, cssVars, container) {
      // measurements derive from syntax + page font, so they don't need to be
      // in the cache key — the syntax hash already covers them.
      return diagramType + '|' + (syntax || '').length + '|' + umlHashString(syntax || '') +
        '|' + JSON.stringify(cssVars || {}) + '|' + JSON.stringify(container || {});
    }

    function analyze(lang, sources, options) {
      return submit('analyze', analyzeKey(lang, sources, options),
        { lang: lang, sources: sources, options: options });
    }

    function render(diagramType, syntax, cssVars, container, measurements) {
      return submit('render', renderKey(diagramType, syntax, cssVars, container),
        { diagramType: diagramType, syntax: syntax, cssVars: cssVars,
          container: container, measurements: measurements });
    }

    return {
      analyze: analyze,
      render: render,
      supported: function () { return supported; },
    };
  })();
  // Backwards alias for the analysis-side caller.
  var UMLAnalysisService = UMLWorkerService;

  /** Lazily load the JS-based Python UML analyzer (fast, no Pyodide needed) */
  TutorialCode.prototype._loadPythonJSAnalyzer = function (callback) {
    if (typeof window !== 'undefined' && window.analyzePythonSources) { callback(); return; }
    var self = this;
    var path = this.config.pythonJSAnalyzerPath || '/js/uml-analyzer-python.js';
    var script = document.createElement('script');
    script.src = path;
    script.onload = callback;
    script.onerror = function () {
      console.error('Failed to load Python JS analyzer:', path);
      self._showUMLError('Failed to load Python UML analyzer script.');
    };
    document.head.appendChild(script);
  };

  /** Lazily load the TypeScript compiler (for JS/TS UML analysis) */
  TutorialCode.prototype._loadTypeScriptCompiler = function (callback) {
    if (typeof window !== 'undefined' && window.ts) { callback(); return; }
    var script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/typescript@5/lib/typescript.min.js';
    script.onload = callback;
    script.onerror = function () {
      console.error('Failed to load TypeScript compiler from CDN');
    };
    document.head.appendChild(script);
  };

  /** Lazily load the JS/TS UML analyzer */
  TutorialCode.prototype._loadJSAnalyzer = function (callback) {
    if (typeof window !== 'undefined' && window.analyzeJSSources) { callback(); return; }
    var self = this;
    var path = this.config.jsAnalyzerPath || '/js/uml-analyzer-js.js';
    var script = document.createElement('script');
    script.src = path;
    script.onload = callback;
    script.onerror = function () {
      console.error('Failed to load JS UML analyzer:', path);
      self._showUMLError('Failed to load JS/TS UML analyzer script.');
    };
    document.head.appendChild(script);
  };

  /** Detect whether watched files are JS/TS, Java, or Python */
  TutorialCode.prototype._detectUMLLanguage = function () {
    var jsExts = /\.(js|jsx|ts|tsx)$/;
    var javaExts = /\.java$/;
    var hasJS = this._umlWatchedFiles.some(function (f) { return jsExts.test(f); });
    var hasJava = this._umlWatchedFiles.some(function (f) { return javaExts.test(f); });
    this._umlLanguage = hasJS ? 'js' : hasJava ? 'java' : 'python';
    return this._umlLanguage;
  };

  /**
   * Collect watched file sources, send to appropriate analyzer, parse result.
   * Only analyzes files listed in _umlWatchedFiles for the current step.
   */
  TutorialCode.prototype._refreshUMLDiagram = function () {
    if (!this._umlDiagramEnabled) return;
    // Skip while files are being loaded/restored — _applySavedFiles resets this flag
    // and calls _scheduleUMLRefresh(true) itself once all files are in place.
    if (this._suppressAutoSave) return;
    var self = this;
    var lang = this._detectUMLLanguage();

    // Collect sources from watched files
    var sources = {};
    var pending = this._umlWatchedFiles.length;
    if (pending === 0) {
      this._showUMLEmpty('No source files to analyze for this step.');
      return;
    }

    function onSourcesReady() {
      self._runUMLAnalysis(lang, sources);
    }

    // Read each watched file's current editor content (or from backend)
    this._umlWatchedFiles.forEach(function (filename) {
      var entry = self.editorModels[filename];
      if (entry) {
        sources[filename] = entry.model.getValue();
        pending--;
        if (pending === 0) onSourcesReady();
      } else if ((lang === 'python' || lang === 'java') && self._worker) {
        // Python/Java files: fallback to worker FS
        self._postWorker({ type: 'read', path: '/tutorial/' + filename }, function (msg) {
          if (msg.type === 'read_ok') {
            sources[filename] = msg.content;
          }
          pending--;
          if (pending === 0) onSourcesReady();
        });
      } else {
        // JS/TS file not in editor — skip it
        pending--;
        if (pending === 0) onSourcesReady();
      }
    });
  };

  /**
   * Run the appropriate UML analyzer for `lang` against `sources`.
   *
   * Off-thread by default via UMLAnalysisService (Web Worker). Falls back to
   * the on-main-thread analyzer if the worker can't be constructed (e.g.,
   * file:// page, CSP, ancient browser).
   *
   * Robustness against rapid edits / fast saves:
   *   - Per-instance `_umlAnalysisRequestId` supersedes earlier requests; if a
   *     newer call has been issued (or the step changed), the result is dropped.
   *   - Re-checks supersession inside the rAF callback in case a newer request
   *     started between the worker resolving and the next frame.
   *   - The service-level coalescing pipeline keeps the worker queue from
   *     piling up: at most one analysis in flight + at most one queued.
   */
  TutorialCode.prototype._runUMLAnalysis = function (lang, sources) {
    var self = this;
    var options = (lang === 'python') ? {
      hideVisibility: this._umlHideFlags.indexOf('visibility') !== -1,
      hideMultiplicity: this._umlHideFlags.indexOf('multiplicity') !== -1
    } : null;

    var reqId = ++this._umlAnalysisRequestId;
    function isCurrent() { return reqId === self._umlAnalysisRequestId; }

    function onResult(result) {
      if (!isCurrent()) return;
      self._umlLastDiagrams = result;
      if (result.errors && result.errors.length > 0) {
        console.warn(lang + ' UML analysis warnings:', result.errors);
      }
      // One-frame fence: let the editor paint the keystroke that triggered us
      // before the (DOM-bound, ~50–300 ms) renderer takes the main thread.
      requestAnimationFrame(function () {
        if (!isCurrent()) return;
        self._renderCurrentUMLDiagram();
      });
    }
    function onError(err) {
      if (!isCurrent()) return;
      console.error(lang + ' UML analysis error:', err);
      self._showUMLError((lang.charAt(0).toUpperCase() + lang.slice(1)) +
        ' analysis failed: ' + (err && err.message ? err.message : err));
    }

    if (UMLAnalysisService.supported()) {
      UMLAnalysisService.analyze(lang, sources, options).then(onResult, function (err) {
        if (isUMLSuperseded(err)) return;       // a newer request will handle it
        if (!isCurrent()) return;               // step changed mid-flight
        // True worker failure → fall back to main-thread analyzer so the UML
        // view still works (matches today's behaviour for users without workers).
        self._runUMLAnalysisFallback(lang, sources, options, reqId, onResult, onError);
      });
    } else {
      this._runUMLAnalysisFallback(lang, sources, options, reqId, onResult, onError);
    }
  };

  /** Fallback path: run the analyzer on the main thread (legacy behaviour). */
  TutorialCode.prototype._runUMLAnalysisFallback = function (lang, sources, options, reqId, onResult, onError) {
    var self = this;
    function isCurrent() { return reqId === self._umlAnalysisRequestId; }
    try {
      if (lang === 'python') {
        this._loadPythonJSAnalyzer(function () {
          if (!isCurrent()) return;
          try { onResult(window.analyzePythonSources(sources, options || {})); }
          catch (e) { onError(e); }
        });
      } else if (lang === 'java') {
        this._loadJavaAnalyzer(function () {
          if (!isCurrent()) return;
          try { onResult(window.analyzeJavaSources(sources)); }
          catch (e) { onError(e); }
        });
      } else {
        this._loadTypeScriptCompiler(function () {
          self._loadJSAnalyzer(function () {
            if (!isCurrent()) return;
            try { onResult(window.analyzeJSSources(sources, window.ts)); }
            catch (e) { onError(e); }
          });
        });
      }
    } catch (e) { onError(e); }
  };

  /** Lazily load the Java UML analyzer */
  TutorialCode.prototype._loadJavaAnalyzer = function (callback) {
    if (typeof window !== 'undefined' && window.analyzeJavaSources) { callback(); return; }
    var self = this;
    var path = this.config.javaAnalyzerPath || '/js/uml-analyzer-java.js';
    var script = document.createElement('script');
    script.src = path;
    script.onload = callback;
    script.onerror = function () {
      console.error('Failed to load Java UML analyzer:', path);
      self._showUMLError('Failed to load Java UML analyzer script.');
    };
    document.head.appendChild(script);
  };

  /** Render whichever diagram type is currently selected */
  TutorialCode.prototype._renderCurrentUMLDiagram = function () {
    if (!this._umlLastDiagrams) {
      this._showUMLEmpty('Click Refresh or edit a source file to generate diagrams.');
      return;
    }

    if (this._umlActiveType === 'sequence') {
      var seqSyntax = this._umlLastDiagrams.sequenceDiagram;
      if (!seqSyntax) {
        this._showUMLEmpty('No method calls detected between classes.');
        return;
      }
      if (window.UMLSequenceDiagram) {
        this._renderSequenceDiagramSVG(seqSyntax);
      } else {
        this._renderMermaidDiagram(seqSyntax);
      }
    } else {
      var classSyntax = this._umlLastDiagrams.classDiagram;
      if (!classSyntax) {
        this._showUMLEmpty('No classes found in the watched files.');
        return;
      }
      this._renderClassDiagramSVG(classSyntax);
    }
    this._broadcastUMLState();
  };

  TutorialCode.prototype._applyTutorialClassLayout = function (syntax) {
    var layoutPreference = this._umlClassLayoutPreference;
    if (!layoutPreference || !syntax) return syntax;

    var normalized = String(syntax).replace(/\r\n?/g, '\n');
    var lines = normalized.split('\n');
    var filtered = [];
    for (var i = 0; i < lines.length; i++) {
      if (/^\s*layout\s+.+$/i.test(lines[i].trim())) continue;
      filtered.push(lines[i]);
    }

    var insertAt = 0;
    while (insertAt < filtered.length && !filtered[insertAt].trim()) insertAt++;
    if (insertAt < filtered.length && filtered[insertAt].trim() === '@startuml') insertAt++;
    filtered.splice(insertAt, 0, 'layout ' + layoutPreference);
    return filtered.join('\n');
  };

  /** Render class diagram using the custom SVG renderer */
  // CSS variables the ArchUML renderer reads from the container. We pre-resolve
  // them on the main thread so the worker can answer getComputedStyle without
  // any real DOM. Keep in sync with getThemeColors in uml-bundle.js.
  var UML_CSS_VARS = [
    '--uml-bg', '--uml-stroke', '--uml-text', '--uml-fill', '--uml-header-fill',
    '--uml-line', '--uml-secondary-line', '--uml-secondary-fill',
    '--uml-label-fill', '--uml-label-stroke',
  ];

  TutorialCode.prototype._snapshotUMLContainer = function (el) {
    var cs = window.getComputedStyle(el);
    var rect = el.getBoundingClientRect ? el.getBoundingClientRect() : { width: 0, height: 0 };
    var cssVars = {};
    for (var i = 0; i < UML_CSS_VARS.length; i++) {
      cssVars[UML_CSS_VARS[i]] = (cs.getPropertyValue(UML_CSS_VARS[i]) || '').trim();
    }
    return {
      cssVars: cssVars,
      container: {
        width: rect.width || el.clientWidth || 800,
        height: rect.height || el.clientHeight || 600,
        clientWidth: el.clientWidth || rect.width || 800,
      },
    };
  };

  /**
   * Pre-measure all strings the bundle would measure for this diagram, using
   * an actual SVG `<text>` node + `getComputedTextLength`. This matches what
   * the browser will render the diagram's text at — Canvas `measureText` can
   * disagree with the SVG text engine by a few percent, which is enough to
   * make long method signatures spill out of their box (the bundle sizes the
   * box from Canvas measurement but the SVG renders slightly wider).
   *
   * The worker uses these measurements instead of its OffscreenCanvas, so
   * box widths are computed against true rendered widths — fixes both the
   * Firefox `system-ui` fallback divergence AND the Canvas-vs-SVG width
   * discrepancy that causes text overflow on long method signatures.
   *
   * Walks the parsed AST manually and records the same textWidth calls the
   * bundle would make. Doesn't run layout — just measurement — so the cost is
   * O(strings), not O(n²) for the layout algorithm.
   */
  TutorialCode.prototype._preMeasureForWorker = function (diagramType, syntax) {
    if (!window.UMLShared) return null;
    var Renderer = (diagramType === 'sequence') ? window.UMLSequenceDiagram : window.UMLClassDiagram;
    if (!Renderer || typeof Renderer.parse !== 'function') return null;

    var BASE = UMLShared.BASE_CFG || {};
    // The bundle's class-diagram CFG sets fontSizeStereotype = fontSize - 1
    // (default 14 → stereotype 13). The convention isn't exposed via BASE_CFG,
    // so we derive it the same way the bundle does internally.
    var sizeBody = BASE.fontSize;
    var sizeBold = BASE.fontSizeBold;
    var sizeStereotype = (BASE.fontSize != null) ? (BASE.fontSize - 1) : null;
    var ff = BASE.fontFamily;

    // Reuse a single hidden SVG host across calls so we don't pay DOM-creation
    // cost per measurement.
    //
    // CRITICAL: font-family must live on the host SVG via the `style` attribute
    // (CSS inheritance), NOT as a `font-family` SVG attribute on the text
    // element. The two paths produce different metrics in Chromium — the SVG
    // attribute path returns Canvas-like widths, while the CSS path matches
    // what the browser actually paints. The bundle emits font-family as a CSS
    // style on the root SVG, so we mirror that to match the rendered widths.
    if (!this._umlMeasureHost || this._umlMeasureHostFont !== ff) {
      if (this._umlMeasureHost && this._umlMeasureHost.parentNode) {
        this._umlMeasureHost.parentNode.removeChild(this._umlMeasureHost);
      }
      var svgNS = 'http://www.w3.org/2000/svg';
      var host = document.createElementNS(svgNS, 'svg');
      host.setAttribute('style', 'font-family: ' + (ff || '') + ';');
      host.setAttribute('aria-hidden', 'true');
      host.setAttribute('focusable', 'false');
      host.style.position = 'absolute';
      host.style.left = '-9999px';
      host.style.top = '-9999px';
      host.style.opacity = '0';
      var textNode = document.createElementNS(svgNS, 'text');
      host.appendChild(textNode);
      document.body.appendChild(host);
      this._umlMeasureHost = host;
      this._umlMeasureTextNode = textNode;
      this._umlMeasureHostFont = ff;
    }
    var measureNode = this._umlMeasureTextNode;

    var measurements = {};
    function measureOne(text, bold, fontSize) {
      if (text == null || text === '' || fontSize == null) return;
      var key = (bold ? 'B' : 'R') + '|' + fontSize + '|' + (ff || '') + '|' + text;
      if (measurements[key] !== undefined) return;
      measureNode.setAttribute('font-size', String(fontSize));
      // Match the bundle's emission: only set font-weight when bold, omit
      // otherwise. Setting font-weight="normal" as an attribute changes
      // Chromium's metrics for SVG text by ~3% vs. omitting it entirely.
      if (bold) measureNode.setAttribute('font-weight', 'bold');
      else measureNode.removeAttribute('font-weight');
      measureNode.textContent = text;
      // Use the maximum of SVG `getComputedTextLength` and Canvas `measureText`.
      // The two engines disagree by a few percent and the disagreement flips
      // direction across browsers (Chromium: SVG > Canvas; Gecko: sometimes
      // Canvas > SVG). Taking the max guarantees the box is sized for the
      // wider of the two, which is at least as wide as whatever the browser
      // actually paints — so the rendered text never spills outside the box.
      var svgW = measureNode.getComputedTextLength();
      var canvasW = UMLShared.textWidth(text, bold, fontSize, ff);
      measurements[key] = Math.max(svgW, canvasW);
    }

    function measure(text, bold, fontSize) {
      measureOne(text, bold, fontSize);
      // The class renderer increases typography slightly for dense diagrams.
      // Pre-measure the possible bumped sizes too so worker layout still uses
      // the same rendered SVG metrics as the main thread.
      if (diagramType === 'class' && fontSize != null) {
        // withAdaptiveClassTypography can bump compact diagrams by up to 4px.
        // Cache every possible bumped size so worker layout never falls back
        // to OffscreenCanvas metrics for the final rendered typography.
        for (var bump = 1; bump <= 4; bump++) {
          measureOne(text, bold, fontSize + bump);
        }
      }
    }

    var parsed;
    try { parsed = Renderer.parse(syntax); } catch (_) { return null; }
    if (!parsed) return null;

    // Class boxes (mirrors measureBox in uml-bundle.js)
    var classes = parsed.classes || [];
    for (var ci = 0; ci < classes.length; ci++) {
      var cls = classes[ci];
      measure(cls.name, true, sizeBold);

      // Stereotype text — matches the synthesis in the bundle's measureBox
      var stereo = '';
      if (cls.stereotype) stereo = '«' + cls.stereotype + '»';
      else if (cls.type === 'abstract') stereo = '«abstract»';
      else if (cls.type === 'interface') stereo = '«interface»';
      else if (cls.type === 'enum') stereo = '«enumeration»';
      if (stereo) measure(stereo, false, sizeStereotype);

      var attrs = cls.attributes || [];
      for (var ai = 0; ai < attrs.length; ai++) measure(attrs[ai].text, false, sizeBody);
      var meths = cls.methods || [];
      for (var mi = 0; mi < meths.length; mi++) measure(meths[mi].text, false, sizeBody);
    }

    // Relationship labels and multiplicities (use stereotype size in the bundle)
    var rels = parsed.relationships || [];
    for (var ri = 0; ri < rels.length; ri++) {
      var rel = rels[ri];
      if (rel.label) measure(rel.label, false, sizeStereotype);
      if (rel.fromMult) measure(rel.fromMult, false, sizeStereotype);
      if (rel.toMult) measure(rel.toMult, false, sizeStereotype);
    }

    return measurements;
  };

  /** Render class diagram via the worker (DOM-shimmed bundle). */
  TutorialCode.prototype._renderClassDiagramSVG = function (syntax) {
    if (!this._umlContentEl) {
      this._showUMLError('UML renderer not loaded.');
      return;
    }
    this._renderUMLViaWorker('class', this._applyTutorialClassLayout(syntax));
  };

  /** Render sequence diagram via the worker. */
  TutorialCode.prototype._renderSequenceDiagramSVG = function (syntax) {
    if (!this._umlContentEl) {
      this._showUMLError('UML sequence renderer not loaded.');
      return;
    }
    this._renderUMLViaWorker('sequence', syntax);
  };

  /**
   * Off-thread render. Critical detail: the snapshot is taken AFTER clearing
   * the container, so the worker sees the same empty-container geometry the
   * main-thread renderer used to see. Otherwise the previous SVG inflates the
   * container's height and the layout algorithm flips direction (LR vs TB).
   */
  TutorialCode.prototype._renderUMLViaWorker = function (diagramType, syntax) {
    var self = this;
    var el = this._umlContentEl;
    var reqId = ++this._umlRenderRequestId;
    function isCurrent() { return reqId === self._umlRenderRequestId; }

    el.innerHTML = '';                       // clear FIRST so snapshot is right
    this._applyUMLColors(el);
    // The bundle's prepareDiagramContainer (which the main-thread render path
    // calls) sets `display: block !important` on the container. Without it,
    // the surrounding flex layout shrinks the SVG to fit and zoom (which sets
    // svg.style.width to a pixel value) has no visible effect. Mirror it here.
    if (window.UMLShared && typeof UMLShared.prepareDiagramContainer === 'function') {
      try { UMLShared.prepareDiagramContainer(el, diagramType); } catch (_) {}
    }

    function applySVG(svgStr) {
      el.innerHTML = svgStr;
      // autoFitSVG re-fits the rendered SVG using getBBox on the LIVE DOM —
      // matters because the worker measured text on OffscreenCanvas, whose
      // glyph metrics can differ subtly from the live document's font fallback
      // (tested identical for our font, but autoFitSVG is what the bundle's
      // own renderFromData calls and is the canonical reconciliation step).
      if (window.UMLShared && typeof UMLShared.autoFitSVG === 'function') {
        try { UMLShared.autoFitSVG(el); } catch (_) {}
      }
      if (window.UMLShared && typeof UMLShared.applySvgAccessibility === 'function') {
        try { UMLShared.applySvgAccessibility(el, diagramType, syntax); } catch (_) {}
      }
      var zoomLabel = self._umlContainer ? self._umlContainer.querySelector('.tvm-diagram-zoom-label') : null;
      self._applyUMLZoom(el, self._umlZoom, zoomLabel);
    }

    function fallbackMainThread() {
      try {
        var R = (diagramType === 'sequence') ? window.UMLSequenceDiagram : window.UMLClassDiagram;
        if (!R) { self._showUMLError('UML renderer not loaded.'); return; }
        R.render(el, syntax);
        if (window.UMLShared && typeof UMLShared.applySvgAccessibility === 'function') {
          try { UMLShared.applySvgAccessibility(el, diagramType, syntax); } catch (_) {}
        }
        var zoomLabel = self._umlContainer ? self._umlContainer.querySelector('.tvm-diagram-zoom-label') : null;
        self._applyUMLZoom(el, self._umlZoom, zoomLabel);
      } catch (e) {
        self._showUMLError('Render failed: ' + ((e && e.message) || e));
      }
    }

    if (UMLWorkerService.supported()) {
      var snap = this._snapshotUMLContainer(el);
      var measurements = this._preMeasureForWorker(diagramType, syntax);
      UMLWorkerService.render(diagramType, syntax, snap.cssVars, snap.container, measurements)
        .then(function (svg) {
          if (!isCurrent()) return;
          applySVG(svg);
        }, function (err) {
          if (isUMLSuperseded(err)) return;
          if (!isCurrent()) return;
          console.warn('UML worker render failed, falling back to main thread:', err);
          fallbackMainThread();
        });
    } else {
      fallbackMainThread();
    }
  };

  /** Render Mermaid syntax into SVG in the diagram content area */
  TutorialCode.prototype._renderMermaidDiagram = function (syntax) {
    if (!this._umlContentEl || !window.mermaid) {
      this._showUMLError('Mermaid.js not loaded.');
      return;
    }
    var self = this;
    var id = 'uml-mermaid-' + (++this._umlMermaidCounter);

    // Detect dark mode for Mermaid theme
    var isDark = document.documentElement.classList.contains('dark-mode');
    mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? 'dark' : 'default',
      sequence: { mirrorActors: false }
    });

    mermaid.render(id, syntax)
      .then(function (result) {
        self._umlContentEl.innerHTML = result.svg;
      })
      .catch(function (err) {
        console.error('Mermaid render error:', err);
        self._umlContentEl.innerHTML =
          '<div class="tvm-diagram-empty">Diagram rendering error.<br>' +
          '<small style="opacity:0.7">' + (err.message || err) + '</small></div>';
      });
  };

  /** Show an empty-state message in the diagram area */
  TutorialCode.prototype._showUMLEmpty = function (msg) {
    if (this._umlContentEl) {
      this._umlContentEl.innerHTML = '<div class="tvm-diagram-empty">' + msg + '</div>';
    }
  };

  /** Show an error message in the diagram area */
  TutorialCode.prototype._showUMLError = function (msg) {
    if (this._umlContentEl) {
      this._umlContentEl.innerHTML = '<div class="tvm-diagram-empty" style="color:#e55;">' + msg + '</div>';
    }
  };

  /**
   * Install drag-to-pan (grab hand) on a scrollable diagram content element.
   * Only one listener set is attached per element (guarded by a flag).
   */
  TutorialCode.prototype._installUMLPan = function (contentEl) {
    if (!contentEl || contentEl._umlPanInstalled) return;
    contentEl._umlPanInstalled = true;

    var dragging = false;
    var startX, startY, scrollLeft, scrollTop;

    contentEl.style.cursor = 'grab';

    contentEl.addEventListener('mousedown', function (e) {
      // Only pan with left button; ignore clicks on buttons inside
      if (e.button !== 0 || e.target.tagName === 'BUTTON') return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      scrollLeft = contentEl.scrollLeft;
      scrollTop = contentEl.scrollTop;
      contentEl.style.cursor = 'grabbing';
      contentEl.style.userSelect = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      contentEl.scrollLeft = scrollLeft - dx;
      contentEl.scrollTop = scrollTop - dy;
    });

    document.addEventListener('mouseup', function () {
      if (!dragging) return;
      dragging = false;
      contentEl.style.cursor = 'grab';
      contentEl.style.userSelect = '';
    });
  };

  /** Apply a zoom level to the SVG inside a content element and update label */
  TutorialCode.prototype._applyUMLZoom = function (contentEl, zoom, labelEl) {
    if (!contentEl) return;
    var svg = contentEl.querySelector('svg');
    if (svg) {
      if (zoom === 1) {
        svg.style.transform = '';
        svg.style.width = '';
        svg.style.height = '';
        svg.style.maxWidth = '';
      } else {
        var baseW = svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width
          ? svg.viewBox.baseVal.width
          : (parseFloat(svg.getAttribute('width')) || 400);
        var baseH = svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.height
          ? svg.viewBox.baseVal.height
          : (parseFloat(svg.getAttribute('height')) || 300);
        svg.style.width = (baseW * zoom) + 'px';
        svg.style.height = (baseH * zoom) + 'px';
        svg.style.maxWidth = 'none';
        svg.style.transform = '';
      }
    }
    if (labelEl) labelEl.textContent = Math.round(zoom * 100) + '%';
  };

  /** Render the current diagram into the fullscreen content area */
  TutorialCode.prototype._renderUMLInFullscreen = function () {
    if (!this._umlFsContentEl) return;
    var fzLabel = this._umlFullscreenEl ? this._umlFullscreenEl.querySelector('.tvm-diagram-fs-zoom-label') : null;

    this._umlFsContentEl.innerHTML = '';
    if (!this._umlLastDiagrams) {
      this._umlFsContentEl.innerHTML = '<div class="tvm-diagram-empty">No diagram data yet. Refresh first.</div>';
      return;
    }
    this._applyUMLColors(this._umlFsContentEl);
    try {
      if (this._umlActiveType === 'sequence') {
        var seqSyntax = this._umlLastDiagrams.sequenceDiagram;
        if (seqSyntax && window.UMLSequenceDiagram) {
          UMLSequenceDiagram.render(this._umlFsContentEl, seqSyntax);
          if (window.UMLShared && typeof UMLShared.applySvgAccessibility === 'function') {
            UMLShared.applySvgAccessibility(this._umlFsContentEl, 'sequence', seqSyntax);
          }
        } else {
          this._umlFsContentEl.innerHTML = '<div class="tvm-diagram-empty">No sequence diagram available.</div>';
        }
      } else {
        var classSyntax = this._umlLastDiagrams.classDiagram;
        if (classSyntax && window.UMLClassDiagram) {
          var laidOutClassSyntax = this._applyTutorialClassLayout(classSyntax);
          UMLClassDiagram.render(this._umlFsContentEl, laidOutClassSyntax);
          if (window.UMLShared && typeof UMLShared.applySvgAccessibility === 'function') {
            UMLShared.applySvgAccessibility(this._umlFsContentEl, 'class', laidOutClassSyntax);
          }
        } else {
          this._umlFsContentEl.innerHTML = '<div class="tvm-diagram-empty">No class diagram available.</div>';
        }
      }
    } catch (e) {
      this._umlFsContentEl.innerHTML = '<div class="tvm-diagram-empty" style="color:#e55;">Render error: ' + (e.message || e) + '</div>';
    }
    this._applyUMLZoom(this._umlFsContentEl, this._umlFsZoom, fzLabel);
  };

  /** Open the fullscreen overlay and render the current diagram inside it */
  TutorialCode.prototype._openUMLFullscreen = function () {
    if (!this._umlFullscreenEl || !this._umlFsContentEl) return;
    this._umlFullscreenPrevFocus = document.activeElement;

    // Sync type buttons
    var fsTypeBtns = this._umlFullscreenEl.querySelectorAll('.tvm-diagram-fs-type-btn');
    for (var i = 0; i < fsTypeBtns.length; i++) {
      fsTypeBtns[i].classList.toggle('active', fsTypeBtns[i].getAttribute('data-type') === this._umlActiveType);
      fsTypeBtns[i].setAttribute('aria-pressed', fsTypeBtns[i].getAttribute('data-type') === this._umlActiveType ? 'true' : 'false');
    }

    // Reset zoom for new fullscreen session
    this._umlFsZoom = 1;
    var fzLabel = this._umlFullscreenEl.querySelector('.tvm-diagram-fs-zoom-label');
    if (fzLabel) fzLabel.textContent = '100%';

    // Move overlay to body to escape any parent stacking context / transform
    if (this._umlFullscreenEl.parentNode !== document.body) {
      document.body.appendChild(this._umlFullscreenEl);
    }

    this._syncColorInputs();
    this._renderUMLInFullscreen();
    this._umlFullscreenEl.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    var closeBtn = this._umlFullscreenEl.querySelector('.tvm-diagram-fs-close');
    if (closeBtn && typeof closeBtn.focus === 'function') closeBtn.focus();
  };

  /** Close the fullscreen overlay */
  TutorialCode.prototype._closeUMLFullscreen = function () {
    if (!this._umlFullscreenEl) return;
    this._umlFullscreenEl.style.display = 'none';
    document.body.style.overflow = '';
    if (this._umlFsContentEl) this._umlFsContentEl.innerHTML = '';
    if (this._umlFullscreenPrevFocus && typeof this._umlFullscreenPrevFocus.focus === 'function') {
      try { this._umlFullscreenPrevFocus.focus(); } catch (e) { /* ignore */ }
    }
    this._umlFullscreenPrevFocus = null;
  };

  /**
   * Schedule a debounced UML refresh when a watched file changes.
   * Called from the editor onDidChangeContent handler.
   */
  TutorialCode.prototype._scheduleUMLRefresh = function (force) {
    if (!this._umlDiagramEnabled) return;
    if (!force && !this._umlViewActive) return;
    var self = this;
    clearTimeout(this._umlRefreshTimer);
    if (force) {
      self._refreshUMLDiagram();
    } else {
      this._umlRefreshTimer = setTimeout(function () {
        self._refreshUMLDiagram();
      }, 1500);
    }
  };

  // ---------------------------------------------------------------------------
  // ---- Live diagnostics (linter feature flag) -------------------------------
  //
  // Wired only when YAML sets `linter: true`. We:
  //   1. Detect Python files (.py / .pyi) for lint dispatch.
  //   2. On debounced model change, send the buffer text to the worker.
  //   3. Worker runs ast.parse + pyflakes, returns marker dicts.
  //   4. Convert to Monaco's MarkerData and apply via setModelMarkers.
  TutorialCode.prototype._isPythonFile = function (filename) {
    return /\.pyi?$/i.test(filename || '');
  };

  // ---- Git gutter (feature flag) -------------------------------------------
  //
  // Wired only when YAML sets `git_gutter: true` AND `git_graph: ...`. We:
  //   1. On debounced model change, ask the worker for HEAD's content.
  //   2. Run a JS line-diff (LCS-based) against the buffer.
  //   3. Apply Monaco line decorations: green for added, blue for modified,
  //      a red wedge between lines for deletion markers.
  //   4. Re-run after every git command (a `commit` should clear the gutter,
  //      a `checkout` should refresh it, etc.).

  TutorialCode.prototype._refreshGitGutter = function (filename) {
    if (!this.config.enableGitGutter) return;
    var entry = this.editorModels[filename];
    if (!entry || !entry.model || entry.model.isDisposed()) return;
    var self = this;

    // Skip files that aren't inside the git repo. editorModels keys are
    // relative to /tutorial; the repo root is gitGraphPath. If the file
    // lives outside the repo root (e.g. /tutorial/notes.md while git_graph
    // is /tutorial/myproject), `git show HEAD:<path>` would never find it.
    var repoRoot = this.gitGraphPath || '/tutorial';
    var absPath = '/tutorial/' + filename;
    if (absPath.indexOf(repoRoot.replace(/\/$/, '') + '/') !== 0 &&
        absPath !== repoRoot) {
      return;
    }

    // Fetch HEAD's content for this file via whichever backend is in play.
    // Both paths resolve to {content, notReady}:
    //   content === <string>  → file is at HEAD; diff against current buffer
    //   content === null      → file is NOT at HEAD (untracked / new file)
    //   notReady === true     → backend isn't ready yet; leave gutter alone
    var headPromise;
    if (this.config.backend === 'pyodide') {
      headPromise = new Promise(function (resolve) {
        // Send the absolute path under /tutorial; the worker strips the
        // repo-root prefix itself to get the iso-git-relative path.
        self._postWorker(
          { type: 'gitReadAtRef', path: absPath, ref: 'HEAD' },
          function (msg) {
            if (!msg || msg.type !== 'git_read_at_ref') {
              return resolve({ content: null, notReady: true });
            }
            resolve({ content: msg.content, notReady: !!msg.notReady });
          }
        );
      });
    } else if (this.config.backend === 'v86') {
      headPromise = this._v86GitFileAtHead(filename);
    } else {
      return;  // other backends (sql, prolog, java, react) have no git
    }

    return headPromise.then(function (result) {
      self._applyGitGutterResult(filename, result);
    });
  };

  TutorialCode.prototype._applyGitGutterResult = function (filename, result) {
    var ent = this.editorModels[filename];
    if (!ent || !ent.model || ent.model.isDisposed()) return;
    if (result.notReady) {
      this._gitGutterPending = this._gitGutterPending || {};
      this._gitGutterPending[filename] = true;
      return;
    }
    var current = ent.model.getValue();
    var head = result.content;
    var diff = (head === null)
      ? { added: _allLineNumbers(current), modified: [], deleted: [] }
      : _gitGutterDiff(head, current);
    var decorations = [];
    diff.added.forEach(function (ln) {
      decorations.push({
        range: new monaco.Range(ln, 1, ln, 1),
        options: { isWholeLine: false, linesDecorationsClassName: 'tvm-gg-added' },
      });
    });
    diff.modified.forEach(function (ln) {
      decorations.push({
        range: new monaco.Range(ln, 1, ln, 1),
        options: { isWholeLine: false, linesDecorationsClassName: 'tvm-gg-modified' },
      });
    });
    diff.deleted.forEach(function (ln) {
      decorations.push({
        range: new monaco.Range(Math.max(1, ln), 1, Math.max(1, ln), 1),
        options: { isWholeLine: false, linesDecorationsClassName: 'tvm-gg-deleted' },
      });
    });
    ent._gitGutterIds = ent.model.deltaDecorations(ent._gitGutterIds || [], decorations);
  };

  TutorialCode.prototype._v86RepoRelForFile = function (filename) {
    var repoRoot = this.gitGraphPath || '/tutorial';
    var absPath = '/tutorial/' + filename;
    var rootPrefix = repoRoot.replace(/\/$/, '') + '/';
    if (absPath.indexOf(rootPrefix) === 0) {
      return absPath.substring(rootPrefix.length);
    }
    return null;
  };

  TutorialCode.prototype._v86GitFilesAtHead = function (filenames) {
    var self = this;
    var repoRoot = this.gitGraphPath || '/tutorial';
    var items = [];
    filenames.forEach(function (filename) {
      var repoRel = self._v86RepoRelForFile(filename);
      if (repoRel) items.push({ filename: filename, repoRel: repoRel });
    });
    if (items.length === 0) return Promise.resolve({});

    var body = [
      'cd ' + shellQuote(repoRoot) + ' || exit 0',
      'GIT_OPTIONAL_LOCKS=0',
      'export GIT_OPTIONAL_LOCKS'
    ];
    items.forEach(function (item) {
      body.push('p=' + shellQuote(item.repoRel));
      body.push('k=$(printf "%s" "$p" | base64 | tr -d "\\n")');
      body.push('tmp="/run/gg/blob-$$"');
      body.push('if git cat-file -e "HEAD:$p" 2>/dev/null && git show "HEAD:$p" > "$tmp" 2>/dev/null; then printf "F %s " "$k"; base64 "$tmp" | tr -d "\\n"; printf "\\n"; else printf "N %s\\n" "$k"; fi');
      body.push('rm -f "$tmp"');
    });
    var cmd = body.join('\n');

    return this._runRPC(cmd, { timeout: 30000 }).then(function (text) {
      var byRel = {};
      items.forEach(function (item) {
        byRel[item.repoRel] = { filename: item.filename, result: { content: null, notReady: false } };
      });
      String(text || '').split(/\n/).forEach(function (line) {
        if (!line) return;
        var m = line.match(/^([FN])\s+(\S+)(?:\s+(\S+))?$/);
        if (!m) return;
        var rel;
        try { rel = b64DecodeUtf8(m[2]); } catch (e) { return; }
        if (!byRel[rel]) return;
        if (m[1] === 'F') {
          try { byRel[rel].result = { content: b64DecodeUtf8(m[3] || ''), notReady: false }; }
          catch (e2) { byRel[rel].result = { content: null, notReady: true }; }
        } else {
          byRel[rel].result = { content: null, notReady: false };
        }
      });
      var out = {};
      Object.keys(byRel).forEach(function (rel) {
        out[byRel[rel].filename] = byRel[rel].result;
      });
      return out;
    });
  };

  // v86 backend: read <filename> at HEAD through the RPC daemon. During
  // boot/setup only, old snapshots without RPC may fall back to shelling
  // `git show` into a temp file on the 9p mount.
  //
  // Returns a Promise of {content, notReady}:
  //   content === <string>   — exact bytes of the blob at HEAD
  //   content === null       — file not at HEAD (untracked / never committed)
  //   notReady === true      — VM not booted / read failed; gutter left alone
  //
  // The legacy temp-file path uses a unique-per-call filename so concurrent
  // refreshes for different files don't race on a shared buffer.
  TutorialCode.prototype._v86GitFileAtHead = function (filename) {
    var self = this;
    if (!this.emulator || !this.emulator.read_file) {
      return Promise.resolve({ content: null, notReady: true });
    }
    var repoRoot = this.gitGraphPath || '/tutorial';
    // editorModels keys are relative to /tutorial; convert to a repo-relative
    // path by stripping the repo-root prefix. e.g.:
    //   gitGraphPath=/tutorial/myproject, filename=myproject/hero_registry.py
    //   → absPath=/tutorial/myproject/hero_registry.py, repoRel=hero_registry.py
    var repoRel = this._v86RepoRelForFile(filename);
    if (!repoRel) {
      // Outside the repo — gutter is meaningless here.
      return Promise.resolve({ content: null, notReady: false });
    }

    // Unique tag avoids collision with anything the user's file might contain.
    var tag = Math.random().toString(36).substr(2, 12);
    var marker = '__GG_END_' + tag + '__';
    var tmpRel = '.git/__gutter_' + tag;
    var tmpVMPath = repoRoot + '/' + tmpRel;
    // 9p mount is rooted at /tutorial in the VM → drop that prefix for JS reads.
    var read9pPath = repoRoot.replace(/^\/tutorial/, '') + '/' + tmpRel;
    if (read9pPath.charAt(0) !== '/') read9pPath = '/' + read9pPath;

    // Single-quote the path for `git show HEAD:'<rel>'`. Tutorial filenames
    // don't contain single quotes; we still escape defensively.
    var safeRel = repoRel.replace(/'/g, "'\\''");

    return self._probeRPCDaemon().then(function (rpcAvail) {
      if (rpcAvail) {
        // RPC path: daemon captures stdout to resp-<id>; JS reads it. No
        // temp file in the user's repo, no muting, no race with user typing.
        // The marker pattern still distinguishes "git show succeeded" from
        // "git show failed" — without it, an empty-file blob and a non-existent
        // blob look identical from the resp content.
        var cmd = '( cd ' + shellQuote(repoRoot) + ' && git show HEAD:\'' + safeRel + '\' 2>/dev/null && echo ' + marker + ' )';
        return self._runRPC(cmd).then(function (text) {
          var idx = text.lastIndexOf(marker);
          if (idx === -1) {
            if (!self._gitGutterDiagLogged) {
              self._gitGutterDiagLogged = true;
              console.info('[git-gutter] (rpc) no marker for', filename, '— file not at HEAD');
            }
            return { content: null, notReady: false };
          }
          // text up to (but not including) the marker. The marker is preceded
          // by '\n' from `echo`, so trim that one newline if present.
          var content = text.substring(0, idx);
          if (content.charAt(content.length - 1) === '\n') content = content.slice(0, -1);
          if (!self._gitGutterDiagLogged) {
            self._gitGutterDiagLogged = true;
            console.info('[git-gutter] (rpc) read', content.length, 'bytes for', filename, 'at HEAD');
          }
          return { content: content, notReady: false };
        }).catch(function (err) {
          if (!self._gitGutterDiagLogged) {
            self._gitGutterDiagLogged = true;
            console.warn('[git-gutter] (rpc) failed for', filename, ':', err && err.message || err);
          }
          return { content: null, notReady: true };
        });
      }

      // Legacy fallback (no daemon): write to a temp file in .git/, read via
      // 9p, parse for the marker. Same behavior as before the RPC migration.
      if (!self._canRunLegacyBackgroundSerial()) {
        self._logLegacyBackgroundSerialSkip('git gutter refresh');
        return { content: null, notReady: true };
      }
      var cmd = '( cd ' + shellQuote(repoRoot) + ' && ( git show HEAD:\'' + safeRel + '\' 2>/dev/null && echo ' + marker + ' ) > ' + shellQuote(tmpVMPath) + ' )';
      return self._runSilent(cmd)
        .then(function () { return new Promise(function (r) { setTimeout(r, 120); }); })
        .then(function () { return self.emulator.read_file(read9pPath); })
        .then(function (buf) {
          // Cleanup (fire-and-forget; cleanup failure is harmless).
          self._runSilent('rm -f ' + shellQuote(tmpVMPath));
          if (!buf || buf.length === 0) {
            if (!self._gitGutterDiagLogged) {
              self._gitGutterDiagLogged = true;
              console.info('[git-gutter] empty buf for', filename, '- treating as no HEAD blob');
            }
            return { content: null, notReady: false };
          }
          var text = '';
          try { text = new TextDecoder('utf-8').decode(buf); }
          catch (e) { return { content: null, notReady: true }; }
          var idx = text.lastIndexOf(marker);
          if (idx === -1) {
            if (!self._gitGutterDiagLogged) {
              self._gitGutterDiagLogged = true;
              console.info('[git-gutter] no marker for', filename, '— file not at HEAD');
            }
            return { content: null, notReady: false };
          }
          if (!self._gitGutterDiagLogged) {
            self._gitGutterDiagLogged = true;
            console.info('[git-gutter] read', idx, 'bytes for', filename, 'at HEAD');
          }
          return { content: text.substring(0, idx), notReady: false };
        })
        .catch(function (err) {
          if (!self._gitGutterDiagLogged) {
            self._gitGutterDiagLogged = true;
            console.warn('[git-gutter] read failed for', filename, ':', err && err.message || err);
          }
          self._runSilent('rm -f ' + shellQuote(tmpVMPath)).catch(function () {});
          return { content: null, notReady: true };
        });
    });
  };

  TutorialCode.prototype._refreshAllGitGutters = function () {
    if (!this.config.enableGitGutter) return;
    if (this._isBackgroundSyncPaused()) return;
    if (this._gitGutterRefreshing) return;
    var self = this;
    self._gitGutterRefreshing = true;
    var files = Object.keys(this.editorModels || {});
    var work;
    if (this.config.backend === 'v86') {
      var repoFiles = files.filter(function (fn) { return !!self._v86RepoRelForFile(fn); });
      work = self._probeRPCDaemon().then(function (avail) {
        if (!avail || repoFiles.length === 0) {
          return Promise.all(files.map(function (fn) {
            try { return Promise.resolve(self._refreshGitGutter(fn)); }
            catch (e) { return Promise.resolve(); }
          }));
        }
        return self._v86GitFilesAtHead(repoFiles).then(function (results) {
          repoFiles.forEach(function (fn) {
            self._applyGitGutterResult(fn, results[fn] || { content: null, notReady: true });
          });
        }).catch(function () {
          return Promise.all(files.map(function (fn) {
            try { return Promise.resolve(self._refreshGitGutter(fn)); }
            catch (e) { return Promise.resolve(); }
          }));
        });
      });
    } else {
      work = Promise.all(files.map(function (fn) {
        // _refreshGitGutter is fire-and-forget today; wrap defensively so a
        // future refactor that returns a Promise still settles the gate.
        try { return Promise.resolve(self._refreshGitGutter(fn)); }
        catch (e) { return Promise.resolve(); }
      }));
    }
    // Settle delay: once all gutter queries finish, bash still emits one
    // final prompt that the persistent listener will detect. Hold the gate
    // for an extra 250ms so that prompt doesn't re-schedule us. Real user
    // commands (typed > 250ms after a refresh) still trigger as expected.
    Promise.resolve(work).catch(function () {}).then(function () {
      setTimeout(function () { self._gitGutterRefreshing = false; }, 250);
    });
  };

  // Return [1, 2, ..., N] for an N-line buffer (used when a file has no
  // HEAD counterpart — every line is "added").
  function _allLineNumbers(text) {
    var n = (text || '').split('\n').length;
    if (text && text.charAt(text.length - 1) === '\n') n -= 1;
    var out = [];
    for (var i = 1; i <= n; i++) out.push(i);
    return out;
  }

  // LCS-based line diff; classifies each current-buffer line as
  // unchanged / added / modified, and records positions where head lines were
  // deleted. "Modified" = an ADD that immediately follows a DEL in the edit
  // sequence. Sufficient for tutorial-sized files; not Myers-optimal.
  function _gitGutterDiff(headText, curText) {
    var head = (headText || '').split('\n');
    var cur  = (curText  || '').split('\n');
    if (head.length && head[head.length - 1] === '') head.pop();
    if (cur.length  && cur[cur.length - 1]  === '') cur.pop();

    var n = head.length, m = cur.length;
    // For very large files, bail out — O(n*m) DP is too slow.
    if (n * m > 1000000) return { added: [], modified: [], deleted: [] };

    var dp = [];
    for (var i = 0; i <= n; i++) dp.push(new Int32Array(m + 1));
    for (var i2 = 1; i2 <= n; i2++) {
      var hi = head[i2 - 1];
      for (var j = 1; j <= m; j++) {
        dp[i2][j] = hi === cur[j - 1]
          ? dp[i2 - 1][j - 1] + 1
          : Math.max(dp[i2 - 1][j], dp[i2][j - 1]);
      }
    }
    // Backtrack — produce ops in reverse, then flip.
    var ops = [];
    var i3 = n, j3 = m;
    while (i3 > 0 && j3 > 0) {
      if (head[i3 - 1] === cur[j3 - 1]) { ops.push({ op: 'eq', cur: j3 }); i3--; j3--; }
      else if (dp[i3 - 1][j3] >= dp[i3][j3 - 1]) { ops.push({ op: 'del', atCur: j3 }); i3--; }
      else { ops.push({ op: 'add', cur: j3 }); j3--; }
    }
    while (i3 > 0) { ops.push({ op: 'del', atCur: 0 }); i3--; }
    while (j3 > 0) { ops.push({ op: 'add', cur: j3 }); j3--; }
    ops.reverse();

    var added = {}, modified = {}, deleted = {};
    for (var k = 0; k < ops.length; k++) {
      var o = ops[k];
      if (o.op === 'add') {
        // Pair with an immediately-preceding DEL → mark as modified.
        var prev = ops[k - 1];
        if (prev && prev.op === 'del' && !prev.consumed) {
          modified[o.cur] = true;
          prev.consumed = true;
        } else {
          added[o.cur] = true;
        }
      }
    }
    // Pure DELs (no following ADD) become deletion markers attached to the
    // current-buffer line where the head line would have appeared.
    for (var k2 = 0; k2 < ops.length; k2++) {
      var o2 = ops[k2];
      if (o2.op === 'del' && !o2.consumed) {
        // atCur is the j-index of the position in the current buffer where
        // the deleted head line was relative to. Mark the line that follows
        // (or line 1 if at the very start).
        var ln = o2.atCur > 0 ? o2.atCur : 1;
        deleted[ln] = true;
      }
    }
    return {
      added: Object.keys(added).map(Number).sort(function (a, b) { return a - b; }),
      modified: Object.keys(modified).map(Number).sort(function (a, b) { return a - b; }),
      deleted: Object.keys(deleted).map(Number).sort(function (a, b) { return a - b; }),
    };
  }

  TutorialCode.prototype._lintFile = function (filename) {
    var entry = this.editorModels[filename];
    if (!entry || !entry.model || entry.model.isDisposed()) return;
    if (this.config.backend !== 'pyodide') return;
    var code = entry.model.getValue();
    var self = this;
    this._postWorker(
      { type: 'lint', path: '/tutorial/' + filename, code: code },
      function (msg) {
        if (msg.type !== 'lint_done') return;
        // Surface worker-side linter setup failures so they're visible in
        // the dev console (otherwise empty markers look like "all clean"
        // when really pyflakes never loaded).
        if (msg.error) {
          if (!self._lintErrorLogged) {
            self._lintErrorLogged = true;
            console.warn('[lint] worker error:', msg.error);
          }
        }
        var ent = self.editorModels[filename];
        if (!ent || !ent.model || ent.model.isDisposed()) return;
        var markers = (msg.markers || []).map(function (m) {
          // Map our worker severity strings to Monaco's MarkerSeverity enum.
          var sev = m.severity === 'error' ? 8 :
                    m.severity === 'warning' ? 4 :
                    m.severity === 'info' ? 2 : 1;
          // Make sure end position covers at least one character — Monaco
          // collapses zero-width markers and the squiggle disappears.
          var line = m.line || 1;
          var col = m.col || 1;
          var endLine = m.endLine || line;
          var endCol = m.endCol || col;
          if (endLine === line && endCol <= col) {
            // Extend to the end of the offending word, or just one character.
            var lineText = ent.model.getLineContent(line) || '';
            var match = lineText.substring(col - 1).match(/^[A-Za-z_][A-Za-z0-9_]*/);
            endCol = col + (match ? match[0].length : 1);
          }
          return {
            severity: sev,
            startLineNumber: line,
            startColumn: col,
            endLineNumber: endLine,
            endColumn: endCol,
            message: m.message || '',
            source: 'pyflakes',
            code: m.code || undefined,
          };
        });
        monaco.editor.setModelMarkers(ent.model, 'pyflakes', markers);
      }
    );
  };

  // ---------------------------------------------------------------------------
  // File Sync  (editor → backend)
  // ---------------------------------------------------------------------------
  TutorialCode.prototype._syncFileToBackend = function (filename, callback) {
    var entry = this.editorModels[filename];
    if (!entry) { if (callback) callback(); return Promise.resolve(); }
    var content = entry.model.getValue();
    entry.lastSyncContent = content;
    var self = this;

    // UML refresh is triggered from _saveCurrentFile (explicit save only), not here.

    return new Promise(function (resolve) {
      var done = function () { if (callback) callback(); resolve(); };

      if (self.config.backend === 'v86') {
        self._syncFileToV86(filename, content).then(done).catch(done);

      } else if (self.config.backend === 'pyodide' || self.config.backend === 'sql' || self.config.backend === 'prolog' || self.config.backend === 'java') {
        self._postWorker(
          { type: 'write', path: '/tutorial/' + filename, content: content },
          done
        );

      } else if (self.config.backend === 'webcontainer' && self._webcontainer) {
        var wcPath = 'tutorial/' + filename;
        var wcDir = wcPath.substring(0, wcPath.lastIndexOf('/'));
        var wc = self._webcontainer;
        var doWrite = function () {
          wc.fs.writeFile(wcPath, content).then(done).catch(done);
        };
        if (wcDir && wcDir !== 'tutorial') {
          wc.fs.mkdir(wcDir, { recursive: true }).then(doWrite).catch(doWrite);
        } else {
          doWrite();
        }

      } else if (self.config.backend === 'react') {
        // Preview only rebuilds on explicit save (Ctrl+S / save button),
        // not on every keystroke — see _saveCurrentFile.
        done();

      } else {
        done();
      }
    });
  };

  TutorialCode.prototype._syncFileToV86 = function (filename, content) {
    if (!this.emulator || !this.booted) return Promise.resolve();
    var bytes;
    if (typeof TextEncoder !== 'undefined') {
      bytes = new TextEncoder().encode(content);
    } else {
      var utf8 = unescape(encodeURIComponent(content));
      bytes = new Uint8Array(utf8.length);
      for (var i = 0; i < utf8.length; i++) bytes[i] = utf8.charCodeAt(i);
    }
    var self = this;
    var needsChmod = self._executableFiles.has(filename);

    return this.emulator.create_file('/' + filename, bytes)
      .then(function () {
        if (needsChmod) {
          var res = self.emulator.fs9p.SearchPath('/' + filename);
          if (res && res.id !== -1) self.emulator.fs9p.inodes[res.id].mode = 0x81ED;
        }
      }).catch(function (err) {
        var dirname = filename.indexOf('/') !== -1
          ? filename.substring(0, filename.lastIndexOf('/'))
          : '';
        var mkdirCmd = dirname ? 'mkdir -p /tutorial/' + dirname + ' && ' : '';
        var b64 = btoa(unescape(encodeURIComponent(content)));
        return self._runSilent(mkdirCmd + 'printf "' + b64 + '" | base64 -d > /tutorial/' + filename +
          (needsChmod ? ' && chmod +x /tutorial/' + filename : ''));
      });
  };

  // ---------------------------------------------------------------------------
  // Instructor Mode — Apply Solution
  // ---------------------------------------------------------------------------

  /**
   * Apply the solution for the current step. Loads solution files into the
   * editor, syncs them to the backend, runs any solution commands, and shows
   * the explanation. Backend-specific concerns (import cache, preview rebuild)
   * are handled here so the YAML spec stays backend-independent.
   */
  TutorialCode.prototype.applySolution = function () {
    var step = this.steps[this.currentStep];
    if (!step || !step.solution) return;
    var solution = step.solution;
    var self = this;

    // 1. Pyodide: clear Python import cache before writing files
    if (this.config.backend === 'pyodide' && solution.files) {
      this._postWorker({
        type: 'runCode',
        code: [
          'import sys as _sys',
          'for _m in list(_sys.modules):',
          '    _f = getattr(_sys.modules[_m], "__file__", "") or ""',
          '    if "/tutorial/" in _f: del _sys.modules[_m]',
        ].join('\n'),
        silent: true
      });
    }

    var p = Promise.resolve();
    // 2. Apply file overrides — reuse existing openFile + _syncFileToBackend
    if (solution.files) {
      self._suppressAutoSave = true;
      solution.files.forEach(function (f) {
        self.openFile(f.path, f.content, f.language, f);
        p = p.then(function () { return self._syncFileToBackend(f.path); });
      });
      self._suppressAutoSave = false;
      // Activate the step's open_file (the main file the student works on),
      // not the first solution file (which may be a dependency).
      var target = step.open_file || (solution.files.length > 0 ? solution.files[solution.files.length - 1].path : null);
      if (target) {
        self._setActiveFile(target);
        self._renderTabs();
      }
    }

    // 3. Run solution commands (backend-specific dispatch)
    if (solution.commands && solution.commands.length > 0) {
      if (this.config.backend === 'v86' || this.config.backend === 'webcontainer') {
        // Batch into a single shell invocation so we only pay one marker +
        // prompt-wait round-trip regardless of command count. --no-pager is
        // injected per-command so interactive pagers don't stall the chain.
        var batch = tutorialShellBatch(solution.commands);
        p = p.then(function () { return self._runVisible(batch); });
      } else if (this.config.backend === 'pyodide') {
        p = p.then(function () {
          return new Promise(function (resolve) {
            self._postWorker({
              type: 'runCode',
              code: solution.commands.join('\n'),
              silent: true
            }, resolve);
          });
        });
      } else if (this.config.backend === 'prolog' || this.config.backend === 'sql' || this.config.backend === 'java') {
        p = p.then(function () {
          return new Promise(function (resolve) {
            self._postWorker({
              type: 'runCode',
              code: solution.commands.join('\n'),
              silent: true
            }, resolve);
          });
        });
      }
    }

    // 4. React: rebuild live preview after file changes
    if (this.config.backend === 'react') {
      p = p.then(function () {
        setTimeout(function () { self._rebuildReactPreview(); }, 400);
      });
    }

    // 5. UML: force refresh after solution files are applied
    p = p.then(function () {
      self._scheduleUMLRefresh(true);
    });

    // 6. Show explanation if present
    p = p.then(function () {
      if (solution.explanationHTML) {
        self._showSolutionExplanation(solution.explanationHTML);
      }
    });

    return p;
  };

  /**
   * Show the solution explanation below the step instructions.
   */
  TutorialCode.prototype._showSolutionExplanation = function (html) {
    // Remove any previous explanation
    var prev = this.stepContentEl.querySelector('.tvm-solution-explanation');
    if (prev) prev.remove();

    var div = document.createElement('div');
    div.className = 'tvm-solution-explanation';
    div.innerHTML = '<h3>Solution Explanation</h3>' + html;
    this.stepContentEl.appendChild(div);

    // Scroll to explanation
    if (this.stepContentWrapEl) {
      this.stepContentWrapEl.scrollTop = this.stepContentWrapEl.scrollHeight;
    }
  };

  // ---------------------------------------------------------------------------
  // Progress Persistence (localStorage)
  // ---------------------------------------------------------------------------

  TutorialCode.prototype._storageKey = function () {
    return 'tutorial-progress-' + this.tutorialId;
  };

  /**
   * Save the current step index and all open file contents to localStorage.
   */
  /**
   * Full save: persists step, unlock state, and only files changed from original.
   */
  TutorialCode.prototype.saveProgress = function () {
    if (!this.autosaveType) return;
    // Start from the previously persisted overrides so files that aren't
    // currently open as tabs (closed during a step transition) keep their
    // saved edits. Only files that are still in the editor get re-evaluated
    // against their original starter content here.
    var files = {};
    try {
      var prevRaw = localStorage.getItem(this._storageKey());
      if (prevRaw) {
        var prev = JSON.parse(prevRaw);
        if (prev && prev.files) {
          for (var k in prev.files) {
            if (prev.files.hasOwnProperty(k)) files[k] = prev.files[k];
          }
        }
      }
    } catch (e) { /* ignore */ }
    var self = this;
    for (var name in this.editorModels) {
      if (this.editorModels.hasOwnProperty(name)) {
        var current = this.editorModels[name].model.getValue();
        var original = self._originalContent[name];
        if (original === undefined || current !== original) {
          files[name] = {
            content: current,
            language: this.editorModels[name].model.getLanguageId()
          };
        } else {
          // Open file matches starter — drop any stale override for it.
          delete files[name];
        }
      }
    }
    var data = {
      step: this.currentStep,
      files: files,
      activeFile: this.activeFileName,
      stepsUnlocked: Array.from(this._stepsUnlocked),
      stepsVisited: Array.from(this._stepsVisited),
      stepsPassed: Array.from(this._stepsPassed),
      quizPassed: Array.from(this._quizPassed)
    };
    try {
      localStorage.setItem(this._storageKey(), JSON.stringify(data));
    } catch (e) {
      console.warn('TutorialCode: could not save progress', e);
    }
  };

  /**
   * Targeted save: persists only a single file (if changed) plus current step.
   * Used by auto-save on Ctrl+S to avoid re-serializing everything.
   */
  TutorialCode.prototype._saveFile = function (filename) {
    if (!this.autosaveType) return;
    var entry = this.editorModels[filename];
    if (!entry) return;
    var current = entry.model.getValue();
    var original = this._originalContent[filename];
    if (original !== undefined && current === original) return; // unchanged

    try {
      var raw = localStorage.getItem(this._storageKey());
      var data = raw ? JSON.parse(raw) : {};
      if (!data.files) data.files = {};
      data.files[filename] = { content: current, language: entry.model.getLanguageId() };
      data.step = this.currentStep;
      data.activeFile = this.activeFileName;
      localStorage.setItem(this._storageKey(), JSON.stringify(data));
    } catch (e) {
      console.warn('TutorialCode: could not save file', e);
    }
  };

  /**
   * Load saved progress from localStorage. Returns the parsed object or null.
   */
  TutorialCode.prototype._loadSavedProgress = function () {
    try {
      var raw = localStorage.getItem(this._storageKey());
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (typeof data.step !== 'number' || data.step < 0 || data.step >= this.steps.length) return null;
      return data;
    } catch (e) {
      return null;
    }
  };

  /**
   * Apply saved file contents on top of the currently loaded step.
   * Returns a Promise that resolves once every file's VM-side write has
   * landed. Callers that chain VM operations on the restored files
   * (e.g. running post_fileload_setup that reads them) must await this;
   * existing non-awaiting callers still behave correctly because the
   * returned Promise is just ignored.
   */
  TutorialCode.prototype._applySavedFiles = function (files, activeFile) {
    if (!files) return Promise.resolve();
    var self = this;
    // Only restore files that belong to the current step. Each step's
    // `files` array defines its visible tabs; saved overrides for files
    // outside that set would re-clutter the editor with content from
    // other steps. The override is still in localStorage and gets
    // re-applied on revisit (see loadStep).
    var step = this.steps[this.currentStep];
    var stepPaths = null;
    if (step && step.files) {
      stepPaths = {};
      step.files.forEach(function (f) { stepPaths[f.path] = true; });
    }
    self._suppressAutoSave = true;
    var syncs = [];
    for (var name in files) {
      if (files.hasOwnProperty(name)) {
        if (stepPaths && !stepPaths[name]) continue;
        self.openFile(name, files[name].content, files[name].language);
        syncs.push(Promise.resolve(self._syncFileToBackend(name)));
      }
    }
    self._suppressAutoSave = false;
    if (activeFile && self.editorModels[activeFile]) {
      self._setActiveFile(activeFile);
    }
    self._renderTabs();
    // UML: force refresh after restoring autosaved files
    self._scheduleUMLRefresh(true);
    // React: rebuild preview after restoring autosaved files
    if (self.config.backend === 'react') self._rebuildReactPreview();
    return Promise.all(syncs);
  };

  TutorialCode.prototype._replayPriorStepsForCommands = function (targetStep) {
    if (!targetStep || targetStep <= 0) return Promise.resolve();
    return this._replayPriorStepsViaFrontend(targetStep);
  };

  TutorialCode.prototype._replayPriorStepsViaFrontend = function (targetStep) {
    var self = this;
    var p = Promise.resolve();
    for (var i = 0; i < targetStep; i++) {
      (function (stepIdx) {
        var st = self.steps[stepIdx];
        if (!st) return;

        if (st.files) {
          p = p.then(function () {
            self._suppressAutoSave = true;
            var syncs = [];
            st.files.forEach(function (f) {
              self.openFile(f.path, f.content, f.language, f);
              syncs.push(Promise.resolve(self._syncFileToBackend(f.path)));
              self._originalContent[f.path] = f.content || '';
            });
            self._suppressAutoSave = false;
            return Promise.all(syncs);
          });
        }

        p = p.then(function () {
          return self._runStepSetupCommands(st, { timeout: 120000 });
        });

        if ((self.postFileloadSetupCommands && self.postFileloadSetupCommands.length > 0) ||
            (st.post_fileload_setup && st.post_fileload_setup.length > 0)) {
          p = p.then(function () { return self._runPostFileloadSetup(st); });
        }

        if (st.solution && st.solution.files) {
          p = p.then(function () {
            self._suppressAutoSave = true;
            var syncs = [];
            st.solution.files.forEach(function (f) {
              self.openFile(f.path, f.content, f.language, f);
              syncs.push(Promise.resolve(self._syncFileToBackend(f.path)));
            });
            self._suppressAutoSave = false;
            return Promise.all(syncs);
          });
        }

        if (st.solution && st.solution.commands && st.solution.commands.length > 0) {
          if (self.config.backend === 'v86' || self.config.backend === 'webcontainer') {
            p = p.then(function () {
              return self._runBackgroundShell(tutorialShellBatch(st.solution.commands), { timeout: 120000 });
            });
          }
        }
      })(i);
    }
    return p;
  };

  /**
   * Reset the current step to its original starter-code files.
   * When resetType is "commands", replays all prior solutions + setup_commands
   * (like the autosave restore) before applying the current step's starter files.
   */
  TutorialCode.prototype.resetStep = function () {
    var step = this.steps[this.currentStep];
    if (!step) return;
    var self = this;

    // Guard against re-entrant resets. Clicking Reset twice in quick
    // succession was layering concurrent restore_state + replay chains on
    // top of each other, leaving muteCount and the silent queue in a
    // desynced state.
    if (self._resetInProgress) return;

    if (self.resetType === 'commands') {
      self._resetInProgress = true;
      self._pauseBackgroundSync();
      var p = self._resetStepWithCommands();
      var clear = function () {
        self._resetInProgress = false;
        self._resumeBackgroundSync();
      };
      if (p && typeof p.then === 'function') {
        p.then(clear, clear);
      } else {
        clear();
      }
      return p;
    }

    // Default "files" reset: just reload starter files (persistent files keep
    // their current editor content and get synced back to the VM).
    if (!step.files) return;
    self._syncStepFiles(step).then(function () {
      self._renderTabs();
      // UML: force refresh after resetting files
      self._scheduleUMLRefresh(true);
      // React: rebuild preview after resetting files
      if (self.config.backend === 'react') self._rebuildReactPreview();
      // Replay post-fileload setup so e.g. build-git.sh is re-applied to the
      // persistent-file state the student is resetting TO.
      return self._runPostFileloadSetup(step);
    }).then(function () {
      return self._updateUserCmdListener(step);
    });
  };

  /**
   * "commands" reset: replay all solution files/commands for steps before the
   * current one, then apply the current step's starter files and run its
   * setup_commands.  Shows the same loading overlay used by autosave restore.
   */
  TutorialCode.prototype._resetStepWithCommands = function () {
    var self = this;
    var targetStep = self.currentStep;
    var totalSteps = targetStep;

    // Fast path: if we already cached a clean entry-state snapshot for this
    // step (from a prior visit or a previous reset), just restore it. One
    // WASM call replaces restoring _initialVMState + replaying every prior
    // step + running this step's setup. This is the common case.
    if (self.config.backend === 'v86' && self.emulator && self.emulator.restore_state) {
      self._showLoading('Resetting step\u2026');
      return self._restoreStepEntrySnapshot(targetStep).then(function (ok) {
        if (!ok) return self._resetStepWithCommandsSlow();
        // Reapply the current step's starter files to the editor + 9p.
        // _syncFileToBackend's v86 path falls back to a silent shell mkdir
        // + printf when create_file errors (subdirectory files). Each
        // fallback enqueues a _runSilent, so we MUST await them before
        // firing the quiesce below — otherwise muteCount gets adjusted by
        // the fallbacks while we've also manually forced it to 0 in the
        // reveal, leaving muteCount stuck at -1 and the terminal muted.
        var curStep = self.steps[targetStep];
        // `persistent: true` on a file makes reset keep the student's current
        // editor content (synced back to the freshly-restored VM) instead of
        // overwriting it with the step's starter content. This is what turns
        // the git-playground into an undo-by-editing-build-git.sh experience.
        return self._syncStepFiles(curStep).then(function () {
          // Await syncs, then quiesce the shell. _restoreStepEntrySnapshot
          // sent a Ctrl-C to clear any stray PS2 continuation; its response
          // (^C plus a fresh prompt) streams in asynchronously. Without the
          // _runSilent(':') the response can arrive after we set muteCount=0
          // and appear in the terminal as a spurious "^C" line.
          return self._runSilent(':');
        }).then(function () {
          // Replay post-fileload setup on the newly-restored VM. The snapshot
          // already contains the result of running this on the STARTER files
          // (e.g. `bash build-git.sh` against an empty script — a no-op), so
          // running it again against persistent editor content is the only
          // effect students observe. Backends without post-fileload setup
          // fall through as a resolved no-op.
          return self._runPostFileloadSetup(curStep);
        }).then(function () {
          return self._refreshStepVisibleFiles(curStep);
        }).then(function () {
          return self._updateUserCmdListener(curStep);
        }).then(function () {
          return self._runStepDir(curStep);
        }).then(function () {
          return self._ensureGitGraphPromptHook();
        }).then(function () {
          self._autoSaveProgress();
          return self._refreshPrompt();
        }).then(function () {
          self._hideLoading();
          self._refreshGitGraph();
        });
      });
    }

    return self._resetStepWithCommandsSlow();
  };

  /**
   * Slow path for reset: restore the post-boot VM, replay every prior
   * step's solution commands, run the current step's setup_commands. Also
   * caches a snapshot of the final "clean entry state" so that future
   * resets of this step hit the fast path above.
   */
  TutorialCode.prototype._resetStepWithCommandsSlow = function () {
    var self = this;
    var targetStep = self.currentStep;
    var totalSteps = targetStep;

    self._showLoading(
      totalSteps > 0
        ? 'Resetting step\u2026 (replaying ' + totalSteps + ' step' + (totalSteps === 1 ? '' : 's') + ')'
        : 'Resetting step\u2026'
    );

    var p = Promise.resolve();

    // Restore VM to its post-boot state so replayed commands run on a clean filesystem
    if (self._initialVMState && self.emulator && self.emulator.restore_state) {
      p = p.then(function () {
        return self.emulator.restore_state(self._initialVMState).then(function () {
          self._resetSerialState();
        });
      });
    }

    p = p.then(function () { return self._replayPriorStepsForCommands(targetStep); });

    // Apply current step's starter files (honoring `persistent: true` so the
    // student's build-git.sh edits survive reset).
    var curStep = self.steps[targetStep];
    if (curStep && curStep.files) {
      p = p.then(function () { return self._syncStepFiles(curStep, { setActive: false }); });
    }

    p = p.then(function () {
      return self._runStepSetupCommands(curStep, { timeout: 120000 });
    });

    // Run post_fileload_setup AFTER all setup/solution commands so e.g.
    // `bash build-git.sh` replays against the final VM state.
    p = p.then(function () { return self._runPostFileloadSetup(curStep); });
    p = p.then(function () { return self._refreshStepVisibleFiles(curStep); });
    p = p.then(function () { return self._updateUserCmdListener(curStep); });
    p = p.then(function () { return self._runStepDir(curStep); });

    // Quiesce the shell before snapshotting: a no-op silent command forces
    // one more prompt round-trip after the batched replay, guaranteeing the
    // serial output queue is drained to a clean PS1. Without this, the
    // snapshot can freeze bytes still in-flight from the previous batch,
    // and a later restore replays them as a half-typed command. Single
    // cheap round-trip.
    p = p.then(function () { return self._runSilent(':'); });
    p = p.then(function () { return self._saveStepEntrySnapshot(targetStep); });

    // Reveal the tutorial
    p = p.then(function () {
      self._suppressAutoSave = false;
      // The replay loop above opened every prior step's files into the editor
      // to sync them to the VM. Clean those tabs so only the current step's
      // files remain visible.
      self._closeNonStepFiles(curStep);
      if (curStep && curStep.open_file) { self._setActiveFile(curStep.open_file); }
      self._renderTabs();
      self._autoSaveProgress();
      // Clear terminal, unmute, and show a fresh prompt after the silent replay
      return self._ensureGitGraphPromptHook().then(function () {
        return self._refreshPrompt();
      }).then(function () {
        self._hideLoading();
        self._refreshGitGraph();
      });
    });

    return p;
  };

  /**
   * Silently auto-save progress to localStorage (no toast).
   * Bails out when _suppressAutoSave is set so that restore sequences
   * (which call loadStep before the saved files have been applied)
   * cannot overwrite the student's saved content with starter-file content.
   */
  TutorialCode.prototype._autoSaveProgress = function () {
    if (this.currentStep < 0) return;
    if (this._suppressAutoSave) return;   // never clobber during file-load sequences
    this.saveProgress();
    var status = document.getElementById('tutorialAutosaveStatus');
    if (!status) return;
    var now = Date.now();
    if (this._lastAutoSaveStatusAt && now - this._lastAutoSaveStatusAt < 5000) return;
    this._lastAutoSaveStatusAt = now;
    status.textContent = 'Saved';
    clearTimeout(this._autoSaveStatusTimer);
    this._autoSaveStatusTimer = setTimeout(function () {
      status.textContent = '';
    }, 1500);
  };

  /**
   * Restore mode "commands-and-files": replay each step's files + solution
   * commands sequentially until the saved step, then apply the autosave
   * file overrides on top.
   *
   * Order for step i (0 … savedStep-1):
   *   1. step[i].files          → write to editor + backend
   *   2. step[i].solution.files → write to editor + backend
   *   3. step[i].solution.commands → run visibly in terminal
   * Then:
   *   4. step[savedStep].files  → write (starting state for current step)
   *   5. saved.files overrides  → apply autosaved student edits
   */
  TutorialCode.prototype._restoreCommandsAndFiles = function (saved) {
    var self = this;
    var targetStep = saved.step;
    var totalSteps = targetStep; // number of steps to replay

    // Fast path: we already have a cached clean entry-state for this step.
    // (Cached during an earlier reset in this session, or seeded by a prior
    // normal progression.) One WASM call replaces the full replay below.
    if (self.config.backend === 'v86' && self.emulator && self.emulator.restore_state) {
      self._showLoading('Restoring your progress\u2026');
      return self._restoreStepEntrySnapshot(targetStep).then(function (ok) {
        if (!ok) return self._restoreCommandsAndFilesSlow(saved);
        var savedStepObj = self.steps[targetStep];
        return self._syncStepFiles(savedStepObj, { setActive: false }).then(function () {
          // Await the VM-side writes of the autosaved files BEFORE running
          // post-fileload setup — otherwise `bash build-git.sh` could read
          // a stale (empty) script on 9p while the create_file is still
          // in flight.
          return self._applySavedFiles(saved.files, saved.activeFile);
        }).then(function () {
          // Replay post_fileload_setup against the student's restored files
          // (e.g. re-run build-git.sh so the VM matches the autosaved script).
          return self._runPostFileloadSetup(savedStepObj);
        }).then(function () {
          return self._refreshStepVisibleFiles(savedStepObj);
        }).then(function () {
          return self._updateUserCmdListener(savedStepObj);
        }).then(function () {
          self._autoSaveProgress();
        });
      });
    }

    return self._restoreCommandsAndFilesSlow(saved);
  };

  /**
   * Slow path for autosave restore: cold-replay every prior step's solution
   * commands, then apply the saved step's starter files and the student's
   * saved edits on top. Caches a snapshot of the clean post-replay state
   * so subsequent reset/restore of this step hit the fast path.
   */
  TutorialCode.prototype._restoreCommandsAndFilesSlow = function (saved) {
    var self = this;
    var targetStep = saved.step;
    var totalSteps = targetStep;

    // Show full-screen loading overlay for the entire replay so neither
    // the terminal commands nor intermediate file writes are visible.
    self._showLoading(
      totalSteps > 0
        ? 'Restoring your progress\u2026 (replaying ' + totalSteps + ' step' + (totalSteps === 1 ? '' : 's') + ')'
        : 'Restoring your progress\u2026'
    );

    var p = Promise.resolve();

    // Restore VM to its post-boot state so replayed commands run on a clean filesystem
    if (self._initialVMState && self.emulator && self.emulator.restore_state) {
      p = p.then(function () {
        return self.emulator.restore_state(self._initialVMState).then(function () {
          self._resetSerialState();
        });
      });
    }

    p = p.then(function () { return self._replayPriorStepsForCommands(targetStep); });

    // 4. Apply the saved step's starter files (persistent-aware).
    var savedStepObj = self.steps[targetStep];
    if (savedStepObj && savedStepObj.files) {
      p = p.then(function () { return self._syncStepFiles(savedStepObj, { setActive: false }); });
    }

    p = p.then(function () {
      return self._runStepSetupCommands(savedStepObj, { timeout: 120000 });
    });
    // Cache the clean entry state, not merely "prior steps replayed". This
    // mirrors reset: current-step setup and post-fileload setup run on starter
    // files before the student's autosaved overrides are applied below.
    p = p.then(function () { return self._runPostFileloadSetup(savedStepObj); });
    p = p.then(function () { return self._refreshStepVisibleFiles(savedStepObj); });
    p = p.then(function () { return self._updateUserCmdListener(savedStepObj); });
    p = p.then(function () { return self._runStepDir(savedStepObj); });

    // Quiesce before snapshot — see _resetStepWithCommandsSlow for rationale.
    p = p.then(function () { return self._runSilent(':'); });
    p = p.then(function () { return self._saveStepEntrySnapshot(targetStep); });

    // 5. Apply autosaved student file overrides (awaited — see
    //    _applySavedFiles docstring), run post_fileload_setup against the
    //    final editor state, then reveal the tutorial.
    p = p.then(function () {
      // The replay loop above opened every prior step's files. Clean those
      // tabs so only the current step's files remain visible after restore.
      self._closeNonStepFiles(savedStepObj);
      return self._applySavedFiles(saved.files, saved.activeFile);
    });
    p = p.then(function () {
      self._suppressAutoSave = false;
      // Persist the correctly-restored state immediately so a crash/reload
      // right after restore doesn't revert to starter-file content.
      self._autoSaveProgress();
    });
    p = p.then(function () { return self._runPostFileloadSetup(savedStepObj); });
    p = p.then(function () { return self._refreshStepVisibleFiles(savedStepObj); });
    p = p.then(function () { return self._updateUserCmdListener(savedStepObj); });

    return p;
  };

  // ---------------------------------------------------------------------------
  // Tutorial Steps
  // ---------------------------------------------------------------------------
  TutorialCode.prototype.loadStep = function (index) {
    if (index < 0 || index >= this.steps.length) return;
    // Block navigation to locked steps (unless instructor mode)
    if (!this.instructorMode && !this._stepsUnlocked.has(index)) return;

    if (window.TutorChat) { window.TutorChat.onStepChange(); }
    // Time-travel debugger: clear history + close any active debug session.
    // Breakpoints persist across steps (matches VS Code), but per-run state
    // does not. No-op when debugger is not loaded.
    if (this.debuggerEnabled && window.SEBookDebugger) {
      window.SEBookDebugger.onStepChange(this);
    }

    var firstVisit = !this._stepsVisited.has(index);
    this._stepsVisited.add(index);
    this.currentStep = index;
    var step = this.steps[index];

    if (this.quizPanelEl) this.quizPanelEl.style.display = 'none';
    if (this.stepContentWrapEl) this.stepContentWrapEl.style.display = '';

    this._renderStepNav();

    var html = '<h2>' + this._escapeHtml(step.title) + '</h2>';
    html += '<div class="tvm-step-instructions">' +
      this._stepInstructionsHTML(step) + '</div>';
    this.stepContentEl.innerHTML = html;
    this._initTooltips(this.stepContentEl);
    if (this.stepContentWrapEl) this.stepContentWrapEl.scrollTop = 0;

    // Render any inline UML diagrams embedded in the instructions markdown
    if (window.UMLShared && UMLShared.renderAll) UMLShared.renderAll();
    this._renderInlineMermaid(this.stepContentEl);
    // Initialize any inline GitCommandLab widgets embedded in the instructions
    if (window.GitCommandLab) {
      if (GitCommandLab.initFrom) GitCommandLab.initFrom(this.stepContentEl);
      if (GitCommandLab.initFromMulti) GitCommandLab.initFromMulti(this.stepContentEl);
    }

    this._renderStepControls(index);
    this._clearStudentTestPanel();
    this._updatePreviewTestButton();

    var self = this;

    // Persist any pending edits to localStorage before changing the tab set,
    // so revisits can recover the student's work. Skipped during the boot-time
    // restore sequence (which sets _suppressAutoSave for the same reason).
    if (this.autoSaveEnabled && !this._suppressAutoSave) this._autoSaveProgress();

    // Close any open files that aren't part of this step. The underlying VM
    // filesystem is untouched, so terminal commands (`cat`, etc.) can still
    // read those files.
    this._closeNonStepFiles(step);

    // Pull autosaved overrides so re-opening a file shows the student's
    // last saved edits instead of the YAML starter content.
    var savedOverrides = {};
    if (this.autoSaveEnabled) {
      try {
        var raw = localStorage.getItem(this._storageKey());
        if (raw) {
          var parsed = JSON.parse(raw);
          if (parsed && parsed.files) savedOverrides = parsed.files;
        }
      } catch (e) { /* ignore */ }
    }

    if (step.files) {
      self._suppressAutoSave = true;
      step.files.forEach(function (f) {
        if (!self.editorModels[f.path]) {
          var override = savedOverrides[f.path];
          var content = (override && typeof override.content === 'string')
            ? override.content
            : f.content;
          self.openFile(f.path, content, f.language, f);
          self._syncFileToBackend(f.path);
          self._originalContent[f.path] = f.content || '';
        }
      });
      self._suppressAutoSave = false;
    }
    if (step.open_file) { self._setActiveFile(step.open_file); self._renderTabs(); }

    // Broadcast step change to any open popups (instructions popup updates content,
    // tab popups detect orphaned files via fileList).
    self._broadcastStepState();

    // Keep the shell-side user-command listener in sync with the current step,
    // independent of firstVisit vs. revisit.
    if (!self._isBackgroundSyncPaused()) {
      self._updateUserCmdListener(step);
    }

    var hasSetup = firstVisit && step.setup_commands && step.setup_commands.length > 0;
    var hasPostFileload = firstVisit && (
      (this.postFileloadSetupCommands && this.postFileloadSetupCommands.length > 0) ||
      (step.post_fileload_setup && step.post_fileload_setup.length > 0)
    );
    var visibleFilesRefreshScheduled = false;
    if (self._isBackgroundSyncPaused()) {
      visibleFilesRefreshScheduled = true;
    } else if ((hasSetup || hasPostFileload) &&
        (this.config.backend === 'v86' || this.config.backend === 'webcontainer')) {
      visibleFilesRefreshScheduled = true;
      // Run all setup_commands silently in a single shell invocation. The
      // terminal is covered by a scoped overlay during the run; instructions
      // and the git-graph panel stay interactive. Bash skips this line at
      // history-insert time because _runSilent appends a "#__SIL_<id>"
      // marker that matches the boot-time HISTIGNORE pattern.
      self._showTerminalLoading('Preparing step\u2026');
      var p = Promise.resolve();
      if (hasSetup) {
        var setupBatch = tutorialShellBatch(step.setup_commands.map(function (c) { return String(c).trim(); }));
        p = p.then(function () { return self._runSilent(setupBatch); });
      }
      // post_fileload_setup runs AFTER setup_commands. For git-playground this
      // is where `bash build-git.sh` replays the just-synced script on top of
      // the freshly-booted VM.
      if (hasPostFileload) {
        p = p.then(function () { return self._runPostFileloadSetup(step); });
      }
      p.then(function () {
        return self._refreshStepVisibleFiles(step, { includeStepFiles: false });
      }).then(function () {
        return self._runStepDir(step);
      }).then(function () {
        var cachePromise = Promise.resolve();
        // Cache the clean "entry state" of this step so future Reset /
        // autosave-restore operations can skip replay entirely. The snapshot
        // is taken after setup/post-fileload and the final step_dir barrier.
        if (self._canCacheLiveStepEntrySnapshot(index)) {
          cachePromise = self._saveStepEntrySnapshot(index, { persist: false });
        }
        return cachePromise;
      }).then(function () {
        self._hideTerminalLoading();
        self._refreshGitGraph && self._refreshGitGraph();
      });
    } else if (firstVisit && step.setup_commands && step.setup_commands.length > 0) {
      visibleFilesRefreshScheduled = true;
      if (this.config.backend === 'pyodide') {
        this._postWorker({ type: 'runCode', code: step.setup_commands.join('\n'), silent: true });
      } else if (this.config.backend === 'prolog') {
        this._postWorker({ type: 'runProlog', code: step.setup_commands.join('\n'), silent: true });
      } else if (this.config.backend === 'java') {
        this._postWorker({ type: 'runCode', code: step.setup_commands.join('\n'), silent: true });
      }
      self._refreshStepVisibleFiles(step, { includeStepFiles: false });
    }
    if (!visibleFilesRefreshScheduled) {
      self._refreshStepVisibleFiles(step, { includeStepFiles: false });
    }

    if (this.config.backend === 'v86' && !this._isBackgroundSyncPaused()) this._startFileWatch(2000);

    // step_dir: cd to the configured directory if not already there.
    // Runs visibly in the terminal so the user sees their prompt land in the
    // right place. Skipped when setup_commands already handled the cd above,
    // and skipped when the terminal is paused (background sync / snapshot replay).
    if (step.step_dir && !self._isBackgroundSyncPaused() &&
        (this.config.backend === 'v86' || this.config.backend === 'webcontainer') &&
        !(hasSetup || hasPostFileload)) {
      self._runSilent('[ "$(pwd)" = ' + shellQuote(step.step_dir) + ' ] || cd ' + shellQuote(step.step_dir));
    }

    // Configure query input for Prolog backend
    if (this.config.backend === 'prolog') {
      var plArgsInp = this.root.querySelector('.tvm-args-input');
      var plArgsLbl = this.root.querySelector('.tvm-args-label');
      if (plArgsInp) {
        plArgsInp.style.display = 'inline-block';
        plArgsInp.style.minWidth = '260px';
        plArgsInp.style.flex = '1';
        plArgsInp.placeholder = 'e.g. parent(tom, X)';
        plArgsInp.value = step.default_query || '';
        plArgsInp.title = 'Prolog query (without trailing period)';
      }
      if (plArgsLbl) {
        plArgsLbl.style.display = 'inline-block';
        plArgsLbl.textContent = '?-';
        plArgsLbl.style.fontSize = '13px';
        plArgsLbl.style.fontWeight = '600';
      }
    }

    // Configure args and filter visibility
    if (this.config.backend === 'pyodide') {
      var argsInp = this.root.querySelector('.tvm-args-input');
      var argsLbl = this.root.querySelector('.tvm-args-label');
      var filterSel = this.root.querySelector('.tvm-stream-filter');
      if (argsInp) {
        argsInp.style.display = step.has_args ? 'inline-block' : 'none';
        argsInp.value = '';
      }
      if (argsLbl) {
        argsLbl.style.display = step.has_args ? 'inline-block' : 'none';
      }
      if (filterSel) {
        filterSel.style.display = step.has_stderr ? 'inline-block' : 'none';
        filterSel.value = 'all';
        var c = this.root.querySelector('.tvm-output-container');
        if (c) c.classList.remove('tvm-filter-stdout-only', 'tvm-filter-stderr-only');
      }
    }

    // Clear output panel between steps
    if (this.config.backend === 'pyodide' || this.config.backend === 'browser' || this.config.backend === 'webcontainer' || this.config.backend === 'prolog' || this.config.backend === 'java') this._clearOutput();
    // Rebuild React preview when a new step is loaded
    if (this.config.backend === 'react') {
      var stepSelf = this;
      setTimeout(function () { stepSelf._rebuildReactPreview(); }, 400);
    }

    // Configure HTTP client visibility (persistent sidebar panel)
    if (this._httpViewEl) {
      this._httpViewEl.style.display = step.http_client ? 'flex' : 'none';
      if (this._httpSplitterEl) {
        this._httpSplitterEl.style.display = step.http_client ? 'block' : 'none';
      }
      if (step.http_client) {
        var showBody = step.http_show_body !== false;
        if (showBody) this._initHttpBodyEditor();
        if (this._httpBodyHeaderEl) this._httpBodyHeaderEl.style.display = showBody ? '' : 'none';
        if (this._httpBodyContainerEl) this._httpBodyContainerEl.style.display = showBody ? '' : 'none';
        // Pre-fill URL and method if specified in the step
        if (this._httpUrlEl) this._httpUrlEl.value = step.http_url || 'http://localhost:3000/';
        if (this._httpMethodEl) this._httpMethodEl.value = step.http_method || 'GET';
      }
    }

    // Per-step UML class layout override (falls back to global setting)
    if (step.uml_class_layout) {
      this._umlClassLayoutPreference = step.uml_class_layout;
    } else {
      this._umlClassLayoutPreference = this._umlClassLayoutDefault;
    }

    // Per-step UML hide flags (e.g. ['visibility', 'multiplicity'])
    this._umlHideFlags = step.uml_hide || [];

    // Update UML watched files for this step
    if (this._umlDiagramEnabled) {
      if (step.uml_files && step.uml_files.length > 0) {
        this._umlWatchedFiles = step.uml_files.slice();
      } else if (step.files) {
        // Fallback: derive from step's source files that UML inference supports.
        this._umlWatchedFiles = step.files
          .filter(function (f) { return f.path && /\.(py|js|jsx|ts|tsx|java)$/.test(f.path); })
          .map(function (f) { return f.path; });
      } else {
        this._umlWatchedFiles = [];
      }
      this._umlLastDiagrams = null;
      this._umlAnalysisRequestId++;  // invalidate any in-flight analysis from the previous step
      this._umlRenderRequestId++;    // and any in-flight render
      this._renderTabs();  // Update tab bar to show/hide UML tab
    }

    // Switch view between editor, git graph, or UML diagram based on step config.
    // If the step explicitly sets `view:`, auto-switch + update toggle.
    // If not, keep whichever view the user was on (manual toggle persists).
    var shouldShowUml = (step.view === 'uml_diagram' && this._umlDiagramEnabled) ||
      (this._umlDefaultView && this._umlDiagramEnabled && this._umlWatchedFiles.length > 0 && !step.view);
    if (shouldShowUml) {
      this._umlViewActive = true;
      this._showDiagramHideEditor();
      this._refreshUMLDiagram();
      this._renderTabs();
    } else if (step.view) {
      this._umlViewActive = false;
      this._showEditorHideDiagram();
      this._setView(step.view);
    } else if (this._umlDefaultView && this._umlDiagramEnabled && this._umlWatchedFiles.length === 0) {
      // Step has no UML files — fall back to output
      this._umlViewActive = false;
      this._showEditorHideDiagram();
    } else if (this._umlViewActive && this._umlDiagramEnabled) {
      // UML view persists across steps — refresh with new watched files
      this._refreshUMLDiagram();
    }

    // Update URL hash to reflect current step key (if defined)
    this._updateStepHash(index);

    // Auto-save progress when navigating to a new step
    if (this.autoSaveEnabled) this._autoSaveProgress();
  };

  // Update the URL hash to the current step's key (or clear it for step 0 without a key)
  TutorialCode.prototype._updateStepHash = function (index) {
    var step = this.steps[index];
    var hash = (step && step.key) ? '#' + encodeURIComponent(step.key) : '';
    if (window.location.hash !== hash) {
      history.replaceState(null, '', hash || window.location.pathname + window.location.search);
    }
  };

  // Resolve a URL hash to a step index. Returns -1 if no match.
  TutorialCode.prototype._resolveStepFromHash = function () {
    var hash = window.location.hash;
    if (!hash || hash.length < 2) return -1;
    var key = decodeURIComponent(hash.substring(1));
    for (var i = 0; i < this.steps.length; i++) {
      if (this.steps[i].key === key) return i;
    }
    return -1;
  };

  TutorialCode.prototype._renderStepNav = function () {
    var self = this;
    this.stepNavEl.innerHTML = '';

    // Communicate progress at every step without stealing focus.
    var totalSteps = this.steps.length;
    var currentStepNumber = this.currentStep + 1;

    var statusEl = document.createElement('output');
    statusEl.className = 'tvm-step-status';
    statusEl.setAttribute('role', 'status');
    statusEl.setAttribute('aria-live', 'polite');
    statusEl.textContent = 'Step ' + currentStepNumber + ' of ' + totalSteps;
    this.stepNavEl.appendChild(statusEl);

    this.steps.forEach(function (step, i) {
      var btn = document.createElement('button');
      var unlocked = self.instructorMode || self._stepsUnlocked.has(i);
      btn.className = 'tvm-step-btn' + (i === self.currentStep ? ' active' : '') + (unlocked ? '' : ' locked');
      btn.textContent = i + 1;
      var srLabel = unlocked
        ? 'Step ' + (i + 1) + ': ' + step.title
        : 'Step ' + (i + 1) + ': ' + step.title + ' (locked, complete the previous step to unlock)';
      btn.title = unlocked ? step.title : step.title + ' (locked)';
      btn.setAttribute('aria-label', srLabel);
      if (i === self.currentStep) btn.setAttribute('aria-current', 'step');
      if (unlocked) {
        btn.addEventListener('click', function () { self.loadStep(i); });
      } else {
        btn.disabled = true;
      }
      self.stepNavEl.appendChild(btn);
    });
  };

  // ---------------------------------------------------------------------------
  // Step Controls
  // ---------------------------------------------------------------------------
  TutorialCode.prototype._renderStepControls = function (index) {
    var self = this;
    var step = this.steps[index];
    var nextStepUnlocked = !this.requireTests || this.instructorMode || this._stepsUnlocked.has(index + 1);
    var nextLocked = !nextStepUnlocked;

    var html = '';
    html += index > 0
      ? '<button class="tvm-btn tvm-btn-prev" title="Previous step">\u2190 Previous</button>'
      : '<span></span>';
    html += this._stepHasTests(step)
      ? '<button class="tvm-btn tvm-btn-test" title="Run the tests for this step">\u2713 Test My Work</button>'
      : '<span></span>';
    var hasUnpassedQuiz = !this.disableQuiz && step.quiz && step.quiz.questions
      && step.quiz.questions.length > 0 && !this._quizPassed.has(index);
    var hasNextStep = index < this.steps.length - 1;
    var showNext = hasNextStep || hasUnpassedQuiz;
    html += showNext
      ? '<button class="tvm-btn tvm-btn-next"' + (nextLocked ? ' disabled title="Pass all tests to continue"' : ' title="Next step"') + '>Next \u2192</button>'
      : '<span></span>';

    this.stepControlsEl.innerHTML = html;

    var prev = this.stepControlsEl.querySelector('.tvm-btn-prev');
    var next = this.stepControlsEl.querySelector('.tvm-btn-next');
    var test = this.stepControlsEl.querySelector('.tvm-btn-test');
    if (prev) prev.addEventListener('click', function () { self.loadStep(index - 1); });
    if (next) next.addEventListener('click', function () {
      if (next.disabled) return;
      var hasQuiz = !self.disableQuiz && step.quiz && step.quiz.questions && step.quiz.questions.length > 0;
      if (hasQuiz && !self._quizPassed.has(index)) {
        self._showStepQuiz(index);
      } else {
        // Unlock the next step now (for non-test-gated steps; test-gated steps
        // unlock on passing, quiz-gated steps unlock in the quiz continue handler).
        self._stepsUnlocked.add(index + 1);
        if (self.autoSaveEnabled) self._autoSaveProgress();
        self.loadStep(index + 1);
      }
    });
    if (test) test.addEventListener('click', function () { self._runTests(); });
  };

  // ---------------------------------------------------------------------------
  // Quiz — engine lives in js/tutorial-quiz.js (SebookQuiz). Same module
  // drives the popup so quizzes work identically in both windows.
  // ---------------------------------------------------------------------------
  TutorialCode.prototype._showStepQuiz = function (stepIndex) {
    var self = this;
    var step = this.steps[stepIndex];
    var quiz = step && step.quiz;
    if (!quiz || !quiz.questions || !quiz.questions.length) return;
    if (this.stepContentWrapEl) this.stepContentWrapEl.style.display = 'none';

    // Build HTML once and cache so the popup can be sent the *exact* same
    // shuffled rendering if the user clicked Next there.
    var isFinalQuiz = stepIndex === this.steps.length - 1;
    var html = window.SebookQuiz.buildHTML({
      stepIndex: stepIndex, quiz: quiz, isFinalQuiz: isFinalQuiz,
      escapeHtml: this._escapeHtml.bind(this),
      renderMarkdown: this._renderMarkdown.bind(this),
    });
    html = this._autoAbbrHtml(html);
    this._lastQuizHTML = { stepIndex: stepIndex, html: html, minScore: quiz.min_score, isFinalQuiz: isFinalQuiz };

    if (this.quizPanelEl) {
      this.quizPanelEl.style.display = '';
      window.SebookQuiz.mount({
        hostEl: this.quizPanelEl,
        controlsEl: this.stepControlsEl,
        stepIndex: stepIndex,
        quizHTML: html,
        minScore: quiz.min_score !== undefined ? quiz.min_score : 0.8,
        isFinalQuiz: isFinalQuiz,
        onPass: function (idx) { self._completeQuiz(idx); },
      });
      this._initTooltips(this.quizPanelEl);
    }
    this.stepControlsEl.innerHTML =
      '<button class="tvm-btn tvm-btn-prev tvm-quiz-back" title="Back to step">\u2190 Back to Step</button>' +
      '<span class="tvm-quiz-status" role="status" aria-live="polite" aria-atomic="true">Question 1\u2009/\u2009' + quiz.questions.length + '</span>' +
      '<span></span>';
    var back = this.stepControlsEl.querySelector('.tvm-quiz-back');
    if (back) back.addEventListener('click', function () { self._hideStepQuiz(); });

    // Mirror the quiz to any open instructions popup so users can take it
    // in either window. Popup mounts SebookQuiz with the same HTML and
    // posts back 'quiz-passed' on completion (handled in main below).
    if (this._popoutManager && this._popoutManager.isAvailable()) {
      this._popoutManager._post('quiz-show', {
        stepIndex: stepIndex,
        quizHTML: html,
        minScore: quiz.min_score !== undefined ? quiz.min_score : 0.8,
        isFinalQuiz: isFinalQuiz,
      });
    }
  };

  TutorialCode.prototype._hideStepQuiz = function () {
    if (this.quizPanelEl) this.quizPanelEl.style.display = 'none';
    if (this.stepContentWrapEl) this.stepContentWrapEl.style.display = '';
    this._renderStepControls(this.currentStep);
    if (this._popoutManager) this._popoutManager._post('quiz-hide');
  };

  // Apply the side effects of a passed quiz, regardless of which window the
  // user took it in. Called from main's onPass hook AND from the
  // BroadcastChannel quiz-passed handler when the popup completes one.
  TutorialCode.prototype._completeQuiz = function (stepIndex) {
    this._quizPassed.add(stepIndex);
    this._stepsUnlocked.add(stepIndex + 1);
    if (this.autoSaveEnabled) this._autoSaveProgress();
    var hasNextStep = stepIndex + 1 < this.steps.length;
    if (hasNextStep) {
      if (this.quizPanelEl && this.quizPanelEl.style.display !== 'none') this._hideStepQuiz();
      this.loadStep(stepIndex + 1);
    }
  };

  // Legacy aliases — keep the old method names as thin wrappers so any
  // external caller (or future me grepping) still resolves.
  TutorialCode.prototype._shuffleArray = function (arr) {
    return window.SebookQuiz.shuffle(arr);
  };
  TutorialCode.prototype._buildQuizHTML = function (stepIndex, quiz) {
    return this._autoAbbrHtml(window.SebookQuiz.buildHTML({
      stepIndex: stepIndex, quiz: quiz,
      escapeHtml: this._escapeHtml.bind(this),
      renderMarkdown: this._renderMarkdown.bind(this),
    }));
  };

  // ---------------------------------------------------------------------------
  // Markdown + HTML utilities
  // ---------------------------------------------------------------------------
  TutorialCode.prototype._stepInstructionsHTML = function (step) {
    if (!step) return '';
    return this._autoAbbrHtml(step.instructionsHTML || this._renderMarkdown(step.instructions || ''));
  };

  TutorialCode.prototype._renderMarkdown = function (text) {
    if (!text) return '';
    return window.marked ? window.marked.parse(text)
      : text.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n\n/g, '<br><br>');
  };

  // Convert ```mermaid fences embedded in instruction markdown into rendered SVG.
  // Delegates to SebookMermaid (js/mermaid-theme.js), which centralizes the
  // theme + renderer used across every page that displays mermaid.
  TutorialCode.prototype._renderInlineMermaid = function (rootEl) {
    if (window.SebookMermaid && window.SebookMermaid.render) {
      window.SebookMermaid.render(rootEl);
    }
  };

  TutorialCode.prototype._autoAbbrHtml = function (html) {
    if (!html) return '';
    var glossary = window.SEBookGlossaryAbbr || [];
    if (!glossary.length) return html;

    if (!this._autoAbbrMatcher) this._autoAbbrMatcher = this._buildAutoAbbrMatcher(glossary);
    var matcher = this._autoAbbrMatcher;
    if (!matcher || !matcher.regex) return html;

    var skipTags = {
      a: true, abbr: true, button: true, code: true, kbd: true, option: true,
      pre: true, samp: true, script: true, select: true, style: true,
      svg: true, textarea: true,
      h1: true, h2: true, h3: true, h4: true, h5: true, h6: true,
    };
    var voidTags = {
      area: true, base: true, br: true, col: true, embed: true, hr: true,
      img: true, input: true, link: true, meta: true, param: true,
      source: true, track: true, wbr: true,
    };
    var skipStack = [];

    function openingName(tag) {
      if (/^<\s*(?:\/|!|\?)/.test(tag)) return null;
      var match = tag.match(/^<\s*([A-Za-z][\w:-]*)/);
      return match ? match[1].toLowerCase() : null;
    }
    function closingName(tag) {
      var match = tag.match(/^<\s*\/\s*([A-Za-z][\w:-]*)/);
      return match ? match[1].toLowerCase() : null;
    }
    function isVoid(name, tag) {
      return !!voidTags[name] || /\/\s*>$/.test(tag);
    }
    function startsSkip(name, tag) {
      return !!skipTags[name] ||
        /\bid\s*=\s*(['"])references\1/i.test(tag) ||
        /\bclass\s*=\s*(['"])[^'"]*\bbibliography\b/i.test(tag);
    }
    function escapeAttr(value) {
      var div = document.createElement('div');
      div.textContent = value == null ? '' : String(value);
      return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function replaceText(text) {
      return text.replace(matcher.regex, function (_, prefix, word) {
        var entry = matcher.forms[word];
        if (!entry) return prefix + word;
        return prefix + '<abbr title="' +
          escapeAttr(entry.definition) + '" data-no-tooltip="true">' + word + '</abbr>';
      });
    }

    return String(html).split(/(<[^>]+>)/g).map(function (token) {
      if (token.charAt(0) !== '<') {
        return skipStack.length ? token : replaceText(token);
      }

      var closing = closingName(token);
      if (closing) {
        if (skipStack[skipStack.length - 1] === closing) skipStack.pop();
        return token;
      }

      var name = openingName(token);
      if (!name || isVoid(name, token)) return token;
      if (skipStack.length) skipStack.push(name);
      else if (startsSkip(name, token)) skipStack.push(name);
      return token;
    }).join('');
  };

  TutorialCode.prototype._buildAutoAbbrMatcher = function (glossary) {
    var forms = {};
    function escapeRegex(value) {
      return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    glossary.forEach(function (entry) {
      if (!entry || !entry.term || !entry.definition) return;
      var term = String(entry.term);
      forms[term] = entry;
      if (!/[sS]$/.test(term)) forms[term + 's'] = entry;
    });

    var alternatives = Object.keys(forms).sort(function (a, b) {
      return b.length - a.length || a.localeCompare(b);
    }).map(escapeRegex);

    if (!alternatives.length) return null;
    return {
      forms: forms,
      regex: new RegExp('(^|[^A-Za-z0-9_])(' + alternatives.join('|') + ')(?=$|[^A-Za-z0-9_])', 'g'),
    };
  };

  TutorialCode.prototype._initTooltips = function (rootEl) {
    if (!rootEl || !window.jQuery || !jQuery.fn || !jQuery.fn.tooltip) return;
    jQuery(rootEl)
      .find('[data-toggle="tooltip"], [title]:not([data-no-tooltip])')
      .tooltip({
        trigger: 'hover focus',
        delay: { show: 100, hide: 250 },
        container: 'body',
        viewport: { selector: 'body', padding: 8 },
        placement: function (_tip, element) {
          var rect = element.getBoundingClientRect();
          return rect.top < 80 ? 'bottom' : 'auto top';
        },
      });
  };

  TutorialCode.prototype._escapeHtml = function (str) {
    var d = document.createElement('div'); d.textContent = str;
    return d.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  // ---------------------------------------------------------------------------
  // Test Runner — dispatches per backend
  // ---------------------------------------------------------------------------
  TutorialCode.prototype._runTests = function () {
    if (this._popoutManager) this._popoutManager.broadcastTestStarted();
    var backend = this.config.backend;
    if (backend === 'v86') this._runTestsV86();
    else if (backend === 'pyodide') this._runTestsPyodide();
    else if (backend === 'webcontainer') this._runTestsWebContainer();
    else if (backend === 'react') this._runTestsReact();
    else if (backend === 'browser') this._runTestsBrowser();
    else if (backend === 'sql') this._runTestsSQL();
    else if (backend === 'prolog') this._runTestsProlog();
    else if (backend === 'java') this._runTestsJava();
  };

  // v86 test runner — marker-delimited output from the interactive shell.
  TutorialCode.prototype._runTestsV86 = function () {
    var self = this;
    var step = this.steps[this.currentStep];
    var tests = step && step.tests;
    if (!tests || !tests.length) return;

    // Disable the test button while a run is in-flight.  Without this,
    // rapid clicks each do _muteCount++ but only the last run's callbacks
    // survive (the rest are overwritten), so _muteCount never returns to
    // 0 and the terminal stays permanently muted.
    var testBtn = this.stepControlsEl && this.stepControlsEl.querySelector('.tvm-btn-test');
    if (testBtn) testBtn.disabled = true;

    this._showTestPanel('<div class="tvm-test-running"><div class="tvm-test-spinner"></div>Running tests\u2026</div>');
    var parts = [];
    tests.forEach(function (t, i) {
      parts.push('( ' + t.command + ' ) 2>/dev/null; echo "__TRESULT_' + i + '_$?__"');
    });
    parts.push('echo "__T""DONE__"');
    this._testResults = new Array(tests.length).fill(null);
    this._testBuffer = '';
    this._testListening = true;
    this._muteCount++;
    this._testCallbacks = [
      function () { self._muteCount--; },
      function () { self._renderTestResults(tests, self._testResults); },
      function () { if (testBtn) testBtn.disabled = false; },
    ];
    var safetyTimer = setTimeout(function () {
      if (self._testListening) {
        self._testListening = false; self._testBuffer = ''; self._muteCount--;
        self._renderTestResults(tests, self._testResults);
        if (testBtn) testBtn.disabled = false;
      }
    }, 15000);
    this._testCallbacks.push(function () { clearTimeout(safetyTimer); });
    this.sendCommand(' ' + parts.join('; '));
  };

  TutorialCode.prototype._parseTestOutput = function () {
    if (!this._testBuffer.includes('__TDONE__')) return;
    var re = /__TRESULT_(\d+)_(\d+)__/g, match;
    while ((match = re.exec(this._testBuffer)) !== null) {
      var idx = parseInt(match[1], 10), code = parseInt(match[2], 10);
      if (idx < this._testResults.length) this._testResults[idx] = (code === 0);
    }
    this._testListening = false; this._testBuffer = '';
    var cbs = this._testCallbacks.splice(0);

    // Stay muted until the shell prompt that follows __TDONE__ has been
    // consumed, then unmute.  This prevents the prompt from leaking an
    // extra line into the terminal.
    var self = this;
    var promptBuf = '';
    function waitForPrompt(byte) {
      promptBuf += String.fromCharCode(byte);
      if (promptBuf.includes('# ') || promptBuf.includes('$ ')) {
        self.emulator.remove_listener('serial0-output-byte', waitForPrompt);
        clearTimeout(promptTimer);
        cbs.forEach(function (cb) { cb(); });
      }
    }
    self.emulator.add_listener('serial0-output-byte', waitForPrompt);
    var promptTimer = setTimeout(function () {
      self.emulator.remove_listener('serial0-output-byte', waitForPrompt);
      cbs.forEach(function (cb) { cb(); });
    }, 3000);
  };

  // SQL — each test.command is a JS snippet with __run_query / assert helpers
  TutorialCode.prototype._runTestsSQL = function () {
    var self = this;
    var step = this.steps[this.currentStep];
    var tests = step && step.tests;
    if (!tests || !tests.length) return;
    this._showTestPanel('<div class="tvm-test-running"><div class="tvm-test-spinner"></div>Running tests\u2026</div>');
    var results = [];
    var testTimeout;

    function runNext(i) {
      clearTimeout(testTimeout);
      if (i >= tests.length) { self._renderTestResults(tests, results); return; }

      // 15s timeout for infinite loops within AsyncFunction test execution
      testTimeout = setTimeout(function () {
        console.warn('SQL test execution timed out. Infinite loop suspected.');
        if (self.term) {
          self.term.write('\n\r\n\r\x1b[31;1mError: Execution timed out (15s).\x1b[0m\n\r');
          self.term.write('\x1b[33mIf you wrote an infinite loop, your sandbox is permanently gridlocked and you MUST refresh the page to continue!\x1b[0m\n\r');
        }
        self._renderTestResults(tests, new Array(tests.length).fill(null));
      }, 15000);

      self._postWorker(
        { type: 'runCode', code: tests[i].command, silent: true },
        function (msg) { results[i] = (msg.exitCode === 0); runNext(i + 1); }
      );
    }
    runNext(0);
  };

  // Java — each test.command is run as Java code; exit 0 if no exception
  TutorialCode.prototype._runTestsJava = function () {
    var self = this;
    var step = this.steps[this.currentStep];
    var tests = step && step.tests;
    if (!tests || !tests.length) return;
    this._showTestPanel('<div class="tvm-test-running"><div class="tvm-test-spinner"></div>Running tests\u2026</div>');
    var results = [];
    var testTimeout;

    // Gather all editor source code for source_must_contain / source_must_not_contain checks
    var editorCode = '';
    var models = self.editorModels;
    for (var fname in models) {
      if (models.hasOwnProperty(fname)) {
        editorCode += models[fname].model.getValue() + '\n';
      }
    }

    function checkSource(test) {
      var mc = test.source_must_contain;
      if (mc) {
        var patterns = Array.isArray(mc) ? mc : [mc];
        for (var p = 0; p < patterns.length; p++) {
          if (editorCode.indexOf(patterns[p]) === -1) return false;
        }
      }
      var mnc = test.source_must_not_contain;
      if (mnc) {
        var patterns = Array.isArray(mnc) ? mnc : [mnc];
        for (var p = 0; p < patterns.length; p++) {
          if (editorCode.indexOf(patterns[p]) !== -1) return false;
        }
      }
      return true;
    }

    function runNext(i) {
      clearTimeout(testTimeout);
      if (i >= tests.length) { self._renderTestResults(tests, results); return; }

      var test = tests[i];

      // Source-code assertions: fail immediately if patterns don't match
      if ((test.source_must_contain || test.source_must_not_contain) && !checkSource(test)) {
        results[i] = false;
        runNext(i + 1);
        return;
      }

      // No runtime command — pass on source check alone
      if (!test.command) {
        results[i] = true;
        runNext(i + 1);
        return;
      }

      testTimeout = setTimeout(function () {
        console.warn('Java test execution timed out.');
        self._renderTestResults(tests, new Array(tests.length).fill(null));
      }, 30000);

      self._postWorker(
        { type: 'runCode', code: test.command, silent: true },
        function (msg) { results[i] = (msg.exitCode === 0); runNext(i + 1); }
      );
    }
    runNext(0);
  };

  // Prolog — each test.command is a JS snippet with __query / __consult / assert
  TutorialCode.prototype._runTestsProlog = function () {
    var self = this;
    var step = this.steps[this.currentStep];
    var tests = step && step.tests;
    if (!tests || !tests.length) return;
    this._showTestPanel('<div class="tvm-test-running"><div class="tvm-test-spinner"></div>Running tests\u2026</div>');
    var results = [];

    // Get the active file content to send with each test
    var activeFile = this.activeFileName;
    var program = (activeFile && this.editorModels[activeFile])
      ? this.editorModels[activeFile].model.getValue() : '';

    // Sync files first, then run tests sequentially
    var filenames = Object.keys(this.editorModels);
    var syncCount = 0;
    var totalFiles = filenames.length;

    function afterSync() {
      syncCount++;
      if (syncCount < totalFiles) return;
      runNext(0);
    }

    function runNext(i) {
      if (i >= tests.length) { self._renderTestResults(tests, results); return; }
      // Each test gets a fresh consult of the program + async query execution
      self._postWorker(
        { type: 'runTest', program: program, code: tests[i].command },
        function (msg) { results[i] = (msg.exitCode === 0); runNext(i + 1); }
      );
    }

    if (totalFiles === 0) { runNext(0); return; }
    filenames.forEach(function (fn) { self._syncFileToBackend(fn, afterSync); });
  };

  // Pyodide — each test.command is run as Python code; exit 0 if no exception
  TutorialCode.prototype._runTestsPyodide = function () {
    var self = this;
    var step = this.steps[this.currentStep];
    var tests = step && step.tests;
    if (!tests || !tests.length) return;
    this._showTestPanel('<div class="tvm-test-running"><div class="tvm-test-spinner"></div>Running tests\u2026</div>');
    var results = [];
    var testTimeout;

    function runNext(i) {
      clearTimeout(testTimeout);
      if (i >= tests.length) { self._renderTestResults(tests, results); return; }

      // 30 seconds per-test timeout for spotting infinite loops
      testTimeout = setTimeout(function () {
        console.warn('Pyodide test execution timed out. Infinite loop suspected.');
        if (self.term) {
          self.term.write('\n\r\n\r\x1b[31;1mError: Execution timed out (30s).\x1b[0m\n\r');
          self.term.write('\x1b[33mIf you wrote an infinite loop (e.g. `while True:`), your sandbox is permanently gridlocked and you MUST refresh the page to continue!\x1b[0m\n\r');
        }
        self._renderTestResults(tests, new Array(tests.length).fill(null));
      }, 30000);

      self._postWorker(
        { type: 'runCode', code: tests[i].command, silent: true },
        function (msg) { results[i] = (msg.exitCode === 0); runNext(i + 1); }
      );
    }
    runNext(0);
  };

  // WebContainers — run the current Node file with real Node, then evaluate
  // the same JS assertion snippets used by the browser-backend Node tutorial.
  TutorialCode.prototype._runTestsWebContainer = function () {
    var self = this;
    var step = this.steps[this.currentStep];
    var tests = step && step.tests;
    if (!tests || !tests.length) return;
    this._showTestPanel('<div class="tvm-test-running"><div class="tvm-test-spinner"></div>Running tests\u2026</div>');

    var runFile = (step && step.run_file) ? step.run_file : this.activeFileName;
    var filename = runFile || (step.files && step.files[0] && step.files[0].path) || '';
    var source = this.editorModels[filename] ? this.editorModels[filename].model.getValue() : '';
    var files = {};
    for (var key in this.editorModels) {
      if (this.editorModels.hasOwnProperty(key)) {
        files[key] = this.editorModels[key].model.getValue();
      }
    }

    this._runWebContainerNodeFile(filename, {
      serverStep: !!(step && step.http_client),
      serverTimeout: 1500,
      timeout: 3500,
      echoOutput: false,
    }).then(function (run) {
      var output = run.output || '';
      var results = [];
      for (var i = 0; i < tests.length; i++) {
        try {
          var code = self._stripCode(source);
          /* jshint evil:true */
          var fn = new Function('output', 'source', 'code', 'assert', 'files', tests[i].command);
          fn(output, source, code, function assertFn(cond, msg) {
            if (!cond) throw new Error(msg || 'Assertion failed');
          }, files);
          results[i] = true;
        } catch (e) {
          results[i] = false;
          console.warn('WebContainer test ' + i + ' failed:', e.message);
        }
      }
      self._renderTestResults(tests, results);
    }).catch(function (err) {
      self._renderTestResults(tests, new Array(tests.length).fill(null));
      console.error('WC test run failed:', err);
    });
  };

  TutorialCode.prototype._showStudentTestPanel = function (innerHtml) {
    var panel = this.root && this.root.querySelector('.tvm-preview-test-panel');
    if (!panel) {
      this._showTestPanel(innerHtml);
      return;
    }
    panel.style.display = '';
    panel.innerHTML = innerHtml;
  };

  TutorialCode.prototype._runPlaywrightCompatSpecs = function (step) {
    var self = this;
    var testFiles = this._getPlaywrightTestFiles(step);
    if (!testFiles.length) {
      return Promise.resolve({
        tests: [{ description: 'At least one Playwright test file is present' }],
        results: [false],
      });
    }
    if (!window.SEBookPlaywrightCompat || !window.SEBookPlaywrightCompat.run) {
      return Promise.resolve({
        tests: [{ description: 'Load Playwright compatibility runner' }],
        results: [false],
      });
    }

    var files = {};
    Object.keys(this.editorModels || {}).forEach(function (filename) {
      files[filename] = self.editorModels[filename].model.getValue();
    });

    var cfg = this._playwrightStepConfig(step);
    var timeout = Number(cfg.timeout || cfg.expect_timeout || 5000);
    function rebuildPreview() {
      return new Promise(function (resolve) {
        self._rebuildReactPreview(resolve);
      });
    }

    return rebuildPreview().then(function () {
      return window.SEBookPlaywrightCompat.run({
        previewFrame: self._previewFrame,
        files: files,
        testFiles: testFiles,
        timeout: timeout,
        resetBetweenTests: cfg.reset_between_tests !== false && cfg.resetBetweenTests !== false,
        rebuildPreview: rebuildPreview,
      });
    });
  };

  TutorialCode.prototype._runStudentPlaywrightTests = function () {
    var self = this;
    var step = this.steps[this.currentStep];
    if (!this._stepHasStudentPlaywrightTests(step)) return;
    var btn = this._previewTestBtn || (this.root && this.root.querySelector('.tvm-preview-test-btn'));
    var oldLabel = btn ? btn.textContent : '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = '\u23f3 Testing\u2026';
    }

    this._showStudentTestPanel('<div class="tvm-test-running"><div class="tvm-test-spinner"></div>Running Playwright tests\u2026</div>');
    this._runPlaywrightCompatSpecs(step).then(function (run) {
      self._renderStudentTestResults(run.tests, run.results);
    }).catch(function (err) {
      console.error('Playwright compatibility run failed:', err);
      self._renderStudentTestResults([{ description: 'Run Playwright compatibility tests' }], [false]);
    }).then(function () {
      if (btn) {
        btn.disabled = false;
        btn.textContent = oldLabel || '\u2713 Test';
      }
    });
  };

  TutorialCode.prototype._checkPlaywrightExpectation = function (test, run) {
    var cfg = test.playwright || test.student_playwright || test.studentTest || {};
    var expected = cfg.expected || cfg.expect || (cfg.should_fail ? 'fail' : (cfg.should_pass === false ? 'fail' : 'pass'));
    expected = String(expected).toLowerCase();
    if (expected === 'failed') expected = 'fail';
    if (expected === 'passed') expected = 'pass';

    var tests = (run && run.tests) || [];
    var results = (run && run.results) || [];
    var targetIndex = -1;
    if (cfg.index !== undefined && cfg.index !== null) {
      targetIndex = Number(cfg.index);
    } else {
      var title = cfg.title || cfg.test_title || cfg.name || cfg.description;
      if (!title) throw new Error('Playwright expectation needs `title` or `index`');
      var exact = String(title);
      for (var i = 0; i < tests.length; i++) {
        if (tests[i] && tests[i].description === exact) { targetIndex = i; break; }
      }
      if (targetIndex < 0) {
        for (var j = 0; j < tests.length; j++) {
          if (tests[j] && tests[j].description && tests[j].description.indexOf(exact) !== -1) {
            targetIndex = j;
            break;
          }
        }
      }
    }
    if (targetIndex < 0 || targetIndex >= tests.length) {
      throw new Error('Could not find Playwright test: ' +
        (cfg.title || cfg.test_title || cfg.name || cfg.description || cfg.index));
    }
    var actualPass = results[targetIndex] === true;
    var label = tests[targetIndex] && tests[targetIndex].description || ('test #' + targetIndex);
    if (expected === 'fail') {
      if (actualPass) throw new Error('Expected Playwright test "' + label + '" to fail, but it passed');
      return true;
    }
    if (expected === 'pass') {
      if (!actualPass) throw new Error('Expected Playwright test "' + label + '" to pass, but it failed');
      return true;
    }
    throw new Error('Unknown Playwright expectation: ' + expected);
  };

  TutorialCode.prototype._runPlaywrightExpectationTest = function (test) {
    var step = this.steps[this.currentStep];
    var self = this;
    return this._runPlaywrightCompatSpecs(step).then(function (run) {
      self._checkPlaywrightExpectation(test, run);
    });
  };

  TutorialCode.prototype._runReactAssertionTests = function (tests) {
    var self = this;
    return new Promise(function (resolve) {
      // Rebuild a fresh preview, then run tests after React has settled.
      self._rebuildReactPreview(function () {
        var frame = self._previewFrame;
        var results = [];
        var AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
        var testTimeout;

        function runNext(i) {
          clearTimeout(testTimeout);
          if (i >= tests.length) { resolve(results); return; }

          testTimeout = setTimeout(function () {
            console.warn('React test execution timed out. Asynchronous promise deadlock reached.');
            if (self.term) {
              self.term.write('\n\r\n\r\x1b[31;1mError: React evaluation timed out (15s).\x1b[0m\n\r');
              self.term.write('\x1b[33mTests were unable to complete cleanly (did an awaited promise never resolve?). Please reload the page if frozen!\x1b[0m\n\r');
            }
            resolve(new Array(tests.length).fill(null));
          }, 15000);

          try {
            if (tests[i].playwright || tests[i].student_playwright || tests[i].studentTest) {
              self._runPlaywrightExpectationTest(tests[i]).then(function () {
                results[i] = true;
                runNext(i + 1);
              }).catch(function (e) {
                results[i] = false;
                console.warn('React test ' + i + ' failed:', e.message);
                runNext(i + 1);
              });
              return;
            }

            var scripts = frame.contentDocument.querySelectorAll('[type="text/babel"]');
            var source = Array.from(scripts).map(function (s) { return s.textContent; }).join('\n');
            var code = self._stripCode(source);
            /* jshint evil:true */
            var files = {};
            Object.keys(self.editorModels || {}).forEach(function (filename) {
              files[filename] = self.editorModels[filename].model.getValue();
            });
            var fn = new AsyncFunction('frame', 'code', 'assert', 'files', tests[i].command);
            fn(frame, code, function assertFn(cond, msg) {
              if (!cond) throw new Error(msg || 'Assertion failed');
            }, files).then(function () {
              results[i] = true;
              runNext(i + 1);
            }).catch(function (e) {
              results[i] = false;
              console.warn('React test ' + i + ' failed:', e.message);
              runNext(i + 1);
            });
          } catch (e) {
            results[i] = false;
            console.warn('React test ' + i + ' failed:', e.message);
            runNext(i + 1);
          }
        }
        runNext(0);
      });
    });
  };

  // React — each test.command is evaluated as JS; `frame` is the preview iframe
  TutorialCode.prototype._runTestsReact = function () {
    var step = this.steps[this.currentStep];
    var tests = step && step.tests;
    if (!tests || !tests.length) return;
    var self = this;
    this._showTestPanel('<div class="tvm-test-running"><div class="tvm-test-spinner"></div>Running tests\u2026</div>');
    this._runReactAssertionTests(tests).then(function (results) {
      self._renderTestResults(tests, results);
    });
  };

  // Browser — runs user code, collects output, then evaluates JS assertions
  // test.command receives: output (string), source (string), code (string),
  //   assert(cond, msg), files (object mapping filename -> source)
  TutorialCode.prototype._runTestsBrowser = function () {
    var self = this;
    var step = this.steps[this.currentStep];
    var tests = step && step.tests;
    if (!tests || !tests.length) return;
    this._showTestPanel('<div class="tvm-test-running"><div class="tvm-test-spinner"></div>Running tests\u2026</div>');

    // Use run_file if specified (multi-file steps), otherwise the active editor file
    var runFile = (step && step.run_file) ? step.run_file : this.activeFileName;
    var filename = runFile || (step.files && step.files[0] && step.files[0].path) || '';
    var source = this.editorModels[filename] ? this.editorModels[filename].model.getValue() : '';
    var outputLines = [];

    // Build a files object mapping each open filename -> its editor content.
    // This lets multi-file tests inspect files other than the active one,
    // e.g. assert(files['app.js'].includes('require'))
    var files = {};
    for (var key in this.editorModels) {
      if (this.editorModels.hasOwnProperty(key)) {
        files[key] = this.editorModels[key].model.getValue();
      }
    }

    this._runBrowserCode(source, function (text) {
      outputLines.push(text);
    }, function () {
      var output = outputLines.join('');
      var results = [];

      function runNext(i) {
        if (i >= tests.length) { self._renderTestResults(tests, results); return; }
        try {
          var code = self._stripCode(source);
          /* jshint evil:true */
          var fn = new Function('output', 'source', 'code', 'assert', 'files', tests[i].command);
          fn(output, source, code, function assertFn(cond, msg) {
            if (!cond) throw new Error(msg || 'Assertion failed');
          }, files);
          results[i] = true;
        } catch (e) {
          results[i] = false;
          console.warn('Browser test ' + i + ' failed:', e.message);
        }
        runNext(i + 1);
      }
      runNext(0);
    }, 3500);
  };

  // Shared helper: strips JS/JSX string literals and comments so keyword
  // searches in test assertions cannot false-match on string *contents*.
  // Handles: "...", '...', `...` (with ${} expressions preserved), // and /* */
  TutorialCode.prototype._stripCode = function (src) {
    var out = '';
    var i = 0;
    var n = src.length;
    while (i < n) {
      var c = src[i];
      if (c === '/' && i + 1 < n && src[i + 1] === '/') {         // line comment
        i += 2;
        while (i < n && src[i] !== '\n') i++;
      } else if (c === '/' && i + 1 < n && src[i + 1] === '*') {  // block comment
        i += 2;
        while (i < n && !(src[i] === '*' && i + 1 < n && src[i + 1] === '/')) i++;
        if (i < n) i += 2;
      } else if (c === '"' || c === "'") {                         // string literal
        var q = c;
        out += q; i++;
        while (i < n && src[i] !== q) {
          if (src[i] === '\\') i++;   // skip escaped char
          i++;
        }
        out += q; i++;                // closing quote, content blanked
      } else if (c === '`') {         // template literal — strip string parts, keep ${} code
        out += '`'; i++;
        while (i < n && src[i] !== '`') {
          if (src[i] === '\\') { i += 2; continue; }
          if (src[i] === '$' && i + 1 < n && src[i + 1] === '{') {
            // ${...} is executable code — pass it through verbatim
            out += '${'; i += 2;
            var depth = 1;
            while (i < n && depth > 0) {
              if (src[i] === '{') depth++;
              else if (src[i] === '}') { depth--; if (depth === 0) break; }
              out += src[i]; i++;
            }
            out += '}'; i++; // closing }
          } else {
            i++; // string content — skip (blank it out)
          }
        }
        out += '`'; i++;              // closing backtick
      } else {
        out += c; i++;
      }
    }
    return out;
  };

  TutorialCode.prototype._showTestPanel = function (innerHtml) {
    var panel = this.stepContentEl.querySelector('.tvm-test-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'tvm-test-panel';
      panel.setAttribute('role', 'status');
      panel.setAttribute('aria-live', 'polite');
      panel.setAttribute('aria-atomic', 'true');
      this.stepContentEl.appendChild(panel);
    }
    panel.innerHTML = innerHtml;
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  TutorialCode.prototype._buildTestResultsHTML = function (tests, results) {
    var self = this;
    var passed = results.filter(function (r) { return r === true; }).length;
    var total = tests.length, allPass = passed === total;
    var html = '<div class="tvm-test-results">';
    html += '<div class="tvm-test-summary ' + (allPass ? 'all-pass' : 'partial') + '">';
    html += allPass ? '\u2705 All ' + total + ' tests passed!' : passed + '\u00a0/\u00a0' + total + ' tests passed';
    html += '</div><ul class="tvm-test-list">';
    tests.forEach(function (t, i) {
      var p = results[i];
      var cls = p === true ? 'pass' : (p === false ? 'fail' : 'unknown');
      var icon = p === true ? '\u2713' : (p === false ? '\u2717' : '?');
      html += '<li class="tvm-test-item ' + cls + '"><span class="tvm-test-icon">' + icon + '</span>' +
        '<span class="tvm-test-desc">' + self._escapeHtml(t.description) + '</span></li>';
    });
    html += '</ul></div>';
    return html;
  };

  TutorialCode.prototype._renderStudentTestResults = function (tests, results) {
    var html = this._buildTestResultsHTML(tests, results);
    this._showStudentTestPanel(html);
  };

  TutorialCode.prototype._renderTestResults = function (tests, results) {
    this._testResults = results; // store for hint engine
    var passed = results.filter(function (r) { return r === true; }).length;
    var total = tests.length, allPass = passed === total;
    var html = this._buildTestResultsHTML(tests, results);
    this._showTestPanel(html);
    if (!allPass && window.TutorChat) { window.TutorChat.onTestFailure(this); }
    if (allPass && window.TutorChat) { window.TutorChat.onTestPass(); }
    if (allPass && this.requireTests) {
      this._stepsPassed.add(this.currentStep);
      this._stepsUnlocked.add(this.currentStep + 1);
      this._renderStepNav();
      var nextBtn = this.stepControlsEl.querySelector('.tvm-btn-next');
      if (nextBtn) { nextBtn.disabled = false; nextBtn.removeAttribute('title'); }
      if (this.autoSaveEnabled) this._autoSaveProgress();
    }
    if (this._popoutManager) {
      this._popoutManager.broadcastTestResult({
        resultsHTML: html,
        results: results,
        allPassed: allPass,
        stepIndex: this.currentStep,
      });
      this._broadcastNavState();
    }
  };

  // ---------------------------------------------------------------------------
  // Reverse File Sync — v86 only (polls 9p FS)
  // ---------------------------------------------------------------------------
  TutorialCode.prototype._pollWatchedFiles = function () {
    if (!this.emulator || !this.booted || this.config.backend !== 'v86') return;
    if (this._reverseSyncBusy) return;
    var self = this;
    var seen = {};
    var files = [];
    function addFile(filename) {
      if (!filename || seen[filename]) return;
      seen[filename] = true;
      files.push(filename);
    }
    Object.keys(this.editorModels).forEach(addFile);
    var step = this.steps[this.currentStep];
    if (step && step.watch_files) step.watch_files.forEach(addFile);
    if (files.length === 0) return;
    this._reverseSyncBusy = true;
    var promises = files.map(function (filename) {
      return self.emulator.read_file('/' + filename)
        .then(function (buf) {
          var res = self.emulator.fs9p.SearchPath('/' + filename);
          if (res && res.id !== -1) {
            var inode = self.emulator.fs9p.inodes[res.id];
            if (inode.mode & 0x49) {
              self._executableFiles.add(filename);
            } else {
              self._executableFiles.delete(filename);
            }
          }
          var content = new TextDecoder('utf-8').decode(buf);
          var entry = self.editorModels[filename];
          if (!entry) {
            return;
          } else if (entry.lastSyncContent !== content) {
            entry.lastSyncContent = content;
            if (entry.model.getValue() !== content) {
              self._suppressAutoSave = true;
              entry.model.setValue(content);
              self._suppressAutoSave = false;
            }
          }
        }).catch(function () { });
    });
    Promise.all(promises).then(function () { self._reverseSyncBusy = false; })
      .catch(function () { self._reverseSyncBusy = false; });
  };

  TutorialCode.prototype.refreshOpenFiles = function () { this._pollWatchedFiles(); };

  TutorialCode.prototype._startFileWatch = function (intervalMs) {
    var self = this;
    this._stopFileWatch();
    this._reverseSyncTimer = setInterval(function () {
      if (self.booted && !self._isBackgroundSyncPaused()) self._pollWatchedFiles();
    }, intervalMs || 2000);
  };

  TutorialCode.prototype._stopFileWatch = function () {
    if (this._reverseSyncTimer) { clearInterval(this._reverseSyncTimer); this._reverseSyncTimer = null; }
  };

  // ---------------------------------------------------------------------------
  // Git Graph Integration
  // ---------------------------------------------------------------------------

  /**
   * Switch the top-right panel between editor and git graph.
   * @param {string} view - 'editor' or 'git_graph'
   */
  TutorialCode.prototype._setView = function (view) {
    var editorPanel = this.root.querySelector('.tvm-editor-panel');
    var graphPanel = this.gitGraphPanelEl;
    if (!editorPanel) return;

    if (view === 'git_graph' && graphPanel) {
      editorPanel.style.display = 'none';
      graphPanel.style.display = 'flex';
      // For pyodide tutorials, default the bottom panel to the Terminal tab
      // when the user enters graph view (their next action is almost always
      // to type a git command). Editor view leaves the tab as the user left
      // it. xterm.fit() runs inside _showOutputTermPanel after the tab swap.
      var self2 = this;
      if (this.gitGraphPath && this.config.backend !== 'v86') {
        this._showOutputTermPanel('terminal');
      }
      // Immediately show the last cached graph (avoids "No commits yet" flash)
      this._lightRefreshGitGraph();
      // Then schedule a full dump+read for fresh data
      setTimeout(function () {
        self2._refreshGitGraph();
        setTimeout(function () { self2._refreshGitGraph(); }, 1500);
      }, 800);
    } else {
      editorPanel.style.display = '';
      if (graphPanel) graphPanel.style.display = 'none';
      // Re-layout Monaco after showing
      if (this.editor) {
        var self = this;
        requestAnimationFrame(function () { self.editor.layout(); });
      }
    }
    this._currentView = view;

    // Sync toggle button active state
    var btns = this.root.querySelectorAll('.tvm-view-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].getAttribute('data-view') === view);
    }
  };

  /**
   * Install a PROMPT_COMMAND hook in the VM's bash shell that
   * automatically dumps git state to a file every time a prompt is
   * displayed (i.e. after every command completes).  This is the
   * notification mechanism — the file on the 9p mount is always
   * fresh, so _refreshGitGraph() just reads it without any serial
   * interaction.
   */
  TutorialCode.prototype._installGitGraphPromptHook = function () {
    var p = this.gitGraphPath || '/tutorial';
    var self = this;

    // One stable PROMPT_COMMAND entry: __gg_prompt. Reinstalling only
    // redefines that function, so we can upgrade from legacy to daemon mode
    // later without stacking duplicate prompt hooks.
    return self._probeRPCDaemon().then(function (rpcAvail) {
      var mode = rpcAvail ? 'rpc' : 'legacy';
      if (self._gitGraphHookInstalled && self._gitGraphHookMode === mode) {
        return Promise.resolve();
      }
      if (!rpcAvail && !self._canRunLegacyBackgroundSerial()) {
        self._logLegacyBackgroundSerialSkip('git graph prompt hook');
        return Promise.resolve();
      }
      var hookCmd;
      if (rpcAvail) {
        hookCmd =
          '__gg_repo=' + shellQuote(p) + '; ' +
          '__gg_fifo=/run/gg/tick.fifo; ' +
          '__gg_kick() { ' +
          '( [ -p "$__gg_fifo" ] && printf "%s\\n" "$__gg_repo" > "$__gg_fifo" ) >/dev/null 2>&1 & ' +
          '}; ' +
          '__gg_prompt() { __gg_kick; }; ' +
          'case ";$PROMPT_COMMAND;" in *";__gg_prompt;"*) ;; *) PROMPT_COMMAND="__gg_prompt${PROMPT_COMMAND:+;$PROMPT_COMMAND}";; esac';
      } else {
        hookCmd =
          '__gg_repo=' + shellQuote(p) + '; ' +
          '__gg_dump() { ' +
          '( cd "$__gg_repo" 2>/dev/null && [ -d .git ] && ' +
          '{ GIT_OPTIONAL_LOCKS=0; export GIT_OPTIONAL_LOCKS; ' +
          'echo "===LOG==="; git log --all --format="%H|%P|%s|%D" --topo-order 2>/dev/null; ' +
          'echo "===BRANCH==="; git branch 2>/dev/null; ' +
          'echo "===HEAD==="; git symbolic-ref HEAD 2>/dev/null || echo detached; ' +
          'echo "===STATUS==="; git status --porcelain=v1 2>/dev/null; ' +
          'echo "===STASH==="; git stash list 2>/dev/null; ' +
          '} > "$__gg_repo/.git/gitgraph_state" 2>/dev/null ); }; ' +
          '__gg_prompt() { __gg_dump; }; ' +
          'case ";$PROMPT_COMMAND;" in *";__gg_prompt;"*) ;; *) PROMPT_COMMAND="__gg_prompt${PROMPT_COMMAND:+;$PROMPT_COMMAND}";; esac';
      }
      return self._runSilent(hookCmd).then(function () {
        self._gitGraphHookInstalled = true;
        self._gitGraphHookMode = mode;
      });
    });
  };

  TutorialCode.prototype._ensureGitGraphPromptHook = function () {
    if (this.config.backend !== 'v86' || !this.gitGraphPath || !this.booted) {
      return Promise.resolve();
    }
    return this._installGitGraphPromptHook().catch(function () {
      // Graph rendering has explicit refresh fallback paths; a failed hook
      // install should never block tutorial restore or terminal reveal.
    });
  };

  // ---------------------------------------------------------------------------
  // User-command listener — per-step switch
  //
  // The shell-side recording hook (__record_user_cmd) is installed once in
  // _setupFilesystem as part of the boot init script. Per-step YAML just
  // switches which shell expression receives the captured commands — we do
  // that by updating the $__USER_CMD_LISTENER variable. Resetting
  // $__LAST_HISTCMD="" ensures the first command after the switch is
  // recorded cleanly even if the history line number hasn't advanced.
  // ---------------------------------------------------------------------------

  TutorialCode.prototype._updateUserCmdListener = function (step) {
    if (this.config.backend !== 'v86') return Promise.resolve();
    var listener = (step && step.user_command_listener) || this.userCommandListener || '';
    if (listener === this._activeUserCmdListener) return Promise.resolve();
    this._activeUserCmdListener = listener;
    // Escape the listener for embedding inside a double-quoted bash assignment
    var esc = String(listener).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`');
    return this._runSilent('__USER_CMD_LISTENER="' + esc + '"; __LAST_HISTCMD=""');
  };

  // ---------------------------------------------------------------------------
  // post_fileload_setup — silent shell commands run AFTER step files are synced
  //
  // Global commands run first, then per-step. Used by tutorials that need to
  // bring the VM into a state derived from freshly-synced files (e.g. the
  // git-playground replays its build-git.sh here, which means the script's
  // content is the current editor value — so a student can "undo" the last
  // recorded command by deleting a line and clicking Reset Current Step).
  // ---------------------------------------------------------------------------

  TutorialCode.prototype._runPostFileloadSetup = function (step) {
    if (this.config.backend !== 'v86' && this.config.backend !== 'webcontainer') {
      return Promise.resolve();
    }
    var globalCmds = this.postFileloadSetupCommands || [];
    var stepCmds = (step && step.post_fileload_setup) || [];
    var all = globalCmds.concat(stepCmds).map(function (c) { return String(c).trim(); }).filter(Boolean);
    if (all.length === 0) return Promise.resolve();
    return this._runSilent(all.join('\n'));
  };

  TutorialCode.prototype._getStepVisibleFiles = function (step, opts) {
    opts = opts || {};
    var includeStepFiles = opts.includeStepFiles !== false;
    var stepFilePaths = {};
    var seen = {};
    var files = [];
    function add(path) {
      if (!path || seen[path]) return;
      if (!includeStepFiles && stepFilePaths[path]) return;
      seen[path] = true;
      files.push(path);
    }
    if (step && step.files) {
      step.files.forEach(function (f) {
        stepFilePaths[f.path] = true;
        if (includeStepFiles) add(f.path);
      });
    }
    if (step) add(step.open_file);
    if (step && step.watch_files) {
      step.watch_files.forEach(function (path) { add(path); });
    }
    return files;
  };

  TutorialCode.prototype._readBackendFile = function (filename) {
    var self = this;
    if (!filename) return Promise.resolve(null);

    if (self.config.backend === 'v86') {
      if (!self.emulator || !self.booted) return Promise.resolve(null);
      return self.emulator.read_file('/' + filename)
        .then(function (buf) { return new TextDecoder('utf-8').decode(buf); })
        .catch(function () { return null; });
    }

    if (self.config.backend === 'webcontainer' && self._webcontainer) {
      return self._webcontainer.fs.readFile('tutorial/' + filename, 'utf8')
        .then(function (content) {
          if (typeof content === 'string') return content;
          return new TextDecoder('utf-8').decode(content);
        })
        .catch(function () { return null; });
    }

    return Promise.resolve(null);
  };

  TutorialCode.prototype._refreshStepVisibleFiles = function (step, opts) {
    var self = this;
    var files = self._getStepVisibleFiles(step, opts);
    if (files.length === 0) return Promise.resolve();

    var p = Promise.resolve();
    self._suppressAutoSave = true;
    files.forEach(function (filename) {
      p = p.then(function () {
        return self._readBackendFile(filename).then(function (content) {
          if (content === null) return;
          self.openFile(filename, content);
          if (self.editorModels[filename]) {
            self.editorModels[filename].lastSyncContent = content;
          }
        });
      });
    });

    return p.then(function () {
      self._suppressAutoSave = false;
      var target = (step && step.open_file) ||
        (step && step.watch_files && step.watch_files[0]) ||
        (step && step.files && step.files[0] && step.files[0].path);
      if (target && self.editorModels[target]) self._setActiveFile(target);
      self._renderTabs();
    }).catch(function () {
      self._suppressAutoSave = false;
    });
  };

  // ---------------------------------------------------------------------------
  // Persistent step-file sync helper
  //
  // `persistent: true` on a step.files entry opts that file out of the usual
  // reset-overwrites-with-starter behavior: its current EDITOR content is
  // synced to the freshly-restored VM instead. This is what makes "delete
  // the last line in build-git.sh + click Reset" act as an undo in the
  // git-playground without any bespoke undo button.
  // ---------------------------------------------------------------------------

  TutorialCode.prototype._syncStepFiles = function (step, opts) {
    opts = opts || {};
    var allowPersist = opts.allowPersist !== false; // default: respect persistent flag
    var setActive = opts.setActive !== false;
    if (!step || !step.files) return Promise.resolve();
    var self = this;
    var syncs = [];
    self._suppressAutoSave = true;
    step.files.forEach(function (f) {
      if (allowPersist && f.persistent && self.editorModels[f.path]) {
        // Keep current editor content; sync it back to the VM so the
        // just-restored filesystem reflects the student's edits.
        syncs.push(Promise.resolve(self._syncFileToBackend(f.path)));
      } else {
        self.openFile(f.path, f.content, f.language, f);
        syncs.push(Promise.resolve(self._syncFileToBackend(f.path)));
        self._originalContent[f.path] = f.content || '';
      }
    });
    self._suppressAutoSave = false;
    if (setActive && step.open_file) self._setActiveFile(step.open_file);
    return Promise.all(syncs);
  };

  /**
   * Run git state commands out-of-band, writing output to a known file on the
   * 9p-mounted filesystem so we can read it via read_file(). If RPC is not
   * available after the terminal is interactive, skip the serial fallback so
   * background graph refreshes never steal or mute the student's shell input.
   */
  TutorialCode.prototype._dumpGitState = function () {
    var p = this.gitGraphPath || '/tutorial';
    var cmd = '( cd ' + shellQuote(p) + ' && { GIT_OPTIONAL_LOCKS=0; export GIT_OPTIONAL_LOCKS; echo "===LOG==="; git log --all --format="%H|%P|%s|%D" --topo-order 2>/dev/null; echo "===BRANCH==="; git branch 2>/dev/null; echo "===HEAD==="; git symbolic-ref HEAD 2>/dev/null || echo detached; echo "===STATUS==="; git status --porcelain=v1 2>/dev/null; echo "===STASH==="; git stash list 2>/dev/null; } > ' + shellQuote(p + '/.git/gitgraph_state') + ' 2>/dev/null )';
    var self = this;
    // RPC path: daemon runs the dump, gitgraph_state is fresh when the
    // returned Promise resolves. The cmd's stdout is empty (everything is
    // redirected to gitgraph_state), so we don't use the resp content —
    // we only need the "done" signal that the daemon finished.
    return self._probeRPCDaemon().then(function (avail) {
      if (avail) return self._runRPC(cmd);
      if (!self._canRunLegacyBackgroundSerial()) {
        self._logLegacyBackgroundSerialSkip('git graph refresh');
        return Promise.resolve();
      }
      return self._runSilent(cmd);
    });
  };

  /**
   * Parse the .gitgraph_state file content and render the SVG graph.
   *
   * Sections dumped by __gg_dump:
   *   ===LOG===     git log --all --format="%H|%P|%s|%D" --topo-order
   *   ===BRANCH===  git branch
   *   ===HEAD===    git symbolic-ref HEAD (or "detached")
   *   ===STATUS===  git status --porcelain=v1
   *   ===STASH===   git stash list
   */
  TutorialCode.prototype._renderGitGraphFromText = function (text) {
    var logOutput = '';
    var branchOutput = '';
    var headRef = '';
    var statusOutput = '';
    var stashOutput = '';
    var sections = text.split(/^===(\w+)===$\n?/m);
    for (var i = 0; i < sections.length; i++) {
      if (sections[i] === 'LOG') logOutput = (sections[i + 1] || '').trim();
      else if (sections[i] === 'BRANCH') branchOutput = (sections[i + 1] || '').trim();
      else if (sections[i] === 'HEAD') headRef = (sections[i + 1] || '').trim();
      else if (sections[i] === 'STATUS') statusOutput = (sections[i + 1] || '').replace(/^\n+|\n+$/g, '');
      else if (sections[i] === 'STASH') stashOutput = (sections[i + 1] || '').replace(/^\n+|\n+$/g, '');
    }
    var files = _parseStatusAndStash(statusOutput, stashOutput);
    var data = GitGraph.parseGitState(logOutput, branchOutput, headRef, files);
    if (!this._gitGraph) {
      this._gitGraph = new GitGraph(this.gitGraphContainerEl);
    }
    this._gitGraph.render(data);
    if (this._isGraphDetached && this._isGraphDetached()) {
      this._popoutManager.broadcastGraphUpdate({
        html: this.gitGraphContainerEl.innerHTML || '',
      });
    }
  };

  // Map `git status --porcelain=v1` two-column status codes to the workbench's
  // human-readable status strings. Column 1 is the index (staged) status,
  // column 2 is the working-tree (unstaged) status.
  var _PORCELAIN_STATUS = {
    'M': 'modified', 'A': 'new file', 'D': 'deleted',
    'R': 'renamed',  'C': 'copied',   'T': 'typechange',
    'U': 'unmerged'
  };

  function _parseStatusAndStash(statusOutput, stashOutput) {
    var files = { untracked: [], unstaged: [], staged: [], stashed: [] };

    if (statusOutput) {
      var lines = statusOutput.split('\n');
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (!line || line.length < 3) continue;
        var indexCode = line.charAt(0);
        var workCode = line.charAt(1);
        var path = line.substring(3);
        // Untracked — "?? path"
        if (indexCode === '?' && workCode === '?') {
          files.untracked.push(path);
          continue;
        }
        // Ignored — "!! path" — skip.
        if (indexCode === '!') continue;
        // Renames: porcelain v1 prints "old -> new" in the path slot; use the
        // new name as the displayed path.
        var displayPath = path;
        var arrowIdx = path.indexOf(' -> ');
        if (arrowIdx >= 0) displayPath = path.substring(arrowIdx + 4);
        // A file can appear in both zones (index modified AND further working
        // changes). Emit one row per zone so the user sees both.
        if (indexCode !== ' ' && indexCode !== '?' && _PORCELAIN_STATUS[indexCode]) {
          files.staged.push({ status: _PORCELAIN_STATUS[indexCode], path: displayPath });
        }
        if (workCode !== ' ' && workCode !== '?' && _PORCELAIN_STATUS[workCode]) {
          files.unstaged.push({ status: _PORCELAIN_STATUS[workCode], path: displayPath });
        }
      }
    }

    if (stashOutput) {
      var stashLines = stashOutput.split('\n');
      for (var s = 0; s < stashLines.length; s++) {
        var sLine = stashLines[s];
        if (!sLine) continue;
        // Format: "stash@{N}: WIP on <branch>: <hash> <message>"
        //     or: "stash@{N}: On <branch>: <message>"
        var m = sLine.match(/^(stash@\{\d+\}):\s+(?:WIP on|On)\s+([^:]+):\s*(.*)$/);
        if (m) {
          files.stashed.push({ ref: m[1], branch: m[2].trim(), message: m[3].trim() });
        } else {
          // Fall back to raw line if regex doesn't match.
          files.stashed.push({ ref: 'stash@{' + s + '}', branch: '', message: sLine });
        }
      }
    }

    // Returning an empty `files` object (rather than null) means the workbench
    // always renders in tutorial views, matching the "live git status" promise.
    return files;
  }

  /**
   * FULL refresh: producer-driven dump. Used for: Refresh button clicks,
   * initial _setView, step loads. Backend dispatch:
   *   v86       → _dumpGitState() (RPC or pre-reveal serial) + render cached state
   *   pyodide   → worker.gitGetState → GitGraph.fromStructured
   * Other backends with gitGraphPath unset are no-ops.
   */
  TutorialCode.prototype._refreshGitGraph = function () {
    if (this._isBackgroundSyncPaused()) {
      this._gitGraphRefreshPending = true;
      return;
    }
    // Piggy-back: any codepath that refreshes the graph also refreshes the
    // git gutter. Covers step transitions, apply-solution, setup commands,
    // and external Refresh-button clicks — none of which go through
    // _dispatchGitTermLine where the gutter hook used to live.
    if (this.config.enableGitGutter) this._refreshAllGitGutters();
    if (!this.booted || !window.GitGraph) return;
    if (this._gitGraphRefreshing) return;
    var backend = this.config.backend;
    if (backend !== 'v86' && backend !== 'pyodide') return;
    this._gitGraphRefreshing = true;
    var self = this;
    var generation = this._gitGraphRefreshGeneration;
    var safetyTimer = setTimeout(function () {
      if (generation === self._gitGraphRefreshGeneration) self._gitGraphRefreshing = false;
    }, 10000);

    if (backend === 'v86') {
      var stateReadPath = (self.gitGraphPath || '/tutorial').replace(/^\/tutorial/, '') + '/.git/gitgraph_state';
      this._ensureGitGraphPromptHook()
        .then(function () { return self._dumpGitState(); })
        .then(function () { return new Promise(function (resolve) { setTimeout(resolve, 150); }); })
        .then(function () { return self.emulator.read_file(stateReadPath); })
        .then(function (buf) {
          if (generation !== self._gitGraphRefreshGeneration || self._isBackgroundSyncPaused()) return;
          clearTimeout(safetyTimer);
          self._gitGraphRefreshing = false;
          var text = new TextDecoder('utf-8').decode(buf);
          self._lastGitGraphStateText = text;
          self._gitGraphStateDirty = false;
          self._gitGraphRefreshPending = false;
          self._renderGitGraphFromText(text);
        })
        .catch(function () {
          clearTimeout(safetyTimer);
          if (generation === self._gitGraphRefreshGeneration) self._gitGraphRefreshing = false;
        });
      return;
    }

    // pyodide
    this._pyodideGetGitState().then(function (state) {
      if (generation !== self._gitGraphRefreshGeneration || self._isBackgroundSyncPaused()) return;
      clearTimeout(safetyTimer);
      self._gitGraphRefreshing = false;
      self._gitGraphStateDirty = false;
      self._gitGraphRefreshPending = false;
      self._renderGitGraphFromState(state);
    }).catch(function () {
      clearTimeout(safetyTimer);
      if (generation === self._gitGraphRefreshGeneration) self._gitGraphRefreshing = false;
    });
  };

  /**
   * LIGHT refresh: producer-driven, no expensive setup. Backend dispatch:
   *   v86       → reads cached .gitgraph_state file via 9p (PROMPT_COMMAND keeps it fresh)
   *   pyodide   → identical to full refresh (worker call is already cheap; no separate cache needed)
   */
  TutorialCode.prototype._lightRefreshGitGraph = function () {
    if (this._isBackgroundSyncPaused() || this._gitGraphStateDirty) {
      this._gitGraphRefreshPending = true;
      return;
    }
    if (!this.booted || !window.GitGraph) return;
    var backend = this.config.backend;
    var self = this;
    var generation = this._gitGraphRefreshGeneration;
    if (backend === 'v86') {
      if (this._lastGitGraphStateText) {
        this._renderGitGraphFromText(this._lastGitGraphStateText);
        return;
      }
      var stateReadPath = (this.gitGraphPath || '/tutorial').replace(/^\/tutorial/, '') + '/.git/gitgraph_state';
      this.emulator.read_file(stateReadPath)
        .then(function (buf) {
          if (generation !== self._gitGraphRefreshGeneration || self._isBackgroundSyncPaused() || self._gitGraphStateDirty) return;
          self._renderGitGraphFromText(new TextDecoder('utf-8').decode(buf));
        })
        .catch(function () { /* file doesn't exist yet — ignore */ });
      return;
    }
    if (backend === 'pyodide') {
      this._pyodideGetGitState().then(function (state) {
        if (generation !== self._gitGraphRefreshGeneration || self._isBackgroundSyncPaused() || self._gitGraphStateDirty) return;
        self._renderGitGraphFromState(state);
      }).catch(function () { /* repo not initialized yet — ignore */ });
    }
  };

  // Render from a pre-built structured state (used by the pyodide path).
  // Mirrors _renderGitGraphFromText's tail half, just bypassing the parser.
  TutorialCode.prototype._renderGitGraphFromState = function (state) {
    var data = window.GitGraph.fromStructured(state || {
      commits: [], branches: [],
      head: { ref: null, hash: null, detached: false },
      files: { untracked: [], unstaged: [], staged: [], stashed: [] },
    });
    if (!this._gitGraph) {
      this._gitGraph = new GitGraph(this.gitGraphContainerEl);
    }
    this._gitGraph.render(data);
    if (this._isGraphDetached && this._isGraphDetached()) {
      this._popoutManager.broadcastGraphUpdate({
        html: this.gitGraphContainerEl.innerHTML || '',
      });
    }
  };

  // Ask the pyodide worker for the current git state. Returns a structured
  // object directly (no text round-trip).
  TutorialCode.prototype._pyodideGetGitState = function () {
    var self = this;
    var dir = this.gitGraphPath || '/tutorial';
    return new Promise(function (resolve, reject) {
      self._postWorker({ type: 'gitGetState', dir: dir }, function (msg) {
        if (msg.type === 'git_state') resolve(msg.state);
        else reject(new Error(msg.message || 'gitGetState failed'));
      });
    });
  };

  // ---------------------------------------------------------------------------
  // Pyodide git terminal — xterm-based, JS-side router → iso-git in worker
  //
  // Lightweight by design: tokenize a line, dispatch on `git`, `cd`, `ls`,
  // `pwd`, `clear`, `help` and reject everything else. No pipes, globs, env
  // vars, or subshells. Monaco edits flow into the FS via _flushAllToFS()
  // before any read-side git command; iso-git's mutated paths come back via
  // worker.git_run_done and we refresh Monaco models from FS.
  // ---------------------------------------------------------------------------

  // Toggle the shared bottom panel between Output and Terminal views.
  // Idempotent — safe to call from view changes or tab clicks.
  TutorialCode.prototype._showOutputTermPanel = function (panel) {
    var tabs = this.root.querySelectorAll('.tvm-out-term-tab');
    if (tabs.length === 0) return; // tutorial without the tabbed panel
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('active', tabs[i].getAttribute('data-panel') === panel);
    }
    var outView = this.root.querySelector('.tvm-out-term-tabbed > .tvm-output-view');
    var termView = this.root.querySelector('.tvm-out-term-tabbed > .tvm-terminal-view');
    if (outView)  outView.style.display  = (panel === 'output')   ? 'flex' : 'none';
    if (termView) termView.style.display = (panel === 'terminal') ? 'flex' : 'none';
    // xterm needs a fit() after the container becomes visible.
    if (panel === 'terminal' && this.gitTerm && this.gitTermFitAddon) {
      var self = this;
      setTimeout(function () { try { self.gitTermFitAddon.fit(); self.gitTerm.focus(); } catch (e) {} }, 30);
    }
  };

  TutorialCode.prototype._initGitTerminal = function () {
    if (!this.gitGraphPath || this.config.backend === 'v86') return;
    var container = this.root.querySelector('.tvm-git-terminal-container');
    if (!container || this.gitTerm) return;

    var TermClass = window.Terminal;
    if (!TermClass) return;
    var isDark = this._isDarkMode();
    this.gitTerm = new TermClass({
      cursorBlink: true,
      fontSize: this.config.fontSize - 1,
      fontFamily: "'Fira Code', 'Cascadia Code', Menlo, monospace",
      theme: isDark ? THEMES.dark.xterm : THEMES.light.xterm,
      scrollback: 5000,
      convertEol: true,
      // Treat macOS Option as Meta so Option+B/F/Left/Right/Backspace generate
      // ESC-prefixed sequences that we can interpret as readline word ops.
      macOptionIsMeta: true,
    });
    var FitAddonClass = (window.FitAddon && window.FitAddon.FitAddon)
      ? window.FitAddon.FitAddon : window.FitAddon;
    this.gitTermFitAddon = new FitAddonClass();
    this.gitTerm.loadAddon(this.gitTermFitAddon);
    this.gitTerm.open(container);

    var self = this;
    setTimeout(function () { try { self.gitTermFitAddon.fit(); } catch (e) {} }, 100);
    if (window.ResizeObserver) {
      var t;
      var ro = new ResizeObserver(function () {
        clearTimeout(t);
        t = setTimeout(function () { try { self.gitTermFitAddon.fit(); } catch (e) {} }, 50);
      });
      ro.observe(container);
    }

    // Per-terminal CWD so `cd subdir` then `git add foo.py` resolves correctly.
    this._gitTermCwd = this.gitGraphPath || '/tutorial';
    this._gitTermLineBuf = '';
    this._gitTermCursorPos = 0;
    this._gitTermHistory = [];      // past commands, oldest first
    this._gitTermHistoryIdx = -1;   // -1 = composing new line; 0..N-1 = browsing
    this._gitTermStashedLine = '';  // line being composed when up-arrow grabbed history
    this._gitTermBusy = false;
    // xterm-js can deliver an ESC sequence chunked across calls (\x1b alone,
    // then [A on the next tick). Carry partial sequences across invocations
    // so arrow keys work reliably.
    this._gitTermEscPending = '';
    // Single-slot kill ring populated by Ctrl+W / Ctrl+U / Ctrl+K and the
    // Alt-Backspace / Alt-Delete word kills; consumed by Ctrl+Y (yank).
    this._gitTermKillRing = '';

    this.gitTerm.onData(function (data) { self._gitTermOnData(data); });

    // Translate macOS Cmd+arrow / Cmd+Backspace / Cmd+Delete chords to their
    // readline equivalents. Browsers and the OS would otherwise consume
    // Cmd+Left (back-nav), so we have to intercept at the keydown layer.
    // attachCustomKeyEventHandler returns false to tell xterm.js to drop the
    // event after we've handled it ourselves.
    if (typeof this.gitTerm.attachCustomKeyEventHandler === 'function') {
      this.gitTerm.attachCustomKeyEventHandler(function (ev) {
        if (ev.type !== 'keydown') return true;
        if (!ev.metaKey || ev.ctrlKey || ev.altKey) return true;
        // Preserve clipboard / select-all / find-in-page chords.
        var k = ev.key;
        if (k === 'c' || k === 'C' || k === 'v' || k === 'V'
            || k === 'a' || k === 'A' || k === 'f' || k === 'F'
            || k === 'x' || k === 'X' || k === 'z' || k === 'Z'
            || k === '+' || k === '-' || k === '=' || k === '0') {
          return true;
        }
        if (k === 'ArrowLeft')   { self._gitCursorHome();         ev.preventDefault(); return false; }
        if (k === 'ArrowRight')  { self._gitCursorEnd();          ev.preventDefault(); return false; }
        if (k === 'Backspace')   { self._gitKillLine();           ev.preventDefault(); return false; }
        if (k === 'Delete')      { self._gitKillToEnd();          ev.preventDefault(); return false; }
        return true;
      });
    }

    this._writeGitPrompt();
  };

  TutorialCode.prototype._writeGitPrompt = function () {
    if (!this.gitTerm) return;
    var rel = this._gitTermCwd.replace(/^\/tutorial/, '~') || '~';
    this.gitTerm.write('\x1b[1;32mstudent\x1b[0m:\x1b[1;34m' + rel + '\x1b[0m$ ');
  };

  // Readline-style input handling: cursor movement (←/→/Home/End), history
  // (↑/↓), inline insert/delete, Ctrl+U (kill line), Ctrl+L (clear screen).
  // xterm sends multi-byte escape sequences for arrow keys; we scan the
  // incoming `data` chunk and interpret each token before mutating state.
  TutorialCode.prototype._gitTermOnData = function (data) {
    if (!this.gitTerm) return;
    if (this._gitTermBusy) return; // ignore typing while a command is dispatching
    var self = this;
    // Prepend any incomplete escape sequence carried over from the previous
    // delivery — xterm chunks key events arbitrarily.
    if (this._gitTermEscPending) {
      data = this._gitTermEscPending + data;
      this._gitTermEscPending = '';
    }
    var i = 0;
    while (i < data.length) {
      var ch = data.charAt(i);

      // ---- ESC sequences (arrow keys, Home, End, Delete, word ops) -------
      if (ch === '\x1b') {
        // Need at least 2 more bytes (intro + final). If we don't have them,
        // stash everything from `i` and wait for the next chunk.
        if (i + 1 >= data.length) { this._gitTermEscPending = data.substring(i); break; }
        var seq2 = data.charAt(i + 1);
        if (seq2 === '[') {
          if (i + 2 >= data.length) { this._gitTermEscPending = data.substring(i); break; }
          var seq3 = data.charAt(i + 2);
          if (seq3 === 'A') { this._gitHistoryPrev(); i += 3; continue; }
          if (seq3 === 'B') { this._gitHistoryNext(); i += 3; continue; }
          if (seq3 === 'C') { this._gitCursorRight(); i += 3; continue; }
          if (seq3 === 'D') { this._gitCursorLeft(); i += 3; continue; }
          if (seq3 === 'H') { this._gitCursorHome(); i += 3; continue; }
          if (seq3 === 'F') { this._gitCursorEnd(); i += 3; continue; }
          // Delete = `\x1b[3~`. With Ctrl/Alt: `\x1b[3;5~` / `\x1b[3;3~`.
          if (seq3 === '3') {
            if (i + 3 >= data.length) { this._gitTermEscPending = data.substring(i); break; }
            if (data.charAt(i + 3) === '~') { this._gitDeleteForward(); i += 4; continue; }
            if (data.charAt(i + 3) === ';') {
              if (i + 5 >= data.length) { this._gitTermEscPending = data.substring(i); break; }
              var dmod = data.charAt(i + 4);
              if (data.charAt(i + 5) === '~') {
                // 3 = Alt, 5 = Ctrl, 7 = Ctrl+Alt — all forward-delete a word.
                if (dmod === '3' || dmod === '5' || dmod === '7') { this._gitDeleteWordForward(); i += 6; continue; }
                // Plain shift/etc. modifiers — fall through to forward-delete.
                this._gitDeleteForward(); i += 6; continue;
              }
            }
          }
          // Modifier-arrow / modifier-Home / modifier-End: `\x1b[1;<mod><dir>`.
          //   <mod> 2=Shift  3=Alt  4=Alt+Shift  5=Ctrl  6=Ctrl+Shift  7=Ctrl+Alt
          if (seq3 === '1') {
            if (i + 3 >= data.length) { this._gitTermEscPending = data.substring(i); break; }
            if (data.charAt(i + 3) === ';') {
              if (i + 5 >= data.length) { this._gitTermEscPending = data.substring(i); break; }
              var mod = data.charAt(i + 4);
              var dir = data.charAt(i + 5);
              var isWordMod = (mod === '3' || mod === '4' || mod === '5' || mod === '6' || mod === '7');
              if (dir === 'D') {
                if (isWordMod) this._gitWordLeft(); else this._gitCursorLeft();
                i += 6; continue;
              }
              if (dir === 'C') {
                if (isWordMod) this._gitWordRight(); else this._gitCursorRight();
                i += 6; continue;
              }
              if (dir === 'H') { this._gitCursorHome(); i += 6; continue; }
              if (dir === 'F') { this._gitCursorEnd();  i += 6; continue; }
              // Unknown modified function key — skip the whole sequence.
              i += 6; continue;
            }
          }
          // Unknown CSI: skip up to a final byte (letter or '~'). If we run
          // out of bytes, stash and wait.
          var j = i + 2;
          while (j < data.length && !/[a-zA-Z~]/.test(data.charAt(j))) j++;
          if (j >= data.length) { this._gitTermEscPending = data.substring(i); break; }
          i = j + 1;
          continue;
        }
        if (seq2 === 'O') {
          if (i + 2 >= data.length) { this._gitTermEscPending = data.substring(i); break; }
          var seq3b = data.charAt(i + 2);
          if (seq3b === 'H') { this._gitCursorHome(); i += 3; continue; }
          if (seq3b === 'F') { this._gitCursorEnd(); i += 3; continue; }
          i += 3; // unknown SS3
          continue;
        }
        // Alt-prefixed letter / control: readline word-edit family.
        //   ESC b / ESC B          → word backward
        //   ESC f / ESC F          → word forward
        //   ESC d / ESC D          → delete word forward
        //   ESC <DEL> / ESC <BS>   → delete word backward (Option+Backspace)
        //   ESC .  /  ESC _        → yank last arg of previous history entry
        //                              (repeated press cycles further back)
        //   ESC c / ESC u / ESC l  → capitalize / uppercase / lowercase word
        if (seq2 === 'b' || seq2 === 'B')      { this._gitWordLeft();              i += 2; continue; }
        if (seq2 === 'f' || seq2 === 'F')      { this._gitWordRight();             i += 2; continue; }
        if (seq2 === 'd' || seq2 === 'D')      { this._gitDeleteWordForward();     i += 2; continue; }
        if (seq2 === '\x7f' || seq2 === '\b')  { this._gitDeleteWordBackward();    i += 2; continue; }
        if (seq2 === '.' || seq2 === '_')      { this._gitYankLastArg();           i += 2; continue; }
        if (seq2 === 'c' || seq2 === 'C')      { this._gitTransformWord('cap');    i += 2; continue; }
        if (seq2 === 'u' || seq2 === 'U')      { this._gitTransformWord('upper');  i += 2; continue; }
        if (seq2 === 'l' || seq2 === 'L')      { this._gitTransformWord('lower');  i += 2; continue; }
        // Unknown ESC introducer — drop ESC + next byte
        i += 2;
        continue;
      }

      // ---- Control characters --------------------------------------------
      if (ch === '\r' || ch === '\n') {
        var rawLine = this._gitTermLineBuf;
        this.gitTerm.write('\r\n');
        // History expansion: !!, !$, !^, !* are substituted before dispatch.
        // Bash echoes the expanded form; we do the same so learners can see
        // what they actually invoked.
        var expanded = this._gitExpandHistory(rawLine);
        var line = expanded.line;
        if (expanded.changed) {
          this.gitTerm.write(line + '\r\n');
        }
        if (line.trim().length) {
          this._gitTermHistory.push(line);
        }
        this._gitTermLineBuf = '';
        this._gitTermCursorPos = 0;
        this._gitTermHistoryIdx = -1;
        this._gitTermStashedLine = '';
        this._gitYankNthState = null;
        this._dispatchGitTermLine(line).then(function () {
          self._writeGitPrompt();
        });
        return;
      }
      if (ch === '\x7f' || ch === '\b') { this._gitDeleteBackward();    i++; continue; }
      if (ch === '\x09')                { this._gitTermTabComplete();   i++; continue; } // Tab
      if (ch === '\x01')                { this._gitCursorHome();        i++; continue; } // Ctrl+A
      if (ch === '\x05')                { this._gitCursorEnd();         i++; continue; } // Ctrl+E
      if (ch === '\x02')                { this._gitCursorLeft();        i++; continue; } // Ctrl+B
      if (ch === '\x06')                { this._gitCursorRight();       i++; continue; } // Ctrl+F
      if (ch === '\x0b')                { this._gitKillToEnd();         i++; continue; } // Ctrl+K
      if (ch === '\x15')                { this._gitKillLine();          i++; continue; } // Ctrl+U
      if (ch === '\x17')                { this._gitDeleteWordBackward();i++; continue; } // Ctrl+W
      if (ch === '\x14')                { this._gitTransposeChars();    i++; continue; } // Ctrl+T
      if (ch === '\x0e')                { this._gitHistoryNext();       i++; continue; } // Ctrl+N
      if (ch === '\x10')                { this._gitHistoryPrev();       i++; continue; } // Ctrl+P
      if (ch === '\x19')                { this._gitYank();              i++; continue; } // Ctrl+Y
      if (ch === '\x0c')                { this._gitClearScreen();       i++; continue; } // Ctrl+L
      if (ch === '\x04')                { i++; continue; }                                // Ctrl+D (ignore EOF)
      if (ch === '\x03')                { this._gitTermLineBuf = ''; this._gitTermCursorPos = 0; this.gitTerm.write('^C\r\n'); this._writeGitPrompt(); return; } // Ctrl+C
      if (ch < ' ')                     { i++; continue; }                                // ignore other ctrls

      // ---- Printable: insert at cursor -----------------------------------
      this._gitInsertChar(ch);
      i++;
    }
  };

  // ---- Line-edit primitives. Each updates _gitTermLineBuf + cursor and
  // emits the smallest possible xterm escape sequence to keep the visible
  // line in sync.
  TutorialCode.prototype._gitInsertChar = function (ch) {
    var pos = this._gitTermCursorPos;
    var buf = this._gitTermLineBuf;
    var tail = buf.substring(pos);
    this._gitTermLineBuf = buf.substring(0, pos) + ch + tail;
    this._gitTermCursorPos = pos + 1;
    if (tail.length === 0) {
      this.gitTerm.write(ch);
    } else {
      // Print char + tail, then walk cursor back over the tail.
      this.gitTerm.write(ch + tail + this._cursorBack(tail.length));
    }
  };

  TutorialCode.prototype._gitDeleteBackward = function () {
    var pos = this._gitTermCursorPos;
    if (pos === 0) return;
    var buf = this._gitTermLineBuf;
    var tail = buf.substring(pos);
    this._gitTermLineBuf = buf.substring(0, pos - 1) + tail;
    this._gitTermCursorPos = pos - 1;
    // Walk cursor left, rewrite tail, blank the trailing column, walk back.
    this.gitTerm.write('\b' + tail + ' ' + this._cursorBack(tail.length + 1));
  };

  TutorialCode.prototype._gitDeleteForward = function () {
    var pos = this._gitTermCursorPos;
    var buf = this._gitTermLineBuf;
    if (pos >= buf.length) return;
    var newTail = buf.substring(pos + 1);
    this._gitTermLineBuf = buf.substring(0, pos) + newTail;
    // Rewrite tail, blank trailing column, walk back.
    this.gitTerm.write(newTail + ' ' + this._cursorBack(newTail.length + 1));
  };

  TutorialCode.prototype._gitCursorLeft = function () {
    if (this._gitTermCursorPos > 0) {
      this._gitTermCursorPos--;
      this.gitTerm.write('\b');
    }
  };

  TutorialCode.prototype._gitCursorRight = function () {
    if (this._gitTermCursorPos < this._gitTermLineBuf.length) {
      this._gitTermCursorPos++;
      this.gitTerm.write('\x1b[C');
    }
  };

  TutorialCode.prototype._gitCursorHome = function () {
    if (this._gitTermCursorPos > 0) {
      this.gitTerm.write(this._cursorBack(this._gitTermCursorPos));
      this._gitTermCursorPos = 0;
    }
  };

  TutorialCode.prototype._gitCursorEnd = function () {
    var d = this._gitTermLineBuf.length - this._gitTermCursorPos;
    if (d > 0) {
      this.gitTerm.write('\x1b[' + d + 'C');
      this._gitTermCursorPos = this._gitTermLineBuf.length;
    }
  };

  TutorialCode.prototype._gitKillLine = function () {
    var killed = this._gitTermLineBuf;
    this._gitCursorHome();
    this.gitTerm.write('\x1b[K');
    this._gitTermLineBuf = '';
    this._gitTermCursorPos = 0;
    if (killed) this._gitTermKillRing = killed;
  };

  TutorialCode.prototype._gitKillToEnd = function () {
    var buf = this._gitTermLineBuf;
    var pos = this._gitTermCursorPos;
    var killed = buf.substring(pos);
    this._gitTermLineBuf = buf.substring(0, pos);
    this.gitTerm.write('\x1b[K');
    if (killed) this._gitTermKillRing = killed;
  };

  // ---- Word-aware ops -----------------------------------------------------
  // A "word" here is a maximal run of [A-Za-z0-9_]. Mirrors readline's
  // default; matches what bash / zsh / iTerm do for Option+arrow / Alt+B / etc.
  TutorialCode.prototype._gitFindWordStartLeft = function (pos) {
    var buf = this._gitTermLineBuf;
    if (pos <= 0) return 0;
    // Skip non-word chars to the left of the cursor.
    while (pos > 0 && !/\w/.test(buf.charAt(pos - 1))) pos--;
    // Then skip word chars until we hit a boundary.
    while (pos > 0 && /\w/.test(buf.charAt(pos - 1))) pos--;
    return pos;
  };

  TutorialCode.prototype._gitFindWordEndRight = function (pos) {
    var buf = this._gitTermLineBuf;
    var len = buf.length;
    if (pos >= len) return len;
    // Skip non-word chars to the right of the cursor.
    while (pos < len && !/\w/.test(buf.charAt(pos))) pos++;
    // Then skip word chars until we hit a boundary.
    while (pos < len && /\w/.test(buf.charAt(pos))) pos++;
    return pos;
  };

  TutorialCode.prototype._gitWordLeft = function () {
    var target = this._gitFindWordStartLeft(this._gitTermCursorPos);
    var d = this._gitTermCursorPos - target;
    if (d <= 0) return;
    this.gitTerm.write(this._cursorBack(d));
    this._gitTermCursorPos = target;
  };

  TutorialCode.prototype._gitWordRight = function () {
    var target = this._gitFindWordEndRight(this._gitTermCursorPos);
    var d = target - this._gitTermCursorPos;
    if (d <= 0) return;
    this.gitTerm.write('\x1b[' + d + 'C');
    this._gitTermCursorPos = target;
  };

  TutorialCode.prototype._gitDeleteWordBackward = function () {
    var pos = this._gitTermCursorPos;
    var target = this._gitFindWordStartLeft(pos);
    if (target >= pos) return;
    var buf = this._gitTermLineBuf;
    var killed = buf.substring(target, pos);
    var tail = buf.substring(pos);
    this._gitTermLineBuf = buf.substring(0, target) + tail;
    this._gitTermCursorPos = target;
    var del = pos - target;
    // Walk left, rewrite tail, blank the now-vacant columns, walk back.
    this.gitTerm.write(
      this._cursorBack(del) + tail
      + new Array(del + 1).join(' ')
      + this._cursorBack(tail.length + del)
    );
    this._gitTermKillRing = killed;
  };

  TutorialCode.prototype._gitDeleteWordForward = function () {
    var pos = this._gitTermCursorPos;
    var target = this._gitFindWordEndRight(pos);
    if (target <= pos) return;
    var buf = this._gitTermLineBuf;
    var killed = buf.substring(pos, target);
    var tail = buf.substring(target);
    this._gitTermLineBuf = buf.substring(0, pos) + tail;
    var del = target - pos;
    this.gitTerm.write(
      tail + new Array(del + 1).join(' ')
      + this._cursorBack(tail.length + del)
    );
    this._gitTermKillRing = killed;
  };

  // Swap the char before the cursor with the char at the cursor, then advance.
  // At end-of-line, swap the two chars before the cursor (readline behavior).
  TutorialCode.prototype._gitTransposeChars = function () {
    var buf = this._gitTermLineBuf;
    var pos = this._gitTermCursorPos;
    if (buf.length < 2) return;
    if (pos === 0) return;
    var a, b, newPos;
    if (pos >= buf.length) {
      a = buf.charAt(pos - 2); b = buf.charAt(pos - 1);
      this._gitTermLineBuf = buf.substring(0, pos - 2) + b + a;
      newPos = pos;
      this.gitTerm.write('\b\b' + b + a);
    } else {
      a = buf.charAt(pos - 1); b = buf.charAt(pos);
      this._gitTermLineBuf = buf.substring(0, pos - 1) + b + a + buf.substring(pos + 1);
      newPos = pos + 1;
      this.gitTerm.write('\b' + b + a);
    }
    this._gitTermCursorPos = newPos;
  };

  // Insert the most recently killed text at the cursor.
  TutorialCode.prototype._gitYank = function () {
    var s = this._gitTermKillRing;
    if (!s) return;
    for (var k = 0; k < s.length; k++) this._gitInsertChar(s.charAt(k));
  };

  // Bash's Alt+. : insert the last argument of the most recent history entry.
  // Repeated immediate presses cycle further back through history.
  TutorialCode.prototype._gitYankLastArg = function () {
    var hist = this._gitTermHistory;
    if (!hist.length) return;
    var state = this._gitYankNthState;
    var sameSpot = state
      && state.endPos === this._gitTermCursorPos
      && state.lastBuf === this._gitTermLineBuf;
    var idx = sameSpot ? state.idx - 1 : hist.length - 1;
    if (idx < 0) return; // ran out of history
    var prev = hist[idx];
    var args = this._gitTokenize(prev);
    var lastArg = args.length ? args[args.length - 1] : '';
    if (sameSpot && state.insertedLen) {
      // Remove the previous insertion before adding the next candidate.
      for (var d = 0; d < state.insertedLen; d++) this._gitDeleteBackward();
    }
    var startPos = this._gitTermCursorPos;
    for (var k = 0; k < lastArg.length; k++) this._gitInsertChar(lastArg.charAt(k));
    this._gitYankNthState = {
      idx: idx,
      startPos: startPos,
      endPos: this._gitTermCursorPos,
      insertedLen: lastArg.length,
      lastBuf: this._gitTermLineBuf,
    };
  };

  // Alt+U / Alt+L / Alt+C — uppercase, lowercase, or capitalize the next word
  // starting at the cursor (readline behavior).
  TutorialCode.prototype._gitTransformWord = function (mode) {
    var pos = this._gitTermCursorPos;
    var target = this._gitFindWordEndRight(pos);
    if (target <= pos) return;
    var buf = this._gitTermLineBuf;
    // Skip leading non-word chars so the transform applies to the actual word,
    // matching readline.
    var s = pos;
    while (s < target && !/\w/.test(buf.charAt(s))) s++;
    if (s >= target) { this._gitTermCursorPos = target; this.gitTerm.write('\x1b[' + (target - pos) + 'C'); return; }
    var before = buf.substring(0, s);
    var word = buf.substring(s, target);
    var after = buf.substring(target);
    var transformed;
    if (mode === 'upper')      transformed = word.toUpperCase();
    else if (mode === 'lower') transformed = word.toLowerCase();
    else                       transformed = word.charAt(0).toUpperCase() + word.substring(1).toLowerCase();
    this._gitTermLineBuf = before + transformed + after;
    // Redraw from the original cursor position to end of word, then walk
    // cursor to end of word (matches readline placement).
    var redraw = buf.substring(pos, s) + transformed;
    this.gitTerm.write(redraw);
    this._gitTermCursorPos = target;
  };

  // Apply bash-style history expansion to a freshly-typed line: `!!` becomes
  // the previous command, `!$` the last word of the previous command, `!^`
  // the first argument. If anything was substituted, the expanded line is
  // echoed before being dispatched (also matching bash).
  TutorialCode.prototype._gitExpandHistory = function (line) {
    if (line.indexOf('!') === -1) return { line: line, changed: false };
    var hist = this._gitTermHistory;
    var prev = hist.length ? hist[hist.length - 1] : '';
    var prevArgs = prev ? this._gitTokenize(prev) : [];
    var changed = false;
    var out = line.replace(/!!|!\$|!\^|!\*/g, function (m) {
      if (!prev) return m;
      changed = true;
      if (m === '!!') return prev;
      if (m === '!$') return prevArgs.length ? prevArgs[prevArgs.length - 1] : '';
      if (m === '!^') return prevArgs.length > 1 ? prevArgs[1] : '';
      if (m === '!*') return prevArgs.length > 1 ? prevArgs.slice(1).join(' ') : '';
      return m;
    });
    return { line: out, changed: changed };
  };

  // ---- Tab completion -------------------------------------------------------
  //
  // Contexts and candidates:
  //   [empty / first word]          → all known commands
  //   git <Tab>                     → git subcommands
  //   git <sub> ... <Tab>           → file paths in the working tree
  //   <unix-cmd> ... <Tab>          → file paths in the working tree
  //
  // Single match → insert remainder inline.
  // Multiple matches → complete to the common prefix; if already at common
  //   prefix (or second Tab at same position), list all on a new line.

  var _GIT_SUBCOMMANDS = [
    'add','am','annotate','apply','archive','bisect','blame','branch',
    'cat-file','checkout','cherry-pick','clean','clone','commit','config',
    'describe','diff','fetch','for-each-ref','fsck','gc','grep','help',
    'init','log','ls-files','ls-remote','ls-tree','merge','merge-base',
    'mv','notes','prune','pull','push','rebase','reflog','remote',
    'repack','reset','restore','revert','rev-list','rev-parse','revert',
    'rm','show','show-ref','stash','status','submodule','switch','symbolic-ref',
    'tag','update-ref','verify-commit','version','whatchanged',
  ];
  var _ALL_COMMANDS = [
    'git','ls','cat','echo','head','tail','grep','find','wc','diff',
    'sort','uniq','mkdir','rmdir','rm','cp','mv','touch','which',
    'pwd','cd','clear','help','env','printf','date','basename','dirname',
    'realpath','true','false','python','python3','pytest',
  ];

  TutorialCode.prototype._gitTermTabComplete = function () {
    var self = this;
    var buf = this._gitTermLineBuf;
    var cursor = this._gitTermCursorPos;
    var lineUpToCursor = buf.substring(0, cursor);

    // Tokenise the text up to the cursor.
    var tokens = this._gitTokenize(lineUpToCursor);
    var onSpace = lineUpToCursor.length > 0 && /\s$/.test(lineUpToCursor);
    var currentWord = (!onSpace && tokens.length) ? tokens[tokens.length - 1] : '';
    var priorTokens = (!onSpace && tokens.length) ? tokens.slice(0, -1) : tokens;

    var doubleTab = (this._lastTabLine === lineUpToCursor);
    this._lastTabLine = lineUpToCursor;

    var promise;
    if (priorTokens.length === 0) {
      // Completing the command name.
      promise = Promise.resolve(
        _ALL_COMMANDS.filter(function (c) { return c.indexOf(currentWord) === 0; })
      );
    } else if (priorTokens[0] === 'git' && priorTokens.length === 1) {
      // Completing a git subcommand.
      promise = Promise.resolve(
        _GIT_SUBCOMMANDS.filter(function (c) { return c.indexOf(currentWord) === 0; })
      );
    } else if (priorTokens[0] === 'git' && priorTokens[1] === 'remote' && priorTokens.length === 2) {
      // git remote <sub>
      var rsubs = ['add','get-url','prune','remove','rename','set-head','set-url','show','update'];
      promise = Promise.resolve(rsubs.filter(function (c) { return c.indexOf(currentWord) === 0; }));
    } else if (priorTokens[0] === 'git' && priorTokens[1] === 'stash' && priorTokens.length === 2) {
      var ssubs = ['apply','branch','clear','drop','list','pop','push','show'];
      promise = Promise.resolve(ssubs.filter(function (c) { return c.indexOf(currentWord) === 0; }));
    } else {
      // Completing a file/directory path.
      promise = self._gitCompletePathAsync(currentWord);
    }

    promise.then(function (candidates) {
      if (!candidates || !candidates.length) return;

      if (candidates.length === 1) {
        var suffix = candidates[0].substring(currentWord.length);
        if (!suffix) return;
        var newBuf = buf.substring(0, cursor) + suffix + buf.substring(cursor);
        self._gitReplaceLine(newBuf);
        self._lastTabLine = newBuf; // next Tab in same spot won't re-list
        return;
      }

      var common = _commonPrefix(candidates);
      if (common.length > currentWord.length) {
        var suffix2 = common.substring(currentWord.length);
        var newBuf2 = buf.substring(0, cursor) + suffix2 + buf.substring(cursor);
        self._gitReplaceLine(newBuf2);
        self._lastTabLine = newBuf2;
      } else if (doubleTab || common.length === currentWord.length) {
        // Show the list below the current line.
        self.gitTerm.write('\r\n');
        // Print in columns, up to terminal width.
        var cols = (self.gitTerm.cols || 80);
        var maxLen = candidates.reduce(function (m, c) { return Math.max(m, c.length); }, 0);
        var colW = maxLen + 2;
        var perRow = Math.max(1, Math.floor(cols / colW));
        for (var row = 0; row < Math.ceil(candidates.length / perRow); row++) {
          var line = '';
          for (var col = 0; col < perRow; col++) {
            var idx = row * perRow + col;
            if (idx >= candidates.length) break;
            line += candidates[idx] + ' '.repeat(colW - candidates[idx].length);
          }
          self.gitTerm.write(line.trimRight() + '\r\n');
        }
        self._writeGitPrompt();
        self.gitTerm.write(buf);
        if (self._gitTermCursorPos < buf.length) {
          self.gitTerm.write(self._cursorBack(buf.length - self._gitTermCursorPos));
        }
        self._lastTabLine = '';  // reset so next Tab from same spot re-lists
      }
    });
  };

  // Split currentWord into a directory part and basename prefix, list the
  // directory via gitListDir, filter by prefix, and return completions.
  TutorialCode.prototype._gitCompletePathAsync = function (currentWord) {
    var self = this;
    // Strip leading ./ for cleaner display.
    var displayWord = currentWord;
    if (displayWord.indexOf('./') === 0) displayWord = displayWord.substring(2);

    var slashIdx = currentWord.lastIndexOf('/');
    var dirPart, basePart;
    if (slashIdx === -1) {
      dirPart = this._gitTermCwd;
      basePart = currentWord;
    } else {
      var rawDir = currentWord.substring(0, slashIdx + 1); // includes trailing /
      // Resolve relative to cwd.
      dirPart = rawDir.charAt(0) === '/'
        ? rawDir.replace(/\/+$/, '') || '/'
        : (this._gitTermCwd + '/' + rawDir).replace(/\/+$/, '') || '/';
      // Normalise ../ etc. (simple stack-based resolve).
      var parts = dirPart.split('/').filter(Boolean);
      var stack = [];
      parts.forEach(function (p) {
        if (p === '..') stack.pop();
        else if (p !== '.') stack.push(p);
      });
      dirPart = '/' + stack.join('/');
      basePart = currentWord.substring(slashIdx + 1);
    }

    var prefixInResult = slashIdx === -1 ? '' : currentWord.substring(0, slashIdx + 1);

    return new Promise(function (resolve) {
      self._postWorker({ type: 'gitListDir', path: dirPart }, function (msg) {
        if (!msg || !msg.entries) return resolve([]);
        var entries = msg.entries.filter(function (e) {
          return e.name.indexOf(basePart) === 0 && e.name.charAt(0) !== '.';
        });
        // Sort: dirs first, then files.
        entries.sort(function (a, b) {
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
          return a.name < b.name ? -1 : 1;
        });
        var completions = entries.map(function (e) {
          return prefixInResult + e.name + (e.isDir ? '/' : '');
        });
        resolve(completions);
      });
    });
  };

  function _commonPrefix(strs) {
    if (!strs.length) return '';
    var prefix = strs[0];
    for (var i = 1; i < strs.length; i++) {
      while (strs[i].indexOf(prefix) !== 0) {
        prefix = prefix.substring(0, prefix.length - 1);
        if (!prefix) return '';
      }
    }
    return prefix;
  }

  TutorialCode.prototype._gitClearScreen = function () {
    this.gitTerm.clear();
    this._writeGitPrompt();
    if (this._gitTermLineBuf.length) {
      this.gitTerm.write(this._gitTermLineBuf + this._cursorBack(this._gitTermLineBuf.length - this._gitTermCursorPos));
    }
  };

  TutorialCode.prototype._gitHistoryPrev = function () {
    var hist = this._gitTermHistory;
    if (hist.length === 0) return;
    if (this._gitTermHistoryIdx === -1) {
      this._gitTermStashedLine = this._gitTermLineBuf;
      this._gitTermHistoryIdx = hist.length - 1;
    } else if (this._gitTermHistoryIdx > 0) {
      this._gitTermHistoryIdx--;
    } else {
      return;
    }
    this._gitReplaceLine(hist[this._gitTermHistoryIdx]);
  };

  TutorialCode.prototype._gitHistoryNext = function () {
    if (this._gitTermHistoryIdx === -1) return;
    var hist = this._gitTermHistory;
    if (this._gitTermHistoryIdx < hist.length - 1) {
      this._gitTermHistoryIdx++;
      this._gitReplaceLine(hist[this._gitTermHistoryIdx]);
    } else {
      this._gitTermHistoryIdx = -1;
      this._gitReplaceLine(this._gitTermStashedLine);
      this._gitTermStashedLine = '';
    }
  };

  // Replace the current visible line text with `s` and put the cursor at end.
  TutorialCode.prototype._gitReplaceLine = function (s) {
    // Move to start, erase to end-of-line, write the new line.
    if (this._gitTermCursorPos > 0) {
      this.gitTerm.write(this._cursorBack(this._gitTermCursorPos));
    }
    this.gitTerm.write('\x1b[K' + (s || ''));
    this._gitTermLineBuf = s || '';
    this._gitTermCursorPos = this._gitTermLineBuf.length;
  };

  TutorialCode.prototype._cursorBack = function (n) {
    if (n <= 0) return '';
    return '\x1b[' + n + 'D';
  };

  // Dispatch a single typed line. Returns a Promise that resolves when the
  // terminal can accept input again.
  TutorialCode.prototype._dispatchGitTermLine = function (line) {
    var self = this;
    var trimmed = String(line || '').trim();
    if (trimmed === '') return Promise.resolve();
    var tokens = this._gitTokenize(trimmed);
    if (tokens.length === 0) return Promise.resolve();
    var verb = tokens[0];

    // Local-only commands handled on the main thread.
    if (verb === 'clear') { this.gitTerm.clear(); return Promise.resolve(); }
    if (verb === 'help')  { this._gitTermWriteHelp(); return Promise.resolve(); }
    if (verb === 'pwd')   { this.gitTerm.write(this._gitTermCwd + '\r\n'); return Promise.resolve(); }
    if (verb === 'cd')    { return this._gitTermCd(tokens.slice(1)); }
    if (verb === 'ls')    { return this._gitTermLs(tokens.slice(1)); }

    // Everything else (git, find, cat, echo, grep, …) → worker.
    // Flush dirty Monaco buffers first so the FS is up to date.
    this._gitTermBusy = true;
    return this._flushAllToFS().then(function () {
      return self._runGitLine(trimmed);
    }).then(function (res) {
      if (res.stdout) self.gitTerm.write(res.stdout.replace(/\n/g, '\r\n'));
      if (res.stderr) self.gitTerm.write('\x1b[31m' + res.stderr.replace(/\n/g, '\r\n') + '\x1b[0m');
      // FS → Monaco: refresh editor models for any path iso-git mutated.
      var mutated = res.mutatedPaths || [];
      var refreshes = mutated.map(function (rel) { return self._refreshMonacoFromFS(rel); });
      return Promise.all(refreshes);
    }).then(function () {
      // Re-render gitgraph after every git command.
      self._refreshGitGraph();
      // Refresh git gutter — HEAD may have moved (commit/checkout/reset/...),
      // changing what the buffer is "modified" relative to.
      if (self.config.enableGitGutter) self._refreshAllGitGutters();
      self._gitTermBusy = false;
    }).catch(function (err) {
      self.gitTerm.write('\x1b[31mfatal: ' + (err && err.message || err) + '\x1b[0m\r\n');
      self._gitTermBusy = false;
    });
  };

  // Run YAML-supplied git_setup lines through the same worker dispatcher,
  // silently (no terminal echo). Used during _initPyodide bring-up.
  TutorialCode.prototype._runGitSetup = function (lines) {
    var self = this;
    var dir = this.gitGraphPath || '/tutorial';
    var seq = Promise.resolve();
    lines.forEach(function (line) {
      seq = seq.then(function () {
        return new Promise(function (resolve) {
          self._postWorker({ type: 'gitRun', line: String(line), cwd: dir, dir: dir }, function (msg) {
            if (msg.stderr) {
              // Surface setup errors to the console so authors can debug,
              // but don't reject — let the rest of bring-up proceed.
              console.warn('git_setup:', line, '→', msg.stderr.trim());
            }
            resolve();
          });
        });
      });
    });
    return seq;
  };

  TutorialCode.prototype._runGitLine = function (line) {
    var self = this;
    return new Promise(function (resolve, reject) {
      self._postWorker({
        type: 'gitRun', line: line,
        cwd: self._gitTermCwd, dir: self.gitGraphPath || '/tutorial',
      }, function (msg) {
        if (msg.type === 'git_run_done') {
          resolve({ stdout: msg.stdout, stderr: msg.stderr,
                    exitCode: msg.exitCode, mutatedPaths: msg.mutatedPaths || [] });
        } else {
          reject(new Error(msg.message || 'gitRun failed'));
        }
      });
    });
  };

  TutorialCode.prototype._gitTokenize = function (line) {
    var tokens = [], cur = '', inSingle = false, inDouble = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line.charAt(i);
      if (inSingle) {
        if (ch === "'") inSingle = false; else cur += ch;
      } else if (inDouble) {
        if (ch === '"') inDouble = false; else cur += ch;
      } else if (ch === "'") inSingle = true;
      else if (ch === '"') inDouble = true;
      else if (/\s/.test(ch)) {
        if (cur.length) { tokens.push(cur); cur = ''; }
      } else cur += ch;
    }
    if (cur.length) tokens.push(cur);
    return tokens;
  };

  TutorialCode.prototype._gitTermWriteHelp = function () {
    var lines = [
      'Lightweight terminal — supported commands:',
      '',
      '  git <subcommand>         full git support (init, add, commit, log, …)',
      '',
      '  File system:',
      '    ls [-al] [dir]         list directory',
      '    pwd                    print working directory',
      '    cd <dir>               change directory',
      '    cat [-n] <file>        print file contents',
      '    head/tail [-n N] <f>   first/last N lines',
      '    find [dir] [-name p]   find files',
      '    grep [-rinv] <pat> <f> search text',
      '    wc [-lwc] <file>       word/line/byte count',
      '    diff <a> <b>           compare two files',
      '    sort/uniq <file>       sort or deduplicate',
      '',
      '  File ops:',
      '    touch, mkdir [-p], rmdir, rm [-rf], cp [-r], mv',
      '',
      '  Shell helpers:',
      '    echo [-n] <text>       print text',
      '    printf <fmt> [args]    formatted print',
      '    which <cmd>            locate a command',
      '    basename/dirname <p>   path components',
      '    realpath <p>           absolute path',
      '    date [+<fmt>]          current date/time',
      '    env                    show environment',
      '    true / false / :       exit-code helpers',
      '    clear                  clear the screen',
      '    help                   this message',
      '',
      'Edit files in the editor; git add will see your changes.',
      '',
    ];
    this.gitTerm.write(lines.join('\r\n'));
  };

  TutorialCode.prototype._gitTermCd = function (args) {
    var target = (args && args[0]) || (this.gitGraphPath || '/tutorial');
    var resolved;
    if (target === '~') resolved = this.gitGraphPath || '/tutorial';
    else if (target.charAt(0) === '/') resolved = this._gitResolvePath(target);
    else resolved = this._gitResolvePath(this._gitTermCwd + '/' + target);
    var self = this;
    return new Promise(function (resolve) {
      self._postWorker({ type: 'gitListDir', path: resolved }, function (msg) {
        if (msg.error) {
          self.gitTerm.write('cd: ' + target + ': ' + msg.error + '\r\n');
        } else {
          self._gitTermCwd = resolved;
        }
        resolve();
      });
    });
  };

  TutorialCode.prototype._gitTermLs = function (args) {
    var target = (args && args[0]) || this._gitTermCwd;
    if (target.charAt(0) !== '/') target = this._gitResolvePath(this._gitTermCwd + '/' + target);
    var self = this;
    return new Promise(function (resolve) {
      self._postWorker({ type: 'gitListDir', path: target }, function (msg) {
        if (msg.error) {
          self.gitTerm.write('ls: ' + target + ': ' + msg.error + '\r\n');
        } else {
          var entries = msg.entries || [];
          var lines = entries.map(function (e) {
            return e.isDir ? ('\x1b[1;34m' + e.name + '/\x1b[0m') : e.name;
          });
          if (lines.length) self.gitTerm.write(lines.join('  ') + '\r\n');
        }
        resolve();
      });
    });
  };

  TutorialCode.prototype._gitResolvePath = function (abs) {
    var parts = abs.split('/').filter(Boolean);
    var stack = [];
    parts.forEach(function (p) {
      if (p === '.') return;
      if (p === '..') { stack.pop(); return; }
      stack.push(p);
    });
    return '/' + stack.join('/');
  };

  // Monaco → FS flush: write every dirty editor buffer into Pyodide's FS
  // so the next git command sees the student's latest edits.
  TutorialCode.prototype._flushAllToFS = function () {
    if (this.config.backend !== 'pyodide') return Promise.resolve();
    var self = this;
    var pending = [];
    Object.keys(this.editorModels).forEach(function (filename) {
      var entry = self.editorModels[filename];
      if (!entry) return;
      var content = entry.model.getValue();
      if (entry.lastSyncContent === content) return;
      pending.push(self._syncFileToBackend(filename));
    });
    return Promise.all(pending);
  };

  // FS → Monaco: re-read a path from the worker FS and update the model.
  // Called for each path in mutatedPaths after a git command.
  TutorialCode.prototype._refreshMonacoFromFS = function (relPath) {
    if (this.config.backend !== 'pyodide') return Promise.resolve();
    var self = this;
    var dir = this.gitGraphPath || '/tutorial';
    var abs = dir + '/' + relPath;
    return new Promise(function (resolve) {
      self._postWorker({ type: 'read', path: abs }, function (msg) {
        if (msg.type === 'read_ok') {
          var entry = self.editorModels[relPath];
          if (entry && entry.model.getValue() !== msg.content) {
            self._suppressAutoSave = true;
            entry.model.setValue(msg.content);
            entry.lastSyncContent = msg.content;
            self._suppressAutoSave = false;
          } else if (entry) {
            entry.lastSyncContent = msg.content;
          }
        }
        resolve();
      });
    });
  };

  /**
   * Auto-refresh: called from the serial output listener when a shell
   * prompt is detected. In daemon mode the graph usually updates first via
   * a pushed G frame on virtio-console; this light read is a low-cost fallback
   * for legacy snapshots and missed notifications.
   */
  TutorialCode.prototype._maybeAutoRefreshGitGraph = function () {
    if (this._isBackgroundSyncPaused()) return;
    if (this._currentView === 'git_graph' && this.booted) {
      var self = this;
      clearTimeout(this._gitGraphAutoRefreshTimer);
      // Short delay to let legacy 9p prompt writes propagate. Keep it low so
      // graph view still feels immediate when the daemon push is unavailable.
      this._gitGraphAutoRefreshTimer = setTimeout(function () {
        self._lightRefreshGitGraph();
      }, 50);
    }
  };

  // ---------------------------------------------------------------------------
  // HTTP Client Methods
  // ---------------------------------------------------------------------------
  TutorialCode.prototype._showRightPanel = function (panel) {
    if (!this._rightTabBarEl) return;
    var tabs = this._rightTabBarEl.querySelectorAll('.tvm-right-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('active', tabs[i].getAttribute('data-panel') === panel);
    }
    if (this._outputViewEl) this._outputViewEl.style.display = (panel === 'output' ? 'flex' : 'none');
    if (this._umlContainer && !this._leftTabBarEl) {
      // only toggle if it's actually in the right panel
      this._umlContainer.style.display = (panel === 'uml' ? 'flex' : 'none');
    }
    if (this._httpViewEl) this._httpViewEl.style.display = (panel === 'http' ? 'flex' : 'none');

    if (panel === 'http' && this._httpBodyEditor) {
      this._httpBodyEditor.layout();
    }
  };

  TutorialCode.prototype._initHttpBodyEditor = function () {
    if (this._httpBodyEditor || !this._httpBodyContainerEl) return;
    this._httpBodyEditor = monaco.editor.create(this._httpBodyContainerEl, {
      value: '{\n  "message": "Hello Server"\n}',
      language: 'json',
      theme: this._isDarkMode() ? THEMES.dark.monaco : THEMES.light.monaco,
      fontSize: 12,
      minimap: { enabled: false },
      lineNumbers: 'off',
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      wordWrap: 'on',
    });
  };

  TutorialCode.prototype._sendHttpRequest = function () {
    var self = this;
    var method = this._httpMethodEl.value;
    var url = this._httpUrlEl.value;
    var body = this._httpBodyEditor ? this._httpBodyEditor.getValue() : '';

    this._httpResponseBodyEl.textContent = 'Sending ' + method + ' request...';
    this._httpResponseBodyEl.style.display = 'block';
    this._httpResponseMetaEl.innerHTML = '';
    this._httpEmptyEl.style.display = 'none';

    var dbg = this._debuggerCtl;
    if (dbg && dbg.session && dbg.channel && typeof dbg.channel.sendHttpRequest === 'function' &&
        dbg.channel.sendHttpRequest({ method: method, url: url, body: body })) {
      return;
    }

    if (this.config.backend === 'webcontainer' && this._webcontainer) {
      this._sendWebContainerHttpRequest({ method: method, url: url, body: body });
      return;
    }

    if (this._jsRunnerFrame && this._jsRunnerFrame.contentWindow) {
      this._jsRunnerFrame.contentWindow.postMessage({
        type: 'http_request',
        method: method,
        url: url,
        body: body
      }, '*');
    } else {
      this._httpResponseBodyEl.textContent = 'Error: Server is not running. Click "\u25b6 Run" first to start the Node.js process.';
      this._httpResponseBodyEl.style.color = '#e55';
    }
  };

  TutorialCode.prototype._webContainerRequestTarget = function (rawUrl) {
    rawUrl = String(rawUrl || '/');
    var port = '3000';
    var path = rawUrl || '/';
    if (/^https?:\/\//i.test(rawUrl)) {
      try {
        var parsed = new URL(rawUrl);
        port = parsed.port || '3000';
        path = parsed.pathname + parsed.search;
      } catch (e) { /* keep defaults */ }
    }
    if (path.charAt(0) !== '/') path = '/' + path;
    return { port: port, path: path };
  };

  TutorialCode.prototype._sendWebContainerHttpRequest = function (req) {
    var target = this._webContainerRequestTarget(req && req.url);
    if (!this._webcontainer || !target) {
      this._handleHttpResponse({
        status: 503,
        body: 'Error: Server is not running yet. Click Run or Debug, then wait for port 3000 to open.',
      });
      return false;
    }
    var method = String(req.method || 'GET').toUpperCase();
    var payload = {
      method: method,
      port: Number(target.port || 3000),
      path: target.path || '/',
      body: method === 'GET' ? '' : (req.body || ''),
    };
    var clientScript = [
      "const http = require('http');",
      "const reqData = " + JSON.stringify(payload) + ";",
      "const body = reqData.body || '';",
      "const headers = body ? {'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)} : {};",
      "const request = http.request({host:'127.0.0.1', port:reqData.port, path:reqData.path, method:reqData.method, headers}, (res) => {",
      "  let out = '';",
      "  res.setEncoding('utf8');",
      "  res.on('data', chunk => out += chunk);",
      "  res.on('end', () => console.log(JSON.stringify({status:res.statusCode || 0, body:out})));",
      "});",
      "request.on('error', err => console.log(JSON.stringify({status:0, body:'Error: ' + (err && err.message || err)})));",
      "if (body) request.write(body);",
      "request.end();",
    ].join('\n');
    var self = this;
    this._webcontainer.spawn('node', ['-e', clientScript], { cwd: '/tutorial' })
      .then(function (proc) {
        var output = '';
        var reader = proc.output.getReader();
        (function readLoop() {
          reader.read().then(function (result) {
            if (result.done) return;
            output += result.value || '';
            readLoop();
          }).catch(function () {});
        })();
        return proc.exit.then(function () {
          try { reader.cancel(); } catch (e) {}
          var lines = output.trim().split(/\n/).filter(Boolean);
          var last = lines[lines.length - 1] || '';
          try {
            self._handleHttpResponse(JSON.parse(last));
          } catch (e) {
            self._handleHttpResponse({ status: 0, body: output || 'Error: empty HTTP client response' });
          }
        });
      }).catch(function (err) {
        self._handleHttpResponse({
          status: 0,
          body: 'Error: ' + (err && err.message || err),
        });
      });
    return true;
  };

  TutorialCode.prototype._handleHttpResponse = function (data) {
    var status = data.status || 200;
    var body = data.body || '';
    var statusClass = (status >= 200 && status < 300) ? 'tvm-http-status-2xx' : 'tvm-http-status-4xx';

    this._httpResponseMetaEl.innerHTML =
      '<span class="tvm-http-status-badge ' + statusClass + '">' + status + '</span>' +
      '<span class="tvm-http-meta-sep"></span>' +
      '<span>' + body.length + ' bytes</span>';

    this._httpResponseBodyEl.textContent = body;
    this._httpResponseBodyEl.style.display = 'block';
    this._httpResponseBodyEl.style.color = '';
    this._httpEmptyEl.style.display = 'none';
  };

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------
  window.TutorialCode = TutorialCode;

})();
