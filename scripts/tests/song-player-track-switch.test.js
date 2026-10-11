'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const controllerSource = fs.readFileSync(path.join(__dirname, '../../js/song-video/tracks.js'), 'utf8');
const originalSrc = 'https://example.test/song.m4a';
const describedSrc = 'https://example.test/described.m4a';
// Ten seconds of initial narration precede a 240-second song.
const plan = { duration: 250, holds: [
  { outputStart: 0, outputEnd: 10, songTime: 0, pictureTime: 1 },
] };

function playerFixture({ paused = false } = {}) {
  const handlers = new Map();
  const listen = (target, type, handler) => {
    if (!handlers.has(target)) handlers.set(target, new Map());
    const events = handlers.get(target);
    if (!events.has(type)) events.set(type, []);
    events.get(type).push(handler);
  };
  // Await the injected listener boundary, so assertions never race a pending
  // async change handler. Each test chooses when native media events arrive.
  const emit = async (target, type) => {
    await Promise.all((handlers.get(target)?.get(type) || []).map((handler) => handler()));
  };
  const select = { value: 'original', dataset: {
    describedSrc, describedCaptions: 'https://example.test/described.vtt',
    describedTimeline: 'https://example.test/described.json',
  } };
  const source = { src: originalSrc };
  const captions = { src: 'https://example.test/song.vtt', track: { mode: 'hidden' } };
  const audio = {
    currentTime: 120, duration: 240, currentSrc: originalSrc, paused, ended: false,
    querySelector: (selector) => selector === 'source' ? source : captions,
    pause() { this.paused = true; },
    async play() { this.paused = false; },
    // Loading another resource resets media time before its metadata arrives.
    load() { this.currentTime = 0; this.duration = NaN; this.currentSrc = source.src; this.paused = true; },
  };
  const state = { loading: false, errors: [] };
  const context = vm.createContext({
    window: {},
    fetch: async () => ({ ok: true, json: async () => plan }),
  });
  vm.runInContext(controllerSource, context);
  const controller = context.window.SongTracks.bind({
    player: { querySelector: () => select }, audio, listen,
    signal: new AbortController().signal,
    onLoading: (loading) => { state.loading = loading; },
    onChange: () => {},
    onError: (message) => { state.errors.push(message); },
  });
  return {
    audio, state, controller,
    async selectTrack(value) { select.value = value; await emit(select, 'change'); },
    async finishLoading() {
      audio.duration = source.src === describedSrc ? plan.duration : 240;
      await emit(audio, 'loadedmetadata');
    },
    failSource: () => emit(source, 'error'),
  };
}

test('recovering from a failed described audio load retains the song position and stays paused', async () => {
  const player = playerFixture();
  await player.selectTrack('described');
  await player.failSource();
  assert.equal(player.state.loading, false, 'failure releases the loading controls');

  await player.selectTrack('original');
  await player.finishLoading();

  assert.equal(player.audio.currentTime, 120);
  assert.equal(player.audio.paused, true, 'recovery must not unexpectedly restart playback');
  assert.equal(player.controller.position().songTime, 120);
  assert.deepEqual(player.state.errors, []);
});

test('pausing during a track load cancels automatic resume when metadata arrives later', async () => {
  const player = playerFixture();
  await player.selectTrack('described');
  assert.equal(player.state.loading, true);

  // The player calls this public operation when captions fail or its parent
  // requests a pause. Metadata may still arrive after that cancellation.
  player.controller.pause();
  await player.finishLoading();

  assert.equal(player.audio.paused, true);
  assert.equal(player.audio.currentTime, 130);
  assert.equal(player.controller.position().songTime, 120);
  assert.equal(player.state.loading, false);
  assert.deepEqual(player.state.errors, []);
});

for (const paused of [true, false]) {
  test(`switching tracks preserves song position and ${paused ? 'paused' : 'playing'} state`, async () => {
    const player = playerFixture({ paused });
    await player.selectTrack('described');
    await player.finishLoading();
    assert.equal(player.audio.currentTime, 130);
    assert.equal(player.audio.paused, paused);
    assert.equal(player.controller.position().songTime, 120);

    await player.selectTrack('original');
    await player.finishLoading();
    assert.equal(player.audio.currentTime, 120);
    assert.equal(player.audio.paused, paused);
    assert.equal(player.state.loading, false);
    assert.deepEqual(player.state.errors, []);
  });
}
