/* Shell command drafts use the tutorial's existing progress record and controls. */
(function () {
  'use strict';
  const prototype = window.TutorialCode.prototype;

  prototype._mountShellCommand = function () {
    const panel = document.createElement('div');
    panel.className = 'tvm-shell-command-panel';
    const label = document.createElement('label');
    label.textContent = 'Shell command';
    const input = document.createElement('textarea');
    input.id = 'shell-command-' + this.tutorialId;
    input.rows = 3;
    input.spellcheck = false;
    input.autocapitalize = 'off';
    input.setAttribute('autocomplete', 'off');
    label.htmlFor = input.id;
    const hint = document.createElement('p');
    hint.id = input.id + '-help';
    hint.textContent = 'Run uses the files above. Each run starts with a fresh copy; use one command or a pipeline.';
    input.setAttribute('aria-describedby', hint.id);
    panel.append(label, input, hint);
    this.outputPanel.prepend(panel);
    this.shellCommandEl = input;
    this._shellCommandDrafts = {};
    this._shellCommandRevision = 0;
    this.root.classList.add('shell-pipeline-tutorial');
    this.root.querySelector('.tvm-run-btn').setAttribute('data-original-title', 'Run shell command (Ctrl+Enter)');
    input.addEventListener('input', () => {
      this._shellCommandRevision++;
      this._rememberShellCommand();
      this._invalidateShellCommandCredit();
      this._autoSaveProgress();
    });
    input.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        this._runCurrentFile();
      }
    });
  };

  prototype._getShellCommand = function () {
    return this.shellCommandEl ? this.shellCommandEl.value : '';
  };

  prototype._rememberShellCommand = function () {
    if (this.shellCommandEl && this.currentStep >= 0) {
      this._shellCommandDrafts[this._draftStepKey(this.currentStep)] = this._getShellCommand();
    }
  };

  prototype._restoreShellCommand = function (step, progress) {
    if (!this.shellCommandEl) return;
    const saved = (progress.shellCommands || {})[this._draftStepKey(this.currentStep)];
    this._shellCommandRevision++;
    this.shellCommandEl.value = typeof saved === 'string' ? saved : (step.shell_command || '');
  };

  prototype._replaceShellCommand = function (command) {
    if (!this.shellCommandEl) return;
    this._stopShellPipeline({ silent: true });
    this._shellCommandRevision++;
    this.shellCommandEl.value = command;
    this._rememberShellCommand();
    this._invalidateShellCommandCredit();
    this._autoSaveProgress();
  };

  prototype._invalidateShellCommandCredit = function () {
    this._stepsPassed.delete(this.currentStep);
    this._testResults = [];
    const panel = this.stepContentEl.querySelector('.tvm-test-panel');
    if (panel) panel.replaceChildren();
    this._renderStepNav();
    this._refreshTestButton(this.currentStep);
    const next = this.stepControlsEl.querySelector('.tvm-btn-next');
    if (next) {
      next.disabled = this._isNextStepLocked();
      next.setAttribute('data-original-title', next.disabled ? 'Pass all tests to continue' : 'Next step');
    }
    if (this._popoutManager) {
      this._popoutManager.broadcastTestResult({ resultsHTML: '', results: [], allPassed: false, stepIndex: this.currentStep });
      this._broadcastNavState();
    }
  };
})();
