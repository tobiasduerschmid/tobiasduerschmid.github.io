import { ARTIFACTS } from './runtime-manifest.mjs';

const FRAME_URL = new URL('../../aadl-runtime-frame.html', import.meta.url);
const VENDOR = 'https://cjrtnc.leaningtech.com';

async function verifiedAssets(signal, onProgress) {
  let completed = 0;
  onProgress({ stage: 'download', completed, total: ARTIFACTS.length });
  return Promise.all(ARTIFACTS.map(async artifact => {
    const response = await fetch(new URL(artifact.path, import.meta.url), { signal, credentials: 'omit' });
    if (!response.ok) throw new Error('Could not download the pinned AADL tools (' + response.status + ').');
    const bytes = await response.arrayBuffer();
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    const hex = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
    if (hex !== artifact.sha256) throw new Error('AADL runtime integrity verification failed. Reload to use matching assets.');
    onProgress({ stage: 'download', completed: ++completed, total: ARTIFACTS.length });
    return { name: artifact.name, bytes };
  }));
}

async function frameDocument(signal) {
  const response = await fetch(FRAME_URL, { signal, credentials: 'omit' });
  if (!response.ok) throw new Error('Could not load the AADL runtime frame.');
  const html = new DOMParser().parseFromString(await response.text(), 'text/html');
  const base = html.createElement('base');
  base.href = FRAME_URL.href;
  html.head.prepend(base);
  const policy = html.createElement('meta');
  policy.httpEquiv = 'Content-Security-Policy';
  policy.content = `default-src 'none'; script-src ${FRAME_URL.origin} ${VENDOR} 'unsafe-eval' 'wasm-unsafe-eval' blob:; connect-src ${VENDOR}; frame-src ${VENDOR}; worker-src ${VENDOR} blob:; style-src ${FRAME_URL.origin} ${VENDOR} 'unsafe-inline'; img-src ${VENDOR} data:; font-src ${VENDOR}; base-uri ${FRAME_URL.origin}; form-action 'none'`;
  html.head.prepend(policy);
  return '<!doctype html>' + html.documentElement.outerHTML;
}

/** Private port to an opaque-origin JVM; the Java bridge isolates every snapshot. */
export async function openRuntimeSession({ signal, onMessage, onProgress = () => {} }) {
  const [assets, html] = await Promise.all([verifiedAssets(signal, onProgress), frameDocument(signal)]);
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    const channel = new MessageChannel();
    let ready = false;
    let closed = false;
    const session = {
      send: (id, request) => channel.port1.postMessage({ type: 'execute', id, request }),
      close() {
        if (closed) return;
        closed = true;
        signal.removeEventListener('abort', abort);
        channel.port1.close();
        channel.port2.close();
        frame.remove();
      },
    };
    function abort() {
      session.close();
      if (!ready) reject(new DOMException('AADL startup canceled.', 'AbortError'));
    }
    function fail(message) {
      session.close();
      if (!ready) reject(new Error(message));
      else onMessage({ type: 'fatal', message });
    }
    signal.addEventListener('abort', abort, { once: true });
    channel.port1.onmessage = event => {
      if (closed) return;
      if (event.data?.type === 'ready' && !ready) { ready = true; resolve(session); }
      else if (event.data?.type === 'fatal') fail(String(event.data.message));
      else if (!ready && event.data?.type === 'progress' && ['runtime', 'language', 'services'].includes(event.data.stage)) onProgress({ stage: event.data.stage });
      else if (ready) onMessage(event.data);
    };
    channel.port1.onmessageerror = () => fail('The AADL runtime returned an unreadable message.');
    frame.hidden = true;
    frame.title = 'AADL execution runtime';
    frame.setAttribute('aria-hidden', 'true');
    // data: remains opaque; allow-same-origin is needed by the vendor helper.
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    frame.onload = () => {
      if (closed) return;
      frame.onload = null;
      frame.contentWindow.postMessage({ type: 'sebook-aadl-connect', assets }, '*', [channel.port2, ...assets.map(asset => asset.bytes)]);
    };
    frame.onerror = () => fail('Could not open the AADL browser runtime.');
    frame.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
    document.body.append(frame);
  });
}
