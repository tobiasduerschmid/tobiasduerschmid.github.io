/* Executes the pinned OSATE engine only inside a disposable opaque-origin frame. */
(function () {
  'use strict';
  let connected = false;

  async function errorMessage(error) {
    if (typeof error?.message === 'string') return error.message;
    // CheerpJ Java exceptions are proxies; String(error) can itself throw.
    if (typeof error?.getMessage === 'function') {
      const message = await error.getMessage();
      if (typeof message === 'string') return message;
    }
    return 'The Java runtime could not complete this operation.';
  }

  function mountArtifacts(assets) {
    if (!Array.isArray(assets) || assets.length < 2 || assets.length > 64) throw new Error('Invalid runtime artifact set.');
    const names = new Set();
    let total = 0;
    const paths = assets.map(asset => {
      if (!/^[A-Za-z0-9_.-]+\.jar$/.test(asset.name) || names.has(asset.name) || !(asset.bytes instanceof ArrayBuffer)) throw new Error('Invalid runtime artifact.');
      names.add(asset.name);
      total += asset.bytes.byteLength;
      if (total > 100_000_000) throw new Error('The runtime artifact set is too large.');
      const path = '/str/' + asset.name;
      cheerpOSAddStringFile(path, new Uint8Array(asset.bytes));
      return path;
    });
    if (!names.has('sebook-aadl-bridge.jar')) throw new Error('The AADL bridge is missing.');
    return paths.join(':');
  }

  window.addEventListener('message', async function connect(event) {
    if (connected || event.source !== parent || event.data?.type !== 'sebook-aadl-connect' || event.ports.length !== 1) return;
    connected = true;
    window.removeEventListener('message', connect);
    const port = event.ports[0];
    const progress = stage => port.postMessage({ type: 'progress', stage });
    let failed = false;
    const fail = message => {
      if (failed) return;
      failed = true;
      port.postMessage({ type: 'fatal', message });
    };
    window.addEventListener('error', error => fail('The browser JVM failed: ' + error.message));
    try {
      let annotations;
      progress('runtime');
      await cheerpjInit({
        version: 25, status: 'none', wasmGC: false,
        javaProperties: ['java.awt.headless=true', 'sebook.aadl.workRoot=/files/sebook-aadl', 'guice_bytecode_gen_option=DISABLED'],
        natives: {
          async Java_java_lang_reflect_Field_getTypeAnnotationBytes0(_library, field) {
            // The native callback's loader is the JDK loader. Capture our app class
            // below so the adapter can read the original declaring-class bytes.
            return await annotations.field(field);
          },
        },
      });
      progress('language');
      const library = await cheerpjRunLibrary(mountArtifacts(event.data.assets));
      annotations = await library.sebook.aadl.TypeAnnotationBytes;
      const Bridge = await library.sebook.aadl.Bridge;
      progress('services');
      const engine = await Bridge.initialize();
      let busy = false;
      port.onmessage = async message => {
        if (failed || busy || message.data?.type !== 'execute') return;
        busy = true;
        const { id, request } = message.data;
        try {
          const result = JSON.parse(await Bridge.execute(JSON.stringify(request)));
          port.postMessage({ type: 'result', id, result });
        } catch (error) { fail(await errorMessage(error)); }
        finally { busy = false; }
      };
      if (!failed) port.postMessage({ type: 'ready', engine });
    } catch (error) { fail('Could not initialize OSATE in the browser: ' + await errorMessage(error)); }
  });
})();
