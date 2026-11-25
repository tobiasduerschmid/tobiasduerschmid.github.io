'use strict';

// Which scope of the UML editor may read what (plan 2026-11-12-c4-uml-view-editing, Tasks 11, 17-21;
// spec 2026-11-12 §3.3, §3.6). Since plan Task 21 the text adapter is files of the diagram editor
// module: the `text` group of js/ArchUML/diagram-editor/manifest.json (js/ArchUML/diagram-editor/text/)
// and de-operations.js, which holds revisionOf and the verdicts. A rewrite reads only its arguments
// (the text, the diagram type, the operation, and the bundle's parsers), so a logged operation
// replays outside the page (spec §3.6, requirement 4). The tests below take the text adapter's files
// out of the page that way and apply operations to it (plan Task 13, fix round 1, and Task 14's
// relations); scripts/tests/uml-editor-replay.test.js replays the corpus's logged operations.
// Since plan Task 23 the session is made of parts in files of the module (PARTS below): the view, the
// commands, the gestures, the menus, and the in-place editors. The family rules read a part's factory
// where spec §3.3 makes the part the owner. Since plan Task 24 the session itself is a file of the
// module too (de-mount.js, which ArchUMLDiagramEditor.mount runs), and so is the classic surface with
// its pointer driver (de-surface-classic.js): the include keeps only the host, init, which mounts them.
// A file of the module reaches the other parts through its UMD `root` parameter, never through the
// global ArchUMLDiagramEditorParts.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const babelParser = require('@babel/parser');
const { loadIncludeScript, parse, walk, literalStyleAssignments } = require('./helpers/uml-editor-script');

// What a rewrite must not read: the page, its storage and clock, and the editor's own controls.
const FORBIDDEN = new Set(['document', 'window', 'localStorage', 'navigator', 'Date', 'setTimeout',
  'requestIdleCallback', 'textarea', 'typeSelect']);
const ARCHUML = path.join(__dirname, '..', '..', 'js', 'ArchUML');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ARCHUML, 'diagram-editor', 'manifest.json'), 'utf8'));
// The text adapter's files: the text group, and the vocabulary file whose revisionOf and verdicts it uses.
const TEXT_ADAPTER_FILES = ['diagram-editor/de-operations.js', ...MANIFEST.text];
const SKIPPED_KEYS = new Set(['loc', 'start', 'end', 'extra', 'leadingComments', 'trailingComments', 'innerComments']);

/** The statements of the function the script's one IIFE runs: the script's own top level. */
function topLevelStatements(ast) {
  const [statement] = ast.program.body;
  const call = statement && statement.type === 'ExpressionStatement' ? statement.expression : null;
  assert.ok(call && call.type === 'CallExpression' && call.callee.type === 'FunctionExpression',
    'the editor script is one immediately invoked function');
  return call.callee.body.body;
}

/**
 * Every binding of the script's top level, by name: `{ node, statement }`, its function declaration
 * or its variable's initializer, and the top-level statement that declares it.
 */
function topLevelBindings(ast) {
  const bindings = new Map();
  for (const statement of topLevelStatements(ast)) {
    if (statement.type === 'FunctionDeclaration') bindings.set(statement.id.name, { node: statement, statement });
    if (statement.type === 'VariableDeclaration') {
      for (const declarator of statement.declarations) {
        if (declarator.id.type === 'Identifier') bindings.set(declarator.id.name, { node: declarator.init, statement });
      }
    }
  }
  return bindings;
}

/** The identifiers a node reads, with their lines; a property name after a dot or before a colon is no read. */
function identifiersRead(node) {
  const reads = [];
  walk(node, (nodePath) => {
    if (nodePath.node.type !== 'Identifier') return;
    const parent = nodePath.parent && nodePath.parent.node;
    const isPropertyName = parent && !parent.computed
      && ((parent.type === 'MemberExpression' && nodePath.key === 'property')
        || ((parent.type === 'ObjectProperty' || parent.type === 'ObjectMethod') && nodePath.key === 'key'));
    if (!isPropertyName) reads.push({ name: nodePath.node.name, line: nodePath.node.loc.start.line });
  });
  return reads;
}

test('the text adapter reads no DOM, clock, or global', () => {
  const reads = TEXT_ADAPTER_FILES.flatMap((file) => identifiersRead(parse(fs.readFileSync(path.join(ARCHUML, file), 'utf8')))
    .filter((read) => FORBIDDEN.has(read.name))
    .map((read) => `${file} reads ${read.name} (line ${read.line})`));

  assert.ok(MANIFEST.text.length > 0, 'the manifest lists the text adapter\'s files');
  assert.deepEqual(reads, [], 'reads of the page, its storage, its clock, or the editor\'s controls inside the text adapter');
});

// ---------- the text adapter outside the page ----------
//
// Since it reads nothing else, the text adapter runs outside the page: its files, in manifest order,
// in a fresh context that holds the bundle. There `apply` meets operations no classic command builds,
// and decides for itself (spec §3.4): it writes the change exactly once, or refuses with a code and
// writes nothing.

/** The text adapter in a fresh context with the bundle: `{ createTextAdapter, revisionOf, bundle }`. */
function textAdapterOutsideThePage() {
  // When it loads, the bundle looks for a page to draw on later; these stubs let it load.
  const context = { document: { readyState: 'loading', addEventListener() {}, documentElement: {} }, MutationObserver: class { observe() {} } };
  context.window = context;
  vm.createContext(context);
  for (const file of ['uml-bundle.js', ...MANIFEST.core, ...MANIFEST.text]) {
    vm.runInContext(fs.readFileSync(path.join(ARCHUML, file), 'utf8'), context, { filename: file });
  }
  const parts = context.ArchUMLDiagramEditorParts;
  return { createTextAdapter: parts.text.createTextAdapter, revisionOf: parts.operations.revisionOf, bundle: context };
}

let adapterOutsideThePage = null;

/**
 * Applies the operation `op` with `fields` to the document `text` of diagram type `type`, as a command
 * builds it: the text's revision, the scene facts `facts` (none by default), and the undo `undo` (no
 * key by default). Returns the verdict, every text the adapter wrote, and what it told the host's
 * write about each (`infos`).
 */
function applyOutsideThePage(type, text, op, fields, { facts = {}, undo = { key: null } } = {}) {
  adapterOutsideThePage = adapterOutsideThePage || textAdapterOutsideThePage();
  const { createTextAdapter, revisionOf, bundle } = adapterOutsideThePage;
  const writes = [];
  const infos = [];
  const write = (written, info) => { writes.push(written); infos.push(info); };
  const adapter = createTextAdapter({ read: () => text, type: () => type, bundle, write });
  const verdict = adapter.apply({ op, revision: revisionOf(text), ...fields, facts, undo });
  return { verdict, writes, infos };
}

const ORDERS = ['@startuml', 'class Order { -id: int }', 'class Customer', 'Order --> Customer', '@enduml'].join('\n');
// The class Order as the Properties pane's class form holds it once "abstract" is checked.
const ABSTRACT_ORDER = {
  kind: 'abstract', isAbstract: true, name: 'Order', stereotype: '', highlight: '', texture: '', rawAfter: '',
  members: [{ visibility: '-', isAbstract: false, isStatic: false, text: 'id: int' }],
};

for (const [what, part] of [['without a part', {}], ['with an empty part', { part: null }]]) {
  test(`an element.rename ${what} renames the element's identifier and the relations that name it`, () => {
    const { verdict, writes } = applyOutsideThePage('class', ORDERS, 'element.rename', { ref: 'Order', text: 'Purchase', ...part });

    assert.equal(verdict.ok, true, `refused with ${verdict.code}`);
    assert.equal(verdict.select.id, 'Purchase', 'the renamed class is selected');
    assert.deepEqual(writes, [ORDERS.replace(/Order/g, 'Purchase')]);
  });
}

for (const [what, part] of [['a rename it does not know', 'label'], ['a name every object inherits', 'toString']]) {
  test(`an element.rename whose part names ${what} is refused with rename/part and writes nothing`, () => {
    const { verdict, writes } = applyOutsideThePage('class', ORDERS, 'element.rename', { ref: 'Order', text: 'Purchase', part });

    assert.equal(verdict.ok, false);
    assert.equal(verdict.code, 'rename/part');
    assert.deepEqual(writes, []);
  });
}

test('an element.update whose change is a classDeclaration rebuilds the class from it', () => {
  const { verdict, writes } = applyOutsideThePage('class', ORDERS, 'element.update',
    { ref: 'Order', changes: { classDeclaration: ABSTRACT_ORDER } });

  assert.equal(verdict.ok, true, `refused with ${verdict.code}`);
  assert.deepEqual(writes, [ORDERS.replace('class Order { -id: int }', 'abstract class Order { - id: int }')]);
});

test('an element.update whose change is a declaration rebuilds the element from its palette tool and the form\'s fields', () => {
  const components = ['@startuml', 'component Api', 'component Db', 'Api --> Db', '@enduml'].join('\n');
  const dashedApi = { tool: 'component', name: 'Api', label: 'Api', stereotype: '', highlight: '', texture: '', dashed: true };

  const { verdict, writes } = applyOutsideThePage('component', components, 'element.update', { ref: 'Api', changes: { declaration: dashedApi } });

  assert.equal(verdict.ok, true, `refused with ${verdict.code}`);
  assert.deepEqual(writes, [components.replace('component Api', 'component Api dashed')]);
});

for (const [what, changes] of [
  ['no change', {}],
  ['a change it does not read', { stereotype: '<<entity>>' }],
  ['two changes', { classDeclaration: ABSTRACT_ORDER, card: { id: 'Order', name: 'Order', responsibilities: [], collaborators: [] } }],
]) {
  test(`an element.update whose changes name ${what} is refused with update/changes and writes nothing`, () => {
    const { verdict, writes } = applyOutsideThePage('class', ORDERS, 'element.update', { ref: 'Order', changes });

    assert.equal(verdict.ok, false);
    assert.equal(verdict.code, 'update/changes');
    assert.deepEqual(writes, []);
  });
}

// ---------- relations (plan Task 14) ----------

