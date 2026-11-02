const { test } = require('node:test');
const assert = require('node:assert/strict');
const clientModule = import('../../js/aadl/client.mjs');

function runtimeBoundary({ deferred = false } = {}) {
  const sessions = [];
  return {
    sessions,
    openSession: options => {
      const session = {
        closed: false, request: null, requests: [], signal: options.signal,
        send(id, request) { this.id = id; this.request = request; this.requests.push({ id, request }); },
        close() { this.closed = true; },
        reply(result, id = this.id) { options.onMessage({ type: 'result', id, result }); },
        fail(message) { options.onMessage({ type: 'fatal', message }); },
        progress(detail) { options.onProgress(detail); },
      };
      sessions.push(session);
      return deferred ? new Promise(resolve => { session.ready = () => resolve(session); }) : Promise.resolve(session);
    },
  };
}
const invalid = { version: 1, status: 'invalid', diagnostics: [{ severity: 'error', message: 'Unknown classifier.' }], analyses: [] };
const request = { version: 1, operation: 'validate', root: 'P::S.i', files: { 'Model.aadl': 'source' } };

test('Stop resolves the pending request and a late runtime result cannot complete another run', async () => {
  const { AADLClient } = await clientModule;
  const runtime = runtimeBoundary();
  const client = new AADLClient(runtime);
  const first = client.execute(request);
  await Promise.resolve();
  client.cancel();
  assert.equal((await first).reason, 'canceled');
  assert.equal(runtime.sessions[0].closed, true);
  const second = client.execute(request);
  await Promise.resolve();
  runtime.sessions[0].reply(invalid);
  runtime.sessions[1].reply(invalid);
  assert.equal((await second).status, 'invalid');
  assert.equal(runtime.sessions[1].closed, false);
  client.destroy();
});

test('completed validation retains a warm engine while each request keeps its own result identity', async () => {
  const { AADLClient } = await clientModule;
  const runtime = runtimeBoundary();
  const client = new AADLClient(runtime);
  const first = client.execute(request);
  await Promise.resolve();
  const session = runtime.sessions[0];
  const firstId = session.id;
  session.reply(invalid);
  assert.equal((await first).status, 'invalid');
  client.cancel(); // Editing an idle model must not discard the expensive JVM.
  assert.equal(session.closed, false);
  const second = client.execute({ ...request, root: 'P::Changed.i' });
  await Promise.resolve();
  assert.equal(runtime.sessions.length, 1);
  assert.equal(session.request.root, 'P::Changed.i');
  let completed = false;
  second.then(() => { completed = true; });
  session.reply(invalid, firstId);
  await Promise.resolve();
  assert.equal(completed, false);
  session.reply(invalid);
  assert.equal((await second).status, 'invalid');
  client.destroy();
  assert.equal(session.closed, true);
});

test('cancel during startup closes a session that becomes available after cancellation', async () => {
  const { AADLClient } = await clientModule;
  let finishStartup;
  const session = { closed: false, send() { assert.fail('A canceled request must not execute.'); }, close() { this.closed = true; } };
  const client = new AADLClient({ openSession: () => new Promise(resolve => { finishStartup = resolve; }) });
  const pending = client.execute(request);
  client.cancel();
  finishStartup(session);
  await Promise.resolve();
  assert.equal((await pending).reason, 'canceled');
  assert.equal(session.closed, true);
  client.destroy();
});

test('a malformed engine result is an error and releases its execution session', async () => {
  const { AADLClient } = await clientModule;
  const runtime = runtimeBoundary();
  const client = new AADLClient(runtime);
  const pending = client.execute(request);
  await Promise.resolve();
  runtime.sessions[0].reply({ version: 1, status: 'complete', diagnostics: [] });
  const result = await pending;
  assert.equal(result.status, 'error');
  assert.equal(result.reason, 'protocol-error');
  assert.equal(runtime.sessions[0].closed, true);
  client.destroy();
});

test('a disposed client cannot start another runtime', async () => {
  const { AADLClient } = await clientModule;
  const runtime = runtimeBoundary();
  const client = new AADLClient(runtime);
  client.destroy();
  assert.equal((await client.execute(request)).reason, 'disposed');
  assert.equal(runtime.sessions.length, 0);
});

test('source edits during startup share one boot and execute only the latest snapshot', async t => {
  const { AADLClient } = await clientModule;
  const runtime = runtimeBoundary({ deferred: true });
  const client = new AADLClient(runtime);
  t.after(() => client.destroy());
  const first = client.execute(request);
  client.supersede();
  assert.equal((await first).reason, 'canceled');
  const latest = client.execute({ ...request, root: 'P::Latest.i' });
  const session = runtime.sessions[0];
  assert.equal(runtime.sessions.length, 1);
  assert.equal(session.signal.aborted, false);
  assert.equal(session.requests.length, 0);
  session.ready();
  await Promise.resolve();
  assert.equal(session.requests.length, 1);
  assert.equal(session.request.root, 'P::Latest.i');
  session.reply(invalid);
  assert.equal((await latest).status, 'invalid');
});

