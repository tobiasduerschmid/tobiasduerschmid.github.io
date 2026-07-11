// @ts-check
const { test, expect } = require('@playwright/test');

test('tutorial isolation is opt-in and activation preserves unrelated caches', async ({ page }) => {
  await page.goto('/cookies/');
  await page.evaluate(async () => {
    await caches.open('unrelated-feature-cache');
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

  const ordinaryResponse = await page.goto('/');
  expect(ordinaryResponse).not.toBeNull();
  const ordinaryHeaders = await ordinaryResponse.headers();
  expect(ordinaryHeaders['cross-origin-opener-policy']).toBeUndefined();
  expect(ordinaryHeaders['cross-origin-embedder-policy']).toBeUndefined();
  expect(await page.evaluate(() => window.crossOriginIsolated)).toBe(false);
  expect(await page.evaluate(async () => (await caches.keys()).includes('unrelated-feature-cache'))).toBe(true);
});
