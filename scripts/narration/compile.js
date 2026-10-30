'use strict';
const { createHash } = require('node:crypto');

const SHARED_STYLES = ['/css/song-video-fonts.css', '/css/narrated-explainer.css'];
const PRESENTATIONS = {
  video: {
    include: 'video-narration.html',
    styles: ['/css/narrated-pattern.css', '/css/narrated-pattern-document.css', '/css/video-narration.css'],
  },
  pattern: {
    include: 'narrated-pattern.html',
    styles: ['/css/narrated-pattern.css', '/css/narrated-pattern-document.css'],
  },
  explainer: { include: 'narrated-explainer.html', styles: [] },
  'case-study': { include: 'narrated-case-study.html', styles: ['/css/narrated-case-study.css'] },
};
const ROOT_FIELDS = ['version', 'id', 'kind', 'title', 'description', 'references', 'lesson', 'speech', 'media', 'scenes'];
const SCENE_FIELDS = ['id', 'label', 'title', 'part', 'outline', 'purpose', 'takeaway', 'evidence', 'sources', 'checkpoint', 'cues'];
const CUE_FIELDS = ['id', 'say', 'pause_after', 'visual', 'step', 'note', 'source', 'prediction'];

/** Compile a versioned script and visual package without mutating either input.
 * Throws a source-addressed error for invalid author data or broken cue links.
 * Renderer-specific state is opaque; narration can never be overridden by it.
 */
function compileLesson(source, visuals) {
  validateScript(source);
  validateVisualPackage(source, visuals);
  const scenes = source.scenes.map(scene => compileScene(scene, visuals.scenes[scene.id], `${source.id}.${scene.id}`));
  const lesson = { ...source.lesson, ...visuals.presentation };
  const story = { ...visuals.resources, title: source.title, ...source.media, ...source.speech, scenes };
  for (const key of ['description', 'references']) {
    if (source[key] !== undefined) story[key] = source[key];
  }
  validateReferences(story, lesson, source.kind);
  story.speech_sha256 = speechFingerprint(story);
  const presentation = PRESENTATIONS[source.kind];
  return {
    id: source.id, kind: source.kind, player_include: presentation.include,
    styles: [...SHARED_STYLES, ...presentation.styles, ...(lesson.styles || [])],
    lesson, story,
  };
}

function compileScene(scene, visual, at) {
  validateFields(scene, SCENE_FIELDS, at);
  for (const key of ['label', 'title']) validateText(scene[key], `${at}.${key}`);
  validateFields(visual, ['state', 'cues'], `${at}.visuals`);
  validateVisualFields(visual.state, SCENE_FIELDS, `${at}.visuals.state`);
  validateMatchingKeys(visual.cues, uniqueIds(scene.cues, `${at}.cues`), `${at}.visuals.cues`);
  const cues = scene.cues.map(cue => compileCue(cue, visual.cues[cue.id], `${at}.${cue.id}`));
  return { ...visual.state, ...scene, cues };
}

function compileCue(cue, visual, at) {
  validateFields(cue, CUE_FIELDS, at);
  for (const key of ['say', 'visual']) validateText(cue[key], `${at}.${key}`);
  if (cue.pause_after !== undefined) {
    assert(Number.isFinite(cue.pause_after) && cue.pause_after >= 0, at, 'pause_after must be a nonnegative number');
  }
  validateVisualFields(visual, [...CUE_FIELDS, 'text'], `${at}.visuals`);
  const { say, ...description } = cue;
  return { ...visual, ...description, text: say };
}

function validateScript(source) {
  validateFields(source, ROOT_FIELDS, 'lesson');
  assert(source.version === 1, 'lesson.version', 'supported version is 1');
  validateId(source.id, 'lesson.id');
  validateText(source.title, `${source.id}.title`);
  assert(Object.hasOwn(PRESENTATIONS, source.kind), source.id, `unknown kind ${source.kind}`);
  validateSpeech(source.speech, `${source.id}.speech`);
  validateMedia(source.media);
  validateObject(source.lesson, `${source.id}.lesson`);
  validateText(source.lesson.name, 'lesson.name');
}