const ORDER_LINES = ['@startuml', 'class Order', 'class Customer', 'class Item', 'Order "1" --> "*" Customer', '@enduml'];
const ORDER_RELATIONS = ORDER_LINES.join('\n');
// The reference of the drawn line `Order --> Customer`, resolved on the drawing.
const ORDER_TO_CUSTOMER = { routeId: 'rel:4', line: 4, candidates: [4] };
// That relation as the Properties form holds it.
const ORDER_TO_CUSTOMER_IN_THE_FORM = {
  kind: 'assoc', source: 'Order', target: 'Customer', label: '', sourceMult: '1', targetMult: '*',
  navigability: '', stereotype: '', dashed: false,
};
const withLine = (lines, index, line) => lines.map((text, at) => (at === index ? line : text)).join('\n');
// A verdict comes from the adapter's own context, so a selection is compared as a plain object of this one.

test('a relation.add of a class tool adds its line before @enduml and selects the newest relation line', () => {
  const { verdict, writes } = applyOutsideThePage('class', ORDER_RELATIONS, 'relation.add',
    { tool: 'depend', from: 'Customer', to: 'Item', label: null });

  assert.equal(verdict.ok, true, `refused with ${verdict.code}`);
  assert.deepEqual({ ...verdict.select }, { sourceLine: 5, kind: 'route' });
  assert.deepEqual(writes, [[...ORDER_LINES.slice(0, 5), 'Customer ..> Item', '@enduml'].join('\n')]);
});

test('a relation.add whose tool the diagram type does not offer is refused with relation/tool and writes nothing', () => {
  const { verdict, writes } = applyOutsideThePage('class', ORDER_RELATIONS, 'relation.add',
    { tool: 'transition', from: 'Customer', to: 'Item', label: null });

  assert.equal(verdict.ok, false);
  assert.equal(verdict.code, 'relation/tool');
  assert.deepEqual(writes, []);
});

test('a relation.add of a message placed before a line goes there in the framed document and is selected', () => {
  const unframed = 'Alice -> Bob : hello()\nBob --> Alice : ok';

  const { verdict, writes } = applyOutsideThePage('sequence', unframed, 'relation.add',
    { tool: 'async', from: 'Bob', to: 'Alice', label: null }, { facts: { at: { beforeLine: 2 } } });

  assert.equal(verdict.ok, true, `refused with ${verdict.code}`);
  assert.deepEqual({ ...verdict.select }, { id: 'seqmsg:2', kind: 'route' });
  assert.deepEqual(writes, ['@startuml\nAlice -> Bob : hello()\nBob ->> Alice : event()\nBob --> Alice : ok\n@enduml']);
});

test('a relation.add whose undo joins the step before it asks the host for no undo step of its own', () => {
  const joined = applyOutsideThePage('class', ORDER_RELATIONS, 'relation.add',
    { tool: 'depend', from: 'Customer', to: 'Item', label: null }, { undo: { key: null, joinsPrevious: true } });
  const own = applyOutsideThePage('class', ORDER_RELATIONS, 'relation.add',
    { tool: 'depend', from: 'Customer', to: 'Item', label: null });

  assert.equal(joined.infos[0].joinsPrevious, true);
  assert.equal(own.infos[0].joinsPrevious, false);
});

test('a relation.update rebuilds the referenced line from the relation as the form holds it', () => {
  const labelled = { ...ORDER_TO_CUSTOMER_IN_THE_FORM, label: 'places' };

  const { verdict, writes } = applyOutsideThePage('class', ORDER_RELATIONS, 'relation.update',
    { ref: ORDER_TO_CUSTOMER, changes: { relation: labelled } });

  assert.equal(verdict.ok, true, `refused with ${verdict.code}`);
  assert.deepEqual(writes, [withLine(ORDER_LINES, 4, 'Order "1" --> "*" Customer : places')]);
});

test('a relation.update whose reference matches no one line is refused with relation/unmatched and writes nothing', () => {
  const { verdict, writes } = applyOutsideThePage('class', ORDER_RELATIONS, 'relation.update',
    { ref: { routeId: 'edge-7', line: -1, candidates: [] }, changes: { relation: ORDER_TO_CUSTOMER_IN_THE_FORM } });

  assert.equal(verdict.ok, false);
  assert.equal(verdict.code, 'relation/unmatched');
  assert.deepEqual(writes, []);
});

test('a relation.rewire moves the end it names, keeps the other end and the multiplicities, and selects the line', () => {
  const { verdict, writes } = applyOutsideThePage('class', ORDER_RELATIONS, 'relation.rewire',
    { ref: ORDER_TO_CUSTOMER, end: 'target', to: 'Item', relation: ORDER_TO_CUSTOMER_IN_THE_FORM });

  assert.equal(verdict.ok, true, `refused with ${verdict.code}`);
  assert.deepEqual({ ...verdict.select }, { id: 'rel:4', kind: 'route' });
  assert.deepEqual(writes, [withLine(ORDER_LINES, 4, 'Order "1" --> "*" Item')]);
});

test('a relation.rewire to the end it already has is refused with relation/unchanged and writes nothing', () => {
  const { verdict, writes } = applyOutsideThePage('class', ORDER_RELATIONS, 'relation.rewire',
    { ref: ORDER_TO_CUSTOMER, end: 'source', to: 'Order', relation: ORDER_TO_CUSTOMER_IN_THE_FORM });

  assert.equal(verdict.ok, false);
  assert.equal(verdict.code, 'relation/unchanged');
  assert.deepEqual(writes, []);
});

test('a relation.invert swaps the ends and the multiplicities of the referenced line', () => {
  const { verdict, writes } = applyOutsideThePage('class', ORDER_RELATIONS, 'relation.invert', { ref: ORDER_TO_CUSTOMER });

  assert.equal(verdict.ok, true, `refused with ${verdict.code}`);
  assert.deepEqual({ ...verdict.select }, { id: 'rel:4', kind: 'route' });
  assert.deepEqual(writes, [withLine(ORDER_LINES, 4, 'Customer "*" --> "1" Order')]);
});

test('a relation.invert whose reference matches no one line is refused with relation/unmatched and writes nothing', () => {
  const { verdict, writes } = applyOutsideThePage('class', ORDER_RELATIONS, 'relation.invert',
    { ref: { routeId: 'edge-7', line: -1, candidates: [] } });

  assert.equal(verdict.ok, false);
  assert.equal(verdict.code, 'relation/unmatched');
  assert.deepEqual(writes, []);
});

// ---------- the sequence family (plan Task 15) ----------

// `alt` opens on line 4 (`frag:4`), its `else` is line 6, its `end` line 8; messages on lines 3, 5, 7, and 9.
const ALT_LINES = ['@startuml', 'actor user', 'participant app',
  'user -> app: login', 'alt [valid]', '  app --> user: token', 'else [invalid]', '  app --> user: error', 'end',
  'user -> app: logout', '@enduml'];
const ALT = ALT_LINES.join('\n');
const LOGOUT = { routeId: 'seqmsg:9', line: 9, candidates: [9] };
// Messages on lines 4 to 7; one bar on app from line 4 to its `deactivate` on line 6 in ACTIVATION_LINES.
const THREE_LINES = ['@startuml', 'actor user', 'participant app', 'participant db',
  'user -> app: login', 'app -> db: query', 'db --> app: rows', 'app --> user: ok', '@enduml'];
const ACTIVATION_LINES = ['@startuml', 'actor user', 'participant app',
  'user -> app: login', 'activate app', 'app --> user: token', 'deactivate app', 'user -> app: logout', 'app --> user: bye', '@enduml'];
const APP_BAR = { id: 'actbar:4', startLine: 4, endLine: 6 };
const linesOf = (lines, ...indices) => indices.map((index) => (typeof index === 'number' ? lines[index] : index)).join('\n');

test('a message.move puts the referenced message before the line `at` names and selects it there', () => {
  const { verdict, writes } = applyOutsideThePage('sequence', ALT, 'message.move', { ref: LOGOUT, at: { beforeLine: 3 } });

  assert.equal(verdict.ok, true, `refused with ${verdict.code}`);
  assert.deepEqual({ ...verdict.select }, { id: 'seqmsg:3', kind: 'route' });
  assert.deepEqual(writes, [linesOf(ALT_LINES, 0, 1, 2, 9, 3, 4, 5, 6, 7, 8, 10)]);
});

for (const beforeLine of [9, 10]) {
  test(`a message.move to line ${beforeLine}, where the message already is, is refused with message/unmoved and writes nothing`, () => {
    const { verdict, writes } = applyOutsideThePage('sequence', ALT, 'message.move', { ref: LOGOUT, at: { beforeLine } });

    assert.equal(verdict.ok, false);
    assert.equal(verdict.code, 'message/unmoved');
    assert.deepEqual(writes, []);
  });
}

test('a fragment.update with an operator changes the fragment\'s kind and keeps its guard', () => {
  const { verdict, writes } = applyOutsideThePage('sequence', ALT, 'fragment.update', { ref: 'frag:4', operator: 'opt', guard: null });

  assert.equal(verdict.ok, true, `refused with ${verdict.code}`);
  assert.deepEqual(writes, [withLine(ALT_LINES, 4, 'opt [valid]')]);
});

test('a fragment.update of a branch\'s guard rewrites that branch\'s else line only', () => {
  const { verdict, writes } = applyOutsideThePage('sequence', ALT, 'fragment.update',
    { ref: 'frag:4', operator: null, guard: { branch: 6, text: 'locked out' } });

  assert.equal(verdict.ok, true, `refused with ${verdict.code}`);
  assert.deepEqual(writes, [withLine(ALT_LINES, 6, 'else [locked out]')]);
});

for (const [what, fields, code] of [
  ['an operator that is no fragment kind', { ref: 'frag:4', operator: 'while', guard: null }, 'fragment/operator'],
  ['a fragment the document does not hold', { ref: 'frag:3', operator: 'opt', guard: null }, 'fragment/unmatched'],
]) {
  test(`a fragment.update with ${what} is refused with ${code} and writes nothing`, () => {
    const { verdict, writes } = applyOutsideThePage('sequence', ALT, 'fragment.update', fields);

    assert.equal(verdict.ok, false);
    assert.equal(verdict.code, code);
    assert.deepEqual(writes, []);
  });
}

test('a fragment.addBranch adds an else line before the fragment\'s end', () => {
  const { verdict, writes } = applyOutsideThePage('sequence', ALT, 'fragment.addBranch', { ref: 'frag:4', guard: { text: 'timeout' } });

  assert.equal(verdict.ok, true, `refused with ${verdict.code}`);
  assert.deepEqual(writes, [linesOf(ALT_LINES, 0, 1, 2, 3, 4, 5, 6, 7, 'else [timeout]', 8, 9, 10)]);
});

