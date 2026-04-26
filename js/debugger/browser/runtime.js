/**
 * Time-travel debugger — browser-backend runtime.
 *
 * Runs INSIDE a Web Worker spawned by BrowserChannel. (We can't use a window /
 * iframe here because `Atomics.wait` only works on workers — the main thread
 * is forbidden from blocking.)
 *
 * Architecture:
 *   - Parent posts an `init` message with the SAB + user code + breakpoints.
 *   - We `importScripts` acorn from the local instrument helper which fetches
 *     it from CDN (cross-origin, opt-in via classic-script semantics).
 *   - We instrument the code (insert `__ttd.onLine(file, line, scopeFn)` before
 *     every statement) and run it via `new Function(...)`.
 *   - On each `onLine` we capture state and decide whether to pause.
 *   - Pause = postMessage `paused` to parent + `Atomics.wait` until parent
 *     writes a command into the SAB.
 *
 * Stepping codes mirror the rest of the system:
 *   1=continue, 2=stepInto, 3=stepOver, 4=stepOut, 5=stop, 6=sync
 */

'use strict';

// Bump to make stale-cache issues obvious in the console.
var TTD_BROWSER_VERSION = '0.2.1-worker';

// ---- SAB layout (same as worker-extension.js / node-channel.js) -------
var SAB_HEADER_BYTES = 32;
var WATCH_REGION_BYTES = 32 * 1024;
var BPS_REGION_BYTES = 32 * 1024;
var EDITS_REGION_BYTES = 32 * 1024;
var WATCH_OFF = SAB_HEADER_BYTES;
var BPS_OFF = WATCH_OFF + WATCH_REGION_BYTES;
var EDITS_OFF = BPS_OFF + BPS_REGION_BYTES;
var SLOT_CMD = 0;
var SLOT_WATCHES_DIRTY = 1;
var SLOT_BPS_DIRTY = 2;
var SLOT_EDITS_DIRTY = 3;
var SLOT_WATCHES_LEN = 4;
var SLOT_BPS_LEN = 5;
var SLOT_EDITS_LEN = 6;

var i32 = null, u8 = null;
var watches = [];
var breakpoints = new Map();   // 'file:line' -> {condition?}
var opts = {};
var snapshotDepth = 3;
var maxHistory = 50000;
var totalSnapshots = 0;
var snapshotBuffer = [];
var capWarned = false;
var stopFlag = false;
var pendingOverrides = [];
var appliedOverrides = new Set();
var oidCounter = 0;
var oidMap = new WeakMap();
var callIdCounter = 0;
var stack = [];   // [{function, file, line, callId, scopeFn}]
var userMode = null;
var stepBaseDepth = 0;
var TEXT_DECODER = new TextDecoder();
var TEXT_ENCODER = new TextEncoder();

function send(msg) { self.postMessage({ __ttd: true, payload: msg }); }
function log(m) { send({ type: 'log', msg: '[ttd-browser] ' + m }); }

// ---- Init handshake ---------------------------------------------------

self.addEventListener('message', function (e) {
  if (!e.data || !e.data.__ttd_init) return;
  var cfg = e.data;
  i32 = new Int32Array(cfg.sab);
  u8 = new Uint8Array(cfg.sab);
  watches = cfg.watches || [];
  opts = cfg.options || {};
  snapshotDepth = opts.snapshot_depth || 3;
  maxHistory = opts.max_history || 50000;
  pendingOverrides = cfg.overrides || [];
  (cfg.breakpoints || []).forEach(function (bp) {
    breakpoints.set(bp.file + ':' + bp.line, { condition: bp.condition || null });
  });
  log('init: file=' + cfg.entry + ' watches=' + JSON.stringify(watches));
  bootRun(cfg.entry, cfg.code, cfg.files || {}, cfg.args || []);
});

send({ type: 'log', msg: '[ttd-browser] runtime v' + TTD_BROWSER_VERSION + ' loaded; awaiting init' });

// ---- Bootstrap: load acorn, instrument, run -------------------------

