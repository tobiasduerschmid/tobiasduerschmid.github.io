/** Keep the tokenizer table and the tutorial's persisted file model in sync. */
(function () {
  'use strict';

  // Validate the values the form materializes. Semantic errors (unknown token
  // names, invalid regexes, etc.) remain editable and are diagnosed by the core.
  function readSettings(text) {
    const settings = JSON.parse(text);
    const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    const names = value => value === undefined || (Array.isArray(value) && value.every(name => typeof name === 'string'));
    if (!object(settings) || !Array.isArray(settings.tokenRules) || settings.tokenRules.some(rule =>
      !object(rule) || typeof rule.name !== 'string' || typeof rule.pattern !== 'string' ||
      (rule.skip !== undefined && typeof rule.skip !== 'boolean')) ||
      (settings.startRule !== undefined && typeof settings.startRule !== 'string')) {
      throw new TypeError('Expected tokenizer settings.');
    }
    if (settings.ast !== undefined) {
      const ast = settings.ast;
      if (!object(ast) || !names(ast.discardTokens) || !names(ast.inlineRules) ||
        (ast.foldRules !== undefined && (!object(ast.foldRules) || Object.values(ast.foldRules).some(direction =>
          // Metadata has no student-facing controls. Invalid old drafts must
          // offer reset recovery instead of leaving an uneditable conflict.
          direction !== 'left' && direction !== 'right')))) {
        throw new TypeError('Expected AST construction settings.');
      }
    }
    return settings;
  }

  class CompilerTutorialEditor {
    constructor(host, codeSurface) {
      this.host = host;
      this.codeSurface = codeSurface;
      this.model = null;
      this.form = null;
      this.subscription = null;
      this.writing = false;
    }

    activate(model) {
      this.codeSurface.hidden = true;
      this.host.hidden = false;
      if (this.model === model) return;
      this.release();
      this.model = model;
      this.render();
      this.subscription = model.onDidChangeContent(() => {
        if (!this.writing) this.render();
      });
    }

    render() {
      let settings;
      const text = this.model.getValue();
      try {
        settings = readSettings(text);
      } catch (_) {
        if (this.form) this.form.destroy();
        this.form = null;
        const error = document.createElement('p');
        error.setAttribute('role', 'alert');
        error.textContent = 'The saved tokenizer settings could not be read. Use Reset Step to restore this step’s starter rules.';
        this.host.replaceChildren(error);
        return;
      }
      if (this.form) {
        this.form.setValue(settings);
        return;
      }
      this.host.replaceChildren();
      this.form = window.CompilerLabView.createRulesEditor(this.host, settings, {
        onChange: value => {
          this.writing = true;
          try { this.model.setValue(JSON.stringify(value, null, 2) + '\n'); }
          finally { this.writing = false; }
        },
      });
    }

    release() {
      if (this.subscription) this.subscription.dispose();
      if (this.form) this.form.destroy();
      this.subscription = null;
      this.form = null;
      this.model = null;
      this.host.replaceChildren();
    }

    hide() {
      this.release();
      this.host.hidden = true;
      this.codeSurface.hidden = false;
    }

    destroy() { this.hide(); }
  }

  window.CompilerTutorialEditor = CompilerTutorialEditor;

  /** The source remains visible while the learner edits tokenizer or grammar rules. */
  class CompilerTutorialSource {
    constructor(textarea) {
      this.textarea = textarea;
      this.model = null;
      this.subscription = null;
      this.onInput = () => {
        if (this.model && !this.model.isDisposed()) this.model.setValue(this.textarea.value);
      };
      textarea.addEventListener('input', this.onInput);
    }

    activate(model) {
      if (this.subscription) this.subscription.dispose();
      this.model = model;
      this.textarea.value = model.getValue();
      this.subscription = model.onDidChangeContent(() => {
        const value = model.getValue();
        if (this.textarea.value !== value) this.textarea.value = value;
      });
    }

    destroy() {
      if (this.subscription) this.subscription.dispose();
      this.textarea.removeEventListener('input', this.onInput);
      this.model = null;
    }
  }

  window.CompilerTutorialSource = CompilerTutorialSource;
})();
