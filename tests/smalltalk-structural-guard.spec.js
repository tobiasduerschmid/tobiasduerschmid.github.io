const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { installSmalltalk, withSmalltalk } = require('./helpers/smalltalk-runtime');
const fixture = fs.readFileSync(path.join(__dirname, 'fixtures/smalltalk/structural-guard.st'), 'utf8');
const exerciseBoundary = require('./fixtures/smalltalk/structural-boundary');
test.setTimeout(180000);
const features = require('./helpers/smalltalk-features');
const ordinaryBehaviorTests = new Set([
  'stopping an absent or stale session preserves the current live and fresh sessions',
  'class definition and ordinary method Accept preserve a waiting learner process',
  'ordinary terminal and raw-file code keep native synchronous notification semantics',
  'an unchanged physical class definition does not reject a retained learner closure',
]);
test.beforeEach(({}, testInfo) => {
  test.skip(!features.refactorings && !ordinaryBehaviorTests.has(testInfo.title), 'Native refactoring isolation is deferred by the production capability.');
});
test('the guard refuses a manifest-verified bundle that differs from the reviewed VM pin', async ({ page }) => {
  let changedHash;
  await page.route('**/runtime/squeak_headless_bundle.js', async route => {
    const response = await route.fetch();
    const body = (await response.text()) + '\n// Different artifact for the pin refusal test.\n';
    changedHash = require('node:crypto').createHash('sha256').update(body).digest('hex');
    await route.fulfill({ response, body });
  });
  await page.route('**/js/vendor/smalltalk/manifest.json', async route => {
    const response = await route.fetch();
    const manifest = await response.json();
    const artifact = manifest.artifacts.find(asset => asset.path === 'runtime/squeak_headless_bundle.js');
    const bundle = await page.request.get('/js/vendor/smalltalk/' + artifact.path);
    const body = (await bundle.text()) + '\n// Different artifact for the pin refusal test.\n';
    artifact.sha256 = require('node:crypto').createHash('sha256').update(body).digest('hex');
    await route.fulfill({ response, json: manifest });
  });
  const result = await withSmalltalk(page, async host => {
    try { await host.openSession('live'); return { accepted: true }; }
    catch (error) { return { code: error.code, message: error.message }; }
  });
  expect(changedHash).toBeTruthy();
  expect(result).toEqual({ code: 'ASSET_ERROR', message: 'Structural guard requires the reviewed SqueakJS bundle' });
});

for (const source of ["SEBookStructuralGuard begin: 'not-a-transaction'", 'SEBookStructuralGuard seal']) {
  test('ordinary evaluation cannot acquire or reseal the guard: ' + source, async ({ page }) => {
    const result = await withSmalltalk(page, async (host, source) => {
      const session = await host.openSession('live');
      try { await host.request(session, 'evaluate', { source, bindings: 'workspace' }, {}); return 'accepted'; }
      catch (error) { return error.message; }
    }, source);
    expect(result).toContain(source.includes('begin:') ? 'STRUCTURAL_MUTATION_IDENTITY' : 'STRUCTURAL_ALREADY_SEALED');
  });
}

test('stopping an absent or stale session preserves the current live and fresh sessions', async ({ page }) => {
  const result = await withSmalltalk(page, async host => {
    const old = await host.openSession('live');
    const current = await host.openSession('live');
    const fresh = await host.openSession('fresh');
    for (const session of [undefined, null, old, { ...current }, { role: 'missing' }]) host.stopSession(session);
    return [(await host.request(current, 'info', {}, {})).imageBuild,
      (await host.request(fresh, 'info', {}, {})).imageBuild];
  });
  expect(result).toEqual([22104, 22104]);
});

