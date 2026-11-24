'use strict';

// The C4 editor's script structure (js/ArchUML/c4/editor, js/tutorial-c4.js). Every editor script is registered in
// the manifest the pages and tests load it from, and loads in Node without a DOM. The inspector, the interface forms,
// the shared actions, and the tutorial adapter were split by concern behind unchanged entry points
// (docs/c4-decisions.md, "Follow-up refactors"; Ruling F6): their exports and the tutorial methods stay as they were,
// and no function in them grows back to the size of the closures the split replaced.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const parser = require('@babel/parser');

const ROOT = path.join(__dirname, '../..');
const ARCHUML = path.join(ROOT, 'js/ArchUML');
const EDITOR_DIR = path.join(ARCHUML, 'c4/editor');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ARCHUML, 'c4/manifest.json'), 'utf8'));
const TUTORIAL_ADAPTER = path.join(ROOT, 'js/tutorial-c4.js');

// The units Ruling F6 split, by file family, and the largest function any of their files may hold. The closures the
// split replaced were 491 to 1,093 lines long.
const SPLIT_FAMILIES = [/^c4-editor-inspector/, /^c4-editor-interfaces/, /^c4-editor-actions/];
const MAX_FUNCTION_LINES = 400;

const editorScriptsOnDisk = () => fs.readdirSync(EDITOR_DIR).filter((name) => name.endsWith('.js'))
  .map((name) => `c4/editor/${name}`).sort();

test('every editor script is in the manifest\'s editor list exactly once, and every listed script exists', () => {
  const listed = MANIFEST.editor;
  assert.equal(new Set(listed).size, listed.length, `the editor list names a script twice: ${listed.join(', ')}`);
  assert.deepEqual([...listed].sort(), editorScriptsOnDisk(),
    'the pages load the editor from the manifest, so a script missing from it never reaches the browser');
});

test('every editor script loads in Node without a DOM and exports its part', () => {
  for (const file of MANIFEST.editor) {
    const exported = require(path.join(ARCHUML, file));
    assert.ok(exported && Object.keys(exported).length > 0, `${file} exports nothing in Node`);
  }
});

test('the inspector, interface forms, and actions keep their exports', () => {
  const exportsOf = (file) => Object.keys(require(path.join(EDITOR_DIR, file))).sort();
  assert.deepEqual(exportsOf('c4-editor-inspector.js'), ['createInspector']);
  assert.deepEqual(exportsOf('c4-editor-actions.js'), ['createActions']);
  assert.deepEqual(exportsOf('c4-editor-interfaces.js'), [
    'cardMarkdown', 'createInterfaceForms', 'createUsesPicker', 'derivedUses', 'diagnosticsByView', 'exampleText',
    'focusPathFor', 'payloadFields', 'realizesGroups', 'renameRewritePaths', 'styleChoices', 'toggleUse', 'useText',
    'usesGroups', 'viewOfPath',
  ]);
});

test('TutorialC4 installs the same tutorial methods and exports', () => {
  const context = { TutorialCode: function TutorialCode() {} };
  context.window = context;
  vm.runInNewContext(fs.readFileSync(TUTORIAL_ADAPTER, 'utf8'), context);
  assert.deepEqual(Object.keys(context.TutorialC4).sort(), ['changedLockedPath', 'configErrors', 'effectiveConfig', 'install']);
  assert.deepEqual(Object.keys(context.TutorialCode.prototype).sort(), [
    '_buildC4Surface', '_c4Data', '_c4EditorChanged', '_c4Evaluate', '_c4Grade', '_c4HostFor', '_c4LockRules', '_c4LockedChange',
    '_c4OutlineStart', '_c4Readable', '_c4RefuseGatedRun', '_c4ReportsAuthorError', '_c4RequestTests', '_c4Snapshot',
    '_c4StepConfig', '_c4TestControlsHTML', '_c4TestGate', '_c4TestsBlocked', '_destroyC4', '_discardStaleC4Run',
    '_evaluateC4Hint', '_flushC4Yaml', '_hintForUncheckedTests', '_initC4', '_invalidateC4', '_loadC4Step',
    '_markC4Submitted', '_pushC4Edits', '_runTestsC4', '_setC4Status', '_settleC4Yaml', '_showC4Surface',
    '_submitC4ForReview', '_teardownC4Editor', '_undoC4LockedChange', '_wireC4Review', '_writeC4Edits',
  ]);
});

/** Every function below a file's outermost ones (its module wrapper and factory) of more than `limit` lines. */
function oversizedFunctions(file, limit) {
  const source = fs.readFileSync(file, 'utf8');
  const found = [];
  const visit = (node, depth) => {
    if (!node || typeof node.type !== 'string') return;
    const isFunction = /Function/.test(node.type);
    if (isFunction && depth > 0) {
      const lines = node.loc.end.line - node.loc.start.line + 1;
      if (lines > limit) found.push(`${path.basename(file)}: ${node.id ? node.id.name : 'a function'} at line ${node.loc.start.line} has ${lines} lines`);
    }
    Object.keys(node).forEach((key) => {
      if (key === 'loc') return;
      const value = node[key];
      (Array.isArray(value) ? value : [value]).forEach((child) => visit(child, depth + (isFunction ? 1 : 0)));
    });
  };
  visit(parser.parse(source, { sourceType: 'script' }).program, 0);
  return found;
}

test(`the inspector, interface forms, actions, and tutorial adapter have no function longer than ${MAX_FUNCTION_LINES} lines`, () => {
  const files = editorScriptsOnDisk().map((file) => path.basename(file))
    .filter((name) => SPLIT_FAMILIES.some((family) => family.test(name)))
    .map((name) => path.join(EDITOR_DIR, name))
    .concat(TUTORIAL_ADAPTER);
  assert.ok(files.length >= 4, 'the split units are found');
  const oversized = files.flatMap((file) => oversizedFunctions(file, MAX_FUNCTION_LINES));
  assert.deepEqual(oversized, [], 'split a unit that has grown back by concern, as its neighbours are');
});
