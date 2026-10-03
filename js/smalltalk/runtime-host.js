(function (scope) {
  'use strict';
  var api = scope.SEBookSmalltalk;
  var byteCache = new Map();
  var decoder = new TextDecoder();
  function sameOrigin(value, base) {
    var url = new URL(value, base);
    if (url.origin !== location.origin) throw api.runtimeError('ASSET_ERROR', 'Smalltalk assets must be same-origin');
    return url;
  }
  async function fetchBytes(url, hash, signal) {
    var key = url.href + '#' + hash;
    if (signal.aborted) throw signal.reason;
    if (byteCache.has(key)) return byteCache.get(key);
    var response = await fetch(url, { credentials: 'same-origin', cache: 'no-cache', signal: signal });
    if (!response.ok || new URL(response.url).origin !== location.origin) throw api.runtimeError('ASSET_ERROR', 'Asset unavailable: ' + url.pathname);
    var bytes = await response.arrayBuffer();
    var actual = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), function (value) { return value.toString(16).padStart(2, '0'); }).join('');
    if (actual !== hash) throw api.runtimeError('ASSET_ERROR', 'SHA-256 mismatch: ' + url.pathname);
    if (signal.aborted) throw signal.reason;
    // Cache only verified completed bytes: cancellation cannot poison another loader's promise.
    byteCache.set(key, bytes);
    return bytes;
  }
  class RuntimeHost {
    #baselineId; #runtimeSHA256; #freshJobs = []; #freshActive = null; #listeners = new Set(); #checkpoints = new Map(); #onEvent; #files; #source; #roles; #disposed; #limits;
    /** Verified bytes stay private in immutable page memory. Every session receives copies. */
    static async create(options) {
      const limits = api.resolveLimits(options.limits);
      const controller = new AbortController();
      const cancel = () => controller.abort(api.runtimeError('CANCELLED', 'Smalltalk asset loading cancelled'));
      if (options.signal && options.signal.aborted) { cancel(); throw controller.signal.reason; }
      if (options.signal) options.signal.addEventListener('abort', cancel, { once: true });
      const timer = setTimeout(() => controller.abort(api.runtimeError('TIMEOUT', 'Smalltalk asset loading timed out')), limits.bootMs);
      try {
        return await RuntimeHost.#loadVerified(options, controller.signal, limits);
      } catch (error) {
        if (controller.signal.aborted) throw controller.signal.reason;
        throw error.code ? error : api.runtimeError('ASSET_ERROR', 'Smalltalk asset loading failed: ' + error.message);
      } finally {
        clearTimeout(timer);
        if (options.signal) options.signal.removeEventListener('abort', cancel);
      }
    }
    static async #loadVerified(options, signal, limits) {
      var url = sameOrigin(options.manifestURL, location.href);
      var response = await fetch(url, { cache: 'no-cache', credentials: 'same-origin', signal: signal });
      if (!response.ok || new URL(response.url).origin !== location.origin) throw api.runtimeError('ASSET_ERROR', 'Smalltalk manifest unavailable');
      var manifest = await response.json();
      if (manifest.version !== 1 || !Array.isArray(manifest.artifacts) || !manifest.adapters) throw api.runtimeError('ASSET_ERROR', 'Invalid Smalltalk manifest');
      var files = new Map();
      for (var asset of manifest.artifacts) {
        if (['runtime', 'image', 'sources', 'changes'].includes(asset.kind)) {
          files.set(asset.path, await fetchBytes(sameOrigin(asset.path, url), asset.sha256, signal));
        }
      }
      var scripts = [];
      for (var adapter of manifest.adapters) scripts.push(decoder.decode(await fetchBytes(sameOrigin(adapter.path, url), adapter.sha256, signal)));
      var runtime = manifest.runtimeOrder.map(function (path) { return decoder.decode(files.get(path)); }).join('\n');
      return new RuntimeHost(options.onEvent || function () {}, files, runtime + '\n' + scripts.join('\n'), limits, manifest.artifacts.find(asset => asset.kind === 'image').sha256 + ':' + manifest.squeakJS.commit, manifest.artifacts.find(asset => asset.path === 'runtime/squeak_headless_bundle.js').sha256);
    }
    constructor(onEvent, files, source, limits, baselineId, runtimeSHA256) { this.#runtimeSHA256 = runtimeSHA256; this.#baselineId = baselineId; this.#limits = limits; this.#onEvent = onEvent; this.#files = files; this.#source = source; this.#roles = new Map(); this.#disposed = false; }
    /** @param {'live'|'fresh'} role @returns {Promise<Session>} */
    async openSession(role, { signal } = {}) { return this.#boot(role, undefined, signal); }
    async #boot(role, checkpoint, signal) {
      if (signal?.aborted) throw api.runtimeError('CANCELLED', 'Smalltalk session cancelled');
      if (!['live', 'fresh'].includes(role) || this.#disposed) throw api.runtimeError('PRECONDITION_FAILED', 'Unavailable Smalltalk session role');
      this.stop(role);
      var session = { sessionId: crypto.randomUUID(), role: role, revision: checkpoint ? checkpoint.revision : 0 };
      var worker, channel;
      try {
        worker = new Worker('data:text/javascript;charset=utf-8,' + encodeURIComponent('self.Squeak = {Settings:{}}; self.window = self;\n' + this.#source));
        channel = new MessageChannel();
      } catch (error) {
        if (worker) worker.terminate();
        throw api.runtimeError('RECOVERED_FAILURE', 'Smalltalk transport creation failed: ' + error.message);
      }
      var entry = { session: session, worker: worker, port: channel.port1, pending: new Map(), boot: null, checkpoint };
      this.#roles.set(role, entry);
      const cancel = () => this._fail(entry, api.runtimeError('CANCELLED', 'Smalltalk session cancelled'));
      entry.cancelCleanup = () => signal?.removeEventListener('abort', cancel);
      signal?.addEventListener('abort', cancel, { once: true });
      var ready = new Promise((resolve, reject) => {
        var timer = setTimeout(() => this._fail(entry, api.runtimeError('TIMEOUT', 'Smalltalk image boot timed out')), this.#limits.bootMs);
        entry.boot = { resolve: resolve, reject: reject, timer: timer };
      });
      entry.port.onmessage = event => this._receive(entry, event.data);
      worker.onerror = event => this._fail(entry, api.runtimeError('RECOVERED_FAILURE', event.message || 'Smalltalk worker failed'));
      try {
        var transferredFiles = [];
        for (var file of this.#files) if (!file[0].startsWith('runtime/')) transferredFiles.push({ path: file[0], bytes: file[1].slice(0) });
        worker.postMessage({ version: 1, sessionId: session.sessionId, port: channel.port2, files: transferredFiles, limits: this.#limits, baselineId: this.#baselineId, runtimeSHA256: this.#runtimeSHA256, checkpoint }, [channel.port2].concat(transferredFiles.map(function (file) { return file.bytes; })));
      } catch (error) {
        channel.port2.close();
        this._fail(entry, api.runtimeError('RECOVERED_FAILURE', 'Smalltalk bootstrap dispatch failed: ' + error.message));
      }
      await ready;
      if (this.#roles.get(role) !== entry) throw api.runtimeError('CANCELLED', 'Smalltalk session replaced');
      return session;
    }
    _receive(entry, message) {
      if (this.#roles.get(entry.session.role) !== entry || message.sessionId !== entry.session.sessionId) return;
      if (message.checkpoint) {
        const bundle = message.checkpoint;
        const pending = entry.pending.get(bundle.requestId);
        if (!pending || bundle.revision !== entry.session.revision || bundle.baselineId !== this.#baselineId) return;
        this.#checkpoints.set(bundle.nonce, { bundle, role: entry.session.role });
        entry.port.postMessage({ checkpointRetained: bundle.nonce }); return;
      }
      if (message.ready && entry.boot) {
        if (entry.checkpoint && (message.checkpointNonce !== entry.checkpoint.nonce || message.revision !== entry.checkpoint.revision)) {
          this._fail(entry, api.runtimeError('RECOVERED_FAILURE', 'Checkpoint continuation mismatch')); return;
        }
        clearTimeout(entry.boot.timer); entry.boot.resolve(); entry.boot = null; return;
      }
      if (message.error && !message.requestId) { this._fail(entry, api.runtimeError(message.error.code, message.error.message)); return; }
      if (message.type) { if (message.type === 'codeChanged') entry.session.revision = message.revision; this.#emit(message); return; }
      var pending = entry.pending.get(message.requestId);
      if (!pending || message.version !== 1 || !Number.isSafeInteger(message.revision) || message.revision < 0) return;
      pending.cleanup(); entry.session.revision = message.revision;
      if (message.error) { const error = api.runtimeError(message.error.code, message.error.message); if (message.error.location) error.location = message.error.location; pending.reject(error); }
      else pending.resolve(message.result);
    }
    /** @param {Session} session @param {string} operation @param {object} payload @param {RequestOptions} options */
    request(session, operation, payload, options = {}) {
      var entry = this.#roles.get(session.role);
      if (!entry || entry.session !== session) return Promise.reject(api.runtimeError(operation === 'inspect' ? 'STALE_HANDLE' : 'PRECONDITION_FAILED', 'Session is no longer active'));
      if (options.signal && options.signal.aborted) return Promise.reject(api.runtimeError('CANCELLED', 'Smalltalk request cancelled'));
      var envelope;
      try { envelope = api.validateRequest({ version: 1, sessionId: session.sessionId, requestId: crypto.randomUUID(), expectedRevision: options.expectedRevision === undefined ? session.revision : options.expectedRevision, operation: operation, payload: payload }); }
      catch (error) { return Promise.reject(api.runtimeError('PRECONDITION_FAILED', error.message)); }
      // Definition loading and source-baseline capture initialize the image, before Run/check.
      const deadline = operation === 'loadProgram' ? this.#limits.bootMs
        : (options.purpose === 'run' || options.purpose === 'check') ? this.#limits.runMs : this.#limits.operationMs;
      return new Promise((resolve, reject) => {
        var abort = () => this._fail(entry, api.runtimeError('CANCELLED', 'Smalltalk request cancelled'));
        var timer = setTimeout(() => { const error = api.runtimeError('TIMEOUT', 'Smalltalk request timed out'); if (['barrier', 'commitMutation', 'mutationStatus'].includes(operation)) { cleanup(); reject(error); } else this._fail(entry, error); }, deadline);
        var cleanup = () => { clearTimeout(timer); entry.pending.delete(envelope.requestId); if (options.signal) options.signal.removeEventListener('abort', abort); };
        entry.pending.set(envelope.requestId, { resolve: resolve, reject: reject, cleanup: cleanup });
        try {
          if (options.signal) options.signal.addEventListener('abort', abort, { once: true });
          entry.port.postMessage(envelope);
        } catch (error) {
          cleanup();
          reject(api.runtimeError('RECOVERED_FAILURE', 'Smalltalk request dispatch failed: ' + error.message));
        }
      });
    }
    /** Exclusive fresh-image lease. Cancelling one job never terminates another owner's worker. */
    withFreshSession(operation, { signal } = {}) {
      if (this.#disposed || (signal && signal.aborted)) return Promise.reject(api.runtimeError('CANCELLED', 'Fresh image job cancelled'));
      return new Promise((resolve, reject) => {
        const job = { operation, signal, resolve, reject, entry: null };
        job.cancel = () => {
          const error = api.runtimeError('CANCELLED', 'Fresh image job cancelled');
          const index = this.#freshJobs.indexOf(job);
          if (index >= 0) { this.#freshJobs.splice(index, 1); job.cleanup(); reject(error); }
          else if (this.#freshActive === job) {
            if (job.entry) this._fail(job.entry, error);
            job.rejectCancellation(error);
          }
        };
        job.cleanup = () => { if (signal) signal.removeEventListener('abort', job.cancel); };
        if (signal) signal.addEventListener('abort', job.cancel, { once: true });
        this.#freshJobs.push(job); this.#drainFresh();
      });
    }
    async #drainFresh() {
      if (this.#freshActive || !this.#freshJobs.length) return;
      const job = this.#freshJobs.shift(); this.#freshActive = job;
      const cancellation = new Promise((resolve, reject) => { job.rejectCancellation = reject; });
      try {
        const opening = this.openSession('fresh'); job.entry = this.#roles.get('fresh');
        const session = await Promise.race([opening, cancellation]);
        const result = await Promise.race([Promise.resolve().then(() => job.operation(session)), cancellation]);
        job.resolve(result);
      } catch (error) { job.reject(error); }
      finally {
        if (job.entry && this.#roles.get('fresh') === job.entry) this._fail(job.entry, api.runtimeError('CANCELLED', 'Fresh image lease ended'));
        job.cleanup(); this.#freshActive = null; this.#drainFresh();
      }
    }
    subscribe(listener) { this.#listeners.add(listener); return () => this.#listeners.delete(listener); }
    #emit(event) {
      for (const listener of [this.#onEvent, ...this.#listeners]) {
        try { listener(event); } catch (error) { console.error('Smalltalk runtime observer failed', error); }
      }
    }
    /** Host-private reusable full snapshot; callers receive only an opaque token. */
    async checkpoint(session) {
      const nonce = crypto.randomUUID();
      try { await this.request(session, 'checkpoint', { nonce }); }
      catch (error) { this.releaseCheckpoint(nonce); throw error; }
      if (!this.#checkpoints.has(nonce)) throw api.runtimeError('RECOVERED_FAILURE', 'Checkpoint was not retained');
      return nonce;
    }
    async restoreCheckpoint(session, token, { signal } = {}) {
      const current = this.#roles.get(session.role);
      if (current && current.session !== session) throw api.runtimeError('CANCELLED', 'Checkpoint owner was replaced');
      const saved = this.#checkpoints.get(token);
      if (!saved || saved.role !== session.role) throw api.runtimeError('PRECONDITION_FAILED', 'Unknown checkpoint');
      const restored = await this.#boot(session.role, structuredClone(saved.bundle), signal);
      if (signal?.aborted || this.#roles.get(session.role)?.session !== restored) throw api.runtimeError('CANCELLED', 'Checkpoint owner was replaced');
      this.#emit({ sessionId: restored.sessionId, requestId: null, revision: restored.revision, type: 'recovered', payload: { stateRewound: true } });
      return restored;
    }
    releaseCheckpoint(token) { this.#checkpoints.delete(token); }
    /** Load ordered definitions/overlays only; Run/check explicitly evaluate afterwards. */
    async loadProgram(session, program, { captureChanges = session.role === 'live' } = {}) { await this.request(session, 'loadProgram', { program, captureChanges }); }
    _fail(entry, error) {
      if (this.#roles.get(entry.session.role) !== entry) return;
      entry.cancelCleanup();
      this.#roles.delete(entry.session.role); entry.worker.onerror = null; entry.port.onmessage = null; entry.worker.terminate(); entry.port.close();
      if (entry.boot) { clearTimeout(entry.boot.timer); entry.boot.reject(error); entry.boot = null; }
      for (var pending of Array.from(entry.pending.values())) { pending.cleanup(); pending.reject(error); }
      if (error.code !== 'CANCELLED') this.#emit({ sessionId: entry.session.sessionId, requestId: null, revision: entry.session.revision, type: 'failed', payload: { code: error.code, message: error.message } });
    }
    /** Stop terminates the exact role's worker and settles all its pending operations. */
    stopSession(session) { const entry = session && this.#roles.get(session.role); if (entry && entry.session === session) this._fail(entry, api.runtimeError('CANCELLED', 'Smalltalk session stopped')); }
    stop(role) { var entry = this.#roles.get(role); if (entry) this._fail(entry, api.runtimeError('CANCELLED', 'Smalltalk session stopped')); }
    dispose() { if (this.#disposed) return; this.#disposed = true; for (const job of [...this.#freshJobs]) job.cancel(); if (this.#freshActive) this.#freshActive.cancel(); this.stop('live'); this.stop('fresh'); this.#files = null; this.#source = null; this.#checkpoints.clear(); }
  }
  api.RuntimeHost = RuntimeHost;
})(window);
