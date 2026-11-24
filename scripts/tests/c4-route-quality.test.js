'use strict';

// Route and label quality gates of the C4 router (routing redesign §5, §6 and §9.2–§9.3,
// docs/superpowers/specs/2026-11-09-c4-routing-redesign.md) on the views of c4-route-views.js: the 17 views of the
// §9.3 table, the pinned booking component view, which carries its own budgets, and generated landscapes (§9.3
// "Generated views"). Every number is computed by the independent metrics module from the view model and
// `layoutView`'s result; the router's own flags are only checked against those numbers. The §8 timing budgets run
// in their own serial lane (timing/c4-route-timing.test.js, `npm run test:timing`).

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { before, after, test } = require('node:test');
const { chromium } = require('playwright');
const { chromiumLaunchOptions } = require('../chromium-launch-options');
const { analyse, sceneOf, straightBand, routeIntersections } = require('./c4-route-metrics.js');
const { VIEWS, PINNED, LARGE_VIEW, GENERATED_VIEWS, generatedLandscape, openC4Page } = require('./c4-route-views.js');
const { fanInBoxes, zeroGateViolations, ratchetDrift } = require('./c4-route-gates.js');

// Generated views that still miss zero gates after one root-caused attempt each (Ruling F1, routing redesign §9.3
// "Findings"). Each is a no-regression ratchet: its listed violations may not grow (a count or a detour may not rise),
// no other violation may appear, and every other gate holds in full. A ratchet is exact (`ratchetDrift`): when a
// listed violation shrinks or disappears the test fails until its pin is lowered or removed. `reason` names the
// structural cause the attempt found; the fix that removes it removes the entry.
const GENERATED_RATCHETS = new Map([
  [3, { reason: 's6 (fan-in 3) takes every head on its top: within 2 bends only s5→s6 reaches another side, and that adds a conflict',
    allowed: ['s6 receives every head on one side'] }],
  [4, { reason: 'p1→s4 and s2→s5 share the strip between System 4 and group 1\'s edge, which the placement budgets for one track',
    allowed: ['closeParallels: 1'] }],
  [6, { reason: "s6→s7's label has no legal place: every place beside its route lies nearer than 12 to another route",
    allowed: ['ambiguousLabels: 1', 's6->s7: fallback route or label'] }],
  [8, { reason: 's4→x2 runs 9 beside s3→x2, and the only way apart crosses once, which ranks above a close parallel',
    allowed: ['crowdedApproaches: 1', 'closeParallels: 1'] }],
  [10, { reason: 'p1→s7 must pass group g1: its only route detours past its cap (fallback) and runs beside s2→x1',
    allowed: ['closeParallels: 1', 'p1->s7: detour 878, cap 752', 'p1->s7: fallback route or label'] }],
]);
// The 40-element view's two fallback routes also take 2 bends above the §9.3 bend budget (76 against 74).
const LARGE_VIEW_RATCHET = {
  reason: 'two long edges around the groups exceed their detour caps, and the crowding they leave costs sides, spacing and labels',
  extraBends: 2,
  allowed: ['avoidableBends: 1', 'ambiguousLabels: 1', 'endSpacingViolations: 1', 'closeParallels: 2', 's18 receives every head on one side',
    'x1 receives every head on one side', 's8->x1: detour 4044, cap 2621.5', 's8->x1: fallback route or label',
    's12->s16: fallback route or label', 's12->s18: fallback route or label'],
};

// A ratchet is exact: what it allows must still occur at the pinned number, so an improvement fails here until the
// pin is lowered or the entry removed, and the pins stay an honest record of what the view still misses.
test('a ratchet fails on a violation beyond it and on a pinned violation that improved or disappeared', () => {
  const allowed = ['closeParallels: 2', 'x1 receives every head on one side', 's8->x1: detour 4044, cap 2621.5'];
  assert.deepEqual(ratchetDrift(allowed, allowed), { beyond: [], improved: [] }, 'the pinned violations exactly');
  assert.deepEqual(ratchetDrift(['closeParallels: 3', 'x1 receives every head on one side', 's8->x1: detour 4100, cap 2621.5', 'touches: 1'], allowed),
    { beyond: ['closeParallels: 3', 's8->x1: detour 4100, cap 2621.5', 'touches: 1'], improved: [] }, 'a regression');
  assert.deepEqual(ratchetDrift(['closeParallels: 1', 's8->x1: detour 4000, cap 2621.5'], allowed),
    { beyond: [], improved: ['closeParallels: 2 is now 1', 'x1 receives every head on one side is gone', 's8->x1: detour 4044, cap 2621.5 is now 4000'] },
    'an improvement');
});

