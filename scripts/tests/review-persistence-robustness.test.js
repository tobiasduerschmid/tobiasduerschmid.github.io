const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const extensionPath = path.resolve(__dirname, '../../chrome-extension/sebook-profile-sync');
const origin = 'https://tobiasduerschmid.github.io';
const settle = () => new Promise(setImmediate);

// Run both real extension scripts. Only browser storage, messaging, clocks, and
// the Chrome worker transport are replaced at their external boundaries.
function syncPage({ bridge = true, cookies = '' } = {}) {
  const values = new Map();
  class Storage {
    get length() { return values.size; }
    key(index) { return [...values.keys()][index] ?? null; }
    getItem(key) { return values.get(String(key)) ?? null; }
    setItem(key, value) { values.set(String(key), String(value)); }
    removeItem(key) { values.delete(String(key)); }
    clear() { values.clear(); }
  }
  class Document {}
  const document = new Document();
  document.cookie = cookies;
  document.documentElement = {
    classList: { add() {}, remove() {} },
    hasAttribute() { return false; },
    setAttribute() {}, removeAttribute() {},
  };
  const listeners = new Map();
  const location = { origin, protocol: 'https:' };
  const window = {
    location,
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(callback);
    },
    removeEventListener(type, callback) { listeners.get(type)?.delete(callback); },
    postMessage(data) {
      queueMicrotask(() => dispatch('message', { origin, source: window, data }));
    },
  };
  window.top = window;
  function dispatch(type, event = {}) {
    [...(listeners.get(type) || [])].forEach((callback) => callback(event));
  }
  let now = 1000;
  let serial = 0;
  const timers = new Map();
  const sent = [];
  const localStorage = new Storage();
  const context = vm.createContext({
    window, document, location, localStorage, Storage, Document, crypto: webcrypto,
    Date: class extends Date { static now() { return now; } },
    setTimeout(callback, delay) {
      timers.set(++serial, { callback, at: now + delay });
      return serial;
    },
    clearTimeout(id) { timers.delete(id); },
    setInterval() {},
    chrome: {
      extension: { inIncognitoContext: false },
      runtime: {
        onMessage: { addListener() {} },
        async sendMessage(message) {
          sent.push(structuredClone(message));
          return { apply: [], revision: 1 };
        },
      },
    },
  });
  for (const name of bridge ? ['page-bridge.js', 'content-script.js'] : ['content-script.js']) {
    vm.runInContext(fs.readFileSync(path.join(extensionPath, name), 'utf8'), context, { filename: name });
  }
  return {
    localStorage, sent,
    writeFromOtherTab(key, value) { values.set(key, value); },
    flush() { dispatch('pagehide'); },
    async advance(milliseconds) {
      const until = now + milliseconds;
      await settle();
      while (true) {
        const next = [...timers].filter(([, timer]) => timer.at <= until)
          .sort((left, right) => left[1].at - right[1].at)[0];
        if (!next) break;
        const [id, timer] = next;
        timers.delete(id);
        now = timer.at;
        timer.callback();
        await settle();
      }
      now = until;
    },
  };
}

test('a successfully synced local edit stops uploading until another change occurs', async () => {
  const app = syncPage();
  await app.advance(0);
  app.localStorage.setItem('draft', 'saved text');

  await app.advance(3000);

  const pushes = app.sent.filter((message) => message.type === 'push');
  assert.equal(pushes.length, 1, 'one edit must not generate repeated uploads after acknowledgement');
  assert.equal(pushes[0].entries.find((entry) => entry.key === 'draft').value, 'saved text');
});

test('an acknowledged deletion cannot hide a later restoration from another tab', async () => {
  const app = syncPage();
  await app.advance(0);
  app.localStorage.setItem('draft', 'original text');
  await app.advance(1000);
  app.localStorage.removeItem('draft');
  await app.advance(1000);

  app.writeFromOtherTab('draft', 'restored text');
  app.flush();
  await app.advance(0);

  const restored = app.sent.at(-1).entries.find((entry) => entry.key === 'draft');
  assert.equal(restored.deleted, false, 'the earlier pending delete must not override current storage');
  assert.equal(restored.value, 'restored text');
});

test('sync fallback preserves cookies when the page bridge cannot answer', async () => {
  const app = syncPage({ bridge: false, cookies: 'dark-mode=true; se-gym=%5B%5D' });
  app.localStorage.setItem('draft', 'saved text');

  await app.advance(2000);

  const entries = app.sent[0].entries;
  assert.deepEqual(entries.map(({ area, key, value }) => ({ area, key, value })), [
    { area: 'local', key: 'draft', value: 'saved text' },
    { area: 'cookie', key: 'dark-mode', value: 'true' },
    { area: 'cookie', key: 'se-gym', value: '[]' },
  ], 'omitted cookies would be interpreted as deletions of the synced preferences');
});

function bookmarkStore(value) {
  const document = { cookie: 'se-bookmarks=' + encodeURIComponent(JSON.stringify(value)) };
  const context = vm.createContext({ document, window: {} });
  vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../js/se-bookmarks.js'), 'utf8'), context);
  return { api: context.window.SEBookmarks, document };
}

for (const value of [null, {}, 'not an array', 42, true]) {
  test(`bookmarks safely ignore ${JSON.stringify(value)} without overwriting the cookie`, () => {
    const { api, document } = bookmarkStore(value);
    const originalCookie = document.cookie;

    assert.equal(api.isBookmarked('/SEBook/'), false);
    assert.equal(api.getBookmarks().length, 0);
    assert.equal(document.cookie, originalCookie);
  });
}

test('bookmarks ignore invalid entries while preserving valid saved bookmarks', () => {
  const valid = { url: '/SEBook/testing/', title: 'Testing' };
  const { api, document } = bookmarkStore([
    null, false, 42, 'invalid', {}, { url: null, title: 'Missing URL' },
    { url: '/SEBook/invalid/', title: null }, valid,
  ]);
  const originalCookie = document.cookie;

  assert.equal(api.isBookmarked(valid.url), true);
  assert.equal(api.isBookmarked('/SEBook/invalid/'), false);
  assert.deepEqual(Array.from(api.getBookmarks(), entry => ({ ...entry })), [valid]);
  assert.equal(document.cookie, originalCookie);
});
