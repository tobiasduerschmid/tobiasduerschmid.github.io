'use strict';
/**
 * The UML editor's operation log in the gesture corpus (plan 2026-11-12-c4-uml-view-editing, Task 11;
 * spec 2026-11-12 §3.4, §3.10 stage R1).
 *
 * From stage R1 a write site that is converted reaches the document as one operation of spec §3.4,
 * through the host's write, which calls every listener of `window.UMLEditor.observeOperations` with
 * the operation and the change it made. This module listens during a gesture's steps, checks what was
 * logged against the write-site map (scripts/tests/fixtures/uml-editor-write-sites.json), and stores
 * it in the fixture's `operations`: the one field of a fixture that later stages may write (the
 * evidence seal ignores it), and what the replay of stage R5 applies to the text adapter alone.
 *
 * A logged entry is `{ type, before, operation, after }`: the diagram type, the document before and
 * after the write, and the operation `{ op, revision, …fields, facts, undo: { key } }`.
 */

const fs = require('node:fs');
const { isDeepStrictEqual } = require('node:util');
const { fixturePathOf } = require('./fixtures');

// A page global of the test, never of the editor: the entries the listener collects.
const PAGE_LOG = '__umlCorpusOperationLog';
const SET_DOCUMENT_PREFIX = 'setDocument:';

// What every operation carries besides the fields of its row.
const ENVELOPE = new Set(['op', 'revision', 'facts', 'undo']);

// The scene facts of a layout.reset by its target: a single reset keeps the other boxes where they
// are drawn, and a route is reset by its storage key, an element to its automatic place.
function resetFacts(target) {
  if (target === 'all') return [];
  if (target && target.route) return ['positions', 'storageKey'];
  if (target && target.element) return ['positions', 'automatic'];
  return ['positions'];
}

