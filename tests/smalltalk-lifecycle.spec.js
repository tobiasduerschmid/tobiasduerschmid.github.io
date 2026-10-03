const { test, expect } = require('@playwright/test');
const { readFileSync } = require('node:fs');
const { withSmalltalk, installSmalltalk } = require('./helpers/smalltalk-runtime');
// Multiple real boots/native system scans need room across supported browser engines;
// operation deadlines below still exercise their configured strict limits.
test.setTimeout(180000);
const fixture = readFileSync(require.resolve('./fixtures/smalltalk/semantics.st'), 'utf8');
const program = { version: 1, stepKey: 'semantics', revision: 0, files: [
  { path: '/semantics.st', kind: 'source', format: 'filein', content: fixture },
  { path: '/resource.txt', kind: 'resource', format: null, content: 'resource' },
], changes: { version: 1, source: '', entries: [] }, runCommand: 'self error: \'Must not run on load\'' };

test('real image preserves Smalltalk semantics', async ({ page }) => {
  const result = await withSmalltalk(page, async (host, program) => {
    const session = await host.openSession('live');
    await host.loadProgram(session, program);
    const expressions = [
      '(1 / 3 + (1 / 6)) = (1 / 2)', '2 raisedTo: 100',
      "'😀' size = 1 and: ['😀' first asInteger = 128512]",
      "SEBookSemanticsChild new greeting size = 7 and: [(SEBookSemanticsChild new greeting at: 6) asInteger = 128512]",
      'SEBookSemanticsChild new answer = 42 and: [SEBookSemanticsChild answer = 17]',
      'SEBookSemanticsChild new nonlocalReturn = 7',
      '| n add | n := 2. add := [:x | n := n + x]. (add value: 3) = 5 and: [(add value: 4) = 9]',
      '((1 to: 5) collect: [:n | n * n]) sum = 55',
      '([1 / 0] on: ZeroDivide do: [:error | 23]) = 23',
      '| a b alias | a := Array with: 1. b := Array with: 2. alias := a. a become: b. alias first = 2',
      '| gate value | gate := Semaphore new. [value := 42. gate signal] fork. gate wait. value = 42',
      '(SEBookSemanticsChild new perform: #greeting) = \'café 😀!\'',
    ];
    const values = [];
    for (const source of expressions) values.push(await host.request(session, 'evaluate', { source, bindings: 'isolated' }));
    const source = await host.request(session, 'browse', { kind: 'source', target: { kind: 'method', className: 'SEBookSemanticsChild', side: 'instance', selector: 'greeting' }, offset: 0, limit: 100 });
    const syntax = await host.request(session, 'evaluate', { source: '1 + )', bindings: 'isolated' });
    return { values, source, syntax };
  }, program);
  expect(result.values.map(value => value.error)).toEqual(Array(12).fill(null));
  expect(result.values[0].value.booleanValue).toBe(true);
  expect(result.values[1].value.text).toBe('1267650600228229401496703205376');
  expect(result.values.slice(2).map(value => value.value.booleanValue)).toEqual(Array(10).fill(true));
  expect(result.source.source).toContain("^ 'café 😀!'");
  expect(result.syntax.error.code).toBe('COMPILE_ERROR');
  expect(result.syntax.error.location).toEqual({ start: 4, end: 5 });
});

