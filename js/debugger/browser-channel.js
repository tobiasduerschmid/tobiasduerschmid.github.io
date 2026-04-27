/**
 * Time-travel debugger — browser-backend channel.
 *
 * Main-thread side of the in-page sandbox debugger. Spawns a **Web Worker**
 * (NOT an iframe — `Atomics.wait` only works in worker contexts, and we need
 * synchronous block-on-step semantics). The worker shares a SAB with the
 * page and runs the user's JS code AST-instrumented by acorn.
 *
 * Wire-up:
 *   1. startSession:
 *      - Spawn `js/debugger/browser/runtime.js` as a classic Web Worker.
 *      - Build a SAB for command/dirty-flag/payload regions.
 *      - postMessage `__ttd_init` with the SAB + entry source + breakpoints.
 *      - Listen for `paused` / `debugComplete` / `log` / `editError` and
 *        dispatch to the controller's existing handlers.
 *   2. sendCommand / sendWatches / sendBreakpointChanges / sendLiveEdits /
 *      sendExceptionBreakpoints:
 *      - Same SAB layout as the Pyodide path. Atomics.store + Atomics.notify.
 */

(function () {
  'use strict';

  // ---- SAB layout (must match runtime.js) -------------------------------
  var SAB_HEADER_BYTES = 64;
  var WATCH_REGION_BYTES = 32 * 1024;
  var BPS_REGION_BYTES = 32 * 1024;
  var EDITS_REGION_BYTES = 32 * 1024;
  var EXCBPS_REGION_BYTES = 32 * 1024;
  var SAB_TOTAL_BYTES = SAB_HEADER_BYTES + WATCH_REGION_BYTES + BPS_REGION_BYTES + EDITS_REGION_BYTES + EXCBPS_REGION_BYTES;
  var WATCH_OFF = SAB_HEADER_BYTES;
  var BPS_OFF = WATCH_OFF + WATCH_REGION_BYTES;
  var EDITS_OFF = BPS_OFF + BPS_REGION_BYTES;
  var EXCBPS_OFF = EDITS_OFF + EDITS_REGION_BYTES;
  var SLOT_CMD = 0;
  var SLOT_WATCHES_DIRTY = 1, SLOT_BPS_DIRTY = 2, SLOT_EDITS_DIRTY = 3;
  var SLOT_WATCHES_LEN = 4, SLOT_BPS_LEN = 5, SLOT_EDITS_LEN = 6;
  var SLOT_EXCBPS_DIRTY = 7, SLOT_EXCBPS_LEN = 8;

  function BrowserChannel(controller, tutorial) {
    this.controller = controller;
    this.tutorial = tutorial;
    this.worker = null;
    this.sab = null;
    this.i32 = null;
    this.u8 = null;
    this._encoder = new TextEncoder();
    this._decoder = new TextDecoder();
    this._msgListener = null;
  }

  BrowserChannel.prototype.install = function () {
    if (!window.crossOriginIsolated) {
      console.warn('[BrowserChannel] page is not crossOriginIsolated — debugger needs the COI service worker to take effect (reload once).');
    }
    if (!window.SharedArrayBuffer) {
      console.error('[BrowserChannel] SharedArrayBuffer unavailable — debugger cannot pause synchronously.');
    }
  };

  BrowserChannel.prototype.dispose = function () {
    if (this.worker) {
      try { this.worker.terminate(); } catch (e) {}
      this.worker = null;
    }
    this.sab = null;
    this.i32 = null;
    this.u8 = null;
  };

  BrowserChannel.prototype.startSession = function (cfg) {
    var self = this;
    if (!window.SharedArrayBuffer || !window.crossOriginIsolated) {
      this._fail('Browser debugger requires crossOriginIsolated; reload the page.');
      return;
    }
    this.sab = new SharedArrayBuffer(SAB_TOTAL_BYTES);
    this.i32 = new Int32Array(this.sab);
    this.u8 = new Uint8Array(this.sab);

    // Spawn a Web Worker (same-origin, classic). Workers are the only
    // contexts allowed to call Atomics.wait — the document main thread and
    // iframes are forbidden from blocking. Cache-busted so worker reloads
    // pick up changes during dev iteration.
    var worker;
    try {
      worker = new Worker('/js/debugger/browser/runtime.js?v=' + Date.now());
    } catch (err) {
      this._fail('Failed to spawn debug worker: ' + (err && err.message || err));
      return;
    }
    this.worker = worker;
    worker.addEventListener('message', function (e) {
      if (!e.data || !e.data.__ttd || !e.data.payload) return;
      self._dispatchMessage(e.data.payload);
    });
    worker.addEventListener('error', function (e) {
      console.error('[BrowserChannel] worker error:', e.message, e.filename, e.lineno);
      self._fail('Worker error: ' + (e.message || 'unknown'));
    });

    worker.postMessage({
      __ttd_init: true,
      sab: self.sab,
      entry: cfg.filename,
      code: cfg.code,
      files: cfg.files || {},
      args: cfg.args || [],
      breakpoints: cfg.breakpoints || [],
      watches: cfg.watches || [],
      options: cfg.options || {},
      overrides: cfg.overrides || [],
      exceptionBreakpoints: cfg.exceptionBreakpoints || [],
    });
  };

  BrowserChannel.prototype._fail = function (msg) {
    console.error('[BrowserChannel]', msg);
    if (this.controller && this.controller.onDebugComplete) {
      this.controller.onDebugComplete({ exitCode: 1, error: msg });
    }
  };

  BrowserChannel.prototype._dispatchMessage = function (msg) {
    var c = this.controller;
    if (!c) return;
    if (msg.type === 'paused') c.onPaused(msg);
    else if (msg.type === 'debugComplete') c.onDebugComplete(msg);
    else if (msg.type === 'capReached') c.onCapReached(msg);
    else if (msg.type === 'breakpointError') c.onBreakpointError(msg);
    else if (msg.type === 'editError' && c.onEditError) c.onEditError(msg);
    else if (msg.type === 'stdout') {
      if (this.tutorial && typeof this.tutorial._appendOutput === 'function') {
        this.tutorial._appendOutput(msg.text || '', 'stdout');
      }
    }
    else if (msg.type === 'log') console.log('[ttd]', msg.msg);
    else if (msg.type === 'debuggerError') console.error('[debugger]', msg.message);
  };

  // ---- Outbound (mirrors PyodideChannel SAB writes) ---------------------

  BrowserChannel.prototype.sendCommand = function (cmdCode) {
    if (!this.i32) return;
    Atomics.store(this.i32, SLOT_CMD, cmdCode);
    Atomics.notify(this.i32, SLOT_CMD, 1);
  };

  BrowserChannel.prototype.sendWatches = function (watches) {
    return this._writeJson(WATCH_OFF, WATCH_REGION_BYTES, SLOT_WATCHES_LEN, SLOT_WATCHES_DIRTY, watches || [], 'watches');
  };

  BrowserChannel.prototype.sendBreakpointChanges = function (changes) {
    if (!Array.isArray(changes) || !changes.length) return true;
    var next = this._mergePendingArray(BPS_OFF, SLOT_BPS_LEN, SLOT_BPS_DIRTY, changes);
    return this._writeJson(BPS_OFF, BPS_REGION_BYTES, SLOT_BPS_LEN, SLOT_BPS_DIRTY, next, 'breakpoints');
  };

  BrowserChannel.prototype.sendLiveEdits = function (edits) {
    if (!Array.isArray(edits) || !edits.length) return true;
    var next = this._mergePendingArray(EDITS_OFF, SLOT_EDITS_LEN, SLOT_EDITS_DIRTY, edits);
    return this._writeJson(EDITS_OFF, EDITS_REGION_BYTES, SLOT_EDITS_LEN, SLOT_EDITS_DIRTY, next, 'edits');
  };

  BrowserChannel.prototype.sendExceptionBreakpoints = function (excBps) {
    return this._writeJson(EXCBPS_OFF, EXCBPS_REGION_BYTES, SLOT_EXCBPS_LEN, SLOT_EXCBPS_DIRTY, excBps || [], 'exception breakpoints');
  };

  BrowserChannel.prototype._mergePendingArray = function (offset, lenSlot, dirtySlot, additions) {
    var next = (additions || []).slice();
    if (this.i32 && Atomics.load(this.i32, dirtySlot) === 1) {
      var len = Atomics.load(this.i32, lenSlot);
      try {
        var pending = this._decodeSharedJson(offset, len);
        if (Array.isArray(pending)) next = pending.concat(next);
      } catch (e) {}
    }
    return next;
  };

  BrowserChannel.prototype._writeJson = function (offset, capacity, lenSlot, dirtySlot, value, label) {
    if (!this.u8) return false;
    var bytes = this._encoder.encode(JSON.stringify(value));
    if (bytes.length > capacity) {
      var msg = (label || 'payload') + ' update too large';
      console.warn('[BrowserChannel]', msg + ':', bytes.length, '>', capacity);
      // Mirror the Pyodide path's surface (main.js writePayload) so the user
      // sees feedback in the status bar instead of failing silently.
      if (this.controller && typeof this.controller.setStatus === 'function') {
        this.controller.setStatus(msg);
      }
      return false;
    }
    this.u8.fill(0, offset, offset + capacity);
    this.u8.set(bytes, offset);
    Atomics.store(this.i32, lenSlot, bytes.length);
    Atomics.store(this.i32, dirtySlot, 1);
    return true;
  };

  BrowserChannel.prototype._decodeSharedJson = function (offset, len) {
    var copy = new Uint8Array(len);
    copy.set(this.u8.subarray(offset, offset + len));
    return JSON.parse(this._decoder.decode(copy));
  };

  window.SEBookBrowserChannel = BrowserChannel;
})();
