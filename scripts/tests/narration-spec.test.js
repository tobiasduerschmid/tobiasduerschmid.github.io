const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { compileLesson } = require('../narration/compile');
const { ROOT, lessonIds, loadLesson } = require('../narration/source');

function fixture() {
  return {
    source: {
      version: 1, id: 'example', kind: 'video', title: 'A narrated example',
      lesson: { name: 'Example', parts: ['Idea'] },
      speech: { voice: 'af_heart', speed: 0.95, pronunciations: {} },
      media: { audio: '/assets/audio/example.mp3', captions: '/assets/narration/example.vtt', script: '/assets/narration/example.txt' },
      scenes: [{ id: 'idea', label: 'The idea', title: 'Inspect the change', part: 'Idea', cues: [
        { id: 'before', say: 'This is the first state.', visual: 'A box labeled Before.' },
        { id: 'after', say: 'Now inspect the second state.', visual: 'A box labeled After.', pause_after: 2.5 },
      ] }],
    },
    visuals: { version: 1, presentation: {}, resources: { slides: { states: { heading: 'States' } } }, scenes: {
      idea: { state: { slide: 'states', show: ['slide'] }, cues: { before: { phase: 0 }, after: { phase: 1 } } },
    } },
  };
}
const compile = ({ source, visuals }) => compileLesson(source, visuals);

test('stable cue IDs bind visuals correctly after reordering without changing the inputs', () => {
  const input = fixture(); input.source.scenes[0].cues.reverse();
  const original = structuredClone(input);
  const { story } = compile(input);
  assert.deepEqual(story.scenes[0].cues.map(c => [c.id, c.text, c.phase]), [
    ['after', 'Now inspect the second state.', 1], ['before', 'This is the first state.', 0],
  ]);
  assert.deepEqual(input, original);
});

test('visual and teaching-text edits do not invalidate speech', () => {
  const input = fixture(); const fingerprint = compile(input).story.speech_sha256;
  input.visuals.scenes.idea.cues.before.phase = 42;
  input.source.scenes[0].cues[0].visual = 'A revised drawing.';
  input.source.scenes[0].title = 'A revised heading';
  input.source.lesson.name = 'Revised navigation';
  assert.equal(compile(input).story.speech_sha256, fingerprint);
});

for (const [name, edit] of [
  ['words', f => { f.source.scenes[0].cues[0].say += ' Changed.'; }],
  ['pause', f => { f.source.scenes[0].cues[0].pause_after = 0; }],
  ['voice', f => { f.source.speech.voice = 'am_adam'; }],
  ['speed', f => { f.source.speech.speed = 1; }],
  ['pronunciation', f => { f.source.speech.pronunciations.state = 'stayt'; }],
  ['cue order', f => { f.source.scenes[0].cues.reverse(); }],
]) test(`${name} changes invalidate generated speech`, () => {
  const input = fixture(); const fingerprint = compile(input).story.speech_sha256;
  edit(input); assert.notEqual(compile(input).story.speech_sha256, fingerprint);
});

for (const [name, edit, message] of [
  ['unsupported versions', f => { f.source.version = 2; }, /version/],
  ['unknown script fields', f => { f.source.scenes[0].cues[0].sya = 'Typo'; }, /sya.*unknown/],
  ['duplicate cue IDs', f => { f.source.scenes[0].cues[1].id = 'before'; }, /duplicate ID/],
  ['dangling visual cue', f => { f.visuals.scenes.idea.cues.typo = {}; }, /unknown reference typo/],
  ['missing visual cue', f => { delete f.visuals.scenes.idea.cues.before; }, /missing visual for before/],
  ['speech in visual package', f => { f.visuals.scenes.idea.cues.before.text = 'Hidden speech'; }, /readable narration/],
  ['negative pauses', f => { f.source.scenes[0].cues[0].pause_after = -1; }, /nonnegative/],
  ['missing slide', f => { f.visuals.scenes.idea.state.slide = 'typo'; }, /missing slides entry/],
  ['unknown part', f => { f.source.scenes[0].part = 'Typo'; }, /unknown part/],
  ['unsafe output path', f => { f.source.media.audio = '/assets/../outside.mp3'; }, /local.*path/],
]) test(`compiler rejects ${name} with an actionable location`, () => {
  const input = fixture(); edit(input); assert.throws(() => compile(input), message);
});

test('new lesson IDs and all supported presentation kinds need no topic allowlist', () => {
  for (const kind of ['video', 'pattern', 'explainer', 'case-study']) {
    const input = fixture(); input.source.kind = kind; input.source.id = 'a-new-topic';
    assert.equal(compile(input).kind, kind);
  }
});

test('every published lesson has matching speech and stable timing cue IDs', () => {
  for (const topic of lessonIds()) {
    const { story } = loadLesson(topic);
    const timing = JSON.parse(readFileSync(path.join(ROOT, `_data/explainers/${topic}_timing.json`), 'utf8'));
    assert.equal(timing.speech_sha256, story.speech_sha256, `${topic}: regenerate speech`);
    assert.deepEqual(timing.scenes.map(s => [s.id, s.cues.map(c => c.id)]), story.scenes.map(s => [s.id, s.cues.map(c => c.id)]));
  }
});

test('the audio command validates a script without loading Kokoro or writing media', () => {
  const result = spawnSync('python3', ['scripts/render-explainer-narration.py', '--topic', 'scrum', '--check'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Valid script: 15 scenes, 49 cues/);
});

test('the documented minimal lesson is a complete compilable new topic', () => {
  const documentation = readFileSync(path.join(ROOT, 'docs/narration-format.md'), 'utf8');
  const source = require('js-yaml').load(documentation.match(/```yaml\n([\s\S]+?)\n```/)[1]);
  const visuals = JSON.parse(documentation.match(/```json\n([\s\S]+?)\n```/)[1]);
  const { story, kind } = compileLesson(source, visuals);
  assert.equal(kind, 'video');
  assert.equal(story.scenes[0].cues[0].text, source.scenes[0].cues[0].say);
  assert.equal(story.slides[story.scenes[0].slide].heading, 'Arrival order');
});

test('pronunciation map ordering does not change spoken output or its fingerprint', () => {
  const first = fixture();
  first.source.speech.pronunciations = { a: 'b', b: 'c' };
  const second = structuredClone(first);
  second.source.speech.pronunciations = { b: 'c', a: 'b' };
  assert.equal(compile(first).story.speech_sha256, compile(second).story.speech_sha256);
  const result = spawnSync('python3', ['-B', '-c', `
import importlib.util
spec = importlib.util.spec_from_file_location('narration', 'scripts/render-explainer-narration.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
assert module.spoken_form('a b', {'a': 'b', 'b': 'c'}) == module.spoken_form('a b', {'b': 'c', 'a': 'b'})
`], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});
