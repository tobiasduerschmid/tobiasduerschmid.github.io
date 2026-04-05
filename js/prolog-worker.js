/**
 * Tau Prolog Web Worker
 *
 * Runs Prolog entirely in a background thread using Tau Prolog (ISO Prolog
 * interpreter written in pure JavaScript). Communication with the main thread
 * uses postMessage — no network access after the initial CDN load.
 *
 * Inbound messages (main → worker):
 *   { type: 'run',      id, path, query }        Consult a .pl file, then run query
 *   { type: 'runProlog',id, code, silent }        Consult a Prolog string directly
 *   { type: 'runCode',  id, code, silent }        Evaluate a JS test assertion snippet
 *   { type: 'write',    id, path, content }       Store a file in the in-memory file map
 *   { type: 'read',     id, path }                Return a stored file's content
 *   { type: 'reset',    id }                      Destroy and recreate the session
 *
 * Outbound messages (worker → main):
 *   { type: 'ready' }                             Session ready for queries
 *   { type: 'loading', message }                  Progress text during initialisation
 *   { type: 'stdout',  text }                     Plain-text output
 *   { type: 'stderr',  text }                     Error output
 *   { type: 'run_done',id, exitCode }             Command finished (0 = ok, 1 = error)
 *   { type: 'write_ok',id }                       File stored
 *   { type: 'write_error', id, message }          File store failed
 *   { type: 'read_ok', id, content }              File content
 *   { type: 'read_error', id }                    File not found
 *   { type: 'error',   message }                  Fatal initialisation error
 */

// Tau Prolog's IIFE exports via `window.pl = pl` and internally references
// `document` (for URL-based consult). Web Workers have neither, so shim both.
var window = self;
var document = {
  location: { href: '' },
  getElementById: function () { return null; },
  getElementsByTagName: function () { return []; },
  createElement: function () { return {}; },
};

// Intercept console.log BEFORE loading Tau Prolog.
// In browser mode, Tau Prolog's write/1 and nl/0 call console.log(char).
// We capture these and forward them to the main thread as stdout.
var _writeBuffer = '';
var _writeSilent = false;
var _origLog = console.log;
console.log = function () {
  if (_writeSilent) return;
  var text = Array.prototype.slice.call(arguments).join('');
  _writeBuffer += text;
};

/** Flush any buffered write/1 output to the main thread. */
function flushWriteBuffer() {
  if (_writeBuffer.length > 0) {
    self.postMessage({ type: 'stdout', text: _writeBuffer });
    _writeBuffer = '';
  }
}

// Tau Prolog — ISO Prolog interpreter in pure JavaScript
importScripts('https://cdn.jsdelivr.net/npm/tau-prolog@0.3.4/modules/core.js');
importScripts('https://cdn.jsdelivr.net/npm/tau-prolog@0.3.4/modules/lists.js');

var session = null;   // Tau Prolog session
var files   = {};     // In-memory file map: path → content string
var MAX_ANSWERS = 100; // Safety limit on solutions per query

// ---- Initialisation ----------------------------------------------------------

self.postMessage({ type: 'loading', message: 'Loading Prolog runtime\u2026' });

try {
  session = pl.create();
  self.postMessage({ type: 'ready' });
} catch (err) {
  self.postMessage({ type: 'error', message: 'Tau Prolog init failed: ' + (err.message || err) });
}

// ---- Message handler ---------------------------------------------------------

self.onmessage = function (e) {
  var msg = e.data;
  if (!session) {
    self.postMessage({ type: 'run_done', id: msg.id, exitCode: 1,
      error: 'Prolog session not ready yet' });
    return;
  }
  if      (msg.type === 'run')        runFile(msg.id, msg.path, msg.query || '');
  else if (msg.type === 'runProlog')  runProlog(msg.id, msg.code, !!msg.silent);
  else if (msg.type === 'runCode')    runCode(msg.id, msg.code, !!msg.silent);
  else if (msg.type === 'runTest')    runTest(msg.id, msg.program, msg.code);
  else if (msg.type === 'write')      writeFile(msg.id, msg.path, msg.content);
  else if (msg.type === 'read')       readFile(msg.id, msg.path);
  else if (msg.type === 'reset')      resetSession(msg.id);
};

