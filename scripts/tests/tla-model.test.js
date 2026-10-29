const { test } = require('node:test');
const assert = require('node:assert/strict');
const model = import('../../js/tla/model.mjs');
const files = { 'Model.tla': '---- MODULE Model ----\nVARIABLE x\n====', 'Model.cfg': 'INIT Init\nNEXT Next' };

test('TLA snapshots select the authored entry regardless of the active editor and isolate later edits', async () => {
  const { snapshot, sameSnapshot } = await model;
  const mutable = { ...files, 'Helper.tla': '---- MODULE Helper ----\n====' };
  const captured = snapshot(mutable, { run_file: 'Model.tla', tla: { config_file: 'Model.cfg' } }, { config_file: 'Other.cfg' });
  mutable['Model.tla'] = 'edited';
  assert.equal(captured.files['Model.tla'], files['Model.tla']);
  assert.equal(captured.entry, 'Model.tla');
  assert.equal(captured.config, 'Model.cfg');
  assert.equal(sameSnapshot(captured, snapshot(mutable, { run_file: 'Model.tla' })), false);
});

test('unsafe paths and executable files never enter the Java workspace', async () => {
  const { snapshot } = await model;
  for (const name of ['../Escape.tla', '/Model.tla', 'override.class', 'Model.java', 'nested/Model.tla', 'A..tla']) {
    assert.throws(() => snapshot({ ...files, [name]: 'text' }, {}), /accept named/);
  }
  assert.throws(() => snapshot({ 'Model.tla': files['Model.tla'] }, {}), /configuration is missing/);
  assert.throws(() => snapshot(files, { run_file: 'Absent.tla' }), /entry module is missing/);
});

test('workspace budget counts UTF-8 bytes and file count', async () => {
  const { snapshot, LIMITS } = await model;
  assert.throws(() => snapshot({ ...files, 'Large.tla': 'é'.repeat(LIMITS.fileBytes / 2) }, {}), /1 MiB/);
  assert.throws(() => snapshot({ ...files, ...Object.fromEntries(Array.from({ length: 64 }, (_, i) => ['Module' + i + '.tla', ''])) }, {}), /64 files/);
});

test('both PlusCal syntaxes use the upstream translator while ordinary TLA stays unchanged', async () => {
  const { snapshot } = await model;
  for (const source of ['(* --algorithm Counter { } *)', '(* --fair algorithm Counter\nbegin\nend algorithm; *)']) {
    assert.equal(snapshot({ ...files, 'Model.tla': source }, {}).translatePlusCal, true);
  }
  assert.equal(snapshot(files, {}).translatePlusCal, false);
});

test('result display preserves value type distinctions, source locations, loops, and truncation', async () => {
  const { displayResult } = await model;
  const result = displayResult({ status: 'counterexample', reason: 'liveness', trace: { loopIndex: 0, truncated: true, states: [
    { values: [{ name: 'x', type: 'set', text: '{1, 2}' }] },
    { values: [{ name: 'x', type: 'tuple', text: '<<1, 2>>' }], location: { file: 'Model.tla', line: 9 } },
  ] }, outputTruncated: true }, { entry: 'Model.tla', config: 'Model.cfg', maxStates: 100000, maxTimeMs: 30000 });
  assert.equal(result.trace[0].variables[0].type, 'set');
  assert.equal(result.trace[1].variables[0].type, 'tuple');
  assert.equal(result.trace[1].variables[0].changed, true);
  assert.deepEqual(result.trace[1].location, { file: 'Model.tla', line: 9 });
  assert.equal(result.loopTo, 0);
  assert.equal(result.traceTruncated, true);
  assert.equal(result.outputTruncated, true);
  assert.match(result.scope, /Model.cfg/);
});

test('syntax success is never displayed as a successful model check', async () => {
  const { displayResult } = await model;
  assert.equal(displayResult({ status: 'complete', reason: 'parsed' }, { maxStates: 100, maxTimeMs: 1000 }).status, 'parsed');
});

test('authored check expectations distinguish violations from interruptions and fail closed on typos', async () => {
  const { assess } = await model;
  assert.equal(assess({ status: 'counterexample', reason: 'invariant' }, { status: 'counterexample', reason: 'invariant' }), true);
  assert.equal(assess({ status: 'counterexample', reason: 'deadlock' }, { status: 'counterexample', reason: 'invariant' }), false);
  assert.equal(assess({ status: 'counterexample' }, { status: 'complete' }), false);
  for (const status of ['error', 'incomplete']) assert.equal(assess({ status }, { status: 'complete' }), null);
  for (const expectation of [{ status: 'error' }, { status: 'complete', reasons: 'invariant' }, null]) {
    assert.throws(() => assess({ status: 'complete' }, expectation), /tla test needs/);
  }
});

test('wire version mismatch cannot be mistaken for a successful verification', async () => {
  const { validateResult } = await model;
  for (const result of [null, { version: 2, status: 'complete' }, { version: 1, status: 'passed' }]) {
    assert.throws(() => validateResult(result), /unsupported result/);
  }
});
