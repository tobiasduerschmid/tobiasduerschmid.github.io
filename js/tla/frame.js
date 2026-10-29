/* Runs only in the disposable, opaque runtime frame. No access to the tutorial DOM or storage. */
(function () {
  'use strict';
  let connected = false;
  window.addEventListener('message', async function connect(event) {
    if (connected || event.source !== parent || event.data?.type !== 'sebook-tla-connect' || event.ports.length !== 1) return;
    connected = true;
    window.removeEventListener('message', connect);
    const port = event.ports[0];
    try {
      await cheerpjInit({ version: 11, status: 'none', javaProperties: [
        'java.awt.headless=true', 'sebook.tla.workRoot=/files/sebook-tla',
      ] });
      const paths = [];
      for (const asset of event.data.assets) {
        if (!['tla2tools.jar', 'sebook-tla-bridge.jar'].includes(asset.name) || !(asset.bytes instanceof ArrayBuffer)) throw new Error('Invalid runtime artifact.');
        const path = '/str/' + asset.name;
        cheerpOSAddStringFile(path, new Uint8Array(asset.bytes));
        paths.push(path);
      }
      const library = await cheerpjRunLibrary(paths.join(':'));
      const Bridge = await library.sebook.tla.Bridge;
      let busy = false;
      port.onmessage = async function (message) {
        if (message.data?.type !== 'execute' || busy) return;
        busy = true;
        const { id, request } = message.data;
        try {
          const result = JSON.parse(String(await Bridge.execute(JSON.stringify(request))));
          port.postMessage({ type: 'result', id, result });
        } catch (error) {
          port.postMessage({ type: 'fatal', message: 'The TLA+ runtime failed: ' + String(error.message || error) });
        } finally { busy = false; }
      };
      port.postMessage({ type: 'ready' });
    } catch (error) {
      port.postMessage({ type: 'fatal', message: 'Could not initialize the browser JVM: ' + String(error.message || error) });
    }
  });
})();
