/**
 * The audio-described cut of a song video (WCAG 1.2.5). The song has vocals
 * almost throughout, so there is no room to describe the picture over it;
 * this cut uses extended audio description instead: before each section the
 * picture holds while a narrator reads the section's `narration`, then the
 * song resumes where it paused.
 *
 *   speakNarrations(storyboard, workDir, sampleRate) → one mono voice per section
 *   planDescribedCut(storyboard, voices, sampleRate) → where every hold goes
 *   linkDescribedFrames(plan, sourceDir, outDir, frameFileName)
 *   mixDescribedAudio(plan, song, voices) → the described soundtrack
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { readWav } = require('./wav');

const LEAD_SILENCE = 0.3; // seconds of quiet before the narrator speaks
const TAIL_SILENCE = 0.5; // after the narrator, before the song resumes
const CUT_BEFORE_LINE = 0.08; // the song pauses this long before a section's first word
const PICTURE_AFTER_LINE = 0.6; // the held picture: the section, just after its first word
const FADE = 0.015; // fades around every cut in the song, so the pauses don't click
const QUIET = 0.003; // trimmed from the ends of each spoken description

/** Text the narrator reads aloud: Git notation spelled out the way people say it. */
function spokenForm(text) {
  return text
    .replace(/(\w+)\.(py|txt|md|css)\b/g, (_, name, ext) => `${name.replace(/_/g, ' ')} dot ${ext.split('').join(' ')}`)
    .replace(/--(\w+)/g, 'dash dash $1')
    .replace(/ -(\w)\b/g, ' dash $1')
    .replace(/(\w)\/(\w)/g, '$1 slash $2')
    .replace(/\ba3f2\b/g, 'a three f two')
    .replace(/\bHEAD\b/g, 'head');
}

function trimQuiet(voice) {
  let first = 0;
  while (first < voice.length && Math.abs(voice[first]) < QUIET) first++;
  let last = voice.length - 1;
  while (last > first && Math.abs(voice[last]) < QUIET) last--;
  return voice.slice(first, last + 1);
}

/** Speaks every section's narration with the storyboard's macOS `say` voice. */
function speakNarrations(storyboard, workDir, sampleRate) {
  const { voice, rate } = storyboard.narrator;
  return storyboard.sections.map((section, index) => {
    const file = path.join(workDir, `narration-${index}.wav`);
    execFileSync('say', [
      '-v', voice, '-r', String(rate), '--file-format=WAVE', `--data-format=LEI16@${sampleRate}`,
      '-o', file, spokenForm(section.narration),
    ]);
    const spoken = readWav(file);
    if (spoken.sampleRate !== sampleRate) throw new Error(`say wrote ${spoken.sampleRate} Hz; expected ${sampleRate} Hz.`);
    return trimQuiet(spoken.channels[0]);
  });
}

/**
 * One hold per section, in output frames. Each hold shows `pictureFrame`
 * for `frames` frames while the narration plays, then the song runs from
 * `songFrame` for `segmentFrames` frames. Times in seconds of the output
 * (`outputStart`, `speechStart`, `speechEnd`, `outputEnd`) serve the captions.
 */
function planDescribedCut(storyboard, voices, sampleRate) {
  const { fps } = storyboard;
  const songFrames = Math.round(fps * storyboard.duration);
  const holds = storyboard.sections.map((section, index) => {
    const firstWord = section.lines[0].start;
    const speech = voices[index].length / sampleRate;
    return {
      section: section.id,
      narration: section.narration,
      songFrame: index === 0 ? 0 : Math.round((firstWord - CUT_BEFORE_LINE) * fps),
      pictureFrame: Math.min(songFrames - 1, Math.round((firstWord + PICTURE_AFTER_LINE) * fps)),
      frames: Math.ceil((LEAD_SILENCE + speech + TAIL_SILENCE) * fps),
      speech,
    };
  });
  let cursor = 0;
  holds.forEach((hold, index) => {
    hold.segmentFrames = (index + 1 < holds.length ? holds[index + 1].songFrame : songFrames) - hold.songFrame;
    hold.outputFrame = cursor;
    hold.outputStart = cursor / fps;
    hold.speechStart = hold.outputStart + LEAD_SILENCE;
    hold.speechEnd = hold.speechStart + hold.speech;
    hold.outputEnd = (cursor + hold.frames) / fps;
    hold.songTime = hold.songFrame / fps;
    cursor += hold.frames + hold.segmentFrames;
  });
  return { fps, holds, frameCount: cursor, duration: cursor / fps };
}

/** Audio-clock manifest for the live vector player, from the exact mixing plan. */
function describedTimeline(plan) {
  return {
    fps: plan.fps,
    frameCount: plan.frameCount,
    duration: plan.duration,
    holds: plan.holds.map((hold) => ({
      section: hold.section,
      outputStart: hold.outputStart,
      outputEnd: hold.outputEnd,
      songTime: hold.songTime,
      pictureTime: hold.pictureFrame / plan.fps,
    })),
  };
}

/** Symlinks the song's frames into the described cut's order (holds repeat one frame). */
function linkDescribedFrames(plan, sourceDir, outDir, frameFileName) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  let next = 0;
  const link = (frame) => fs.symlinkSync(path.join(sourceDir, frameFileName(frame)), path.join(outDir, frameFileName(next++)));
  for (const hold of plan.holds) {
    for (let i = 0; i < hold.frames; i++) link(hold.pictureFrame);
    for (let frame = hold.songFrame; frame < hold.songFrame + hold.segmentFrames; frame++) link(frame);
  }
}

/** The described soundtrack: each narration over silence, then the song until the next hold. */
function mixDescribedAudio(plan, song, voices) {
  const { sampleRate } = song;
  const perFrame = sampleRate / plan.fps;
  if (!Number.isInteger(perFrame)) throw new Error(`${sampleRate} Hz does not split into ${plan.fps} fps frames.`);
  const songChannels = song.channels.length === 1 ? [song.channels[0], song.channels[0]] : song.channels.slice(0, 2);
  const out = [new Float32Array(plan.frameCount * perFrame), new Float32Array(plan.frameCount * perFrame)];
  const fade = Math.round(FADE * sampleRate);
  plan.holds.forEach((hold, index) => {
    const speechAt = Math.round(hold.speechStart * sampleRate);
    for (const channel of out) channel.set(voices[index], speechAt);
    const from = hold.songFrame * perFrame;
    const length = hold.segmentFrames * perFrame;
    const to = (hold.outputFrame + hold.frames) * perFrame;
    songChannels.forEach((source, c) => {
      const segment = source.slice(from, from + length);
      for (let i = 0; i < fade && i < segment.length; i++) {
        segment[i] *= i / fade;
        segment[segment.length - 1 - i] *= i / fade;
      }
      out[c].set(segment, to);
    });
  });
  return { sampleRate, channels: out };
}

module.exports = { spokenForm, speakNarrations, planDescribedCut, describedTimeline, linkDescribedFrames, mixDescribedAudio };
