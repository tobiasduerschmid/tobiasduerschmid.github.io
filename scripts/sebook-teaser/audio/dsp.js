/**
 * Small, dependency-free DSP toolkit for the SE Book teaser soundtrack.
 *
 * Everything renders offline into Float32Arrays at a single sample rate, and
 * all randomness comes from a seeded PRNG, so every render of the soundtrack
 * is sample-identical. Filters are the RBJ "Audio EQ Cookbook" biquads; the
 * reverb is Jezar's public-domain Freeverb; loudness follows ITU-R BS.1770-4.
 */
'use strict';

const fs = require('node:fs');

const TAU = 2 * Math.PI;

/** Seeded PRNG (mulberry32): returns a function yielding floats in [0, 1). */
function createRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const midiToHz = (note) => 440 * Math.pow(2, (note - 69) / 12);
const dbToGain = (db) => Math.pow(10, db / 20);
const gainToDb = (gain) => 20 * Math.log10(Math.max(gain, 1e-12));

/** Two equally long channels of float samples. */
class StereoTrack {
  constructor(sampleRate, seconds) {
    this.sampleRate = sampleRate;
    const length = Math.ceil(seconds * sampleRate);
    this.left = new Float32Array(length);
    this.right = new Float32Array(length);
  }

  get length() {
    return this.left.length;
  }

  /** Mixes a mono signal in at `time` seconds with an equal-power pan (-1 left … 1 right). */
  addMono(signal, time, gain = 1, pan = 0) {
    const angle = (clampValue(pan, -1, 1) + 1) * Math.PI / 4;
    this.addStereo(signal, signal, time, gain * Math.cos(angle) * Math.SQRT2, gain * Math.sin(angle) * Math.SQRT2);
  }

  /** Mixes a stereo pair in at `time` seconds (separate gains per side). */
  addStereo(left, right, time, gainLeft = 1, gainRight = gainLeft) {
    const start = Math.round(time * this.sampleRate);
    const from = Math.max(0, -start);
    const to = Math.min(left.length, this.length - start);
    for (let i = from; i < to; i++) {
      this.left[start + i] += left[i] * gainLeft;
      this.right[start + i] += right[i] * gainRight;
    }
  }

  addTrack(track, gain = 1) {
    this.addStereo(track.left, track.right, 0, gain);
  }

  /** Multiplies every sample by gainCurve[i] (a per-sample gain envelope). */
  applyGain(gainCurve) {
    for (let i = 0; i < this.length; i++) {
      this.left[i] *= gainCurve[i];
      this.right[i] *= gainCurve[i];
    }
  }

  clone() {
    const copy = new StereoTrack(this.sampleRate, 0);
    copy.left = Float32Array.from(this.left);
    copy.right = Float32Array.from(this.right);
    return copy;
  }
}

function clampValue(value, lo, hi) {
  return Math.min(hi, Math.max(lo, value));
}

// ------------------------------------------------------------------
// Filters
// ------------------------------------------------------------------

/** RBJ cookbook biquad. Call set() again (e.g. every 32 samples) to sweep it. */
class Biquad {
  constructor(sampleRate, type, frequency, q = Math.SQRT1_2, gainDb = 0) {
    this.sampleRate = sampleRate;
    this.type = type;
    this.z1 = 0;
    this.z2 = 0;
    this.set(frequency, q, gainDb);
  }

  set(frequency, q = this.q, gainDb = this.gainDb) {
    this.q = q;
    this.gainDb = gainDb;
    const w0 = TAU * clampValue(frequency, 10, this.sampleRate * 0.45) / this.sampleRate;
    const cos = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * q);
    const A = Math.pow(10, gainDb / 40);
    let b0; let b1; let b2; let a0; let a1; let a2;
    switch (this.type) {
      case 'lowpass':
        b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = b0; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha;
        break;
      case 'highpass':
        b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = b0; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha;
        break;
      case 'bandpass': // constant 0 dB peak gain
        b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha;
        break;
      case 'peaking':
        b0 = 1 + alpha * A; b1 = -2 * cos; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cos; a2 = 1 - alpha / A;
        break;
      case 'highshelf': {
        const s = 2 * Math.sqrt(A) * alpha;
        b0 = A * ((A + 1) + (A - 1) * cos + s); b1 = -2 * A * ((A - 1) + (A + 1) * cos); b2 = A * ((A + 1) + (A - 1) * cos - s);
        a0 = (A + 1) - (A - 1) * cos + s; a1 = 2 * ((A - 1) - (A + 1) * cos); a2 = (A + 1) - (A - 1) * cos - s;
        break;
      }
      case 'lowshelf': {
        const s = 2 * Math.sqrt(A) * alpha;
        b0 = A * ((A + 1) - (A - 1) * cos + s); b1 = 2 * A * ((A - 1) - (A + 1) * cos); b2 = A * ((A + 1) - (A - 1) * cos - s);
        a0 = (A + 1) + (A - 1) * cos + s; a1 = -2 * ((A - 1) + (A + 1) * cos); a2 = (A + 1) + (A - 1) * cos - s;
        break;
      }
      default:
        throw new Error(`Unknown biquad type "${this.type}"`);
    }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
    return this;
  }

  process(x) {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }

  /** Filters `signal` in place; `frequencyAt(i)` (optional) sweeps the cutoff every 32 samples. */
  run(signal, frequencyAt) {
    for (let i = 0; i < signal.length; i++) {
      if (frequencyAt && (i & 31) === 0) this.set(frequencyAt(i));
      signal[i] = this.process(signal[i]);
    }
    return signal;
  }
}

