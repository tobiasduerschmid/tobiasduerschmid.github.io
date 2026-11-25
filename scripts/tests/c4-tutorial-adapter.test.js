// The C4 tutorial adapter (js/tutorial-c4.js, spec §11): configuration, the editor binding to the design file's
// Monaco model, locked fields on the YAML surface, and the after-submit gate. The real C4 core and the editor's
// lock rule run; the editor's DOM is replaced by a recording mount and Monaco by a small text model.
const test = require('node:test');
const { after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { chromiumLaunchOptions } = require('../chromium-launch-options');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '../..');
const C4 = require(path.join(ROOT, 'js/ArchUML/c4/c4-core.js'));
const editorStateModule = require(path.join(ROOT, 'js/ArchUML/c4/editor/c4-editor-state.js'));
const ADAPTER = fs.readFileSync(path.join(ROOT, 'js/tutorial-c4.js'), 'utf8');
const INTERFACE = ['_initC4', '_c4Snapshot', '_runTestsC4', '_c4EditorChanged', '_invalidateC4', '_evaluateC4Hint', '_hintForUncheckedTests'];

const STARTER = [
  'schema: c4-design/1',
  'name: Course Registration',
  'requirements:',
  '  FR-21: A student can enroll in a section only after passing its prerequisites.',
  'systems:',
  '  registration:',
  '    name: Course Registration',
  '',
].join('\n');

/** A Monaco text model reduced to what the adapter uses; every change reports to the tutorial's change hook. */
function textModel(initial, onChange) {
  let value = initial;
  const past = [];
  const future = [];
  const calls = { pushEditOperations: 0, undo: 0, setValue: 0 };
  const offsetAt = ({ lineNumber, column }) => {
    const lines = value.split('\n');
    return lines.slice(0, lineNumber - 1).reduce((sum, line) => sum + line.length + 1, 0) + column - 1;
  };
  const change = (next) => {
    value = next;
    onChange();
  };
  return {
    calls,
    getValue: () => value,
    // Monaco's setValue clears the undo stack, as here; the adapter must never call it for a learner's edit.
    setValue(next) { calls.setValue += 1; past.length = 0; future.length = 0; change(next); },
    getPositionAt(offset) {
      const before = value.slice(0, offset).split('\n');
      return { lineNumber: before.length, column: before[before.length - 1].length + 1 };
    },
    getFullModelRange() {
      const lines = value.split('\n');
      return { startLineNumber: 1, startColumn: 1, endLineNumber: lines.length, endColumn: lines[lines.length - 1].length + 1 };
    },
    pushEditOperations(_selections, operations) {
      calls.pushEditOperations += 1;
      const spans = operations.map((operation) => ({
        start: offsetAt({ lineNumber: operation.range.startLineNumber, column: operation.range.startColumn }),
        end: offsetAt({ lineNumber: operation.range.endLineNumber, column: operation.range.endColumn }),
        text: operation.text,
      })).sort((a, b) => b.start - a.start);
      past.push(value);
      future.length = 0;
      change(spans.reduce((text, span) => text.slice(0, span.start) + span.text + text.slice(span.end), value));
    },
    pushStackElement() {},
    /** A learner keystroke on the YAML surface: an undoable edit that is not the editor's. */
    type(next) { past.push(value); future.length = 0; change(next); },
    undo() { calls.undo += 1; if (past.length) { future.push(value); change(past.pop()); } },
    redo() { if (future.length) { past.push(value); change(future.pop()); } },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
  };
}

/** The tutorial host with the adapter installed, one step, and a recording editor mount. */
/**
 * The element the editor mounts in, inside a workspace column `columnPx` wide at a 16 px paragraph size: what the
 * adapter measures to choose how the outline starts.
 */
function editorHost(columnPx) {
  const view = { getComputedStyle: () => ({ fontSize: '16px' }) };
  return { ownerDocument: { defaultView: view }, parentElement: { clientWidth: columnPx } };
}

