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

test('tutorial isolation is opt-in and activation cleans only noncanonical VM cache entries', async ({ page }) => {
  await page.goto('/cookies/');
  await page.evaluate(async () => {
    await caches.open('unrelated-feature-cache');
    await caches.open('vm-assets-v1');
    const cache = await caches.open('vm-assets-v2');
    await cache.put('/vm/dist/state.bin.gz', new Response('saved snapshot'));
    await cache.put('/vm/dist/state.bin.gz?v=1', new Response('duplicate snapshot'));
    await cache.put('/vm/dist/state.bin.gz?', new Response('empty-query duplicate'));
  });
  await installAndOpenIsolatedPage(page);

  const ordinaryResponse = await page.goto('/');
  expect(ordinaryResponse).not.toBeNull();
  const ordinaryHeaders = await ordinaryResponse.headers();
  expect(ordinaryHeaders['cross-origin-opener-policy']).toBeUndefined();
  expect(ordinaryHeaders['cross-origin-embedder-policy']).toBeUndefined();
  expect(await page.evaluate(() => window.crossOriginIsolated)).toBe(false);
  expect(await page.evaluate(async () => (await caches.keys()).includes('unrelated-feature-cache'))).toBe(true);
  expect(await page.evaluate(async () => (await caches.keys()).includes('vm-assets-v1'))).toBe(false);
  const savedAssets = await page.evaluate(async () => {
    const cache = await caches.open('vm-assets-v2');
    const keys = await cache.keys();
    return Promise.all(keys.map(async request => ({
      url: request.url,
      body: await (await cache.match(request)).text(),
    })));
  });
  expect(savedAssets).toEqual([{
    url: new URL('/vm/dist/state.bin.gz', page.url()).href,
    body: 'saved snapshot',
  }]);
});

test('VM query variants are rejected while canonical assets stay usable and cached', async ({ page }) => {
  await page.goto('/cookies/');
  await installAndOpenIsolatedPage(page);

  const statuses = await page.evaluate(async () => Promise.all([
    '/vm/dist/state.bin.gz?variant=1',
    '/vm/dist/state.bin.gz?variant=2',
    '/vm/dist/state.bin.gz?',
    '/assets/v86/seabios.bin?variant=1',
  ].map(async url => (await fetch(url)).status)));
  expect(statuses).toEqual([400, 400, 400, 400]);
  expect(await page.evaluate(async () => (await (await caches.open('vm-assets-v2')).keys()).length)).toBe(0);

  const canonicalURL = new URL('/assets/v86/seabios.bin', page.url()).href;
  const bodyLength = await page.evaluate(async url => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Canonical VM asset failed: ${response.status}`);
    return (await response.arrayBuffer()).byteLength;
  }, canonicalURL);
  expect(bodyLength).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(async () => {
    const cache = await caches.open('vm-assets-v2');
    return (await cache.keys()).map(request => request.url);
  })).toEqual([canonicalURL]);
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
