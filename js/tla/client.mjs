import { validateResult } from './model.mjs';
import { ARTIFACTS } from './runtime-manifest.mjs';

const failure = (status, reason, message) => ({ version: 1, status, reason, sessionExpired: reason !== 'busy', diagnostics: [{ message }] });
const startsSession = operation => ['check', 'parse', 'explore-init'].includes(operation);

/** One private port and disposable JVM per check; only exploration retains a JVM. */
export class TLAClient {
  constructor({ frameURL = new URL('../../tla-runtime-frame.html', import.meta.url), bootTimeoutMs = 180000, runTimeoutMs = 35000, onPhase = () => {} } = {}) {
    this.frameURL = frameURL;
    this.bootTimeoutMs = bootTimeoutMs;
    this.runTimeoutMs = runTimeoutMs;
    this.onPhase = onPhase;
    this.sequence = 0;
    this.destroyed = false;
  }

  execute(request) {
    if (this.destroyed) return Promise.resolve(failure('error', 'disposed', 'This model workspace has closed.'));
    if (this.pending) return Promise.resolve(failure('error', 'busy', 'Wait for the current operation or stop it first.'));
    if (startsSession(request.operation)) this.release();
    if (!this.frame && !startsSession(request.operation)) {
      return Promise.resolve(failure('error', 'expired-session', 'Start exploration again to inspect this state.'));
    }
    return new Promise(resolve => {
      const pending = this.pending = { id: ++this.sequence, request, resolve };
      pending.timer = setTimeout(() => this.fail(pending, 'incomplete', 'startup-timeout', 'The browser runtime did not become ready in time. Check the connection and try again.'), this.bootTimeoutMs);
      if (this.ready) this.send(pending);
      else this.start(pending).catch(error => this.fail(pending, 'error', 'runtime-unavailable', error.message));
    });
  }

  async start(pending) {
    this.onPhase('loading');
    this.abort = new AbortController();
    const signal = this.abort.signal;
    const assets = await Promise.all(ARTIFACTS.map(async artifact => {
      const response = await fetch(new URL(artifact.path, import.meta.url), { signal, credentials: 'omit' });
      if (!response.ok) throw new Error('Could not load the pinned TLA+ tools (' + response.status + ').');
      const bytes = await response.arrayBuffer();
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
      if (digest !== artifact.sha256) throw new Error('TLA+ runtime integrity check failed. Reload to use matching runtime files.');
      return { name: artifact.name, bytes };
    }));
    if (this.pending !== pending) return;
    const template = await fetch(this.frameURL, { signal, credentials: 'omit' });
    if (!template.ok) throw new Error('Could not load the TLA+ execution frame.');
    const html = new DOMParser().parseFromString(await template.text(), 'text/html');
    const base = html.createElement('base');
    base.href = this.frameURL.href;
    html.head.prepend(base);
    const policy = html.createElement('meta');
    policy.httpEquiv = 'Content-Security-Policy';
    const host = this.frameURL.origin;
    const vendor = 'https://cjrtnc.leaningtech.com';
    policy.content = `default-src 'none'; script-src ${host} ${vendor} 'unsafe-eval' 'wasm-unsafe-eval' blob:; connect-src ${vendor}; frame-src ${vendor}; worker-src ${vendor} blob:; style-src ${vendor} 'unsafe-inline'; img-src ${vendor} data:; font-src ${vendor}; base-uri ${host}; form-action 'none'`;
    html.head.prepend(policy);
    if (this.pending !== pending) return;
    const frame = this.frame = document.createElement('iframe');
    frame.hidden = true;
    frame.title = 'TLA+ execution runtime';
    // A data URL has a unique opaque origin even with allow-same-origin. That token
    // is needed by CheerpJ's nested CDN helper; it does NOT give this frame our origin.
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    frame.setAttribute('aria-hidden', 'true');
    const channel = new MessageChannel();
    this.port = channel.port1;
    this.port.onmessage = event => { if (this.port === channel.port1) this.receive(event.data); };
    this.port.onmessageerror = () => { if (this.port === channel.port1) this.fail(this.pending, 'error', 'protocol-error', 'The runtime returned an unreadable message.'); };
    frame.onload = () => {
      if (this.frame !== frame || this.pending !== pending) return;
      frame.onload = null;
      // An opaque origin requires '*'; the port is transferred only to this exact frame.
      frame.contentWindow.postMessage({ type: 'sebook-tla-connect', assets }, '*', [channel.port2, ...assets.map(asset => asset.bytes)]);
    };
    frame.onerror = () => this.fail(pending, 'error', 'runtime-unavailable', 'Could not open the TLA+ runtime.');
    frame.src = 'data:text/html;charset=utf-8,' + encodeURIComponent('<!doctype html>' + html.documentElement.outerHTML);
    document.body.append(frame);
  }

  send(pending) {
    if (this.pending !== pending) return;
    clearTimeout(pending.timer);
    pending.timer = setTimeout(() => this.fail(pending, 'incomplete', 'time-limit', 'The browser time limit was reached. This check is incomplete; reduce the model size and try again.'), this.runTimeoutMs);
    this.onPhase(pending.request.operation === 'check' ? 'checking' : 'working');
    this.port.postMessage({ type: 'execute', id: pending.id, request: pending.request });
  }

  receive(message) {
    if (!message || !this.pending) return;
    if (message.type === 'ready' && !this.ready) {
      this.ready = true;
      this.send(this.pending);
    } else if (message.type === 'fatal') {
      this.fail(this.pending, 'error', 'runtime-unavailable', String(message.message));
    } else if (message.type === 'result' && message.id === this.pending.id) {
      const pending = this.pending;
      try {
        const result = validateResult(message.result);
        this.settle(pending, result);
        if (['check', 'parse'].includes(pending.request.operation)) this.release();
      } catch (error) { this.fail(pending, 'error', 'protocol-error', error.message); }
    }
  }

  settle(pending, result) {
    if (!pending || this.pending !== pending) return;
    clearTimeout(pending.timer);
    this.pending = null;
    pending.resolve(result);
  }

  fail(pending, status, reason, message) {
    if (!pending || this.pending !== pending) return;
    this.settle(pending, failure(status, reason, message));
    this.release();
  }

  cancel() {
    this.settle(this.pending, failure('incomplete', 'cancelled', 'Stopped. No conclusion is available for the complete model.'));
    this.release();
  }

  release() {
    this.abort?.abort();
    this.port?.close();
    this.frame?.remove();
    this.abort = this.port = this.frame = null;
    this.ready = false;
  }

  destroy() { this.cancel(); this.destroyed = true; }
}