test('a fragment.unwrap keeps the inner messages one indent shallower and clears the selection', () => {
  const { verdict, writes } = applyOutsideThePage('sequence', ALT, 'fragment.unwrap', { ref: 'frag:4' });

  assert.equal(verdict.ok, true, `refused with ${verdict.code}`);
  assert.equal(verdict.select, null);
  assert.deepEqual(writes, [linesOf(ALT_LINES, 0, 1, 2, 3, 'app --> user: token', 'app --> user: error', 9, 10)]);
});

for (const [step, order, selected] of [
  [-1, [0, 1, 2, 4, 5, 6, 7, 8, 3, 9, 10], 'frag:3'],
  [1, [0, 1, 2, 3, 9, 4, 5, 6, 7, 8, 10], 'frag:5'],
]) {
  test(`a fragment.move by step ${step} swaps the fragment with its ${step < 0 ? 'previous' : 'next'} sibling and selects it`, () => {
    const { verdict, writes } = applyOutsideThePage('sequence', ALT, 'fragment.move', { ref: 'frag:4', at: { step } });

    assert.equal(verdict.ok, true, `refused with ${verdict.code}`);
    assert.deepEqual({ ...verdict.select }, { id: selected, kind: 'fragment' });
    assert.deepEqual(writes, [linesOf(ALT_LINES, ...order)]);
  });
}

test('a fragment.move one step later from the end of the document is refused with fragment/last and says so', () => {
  const lastFragment = linesOf(ALT_LINES, 0, 1, 2, 3, 4, 5, 6, 7, 8, 10);

  const { verdict, writes } = applyOutsideThePage('sequence', lastFragment, 'fragment.move', { ref: 'frag:4', at: { step: 1 } });

  assert.equal(verdict.ok, false);
  assert.equal(verdict.code, 'fragment/last');
  assert.equal(verdict.message, 'Fragment is already last.');
  assert.deepEqual(writes, []);
});

test('a fragment.move before a line puts the whole block there and selects it', () => {
  const { verdict, writes } = applyOutsideThePage('sequence', ALT, 'fragment.move', { ref: 'frag:4', at: { beforeLine: 10 } });

  assert.equal(verdict.ok, true, `refused with ${verdict.code}`);
  assert.deepEqual({ ...verdict.select }, { id: 'frag:5', kind: 'fragment' });
  assert.deepEqual(writes, [linesOf(ALT_LINES, 0, 1, 2, 3, 9, 4, 5, 6, 7, 8, 10)]);
});

test('a fragment.add with `wrap` indents the lines from fromLine to toLine into the fragment, with an else for alt', () => {
  const { verdict, writes } = applyOutsideThePage('sequence', THREE_LINES.join('\n'), 'fragment.add',
    { operator: 'alt', wrap: { fromLine: 5, toLine: 6 }, guard: { text: 'found' } });

  assert.equal(verdict.ok, true, `refused with ${verdict.code}`);
  assert.equal(verdict.select, null);
  assert.deepEqual(writes, [linesOf(THREE_LINES, 0, 1, 2, 3, 4, 'alt [found]', '  app -> db: query', 'else [otherwise]', '  db --> app: rows', 'end', 7, 8)]);
});

test('an activation.add puts activate and deactivate around the message slots it names and selects the bar', () => {
  const { verdict, writes } = applyOutsideThePage('sequence', THREE_LINES.join('\n'), 'activation.add',
    { lifeline: 'app', slots: { start: 1, end: 2 } });

  assert.equal(verdict.ok, true, `refused with ${verdict.code}`);
  assert.deepEqual({ ...verdict.select }, { id: 'actbar:5', kind: 'activation' });
  assert.deepEqual(writes, [linesOf(THREE_LINES, 0, 1, 2, 3, 4, 'activate app', 5, 'deactivate app', 6, 7, 8)]);
});

test('an activation.set moves the referenced bar\'s deactivate to the slot it names', () => {
  const { verdict, writes } = applyOutsideThePage('sequence', ACTIVATION_LINES.join('\n'), 'activation.set',
    { ref: APP_BAR, lifeline: 'app', slots: { start: 1, end: 3 } });

  assert.equal(verdict.ok, true, `refused with ${verdict.code}`);
  assert.deepEqual({ ...verdict.select }, { id: 'actbar:4', kind: 'activation' });
  assert.deepEqual(writes, [linesOf(ACTIVATION_LINES, 0, 1, 2, 3, 4, 5, 7, 6, 8, 9)]);
});

test('an activation.set whose bar no longer starts with an activate line is refused with activation/unmatched and writes nothing', () => {
  const { verdict, writes } = applyOutsideThePage('sequence', ACTIVATION_LINES.join('\n'), 'activation.set',
    { ref: { id: 'actbar:3', startLine: 3, endLine: 6 }, lifeline: 'app', slots: { start: 0, end: 2 } });

  assert.equal(verdict.ok, false);
  assert.equal(verdict.code, 'activation/unmatched');
  assert.deepEqual(writes, []);
});

// ---------- the raw-source family (plan Task 16) ----------
//
// The forms that edit the document by its lines (the line-model and sequence panels, the
// quick-insert buttons, the callouts panel, Properties fields that rebuild a declaration) count
// lines in the framed document: the text inside `@startuml … @enduml` without its layout, as the
// panels list it. Line operations write the framed document back.

const BRANCHES_LINES = ['@startuml', 'branch main:', '  C1 "Init"', 'branch dev:', '  C2 "Work"', '@enduml'];
const BRANCHES = BRANCHES_LINES.join('\n');
const SETS_LINES = ['@startuml', 'set A', '', 'set B', 'A : x', '@enduml'];
const SETS = SETS_LINES.join('\n');

test('a source.replace writes the text it carries, as it is', () => {
  const callout = `${SETS.replace('@enduml', 'note "Hi" as N1')}\n@enduml`;

  const { verdict, writes } = applyOutsideThePage('venn', SETS, 'source.replace', { text: callout });

  assert.equal(verdict.ok, true, `refused with ${verdict.code}`);
  assert.deepEqual(writes, [callout]);
});

test('a framed source.insertLines at the end frames a bare document and puts its lines before @enduml, in order', () => {
  const { verdict, writes } = applyOutsideThePage('gitgraph', '  C1 "Init"', 'source.insertLines',
    { lines: ['branch main:', 'head main'], at: 'end', frame: true });

  assert.equal(verdict.ok, true, `refused with ${verdict.code}`);
  assert.deepEqual(writes, [['@startuml', 'C1 "Init"', 'branch main:', 'head main', '@enduml'].join('\n')], 'framing trims the bare document');
});

test('an unframed source.insertLines at the end adds its line to the document as it is', () => {
  const { verdict, writes } = applyOutsideThePage('sequence', 'user -> app: login', 'source.insertLines',
    { lines: ['activate app'], at: 'end', frame: false });

  assert.equal(verdict.ok, true, `refused with ${verdict.code}`);
  assert.deepEqual(writes, ['user -> app: login\nactivate app']);
});

test('a source.insertLines before a line puts its lines there and leaves the selection as it is', () => {
  const { verdict, writes } = applyOutsideThePage('gitgraph', BRANCHES, 'source.insertLines',
    { lines: ['  C3 "Commit message"'], at: { beforeLine: 3 }, frame: true });

  assert.equal(verdict.ok, true, `refused with ${verdict.code}`);
  assert.equal(verdict.select, undefined);
  assert.deepEqual(writes, [linesOf(BRANCHES_LINES, 0, 1, 2, '  C3 "Commit message"', 3, 4, 5)]);
});

test('a source.replaceLines replaces the lines of its range by its lines, and an empty range inserts them', () => {
  const replaced = applyOutsideThePage('venn', SETS, 'source.replaceLines', { range: { start: 3, end: 4 }, lines: ['set C'] });
  const inserted = applyOutsideThePage('venn', SETS, 'source.replaceLines', { range: { start: 3, end: 2 }, lines: ['set C'] });

  assert.deepEqual(replaced.writes, [linesOf(SETS_LINES, 0, 1, 2, 'set C', 5)]);
  assert.deepEqual(inserted.writes, [linesOf(SETS_LINES, 0, 1, 2, 'set C', 3, 4, 5)]);
});

test('a source.removeLines removes the lines of its range', () => {
  const { verdict, writes } = applyOutsideThePage('venn', SETS, 'source.removeLines', { range: { start: 1, end: 1 } });

  assert.equal(verdict.ok, true, `refused with ${verdict.code}`);
  assert.deepEqual(writes, [linesOf(SETS_LINES, 0, 2, 3, 4, 5)]);
});

for (const [op, fields] of [
  ['source.replaceLines', { range: { start: 6, end: 6 }, lines: ['set C'] }],
  ['source.removeLines', { range: { start: -1, end: 0 } }],
  ['source.moveLines', { line: 3, swapWith: 6 }],
  ['source.insertLines', { lines: ['set C'], at: { beforeLine: 7 }, frame: true }],
]) {
  test(`a ${op} that names a line outside the framed document is refused with source/range and writes nothing`, () => {
    const { verdict, writes } = applyOutsideThePage('venn', SETS, op, fields);

    assert.equal(verdict.ok, false);
    assert.equal(verdict.code, 'source/range');
    assert.deepEqual(writes, []);
  });
}

test('a source.moveLines exchanges its two lines and keeps the lines between them in place', () => {
  const { verdict, writes } = applyOutsideThePage('venn', SETS, 'source.moveLines', { line: 3, swapWith: 1 });

  assert.equal(verdict.ok, true, `refused with ${verdict.code}`);
  assert.deepEqual(writes, [linesOf(SETS_LINES, 0, 3, 2, 1, 4, 5)]);
});

test('a source.replaceDeclaration replaces the whole declaration of the element it names, a block too, and selects that element', () => {
  const componentLines = ['@startuml', 'component Api {', '  portin request', '}', 'component Db', 'Api --> Db', '@enduml'];

  const { verdict, writes } = applyOutsideThePage('component', componentLines.join('\n'), 'source.replaceDeclaration',
    { ref: 'Api', text: 'component Api dashed' });

  assert.equal(verdict.ok, true, `refused with ${verdict.code}`);
  assert.deepEqual({ ...verdict.select }, { id: 'Api', kind: 'node' });
  assert.deepEqual(writes, [linesOf(componentLines, 0, 'component Api dashed', 4, 5, 6)]);
});

