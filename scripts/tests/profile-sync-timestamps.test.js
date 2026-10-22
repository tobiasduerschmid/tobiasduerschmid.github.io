const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const { pathToFileURL } = require('node:url');

const extensionPath = path.resolve('chrome-extension/sebook-profile-sync');
const origin = 'https://tobiasduerschmid.github.io';
const extensionId = 'phcfjcdliacndimckihgbpncoohjffad';
const siteSender = { id: extensionId, url: origin + '/SEBook/', origin, frameId: 0, tab: { id: 1, url: origin + '/SEBook/' } };
const note = (value, writtenAt) => ({ area: 'local', key: 'note', value, writtenAt });
const noteId = origin + '\u0000local\u0000note';
const load = (name) => import(pathToFileURL(path.join(extensionPath, name)).href);

function storageArea(initial = {}) {
  const values = structuredClone(initial);
  return {
    async get(keys) {
      if (keys == null) return structuredClone(values);
      return Object.fromEntries((Array.isArray(keys) ? keys : [keys])
        .filter((key) => Object.hasOwn(values, key)).map((key) => [key, structuredClone(values[key])]));
    },
    async set(update) { Object.assign(values, structuredClone(update)); },
    async remove(keys) { keys.forEach((key) => { delete values[key]; }); },
    async clear() { Object.keys(values).forEach((key) => { delete values[key]; }); },
    async getBytesInUse() { return JSON.stringify(values).length; },
  };
}

let workerSerial = 0;
async function worker(t, { now = 1_000_000, records = {}, local = {}, version } = {}) {
  const { encodeSyncPayload, decodeSyncPayload } = await load('sync-codec.js');
  const encoded = await encodeSyncPayload(records, { revision: 1, omittedCount: 0, updatedAt: now });
  if (version != null) encoded.meta.version = version;
  const stored = { m: encoded.meta };
  encoded.chunks.forEach((chunk, index) => { stored['c' + index] = chunk; });
  let onMessage;
  const chrome = {
    extension: { inIncognitoContext: false },
    runtime: {
      id: extensionId,
      getURL: (name) => `chrome-extension://${extensionId}/${name}`,
      onMessage: { addListener(listener) { onMessage = listener; } },
      onMessageExternal: { addListener() {} },
    },
    storage: { sync: storageArea(stored), local: storageArea(local) },
    tabs: { async query() { return []; }, async sendMessage() {} },
  };
  const previousChrome = globalThis.chrome;
  globalThis.chrome = chrome;
  t.after(() => { globalThis.chrome = previousChrome; });
  t.mock.method(Date, 'now', () => now);
  // Notifications are outside these storage/authorization tests.
  t.mock.method(globalThis, 'setTimeout', () => 0);
  await import(pathToFileURL(path.join(extensionPath, 'background.js')).href + '?test=' + ++workerSerial);
  return {
    chrome,
    setTime(value) { now = value; },
    send(entries, sender = siteSender, type = 'push') {
      return new Promise((resolve) => {
        if (onMessage({ type, entries }, sender, resolve) !== true) resolve(undefined);
      });
    },
    async records() { return (await decodeSyncPayload(await chrome.storage.sync.get(null))).records; },
  };
}

test('page timestamps never become persisted conflict clocks', async (t) => {
  const app = await worker(t);
  for (const writtenAt of [Number.MAX_SAFE_INTEGER, Infinity, NaN, -1, 1.5, '9999999999999999', 0]) {
    const result = await app.send([note(String(writtenAt), writtenAt)]);
    assert.equal(result.error, null);
    const saved = (await app.records())[noteId];
    assert.equal(saved.value, String(writtenAt));
    assert.ok(Number.isSafeInteger(saved.updatedAt));
    assert.ok(saved.updatedAt >= 1_000_000 && saved.updatedAt < 1_000_010);
  }
});

test('later edits supersede a forged write even in the same millisecond or after clock rollback', async (t) => {
  const app = await worker(t);
  await app.send([note('forged', Number.MAX_SAFE_INTEGER)]);
  await app.send([note('corrected')]);
  assert.equal((await app.records())[noteId].value, 'corrected');
  assert.equal((await app.records())[noteId].updatedAt, 1_000_001);
  app.setTime(999_000);
  await app.send([note('edited again', -1)]);
  assert.equal((await app.records())[noteId].value, 'edited again');
  assert.equal((await app.records())[noteId].updatedAt, 1_000_002);
});

test('an unrecognized browser snapshot cannot claim to be newer than the profile', async (t) => {
  const app = await worker(t, { records: { [noteId]: { value: 'profile', updatedAt: 900_000 } } });
  const result = await app.send([note('forged', Number.MAX_SAFE_INTEGER)], siteSender, 'hydrate');
  assert.equal((await app.records())[noteId].value, 'profile');
  assert.deepEqual(result.apply, [{ area: 'local', key: 'note', value: 'profile', deleted: false }]);
});

