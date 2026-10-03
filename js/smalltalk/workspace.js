(function (scope) {
  'use strict';
  const api = scope.SEBookSmalltalk;
  const copy = value => structuredClone(value);
  /** Protocol is metadata, not method identity: recategorization must not lose a draft. */
  api.entityKey = target => JSON.stringify([target.kind, target.kind === 'package' ? target.packageName : '', target.className || '',
    target.side || 'instance', target.selector || '', target.kind === 'protocol' ? target.protocol : '', target.path || '']);
  class Workspace {
    #runtime; #session; #program; #drafts = new Map(); #listeners = new Set(); #tail = Promise.resolve(); #disposed = false; #lifetime = new AbortController(); #unsubscribe;
    #history = { canUndo: false, canRedo: false, reason: 'No refactoring history in this session.' };
    static async create({ runtime, program, drafts = [] }) {
      api.validateOperation('loadProgram', { program });
      const workspace = new Workspace(runtime, program);
      for (const draft of drafts) workspace.setDraft(draft);
      try { await workspace.restart(); return workspace; }
      catch (error) { workspace.dispose(); throw error; }
    }
    constructor(runtime, program) {
      this.#runtime = runtime; this.#program = copy(program);
      this.#unsubscribe = runtime.subscribe(event => {
        if (this.#disposed || !this.#session || event.sessionId !== this.#session.sessionId) return;
        if (event.type === 'codeChanged') this.#publish(event.payload.changes, event.revision, event.payload.history);
        this.#emit('runtime', event);
      });
    }
    snapshot() { return copy(this.#program); }
    getDrafts() { return copy([...this.#drafts.values()]); }
    setDraft(draft) {
      if (!draft || !draft.target || !Number.isSafeInteger(draft.baseRevision) || draft.baseRevision < 0 || typeof draft.source !== 'string') {
        throw api.runtimeError('PRECONDITION_FAILED', 'Invalid draft');
      }
      this.#drafts.set(api.entityKey(draft.target), copy(draft)); this.#emit('drafts');
    }
    revertDraft(target) { this.#drafts.delete(api.entityKey(target)); this.#emit('drafts'); }
    subscribe(listener) { this.#listeners.add(listener); return () => this.#listeners.delete(listener); }
    #emit(type, detail) {
      if (this.#disposed && (type !== 'runtime' || detail.type !== 'disposed')) return;
      for (const listener of this.#listeners) {
        try { listener({ type, program: this.snapshot(), drafts: this.getDrafts(), detail }); }
        catch (error) { console.error('Smalltalk Workspace observer failed', error); }
      }
    }
    #assertActive() {
      if (this.#disposed) throw api.runtimeError('CANCELLED', 'Workspace is disposed');
    }
    async #wait(operation) {
      const result = await operation;
      this.#assertActive();
      return result;
    }
    #request(operation, payload, options) {
      return this.#wait(this.#runtime.request(this.#session, operation, payload, options));
    }
    #enqueue(operation) {
      const result = this.#tail.then(() => {
        this.#assertActive();
        return operation();
      });
      this.#tail = result.catch(() => {}); return result;
    }
    historyState() { return copy(this.#history); }
    #setHistory(history) {
      this.#history = copy(history || { canUndo: false, canRedo: false, reason: 'No refactoring history in this session.' });
      this.#emit('history', this.historyState());
    }
    refactoringQuery(operation, payload, { sessionId } = {}) {
      if (!['refactoringCatalog', 'prepareRefactoring', 'cancelRefactoring'].includes(operation)) throw api.runtimeError('PRECONDITION_FAILED', 'Invalid refactoring query');
      const submitted = copy(payload);
      return this.#enqueue(async () => {
        const session = this.#session;
        if (operation === 'cancelRefactoring' && sessionId && sessionId !== session.sessionId) return;
        const result = await this.#request(operation, submitted);
        return operation === 'prepareRefactoring' ? { ...result, sessionId: session.sessionId } : result;
      });
    }
    #publish(changes, revision, history) {
      this.#assertActive();
      if (revision <= this.#program.revision) return;
      this.#program = { ...this.#program, revision, changes: copy(changes) };
      this.#setHistory(history); this.#emit('program');
    }
    commit(mutation) {
      const submitted = copy(mutation);
      const draftKey = submitted.params.target && api.entityKey(submitted.params.target);
      const submittedDraft = this.#drafts.get(draftKey);
      return this.#enqueue(() => this.#commit(submitted, draftKey, submittedDraft));
    }
    async #commit({ baseRevision, action, params }, draftKey, submittedDraft) {
      if (baseRevision !== this.#program.revision) throw api.runtimeError('STALE_REVISION', 'Accepted source changed; keep or update this draft');
      if (action === 'replaceProgram') return this.#replaceProgram(params.program);
      const id = crypto.randomUUID();
      const digest = Array.from(new Uint8Array(await this.#wait(crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ baseRevision, action, params }))))), byte => byte.toString(16).padStart(2, '0')).join('');
      const identity = { id, digest };
      await this.#request('prepareMutation', { ...identity, action, params }, { expectedRevision: baseRevision });
      let checkpoint;
      try { checkpoint = await this.#runtime.checkpoint(this.#session); }
      catch (error) {
        this.#assertActive();
        await this.#request('abortMutation', identity).catch(() => {});
        throw error;
      }
      try {
        this.#assertActive();
        let status;
        try { status = await this.#request('commitMutation', identity); }
        catch (error) {
          if (error.code !== 'TIMEOUT') throw error;
          status = await this.#request('mutationStatus', identity);
          if (!['committed', 'acknowledged', ...(action === 'acceptFile' ? ['staged'] : [])].includes(status.state)) throw error;
        }
        let candidate;
        if (action === 'acceptFile') {
          candidate = { ...this.#program, files: this.#program.files.map(file => file.path === params.file.path ? params.file : file), changes: { version: 1, source: '', entries: [] } };
          if (!candidate.files.some(file => file.path === params.file.path)) candidate.files.push(params.file);
          const baseline = await this.#wait(this.#runtime.withFreshSession(async session => {
            await this.#runtime.loadProgram(session, candidate, { captureChanges: true });
            return this.#runtime.request(session, 'exportSourceState', {});
          }, { signal: this.#lifetime.signal }));
          try { status = await this.#request('commitMutation', { ...identity, baseline }); }
          catch (error) {
            if (error.code !== 'TIMEOUT') throw error;
            status = await this.#request('mutationStatus', identity);
            if (!['committed', 'acknowledged'].includes(status.state)) throw error;
          }
        }
        try { await this.#request('commitMutation', { ...identity, acknowledge: true }); }
        catch (error) {
          if (error.code !== 'TIMEOUT') throw error;
          const acknowledged = await this.#request('mutationStatus', identity);
          if (acknowledged.state !== 'acknowledged') await this.#request('commitMutation', { ...identity, acknowledge: true });
        }
        if (candidate) this.#program = { ...this.#program, files: copy(candidate.files) };
        this.#publish(status.result.changes, status.result.revision, status.result.history);
        if (submittedDraft && this.#drafts.get(draftKey) === submittedDraft) this.revertDraft(params.target);
        return this.snapshot();
      } catch (error) {
        this.#assertActive();
        this.#session = await this.#wait(this.#runtime.restoreCheckpoint(this.#session, checkpoint, { signal: this.#lifetime.signal }));
        await this.#request('abortMutation', identity);
        this.#setHistory(await this.#request('refactoringHistory', {}));
        this.#emit('runtime', { type: 'recovered', stateRewound: true });
        throw error;
      } finally { this.#runtime.releaseCheckpoint(checkpoint); }
    }
    evaluate(source, { signal, purpose } = {}) {
      return this.#enqueue(async () => {
        const session = this.#session;
        const result = await this.#request('evaluate', { source, bindings: 'workspace' }, { signal, purpose });
        if (result.codeChanges) this.#publish(result.codeChanges, this.#session.revision, result.history);
        else if (result.history) this.#setHistory(result.history);
        return { ...result, sessionId: session.sessionId };
      });
    }
    replaceProgram(program) { return this.commit({ baseRevision: this.#program.revision, action: 'replaceProgram', params: { program } }); }
    async #replaceProgram(program) {
      api.validateOperation('loadProgram', { program });
      const candidate = { ...copy(program), revision: this.#program.revision + 1 };
      const previousSession = this.#session;
      const checkpoint = await this.#runtime.checkpoint(previousSession);
      try {
        this.#assertActive();
        this.#session = await this.#wait(this.#runtime.openSession('live', { signal: this.#lifetime.signal }));
        await this.#wait(this.#runtime.loadProgram(this.#session, candidate));
        this.#program = candidate;
        this.#setHistory(); this.#emit('program');
        this.#emit('runtime', { type: 'recovered', stateRewound: true });
        return this.snapshot();
      } catch (error) {
        this.#assertActive();
        this.#session = await this.#wait(this.#runtime.restoreCheckpoint(this.#session, checkpoint, { signal: this.#lifetime.signal }));
        this.#emit('runtime', { type: 'recovered', stateRewound: true });
        throw error;
      } finally { this.#runtime.releaseCheckpoint(checkpoint); }
    }
    releaseHandles(handles, { sessionId } = {}) {
      return this.#enqueue(() => sessionId && sessionId !== this.#session.sessionId
        ? { released: 0 } : this.#runtime.request(this.#session, 'releaseHandles', { handles }));
    }
    browse(query) { return this.#enqueue(() => this.#runtime.request(this.#session, 'browse', query)); }
    inspect(handle, offset, limit) {
      return this.#enqueue(async () => {
        const session = this.#session;
        const result = await this.#runtime.request(session, 'inspect', { handle, offset, limit });
        return { ...result, sessionId: session.sessionId };
      });
    }
    restart() {
      return this.#enqueue(async () => {
        this.#assertActive();
        this.#session = await this.#wait(this.#runtime.openSession('live', { signal: this.#lifetime.signal }));
        await this.#wait(this.#runtime.loadProgram(this.#session, this.#program));
        this.#setHistory();
        this.#emit('runtime', { type: 'recovered', stateRewound: true });
      });
    }
    dispose() {
      if (this.#disposed) return;
      this.#disposed = true;
      this.#emit('runtime', { type: 'disposed' });
      this.#lifetime.abort();
      this.#runtime.stopSession(this.#session);
      this.#unsubscribe(); this.#listeners.clear();
    }
  }
  api.Workspace = Workspace;
})(window);
