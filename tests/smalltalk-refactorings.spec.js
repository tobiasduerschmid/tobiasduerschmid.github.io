const { test, expect } = require('@playwright/test');
const features = require('./helpers/smalltalk-features');
test.skip(!features.refactorings, 'Native refactoring is deferred by the production capability.');
const fs = require('node:fs');
const path = require('node:path');
const { installSmalltalk } = require('./helpers/smalltalk-runtime');
test.setTimeout(180000);
const fixture = fs.readFileSync(path.join(__dirname, 'fixtures/smalltalk/refactorings.st'), 'utf8');
const program = { version: 1, stepKey: 'refactorings', revision: 0, files: [{ path: '/refactorings.st', kind: 'source', format: 'filein', content: fixture }], changes: { version: 1, source: '', entries: [] }, runCommand: null };
async function run(page, scenario, context = null) {
  await installSmalltalk(page);
  await page.addScriptTag({ url: '/js/smalltalk/workspace.js' });
  // Missing module is the expected initial RED; assertions below require the native API.
  await page.addScriptTag({ url: '/js/smalltalk/refactorings.js' });
  return page.evaluate(async ({ program, scenario, context }) => {
    const runtime = await SEBookSmalltalk.RuntimeHost.create({ manifestURL: '/js/vendor/smalltalk/manifest.json' });
    const initialProgram = context && context.fixtureCase ? { ...program, files: [...program.files, { path: '/catalog.st', kind: 'source', format: 'filein', content: context.source }] } : program;
    const workspace = await SEBookSmalltalk.Workspace.create({ runtime, program: initialProgram });
    const refactorings = SEBookSmalltalk.Refactorings.create(workspace);
    const target = { kind: 'method', className: 'SEBookRenameTarget', side: 'instance', selector: 'oldSelector', packageName: 'SEBook-Refactor-Target' };
    try { return await (0, eval)('(' + scenario + ')')({ workspace, runtime, refactorings, target, context }); }
    finally { workspace.dispose(); runtime.dispose(); }
  }, { program, scenario: scenario.toString(), context });
}

test('native rename previews without mutation and supports Apply Undo Redo', async ({ page }) => {
  const result = await run(page, async ({ workspace, runtime, refactorings, target }) => {
    const source = async target => (await workspace.browse({ kind: 'source', target, offset: 0, limit: 10 })).source;
    await workspace.evaluate('object := SEBookRenameChild new. object saved: 73');
    const sourceBefore = await source(target);
    const catalog = await refactorings.catalog(target);
    const preview = await refactorings.prepare({ action: 'renameMethod', target, options: { newSelector: 'newSelector' } });
    const sourceAfterPreview = await source(target);
    const before = await workspace.evaluate('object oldSelector = 42 and: [object saved = 73]');
    const applied = await refactorings.apply(preview);
    const senderSource = await source({ ...target, className: 'SEBookRenameCaller', selector: 'call:' });
    const result = await workspace.evaluate('(SEBookRenameCaller new call: object) = 42 and: [object saved = 73]');
    const appliedHistory = refactorings.historyState();
    const replay = await runtime.withFreshSession(async session => {
      await runtime.loadProgram(session, applied);
      return runtime.request(session, 'evaluate', { source: '(SEBookRenameCaller new call: SEBookRenameChild new) = 42', bindings: 'isolated' });
    });
    await refactorings.undo();
    const undone = await source(target);
    const undoneSender = await source({ ...target, className: 'SEBookRenameCaller', selector: 'call:' });
    const undoneHistory = refactorings.historyState();
    await refactorings.redo();
    const redone = await workspace.evaluate('object newSelector = 42');
    await workspace.commit({ baseRevision: workspace.snapshot().revision, action: 'acceptMethod', params: { target: { ...target, selector: 'newSelector' }, source: 'newSelector ^ 43', protocol: 'accessing' } });
    return { catalog, sourceBefore, sourceAfterPreview, before, preview, senderSource, result, replay, appliedHistory, undone, undoneSender, undoneHistory, redone, history: refactorings.historyState() };
  });
  expect(result.sourceAfterPreview).toBe(result.sourceBefore);
  expect(result.before.value.booleanValue).toBe(true);
  expect(result.catalog.find(action => action.action === 'renameMethod')).toMatchObject({ applicable: true, options: { inputs: [{ name: 'newSelector', type: 'text', required: true }] } });
  expect(result.preview.changes.entries.some(entry => entry.entity.className === 'SEBookRenameChild')).toBe(true);
  expect(result.preview.changes.entries.some(entry => entry.entity.className === 'SEBookRenameCaller')).toBe(true);
  expect(result.preview.warnings.join(' ')).toMatch(/dynamic/i);
  expect(result.preview.warnings.join(' ')).toContain('SEBook-Refactor-Outside');
  expect(result.senderSource).toContain('newSelector');
  expect(result.result.value.booleanValue).toBe(true);
  expect(result.replay.value.booleanValue).toBe(true);
  expect(result.appliedHistory.canUndo).toBe(true);
  expect(result.undone).toBe(result.sourceBefore);
  expect(result.undoneSender).toContain('oldSelector');
  expect(result.undoneHistory).toMatchObject({ canUndo: false, canRedo: true });
  expect(result.redone.value.booleanValue).toBe(true);
  expect(result.history).toMatchObject({ canUndo: false, canRedo: false });
});

