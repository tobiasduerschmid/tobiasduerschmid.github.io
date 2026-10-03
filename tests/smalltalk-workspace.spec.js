const { test, expect } = require('@playwright/test');
const { withSmalltalk } = require('./helpers/smalltalk-runtime');
test.setTimeout(180000);

test('checkpoint restores shared cyclic objects, closures and waiting processes in a new generation', async ({ page }) => {
  const result = await withSmalltalk(page, async host => {
    let session = await host.openSession('live');
    const evaluate = source => host.request(session, 'evaluate', { source, bindings: 'workspace' });
    const setup = await evaluate("box := Array with: 7 with: nil. box at: 2 put: box. alias := box. closure := [box first]. gate := Semaphore new. done := Semaphore new. count := 0. process := [gate wait. count := count + 1. done signal] fork. box");
    const checkpoint = await host.checkpoint(session);
    await evaluate('box at: 1 put: 99. gate signal. done wait. count');
    session = await host.restoreCheckpoint(session, checkpoint);
    const restored = await evaluate('(box == alias) and: [(box at: 2) == box and: [closure value = 7 and: [count = 0]]]');
    const woke = await evaluate('gate signal. done wait. count');
    const stale = await host.request(session, 'inspect', { handle: setup.value.handle, offset: 0, limit: 10 }).catch(error => ({ code: error.code }));
    await evaluate('box at: 1 put: 88');
    session = await host.restoreCheckpoint(session, checkpoint);
    const twice = await evaluate('closure value');
    host.releaseCheckpoint(checkpoint);
    return { restored, woke, stale, twice };
  });
  expect(result.restored.error).toBeNull();
  expect(result.restored.value.booleanValue).toBe(true);
  expect(result.woke.value.text).toBe('1');
  expect(result.stale.code).toBe('STALE_HANDLE');
  expect(result.twice.value.text).toBe('7');
});

test('checkpoint restores open stream positions, shared bytes, detached records and empty directories', async ({ page }) => {
  const result = await withSmalltalk(page, async host => {
    let session = await host.openSession('live');
    const evaluate = source => host.request(session, 'evaluate', { source, bindings: 'workspace' });
    const setup = await evaluate("FileStream forceNewFileNamed: '/kept.txt' do: [:s | s nextPutAll: 'abcdef']. firstStream := FileStream fileNamed: '/kept.txt'. secondStream := FileStream fileNamed: '/kept.txt'. firstStream next: 2. secondStream next: 4. FileDirectory default createDirectory: 'empty'. FileStream forceNewFileNamed: '/detached.txt' do: [:s | s nextPutAll: 'detached']. detached := FileStream fileNamed: '/detached.txt'. FileDirectory default deleteFileNamed: '/detached.txt'. true");
    const checkpoint = await host.checkpoint(session);
    await evaluate("firstStream position: 0; nextPutAll: 'XXXXX'; flush; close. FileDirectory default deleteFileNamed: '/kept.txt'. FileDirectory default deleteDirectory: 'empty'. detached close");
    session = await host.restoreCheckpoint(session, checkpoint);
    const positions = await evaluate("firstStream position = 2 and: [secondStream position = 4 and: [firstStream next = $c and: [secondStream next = $e]]]");
    const sharing = await evaluate("firstStream position: 0; nextPut: $Z; flush. secondStream flushReadBuffer; position: 0. secondStream next = $Z");
    const detached = await evaluate("detached contents = 'detached' and: [(FileDirectory default fileExists: '/detached.txt') not and: [FileDirectory default directoryExists: 'empty']]");
    const compile = await evaluate("Object compile: 'checkpointProbe ^ 73' classified: 'sebook-tests'. (Object sourceCodeAt: #checkpointProbe) asString = 'checkpointProbe ^ 73'");
    const closed = await evaluate("firstStream close. secondStream position: 1. secondStream next = $b");
    host.releaseCheckpoint(checkpoint);
    return { setup, positions, sharing, detached, compile, closed };
  });
  for (const [name, resultPart] of Object.entries(result)) {
    expect(resultPart.error, name).toBeNull();
    expect(resultPart.value.booleanValue, name).toBe(true);
  }
});

test('checkpoint recovery resumes a pending native Delay exactly once', async ({ page }) => {
  const result = await withSmalltalk(page, async host => {
    let session = await host.openSession('live');
    const evaluate = source => host.request(session, 'evaluate', { source, bindings: 'workspace' });
    await evaluate('done := Semaphore new. started := Semaphore new. count := 0. [started signal. (Delay forMilliseconds: 1500) wait. count := count + 1. done signal] fork. started wait');
    const checkpoint = await host.checkpoint(session);
    session = await host.restoreCheckpoint(session, checkpoint);
    const woke = await evaluate('done wait. count');
    host.releaseCheckpoint(checkpoint);
    return woke;
  });
  expect(result.error).toBeNull();
  expect(result.value.text).toBe('1');
});

const baselineProgram = { version: 1, stepKey: 'workspace', revision: 0, files: [{ path: '/counter.st', kind: 'source', format: 'filein', content: "Object subclass: #SEBookCounter instanceVariableNames: 'saved' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Tests'!\n!SEBookCounter methodsFor: 'accessing'!\nvalue ^ 1!\nsaved: value saved := value!\nsaved ^ saved! !" }], changes: { version: 1, source: '', entries: [] }, runCommand: null };

async function withWorkspace(page, scenario, data = baselineProgram, options = {}, context = null) {
  const { installSmalltalk } = require('./helpers/smalltalk-runtime');
  await installSmalltalk(page);
  await page.addScriptTag({ url: '/js/smalltalk/workspace.js' });
  return page.evaluate(async ({ source, data, options, context }) => {
    const runtime = await SEBookSmalltalk.RuntimeHost.create({ manifestURL: '/js/vendor/smalltalk/manifest.json', ...options });
    const workspace = await SEBookSmalltalk.Workspace.create({ runtime, program: data });
    try { return await (0, eval)('(' + source + ')')(workspace, runtime, data, context); }
    finally { workspace.dispose(); runtime.dispose(); }
  }, { source: scenario.toString(), data, options, context });
}

