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
    XTERM_JS:     'https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.min.js',
    XTERM_CSS:    'https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css',
    XTERM_FIT:    'https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.min.js',
    MONACO_LOADER:'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs/loader.min.js',
    MONACO_VS:    'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs',
    MARKED:       'https://cdn.jsdelivr.net/npm/marked@9.1.6/marked.min.js',
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
    txt: 'plaintext', c: 'c', h: 'c', cpp: 'cpp',
    makefile: 'makefile', Makefile: 'makefile',
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
      backend:    backend,
      v86Path:    options.v86Path  || '/assets/v86',
      vmPath:     options.vmPath   || '/vm/dist',
      memoryMB:   options.memoryMB || 256,
      fontSize:   options.fontSize || 14,
      workerPath: options.workerPath || '/js/pyodide-worker.js',
      // Derived flags
      useTerminal: (backend === 'v86' || backend === 'webcontainer'),
      usePreview:  (backend === 'react'),    // live iframe preview for React tutorials
    };

    this.steps         = options.steps        || [];
    this.setupCommands = options.setupCommands || [];
    this.requireTests  = options.requireTests  || false;
    this._stepsPassed  = new Set();
    this._quizPassed   = new Set();
    this.currentStep   = -1;
    this.booted        = false;

    // v86 state
    this.emulator      = null;
    this._muted        = false;
    this._mutedBuffer  = '';
    this._executableFiles = new Set();
    this._inputLine    = '';

    // xterm state
    this.term          = null;
    this.fitAddon      = null;

    // Monaco state
    this.editor        = null;
    this.editorModels  = {};
    this.activeFileName = null;
    this._suppressAutoSave = false;

    // Reverse sync (v86 / webcontainer)
    this._reverseSyncTimer = null;
    this._reverseSyncBusy  = false;

    // Test runner
    this._testListening  = false;
    this._testBuffer     = '';
    this._testResults    = [];
    this._testCallbacks  = [];

    // Pyodide worker state
    this._worker         = null;
    this._workerMsgId    = 0;
    this._workerCallbacks = {};

    // WebContainers state
    this._webcontainer   = null;
    this._shellProcess   = null;
    this._shellWriter    = null;

    // React preview state
    this._previewFrame      = null;
    this._reactRebuildTimer = null;
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
        self._hideLoading();
        if (self.steps.length > 0) self.loadStep(0);
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
      '<div class="tvm-editor-panel">' +
      '<div class="tvm-editor-tabs"></div>' +
      '<div class="tvm-editor-container"></div>' +
      '</div>' +
      '<div class="tvm-vsplitter" title="Drag to resize"></div>' +
      terminalHtml +
      '</div>' +
      '</div>';

    this.loadingEl       = this.root.querySelector('.tvm-loading');
    this.containerEl     = this.root.querySelector('.tvm-container');
    this.stepNavEl       = this.root.querySelector('.tvm-step-nav');
    this.stepContentEl   = this.root.querySelector('.tvm-step-content');
    this.stepContentWrapEl = this.root.querySelector('.tvm-step-content-wrap');
    this.quizPanelEl     = this.root.querySelector('.tvm-quiz-panel');
    this.stepControlsEl  = this.root.querySelector('.tvm-step-controls');
    this.editorTabsEl    = this.root.querySelector('.tvm-editor-tabs');
    this.editorContainerEl = this.root.querySelector('.tvm-editor-container');

    var self = this;
    if (this.config.useTerminal) {
      this.terminalContainerEl = this.root.querySelector('.tvm-terminal-container');
    } else if (this.config.usePreview) {
      this._previewFrame = this.root.querySelector('.tvm-preview-frame');
      var refreshBtn = this.root.querySelector('.tvm-refresh-btn');
      if (refreshBtn) refreshBtn.addEventListener('click', function () { self._rebuildReactPreview(); });
    } else {
      this.outputPre     = this.root.querySelector('.tvm-output-pre');
      this.outputPanel   = this.root.querySelector('.tvm-output-panel');
      var runBtn  = this.root.querySelector('.tvm-run-btn');
      var clearBtn = this.root.querySelector('.tvm-clear-btn');
      if (runBtn)   runBtn.addEventListener('click',  function () { self._runCurrentFile(); });
      if (clearBtn) clearBtn.addEventListener('click', function () { self._clearOutput(); });
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
      if (self.fitAddon) { try { self.fitAddon.fit(); } catch (e) {} }
      if (self.editor)   self.editor.layout();
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
    var hsplitter    = this.root.querySelector('.tvm-hsplitter');
    var instructions = this.root.querySelector('.tvm-instructions-panel');
    var workspace    = this.root.querySelector('.tvm-workspace');
    this._makeDraggable(hsplitter, 'vertical', instructions, workspace);

    var vsplitter    = this.root.querySelector('.tvm-vsplitter');
    var editorPanel  = this.root.querySelector('.tvm-editor-panel');
    var bottomPanel  = this.root.querySelector(
      this.config.useTerminal ? '.tvm-terminal-panel' :
      this.config.usePreview  ? '.tvm-preview-panel'  : '.tvm-output-panel');
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
      afterEl.style.flex  = '1 1 0';
      if (self.fitAddon) self.fitAddon.fit();
      if (self.editor)   self.editor.layout();
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
      brackets: [['{','}'],['[',']']],
      autoClosingPairs: [{open:'{',close:'}'},{open:'[',close:']'},
        {open:'(',close:')'},{open:'"',close:'"'},{open:"'",close:"'"}],
      surroundingPairs: [{open:'{',close:'}'},{open:'[',close:']'},{open:'(',close:')'}],
    });
    monaco.languages.setMonarchTokensProvider('shell-sebook', {
      keywords: ['if','then','else','elif','fi','for','in','do','done','case','esac','while','until','function'],
      builtins: ['echo','set','cd','pwd','export','local','read','return','exit','grep','wc',
                 'head','sort','uniq','cut','cat','mkdir','touch','rm','cp','mv','whoami','date','sleep','which'],
      tokenizer: {
        root: [
          [/^#!.*$/, 'comment.shell-sebook'],
          [/\b(if|then|else|elif|fi|for|in|do|done|case|esac|while|until|function)\b/, 'keyword.shell-sebook'],
          [/[\[\]]/, 'keyword.shell-sebook'],
          [/[a-zA-Z_][\w]*(?==)/, 'variable.shell-sebook'],
          [/[a-zA-Z_][\w]*/, { cases: { '@builtins': 'command.shell-sebook', '@default': 'command.shell-sebook' }}],
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

    monaco.editor.defineTheme('sebook-light', {
      base: 'vs', inherit: true,
      rules: [
        { token: 'keyword.shell-sebook',        foreground: '0000ff' },
        { token: 'command.shell-sebook',         foreground: '267f99' },
        { token: 'variable.shell-sebook',        foreground: '001080' },
        { token: 'attribute.name.shell-sebook',  foreground: 'a31515' },
        { token: 'string.shell-sebook',          foreground: 'a31515' },
        { token: 'comment.shell-sebook',         foreground: '008000' },
      ],
      colors: {},
    });
    monaco.editor.defineTheme('sebook-dark', {
      base: 'vs-dark', inherit: true,
      rules: [
        { token: 'keyword.shell-sebook',        foreground: '569cd6' },
        { token: 'command.shell-sebook',         foreground: '4ec9b0' },
        { token: 'variable.shell-sebook',        foreground: '9cdcfe' },
        { token: 'attribute.name.shell-sebook',  foreground: 'f44747' },
        { token: 'string.shell-sebook',          foreground: 'ce9178' },
        { token: 'comment.shell-sebook',         foreground: '6a9955' },
      ],
      colors: { 'editor.background': '#1e1e1e' },
    });
  };

  // ---------------------------------------------------------------------------
  // Terminal (xterm.js) — v86 + webcontainer only
  // ---------------------------------------------------------------------------
  var THEMES = {
    dark:  { monaco: 'sebook-dark',
      xterm: { background:'#1e1e1e', foreground:'#d4d4d4', cursor:'#d4d4d4', selectionBackground:'#264f78' } },
    light: { monaco: 'sebook-light',
      xterm: { background:'#ffffff', foreground:'#383a42', cursor:'#383a42', selectionBackground:'#add6ff',
               black:'#383a42', red:'#e45649', green:'#50a14f', yellow:'#986801', blue:'#4078f2',
               magenta:'#a626a4', cyan:'#0184bc', white:'#fafafa',
               brightBlack:'#4f525e', brightRed:'#e06c75', brightGreen:'#98c379',
               brightYellow:'#e5c07b', brightBlue:'#61afef', brightMagenta:'#c678dd',
               brightCyan:'#56b6c2', brightWhite:'#ffffff' } },
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
      fontSize:    this.config.fontSize,
      fontFamily:  "'Fira Code', 'Cascadia Code', Menlo, monospace",
      theme:       isDark ? THEMES.dark.xterm : THEMES.light.xterm,
      scrollback:  5000,
      convertEol:  true,
    });
    var FitAddonClass = (window.FitAddon && window.FitAddon.FitAddon)
      ? window.FitAddon.FitAddon : window.FitAddon;
    this.fitAddon = new FitAddonClass();
    this.term.loadAddon(this.fitAddon);
    this.term.open(this.terminalContainerEl);
    this.term.focus();
    setTimeout(function () { self.fitAddon.fit(); }, 100);
    if (window.ResizeObserver) {
      var t; var ro = new ResizeObserver(function () {
        clearTimeout(t); t = setTimeout(function () {
          if (self.fitAddon) { try { self.fitAddon.fit(); } catch (e) {} }
        }, 50);
      });
      ro.observe(this.terminalContainerEl);
    }
    if (window.MutationObserver) {
      var mo = new MutationObserver(function () { self._applyTheme(self._isDarkMode()); });
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    }
  };

  // ---------------------------------------------------------------------------
  // Backend Initialisation — routes to v86 / pyodide / webcontainer
  // ---------------------------------------------------------------------------
  TutorialCode.prototype._initBackend = function () {
    var backend = this.config.backend;
    if (backend === 'v86')          return this._initV86();
    if (backend === 'pyodide')      return this._initPyodide();
    if (backend === 'webcontainer') return this._initWebContainer();
    if (backend === 'react')        return this._initReactBackend();
    return Promise.reject(new Error('Unknown backend: ' + backend));
  };

  // ---- v86 backend (identical to original tutorial-vm.js) -------------------
  TutorialCode.prototype._initV86 = function () {
    var self = this;
    this._showLoading('Booting Linux \u2014 this may take a few seconds\u2026');
    return new Promise(function (resolve, reject) {
      try {
        self.emulator = new V86({
          wasm_path:       self.config.v86Path + '/v86.wasm',
          memory_size:     self.config.memoryMB * 1024 * 1024,
          vga_memory_size: 2 * 1024 * 1024,
          bios:    { url: self.config.v86Path + '/seabios.bin' },
          vga_bios:{ url: self.config.v86Path + '/vgabios.bin' },
          bzimage: { url: self.config.vmPath  + '/bzImage' },
          initrd:  { url: self.config.vmPath  + '/rootfs.cpio.gz' },
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

        self._muted = false;
        self.emulator.add_listener('serial0-output-byte', function (byte) {
          var ch = String.fromCharCode(byte);
          if (!self._muted) self.term.write(ch);
          if (self._testListening) { self._testBuffer += ch; self._parseTestOutput(); }
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
    this.sendCommand('cd /tutorial');
    this.sendCommand('export HISTCONTROL=ignoreboth');
    this.setupCommands.forEach(function (cmd) { self.sendCommand(cmd); });
    this.sendCommand('clear');
    return delay(100);
  };

  TutorialCode.prototype.sendCommand = function (cmd) {
    if (this.config.backend === 'v86') {
      if (this.emulator) this.emulator.serial0_send(cmd + '\n');
    } else if (this.config.backend === 'webcontainer') {
      if (this._shellWriter) this._shellWriter.write(cmd + '\n');
    }
    // pyodide: no interactive shell command
  };

  TutorialCode.prototype._runSilent = function (cmd) {
    var self = this;
    if (this.config.backend !== 'v86') return;
    self._muted = true; self._mutedBuffer = '';
    function onByte(byte) {
      self._mutedBuffer += String.fromCharCode(byte);
      if (self._mutedBuffer.includes('# ') || self._mutedBuffer.includes('$ ')) {
        self._muted = false; self._mutedBuffer = '';
        self.emulator.remove_listener('serial0-output-byte', onByte);
        clearTimeout(timer);
      }
    }
    self.emulator.add_listener('serial0-output-byte', onByte);
    var timer = setTimeout(function () {
      self._muted = false; self._mutedBuffer = '';
      self.emulator.remove_listener('serial0-output-byte', onByte);
    }, 5000);
    self.sendCommand(' ' + cmd);
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
    if (!this.activeFileName || this.config.backend !== 'pyodide') return;
    var self = this;
    var filename = this.activeFileName;
    var path = '/tutorial/' + filename;

    // Sync first, then run
    this._syncFileToBackend(filename, function () {
      self._clearOutput();
      self._appendOutput('\u25b6 ' + filename + '\n', 'info');

      var runBtn = self.root.querySelector('.tvm-run-btn');
      if (runBtn) { runBtn.disabled = true; runBtn.textContent = '\u23f3 Running\u2026'; }

      self._postWorker({ type: 'run', path: path }, function (msg) {
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
        }).catch(function () {});
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

    var scripts = fileOrder.map(function (filename) {
      var entry = self.editorModels[filename];
      if (!entry) return '';
      var content = entry.model.getValue();
      // Strip ES module import/export (global-script approach for browser sandbox)
      content = content.replace(/^\s*import\s+.*$/gm, '');
      content = content.replace(/^\s*export\s+default\s+/gm, '');
      content = content.replace(/^\s*export\s+\{[^}]*\};\s*$/gm, '');
      // Escape </script> closing tags inside content to avoid breaking the outer tag
      content = content.split('<\/script>').join('<\\/script>');
      return '<script type="text/babel">\n' + content + '\n<\/script>';
    }).join('\n');

    var customStyles = (step && step.preview_styles) || '';

    return '<!DOCTYPE html>\n<html lang="en">\n<head>\n' +
      '<meta charset="UTF-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
      '<script>\n' +
      'window.addEventListener("error", function(e) {\n' +
      '  var r = document.getElementById("root");\n' +
      '  if (r) r.innerHTML = \'<div style="color:#c0392b;background:#fdf2f2;border-left:4px \' +\n' +
      '    \'solid #c0392b;padding:16px;margin:16px;font-family:monospace;font-size:13px;\' +\n' +
      '    \'border-radius:4px;white-space:pre-wrap"><strong>Error:</strong><br>\' +\n' +
      '    (e.error ? e.error.message : e.message) + \'</div>\';\n' +
      '});\n' +
      '<\/script>\n' +
      '<script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"><\/script>\n' +
      '<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\/script>\n' +
      '<script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>\n' +
      '<style>\n* { box-sizing: border-box; }\n' +
      'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;\n' +
      '       padding: 0; margin: 0; background: #fff; color: #333; }\n' +
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
      language: this.config.backend === 'pyodide'  ? 'python'      :
                this.config.backend === 'react'     ? 'javascript'  : 'shell-sebook',
      theme:    this._isDarkMode() ? THEMES.dark.monaco : THEMES.light.monaco,
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

    // Ctrl/Cmd+Enter — run (Python only)
    if (this.config.backend === 'pyodide') {
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
      tab.className = 'tvm-tab' + (filename === self.activeFileName ? ' active' : '');
      tab.textContent = filename;
      tab.addEventListener('click', function () { self._setActiveFile(filename); self._renderTabs(); });
      var x = document.createElement('span');
      x.className = 'tvm-tab-close'; x.textContent = '\u00d7';
      x.addEventListener('click', function (e) { e.stopPropagation(); self._closeFile(filename); });
      tab.appendChild(x);
      self.editorTabsEl.appendChild(tab);
    });
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
  };

  // ---------------------------------------------------------------------------
  // File Sync  (editor → backend)
  // ---------------------------------------------------------------------------
  TutorialCode.prototype._syncFileToBackend = function (filename, callback) {
    var entry = this.editorModels[filename];
    if (!entry) { if (callback) callback(); return; }
    var content = entry.model.getValue();
    entry.lastSyncContent = content;

    if (this.config.backend === 'v86') {
      this._syncFileToV86(filename, content);
      if (callback) callback();

    } else if (this.config.backend === 'pyodide') {
      this._postWorker(
        { type: 'write', path: '/tutorial/' + filename, content: content },
        function () { if (callback) callback(); }
      );

    } else if (this.config.backend === 'webcontainer' && this._webcontainer) {
      var wcPath = 'tutorial/' + filename;
      var wcDir  = wcPath.substring(0, wcPath.lastIndexOf('/'));
      var wc = this._webcontainer;
      var doWrite = function () {
        wc.fs.writeFile(wcPath, content)
          .then(function () { if (callback) callback(); })
          .catch(function (err) { console.warn('WC write failed:', err); if (callback) callback(); });
      };
      if (wcDir && wcDir !== 'tutorial') {
        wc.fs.mkdir(wcDir, { recursive: true }).then(doWrite).catch(doWrite);
      } else {
        doWrite();
      }

    } else if (this.config.backend === 'react') {
      // Content stays in editor models; debounce-rebuild the live preview
      var self = this;
      clearTimeout(this._reactRebuildTimer);
      this._reactRebuildTimer = setTimeout(function () {
        self._rebuildReactPreview();
        if (callback) callback();
      }, 400);
    }
  };

  TutorialCode.prototype._syncFileToV86 = function (filename, content) {
    if (!this.emulator || !this.booted) return;
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
    this.emulator.create_file('/' + filename, bytes)
      .then(function () {
        if (needsChmod) {
          var res = self.emulator.fs9p.SearchPath('/' + filename);
          if (res && res.id !== -1) self.emulator.fs9p.inodes[res.id].mode = 0x81ED;
        }
      }).catch(function (err) {
        var b64 = btoa(unescape(encodeURIComponent(content)));
        self._runSilent('printf "' + b64 + '" | base64 -d > /tutorial/' + filename +
          (needsChmod ? ' && chmod +x /tutorial/' + filename : ''));
      });
  };

  // ---------------------------------------------------------------------------
  // Tutorial Steps
  // ---------------------------------------------------------------------------
  TutorialCode.prototype.loadStep = function (index) {
    if (index < 0 || index >= this.steps.length) return;
    this.currentStep = index;
    var step = this.steps[index];

    if (this.quizPanelEl) this.quizPanelEl.style.display = 'none';
    if (this.stepContentWrapEl) this.stepContentWrapEl.style.display = '';

    this._renderStepNav();

    var html = '<h2>' + this._escapeHtml(step.title) + '</h2>';
    html += '<div class="tvm-step-instructions">' +
      (step.instructionsHTML || this._renderMarkdown(step.instructions || '')) + '</div>';
    this.stepContentEl.innerHTML = html;
    this.stepContentEl.scrollTop = 0;

    this._renderStepControls(index);

    var self = this;
    if (step.files) {
      self._suppressAutoSave = true;
      step.files.forEach(function (f) {
        self.openFile(f.path, f.content, f.language);
        self._syncFileToBackend(f.path);
      });
      self._suppressAutoSave = false;
      if (step.open_file) { self._setActiveFile(step.open_file); self._renderTabs(); }
    }

    if (step.setup_commands) {
      if (this.config.backend === 'v86' || this.config.backend === 'webcontainer') {
        step.setup_commands.forEach(function (cmd) { self.sendCommand(cmd); });
        if (this.config.backend === 'v86') {
          setTimeout(function () { self._pollWatchedFiles(); }, 1500);
        }
      } else if (this.config.backend === 'pyodide') {
        this._postWorker({ type: 'runCode', code: step.setup_commands.join('\n'), silent: true });
      }
    }

    if (this.config.backend === 'v86') this._startFileWatch(2000);

    // Clear Python output panel between steps
    if (this.config.backend === 'pyodide') this._clearOutput();
    // Rebuild React preview when a new step is loaded
    if (this.config.backend === 'react') {
      var stepSelf = this;
      setTimeout(function () { stepSelf._rebuildReactPreview(); }, 400);
    }
  };

  TutorialCode.prototype._renderStepNav = function () {
    var self = this;
    this.stepNavEl.innerHTML = '';
    this.steps.forEach(function (step, i) {
      var btn = document.createElement('button');
      btn.className = 'tvm-step-btn' + (i === self.currentStep ? ' active' : '');
      btn.textContent = i + 1; btn.title = step.title;
      btn.addEventListener('click', function () { self.loadStep(i); });
      self.stepNavEl.appendChild(btn);
    });
  };

  // ---------------------------------------------------------------------------
  // Step Controls
  // ---------------------------------------------------------------------------
  TutorialCode.prototype._renderStepControls = function (index) {
    var self = this;
    var step = this.steps[index];
    var nextLocked = this.requireTests && step.tests && step.tests.length > 0 && !this._stepsPassed.has(index);

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
      var hasQuiz = step.quiz && step.quiz.questions && step.quiz.questions.length > 0;
      if (hasQuiz && !self._quizPassed.has(index)) self._showStepQuiz(index);
      else self.loadStep(index + 1);
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
      var opts = (q.options || []).map(function (text, oi) { return { text: text, originalIndex: oi }; });
      if (doShuffle) self._shuffleArray(opts);
      var correctOriginals = q.type === 'multiple'
        ? (q.correct_indices || []).map(String).sort() : [String(q.correct_index || 0)];
      var correctLabels = [];
      opts.forEach(function (opt, oi) {
        if (correctOriginals.indexOf(String(opt.originalIndex)) !== -1) correctLabels.push(alphabet[oi]);
      });
      return { question: q.question || '', type: q.type || 'single', explanation: q.explanation || '',
               options: opts, correctOriginals: correctOriginals, correctLabels: correctLabels };
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
      var ca  = card.querySelector('.quiz-correct-answers');
      var ok  = opt.dataset.correct === opt.dataset.index;
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
      var sel  = card.querySelectorAll('.quiz-option.selected');
      var exp  = card.querySelector('.quiz-explanation');
      var ca   = card.querySelector('.quiz-correct-answers');
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
        var ca  = card.querySelector('.quiz-correct-answers');
        opts.forEach(function (o) { o.classList.remove('correct','incorrect','selected'); o.removeAttribute('disabled'); });
        if (exp) exp.classList.add('hidden');
        if (sub) { sub.classList.remove('hidden'); sub.disabled = true; }
        if (ca)  ca.style.display = '';
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
      self._quizPassed.add(stepIndex); self._hideStepQuiz(); self.loadStep(stepIndex + 1);
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
    var d = document.createElement('div'); d.textContent = str; return d.innerHTML;
  };

  // ---------------------------------------------------------------------------
  // Test Runner — dispatches per backend
  // ---------------------------------------------------------------------------
  TutorialCode.prototype._runTests = function () {
    var backend = this.config.backend;
    if (backend === 'v86')               this._runTestsV86();
    else if (backend === 'pyodide')      this._runTestsPyodide();
    else if (backend === 'webcontainer') this._runTestsWebContainer();
    else if (backend === 'react')        this._runTestsReact();
  };

  // v86 — same marker approach as original tutorial-vm.js
  TutorialCode.prototype._runTestsV86 = function () {
    var self = this;
    var step = this.steps[this.currentStep];
    var tests = step && step.tests;
    if (!tests || !tests.length) return;
    this._showTestPanel('<div class="tvm-test-running"><div class="tvm-test-spinner"></div>Running tests\u2026</div>');
    var parts = [];
    tests.forEach(function (t, i) {
      parts.push('( ' + t.command + ' ) 2>/dev/null; echo "__TRESULT_' + i + '_$?__"');
    });
    parts.push('echo "__T""DONE__"');
    this._testResults = new Array(tests.length).fill(null);
    this._testBuffer = '';
    this._testListening = true;
    this._muted = true;
    this._testCallbacks = [
      function () { self._muted = false; },
      function () { self._renderTestResults(tests, self._testResults); },
    ];
    var safetyTimer = setTimeout(function () {
      if (self._testListening) {
        self._testListening = false; self._testBuffer = ''; self._muted = false;
        self._renderTestResults(tests, self._testResults);
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
    cbs.forEach(function (cb) { cb(); });
  };

  // Pyodide — each test.command is run as Python code; exit 0 if no exception
  TutorialCode.prototype._runTestsPyodide = function () {
    var self = this;
    var step = this.steps[this.currentStep];
    var tests = step && step.tests;
    if (!tests || !tests.length) return;
    this._showTestPanel('<div class="tvm-test-running"><div class="tvm-test-spinner"></div>Running tests\u2026</div>');
    var results = [];

    function runNext(i) {
      if (i >= tests.length) { self._renderTestResults(tests, results); return; }
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
      return '( ' + t.command + ' ) 2>/dev/null; printf "__TRESULT_' + i + '_%d__\\n" $?';
    }).join('; ') + '; echo "__TDONE__"';

    this._webcontainer.spawn('sh', ['-c', script], { cwd: '/tutorial' })
      .then(function (proc) {
        var output = '';
        var reader = proc.output.getReader();
        (function readLoop() {
          reader.read().then(function (result) {
            if (result.done) { parseResults(output); return; }
            output += result.value;
            if (output.includes('__TDONE__')) { reader.cancel(); parseResults(output); return; }
            readLoop();
          }).catch(function () { parseResults(output); });
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

      function runNext(i) {
        if (i >= tests.length) { self._renderTestResults(tests, results); return; }
        try {
          /* jshint evil:true */
          var fn = new Function('frame', 'assert', tests[i].command);
          fn(frame, function assertFn(cond, msg) {
            if (!cond) throw new Error(msg || 'Assertion failed');
          });
          results[i] = true;
        } catch (e) {
          results[i] = false;
          console.warn('React test ' + i + ' failed:', e.message);
        }
        runNext(i + 1);
      }
      runNext(0);
    });
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
    if (allPass && this.requireTests) {
      this._stepsPassed.add(this.currentStep);
      var nextBtn = this.stepControlsEl.querySelector('.tvm-btn-next');
      if (nextBtn) { nextBtn.disabled = false; nextBtn.removeAttribute('title'); }
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
        }).catch(function () {});
    });
    Promise.all(promises).then(function () { self._reverseSyncBusy = false; });
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
  // Export
  // ---------------------------------------------------------------------------
  window.TutorialCode = TutorialCode;

})();