// The fields and the scene facts each operation's row of spec §3.4 names, as the classic editor's
// commands record them, exactly: `facts(entry)` lists them for one logged entry. Five rows go
// beyond the spec's table (the final reports of plan Tasks 11 to 14 list them for Task 48): a
// deployment move also carries `carried`, the places of what the moved nodes contain;
// lifeline.reorder carries every drawn position; element.duplicate carries `scope`, which
// tells Duplicate on one element from Duplicate on the selection; and element.rename carries
// `part`, which names what its text replaces (an identifier, an action's text, a lifeline's
// head, a note's text, or, after the sequence panel rebuilt a lifeline's line, its references).
// relation.rewire carries `relation` too (plan Task 14): the relation as the Properties form holds it,
// which the rewired line is built from. In a sequence diagram every relation is a message, so a
// relation.add there carries `at`: the line it goes before, or null for the end of the document.
// The sequence family (plan Task 15): fragment.add takes `at` (a palette stub) or `wrap` with the
// new fragment's `guard` (a wrap of selected messages); fragment.move's `at` is a line to go before
// or `{ step }`, one sibling earlier or later; activation.set names the bar it changes as `ref`.
// The raw-source family (plan Task 16) counts lines in the framed document, as the line-model panels
// list them: source.insertLines says whether it frames the document first (`frame`: the panels do,
// a quick-insert button does not), and source.moveLines exchanges its `line` with `swapWith`, as the
// panels' Move buttons do, leaving the lines between them in place.
// A row's `fields` is a list, or a function of the logged entry when the operation has variants.
const ROWS = {
  'layout.setMode': { fields: ['mode'], facts: () => [] },
  'layout.set': {
    fields: ['positions', 'routes'],
    facts: (entry) => (entry.type === 'deployment'
      ? ['positions', 'shiftedRoutes', 'nesting', 'carried']
      : ['positions', 'shiftedRoutes']),
  },
  'layout.reset': { fields: ['target'], facts: (entry) => resetFacts(entry.operation.target) },
  'lifeline.reorder': { fields: ['order'], facts: () => ['positions'] },
  'element.add': { fields: ['tool', 'name', 'into', 'anchor', 'placed'], facts: () => ['at', 'positions'] },
  'lifeline.add': { fields: ['tool', 'name'], facts: () => [] },
  'fragment.add': {
    fields: (entry) => (Object.prototype.hasOwnProperty.call(entry.operation, 'wrap') ? ['operator', 'wrap', 'guard'] : ['operator', 'at']),
    facts: () => [],
  },
  'element.duplicate': { fields: ['refs', 'offset', 'scope'], facts: () => ['positions'] },
  'element.rename': { fields: ['ref', 'text', 'part'], facts: () => [] },
  'element.update': { fields: ['ref', 'changes'], facts: () => [] },
  'member.add': { fields: ['owner', 'list', 'index', 'text'], facts: () => [] },
  'member.update': { fields: ['owner', 'list', 'index', 'text'], facts: () => [] },
  'member.remove': { fields: ['owner', 'list', 'index', 'text'], facts: () => [] },
  'element.remove': { fields: ['ref'], facts: () => [] },
  'selection.remove': { fields: ['elements', 'relations', 'fragments', 'activations'], facts: () => [] },
  'relation.add': { fields: ['tool', 'from', 'to', 'label'], facts: (entry) => (entry.type === 'sequence' ? ['at'] : []) },
  'relation.update': { fields: ['ref', 'changes'], facts: () => [] },
  'relation.rewire': { fields: ['ref', 'end', 'to', 'relation'], facts: () => [] },
  'relation.invert': { fields: ['ref'], facts: () => [] },
  'message.move': { fields: ['ref', 'at'], facts: () => [] },
  'fragment.update': { fields: ['ref', 'operator', 'guard'], facts: () => [] },
  'fragment.addBranch': { fields: ['ref', 'guard'], facts: () => [] },
  'fragment.unwrap': { fields: ['ref'], facts: () => [] },
  'fragment.move': { fields: ['ref', 'at'], facts: () => [] },
  'activation.add': { fields: ['lifeline', 'slots'], facts: () => [] },
  'activation.set': { fields: ['ref', 'lifeline', 'slots'], facts: () => [] },
  'source.replace': { fields: ['text'], facts: () => [] },
  'source.insertLines': { fields: ['lines', 'at', 'frame'], facts: () => [] },
  'source.replaceLines': { fields: ['range', 'lines'], facts: () => [] },
  'source.removeLines': { fields: ['range'], facts: () => [] },
  'source.moveLines': { fields: ['line', 'swapWith'], facts: () => [] },
  'source.replaceDeclaration': { fields: ['ref', 'text'], facts: () => [] },
};

/** As problems: the names of `expected` that `actual` lacks, and the names of `actual` beyond `expected`. */
function nameProblems(at, what, expected, actual) {
  return [
    ...expected.filter((name) => !actual.includes(name)).map((name) => `${at} has no ${what} ${name}`),
    ...actual.filter((name) => !expected.includes(name)).map((name) => `${at} has a ${what} ${name} its row does not name`),
  ];
}

/**
 * The revision token of a text, from its definition (plan, Global Constraints): `r`, the FNV-1a
 * 32-bit hash of its UTF-16 code units in eight lowercase hex digits, `:`, and its length.
 */
function revisionOf(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `r${hash.toString(16).padStart(8, '0')}:${text.length}`;
}

/** The map entries of the converted write sites the gesture reaches whose write becomes an operation. */
function convertedOperationSites(writeSiteMap, gestureId) {
  return writeSiteMap.filter((entry) => entry.status === 'converted'
    && !String(entry.becomes).startsWith(SET_DOCUMENT_PREFIX)
    && entry.gestures.includes(gestureId));
}

function operationsOf(becomes) {
  return Array.isArray(becomes) ? becomes : [becomes];
}

/** Starts collecting, in the page, every operation the editor writes from now on. */
async function startOperationLog(page) {
  await page.evaluate((logName) => {
    const entries = [];
    const stop = window.UMLEditor.observeOperations((operation, change) => {
      entries.push(JSON.parse(JSON.stringify({ type: change.type, before: change.before, operation, after: change.after })));
    });
    window[logName] = { entries, stop };
  }, PAGE_LOG);
}

