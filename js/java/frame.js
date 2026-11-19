// The opaque frame owns a killable Worker. A Java loop cannot block the tutorial thread.
(function () {
  'use strict';
  window.addEventListener('message', async function connect(event) {
    if (event.source !== parent || event.data?.type !== 'sebook-java-connect' || event.ports.length !== 1) return;
    window.removeEventListener('message', connect);
    const port = event.ports[0];
    try {
      const meta = name => document.querySelector('meta[name="' + name + '"]').content;
      const loader = new URL(meta('java-loader'), document.baseURI);
      const response = await fetch(loader, { integrity: meta('java-loader-integrity'), credentials: 'omit' });
      if (!response.ok) throw new Error('Could not load the pinned browser JVM.');
      const bootstrap = [
        await response.text(),
        // The loader normally discovers its module directory from its script URL.
        'cj3LoaderPath=' + JSON.stringify(new URL('.', loader).href.replace(/\/$/, '')) + ';',
        'importScripts(' + ['java-memory-filesystem', 'java-worker'].map(name =>
          JSON.stringify(new URL(meta(name), document.baseURI).href)).join(',') + ');',
      ];
      const script = URL.createObjectURL(new Blob(bootstrap, { type: 'application/javascript' }));
      const worker = new Worker(script);
      const assets = event.data.assets;
      port.onmessage = ({ data }) => worker.postMessage(data);
      worker.onmessage = ({ data }) => port.postMessage(data);
      worker.onerror = error => port.postMessage({ type: 'fatal', message: error.message || 'The Java worker failed.' });
      // Removing the frame unloads its workers even when one is executing a tight loop.
      window.addEventListener('pagehide', () => { worker.terminate(); URL.revokeObjectURL(script); }, { once: true });
      const debuggerURL = assets.some(asset => asset.name.startsWith('asm-'))
        ? new URL(meta('java-debugger-script'), document.baseURI).href : null;
      worker.postMessage({ type: 'boot', assets, debuggerURL }, assets.map(asset => asset.bytes));
    } catch (error) {
      port.postMessage({ type: 'fatal', message: error.message || 'Java initialization failed.' });
    }
  });
})();
