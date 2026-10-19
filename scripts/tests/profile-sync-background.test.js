const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const SITE = 'https://tobiasduerschmid.github.io';
const EXTENSION_ID = 'phcfjcdliacndimckihgbpncoohjffad';
let workerSerial = 0;

function load(name) {
  return import(pathToFileURL(path.resolve('chrome-extension/sebook-profile-sync', name)).href);
}

function pageSender(url = SITE + '/SEBook/') {
  return {
    id: EXTENSION_ID,
    url,
    origin: new URL(url).origin,
    frameId: 0,
    tab: { id: 1, url, incognito: false },
  };
}

// Only the Chrome I/O boundary is replaced; the worker, merge rules and codec run unchanged.
async function startWorker(t, { records = {}, version, local = {} } = {}) {
  const { encodeSyncPayload, decodeSyncPayload } = await load('sync-codec.js');
  const encoded = await encodeSyncPayload(records, { revision: 1, omittedCount: 0, updatedAt: 1 });
  if (version != null) encoded.meta.version = version;
  const sync = { m: encoded.meta };
  encoded.chunks.forEach((chunk, index) => { sync['c' + index] = chunk; });
  const localData = structuredClone(local);
  const listeners = {};
  const storage = (data) => ({
    async get(keys) {
      if (keys == null) return structuredClone(data);
      const names = typeof keys === 'string' ? [keys] : keys;
      return structuredClone(Object.fromEntries(names.filter((key) => key in data).map((key) => [key, data[key]])));
    },
    async set(values) { Object.assign(data, structuredClone(values)); },
    async remove(keys) { keys.forEach((key) => { delete data[key]; }); },
    async clear() { Object.keys(data).forEach((key) => { delete data[key]; }); },
    async getBytesInUse() { return Buffer.byteLength(JSON.stringify(data)); },
  });
  const previousChrome = globalThis.chrome;
  globalThis.chrome = {
    extension: { inIncognitoContext: false },
    runtime: {
      id: EXTENSION_ID,
      getURL: (name) => `chrome-extension://${EXTENSION_ID}/${name}`,
      onMessage: { addListener: (listener) => { listeners.internal = listener; } },
      onMessageExternal: { addListener: (listener) => { listeners.external = listener; } },
    },
    storage: { sync: storage(sync), local: storage(localData) },
    tabs: { async query() { return []; }, async sendMessage() {} },
  };
  t.after(() => { globalThis.chrome = previousChrome; });
  // Notification delivery is not part of these request/response tests.
  t.mock.method(globalThis, 'setTimeout', () => 0);
  const workerUrl = pathToFileURL(path.resolve('chrome-extension/sebook-profile-sync/background.js'));
  workerUrl.searchParams.set('test', workerSerial += 1);
  await import(workerUrl.href);
  return {
    sync,
    local: localData,
    async records() { return (await decodeSyncPayload(sync)).records; },
    send(message, sender = pageSender(), channel = 'internal') {
      return new Promise((resolve) => {
        if (listeners[channel](message, sender, resolve) !== true) resolve(undefined);
      });
    },
  };
}

test('hydrate only applies records belonging to the trusted exact origin', async (t) => {
  const worker = await startWorker(t, { records: {
    [SITE + '\u0000local\u0000theme']: { value: 'production', updatedAt: 1 },
    'http://localhost:4000\u0000local\u0000theme': { value: 'localhost', updatedAt: 2 },
    'http://127.0.0.1:4000\u0000local\u0000theme': { value: 'loopback', updatedAt: 3 },
    'http://localhost:5000\u0000local\u0000theme': { value: 'other-port', updatedAt: 4 },
  } });
  const response = await worker.send({ type: 'hydrate', entries: [] });
  assert.deepEqual(response.apply, [{ area: 'local', key: 'theme', value: 'production', deleted: false }]);
});

test('untrusted senders cannot read, write, or wipe the synced profile', async (t) => {
  const worker = await startWorker(t, { records: {
    [SITE + '\u0000local\u0000draft']: { value: 'private', updatedAt: 1 },
  } });
  const invalidSenders = [
    pageSender('http://localhost:4000/'),
    pageSender('http://localhost:5000/'),
    pageSender('http://127.0.0.1:4000/'),
    pageSender('http://tobiasduerschmid.github.io/'),
    pageSender(SITE + ':8443/'),
    pageSender('https://tobiasduerschmid.github.io.example.com/'),
    { ...pageSender(), origin: 'null' },
    { ...pageSender(), origin: 'http://localhost:4000' },
    { ...pageSender(), frameId: 1 },
    { ...pageSender(), url: 'about:blank' },
    { ...pageSender(), tab: { id: 1, url: 'http://localhost:4000/' } },
    { ...pageSender(), tab: undefined },
    { ...pageSender(), id: 'another-extension' },
    {},
  ];
  for (const sender of invalidSenders) {
    for (const type of ['hydrate', 'push', 'wipe']) {
      const before = structuredClone({ sync: worker.sync, local: worker.local });
      const response = await worker.send({
        type,
        origin: SITE,
        entries: [{ area: 'local', key: 'draft', value: 'attacker', writtenAt: 999 }],
      }, sender);
      assert.ok(response?.error, `Must reject ${type} from ${JSON.stringify(sender)}`);
      assert.equal(response.apply, undefined);
      assert.deepEqual({ sync: worker.sync, local: worker.local }, before);
    }
  }
});