// ------------------------------------------------------------------
// Oscillators and envelopes
// ------------------------------------------------------------------

/** PolyBLEP residual that removes most aliasing from a naive saw step. */
function polyBlep(t, dt) {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

/** Adds a band-limited sawtooth (-1 … 1) to `out`; `frequencyAt(i)` may glide the pitch. */
function addSaw(out, frequency, sampleRate, { phase = 0, gain = 1, frequencyAt = null } = {}) {
  let p = phase;
  for (let i = 0; i < out.length; i++) {
    const dt = (frequencyAt ? frequencyAt(i) : frequency) / sampleRate;
    out[i] += gain * ((2 * p - 1) - polyBlep(p, dt));
    p += dt;
    if (p >= 1) p -= 1;
  }
  return out;
}

/** Adds a sine with an optional per-sample frequency function to `out`. */
function addSine(out, frequency, sampleRate, { phase = 0, gain = 1, frequencyAt = null } = {}) {
  let p = phase * TAU;
  for (let i = 0; i < out.length; i++) {
    out[i] += gain * Math.sin(p);
    p += TAU * (frequencyAt ? frequencyAt(i) : frequency) / sampleRate;
  }
  return out;
}

/** Adds seeded white noise to `out`. */
function addNoise(out, random, gain = 1) {
  for (let i = 0; i < out.length; i++) out[i] += gain * (random() * 2 - 1);
  return out;
}

/** Multiplies `signal` by an attack/hold/exponential-decay envelope (seconds). */
function envelope(signal, sampleRate, { attack = 0.002, hold = 0, decay = 0.2, release = 0.01 } = {}) {
  const attackN = Math.max(1, attack * sampleRate);
  const holdEnd = attackN + hold * sampleRate;
  const releaseN = Math.max(1, release * sampleRate);
  for (let i = 0; i < signal.length; i++) {
    let gain = i < attackN ? i / attackN : i < holdEnd ? 1 : Math.exp(-(i - holdEnd) / (decay * sampleRate));
    const fromEnd = signal.length - 1 - i;
    if (fromEnd < releaseN) gain *= fromEnd / releaseN;
    signal[i] *= gain;
  }
  return signal;
}

/** tanh saturation normalised so a full-scale input stays full-scale. */
function saturate(signal, drive = 1.5) {
  const norm = Math.tanh(drive);
  for (let i = 0; i < signal.length; i++) signal[i] = Math.tanh(signal[i] * drive) / norm;
  return signal;
}

// ------------------------------------------------------------------
// Time-based effects
// ------------------------------------------------------------------

class Comb {
  constructor(size) {
    this.buffer = new Float32Array(size);
    this.index = 0;
    this.store = 0;
  }

  process(x, feedback, damp) {
    const out = this.buffer[this.index];
    this.store = out * (1 - damp) + this.store * damp;
    this.buffer[this.index] = x + this.store * feedback;
    if (++this.index === this.buffer.length) this.index = 0;
    return out;
  }
}

class Allpass {
  constructor(size) {
    this.buffer = new Float32Array(size);
    this.index = 0;
  }

  process(x) {
    const delayed = this.buffer[this.index];
    this.buffer[this.index] = x + delayed * 0.5;
    if (++this.index === this.buffer.length) this.index = 0;
    return delayed - x;
  }
}

/** Freeverb: returns the 100 %-wet stereo reverb of `send` (a StereoTrack). */
function reverb(send, { roomSize = 0.82, damping = 0.3, width = 1 } = {}) {
  const scale = send.sampleRate / 44100;
  const combTuning = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  const allpassTuning = [556, 441, 341, 225];
  const spread = 23;
  const channel = (offset) => ({
    combs: combTuning.map((n) => new Comb(Math.round((n + offset) * scale))),
    allpasses: allpassTuning.map((n) => new Allpass(Math.round((n + offset) * scale))),
  });
  const left = channel(0);
  const right = channel(spread);
  const feedback = roomSize * 0.28 + 0.7;
  const damp = damping * 0.4;
  const wet = new StereoTrack(send.sampleRate, 0);
  wet.left = new Float32Array(send.length);
  wet.right = new Float32Array(send.length);
  const wet1 = width / 2 + 0.5;
  const wet2 = (1 - width) / 2;
  for (let i = 0; i < send.length; i++) {
    const input = (send.left[i] + send.right[i]) * 0.015;
    let outL = 0;
    let outR = 0;
    for (const comb of left.combs) outL += comb.process(input, feedback, damp);
    for (const comb of right.combs) outR += comb.process(input, feedback, damp);
    for (const allpass of left.allpasses) outL = allpass.process(outL);
    for (const allpass of right.allpasses) outR = allpass.process(outR);
    wet.left[i] = outL * wet1 + outR * wet2;
    wet.right[i] = outR * wet1 + outL * wet2;
  }
  return wet;
}

/** Ping-pong delay (100 % wet) with a low-passed feedback path. */
function pingPongDelay(send, { time = 0.375, feedback = 0.35, cutoff = 4000 } = {}) {
  const delay = Math.round(time * send.sampleRate);
  const wet = new StereoTrack(send.sampleRate, 0);
  wet.left = new Float32Array(send.length);
  wet.right = new Float32Array(send.length);
  const lpLeft = new Biquad(send.sampleRate, 'lowpass', cutoff);
  const lpRight = new Biquad(send.sampleRate, 'lowpass', cutoff);
  for (let i = delay; i < send.length; i++) {
    // Left echoes the dry mono sum plus the right side's echo; right echoes the left.
    wet.left[i] = lpLeft.process((send.left[i - delay] + send.right[i - delay]) * 0.5 + wet.right[i - delay] * feedback);
    wet.right[i] = lpRight.process(wet.left[i - delay] * feedback);
  }
  return wet;
}

// ------------------------------------------------------------------
// Dynamics and loudness
// ------------------------------------------------------------------

/** Stereo-linked feed-forward compressor (in place). */
function compress(track, { thresholdDb = -18, ratio = 2, attack = 0.01, release = 0.15, makeupDb = 0 } = {}) {
  const attackCoef = Math.exp(-1 / (attack * track.sampleRate));
  const releaseCoef = Math.exp(-1 / (release * track.sampleRate));
  const makeup = dbToGain(makeupDb);
  let level = 0;
  for (let i = 0; i < track.length; i++) {
    const peak = Math.max(Math.abs(track.left[i]), Math.abs(track.right[i]));
    level = peak > level ? attackCoef * level + (1 - attackCoef) * peak : releaseCoef * level + (1 - releaseCoef) * peak;
    const over = gainToDb(level) - thresholdDb;
    const gain = over > 0 ? dbToGain(-over * (1 - 1 / ratio)) * makeup : makeup;
    track.left[i] *= gain;
    track.right[i] *= gain;
  }
  return track;
}

/** Look-ahead peak limiter (in place): no sample exceeds `ceilingDb`. */
function limit(track, { ceilingDb = -1, lookahead = 0.004, release = 0.08 } = {}) {
  const ceiling = dbToGain(ceilingDb);
  const n = track.length;
  const ahead = Math.max(1, Math.round(lookahead * track.sampleRate));
  const target = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const peak = Math.max(Math.abs(track.left[i]), Math.abs(track.right[i]));
    target[i] = peak > ceiling ? ceiling / peak : 1;
  }
  // Running minimum of the target gain over the look-ahead window (monotonic deque).
  const windowMin = new Float32Array(n);
  const deque = new Int32Array(n);
  let head = 0;
  let tail = 0;
  for (let i = n - 1; i >= 0; i--) {
    while (tail > head && target[deque[tail - 1]] >= target[i]) tail--;
    deque[tail++] = i;
    while (deque[head] > i + ahead) head++;
    windowMin[i] = target[deque[head]];
  }
  const attackCoef = Math.exp(-1 / (ahead / 3));
  const releaseCoef = Math.exp(-1 / (release * track.sampleRate));
  let gain = 1;
  for (let i = 0; i < n; i++) {
    const want = windowMin[i];
    gain = want < gain ? attackCoef * gain + (1 - attackCoef) * want : releaseCoef * gain + (1 - releaseCoef) * want;
    // The clamp only catches the rare overshoot the smoothed gain lets through.
    track.left[i] = clampValue(track.left[i] * gain, -ceiling, ceiling);
    track.right[i] = clampValue(track.right[i] * gain, -ceiling, ceiling);
  }
  return track;
}

