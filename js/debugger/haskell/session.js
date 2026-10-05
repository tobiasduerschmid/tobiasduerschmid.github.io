/** Adapt MicroHs equation decisions and lazy observations to debugger snapshots. */
(function (scope) {
  'use strict';

  function preview(nodes, path, depth = 0) {
    if (depth > 12) return '…';
    const value = nodes.get(path);
    if (!value) return '_';
    if (value.kind === 'scalar' || value.kind === 'expression') return value.value;
    if (value.kind === 'nil') return '[]';
    if (value.kind === 'opaque') return '<evaluated; no value preview>';
    if (value.kind === 'pair') return '(' + preview(nodes, path + '.0', depth + 1) + ', ' + preview(nodes, path + '.1', depth + 1) + ')';
    if (value.kind === 'just') return 'Just (' + preview(nodes, path + '.0', depth + 1) + ')';
    if (value.kind === 'cons') {
      const items = [];
      let tail = path;
      while (nodes.get(tail)?.kind === 'cons' && items.length < 12) {
        items.push(preview(nodes, tail + '.h', depth + 1));
        tail += '.t';
      }
      if (nodes.get(tail)?.kind === 'nil') return '[' + items.join(', ') + ']';
      return items.map(item => item.includes(' : ') ? '(' + item + ')' : item).join(' : ') + ' : ' + (items.length === 12 ? '…' : preview(nodes, tail, depth + 1));
    }
    return '_';
  }
  const valueFor = (repr, type = '') => ({ kind: 'primitive', type, repr });

  function knownValues(frame) {
    const nodes = new Map(frame.supplied);
    for (const [path, value] of frame.values) {
      if (value.kind !== 'opaque' || !nodes.has(path)) nodes.set(path, value);
    }
    return nodes;
  }

  /** Substitute only recorded bindings and syntax for constructed data.
   * Arithmetic, function calls, errors, and infinite ranges remain expressions.
   */
  function supply(nodes, path, expression, callerValues) {
    if (nodes.size >= 512 || path.length > 80) return;
    if (expression.kind === 'reference' && callerValues.has(expression.path)) {
      for (const [key, value] of callerValues) {
        if (nodes.size >= 512) break;
        if (key === expression.path || key.startsWith(expression.path + '.')) nodes.set(path + key.slice(expression.path.length), value);
      }
    } else if (expression.kind === 'list') {
      expression.items.forEach((item, i) => {
        const tail = path + '.t'.repeat(i);
        nodes.set(tail, { kind: 'cons' });
        supply(nodes, tail + '.h', item, callerValues);
      });
      nodes.set(path + '.t'.repeat(expression.items.length), { kind: 'nil' });
    } else if (expression.kind === 'pair') {
      nodes.set(path, { kind: 'pair' });
      expression.items.forEach((item, i) => supply(nodes, path + '.' + i, item, callerValues));
    } else nodes.set(path, { kind: 'expression', value: expression.text });
  }

  class HaskellDebugSession {
    constructor({ sites, options = {}, breakpoints = [], watches = [], send, resume, marker }) {
      this.sites = new Map(sites.map(site => [site.id, site]));
      this.send = send;
      this.resume = resume;
      this.marker = marker;
      this.frames = [];
      this.calls = new Map();
      this.buffer = [];
      this.breakpoints = new Map();
      this.watches = watches;
      this.command = 2;
      this.stopDepth = 0;
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
              error: 'Haskell breakpoints require a top-level equation, guard, or if condition.' });
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

    /** Probe payloads are Unicode code points, avoiding Haskell/JSON escapes. */
    consumeStderr(text) {
      this.stderrBuffer += text;
      let output = '', newline;
      while ((newline = this.stderrBuffer.indexOf('\n')) >= 0) {
        const line = this.stderrBuffer.slice(0, newline);
        this.stderrBuffer = this.stderrBuffer.slice(newline + 1);
        const markerIndex = line.indexOf(this.marker);
        const match = markerIndex < 0 ? null : line.slice(markerIndex + this.marker.length)
          .match(/^(call|return|try|match|reject|select|test|true|false|value|application|applied):(\d+):(\d+):(\[[\d, ]*\])\r?$/);
        if (!match) { output += line + '\n'; continue; }
        output += line.slice(0, markerIndex);
        const [, event, site, context, encoded] = match;
        const payload = JSON.parse(encoded).map(code => String.fromCodePoint(code)).join('');
        if (event === 'application') this.pendingApplication = { site: Number(site), context: Number(context) };
        else if (event === 'applied') {
          if (this.pendingApplication?.site === Number(site) && this.pendingApplication.context === Number(context)) this.pendingApplication = null;
        } else if (event === 'value') this.recordValue(Number(context), payload);
        else this.receiveProbe(event, Number(site), Number(context));
      }
      return output;
    }

    recordValue(context, payload) {
      const frame = this.calls.get(context);
      if (!frame) return;
      const [path, kind, ...value] = payload.split('\t');
      // Observers bound structural depth; also cap records per call defensively.
      if (frame.values.size < 512 || frame.values.has(path)) frame.values.set(path, { kind, value: value.join('\t') });
    }

    receiveProbe(event, siteId, context) {
      const site = this.sites.get(siteId);
      const mayPause = this.command !== 1 || this.eventCount + 1 >= this.limit ||
        (['select', 'test'].includes(event) && site && this.breakpoints.has(site.file + ':' + site.line));
      // Publish pauses only after stderr is appended and GETRAW has unwound.
      if (mayPause) setTimeout(() => this.observe(event, siteId, context), 0);
      else this.observe(event, siteId, context);
    }

    frameFor(site, context) {
      return { function: site.function, file: site.file, line: site.line,
        first_line: site.first_line, call_id: context, entry: site,
        values: new Map(), supplied: new Map(), bindings: {}, decisions: [],
        equations: (site.equations || []).map(eq => ({ ...eq, status: 'not reached' })) };
    }

    snapshotFrame(frame) {
      const known = knownValues(frame);
      const args = Array.from({ length: frame.entry.arity || 0 }, (_, i) => ({
        name: 'argument ' + (i + 1), ...valueFor(preview(known, 'arg' + i), frame.entry.argument_types?.[i] || ''),
        observed_repr: preview(frame.values, 'arg' + i),
        note: preview(known, 'arg' + i) !== preview(frame.values, 'arg' + i) ? 'supplied' : '' }));
      const locals = {};
      for (const [name, path] of Object.entries(frame.bindings)) {
        locals[name] = valueFor(path ? preview(known, path) : '<bound by pattern; no value preview>');
        if (path && preview(known, path) !== preview(frame.values, path)) locals[name].note = 'supplied';
      }
      return { function: frame.function, file: frame.file, line: frame.line,
        first_line: frame.first_line, call_id: frame.call_id, locals,
        arguments: args, invocation: frame.function + args.map(arg => {
          const atomic = /^(?:_|True|False|[0-9]+(?:\.[0-9]+)?|\[.*\]|\(.*\)|'.*')$/.test(arg.repr);
          return ' ' + (atomic ? arg.repr : '(' + arg.repr + ')');
        }).join(''),
        equations: frame.equations.map(eq => ({ ...eq })), decisions: frame.decisions.map(d => ({ ...d })) };
    }

    watchResults() {
      const result = {};
      for (const expression of this.watches) result[expression] = { error: 'Inspect the recorded arguments and bindings; arbitrary watch evaluation is unavailable.' };
      return result;
    }

    observe(event, siteId, context) {
      if (this.finished) return;
      const site = this.sites.get(siteId);
      if (!site) return;
      if (event === 'call') {
        const frame = this.frameFor(site, context);
        const application = this.pendingApplication;
        this.pendingApplication = null;
        const origin = this.sites.get(application?.site);
        if (origin?.callee === site.function && origin.file === site.file) {
          const caller = this.calls.get(application.context);
          const known = caller ? knownValues(caller) : new Map();
          origin.arguments.forEach((argument, i) => supply(frame.supplied, 'arg' + i, argument, known));
        }
        this.calls.set(context, frame);
        this.frames.push(frame);
      }
      const frame = this.calls.get(context);
      if (!frame) return;
      if (event !== 'return') frame.line = site.line;
      const equation = frame.equations.find(eq => eq.id === site.id || eq.id === site.equation);
      let description = '';
      switch (event) {
        case 'call': description = 'Demand ' + site.function; break;
        case 'try':
          equation.status = 'checking patterns'; frame.bindings = {};
          description = 'Try equation ' + (site.index + 1) + ': ' + site.header; break;
        case 'match':
          equation.status = 'patterns matched; checking guards'; frame.bindings = site.bindings;
          description = 'Patterns match: ' + site.header; break;
        case 'select':
          equation.status = 'selected'; frame.bindings = site.bindings;
          description = 'Use equation ' + (site.index + 1) + ': ' + site.header; break;
        case 'reject':
          equation.status = equation.status === 'checking patterns' ? 'pattern did not match' : 'no guard succeeded';
          description = equation.status + ': ' + site.header; break;
        case 'test': description = 'Check ' + (site.kind === 'guard' ? 'guard' : 'if') + ': ' + site.expression; break;
        case 'true': case 'false': {
          const decision = { line: site.line, expression: site.expression, result: event === 'true' ? 'True' : 'False', kind: site.kind };
          frame.decisions.push(decision);
          description = site.expression + ' → ' + decision.result + (site.kind === 'condition' ? (event === 'true' ? '; take then branch' : '; take else branch') : '');
          break;
        }
        case 'return': description = 'Result of ' + frame.function + ': ' + preview(frame.values, 'result'); break;
      }
      // A condition in a lazy field can be demanded after its enclosing call
      // returned. Show that captured scope without inventing a new invocation.
      const deferred = !this.frames.includes(frame);
      const stack = deferred ? [...this.frames, frame] : this.frames;
      const snapshot = { event, file: site.file, line: event === 'return' ? frame.line : site.line,
        depth: stack.length, call_id: context, description,
        deferred, stack: stack.map(f => this.snapshotFrame(f)), watches: this.watchResults() };
      if (event === 'return') {
        const result = /^IO\b/.test(frame.entry.result_type) ? '<IO action ready>' : preview(frame.values, 'result');
        snapshot.return_value = valueFor(result, frame.entry.result_type);
        snapshot.description = 'Result of ' + frame.function + ': ' + result;
        this.frames.pop();
      }
      this.buffer.push(snapshot);
      this.eventCount++;
      if (this.eventCount >= this.limit) {
        this.flushPause(snapshot);
        this.send({ type: 'capReached', limit: this.limit });
        this.send({ type: 'debugComplete', exitCode: 1, error: 'Haskell debugging stopped at the ' + this.limit + '-event history limit.' });
        this.finished = true;
      } else if (this.shouldPause(snapshot)) this.flushPause(snapshot);
      else this.resume();
    }

    shouldPause(snapshot) {
      if (['select', 'test'].includes(snapshot.event)) {
        const breakpoint = this.breakpoints.get(snapshot.file + ':' + snapshot.line);
        if (breakpoint) {
          breakpoint.hits++;
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