test('collision, stale and cancelled previews reject without changing accepted code', async ({ page }) => {
  const result = await run(page, async ({ workspace, refactorings, target }) => {
    const rename = newSelector => refactorings.prepare({ action: 'renameMethod', target, options: { newSelector } });
    const collision = await rename('collision').catch(error => ({ code: error.code }));
    const cancelled = await rename('newSelector'); await refactorings.cancel(cancelled);
    const cancelError = await refactorings.apply(cancelled).catch(error => ({ code: error.code }));
    const stale = await rename('newSelector');
    await workspace.commit({ baseRevision: 0, action: 'acceptMethod', params: { target, source: 'oldSelector ^ 52', protocol: 'accessing' } });
    const accepted = workspace.snapshot();
    const staleError = await refactorings.apply(stale).catch(error => ({ code: error.code }));
    const unchanged = await workspace.evaluate('(SEBookRenameTarget new oldSelector = 52) and: [(SEBookRenameTarget includesSelector: #newSelector) not]');
    return { collision, cancelError, staleError, accepted, after: workspace.snapshot(), unchanged };
  });
  expect(result.collision.code).toBe('PRECONDITION_FAILED');
  expect(result.cancelError.code).toBe('PRECONDITION_FAILED');
  expect(result.staleError.code).toBe('STALE_REVISION');
  expect(result.after).toEqual(result.accepted);
  expect(result.unchanged.value.booleanValue).toBe(true);
});

test('failed native composite restores definitions, object relationships, state and filesystem', async ({ page }) => {
  const result = await run(page, async ({ workspace, refactorings, target }) => {
    await workspace.evaluate("object := SEBookRenameTarget new. shared := Array with: 73 with: nil. shared at: 2 put: shared. object saved: shared. alias := object. FileStream forceNewFileNamed: '/refactoring.txt' do: [:stream | stream nextPutAll: 'original']");
    const before = workspace.snapshot();
    const preview = await refactorings.prepare({ action: 'renameMethod', target, options: { newSelector: 'newSelector' } });
    const injected = await workspace.evaluate("SEBookFailureChange injectInto: '" + preview.token + "'");
    const failure = await refactorings.apply(preview).catch(error => ({ code: error.code, message: error.message }));
    const restored = await workspace.evaluate("(SEBookRenameTarget instVarNames = #('saved')) and: [object == alias and: [object saved == shared and: [shared first = 73 and: [shared second == shared and: [(FileStream readOnlyFileNamed: '/refactoring.txt' do: [:stream | stream contents]) = 'original' and: [object oldSelector = 41 and: [(SEBookRenameTarget includesSelector: #newSelector) not]]]]]]]");
    return { before, after: workspace.snapshot(), injected, failure, restored, history: refactorings.historyState() };
  });
  expect(result.injected.error).toBeNull();
  expect(result.failure.code).toBe('RECOVERED_FAILURE');
  expect(result.failure.message).toContain('Controlled composite failure');
  expect(result.after).toEqual(result.before);
  expect(result.restored.error).toBeNull();
  expect(result.restored.value.booleanValue).toBe(true);
  expect(result.history).toMatchObject({ canUndo: false, canRedo: false });
});