test('Accept changes behavior on a retained instance and replays in a fresh image', async ({ page }) => {
  const result = await withWorkspace(page, async (workspace, runtime) => {
    await workspace.evaluate('counter := SEBookCounter new. counter saved: 73');
    const before = await workspace.evaluate('counter value');
    const target = { kind: 'method', className: 'SEBookCounter', side: 'instance', selector: 'value' };
    workspace.setDraft({ target, baseRevision: 0, source: 'value ^ 2' });
    const accepted = await workspace.commit({ baseRevision: 0, action: 'acceptMethod', params: { target, source: 'value ^ 2', protocol: 'accessing' } });
    const after = await workspace.evaluate('counter value');
    const saved = await workspace.evaluate('counter saved');
    const replay = await runtime.withFreshSession(async session => {
      await runtime.loadProgram(session, accepted);
      return runtime.request(session, 'evaluate', { source: 'SEBookCounter new value', bindings: 'isolated' });
    });
    return { before, after, saved, replay, accepted, drafts: workspace.getDrafts() };
  });
  expect(result.before.value.text).toBe('1');
  expect(result.after.value.text).toBe('2');
  expect(result.saved.value.text).toBe('73');
  expect(result.replay.value.text).toBe('2');
  expect(result.accepted.revision).toBe(1);
  expect(result.accepted.changes.entries.find(entry => entry.entity.selector === 'value')).toMatchObject({ before: 'value ^ 1', after: 'value ^ 2' });
  expect(result.drafts).toEqual([]);
});

test('Invalid Accept restores original behavior and preserves the invalid draft', async ({ page }) => {
  const result = await withWorkspace(page, async workspace => {
    await workspace.evaluate('counter := SEBookCounter new. counter saved: 73');
    const target = { kind: 'method', className: 'SEBookCounter', side: 'instance', selector: 'value' };
    const draft = { target, baseRevision: 0, source: 'value ^ )' };
    workspace.setDraft(draft);
    const failure = await workspace.commit({ baseRevision: 0, action: 'acceptMethod', params: { target, source: draft.source } }).catch(error => ({ code: error.code }));
    return { failure, value: await workspace.evaluate('counter value'), saved: await workspace.evaluate('counter saved'), program: workspace.snapshot(), drafts: workspace.getDrafts() };
  });
  expect(result.failure.code).toBe('COMPILE_ERROR');
  expect(result.value.value.text).toBe('1');
  expect(result.saved.value.text).toBe('73');
  expect(result.program.revision).toBe(0);
  expect(result.drafts[0].source).toBe('value ^ )');
});

test('partial native file-in rolls back object aliases and resource bytes while preserving the draft', async ({ page }) => {
  const program = structuredClone(baselineProgram);
  program.files.push({ path: '/state.st', kind: 'source', format: 'doit', content: 'Smalltalk at: #SEBookRollbackObject put: (Array with: 7)' });
  program.files.push({ path: '/resource.txt', kind: 'resource', format: null, content: 'original' });
  const result = await withWorkspace(page, async workspace => {
    const outputs = [];
    workspace.subscribe(event => { if (event.type === 'runtime' && event.detail.type === 'output') outputs.push(event.detail.payload.text); });
    await workspace.evaluate('alias := SEBookRollbackObject');
    const file = { path: '/patch.st', kind: 'source', format: 'filein', content: "SEBookRollbackObject at: 1 put: 99!\nFileStream forceNewFileNamed: '/resource.txt' do: [:stream | stream nextPutAll: 'changed']!\nTranscript show: 'partial mutation executed'!\n!SEBookCounter methodsFor: 'accessing'!\nvalue ^ )! !" };
    const target = { kind: 'file', path: file.path };
    workspace.setDraft({ target, baseRevision: 0, source: file.content });
    const failure = await workspace.commit({ baseRevision: 0, action: 'acceptFile', params: { file, target } }).catch(error => ({ code: error.code }));
    const object = await workspace.evaluate('alias == SEBookRollbackObject and: [alias first = 7]');
    const resource = await workspace.evaluate("FileStream readOnlyFileNamed: '/resource.txt' do: [:stream | stream contents = 'original']");
    return { failure, object, resource, outputs, program: workspace.snapshot(), drafts: workspace.getDrafts() };
  }, program);
  expect(result.outputs).toContain('partial mutation executed');
  expect(result.failure.code).toBe('COMPILE_ERROR');
  expect(result.object.value.booleanValue).toBe(true);
  expect(result.resource.value.booleanValue).toBe(true);
  expect(result.program.revision).toBe(0);
  expect(result.drafts[0].source).toContain('value ^ )');
});

test('native file rebase preserves an omitted method and allows a disjoint browser edit', async ({ page }) => {
  const result = await withWorkspace(page, async (workspace, runtime) => {
    const target = { kind: 'method', className: 'SEBookCounter', side: 'instance', selector: 'value' };
    await workspace.commit({ baseRevision: 0, action: 'acceptMethod', params: { target, source: 'value ^ 2', protocol: 'accessing' } });
    const file = { path: '/other.st', kind: 'source', format: 'filein', content: "Object subclass: #SEBookOther instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Tests'!\n!SEBookOther methodsFor: 'accessing'!\nanswer ^ 42! !" };
    await workspace.commit({ baseRevision: 1, action: 'acceptFile', params: { file, target: { kind: 'file', path: file.path } } });
    const replacement = { ...file, content: "Object subclass: #SEBookOther instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Tests'!" };
    const accepted = await workspace.commit({ baseRevision: 2, action: 'acceptFile', params: { file: replacement, target: { kind: 'file', path: file.path } } });
    const replay = await runtime.withFreshSession(async session => {
      await runtime.loadProgram(session, accepted);
      return runtime.request(session, 'evaluate', { source: 'SEBookOther new answer = 42 and: [SEBookCounter new value = 2]', bindings: 'isolated' });
    });
    return { accepted, replay };
  });
  expect(result.accepted.revision).toBe(3);
  expect(result.accepted.files.find(file => file.path === '/other.st').content).not.toContain('answer ^');
  expect(result.replay.error).toBeNull();
  expect(result.replay.value.booleanValue).toBe(true);
});

