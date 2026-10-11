// Each graph owns a deterministic scheduler. Loading the shared module must
// leave browser timers alone; advancing one clock must not run another's work.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SOURCE = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'song-video', 'virtual-clock.js'), 'utf8');
const FRAME_MS = 1000 / 60;

function installClockModule() {
  const noop = () => 0;
  const window = {
    setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop,
    requestAnimationFrame: noop, cancelAnimationFrame: noop,
  };
  vm.runInNewContext(SOURCE, { window });
  return window;
}

function installClock() { return installClockModule().VirtualClock.create(); }

test('loading the module preserves native timers and creates independent clocks', () => {
  const nativeTimer = () => 42;
  const window = { setTimeout: nativeTimer, clearTimeout: nativeTimer,
    setInterval: nativeTimer, clearInterval: nativeTimer,
    requestAnimationFrame: nativeTimer, cancelAnimationFrame: nativeTimer };
  vm.runInNewContext(SOURCE, { window });
  assert.equal(window.setTimeout, nativeTimer);
  assert.equal(window.requestAnimationFrame, nativeTimer);
  const first = window.VirtualClock.create();
  const second = window.VirtualClock.create();
  const ran = [];
  first.setTimeout(() => ran.push('first'), 10);
  second.setTimeout(() => ran.push('second'), 10);
  first.advanceTo(20);
  assert.deepEqual(ran, ['first']);
  assert.equal(second.now(), 0);
  first.reset();
  second.advanceTo(20);
  assert.deepEqual(ran, ['first', 'second']);
});

test('timers run only when time advances, in due-time order, ties in scheduling order', () => {
  const window = installClock();
  const ran = [];
  window.setTimeout(() => ran.push('b@20'), 20);
  window.setTimeout(() => ran.push('a@10'), 10);
  window.setTimeout(() => ran.push('c@20'), 20);
  window.setTimeout(() => ran.push('d@30'), 30);

  assert.deepEqual(ran, []);
  window.advanceTo(25);

  assert.deepEqual(ran, ['a@10', 'b@20', 'c@20']);
  assert.equal(window.now(), 25);
});

test('animation frames fire on the 60 Hz virtual grid', () => {
  const window = installClock();
  const frames = [];
  window.requestAnimationFrame((t) => {
    frames.push(t);
    window.requestAnimationFrame((t2) => frames.push(t2));
  });

  window.advanceTo(40);

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

  window.advanceTo(20);

  assert.deepEqual(ran, ['first', 'chained']);
});

test('cleared timers and frames never run', () => {
  const window = installClock();
  const ran = [];
  window.clearTimeout(window.setTimeout(() => ran.push('timer'), 5));
  window.cancelAnimationFrame(window.requestAnimationFrame(() => ran.push('frame')));

  window.advanceTo(100);

  assert.deepEqual(ran, []);
});

test('reset drops pending callbacks and rewinds to 0', () => {
  const window = installClock();
  const ran = [];
  window.advanceTo(50);
  window.setTimeout(() => ran.push('stale'), 10);

  window.reset();
  window.advanceTo(1000);

  assert.deepEqual(ran, []);
  assert.equal(window.now(), 1000);
});

test('a frame callback can cancel a later callback in the same frame', () => {
  const clock = installClock();
  const ran = [];
  clock.requestAnimationFrame(() => clock.cancelAnimationFrame(cancelled));
  const cancelled = clock.requestAnimationFrame(() => ran.push('cancelled'));
  clock.advanceTo(100);
  assert.deepEqual(ran, []);
});
