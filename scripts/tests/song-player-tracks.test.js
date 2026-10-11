'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { songPosition, describedPosition } = require('../../js/song-video/tracks');

const plan = { duration: 45, holds: [
  { outputStart: 0, outputEnd: 5, songTime: 0, pictureTime: 1 },
  { outputStart: 15, outputEnd: 25, songTime: 10, pictureTime: 11 },
] };

test('narration holds a representative picture without advancing the song clock', () => {
  assert.deepEqual(songPosition(plan, 2), { songTime: 0, sceneTime: 1 });
  assert.deepEqual(songPosition(plan, 15), { songTime: 10, sceneTime: 11 });
  assert.deepEqual(songPosition(plan, 24.99), { songTime: 10, sceneTime: 11 });
});

test('described playback resumes at normal speed immediately after each narration', () => {
  assert.deepEqual(songPosition(plan, 5), { songTime: 0, sceneTime: 0 });
  assert.deepEqual(songPosition(plan, 14.9), { songTime: 9.9, sceneTime: 9.9 });
  assert.deepEqual(songPosition(plan, 25), { songTime: 10, sceneTime: 10 });
  assert.deepEqual(songPosition(plan, 31), { songTime: 16, sceneTime: 16 });
});

test('switching tracks preserves song position and starts initial narration from the beginning', () => {
  assert.equal(describedPosition(plan, 0), 0);
  assert.equal(describedPosition(plan, 4), 9);
  assert.equal(describedPosition(plan, 10), 25);
  assert.equal(describedPosition(plan, 16), 31);
  assert.equal(songPosition(plan, describedPosition(plan, 16)).songTime, 16);
});
