/**
 * The SE Book teaser's instrumental soundtrack.
 *
 * The music is arranged against the storyboard's scene times (sections) and
 * the stage's sound cues (exact moments such as keystrokes, alerts, and cuts),
 * so it stays locked to the picture when the storyboard is re-timed:
 *
 *   prompt → intro      soft pad; each typed character plucks the next note
 *                       of a rising harp run; the arp builds as code streams
 *   chaos → tension     driving kick + reese bass, a harsh chord stab on each
 *                       alert, then a tape stop as the scene collapses
 *   reframe → breakdown sub hit, pads, a sparkle for the underline, a riser
 *                       and snare roll, and a beat of silence before the drop
 *   skills → drop       four-on-the-floor future-bass groove with pumping
 *                       supersaw chords, a pluck lead, whooshes on every cut,
 *                       and chimes as the tests turn green
 *   tutorials → groove  the beat continues, darker, with a fill into the end
 *   cta → outro         final impact on a bright Cmaj9 that rings out
 *
 * Everything is synthesised (instruments.js) and deterministic.
 */
'use strict';

const {
  Biquad, StereoTrack, clampValue, compress, createRandom, dbToGain, integratedLoudness,
  limit, peakDb, pingPongDelay, reverb,
} = require('./dsp');
const inst = require('./instruments');

const { SAMPLE_RATE } = inst;

const CHORDS = {
  Am9: { notes: [57, 60, 64, 67, 71], root: 33 },
  Fmaj9: { notes: [53, 57, 60, 64, 67], root: 29 },
  C69: { notes: [55, 60, 64, 69, 74], root: 36 },
  G69: { notes: [55, 59, 62, 64, 69], root: 31 },
  Cmaj9: { notes: [48, 55, 59, 62, 64, 67], root: 36 },
};

/** Drop melody, one bar per chord: [eighth-note position, MIDI note]. */
const LEAD = [
  [[0, 76], [2, 79], [3, 76], [5, 74], [6, 72], [7, 74]],
  [[0, 76], [2, 72], [3, 69], [5, 72], [6, 74], [7, 76]],
  [[0, 79], [2, 76], [3, 74], [5, 72], [6, 74], [7, 76]],
  [[0, 74], [2, 71], [3, 67], [5, 69], [6, 71], [7, 74]],
];
const DROP_PROGRESSION = ['Am9', 'Fmaj9', 'C69', 'G69'];

/** A minor pentatonic, rising: one note per keystroke of the AI prompt. */
const HARP_RUN = [57, 60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84, 86, 88, 91, 93];
const PASS_CHIMES = [84, 88, 91, 96];
const SPARKLE = [76, 79, 81, 83, 86, 88];
const OUTRO_SPARKLE = [72, 76, 79, 83, 86, 88, 91];

/**
 * Collects instrument hits for one stretch of the song into stems, then
 * applies kick sidechain pumping and the shared reverb / delay returns.
 */
class Mixer {
  constructor(duration, seed) {
    const track = () => new StereoTrack(SAMPLE_RATE, duration);
    this.stems = { drums: track(), bass: track(), harmony: track(), melody: track(), fx: track() };
    this.reverbSend = track();
    this.delaySend = track();
    this.kickTimes = [];
    this.random = createRandom(seed);
  }

  /** Adds a mono signal or { left, right } pair to a stem at `time`. */
  add(stem, sound, time, { gain = 1, pan = 0, reverb: reverbAmount = 0, delay = 0 } = {}) {
    const targets = [[this.stems[stem], gain], [this.reverbSend, gain * reverbAmount], [this.delaySend, gain * delay]];
    for (const [target, level] of targets) {
      if (level === 0) continue;
      if (sound instanceof Float32Array) target.addMono(sound, time, level, pan);
      else target.addStereo(sound.left, sound.right, time, level);
    }
  }

  kick(sound, time, gain) {
    this.kickTimes.push(time);
    this.add('drums', sound, time, { gain });
  }