test('generated code before an ordinary evaluation error is accepted and replays without initializer side effects', async ({ page }) => {
  const result = await withWorkspace(page, async (workspace, runtime) => {
    const generated = await workspace.evaluate("SEBookCounter compile: 'value ^ 2' classified: 'accessing'. SEBookCounter class compile: 'answer ^ 42' classified: 'accessing'. SEBookCounter class compile: 'initialize Smalltalk at: #SEBookInitializerRan put: true' classified: 'initialization'. SEBookCounter removeSelector: #saved. SEBookCounter organization addCategory: 'empty-protocol'. SEBookCounter comment: 'Note ! 😀'. Object compile: 'yourself \"accepted baseline change\" ^ self' classified: 'accessing'. self error: 'after compilation'");
    const accepted = workspace.snapshot();
    const replay = await runtime.withFreshSession(async session => {
      await runtime.loadProgram(session, accepted);
      return runtime.request(session, 'evaluate', { source: "SEBookCounter new value = 2 and: [SEBookCounter answer = 42 and: [(SEBookCounter includesSelector: #saved) not and: [(Smalltalk includesKey: #SEBookInitializerRan) not and: [SEBookCounter organization classComment asString = 'Note ! 😀' and: [SEBookCounter organization categories includes: 'empty-protocol']]]]]", bindings: 'isolated' });
    });
    return { generated, accepted, replay };
  });
  expect(result.generated.error.code).toBe('EVALUATION_ERROR');
  expect(result.generated.error.message).toContain('after compilation');
  expect(result.generated.codeChanges).not.toBeNull();
  expect(result.accepted.revision).toBe(1);
  expect(result.accepted.changes.entries.find(entry => entry.entity.selector === 'saved')).toMatchObject({ before: 'saved ^ saved', after: null });
  expect(result.accepted.changes.entries.find(entry => entry.entity.selector === 'yourself').after).toBe('yourself "accepted baseline change" ^ self');
  expect(result.replay.error).toBeNull();
  expect(result.replay.value.booleanValue).toBe(true);
});

test('lost native commit and final acknowledgments publish exactly one accepted revision', async ({ page }) => {
  await page.addInitScript(() => {
    const OriginalChannel = window.MessageChannel;
    const descriptor = Object.getOwnPropertyDescriptor(MessagePort.prototype, 'onmessage');
    window.droppedPhases = [];
    window.MessageChannel = function () {
      const channel = new OriginalChannel();
      const requests = new Map();
      const send = channel.port1.postMessage.bind(channel.port1);
      channel.port1.postMessage = message => { if (message.requestId) requests.set(message.requestId, message); send(message); };
      Object.defineProperty(channel.port1, 'onmessage', {
        set(listener) {
          descriptor.set.call(channel.port1, listener && (event => {
            const request = requests.get(event.data.requestId);
            if (request && request.operation === 'commitMutation' && !event.data.error) {
              const phase = request.payload.acknowledge ? 'acknowledge' : 'commit';
              if (!window.droppedPhases.includes(phase)) { window.droppedPhases.push(phase); return; }
            }
            listener(event);
          }));
        },
      });
      return channel;
    };
  });
  const result = await withWorkspace(page, async (workspace, runtime) => {
    const revisions = [];
    workspace.subscribe(event => { if (event.type === 'program') revisions.push(event.program.revision); });
    // File acceptance executes arbitrary native chunks; class Accept only accepts definitions.
    const file = { path: '/mutation.st', kind: 'source', format: 'filein', content: "Smalltalk at: #SEBookMutationCount put: ((Smalltalk at: #SEBookMutationCount ifAbsent: [0]) + 1)!\n!SEBookCounter methodsFor: 'accessing'!\nvalue ^ 9! !" };
    const accepted = await workspace.commit({ baseRevision: 0, action: 'acceptFile', params: { file } });
    const count = await workspace.evaluate('SEBookMutationCount');
    const replay = await runtime.withFreshSession(async session => {
      await runtime.loadProgram(session, accepted);
      return runtime.request(session, 'evaluate', { source: 'SEBookCounter new value', bindings: 'isolated' });
    });
    return { revisions, count, replay, dropped: window.droppedPhases };
  }, baselineProgram, { limits: { operationMs: 15000 } });
  expect(result.dropped).toEqual(['commit', 'acknowledge']);
  expect(result.revisions).toEqual([1]);
  expect(result.count.value.text).toBe('1');
  expect(result.replay.value.text).toBe('9');
});

test('silent method replacement and nested native organization changes survive GC, recovery and fresh replay', async ({ page }) => {
  const result = await withWorkspace(page, async (workspace, runtime) => {
    const silent = await workspace.evaluate("SystemChangeNotifier uniqueInstance doSilently: [SEBookCounter compile: 'value ^ 7' classified: 'silent'. SEBookCounter organization addCategory: 'empty']. Smalltalk garbageCollect. SEBookCounter new value");
    const first = workspace.snapshot();
    // A failed transaction restores the actual image and forces the adapter watch to rebuild.
    await workspace.commit({ baseRevision: first.revision, action: 'acceptMethod', params: { target: { kind: 'method', className: 'SEBookCounter', side: 'instance', selector: 'value' }, source: 'value ^ )', protocol: 'silent' } }).catch(() => {});
    const afterRecovery = await workspace.evaluate("SystemChangeNotifier uniqueInstance doSilently: [SEBookCounter compile: 'value ^ 8' classified: 'silent']. SEBookCounter new value");
    const accepted = workspace.snapshot();
    const replay = await runtime.withFreshSession(async session => {
      await runtime.loadProgram(session, accepted);
      return runtime.request(session, 'evaluate', { source: "SEBookCounter new value = 8 and: [SEBookCounter organization categories includes: 'empty']", bindings: 'isolated' });
    });
    return { silent, first, afterRecovery, accepted, replay };
  });
  expect(result.silent.error).toBeNull();
  expect(result.silent.value.text).toBe('7');
  expect(result.first.changes.entries.find(entry => entry.entity.selector === 'value')).toMatchObject({ before: 'value ^ 1', after: 'value ^ 7' });
  expect(result.afterRecovery.value.text).toBe('8');
  expect(result.accepted.revision).toBe(2);
  expect(result.accepted.changes.entries.find(entry => entry.entity.selector === 'value')).toMatchObject({ before: 'value ^ 1', after: 'value ^ 8' });
  expect(result.replay.error).toBeNull();
  expect(result.replay.value.booleanValue).toBe(true);
});

test('conflicting file edits preserve accepted methods, live state and the unaccepted draft', async ({ page }) => {
  const result = await withWorkspace(page, async workspace => {
    await workspace.evaluate('counter := SEBookCounter new. counter saved: 73');
    await workspace.commit({ baseRevision: 0, action: 'acceptMethod', params: { target: { kind: 'method', className: 'SEBookCounter', side: 'instance', selector: 'value' }, source: 'value ^ 2', protocol: 'accessing' } });
    const file = { ...workspace.snapshot().files[0], content: workspace.snapshot().files[0].content.replace('value ^ 1', 'value ^ 3') };
    const target = { kind: 'file', path: file.path };
    workspace.setDraft({ target, source: file.content, baseRevision: 1 });
    const error = await workspace.commit({ baseRevision: 1, action: 'acceptFile', params: { target, file } }).catch(error => ({ code: error.code }));
    const live = await workspace.evaluate('counter value = 2 and: [counter saved = 73]');
    return { error, live, program: workspace.snapshot(), drafts: workspace.getDrafts() };
  });
  expect(result.error.code).toBe('PRECONDITION_FAILED');
  expect(result.live.value.booleanValue).toBe(true);
  expect(result.program.revision).toBe(1);
  expect(result.program.files[0].content).toContain('value ^ 1');
  expect(result.drafts[0].source).toContain('value ^ 3');
});

