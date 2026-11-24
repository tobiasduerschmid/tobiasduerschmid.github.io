const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../js/tutorial-code.js'), 'utf8');

// The real runtime evaluates in a sandbox; only browser globals it touches
// while constructing and editing models are supplied.
function createTutorial(options) {
  const sandbox = {
    document: { cookie: '' }, AbortController, console,
    setTimeout, clearTimeout,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(source, sandbox, { filename: 'tutorial-code.js' });
  const tutorial = new sandbox.TutorialCode({ querySelector: () => null }, Object.assign({ backend: 'pyodide' }, options));
  return { tutorial, sandbox };
}

function fakeModel(value) {
  return {
    getValue: () => value,
    setValue(next) { value = next; },
  };
}

test('steps without files receive shared_files', () => {
  const shared = [
    { path: 'services/opc/orders.py', content: 'class OrderService: ...\n' },
    { path: 'deploy/broker.toml', content: 'key = "order.*"\n', readonly: true },
  ];
  const own = [{ path: 'main.py', content: 'print(1)\n' }];
  const { tutorial } = createTutorial({
    sharedFiles: shared,
    steps: [{ title: 'Shared' }, { title: 'Own files', files: own }, { title: 'No files', files: [] }],
  });

  assert.equal(tutorial.steps[0].files, shared, 'a step without files reuses the shared list itself');
  assert.equal(tutorial.steps[1].files, own, 'a step with its own files keeps them');
  assert.deepEqual(tutorial.steps[2].files, [], 'an explicit empty list stays empty');
});

test('step-level readonly marks every step file read-only', () => {
  const { tutorial } = createTutorial({
    steps: [
      { title: 'Review', readonly: true, files: [{ path: 'orders.py' }, { path: 'notes.md' }] },
      { title: 'Edit', files: [{ path: 'orders.py' }, { path: 'broker.toml', readonly: true }] },
    ],
  });

  tutorial.currentStep = 0;
  assert.equal(tutorial._isReadOnlyFile('orders.py'), true);
  assert.equal(tutorial._isReadOnlyFile('notes.md'), true);

  tutorial.currentStep = 1;
  assert.equal(tutorial._isReadOnlyFile('orders.py'), false, 'read-only applies only to the step that declares it');
  assert.equal(tutorial._isReadOnlyFile('broker.toml'), true, 'a file-level flag marks that file');
  assert.equal(tutorial._isReadOnlyFile('unknown.py'), false);
});

test('popout edits to a read-only file leave it unchanged', () => {
  const { tutorial } = createTutorial({
    steps: [{ title: 'Mixed', files: [{ path: 'broker.toml', readonly: true }, { path: 'notes.md' }] }],
  });
  tutorial.currentStep = 0;
  tutorial.editorModels = {
    'broker.toml': { model: fakeModel('key = "order.*"\n') },
    'notes.md': { model: fakeModel('# Notes\n') },
  };

  tutorial._applyFileEditFromPopup('broker.toml', 'key = "#"\n');
  tutorial._applyFileEditFromPopup('notes.md', '# Notes\nqueue found\n');

  assert.equal(tutorial.editorModels['broker.toml'].model.getValue(), 'key = "order.*"\n');
  assert.equal(tutorial.editorModels['notes.md'].model.getValue(), '# Notes\nqueue found\n');
});

test('a refactoring that would change a read-only file is refused without editing any file', async () => {
  const { tutorial, sandbox } = createTutorial({
    steps: [{ title: 'Mixed', files: [{ path: 'orders.py', readonly: true }, { path: 'notes.py' }] }],
  });
  tutorial.currentStep = 0;
  tutorial.editorModels = {
    'orders.py': { model: fakeModel('def place(): ...\n') },
    'notes.py': { model: fakeModel('place()\n') },
  };
  // Mirrors the documented applyEditsToModels contract: each named file's
  // model receives its replacement text.
  sandbox.monaco = {};
  sandbox.SebookRefactorings = {
    applyEditsToModels(monaco, edits, modelFor) {
      return edits.filter(edit => {
        const model = modelFor(edit.filename);
        if (model) model.setValue(edit.text);
        return !!model;
      }).map(edit => edit.filename);
    },
  };

  await assert.rejects(
    tutorial._applyRefactoringEdits([
      { filename: 'orders.py', text: 'def submit(): ...\n' },
      { filename: 'notes.py', text: 'submit()\n' },
    ], { title: 'Rename' }),
    /read-only/,
  );
  assert.equal(tutorial.editorModels['orders.py'].model.getValue(), 'def place(): ...\n');
  assert.equal(tutorial.editorModels['notes.py'].model.getValue(), 'place()\n', 'a refused plan changes no file');
});
