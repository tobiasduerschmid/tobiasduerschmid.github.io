// Test-only boundary exercise. The native image, transactions, checkpoint and VM
// primitives remain real. No primitive result or application code is substituted.
module.exports = function exerciseBoundary(mode) {
  const guard = SEBookSmalltalk.StructuralGuard;
  const begin = guard.primitives.primitiveStructuralBegin;
  const end = guard.primitives.primitiveStructuralEnd;
  let entered = false, exercised = false, notifier;
  guard.primitives.primitiveStructuralBegin = function (...args) {
    const result = begin.apply(this, args);
    notifier = this.proxy.vm.findMethod('SystemChangeNotifier>>trigger:');
    entered = true; return result;
  };
  guard.primitives.primitiveStructuralEnd = function (...args) {
    const result = end.apply(this, args); entered = false; return result;
  };
  const execute = Squeak.Interpreter.prototype.executeNewMethod;
  Squeak.Interpreter.prototype.executeNewMethod = function (...args) {
    if (entered && !exercised && args[1] === notifier && this.globalNamed('SEBookGuardA').instVarNames().includes('part')
      && !this.globalNamed('SEBookGuardB').instVarNames().includes('part')) {
      exercised = true;
      if (mode === 'freeze') this.freeze(() => {});
      if (mode === 'checkpoint') guard.assertCheckpointAllowed(this);
      if (mode === 'blocking') {
        const semaphore = this.instantiateClass(this.globalNamed('Semaphore'), 0);
        semaphore.pointers[Squeak.Semaphore_excessSignals] = 0;
        this.push(semaphore);
        this.primHandler.primitiveWait();
      }
    }
    return execute.apply(this, args);
  };
};
