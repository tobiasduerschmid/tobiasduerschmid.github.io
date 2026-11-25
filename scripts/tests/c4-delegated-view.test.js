'use strict';

// The renderer's seam for delegated UML views (UML-view editing spec §6, §7.1): `ArchUMLC4Render.renderDelegatedView`
// draws the ArchUML text `toUml` writes for a code, dynamic, deployment, or interfaces view, with the view's layout
// entry as its layout block, and returns that text with its ids and source map. A stored bend whose line no longer
// joins its two boxes is left out and listed. `render` (the embedded figure) and the static prerender draw through it,
// so static equals live (decision RR-8) for pinned views too.
//
// The model is the reference model with interfaces. Its pinned layout keeps positions in `code of policy`, in
// `deployment production` (its top-level nodes), and in `interfaces of api`, where the consumer `web` is pinned below
// the subject `api`; a lifeline order in `dynamic enroll`; and one bend each in the code and deployment views, laid
// along the line the renderer draws so that both its ends lie on their boxes.
//
// Positions are top-left corners in the coordinates a renderer lays its diagram out in: every ArchUML drawing puts
// the diagram in one group translated to fit its margin (`UMLShared.svgOpen`), so a box is measured in that group.
// Route points are in the drawing's own coordinates, where the renderers stamp and the layout block stores them.
//
// This file also exports its pinned design (also with a bend detached) and its drawing probes, for the C4 cases of
// uml-static-plugin.test.js and for the timing test; its own tests run only when it is the file under test.

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { before, after, test } = require('node:test');

const REPO_ROOT = path.join(__dirname, '../..');
const ARCHUML = path.join(REPO_ROOT, 'js/ArchUML');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ARCHUML, 'c4/manifest.json'), 'utf8'));
const core = require('../../js/ArchUML/c4/c4-core.js');

// The reference model with its interfaces: the Planner Web App uses the Registration API's Enrollment API, and the
// Registration API uses the Billing System's Tuition Charges (C4 spec §4.2, J13).
const INTERFACES_MODEL = fs.readFileSync(path.join(ARCHUML, 'tests/c4/fixtures/course-registration-interfaces.yml'), 'utf8');

/** The UML-notation views of the reference model, one per view type, in the order the tests report them. */
const UML_VIEWS = ['code of policy', 'deployment production', 'dynamic enroll', 'interfaces of api'];
/** The views whose boxes hold positions (spec §4.2). */
const POSITIONED_VIEWS = ['code of policy', 'deployment production', 'interfaces of api'];

// Positions and the lifeline order of spec §4.2's example, fitted to the boxes of this model: the deployment view's
// three top-level nodes side by side; in the interfaces view the consumer below the subject and the provider beside it.
const POSITIONS = {
  'code of policy': { EnrollmentPolicy: [80, 40], EnrollmentRule: [420, 40], PrerequisiteRule: [300, 300], UnitCapRule: [540, 300] },
  'deployment production': { laptop: [40, 40], 'campus-cloud': [440, 40], 'data-centre': [920, 40] },
  'interfaces of api': { api: [60, 40], web: [60, 360], billing: [440, 40] },
};
const LIFELINES = { 'dynamic enroll': ['web', 'policy', 'coordinator', 'seats', 'billing-gateway'] };
// The one line of each view that gets a stored bend.
const BENT_LINES = {
  'code of policy': { from: 'EnrollmentPolicy', to: 'EnrollmentRule', relation: 'collaborator' },
  'deployment production': { from: 'ingress', to: 'api-pod', relation: 'link' },
};
// For each view of BENT_LINES, a move of one pin that takes a box away from an end of the view's bend: EnrollmentRule
// 200 units down in the code view; campus-cloud, the node that holds both ends (ingress and api-pod), 360 units down in
// the deployment view.
const DETACHING_MOVES = {
  'code of policy': { id: 'EnrollmentRule', to: [420, 240] },
  'deployment production': { id: 'campus-cloud', to: [440, 400] },
};

