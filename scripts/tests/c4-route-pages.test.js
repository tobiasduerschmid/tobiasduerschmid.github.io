'use strict';

// Route quality of every C4-notation figure the learner pages draw (final review I3): the chapter's inline fences
// and shared-model views, the quiz figures, the tutorial figures, and the figures of the ArchUML reference page,
// read from their sources (c4-page-figures.js).
// The 17 gated views of c4-route-quality.test.js are shared models and fixtures; these are the figures learners
// see. Each one meets every zero gate of routing redesign §9.2, with at most two arrow tips on one box side and
// no crossing, unless CROSSINGS names it with its structural reason. Delegated UML views (code, dynamic,
// deployment, interfaces) and interface cards are not drawn by the C4 router and are left out.

const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const { chromium } = require('playwright');
const { chromiumLaunchOptions } = require('../chromium-launch-options');
const core = require('../../js/ArchUML/c4/c4-core.js');
const { analyse } = require('./c4-route-metrics.js');
const { openC4Page } = require('./c4-route-views.js');
const { zeroGateViolations } = require('./c4-route-gates.js');
const { learnerFigures } = require('./c4-page-figures.js');

/**
 * Crossings a figure keeps because no drawing avoids them, by the model and view it draws, with the reason (routing
 * redesign §9.4: an exhaustive search or a planarity argument).
 */
const CROSSINGS = new Map([
  // Routing redesign §9.3 note ³ (the gated "booking components" row): member–member edges stay inside the boundary,
  // so a crossing-free drawing admits a virtual edge app–db outside it, and the graph then holds a subdivision of
  // K3,3 ({app, ledger, catalog} × {coordinator, finder, db}, catalog–coordinator via permissions).
  ['campus-booking-suggested: components of api', { crossings: 1 }],
]);

const selectorOf = (text) => core.extractEmbed(text).selector || core.defaultView(core.load(text));
const FIGURES = learnerFigures(selectorOf).filter((figure) => core.project(core.load(figure.text), figure.selector).notation === 'c4');

let browser;
let page;
before(async () => {
  browser = await chromium.launch(chromiumLaunchOptions());
  page = await openC4Page(browser);
});
after(async () => { if (browser) await browser.close(); });

/** `{view, layout}` of a figure: the projected view (ids, names, nesting) and `layoutView`'s result. */
function laidOut(text, selector) {
  return page.evaluate(([source, viewSelector]) => {
    const projected = window.ArchUMLC4.project(window.ArchUMLC4.load(source), viewSelector);
    const layout = window.ArchUMLC4Render.layoutView(projected);
    const view = {
      direction: projected.direction,
      nodes: projected.nodes.map((node) => ({ id: node.id, name: node.name, type: node.type, boundaryId: node.boundaryId })),
      boundaries: projected.boundaries.map((boundary) => ({ id: boundary.id, parentBoundaryId: boundary.parentBoundaryId })),
      edges: projected.edges.map((edge) => ({ id: edge.id, sourceId: edge.sourceId, targetId: edge.targetId })),
    };
    return { view, layout };
  }, [text, selector]);
}

test('the learner pages draw C4-notation figures from every kind of source', () => {
  const kindOf = (where) => ({ SEBook: 'page', js: 'reference' }[where.split('/')[0]] || where.split('/')[1]);
  const kinds = new Set(FIGURES.map((figure) => kindOf(figure.where)));
  assert.deepEqual([...kinds].sort(), ['page', 'quizzes', 'reference', 'tutorials'], 'pages, quizzes, tutorials, and the reference all hold figures');
});

for (const figure of FIGURES) {
  test(`${figure.where} (${figure.selector}) is drawn without crossings and meets every zero gate`, async () => {
    const { view, layout } = await laidOut(figure.text, figure.selector);
    const m = analyse(view, layout);
    const allowed = CROSSINGS.has(figure.drawing) ? CROSSINGS.get(figure.drawing).crossings : 0;
    assert.ok(m.summary.crossings <= allowed, `${m.summary.crossings} crossings`);
    assert.deepEqual(zeroGateViolations(m, view, layout, { headsPerSide: 2 }), []);
  });
}
