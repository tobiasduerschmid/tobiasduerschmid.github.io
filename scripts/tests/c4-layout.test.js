'use strict';

// Diagram-quality gates of the C4 layout (spec §6.4, §13 "Renderer tests"): golden views of the reference model,
// a generated 12-element container view, a view with two groups, a view with a boundary landing, and pinned views.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { before, after, test } = require('node:test');
const { chromium } = require('playwright');
const { chromiumLaunchOptions } = require('../chromium-launch-options');

const ARCHUML = path.join(__dirname, '../../js/ArchUML');
const FIXTURES = path.join(ARCHUML, 'tests/c4/fixtures');
const MODELS = path.join(__dirname, '../../_includes/c4-models');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ARCHUML, 'c4/manifest.json'), 'utf8'));
const { GRAPHS } = require(path.join(ARCHUML, 'tests/c4/place-graphs.js'));
const RECORDED_SEEDS = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'place-seeds.json'), 'utf8'));
const { sceneOf, straightBand } = require('./c4-route-metrics.js');

const readModel = (file) => fs.readFileSync(file, 'utf8');
const REFERENCE_MODEL = readModel(path.join(FIXTURES, 'course-registration.yml'));
const TWELVE_ELEMENTS = readModel(path.join(FIXTURES, 'shop.yml'));
const TWO_GROUPS = readModel(path.join(FIXTURES, 'two-groups.yml'));
const BOUNDARY_LANDING = readModel(path.join(FIXTURES, 'boundary-landing.yml'));
const CAMPUS_LANDSCAPE = readModel(path.join(FIXTURES, 'campus-landscape.yml'));
const BOOKING = readModel(path.join(MODELS, 'campus-booking-suggested.yml'));
const STARTER = readModel(path.join(MODELS, 'campus-booking-starter.yml'));
const DBSYS = readModel(path.join(MODELS, 'flaws/database-as-system.yml'));
const UNLABELED = readModel(path.join(MODELS, 'flaws/unlabeled-uses.yml'));
const BACKEND = readModel(path.join(MODELS, 'flaws/backend-box.yml'));
const RIGHT_VIEW = '\nviews:\n  wide:\n    view: containers of registration\n    direction: right\n';

/** The golden views every gate runs on: `[name, model text, selector]`. */
const GOLDEN_VIEWS = [
  ['reference context view', REFERENCE_MODEL, 'context of registration'],
  ['reference container view', REFERENCE_MODEL, 'containers of registration'],
  ['reference component view', REFERENCE_MODEL, 'components of api'],
  ['generated 12-element container view', TWELVE_ELEMENTS, 'containers of shop'],
  ['view with two groups', TWO_GROUPS, 'containers of store'],
  ['view with a boundary landing', BOUNDARY_LANDING, 'containers of registration'],
  ['view with a pinned element', REFERENCE_MODEL, 'containers of registration', [['api', [900, 120]]]],
];

/**
 * The gated views whose boundary labels have no clear place on either label line, by boundary id: the boundary-landing
 * view's narrow registration boundary has an edge landing on its top line and one leaving through its label line.
 */
const BOUNDARY_LABEL_FALLBACKS = { 'view with a boundary landing': ['registration'] };

/**
 * Views gated on placement, on routes through boxes and on labels (routing redesign Tasks 8b-2, 8c-1 and 8c-2).
 * `[name, model text, selector, {pins}]`.
 */
const PLACEMENT_VIEWS = [
  ['campus landscape', CAMPUS_LANDSCAPE, 'landscape'],
  ['booking containers', BOOKING, 'containers of booking'],
  ['booking components', BOOKING, 'components of api'],
  ['booking landscape', BOOKING, 'landscape'],
  ['database-as-system context', DBSYS, 'context of registration'],
  ['flaw: unlabeled uses', UNLABELED, 'containers of registration'],
  ['flaw: backend box', BACKEND, 'containers of registration'],
  ['starter context', STARTER, 'context of booking'],
  ['starter landscape', STARTER, 'landscape'],
  ['container view laid out to the right', REFERENCE_MODEL + RIGHT_VIEW, 'wide'],
  ['booking components, pinned', BOOKING, 'components of api', { pins: [['finder', [1000, 373]], ['catalog', [30, 1129]]] }],
];

let browser;
let page;
before(async () => {
  browser = await chromium.launch(chromiumLaunchOptions());
  page = await browser.newPage();
  await page.setContent('<!doctype html><html lang="en"><title>C4 layout test</title><body></body></html>');
  await page.addScriptTag({ path: path.join(ARCHUML, 'uml-bundle.js') });
  for (const file of MANIFEST.core.concat(MANIFEST.render)) {
    await page.addScriptTag({ path: path.join(ARCHUML, file) });
  }
});
after(async () => { if (browser) await browser.close(); });

