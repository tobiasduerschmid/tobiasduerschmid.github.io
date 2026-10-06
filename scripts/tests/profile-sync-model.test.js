const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

async function load(name) {
  return import(pathToFileURL(path.resolve('chrome-extension/sebook-profile-sync', name)).href);
}

function extensionIdFromKey(base64Key) {
  const hash = crypto.createHash('sha256').update(Buffer.from(base64Key, 'base64')).digest();
  return [...hash.subarray(0, 16)]
    .map((byte) => String.fromCharCode(97 + ((byte >> 4) & 15), 97 + (byte & 15)))
    .join('');
}

test('profile copy wins when this browser has no newer write, and a browser-only value is uploaded', async () => {
  const { mergeSiteSnapshot, recordId } = await load('sync-model.js');
  const now = 1_000_000;
  const remoteId = recordId('local', 'theme');
  const localId = recordId('cookie', 'dark-mode');
  const remote = { [remoteId]: { value: 'from-profile', updatedAt: 50 } };
  const result = mergeSiteSnapshot([
    { area: 'local', key: 'theme', value: 'from-browser' },
    { area: 'cookie', key: 'dark-mode', value: 'true' },
  ], remote, now);

  assert.equal(result.records[remoteId].value, 'from-profile');
  assert.equal(result.records[remoteId].updatedAt, 50);
  assert.deepEqual(result.apply, [
    { area: 'local', key: 'theme', value: 'from-profile', deleted: false },
  ]);
  assert.deepEqual(result.replaced, [
    { area: 'local', key: 'theme', value: 'from-browser' },
  ]);
  assert.equal(result.records[localId].value, 'true');
  assert.equal(result.records[localId].updatedAt, now);
  assert.deepEqual(remote[remoteId], { value: 'from-profile', updatedAt: 50 });
});

test('a write from this page wins when it is at least as new as the profile copy', async () => {
  const { mergeSiteSnapshot, recordId } = await load('sync-model.js');
  const id = recordId('local', 'note');
  const remote = { [id]: { value: 'profile', updatedAt: 80 } };

  const sameTime = mergeSiteSnapshot([
    { area: 'local', key: 'note', value: 'page', writtenAt: 80 },
  ], remote, 100);
  assert.equal(sameTime.records[id].value, 'page');
  assert.equal(sameTime.records[id].updatedAt, 80);
  assert.deepEqual(sameTime.apply, []);

  const older = mergeSiteSnapshot([
    { area: 'local', key: 'note', value: 'page', writtenAt: 79 },
  ], remote, 100);
  assert.equal(older.records[id].value, 'profile');
  assert.deepEqual(older.apply, [
    { area: 'local', key: 'note', value: 'profile', deleted: false },
  ]);
});

test('equal values keep the profile timestamp, and a remote delete removes a stale local value', async () => {
  const { mergeSiteSnapshot, recordId } = await load('sync-model.js');
  const kept = recordId('cookie', 'dark-mode');
  const removed = recordId('local', 'draft');
  const result = mergeSiteSnapshot([
    { area: 'cookie', key: 'dark-mode', value: 'true' },
    { area: 'local', key: 'draft', value: 'old' },
  ], {
    [kept]: { value: 'true', updatedAt: 10 },
    [removed]: { deleted: true, updatedAt: 12 },
  }, 40);

  assert.equal(result.records[kept].updatedAt, 10);
  assert.deepEqual(result.apply, [
    { area: 'local', key: 'draft', value: '', deleted: true },
  ]);
  assert.deepEqual(result.replaced, [{ area: 'local', key: 'draft', value: 'old' }]);
});

test('a newer local delete becomes a tombstone and does not come back from the profile', async () => {
  const { mergeSiteSnapshot, recordId } = await load('sync-model.js');
  const id = recordId('local', 'draft');
  const result = mergeSiteSnapshot([
    { area: 'local', key: 'draft', value: '', deleted: true, writtenAt: 30 },
  ], {
    [id]: { value: 'profile', updatedAt: 20 },
  }, 40);

  assert.deepEqual(result.records[id], { deleted: true, updatedAt: 30 });
  assert.deepEqual(result.apply, []);
});