/** ITU-R BS.1770-4 integrated loudness (LUFS) of a 48 kHz stereo track. */
function integratedLoudness(track) {
  if (track.sampleRate !== 48000) throw new Error('integratedLoudness() uses the 48 kHz K-weighting coefficients.');
  const kWeight = (input) => {
    const out = new Float64Array(input.length);
    // Stage 1 (head shelf) and stage 2 (RLB high-pass), coefficients from BS.1770-4 for 48 kHz.
    let x1 = 0; let x2 = 0; let y1 = 0; let y2 = 0;
    let u1 = 0; let u2 = 0; let v1 = 0; let v2 = 0;
    for (let i = 0; i < input.length; i++) {
      const x = input[i];
      const y = 1.53512485958697 * x - 2.69169618940638 * x1 + 1.19839281085285 * x2 + 1.69065929318241 * y1 - 0.73248077421585 * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      const v = y - 2 * u1 + u2 + 1.99004745483398 * v1 - 0.99007225036621 * v2;
      u2 = u1; u1 = y; v2 = v1; v1 = v;
      out[i] = v * v;
    }
    return out;
  };
  const left = kWeight(track.left);
  const right = kWeight(track.right);
  const block = Math.round(0.4 * track.sampleRate);
  const step = Math.round(0.1 * track.sampleRate);
  const powers = [];
  for (let start = 0; start + block <= track.length; start += step) {
    let sum = 0;
    for (let i = start; i < start + block; i++) sum += left[i] + right[i];
    powers.push(sum / block);
  }
  const loudness = (power) => -0.691 + 10 * Math.log10(power);
  const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;
  const absolute = powers.filter((power) => loudness(power) > -70);
  if (!absolute.length) return -Infinity;
  const relativeGate = loudness(mean(absolute)) - 10;
  const gated = absolute.filter((power) => loudness(power) > relativeGate);
  return loudness(mean(gated));
}

