/**
 * SebookSharedEditor — single Monaco bootstrap shared by tab/pane popups.
 *
 * Before this module the two popup HTMLs duplicated ~95% of their Monaco
 * setup: require.config + require + sebook-langs registration + theme +
 * model creation + edit debounce + Ctrl+S + refactorings host. This module
 * consolidates all of that. The popup HTML shrinks to a tiny shell.
 *
 * It also auto-wires the time-travel debugger into popped-out editors when
 * the parent tutorial has it enabled: as soon as the first DebuggerSync
 * snapshot arrives indicating debuggerEnabled=true, the editor gets gutter
 * clicks, breakpoint glyphs, current-line decoration, and the hover provider
 * — same code path as on the main window.
 *
 * Public API:
 *
 *   SebookSharedEditor.bootForRole({
 *     kind: 'tab' | 'pane',
 *     filename: string?,           // tab only
 *     pane: 'left'|'right'?,       // pane only
 *     els: { status, overlay, editor, filename?, orphan?, close?,
 *            paneName?, tabBar? },
 *   });
 *
 * Returns nothing — the bootstrap is fire-and-forget. The popup window then
 * communicates with main exclusively via the BroadcastChannel.
 *
 * Adding a new editor feature here automatically delivers it to ALL editor
 * popups, no further wiring needed.
 */