test('Stop terminates infinite evaluation and permits a new session', async ({ page }) => {
  const result = await withSmalltalk(page, async (host, program, events) => {
    const session = await host.openSession('live');
    await host.loadProgram(session, program);
    const value = await host.request(session, 'evaluate', { source: 'SEBookUnprintable new', bindings: 'workspace' });
    const inspection = await host.request(session, 'inspect', { handle: value.value.handle, offset: 0, limit: 100 });
    const pending = host.request(session, 'evaluate', { source: "Transcript show: 'entered infinite loop'. [true] whileTrue: []", bindings: 'isolated' });
    await events.waitFor(event => event.type === 'output' && event.payload.text === 'entered infinite loop');
    host.stop('live');
    const cancelled = await pending.catch(error => ({ code: error.code }));
    const nextSession = await host.openSession('live');
    const next = await host.request(nextSession, 'evaluate', { source: '6 * 7', bindings: 'isolated' });
    const oldInspection = await host.request(nextSession, 'inspect', { handle: value.value.handle, offset: 0, limit: 100 }).catch(error => ({ code: error.code }));
    return { cancelled, next, oldInspection, inspection };
  }, program);
  await expect(Promise.reject(result.cancelled)).rejects.toMatchObject({ code: 'CANCELLED' });
  expect(result.next.value.text).toBe('42');
  await expect(Promise.reject(result.oldInspection)).rejects.toMatchObject({ code: 'STALE_HANDLE' });
  expect(result.inspection.slots).toHaveLength(1);
  expect(result.inspection.slots[0].name).toBe('link');
  expect(result.inspection.nextOffset).toBeNull();
});

test('workspace bindings persist while isolated evaluation has separate bindings', async ({ page }) => {
  const result = await withSmalltalk(page, async host => {
    const session = await host.openSession('live');
    const evaluate = (source, bindings) => host.request(session, 'evaluate', { source, bindings });
    await evaluate('counter := 40', 'workspace');
    return { bound: await evaluate('counter + 2', 'workspace'), isolated: await evaluate('counter', 'isolated') };
  });
  expect(result.bound.value.text).toBe('42');
  expect(result.isolated.value.text).toBe('nil');
});

test('scalar summaries bound previews and preserve Boolean identity', async ({ page }) => {
  const result = await withSmalltalk(page, async host => {
    const session = await host.openSession('live');
    const evaluate = source => host.request(session, 'evaluate', { source, bindings: 'isolated' });
    return { long: await evaluate('String new: 300 withAll: $a'), truthText: await evaluate("'true'"), truth: await evaluate('true') };
  });
  expect(result.long.value.text).toHaveLength(256);
  expect(result.truthText.value).not.toHaveProperty('booleanValue');
  expect(result.truth.value.booleanValue).toBe(true);
});

test('inspection pages indexed slots and released handles become stale', async ({ page }) => {
  const result = await withSmalltalk(page, async host => {
    const session = await host.openSession('live');
    const array = await host.request(session, 'evaluate', { source: 'Array new: 101 withAll: 42', bindings: 'isolated' });
    const first = await host.request(session, 'inspect', { handle: array.value.handle, offset: 0, limit: 1000 });
    const last = await host.request(session, 'inspect', { handle: array.value.handle, offset: 100, limit: 100 });
    const released = await host.request(session, 'releaseHandles', { handles: [array.value.handle, array.value.handle] });
    const stale = await host.request(session, 'inspect', { handle: array.value.handle, offset: 0, limit: 100 }).catch(error => ({ code: error.code }));
    return { first, last, released, stale };
  });
  expect(result.first.slots).toHaveLength(100);
  expect(result.first.nextOffset).toBe(100);
  expect(result.last.slots).toHaveLength(1);
  expect(result.last.slots[0].value.text).toBe('42');
  expect(result.last.nextOffset).toBeNull();
  expect(result.released.released).toBe(1);
  expect(result.stale.code).toBe('STALE_HANDLE');
});

for (const format of ['filein', 'doit']) {
  for (const prefix of ['', '"😀 escaped !! comment"\n']) {
    test(`malformed ${format} load preserves compiler diagnostics with ${prefix ? 'Unicode' : 'ASCII'} offsets`, async ({ page }) => {
      const source = prefix + '1 + )' + (format === 'filein' ? '!' : '');
      const path = `/bad-${format}.st`;
      const result = await withSmalltalk(page, async (host, data) => {
        const session = await host.openSession('live');
        try { await host.loadProgram(session, { ...data.program, files: [{ path: data.path, kind: 'source', format: data.format, content: data.source }] }); }
        catch (error) { return { code: error.code, location: error.location }; }
        return null;
      }, { program, source, path, format });
      expect(result).toEqual({ code: 'COMPILE_ERROR', location: { path, start: source.indexOf(')'), end: source.indexOf(')') + 1 } });
    });
  }
}

