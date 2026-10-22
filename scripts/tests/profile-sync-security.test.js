const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const { gzipSync } = require('node:zlib');
const { webcrypto } = require('node:crypto');
const { execFileSync } = require('node:child_process');

const extensionDir = path.resolve('chrome-extension/sebook-profile-sync');
const ORIGIN = 'https://tobiasduerschmid.github.io';
const load = (name) => import(pathToFileURL(path.join(extensionDir, name)).href);
const entry = (key, value = 'saved') => ({ area: 'local', key, value });

function storedJson(json, metadata = {}) {
  const payload = gzipSync(json).toString('base64');
  const stored = { m: { version: 1, revision: 1, chunks: 0, ...metadata } };
  for (let offset = 0; offset < payload.length; offset += 8000) {
    stored['c' + stored.m.chunks++] = payload.slice(offset, offset + 8000);
  }
  return stored;
}

let workerSerial = 0;
async function worker(t, initial = {}) {
  let receive;
  let storageReads = 0;
  const saved = { ...initial };
  const local = {};
  const previousChrome = global.chrome;
  global.chrome = {
    extension: { inIncognitoContext: false },
    runtime: {
      id: 'test-extension',
      getURL: (file) => 'chrome-extension://test-extension/' + file,
      onMessage: { addListener(fn) { receive = fn; } },
      onMessageExternal: { addListener() {} },
    },
    storage: {
      local: { async get() { storageReads++; return local; }, async set(data) { Object.assign(local, data); } },
      sync: {
        async get() { storageReads++; return saved; },
        async set(data) { Object.assign(saved, data); },
        async remove(keys) { keys.forEach((key) => delete saved[key]); },
        async getBytesInUse() { return 0; },
      },
    },
    tabs: { async query() { return []; } },
  };
  // The browser APIs are the boundary; merge, validation, gzip and storage framing stay real.
  t.mock.method(global, 'setTimeout', () => 0);
  t.after(() => { global.chrome = previousChrome; });
  await import(pathToFileURL(path.join(extensionDir, 'background.js')).href + '?test=' + workerSerial++);
  return {
    send: (message) => new Promise((resolve) => receive(message, {
      id: 'test-extension', url: ORIGIN + '/test', origin: ORIGIN, frameId: 0,
      tab: { id: 1, url: ORIGIN + '/test', incognito: false },
    }, resolve)),
    saved,
    get storageReads() { return storageReads; },
  };
}

const oversizedSnapshots = [
  ['entry count', Array.from({ length: 1025 }, (_, index) => entry('key-' + index)), []],
  ['key bytes', [entry('é'.repeat(513))], []],
  ['value bytes', [entry('draft', 'é'.repeat(131073))], []],
  ['aggregate bytes', Array.from({ length: 5 }, (_, index) => entry('key-' + index, 'x'.repeat(256 * 1024))), []],
  ['retired rule count', [], Array.from({ length: 129 }, () => ({ area: 'local', prefix: 'old-' }))],
  ['retired key bytes', [], [{ area: 'local', key: 'x'.repeat(1025) }]],
];
for (const [reason, entries, retired] of oversizedSnapshots) {
  test('worker rejects excessive ' + reason + ' before reading or writing storage', async (t) => {
    const background = await worker(t);
    const response = await background.send({ type: 'push', entries, retired });
    assert.match(response.error || '', /limit|too (large|many)/i);
    assert.equal(background.storageReads, 0);
    assert.deepEqual(background.saved, {});
  });
}

test('worker rejects a malformed snapshot instead of treating it as an empty deletion snapshot', async (t) => {
  const background = await worker(t);
  const response = await background.send({ type: 'push', entries: null, retired: [] });
  assert.match(response.error || '', /snapshot|entries/i);
  assert.equal(background.storageReads, 0);
});

test('ordinary snapshots still sync after an oversized request is rejected', async (t) => {
  const background = await worker(t);
  const rejected = await background.send({ type: 'push', entries: [entry('draft', 'x'.repeat(262145))], retired: [] });
  assert.ok(rejected.error);
  const accepted = await background.send({ type: 'push', entries: [entry('draft', 'small')], retired: [] });
  assert.equal(accepted.error, null);
  const { decodeSyncPayload } = await load('sync-codec.js');
  const decoded = await decodeSyncPayload(background.saved);
  assert.equal(decoded.records[ORIGIN + '\0local\0draft'].value, 'small');
});

