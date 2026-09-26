/**
 * Synthesised instruments for the SE Book teaser soundtrack. Each function
 * renders one hit or note offline and returns a mono Float32Array or a
 * stereo pair { left, right }; the arrangement (soundtrack.js) places them.
 * Every noise source takes a seeded `random` so renders are repeatable.
 */
'use strict';

const {
  Biquad, addNoise, addSaw, addSine, envelope, midiToHz, saturate, TAU,
} = require('./dsp');

const SAMPLE_RATE = 48000;
const samples = (seconds) => Math.max(1, Math.round(seconds * SAMPLE_RATE));

// ------------------------------------------------------------------
// Drums
// ------------------------------------------------------------------

/** Punchy electronic kick: pitch-swept sine body plus a short click. */
function kick(random) {
  const out = new Float32Array(samples(0.5));
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SAMPLE_RATE;
    const frequency = 47 + 120 * Math.exp(-t / 0.032) + 70 * Math.exp(-t / 0.005);
    phase += TAU * frequency / SAMPLE_RATE;
    const amp = Math.min(1, t / 0.0006) * (t < 0.03 ? 1 : Math.exp(-(t - 0.03) / 0.24));
    out[i] = Math.sin(phase) * amp;
  }
  saturate(out, 1.6);
  const click = new Float32Array(samples(0.006));
  addNoise(click, random, 0.5);
  new Biquad(SAMPLE_RATE, 'highpass', 2500).run(click);
  envelope(click, SAMPLE_RATE, { attack: 0.0002, decay: 0.0015, release: 0.001 });
  for (let i = 0; i < click.length; i++) out[i] += click[i];
  envelope(out, SAMPLE_RATE, { attack: 0.0001, decay: 1e6, release: 0.02 });
  return out;
}

/** Hand clap: a few quick noise bursts and a short room tail, per channel. */
function clap(random) {
  const channel = () => {
    const out = new Float32Array(samples(0.35));
    const bursts = [0, 0.009, 0.018, 0.029];
    for (const start of bursts) {
      const at = samples(start);
      for (let i = 0; i < samples(0.012); i++) {
        out[at + i] += (random() * 2 - 1) * Math.exp(-i / samples(0.004));
      }
    }
    const tailAt = samples(0.029);
    for (let i = tailAt; i < out.length; i++) {
      out[i] += (random() * 2 - 1) * 0.55 * Math.exp(-(i - tailAt) / samples(0.11));
    }
    new Biquad(SAMPLE_RATE, 'bandpass', 1250, 0.8).run(out);
    new Biquad(SAMPLE_RATE, 'highpass', 450).run(out);
    return saturate(out, 1.4);
  };
  return { left: channel(), right: channel() };
}

/** Tuned snare for rolls and fills; `pitch` raises the drum tone in semitones. */
function snare(random, pitch = 0) {
  const out = new Float32Array(samples(0.25));
  const base = 190 * Math.pow(2, pitch / 12);
  addSine(out, base, SAMPLE_RATE, { gain: 0.6, frequencyAt: (i) => base * (1 + 0.5 * Math.exp(-i / samples(0.01))) });
  envelope(out, SAMPLE_RATE, { attack: 0.0005, decay: 0.05, release: 0.01 });
  const noise = new Float32Array(out.length);
  addNoise(noise, random, 0.8);
  new Biquad(SAMPLE_RATE, 'bandpass', 3400, 0.6).run(noise);
  envelope(noise, SAMPLE_RATE, { attack: 0.0005, decay: 0.09, release: 0.02 });
  for (let i = 0; i < out.length; i++) out[i] += noise[i];
  return saturate(out, 1.3);
}

/** Hi-hat: high-passed noise; open hats ring longer. */
function hat(random, { open = false } = {}) {
  const out = new Float32Array(samples(open ? 0.3 : 0.06));
  addNoise(out, random);
  new Biquad(SAMPLE_RATE, 'highpass', 7500, 0.8).run(out);
  new Biquad(SAMPLE_RATE, 'peaking', 10500, 1.2, 5).run(out);
  return envelope(out, SAMPLE_RATE, { attack: 0.0005, decay: open ? 0.12 : 0.018, release: 0.01 });
}

/** Crash cymbal: long, decorrelated bright noise per channel. */
function crash(random, length = 1.8) {
  const channel = () => {
    const out = new Float32Array(samples(length));
    addNoise(out, random);
    new Biquad(SAMPLE_RATE, 'highpass', 4200, 0.7).run(out);
    new Biquad(SAMPLE_RATE, 'peaking', 7800, 2, 4).run(out);
    return envelope(out, SAMPLE_RATE, { attack: 0.001, decay: length / 3.5, release: 0.05 });
  };
  return { left: channel(), right: channel() };
}

// ------------------------------------------------------------------
// Bass
// ------------------------------------------------------------------

/** Sub bass: a sine with gentle saturation so it survives on laptop speakers. */
function subBass(note, length) {
  const out = new Float32Array(samples(length));
  addSine(out, midiToHz(note), SAMPLE_RATE);
  saturate(out, 1.8);
  return envelope(out, SAMPLE_RATE, { attack: 0.006, decay: 1e6, release: 0.06 });
}

