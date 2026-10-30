const { loadStory, loadRegistry } = require('../narration/source');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readFileSync, statSync } = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { wordMarks } = require('../../js/video-narration-marks.js');

const root = path.resolve(__dirname, '../..');
const read = file => readFileSync(path.join(root, file.replace(/^\//, '')), 'utf8');
const story = loadStory('scrum');
const quizzes = yaml.load(read('_data/explainers/scrum_quizzes.yml'));
const timing = JSON.parse(read('_data/explainers/scrum_timing.json'));
const lesson = loadRegistry('video').scrum;
const cues = story.scenes.flatMap(scene => scene.cues);
const frontMatter = file => yaml.load(read(file).split('---')[1]);

test('every cue shows one or two panels that its scene provides', () => {
  const provided = scene => ({
    slide: Boolean(scene.slide), diagram: Boolean(scene.diagram), animation: scene.animation === true, code: Boolean(scene.code),
  });
  for (const scene of story.scenes) {
    if (scene.part) assert.ok(lesson.parts.includes(scene.part), `${scene.id}: ${scene.part} is a part of the lesson`);
    scene.cues.forEach((cue, index) => {
      const shown = cue.show || scene.show;
      assert.ok(Array.isArray(shown) && shown.length >= 1 && shown.length <= 2, `${scene.id} ${index + 1}: show one or two panels`);
      for (const panel of shown) {
        const available = panel === 'slide' ? Boolean(cue.slide || scene.slide) : provided(scene)[panel];
        assert.ok(available, `${scene.id} ${index + 1}: the scene provides ${panel}`);
      }
      assert.ok(cue.visual.trim() && cue.step.trim() && cue.note.trim(), `${scene.id} ${index + 1}: visual, step, and note`);
    });
  }
});

test('every cue is a scene on the animated stage, in one style, and describes its picture', () => {
  assert.equal(story.slides, undefined, 'the Scrum video draws its structured text on the stage');
  assert.equal(story.diagrams, undefined, 'the Scrum video draws its diagrams on the stage');
  for (const scene of story.scenes) {
    assert.equal(scene.animation, true, `${scene.id} is animated`);
    assert.deepEqual(scene.show, ['animation'], `${scene.id} shows only the animation`);
    for (const [index, cue] of scene.cues.entries()) {
      assert.equal(cue.show, undefined, `${scene.id}-${index + 1} keeps the scene's screen`);
      assert.ok(cue.visual.length >= 60, `${scene.id}-${index + 1} describes its picture in words`);
    }
  }
});

test('the narration teaches concepts in plain words, without dates or attribution', () => {
  for (const cue of cues) {
    const words = cue.text.split(/\s+/).length;
    assert.ok(words >= 20 && words <= 60, `${words} words: ${cue.text.slice(0, 40)}`);
    assert.doesNotMatch(cue.text, /\b(1[89]|20)\d\d\b|Scrum Guide|Schwaber|Sutherland|lecture/i);
  }
  const predictions = cues.filter(cue => cue.prediction);
  assert.ok(predictions.length >= 2, 'the learner predicts before at least two reveals');
  for (const cue of predictions) assert.ok(cue.pause_after >= 3, 'a prediction leaves time to think');
});

test('every section after the intro ends in a valid check, and the last is a summary quiz on a new team', () => {
  assert.deepEqual(Object.keys(quizzes), story.scenes.slice(1).map(scene => scene.id));
  const summary = quizzes[story.scenes.at(-1).id];
  assert.ok(summary.questions.length >= 6, 'the summary quiz covers theory, roles, artifacts, and events');
  for (const question of summary.questions) assert.match(question.question, /study-room|study rooms/, 'a new team, not the example');
  for (const [id, check] of Object.entries(quizzes)) {
    for (const question of check.questions || [check]) {
      const key = question.options[question.correct_index];
      assert.ok(question.options.length >= 3 && key && question.explanation.trim(), id);
      const others = question.options.filter((_, index) => index !== question.correct_index).map(option => option.length).sort((a, b) => a - b);
      assert.ok(key.length <= 1.8 * others[Math.floor(others.length / 2)] + 1, `${id}: the key is not conspicuously long`);
      for (const [index, feedback] of Object.entries(question.option_feedback || {})) {
        assert.notEqual(Number(index), question.correct_index, `${id}: feedback on the key never fires`);
        assert.doesNotMatch(feedback, /misconception|option [A-D]\b|first option|last option/i);
      }
      assert.doesNotMatch(question.explanation, /option [A-D]\b|first option|last option/i);
    }
  }
});

test('speech, captions, and timing are generated from the published storyboard', () => {
  assert.equal(timing.speech_sha256, story.speech_sha256,
    'Regenerate audio, captions, and timing after editing the storyboard.');
  assert.equal(timing.scenes.length, story.scenes.length);
  let end = 0;
  timing.scenes.forEach((scene, index) => {
    assert.equal(scene.id, story.scenes[index].id);
    assert.equal(scene.cues.length, story.scenes[index].cues.length);
    scene.cues.forEach(cue => {
      assert.equal(cue.start, end);
      assert.ok(cue.start < cue.speech_end && cue.speech_end < cue.end, 'speech ends inside its cue, before the pause');
      end = cue.end;
    });
  });
  assert.equal(timing.duration, end);
  const captions = read(story.captions);
  assert.equal((captions.match(/ --> /g) || []).length, cues.length);
  cues.forEach(cue => assert.ok(captions.includes(cue.text)));
  const spoken = cues.map(cue => Object.entries(story.pronunciations)
    .sort(([left], [right]) => right.length - left.length)
    .reduce((text, [written, pronunciation]) => text.split(written).join(pronunciation), cue.text));
  assert.equal(read(story.script), `${spoken.join('\n\n')}\n`);
  const size = statSync(path.join(root, story.audio)).size;
  assert.ok(size > 0 && size * 8 / timing.duration < 64000);
});

test('every quiz leaves at least two seconds to inspect the final picture after speech', () => {
  // js/narrated-explainer.js stops 0.3 s before a section boundary.
  timing.scenes.filter(scene => quizzes[scene.id]).forEach(scene => {
    const last = scene.cues.at(-1);
    const viewingTime = scene.end - 0.3 - last.speech_end;
    assert.ok(viewingTime >= 2, `${scene.id}: only ${viewingTime.toFixed(2)} s to inspect the picture before the quiz`);
  });
});

test('word marks are keyed like song marks and follow the speech in order', () => {
  const marks = wordMarks("It's the dining-hall line. The line, again!", 10, 14);
  assert.deepEqual(Object.keys(marks), ['its', 'the', 'dining', 'hall', 'line', 'the2', 'line2', 'again']);
  const times = Object.values(marks);
  assert.equal(times[0], 10);
  times.slice(1).forEach((time, index) => assert.ok(time > times[index] && time < 14));
});

test('the chapter, its views, and the animation frame are wired to the registry', () => {
  const chapter = read(`${lesson.chapter.replace('.html', '.md')}`);
  assert.match(chapter, /\{% include narration\.html topic="scrum" %\}/);
  const entry = read('_includes/narration.html');
  assert.ok(entry.indexOf('narration_entry.styles') < entry.indexOf('print-light.css'), 'print styles load last');
  for (const view of ['read', 'print']) {
    const page = frontMatter(`${lesson.views}/${view}.html`);
    assert.equal(page.layout, 'narrated-pattern-reader');
    assert.equal(page.video_narration, true);
    assert.equal(page.topic, 'scrum');
  }
  const stage = frontMatter(lesson.animation.page);
  assert.equal(stage.layout, 'video-narration-stage');
  assert.equal(stage.topic, 'scrum');
  for (const file of [...lesson.animation.styles, ...lesson.animation.scripts]) assert.ok(existsSync(path.join(root, file)), file);
  assert.ok(lesson.animation.scripts.at(-1).endsWith('/scrum.js'), 'the choreography loads after its kits');
});

test('the printable notes name every part of Scrum the narration teaches', () => {
  const notes = yaml.load(read('_data/explainers/scrum_notes.yml'));
  const text = Object.values(notes).flat().join(' ').replace(/\*\*/g, '').toLowerCase();
  const taught = [
    'empiricism', 'transparency', 'inspection', 'adaptation', 'cross-functional', 'self-managing',
    'developers', 'product owner', 'scrum master', 'impediment', 'timebox',
    'product backlog', 'user stories', 'acceptance criteria', 'refinement', 'emergent', 'product goal',
    'sprint backlog', 'sprint goal', 'increment', 'definition of done',
    'sprint planning', 'daily scrum', '15 minutes', 'never more than a month', 'sprint review', 'sprint retrospective',
  ];
  assert.deepEqual(taught.filter(term => !text.includes(term)), []);
});