async function run(page, scenario, context = null) {
  await installSmalltalk(page);
  await page.addScriptTag({ url: '/js/smalltalk/workspace.js' });
  await page.addScriptTag({ url: '/js/smalltalk/refactorings.js' });
  return page.evaluate(async ({ fixture, scenario, context }) => {
    const runtime = await SEBookSmalltalk.RuntimeHost.create({ manifestURL: '/js/vendor/smalltalk/manifest.json' });
    const workspace = await SEBookSmalltalk.Workspace.create({ runtime, program: {
      version: 1, stepKey: 'structural-guard', revision: 0,
      files: [{ path: '/guard.st', kind: 'source', format: 'filein', content: fixture }],
      changes: { version: 1, source: '', entries: [] }, runCommand: null,
    } });
    const refactorings = SEBookSmalltalk.FEATURES.refactorings ? SEBookSmalltalk.Refactorings.create(workspace) : null;
    const target = { kind: 'method', className: 'SEBookGuardA', side: 'instance', selector: 'answer' };
    try { return await (0, eval)('(' + scenario + ')')({ workspace, runtime, refactorings, target, context }); }
    finally { workspace.dispose(); runtime.dispose(); }
  }, { fixture, scenario: scenario.toString(), context });
}

test('native composite observers and deferred subscribers see complete layouts across Apply Undo Redo', async ({ page }) => {
  const result = await run(page, async ({ workspace, refactorings, target }) => {
    await workspace.evaluate('listener := SEBookGuardListener new. SystemChangeNotifier uniqueInstance notify: listener ofAllSystemChangesUsing: #changed:. seen := nil. done := Semaphore new. observer := [[SEBookGuardA instVarNames includes: \'part\'] whileFalse: [(SEBookGuardDelay forMilliseconds: 100) wait]. seen := {SEBookGuardA instVarNames includes: \'part\'. SEBookGuardB instVarNames includes: \'part\'}. done signal] forkAt: 80');
    const preview = await refactorings.prepare({ action: 'renameMethod', target, options: { newSelector: 'renamedAnswer' } });
    await workspace.evaluate("SEBookGuardFixture replace: '" + preview.token + "' failing: false");
    await refactorings.apply(preview).catch(error => { throw new Error('Apply: ' + error.message); });
    const applied = await workspace.evaluate("done wait. (seen = #(true true)) and: [SEBookGuardTimerSeen = #(true true false) and: [listener seen notEmpty and: [listener seen allSatisfy: [:each | each = #(true true false)]]]]").catch(error => { throw new Error('Observer completion: ' + error.message); });
    const applyHistory = refactorings.historyState();
    await workspace.evaluate('SystemChangeNotifier uniqueInstance noMoreNotificationsFor: listener');
    await refactorings.undo();
    const undone = await workspace.evaluate("(SEBookGuardA instVarNames includes: 'part') not and: [(SEBookGuardB instVarNames includes: 'part') not]");
    const undoHistory = refactorings.historyState();
    await refactorings.redo();
    const redone = await workspace.evaluate("(SEBookGuardA instVarNames includes: 'part') and: [SEBookGuardB instVarNames includes: 'part']");
    return { applied, applyHistory, undone, undoHistory, redone };
  });
  expect(result.applied.value.booleanValue).toBe(true);
  expect(result.applyHistory.canUndo).toBe(true);
  expect(result.undone.value.booleanValue).toBe(true);
  expect(result.undoHistory.canRedo).toBe(true);
  expect(result.redone.value.booleanValue).toBe(true);
});

test('class definition and ordinary method Accept preserve a waiting learner process', async ({ page }) => {
  const result = await run(page, async ({ workspace, target }) => {
    await workspace.evaluate('gate := Semaphore new. done := Semaphore new. process := [gate wait. observed := SEBookGuardA new answer. done signal] forkAt: 40');
    await workspace.commit({ action: 'acceptMethod', baseRevision: workspace.snapshot().revision,
      params: { target, source: 'answer ^ 73', protocol: 'testing' } });
    const alive = await workspace.evaluate("process isTerminated not and: [(process instVarNamed: 'myList') == gate]");
    await workspace.commit({ action: 'acceptClass', baseRevision: workspace.snapshot().revision,
      params: { target: { ...target, kind: 'class' }, source: "Object subclass: #SEBookGuardA instanceVariableNames: 'original extra' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Guard-Tests'" } });
    const after = await workspace.evaluate("gate signal. done wait. observed = 73 and: [(SEBookGuardA instVarNames includes: 'extra') and: [SEBookStructuralGuard active not]]");
    return { alive, after };
  });
  expect(result.alive.value.booleanValue).toBe(true);
  expect(result.after.value.booleanValue).toBe(true);
});