function bootRun(entryFile, code, files, args) {
  log('bootRun begin: entry=' + entryFile + ' codeLen=' + (code || '').length + ' breakpoints=' + breakpoints.size);
  loadAcorn().then(function () {
    log('acorn ready; instrumenting…');
    var instrumented;
    try {
      instrumented = self.__ttdInstrument(code, entryFile);
    } catch (e) {
      send({ type: 'debugComplete', exitCode: 1, error: 'Parse error: ' + e.message });
      return;
    }
    log('instrumented; starting execution');

    // Expose user-program args
    self.process = self.process || {};
    self.process.argv = ['node', entryFile].concat(args || []);

    setupNodeMocks(files);

    // Wire console output back to parent so prints appear in the Output panel.
    ['log', 'info', 'warn', 'error'].forEach(function (m) {
      var orig = console[m].bind(console);
      console[m] = function () {
        var parts = Array.prototype.slice.call(arguments).map(function (v) {
          return typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v);
        });
        send({ type: 'stdout', text: parts.join(' ') + '\n' });
        orig.apply(console, arguments);
      };
    });

    // Globals exposed to instrumented code.
    self.__ttd = {
      onLine: onLine,
      onCall: onCall,
      onReturn: onReturn,
    };
    // Run!
    try {
      var fn = new Function(instrumented);
      fn();
      send({ type: 'debugComplete', exitCode: 0 });
    } catch (err) {
      if (err && err.message === '__ttd_stop__') {
        send({ type: 'debugComplete', exitCode: 0 });
        return;
      }
      send({ type: 'log', msg: '[ttd-browser] uncaught: ' + (err && err.stack || err) });
      send({ type: 'debugComplete', exitCode: 1, error: String(err && err.message || err) });
    }
  }).catch(function (err) {
    send({ type: 'debugComplete', exitCode: 1, error: 'Failed to load acorn: ' + err.message });
  });
}

// ---- Acorn loader (worker-friendly: importScripts, no CSS / DOM) ---

function loadAcorn() {
  return new Promise(function (resolve, reject) {
    if (self.__ttdInstrument) return resolve();
    try {
      // Acorn ships UMD; in a worker context it attaches to `self`.
      importScripts('https://cdn.jsdelivr.net/npm/acorn@8.14.0/dist/acorn.min.js');
      // Now load our instrumenter (same-origin) which expects `acorn` global.
      importScripts('/js/debugger/browser/instrument.js');
    } catch (e) {
      return reject(e);
    }
    if (self.__ttdInstrument) resolve();
    else reject(new Error('instrument.js loaded but __ttdInstrument not exposed'));
  });
}

// ---- Node-style module shim (mirrors _runBrowserCode's sandbox) ---