function peakDb(track) {
  let peak = 0;
  for (let i = 0; i < track.length; i++) peak = Math.max(peak, Math.abs(track.left[i]), Math.abs(track.right[i]));
  return gainToDb(peak);
}

// ------------------------------------------------------------------
// WAV files
// ------------------------------------------------------------------

/** Writes a 16-bit PCM stereo WAV with TPDF dither. */
function writeWav(filePath, track) {
  const n = track.length;
  const buffer = Buffer.alloc(44 + n * 4);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + n * 4, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(2, 22);
  buffer.writeUInt32LE(track.sampleRate, 24);
  buffer.writeUInt32LE(track.sampleRate * 4, 28);
  buffer.writeUInt16LE(4, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(n * 4, 40);
  const random = createRandom(0x5eb00c);
  const quantize = (x) => clampValue(Math.round(x * 32767 + (random() - random())), -32768, 32767);
  for (let i = 0; i < n; i++) {
    buffer.writeInt16LE(quantize(track.left[i]), 44 + i * 4);
    buffer.writeInt16LE(quantize(track.right[i]), 46 + i * 4);
  }
  fs.writeFileSync(filePath, buffer);
}

/** Reads a PCM16 or float32 WAV into mono Float32Array channels. */
function readWav(filePath) {
  const data = fs.readFileSync(filePath);
  if (data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`${filePath} is not a WAV file`);
  }
  let format = null;
  let offset = 12;
  while (offset + 8 <= data.length) {
    const id = data.toString('ascii', offset, offset + 4);
    const size = data.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      format = {
        code: data.readUInt16LE(body),
        channels: data.readUInt16LE(body + 2),
        sampleRate: data.readUInt32LE(body + 4),
        bits: data.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      if (!format) throw new Error(`${filePath}: data chunk before fmt chunk`);
      const bytes = format.bits / 8;
      const frames = Math.floor(size / (bytes * format.channels));
      const channels = Array.from({ length: format.channels }, () => new Float32Array(frames));
      for (let f = 0; f < frames; f++) {
        for (let c = 0; c < format.channels; c++) {
          const at = body + (f * format.channels + c) * bytes;
          if (format.code === 3 && format.bits === 32) channels[c][f] = data.readFloatLE(at);
          else if (format.code === 1 && format.bits === 16) channels[c][f] = data.readInt16LE(at) / 32768;
          else throw new Error(`${filePath}: unsupported WAV format ${format.code}/${format.bits}-bit`);
        }
      }
      return { sampleRate: format.sampleRate, channels };
    }
    offset = body + size + (size % 2);
  }
  throw new Error(`${filePath}: no data chunk`);
}

module.exports = {
  TAU,
  Biquad,
  StereoTrack,
  addNoise,
  addSaw,
  addSine,
  clampValue,
  compress,
  createRandom,
  dbToGain,
  envelope,
  gainToDb,
  integratedLoudness,
  limit,
  midiToHz,
  peakDb,
  pingPongDelay,
  readWav,
  reverb,
  saturate,
  writeWav,
};
