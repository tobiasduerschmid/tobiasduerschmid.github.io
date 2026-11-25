// Model-aware hint conditions (spec §11 "Hints"): `condition: {c4: <predicate>}` in a C4 tutorial's hints is
// evaluated by the C4 adapter (js/tutorial-c4.js) against the snapshot of the last test run, through TutorChat
// (js/tutor-chat.js). The real C4 core, adapter, and hint engine run; Monaco is a text model and the DOM is the small
// fake below, which only has to carry the hint panel TutorChat builds.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '../..');
const C4 = require(path.join(ROOT, 'js/ArchUML/c4/c4-core.js'));
const ADAPTER = fs.readFileSync(path.join(ROOT, 'js/tutorial-c4.js'), 'utf8');
const TUTOR_CHAT = fs.readFileSync(path.join(ROOT, 'js/tutor-chat.js'), 'utf8');

const DESIGN = [
  'schema: c4-design/1',
  'name: Course Registration',
  'systems:',
  '  registration:',
  '    name: Course Registration',
  '    containers:',
  '      api:',
  '        name: Registration API',
  '        technology: Python',
  '        components:',
  '          policy:',
  '            name: Enrollment Policy',
  '            technology: Python module',
  '            responsibilities:',
  '              - decide: whether a student may enroll in a section',
  '          seats:',
  '            name: Seat Gateway',
  '            technology: Python module',
  '            responsibilities:',
  '              - do: hold every requested seat, or none',
  'views:',
  '  who-decides:',
  '    view: context of registration',
  '',
].join('\n');

const POLICY_BLOCK = DESIGN.slice(DESIGN.indexOf('          policy:'), DESIGN.indexOf('          seats:'));
const WITHOUT_POLICY = DESIGN.replace(POLICY_BLOCK, '');
const WITHOUT_VIEWS = DESIGN.slice(0, DESIGN.indexOf('views:'));
const UNREADABLE = DESIGN.replace('name: Course Registration\nsystems', 'name: [Course Registration\nsystems');

const hint = (title, condition) => (condition === undefined ? { title, text: `${title}.` } : { title, condition, text: `${title}.` });
const VIEW_STOPS_EARLY = { c4: { view: { view: 'who-decides', hides: [{ type: 'component' }] } } };
const POLICY_GONE = { c4: { absent: { element: { type: 'component', name_any: ['policy'] } } } };
const SHOWS_POLICY = {
  description: 'The saved view who-decides shows the deciding component',
  c4: { view: { view: 'who-decides', shows: ['policy'] } },
  hints: [hint('Ask which level answers the question'), hint('Look for the policy', POLICY_GONE), hint('Zoom in further', VIEW_STOPS_EARLY)],
};

// ---- A fake DOM: enough for TutorChat's panel, and a reader for the hint cards it shows -----------------------------

const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unescapeHtml = (html) => html.replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

class FakeElement {
  constructor() {
    this.children = [];
    this.parentNode = null;
    this.className = '';
    this.text = '';
    this.html = null;
    this.classList = { toggle: () => false, add() {}, remove() {}, contains: () => false };
  }
  set textContent(value) { this.text = String(value); this.html = null; this.children = []; }
  set innerHTML(value) { this.html = String(value); this.children = []; }
  get innerHTML() { return this.html === null ? escapeHtml(this.text) : this.html; }
  setAttribute() {}
  addEventListener() {}
  scrollIntoView() {}
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  removeChild(child) { this.children = this.children.filter((candidate) => candidate !== child); child.parentNode = null; }
  /** Every descendant, depth first. */
  descendants() { return this.children.flatMap((child) => [child, ...child.descendants()]); }
}

/** The hint cards in `panel` as the learner reads them: `{title, body}`, in order. */
function shownHints(panel) {
  return panel.descendants().filter((element) => element.className.split(' ').includes('tvm-tutor-hint')).map((card) => {
    const part = (name) => unescapeHtml(card.innerHTML.match(new RegExp(`<div class="${name}">([\\s\\S]*?)</div>`))[1]);
    return { title: part('tvm-tutor-hint-title').replace(/^\S+ /, ''), body: part('tvm-tutor-hint-body') };
  });
}

