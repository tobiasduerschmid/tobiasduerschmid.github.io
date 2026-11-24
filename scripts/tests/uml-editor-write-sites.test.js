'use strict';

// The write-site map of the UML editor refactor (plan 2026-11-12-c4-uml-view-editing, Task 10;
// spec 2026-11-12 §3.5 and §3.10). Every assignment to textarea.value in the inline script of
// _includes/uml-editor.html has one entry in scripts/tests/fixtures/uml-editor-write-sites.json:
//
//   { key, site, ordinal, becomes, status, gestures, unreached }
//
// - `key`, `site`, `ordinal`: as the source-structure helper keys the write (`<chain>#<ordinal>`),
//   so converting one function never shifts another's key.
// - `becomes`: the operation of spec §3.4 the write turns into, or `setDocument:<reason>` for a
//   document load that stays with the host. A write that one shared rewrite reaches on the way to
//   several operations of its §3.5 row (the member form and the Properties fields both rebuild a
//   class declaration) lists those operations in an array.
// - `status`: `assignment` until a stage R1 task converts the write, then `converted`.
// - `gestures`: the corpus gestures whose run executes the write (UML_CORPUS_MODE=coverage, through
//   tests/uml-editor-corpus/coverage.js), or none, and then `unreached: { reason, ruling }` says why
//   no gesture can reach it; `ruling` is `pending` until the controller rules, then the ruling.
//
// The map follows the live include through stage R1: the tests below fail when a write appears
// without an entry, when a write is converted without its entry saying so, and when an entry says
// converted while the write is still there. The last tests pin how coverage mode decides that a
// gesture executed a write: with V8's own conditional breakpoints on a small page, run as a browser
// runs an inline script.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const inspector = require('node:inspector/promises');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const zlib = require('node:zlib');

const { includeScript, parse, loadIncludeScript, assignmentsTo, walk, functionChainOf, siteOfChain } = require('./helpers/uml-editor-script');
const { loadGestures } = require('../../tests/uml-editor-corpus/gestures');
const { writeSitesOfBuiltPage, startWriteSiteRecording } = require('../../tests/uml-editor-corpus/coverage');

const MAP_FILE = path.join(__dirname, 'fixtures', 'uml-editor-write-sites.json');
// _includes/uml-editor.html as it stood at stage R0, the include the corpus was recorded on.
const R0_INCLUDE_FILE = path.join(__dirname, '..', '..', 'tests', 'uml-editor-corpus', 'r0', 'uml-editor.html.gz');
const WRITE_TARGET = 'textarea.value';
const SET_DOCUMENT = 'setDocument';
// The host's write (spec §3.6) is the one caller that hands setDocument an operation's text.
const HOST_WRITE = 'write';
const WRITE_REASON = 'write';
const UNDO_SNAPSHOT = 'snapshotForUndo';
// The function chains that may take an undo step: the host's write, the typing handler, Reset to the
// starter, and the classic host's service startUndoStep, which the commit of an in-place rename calls
// from the session (plan Task 18: the session has no undo stack of its own).
// Since the merge of origin/master (71fbaeca: "a refused rename leaves undo and redo alone") the service
// takes no step: the rename's own write does.
const UNDO_SNAPSHOT_TAKERS = [HOST_WRITE, 'textarea:input', 'resetCurrentDiagramToStarter'];
const UNDO_STEP_SERVICE = 'startUndoStep';
// Since plan Task 23 the in-place editors are the module's (js/ArchUML/diagram-editor/de-inline.js): the chain is
// the file's, and the scan below reads the module's files beside the include.
const IN_PLACE_RENAME_COMMIT = 'diagram-editor/de-inline.js: createInlineEditors>startInlineRename>commit';
const ARCHUML = path.join(__dirname, '..', '..', 'js', 'ArchUML');
const MODULE_MANIFEST = JSON.parse(fs.readFileSync(path.join(ARCHUML, 'diagram-editor', 'manifest.json'), 'utf8'));
const STATUSES = ['assignment', 'converted'];
const PENDING = 'pending';

