'use strict';

// The text adapter replays the UML editor's operation log outside the page (UML-view editing spec §3.6,
// §3.10 stage R5, §9.1; plan Task 21). The gesture corpus logged, for each gesture, every operation the
// editor applied with the document before and after it (tests/uml-editor-corpus/operation-log.js). Here
// the text adapter's files run in a vm sandbox that holds the bundle, as the homework grading test runs
// it, and each logged operation is applied to its recorded `before` alone: no page, no clock, no DOM.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');
const ARCHUML = path.join(ROOT, 'js', 'ArchUML');
const CORPUS = path.join(ROOT, 'tests', 'fixtures', 'uml-editor-corpus');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ARCHUML, 'diagram-editor', 'manifest.json'), 'utf8'));

/** A fresh sandbox holding the bundle and the diagram editor's core and text groups: `{ parts, bundle }`. */
function freshContext() {
  // When it loads, the bundle looks for a page to draw on later; these stubs let it load.
  const sandbox = { document: { readyState: 'loading', addEventListener() {}, documentElement: {} }, MutationObserver: class { observe() {} } };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ARCHUML, 'uml-bundle.js'), 'utf8'), sandbox);
  for (const file of [...MANIFEST.core, ...MANIFEST.text]) {
    vm.runInContext(fs.readFileSync(path.join(ARCHUML, file), 'utf8'), sandbox, { filename: file });
  }
  return { parts: sandbox.ArchUMLDiagramEditorParts, editor: sandbox.ArchUMLDiagramEditor, bundle: sandbox };
}

/** Every logged entry of the corpus, `{ gesture, index, type, before, operation, after }`, in file order. */
function loggedEntries() {
  return fs.readdirSync(CORPUS, { withFileTypes: true })
    .filter((family) => family.isDirectory())
    .flatMap((family) => fs.readdirSync(path.join(CORPUS, family.name)).filter((file) => file.endsWith('.json')).sort()
      .map((file) => JSON.parse(fs.readFileSync(path.join(CORPUS, family.name, file), 'utf8'))))
    .flatMap((fixture) => (fixture.operations || []).map((entry, index) => ({ gesture: fixture.id, index, ...entry })));
}

const ENTRIES = loggedEntries();

/** Applies `operation` to the document `text` of diagram type `type` in `context`: its verdict and every text written. */
function applyIn(context, type, text, operation) {
  const writes = [];
  const adapter = context.editor.createTextAdapter({
    read: () => text, type: () => type, bundle: context.bundle, write: (written) => writes.push(written),
  });
  const verdict = adapter.apply(JSON.parse(JSON.stringify(operation)));
  return { verdict, writes };
}

/** The replay of every logged entry in `context`: the text written for each, or the refusal code. */
function replayAll(context) {
  return ENTRIES.map((entry) => {
    const { verdict, writes } = applyIn(context, entry.type, entry.before, entry.operation);
    return verdict.ok ? writes : `refused ${verdict.code}`;
  });
}

test('the corpus logs operations of every family to replay', () => {
  const families = new Set(ENTRIES.map((entry) => entry.operation.op.split('.')[0]));
  assert.ok(ENTRIES.length >= 300, `${ENTRIES.length} logged operations`);
  for (const family of ['layout', 'element', 'member', 'selection', 'relation', 'lifeline', 'message', 'fragment', 'activation', 'source']) {
    assert.ok(families.has(family), `the corpus logs a ${family}.* operation`);
  }
});

test('each logged operation applied to its recorded before gives the recorded after, byte for byte', () => {
  const context = freshContext();
  const differences = ENTRIES.flatMap((entry) => {
    const { verdict, writes } = applyIn(context, entry.type, entry.before, entry.operation);
    const at = `${entry.gesture} #${entry.index + 1} (${entry.operation.op})`;
    if (!verdict.ok) return [`${at} was refused with ${verdict.code}`];
    if (writes.length !== 1) return [`${at} wrote ${writes.length} times`];
    return writes[0] === entry.after ? [] : [`${at} wrote another text than the recorded after`];
  });

  assert.deepEqual(differences, []);
});

// Refusals the classic editor never logs, made from logged operations: a relation reference that matches
// no line, a message moved to where it already is, and a range past the end of the document.
const REFUSALS = {
  'relation.update': (operation) => ({ ...operation, ref: { ...operation.ref, line: -1, candidates: [] } }),
  'relation.invert': (operation) => ({ ...operation, ref: { ...operation.ref, line: -1, candidates: [] } }),
  'relation.rewire': (operation) => ({ ...operation, ref: { ...operation.ref, line: -1, candidates: [] } }),
  'message.move': (operation) => ({ ...operation, at: { beforeLine: operation.ref.line } }),
  'source.removeLines': (operation) => ({ ...operation, range: { start: 100000, end: 100000 } }),
};

test('a refused operation never calls write', () => {
  const context = freshContext();
  const refusedOps = new Set();
  const written = ENTRIES.filter((entry) => REFUSALS[entry.operation.op]).flatMap((entry) => {
    const { verdict, writes } = applyIn(context, entry.type, entry.before, REFUSALS[entry.operation.op](entry.operation));
    const at = `${entry.gesture} #${entry.index + 1} (${entry.operation.op})`;
    if (verdict.ok) return [`${at} was accepted`];
    refusedOps.add(entry.operation.op);
    assert.equal(typeof verdict.code, 'string', `${at} names a refusal code`);
    assert.equal(verdict.offer, null, `${at} offers nothing`);
    return writes.length ? [`${at} wrote ${writes.length} times`] : [];
  });

  assert.deepEqual(written, []);
  assert.deepEqual([...refusedOps].sort(), Object.keys(REFUSALS).sort(), 'every kind of refusal was met');
});

test('a replay in a second fresh context gives the same bytes', () => {
  assert.deepEqual(replayAll(freshContext()), replayAll(freshContext()));
});
