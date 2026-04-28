/**
 * Time-travel debugger — Node.js channel.
 *
 * Main-thread side of the WebContainer integration. The Pyodide path uses a
 * Web Worker + SharedArrayBuffer (Atomics.wait/notify) to block-and-release
 * the worker on each step. WebContainer's Node process is in a separate
 * context where SAB sharing isn't viable, so this channel uses JSON over
 * stdio instead.
 *
 * Wire-up (mirrors what worker-extension.js does for Pyodide):
 *   1. On `startSession`:
 *      - Fetch the runner source (cache-busted), write it to /tutorial/.ttd/runner.js
 *      - Write user files to /tutorial/<name>
 *      - `wc.spawn('node', ['/tutorial/.ttd/runner.js'])`
 *      - Pipe an initial JSON config line into the process's stdin
 *      - Start a background loop that drains the process's stdout, splitting
 *        each line into either `\x01TTD\x02 ... \x03\n` protocol frames
 *        (dispatched to the controller) or pass-through bytes (forwarded to
 *        the existing Output panel).
 *   2. On a step / continue / stop click:
 *      - Drain any pending watch/bp/live-edit updates into the same JSON line
 *        that carries the command, then write to stdin.
 *
 * Protocol parity with Python:
 *   1=continue, 2=stepInto, 3=stepOver, 4=stepOut, 5=stop, 6=sync
 *   Inbound messages: paused, debugComplete, capReached, breakpointError,
 *   editError, log, debuggerError.
 */