// Spec §3.4, the operation vocabulary.
const OPERATIONS = new Set([
  'layout.setMode', 'layout.set', 'layout.reset',
  'element.add', 'element.rename', 'element.update', 'element.duplicate', 'element.reparent',
  'element.remove', 'selection.remove',
  'member.add', 'member.update', 'member.remove',
  'relation.add', 'relation.update', 'relation.rewire', 'relation.invert',
  'lifeline.add', 'lifeline.reorder', 'message.move',
  'fragment.add', 'fragment.update', 'fragment.addBranch', 'fragment.unwrap', 'fragment.move',
  'activation.add', 'activation.set',
  'source.replace', 'source.insertLines', 'source.replaceLines', 'source.removeLines', 'source.moveLines',
  'source.replaceDeclaration',
]);
// Plan Task 10, the reasons of the host's setDocument.
const SET_DOCUMENT_REASONS = new Set(['load', 'snapshot', 'scaffold', 'type-switch', 'reset']);

// Spec §3.5, row by row: the write sites of each row and what their writes may become. The first
// row's seven document loads each have their own reason: the load at start in init's own body, the
// type switch, Undo and Redo, the empty-document scaffold, and Reset to the starter.
const SPEC_ROWS = [
  { sites: ['init'], becomes: ['setDocument:load'] },
  { sites: ['applySnapshot'], becomes: ['setDocument:snapshot'] },
  { sites: ['renderDiagram'], becomes: ['setDocument:scaffold'] },
  { sites: ['typeSelect:change'], becomes: ['setDocument:type-switch'] },
  { sites: ['resetCurrentDiagramToStarter'], becomes: ['setDocument:reset'] },
  {
    sites: ['layoutSelect:change', 'nudgeElement', 'updateDrag', 'resetOneBtn:click', 'resetLayoutBtn:click'],
    becomes: ['layout.setMode', 'layout.set', 'lifeline.reorder', 'layout.reset'],
  },
  {
    sites: ['placeElementAt', 'addElementWithoutCanvas', 'addEmptyElement', 'addClassStarter', 'addStateStarter',
      'addSequenceStarterPair', 'addSequenceParticipant', 'addDeploymentChildIntoNode', 'updateExtendDrag',
      'handleHitboxClickForSequenceElementTool', 'handleHitboxClickForAnchoredNoteTool'],
    becomes: ['element.add', 'lifeline.add', 'fragment.add'],
  },
  {
    sites: ['renameElement', 'renameActivityElement', 'setSequenceLifelineHead', 'updateSequenceParticipant',
      'replaceVirtualNoteText'],
    becomes: ['element.rename'],
  },
  {
    sites: ['replaceClassDeclaration', 'replaceGenericElement', 'replaceCrcCard', 'changeSystemMembership'],
    becomes: ['element.update', 'member.add', 'member.update', 'member.remove'],
  },
  { sites: ['deleteSelected'], becomes: ['selection.remove'] },
  { sites: ['duplicateElement', 'duplicateSelected'], becomes: ['element.duplicate'] },
  {
    sites: ['addSequenceRelationAtLine', 'showRelationChooser', 'connectWithSelectedRelationTool',
      'addSequenceSingleMessage', 'handleHitboxClickForRelation'],
    becomes: ['relation.add'],
  },
  {
    sites: ['replaceRelationLine', 'rewireRelationEndpoint', 'invertRelationDirection'],
    becomes: ['relation.update', 'relation.rewire', 'relation.invert'],
  },
  { sites: ['moveSequenceMessageBlockToLine', 'moveSequenceMessageToBranch'], becomes: ['message.move'] },
  {
    // `commit` is the in-place fragment editor's commit, inside startInlineFragmentEdit.
    sites: ['changeFragmentKind', 'changeFragmentCondition', 'changeFragmentBranchCondition', 'commit',
      'addFragmentElseBranch', 'unwrapFragment', 'moveFragmentBy', 'moveSequenceFragmentToLine', 'commitWrap'],
    becomes: ['fragment.add', 'fragment.update', 'fragment.addBranch', 'fragment.unwrap', 'fragment.move'],
  },
  { sites: ['setActivationBarSlots', 'createActivationBar'], becomes: ['activation.add', 'activation.set'] },
  {
    // `buildSequenceParticipantRow` holds the sequence model panel's participant row and its Delete.
    sites: ['renderChildren', 'renderPorts', 'renderDeploymentChildren', 'buildSequenceParticipantRow'],
    becomes: ['element.remove'],
  },
  { sites: ['replaceLineForElementId'], becomes: ['source.replaceDeclaration'] },
  { sites: ['commitSource'], becomes: ['source.replace'] },
  {
    sites: ['makeQuickInsertButton', 'replaceSequenceLineRange', 'replaceLineModelRow', 'deleteLineModelRow',
      'moveLineModelRow', 'addGitgraphBranchRow', 'addGitgraphCommitRow', 'addLineModelPreset'],
    becomes: ['source.insertLines', 'source.replaceLines', 'source.removeLines', 'source.moveLines'],
  },
];

