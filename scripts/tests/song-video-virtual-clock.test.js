// The song-video stage's virtual clock (scripts/song-video/virtual-clock.js)
// replaces the page's timers so GitGraph's animations can be posed at an
// exact moment. These tests pin that contract: callbacks run only when the
// stage advances time, in due-time order, with animation frames on a 60 Hz
// grid.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'song-video', 'virtual-clock.js'), 'utf8');
const FRAME_MS = 1000 / 60;

/** Installs the clock into a fresh fake window and returns that window. */
function installClock() {
  const noop = () => 0;
  const window = {
    setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop,
    requestAnimationFrame: noop, cancelAnimationFrame: noop,
  };
  vm.runInNewContext(SOURCE, { window });
  return window;
}

test('timers run only when time advances, in due-time order, ties in scheduling order', () => {
  const window = installClock();
  const ran = [];
  window.setTimeout(() => ran.push('b@20'), 20);
  window.setTimeout(() => ran.push('a@10'), 10);
  window.setTimeout(() => ran.push('c@20'), 20);
  window.setTimeout(() => ran.push('d@30'), 30);

  assert.deepEqual(ran, []);
  window.VirtualClock.advanceTo(25);

  assert.deepEqual(ran, ['a@10', 'b@20', 'c@20']);
  assert.equal(window.VirtualClock.now(), 25);
});

test('animation frames fire on the 60 Hz virtual grid', () => {
  const window = installClock();
  const frames = [];
  window.requestAnimationFrame((t) => {
    frames.push(t);
    window.requestAnimationFrame((t2) => frames.push(t2));
  });

  window.VirtualClock.advanceTo(40);

  assert.equal(frames.length, 2);
  assert.ok(Math.abs(frames[0] - FRAME_MS) < 1e-9);
  assert.ok(Math.abs(frames[1] - 2 * FRAME_MS) < 1e-9);
});

test('a callback that schedules another timer due within the same advance runs it too', () => {
  const window = installClock();
  const ran = [];
  window.setTimeout(() => {
    ran.push('first');
    window.setTimeout(() => ran.push('chained'), 5);
  }, 10);

  window.VirtualClock.advanceTo(20);

  assert.deepEqual(ran, ['first', 'chained']);
});

test('cleared timers and frames never run', () => {
  const window = installClock();
  const ran = [];
  window.clearTimeout(window.setTimeout(() => ran.push('timer'), 5));
  window.cancelAnimationFrame(window.requestAnimationFrame(() => ran.push('frame')));

  window.VirtualClock.advanceTo(100);

  assert.deepEqual(ran, []);
});

test('reset drops pending callbacks and rewinds to 0', () => {
  const window = installClock();
  const ran = [];
  window.VirtualClock.advanceTo(50);
  window.setTimeout(() => ran.push('stale'), 10);

  window.VirtualClock.reset();
  window.VirtualClock.advanceTo(1000);

  assert.deepEqual(ran, []);
  assert.equal(window.VirtualClock.now(), 1000);
});
