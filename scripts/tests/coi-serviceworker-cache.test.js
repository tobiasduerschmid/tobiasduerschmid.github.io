const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const repositoryRoot = path.resolve(__dirname, '../..');
const serviceWorkerSource = fs.readFileSync(
  path.join(repositoryRoot, 'coi-serviceworker.js'),
  'utf8',
);

function createFetchHarness({ openCache }) {
  const listeners = new Map();
  const warnings = [];
  const networkRequests = [];
  const self = {
    location: { origin: 'https://sebook.test' },
    clients: { claim: () => Promise.resolve() },
    skipWaiting() {},
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
  };
  const sandbox = {
    Headers,
    Promise,
    Request,
    Response,
    URL,
    caches: {
      open: openCache,
    },
    console: {
      warn: (...args) => warnings.push(args),
    },
    fetch(request) {
      networkRequests.push(request);
      return Promise.resolve(new Response('kernel bytes', {
        status: 200,
        headers: { ETag: '"kernel-v1"' },
      }));
    },
    self,
  };
  vm.runInNewContext(serviceWorkerSource, sandbox, {
    filename: 'coi-serviceworker.js',
  });

  return {
    networkRequests,
    warnings,
    dispatchVMAssetFetch() {
      let responsePromise;
      let lifetimePromise;
      listeners.get('fetch')({
        request: new Request('https://sebook.test/vm/dist/bzImage'),
        respondWith(value) {
          responsePromise = Promise.resolve(value);
        },
        waitUntil(value) {
          lifetimePromise = Promise.resolve(value);
        },
      });
      assert.ok(responsePromise, 'the VM asset request must be handled by the service worker');
      assert.ok(lifetimePromise, 'cache population must extend the VM asset fetch lifetime');
      return { responsePromise, lifetimePromise };
    },
  };
}

test('VM asset fetch stays alive until cache population completes', async () => {
  let finishCacheWrite;
  const cacheWrite = new Promise(resolve => {
    finishCacheWrite = resolve;
  });
  const harness = createFetchHarness({
    openCache: () => Promise.resolve({
      match: () => Promise.resolve(undefined),
      put: () => cacheWrite,
    }),
  });

  let lifetimeSettled = false;
  const { responsePromise, lifetimePromise } = harness.dispatchVMAssetFetch();
  lifetimePromise.then(() => {
    lifetimeSettled = true;
  });
  const response = await responsePromise;
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(await response.text(), 'kernel bytes');
  assert.equal(lifetimeSettled, false, 'the fetch event must remain alive while Cache Storage writes');
  finishCacheWrite();
  await lifetimePromise;
  assert.equal(harness.networkRequests.length, 1);
});

test('VM asset fetch still serves the network response when cache population fails', async () => {
  const harness = createFetchHarness({
    openCache: () => Promise.resolve({
      match: () => Promise.resolve(undefined),
      put: () => Promise.reject(new Error('Quota exceeded')),
    }),
  });

  const { responsePromise, lifetimePromise } = harness.dispatchVMAssetFetch();
  const response = await responsePromise;
  await lifetimePromise;

  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'kernel bytes');
  assert.equal(harness.networkRequests.length, 1);
  assert.equal(harness.warnings.length, 1);
});

test('VM asset fetch falls back to the network when its cache cannot open', async () => {
  const harness = createFetchHarness({
    openCache: () => Promise.reject(new Error('Cache Storage unavailable')),
  });

  const { responsePromise, lifetimePromise } = harness.dispatchVMAssetFetch();
  const response = await responsePromise;
  await lifetimePromise;

  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'kernel bytes');
  assert.equal(harness.networkRequests.length, 1);
  assert.equal(harness.warnings.length, 1);
});
