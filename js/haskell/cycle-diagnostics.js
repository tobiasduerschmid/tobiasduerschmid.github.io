/** Monaco markers, readable diagnostics, and the tutorial's preflight policy. */
(function (root) {
  'use strict';
  class CycleDiagnostics {
    constructor(tutorial) {
      this.tutorial = tutorial;
      this.region = tutorial.root.querySelector('[data-haskell-diagnostics]');
      this.status = this.region.querySelector('p');
      this.announcement = tutorial.root.querySelector('[data-haskell-cycle-announcement]');
      this.list = this.region.querySelector('ul');
      this.timer = null;
    }
    schedule() {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.refresh(), 300);
    }
    setStatus(message) {
      this.region.hidden = !message;
      this.region.setAttribute('aria-label', message || 'Haskell cycle diagnostics');
      if (this.status.textContent !== message) this.status.textContent = message;
      // The live region stays exposed even when the visual panel is hidden.
      if (this.announcement.textContent !== message) this.announcement.textContent = message;
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
      this.setStatus(findings.length ? 'Haskell cycle diagnostics: ' + findings.length + ' warning(s).' : '');
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
      this.setStatus('Haskell cycle diagnostics: execution blocked. Correct the highlighted binding.');
      return false;
    }
    dispose() { clearTimeout(this.timer); }
  }
  root.SEBookHaskellCycleDiagnostics = CycleDiagnostics;
})(globalThis);
