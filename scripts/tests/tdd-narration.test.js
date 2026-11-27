// The Test-Driven Development video narration's teaching contract:
// motivation, a worked example, the rules, the consequences; every cue a
// picture on the desk stage; a check after every section; rendered speech;
// notes that keep every taught term; and code for the stage in four
// languages and frameworks that fits the stage's cards.
const { loadStory, loadRegistry } = require('../narration/source');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readFileSync, statSync } = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const root = path.resolve(__dirname, '../..');
const read = file => readFileSync(path.join(root, file.replace(/^\//, '')), 'utf8');
const frontMatter = file => yaml.load(read(file).split('---')[1]);

const topic = 'tdd';
const story = loadStory(topic);
const lesson = loadRegistry('video')[topic];
const quizzes = yaml.load(read(`_data/explainers/${topic}_quizzes.yml`));
const code = yaml.load(read(`_data/explainers/${topic}_code.yml`));
const cues = story.scenes.flatMap(scene => scene.cues);
const TAUGHT = [
  'test-driven development', 'test list', 'red', 'green', 'refactor', 'one test at a time', 'starter test',
  'fake it', 'triangulate', 'obvious implementation', 'test first', 'watch it fail', 'smallest step',
  'refactor on green', 'three laws', 'regression safety net', 'executable documentation',
  'small, testable units', 'time up front', 'learning curve', 'tests to maintain', 'short, steady cycles',
  'test runner',
];
// The stage's code cards and the runner steps every language must have.
const CARDS = ['test_one_person', 'fake_it', 'test_even', 'general', 'test_extra_cent', 'fill_patch', 'refactored', 'test_weak', 'tip', 'slip', 'test_typo'];
const STEPS = ['sample_red', 'sample_green', 's1_red', 's1_green', 's2_red', 's2_green', 's3_red', 's3_green', 'typo', 'slip'];

test('motivation comes first, then the worked example, the rules, and the consequences', () => {
  assert.deepEqual(lesson.parts, ['Motivation', 'Example', 'Rules', 'Consequences']);
  const parts = story.scenes.map(scene => scene.part).filter(Boolean);
  assert.deepEqual([...new Set(parts)], lesson.parts, 'parts appear in order, each in one run');
  assert.equal(story.scenes.at(-1).part, undefined, 'the recap closes the lesson outside the parts');
});

test('every cue is a scene on the animated stage and describes its picture in words', () => {
  for (const scene of story.scenes) {
    assert.equal(scene.animation, true, `${scene.id} is animated`);
    assert.deepEqual(scene.show, ['animation'], `${scene.id} shows only the animation`);
    for (const cue of scene.cues) {
      assert.ok(cue.visual.length >= 60, `${scene.id}/${cue.id} describes its picture in words`);
      assert.ok(cue.step.trim() && cue.note.trim(), `${scene.id}/${cue.id}: step and note`);
    }
  }
});

test('the narration teaches in cues of 30 to 55 words, without dates or attribution', () => {
  for (const cue of cues) {
    const words = cue.text.split(/\s+/).length;
    assert.ok(words >= 30 && words <= 55, `${words} words: ${cue.text.slice(0, 40)}`);
    assert.doesNotMatch(cue.text, /\b(1[89]|20)\d\d\b|Beck|Martin|Uncle Bob|Fowler|Freeman|Pryce|Nagappan|Fucci|Beller|IBM|Microsoft|the (book|paper|slides|lecture) (says|calls|shows)/i);
  }
});

test('each prediction leaves time to think before the next cue answers it', () => {
  story.scenes.forEach(scene => scene.cues.forEach((cue, index) => {
    if (!cue.prediction) return;
    assert.ok(cue.pause_after >= 4, `${scene.id}/${cue.id}: a prediction pauses at least 4 seconds`);
    assert.ok(scene.cues[index + 1], `${scene.id}/${cue.id}: the next cue in its scene answers it`);
    assert.match(cue.text, /predict/i, `${scene.id}/${cue.id} asks the learner to predict`);
  }));
  assert.equal(cues.filter(cue => cue.prediction).length, 4);
});

test('every section ends in a valid check, and the last is a summary quiz on a new function', () => {
  assert.deepEqual(Object.keys(quizzes), story.scenes.map(scene => scene.id));
  const summary = quizzes.summary;
  assert.ok(summary.questions.length >= 5);
  // A new function, not the example: the quiz introduces letter_grade and never returns to the bill.
  assert.match(summary.questions[0].question, /letter_grade/);
  for (const question of summary.questions) assert.doesNotMatch(question.question, /split\b|\bbill\b|cents|friday|ramen/i, 'a new function, not the example');
  const keyPositions = new Set();
  for (const [id, check] of Object.entries(quizzes)) {
    for (const question of check.questions || [check]) {
      const key = question.options[question.correct_index];
      keyPositions.add(question.correct_index);
      assert.ok(question.options.length >= 3 && key && question.explanation.trim(), id);
      question.options.forEach((_, index) => {
        if (index !== question.correct_index) assert.ok(question.option_feedback[index], `${id}: feedback for every wrong option`);
      });
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
  const timing = JSON.parse(read(`_data/explainers/${topic}_timing.json`));
  for (const scene of story.scenes.filter(each => quizzes[each.id])) {
    assert.ok(scene.cues.at(-1).pause_after >= 2.5, `${scene.id} pauses before its check`);
  }
  timing.scenes.filter(scene => quizzes[scene.id]).forEach(scene => {
    const viewingTime = scene.end - 0.3 - scene.cues.at(-1).speech_end;
    assert.ok(viewingTime >= 2, `${scene.id}: only ${viewingTime.toFixed(2)} s to inspect the picture before the check`);
  });
});

test('speech, captions, and timing are generated from the published script', () => {
  const timing = JSON.parse(read(`_data/explainers/${topic}_timing.json`));
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

test('the chapter, its views, the test-bench frame, and the paired song are wired to the registry', () => {
  const chapter = read(lesson.chapter.replace('.html', '.md'));
  assert.match(chapter, /\{% include narration\.html topic="tdd" %\}/);
  assert.match(chapter, /\{% include song-video\.html song=site\.data\.songs\.red_green_refactor id="tdd-song" narration="tdd-video" %\}/, 'the final check continues to the song');
  for (const view of ['read', 'print']) {
    const page = frontMatter(`${lesson.views}/${view}.html`);
    assert.equal(page.layout, 'narrated-pattern-reader');
    assert.equal(page.video_narration, true);
    assert.equal(page.topic, topic);
  }
  const stage = frontMatter(lesson.animation.page);
  assert.equal(stage.layout, 'video-narration-stage');
  assert.equal(stage.topic, topic);
  assert.equal(lesson.animation.theme, 'test-bench');
  for (const file of [...lesson.animation.styles, ...lesson.animation.scripts]) assert.ok(existsSync(path.join(root, file)), file);
  const scripts = lesson.animation.scripts.map(file => path.basename(file));
  assert.ok(scripts.indexOf('wall-kit.js') < scripts.indexOf('arch-kit.js'), 'the architecture kit builds on the wall kit');
  assert.ok(scripts.indexOf('arch-kit.js') < scripts.indexOf('tdd-kit.js'), 'the topic kit builds on the architecture kit');
  assert.equal(scripts.at(-1), 'tdd.js', 'the choreography loads after its kits');
});

test('the code comes in four languages and frameworks, and every card fits the stage', () => {
  assert.deepEqual(Object.keys(code), ['python', 'java', 'cpp', 'typescript']);
  assert.deepEqual(story.languages, Object.keys(code), 'the player offers every language the stage draws');
  for (const [language, entry] of Object.entries(code)) {
    assert.ok(entry.label && entry.stage.runner && entry.stage.files.tests && entry.stage.files.code, language);
    assert.deepEqual(Object.keys(entry.stage.cards).sort(), [...CARDS].sort(), `${language}: every card`);
    for (const step of STEPS) assert.ok(entry.stage.steps[step], `${language}: runner lines for ${step}`);
    for (const [name, lines] of Object.entries(entry.stage.cards)) {
      // A 646px editor card holds 49 characters of 20px code and, beside the terminal, 11 lines.
      assert.ok(lines.length <= 11, `${language} ${name}: ${lines.length} lines`);
      for (const line of lines) assert.ok(line.length <= 49, `${language} ${name}: "${line}" is ${line.length} characters`);
    }
    for (const block of ['tests', 'bill', 'weak_test_tests', 'weak_test_code']) assert.ok(entry.blocks[block].source.trim(), `${language}: ${block}`);
  }
});

test('the printable notes keep every term the narration teaches', () => {
  const notes = yaml.load(read(`_data/explainers/${topic}_notes.yml`));
  assert.deepEqual(Object.keys(notes).sort(), story.scenes.flatMap(scene => scene.cues.map(cue => `${scene.id}-${cue.id}`)).sort());
  const text = Object.values(notes).flat().join(' ').replace(/\*\*/g, '').toLowerCase();
  assert.deepEqual(TAUGHT.filter(term => !text.includes(term)), []);
});