test('native source selections and Undo retain original text after mutable source corruption', async ({ page }) => {
  const result = await run(page, async ({ workspace, refactorings, target }) => {
    target = { ...target, selector: 'localValue' };
    const query = { kind: 'source', target, offset: 0, limit: 10 };
    const original = (await workspace.browse(query)).source;
    const truncated = await workspace.evaluate('FileStream fileNamed: (SourceFiles at: 2) name do: [:stream | stream truncate: 0]. true');
    const retained = (await workspace.browse(query)).source;
    const start = retained.indexOf('| local') + 2;
    const preview = await refactorings.prepare({ action: 'renameTemporary', target, selection: { start, end: start + 5 }, options: { newName: 'renamedLocal' } });
    const beforeApply = (await workspace.browse(query)).source;
    await refactorings.apply(preview);
    const renamed = (await workspace.browse(query)).source;
    const behavior = await workspace.evaluate('SEBookRenameTarget new localValue = 42');
    await refactorings.undo();
    const undone = (await workspace.browse(query)).source;
    return { original, truncated, retained, beforeApply, renamed, behavior, undone };
  });
  expect(result.truncated.value.booleanValue).toBe(true);
  expect(result.retained).toBe(result.original);
  expect(result.beforeApply).toBe(result.original);
  expect(result.renamed).toContain('renamedLocal');
  expect(result.renamed).toContain('😀');
  expect(result.behavior.value.booleanValue).toBe(true);
  expect(result.undone).toBe(result.original);
});

test('selected upstream AST and Refactoring Browser SUnit tests pass in SqueakJS', async ({ page }, testInfo) => {
  const { withSmalltalk } = require('./helpers/smalltalk-runtime');
  const result = await withSmalltalk(page, async (runtime, unused, events) => {
    const session = await runtime.openSession('live');
    const evaluation = await runtime.request(session, 'evaluate', { source: "| suite result | suite := TestSuite named: 'SEBook native refactoring proof'. #((RBParserTest testPositions) (RBParserTest testIntervals) (RBParserTest testReadBeforeWritten) (RBRenameMethodTest testExistingSelector) (RBRenameMethodTest testRenameTestMethod) (RBRenameMethodTest testRenamePermuteArgs) (RBRenameTemporaryTest testBadInterval) (RBRenameTemporaryTest testRenameTemporary)) do: [:pair | suite addTest: ((Smalltalk at: pair first) selector: pair second)]. result := suite run. Transcript show: result printString; cr. result failures do: [:each | Transcript show: each printString; cr]. result errors do: [:each | Transcript show: each printString; cr]. result runCount = 8 and: [result failureCount = 0 and: [result errorCount = 0]]", bindings: 'isolated' });
    return { evaluation, output: events.items.filter(event => event.type === 'output').map(event => event.payload.text).join('') };
  });
  console.log('Native upstream SUnit:', result.output.trim());
  await testInfo.attach('native-sunit-results', { body: result.output, contentType: 'text/plain' });
  expect(result.evaluation.error, result.output).toBeNull();
  expect(result.evaluation.value.booleanValue, result.output).toBe(true);
});

test('native Browser current source remains available before a Program is loaded', async ({ page }) => {
  const { withSmalltalk } = require('./helpers/smalltalk-runtime');
  const result = await withSmalltalk(page, async runtime => {
    const session = await runtime.openSession('live');
    return runtime.request(session, 'browse', { kind: 'source', target: { kind: 'method', className: 'Object', side: 'instance', selector: 'yourself' }, offset: 0, limit: 10 });
  });
  expect(result.source).toContain('Answer self.');
});