test('accepted writes use the sender origin regardless of page-supplied origins', async (t) => {
  const worker = await startWorker(t);
  const response = await worker.send({
    type: 'push',
    origin: 'http://localhost:4000',
    entries: [{ origin: 'http://localhost:4000', area: 'local', key: 'draft', value: 'saved', writtenAt: 10 }],
  }, pageSender('https://TOBIASDUERSCHMID.github.io:443/SEBook/'));
  assert.ok(!response.error);
  const saved = (await worker.records())[SITE + '\u0000local\u0000draft'];
  assert.equal(saved.value, 'saved');
  assert.ok(saved.updatedAt > 10, 'The worker supplies the conflict clock.');
});

for (const version of [undefined, 1, 2, 3, 4, 99]) {
  test(`originless records and deletion history never reach a page (payload version ${version})`, async (t) => {
    const { FORMAT_VERSION } = await load('sync-model.js');
    const worker = await startWorker(t, {
      records: {
        'local\u0000draft': { value: 'unattributed-secret', updatedAt: 999 },
        'cookie\u0000dark-mode': { value: 'true', updatedAt: 999 },
      },
      local: { lastSynced: { 'local\u0000draft': 'v:1' }, unsyncedStamps: {} },
    });
    if (version === undefined) delete worker.sync.m.version;
    else worker.sync.m.version = version;
    const response = await worker.send({ type: 'hydrate', entries: [] });
    assert.deepEqual(response.apply, []);
    if (version === undefined || version <= FORMAT_VERSION) {
      assert.deepEqual(await worker.records(), {});
      assert.deepEqual(worker.local.lastSynced, {});
      assert.equal(worker.sync.m.version, FORMAT_VERSION);
    } else {
      assert.equal(response.readOnly, true);
      assert.equal(worker.sync.m.version, version);
    }
  });
}

test('origin-specific deletes, retired keys and backups leave other origins intact', async (t) => {
  const worker = await startWorker(t, { records: {
    [SITE + '\u0000local\u0000theme']: { value: 'profile-theme', updatedAt: 1 },
    'http://localhost:4000\u0000local\u0000draft': { value: 'dev-draft', updatedAt: 1 },
  }, local: {
    lastSynced: { 'http://localhost:4000\u0000local\u0000draft': 'v:1' },
    unsyncedStamps: { 'http://localhost:4000\u0000local\u0000large': { hash: 'v:2', updatedAt: 1 } },
  } });
  const response = await worker.send({
    type: 'hydrate',
    entries: [{ area: 'local', key: 'theme', value: 'old-theme' }],
    retired: [{ area: 'local', key: 'draft' }],
  });
  assert.deepEqual(response.apply, [{ area: 'local', key: 'theme', value: 'profile-theme', deleted: false }]);
  assert.equal((await worker.records())['http://localhost:4000\u0000local\u0000draft'].value, 'dev-draft');
  assert.equal(worker.local.lastSynced['http://localhost:4000\u0000local\u0000draft'], 'v:1');
  assert.deepEqual(worker.local.unsyncedStamps['http://localhost:4000\u0000local\u0000large'], { hash: 'v:2', updatedAt: 1 });
  assert.equal(worker.local.replacedBackup[SITE + '\u0000local\u0000theme'].value, 'old-theme');
});

test('external status uses the same exact origin check, and popup controls still work', async (t) => {
  const worker = await startWorker(t);
  assert.equal(await worker.send({ type: 'status' }, pageSender('http://localhost:4000/'), 'external'), undefined);
  assert.equal(await worker.send({ type: 'status' }, pageSender(SITE + ':8443/'), 'external'), undefined);
  const websiteSender = pageSender();
  delete websiteSender.id;
  assert.equal((await worker.send({ type: 'status' }, websiteSender, 'external')).installed, true);
  const popupSender = { id: EXTENSION_ID, url: `chrome-extension://${EXTENSION_ID}/popup.html` };
  assert.equal((await worker.send({ type: 'pause' }, popupSender)).paused, true);
  assert.equal((await worker.send({ type: 'resume' }, popupSender)).paused, false);
  const popupTabSender = { ...popupSender, tab: { id: 2, url: popupSender.url, incognito: false } };
  assert.equal((await worker.send({ type: 'pause' }, popupTabSender)).paused, true);
  assert.equal((await worker.send({ type: 'resume' }, popupTabSender)).paused, false);
});

test('incognito requests do not write or read profile data', async (t) => {
  const worker = await startWorker(t);
  const sender = pageSender();
  sender.tab.incognito = true;
  const before = structuredClone(worker.sync);
  assert.deepEqual(await worker.send({ type: 'hydrate', entries: [] }, sender), { skipped: 'incognito' });
  assert.deepEqual(worker.sync, before);
});

test('the distributed manifest only grants access to the production site', () => {
  const manifest = JSON.parse(fs.readFileSync('chrome-extension/sebook-profile-sync/manifest.json', 'utf8'));
  for (const matches of [manifest.host_permissions, manifest.externally_connectable.matches, ...manifest.content_scripts.map((script) => script.matches)]) {
    assert.deepEqual(matches, [SITE + '/*']);
  }
});