test('native JSON transport preserves nested empty dictionaries and arrays before later siblings', async ({ page }) => {
  const result = await withSmalltalk(page, async runtime => {
    const session = await runtime.openSession('fresh');
    return runtime.request(session, 'evaluate', { source: "decoded := SEBookJSON jsonFromString: '{\"classes\":{\"Empty\":{\"methods\":{},\"protocols\":{},\"organization\":\"kept\"},\"Next\":{\"selectors\":[],\"answer\":42}},\"after\":73}'. (decoded at: 'classes') size = 2 and: [((decoded at: 'classes') at: 'Empty') size = 3 and: [(((decoded at: 'classes') at: 'Empty') at: 'methods') isEmpty and: [(((decoded at: 'classes') at: 'Next') at: 'selectors') isEmpty and: [(((decoded at: 'classes') at: 'Next') at: 'answer') = 42 and: [(decoded at: 'after') = 73]]]]]", bindings: 'workspace' });
  });
  expect(result.error).toBeNull();
  expect(result.value.booleanValue).toBe(true);
});

test('worker loss after native mutation restores the retained graph and accepted revision', async ({ page }) => {
  const result = await withWorkspace(page, async (workspace, runtime) => {
    await workspace.evaluate('counter := SEBookCounter new. counter saved: 73. alias := counter');
    const target = { kind: 'file', path: '/mutation.st' };
    const source = "counter saved: 99. SEBookCounter compile: 'value ^ 9' classified: 'accessing'. Transcript show: 'terminate-after-native-mutation'";
    workspace.setDraft({ target, source, baseRevision: 0 });
    let terminated = false;
    const unsubscribe = runtime.subscribe(event => {
      if (event.type === 'output' && event.payload.text === 'terminate-after-native-mutation') { terminated = true; runtime.stop('live'); }
    });
    const file = { path: target.path, kind: 'source', format: 'doit', content: source };
    const error = await workspace.commit({ baseRevision: 0, action: 'acceptFile', params: { target, file } }).catch(error => ({ code: error.code }));
    unsubscribe();
    const recovered = await workspace.evaluate('counter == alias and: [counter saved = 73 and: [counter value = 1]]');
    return { error, terminated, recovered, program: workspace.snapshot(), drafts: workspace.getDrafts() };
  });
  expect(result.terminated).toBe(true);
  expect(result.error.code).toBe('CANCELLED');
  expect(result.recovered.error).toBeNull();
  expect(result.recovered.value.booleanValue).toBe(true);
  expect(result.program.revision).toBe(0);
  expect(result.drafts).toHaveLength(1);
});

test('background compilation publishes before stale Accept and cumulative source survives restart', async ({ page }) => {
  const result = await withWorkspace(page, async (workspace, runtime) => {
    const target = { kind: 'method', className: 'SEBookCounter', side: 'instance', selector: 'value' };
    workspace.setDraft({ target, source: 'value ^ 9', baseRevision: 0 });
    const changed = new Promise(resolve => {
      const unsubscribe = workspace.subscribe(event => { if (event.type === 'program') { unsubscribe(); resolve(event.program); } });
    });
    await workspace.evaluate("[(Delay forMilliseconds: 100) wait. SEBookCounter compile: 'value ^ 4' classified: 'accessing'] fork. nil");
    const background = await changed;
    const error = await workspace.commit({ baseRevision: 0, action: 'acceptMethod', params: { target, source: 'value ^ 9' } }).catch(error => ({ code: error.code }));
    await workspace.restart();
    const live = await workspace.evaluate('SEBookCounter new value');
    await workspace.commit({ baseRevision: 1, action: 'acceptMethod', params: { target, source: 'value ^ 5', protocol: 'accessing' } });
    return { background, error, live, accepted: workspace.snapshot() };
  });
  expect(result.background.revision).toBe(1);
  expect(result.error.code).toBe('STALE_REVISION');
  expect(result.live.value.text).toBe('4');
  expect(result.accepted.changes.entries.find(entry => entry.entity.selector === 'value')).toMatchObject({ before: 'value ^ 1', after: 'value ^ 5' });
});

test('fresh leases serialize owners and cancelling a queued job preserves the active native image', async ({ page }) => {
  const result = await withSmalltalk(page, async runtime => {
    let release;
    const hold = new Promise(resolve => { release = resolve; });
    let ready;
    const started = new Promise(resolve => { ready = resolve; });
    const first = runtime.withFreshSession(async session => {
      await runtime.request(session, 'evaluate', { source: 'Smalltalk at: #SEBookLeaseSentinel put: true. leaseValue := 73', bindings: 'workspace' });
      ready(); await hold;
      return runtime.request(session, 'evaluate', { source: 'leaseValue', bindings: 'workspace' });
    });
    await started;
    const controller = new AbortController();
    const cancelled = runtime.withFreshSession(() => { throw new Error('Cancelled queued job ran'); }, { signal: controller.signal }).catch(error => ({ code: error.code }));
    controller.abort();
    const second = runtime.withFreshSession(session => runtime.request(session, 'evaluate', { source: "Smalltalk includesKey: #SEBookLeaseSentinel", bindings: 'isolated' }));
    release();
    return { first: await first, cancelled: await cancelled, second: await second };
  });
  expect(result.first.value.text).toBe('73');
  expect(result.cancelled.code).toBe('CANCELLED');
  expect(result.second.value.booleanValue).toBe(false);
});

