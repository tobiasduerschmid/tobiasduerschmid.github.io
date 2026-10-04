/** Run the compiler core in a disposable worker, keeping arbitrary regexes off the UI thread. */
(function () {
  'use strict';
  if (window.CompilerLabClient) return;
  const defaultWorkerURL = new URL('compiler-lab-worker.js', document.currentScript.src).href;

  function failure(message, extra = {}) {
    return { ok: false, tokens: [], parseTree: null, ast: null,
      parseTrees: [], asts: [], astParseTreeIndices: [], incomplete: true,
      diagnostics: [{ stage: 'execution', message }], ...extra };
  }

  /**
   * run(config) resolves to a CompilerLabCore result; execution failures use the
   * same diagnostic shape. Replacing, cancelling, or destroying a run always
   * settles its Promise and terminates its worker. No code runs on the UI thread.
   */
  class CompilerLabClient {
    constructor({ workerUrl = defaultWorkerURL, timeoutMs = 4000 } = {}) {
      this.workerUrl = workerUrl;
      this.timeoutMs = timeoutMs;
      this.pending = null;
    }

    run(config) {
      this.cancel();
      return new Promise(resolve => {
        const pending = { worker: null, timer: null, resolve };
        this.pending = pending;
        try {
          pending.worker = new Worker(this.workerUrl);
          pending.worker.onmessage = event => this.finish(pending, event.data);
          pending.worker.onerror = event => {
            event.preventDefault();
            this.finish(pending, failure('The compiler worker could not run. Reload the page and try again.'));
          };
          pending.timer = setTimeout(() => this.finish(pending, failure(
            'Run stopped after the execution limit. Simplify the tokenizer patterns, grammar, or input and try again.'
          )), this.timeoutMs);
          pending.worker.postMessage(config);
        } catch (error) {
          this.finish(pending, failure('The compiler worker could not start: ' + error.message));
        }
      });
    }

    finish(pending, result) {
      if (this.pending !== pending) return;
      clearTimeout(pending.timer);
      if (pending.worker) pending.worker.terminate();
      this.pending = null;
      pending.resolve(result);
    }

    cancel() {
      if (this.pending) this.finish(this.pending, failure('Run stopped.', { cancelled: true }));
    }

    destroy() { this.cancel(); }
  }

  window.CompilerLabClient = CompilerLabClient;
})();
