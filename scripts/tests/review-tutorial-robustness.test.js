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

async function startThemeTutorial(firstStep) {
  let themeChanged;
  let dark = false;
  const previewDocuments = [];
  const editorThemes = [];
  const terminalThemes = [];
  const sandbox = {
    AbortController,
    document: { cookie: '', documentElement: { classList: { contains: () => dark } } },
    monaco: { editor: { setTheme: theme => editorThemes.push(theme) } },
    MutationObserver: class {
      constructor(callback) { themeChanged = callback; }
      observe() {}
    },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js/tutorial-code.js'), 'utf8'), sandbox);
  const reactStep = { backend: 'react', files: [{ path: 'app.jsx', content: 'render(<p>Welcome</p>);' }] };
  const tutorial = new sandbox.TutorialCode({ setAttribute() {}, querySelector() { return null; } }, {
    backend: 'multiple', steps: [firstStep, reactStep],
  });
  // Supply only the browser/editor startup boundary. Theme handling, backend
  // selection, preview document generation and iframe replacement stay real.
  tutorial._buildUI = tutorial._showLoading = tutorial._hideLoading = () => {};
  tutorial._loadDependencies = tutorial._initEditor = () => Promise.resolve();
  const steps = tutorial.steps;
  tutorial.steps = [];
  await tutorial.start();
  tutorial.steps = steps;
  tutorial.editor = {};
  tutorial.term = { setOption(name, theme) { terminalThemes.push(theme); } };
  const frameParent = { replaceChild(frame) { previewDocuments.push(frame.srcdoc); } };
  const makeFrame = () => ({ parentNode: frameParent, cloneNode: makeFrame, removeAttribute() {} });
  tutorial._previewFrame = makeFrame();
  function selectStep(index) {
    tutorial.currentStep = index;
    tutorial.editorModels = Object.fromEntries(steps[index].files.map(file => [file.path, {
      model: { getValue: () => file.content },
    }]));
    tutorial._setActiveBackend(steps[index].backend);
  }
  selectStep(0);
  return {
    previewDocuments, editorThemes, terminalThemes, selectStep,
    setDarkMode(value) { dark = value; themeChanged(); },
  };
}

for (const [language, filename, content] of [
  ['Python', 'playlist.py', 'from typing import TypedDict'],
  ['Markdown', 'recall.md', '# Recall what you learned'],
]) {
  test(`theme changes keep ${language} lesson files out of the inactive React preview`, async () => {
    const tutorial = await startThemeTutorial({ backend: 'pyodide', files: [{ path: filename, content }] });

    tutorial.setDarkMode(true);
    tutorial.setDarkMode(false);

    assert.equal(tutorial.previewDocuments.length, 0, 'non-React lesson source must not execute in a hidden React frame');
    assert.equal(new Set(tutorial.editorThemes).size, 2, 'the editor must still receive both themes');
    assert.equal(new Set(tutorial.terminalThemes.map(theme => theme.background)).size, 2,
      'the terminal must still receive both themes');
  });
}

test('theme changes update the active React preview and stop after switching to Python', async () => {
  const tutorial = await startThemeTutorial({ backend: 'pyodide', files: [{ path: 'main.py', content: 'print(42)' }] });
  tutorial.selectStep(1);

  tutorial.setDarkMode(true);
  tutorial.setDarkMode(false);

  assert.equal(tutorial.previewDocuments.length, 2);
  assert.match(tutorial.previewDocuments[0], /data-bs-theme="dark"/);
  assert.match(tutorial.previewDocuments[1], /data-bs-theme="light"/);
  assert.ok(tutorial.previewDocuments.every(html => html.includes('render(<p>Welcome</p>);')),
    'changing theme must retain the current React source');

  tutorial.selectStep(0);
  tutorial.setDarkMode(true);
  assert.equal(tutorial.previewDocuments.length, 2, 'returning to Python must stop React execution');
  assert.equal(tutorial.editorThemes.at(-1), tutorial.editorThemes[0], 'the Python editor must still change theme');
});
