// @ts-check
const { test, expect } = require('@playwright/test');

const SNAPSHOT_DATABASE = 'sebook-tutorial-vm-snapshots';
const VM_CACHE = 'vm-assets-v2';

async function seedBrowserStorage(page) {
  await page.evaluate(async ({ databaseName, cacheName }) => {
    document.cookie = 'storage-delete-test=present; path=/; SameSite=Lax';
    localStorage.setItem('storage-delete-test', 'present');
    sessionStorage.setItem('storage-delete-test', 'present');

    const cache = await caches.open(cacheName);
    await cache.put('/storage-delete-test', new Response('cached'));

    await new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('snapshots');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('snapshots', 'readwrite');
        transaction.objectStore('snapshots').put({ state: 'saved' }, 'storage-delete-test');
        transaction.oncomplete = () => {
          database.close();
          resolve(undefined);
        };
        transaction.onerror = () => reject(transaction.error);
      };
    });
  }, { databaseName: SNAPSHOT_DATABASE, cacheName: VM_CACHE });
}

test('Delete everything removes synchronous and asynchronous site storage', async ({ page }) => {
  await page.goto('/cookies/');
  await seedBrowserStorage(page);

  page.once('dialog', dialog => dialog.accept());
  await page.locator('#cookies-delete-all').click();
  await expect(page.locator('#cookies-toast')).toHaveText('All site storage deleted');

  const remaining = await page.evaluate(async ({ databaseName, cacheName }) => ({
    cookie: document.cookie,
    local: localStorage.getItem('storage-delete-test'),
    session: sessionStorage.getItem('storage-delete-test'),
    cache: (await caches.keys()).includes(cacheName),
    database: (await indexedDB.databases()).some(database => database.name === databaseName),
  }), { databaseName: SNAPSHOT_DATABASE, cacheName: VM_CACHE });

  expect(remaining.cookie).not.toContain('storage-delete-test=');
  expect(remaining.local).toBeNull();
  expect(remaining.session).toBeNull();
  expect(remaining.cache).toBe(false);
  expect(remaining.database).toBe(false);
});

test('tutorial state deletion includes debugger exception breakpoints', async ({ page }) => {
  await page.goto('/cookies/');
  await page.evaluate(() => {
    localStorage.setItem('tutorial-debug-excbps-python', '["ValueError"]');
  });

  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect(page.locator('#tutorial-dynamic-body')).toContainText('tutorial-debug-excbps-python');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete all tutorial state' }).click();

  await expect.poll(() => page.evaluate(() => localStorage.getItem('tutorial-debug-excbps-python'))).toBeNull();
});
