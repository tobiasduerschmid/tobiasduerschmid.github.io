'use strict';

// The C4 chapter's flashcards (spec §12, _data/flashcards/c4_model.yml): eighteen cards with stable ids, fifteen for
// objectives 1-6 and three for objective 7 that train what only the C4 chapter teaches about interface descriptions
// (where a field's unit goes; what `uses` and `realizes` connect; on which element an HTTP API is declared). SE Gym
// mixes decks, so every prompt names the C4 model and refers to nothing outside the card. Optional hints cue
// reasoning and must not repeat the answer. Cards that restate the chapter's element definitions, which are adapted
// from c4model.com, carry the Creative Commons attribution themselves (ledger Ruling 6), because SE Gym shows them
// without the chapter. The `# objective:` comments are checked against the YAML by c4-alignment.test.js.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');

const FLASHCARDS = path.join(__dirname, '../../_data/flashcards/c4_model.yml');
const text = fs.readFileSync(FLASHCARDS, 'utf8');
const cards = yaml.load(text).cards;

/** Card ids in file order with the objective named by the `# objective: n` comment just before each card. */
function objectivesById(source) {
  const result = new Map();
  let pending = null;
  for (const line of source.split('\n')) {
    const comment = line.match(/^\s*#\s*objective:\s*(\d+)\s*$/);
    if (comment) pending = Number(comment[1]);
    const item = line.match(/^ {2}- id:\s*(\S+)/);
    if (item) {
      result.set(item[1], pending);
      pending = null;
    }
  }
  return result;
}

const DIFFICULTIES = ['basic', 'intermediate', 'advanced', 'expert'];
const OUTSIDE_REFERENCE = /the lecture|lecture's|the chapter|this chapter|course model|previous question|this deck/i;

// Phrases of the chapter's Abstractions definitions (adapted from c4model.com/abstractions, CC BY 4.0).
const ADAPTED_DEFINITION = [
  /must be running for the system to work/i,
  /related functionality behind/i,
  /a container contains components/i,
];
const ATTRIBUTION = /\(https:\/\/c4model\.com\/abstractions\)[\s\S]*Simon Brown[\s\S]*\[CC BY 4\.0\]\(https:\/\/creativecommons\.org\/licenses\/by\/4\.0\/\)/;

/** Lower-case word sequences of length n, for spotting a hint that copies its card's answer. */
function wordRuns(value, n) {
  const words = value.toLowerCase().replace(/[^a-z0-9`_\s]/g, ' ').split(/\s+/).filter(Boolean);
  const runs = new Set();
  for (let i = 0; i + n <= words.length; i++) runs.add(words.slice(i, i + n).join(' '));
  return runs;
}

const learnerTexts = (card) => [card.question, card.hint, card.answer, card.explanation].filter(Boolean);

test('the deck has eighteen complete cards with unique kebab-case ids', () => {
  assert.equal(cards.length, 18);
  assert.equal(new Set(cards.map((card) => card.id)).size, 18, 'card ids are unique');
  for (const card of cards) {
    assert.match(card.id, /^c4-[a-z0-9-]+$/, `${card.id}: stable kebab-case id`);
    for (const field of ['question', 'answer', 'explanation']) {
      assert.ok(typeof card[field] === 'string' && card[field].trim(), `${card.id}: ${field} is a non-empty string`);
    }
    assert.ok(DIFFICULTIES.includes(card.difficulty), `${card.id}: difficulty ${card.difficulty}`);
  }
});

test('fifteen cards serve objectives 1 to 6 and three serve objective 7', () => {
  const objectives = [...objectivesById(text).values()];
  assert.equal(objectives.filter((n) => n >= 1 && n <= 6).length, 15);
  assert.equal(objectives.filter((n) => n === 7).length, 3);
});

test('the objective-7 cards ask the three prompts of spec §12', () => {
  const byObjective = objectivesById(text);
  const prompts = cards.filter((card) => byObjective.get(card.id) === 7).map((card) => card.question);
  const asks = (pattern) => prompts.filter((prompt) => pattern.test(prompt)).length;
  assert.equal(asks(/\bunit\b[\s\S]*\bmeaning\b/i), 1, 'where a field\'s unit goes, and why not only in its meaning');
  assert.equal(asks(/`uses`[\s\S]*`realizes`[\s\S]*which responsibilities/i), 1, 'what uses and realizes connect');
  assert.equal(asks(/HTTP API[\s\S]*container[\s\S]*component[\s\S]*\bWhen\b/), 1, 'container or component for an HTTP API');
});

test('every prompt names the C4 model and refers to nothing outside the card', () => {
  for (const card of cards) {
    assert.match(card.question, /\bC4\b/, `${card.id}: prompt names the C4 model`);
    assert.doesNotMatch(card.question, OUTSIDE_REFERENCE, `${card.id}: prompt refers outside the card`);
  }
});

test('hints are optional, non-empty, and do not copy the answer or explanation', () => {
  for (const card of cards.filter((entry) => 'hint' in entry)) {
    assert.ok(typeof card.hint === 'string' && card.hint.trim(), `${card.id}: hint is a non-empty string`);
    // Seven words: long enough to skip a shared scene phrase ("a client in another container"), short enough to
    // catch a copied clause of the answer.
    const answerRuns = new Set([...wordRuns(card.answer, 7), ...wordRuns(card.explanation, 7)]);
    const copied = [...wordRuns(card.hint, 7)].filter((run) => answerRuns.has(run));
    assert.deepEqual(copied, [], `${card.id}: hint repeats answer or explanation wording`);
  }
});

test('a card that restates an adapted C4 element definition attributes c4model.com in its explanation', () => {
  const restating = cards.filter((card) => ADAPTED_DEFINITION.some((phrase) => learnerTexts(card).some((t) => phrase.test(t))));
  assert.ok(restating.length > 0, 'the detector finds the cards that restate a definition');
  for (const card of restating) assert.match(card.explanation, ATTRIBUTION, `${card.id}: explanation carries the attribution`);
});

test('no card uses the word "misconception"', () => {
  for (const card of cards) {
    for (const value of learnerTexts(card)) assert.doesNotMatch(value, /misconception/i, card.id);
  }
});
