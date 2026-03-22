/**
 * TutorialVM - Interactive tutorial engine with in-browser Linux VM
 *
 * Orchestrates v86 (x86 emulator), xterm.js (terminal), and Monaco Editor
 * into a split-pane tutorial environment. Files are synced between the
 * browser editor and the VM via v86's 9p filesystem.
 */
(function () {
  'use strict';

  // CDN URLs for dependencies (loaded on demand)
  var CDN = {
    XTERM_JS: 'https://cdn.jsdelivr.net/npm/xterm@4.19.0/lib/xterm.min.js',
    XTERM_CSS: 'https://cdn.jsdelivr.net/npm/xterm@4.19.0/css/xterm.css',
    XTERM_FIT: 'https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.5.0/lib/xterm-addon-fit.min.js',
    MONACO_LOADER: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs/loader.min.js',
    MONACO_VS: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs',
    MARKED: 'https://cdn.jsdelivr.net/npm/marked@9.1.6/marked.min.js',
  };

  // ---------------------------------------------------------------------------
  // Utility helpers
  // ---------------------------------------------------------------------------

  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[src="' + url + '"]')) { resolve(); return; }
      var s = document.createElement('script');
      s.src = url;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Failed to load: ' + url)); };
      document.head.appendChild(s);
    });
  }

  function loadCSS(url) {
    if (document.querySelector('link[href="' + url + '"]')) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = url;
    document.head.appendChild(l);
  }

  function delay(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  // Language detection for Monaco
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
  // TutorialVM class
  // ---------------------------------------------------------------------------

  function TutorialVM(element, options) {
    this.root = typeof element === 'string'
      ? document.querySelector(element)
      : element;

    if (!this.root) throw new Error('TutorialVM: container element not found');

    this.config = {
      v86Path: options.v86Path || '/assets/v86',
      vmPath: options.vmPath || '/vm/dist',
      memoryMB: options.memoryMB || 256,
      fontSize: options.fontSize || 14,
    };

    this.steps = options.steps || [];
    this.setupCommands = options.setupCommands || [];
    this.currentStep = -1;
    this.emulator = null;
    this.term = null;
    this.fitAddon = null;
    this.editor = null;
    this.editorModels = {};   // filename -> { model, language }
    this.activeFileName = null;
    this.booted = false;

    // Test runner state
    this._testListening = false;
    this._testBuffer = '';
    this._testResults = [];
    this._testCallbacks = [];

    // Tracks which filenames the user has explicitly chmod +x'd
    this._executableFiles = new Set();
    // Buffer for monitoring user terminal input
    this._inputLine = '';
    // Flag to suppress auto-save during programmatic setValue calls
    this._suppressAutoSave = false;
    // List of files to watch for VM-side changes (reverse sync)
    this._watchedFiles = [];
    // Timer for periodic reverse sync polling
    this._reverseSyncTimer = null;
    // Prevents overlapping reverse sync reads
    this._reverseSyncBusy = false;
  }

  // ---- Lifecycle ------------------------------------------------------------

  TutorialVM.prototype.start = function () {
    var self = this;
    this._buildUI();
    this._showLoading('Loading tutorial environment…');

    return this._loadDependencies()
      .then(function () {
        self._showLoading('Starting terminal…');
        self._initTerminal();
        return self._initEditor();
      })
      .then(function () {
        self._showLoading('Booting Linux — this may take a few seconds…');
        return self._bootVM();
      })
      .then(function () {
        return self._setupFilesystem();
      })
      .then(function () {
        self._hideLoading();
        if (self.steps.length > 0) {
          self.loadStep(0);
        }
      })
      .catch(function (err) {
        self._showError('Failed to start tutorial: ' + err.message);
        console.error('TutorialVM error:', err);
      });
  };

  TutorialVM.prototype.destroy = function () {
    this._stopFileWatch();
    if (this.emulator) { this.emulator.stop(); this.emulator = null; }
    if (this.editor) { this.editor.dispose(); this.editor = null; }
    var name;
    for (name in this.editorModels) {
      if (this.editorModels.hasOwnProperty(name)) {
        this.editorModels[name].model.dispose();
      }
    }
    this.editorModels = {};
    if (this.term) { this.term.dispose(); this.term = null; }
  };

  // ---- UI Construction ------------------------------------------------------

  TutorialVM.prototype._buildUI = function () {
    this.root.classList.add('tvm-root');
    this.root.innerHTML =
      '<div class="tvm-loading">' +
      '<div class="tvm-loading-spinner"></div>' +
      '<div class="tvm-loading-text">Loading…</div>' +
      '</div>' +
      '<div class="tvm-container" style="display:none">' +
      '<div class="tvm-instructions-panel">' +
      '<div class="tvm-step-nav-bar">' +
      '<div class="tvm-step-nav"></div>' +
      '</div>' +
      '<div class="tvm-step-content-wrap">' +
      '<div class="tvm-step-content"></div>' +
      '</div>' +
      '<div class="tvm-step-controls-bar">' +
      '<div class="tvm-step-controls"></div>' +
      '</div>' +
      '</div>' +
      '<div class="tvm-hsplitter" title="Drag to resize"></div>' +
      '<div class="tvm-workspace">' +
      '<div class="tvm-editor-panel">' +
      '<div class="tvm-editor-tabs"></div>' +
      '<div class="tvm-editor-container"></div>' +
      '</div>' +
      '<div class="tvm-vsplitter" title="Drag to resize"></div>' +
      '<div class="tvm-terminal-panel">' +
      '<div class="tvm-terminal-header"><span>Terminal</span></div>' +
      '<div class="tvm-terminal-container"></div>' +
      '</div>' +
      '</div>' +
      '</div>';

    this.loadingEl = this.root.querySelector('.tvm-loading');
    this.containerEl = this.root.querySelector('.tvm-container');
    this.stepNavEl = this.root.querySelector('.tvm-step-nav');
    this.stepContentEl = this.root.querySelector('.tvm-step-content');
    this.stepControlsEl = this.root.querySelector('.tvm-step-controls');
    this.editorTabsEl = this.root.querySelector('.tvm-editor-tabs');
    this.editorContainerEl = this.root.querySelector('.tvm-editor-container');
    this.terminalContainerEl = this.root.querySelector('.tvm-terminal-container');

    this._initSplitters();
  };

  TutorialVM.prototype._showLoading = function (msg) {
    if (this.loadingEl) {
      this.loadingEl.style.display = 'flex';
      this.loadingEl.querySelector('.tvm-loading-text').textContent = msg;
    }
    if (this.containerEl) this.containerEl.style.display = 'none';
  };

  TutorialVM.prototype._hideLoading = function () {
    var self = this;
    if (this.loadingEl) this.loadingEl.style.display = 'none';
    if (this.containerEl) this.containerEl.style.display = '';
    // Give the browser one frame to paint the revealed layout, then resize
    // xterm and Monaco so they measure actual container dimensions (not 0).
    requestAnimationFrame(function () {
      if (self.fitAddon) { try { self.fitAddon.fit(); } catch (e) { } }
      if (self.editor) { self.editor.layout(); }
    });
  };

  TutorialVM.prototype._showError = function (msg) {
    this.root.innerHTML =
      '<div class="tvm-error">' +
      '<h3>Tutorial Error</h3>' +
      '<p>' + msg + '</p>' +
      '<p class="tvm-error-hint">Make sure you have run <code>./vm/setup.sh</code> to download the VM image.</p>' +
      '<button onclick="location.reload()">Retry</button>' +
      '</div>';
  };

  // ---- Splitters (resizable panes) ------------------------------------------

  TutorialVM.prototype._initSplitters = function () {
    var self = this;
    // hsplitter: separates LEFT (instructions) from RIGHT (workspace) — horizontal drag
    var hsplitter = this.root.querySelector('.tvm-hsplitter');
    var instructions = this.root.querySelector('.tvm-instructions-panel');
    var workspace = this.root.querySelector('.tvm-workspace');
    this._makeDraggable(hsplitter, 'vertical', instructions, workspace);  // 'vertical' = col-resize

    // vsplitter: separates editor (top) from terminal (bottom) — vertical drag
    var vsplitter = this.root.querySelector('.tvm-vsplitter');
    var editorPanel = this.root.querySelector('.tvm-editor-panel');
    var terminalPanel = this.root.querySelector('.tvm-terminal-panel');
    this._makeDraggable(vsplitter, 'horizontal', editorPanel, terminalPanel);  // 'horizontal' = row-resize
  };

  TutorialVM.prototype._makeDraggable = function (splitter, direction, beforeEl, afterEl) {
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
      var current = direction === 'vertical' ? e.clientX : e.clientY;
      var newSize = Math.max(120, startSizeBefore + (current - startPos));
      // Set beforeEl to a fixed px size; afterEl takes remaining space via flex:1
      beforeEl.style.flex = '0 0 ' + newSize + 'px';
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

  // ---- Dependency Loading ---------------------------------------------------

  TutorialVM.prototype._loadDependencies = function () {
    var self = this;
    self._showLoading('Loading dependencies…');

    // xterm and marked must load before Monaco: Monaco's loader.min.js sets
    // window.define (AMD), which causes UMD bundles to register as modules
    // instead of setting their globals (window.Terminal, window.marked).
    loadCSS(CDN.XTERM_CSS);
    return loadScript(CDN.XTERM_JS)
      .then(function () { return loadScript(CDN.XTERM_FIT); })
      .then(function () { return loadScript(CDN.MARKED); })
      .then(function () {
        var v86Promise = loadScript(self.config.v86Path + '/libv86.js');

        var monacoPromise = loadScript(CDN.MONACO_LOADER)
          .then(function () {
            return new Promise(function (resolve) {
              window.require.config({ paths: { vs: CDN.MONACO_VS } });
              window.require(['vs/editor/editor.main'], function () {
                // Register custom shell language to avoid built-in bracket matching conflicts
                monaco.languages.register({ id: 'shell-sebook' });

                monaco.languages.setLanguageConfiguration('shell-sebook', {
                  brackets: [
                    ['{', '}'],
                    ['[', ']'],
                    // Exclude () from matched brackets to prevent errors in case patterns
                  ],
                  autoClosingPairs: [
                    { open: '{', close: '}' },
                    { open: '[', close: ']' },
                    { open: '(', close: ')' },
                    { open: '"', close: '"' },
                    { open: "'", close: "'" },
                  ],
                  surroundingPairs: [
                    { open: '{', close: '}' },
                    { open: '[', close: ']' },
                    { open: '(', close: ')' },
                  ]
                });

                // Define custom Monarch tokenizer for shell to support interpolation and specific coloring
                monaco.languages.setMonarchTokensProvider('shell-sebook', {
                  keywords: ['if', 'then', 'else', 'elif', 'fi', 'for', 'in', 'do', 'done', 'case', 'esac', 'while', 'until', 'function'],
                  builtins: ['echo', 'set', 'cd', 'pwd', 'export', 'local', 'read', 'return', 'exit', 'grep', 'wc', 'head', 'sort', 'uniq', 'cut', 'cat', 'mkdir', 'touch', 'rm', 'cp', 'mv', 'whoami', 'date', 'sleep', 'which'],
                  tokenizer: {
                    root: [
                      [/^#!.*$/, 'comment.shell-sebook'],
                      [/\b(if|then|else|elif|fi|for|in|do|done|case|esac|while|until|function)\b/, 'keyword.shell-sebook'],
                      [/[\[\]]/, 'keyword.shell-sebook'], // Blue for [ ]
                      [/[a-zA-Z_][\w]*(?==)/, 'variable.shell-sebook'], // LHS of assignment
                      [/[a-zA-Z_][\w]*/, {
                        cases: {
                          '@builtins': 'command.shell-sebook',
                          '@default': 'command.shell-sebook'
                        }
                      }],
                      [/\$([#?@$!*0-9]|\{?[\w]+\}?)/, 'variable.shell-sebook'], // Special variables like $# and regular ones
                      [/\$\(/, { token: 'variable.shell-sebook', next: '@interpolation' }],
                      [/#.*$/, 'comment.shell-sebook'],
                      [/"/, { token: 'string.shell-sebook', next: '@string' }],
                      [/'/, { token: 'string.shell-sebook', next: '@sstring' }],
                      [/\d+/, 'command.shell-sebook'], // Numbers as commands (Teal)
                      [/;;/, 'command.shell-sebook'], // Double semicolon for case
                      [/[ \t\r\n]+/, 'white'],
                      [/[{}()]/, 'command.shell-sebook'], // Braces and parens as Teal
                      [/[<>|&;$]/, 'operator.shell-sebook'],
                      [/-[\w-]+/, 'attribute.name.shell-sebook'],
                      [/\+[\w-]+/, 'attribute.name.shell-sebook']
                    ],
                    string: [
                      [/\$\(/, { token: 'variable.shell-sebook', next: '@interpolation' }],
                      [/\$([#?@$!*0-9]|\{?[\w]+\}?)/, 'variable.shell-sebook'],
                      [/[^\\"$]+/, 'string.shell-sebook'],
                      [/\\./, 'string.shell-sebook'],
                      [/"/, { token: 'string.shell-sebook', next: '@pop' }]
                    ],
                    sstring: [
                      [/[^\\']+/, 'string.shell-sebook'],
                      [/\\./, 'string.shell-sebook'],
                      [/'/, { token: 'string.shell-sebook', next: '@pop' }]
                    ],
                    interpolation: [
                      [/\)/, { token: 'variable.shell-sebook', next: '@pop' }],
                      { include: 'root' }
                    ]
                  }
                });

                monaco.editor.defineTheme('sebook-light', {
                  base: 'vs',
                  inherit: true,
                  rules: [
                    { token: 'keyword.shell-sebook', foreground: '0000ff' }, // Blue for if/then/case/[
                    { token: 'command.shell-sebook', foreground: '267f99' }, // Teal for echo/set/1/(/)/;;
                    { token: 'identifier.shell-sebook', foreground: '267f99' }, // Teal for patterns/other names
                    { token: 'variable.shell-sebook', foreground: '001080' }, // Dark Blue for color= and $var
                    { token: 'attribute.name.shell-sebook', foreground: 'a31515' },
                    { token: 'string.shell-sebook', foreground: 'a31515' },
                    { token: 'comment.shell-sebook', foreground: '008000' }
                  ],
                  colors: {}
                });

                monaco.editor.defineTheme('sebook-dark', {
                  base: 'vs-dark',
                  inherit: true,
                  rules: [
                    { token: 'keyword.shell-sebook', foreground: '569cd6' },
                    { token: 'command.shell-sebook', foreground: '4ec9b0' },
                    { token: 'identifier.shell-sebook', foreground: '4ec9b0' },
                    { token: 'variable.shell-sebook', foreground: '9cdcfe' },
                    { token: 'attribute.name.shell-sebook', foreground: 'f44747' },
                    { token: 'string.shell-sebook', foreground: 'ce9178' },
                    { token: 'comment.shell-sebook', foreground: '6a9955' }
                  ],
                  colors: {
                    'editor.background': '#1e1e1e'
                  }
                });

                resolve();
              });
            });
          });

        return Promise.all([v86Promise, monacoPromise]);
      });
  };

  // ---- Terminal (xterm.js) --------------------------------------------------

  // Theme definitions (Customized to match Rouge/SEBook style)
  var THEMES = {
    dark: {
      monaco: 'sebook-dark',
      xterm: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        selectionBackground: '#264f78',
      },
    },
    light: {
      monaco: 'sebook-light',
      xterm: {
        background: '#ffffff',
        foreground: '#383a42',
        cursor: '#383a42',
        selectionBackground: '#add6ff',
        black: '#383a42',
        red: '#e45649',
        green: '#50a14f',
        yellow: '#986801',
        blue: '#4078f2',
        magenta: '#a626a4',
        cyan: '#0184bc',
        white: '#fafafa',
        brightBlack: '#4f525e',
        brightRed: '#e06c75',
        brightGreen: '#98c379',
        brightYellow: '#e5c07b',
        brightBlue: '#61afef',
        brightMagenta: '#c678dd',
        brightCyan: '#56b6c2',
        brightWhite: '#ffffff',
      },
    },
  };

  TutorialVM.prototype._isDarkMode = function () {
    return document.documentElement.classList.contains('dark-mode');
  };

  TutorialVM.prototype._applyTheme = function (isDark) {
    var theme = isDark ? THEMES.dark : THEMES.light;
    if (this.editor) {
      monaco.editor.setTheme(theme.monaco);
    }
    if (this.term) {
      if (typeof this.term.setOption === 'function') {
        this.term.setOption('theme', theme.xterm);
      } else {
        this.term.options.theme = theme.xterm;
      }
    }
  };

  TutorialVM.prototype._initTerminal = function () {
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

    // Fit addon — handle both v4 and v5 naming
    var FitAddonClass = (window.FitAddon && window.FitAddon.FitAddon)
      ? window.FitAddon.FitAddon
      : window.FitAddon;
    this.fitAddon = new FitAddonClass();
    this.term.loadAddon(this.fitAddon);
    this.term.open(this.terminalContainerEl);
    this.term.focus();

    // Delay initial fit to let layout settle
    setTimeout(function () { self.fitAddon.fit(); }, 100);

    // Auto-resize when terminal panel resizes — debounced so the layout
    // has settled before we measure, preventing the last row being clipped.
    if (window.ResizeObserver) {
      var fitTimer;
      var ro = new ResizeObserver(function () {
        clearTimeout(fitTimer);
        fitTimer = setTimeout(function () {
          if (self.fitAddon) { try { self.fitAddon.fit(); } catch (e) { } }
        }, 50);
      });
      ro.observe(this.terminalContainerEl);
    }

    // React to dark-mode class changes on <html>
    if (window.MutationObserver) {
      var mo = new MutationObserver(function () {
        self._applyTheme(self._isDarkMode());
      });
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    }
  };

  // ---- Virtual Machine (v86) ------------------------------------------------

  TutorialVM.prototype._bootVM = function () {
    var self = this;
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
          autostart: true,
          disable_keyboard: true,
          disable_mouse: true,
          disable_speaker: true,
          screen_dummy: true,
          filesystem: {},
        });

        // Wire xterm input → serial port, and monitor for chmod +x
        self.term.onData(function (data) {
          self.emulator.serial0_send(data);
          // Track user-typed commands to detect chmod +x <file>
          if (data === '\r' || data === '\n') {
            var m = self._inputLine.match(/chmod\s+\+x\s+(\S+)/);
            if (m) {
              var fname = m[1].replace(/^\.\//, '').replace(/^\/tutorial\//, '');
              self._executableFiles.add(fname);
            }
            self._inputLine = '';
          } else if (data === '\x7f' || data === '\b') {
            self._inputLine = self._inputLine.slice(0, -1);
          } else {
            self._inputLine += data;
          }
        });

        // Wire serial port output → xterm (permanent)
        // When _muted is true, output is suppressed (used during silent file sync)
        self._muted = false;
        self.emulator.add_listener('serial0-output-byte', function (byte) {
          var ch = String.fromCharCode(byte);
          if (!self._muted) self.term.write(ch);
          if (self._testListening) {
            self._testBuffer += ch;
            self._parseTestOutput();
          }
        });

        // Detect boot prompt (separate temporary listener)
        var bootOutput = '';
        var promptDetected = false;

        function onBoot(byte) {
          bootOutput += String.fromCharCode(byte);
          if (!promptDetected && (bootOutput.includes('$ ') || bootOutput.includes('# ') || bootOutput.includes(':~'))) {
            promptDetected = true;
            self.booted = true;
            self.emulator.remove_listener('serial0-output-byte', onBoot);
            resolve();
          }
        }
        self.emulator.add_listener('serial0-output-byte', onBoot);

        // Timeout — resolve anyway after 30s
        setTimeout(function () {
          if (!promptDetected) {
            self.emulator.remove_listener('serial0-output-byte', onBoot);
            self.booted = true;
            console.warn('TutorialVM: boot prompt not detected, continuing anyway.');
            resolve();
          }
        }, 30000);
      } catch (err) {
        reject(err);
      }
    });
  };

  TutorialVM.prototype.sendCommand = function (cmd) {
    if (!this.emulator) return;
    this.emulator.serial0_send(cmd + '\n');
  };

  TutorialVM.prototype._setupFilesystem = function () {
    var self = this;
    // Navigate to the 9p filesystem 'host9p' mounted at /tutorial by the init script
    this.sendCommand('cd /tutorial');
    // Ensure commands prefixed with a space are not saved in history
    this.sendCommand('export HISTCONTROL=ignoreboth');
    // Run top-level setup commands (e.g. git config, env setup)
    this.setupCommands.forEach(function (cmd) {
      self.sendCommand(cmd);
    });
    this.sendCommand('clear');
    return delay(100);
  };

  // ---- Monaco Editor --------------------------------------------------------

  TutorialVM.prototype._initEditor = function () {
    this.editor = monaco.editor.create(this.editorContainerEl, {
      value: '// Follow the tutorial steps on the left.\n// Files will appear here as you progress.\n',
      language: 'shell-sebook',
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

    // Ctrl/Cmd+S to save current file to VM
    var self = this;
    this.editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      function () { self._saveCurrentFile(); }
    );

    return Promise.resolve();
  };

  TutorialVM.prototype.openFile = function (filename, content, language) {
    language = language || detectLanguage(filename);

    if (!this.editorModels[filename]) {
      var model = monaco.editor.createModel(content || '', language);
      this.editorModels[filename] = { model: model, filename: filename };

      // Auto-save to VM on change (debounced)
      var self = this;
      var saveTimeout;
      model.onDidChangeContent(function () {
        if (self._suppressAutoSave) return;
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(function () {
          self._syncFileToVM(filename);
        }, 800);
      });
    } else if (content !== undefined) {
      this.editorModels[filename].model.setValue(content);
    }

    this._setActiveFile(filename);
    this._renderTabs();
  };

  TutorialVM.prototype._setActiveFile = function (filename) {
    var entry = this.editorModels[filename];
    if (entry) {
      this.activeFileName = filename;
      this.editor.setModel(entry.model);
    }
  };

  TutorialVM.prototype._renderTabs = function () {
    var self = this;
    this.editorTabsEl.innerHTML = '';

    var names = Object.keys(this.editorModels);
    names.forEach(function (filename) {
      var tab = document.createElement('div');
      tab.className = 'tvm-tab' + (filename === self.activeFileName ? ' active' : '');
      tab.textContent = filename;
      tab.addEventListener('click', function () {
        self._setActiveFile(filename);
        self._renderTabs();
      });

      var closeBtn = document.createElement('span');
      closeBtn.className = 'tvm-tab-close';
      closeBtn.textContent = '\u00d7';
      closeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        self._closeFile(filename);
      });
      tab.appendChild(closeBtn);

      self.editorTabsEl.appendChild(tab);
    });
  };

  TutorialVM.prototype._closeFile = function (filename) {
    var entry = this.editorModels[filename];
    if (!entry) return;
    entry.model.dispose();
    delete this.editorModels[filename];

    if (this.activeFileName === filename) {
      var remaining = Object.keys(this.editorModels);
      if (remaining.length > 0) {
        this._setActiveFile(remaining[0]);
      } else {
        this.activeFileName = null;
        this.editor.setModel(monaco.editor.createModel(''));
      }
    }
    this._renderTabs();
  };

  TutorialVM.prototype._saveCurrentFile = function () {
    if (!this.activeFileName) return;
    this._syncFileToVM(this.activeFileName);

    // Visual feedback on the tab
    var activeTab = this.editorTabsEl.querySelector('.tvm-tab.active');
    if (activeTab) {
      activeTab.classList.add('saved');
      setTimeout(function () { activeTab.classList.remove('saved'); }, 1200);
    }
  };

  // Run a shell command silently (muted output, waits for prompt before unmuting).
  TutorialVM.prototype._runSilent = function (cmd) {
    var self = this;
    self._muted = true;
    self._mutedBuffer = '';

    function onByte(byte) {
      self._mutedBuffer += String.fromCharCode(byte);
      if (self._mutedBuffer.includes('# ') || self._mutedBuffer.includes('$ ')) {
        self._muted = false;
        self._mutedBuffer = '';
        self.emulator.remove_listener('serial0-output-byte', onByte);
        clearTimeout(timer);
      }
    }
    self.emulator.add_listener('serial0-output-byte', onByte);
    var timer = setTimeout(function () {
      self._muted = false;
      self._mutedBuffer = '';
      self.emulator.remove_listener('serial0-output-byte', onByte);
    }, 5000);
    // Leading space prevents bash history recording
    self.sendCommand(' ' + cmd);
  };

  TutorialVM.prototype._syncFileToVM = function (filename, isInitial) {
    if (!this.emulator || !this.booted) return;
    var entry = this.editorModels[filename];
    if (!entry) return;

    var content = entry.model.getValue();

    // Convert content to Uint8Array for v86 9p filesystem
    var bytes;
    if (typeof TextEncoder !== 'undefined') {
      bytes = new TextEncoder().encode(content);
    } else {
      // Fallback for older browsers
      var utf8 = unescape(encodeURIComponent(content));
      bytes = new Uint8Array(utf8.length);
      for (var i = 0; i < utf8.length; i++) {
        bytes[i] = utf8.charCodeAt(i);
      }
    }

    // Write directly to the v86 9p filesystem.
    // create_file returns a Promise (no callback). After writing, if the user
    // has previously chmod +x'd this .sh file, set the execute bit directly on
    // the 9p inode so it persists across cache invalidations.
    var self = this;
    var needsChmod = /\.sh$/i.test(filename) && !isInitial && self._executableFiles.has(filename);
    this.emulator.create_file('/' + filename, bytes).then(function () {
      if (needsChmod) {
        // Set execute bit (0o755 = 33261) directly on the 9p inode
        var result = self.emulator.fs9p.SearchPath('/' + filename);
        if (result && result.id !== -1) {
          self.emulator.fs9p.inodes[result.id].mode = 0x81ED; // 0o100755
        }
      }
    }).catch(function (err) {
      console.warn('TutorialVM: create_file failed, falling back to serial base64 sync', err);
      var b64 = btoa(unescape(encodeURIComponent(content)));
      var cmd = 'printf "' + b64 + '" | base64 -d > /tutorial/' + filename;
      if (needsChmod) cmd += ' && chmod +x /tutorial/' + filename;
      self._runSilent(cmd);
    });
  };

  // ---- Tutorial Steps -------------------------------------------------------

  TutorialVM.prototype.loadStep = function (index) {
    if (index < 0 || index >= this.steps.length) return;

    this.currentStep = index;
    var step = this.steps[index];

    // Update step navigation
    this._renderStepNav();

    // Render instructions — use server-rendered HTML (Rouge syntax highlighting) if available,
    // fall back to client-side marked.js parsing
    var html = '<h2>' + this._escapeHtml(step.title) + '</h2>';
    html += '<div class="tvm-step-instructions">' + (step.instructionsHTML || this._renderMarkdown(step.instructions || '')) + '</div>';
    this.stepContentEl.innerHTML = html;
    this.stepContentEl.scrollTop = 0;

    // Render controls in the fixed footer bar (always visible, below scroll)
    var controlsHtml = '';
    if (index > 0) {
      controlsHtml += '<button class="tvm-btn tvm-btn-prev">\u2190 Previous</button>';
    } else {
      controlsHtml += '<span></span>';
    }
    if (step.tests && step.tests.length > 0) {
      controlsHtml += '<button class="tvm-btn tvm-btn-test">\u2713 Test My Work</button>';
    } else {
      controlsHtml += '<span></span>';
    }
    if (index < this.steps.length - 1) {
      controlsHtml += '<button class="tvm-btn tvm-btn-next">Next \u2192</button>';
    } else {
      controlsHtml += '<span></span>';
    }
    this.stepControlsEl.innerHTML = controlsHtml;

    // Wire up buttons
    var self = this;
    var prevBtn = this.stepControlsEl.querySelector('.tvm-btn-prev');
    var nextBtn = this.stepControlsEl.querySelector('.tvm-btn-next');
    var testBtn = this.stepControlsEl.querySelector('.tvm-btn-test');
    if (prevBtn) prevBtn.addEventListener('click', function () { self.loadStep(index - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { self.loadStep(index + 1); });
    if (testBtn) testBtn.addEventListener('click', function () { self._runTests(); });

    // Open files for this step
    if (step.files) {
      self._suppressAutoSave = true;
      step.files.forEach(function (f) {
        self._executableFiles.delete(f.path); // reset — user must chmod +x again for this file
        self.openFile(f.path, f.content, f.language);
        self._syncFileToVM(f.path, true); // initial load — don't auto-chmod
      });
      self._suppressAutoSave = false;
      if (step.open_file) {
        self._setActiveFile(step.open_file);
        self._renderTabs();
      }
    }

    // Run setup commands
    if (step.setup_commands) {
      step.setup_commands.forEach(function (cmd) {
        self.sendCommand(cmd);
      });
      // After setup commands, refresh open files so editor reflects VM changes
      setTimeout(function () { self.refreshOpenFiles(); }, 1500);
    }

    // Set up file watching for all open files (reverse sync: VM → editor)
    this._startFileWatch(2000);
  };

  TutorialVM.prototype._renderStepNav = function () {
    var self = this;
    this.stepNavEl.innerHTML = '';

    this.steps.forEach(function (step, i) {
      var btn = document.createElement('button');
      btn.className = 'tvm-step-btn' + (i === self.currentStep ? ' active' : '');
      btn.textContent = (i + 1);
      btn.title = step.title;
      btn.addEventListener('click', function () { self.loadStep(i); });
      self.stepNavEl.appendChild(btn);
    });
  };

  TutorialVM.prototype._renderMarkdown = function (text) {
    if (!text) return '';
    if (window.marked) {
      return window.marked.parse(text);
    }
    // Fallback: basic rendering
    return text
      .replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\n\n/g, '<br><br>');
  };

  TutorialVM.prototype._escapeHtml = function (str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };

  // ---- Test Runner ----------------------------------------------------------

  TutorialVM.prototype._runTests = function () {
    var self = this;
    var step = this.steps[this.currentStep];
    var tests = step && step.tests;
    if (!tests || !tests.length) return;

    this._showTestPanel(
      '<div class="tvm-test-running">' +
      '<div class="tvm-test-spinner"></div>' +
      'Running tests\u2026' +
      '</div>'
    );

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
      function () { self._renderTestResults(tests, self._testResults); }
    ];

    var safetyTimer = setTimeout(function () {
      if (self._testListening) {
        self._testListening = false;
        self._testBuffer = '';
        self._muted = false;
        self._renderTestResults(tests, self._testResults);
      }
    }, 15000);
    this._testCallbacks.push(function () { clearTimeout(safetyTimer); });

    // Leading space prevents bash from recording the command in history
    // (requires HISTCONTROL=ignorespace or ignoreboth, set in .bashrc)
    this.sendCommand(' ' + parts.join('; '));
  };

  TutorialVM.prototype._parseTestOutput = function () {
    if (!this._testBuffer.includes('__TDONE__')) return;

    var re = /__TRESULT_(\d+)_(\d+)__/g;
    var match;
    while ((match = re.exec(this._testBuffer)) !== null) {
      var idx = parseInt(match[1], 10);
      var code = parseInt(match[2], 10);
      if (idx < this._testResults.length) {
        this._testResults[idx] = (code === 0);
      }
    }

    this._testListening = false;
    this._testBuffer = '';
    var callbacks = this._testCallbacks.splice(0);
    callbacks.forEach(function (cb) { cb(); });
  };

  TutorialVM.prototype._showTestPanel = function (innerHtml) {
    var panel = this.stepContentEl.querySelector('.tvm-test-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'tvm-test-panel';
      this.stepContentEl.appendChild(panel);
    }
    panel.innerHTML = innerHtml;
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  TutorialVM.prototype._renderTestResults = function (tests, results) {
    var self = this;
    var passed = results.filter(function (r) { return r === true; }).length;
    var total = tests.length;
    var allPass = passed === total;

    var html = '<div class="tvm-test-results">';
    html += '<div class="tvm-test-summary ' + (allPass ? 'all-pass' : 'partial') + '">';
    html += allPass
      ? '\u2705 All ' + total + ' tests passed!'
      : passed + '\u00a0/\u00a0' + total + ' tests passed';
    html += '</div><ul class="tvm-test-list">';
    tests.forEach(function (t, i) {
      var pass = results[i];
      var cls = pass === true ? 'pass' : (pass === false ? 'fail' : 'unknown');
      var icon = pass === true ? '\u2713' : (pass === false ? '\u2717' : '?');
      html += '<li class="tvm-test-item ' + cls + '">';
      html += '<span class="tvm-test-icon">' + icon + '</span>';
      html += '<span class="tvm-test-desc">' + self._escapeHtml(t.description) + '</span>';
      html += '</li>';
    });
    html += '</ul></div>';

    this._showTestPanel(html);
  };

  // ---- Reverse File Sync (VM → Editor) --------------------------------------
  //
  // ---------------------------------------------------------------------------
  // Reverse file sync: VM → Editor
  //
  // Reads files directly from v86's 9p filesystem using the Promise-based
  // read_file() API. This operates entirely in the browser — no shell commands
  // are sent to the VM, so the terminal is never polluted.
  // ---------------------------------------------------------------------------

  /**
   * Read all open files from the VM's 9p filesystem and update
   * their Monaco editor models if the content has changed.
   */
  TutorialVM.prototype._pollWatchedFiles = function () {
    if (!this.emulator || !this.booted) return;
    if (this._reverseSyncBusy) return;

    var self = this;
    var files = Object.keys(this.editorModels);
    if (files.length === 0) return;

    this._reverseSyncBusy = true;

    var promises = files.map(function (filename) {
      return self.emulator.read_file('/' + filename)
        .then(function (buf) {
          var content = new TextDecoder('utf-8').decode(buf);
          var entry = self.editorModels[filename];
          if (entry && entry.model.getValue() !== content) {
            self._suppressAutoSave = true;
            entry.model.setValue(content);
            self._suppressAutoSave = false;
          }
        })
        .catch(function () {
          // File may not exist yet — silently skip
        });
    });

    Promise.all(promises).then(function () {
      self._reverseSyncBusy = false;
    });
  };

  /**
   * Refresh all currently open editor files from the VM filesystem.
   */
  TutorialVM.prototype.refreshOpenFiles = function () {
    this._pollWatchedFiles();
  };

  /**
   * Start watching open files for VM-side changes (polling).
   */
  TutorialVM.prototype._startFileWatch = function (intervalMs) {
    var self = this;
    intervalMs = intervalMs || 2000;
    this._stopFileWatch();
    this._reverseSyncTimer = setInterval(function () {
      if (self.booted) {
        self._pollWatchedFiles();
      }
    }, intervalMs);
  };

  /**
   * Stop watching files for VM-side changes.
   */
  TutorialVM.prototype._stopFileWatch = function () {
    if (this._reverseSyncTimer) {
      clearInterval(this._reverseSyncTimer);
      this._reverseSyncTimer = null;
    }
  };

  // ---- Export ----------------------------------------------------------------
  window.TutorialVM = TutorialVM;
})();