let browser;
let page;
const cache = new Map();

before(async () => {
  browser = await chromium.launch(chromiumLaunchOptions());
  page = await openC4Page(browser);
});
after(async () => { if (browser) await browser.close(); });

/**
 * `{view, layout, routerClasses}` of one view, laid out once per test run: the projected view (ids, names, nesting,
 * direction), `layoutView`'s result, and the router's own `classify` of every edge on the scene the metrics read.
 */
function laidOut(name, text, selector, pins) {
  if (!cache.has(name)) {
    cache.set(name, page.evaluate(([source, viewSelector, pinList]) => {
      const projected = window.ArchUMLC4.project(window.ArchUMLC4.load(source), viewSelector);
      const layout = window.ArchUMLC4Render.layoutView(projected, undefined, { pins: new Map(pinList || []) });
      const view = {
        direction: projected.direction,
        nodes: projected.nodes.map((node) => ({ id: node.id, name: node.name, type: node.type, boundaryId: node.boundaryId })),
        boundaries: projected.boundaries.map((boundary) => ({ id: boundary.id, parentBoundaryId: boundary.parentBoundaryId })),
        edges: projected.edges.map((edge) => ({ id: edge.id, sourceId: edge.sourceId, targetId: edge.targetId })),
      };
      return { view, layout };
    }, [text, selector, pins || null]).then(async (result) => {
      const scene = sceneOf(result.view, result.layout);
      const routerClasses = await page.evaluate((sceneValue) => sceneValue.edges
        .map((edge) => window.ArchUMLC4Route.classify(sceneValue, edge.id)), scene);
      return Object.assign(result, { routerClasses });
    }));
  }
  return cache.get(name);
}

async function analysed(name, text, selector, pins) {
  const result = await laidOut(name, text, selector, pins);
  return Object.assign({ m: analyse(result.view, result.layout) }, result);
}

/**
 * What `renderView` draws for a view, read from its exported SVG text: the tags of styled elements (a `style`
 * attribute or a `<style>` element), the `font-size` of every `<text>`, the fill of every rectangle behind an edge
 * label, and the colour values of `ArchUMLC4Render.PALETTE`.
 */
function svgMarkupOf(text, selector, pins) {
  return page.evaluate(([source, viewSelector, pinList]) => {
    const view = window.ArchUMLC4.project(window.ArchUMLC4.load(source), viewSelector);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const { svgText } = window.ArchUMLC4Render.renderView(container, view, { pins: new Map(pinList || []) });
    container.remove();
    const svg = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    return {
      styled: [...svg.querySelectorAll('[style], style')].map((element) => element.tagName),
      fontSizes: [...svg.querySelectorAll('text')].map((element) => element.getAttribute('font-size')),
      labelFills: [...svg.querySelectorAll('[data-layout-route-id] rect')].map((element) => element.getAttribute('fill')),
      palette: Object.values(window.ArchUMLC4Render.PALETTE),
    };
  }, [text, selector, pins || null]);
}

/** Problems with SVG hygiene (§9.2): styles, a text at another size than 20, a label fill outside the palette. */
function hygieneProblems(markup) {
  return [
    ...markup.styled.map((tag) => `styled <${tag}>`),
    ...markup.fontSizes.filter((size) => size !== '20').map((size) => `text at font-size ${size}`),
    ...markup.labelFills.filter((fill) => !markup.palette.includes(fill)).map((fill) => `label fill ${fill}`),
  ];
}

const CLASS_FIELDS = ['upward', 'sameRank', 'blocked', 'boundaryEntry', 'exempt', 'maxBends', 'detourCap'];

