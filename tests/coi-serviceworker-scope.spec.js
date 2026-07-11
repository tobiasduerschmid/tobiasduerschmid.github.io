// @ts-check
const { test, expect } = require('@playwright/test');

/** @param {import('@playwright/test').Page} page */
async function installAndOpenIsolatedPage(page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/coi-serviceworker.js');
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  const isolatedResponse = await page.goto('/cookies/?sebook-coi=1');
  expect(isolatedResponse).not.toBeNull();
  const isolatedHeaders = await isolatedResponse.headers();
  expect(isolatedHeaders['cross-origin-opener-policy']).toBe('same-origin');
  expect(isolatedHeaders['cross-origin-embedder-policy']).toBe('credentialless');
  await expect.poll(() => page.evaluate(() => window.crossOriginIsolated)).toBe(true);
}

test('tutorial isolation is opt-in and activation preserves unrelated caches', async ({ page }) => {
  await page.goto('/cookies/');
  await page.evaluate(async () => {
    await caches.open('unrelated-feature-cache');
  });
  await installAndOpenIsolatedPage(page);

  const ordinaryResponse = await page.goto('/');
  expect(ordinaryResponse).not.toBeNull();
  const ordinaryHeaders = await ordinaryResponse.headers();
  expect(ordinaryHeaders['cross-origin-opener-policy']).toBeUndefined();
  expect(ordinaryHeaders['cross-origin-embedder-policy']).toBeUndefined();
  expect(await page.evaluate(() => window.crossOriginIsolated)).toBe(false);
  expect(await page.evaluate(async () => (await caches.keys()).includes('unrelated-feature-cache'))).toBe(true);
});

test('isolated pages can start same-origin workers', async ({ page }) => {
  await page.goto('/cookies/');
  await installAndOpenIsolatedPage(page);

  const workerResponse = await page.evaluate(() => new Promise((resolve, reject) => {
    const worker = new Worker('/js/uml-worker.js');
    worker.addEventListener('error', () => {
      worker.terminate();
      reject(new Error('The isolated page could not load a same-origin worker.'));
    }, { once: true });
    worker.addEventListener('message', (event) => {
      if (event.data?.id !== 'coi-worker-probe') return;
      worker.terminate();
      resolve({
        type: event.data.type,
        id: event.data.id,
        ok: event.data.ok,
      });
    });
    worker.postMessage({
      type: 'analyze',
      id: 'coi-worker-probe',
      lang: 'python',
      sources: { '/tutorial/probe.py': 'answer = 42\n' },
    });
  }));
  expect(workerResponse).toEqual({
    type: 'analysis',
    id: 'coi-worker-probe',
    ok: true,
  });
});