/** Mid bass pluck (an octave above the sub) for groove on small speakers. */
function bassPluck(note, length = 0.22) {
  const out = new Float32Array(samples(length));
  const frequency = midiToHz(note);
  addSaw(out, frequency * 1.003, SAMPLE_RATE, { gain: 0.5 });
  addSaw(out, frequency * 0.997, SAMPLE_RATE, { gain: 0.5, phase: 0.4 });
  const cutoff = new Biquad(SAMPLE_RATE, 'lowpass', 900, 1.1);
  cutoff.run(out, (i) => 380 + 1400 * Math.exp(-i / samples(0.05)));
  return envelope(out, SAMPLE_RATE, { attack: 0.002, decay: 0.11, release: 0.03 });
}

/** Detuned, filter-wobbled "reese" bass for tension. */
function reese(note, length) {
  const out = new Float32Array(samples(length));
  const frequency = midiToHz(note);
  addSaw(out, frequency * Math.pow(2, 12 / 1200), SAMPLE_RATE, { gain: 0.5 });
  addSaw(out, frequency * Math.pow(2, -12 / 1200), SAMPLE_RATE, { gain: 0.5, phase: 0.25 });
  const wobble = new Biquad(SAMPLE_RATE, 'lowpass', 400, 1.6);
  wobble.run(out, (i) => 260 + 420 * (0.5 + 0.5 * Math.sin(TAU * 4 * i / SAMPLE_RATE)));
  saturate(out, 2.2);
  return envelope(out, SAMPLE_RATE, { attack: 0.02, decay: 1e6, release: 0.08 });
}

// ------------------------------------------------------------------
// Harmony and melody
// ------------------------------------------------------------------

const SUPERSAW_DETUNE_CENTS = [-19, -11, -5, 0, 5, 11, 19];

/**
 * Supersaw chord (future-bass style): seven detuned saws per note spread
 * across the stereo field, low-passed, with an attack/release envelope.
 */
function supersaw(random, notes, length, { cutoff = 5000, cutoffStart = cutoff, sweep = 0.1, attack = 0.01, release = 0.25, decay = 1e6, pitchDrop = 0 } = {}) {
  const left = new Float32Array(samples(length));
  const right = new Float32Array(left.length);
  const voiceGain = 1 / Math.sqrt(notes.length * SUPERSAW_DETUNE_CENTS.length);
  for (const note of notes) {
    SUPERSAW_DETUNE_CENTS.forEach((cents, voice) => {
      const frequency = midiToHz(note) * Math.pow(2, cents / 1200);
      const pan = (voice - 3) / 3; // -1 … 1 across the seven voices
      const bend = pitchDrop
        ? (i) => frequency * Math.pow(2, (pitchDrop * Math.exp(-i / samples(0.035))) / 12)
        : null;
      const tone = addSaw(new Float32Array(left.length), frequency, SAMPLE_RATE, {
        phase: random(), gain: voiceGain, frequencyAt: bend,
      });
      const toLeft = Math.cos((pan + 1) * Math.PI / 4) * Math.SQRT2;
      const toRight = Math.sin((pan + 1) * Math.PI / 4) * Math.SQRT2;
      for (let i = 0; i < left.length; i++) {
        left[i] += tone[i] * toLeft;
        right[i] += tone[i] * toRight;
      }
    });
  }
  const cutoffAt = (i) => cutoff + (cutoffStart - cutoff) * Math.exp(-i / samples(sweep));
  for (const channel of [left, right]) {
    new Biquad(SAMPLE_RATE, 'lowpass', cutoffStart, 0.7).run(channel, cutoffAt);
    envelope(channel, SAMPLE_RATE, { attack, decay, release });
  }
  return { left, right };
}

/** Bright synth pluck for leads and arpeggios. */
function pluck(note, { length = 0.5, decay = 0.16, cutoff = 6500, floor = 900, detuneCents = 8 } = {}) {
  const out = new Float32Array(samples(length));
  const frequency = midiToHz(note);
  addSaw(out, frequency * Math.pow(2, detuneCents / 1200), SAMPLE_RATE, { gain: 0.45 });
  addSaw(out, frequency * Math.pow(2, -detuneCents / 1200), SAMPLE_RATE, { gain: 0.45, phase: 0.37 });
  addSine(out, frequency * 2, SAMPLE_RATE, { gain: 0.15 });
  new Biquad(SAMPLE_RATE, 'lowpass', cutoff, 1.0).run(out, (i) => floor + (cutoff - floor) * Math.exp(-i / samples(0.06)));
  return envelope(out, SAMPLE_RATE, { attack: 0.002, decay, release: 0.04 });
}

/**
 * Plucked string (Karplus–Strong with an all-pass tuning stage), used for
 * the harp-like run that plays as the AI prompt is typed.
 */