const titles = (hints) => hints.map((card) => card.title);

// ---- The tutorial host -----------------------------------------------------------------------------------------------

/**
 * A one-step tutorial with its design file in a text model. With `adapter`, the C4 adapter is installed and `test()`
 * runs Test My Work through it; the host's result renderer hands every failed run to TutorChat, as TutorialCode does.
 */
function host({ tests, design = DESIGN, backend = 'c4', adapter = true }) {
  const errors = [];
  const context = {
    setTimeout, clearTimeout,
    console: { error: (...args) => errors.push(args.map(String).join(' ')), log() {}, warn() {} },
    document: { createElement: () => new FakeElement() },
    ArchUMLC4: C4,
  };
  context.window = context;
  context.TutorialCode = function () {};
  if (adapter) vm.runInNewContext(ADAPTER, context);
  vm.runInNewContext(TUTOR_CHAT, context);

  const panel = new FakeElement();
  let text = design;
  const tutorial = new context.TutorialCode();
  Object.assign(tutorial, {
    config: { backend, c4: { file: 'design.yml' } },
    steps: [{ files: [{ path: 'design.yml', content: design }], tests }],
    currentStep: 0,
    _stepLoadSequence: 1,
    editorModels: { 'design.yml': { model: { getValue: () => text } } },
    stepContentEl: { querySelector: (selector) => (selector === '.tvm-test-panel' ? panel : null) },
    _renderTestResults(_tests, results) {
      this._testResults = results;
      if (results.some((result) => result !== true)) context.TutorChat.onTestFailure(this);
    },
  });
  return {
    tutorial,
    errors,
    edit(next) { text = next; },
    /** Test My Work: the results, and the hints the panel shows for them. */
    test() {
      tutorial._runTestsC4({ stepIndex: 0 });
      return { results: Array.from(tutorial._testResults), hints: shownHints(panel) };
    },
    /** TutorChat's hints for the given results, without a run (a backend whose results come from elsewhere). */
    hintsFor(results) {
      tutorial._testResults = results;
      context.TutorChat.onTestFailure(tutorial);
      return shownHints(panel);
    },
  };
}

// ---- Tests -----------------------------------------------------------------------------------------------------------

test('an object c4 condition shows its hint only when the predicate holds on the test snapshot', () => {
  const state = host({ tests: [SHOWS_POLICY] });
  const atStart = state.test();
  assert.deepEqual(atStart.results, [false]);
  assert.deepEqual(titles(atStart.hints), ['Ask which level answers the question', 'Zoom in further'],
    'the context view hides every component, and the policy is still there');

  state.edit(WITHOUT_POLICY.replace('view: context of registration', 'view: components of api'));
  const zoomedWithoutPolicy = state.test();
  assert.deepEqual(zoomedWithoutPolicy.results, [false]);
  assert.deepEqual(titles(zoomedWithoutPolicy.hints), ['Ask which level answers the question', 'Look for the policy'],
    'the component view shows the seat gateway, and the policy is gone');

  // Restoring the policy without testing again changes nothing: conditions read the snapshot of the last run.
  state.edit(DESIGN);
  assert.deepEqual(titles(state.hintsFor([false])), ['Ask which level answers the question', 'Look for the policy']);
  assert.deepEqual(state.errors, []);
});

test('string conditions keep working beside c4 conditions', () => {
  const check = {
    ...SHOWS_POLICY,
    hints: [hint('Name the view', 'code_missing: views:'), hint('Read the saved view', 'code_contains: who-decides'),
      hint('Zoom in further', VIEW_STOPS_EARLY)],
  };
  assert.deepEqual(titles(host({ tests: [check] }).test().hints), ['Read the saved view', 'Zoom in further']);
  assert.deepEqual(titles(host({ tests: [check], design: WITHOUT_VIEWS }).test().hints), ['Name the view']);
});

