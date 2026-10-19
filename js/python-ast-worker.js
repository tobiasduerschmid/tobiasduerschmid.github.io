/**
 * Python source worker behind js/python-ast-service.js.
 *
 * 'analyze' returns the source model consumed by js/tutorial-refactorings.js
 * (Python's stdlib ast module). 'check' returns syntax errors and undefined
 * names (ast plus pyflakes). Both parse source; neither executes it.
 */
'use strict';

var PYODIDE_INDEX_URL = '/js/vendor/pyodide/0.27.0/';
importScripts(PYODIDE_INDEX_URL + 'pyodide.js');

var pyodideReady = Promise.all([
  loadPyodide({ indexURL: PYODIDE_INDEX_URL }).then(function (pyodide) {
    return pyodide.loadPackage('pyflakes').then(function () { return pyodide; });
  }),
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

var ENTRY_POINTS = { analyze: 'analyze_files', check: 'check_files' };

self.onmessage = function (event) {
  var msg = event.data || {};
  var entryPoint = ENTRY_POINTS[msg.type];
  if (!entryPoint) return;
  function reply(fields) {
    self.postMessage(Object.assign({ type: 'result', id: msg.id }, fields));
  }
  pyodideReady.then(function (pyodide) {
    pyodide.globals.set('__sebook_files_json', JSON.stringify(msg.files || []));
    reply({ ok: true, value: JSON.parse(pyodide.runPython(entryPoint + '(__sebook_files_json)')) });
  }).catch(function (err) {
    reply({ ok: false, error: err.message || String(err) });
  });
};
