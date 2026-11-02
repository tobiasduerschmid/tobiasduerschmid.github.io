const { test } = require('node:test');
const assert = require('node:assert/strict');

const model = import('../../js/aadl/model.mjs');
const defaults = { root: 'Rover_Budget::Loop.budget' };

test('a request captures every file and the step-selected root independently of file ordering', async () => {
  const { snapshot, sameSnapshot } = await model;
  const files = { 'Data.aadl': 'package Data public end Data;', 'Model.aadl': 'source' };
  const request = snapshot(files, { aadl: { root: 'Other::Loop.impl' } }, defaults);
  files['Model.aadl'] = 'changed';
  assert.equal(request.files['Model.aadl'], 'source');
  assert.equal(request.root, 'Other::Loop.impl');
  assert.equal(sameSnapshot(request, snapshot({ 'Model.aadl': 'source', 'Data.aadl': 'package Data public end Data;' }, {}, { root: request.root })), true);
  assert.equal(sameSnapshot(request, snapshot(files, {}, { root: request.root })), false);
  assert.equal(sameSnapshot(request, snapshot(request.files, {}, defaults)), false);
});

test('workspace validation rejects traversal, ambiguous paths, unsupported files, and oversized source', async () => {
  const { snapshot } = await model;
  for (const files of [{ '../outside.aadl': '' }, { '/root.aadl': '' }, { 'a/../b.aadl': '' }, { 'a\\b.aadl': '' }, { 'script.java': '' }, { 'A.aadl': '', 'a.aadl': '' }, {}]) {
    assert.throws(() => snapshot(files, {}, defaults), /file|path|workspace/i);
  }
  assert.throws(() => snapshot({ 'Model.aadl': 'x'.repeat(256 * 1024 + 1) }, {}, defaults), /256/);
  assert.throws(() => snapshot({ 'Model.aadl': '' }, {}, { root: 'TypeWithoutImplementation' }), /root|implementation/i);
});

test('a completed model must resolve every connection endpoint before it reaches the diagram', async () => {
  const { validateResult } = await model;
  const result = {
    version: 1, status: 'complete', diagnostics: [], analyses: [],
    model: { rootId: 'root', components: [{ id: 'root', parentId: null, name: 'root', category: 'system', classifier: 'P::S.i', features: [] }], connections: [], bindings: [] },
  };
  assert.equal(validateResult(result).model.rootId, 'root');
  const broken = structuredClone(result);
  broken.model.connections.push({ id: 'bad', source: 'missing', target: 'other', segments: [] });
  assert.throws(() => validateResult(broken), /endpoint|feature/i);
  assert.throws(() => validateResult({ version: 1, status: 'complete', diagnostics: [] }), /model/i);
});

test('invalid model diagnostics remain distinct from a completed analysis', async () => {
  const { validateResult } = await model;
  const result = validateResult({ version: 1, status: 'invalid', diagnostics: [{ severity: 'error', message: 'Destination must be incoming.', file: 'Model.aadl', line: 29, column: 3 }], analyses: [] });
  assert.equal(result.status, 'invalid');
  assert.equal(result.diagnostics[0].line, 29);
  assert.throws(() => validateResult({ version: 99, status: 'complete', diagnostics: [] }), /protocol|version/i);
});

test('feature-group endpoints reach the renderer as resolved features', async () => {
  const { validateResult } = await model;
  const result = structuredClone(require('./fixtures/aadl-budget-result.json'));
  const sensor = result.model.components.find(component => component.name === 'sensor');
  sensor.features = [{ id: sensor.id + '.group', name: 'group', kind: 'featureGroup', features: sensor.features }];
  assert.equal(validateResult(result).status, 'complete');
});

test('cyclic containment and disconnected roots are rejected before rendering', async () => {
  const { validateResult } = await model;
  const result = structuredClone(require('./fixtures/aadl-budget-result.json'));
  const sensor = result.model.components.find(component => component.name === 'sensor');
  sensor.parentId = sensor.id;
  assert.throws(() => validateResult(result), /containment|cycle/i);
  sensor.parentId = null;
  assert.throws(() => validateResult(result), /root|containment/i);
});

test('an OSATE access connection may resolve to a bus component rather than a feature', async () => {
  const { validateResult } = await model;
  const result = structuredClone(require('./fixtures/aadl-access-result.json'));
  assert.equal(validateResult(result).status, 'complete');
  result.model.connections[0].source = 'unresolved_bus';
  assert.throws(() => validateResult(result), /endpoint/i);
});
