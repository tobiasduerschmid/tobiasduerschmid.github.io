/* One compilation per disposable worker; cancellation is owned by the client. */
'use strict';
importScripts('compiler-lab-core.js');
self.onmessage = function (event) {
  try {
    self.postMessage(self.CompilerLabCore.compile(event.data));
  } catch (error) {
    self.postMessage({ ok: false, tokens: [], parseTree: null, ast: null,
      parseTrees: [], asts: [], astParseTreeIndices: [], incomplete: true,
      diagnostics: [{ stage: 'execution', message: error.message || 'Compilation failed.' }] });
  }
};