function routeGates(name, text, selector, budget, options = {}) {
  test(`the drawing stays within its size caps (${name})`, async () => {
    const { layout } = await analysed(name, text, selector, options.pins);
    const [maxWidth, maxHeight] = budget.size;
    assert.ok(layout.width <= maxWidth, `width ${layout.width}, cap ${maxWidth}`);
    assert.ok(layout.height <= maxHeight, `height ${layout.height}, cap ${maxHeight}`);
  });

  test(`the SVG has no style attributes, one font size and palette fills (${name})`, async () => {
    const markup = await svgMarkupOf(text, selector, options.pins);
    assert.ok(markup.fontSizes.length > 0 && markup.labelFills.length > 0, 'the drawing has texts and edge labels');
    assert.deepEqual(hygieneProblems(markup), []);
  });

  test(`crossings and bends meet the budget (${name})`, async () => {
    const { m } = await analysed(name, text, selector, options.pins);
    if (budget.crossingsAtMost === undefined) assert.equal(m.summary.crossings, budget.crossings, 'crossings');
    else assert.ok(m.summary.crossings <= budget.crossingsAtMost, `${m.summary.crossings} crossings`);
    assert.ok(m.summary.bends <= budget.bends, `${m.summary.bends} bends, budget ${budget.bends}`);
    assert.equal(m.summary.touches, 0, 'touches');
  });

  test(`bends and detours per edge stay within the limits (${name})`, async () => {
    const { m, routerClasses, layout } = await analysed(name, text, selector, options.pins);
    const overLimit = m.edges.flatMap((edge) => [
      edge.bends > edge.classes.maxBends ? `${edge.id}: ${edge.bends} bends, limit ${edge.classes.maxBends}` : null,
      edge.detour > edge.classes.detourCap ? `${edge.id}: detour ${edge.detour}, cap ${edge.classes.detourCap}` : null,
    ].filter(Boolean));
    assert.deepEqual(overLimit, []);
    assert.ok(m.summary.totalDetour <= budget.detour, `total detour ${m.summary.totalDetour}, budget ${budget.detour}`);
    const disagreements = m.edges.flatMap((edge, index) => CLASS_FIELDS
      .filter((field) => edge.classes[field] !== routerClasses[index][field])
      .map((field) => `${edge.id}.${field}: metrics ${edge.classes[field]}, router ${routerClasses[index][field]}`));
    assert.deepEqual(disagreements, []);
    const reported = layout.edges.map((edge, index) => [edge.id, edge.bends, m.edges[index].bends]).filter(([, a, b]) => a !== b);
    assert.deepEqual(reported, [], 'the router reports the bends the metrics count');
  });

  test(`no avoidable bend (${name})`, async () => {
    const { m } = await analysed(name, text, selector, options.pins);
    assert.deepEqual(m.edges.filter((edge) => edge.avoidableBend).map((edge) => edge.id), []);
  });

  test(`route ends are spread (${name})`, async () => {
    const { m, view } = await analysed(name, text, selector, options.pins);
    const s = m.summary;
    assert.equal(s.endSpacingViolations, 0, 'ends closer than the minimum end gap');
    assert.ok(s.maxEndsPerSide <= 4, `${s.maxEndsPerSide} ends on one side`);
    assert.ok(s.maxHeadsPerSide <= 2, `${s.maxHeadsPerSide} heads on one side`);
    (budget.sidesUsed || []).forEach((boxName) => {
      const node = view.nodes.find((candidate) => candidate.name === boxName);
      assert.ok(node, `the view shows ${boxName}`);
      const sides = Object.keys(s.headSides[node.id] || {});
      assert.ok(sides.length >= 2, `${boxName} receives heads on ${sides.join(', ') || 'no side'}`);
    });
    assert.equal(s.crowdedApproaches, 0, 'crowded approaches');
    assert.equal(s.overEnds, 0, 'routes over an arrow tip or tail');
    assert.equal(s.shortApproaches, 0, 'last segments shorter than 30');
  });

  test(`edges respect boundaries (${name})`, async () => {
    const { m } = await analysed(name, text, selector, options.pins);
    assert.equal(m.summary.boundaryHugging, 0, 'segments along a boundary line');
    assert.equal(m.summary.excessBoundaryCrossings, 0, 'extra boundary crossings');
  });

  test(`routes stay apart (${name})`, async () => {
    const { m } = await analysed(name, text, selector, options.pins);
    assert.equal(m.summary.closeParallels, 0);
  });

  test(`no fallback route (${name})`, async () => {
    const { layout } = await analysed(name, text, selector, options.pins);
    assert.deepEqual(layout.edges.filter((edge) => edge.fallbackRoute !== false).map((edge) => edge.id), []);
    assert.equal(layout.routeStats.fallbackRoutes, 0);
  });

  test(`labels name their own edge (${name})`, async () => {
    const { m, layout } = await analysed(name, text, selector, options.pins);
    const labelProblems = (edge) => [
      edge.detachedLabel ? `${edge.id}: label ${edge.labelDistance} from its own route` : null,
      edge.ambiguousLabel ? `${edge.id}: label nearer than 12 to another route` : null,
      edge.labelOverlaps ? `${edge.id}: label on ${edge.labelOverlaps} boxes, labels or outlines` : null,
    ].filter(Boolean);
    assert.deepEqual(m.edges.flatMap(labelProblems), []);
    assert.deepEqual(layout.edges.filter((edge) => edge.labelFallback !== false).map((edge) => edge.id), [], 'label fallbacks');
    assert.equal(layout.routeStats.labelFallbacks, 0);
  });
}

