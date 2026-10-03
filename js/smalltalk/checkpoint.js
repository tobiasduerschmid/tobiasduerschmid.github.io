(function (scope) {
  'use strict';
  const api = scope.SEBookSmalltalk;
  const schedulingFields = ['nextWakeupTick', 'lastTick', 'pendingFinalizationSignals', 'signalLowSpace', 'interruptPending', 'lowSpaceThreshold', 'interruptKeycode'];
  /** Compatibility adapter for pinned SqueakJS. Never persists or exposes image bytes to Program. */
  api.Checkpoint = {
    capture(vm, filesystem, identity) {
      if (vm.frozen) throw api.runtimeError('PRECONDITION_FAILED', 'Cannot checkpoint an outstanding external primitive');
      const handles = filesystem.prepareHandleRoots(vm, identity.nonce);
      vm.popNandPush(1, vm.trueObj);
      try {
        vm.storeContextRegisters();
        const process = vm.primHandler.activeProcess();
        process.pointers[Squeak.Proc_suspendedContext] = vm.activeContext; process.dirty = true;
        vm.image.fullGC('SEBook checkpoint');
        const image = vm.image.writeToBuffer();
        const scheduling = Object.fromEntries(schedulingFields.map(key => [key, vm[key]]));
        scheduling.clock = vm.primHandler.millisecondClockValue();
        scheduling.semaphores = [...vm.primHandler.semaphoresToSignal];
        scheduling.consoleBuffer = structuredClone(vm.primHandler.fileConsoleBuffer);
        return { version: 1, ...identity, image, filesystem: filesystem.capture(handles), scheduling };
      } finally { vm.popNandPush(1, vm.falseObj); }
    },
    createInterpreter(image, display, checkpoint) {
      const original = Squeak.Interpreter.prototype.hackImage;
      // The constructor's cold-boot patches must never rewrite accepted checkpoint code.
      if (checkpoint) Squeak.Interpreter.prototype.hackImage = function () {};
      try { return new Squeak.Interpreter(image, display); }
      finally { Squeak.Interpreter.prototype.hackImage = original; }
    },
    restore(vm, filesystem, checkpoint) {
      const roots = vm.globalNamed('SEBookCheckpointRoots');
      if (checkpoint.version !== 1 || roots.pointers[0] !== 1 || roots.pointers[1].bytesAsString() !== checkpoint.nonce) {
        throw api.runtimeError('PRECONDITION_FAILED', 'Checkpoint identity mismatch');
      }
      filesystem.rebind(checkpoint.filesystem, roots.pointers[2].pointers);
      for (const key of schedulingFields) vm[key] = checkpoint.scheduling[key];
      vm.startupTime = Date.now() - checkpoint.scheduling.clock;
      vm.primHandler.semaphoresToSignal = [...checkpoint.scheduling.semaphores];
      vm.primHandler.fileConsoleBuffer = structuredClone(checkpoint.scheduling.consoleBuffer);
    }
  };
})(self);
