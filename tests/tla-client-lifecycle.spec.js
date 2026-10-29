const { test: base, expect } = require('@playwright/test');

const LOADER_URL = 'https://cjrtnc.leaningtech.com/4.3/loader.js';
const test = base.extend({
  cleanConsole: [async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      // Only the intentionally aborted external loader may fail to load.
      if (message.type() === 'error' && message.location().url !== LOADER_URL) errors.push(message.text());
    });
    await use();
    expect(errors, 'client and owned runtime assets must load without JavaScript errors').toEqual([]);
  }, { auto: true }]
});

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

// Replace only the external JVM API. The owned client, model, execution frame,
// MessagePort, memory filesystem adapter, and hash-verified JAR fetches stay real.
// Init-script injection avoids weakening the loader's production SRI policy.
async function stubCheerpJ(page, { holdInit = false, holdExecution = false } = {}) {
  const initialized = deferred();
  const executed = deferred();
  const initGate = deferred();
  const executionGate = deferred();
  let initializations = 0;
  await page.exposeBinding('cheerpJTestBoundary', async ({ frame }, phase) => {
    if (phase === 'init') {
      initializations += 1;
      initialized.resolve(frame);
      if (holdInit && initializations === 1) await initGate.promise;
    } else if (phase === 'execute') {
      executed.resolve(frame);
      if (holdExecution) await executionGate.promise;
    }
  });
  await page.addInitScript(() => {
    window.cheerpjInit = () => window.cheerpJTestBoundary('init');
    window.cheerpOSAddStringFile = () => {};
    window.cheerpjRunLibrary = async () => ({ sebook: { tla: { Bridge: {
      execute: async () => {
        await window.cheerpJTestBoundary('execute');
        return JSON.stringify({ version: 1, status: 'complete', reason: 'complete', diagnostics: [] });
      }
    } } } });
  });
  await page.route(LOADER_URL, route => route.abort('blockedbyclient'));
  return {
    initializing: initialized.promise, executing: executed.promise,
    releaseInit: initGate.resolve, releaseExecution: executionGate.resolve
  };
}

async function openClient(page, options = {}) {
  // This small, real local page supplies an HTTP origin without starting the
  // complete tutorial UI; this suite tests the browser transport's public API.
  await page.goto('/tla-runtime-frame.html');
  await page.evaluate(async clientOptions => {
    const { TLAClient } = await import('/js/tla/client.mjs');
    const { snapshot } = await import('/js/tla/model.mjs');
    window.testClient = new TLAClient(clientOptions);
    window.testSnapshot = snapshot({
      'Model.tla': '---- MODULE Model ----\nVARIABLE x\nInit == x = 0\nNext == UNCHANGED x\n====',
      'Model.cfg': 'INIT Init\nNEXT Next'
    }, {});
  }, options);
}

async function startCheck(page) {
  await page.evaluate(() => {
    window.pendingResult = window.testClient.execute({ ...window.testSnapshot, operation: 'check' });
  });
}

const result = page => page.evaluate(() => window.pendingResult);
const runtimeFrame = page => page.getByTitle('TLA+ execution runtime', { exact: true });

function dependencyReached(page, event) {
  return Promise.race([event, result(page).then(value => {
    throw new Error('The client completed before the expected JVM boundary: ' + JSON.stringify(value));
  })]);
}

test('the execution runtime cannot read the tutorial DOM or browser storage', async ({ page }) => {
  const dependency = await stubCheerpJ(page, { holdExecution: true });
  await openClient(page);
  await page.evaluate(() => {
    document.body.dataset.privateDraft = 'student draft';
    localStorage.setItem('tla-test-secret', 'private preference');
  });
  await startCheck(page);
  const frame = await dependencyReached(page, dependency.executing);
  const isolation = await frame.evaluate(() => {
    const denied = operation => {
      try { operation(); return false; } catch (error) { return error.name === 'SecurityError'; }
    };
    return {
      origin: location.origin,
      parentDOM: denied(() => parent.document.body.dataset.privateDraft),
      parentStorage: denied(() => parent.localStorage.getItem('tla-test-secret')),
      ownStorage: denied(() => localStorage.getItem('tla-test-secret'))
    };
  });
  expect(isolation).toEqual({ origin: 'null', parentDOM: true, parentStorage: true, ownStorage: true });
  dependency.releaseExecution();
  expect(await result(page)).toMatchObject({ status: 'complete' });
  await expect(runtimeFrame(page)).toHaveCount(0);
});

test('stopping during JVM startup settles the check, removes the frame, and allows a new check', async ({ page }) => {
  const dependency = await stubCheerpJ(page, { holdInit: true });
  await openClient(page);
  await startCheck(page);
  await dependencyReached(page, dependency.initializing);
  await page.evaluate(() => window.testClient.cancel());
  expect(await result(page)).toMatchObject({ status: 'incomplete', reason: 'cancelled', sessionExpired: true });
  await expect(runtimeFrame(page)).toHaveCount(0);

  // Even a late resolution from the cancelled dependency must not revive it.
  dependency.releaseInit();
  await startCheck(page);
  expect(await result(page)).toMatchObject({ status: 'complete' });
  await expect(runtimeFrame(page)).toHaveCount(0);
});

for (const phase of ['startup', 'checking']) {
  test(`${phase} timeout reports an incomplete check and discards the runtime`, async ({ page }) => {
    const dependency = await stubCheerpJ(page, { holdInit: phase === 'startup', holdExecution: phase === 'checking' });
    const start = new Date('2026-01-01T00:00:00Z');
    await page.clock.install({ time: start });
    await page.clock.pauseAt(start);
    await openClient(page, { bootTimeoutMs: 1000, runTimeoutMs: 1000 });
    await startCheck(page);
    await dependencyReached(page, phase === 'startup' ? dependency.initializing : dependency.executing);
    await page.clock.fastForward(1000);
    expect(await result(page)).toMatchObject({
      status: 'incomplete', reason: phase === 'startup' ? 'startup-timeout' : 'time-limit', sessionExpired: true
    });
    await expect(runtimeFrame(page)).toHaveCount(0);
    dependency.releaseInit();
    dependency.releaseExecution();
  });
}
