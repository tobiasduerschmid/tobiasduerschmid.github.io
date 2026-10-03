const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { installSmalltalk } = require('./helpers/smalltalk-runtime');
test.setTimeout(180000);

const program = {
  version: 1, stepKey: 'structural-source-replay', revision: 0,
  files: [{ path: '/source-replay.st', kind: 'source', format: 'filein', content: fs.readFileSync(path.join(__dirname, 'fixtures/smalltalk/source-replay.st'), 'utf8') }],
  changes: { version: 1, source: '', entries: [] }, runCommand: null,
};

/** Real native Workspace and leased fresh images; only fixture plumbing is shared. */
async function withWorkspace(page, scenario) {
  await installSmalltalk(page);
  await page.addScriptTag({ url: '/js/smalltalk/workspace.js' });
  return page.evaluate(async ({ program, source }) => {
    const runtime = await SEBookSmalltalk.RuntimeHost.create({ manifestURL: '/js/vendor/smalltalk/manifest.json' });
    const workspace = await SEBookSmalltalk.Workspace.create({ runtime, program });
    const evaluate = async source => {
      const result = await workspace.evaluate(source);
      if (result.error) throw new Error(JSON.stringify({ source, error: result.error }));
      return result;
    };
    const replay = (accepted, source, targets = []) => runtime.withFreshSession(async session => {
      await runtime.loadProgram(session, accepted);
      const result = await runtime.request(session, 'evaluate', { source, bindings: 'isolated' });
      if (result.error) throw new Error(JSON.stringify({ source, error: result.error }));
      const sources = [];
      for (const target of targets) sources.push(await runtime.request(session, 'browse', { kind: 'source', target, offset: 0, limit: 1 }));
      return { result, sources };
    });
    try { return await (0, eval)('(' + source + ')')({ workspace, runtime, evaluate, replay }); }
    finally { workspace.dispose(); runtime.dispose(); }
  }, { program, source: scenario.toString() });
}

test('accepted instance and class-side source, protocols and method removals survive fresh replay', async ({ page }) => {
  const result = await withWorkspace(page, async ({ workspace, evaluate, replay }) => {
    const target = { kind: 'method', className: 'SEBookReplayTarget', side: 'instance', selector: 'value' };
    await workspace.commit({ baseRevision: 0, action: 'acceptMethod', params: { target, source: 'value "source-only change ! 😀" ^ 1', protocol: 'replay-source' } });
    await workspace.commit({ baseRevision: 1, action: 'acceptMethod', params: { target: { ...target, side: 'class', selector: 'answer' }, source: 'answer ^ 42', protocol: 'class-results' } });
    await workspace.commit({ baseRevision: 2, action: 'acceptMethod', params: { target: { ...target, selector: 'added' }, source: 'added ^ 5', protocol: 'accessing' } });
    await workspace.commit({ baseRevision: 3, action: 'acceptMethod', params: { target: { ...target, side: 'class', selector: 'added' }, source: 'added ^ 7', protocol: 'class-results' } });
    const metadataOnly = await evaluate("unchangedMethod := SEBookReplayTarget compiledMethodAt: #value. SEBookReplayTarget organization classify: #value under: 'recategorized-protocol'. SEBookReplayTarget removeSelector: #obsolete. SEBookReplayTarget class removeSelector: #obsolete. SEBookReplayTarget comment: 'Replay comment ! 😀'. unchangedMethod == (SEBookReplayTarget compiledMethodAt: #value)");
    const accepted = workspace.snapshot();
    const targets = [target, { ...target, side: 'class', selector: 'answer' }];
    const sources = [];
    for (const target of targets) sources.push(await workspace.browse({ kind: 'source', target, offset: 0, limit: 1 }));
    const source = "SEBookReplayTarget new value = 1 and: [SEBookReplayTarget answer = 42 and: [SEBookReplayTarget new added = 5 and: [SEBookReplayTarget added = 7 and: [(SEBookReplayTarget includesSelector: #obsolete) not and: [(SEBookReplayTarget class includesSelector: #obsolete) not and: [(SEBookReplayTarget organization categoryOfElement: #value) = #'recategorized-protocol' and: [(SEBookReplayTarget class organization categoryOfElement: #answer) = #'class-results' and: [SEBookReplayTarget organization classComment asString = 'Replay comment ! 😀']]]]]]]]";
    return { metadataOnly, live: await evaluate(source), sources, fresh: await replay(accepted, source, targets) };
  });
  expect(result.live.value.booleanValue).toBe(true);
  expect(result.metadataOnly.value.booleanValue).toBe(true);
  expect(result.fresh.result.value.booleanValue).toBe(true);
  expect(result.sources[0].source).toBe('value "source-only change ! 😀" ^ 1');
  for (let i = 0; i < result.sources.length; i++) expect(result.fresh.sources[i].source).toBe(result.sources[i].source);
});