(function () {
  'use strict';

  var PROTO_PREFIX = '\x01TTD\x02';
  var PROTO_SUFFIX = '\x03\n';

  function NodeChannel(controller, tutorial) {
    this.controller = controller;
    this.tutorial = tutorial;
    this.wc = tutorial._webcontainer || null;
    this.process = null;
    this.writer = null;
    this._stdoutBuf = '';
    this._encoder = new TextEncoder();
    this._decoder = new TextDecoder();
    // Per-pause batched updates the next sendCommand() will piggyback.
    this._pendingWatches = null;
    this._pendingBpChanges = null;
    this._pendingLiveEdits = null;
    this._pendingExceptionBps = null;
  }

  NodeChannel.prototype.install = function () {
    // Channel-specific install hook. The controller's `install` calls this
    // instead of `attachWorkerListener` when a channel is present.
  };

  NodeChannel.prototype.dispose = function () {
    try { if (this.process) this.process.kill(); } catch (e) {}
    this.process = null;
    this.writer = null;
    this._pendingWatches = null;
    this._pendingBpChanges = null;
    this._pendingLiveEdits = null;
    this._pendingExceptionBps = null;
  };

  // ---- Session lifecycle -------------------------------------------------

  NodeChannel.prototype.startSession = function (cfg) {
    var self = this;
    if (!this.wc) {
      this._fail('WebContainer is not booted yet');
      return;
    }
    var init = {
      entry: cfg.filename,
      breakpoints: cfg.breakpoints || [],
      watches: cfg.watches || [],
      args: cfg.args || [],
      options: cfg.options || {},
      serverMode: !!cfg.serverMode,
      overrides: cfg.overrides || [],
      exceptionBreakpoints: cfg.exceptionBreakpoints || [],
    };
    // Fetch the runner source on each start (cache-busted) so dev iteration
    // on runner.js rolls out without WebContainer needing a reset.
    var runnerUrl = '/js/debugger/node/runner.js?v=' + Date.now();
    fetch(runnerUrl, { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('runner.js fetch failed: ' + r.status);
        return r.text();
      })
      .then(function (runnerSrc) {
        // Ensure /tutorial/.ttd exists, then write runner + user files.
        var ensureRuntime = self.tutorial && typeof self.tutorial._ensureWebContainerNodeRuntime === 'function'
          ? self.tutorial._ensureWebContainerNodeRuntime()
          : Promise.resolve();
        return ensureRuntime.then(function () { return self.wc.fs.mkdir('tutorial/.ttd', { recursive: true }); })
          .then(function () { return self.wc.fs.writeFile('tutorial/.ttd/runner.js', runnerSrc); })
          .then(function () { return self.wc.fs.writeFile('tutorial/.ttd/init.json', JSON.stringify(init)); })
          .then(function () { return self._writeUserFiles(cfg.files || {}); });
      })
      .then(function () {
        return self.wc.spawn('node', ['tutorial/.ttd/runner.js', 'tutorial/.ttd/init.json']);
      })
      .then(function (proc) {
        self.process = proc;
        self.writer = proc.input.getWriter();
        self._startReadingStdout(proc.output.getReader());
        if (self.controller && typeof self.controller.setStatus === 'function') {
          self.controller.setStatus(init.serverMode ? 'server starting…' : 'running…');
        }
        self._flushPendingRuntimeUpdates();
      })
      .catch(function (err) {
        self._fail('Failed to start Node debug: ' + (err && err.message || err));
      });
  };

  NodeChannel.prototype._writeUserFiles = function (files) {
    var self = this;
    var paths = Object.keys(files || {});
    var p = Promise.resolve();
    paths.forEach(function (path) {
      p = p.then(function () {
        // Strip leading slash for wc.fs which is rooted at /
        var wcPath = path.replace(/^\//, '');
        var dir = wcPath.substring(0, wcPath.lastIndexOf('/'));
        var ensureDir = dir
          ? self.wc.fs.mkdir(dir, { recursive: true })
          : Promise.resolve();
        return ensureDir.then(function () {
          return self.wc.fs.writeFile(wcPath, files[path]);
        });
      });
    });
    return p;
  };

  NodeChannel.prototype._fail = function (msg) {
    console.error('[NodeChannel]', msg);
    if (this.controller && typeof this.controller.onDebugComplete === 'function') {
      this.controller.onDebugComplete({ exitCode: 1, error: msg });
    }
  };

  // ---- Stdout reader -----------------------------------------------------

  NodeChannel.prototype._startReadingStdout = function (reader) {
    var self = this;
    function loop() {
      reader.read().then(function (result) {
        if (result.done) {
          // Process ended; flush remaining buffer to output panel
          if (self._stdoutBuf) {
            self._appendUserOutput(self._stdoutBuf);
            self._stdoutBuf = '';
          }
          return;
        }
        // WebContainer streams may yield strings or Uint8Array chunks depending
        // on SDK/runtime version.
        self._stdoutBuf += typeof result.value === 'string'
          ? result.value
          : self._decoder.decode(result.value, { stream: true });
        self._processStdoutBuffer();
        loop();
      }).catch(function (err) {
        // After dispose() releases the reader this rejects with an expected
        // "reader released" error. Distinguish that from real read failures:
        // if the controller still has an active session, surface as a fail
        // so the UI doesn't hang at "running…" forever.
        if (self.controller && self.controller.session) {
          console.error('[NodeChannel] stdout reader error:', err);
          self._fail('Lost stdout: ' + (err && err.message || err));
        }
      });
    }
    loop();
  };

  NodeChannel.prototype._processStdoutBuffer = function () {
    var buf = this._stdoutBuf;
    var out = '';
    var i = 0;
    while (i < buf.length) {
      var prefIdx = buf.indexOf(PROTO_PREFIX, i);
      if (prefIdx === -1) {
        // No more frames — everything from i is plain output (until possibly
        // a partial prefix at the end).
        var rest = buf.slice(i);
        var keep = partialPrefixLength(rest);
        out += rest.slice(0, rest.length - keep);
        i = buf.length - keep;
        break;
      }
      // Plain output before the next frame
      if (prefIdx > i) out += buf.slice(i, prefIdx);
      var sufIdx = buf.indexOf(PROTO_SUFFIX, prefIdx + PROTO_PREFIX.length);
      if (sufIdx === -1) {
        // Frame is incomplete; keep it (and everything after the unflushed
        // plain text) in the buffer for the next chunk.
        i = prefIdx;
        break;
      }
      var json = buf.slice(prefIdx + PROTO_PREFIX.length, sufIdx);
      try {
        var msg = JSON.parse(json);
        this._dispatchMessage(msg);
      } catch (e) {
        console.warn('[NodeChannel] bad TTD frame:', e, json.slice(0, 200));
      }
      i = sufIdx + PROTO_SUFFIX.length;
    }
    if (out) this._appendUserOutput(out);
    this._stdoutBuf = buf.slice(i);
    // Cap: if a malformed/long stretch is sitting in the buffer waiting for a
    // PROTO_SUFFIX that may never arrive, dump it as plain output and reset
    // so the buffer can't grow without bound. The partialPrefixLength tail
    // preservation only keeps a few bytes, well below this cap.
    var MAX_BUF = 4 * 1024 * 1024;
    if (this._stdoutBuf.length > MAX_BUF) {
      console.warn('[NodeChannel] stdout buffer exceeded', MAX_BUF,
                   'bytes without protocol suffix; flushing as plain output');
      this._appendUserOutput(this._stdoutBuf);
      this._stdoutBuf = '';
    }
  };

  function partialPrefixLength(text) {
    var max = Math.min(PROTO_PREFIX.length - 1, text.length);
    for (var n = max; n > 0; n--) {
      if (text.slice(text.length - n) === PROTO_PREFIX.slice(0, n)) return n;
    }
    return 0;
  }

  NodeChannel.prototype._appendUserOutput = function (text) {
    if (!text) return;
    if (this.tutorial && typeof this.tutorial._appendOutput === 'function') {
      this.tutorial._appendOutput(text, 'stdout');
    }
  };

  NodeChannel.prototype._dispatchMessage = function (msg) {
    var c = this.controller;
    if (!c) return;
    if (msg.type === 'paused') c.onPaused(msg);
    else if (msg.type === 'debugComplete') c.onDebugComplete(msg);
    else if (msg.type === 'capReached') c.onCapReached(msg);
    else if (msg.type === 'breakpointError') c.onBreakpointError(msg);
    else if (msg.type === 'editError' && c.onEditError) c.onEditError(msg);
    else if (msg.type === 'log') console.log('[ttd]', msg.msg);
    else if (msg.type === 'debuggerError') console.error('[debugger]', msg.message);
  };

  // ---- Outbound: commands + queued updates ------------------------------

  NodeChannel.prototype._writeCommand = function (cmd) {
    if (!this.writer) return false;
    this.writer.write(JSON.stringify(cmd) + '\n').catch(function (err) {
      console.warn('[NodeChannel] failed to write command:', err && err.message || err);
    });
    return true;
  };

  NodeChannel.prototype._writeRuntimeUpdate = function (update) {
    update.update_only = true;
    return this._writeCommand(update);
  };

  NodeChannel.prototype._flushPendingRuntimeUpdates = function () {
    if (!this.writer) return false;
    var update = {};
    var hasUpdate = false;
    if (this._pendingWatches) {
      update.watches = this._pendingWatches;
      this._pendingWatches = null;
      hasUpdate = true;
    }
    if (this._pendingBpChanges) {
      update.breakpoint_changes = this._pendingBpChanges;
      this._pendingBpChanges = null;
      hasUpdate = true;
    }
    if (this._pendingExceptionBps) {
      update.exception_breakpoints = this._pendingExceptionBps;
      this._pendingExceptionBps = null;
      hasUpdate = true;
    }
    if (this._pendingLiveEdits) {
      update.live_edits = this._pendingLiveEdits;
      this._pendingLiveEdits = null;
      hasUpdate = true;
    }
    return hasUpdate ? this._writeRuntimeUpdate(update) : true;
  };

  NodeChannel.prototype.sendCommand = function (cmdCode) {
    if (!this.writer) return;
    var cmd = { code: cmdCode };
    if (this._pendingWatches) { cmd.watches = this._pendingWatches; this._pendingWatches = null; }
    if (this._pendingBpChanges) { cmd.breakpoint_changes = this._pendingBpChanges; this._pendingBpChanges = null; }
    if (this._pendingLiveEdits) { cmd.live_edits = this._pendingLiveEdits; this._pendingLiveEdits = null; }
    if (this._pendingExceptionBps) { cmd.exception_breakpoints = this._pendingExceptionBps; this._pendingExceptionBps = null; }
    this._writeCommand(cmd);
  };

  NodeChannel.prototype.sendWatches = function (watches) {
    var next = (watches || []).slice();
    if (!this.writer) {
      this._pendingWatches = next;
      return true;
    }
    this._pendingWatches = null;
    return this._writeRuntimeUpdate({ watches: next });
  };

  NodeChannel.prototype.sendBreakpointChanges = function (changes) {
    if (!Array.isArray(changes) || !changes.length) return true;
    var next = (this._pendingBpChanges || []).concat(changes);
    if (!this.writer) {
      this._pendingBpChanges = next;
      return true;
    }
    this._pendingBpChanges = null;
    return this._writeRuntimeUpdate({ breakpoint_changes: next });
  };

  NodeChannel.prototype.sendLiveEdits = function (edits) {
    if (!Array.isArray(edits) || !edits.length) return true;
    this._pendingLiveEdits = (this._pendingLiveEdits || []).concat(edits);
    return true;
  };

  NodeChannel.prototype.sendExceptionBreakpoints = function (excBps) {
    var next = (excBps || []).slice();
    if (!this.writer) {
      this._pendingExceptionBps = next;
      return true;
    }
    this._pendingExceptionBps = null;
    return this._writeRuntimeUpdate({ exception_breakpoints: next });
  };

  NodeChannel.prototype.sendHttpRequest = function (req) {
    if (!this.tutorial || typeof this.tutorial._sendWebContainerHttpRequest !== 'function') return false;
    return this.tutorial._sendWebContainerHttpRequest(req || {});
  };

  // Expose
  window.SEBookNodeChannel = NodeChannel;
})();