test('sender search finds differently named callers through both query forms', async ({ page }) => {
  const result = await withSmalltalk(page, async (host, program) => {
    const session = await host.openSession('live');
    await host.loadProgram(session, program);
    await host.request(session, 'evaluate', { source: "SEBookSemanticsChild compile: 'sebookReviewCallee ^ 42' classified: 'examples'. SEBookSemanticsChild compile: 'sebookReviewCaller ^ self sebookReviewCallee' classified: 'examples'", bindings: 'isolated' });
    const query = extra => host.request(session, 'browse', { kind: 'senders', offset: 0, limit: 100, ...extra });
    return {
      searched: await query({ search: 'sebookReviewCallee' }),
      targeted: await query({ target: { kind: 'method', className: 'SEBookSemanticsChild', side: 'instance', selector: 'sebookReviewCallee' } }),
      filtered: await query({ search: 'missingCaller', target: { kind: 'method', className: 'SEBookSemanticsChild', side: 'instance', selector: 'sebookReviewCallee' } }),
    };
  }, program);
  expect(result.searched.items.map(item => item.label)).toEqual(['SEBookSemanticsChild>>sebookReviewCaller']);
  expect(result.targeted.items).toEqual(result.searched.items);
  expect(result.filtered.items).toEqual([]);
});

test('class-side hierarchy targets navigate to class methods and their source', async ({ page }) => {
  const result = await withSmalltalk(page, async (host, program) => {
    const session = await host.openSession('live');
    await host.loadProgram(session, program);
    const browse = (kind, target) => host.request(session, 'browse', { kind, target, offset: 0, limit: 100 });
    const hierarchy = await browse('hierarchy', { kind: 'class', className: 'SEBookSemanticsChild', side: 'class' });
    const item = hierarchy.items.find(item => item.label === 'SEBookSemanticsChild class');
    const methods = await browse('methods', item.target);
    const method = methods.items.find(item => item.label === 'answer');
    const source = await browse('source', method.target);
    return { item, methods, source };
  }, program);
  expect(result.item.target.side).toBe('class');
  expect(result.methods.items.map(item => item.label)).toEqual(['answer']);
  expect(result.source.source.trim()).toBe('answer\n    ^ 17');
});

test('cooperative learner forks remain alive while method service requests execute', async ({ page }) => {
  const result = await withSmalltalk(page, async host => {
    const session = await host.openSession('live');
    await host.request(session, 'evaluate', { source: 'gate := Semaphore new. finished := Semaphore new. value := 0. [gate wait. value := 42. finished signal] fork', bindings: 'workspace' });
    const source = await host.request(session, 'browse', { kind: 'source', target: { kind: 'method', className: 'Object', side: 'instance', selector: 'yourself' }, offset: 0, limit: 100 });
    await host.request(session, 'evaluate', { source: 'gate signal. finished wait', bindings: 'workspace' });
    const value = await host.request(session, 'evaluate', { source: 'value', bindings: 'workspace' });
    return { source, value };
  });
  expect(result.source.source).toContain('Answer self.');
  expect(result.value.value.text).toBe('42');
});

test('operation timeout terminates its image and retry boots a usable session', async ({ page }) => {
  const result = await withSmalltalk(page, async host => {
    const session = await host.openSession('live');
    const timeout = await host.request(session, 'evaluate', { source: '[true] whileTrue: []', bindings: 'isolated' }).catch(error => ({ code: error.code }));
    const fresh = await host.openSession('live');
    return { timeout, value: await host.request(fresh, 'evaluate', { source: '42', bindings: 'isolated' }) };
  }, null, { limits: { operationMs: 1000 } });
  expect(result.timeout.code).toBe('TIMEOUT');
  expect(result.value.value.text).toBe('42');
});