function host({ tutorialC4 = { file: 'design.yml', profile: 'novice' }, stepC4 = {}, steps, columnPx = 640 } = {}) {
  const errors = [];
  const context = {
    URL, setTimeout, clearTimeout,
    console: { error: (...args) => errors.push(args.join(' ')), log() {}, warn() {} },
    ArchUMLC4: C4,
    ArchUMLC4EditorParts: { state: editorStateModule },
    monaco: { Range: function (startLineNumber, startColumn, endLineNumber, endColumn) { Object.assign(this, { startLineNumber, startColumn, endLineNumber, endColumn }); } },
  };
  context.window = context;
  const mounts = [];
  context.ArchUMLC4Editor = {
    mount(element, options) {
      const editor = { options, setTextCalls: [], submitted: 0, destroyed: false };
      Object.assign(editor, {
        setText: (text, info) => editor.setTextCalls.push({ text, info }),
        submitForReview: () => { editor.submitted += 1; },
        destroy: () => { editor.destroyed = true; },
      });
      mounts.push(editor);
      return editor;
    },
  };
  context.TutorialCode = function () {};
  vm.runInNewContext(ADAPTER, context);
  const tutorial = new context.TutorialCode();
  let runTests = 0, autosaves = 0, saves = 0;
  const allSteps = steps || [{ c4: stepC4, files: [{ path: 'design.yml', content: STARTER }], tests: [{ description: 'Kept', c4: { same_as_seed: { id: 'registration' } } }] }];
  Object.assign(tutorial, {
    config: { backend: 'c4', c4: tutorialC4 }, steps: allSteps, currentStep: 0, setupCommands: [],
    _stepLoadSequence: 1, _stepsPassed: new Set([0]), _testResults: [true], _c4Host: editorHost(columnPx),
    editor: { options: {}, updateOptions(options) { Object.assign(this.options, options); }, layout() {} },
    root: { classList: { toggle() {} }, querySelectorAll: () => [] },
    stepContentEl: { querySelector: () => null }, stepControlsEl: { querySelector: () => null },
    _renderStepNav() {}, _refreshTestButton() {}, _isNextStepLocked: () => true,
    // The host's _runTests refuses a gated c4 run through the adapter before it runs anything.
    _autoSaveProgress() { autosaves += 1; }, _runTests() { if (!this._c4RefuseGatedRun()) runTests += 1; },
    _saveCurrentFile() { saves += 1; },
  });
  tutorial._buildC4Surface = () => {};
  const model = textModel(STARTER, () => tutorial._c4EditorChanged('design.yml'));
  tutorial.editorModels = { 'design.yml': { model } };
  return { context, tutorial, model, mounts, errors, runTests: () => runTests, autosaves: () => autosaves, saves: () => saves };
}

const lastEditor = (state) => state.mounts[state.mounts.length - 1];

// ---- Test controls as a browser reads them -----------------------------------------------------------------------

let browser = null;
after(async () => { if (browser) await browser.close(); });

/**
 * The step controls `html` builds, as a browser exposes them: each button's visible name, whether it is disabled,
 * and the text of the elements its aria-describedby names (its accessible description).
 */
async function controlsOf(html) {
  browser = browser || await chromium.launch(chromiumLaunchOptions());
  const page = await browser.newPage();
  try {
    await page.setContent(`<!doctype html><html lang="en"><title>Step controls</title><body><div class="tvm-step-controls">${html}</div></body></html>`);
    return await page.evaluate(() => [...document.querySelectorAll('button')].map((button) => ({
      name: button.textContent.trim(),
      disabled: button.disabled,
      description: (button.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean)
        .map((id) => (document.getElementById(id) || { textContent: '' }).textContent.trim()).join(' '),
    })));
  } finally {
    await page.close();
  }
}

const named = (controls, pattern) => controls.find((control) => pattern.test(control.name));

test('install adds the backend methods once', () => {
  const state = host();
  const prototype = state.context.TutorialCode.prototype;
  const before = INTERFACE.map((name) => prototype[name]);
  state.context.TutorialC4.install(state.context.TutorialCode);
  INTERFACE.forEach((name, index) => {
    assert.equal(typeof prototype[name], 'function', `${name} is installed`);
    assert.equal(prototype[name], before[index], `${name} is not replaced by a second install`);
  });
});

