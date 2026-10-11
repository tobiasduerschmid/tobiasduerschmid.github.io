const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { planDescribedCut, describedTimeline } = require('../song-video/described-cut');
const { lyricCues } = require('../song-video/captions');

const root = path.resolve(__dirname, '../..');
const readSiteFile = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const seconds = (timestamp) => timestamp.split(':').reduce((total, part) => total * 60 + Number(part), 0);

function captionCues(vtt) {
  return vtt.trim().split(/\n\n+/).flatMap((block) => {
    const match = block.match(/^\d+\n([\d:.]+) --> ([\d:.]+)\n([\s\S]+)$/);
    return match ? [{ start: seconds(match[1]), end: seconds(match[2]), text: match[3] }] : [];
  });
}

test('the live manifest holds a settled picture and resumes at the audio cut without dropping song time', () => {
  const storyboard = {
    fps: 10, duration: 10,
    sections: [
      { id: 'intro', narration: 'Intro.', lines: [{ start: 1 }] },
      { id: 'verse', narration: 'Verse.', lines: [{ start: 5.08 }] },
    ],
  };
  const voices = [new Float32Array(150), new Float32Array(100)];
  const timeline = describedTimeline(planDescribedCut(storyboard, voices, 100));

  assert.equal(timeline.duration, 14.1);
  assert.equal(timeline.frameCount, 141);
  assert.equal(timeline.fps, 10);
  assert.deepEqual(timeline.holds.map(({ section, outputStart, outputEnd, songTime, pictureTime }) =>
    [section, outputStart, outputEnd, songTime, pictureTime]), [
    ['intro', 0, 2.3, 0, 1.6],
    ['verse', 7.3, 9.1, 5, 5.7],
  ]);
});

test('the published described soundtrack timeline agrees with every encoded lyric cue', () => {
  const storyboard = yaml.load(readSiteFile('_data/songs/snapshots_and_pointers.yml'));
  const timeline = JSON.parse(readSiteFile(storyboard.described_timeline));
  const captions = captionCues(readSiteFile(storyboard.described_captions));
  const lyrics = lyricCues(storyboard);
  const describedLyrics = captions.filter((cue) => cue.text !== '[music]' && !cue.text.startsWith('(narrator)'));
  assert.equal(describedLyrics.length, lyrics.length);
  assert.equal(timeline.holds.length, storyboard.sections.length);

  for (const [index, cue] of lyrics.entries()) {
    const holdIndex = timeline.holds.findLastIndex((hold) => hold.songTime <= cue.start);
    const hold = timeline.holds[holdIndex];
    const shift = hold.outputEnd - hold.songTime;
    const end = Math.min(cue.end + shift, timeline.holds[holdIndex + 1]?.outputStart ?? timeline.duration);
    assert.equal(describedLyrics[index].text, cue.text);
    assert.ok(Math.abs(describedLyrics[index].start - (cue.start + shift)) <= 0.000501, `lyric ${index + 1} starts with its audio`);
    assert.ok(Math.abs(describedLyrics[index].end - end) <= 0.000501, `lyric ${index + 1} ends before the next narration`);
  }

  let heldFrames = 0;
  for (const [index, hold] of timeline.holds.entries()) {
    const section = storyboard.sections[index];
    assert.equal(hold.section, section.id);
    assert.ok(Math.abs(hold.outputStart - hold.songTime - heldFrames / timeline.fps) < 1e-9, `${section.id} preserves all preceding song time`);
    assert.ok(hold.outputEnd > hold.outputStart);
    assert.equal(hold.pictureTime, Math.round((section.lines[0].start + 0.6) * timeline.fps) / timeline.fps);
    heldFrames += Math.round((hold.outputEnd - hold.outputStart) * timeline.fps);
  }
  assert.equal(timeline.frameCount, Math.round(storyboard.duration * timeline.fps) + heldFrames);
  assert.equal(timeline.duration, timeline.frameCount / timeline.fps);

  for (const cue of captions.filter((caption) => caption.text.startsWith('(narrator)'))) {
    assert.ok(timeline.holds.some((hold) => cue.start >= hold.outputStart && cue.end <= hold.outputEnd), 'each narration fits its picture hold');
  }
});