test('immutable cold source and copied accepted source survive source-file truncation and comment rebase', async ({ page }) => {
  const result = await withWorkspace(page, async (workspace, runtime) => {
    const commentTarget = { kind: 'comment', className: 'Object', side: 'instance' };
    const methodTarget = { kind: 'method', className: 'Object', side: 'instance', selector: 'yourself' };
    const originalComment = await workspace.browse({ kind: 'source', target: commentTarget, offset: 0, limit: 1 });
    const originalMethod = await workspace.browse({ kind: 'source', target: methodTarget, offset: 0, limit: 1 });
    const corrupted = await workspace.evaluate("FileStream fileNamed: (SourceFiles at: 1) name do: [:stream | stream truncate: 0]. FileStream fileNamed: (SourceFiles at: 2) name do: [:stream | stream truncate: 0]. SEBookCounter compile: 'value ^ 2' classified: 'accessing'. Object comment: 'Retained ! 😀 comment'. Object compile: 'yourself \"after source truncation\" ^ self' classified: 'accessing'. true");
    const accepted = workspace.snapshot();
    const file = { path: '/extra.st', kind: 'source', format: 'filein', content: "Object subclass: #SEBookExtra instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Extra'!" };
    const rebased = await workspace.commit({ baseRevision: accepted.revision, action: 'acceptFile', params: { target: { kind: 'file', path: file.path }, file } });
    const replay = await runtime.withFreshSession(async session => {
      await runtime.loadProgram(session, rebased);
      return runtime.request(session, 'evaluate', { source: "Object organization classComment asString = 'Retained ! 😀 comment' and: [(Object sourceCodeAt: #yourself) asString = 'yourself \"after source truncation\" ^ self']", bindings: 'isolated' });
    });
    return { originalComment, originalMethod, corrupted, rebased, replay };
  });
  expect(result.corrupted.error).toBeNull();
  expect(result.rebased.changes.entries.find(entry => entry.entity.selector === 'value')).toMatchObject({ before: 'value ^ 1', after: 'value ^ 2' });
  expect(result.rebased.changes.entries.find(entry => entry.entity.kind === 'comment' && entry.entity.className === 'Object')).toMatchObject({ before: result.originalComment.source, after: 'Retained ! 😀 comment' });
  expect(result.rebased.changes.entries.find(entry => entry.entity.selector === 'yourself')).toMatchObject({ before: result.originalMethod.source, after: 'yourself "after source truncation" ^ self' });
  expect(result.replay.error).toBeNull();
  expect(result.replay.value.booleanValue).toBe(true);
});

test('checkpoint preserves pending native Delay across the real VM millisecond clock wrap', async ({ page }) => {
  const { installCheckpointFixture } = require('./fixtures/smalltalk-checkpoint');
  await page.addInitScript(installCheckpointFixture);
  const result = await withSmalltalk(page, async runtime => {
    let session = await runtime.openSession('live');
    const evaluate = source => runtime.request(session, 'evaluate', { source, bindings: 'workspace' });
    const setup = await evaluate("Object subclass: #SEBookClockFixture instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Tests'. SEBookClockFixture class compile: 'nearWrap <primitive: ''primitiveClockNearWrap'' module: ''SEBookCheckpointFixture''> self error: ''clock fixture failed'''. SEBookClockFixture class compile: 'vmClock <primitive: 135> ^ nil'. SEBookClockFixture nearWrap. done := Semaphore new. count := 0. [(Delay forMilliseconds: 10000) wait. count := count + 1. done signal] fork. count");
    const checkpoint = await runtime.checkpoint(session);
    session = await runtime.restoreCheckpoint(session, checkpoint);
    const pending = await evaluate('count = 0 and: [SEBookClockFixture vmClock > 536840911]');
    const resumed = await evaluate('done wait. count = 1 and: [SEBookClockFixture vmClock < 30000]');
    runtime.releaseCheckpoint(checkpoint);
    return { setup, pending, resumed };
  });
  expect(result.setup.error).toBeNull();
  expect(result.setup.value.text).toBe('0');
  expect(result.pending.error).toBeNull();
  expect(result.pending.value.booleanValue).toBe(true);
  expect(result.resumed.error).toBeNull();
  expect(result.resumed.value.booleanValue).toBe(true);
});

test('checkpoint restores a queued external semaphore signal exactly once', async ({ page }) => {
  const { installCheckpointFixture } = require('./fixtures/smalltalk-checkpoint');
  await page.addInitScript(installCheckpointFixture);
  const result = await withSmalltalk(page, async runtime => {
    let session = await runtime.openSession('live');
    const evaluate = source => runtime.request(session, 'evaluate', { source, bindings: 'workspace' });
    const setup = await evaluate("Object subclass: #SEBookSignalFixture instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Tests'. SEBookSignalFixture class compile: 'atCheckpoint: index <primitive: ''primitiveSignalAtCheckpoint'' module: ''SEBookCheckpointFixture''> self error: ''signal fixture failed'''. gate := Semaphore new. done := Semaphore new. count := 0. [gate wait. count := count + 1. done signal] fork. SEBookSignalFixture atCheckpoint: (Smalltalk registerExternalObject: gate). count");
    const checkpoint = await runtime.checkpoint(session);
    session = await runtime.restoreCheckpoint(session, checkpoint);
    const resumed = await evaluate('done wait. count = 1 and: [gate excessSignals = 0]');
    runtime.releaseCheckpoint(checkpoint);
    return { setup, resumed };
  });
  expect(result.setup.error).toBeNull();
  expect(result.setup.value.text).toBe('0');
  expect(result.resumed.error).toBeNull();
  expect(result.resumed.value.booleanValue).toBe(true);
});

test('checkpoint reload preserves accepted code and literals normally patched on cold boot', async ({ page }) => {
  const { installCheckpointFixture } = require('./fixtures/smalltalk-checkpoint');
  await page.addInitScript(installCheckpointFixture);
  const result = await withSmalltalk(page, async runtime => {
    let session = await runtime.openSession('live');
    const setup = await runtime.request(session, 'evaluate', { source: "Smalltalk at: #SEBookPatchFixtureValue put: 4. Object subclass: #SEBookPatchFixture instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Tests'. SEBookPatchFixture class compile: 'restoredLiteral <primitive: ''primitiveRestoredLiteral'' module: ''SEBookCheckpointFixture''> self error: ''fixture failed'''. SmalltalkImage compile: 'wordSize ^ SEBookPatchFixtureValue' classified: 'testing'. Smalltalk wordSize", bindings: 'workspace' });
    const checkpoint = await runtime.checkpoint(session);
    session = await runtime.restoreCheckpoint(session, checkpoint);
    const restored = await runtime.request(session, 'evaluate', { source: "SEBookPatchFixture restoredLiteral = 8 and: [(SmalltalkImage sourceCodeAt: #wordSize) asString = 'wordSize ^ SEBookPatchFixtureValue']", bindings: 'workspace' });
    runtime.releaseCheckpoint(checkpoint);
    return { setup, restored };
  });
  expect(result.setup.error).toBeNull();
  expect(result.setup.value.text).toBe('4');
  expect(result.restored.error).toBeNull();
  expect(result.restored.value.booleanValue).toBe(true);
});