test('step c4 configuration merges over the tutorial key by key and scaffolds and checks by sub-key', () => {
  const { effectiveConfig } = host().context.TutorialC4;
  const merged = effectiveConfig(
    { file: 'design.yml', profile: 'novice', scaffolds: { definitions: true, sentenceFrames: true }, checks: { honorFileIgnores: false, display: 'live' } },
    { view: 'containers of registration', scaffolds: { sentenceFrames: false }, checks: { display: 'on-request' } },
  );
  assert.equal(merged.file, 'design.yml');
  assert.equal(merged.profile, 'novice');
  assert.equal(merged.view, 'containers of registration');
  assert.deepEqual({ ...merged.scaffolds }, { definitions: true, sentenceFrames: false });
  assert.deepEqual({ ...merged.checks }, { honorFileIgnores: false, display: 'on-request' });
});

test('unknown keys under c4.scaffolds or c4.checks are author errors', () => {
  const state = host({ stepC4: { scaffolds: { sentence_frames: false }, checks: { severities: {} } } });
  assert.throws(() => state.tutorial._initC4(), (error) => /Step 1: unknown key c4\.scaffolds\.sentence_frames/.test(error.message)
    && /Step 1: unknown key c4\.checks\.severities/.test(error.message));
  assert.equal(state.errors.length, 1, 'the author error also reaches the console');
  assert.match(state.errors[0], /sentence_frames/);
});

test('an unknown key at the top of a c4 block is an author error too', () => {
  const state = host({ tutorialC4: { file: 'design.yml', lockedFields: ['requirements'] } });
  assert.throws(() => state.tutorial._initC4(), /Tutorial: unknown key c4\.lockedFields/);
});

test('the editor binds to design.yml and writes undoable edits to its Monaco model', () => {
  const state = host();
  state.tutorial._loadC4Step(0);
  const editor = lastEditor(state);
  assert.equal(editor.options.text, STARTER);
  assert.equal(editor.options.sourceEditor, false);
  assert.equal(editor.options.host.undo, 'host');
  assert.equal(editor.options.profile, 'novice');

  const edited = STARTER.replace('name: Course Registration\nrequirements', 'name: Enrollment\nrequirements');
  const offset = STARTER.indexOf('Course Registration');
  editor.options.host.onTextChange(edited, { reason: 'edit', edits: [{ offset, length: 'Course Registration'.length, text: 'Enrollment' }], version: 1 });
  assert.equal(state.model.getValue(), edited, 'the splice lands in the model');
  assert.equal(state.model.calls.pushEditOperations, 1);
  assert.deepEqual(editor.setTextCalls, [], 'the editor\'s own change is not sent back to it');
  assert.equal(state.tutorial._stepsPassed.has(0), false, 'an edit withdraws the step\'s credit');
  assert.equal(state.autosaves(), 1);

  assert.equal(editor.options.host.canUndo(), true);
  editor.options.host.performUndo();
  assert.equal(state.model.getValue(), STARTER, 'Undo in the canvas undoes the model');
  assert.equal(editor.setTextCalls.at(-1).text, STARTER, 'and the editor shows the undone text');
});

// Final review I7: the drawing gets the workspace pane's height ('fill'), and its width in a column where the outline
// would take a column of the drawing's row or a row above it (narrower than 60em).
test('the editor fills the workspace pane, its outline collapsed in a column narrower than 60em', () => {
  const at = (columnPx) => {
    const state = host({ columnPx });
    state.tutorial._loadC4Step(0);
    return lastEditor(state).options;
  };
  assert.equal(at(640).size, 'fill');
  assert.equal(at(640).outline, 'collapsed', 'a 40em column (a laptop\'s workspace)');
  assert.equal(at(959).outline, 'collapsed', 'just under 60em');
  assert.equal(at(960).outline, 'open', 'at 60em the outline keeps its column and the drawing still has room');
});

test('Reset and Show Solution replace the text and re-render without an echo', () => {
  const state = host();
  state.tutorial._loadC4Step(0);
  const editor = lastEditor(state);
  const solution = STARTER.replace('systems:', 'people:\n  student:\n    name: Student\nsystems:');
  state.tutorial._suppressAutoSave = true; // openFile during Reset, Show Solution, and restore
  state.model.setValue(solution);
  state.tutorial._suppressAutoSave = false;
  assert.deepEqual(editor.setTextCalls.map((call) => [call.text, call.info.reason]), [[solution, 'external']]);
  assert.equal(state.model.calls.pushEditOperations, 0, 'the editor writes nothing back');
  assert.equal(state.tutorial._stepsPassed.has(0), true, 'a programmatic restore keeps saved completion');
});

