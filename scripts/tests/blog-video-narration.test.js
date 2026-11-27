const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, statSync } = require('node:fs');
const { resolve } = require('node:path');
const { ROOT, loadLesson } = require('../narration/source');
const { wordMarks } = require('../../js/video-narration-marks');

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
}
