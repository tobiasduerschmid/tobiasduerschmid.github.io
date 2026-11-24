'use strict';

// The C4 chapter's quiz (spec §12, _data/quizzes/c4_model.yml): thirteen items, at least four of which read or
// critique a rendered c4 figure in the stem; option feedback that fires (wrong options only) and explains the
// reasoning without the word "misconception" or a reference to a display position (options shuffle at render time);
// and item 13, the objective-7 item, with the stem sentence and key that spec §12 fixes. The objective comments are
// checked by c4-alignment.test.js; scripts/audit_mcq_tells.py checks answer-length and formatting tells.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');
const core = require('../../js/ArchUML/c4/c4-core.js');

const QUIZ = path.join(__dirname, '../../_data/quizzes/c4_model.yml');
const questions = yaml.load(fs.readFileSync(QUIZ, 'utf8')).questions;

const ENTITIES = { '&#10;': '\n', '&#39;': "'", '&quot;': '"', '&lt;': '<', '&gt;': '>', '&amp;': '&' };
const decodeAttribute = (value) => value.replace(/&#10;|&#39;|&quot;|&lt;|&gt;|&amp;/g, (entity) => ENTITIES[entity]);

/** The decoded `data-uml-spec` of every `data-uml-type="c4"` figure in a question stem. */
function c4Figures(stem) {
  return [...stem.matchAll(/<div\b[^>]*\bdata-uml-type="c4"[^>]*\bdata-uml-spec='([^']*)'/g)].map((match) => decodeAttribute(match[1]));
}

/** Problems that keep a figure from drawing its view: load or check errors, or a selector that does not resolve. */
function figureProblems(spec) {
  const design = core.load(spec);
  const errors = core.check(design).filter((diagnostic) => diagnostic.severity === 'error')
    .map((diagnostic) => `${diagnostic.rule}: ${diagnostic.message}`);
  if (errors.length) return errors;
  const selector = core.extractEmbed(spec).selector || core.defaultView(design);
  return core.project(design, selector).type === null ? [`view "${selector}" does not resolve`] : [];
}

const POSITION_REFERENCE = /\boption [A-D]\b|\b(?:answer|choice) [A-D]\b|\bthe (?:first|second|third|fourth|last) (?:option|answer|choice)\b/i;

/** Every learner-facing string of a question: stem, options, explanation, and option feedback. */
const learnerTexts = (question) => [question.question, ...question.options, question.explanation, ...Object.values(question.option_feedback || {})];

const byId = (id) => questions.find((question) => question.id === id);

test('the quiz has thirteen single-answer items with ids 1 to 13', () => {
  assert.deepEqual(questions.map((question) => question.id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  for (const question of questions) {
    assert.equal(question.type, 'single', `item ${question.id}`);
    assert.ok(Number.isInteger(question.correct_index) && question.options[question.correct_index] !== undefined, `item ${question.id}: correct_index names an option`);
  }
});

test('at least four items read or critique a c4 figure that draws its view', () => {
  const figures = questions.flatMap((question) => c4Figures(question.question).map((spec) => ({ id: question.id, spec })));
  assert.ok(new Set(figures.map((figure) => figure.id)).size >= 4, `items with a c4 figure: ${figures.map((figure) => figure.id).join(', ')}`);
  for (const figure of figures) assert.deepEqual(figureProblems(figure.spec), [], `item ${figure.id}`);
});

test('option feedback is keyed by wrong options only, so every entry can fire', () => {
  for (const question of questions) {
    const keys = Object.keys(question.option_feedback || {}).map(Number);
    assert.ok(keys.length > 0, `item ${question.id} has option feedback`);
    for (const key of keys) {
      assert.ok(question.options[key] !== undefined && key !== question.correct_index, `item ${question.id}: feedback key ${key} must name a wrong option`);
    }
  }
});

test('no learner-facing text says "misconception" or names an option by its display position', () => {
  for (const question of questions) {
    for (const text of learnerTexts(question)) {
      assert.doesNotMatch(text, /misconception/i, `item ${question.id}`);
      assert.doesNotMatch(text, POSITION_REFERENCE, `item ${question.id}`);
    }
  }
});

test('item 13 asks the tax question of spec §12 with its key and three explained distractors', () => {
  const item = byId(13);
  assert.match(item.question.replace(/\s+/g, ' '), /A booking partner and Campus Shop disagree on totals although every message validates against the schema\. Which revision of the interface description most directly prevents this\?/);
  assert.equal(item.options[item.correct_index].replace(/\.$/, ''), 'State that price is in US cents and whether it includes sales tax');
  const distractors = item.options.map((_, index) => index).filter((index) => index !== item.correct_index);
  assert.equal(distractors.length, 3);
  for (const index of distractors) assert.ok(item.option_feedback[index], `distractor "${item.options[index]}" has feedback`);
});

test('the figure scan finds encoded c4 figures and reports a broken one (detector check)', () => {
  const stem = `Read this view.\n\n<div data-uml-type="c4" data-uml-spec='view: context of shop&#10;systems:&#10;  shop:&#10;    name: Shop&#10;    description: Sells things.'></div>`;
  assert.deepEqual(c4Figures(stem), ['view: context of shop\nsystems:\n  shop:\n    name: Shop\n    description: Sells things.']);
  assert.deepEqual(figureProblems(c4Figures(stem)[0]), []);
  assert.notDeepEqual(figureProblems('view: context of missing\nsystems:\n  shop:\n    name: Shop'), []);
  assert.match('as the third choice says', POSITION_REFERENCE);
});