VIEWS.forEach(([name, text, selector, budget]) => routeGates(name, text, selector, budget));
routeGates(PINNED[0], PINNED[1], PINNED[2], PINNED[3], PINNED[4]);

test('the views together need at most 42 bends and at most 1 crossing', async () => {
  let bends = 0;
  let crossings = 0;
  for (const [name, text, selector] of VIEWS) {
    const { m } = await analysed(name, text, selector);
    bends += m.summary.bends;
    crossings += m.summary.crossings;
  }
  // At most 1: the one crossing booking components cannot avoid (see its row in VIEWS).
  assert.ok(crossings <= 1, `${crossings} crossings`);
  assert.ok(bends <= 42, `${bends} bends`);
});

// ---- Generated landscapes (routing redesign §9.3 "Generated views") ---------------------------------------------

/** SHA-256 of the sorted `source>target` list: a generator change that moves any relationship changes it. */
function relationshipChecksum(relationships) {
  const list = relationships.map((relationship) => `${relationship.source}>${relationship.target}`).sort().join('\n');
  return crypto.createHash('sha256').update(list).digest('hex');
}

/**
 * The generated landscape view laid out in `c4Page`: the projected view (with each node's kind and each boundary's
 * kind), `layoutView`'s result, the placement that result was drawn from, and the scene its routes were found on,
 * which a recording `ArchUMLC4Place` and `ArchUMLC4Route` keep (the last `place` and `route` calls of a layout are
 * the ones its result comes from).
 */
function laidOutLandscape(c4Page, text) {
  return c4Page.evaluate((source) => {
    const [placer, router] = [window.ArchUMLC4Place, window.ArchUMLC4Route];
    let placement = null;
    let routedScene = null;
    window.ArchUMLC4Place = Object.assign({}, placer, { place: (graph, options) => (placement = placer.place(graph, options)) });
    window.ArchUMLC4Route = Object.assign({}, router, { route: (scene, options) => router.route(routedScene = scene, options) });
    try {
      const projected = window.ArchUMLC4.project(window.ArchUMLC4.load(source), 'landscape');
      const layout = window.ArchUMLC4Render.layoutView(projected);
      const view = {
        direction: projected.direction,
        nodes: projected.nodes.map((node) => ({ id: node.id, name: node.name, type: node.type, external: node.external, boundaryId: node.boundaryId })),
        boundaries: projected.boundaries.map((boundary) => ({ id: boundary.id, kind: boundary.kind, parentBoundaryId: boundary.parentBoundaryId })),
        edges: projected.edges.map((edge) => ({ id: edge.id, sourceId: edge.sourceId, targetId: edge.targetId })),
      };
      return { view, layout, routedScene, placement: { ranks: placement.ranks, order: placement.order, stats: placement.stats } };
    } finally {
      window.ArchUMLC4Place = placer;
      window.ArchUMLC4Route = router;
    }
  }, text);
}

/** The counts per kind of a projected landscape view. */
function shapeOf(view) {
  return {
    people: view.nodes.filter((node) => node.type === 'person').length,
    internalSystems: view.nodes.filter((node) => node.type === 'system' && !node.external).length,
    externalSystems: view.nodes.filter((node) => node.type === 'system' && node.external).length,
    groups: view.boundaries.filter((boundary) => boundary.kind === 'group').length,
    enterprise: view.boundaries.filter((boundary) => boundary.kind === 'enterprise').length,
    relationships: view.edges.length,
  };
}

const ROOT_LEVEL = 'root';