// ---------- one reader (plan Task 17, stage R2a; spec §3.2, §3.4, §3.9) ----------
//
// The document is the textarea's text, and only the host reads it there: its document functions,
// each kept in the host by a row of spec §3.9. The host's other code (its forms, its undo stack, its
// render loop) reads it through the host's reader, readDocument. Every other part of the editor (the
// canvas: the scene, the commands, the gestures, the in-place editors) reads the document through
// the text adapter's contents(): one reading of one revision, with the fields of spec §3.4.

const { functionChainOf } = require('./helpers/uml-editor-script');

// The functions that read `textarea.value`, by the outermost named function inside init, each with
// the row of spec §3.9 (or the member of spec §3.4) that keeps it in the host.
const TEXTAREA_READERS = {
  readDocument: '§3.4: the text adapter\'s read()',
  setDocument: '§3.9: setDocument',
  'textarea:input': '§3.9: the textarea, typing, and the text-edit undo baseline',
  saveCurrentSource: '§3.9: autosave and its indicators',
  sourceExportSnapshot: '§3.9: export',
  'copySourceBtn:click': '§3.9: Copy ArchUML',
  sourceDraftForType: '§3.9: Generate Python (and export\'s per-type sources)',
  renderDiagram: '§3.9: draft diagnostics (calling the text adapter\'s reader)',
};

// The host code that calls readDocument, by the outermost named function inside init, each with
// the row of spec §3.9 (or §3.4) that keeps it in the host.
const DOCUMENT_READERS = {
  write: '§3.4: the host\'s write',
  snapshotForUndo: '§3.9: the undo and redo stacks and buttons',
  undo: '§3.9: the undo and redo stacks and buttons',
  redo: '§3.9: the undo and redo stacks and buttons',
  init: '§3.9: the textarea, typing, and the text-edit undo baseline (the load at start)',
  renderDiagram: '§3.9: the render loop and error box',
  'typeSelect:change': '§3.9: the diagram-type switch with per-type drafts and histories',
  rememberCurrentSource: '§3.9: the diagram-type switch with per-type drafts and histories',
  autoLayout: '§3.9: autoLayout',
  getSource: '§3.9: the callouts panel wiring',
  commitSource: '§3.9: the callouts panel wiring',
  buildElementProps: '§3.9: the Properties pane',
  buildRelationProps: '§3.9: the Properties pane',
  buildCrcCardProps: '§3.9: the Properties pane',
  buildSystemMembershipProps: '§3.9: the Properties pane',
  changeCrcCardProperty: '§3.9: the Properties pane',
  selectedClassForActions: '§3.9: the class editing bar',
  updateClassActions: '§3.9: the class editing bar',
  openClassMemberForm: '§3.9: the class editing bar',
  refreshSequenceRowDrafts: '§3.9: the sequence panel',
  updateSequenceParticipant: '§3.9: the sequence panel',
  rebuildSequenceModelPanel: '§3.9: the sequence panel',
  lineModelRows: '§3.9: the line-model panels',
  addGitgraphBranchRow: '§3.9: the line-model panels',
  addGitgraphCommitRow: '§3.9: the line-model panels',
  addLineModelPreset: '§3.9: the line-model panels',
};

/** Each node `matches` accepts, as `outermost function (line N)`, when that function is not in `allowed`. */
function readsOutside(ast, matches, allowed) {
  const outside = [];
  walk(ast, (nodePath) => {
    if (!matches(nodePath)) return;
    const outermost = functionChainOf(nodePath).split('>')[0];
    if (!Object.prototype.hasOwnProperty.call(allowed, outermost)) outside.push(`${outermost || '(top level)'} (line ${nodePath.node.loc.start.line})`);
  });
  return outside;
}

test('the textarea is read only by the host\'s document functions', () => {
  const { ast } = loadIncludeScript();

  const reads = readsOutside(ast, ({ node, parent, key }) => node.type === 'MemberExpression' && !node.computed
    && node.object.type === 'Identifier' && node.object.name === 'textarea' && node.property.name === 'value'
    && !(parent && parent.node.type === 'AssignmentExpression' && key === 'left'), TEXTAREA_READERS);

  assert.deepEqual(reads, [], 'reads of textarea.value outside the host\'s document functions');
});

test('only host code reads the document through the host\'s reader; the canvas reads contents()', () => {
  const { ast } = loadIncludeScript();

  const calls = readsOutside(ast, ({ node }) => node.type === 'CallExpression'
    && node.callee.type === 'Identifier' && node.callee.name === 'readDocument', DOCUMENT_READERS);

  assert.deepEqual(calls, [], 'calls of readDocument outside the host code of spec §3.9');
});

/** The text adapter outside the page, reading `text` of diagram type `type`, and the texts it wrote. */
function adapterReading(type, text) {
  adapterOutsideThePage = adapterOutsideThePage || textAdapterOutsideThePage();
  const writes = [];
  const adapter = adapterOutsideThePage.createTextAdapter({
    read: () => text, type: () => type, bundle: adapterOutsideThePage.bundle, write: (written) => writes.push(written),
  });
  return { adapter, writes, revisionOf: adapterOutsideThePage.revisionOf };
}

/** A plain copy of `value` (the reading crosses a vm context, so its objects have another prototype). */
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test('contents() reads a class document\'s elements and relations with the fields of spec §3.4 and writes nothing', () => {
  const { adapter, writes, revisionOf } = adapterReading('class', ORDERS);

  const reading = adapter.contents();

  assert.equal(reading.type, 'class');
  assert.equal(reading.revision, revisionOf(ORDERS));
  assert.deepEqual(plain(reading.elements), [
    { id: 'Order', kind: 'class', label: 'Order', name: 'Order', axis: 'xy', parentId: null, members: [{ list: 'attributes', index: 0, text: '-id: int' }] },
    { id: 'Customer', kind: 'class', label: 'Customer', name: 'Customer', axis: 'xy', parentId: null, members: [] },
  ]);
  assert.deepEqual(plain(reading.relations), [
    { line: 3, routeId: null, kind: 'assoc', from: 'Order', to: 'Customer', label: '', text: '' },
  ]);
  assert.deepEqual(plain(reading.fragments), []);
  assert.deepEqual(plain(reading.activations), []);
  assert.deepEqual(writes, [], 'reading the document writes nothing');
});

test('contents() reads a sequence document\'s lifelines in order, its messages with their route ids, and its fragments with their branches', () => {
  const text = ['@startuml', 'participant user', 'participant app', 'alt [ok]', 'user -> app: login', 'else [failed]',
    'app --> user: retry', 'end', 'activate app', 'deactivate app', '@enduml'].join('\n');
  const { adapter } = adapterReading('sequence', text);

  const reading = adapter.contents();

  assert.deepEqual(plain(reading.elements).map(({ id, axis, parentId }) => ({ id, axis, parentId })),
    [{ id: 'user', axis: 'order', parentId: null }, { id: 'app', axis: 'order', parentId: null }]);
  assert.deepEqual(plain(reading.relations).map(({ line, routeId, from, to, label }) => ({ line, routeId, from, to, label })), [
    { line: 4, routeId: 'seqmsg:4', from: 'user', to: 'app', label: 'login' },
    { line: 6, routeId: 'seqmsg:6', from: 'app', to: 'user', label: 'retry' },
  ]);
  assert.deepEqual(plain(reading.fragments), [
    { id: 'frag:3', operator: 'alt', startLine: 3, endLine: 7, branches: [{ line: 3, guard: 'ok' }, { line: 5, guard: 'failed' }] },
  ]);
  assert.deepEqual(plain(reading.activations), [{ lifeline: 'app', startLine: 8, endLine: 9 }]);
});

test('contents() names the parent of a nested deployment element and of a component\'s port', () => {
  const deployment = adapterReading('deployment', ['@startuml', 'node Server {', '  artifact App', '}', '@enduml'].join('\n')).adapter.contents();
  const component = adapterReading('component', ['@startuml', 'component Api {', '  portin request', '}', '@enduml'].join('\n')).adapter.contents();

  assert.deepEqual(plain(deployment.elements).map(({ id, parentId }) => ({ id, parentId })),
    [{ id: 'Server', parentId: null }, { id: 'App', parentId: 'Server' }]);
  assert.deepEqual(plain(component.elements).map(({ id, axis, parentId }) => ({ id, axis, parentId })),
    [{ id: 'Api', axis: 'xy', parentId: null }, { id: 'Api.request', axis: 'port', parentId: 'Api' }]);
});

test('contents() is a reading of the document as it is when it is called', () => {
  let text = ORDERS;
  adapterOutsideThePage = adapterOutsideThePage || textAdapterOutsideThePage();
  const adapter = adapterOutsideThePage.createTextAdapter({ read: () => text, type: () => 'class', bundle: adapterOutsideThePage.bundle, write() {} });

  const before = adapter.contents();
  text = ORDERS.replace('class Customer', 'class Customer\nclass Invoice');
  const after = adapter.contents();

  assert.deepEqual(plain(before.elements).map((element) => element.id), ['Order', 'Customer'], 'an earlier reading keeps its document');
  assert.deepEqual(plain(after.elements).map((element) => element.id), ['Order', 'Customer', 'Invoice']);
  assert.notEqual(after.revision, before.revision);
});

test('tools() lists the palette of the document\'s type, with nothing unavailable', () => {
  const tools = adapterReading('class', ORDERS).adapter.tools();

  assert.deepEqual(plain(tools.elements).map(({ id, label, glyph }) => ({ id, label, glyph })).slice(0, 4), [
    { id: 'class', label: 'Class', glyph: '▢' }, { id: 'abstract', label: 'Abstract', glyph: '■' },
    { id: 'interface', label: 'Interface', glyph: '○' }, { id: 'enum', label: 'Enum', glyph: '≡' },
  ]);
  assert.ok(plain(tools.relations).some(({ id, label }) => id === 'gen' && label === 'Generalization'));
  assert.deepEqual(plain(tools.unavailable), []);
});