for (const retained of ['SEBookGuardA new retained', 'SEBookGuardA new retainedContext']) {
  test('layout changes refuse retained affected activation: ' + retained, async ({ page }) => {
    const result = await run(page, async ({ workspace, target, context }) => {
      await workspace.evaluate('held := ' + context);
      const before = workspace.snapshot();
      const failure = await workspace.commit({ action: 'acceptClass', baseRevision: before.revision,
        params: { target: { ...target, kind: 'class' }, source: "Object subclass: #SEBookGuardA instanceVariableNames: 'original extra' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Guard-Tests'" } }).catch(error => ({ code: error.code, message: error.message }));
      const restored = await workspace.evaluate("SEBookGuardA instVarNames = #('original') and: [held notNil and: [SEBookStructuralGuard active not]]");
      await workspace.evaluate('held := nil. Smalltalk garbageCollect');
      await workspace.commit({ action: 'acceptMethod', baseRevision: before.revision, params: { target, source: 'answer ^ 73', protocol: 'testing' } });
      const next = await workspace.evaluate('SEBookGuardA new answer = 73');
      return { before, failure, restored, next };
    }, retained);
    expect(result.failure.message).toContain('STRUCTURAL_NATIVE_FAILURE');
    expect(result.restored.value.booleanValue).toBe(true);
    expect(result.next.value.booleanValue).toBe(true);
  });
}

test('a native Error after member one restores the complete checkpoint and permits the next mutation', async ({ page }) => {
  const result = await run(page, async ({ workspace, refactorings, target }) => {
    await workspace.evaluate("object := SEBookGuardA new. alias := object. FileStream forceNewFileNamed: '/kept.txt' do: [:s | s nextPutAll: 'kept']");
    const before = workspace.snapshot();
    const preview = await refactorings.prepare({ action: 'renameMethod', target, options: { newSelector: 'renamedAnswer' } });
    await workspace.evaluate("SEBookGuardFixture replace: '" + preview.token + "' failing: true");
    const failure = await refactorings.apply(preview).catch(error => ({ code: error.code, message: error.message }));
    const restored = await workspace.evaluate("SEBookGuardA instVarNames = #('original') and: [object == alias and: [(FileStream readOnlyFileNamed: '/kept.txt' do: [:s | s contents]) = 'kept' and: [SEBookStructuralGuard active not]]]");
    const nextPreview = await refactorings.prepare({ action: 'renameMethod', target, options: { newSelector: 'renamedAnswer' } });
    await refactorings.apply(nextPreview);
    const next = await workspace.evaluate('object renamedAnswer = 42');
    return { before, failure, restored, next };
  });
  expect(result.failure.code).toBe('RECOVERED_FAILURE');
  expect(result.failure.message).toContain('STRUCTURAL_NATIVE_FAILURE');
  expect(result.restored.value.booleanValue).toBe(true);
  expect(result.next.value.booleanValue).toBe(true);
});

test('a transitive custom compiler hook cannot execute between native composite members', async ({ page }) => {
  const result = await run(page, async ({ workspace, refactorings, target }) => {
    const preview = await refactorings.prepare({ action: 'renameMethod', target, options: { newSelector: 'renamedAnswer' } });
    await workspace.evaluate("SEBookGuardFixture replaceWithCompileHook: '" + preview.token + "'");
    const failure = await refactorings.apply(preview).catch(error => ({ code: error.code, message: error.message }));
    const restored = await workspace.evaluate("(Smalltalk includesKey: #SEBookGuardPartialSeen) not and: [SEBookGuardA instVarNames = #('original') and: [SEBookStructuralGuard active not]]");
    return { failure, restored };
  });
  expect(result.failure.message).toContain('STRUCTURAL_UNSUPPORTED_CODE: SEBookGuardHookTarget class>>compile:classified:notifying:');
  expect(result.restored.value.booleanValue).toBe(true);
});