  /** Sums the stems; bass and harmony duck under every kick ("pumping"). */
  render() {
    const { drums, bass, harmony, melody, fx } = this.stems;
    bass.applyGain(sidechainCurve(bass.length, this.kickTimes, 0.7));
    harmony.applyGain(sidechainCurve(harmony.length, this.kickTimes, 0.55));
    const bus = new StereoTrack(SAMPLE_RATE, 0);
    bus.left = new Float32Array(drums.length);
    bus.right = new Float32Array(drums.length);
    for (const stem of [drums, bass, harmony, melody, fx]) bus.addTrack(stem);
    bus.addTrack(pingPongDelay(this.delaySend, { time: 0.375, feedback: 0.38, cutoff: 3800 }), 0.5);
    this.reverbSend.addTrack(this.delaySend, 0.3);
    bus.addTrack(reverb(this.reverbSend, { roomSize: 0.84, damping: 0.35 }), 1.0);
    return bus;
  }
}

/** Per-sample gain that dips by `depth` at each kick and recovers over ~200 ms. */
function sidechainCurve(length, kickTimes, depth) {
  const curve = new Float32Array(length).fill(1);
  const attack = Math.round(0.003 * SAMPLE_RATE);
  const recover = Math.round(0.21 * SAMPLE_RATE);
  for (const time of kickTimes) {
    const start = Math.round(time * SAMPLE_RATE);
    for (let i = 0; i < attack + recover; i++) {
      const at = start + i;
      if (at < 0 || at >= length) continue;
      const duck = i < attack ? i / attack : 1 - Math.pow((i - attack) / recover, 1.6);
      curve[at] = Math.min(curve[at], 1 - depth * duck);
    }
  }
  return curve;
}

/**
 * Slows the bus to a stop between `from` and `to` like a stopped tape
 * deck, then leaves silence (the next section is mixed in afterwards).
 */
function tapeStop(bus, from, to) {
  const a = Math.round(from * SAMPLE_RATE);
  const b = Math.round(to * SAMPLE_RATE);
  const sourceLeft = bus.left.slice(a, b + 2);
  const sourceRight = bus.right.slice(a, b + 2);
  let position = 0;
  for (let i = a; i < bus.length; i++) {
    if (i >= b) {
      bus.left[i] = 0;
      bus.right[i] = 0;
      continue;
    }
    const p = (i - a) / (b - a);
    const j = Math.floor(position);
    const f = position - j;
    const fade = p > 0.75 ? (1 - p) / 0.25 : 1;
    bus.left[i] = (sourceLeft[j] * (1 - f) + sourceLeft[j + 1] * f) * fade;
    bus.right[i] = (sourceRight[j] * (1 - f) + sourceRight[j + 1] * f) * fade;
    position += Math.pow(1 - p, 1.7);
  }
}

// ------------------------------------------------------------------
// Arrangement
// ------------------------------------------------------------------

function beatsBetween(from, to, beat) {
  const times = [];
  for (let t = Math.ceil(from / beat - 1e-6) * beat; t < to - 1e-6; t += beat) times.push(+t.toFixed(6));
  return times;
}

function playChord(mix, chord, start, length, options = {}) {
  const { gain = 0.34, reverb: send = 0.12, ...synth } = options;
  mix.add('harmony', inst.supersaw(mix.random, CHORDS[chord].notes, length, synth), start, { gain, reverb: send });
}

function playBass(mix, chord, start, length, { sub = 0.3, pluck = 0.34, beat }) {
  const { root } = CHORDS[chord];
  mix.add('bass', inst.subBass(root, length), start, { gain: sub });
  for (const t of beatsBetween(start + beat / 2, start + length, beat)) {
    mix.add('bass', inst.bassPluck(root + 12), t, { gain: pluck });
  }
}

