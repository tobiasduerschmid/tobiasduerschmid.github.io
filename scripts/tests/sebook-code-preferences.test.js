const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const source = readFileSync(require.resolve('../../js/sebook-code-preferences.js'), 'utf8');
const key = 'sebook-code-language';

function preferencePage(value = null, blocked = false, legacy = null) {
  const storage = new Map(legacy === null ? [] : [[key, legacy]]);
  let cookie = value;
  const writes = [];
  const document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  Object.defineProperty(document, 'cookie', {
    get() { if (blocked) throw new Error('Storage blocked'); return cookie === null ? '' : `${key}=${cookie}`; },
    set(value) {
      if (blocked) throw new Error('Storage blocked');
      writes.push(value);
      cookie = value.split(';')[0].slice(key.length + 1);
    },
  });
  const events = new Map();
  const window = Object.assign(new EventTarget(), {
    document, location: { protocol: 'https:' }, cookieStore: new EventTarget(),
    localStorage: {
      getItem(name) { return storage.get(name) ?? null; },
      removeItem(name) { storage.delete(name); },
    },
    addEventListener(name, listener) {
      events.set(name, listener);
      EventTarget.prototype.addEventListener.call(this, name, listener);
    }
  });
  vm.runInNewContext(source, { window, Event });
  return { preferences: window.SEBookCodePreferences, storage, events, window, document, writes,
    get cookie() { return cookie; }, replaceCookie(value) { cookie = value; } };
}

test('missing or invalid preferences use Python without writing storage', () => {
  for (const saved of [null, '', 'invalid']) {
    const page = preferencePage(saved);
    const { preferences } = page;
    assert.equal(preferences.choose(['java', 'python', 'cpp']), 'python');
    assert.equal(page.cookie, saved);
    assert.equal(page.writes.length, 0);
    assert.equal(preferences.set('unknown'), false);
    assert.equal(preferences.choose(), 'python');
  }
});

test('TypeScript aliases share one preference; fallbacks never overwrite it', () => {
  const page = preferencePage();
  const { preferences } = page;
  assert.equal(preferences.set('ts'), true);
  assert.equal(page.cookie, 'typescript');
  assert.equal(preferences.choose(['python', 'typescript']), 'typescript');
  assert.equal(preferences.choose(['python', 'ts']), 'ts');
  assert.equal(preferences.choose(['java', 'python', 'cpp']), 'python');
  assert.equal(preferences.choose(['java', 'cpp'], 'cpp'), 'cpp');
  assert.equal(preferences.choose(['java', 'cpp']), 'java');
  assert.equal(page.cookie, 'typescript');
  assert.match(page.writes.at(-1), /; Max-Age=31536000; Path=\/; SameSite=Lax; Secure$/);
});

test('blocked storage still permits synchronization and reports it cannot save', () => {
  const { preferences } = preferencePage(null, true);
  const observed = [];
  const unsubscribe = preferences.subscribe(() => observed.push(preferences.choose()));
  assert.equal(preferences.set('cpp'), false);
  assert.deepEqual(observed, ['python', 'cpp']);
  unsubscribe();
  preferences.set('java');
  assert.deepEqual(observed, ['python', 'cpp']);
  assert.equal(preferences.choose(), 'java');
});

test('restored pages follow the saved preference; external changes and deletion synchronize', () => {
  const page = preferencePage('cpp');
  const { preferences, events } = page;
  preferences.set('java');
  page.replaceCookie('cpp');
  events.get('pageshow')({ persisted: true });
  assert.equal(preferences.choose(), 'cpp');
  page.replaceCookie('typescript');
  page.window.cookieStore.dispatchEvent(new Event('change'));
  assert.equal(preferences.choose(), 'typescript');
  page.replaceCookie(null);
  events.get('focus')();
  assert.equal(preferences.choose(), 'python');
});

test('legacy language choices move to cookies without overriding a newer choice', () => {
  const migrated = preferencePage(null, false, 'ts');
  assert.equal(migrated.preferences.choose(), 'typescript');
  assert.equal(migrated.cookie, 'typescript');
  assert.equal(migrated.storage.has(key), false);
  const newer = preferencePage('cpp', false, 'java');
  assert.equal(newer.preferences.choose(), 'cpp');
  assert.equal(newer.cookie, 'cpp');
  assert.equal(newer.storage.has(key), false);
});

test('failed migration preserves the legacy choice and keeps the page usable', () => {
  const page = preferencePage(null, true, 'java');
  assert.equal(page.preferences.choose(), 'java');
  assert.equal(page.storage.get(key), 'java');
  assert.equal(page.preferences.set('cpp'), false);
  page.events.get('focus')();
  assert.equal(page.preferences.choose(), 'cpp');
});
