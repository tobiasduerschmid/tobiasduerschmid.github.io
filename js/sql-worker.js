/**
 * SQL.js Web Worker
 *
 * Runs SQLite entirely in a background thread using sql.js (SQLite C compiled
 * to WebAssembly via Emscripten). Communication with the main thread uses
 * postMessage — the database lives in Wasm linear memory and never touches
 * the network after the initial load.
 *
 * Inbound messages (main → worker):
 *   { type: 'run',    id, path }              Execute a .sql file; stream table output
 *   { type: 'runSQL', id, sql,  silent }       Execute a SQL string directly
 *   { type: 'runCode',id, code, silent }       Evaluate a JS test assertion snippet
 *   { type: 'write',  id, path, content }      Store a file in the in-memory file map
 *   { type: 'read',   id, path }               Return a stored file's content
 *   { type: 'reset',  id }                     Destroy and recreate the database
 *
 * Outbound messages (worker → main):
 *   { type: 'ready' }                          Database ready for queries
 *   { type: 'loading', message }               Progress text during initialisation
 *   { type: 'stdout',  text }                  Plain-text output (DDL/DML feedback)
 *   { type: 'stderr',  text }                  Error output
 *   { type: 'table',   columns, rows }         SELECT result set
 *   { type: 'run_done',id, exitCode }          Command finished (0 = ok, 1 = error)
 *   { type: 'write_ok',id }                    File stored
 *   { type: 'write_error', id, message }       File store failed
 *   { type: 'read_ok', id, content }           File content
 *   { type: 'read_error', id }                 File not found
 *   { type: 'error',   message }               Fatal initialisation error
 */
'use strict';

// sql.js — SQLite compiled to WebAssembly via Emscripten (v1.10.3)
importScripts('https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/sql-wasm.js');

var SQL_CLASS = null;   // SQL.js constructor, captured after init
var db        = null;   // Active SQL.Database instance
var files     = {};     // In-memory file map: path → content string

// ---- Initialisation ----------------------------------------------------------

self.postMessage({ type: 'loading', message: 'Loading SQL runtime\u2026' });

initSqlJs({
  // Tell Emscripten where to fetch the companion .wasm binary
  locateFile: function (filename) {
    return 'https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/' + filename;
  },
}).then(function (SQL) {
  SQL_CLASS = SQL;
  db = new SQL.Database();
  self.postMessage({ type: 'ready' });
}).catch(function (err) {
  self.postMessage({ type: 'error', message: 'sql.js init failed: ' + (err.message || err) });
});

// ---- Message handler ---------------------------------------------------------

self.onmessage = function (e) {
  var msg = e.data;
  if (!db) {
    self.postMessage({ type: 'run_done', id: msg.id, exitCode: 1,
      error: 'Database not ready yet' });
    return;
  }
  if      (msg.type === 'run')     runFile(msg.id, msg.path);
  else if (msg.type === 'runSQL')  runSQL(msg.id, msg.sql,  !!msg.silent);
  else if (msg.type === 'runCode') runCode(msg.id, msg.code, !!msg.silent);
  else if (msg.type === 'write')   writeFile(msg.id, msg.path, msg.content);
  else if (msg.type === 'read')    readFile(msg.id, msg.path);
  else if (msg.type === 'reset')   resetDB(msg.id);
};

// ---- SQL Execution -----------------------------------------------------------

/** Read a stored .sql file and execute it as SQL. */
function runFile(id, path) {
  var content = files[path];
  if (content === undefined) {
    self.postMessage({ type: 'stderr', text: 'File not found: ' + path + '\n' });
    self.postMessage({ type: 'run_done', id: id, exitCode: 1 });
    return;
  }
  runSQL(id, content, false);
}

/** Execute a SQL string.  SELECT results are emitted as 'table' messages;
 *  DDL/DML success emits a brief 'stdout' status line. */
function runSQL(id, sql, silent) {
  try {
    // Split on semicolons but ignore empty statements
    var stmts = sql.split(';').map(function (s) { return s.trim(); })
                              .filter(function (s) { return s.length > 0; });

    stmts.forEach(function (stmt) {
      var results = db.exec(stmt);
      if (!silent) {
        if (results && results.length > 0) {
          // Query returned rows — emit as a table
          results.forEach(function (res) {
            self.postMessage({ type: 'table', columns: res.columns, rows: res.values });
          });
        } else {
          // DDL / DML — report rows affected
          var changed = db.getRowsModified();
          var feedback = changed > 0
            ? 'OK \u2014 ' + changed + ' row' + (changed === 1 ? '' : 's') + ' affected\n'
            : 'OK\n';
          self.postMessage({ type: 'stdout', text: feedback });
        }
      }
    });

    self.postMessage({ type: 'run_done', id: id, exitCode: 0 });
  } catch (err) {
    if (!silent) {
      self.postMessage({ type: 'stderr', text: 'Error: ' + err.message + '\n' });
    }
    self.postMessage({ type: 'run_done', id: id, exitCode: 1 });
  }
}

/** Evaluate a JS test assertion snippet in a sandboxed function.
 *
 * Available in test scope:
 *   db             — the live SQL.Database instance
 *   __run_query(sql) — execute SQL, return rows as [{col: val}, ...]
 *   __exec(sql)    — execute SQL, ignore results (for setup within a test)
 *   assert(cond, msg) — throw if condition is falsy
 *   __read_file(path) — return the editor content of a file (from the in-memory file map)
 */
function runCode(id, code, silent) {
  try {
    /* jshint evil:true */
    var fn = new Function('db', '__run_query', '__exec', 'assert', '__read_file', code);
    fn(
      db,
      function __run_query(sql) {
        var res = db.exec(sql);
        if (!res || res.length === 0) return [];
        var cols = res[0].columns;
        return res[0].values.map(function (row) {
          var obj = {};
          cols.forEach(function (col, i) { obj[col] = row[i]; });
          return obj;
        });
      },
      function __exec(sql) { db.run(sql); },
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

// ---- Database Reset ----------------------------------------------------------

function resetDB(id) {
  try {
    if (db) { db.close(); db = null; }
    db = new SQL_CLASS.Database();
    self.postMessage({ type: 'run_done', id: id, exitCode: 0 });
  } catch (err) {
    self.postMessage({ type: 'run_done', id: id, exitCode: 1, error: err.message });
  }
}

// ---- In-memory File I/O -----------------------------------------------------

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