function playGroove(mix, from, to, { beat, fillFrom = Infinity, hats = 0.16 }) {
  for (const t of beatsBetween(from, Math.min(to, fillFrom + beat), beat)) mix.kick(inst.kick(mix.random), t, 0.95);
  // Claps on beats 2 and 4 of each bar (bars start on even beats).
  for (const t of beatsBetween(from, Math.min(to, fillFrom), beat)) {
    if (Math.round(t / beat) % 2 === 1) mix.add('drums', inst.clap(mix.random), t, { gain: 0.5, reverb: 0.18 });
  }
  for (const t of beatsBetween(from, to, beat / 4)) {
    const offbeat = Math.round(t / (beat / 2)) % 2 === 1 && Math.abs((t / (beat / 2)) % 1) < 1e-6;
    const accent = Math.round(t / (beat / 4)) % 2 === 1 ? 1 : 0.6;
    if (offbeat) mix.add('drums', inst.hat(mix.random, { open: true }), t, { gain: hats * 0.8, pan: 0.25 });
    else mix.add('drums', inst.hat(mix.random), t, { gain: hats * accent, pan: 0.2 });
  }
}

function snareRoll(mix, from, to) {
  const steps = [];
  const span = to - from;
  for (let t = from; t < to - 1e-6;) {
    const p = (t - from) / span;
    steps.push({ t, p });
    t += p < 0.5 ? 0.25 : p < 0.8 ? 0.125 : 0.0625;
  }
  for (const { t, p } of steps) mix.add('drums', inst.snare(mix.random, p * 9), t, { gain: 0.18 + 0.4 * p, reverb: 0.15 });
}

function introSection(mix, span, cues, beat) {
  const { start, end } = span;
  playChord(mix, 'Am9', start, end - start + 0.2, { gain: 0.26, cutoff: 1300, attack: 0.35, release: 0.3, reverb: 0.35 });

  cues.filter((c) => c.kind === 'keystroke').forEach((cue, index) => {
    const note = HARP_RUN[Math.min(index, HARP_RUN.length - 1)];
    mix.add('melody', inst.pluckedString(mix.random, note), cue.at, {
      gain: 0.55, pan: index % 2 ? 0.3 : -0.3, reverb: 0.35, delay: 0.12,
    });
  });

  const submit = cues.find((c) => c.kind === 'submit');
  if (submit) {
    mix.add('fx', inst.whoosh(mix.random, 0.3), submit.at - 0.3, { gain: 0.18 });
    playChord(mix, 'Am9', submit.at, 0.9, { gain: 0.36, cutoff: 900, cutoffStart: 7000, sweep: 0.12, decay: 0.28, release: 0.2 });
    // A rising 16th-note arpeggio while the code streams in.
    const arp = [69, 72, 76, 79, 83, 79, 76, 72];
    beatsBetween(submit.at + beat / 2, end, beat / 4).forEach((t, index, all) => {
      const p = index / all.length;
      mix.add('melody', inst.pluck(arp[index % arp.length], { cutoff: 1800 + 5000 * p, floor: 700, decay: 0.09 }), t, {
        gain: 0.16 + 0.12 * p, pan: index % 2 ? 0.35 : -0.35, reverb: 0.2, delay: 0.15,
      });
    });
    for (const t of beatsBetween(submit.at + beat, end, beat)) mix.kick(inst.kick(mix.random), t, 0.55);
    mix.add('fx', inst.riser(mix.random, end - (submit.at + beat)), submit.at + beat, { gain: 0.14 });
  }
}

