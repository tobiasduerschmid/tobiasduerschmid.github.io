const { test } = require('node:test');
const assert = require('node:assert/strict');
const model = require('../../js/song-video/playlist-collection');
const catalog = ['git', 'shell', 'uml'];
const restore = saved => model.restore(saved, catalog, ['shell', 'git'], 'CS 35L');

test('migrates a saved queue without losing order or deliberately empty playlists', () => {
  assert.deepEqual(model.current(restore({ version: 1, songs: ['uml', 'git', 'gone', 'uml'] })).songs, ['uml', 'git']);
  assert.deepEqual(model.current(restore({ version: 1, songs: [] })).songs, []);
  assert.deepEqual(model.current(restore(null)).songs, ['shell', 'git']);
});

test('restores named lists, removes unavailable videos and repairs invalid selection', () => {
  const result = restore({ version: 2, activeId: 'missing', playlists: [null, { id: 'a', name: ' Review ', songs: ['uml', 'gone'] }, { id: 'a', name: 'duplicate' }, { id: 'b', name: 'Empty', songs: [] }] });
  assert.equal(result.activeId, 'a');
  assert.deepEqual(result.playlists, [{ id: 'a', name: 'Review', songs: ['uml'] }, { id: 'b', name: 'Empty', songs: [] }]);
  assert.equal(restore({ version: 2, playlists: [] }).playlists.length, 1);
});

test('creating and editing a playlist preserves other lists and undo snapshots', () => {
  const original = restore(null);
  const created = model.create(original, 'new', 'Exam review');
  const edited = model.update(created, { songs: ['uml'], name: 'UML review' });
  assert.equal(model.current(edited).name, 'UML review');
  assert.deepEqual(model.current(created).songs, []);
  assert.deepEqual(model.current(model.select(edited, 'default')).songs, ['shell', 'git']);
  assert.equal(original.playlists.length, 1);
  assert.equal(model.select(edited, 'missing'), edited);
});

test('deleting the active playlist selects a survivor and protects the only playlist', () => {
  const original = restore(null);
  const created = model.create(original, 'new', 'Exam review');
  const removed = model.remove(created);
  assert.deepEqual(removed, original);
  assert.equal(created.playlists.length, 2);
  assert.equal(model.remove(original), original);
});