// ---- Helpers -----------------------------------------------------------------

function formatErr(err) {
  if (err && typeof err === 'object') {
    try { return pl.format_answer(err); } catch (e) { /* fall through */ }
    if (err.args && err.args.length > 0) return String(err.args[0]);
  }
  return String(err);
}

// ---- Prolog Execution --------------------------------------------------------
//
// Tau Prolog's API is entirely callback-based. The callbacks fire asynchronously
// (on the next event loop tick), so all operations must be chained via callbacks.
// Never rely on return values from consult/query/answer.

/** Consult code into a fresh session, then call onDone(err). */
function consultProgram(code, onDone) {
  session = pl.create();
  session.consult(code, {
    success: function () { onDone(null); },
    error:   function (err) { onDone('Consult error: ' + formatErr(err)); }
  });
}

/** Run a query on the current session and emit solutions, then call onDone. */
function runQuery(id, query, silent, onDone) {
  session.query(query, {
    success: function () {
      collectAnswers(id, silent, false, 0, onDone);
    },
    error: function (err) {
      if (!silent) self.postMessage({ type: 'stderr', text: 'Query error: ' + formatErr(err) + '\n' });
      onDone(1);
    }
  });
}

/** Recursively collect answers from session.answer(). */
function collectAnswers(id, silent, found, count, onDone) {
  if (count >= MAX_ANSWERS) {
    if (!silent) self.postMessage({ type: 'stdout', text: '... (limit of ' + MAX_ANSWERS + ' answers reached)\n' });
    onDone(0);
    return;
  }
  _writeSilent = silent;
  session.answer({
    success: function (answer) {
      if (!silent) {
        flushWriteBuffer();
        self.postMessage({ type: 'stdout', text: pl.format_answer(answer) + '\n' });
      }
      collectAnswers(id, silent, true, count + 1, onDone);
    },
    fail: function () {
      if (!silent) {
        flushWriteBuffer();
        if (!found) self.postMessage({ type: 'stdout', text: 'false.\n' });
      }
      onDone(found ? 0 : 1);
    },
    error: function (err) {
      if (!silent) {
        flushWriteBuffer();
        self.postMessage({ type: 'stderr', text: 'Runtime error: ' + formatErr(err) + '\n' });
      }
      onDone(1);
    },
    limit: function () {
      if (!silent) {
        flushWriteBuffer();
        self.postMessage({ type: 'stderr', text: 'Inference limit reached.\n' });
      }
      onDone(1);
    }
  });
}

/** Read a stored .pl file, consult it, then run the given query. */
function runFile(id, path, query) {
  var content = files[path];
  if (content === undefined) {
    self.postMessage({ type: 'stderr', text: 'File not found: ' + path + '\n' });
    self.postMessage({ type: 'run_done', id: id, exitCode: 1 });
    return;
  }

  consultProgram(content, function (consultErr) {
    if (consultErr) {
      self.postMessage({ type: 'stderr', text: consultErr + '\n' });
      self.postMessage({ type: 'run_done', id: id, exitCode: 1 });
      return;
    }

    query = (query || '').trim();
    if (!query) {
      self.postMessage({ type: 'stdout', text: 'Program loaded.\n' });
      self.postMessage({ type: 'run_done', id: id, exitCode: 0 });
      return;
    }

    if (query.charAt(query.length - 1) !== '.') query += '.';

    runQuery(id, query, false, function (exitCode) {
      self.postMessage({ type: 'run_done', id: id, exitCode: exitCode });
    });
  });
}

