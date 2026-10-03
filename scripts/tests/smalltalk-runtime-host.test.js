const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { MessageChannel } = require('node:worker_threads');
const { webcrypto } = require('node:crypto');
const turn = () => new Promise(resolve => setImmediate(resolve));
const program = { version: 1, stepKey: 'deadlines', revision: 0, files: [], changes: { version: 1, source: '', entries: [] }, runCommand: null };

// Control the browser Worker boundary and clock, not RuntimeHost internals or native semantics.
// Real MessagePorts exercise the public request/reply/cancellation transport contract.
async function runtime(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let worker;
  class WorkerBoundary {
    constructor() { worker = this; this.requests = []; this.terminated = false; }
    postMessage({ port, sessionId }) {
      this.port = port; this.sessionId = sessionId;
      port.onmessage = event => this.requests.push(event.data);
      port.postMessage({ ready: true, sessionId });
    }
    terminate() { this.terminated = true; this.port.close(); }
    reply(result) {
      const request = this.requests.at(-1);
      this.port.postMessage({ version: 1, sessionId: this.sessionId, requestId: request.requestId, revision: 0, result });
    }
  }
  const context = { window: {}, TextDecoder, URL, crypto: webcrypto, Worker: WorkerBoundary, MessageChannel,
    setTimeout, clearTimeout, AbortController, console };
  context.self = context.window;
  vm.createContext(context);
  for (const file of ['protocol.js', 'runtime-host.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../../js/smalltalk', file), 'utf8'), context);
  const api = context.window.SEBookSmalltalk;
  const host = new api.RuntimeHost(() => {}, new Map(), '', api.resolveLimits(), 'deadline-fixture', 'unused');
  t.after(() => host.dispose());
  const session = await host.openSession('live');
  const parse = vm.runInContext('JSON.parse', context);
  return { host, session, worker, data: value => parse(JSON.stringify(value)) };
}
function outcome(promise) {
  const result = { state: 'pending' };
  promise.then(value => Object.assign(result, { state: 'resolved', value }), error => Object.assign(result, { state: 'rejected', error }));
  return result;
}

test('Program initialization survives the ordinary deadline and can finish within the startup budget', async t => {
  const { host, session, worker, data } = await runtime(t);
  const loading = host.loadProgram(session, data(program)), result = outcome(loading);
  t.mock.timers.tick(30000); await turn();
  assert.equal(result.state, 'pending');
  assert.equal(worker.terminated, false);
  worker.reply(null); await loading;
  assert.equal(result.state, 'resolved');
});

test('Program initialization stops at the finite startup deadline', async t => {
  const { host, session, worker, data } = await runtime(t);
  const result = outcome(host.loadProgram(session, data(program)));
  t.mock.timers.tick(119999); await turn();
  assert.equal(result.state, 'pending');
  t.mock.timers.tick(1); await turn();
  assert.equal(result.state, 'rejected');
  assert.equal(result.error.code, 'TIMEOUT');
  assert.equal(worker.terminated, true);
});

for (const [purpose, deadline] of [[undefined, 30000], ['run', 60000], ['check', 60000]]) {
  test(`Evaluate keeps its ${purpose || 'ordinary'} deadline`, async t => {
    const { host, session, worker, data } = await runtime(t);
    const result = outcome(host.request(session, 'evaluate', data({ source: '[true] whileTrue', bindings: 'workspace' }), { purpose }));
    t.mock.timers.tick(deadline - 1); await turn();
    assert.equal(result.state, 'pending');
    t.mock.timers.tick(1); await turn();
    assert.equal(result.error.code, 'TIMEOUT');
    assert.equal(worker.terminated, true);
  });
}

test('Program initialization remains cancellable after the ordinary deadline', async t => {
  const { host, session, worker, data } = await runtime(t);
  const controller = new AbortController();
  const result = outcome(host.request(session, 'loadProgram', data({ program }), { signal: controller.signal }));
  t.mock.timers.tick(30001); await turn();
  assert.equal(result.state, 'pending');
  controller.abort(); await turn();
  assert.equal(result.error.code, 'CANCELLED');
  assert.equal(worker.terminated, true);
});
