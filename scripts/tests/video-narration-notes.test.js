// The printable notes of every video narration (docs/video-narration.md,
// "Printable notes"): each cue's key points are notes, not narration, and the
// committed stills and PDF were rendered from the current sources.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readdirSync, readFileSync } = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { notesFingerprint, notesPaths, pdfPageCount, stillName } = require('../render-video-narration-notes.js');

const root = path.resolve(__dirname, '../..');
const read = file => readFileSync(path.join(root, file.replace(/^\//, '')));
const topics = Object.keys(yaml.load(read('_data/video_narrations.yml').toString()));
// Words as a reader counts them: case, emphasis, and apostrophes aside.
const words = text => text.toLowerCase().replace(/\*\*/g, '').replace(/['’]/g, '').split(/[^a-z0-9%]+/).filter(Boolean);
// The longest run of consecutive words that `point` repeats from `speech`.
function longestCopiedRun(point, speech) {
  let longest = 0;
  point.forEach((_, start) => speech.forEach((__, from) => {
    let length = 0;
    while (start + length < point.length && point[start + length] === speech[from + length]) length += 1;
    longest = Math.max(longest, length);
  }));
  return longest;
}
const POINTS_PER_CUE = { min: 1, max: 4 };
const WORDS_PER_POINT = 16;
// Eight words in a row is a copied sentence, not a note.
const COPIED_RUN = 8;
// Notes keep every idea in at most half the narration's words.
const NOTES_SHARE = 0.5;
const ROWS_PER_PAGE = 3;

for (const topic of topics) {
  const story = yaml.load(read(`_data/explainers/${topic}.yml`).toString());
  const notes = yaml.load(read(`_data/explainers/${topic}_notes.yml`).toString());
  const cues = story.scenes.flatMap(scene => scene.cues.map((cue, index) => ({ id: `${scene.id}-${index + 1}`, scene, cue })));

  test(`${topic}: every cue has a few short key points, and nothing else does`, () => {
    assert.deepEqual(Object.keys(notes).sort(), cues.map(({ id }) => id).sort());
    for (const { id } of cues) {
      const points = notes[id];
      assert.ok(points.length >= POINTS_PER_CUE.min && points.length <= POINTS_PER_CUE.max, `${id}: ${points.length} points`);
      for (const point of points) assert.ok(words(point).length <= WORDS_PER_POINT, `${id}: "${point}" is longer than ${WORDS_PER_POINT} words`);
    }
  });

  test(`${topic}: the key points are notes, not the narration's sentences`, () => {
    let noteWords = 0;
    let speechWords = 0;
    for (const { id, cue } of cues) {
      const speech = words(cue.text);
      speechWords += speech.length;
      for (const point of notes[id]) {
        noteWords += words(point).length;
        assert.ok(longestCopiedRun(words(point), speech) < COPIED_RUN, `${id}: "${point}" repeats the narration word for word`);
      }
    }
    assert.ok(noteWords <= NOTES_SHARE * speechWords, `${noteWords} words of notes for ${speechWords} of narration`);
  });

  test(`${topic}: the committed stills and PDF were rendered from the current sources`, () => {
    const paths = notesPaths(topic);
    const rerender = `run: node scripts/render-video-narration-notes.js --topic ${topic}`;
    const record = JSON.parse(read(paths.record));
    assert.equal(record.source_sha256, notesFingerprint(topic), `the notes are out of date; ${rerender}`);
    assert.equal(record.stills.directory, paths.stills);

    const stills = readdirSync(path.join(root, paths.stills.slice(1))).sort();
    assert.deepEqual(stills, cues.map(({ scene, cue }) => stillName(scene.id, scene.cues.indexOf(cue) + 1)).sort(), rerender);
    for (const still of stills) {
      assert.deepEqual([...read(`${paths.stills}/${still}`).subarray(0, 3)], [0xff, 0xd8, 0xff], `${still} is a JPEG`);
    }

    const pdf = read(paths.pdf);
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.equal(pdf.length, record.pdf.bytes, rerender);
    // The title shares the first page, and three rows fill every page.
    assert.equal(pdfPageCount(pdf), Math.ceil(cues.length / ROWS_PER_PAGE));
    assert.equal(record.pdf.pages, pdfPageCount(pdf));
  });

  test(`${topic}: the notes page sits beside the reading and print views`, () => {
    const file = notesPaths(topic).page;
    const frontMatter = yaml.load(read(file).toString().split('---')[1]);
    assert.equal(frontMatter.layout, 'video-narration-notes');
    assert.equal(frontMatter.topic, topic);
    assert.equal(frontMatter.permalink, `${yaml.load(read('_data/video_narrations.yml').toString())[topic].views}/notes/`);
  });
}