const yamlList = (values) => `[${values.join(', ')}]`;

/**
 * The model with a `layout:` section that keeps `positions` (view selector → id → [x, y]), `lifelines` (view selector →
 * ids), and `routes` (view selector → [{ from, to, relation, points }]).
 */
function withLayout(model, { positions = {}, lifelines = {}, routes = {} }) {
  const views = [...new Set([...Object.keys(positions), ...Object.keys(lifelines), ...Object.keys(routes)])];
  const entries = views.map((view) => {
    const lines = [`  ${view}:`];
    if (positions[view]) {
      lines.push('    positions:', ...Object.entries(positions[view]).map(([id, point]) => `      ${id}: ${yamlList(point)}`));
    }
    if (lifelines[view]) lines.push(`    lifelines: ${yamlList(lifelines[view])}`);
    if (routes[view]) {
      lines.push('    routes:', ...routes[view].map(({ from, to, relation, points }) =>
        `      - {from: ${from}, to: ${to}, relation: ${relation}, points: ${yamlList(points.map(yamlList))}}`));
    }
    return lines.join('\n');
  });
  return `${model.replace(/\n*$/, '\n')}layout:\n${entries.join('\n')}\n`;
}

// ---- The page and what a drawing shows ------------------------------------------------------------------------------


/**
 * Runs in the page. What `svg` shows, in the terms static equals live compares (RR-8): `nodes` and `routes`, the
 * placement attributes of every element box (its layout or bounds hook) and the geometry of every stamped route line,
 * in document order; `boxes`, each layout id's box (`UMLShared.renderedLayoutBox`) in the coordinates the renderer
 * laid the diagram out in (the group `UMLShared.svgOpen` translates to fit the margin); `lines`, every route the bundle
 * collects, with its stamped ends and points in the drawing's coordinates; and `ports`, every ball (a circle) and
 * socket (an arc) of a component diagram. Fills and the viewBox margin are left out, because the renderers bake them
 * differently in the static driver and on a page.
 */
function drawingFacts(svg) {
  const shared = window.UMLShared;
  const attributes = (element, names) => names.map((name) => element.getAttribute(name)).filter((value) => value !== null).join(' ');
  const frame = svg.querySelector(':scope > g');
  const translation = frame && frame.transform.baseVal.consolidate();
  const origin = translation ? { x: translation.matrix.e, y: translation.matrix.f } : { x: 0, y: 0 };
  const hooks = [...svg.querySelectorAll('[data-layout-id], [data-layout-bounds-id]')].filter((node) => !node.closest('defs'));
  const layoutIds = [...new Set(hooks.map((node) => node.getAttribute('data-layout-bounds-id') || node.getAttribute('data-layout-id')))];
  const boxes = {};
  layoutIds.forEach((id) => {
    const box = shared.renderedLayoutBox(svg, id);
    if (box) boxes[id] = { x: box.x - origin.x, y: box.y - origin.y, width: box.width, height: box.height };
  });
  const drawn = (element) => !element.closest('defs');
  return {
    nodes: hooks.map((node) => `${node.getAttribute('data-layout-id') || node.getAttribute('data-layout-bounds-id')}: `
      + attributes(node, ['transform', 'x', 'y', 'width', 'height'])),
    routes: [...svg.querySelectorAll('path[data-layout-route-id], polyline[data-layout-route-id], line[data-layout-route-id]')]
      .map((route) => `${route.getAttribute('data-layout-route-id')}: ${attributes(route, ['d', 'points', 'x1', 'y1', 'x2', 'y2'])}`),
    boxes,
    lines: shared.collectEditableRoutes(svg).map((route) => ({
      id: route.id, source: route.source, target: route.target, points: route.points.map((point) => [point.x, point.y]),
    })),
    ports: [...svg.querySelectorAll('circle, path')].filter(drawn)
      .filter((element) => element.tagName === 'circle' || /A/.test(element.getAttribute('d') || ''))
      .map((element) => (element.tagName === 'circle' ? `ball ${attributes(element, ['cx', 'cy', 'r'])}` : `socket ${element.getAttribute('d')}`)),
  };
}

