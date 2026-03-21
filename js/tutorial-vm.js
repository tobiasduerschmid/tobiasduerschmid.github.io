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
    sh: 'shell', bash: 'shell', zsh: 'shell',
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
    this.currentStep = -1;
    this.emulator = null;
    this.term = null;
    this.fitAddon = null;
    this.editor = null;
    this.editorModels = {};   // filename -> { model, language }
    this.activeFileName = null;
    this.booted = false;
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
          '<div class="tvm-step-nav"></div>' +
          '<div class="tvm-step-content"></div>' +
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
    if (this.loadingEl) this.loadingEl.style.display = 'none';
    if (this.containerEl) this.containerEl.style.display = '';
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
    var hsplitter = this.root.querySelector('.tvm-hsplitter');
    var instructions = this.root.querySelector('.tvm-instructions-panel');
    var workspace = this.root.querySelector('.tvm-workspace');
    this._makeDraggable(hsplitter, 'horizontal', instructions, workspace);

    var vsplitter = this.root.querySelector('.tvm-vsplitter');
    var editorPanel = this.root.querySelector('.tvm-editor-panel');
    var terminalPanel = this.root.querySelector('.tvm-terminal-panel');
    this._makeDraggable(vsplitter, 'vertical', editorPanel, terminalPanel);
  };

  TutorialVM.prototype._makeDraggable = function (splitter, direction, beforeEl, afterEl) {
    var self = this;
    var startPos, startBefore, startAfter;

    function onMouseDown(e) {
      e.preventDefault();
      startPos = direction === 'horizontal' ? e.clientY : e.clientX;
      startBefore = direction === 'horizontal' ? beforeEl.getBoundingClientRect().height : beforeEl.getBoundingClientRect().width;
      startAfter = direction === 'horizontal' ? afterEl.getBoundingClientRect().height : afterEl.getBoundingClientRect().width;
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      splitter.classList.add('active');
      document.body.style.cursor = direction === 'horizontal' ? 'row-resize' : 'col-resize';
      document.body.style.userSelect = 'none';
    }

    function onMouseMove(e) {
      var current = direction === 'horizontal' ? e.clientY : e.clientX;
      var delta = current - startPos;
      var total = startBefore + startAfter;
      var newBefore = Math.max(80, Math.min(total - 80, startBefore + delta));
      var newAfter = total - newBefore;
      beforeEl.style.flex = '0 0 ' + (newBefore / total * 100) + '%';
      afterEl.style.flex = '0 0 ' + (newAfter / total * 100) + '%';
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
              window.require(['vs/editor/editor.main'], resolve);
            });
          });

        return Promise.all([v86Promise, monacoPromise]);
      });
  };

  // ---- Terminal (xterm.js) --------------------------------------------------

  TutorialVM.prototype._initTerminal = function () {
    var TermClass = window.Terminal;
    this.term = new TermClass({
      cursorBlink: true,
      fontSize: this.config.fontSize,
      fontFamily: "'Fira Code', 'Cascadia Code', Menlo, monospace",
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        selectionBackground: '#264f78',
      },
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

    var self = this;
    // Delay initial fit to let layout settle
    setTimeout(function () { self.fitAddon.fit(); }, 100);

    // Auto-resize when terminal panel resizes
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function () {
        if (self.fitAddon) {
          try { self.fitAddon.fit(); } catch (e) { /* ignore */ }
        }
      });
      ro.observe(this.terminalContainerEl);
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

        // Wire xterm input → serial port
        self.term.onData(function (data) {
          self.emulator.serial0_send(data);
        });

        // Wire serial port output → xterm (permanent)
        self.emulator.add_listener('serial0-output-byte', function (byte) {
          self.term.write(String.fromCharCode(byte));
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
    // The 9p filesystem is already mounted by /init at /tutorial.
    // We just ensure the VM is ready and cd to /tutorial.
    this.sendCommand('cd /tutorial');
    return delay(300);
  };

  // ---- Monaco Editor --------------------------------------------------------

  TutorialVM.prototype._initEditor = function () {
    this.editor = monaco.editor.create(this.editorContainerEl, {
      value: '// Follow the tutorial steps on the left.\n// Files will appear here as you progress.\n',
      language: 'shell',
      theme: 'vs-dark',
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

  TutorialVM.prototype._syncFileToVM = function (filename) {
    if (!this.emulator || !this.booted) return;
    var entry = this.editorModels[filename];
    if (!entry) return;

    var content = entry.model.getValue();
    var encoder = new TextEncoder();
    this.emulator.create_file(filename, encoder.encode(content));
  };

  // ---- Tutorial Steps -------------------------------------------------------

  TutorialVM.prototype.loadStep = function (index) {
    if (index < 0 || index >= this.steps.length) return;

    this.currentStep = index;
    var step = this.steps[index];

    // Update step navigation
    this._renderStepNav();

    // Render instructions
    var html = '<h2>' + this._escapeHtml(step.title) + '</h2>';
    html += '<div class="tvm-step-instructions">' + this._renderMarkdown(step.instructions || '') + '</div>';
    html += '<div class="tvm-step-controls">';
    if (index > 0) {
      html += '<button class="tvm-btn tvm-btn-prev">\u2190 Previous</button>';
    } else {
      html += '<span></span>';
    }
    if (index < this.steps.length - 1) {
      html += '<button class="tvm-btn tvm-btn-next">Next \u2192</button>';
    }
    html += '</div>';

    this.stepContentEl.innerHTML = html;

    // Wire up buttons
    var self = this;
    var prevBtn = this.stepContentEl.querySelector('.tvm-btn-prev');
    var nextBtn = this.stepContentEl.querySelector('.tvm-btn-next');
    if (prevBtn) prevBtn.addEventListener('click', function () { self.loadStep(index - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { self.loadStep(index + 1); });

    // Open files for this step
    if (step.files) {
      step.files.forEach(function (f) {
        self.openFile(f.path, f.content, f.language);
        self._syncFileToVM(f.path);
      });
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
    }
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

  // ---- Export ----------------------------------------------------------------
  window.TutorialVM = TutorialVM;
})();