test('editing during a warm analysis drains old work before checking the latest source', async t => {
  const { AADLClient } = await clientModule;
  const runtime = runtimeBoundary();
  const phases = [];
  const client = new AADLClient({ ...runtime, onPhase: phase => phases.push(phase) });
  t.after(() => client.destroy());
  const initial = client.execute(request);
  await Promise.resolve();
  const session = runtime.sessions[0];
  session.reply(invalid);
  await initial;
  const old = client.execute({ ...request, operation: 'analyze' });
  const oldId = session.id;
  client.supersede();
  assert.equal((await old).reason, 'canceled');
  const latest = client.execute({ ...request, root: 'P::Latest.i' });
  assert.equal(phases.at(-1), 'waiting');
  let completed = false;
  latest.then(() => { completed = true; });
  assert.equal(session.requests.length, 2);
  assert.equal(session.closed, false);
  session.reply(invalid, oldId);
  await Promise.resolve();
  assert.equal(completed, false);
  assert.equal(runtime.sessions.length, 1);
  assert.equal(session.requests.length, 3);
  assert.equal(session.request.root, 'P::Latest.i');
  session.reply(invalid);
  assert.equal((await latest).status, 'invalid');
});

test('edits cannot extend the startup deadline', async t => {
  const { AADLClient } = await clientModule;
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const runtime = runtimeBoundary({ deferred: true });
  const client = new AADLClient({ ...runtime, bootTimeoutMs: 100 });
  t.after(() => client.destroy());
  const first = client.execute(request);
  t.mock.timers.tick(90);
  client.supersede();
  await first;
  const latest = client.execute(request);
  t.mock.timers.tick(10);
  assert.equal((await latest).reason, 'startup-timeout');
  assert.equal(runtime.sessions[0].signal.aborted, true);
});

test('superseded analysis keeps its time limit and releases a waiting request on timeout', async t => {
  const { AADLClient } = await clientModule;
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const runtime = runtimeBoundary();
  const client = new AADLClient({ ...runtime, runTimeoutMs: 100 });
  t.after(() => client.destroy());
  const first = client.execute(request);
  await Promise.resolve();
  t.mock.timers.tick(90);
  client.supersede();
  await first;
  const latest = client.execute(request);
  t.mock.timers.tick(10);
  assert.equal((await latest).reason, 'time-limit');
  assert.equal(runtime.sessions[0].closed, true);
  assert.equal(runtime.sessions[0].requests.length, 1);
});

test('Stop terminates startup after the edited request has already been superseded', async t => {
  const { AADLClient } = await clientModule;
  const runtime = runtimeBoundary({ deferred: true });
  const client = new AADLClient(runtime);
  t.after(() => client.destroy());
  const pending = client.execute(request);
  client.supersede();
  await pending;
  client.cancel();
  assert.equal(runtime.sessions[0].signal.aborted, true);
  runtime.sessions[0].ready();
  await Promise.resolve();
  assert.equal(runtime.sessions[0].closed, true);
});

test('a fatal error while old work drains also settles the latest waiting request', async t => {
  const { AADLClient } = await clientModule;
  const runtime = runtimeBoundary();
  const client = new AADLClient(runtime);
  t.after(() => client.destroy());
  const old = client.execute(request);
  await Promise.resolve();
  client.supersede();
  await old;
  const latest = client.execute(request);
  runtime.sessions[0].fail('Runtime crashed.');
  assert.equal((await latest).reason, 'runtime-error');
  assert.equal(runtime.sessions[0].closed, true);
});

test('Stop terminates superseded analysis even before another snapshot is submitted', async t => {
  const { AADLClient } = await clientModule;
  const runtime = runtimeBoundary();
  const client = new AADLClient(runtime);
  t.after(() => client.destroy());
  const old = client.execute(request);
  await Promise.resolve();
  client.supersede();
  await old;
  client.cancel();
  assert.equal(runtime.sessions[0].closed, true);
  assert.equal(runtime.sessions[0].signal.aborted, true);
});

test('startup progress and elapsed time survive source edits without accepting a canceled runtime update', async t => {
  const { AADLClient } = await clientModule;
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 });
  const runtime = runtimeBoundary({ deferred: true });
  const phases = [];
  const client = new AADLClient({ ...runtime, onPhase: (phase, detail) => phases.push({ phase, detail }) });
  t.after(() => client.destroy());
  const first = client.execute(request);
  t.mock.timers.tick(500);
  runtime.sessions[0].progress({ stage: 'services' });
  assert.equal(phases.at(-1).detail.stage, 'services');
  assert.equal(phases.at(-1).detail.elapsedMs, 500);
  client.supersede();
  await first;
  t.mock.timers.tick(500);
  const latest = client.execute(request);
  assert.equal(phases.at(-1).detail.stage, 'services');
  assert.equal(phases.at(-1).detail.elapsedMs, 1000);
  client.cancel();
  await latest;
  const count = phases.length;
  runtime.sessions[0].progress({ stage: 'language' });
  assert.equal(phases.length, count);
});