/**
 * Bounds on the bilayer crossings of a placement, counted from its ranks and order alone (routing redesign §4.4,
 * `stats.layerCrossings`): in every level, each edge runs as a chain through its lane items between consecutive
 * rows, and an end outside the level is a port on the row above or below the level. Two segments between the same
 * rows cross when their ends lie in strictly opposite orders on both rows. Entries of a row compare by their index;
 * two ports compare by the order of their elements where the order ranks them (in one row of a common level); two
 * ports whose elements lie in different rows cannot be ranked by the order, so such a pair can only add to `upper`.
 * Returns `{lower, upper}`.
 */
function layerCrossingBounds(view, placement) {
  const parentOf = new Map();
  view.nodes.forEach((node) => parentOf.set(node.id, node.boundaryId || ROOT_LEVEL));
  view.boundaries.forEach((boundary) => parentOf.set(boundary.id, boundary.parentBoundaryId || ROOT_LEVEL));
  const people = new Set(view.nodes.filter((node) => node.type === 'person').map((node) => node.id));
  const indexInRow = new Map();
  Object.values(placement.order).forEach((rows) => rows.forEach((row) => row.forEach((id, index) => indexInRow.set(id, index))));
  const rank = (id) => placement.ranks[id];
  const ancestry = (id) => {
    const chain = [];
    for (let current = id; current !== ROOT_LEVEL; current = parentOf.get(current)) chain.unshift(current);
    return chain;
  };
  const entryIn = (id, level) => {
    for (let current = id; current !== ROOT_LEVEL; current = parentOf.get(current)) if (parentOf.get(current) === level) return current;
    return null;
  };
  /** The order of two port elements (negative, 0 or positive), or null when the order cannot rank them. */
  const comparePorts = (a, b) => {
    if (a === b) return 0;
    const [first, second] = [ancestry(a), ancestry(b)];
    let depth = 0;
    while (first[depth] === second[depth]) depth++;
    return rank(first[depth]) === rank(second[depth]) ? indexInRow.get(first[depth]) - indexInRow.get(second[depth]) : null;
  };
  const compare = (x, y) => (x.port ? comparePorts(x.port, y.port) : x.index - y.index);
  /** Whether an outside end lies above `level` (routing redesign §4.3: found in the nearest enclosing level holding it). */
  const portAbove = (level, outsideEnd, outsideIsSource) => {
    for (let current = level; ; current = parentOf.get(current)) {
      const outside = entryIn(outsideEnd, parentOf.get(current));
      if (outside === null) continue;
      if (people.has(outside) || rank(outside) < rank(current)) return true;
      if (rank(outside) > rank(current)) return false;
      return outsideIsSource;
    }
  };
  const bounds = { lower: 0, upper: 0 };
  Object.entries(placement.order).forEach(([level, rows]) => {
    const segmentsByRow = new Map();
    const addChain = (edgeId, upper, lower) => {
      const points = [upper];
      for (let row = upper.rank + 1; row < lower.rank; row++) points.push({ rank: row, index: indexInRow.get(`lane:${edgeId}:${level}:${row}`) });
      points.push(lower);
      points.slice(0, -1).forEach((point, at) => {
        if (!segmentsByRow.has(point.rank)) segmentsByRow.set(point.rank, []);
        segmentsByRow.get(point.rank).push([point, points[at + 1]]);
      });
    };
    view.edges.forEach((edge) => {
      const [source, target] = [entryIn(edge.sourceId, level), entryIn(edge.targetId, level)];
      if (source && target) {
        if (rank(source) === rank(target)) return;
        const ends = [source, target].map((id) => ({ rank: rank(id), index: indexInRow.get(id) })).sort((a, b) => a.rank - b.rank);
        addChain(edge.id, ends[0], ends[1]);
      } else if ((source || target) && level !== ROOT_LEVEL) {
        const inside = { rank: rank(source || target), index: indexInRow.get(source || target) };
        const outsideEnd = source ? edge.targetId : edge.sourceId;
        if (portAbove(level, outsideEnd, !source)) addChain(edge.id, { rank: -1, port: outsideEnd }, inside);
        else addChain(edge.id, inside, { rank: rows.length, port: outsideEnd });
      }
    });
    segmentsByRow.forEach((segments) => segments.forEach((first, at) => segments.slice(at + 1).forEach((second) => {
      const [above, below] = [compare(first[0], second[0]), compare(first[1], second[1])];
      if (above === null || below === null) {
        if (above !== 0 && below !== 0) bounds.upper++;
      } else if (above * below < 0) {
        bounds.lower++;
        bounds.upper++;
      }
    })));
  });
  return bounds;
}

