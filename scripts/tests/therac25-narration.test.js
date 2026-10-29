const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const path = require('node:path');
const yaml = require('js-yaml');

const root = path.resolve(__dirname, '../..');
const readAsset = filename => readFileSync(path.join(root, filename));

function assertText(value, label) {
  assert.equal(typeof value, 'string', `${label} must be text`);
  assert.ok(value.trim(), `${label} must not be empty`);
}

for (const topic of ['therac25', 'cloudflare2019']) {
  describe(topic, () => {
    let source;
    let story;
    before(() => {
      source = readAsset(`_data/explainers/${topic}.yml`);
      story = yaml.load(source.toString());
    });
    const readTiming = () => JSON.parse(readAsset(`_data/explainers/${topic}_timing.json`));

    test('decisions have distinct choices, a valid answer, and feedback for every misconception', () => {
      assert.ok(story.scenes.length > 0, 'The adventure must contain a scene.');
      assert.equal(new Set(story.scenes.map(scene => scene.id)).size, story.scenes.length,
        'Scene identifiers must be unique for navigation and timing.');
      const decisionScenes = story.scenes.filter(scene => scene.checkpoint);
      assert.ok(decisionScenes.length > 0, 'The investigation must ask learners to make a decision.');
      for (const scene of decisionScenes) {
        const question = scene.checkpoint;
        assertText(question.question, `${scene.id}: question`);
        assertText(question.explanation, `${scene.id}: explanation`);
        assert.ok(question.options.length >= 2, `${scene.id}: a decision requires alternatives`);
        question.options.forEach((option, index) => assertText(option, `${scene.id}: option ${index}`));
        const normalized = question.options.map(option => option.trim().toLowerCase());
        assert.equal(new Set(normalized).size, question.options.length, `${scene.id}: choices must differ`);
        assert.ok(Number.isInteger(question.correct_index), `${scene.id}: the answer index must be an integer`);
        assert.ok(question.correct_index >= 0 && question.correct_index < question.options.length,
          `${scene.id}: the answer must identify an offered choice`);
        const wrongIndices = question.options.map((_, index) => index)
          .filter(index => index !== question.correct_index);
        for (const index of wrongIndices) {
          assertText(question.option_feedback[index], `${scene.id}: feedback for option ${index}`);
        }
        for (const [index, feedback] of Object.entries(question.option_feedback)) {
          assert.match(index, /^(0|[1-9]\d*)$/, `${scene.id}: feedback keys must be option indices`);
          assert.ok(Number(index) < question.options.length, `${scene.id}: feedback must identify an offered choice`);
          assertText(feedback, `${scene.id}: feedback ${index}`);
        }
      }
    });

    test('every narrated evidence step resolves to a described UML diagram', () => {
      const supportedTypes = new Set(['class', 'sequence', 'state', 'component', 'deployment', 'usecase', 'activity']);
      assert.ok(Object.keys(story.diagrams).length > 0, 'The investigation must provide diagrams.');
      for (const [id, diagram] of Object.entries(story.diagrams)) {
        assert.ok(supportedTypes.has(diagram.type), `${id}: unsupported UML type ${diagram.type}`);
        for (const field of ['label', 'description', 'caption', 'source']) {
          assertText(diagram[field], `${id}: ${field}`);
        }
        assert.match(diagram.source, /^\s*@startuml\b[\s\S]*@enduml\s*$/, `${id}: complete diagram source required`);
      }
      for (const scene of story.scenes) {
        assertText(scene.id, 'Scene identifier');
        assert.ok(Object.hasOwn(story.diagrams, scene.diagram), `${scene.id}: missing opening diagram`);
        assert.ok(scene.cues.length > 0, `${scene.id}: narration requires evidence steps`);
        for (const [index, cue] of scene.cues.entries()) {
          assert.ok(Object.hasOwn(story.diagrams, cue.diagram || scene.diagram),
            `${scene.id}/${index}: missing cue diagram`);
          assertText(cue.text, `${scene.id}/${index}: narration`);
          assertText(cue.visual, `${scene.id}/${index}: visual description`);
        }
      }
    });

    test('the diagram adventure contains no student code examples or language variants', () => {
      const content = [story, ...story.scenes, ...story.scenes.flatMap(scene => scene.cues)];
      for (const entry of content) {
        for (const field of ['code', 'alternate_code', 'languages', 'example_order']) {
          assert.equal(entry[field], undefined, `${entry.id || 'Narration'}: ${field} is outside this diagram-only lesson`);
        }
      }
      for (const scene of story.scenes) {
        for (const cue of scene.cues) {
          assert.doesNotMatch(cue.text, /```/, `${scene.id}: narration must not introduce a fenced code example`);
        }
      }
    });

    test('published narration timings cover the current storyboard in order without gaps', () => {
      const timing = readTiming();
      assert.equal(timing.source_sha256, createHash('sha256').update(source).digest('hex'),
        'Regenerate narration assets after editing the storyboard.');
      assert.equal(timing.voice, story.voice);
      assert.equal(timing.speed, story.speed);
      assert.deepEqual(timing.scenes.map(scene => scene.id), story.scenes.map(scene => scene.id));
      let end = 0;
      for (const [index, scene] of timing.scenes.entries()) {
        assert.equal(scene.start, end, `${scene.id}: scene must begin at the previous end`);
        assert.equal(scene.cues.length, story.scenes[index].cues.length, `${scene.id}: every cue needs timing`);
        for (const cue of scene.cues) {
          assert.equal(cue.start, end, `${scene.id}: cue times must be contiguous`);
          assert.ok(Number.isFinite(cue.end) && cue.end > cue.start, `${scene.id}: cue duration must be positive`);
          end = cue.end;
        }
        assert.equal(scene.end, end, `${scene.id}: scene end must include its last cue`);
      }
      assert.equal(timing.duration, end, 'Narration duration must include every scene.');
    });

    function captionSeconds(timestamp) {
      assert.match(timestamp, /^\d{2,}:\d{2}:\d{2}\.\d{3}$/, 'Captions require WebVTT timestamps.');
      const [hours, minutes, seconds] = timestamp.split(':').map(Number);
      assert.ok(minutes < 60 && seconds < 60, 'WebVTT minutes and seconds must be within their clock range.');
      return hours * 3600 + minutes * 60 + seconds;
    }

    test('captions preserve every cue in order at the corresponding narration time', () => {
      const captions = readAsset(story.captions).toString();
      const timing = readTiming().scenes.flatMap(scene => scene.cues);
      const cues = story.scenes.flatMap(scene => scene.cues);
      const [header, ...blocks] = captions.trim().split(/\r?\n\r?\n/);
      assert.equal(header, 'WEBVTT');
      assert.equal(blocks.length, cues.length, 'Every narrated cue requires one caption.');
      for (const [index, block] of blocks.entries()) {
        const [, interval, ...text] = block.split(/\r?\n/);
        const [start, end] = interval.split(' --> ').map(captionSeconds);
        assert.equal(text.join('\n'), cues[index].text, `Caption ${index}: text must follow the storyboard`);
        assert.ok(Math.abs(start - timing[index].start) <= 0.001, `Caption ${index}: start must match cue timing`);
        assert.ok(Math.abs(end - timing[index].end) <= 0.001, `Caption ${index}: end must match cue timing`);
      }
    });

    test('the downloadable script applies the authored pronunciations to every cue', () => {
      const substitutions = Object.entries(story.pronunciations)
        .sort(([left], [right]) => right.length - left.length);
      const spoken = story.scenes.flatMap(scene => scene.cues).map(cue => substitutions
        .reduce((text, [written, pronunciation]) => text.split(written).join(pronunciation), cue.text));
      assert.equal(readAsset(story.script).toString(), `${spoken.join('\n\n')}\n`);
    });

    test('published narration is an MP3 within the compressed speech bandwidth budget', () => {
      const audio = readAsset(story.audio);
      const duration = readTiming().duration;
      assert.equal(path.extname(story.audio), '.mp3');
      const hasMp3Header = audio.subarray(0, 3).toString() === 'ID3'
        || (audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0);
      assert.ok(hasMp3Header, 'The audio must contain an MP3 header.');
      assert.ok(audio.length > 0 && audio.length * 8 / duration < 64000,
        'Published speech must stay below 64 kbps, including container overhead.');
    });
  });
}