function setupNodeMocks(files) {
  // Bucketize files: anything ending in .js is a require-able module; the
  // rest is mock filesystem content.
  var jsFiles = {}, fsFiles = {};
  Object.keys(files || {}).forEach(function (path) {
    var bare = path.replace(/^\/tutorial\//, '').replace(/^\//, '');
    if (/\.js$/.test(bare)) jsFiles[bare] = files[path];
    else fsFiles[bare] = files[path];
  });
  var moduleCache = {};
  var serverHandler = null;

  function matchRoute(pat, url) {
    if (!pat || pat === '*') return {};
    var pp = pat.split('/'), up = url.split('/');
    if (pp.length !== up.length) return null;
    var prms = {};
    for (var i = 0; i < pp.length; i++) {
      if (pp[i] && pp[i][0] === ':') prms[pp[i].slice(1)] = decodeURIComponent(up[i]);
      else if (pp[i] !== up[i]) return null;
    }
    return prms;
  }
  function makeRouter() {
    var rr = [];
    return {
      get: function (p, h) { rr.push({ m: 'GET', p: p, h: h }); },
      post: function (p, h) { rr.push({ m: 'POST', p: p, h: h }); },
      put: function (p, h) { rr.push({ m: 'PUT', p: p, h: h }); },
      'delete': function (p, h) { rr.push({ m: 'DELETE', p: p, h: h }); },
      use: function (p, h) {
        if (typeof p === 'function') { h = p; p = '*'; }
        if (h) rr.push({ m: 'USE', p: p, h: h });
      },
      __routes: rr,
    };
  }

  self.module = { exports: {} };
  self.exports = self.module.exports;
  self.require = function (m) {
    if (m === 'http') {
      return {
        createServer: function (h) {
          serverHandler = h;
          return { listen: function (p, hh, c) {
            var cb = typeof hh === 'function' ? hh : c;
            console.log('HTTP server listening on port ' + p);
            if (cb) cb();
          } };
        },
      };
    }
    if (m === 'express') {
      var ef = function () {
        var routes = [];
        var app = {
          get: function (p, h) { routes.push({ m: 'GET', p: p, h: h }); },
          post: function (p, h) { routes.push({ m: 'POST', p: p, h: h }); },
          put: function (p, h) { routes.push({ m: 'PUT', p: p, h: h }); },
          'delete': function (p, h) { routes.push({ m: 'DELETE', p: p, h: h }); },
          all: function (p, h) {
            ['GET','POST','PUT','DELETE'].forEach(function (mm) { routes.push({ m: mm, p: p, h: h }); });
          },
          use: function (p, h) {
            if (typeof p === 'function') { h = p; p = '*'; }
            if (!h) return;
            if (h.__routes) routes.push({ m: 'MOUNT', p: p, router: h.__routes });
            else routes.push({ m: 'USE', p: p, h: h });
          },
          listen: function (port, host, cb) {
            var actualCb = typeof host === 'function' ? host : cb;
            console.log('Express server listening on port ' + port);
            if (actualCb) actualCb();
          },
        };
        return app;
      };
      ef.Router = makeRouter;
      ef.json = function () { return function (req, res, next) { if (next) next(); }; };
      return ef;
    }
    if (m === 'fs') {
      return {
        readFile: function (p, e, cb) {
          if (typeof e === 'function') { cb = e; }
          setTimeout(function () {
            var d = fsFiles[p];
            if (d === undefined) cb(new Error("ENOENT: no such file or directory, open '" + p + "'"), null);
            else cb(null, d);
          }, 0);
        },
        readFileSync: function (p) {
          var d = fsFiles[p];
          if (d === undefined) throw new Error("ENOENT: no such file: '" + p + "'");
          return d;
        },
        writeFile: function (p, data, e, cb) {
          if (typeof e === 'function') { cb = e; }
          fsFiles[p] = String(data);
          setTimeout(function () { if (cb) cb(null); }, 0);
        },
        promises: {
          readFile: function (p) {
            return new Promise(function (ok, err) {
              setTimeout(function () {
                var d = fsFiles[p];
                if (d === undefined) err(new Error("ENOENT: no such file or directory, open '" + p + "'"));
                else ok(d);
              }, 0);
            });
          },
        },
      };
    }
    if (typeof m === 'string' && m.indexOf('./') === 0) {
      var mkey = m.replace(/^\.\//, '').replace(/\.js$/, '');
      if (Object.prototype.hasOwnProperty.call(moduleCache, mkey)) return moduleCache[mkey];
      var msrc = jsFiles[mkey + '.js'] || jsFiles[mkey];
      if (msrc === undefined) throw new Error('Cannot find module: ' + m);
      var mod = { exports: {} };
      moduleCache[mkey] = mod.exports;
      (new Function('require', 'module', 'exports', msrc))(self.require, mod, mod.exports);
      moduleCache[mkey] = mod.exports;
      return mod.exports;
    }
    throw new Error('Module not found: ' + m);
  };
}

// ---- Step hooks -----------------------------------------------------

function onCall(fnName, file, line) {
  callIdCounter++;
  stack.push({ function: fnName || '<anonymous>', file: file, line: line, callId: callIdCounter, scopeFn: null });
}

function onReturn() {
  if (stack.length) stack.pop();
}

function onLine(file, line, scopeFn) {
  if (stopFlag) {
    throw new Error('__ttd_stop__');
  }
  var frame = stack[stack.length - 1] || { function: '<module>', file: file, line: line, callId: 0, scopeFn: null };
  frame.line = line;
  frame.scopeFn = scopeFn;
  drainPendingUpdates(scopeFn);

  if (totalSnapshots >= maxHistory) {
    if (!capWarned) {
      capWarned = true;
      send({ type: 'capReached', limit: maxHistory });
    }
    return;
  }

  if (pendingOverrides.length) {
    for (var i = 0; i < pendingOverrides.length; i++) {
      if (appliedOverrides.has(i)) continue;
      if ((pendingOverrides[i].snapshot_idx | 0) !== totalSnapshots) continue;
      applyOverride(pendingOverrides[i]);
      appliedOverrides.add(i);
    }
  }

  var snap = makeSnapshot(file, line, scopeFn);
  snapshotBuffer.push(snap);
  totalSnapshots++;

  var bpKey = file + ':' + line;
  var hitBp = breakpoints.has(bpKey);
  if (hitBp) {
    var info = breakpoints.get(bpKey);
    if (info && info.condition) {
      try {
        var cond = !!evalInScope(info.condition, scopeFn);
        if (!cond) hitBp = false;
      } catch (e) {
        send({ type: 'breakpointError', file: file, line: line, error: String(e.message || e) });
        hitBp = true;
      }
    }
  }

  var surface = hitBp || shouldSurfaceForStep();
  if (!surface) return;

  send({ type: 'paused', snapshots: snapshotBuffer });
  snapshotBuffer = [];
  pauseLoop(file, line, scopeFn);
}

function pauseLoop(file, line, scopeFn) {
  while (true) {
    Atomics.wait(i32, SLOT_CMD, 0);
    var cmd = Atomics.load(i32, SLOT_CMD);
    Atomics.store(i32, SLOT_CMD, 0);
    drainPendingUpdates(scopeFn);
    if (cmd === 1) { userMode = 'continue'; stepBaseDepth = 0; break; }
    if (cmd === 2) { userMode = 'stepInto'; stepBaseDepth = 0; break; }
    if (cmd === 3) { userMode = 'stepOver'; stepBaseDepth = stack.length; break; }
    if (cmd === 4) { userMode = 'stepOut'; stepBaseDepth = stack.length; break; }
    if (cmd === 5) { stopFlag = true; throw new Error('__ttd_stop__'); }
    if (cmd === 6) {
      send({ type: 'paused', snapshots: [makeSnapshot(file, line, scopeFn)], replace_last: true });
    }
  }
}

function drainPendingUpdates(scopeFn) {
  if (Atomics.load(i32, SLOT_WATCHES_DIRTY) === 1) {
    var len = Atomics.load(i32, SLOT_WATCHES_LEN);
    try {
      watches = JSON.parse(TEXT_DECODER.decode(u8.subarray(WATCH_OFF, WATCH_OFF + len)));
    } catch (e) {}
    Atomics.store(i32, SLOT_WATCHES_DIRTY, 0);
  }
  if (Atomics.load(i32, SLOT_BPS_DIRTY) === 1) {
    var blen = Atomics.load(i32, SLOT_BPS_LEN);
    try {
      var changes = JSON.parse(TEXT_DECODER.decode(u8.subarray(BPS_OFF, BPS_OFF + blen)));
      changes.forEach(function (ch) {
        var k = ch.file + ':' + ch.line;
        if (ch.op === 'add' || ch.op === 'edit') breakpoints.set(k, { condition: ch.condition || null });
        else if (ch.op === 'remove') breakpoints.delete(k);
      });
    } catch (e) {}
    Atomics.store(i32, SLOT_BPS_DIRTY, 0);
  }
  if (Atomics.load(i32, SLOT_EDITS_DIRTY) === 1) {
    var elen = Atomics.load(i32, SLOT_EDITS_LEN);
    try {
      var edits = JSON.parse(TEXT_DECODER.decode(u8.subarray(EDITS_OFF, EDITS_OFF + elen)));
      edits.forEach(function (e) { applyLiveEdit(e, scopeFn); });
    } catch (err) {}
    Atomics.store(i32, SLOT_EDITS_DIRTY, 0);
  }
}

function shouldSurfaceForStep() {
  var depth = stack.length || 1;
  if (userMode === 'stepInto') return true;
  if (userMode === 'stepOver') return depth <= stepBaseDepth;
  if (userMode === 'stepOut') return depth < stepBaseDepth;
  return false;
}

// ---- Snapshot building ----------------------------------------------

function makeSnapshot(file, line, scopeFn) {
  var locals = {};
  if (scopeFn) {
    try { locals = scopeFn(); } catch (e) { locals = {}; }
  }
  var stk = [];
  for (var i = 0; i < stack.length; i++) {
    var f = stack[i];
    var fl = (i === stack.length - 1) ? locals : (f.scopeFn ? safeCall(f.scopeFn) : {});
    var frame = {
      function: f.function,
      file: f.file,
      line: f.line,
      call_id: f.callId,
      locals: serializeDict(fl),
    };
    if (i === stack.length - 1) frame.globals = serializeGlobals();
    stk.push(frame);
  }
  if (!stk.length) {
    stk.push({
      function: '<module>',
      file: file,
      line: line,
      call_id: 0,
      locals: serializeDict(locals),
      globals: serializeGlobals(),
    });
  }
  return {
    file: file,
    line: line,
    event: 'line',
    call_id: stk[stk.length - 1].call_id,
    stack: stk,
    watches: evalWatches(scopeFn),
  };
}

function safeCall(fn) { try { return fn(); } catch (e) { return {}; } }

function evalInScope(expr, scopeFn) {
  var locals = scopeFn ? safeCall(scopeFn) : {};
  var keys = Object.keys(locals);
  var values = keys.map(function (k) { return locals[k]; });
  var fn = new Function.apply(null, keys.concat(['return (' + expr + ')']));
  return fn.apply(null, values);
}

function evalWatches(scopeFn) {
  var out = {};
  watches.forEach(function (expr) {
    try { out[expr] = serializeValue(evalInScope(expr, scopeFn), snapshotDepth); }
    catch (e) { out[expr] = { error: String(e && e.message || e) }; }
  });
  return out;
}

function applyOverride(ov) {
  send({ type: 'log', msg: '[ttd-browser] override skipped (browser limitation): ' + ov.var });
}

function applyLiveEdit(edit, scopeFn) {
  if (!scopeFn) return;
  try {
    var newValue = evalInScope(edit.expr, scopeFn);
    if (edit.scope === 'globals') {
      self[edit.var] = newValue;
      send({ type: 'log', msg: '[ttd-browser] edit globals[' + edit.var + '] = ' + JSON.stringify(newValue) });
    } else {
      send({ type: 'editError', var: edit.var, expr: edit.expr,
             error: 'mutating live function locals is not supported by the browser backend; switch to webcontainer for full edit support' });
    }
  } catch (e) {
    send({ type: 'editError', var: edit.var, expr: edit.expr, error: String(e && e.message || e) });
  }
}

// ---- Serialization (mirrors Python _serialize) ----------------------

function serializeDict(d) {
  var out = {};
  for (var k in d) {
    if (!Object.prototype.hasOwnProperty.call(d, k)) continue;
    out[k] = serializeValue(d[k], snapshotDepth);
  }
  return out;
}

function serializeGlobals() {
  var SKIP = { __ttd: 1, __ttdInstrument: 1, acorn: 1, walk: 1, module: 1, exports: 1, require: 1, console: 1, self: 1, postMessage: 1, addEventListener: 1, removeEventListener: 1, importScripts: 1, location: 1, navigator: 1, name: 1, fetch: 1, performance: 1, crypto: 1, TextEncoder: 1, TextDecoder: 1, URL: 1, URLSearchParams: 1, Atomics: 1, SharedArrayBuffer: 1, ArrayBuffer: 1, Int32Array: 1, Uint8Array: 1, structuredClone: 1, queueMicrotask: 1, setTimeout: 1, clearTimeout: 1, setInterval: 1, clearInterval: 1, Promise: 1, JSON: 1, Math: 1, process: 1 };
  var out = {};
  for (var k in self) {
    if (SKIP[k]) continue;
    if (k.indexOf('on') === 0 && typeof self[k] !== 'object') continue;
    try {
      var v = self[k];
      if (typeof v === 'function' && /\[native code\]/.test(String(v))) continue;
      out[k] = serializeValue(v, snapshotDepth);
    } catch (e) {}
  }
  return out;
}

function oidFor(obj) {
  if (oidMap.has(obj)) return oidMap.get(obj);
  oidCounter++;
  oidMap.set(obj, oidCounter);
  return oidCounter;
}

function safeRepr(v) {
  try {
    if (typeof v === 'string') return JSON.stringify(v);
    if (v === null) return 'null';
    if (v === undefined) return 'undefined';
    if (typeof v === 'function') return '[Function: ' + (v.name || 'anonymous') + ']';
    if (typeof v === 'object') return Array.isArray(v) ? '[Array(' + v.length + ')]' : ('[' + (v.constructor && v.constructor.name || 'Object') + ']');
    return String(v);
  } catch (e) { return '<unrepresentable>'; }
}

function serializeValue(v, depth) {
  if (v === undefined) return { kind: 'primitive', type: 'undefined', repr: 'undefined' };
  if (v === null) return { kind: 'primitive', type: 'null', repr: 'null' };
  if (typeof v === 'string') return { kind: 'primitive', type: 'string', repr: JSON.stringify(v) };
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') {
    return { kind: 'primitive', type: typeof v, repr: String(v) };
  }
  if (typeof v === 'symbol') return { kind: 'primitive', type: 'symbol', repr: v.toString() };
  if (typeof v === 'function') {
    return { kind: 'object', type: 'function', oid: oidFor(v), repr: '[Function: ' + (v.name || 'anonymous') + ']', attrs: {} };
  }
  if (depth <= 0) {
    return { kind: 'truncated', type: typeof v, oid: oidFor(v), repr: safeRepr(v) };
  }
  if (Array.isArray(v)) {
    var children = [];
    var max = Math.min(v.length, 100);
    for (var i = 0; i < max; i++) children.push(serializeValue(v[i], depth - 1));
    return { kind: 'collection', type: 'list', oid: oidFor(v), len: v.length, preview: '[' + max + (v.length > max ? ', ...' : '') + ']', children: children, truncated: v.length > max };
  }
  var attrs = {};
  var n = 0;
  for (var k in v) {
    if (n >= 50) break;
    try { attrs[k] = serializeValue(v[k], depth - 1); n++; } catch (e) {}
  }
  return { kind: 'object', type: (v.constructor && v.constructor.name) || 'Object', oid: oidFor(v), repr: safeRepr(v), attrs: attrs };
}
