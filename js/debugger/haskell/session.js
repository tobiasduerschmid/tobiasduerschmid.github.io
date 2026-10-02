/** Adapt real MicroHs demand events to the shared debugger snapshot protocol. */
(function (scope) {
  'use strict';

  class HaskellDebugSession {
    constructor({ sites, options = {}, breakpoints = [], watches = [], send, resume, marker }) {
      this.sites = new Map(sites.map(site => [site.id, site]));
      this.send = send;
      this.resume = resume;
      this.marker = marker;
      this.frames = [];
      this.buffer = [];
      this.breakpoints = new Map();
      this.watches = watches;
      this.command = 2;
      this.stopDepth = 0;
      this.callSequence = 0;
      this.eventCount = 0;
      this.limit = Math.max(1, Math.min(Number(options.max_history) || 2000, 10000));
      this.paused = false;
      this.stderrBuffer = '';
      this.finished = false;
      this.lastSnapshot = null;
      this.updateBreakpoints(breakpoints);
    }

    updateBreakpoints(changes) {
      for (const breakpoint of changes) {
        const file = breakpoint.file || breakpoint.path;
        const key = file + ':' + breakpoint.line;
        if (breakpoint.remove || breakpoint.action === 'remove' || breakpoint.op === 'remove') this.breakpoints.delete(key);
        else {
          this.breakpoints.set(key, { ...breakpoint, hits: 0 });
          if (![...this.sites.values()].some(site => site.file === file && site.line === breakpoint.line)) {
            this.send({ type: 'breakpointError', file, line: breakpoint.line,
              error: 'Haskell breakpoints require a top-level equation or Boolean guard line.' });
          }
          if (breakpoint.condition) this.send({ type: 'breakpointError', file,
            line: breakpoint.line, error: 'Haskell demand breakpoints do not evaluate conditions.' });
        }
      }
    }

    handleMessage(message) {
      if (message.type === 'breakpoints') this.updateBreakpoints(message.changes || []);
      else if (message.type === 'watches') this.watches = message.watches || [];
      else if (message.type === 'command' && this.paused) {
        if (message.command === 6) {
          this.lastSnapshot.watches = this.watchResults();
          this.send({ type: 'paused', snapshots: [this.lastSnapshot], replace_last: true });
          return;
        }
        if (![1, 2, 3, 4].includes(message.command)) return;
        this.command = message.command;
        this.stopDepth = this.lastSnapshot.depth;
        this.paused = false;
        this.resume();
      }
    }

    /** Return user stderr, consuming only complete, session-specific probe records. */
    consumeStderr(text) {
      this.stderrBuffer += text;
      let output = '';
      let newline;
      while ((newline = this.stderrBuffer.indexOf('\n')) >= 0) {
        const line = this.stderrBuffer.slice(0, newline);
        this.stderrBuffer = this.stderrBuffer.slice(newline + 1);
        const markerIndex = line.indexOf(this.marker);
        const event = markerIndex < 0 ? null : line.slice(markerIndex + this.marker.length).match(/^(call|return):(\d+)\r?$/);
        if (event) {
          output += line.slice(0, markerIndex);
          this.receiveProbe(event[1], Number(event[2]));
        } else output += line + '\n';
      }
      return output;
    }

    receiveProbe(event, siteId) {
      const site = this.sites.get(siteId);
      const mayPause = this.command !== 1 || this.eventCount + 1 >= this.limit ||
        (event === 'call' && site && this.breakpoints.has(site.file + ':' + site.line));
      if (mayPause) {
        // Publish pauses only after the adapter has appended preceding stderr
        // and the evaluator has unwound into GETRAW's asynchronous input wait.
        setTimeout(() => this.observe(event, siteId), 0);
      } else {
        // Continue can queue its acknowledgement before GETRAW starts polling.
        // This avoids a 10ms input wait per event; MicroHs still yields normally.
        this.observe(event, siteId);
      }
    }

    frameFor(site) {
      const locals = {};
      for (const name of site.bindings) {
        locals[name] = { kind: 'primitive', type: 'Haskell value',
          repr: '<not inspected: preserves lazy evaluation>' };
      }
      return { function: site.function, file: site.file, line: site.line,
        first_line: site.first_line, locals, globals: {}, closure: {},
        call_id: ++this.callSequence };
    }

    watchResults() {
      const result = {};
      for (const expression of this.watches) {
        result[expression] = { error: 'Haskell demand tracing does not evaluate watch expressions.' };
      }
      return result;
    }

    observe(event, siteId) {
      if (this.finished) return;
      const site = this.sites.get(siteId);
      if (!site) return;
      if (event === 'call') this.frames.push(this.frameFor(site));
      const top = this.frames[this.frames.length - 1];
      if (!top) return;
      const snapshot = { event, file: site.file, line: site.line,
        depth: this.frames.length, call_id: top.call_id,
        stack: this.frames.map(frame => ({ ...frame })), watches: this.watchResults() };
      if (event === 'return') {
        snapshot.return_value = { kind: 'primitive', type: 'Haskell value',
          repr: '<evaluated to weak head normal form>' };
        this.frames.pop();
      }
      this.buffer.push(snapshot);
      this.eventCount += 1;
      if (this.eventCount >= this.limit) {
        this.flushPause(snapshot);
        this.send({ type: 'capReached', limit: this.limit });
        this.send({ type: 'debugComplete', exitCode: 1,
          error: 'Haskell debugging stopped at the ' + this.limit + '-event history limit.' });
        this.finished = true;
      } else if (this.shouldPause(snapshot)) this.flushPause(snapshot);
      else this.resume();
    }

    shouldPause(snapshot) {
      if (snapshot.event === 'call') {
        const breakpoint = this.breakpoints.get(snapshot.file + ':' + snapshot.line);
        if (breakpoint) {
          breakpoint.hits += 1;
          if (!breakpoint.hitCount || breakpoint.hits >= breakpoint.hitCount) return true;
        }
      }
      if (this.command === 2) return true;
      if (this.command === 3) return snapshot.depth <= this.stopDepth;
      if (this.command === 4) return snapshot.event === 'return' && snapshot.depth <= this.stopDepth;
      return false;
    }

    flushPause(snapshot) {
      this.lastSnapshot = snapshot;
      this.paused = true;
      this.send({ type: 'paused', snapshots: this.buffer });
      this.buffer = [];
    }

    complete(exitCode, error, errorReported = false) {
      if (this.finished) return;
      this.finished = true;
      this.send({ type: 'debugComplete', exitCode, error, errorReported, snapshots: this.buffer });
      this.buffer = [];
    }
  }

  const api = { HaskellDebugSession };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else scope.SEBookHaskellDebug = api;
})(globalThis);
