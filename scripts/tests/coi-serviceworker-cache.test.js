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

function createFetchHarness({ openCache, cacheNames = [], deleteCache = async () => true }) {
  const listeners = new Map();
  const warnings = [];
  const networkRequests = [];
  const cacheOpens = [];
  let clientsClaimed = false;
  const self = {
    location: { origin: 'https://sebook.test' },
    clients: {
      async claim() { clientsClaimed = true; },
    },
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
      open(name) {
        cacheOpens.push(name);
        return openCache(name);
      },
      keys: async () => cacheNames,
      delete: deleteCache,
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
    get clientsClaimed() { return clientsClaimed; },
    cacheOpens,
    networkRequests,
    warnings,
    dispatchActivate() {
      let lifetimePromise;
      listeners.get('activate')({
        waitUntil(value) {
          lifetimePromise = Promise.resolve(value);
        },
      });
      return lifetimePromise;
    },
    dispatchVMAssetFetch(url = 'https://sebook.test/vm/dist/bzImage') {
      let responsePromise;
      let lifetimePromise;
      listeners.get('fetch')({
        request: new Request(url),
        respondWith(value) {
          responsePromise = Promise.resolve(value);
        },
        waitUntil(value) {
          lifetimePromise = Promise.resolve(value);
        },
      });
      assert.ok(responsePromise, 'the VM asset request must be handled by the service worker');
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

const vmAssetPaths = [
  '/vm/dist/state.bin.gz',
  '/vm/dist/bzImage',
  '/vm/dist/rootfs.cpio.gz',
  '/assets/v86/v86.wasm',
  '/assets/v86/libv86.js',
  '/assets/v86/seabios.bin',
  '/assets/v86/vgabios.bin',
];

for (const assetPath of vmAssetPaths) {
  test(`VM asset ${assetPath} rejects query variants before network or cache access`, async () => {
    const harness = createFetchHarness({
      openCache: async () => ({
        match: async () => undefined,
        put: async () => {},
      }),
    });
    const variants = ['?v=1', '?v=2', '?', '?sebook-coi=1'];
    const responses = await Promise.all(variants.map(async suffix => {
      const { responsePromise, lifetimePromise } = harness.dispatchVMAssetFetch(
        `https://sebook.test${assetPath}${suffix}`,
      );
      const response = await responsePromise;
      await lifetimePromise;
      return response;
    }));

    assert.deepEqual(responses.map(response => response.status), [400, 400, 400, 400]);
    assert.equal(harness.networkRequests.length, 0, 'rejected variants must not download asset bodies');
    assert.equal(harness.cacheOpens.length, 0, 'rejected variants must not touch persistent storage');
  });
}

function createMemoryCache(urls = []) {
  const entries = new Map(urls.map(url => [url, new Response('kernel bytes', {
    headers: { ETag: '"kernel-v1"' },
  })]));
  return {
    match: async request => entries.get(request.url)?.clone(),
    put: async (request, response) => { entries.set(request.url, response.clone()); },
    keys: async () => [...entries.keys()].map(url => new Request(url)),
    delete: async request => entries.delete(request.url),
  };
}

test('canonical VM assets remain cached and revalidated without another body download', async () => {
  const cache = createMemoryCache();
  const harness = createFetchHarness({ openCache: async () => cache });

  for (const assetPath of vmAssetPaths) {
    for (let visit = 0; visit < 2; visit += 1) {
      const { responsePromise, lifetimePromise } = harness.dispatchVMAssetFetch(`https://sebook.test${assetPath}`);
      const response = await responsePromise;
      assert.equal(await response.text(), 'kernel bytes');
      await lifetimePromise;
    }
  }

  assert.equal(harness.networkRequests.filter(request => request.method === 'GET').length, 7);
  assert.equal(harness.networkRequests.filter(request => request.method === 'HEAD').length, 7);
  assert.deepEqual((await cache.keys()).map(request => new URL(request.url).pathname), vmAssetPaths);
});

test('activation removes polluted VM entries but preserves canonical assets and unrelated caches', async () => {
  const canonicalURL = 'https://sebook.test/vm/dist/state.bin.gz';
  const cache = createMemoryCache([
    canonicalURL,
    `${canonicalURL}?v=1`,
    `${canonicalURL}?v=2`,
    `${canonicalURL}?`,
    'https://other.test/vm/dist/state.bin.gz',
    'https://sebook.test/unrelated.bin',
  ]);
  const cacheNames = new Set(['vm-assets-v1', 'vm-assets-v2', 'unrelated-feature-cache']);
  const harness = createFetchHarness({
    openCache: async () => cache,
    cacheNames: [...cacheNames],
    deleteCache: async name => cacheNames.delete(name),
  });

  await harness.dispatchActivate();

  assert.deepEqual((await cache.keys()).map(request => request.url), [canonicalURL]);
  assert.deepEqual([...cacheNames], ['vm-assets-v2', 'unrelated-feature-cache']);
  assert.equal(await (await cache.match(new Request(canonicalURL))).text(), 'kernel bytes');
  assert.equal(harness.networkRequests.length, 0, 'cleanup must not download replacement assets');
  assert.equal(harness.clientsClaimed, true);
});

test('activation still claims clients if VM cache cleanup is unavailable', async () => {
  const harness = createFetchHarness({
    openCache: async () => { throw new Error('Cache Storage unavailable'); },
  });

  await harness.dispatchActivate();

  assert.equal(harness.clientsClaimed, true, 'cache cleanup must not disable tutorial isolation');
  assert.equal(harness.warnings.length, 1);
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
