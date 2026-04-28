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
 * Git (loaded lazily on first git* message):
 *   { type: 'gitInit',     id, dir }                          Bring up isomorphic-git on Pyodide FS
 *   { type: 'gitRun',      id, line, cwd }                    Tokenize + dispatch a typed command
 *   { type: 'gitGetState', id, dir }                          Returns {commits, branches, head, files}
 *   { type: 'gitListDir',  id, path }                         Listing for ls/pwd helpers
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
 *   { type: 'git_*',      id, ... }              Git replies (mirror message kind)
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

  // ANSI color: set the env vars libraries gate on so color output reaches
  // the xterm.js / OutputPanel terminal. These are set once at init; the
  // sys.stdout.isatty() patch needs to run after every setStdout call (see
  // runCode below) because setStdout installs a fresh writer each time.
  try {
    pyodide.runPython([
      'import os as _os',
      '_os.environ.setdefault("PY_COLORS", "1")',           // pytest
      '_os.environ.setdefault("FORCE_COLOR", "1")',         // rich, click, …
      '_os.environ.setdefault("CLICOLOR_FORCE", "1")',      // BSD-style tools
      '_os.environ.setdefault("CLICOLOR", "1")',
      '_os.environ.setdefault("TERM", "xterm-256color")',
      '_os.environ.setdefault("COLORTERM", "truecolor")',
    ].join('\n'));
  } catch (e) { /* best-effort */ }

  self.postMessage({ type: 'ready' });
}).catch(function (err) {
  self.postMessage({ type: 'error', message: 'Pyodide init failed: ' + err.message });
});

// ---- Message handler --------------------------------------------------------

// Time-travel debugger: lazy-loaded only when the main thread sends
// `enableDebugger` (which only happens on tutorials with `debugger: true` in
// YAML). The extension installs its own handlers for `runDebug`, `stepCmd`,
// `updateWatches`, etc. — when not loaded, those messages would be ignored
// by this base handler, which is fine because the main thread never sends
// them on non-debugger tutorials.
var _debuggerLoaded = false;
var _debuggerHandlers = null;   // installed by worker-extension.js when loaded

