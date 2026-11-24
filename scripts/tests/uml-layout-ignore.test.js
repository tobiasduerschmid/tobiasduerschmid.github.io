'use strict';

// A host may draw its own nodes over a rendered UML diagram: the UML editor's
// hit layer (class uml-pg-edit-layer) and, from the C4 editor, a listbox of
// targets in a group marked data-layout-ignore. The bundle's layout collectors
// must read neither as part of the diagram: no overlay rectangle hides a line
// as a route obstacle, no overlay path becomes an editable route (which would
// also shift the ordinal ids edge-N of the unnamed lines), and dragging a bend
// moves no overlay node lying at the route's end (spec 2026-11-12 §7.2).

const assert = require('node:assert/strict');
const path = require('node:path');
const { before, after, test } = require('node:test');
const { chromium } = require('playwright');
const { chromiumLaunchOptions } = require('../chromium-launch-options');

const BUNDLE = path.join(__dirname, '../../js/ArchUML/uml-bundle.js');
const LAYOUT_IGNORE_GROUP = 'data-layout-ignore=""';
const HIT_LAYER_GROUP = 'class="uml-pg-edit-layer"';

let browser;
before(async () => { browser = await chromium.launch(chromiumLaunchOptions()); });
after(async () => { if (browser) await browser.close(); });

async function withBundle(run) {
  const page = await browser.newPage();
  try {
    await page.setContent('<!doctype html><html lang="en"><title>UML layout overlays</title><body><div id="diagram"></div></body></html>');
    await page.addScriptTag({ path: BUNDLE });
    await run(page);
  } finally {
    await page.close();
  }
}

function svg(body) {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">' + body + '</svg>';
}

// An overlay rectangle over an unnamed line, beside a drawn box over another
// unnamed line. Only the drawn box is an obstacle that hides its line.
function overlayRectOverLine(overlayGroup) {
  return svg(
    '<g ' + overlayGroup + '><rect x="20" y="20" width="300" height="120" fill="#fff" stroke="#000"/></g>' +
    '<line id="line-under-overlay" x1="40" y1="80" x2="280" y2="80" stroke="#000"/>' +
    '<rect x="20" y="180" width="300" height="80" fill="#fff" stroke="#000"/>' +
    '<line id="line-inside-drawn-box" x1="40" y1="220" x2="280" y2="220" stroke="#000"/>'
  );
}

// An overlay path drawn before two unnamed lines, so counting it would number
// the lines edge-1 and edge-2 instead of edge-0 and edge-1.
function overlayPathBeforeLines(overlayGroup) {
  return svg(
    '<g ' + overlayGroup + '><path d="M 10 10 L 390 10" fill="none" stroke="#000"/></g>' +
    '<line id="first-line" x1="20" y1="100" x2="200" y2="100" stroke="#000"/>' +
    '<polyline id="second-line" points="20,200 200,200 200,280" fill="none" stroke="#000"/>'
  );
}

// A route r1 whose last vertical segment is dragged 30 px to the right, which
// moves its end from (150, 150) to (180, 150). Beside the end lie a drawn end
// marker and a drawn label of r1, which follow the end, and an overlay group
// with a "⋯" button and a bend number tagged with r1's id. The bend number is
// reachable by both of moveRouteDecorations' passes: the one for nodes tagged
// with the route's id and the one for small nodes near an end.
const BEND_DRAG = {
  oldPoints: [{ x: 50, y: 50 }, { x: 150, y: 50 }, { x: 150, y: 150 }],
  newPoints: [{ x: 50, y: 50 }, { x: 180, y: 50 }, { x: 180, y: 150 }]
};

function overlayAtRouteEnd(overlayGroup) {
  return svg(
    '<polyline id="route" data-layout-route-id="r1" points="50,50 150,50 150,150" fill="none" stroke="#000"/>' +
    '<circle id="drawn-end-marker" cx="150" cy="158" r="6" fill="#000"/>' +
    '<text id="drawn-end-label" data-layout-route-id="r1" x="153" y="146" font-size="12">1</text>' +
    '<g ' + overlayGroup + '>' +
      '<circle id="overlay-action-button" cx="160" cy="160" r="10" fill="#fff" stroke="#000"/>' +
      '<text id="overlay-action-label" x="160" y="164" font-size="12" text-anchor="middle">⋯</text>' +
      '<text id="overlay-bend-number" data-layout-route-id="r1" x="138" y="146" font-size="12">1</text>' +
    '</g>'
  );
}

