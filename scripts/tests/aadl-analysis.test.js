const { test } = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('./fixtures/aadl-budget-result.json');
const analysis = import('../../js/aadl/analysis.mjs');
const assessment = import('../../js/aadl/assessment.mjs');
const clone = () => structuredClone(fixture);

test('a complete abstract budget exposes the native range and requirement without treating execution as proof', async () => {
  const { latencyEvidence } = await analysis;
  const [row] = latencyEvidence(clone());
  assert.equal(row.finding, 'satisfied');
  assert.equal(row.minimumMs, 18);
  assert.equal(row.maximumMs, 22);
  assert.equal(row.maximumRequirementMs, 25);
  assert.equal(row.complete, true);
});

test('a missing controller allocation remains incomplete even when the native report says SUCCESS', async () => {
  const { latencyEvidence } = await analysis;
  const result = clone();
  result.model.flows.find(flow => flow.kind === 'path').latency = { present: false };
  result.analyses[0].results[0].minimumMs = 10;
  result.analyses[0].results[0].maximumMs = 10;
  const [row] = latencyEvidence(result);
  assert.equal(row.finding, 'inconclusive');
  assert.equal(row.complete, false);
  assert.match(row.missing.join(' '), /control/);
});

test('the upper-bound comparison includes equality and rejects the value just below it', async () => {
  const { latencyEvidence } = await analysis;
  for (const [bound, expected] of [[21, 'violated'], [22, 'satisfied'], [23, 'satisfied']]) {
    const result = clone();
    result.model.flows.find(flow => flow.kind === 'end-to-end').latency.maximumMs = bound;
    result.analyses[0].results[0].maximumRequirementMs = bound;
    assert.equal(latencyEvidence(result)[0].finding, expected);
  }
});

test('deleting the required flow or changing a contributor cannot earn the budget exercise', async () => {
  const { assess } = await assessment;
  const criterion = { criterion: 'complete-budget', fixture: 'rover-budget-v1' };
  assert.equal(assess(clone(), criterion).passed, true);
  const absent = clone(); absent.model.flows = absent.model.flows.filter(flow => flow.kind !== 'end-to-end');
  assert.equal(assess(absent, criterion).passed, false);
  const cheaper = clone(); cheaper.model.flows.find(flow => flow.kind === 'path').latency.maximumMs = 1;
  assert.equal(assess(cheaper, criterion).passed, false);
});

test('the tight-bound task requires22ms and retains the required path and contributor evidence', async () => {
  const { assess } = await assessment;
  const criterion = { criterion: 'tight-bound', fixture: 'rover-budget-v1' };
  const result = clone();
  assert.equal(assess(result, criterion).passed, false);
  result.model.flows.find(flow => flow.kind === 'end-to-end').latency.maximumMs = 22;
  result.analyses[0].results[0].maximumRequirementMs = 22;
  assert.equal(assess(result, criterion).passed, true);
  result.model.connections = [];
  assert.equal(assess(result, criterion).passed, false);
});

test('incomplete execution is unassessed and an unrelated root cannot pass', async () => {
  const { assess } = await assessment;
  const criterion = { criterion: 'connected-flow', fixture: 'rover-budget-v1' };
  assert.equal(assess({ version: 1, status: 'incomplete', reason: 'canceled', diagnostics: [] }, criterion).passed, null);
  const result = clone(); result.model.components[0].classifier = 'Other::Loop.budget';
  assert.equal(assess(result, criterion).passed, false);
});

test('the exercise preserves typed data ports and component roles', async () => {
  const { assess } = await assessment;
  const criterion = { criterion: 'connected-flow', fixture: 'rover-budget-v1' };
  for (const classifier of [null, 'Rover_Budget::Speed']) {
    const result = clone();
    for (const component of result.model.components) {
      for (const feature of component.features.filter(feature => feature.name === 'command')) feature.dataClassifier = classifier;
    }
    assert.equal(assess(result, criterion).passed, false);
  }
  const changedRole = clone();
  changedRole.model.components.find(component => component.name === 'sensor').category = 'system';
  assert.equal(assess(changedRole, criterion).passed, false);
});

test('an unused flow does not replace the flow explicitly named in the response path', async () => {
  const { assess } = await assessment;
  const result = clone();
  const original = result.model.flows.find(flow => flow.kind === 'source');
  result.model.flows.unshift({ ...original, id: original.id + '_spare', name: 'spare', latency: { present: false } });
  assert.equal(assess(result, { criterion: 'complete-budget', fixture: 'rover-budget-v1' }).passed, true);
});

test('fixed-requirement lessons reject weakened bounds while the characterization lesson may choose its bound', async () => {
  const { assess } = await assessment;
  const criterion = { criterion: 'complete-budget', fixture: 'rover-budget-v1', required_upper_bound_ms: 25 };
  assert.equal(assess(clone(), criterion).passed, true);
  const result = clone();
  result.model.flows.find(flow => flow.kind === 'end-to-end').latency.maximumMs = 250;
  result.analyses[0].results[0].maximumRequirementMs = 250;
  assert.equal(assess(result, criterion).passed, false);
  assert.equal(assess(result, { criterion: 'complete-budget', fixture: 'rover-budget-v1' }).passed, true);
});

test('modal timing keeps its native mode scope and remains inconclusive for this static budget profile', async () => {
  const { latencyEvidence } = await analysis;
  const result = structuredClone(require('./fixtures/aadl-modal-result.json'));
  const rows = latencyEvidence(result);
  assert.equal(rows.length, 2);
  assert.match(rows[0].mode, /fast/);
  assert.match(rows[1].mode, /slow/);
  for (const row of rows) {
    assert.equal(row.finding, 'inconclusive');
    assert.equal(row.complete, false);
    assert.match(row.missing.join(' '), /mode-specific/i);
  }
});
