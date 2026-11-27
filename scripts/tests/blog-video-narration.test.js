const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, statSync } = require('node:fs');
const { resolve } = require('node:path');
const { ROOT, loadLesson } = require('../narration/source');
const { wordMarks } = require('../../js/video-narration-marks');
const { schedule } = require('../../js/video-narration/blog-essay-timing');

const read = path => readFileSync(resolve(ROOT, path.replace(/^\//, '')), 'utf8');
const seconds = stamp => Number(stamp.slice(0, 2)) * 3600 + Number(stamp.slice(3, 5)) * 60 + Number(stamp.slice(6));

for (const [topic, slug] of [
  ['blog_ai_usage', 'how-should-i-use-ai-as-a-college-student'],
  ['blog_study_tips', 'evidence-based-study-tips-for-college-students'],
]) {
  test(`${slug}: every cue has a picture and visual reveals follow spoken words`, () => {
    const { story } = loadLesson(topic);
    for (const scene of story.scenes) {
      let nextCue = 1;
      for (const beat of scene.essay_beats) {
        assert.equal(beat.from, nextCue, `${scene.id}: gap or overlap at ${beat.title}`);
        assert.ok(beat.to >= beat.from && beat.to <= scene.cues.length);
        const marks = [...beat.items, ...beat.items.map(item => item.detail_at), beat.signal].filter(Boolean);
        for (const mark of marks) {
          const cue = mark.cue ?? beat.from;
          assert.ok(cue >= beat.from && cue <= beat.to, `${beat.title}: cue ${cue} outside its picture`);
          if (mark.word) {
            assert.ok(Object.hasOwn(wordMarks(scene.cues[cue - 1].text, 0, 1), mark.word),
              `${beat.title}: "${mark.word}" is missing from cue ${cue}`);
          }
        }
        nextCue = beat.to + 1;
      }
      assert.equal(nextCue, scene.cues.length + 1, `${scene.id}: final cues have no picture`);
    }
  });

  test(`${slug}: animated article and read-aloud share speech and section boundaries`, () => {
    const { story } = loadLesson(topic);
    const timing = JSON.parse(read(`_data/explainers/${topic}_timing.json`));
    const readAloud = JSON.parse(read(`_data/blog_audio/${slug}.json`));
    for (const medium of ['audio', 'captions', 'script']) assert.equal(story[medium], readAloud[medium]);
    assert.ok(statSync(resolve(ROOT, story.audio.slice(1))).size > 0);
    assert.equal(timing.speech_sha256, story.speech_sha256);
    assert.deepEqual(timing.scenes.map((scene, i) => ({ title: story.scenes[i].title, start: scene.start })), readAloud.chapters);

    const [header, ...captions] = read(story.captions).trim().split('\n\n');
    assert.equal(header, 'WEBVTT');
    const transcript = [];
    const expectedCaptions = [];
    for (const [sceneIndex, scene] of story.scenes.entries()) {
      assert.equal(timing.scenes[sceneIndex].id, scene.id);
      for (const [cueIndex, cue] of scene.cues.entries()) {
        const { id, start, speech_end } = timing.scenes[sceneIndex].cues[cueIndex];
        assert.equal(id, cue.id);
        assert.ok(cue.visual.trim(), `${scene.id}/${cue.id} describes its picture`);
        assert.doesNotMatch(cue.text, /\{%\s*cite|https?:\/\/|\[\d+\]/);
        expectedCaptions.push({ id: `${scene.id}-${cueIndex + 1}`, start, end: speech_end, text: cue.text });
        transcript.push(cue.text);
      }
    }
    const actualCaptions = captions.map(block => {
      const [id, time, ...lines] = block.split('\n');
      const [start, end] = time.split(' --> ').map(seconds);
      const round = value => Math.round(value * 1000) / 1000;
      return { id, start: round(start), end: round(end), text: lines.join('\n') };
    });
    assert.deepEqual(actualCaptions, expectedCaptions);
    assert.equal(read(story.script), `${transcript.join('\n\n')}\n`);
  });

  test(`${slug}: every label, detail and takeaway can be read at double speed`, () => {
    const { story } = loadLesson(topic);
    const timing = JSON.parse(read(`_data/explainers/${topic}_timing.json`));
    for (const [index, scene] of story.scenes.entries()) {
      const cues = timing.scenes[index].cues.map((cue, i) => ({
        ...cue, marks: wordMarks(scene.cues[i].text, cue.start, cue.speech_end),
      }));
      const line = number => cues[number - 1];
      for (const beat of scene.essay_beats) {
        const reveal = schedule(beat, line);
        const end = line(beat.to).end;
        const visible = beat.items.flatMap(item => item.detail_at
          ? [[item, item.label], [item.detail_at, item.detail]]
          : [[item, [item.label, item.detail].filter(Boolean).join(' ')]]);
        if (beat.signal) visible.push([beat.signal, beat.signal.text]);
        for (const [anchor, text] of visible) {
          const words = text.trim().split(/\s+/).length;
          const seconds = (end - reveal(anchor) - 0.46) / 2; // Fully settled at 2×.
          assert.ok(reveal(anchor) >= line(beat.from).start);
          assert.ok(seconds >= Math.max(3, 1 + words / 3) - 0.001, `${beat.title} / ${text}: ${seconds.toFixed(2)}s`);
        }
      }
    }
  });
}

test('a diagram gives readers time with the unfinished example before revealing the repair', () => {
  const initial = { label: 'Missing brace', word: 'mistake' };
  const repair = { label: 'Braces match', word: 'repair' };
  const beat = { from: 1, to: 1, items: [initial, repair] };
  const line = () => ({ start: 10, end: 40, marks: { mistake: 38.5, repair: 39 } });
  const reveal = schedule(beat, line, ['Read each line and locate the missing brace', 'Braces match'],
    [{ from: 0, to: 1, wholeItem: true }]);
  assert.ok((reveal(repair) - reveal(initial) - 0.7) / 2 >= 1 + 8 / 3);
  assert.ok((40 - reveal(repair) - 0.7) / 2 >= 3);
});

test('a short answer gets reading time when it replaces a symbol beside a persistent question', () => {
  const question = { label: 'Predict the visits' };
  const answer = { label: 'Six visits', word: 'check' };
  const beat = { from: 1, to: 1, items: [question, answer] };
  const line = () => ({ start: 0, end: 16, marks: { check: 15 } });
  const reveal = schedule(beat, line, ['Suppose you double the number of items in the list. How many visits?', 'Six visits'],
    [{ from: 0, to: 1, text: '?' }]);
  assert.ok((reveal(answer) - reveal(question) - 0.46) / 2 >= 3);
  assert.ok((16 - reveal(answer) - 0.46) / 2 >= 3);
});