test('YAML typed on the YAML surface reaches the editor after it settles', () => {
  const state = host();
  state.tutorial._loadC4Step(0);
  const typed = STARTER.replace('    name: Course Registration\n', '    name: Course Registration\n    description: Plans terms.\n');
  state.model.type(typed);
  assert.deepEqual(lastEditor(state).setTextCalls, [], 'typing waits for a pause');
  state.tutorial._flushC4Yaml();
  assert.deepEqual(lastEditor(state).setTextCalls.map((call) => call.text), [typed]);
});

test('an edit on the YAML surface that changes a locked path is reverted with a visible message', () => {
  const state = host({ stepC4: { locked_fields: ['requirements'] } });
  const shown = [];
  state.tutorial._setC4Status = (message) => shown.push(message);
  state.tutorial._loadC4Step(0);
  state.model.type(STARTER.replace('only after passing its prerequisites', 'whenever'));
  state.tutorial._flushC4Yaml();
  assert.equal(state.model.getValue(), STARTER, 'the locked requirement is restored');
  assert.equal(shown.at(-1), 'Locked: requirements.FR-21 or a part of it is given by the task, so your change was undone here.');
  assert.equal(lastEditor(state).setTextCalls.some((call) => call.text.includes('whenever')), false);

  const unlocked = STARTER.replace('    name: Course Registration\n', '    name: Registration\n');
  state.model.type(unlocked);
  state.tutorial._flushC4Yaml();
  assert.equal(state.model.getValue(), unlocked, 'an edit outside the lock stays');
});

test('a locked part changed while the YAML could not be read is still restored', () => {
  const state = host({ stepC4: { locked_fields: ['requirements'] } });
  state.tutorial._setC4Status = () => {};
  state.tutorial._loadC4Step(0);
  state.model.type(STARTER.replace('name: Course Registration\nrequirements', 'name: [Course\nrequirements'));
  state.tutorial._flushC4Yaml();
  state.model.type(STARTER.replace('FR-21:', 'FR-99:'));
  state.tutorial._flushC4Yaml();
  assert.equal(state.model.getValue(), STARTER);
});

test('read_only opens the editor read-only', () => {
  const state = host({ stepC4: { read_only: true, view: 'context of registration' } });
  state.tutorial._loadC4Step(0);
  assert.equal(lastEditor(state).options.readOnly, true);
  assert.equal(lastEditor(state).options.view, 'context of registration');
  assert.equal(state.tutorial.editor.options.readOnly, true, 'the YAML surface is read-only as well');
});

test('under after-submit, Test My Work and Ctrl/Cmd+Enter wait for Submit for review', async () => {
  const state = host({ stepC4: { checks: { display: 'after-submit' } } });
  const statuses = [];
  let navBroadcasts = 0;
  state.tutorial._setC4Status = (message) => statuses.push(message);
  state.tutorial._popoutManager = {};
  state.tutorial._broadcastNavState = () => { navBroadcasts += 1; };
  state.tutorial._loadC4Step(0);
  const reason = 'Submit for review first; Test My Work opens after that.';
  const STANDARD = '<button class="tvm-btn tvm-btn-test">✓ Test My Work</button>';
  const gated = await controlsOf(state.tutorial._c4TestControlsHTML(0, [STANDARD]));
  assert.deepEqual(named(gated, /^Submit for review$/), { name: 'Submit for review', disabled: false, description: '' });
  assert.deepEqual(named(gated, /Test My Work/), { name: '✓ Test My Work', disabled: true, description: reason },
    'Test My Work waits, and says why in its description');
  assert.deepEqual({ ...state.tutorial._c4TestGate() }, { reason, actionLabel: 'Submit for review' }, 'the gate the popout shows');
  state.tutorial._c4RequestTests();
  assert.equal(state.runTests(), 0);
  assert.equal(statuses[statuses.length - 1], reason, 'a refused run says why');

  state.tutorial._submitC4ForReview({ keepFocus: true });
  assert.equal(lastEditor(state).submitted, 1);
  assert.equal(navBroadcasts, 1, 'the popout learns the gate opened');
  assert.equal(state.tutorial._c4TestGate(), null);
  const open = await controlsOf(state.tutorial._c4TestControlsHTML(0, [STANDARD]));
  assert.deepEqual(open.map((control) => [control.name, control.disabled]), [['Submit for review', false], ['✓ Test My Work', false]]);
  state.tutorial._c4RequestTests();
  assert.equal(state.runTests(), 1);

  state.tutorial._loadC4Step(0);
  state.tutorial._c4RequestTests();
  assert.equal(state.runTests(), 1, 'a new step visit asks for a new review');
});

