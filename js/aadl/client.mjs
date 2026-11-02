import { interrupted, validateResult } from './model.mjs';

const openBrowserSession = async options => {
  const { openRuntimeSession } = await import('./runtime-session.mjs');
  return openRuntimeSession(options);
};

/** Keep bounded engine work alive across edits; Stop still terminates the JVM. */
export class AADLClient {
  constructor({ openSession = openBrowserSession, bootTimeoutMs = 240000, runTimeoutMs = 60000, onPhase = () => {} } = {}) {
    this.openSession = openSession;
    this.bootTimeoutMs = bootTimeoutMs;
    this.runTimeoutMs = runTimeoutMs;
    this.onPhase = onPhase;
    this.sequence = 0;
    this.destroyed = false;
    this.pending = null;
    this.runtime = null;
  }

  execute(request) {
    if (this.destroyed) return Promise.resolve(interrupted('disposed', 'This architecture workspace has closed.'));
    if (this.pending) return Promise.resolve(interrupted('busy', 'Wait for the current operation or stop it.'));
    return new Promise(resolve => {
      this.pending = { id: ++this.sequence, resolve, request };
      if (!this.runtime) this.startRuntime();
      else if (!this.runtime.session) this.reportStartup(this.runtime);
      else if (this.runtime.active) this.onPhase('waiting');
      else this.dispatch(this.runtime);
    });
  }

  startRuntime() {
    const runtime = { abort: new AbortController(), session: null, active: null, startedAt: Date.now(), progress: {} };
    this.runtime = runtime;
    runtime.bootTimer = setTimeout(() => this.terminate(runtime, interrupted('startup-timeout',
      'Startup exceeded its time limit. No model result is available. Choose Analyze model to retry; if loading stalls again, check the connection or try another browser.')), this.bootTimeoutMs);
    this.reportStartup(runtime);
    void this.initialize(runtime);
  }

  async initialize(runtime) {
    try {
      const session = await this.openSession({
        signal: runtime.abort.signal,
        onMessage: message => this.receive(runtime, message),
        onProgress: progress => {
          if (this.runtime !== runtime) return;
          runtime.progress = progress;
          this.reportStartup(runtime);
        },
      });
      if (this.runtime !== runtime) { session.close(); return; }
      clearTimeout(runtime.bootTimer);
      runtime.session = session;
      this.dispatch(runtime);
    } catch (error) { this.fail(runtime, 'runtime-unavailable', error.message); }
  }

  reportStartup(runtime) {
    if (this.pending) this.onPhase('loading', { ...runtime.progress, elapsedMs: Date.now() - runtime.startedAt });
  }

  dispatch(runtime) {
    if (this.runtime !== runtime || runtime.active || !this.pending) return;
    const pending = this.pending;
    const active = { id: pending.id };
    runtime.active = active;
    active.timer = setTimeout(() => this.terminate(runtime, interrupted('time-limit',
      'The analysis time limit was reached. No complete conclusion is available.')), this.runTimeoutMs);
    this.onPhase(pending.request.operation === 'analyze' ? 'analyzing' : 'validating');
    try { runtime.session.send(pending.id, pending.request); }
    catch (error) { this.fail(runtime, 'runtime-unavailable', error.message); }
  }

  receive(runtime, message) {
    if (this.runtime !== runtime || !message) return;
    if (message.type === 'fatal') { this.fail(runtime, 'runtime-error', String(message.message)); return; }
    if (message.type !== 'result' || message.id !== runtime.active?.id) return;
    let result;
    try { result = validateResult(message.result); }
    catch (error) { this.fail(runtime, 'protocol-error', error.message); return; }
    clearTimeout(runtime.active.timer);
    runtime.active = null;
    // Even a superseded request must complete cleanly before reusing its JVM.
    if (!['complete', 'invalid'].includes(result.status)) { this.terminate(runtime, result); return; }
    if (this.pending?.id === message.id) this.settle(result);
    this.dispatch(runtime);
  }

  fail(runtime, reason, message) {
    this.terminate(runtime, { version: 1, status: 'error', reason, diagnostics: [{ severity: 'error', message }], analyses: [] });
  }

  terminate(runtime, result) {
    if (this.runtime !== runtime) return;
    this.releaseRuntime();
    this.settle(result);
  }

  settle(result) {
    const pending = this.pending;
    this.pending = null;
    pending?.resolve(result);
  }

  /** Invalidate a source snapshot without restarting startup or overlapping Java work. */
  supersede() {
    this.settle(interrupted('canceled', 'The source changed. This operation was superseded.'));
  }

  cancel() {
    // An edit may already have settled the promise while startup or old work continues.
    if (this.runtime && (!this.runtime.session || this.runtime.active)) this.releaseRuntime();
    this.settle(interrupted('canceled', 'Stopped. No current analysis conclusion is available.'));
  }

  releaseRuntime() {
    const runtime = this.runtime;
    this.runtime = null;
    if (!runtime) return;
    clearTimeout(runtime.bootTimer);
    clearTimeout(runtime.active?.timer);
    runtime.abort.abort();
    runtime.session?.close();
  }

  destroy() { this.cancel(); this.releaseRuntime(); this.destroyed = true; }
}
