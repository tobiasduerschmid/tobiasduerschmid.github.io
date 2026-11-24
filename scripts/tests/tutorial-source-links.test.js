// `path:line` references to project files become controls that open the
// file at that line (js/tutorial-source-links.js): in diagram notes, and in
// code spans of the diagram challenge's Markdown.
const test = require('node:test');
const assert = require('node:assert/strict');
const { findSourceReferences, parseSourceReference } = require('../../js/tutorial-source-links.js');

const PROJECT = new Set([
  'stubs/bank.py',
  'services/opc/invoice_task.py',
  'deploy/broker.toml',
  'services/v1.2/api.py',
  'README.md',
]);
const isProjectFile = path => PROJECT.has(path);

test('a path:line inside a sentence is found with its position', () => {
  const text = 'validate: 300 ms (stubs/bank.py:5).';
  assert.deepEqual(findSourceReferences(text, isProjectFile), [
    { start: 18, end: 33, text: 'stubs/bank.py:5', path: 'stubs/bank.py', line: 5, column: 1 },
  ]);
});

test('a path:line:column keeps its column', () => {
  const [ref] = findSourceReferences('see services/opc/invoice_task.py:35:9 here', isProjectFile);
  assert.equal(ref.line, 35);
  assert.equal(ref.column, 9);
  assert.equal(ref.text, 'services/opc/invoice_task.py:35:9');
});

test('a path that is not a project file stays plain text', () => {
  assert.deepEqual(findSourceReferences('(foo.py:3) and (stubs/missing.py:4)', isProjectFile), []);
});

test('dots in folder names belong to the path', () => {
  const [ref] = findSourceReferences('(services/v1.2/api.py:12,', isProjectFile);
  assert.equal(ref.path, 'services/v1.2/api.py');
  assert.equal(ref.line, 12);
});

test('several references in one text are all found, in order', () => {
  const refs = findSourceReferences('(deploy/broker.toml:16, stubs/bank.py:5)', isProjectFile);
  assert.deepEqual(refs.map(ref => ref.text), ['deploy/broker.toml:16', 'stubs/bank.py:5']);
});

test('a reference does not start inside a longer path or word', () => {
  assert.deepEqual(findSourceReferences('xstubs/bank.py:5 and other/stubs/bank.py:5', isProjectFile), []);
});

test('line zero and a missing line are not references', () => {
  assert.deepEqual(findSourceReferences('stubs/bank.py:0 stubs/bank.py: README.md', isProjectFile), []);
});

test('a code span links only when its whole text is one reference', () => {
  assert.equal(parseSourceReference('services/opc/invoice_task.py:35', isProjectFile).line, 35);
  assert.equal(parseSourceReference(' README.md:2:4 ', isProjectFile).column, 4);
  assert.equal(parseSourceReference('see stubs/bank.py:5', isProjectFile), null);
  assert.equal(parseSourceReference('stubs/bank.py', isProjectFile), null);
  assert.equal(parseSourceReference('foo.py:3', isProjectFile), null);
});