function readMap() {
  return JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
}

function entriesByKey(map) {
  return new Map(map.map((entry) => [entry.key, entry]));
}

function liveWrites() {
  return assignmentsTo(loadIncludeScript().ast, WRITE_TARGET);
}

function r0Writes() {
  const { code, line } = includeScript(zlib.gunzipSync(fs.readFileSync(R0_INCLUDE_FILE)).toString('utf8'));
  return assignmentsTo(parse(code, { startLine: line }), WRITE_TARGET);
}

/** Every call of setDocument in the live include: the site that makes it and the literal reason it passes. */
function setDocumentCalls() {
  const calls = [];
  walk(loadIncludeScript().ast, (nodePath) => {
    const { node } = nodePath;
    if (node.type !== 'CallExpression' || node.callee.type !== 'Identifier' || node.callee.name !== SET_DOCUMENT) return;
    const options = node.arguments[1];
    const reason = options && options.type === 'ObjectExpression'
      ? options.properties.find((property) => property.key && property.key.name === 'reason')
      : null;
    calls.push({
      site: siteOfChain(functionChainOf(nodePath)),
      reason: reason && reason.value.type === 'StringLiteral' ? reason.value.value : null,
    });
  });
  return calls;
}

function operationsOf(becomes) {
  return Array.isArray(becomes) ? becomes : [becomes];
}

/** What is wrong with an entry's `becomes`, or null. */
function becomesProblem(becomes) {
  if (typeof becomes === 'string' && becomes.startsWith(`${SET_DOCUMENT}:`)) {
    return SET_DOCUMENT_REASONS.has(becomes.slice(SET_DOCUMENT.length + 1)) ? null : 'an unknown setDocument reason';
  }
  if (typeof becomes === 'string') return OPERATIONS.has(becomes) ? null : 'no operation of spec §3.4';
  if (!Array.isArray(becomes) || becomes.length < 2) return 'neither a string nor a list of two or more operations';
  if (new Set(becomes).size !== becomes.length) return 'an operation listed twice';
  return becomes.every((operation) => OPERATIONS.has(operation)) ? null : 'a list holding something other than operations of spec §3.4';
}

/** What is wrong with an entry's `gestures` and `unreached`, or null. */
function reachProblem(entry, gestureIds) {
  if (!Array.isArray(entry.gestures)) return 'gestures is not a list';
  if (new Set(entry.gestures).size !== entry.gestures.length) return 'a gesture is listed twice';
  const unknown = entry.gestures.filter((id) => !gestureIds.has(id));
  if (unknown.length) return `gestures the corpus does not have: ${unknown.join(', ')}`;
  if (entry.gestures.length) return entry.unreached === null ? null : 'gestures reach it, yet it says unreached';
  const { unreached } = entry;
  if (!unreached || typeof unreached.reason !== 'string' || !unreached.reason.trim()) return 'no gesture reaches it and no reason says why';
  if (typeof unreached.ruling !== 'string' || !unreached.ruling.trim()) return `its ruling is neither "${PENDING}" nor the ruling's words`;
  return null;
}

// ---------- the map and the include ----------

test('the map has one entry for each of the 103 write sites of stage R0, with its site and ordinal', () => {
  const map = readMap();
  const writes = r0Writes();

  assert.equal(writes.length, 103);
  assert.deepEqual(map.map((entry) => entry.key).sort(), writes.map((write) => write.key).sort(), 'one entry per R0 write, under its key');
  const byKey = entriesByKey(map);
  for (const write of writes) {
    const entry = byKey.get(write.key);
    assert.deepEqual({ site: entry.site, ordinal: entry.ordinal }, { site: write.site, ordinal: write.ordinal }, write.key);
  }
});

test('every assignment to textarea.value outside setDocument has a map entry under its key', () => {
  const byKey = entriesByKey(readMap());

  const writes = liveWrites().filter((write) => write.site !== SET_DOCUMENT);

  const missing = writes.filter((write) => !byKey.has(write.key)).map((write) => `${write.key} (line ${write.line})`);
  assert.deepEqual(missing, [], 'writes of the live include without a map entry');
});