test('checkpoint recovery reuses original code provenance after an in-place bytecode edit', async ({ page }) => {
  const result = await run(page, async ({ workspace, refactorings, target }) => {
    await workspace.evaluate("heldMethod := SEBookStructuralGuard class compiledMethodAt: #validateActivationsFor:. heldIndex := heldMethod initialPC. heldByte := heldMethod at: heldIndex. heldMethod at: heldIndex put: (heldByte bitXor: 1)");
    const failures = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      const preview = await refactorings.prepare({ action: 'renameMethod', target, options: { newSelector: 'renamedAnswer' } });
      failures.push(await refactorings.apply(preview).then(() => 'accepted', error => error.message));
    }
    await workspace.evaluate('heldMethod at: heldIndex put: heldByte');
    const preview = await refactorings.prepare({ action: 'renameMethod', target, options: { newSelector: 'renamedAnswer' } });
    await refactorings.apply(preview);
    return { failures, next: await workspace.evaluate('SEBookGuardA new renamedAnswer = 42') };
  });
  expect(result.failures).toHaveLength(2);
  for (const failure of result.failures) expect(failure).toContain('STRUCTURAL_CHANGED_CODE: SEBookStructuralGuard class>>validateActivationsFor:');
  expect(result.next.value.booleanValue).toBe(true);
});

for (const [boundary, diagnostic] of [['blocking', 'BLOCKED_TRANSFER'], ['freeze', 'EXTERNAL_PRIMITIVE'], ['checkpoint', 'CHECKPOINT_DURING_MUTATION']]) {
  test('real VM adapter boundary after member one restores the checkpoint: ' + boundary, async ({ page }) => {
    const response = await page.request.get('/js/smalltalk/structural-guard.js');
    const adapter = (await response.text()) + '\n(' + exerciseBoundary.toString() + ')(' + JSON.stringify(boundary) + ');\n';
    await page.route('**/js/smalltalk/structural-guard.js', route => route.fulfill({ contentType: 'text/javascript', body: adapter }));
    await page.route('**/js/vendor/smalltalk/manifest.json', async route => {
      const original = await route.fetch(); const manifest = await original.json();
      manifest.adapters.find(entry => entry.path.endsWith('/structural-guard.js')).sha256 = require('node:crypto').createHash('sha256').update(adapter).digest('hex');
      await route.fulfill({ response: original, json: manifest });
    });
    const result = await run(page, async ({ workspace, refactorings, target }) => {
      await workspace.evaluate('object := SEBookGuardA new. alias := object');
      const preview = await refactorings.prepare({ action: 'renameMethod', target, options: { newSelector: 'renamedAnswer' } });
      await workspace.evaluate("SEBookGuardFixture replace: '" + preview.token + "' failing: false");
      const failure = await refactorings.apply(preview).catch(error => ({ code: error.code, message: error.message }));
      const restored = await workspace.evaluate("object == alias and: [SEBookGuardA instVarNames = #('original') and: [SEBookGuardB instVarNames = #('original') and: [SEBookStructuralGuard active not]]]");
      const next = await refactorings.prepare({ action: 'renameMethod', target, options: { newSelector: 'renamedAnswer' } });
      await refactorings.apply(next);
      return { failure, restored, next: await workspace.evaluate('object renamedAnswer = 42') };
    });
    expect(result.failure.message).toContain('STRUCTURAL_' + diagnostic);
    expect(result.restored.value.booleanValue).toBe(true);
    expect(result.next.value.booleanValue).toBe(true);
  });
}