/** Stops collecting and returns the entries; the log covers one page load. */
async function stopOperationLog(page) {
  return page.evaluate((logName) => {
    const log = window[logName];
    if (!log) throw new Error('the operation log is gone: the page loaded again during the steps');
    log.stop();
    delete window[logName];
    return log.entries;
  }, PAGE_LOG);
}

/** What is wrong with one entry's operation, or an empty list (spec §3.4: exactly its row's fields and scene facts). */
function entryProblems(entry, index, allowed) {
  const { operation } = entry;
  const at = `operation ${index + 1} (${operation && operation.op})`;
  if (!operation || !allowed.has(operation.op)) {
    return [`${at} is none of ${[...allowed].join(', ')}, what the converted write sites the gesture reaches become`];
  }
  const problems = [];
  if (operation.revision !== revisionOf(entry.before)) {
    problems.push(`${at} has revision ${operation.revision}, not ${revisionOf(entry.before)}, the revision of the text it was applied to`);
  }
  if (!operation.undo || !(typeof operation.undo.key === 'string' || operation.undo.key === null)) {
    problems.push(`${at} has no undo: { key } (a coalescing key or null)`);
  }
  const row = ROWS[operation.op];
  if (!row) return [...problems, `${at}: no row of fields and scene facts is known for it in operation-log.js`];
  const fields = Object.keys(operation).filter((key) => !ENVELOPE.has(key));
  const rowFields = typeof row.fields === 'function' ? row.fields(entry) : row.fields;
  problems.push(...nameProblems(at, 'field', rowFields, fields));
  if (!operation.facts || typeof operation.facts !== 'object') return [...problems, `${at} has no facts object`];
  problems.push(...nameProblems(at, 'scene fact', row.facts(entry), Object.keys(operation.facts)));
  return problems;
}

/**
 * What is wrong with the operations a gesture's steps logged, given the converted operation write
 * sites it reaches: each logged operation is one of theirs, with the revision of the text it was
 * applied to and the fields and scene facts of its row, and each of those sites logged one.
 */
function operationLogProblems(entries, sites) {
  const allowed = new Set(sites.flatMap((site) => operationsOf(site.becomes)));
  const problems = entries.flatMap((entry, index) => entryProblems(entry, index, allowed));
  const logged = new Set(entries.map((entry) => entry.operation && entry.operation.op));
  for (const site of sites) {
    if (!operationsOf(site.becomes).some((op) => logged.has(op))) {
      problems.push(`${site.key} (${operationsOf(site.becomes).join(' or ')}) logged no operation`);
    }
  }
  return problems;
}

/** How the logged entries differ from the fixture's recorded `operations`, or null when they are the same. */
function recordedLogDifference(fixture, entries) {
  const recorded = fixture.operations || [];
  if (recorded.length === 0) return 'no operations are recorded for it yet: log them with UML_CORPUS_MODE=log-operations';
  if (recorded.length !== entries.length) return `${entries.length} operations were logged, ${recorded.length} are recorded`;
  const index = entries.findIndex((entry, at) => !isDeepStrictEqual(entry, recorded[at]));
  return index === -1 ? null : `operation ${index + 1} (${entries[index].operation.op}) differs from the recorded one`;
}

/** Writes the entries into the gesture's fixture as its `operations`; every other field stays as recorded. */
function writeOperations(gesture, entries) {
  const file = fixturePathOf(gesture);
  const fixture = JSON.parse(fs.readFileSync(file, 'utf8'));
  fixture.operations = entries;
  fs.writeFileSync(file, `${JSON.stringify(fixture, null, 2)}\n`);
}

module.exports = {
  revisionOf,
  convertedOperationSites,
  startOperationLog,
  stopOperationLog,
  operationLogProblems,
  recordedLogDifference,
  writeOperations,
};
