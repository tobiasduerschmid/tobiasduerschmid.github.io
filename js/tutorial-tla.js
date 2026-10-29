/** SEBook integration only. The runtime and model workspace also work without tutorials. */
(function (root) {
  'use strict';
  const directory = new URL('tla/', document.currentScript.src);

  function install(TutorialCode) {
    const prototype = TutorialCode.prototype;
    if (prototype._initTLA) return;

    prototype._tlaSnapshot = function () {
      const files = Object.fromEntries(Object.entries(this.editorModels).map(([name, entry]) => [name, entry.model.getValue()]));
      return this._tlaModel.snapshot(files, this.steps[this.currentStep] || {}, this.config.tla);
    };

    prototype._initTLA = async function () {
      if (this.setupCommands.length) throw new Error('TLA+ tutorials use module and configuration files, not setup_commands.');
      const [{ TLAClient }, { createTLAController }, model, assessment] = await Promise.all([
        import(new URL('client.mjs', directory)), import(new URL('controller.mjs', directory)), import(new URL('model.mjs', directory)),
        import(new URL('assessment.mjs', directory)),
      ]);
      if (this._destroyed) throw new Error('Tutorial was destroyed.');
      this._tlaModel = model;
      this._tlaAssessment = assessment;
      this._tlaClient = new TLAClient();
      this._tlaController = createTLAController({
        root: this.root.querySelector('.tla-tutorial-results'),
        client: this._tlaClient,
        getSnapshot: () => this._tlaSnapshot(),
        onCheck: () => this._runCurrentFile(),
        onOperation: operation => this._runCurrentFile({ tlaOperation: operation }),
        onSourceLocation: location => this._showTLASource(location),
      });
      const title = this.root.querySelector('.tvm-output-header > span');
      if (title) title.textContent = 'Model checker';
      this.root.querySelector('.tvm-run-btn')?.setAttribute('data-original-title', 'Check the configured model (Ctrl+Enter)');
      this.booted = true; // The editor is ready; Java downloads only on the first operation.
    };

    prototype._showTLASource = function (location) {
      if (!location) return;
      if (location.generated) {
        const translation = this.root.querySelector('.tla-generated');
        if (translation) { translation.open = true; translation.querySelector('summary')?.focus(); }
        return;
      }
      const file = location.file || (location.module && location.module + '.tla');
      if (!file || !this.editorModels[file] || !Number.isInteger(location.line)) return;
      this._activateFile(file);
      const editor = this.editor;
      if (!editor) return;
      const line = Math.max(1, Math.min(location.line, editor.getModel().getLineCount()));
      const column = Math.max(1, location.column || 1);
      editor.setSelection({ startLineNumber: line, startColumn: column, endLineNumber: Math.max(line, location.endLine || line), endColumn: (location.endColumn || column) + 1 });
      editor.revealLineInCenter(line);
      editor.focus();
    };

    prototype._runTLA = async function (run) {
      const result = await this._tlaController.run(run.tlaOperation || 'check');
      return result.status === 'complete';
    };

    prototype._runTestsTLA = async function (run) {
      const tests = this.steps[run.stepIndex].tests;
      const loadSequence = this._stepLoadSequence;
      run.tlaLoad = loadSequence;
      run.tlaDetails = tests.map(() => 'Not checked.');
      let results = tests.map(() => null);
      if (!run.silent) this._showTestPanel('<div class="tvm-test-running">Checking the configured model…</div>');
      this._setRunTransactionControls('running', 'Checking…');
      try {
        const original = this._tlaSnapshot();
        // Capture one immutable student submission for the whole authored batch.
        // Each test receives a fresh JVM and its own instructor configuration.
        for (let index = 0; index < tests.length; index++) {
          if (this._destroyed || this.currentStep !== run.stepIndex || this._stepLoadSequence !== loadSequence) break;
          const checkRequest = this._tlaAssessment.buildCheck(original, tests[index].tla);
          const result = await this._tlaController.run('check', checkRequest);
          if (this._destroyed || this.currentStep !== run.stepIndex || this._stepLoadSequence !== loadSequence ||
              !this._tlaModel.sameSnapshot(original, this._tlaSnapshot()) || ['stale', 'cancelled'].includes(result.reason)) {
            results.fill(null);
            run.tlaDetails.fill('These checks were interrupted or the files changed. Test your current work again.');
            break;
          }
          results[index] = this._tlaAssessment.assess(result, tests[index].tla);
          run.tlaDetails[index] = this._tlaAssessment.feedback(result, tests[index].tla);
        }
      } catch (error) {
        results.fill(null);
        run.tlaDetails.fill(error.message);
        if (!this._destroyed && this.currentStep === run.stepIndex && this._stepLoadSequence === loadSequence) this._appendOutput(error.message + '\n', 'err');
      } finally {
        if (!this._destroyed) {
          this._renderTestResults(tests, results, run);
          if (!this._activeRunTransaction) this._setRunTransactionControls('idle');
        }
      }
    };

    prototype._invalidateTLA = function () {
      this._tlaController?.markStale();
      this._stepsPassed.delete(this.currentStep);
      this._testResults = [];
      this.stepContentEl.querySelector('.tvm-test-panel')?.replaceChildren();
      this._renderStepNav();
      this._refreshTestButton(this.currentStep);
      const next = this.stepControlsEl.querySelector('.tvm-btn-next');
      if (next) next.disabled = this._isNextStepLocked();
      if (this._popoutManager) {
        this._popoutManager.broadcastTestResult({ resultsHTML: '', results: [], allPassed: false, stepIndex: this.currentStep });
        this._broadcastNavState();
      }
    };
  }
  root.TutorialTLA = { install };
  if (root.TutorialCode) install(root.TutorialCode);
})(window);
