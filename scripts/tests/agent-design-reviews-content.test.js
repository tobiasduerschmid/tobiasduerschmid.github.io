// Content checks for the design reviews in _data/tutorials/agent-design-reviews.yml.
// They pin what the review widget and the local model's prompts rely on:
// every field the code reads exists, the key fits the prompt limits, every
// pattern compiles, the anchors name elements that the diagrams draw, and the
// signals accept the key's own wording but not an unrelated comment.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');

const tutorial = YAML.parse(fs.readFileSync(path.join(__dirname, '../../_data/tutorials/agent-design-reviews.yml'), 'utf8'));
const reviews = tutorial.steps.map((step, index) => ({ step, index, review: step.design_review })).filter(entry => entry.review);
const judge = () => import('../../js/browser-llm/design-review-judge.mjs');
const DIAGRAM_TYPES = new Set(['class', 'sequence', 'component', 'state']);
const OFF_TOPIC = 'The diagram is neat and the class names are clear. I would add more colors and a legend so it is easier to read.';
const label = entry => 'step ' + (entry.index + 1) + ' (' + entry.step.key + ')';

function patterns(list) {
  return (list || []).map(source => new RegExp(source, 'i'));
}

test('every step is a design review with a stable key, a neutral title, and a knowledge check', () => {
  assert.equal(tutorial.backend, 'none');
  assert.equal(reviews.length, tutorial.steps.length);
  const keys = new Set();
  tutorial.steps.forEach((step, index) => {
    assert.match(step.title, new RegExp('^Review ' + (index + 1) + ': [A-Z]'), 'title names the review and its system');
    assert.ok(step.key && !keys.has(step.key), 'unique step key');
    keys.add(step.key);
    assert.match(step.instructions, /^### Why this matters\n/);
    assert.match(step.instructions, /### 🎯 You will learn to\n/);
    assert.equal(step.quiz.title, 'Step ' + (index + 1) + ' — Knowledge Check');
    assert.equal(step.quiz.min_score, 0.8);
    assert.ok(step.quiz.questions.length >= 3, 'at least three knowledge-check questions');
  });
});

test('every review has the case, the diagrams, the key, and the lesson the widget shows', () => {
  for (const entry of reviews) {
    const r = entry.review;
    for (const field of ['request', 'story', 'reply', 'given']) assert.ok(String(r[field] || '').trim(), label(entry) + ' has ' + field);
    assert.ok(Array.isArray(r.acceptance_criteria) && r.acceptance_criteria.length, label(entry) + ' has acceptance criteria');
    assert.ok(Array.isArray(r.diagrams) && r.diagrams.length >= 1, label(entry) + ' has diagrams');
    for (const diagram of [...r.diagrams, r.annotated, r.fixed].filter(Boolean)) {
      assert.ok(DIAGRAM_TYPES.has(diagram.type), label(entry) + ' uses a taught diagram type, not ' + diagram.type);
      assert.match(diagram.source, /^@startuml\n[\s\S]*@enduml\s*$/, label(entry) + ' diagram source is complete');
      assert.ok(diagram.label, label(entry) + ' diagram has a tab label');
    }
    for (const field of ['principle', 'definition', 'ask', 'flaw', 'fix']) assert.ok(r.lesson && r.lesson[field], label(entry) + ' lesson has ' + field);
    assert.match(r.lesson.ask, /^\*\*Ask:\*\*/, label(entry) + ' lesson question uses the lecture format');
    for (const criterion of ['flaw', 'consequence', 'fix']) {
      assert.ok(Array.isArray(r.coach[criterion]) && r.coach[criterion].length >= 2, label(entry) + ' coaches ' + criterion);
    }
  }
});

test('every key fits the model prompt limits for all three questions', async () => {
  const { reviewMessages, REVIEW_CRITERIA } = await judge();
  for (const entry of reviews) {
    const comment = [entry.review.key.flaw, entry.review.key.consequence].join(' ').slice(0, 880);
    for (const criterion of REVIEW_CRITERIA) {
      assert.doesNotThrow(() => reviewMessages({ criterion, key: entry.review.key, review: comment }), label(entry) + ' ' + criterion);
    }
  }
});

test('every pattern compiles, and the anchors name elements the diagrams draw', () => {
  for (const entry of reviews) {
    const r = entry.review;
    const drawn = r.diagrams.map(diagram => diagram.source).join('\n');
    for (const list of Object.values(r.signals)) patterns(list);
    for (const claim of r.wrong_claims || []) {
      assert.ok(claim.note, label(entry) + ' wrong claim has a note');
      patterns(claim.patterns);
    }
    assert.ok(r.anchors.length >= 1, label(entry) + ' has anchors');
    for (const anchor of r.anchors) {
      assert.ok(anchor.label, label(entry) + ' anchor has a label');
      assert.match(drawn, new RegExp(anchor.pattern, 'i'), label(entry) + ' anchor ' + anchor.label + ' appears in a diagram');
    }
  }
});

test('the key\'s own wording satisfies each criterion\'s signals, and an unrelated comment satisfies none', () => {
  for (const entry of reviews) {
    const r = entry.review;
    const keyText = { flaw: r.key.flaw, consequence: r.key.consequence, fix: [r.key.fix, ...(r.key.accept_fixes || [])].join(' ') };
    for (const [criterion, list] of Object.entries(r.signals)) {
      if (!list || !list.length) continue;
      assert.ok(patterns(list).some(pattern => pattern.test(keyText[criterion])), label(entry) + ' key matches its ' + criterion + ' signals');
    }
    assert.ok(!patterns(r.signals.flaw).some(pattern => pattern.test(OFF_TOPIC)), label(entry) + ' flaw signals reject an unrelated comment');
    assert.ok(r.anchors.some(anchor => new RegExp(anchor.pattern, 'i').test(r.key.flaw)), label(entry) + ' key names an anchored element');
  }
});

test('a scaffold leaves the learner\'s minimum word count to write', () => {
  const Core = require('../../js/tutorial-design-review-core.js');
  for (const entry of reviews.filter(item => item.review.scaffold)) {
    assert.equal(Core.ownWordCount(entry.review, entry.review.scaffold), 0, label(entry));
    assert.equal(Core.canCompare(entry.review, entry.review.scaffold), false, label(entry));
  }
});
