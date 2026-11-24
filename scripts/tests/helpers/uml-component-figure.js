'use strict';

// Rendering, geometry, and measures for tests of the bundle's component renderer. A test brings its own Chromium
// (`playwright`) and component text; nothing here loads a C4 file, so these helpers depend on the bundle alone.

const assert = require('node:assert/strict');
const path = require('node:path');

const BUNDLE = path.join(__dirname, '../../../js/ArchUML/uml-bundle.js');

/** `text` with `from` replaced by `to`; fails when `from` is absent, so a fixture edit cannot silently miss. */
function replaced(text, from, to) {
  assert.ok(text.includes(from), `the model text contains ${from}`);
  return text.replace(from, to);
}

/** Calls `run(page)` on a page of `browser` that has loaded the bundle; the page is closed afterwards. */
async function withBundle(browser, run) {
  const page = await browser.newPage();
  try {
    await page.setContent('<!doctype html><html lang="en"><title>Component renderer</title><body></body></html>');
    await page.addScriptTag({ path: BUNDLE });
    return await run(page);
  } finally { await page.close(); }
}

/**
 * Renders `text` into a container `width` CSS px wide and returns the drawing in SVG user units: component boxes by
 * alias, every text line (italic or not), the symbols of unjoined ports by `component.port` hook, balls, and
 * connector polylines with their endpoint hooks.
 */
async function renderFigure(page, text, width) {
  return page.evaluate(({ source, containerWidth }) => {
    document.body.replaceChildren();
    const container = document.createElement('div');
    container.style.width = `${containerWidth}px`;
    document.body.append(container);
    window.UMLComponentDiagram.render(container, source);
    const svg = container.querySelector('svg');
    const box = (element) => { const b = element.getBBox(); return { x: b.x, y: b.y, width: b.width, height: b.height }; };
    const lineText = (element) => [...element.childNodes].map((node) => node.textContent.trim()).filter(Boolean).join(' ');
    return {
      boxes: [...svg.querySelectorAll('rect.uml-component-box')].map((rect) => ({ id: rect.getAttribute('data-layout-id'), ...box(rect) })),
      texts: [...svg.querySelectorAll('text')].filter((t) => t.textContent.trim()).map((t) => ({
        text: lineText(t),
        italic: getComputedStyle(t).fontStyle === 'italic',
        connectorLabel: t.classList.contains('uml-component-connector-label'),
        ...box(t),
      })),
      portSymbols: [...svg.querySelectorAll('[data-layout-kind="port"]')].map((symbol) => ({
        id: symbol.getAttribute('data-layout-id'), ...box(symbol),
      })),
      balls: [...svg.querySelectorAll('circle')].map((circle) => ({
        x: circle.cx.baseVal.value, y: circle.cy.baseVal.value, r: circle.r.baseVal.value,
      })),
      routes: [...svg.querySelectorAll('polyline[data-route-style="component"]')].map((line) => ({
        source: line.getAttribute('data-layout-source'),
        target: line.getAttribute('data-layout-target'),
        points: [...line.points].map((point) => ({ x: point.x, y: point.y })),
      })),
      readableWidth: svg.style.getPropertyValue('--uml-readable-width'),
    };
  }, { source: text, containerWidth: width });
}

function contains(outer, inner) {
  return inner.x >= outer.x - 0.5 && inner.y >= outer.y - 0.5
    && inner.x + inner.width <= outer.x + outer.width + 0.5 && inner.y + inner.height <= outer.y + outer.height + 0.5;
}

function overlaps(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function boxById(figure, id) {
  const found = figure.boxes.find((entry) => entry.id === id);
  assert.ok(found, `a component box with data-layout-id="${id}" exists in ${JSON.stringify(figure.boxes.map((entry) => entry.id))}`);
  return found;
}

/** Distance from point `p` to rectangle `rect` (0 inside). */
function pointToRect(p, rect) {
  const dx = Math.max(rect.x - p.x, 0, p.x - (rect.x + rect.width));
  const dy = Math.max(rect.y - p.y, 0, p.y - (rect.y + rect.height));
  return Math.hypot(dx, dy);
}

function segmentToRect(a, b, rect) {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2));
  let best = Infinity;
  for (let i = 0; i <= steps; i++) {
    best = Math.min(best, pointToRect({ x: a.x + (b.x - a.x) * i / steps, y: a.y + (b.y - a.y) * i / steps }, rect));
  }
  return best;
}