test('cookie and localStorage keys with the same name stay separate, and a broken profile record is ignored', async () => {
  const { mergeSiteSnapshot, recordId } = await load('sync-model.js');
  const result = mergeSiteSnapshot([
    { area: 'local', key: 'dark-mode', value: 'local-value' },
  ], {
    [recordId('cookie', 'dark-mode')]: { value: 'cookie-value', updatedAt: 5 },
    'not-a-record': { value: 'x', updatedAt: 5 },
    [recordId('local', 'broken')]: { value: 12, updatedAt: 5 },
  }, 9);

  assert.equal(result.records[recordId('local', 'dark-mode')].value, 'local-value');
  assert.equal(result.apply[0].area, 'cookie');
  assert.equal(result.apply[0].value, 'cookie-value');
  assert.equal(result.records['not-a-record'], undefined);
  assert.equal(result.records[recordId('local', 'broken')], undefined);
});

test('tombstones are kept at the retention boundary and dropped one millisecond later', async () => {
  const { pruneRecords, recordId, LIMITS } = await load('sync-model.js');
  const id = recordId('local', 'gone');
  const live = recordId('local', 'keep');
  const records = {
    [id]: { deleted: true, updatedAt: 0 },
    [live]: { value: 'stay', updatedAt: 0 },
  };
  const atBoundary = pruneRecords(records, LIMITS.tombstoneRetentionMs);
  const afterBoundary = pruneRecords(records, LIMITS.tombstoneRetentionMs + 1);

  assert.equal(atBoundary[id].deleted, true);
  assert.equal(afterBoundary[id], undefined);
  assert.equal(afterBoundary[live].value, 'stay');
  assert.equal(records[id].deleted, true);
});

test('a value that changed since this device last synced wins over the profile, including a delete', async () => {
  const { prepareSiteEntries, recordId, entryHash } = await load('sync-model.js');
  const id = recordId('local', 'note');
  const removed = recordId('cookie', 'se-gym');
  const prepared = prepareSiteEntries([
    { area: 'local', key: 'note', value: 'edited-offline' },
  ], {
    stamps: {},
    lastSynced: {
      [id]: entryHash({ value: 'previous' }),
      [removed]: entryHash({ value: 'on' }),
    },
    now: 70,
  });

  const note = prepared.find((entry) => entry.key === 'note');
  const deletion = prepared.find((entry) => entry.area === 'cookie' && entry.key === 'se-gym');
  assert.equal(note.writtenAt, 70);
  assert.equal(deletion.deleted, true);
  assert.equal(deletion.writtenAt, 70);
});

test('an unsynced stamp keeps a too-large local value from being replaced, without erasing a newer explicit write', async () => {
  const { stampMatchingLocalEntries, recordId, entryHash } = await load('sync-model.js');
  const id = recordId('local', 'big');
  const stamps = { [id]: { hash: entryHash({ value: 'large' }), updatedAt: 15 } };
  const stamped = stampMatchingLocalEntries([
    { area: 'local', key: 'big', value: 'large' },
    { area: 'local', key: 'big', value: 'large', writtenAt: 4 },
  ], stamps);

  assert.equal(stamped[0].writtenAt, 15);
  assert.equal(stamped[1].writtenAt, 4);
  const mismatch = stampMatchingLocalEntries([
    { area: 'local', key: 'big', value: 'other' },
  ], stamps);
  assert.equal(mismatch[0].writtenAt, undefined);
});