test('a maximum-length site key can be synced with its origin namespace', async (t) => {
  const background = await worker(t);
  const key = 'é'.repeat(512);
  const response = await background.send({ type: 'push', entries: [entry(key)], retired: [] });
  assert.equal(response.error, null);
  const { decodeSyncPayload } = await load('sync-codec.js');
  const decoded = await decodeSyncPayload(background.saved);
  assert.equal(decoded.records[ORIGIN + '\0local\0' + key]?.value, 'saved');
});

test('origin-prefixed remote keys still enforce the storage-key byte limit', async () => {
  const { decodeSyncPayload } = await load('sync-codec.js');
  const records = { [ORIGIN + '\0local\0' + 'x'.repeat(1025)]: { value: 'saved', updatedAt: 1 } };
  await assert.rejects(decodeSyncPayload(storedJson(JSON.stringify(records))), /key.*limit/i);
});

test('snapshot entry, key, value and retired-rule limits accept their inclusive boundaries', async () => {
  const { validateSiteSnapshot, RESOURCE_LIMITS: limits } = await load('sync-validation.js');
  const entries = Array.from({ length: limits.maxEntries }, (_, index) => entry('key-' + index, ''));
  entries[0] = entry('é'.repeat(limits.maxKeyBytes / 2), 'é'.repeat(limits.maxValueBytes / 2));
  const retired = Array.from({ length: limits.maxRetiredRules }, () => ({ area: 'cookie', key: 'legacy' }));
  const checked = validateSiteSnapshot(entries, retired);
  assert.equal(checked.entries.length, entries.length);
  assert.equal(checked.entries[0].value, entries[0].value);
  assert.deepEqual(checked.retired, retired);
});

test('snapshot accounting includes JSON escaping and UTF-8 rather than only character counts', async () => {
  const { validateSiteSnapshot } = await load('sync-validation.js');
  assert.throws(() => validateSiteSnapshot([entry('escaped', '\0'.repeat(200000))]), /byte limit/);
});

test('snapshot validation strips unrelated fields before retaining a request', async () => {
  const { validateSiteSnapshot } = await load('sync-validation.js');
  const checked = validateSiteSnapshot([{ ...entry('draft'), unrelated: 'x'.repeat(2 * 1024 * 1024) }]);
  assert.deepEqual(checked.entries, [{ area: 'local', key: 'draft', value: 'saved', deleted: false }]);
});

test('decoder rejects a gzip expansion above 2 MiB before JSON parsing', async (t) => {
  const { decodeSyncPayload } = await load('sync-codec.js');
  const stored = storedJson(JSON.stringify({ 'local\0bomb': { value: 'x'.repeat(2 * 1024 * 1024), updatedAt: 1 } }));
  assert.ok(stored.c0.length < 10000, 'fixture fits comfortably in compressed sync storage');
  const parse = t.mock.method(JSON, 'parse');
  await assert.rejects(decodeSyncPayload(stored), /expanded|limit|too large/i);
  assert.equal(parse.mock.callCount(), 0);
});

test('decoder cancels an over-limit stream without draining its remaining output', async (t) => {
  const { decodeSyncPayload } = await load('sync-codec.js');
  let delivered = 0;
  let cancelled = false;
  t.mock.method(global, 'DecompressionStream', function () {
    return {
      writable: new WritableStream(),
      readable: new ReadableStream({
        pull(controller) {
          delivered++;
          controller.enqueue(new Uint8Array(64 * 1024));
          if (delivered === 100) controller.close();
        },
        cancel() { cancelled = true; },
      }),
    };
  });
  await assert.rejects(decodeSyncPayload(storedJson('{}')), /expanded|limit|too large/i);
  assert.equal(cancelled, true);
  assert.ok(delivered < 40, 'abort shortly after the 32 chunks that fit, with bounded stream read-ahead');
});

for (const chunks of [-1, 0.5, 512]) {
  test('decoder rejects invalid chunk count ' + chunks, async () => {
    const { decodeSyncPayload } = await load('sync-codec.js');
    await assert.rejects(decodeSyncPayload({ m: { version: 1, chunks } }), /chunk|payload|limit/i);
  });
}

test('decoder rejects missing chunks instead of accepting an empty profile', async () => {
  const { decodeSyncPayload } = await load('sync-codec.js');
  await assert.rejects(decodeSyncPayload({ m: { version: 1, chunks: 1 } }), /chunk|payload/i);
});

test('decoder rejects an incorrect declared expanded size', async () => {
  const { decodeSyncPayload } = await load('sync-codec.js');
  await assert.rejects(decodeSyncPayload(storedJson('{}', { expandedBytes: 1 })), /size|expanded/i);
});