/** `{view, layout}`: the projected view (ids and nesting only) and `layoutView`'s result with `pins` applied. */
function layoutOf(text, selector, pins) {
  return page.evaluate(([source, viewSelector, pinList]) => {
    const view = window.ArchUMLC4.project(window.ArchUMLC4.load(source), viewSelector);
    const layout = window.ArchUMLC4Render.layoutView(view, undefined, { pins: new Map(pinList || []) });
    return {
      view: {
        direction: view.direction,
        nodes: view.nodes.map((node) => ({ id: node.id, type: node.type, boundaryId: node.boundaryId })),
        boundaries: view.boundaries.map((boundary) => ({ id: boundary.id, kind: boundary.kind, parentBoundaryId: boundary.parentBoundaryId })),
        edges: view.edges.map((edge) => ({ id: edge.id, sourceId: edge.sourceId, targetId: edge.targetId, labelled: Boolean(edge.description || edge.technology) })),
      },
      layout,
    };
  }, [text, selector, pins]);
}

function overlaps(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function contains(outer, inner) {
  return inner.x >= outer.x && inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
}

/** Whether the segment p–q enters the interior of `box` (Liang–Barsky clipping against the box shrunk by half a unit). */
function segmentEntersBox(p, q, box) {
  const inset = 0.5;
  const left = box.x + inset;
  const right = box.x + box.width - inset;
  const top = box.y + inset;
  const bottom = box.y + box.height - inset;
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  let enter = 0;
  let leave = 1;
  const clips = [[-dx, p.x - left], [dx, right - p.x], [-dy, p.y - top], [dy, bottom - p.y]];
  for (const [direction, distance] of clips) {
    if (direction === 0) {
      if (distance < 0) return false;
      continue;
    }
    const t = distance / direction;
    if (direction < 0) enter = Math.max(enter, t);
    else leave = Math.min(leave, t);
    if (enter > leave) return false;
  }
  return true;
}

function onBorder(point, box) {
  const tolerance = 1;
  const withinX = point.x >= box.x - tolerance && point.x <= box.x + box.width + tolerance;
  const withinY = point.y >= box.y - tolerance && point.y <= box.y + box.height + tolerance;
  const onVertical = Math.abs(point.x - box.x) <= tolerance || Math.abs(point.x - box.x - box.width) <= tolerance;
  const onHorizontal = Math.abs(point.y - box.y) <= tolerance || Math.abs(point.y - box.y - box.height) <= tolerance;
  return withinX && withinY && (onVertical || onHorizontal);
}

/** The id itself plus every boundary around it. */
function selfAndAncestors(view, id) {
  const parentOf = new Map(view.nodes.map((node) => [node.id, node.boundaryId]));
  view.boundaries.forEach((boundary) => parentOf.set(boundary.id, boundary.parentBoundaryId));
  const chain = [];
  for (let current = id; current; current = parentOf.get(current)) chain.push(current);
  return chain;
}

function boxOf(layout, id) {
  return layout.nodes[id] || layout.boundaries[id];
}

function pairs(list) {
  return list.flatMap((first, index) => list.slice(index + 1).map((second) => [first, second]));
}

/** Where a box starts and ends on the flow axis: y for a view laid out down, x for one laid out to the right. */
function flowRange(view, box) {
  return view.direction === 'right' ? [box.x, box.x + box.width] : [box.y, box.y + box.height];
}

// A boundary's label line is its bottom padding (30) with the label (one 26-high line) at its bottom-left; the top
// padding (30) is where the label goes when the edges leaving the boundary leave no span of that line wide enough.
const BOUNDARY_PAD = 30;
const LABEL_LINE_HEIGHT = 26;
// A route nearer than 12 to a label makes the label ambiguous (routing redesign §9.2).
const FOREIGN_ROUTE_CLEARANCE = 12;

function onLabelLine(label, boundary) {
  return label.y >= boundary.y + boundary.height - BOUNDARY_PAD - LABEL_LINE_HEIGHT && label.y + label.height <= boundary.y + boundary.height;
}

function inTopPadding(label, boundary) {
  return label.y >= boundary.y && label.y + label.height <= boundary.y + BOUNDARY_PAD;
}

/** How far `rect` is from the segment p–q: the largest gap on either axis, 0 or less when they touch or cross. */
function distanceToSegment(rect, p, q) {
  const segment = { x: Math.min(p.x, q.x), y: Math.min(p.y, q.y), right: Math.max(p.x, q.x), bottom: Math.max(p.y, q.y) };
  return Math.max(segment.x - (rect.x + rect.width), rect.x - segment.right, segment.y - (rect.y + rect.height), rect.y - segment.bottom);
}

/** `edge id` of every route that comes nearer to `rect` than the foreign-route clearance. */
function routesNear(layout, rect) {
  return layout.edges.filter((route) => route.points.slice(1)
    .some((point, step) => distanceToSegment(rect, route.points[step], point) < FOREIGN_ROUTE_CLEARANCE)).map((route) => route.id);
}

/** The placement gates (spec §6.4, routing redesign §9.2) every gated view must pass. */
function placementGates(name, text, selector, pins) {
  test(`element boxes never overlap (${name})`, async () => {
    const { layout } = await layoutOf(text, selector, pins);
    const overlapping = pairs(Object.entries(layout.nodes))
      .filter(([[, a], [, b]]) => overlaps(a, b))
      .map(([[a], [b]]) => `${a} × ${b}`);
    assert.deepEqual(overlapping, []);
  });

  test(`every element of a boundary lies inside the boundary box (${name})`, async () => {
    const { view, layout } = await layoutOf(text, selector, pins);
    const members = view.nodes.filter((node) => node.boundaryId).map((node) => [node.id, node.boundaryId])
      .concat(view.boundaries.filter((boundary) => boundary.parentBoundaryId).map((boundary) => [boundary.id, boundary.parentBoundaryId]));
    const outside = members.filter(([id, parentId]) => !contains(layout.boundaries[parentId], boxOf(layout, id)))
      .map(([id, parentId]) => `${id} outside ${parentId}`);
    assert.deepEqual(outside, []);
  });

  test(`people are above every other box (${name})`, async () => {
    // "Above" is before on the flow axis: to the left in a view laid out to the right (routing redesign §4.1).
    const { view, layout } = await layoutOf(text, selector, pins);
    const people = view.nodes.filter((node) => node.type === 'person');
    const others = view.nodes.filter((node) => node.type !== 'person');
    const below = people.flatMap((person) => others
      .filter((other) => !(flowRange(view, layout.nodes[person.id])[1] < flowRange(view, layout.nodes[other.id])[0]))
      .map((other) => `${person.id} is not above ${other.id}`));
    assert.deepEqual(below, []);
  });

  test(`every boundary label lies inside its boundary, on its label line or in its top padding, clear of every element box (${name})`, async () => {
    const { layout } = await layoutOf(text, selector, pins);
    const misplaced = layout.boundaryLabels.flatMap((label) => {
      const boundary = layout.boundaries[label.id];
      const problems = Object.entries(layout.nodes).filter(([, node]) => overlaps(label, node)).map(([id]) => `${label.id} label on ${id}`);
      if (!contains(boundary, label) || !(onLabelLine(label, boundary) || inTopPadding(label, boundary))) problems.push(`${label.id} label off its label line and top padding`);
      return problems;
    });
    assert.deepEqual(misplaced, []);
  });

  test(`every boundary label keeps clear of every route, unless its view has no room and the layout marks it a fallback (${name})`, async () => {
    const { layout } = await layoutOf(text, selector, pins);
    const fallbacks = layout.boundaryLabels.filter((label) => label.labelFallback).map((label) => label.id);
    assert.deepEqual(fallbacks, BOUNDARY_LABEL_FALLBACKS[name] || [], 'boundary labels without a clear place');
    const crossed = layout.boundaryLabels.filter((label) => !label.labelFallback)
      .flatMap((label) => routesNear(layout, label).map((edgeId) => `${edgeId} near the ${label.id} label`));
    assert.deepEqual(crossed, []);
  });
}

/** Pinned boxes sit with their top-left corner on the pin, unless the layout marks them pin adjusted (spec §6.4 step 5). */
function pinGate(name, text, selector, pins) {
  test(`pinned elements keep their pins unless marked pin adjusted (${name})`, async () => {
    const { layout } = await layoutOf(text, selector, pins);
    const moved = pins.filter(([id, pin]) => !layout.nodes[id].pinAdjusted && (layout.nodes[id].x !== pin[0] || layout.nodes[id].y !== pin[1]))
      .map(([id]) => `${id} left its pin without being marked`);
    assert.deepEqual(moved, []);
  });
}

/** Every route runs from its source's border to its target's border and enters no box it does not end in or inside. */
function routeThroughBoxGate(name, text, selector, pins) {
  test(`no route passes through a box that is not one of its endpoints or their ancestors (${name})`, async () => {
    const { view, layout } = await layoutOf(text, selector, pins);
    const allIds = view.nodes.map((node) => node.id).concat(view.boundaries.map((boundary) => boundary.id));
    const crossings = [];
    const detached = [];
    layout.edges.forEach((route, index) => {
      const edge = view.edges[index];
      assert.equal(route.id, edge.id);
      const passable = new Set(selfAndAncestors(view, edge.sourceId).concat(selfAndAncestors(view, edge.targetId)));
      if (!onBorder(route.points[0], boxOf(layout, edge.sourceId))) detached.push(`${edge.id} starts off its source`);
      if (!onBorder(route.points.at(-1), boxOf(layout, edge.targetId))) detached.push(`${edge.id} ends off its target`);
      allIds.filter((id) => !passable.has(id)).forEach((id) => {
        const box = boxOf(layout, id);
        if (route.points.slice(1).some((point, step) => segmentEntersBox(route.points[step], point, box))) {
          crossings.push(`${edge.id} through ${id}`);
        }
      });
    });
    assert.deepEqual(detached, [], 'every route runs from its source border to its target border');
    assert.deepEqual(crossings, []);
  });
}

/** Every labelled edge has a label box, and no label lies on an element box, on another label, or on a boundary label. */
function labelGate(name, text, selector, pins) {
  test(`edge labels do not overlap boxes, other labels, or boundary labels (${name})`, async () => {
    const { view, layout } = await layoutOf(text, selector, pins);
    const labels = layout.edges.map((route, index) => [view.edges[index], route.labelBox]);
    labels.forEach(([edge, box]) => {
      if (edge.labelled) assert.ok(box && box.width > 0 && box.height > 0, `${edge.id} has a label box`);
      else assert.equal(box, null, `${edge.id} has no label`);
    });
    const placed = labels.filter(([, box]) => box);
    const onBoxes = placed.flatMap(([edge, box]) => Object.entries(layout.nodes)
      .filter(([, node]) => overlaps(box, node)).map(([id]) => `${edge.id} label on ${id}`));
    const onLabels = pairs(placed).filter(([[, a], [, b]]) => overlaps(a, b))
      .map(([[a], [b]]) => `${a.id} label on ${b.id} label`);
    const onBoundaryLabels = placed.flatMap(([edge, box]) => layout.boundaryLabels
      .filter((label) => overlaps(box, label)).map((label) => `${edge.id} label on the ${label.id} boundary label`));
    assert.deepEqual(onBoxes, []);
    assert.deepEqual(onLabels, []);
    assert.deepEqual(onBoundaryLabels, []);
  });
}

/**
 * The layout ignores the container's width (spec §6.4, routing redesign §7): drawn into a 320 px and a 1400 px
 * container, the view puts every element at the same place and produces the same SVG, byte for byte.
 */
function widthIndependenceGate(name, text, selector, pins) {
  test(`layout ignores container width (${name})`, async () => {
    const source = `view: ${selector}\n${text}`;
    const narrow = await drawingAt(320, source, pins);
    const wide = await drawingAt(1400, source, pins);
    assert.ok(Object.keys(narrow.translations).length > 0, 'the view draws its elements');
    assert.deepEqual(narrow.translations, wide.translations, 'element positions');
    assert.equal(narrow.svg, wide.svg, 'the complete SVG');
  });
}

for (const [name, text, selector, viewOptions = {}] of PLACEMENT_VIEWS) {
  placementGates(name, text, selector, viewOptions.pins);
  routeThroughBoxGate(name, text, selector, viewOptions.pins);
  labelGate(name, text, selector, viewOptions.pins);
  if (viewOptions.pins) pinGate(name, text, selector, viewOptions.pins);
  widthIndependenceGate(name, text, selector, viewOptions.pins);
}

for (const [name, text, selector, pins] of GOLDEN_VIEWS) {
  placementGates(name, text, selector, pins);
  routeThroughBoxGate(name, text, selector, pins);
  labelGate(name, text, selector, pins);
  widthIndependenceGate(name, text, selector, pins);
}

test('people are above the scope boundary and dependencies below it in the reference container view', async () => {
  const { layout } = await layoutOf(REFERENCE_MODEL, 'containers of registration');
  const scope = layout.boundaries.registration;
  const student = layout.nodes.student;
  const billing = layout.nodes.billing;
  assert.ok(student.y + student.height < scope.y, 'the student is above the Course Registration boundary');
  assert.ok(billing.y > scope.y + scope.height, 'the billing system is below the Course Registration boundary');
});

test('groups lie inside the scope boundary', async () => {
  const { view, layout } = await layoutOf(TWO_GROUPS, 'containers of store');
  const groups = view.boundaries.filter((boundary) => boundary.kind === 'group');
  assert.equal(groups.length, 2);
  groups.forEach((group) => assert.ok(contains(layout.boundaries.store, layout.boundaries[group.id]), `${group.id} inside the scope`));
  assert.equal(overlaps(layout.boundaries[groups[0].id], layout.boundaries[groups[1].id]), false, 'the groups do not overlap');
});

test('a pinned element keeps its coordinates and its boundary reaches out to contain it', async () => {
  // The pin lies 400 units beyond the free layout's scope boundary; the boundary stretches to hold the box.
  const free = await layoutOf(REFERENCE_MODEL, 'containers of registration');
  const pin = [free.layout.boundaries.registration.x + free.layout.boundaries.registration.width + 400, free.layout.nodes.api.y];
  const pinned = await layoutOf(REFERENCE_MODEL, 'containers of registration', [['api', pin]]);
  const api = pinned.layout.nodes.api;
  assert.deepEqual([api.x, api.y], pin, 'the pin is the top-left corner of the box');
  assert.equal(api.pinAdjusted, false);
  assert.ok(contains(pinned.layout.boundaries.registration, api), 'the scope boundary contains the pinned box');
});

test('a pinned box that would overlap a box above it moves down by the overlap and is marked pin adjusted', async () => {
  const free = await layoutOf(REFERENCE_MODEL, 'containers of registration');
  const web = free.layout.nodes.web;
  const pins = [['web', [web.x, web.y]], ['api', [web.x + 40, web.y + 30]]];
  const { layout } = await layoutOf(REFERENCE_MODEL, 'containers of registration', pins);
  assert.deepEqual([layout.nodes.web.x, layout.nodes.web.y], [web.x, web.y], 'the upper pinned box stays');
  assert.equal(layout.nodes.web.pinAdjusted, false);
  assert.equal(layout.nodes.api.x, web.x + 40, 'the lower box keeps its horizontal pin');
  assert.ok(layout.nodes.api.y >= web.y + web.height, 'the lower box moves below the upper one');
  assert.ok(layout.nodes.api.y <= web.y + web.height + 40, 'the lower box moves by the overlap, not further');
  assert.equal(layout.nodes.api.pinAdjusted, true);
});

/**
 * Spec §9.2 (drag-first editing; a drop re-routes and never re-ranks): a pin at a new place moves its own box by
 * exactly the drag, and every other element keeps the place it had, so the drop shows on screen relative to its
 * neighbours. Each drag lands where it overlaps no other box, so the settle step has nothing to separate.
 */
const PIN_DRAGS = [
  ['containers of registration', 'student', [300, 0]],
  ['containers of registration', 'web', [-260, 40]],
  ['containers of registration', 'db', [320, 0]],
  ['components of api', 'billing-gateway', [500, 0]],
  ['components of api', 'coordinator', [-400, 0]],
  ['context of registration', 'student', [300, 0]],
];

for (const [selector, id, [dx, dy]] of PIN_DRAGS) {
  test(`pinning ${id} ${dx}, ${dy} away in ${selector} moves only ${id}`, async () => {
    const free = await layoutOf(REFERENCE_MODEL, selector);
    const from = free.layout.nodes[id];
    const pinned = await layoutOf(REFERENCE_MODEL, selector, [[id, [from.x + dx, from.y + dy]]]);
    const moved = pinned.layout.nodes[id];
    assert.deepEqual([moved.x - from.x, moved.y - from.y, moved.pinAdjusted], [dx, dy, false], `${id} moves by the drag`);
    const others = Object.keys(free.layout.nodes).filter((other) => other !== id);
    assert.ok(others.length >= 2, 'the check covers the other elements');
    others.forEach((other) => {
      const before = free.layout.nodes[other];
      const afterDrop = pinned.layout.nodes[other];
      assert.deepEqual([afterDrop.x, afterDrop.y, afterDrop.madeRoom], [before.x, before.y, false], `${other} stays where it was drawn`);
    });
  });
}

/**
 * Drops onto an occupied spot (spec §9.2: a drop lands where it is dropped): the dropped element is drawn on its pin,
 * the element it lands on makes room, above it when the drop covers that element's lower half and below it when the
 * drop covers its upper half, and no two boxes overlap.
 */
const OCCUPIED_DROPS = [
  ['containers of registration', 'db', 'api', 'lower'],
  ['containers of registration', 'web', 'api', 'upper'],
  ['components of api', 'billing-gateway', 'coordinator', 'lower'],
  ['context of registration', 'billing', 'registration', 'upper'],
];

for (const [selector, id, ontoId, half] of OCCUPIED_DROPS) {
  test(`dropping ${id} onto the ${half} half of ${ontoId} in ${selector} draws it on its pin and moves ${ontoId} aside`, async () => {
    const free = await layoutOf(REFERENCE_MODEL, selector);
    const onto = free.layout.nodes[ontoId];
    const pin = [onto.x + 40, half === 'lower' ? onto.y + onto.height / 2 : onto.y - onto.height / 2];
    const { layout } = await layoutOf(REFERENCE_MODEL, selector, [[id, pin]]);
    const dropped = layout.nodes[id];
    const moved = layout.nodes[ontoId];
    assert.deepEqual([dropped.x, dropped.y, dropped.pinAdjusted], pin.concat([false]), `${id} is drawn where it was dropped`);
    assert.equal(moved.x, onto.x, `${ontoId} keeps its place across`);
    assert.equal(moved.madeRoom, true, `${ontoId} is marked as having made room`);
    if (half === 'lower') assert.ok(moved.y + moved.height + 20 <= pin[1], `${ontoId} makes room above ${id}`);
    else assert.ok(moved.y >= pin[1] + dropped.height + 20, `${ontoId} makes room below ${id}`);
    const ids = Object.keys(layout.nodes);
    const overlapping = ids.flatMap((a, index) => ids.slice(index + 1).filter((b) => overlaps(layout.nodes[a], layout.nodes[b])).map((b) => `${a} × ${b}`));
    assert.deepEqual(overlapping, []);
  });
}

test('render() applies the pins the model keeps for the view key', async () => {
  const pinnedText = `${REFERENCE_MODEL}\nlayout:\n  containers of registration:\n    api: [2000, 120]\n`;
  const result = await page.evaluate((text) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    window.ArchUMLC4Render.render(container, `view: containers of registration\n${text}`);
    const translate = (id) => container.querySelector(`[data-layout-id="${id}"]`).getAttribute('transform')
      .match(/translate\(([-\d.]+),([-\d.]+)\)/).slice(1).map(Number);
    const view = window.ArchUMLC4.project(window.ArchUMLC4.load(text), 'containers of registration');
    const layout = window.ArchUMLC4Render.layoutView(view, undefined, { pins: new Map([['api', [2000, 120]]]) });
    container.remove();
    return { drawn: [translate('api'), translate('student')], laidOut: [layout.nodes.api, layout.nodes.student] };
  }, pinnedText);
  const [drawnApi, drawnStudent] = result.drawn;
  const [api, student] = result.laidOut;
  assert.equal(api.x, 2000, 'the pin moves the API far to the right');
  assert.ok(Math.abs((drawnApi[0] - drawnStudent[0]) - (api.x - student.x)) < 0.02);
  assert.ok(Math.abs((drawnApi[1] - drawnStudent[1]) - (api.y - student.y)) < 0.02);
});

