'use strict';

// A closer look is an optional worked example that a learner can open during
// one cue: the narration pauses, the example replaces the picture, and the
// learner continues where they paused. It never changes spoken text or the
// speech fingerprint.
//
// Extension points (each is one table entry plus its renderer):
// - CONTENT: how a look's material is authored and checked. `code` is the
//   first kind; a new kind adds a validator here and an include that marks
//   its anchors with data-closer-look-focus (see docs/narration-format.md).
// - RELATION_KINDS: the arrows a look may draw between two anchors.

const LOOK_FIELDS = ['title', 'notice', 'offer', 'groups', 'relations', 'steps'];
const RELATION_KINDS = ['call', 'dependency'];
const DEFAULT_OFFER = 'See it in code';
const MAX_CODE_LINE = 60;

const CONTENT = {
  // `code: <name>` names blocks `<name>_<group>` in <id>_code.yml, in every language.
  code: validateCodeContent,
};

/** Validate every closer look of a compiled story against the lesson's code
 * examples (`<id>_code.yml`, keyed by language) and return a copy of the story
 * whose looks carry their defaults. Throws a source-addressed error. */
function compileCloserLooks(story, examples = {}) {
  return {
    ...story,
    scenes: story.scenes.map(scene => ({
      ...scene,
      cues: scene.cues.map(cue => cue.closer_look === undefined ? cue : {
        ...cue,
        closer_look: compileLook(cue.closer_look, examples, `${scene.id}.${cue.id}.closer_look`),
      }),
    })),
  };
}

/** Each look with the scene and cue it belongs to, in lesson order. */
function closerLookAnchors(story) {
  return story.scenes.flatMap(scene => scene.cues.flatMap(cue => (
    cue.closer_look ? [{ scene: scene.id, cue: cue.id, look: cue.closer_look }] : []
  )));
}

function compileLook(look, examples, at) {
  const check = checker(at);
  check.fields(look, [...LOOK_FIELDS, ...Object.keys(CONTENT)], '');
  check.text(look.title, 'title');
  check.text(look.notice, 'notice');
  const offer = look.offer ?? DEFAULT_OFFER;
  check.text(offer, 'offer');
  const contentKinds = Object.keys(CONTENT).filter(kind => look[kind] !== undefined);
  if (contentKinds.length !== 1) check.fail('', `name exactly one content kind: ${Object.keys(CONTENT).join(', ')}`);

  const groups = validateGroups(look.groups, check);
  const anchors = new Set();
  const anchor = (value, where) => {
    check.text(value, where);
    const [group, key, extra] = value.split('.');
    if (!key || extra !== undefined) check.fail(where, `expected group.focus, got ${value}`);
    if (!groups.includes(group)) check.fail(where, `unknown group ${group}`);
    anchors.add(value);
  };
  const relations = validateRelations(look.relations || [], check, anchor);
  validateSteps(look.steps, check, anchor, relations, groups);
  CONTENT[contentKinds[0]](look[contentKinds[0]], { groups, anchors, examples, check });
  return { ...look, offer };
}

function validateGroups(groups, check) {
  check.list(groups, 'groups');
  const ids = [];
  groups.forEach((group, index) => {
    const where = `groups.${index}`;
    check.fields(group, ['id', 'label'], where);
    if (!/^[a-z][a-z0-9_]*$/.test(group.id || '')) check.fail(where, 'expected a stable lowercase id');
    if (ids.includes(group.id)) check.fail(where, `duplicate group ${group.id}`);
    check.text(group.label, `${where}.label`);
    ids.push(group.id);
  });
  return ids;
}

