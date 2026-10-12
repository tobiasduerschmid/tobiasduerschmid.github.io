const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { checkpoints } = require('../../js/song-video/quiz-pause');

test('quiz stops are after the question starts and before every authored answer', () => {
  for (const id of ['snapshots_and_pointers', 'unbox_the_stack']) {
    const song = yaml.load(fs.readFileSync(path.resolve(__dirname, '../../_data/songs', `${id}.yml`), 'utf8'));
    const lines = song.sections.flatMap((section) => section.lines);
    const stops = checkpoints(lines);
    assert.equal(stops.length, 6);
    for (const stop of stops) {
      const line = lines.find((item) => item.id === stop.id);
      assert.ok(stop.time > line.start && stop.time < line.answer_at);
      assert.equal(stop.question, line.text);
    }
  }
});

test('songs without questions have no stops; an explicit question-end cue overrides the margin', () => {
  assert.deepEqual(checkpoints([{ start: 0, text: 'Music' }]), []);
  assert.equal(checkpoints([{ id: 'q', start: 10, answer_at: 15, pause_at: 14, text: 'Question?' }])[0].time, 14);
});