test("render() draws with the caller's pins in place of the model's layout entry", async () => {
  // An editor previews a move by passing pins; the model's own `layout:` entry must not win over them.
  const pinnedText = `${REFERENCE_MODEL}\nlayout:\n  containers of registration:\n    api: [2000, 120]\n`;
  const callerPins = [['api', [-900, 700]]];
  const result = await page.evaluate(([text, pins]) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    window.ArchUMLC4Render.render(container, `view: containers of registration\n${text}`, { pins: new Map(pins) });
    const translate = (id) => container.querySelector(`[data-layout-id="${id}"]`).getAttribute('transform')
      .match(/translate\(([-\d.]+),([-\d.]+)\)/).slice(1).map(Number);
    container.remove();
    return [translate('api'), translate('student')];
  }, [pinnedText, callerPins]);
  const { layout } = await layoutOf(pinnedText, 'containers of registration', callerPins);
  const [drawnApi, drawnStudent] = result;
  assert.equal(layout.nodes.api.x, -900, 'the caller pin moves the API far to the left');
  assert.ok(Math.abs((drawnApi[0] - drawnStudent[0]) - (layout.nodes.api.x - layout.nodes.student.x)) < 0.02);
  assert.ok(Math.abs((drawnApi[1] - drawnStudent[1]) - (layout.nodes.api.y - layout.nodes.student.y)) < 0.02);
});

