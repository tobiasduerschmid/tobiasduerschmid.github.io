'use strict';

// The source-structure tests of the UML editor refactor read the inline script
// of _includes/uml-editor.html through one helper (plan Task 3). The script is
// not JavaScript as it stands: it holds a Liquid output tag. Every write site of
// spec 2026-11-12 §3.5 is keyed by the chain of named functions around it and
// its ordinal in that chain, because two listeners can share a target and an
// event (§3.10, stage R0).
//
// These tests pin the helper, not the include. Stages R1-R6 convert the write
// sites and move the style assignments, and this file stays green through them
// (plan M1, step 4). So the tests that try the helper on the real editor read
// the include as it stood at stage R0, frozen in R0_INCLUDE_FILE (sealed with
// the corpus by plan Task 9); the others use synthetic sources and a built-page
// snippet. The one test of the live include asks what every stage keeps: the
// helper can read it. The live include's write sites are the write-site map's
// (plan Task 10), which follows each conversion.

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const zlib = require('node:zlib');
const babelParser = require('@babel/parser');

const {
  includeScript,
  parse,
  loadIncludeScript,
  walk,
  functionNameOf,
  functionChainOf,
  assignmentsTo,
  literalStyleAssignments,
} = require('./helpers/uml-editor-script');

// _includes/uml-editor.html as it stood at stage R0 (gzip, so a search of the
// repository finds the editor's functions only in the live include).
const R0_INCLUDE_FILE = path.join(__dirname, '..', '..', 'tests', 'uml-editor-corpus', 'r0', 'uml-editor.html.gz');
// Its sha256 in lane R's start record (2026-11-13), the tree the R0 baseline was taken on.
const R0_INCLUDE_SHA256 = 'bd6a63e874504453750ac7f78c493578aa3ec7e9b3005f32caeb8c317a12ccce';
const R0_SOURCE = zlib.gunzipSync(fs.readFileSync(R0_INCLUDE_FILE)).toString('utf8');
const R0_LINES = R0_SOURCE.split('\n');

/** The R0 include's script, as loadIncludeScript reads the live one: `{ code, liquid, line, ast }`. */
function loadR0Script() {
  const script = includeScript(R0_SOURCE);
  return { ...script, ast: parse(script.code, { startLine: script.line }) };
}

// Spec §3.5: the write sites that are named functions, with their assignment counts.
const NAMED_WRITE_SITES = {
  applySnapshot: 1, renderDiagram: 1, resetCurrentDiagramToStarter: 1,
  nudgeElement: 1, updateDrag: 3,
  placeElementAt: 14, addElementWithoutCanvas: 1, addEmptyElement: 1, addClassStarter: 1,
  addStateStarter: 1, addSequenceStarterPair: 1, addSequenceParticipant: 1,
  addDeploymentChildIntoNode: 1, updateExtendDrag: 1, handleHitboxClickForSequenceElementTool: 2,
  handleHitboxClickForAnchoredNoteTool: 1,
  renameElement: 3, renameActivityElement: 1, setSequenceLifelineHead: 1,
  updateSequenceParticipant: 1, replaceVirtualNoteText: 1,
  replaceClassDeclaration: 1, replaceGenericElement: 1, replaceCrcCard: 1, changeSystemMembership: 1,
  deleteSelected: 4,
  duplicateElement: 1, duplicateSelected: 1,
  addSequenceRelationAtLine: 1, showRelationChooser: 1, connectWithSelectedRelationTool: 2,
  addSequenceSingleMessage: 2, handleHitboxClickForRelation: 1,
  replaceRelationLine: 1, rewireRelationEndpoint: 1, invertRelationDirection: 1,
  moveSequenceMessageBlockToLine: 1, moveSequenceMessageToBranch: 1,
  changeFragmentKind: 1, changeFragmentCondition: 1, changeFragmentBranchCondition: 1,
  addFragmentElseBranch: 1, unwrapFragment: 1, moveFragmentBy: 2, moveSequenceFragmentToLine: 1,
  commitWrap: 1,
  setActivationBarSlots: 1, createActivationBar: 1,
  renderChildren: 1, renderPorts: 1, renderDeploymentChildren: 1,
  replaceLineForElementId: 1,
  commitSource: 1,
  makeQuickInsertButton: 1, replaceSequenceLineRange: 1, replaceLineModelRow: 1,
  deleteLineModelRow: 1, moveLineModelRow: 1, addGitgraphBranchRow: 1, addGitgraphCommitRow: 1,
  addLineModelPreset: 8,
};

// Spec §3.5 names the other write sites by what they are, not by a function. Each is the
// scope, listener, or inner function that holds it in the include: the two loads at start in
// init's own body, the type switch, the layout select, Reset Selected, Reset Layout, the
// in-place fragment editor's `commit` (inside startInlineFragmentEdit), and the Delete button
// of a participant row of the sequence model panel (inside buildSequenceParticipantRow).
const DESCRIBED_WRITE_SITES = {
  init: 2,
  'typeSelect:change': 2,
  'layoutSelect:change': 1,
  'resetOneBtn:click': 3,
  'resetLayoutBtn:click': 1,
  commit: 1,
  buildSequenceParticipantRow: 1,
};

