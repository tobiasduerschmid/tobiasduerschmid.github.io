(function (scope) {
  'use strict';
  const api = scope.SEBookSmalltalk;
  const reviewedVM = 'f43e45552ca95c9afd11142f28caa5dc2d37e65cb589673a85c1f3c2148ae2fb';
  const states = new WeakMap();
  const explanations = {
    RETAINED_ACTIVATION: 'A retained context or closure refers to an affected object. Release those references or stop the affected process before changing its layout.',
    CUSTOM_LAYOUT: 'This class uses a variable-sized or non-pointer layout that this operation cannot safely reshape.',
    UNKNOWN_REPRESENTATION: 'This image has an unsupported context or closure layout. Restore the standard representation before retrying.',
    ENUMERATION_FAILED: 'The image could not inspect all retained activations. The layout change was cancelled.',
    HIERARCHY_LIMIT: 'The affected class or activation hierarchy exceeds the supported inspection limit.',
    SCAN_LIMIT: 'Too many retained contexts or closures need inspection. Release unused references before retrying.',
    NOTIFICATION_LIMIT: 'The change produced too many deferred image notifications. Apply a smaller change.',
    UNSUPPORTED_DEFINITION: 'Use a standard class definition with literal names and fields; this definition contains an unsupported expression.',
    UNSUPPORTED_CODE: 'This mutation would invoke custom code compiled after startup. Remove the custom compilation or layout hook before retrying.',
    CHANGED_CODE: 'A native method needed by this mutation has been modified. Restore that method before retrying.',
    CHANGED_LITERAL: 'A literal in native code needed by this mutation has been modified. Restore that literal before retrying.',
    BLOCKED_TRANSFER: 'This native change would suspend its process before completion. It cannot be applied as one isolated change.',
    EXTERNAL_PRIMITIVE: 'This native change requires an external operation before completion. It cannot be applied as one isolated change.',
    NATIVE_FAILURE: 'The native change failed before completion.'
  };
  const fail = reason => {
    const code = reason.replace(/^NATIVE_FAILURE: STRUCTURAL_/, '').split(':')[0];
    const explanation = explanations[code] || 'The mutation exclusion check failed. The operation was stopped.';
    throw api.runtimeError('RECOVERED_FAILURE', explanation + ' (STRUCTURAL_' + reason + ')');
  };
  const state = vm => states.get(vm);
  const active = vm => state(vm)?.owner;
  function equalBytes(left, right) {
    if (!left || !right || left.length !== right.length) return left === right;
    for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) return false;
    return true;
  }
  function checkCode(vm, method) {
    const guard = state(vm);
    if (!guard?.owner) return;
    if (vm.primHandler.activeProcess() !== guard.owner) fail('OWNER_CHANGED');
    const record = guard.methods.get(method), copy = record?.copy;
    if (!copy) fail('UNSUPPORTED_CODE: ' + vm.printMethod(method));
    if (method.sqClass !== copy.sqClass || !equalBytes(method.bytes, copy.bytes) || !equalBytes(method.pointers, copy.pointers)) fail('CHANGED_CODE: ' + vm.printMethod(method));
    for (const pair of record.literals) {
      const [literal, saved] = pair.pointers;
      if (literal.sqClass !== saved.sqClass || literal.isFloat !== saved.isFloat || !Object.is(literal.float, saved.float)
        || !equalBytes(literal.pointers, saved.pointers) || !equalBytes(literal.bytes, saved.bytes) || !equalBytes(literal.words, saved.words)) fail('CHANGED_LITERAL: ' + vm.printMethod(method));
    }
  }
  function checkContext(vm, context) {
    if (!active(vm)) return;
    let method = context.pointers[Squeak.Context_method];
    if (typeof method === 'number') method = context.pointers[Squeak.BlockContext_home].pointers[Squeak.Context_method];
    checkCode(vm, method);
  }
  let installed = false;
  function install() {
    if (installed) return;
    installed = true;
    // All hooks delegate byte-for-byte ordinary behavior while exclusion is inactive.
    const primitive = Squeak.Primitives.prototype.doPrimitive;
    Squeak.Primitives.prototype.doPrimitive = function (index, count, method) {
      if (active(this.vm) && index === 167) return true;
      if (active(this.vm) && index === 576) fail('OBJECT_AS_METHOD');
      return primitive.call(this, index, count, method);
    };
    const resume = Squeak.Primitives.prototype.resume;
    Squeak.Primitives.prototype.resume = function (process) {
      if (active(this.vm)) return this.putToSleep(process);
      return resume.call(this, process);
    };
    const transfer = Squeak.Primitives.prototype.transferTo;
    Squeak.Primitives.prototype.transferTo = function (process) {
      if (active(this.vm) && process !== active(this.vm)) fail('BLOCKED_TRANSFER');
      return transfer.call(this, process);
    };
    const freeze = Squeak.Interpreter.prototype.freeze;
    Squeak.Interpreter.prototype.freeze = function (continuation) {
      if (active(this)) fail('EXTERNAL_PRIMITIVE');
      return freeze.call(this, continuation);
    };
    const execute = Squeak.Interpreter.prototype.executeNewMethod;
    Squeak.Interpreter.prototype.executeNewMethod = function (receiver, method, ...args) {
      checkCode(this, method); // Before quick/return primitives, not just context creation.
      return execute.call(this, receiver, method, ...args);
    };
    for (const name of ['activateNewClosureMethod', 'activateNewFullClosure']) {
      const original = Squeak.Primitives.prototype[name];
      Squeak.Primitives.prototype[name] = function (closure, count) {
        const method = name === 'activateNewFullClosure' ? closure.pointers[Squeak.ClosureFull_method]
          : closure.pointers[Squeak.Closure_outerContext].pointers[Squeak.Context_method];
        checkCode(this.vm, method);
        return original.call(this, closure, count);
      };
    }
    // fetchContextRegisters is shared by explicit context activation AND the inlined
    // doReturn path; no bytecode executes in the destination before this check.
    const fetchContext = Squeak.Interpreter.prototype.fetchContextRegisters;
    Squeak.Interpreter.prototype.fetchContextRegisters = function (context) {
      checkContext(this, context);
      return fetchContext.call(this, context);
    };
    for (const name of ['primitiveBlockValue', 'primitiveBlockValueWithArgs']) {
      const original = Squeak.Primitives.prototype[name];
      Squeak.Primitives.prototype[name] = function (count) {
        if (active(this.vm)) {
          const block = this.vm.stackValue(name === 'primitiveBlockValueWithArgs' ? 1 : count);
          if (this.isA(block, Squeak.splOb_ClassBlockContext)) checkContext(this.vm, block);
        }
        return original.call(this, count);
      };
    }
  }
  function rootMethods(vm) {
    const root = vm.globalNamed('SEBookStructuralTrustedCode');
    if (!root?.pointers) fail('MISSING_BOOTSTRAP_ROOT');
    return new Map(root.pointers.map(record => [record.pointers[0], { copy: record.pointers[1], literals: record.pointers[2].pointers || [] }]));
  }
  api.StructuralGuard = {
    attach(vm, { runtimeSHA256, mutationIdentity, restored }) {
      if (runtimeSHA256 !== reviewedVM) throw api.runtimeError('ASSET_ERROR', 'Structural guard requires the reviewed SqueakJS bundle');
      install();
      states.set(vm, { owner: null, identity: null, mutationIdentity, methods: restored ? rootMethods(vm) : null, sealed: !!restored });
    },
    assertCheckpointAllowed(vm) { if (active(vm)) fail('CHECKPOINT_DURING_MUTATION'); },
    primitives: {
      primitiveStructuralSeal(count) {
        const vm = this.proxy.vm, guard = state(vm);
        if (count !== 0 || !guard || guard.sealed || guard.owner || guard.mutationIdentity()) fail('ALREADY_SEALED');
        guard.methods = rootMethods(vm); guard.sealed = true; return true;
      },
      primitiveStructuralBegin(count) {
        const vm = this.proxy.vm, guard = state(vm), identity = this.proxy.stackValue(0).bytesAsString();
        if (count !== 1 || !guard || !guard.sealed || guard.owner || vm.frozen || !identity || identity !== guard.mutationIdentity()) fail('MUTATION_IDENTITY');
        guard.identity = identity; guard.owner = vm.primHandler.activeProcess();
        checkCode(vm, vm.method);
        this.proxy.pop(count); return true;
      },
      primitiveStructuralEnd(count) {
        const vm = this.proxy.vm, guard = state(vm);
        if (count !== 0 || !guard?.owner || guard.owner !== vm.primHandler.activeProcess() || guard.identity !== guard.mutationIdentity()) fail('MUTATION_IDENTITY');
        guard.owner = null; guard.identity = null; guard.methods = rootMethods(vm);
        return true;
      },
      primitiveStructuralAbort() { fail('NATIVE_FAILURE'); },
      primitiveStructuralAbortReason(count) {
        const vm = this.proxy.vm;
        if (count !== 1 || !active(vm)) fail('MUTATION_IDENTITY');
        fail('NATIVE_FAILURE: ' + this.proxy.stackValue(0).bytesAsString().slice(0, 2048));
      },
      primitiveStructuralActive(count) {
        const vm = this.proxy.vm;
        vm.popNandPush(count + 1, active(vm) ? vm.trueObj : vm.falseObj); return true;
      },
      primitiveStructuralAdmitDefinition(count) {
        const vm = this.proxy.vm, guard = state(vm), record = this.proxy.stackValue(0);
        if (count !== 1 || !guard?.owner || guard.identity !== guard.mutationIdentity()) fail('DEFINITION_OUTSIDE_MUTATION');
        checkCode(vm, vm.method);
        const [method, copy, literals] = record?.pointers || [];
        if (!method?.isMethod() || !copy?.isMethod() || !literals) fail('INVALID_DEFINITION_METHOD');
        guard.methods.set(method, { copy, literals: literals.pointers || [] });
        this.proxy.pop(count); return true;
      }
    }
  };
})(self);
