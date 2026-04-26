/**
 * Time-travel debugger — worker-side extension. Loaded once via importScripts
 * on first `enableDebugger` message (see js/pyodide-worker.js).
 *
 * Owns the JS<->Python bridge for the debug protocol:
 *   - SAB layout for blocking step commands (Atomics.wait/notify)
 *   - SAB layout for live update channels (watches, breakpoint changes) that
 *     can be consumed by the worker WITHOUT going through postMessage —
 *     because the worker is blocked in Atomics.wait, postMessage handlers
 *     can't run while it waits.
 *   - Loads pyodide-debugger.py and instantiates TimeTravelDebugger per session.
 *
 * SAB layout (Int32 view):
 *   [0]  command          1=continue, 2=step (into), 3=next (over), 4=return (out), 5=stop, 6=sync
 *   [1]  watches_dirty    0/1 — main sets to 1 after writing new watches payload
 *   [2]  bps_dirty        0/1 — main sets to 1 after writing new breakpoint changes payload
 *   [3]  edits_dirty      0/1 — main sets to 1 after writing live variable edits
 *   [4]  watches_len      bytes length of watches payload
 *   [5]  bps_len          bytes length of bps payload
 *   [6]  edits_len        bytes length of live edits payload
 *
 * SAB layout (Uint8 view, payload regions):
 *   [WATCH_OFF .. WATCH_OFF + 32KB)  watches JSON (UTF-8)
 *   [BPS_OFF   .. BPS_OFF   + 32KB)  bps JSON (UTF-8)
 *   [EDITS_OFF .. EDITS_OFF + 32KB)  live edit JSON (UTF-8)
 *
 * Total SAB size: 96KB + 32 bytes header — comfortable budget.
 */

'use strict';

// Bump this when shipping a fix to the debugger so it's visible in the console
// that the new version is loaded (otherwise stale-SW caching is invisible).
var TTD_VERSION = '0.6.3-replay-anchors';
self.postMessage({ type: 'log', msg: '[ttd worker] loaded v' + TTD_VERSION });

var SAB_HEADER_BYTES = 32;          // 8 Int32 slots
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

// Block-condition constant for Atomics.wait — we wait while [SLOT_CMD] === 0,
// so all real commands are 1..5 (no 0).
var CMD_NONE = 0;

var sab = null;
var i32 = null;
var u8 = null;
var textDecoder = new TextDecoder();
var debuggerInstance = null;     // TimeTravelDebugger pyproxy
var debuggerPySrc = null;         // raw Python source, fetched once

// Register handlers in the slot the base worker (`_debuggerHandlers`)
// dispatches to. The base worker's onmessage routes any msg.type matching
// a key here to our handler.
self._debuggerHandlers = {
  debugInit: handleDebugInit,
  runDebug: handleRunDebug,
};

// --- Setup -----------------------------------------------------------------

function handleDebugInit(msg) {
  sab = msg.sab;
  i32 = new Int32Array(sab);
  u8 = new Uint8Array(sab);
  // Reset all control slots
  Atomics.store(i32, SLOT_CMD, CMD_NONE);
  Atomics.store(i32, SLOT_WATCHES_DIRTY, 0);
  Atomics.store(i32, SLOT_BPS_DIRTY, 0);
  Atomics.store(i32, SLOT_EDITS_DIRTY, 0);
}

function fetchPySrc() {
  if (debuggerPySrc !== null) return Promise.resolve(debuggerPySrc);
  // Cache-bust + bypass HTTP cache so dev edits to the Python source roll
  // out without requiring SW unregistration. The fetch happens once per
  // worker (i.e. once per page load).
  return fetch('/js/debugger/pyodide-debugger.py?v=' + Date.now(), { cache: 'no-store' })
    .then(function (r) {
      if (!r.ok) throw new Error('Failed to fetch pyodide-debugger.py: ' + r.status);
      return r.text();
    })
    .then(function (text) { debuggerPySrc = text; return text; });
}

// --- runDebug --------------------------------------------------------------

