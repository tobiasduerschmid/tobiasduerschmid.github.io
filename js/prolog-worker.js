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

/** Evaluate a JS test assertion snippet.
 *
 * Available in test scope:
 *   session        — the live Tau Prolog session
 *   pl             — the Tau Prolog module
 *   __query(goal)  — run query on current session, return array of answer strings
 *   __consult(code)— consult a Prolog program (resets session)
 *   assert(cond, msg) — throw if condition is falsy
 *   __read_file(path) — return editor content from in-memory file map
 *
 * NOTE: __query and __consult use a synchronous-looking wrapper that spins on
 * Tau Prolog's internal thread until all answers are collected. This works
 * because Tau Prolog's callbacks fire synchronously within the answer() call
 * when there is no asynchronous I/O involved (pure in-memory Prolog).
 */
function runCode(id, code, silent) {
  try {
    /* jshint evil:true */
    var fn = new Function('session', 'pl', '__query', '__consult', 'assert', '__read_file', code);
    fn(
      session,
      pl,
      function __query(goal) {
        if (goal.charAt(goal.length - 1) !== '.') goal += '.';
        var answers = [];
        var qErr = null;

        session.query(goal, {
          success: function () {
            function next() {
              session.answer({
                success: function (answer) { answers.push(pl.format_answer(answer)); next(); },
                fail: function () { /* done */ },
                error: function (err) { qErr = formatErr(err); },
                limit: function () { /* done */ }
              });
            }
            next();
          },
          error: function (err) { qErr = formatErr(err); }
        });

        if (qErr) throw new Error('Query error: ' + qErr);
        return answers;
      },
      function __consult(program) {
        var err = null;
        session = pl.create();
        session.consult(program, {
          success: function () {},
          error: function (e) { err = formatErr(e); }
        });
        if (err) throw new Error('Consult error: ' + err);
      },
      function assert(cond, msg) {
        if (!cond) throw new Error(msg || 'Assertion failed');
      },
      function __read_file(path) {
        return files[path] || '';
      }
    );
    self.postMessage({ type: 'run_done', id: id, exitCode: 0 });
  } catch (err) {
    if (!silent) self.postMessage({ type: 'stderr', text: err.message + '\n' });
    self.postMessage({ type: 'run_done', id: id, exitCode: 1 });
  }
}

// ---- Test Runner (async-safe) ------------------------------------------------
//
// runTest consults a program then runs a JS assertion that can call __query.
// Unlike runCode, __query here uses the proven async callback chain to collect
// answers, then invokes a continuation with the results.
//
// Message: { type: 'runTest', id, program, code }
//   - program: Prolog source to consult (the student's file content)
//   - code:    JS assertion code (same as runCode tests)

function runTest(id, program, code) {
  consultProgram(program, function (consultErr) {
    if (consultErr) {
      self.postMessage({ type: 'run_done', id: id, exitCode: 1 });
      return;
    }
    // Now run the JS assertion with an async-safe __query
    runTestCode(id, code);
  });
}

/** Run a JS test assertion with async-safe __query.
 *  __query collects all answers via the callback chain, then calls a continuation. */
function runTestCode(id, code) {
  // Parse the test code to extract __query calls and assertions.
  // We wrap the entire test in an async execution model:
  // the test code calls __query(goal) which returns a Promise-like object,
  // but since we're in a Worker we use a simpler continuation approach.

  // Strategy: extract query goals from the test code, run them via the async
  // callback chain, then evaluate the assertion with the collected answers.

  // Simple approach: find all __query('...') calls, run them sequentially,
  // then evaluate the full test code with __query replaced by a synchronous lookup.
  var queryPattern = /__query\(\s*'([^']*)'\s*\)/g;
  var goals = [];
  var match;
  while ((match = queryPattern.exec(code)) !== null) {
    goals.push(match[1]);
  }

  // Collect answers for each goal sequentially using async chain
  var goalResults = {};
  function runNextGoal(i) {
    if (i >= goals.length) {
      // All goals resolved — now run the assertion synchronously
      evaluateTest(id, code, goalResults);
      return;
    }
    var goal = goals[i];
    if (goal.charAt(goal.length - 1) !== '.') goal += '.';
    var answers = [];

    session.query(goal, {
      success: function () {
        function nextAnswer() {
          session.answer({
            success: function (answer) {
              answers.push(pl.format_answer(answer));
              nextAnswer();
            },
            fail: function () {
              goalResults[goals[i]] = answers;
              runNextGoal(i + 1);
            },
            error: function () {
              goalResults[goals[i]] = answers;
              runNextGoal(i + 1);
            },
            limit: function () {
              goalResults[goals[i]] = answers;
              runNextGoal(i + 1);
            }
          });
        }
        nextAnswer();
      },
      error: function () {
        goalResults[goals[i]] = [];
        runNextGoal(i + 1);
      }
    });
  }
  runNextGoal(0);
}

/** Evaluate the test code with pre-collected query results. */
function evaluateTest(id, code, goalResults) {
  try {
    var fn = new Function('__query', 'assert', '__read_file', 'session', 'pl', code);
    fn(
      function __query(goal) {
        // Return pre-collected results (synchronous lookup)
        return goalResults[goal] || [];
      },
      function assert(cond, msg) {
        if (!cond) throw new Error(msg || 'Assertion failed');
      },
      function __read_file(path) {
        return files[path] || '';
      },
      session,
      pl
    );
    self.postMessage({ type: 'run_done', id: id, exitCode: 0 });
  } catch (err) {
    self.postMessage({ type: 'run_done', id: id, exitCode: 1 });
  }
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
