const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/aadl-budget-result.json'), 'utf8'));
const modules = Promise.all([import('../../js/aadl/model.mjs'), import('../../js/aadl/assessment.mjs')]);

async function host(execute = async () => structuredClone(fixture)) {
  const [model, assessment] = await modules;
  const context = { URL, console, document: { currentScript: { src: 'https://example.test/js/tutorial-aadl.js' } } };
  context.window = context;
  context.TutorialCode = function () {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../js/tutorial-aadl.js'), 'utf8'), context);
  const tutorial = new context.TutorialCode();
  let source = 'package Example public system Loop end Loop; end Example;';
  let runs = 0, schedules = 0, rendered;
  Object.assign(tutorial, {
    config: { aadl: { root: 'Rover_Budget::Loop.budget' } }, currentStep: 0, _stepLoadSequence: 1,
    steps: [{ tests: [
      { aadl: { fixture: 'rover-budget-v1', criterion: 'complete-budget' } },
      { aadl: { fixture: 'rover-budget-v1', criterion: 'tight-bound' } },
    ] }],
    editorModels: { 'model.aadl': { model: { getValue: () => source } } },
    _aadlModel: model, _aadlAssessment: assessment,
    _aadlController: { run: async operation => { assert.equal(operation, 'analyze'); runs++; return execute(); }, markStale() {}, schedule() { schedules++; } },
    _showTestPanel() {}, _setRunTransactionControls() {}, _appendOutput() {},
    _renderTestResults(tests, results, run) { rendered = { results: Array.from(results), details: Array.from(run.aadlDetails), load: run.aadlLoad }; },
    _stepsPassed: new Set([0]), _testResults: [true],
    stepContentEl: { querySelector: () => null }, stepControlsEl: { querySelector: () => null },
    _renderStepNav() {}, _refreshTestButton() {}, _autoSaveProgress() {},
  });
  return { tutorial, changeSource() { source += '\n-- edited'; }, result: () => rendered, runs: () => runs, schedules: () => schedules };
}

test('all AADL exercise criteria share one official analysis result', async () => {
  const state = await host();
  await state.tutorial._runTestsAADL({ stepIndex: 0 });
  assert.equal(state.runs(), 1);
  assert.deepEqual(state.result().results, [true, false]);
  assert.match(state.result().details[1], /22 ms/);
});

test('an editor change during analysis cannot award exercise credit', async () => {
  let finish;
  const state = await host(() => new Promise(resolve => { finish = resolve; }));
  const pending = state.tutorial._runTestsAADL({ stepIndex: 0 });
  state.changeSource();
  finish(structuredClone(fixture));
  await pending;
  assert.deepEqual(state.result().results, [null, null]);
  assert.match(state.result().details[0], /changed|interrupted/i);
});

test('a step replacement during analysis cannot award the old submission credit', async () => {
  let finish;
  const state = await host(() => new Promise(resolve => { finish = resolve; }));
  const pending = state.tutorial._runTestsAADL({ stepIndex: 0 });
  state.tutorial._stepLoadSequence++;
  finish(structuredClone(fixture));
  await pending;
  assert.deepEqual(state.result().results, [null, null]);
  assert.equal(state.result().load, 1);
});

test('programmatic restore preserves saved completion and waits for workspace readiness', async () => {
  const state = await host();
  state.tutorial._suppressAutoSave = true;
  state.tutorial._aadlEditorChanged();
  assert.equal(state.tutorial._stepsPassed.has(0), true);
  assert.equal(state.schedules(), 0);
});

test('student editing invalidates completion and schedules fresh validation', async () => {
  const state = await host();
  state.tutorial._aadlEditorChanged();
  assert.equal(state.tutorial._stepsPassed.has(0), false);
  assert.deepEqual(Array.from(state.tutorial._testResults), []);
  assert.equal(state.schedules(), 1);
});

test('root selection overrides only the current snapshot, not authored configuration', async () => {
  const state = await host();
  state.tutorial._aadlRootOverride = 'Campus_Rover::Rover.single_cpu';
  assert.equal(state.tutorial._aadlSnapshot().root, 'Campus_Rover::Rover.single_cpu');
  assert.equal(state.tutorial.config.aadl.root, 'Rover_Budget::Loop.budget');
});

function sharedHost(options = {}) {
  const context = {
    document: { cookie: '', documentElement: { classList: { contains: () => false } } },
    console, URL, AbortController, TextEncoder, setTimeout, clearTimeout, clearInterval,
  };
  context.window = context;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../js/tutorial-code.js'), 'utf8'), context);
  return new context.TutorialCode({ querySelector: () => null }, {
    backend: 'aadl', aadl: { root: 'Rover_Budget::Loop.budget' }, steps: [{ files: [] }], ...options,
  });
}

test('the shared tutorial host preserves AADL configuration and rejects mixed runtime lessons', () => {
  assert.equal(sharedHost().config.aadl.root, 'Rover_Budget::Loop.budget');
  assert.throws(() => sharedHost({ backend: 'multiple', steps: [{ backend: 'aadl' }, { backend: 'pyodide' }] }), /single.backend/i);
});

test('the shared Run action dispatches the AADL architecture operation', async () => {
  const tutorial = sharedHost();
  tutorial.currentStep = 0;
  tutorial._runAADL = async () => true;
  assert.equal(await tutorial._executeCurrentFileRun({ stepIndex: 0, step: tutorial.steps[0], runFiles: [], filename: 'model.aadl' }), true);
});

test('the shared Stop action cancels the architecture controller', () => {
  const tutorial = sharedHost();
  let stopped = false;
  tutorial._aadlController = { stop() { stopped = true; } };
  tutorial._stopExecution();
  assert.equal(stopped, true);
});

test('clearing tutorial output clears the architecture result too', () => {
  const tutorial = sharedHost();
  let cleared = false;
  tutorial._aadlController = { reset() { cleared = true; } };
  tutorial._clearOutput();
  assert.equal(cleared, true);
});
