/* Optional bridge: the Python tutorial retains ownership of its worker and files. */
(function () {
  'use strict';
  var modules = new URL('browser-llm/checks.mjs', document.currentScript.src).href;
  var proto = window.TutorialCode.prototype;
  proto.captureTutorFiles = function () {
    var authored = new Map((this.steps[this.currentStep].files || []).map(function (file) { return [file.path,file]; }));
    var paths = new Set([...authored.keys(),...Object.keys(this.editorModels)]);
    return Array.from(paths,function (path) {
      var entry = this.editorModels[path];
      var content = entry ? entry.model.getValue() : authored.get(path).content;
      if (typeof content !== 'string') throw new Error('The source file '+path+' is not ready for the tutor.');
      return {path:path,content:content};
    },this);
  };
  proto.captureLlmSnapshot = function (file) {
    var entry = this.editorModels[file];
    if (!entry) throw new Error('The Python file is not ready.');
    return {step:this.currentStep,request:this._latestStepLoadRequestId,file:file,source:entry.model.getValue(),
      models:Object.keys(this.editorModels).map(function (path) {
        var model = this.editorModels[path].model;
        return {path:path,model:model,version:model.getVersionId()};
      },this)};
  };
  proto.isLlmSnapshotCurrent = function (snapshot) {
    return !this._destroyed && this.currentStep === snapshot.step && this._latestStepLoadRequestId === snapshot.request &&
      snapshot.models.every(function (entry) {
        return this.editorModels[entry.path] && this.editorModels[entry.path].model === entry.model && entry.model.getVersionId() === entry.version;
      },this);
  };
  proto.applyLlmProgram = function (snapshot,code) {
    if (!this.isLlmSnapshotCurrent(snapshot)) throw new Error('Your files changed. Generate again to avoid replacing newer work.');
    var model = this.editorModels[snapshot.file].model;
    model.pushStackElement();
    model.pushEditOperations([],[{range:model.getFullModelRange(),text:code}],function () { return null; });
    model.pushStackElement();
    this._setActiveFile(snapshot.file);
    this._renderTabs();
  };
  proto.runLlmChecks = async function (snapshot,exercise,signal) {
    if (this.config.backend !== 'pyodide' || !this.booted || this._activeRunTransaction || this._testRunInFlight || this._activeStepLoadRequest || this._workerRestartPromise) {
      throw new Error('Wait for Python to finish its current operation, then check again.');
    }
    if (!this.isLlmSnapshotCurrent(snapshot) || signal.aborted) return null;
    var self = this;
    var run = {backend:'pyodide',kind:'llm-check',cancelled:false};
    this._activeRunTransaction = run;
    this._llmChecksInFlight = true;
    this._setRunTransactionControls('running','Checking Python…');
    function cancel() {
      if (self._activeRunTransaction !== run) return;
      run.cancelled = true;
      self._restartWorkerBackend('Specification check cancelled.').catch(function () {});
    }
    signal.addEventListener('abort',cancel,{once:true});
    run.promise = (async function () {
      try {
        var module = await import(modules);
        await self._syncFilesToBackend(Object.keys(self.editorModels));
        if (signal.aborted || !self.isLlmSnapshotCurrent(snapshot)) return null;
        var message = await self._requestWorker({type:'runCode',code:module.checkProgram(snapshot.source,exercise),silent:true,captureOutput:true},
          {timeoutMs:15000,restartOnTimeout:true});
        if (signal.aborted || run.cancelled || !self.isLlmSnapshotCurrent(snapshot)) return null;
        if (message.exitCode !== 0) return {status:'runtime',failed:[]};
        var result = JSON.parse(message.stdout.trim());
        if (!['checked','syntax','runtime'].includes(result.status) || !Array.isArray(result.failed)) throw new Error('Invalid check result');
        return result;
      } catch (_) {
        return signal.aborted || run.cancelled || !self.isLlmSnapshotCurrent(snapshot) ? null : {status:'unavailable',failed:[]};
      } finally {
        signal.removeEventListener('abort',cancel);
        self._llmChecksInFlight = false;
        self._finalizeRunTransaction(run);
      }
    })();
    return run.promise;
  };
})();