function tensionSection(mix, span, cues, beat) {
  const { start } = span;
  const collapse = cues.find((c) => c.kind === 'collapse');
  const stop = collapse ? collapse.at : span.end;
  for (const t of beatsBetween(start, stop, beat)) mix.kick(inst.kick(mix.random), t, 1);
  for (const t of beatsBetween(start, stop, beat / 4)) {
    mix.add('drums', inst.hat(mix.random), t, { gain: Math.round(t / (beat / 4)) % 2 ? 0.17 : 0.1, pan: 0.2 });
  }
  mix.add('bass', inst.reese(33, stop - start + 0.3), start, { gain: 0.3 });
  mix.add('bass', inst.subBass(33, stop - start + 0.3), start, { gain: 0.24 });

  const stabs = [0, 1, 3];
  cues.filter((c) => c.kind === 'alert').forEach((cue, index) => {
    const shift = stabs[Math.min(index, stabs.length - 1)];
    const cluster = [57, 58, 64, 70].map((n) => n + shift);
    mix.add('harmony', inst.supersaw(mix.random, cluster, 0.5, {
      cutoff: 2600, cutoffStart: 6500, sweep: 0.05, decay: 0.14, release: 0.1, pitchDrop: 3,
    }), cue.at, { gain: 0.5, reverb: 0.2 });
    mix.add('drums', inst.snare(mix.random, 2), cue.at, { gain: 0.45, reverb: 0.12 });
    mix.add('drums', inst.clap(mix.random), cue.at, { gain: 0.3 });
  });
}

function breakdownSection(mix, span, cues, beat) {
  const { start, end } = span;
  const air = end - beat / 4; // one 16th of silence before the drop
  mix.add('fx', inst.impact(mix.random, { from: 90, to: 34 }), start, { gain: 0.42, reverb: 0.25 });
  const mid = start + Math.round((end - start) / 3 / beat) * beat;
  playChord(mix, 'Fmaj9', start, mid - start + 0.3, { gain: 0.3, cutoff: 1600, attack: 0.25, release: 0.35, reverb: 0.4 });
  playChord(mix, 'G69', mid, air - mid, { gain: 0.3, cutoff: 2200, cutoffStart: 900, sweep: 0.8, attack: 0.2, release: 0.02, reverb: 0.4 });
  mix.add('bass', inst.subBass(31, air - mid), mid, { gain: 0.16 });

  const underline = cues.find((c) => c.kind === 'underline');
  if (underline) {
    SPARKLE.forEach((note, index) => {
      mix.add('melody', inst.bell(note, { decay: 0.5 }), underline.at + index * 0.05, {
        gain: 0.14, pan: -0.6 + index * 0.24, reverb: 0.45, delay: 0.1,
      });
    });
  }
  mix.add('fx', inst.riser(mix.random, air - mid), mid, { gain: 0.26 });
  snareRoll(mix, air - 2 * beat + beat / 4, air);
}

function dropSection(mix, span, cues, beat) {
  const { start, end } = span;
  const bar = beat * 4;
  mix.add('drums', inst.crash(mix.random), start, { gain: 0.3 });
  mix.add('fx', inst.impact(mix.random, { length: 1, from: 120, to: 45 }), start, { gain: 0.35 });
  playGroove(mix, start, end, { beat });

  DROP_PROGRESSION.forEach((chord, index) => {
    const barStart = start + index * bar;
    if (barStart >= end) return;
    const length = Math.min(bar, end - barStart);
    playChord(mix, chord, barStart, length + 0.05, { gain: 0.48, cutoff: 5200, release: 0.05 });
    playBass(mix, chord, barStart, length, { beat });
    for (const [eighth, note] of LEAD[index]) {
      const t = barStart + eighth * beat / 2;
      if (t < end - 1e-6) mix.add('melody', inst.pluck(note), t, { gain: 0.36, reverb: 0.22, delay: 0.3 });
    }
  });
  if (start + 2 * bar < end) mix.add('drums', inst.crash(mix.random, 1.2), start + 2 * bar, { gain: 0.18 });

  cues.filter((c) => c.kind === 'pass').forEach((cue, index) => {
    mix.add('melody', inst.bell(PASS_CHIMES[index % PASS_CHIMES.length]), cue.at, { gain: 0.16, reverb: 0.3, pan: 0.2 });
  });
}

/** A whoosh into every scene cut after the drop (the drop itself has its riser). */
function cutAccents(mix, cues, dropStart) {
  cues.filter((c) => c.kind === 'cut' && c.at > dropStart + 1e-6).forEach((cue) => {
    mix.add('fx', inst.whoosh(mix.random, 0.32), cue.at - 0.32, { gain: 0.2 });
    mix.add('drums', inst.crash(mix.random, 0.6), cue.at, { gain: 0.12 });
  });
}