/**
 * A page with the ArchUML bundle and every C4 script the manifest's `core` and `render` lists name, in order, and the
 * drawing probe `drawingFacts` as `window.drawingFacts`.
 */
async function openRendererPage(browser) {
  const page = await browser.newPage();
  await page.setContent('<!doctype html><html lang="en"><title>C4 delegated view test</title><body></body></html>');
  await page.addScriptTag({ path: path.join(ARCHUML, 'uml-bundle.js') });
  for (const file of MANIFEST.core.concat(MANIFEST.render)) await page.addScriptTag({ path: path.join(ARCHUML, file) });
  await page.addScriptTag({ content: `window.drawingFacts = ${drawingFacts.toString()};` });
  return page;
}

/**
 * Draws view `selector` of `text` in a fresh container of the page, through `renderDelegatedView` (`via: 'seam'`) or
 * through `render` as an embedded figure (`via: 'render'`), and returns the result with the facts of its drawing.
 */
function drawLive(page, text, selector, via = 'seam') {
  return page.evaluate(({ source, viewSelector, path: drawingPath }) => {
    const container = document.createElement('div');
    document.body.append(container);
    const result = drawingPath === 'render'
      ? window.ArchUMLC4Render.render(container, `view: ${viewSelector}\n${source}`)
      : window.ArchUMLC4Render.renderDelegatedView(container, window.ArchUMLC4.project(window.ArchUMLC4.load(source), viewSelector));
    const svg = container.querySelector('.c4-uml-view svg');
    const drawing = { svgText: result.svgText, uml: result.uml, droppedRoutes: result.droppedRoutes, inContainer: svg ? svg.outerHTML : null,
      facts: svg ? window.drawingFacts(svg) : null };
    container.remove();
    return drawing;
  }, { source: text, viewSelector: selector, path: via });
}

/**
 * Lays `markup` (a drawing, a C4 figure body, or a page fragment) into a fresh container of the page and returns the
 * facts of its first drawing that matches `selector`.
 */
function markupFacts(page, markup, selector = 'svg') {
  return page.evaluate(({ html, drawingSelector }) => {
    const container = document.createElement('div');
    document.body.append(container);
    container.innerHTML = html;
    const result = window.drawingFacts(container.querySelector(drawingSelector));
    container.remove();
    return result;
  }, { html: markup, drawingSelector: selector });
}

/** The figures the static prerender driver (js/ArchUML/uml_to_svg.js) draws for `embeds` (`{ id: text }`), as the build does. */
function staticFigures(embeds) {
  const input = Object.fromEntries(Object.entries(embeds).map(([id, text]) => [id, { type: 'c4', text }]));
  return JSON.parse(execFileSync('node', [path.join(ARCHUML, 'uml_to_svg.js')], {
    cwd: REPO_ROOT, input: JSON.stringify(input), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  }));
}

/** The line of `drawing` (as drawLive returns it) that runs from the box of `from` to the box of `to` (model ids). */
function drawnLine(drawing, { from, to }) {
  const aliasOf = Object.fromEntries(Object.entries(drawing.uml.ids).map(([alias, id]) => [id, alias]));
  const line = drawing.facts.lines.find((each) => each.source === aliasOf[from] && each.target === aliasOf[to]);
  assert.ok(line, `a line joins ${from} and ${to} in:\n${drawing.uml.text}`);
  return line;
}