test('renderView marks pin-adjusted nodes on the view model', async () => {
  const free = await layoutOf(REFERENCE_MODEL, 'containers of registration');
  const web = free.layout.nodes.web;
  const marks = await page.evaluate(([source, pins]) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const view = window.ArchUMLC4.project(window.ArchUMLC4.load(source), 'containers of registration');
    window.ArchUMLC4Render.renderView(container, view, { pins: new Map(pins) });
    container.remove();
    return Object.fromEntries(view.nodes.map((node) => [node.id, node.pinAdjusted]));
  }, [REFERENCE_MODEL, [['web', [web.x, web.y]], ['api', [web.x, web.y + 30]]]]);
  assert.deepEqual(marks, { student: false, web: false, api: true, db: false, billing: false });
});

/**
 * What `render()` draws into a container `width` CSS pixels wide, with optional `pins`: each element's translation
 * and the drawing's complete `outerHTML`.
 */
function drawingAt(width, text, pins) {
  return page.evaluate(([containerWidth, source, pinList]) => {
    const container = document.createElement('div');
    container.style.width = `${containerWidth}px`;
    document.body.appendChild(container);
    window.ArchUMLC4Render.render(container, source, pinList ? { pins: new Map(pinList) } : undefined);
    const translations = Object.fromEntries([...container.querySelectorAll('[data-layout-id]')]
      .map((group) => [group.getAttribute('data-layout-id'), group.getAttribute('transform')]));
    const svg = container.querySelector('svg').outerHTML;
    container.remove();
    return { translations, svg };
  }, [width, text, pins || null]);
}