test('cold-source range reads are copied and reject oversized requests', async ({ page }) => {
  const result = await withSmalltalk(page, async runtime => {
    const session = await runtime.openSession('fresh');
    return runtime.request(session, 'evaluate', { source: "ledger := SEBookChanges new. [bytes := ledger coldBytes: 1 at: 0 count: 32. original := bytes copy. bytes at: 1 put: ((bytes at: 1) bitXor: 255). (ledger coldBytes: 1 at: 0 count: 32) = original and: [[ledger coldBytes: 1 at: 0 count: 1048577. false] on: Error do: [:error | error messageText = 'Cold source read exceeds its bounded contract']]] ensure: [ledger dispose]", bindings: 'workspace' });
  });
  expect(result.error).toBeNull();
  expect(result.value.booleanValue).toBe(true);
});

test('package, comment and version acceptance compose with recoverable whole-program replacement', async ({ page }) => {
  const result = await withWorkspace(page, async (workspace, runtime, baseline) => {
    await workspace.evaluate('counter := SEBookCounter new. counter saved: 73. alias := counter');
    await workspace.commit({ baseRevision: 0, action: 'createPackage', params: { name: 'SEBook-Empty' } });
    await workspace.commit({ baseRevision: 1, action: 'acceptComment', params: { target: { kind: 'comment', className: 'SEBookCounter', side: 'instance' }, source: 'Accepted ! 😀 comment' } });
    const target = { kind: 'method', className: 'SEBookCounter', side: 'instance', selector: 'value' };
    await workspace.commit({ baseRevision: 2, action: 'restoreVersion', params: { target, source: 'value ^ 8', protocol: 'accessing' } });
    const accepted = workspace.snapshot();
    workspace.setDraft({ target, source: 'value ^ )', baseRevision: 3 });
    const invalid = { ...baseline, files: [{ ...baseline.files[0], content: baseline.files[0].content.replace('value ^ 1', 'value ^ )') }] };
    const error = await workspace.replaceProgram(invalid).catch(error => ({ code: error.code }));
    const recovered = await workspace.evaluate("counter == alias and: [counter saved = 73 and: [counter value = 8 and: [SEBookCounter organization classComment asString = 'Accepted ! 😀 comment' and: [SystemOrganization categories includes: 'SEBook-Empty']]]]");
    const draftAfterFailure = workspace.getDrafts();
    const restoredRevision = workspace.snapshot().revision;
    const replacement = { ...baseline, files: [{ ...baseline.files[0], content: baseline.files[0].content.replace('value ^ 1', 'value ^ 5') }] };
    await workspace.replaceProgram(replacement);
    const reset = await workspace.evaluate('counter isNil and: [SEBookCounter new value = 5]');
    return { accepted, error, recovered, draftAfterFailure, restoredRevision, reset, replacement: workspace.snapshot() };
  });
  expect(result.accepted.revision).toBe(3);
  expect(result.error.code).toBe('COMPILE_ERROR');
  expect(result.recovered.error).toBeNull();
  expect(result.recovered.value.booleanValue).toBe(true);
  expect(result.draftAfterFailure[0].source).toBe('value ^ )');
  expect(result.restoredRevision).toBe(3);
  expect(result.reset.value.booleanValue).toBe(true);
  expect(result.replacement.revision).toBe(4);
});

test('fatal VM errors have bounded messages without embedding Worker source', async ({ page }) => {
  const { installCheckpointFixture } = require('./fixtures/smalltalk-checkpoint');
  await page.addInitScript(installCheckpointFixture);
  const result = await withSmalltalk(page, async runtime => {
    const session = await runtime.openSession('live');
    return runtime.request(session, 'evaluate', { source: "Object subclass: #SEBookFatalFixture instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Tests'. SEBookFatalFixture class compile: 'fatal <primitive: ''primitiveFatalError'' module: ''SEBookCheckpointFixture''> self error: ''fixture failed'''. SEBookFatalFixture fatal", bindings: 'workspace' }).catch(error => ({ code: error.code, length: error.message.length, containsWorker: error.message.includes('data:text/javascript'), prefix: error.message.slice(0, 80) }));
  });
  expect(result.code).toBe('RECOVERED_FAILURE');
  expect(result.prefix).toContain('fixture failure');
  expect(result.length).toBeLessThanOrEqual(4096);
  expect(result.containsWorker).toBe(false);
});

test('native rename replay preserves preexisting client global associations', async ({ page }) => {
  const program = structuredClone(baselineProgram);
  program.files.push({ path: '/client.st', kind: 'source', format: 'doit', content: "Object subclass: #SEBookClient instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Tests'. SEBookClient class compile: 'make ^ SEBookCounter new' classified: 'creating'" });
  const result = await withWorkspace(page, async (workspace, runtime) => {
    const renamed = await workspace.evaluate('SEBookCounter rename: #SEBookRenamed');
    await workspace.commit({ baseRevision: workspace.snapshot().revision, action: 'acceptMethod', params: { target: { kind: 'method', className: 'SEBookRenamed', side: 'instance', selector: 'value' }, source: 'value ^ 42', protocol: 'accessing' } });
    const source = 'SEBookClient make class == SEBookRenamed and: [SEBookClient make value = 42]';
    const live = await workspace.evaluate(source);
    const accepted = workspace.snapshot();
    const fresh = await runtime.withFreshSession(async session => {
      await runtime.loadProgram(session, accepted);
      return runtime.request(session, 'evaluate', { source, bindings: 'isolated' });
    });
    await workspace.restart();
    const restarted = await workspace.evaluate(source);
    await workspace.commit({ baseRevision: workspace.snapshot().revision, action: 'acceptMethod', params: { target: { kind: 'method', className: 'SEBookRenamed', side: 'instance', selector: 'value' }, source: 'value ^ 43', protocol: 'accessing' } });
    const afterRestartEdit = await runtime.withFreshSession(async session => {
      await runtime.loadProgram(session, workspace.snapshot());
      return runtime.request(session, 'evaluate', { source: source.replace('= 42', '= 43'), bindings: 'isolated' });
    });
    return { renamed, live, fresh, restarted, afterRestartEdit };
  }, program);
  expect(result.renamed.error).toBeNull();
  expect(result.live.error).toBeNull();
  expect(result.live.value.booleanValue).toBe(true);
  expect(result.fresh.error).toBeNull();
  expect(result.fresh.value.booleanValue).toBe(true);
  expect(result.restarted.error).toBeNull();
  expect(result.restarted.value.booleanValue).toBe(true);
  expect(result.afterRestartEdit.error).toBeNull();
  expect(result.afterRestartEdit.value.booleanValue).toBe(true);
});


