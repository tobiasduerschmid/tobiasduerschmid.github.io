(function (scope) {
  'use strict';
  var api = scope.SEBookSmalltalk = scope.SEBookSmalltalk || {};
  // Deferred until native mutation isolation and its latency gates are complete.
  api.FEATURES = Object.freeze({ refactorings: false });
  /** @typedef {{sessionId:string, role:'live'|'fresh', revision:number}} Session */
  /** @typedef {{code:string, message:string, location?:{path?:string,start:number,end:number}}} RuntimeError */
  /** @typedef {{sessionId:string,requestId:string|null,revision:number,type:'output'|'codeChanged'|'recovered'|'failed',payload:object}} RuntimeEvent */
  /** @typedef {{version:1,sessionId:string,requestId:string,expectedRevision:number,operation:string,payload:object}} Request */
  /** @typedef {{signal?:AbortSignal,expectedRevision?:number,purpose?:'run'|'check'}} RequestOptions */
  /** @typedef {{className:string,text:string,handle?:string,booleanValue?:boolean}} ValueSummary */
  /** @typedef {{value:ValueSummary|null,error:RuntimeError|null,codeChanges:object|null}} EvaluationResult */
  /** @typedef {{className:string,slots:Array<{name:string,value:ValueSummary}>,nextOffset:number|null}} Inspection */
  api.DEFAULT_LIMITS = Object.freeze({ bootMs: 120000, operationMs: 30000, runMs: 60000, outputBytes: 1048576, pageSize: 100, previewCharacters: 256 });
  api.resolveLimits = function (overrides = {}) {
    const result = { ...api.DEFAULT_LIMITS, ...overrides };
    for (const key of Object.keys(result)) if (!(key in api.DEFAULT_LIMITS) || !Number.isSafeInteger(result[key]) || result[key] < 1) throw api.runtimeError('PRECONDITION_FAILED', 'Invalid Smalltalk limit: ' + key);
    return Object.freeze(result);
  };
  api.validateOperation = function (operation, payload) {
    const reject = () => { throw api.runtimeError('PRECONDITION_FAILED', 'Invalid ' + operation + ' payload'); };
    if (['checkpoint'].includes(operation) && (typeof payload.nonce !== 'string' || !payload.nonce)) reject();
    if (['prepareMutation', 'commitMutation', 'abortMutation', 'mutationStatus'].includes(operation) &&
        (typeof payload.id !== 'string' || !payload.id || typeof payload.digest !== 'string' || !/^[a-f0-9]{64}$/.test(payload.digest))) reject();
    if (operation === 'prepareMutation') {
      if (!['createPackage', 'acceptMethod', 'acceptClass', 'acceptComment', 'acceptFile', 'restoreVersion', 'replaceProgram', 'applyRefactoring', 'undoRefactoring', 'redoRefactoring'].includes(payload.action) || !payload.params) reject();
      const params = payload.params;
      if (payload.action === 'applyRefactoring' && (typeof params.token !== 'string' || !params.token)) reject();
      if (payload.action === 'createPackage' && (typeof params.name !== 'string' || !params.name)) reject();
      if (['acceptMethod', 'acceptClass', 'acceptComment', 'restoreVersion'].includes(payload.action) && typeof params.source !== 'string') reject();
      if (['acceptMethod', 'acceptComment', 'restoreVersion'].includes(payload.action) && (!params.target || typeof params.target.className !== 'string')) reject();
      if (payload.action === 'acceptFile') api.validateOperation('loadProgram', { program: { version: 1, revision: 0, files: [params.file], changes: { source: '' } } });
    }
    if (['refactoringCatalog', 'prepareRefactoring'].includes(operation)) {
      api.validateOperation('browse', { kind: 'source', target: payload.target, offset: 0, limit: 1 });
    }
    if (operation === 'prepareRefactoring') {
      if (typeof payload.action !== 'string' || !payload.options || Array.isArray(payload.options)) reject();
      if (payload.selection && (!Number.isSafeInteger(payload.selection.start) || payload.selection.start < 0 ||
          !Number.isSafeInteger(payload.selection.end) || payload.selection.end <= payload.selection.start)) reject();
    }
    if (operation === 'cancelRefactoring' && (typeof payload.token !== 'string' || !payload.token)) reject();
    if (operation === 'evaluate' && (typeof payload.source !== 'string' || !['workspace', 'isolated'].includes(payload.bindings))) reject();
    if (operation === 'inspect' && typeof payload.handle !== 'string') reject();
    if (['inspect', 'browse'].includes(operation) && (!Number.isSafeInteger(payload.offset) || payload.offset < 0 || !Number.isSafeInteger(payload.limit) || payload.limit < 1)) reject();
    if (operation === 'releaseHandles' && (!Array.isArray(payload.handles) || payload.handles.some(handle => typeof handle !== 'string'))) reject();
    if (operation === 'browse' && !['packages', 'classes', 'protocols', 'methods', 'source', 'senders', 'implementors', 'hierarchy', 'variables', 'variableReferences', 'versions'].includes(payload.kind)) reject();
    if (operation === 'browse') {
      const target = payload.target;
      if (payload.search !== undefined && typeof payload.search !== 'string') reject();
      if (target !== undefined) {
        if (!target || !['package', 'class', 'method', 'comment', 'protocol', 'file'].includes(target.kind)) reject();
        if (['class', 'method', 'comment', 'protocol'].includes(target.kind) && (typeof target.className !== 'string' || !target.className)) reject();
        if (target.side !== undefined && !['instance', 'class'].includes(target.side)) reject();
        for (const [kind, field] of [['package', 'packageName'], ['method', 'selector'], ['protocol', 'protocol'], ['file', 'path']]) {
          if (target.kind === kind && (typeof target[field] !== 'string' || !target[field])) reject();
        }
      }
      if (['protocols', 'hierarchy', 'variables', 'variableReferences', 'versions', 'source'].includes(payload.kind) && !target) reject();
      if (payload.kind === 'methods' && !target && (typeof payload.search !== 'string' || payload.search === '')) reject();
      if (payload.kind === 'methods' && payload.side !== undefined && !['instance', 'class'].includes(payload.side)) reject();
      if (payload.kind === 'variableReferences' && (!target || target.kind !== 'class' || !payload.variable ||
          !['instance', 'class'].includes(payload.variable.kind) || typeof payload.variable.name !== 'string' || !payload.variable.name)) reject();
      if (['senders', 'implementors'].includes(payload.kind) && !(target && typeof target.selector === 'string') && !payload.search) reject();
    }
    if (operation === 'loadProgram') {
      const program = payload.program;
      if (!program || program.version !== 1 || !Number.isSafeInteger(program.revision) || program.revision < 0 || !Array.isArray(program.files) || !program.changes || typeof program.changes.source !== 'string') reject();
      const paths = new Set();
      for (const file of program.files) {
        if (!file || typeof file.path !== 'string' || !file.path || file.path.split('/').includes('..') || paths.has(file.path) || typeof file.content !== 'string' || !['source', 'resource'].includes(file.kind) || (file.kind === 'source' && !['filein', 'doit'].includes(file.format))) reject();
        paths.add(file.path);
      }
    }
  };
  api.PROTOCOL_VERSION = 1;
  api.runtimeError = function (code, message) { var error = new Error(message); error.code = code; return error; };
  // Native transport accepts JSON data: finite scalars, dense arrays and plain objects.
  // Reject values JSON would silently drop/coerce, cycles, accessors and custom objects.
  function validateJSON(value, ancestors) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
    if (typeof value === 'number' && Number.isFinite(value)) return;
    if (typeof value !== 'object' || ancestors.has(value)) throw api.runtimeError('PRECONDITION_FAILED', 'Payload must contain only JSON data');
    var array = Array.isArray(value);
    if (!array && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw api.runtimeError('PRECONDITION_FAILED', 'Payload must contain only JSON data');
    ancestors.add(value);
    var keys = Reflect.ownKeys(value);
    if (array && keys.length !== value.length + 1) throw api.runtimeError('PRECONDITION_FAILED', 'Payload arrays must be dense JSON arrays');
    for (var key of keys) {
      if (array && key === 'length') continue;
      var descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (typeof key !== 'string' || !descriptor.enumerable || !('value' in descriptor) ||
          (array && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length))) {
        throw api.runtimeError('PRECONDITION_FAILED', 'Payload must contain only JSON data');
      }
      validateJSON(descriptor.value, ancestors);
    }
    ancestors.delete(value);
  }
  api.validateRequest = function (request) {
    if (request.version !== 1 || typeof request.sessionId !== 'string' || typeof request.requestId !== 'string' ||
        !Number.isSafeInteger(request.expectedRevision) || request.expectedRevision < 0 || typeof request.operation !== 'string' ||
        !request.payload || typeof request.payload !== 'object' || Array.isArray(request.payload)) {
      throw api.runtimeError('PRECONDITION_FAILED', 'Invalid Smalltalk request');
    }
    try {
      validateJSON(request.payload, new Set());
      api.validateOperation(request.operation, request.payload);
      return JSON.parse(JSON.stringify(request));
    } catch (error) {
      throw api.runtimeError('PRECONDITION_FAILED', 'Request must contain only JSON data');
    }
  };
})(typeof window === 'object' ? window : self);