test('a deadline during a large real native composite restores objects and permits the next guarded mutation', async ({ page }) => {
  const result = await withSmalltalk(page, async (host, fixture) => {
    let session = await host.openSession('live');
    const long = { purpose: 'run' };
    const program = { version: 1, stepKey: 'guard-deadline', revision: 0,
      files: [{ path: '/guard.st', kind: 'source', format: 'filein', content: fixture }],
      changes: { version: 1, source: '', entries: [] }, runCommand: null };
    await host.request(session, 'loadProgram', { program, captureChanges: true }, long);
    const target = { kind: 'method', className: 'SEBookGuardA', side: 'instance', selector: 'answer' };
    const preview = await host.request(session, 'prepareRefactoring', { action: 'renameMethod', target, options: { newSelector: 'renamedAnswer' } }, long);
    await host.request(session, 'evaluate', { source: "object := SEBookGuardA new. alias := object. SEBookGuardFixture replaceWithSlowNative: '" + preview.token + "'", bindings: 'workspace' }, long);
    const identity = { id: crypto.randomUUID(), digest: 'a'.repeat(64) };
    await host.request(session, 'prepareMutation', { ...identity, action: 'applyRefactoring', params: { token: preview.token } });
    const checkpoint = await host.checkpoint(session);
    const failure = await host.request(session, 'commitMutation', identity).catch(error => ({ code: error.code }));
    session = await host.restoreCheckpoint(session, checkpoint);
    host.releaseCheckpoint(checkpoint);
    await host.request(session, 'abortMutation', identity);
    const restored = await host.request(session, 'evaluate', { source: "object == alias and: [SEBookGuardA instVarNames = #('original') and: [SEBookStructuralGuard active not]]", bindings: 'workspace' });
    const next = await host.request(session, 'prepareRefactoring', { action: 'renameMethod', target, options: { newSelector: 'renamedAnswer' } }, long);
    const nextIdentity = { id: crypto.randomUUID(), digest: 'b'.repeat(64) };
    await host.request(session, 'prepareMutation', { ...nextIdentity, action: 'applyRefactoring', params: { token: next.token } });
    await host.request(session, 'commitMutation', nextIdentity, long);
    await host.request(session, 'commitMutation', { ...nextIdentity, acknowledge: true });
    return { failure, restored, next: await host.request(session, 'evaluate', { source: 'object renamedAnswer = 42', bindings: 'workspace' }) };
  }, fixture, { limits: { operationMs: 5000 } });
  expect(result.failure.code).toBe('TIMEOUT');
  expect(result.restored.value.booleanValue).toBe(true);
  expect(result.next.value.booleanValue).toBe(true);
});

test('ordinary terminal and raw-file code keep native synchronous notification semantics', async ({ page }) => {
  const result = await run(page, async ({ workspace }) => {
    await workspace.evaluate('listener := SEBookGuardListener new. SystemChangeNotifier uniqueInstance notify: listener ofAllSystemChangesUsing: #changed:');
    const composite = "(RBCompositeRefactoryChange new addChange: (RBAddInstanceVariableChange add: 'part' to: SEBookGuardA); addChange: (RBAddInstanceVariableChange add: 'part' to: SEBookGuardB); yourself)";
    const start = performance.now();
    const warm = await workspace.evaluate('21 + 21');
    const warmMilliseconds = performance.now() - start;
    await workspace.evaluate('inverse := ' + composite + ' execute');
    const terminal = await workspace.evaluate('listener seen includes: #(true false false)');
    await workspace.evaluate('inverse execute. listener initialize');
    const file = { path: '/ordinary.st', kind: 'source', format: 'doit', content: 'Smalltalk at: #SEBookGuardRawActive put: SEBookStructuralGuard active. ' + composite + ' execute' };
    await workspace.commit({ baseRevision: workspace.snapshot().revision, action: 'acceptFile', params: { file } });
    const raw = await workspace.evaluate('(Smalltalk at: #SEBookGuardRawActive) not and: [listener seen includes: #(true false false)]');
    return { warm, warmMilliseconds, terminal, raw };
  });
  expect(result.warm.value.text).toBe('42');
  expect(result.terminal.value.booleanValue).toBe(true);
  expect(result.raw.error).toBeNull();
  expect(result.raw.value.booleanValue).toBe(true);
  console.log('Warm Smalltalk Evaluate milliseconds:', result.warmMilliseconds);
});

test('an unchanged physical class definition does not reject a retained learner closure', async ({ page }) => {
  const result = await run(page, async ({ workspace }) => {
    await workspace.evaluate('held := SEBookGuardA new retained');
    await workspace.commit({ baseRevision: workspace.snapshot().revision, action: 'acceptClass', params: {
      target: { kind: 'class', className: 'SEBookGuardA', side: 'instance' },
      source: "Object subclass: #SEBookGuardA instanceVariableNames: 'original' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Guard-Tests'"
    } });
    return workspace.evaluate('held value isNil and: [SEBookStructuralGuard active not]');
  });
  expect(result.value.booleanValue).toBe(true);
});