test('renamed classes rebase disjoint files but reject removal of their original declaration', async ({ page }) => {
  const program = structuredClone(baselineProgram);
  program.files.push({ path: '/helper.st', kind: 'source', format: 'doit', content: "Object subclass: #SEBookHelper instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Tests'. SEBookHelper class compile: 'value ^ 3' classified: 'accessing'" });
  const result = await withWorkspace(page, async (workspace, runtime) => {
    await workspace.evaluate('counter := SEBookCounter new. counter saved: 73. alias := counter. SEBookCounter rename: #SEBookRenamed');
    const helper = workspace.snapshot().files.find(file => file.path === '/helper.st');
    await workspace.commit({ baseRevision: workspace.snapshot().revision, action: 'acceptFile', params: { file: { ...helper, content: helper.content.replace('value ^ 3', 'value ^ 4') } } });
    const accepted = workspace.snapshot();
    const fresh = await runtime.withFreshSession(async session => {
      await runtime.loadProgram(session, accepted);
      return runtime.request(session, 'evaluate', { source: '(Smalltalk includesKey: #SEBookCounter) not and: [SEBookRenamed new value = 1 and: [SEBookHelper value = 4]]', bindings: 'isolated' });
    });
    const file = accepted.files[0], target = { kind: 'file', path: file.path };
    workspace.setDraft({ target, source: '', baseRevision: accepted.revision });
    const error = await workspace.commit({ baseRevision: accepted.revision, action: 'acceptFile', params: { file: { ...file, content: '' } } }).catch(error => ({ code: error.code, message: error.message }));
    const recovered = await workspace.evaluate('counter == alias and: [counter saved = 73 and: [counter class == SEBookRenamed and: [SEBookHelper value = 4]]]');
    return { fresh, error, recovered, accepted, after: workspace.snapshot(), drafts: workspace.getDrafts() };
  }, program);
  expect(result.fresh.error).toBeNull();
  expect(result.fresh.value.booleanValue).toBe(true);
  expect(result.error.code).toBe('PRECONDITION_FAILED');
  expect(result.error.message).toContain('original declaration required by an accepted class rename');
  expect(result.recovered.error).toBeNull();
  expect(result.recovered.value.booleanValue).toBe(true);
  expect(result.after).toEqual(result.accepted);
  expect(result.drafts[0].source).toBe('');
});


test('cancelling an active fresh lease preserves live state and disposal settles all lease owners', async ({ page }) => {
  const result = await withSmalltalk(page, async runtime => {
    const live = await runtime.openSession('live');
    await runtime.request(live, 'evaluate', { source: 'kept := 73', bindings: 'workspace' });
    let ready;
    const started = new Promise(resolve => { ready = resolve; });
    const controller = new AbortController();
    const active = runtime.withFreshSession(async session => {
      await runtime.request(session, 'evaluate', { source: 'Smalltalk at: #SEBookCancelled put: true', bindings: 'workspace' });
      ready();
      return runtime.request(session, 'evaluate', { source: '[true] whileTrue', bindings: 'workspace' });
    }, { signal: controller.signal }).catch(error => ({ code: error.code }));
    await started;
    const next = runtime.withFreshSession(session => runtime.request(session, 'evaluate', { source: '(Smalltalk includesKey: #SEBookCancelled) not', bindings: 'isolated' }));
    controller.abort();
    const cancelled = await active, fresh = await next;
    const retained = await runtime.request(live, 'evaluate', { source: 'kept', bindings: 'workspace' });
    let disposalReady;
    const disposalStarted = new Promise(resolve => { disposalReady = resolve; });
    const disposedActive = runtime.withFreshSession(session => {
      disposalReady();
      return runtime.request(session, 'evaluate', { source: '[true] whileTrue', bindings: 'workspace' });
    }).catch(error => ({ code: error.code }));
    await disposalStarted;
    const disposedQueued = runtime.withFreshSession(() => { throw new Error('Disposed queued job ran'); }).catch(error => ({ code: error.code }));
    runtime.dispose();
    return { cancelled, fresh, retained, disposedActive: await disposedActive, disposedQueued: await disposedQueued };
  });
  expect(result.cancelled.code).toBe('CANCELLED');
  expect(result.fresh.value.booleanValue).toBe(true);
  expect(result.retained.value.text).toBe('73');
  expect(result.disposedActive.code).toBe('CANCELLED');
  expect(result.disposedQueued.code).toBe('CANCELLED');
});

test('Accept preserves a newer draft written while the submitted draft awaits acknowledgment', async ({ page }) => {
  const { installSmalltalkTransportGate } = require('./fixtures/smalltalk/transport');
  await page.addInitScript(installSmalltalkTransportGate);
  const result = await withWorkspace(page, async workspace => {
    const target = { kind: 'method', className: 'SEBookCounter', side: 'instance', selector: 'value' };
    workspace.setDraft({ target, source: 'value ^ 2', baseRevision: 0 });
    const gate = window.holdSmalltalkReply(request => request?.operation === 'commitMutation' && request.payload.acknowledge);
    const accepting = workspace.commit({ baseRevision: 0, action: 'acceptMethod', params: { target, source: 'value ^ 2', protocol: 'accessing' } });
    await gate.held;
    workspace.setDraft({ target, source: 'value ^ 3', baseRevision: 0 });
    gate.release();
    await accepting;
    return { drafts: workspace.getDrafts(), accepted: workspace.snapshot(), live: await workspace.evaluate('SEBookCounter new value') };
  });
  expect(result.accepted.changes.entries.find(entry => entry.entity.selector === 'value').after).toBe('value ^ 2');
  expect(result.live.value.text).toBe('2');
  expect(result.drafts).toHaveLength(1);
  expect(result.drafts[0]).toMatchObject({ source: 'value ^ 3', baseRevision: 0 });
});

