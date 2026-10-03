/** Actual VM state setup for otherwise unreachable clock/signal boundaries.
 * Appended only by tests, after verified production Worker sources. No VM or result substitution.
 */
function installCheckpointFixture() {
  const OriginalWorker = window.Worker;
  function installNativeFixture() {
    let pendingIndex = null, restoredLiteral = null, moveClockOnCapture = false;
    Squeak.registerExternalModule('SEBookCheckpointFixture', {
      setInterpreter(proxy) { this.proxy = proxy; return true; },
      primitiveFatalError() { throw new Error('fixture failure '.repeat(500)); },
      primitiveClockNearWrap(count) {
        moveClockOnCapture = true;
        this.proxy.pop(count); return true;
      },
      primitiveRestoredLiteral(count) {
        this.proxy.vm.popNandPush(count + 1, restoredLiteral); return true;
      },
      primitiveSignalAtCheckpoint(count) {
        pendingIndex = this.proxy.stackValue(0);
        this.proxy.pop(count); return true;
      },
    });
    const capture = self.SEBookSmalltalk.Checkpoint.capture;
    self.SEBookSmalltalk.Checkpoint.capture = function (vm, filesystem, identity) {
      if (moveClockOnCapture) {
        // Move the clock coordinate system consistently; do not invalidate pending timers.
        const clock = Squeak.MillisecondClockMask - 5000;
        const shift = clock - vm.primHandler.millisecondClockValue();
        for (const key of ['lastTick', 'nextPollTick', 'breakOutTick']) vm[key] += shift;
        if (vm.nextWakeupTick) vm.nextWakeupTick += shift;
        vm.startupTime = Date.now() - clock;
        moveClockOnCapture = false;
      }
      if (pendingIndex !== null) {
        vm.primHandler.signalSemaphoreWithIndex(pendingIndex);
        pendingIndex = null;
      }
      // Word size must remain valid while the VM runs; change only the snapshot cut.
      const patchFixture = vm.globalNamed('SEBookPatchFixtureValue');
      const literal = patchFixture === 4 ? vm.findMethod('SmalltalkImage>>wordSize').pointers[1] : null;
      if (literal) { literal.pointers[1] = 8; literal.dirty = true; }
      try { return capture(vm, filesystem, identity); }
      finally { if (literal) literal.pointers[1] = 4; }
    };
    const restore = self.SEBookSmalltalk.Checkpoint.restore;
    self.SEBookSmalltalk.Checkpoint.restore = function (vm, filesystem, checkpoint) {
      restore(vm, filesystem, checkpoint);
      if (vm.globalNamed('SEBookPatchFixtureValue') !== undefined) {
        const literal = vm.findMethod('SmalltalkImage>>wordSize').pointers[1];
        restoredLiteral = literal.pointers[1];
        literal.pointers[1] = 4; literal.dirty = true;
      }
    };
  }
  window.Worker = function (url, options) {
    const prefix = 'data:text/javascript;charset=utf-8,';
    if (String(url).startsWith(prefix)) url += encodeURIComponent('\n(' + installNativeFixture.toString() + ')();');
    return new OriginalWorker(url, options);
  };
}
module.exports = { installCheckpointFixture };
