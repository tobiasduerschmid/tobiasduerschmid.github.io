/**
 * Pyodide Web Worker
 *
 * Runs Python code in a background thread using Pyodide (CPython compiled
 * to WebAssembly). Communication with the main thread uses postMessage:
 *
 * Inbound messages (main → worker):
 *   { type: 'run',      id, path }              Run a file by path (streams output)
 *   { type: 'runCode',  id, code, silent }       Run Python code string
 *   { type: 'write',    id, path, content }      Write a file to Pyodide FS
 *   { type: 'read',     id, path }               Read a file from Pyodide FS
 *
 * Outbound messages (worker → main):
 *   { type: 'ready' }                           Pyodide is initialised
 *   { type: 'loading', message }                Progress during init
 *   { type: 'stdout', text }                    Streamed stdout (non-silent runs)
 *   { type: 'stderr', text }                    Streamed stderr (non-silent runs)
 *   { type: 'run_done',    id, exitCode }        Execution finished
 *   { type: 'write_ok',   id }                   File written
 *   { type: 'write_error', id, message }         File write failed
 *   { type: 'read_ok',    id, content }          File content
 *   { type: 'read_error', id }                   File not found / unreadable
 */
'use strict';

// Pyodide v0.27.x — Python 3.12
importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.0/full/pyodide.js');

var pyodide = null;
var _running = false;

// ---- Initialisation ---------------------------------------------------------

self.postMessage({ type: 'loading', message: 'Loading Python runtime…' });

loadPyodide({
  indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/',
}).then(function (py) {
  pyodide = py;

  // Create /tutorial working directory
  try { pyodide.FS.mkdir('/tutorial'); } catch (e) { /* already exists */ }
  pyodide.FS.chdir('/tutorial');

  // Inject a helper available in all test/run contexts:
  //   __run_capture(path) → stdout as string (for output-checking tests)
  pyodide.runPython([
    'import sys, io',
    'def __run_capture(path):',
    '    buf = io.StringIO()',
    '    old = sys.stdout',
    '    sys.stdout = buf',
    '    try:',
    '        exec(open(path).read(), {"__name__": "__main__"})',
    '    finally:',
    '        sys.stdout = old',
    '    return buf.getvalue()',
  ].join('\n'));

  self.postMessage({ type: 'ready' });
}).catch(function (err) {
  self.postMessage({ type: 'error', message: 'Pyodide init failed: ' + err.message });
});

// ---- Message handler --------------------------------------------------------

self.onmessage = function (e) {
  var msg = e.data;
  if (!pyodide) {
    self.postMessage({ type: 'run_done', id: msg.id, exitCode: 1,
      error: 'Pyodide not ready yet' });
    return;
  }

  if (msg.type === 'run') {
    runFile(msg.id, msg.path, msg.args || []);
  } else if (msg.type === 'runCode') {
    runCode(msg.id, msg.code, !!msg.silent);
  } else if (msg.type === 'write') {
    writeFile(msg.id, msg.path, msg.content);
  } else if (msg.type === 'read') {
    readFile(msg.id, msg.path);
  }
};

// ---- Execution --------------------------------------------------------------

function runFile(id, path, args) {
  var code;
  try {
    code = pyodide.FS.readFile(path, { encoding: 'utf8' });
  } catch (err) {
    self.postMessage({ type: 'stderr', text: 'Cannot read file: ' + path + '\n' });
    self.postMessage({ type: 'run_done', id: id, exitCode: 1 });
    return;
  }
  
  var pyArgsStr = '[' + [path].concat(args || []).map(function(a) { 
    return '"' + (a || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'; 
  }).join(',') + ']';
  pyodide.runPython('import sys; sys.argv = ' + pyArgsStr);
  
  runCode(id, code, false);
}

function runCode(id, code, silent) {
  if (_running) {
    // Queue up after current run (simple: reject with busy signal)
    self.postMessage({ type: 'stderr', text: 'Already running — please wait.\n' });
    self.postMessage({ type: 'run_done', id: id, exitCode: 1 });
    return;
  }
  _running = true;

  if (silent) {
    pyodide.setStdout({ batched: function () {} });
    pyodide.setStderr({ batched: function () {} });
  } else {
    pyodide.setStdout({ batched: function (text) {
      self.postMessage({ type: 'stdout', text: text + '\n' });
    }});
    pyodide.setStderr({ batched: function (text) {
      self.postMessage({ type: 'stderr', text: text + '\n' });
    }});
  }

  pyodide.runPythonAsync(code)
    .then(function () {
      _running = false;
      self.postMessage({ type: 'run_done', id: id, exitCode: 0 });
    })
    .catch(function (err) {
      _running = false;
      var msg = err.type ? (err.type + ': ' + err.message) : String(err);
      if (!silent) {
        self.postMessage({ type: 'stderr', text: msg + '\n' });
      }
      self.postMessage({ type: 'run_done', id: id, exitCode: 1 });
    });
}

// ---- File I/O ---------------------------------------------------------------

function writeFile(id, path, content) {
  try {
    // Ensure parent directories exist
    var dir = path.substring(0, path.lastIndexOf('/'));
    if (dir) {
      var parts = dir.split('/').filter(Boolean);
      var cur = '';
      parts.forEach(function (p) {
        cur += '/' + p;
        try { pyodide.FS.mkdir(cur); } catch (e) { /* exists */ }
      });
    }
    pyodide.FS.writeFile(path, content, { encoding: 'utf8' });
    self.postMessage({ type: 'write_ok', id: id });
  } catch (err) {
    self.postMessage({ type: 'write_error', id: id, message: err.message });
  }
}

function readFile(id, path) {
  try {
    var content = pyodide.FS.readFile(path, { encoding: 'utf8' });
    self.postMessage({ type: 'read_ok', id: id, content: content });
  } catch (err) {
    self.postMessage({ type: 'read_error', id: id });
  }
}
