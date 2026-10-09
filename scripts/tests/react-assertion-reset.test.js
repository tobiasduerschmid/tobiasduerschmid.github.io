const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const sandbox = { window: {}, console: { warn() {} } };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../js/tutorial-code.js'), 'utf8'), sandbox);

// Replace the browser transport at its boundary; assertions mutate a simulated
// preview document, just as an interactive check changes a game's board.
function previewHarness(resetBetweenTests) {
  const tutorial = Object.create(sandbox.window.TutorialCode.prototype);
  tutorial.currentStep = 0;
  tutorial.steps = [{ react_reset_between_tests: resetBetweenTests }];
  let previewValue;
  tutorial._rebuildReactPreview = ready => { previewValue = 0; ready(); };
  tutorial._getReactAssertionContext = () => ({});
  tutorial._runReactAssertionInPreview = async check => {
    assert.equal(previewValue, check.before);
    previewValue = check.after;
    if (check.fail) throw new Error('Deliberately failing check');
  };
  return tutorial;
}

test('opted-in React checks start fresh even after an earlier check fails', async () => {
  const results = await previewHarness(true)._runReactAssertionTests([
    { before: 0, after: 1 },
    { before: 0, after: 2, fail: true },
    { before: 0, after: 3 },
  ]);
  assert.deepEqual(Array.from(results), [true, false, true]);
});

test('existing React checks keep their shared preview by default', async () => {
  const results = await previewHarness(undefined)._runReactAssertionTests([
    { before: 0, after: 1 },
    { before: 1, after: 2 },
  ]);
  assert.deepEqual(Array.from(results), [true, true]);
});

test('leaving a step stops its remaining checks before replacing the new preview', async () => {
  const tutorial = previewHarness(true);
  const check = tutorial._runReactAssertionInPreview;
  tutorial._runReactAssertionInPreview = async assertion => {
    await check(assertion);
    tutorial.currentStep = 1;
  };
  const results = await tutorial._runReactAssertionTests([
    { before: 0, after: 1 },
    { before: 0, after: 2 },
  ]);
  assert.deepEqual(Array.from(results), [true]);
});