test('under on-request, Ctrl/Cmd+Enter runs Test My Work, not Check now', () => {
  const state = host({ stepC4: { checks: { display: 'on-request' } } });
  state.tutorial._loadC4Step(0);
  assert.equal(state.tutorial._c4TestControlsHTML(0, ['<button>✓ Test My Work</button>']), null, 'the ordinary Test My Work button');
  state.tutorial._c4RequestTests();
  assert.equal(state.runTests(), 1);
  assert.equal(lastEditor(state).submitted, 0);
});

test('the effective scaffolds, checks, locked fields, and reveal of the step reach the editor', () => {
  const state = host({
    tutorialC4: { file: 'design.yml', profile: 'novice', scaffolds: { definitions: true, sentenceFrames: true }, checks: { honorFileIgnores: false } },
    stepC4: { scaffolds: { sentenceFrames: false }, checks: { display: 'on-request' }, locked_fields: ['requirements'], reveal: 'on-request' },
  });
  state.tutorial._loadC4Step(0);
  const { options } = lastEditor(state);
  assert.deepEqual({ ...options.scaffolds }, { definitions: true, sentenceFrames: false });
  assert.deepEqual({ ...options.checks }, { honorFileIgnores: false, display: 'on-request' });
  assert.deepEqual([...options.lockedFields], ['requirements'], 'the visual editor refuses locked edits too');
  assert.equal(options.reveal, 'on-request');
});

test('the editor\'s keys and its Submit for review reach the tutorial through the host contract', () => {
  const state = host({ stepC4: { checks: { display: 'after-submit' } } });
  state.tutorial._setC4Status = () => {};
  state.tutorial._loadC4Step(0);
  const editorHost = lastEditor(state).options.host;

  editorHost.onRequestSave();
  assert.equal(state.saves(), 1, 'Ctrl/Cmd+S in the editor saves the design file');
  editorHost.onRequestCheck();
  assert.equal(state.runTests(), 0, 'Ctrl/Cmd+Enter waits for Submit for review like the button');

  editorHost.onSubmitForReview([]);
  assert.equal(state.tutorial._c4TestGate(), null, 'the Problems panel\'s Submit for review opens Test My Work');
  assert.equal(lastEditor(state).submitted, 0, 'the editor already released its diagnostics; it is not asked again');
  editorHost.onRequestCheck();
  assert.equal(state.runTests(), 1);
});

test('after-submit steps keep the failed-run cooldown and its I\'m sure path once submitted', async () => {
  const storage = new Map([['tutorial-cooldown-c4', JSON.stringify({ 0: Date.now() + 60000 })]]);
  const tutorial = sharedHost({
    tutorialId: 'c4', cooldownSeconds: 60, steps: [{ c4: { checks: { display: 'after-submit' } }, files: [], tests: [{ c4: {} }] }],
  }, { localStorage: { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) } });
  tutorial.currentStep = 0;

  const gated = await controlsOf(tutorial._buildTestButtonHTML(0));
  assert.deepEqual(gated.map((control) => [control.name, control.disabled]), [['Submit for review', false], ['✓ Test My Work', true]],
    'before Submit for review, the gate explains the wait');

  tutorial._markC4Submitted();
  const cooling = await controlsOf(tutorial._buildTestButtonHTML(0));
  assert.equal(named(cooling, /^Submit for review$/).disabled, false);
  assert.equal(named(cooling, /Test My Work/).disabled, true, 'the visible run waits for the cooldown');
  assert.match(named(cooling, /Test My Work/).name, /\(\d+:\d\d\)/, 'and shows the time left');
  assert.equal(named(cooling, /I.m sure/).disabled, false, 'the silent run is available as on every other step');
});