/**
 * The §9.3 bend budget of a generated view: 2 for every edge that is not straight-capable at its final positions,
 * plus 2, plus 1 for every box with fan-in ≥ 3, whose second side (the "sides used" gate) can cost a bend (Ruling 21).
 */
function bendBudget(view, layout) {
  const scene = sceneOf(view, layout);
  return scene.edges.reduce((sum, edge) => sum + (straightBand(scene, edge.id).straightCapable ? 0 : 2), 0) + 2 + fanInBoxes(view).length;
}

/** Crossings of the routes of edges `a` and `b` (metrics count; points on a box both end at do not count). */
function crossingsBetween(scene, routes, a, b) {
  const [first, second] = [scene.edges[a], scene.edges[b]];
  const shared = [first.source, first.target].filter((id) => id === second.source || id === second.target).map((id) => scene.boxes[id]);
  return routeIntersections(routes[a], routes[b], shared).crossings;
}

/** Crossings of the routes of edges `a` and `b` with each other and with every other route. */
function crossingsOfPair(scene, routes, [a, b]) {
  return routes.reduce((sum, _, other) => sum + (other === a || other === b ? 0 : crossingsBetween(scene, routes, a, other) + crossingsBetween(scene, routes, b, other)),
    crossingsBetween(scene, routes, a, b));
}

/** Every pair of edges whose routes cross, as index pairs. */
function crossingPairs(scene, routes) {
  return routes.flatMap((_, a) => routes.map((__, b) => [a, b]).filter(([, b]) => b > a && crossingsBetween(scene, routes, a, b) > 0));
}

/**
 * The crossing evidence of a small generated view (§9.4, Ruling 21): for every pair of edges that cross, the router's
 * evidence mode (`exhaustivePairs`, §5.6) re-routes the scene the layout was routed on and searches every
 * combination of the pair's candidates, keeping every other edge on its route, for fewer crossings that break no
 * gate the chosen routes keep. Returns the routes it re-routed to (the layout's, when deterministic) and, per pair,
 * `{pair, routed, fewest}`: the pair's crossings as laid out and in the combination the search reports, both counted
 * by the metrics.
 */
async function crossingEvidence(c4Page, view, layout, routedScene) {
  const scene = sceneOf(view, layout);
  const routes = layout.edges.map((edge) => edge.points);
  const pairs = crossingPairs(scene, routes);
  const searched = await c4Page.evaluate(([sceneValue, idPairs]) => idPairs.map((ids) => {
    const result = window.ArchUMLC4Route.route(sceneValue, { exhaustivePairs: ids });
    return { rerouted: result.edges.map((edge) => edge.points), fewest: result.stats.exhaustive.routes.map((entry) => entry.points) };
  }), [routedScene, pairs.map((pair) => pair.map((index) => scene.edges[index].id))]);
  return {
    rerouted: searched.map((entry) => entry.rerouted),
    pairs: pairs.map((pair, at) => {
      const trial = routes.slice();
      pair.forEach((index, k) => { trial[index] = searched[at].fewest[k]; });
      return { pair: pair.map((index) => scene.edges[index].id).join(' + '), routed: crossingsOfPair(scene, routes, pair), fewest: crossingsOfPair(scene, trial, pair) };
    }),
  };
}

/**
 * The crossing gate of a learner-sized generated view (§9.3, Ruling 21): every pair of edges that cross is checked by
 * the router's exhaustive evidence (`crossingEvidence`), and no pair can cross less without breaking another gate.
 */
async function assertCrossingsAtEvidence(laidOut) {
  const evidence = await crossingEvidence(page, laidOut.view, laidOut.layout, laidOut.routedScene);
  const routes = laidOut.layout.edges.map((edge) => edge.points);
  evidence.rerouted.forEach((rerouted) => assert.deepEqual(rerouted, routes, 'the evidence starts from the routes laid out'));
  assert.deepEqual(evidence.pairs.filter((entry) => entry.routed > entry.fewest), []);
}

/**
 * The crossing gate of the 40-element view, too large for the evidence search (§9.3, Ruling 21): at most the
 * placement's layer crossings plus the crossings on side-port end segments, which the layer count does not model.
 */
function assertCrossingsWithinLayersAndPorts(laidOut, m) {
  const layerCrossings = laidOut.placement.stats.layerCrossings;
  const ports = m.summary.portInducedCrossings;
  assert.ok(m.summary.crossings <= layerCrossings + ports, `${m.summary.crossings} crossings, ${layerCrossings} layer and ${ports} port-induced crossings`);
}

