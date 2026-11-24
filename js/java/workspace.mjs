import { openBrowserJvm } from '../browser-jvm/session.mjs';
import { ARTIFACTS } from './runtime-manifest.mjs';

// Reuse the compiler and bridge already verified for this page, including when
// the site deploys a new release between editing and opening Debug.
const verifiedArchives = new Map();

const openSession = options => openBrowserJvm({
  assetCache: verifiedArchives,
  ...options, artifacts: options.enableDebugger ? ARTIFACTS : ARTIFACTS.filter(asset => !asset.name.startsWith('asm-')),
  moduleURL: import.meta.url,
  frameURL: new URL('../../java-runtime-frame.html', import.meta.url),
  label: 'Java', connectType: 'sebook-java-connect',
});

function relativePath(path) {
  const relative = String(path).replace(/^\/tutorial\//, '');
  if (!relative || relative.split('/').some(part => !part || part === '.' || part === '..') ||
      /[\\\u0000-\u001f]/.test(relative)) throw new Error('Invalid Java source path.');
  return relative;
}

// Copy the snapshot at call time. The editor may switch steps while the JVM boots.
function sources(files) {
  const entries = Array.isArray(files) ? files.map(({ path, content }) => [path, content]) : Object.entries(files || {});
  const snapshot = Object.create(null);
  for (const [path, content] of entries) {
    if (path.endsWith('.java')) snapshot[relativePath(path)] = String(content);
  }
  return snapshot;
}

export class JavaWorkspace {
  constructor({ openRuntime = openSession, bootTimeoutMs = 90000, runTimeoutMs = 30000, enableDebugger = false } = {}) {
    this.openRuntime = openRuntime;
    this.enableDebugger = enableDebugger;
    this.bootTimeoutMs = bootTimeoutMs;
    this.runTimeoutMs = runTimeoutMs;
    this.generation = 0;
    this.nextId = 0;
    this.tail = Promise.resolve();
  }

  warmup() {
    if (this.destroyed) return Promise.reject(new Error('Java workspace closed.'));
    if (this.boot) return this.boot;
    const controller = this.controller = new AbortController();
    this.boot = new Promise((resolve, reject) => {
      this.failBoot = reject;
      this.bootTimer = setTimeout(() => this.reset(new Error('Java startup timed out. Try running again.')), this.bootTimeoutMs);
      this.openRuntime({
        signal: controller.signal, enableDebugger: this.enableDebugger,
        onMessage: message => { if (this.controller === controller) this.receive(message); },
      }).then(session => {
        if (this.controller !== controller) { session.close(); return; }
        clearTimeout(this.bootTimer);
        this.session = session;
        this.failBoot = null;
        resolve();
      }, error => { if (this.controller === controller) this.reset(error); });
    });
    return this.boot;
  }

  run(options) { return this.request('run', options); }
  test(options) { return this.request('test', options); }
  async debug(options) {
    if (this.destroyed) throw new Error('Java workspace closed.');
    if (this.debuggerSession) throw new Error('A Java debug session is already running.');
    const debuggerSession = this.debuggerSession = new JavaWorkspace({
      openRuntime: this.openRuntime, bootTimeoutMs: this.bootTimeoutMs,
      runTimeoutMs: this.runTimeoutMs, enableDebugger: true,
    });
    try { return await debuggerSession.request('debug', options); }
    finally { debuggerSession.destroy(); this.debuggerSession = null; }
  }
  analyze(options) { return this.request('analyze', options); }

  request(operation, { files, entry, onPause, ...options }) {
    const request = { ...options, operation, files: sources(files) };
    if (entry) request.entry = relativePath(entry);
    const generation = this.generation;
    const job = this.tail.then(async () => {
      if (this.destroyed || this.generation !== generation) throw new DOMException('Stopped.', 'AbortError');
      await this.warmup();
      if (this.generation !== generation) throw new DOMException('Stopped.', 'AbortError');
      return new Promise((resolve, reject) => {
        this.pending = { id: ++this.nextId, resolve, reject, onPause };
        this.armTimeout();
        try { this.session.send(this.pending.id, request); }
        catch (error) { this.reset(error); }
      });
    });
    this.tail = job.catch(() => {});
    return job;
  }

  armTimeout() {
    clearTimeout(this.runTimer);
    this.runTimer = setTimeout(() => this.reset(new Error('Java exceeded the execution time limit.')), this.runTimeoutMs);
  }

  debugCommand(command) {
    if (this.debuggerSession) return this.debuggerSession.debugCommand(command);
    if (!this.pending || !this.session) return;
    this.session.post({ type: 'debug-command', command });
  }

  receive(message) {
    if (message?.type === 'fatal') { this.reset(new Error(message.message)); return; }
    const pending = this.pending;
    if (!pending) return;
    if (message?.type === 'debug-event') {
      if (message.event?.type === 'paused') clearTimeout(this.runTimer);
      if (message.event?.type === 'continued') this.armTimeout();
      pending.onPause?.(message.event);
      return;
    }
    if (message?.type !== 'result' || message.id !== pending.id) return;
    clearTimeout(this.runTimer);
    this.pending = null;
    pending.resolve(message.result);
    if (message.result?.resetRuntime) this.release();
  }

  release() {
    clearTimeout(this.bootTimer);
    clearTimeout(this.runTimer);
    const controller = this.controller;
    this.controller = this.boot = null;
    controller?.abort();
    this.session?.close();
    this.session = null;
  }

  reset(error) {
    this.generation++;
    this.failBoot?.(error);
    this.failBoot = null;
    this.pending?.reject(error);
    this.pending = null;
    this.release();
  }

  cancel() {
    this.debuggerSession?.cancel();
    this.reset(new DOMException('Stopped.', 'AbortError'));
  }
  destroy() { this.destroyed = true; this.cancel(); }
}
