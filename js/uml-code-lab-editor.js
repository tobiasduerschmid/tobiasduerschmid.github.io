/**
 * Enhance a chapter's native source field with Monaco, source-problem markers,
 * and the shared tutorial refactorings. UML analysis and source checks stay in
 * the host.
 */
(function (global) {
  'use strict';

  const PROBLEM_MARKER_OWNER = 'sebook-source-check';
  // PascalCase names are `type.identifier`. The built-in light theme paints
  // that token #008080, which is only 4.8:1 on the white editor. #04383c is
  // the same teal at 12.8:1, close to the weight of the surrounding code.
  // Dark mode keeps the built-in cyan, already about 10:1 on black.
  const LIGHT_TYPE_NAME = '04383c';

  function labTheme(monaco) {
    const dark = document.documentElement.classList.contains('dark-mode');
    const id = dark ? 'sebook-uml-dark' : 'sebook-uml-light';
    monaco.editor.defineTheme(id, {
      base: dark ? 'vs-dark' : 'vs',
      inherit: true,
      rules: dark ? [] : [{ token: 'type.identifier', foreground: LIGHT_TYPE_NAME }],
      // The built-in light theme fades unreferenced names to about 47% opacity.
      // Example classes are often unreferenced, and that fade is the washed-out gray.
      colors: { 'editorUnnecessaryCode.opacity': '#000000ff' }
    });
    return id;
  }

  /** The lab's source check marks TypeScript problems with fix hints; Monaco's own copy would repeat them. */
  function leaveTypeScriptDiagnosticsToLab(monaco, languages) {
    if (!languages.includes('typescript')) return;
    const defaults = monaco.languages.typescript.typescriptDefaults;
    defaults.setDiagnosticsOptions({ ...defaults.getDiagnosticsOptions(),
      noSyntaxValidation: true, noSemanticValidation: true });
  }

  function problemMarkers(monaco, problems) {
    return problems.map(problem => ({
      severity: monaco.MarkerSeverity.Error,
      message: problem.hint ? problem.message + '\n' + problem.hint : problem.message,
      startLineNumber: problem.line,
      startColumn: problem.column,
      endLineNumber: problem.endLine,
      endColumn: problem.endColumn
    }));
  }

  function create(source, host, languages) {
    let editor;
    let refactorings = null;
    let language = 'python';
    let label = 'Python code';
    let filename = 'example.py';
    let problems = [];
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
        theme: labTheme(global.monaco)
      });
      fitContent();
    }

    const themeObserver = new MutationObserver(updateAppearance);
    const sizeObserver = new ResizeObserver(updateAppearance);

    function showProblems(nextProblems) {
      problems = nextProblems;
      if (!editor) return;
      global.monaco.editor.setModelMarkers(editor.getModel(), PROBLEM_MARKER_OWNER, problemMarkers(global.monaco, problems));
      // An open problem panel would keep describing an error that is gone.
      // Closing it focuses the editor, so only do that while the learner is in it.
      // Monaco's blur notification can lag behind focus moving to a language tab.
      if (!problems.length && host.contains(document.activeElement) && editor.hasWidgetFocus()) {
        editor.trigger('sebook', 'closeMarkersNavigation', null);
      }
    }

    function attachRefactorings(monaco) {
      if (!global.SebookRefactorings) return null;
      return global.SebookRefactorings.attach({
        monaco,
        editors: [editor],
        getActiveFileName: () => filename,
        getWorkspace: () => ({ activeFile: filename, files: [{ filename, content: editor.getValue(), language }] }),
        applyEdits: edits => global.SebookRefactorings.applyEditsToModels(monaco, edits,
          name => name === filename ? editor.getModel() : null)
      });
    }

    function sync(nextLanguage, nextLabel, nextFilename) {
      language = nextLanguage;
      label = nextLabel;
      filename = nextFilename;
      problems = [];
      if (!editor) return;
      syncing = true;
      global.monaco.editor.setModelLanguage(editor.getModel(), language);
      editor.setValue(source.value);
      showProblems([]);
      editor.updateOptions({ ariaLabel: label + '. Press Escape to leave the editor.' });
      syncing = false;
      updateAppearance();
      refreshVisibleSyntax();
    }

    global.SEBookMonaco.loadLanguages(languages).then(monaco => {
      if (destroyed) return;
      leaveTypeScriptDiagnosticsToLab(monaco, languages);
      const focused = document.activeElement === source;
      const selection = [source.selectionStart, source.selectionEnd];
      host.hidden = false;
      editor = monaco.editor.create(host, {
        value: source.value, language, theme: labTheme(monaco),
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
        // Hint hovers must not be clipped by the content-sized editor box.
        fixedOverflowWidgets: true
      });
      global.SebookMonacoFocusExit.attach(editor);
      showProblems(problems);
      // Refactorings analyze with Pyodide; load it only for learners who edit.
      const firstFocus = editor.onDidFocusEditorText(() => {
        firstFocus.dispose();
        refactorings = attachRefactorings(monaco);
      });
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
      if (refactorings) { refactorings.dispose(); refactorings = null; }
      if (editor) { editor.getModel().dispose(); editor.dispose(); editor = null; }
      source.hidden = false;
      host.hidden = true;
    });

    return {
      sync,
      showProblems,
      destroy() {
        destroyed = true;
        themeObserver.disconnect();
        sizeObserver.disconnect();
        if (refactorings) refactorings.dispose();
        if (editor) { editor.getModel().dispose(); editor.dispose(); }
      }
    };
  }

  global.UMLCodeLabEditor = { create };
})(window);