test('direction right puts people left of the scope and dependencies right of it', async () => {
  const { layout } = await layoutOf(REFERENCE_MODEL + RIGHT_VIEW, 'wide');
  const { student, billing } = layout.nodes;
  const scope = layout.boundaries.registration;
  assert.ok(student.x + student.width < scope.x, 'the student is left of the Course Registration boundary');
  assert.ok(billing.x > scope.x + scope.width, 'the billing system is right of the Course Registration boundary');
});

test('every edge of the reference container view is straight-capable', async () => {
  const { view, layout } = await layoutOf(REFERENCE_MODEL, 'containers of registration');
  const scene = sceneOf(view, layout);
  const pairsOfEdges = view.edges.map((edge) => `${edge.sourceId}→${edge.targetId}`);
  assert.deepEqual(pairsOfEdges.slice().sort(), ['api→billing', 'api→db', 'student→web', 'web→api']);
  const bent = view.edges.map((edge) => [`${edge.sourceId}→${edge.targetId}`, straightBand(scene, edge.id)])
    .filter(([, band]) => !(band.overlap >= 88 && band.clear.length > 0))
    .map(([pair, band]) => `${pair}: overlap ${band.overlap}, clear ${JSON.stringify(band.clear)}`);
  assert.deepEqual(bent, []);
});

