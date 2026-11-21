const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const runtimeSource = fs.readFileSync(path.join(__dirname, '../../js/tutorial-code.js'), 'utf8');
const coreSource = fs.readFileSync(path.join(__dirname, '../../js/tutorial-diagram-challenge-core.js'), 'utf8');

// The runtime and the challenge rules evaluate together in a sandbox; only
// the browser globals they touch while gating and saving are supplied.
function createTutorial(options) {
  const stored = {};
  const sandbox = {
    document: { cookie: '' }, AbortController, console, setTimeout, clearTimeout,
    localStorage: {
      getItem: key => (key in stored ? stored[key] : null),
      setItem(key, value) { stored[key] = String(value); },
      removeItem(key) { delete stored[key]; },
    },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(coreSource, sandbox, { filename: 'tutorial-diagram-challenge-core.js' });
  vm.runInNewContext(runtimeSource, sandbox, { filename: 'tutorial-code.js' });
  const tutorial = new sandbox.TutorialCode({ querySelector: () => null }, Object.assign({
    backend: 'pyodide', tutorialId: 'gate-demo', autosaveType: 'files',
  }, options));
  tutorial.currentStep = 0;
  return { tutorial, stored };
}

const CHALLENGE = {
  min_score: 0.8,
  questions: [{ id: 'q1', type: 'single', question: 'Which file?', options: ['a.py', 'b.toml'], correct_index: 1 }],
  reply: { diagrams: [{ id: 'd', type: 'component', source: '@startuml\n@enduml' }] },
};
const PASSED = { v: 1, state: 'done', passed: true };
const IN_PROGRESS = { v: 1, state: 'locked' };

function steps(extra) {
  return [Object.assign({ title: 'Challenge', diagram_challenge: CHALLENGE }, extra), { title: 'Next lesson' }];
}

test('a challenge step locks Next under require_tests until its challenge is passed', () => {
  const { tutorial } = createTutorial({ requireTests: true, steps: steps() });

  assert.equal(tutorial._isNextStepLocked(0), true);
  tutorial._diagramChallengeRecords['index:0'] = IN_PROGRESS;
  assert.equal(tutorial._isNextStepLocked(0), true, 'an unfinished challenge still locks Next');
  tutorial._diagramChallengeRecords['index:0'] = PASSED;
  assert.equal(tutorial._isNextStepLocked(0), false);
});

test('a challenge never locks without require_tests or in instructor mode', () => {
  assert.equal(createTutorial({ requireTests: false, steps: steps() }).tutorial._isNextStepLocked(0), false);
  assert.equal(createTutorial({ requireTests: true, instructorMode: true, steps: steps() }).tutorial._isNextStepLocked(0), false);
});

test('records are keyed by the step key when the step has one', () => {
  const { tutorial } = createTutorial({ requireTests: true, steps: steps({ key: 'events' }) });

  tutorial._diagramChallengeRecords['index:0'] = PASSED;
  assert.equal(tutorial._isNextStepLocked(0), true, 'an index key does not credit a keyed lesson');
  tutorial._diagramChallengeRecords['key:events'] = PASSED;
  assert.equal(tutorial._isNextStepLocked(0), false);
});

test('the full gate also waits for a required knowledge check, which Next opens', () => {
  const quiz = { questions: [{ type: 'single', question: 'Q?', options: ['x', 'y'], correct_index: 0 }] };
  const { tutorial } = createTutorial({ requireTests: true, steps: steps({ quiz }) });
  tutorial._diagramChallengeRecords['index:0'] = PASSED;

  assert.equal(tutorial._isNextStepLocked(0), false, 'Next is enabled to open the quiz');
  assert.equal(tutorial._stepGateSatisfied(0), false, 'the next step stays locked until the quiz passes');
  tutorial._quizPassed.add(0);
  assert.equal(tutorial._stepGateSatisfied(0), true);
});

test('a step with tests and a challenge needs both', () => {
  const tests = [{ description: 'runs', command: 'assert True' }];
  const { tutorial } = createTutorial({ requireTests: true, progressVersion: 1, steps: [
    { key: 'both', title: 'Both', tests, diagram_challenge: CHALLENGE }, { key: 'after', title: 'After' },
  ] });

  tutorial._stepsPassed.add(0);
  assert.equal(tutorial._isNextStepLocked(0), true, 'passing tests alone is not enough');
  tutorial._diagramChallengeRecords['key:both'] = PASSED;
  assert.equal(tutorial._isNextStepLocked(0), false);
});

test('timed practice counts a passed challenge as solved, even without require_tests', () => {
  const { tutorial } = createTutorial({ requireTests: false, steps: steps() });

  assert.equal(tutorial._timedPracticeStepSolved(0), false);
  tutorial._diagramChallengeRecords['index:0'] = PASSED;
  assert.equal(tutorial._timedPracticeStepSolved(0), true);
});

test('saved progress carries the challenge records and omits an empty set', () => {
  const { tutorial, stored } = createTutorial({ requireTests: true, steps: steps({ key: 'events' }) });

  assert.equal(tutorial.saveProgress(), true);
  assert.equal('diagramChallenges' in JSON.parse(stored['tutorial-progress-gate-demo']), false);

  const record = { v: 1, state: 'locked', a: { answers: { q1: 1 }, seconds: 12.3 } };
  tutorial._diagramChallengeRecords['key:events'] = record;
  assert.equal(tutorial.saveProgress(), true);
  assert.deepEqual(JSON.parse(stored['tutorial-progress-gate-demo']).diagramChallenges, { 'key:events': record });
});

test('the Reset confirmation can tell whether the step has a challenge', () => {
  const { tutorial } = createTutorial({ steps: steps() });
  assert.equal(tutorial.currentStepHasDiagramChallenge(), true);
  tutorial.currentStep = 1;
  assert.equal(tutorial.currentStepHasDiagramChallenge(), false);
});
