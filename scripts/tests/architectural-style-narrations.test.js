// The architectural-style video narrations (Publish-Subscribe, Layers, Pipes
// and Filters) share one teaching contract: motivation, rules, consequences,
// real systems in practice;
// every cue a picture on the blueprint stage; a check after every section;
// rendered speech; and notes that keep every taught term.
const { loadStory, loadRegistry } = require('../narration/source');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readFileSync, statSync } = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const root = path.resolve(__dirname, '../..');
const read = file => readFileSync(path.join(root, file.replace(/^\//, '')), 'utf8');
const frontMatter = file => yaml.load(read(file).split('---')[1]);
const registry = loadRegistry('video');

const LESSONS = {
  publish_subscribe: {
    kit: 'publish-subscribe', predictions: 2, summarySystem: /garage|gate/i,
    taught: [
      'direct calls', 'blocks', 'topic', 'publisher', 'subscriber', 'callback', 'message queue', 'never component to component',
      'rule 1, publisher ignorance', 'constraints', 'rule 2, subscriber ignorance', 'observer', 'design pattern',
      'architectural style', 'rule 3, one-way propagation', 'rule 4, asynchronous publishing', 'notify synchronously',
      'extensibility', 'run-time flexibility', 'modifiability', 'availability', 'no error', 'event format',
      'robustness', 'understandability', 'testability', 'performance', 'latency', 'single point of failure',
      'direct call', 'facts', 'requests',
    ],
  },
  layered_style: {
    kit: 'layered-style', predictions: 2, summarySystem: /music/i,
    taught: [
      'big ball of mud', 'levels of abstraction', 'layer', 'virtual machine', 'allowed-to-use', 'uses', 'rule 1',
      'rule 2', 'rule 3', 'never up', 'golden rule', 'next lower layer', 'constraints', 'upward use', 'cycle',
      'callback', 'strict layering', 'relaxed layering', 'layer bridging', 'tiers', 'portability',
      'modifiability', 'reusability', 'testability', 'division of labor', 'performance', 'up-front cost', 'timing',
    ],
  },
  pipes_and_filters: {
    kit: 'pipes-and-filters', predictions: 2, summarySystem: /radio|podcast|episode|station/i,
    taught: [
      'batch sequential', 'filter', 'pipe', 'buffer', 'source', 'sink', 'pipeline', 'constraints',
      'rule 1, independence', 'parameters', 'rule 2, agnosticism', 'one agreed format',
      'rule 3, incremental processing', 'rule 4, acyclic flow', 'tee', 'join', 'understandability',
      'order matters', 'filter developer', 'pipeline builder', 'reusability', 'extensibility', 'modifiability',
      'testability', 'throughput', 'interactive usability', 'latency', 'robustness', 'error handling',
    ],
  },
};

for (const [topic, spec] of Object.entries(LESSONS)) {
  const story = loadStory(topic);
  const lesson = registry[topic];
  const quizzes = yaml.load(read(`_data/explainers/${topic}_quizzes.yml`));
  const timing = JSON.parse(read(`_data/explainers/${topic}_timing.json`));
  const cues = story.scenes.flatMap(scene => scene.cues);

  test(`${topic}: motivation comes first, then the rules, the consequences, and real systems in practice`, () => {
    assert.deepEqual(lesson.parts, ['Motivation', 'Rules', 'Consequences', 'In practice']);
    const parts = story.scenes.map(scene => scene.part).filter(Boolean);
    assert.deepEqual([...new Set(parts)], lesson.parts, 'parts appear in order, each in one run');
    assert.equal(story.scenes[0].part, 'Motivation', 'the lesson opens with its motivation');
    assert.equal(story.scenes.at(-1).part, undefined, 'the recap closes the lesson outside the parts');
  });

  test(`${topic}: every cue is a scene on the animated stage and describes its picture in words`, () => {
    assert.equal(story.slides, undefined, 'structured text is drawn on the stage');
    assert.equal(story.diagrams, undefined, 'diagrams are drawn on the stage');
    for (const scene of story.scenes) {
      assert.equal(scene.animation, true, `${scene.id} is animated`);
      assert.deepEqual(scene.show, ['animation'], `${scene.id} shows only the animation`);
      for (const cue of scene.cues) {
        assert.ok(cue.visual.length >= 60, `${scene.id}/${cue.id} describes its picture in words`);
        assert.ok(cue.step.trim() && cue.note.trim(), `${scene.id}/${cue.id}: step and note`);
      }
    }
  });

  test(`${topic}: the narration teaches in cues of 30 to 55 words, without dates or attribution`, () => {
    for (const cue of cues) {
      const words = cue.text.split(/\s+/).length;
      assert.ok(words >= 30 && words <= 55, `${words} words: ${cue.text.slice(0, 40)}`);
      assert.doesNotMatch(cue.text, /\b(1[89]|20)\d\d\b|Garlan|Shaw|Buschmann|Clements|Fairbanks|Bass|Kazman|Parnas|Autoware|POSA|the (book|paper|slides|lecture) (says|calls|shows)/i);
    }
  });

  test(`${topic}: each prediction leaves time to think before the next cue answers it`, () => {
    story.scenes.forEach(scene => scene.cues.forEach((cue, index) => {
      if (!cue.prediction) return;
      assert.ok(cue.pause_after >= 4, `${scene.id}/${cue.id}: a prediction pauses at least 4 seconds`);
      assert.ok(scene.cues[index + 1], `${scene.id}/${cue.id}: the next cue in its scene answers it`);
      assert.match(cue.text, /predict/i, `${scene.id}/${cue.id} asks the learner to predict`);
    }));
    assert.equal(cues.filter(cue => cue.prediction).length, spec.predictions);
  });

  test(`${topic}: every section ends in a valid check, and the last is a summary quiz on a new system`, () => {
    assert.deepEqual(Object.keys(quizzes), story.scenes.map(scene => scene.id));
    const summary = quizzes[story.scenes.at(-1).id];
    assert.ok(summary.questions.length >= 5, 'the summary covers motivation, rules, consequences, and applicability');
    for (const question of summary.questions) assert.match(question.question, spec.summarySystem, 'a new system, not the example');
    const keyPositions = new Set();
    for (const [id, check] of Object.entries(quizzes)) {
      for (const question of check.questions || [check]) {
        const key = question.options[question.correct_index];
        keyPositions.add(question.correct_index);
        assert.ok(question.options.length >= 3 && key && question.explanation.trim(), id);
        const others = question.options.filter((_, index) => index !== question.correct_index).map(option => option.length).sort((a, b) => a - b);
        assert.ok(key.length <= 1.8 * others[Math.floor(others.length / 2)] + 1, `${id}: the key is not conspicuously long`);
        assert.ok(key.length <= Math.max(...others) + 15, `${id}: the key is not the longest by far`);
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

  test(`${topic}: the last cue before every check holds its picture for a viewing pause`, () => {
    for (const scene of story.scenes.filter(each => quizzes[each.id])) {
      assert.ok(scene.cues.at(-1).pause_after >= 2.5, `${scene.id} pauses before its check`);
    }
    // js/narration-transport.js stops 0.3 s before a section boundary.
    timing.scenes.filter(scene => quizzes[scene.id]).forEach(scene => {
      const viewingTime = scene.end - 0.3 - scene.cues.at(-1).speech_end;
      assert.ok(viewingTime >= 2, `${scene.id}: only ${viewingTime.toFixed(2)} s to inspect the picture before the check`);
    });
  });

  test(`${topic}: speech, captions, and timing are generated from the published script`, () => {
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
    assert.ok(timing.duration >= 9 * 60, 'a full lesson of about ten minutes or more');
    const captions = read(story.captions);
    assert.equal((captions.match(/ --> /g) || []).length, cues.length);
    cues.forEach(cue => assert.ok(captions.includes(cue.text), cue.text.slice(0, 40)));
    const size = statSync(path.join(root, story.audio)).size;
    assert.ok(size > 0 && size * 8 / timing.duration < 64000);
  });

  test(`${topic}: the chapter, its views, and the blueprint animation frame are wired to the registry`, () => {
    const chapter = read(`${lesson.chapter.replace('.html', '.md')}`);
    assert.match(chapter, new RegExp(`\\{% include narration\\.html topic="${topic}" %\\}`));
    for (const view of ['read', 'print']) {
      const page = frontMatter(`${lesson.views}/${view}.html`);
      assert.equal(page.layout, 'narrated-pattern-reader');
      assert.equal(page.video_narration, true);
      assert.equal(page.topic, topic);
    }
    const stage = frontMatter(lesson.animation.page);
    assert.equal(stage.layout, 'video-narration-stage');
    assert.equal(stage.topic, topic);
    assert.equal(lesson.animation.theme, 'drafting-room', 'an architecture lesson is drawn on the blueprint');
    assert.ok(lesson.animation.sheet_title, 'the blueprint title block names the lesson');
    for (const file of [...lesson.animation.styles, ...lesson.animation.scripts]) assert.ok(existsSync(path.join(root, file)), file);
    const scripts = lesson.animation.scripts.map(file => path.basename(file));
    assert.ok(lesson.animation.styles.map(file => path.basename(file)).includes('video-narration-uml-kit.css'), 'the UML kit styles its diagrams');
    assert.ok(scripts.includes('uml-kit.js'), 'the diagrams are drawn with the UML kit');
    assert.ok(scripts.indexOf('wall-kit.js') < scripts.indexOf('uml-kit.js'), 'the UML kit builds on the wall kit');
    assert.ok(scripts.indexOf('uml-kit.js') < scripts.indexOf(`${spec.kit}-kit.js`), 'the topic kit draws with the UML kit');
    assert.ok(scripts.indexOf('arch-kit.js') < scripts.indexOf(`${spec.kit}-kit.js`), 'the topic kit builds on the architecture kit');
    assert.equal(scripts.at(-1), `${spec.kit}.js`, 'the choreography loads after its kits');
  });

  test(`${topic}: the printable notes keep every term and rule the narration teaches`, () => {
    const notes = yaml.load(read(`_data/explainers/${topic}_notes.yml`));
    assert.deepEqual(Object.keys(notes).sort(), story.scenes.flatMap(scene => scene.cues.map(cue => `${scene.id}-${cue.id}`)).sort());
    const text = Object.values(notes).flat().join(' ').replace(/\*\*/g, '').toLowerCase();
    assert.deepEqual(spec.taught.filter(term => !text.includes(term)), []);
  });
}