test('a boundary label slides along its label line past the edges leaving through it, and the boundary does not widen for it', async () => {
  // In the reference component view, edges leave the api boundary where its label would start (15 in from the left
  // border). The label moves along the line instead, and the boundary stays within the width the chapter page
  // prints it at (1140, measured before the routing redesign; §9.3 "no print regression").
  const { layout } = await layoutOf(REFERENCE_MODEL, 'components of api');
  const boundary = layout.boundaries.api;
  const label = layout.boundaryLabels.find((candidate) => candidate.id === 'api');
  assert.ok(onLabelLine(label, boundary), 'the label stays on its label line');
  assert.ok(label.x > boundary.x + BOUNDARY_PAD / 2, `the label starts ${label.x - boundary.x} in from the left border`);
  assert.deepEqual(routesNear(layout, label), []);
  assert.ok(boundary.width <= 1140, `the api boundary is ${boundary.width} wide`);
});

test('a boundary label falls back to the top-left inside its boundary, marked, when neither its label line nor its top padding has a span wide enough', async () => {
  // In the boundary-landing view, an edge leaves the narrow registration boundary through its label line and another
  // lands on its top line. The test first checks, from the routes, that no part of the label line beside the
  // crossings holds the label; the top padding is the same width and is crossed too.
  const { layout } = await layoutOf(BOUNDARY_LANDING, 'containers of registration');
  const boundary = layout.boundaries.registration;
  const label = layout.boundaryLabels.find((candidate) => candidate.id === 'registration');
  const line = [boundary.x + BOUNDARY_PAD / 2, boundary.x + boundary.width - BOUNDARY_PAD / 2];
  const labelRow = { x: line[0], y: boundary.y + boundary.height - BOUNDARY_PAD, width: line[1] - line[0], height: BOUNDARY_PAD };
  const crossingXs = layout.edges.flatMap((route) => route.points.slice(1).filter((point, step) => {
    const from = route.points[step];
    return from.x === point.x && distanceToSegment(labelRow, from, point) < FOREIGN_ROUTE_CLEARANCE;
  }).map((point) => point.x)).sort((a, b) => a - b);
  assert.ok(crossingXs.length > 0, 'a route crosses the bottom padding, where the label line runs');
  const spans = [line[0]].concat(crossingXs.flatMap((x) => [x - FOREIGN_ROUTE_CLEARANCE, x + FOREIGN_ROUTE_CLEARANCE]), [line[1]]);
  const widest = Math.max(...spans.filter((_, index) => index % 2 === 0).map((start, index) => spans[2 * index + 1] - start));
  assert.ok(widest < label.width, `a ${widest}-wide part of the line would hold the ${label.width}-wide label`);
  assert.ok(inTopPadding(label, boundary), `the label is at y ${label.y - boundary.y} inside a ${boundary.height}-high boundary`);
  assert.equal(label.labelFallback, true, 'the layout marks the label as placed without a clear span');
  assert.equal(label.x, boundary.x + BOUNDARY_PAD / 2, 'the label starts at the left, inside the padding');
});

