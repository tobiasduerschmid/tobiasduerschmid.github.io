const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const source = readFileSync(require.resolve('../../js/sebook-code-preferences.js'), 'utf8');
const key = 'sebook-code-language';

function preferencePage(value = null, blocked = false) {
  const storage = new Map(value === null ? [] : [[key, value]]);
  const events = new Map();
  const window = {
    localStorage: {
      getItem(name) { if (blocked) throw new Error('Storage blocked'); return storage.get(name) ?? null; },
      setItem(name, value) { if (blocked) throw new Error('Storage blocked'); storage.set(name, value); }
    },
    addEventListener(name, listener) { events.set(name, listener); }
  };
  vm.runInNewContext(source, { window });
  return { preferences: window.SEBookCodePreferences, storage, events };
}

test('missing or invalid preferences use Python without writing storage', () => {
  for (const saved of [null, '', 'invalid']) {
    const { preferences, storage } = preferencePage(saved);
    assert.equal(preferences.choose(['java', 'python', 'cpp']), 'python');
    assert.equal(storage.get(key) ?? null, saved);
    assert.equal(preferences.set('unknown'), false);
    assert.equal(preferences.choose(), 'python');
  }
});

test('TypeScript aliases share one preference; fallbacks never overwrite it', () => {
  const { preferences, storage } = preferencePage();
  assert.equal(preferences.set('ts'), true);
  assert.equal(storage.get(key), 'typescript');
  assert.equal(preferences.choose(['python', 'typescript']), 'typescript');
  assert.equal(preferences.choose(['python', 'ts']), 'ts');
  assert.equal(preferences.choose(['java', 'python', 'cpp']), 'python');
  assert.equal(preferences.choose(['java', 'cpp'], 'cpp'), 'cpp');
  assert.equal(preferences.choose(['java', 'cpp']), 'java');
  assert.equal(storage.get(key), 'typescript');
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
  const { preferences, storage, events } = preferencePage('cpp');
  preferences.set('java');
  storage.set(key, 'cpp');
  events.get('pageshow')({ persisted: true });
  assert.equal(preferences.choose(), 'cpp');
  storage.set(key, 'typescript');
  events.get('storage')({ key });
  assert.equal(preferences.choose(), 'typescript');
  storage.clear();
  events.get('storage')({ key: null });
  assert.equal(preferences.choose(), 'python');
});
