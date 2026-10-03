const { test, expect } = require('@playwright/test');
const { withSmalltalk } = require('./helpers/smalltalk-runtime');

test('opaque Worker boots pinned Squeak with method source', async ({ page }) => {
  test.setTimeout(120000);
  const result = await withSmalltalk(page, async host => {
    const session = await host.openSession('live');
    return host.request(session, 'info', {}, {});
  });
  expect(result.squeakJS).toBe('1.3.3');
  expect(result.imageBuild).toBe(22104);
  expect(result.refactoringBrowser).toBe('3.1');
  expect(result.hasCompiler && result.hasSystemSources).toBe(true);
  expect(result.hasSpellingDictionary).toBe(false);
  expect(result.packageVersions).toHaveLength(14);
  expect(result.workerOrigin).toBe('null');
  expect(result.objectMethodSource).toContain('Answer self.');
  expect(result.packageVersions).toEqual(expect.arrayContaining(['AST-Core-mt.98', 'AST-Semantic-lr.15', 'Refactoring-Environment-mt.12', 'Refactoring-Changes-mt.24', 'Refactoring-Core-eem.166', 'Refactoring-Critics-mt.22', 'Refactoring-Spelling-ul.30']));
});


test('stopping an opaque Worker invalidates its session and a new one boots', async ({ page }) => {
  test.setTimeout(180000);
  const result = await withSmalltalk(page, async host => {
    const previous = await host.openSession('live');
    let staleCode;
    try { await host.request(previous, 'info', {}, { expectedRevision: 1 }); }
    catch (error) { staleCode = error.code; }
    const controller = new AbortController();
    const pending = host.request(previous, 'info', {}, { signal: controller.signal });
    controller.abort();
    let cancelledCode;
    try { await pending; } catch (error) { cancelledCode = error.code; }
    let code;
    try { await host.request(previous, 'info', {}, {}); }
    catch (error) { code = error.code; }
    const next = await host.openSession('live');
    const info = await host.request(next, 'info', {}, {});
    host.dispose(); host.dispose();
    return { code, staleCode, cancelledCode, build: info.imageBuild, differentSession: previous.sessionId !== next.sessionId };
  });
  expect(result.code).toBe('PRECONDITION_FAILED');
  expect(result.staleCode).toBe('STALE_REVISION');
  expect(result.cancelledCode).toBe('CANCELLED');
  expect(result.build).toBe(22104);
  expect(result.differentSession).toBe(true);
});

test('rejected dispatch cannot later terminate a healthy opaque Worker', async ({ page }) => {
  test.setTimeout(120000);
  await page.clock.install();
  const scenario = withSmalltalk(page, async host => {
    const session = await host.openSession('live');
    const controller = new AbortController();
    const codes = [];
    const cyclic = {}; cyclic.self = cyclic;
    for (const payload of [{ callback() {} }, cyclic, { integer: 1n }, { time: new Date() }, { number: NaN }]) {
      try { await host.request(session, 'info', payload, { signal: controller.signal }); codes.push('accepted'); }
      catch (error) { codes.push(error.code); }
    }
    // Fault injection at the browser transport boundary; the image and session remain real.
    const original = MessagePort.prototype.postMessage;
    MessagePort.prototype.postMessage = function () { throw new DOMException('Dispatch rejected', 'DataCloneError'); };
    let dispatchCode;
    try { await host.request(session, 'info', {}, { signal: controller.signal }); }
    catch (error) { dispatchCode = error.code; }
    finally { MessagePort.prototype.postMessage = original; }
    controller.abort();
    let immediate, later;
    try { immediate = (await host.request(session, 'info', { text: 'café 😀', values: [null, true, 42, { nested: false }] }, {})).imageBuild; }
    catch (error) { immediate = error.code; }
    window.__smalltalkDispatchRejected = true;
    await new Promise(resolve => setTimeout(resolve, 31000));
    try { later = (await host.request(session, 'info', {}, {})).imageBuild; }
    catch (error) { later = error.code; }
    return { codes, dispatchCode, immediate, later };
  });
  await page.waitForFunction(() => window.__smalltalkDispatchRejected);
  // Cross the documented 30-second watchdog boundary without a real-time sleep.
  await page.clock.runFor(31000);
  const result = await scenario;
  expect(result.codes).toEqual(Array(5).fill('PRECONDITION_FAILED'));
  expect(result.dispatchCode).toBe('RECOVERED_FAILURE');
  expect(result.immediate).toBe(22104);
  expect(result.later).toBe(22104);
});
