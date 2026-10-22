/** Owns one cancellable worker; each execution gets a fresh virtual filesystem. */
export class ShellPipelineClient {
  constructor(config = {}) {
    this.config = config;
    this.worker = null;
    this.ready = null;
    this.pending = new Map();
    this.nextId = 0;
    this.generation = 0;
  }

  initialize() {
    if (this.ready) return this.ready;
    const worker = new Worker(new URL('./shell-pipeline-worker.mjs', import.meta.url), { type: 'module' });
    this.worker = worker;
    worker.onmessage = ({ data }) => {
      if (this.worker !== worker) return;
      const request = this.pending.get(data.id);
      if (!request) return;
      clearTimeout(request.timer);
      this.pending.delete(data.id);
      if (data.error) request.reject(new Error(data.error));
      else request.resolve(data.result);
    };
    worker.onerror = () => {
      if (this.worker === worker) this.reset('The shell could not load. Try again or reload this page.', 'unavailable');
    };
    this.ready = this.send({ action: 'initialize' }, 15000);
    return this.ready;
  }

  send(message, timeout) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.reset('Execution timed out. Simplify the command and try again.', 'timeout'), timeout);
      this.pending.set(id, { resolve, reject, timer });
      try { this.worker.postMessage({ ...message, id }); }
      catch (error) { this.reset(error.message, 'unavailable'); }
    });
  }

  async execute(message) {
    const generation = this.generation;
    await this.initialize();
    if (generation !== this.generation) {
      const error = new Error('Execution stopped.');
      error.reason = 'terminated';
      throw error;
    }
    return this.send({ ...this.config, ...message }, 4000);
  }

  reset(message = 'Execution stopped.', reason = 'terminated') {
    this.generation++;
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      const error = new Error(message);
      error.reason = reason;
      request.reject(error);
    }
    this.pending.clear();
  }
}
