'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sceneFile = path.join(__dirname, '../../js/song-video/scene.js');
test('shared scene exposes the authored timing with section handovers and clear missing-mark errors', () => {
  assert.ok(fs.existsSync(sceneFile), 'shared scene runtime must be published');
  const { songData } = require(sceneFile);
  const data = songData({ duration: 25, sections: [
    { id: 'intro', lines: [{ id: 'first', start: 0.1, end: 4, marks: { hello: 1.2 }, text: 'Hello' }] },
    { id: 'verse', lines: [{ id: 'second', start: 10, end: 20, text: 'World' }] },
  ] });
  assert.equal(data.mark('first', 'hello'), 1.2);
  assert.equal(data.line('second').text, 'World');
  assert.equal(data.sectionStart('intro'), 0);
  assert.equal(data.sectionEnd('intro'), 9.8);
  assert.equal(data.sectionStart('verse'), 9.8);
  assert.equal(data.sectionEnd('verse'), 25);
  assert.throws(() => data.mark('second', 'absent'), /mark.*absent/);
  assert.throws(() => data.line('absent'), /line.*absent/);
});

test('disposing a timeline cancels its animations and releases resource owners', () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../js/song-video/timeline.js'), 'utf8'), context);
  const timeline = context.window.Timeline;
  assert.equal(typeof timeline.dispose, 'function');
  let canceled = false;
  let released = false;
  let frames = 0;
  const animation = { pause() {}, cancel() { canceled = true; }, currentTime: 0 };
  timeline.tween({ animate: () => animation }, [], 0, 1);
  timeline.onFrame(() => { frames += 1; });
  timeline.onDispose(() => { released = true; });
  timeline.seek(0.5);
  assert.equal(animation.currentTime, 500);
  timeline.dispose();
  timeline.seek(0.75);
  assert.equal(canceled, true);
  assert.equal(released, true);
  assert.equal(frames, 1);
});

test('a failed choreography releases partially built resources before fallback', () => {
  let disposed = false;
  let cleared = false;
  const stage = { classList: { add() {}, remove() {} }, replaceChildren() { cleared = true; } };
  const context = { window: {
    Timeline: { beats: { configure() {} }, camera: { attach() {} }, dispose() { disposed = true; } },
    SongKit: { themes: { studio: { build() {} } }, el() { return {}; }, terminal() {} },
    SongChoreographies: { broken() { throw new Error('broken artwork'); } },
  } };
  vm.runInNewContext(fs.readFileSync(sceneFile, 'utf8'), context);
  assert.throws(() => context.window.SongScene.build(stage, { duration: 1, sections: [] }, 'broken'), /broken artwork/);
  assert.equal(disposed, true);
  assert.equal(cleared, true);
});