test('an editor change whose splices do not give its text still lands as one undoable model edit, and is reported', () => {
  const state = host();
  state.tutorial._loadC4Step(0);
  const edited = STARTER.replace('name: Course Registration\nrequirements', 'name: Enrollment\nrequirements');
  lastEditor(state).options.host.onTextChange(edited, { reason: 'edit', edits: [{ offset: 0, length: 0, text: 'wrong' }], version: 1 });
  assert.equal(state.model.getValue(), edited, 'the model holds the editor\'s text');
  assert.equal(state.model.calls.setValue, 0, 'setValue would clear the learner\'s undo history');
  state.model.undo();
  assert.equal(state.model.getValue(), STARTER, 'one undo takes the change back');
  assert.match(state.errors.join('\n'), /splices/i, 'the mismatch reaches the console');
});

test('the lock and review status line clears on the next settled edit and on a surface switch', () => {
  const state = host({ stepC4: { locked_fields: ['requirements'] } });
  const shown = [];
  state.tutorial._setC4Status = (message) => shown.push(message);
  state.tutorial._loadC4Step(0);
  state.model.type(STARTER.replace('only after passing its prerequisites', 'whenever'));
  state.tutorial._flushC4Yaml();
  assert.match(shown.at(-1), /^Locked:/);
  state.model.type(STARTER.replace('    name: Course Registration\n', '    name: Registration\n'));
  state.tutorial._flushC4Yaml();
  assert.equal(shown.at(-1), '', 'an accepted edit clears it');

  state.model.type(STARTER.replace('only after passing its prerequisites', 'whenever'));
  state.tutorial._flushC4Yaml();
  assert.match(shown.at(-1), /^Locked:/);
  state.tutorial._showC4Surface('visual');
  assert.equal(shown.at(-1), '', 'a surface switch clears it');
});

test('a locked change on the YAML surface is undone alone: other edits typed with it stay', () => {
  const state = host({ stepC4: { locked_fields: ['requirements'] } });
  const shown = [];
  state.tutorial._setC4Status = (message) => shown.push(message);
  state.tutorial._loadC4Step(0);
  const renamed = STARTER.replace('    name: Course Registration\n', '    name: Registration\n');
  state.model.type(renamed.replace('only after passing its prerequisites', 'whenever'));
  state.tutorial._flushC4Yaml();
  assert.equal(state.model.getValue(), renamed, 'the requirement is restored and the rename stays');
  assert.equal(lastEditor(state).setTextCalls.at(-1).text, renamed, 'the editor shows the kept rename');
  assert.equal(shown.at(-1), state.context.ArchUMLC4EditorParts.state.lockedSentence('requirements.FR-21', 'your change was undone'),
    'the sentence every surface uses for a lock');
  assert.equal(state.model.calls.setValue, 0);
});

test('when a locked part cannot be restored alone, every edit since the last readable text is undone and named', () => {
  const state = host({ stepC4: { locked_fields: ['requirements'] } });
  const shown = [];
  state.tutorial._setC4Status = (message) => shown.push(message);
  state.tutorial._loadC4Step(0);
  // The requirements block is deleted, so there is no node to restore it into.
  const withoutRequirements = STARTER.replace(/requirements:\n.*\n/, '').replace('    name: Course Registration\n', '    name: Registration\n');
  state.model.type(withoutRequirements);
  state.tutorial._flushC4Yaml();
  assert.equal(state.model.getValue(), STARTER);
  assert.match(shown.at(-1), /^Locked: requirements or a part of it is given by the task/);
  assert.match(shown.at(-1), /systems\.registration\.name/, 'the learner learns which other edit was undone');
});

test('Test My Work grades a frozen copy of the model against the step\'s authored starter', () => {
  const state = host();
  state.tutorial._loadC4Step(0);
  let rendered;
  state.tutorial._renderTestResults = (tests, results, run) => { rendered = { results: Array.from(results), details: Array.from(run.c4Details) }; };
  state.tutorial._runTestsC4({ stepIndex: 0 });
  assert.deepEqual(rendered.results, [true]);
  state.model.type(STARTER.replace('    name: Course Registration\n', '    name: Somewhere Else\n'));
  state.tutorial._runTestsC4({ stepIndex: 0 });
  assert.deepEqual(rendered.results, [false]);
  state.model.type('schema: c4-design/1\nname: [\n');
  state.tutorial._runTestsC4({ stepIndex: 0 });
  assert.deepEqual(rendered.results, [null]);
  assert.deepEqual(rendered.details, ['Fix the YAML errors first']);
});

