/** Tutorial lifecycle adapter. OSATE execution, diagrams, and grading have separate owners. */
(function (root) {
  'use strict';
  const directory = new URL('aadl/', document.currentScript.src);

  function install(TutorialCode) {
    const prototype = TutorialCode.prototype;
    if (prototype._initAADL) return;

    prototype._registerAADLLanguage = async function () {
      const { registerAADLLanguage } = await import(new URL('language.mjs', directory));
      registerAADLLanguage(window.monaco);
    };

    prototype._aadlSnapshot = function () {
      const files = Object.fromEntries(Object.entries(this.editorModels).map(([name, entry]) => [name, entry.model.getValue()]));
      const step = this.steps[this.currentStep] || {};
      const selected = this._aadlRootOverride == null ? step : { ...step, aadl: { ...step.aadl, root: this._aadlRootOverride } };
      return this._aadlModel.snapshot(files, selected, this.config.aadl);
    };

    prototype._initAADL = async function () {
      if (this.setupCommands.length) throw new Error('AADL tutorials use model files, not setup_commands.');
      const [{ AADLClient }, { createAADLController }, { mountAADLView }, model, assessment] = await Promise.all([
        import(new URL('client.mjs', directory)), import(new URL('controller.mjs', directory)),
        import(new URL('view.mjs', directory)), import(new URL('model.mjs', directory)), import(new URL('assessment.mjs', directory)),
      ]);
      if (this._destroyed) throw new Error('Tutorial was destroyed.');
      this._aadlModel = model;
      this._aadlAssessment = assessment;
      const view = mountAADLView(this.root.querySelector('.aadl-workspace'), {
        onStop: () => this._stopExecution(),
        onSourceLocation: location => this._showAADLSource(location),
        onRootChange: selectedRoot => {
          this._aadlRootOverride = selectedRoot;
          this._invalidateAADL();
          this._aadlController.schedule();
          this._autoSaveProgress();
        },
      });
      this._aadlController = createAADLController({
        client: new AADLClient(), view, getSnapshot: () => this._aadlSnapshot(),
        onBusyChange: busy => {
          if (!this._activeRunTransaction && !this._testRunInFlight) this._setRunTransactionControls(busy ? 'running' : 'idle', 'Checking architecture…');
        },
      });
      const title = this.root.querySelector('.tvm-output-header > span');
      if (title) title.textContent = 'Architecture';
      this.root.querySelector('.tvm-run-btn')?.setAttribute('data-original-title', 'Analyze the current AADL architecture');
      this.booted = true;
    };

    prototype._showAADLSource = function (location) {
      if (!location || !this.editorModels[location.file] || !Number.isInteger(location.line)) return;
      this._activateFile(location.file);
      if (!this.editor) return;
      const model = this.editor.getModel();
      const line = Math.max(1, Math.min(location.line, model.getLineCount()));
      const endLine = Math.max(line, Math.min(location.endLine || line, model.getLineCount()));
      this.editor.setSelection({
        startLineNumber: line, startColumn: Math.max(1, location.column || 1),
        endLineNumber: endLine, endColumn: Math.min(model.getLineMaxColumn(endLine), (location.endColumn || location.column || 1) + 1),
      });
      this.editor.revealLineInCenter(line);
      this.editor.focus();
    };

    prototype._runAADL = async function () {
      const result = await this._aadlController.run('analyze');
      return result.status === 'complete';
    };

    prototype._runTestsAADL = async function (run) {
      const tests = this.steps[run.stepIndex].tests;
      const loadSequence = this._stepLoadSequence;
      run.aadlLoad = loadSequence;
      run.aadlDetails = tests.map(() => 'Not checked.');
      const results = tests.map(() => null);
      if (!run.silent) this._showTestPanel('<div class="tvm-test-running">Analyzing the current architecture…</div>');
      this._setRunTransactionControls('running', 'Analyzing…');
      try {
        const original = this._aadlSnapshot();
        // One engine result supplies every criterion for this submission.
        const result = await this._aadlController.run('analyze');
        const current = !this._destroyed && this.currentStep === run.stepIndex && this._stepLoadSequence === loadSequence
          && this._aadlModel.sameSnapshot(original, this._aadlSnapshot());
        if (!current || ['stale', 'canceled', 'cancelled', 'disposed'].includes(result.reason)) {
          run.aadlDetails.fill('These checks were interrupted or the files changed. Test your current work again.');
        } else {
          tests.forEach((check, index) => {
            const verdict = this._aadlAssessment.assess(result, check.aadl);
            results[index] = verdict.passed;
            run.aadlDetails[index] = verdict.message;
          });
        }
      } catch (error) {
        results.fill(null);
        run.aadlDetails.fill(error.message);
      } finally {
        if (!this._destroyed) {
          this._renderTestResults(tests, results, run);
          if (!this._activeRunTransaction) this._setRunTransactionControls('idle');
        }
      }
    };

    prototype._aadlEditorChanged = function () {
      if (this._suppressAutoSave) {
        this._aadlController?.markStale();
        return;
      }
      this._invalidateAADL();
      this._aadlController?.schedule();
      this._autoSaveProgress();
    };

    prototype._invalidateAADL = function () {
      this._aadlController?.markStale();
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
  root.TutorialAADL = { install };
  if (root.TutorialCode) install(root.TutorialCode);
})(window);
