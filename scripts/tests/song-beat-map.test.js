// The song timeline's beat grid: a fixed bpm grid by default, or the take's
// own tempo map when a storyboard lists every beat (`beats.times`). Dance
// steps and pulses read beat positions from here, so a map must place every
// beat exactly where it was tracked and stay continuous outside its range.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SOURCE = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'song-video', 'timeline.js'), 'utf8');

function loadBeats() {
  const window = {};
  vm.runInNewContext(SOURCE, { window });
  return window.Timeline.beats;
}

// A drifting take: beats 1.0 s apart, then 1.2 s apart.
const TIMES = [0.5, 1.5, 2.5, 3.7, 4.9];

test('a fixed grid places beats by bpm and first beat', () => {
  const beats = loadBeats();
  beats.configure({ bpm: 120, first: 0.25 });
  assert.equal(beats.index(0.1), -1);
  assert.equal(beats.index(0.25), 0);
  assert.equal(beats.index(1.2), 1);
  assert.equal(beats.time(3), 1.75);
});

test('a tempo map returns each tracked beat and the beat that contains a time', () => {
  const beats = loadBeats();
  beats.configure({ bpm: 60, first: 0, times: TIMES });
  TIMES.forEach((time, i) => {
    assert.equal(beats.time(i), time);
    assert.equal(beats.index(time), i, `beat ${i} starts at its own time`);
  });
  assert.equal(beats.index(0.4), -1, 'before the first beat');
  assert.equal(beats.index(3.69), 2);
  assert.equal(beats.index(3.71), 3);
});

test('positions within a mapped beat use that beat\'s own length', () => {
  const beats = loadBeats();
  beats.configure({ bpm: 60, first: 0, times: TIMES });
  const early = beats.at(2.0);
  assert.equal(early.index, 1);
  assert.equal(early.period, 1);
  assert.ok(Math.abs(early.phase - 0.5) < 1e-9);
  const late = beats.at(4.3);
  assert.equal(late.index, 3);
  assert.ok(Math.abs(late.period - 1.2) < 1e-9);
  assert.ok(Math.abs(late.phase - 0.5) < 1e-9);
});

test('a tempo map continues at its edge tempo before and after the tracked beats', () => {
  const beats = loadBeats();
  beats.configure({ bpm: 60, first: 0, times: TIMES });
  assert.ok(Math.abs(beats.time(-1) - (-0.5)) < 1e-9, 'one first-interval before the first beat');
  assert.ok(Math.abs(beats.time(5) - 6.1) < 1e-9, 'one last-interval after the last beat');
  assert.equal(beats.index(6.2), 5);
  assert.ok(beats.pulse(6.1) > 0.99, 'an extrapolated beat still pulses');
});

test('pulse peaks on mapped beats and decays between them', () => {
  const beats = loadBeats();
  beats.configure({ bpm: 60, first: 0, times: TIMES });
  assert.ok(beats.pulse(3.7) > 0.99);
  assert.ok(beats.pulse(4.2) < 0.05);
  assert.equal(beats.pulse(0.2), 0, 'no pulse before the first beat');
});

test('an empty or one-beat map falls back to the fixed grid', () => {
  const beats = loadBeats();
  beats.configure({ bpm: 120, first: 0, times: [3] });
  assert.equal(beats.time(2), 1);
});
