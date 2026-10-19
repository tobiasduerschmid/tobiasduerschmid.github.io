/** Enhance a chapter's native source field; UML analysis stays in its host. */
(function (global) {
  'use strict';

  // Monaco 0.44 does not expose TypeScript's ModuleDetectionKind enum.
  const MODULE_DETECTION_FORCE = 3;

  function isolateTypeScriptLabs(monaco, languages) {
    if (!languages.includes('typescript')) return;
    const defaults = monaco.languages.typescript.typescriptDefaults;
    const options = defaults.getCompilerOptions();
    if (options.moduleDetection !== MODULE_DETECTION_FORCE) {
      // Each lab is a separate program, even when its code has no imports.
      defaults.setCompilerOptions({ ...options, moduleDetection: MODULE_DETECTION_FORCE });
    }
  }

  function create(source, host, languages) {
    let editor;
    let language = 'python';
    let label = 'Python code';
    let destroyed = false;
    let syncing = false;

    function fitContent() {
      if (!editor) return;
      const style = getComputedStyle(host);
      const borders = style.boxSizing === 'border-box'
        ? parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth) : 0;
      const height = Math.ceil(editor.getContentHeight() + borders) + 'px';
      if (host.style.height !== height) {
        host.style.height = height;
        editor.layout();
      }
    }

    function refreshVisibleSyntax() {
      if (!editor) return;
      const model = editor.getModel();
      const ranges = editor.getVisibleRanges();
      const lastLine = Math.min(model.getLineCount(), ranges.length
        ? ranges[ranges.length - 1].endLineNumber : source.rows);
      // Monaco defers background tokenization until idle. Its public line
      // colorizer updates the model's tokens synchronously for this viewport.
      global.monaco.editor.colorizeModelLine(model, lastLine);
    }

    function updateAppearance() {
      if (!editor) return;
      const style = getComputedStyle(host.parentElement);
      const fontSize = parseFloat(style.fontSize);
      editor.updateOptions({
        fontSize, lineHeight: Math.ceil(fontSize * 1.5),
        theme: document.documentElement.classList.contains('dark-mode') ? 'vs-dark' : 'vs'
      });
      fitContent();
    }

    const themeObserver = new MutationObserver(updateAppearance);
    const sizeObserver = new ResizeObserver(updateAppearance);

    function sync(nextLanguage, nextLabel) {
      language = nextLanguage;
      label = nextLabel;
      if (!editor) return;
      syncing = true;
      global.monaco.editor.setModelLanguage(editor.getModel(), language);
      editor.setValue(source.value);
      editor.updateOptions({ ariaLabel: label + '. Press Escape to leave the editor.' });
      syncing = false;
      updateAppearance();
      refreshVisibleSyntax();
    }

    global.SEBookMonaco.loadLanguages(languages).then(monaco => {
      if (destroyed) return;
      isolateTypeScriptLabs(monaco, languages);
      const focused = document.activeElement === source;
      const selection = [source.selectionStart, source.selectionEnd];
      host.hidden = false;
      editor = monaco.editor.create(host, {
        value: source.value, language,
        ariaLabel: label + '. Press Escape to leave the editor.',
        accessibilitySupport: 'auto',
        automaticLayout: true,
        minimap: { enabled: false },
        lineNumbers: 'off', folding: false, glyphMargin: false,
        lineDecorationsWidth: 8, lineNumbersMinChars: 0,
        scrollBeyondLastLine: false, wordWrap: 'on',
        tabSize: 4, insertSpaces: true, detectIndentation: false,
        fontFamily: getComputedStyle(source).fontFamily,
        padding: { top: 8, bottom: 8 },
        renderLineHighlight: 'none',
        quickSuggestions: false, suggestOnTriggerCharacters: false,
        parameterHints: { enabled: false },
        overviewRulerLanes: 0, hideCursorInOverviewRuler: true,
        scrollbar: { alwaysConsumeMouseWheel: false },
        contextmenu: false
      });
      global.SebookMonacoFocusExit.attach(editor);
      editor.onDidContentSizeChange(() => {
        fitContent();
        refreshVisibleSyntax();
      });
      editor.onDidChangeModelContent(() => {
        if (syncing) return;
        refreshVisibleSyntax();
        source.value = editor.getValue();
        source.dispatchEvent(new Event('input', { bubbles: true }));
      });
      editor.onDidScrollChange(refreshVisibleSyntax);
      editor.onDidCompositionStart(() => source.dispatchEvent(new Event('compositionstart')));
      editor.onDidCompositionEnd(() => source.dispatchEvent(new Event('compositionend')));
      source.hidden = true;
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      sizeObserver.observe(host.parentElement);
      updateAppearance();
      refreshVisibleSyntax();
      if (focused) {
        const model = editor.getModel();
        const start = model.getPositionAt(selection[0]);
        const end = model.getPositionAt(selection[1]);
        editor.setSelection(new monaco.Selection(start.lineNumber, start.column, end.lineNumber, end.column));
        editor.focus();
      }
    }).catch(() => {
      // The native field remains editable when the optional editor cannot load.
      if (editor) { editor.getModel().dispose(); editor.dispose(); editor = null; }
      source.hidden = false;
      host.hidden = true;
    });

    return {
      sync,
      destroy() {
        destroyed = true;
        themeObserver.disconnect();
        sizeObserver.disconnect();
        if (editor) { editor.getModel().dispose(); editor.dispose(); }
      }
    };
  }

  global.UMLCodeLabEditor = { create };
})(window);