for (const phase of ['native commit', 'final acknowledgment', 'replacement boot', 'rollback boot']) {
  test(`disposing during ${phase} cannot recover, publish or stop a newer live owner`, async ({ page }) => {
    const { installSmalltalkTransportGate } = require('./fixtures/smalltalk/transport');
    await page.addInitScript(installSmalltalkTransportGate);
    const result = await withWorkspace(page, async (workspace, runtime, baseline, phase) => {
      let disposed = false, recovered = 0, published = 0;
      workspace.subscribe(event => { if (disposed && event.type === 'program') published++; });
      const unsubscribe = runtime.subscribe(event => {
        if (disposed && event.type === 'recovered') recovered++;
        if (phase === 'native commit' && event.type === 'output' && event.payload.text === 'dispose-pending') {
          disposed = true; workspace.dispose();
        }
      });
      const gate = phase === 'native commit' ? null : window.holdSmalltalkReply((request, response) =>
        phase === 'final acknowledgment' ? request?.operation === 'commitMutation' && request.payload.acknowledge : response.ready);
      const operation = phase === 'replacement boot' ? workspace.replaceProgram(baseline) : workspace.commit({ baseRevision: 0, action: phase === 'native commit' ? 'acceptFile' : 'acceptMethod', params: phase === 'native commit'
        ? { file: { path: '/mutation.st', kind: 'source', format: 'doit', content: "Transcript show: 'dispose-pending'. (Delay forMilliseconds: 1000) wait. SEBookCounter compile: 'value ^ 9'" } }
        : { target: { kind: 'method', className: 'SEBookCounter', side: 'instance', selector: 'value' }, source: phase === 'rollback boot' ? 'value ^ )' : 'value ^ 2', protocol: 'accessing' } });
      const settled = operation.then(() => ({ resolved: true }), error => ({ code: error.code }));
      if (gate) { await gate.held; disposed = true; workspace.dispose(); }
      else await settled;
      const replacement = await SEBookSmalltalk.Workspace.create({ runtime, program: baseline });
      try {
        await replacement.evaluate('ownerValue := 73');
        if (gate) gate.release();
        const outcome = await settled;
        workspace.dispose(); // Repeated old-owner cleanup must be harmless.
        const live = await replacement.evaluate('ownerValue');
        return { outcome, recovered, published, workers: window.smalltalkWorkerCount, live };
      } finally { unsubscribe(); replacement.dispose(); }
    }, baselineProgram, {}, phase);
    expect(result.outcome.code).toBe('CANCELLED');
    expect(result.recovered).toBe(0);
    expect(result.published).toBe(0);
    expect(result.workers).toBe(1);
    expect(result.live.value.text).toBe('73');
  });
}

test('compiled method and comment text remain replayable when their backing is truncated before reconciliation', async ({ page }) => {
  const result = await withWorkspace(page, async (workspace, runtime) => {
    const generated = await workspace.evaluate("SEBookCounter compile: 'value \"keep exact ! 😀 marker\" ^ 42' classified: 'accessing'. SEBookCounter comment: 'Keep exact ! 😀 comment'. FileStream fileNamed: (SourceFiles at: 2) name do: [:stream | stream truncate: 0]. true").catch(error => ({ failure: error.message }));
    const accepted = workspace.snapshot();
    const fresh = await runtime.withFreshSession(async session => {
      await runtime.loadProgram(session, accepted);
      const evaluation = await runtime.request(session, 'evaluate', { source: "SEBookCounter new value = 42 and: [SEBookCounter organization classComment asString = 'Keep exact ! 😀 comment']", bindings: 'isolated' });
      const source = await runtime.request(session, 'browse', { kind: 'source', target: { kind: 'method', className: 'SEBookCounter', side: 'instance', selector: 'value' }, offset: 0, limit: 1 });
      return { evaluation, source };
    });
    return { generated, accepted, fresh };
  });
  expect(result.generated.failure).toBeUndefined();
  expect(result.generated.error).toBeNull();
  expect(result.accepted.changes.entries.find(entry => entry.entity.selector === 'value').after).toBe('value "keep exact ! 😀 marker" ^ 42');
  expect(result.fresh.evaluation.error).toBeNull();
  expect(result.fresh.evaluation.value.booleanValue).toBe(true);
  expect(result.fresh.source.source).toBe('value "keep exact ! 😀 marker" ^ 42');
});

test('accepted method and comment source survive later truncation during another source change', async ({ page }) => {
  const result = await withWorkspace(page, async (workspace, runtime) => {
    const target = { kind: 'method', className: 'SEBookCounter', side: 'instance', selector: 'value' };
    await workspace.commit({ baseRevision: 0, action: 'acceptMethod', params: { target, source: 'value "accepted ! 😀 marker" ^ 43', protocol: 'accessing' } });
    await workspace.commit({ baseRevision: 1, action: 'acceptComment', params: { target: { kind: 'comment', className: 'SEBookCounter', side: 'instance' }, source: 'Accepted ! 😀 comment' } });
    const changed = await workspace.evaluate("FileStream fileNamed: (SourceFiles at: 2) name do: [:stream | stream truncate: 0]. SEBookCounter organization addCategory: 'empty-after-truncation'. true").catch(error => ({ failure: error.message }));
    const accepted = workspace.snapshot();
    const fresh = await runtime.withFreshSession(async session => {
      await runtime.loadProgram(session, accepted);
      const evaluation = await runtime.request(session, 'evaluate', { source: "SEBookCounter new value = 43 and: [SEBookCounter organization classComment asString = 'Accepted ! 😀 comment' and: [SEBookCounter organization categories includes: #'empty-after-truncation']]", bindings: 'isolated' });
      const source = await runtime.request(session, 'browse', { kind: 'source', target, offset: 0, limit: 1 });
      return { evaluation, source };
    });
    return { changed, fresh };
  });
  expect(result.changed.failure).toBeUndefined();
  expect(result.changed.error).toBeNull();
  expect(result.fresh.evaluation.error).toBeNull();
  expect(result.fresh.evaluation.value.booleanValue).toBe(true);
  expect(result.fresh.source.source).toBe('value "accepted ! 😀 marker" ^ 43');
});

test('disposing a staged file acceptance cancels only its queued fresh lease', async ({ page }) => {
  const { installSmalltalkTransportGate } = require('./fixtures/smalltalk/transport');
  await page.addInitScript(installSmalltalkTransportGate);
  const result = await withWorkspace(page, async (workspace, runtime) => {
    let release, ready;
    const hold = new Promise(resolve => { release = resolve; });
    const started = new Promise(resolve => { ready = resolve; });
    const owner = runtime.withFreshSession(async session => {
      await runtime.request(session, 'evaluate', { source: 'leaseValue := 73', bindings: 'workspace' });
      ready(); await hold;
      return runtime.request(session, 'evaluate', { source: 'leaseValue', bindings: 'workspace' });
    });
    await started;
    const lease = runtime.withFreshSession.bind(runtime);
    let queued;
    const requested = new Promise(resolve => { queued = resolve; });
    runtime.withFreshSession = (...args) => { const result = lease(...args); queued(); return result; };
    const file = workspace.snapshot().files[0];
    const acceptance = workspace.commit({ baseRevision: 0, action: 'acceptFile', params: { file: { ...file, content: file.content.replace('value ^ 1', 'value ^ 2') } } }).catch(error => ({ code: error.code }));
    await requested;
    workspace.dispose();
    const cancelled = await acceptance;
    release();
    return { cancelled, retained: await owner, revision: workspace.snapshot().revision, workers: window.smalltalkWorkerCount };
  });
  expect(result.cancelled.code).toBe('CANCELLED');
  expect(result.retained.value.text).toBe('73');
  expect(result.revision).toBe(0);
  expect(result.workers).toBe(0);
});
