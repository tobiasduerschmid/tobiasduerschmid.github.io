'use strict';

// The text adapter's contents() covers what the renderer draws (UML-view editing spec §3.4, §9.1; plan Task 21).
// The scene matches the drawing against contents(): a box by its layout id, a line by the relation line its route
// names. So every layout id a renderer stamps (`data-layout-id`, or `data-layout-bounds-id` for a class box) must
// have an entry: an element or a fragment of that id, the activation bar `actbar:<line>` that opens on that line, or
// for a relation's label `label:<route id>`, its relation. Every route id that names a line (`rel:<line>`,
// `seqmsg:<line>`) must name a relation line. Ordinal route ids (`edge-<n>`, `usecase:<n>`) name no line: the scene
// resolves them by their drawn ends (spec §3.4), so they and their labels are not looked up here.
//
// Two gaps were there before the text adapter became files (plan Task 21 found them; they are reported, to be fixed
// separately, not in a move): the activity renderer stamps `rel:<line>` on a flow written `--> target` that continues
// from the step before it, and contents() lists no relation for that line; and the class renderer stamps a quoted
// class name with its quotes (`"Line Item"`) while contents() names the element without them. The editor finds both
// another way today (by the line's text, by the box's label). The test names each gap it meets as known, and fails
// on any other uncovered id, and also when a known gap is gone, so the list here is kept true.
// The sources are every @startuml block of the editor's diagram types in SEBook/**/*.md, every EXAMPLES entry of the
// UML editor include, and every start text of the gesture corpus; each is drawn by the bundle in Chromium and read
// by the text adapter's files on that page.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { chromium } = require('playwright');
const { chromiumLaunchOptions } = require('../chromium-launch-options');
const { includeScript, parse, walk } = require('./helpers/uml-editor-script');

const ROOT = path.join(__dirname, '..', '..');
const ARCHUML = path.join(ROOT, 'js', 'ArchUML');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ARCHUML, 'diagram-editor', 'manifest.json'), 'utf8'));
const CORPUS = path.join(ROOT, 'tests', 'fixtures', 'uml-editor-corpus');
const INCLUDE = path.join(ROOT, '_includes', 'uml-editor.html');

// The bundle's renderer of each diagram type the UML editor offers (the include's RENDERERS).
const RENDERERS = {
  class: 'UMLClassDiagram', sequence: 'UMLSequenceDiagram', state: 'UMLStateDiagram', component: 'UMLComponentDiagram',
  deployment: 'UMLDeploymentDiagram', usecase: 'UMLUseCaseDiagram', activity: 'UMLActivityDiagram',
  freeform: 'UMLFreeformDiagram', gitgraph: 'UMLGitGraphDiagram', 'folder-tree': 'UMLFolderTreeDiagram',
  venn: 'UMLVennDiagram', er: 'UMLERDiagram', crc: 'UMLCRCDiagram',
};
// A route id that names the line of its relation: `rel:<line>` and a sequence message's `seqmsg:<line>`; and one
// that numbers the drawn lines in drawing order.
const LINE_ROUTE_ID = /^(?:rel|seqmsg):(\d+)$/;
const ORDINAL_ROUTE_ID = /^(?:edge-|usecase:)\d+$/;

const HTML_ENTITIES = { '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&amp;': '&' };
const unescapeHtml = (text) => text.replace(/&(?:lt|gt|quot|#39|amp);/g, (entity) => HTML_ENTITIES[entity]);

/** Every .md file under `directory`. */
function markdownFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(full);
    return entry.name.endsWith('.md') ? [full] : [];
  });
}

// A block's diagram type, from its fence (```uml-<type> or ```<type>) or its code element's class (diagram-<type>,
// language-uml-<type>), followed by its text up to the block's end.
const BLOCK = /(?:^```(?:uml-)?([\w-]+)[^\n]*\n([\s\S]*?)^```)|(?:<code class="(?:diagram|language-uml)-([\w-]+)">([\s\S]*?)<\/code>)/gm;

/** The @startuml … @enduml blocks of the editor's types in SEBook/**\/*.md: `{ name, type, text }`. */
function sebookSources() {
  return markdownFiles(path.join(ROOT, 'SEBook')).flatMap((file) => {
    const source = fs.readFileSync(file, 'utf8');
    return [...source.matchAll(BLOCK)].flatMap((match) => {
      const type = match[1] || match[3];
      const body = match[1] ? match[2] : unescapeHtml(match[4]);
      const framed = body.match(/^\s*@startuml[\s\S]*?^\s*@enduml/m);
      if (!RENDERERS[type] || !framed) return [];
      return [{ name: `${path.relative(ROOT, file)} (${type})`, type, text: framed[0].trim() }];
    });
  });
}

