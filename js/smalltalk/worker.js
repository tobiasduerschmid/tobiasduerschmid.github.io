(function () {
  'use strict';
  var api = self.SEBookSmalltalk;
  var port, sessionId, baselineId, vm, checkpointRequest, resumeCheckpoint;
  var queue = [];
  var filesystem = new api.FileSystem();
  const sourceWatch = new api.SourceWatch();
  const coldSources = new Map();
  const requestEnvelopes = new Map();
  let currentEnvelope = null;
  filesystem.install(Squeak);
  var limits, currentRequest = null, operationOutput = 0, backgroundOutput = 0, failed = false, revision = 0;
  function emitOutput(text, stream) {
    const size = new TextEncoder().encode(text).length;
    if (currentRequest) operationOutput += size; else backgroundOutput += size;
    if (operationOutput > limits.outputBytes || backgroundOutput > limits.outputBytes) {
      failure(api.runtimeError('OUTPUT_LIMIT', 'Smalltalk output limit exceeded'));
      vm.breakOut();
      return;
    }
    port.postMessage({ sessionId, requestId: currentRequest, revision: revision, type: 'output', payload: { stream, text } });
  }
  Squeak.Primitives.prototype.fileConsoleWrite = function (channel, array, start, count) {
    emitOutput(new TextDecoder().decode(array.subarray(start, start + count)), channel === 'error' ? 'stderr' : 'stdout');
  };
  Squeak.Primitives.prototype.fileConsoleFlush = function () {};
  Squeak.vmPath = '/'; Squeak.platformSubtype = 'Browser'; Squeak.windowSystem = 'headless';
  Squeak.registerExternalModule('SEBookPlugin', {
    ...api.StructuralGuard.primitives,
    primitiveStructuralEnabled: function (count) {
      this.proxy.vm.popNandPush(count + 1, api.FEATURES.refactorings ? this.proxy.vm.trueObj : this.proxy.vm.falseObj); return true;
    },
    setInterpreter: function (proxy) { this.proxy = proxy; return true; },
    primitiveColdSource: function (count) {
      const position = this.proxy.stackValue(1), index = this.proxy.stackValue(2), size = this.proxy.stackValue(0);
      if (count !== 3 || !Number.isSafeInteger(position) || position < 0 || !Number.isSafeInteger(size) || size < 0 || size > 1048576) return false;
      const bytes = coldSources.get(index);
      const result = bytes && position < bytes.length ? this.proxy.vm.primHandler.makeStByteArray(bytes.subarray(position, position + size)) : this.proxy.vm.nilObj;
      this.proxy.vm.popNandPush(count + 1, result); return true;
    },
    primitiveResetSourceWatch: function (count) {
      sourceWatch.reset(this.proxy.vm, this.proxy.stackValue(0)); this.proxy.pop(count); return true;
    },
    primitiveSourceWatchChanged: function (count) {
      const vm = this.proxy.vm;
      vm.popNandPush(count + 1, sourceWatch.changed(vm) ? vm.trueObj : vm.falseObj); return true;
    },
    primitiveCaptureCheckpoint: function (count) {
      if (count !== 0 || !checkpointRequest || currentRequest) throw api.runtimeError('PRECONDITION_FAILED', 'Checkpoint requires the service barrier');
      api.StructuralGuard.assertCheckpointAllowed(this.proxy.vm);
      const bundle = api.Checkpoint.capture(this.proxy.vm, filesystem, {
        nonce: checkpointRequest.payload.nonce, baselineId, revision, requestId: checkpointRequest.requestId
      });
      this.proxy.vm.freeze(unfreeze => {
        resumeCheckpoint = unfreeze;
        port.postMessage({ sessionId, checkpoint: bundle });
      });
      return true;
    },
    primitiveConfiguration: function (count) {
      this.proxy.vm.popNandPush(count + 1, this.proxy.vm.primHandler.makeStObject(JSON.stringify({ sessionId, limits, baselineId }))); return true;
    },
    primitiveInstallFiles: function (count) {
      const program = JSON.parse(new TextDecoder().decode(this.proxy.stackValue(0).bytes));
      for (const file of program.files) filesystem.put(file.path, new TextEncoder().encode(file.content));
      filesystem.put('/.sebook-changes.st', new TextEncoder().encode(program.changes.source));
      this.proxy.pop(count); return true;
    },
    primitiveBeginRequest: function (count) {
      currentRequest = this.proxy.stackValue(0).bytesAsString(); operationOutput = 0;
      currentEnvelope = requestEnvelopes.get(currentRequest); requestEnvelopes.delete(currentRequest);
      this.proxy.pop(count); return true;
    },
    primitiveOutput: function (count) {
      emitOutput(new TextDecoder().decode(this.proxy.stackValue(0).bytes), 'stdout');
      this.proxy.pop(count); return true;
    },
    primitiveNextRequest: function (count) {
      const request = queue.shift();
      if (request && request.operation === 'checkpoint') checkpointRequest = request;
      else if (request) requestEnvelopes.set(request.requestId, request);
      const value = request ? this.proxy.vm.primHandler.makeStByteArray(new TextEncoder().encode(JSON.stringify(request))) : this.proxy.vm.nilObj;
      this.proxy.vm.popNandPush(count + 1, value); return true;
    },
    primitiveReply: function (count) {
      var message = JSON.parse(new TextDecoder().decode(this.proxy.stackValue(0).bytes));
      if (message.ready) { message.sessionId = sessionId; revision = message.revision || 0; }
      if (message.type === 'codeChanged') revision = message.revision;
      if (message.requestId === currentRequest) { currentRequest = null; currentEnvelope = null; revision = message.revision; }
      if (message.result && message.result.imageBuild) { message.result.squeakJS = Squeak.vmVersion.split(' ')[1]; message.result.workerOrigin = self.origin; }
      port.postMessage(message); this.proxy.pop(count); return true;
    }
  });
  function failure(error) { if (failed) return; failed = true; port.postMessage({ sessionId: sessionId, error: { code: error.code || 'RECOVERED_FAILURE', message: String(error.message || error).slice(0, 4096) } }); }
  function tick() {
    if (failed) return;
    if (vm.primHandler.display.quitFlag) { failure(api.runtimeError('RECOVERED_FAILURE', 'Smalltalk virtual machine exited')); return; }
    try { vm.interpret(20, function (delay) { setTimeout(tick, delay === 'sleep' ? 10 : delay); }); }
    catch (error) { failure(error); }
  }
  self.onmessage = function (event) {
    self.onmessage = null;
    var bootstrap = event.data;
    baselineId = bootstrap.baselineId; port = bootstrap.port; sessionId = bootstrap.sessionId; limits = api.resolveLimits(bootstrap.limits);
    try {
      var image = bootstrap.checkpoint ? bootstrap.checkpoint.image : null;
      for (var file of bootstrap.files) {
        if (file.path.endsWith('.image')) { if (!bootstrap.checkpoint) image = file.bytes; }
        else {
          if (file.path.endsWith('.sources')) coldSources.set(1, new Uint8Array(file.bytes));
          if (file.path.endsWith('.changes')) coldSources.set(2, new Uint8Array(file.bytes));
          Squeak.filePut('/' + file.path, file.bytes);
        }
      }
      port.onmessage = function (message) {
        try {
          if (message.data.checkpointRetained && checkpointRequest && message.data.checkpointRetained === checkpointRequest.payload.nonce) {
            const resume = resumeCheckpoint; resumeCheckpoint = null; checkpointRequest = null; resume(); return;
          }
          const request = api.validateRequest(message.data);
          if (request.sessionId !== sessionId) return;
          queue.push(request);
        } catch (error) { failure(error); }
      };
      var objectMemory = new Squeak.Image('/sebook');
      objectMemory.readFromBuffer(image, function () {
        vm = api.Checkpoint.createInterpreter(objectMemory, { vmOptions: ['-vm-display-null', '-nodisplay'] }, bootstrap.checkpoint);
        if (api.FEATURES.refactorings) api.StructuralGuard.attach(vm, { runtimeSHA256: bootstrap.runtimeSHA256, restored: !!bootstrap.checkpoint,
          mutationIdentity: () => currentEnvelope?.operation === 'commitMutation' ? currentEnvelope.payload.id : null });
        if (bootstrap.checkpoint) api.Checkpoint.restore(vm, filesystem, bootstrap.checkpoint);
        tick();
      });
    } catch (error) { failure(error); }
  };
})();
