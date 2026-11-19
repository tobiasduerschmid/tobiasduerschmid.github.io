const VENDOR = 'https://cjrtnc.leaningtech.com';

async function verifiedAssets(artifacts, moduleURL, label, signal, onProgress, assetCache) {
  let completed = 0;
  onProgress({ stage: 'download', completed, total: artifacts.length });
  return Promise.all(artifacts.map(async artifact => {
    const url = new URL(artifact.path, moduleURL);
    const key = url.href + '#' + artifact.sha256;
    let bytes = assetCache?.get(key);
    if (!bytes) {
      const response = await fetch(url, { signal, credentials: 'omit' });
      if (!response.ok) throw new Error('Could not download the pinned ' + label + ' tools (' + response.status + ').');
      bytes = await response.arrayBuffer();
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
      const hex = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
      if (hex !== artifact.sha256) throw new Error(label + ' runtime integrity verification failed. Reload to use matching assets.');
      assetCache?.set(key, bytes);
    }
    onProgress({ stage: 'download', completed: ++completed, total: artifacts.length });
    // postMessage transfers and detaches this buffer. Keep the verified original
    // when a second, disposable JVM will need the same pinned tools.
    return { name: artifact.name, bytes: assetCache ? bytes.slice(0) : bytes };
  }));
}

async function frameDocument(frameURL, label, signal) {
  const response = await fetch(frameURL, { signal, credentials: 'omit' });
  if (!response.ok) throw new Error('Could not load the ' + label + ' runtime frame.');
  const html = new DOMParser().parseFromString(await response.text(), 'text/html');
  const base = html.createElement('base');
  base.href = frameURL.href;
  html.head.prepend(base);
  const policy = html.createElement('meta');
  policy.httpEquiv = 'Content-Security-Policy';
  policy.content = `default-src 'none'; script-src ${frameURL.origin} ${VENDOR} 'unsafe-eval' 'wasm-unsafe-eval' blob:; connect-src ${VENDOR}; frame-src ${VENDOR}; worker-src ${VENDOR} blob:; style-src ${frameURL.origin} ${VENDOR} 'unsafe-inline'; img-src ${VENDOR} data:; font-src ${VENDOR}; base-uri ${frameURL.origin}; form-action 'none'`;
  html.head.prepend(policy);
  return '<!doctype html>' + html.documentElement.outerHTML;
}

/** Load verified tool archives into a disposable, opaque-origin CheerpJ frame. */
export async function openBrowserJvm({ frameURL, moduleURL, artifacts, label, connectType, signal, onMessage, assetCache, onProgress = () => {} }) {
  const [assets, html] = await Promise.all([verifiedAssets(artifacts, moduleURL, label, signal, onProgress, assetCache), frameDocument(frameURL, label, signal)]);
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    const channel = new MessageChannel();
    let ready = false;
    let closed = false;
    const session = {
      send: (id, request) => channel.port1.postMessage({ type: 'execute', id, request }),
      post: message => channel.port1.postMessage(message),
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
      if (!ready) reject(new DOMException(label + ' startup canceled.', 'AbortError'));
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
    channel.port1.onmessageerror = () => fail('The ' + label + ' runtime returned an unreadable message.');
    frame.hidden = true;
    frame.title = label + ' execution runtime';
    frame.setAttribute('aria-hidden', 'true');
    // data: remains opaque; allow-same-origin is needed by the vendor helper.
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    frame.onload = () => {
      if (closed) return;
      frame.onload = null;
      frame.contentWindow.postMessage({ type: connectType, assets }, '*', [channel.port2, ...assets.map(asset => asset.bytes)]);
    };
    frame.onerror = () => fail('Could not open the ' + label + ' browser runtime.');
    frame.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
    document.body.append(frame);
  });
}
