'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { compileCloserLooks, closerLookAnchors } = require('../narration/closer-look');
const { loadLesson } = require('../narration/source');

const LANGUAGES = ['python', 'java', 'cpp', 'typescript'];

function example(overrides = {}) {
  const look = {
    title: 'Calls go up, imports point down',
    notice: 'One collision, two relations.',
    code: 'callbacks',
    groups: [{ id: 'game', label: '«layer» Game rules' }, { id: 'engine', label: '«layer» Engine' }],
    relations: [
      { kind: 'call', from: 'engine.call', to: 'game.handler', label: ['calls ↑', 'at run time'] },
      { kind: 'dependency', from: 'game.imports', to: 'engine.contract', label: ['imports ↓', 'dependency'] },
    ],
    steps: [{ question: 'Who calls whom?', text: 'Control flows up.', focus: ['engine.call', 'game.handler'], relation: 'call' }],
    ...overrides,
  };
  const story = { scenes: [{ id: 'callbacks', cues: [{ id: 'not_uses', closer_look: look }] }] };
  const block = (focus) => ({ files: [{ file: 'f', source: 'a\nb\nc', focus }] });
  const examples = Object.fromEntries(LANGUAGES.map(language => [language, { label: language, blocks: {
    callbacks_game: block({ imports: [1], handler: [2] }),
    callbacks_engine: block({ contract: [1], call: [3] }),
  } }]));
  return { story, examples };
}

test('accepts a complete closer look and fills the default offer without mutating its input', () => {
  const { story, examples } = example();
  const compiled = compileCloserLooks(story, examples);
  assert.equal(compiled.scenes[0].cues[0].closer_look.offer, 'See it in code');
  assert.equal(story.scenes[0].cues[0].closer_look.offer, undefined);
  assert.deepEqual(closerLookAnchors(compiled).map(({ scene, cue }) => `${scene}.${cue}`), ['callbacks.not_uses']);
});

test('a story without closer looks compiles unchanged and needs no code', () => {
  const story = { scenes: [{ id: 'intro', cues: [{ id: 'jam' }] }] };
  assert.deepEqual(compileCloserLooks(story, {}), story);
});

test('rejects a look that names no content kind', () => {
  const { story, examples } = example({ code: undefined });
  delete story.scenes[0].cues[0].closer_look.code;
  assert.throws(() => compileCloserLooks(story, examples), /exactly one content kind: code/);
});

test('rejects a focus on an unknown group', () => {
  const { story, examples } = example({ steps: [{ question: 'Q', text: 'T', focus: ['ui.call'] }] });
  assert.throws(() => compileCloserLooks(story, examples), /callbacks\.not_uses.*unknown group ui/);
});

test('rejects a focus key missing in one language', () => {
  const { story, examples } = example();
  delete examples.java.blocks.callbacks_engine.files[0].focus.call;
  assert.throws(() => compileCloserLooks(story, examples), /java.*engine\.call/);
});

test('rejects a missing block for a group', () => {
  const { story, examples } = example();
  delete examples.cpp.blocks.callbacks_game;
  assert.throws(() => compileCloserLooks(story, examples), /cpp.*callbacks_game/);
});

test('rejects a relation kind other than call or dependency', () => {
  const { story, examples } = example({ relations: [{ kind: 'data', from: 'engine.call', to: 'game.handler', label: ['a', 'b'] }] });
  assert.throws(() => compileCloserLooks(story, examples), /kind must be call or dependency/);
});

test('rejects a step that names an unknown relation', () => {
  const { story, examples } = example({ steps: [{ question: 'Q', text: 'T', focus: ['engine.call'], relation: 'data' }] });
  assert.throws(() => compileCloserLooks(story, examples), /relation data/);
});

test('rejects code lines longer than 60 characters', () => {
  const { story, examples } = example();
  examples.python.blocks.callbacks_game.files[0].source = 'x'.repeat(61) + '\nb';
  assert.throws(() => compileCloserLooks(story, examples), /python.*line 1.*60/);
});

test('the layered lesson ships its closer look without changing the speech fingerprint', () => {
  const { readFileSync } = require('node:fs');
  const path = require('node:path');
  const lesson = loadLesson('layered_style');
  const cue = lesson.story.scenes.find(scene => scene.id === 'callbacks').cues.find(item => item.id === 'not_uses');
  assert.equal(cue.closer_look.title, 'Calls go up, imports point down');
  const timing = JSON.parse(readFileSync(path.join(__dirname, '../../_data/explainers/layered_style_timing.json'), 'utf8'));
  assert.equal(lesson.story.speech_sha256, timing.speech_sha256);
});
