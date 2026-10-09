const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../js/tutorial-code.js'), 'utf8'), sandbox);

test('file exports take independent snapshots of current editor text, including empty files', () => {
  const tutorial = Object.create(sandbox.window.TutorialCode.prototype);
  let currentText = 'first draft';
  tutorial.editorModels = {
    'src/App.jsx': { model: { getValue: () => currentText } },
    'notes.txt': { model: { getValue: () => '' } },
    'not-for-submission.txt': { model: { getValue: () => 'omit this' } },
  };
  const paths = ['src/App.jsx', 'notes.txt'];
  const first = tutorial.getEditorFileContents(paths);
  currentText = 'latest draft — ✓';
  assert.deepEqual({ ...tutorial.getEditorFileContents(paths) }, {
    'src/App.jsx': 'latest draft — ✓', 'notes.txt': '',
  });
  assert.equal(first['src/App.jsx'], 'first draft');
});

test('file exports fail explicitly when a required editor file is missing', () => {
  const tutorial = Object.create(sandbox.window.TutorialCode.prototype);
  tutorial.editorModels = {};
  assert.throws(() => tutorial.getEditorFileContents(['package.json']), /File is not loaded: package.json/);
});