function pluckedString(random, note, { length = 1.4, brightness = 0.55, damping = 0.9965 } = {}) {
  const loop = SAMPLE_RATE / midiToHz(note) - 0.5;
  let size = Math.floor(loop);
  let fraction = loop - size;
  if (fraction < 0.1) {
    size -= 1;
    fraction += 1;
  }
  const allpassCoef = (1 - fraction) / (1 + fraction);
  const line = new Float32Array(size);
  let smooth = 0;
  for (let i = 0; i < size; i++) {
    smooth += brightness * ((random() * 2 - 1) - smooth);
    line[i] = smooth;
  }
  const out = new Float32Array(samples(length));
  let index = 0;
  let previous = 0;
  let apIn = 0;
  let apOut = 0;
  for (let i = 0; i < out.length; i++) {
    const current = line[index];
    out[i] = current;
    const averaged = 0.5 * (current + previous);
    previous = current;
    apOut = allpassCoef * averaged + apIn - allpassCoef * apOut;
    apIn = averaged;
    line[index] = apOut * damping;
    if (++index === size) index = 0;
  }
  new Biquad(SAMPLE_RATE, 'highpass', 90).run(out);
  return envelope(out, SAMPLE_RATE, { attack: 0.001, decay: 1e6, release: 0.2 });
}

/** FM bell for chimes and sparkles. */
function bell(note, { length = 1.2, decay = 0.45 } = {}) {
  const out = new Float32Array(samples(length));
  const carrier = midiToHz(note);
  const modulator = carrier * 3.5;
  let carrierPhase = 0;
  let modulatorPhase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SAMPLE_RATE;
    const index = 2.2 * Math.exp(-t / 0.18);
    out[i] = Math.sin(carrierPhase + index * Math.sin(modulatorPhase)) * Math.exp(-t / decay);
    carrierPhase += TAU * carrier / SAMPLE_RATE;
    modulatorPhase += TAU * modulator / SAMPLE_RATE;
  }
  return envelope(out, SAMPLE_RATE, { attack: 0.001, decay: 1e6, release: 0.05 });
}

// ------------------------------------------------------------------
// Transitions
// ------------------------------------------------------------------

/** Noise + saw riser that swells into `length` and stops dead. */
function riser(random, length, { from = 300, to = 7000, pitchFrom = 43, pitchTo = 67 } = {}) {
  const n = samples(length);
  const channel = (spread) => {
    const noise = new Float32Array(n);
    addNoise(noise, random, 0.7);
    const sweep = new Biquad(SAMPLE_RATE, 'bandpass', from, 1.4);
    sweep.run(noise, (i) => from * Math.pow(to / from, i / n));
    const tone = addSaw(new Float32Array(n), 0, SAMPLE_RATE, {
      gain: 0.25,
      phase: spread,
      frequencyAt: (i) => midiToHz(pitchFrom + (pitchTo - pitchFrom) * (i / n)) * (1 + spread * 0.004),
    });
    new Biquad(SAMPLE_RATE, 'lowpass', 2000).run(tone, (i) => 600 + 5000 * (i / n));
    for (let i = 0; i < n; i++) noise[i] = (noise[i] + tone[i]) * Math.pow(i / n, 2.2);
    return envelope(noise, SAMPLE_RATE, { attack: 0.001, decay: 1e6, release: 0.012 });
  };
  return { left: channel(0), right: channel(1) };
}

/** Whoosh that sweeps across the stereo field and peaks at its end. */
function whoosh(random, length = 0.4) {
  const n = samples(length);
  const noise = new Float32Array(n + samples(0.08));
  addNoise(noise, random);
  const sweep = new Biquad(SAMPLE_RATE, 'bandpass', 400, 1.1);
  sweep.run(noise, (i) => 400 * Math.pow(9, Math.min(1, i / n)));
  const left = new Float32Array(noise.length);
  const right = new Float32Array(noise.length);
  for (let i = 0; i < noise.length; i++) {
    const p = Math.min(1, i / n);
    const amp = i < n ? Math.pow(p, 2.5) : Math.exp(-(i - n) / samples(0.02));
    left[i] = noise[i] * amp * Math.cos(p * Math.PI / 2);
    right[i] = noise[i] * amp * Math.sin(p * Math.PI / 2);
  }
  return { left, right };
}

/** Cinematic impact: sub drop, body thump, and a burst of air. */
function impact(random, { length = 1.8, from = 110, to = 32 } = {}) {
  const out = new Float32Array(samples(length));
  addSine(out, from, SAMPLE_RATE, { frequencyAt: (i) => to + (from - to) * Math.exp(-i / samples(0.2)) });
  envelope(out, SAMPLE_RATE, { attack: 0.001, decay: 0.55, release: 0.1 });
  saturate(out, 1.5);
  const air = new Float32Array(out.length);
  addNoise(air, random, 0.5);
  new Biquad(SAMPLE_RATE, 'lowpass', 2500).run(air);
  envelope(air, SAMPLE_RATE, { attack: 0.001, decay: 0.12, release: 0.05 });
  for (let i = 0; i < out.length; i++) out[i] += air[i];
  return out;
}

module.exports = {
  SAMPLE_RATE,
  bassPluck,
  bell,
  clap,
  crash,
  hat,
  impact,
  kick,
  pluck,
  pluckedString,
  reese,
  riser,
  snare,
  subBass,
  supersaw,
  whoosh,
};