/** The include's EXAMPLES, one per diagram type, evaluated from the object literal's source. */
function includeExamples() {
  const { code } = includeScript(fs.readFileSync(INCLUDE, 'utf8'));
  let literal = null;
  walk(parse(code), ({ node }) => {
    if (!literal && node.type === 'VariableDeclarator' && node.id.name === 'EXAMPLES') literal = code.slice(node.init.start, node.init.end);
  });
  assert.ok(literal, 'the include declares EXAMPLES');
  const examples = Function(`return (${literal});`)();
  return Object.entries(examples).map(([type, text]) => ({ name: `EXAMPLES.${type}`, type, text }));
}

/** The start text of every corpus gesture that has one. */
function corpusSources() {
  return fs.readdirSync(CORPUS, { withFileTypes: true }).filter((family) => family.isDirectory())
    .flatMap((family) => fs.readdirSync(path.join(CORPUS, family.name)).filter((file) => file.endsWith('.json'))
      .map((file) => JSON.parse(fs.readFileSync(path.join(CORPUS, family.name, file), 'utf8'))))
    .filter((fixture) => typeof fixture.start === 'string' && RENDERERS[fixture.type])
    .map((fixture) => ({ name: `corpus ${fixture.id}`, type: fixture.type, text: fixture.start }));
}

/**
 * In the page: draws each source with its renderer and returns, per source, how many ids it stamped and the ones
 * without a contents() entry (see the top of this file).
 */
function uncoveredInPage({ sources, renderers, lineRouteId, ordinalRouteId }) {
  const read = window.ArchUMLDiagramEditorParts.text.readContents;
  const lineRoute = new RegExp(lineRouteId);
  const ordinalRoute = new RegExp(ordinalRouteId);
  const stampedOf = (container, attribute) => [...container.querySelectorAll(`[${attribute}]`)].map((node) => node.getAttribute(attribute));
  return sources.map(({ name, type, text }) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    try {
      window[renderers[type]].render(container, text);
      const contents = read(text, type, window);
      const boxes = new Set([...contents.elements, ...contents.fragments].map((entry) => entry.id));
      const bars = new Set(contents.activations.map((bar) => `actbar:${bar.startLine}`));
      const relationLines = new Set(contents.relations.map((relation) => relation.line));
      const routeHasEntry = (routeId) => (lineRoute.test(routeId)
        ? relationLines.has(Number(routeId.match(lineRoute)[1]))
        : ordinalRoute.test(routeId));
      const idHasEntry = (id) => boxes.has(id) || bars.has(id) || (id.startsWith('label:') && routeHasEntry(id.slice('label:'.length)));
      const knownGap = (ofType, reading, id) => {
        const line = lineRoute.test(id) ? reading.lines[Number(id.match(lineRoute)[1])] : null;
        if (ofType === 'activity' && line !== null && /^\s*-->/.test(line)) return 'an activity flow that continues from the step before it';
        const quoted = id.match(/^"(.+)"$/);
        if (ofType === 'class' && quoted && boxes.has(quoted[1])) return 'a quoted class name stamped with its quotes';
        return null;
      };
      const ids = [...stampedOf(container, 'data-layout-id'), ...stampedOf(container, 'data-layout-bounds-id')];
      const routes = stampedOf(container, 'data-layout-route-id').filter((routeId) => !ordinalRoute.test(routeId));
      return {
        name,
        stamped: ids.length + routes.length,
        uncovered: [...new Set(ids)].filter((id) => !idHasEntry(id)).concat([...new Set(routes)].filter((routeId) => !routeHasEntry(routeId)))
          .map((id) => ({ id, known: knownGap(type, contents, id) })),
      };
    } finally {
      container.remove();
    }
  });
}

test('every layout id and route line the renderer stamps has a contents entry', async () => {
  const sources = [...sebookSources(), ...includeExamples(), ...corpusSources()];
  assert.ok(sources.some((source) => source.name.startsWith('SEBook/')), 'SEBook blocks are read');
  const browser = await chromium.launch(chromiumLaunchOptions());
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><html><body></body></html>');
    for (const file of ['uml-bundle.js', ...MANIFEST.core, ...MANIFEST.text]) {
      await page.addScriptTag({ path: path.join(ARCHUML, file) });
    }

    const results = await page.evaluate(uncoveredInPage,
      { sources, renderers: RENDERERS, lineRouteId: LINE_ROUTE_ID.source, ordinalRouteId: ORDINAL_ROUTE_ID.source });

    assert.ok(results.reduce((sum, result) => sum + result.stamped, 0) > 1000, 'the drawings stamp layout ids and routes');
    const unknown = results.flatMap((result) => result.uncovered.filter((gap) => !gap.known).map((gap) => `${result.name}: ${gap.id}`));
    assert.deepEqual(unknown, [], 'stamped ids without a contents() entry');
    const known = [...new Set(results.flatMap((result) => result.uncovered.map((gap) => gap.known)).filter(Boolean))].sort();
    assert.deepEqual(known, ['a quoted class name stamped with its quotes', 'an activity flow that continues from the step before it'],
      'the known gaps (see the top of this file) are still there; remove one from this list when it is fixed');
  } finally {
    await browser.close();
  }
});
