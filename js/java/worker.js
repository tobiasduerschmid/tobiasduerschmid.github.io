'use strict';
let bridge;
let debuggerRuntime;
let busy = false;

async function fatal(error) {
  let message = error?.message;
  if (typeof message !== 'string' && typeof error?.getMessage === 'function') {
    try { message = await error.getMessage(); } catch (_) { /* Native exception unavailable. */ }
  }
  self.postMessage({ type: 'fatal', message: message || 'The browser JVM stopped unexpectedly.' });
}

self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'boot') {
      if (data.debuggerURL) importScripts(data.debuggerURL);
      debuggerRuntime = self.JavaTutorialDebugger;
      await cheerpjInit({ version: 8, status: 'none', natives: debuggerRuntime?.natives || {}, javaProperties: ['java.awt.headless=true'] });
      const classpath = data.assets.map(({ name, bytes }) => {
        const path = '/str/' + name;
        cheerpOSAddStringFile(path, new Uint8Array(bytes));
        return path;
      }).join(':');
      const library = await cheerpjRunLibrary(classpath);
      bridge = await library.sebook.javaeditor.Bridge;
      await bridge.initialize();
      self.postMessage({ type: 'ready' });
      return;
    }
    if (data.type === 'debug-command') { debuggerRuntime?.command(data.command); return; }
    if (data.type !== 'execute' || !bridge || busy) return;
    busy = true;
    const debugging = data.request.operation === 'debug';
    if (debugging) debuggerRuntime.start(self, data.request);
    const result = JSON.parse(await bridge.execute(JSON.stringify(data.request)));
    if (debugging) result.snapshots = debuggerRuntime.finish();
    self.postMessage({ type: 'result', id: data.id, result });
  } catch (error) { await fatal(error); }
  finally { if (data.type === 'execute') busy = false; }
};