for (const kind of ['comment', 'resource', 'raw source', 'recategorization']) {
  test(`ordinary accepted ${kind} edit invalidates native refactoring history`, async ({ page }) => {
    const result = await run(page, async ({ workspace, refactorings, target, context: kind }) => {
      await refactorings.apply(await refactorings.prepare({ action: 'renameMethod', target, options: { newSelector: 'newSelector' } }));
      // Cover both sides of the native history boundary: resource edits clear Redo.
      if (kind === 'resource') await refactorings.undo();
      const before = refactorings.historyState();
      let edit;
      if (kind === 'recategorization') {
        edit = await workspace.evaluate("SEBookRenameTarget organization classify: #newSelector under: #'review-protocol'");
      } else {
        const mutation = kind === 'comment'
          ? { action: 'acceptComment', params: { target: { ...target, kind: 'comment' }, source: 'Later accepted documentation.' } }
          : { action: 'acceptFile', params: { file: kind === 'resource'
            ? { path: '/history-resource.txt', kind: 'resource', format: null, content: 'Later accepted resource.' }
            : { path: '/history-source.st', kind: 'source', format: 'doit', content: 'true' } } };
        edit = await workspace.commit({ baseRevision: workspace.snapshot().revision, ...mutation });
      }
      const accepted = workspace.snapshot();
      const history = refactorings.historyState();
      const rejected = await (kind === 'resource' ? refactorings.redo() : refactorings.undo()).catch(error => ({ code: error.code }));
      const unchanged = await workspace.evaluate(kind === 'resource'
        ? 'SEBookRenameTarget new oldSelector = 41 and: [(SEBookRenameTarget includesSelector: #newSelector) not]'
        : 'SEBookRenameTarget new newSelector = 41 and: [(SEBookRenameTarget includesSelector: #oldSelector) not]');
      const retainedEdit = kind === 'comment'
        ? (await workspace.browse({ kind: 'source', target: { ...target, kind: 'comment' }, offset: 0, limit: 10 })).source
        : kind === 'recategorization'
          ? (await workspace.evaluate('SEBookRenameTarget organization categoryOfElement: #newSelector')).value.text
          : workspace.snapshot().files.find(file => file.path.startsWith('/history-')).content;
      return { before, edit, history, rejected, accepted, after: workspace.snapshot(), unchanged, retainedEdit };
    }, kind);
    expect(result.before[kind === 'resource' ? 'canRedo' : 'canUndo']).toBe(true);
    expect(result.history).toMatchObject({ canUndo: false, canRedo: false });
    expect(result.history.reason).toMatch(/ordinary accepted.*edit/i);
    expect(result.rejected.code).toBe('PRECONDITION_FAILED');
    expect(result.after).toEqual(result.accepted);
    expect(result.unchanged.value.booleanValue).toBe(true);
    expect(result.retainedEdit).toBe({ comment: 'Later accepted documentation.', resource: 'Later accepted resource.', 'raw source': 'true', recategorization: 'review-protocol' }[kind]);
    if (kind === 'recategorization') expect(result.edit.codeChanges.entries.some(entry => entry.entity.protocol === 'review-protocol')).toBe(true);
  });
}

test('object-only evaluation preserves native refactoring history and latest object state', async ({ page }) => {
  const result = await run(page, async ({ workspace, refactorings, target }) => {
    await workspace.evaluate('object := SEBookRenameTarget new. object saved: 73');
    await refactorings.apply(await refactorings.prepare({ action: 'renameMethod', target, options: { newSelector: 'newSelector' } }));
    const accepted = workspace.snapshot();
    const evaluation = await workspace.evaluate('object saved: 123. object saved = 123');
    await workspace.browse({ kind: 'source', target: { ...target, selector: 'newSelector' }, offset: 0, limit: 10 });
    const history = refactorings.historyState();
    const afterEvaluation = workspace.snapshot();
    await refactorings.undo();
    const undone = await workspace.evaluate('object oldSelector = 41 and: [object saved = 123]');
    return { evaluation, accepted, afterEvaluation, history, undone };
  });
  expect(result.evaluation.value.booleanValue).toBe(true);
  expect(result.evaluation.codeChanges).toBeNull();
  expect(result.afterEvaluation).toEqual(result.accepted);
  expect(result.history).toMatchObject({ canUndo: true, canRedo: false });
  expect(result.undone.value.booleanValue).toBe(true);
});

test('failed ordinary source edit restores native refactoring history with accepted source', async ({ page }) => {
  const result = await run(page, async ({ workspace, refactorings, target }) => {
    await refactorings.apply(await refactorings.prepare({ action: 'renameMethod', target, options: { newSelector: 'newSelector' } }));
    const accepted = workspace.snapshot();
    const failure = await workspace.commit({ baseRevision: accepted.revision, action: 'acceptClass', params: {
      target: { ...target, kind: 'class' }, source: "SEBookRenameTarget compile: 'newSelector ^ 99' classified: 'changed'. Error signal: 'Controlled ordinary edit failure'",
    } }).catch(error => ({ code: error.code, message: error.message }));
    const history = refactorings.historyState();
    const recovered = workspace.snapshot();
    const behavior = await workspace.evaluate('SEBookRenameTarget new newSelector = 41');
    await refactorings.undo();
    const undone = await workspace.evaluate('SEBookRenameTarget new oldSelector = 41');
    return { accepted, failure, history, recovered, behavior, undone };
  });
  expect(result.failure.code).toBe('RECOVERED_FAILURE');
  expect(result.failure.message).toContain('Controlled ordinary edit failure');
  expect(result.recovered).toEqual(result.accepted);
  expect(result.history).toMatchObject({ canUndo: true, canRedo: false });
  expect(result.behavior.value.booleanValue).toBe(true);
  expect(result.undone.value.booleanValue).toBe(true);
});