test('class reshaping preserves aliases and retained fields while superclass replacement removes inherited slots', async ({ page }) => {
  const result = await withWorkspace(page, async ({ workspace, evaluate, replay }) => {
    await evaluate('counter := SEBookReplayTarget new. counter saved: 73; inherited: 41. alias := counter. true');
    const target = { kind: 'class', className: 'SEBookReplayTarget', side: 'instance' };
    await workspace.commit({ baseRevision: 0, action: 'acceptClass', params: { target, source: "SEBookReplayParent subclass: #SEBookReplayTarget instanceVariableNames: 'saved extra' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Replay-Tests'" } });
    const compatible = await evaluate("counter == alias and: [counter saved = 73 and: [counter inherited = 41 and: [counter class allInstVarNames = #('inherited' 'saved' 'extra')]]]");
    await workspace.commit({ baseRevision: 1, action: 'acceptClass', params: { target, source: "SEBookReplayAlternate subclass: #SEBookReplayTarget instanceVariableNames: 'saved extra' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Replay-Tests'" } });
    const retained = await evaluate("counter == alias and: [counter saved = 73 and: [counter class allInstVarNames = #('saved' 'extra')]]");
    const shape = "SEBookReplayTarget superclass == SEBookReplayAlternate and: [SEBookReplayTarget allInstVarNames = #('saved' 'extra') and: [(SEBookReplayTarget new saved: 88; saved) = 88]]";
    const source = await workspace.browse({ kind: 'source', target, offset: 0, limit: 1 });
    return { compatible, retained, live: await evaluate(shape), source, fresh: await replay(workspace.snapshot(), shape, [target]) };
  });
  for (const name of ['compatible', 'retained', 'live']) expect(result[name].value.booleanValue, name).toBe(true);
  expect(result.fresh.result.value.booleanValue).toBe(true);
  expect(result.fresh.sources[0].source).toBe(result.source.source);
});

test('native class rename and removal replay new names without resurrecting authored declarations', async ({ page }) => {
  const result = await withWorkspace(page, async ({ workspace, evaluate, replay }) => {
    await evaluate('SEBookReplayTarget rename: #SEBookReplayRenamed. Smalltalk removeClassNamed: #SEBookReplayGone. true');
    const target = { kind: 'method', className: 'SEBookReplayRenamed', side: 'class', selector: 'answer' };
    await workspace.commit({ baseRevision: workspace.snapshot().revision, action: 'acceptMethod', params: { target, source: 'answer ^ 42', protocol: 'accessing' } });
    const source = '(Smalltalk includesKey: #SEBookReplayTarget) not and: [(Smalltalk includesKey: #SEBookReplayGone) not and: [SEBookReplayRenamed new value = 1 and: [SEBookReplayRenamed answer = 42]]]';
    const liveSource = await workspace.browse({ kind: 'source', target, offset: 0, limit: 1 });
    return { live: await evaluate(source), liveSource, fresh: await replay(workspace.snapshot(), source, [target]) };
  });
  expect(result.live.value.booleanValue).toBe(true);
  expect(result.fresh.result.value.booleanValue).toBe(true);
  expect(result.fresh.sources[0].source).toBe(result.liveSource.source);
});

test('direct native method-dictionary replacement and removal are captured at the next Workspace boundary', async ({ page }) => {
  const result = await withWorkspace(page, async ({ workspace, evaluate, replay }) => {
    await evaluate('counter := SEBookReplayTarget new. counter value');
    // Real reflective edits intentionally bypass compiler and notifier paths.
    const mutation = await evaluate('SEBookReplayTarget methodDictionary at: #value put: (SEBookReplayDonor compiledMethodAt: #value). SEBookReplayTarget methodDictionary removeKey: #obsolete ifAbsent: []. SEBookReplayTarget flushCache. counter value');
    const accepted = workspace.snapshot();
    const target = { kind: 'method', className: 'SEBookReplayTarget', side: 'instance', selector: 'value' };
    const liveSource = await workspace.browse({ kind: 'source', target, offset: 0, limit: 1 });
    const source = 'SEBookReplayTarget new value = 99 and: [(SEBookReplayTarget includesSelector: #obsolete) not]';
    return { mutation, revision: accepted.revision, liveSource, fresh: await replay(accepted, source, [target]) };
  });
  expect(result.mutation.value.text).toBe('99');
  expect(result.revision).toBeGreaterThan(0);
  expect(result.fresh.result.value.booleanValue).toBe(true);
  expect(result.fresh.sources[0].source).toBe(result.liveSource.source);
});

test('silent compilation without original source replays native decompilation without claiming original text', async ({ page }) => {
  const result = await withWorkspace(page, async ({ workspace, evaluate, replay }) => {
    // Upstream compileSilently explicitly omits source logging and notifications.
    await evaluate("SEBookReplayTarget compileSilently: 'value \"original-source-marker\" ^ 23' classified: 'silent' notifying: nil. SEBookReplayTarget new value");
    const target = { kind: 'method', className: 'SEBookReplayTarget', side: 'instance', selector: 'value' };
    const liveSource = await workspace.browse({ kind: 'source', target, offset: 0, limit: 1 });
    const source = "SEBookReplayTarget new value = 23 and: [(SEBookReplayTarget organization categoryOfElement: #value) = #silent]";
    return { live: await evaluate(source), liveSource, fresh: await replay(workspace.snapshot(), source, [target]) };
  });
  expect(result.live.value.booleanValue).toBe(true);
  expect(result.liveSource.source).not.toContain('original-source-marker');
  expect(result.fresh.result.value.booleanValue).toBe(true);
  expect(result.fresh.sources[0].source).toBe(result.liveSource.source);
});
