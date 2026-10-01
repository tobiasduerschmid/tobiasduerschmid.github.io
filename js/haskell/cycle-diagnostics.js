/** Monaco markers, readable diagnostics, and the tutorial's preflight policy. */
(function (root) {
  'use strict';
  class CycleDiagnostics {
    constructor(tutorial) {
      this.tutorial = tutorial;
      this.region = tutorial.root.querySelector('[data-haskell-diagnostics]');
      this.status = this.region.querySelector('[role="status"]');
      this.list = this.region.querySelector('ul');
      this.timer = null;
    }
    schedule() {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.refresh(), 300);
    }
    refresh() {
      if (this.tutorial._destroyed) return;
      const findings = [];
      for (const [filename, entry] of Object.entries(this.tutorial.editorModels)) {
        if (!filename.endsWith('.hs') || entry.model.isDisposed()) continue;
        const result = root.SEBookHaskellCycles.analyze(entry.model.getValue(), { filename });
        findings.push(...result.diagnostics);
        root.monaco.editor.setModelMarkers(entry.model, 'haskell-cycles', result.diagnostics.map(item => ({
          severity: item.severity === 'error' ? 8 : 4, source: 'Haskell cycle check',
          startLineNumber: item.line, endLineNumber: item.line,
          startColumn: item.column, endColumn: item.endColumn, message: item.message,
        })));
      }
      const status = 'Haskell cycle diagnostics: ' + (findings.length
        ? findings.length + ' warning(s).'
        : 'checks cover simple value aliases only.');
      this.region.setAttribute('aria-label', status);
      if (this.status.textContent !== status) this.status.textContent = status;
      const text = findings.map(item => item.filename + ':' + item.line + ':' + item.column + ' — ' + item.message);
      // Keep the focused region and announcement stable during unrelated edits.
      const signature = text.join('\n');
      if (signature === this.signature) return;
      this.signature = signature;
      this.list.replaceChildren(...text.map(message => {
        const item = document.createElement('li'); item.textContent = message; return item;
      }));
    }
    check(filename, expression) {
      this.refresh();
      const entry = this.tutorial.editorModels[filename];
      if (!entry) return true;
      const result = root.SEBookHaskellCycles.analyze(entry.model.getValue(), { filename, expression });
      if (!result.blocked) return true;
      const messages = result.diagnostics.filter(item => item.severity === 'error')
        .map(item => item.filename + ':' + item.line + ':' + item.column + ' — ' + item.message);
      this.tutorial._appendOutput(messages.join('\n') + '\n', 'err');
      this.status.textContent = 'Haskell cycle diagnostics: execution blocked. Correct the highlighted binding.';
      this.region.setAttribute('aria-label', this.status.textContent);
      return false;
    }
    dispose() { clearTimeout(this.timer); }
  }
  root.SEBookHaskellCycleDiagnostics = CycleDiagnostics;
})(globalThis);
