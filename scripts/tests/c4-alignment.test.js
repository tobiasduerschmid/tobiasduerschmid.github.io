'use strict';

// Alignment of the C4 chapter's learning objectives (spec §12): every objective 1-7 must be practised in the chapter
// (a `<!-- objective: n -->` marker on a Quick Check or activity), asked in the quiz and drilled in the flashcards
// (an `# objective: n` comment before each item). Objective 7 is also served by the follow-up tutorial "Describe an
// interface". The comments are the single record of what each item serves, so every item must carry one.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');

const REPO_ROOT = path.join(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');

const OBJECTIVES = [1, 2, 3, 4, 5, 6, 7];
const CHAPTER = 'SEBook/architecture/c4.md';
const QUIZ = '_data/quizzes/c4_model.yml';
const FLASHCARDS = '_data/flashcards/c4_model.yml';
const INTERFACE_TUTORIAL = '_data/tutorials/c4-interfaces.yml';

const numbers = (list) => list.split(',').map((n) => Number(n.trim()));

/** Objective numbers named by the chapter's `<!-- objective: n -->` markers (a marker may list several, "2, 3"). */
function chapterObjectives(markdown) {
  return [...markdown.matchAll(/<!--\s*objective:\s*([\d,\s]+?)\s*-->/g)].flatMap((m) => numbers(m[1]));
}

/** One entry per YAML list item (`  - id:`): its id and the objectives of the `# objective:` comment(s) just before it. */
function itemObjectives(text) {
  const items = [];
  let pending = [];
  for (const line of text.split('\n')) {
    const comment = line.match(/^\s*#\s*objective:\s*([\d,\s]+?)\s*$/);
    if (comment) pending = pending.concat(numbers(comment[1]));
    const item = line.match(/^ {2}- id:\s*(\S+)/);
    if (item) {
      items.push({ id: item[1].replace(/^["']|["']$/g, ''), objectives: pending });
      pending = [];
    }
  }
  return items;
}

const uncovered = (objectives) => OBJECTIVES.filter((n) => !objectives.includes(n));

/**
 * The body of the Markdown section that starts with the line `heading` (such as `## Interface Descriptions`): every line
 * up to the next `# ` or `## ` heading. Lines inside code fences are not headings (c4 fences start with `# caption:`).
 * Returns '' when the heading is absent.
 */
function sectionText(markdown, heading) {
  const body = [];
  let inFence = false;
  let inSection = false;
  for (const line of markdown.split('\n')) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    if (!inFence && /^#{1,2} \S/.test(line)) {
      if (inSection) break;
      inSection = line.trim() === heading;
      continue;
    }
    if (inSection) body.push(line);
  }
  return body.join('\n').replace(/\n+$/, '');
}

const quizText = read(QUIZ);
const flashcardText = read(FLASHCARDS);
const quizItems = itemObjectives(quizText);
const flashcardItems = itemObjectives(flashcardText);

test('every objective has at least one chapter Quick Check or activity marker', () => {
  const markers = chapterObjectives(read(CHAPTER));
  assert.deepEqual(uncovered(markers), [], 'objectives with no marker in ' + CHAPTER);
  assert.deepEqual(markers.filter((n) => !OBJECTIVES.includes(n)), [], 'markers naming no objective');
});

test('every objective has at least one quiz item', () => {
  assert.deepEqual(uncovered(quizItems.flatMap((i) => i.objectives)), [], 'objectives with no item in ' + QUIZ);
});

test('every objective has at least one flashcard', () => {
  assert.deepEqual(uncovered(flashcardItems.flatMap((i) => i.objectives)), [], 'objectives with no card in ' + FLASHCARDS);
});

test('every quiz item and flashcard records a valid objective and the comments match the YAML', () => {
  for (const [file, text, items, key] of [[QUIZ, quizText, quizItems, 'questions'], [FLASHCARDS, flashcardText, flashcardItems, 'cards']]) {
    const ids = yaml.load(text)[key].map((entry) => String(entry.id));
    assert.deepEqual(items.map((i) => i.id), ids, file + ': items found by the comment scan differ from the YAML');
    for (const item of items) {
      assert.ok(item.objectives.length > 0, file + ': ' + item.id + ' has no objective comment');
      assert.deepEqual(item.objectives.filter((n) => !OBJECTIVES.includes(n)), [], file + ': ' + item.id + ' names an unknown objective');
    }
  }
});

// Objective 7 is served by three named pieces of evidence (spec §12 "Alignment"): a Quick Check inside the chapter's
// `## Interface Descriptions`, the follow-up tutorial "Describe an interface", and quiz item 13.

test('objective 7 is practised in a Quick Check of the Interface Descriptions section', () => {
  const section = sectionText(read(CHAPTER), '## Interface Descriptions');
  assert.ok(section.length > 0, CHAPTER + ' has a "## Interface Descriptions" section');
  assert.ok(chapterObjectives(section).includes(7), 'an objective-7 marker lies inside ## Interface Descriptions');
});

test('quiz item 13 serves objective 7', () => {
  const item = quizItems.find((i) => i.id === '13');
  assert.ok(item, QUIZ + ' has item 13');
  assert.ok(item.objectives.includes(7), QUIZ + ': item 13 records objective 7');
});

test('the tutorial "Describe an interface" assesses objective 7 with a gated knowledge check', () => {
  const tutorial = yaml.load(read(INTERFACE_TUTORIAL));
  assert.equal(tutorial.title, 'Describe an interface');
  assert.ok(tutorial.learning_objectives.some((objective) => /compatible interface change/.test(objective)),
    'a tutorial objective covers objective 7\'s compatibility clause');
  const gated = tutorial.steps.filter((step) => step.quiz && typeof step.quiz.min_score === 'number');
  assert.ok(gated.length > 0, 'at least one step gates progress on its knowledge check (min_score)');
});

test('the Interface Descriptions section links the tutorial "Describe an interface"', () => {
  const section = sectionText(read(CHAPTER), '## Interface Descriptions');
  assert.match(section, /\]\(\/SEBook\/architecture\/c4-interfaces-tutorial\)/);
});

test('the scan reports a missing objective (detector check)', () => {
  assert.deepEqual(uncovered(chapterObjectives('<!-- objective: 1 --> <!-- objective: 2, 3 -->')), [4, 5, 6, 7]);
  assert.deepEqual(itemObjectives('  # objective: 2\n  - id: a\n  - id: b\n').map((i) => i.objectives), [[2], []]);
});

test('a section ends at the next heading of its level or above, not at comments inside a code fence', () => {
  const markdown = '# A\n## B\nb1\n```c4\n# caption: inside\n```\nb2\n### B.1\nb3\n## C\nc1\n';
  assert.equal(sectionText(markdown, '## B'), 'b1\n```c4\n# caption: inside\n```\nb2\n### B.1\nb3');
  assert.equal(sectionText(markdown, '## Missing'), '');
});