self.onmessage = function (e) {
  var msg = e.data;

  if (msg.type === 'enableDebugger') {
    if (!_debuggerLoaded) {
      try {
        // Cache-bust on every fresh worker so dev iteration on the debugger
        // module doesn't require manual SW unregistration. The worker is a
        // fresh instance per page load, so this only adds one fetch per load.
        importScripts('/js/debugger/worker-extension.js?v=' + Date.now());
        _debuggerLoaded = true;
      } catch (err) {
        self.postMessage({ type: 'debuggerError', message: 'Failed to load debugger extension: ' + err.message });
        return;
      }
    }
    self.postMessage({ type: 'debuggerReady' });
    return;
  }

  // Route debugger-protocol messages to the loaded extension. The extension
  // populates `_debuggerHandlers` (an object keyed by message type) when it
  // loads. If the user clicks Debug before `enableDebugger` round-trips, the
  // main thread waits for `debuggerReady` first.
  if (_debuggerHandlers && _debuggerHandlers[msg.type]) {
    _debuggerHandlers[msg.type](msg);
    return;
  }

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
  } else if (msg.type === 'gitInit'   || msg.type === 'gitRun' ||
             msg.type === 'gitGetState' || msg.type === 'gitListDir') {
    _routeGitMessage(msg);
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

  // setStdout/setStderr install fresh writers without the isatty=True patch,
  // so libraries (rich, click, colorama, pytest) would default to no color
  // and strip ANSI codes. Re-patch the new sys.stdout/stderr to advertise
  // as TTYs.
  try {
    pyodide.runPython([
      'import sys as _sys',
      'try: _sys.stdout.isatty = lambda: True',
      'except Exception: pass',
      'try: _sys.stderr.isatty = lambda: True',
      'except Exception: pass',
    ].join('\n'));
  } catch (e) { /* best-effort */ }

  pyodide.loadPackagesFromImports(code)
    .then(function () {
      try {
        pyodide.runPython([
          'import sys as _sys',
          'for _m in list(_sys.modules):',
          '    _f = getattr(_sys.modules[_m], "__file__", "") or ""',
          '    if "/tutorial/" in _f: del _sys.modules[_m]',
          'for _k in list(globals().keys()):',
          '    if _k not in ["__name__", "__doc__", "__package__", "__loader__", "__spec__", "__annotations__", "__builtins__", "__run_capture", "sys", "io", "_sys", "_m", "_f", "_k"]:',
          '        del globals()[_k]'
        ].join('\n'));
      } catch (err) { /* Safely ignore internal wipe errors */ }

      return pyodide.runPythonAsync(code);
    })
    .then(function () {
      _running = false;
      self.postMessage({ type: 'run_done', id: id, exitCode: 0 });
    })
    .catch(function (err) {
      _running = false;
      // SystemExit is a clean exit signal, not an error. Recognize it and
      // suppress the traceback. Two forms to detect:
      //   1. err.type === 'SystemExit' (pyodide PythonError exposes the
      //      raised Python class name on .type).
      //   2. "SystemExit: <n>" anywhere in the message (fallback for older
      //      pyodide builds that don't populate .type).
      var msg = err && err.message ? err.message : String(err);
      var isSystemExit = (err && err.type === 'SystemExit') ||
                         /(^|\n|\b)SystemExit\b/.test(msg);
      if (isSystemExit) {
        var codeMatch = /SystemExit\s*:\s*(\d+)/.exec(msg);
        var exitCode = codeMatch ? parseInt(codeMatch[1], 10) : 0;
        self.postMessage({ type: 'run_done', id: id, exitCode: exitCode });
        return;
      }
      var fullMsg = err.type ? (err.type + ': ' + msg) : msg;
      if (!silent) {
        self.postMessage({ type: 'stderr', text: fullMsg + '\n' });
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

// ---- Git module (lazy-loaded) ----------------------------------------------
//
// Git support lives in /js/pyodide-git.js — a separate worker module loaded
// only when a tutorial actually uses git. This keeps Python-only tutorials
// from paying the parse/init cost of iso-git + the ~3000 lines of dispatch
// logic. The module is fetched via `importScripts` on the first git*
// message and then exposes four entry points on `self`: gitInit, gitRun,
// gitGetState, gitListDir.

var _gitModuleLoaded = false;
var _gitModuleLoadError = null;

function _ensureGitModuleLoaded() {
  if (_gitModuleLoaded) return Promise.resolve();
  if (_gitModuleLoadError) return Promise.reject(_gitModuleLoadError);
  try {
    // Cache-bust on every fresh worker so dev iteration on the git module
    // doesn't require manual SW unregistration. The worker is a fresh
    // instance per page load, so this only adds one fetch per load.
    importScripts('/js/pyodide-git.js?v=' + Date.now());
    _gitModuleLoaded = true;
    return Promise.resolve();
  } catch (err) {
    _gitModuleLoadError = err;
    return Promise.reject(err);
  }
}

function _routeGitMessage(msg) {
  _ensureGitModuleLoaded().then(function () {
    if (msg.type === 'gitInit')          self.gitInit(msg.id, msg.dir);
    else if (msg.type === 'gitRun')      self.gitRun(msg.id, msg.line, msg.cwd, msg.dir);
    else if (msg.type === 'gitGetState') self.gitGetState(msg.id, msg.dir);
    else if (msg.type === 'gitListDir')  self.gitListDir(msg.id, msg.path);
  }).catch(function (err) {
    var emsg = 'Failed to load git module: ' + (err && err.message || err);
    // Use the matching error reply type so the main thread surfaces it.
    var replyType = msg.type === 'gitInit'      ? 'git_init_error'
                  : msg.type === 'gitGetState'  ? 'git_state_error'
                  : msg.type === 'gitListDir'   ? 'git_listdir'
                                                : 'git_run_done';
    var payload = { type: replyType, id: msg.id, message: emsg, error: emsg };
    if (replyType === 'git_run_done') { payload.stdout = ''; payload.stderr = emsg + '\n'; payload.exitCode = 1; payload.mutatedPaths = []; }
    if (replyType === 'git_listdir') { payload.path = msg.path; payload.entries = []; }
    self.postMessage(payload);
  });
}