test('decoder bounds record count even when the compressed JSON is small', async () => {
  const { decodeSyncPayload } = await load('sync-codec.js');
  const records = Object.fromEntries(Array.from({ length: 2049 }, (_, index) => ['local\0' + index, { value: '', updatedAt: 1 }]));
  await assert.rejects(decodeSyncPayload(storedJson(JSON.stringify(records))), /records|limit|too many/i);
});

test('a legacy payload at the expanded byte boundary remains readable', async () => {
  const { decodeSyncPayload } = await load('sync-codec.js');
  const records = Object.fromEntries(Array.from({ length: 8 }, (_, index) => ['local\0' + index, { value: 'x'.repeat(262144), updatedAt: 1 }]));
  const overhead = Buffer.byteLength(JSON.stringify(records)) - 2 * 1024 * 1024;
  records['local\x007'].value = records['local\x007'].value.slice(overhead);
  const json = JSON.stringify(records);
  assert.equal(Buffer.byteLength(json), 2 * 1024 * 1024);
  const decoded = await decodeSyncPayload(storedJson(json));
  assert.equal(decoded.records['local\x000'].value.length, 262144);
  assert.equal(decoded.records['local\x007'].value.length, 262144 - overhead);
});

test('decoder bounds the depth of opaque fields before later serialization', async () => {
  const { decodeSyncPayload } = await load('sync-codec.js');
  const nested = '{"nested":'.repeat(40) + '0' + '}'.repeat(40);
  await assert.rejects(decodeSyncPayload(storedJson('{"future\\u0000blob":' + nested + '}')), /complexity|limit/i);
});

test('decoder rejects non-finite chunk counts before touching chunk data', async () => {
  const { decodeSyncPayload } = await load('sync-codec.js');
  const stored = { m: { version: 1, chunks: Infinity }, get c0() { throw new Error('chunk was read'); } };
  await assert.rejects(decodeSyncPayload(stored), /chunk count/);
});

test('an unreadable remote profile is left untouched by a valid local push', async (t) => {
  const saved = storedJson(JSON.stringify({ 'local\0bomb': { value: 'x'.repeat(2 * 1024 * 1024), updatedAt: 1 } }));
  const background = await worker(t, saved);
  const response = await background.send({ type: 'push', entries: [entry('draft')], retired: [] });
  assert.match(response.error, /could not be read/i);
  assert.deepEqual(background.saved, saved);
});

test('encoder refuses highly compressible values above the expanded data limits', async () => {
  const { encodeSyncPayload } = await load('sync-codec.js');
  const encoded = await encodeSyncPayload({ 'local\0draft': { value: 'x'.repeat(262145), updatedAt: 1 } }, {
    revision: 1, omittedCount: 0, updatedAt: 1,
  });
  assert.equal(encoded.ok, false);
});

test('guarded profile writes make legacy v1/v2 clients read-only instead of retaining stale size metadata', async () => {
  const { encodeSyncPayload, decodeSyncPayload } = await load('sync-codec.js');
  const legacy = await decodeSyncPayload(storedJson('{"local\\u0000draft":{"value":"old","updatedAt":1}}'));
  assert.equal(legacy.newer, false);
  legacy.records['local\0draft'].value = 'updated';
  const encoded = await encodeSyncPayload(legacy.records, { revision: 2, omittedCount: 0, updatedAt: 2, previousMeta: legacy.meta });
  assert.ok(encoded.meta.version > 2, 'v1/v2 clients must classify this wire format as newer/read-only');
  const stored = { m: encoded.meta };
  encoded.chunks.forEach((chunk, index) => { stored['c' + index] = chunk; });
  const decoded = await decodeSyncPayload(stored);
  assert.equal(decoded.records['local\0draft'].value, 'updated');
  assert.equal(decoded.newer, false);
});

test('quota fitting uses at most 16 whole-payload encodes while preserving protected and opaque records', async () => {
  const { fitToQuota } = await load('sync-model.js');
  const records = Object.fromEntries(Array.from({ length: 1024 }, (_, index) => ['local\0' + index, { value: 'x', updatedAt: 2 }]));
  records['local\0saved'] = { value: 'old', updatedAt: 1 };
  records['future\0opaque'] = { kind: 'future' };
  let encodes = 0;
  const result = await fitToQuota(records, {
    quota: 2,
    protectedIds: ['local\0saved'],
    keepIds: ['future\0opaque'],
    encode: async (candidate) => {
      encodes++;
      return { ok: true, totalBytes: Object.keys(candidate).length };
    },
  });
  assert.equal(result.overQuota, undefined);
  assert.equal(result.records['local\0saved'].value, 'old');
  assert.equal(result.records['future\0opaque'].kind, 'future');
  assert.equal(result.omitted.length, 1024);
  assert.ok(encodes <= 16, 'whole-payload encoding is bounded independently of discarded record count: ' + encodes);
});

