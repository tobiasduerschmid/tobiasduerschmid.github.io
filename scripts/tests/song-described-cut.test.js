// The audio-described cut of a song video (scripts/song-video/described-cut.js):
// before each section the picture holds while the narrator describes it, and
// the song must resume exactly where it paused, in sync with its frames.
const test = require('node:test');
const assert = require('node:assert/strict');
const { spokenForm, planDescribedCut, mixDescribedAudio } = require('../song-video/described-cut');
const { describedCaptions } = require('../song-video/captions');

const FPS = 10;
const RATE = 100; // samples per second: 10 samples per frame keeps the arithmetic readable

const storyboard = {
  fps: FPS,
  duration: 10,
  sections: [
    { id: 'intro', delivery: 'spoken', narration: 'First part. Second part.', lines: [{ start: 1, end: 2, text: 'Hello.' }] },
    { id: 'verse', delivery: 'sung', narration: 'Verse shows app.py.', lines: [{ start: 5.08, end: 6, text: 'Sung.' }] },
  ],
};
const voices = [new Float32Array(150).fill(0.5), new Float32Array(100).fill(0.25)]; // 1.5 s and 1 s of speech

test('Git notation is spelled out for the narrator', () => {
  assert.equal(spokenForm('git add app.py'), 'git add app dot p y');
  assert.equal(spokenForm('git commit --amend'), 'git commit dash dash amend');
  assert.equal(spokenForm('git switch -c ui'), 'git switch dash c ui');
  assert.equal(spokenForm('moves origin/main'), 'moves origin slash main');
  assert.equal(spokenForm('homework_final_2.txt'), 'homework final 2 dot t x t');
});

test('each section gets a hold long enough for its narration, then the song resumes where it paused', () => {
  const plan = planDescribedCut(storyboard, voices, RATE);
  const [intro, verse] = plan.holds;

  assert.equal(intro.songFrame, 0);
  assert.equal(verse.songFrame, 50); // 0.08 s before the section's first word
  assert.equal(intro.frames, 23); // 0.3 s lead + 1.5 s speech + 0.5 s tail, rounded up to frames
  assert.equal(verse.frames, 18);
  assert.equal(intro.segmentFrames + verse.segmentFrames, 100); // every song frame plays exactly once
  assert.equal(plan.frameCount, 23 + 50 + 18 + 50);
  assert.equal(verse.outputStart, (23 + 50) / FPS);
});

test('the mix puts each narration in its hold and the song right after it, sample-accurate', () => {
  const plan = planDescribedCut(storyboard, voices, RATE);
  const song = { sampleRate: RATE, channels: [Float32Array.from({ length: 1000 }, (_, i) => i / 1000)] };

  const { channels: [left, right] } = mixDescribedAudio(plan, song, voices);

  assert.equal(left.length, plan.frameCount * 10);
  assert.equal(left[Math.round(0.3 * RATE)], 0.5); // the intro narration starts after the 0.3 s lead
  assert.equal(left[5], 0); // silence before the narrator
  const verseResumes = (plan.holds[1].outputFrame + plan.holds[1].frames) * 10;
  assert.ok(Math.abs(left[verseResumes + 20] - 520 / 1000) < 1e-6); // song sample 500 + 20, past the fade-in
  assert.deepEqual(right, left); // a mono song plays on both channels
});

test('described captions narrate each hold and move the lyrics past the holds before them', () => {
  const plan = planDescribedCut(storyboard, voices, RATE);
  const vtt = describedCaptions(storyboard, plan);

  assert.match(vtt, /00:00:00\.300 --> [\d:.]+\n\(narrator\) First part\./);
  assert.match(vtt, /\(narrator\) Verse shows app\.py\./);
  // "Hello." sang at 1 s; the intro hold (2.3 s) comes first.
  assert.match(vtt, /00:00:03\.300 --> [\d:.]+\nHello\./);
  // "Sung." sang at 5.08 s, which resumes after the verse hold: 7.3 + 1.8 + 0.08.
  assert.match(vtt, /00:00:09\.180 --> [\d:.]+\n♪ Sung\. ♪/);
});