test('a legacy poisoned profile clock is repaired and remains editable', async (t) => {
  const app = await worker(t, {
    records: { [noteId]: { value: 'legacy', updatedAt: Number.MAX_SAFE_INTEGER, sourceDevice: 'desktop' } },
  });
  await app.send([note('legacy')], siteSender, 'hydrate');
  const repaired = (await app.records())[noteId];
  assert.ok(repaired.updatedAt >= 0 && repaired.updatedAt <= 1_000_000);
  assert.equal(repaired.value, 'legacy');
  assert.equal(repaired.sourceDevice, 'desktop');
  await app.send([note('corrected')]);
  assert.equal((await app.records())[noteId].value, 'corrected');
});

test('a legacy non-finite clock serialized as null cannot shadow later edits as an opaque record', async (t) => {
  const app = await worker(t, { version: 3, records: { [noteId]: { value: 'legacy', updatedAt: Infinity } } });
  assert.equal((await app.records())[noteId].updatedAt, null);
  await app.send([note('legacy')], siteSender, 'hydrate');
  await app.send([note('corrected')]);
  assert.equal((await app.records())[noteId].value, 'corrected');
  assert.ok(Number.isSafeInteger((await app.records())[noteId].updatedAt));
});

test('distinct edits with the same legacy hash still sync', async (t) => {
  const app = await worker(t);
  await app.send([note('costarring')]);
  await app.send([note('liquid')]);
  assert.equal((await app.records())[noteId].value, 'liquid');
});

test('the first edit after upgrading a legacy hash baseline is not lost to a collision', async (t) => {
  const app = await worker(t, {
    version: 3,
    records: { [noteId]: { value: 'costarring', updatedAt: 900_000 } },
    local: { lastSynced: { [noteId]: 'v:1582148253' } },
  });
  await app.send([note('liquid')]);
  assert.equal((await app.records())[noteId].value, 'liquid');
});

test('legacy hash migration still hydrates a newer profile value over unchanged local data', async (t) => {
  const app = await worker(t, {
    version: 3,
    records: { [noteId]: { value: 'remote edit', updatedAt: 900_000 } },
    local: { lastSynced: { [noteId]: 'v:1582148253' } },
  });
  const result = await app.send([note('costarring')], siteSender, 'hydrate');
  assert.equal((await app.records())[noteId].value, 'remote edit');
  assert.equal(result.apply[0].value, 'remote edit');
});

test('unchanged snapshots do not advance the profile clock', async (t) => {
  const app = await worker(t);
  await app.send([note('same', Number.MAX_SAFE_INTEGER)]);
  const before = (await app.records())[noteId].updatedAt;
  app.setTime(1_001_000);
  await app.send([note('same', Number.MAX_SAFE_INTEGER)]);
  assert.equal((await app.records())[noteId].updatedAt, before);
});

test('hydration upgrades an unchanged legacy profile so old copies cannot rewrite its clocks', async (t) => {
  const app = await worker(t, { version: 3, records: { [noteId]: { value: 'profile', updatedAt: 900_000 } } });
  await app.send([note('profile')], siteSender, 'hydrate');
  const { m } = await app.chrome.storage.sync.get('m');
  assert.equal(m.version, 4);
  assert.equal((await app.records())[noteId].updatedAt, 900_000);
});

test('a format newer than this extension stays read-only', async (t) => {
  const app = await worker(t, { version: 99, records: { [noteId]: { value: 'profile', updatedAt: 900_000 } } });
  const before = await app.chrome.storage.sync.get(null);
  const result = await app.send([note('page', Number.MAX_SAFE_INTEGER)]);
  assert.equal(result.readOnly, true);
  assert.deepEqual(await app.chrome.storage.sync.get(null), before);
});

test('a normal deletion supersedes a formerly forged value', async (t) => {
  const app = await worker(t);
  await app.send([note('forged', Number.MAX_SAFE_INTEGER)]);
  await app.send([]);
  const saved = (await app.records())[noteId];
  assert.equal(saved.deleted, true);
  assert.equal(saved.updatedAt, 1_000_001);
});

test('remote clocks preserve allowed skew and repair invalid or implausibly future times', async () => {
  const { splitRecords } = await load('sync-model.js');
  for (const [updatedAt, expected] of [
    [0, 0], [1_000_000, 1_000_000], [1_300_000, 1_300_000],
    [1_300_001, 0], [Number.MAX_SAFE_INTEGER, 0], [-1, 0], [Infinity, 0], [NaN, 0], [0.5, 0],
  ]) {
    const { known } = splitRecords({ [noteId]: { value: 'keep', updatedAt } }, origin, 1_000_000);
    assert.equal(known[noteId].updatedAt, expected, String(updatedAt));
    assert.equal(known[noteId].value, 'keep');
  }
});