test('no entry marked converted still assigns the textarea', () => {
  const liveKeys = new Set(liveWrites().map((write) => write.key));

  const stillWriting = readMap().filter((entry) => entry.status === 'converted' && liveKeys.has(entry.key));

  assert.deepEqual(stillWriting.map((entry) => entry.key), [], 'converted entries whose write is still in the include');
});

test('every entry still marked as an assignment is a write of the live include', () => {
  const liveKeys = new Set(liveWrites().map((write) => write.key));

  const gone = readMap().filter((entry) => entry.status === 'assignment' && !liveKeys.has(entry.key));

  assert.deepEqual(gone.map((entry) => entry.key), [],
    'entries whose write is gone from the include: mark them converted (or a conversion shifted another key)');
});

// Stage R1 ends with one writer (spec §3.10): every write site of the map is converted, and the
// host's setDocument holds the one assignment to the textarea that is left.
test('the include assigns the textarea exactly once, in setDocument', () => {
  const writes = liveWrites();

  assert.deepEqual(writes.map((write) => write.key), [`${SET_DOCUMENT}#1`], 'the assignments to textarea.value left in the include');
});

// Spec §3.10, R1: commands take no undo step for themselves. The host's write takes one for each
// operation that changes the document, and the typing handler for typed text. Reset to the starter, a
// document load of the host (spec §3.5, first row) that stays undoable, keeps its own step. The commit of
// an in-place rename still asks for one (host.startUndoStep), but since the merge of origin/master
// (71fbaeca) the service takes none: a rename that is refused or changes nothing leaves undo and redo
// as they were (tests/uml-editor-robustness.spec.js), where at stage R0 it left one Undo.
test('only the host\'s write, the typing handler, and Reset to the starter take an undo snapshot', () => {
  const sites = [];
  walk(loadIncludeScript().ast, (nodePath) => {
    const { node } = nodePath;
    if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === UNDO_SNAPSHOT) {
      sites.push(functionChainOf(nodePath));
    }
  });

  assert.deepEqual([...new Set(sites)].sort(), [...UNDO_SNAPSHOT_TAKERS].sort(), 'the functions that call snapshotForUndo');
});

test('the commit of an in-place rename, and nothing else in the session, asks the host for an undo step of its own', () => {
  const askers = [];
  const scan = (ast, where) => walk(ast, (nodePath) => {
    const { node } = nodePath;
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && !node.callee.computed
      && node.callee.object.type === 'Identifier' && node.callee.object.name === 'host'
      && node.callee.property.name === UNDO_STEP_SERVICE) askers.push(where + functionChainOf(nodePath));
  });
  scan(loadIncludeScript().ast, '');
  MODULE_MANIFEST.core.forEach((file) => scan(parse(fs.readFileSync(path.join(ARCHUML, file), 'utf8')), `${file}: `));

  assert.deepEqual(askers, [IN_PLACE_RENAME_COMMIT], 'the session functions that call host.startUndoStep');
});

test('each converted document load hands its text to setDocument with the reason its entry names, and only the host\'s write passes "write"', () => {
  const converted = readMap().filter((entry) => entry.status === 'converted' && String(entry.becomes).startsWith(`${SET_DOCUMENT}:`));

  const calls = setDocumentCalls();

  const loads = calls.filter((call) => call.reason !== WRITE_REASON).map((call) => `${call.site} → ${call.reason}`).sort();
  const expected = converted.map((entry) => `${entry.site} → ${entry.becomes.slice(SET_DOCUMENT.length + 1)}`).sort();
  assert.deepEqual(loads, expected, 'setDocument calls of the document loads, by site and reason');
  const writers = [...new Set(calls.filter((call) => call.reason === WRITE_REASON).map((call) => call.site))];
  assert.deepEqual(writers, [HOST_WRITE], 'the sites that hand setDocument an operation\'s text');
});

// ---------- what each entry says ----------

test('every entry names an operation or a setDocument reason, and the gestures that reach it or the reason none can, with its ruling', () => {
  const gestureIds = new Set(loadGestures().map((gesture) => gesture.id));

  const problems = readMap().flatMap((entry) => {
    const found = [becomesProblem(entry.becomes), reachProblem(entry, gestureIds)];
    if (!STATUSES.includes(entry.status)) found.push(`status "${entry.status}" is not one of ${STATUSES.join(', ')}`);
    return found.filter(Boolean).map((problem) => `${entry.key}: ${problem}`);
  });

  assert.deepEqual(problems, []);
});