const catalogCases = require('./fixtures/smalltalk/refactoring-cases.json');
const catalogSource = fs.readFileSync(path.join(__dirname, 'fixtures/smalltalk/refactoring-catalog.st'), 'utf8');
const approvedActions = ['renameClass', 'renameMethod', 'renameInstanceVariable', 'renameClassVariable', 'renameTemporary', 'renameArgument', 'extractMethod', 'extractTemporary', 'inlineMethod', 'inlineTemporary', 'moveMethod', 'moveVariable', 'pullUpMethod', 'pushDownMethod', 'pullUpVariable', 'pushDownVariable', 'addParameter', 'removeParameter', 'reorderParameters', 'addClass', 'removeClass', 'addMethod', 'removeMethod', 'createAccessors', 'splitClass'];

test('catalog covers every approved action and every enabled action has a real-image fixture', async ({ page }) => {
  const catalog = await run(page, ({ refactorings, target }) => refactorings.catalog(target));
  expect(catalog.map(entry => entry.action).sort()).toEqual([...approvedActions].sort());
  expect(catalog.filter(entry => entry.applicable).map(entry => entry.action).sort()).toEqual([...new Set(catalogCases.map(entry => entry.action))].sort());
  expect(catalog.find(entry => entry.action === 'splitClass')).toMatchObject({ applicable: false, reason: expect.stringMatching(/migration|scheduling/) });
});

