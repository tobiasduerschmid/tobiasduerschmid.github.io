const { test } = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('./fixtures/aadl-budget-result.json');
const controllerModule = import('../../js/aadl/controller.mjs');

function harness() {
  let source = 'first';
  const calls = [];
  const states = [];
  const client = { execute(request) { return new Promise(resolve => calls.push({ request, resolve })); }, supersede() {}, cancel() {}, destroy() {} };
  const view = { render(state) { states.push(state); }, clear() { states.push({ phase: 'idle' }); }, destroy() {} };
  return { client, view, calls, states, changeSource: value => { source = value; }, getSnapshot: () => ({ version: 1, root: 'Rover_Budget::Loop.budget', files: { 'Model.aadl': source } }) };
}

test('an edit during analysis makes its late result stale even if an edit notification was missed', async () => {
  const { createAADLController } = await controllerModule;
  const h = harness();
  const controller = createAADLController(h);
  const pending = controller.run('analyze');
  h.changeSource('second');
  h.calls[0].resolve(fixture);
  assert.equal((await pending).reason, 'stale');
  assert.equal(h.states.some(state => state.phase === 'complete'), false);
  controller.destroy();
});

test('ordinary edits supersede work without stopping the engine; Stop still cancels it', async () => {
  const { createAADLController } = await controllerModule;
  const h = harness();
  let stopped = 0;
  let superseded = 0;
  h.client.cancel = () => { stopped++; };
  h.client.supersede = () => { superseded++; };
  const controller = createAADLController(h);
  controller.markStale();
  assert.equal(stopped, 0, 'editing must not abort engine initialization');
  assert.equal(superseded, 1);
  controller.stop();
  assert.equal(stopped, 1, 'explicit Stop must stop background work');
  controller.destroy();
});

test('startup reports its real stage and elapsed time until an operation finishes', async t => {
  const { createAADLController } = await controllerModule;
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  const h = harness();
  const controller = createAADLController(h);
  const pending = controller.run('validate');
  h.client.onPhase('loading', { stage: 'download', completed: 13, total: 52 });
  assert.match(h.states.at(-1).message, /13 of 52/);
  h.client.onPhase('loading', { stage: 'services' });
  t.mock.timers.tick(30000);
  assert.match(h.states.at(-1).message, /Initializing OSATE/);
  assert.match(h.states.at(-1).message, /30 s/);
  h.calls[0].resolve(fixture);
  await pending;
  const updates = h.states.length;
  t.mock.timers.tick(30000);
  assert.equal(h.states.length, updates, 'completed work must stop updating startup status');
  controller.destroy();
});

test('step reset prevents an old operation from repainting the destination lesson', async () => {
  const { createAADLController } = await controllerModule;
  const h = harness();
  const controller = createAADLController(h);
  const pending = controller.run('validate');
  controller.reset();
  h.calls[0].resolve(fixture);
  assert.equal((await pending).reason, 'canceled');
  assert.equal(h.states.at(-1).phase, 'idle');
  controller.destroy();
});

test('source edits are coalesced into validation of the latest complete workspace', async t => {
  const { createAADLController } = await controllerModule;
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = harness();
  const controller = createAADLController({ ...h, debounceMs: 1000 });
  controller.schedule();
  h.changeSource('latest');
  controller.schedule();
  t.mock.timers.tick(1000);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].request.operation, 'validate');
  assert.equal(h.calls[0].request.files['Model.aadl'], 'latest');
  h.calls[0].resolve(fixture);
  await Promise.resolve();
  assert.equal(h.states.at(-1).phase, 'complete');
  controller.destroy();
});