/** A bend along `line`: its two ends as drawn, and one point 20 units to the side of its middle. */
function bendAlong(line) {
  const [start, end] = [line.points[0], line.points[line.points.length - 1]];
  const length = Math.hypot(end[0] - start[0], end[1] - start[1]) || 1;
  const middle = [(start[0] + end[0]) / 2 - (20 * (end[1] - start[1])) / length, (start[1] + end[1]) / 2 + (20 * (end[0] - start[0])) / length];
  return [start, middle, end];
}

/**
 * The reference model with its pinned layout: positions, the lifeline order, and a bend along each line of
 * `BENT_LINES`, whose points are taken from a drawing of the view with its positions (so both ends lie on their boxes).
 */
async function pinnedModel(page) {
  const positioned = withLayout(INTERFACES_MODEL, { positions: POSITIONS, lifelines: LIFELINES });
  const routes = {};
  for (const [view, line] of Object.entries(BENT_LINES)) {
    routes[view] = [{ ...line, points: bendAlong(drawnLine(await drawLive(page, positioned, view), line)) }];
  }
  return withLayout(INTERFACES_MODEL, { positions: POSITIONS, lifelines: LIFELINES, routes });
}

/**
 * `model` (the pinned model) with the pin of DETACHING_MOVES[selector] moved: the bend of BENT_LINES[selector] keeps
 * its stored points, and one of them no longer ends on its box.
 */
function withBendDetached(model, selector) {
  const { id, to } = DETACHING_MOVES[selector];
  const pinLine = (point) => `${id}: ${yamlList(point)}`;
  const moved = model.replace(pinLine(POSITIONS[selector][id]), pinLine(to));
  assert.notEqual(moved, model, `the pin of ${id} in ${selector} is moved`);
  return moved;
}

/** The stored positions of view `selector` in `text`, keyed by the drawing's alias of each id. */
function pinsByAlias(text, selector, uml) {
  const aliasOf = Object.fromEntries(Object.entries(uml.ids).map(([alias, id]) => [id, alias]));
  const layout = core.project(core.load(text), selector).layout;
  return [...layout.positions].map(([id, [x, y]]) => ({ id, alias: aliasOf[id], x, y }));
}

// A drawn box sits on its pin when its top-left corner is the stored point, to a hundredth of a unit: the precision of
// the client rectangles `renderedLayoutBox` measures with.
const PIN_TOLERANCE = 0.01;

/** The pins of `pins` whose box in `facts` does not have its top-left corner on the pin, for the failure message. */
function offPins(facts, pins) {
  return pins.filter(({ alias, x, y }) => {
    const box = facts.boxes[alias];
    return !box || Math.abs(box.x - x) > PIN_TOLERANCE || Math.abs(box.y - y) > PIN_TOLERANCE;
  }).map(({ id, alias, x, y }) => `${id} pinned at (${x}, ${y}) is drawn at ${JSON.stringify(facts.boxes[alias] || null)}`);
}

module.exports = {
  INTERFACES_MODEL, UML_VIEWS, POSITIONED_VIEWS, POSITIONS, BENT_LINES, withLayout, openRendererPage, drawingFacts, drawLive,
  markupFacts, staticFigures, pinnedModel, withBendDetached, pinsByAlias, offPins,
};

if (require.main === module) registerTests();

