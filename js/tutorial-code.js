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
 * This file intentionally replaces tutorial-vm.js for new tutorials.
 * Existing tutorials (v86) continue to work unchanged via backend: 'v86'.
 */
(function () {
  'use strict';

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
    WEBCONTAINER: 'https://cdn.jsdelivr.net/npm/@webcontainer/api@1.5.5/dist/index.js',
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
      document.head.appendChild(s);
    });
  }

  function loadCSS(url) {
    if (document.querySelector('link[href="' + url + '"]')) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = url;
    document.head.appendChild(l);
  }

  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  var LANG_MAP = {
    sh: 'shell-sebook', bash: 'shell-sebook', zsh: 'shell-sebook',
    py: 'python', js: 'javascript', json: 'json',
    yml: 'yaml', yaml: 'yaml', md: 'markdown',
    css: 'css', txt: 'plaintext', c: 'c', h: 'c', cpp: 'cpp',
    makefile: 'makefile', Makefile: 'makefile',
    pl: 'prolog', pro: 'prolog',
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
      memoryMB: options.memoryMB || 256,
      fontSize: options.fontSize || 14,
      workerPath: options.workerPath || '/js/pyodide-worker.js',
      sqlWorkerPath: options.sqlWorkerPath || '/js/sql-worker.js',
      prologWorkerPath: options.prologWorkerPath || '/js/prolog-worker.js',
      // Derived flags
      useTerminal: (backend === 'v86' || backend === 'webcontainer'),
      usePreview: (backend === 'react'),    // live iframe preview for React tutorials
    };

    this.steps = options.steps || [];
    this.setupCommands = options.setupCommands || [];
    this.requireTests = options.requireTests || false;
    this.instructorMode = options.instructorMode || false;
    this.disableQuiz = options.disableQuiz || false;
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

    // v86 state
    this.emulator = null;
    this._muteCount = 0;           // >0 ⇒ suppress serial→xterm output
    this._executableFiles = new Set();
    this._inputLine = '';
    this._silentQueue = [];          // queued _runSilent Promises
    this._silentRunning = false;      // true while a silent cmd is in-flight
    this._visFilterMarker = null;     // string to suppress from xterm output
    this._visFilterBuf = '';       // partial-match buffer for _visFilterMarker

    // xterm state
    this.term = null;
    this.fitAddon = null;

    // Monaco state
    this.editor = null;
    this.editorModels = {};
    this.activeFileName = null;
    this._suppressAutoSave = false;

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

    // Git graph state
    this.gitGraphPath = options.gitGraphPath || null;
    this._gitGraph = null;
    this._currentView = 'editor';
    this._gitGraphAutoRefreshTimer = null;
    this._gitGraphRefreshing = false;
    this._gitGraphHookInstalled = false;
    this._promptDetectBuf = '';

    // UML diagram state
    this._umlDiagramEnabled = options.uml_diagram || false;
    this._umlContainer = null;
    this._umlContentEl = null;
    this._umlRefreshTimer = null;
    this._umlAnalyzerCode = null;       // Cached Python analyzer source
    this._umlActiveType = 'class';      // 'class' or 'sequence'
    this._umlWatchedFiles = [];         // Set per-step from YAML uml_files
    this._umlLastDiagrams = null;       // {classDiagram, sequenceDiagram}
    this._umlViewActive = false;        // true when UML tab is selected
    this._umlMermaidCounter = 0;        // unique id for mermaid.render calls
    this._umlZoom = 1;                  // current zoom level (inline view)
    this._umlFsZoom = 1;               // current zoom level (fullscreen view)
    this._umlFullscreenEl = null;       // fullscreen overlay element
    this._umlFsContentEl = null;        // fullscreen diagram content element

    // React preview state
    this._previewFrame = null;
    this._reactRebuildTimer = null;

    // Browser JS runner state
    this._jsRunnerFrame = null;
    this._jsRunnerMsgId = 0;
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
        // Watch for dark-mode class changes and re-theme Monaco + terminal (all backends).
        // Also rebuild the React iframe preview so its body colours update.
        if (window.MutationObserver) {
          var mo = new MutationObserver(function () {
            self._applyTheme(self._isDarkMode());
            if (self.config.usePreview) self._rebuildReactPreview();
          });
          mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        }
        self._hideLoading();
        if (self.steps.length > 0) {
          // Respect the user's navbar toggle preference (persisted as 'tutorial-autosave').
          // Default is on; only skip restore when the user has explicitly set it to 'false'.
          var userAutosavePref = localStorage.getItem('tutorial-autosave');
          var userAutosaveOn = userAutosavePref !== 'false';
          if (!userAutosaveOn) self.autoSaveEnabled = false; // keep in sync before navbar wires up
          var saved = (self.allowAutosave && userAutosaveOn) ? self._loadSavedProgress() : null;
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
            self.loadStep(saved.step);
            if (self.autosaveType === 'commands-and-files') {
              // _restoreCommandsAndFiles re-enables autosave after _applySavedFiles
              self._restoreCommandsAndFiles(saved).then(function () {
                self._refreshPrompt();
              });
            } else {
              self._applySavedFiles(saved.files, saved.activeFile);
              self._suppressAutoSave = false;
              // Persist the correctly-restored state immediately
              self._autoSaveProgress();
              self._refreshPrompt();
            }
          } else {
            self.loadStep(0);
            self._refreshPrompt();
          }
        }
      })
      .catch(function (err) {
        self._showError('Failed to start tutorial: ' + err.message);
        console.error('TutorialCode error:', err);
      });
  };

  TutorialCode.prototype.destroy = function () {
    this._stopFileWatch();
    if (this.emulator) { this.emulator.stop(); this.emulator = null; }
    if (this._worker) { this._worker.terminate(); this._worker = null; }
    if (this._shellProcess) { this._shellProcess = null; }
    if (this.editor) { this.editor.dispose(); this.editor = null; }
    for (var n in this.editorModels) {
      if (this.editorModels.hasOwnProperty(n)) this.editorModels[n].model.dispose();
    }
    this.editorModels = {};
    if (this.term) { this.term.dispose(); this.term = null; }
  };

  // ---------------------------------------------------------------------------
  // UI Construction
  // ---------------------------------------------------------------------------
  TutorialCode.prototype._buildUI = function () {
    this.root.classList.add('tvm-root');

    var terminalHtml;
    if (this.config.useTerminal) {
      terminalHtml = '<div class="tvm-terminal-panel">' +
        '<div class="tvm-terminal-header"><span>Terminal</span></div>' +
        '<div class="tvm-terminal-container"></div>' +
        '</div>';
    } else if (this.config.usePreview) {
      terminalHtml = '<div class="tvm-preview-panel">' +
        '<div class="tvm-preview-header">' +
        '<span>Live Preview</span>' +
        '<div class="tvm-preview-actions">' +
        '<button class="tvm-refresh-btn" title="Rebuild preview">\u21bb Refresh</button>' +
        '</div></div>' +
        '<div class="tvm-preview-container">' +
        '<iframe class="tvm-preview-frame" sandbox="allow-scripts allow-same-origin"></iframe>' +
        '</div></div>';
    } else {
      terminalHtml = '<div class="tvm-output-panel">' +
        '<div class="tvm-output-header">' +
        '<span>Output</span>' +
        '<div class="tvm-output-actions">' +
        '<span class="tvm-args-label" style="display:none; font-size:11px; color:#888; font-family:\'Fira Code\', \'Cascadia Code\', Menlo, monospace;">args:</span>' +
        '<input type="text" class="tvm-args-input" placeholder="Program args..." style="display:none;" title="Command-line arguments (sys.argv)" />' +
        '<select class="tvm-stream-filter" style="display:none;" title="Filter output streams">' +
        '<option value="all">All Output</option>' +
        '<option value="stdout">Stdout Only</option>' +
        '<option value="stderr">Stderr Only</option>' +
        '</select>' +
        '<button class="tvm-run-btn" title="Run current file (Ctrl+Enter)">&#9654; Run</button>' +
        '<button class="tvm-clear-btn" title="Clear output">Clear</button>' +
        '</div></div>' +
        '<div class="tvm-output-container"><pre class="tvm-output-pre"></pre></div>' +
        '</div>';
    }

    this.root.innerHTML =
      '<div class="tvm-loading">' +
      '<div class="tvm-loading-spinner"></div>' +
      '<div class="tvm-loading-text">Loading\u2026</div>' +
      '</div>' +
      '<div class="tvm-container" style="display:none">' +
      '<div class="tvm-instructions-panel">' +
      '<div class="tvm-step-nav-bar"><div class="tvm-step-nav"></div></div>' +
      '<div class="tvm-step-content-wrap"><div class="tvm-step-content"></div></div>' +
      '<div class="tvm-quiz-panel" style="display:none"></div>' +
      '<div class="tvm-step-controls-bar"><div class="tvm-step-controls"></div></div>' +
      '</div>' +
      '<div class="tvm-hsplitter" title="Drag to resize"></div>' +
      '<div class="tvm-workspace">' +
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
      '<div class="tvm-editor-panel">' +
      '<div class="tvm-editor-tabs"></div>' +
      '<div class="tvm-editor-container"></div>' +
      '<div class="tvm-diagram-container" style="display:none">' +
      '<div class="tvm-diagram-toolbar">' +
      '<button class="tvm-diagram-type-btn active" data-type="class">Class Diagram</button>' +
      '<button class="tvm-diagram-type-btn" data-type="sequence">Sequence Diagram</button>' +
      '<div class="tvm-diagram-zoom-controls">' +
      '<button class="tvm-diagram-zoom-btn" data-zoom="out" title="Zoom out">\u2212</button>' +
      '<span class="tvm-diagram-zoom-label">100%</span>' +
      '<button class="tvm-diagram-zoom-btn" data-zoom="in" title="Zoom in">+</button>' +
      '<button class="tvm-diagram-zoom-btn" data-zoom="reset" title="Reset zoom">\u2715</button>' +
      '</div>' +
      '<button class="tvm-diagram-fullscreen-btn" title="Fullscreen">\u26f6</button>' +
      '<button class="tvm-diagram-refresh-btn" title="Re-analyze code">\u21bb Refresh</button>' +
      '</div>' +
      '<div class="tvm-diagram-content"></div>' +
      '</div>' +
      '<div class="tvm-diagram-fullscreen-overlay" style="display:none">' +
      '<div class="tvm-diagram-fs-toolbar">' +
      '<button class="tvm-diagram-fs-type-btn active" data-type="class">Class Diagram</button>' +
      '<button class="tvm-diagram-fs-type-btn" data-type="sequence">Sequence Diagram</button>' +
      '<div class="tvm-diagram-zoom-controls">' +
      '<button class="tvm-diagram-fs-zoom-btn" data-zoom="out" title="Zoom out">\u2212</button>' +
      '<span class="tvm-diagram-fs-zoom-label">100%</span>' +
      '<button class="tvm-diagram-fs-zoom-btn" data-zoom="in" title="Zoom in">+</button>' +
      '<button class="tvm-diagram-fs-zoom-btn" data-zoom="reset" title="Reset zoom">\u2715</button>' +
      '</div>' +
      '<button class="tvm-diagram-fs-close" title="Exit fullscreen">\u2715 Close</button>' +
      '</div>' +
      '<div class="tvm-diagram-fs-content"></div>' +
      '</div>' +
      '</div>' +
      (this.gitGraphPath
        ? '<div class="tvm-git-graph-panel" style="display:none">' +
          '<div class="tvm-git-graph-header">' +
          '<span>Git Graph</span>' +
          '<button class="tvm-git-graph-refresh" title="Refresh graph">&#x21bb; Refresh</button>' +
          '</div>' +
          '<div class="tvm-git-graph-container"></div>' +
          '</div>'
        : '') +
      '<div class="tvm-vsplitter" title="Drag to resize"></div>' +
      terminalHtml +
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
    this.gitGraphPanelEl = this.root.querySelector('.tvm-git-graph-panel');
    this.gitGraphContainerEl = this.root.querySelector('.tvm-git-graph-container');
    this._umlContainer = this.root.querySelector('.tvm-diagram-container');
    this._umlContentEl = this.root.querySelector('.tvm-diagram-content');
    this._umlFullscreenEl = this.root.querySelector('.tvm-diagram-fullscreen-overlay');
    this._umlFsContentEl = this.root.querySelector('.tvm-diagram-fs-content');

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
            }
            // Sync inline type buttons too
            var inlineBtns = self._umlContainer ? self._umlContainer.querySelectorAll('.tvm-diagram-type-btn') : [];
            for (var k = 0; k < inlineBtns.length; k++) {
              inlineBtns[k].classList.toggle('active', inlineBtns[k].getAttribute('data-type') === self._umlActiveType);
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

    if (this.config.useTerminal) {
      this.terminalContainerEl = this.root.querySelector('.tvm-terminal-container');
    } else if (this.config.usePreview) {
      this._previewFrame = this.root.querySelector('.tvm-preview-frame');
      var refreshBtn = this.root.querySelector('.tvm-refresh-btn');
      if (refreshBtn) refreshBtn.addEventListener('click', function () { self._rebuildReactPreview(); });
    } else {
      this.outputPre = this.root.querySelector('.tvm-output-pre');
      this.outputPanel = this.root.querySelector('.tvm-output-panel');
      var runBtn = this.root.querySelector('.tvm-run-btn');
      var clearBtn = this.root.querySelector('.tvm-clear-btn');
      if (runBtn) runBtn.addEventListener('click', function () { self._runCurrentFile(); });
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
    if (this.containerEl) this.containerEl.style.display = 'none';
  };

  TutorialCode.prototype._hideLoading = function () {
    var self = this;
    if (this.loadingEl) this.loadingEl.style.display = 'none';
    if (this.containerEl) this.containerEl.style.display = '';
    requestAnimationFrame(function () {
      if (self.fitAddon) { try { self.fitAddon.fit(); } catch (e) { } }
      if (self.editor) self.editor.layout();
    });
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

    var vsplitter = this.root.querySelector('.tvm-vsplitter');
    var editorPanel = this.root.querySelector('.tvm-editor-panel');
    var bottomPanel = this.root.querySelector(
      this.config.useTerminal ? '.tvm-terminal-panel' :
        this.config.usePreview ? '.tvm-preview-panel' : '.tvm-output-panel');
    this._makeDraggable(vsplitter, 'horizontal', editorPanel, bottomPanel);
  };

  TutorialCode.prototype._makeDraggable = function (splitter, direction, beforeEl, afterEl) {
    var self = this;
    var startPos, startSizeBefore;
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
      var sz = Math.max(80, startSizeBefore + (cur - startPos));
      beforeEl.style.flex = '0 0 ' + sz + 'px';
      afterEl.style.flex = '1 1 0';
      if (self.fitAddon) self.fitAddon.fit();
      if (self.editor) self.editor.layout();
    }
    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      splitter.classList.remove('active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    splitter.addEventListener('mousedown', onMouseDown);
  };

  // ---------------------------------------------------------------------------
  // Dependency Loading
  // ---------------------------------------------------------------------------
  TutorialCode.prototype._loadDependencies = function () {
    var self = this;
    self._showLoading('Loading dependencies\u2026');

    // xterm must load before Monaco's AMD loader or its UMD bundle breaks
    var prereqPromise;
    if (this.config.useTerminal) {
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

      return Promise.all([v86Promise, monacoPromise]);
    });
  };

  TutorialCode.prototype._registerMonacoLanguages = function () {
    // Custom shell language (same as tutorial-vm.js)
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
      ],
      colors: {},
    });
    monaco.editor.defineTheme('sebook-dark', {
      base: 'vs-dark', inherit: true,
      rules: [
        { token: 'keyword.shell-sebook', foreground: '569cd6' },
        { token: 'command.shell-sebook', foreground: '4ec9b0' },
        { token: 'variable.shell-sebook', foreground: '9cdcfe' },
        { token: 'attribute.name.shell-sebook', foreground: 'f44747' },
        { token: 'string.shell-sebook', foreground: 'ce9178' },
        { token: 'comment.shell-sebook', foreground: '6a9955' },
        // f-string interpolation delimiters — light blue to signal "code zone"
        { token: 'string.fstring.delimiter', foreground: '569cd6' },
        // Prolog tokens
        { token: 'atom', foreground: 'ce9178' },
      ],
      colors: { 'editor.background': '#1e1e1e' },
    });
  };

  // ---------------------------------------------------------------------------
  // Terminal (xterm.js) — v86 + webcontainer only
  // ---------------------------------------------------------------------------
  var THEMES = {
    dark: {
      monaco: 'sebook-dark',
      xterm: { background: '#1e1e1e', foreground: '#d4d4d4', cursor: '#d4d4d4', selectionBackground: '#264f78' }
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
    if (backend === 'webcontainer') return this._initWebContainer();
    if (backend === 'react') return this._initReactBackend();
    if (backend === 'browser') return this._initBrowserBackend();
    if (backend === 'sql') return this._initSQL();
    if (backend === 'prolog') return this._initProlog();
    return Promise.reject(new Error('Unknown backend: ' + backend));
  };

  // ---- v86 backend (identical to original tutorial-vm.js) -------------------
  TutorialCode.prototype._initV86 = function () {
    var self = this;
    this._showLoading('Booting Linux \u2014 this may take a few seconds\u2026');
    return new Promise(function (resolve, reject) {
      try {
        self.emulator = new V86({
          wasm_path: self.config.v86Path + '/v86.wasm',
          memory_size: self.config.memoryMB * 1024 * 1024,
          vga_memory_size: 2 * 1024 * 1024,
          bios: { url: self.config.v86Path + '/seabios.bin' },
          vga_bios: { url: self.config.v86Path + '/vgabios.bin' },
          bzimage: { url: self.config.vmPath + '/bzImage' },
          initrd: { url: self.config.vmPath + '/rootfs.cpio.gz' },
          cmdline: 'console=ttyS0 rw quiet',
          autostart: true, disable_keyboard: true,
          disable_mouse: true, disable_speaker: true, screen_dummy: true,
          filesystem: {},
        });

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
          if (self._muteCount === 0) {
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
          if (self._muteCount === 0) {
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
  };

  TutorialCode.prototype._setupFilesystem = function () {
    var self = this;
    // Sync terminal dimensions so bash/readline wraps at the correct column
    var cols = (this._pendingStty && this._pendingStty.cols) || (this.term && this.term.cols) || 80;
    var rows = (this._pendingStty && this._pendingStty.rows) || (this.term && this.term.rows) || 24;
    this._pendingStty = null;
    this._lastStty = { cols: cols, rows: rows };
    // Batch all init commands into a single _runSilent call so there is only
    // one marker/prompt detection cycle regardless of how many setup commands
    // there are.  Once the shell confirms they have all completed, clear the
    // terminal immediately via xterm so the user always starts with a clean slate.
    var initScript = ['cd /tutorial', 'export HISTCONTROL=ignoreboth',
                      'stty cols ' + cols + ' rows ' + rows]
                     .concat(self.setupCommands)
                     .join('; ');
    // Stay muted after setup — _refreshPrompt will clear and unmute once
    // the full restore sequence (files + commands) has finished.
    return self._runSilent(initScript).then(function () {
      // Snapshot the VM right after boot + setup commands so "commands" resets
      // can restore to a clean filesystem before replaying solutions.
      if (self.resetType === 'commands' && self.emulator && self.emulator.save_state) {
        return self.emulator.save_state().then(function (state) {
          self._initialVMState = state;
        });
      }
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
    // Set to 1 (not 0) because _refreshPrompt will do the final decrement
    // to 0 after the restore sequence finishes.  Setting 0 here would cause
    // _refreshPrompt's _muteCount-- to underflow to -1, permanently muting
    // all terminal output.
    this._muteCount = 1;
    this._silentQueue = [];
    this._silentRunning = false;
    this._gitGraphHookInstalled = false;
  };

  TutorialCode.prototype._refreshPrompt = function () {
    if (this.config.backend === 'v86') {
      if (this.term) this.term.clear();
      this._muteCount--;  // drop from 1 → 0; everything after this is visible
      if (this.emulator) this.emulator.serial0_send('\n');
    } else if (this.config.backend === 'webcontainer') {
      if (this._shellWriter) this._shellWriter.write('\n');
    }
  };

  TutorialCode.prototype.sendCommand = function (cmd) {
    if (this.config.backend === 'v86') {
      if (this.emulator) this.emulator.serial0_send(cmd + '\n');
    } else if (this.config.backend === 'webcontainer') {
      if (this._shellWriter) this._shellWriter.write(cmd + '\n');
    }
    // pyodide: no interactive shell command
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

    self._muteCount++;
    function onByte(byte) {
      buf += String.fromCharCode(byte);
      var mi = buf.indexOf(marker);
      if (mi !== -1) {
        var tail = buf.substring(mi + marker.length);
        if (tail.includes('# ') || tail.includes('$ ')) {
          self.emulator.remove_listener('serial0-output-byte', onByte);
          clearTimeout(timer);
          self._muteCount--;
          entry.resolve();
          self._drainSilentQueue();
        }
      }
    }
    self.emulator.add_listener('serial0-output-byte', onByte);
    var timer = setTimeout(function () {
      self.emulator.remove_listener('serial0-output-byte', onByte);
      self._muteCount--;
      entry.resolve();
      self._drainSilentQueue();
    }, 30000);
    self.sendCommand(' ' + entry.cmd + ' #' + marker);
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
        self._visFilterMarker = ' #' + marker;
        self._visFilterBuf = '';
        self.sendCommand(' ' + cmd + ' #' + marker);
      });
    } else if (this.config.backend === 'webcontainer') {
      self.sendCommand(cmd);
      return delay(800);
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
          if (setupCmds.length > 0) {
            self._postWorker({ type: 'runCode', code: setupCmds.join('\n'), silent: true },
              function () { resolve(); });
          } else {
            resolve();
          }
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
    var span = document.createElement('span');
    span.className = 'tvm-out-' + (type || 'stdout');
    span.textContent = text;
    this.outputPre.appendChild(span);
    // Auto-scroll
    var container = this.outputPre.parentElement;
    if (container) container.scrollTop = container.scrollHeight;
  };

  TutorialCode.prototype._clearOutput = function () {
    if (this.outputPre) this.outputPre.innerHTML = '';
  };

  TutorialCode.prototype._runCurrentFile = function () {
    if (!this.activeFileName) return;
    var backend = this.config.backend;
    var self = this;
    var filename = this.activeFileName;

    if (backend === 'browser') {
      var code = this.editorModels[filename] ? this.editorModels[filename].model.getValue() : '';
      self._clearOutput();
      self._appendOutput('\u25b6 ' + filename + '\n', 'info');
      var runBtn = self.root.querySelector('.tvm-run-btn');
      if (runBtn) { runBtn.disabled = true; runBtn.textContent = '\u23f3 Running\u2026'; }
      self._runBrowserCode(code, function (text, kind) {
        self._appendOutput(text, kind === 'stderr' ? 'err' : 'out');
      }, function () {
        if (runBtn) { runBtn.disabled = false; runBtn.textContent = '\u25b6 Run'; }
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
          if (runBtn) { runBtn.disabled = false; runBtn.textContent = '\u25b6 Run'; }
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
          if (runBtn) { runBtn.disabled = false; runBtn.textContent = '\u25b6 Run'; }
          if (msg.exitCode !== 0 && !query) self._appendOutput('\n\u2717 Error\n', 'err');
        });
      });
      return;
    }

    if (backend !== 'pyodide') return;
    var path = '/tutorial/' + filename;

    // Sync first, then run
    this._syncFileToBackend(filename, function () {
      self._clearOutput();
      self._appendOutput('\u25b6 ' + filename + '\n', 'info');

      var runBtn = self.root.querySelector('.tvm-run-btn');
      if (runBtn) { runBtn.disabled = true; runBtn.textContent = '\u23f3 Running\u2026'; }

      var args = [];
      var argsInp = self.root.querySelector('.tvm-args-input');
      if (argsInp && argsInp.style.display !== 'none' && argsInp.value.trim() !== '') {
        var matches = argsInp.value.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
        args = matches.map(function (s) { return s.replace(/^"|"$/g, ''); });
      }

      self._postWorker({ type: 'run', path: path, args: args }, function (msg) {
        if (runBtn) { runBtn.disabled = false; runBtn.textContent = '\u25b6 Run'; }
        if (msg.exitCode === 0) {
          self._appendOutput('\n\u2713 Done\n', 'info');
        } else {
          self._appendOutput('\n\u2717 Exited with error\n', 'err');
        }
      });
    });
  };

  // ---- WebContainers backend -------------------------------------------------
  TutorialCode.prototype._initWebContainer = function () {
    var self = this;
    this._showLoading('Booting WebContainers\u2026');

    return import(CDN.WEBCONTAINER).then(function (module) {
      var WebContainer = module.WebContainer;
      return WebContainer.boot();
    }).then(function (wc) {
      self._webcontainer = wc;

      // Pre-create /tutorial directory
      return wc.fs.mkdir('tutorial', { recursive: true }).then(function () {
        return self._startWebContainerShell();
      });
    }).then(function () {
      self.booted = true;

      // Run setup commands in the shell
      if (self.setupCommands.length > 0) {
        self.setupCommands.forEach(function (cmd) { self.sendCommand(cmd); });
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
  TutorialCode.prototype._runBrowserCode = function (code, onOutput, onDone) {
    // Tear down any previous runner
    if (this._jsRunnerFrame) {
      try { document.body.removeChild(this._jsRunnerFrame); } catch (e) { }
      this._jsRunnerFrame = null;
    }

    var frame = document.createElement('iframe');
    frame.style.cssText = 'display:none;position:absolute;left:-9999px;width:1px;height:1px;';
    frame.setAttribute('sandbox', 'allow-scripts');
    document.body.appendChild(frame);
    this._jsRunnerFrame = frame;

    var runId = ++this._jsRunnerMsgId;
    var done = false;

    function finish() {
      if (done) return;
      done = true;
      window.removeEventListener('message', msgListener);
      if (onDone) onDone();
    }

    var safetyTimer = setTimeout(finish, 6000);

    function msgListener(e) {
      if (!e.data || e.data.__jsrun !== true || e.data.__rid !== runId) return;
      if (e.data.type === 'done') { clearTimeout(safetyTimer); finish(); return; }
      if (onOutput) onOutput(e.data.text || '', e.data.type === 'stderr' ? 'stderr' : 'stdout');
    }
    window.addEventListener('message', msgListener);

    var rid = runId;
    var escaped = code.split('<\/script>').join('<\\/script>');

    frame.srcdoc = '<!DOCTYPE html><html><head><script>\n' +
      '(function(){\n' +
      'var rid=' + rid + ';\n' +
      'function __s(t,x){parent.postMessage({__jsrun:true,__rid:rid,type:t,text:x},"*");}\n' +
      'function __f(a){return Array.from(a).map(function(v){\n' +
      '  return typeof v==="object"&&v!==null?JSON.stringify(v,null,2):String(v);\n' +
      '}).join(" ");}\n' +
      'console.log =function(){__s("stdout",__f(arguments)+"\\n");};\n' +
      'console.info =function(){__s("stdout",__f(arguments)+"\\n");};\n' +
      'console.warn =function(){__s("stdout","[warn] "+__f(arguments)+"\\n");};\n' +
      'console.error=function(){__s("stderr",__f(arguments)+"\\n");};\n' +
      'window.onerror=function(m,src,l,c,e){\n' +
      '  __s("stderr",(e&&(e.stack||e.message)?e.stack||e.message:m)+"\\n");\n' +
      '  return true;\n' +
      '};\n' +
      'window.addEventListener("unhandledrejection",function(e){\n' +
      '  __s("stderr","UnhandledPromiseRejection: "+(e.reason?e.reason.message||String(e.reason):"Unknown")+"\\n");\n' +
      '});\n' +
      '})();\n' +
      '<\/script></head><body><script>\n' +
      'try{\n' +
      escaped + '\n' +
      '}catch(e){console.error(e.stack||e.message);}\n' +
      'setTimeout(function(){parent.postMessage({__jsrun:true,__rid:' + rid + ',type:"done"},"*");},1500);\n' +
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

  TutorialCode.prototype._buildReactSrcdoc = function (step) {
    var self = this;
    var fileOrder;
    if (step && step.react_files) {
      fileOrder = step.react_files;
    } else if (step && step.files) {
      fileOrder = step.files.map(function (f) { return f.path; });
    } else {
      fileOrder = Object.keys(self.editorModels);
    }

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
      '<script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"><\/script>\n' +
      '<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\/script>\n' +
      '<script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>\n' +
      '<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">\n' +
      '<script src="https://cdn.jsdelivr.net/npm/react-bootstrap@2.10.7/dist/react-bootstrap.min.js"><\/script>\n' +
      '<style>\n* { box-sizing: border-box; }\n' +
      'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;\n' +
      '       padding: 0; margin: 0; background: ' + bodyBg + '; color: ' + bodyColor + '; }\n' +
      customStyles + '\n</style>\n</head>\n<body>\n<div id="root"></div>\n' +
      scripts + '\n</body>\n</html>';
  };

  // ---------------------------------------------------------------------------
  // Monaco Editor
  // ---------------------------------------------------------------------------
  TutorialCode.prototype._initEditor = function () {
    var self = this;
    this.editor = monaco.editor.create(this.editorContainerEl, {
      value: '// Follow the tutorial steps on the left.\n',
      language: this.config.backend === 'pyodide' ? 'python' :
        this.config.backend === 'react' ? 'javascript' :
          this.config.backend === 'browser' ? 'javascript' :
            this.config.backend === 'prolog' ? 'prolog' : 'shell-sebook',
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
    });

    // Ctrl/Cmd+S — save
    this.editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      function () { self._saveCurrentFile(); }
    );

    // Ctrl/Cmd+Enter — run (Python and browser JS)
    if (this.config.backend === 'pyodide' || this.config.backend === 'browser') {
      this.editor.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
        function () { self._runCurrentFile(); }
      );
    }

    return Promise.resolve();
  };

  TutorialCode.prototype.openFile = function (filename, content, language) {
    language = language || detectLanguage(filename);
    if (!this.editorModels[filename]) {
      var model = monaco.editor.createModel(content || '', language);
      this.editorModels[filename] = { model: model, filename: filename, lastSyncContent: content || '' };
      var self = this;
      var saveTimer;
      model.onDidChangeContent(function () {
        if (self._suppressAutoSave) return;
        clearTimeout(saveTimer);
        saveTimer = setTimeout(function () { self._syncFileToBackend(filename); }, 800);
        // Trigger UML refresh if this file is in the watched list
        if (self._umlWatchedFiles.indexOf(filename) !== -1) {
          self._scheduleUMLRefresh();
        }
      });
    } else if (content !== undefined) {
      this.editorModels[filename].model.setValue(content);
    }
    this._setActiveFile(filename);
    this._renderTabs();
  };

  TutorialCode.prototype._setActiveFile = function (filename) {
    var entry = this.editorModels[filename];
    if (entry) { this.activeFileName = filename; this.editor.setModel(entry.model); }
  };

  TutorialCode.prototype._renderTabs = function () {
    var self = this;
    this.editorTabsEl.innerHTML = '';
    Object.keys(this.editorModels).forEach(function (filename) {
      var tab = document.createElement('div');
      tab.className = 'tvm-tab' + (filename === self.activeFileName && !self._umlViewActive ? ' active' : '');
      tab.textContent = filename;
      tab.addEventListener('click', function () {
        self._umlViewActive = false;
        self._showEditorHideDiagram();
        self._setActiveFile(filename);
        self._renderTabs();
      });
      var x = document.createElement('span');
      x.className = 'tvm-tab-close'; x.textContent = '\u00d7';
      x.addEventListener('click', function (e) { e.stopPropagation(); self._closeFile(filename); });
      tab.appendChild(x);
      self.editorTabsEl.appendChild(tab);
    });

    // Append pinned UML Diagram tab if enabled for this tutorial
    if (this._umlDiagramEnabled && this._umlWatchedFiles.length > 0) {
      var umlTab = document.createElement('div');
      umlTab.className = 'tvm-tab tvm-tab-diagram' + (this._umlViewActive ? ' active' : '');
      umlTab.textContent = '\u2b22 UML Diagram';  // hexagon icon
      umlTab.addEventListener('click', function () {
        self._umlViewActive = true;
        self._showDiagramHideEditor();
        self._refreshUMLDiagram();
        self._renderTabs();
      });
      this.editorTabsEl.appendChild(umlTab);
    }

    // Ensure the active tab is always visible — scroll it into view horizontally
    // without affecting page-level vertical scroll (block: 'nearest').
    var activeTab = this.editorTabsEl.querySelector('.tvm-tab.active');
    if (activeTab) activeTab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  TutorialCode.prototype._closeFile = function (filename) {
    var entry = this.editorModels[filename];
    if (!entry) return;
    entry.model.dispose();
    delete this.editorModels[filename];
    if (this.activeFileName === filename) {
      var remaining = Object.keys(this.editorModels);
      if (remaining.length > 0) this._setActiveFile(remaining[0]);
      else { this.activeFileName = null; this.editor.setModel(monaco.editor.createModel('')); }
    }
    this._renderTabs();
  };

  TutorialCode.prototype._saveCurrentFile = function () {
    if (!this.activeFileName) return;
    this._syncFileToBackend(this.activeFileName);
    var tab = this.editorTabsEl.querySelector('.tvm-tab.active');
    if (tab) { tab.classList.add('saved'); setTimeout(function () { tab.classList.remove('saved'); }, 1200); }
    if (this.autoSaveEnabled) this._saveFile(this.activeFileName);
  };

  // ---------------------------------------------------------------------------
  // UML Diagram Methods
  // ---------------------------------------------------------------------------

  /** Show diagram container, hide Monaco editor */
  TutorialCode.prototype._showDiagramHideEditor = function () {
    if (this.editorContainerEl) this.editorContainerEl.style.display = 'none';
    if (this._umlContainer) this._umlContainer.style.display = 'flex';
  };

  /** Show Monaco editor, hide diagram container */
  TutorialCode.prototype._showEditorHideDiagram = function () {
    if (this._umlContainer) this._umlContainer.style.display = 'none';
    if (this.editorContainerEl) this.editorContainerEl.style.display = '';
    if (this.editor) {
      var self = this;
      requestAnimationFrame(function () { self.editor.layout(); });
    }
  };

  /** Lazily load the Python UML analyzer source code */
  TutorialCode.prototype._loadUMLAnalyzer = function (callback) {
    if (this._umlAnalyzerCode) { callback(this._umlAnalyzerCode); return; }
    var self = this;
    var path = this.config.umlAnalyzerPath || '/js/uml-analyzer.py';
    fetch(path)
      .then(function (r) { return r.text(); })
      .then(function (code) {
        self._umlAnalyzerCode = code;
        callback(code);
      })
      .catch(function (err) {
        console.error('Failed to load UML analyzer:', err);
        self._showUMLError('Failed to load UML analyzer script.');
      });
  };

  /**
   * Collect watched file sources, send to Pyodide, parse result.
   * Only analyzes files listed in _umlWatchedFiles for the current step.
   */
  TutorialCode.prototype._refreshUMLDiagram = function () {
    if (!this._umlDiagramEnabled || !this._worker) return;
    var self = this;

    // Collect sources from watched files
    var sources = {};
    var pending = this._umlWatchedFiles.length;
    if (pending === 0) {
      this._showUMLEmpty('No Python files to analyze for this step.');
      return;
    }

    // Read each watched file's current editor content (or from backend)
    this._umlWatchedFiles.forEach(function (filename) {
      var entry = self.editorModels[filename];
      if (entry) {
        sources[filename] = entry.model.getValue();
        pending--;
        if (pending === 0) self._runUMLAnalysis(sources);
      } else {
        // File not open in editor — try reading from Pyodide FS
        self._postWorker({ type: 'read', path: '/tutorial/' + filename }, function (msg) {
          if (msg.type === 'read_ok') {
            sources[filename] = msg.content;
          }
          pending--;
          if (pending === 0) self._runUMLAnalysis(sources);
        });
      }
    });
  };

  /** Run the analyzer in Pyodide with the collected sources */
  TutorialCode.prototype._runUMLAnalysis = function (sources) {
    var self = this;
    this._loadUMLAnalyzer(function (analyzerCode) {
      // Build Python code: set __uml_sources global, run analyzer,
      // write JSON result to a temp file (avoids stdout interception issues).
      var sourcesJson = JSON.stringify(sources);
      var code =
        '__uml_sources = ' + sourcesJson + '\n' +
        analyzerCode + '\n' +
        'import json as _json\n' +
        'with open("/tmp/__uml_result.json", "w") as _f:\n' +
        '    _f.write(_json.dumps(result) if "result" in dir() else "{}")\n';

      // Run silently so nothing leaks to the output panel
      self._postWorker({ type: 'runCode', code: code, silent: true }, function (msg) {
        if (msg.exitCode !== 0) {
          self._showUMLError('Python analysis failed (syntax error in source?).');
          return;
        }
        // Read the result file back
        self._postWorker({ type: 'read', path: '/tmp/__uml_result.json' }, function (readMsg) {
          if (readMsg.type !== 'read_ok') {
            self._showUMLError('Could not read analysis results.');
            return;
          }
          try {
            var result = JSON.parse(readMsg.content);
            self._umlLastDiagrams = result;
            self._renderCurrentUMLDiagram();
          } catch (err) {
            console.error('UML JSON parse error:', err);
            self._showUMLError('Analysis returned invalid JSON.');
          }
        });
      });
    });
  };

  /** Render whichever diagram type is currently selected */
  TutorialCode.prototype._renderCurrentUMLDiagram = function () {
    if (!this._umlLastDiagrams) {
      this._showUMLEmpty('Click Refresh or edit a Python file to generate diagrams.');
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
  };

  /** Render class diagram using the custom SVG renderer */
  TutorialCode.prototype._renderClassDiagramSVG = function (syntax) {
    if (!this._umlContentEl || !window.UMLClassDiagram) {
      this._showUMLError('UML renderer not loaded.');
      return;
    }
    this._umlContentEl.innerHTML = '';
    UMLClassDiagram.render(this._umlContentEl, syntax);
    var zoomLabel = this._umlContainer ? this._umlContainer.querySelector('.tvm-diagram-zoom-label') : null;
    this._applyUMLZoom(this._umlContentEl, this._umlZoom, zoomLabel);
  };

  /** Render sequence diagram using the custom SVG renderer */
  TutorialCode.prototype._renderSequenceDiagramSVG = function (syntax) {
    if (!this._umlContentEl || !window.UMLSequenceDiagram) {
      this._showUMLError('UML sequence renderer not loaded.');
      return;
    }
    this._umlContentEl.innerHTML = '';
    UMLSequenceDiagram.render(this._umlContentEl, syntax);
    var zoomLabel = this._umlContainer ? this._umlContainer.querySelector('.tvm-diagram-zoom-label') : null;
    this._applyUMLZoom(this._umlContentEl, this._umlZoom, zoomLabel);
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
    try {
      if (this._umlActiveType === 'sequence') {
        var seqSyntax = this._umlLastDiagrams.sequenceDiagram;
        if (seqSyntax && window.UMLSequenceDiagram) {
          UMLSequenceDiagram.render(this._umlFsContentEl, seqSyntax);
        } else {
          this._umlFsContentEl.innerHTML = '<div class="tvm-diagram-empty">No sequence diagram available.</div>';
        }
      } else {
        var classSyntax = this._umlLastDiagrams.classDiagram;
        if (classSyntax && window.UMLClassDiagram) {
          UMLClassDiagram.render(this._umlFsContentEl, classSyntax);
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

    // Sync type buttons
    var fsTypeBtns = this._umlFullscreenEl.querySelectorAll('.tvm-diagram-fs-type-btn');
    for (var i = 0; i < fsTypeBtns.length; i++) {
      fsTypeBtns[i].classList.toggle('active', fsTypeBtns[i].getAttribute('data-type') === this._umlActiveType);
    }

    // Reset zoom for new fullscreen session
    this._umlFsZoom = 1;
    var fzLabel = this._umlFullscreenEl.querySelector('.tvm-diagram-fs-zoom-label');
    if (fzLabel) fzLabel.textContent = '100%';

    // Move overlay to body to escape any parent stacking context / transform
    if (this._umlFullscreenEl.parentNode !== document.body) {
      document.body.appendChild(this._umlFullscreenEl);
    }

    this._renderUMLInFullscreen();
    this._umlFullscreenEl.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  };

  /** Close the fullscreen overlay */
  TutorialCode.prototype._closeUMLFullscreen = function () {
    if (!this._umlFullscreenEl) return;
    this._umlFullscreenEl.style.display = 'none';
    document.body.style.overflow = '';
    if (this._umlFsContentEl) this._umlFsContentEl.innerHTML = '';
  };

  /**
   * Schedule a debounced UML refresh when a watched file changes.
   * Called from the editor onDidChangeContent handler.
   */
  TutorialCode.prototype._scheduleUMLRefresh = function () {
    if (!this._umlDiagramEnabled || !this._umlViewActive) return;
    var self = this;
    clearTimeout(this._umlRefreshTimer);
    this._umlRefreshTimer = setTimeout(function () {
      self._refreshUMLDiagram();
    }, 1500);
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

    return new Promise(function (resolve) {
      var done = function () { if (callback) callback(); resolve(); };

      if (self.config.backend === 'v86') {
        self._syncFileToV86(filename, content).then(done).catch(done);

      } else if (self.config.backend === 'pyodide' || self.config.backend === 'sql' || self.config.backend === 'prolog') {
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
        clearTimeout(self._reactRebuildTimer);
        self._reactRebuildTimer = setTimeout(function () {
          self._rebuildReactPreview();
          done();
        }, 400);

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
        self.openFile(f.path, f.content, f.language);
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
        // Use --no-pager for git commands so interactive pagers don't stall
        // the serial stream between sequenced solution commands.
        solution.commands.forEach(function (cmd) {
          p = p.then(function () {
            return self._runVisible(cmd.replace(/^git /, 'git --no-pager '));
          });
        });
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
      } else if (this.config.backend === 'prolog' || this.config.backend === 'sql') {
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

    // 5. Show explanation if present
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
    var files = {};
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
   */
  TutorialCode.prototype._applySavedFiles = function (files, activeFile) {
    if (!files) return;
    var self = this;
    self._suppressAutoSave = true;
    for (var name in files) {
      if (files.hasOwnProperty(name)) {
        self.openFile(name, files[name].content, files[name].language);
        self._syncFileToBackend(name);
      }
    }
    self._suppressAutoSave = false;
    if (activeFile && self.editorModels[activeFile]) {
      self._setActiveFile(activeFile);
    }
    self._renderTabs();
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

    if (self.resetType === 'commands' && self.currentStep > 0) {
      return self._resetStepWithCommands();
    }

    // Default "files" reset: just reload starter files
    if (!step.files) return;
    self._suppressAutoSave = true;
    step.files.forEach(function (f) {
      self.openFile(f.path, f.content, f.language);
      self._syncFileToBackend(f.path);
      self._originalContent[f.path] = f.content || '';
    });
    self._suppressAutoSave = false;
    if (step.open_file) { self._setActiveFile(step.open_file); }
    self._renderTabs();
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

    // Replay steps 0 … currentStep-1: starter files → solution files → solution commands
    for (var i = 0; i < targetStep; i++) {
      (function (stepIdx) {
        var st = self.steps[stepIdx];
        if (!st) return;

        p = p.then(function () {
          self._showLoading('Resetting step\u2026 (step ' + (stepIdx + 1) + ' of ' + totalSteps + ')');
        });

        // 1. Apply step starter files
        if (st.files) {
          p = p.then(function () {
            self._suppressAutoSave = true;
            var syncs = [];
            st.files.forEach(function (f) {
              self.openFile(f.path, f.content, f.language);
              syncs.push(Promise.resolve(self._syncFileToBackend(f.path)));
              self._originalContent[f.path] = f.content || '';
            });
            self._suppressAutoSave = false;
            return Promise.all(syncs);
          });
        }

        // 2. Apply solution files
        if (st.solution && st.solution.files) {
          p = p.then(function () {
            self._suppressAutoSave = true;
            var syncs = [];
            st.solution.files.forEach(function (f) {
              self.openFile(f.path, f.content, f.language);
              syncs.push(Promise.resolve(self._syncFileToBackend(f.path)));
            });
            self._suppressAutoSave = false;
            return Promise.all(syncs);
          });
        }

        // 3. Run solution commands
        if (st.solution && st.solution.commands && st.solution.commands.length > 0) {
          if (self.config.backend === 'v86' || self.config.backend === 'webcontainer') {
            var batch = st.solution.commands
              .map(function (cmd) { return cmd.replace(/^git /, 'git --no-pager '); })
              .join('; ');
            p = p.then(function () { return self._runSilent(batch); });
          }
        }
      })(i);
    }

    // Apply current step's starter files
    var curStep = self.steps[targetStep];
    if (curStep && curStep.files) {
      p = p.then(function () {
        self._suppressAutoSave = true;
        var syncs = [];
        curStep.files.forEach(function (f) {
          self.openFile(f.path, f.content, f.language);
          syncs.push(Promise.resolve(self._syncFileToBackend(f.path)));
          self._originalContent[f.path] = f.content || '';
        });
        self._suppressAutoSave = false;
        return Promise.all(syncs);
      });
    }

    // Run current step's setup_commands
    if (curStep && curStep.setup_commands && curStep.setup_commands.length > 0) {
      if (self.config.backend === 'v86' || self.config.backend === 'webcontainer') {
        var setupBatch = curStep.setup_commands
          .map(function (cmd) { return cmd.replace(/^git /, 'git --no-pager '); })
          .join('; ');
        p = p.then(function () { return self._runSilent(setupBatch); });
      }
    }

    // Reveal the tutorial
    p = p.then(function () {
      self._suppressAutoSave = false;
      if (curStep && curStep.open_file) { self._setActiveFile(curStep.open_file); }
      self._renderTabs();
      self._autoSaveProgress();
      // Clear terminal, unmute, and show a fresh prompt after the silent replay
      if (self.term) self.term.clear();
      self._muteCount = 0;
      if (self.emulator) self.emulator.serial0_send('\n');
      self._hideLoading();
      self._refreshGitGraph();
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

    for (var i = 0; i < targetStep; i++) {
      (function (stepIdx) {
        var step = self.steps[stepIdx];
        if (!step) return;

        // Update loading message with live step counter
        p = p.then(function () {
          self._showLoading('Restoring your progress\u2026 (step ' + (stepIdx + 1) + ' of ' + totalSteps + ')');
        });

        // 1. Apply step starter files
        if (step.files) {
          p = p.then(function () {
            self._suppressAutoSave = true;
            var syncs = [];
            step.files.forEach(function (f) {
              self.openFile(f.path, f.content, f.language);
              syncs.push(Promise.resolve(self._syncFileToBackend(f.path)));
              self._originalContent[f.path] = f.content || '';
            });
            self._suppressAutoSave = false;
            return Promise.all(syncs);
          });
        }

        // 2. Apply solution files
        if (step.solution && step.solution.files) {
          p = p.then(function () {
            self._suppressAutoSave = true;
            var syncs = [];
            step.solution.files.forEach(function (f) {
              self.openFile(f.path, f.content, f.language);
              syncs.push(Promise.resolve(self._syncFileToBackend(f.path)));
            });
            self._suppressAutoSave = false;
            return Promise.all(syncs);
          });
        }

        // 3. Run solution commands silently — batch into one _runSilent call
        //    per step so we only pay one round-trip instead of one per command.
        if (step.solution && step.solution.commands && step.solution.commands.length > 0) {
          if (self.config.backend === 'v86' || self.config.backend === 'webcontainer') {
            var batch = step.solution.commands
              .map(function (cmd) { return cmd.replace(/^git /, 'git --no-pager '); })
              .join('; ');
            p = p.then(function () { return self._runSilent(batch); });
          }
        }
      })(i);
    }

    // 4. Apply the saved step's starter files
    var savedStepObj = self.steps[targetStep];
    if (savedStepObj && savedStepObj.files) {
      p = p.then(function () {
        self._suppressAutoSave = true;
        var syncs = [];
        savedStepObj.files.forEach(function (f) {
          self.openFile(f.path, f.content, f.language);
          syncs.push(Promise.resolve(self._syncFileToBackend(f.path)));
          self._originalContent[f.path] = f.content || '';
        });
        self._suppressAutoSave = false;
        return Promise.all(syncs);
      });
    }

    // 5. Apply autosaved student file overrides, then reveal the tutorial
    p = p.then(function () {
      self._applySavedFiles(saved.files, saved.activeFile);
      self._suppressAutoSave = false;
      // Persist the correctly-restored state immediately so a crash/reload
      // right after restore doesn't revert to starter-file content.
      self._autoSaveProgress();
      self._hideLoading();
    });

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

    var firstVisit = !this._stepsVisited.has(index);
    this._stepsVisited.add(index);
    this.currentStep = index;
    var step = this.steps[index];

    if (this.quizPanelEl) this.quizPanelEl.style.display = 'none';
    if (this.stepContentWrapEl) this.stepContentWrapEl.style.display = '';

    this._renderStepNav();

    var html = '<h2>' + this._escapeHtml(step.title) + '</h2>';
    html += '<div class="tvm-step-instructions">' +
      (step.instructionsHTML || this._renderMarkdown(step.instructions || '')) + '</div>';
    this.stepContentEl.innerHTML = html;
    if (this.stepContentWrapEl) this.stepContentWrapEl.scrollTop = 0;

    this._renderStepControls(index);

    // On first visit: load all files from step definition.
    // On revisit: only load files that are missing from the editor (keeps student edits).
    var self = this;
    if (step.files) {
      self._suppressAutoSave = true;
      step.files.forEach(function (f) {
        if (firstVisit || !self.editorModels[f.path]) {
          self.openFile(f.path, f.content, f.language);
          self._syncFileToBackend(f.path);
          self._originalContent[f.path] = f.content || '';
        }
      });
      self._suppressAutoSave = false;
    }
    if (step.open_file) { self._setActiveFile(step.open_file); self._renderTabs(); }

    if (firstVisit && step.setup_commands) {
      if (this.config.backend === 'v86' || this.config.backend === 'webcontainer') {
        step.setup_commands.forEach(function (cmd) {
          // Commands starting with a space are housekeeping (hidden from
          // history via HISTCONTROL=ignoreboth).  On v86, also run them
          // silently so the user never sees the echo in the terminal.
          if (self.config.backend === 'v86' && cmd.charAt(0) === ' ') {
            self._runSilent(cmd.trim());
          } else {
            self.sendCommand(cmd);
          }
        });
      } else if (this.config.backend === 'pyodide') {
        this._postWorker({ type: 'runCode', code: step.setup_commands.join('\n'), silent: true });
      } else if (this.config.backend === 'prolog') {
        this._postWorker({ type: 'runProlog', code: step.setup_commands.join('\n'), silent: true });
      }
    }

    if (this.config.backend === 'v86') this._startFileWatch(2000);

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
    if (this.config.backend === 'pyodide' || this.config.backend === 'browser' || this.config.backend === 'prolog') this._clearOutput();
    // Rebuild React preview when a new step is loaded
    if (this.config.backend === 'react') {
      var stepSelf = this;
      setTimeout(function () { stepSelf._rebuildReactPreview(); }, 400);
    }

    // Update UML watched files for this step
    if (this._umlDiagramEnabled) {
      if (step.uml_files && step.uml_files.length > 0) {
        this._umlWatchedFiles = step.uml_files.slice();
      } else if (step.files) {
        // Fallback: derive from step's .py files
        this._umlWatchedFiles = step.files
          .filter(function (f) { return f.path && f.path.endsWith('.py'); })
          .map(function (f) { return f.path; });
      } else {
        this._umlWatchedFiles = [];
      }
      this._umlLastDiagrams = null;
      this._renderTabs();  // Update tab bar to show/hide UML tab
    }

    // Switch view between editor, git graph, or UML diagram based on step config.
    // If the step explicitly sets `view:`, auto-switch + update toggle.
    // If not, keep whichever view the user was on (manual toggle persists).
    if (step.view === 'uml_diagram' && this._umlDiagramEnabled) {
      this._umlViewActive = true;
      this._showDiagramHideEditor();
      this._refreshUMLDiagram();
      this._renderTabs();
    } else if (step.view) {
      this._umlViewActive = false;
      this._showEditorHideDiagram();
      this._setView(step.view);
    } else if (this._umlViewActive && this._umlDiagramEnabled) {
      // UML view persists across steps — refresh with new watched files
      this._refreshUMLDiagram();
    }

    // Auto-save progress when navigating to a new step
    if (this.autoSaveEnabled) this._autoSaveProgress();
  };

  TutorialCode.prototype._renderStepNav = function () {
    var self = this;
    this.stepNavEl.innerHTML = '';
    this.steps.forEach(function (step, i) {
      var btn = document.createElement('button');
      var unlocked = self.instructorMode || self._stepsUnlocked.has(i);
      btn.className = 'tvm-step-btn' + (i === self.currentStep ? ' active' : '') + (unlocked ? '' : ' locked');
      btn.textContent = i + 1; btn.title = unlocked ? step.title : step.title + ' (locked)';
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
      ? '<button class="tvm-btn tvm-btn-prev">\u2190 Previous</button>'
      : '<span></span>';
    html += (step.tests && step.tests.length > 0)
      ? '<button class="tvm-btn tvm-btn-test">\u2713 Test My Work</button>'
      : '<span></span>';
    html += index < this.steps.length - 1
      ? '<button class="tvm-btn tvm-btn-next"' + (nextLocked ? ' disabled title="Pass all tests to continue"' : '') + '>Next \u2192</button>'
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
  // Quiz (identical to tutorial-vm.js — backend-agnostic)
  // ---------------------------------------------------------------------------
  TutorialCode.prototype._showStepQuiz = function (stepIndex) {
    var self = this;
    var step = this.steps[stepIndex];
    var quiz = step && step.quiz;
    if (!quiz || !quiz.questions || !quiz.questions.length) return;
    if (this.stepContentWrapEl) this.stepContentWrapEl.style.display = 'none';
    if (this.quizPanelEl) {
      this.quizPanelEl.style.display = '';
      this.quizPanelEl.innerHTML = this._buildQuizHTML(stepIndex, quiz);
      this.quizPanelEl.scrollTop = 0;
      this._initQuizBehavior(stepIndex, quiz.min_score !== undefined ? quiz.min_score : 0.8);
    }
    var total = quiz.questions.length;
    this.stepControlsEl.innerHTML =
      '<button class="tvm-btn tvm-btn-prev tvm-quiz-back">\u2190 Back to Step</button>' +
      '<span class="tvm-quiz-status">Question 1\u2009/\u2009' + total + '</span>' +
      '<span></span>';
    var back = this.stepControlsEl.querySelector('.tvm-quiz-back');
    if (back) back.addEventListener('click', function () { self._hideStepQuiz(); });
  };

  TutorialCode.prototype._hideStepQuiz = function () {
    if (this.quizPanelEl) this.quizPanelEl.style.display = 'none';
    if (this.stepContentWrapEl) this.stepContentWrapEl.style.display = '';
    this._renderStepControls(this.currentStep);
  };

  TutorialCode.prototype._shuffleArray = function (arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };

  TutorialCode.prototype._buildQuizHTML = function (stepIndex, quiz) {
    var self = this;
    var alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var doShuffle = quiz.shuffle !== false;
    var minPct = Math.round((quiz.min_score !== undefined ? quiz.min_score : 0.8) * 100);
    var nextStepNum = stepIndex + 2;

    var questions = (quiz.questions || []).map(function (q) {
      if (q.type === 'parsons') {
        // Parsons problem: lines is the correct order, distractors are extra wrong lines
        var allLines = (q.lines || []).slice();
        var distractors = (q.distractors || []);
        var correctOrder = allLines.slice(); // preserve correct order
        var shuffled = allLines.concat(distractors).slice();
        self._shuffleArray(shuffled);
        return {
          question: q.question || '', type: 'parsons', explanation: q.explanation || '',
          shuffledLines: shuffled, correctOrder: correctOrder, distractors: distractors,
          options: [], correctOriginals: [], correctLabels: []
        };
      }
      var opts = (q.options || []).map(function (text, oi) { return { text: text, originalIndex: oi }; });
      if (doShuffle) self._shuffleArray(opts);
      var correctOriginals = q.type === 'multiple'
        ? (q.correct_indices || []).map(String).sort() : [String(q.correct_index || 0)];
      var correctLabels = [];
      opts.forEach(function (opt, oi) {
        if (correctOriginals.indexOf(String(opt.originalIndex)) !== -1) correctLabels.push(alphabet[oi]);
      });
      return {
        question: q.question || '', type: q.type || 'single', explanation: q.explanation || '',
        options: opts, correctOriginals: correctOriginals, correctLabels: correctLabels
      };
    });
    if (doShuffle) self._shuffleArray(questions);

    var html = '<div class="tvm-quiz-gate-header"><span class="tvm-quiz-gate-icon">&#128203;</span>' +
      '<div><strong>Knowledge Check</strong><p>Score \u2265' + minPct + '% to continue to Step ' + nextStepNum + '</p></div></div>';

    html += '<div class="quiz-container" id="tvm-quiz-' + stepIndex + '">';
    html += '<div class="quiz-header">';
    if (quiz.title) html += '<div class="quiz-title-row"><h3>' + self._escapeHtml(quiz.title) + '</h3></div>';
    html += '<div class="quiz-progress-bar"><div class="progress-fill" style="width:0%"></div></div></div>';
    html += '<div class="quiz-questions">';
    questions.forEach(function (q, qi) {
      html += '<div class="quiz-question-card' + (qi === 0 ? ' active' : '') +
        '" data-question-index="' + qi + '" data-type="' + q.type + '">';
      html += '<div class="question-text">' + self._renderMarkdown(q.question) + '</div>';

      if (q.type === 'parsons') {
        // Parsons problem: drag-and-drop code lines
        html += '<div class="parsons-container">';
        html += '<div class="parsons-label">Drag lines into the solution area in the correct order' +
          (q.distractors.length ? ' (some lines are distractors that should not be used)' : '') + ':</div>';
        html += '<div class="parsons-bank" data-qi="' + qi + '">';
        q.shuffledLines.forEach(function (line, li) {
          var isDistractor = q.distractors.indexOf(line) !== -1;
          html += '<div class="parsons-line" draggable="true" data-line="' +
            self._escapeHtml(line) + '" data-distractor="' + isDistractor + '">' +
            '<span class="parsons-grip">&#8942;&#8942;</span>' +
            '<code>' + self._escapeHtml(line) + '</code></div>';
        });
        html += '</div>';
        html += '<div class="parsons-separator"><span>&#8595; Drop here &#8595;</span></div>';
        html += '<div class="parsons-target" data-qi="' + qi + '"></div>';
        html += '<div class="parsons-actions">' +
          '<button class="parsons-check-btn" data-qi="' + qi + '">Check Order</button>' +
          '<button class="parsons-reset-btn" data-qi="' + qi + '">Reset</button></div>';
        html += '</div>';
        // Store correct order as data attribute
        html += '<div class="parsons-correct-data hidden" data-correct="' +
          self._escapeHtml(JSON.stringify(q.correctOrder)) + '"></div>';
        html += '<div class="quiz-correct-answers">Correct order:<br><span class="correct-labels"><code>' +
          q.correctOrder.map(function (l) { return self._escapeHtml(l); }).join('</code><br><code>') +
          '</code></span></div>';
      } else {
        html += '<div class="quiz-options">';
        q.options.forEach(function (opt, oi) {
          html += '<button class="quiz-option" data-index="' + String(opt.originalIndex) + '"' +
            ' data-correct="' + q.correctOriginals[0] + '"' +
            ' data-correct-indices="' + q.correctOriginals.join(',') + '">' +
            '<span class="option-checkbox"></span><span class="option-label">' + alphabet[oi] + '</span>' +
            '<span class="option-content">' + self._renderMarkdown(opt.text) + '</span></button>';
        });
        html += '</div>';
        if (q.type === 'multiple') html += '<button class="submit-answer-btn" disabled>Submit Answer</button>';
        html += '<div class="quiz-correct-answers">Correct Answer' +
          (q.type === 'multiple' ? 's' : '') + ': <span class="correct-labels">' +
          q.correctLabels.map(function (l) { return '<span class="correct-label-badge">' + l + '</span>'; }).join('') +
          '</span></div>';
      }
      html += '<div class="quiz-explanation hidden"><div class="explanation-title">Explanation</div>' +
        '<div class="explanation-text">' + self._renderMarkdown(q.explanation) + '</div>' +
        '<button class="next-btn">' + (qi < questions.length - 1 ? 'Next Question' : 'See Results') + '</button></div>';
      html += '</div>';
    });
    html += '</div>';
    html += '<div class="quiz-results hidden"><div class="results-content">' +
      '<h4>Knowledge Check Complete!</h4>' +
      '<div class="score-display">Your Score: <span class="current-score">0</span>' +
      '<span style="font-size:0.55em;font-weight:400;"> / ' + questions.length + '</span></div>' +
      '<p class="score-summary"></p><div class="tvm-quiz-threshold">Passing score: ' + minPct + '%</div>' +
      '<div class="results-actions">' +
      '<button class="tvm-quiz-continue-btn hidden">Continue to Step ' + nextStepNum + ' \u2192</button>' +
      '<button class="restart-btn">Try Again</button></div></div></div></div>';
    return html;
  };

  TutorialCode.prototype._initQuizBehavior = function (stepIndex, minScore) {
    var self = this;
    var container = this.quizPanelEl && this.quizPanelEl.querySelector('.quiz-container');
    if (!container) return;
    var progressBar = container.querySelector('.progress-fill');
    var resultsArea = container.querySelector('.quiz-results');
    var scoreDisplay = container.querySelector('.current-score');
    var cards = container.querySelectorAll('.quiz-question-card');
    var total = cards.length, currentQ = 0, score = 0;

    function updateProgress() {
      if (progressBar) progressBar.style.width = (currentQ / total * 100) + '%';
      var s = self.stepControlsEl.querySelector('.tvm-quiz-status');
      if (s) s.textContent = 'Question ' + (currentQ + 1) + '\u2009/\u2009' + total;
    }
    function showQ(idx) {
      cards.forEach(function (c) { c.classList.remove('active'); });
      if (cards[idx]) cards[idx].classList.add('active');
      var sub = cards[idx] && cards[idx].querySelector('.submit-answer-btn');
      if (sub) sub.disabled = true;
      updateProgress();
      if (self.quizPanelEl) self.quizPanelEl.scrollTop = 0;
    }
    function validateSingle(opt, card) {
      var opts = card.querySelectorAll('.quiz-option');
      var exp = card.querySelector('.quiz-explanation');
      var ca = card.querySelector('.quiz-correct-answers');
      var ok = opt.dataset.correct === opt.dataset.index;
      opts.forEach(function (o) { o.setAttribute('disabled', 'true'); });
      if (ok) { opt.classList.add('correct'); score++; }
      else {
        opt.classList.add('incorrect');
        var c = Array.prototype.find
          ? Array.prototype.find.call(opts, function (o) { return o.dataset.index === opt.dataset.correct; })
          : (function () { for (var i = 0; i < opts.length; i++) if (opts[i].dataset.index === opt.dataset.correct) return opts[i]; })();
        if (c) c.classList.add('correct');
      }
      if (ca) ca.style.display = 'flex';
      if (exp) exp.classList.remove('hidden');
    }
    function handleOption(e) {
      var opt = e.currentTarget, card = opt.closest('.quiz-question-card');
      if (!card || card.querySelector('.quiz-explanation:not(.hidden)')) return;
      if (card.dataset.type === 'multiple') {
        opt.classList.toggle('selected');
        var sub = card.querySelector('.submit-answer-btn');
        if (sub) sub.disabled = (card.querySelectorAll('.quiz-option.selected').length === 0);
      } else { validateSingle(opt, card); }
    }
    function handleSubmit(e) {
      var card = e.currentTarget.closest('.quiz-question-card');
      var opts = card.querySelectorAll('.quiz-option');
      var sel = card.querySelectorAll('.quiz-option.selected');
      var exp = card.querySelector('.quiz-explanation');
      var ca = card.querySelector('.quiz-correct-answers');
      var selI = Array.prototype.map.call(sel, function (o) { return o.dataset.index; }).sort().join(',');
      var corI = card.querySelector('.quiz-option').dataset.correctIndices.split(',').sort().join(',');
      opts.forEach(function (o) { o.setAttribute('disabled', 'true'); });
      e.currentTarget.classList.add('hidden');
      if (selI === corI) { sel.forEach(function (o) { o.classList.add('correct'); }); score++; }
      else {
        var cSet = corI.split(',');
        opts.forEach(function (o) {
          if (cSet.indexOf(o.dataset.index) !== -1) o.classList.add('correct');
          else if (o.classList.contains('selected')) o.classList.add('incorrect');
        });
      }
      if (ca) ca.style.display = 'flex';
      if (exp) exp.classList.remove('hidden');
    }
    function nextQ() { currentQ++; currentQ < total ? showQ(currentQ) : finishQuiz(); }
    function finishQuiz() {
      cards.forEach(function (c) { c.classList.remove('active'); });
      if (resultsArea) resultsArea.classList.remove('hidden');
      if (scoreDisplay) scoreDisplay.textContent = score;
      if (progressBar) progressBar.style.width = '100%';
      var st = self.stepControlsEl.querySelector('.tvm-quiz-status');
      var passed = (score / total) >= minScore;
      var summary = container.querySelector('.score-summary');
      var contBtn = container.querySelector('.tvm-quiz-continue-btn');
      var restBtn = container.querySelector('.restart-btn');
      if (passed) {
        if (summary) summary.textContent = 'Great job! You\'re ready for the next step.';
        if (contBtn) contBtn.classList.remove('hidden');
        if (restBtn) restBtn.classList.add('hidden');
        if (st) st.textContent = '\u2713 Passed';
      } else {
        var needed = Math.round(minScore * total);
        if (summary) summary.textContent = 'You scored ' + score + '/' + total + '. Need at least ' +
          needed + ' (' + Math.round(minScore * 100) + '%) to continue. Review and try again!';
        if (contBtn) contBtn.classList.add('hidden');
        if (restBtn) restBtn.classList.remove('hidden');
        if (st) st.textContent = '\u2717 ' + score + '/' + total;
      }
      if (self.quizPanelEl) self.quizPanelEl.scrollTop = 0;
    }
    function restartQuiz() {
      currentQ = 0; score = 0;
      if (resultsArea) resultsArea.classList.add('hidden');
      cards.forEach(function (card) {
        var opts = card.querySelectorAll('.quiz-option');
        var exp = card.querySelector('.quiz-explanation');
        var sub = card.querySelector('.submit-answer-btn');
        var ca = card.querySelector('.quiz-correct-answers');
        opts.forEach(function (o) { o.classList.remove('correct', 'incorrect', 'selected'); o.removeAttribute('disabled'); });
        if (exp) exp.classList.add('hidden');
        if (sub) { sub.classList.remove('hidden'); sub.disabled = true; }
        if (ca) ca.style.display = '';
        // Reset Parsons problems
        var bank = card.querySelector('.parsons-bank');
        var target = card.querySelector('.parsons-target');
        if (bank && target) {
          target.querySelectorAll('.parsons-line').forEach(function (el) {
            el.classList.remove('parsons-correct', 'parsons-incorrect');
            el.setAttribute('draggable', 'true');
            bank.appendChild(el);
          });
          bank.querySelectorAll('.parsons-line').forEach(function (el) {
            el.classList.remove('parsons-correct', 'parsons-incorrect');
            el.setAttribute('draggable', 'true');
          });
          var checkBtn = card.querySelector('.parsons-check-btn');
          var resetBtn = card.querySelector('.parsons-reset-btn');
          if (checkBtn) checkBtn.disabled = false;
          if (resetBtn) resetBtn.disabled = false;
        }
      });
      showQ(0);
    }
    container.querySelectorAll('.quiz-option').forEach(function (b) { b.addEventListener('click', handleOption); });
    container.querySelectorAll('.submit-answer-btn').forEach(function (b) { b.addEventListener('click', handleSubmit); });
    container.querySelectorAll('.next-btn').forEach(function (b) { b.addEventListener('click', nextQ); });
    var rBtn = container.querySelector('.restart-btn');
    if (rBtn) rBtn.addEventListener('click', restartQuiz);
    var cBtn = container.querySelector('.tvm-quiz-continue-btn');
    if (cBtn) cBtn.addEventListener('click', function () {
      self._quizPassed.add(stepIndex); self._stepsUnlocked.add(stepIndex + 1);
      if (self.autoSaveEnabled) self._autoSaveProgress();
      self._hideStepQuiz(); self.loadStep(stepIndex + 1);
    });

    // ── Parsons Problem Drag & Drop ──────────────────────────────────────────
    var parsonsDragEl = null;
    container.addEventListener('dragstart', function (e) {
      if (e.target.classList.contains('parsons-line')) {
        parsonsDragEl = e.target;
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      }
    });
    container.addEventListener('dragend', function (e) {
      if (e.target.classList.contains('parsons-line')) {
        e.target.classList.remove('dragging');
        parsonsDragEl = null;
      }
    });
    container.addEventListener('dragover', function (e) {
      var zone = e.target.closest('.parsons-target') || e.target.closest('.parsons-bank');
      if (zone && parsonsDragEl) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        // Show insertion point
        var target = zone.querySelector('.parsons-target') ? null : zone;
        if (!target) target = zone;
        var afterEl = _getParsonsInsertAfter(target, e.clientY);
        if (afterEl) target.insertBefore(parsonsDragEl, afterEl);
        else target.appendChild(parsonsDragEl);
      }
    });
    container.addEventListener('drop', function (e) {
      var zone = e.target.closest('.parsons-target') || e.target.closest('.parsons-bank');
      if (zone && parsonsDragEl) {
        e.preventDefault();
        var afterEl = _getParsonsInsertAfter(zone, e.clientY);
        if (afterEl) zone.insertBefore(parsonsDragEl, afterEl);
        else zone.appendChild(parsonsDragEl);
      }
    });
    // Click to toggle between bank and target (mobile-friendly)
    container.addEventListener('click', function (e) {
      var line = e.target.closest('.parsons-line');
      if (!line) return;
      var parent = line.parentElement;
      if (!parent) return;
      var card = line.closest('.quiz-question-card');
      if (!card || card.querySelector('.quiz-explanation:not(.hidden)')) return;
      if (parent.classList.contains('parsons-bank')) {
        var tgt = card.querySelector('.parsons-target');
        if (tgt) tgt.appendChild(line);
      } else if (parent.classList.contains('parsons-target')) {
        var bnk = card.querySelector('.parsons-bank');
        if (bnk) bnk.appendChild(line);
      }
    });
    function _getParsonsInsertAfter(zone, y) {
      var els = Array.prototype.slice.call(zone.querySelectorAll('.parsons-line:not(.dragging)'));
      for (var i = 0; i < els.length; i++) {
        var box = els[i].getBoundingClientRect();
        if (y < box.top + box.height / 2) return els[i];
      }
      return null;
    }
    // Check Parsons answer
    container.querySelectorAll('.parsons-check-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var qi = parseInt(btn.dataset.qi);
        var card = btn.closest('.quiz-question-card');
        if (!card) return;
        var target = card.querySelector('.parsons-target');
        var correctData = card.querySelector('.parsons-correct-data');
        if (!target || !correctData) return;
        var correct = JSON.parse(correctData.dataset.correct);
        var placed = Array.prototype.slice.call(target.querySelectorAll('.parsons-line'))
          .map(function (el) { return el.dataset.line; });
        var isCorrect = placed.length === correct.length &&
          placed.every(function (line, i) { return line === correct[i]; });
        // Mark lines
        target.querySelectorAll('.parsons-line').forEach(function (el, i) {
          el.classList.remove('parsons-correct', 'parsons-incorrect');
          if (i < correct.length && el.dataset.line === correct[i]) el.classList.add('parsons-correct');
          else el.classList.add('parsons-incorrect');
        });
        // Mark distractors left in bank as correct (they should stay in bank)
        card.querySelectorAll('.parsons-bank .parsons-line').forEach(function (el) {
          el.classList.remove('parsons-correct', 'parsons-incorrect');
          if (el.dataset.distractor === 'true') el.classList.add('parsons-correct');
          else el.classList.add('parsons-incorrect');
        });
        // Disable further interaction
        card.querySelectorAll('.parsons-line').forEach(function (el) { el.setAttribute('draggable', 'false'); });
        btn.disabled = true;
        card.querySelector('.parsons-reset-btn').disabled = true;
        if (isCorrect) score++;
        var ca = card.querySelector('.quiz-correct-answers');
        var exp = card.querySelector('.quiz-explanation');
        if (ca) ca.style.display = 'flex';
        if (exp) exp.classList.remove('hidden');
      });
    });
    // Reset Parsons
    container.querySelectorAll('.parsons-reset-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('.quiz-question-card');
        if (!card) return;
        var bank = card.querySelector('.parsons-bank');
        var target = card.querySelector('.parsons-target');
        if (!bank || !target) return;
        target.querySelectorAll('.parsons-line').forEach(function (el) {
          el.classList.remove('parsons-correct', 'parsons-incorrect');
          bank.appendChild(el);
        });
      });
    });
  };

  // ---------------------------------------------------------------------------
  // Markdown + HTML utilities
  // ---------------------------------------------------------------------------
  TutorialCode.prototype._renderMarkdown = function (text) {
    if (!text) return '';
    return window.marked ? window.marked.parse(text)
      : text.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n\n/g, '<br><br>');
  };

  TutorialCode.prototype._escapeHtml = function (str) {
    var d = document.createElement('div'); d.textContent = str;
    return d.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  // ---------------------------------------------------------------------------
  // Test Runner — dispatches per backend
  // ---------------------------------------------------------------------------
  TutorialCode.prototype._runTests = function () {
    var backend = this.config.backend;
    if (backend === 'v86') this._runTestsV86();
    else if (backend === 'pyodide') this._runTestsPyodide();
    else if (backend === 'webcontainer') this._runTestsWebContainer();
    else if (backend === 'react') this._runTestsReact();
    else if (backend === 'browser') this._runTestsBrowser();
    else if (backend === 'sql') this._runTestsSQL();
    else if (backend === 'prolog') this._runTestsProlog();
  };

  // v86 — same marker approach as original tutorial-vm.js
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

  // WebContainers — same marker approach, but spawns 'sh' instead of serial
  TutorialCode.prototype._runTestsWebContainer = function () {
    var self = this;
    var step = this.steps[this.currentStep];
    var tests = step && step.tests;
    if (!tests || !tests.length) return;
    this._showTestPanel('<div class="tvm-test-running"><div class="tvm-test-spinner"></div>Running tests\u2026</div>');

    var script = tests.map(function (t, i) {
      return '( ' + t.command + ' ) 2>/dev/null; printf "\\n__TRESULT_' + i + '_%d__\\n" $?';
    }).join('; ') + '; echo "__TDONE__"';

    this._webcontainer.spawn('sh', ['-c', script], { cwd: '/tutorial' })
      .then(function (proc) {
        var output = '';
        var testTimeout;
        var reader = proc.output.getReader();
        var cleanup = function () {
          clearTimeout(testTimeout);
          try { reader.cancel(); } catch (e) { }
          try { proc.kill(); } catch (e) { }
        };

        testTimeout = setTimeout(function () {
          console.warn('WebContainer test timeout exceeded (15s). Force canceling.');
          cleanup();
          parseResults(output);
        }, 15000);

        (function readLoop() {
          reader.read().then(function (result) {
            if (result.done) { cleanup(); parseResults(output); return; }
            output += result.value;
            if (output.includes('__TDONE__')) { cleanup(); parseResults(output); return; }
            readLoop();
          }).catch(function () { cleanup(); parseResults(output); });
        })();
      }).catch(function (err) {
        self._renderTestResults(tests, new Array(tests.length).fill(null));
        console.error('WC test spawn failed:', err);
      });

    function parseResults(output) {
      var results = new Array(tests.length).fill(null);
      var re = /__TRESULT_(\d+)_(\d+)__/g, m;
      while ((m = re.exec(output)) !== null)
        results[parseInt(m[1])] = (parseInt(m[2]) === 0);
      self._renderTestResults(tests, results);
    }
  };

  // React — each test.command is evaluated as JS; `frame` is the preview iframe
  TutorialCode.prototype._runTestsReact = function () {
    var self = this;
    var step = this.steps[this.currentStep];
    var tests = step && step.tests;
    if (!tests || !tests.length) return;
    this._showTestPanel('<div class="tvm-test-running"><div class="tvm-test-spinner"></div>Running tests\u2026</div>');

    // Rebuild a fresh preview, then run tests after React has settled
    this._rebuildReactPreview(function () {
      var frame = self._previewFrame;
      var results = [];
      var AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
      var testTimeout;

      function runNext(i) {
        clearTimeout(testTimeout);
        if (i >= tests.length) { self._renderTestResults(tests, results); return; }

        testTimeout = setTimeout(function () {
          console.warn('React test execution timed out. Asynchronous promise deadlock reached.');
          if (self.term) {
            self.term.write('\n\r\n\r\x1b[31;1mError: React evaluation timed out (15s).\x1b[0m\n\r');
            self.term.write('\x1b[33mTests were unable to complete cleanly (did an awaited promise never resolve?). Please reload the page if frozen!\x1b[0m\n\r');
          }
          self._renderTestResults(tests, new Array(tests.length).fill(null));
        }, 15000);

        try {
          var scripts = frame.contentDocument.querySelectorAll('[type="text/babel"]');
          var source = Array.from(scripts).map(function (s) { return s.textContent; }).join('\n');
          var code = self._stripCode(source);
          /* jshint evil:true */
          var fn = new AsyncFunction('frame', 'code', 'assert', tests[i].command);
          fn(frame, code, function assertFn(cond, msg) {
            if (!cond) throw new Error(msg || 'Assertion failed');
          }).then(function () {
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
  };

  // Browser — runs user code, collects output, then evaluates JS assertions
  // test.command receives: output (string), source (string), assert(cond, msg)
  TutorialCode.prototype._runTestsBrowser = function () {
    var self = this;
    var step = this.steps[this.currentStep];
    var tests = step && step.tests;
    if (!tests || !tests.length) return;
    this._showTestPanel('<div class="tvm-test-running"><div class="tvm-test-spinner"></div>Running tests\u2026</div>');

    var filename = this.activeFileName || (step.files && step.files[0] && step.files[0].path) || '';
    var source = this.editorModels[filename] ? this.editorModels[filename].model.getValue() : '';
    var outputLines = [];

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
          var fn = new Function('output', 'source', 'code', 'assert', tests[i].command);
          fn(output, source, code, function assertFn(cond, msg) {
            if (!cond) throw new Error(msg || 'Assertion failed');
          });
          results[i] = true;
        } catch (e) {
          results[i] = false;
          console.warn('Browser test ' + i + ' failed:', e.message);
        }
        runNext(i + 1);
      }
      runNext(0);
    });
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
      this.stepContentEl.appendChild(panel);
    }
    panel.innerHTML = innerHtml;
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  TutorialCode.prototype._renderTestResults = function (tests, results) {
    var self = this;
    this._testResults = results; // store for hint engine
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
  };

  // ---------------------------------------------------------------------------
  // Reverse File Sync — v86 only (polls 9p FS)
  // ---------------------------------------------------------------------------
  TutorialCode.prototype._pollWatchedFiles = function () {
    if (!this.emulator || !this.booted || this.config.backend !== 'v86') return;
    if (this._reverseSyncBusy) return;
    var self = this;
    var files = Object.keys(this.editorModels);
    if (files.length === 0) return;
    this._reverseSyncBusy = true;
    var promises = files.map(function (filename) {
      return self.emulator.read_file('/' + filename)
        .then(function (buf) {
          var res = self.emulator.fs9p.SearchPath('/' + filename);
          if (res && res.id !== -1) {
            var inode = self.emulator.fs9p.inodes[res.id];
            if (inode.mode & 0x49) self._executableFiles.add(filename);
            else self._executableFiles.delete(filename);
          }
          var content = new TextDecoder('utf-8').decode(buf);
          var entry = self.editorModels[filename];
          if (entry && entry.lastSyncContent !== content) {
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
      if (self.booted) self._pollWatchedFiles();
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
      // Immediately show the last cached graph (avoids "No commits yet" flash)
      this._lightRefreshGitGraph();
      // Then schedule a full dump+read for fresh data
      var self2 = this;
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
    if (this._gitGraphHookInstalled) return;
    this._gitGraphHookInstalled = true;
    var p = this.gitGraphPath || '/tutorial';
    // The hook: a small function appended to PROMPT_COMMAND.
    // It only runs git commands when inside a git repo.
    var hookCmd =
      '__gg_dump() { ' +
      '( cd ' + p + ' 2>/dev/null && [ -d .git ] && ' +
      '{ echo "===LOG==="; git log --all --format="%H|%P|%s|%D" --topo-order 2>/dev/null; ' +
      'echo "===BRANCH==="; git branch 2>/dev/null; ' +
      'echo "===HEAD==="; git symbolic-ref HEAD 2>/dev/null || echo detached; ' +
      '} > ' + p + '/.git/gitgraph_state 2>/dev/null ); }; ' +
      'PROMPT_COMMAND="__gg_dump${PROMPT_COMMAND:+;$PROMPT_COMMAND}"';
    this._runSilent(hookCmd);
  };

  /**
   * Run git state commands silently, writing output to a known file
   * on the 9p-mounted filesystem so we can read it via read_file().
   * Used only for the initial dump (before PROMPT_COMMAND kicks in)
   * and explicit Refresh button clicks.
   */
  TutorialCode.prototype._dumpGitState = function () {
    var p = this.gitGraphPath || '/tutorial';
    return this._runSilent(
      '( cd ' + p + ' && { echo "===LOG==="; git log --all --format="%H|%P|%s|%D" --topo-order 2>/dev/null; echo "===BRANCH==="; git branch 2>/dev/null; echo "===HEAD==="; git symbolic-ref HEAD 2>/dev/null || echo detached; } > ' + p + '/.git/gitgraph_state 2>/dev/null )'
    );
  };

  /**
   * Parse the .gitgraph_state file content and render the SVG graph.
   */
  TutorialCode.prototype._renderGitGraphFromText = function (text) {
    var logOutput = '';
    var branchOutput = '';
    var headRef = '';
    var sections = text.split(/^===(\w+)===$\n?/m);
    for (var i = 0; i < sections.length; i++) {
      if (sections[i] === 'LOG') logOutput = (sections[i + 1] || '').trim();
      if (sections[i] === 'BRANCH') branchOutput = (sections[i + 1] || '').trim();
      if (sections[i] === 'HEAD') headRef = (sections[i + 1] || '').trim();
    }
    var data = GitGraph.parseGitState(logOutput, branchOutput, headRef);
    if (!this._gitGraph) {
      this._gitGraph = new GitGraph(this.gitGraphContainerEl);
    }
    this._gitGraph.render(data);
  };

  /**
   * FULL refresh: runs _dumpGitState (uses serial) then reads the file.
   * Used for: Refresh button clicks, initial _setView, step loads.
   */
  TutorialCode.prototype._refreshGitGraph = function () {
    if (!this.booted || this.config.backend !== 'v86' || !window.GitGraph) return;
    if (this._gitGraphRefreshing) return;
    this._gitGraphRefreshing = true;
    var self = this;

    var safetyTimer = setTimeout(function () { self._gitGraphRefreshing = false; }, 10000);

    // Also ensure the PROMPT_COMMAND hook is installed
    this._installGitGraphPromptHook();

    var stateReadPath = (self.gitGraphPath || '/tutorial').replace(/^\/tutorial/, '') + '/.git/gitgraph_state';

    this._dumpGitState()
      .then(function () {
        return new Promise(function (resolve) { setTimeout(resolve, 150); });
      })
      .then(function () {
        return self.emulator.read_file(stateReadPath);
      })
      .then(function (buf) {
        clearTimeout(safetyTimer);
        self._gitGraphRefreshing = false;
        self._renderGitGraphFromText(new TextDecoder('utf-8').decode(buf));
      })
      .catch(function () {
        clearTimeout(safetyTimer);
        self._gitGraphRefreshing = false;
      });
  };

  /**
   * LIGHT refresh: only reads the .gitgraph_state file via 9p.
   * Zero serial interaction — safe to call at any time.
   * The PROMPT_COMMAND hook keeps the file fresh after every command,
   * so this always returns up-to-date data.
   */
  TutorialCode.prototype._lightRefreshGitGraph = function () {
    if (!this.booted || this.config.backend !== 'v86' || !window.GitGraph) return;
    var self = this;
    var stateReadPath = (this.gitGraphPath || '/tutorial').replace(/^\/tutorial/, '') + '/.git/gitgraph_state';
    this.emulator.read_file(stateReadPath)
      .then(function (buf) {
        self._renderGitGraphFromText(new TextDecoder('utf-8').decode(buf));
      })
      .catch(function () { /* file doesn't exist yet — ignore */ });
  };

  /**
   * Auto-refresh: called from the serial output listener when a shell
   * prompt is detected.  Just reads the file that PROMPT_COMMAND
   * already updated — instant, no serial interaction.
   */
  TutorialCode.prototype._maybeAutoRefreshGitGraph = function () {
    if (this._currentView === 'git_graph' && this.booted) {
      var self = this;
      clearTimeout(this._gitGraphAutoRefreshTimer);
      // Short delay to let the 9p write from PROMPT_COMMAND propagate
      this._gitGraphAutoRefreshTimer = setTimeout(function () {
        self._lightRefreshGitGraph();
      }, 300);
    }
  };

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------
  window.TutorialCode = TutorialCode;

})();
