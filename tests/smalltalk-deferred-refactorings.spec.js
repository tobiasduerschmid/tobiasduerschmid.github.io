const { test, expect } = require('@playwright/test');
const { withSmalltalk } = require('./helpers/smalltalk-runtime');
const features = require('./helpers/smalltalk-features');
test.setTimeout(120000);
test.skip(features.refactorings, 'This contract applies to the distribution with refactoring deferred.');

test('disabled native refactoring requests reject clearly while live and fresh images remain usable', async ({ page }) => {
  const result = await withSmalltalk(page, async host => {
    const timings = {};
    const timed = async (name, action) => { const start = performance.now(); try { return await action(); } finally { timings[name] = performance.now() - start; } };
    const live = await timed('liveBoot', () => host.openSession('live'));
    const info = await host.request(live, 'info', {});
    const program = { version: 1, stepKey: 'disabled-refactorings', revision: 0, files: [], changes: { version: 1, source: '', entries: [] }, runCommand: null };
    await timed('loadProgram', () => host.request(live, 'loadProgram', { program }));
    const evaluate = (session, source) => host.request(session, 'evaluate', { source, bindings: 'workspace' });
    const unguarded = await evaluate(live, "(Smalltalk includesKey: #SEBookStructuralTrustedCode) not and: [SEBookStructuralGuard enabled not and: [((SystemChangeNotifier sourceCodeAt: #trigger:) asString includesSubstring: 'SEBookStructuralGuard') not]]");
    const target = { kind: 'class', className: 'Object', side: 'instance' };
    const errors = [];
    for (const [operation, payload] of [
      ['refactoringCatalog', { target }],
      ['prepareRefactoring', { target, action: 'addClass', options: { name: 'DeferredClass' } }],
      ['cancelRefactoring', { token: 'unavailable' }],
      ...['applyRefactoring', 'undoRefactoring', 'redoRefactoring'].map(action => ['prepareMutation', { id: 'disabled-' + action, digest: 'a'.repeat(64), baseRevision: 0, action, params: { token: 'unavailable' } }]),
    ]) {
      try { await host.request(live, operation, payload); errors.push({ accepted: operation }); }
      catch (error) { errors.push({ code: error.code, message: error.message }); }
    }
    const liveValue = await timed('warmEvaluate', () => evaluate(live, 'saved := 73. saved'));
    const fresh = await timed('freshBoot', () => host.openSession('fresh'));
    await timed('freshLoadProgram', () => host.request(fresh, 'loadProgram', { program }));
    const freshValue = await timed('freshEvaluate', () => evaluate(fresh, '21 + 21'));
    const stillLive = await evaluate(live, 'saved');
    return { info, unguarded, errors, liveValue, freshValue, stillLive, timings };
  });
  expect(result.info.features).toEqual({ refactorings: false });
  expect(result.unguarded.error).toBeNull();
  expect(result.unguarded.value.booleanValue).toBe(true);
  expect(result.errors).toHaveLength(6);
  for (const error of result.errors) {
    expect(error.code).toBe('REFRACTORING_UNAVAILABLE');
    expect(error.message).toContain('disabled');
  }
  expect(result.liveValue.value.text).toBe('73');
  expect(result.freshValue.value.text).toBe('42');
  expect(result.stillLive.value.text).toBe('73');
  console.log('Default Smalltalk timings (ms):', result.timings);
});