function coordinator() {
  const listeners = new Set();
  const sent = [];
  const requests = [];
  const timers = new Map();
  let timerId = 0;
  const window = {
    addEventListener(type, fn) { if (type === 'message') listeners.add(fn); },
    removeEventListener(type, fn) { listeners.delete(fn); },
    postMessage(message) {
      requests.push(message);
      if (message.type === 'apply') {
        for (const fn of [...listeners]) fn({
          origin: context.location.origin, source: window,
          data: { channel: 'sebook-profile-sync', to: 'extension', type: 'applied', requestId: message.requestId },
        });
      }
    },
  };
  window.top = window;
  const context = {
    window, location: { origin: 'https://tobiasduerschmid.github.io' }, crypto: webcrypto,
    document: { documentElement: { classList: { add() {}, remove() {} } } },
    chrome: {
      extension: { inIncognitoContext: false },
      runtime: {
        async sendMessage(message) { sent.push(message); return { apply: [], revision: 1 }; },
        onMessage: { addListener() {} },
      },
    },
    setTimeout(fn, delay) { timers.set(++timerId, { fn, delay }); return timerId; },
    clearTimeout(id) { timers.delete(id); },
  };
  vm.runInNewContext(fs.readFileSync(path.join(extensionDir, 'content-script.js'), 'utf8'), context);
  return {
    sent, requests,
    emit(data, source = window) {
      for (const fn of [...listeners]) fn({ origin: context.location.origin, source, data: { channel: 'sebook-profile-sync', to: 'extension', ...data } });
    },
    runPushTimers() {
      for (const [id, timer] of timers) if (timer.delay === 400) { timers.delete(id); timer.fn(); }
    },
  };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test('unsolicited page snapshots cannot become privileged push payloads', async () => {
  const bridge = coordinator();
  await settle();
  const request = bridge.requests.find((message) => message.type === 'snapshot-request');
  bridge.emit({ type: 'snapshot', requestId: request.requestId, snapshot: { entries: [], takenAt: 1 } });
  await settle();
  const forged = { entries: [entry('forged', 'attacker-data')], takenAt: 2 };
  bridge.emit({ type: 'local-change', snapshot: forged });
  bridge.emit({ type: 'flush', snapshot: forged });
  bridge.runPushTimers();
  await settle();
  assert.equal(bridge.sent.some((message) => message.entries.some((item) => item.key === 'forged')), false);
  const pending = bridge.requests.filter((message) => message.type === 'snapshot-request').at(-1);
  assert.notEqual(pending.requestId, request.requestId, 'a fresh solicited snapshot is required');
  bridge.emit({ type: 'snapshot', requestId: pending.requestId, snapshot: { entries: [entry('actual', 'stored-value')], takenAt: 3 } });
  await settle();
  assert.equal(bridge.sent.at(-1).entries[0].key, 'actual');
});

test('snapshot responses from another window do not reach the worker', async () => {
  const bridge = coordinator();
  await settle();
  const request = bridge.requests.find((message) => message.type === 'snapshot-request');
  bridge.emit({ type: 'snapshot', requestId: request.requestId, snapshot: { entries: [entry('forged')] } }, {});
  await settle();
  assert.equal(bridge.sent.length, 0);
});

test('a burst of flush notifications queues only one snapshot request', async () => {
  const bridge = coordinator();
  await settle();
  const request = bridge.requests[0];
  bridge.emit({ type: 'snapshot', requestId: request.requestId, snapshot: { entries: [] } });
  await settle();
  for (let index = 0; index < 100; index++) bridge.emit({ type: 'flush' });
  await settle();
  assert.equal(bridge.requests.filter((message) => message.type === 'snapshot-request').length, 2);
});

test('the downloadable extension contains the reviewed source and resource guards', () => {
  const files = fs.readdirSync(extensionDir).filter((file) => /\.(js|json|txt|html|css)$/.test(file));
  for (const file of files) {
    const shipped = execFileSync('unzip', ['-p', 'downloads/sebook-chrome-profile-sync.zip', 'sebook-chrome-profile-sync/' + file]);
    assert.ok(shipped.equals(fs.readFileSync(path.join(extensionDir, file))), 'outdated packaged file: ' + file);
  }
});