test('a c4 condition naming a deleted id is false without an author error', () => {
  const check = {
    ...SHOWS_POLICY,
    hints: [hint('Ask which level answers the question'),
      hint('Say what the policy decides', { c4: { exists: { responsibility: { of: 'policy', kind: 'decide' } } } }),
      hint('The policy decides nothing yet', { c4: { absent: { responsibility: { of: 'policy', kind: 'decide' } } } })],
  };
  const state = host({ tests: [check] });
  assert.deepEqual(titles(state.test().hints), ['Ask which level answers the question', 'Say what the policy decides']);

  state.edit(WITHOUT_POLICY);
  assert.deepEqual(titles(state.test().hints), ['Ask which level answers the question'],
    'neither exists nor absent holds for an element the model no longer has');
  assert.deepEqual(state.errors, [], 'an unresolved id in a hint condition is not an author error');
});

test('a selector naming a missing view in a condition is false and the other hints still show', () => {
  const check = {
    ...SHOWS_POLICY,
    hints: [hint('Ask which level answers the question'), hint('Zoom in further', VIEW_STOPS_EARLY),
      hint('Start from the policy', { c4: { exists: { element: { id: 'policy' } } } })],
  };
  const state = host({ tests: [check], design: WITHOUT_VIEWS });
  const run = state.test();
  assert.deepEqual(run.results, [false]);
  assert.deepEqual(titles(run.hints), ['Ask which level answers the question', 'Start from the policy']);
  assert.deepEqual(state.errors, [], 'a missing view in a hint condition is not an author error');
});

test('YAML errors show one Fix the YAML errors first card and no authored or fallback hints', () => {
  const kept = { description: 'The policy is kept', c4: { exists: { element: { id: 'policy' } } } };
  const state = host({ tests: [SHOWS_POLICY, kept], design: UNREADABLE });
  const run = state.test();
  assert.deepEqual(run.results, [null, null]);
  assert.equal(run.hints.length, 1, 'one card replaces every hint of the unchecked tests');
  assert.equal(run.hints[0].title, 'Fix the YAML errors first');
  assert.match(run.hints[0].body, /YAML/);
  assert.match(run.hints[0].body, /Test My Work/, 'the card says how to get the checks back');

  state.edit(DESIGN);
  assert.deepEqual(titles(state.test().hints), ['Ask which level answers the question', 'Zoom in further'],
    'a readable design brings the authored hints back');
});

test('a run that could not check the design shows no hints from an earlier snapshot', () => {
  const state = host({ tests: [SHOWS_POLICY], design: UNREADABLE });
  assert.equal(state.test().hints[0].title, 'Fix the YAML errors first');
  state.edit(DESIGN);
  state.tutorial._c4Snapshot = () => { throw new Error('the design could not be frozen'); };
  const run = state.test();
  assert.deepEqual(run.results, [null]);
  assert.deepEqual(run.hints, [], 'neither the earlier YAML card nor a condition on the earlier snapshot shows');
});

test('unchecked results of a backend without its own card keep their authored hints', () => {
  // AADL reports `?` when its analysis is unavailable; its hints are unchanged by the C4 card.
  const state = host({ backend: 'aadl', adapter: false, tests: [{ description: 'Latency within budget', hints: [hint('Trace the flow')] }] });
  assert.deepEqual(titles(state.hintsFor([null])), ['Trace the flow']);
});

test('a c4 condition without the C4 adapter is false and does not stop the other hints', () => {
  const state = host({ backend: 'aadl', adapter: false, tests: [{ description: 'Latency within budget',
    hints: [hint('Trace the flow'), hint('Only in C4 tutorials', VIEW_STOPS_EARLY)] }] });
  assert.deepEqual(titles(state.hintsFor([false])), ['Trace the flow']);
  assert.deepEqual(state.errors, []);
});
