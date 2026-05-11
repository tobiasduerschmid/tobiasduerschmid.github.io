/**
 * Time-travel debugger — GDB/MI channel (C tutorials, v86 backend).
 *
 * The controller already speaks a single backend protocol:
 *
 *   controller.onPaused({ snapshots: [...] })
 *   controller.onDebugComplete({ exitCode, error? })
 *   channel.startSession({ filename, code, files, breakpoints, ... })
 *   channel.sendCommand(CMD_CONTINUE | CMD_STEP | CMD_NEXT | CMD_RETURN | CMD_QUIT | CMD_SYNC)
 *
 * This module is the adapter from that protocol to real gdb running inside
 * the v86 VM in `--interpreter=mi3` mode. It:
 *
 *   - Holds a `GdbMiParser` instance and feeds it every byte the v86 serial
 *     stream produces.
 *   - Translates `*stopped` async-records into the controller's `paused`
 *     event (one snapshot per stop, with a `stack` shaped the same way
 *     the pyodide / browser / node runtimes produce one).
 *   - Owns command tokens so it can correlate `^done` / `^error` results
 *     with the original `-command` that triggered them.
 *
 * IO is injected. Callers supply a `vmIO` object with `.write(text)`,
 * `.onBytes(cb)`, and `.removeListener(cb)`. The production wiring in
 * `tutorial-code.js` will adapt v86's `serial0_send` and the
 * `serial0-output-byte` listener; tests inject an in-memory pair.
 *
 * Multi-file projects are supported transparently: `-break-insert FILE:LINE`
 * is what gdb already uses, and source-line decoration on the host side
 * already knows the file context.
 *
 * Scope of the MVP (`debugger: gdb` v1):
 *   - Forward stepping (continue / step / next / finish).
 *   - Line-level breakpoints.
 *   - Frame + locals + args snapshot on every stop.
 *   - No reverse-step, no time-travel scrubbing — TCC's DWARF is too thin
 *     to make those useful, and the user explicitly deferred them.
 */

