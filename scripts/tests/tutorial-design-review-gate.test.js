const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const runtimeSource = fs.readFileSync(path.join(__dirname, '../../js/tutorial-code.js'), 'utf8');
const coreSource = fs.readFileSync(path.join(__dirname, '../../js/tutorial-design-review-core.js'), 'utf8');

// The runtime and the review rules evaluate together in a sandbox; only the
// browser globals they touch while gating and saving are supplied.
function createTutorial(options) {
  const stored = {};
  const sandbox = {
    document: { cookie: '', getElementById: () => null }, AbortController, console, setTimeout, clearTimeout,
    localStorage: {
      getItem: key => (key in stored ? stored[key] : null),
      setItem(key, value) { stored[key] = String(value); },
      removeItem(key) { delete stored[key]; },
    },
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  vm.runInNewContext(coreSource, sandbox, { filename: 'tutorial-design-review-core.js' });
  vm.runInNewContext(runtimeSource, sandbox, { filename: 'tutorial-code.js' });
  const tutorial = new sandbox.TutorialCode({ querySelector: () => null }, Object.assign({
    backend: 'none', tutorialId: 'review-demo', autosaveType: 'files',
  }, options));
  tutorial.currentStep = 0;
  return { tutorial, stored };
}

const REVIEW = { min_words: 5, key: { flaw: 'f', consequence: 'c', fix: 'x' }, diagrams: [] };
const COMPARED = { v: 1, draft: 'one two three four five', checks: [], passed: true, revealedDraft: 'one two three four five', selfCheck: {} };
const DRAFTING = { v: 1, draft: 'one two', checks: [], passed: false };

function steps(extra) {
  return [Object.assign({ title: 'Review', design_review: REVIEW }, extra), { title: 'Next review' }];
}

test('a review step locks Next under require_tests until the comment is compared with the expert review', () => {
  const { tutorial } = createTutorial({ requireTests: true, steps: steps() });

  assert.equal(tutorial._isNextStepLocked(0), true);
  assert.match(tutorial._nextLockedLabel(0), /compare it with the expert review/);
  tutorial._designReviewRecords['index:0'] = DRAFTING;
  assert.equal(tutorial._isNextStepLocked(0), true, 'a draft alone does not pass');
  tutorial._designReviewRecords['index:0'] = COMPARED;
  assert.equal(tutorial._isNextStepLocked(0), false);
});

test('a review never locks without require_tests or in instructor mode', () => {
  assert.equal(createTutorial({ requireTests: false, steps: steps() }).tutorial._isNextStepLocked(0), false);
  assert.equal(createTutorial({ requireTests: true, instructorMode: true, steps: steps() }).tutorial._isNextStepLocked(0), false);
});

test('the model\'s ratings play no part in the gate', () => {
  const { tutorial } = createTutorial({ requireTests: true, steps: steps() });
  const strongChecks = [{ verdicts: { flaw: 'yes', consequence: 'yes', fix: 'yes' }, ratings: { correctness: 'correct', convincingness: 'convincing' } }];
  tutorial._designReviewRecords['index:0'] = Object.assign({}, DRAFTING, { checks: strongChecks });
  assert.equal(tutorial._isNextStepLocked(0), true, 'a perfect model rating without the comparison still locks');
  tutorial._designReviewRecords['index:0'] = Object.assign({}, COMPARED, { checks: [] });
  assert.equal(tutorial._isNextStepLocked(0), false, 'no model check is needed');
});

test('review records are keyed by the step key when the step has one', () => {
  const { tutorial } = createTutorial({ requireTests: true, steps: steps({ key: 'voice-chat' }) });

  tutorial._designReviewRecords['index:0'] = COMPARED;
  assert.equal(tutorial._isNextStepLocked(0), true, 'an index key does not credit a keyed lesson');
  tutorial._designReviewRecords['key:voice-chat'] = COMPARED;
  assert.equal(tutorial._isNextStepLocked(0), false);
});

test('the full gate also waits for the knowledge check, which Next opens', () => {
  const quiz = { questions: [{ type: 'single', question: 'Q?', options: ['x', 'y'], correct_index: 0 }] };
  const { tutorial } = createTutorial({ requireTests: true, steps: steps({ quiz }) });
  tutorial._designReviewRecords['index:0'] = COMPARED;

  assert.equal(tutorial._isNextStepLocked(0), false, 'Next is enabled to open the quiz');
  assert.equal(tutorial._stepGateSatisfied(0), false, 'the next step stays locked until the quiz passes');
  tutorial._quizPassed.add(0);
  assert.equal(tutorial._stepGateSatisfied(0), true);
});

test('storing a compared review records the step as passed and unlocks the next step', () => {
  const { tutorial } = createTutorial({ requireTests: true, steps: steps() });
  tutorial._refreshStepControls = () => {};
  tutorial._renderStepNav = () => {};

  tutorial._storeDesignReviewRecord('index:0', DRAFTING);
  assert.equal(tutorial._stepsPassed.has(0), false);
  tutorial._storeDesignReviewRecord('index:0', COMPARED);
  assert.equal(tutorial._stepsPassed.has(0), true);
  assert.equal(tutorial._stepsUnlocked.has(1), true);
});

test('saved progress carries the review records and omits an empty set', () => {
  const { tutorial, stored } = createTutorial({ requireTests: true, steps: steps({ key: 'voice-chat' }) });

  assert.equal(tutorial.saveProgress(), true);
  assert.equal('designReviews' in JSON.parse(stored['tutorial-progress-review-demo']), false);

  tutorial._designReviewRecords['key:voice-chat'] = DRAFTING;
  assert.equal(tutorial.saveProgress(), true);
  assert.deepEqual(JSON.parse(stored['tutorial-progress-review-demo']).designReviews, { 'key:voice-chat': DRAFTING });
});

test('timed practice counts a compared review as solved, even without require_tests', () => {
  const { tutorial } = createTutorial({ requireTests: false, steps: steps() });

  assert.equal(tutorial._timedPracticeStepSolved(0), false);
  tutorial._designReviewRecords['index:0'] = COMPARED;
  assert.equal(tutorial._timedPracticeStepSolved(0), true);
});

test('a tutorial without a runtime has no Run action and boots at once', async () => {
  const { tutorial } = createTutorial({ steps: steps() });
  assert.equal(tutorial.runEnabled, false);
  await tutorial._initBackend();
  assert.equal(tutorial.booted, true);
  assert.equal(tutorial.currentStepHasDesignReview(), true);
});