/** The shared tutorial host (js/tutorial-code.js) with the C4 adapter installed, as the tutorial layout loads them. */
function sharedHost(options = {}, globals = {}) {
  const context = {
    document: { cookie: '', documentElement: { classList: { contains: () => false } } },
    console, URL, AbortController, TextEncoder, setTimeout, clearTimeout, clearInterval, ...globals,
  };
  context.window = context;
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/tutorial-code.js'), 'utf8'), context);
  vm.runInNewContext(ADAPTER, context);
  return new context.TutorialCode({ querySelector: () => null }, {
    backend: 'c4', c4: { file: 'design.yml' }, steps: [{ files: [] }], ...options,
  });
}

test('the shared tutorial host keeps the C4 configuration and rejects mixed lessons', () => {
  assert.equal(sharedHost().config.c4.file, 'design.yml');
  assert.throws(() => sharedHost({ backend: 'multiple', steps: [{ backend: 'c4' }, { backend: 'pyodide' }] }), /single.backend/i);
});

test('the shared Run action has no program to run in a C4 workspace', async () => {
  const tutorial = sharedHost();
  tutorial.currentStep = 0;
  assert.equal(await tutorial._executeCurrentFileRun({ stepIndex: 0, step: tutorial.steps[0], runFiles: [], filename: 'design.yml' }), false);
});

// ---- Grading (spec §8; Task 2) ---------------------------------------------------------------------------------

/** Runs the step's tests and returns what reached the shared result renderer. */
function grade(state) {
  let rendered = null;
  state.tutorial._renderTestResults = (tests, results, run) => {
    rendered = { results: Array.from(results), details: Array.from(run.c4Details) };
  };
  state.tutorial._runTestsC4({ stepIndex: 0 });
  return rendered;
}

function gradingHost(tests, stepC4 = {}) {
  return host({ steps: [{ c4: stepC4, files: [{ path: 'design.yml', content: STARTER }], tests }] });
}

const AUTHOR_ERROR = /error in the tutorial/;

test('the step\'s checks configuration applies before a checks predicate\'s own filters', () => {
  const tests = [{ description: 'No C4 warnings', c4: { checks: { max_warnings: 0, categories: ['c4'] } } }];
  const plain = gradingHost(tests);
  plain.tutorial._loadC4Step(0);
  assert.deepEqual(grade(plain).results, [false], 'the starter has two C4 warnings');

  const configured = gradingHost(tests, { checks: { disable: ['c4/no-description', 'c4/isolated-element'] } });
  configured.tutorial._loadC4Step(0);
  assert.deepEqual(grade(configured).results, [true], 'the step disables both rules');
});

test('same_as_seed compares with the step\'s authored starter, also when the saved text differs at step entry', () => {
  const state = host();
  // A restored draft: the file already differs from the starter when the step opens.
  state.model.setValue(STARTER.replace('    name: Course Registration\n', '    name: Somewhere Else\n'));
  state.tutorial._loadC4Step(0);
  assert.deepEqual(grade(state).results, [false]);

  state.tutorial._suppressAutoSave = true; // Reset writes the starter back
  state.model.setValue(STARTER);
  state.tutorial._suppressAutoSave = false;
  assert.deepEqual(grade(state).results, [true]);
});

test('a selector naming a missing view or element fails as a learner failure, not an author error', () => {
  const withView = (selector) => `${STARTER}views:\n  who-decides:\n    view: ${selector}\n`;
  const tests = [{ description: 'The saved view who-decides shows the system', c4: { view: { view: 'who-decides', shows: ['registration'] } } }];
  const state = gradingHost(tests);
  state.tutorial._loadC4Step(0);
  assert.deepEqual(grade(state), { results: [false], details: ['No view named who-decides yet'] });

  state.model.setValue(withView('components of API'));
  assert.deepEqual(grade(state).results, [false]);
  assert.match(grade(state).details[0], /no element named API/);

  state.model.setValue(withView('context of registration'));
  assert.deepEqual(grade(state).results, [true]);
  assert.deepEqual(state.errors, [], 'nothing is reported as an author error');
});