(function () {
  'use strict';

  var MONACO_VS = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs';
  var DEFAULT_OPTIONS = {
    fontSize: 16,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    wordWrap: 'on',
    padding: { top: 8 },
    glyphMargin: true,
    // Accessibility — see js/tutorial-code.js _monacoEditorOptions for the
    // rationale. Without `ariaLabel`, NVDA / VoiceOver announce Monaco's
    // hidden textarea as "edit"; the popout-specific suffix is added by
    // each call site so the editor's pane / filename is part of the name.
    ariaLabel: 'Code editor. Press Control F1 (Command F1 on macOS) for accessibility help. Press Escape to release focus to the surrounding page.',
    accessibilitySupport: 'auto',
    accessibilityPageSize: 25,
  };

  function languageForFile(fn, requested) {
    return window.SebookMonacoLangs
      ? window.SebookMonacoLangs.languageForFile(fn, requested)
      : (requested || 'plaintext');
  }

  function pickTheme(dark) {
    if (window.SebookMonacoLangs) return dark ? 'sebook-dark' : 'sebook-light';
    return dark ? 'vs-dark' : 'vs';
  }

  function loadMonaco(cb) {
    if (window.monaco) return cb();
    require.config({ paths: { vs: MONACO_VS } });
    require(['vs/editor/editor.main'], function () {
      if (window.SebookMonacoLangs) window.SebookMonacoLangs.register(monaco);
      cb();
    });
  }

  // Build the optional debugger sync mirror. Returns a function the booter
  // calls every time a `debugger:enabled` flag arrives, so it can attach the
  // editor(s) once. Gracefully no-ops when the debugger modules aren't loaded.
  function maybeBuildDebuggerSync(client, role) {
    if (!window.DebuggerSync) return null;
    return new window.DebuggerSync({
      channel: client.channel,
      sourceId: 'dbg-' + role + '-' + Math.random().toString(36).slice(2, 10),
      isAuthority: false,
      role: role,
    });
  }

  function attachDebuggerToEditors(editors, sync, getActiveFileFor) {
    if (!sync || !window.SEBookDebuggerEditor) return;
    for (var i = 0; i < editors.length; i++) {
      var ed = editors[i];
      if (!ed || ed._dbgAttached) continue;
      ed._dbgAttached = true;
      window.SEBookDebuggerEditor.attach(ed, sync, {
        monaco: window.monaco,
        getActiveFile: getActiveFileFor(ed),
      });
    }
    window.SEBookDebuggerEditor.registerHoverProvider(window.monaco, sync,
      { languages: ['python', 'javascript', 'typescript'] });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Tab popup booter (single file)
  // ─────────────────────────────────────────────────────────────────────────

  function bootTab(opts) {
    var els = opts.els || {};
    var filename = opts.filename;
    if (!filename) {
      if (els.overlay) els.overlay.textContent = 'Invalid popup URL (missing filename).';
      return;
    }
    if (els.filename) els.filename.textContent = filename;
    if (els.close) els.close.addEventListener('click', function () { window.close(); });

    var editor = null, monacoModel = null;
    var currentVersion = 0;
    var suppressEditEvents = false;
    var refactoringHost = null;
    var dbgSync = null;
    var dbgAttached = false;

    var client = SebookPopoutClient.connect({
      role: 'tab:' + filename,
      statusEl: els.status,
      statusClass: 'ttp-status',
      overlayEl: els.overlay,
      onMessage: handleMessage,
      onDarkModeChange: function (enabled) {
        if (window.monaco) monaco.editor.setTheme(pickTheme(enabled));
      },
      getFinalState: function () {
        return { finalContent: monacoModel ? monacoModel.getValue() : null };
      },
    });
    if (els.filename) document.title = filename + ' — ' + client.tutorialTitle;

    dbgSync = maybeBuildDebuggerSync(client, 'tab');
    if (dbgSync) dbgSync.requestSnapshot();

    function ensureDebuggerAttached() {
      if (dbgAttached || !dbgSync || !editor) return;
      var s = dbgSync.state;
      if (!s || !s.debuggerEnabled) return;
      dbgAttached = true;
      attachDebuggerToEditors([editor], dbgSync, function () {
        return function () { return filename; };
      });
    }

    function bootMonaco(content, language) {
      loadMonaco(function () {
        var lang = languageForFile(filename, language);
        var dark = document.documentElement.classList.contains('dark-mode');
        monacoModel = monaco.editor.createModel(content || '', lang);
        var options = Object.assign({}, DEFAULT_OPTIONS, {
          model: monacoModel,
          theme: pickTheme(dark),
          ariaLabel: filename + ', ' + (lang || 'code') + ' editor. Press Control F1 (Command F1 on macOS) for accessibility help. Press Escape to release focus to the surrounding page.',
        });
        editor = monaco.editor.create(els.editor, options);
        wireFileEditing();
        wireRefactorings();
        ensureDebuggerAttached();
      });
    }

    function wireFileEditing() {
      var debounceTimer;
      function flushEdit() {
        clearTimeout(debounceTimer);
        currentVersion++;
        client.post('file-edit', {
          filename: filename, content: monacoModel.getValue(), version: currentVersion,
        });
      }
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, function () {
        flushEdit();
        client.post('request-save', { filename: filename });
      });
      monacoModel.onDidChangeContent(function () {
        if (suppressEditEvents) return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(flushEdit, 30);
      });
      bootTab._flushEdit = flushEdit;
    }

    function wireRefactorings() {
      if (!window.SebookRefactorings) return;
      refactoringHost = window.SebookRefactorings.createPopupHost(client, {
        flush: bootTab._flushEdit,
        getActiveFileName: function () { return filename; },
        getActiveContent: function () { return monacoModel ? monacoModel.getValue() : ''; },
      });
      window.SebookRefactorings.attach({
        monaco: monaco,
        editors: [editor],
        getActiveFileName: function () { return filename; },
        getWorkspace: refactoringHost.getWorkspace,
        applyEdits: refactoringHost.applyEdits,
      });
    }

    function applySnapshot(snap) {
      if (!snap || snap.filename !== filename) return;
      if (typeof snap.version === 'number' && snap.version < currentVersion) {
        client.markConnected();
        return;
      }
      if (typeof snap.version === 'number') currentVersion = snap.version;
      if (typeof snap.darkMode === 'boolean') {
        document.documentElement.classList.toggle('dark-mode', snap.darkMode);
      }
      if (!editor) {
        bootMonaco(snap.content || '', snap.language || '');
      } else if (monacoModel.getValue() !== snap.content) {
        suppressEditEvents = true;
        try { monacoModel.setValue(snap.content || ''); }
        finally { suppressEditEvents = false; }
      }
      if (els.orphan) els.orphan.style.display = 'none';
      if (els.editor) els.editor.style.display = '';
      client.markConnected();
      ensureDebuggerAttached();
    }

    function showOrphaned() {
      if (els.orphan) els.orphan.style.display = '';
      if (els.editor) els.editor.style.display = 'none';
      client.setStatus('File not in current step', 'warn');
    }

    function handleMessage(msg) {
      if (refactoringHost && refactoringHost.handleMessage(msg)) return;
      switch (msg.type) {
        case 'file-snapshot':
          if (msg.filename === filename) applySnapshot(msg);
          break;
        case 'state-snapshot':
          if (msg.files && msg.files[filename]) applySnapshot(msg.files[filename]);
          break;
        case 'step-change':
          if (Array.isArray(msg.fileList) && msg.fileList.indexOf(filename) === -1) {
            showOrphaned();
          }
          break;
        case 'save-confirmed':
          if (msg.filename === filename) client.flashStatus('Saved ✓', 'ok');
          break;
      }
    }

    // Attach debugger when sync state arrives indicating it's enabled.
    if (dbgSync) {
      dbgSync.subscribe(function () { ensureDebuggerAttached(); });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Pane popup booter (multi-file with tab bar)
  // ─────────────────────────────────────────────────────────────────────────

  function bootPane(opts) {
    var els = opts.els || {};
    var pane = opts.pane;
    if (!pane) {
      if (els.overlay) els.overlay.textContent = 'Invalid popup URL (missing pane).';
      return;
    }

    var monacoReady = false;
    var editor = null;
    var models = {};      // filename -> { model, version }
    var activeFile = null;
    var suppressEditEvents = false;
    var refactoringHost = null;
    var flushAllEdits = function () {};
    var dbgSync = null;
    var dbgAttached = false;

    var client = SebookPopoutClient.connect({
      role: 'pane:' + pane,
      statusEl: els.status,
      statusClass: 'tpp-status',
      overlayEl: els.overlay,
      onMessage: handleMessage,
      onDarkModeChange: function (enabled) {
        if (window.monaco) monaco.editor.setTheme(pickTheme(enabled));
      },
      getFinalState: function () {
        var finalContents = {};
        Object.keys(models).forEach(function (fn) { finalContents[fn] = models[fn].model.getValue(); });
        return { finalContents: finalContents };
      },
    });
    var paneLabel = pane === 'left' ? 'Code' : pane === 'right' ? 'Tests' : pane;
    if (els.paneName) els.paneName.textContent = paneLabel;
    document.title = paneLabel + ' — ' + client.tutorialTitle;

    dbgSync = maybeBuildDebuggerSync(client, 'pane');
    if (dbgSync) dbgSync.requestSnapshot();

    function ensureDebuggerAttached() {
      if (dbgAttached || !dbgSync || !editor) return;
      var s = dbgSync.state;
      if (!s || !s.debuggerEnabled) return;
      dbgAttached = true;
      attachDebuggerToEditors([editor], dbgSync, function () {
        return function () { return activeFile; };
      });
    }

    function ensureMonacoLoaded(cb) {
      if (monacoReady) return cb();
      loadMonaco(function () {
        monacoReady = true;
        var dark = document.documentElement.classList.contains('dark-mode');
        var options = Object.assign({}, DEFAULT_OPTIONS, { theme: pickTheme(dark) });
        editor = monaco.editor.create(els.editor, options);
        wireFileEditing();
        wireRefactorings();
        ensureDebuggerAttached();
        cb();
      });
    }

    function wireFileEditing() {
      var debounceTimer;
      function flushEdit() {
        if (!activeFile) return;
        var entry = models[activeFile];
        if (!entry) return;
        clearTimeout(debounceTimer);
        entry.version = (entry.version || 0) + 1;
        client.post('file-edit', {
          filename: activeFile, content: entry.model.getValue(), version: entry.version,
        });
      }
      flushAllEdits = function () {
        clearTimeout(debounceTimer);
        Object.keys(models).forEach(function (fn) {
          var entry = models[fn];
          if (!entry) return;
          entry.version = (entry.version || 0) + 1;
          client.post('file-edit', {
            filename: fn, content: entry.model.getValue(), version: entry.version,
          });
        });
      };
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, function () {
        flushEdit();
        if (activeFile) client.post('request-save', { filename: activeFile });
      });
      editor.onDidChangeModelContent(function () {
        if (suppressEditEvents) return;
        if (!activeFile) return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(flushEdit, 30);
      });
    }

    function wireRefactorings() {
      if (!window.SebookRefactorings) return;
      refactoringHost = window.SebookRefactorings.createPopupHost(client, {
        flush: flushAllEdits,
        getActiveFileName: function () { return activeFile; },
        getActiveContent: function () {
          return activeFile && models[activeFile] ? models[activeFile].model.getValue() : '';
        },
      });
      window.SebookRefactorings.attach({
        monaco: monaco,
        editors: [editor],
        getActiveFileName: function () { return activeFile; },
        getWorkspace: refactoringHost.getWorkspace,
        applyEdits: refactoringHost.applyEdits,
      });
    }

    function renderTabs() {
      if (!els.tabBar) return;
      els.tabBar.innerHTML = '';
      Object.keys(models).forEach(function (fn) {
        var tab = document.createElement('div');
        tab.className = 'tvm-tab' + (fn === activeFile ? ' active' : '');
        tab.textContent = fn;
        tab.title = fn;
        tab.addEventListener('click', function () { setActiveFile(fn); });
        els.tabBar.appendChild(tab);
      });
    }

    function setActiveFile(fn) {
      if (!models[fn]) return;
      activeFile = fn;
      ensureMonacoLoaded(function () {
        editor.setModel(models[fn].model);
        renderTabs();
        // No-op if the debugger isn't attached yet; once it attaches the
        // editor.onDidChangeModel listener will re-paint decorations.
      });
    }

    function applyPaneSnapshot(snap) {
      if (!snap) return;
      if (typeof snap.darkMode === 'boolean') {
        document.documentElement.classList.toggle('dark-mode', snap.darkMode);
      }
      ensureMonacoLoaded(function () {
        var seen = {};
        var snapFiles = snap.files || {};
        Object.keys(snapFiles).forEach(function (fn) {
          seen[fn] = true;
          var sf = snapFiles[fn];
          var lang = languageForFile(fn, sf.language);
          if (!models[fn]) {
            models[fn] = { model: monaco.editor.createModel(sf.content || '', lang), version: sf.version || 0 };
          } else {
            if (typeof sf.version === 'number' && sf.version < (models[fn].version || 0)) return;
            if (models[fn].model.getValue() !== (sf.content || '')) {
              suppressEditEvents = true;
              try { models[fn].model.setValue(sf.content || ''); }
              finally { suppressEditEvents = false; }
            }
            if (typeof sf.version === 'number') models[fn].version = sf.version;
          }
        });
        Object.keys(models).forEach(function (fn) {
          if (!seen[fn]) {
            try { models[fn].model.dispose(); } catch (e) {}
            delete models[fn];
          }
        });
        var prefer = snap.activeFile || Object.keys(models)[0];
        if (prefer && models[prefer]) {
          activeFile = prefer;
          editor.setModel(models[activeFile].model);
        }
        renderTabs();
        client.markConnected();
        ensureDebuggerAttached();
      });
    }

    function handleMessage(msg) {
      if (refactoringHost && refactoringHost.handleMessage(msg)) return;
      switch (msg.type) {
        case 'pane-snapshot':
          if (msg.pane === pane) applyPaneSnapshot(msg);
          break;
        case 'state-snapshot':
          if (typeof msg.darkMode === 'boolean') {
            document.documentElement.classList.toggle('dark-mode', msg.darkMode);
          }
          break;
        case 'step-change':
          if (Array.isArray(msg.fileList)) {
            var anyKept = Object.keys(models).some(function (fn) {
              return msg.fileList.indexOf(fn) !== -1;
            });
            if (!anyKept) client.setStatus('Step changed — close to reattach', 'warn');
          }
          break;
        case 'save-confirmed':
          if (msg.filename && models[msg.filename]) client.flashStatus('Saved ✓', 'ok');
          break;
      }
    }

    if (dbgSync) {
      dbgSync.subscribe(function () { ensureDebuggerAttached(); });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public dispatcher
  // ─────────────────────────────────────────────────────────────────────────

  function bootForRole(opts) {
    if (!opts || !opts.kind) throw new Error('SebookSharedEditor.bootForRole: kind required');
    if (opts.kind === 'tab') return bootTab(opts);
    if (opts.kind === 'pane') return bootPane(opts);
    throw new Error('SebookSharedEditor.bootForRole: unknown kind ' + opts.kind);
  }

  window.SebookSharedEditor = { bootForRole: bootForRole };
})();