'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    var parser = require('./gdb-mi-parser.js');
    module.exports = factory(parser);
  } else {
    root.GdbChannel = factory({ GdbMiParser: root.GdbMiParser }).GdbChannel;
  }
}(typeof self !== 'undefined' ? self : this, function (parserMod) {

  var GdbMiParser = parserMod.GdbMiParser;

  // Same CMD codes the other backends use.
  var CMD_CONTINUE = 0;
  var CMD_STEP     = 1;
  var CMD_NEXT     = 2;
  var CMD_RETURN   = 3;
  var CMD_QUIT     = 4;
  var CMD_SYNC     = 5;

  var CMD_TO_MI = {};
  CMD_TO_MI[CMD_CONTINUE] = '-exec-continue';
  CMD_TO_MI[CMD_STEP]     = '-exec-step';
  CMD_TO_MI[CMD_NEXT]     = '-exec-next';
  CMD_TO_MI[CMD_RETURN]   = '-exec-finish';
  CMD_TO_MI[CMD_QUIT]     = '-gdb-exit';
  // CMD_SYNC asks for a snapshot of the *current* paused state without
  // advancing. Mapped to `-stack-info-frame` + `-stack-list-variables`.
  CMD_TO_MI[CMD_SYNC]     = '__sync__';

  function GdbChannel(controller, vmIO, opts) {
    if (!controller) throw new Error('GdbChannel: controller is required');
    if (!vmIO || typeof vmIO.write !== 'function' || typeof vmIO.onBytes !== 'function') {
      throw new Error('GdbChannel: vmIO must provide write() and onBytes()');
    }
    this.controller = controller;
    this.vmIO = vmIO;
    this.opts = opts || {};
    this.parser = new GdbMiParser();
    this._byteCb = null;
    this._decoder = (typeof TextDecoder !== 'undefined') ? new TextDecoder('utf-8') : null;
    this._token = 0;
    this._pending = {};                 // token → { cmd, resolve, reject }
    this._breakpoints = [];             // [{file,line,id}] — `id` set after ^done
    this._sessionActive = false;
    this._startCfg = null;
    this._sawFirstPrompt = false;       // tracks initial banner / load
  }

  GdbChannel.prototype.install = function () {
    // No global setup needed; install exists for parity with the other
    // channels' lifecycle.
  };

  // ---- session lifecycle ------------------------------------------------

  GdbChannel.prototype.startSession = function (cfg) {
    this._startCfg = cfg || {};
    this._sessionActive = true;
    this._sawFirstPrompt = false;
    this.parser.reset();
    this._pending = {};
    this._breakpoints = [];
    this._token = 0;

    var self = this;
    this._byteCb = function (chunkOrByte) { self._onBytes(chunkOrByte); };
    this.vmIO.onBytes(this._byteCb);

    // tutorial-code.js is responsible for having already compiled the
    // user's source (via `compile_command` from YAML) and verified that
    // the executable exists. Spawn the wrapper now; the inferior's stdio
    // shares the same serial stream we're listening on, which is fine
    // because gdb's stream-record prefixes let the parser demux it from
    // gdb's own MI output.
    var exe = cfg.executable || './a.out';
    var args = (cfg.args || []).map(this._shellEscape).join(' ');
    var line = 'tutorial-gdb ' + this._shellEscape(exe);
    if (args) line += ' ' + args;
    this.vmIO.write(line + '\n');

    if (this.controller.setStatus) {
      this.controller.setStatus('starting gdb…');
    }
  };

  GdbChannel.prototype.endSession = function () {
    if (!this._sessionActive) return;
    this._sessionActive = false;
    if (this._byteCb && this.vmIO.removeListener) {
      try { this.vmIO.removeListener(this._byteCb); } catch (e) { /* ignore */ }
    }
    this._byteCb = null;
  };

  // ---- inbound: gdb bytes ----------------------------------------------

  GdbChannel.prototype._onBytes = function (chunkOrByte) {
    var text;
    if (typeof chunkOrByte === 'number') {
      text = String.fromCharCode(chunkOrByte);
    } else if (typeof chunkOrByte === 'string') {
      text = chunkOrByte;
    } else if (this._decoder) {
      text = this._decoder.decode(chunkOrByte, { stream: true });
    } else {
      text = '';
      for (var i = 0; i < chunkOrByte.length; i++) {
        text += String.fromCharCode(chunkOrByte[i]);
      }
    }
    if (!text) return;
    var records = this.parser.feed(text);
    for (var j = 0; j < records.length; j++) this._handleRecord(records[j]);
  };

  GdbChannel.prototype._handleRecord = function (rec) {
    if (rec.kind === 'prompt') {
      // First prompt: install breakpoints (queued from startSession's cfg),
      // then `-exec-run`. Subsequent prompts are just gdb's "ready" pings —
      // we don't surface them to the controller.
      if (!this._sawFirstPrompt) {
        this._sawFirstPrompt = true;
        this._installInitialBreakpointsThenRun();
      }
      return;
    }
    if (rec.kind === 'result') {
      this._handleResult(rec);
      return;
    }
    if (rec.kind === 'exec') {
      this._handleExec(rec);
      return;
    }
    if (rec.kind === 'console' || rec.kind === 'target' || rec.kind === 'raw') {
      // Inferior / gdb conversational output. Forward to the controller's
      // log sink if it has one — the existing pyodide path uses `onLog`.
      if (this.controller.onLog && rec.text) {
        this.controller.onLog({ text: rec.text, stream: rec.kind });
      }
      return;
    }
    // log / notify / status — ignore for MVP; later we can use `=library-loaded`
    // and `=breakpoint-modified` to keep the gutter in sync.
  };

  GdbChannel.prototype._handleResult = function (rec) {
    var p = (rec.token != null) ? this._pending[rec.token] : null;
    if (p) delete this._pending[rec.token];

    if (rec.class === 'error') {
      var msg = (rec.data && rec.data.msg) || 'gdb error';
      if (p && p.reject) p.reject(new Error(msg));
      if (this.controller.onDebuggerError) {
        this.controller.onDebuggerError({ message: msg });
      }
      return;
    }
    if (rec.class === 'exit') {
      // gdb itself is shutting down — treat as a debugComplete only if no
      // `*stopped,reason="exited*"` already fired (the inferior may finish
      // before gdb does).
      if (this._sessionActive) {
        this.controller.onDebugComplete({ exitCode: 0 });
        this.endSession();
      }
      return;
    }
    if (p && p.resolve) p.resolve(rec);
  };

  GdbChannel.prototype._handleExec = function (rec) {
    if (rec.class === 'stopped') {
      var reason = rec.data && rec.data.reason;
      // Program completed (normal exit OR signal) → debugComplete.
      if (reason && /^exited/.test(reason)) {
        var code = parseInt((rec.data && rec.data['exit-code']) || '0', 10);
        if (!isFinite(code)) code = 0;
        this.controller.onDebugComplete({ exitCode: code });
        this.endSession();
        return;
      }
      // Anything else (breakpoint-hit, end-stepping-range, signal-received…)
      // is a forward stop. Build a snapshot and surface it.
      var snap = this._buildSnapshot(rec.data || {});
      this.controller.onPaused({ snapshots: [snap] });
    }
    // `*running` we deliberately don't surface — the controller tracks
    // run/paused state via the inverse `onPaused` callback.
  };

  GdbChannel.prototype._buildSnapshot = function (data) {
    var frame = data.frame || {};
    var line = parseInt(frame.line, 10);
    if (!isFinite(line)) line = 0;
    var file = frame.fullname || frame.file || '';
    var func = frame.func || '<unknown>';
    // Match the snapshot shape the pyodide / node backends emit so the
    // controller's history / UI consumers stay backend-agnostic.
    return {
      file: file,
      line: line,
      event: 'line',
      reason: data.reason,
      stack: [{
        file: file,
        line: line,
        function: func,
        locals: this._argsAsLocals(frame.args),
      }],
    };
  };

  // For MVP, populate `locals` with just the function arguments gdb gave us
  // alongside the frame. A follow-up will issue `-stack-list-variables` to
  // get true locals (and merge them in). With TCC binaries this is often
  // empty anyway because TCC's DWARF doesn't emit DW_TAG_variable for
  // automatic locals.
  GdbChannel.prototype._argsAsLocals = function (args) {
    if (!Array.isArray(args)) return {};
    var out = {};
    for (var i = 0; i < args.length; i++) {
      var a = args[i];
      if (a && typeof a === 'object' && a.name) {
        out[a.name] = { repr: String(a.value), preview: String(a.value) };
      }
    }
    return out;
  };

  // ---- outbound: controller commands -----------------------------------

  GdbChannel.prototype.sendCommand = function (cmdCode) {
    var mi = CMD_TO_MI[cmdCode];
    if (!mi) return;
    if (mi === '__sync__') {
      this._mi('-stack-info-frame');
      return;
    }
    this._mi(mi);
    if (cmdCode === CMD_QUIT) this.endSession();
  };

  GdbChannel.prototype.sendBreakpointChanges = function (changes) {
    if (!changes || !Array.isArray(changes)) return;
    for (var i = 0; i < changes.length; i++) {
      var c = changes[i];
      if (c.op === 'add') {
        this._mi('-break-insert ' + this._shellEscape(c.file) + ':' + c.line);
      } else if (c.op === 'remove' && c.id != null) {
        this._mi('-break-delete ' + c.id);
      }
    }
  };

  // No-ops on this backend; the existing pyodide protocol calls them
  // unconditionally and we don't want to break that contract.
  GdbChannel.prototype.sendWatches = function () { /* unsupported in MVP */ };
  GdbChannel.prototype.sendLiveEdits = function () { /* unsupported in MVP */ };
  GdbChannel.prototype.sendExceptionBreakpoints = function () { /* unsupported in MVP */ };

  // ---- helpers ---------------------------------------------------------

  GdbChannel.prototype._installInitialBreakpointsThenRun = function () {
    var bps = (this._startCfg && this._startCfg.breakpoints) || [];
    for (var i = 0; i < bps.length; i++) {
      var bp = bps[i];
      // Accept both shapes used by the controller: legacy {file, line} and
      // the newer per-file Map of line numbers (already serialised flat).
      if (bp && bp.file && bp.line) {
        this._mi('-break-insert ' + this._shellEscape(bp.file) + ':' + bp.line);
      }
    }
    if (this.controller.setStatus) this.controller.setStatus('running…');
    this._mi('-exec-run');
  };

  GdbChannel.prototype._mi = function (command) {
    var token = ++this._token;
    var line = token + command + '\n';
    this.vmIO.write(line);
    return token;
  };

  GdbChannel.prototype._shellEscape = function (s) {
    // Conservative: wrap in single quotes and escape any embedded ones.
    return "'" + String(s).replace(/'/g, "'\\''") + "'";
  };

  // CMD codes are exported so the test harness can drive without re-deriving.
  GdbChannel.CMD_CONTINUE = CMD_CONTINUE;
  GdbChannel.CMD_STEP     = CMD_STEP;
  GdbChannel.CMD_NEXT     = CMD_NEXT;
  GdbChannel.CMD_RETURN   = CMD_RETURN;
  GdbChannel.CMD_QUIT     = CMD_QUIT;
  GdbChannel.CMD_SYNC     = CMD_SYNC;

  return { GdbChannel: GdbChannel };
}));
