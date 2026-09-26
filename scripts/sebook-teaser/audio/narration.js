/**
 * Narration for the audio-described cut of the SE Book teaser (WCAG 1.2.5),
 * spoken with the macOS `say` voice named in the storyboard's `audio` block.
 * Each scene's `narration` is placed at its `narration_at` time; overlapping
 * lines are an authoring error, reported with the fix to apply.
 */
'use strict';

const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { Biquad, StereoTrack, dbToGain, readWav } = require('./dsp');
const { SAMPLE_RATE } = require('./instruments');

const SILENCE = dbToGain(-45);
const DUCK_LEAD_IN = 0.12; // seconds the music starts ducking before a line
const MIN_GAP = 0.05;

/** Speaks `text` into a WAV and returns the mono voice with silence trimmed. */
function speak(text, { voice, rate }, wavPath) {
  execFileSync('say', [
    '-v', voice, '-r', String(rate), '--file-format=WAVE', `--data-format=LEF32@${SAMPLE_RATE}`, '-o', wavPath, text,
  ]);
  const { sampleRate, channels } = readWav(wavPath);
  if (sampleRate !== SAMPLE_RATE) throw new Error(`say wrote ${sampleRate} Hz audio; expected ${SAMPLE_RATE} Hz.`);
  const voiceSignal = channels[0];
  let first = 0;
  while (first < voiceSignal.length && Math.abs(voiceSignal[first]) < SILENCE) first++;
  let last = voiceSignal.length - 1;
  while (last > first && Math.abs(voiceSignal[last]) < SILENCE) last--;
  return voiceSignal.slice(first, last + 1);
}

/** Radio-style clean-up: rumble cut, presence lift, peak at -3 dBFS. */
function polish(voiceSignal) {
  new Biquad(SAMPLE_RATE, 'highpass', 90).run(voiceSignal);
  new Biquad(SAMPLE_RATE, 'peaking', 3200, 1, 2.5).run(voiceSignal);
  let peak = 0;
  for (const x of voiceSignal) peak = Math.max(peak, Math.abs(x));
  const gain = dbToGain(-3) / peak;
  for (let i = 0; i < voiceSignal.length; i++) voiceSignal[i] *= gain;
  return voiceSignal;
}

/**
 * Renders every scene's narration onto one track. Returns the track, a
 * per-sample `activity` curve (1 while the narrator speaks) for ducking the
 * music, and the timed `lines` for the described captions.
 */
function renderNarration(storyboard, workDir) {
  const { voice, voice_rate: rate } = storyboard.audio;
  const track = new StereoTrack(SAMPLE_RATE, storyboard.duration);
  const activity = new Float32Array(track.length);
  const lines = storyboard.scenes.filter((scene) => scene.narration).map((scene, index) => {
    const start = scene.narration_at ?? scene.start + 0.1;
    const voiceSignal = polish(speak(scene.narration, { voice, rate }, path.join(workDir, `narration-${index}.wav`)));
    track.addMono(voiceSignal, start);
    const end = start + voiceSignal.length / SAMPLE_RATE;
    const from = Math.max(0, Math.round((start - DUCK_LEAD_IN) * SAMPLE_RATE));
    const to = Math.min(activity.length, Math.round(end * SAMPLE_RATE));
    activity.fill(1, from, to);
    return { scene: scene.id, text: scene.narration, start, end };
  });

  lines.forEach((line, index) => {
    const next = lines[index + 1];
    const limit = next ? next.start - MIN_GAP : storyboard.duration;
    if (line.end > limit) {
      throw new Error(
        `Narration for scene "${line.scene}" runs ${line.start.toFixed(2)}–${line.end.toFixed(2)} s and overlaps `
        + (next ? `scene "${next.scene}" at ${next.start.toFixed(2)} s` : 'the end of the video')
        + '. Shorten the line, move narration_at, or raise audio.voice_rate in _data/sebook_teaser.yml.',
      );
    }
  });
  return { track, activity, lines };
}

module.exports = { renderNarration };