for (const fixtureCase of catalogCases) {
  test(fixtureCase.action + ' preserves the declared behavior and rejects invalid targets' + (fixtureCase.variant ? ' — ' + fixtureCase.variant : ''), async ({ page }, testInfo) => {
    const result = await run(page, async ({ workspace, runtime, refactorings, context }) => {
      const { fixtureCase: item } = context;
      const stage = async (name, operation) => { try { return await operation(); } catch (error) { throw Error(name + ': ' + error.message); } };
      if (item.setup) {
        const setup = await workspace.evaluate(item.setup);
        if (setup.error) throw Error('Fixture setup: ' + setup.error.message);
      }
      const accepted = workspace.snapshot();
      const request = { action: item.action, target: item.target, options: item.options };
      if (item.select) {
        const source = (await workspace.browse({ kind: 'source', target: item.target, offset: 0, limit: 1 })).source;
        const start = source.indexOf(item.select);
        if (start < 0) throw Error('Fixture selection absent');
        request.selection = { start, end: start + (item.selectionLength || item.select.length) };
      }
      const selectedSource = async () => (await workspace.browse({ kind: 'source', target: item.target, offset: 0, limit: 1 })).source;
      const originalSource = await selectedSource();
      const observedSources = async () => Promise.all((item.observeTargets || []).map(async target => (await workspace.browse({ kind: 'source', target, offset: 0, limit: 1 })).source));
      const originalObservedSources = await observedSources();
      const invalid = await refactorings.prepare({ ...request, ...item.invalid }).catch(error => ({ code: error.code, message: error.message }));
      const preview = await refactorings.prepare(request);
      const afterPreview = workspace.snapshot();
      const previewSource = await selectedSource();
      const before = await workspace.evaluate(item.before);
      const applied = await stage('apply', () => refactorings.apply(preview));
      const postcondition = await workspace.evaluate(item.postcondition);
      const changedSource = (item.sourceContains || item.sourceExcludes) ? await selectedSource() : null;
      const appliedHistory = refactorings.historyState();
      let replay = null;
      if (item.replay) replay = await runtime.withFreshSession(async session => {
        await stage('fresh replay', () => runtime.loadProgram(session, applied));
        return runtime.request(session, 'evaluate', { source: item.replay, bindings: 'isolated' });
      });
      await stage('undo', () => refactorings.undo());
      const undone = await workspace.evaluate(item.undo || item.before);
      const undoneSource = await selectedSource();
      const undoneObservedSources = await observedSources();
      await stage('redo', () => refactorings.redo());
      if (item.redoSetup) await workspace.evaluate(item.redoSetup);
      const redone = await workspace.evaluate(item.postcondition);
      const repeated = [];
      if (item.repeatHistory) {
        await stage('second undo', () => refactorings.undo());
        repeated.push(await workspace.evaluate(item.undo || item.before));
        if (JSON.stringify(await observedSources()) !== JSON.stringify(originalObservedSources)) throw Error('Second Undo changed original source');
        await stage('second redo', () => refactorings.redo());
        repeated.push(await workspace.evaluate(item.postcondition));
      }
      return { originalObservedSources, undoneObservedSources, repeated, preview, accepted, afterPreview, invalid, before, postcondition, appliedHistory, undone, redone, replay, originalSource, previewSource, undoneSource, changedSource };
    }, { fixtureCase, source: catalogSource });
    await testInfo.attach('native-preview', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
    expect(result.invalid.code, result.invalid.message).toBe('PRECONDITION_FAILED');
    expect(result.afterPreview).toEqual(result.accepted);
    expect(result.previewSource).toBe(result.originalSource);
    expect(result.undoneSource).toBe(result.originalSource);
    expect(result.undoneObservedSources).toEqual(result.originalObservedSources);
    expect(result.before.error).toBeNull();
    expect(result.before.value.booleanValue).toBe(true);
    const actualTargets = [...new Set(result.preview.changes.entries.map(({ entity }) => entity.className + '.' + entity.side + (entity.kind === 'method' ? '>>' + entity.selector : '')))].sort();
    expect(actualTargets).toEqual(fixtureCase.expectedTargets);
    for (const text of fixtureCase.sourceContains || []) expect(result.changedSource).toContain(text);
    for (const text of fixtureCase.sourceExcludes || []) expect(result.changedSource).not.toContain(text);
    for (const repeat of result.repeated) { expect(repeat.error).toBeNull(); expect(repeat.value.booleanValue).toBe(true); }
    expect(result.postcondition.error).toBeNull();
    expect(result.postcondition.value.booleanValue).toBe(true);
    expect(result.appliedHistory.canUndo).toBe(true);
    expect(result.undone.error).toBeNull();
    expect(result.undone.value.booleanValue).toBe(true);
    expect(result.redone.error).toBeNull();
    expect(result.redone.value.booleanValue).toBe(true);
    if (fixtureCase.replay) {
      expect(result.replay.error).toBeNull();
      expect(result.replay.value.booleanValue).toBe(true);
    }
  });
}

test('parameter permutation rejects effectful arguments before changing callers', async ({ page }) => {
  const fixtureCase = catalogCases.find(item => item.action === 'reorderParameters');
  const result = await run(page, async ({ workspace, refactorings, context }) => {
    const item = context.fixtureCase;
    await workspace.commit({ baseRevision: workspace.snapshot().revision, action: 'acceptMethod', params: {
      target: { ...item.target, selector: 'catEffects:' }, protocol: 'catalog partitions',
      source: 'catEffects: log ^ self catPair: (log add: 4) with: (log add: 2)',
    } });
    const accepted = workspace.snapshot();
    const rejected = await refactorings.prepare({ action: item.action, target: item.target, options: item.options }).catch(error => ({ code: error.code, message: error.message }));
    const result = await workspace.evaluate('effects := OrderedCollection new. (SECatalogTarget new catEffects: effects) = 42 and: [effects asArray = #(4 2)]');
    return { accepted, after: workspace.snapshot(), rejected, result };
  }, { fixtureCase, source: catalogSource });
  expect(result.rejected).toMatchObject({ code: 'PRECONDITION_FAILED', message: expect.stringMatching(/temporaries.*evaluation order/) });
  expect(result.after).toEqual(result.accepted);
  expect(result.result.value.booleanValue).toBe(true);
});

test('moving primitive or super-dependent methods rejects before mutation', async ({ page }) => {
  const fixtureCase = catalogCases.find(item => item.action === 'moveMethod');
  const result = await run(page, async ({ workspace, refactorings, context }) => {
    const item = context.fixtureCase; const before = workspace.snapshot(); const errors = [];
    for (const selector of ['catMovePrimitive:', 'catMoveSuper:']) errors.push(await refactorings.prepare({ action: item.action, target: { ...item.target, selector }, options: item.options }).catch(error => ({ code: error.code, message: error.message })));
    return { before, after: workspace.snapshot(), errors };
  }, { fixtureCase, source: catalogSource });
  expect(result.after).toEqual(result.before);
  expect(result.errors.map(error => error.code)).toEqual(['PRECONDITION_FAILED', 'PRECONDITION_FAILED']);
});

test('an unadaptable native inverse restores accepted source and native history after execution', async ({ page }) => {
  const result = await run(page, async ({ workspace, refactorings, target }) => {
    const accepted = workspace.snapshot();
    const preview = await refactorings.prepare({ action: 'renameMethod', target, options: { newSelector: 'newSelector' } });
    await workspace.evaluate("SEBookUnadaptableInverseChange injectInto: '" + preview.token + "'");
    const error = await refactorings.apply(preview).catch(error => ({ code: error.code, message: error.message }));
    const behavior = await workspace.evaluate('SEBookRenameTarget new oldSelector = 41 and: [(SEBookRenameTarget includesSelector: #newSelector) not]');
    const source = await workspace.browse({ kind: 'source', target, offset: 0, limit: 1 });
    return { accepted, after: workspace.snapshot(), error, behavior, source: source.source, history: refactorings.historyState() };
  });
  expect(result.error.message).toContain('no verified source preview adapter');
  expect(result.after).toEqual(result.accepted);
  expect(result.behavior.value.booleanValue).toBe(true);
  expect(result.source).toBe('oldSelector ^ 41');
  expect(result.history).toMatchObject({ canUndo: false, canRedo: false });
});

test('a selection inside a UTF-16 surrogate pair is rejected without changing source', async ({ page }) => {
  const result = await run(page, async ({ workspace, refactorings, target }) => {
    target = { ...target, selector: 'localValue' };
    const accepted = workspace.snapshot();
    const source = (await workspace.browse({ kind: 'source', target, offset: 0, limit: 1 })).source;
    const inside = source.indexOf('😀') + 1;
    const error = await refactorings.prepare({ action: 'renameTemporary', target, selection: { start: inside, end: inside + 1 }, options: { newName: 'renamed' } }).catch(error => ({ code: error.code, message: error.message }));
    return { accepted, after: workspace.snapshot(), error, source, afterSource: (await workspace.browse({ kind: 'source', target, offset: 0, limit: 1 })).source };
  });
  expect(result.error).toMatchObject({ code: 'PRECONDITION_FAILED', message: expect.stringContaining('UTF-16 boundaries') });
  expect(result.after).toEqual(result.accepted);
  expect(result.afterSource).toBe(result.source);
});


test('removing a parameter rejects effectful caller arguments without changing accepted behavior', async ({ page }) => {
  const fixtureCase = catalogCases.find(item => item.action === 'removeParameter');
  const result = await run(page, async ({ workspace, refactorings, context }) => {
    const item = context.fixtureCase;
    await workspace.commit({ baseRevision: workspace.snapshot().revision, action: 'acceptMethod', params: {
      target: { ...item.target, selector: 'catRemoveEffects:' }, protocol: 'catalog boundaries',
      source: 'catRemoveEffects: log ^ self catUnused: 40 with: (log add: 7)',
    } });
    const accepted = workspace.snapshot();
    const error = await refactorings.prepare({ action: item.action, target: item.target, options: item.options }).catch(error => ({ code: error.code, message: error.message }));
    const behavior = await workspace.evaluate('effects := OrderedCollection new. (SECatalogTarget new catRemoveEffects: effects) = 42 and: [effects asArray = #(7)]');
    return { accepted, after: workspace.snapshot(), error, behavior };
  }, { fixtureCase, source: catalogSource });
  expect(result.error).toMatchObject({ code: 'PRECONDITION_FAILED', message: expect.stringMatching(/temporaries.*discard/) });
  expect(result.after).toEqual(result.accepted);
  expect(result.behavior.value.booleanValue).toBe(true);
});

for (const item of [
  { name: 'duplicate', source: 'catTempEffects: log | answer | answer := log add: 7. ^ answer + answer', behavior: '(SECatalogTarget new catTempEffects: effects) = 14 and: [effects asArray = #(7)]' },
  { name: 'defer', source: 'catTempEffects: log | answer | answer := log add: 7. log add: 8. ^ answer', behavior: '(SECatalogTarget new catTempEffects: effects) = 7 and: [effects asArray = #(7 8)]' },
]) {
  test('temporary inlining rejects expressions that would ' + item.name + ' side effects', async ({ page }) => {
    const fixtureCase = catalogCases.find(entry => entry.action === 'inlineTemporary');
    const result = await run(page, async ({ workspace, refactorings, context }) => {
      const { fixtureCase, boundary } = context;
      const target = { ...fixtureCase.target, selector: 'catTempEffects:' };
      await workspace.commit({ baseRevision: workspace.snapshot().revision, action: 'acceptMethod', params: { target, source: boundary.source, protocol: 'catalog boundaries' } });
      const accepted = workspace.snapshot(); const assignment = 'answer := log add: 7'; const start = boundary.source.indexOf(assignment);
      const error = await refactorings.prepare({ action: 'inlineTemporary', target, options: {}, selection: { start, end: start + assignment.length } }).catch(error => ({ code: error.code, message: error.message }));
      const behavior = await workspace.evaluate('effects := OrderedCollection new. ' + boundary.behavior);
      return { accepted, after: workspace.snapshot(), error, behavior };
    }, { fixtureCase, source: catalogSource, boundary: item });
    expect(result.error).toMatchObject({ code: 'PRECONDITION_FAILED', message: expect.stringMatching(/duplicate or defer side effects/) });
    expect(result.after).toEqual(result.accepted);
    expect(result.behavior.value.booleanValue).toBe(true);
  });
}

test('field rename preview replays ordered storage and a later failure restores retained instances', async ({ page }) => {
  const fixtureCase = catalogCases.find(item => item.action === 'renameInstanceVariable');
  const result = await run(page, async ({ workspace, runtime, refactorings, context }) => {
    const item = context.fixtureCase;
    await workspace.evaluate(item.setup);
    const accepted = workspace.snapshot();
    const preview = await refactorings.prepare({ action: item.action, target: item.target, options: item.options });
    const replay = await runtime.withFreshSession(async session => {
      await runtime.loadProgram(session, { ...accepted, changes: preview.changes });
      return runtime.request(session, 'evaluate', { source: "SECatalogTarget instVarNames = #('retained' 'spare') and: [(SECatalogChild new catStored: 42; catStored) = 42]", bindings: 'isolated' });
    });
    await workspace.evaluate("SEBookPostExecutionFailureChange injectAfter: '" + preview.token + "'");
    const error = await refactorings.apply(preview).catch(error => ({ code: error.code, message: error.message }));
    const restored = await workspace.evaluate(item.undo);
    return { accepted, after: workspace.snapshot(), replay, error, restored, history: refactorings.historyState() };
  }, { fixtureCase, source: catalogSource });
  expect(result.replay.error).toBeNull(); expect(result.replay.value.booleanValue).toBe(true);
  expect(result.error.message).toContain('Controlled failure after native rename');
  expect(result.after).toEqual(result.accepted);
  expect(result.restored.error).toBeNull(); expect(result.restored.value.booleanValue).toBe(true);
  expect(result.history).toMatchObject({ canUndo: false, canRedo: false });
});

test('cumulative class-variable pull-up and child removal replay after native history', async ({ page }) => {
  const fixtureCase = catalogCases.find(item => item.action === 'pullUpVariable' && item.variant === 'class variable');
  const result = await run(page, async ({ workspace, runtime, refactorings, context }) => {
    const item = context.fixtureCase;
    await refactorings.apply(await refactorings.prepare({ action: item.action, target: item.target, options: item.options }));
    const removal = await refactorings.prepare({ action: 'removeClass', target: { kind: 'class', className: 'SECatalogClassVarChild', side: 'instance' }, options: {} });
    await refactorings.apply(removal);
    const checkRemoved = "(SECatalogClassVarParent classVarNames includes: #ClassNumber) and: [(Smalltalk includesKey: #SECatalogClassVarChild) not]";
    const replay = async () => runtime.withFreshSession(async session => {
      await runtime.loadProgram(session, workspace.snapshot());
      return runtime.request(session, 'evaluate', { source: checkRemoved, bindings: 'isolated' });
    });
    const firstReplay = await replay();
    await refactorings.undo();
    const undone = await workspace.evaluate("SECatalogClassVarChild new catNumber: 42. SECatalogClassVarChild classVarNames isEmpty and: [SECatalogClassVarChild new catNumber = 42]");
    await refactorings.redo();
    return { firstReplay, undone, redone: await workspace.evaluate(checkRemoved), secondReplay: await replay() };
  }, { fixtureCase, source: catalogSource });
  for (const value of Object.values(result)) {
    expect(value.error).toBeNull();
    expect(value.value.booleanValue).toBe(true);
  }
});
