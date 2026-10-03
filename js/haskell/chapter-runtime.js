// One lazily booted MicroHs frame per chapter. The existing adapter owns
// compilation reuse and language semantics; this client owns request lifetime.
const NAMESPACE = 'sebook-haskell-runtime';
const SOURCE_PATH = '/tutorial/Example.hs';
const BOOT_TIMEOUT_MS = 90_000;
const REQUEST_TIMEOUT_MS = 30_000;

export class ChapterRuntime extends EventTarget {
  constructor() {
    super();
    this.session = null;
    this.active = null;
    this.nextId = 0;
    window.addEventListener('pagehide', () => this.stop());
  }

  get busy() { return this.active !== null; }

  warmup() {
    // Actual editing signals intent. Download in parallel with typing, but
    // don't load the compiler merely for reading, scrolling, or focusing.
    if (!this.session) this.createSession().ready.catch(() => {});
  }

  async evaluate(source, expression, onStatus) {
    if (this.busy) throw new Error('Another example is running. Wait for it or stop its evaluation.');
    const operation = {};
    this.active = operation;
    this.dispatchEvent(new Event('busychange'));
    try {
      onStatus(this.session && !this.session.boot ? 'Evaluating…' : 'Loading Haskell for the first evaluation…');
      const session = this.session || this.createSession();
      await session.ready;
      if (this.active !== operation) throw new Error('Evaluation stopped.');
      onStatus('Evaluating…');
      // Restore source even if an earlier IO expression changed runtime files.
      // Identical bytes still reuse the adapter's successful compilation cache.
      const write = await this.request(session, { type: 'write', path: SOURCE_PATH, content: 'module Example where\n' + source });
      if (write.type !== 'write_ok') throw new Error(write.message || 'Could not load this example.');
      return await this.request(session, { type: 'evaluate', path: SOURCE_PATH, expression, silent: true });
    } finally {
      if (this.active === operation) {
        this.active = null;
        this.dispatchEvent(new Event('busychange'));
      }
    }
  }

  createSession() {
    const frame = document.createElement('iframe');
    frame.hidden = true;
    frame.tabIndex = -1;
    frame.title = 'Haskell expression runtime';
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.src = '/haskell-runtime-frame.html';
    const session = { frame, pending: new Map(), events: new AbortController(), boot: null };
    session.ready = new Promise((resolve, reject) => {
      session.boot = { resolve, reject, timer: setTimeout(() => {
        this.disposeSession(session, new Error('Haskell could not finish loading. Evaluate again to retry.'));
      }, BOOT_TIMEOUT_MS) };
    });
    window.addEventListener('message', event => {
      if (event.source !== frame.contentWindow || event.data?.namespace !== NAMESPACE) return;
      this.receive(session, event.data.message);
    }, { signal: session.events.signal });
    frame.addEventListener('error', () => {
      this.disposeSession(session, new Error('Haskell could not load. Check your connection and try again.'));
    }, { signal: session.events.signal });
    this.session = session;
    document.body.append(frame);
    return session;
  }

  receive(session, message) {
    if (this.session !== session || !message) return;
    if (message.type === 'ready' && session.boot) {
      clearTimeout(session.boot.timer);
      session.boot.resolve();
      session.boot = null;
    } else if (message.type === 'error') {
      this.disposeSession(session, new Error(message.message || 'Haskell failed. Evaluate again to retry.'));
    } else if (session.pending.has(message.id)) {
      const pending = session.pending.get(message.id);
      clearTimeout(pending.timer);
      session.pending.delete(message.id);
      pending.resolve(message);
    }
  }

  request(session, message) {
    if (this.session !== session) return Promise.reject(new Error('Evaluation stopped.'));
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.disposeSession(session,
        new Error('Evaluation timed out. Try a smaller input or a finite result, then evaluate again.')), REQUEST_TIMEOUT_MS);
      session.pending.set(id, { resolve, reject, timer });
      session.frame.contentWindow.postMessage({ namespace: NAMESPACE, message: { ...message, id } }, '*');
    });
  }

  stop() {
    if (this.session) this.disposeSession(this.session, new Error('Evaluation stopped.'));
  }

  disposeSession(session, error) {
    if (this.session !== session) return;
    this.session = null;
    session.events.abort();
    session.frame.remove();
    if (session.boot) {
      clearTimeout(session.boot.timer);
      session.boot.reject(error);
      session.boot = null;
    }
    for (const pending of session.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    session.pending.clear();
  }
}
