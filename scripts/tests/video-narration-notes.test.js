const { loadStory, loadRegistry } = require('../narration/source');
// The printable notes of every video narration (docs/video-narration.md,
// "Printable notes"): each cue's key points are notes, not narration, and
// every narration has its notes page.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const root = path.resolve(__dirname, '../..');
const read = file => readFileSync(path.join(root, file.replace(/^\//, '')), 'utf8');
const lessons = loadRegistry('video');
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

for (const [topic, lesson] of Object.entries(lessons)) {
  const story = loadStory(topic);
  const notes = yaml.load(read(`_data/explainers/${topic}_notes.yml`));
  const cues = story.scenes.flatMap(scene => scene.cues.map((cue, index) => ({ id: `${scene.id}-${index + 1}`, cue })));

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

  test(`${topic}: the notes page sits beside the reading and print views`, () => {
    const frontMatter = yaml.load(read(`${lesson.views}/notes.html`).split('---')[1]);
    assert.equal(frontMatter.layout, 'video-narration-notes');
    assert.equal(frontMatter.topic, topic);
    assert.equal(frontMatter.permalink, `${lesson.views}/notes/`);
  });
}