test('quota fitting drops new large values before a previously synced value, and puts the smaller profile copy back', async () => {
  const { fitToQuota, recordId } = await load('sync-model.js');
  const synced = recordId('local', 'synced');
  const fresh = recordId('local', 'fresh');
  const encode = async (records) => ({
    ok: true,
    truncated: false,
    totalBytes: Object.values(records).reduce((sum, record) => sum + (record.value ? record.value.length : 1), 0),
  });
  const source = {
    [synced]: { value: 'x'.repeat(80), updatedAt: 2 },
    [fresh]: { value: 'y'.repeat(50), updatedAt: 3 },
    [recordId('local', 'small')]: { value: 'z'.repeat(10), updatedAt: 4 },
  };
  const fitted = await fitToQuota(source, {
    protectedIds: [synced],
    previousRecords: { [synced]: { value: 'old', updatedAt: 1 } },
    quota: 90,
    encode,
  });

  assert.equal(fitted.records[synced].value.length, 80);
  assert.equal(fitted.records[recordId('local', 'small')].value.length, 10);
  assert.deepEqual(fitted.omitted, [fresh]);
  assert.equal(source[fresh].value.length, 50);

  const grown = recordId('local', 'grown');
  const restored = await fitToQuota({
    [grown]: { value: 'n'.repeat(100), updatedAt: 9 },
  }, {
    protectedIds: [grown],
    previousRecords: { [grown]: { value: 'old', updatedAt: 1 } },
    quota: 20,
    encode,
  });
  assert.equal(restored.records[grown].value, 'old');
  assert.deepEqual(restored.omitted, [grown]);
});

test('equal-sized values are dropped in stable key order, and an empty payload still fits when every live value is too big', async () => {
  const { fitToQuota, recordId } = await load('sync-model.js');
  const first = recordId('local', 'a');
  const second = recordId('local', 'b');
  const encode = async (records) => ({
    ok: true,
    truncated: false,
    totalBytes: Object.values(records).reduce((sum, record) => sum + record.value.length, 0),
  });
  const tied = await fitToQuota({
    [first]: { value: '12345', updatedAt: 1 },
    [second]: { value: '12345', updatedAt: 1 },
  }, { encode, quota: 5 });
  assert.deepEqual(tied.omitted, [first]);
  assert.equal(tied.records[second].value, '12345');

  const only = recordId('local', 'only');
  const tomb = recordId('local', 'tomb');
  const dropped = await fitToQuota({
    [only]: { value: 'too-big', updatedAt: 1 },
    [tomb]: { deleted: true, updatedAt: 1 },
  }, {
    encode: async (records) => ({
      ok: true,
      truncated: false,
      totalBytes: Object.values(records).some((record) => record && record.value) ? 1000 : 1,
    }),
    quota: 10,
  });
  assert.equal(dropped.overQuota, undefined);
  assert.equal(dropped.records[only], undefined);
  assert.equal(dropped.records[tomb].deleted, true);
  assert.ok(dropped.encoded.totalBytes <= 10);
});

test('sync chunks stay within the per-item budget and rejoin to the original text', async () => {
  const { chunkString, joinChunks, syncItemBytes, chunkKey, LIMITS } = await load('sync-model.js');
  const payload = 'a'.repeat(20_000);
  const chunked = chunkString(payload);
  assert.equal(chunked.truncated, false);
  assert.equal(joinChunks(chunked.chunks), payload);
  assert.ok(chunked.chunks.length > 1);
  chunked.chunks.forEach((chunk, index) => {
    assert.ok(syncItemBytes(chunkKey(index), chunk) <= LIMITS.bytesPerItem);
  });
});

test('a profile payload round-trips through gzip and stays inside the sync budget when it fits', async () => {
  const { encodeSyncPayload, decodeSyncPayload } = await load('sync-codec.js');
  const { recordId, LIMITS, META_KEY, chunkKey } = await load('sync-model.js');
  const records = {
    [recordId('local', 'tutorial-progress-python')]: { value: 'print("hello")\n'.repeat(20), updatedAt: 8 },
    [recordId('cookie', 'dark-mode')]: { value: 'true', updatedAt: 9 },
  };
  const encoded = await encodeSyncPayload(records, { revision: 3, omittedCount: 0, updatedAt: 9 });
  assert.equal(encoded.ok, true);
  assert.ok(encoded.totalBytes <= LIMITS.quotaBytes);
  const stored = { [META_KEY]: encoded.meta };
  encoded.chunks.forEach((chunk, index) => {
    stored[chunkKey(index)] = chunk;
  });
  const decoded = await decodeSyncPayload(stored);
  assert.equal(decoded.records[recordId('cookie', 'dark-mode')].value, 'true');
  assert.equal(decoded.records[recordId('local', 'tutorial-progress-python')].updatedAt, 8);
});

