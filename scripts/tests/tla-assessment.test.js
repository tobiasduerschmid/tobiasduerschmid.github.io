const { test } = require('node:test');
const assert = require('node:assert/strict');
const assessment = import('../../js/tla/assessment.mjs');
const model = import('../../js/tla/model.mjs');
const files = {
  'Model.tla': '---- MODULE Model ----\nVARIABLE count\nInit == count = 0\nNext == count < 2 /\\ count\' = count + 1\n====',
  'Model.cfg': 'INIT Init\nNEXT Next\nCHECK_DEADLOCK FALSE'
};
const invariantTest = { status: 'complete', invariant: 'count < 2', model_config: 'INIT Init\nNEXT Next\nCHECK_DEADLOCK FALSE' };
const learner = async () => (await model).snapshot(files, {});

test('legacy outcome checks receive an independent snapshot and keep their selected configuration', async () => {
  const { buildCheck } = await assessment;
  const source = await learner();
  const request = buildCheck(source, { status: 'counterexample', reason: 'deadlock' });
  assert.equal(request.operation, 'check');
  assert.equal(request.entry, source.entry);
  assert.equal(request.config, source.config);
  request.files['Model.tla'] = 'changed after submission';
  assert.equal(source.files['Model.tla'], files['Model.tla']);
});

test('instructor invariants use trusted configuration even when the learner removes their own checks', async () => {
  const { buildCheck } = await assessment;
  const source = await learner();
  source.files['Model.cfg'] = 'INIT Init\nNEXT Next\nCONSTRAINT FALSE';
  source.checkDeadlock = false;
  const request = buildCheck(source, invariantTest);
  assert.notEqual(request.config, source.config);
  assert.equal(request.files[request.config], invariantTest.model_config + '\nINVARIANT SEBookProperty\n');
  assert.match(request.files[request.entry], /EXTENDS Model\n/);
  assert.match(request.files[request.entry], /SEBookProperty == \(\ncount < 2\n\)/);
  assert.equal(request.checkDeadlock, true, 'only trusted config may disable instructor deadlock checks');
  assert.equal(request.files['Model.tla'], source.files['Model.tla']);
  assert.equal(source.entry, 'Model.tla', 'building a check does not replace the learner entry');
});

test('a trusted configuration alone checks the original module without adding a property', async () => {
  const { buildCheck } = await assessment;
  const source = await learner();
  const request = buildCheck(source, { status: 'counterexample', reason: 'deadlock', model_config: 'INIT Init\nNEXT Next' });
  assert.equal(request.entry, 'Model.tla');
  assert.equal(request.files[request.config], 'INIT Init\nNEXT Next\n');
  assert.deepEqual(Object.keys(request.files).filter(name => name.endsWith('.tla')), ['Model.tla']);
});

test('a temporal property uses the trusted PROPERTY directive and describes behavior-level evidence', async () => {
  const { buildCheck, feedback } = await assessment;
  const source = await learner();
  source.files['Model.cfg'] = 'SPECIFICATION Spec\nPROPERTY LearnerReplacement';
  const expectation = { status: 'complete', property: '<>(count = 2)', model_config: 'SPECIFICATION Spec' };
  const request = buildCheck(source, expectation);
  assert.equal(request.files[request.config], 'SPECIFICATION Spec\nPROPERTY SEBookProperty\n');
  assert.match(request.files[request.entry], /SEBookProperty == \(\n<>\(count = 2\)\n\)/);
  assert.match(feedback({ status: 'complete' }, expectation), /temporal property.*every behavior.*configured model/);
});

test('temporal checks require trusted configuration and cannot be combined with an invariant', async () => {
  const { buildCheck } = await assessment;
  const source = await learner();
  assert.throws(() => buildCheck(source, { status: 'complete', property: '<>(count = 2)' }), /requires.*model_config/);
  assert.throws(() => buildCheck(source, { ...invariantTest, property: '<>(count = 2)' }), /either invariant or property/);
  assert.throws(() => buildCheck(source, { status: 'complete', property: ' ', model_config: 'SPECIFICATION Spec' }), /property must be nonempty text/);
});

test('learner files cannot shadow or be overwritten by the generated assessment module', async () => {
  const { buildCheck } = await assessment;
  const source = await learner();
  source.files['SEBookTutorialCheck.tla'] = 'learner module';
  source.files['SEBookTutorialCheck2.cfg'] = 'learner configuration';
  const request = buildCheck(source, invariantTest);
  assert.equal(request.files['SEBookTutorialCheck.tla'], 'learner module');
  assert.equal(request.files['SEBookTutorialCheck2.cfg'], 'learner configuration');
  assert.equal(Object.hasOwn(source.files, request.entry), false);
  assert.equal(Object.hasOwn(source.files, request.config), false);
  assert.match(request.files[request.config], /INVARIANT SEBookProperty/);
});

test('a generated harness preserves PlusCal translation and the source snapshot limits', async () => {
  const { buildCheck } = await assessment;
  const source = await learner();
  source.translatePlusCal = true;
  source.maxStates = 25;
  source.maxTimeMs = 1000;
  const request = buildCheck(source, invariantTest);
  assert.equal(request.translatePlusCal, true);
  assert.equal(request.maxStates, 25);
  assert.equal(request.maxTimeMs, 1000);
});

test('malformed expectations cannot silently weaken an instructor property check', async () => {
  const { buildCheck } = await assessment;
  const source = await learner();
  for (const expectation of [null, [], { status: 'error' }, { status: 'complete', reason: 7 },
    { status: 'complete', invariants: 'count < 2' }, { status: 'complete', invariant: 'count < 2' },
    { status: 'complete', invariant: '', model_config: 'INIT Init' },
    { status: 'complete', model_config: '  ' }, { status: 'complete', model_config: [] }]) {
    assert.throws(() => buildCheck(source, expectation), /tla test|tla invariant test/);
  }
});

test('assessment retains pass, mismatch, and no-evidence outcomes', async () => {
  const { assess } = await assessment;
  assert.equal(assess({ status: 'complete' }, invariantTest), true);
  assert.equal(assess({ status: 'counterexample', reason: 'invariant' }, invariantTest), false);
  const deadlock = { status: 'counterexample', reason: 'deadlock' };
  assert.equal(assess(deadlock, deadlock), true);
  assert.equal(assess({ status: 'counterexample', reason: 'invariant' }, deadlock), false);
  for (const status of ['error', 'incomplete', 'unknown']) assert.equal(assess({ status }, invariantTest), null);
  assert.equal(assess(null, invariantTest), null);
});

test('feedback separates violated properties, missing expected failures, syntax errors, and interruptions', async () => {
  const { feedback } = await assessment;
  assert.match(feedback({ status: 'counterexample', reason: 'invariant' }, invariantTest), /invariant violation.*expects no violation/);
  assert.match(feedback({ status: 'complete' }, { status: 'counterexample', reason: 'deadlock' }), /expects a deadlock/);
  assert.match(feedback({ status: 'error', diagnostics: [{ message: 'Unknown operator MissingNext' }] }, invariantTest), /Unknown operator MissingNext/);
  assert.match(feedback({ status: 'incomplete', reason: 'time-limit' }, invariantTest), /time limit.*No pass or failure/);
  assert.match(feedback({ status: 'incomplete', reason: 'stale' }, invariantTest), /model changed/);
  assert.match(feedback({ status: 'complete' }, invariantTest), /configured model/);
});