test('the serializers parse a class declaration and rebuild one that parses to the same class', () => {
  const { serializers } = adapterReading('class', ORDERS).adapter;

  const info = serializers.parseClassDeclaration('class Order { -id: int }');
  const rebuilt = serializers.parseClassDeclaration(serializers.buildClassLine(info));

  assert.equal(info.name, 'Order');
  assert.deepEqual(plain(info.members), [{ visibility: '-', isAbstract: false, isStatic: false, text: 'id: int' }]);
  assert.deepEqual({ kind: rebuilt.kind, name: rebuilt.name, members: plain(rebuilt.members) },
    { kind: info.kind, name: info.name, members: plain(info.members) });
});

// ---------- two scopes: the session and the host (plan Task 18; spec §3.3) ----------
//
// Stage R2 ends with the editor in two function scopes. The module half is created by one function,
// createDiagramEditorSession, which receives only its mount options (root, canvas, adapter, host,
// surface, idPrefix, env, elements); since plan Task 24 it is de-mount.js's, and the host calls it
// through ArchUMLDiagramEditor.mount. The host half is init, the include's. Each piece of state of
// spec §3.3 has one owner: the bindings of a family are declared only in the session's own scope,
// init never names them, and the host reaches them only through the session's member that §3.3 lists.
// Last, the session names nothing of the host: no identifier init declares and no global of the page,
// so a read across the line would be a ReferenceError.

const SESSION_FACTORY = 'createDiagramEditorSession';
const SESSION_FILE = 'diagram-editor/de-mount.js';
const MOUNT = 'ArchUMLDiagramEditor.mount';
const HOST_SCOPE = 'init';
// The session's own reference to the classic host object, and init's reference to the session.
const SESSION_IN_HOST = 'session';

const FUNCTION_NODE_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression',
  'ObjectMethod', 'ClassMethod']);

/** The names a binding pattern declares (`a`, `{ a, b: c }`, `[d, ...e]`, `f = 1`). */
function patternNames(pattern, names = []) {
  if (!pattern) return names;
  switch (pattern.type) {
    case 'Identifier': names.push(pattern.name); break;
    case 'ObjectPattern':
      pattern.properties.forEach((property) => patternNames(property.type === 'RestElement' ? property.argument : property.value, names));
      break;
    case 'ArrayPattern': pattern.elements.forEach((element) => patternNames(element, names)); break;
    case 'AssignmentPattern': patternNames(pattern.left, names); break;
    case 'RestElement': patternNames(pattern.argument, names); break;
    default: break;
  }
  return names;
}

/**
 * The names a function's own scope declares: its parameters, its own name when it is an expression,
 * and every var, let, const, function, class, and catch binding in its body outside nested functions.
 * (Block scope is treated as the function's: the editor's script declares with var.)
 */
function ownScopeNames(fn) {
  const names = new Set(fn.params.flatMap((param) => patternNames(param)));
  if (fn.type === 'FunctionExpression' && fn.id) names.add(fn.id.name);
  names.add('arguments');
  function visit(node) {
    if (!node || typeof node.type !== 'string') return;
    if (node !== fn && FUNCTION_NODE_TYPES.has(node.type)) {
      if (node.type === 'FunctionDeclaration' && node.id) names.add(node.id.name);
      return;
    }
    if (node.type === 'VariableDeclarator') patternNames(node.id).forEach((name) => names.add(name));
    if (node.type === 'ClassDeclaration' && node.id) names.add(node.id.name);
    if (node.type === 'CatchClause' && node.param) patternNames(node.param).forEach((name) => names.add(name));
    for (const key of Object.keys(node)) {
      if (SKIPPED_KEYS.has(key)) continue;
      const child = node[key];
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child.type === 'string') visit(child);
    }
  }
  visit(fn.body);
  return names;
}

/** Whether the identifier at `nodePath` is a read of a binding, not a property name, a label, or a declared name. */
function isBindingReference({ node, parent, key }) {
  const owner = parent && parent.node;
  if (!owner) return true;
  switch (owner.type) {
    case 'MemberExpression': case 'OptionalMemberExpression': return key !== 'property' || owner.computed;
    case 'ObjectProperty': return key !== 'key' || owner.computed;
    case 'ObjectMethod': case 'ClassMethod': case 'ClassProperty': return key !== 'key' || owner.computed;
    case 'LabeledStatement': case 'BreakStatement': case 'ContinueStatement': return false;
    case 'VariableDeclarator': return key !== 'id';
    case 'FunctionDeclaration': case 'FunctionExpression': case 'ArrowFunctionExpression': return key !== 'id' && key !== 'params';
    case 'CatchClause': return key !== 'param';
    case 'ClassDeclaration': case 'ClassExpression': return key !== 'id';
    case 'MetaProperty': return false;
    default: return true;
  }
}

/**
 * The free identifiers of the function `fn`: every read of a name that neither `fn` nor a function
 * inside it declares, with its line. Default values of parameters are reads too.
 */
function freeIdentifiers(fn) {
  const free = [];
  function visitFunction(current, bound) {
    const scope = new Set([...bound, ...ownScopeNames(current)]);
    current.params.forEach((param) => walk(param, (nodePath) => {
      if (nodePath.node.type === 'AssignmentPattern') visitNode(nodePath.node.right, scope);
    }));
    visitNode(current.body, scope);
  }
  function visitNode(start, scope) {
    walkSkippingFunctions(start, (nodePath) => {
      if (FUNCTION_NODE_TYPES.has(nodePath.node.type)) {
        if (nodePath.node.computed && nodePath.node.key) visitNode(nodePath.node.key, scope);
        visitFunction(nodePath.node, scope);
        return;
      }
      if (nodePath.node.type === 'Identifier' && isBindingReference(nodePath) && !scope.has(nodePath.node.name)) {
        free.push({ name: nodePath.node.name, line: nodePath.node.loc.start.line });
      }
    });
  }
  visitFunction(fn, new Set());
  return free;
}

/** `walk`, but a nested function is handed to `visit` and not entered (its scope is its own). */
function walkSkippingFunctions(start, visit) {
  function visitNode(node, parent, key) {
    const nodePath = { node, parent, key };
    visit(nodePath);
    if (node !== start && FUNCTION_NODE_TYPES.has(node.type)) return;
    for (const childKey of Object.keys(node)) {
      if (SKIPPED_KEYS.has(childKey)) continue;
      const child = node[childKey];
      if (Array.isArray(child)) child.forEach((item) => { if (item && typeof item.type === 'string') visitNode(item, nodePath, childKey); });
      else if (child && typeof child.type === 'string') visitNode(child, nodePath, childKey);
    }
  }
  visitNode(start, null, null);
}

/** Every name declared anywhere inside the function `fn`, its own scope and the scopes of functions inside it. */
function namesDeclaredWithin(fn) {
  const names = new Set(ownScopeNames(fn));
  walkSkippingFunctions(fn.body, ({ node }) => {
    if (FUNCTION_NODE_TYPES.has(node.type)) namesDeclaredWithin(node).forEach((name) => names.add(name));
  });
  return names;
}

/** The two scopes: `{ session, host }`, the function declarations of the session factory (de-mount.js) and of init (the include). */
function twoScopes() {
  const { ast } = loadIncludeScript();
  const host = topLevelBindings(ast).get(HOST_SCOPE);
  assert.ok(host && host.node.type === 'FunctionDeclaration', `${HOST_SCOPE} is declared at the script's top level`);
  return { ast, session: moduleFunction(SESSION_FILE, SESSION_FACTORY), host: host.node };
}

/** The dotted reads `<object>.<member>` inside `node` whose object is the identifier `object`, as `member` names. */
function membersReadOf(node, object) {
  const members = new Set();
  walk(node, ({ node: current }) => {
    if ((current.type === 'MemberExpression' || current.type === 'OptionalMemberExpression') && !current.computed
      && current.object.type === 'Identifier' && current.object.name === object) members.add(current.property.name);
  });
  return members;
}

/** The function declared in `scope`'s own body under `name`, or null. */
function functionDeclaredIn(scope, name) {
  return scope.body.body.find((statement) => statement.type === 'FunctionDeclaration' && statement.id.name === name) || null;
}

/** The members of the object the host passes the session as `option` (`host`, `elements`, `env`), by name. */
function sessionOptionMembers(host, option) {
  let members = null;
  walk(host, ({ node }) => {
    if (members || node.type !== 'CallExpression' || code(node.callee) !== MOUNT) return;
    const options = node.arguments[0];
    assert.ok(options && options.type === 'ObjectExpression', `${HOST_SCOPE} calls ${MOUNT} with an object of mount options`);
    const property = options.properties.find((candidate) => candidate.key && candidate.key.name === option);
    assert.ok(property && property.value.type === 'ObjectExpression', `the mount option ${option} is an object literal`);
    members = new Set(property.value.properties.map((member) => member.key.name));
  });
  assert.ok(members, `${HOST_SCOPE} mounts the session with ${MOUNT}`);
  return members;
}

/**
 * The family rule of spec §3.3: each binding of `names` is declared in the session's own scope, the host
 * declares none of them, and nothing in the host reads one; the host's reads of the session's members.
 */
function assertOwnedBySession(names, family) {
  const { session, host } = twoScopes();
  const sessionNames = ownScopeNames(session);
  const hostNames = namesDeclaredWithin(host);
  const hostReads = new Set(freeIdentifiers(host).map(({ name }) => name));

  assert.deepEqual(names.filter((name) => !sessionNames.has(name)), [], `${family}: bindings not declared in the session's own scope`);
  assert.deepEqual(names.filter((name) => hostNames.has(name)), [], `${family}: bindings the host still declares`);
  assert.deepEqual(names.filter((name) => hostReads.has(name)), [], `${family}: bindings the host still reads`);
  return { session, host, sessionMembers: membersReadOf(host, SESSION_IN_HOST) };
}

// Since plan Task 23 the module half is the session and the parts it is made of, each a factory of a file of the
// diagram editor module: `[file, factory]`. A family whose owner is a part (spec §3.3) is declared in that factory's
// own scope, and neither the session nor the host declares it.
const PARTS = {
  viewport: ['diagram-editor/de-viewport.js', 'createViewport'],
  commands: ['diagram-editor/de-commands.js', 'createClassicCommands'],
  routes: ['diagram-editor/de-gestures-routes.js', 'createRouteGestures'],
  move: ['diagram-editor/de-gestures-move.js', 'createMoveGestures'],
  connect: ['diagram-editor/de-gestures-connect.js', 'createConnectGestures'],
  palette: ['diagram-editor/de-gestures-palette.js', 'createPaletteGestures'],
  sequence: ['diagram-editor/de-gestures-sequence.js', 'createSequenceGestures'],
  marquee: ['diagram-editor/de-gestures-marquee.js', 'createMarqueeGesture'],
  menus: ['diagram-editor/de-menus.js', 'createMenus'],
  inline: ['diagram-editor/de-inline.js', 'createInlineEditors'],
  surface: ['diagram-editor/de-surface-classic.js', 'createClassicSurface'],
};