test('a saved key the extension has never listed is still synced in both directions', async () => {
  const { mergeSiteSnapshot, recordId } = await load('sync-model.js');
  const added = recordId('local', 'brand-new-feature');
  const fromProfile = recordId('cookie', 'brand-new-flag');
  const result = mergeSiteSnapshot([
    { area: 'local', key: 'brand-new-feature', value: 'created-here' },
  ], {
    [fromProfile]: { value: 'from-another-computer', updatedAt: 4 },
  }, 8);

  assert.equal(result.records[added].value, 'created-here');
  assert.equal(result.records[added].updatedAt, 8);
  assert.deepEqual(result.apply, [
    { area: 'cookie', key: 'brand-new-flag', value: 'from-another-computer', deleted: false },
  ]);
});

test('a retired key or prefix is deleted even when this browser wrote it later', async () => {
  const { prepareSiteEntries, mergeSiteSnapshot, recordId } = await load('sync-model.js');
  const now = 500;
  const retiredId = recordId('local', 'old-draft');
  const prefixedId = recordId('local', 'legacy-tool-1');
  const currentId = recordId('local', 'tutorial-progress-python');
  const prepared = prepareSiteEntries([
    { area: 'local', key: 'old-draft', value: 'still-here', writtenAt: 400 },
    { area: 'local', key: 'legacy-tool-1', value: 'draft', writtenAt: 400 },
    { area: 'local', key: 'tutorial-progress-python', value: 'print(1)' },
  ], {
    stamps: {},
    lastSynced: {},
    now,
    remoteRecords: {
      [retiredId]: { value: 'profile-copy', updatedAt: 10 },
      [prefixedId]: { value: 'profile-draft', updatedAt: 10 },
    },
    retired: [
      { area: 'local', key: 'old-draft' },
      { area: 'local', prefix: 'legacy-tool-' },
    ],
  });
  const result = mergeSiteSnapshot(prepared, {
    [retiredId]: { value: 'profile-copy', updatedAt: 10 },
    [prefixedId]: { value: 'profile-draft', updatedAt: 10 },
  }, now);

  assert.deepEqual(result.records[retiredId], { deleted: true, updatedAt: now });
  assert.deepEqual(result.records[prefixedId], { deleted: true, updatedAt: now });
  assert.equal(result.records[currentId].value, 'print(1)');
  assert.equal(result.records[currentId].deleted, undefined);
});

