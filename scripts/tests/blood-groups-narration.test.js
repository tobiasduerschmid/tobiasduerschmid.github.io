const { loadStory, loadRegistry } = require('../narration/source');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readFileSync, statSync } = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const root = path.resolve(__dirname, '../..');
const read = file => readFileSync(path.join(root, file.replace(/^\//, '')), 'utf8');
const story = loadStory('blood_groups');
const quizzes = yaml.load(read('_data/explainers/blood_groups_quizzes.yml'));
const timing = JSON.parse(read('_data/explainers/blood_groups_timing.json'));
const lesson = loadRegistry('video').blood_groups;
const cues = story.scenes.flatMap(scene => scene.cues);
const frontMatter = file => yaml.load(read(file).split('---')[1]);

test('every cue is a scene on the animated stage and describes its picture in words', () => {
  assert.equal(story.slides, undefined, 'structured text is drawn on the stage');
  assert.equal(story.diagrams, undefined, 'diagrams are drawn on the stage');
  for (const scene of story.scenes) {
    if (scene.part) assert.ok(lesson.parts.includes(scene.part), `${scene.id}: ${scene.part} is a part of the lesson`);
    assert.equal(scene.animation, true, `${scene.id} is animated`);
    assert.deepEqual(scene.show, ['animation'], `${scene.id} shows only the animation`);
    for (const cue of scene.cues) {
      assert.equal(cue.show, undefined, `${scene.id}/${cue.id} keeps the scene's screen`);
      assert.ok(cue.visual.length >= 60, `${scene.id}/${cue.id} describes its picture in words`);
      assert.ok(cue.step.trim() && cue.note.trim(), `${scene.id}/${cue.id}: step and note`);
    }
  }
});

test('the narration teaches in cues of 30 to 55 words, without dates or attribution', () => {
  for (const cue of cues) {
    const words = cue.text.split(/\s+/).length;
    assert.ok(words >= 30 && words <= 55, `${words} words: ${cue.text.slice(0, 40)}`);
    assert.doesNotMatch(cue.text, /\b(1[89]|20)\d\d\b|Siedersleben|Denert|Quasar|sd&m|the (book|paper|slides|lecture) (says|calls|shows)/i);
  }
});

test('three predictions each leave time to think before the next cue answers them', () => {
  story.scenes.forEach(scene => scene.cues.forEach((cue, index) => {
    if (!cue.prediction) return;
    assert.ok(cue.pause_after >= 4, `${scene.id}/${cue.id}: a prediction pauses at least 4 seconds`);
    assert.ok(scene.cues[index + 1], `${scene.id}/${cue.id}: the next cue in its scene answers it`);
    assert.match(cue.text, /predict/i, `${scene.id}/${cue.id} asks the learner to predict`);
  }));
  assert.equal(cues.filter(cue => cue.prediction).length, 3);
});

test('every section, from the intro on, ends in a valid check, and the last is a summary quiz on a new system', () => {
  assert.deepEqual(Object.keys(quizzes), story.scenes.map(scene => scene.id));
  const summary = quizzes[story.scenes.at(-1).id];
  assert.ok(summary.questions.length >= 4, 'the summary covers groups, mixing, design, and change');
  for (const question of summary.questions) assert.match(question.question, /laundry|washer/, 'a new system, not the example');
  const keyPositions = new Set();
  for (const [id, check] of Object.entries(quizzes)) {
    for (const question of check.questions || [check]) {
      const key = question.options[question.correct_index];
      keyPositions.add(question.correct_index);
      assert.ok(question.options.length >= 3 && key && question.explanation.trim(), id);
      const others = question.options.filter((_, index) => index !== question.correct_index).map(option => option.length).sort((a, b) => a - b);
      assert.ok(key.length <= 1.8 * others[Math.floor(others.length / 2)] + 1, `${id}: the key is not conspicuously long`);
      assert.ok(key.length <= Math.max(...others) + 15, `${id}: the key is not the longest by far`);
      for (const [index, feedback] of Object.entries(question.option_feedback || {})) {
        assert.notEqual(Number(index), question.correct_index, `${id}: feedback on the key never fires`);
        assert.doesNotMatch(feedback, /misconception|option [A-D]\b|first option|last option/i);
      }
      assert.doesNotMatch(question.explanation, /option [A-D]\b|first option|last option/i);
    }
  }
  assert.deepEqual([...keyPositions].sort(), [0, 1, 2], 'the key appears in every position');
});

test('the last cue before every check holds its picture for a viewing pause', () => {
  for (const scene of story.scenes.filter(each => quizzes[each.id])) {
    assert.ok(scene.cues.at(-1).pause_after >= 2.5, `${scene.id} pauses before its check`);
  }
  // js/narration-transport.js stops 0.3 s before a section boundary.
  timing.scenes.filter(scene => quizzes[scene.id]).forEach(scene => {
    const viewingTime = scene.end - 0.3 - scene.cues.at(-1).speech_end;
    assert.ok(viewingTime >= 2, `${scene.id}: only ${viewingTime.toFixed(2)} s to inspect the picture before the check`);
  });
});

test('speech, captions, and timing are generated from the published script', () => {
  assert.equal(timing.provisional, undefined, 'render the speech; estimated timing is for development only');
  assert.equal(timing.speech_sha256, story.speech_sha256, 'Regenerate audio, captions, and timing after editing the script.');
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
  cues.forEach(cue => assert.ok(captions.includes(cue.text), cue.text.slice(0, 40)));
  const size = statSync(path.join(root, story.audio)).size;
  assert.ok(size > 0 && size * 8 / timing.duration < 64000);
});

test('the chapter, its views, and the blueprint animation frame are wired to the registry', () => {
  const chapter = read(`${lesson.chapter.replace('.html', '.md')}`);
  assert.match(chapter, /\{% include narration\.html topic="blood_groups" %\}/);
  for (const view of ['read', 'print']) {
    const page = frontMatter(`${lesson.views}/${view}.html`);
    assert.equal(page.layout, 'narrated-pattern-reader');
    assert.equal(page.video_narration, true);
    assert.equal(page.topic, 'blood_groups');
  }
  const stage = frontMatter(lesson.animation.page);
  assert.equal(stage.layout, 'video-narration-stage');
  assert.equal(stage.topic, 'blood_groups');
  assert.equal(lesson.animation.theme, 'drafting-room', 'the lesson is drawn on an architectural blueprint');
  assert.ok(lesson.animation.sheet_title, 'the blueprint title block names the lesson');
  for (const file of [...lesson.animation.styles, ...lesson.animation.scripts]) assert.ok(existsSync(path.join(root, file)), file);
  const scripts = lesson.animation.scripts.map(file => path.basename(file));
  assert.ok(scripts.indexOf('wall-kit.js') < scripts.indexOf('blood-groups-kit.js'), 'the topic kit builds on the wall kit');
  assert.equal(scripts.at(-1), 'blood-groups.js', 'the choreography loads after its kits');
});

test('the printable notes keep every term and rule the narration teaches', () => {
  const notes = yaml.load(read('_data/explainers/blood_groups_notes.yml'));
  assert.deepEqual(Object.keys(notes).sort(), story.scenes.flatMap(scene => scene.cues.map(cue => `${scene.id}-${cue.id}`)).sort());
  const text = Object.values(notes).flat().join(' ').replace(/\*\*/g, '').toLowerCase();
  const taught = [
    'application domain', 'technology', 'group a', 'group t', 'group 0', 'group at', 'universal donor',
    'every letter', 'a + t = at', 'at + anything = at', 'leak', 'design rule 1', 'design rule 2', 'invert',
    'adapter', 'translate, never decide', 'representation', 'married to the framework', 'replay likely changes',
    'aim for the top of the curve',
  ];
  assert.deepEqual(taught.filter(term => !text.includes(term)), []);
});
