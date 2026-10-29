const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repositoryRoot = path.resolve(__dirname, '../../..');
const runtimeDirectory = path.join(repositoryRoot, 'js/vendor/pyodide/0.27.0');

// Adapt browser transport and local asset URLs only. The production worker
// executes its ordinary run/write protocol against the actual bundled CPython.
const context = vm.createContext({
  console: { log() {}, info() {}, warn() {}, error() {} },
  postMessage: message => process.send(message),
  importScripts(url) {
    assert.equal(url, '/js/vendor/pyodide/0.27.0/pyodide.js');
    const { loadPyodide } = require(path.join(runtimeDirectory, 'pyodide.js'));
    context.loadPyodide = options => loadPyodide({
      ...options,
      indexURL: runtimeDirectory,
      stdout() {},
      stderr() {},
    });
  },
});
context.self = context;
vm.runInContext(fs.readFileSync(path.join(repositoryRoot, 'js/pyodide-worker.js'), 'utf8'), context);
process.on('message', data => context.onmessage({ data }));