test('foreground and detached background output have bounded UTF-8 budgets', async ({ page }) => {
  const result = await withSmalltalk(page, async (host, ignored, events) => {
    const foreground = await host.openSession('fresh');
    const overflow = await host.request(foreground, 'evaluate', { source: "Transcript show: (String new: 100 withAll: $é)", bindings: 'isolated' }).catch(error => ({ code: error.code }));
    const background = await host.openSession('live');
    await host.request(background, 'evaluate', { source: "gate := Semaphore new. [gate wait. 100 timesRepeat: [Transcript show: 'é']] forkAt: Processor userBackgroundPriority - 1", bindings: 'workspace' });
    await host.request(background, 'evaluate', { source: 'gate signal. true', bindings: 'workspace' });
    const failure = await events.waitFor(event => event.sessionId === background.sessionId && event.type === 'failed');
    const output = events.items.filter(event => event.sessionId === background.sessionId && event.type === 'output');
    return { overflow, failure, bytes: output.reduce((sum, event) => sum + new TextEncoder().encode(event.payload.text).length, 0), detached: output.some(event => event.requestId === null) };
  }, null, { limits: { outputBytes: 100 } });
  expect(result.overflow.code).toBe('OUTPUT_LIMIT');
  expect(result.failure.payload.code).toBe('OUTPUT_LIMIT');
  expect(result.bytes).toBeLessThanOrEqual(100);
  expect(result.detached).toBe(true);
});

test('dispose during boot settles readiness and native VM exit settles evaluation', async ({ page }) => {
  const result = await withSmalltalk(page, async host => {
    const session = await host.openSession('live');
    const crash = await host.request(session, 'evaluate', { source: 'Smalltalk quitPrimitive', bindings: 'isolated' }).catch(error => ({ code: error.code }));
    const boot = host.openSession('live');
    host.dispose();
    return { crash, boot: await boot.catch(error => ({ code: error.code })) };
  });
  expect(result.crash.code).toBe('RECOVERED_FAILURE');
  expect(result.boot.code).toBe('CANCELLED');
});

test('asset failure is retryable', async ({ page }) => {
  await installSmalltalk(page);
  await page.route('**/js/vendor/smalltalk/manifest.json', route => route.fulfill({ status: 503, body: 'unavailable' }), { times: 1 });
  const failed = await page.evaluate(async () => {
    try { await window.SEBookSmalltalk.RuntimeHost.create({ manifestURL: '/js/vendor/smalltalk/manifest.json' }); }
    catch (error) { return error.code; }
  });
  expect(failed).toBe('ASSET_ERROR');
  const value = await withSmalltalk(page, async host => {
    const session = await host.openSession('live');
    return host.request(session, 'evaluate', { source: '42', bindings: 'isolated' });
  });
  expect(value.value.text).toBe('42');
});

test('a structural barrier deadline rejects without resetting a responsive image', async ({ page }) => {
  const result = await withSmalltalk(page, async (host, ignored, events) => {
    const session = await host.openSession('live');
    const operation = host.request(session, 'evaluate', { source: "Transcript show: 'operation started'. (Delay forMilliseconds: 700) wait. 42", bindings: 'isolated' }, { purpose: 'run' });
    await events.waitFor(event => event.type === 'output' && event.payload.text === 'operation started');
    const barrier = await host.request(session, 'barrier', {}).catch(error => ({ code: error.code }));
    const value = await operation;
    const info = await host.request(session, 'info', {});
    return { barrier, value, info };
  }, null, { limits: { operationMs: 300, runMs: 3000 } });
  expect(result.barrier.code).toBe('TIMEOUT');
  expect(result.value.value.text).toBe('42');
  expect(result.info.imageBuild).toBe(22104);
});

test('stale and duplicate transport replies cannot settle another request', async ({ page }) => {
  const result = await withSmalltalk(page, async host => {
    const descriptor = Object.getOwnPropertyDescriptor(MessagePort.prototype, 'onmessage');
    Object.defineProperty(MessagePort.prototype, 'onmessage', { ...descriptor, set(handler) {
      descriptor.set.call(this, event => {
        if (!event.data.ready) handler({ data: { ...event.data, sessionId: 'expired-session', revision: 99 } });
        handler(event);
        if (!event.data.ready) handler({ data: { ...event.data, revision: 99 } });
      });
    } });
    try {
      const session = await host.openSession('live');
      const first = await host.request(session, 'evaluate', { source: '40 + 2', bindings: 'isolated' });
      const second = await host.request(session, 'evaluate', { source: '21 * 2', bindings: 'isolated' });
      return { first, second, revision: session.revision };
    } finally { Object.defineProperty(MessagePort.prototype, 'onmessage', descriptor); }
  });
  expect(result.first.value.text).toBe('42');
  expect(result.second.value.text).toBe('42');
  expect(result.revision).toBe(0);
});

