const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { loadPyodide } = require('../../js/vendor/pyodide/0.27.0/pyodide.js');

const root = path.resolve(__dirname, '../..');

async function startPythonWorker(t) {
  const pending = new Map();
  let nextId = 0;
  const ready = new Promise(resolve => pending.set('ready', resolve));
  // Adapt only Worker delivery and local asset loading. The production worker,
  // Python interpreter and pyflakes package all execute their actual code.
  const worker = {
    console,
    importScripts() {},
    loadPyodide: () => loadPyodide({ indexURL: path.join(root, 'js/vendor/pyodide/0.27.0') }),
    postMessage(message) {
      const key = message.type === 'ready' ? 'ready' : message.id;
      const receive = pending.get(key);
      if (receive) { pending.delete(key); receive(message); }
    },
  };
  worker.self = worker;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js/pyodide-worker.js'), 'utf8'), worker);
  await ready;
  return message => new Promise((resolve, reject) => {
    const id = ++nextId;
    const deadline = setTimeout(() => {
      pending.delete(id);
      reject(new Error('Python worker did not reply to ' + message.type));
    }, 30_000);
    t.after(() => clearTimeout(deadline));
    pending.set(id, reply => { clearTimeout(deadline); resolve(reply); });
    worker.onmessage({ data: { ...message, id } });
  });
}

for (const [outcome, source, exitCode] of [
  ['successful', 'answer = 42', 0],
  ['failed', 'raise ValueError("try again")', 1],
]) {
  test('Python diagnostics survive a ' + outcome + ' learner execution', { timeout: 60_000 }, async t => {
    const request = await startPythonWorker(t);
    const draft = { type: 'lint', path: '/tutorial/main.py', code: 'print(missing_name)' };
    const before = await request(draft);
    assert.equal(before.markers[0].code, 'UndefinedName');

    const run = await request({ type: 'runCode', code: source, silent: true });
    assert.equal(run.exitCode, exitCode);

    const after = await request(draft);
    assert.equal(after.error, undefined);
    assert.equal(after.markers.length, 1);
    assert.equal(after.markers[0].code, 'UndefinedName');
    assert.match(after.markers[0].message, /missing_name/);
    const corrected = await request({ ...draft, code: 'print(42)' });
    assert.equal(corrected.error, undefined);
    assert.equal(corrected.markers.length, 0);
  });
}

test('Python diagnostics can initialize after learner code rebinds dict', { timeout: 60_000 }, async t => {
  const request = await startPythonWorker(t);
  const run = await request({ type: 'runCode', code: 'dict = 42', silent: true });
  assert.equal(run.exitCode, 0);

  const result = await request({ type: 'lint', path: '/tutorial/main.py', code: 'print(missing_name)' });
  assert.equal(result.error, undefined);
  assert.equal(result.markers.length, 1);
  assert.equal(result.markers[0].code, 'UndefinedName');
});