/** The text of a file of the module (a path relative to js/ArchUML), read once. */
const moduleSources = new Map();
function moduleSource(file) {
  if (!moduleSources.has(file)) moduleSources.set(file, fs.readFileSync(path.join(ARCHUML, file), 'utf8'));
  return moduleSources.get(file);
}

/** The syntax tree of a file of the module, read once; its nodes name the file (`loc.filename`). */
const partAsts = new Map();
function partAst(file) {
  if (!partAsts.has(file)) partAsts.set(file, babelParser.parse(moduleSource(file), { sourceType: 'script', sourceFilename: file }));
  return partAsts.get(file);
}

/** The function `name` that the module file `file` declares. */
function moduleFunction(file, name) {
  let found = null;
  walk(partAst(file), ({ node }) => {
    if (node.type === 'FunctionDeclaration' && node.id.name === name) found = node;
  });
  assert.ok(found, `${file} declares ${name}`);
  return found;
}

/** The factory function `[file, factory]` declares. */
function partFactory([file, factory]) {
  return moduleFunction(file, factory);
}

/** The functions of the module half: the session, and the factory of each part. */
function moduleHalf() {
  return [twoScopes().session, ...Object.values(PARTS).map(partFactory)];
}

/** Whether the session's binding `name` is its name for the kit's member of that name (`var name = kit.name`). */
function isKitAlias(session, name) {
  const declarator = sessionDeclarator(session, name);
  const init = declarator && declarator.init;
  return !!init && init.type === 'MemberExpression' && !init.computed && init.object.type === 'Identifier'
    && init.object.name === 'kit' && init.property.name === name;
}

/**
 * The family rule for a family a part owns: each binding of `names` is declared in the own scope of the part's
 * factory, the session declares none (it may name the part's member: `var name = kit.name`), the host declares
 * none, and nothing in the host reads one.
 */
function assertOwnedByPart(names, family, part) {
  const { session, host } = twoScopes();
  const partNames = ownScopeNames(partFactory(part));
  const hostNames = namesDeclaredWithin(host);
  const hostReads = new Set(freeIdentifiers(host).map(({ name }) => name));

  assert.deepEqual(names.filter((name) => !partNames.has(name)), [], `${family}: bindings not declared in ${part[1]} (${part[0]})`);
  assert.deepEqual(names.filter((name) => ownScopeNames(session).has(name) && !isKitAlias(session, name)), [],
    `${family}: bindings the session declares too`);
  assert.deepEqual(names.filter((name) => hostNames.has(name)), [], `${family}: bindings the host still declares`);
  assert.deepEqual(names.filter((name) => hostReads.has(name)), [], `${family}: bindings the host still reads`);
  return { session, host, sessionMembers: membersReadOf(host, SESSION_IN_HOST) };
}

/** The host services the module half calls: the members of `host` that the session and the parts read. */
function hostServicesCalled() {
  return new Set(moduleHalf().flatMap((fn) => [...membersReadOf(fn, 'host')]));
}

// Since plan Task 22 the selection set is one binding of the session's, made by de-selection.js's createSelection.
const SELECTION_STATE = ['selectedLayout'];
// Since plan Task 23 the active tool and the relation its first click started are one record of the commands',
// `toolState`, which the gestures and the menus share; renamingId, which nothing reads, stays the session's.
const TOOL_STATE = ['toolState'];
const TOOL_RECORD = ['activeTool', 'pendingRelation'];
// R0's drag state: the five drags the page's own pointer listeners drove, and the palette drag's state and
// the click it takes after an armed drag. From stage R3 each lives in its gesture's session (spec §3.8).
const DRAG_STATE = ['dragState', 'extendDragState', 'sequenceMessageDragState', 'fragmentDragState', 'activationDragState',
  'paletteDragState', 'suppressPaletteClick'];
// Click tracking is the classic surface's (spec §3.3): the last press, for the double-click window.
const CLICK_TRACKING = ['lastHitboxClick', 'lastRouteClick'];
// Since plan Task 23 the menus and choosers are de-menus.js's, the in-place editors de-inline.js's, the view and the
// canvas constants de-viewport.js's. Since plan Task 24 the hit layer's caches, the activation bars of the last drawing
// and the SVG namespace of the palette's icons, are the classic surface's, which builds them (de-surface-classic.js).
const MENU_STATE = ['relationChooser', 'relationChooserReturnFocus', 'contextMenu', 'contextMenuReturnFocus'];
const INLINE_STATE = ['inlineRenameInput', 'inlineRenameCancel'];
const VIEW_STATE = ['zoom', 'panOffset', 'initialCanvasRevealPending', 'ZOOM_MIN', 'ZOOM_MAX'];
const CANVAS_CONSTANTS = ['EDITOR_CANVAS_MIN_WIDTH', 'EDITOR_CANVAS_MIN_HEIGHT', 'EDITOR_CANVAS_PADDING', 'EDITOR_MIN_TARGET_CSS_PX'];
const SCENE_STATE = ['activationBarIndex', 'SVG_NS'];

test('the selection is the session\'s: the host reads session.selection(), selects with session.select, and undo and redo capture it', () => {
  const { session, host, sessionMembers } = assertOwnedBySession(SELECTION_STATE, 'selection');

  const made = sessionDeclarator(session, 'selectedLayout');
  assert.ok(made && made.init && made.init.type === 'CallExpression' && code(made.init.callee) === 'createSelection',
    'the session\'s selection set is a selection of de-selection.js');
  assert.ok(sessionMembers.has('selection') && sessionMembers.has('select'), 'the host reaches the selection through session.selection() and session.select');
  for (const name of ['undo', 'redo']) {
    const historyStep = functionDeclaredIn(host, name);
    assert.ok(historyStep, `${name} is the host's`);
    assert.ok(membersReadOf(historyStep, SESSION_IN_HOST).has('selection'), `${name} captures session.selection()`);
  }
  assert.ok(sessionMembers.has('sync'), 'the host draws and then calls session.sync');
});

// Spec §2.4's host services, and the five the classic host adds (plan Task 18's report lists them for
// Task 48): the drawing made again (a drag preview put back), an in-place rename's own undo step, the
// CRC card form, and the forms a context menu offers and opens.
const SPEC_HOST_SERVICES = ['announce', 'status', 'confirm', 'undo', 'redo', 'canUndo', 'canRedo',
  'onSelectionChange', 'openProperties', 'registerEscape', 'autoLayout'];
const CLASSIC_HOST_EXTRAS = ['redraw', 'startUndoStep', 'replaceCrcCard', 'offersForm', 'openForm'];

test('the classic host gives the session the services of spec §2.4 and the five listed extras, and nothing else', () => {
  const { session, host } = twoScopes();
  const allowed = [...SPEC_HOST_SERVICES, ...CLASSIC_HOST_EXTRAS].sort();

  assert.deepEqual([...sessionOptionMembers(host, 'host')].sort(), allowed, 'the services the classic host passes');
  assert.deepEqual([...hostServicesCalled()].filter((name) => !allowed.includes(name)), [],
    'host services the session and its parts call that are not listed');
});

// The kinds a selection reference names (spec §3.4).
const SELECTION_KINDS = new Set(['node', 'route', 'fragment', 'activation']);
const SELECTION_REFERENCE_KEYS = new Set(['id', 'kind', 'sourceLine']);

/**
 * Whether `node` is a selection reference: an object of only `id`, `kind` (a selection's kind), and
 * `sourceLine`; a verdict's or write's `.select`; or `session.selection()`.
 */
function holdsSelection(node) {
  if (!node) return false;
  if (node.type === 'ObjectExpression') {
    const properties = new Map(node.properties.map((property) => [property.key && (property.key.name || property.key.value), property.value]));
    const kind = properties.get('kind');
    return properties.has('kind') && [...properties.keys()].every((key) => SELECTION_REFERENCE_KEYS.has(key))
      && !(kind.type === 'StringLiteral' && !SELECTION_KINDS.has(kind.value));
  }
  if (node.type === 'MemberExpression' && !node.computed) return node.property.name === 'select';
  if (node.type === 'CallExpression') return code(node.callee) === `${SESSION_IN_HOST}.selection`;
  if (node.type === 'ConditionalExpression') return holdsSelection(node.consequent) || holdsSelection(node.alternate);
  if (node.type === 'LogicalExpression') return holdsSelection(node.left) || holdsSelection(node.right);
  return false;
}

// Spec §3.3: pendingSelect stops being host state. A write's verdict and an undo's captured selection
// reach the drawing they make as sync's `restore`; what is selected "from the next drawing on" waits in
// the session (its selection), which the host reaches only through session.select.
test('the selection a later drawing brings back is the session\'s: the host keeps none, and the session asks the host to keep none', () => {
  const { session, host } = twoScopes();
  const hostBindings = ownScopeNames(host);

  const kept = [];
  walk(host, ({ node }) => {
    if (node.type === 'AssignmentExpression' && node.left.type === 'Identifier' && hostBindings.has(node.left.name)
      && holdsSelection(node.right)) kept.push(`${node.left.name} (line ${node.loc.start.line})`);
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && host.body.body.some((statement) =>
      statement.type === 'VariableDeclaration' && statement.declarations.includes(node)) && holdsSelection(node.init)) {
      kept.push(`${node.id.name} (line ${node.loc.start.line})`);
    }
  });
  assert.deepEqual(kept, [], 'bindings of the host that keep a selection between drawings');

  const staged = [];
  walk(session, ({ node }) => {
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && !node.callee.computed
      && node.callee.object.type === 'Identifier' && node.callee.object.name === 'host'
      && node.arguments.some(holdsSelection)) staged.push(`host.${node.callee.property.name} (line ${node.loc.start.line})`);
  });
  assert.deepEqual(staged, [], 'host services the session hands a selection to');

  const syncCalls = [];
  walk(host, ({ node }) => {
    if (node.type === 'CallExpression' && code(node.callee) === `${SESSION_IN_HOST}.sync`) syncCalls.push(node);
  });
  assert.ok(syncCalls.length > 0, 'the host calls session.sync');
  syncCalls.forEach((call) => {
    const syncOptions = call.arguments[1];
    assert.ok(syncOptions && syncOptions.type === 'ObjectExpression'
      && syncOptions.properties.some((property) => property.key.name === 'restore'), 'each sync names its restore');
  });
});