test('members align with their outside partners across the scope boundary', async () => {
  const { layout } = await layoutOf(REFERENCE_MODEL, 'containers of registration');
  const centre = (box) => box.x + box.width / 2;
  assert.equal(centre(layout.nodes.student), centre(layout.nodes.web));
});

test('recorded seeds still match the seed function', async () => {
  const graphs = Object.fromEntries(Object.entries(GRAPHS).map(([graphName, entry]) => [graphName, entry.graph]));
  const seeds = await page.evaluate((all) => Object.fromEntries(Object.entries(all)
    .map(([graphName, graph]) => [graphName, window.ArchUMLC4Render.seedPositions(graph)])), graphs);
  assert.deepEqual(seeds, RECORDED_SEEDS);
});

test('one added element moves unrelated elements by at most 200 units', async () => {
  const withCache = REFERENCE_MODEL
    .replace('              db: {description: writes seat holds to, technology: SQL/TCP}',
      '              db: {description: writes seat holds to, technology: SQL/TCP}\n              cache: reads cached seat counts from')
    .replace('  billing:\n    name: Billing System',
      '      cache:\n        name: Seat Cache\n        kind: database\n        technology: Redis\n        description: Caches seat counts.\n  billing:\n    name: Billing System');
  const before = await layoutOf(REFERENCE_MODEL, 'containers of registration');
  const afterEdit = await layoutOf(withCache, 'containers of registration');
  assert.ok(afterEdit.layout.nodes.cache, 'the edit adds the cache to the view');
  const related = new Set(['cache'].concat(afterEdit.view.edges
    .filter((edge) => edge.sourceId === 'cache' || edge.targetId === 'cache')
    .flatMap((edge) => [edge.sourceId, edge.targetId])));
  const moved = Object.keys(before.layout.nodes).filter((id) => !related.has(id)).map((id) => {
    const a = before.layout.nodes[id];
    const b = afterEdit.layout.nodes[id];
    return [id, Math.hypot(b.x - a.x, b.y - a.y)];
  });
  assert.ok(moved.length >= 3, 'the check covers the unrelated elements');
  assert.deepEqual(moved.filter(([, distance]) => distance > 200), []);
});