function countBy(items, keyOf) {
  const counts = {};
  for (const item of items) counts[keyOf(item)] = (counts[keyOf(item)] || 0) + 1;
  return counts;
}

function functionNamesIn(code) {
  const names = [];
  walk(parse(code), (path) => {
    if (/Function|ObjectMethod/.test(path.node.type)) names.push(functionNameOf(path));
  });
  return names;
}

function withoutAssignment(code, entry) {
  // Replace the assignment by `0` and blanks, keeping its line breaks, so every other offset and line stays put.
  const blanked = '0' + code.slice(entry.start + 1, entry.end).replace(/[^\n]/g, ' ');
  return code.slice(0, entry.start) + blanked + code.slice(entry.end);
}

test('the golden input is the include as it stood at stage R0', () => {
  assert.equal(crypto.createHash('sha256').update(R0_SOURCE).digest('hex'), R0_INCLUDE_SHA256);
});

test('the inline script parses once its Liquid output tags are string literals', () => {
  const { code, liquid, line } = includeScript(R0_SOURCE);

  assert.deepEqual(liquid, [{
    tag: "{{ '/uml-python-workspace.html' | relative_url | jsonify }}",
    literal: '"/uml-python-workspace.html"',
  }]);
  assert.match(code, /function init\(\)/);
  assert.doesNotMatch(code, /\{\{|\}\}/, 'no Liquid output tag is left in the code');
  assert.equal(R0_LINES[line - 1].trim(), '<script>', 'line names the line of the script tag');

  const rawScript = R0_SOURCE.slice(R0_SOURCE.indexOf('<script>\n(function () {') + '<script>'.length,
    R0_SOURCE.lastIndexOf('</script>'));
  assert.throws(() => babelParser.parse(rawScript, { sourceType: 'script' }), SyntaxError,
    'as it stands, with its Liquid tag, the script is not JavaScript');
  assert.equal(parse(code).type, 'File');
});

test('the helper reads the live include: no Liquid output tag is left in its code, and the code parses', () => {
  const { code, ast } = loadIncludeScript();

  assert.doesNotMatch(code, /\{\{[\s\S]*?\}\}/);
  assert.equal(ast.type, 'File');
});

test('a function expression is named by its variable, its object property, or its listener\'s target and event', () => {
  const code = [
    'function init() {',
    '  function declared() {}',
    '  var commitSource = function () {};',
    '  var arrow = () => {};',
    '  var editor = create({ commitSource: function (text) {}, getSource() {} });',
    '  typeSelect.addEventListener(\'change\', function () {});',
    '  addHitboxListener(\'dblclick\', function () {});',
    '  items.forEach(function (item) {});',
    '}',
  ].join('\n');

  assert.deepEqual(functionNamesIn(code), [
    'init', 'declared', 'commitSource', 'arrow', 'commitSource', 'getSource',
    'typeSelect:change', 'hitbox:dblclick', null,
  ]);
});

test('a write site\'s chain joins the named functions around it from init inward and leaves anonymous callbacks out', () => {
  const ast = parse([
    'function init() {',
    '  textarea.value = "load";',
    '  function showRelationChooser() {',
    '    options.forEach(function (option) {',
    '      btn.addEventListener("click", function () { textarea.value = "relation"; });',
    '    });',
    '  }',
    '}',
  ].join('\n'));

  const writes = assignmentsTo(ast, 'textarea.value');

  assert.deepEqual(writes.map(({ key, chain, site, ordinal, line }) => ({ key, chain, site, ordinal, line })), [
    { key: 'init#1', chain: 'init', site: 'init', ordinal: 1, line: 2 },
    { key: 'showRelationChooser>btn:click#1', chain: 'showRelationChooser>btn:click', site: 'showRelationChooser', ordinal: 1, line: 5 },
  ]);
  let chainOfWrite = null;
  walk(ast, (path) => {
    if (path.node.type === 'StringLiteral' && path.node.value === 'relation') chainOfWrite = functionChainOf(path);
  });
  assert.equal(chainOfWrite, 'showRelationChooser>btn:click');
});

test('assignmentsTo finds the 103 assignments to textarea.value', () => {
  const { ast } = loadR0Script();

  const writes = assignmentsTo(ast, 'textarea.value');

  assert.equal(writes.length, 103);
  assert.equal(new Set(writes.map((write) => write.key)).size, 103, 'every write site has its own key');
  for (const write of writes) {
    assert.match(R0_LINES[write.line - 1], /textarea\.value\s*=(?!=)/, `${write.key} is on line ${write.line} of the R0 include`);
  }
  assert.deepEqual(countBy(writes, (write) => write.site), { ...NAMED_WRITE_SITES, ...DESCRIBED_WRITE_SITES });
});