test('an author error fails its check with a plain message and names the error in the console', () => {
  const state = gradingHost([
    { description: 'Misspelled assertion', c4: { exist: { element: { id: 'registration' } } } },
    { description: 'Malformed selector', c4: { view: { view: 'components of', shows: ['registration'] } } },
    { description: 'Still graded', c4: { exists: { element: { id: 'registration' } } } },
  ]);
  state.tutorial._loadC4Step(0);
  const { results, details } = grade(state);
  assert.deepEqual(results, [false, false, true]);
  assert.match(details[0], AUTHOR_ERROR);
  assert.match(details[1], AUTHOR_ERROR);
  assert.doesNotMatch(details[0], /exist|did you mean/, 'the learner is not shown the author\'s mistake');
  assert.equal(state.errors.length, 2);
  assert.match(state.errors[0], /Misspelled assertion.*Unknown key exist in a predicate; did you mean exists\?/);
  assert.match(state.errors[1], /Malformed selector.*not a view selector/);
});

test('a check that throws fails alone and the other checks keep their results', () => {
  const state = gradingHost([
    { description: 'Breaks the evaluator', c4: { exists: { element: { id: 'boom' } } } },
    { description: 'Still graded', c4: { exists: { element: { id: 'registration' } } } },
  ]);
  const real = state.context.ArchUMLC4.query;
  state.context.ArchUMLC4 = Object.assign({}, C4, {
    query: {
      validate: real.validate,
      evaluate(design, predicate, context) {
        if (predicate.exists.element.id === 'boom') throw new TypeError('evaluator defect');
        return real.evaluate(design, predicate, context);
      },
    },
  });
  state.tutorial._loadC4Step(0);
  const { results, details } = grade(state);
  assert.deepEqual(results, [false, true]);
  assert.match(details[0], /could not run/);
  assert.match(state.errors.join('\n'), /evaluator defect/);
});

test('a learner sees only missing-selector messages under a check, never the core\'s diagnostics', () => {
  const yaml = require('js-yaml');
  const tutorials = ['c4.yml', 'c4-interfaces.yml'].map((name) => path.join(ROOT, '_data/tutorials', name)).filter(fs.existsSync);
  const fileOf = (files, name) => ((files || []).find((file) => file.path === name) || {}).content;
  let graded = 0;
  for (const tutorialPath of tutorials) {
    const tutorial = yaml.load(fs.readFileSync(tutorialPath, 'utf8'));
    const file = (tutorial.c4 && tutorial.c4.file) || 'design.yml';
    tutorial.steps.forEach((step, number) => {
      if (!(step.tests || []).some((check) => check.c4)) return;
      const seed = fileOf(step.files, file);
      for (const [label, text] of [['seed', seed], ['solution', fileOf(step.solution && step.solution.files, file)]]) {
        if (text === undefined) continue;
        const state = host({ tutorialC4: tutorial.c4, steps: [{ ...step, files: [{ path: file, content: seed }] }] });
        state.tutorial.editorModels = { [file]: { model: state.model } };
        state.model.setValue(text);
        state.tutorial._loadC4Step(0);
        const { results, details } = grade(state);
        const where = `${path.basename(tutorialPath)} step ${number + 1} ${label}`;
        details.forEach((detail, index) => {
          assert.doesNotMatch(detail, /\{"/, `${where}, check ${index + 1}: no serialised predicate`);
          if (results[index] === true) assert.equal(detail, '', `${where}, check ${index + 1}: a passing check has no detail`);
        });
        graded += 1;
      }
    });
  }
  assert.ok(graded > 0, 'the tutorials have graded steps');
});

test('a missing scenario, environment, or saved-view selector keeps the core\'s learner message', () => {
  const state = gradingHost([
    { description: 'The enroll scenario exists', c4: { view: { view: 'dynamic enroll', shows: ['registration'] } } },
    { description: 'A missing element id', c4: { exists: { element: { id: 'sys-eligibility', name_any: ['Eligibility'] } } } },
  ]);
  state.tutorial._loadC4Step(0);
  const { results, details } = grade(state);
  assert.deepEqual(results, [false, false]);
  assert.equal(details[0], 'No scenario named enroll yet');
  assert.equal(details[1], '', 'a failure that is not a missing selector shows no detail');
});
