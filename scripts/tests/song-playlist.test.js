const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const model = require('../../js/song-video/playlist-model');

test('saved order survives catalog additions and drops unavailable videos and duplicates', () => {
  assert.deepEqual(model.restore({ version: 1, songs: ['network', 'gone', 'git', 'git', null] }, ['git', 'network', 'new'], ['git']), ['network', 'git']);
});

test('an intentionally empty playlist stays empty; missing or malformed storage uses the default', () => {
  assert.deepEqual(model.restore({ version: 1, songs: [] }, ['git'], ['git']), []);
  for (const saved of [null, [], 'bad', { version: 2, songs: [] }, { version: 1, songs: 'git' }]) {
    assert.deepEqual(model.restore(saved, ['git'], ['git']), ['git']);
  }
});

test('editing preserves unique order without mutating the previous list needed by Undo', () => {
  const original = ['git', 'network'];
  assert.deepEqual(model.add(original, 'git'), original);
  assert.deepEqual(model.add(original, 'new'), ['git', 'network', 'new']);
  assert.deepEqual(model.move(original, 'network', -1), ['network', 'git']);
  assert.deepEqual(model.move(original, 'git', 1), ['network', 'git']);
  for (const [id, offset] of [['git', -1], ['network', 1], ['gone', 1]]) {
    assert.deepEqual(model.move(original, id, offset), original);
  }
  assert.deepEqual(model.remove(original, 'git'), ['network']);
  assert.deepEqual(original, ['git', 'network']);
});

test('playback follows the edited order and stops at the end or after a removed video', () => {
  assert.equal(model.next(['network', 'git'], 'network'), 'git');
  assert.equal(model.next(['network', 'git'], 'git'), null);
  assert.equal(model.next(['network'], 'git'), null);
  assert.equal(model.next([], 'git'), null);
  assert.equal(model.previous(['network', 'git'], 'git'), 'network');
  assert.equal(model.previous(['network', 'git'], 'network'), null);
  assert.equal(model.previous(['network'], 'git'), null);
  assert.equal(model.previous([], 'git'), null);
});

test('authored course playlists reference playable catalog songs with unique playlist IDs', () => {
  const root = path.resolve(__dirname, '../..');
  const playlists = yaml.load(fs.readFileSync(path.join(root, '_data/song_playlists.yml'), 'utf8'));
  assert.equal(new Set(playlists.map((item) => item.id)).size, playlists.length);
  for (const playlist of playlists) {
    assert.ok(playlist.title && playlist.description);
    assert.ok(playlist.songs.length);
    assert.equal(new Set(playlist.songs).size, playlist.songs.length);
    for (const id of playlist.songs) {
      const song = yaml.load(fs.readFileSync(path.join(root, '_data/songs', `${id}.yml`), 'utf8'));
      assert.ok(fs.existsSync(path.join(root, song.player)));
    }
  }
  assert.deepEqual(playlists.find((item) => item.id === 'cs35l').songs, ['small_tools_one_job_each', 'snapshots_and_pointers', 'unbox_the_stack', 'every_module_keeps_a_secret', 'invest_in_your_stories']);
});

test('reordering larger playlists supports first, last, middle, and unchanged destinations', () => {
  const original = ['a', 'b', 'c', 'd', 'e'];
  assert.deepEqual(model.move(original, 'a', 4), ['b', 'c', 'd', 'e', 'a']);
  assert.deepEqual(model.move(original, 'e', -4), ['e', 'a', 'b', 'c', 'd']);
  assert.deepEqual(model.move(original, 'b', 2), ['a', 'c', 'd', 'b', 'e']);
  assert.deepEqual(model.move(original, 'd', -2), ['a', 'd', 'b', 'c', 'e']);
  assert.deepEqual(model.move(original, 'c', 0), original);
  assert.deepEqual(original, ['a', 'b', 'c', 'd', 'e']);
});