// Plan Task 10 Step 4 and Task 11 Step 0: the controller rules on every unreached site before the
// first site is converted, so no conversion goes ahead on a site nobody has looked at.
test('no unreached entry has a pending ruling', () => {
  const pending = readMap().filter((entry) => entry.unreached && entry.unreached.ruling === PENDING);

  assert.deepEqual(pending.map((entry) => entry.key), [], 'unreached write sites still waiting for the controller\'s ruling');
});

test('each write becomes what its row of spec §3.5 allows: a document load its setDocument reason, any other write an operation of its row', () => {
  const rowOfSite = new Map(SPEC_ROWS.flatMap((row) => row.sites.map((site) => [site, row])));
  const map = readMap();

  const problems = map.flatMap((entry) => {
    const row = rowOfSite.get(entry.site);
    if (!row) return [`${entry.key}: ${entry.site} is in no row of spec §3.5`];
    const outside = operationsOf(entry.becomes).filter((operation) => !row.becomes.includes(operation));
    return outside.length ? [`${entry.key}: ${outside.join(', ')} is not among ${row.becomes.join(', ')}`] : [];
  });

  assert.deepEqual(problems, []);
  assert.equal(map.filter((entry) => String(entry.becomes).startsWith(`${SET_DOCUMENT}:`)).length, 7,
    'seven document loads stay with the host; the other 96 writes become operations');
});

// ---------- how coverage mode decides that a write ran ----------

const PROBE_PAGE = [
  '<html><script>var analytics = true;</script>',
  '<script>',
  '(function () {',
  '  function init() {',
  '    var textarea = { value: "" };',
  '    function taken() { textarea.value = "taken"; }',
  '    function skipped() { textarea.value = "skipped"; }',
  '    function branch(on) { if (on) { textarea.value = "then"; } else { textarea.value = "else"; } }',
  '    function braceless(on) { if (on) textarea.value = "braceless"; }',
  '    var editor = { commitSource: function () { textarea.value = "never"; } };',
  '    globalThis.writeSitesProbeListeners = [skipped];',
  '    taken();',
  '    branch(globalThis.writeSitesProbeFlag);',
  '    braceless(globalThis.writeSitesProbeFlag);',
  '  }',
  '  init();',
  '})();',
  '</script></html>',
].join('\n');

// V8 never makes a function that nothing refers to, so it cannot break inside one: it breaks at the
// next statement it can, here in `other`, whose runs would pass for the write's.
const UNREFERENCED_FUNCTION_PAGE = [
  '<script>',
  '(function () {',
  '  function init() {',
  '    var textarea = { value: "" };',
  '    function nowhere() { textarea.value = "nowhere"; }',
  '    function other() { var y = 1; }',
  '    other();',
  '  }',
  '  init();',
  '})();',
  '</script>',
].join('\n');

// The shape V8 block coverage miscounted (fix round 1): a function returns early from an `if`, and a
// logical or conditional expression lies between that `if` and the write.
const EARLY_RETURN_PAGE = [
  '<script>',
  '(function () {',
  '  function init() {',
  '    var textarea = { value: "" };',
  '    var g = {};',
  '    function afterOr(stop) { if (stop) { return; } var y = (g.a || [""])[0]; textarea.value = "or"; }',
  '    function afterAnd(stop) { if (stop) { return; } var y = g.a && g.b; textarea.value = "and"; }',
  '    function afterNullish(stop) { if (stop) { return; } var y = g.a ?? 1; textarea.value = "nullish"; }',
  '    function afterConditional(stop) { if (stop) { return; } var y = g.a ? 1 : 2; textarea.value = "conditional"; }',
  '    var stop = globalThis.writeSitesProbeFlag;',
  '    afterOr(stop); afterAnd(stop); afterNullish(stop); afterConditional(stop);',
  '  }',
  '  init();',
  '})();',
  '</script>',
].join('\n');

let probeRecordings = 0;

/** A DevTools session of this process's own V8, shaped as Playwright's CDPSession is (send, on, off). */
function devToolsOf(session) {
  const forwarders = new Map();
  return {
    send: (method, params) => session.post(method, params),
    on(event, listener) {
      const forwarder = (message) => listener(message.params);
      forwarders.set(listener, forwarder);
      session.on(event, forwarder);
    },
    off(event, listener) {
      session.off(event, forwarders.get(listener));
    },
  };
}

