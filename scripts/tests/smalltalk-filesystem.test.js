const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = { self: {}, Uint8Array, Map, Set, Object, Error };
vm.runInNewContext(fs.readFileSync('js/smalltalk/protocol.js', 'utf8'), context);
vm.runInNewContext(fs.readFileSync('js/smalltalk/filesystem.js', 'utf8'), context);
const FileSystem = context.self.SEBookSmalltalk.FileSystem;

test('file snapshots are copied values and restore bytes independently', () => {
  const filesystem = new FileSystem();
  filesystem.put('/data.txt', Uint8Array.of(1, 2, 3));
  const saved = filesystem.snapshot();
  filesystem.put('/data.txt', Uint8Array.of(9));
  assert.deepEqual([...saved[0].bytes], [1, 2, 3]);
  filesystem.restore(saved);
  saved[0].bytes[0] = 8;
  assert.deepEqual([...filesystem.snapshot()[0].bytes], [1, 2, 3]);
});

test('sidecar restores shared open records, modes, positions and empty directories', () => {
  const filesystem = new FileSystem();
  filesystem.put('/shared', Uint8Array.of(10, 20, 30));
  filesystem.directories.add('/empty');
  const record = filesystem.files.get('/shared'); record.refCount = 2;
  filesystem.openFiles['/shared'] = record;
  const handles = [{ file: record, fileWrite: true, filePos: 1 }, { file: record, fileWrite: false, filePos: 2 }];
  const saved = filesystem.capture(handles);
  filesystem.files.delete('/shared'); record.contents[0] = 99;
  const restored = [{}, {}]; filesystem.rebind(saved, restored);
  assert.equal(restored[0].file, restored[1].file);
  assert.equal(restored[0].file, filesystem.files.get('/shared'));
  assert.equal(restored[0].file, filesystem.openFiles['/shared']);
  assert.equal(restored[0].fileWrite, true); assert.equal(restored[1].fileWrite, false);
  assert.equal(restored[0].filePos, 1); assert.equal(restored[1].filePos, 2);
  assert.equal(restored[0].file.refCount, 2);
  assert.deepEqual([...restored[0].file.contents], [10, 20, 30]);
  assert.equal(Object.keys(filesystem.list('/empty')).length, 0);
  restored[0].file.contents[0] = 7;
  filesystem.rebind(saved, restored);
  assert.deepEqual([...restored[0].file.contents], [10, 20, 30]);
});

test('detached open records survive capture without recreating their old path', () => {
  const filesystem = new FileSystem();
  filesystem.put('/removed', Uint8Array.of(42));
  const record = filesystem.files.get('/removed'); filesystem.files.delete('/removed');
  const saved = filesystem.capture([{ file: record, fileWrite: true, filePos: 0 }]);
  const restored = [{}]; filesystem.rebind(saved, restored);
  assert.equal(filesystem.files.has('/removed'), false);
  assert.deepEqual([...restored[0].file.contents], [42]);
});
