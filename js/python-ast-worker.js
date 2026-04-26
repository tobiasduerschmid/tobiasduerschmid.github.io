/**
 * Python AST analysis worker for tutorial refactorings.
 *
 * Uses Python's stdlib ast module through Pyodide and returns the shared source
 * model consumed by js/tutorial-refactorings.js.
 */
'use strict';

importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.0/full/pyodide.js');

var pyodideReady = Promise.all([
  loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/' }),
  fetch(new URL('python-ast-analyzer.py', self.location.href).href).then(function (response) {
    if (!response.ok) throw new Error('Unable to load Python AST analyzer.');
    return response.text();
  }),
]).then(function (values) {
  var pyodide = values[0];
  var analyzerSource = values[1];
  pyodide.runPython(analyzerSource);
  return pyodide;
});

self.onmessage = function (event) {
  var msg = event.data || {};
  if (msg.type !== 'analyze') return;
  pyodideReady.then(function (pyodide) {
    try {
      pyodide.globals.set('__sebook_files_json', JSON.stringify(msg.files || []));
      var raw = pyodide.runPython('analyze_files(__sebook_files_json)');
      self.postMessage({ type: 'analysis', id: msg.id, ok: true, analysis: JSON.parse(raw) });
    } catch (err) {
      self.postMessage({ type: 'analysis', id: msg.id, ok: false, error: err.message || String(err) });
    }
  }).catch(function (err) {
    self.postMessage({ type: 'analysis', id: msg.id, ok: false, error: err.message || String(err) });
  });
};