test('native open streams preserve positions and detached files do not resurrect on flush', async ({ page }) => {
  const result = await withSmalltalk(page, async (host, program) => {
    const session = await host.openSession('live');
    await host.loadProgram(session, program);
    return host.request(session, 'evaluate', { bindings: 'isolated', source: `
      | first second value |
      first := FileStream fileNamed: '/resource.txt'.
      second := FileStream readOnlyFileNamed: '/resource.txt'.
      first next: 2. second next: 4.
      FileDirectory default deleteFileNamed: 'resource.txt'.
      first nextPutAll: 'XX'; flush.
      value := (FileDirectory default fileExists: 'resource.txt') not
        and: [first position = 4 and: [second position = 4]].
      first close. second close. value` });
  }, program);
  expect(result.error).toBeNull();
  expect(result.value.booleanValue).toBe(true);
});

test('native browser queries expose classes, protocols, hierarchy, references and actual versions', async ({ page }) => {
  const result = await withSmalltalk(page, async (host, program) => {
    const session = await host.openSession('live');
    await host.loadProgram(session, program);
    const target = { kind: 'method', className: 'SEBookSemanticsChild', side: 'instance', selector: 'answer' };
    const query = (kind, extra = {}) => host.request(session, 'browse', { kind, target, offset: 0, limit: 100, ...extra });
    const packages = await query('packages', { search: 'SEBook-Semantics' });
    const classes = await query('classes', { target: { kind: 'package', packageName: 'SEBook-Semantics' } });
    const protocols = await query('protocols');
    const methods = await query('methods');
    const hierarchy = await query('hierarchy');
    const variables = await query('variables', { target: { kind: 'class', className: 'SEBookUnprintable' } });
    const implementors = await query('implementors');
    const senders = await query('senders');
    await host.request(session, 'evaluate', { source: "SEBookSemanticsChild compile: 'history ^ 1' classified: 'examples'. SEBookSemanticsChild compile: 'history ^ 2' classified: 'examples'", bindings: 'isolated' });
    const versions = await query('versions', { target: { ...target, selector: 'history' } });
    return { packages, classes, protocols, methods, hierarchy, variables, implementors, senders, versions };
  }, program);
  expect(result.packages.items.map(item => item.label)).toContain('SEBook-Semantics');
  expect(result.classes.items.map(item => item.label)).toEqual(['SEBookSemanticsChild', 'SEBookSemanticsParent', 'SEBookUnprintable']);
  expect(result.protocols.items.map(item => item.label)).toContain('examples');
  expect(result.methods.items.map(item => item.label)).toEqual(['answer', 'greeting']);
  expect(result.hierarchy.items.map(item => item.label)).toEqual(expect.arrayContaining(['Object', 'SEBookSemanticsParent', 'SEBookSemanticsChild']));
  expect(result.variables.items.filter(item => item.variable.kind === 'instance').map(item => ({ variable: item.variable, declaringClass: item.declaringClass }))).toEqual([{
    variable: { kind: 'instance', name: 'link' },
    declaringClass: { kind: 'class', className: 'SEBookUnprintable', side: 'instance', packageName: 'SEBook-Semantics' },
  }]);
  expect(result.implementors.items.map(item => item.label)).toEqual(expect.arrayContaining(['SEBookSemanticsChild>>answer', 'SEBookSemanticsChild class>>answer', 'SEBookSemanticsParent>>answer']));
  expect(result.senders.items.map(item => item.label)).toContain('SEBookSemanticsChild>>answer');
  expect(result.versions.items.map(item => item.detail)).toEqual(['history ^ 2', 'history ^ 1']);
});

