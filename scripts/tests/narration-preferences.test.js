const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const source = readFileSync(require.resolve('../../js/narration-preferences.js'), 'utf8');
const key = 'sebook-narration-preferences';
const encode = value => encodeURIComponent(JSON.stringify(value));
const expected = (captions, speed, finalCheckOnly = false) => ({ captions, speed, finalCheckOnly });

// The browser's cookie boundary: real preference code, with an external
// cookie jar that can deny storage or change while this page is inactive.
function preferencePage(saved = null, blocked = '', protocol = 'https:') {
  let cookie = saved;
  const writes = [];
  const window = new EventTarget();
  const document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  Object.defineProperty(document, 'cookie', {
    get() {
      if (blocked === 'throws') throw new Error('Storage blocked');
      return `unrelated=kept${cookie === null ? '' : `; ${key}=${cookie}`}`;
    },
    set(value) {
      writes.push(value);
      if (blocked === 'throws') throw new Error('Storage blocked');
      if (!blocked) cookie = value.split(';')[0].slice(key.length + 1);
    },
  });
  const context = vm.createContext({ window, document, location: { protocol } });
  vm.runInContext(source, context);
  const observed = [];
  const preferences = window.NarrationPreferences;
  preferences.subscribe(value => observed.push(JSON.parse(JSON.stringify(value))));
  return {
    preferences, writes, observed, window, document,
    get current() { return observed.at(-1); },
    get stored() { return cookie; },
    replaceCookie(value) { cookie = value; },
    loadAgain() { vm.runInContext(source, context); },
  };
}

test('missing or malformed cookies default to captions on and 1x without writing', () => {
  for (const cookie of [null, '', '%', 'not-json', encode(null), encode([]), encode({ captions: 'false', speed: 99 })]) {
    const page = preferencePage(cookie);
    assert.deepEqual(page.current, expected(true, 1));
    assert.equal(page.stored, cookie);
    assert.equal(page.writes.length, 0);
  }
  assert.deepEqual(preferencePage(encode({ captions: false, speed: -1 })).current, expected(false, 1));
  assert.deepEqual(preferencePage(encode({ captions: null, speed: 2 })).current, expected(true, 2));
});

test('each supported speed survives reload and changing one field preserves the other', () => {
  const page = preferencePage();
  assert.equal(page.preferences.set({ finalCheckOnly: true }), true);
  assert.equal(page.preferences.set({ captions: false }), true);
  for (const speed of [0.5, 0.75, 1, 1.25, 1.5, 2]) {
    assert.equal(page.preferences.set({ speed }), true);
    assert.deepEqual(preferencePage(page.stored).current, expected(false, speed, true));
  }
  page.preferences.set({ captions: true });
  assert.deepEqual(preferencePage(page.stored).current, expected(true, 2, true));
  assert.match(page.writes.at(-1), /; Max-Age=31536000; Path=\/; SameSite=Lax; Secure$/);
  const http = preferencePage(null, '', 'http:');
  http.preferences.set({ speed: 2 });
  assert.doesNotMatch(http.writes[0], /; Secure/);
});

test('subscribers share changes, including when the script is included by multiple players', () => {
  const page = preferencePage();
  const second = [];
  const unsubscribe = page.preferences.subscribe(value => second.push(value.speed));
  page.loadAgain();
  assert.equal(page.window.NarrationPreferences, page.preferences);
  page.preferences.set({ speed: 1.5 });
  assert.equal(page.current.speed, 1.5);
  assert.deepEqual(second, [1, 1.5]);
  unsubscribe();
  page.preferences.set({ speed: 2 });
  assert.deepEqual(second, [1, 1.5]);
});

for (const blocked of ['throws', 'ignores writes']) {
  test(`${blocked}: blocked cookies keep this page's choices usable and report a failed save`, () => {
    const page = preferencePage(null, blocked);
    assert.equal(page.preferences.set({ captions: false }), false);
    assert.equal(page.preferences.set({ speed: 1.5 }), false);
    page.window.dispatchEvent(new Event('focus'));
    assert.deepEqual(page.current, expected(false, 1.5));
    assert.equal(page.stored, null);
  });
}

test('returning to a tab or history page picks up changes and deletion', () => {
  const page = preferencePage();
  for (const [target, event] of [[page.window, 'focus'], [page.window, 'pageshow'], [page.document, 'visibilitychange']]) {
    page.replaceCookie(encode({ captions: false, speed: 2 }));
    target.dispatchEvent(new Event(event));
    assert.deepEqual(page.current, expected(false, 2));
    page.replaceCookie(null);
    target.dispatchEvent(new Event(event));
    assert.deepEqual(page.current, expected(true, 1));
  }
  assert.equal(page.writes.length, 0);
});

test('a new choice merges with the latest cookie, preserving another tab’s changed field', () => {
  const page = preferencePage();
  page.replaceCookie(encode({ captions: false, speed: 1 }));
  page.preferences.set({ speed: 0.5 });
  assert.deepEqual(preferencePage(page.stored).current, expected(false, 0.5));
});

test('only an explicit boolean enables skipping segment checks; turning it off persists', () => {
  for (const value of [undefined, null, 'true', 1, false]) {
    assert.deepEqual(preferencePage(encode({ finalCheckOnly: value })).current, expected(true, 1));
  }
  const page = preferencePage(encode({ captions: false, speed: 1.5, finalCheckOnly: true }));
  assert.deepEqual(page.current, expected(false, 1.5, true));
  assert.equal(page.preferences.set({ finalCheckOnly: false }), true);
  assert.deepEqual(preferencePage(page.stored).current, expected(false, 1.5));
});