function grooveSection(mix, span, beat) {
  const { start, end } = span;
  const air = end - beat / 4;
  const fillFrom = end - 2 * beat;
  playGroove(mix, start, air, { beat, fillFrom, hats: 0.13 });
  snareRoll(mix, fillFrom, air);
  const barLine = Math.ceil(start / (beat * 4)) * beat * 4;
  const segments = [['G69', start, barLine], ['Am9', barLine, air]].filter(([, a, b]) => b - a > 1e-6);
  for (const [chord, a, b] of segments) {
    playChord(mix, chord, a, b - a, { gain: 0.38, cutoff: 1900, release: 0.02 });
    playBass(mix, chord, a, b - a, { beat, sub: 0.27, pluck: 0.28 });
  }
  mix.add('fx', inst.riser(mix.random, air - fillFrom, { from: 500, to: 9000, pitchFrom: 55, pitchTo: 79 }), fillFrom, { gain: 0.2 });
}

function outroSection(mix, span) {
  const { start, end } = span;
  const ring = end - start + 0.5;
  mix.kick(inst.kick(mix.random), start, 1);
  mix.add('drums', inst.crash(mix.random, 2.4), start, { gain: 0.32 });
  mix.add('fx', inst.impact(mix.random), start, { gain: 0.5, reverb: 0.2 });
  playChord(mix, 'Cmaj9', start, ring, { gain: 0.52, cutoff: 4200, cutoffStart: 9000, sweep: 0.4, decay: 1.4, release: 0.3, reverb: 0.3 });
  mix.add('bass', inst.subBass(CHORDS.Cmaj9.root, ring), start, { gain: 0.3 });
  mix.add('bass', inst.bassPluck(CHORDS.Cmaj9.root + 12, 0.6), start, { gain: 0.34 });
  OUTRO_SPARKLE.forEach((note, index) => {
    mix.add('melody', inst.bell(note, { decay: 0.7, length: 1.8 }), start + 0.06 + index * 0.0625, {
      gain: 0.13, pan: -0.5 + index / 6, reverb: 0.45, delay: 0.15,
    });
  });
}

/** Which song section each storyboard scene belongs to. */
const SECTION_OF_SCENE = {
  prompt: 'intro',
  chaos: 'tension',
  reframe: 'breakdown',
  git: 'drop',
  testing: 'drop',
  design: 'drop',
  architecture: 'drop',
  teamwork: 'drop',
  tutorials: 'groove',
  cta: 'outro',
};

function sectionSpans(storyboard) {
  const spans = {};
  for (const scene of storyboard.scenes) {
    const name = SECTION_OF_SCENE[scene.id];
    if (!name) throw new Error(`soundtrack.js has no section for storyboard scene "${scene.id}".`);
    const span = spans[name] || (spans[name] = { start: scene.start, end: scene.end });
    span.start = Math.min(span.start, scene.start);
    span.end = Math.max(span.end, scene.end);
  }
  for (const name of new Set(Object.values(SECTION_OF_SCENE))) {
    if (!spans[name]) throw new Error(`The storyboard has no scene for the "${name}" section.`);
  }
  return spans;
}

/**
 * Renders the instrumental soundtrack (pre-master) for the storyboard.
 * `cues` are the stage's timed sound cues: [{ kind, at }].
 */