function registerTests() {
  const { chromium } = require('playwright');
  const { chromiumLaunchOptions } = require('../chromium-launch-options');

  let browser;
  let page;
  let pinned;
  before(async () => {
    browser = await chromium.launch(chromiumLaunchOptions());
    page = await openRendererPage(browser);
    pinned = await pinnedModel(page);
  });
  after(async () => { if (browser) await browser.close(); });

  // A communication path is drawn with its technology alone; its description stays in the text alternative
  // (C4 spec §6.3, c4-render.js `withTechnologyLabels`). The text drawn for every other view is the core's.
  const technologyLabelled = (view) => (view.notation !== 'uml-deployment' ? view : {
    ...view, uml: { ...view.uml, links: view.uml.links.map((link) => ({ ...link, label: link.technology || link.label, technology: null })) },
  });

  UML_VIEWS.forEach((selector) => {
    test(`an unpinned UML view returns the drawn uml with ids and source and no dropped routes (${selector})`, async () => {
      const view = core.project(core.load(INTERFACES_MODEL), selector);
      const expected = core.toUml(technologyLabelled(view));

      const drawing = await drawLive(page, INTERFACES_MODEL, selector);

      assert.equal(drawing.uml.type, expected.type);
      assert.equal(drawing.uml.text, expected.text, 'the text drawn is the view\'s ArchUML text');
      assert.deepEqual(drawing.uml.ids, expected.ids);
      assert.deepEqual(drawing.uml.source, expected.source);
      assert.deepEqual(drawing.droppedRoutes, []);
      assert.equal(drawing.svgText, drawing.inContainer, 'svgText is the drawing in the container');
    });
  });

  test('each pinned box of code of policy has its top-left corner exactly on its pin', async () => {
    const drawing = await drawLive(page, pinned, 'code of policy');
    const pins = pinsByAlias(pinned, 'code of policy', drawing.uml);

    assert.equal(pins.length, 4, 'every class of the view holds a pin');
    assert.deepEqual(offPins(drawing.facts, pins), []);
  });

  Object.entries(BENT_LINES).forEach(([selector, line]) => {
    test(`a stored bend whose two ends lie on their boxes is drawn with its points and not dropped (${selector})`, async () => {
      const bend = core.project(core.load(pinned), selector).layout.routes[0];

      const drawing = await drawLive(page, pinned, selector);

      assert.deepEqual(drawing.droppedRoutes, []);
      assert.deepEqual(drawnLine(drawing, line).points, bend.points, 'the line is drawn through the stored points');
    });
  });

  test('a stored bend whose end left its box is dropped and the drawing has no route with its points', async () => {
    const moved = withBendDetached(pinned, 'code of policy');
    const bend = core.project(core.load(moved), 'code of policy').layout.routes[0];

    const drawing = await drawLive(page, moved, 'code of policy');

    assert.deepEqual(drawing.droppedRoutes, [{ from: 'EnrollmentPolicy', to: 'EnrollmentRule', relation: 'collaborator' }]);
    assert.deepEqual(drawing.facts.lines.filter((each) => JSON.stringify(each.points) === JSON.stringify(bend.points)), [],
      'no drawn line has the stored points');
    assert.doesNotMatch(drawing.uml.text, /^edge "rel:/m, 'the text drawn the second time keeps no bend');
    assert.ok(drawnLine(drawing, BENT_LINES['code of policy']), 'the line itself is still drawn, routed by the renderer');
  });

  // Spec §7.9: a drop draws a view once. A detached bend is left out while the bundle applies the stored routes
  // (`UMLShared.renderSkippingDetachedRoutes`), so its line keeps the renderer's own route in that one drawing.
  Object.entries(BENT_LINES).forEach(([selector, line]) => {
    test(`a view whose stored bend left its box is drawn by the ArchUML renderer once, and the bend is dropped (${selector})`, async () => {
      const moved = withBendDetached(pinned, selector);

      const { bundleDraws, droppedRoutes } = await page.evaluate(([source, viewSelector]) => {
        const view = window.ArchUMLC4.project(window.ArchUMLC4.load(source), viewSelector);
        const renderer = window[{ 'uml-class': 'UMLClassDiagram', 'uml-deployment': 'UMLDeploymentDiagram' }[view.notation]];
        const original = renderer.render;
        let draws = 0;
        renderer.render = function countedRender() { draws += 1; return original.apply(this, arguments); };
        const container = document.createElement('div');
        document.body.append(container);
        try {
          return { droppedRoutes: window.ArchUMLC4Render.renderDelegatedView(container, view).droppedRoutes, bundleDraws: draws };
        } finally {
          renderer.render = original;
          container.remove();
        }
      }, [moved, selector]);

      assert.deepEqual(droppedRoutes, [line]);
      assert.equal(bundleDraws, 1, 'the renderer draws the view once');
    });
  });

  test('the ArchUML renderer applies a stored bend whose line no longer joins its boxes unless the caller opts in to skip it', async () => {
    const moved = withBendDetached(pinned, 'deployment production');
    const view = core.project(core.load(moved), 'deployment production');
    const uml = core.toUml(technologyLabelled(view));
    const bend = view.layout.routes[0].points;

    const drawings = await page.evaluate((text) => {
      const draw = (skipping) => {
        const container = document.createElement('div');
        document.body.append(container);
        const render = () => window.UMLDeploymentDiagram.render(container, text);
        const skipped = skipping ? window.UMLShared.renderSkippingDetachedRoutes(render) : (render(), null);
        const lines = window.drawingFacts(container.querySelector('svg')).lines;
        container.remove();
        return { skipped, lines };
      };
      return { byDefault: draw(false), optedIn: draw(true) };
    }, uml.text);
    const routeId = uml.text.match(/^edge "(rel:\d+)"/m)[1];
    const pointsOf = (drawing) => drawing.lines.find((each) => each.id === routeId).points;

    assert.deepEqual(pointsOf(drawings.byDefault), bend, 'by default the line is drawn through the stored points');
    assert.deepEqual(drawings.optedIn.skipped, [routeId], 'opted in, the renderer reports the bend it left out');
    assert.notDeepEqual(pointsOf(drawings.optedIn), bend, 'opted in, the line keeps the renderer\'s own route');
  });

  test('render() of a pinned model draws the same SVG as renderDelegatedView', async () => {
    const models = { 'the pinned model': pinned, 'the model whose code-view bend is dropped': withBendDetached(pinned, 'code of policy') };
    for (const [name, model] of Object.entries(models)) {
      for (const selector of UML_VIEWS) {
        const embedded = await drawLive(page, model, selector, 'render');
        const seam = await drawLive(page, model, selector, 'seam');
        assert.ok(seam.svgText, `${selector} of ${name} is drawn`);
        assert.equal(embedded.svgText, seam.svgText, `the SVG of ${selector} of ${name}`);
      }
    }
  });

  test('static equals live (RR-8): with pins in code of policy, in deployment production, and in interfaces of api (the consumer web '
    + 'pinned below the subject api), node coordinates and route points are equal on both paths, each pinned box sits exactly on '
    + 'its pin on both paths, and in interfaces of api the balls and sockets sit at the same places on both paths', async () => {
    const figures = staticFigures(Object.fromEntries(POSITIONED_VIEWS.map((selector) => [selector, `view: ${selector}\n${pinned}`])));
    const livePorts = {};
    for (const selector of POSITIONED_VIEWS) {
      const live = await drawLive(page, pinned, selector);
      const prerendered = await markupFacts(page, figures[selector]);
      const pins = pinsByAlias(pinned, selector, live.uml);

      assert.ok(live.facts.nodes.length > 0, `${selector} has layout hooks`);
      assert.deepEqual({ nodes: prerendered.nodes, routes: prerendered.routes }, { nodes: live.facts.nodes, routes: live.facts.routes },
        `node coordinates and route points of ${selector}`);
      assert.deepEqual(offPins(live.facts, pins), [], `the live boxes of ${selector} sit on their pins`);
      assert.deepEqual(offPins(prerendered, pins), [], `the static boxes of ${selector} sit on their pins`);
      assert.deepEqual(prerendered.ports, live.facts.ports, `the balls and sockets of ${selector} sit at the same places`);
      livePorts[selector] = live.facts.ports;
    }
    assert.equal(livePorts['interfaces of api'].length, 4, 'interfaces of api draws two balls and two sockets');
  });
}