test('program loading preserves source order and replays overlays without executing entry commands or resources', async ({ page }) => {
  const result = await withSmalltalk(page, async host => {
    const session = await host.openSession('live');
    await host.loadProgram(session, { version: 1, stepKey: 'order', revision: 7, files: [
      { path: '/initial.st', kind: 'source', format: 'doit', content: 'Smalltalk at: #SEBookLoadOrder put: OrderedCollection new' },
      { path: '/dependency.st', kind: 'source', format: 'filein', content: 'SEBookLoadOrder add: 1!' },
      { path: '/resource.st', kind: 'resource', format: null, content: "self error: 'resource executed'" },
      { path: '/entry.st', kind: 'source', format: 'filein', content: 'SEBookLoadOrder add: 2!' },
    ], changes: { version: 1, source: 'SEBookLoadOrder add: 3!', entries: [] }, runCommand: "self error: 'entry command executed'" });
    const value = await host.request(session, 'evaluate', { source: 'SEBookLoadOrder asArray = #(1 2 3)', bindings: 'isolated' });
    return { value, revision: session.revision };
  });
  expect(result.value.error).toBeNull();
  expect(result.value.value.booleanValue).toBe(true);
  expect(result.revision).toBe(7);
});

test('asset acquisition obeys the boot deadline and can be cancelled before a host exists', async ({ page }) => {
  test.setTimeout(5000);
  await installSmalltalk(page);
  await page.route('**/js/vendor/smalltalk/manifest.json', () => {});
  const result = await page.evaluate(async () => {
    const controller = new AbortController(); controller.abort();
    const cancelled = await window.SEBookSmalltalk.RuntimeHost.create({ manifestURL: '/js/vendor/smalltalk/manifest.json', signal: controller.signal, limits: { bootMs: 100 } }).catch(error => error.code);
    const timeout = await window.SEBookSmalltalk.RuntimeHost.create({ manifestURL: '/js/vendor/smalltalk/manifest.json', limits: { bootMs: 100 } }).catch(error => error.code);
    return { cancelled, timeout };
  });
  expect(result.cancelled).toBe('CANCELLED');
  expect(result.timeout).toBe('TIMEOUT');
});

test('cancelling one asset creator preserves a concurrent creator and same-page retry', async ({ page }) => {
  await installSmalltalk(page);
  let firstRequested, secondRequested;
  const firstRequest = new Promise(resolve => { firstRequested = resolve; });
  const secondRequest = new Promise(resolve => { secondRequested = resolve; });
  let imageRequests = 0;
  await page.route('**/js/vendor/smalltalk/sebook.image', route => {
    imageRequests += 1;
    if (imageRequests === 1) {
      firstRequested();
      return; // A stalled network response must not own another creator's lifetime.
    }
    secondRequested();
    return route.continue();
  });
  await page.evaluate(() => {
    window.assetController = new AbortController();
    window.firstLoader = window.SEBookSmalltalk.RuntimeHost.create({
      manifestURL: '/js/vendor/smalltalk/manifest.json', signal: window.assetController.signal,
    }).then(host => { host.dispose(); return 'completed'; }, error => error.code);
  });
  await firstRequest;
  const healthyCreator = page.evaluate(async () => {
    const host = await window.SEBookSmalltalk.RuntimeHost.create({ manifestURL: '/js/vendor/smalltalk/manifest.json' });
    try {
      const session = await host.openSession('live');
      return (await host.request(session, 'evaluate', { source: '6 * 7', bindings: 'isolated' })).value.text;
    } finally { host.dispose(); }
  });
  await secondRequest;
  const cancelled = await page.evaluate(async () => { window.assetController.abort(); return window.firstLoader; });
  expect(cancelled).toBe('CANCELLED');
  expect(await healthyCreator).toBe('42');
  const retried = await page.evaluate(async () => {
    const host = await window.SEBookSmalltalk.RuntimeHost.create({ manifestURL: '/js/vendor/smalltalk/manifest.json' });
    try {
      const session = await host.openSession('live');
      return (await host.request(session, 'evaluate', { source: '40 + 2', bindings: 'isolated' })).value.text;
    } finally { host.dispose(); }
  });
  expect(retried).toBe('42');
});
