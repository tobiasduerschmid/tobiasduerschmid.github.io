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
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../js/uml-analyzer-python.js'), 'utf8'), context);
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
