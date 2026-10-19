'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

// Worker is the browser boundary. Control its replies so stale work and
// teardown can be tested deterministically without replacing owned analyzers.
function loadClient() {
  const workers = [];
  class ControlledWorker {
    constructor() { this.messages = []; this.terminated = false; workers.push(this); }
    postMessage(message) { this.messages.push(message); }
    terminate() { this.terminated = true; }
    reply(result) {
      const message = this.messages.shift();
      assert.ok(message, 'the browser worker has an outstanding request');
      this.onmessage({ data: { type: 'analysis', id: message.id, ok: true, result } });
    }
  }
  const context = vm.createContext({
    document: { currentScript: { src: 'https://example.test/js/uml-live.js' } },
    Worker: ControlledWorker, URL, setTimeout, clearTimeout, window: {}
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../js/uml-sequence-diagnostics.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../js/uml-analyzer-python.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../js/uml-expression-views.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../js/uml-diagram-views.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../js/uml-live.js'), 'utf8'), context);
  return { api: context.window.UMLLive, workers };
}

const request = name => ({ language: 'python', sources: { 'example.py': `class ${name}:\n    pass\n` } });
const diagram = name => ({ classDiagram: `class ${name}`, sequenceDiagram: '', errors: [] });

test('independent clients can analyze concurrently without superseding each other', async () => {
  const { api, workers } = loadClient();
  const first = api.createClient(), second = api.createClient();
  try {
    const firstResult = first.analyze(request('First'));
    const secondResult = second.analyze(request('Second'));
    workers[1].reply(diagram('Second'));
    workers[0].reply(diagram('First'));
    assert.equal((await firstResult).classDiagram, 'class First');
    assert.equal((await secondResult).classDiagram, 'class Second');
  } finally { first.dispose(); second.dispose(); }
});

test('TypeScript uses the shared AST analyzer queue', async () => {
  const { api, workers } = loadClient();
  const client = api.createClient();
  try {
    const result = client.analyze({ language: 'typescript', sources: { 'example.ts': 'class Student {}' } });
    assert.equal(workers.length, 1);
    assert.equal(workers[0].messages[0].lang, 'js');
    workers[0].reply(diagram('Student'));
    assert.equal((await result).classDiagram, 'class Student');
  } finally { client.dispose(); }
});

test('switching diagram views reuses current source analysis without changing its raw result', async () => {
  const { api, workers } = loadClient();
  const client = api.createClient();
  try {
    const pending = client.analyze(request('Sample'));
    const raw = { classDiagram: 'class Sample {\n  +name: str\n}', sequenceDiagram: '', errors: [] };
    workers[0].reply(raw);
    const result = await pending;
    assert.match(client.project(result, { language: 'python', view: 'design' }).classDiagram, /name: String/);
    assert.equal(client.project(result, { language: 'python', view: 'implementation' }).classDiagram, raw.classDiagram);
    assert.equal(workers[0].messages.length, 0, 'view changes do not dispatch another analysis');
  } finally { client.dispose(); }
});

test('a burst of edits replaces queued work without cancelling the latest answer', async () => {
  const { api, workers } = loadClient();
  const client = api.createClient();
  try {
    const active = client.analyze(request('Active'));
    const outdated = client.analyze(request('Outdated'));
    const superseded = assert.rejects(outdated, error => api.isSuperseded(error));
    const latest = client.analyze(request('Latest'));
    workers[0].reply(diagram('Active'));
    assert.equal((await active).classDiagram, 'class Active');
    assert.equal(workers[0].messages[0].sources['example.py'], request('Latest').sources['example.py']);
    workers[0].reply(diagram('Latest'));
    assert.equal((await latest).classDiagram, 'class Latest');
    await superseded;
  } finally { client.dispose(); }
});

test('a failed worker falls back to the real local analyzer', async () => {
  const { api, workers } = loadClient();
  const client = api.createClient();
  try {
    const result = client.analyze(request('Recovered'));
    workers[0].onerror({ message: 'Worker could not start' });
    assert.match((await result).classDiagram, /class Recovered/);
    assert.equal(workers[0].terminated, true);
    assert.match((await client.analyze(request('NextEdit'))).classDiagram, /class NextEdit/);
  } finally { client.dispose(); }
});

test('a stalled analysis times out without running the same source on the main thread', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { api, workers } = loadClient();
  const client = api.createClient();
  try {
    let outcome = 'pending';
    const result = client.analyze(request('Stalled')).then(
      () => { outcome = 'resolved'; },
      error => { outcome = error.umlTimeout ? 'timed out' : error.message; }
    );
    t.mock.timers.tick(10000);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(outcome, 'timed out', 'a stalled worker must not lock inference or fall back to synchronous analysis');
    await result;
    assert.equal(workers[0].terminated, true);

    const recovered = client.analyze(request('Recovered'));
    workers[1].reply(diagram('Recovered'));
    assert.equal((await recovered).classDiagram, 'class Recovered');
  } finally { client.dispose(); }
});

test('the newest queued edit runs automatically after an older analysis stalls', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { api, workers } = loadClient();
  const client = api.createClient();
  try {
    const stalled = client.analyze(request('Stalled')).catch(error => error);
    const outdated = client.analyze(request('Outdated'));
    const superseded = assert.rejects(outdated, error => api.isSuperseded(error));
    const latest = client.analyze(request('Latest'));
    t.mock.timers.tick(10000);
    assert.equal(workers[0].terminated, true);
    workers[1].reply(diagram('Latest'));
    assert.equal((await latest).classDiagram, 'class Latest');
    assert.equal((await stalled).umlTimeout, true);
    await superseded;

    // A late error from the terminated worker must not disable its replacement.
    workers[0].onerror({ message: 'Late worker error' });
    const next = client.analyze(request('NextEdit'));
    workers[1].reply(diagram('NextEdit'));
    assert.equal((await next).classDiagram, 'class NextEdit');
  } finally { client.dispose(); }
});

test('disposing a client releases its worker and rejects outstanding and future requests', async () => {
  const { api, workers } = loadClient();
  const client = api.createClient();
  const active = client.analyze(request('Active'));
  const queued = client.analyze(request('Queued'));
  const rejected = [active, queued].map(result => assert.rejects(result, error => api.isSuperseded(error)));
  client.dispose();
  await Promise.all(rejected);
  assert.equal(workers[0].terminated, true);
  await assert.rejects(client.analyze(request('AfterDisposal')), error => api.isSuperseded(error));
});
