/**
 * Page-wide client for js/python-ast-worker.js (Python's ast module and
 * pyflakes in Pyodide). Refactorings and source checks share one worker per
 * page. Both operations parse source; neither executes learner code.
 *
 * analyze([{ filename, content }]) resolves to
 *   { files: { [filename]: sourceModel },
 *     errors: [{ filename, message, line?, column?, endLine?, endColumn? }] }
 * check([{ filename, content }]) resolves to
 *   { problems: [{ filename, kind: 'syntax' | 'semantic', message,
 *                  line, column, endLine, endColumn }] }
 * Positions are 1-based; the end is exclusive.
 */
(function (global) {
  'use strict';

  var WORKER_URL = new URL('python-ast-worker.js', document.currentScript.src).href;
  var TIMEOUT_MS = 60000;
  var worker = null;
  var nextId = 1;
  var pending = {};
  var caches = {};

  function ensureWorker() {
    if (worker) return worker;
    worker = new Worker(WORKER_URL);
    worker.onmessage = function (event) {
      var message = event.data || {};
      var request = message.type === 'result' && pending[message.id];
      if (!request) return;
      clearTimeout(request.timer);
      delete pending[message.id];
      if (message.ok) request.resolve(message.value);
      else request.reject(new Error(message.error || 'Python source analysis failed.'));
    };
    worker.onerror = function (event) {
      var error = new Error(event.message || 'Python AST worker failed.');
      Object.keys(pending).forEach(function (id) {
        clearTimeout(pending[id].timer);
        pending[id].reject(error);
      });
      pending = {};
    };
    return worker;
  }

  function request(operation, files) {
    var sources = files.map(function (file) {
      return { filename: file.filename, content: file.content || '' };
    });
    // Exact keys avoid returning another source's result after a hash collision.
    var key = JSON.stringify(sources);
    var cache = caches[operation];
    if (cache && cache.key === key) return Promise.resolve(cache.value);
    var id = nextId++;
    return new Promise(function (resolve, reject) {
      pending[id] = {
        resolve: function (value) {
          caches[operation] = { key: key, value: value };
          resolve(value);
        },
        reject: reject,
        timer: setTimeout(function () {
          delete pending[id];
          reject(new Error('Python source analysis timed out.'));
        }, TIMEOUT_MS)
      };
      ensureWorker().postMessage({ type: operation, id: id, files: sources });
    });
  }

  global.SEBookPythonAst = {
    analyze: function (files) { return request('analyze', files); },
    check: function (files) { return request('check', files); }
  };
})(window);
