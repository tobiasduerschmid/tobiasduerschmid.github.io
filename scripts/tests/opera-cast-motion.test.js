const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function cast() {
  const context = vm.createContext({ window: { SongKit: {}, matchMedia: () => ({ matches: false }) } });
  for (const file of ['timeline.js', 'figure-geometry.js', 'opera-cast.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../../js/song-video', file), 'utf8'), context);
  }
  return context.window.OperaCast;
}

function wrist(C, pose, side) {
  const [up, fore] = pose[side];
  const upper = C.rotate(C.ELBOW.map((v, i) => (v - C.SHOULDER[i]) * (1 - 0.32 * pose[`${side}Lift`])), -up);
  const lower = C.rotate(C.WRIST.map((v, i) => v - C.ELBOW[i]), -fore);
  return C.SHOULDER.map((v, i) => v + upper[i] + lower[i]);
}

for (const side of ['left', 'right']) {
  test(`temple taps keep the ${side} hand beside the temple instead of circling the elbow`, () => {
    const C = cast();
    const keys = C.MOVES.temple({ side, hold: 1.2 });
    const contact = wrist(C, C.poseAt(keys, 0.26, false), side);
    for (let t = 0.3; t < 1.15; t += 1 / 120) {
      const hand = wrist(C, C.poseAt(keys, t, false), side);
      assert.ok(Math.hypot(hand[0] - contact[0], hand[1] - contact[1]) < 10, `hand left the tapping area at ${t.toFixed(3)}s`);
    }
  });
}

test('gesture keyframes keep elbow flexion within a human range', () => {
  const C = cast();
  const restAngle = (from, to) => Math.atan2(to[1] - from[1], to[0] - from[0]) * 180 / Math.PI;
  const offset = restAngle(C.ELBOW, C.WRIST) - restAngle(C.SHOULDER, C.ELBOW);
  for (const [name, move] of Object.entries(C.MOVES)) {
    if (['point', 'present', 'arms'].includes(name)) continue; // Stage targets are covered in the player suite.
    for (const [at, , fields] of move({}, { side: () => 'right' })) {
      for (const side of ['left', 'right']) {
        if (!fields[side]) continue;
        const [upper, fore] = fields[side];
        assert.ok(Math.abs(upper - fore + offset) <= 150.01, `${name} ${side} at ${at}: elbow folded beyond 150°`);
      }
    }
  }
});

test('wrist turns ease inside their limits instead of hitting a hard stop early', () => {
  const C = cast();
  const keys = C.MOVES.arms({ right: { reach: [148, 128], shape: 'open', dir: 180 }, hold: 1 });
  for (let t = -0.2; t <= 1.5; t += 1 / 120) {
    const hand = C.poseAt(keys, t, false).rightHand;
    assert.ok(hand >= -55 && hand <= 65, `wrist outside its range at ${t.toFixed(3)}s: ${hand}`);
  }
});

test('a short repeated gesture finishes its taps before returning to rest', () => {
  const C = cast();
  for (const name of ['temple', 'chest', 'wag']) {
    const keys = C.MOVES[name]({ hold: 0.5 });
    assert.ok(keys.every(([at], i) => i === 0 || at >= keys[i - 1][0]), `${name} returns to rest before its last repetition`);
    const end = Math.max(...keys.map(([at, duration]) => at + duration)) + 0.01;
    const pose = C.poseAt(keys, end, false);
    for (const side of ['left', 'right']) assert.deepEqual(pose[side], C.REST[side], `${name} leaves ${side} raised`);
  }
});

test('an interrupted gesture starts from the pose at the interruption, not a moving old target', () => {
  const C = cast();
  const keys = [[0, 1, { right: [100, 100] }], [0.5, 1, { right: C.REST.right }]];
  const interrupted = C.poseAt(keys, 0.5, false).right;
  const halfwayBack = C.poseAt(keys, 1, false).right;
  for (let joint = 0; joint < 2; joint++) {
    assert.ok(Math.abs(halfwayBack[joint] - (interrupted[joint] + C.REST.right[joint]) / 2) < 1e-9);
  }
  // Seeking backwards must reproduce the same pose without playback history.
  C.poseAt(keys, 10, false);
  assert.deepEqual(C.poseAt(keys, 1, false).right, halfwayBack);
});

test('reduced motion holds each commanded pose without interpolating between cues', () => {
  const C = cast();
  const keys = C.MOVES.temple({ hold: 1.2 });
  assert.deepEqual(C.poseAt(keys, -0.19, true).right, C.poseAt(keys, 0.1, true).right);
  assert.deepEqual(C.poseAt(keys, 1.21, true).right, C.REST.right);
});

test('a chef’s kiss opens beside the face without circling down past the waist', () => {
  const C = cast();
  const keys = C.MOVES.kiss({ hold: 0.6 });
  for (let t = 0.25; t <= 0.85; t += 1 / 120) {
    const hand = wrist(C, C.poseAt(keys, t, false), 'right');
    assert.ok(hand[1] < C.SHOULDER[1], `kiss drops below the shoulder at ${t.toFixed(3)}s`);
  }
});