test('the active tool is the session\'s: the host sets it with session.setTool and reads session.tool(); host.status feeds the tool status line', () => {
  const { host, sessionMembers } = assertOwnedByPart(TOOL_STATE, 'tool state', PARTS.commands);
  assertOwnedBySession(['renamingId'], 'tool state');

  let record = null;
  walk(partFactory(PARTS.commands), ({ node }) => {
    if (node.type === 'VariableDeclarator' && node.id.name === 'toolState') record = node.init;
  });
  assert.deepEqual(record && record.properties.map((property) => property.key.name), TOOL_RECORD,
    'toolState holds the active tool and the relation its first click started');
  assert.ok(sessionMembers.has('setTool') && sessionMembers.has('tool'), 'the host reaches the tool through session.setTool and session.tool()');
  assert.ok(hostServicesCalled().has('status'), 'the session reports a tool\'s instruction through host.status');
  assert.ok(sessionOptionMembers(host, 'host').has('status'), 'the classic host gives the session its status service');
});

test('click tracking is the classic surface\'s, and the host reaches neither it nor any drag state', () => {
  const { host } = assertOwnedByPart(CLICK_TRACKING, 'click tracking', PARTS.surface);
  const hostNames = namesDeclaredWithin(host);
  const hostReads = new Set(freeIdentifiers(host).map(({ name }) => name));

  assert.deepEqual(DRAG_STATE.filter((name) => hostNames.has(name) || hostReads.has(name)), [],
    'drag state the host declares or reads');
});

test('popups are the session\'s, and Escape reaches an open one through host.registerEscape', () => {
  const { host } = assertOwnedByPart(MENU_STATE, 'menus and choosers', PARTS.menus);
  assertOwnedByPart(INLINE_STATE, 'in-place editors', PARTS.inline);

  assert.ok(membersReadOf(partFactory(PARTS.menus), 'host').has('registerEscape'), 'an open menu or chooser takes Escape through host.registerEscape');
  assert.ok(sessionOptionMembers(host, 'host').has('registerEscape'), 'the classic host gives the session its Escape service');
  const keyListeners = [];
  walk({ type: 'Program', body: moduleHalf() }, ({ node }) => {
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && !node.callee.computed
      && node.callee.property.name === 'addEventListener' && node.arguments[0] && node.arguments[0].type === 'StringLiteral'
      && node.arguments[0].value === 'keydown' && /document/.test(code(node.callee.object))) keyListeners.push(node.loc.start.line);
  });
  assert.deepEqual(keyListeners, [], 'lines where the session or a part listens for keys on the document itself');
});

test('the view is the session\'s, and the host reaches it through session.viewport', () => {
  const { sessionMembers } = assertOwnedByPart(VIEW_STATE, 'view', PARTS.viewport);
  assertOwnedByPart(CANVAS_CONSTANTS, 'canvas constants', PARTS.viewport);

  assert.ok(sessionMembers.has('viewport'), 'the host\'s zoom buttons reach the view through session.viewport');
});

test('scene caches are the classic surface\'s, and the session takes the page from env', () => {
  const { session, host } = assertOwnedByPart(SCENE_STATE, 'scene caches', PARTS.surface);

  assert.deepEqual([...sessionOptionMembers(host, 'env')].sort(), ['bundle', 'document', 'now', 'schedule'],
    'the classic host hands the session its document, clock, timer, and bundle');
  assert.deepEqual(session.params.map((param) => param.name), ['options'], 'the session receives only its mount options');
});

// Spec §3.3, last paragraph: a read across the line is a ReferenceError.
// Since plan Task 24 the list holds the module's own global too: a file reaches the parts through its UMD `root`.
const PAGE_GLOBALS = ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'UMLShared', 'Date',
  'setTimeout', 'clearTimeout', 'requestIdleCallback', 'requestAnimationFrame', 'textarea', 'typeSelect',
  'undoStack', 'redoStack', 'historyByType', 'EDITOR_CONFIG', 'ArchUMLDiagramEditorParts'];

test('the module half reaches nothing of the host', () => {
  const { session, host } = twoScopes();
  const hostNames = namesDeclaredWithin(host);
  const forbidden = new Set(PAGE_GLOBALS);

  const reads = freeIdentifiers(session)
    .filter(({ name }) => forbidden.has(name) || hostNames.has(name) || /^UML\w*Diagram$/.test(name))
    .map(({ name, line }) => `${name} (line ${line})`);

  assert.deepEqual(reads, [], 'reads of the host or the page inside the session');

  const partReads = Object.values(PARTS).flatMap((part) => freeIdentifiers(partFactory(part))
    .filter(({ name }) => forbidden.has(name) || /^UML\w*Diagram$/.test(name))
    .map(({ name, line }) => `${name} (${part[0]} line ${line})`));
  assert.deepEqual(partReads, [], 'reads of the page inside a part of the session');
});

/** A node's source text, for messages and simple matches: of the module file it names, or of the include's script. */
function code(node) {
  const file = node.loc && node.loc.filename;
  return (file ? moduleSource(file) : loadIncludeScript().code).slice(node.start, node.end);
}

// Since plan Task 24 the include defines neither half of the module: the session, the classic surface and its
// pointer driver, and the text adapter are the module's files, and init mounts them through ArchUMLDiagramEditor.
const MODULE_DEFINITIONS = [SESSION_FACTORY, 'createClassicSurface', 'createClassicPointerDriver', 'createTextAdapter',
  'createCommands', 'createSelection'];

test('the include defines neither the session nor the text adapter, and init mounts the module\'s', () => {
  const { ast } = loadIncludeScript();
  const defined = [];
  walk(ast, ({ node }) => {
    const name = node.type === 'FunctionDeclaration' ? node.id.name
      : node.type === 'VariableDeclarator' && node.id.type === 'Identifier' ? node.id.name : null;
    if (MODULE_DEFINITIONS.includes(name)) defined.push(`${name} (line ${node.loc.start.line})`);
  });
  const { host } = twoScopes();
  const called = new Set();
  walk(host, ({ node }) => { if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression') called.add(code(node.callee)); });

  assert.deepEqual(defined, [], 'functions of the module, or names of them, the include declares');
  assert.ok(called.has(MOUNT), `${HOST_SCOPE} mounts the session with ${MOUNT}`);
  assert.ok(called.has('ArchUMLDiagramEditor.createTextAdapter'), `${HOST_SCOPE} makes its text adapter with ArchUMLDiagramEditor.createTextAdapter`);
});

// ---------- gestures are sessions (stage R3, spec §3.8) ----------
//
// Every drag of the classic surface is a gesture factory `{ id, start(event, press) }`: a press site
// hands its press to the classic pointer driver, which asks the factories in order and runs the first
// session one returns. The session holds the drag's state, and only the driver listens for a drag's
// moves and release, for as long as the session runs.

const POINTER_DRIVER = 'createClassicPointerDriver';
// Today's precedence (plan Task 19), as the press sites test their conditions: on a drawn item a sequence
// message comes first, then a press that selects or edits in place, then a move; on the canvas a sequence
// message, then an activation bar, then the press that places, pans, or clears.
const GESTURE_ORDER = ['extend-handle', 'sequence-message', 'hitbox-press', 'fragment', 'activation-bar',
  'element-move', 'route-edit', 'placement-press', 'marquee', 'palette-drag'];
// The events that carry a drag after its press.
const DRAG_EVENTS = new Set(['pointermove', 'pointerup', 'pointercancel', 'mousemove', 'mouseup']);

/** The string `id` of the object literal `node`, or null. */
function literalId(node) {
  const property = node && node.type === 'ObjectExpression'
    && node.properties.find((candidate) => candidate.key && candidate.key.name === 'id');
  return property && property.value.type === 'StringLiteral' ? property.value.value : null;
}

/** The declarator of `name` in the session's own scope, or null. */
function sessionDeclarator(session, name) {
  let found = null;
  walkSkippingFunctions(session.body, ({ node }) => {
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && node.id.name === name) found = node;
  });
  return found;
}

/** The function declared under `name` in the session's own scope, or null. */
function sessionFunction(session, name) {
  let found = null;
  walkSkippingFunctions(session.body, ({ node }) => {
    if (node.type === 'FunctionDeclaration' && node.id.name === name) found = node;
  });
  return found;
}

/** The function declared under `name` in the factory of a part, or null. */
function partFunction(name) {
  for (const part of Object.values(PARTS)) {
    let found = null;
    walkSkippingFunctions(partFactory(part).body, ({ node }) => {
      if (node.type === 'FunctionDeclaration' && node.id.name === name) found = node;
    });
    if (found) return found;
  }
  return null;
}

/**
 * The id of a gesture factory as the session lists it: an object literal, or a binding of the session's
 * scope that holds one, or that holds what a function of the session's scope or of a part returns as one.
 */
function gestureIdOf(node, session) {
  if (node.type === 'ObjectExpression') return literalId(node);
  const declarator = node.type === 'Identifier' ? sessionDeclarator(session, node.name) : null;
  const init = declarator && declarator.init;
  if (!init) return null;
  if (init.type === 'ObjectExpression') return literalId(init);
  const maker = init.type === 'CallExpression' && init.callee.type === 'Identifier'
    ? sessionFunction(session, init.callee.name) || partFunction(init.callee.name) : null;
  let id = null;
  if (maker) {
    walkSkippingFunctions(maker.body, ({ node: current }) => {
      if (current.type === 'ReturnStatement' && literalId(current.argument)) id = literalId(current.argument);
    });
  }
  return id;
}

test('no drag-state binding is declared in the session\'s scope, and every drag is a factory the pointer driver asks in order', () => {
  const { session } = twoScopes();

  assert.deepEqual(DRAG_STATE.filter((name) => ownScopeNames(session).has(name)), [], 'R0 drag state the session\'s scope still declares');

  const driverCalls = [];
  walk(session, ({ node }) => {
    if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === POINTER_DRIVER) driverCalls.push(node);
  });
  assert.equal(driverCalls.length, 1, `the session makes one ${POINTER_DRIVER}`);
  const listed = driverCalls[0].arguments[1];
  const declarator = listed && listed.type === 'Identifier' ? sessionDeclarator(session, listed.name) : null;
  assert.ok(declarator && declarator.init.type === 'ArrayExpression', 'the driver gets the list of gesture factories the session declares');
  assert.deepEqual(declarator.init.elements.map((element) => gestureIdOf(element, session)), GESTURE_ORDER,
    'the gesture factories, in the order the pointer driver asks them');

  const members = [];
  walkSkippingFunctions(session.body, ({ node }) => {
    if (node.type === 'ReturnStatement' && node.argument && node.argument.type === 'ObjectExpression') members.push(...node.argument.properties);
  });
  const gestures = members.find((property) => property.key && property.key.name === 'gestures');
  assert.ok(gestures && gestures.value.type === 'Identifier' && gestures.value.name === listed.name,
    'session.gestures is the list the driver asks (spec §2.4)');

  const dragListeners = [];
  walk({ type: 'Program', body: moduleHalf() }, ({ node }) => {
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && !node.callee.computed
      && node.callee.property.name === 'addEventListener' && node.arguments[0] && node.arguments[0].type === 'StringLiteral'
      && DRAG_EVENTS.has(node.arguments[0].value)) dragListeners.push(`${node.arguments[0].value} (line ${node.loc.start.line})`);
  });
  assert.deepEqual(dragListeners, [], 'listeners for a drag\'s moves or release that the session or a part adds itself, outside the pointer driver');
});

