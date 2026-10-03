(function (scope) {
  'use strict';
  const api = scope.SEBookSmalltalk;
  const copy = value => structuredClone(value);
  function invalid(message) { throw api.runtimeError('PRECONDITION_FAILED', message); }
  function path(value) {
    if (typeof value !== 'string' || !value || /[\\\x00-\x1f]/.test(value)) invalid('Invalid program path');
    value = value.replace(/^\/tutorial\//, '');
    if (value.startsWith('/') || value.split('/').includes('..')) invalid('Program path escapes the workspace');
    value = value.split('/').filter(part => part && part !== '.').join('/');
    if (!value) invalid('Empty program path');
    return value;
  }
  /** Single YAML-to-Program normalization owner. Native filein/doit syntax is never parsed here. */
  api.normalizeProgram = function ({ stepKey, files, runFile, runCommand }) {
    if (typeof stepKey !== 'string' || !stepKey || !Array.isArray(files)) invalid('A step key and files are required');
    const paths = new Set();
    const normalized = files.map(file => {
      const name = path(file.path);
      if (paths.has(name) || typeof file.content !== 'string') invalid('Duplicate path or invalid source: ' + name);
      paths.add(name);
      const source = file.language === 'smalltalk' || (file.language === undefined && /\.st$/i.test(name));
      const format = file.smalltalk_format === undefined ? 'filein' : file.smalltalk_format;
      if (file.smalltalk_format !== undefined && (!source || !['filein', 'doit'].includes(format))) invalid('Invalid Smalltalk format: ' + name);
      return { path: name, kind: source ? 'source' : 'resource', format: source ? format : null, content: file.content };
    });
    if (runFile) {
      const name = path(runFile);
      const index = normalized.findIndex(file => file.path === name && file.kind === 'source');
      if (index < 0) invalid('run_file must name a Smalltalk source');
      normalized.push(normalized.splice(index, 1)[0]);
    }
    if (runCommand !== undefined && runCommand !== null && typeof runCommand !== 'string') invalid('Invalid run_command');
    return { version: 1, stepKey, revision: 0, files: normalized, changes: { version: 1, source: '', entries: [] }, runCommand: runCommand || null };
  };
  /** Isolated checks own leases, never a shared host's global fresh role. */
  class FreshRunner {
    #host; #ownsHost; #controller = null; #operation = null; #disposed = false;
    static async create(options = {}) {
      const host = options.host || await api.RuntimeHost.create({ manifestURL: options.manifestURL || '/js/vendor/smalltalk/manifest.json', signal: options.signal, limits: options.limits });
      return new FreshRunner(host, !options.host);
    }
    constructor(host, ownsHost = false) { this.#host = host; this.#ownsHost = ownsHost; }
    async #check(program, command, signal) {
      return this.#host.withFreshSession(async session => {
        await this.#host.loadProgram(session, program);
        const result = await this.#host.request(session, 'evaluate', { source: command, bindings: 'isolated' }, { purpose: 'check' });
        if (result.error) throw api.runtimeError(result.error.code, result.error.message);
        return result.value;
      }, { signal });
    }
    runTests(tests, { program, signal } = {}) {
      if (this.#disposed) return Promise.reject(api.runtimeError('CANCELLED', 'Smalltalk runner disposed'));
      if (this.#operation) return Promise.reject(api.runtimeError('PRECONDITION_FAILED', 'Smalltalk checks are already running'));
      api.validateOperation('loadProgram', { program });
      const snapshot = copy(program); const checks = copy(tests);
      const controller = new AbortController(); this.#controller = controller;
      const cancel = () => controller.abort();
      if (signal) { if (signal.aborted) cancel(); else signal.addEventListener('abort', cancel, { once: true }); }
      const operation = (async () => {
        const results = [];
        for (const check of checks) {
          try { const value = await this.#check(snapshot, check.command, controller.signal); results.push({ passed: !!value && value.booleanValue === true, error: null }); }
          catch (error) { if (controller.signal.aborted) throw error; results.push({ passed: false, error: { code: error.code, message: error.message } }); }
        }
        return { program: snapshot, results };
      })();
      const settled = operation.finally(() => {
        if (signal) signal.removeEventListener('abort', cancel);
        if (this.#operation === settled) { this.#operation = null; this.#controller = null; }
      });
      this.#operation = settled;
      return settled;
    }
    stop() { if (this.#controller) this.#controller.abort(); }
    dispose() { this.#disposed = true; this.stop(); if (this.#ownsHost) this.#host.dispose(); }
  }
  api.FreshRunner = FreshRunner;
})(typeof window === 'object' ? window : self);