function routeToRect(points, rect) {
  let best = Infinity;
  for (let i = 1; i < points.length; i++) best = Math.min(best, segmentToRect(points[i - 1], points[i], rect));
  return best;
}

/**
 * The statements of generated component text: header lines (names and «keywords») by component alias, interface
 * names by port alias, and assemblies with their provider, consumer, interface, and label.
 */
function statementsOf(text) {
  const headers = new Set();
  const ports = {};
  let owner = null;
  for (const line of text.split('\n')) {
    const component = line.match(/^component "([^"]*)" as (\w+) <<([^<>]*)>> \{$/);
    if (component) { owner = component[2]; headers.add(component[1]).add(`«${component[3]}»`); continue; }
    const port = line.match(/^ {2}(provide|require) "([^"]*)" as (\w+)$/);
    if (port) ports[port[3]] = { component: owner, name: port[2] };
  }
  const assemblies = text.split('\n').map((line) => line.match(/^(p\d+) --> (r\d+)(?: : (.*))?$/)).filter(Boolean).map((m) => ({
    providerPort: `${ports[m[1]].component}.${m[1]}`, consumerPort: `${ports[m[2]].component}.${m[2]}`,
    provider: ports[m[1]].component, consumer: ports[m[2]].component, interfaceName: ports[m[1]].name, label: m[3] || '',
  }));
  return { headers, assemblies };
}

function routesOf(figure, assembly) {
  const routes = figure.routes.filter((route) => route.source === assembly.providerPort || route.target === assembly.consumerPort);
  assert.ok(routes.length > 0, `the assembly ${assembly.providerPort} → ${assembly.consumerPort} is drawn`);
  return routes;
}

function distanceToAssembly(figure, assembly, rect) {
  return Math.min(...routesOf(figure, assembly).map((route) => routeToRect(route.points, rect)));
}

/** The ball of a joined assembly: the ball nearest the gap between its provider-side and consumer-side routes. */
function ballOf(figure, assembly) {
  const routes = routesOf(figure, assembly);
  const fromProvider = routes.find((route) => route.source === assembly.providerPort);
  const toConsumer = routes.find((route) => route.target === assembly.consumerPort);
  const gap = { x: (fromProvider.points.at(-1).x + toConsumer.points[0].x) / 2, y: (fromProvider.points.at(-1).y + toConsumer.points[0].y) / 2 };
  return figure.balls.reduce((best, ball) => (Math.hypot(ball.x - gap.x, ball.y - gap.y) < Math.hypot(best.x - gap.x, best.y - gap.y) ? ball : best));
}

function nearest(items, distance) {
  return items.reduce((best, item) => (distance(item) < distance(best) ? item : best));
}

/** The ports of `component` in `text`, one per `provide` or `require` line of its block. */
function declaredPortCount(text, component) {
  const block = text.match(new RegExp(`^component .* as ${component} .*\\{\\n((?: {2}.*\\n)*)\\}`, 'm'));
  assert.ok(block, `the text declares ${component}`);
  return block[1].split('\n').filter((line) => /^ {2}(provide|require) /.test(line)).length;
}

/**
 * The ports of the component `box`, one per hook: the height of an unjoined port's drawing (its stick and symbol share
 * one centre line) or of a joined port's connector end, with the side of the box it is on.
 */
function portsOf(figure, box) {
  const hook = new RegExp(`^${box.id}\\.`);
  const ports = new Map();
  for (const symbol of figure.portSymbols.filter((entry) => hook.test(entry.id))) {
    ports.set(symbol.id, { id: symbol.id, x: symbol.x + symbol.width / 2, y: symbol.y + symbol.height / 2 });
  }
  for (const route of figure.routes) {
    if (hook.test(route.source)) ports.set(route.source, { id: route.source, ...route.points[0] });
    if (hook.test(route.target)) ports.set(route.target, { id: route.target, ...route.points.at(-1) });
  }
  return [...ports.values()].map((port) => ({ ...port, side: port.x < box.x + box.width / 2 ? 'left' : 'right' }));
}

module.exports = {
  replaced,
  withBundle,
  renderFigure,
  contains,
  overlaps,
  boxById,
  pointToRect,
  segmentToRect,
  routeToRect,
  statementsOf,
  routesOf,
  distanceToAssembly,
  ballOf,
  nearest,
  declaredPortCount,
  portsOf,
};