test('a 300-character description wraps inside its box at 320 px without overlapping neighbours', async () => {
  const description = 'Decides eligibility and enrolls students atomically while it explains every refusal, '
    + 'records each attempt with its outcome, keeps seat holds consistent across sections, retries transient '
    + 'database failures, and reports tuition charges to billing exactly once per completed enrollment attempt each day.';
  assert.equal(description.length, 300);
  const longName = 'RegistrationApplicationProgrammingInterfaceForEveryCampusTerm';
  const text = 'view: containers of registration\n' + REFERENCE_MODEL
    .replace('Decides eligibility and enrolls students atomically.', description)
    .replace('name: Registration API', `name: ${longName}`);
  const result = await page.evaluate((source) => {
    const container = document.createElement('div');
    container.style.width = '320px';
    document.body.appendChild(container);
    window.ArchUMLC4Render.render(container, source);
    const boxes = [...container.querySelectorAll('[data-layout-id]')].map((group) => {
      const [x, y] = group.getAttribute('transform').match(/translate\(([-\d.]+),([-\d.]+)\)/).slice(1).map(Number);
      const shape = group.firstElementChild.getBBox();
      const outlines = [...group.children].filter((child) => child.tagName !== 'text').map((child) => child.getBBox());
      const outline = outlines.reduce((all, box) => ({
        x: Math.min(all.x, box.x), y: Math.min(all.y, box.y),
        right: Math.max(all.right, box.x + box.width), bottom: Math.max(all.bottom, box.y + box.height),
      }), { x: shape.x, y: shape.y, right: shape.x + shape.width, bottom: shape.y + shape.height });
      const escaping = [...group.querySelectorAll('text')].filter((line) => {
        const box = line.getBBox();
        return box.x < outline.x || box.x + box.width > outline.right || box.y < outline.y || box.y + box.height > outline.bottom;
      }).map((line) => line.textContent);
      return {
        id: group.getAttribute('data-layout-id'),
        lines: group.querySelectorAll('text').length,
        escaping,
        box: { x: x + outline.x, y: y + outline.y, width: outline.right - outline.x, height: outline.bottom - outline.y },
      };
    });
    container.remove();
    return boxes;
  }, text);
  const api = result.find((node) => node.id === 'api');
  assert.ok(api.lines >= 10, 'the name and the description wrap onto many lines');
  assert.deepEqual(result.flatMap((node) => node.escaping.map((line) => `${node.id}: ${line}`)), []);
  const overlapping = pairs(result).filter(([a, b]) => overlaps(a.box, b.box)).map(([a, b]) => `${a.id} × ${b.id}`);
  assert.deepEqual(overlapping, []);
});
