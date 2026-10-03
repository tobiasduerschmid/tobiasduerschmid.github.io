(function (scope) {
  'use strict';
  const api = scope.SEBookSmalltalk;
  const copy = value => structuredClone(value);
  const closedError = () => api.runtimeError('CANCELLED', 'The workspace owner disconnected. Source drafts remain available for recovery.');

  /** Private-port Workspace mirror. It never creates a runtime or an accepted image. */
  class PopupWorkspace {
    #port; #sessionId; #program; #drafts = []; #history; #pending = new Map(); #listeners = new Set();
    #edits = new Map(); #sequence = 0; #closed = false; #ready; #resolveReady; #rejectReady;
    static async connect({ port, sessionId }) {
      const workspace = new PopupWorkspace(port, sessionId);
      await workspace.#ready;
      return workspace;
    }
    constructor(port, sessionId) {
      this.#port = port; this.#sessionId = sessionId;
      this.#ready = new Promise((resolve, reject) => { this.#resolveReady = resolve; this.#rejectReady = reject; });
      port.onmessage = event => this.#receive(event.data);
      port.onmessageerror = () => this.dispose(); port.start();
      port.postMessage({ type: 'connect', sessionId });
    }
    snapshot() { return copy(this.#program); }
    getDrafts() {
      const drafts = new Map(this.#drafts.map(draft => [api.entityKey(draft.target), draft]));
      for (const [key, edit] of this.#edits) { if (edit.draft) drafts.set(key, edit.draft); else drafts.delete(key); }
      return copy([...drafts.values()]);
    }
    historyState() { return copy(this.#history); }
    subscribe(listener) { this.#listeners.add(listener); return () => this.#listeners.delete(listener); }
    #emit(type, detail) {
      for (const listener of this.#listeners) {
        try { listener({ type, program: this.snapshot(), drafts: this.getDrafts(), detail }); }
        catch (error) { console.error('Smalltalk popup observer failed', error); }
      }
    }
    #receive(message) {
      if (this.#closed || !message || message.sessionId !== this.#sessionId) return;
      if (message.type === 'closed') { this.dispose(false); return; }
      if (message.state) {
        this.#program = message.state.program; this.#drafts = message.state.drafts; this.#history = message.state.history;
      }
      if (message.type === 'ready') { this.#resolveReady(); return; }
      if (message.type === 'event') { this.#emit(message.event.type, message.event.detail); return; }
      const pending = this.#pending.get(message.requestId);
      if (!pending) return;
      this.#pending.delete(message.requestId); pending.cleanup();
      if (message.error) pending.reject(api.runtimeError(message.error.code, message.error.message));
      else pending.resolve(message.result);
    }
    #request(operation, args, { signal, baseRevision = this.#program.revision } = {}) {
      if (this.#closed || (signal && signal.aborted)) return Promise.reject(closedError());
      const requestId = String(++this.#sequence);
      return new Promise((resolve, reject) => {
        const abort = () => this.#port.postMessage({ type: 'cancel', sessionId: this.#sessionId, requestId });
        const cleanup = () => { if (signal) signal.removeEventListener('abort', abort); };
        this.#pending.set(requestId, { resolve, reject, cleanup });
        if (signal) signal.addEventListener('abort', abort, { once: true });
        this.#port.postMessage({ type: 'request', sessionId: this.#sessionId, requestId,
          stepKey: this.#program.stepKey, baseRevision, operation, args });
      });
    }
    #edit(target, draft) {
      const key = api.entityKey(target), edit = { draft: draft && copy(draft) };
      this.#edits.set(key, edit); this.#emit('drafts');
      // MessagePort order keeps this ahead of the subsequent Accept. Optimistic
      // source overlays survive unrelated owner events until this exact edit replies.
      this.#request(draft ? 'setDraft' : 'revertDraft', [draft || target]).then(() => {
        if (this.#edits.get(key) === edit) this.#edits.delete(key);
        this.#emit('drafts');
      }, error => this.#emit('runtime', { type: 'disconnected', message: error.message }));
    }
    setDraft(draft) { this.#edit(draft.target, draft); }
    revertDraft(target) { this.#edit(target, null); }
    commit(mutation) { return this.#request('commit', [mutation], { baseRevision: mutation.baseRevision }); }
    evaluate(source, { signal, purpose } = {}) { return this.#request('evaluate', [source, { purpose }], { signal }); }
    browse(query) { return this.#request('browse', [query]); }
    inspect(handle, offset, limit) { return this.#request('inspect', [handle, offset, limit]); }
    releaseHandles(handles, options = {}) { return this.#request('releaseHandles', [handles, options]); }
    refactoringQuery(operation, payload, options = {}) { return this.#request('refactoringQuery', [operation, payload, options]); }
    run() { return this.#request('run', []); }
    restart() { return this.#request('restart', []); }
    replaceProgram(program) { return this.commit({ baseRevision: this.#program.revision, action: 'replaceProgram', params: { program } }); }
    dispose(notifyOwner = true) {
      if (this.#closed) return; this.#closed = true;
      if (notifyOwner) this.#port.postMessage({ type: 'close', sessionId: this.#sessionId });
      this.#port.close(); const error = closedError(); this.#rejectReady(error);
      for (const pending of this.#pending.values()) { pending.cleanup(); pending.reject(error); }
      this.#pending.clear();
      if (this.#program) this.#emit('runtime', { type: 'disconnected', message: error.message });
      this.#listeners.clear();
    }
  }

  /** Owns only one popup's subscriptions, requests, native handles and previews. */
  function serve({ port, sessionId, workspace, run, onClose = () => {} }) {
    const stepKey = workspace.snapshot().stepKey;
    const handles = new Map(), previews = new Map(), controllers = new Map(), receivedDrafts = new Map();
    let closed = false, ownerDisposed = false, tail = Promise.resolve();
    const state = () => ({ program: workspace.snapshot(), drafts: workspace.getDrafts(), history: workspace.historyState() });
    const post = message => { if (!closed) port.postMessage({ ...message, sessionId }); };
    const unsubscribe = workspace.subscribe(event => {
      if (event.type === 'runtime' && event.detail.type === 'disposed') { ownerDisposed = true; close(); }
      else post({ type: 'event', event, state: state() });
    });
    function cleanupError(error) {
      // A disposed owner has already destroyed its native roots.
      if (!['CANCELLED', 'STALE_HANDLE'].includes(error.code)) console.error('Smalltalk popup cleanup failed', error);
    }
    async function releaseOwned(requested) {
      const groups = new Map();
      for (const handle of requested) if (handles.has(handle)) {
        const identity = handles.get(handle);
        if (!groups.has(identity)) groups.set(identity, []);
        groups.get(identity).push(handle);
      }
      for (const [identity, group] of groups) {
        await workspace.releaseHandles(group, { sessionId: identity });
        group.forEach(handle => handles.delete(handle));
      }
    }
    async function cancelOwned(token) {
      const preview = previews.get(token); if (!preview) return;
      await workspace.refactoringQuery('cancelRefactoring', { token }, { sessionId: preview.sessionId });
      previews.delete(token);
    }
    async function capture(operation, args, result) {
      if (operation === 'evaluate' && result.value && result.value.handle) handles.set(result.value.handle, result.sessionId);
      if (operation === 'inspect') for (const slot of result.slots) if (slot.value.handle) handles.set(slot.value.handle, result.sessionId);
      if (operation === 'refactoringQuery' && args[0] === 'prepareRefactoring') previews.set(result.token, result);
      if (operation === 'commit' && args[0].action === 'applyRefactoring') previews.delete(args[0].params.token);
      if (closed) {
        await releaseOwned([...handles.keys()]).catch(cleanupError);
        await Promise.all([...previews.keys()].map(token => cancelOwned(token).catch(cleanupError)));
      }
    }
    function validateCommand(message) {
      if (message.stepKey !== stepKey || workspace.snapshot().stepKey !== stepKey) throw closedError();
      if (!Array.isArray(message.args) || !Number.isSafeInteger(message.baseRevision)) throw api.runtimeError('PRECONDITION_FAILED', 'Invalid popup command');
    }
    async function invoke(message) {
      if (closed) throw closedError();
      validateCommand(message);
      const { operation, args, baseRevision } = message;
      receivedDrafts.delete(message.requestId);
      if (operation === 'run' && run) return run();
      if (operation === 'releaseHandles') return releaseOwned(args[0]);
      if (operation === 'refactoringQuery' && args[0] === 'cancelRefactoring') return cancelOwned(args[1].token);
      if (operation === 'commit') {
        if (args[0].baseRevision !== baseRevision) throw api.runtimeError('STALE_REVISION', 'Accepted source changed');
        if (args[0].action === 'applyRefactoring' && !previews.has(args[0].params.token)) throw api.runtimeError('PRECONDITION_FAILED', 'Preview belongs to another connection');
      }
      if (!['setDraft', 'revertDraft', 'commit', 'evaluate', 'browse', 'inspect', 'refactoringQuery', 'restart'].includes(operation)) throw api.runtimeError('PRECONDITION_FAILED', 'Unknown popup command');
      const controller = controllers.get(message.requestId);
      if (controller.signal.aborted) throw closedError();
      const callArgs = operation === 'evaluate' ? [args[0], { ...args[1], signal: controller.signal }] : args;
      const result = await workspace[operation](...callArgs);
      await capture(operation, args, result);
      return result;
    }
    port.onmessage = event => {
      const message = event.data;
      if (closed || !message || message.sessionId !== sessionId) return;
      if (message.type === 'connect') { post({ type: 'ready', state: state() }); return; }
      if (message.type === 'close') { close(); return; }
      if (message.type === 'cancel') { const controller = controllers.get(message.requestId); if (controller) controller.abort(); return; }
      if (message.type !== 'request' || typeof message.requestId !== 'string' || controllers.has(message.requestId)) return;
      controllers.set(message.requestId, new AbortController());
      if (['setDraft', 'revertDraft'].includes(message.operation)) receivedDrafts.set(message.requestId, message);
      tail = tail.then(async () => {
        try { const result = await invoke(message); post({ type: 'reply', requestId: message.requestId, result, state: state() }); }
        catch (error) { post({ type: 'reply', requestId: message.requestId, error: { code: error.code || 'PRECONDITION_FAILED', message: error.message }, state: state() }); }
        finally { controllers.delete(message.requestId); }
      });
    };
    port.onmessageerror = () => close(); port.start();
    function close() {
      if (closed) return;
      post({ type: 'closed' }); closed = true;
      // Keep source received before close even while native work holds the queue.
      // Only synchronous draft edits drain; queued commits remain canceled.
      for (const message of receivedDrafts.values()) {
        if (ownerDisposed) break;
        try { validateCommand(message); workspace[message.operation](...message.args); }
        catch (error) { cleanupError(error); }
      }
      receivedDrafts.clear(); unsubscribe();
      // An already submitted operation belongs to Workspace. Let it settle and
      // clean its late result; closing a view must not stop the shared image.
      port.close();
      releaseOwned([...handles.keys()]).catch(cleanupError);
      for (const token of previews.keys()) cancelOwned(token).catch(cleanupError);
      onClose();
    }
    return { close };
  }
  api.PopupWorkspace = PopupWorkspace;
  api.PopupWorkspaceOwner = { serve };
})(window);