function validateRelations(relations, check, anchor) {
  if (!Array.isArray(relations)) check.fail('relations', 'expected a list');
  const kinds = [];
  relations.forEach((relation, index) => {
    const where = `relations.${index}`;
    check.fields(relation, ['kind', 'from', 'to', 'label'], where);
    if (!RELATION_KINDS.includes(relation.kind)) check.fail(where, `kind must be ${RELATION_KINDS.join(' or ')}`);
    if (kinds.includes(relation.kind)) check.fail(where, `duplicate relation ${relation.kind}`);
    kinds.push(relation.kind);
    anchor(relation.from, `${where}.from`);
    anchor(relation.to, `${where}.to`);
    if (!Array.isArray(relation.label) || relation.label.length !== 2) check.fail(`${where}.label`, 'expected two short lines');
    relation.label.forEach((line, lineIndex) => check.text(line, `${where}.label.${lineIndex}`));
  });
  return kinds;
}

function validateSteps(steps, check, anchor, relations, groups) {
  check.list(steps, 'steps');
  steps.forEach((step, index) => {
    const where = `steps.${index}`;
    check.fields(step, ['question', 'text', 'focus', 'relation', 'remove'], where);
    check.text(step.question, `${where}.question`);
    check.text(step.text, `${where}.text`);
    check.list(step.focus, `${where}.focus`);
    step.focus.forEach((value, focusIndex) => anchor(value, `${where}.focus.${focusIndex}`));
    if (step.relation !== undefined && !relations.includes(step.relation)) check.fail(where, `unknown relation ${step.relation}`);
    if (step.remove !== undefined && !groups.includes(step.remove)) check.fail(where, `unknown group ${step.remove}`);
  });
}

// Code content: every language of <id>_code.yml has one block per group, and
// every anchor of that group names a focus key in that language.
function validateCodeContent(name, { groups, anchors, examples, check }) {
  check.text(name, 'code');
  const languages = Object.keys(examples);
  if (!languages.length) check.fail('code', `no code examples for ${name}`);
  for (const language of languages) {
    const blocks = examples[language].blocks || {};
    for (const group of groups) {
      const block = `${name}_${group}`;
      const where = `code (${language} block ${block})`;
      if (!blocks[block]) check.fail(where, 'missing code block');
      const files = codeFiles(blocks[block]);
      files.forEach((file, index) => validateCodeFile(file, `${where} file ${index + 1}`, check));
      for (const value of anchors) {
        const [anchorGroup, key] = value.split('.');
        if (anchorGroup === group && !files.some(file => Object.hasOwn(file.focus || {}, key))) {
          check.fail(where, `no focus ${value}`);
        }
      }
    }
  }
}

function validateCodeFile(file, where, check) {
  check.fields(file, ['file', 'source', 'focus'], where);
  check.text(file.file, `${where}.file`);
  check.text(file.source, `${where}.source`);
  const lines = file.source.replace(/\n$/, '').split('\n');
  lines.forEach((line, index) => {
    if (line.length > MAX_CODE_LINE) check.fail(where, `line ${index + 1} is longer than ${MAX_CODE_LINE} characters`);
  });
  for (const [key, numbers] of Object.entries(file.focus || {})) {
    if (!Array.isArray(numbers) || !numbers.length) check.fail(`${where}.focus.${key}`, 'expected line numbers');
    for (const number of numbers) {
      if (!Number.isInteger(number) || number < 1 || number > lines.length) check.fail(`${where}.focus.${key}`, `no line ${number}`);
    }
  }
}

/** A group's block is one file ({file, source, focus}) or several ({files: [...]}). */
const codeFiles = block => block.files || [block];

function checker(at) {
  const fail = (where, message) => { throw new Error(`${where ? `${at}.${where}` : at}: ${message}`); };
  const object = (value, where) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(where, 'expected an object');
  };
  return {
    fail,
    text(value, where) { if (typeof value !== 'string' || !value.trim()) fail(where, 'expected nonempty text'); },
    list(value, where) { if (!Array.isArray(value) || !value.length) fail(where, 'expected a nonempty list'); },
    fields(value, allowed, where) {
      object(value, where);
      for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(where ? `${where}.${key}` : key, 'unknown field');
    },
  };
}

module.exports = { compileCloserLooks, closerLookAnchors, codeFiles, RELATION_KINDS, DEFAULT_OFFER, MAX_CODE_LINE };