/**
 * Shape, checksum, the zero gates, crossings (by `crossingGate`), bends, people on top and determinism of one
 * generated landscape. A ratchet (`GENERATED_RATCHETS`) gives the violations the zero gates still allow and any
 * bends above the budget.
 */
async function assertGeneratedViewGates(seed, size, expected, crossingGate, { allowed = [], extraBends = 0 } = {}) {
  const generated = generatedLandscape(seed, size);
  const first = await laidOutLandscape(page, generated.text);
  assert.deepEqual(shapeOf(first.view), expected.shape, 'the generated model has the pinned shape');
  assert.equal(relationshipChecksum(generated.relationships), expected.checksum, 'the generated relationships are the pinned ones');
  const bounds = layerCrossingBounds(first.view, first.placement);
  const layerCrossings = first.placement.stats.layerCrossings;
  assert.ok(bounds.lower <= layerCrossings && layerCrossings <= bounds.upper,
    `the placement reports ${layerCrossings} layer crossings; its order allows ${bounds.lower} to ${bounds.upper}`);
  const m = analyse(first.view, first.layout);
  const drift = ratchetDrift(zeroGateViolations(m, first.view, first.layout), allowed);
  assert.deepEqual(drift.beyond, [], 'violations beyond the ratchet');
  assert.deepEqual(drift.improved, [], 'the view improved on its ratchet: lower these pins or remove them');
  await crossingGate(first, m);
  const budget = bendBudget(first.view, first.layout);
  assert.ok(m.summary.bends <= budget + extraBends, `${m.summary.bends} bends, budget ${budget} + ratchet ${extraBends}`);
  assert.equal(Math.max(0, m.summary.bends - budget), extraBends,
    `${m.summary.bends} bends against a budget of ${budget}: the bend ratchet allows ${extraBends} above it; lower it`);
  assert.equal(m.summary.peopleOnTop, true, 'every person is above every other box');
  const second = await laidOutLandscape(page, generated.text);
  assert.deepEqual(second.layout, first.layout, 'a second layout of the same view is identical');
}


GENERATED_VIEWS.forEach(([seed, size, shape, checksum]) => {
  const ratchet = GENERATED_RATCHETS.get(seed);
  const name = ratchet
    ? `generated views keep every gate but a ratchet (seed ${seed}, ${size} elements): ${ratchet.reason}`
    : `generated views keep every zero gate (seed ${seed}, ${size} elements)`;
  test(name, async () => {
    await assertGeneratedViewGates(seed, size, { shape, checksum }, assertCrossingsAtEvidence, ratchet);
  });

  test(`the SVG has no style attributes, one font size and palette fills (generated landscape, seed ${seed})`, async () => {
    const markup = await svgMarkupOf(generatedLandscape(seed, size).text, 'landscape');
    assert.deepEqual(hygieneProblems(markup), []);
  });
});

test(`the 40-element view keeps every gate but a ratchet: ${LARGE_VIEW_RATCHET.reason}`, async () => {
  await assertGeneratedViewGates(LARGE_VIEW.seed, LARGE_VIEW.size, LARGE_VIEW, assertCrossingsWithinLayersAndPorts, LARGE_VIEW_RATCHET);
});

test('the SVG has no style attributes, one font size and palette fills (the 40-element view)', async () => {
  const markup = await svgMarkupOf(generatedLandscape(LARGE_VIEW.seed, LARGE_VIEW.size).text, 'landscape');
  assert.deepEqual(hygieneProblems(markup), []);
});

// ---- Determinism (routing redesign §8) ---------------------------------------------------------------------------

test('the 40-element view draws the same SVG into a 320 px and a 1400 px container', async () => {
  const source = generatedLandscape(LARGE_VIEW.seed, LARGE_VIEW.size).text;
  const [narrow, wide] = await page.evaluate((text) => [320, 1400].map((width) => {
    const container = document.createElement('div');
    container.style.width = `${width}px`;
    document.body.appendChild(container);
    window.ArchUMLC4Render.render(container, `view: landscape\n${text}`);
    const svg = container.querySelector('svg').outerHTML;
    container.remove();
    return svg;
  }), source);
  assert.ok(narrow.includes('data-layout-route-id'), 'the drawing has routes');
  assert.equal(narrow, wide, 'the complete SVG');
});