/** Runs the editor script of `page` as a browser runs an inline script: under the page's URL, in the page's lines. */
function loadEditorScript(page, url, flag) {
  const { code } = includeScript(page);
  const linesBefore = page.slice(0, page.indexOf(code)).split('\n');
  globalThis.writeSitesProbeFlag = flag;
  vm.runInThisContext(code, { filename: url, lineOffset: linesBefore.length - 1, columnOffset: linesBefore.at(-1).length });
}

/**
 * Records one page while its editor script is loaded once per flag; resolves to what stop() gives.
 * Every recording has a URL of its own, so its breakpoints meet no script an earlier test compiled.
 */
async function recordLoads(page, flags, sites = writeSitesOfBuiltPage(page)) {
  probeRecordings += 1;
  const url = `https://write-sites.test/probe-${probeRecordings}`;
  const session = new inspector.Session();
  session.connect();
  try {
    const recording = await startWriteSiteRecording(devToolsOf(session), { url, sites });
    for (const flag of flags) loadEditorScript(page, url, flag);
    return await recording.stop();
  } finally {
    delete globalThis.writeSitesProbeFlag;
    delete globalThis.writeSitesProbeListeners;
    session.disconnect();
  }
}

/** The text a refused run gives for a breakpoint that took off its write (1-based, as the message counts). */
function placedOffItsWrite(site) {
  return new RegExp(`${site.key}: its breakpoint took at line \\d+, column \\d+, not at its write at line ${site.lineNumber + 1}, column ${site.columnNumber + 1}`);
}

test('a write counts as run only when its statement ran: a called function and the branches taken, not a listener never called, a branch not taken, or an uncalled property function', async () => {
  const keys = writeSitesOfBuiltPage(PROBE_PAGE).map((site) => site.key);

  const ran = await recordLoads(PROBE_PAGE, [true]);

  assert.deepEqual(keys, ['taken#1', 'skipped#1', 'branch#1', 'branch#2', 'braceless#1', 'commitSource#1'], 'the probe page has six writes');
  assert.deepEqual(ran, ['taken#1', 'branch#1', 'braceless#1']);
});

test('a write after an early return counts as run only when the return was not taken, whatever expression lies between them', async () => {
  const afterEveryReturn = await recordLoads(EARLY_RETURN_PAGE, [true]);
  const withoutReturns = await recordLoads(EARLY_RETURN_PAGE, [false]);

  assert.deepEqual(afterEveryReturn, [], 'each function returned before its write');
  assert.deepEqual(withoutReturns, ['afterOr#1', 'afterAnd#1', 'afterNullish#1', 'afterConditional#1']);
});

test('a page loaded twice adds what its second load ran', async () => {
  const ran = await recordLoads(PROBE_PAGE, [true, false]);

  assert.deepEqual(ran, ['taken#1', 'branch#1', 'branch#2', 'braceless#1']);
});

test('a run is refused when the page\'s editor script never loaded, or when a breakpoint took anywhere but at its write', async () => {
  const offTheWrites = writeSitesOfBuiltPage(PROBE_PAGE).map((site) => ({ ...site, columnNumber: site.columnNumber + 3 }));
  const [inNowhere] = writeSitesOfBuiltPage(UNREFERENCED_FUNCTION_PAGE);
  const pageLines = PROBE_PAGE.split('\n').length;
  const pastTheScript = [...writeSitesOfBuiltPage(PROBE_PAGE), { key: 'pastTheScript#1', lineNumber: pageLines + 5, columnNumber: 0 }];

  await assert.rejects(recordLoads(PROBE_PAGE, []), /the page's editor script never loaded at https:\/\/write-sites\.test\//);
  await assert.rejects(recordLoads(PROBE_PAGE, [true], offTheWrites), placedOffItsWrite(offTheWrites[0]));
  await assert.rejects(recordLoads(UNREFERENCED_FUNCTION_PAGE, [true]), placedOffItsWrite(inNowhere));
  await assert.rejects(recordLoads(PROBE_PAGE, [true], pastTheScript), /breakpoints that never took: pastTheScript#1$/);
});

test('a page with a line break other than "\\n" before its editor script ends is refused, since V8 would number its lines apart', () => {
  const carriageReturn = PROBE_PAGE.replace('\n', '\r');

  assert.throws(() => writeSitesOfBuiltPage(carriageReturn), /a line break other than "\\n"/);
});