test('two listeners with the same target and event in different functions get different keys', () => {
  const { ast } = loadR0Script();
  const writes = assignmentsTo(ast, 'textarea.value');

  for (const [listener, sites] of [['btn:click', ['showRelationChooser', 'makeQuickInsertButton']],
    ['rmBtn:click', ['renderPorts', 'renderDeploymentChildren']]]) {
    const sharing = writes.filter((write) => write.chain.split('>').pop() === listener);
    assert.deepEqual(sharing.map((write) => write.site).sort(), [...sites].sort(), `the ${listener} writes`);
    assert.equal(new Set(sharing.map((write) => write.key)).size, sites.length, `the ${listener} writes have different keys`);
    for (const write of sharing) assert.ok(write.key.includes(`${write.site}>`), `${write.key} names its function`);
  }
});

test('removing the assignments of one function changes no key of another', () => {
  const { code, line } = includeScript(R0_SOURCE);
  const before = assignmentsTo(parse(code, { startLine: line }), 'textarea.value');
  const removed = before.filter((write) => write.site === 'showRelationChooser');
  assert.equal(removed.length, 1);

  const after = assignmentsTo(parse(withoutAssignment(code, removed[0]), { startLine: line }), 'textarea.value');

  const quickInsertKey = (writes) => writes.filter((write) => write.site === 'makeQuickInsertButton').map((write) => write.key);
  assert.deepEqual(quickInsertKey(after), quickInsertKey(before));
  assert.deepEqual(after.map((write) => write.key), before.filter((write) => write !== removed[0]).map((write) => write.key));
});

test('literalStyleAssignments returns literal values and ignores computed ones', () => {
  const ast = parse([
    'button.style.opacity = "0.6";',
    'function init() {',
    '  function dim() {',
    '    button.style.opacity = "0.6";',
    '    panel.style.cssText = "display: flex";',
    '    plus.style.opacity = "";',
    '    row.style.zIndex = 2;',
    '    row.style.marginLeft = `6px`;',
    '    note.setAttribute("style", "margin: 0");',
    '    box.style.left = x + "px";',
    '    label.style.display = hide ? "none" : "";',
    '    row.style.marginTop = `${gap}px`;',
    '    clone.setAttribute("style", font + ";");',
    '    clone.setAttribute("class", "uml-pg-x");',
    '    style.opacity = "1";',
    '  }',
    '}',
  ].join('\n'));

  const assignments = literalStyleAssignments(ast, { within: 'init' });

  assert.deepEqual(assignments.map(({ key, site, property, value, target }) => ({ key, site, property, value, target })), [
    { key: 'dim#1', site: 'dim', property: 'opacity', value: '0.6', target: 'button' },
    { key: 'dim#2', site: 'dim', property: 'cssText', value: 'display: flex', target: 'panel' },
    { key: 'dim#3', site: 'dim', property: 'opacity', value: '', target: 'plus' },
    { key: 'dim#4', site: 'dim', property: 'zIndex', value: 2, target: 'row' },
    { key: 'dim#5', site: 'dim', property: 'marginLeft', value: '6px', target: 'row' },
    { key: 'dim#6', site: 'dim', property: 'style', value: 'margin: 0', target: 'note' },
  ]);
  assert.equal(literalStyleAssignments(ast).length, 7, 'without within, the whole script is searched');
});

test('the R0 include\'s literal style assignments in init each name their element and property', () => {
  const { ast } = loadR0Script();

  const assignments = literalStyleAssignments(ast, { within: 'init' });

  assert.equal(new Set(assignments.map((entry) => entry.key)).size, assignments.length, 'every assignment has its own key');
  for (const entry of assignments) {
    const text = R0_LINES[entry.line - 1];
    assert.ok(text.includes(`${entry.target}.`) && (text.includes(`.style.${entry.property}`) || text.includes('setAttribute')),
      `${entry.key} is on line ${entry.line} of the R0 include: ${text.trim()}`);
  }
  assert.ok(assignments.some((entry) => entry.target === 'btn' && entry.property === 'opacity' && entry.value === '0.6'),
    'the dimmed palette button during a palette drag');
  assert.ok(assignments.some((entry) => entry.target === 'plus' && entry.property === 'opacity' && entry.value === '1'),
    'the connect handle\'s plus sign');
});

test('a built page\'s script, its Liquid already rendered, is found and keyed the same way', () => {
  const built = '<html><script>var x = 1;</script>\n<script>\n(function () { function init() { textarea.value = "a"; } })();\n</script></html>';
  const { code, liquid, line } = includeScript(built);
  assert.deepEqual(liquid, []);
  assert.equal(line, 2);
  assert.deepEqual(assignmentsTo(parse(code, { startLine: line }), 'textarea.value').map((write) => [write.key, write.line]), [['init#1', 3]]);
});
