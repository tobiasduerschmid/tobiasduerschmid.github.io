const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness(backend = 'prolog') {
  const executors = [];
  const events = [];
  const timers = new Map();
  let nextTimer = 0;
  class Executor {
    constructor() { this.sent = []; this.terminated = false; executors.push(this); }
    postMessage(message) { this.sent.push(message); }
    terminate() { this.terminated = true; }
    emit(message) { this.onmessage({ data: message }); }
  }
  const context = {
    window: {}, Worker: Executor, console,
    setTimeout: callback => { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimeout: id => timers.delete(id),
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../js/debugger/language-channel.js'), 'utf8'), context);
  const controller = {
    onPaused: event => events.push(event),
    onDebugComplete: event => events.push(event),
    onBreakpointError: event => events.push(event),
    onCapReached: event => events.push(event),
  };
  const tutorial = {
    config: { backend },
    _createHaskellExecutor: () => new Executor(),
    _appendOutput: (text, type) => events.push({ type, text }),
  };
  const channel = new context.window.SEBookLanguageChannel(controller, tutorial);
  const start = () => channel.startSession({ filename: '/tutorial/Main.hs', code: 'main = print 42', options: {} });
  return { channel, start, executors, events, timers };
}

for (const backend of ['prolog', 'haskell']) {
  test(`${backend} waits for readiness, pauses without a deadline, and resumes with a deadline`, () => {
    const h = harness(backend);
    h.start();
    const runtime = h.executors[0];
    assert.equal(runtime.sent.length, 0);
    runtime.emit({ type: 'ready' });
    assert.equal(runtime.sent[0].type, 'start');
    assert.equal(runtime.sent[0].code, 'main = print 42');
    runtime.emit({ type: 'paused', snapshots: [{ line: 2 }] });
    assert.equal(h.timers.size, 0, 'Reading a paused program has no time limit');
    assert.equal(h.events[0].snapshots[0].line, 2);
    h.channel.sendCommand(2);
    assert.equal(runtime.sent[1].command, 2);
    assert.equal(h.timers.size, 1);
    h.channel.dispose();
  });

  test(`${backend} Stop destroys execution and ignores messages from an earlier run`, async () => {
    const h = harness(backend);
    h.start();
    const stale = h.executors[0];
    h.channel.sendCommand(5);
    assert.equal(stale.terminated, true);
    h.start();
    await Promise.resolve();
    stale.emit({ type: 'debugComplete', exitCode: 1 });
    assert.equal(h.events.length, 0, 'An old completion must not close the new session');
    const active = h.executors[1];
    active.emit({ type: 'ready' });
    active.emit({ type: 'stdout', text: '42\n' });
    assert.equal(h.events[0].text, '42\n');
    h.channel.sendCommand(5);
    await Promise.resolve();
    assert.equal(h.events[1].stopped, true);
    assert.equal(h.timers.size, 0);
  });

  test(`${backend} reports an execution timeout and releases the runtime`, () => {
    const h = harness(backend);
    h.start();
    h.executors[0].emit({ type: 'ready' });
    const expire = [...h.timers.values()][0];
    expire();
    assert.equal(h.executors[0].terminated, true);
    assert.equal(h.events[0].exitCode, 1);
    assert.match(h.events[0].error, /timed out/);
    assert.equal(h.timers.size, 0);
  });
}