function validateSpeech(speech, at) {
  validateFields(speech, ['voice', 'speed', 'pronunciations'], at);
  validateText(speech.voice, `${at}.voice`);
  assert(Number.isFinite(speech.speed) && speech.speed > 0, `${at}.speed`, 'must be positive');
  validateObject(speech.pronunciations, `${at}.pronunciations`);
  for (const [word, spoken] of Object.entries(speech.pronunciations)) {
    validateText(word, `${at}.pronunciations`);
    validateText(spoken, `${at}.pronunciations.${word}`);
  }
}

function validateMedia(media) {
  validateFields(media, ['audio', 'captions', 'script'], 'media');
  for (const key of ['audio', 'captions', 'script']) {
    const path = media[key];
    validateText(path, `media.${key}`);
    assert(/^\/assets\/[a-zA-Z0-9_./-]+$/.test(path) && !path.split('/').includes('..'),
      `media.${key}`, 'must be a local /assets/ path');
  }
}

function validateVisualPackage(source, visuals) {
  validateFields(visuals, ['version', 'presentation', 'resources', 'scenes'], `${source.id}.visuals`);
  assert(visuals.version === 1, 'visuals.version', 'supported version is 1');
  validateVisualFields(visuals.resources,
    [...ROOT_FIELDS, 'audio', 'captions', 'script', 'voice', 'speed', 'pronunciations', 'speech_sha256'],
    'visuals.resources');
  validateVisualFields(visuals.presentation, Object.keys(source.lesson), 'visuals.presentation');
  validateMatchingKeys(visuals.scenes, uniqueIds(source.scenes, 'scenes'), 'visuals.scenes');
}

function validateReferences(story, lesson, kind) {
  const parts = lesson.parts || (kind === 'pattern' ? ['Context', 'Problem', 'Solution', 'Consequences'] : []);
  for (const scene of story.scenes) {
    if (scene.part) assert(parts.includes(scene.part), scene.id, `unknown part ${scene.part}`);
    for (const cue of scene.cues) {
      for (const [field, collection] of [['diagram', 'diagrams'], ['slide', 'slides']]) {
        const reference = cue[field] || scene[field];
        if (reference) {
          assert(Object.hasOwn(story[collection] || {}, reference),
            `${scene.id}.${cue.id}.${field}`, `missing ${collection} entry ${reference}`);
        }
      }
    }
  }
}

// Only speech inputs and ordering invalidate audio. Object key order, descriptions,
// navigation, code, drawings, and animation commands do not affect this digest.
function speechFingerprint(story) {
  const pronunciations = Object.entries(story.pronunciations).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  const scenes = story.scenes.map(scene => [
    scene.id, scene.cues.map(cue => [cue.id, cue.text, cue.pause_after ?? 0.55]),
  ]);
  const speech = [story.voice, story.speed, pronunciations, scenes];
  return createHash('sha256').update(JSON.stringify(speech)).digest('hex');
}

function assert(ok, at, message) {
  if (!ok) throw new Error(`${at}: ${message}`);
}
function validateObject(value, at) {
  assert(value && typeof value === 'object' && !Array.isArray(value), at, 'expected an object');
}
function validateText(value, at) {
  assert(typeof value === 'string' && value.trim(), at, 'expected nonempty text');
}
function validateId(value, at) {
  assert(typeof value === 'string' && /^[a-z][a-z0-9_-]*$/.test(value), at, 'expected a stable lowercase ID');
}
function validateFields(value, allowed, at) {
  validateObject(value, at);
  for (const key of Object.keys(value)) assert(allowed.includes(key), `${at}.${key}`, 'unknown field');
}
function uniqueIds(items, at) {
  assert(Array.isArray(items) && items.length, at, 'expected a nonempty list');
  const seen = new Set();
  for (const item of items) {
    validateObject(item, at);
    validateId(item.id, `${at}.id`);
    assert(!seen.has(item.id), at, `duplicate ID ${item.id}`);
    seen.add(item.id);
  }
  return seen;
}
function validateVisualFields(value, reserved, at) {
  validateObject(value, at);
  for (const key of Object.keys(value)) {
    assert(!reserved.includes(key), `${at}.${key}`, 'belongs in the readable narration, not the visual package');
  }
}
function validateMatchingKeys(value, expected, at) {
  validateObject(value, at);
  for (const key of Object.keys(value)) assert(expected.has(key), at, `unknown reference ${key}`);
  for (const key of expected) assert(Object.hasOwn(value, key), at, `missing visual for ${key}`);
}

module.exports = { compileLesson };
