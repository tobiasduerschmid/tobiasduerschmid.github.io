/** Adapt the browser shell to tutorial Run/check transactions and editor snapshots. */
(function (root) {
  'use strict';
  const moduleUrl = new URL('shell-pipeline-client.mjs', document.currentScript.src).href;
  const hintsUrl = new URL('shell-pipeline-hints.mjs', document.currentScript.src).href;

  function snapshot(tutorial) {
    const files = {};
    const versions = {};
    for (const [path, entry] of Object.entries(tutorial.editorModels)) {
      files[path] = entry.model.getValue();
      versions[path] = entry.model.getVersionId();
    }
    return {
      files, versions,
      command: tutorial._getShellCommand(),
      commandRevision: tutorial._shellCommandRevision || 0,
      loadSequence: tutorial._stepLoadSequence,
      generation: tutorial._shellPipelineGeneration || 0,
    };
  }

  function isCurrent(tutorial, run, original) {
    return !tutorial._destroyed && tutorial.currentStep === run.stepIndex &&
      JSON.stringify(snapshot(tutorial)) === JSON.stringify(original);
  }

  function install(TutorialCode) {
    const prototype = TutorialCode.prototype;
    if (prototype._initShellPipeline) return;

    prototype._initShellPipeline = async function () {
      if (this.setupCommands.length) throw new Error('Shell pipeline tutorials use editor files, not setup_commands.');
      const { ShellPipelineClient } = await import(moduleUrl);
      const { matchesPipelineHint } = await import(hintsUrl);
      if (this._destroyed) throw new Error('Tutorial was destroyed.');
      this._shellPipelineClient = new ShellPipelineClient({ manuals: this.config.shellManuals || {} });
      this._matchesPipelineHint = matchesPipelineHint;
      await this._shellPipelineClient.initialize();
      this.booted = true;
    };

    prototype._evaluateShellPipelineHint = function (condition, command) {
      const snapshot = this._shellPipelineHintSnapshot;
      return !!(snapshot && snapshot.command === command && this._matchesPipelineHint(condition, snapshot.analysis));
    };

    prototype._runShellPipeline = async function (run) {
      const original = snapshot(this);
      this._clearOutput();
      if (!original.command.trim()) {
        this._appendOutput('Enter a shell command, then choose Run.\n', 'info');
        return false;
      }
      const result = await this._shellPipelineClient.execute({ action: 'run', files: original.files, command: original.command });
      if (!isCurrent(this, run, original)) {
        if (!this._destroyed && this.currentStep === run.stepIndex && this._stepLoadSequence === original.loadSequence) {
          this._appendOutput('Files or the command changed during execution. Run again to see the current result.\n', 'info');
        }
        return false;
      }
      this._appendOutput(result.stdout, 'out');
      this._appendOutput(result.stderr, 'err');
      if (result.exitCode !== 0) this._appendOutput('Shell exited with status ' + result.exitCode + '.\n', 'err');
      return result.exitCode === 0;
    };

    prototype._runTestsShellPipeline = async function (run) {
      const tests = this.steps[run.stepIndex].tests;
      const original = snapshot(this);
      run.shellPipelineLoad = original.loadSequence;
      let results = new Array(tests.length).fill(null);
      this._shellPipelineHintSnapshot = null;
      this._clearOutput();
      if (!run.silent) this._showTestPanel('<div class="tvm-test-running">Checking shell commands…</div>');
      this._setRunTransactionControls('running', 'Checking…');
      try {
        const analysis = await this._shellPipelineClient.execute({ action: 'analyze', command: original.command });
        if (isCurrent(this, run, original)) this._shellPipelineHintSnapshot = { command: original.command, analysis };
        for (let index = 0; index < tests.length; index++) {
          if (!isCurrent(this, run, original)) break;
          const result = await this._shellPipelineClient.execute({
            action: 'check', command: original.command, files: original.files, check: tests[index].shell_pipeline,
          });
          if (!isCurrent(this, run, original)) break;
          results[index] = result.passed;
          if (!run.silent && !result.passed && result.diagnostic) {
            this._appendOutput(tests[index].description + ':\n' + result.diagnostic + '\n', 'err');
          }
        }
      } catch (error) {
        results = new Array(tests.length).fill(null);
        if (error.reason !== 'terminated' && !this._destroyed && this.currentStep === run.stepIndex && this._stepLoadSequence === original.loadSequence) {
          this._appendOutput(error.message + '\n', 'err');
        }
      } finally {
        if (!isCurrent(this, run, original)) {
          results = new Array(tests.length).fill(null);
          if (!run.shellPipelineStopped && !this._destroyed && this.currentStep === run.stepIndex && this._stepLoadSequence === original.loadSequence) {
            this._appendOutput('Files or the command changed during the checks. Test again to check the current work.\n', 'info');
          }
        }
        if (!this._destroyed) this._renderTestResults(tests, results, run);
        if (!this._destroyed && !this._activeRunTransaction && !this._activeTestRun) this._setRunTransactionControls('idle');
        if (run.shellPipelineRestoreTestFocus && !this._destroyed && this.currentStep === run.stepIndex && this._stepLoadSequence === original.loadSequence && document.activeElement === document.body) {
          const button = this.stepControlsEl.querySelector('.tvm-btn-test');
          if (button && !button.disabled) button.focus();
        }
      }
    };

    prototype._stopShellPipeline = function (options) {
      this._shellPipelineGeneration = (this._shellPipelineGeneration || 0) + 1;
      if (!(options && options.silent) && document.activeElement === this.root.querySelector('.tvm-stop-btn')) {
        this._shellPipelineRestoreRunFocus = true;
      }
      if (this._activeTestRun) this._activeTestRun.shellPipelineStopped = true;
      if (this._shellPipelineClient) this._shellPipelineClient.reset();
      if (!(options && options.silent)) this._appendOutput('Execution stopped. The editor files and command are unchanged.\n', 'info');
    };
  }

  root.TutorialShellPipeline = { install };
  if (root.TutorialCode) install(root.TutorialCode);
})(window);