test('future record fields and unrecognized records survive, and a newer payload is not treated as empty', async () => {
  const {
    mergeSiteSnapshot,
    splitRecords,
    payloadCompatibility,
    nextMeta,
    recordId,
    FORMAT_VERSION,
  } = await load('sync-model.js');
  const { encodeSyncPayload, decodeSyncPayload } = await load('sync-codec.js');
  const id = recordId('local', 'note');
  const kept = mergeSiteSnapshot([
    { area: 'local', key: 'note', value: 'edited', writtenAt: 20 },
  ], {
    [id]: { value: 'old', updatedAt: 5, sourceDevice: 'laptop' },
  }, 30);
  assert.equal(kept.records[id].value, 'edited');
  assert.equal(kept.records[id].sourceDevice, 'laptop');

  const opaqueId = 'future\u0000blob';
  const parts = splitRecords({
    [id]: { value: 'a', updatedAt: 1, sourceDevice: 'laptop' },
    [opaqueId]: { kind: 'later', payload: { n: 1 } },
    [recordId('local', 'structured')]: { value: { nested: true }, updatedAt: 2 },
  });
  assert.equal(parts.known[id].sourceDevice, 'laptop');
  assert.equal(parts.opaque[opaqueId].kind, 'later');
  assert.deepEqual(parts.opaque[recordId('local', 'structured')].value, { nested: true });

  assert.equal(payloadCompatibility({ chunks: 0 }), 'current');
  assert.equal(payloadCompatibility({ version: FORMAT_VERSION, chunks: 1 }), 'current');
  assert.equal(payloadCompatibility({ version: FORMAT_VERSION + 1, chunks: 1 }), 'newer');
  assert.equal(payloadCompatibility({ version: 0, chunks: 1 }), 'unreadable');
  assert.equal(nextMeta({ version: 1, chunks: 1, revision: 2, omittedCount: 0, updatedAt: 1, deviceLabel: 'desk' }, {
    revision: 3,
    chunks: 1,
    omittedCount: 0,
    updatedAt: 4,
  }).deviceLabel, 'desk');

  const encoded = await encodeSyncPayload({
    [id]: { value: 'hello', updatedAt: 3, sourceDevice: 'laptop' },
    [opaqueId]: { kind: 'later' },
  }, { revision: 1, omittedCount: 0, updatedAt: 3 });
  encoded.meta.version = FORMAT_VERSION + 1;
  const stored = { m: encoded.meta };
  encoded.chunks.forEach((chunk, index) => {
    stored['c' + index] = chunk;
  });
  const decoded = await decodeSyncPayload(stored);
  assert.equal(decoded.newer, true);
  assert.equal(decoded.records[id].sourceDevice, 'laptop');
  assert.equal(decoded.records[opaqueId].kind, 'later');
});

test('records this copy does not understand are kept when the payload is too large', async () => {
  const { fitToQuota, recordId } = await load('sync-model.js');
  const opaque = recordId('local', 'opaque');
  const fresh = recordId('local', 'fresh');
  const encode = async (records) => ({
    ok: true,
    truncated: false,
    totalBytes: Object.values(records).reduce((sum, record) => sum + (record.value ? record.value.length : 1), 0),
  });
  const result = await fitToQuota({
    [opaque]: { value: 'x'.repeat(100), updatedAt: 1, future: true },
    [fresh]: { value: 'y'.repeat(10), updatedAt: 2 },
  }, { keepIds: [opaque], encode, quota: 20 });

  assert.equal(result.records[opaque].future, true);
  assert.equal(result.records[fresh], undefined);
  assert.equal(result.overQuota, true);
});

test('the site talks to the extension id pinned by the manifest key', async () => {
  const manifest = JSON.parse(fs.readFileSync('chrome-extension/sebook-profile-sync/manifest.json', 'utf8'));
  const id = extensionIdFromKey(manifest.key);
  const page = fs.readFileSync('js/profile-sync-page.js', 'utf8');
  const gym = fs.readFileSync('se-gym.html', 'utf8');
  assert.equal(id, 'phcfjcdliacndimckihgbpncoohjffad');
  assert.ok(page.includes(id));
  assert.match(gym, /\/downloads\/sebook-chrome-profile-sync\.zip/);
  assert.match(fs.readFileSync('_includes/head.html', 'utf8'), /__sebookApplyDisplayPreferences/);
});

test('the downloadable zip is the extension the SE Gym page links to', () => {
  const zip = 'downloads/sebook-chrome-profile-sync.zip';
  const manifest = execFileSync('unzip', ['-p', zip, 'sebook-chrome-profile-sync/manifest.json'], { encoding: 'utf8' });
  const parsed = JSON.parse(manifest);
  assert.equal(parsed.name, 'SEBook Chrome profile sync');
  assert.equal(parsed.version, '1.0.0');
  assert.equal(parsed.background.service_worker, 'background.js');
});
