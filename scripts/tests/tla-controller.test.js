const { test } = require('node:test');
const assert = require('node:assert/strict');

const source = () => ({ files: { 'Model.tla': '---- MODULE Model ----\n====', 'Model.cfg': 'INIT Init\nNEXT Next' }, entry: 'Model.tla', config: 'Model.cfg', maxStates: 100, maxTimeMs: 30000 });
const result = (properties = {}) => ({ version: 1, status: 'complete', diagnostics: [], ...properties });
const state = (id, count, withinConstraints = true) => ({ id, withinConstraints, values: [{ name: 'count', type: 'number', text: String(count) }] });

async function workspace(responder, options = {}) {
  const { createTLAController } = await import('../../js/tla/controller.mjs');
  const calls = [];
  const views = [];
  const busy = [];
  let callbacks;
  let current = source();
  let destroyed = false;
  const client = {
    execute(request) { calls.push(request); return responder(request); },
    cancel() {},
    destroy() { destroyed = true; },
  };
  const controller = createTLAController({
    root: {}, client, getSnapshot: () => current,
    onSourceLocation: () => {}, onBusyChange: value => busy.push(value),
    createView(root, handlers) {
      callbacks = handlers;
      return { render(value) { views.push(value); }, destroy() {} };
    },
    ...options,
  });
  return { controller, calls, callbacks, busy, edit() { current.files['Model.tla'] += '\n\\* edit'; },
    view: () => views[views.length - 1], clientDestroyed: () => destroyed };
}

test('checking returns the actual engine verdict with typed states and a liveness loop', async () => {
  const wire = result({ status: 'counterexample', reason: 'liveness', trace: { states: [state('a', 0), state('b', 1)], loopIndex: 0 } });
  const app = await workspace(() => Promise.resolve(wire));
  assert.equal(await app.controller.run('check'), wire);
  assert.equal(app.calls[0].operation, 'check');
  assert.equal(app.calls[0].files['Model.cfg'], 'INIT Init\nNEXT Next');
  assert.equal(app.view().result.trace[1].variables[0].value, '1');
  assert.equal(app.view().result.trace[1].variables[0].type, 'number');
  assert.equal(app.view().result.loopTo, 0);
  assert.deepEqual(app.busy, [true, false]);
});

test('a result from a changed source cannot be used for grading', async () => {
  let finish;
  const app = await workspace(() => new Promise(resolve => { finish = resolve; }));
  const pending = app.controller.run('check');
  app.edit();
  finish(result());
  const verdict = await pending;
  assert.equal(verdict.status, 'incomplete');
  assert.equal(verdict.reason, 'stale');
  assert.equal(app.view().stale, true);
});

test('instructor checks display their failing trace while freshness uses the original learner files', async () => {
  const wire = result({ status: 'counterexample', reason: 'invariant', trace: { states: [state('a', 0), state('b', 2)] } });
  const app = await workspace(() => Promise.resolve(wire));
  const override = { files: { ...source().files, 'Check.cfg': 'INIT Init\nNEXT Next\nINVARIANT Bound' }, config: 'Check.cfg' };
  assert.equal(await app.controller.run('check', override), wire);
  assert.equal(app.calls[0].config, 'Check.cfg');
  assert.equal(app.view().result.trace[1].variables[0].value, '2');
  assert.match(app.view().result.scope, /Instructor-defined property and configuration/);
  await app.callbacks.onSelectState(1);
  assert.equal(app.view().selectedIndex, 1, 'an instructor configuration is not mistaken for a learner edit');
});

test('editing learner source invalidates an in-flight instructor assessment', async () => {
  let finish;
  const app = await workspace(() => new Promise(resolve => { finish = resolve; }));
  const pending = app.controller.run('check', { config: 'Teacher.cfg', files: { ...source().files, 'Teacher.cfg': 'INIT Init\nNEXT Next' } });
  app.edit();
  finish(result());
  assert.equal((await pending).reason, 'stale');
  assert.equal(app.view().stale, true);
});

test('reset rejects a late result without replacing the new idle view', async () => {
  let finish;
  const app = await workspace(() => new Promise(resolve => { finish = resolve; }));
  const pending = app.controller.run('check');
  app.controller.reset();
  finish(result());
  assert.equal((await pending).status, 'incomplete');
  assert.equal(app.view().phase, 'idle');
  assert.equal(app.view().result, undefined);
});

test('starting exploration reports partial and excluded starting choices without claiming verification', async () => {
  const app = await workspace(() => Promise.resolve(result({ status: 'incomplete', reason: 'choice-limit', states: [state('a', 0), state('x', 99, false)] })));
  await app.controller.run('explore-init');
  assert.equal(app.view().mode, 'explore');
  assert.equal(app.view().choices.length, 1);
  assert.equal(app.view().excludedChoiceCount, 1);
  assert.equal(app.view().choicesIncomplete, true);
  assert.match(app.view().result.summary, /does not establish/);
  assert.equal(app.view().result.trace.length, 0);
  assert.equal(app.view().canEvaluate, false);
});