/** Consult a Prolog string directly (for setup_commands). */
function runProlog(id, code, silent) {
  consultProgram(code, function (err) {
    if (err) {
      if (!silent) self.postMessage({ type: 'stderr', text: err + '\n' });
      self.postMessage({ type: 'run_done', id: id, exitCode: 1 });
      return;
    }
    self.postMessage({ type: 'run_done', id: id, exitCode: 0 });
  });
}

// ---- Async Test Runner -------------------------------------------------------

/** Wraps Tau Prolog query execution in a Promise with MAX_ANSWERS cutoff. */
function __queryAsync(goal) {
  return new Promise(function(resolve, reject) {
    if (goal.charAt(goal.length - 1) !== '.') goal += '.';
    var answers = [];
    var qErr = null;

    session.query(goal, {
      success: function () {
        function nextAnswer() {
          if (answers.length >= MAX_ANSWERS) {
            resolve(answers);
            return;
          }
          session.answer({
            success: function (answer) {
              answers.push(pl.format_answer(answer));
              nextAnswer();
            },
            fail: function () { resolve(answers); },
            error: function (err) { reject(new Error(formatErr(err))); },
            limit: function () { resolve(answers); }
          });
        }
        nextAnswer();
      },
      error: function (err) { reject(new Error(formatErr(err))); }
    });
  });
}

/** Wraps Tau Prolog consult execution in a Promise. */
function __consultAsync(program) {
  return new Promise(function(resolve, reject) {
    session = pl.create();
    session.consult(program, {
      success: function () { resolve(); },
      error: function (err) { reject(new Error(formatErr(err))); }
    });
  });
}

/** Compiles and evaluates JS assertion code natively as an AsyncFunction. */
function runAsyncCode(id, code, silent) {
  // Transpile standard synchronous test semantics to await their Promises
  var asyncCode = code.replace(/\b__query\s*\(/g, 'await __query(')
                      .replace(/\b__consult\s*\(/g, 'await __consult(');
  
  var AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
  try {
    /* jshint evil:true */
    var fn = new AsyncFunction('session', 'pl', '__query', '__consult', 'assert', '__read_file', asyncCode);
    fn(
      session,
      pl,
      __queryAsync,
      __consultAsync,
      function assert(cond, msg) {
        if (!cond) throw new Error(msg || 'Assertion failed');
      },
      function __read_file(path) {
        return files[path] || '';
      }
    ).then(function() {
      self.postMessage({ type: 'run_done', id: id, exitCode: 0 });
    }).catch(function(err) {
      if (!silent) self.postMessage({ type: 'stderr', text: err.message + '\n' });
      self.postMessage({ type: 'run_done', id: id, exitCode: 1 });
    });
  } catch (err) {
    if (!silent) self.postMessage({ type: 'stderr', text: err.message + '\n' });
    self.postMessage({ type: 'run_done', id: id, exitCode: 1 });
  }
}

function runCode(id, code, silent) {
  runAsyncCode(id, code, silent);
}

function runTest(id, program, code) {
  consultProgram(program, function (consultErr) {
    if (consultErr) {
      self.postMessage({ type: 'stderr', text: consultErr + '\n' });
      self.postMessage({ type: 'run_done', id: id, exitCode: 1 });
      return;
    }
    runAsyncCode(id, code, false);
  });
}

// ---- Session Reset -----------------------------------------------------------

function resetSession(id) {
  try {
    session = pl.create();
    self.postMessage({ type: 'run_done', id: id, exitCode: 0 });
  } catch (err) {
    self.postMessage({ type: 'run_done', id: id, exitCode: 1, error: err.message });
  }
}

// ---- In-memory File I/O ------------------------------------------------------

function writeFile(id, path, content) {
  files[path] = content;
  self.postMessage({ type: 'write_ok', id: id });
}

function readFile(id, path) {
  if (Object.prototype.hasOwnProperty.call(files, path)) {
    self.postMessage({ type: 'read_ok', id: id, content: files[path] });
  } else {
    self.postMessage({ type: 'read_error', id: id });
  }
}
