export function timeoutError() { return new DOMException('The model operation timed out. Try a shorter specification or the Processor option.', 'TimeoutError'); }
export function abortError() { return new DOMException('Operation cancelled.', 'AbortError'); }

// One owner per inference worker; termination cancels vendor work and nested workers.
export class WorkerClient {
  constructor(factory = () => new Worker(new URL('./worker.mjs', import.meta.url), {type:'module'})) {
    this.factory = factory;
    this.sequence = 0;
  }
  request(action, payload, {signal, onProgress, onText, timeoutMs = 300000} = {}) {
    if (this.pending) return Promise.reject(new Error('The model is busy.'));
    if (signal?.aborted) return Promise.reject(abortError());
    if (!this.worker) {
      this.worker = this.factory();
      this.worker.onmessage = event => {
        const pending = this.pending;
        const message = event.data;
        if (!pending || message.id !== pending.id) return;
        if (message.type === 'progress') pending.onProgress?.(message.value);
        else if (message.type === 'text') pending.onText?.(message.value);
        else if (message.type === 'result') pending.finish(null, message.value);
        else if (message.type === 'error') {
          const name = message.errorName || message.value?.name || 'BackendError';
          const error = Object.assign(new Error(typeof message.value === 'string' ? message.value : message.value.message),{
            name,recoverable:pending.action === 'generate' && name === 'InputError' && message.recoverable === true,
            contextLimit:message.contextLimit
          });
          if (error.name === 'InputError' && error.recoverable) pending.finish(error);
          else this.stop(error);
        }
      };
      this.worker.onerror = () => this.stop(Object.assign(new Error('The model worker stopped. Try the Processor option or reload the model.'),{name:'BackendError'}));
    }
    return new Promise((resolve,reject) => {
      const id = ++this.sequence;
      const cancel = () => this.stop(signal.reason?.name === 'TimeoutError' ? signal.reason : abortError());
      const timer = setTimeout(() => this.stop(timeoutError()),timeoutMs);
      this.pending = {id,action,onProgress,onText,finish:(error,value) => {
        clearTimeout(timer);
        signal?.removeEventListener('abort',cancel);
        this.pending = null;
        if (error) reject(error); else resolve(value);
      }};
      signal?.addEventListener('abort',cancel,{once:true});
      try { this.worker.postMessage({id,action,payload}); } catch (error) { this.stop(error); }
    });
  }
  stop(error = abortError()) {
    this.worker?.terminate();
    this.worker = null;
    this.pending?.finish(error);
  }
}
