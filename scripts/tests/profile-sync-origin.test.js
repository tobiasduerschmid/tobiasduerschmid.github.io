const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const model = () => import(pathToFileURL(path.resolve('chrome-extension/sebook-profile-sync/sync-model.js')).href);
const origins = ['https://tobiasduerschmid.github.io', 'http://localhost:4000', 'http://127.0.0.1:4000', 'http://localhost:5000'];

test('same-named cookies and localStorage values only hydrate their own exact origin', async () => {
  const { mergeSiteSnapshot } = await model();
  const records = {};
  origins.forEach((origin, index) => {
    records[origin + '\u0000local\u0000draft'] = { value: 'draft-' + index, updatedAt: 1 };
    records[origin + '\u0000cookie\u0000theme'] = { value: 'theme-' + index, updatedAt: 1 };
  });
  origins.forEach((origin, index) => {
    const result = mergeSiteSnapshot([], records, 10, origin);
    assert.deepEqual(result.apply, [
      { area: 'local', key: 'draft', value: 'draft-' + index, deleted: false },
      { area: 'cookie', key: 'theme', value: 'theme-' + index, deleted: false },
    ]);
    assert.equal(Object.keys(result.records).length, 2);
  });
});

test('deletions, timestamps and retired-key rules cannot cross origins', async () => {
  const { prepareSiteEntries } = await model();
  const prepared = await prepareSiteEntries([{ area: 'local', key: 'theme', value: 'production' }], {
    origin: origins[0],
    now: 10,
    lastSynced: { 'http://localhost:4000\u0000local\u0000draft': 'v:1', 'local\u0000legacy': 'v:1' },
    stamps: { 'http://localhost:4000\u0000local\u0000theme': { hash: 'v:1', updatedAt: 100 } },
    remoteRecords: { 'http://localhost:4000\u0000local\u0000draft': { value: 'dev', updatedAt: 1 } },
    retired: [{ area: 'local', key: 'draft' }],
  });
  assert.deepEqual(prepared, [{ area: 'local', key: 'theme', value: 'production', deleted: false }]);
});

test('record identity preserves key separators and rejects legacy or noncanonical origins', async () => {
  const { recordId, parseRecordId } = await model();
  const id = recordId('local', 'draft\u0000section', origins[0]);
  assert.equal(id, origins[0] + '\u0000local\u0000draft\u0000section');
  assert.deepEqual(parseRecordId(id), { origin: origins[0], area: 'local', key: 'draft\u0000section' });
  for (const invalid of [
    'local\u0000draft',
    'null\u0000local\u0000draft',
    'https://tobiasduerschmid.github.io:443\u0000local\u0000draft',
    'https://tobiasduerschmid.github.io/path\u0000local\u0000draft',
    'file://\u0000local\u0000draft',
  ]) assert.equal(parseRecordId(invalid), null);
});