function renderMusic(storyboard, cues) {
  const beat = 60 / storyboard.audio.tempo;
  const spans = sectionSpans(storyboard);
  const within = ({ start, end }) => cues.filter((c) => c.at >= start - 0.5 && c.at < end);

  // Everything up to the tape stop is mixed separately so the stop can
  // swallow its reverb tails too.
  const before = new Mixer(storyboard.duration, 0x7ea5e1);
  introSection(before, spans.intro, within(spans.intro), beat);
  tensionSection(before, spans.tension, within(spans.tension), beat);
  const beforeBus = before.render();
  const collapse = cues.find((c) => c.kind === 'collapse');
  tapeStop(beforeBus, collapse ? collapse.at : spans.tension.end - 0.4, spans.tension.end);

  const after = new Mixer(storyboard.duration, 0x5eb00c);
  breakdownSection(after, spans.breakdown, within(spans.breakdown), beat);
  dropSection(after, spans.drop, within(spans.drop), beat);
  cutAccents(after, cues, spans.drop.start);
  grooveSection(after, spans.groove, beat);
  outroSection(after, spans.outro);
  const bus = after.render();
  bus.addTrack(beforeBus);
  fadeOut(bus, OUTRO_FADE);
  return bus;
}

const OUTRO_FADE = 0.7; // seconds the final chord takes to fade to silence

function scaleToLoudness(bus, targetLufs) {
  const gain = dbToGain(targetLufs - integratedLoudness(bus));
  for (let i = 0; i < bus.length; i++) {
    bus.left[i] *= gain;
    bus.right[i] *= gain;
  }
}

function fadeOut(bus, seconds) {
  const from = Math.max(0, bus.length - Math.round(seconds * SAMPLE_RATE));
  for (let i = from; i < bus.length; i++) {
    const g = Math.pow(1 - (i - from) / (bus.length - from), 2);
    bus.left[i] *= g;
    bus.right[i] *= g;
  }
}

/**
 * Masters a bus in place: rumble filter, glue compression, loudness
 * normalisation to `targetLufs`, a -1 dBFS peak limit, and a click-free end.
 */
function master(bus, { targetLufs = -16 } = {}) {
  // Rumble cut plus a gentle tilt: the kick and sub otherwise dominate, which
  // sounds thin on the laptop and phone speakers most students will use.
  for (const channel of [bus.left, bus.right]) {
    new Biquad(SAMPLE_RATE, 'highpass', 28, 0.7).run(channel);
    new Biquad(SAMPLE_RATE, 'lowshelf', 90, 0.7, -3).run(channel);
    new Biquad(SAMPLE_RATE, 'highshelf', 9000, 0.7, -2).run(channel);
  }
  // Gain-stage to a fixed level first so the glue compressor only tames the
  // loudest hits instead of flattening the quiet intro into the drop.
  scaleToLoudness(bus, -22);
  compress(bus, { thresholdDb: -14, ratio: 2, attack: 0.012, release: 0.14 });
  scaleToLoudness(bus, targetLufs);
  limit(bus, { ceilingDb: -1 });
  fadeOut(bus, 0.02);
  return { loudness: integratedLoudness(bus), peak: peakDb(bus) };
}

/**
 * Mixes the narration over the music for the audio-described cut: the voice
 * sits `voiceOverMusicDb` above the music's loudness, and the music ducks by
 * `duckDb` wherever the narrator speaks.
 */
function mixDescribed(music, narration, { duckDb = -11, voiceOverMusicDb = 2 } = {}) {
  const mix = music.clone();
  const voiceGain = dbToGain(integratedLoudness(music) + voiceOverMusicDb - integratedLoudness(narration.track));
  const attack = Math.exp(-1 / (0.05 * SAMPLE_RATE));
  const release = Math.exp(-1 / (0.35 * SAMPLE_RATE));
  const floor = dbToGain(duckDb);
  let level = 0;
  for (let i = 0; i < mix.length; i++) {
    const target = narration.activity[i];
    level = target > level ? attack * level + (1 - attack) * target : release * level + (1 - release) * target;
    const gain = 1 - (1 - floor) * clampValue(level, 0, 1);
    mix.left[i] = mix.left[i] * gain + narration.track.left[i] * voiceGain;
    mix.right[i] = mix.right[i] * gain + narration.track.right[i] * voiceGain;
  }
  return mix;
}

module.exports = { SAMPLE_RATE, master, mixDescribed, renderMusic };