const DRAWN_END_NODES = ['drawn-end-marker', 'drawn-end-label'];
const OVERLAY_END_NODES = ['overlay-action-button', 'overlay-action-label', 'overlay-bend-number'];

function editableRoutes(page, markup) {
  return page.evaluate((svgMarkup) => {
    const host = document.getElementById('diagram');
    host.innerHTML = svgMarkup;
    return window.UMLShared.collectEditableRoutes(host.querySelector('svg'))
      .map(route => ({ id: route.id, element: route.element.id }));
  }, markup);
}

// How far each named node moved on screen while the bend was dragged.
function shiftsWhileDraggingBend(page, markup, nodeIds) {
  return page.evaluate(({ svgMarkup, drag, ids }) => {
    const host = document.getElementById('diagram');
    host.innerHTML = svgMarkup;
    const svgEl = host.querySelector('svg');
    const corner = id => {
      const box = document.getElementById(id).getBoundingClientRect();
      return { x: box.x, y: box.y };
    };
    const before = Object.fromEntries(ids.map(id => [id, corner(id)]));
    window.UMLShared.moveRouteDecorations(svgEl, document.getElementById('route'), drag.oldPoints, drag.newPoints);
    const rounded = value => Math.round(value * 100) / 100;
    return Object.fromEntries(ids.map(id => {
      const after = corner(id);
      return [id, { dx: rounded(after.x - before[id].x), dy: rounded(after.y - before[id].y) }];
    }));
  }, { svgMarkup: markup, drag: BEND_DRAG, ids: nodeIds });
}

function shiftsOf(ids, dx, dy) {
  return Object.fromEntries(ids.map(id => [id, { dx, dy }]));
}

async function assertOverlayRectIsNoObstacle(page, overlayGroup) {
  assert.deepEqual(await editableRoutes(page, overlayRectOverLine(overlayGroup)),
    [{ id: 'edge-0', element: 'line-under-overlay' }],
    'the line under the overlay rectangle is an editable route; the line inside the drawn box stays hidden');
}

async function assertOverlayPathIsNoRoute(page, overlayGroup) {
  assert.deepEqual(await editableRoutes(page, overlayPathBeforeLines(overlayGroup)),
    [{ id: 'edge-0', element: 'first-line' }, { id: 'edge-1', element: 'second-line' }],
    'only the drawn lines are routes, numbered from edge-0 in drawing order');
}

async function assertBendDragLeavesOverlayInPlace(page, overlayGroup) {
  const shifts = await shiftsWhileDraggingBend(page, overlayAtRouteEnd(overlayGroup), [...DRAWN_END_NODES, ...OVERLAY_END_NODES]);
  const drawn = Object.fromEntries(DRAWN_END_NODES.map(id => [id, shifts[id]]));
  const overlay = Object.fromEntries(OVERLAY_END_NODES.map(id => [id, shifts[id]]));
  assert.deepEqual(drawn, shiftsOf(DRAWN_END_NODES, 30, 0),
    "the drawn end marker and the route's own label follow the route's end");
  assert.deepEqual(overlay, shiftsOf(OVERLAY_END_NODES, 0, 0),
    'no overlay node at the route end moves');
}

test('a rect inside a data-layout-ignore group is no route obstacle', async () => {
  await withBundle(page => assertOverlayRectIsNoObstacle(page, LAYOUT_IGNORE_GROUP));
});

test('a path inside it is no editable route and the ordinal numbering of unnamed lines does not shift', async () => {
  await withBundle(page => assertOverlayPathIsNoRoute(page, LAYOUT_IGNORE_GROUP));
});

test('moving a bend moves no node of a data-layout-ignore group that lies at the route\'s end', async () => {
  await withBundle(page => assertBendDragLeavesOverlayInPlace(page, LAYOUT_IGNORE_GROUP));
});

test('the hit layer class is still skipped by all four', async (t) => {
  await t.test('a hit-layer rect is no route obstacle', async () => {
    await withBundle(page => assertOverlayRectIsNoObstacle(page, HIT_LAYER_GROUP));
  });
  await t.test('a hit-layer path is no editable route', async () => {
    await withBundle(page => assertOverlayPathIsNoRoute(page, HIT_LAYER_GROUP));
  });
  await t.test('moving a bend moves no hit-layer node at the route end', async () => {
    await withBundle(page => assertBendDragLeavesOverlayInPlace(page, HIT_LAYER_GROUP));
  });
});