function handleRunDebug(msg) {
  if (!pyodide) {
    self.postMessage({ type: 'debugComplete', exitCode: 1, error: 'Pyodide not ready' });
    return;
  }
  if (!sab) {
    self.postMessage({ type: 'debugComplete', exitCode: 1, error: 'Debugger not initialised (missing SAB)' });
    return;
  }

  fetchPySrc()
    .then(function (src) {
      // Idempotent: ensures TimeTravelDebugger is defined in pyodide globals.
      // Re-running it on every session is cheap and tolerates pyodide restart.
      pyodide.runPython(src);

      // Sync user files into the pyodide FS BEFORE running. The main thread
      // already does this via the regular `write` protocol; debug runs assume
      // files are already present at /tutorial/<filename>.
      var watches = msg.watches || [];
      var bps = msg.breakpoints || [];   // [{file, line, condition}]
      var opts = msg.options || {};
      var filename = msg.filename || '/tutorial/main.py';
      var code = msg.code;
      var args = msg.args || [];

      // Ensure file is on disk so frame.f_code.co_filename matches what the
      // UI passes for breakpoints. Write code under the tutorial file path
      // and execute via __file__ semantics.
      try {
        pyodide.FS.writeFile(filename, code, { encoding: 'utf8' });
        pyodide.runPython('import sys; sys.argv = ' + JSON.stringify([filename].concat(args || [])));
      } catch (e) {
        self.postMessage({ type: 'debugComplete', exitCode: 1, error: 'Failed to prepare debug run: ' + e.message });
        return;
      }

      // Build JS callbacks the Python side will invoke during execution.
      var postPausedCb = function (jsonStr) {
        try {
          self.postMessage(JSON.parse(jsonStr));
        } catch (e) {
          self.postMessage({ type: 'debuggerError', message: 'Bad paused payload: ' + e.message });
        }
      };
      var waitForCommandCb = function () {
        // Block until main thread writes a command and notifies. Returns the
        // command code and resets the slot to 0 for the next pause.
        Atomics.wait(i32, SLOT_CMD, CMD_NONE);
        var cmd = Atomics.load(i32, SLOT_CMD);
        Atomics.store(i32, SLOT_CMD, CMD_NONE);
        // Map our 1..6 protocol back to Python command codes.
        // 1=continue→0, 2=step→1, 3=next→2, 4=return→3, 5=stop→4, 6=sync→5
        return cmd > 0 ? cmd - 1 : 0;
      };
      var consumePendingCb = function () {
        var out = null;
        if (Atomics.load(i32, SLOT_WATCHES_DIRTY) === 1) {
          var len = Atomics.load(i32, SLOT_WATCHES_LEN);
          var bytes = u8.subarray(WATCH_OFF, WATCH_OFF + len);
          try {
            out = out || {};
            out.watches = JSON.parse(textDecoder.decode(bytes));
          } catch (e) { /* ignore corrupt payload */ }
          Atomics.store(i32, SLOT_WATCHES_DIRTY, 0);
        }
        if (Atomics.load(i32, SLOT_BPS_DIRTY) === 1) {
          var bplen = Atomics.load(i32, SLOT_BPS_LEN);
          var bpbytes = u8.subarray(BPS_OFF, BPS_OFF + bplen);
          try {
            out = out || {};
            out.breakpoint_changes = JSON.parse(textDecoder.decode(bpbytes));
          } catch (e) { /* ignore */ }
          Atomics.store(i32, SLOT_BPS_DIRTY, 0);
        }
        if (Atomics.load(i32, SLOT_EDITS_DIRTY) === 1) {
          var eLen = Atomics.load(i32, SLOT_EDITS_LEN);
          var eBytes = u8.subarray(EDITS_OFF, EDITS_OFF + eLen);
          try {
            out = out || {};
            out.live_edits = JSON.parse(textDecoder.decode(eBytes));
          } catch (e) { /* ignore */ }
          Atomics.store(i32, SLOT_EDITS_DIRTY, 0);
        }
        // Return JSON rather than a raw JS object. Pyodide JsProxy.to_py()
        // conversion has been unreliable for nested arrays across versions,
        // and live_edits must arrive exactly or variable writeback is skipped.
        return out ? JSON.stringify(out) : null;
      };

      // Construct the Python debugger via the factory function (avoids
      // round-tripping a class object through pyodide).
      var ttdMake = pyodide.globals.get('_ttd_make');
      var ttdCleanup = pyodide.globals.get('_ttd_cleanup');

      // Pass watches and opts as JSON strings rather than JsProxies. JsProxy
      // conversion was unreliable across pyodide versions (sometimes the
      // array arrived empty in Python). JSON round-trip is unambiguous.
      var watchesJson = JSON.stringify(watches || []);
      var optsJson = JSON.stringify(opts || {});
      var dbg = ttdMake(postPausedCb, waitForCommandCb, consumePendingCb, watchesJson, optsJson);

      // Install all initial breakpoints. Each: {file, line, condition?}
      bps.forEach(function (bp) {
        try {
          dbg.set_break(bp.file, bp.line, false, bp.condition || null);
        } catch (e) { /* surface? */ }
      });

      debuggerInstance = dbg;

      // Stream stdout/stderr during debug exactly like a normal run, so
      // print() output flows to the regular Output panel.
      pyodide.setStdout({ batched: function (text) {
        self.postMessage({ type: 'stdout', text: text + '\n' });
      }});
      pyodide.setStderr({ batched: function (text) {
        self.postMessage({ type: 'stderr', text: text + '\n' });
      }});

      // Run! bdb.Bdb.run() installs sys.settrace and execs the code. We MUST
      // pre-compile with the explicit filename so frame.f_code.co_filename
      // matches the breakpoint paths we set above. Otherwise bdb defaults
      // to "<string>" and the breakpoints never trigger.
      // Also use a FRESH globals dict so the user's view of `globals()` does
      // not include all the debugger machinery (TimeTravelDebugger, bdb, json,
      // _ttd_make, _f, _k, _m, ...) that lives in pyodide's __main__.
      try {
        var ttdRun = pyodide.globals.get('_ttd_run_with_clean_globals');
        var overridesJson = JSON.stringify(msg.overrides || []);
        ttdRun(dbg, code, filename, overridesJson);
        self.postMessage({ type: 'debugComplete', exitCode: 0 });
      } catch (e) {
        self.postMessage({ type: 'debugComplete', exitCode: 1, error: String(e && e.message || e) });
      } finally {
        try { dbg.destroy && dbg.destroy(); } catch (e) {}
        try { ttdMake.destroy && ttdMake.destroy(); } catch (e) {}
        try { ttdCleanup(); } catch (e) {}
        try { ttdCleanup.destroy && ttdCleanup.destroy(); } catch (e) {}
        debuggerInstance = null;
      }
    })
    .catch(function (err) {
      self.postMessage({ type: 'debugComplete', exitCode: 1, error: String(err && err.message || err) });
    });
}