// ---------- the classic pointer driver outside the page ----------

/** The driver of the classic surface (de-surface-classic.js), loaded in this process: `createClassicPointerDriver(doc, gestures)`. */
function pointerDriverOutsideThePage() {
  const surface = require(path.join(ARCHUML, PARTS.surface[0]));
  assert.equal(typeof surface[POINTER_DRIVER], 'function', `${PARTS.surface[0]} exports ${POINTER_DRIVER}`);
  return surface[POINTER_DRIVER];
}

function pointerEvent(type, clientX = 0) {
  return Object.assign(new Event(type), { clientX, clientY: 0 });
}

/** A session that records what it hears in `heard`, with the options `extra` (capture, mouse, slot, …). */
function recordingSession(name, heard, extra = {}) {
  return {
    ...extra,
    move: (event) => heard.push(`${name} move ${event.type} ${event.clientX}`),
    end: (event) => heard.push(`${name} end ${event.type} ${event.clientX}`),
    cancel: (event) => heard.push(`${name} cancel ${event ? event.type : 'by id'}`),
  };
}

test('a press asks the gesture factories in order and the first session one returns takes the press', () => {
  const createDriver = pointerDriverOutsideThePage();
  const asked = [];
  const taken = recordingSession('taken', []);
  const gesture = (id, session) => ({ id, start: (event, press) => { asked.push(`${id} ${press.site}`); return session; } });
  const driver = createDriver(new EventTarget(), [gesture('first', null), gesture('second', taken), gesture('third', recordingSession('third', []))]);

  const session = driver.press(pointerEvent('pointerdown'), { site: 'hitbox' });

  assert.equal(session, taken);
  assert.deepEqual(asked, ['first hitbox', 'second hitbox']);
  assert.equal(driver.running('second'), taken);
});

test('a press no gesture factory takes starts no session', () => {
  const createDriver = pointerDriverOutsideThePage();
  const driver = createDriver(new EventTarget(), [{ id: 'move', start: () => null }]);

  assert.equal(driver.press(pointerEvent('pointerdown'), { site: 'canvas' }), null);
  assert.equal(driver.running('move'), null);
});

test('a session hears the pointer\'s moves and its release on the document, and nothing once it has ended', () => {
  const createDriver = pointerDriverOutsideThePage();
  const doc = new EventTarget();
  const heard = [];
  const driver = createDriver(doc, [{ id: 'move', start: () => recordingSession('move', heard) }]);

  driver.press(pointerEvent('pointerdown'), {});
  doc.dispatchEvent(pointerEvent('pointermove', 5));
  doc.dispatchEvent(pointerEvent('mousemove', 6));
  doc.dispatchEvent(pointerEvent('pointerup', 7));
  doc.dispatchEvent(pointerEvent('pointermove', 8));
  doc.dispatchEvent(pointerEvent('pointerup', 9));

  assert.deepEqual(heard, ['move move pointermove 5', 'move end pointerup 7']);
  assert.equal(driver.running('move'), null, 'an ended session runs no more');
});

test('a session that follows mouse events ends at a mouse release too, and a pointer cancel cancels only a session that asks for it', () => {
  const createDriver = pointerDriverOutsideThePage();
  const doc = new EventTarget();
  const heard = [];
  const driver = createDriver(doc, [
    { id: 'palette', start: (event, press) => (press.site === 'palette' ? recordingSession('palette', heard, { mouse: true, cancelOnPointerCancel: true }) : null) },
    { id: 'move', start: (event, press) => (press.site === 'hitbox' ? recordingSession('move', heard) : null) },
  ]);

  driver.press(pointerEvent('pointerdown'), { site: 'palette' });
  doc.dispatchEvent(pointerEvent('mousemove', 1));
  doc.dispatchEvent(pointerEvent('mouseup', 2));
  driver.press(pointerEvent('pointerdown'), { site: 'palette' });
  driver.press(pointerEvent('pointerdown'), { site: 'hitbox' });
  doc.dispatchEvent(pointerEvent('pointercancel'));
  doc.dispatchEvent(pointerEvent('pointerup', 3));

  assert.deepEqual(heard, [
    'palette move mousemove 1', 'palette end mouseup 2',
    // As at stage R0, a pointer cancel ends the palette drag; a move runs on until a release.
    'palette cancel pointercancel', 'move end pointerup 3',
  ]);
});

test('a session of the slot another one holds replaces it, as a new drag overwrote R0\'s drag state, and cancel(id) cancels a running session', () => {
  const createDriver = pointerDriverOutsideThePage();
  const doc = new EventTarget();
  const heard = [];
  let next = 0;
  const driver = createDriver(doc, [{ id: 'move', start: () => recordingSession(`move${(next += 1)}`, heard, { slot: 'drag' }) }]);

  driver.press(pointerEvent('pointerdown'), {});
  driver.press(pointerEvent('pointerdown'), {});
  doc.dispatchEvent(pointerEvent('pointermove', 4));
  const cancelled = driver.cancel('move');
  doc.dispatchEvent(pointerEvent('pointerup', 5));

  assert.deepEqual(heard, ['move2 move pointermove 4', 'move2 cancel by id']);
  assert.equal(cancelled, true);
  assert.equal(driver.running('move'), null);
  assert.equal(driver.cancel('move'), false, 'nothing runs to cancel');
});

test('running(id) names a session while its end runs, so a reader during the drop still finds the drag', () => {
  const createDriver = pointerDriverOutsideThePage();
  const doc = new EventTarget();
  let seenDuringEnd = 'not ended';
  let driver = null;
  const session = { move() {}, cancel() {}, end() { seenDuringEnd = driver.running('move'); } };
  driver = createDriver(doc, [{ id: 'move', start: () => session }]);

  driver.press(pointerEvent('pointerdown'), {});
  doc.dispatchEvent(pointerEvent('pointerup'));

  assert.equal(seenDuringEnd, session);
  assert.equal(driver.running('move'), null);
});

// Stage R4 (plan Task 20): static presentation lives in css/tutorial-uml-editor.css as state classes;
// the session sets through the CSSOM only values it computes at run time (a position, a size, a pan
// and zoom transform), and clears such a value with removeProperty.
const SESSION = 'createDiagramEditorSession';

/** `<el>.style.setProperty(<name>, <literal>)` calls inside a node: a literal set that avoids the assignment form. */
function literalSetPropertyCalls(node) {
  const calls = [];
  walk(node, ({ node: call }) => {
    if (call.type !== 'CallExpression' || call.callee.type !== 'MemberExpression' || call.callee.computed) return;
    const styleObject = call.callee.object;
    const isStyle = styleObject.type === 'MemberExpression' && !styleObject.computed && styleObject.property.name === 'style';
    const value = call.arguments[1];
    const isLiteral = value && (value.type === 'StringLiteral' || value.type === 'NumericLiteral'
      || (value.type === 'TemplateLiteral' && value.expressions.length === 0));
    if (isStyle && call.callee.property.name === 'setProperty' && isLiteral) calls.push(`setProperty at line ${call.loc.start.line}`);
  });
  return calls;
}

/** `<el>.style.<property> = <expression>` assignments inside a node whose value is not a literal. */
function computedStyleAssignmentCount(node) {
  let count = 0;
  walk(node, ({ node: assignment }) => {
    if (assignment.type !== 'AssignmentExpression' || assignment.left.type !== 'MemberExpression') return;
    const styleObject = assignment.left.object;
    const isStyle = styleObject.type === 'MemberExpression' && !styleObject.computed && styleObject.property.name === 'style';
    const right = assignment.right;
    const isLiteral = right.type === 'StringLiteral' || right.type === 'NumericLiteral'
      || (right.type === 'TemplateLiteral' && right.expressions.length === 0);
    if (isStyle && !isLiteral) count += 1;
  });
  return count;
}

// Since plan Task 23 most of the session's code is its parts' (PARTS), and the scan reads them too; since plan Task 24
// the session is de-mount.js's.
test('the session assigns style only computed values', () => {
  const session = moduleFunction(SESSION_FILE, SESSION);
  assert.ok(moduleHalf().some((fn) => computedStyleAssignmentCount(fn) > 0),
    'the session and its parts still set computed values (a position, a transform), so the scan below looks at their code');

  const describe = (where) => (entry) => `${entry.key}: ${entry.target}.style.${entry.property} = ${JSON.stringify(entry.value)} (${where} line ${entry.line})`;
  const literalSets = literalStyleAssignments(partAst(SESSION_FILE), { within: SESSION }).map(describe(SESSION_FILE))
    .concat(literalSetPropertyCalls(session))
    .concat(...Object.values(PARTS).map(([file, factory]) => literalStyleAssignments(partAst(file), { within: factory }).map(describe(file))
      .concat(literalSetPropertyCalls(partFactory([file, factory])))));

  assert.deepEqual(literalSets, [], 'each static style belongs to a state class in css/tutorial-uml-editor.css');
});