test('sync mutations require this extension and an allowed top-level sender origin', async (t) => {
  const app = await worker(t);
  for (const sender of [
    undefined,
    { ...siteSender, id: 'another-extension' },
    { ...siteSender, frameId: 1 },
    { ...siteSender, url: 'https://evil.example/', origin: 'https://evil.example' },
    { ...siteSender, url: 'http://tobiasduerschmid.github.io/', origin: 'http://tobiasduerschmid.github.io' },
    { ...siteSender, origin: 'null' },
  ]) {
    // null bypasses the fixture's default sender for the missing-sender case.
    const result = await app.send([note('forged')], sender || null);
    assert.ok(!result || result.error);
    assert.equal((await app.records())[noteId], undefined);
  }
  await app.send([note('localhost')], {
    ...siteSender, url: 'http://localhost:4000/SEBook/', origin: 'http://localhost:4000',
  });
  assert.equal((await app.records())[noteId], undefined);
});

test('poisoned quota stamps cannot retain forged ordering metadata', async () => {
  const { prepareSiteEntries, mergeSiteSnapshot, entryHash } = await load('sync-model.js');
  const entries = [note('unsynced', Number.MAX_SAFE_INTEGER)];
  const prepared = await prepareSiteEntries(entries, {
    now: 1_000_000,
    origin,
    stamps: { [noteId]: { hash: await entryHash(entries[0]), updatedAt: Number.MAX_SAFE_INTEGER } },
    lastSynced: { [noteId]: await entryHash(entries[0]) },
  });
  const saved = mergeSiteSnapshot(prepared, {}, 1_000_000, origin).records[noteId];
  assert.equal(saved.value, 'unsynced');
  assert.ok(saved.updatedAt >= 0 && saved.updatedAt <= 1_000_000);
});

const settle = () => new Promise(setImmediate);
function coordinator({ reply = true } = {}) {
  const listeners = new Set();
  const timers = new Map();
  const requests = [];
  const sent = [];
  let timerSerial = 0;
  const window = {
    addEventListener(type, listener) { if (type === 'message') listeners.add(listener); },
    removeEventListener(type, listener) { if (type === 'message') listeners.delete(listener); },
    postMessage(message) {
      requests.push(message);
      if (reply && message.type === 'snapshot-request') {
        emit({ type: 'snapshot', requestId: message.requestId, snapshot: { entries: [note('real storage')], takenAt: 100 } });
      }
      if (message.type === 'apply') emit({ type: 'applied', requestId: message.requestId });
    },
  };
  window.top = window;
  function emit(message, source = window, eventOrigin = origin) {
    const event = { origin: eventOrigin, source, data: { channel: 'sebook-profile-sync', to: 'extension', ...message } };
    [...listeners].forEach((listener) => listener(event));
  }
  vm.runInNewContext(fs.readFileSync(path.join(extensionPath, 'content-script.js'), 'utf8'), {
    window, location: { origin }, crypto: webcrypto,
    document: { documentElement: { classList: { add() {}, remove() {} } } },
    localStorage: { length: 0 },
    chrome: {
      extension: { inIncognitoContext: false },
      runtime: {
        onMessage: { addListener() {} },
        async sendMessage(message) { sent.push(structuredClone(message)); return { apply: [], revision: 1 }; },
      },
    },
    setTimeout(callback, delay) { timers.set(++timerSerial, { callback, delay }); return timerSerial; },
    clearTimeout(id) { timers.delete(id); },
  });
  return {
    emit, requests, sent,
    tick(delay) {
      for (const [id, timer] of [...timers]) {
        if (timer.delay === delay) { timers.delete(id); timer.callback(); }
      }
    },
  };
}

for (const type of ['local-change', 'flush']) {
  test(`${type} notifications never forward an unsolicited snapshot`, async () => {
    const app = coordinator();
    await settle();
    app.emit({ type, snapshot: { entries: [note('forged', Number.MAX_SAFE_INTEGER)], takenAt: 100 } });
    app.tick(400);
    await settle();
    assert.equal(app.sent.length, 2);
    assert.equal(app.sent[1].entries[0].value, 'real storage');
  });
}

test('snapshot replies must match the current request, origin, and top-level window', async () => {
  const app = coordinator({ reply: false });
  await settle();
  const request = app.requests.find((message) => message.type === 'snapshot-request');
  const forged = { type: 'snapshot', requestId: request.requestId, snapshot: { entries: [note('forged')], takenAt: 100 } };
  app.emit({ ...forged, requestId: 'not-the-current-request' });
  app.emit(forged, {}, origin);
  app.emit(forged, undefined, 'https://evil.example');
  await settle();
  assert.equal(app.sent.length, 0);
  app.emit({ ...forged, snapshot: { entries: [note('real storage')], takenAt: 100 } });
  await settle();
  assert.equal(app.sent.length, 1);
  assert.equal(app.sent[0].entries[0].value, 'real storage');
  app.emit(forged);
  await settle();
  assert.equal(app.sent.length, 1, 'a consumed request cannot be replayed');
});