test('Back reuses real states and choosing another branch replaces the later path', async () => {
  const app = await workspace(request => {
    if (request.operation === 'explore-init') return Promise.resolve(result({ states: [state('a', 0)] }));
    const choices = request.stateId === 'a' ? [
      { label: 'Increment', state: state('b', 1), withinConstraints: true },
      { label: 'Jump', state: state('c', 2), withinConstraints: true },
      { label: 'TooFar', state: state('x', 99), withinConstraints: false },
    ] : [];
    return Promise.resolve(result({ choices }));
  });
  await app.controller.run('explore-init');
  await app.callbacks.onNextState(0);
  assert.equal(app.view().excludedChoiceCount, 1);
  await app.callbacks.onNextState(0);
  assert.equal(app.view().result.trace[1].variables[0].value, '1');
  const callsBeforeBack = app.calls.length;
  await app.callbacks.onBack();
  assert.equal(app.calls.length, callsBeforeBack, 'replaying a cached state needs no new engine request');
  assert.equal(app.view().selectedIndex, 0);
  await app.callbacks.onNextState(1);
  assert.equal(app.calls.at(-1).stateId, 'c');
  assert.deepEqual(app.view().result.trace.map(item => item.variables[0].value), ['0', '2']);
});

test('watching an operator uses the selected engine state and preserves the returned TLA value', async () => {
  const app = await workspace(request => Promise.resolve(request.operation === 'explore-init'
    ? result({ states: [state('a', 0)] })
    : request.operation === 'evaluate' ? result({ value: { type: 'boolean', text: 'TRUE' } }) : result({ choices: [] })));
  await app.controller.run('explore-init');
  await app.callbacks.onNextState(0);
  await app.callbacks.onEvaluate('TypeOK');
  assert.equal(app.calls.at(-1).operation, 'evaluate');
  assert.equal(app.calls.at(-1).stateId, 'a');
  assert.equal(app.calls.at(-1).operator, 'TypeOK');
  assert.equal(app.view().evaluation.value, 'TRUE');
  app.controller.markStale();
  const count = app.calls.length;
  await app.callbacks.onEvaluate('TypeOK');
  assert.equal(app.calls.length, count, 'stale states cannot be evaluated');
});

test('student actions use the tutorial run transaction when it is provided', async () => {
  const routed = [];
  const app = await workspace(() => { throw new Error('should be routed'); }, {
    onCheck: () => routed.push('check'), onOperation: operation => routed.push(operation),
  });
  app.callbacks.onCheck();
  app.callbacks.onExplore();
  app.callbacks.onParse();
  assert.deepEqual(routed, ['check', 'explore-init', 'parse']);
  assert.equal(app.calls.length, 0);
});

test('client failures are shown as errors and disposal prevents later runs', async () => {
  const app = await workspace(() => Promise.reject(new Error('Runtime unavailable')));
  assert.equal((await app.controller.run('check')).status, 'error');
  assert.equal(app.view().result.diagnostics[0].message, 'Runtime unavailable');
  app.controller.destroy();
  assert.equal(app.clientDestroyed(), true);
  assert.equal((await app.controller.run('check')).status, 'incomplete');
  assert.equal(app.calls.length, 1);
});

test('an expired runtime disables further exploration and directs the learner to restart', async () => {
  const app = await workspace(request => Promise.resolve(request.operation === 'explore-init'
    ? result({ states: [state('a', 0)] })
    : result({ status: 'incomplete', reason: 'time-limit', sessionExpired: true })));
  await app.controller.run('explore-init');
  await app.callbacks.onNextState(0);
  assert.equal(app.view().canEvaluate, false);
  assert.equal(app.view().choicesIncomplete, false);
  assert.equal(app.view().sessionExpired, true);
  assert.deepEqual(app.view().choices, []);
  assert.match(app.view().result.summary, /start a new session/);
  const calls = app.calls.length;
  await app.callbacks.onEvaluate('TypeOK');
  assert.equal(app.calls.length, calls);
});

test('exploration makes an invariant failure in the selected state visible', async () => {
  const badState = { ...state('a', 2), invariants: [{ name: 'AtMostOne', holds: false }] };
  const app = await workspace(request => Promise.resolve(request.operation === 'explore-init'
    ? result({ states: [badState] }) : result({ choices: [] })));
  await app.controller.run('explore-init');
  await app.callbacks.onNextState(0);
  assert.equal(app.view().result.status, 'counterexample');
  assert.match(app.view().result.summary, /AtMostOne is false in the selected state/);
});

test('the shared Stop action rejects a late success without clearing the stopped verdict', async () => {
  let finish;
  const app = await workspace(() => new Promise(resolve => { finish = resolve; }));
  const pending = app.controller.run('check');
  app.controller.stop();
  finish(result());
  assert.equal((await pending).status, 'incomplete');
  assert.equal(app.view().result.status, 'stopped');
  assert.equal(app.view().canEvaluate, false);
});
