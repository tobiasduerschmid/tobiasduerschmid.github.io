'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { before, after, test } = require('node:test');
const { chromium } = require('playwright');
const { chromiumLaunchOptions } = require('../chromium-launch-options');

const ARCHUML = path.join(__dirname, '../../js/ArchUML');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ARCHUML, 'c4/manifest.json'), 'utf8'));
const REFERENCE_MODEL = fs.readFileSync(path.join(ARCHUML, 'tests/c4/fixtures/course-registration.yml'), 'utf8');
const CONTAINER_VIEW = 'view: containers of registration\n' + REFERENCE_MODEL;
const FONT_SIZE = 20;

let browser;
before(async () => {
  browser = await chromium.launch(chromiumLaunchOptions());
});
after(async () => { if (browser) await browser.close(); });

/** A page with the ArchUML bundle and every C4 script the manifest lists (core, then render), in order. */
async function withC4(run) {
  const page = await browser.newPage();
  try {
    await page.setContent('<!doctype html><html lang="en"><title>C4 render test</title><body><div id="diagram"></div></body></html>');
    await page.addScriptTag({ path: path.join(ARCHUML, 'uml-bundle.js') });
    for (const file of MANIFEST.core.concat(MANIFEST.render)) {
      await page.addScriptTag({ path: path.join(ARCHUML, file) });
    }
    await run(page);
  } finally {
    await page.close();
  }
}

/** Renders `text` into #diagram and returns the returned svgText. */
function renderInPage(page, text, options) {
  return page.evaluate(([source, renderOptions]) => {
    const container = document.getElementById('diagram');
    return window.ArchUMLC4Render.render(container, source, renderOptions).svgText;
  }, [text, options || {}]);
}

test('the render manifest entry loads after the core in a classic-script context and publishes ArchUMLC4Render', () => {
  assert.deepEqual(MANIFEST.render, [
    'c4/c4-place-frame.js', 'c4/c4-place-ranks.js', 'c4/c4-place-corridors.js', 'c4/c4-place-cross.js', 'c4/c4-place-settle.js',
    'c4/c4-place.js',
    'c4/c4-route-frame.js', 'c4/c4-route-shapes.js', 'c4/c4-route-labels.js', 'c4/c4-route-candidates.js', 'c4/c4-route-costs.js',
    'c4/c4-route-state.js', 'c4/c4-route-pricing.js', 'c4/c4-route-separate.js', 'c4/c4-route-select.js', 'c4/c4-route-growth.js',
    'c4/c4-route-evidence.js', 'c4/c4-route.js',
    'c4/c4-markup.js', 'c4/c4-card.js', 'c4/c4-render.js',
  ]);
  const context = vm.createContext({});
  context.self = context;
  MANIFEST.core.concat(MANIFEST.render).forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(ARCHUML, file), 'utf8'), context, { filename: file });
  });
  assert.equal(vm.runInContext('typeof ArchUMLC4Render.renderView', context), 'function');
  assert.equal(vm.runInContext('typeof ArchUMLC4Render.render', context), 'function');
});

test('the container view of the reference model draws one group per element with hooks', async () => {
  await withC4(async (page) => {
    await renderInPage(page, CONTAINER_VIEW);
    const nodes = await page.evaluate(() => [...document.querySelectorAll('#diagram svg [data-c4-type]')].map((group) => ({
      id: group.getAttribute('data-layout-id'),
      type: group.getAttribute('data-c4-type'),
      kind: group.getAttribute('data-c4-kind'),
      drill: group.getAttribute('data-c4-drill'),
    })));
    assert.deepEqual(nodes.map((node) => node.id).sort(), ['api', 'billing', 'db', 'student', 'web']);
    const byId = Object.fromEntries(nodes.map((node) => [node.id, node]));
    assert.equal(byId.api.drill, 'components of api');
    assert.equal(byId.api.type, 'container');
    assert.equal(byId.web.kind, 'browser_app');
    assert.equal(byId.db.kind, 'database');
    assert.equal(byId.student.type, 'person');
    assert.equal(byId.billing.type, 'system');
    assert.equal(byId.web.drill, null, 'an element without a lower view offers no drill target');
  });
});

test('edges carry source, target, and derived flags', async () => {
  await withC4(async (page) => {
    await renderInPage(page, CONTAINER_VIEW);
    const edges = await page.evaluate(() => [...document.querySelectorAll('#diagram svg [data-c4-source]')].map((group) => ({
      route: group.getAttribute('data-layout-route-id'),
      source: group.getAttribute('data-c4-source'),
      target: group.getAttribute('data-c4-target'),
      derived: group.getAttribute('data-c4-derived'),
      text: [...group.querySelectorAll('text')].map((line) => line.textContent),
    })));
    const pairs = edges.map((edge) => `${edge.source}->${edge.target}`).sort();
    assert.deepEqual(pairs, ['api->billing', 'api->db', 'student->web', 'web->api']);
    const webToApi = edges.find((edge) => edge.source === 'web' && edge.target === 'api');
    assert.equal(webToApi.derived, 'true');
    assert.equal(webToApi.route, 'web->api/sync');
    assert.deepEqual(webToApi.text, ['submits plans to', '[JSON/HTTPS]']);
    assert.equal(edges.find((edge) => edge.source === 'student').derived, 'false');
  });
});

test('asynchronous relationships are dashed and synchronous ones solid', async () => {
  await withC4(async (page) => {
    await renderInPage(page, CONTAINER_VIEW);
    const dashes = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#diagram svg [data-c4-source]')]
      .map((group) => [group.getAttribute('data-c4-target'), group.querySelector('path, polyline, line').getAttribute('stroke-dasharray')])));
    assert.ok(dashes.billing, 'api → billing is a message, drawn dashed');
    assert.equal(dashes.api, null, 'web → api is a call, drawn solid');
  });
});

test('box text shows name, type line, and description at one font size', async () => {
  await withC4(async (page) => {
    await renderInPage(page, CONTAINER_VIEW);
    const result = await page.evaluate(() => {
      const svg = document.querySelector('#diagram svg');
      const api = svg.querySelector('[data-layout-id="api"]');
      const style = (node) => getComputedStyle(node);
      const lines = [...api.querySelectorAll('text')].map((node) => ({
        text: node.textContent, italic: style(node).fontStyle === 'italic', bold: Number(style(node).fontWeight) >= 600,
      }));
      return { fontSizes: [...svg.querySelectorAll('text')].map((node) => style(node).fontSize), lines };
    });
    assert.deepEqual([...new Set(result.fontSizes)], [`${FONT_SIZE}px`]);
    assert.deepEqual(result.lines[0], { text: 'Registration API', italic: false, bold: true });
    assert.deepEqual(result.lines[1], { text: '[Container: Python, FastAPI]', italic: true, bold: false });
    const description = result.lines.slice(2).map((line) => line.text).join(' ');
    assert.equal(description, 'Decides eligibility and enrolls students atomically.');
  });
});

test('box text wraps long names and descriptions inside the box', async () => {
  const longText = REFERENCE_MODEL.replace('Decides eligibility and enrolls students atomically.',
    'Decides eligibility, holds seats, and enrolls students atomically across every section of the plan they submit.');
  await withC4(async (page) => {
    await renderInPage(page, 'view: containers of registration\n' + longText);
    const overflow = await page.evaluate(() => {
      const group = document.querySelector('#diagram svg [data-layout-id="api"]');
      const shape = group.querySelector('rect, path').getBBox();
      return { lines: group.querySelectorAll('text').length, outside: [...group.querySelectorAll('text')].filter((node) => {
        const box = node.getBBox();
        return box.x < shape.x || box.x + box.width > shape.x + shape.width || box.y + box.height > shape.y + shape.height;
      }).map((node) => node.textContent) };
    });
    assert.ok(overflow.lines >= 5, 'the description wraps onto several lines');
    assert.deepEqual(overflow.outside, []);
  });
});

test('annotations of an annotated view add one line per entry at the same font size', async () => {
  const annotated = 'view: styled\n' + REFERENCE_MODEL + '\nviews:\n  styled:\n    view: containers of registration\n    annotations: [styles]\n';
  await withC4(async (page) => {
    await renderInPage(page, annotated);
    const lines = await page.evaluate(() => [...document.querySelectorAll('#diagram svg [data-layout-id="api"] text')]
      .map((node) => ({ text: node.textContent, size: getComputedStyle(node).fontSize })));
    assert.deepEqual(lines.at(-1), { text: 'layers', size: `${FONT_SIZE}px` });
  });
});

test('the legend and title are inside the SVG', async () => {
  await withC4(async (page) => {
    await renderInPage(page, CONTAINER_VIEW);
    const result = await page.evaluate((text) => {
      const view = window.ArchUMLC4.project(window.ArchUMLC4.load(text), 'containers of registration');
      const svg = document.querySelector('#diagram svg');
      const entries = [...svg.querySelectorAll('[data-c4-legend]')].map((entry) => ({
        key: entry.getAttribute('data-c4-legend'),
        text: entry.textContent,
        hasSample: entry.querySelectorAll('rect, path, circle, ellipse, line, polyline').length > 0,
      }));
      return { title: [...svg.querySelectorAll('text')].map((node) => node.textContent), entries, legend: view.legend };
    }, CONTAINER_VIEW);
    assert.ok(result.title.includes('Container view: Course Registration'));
    assert.deepEqual(result.entries.map((entry) => entry.key), result.legend.map((entry) => entry.key));
    result.entries.forEach((entry, index) => {
      assert.equal(entry.text, result.legend[index].label);
      assert.ok(entry.hasSample, `legend entry ${entry.key} shows a sample`);
    });
  });
});

const HOSTILE_NAME = '<img src=x onerror=alert(1)>';
const HOSTILE_DESCRIPTION = 'It\'s O\'Brien\'s "plan" & <b>bold</b>';
const HOSTILE_MODEL = [
  'schema: c4-design/1',
  'name: Hostile',
  'people:',
  '  visitor:',
  `    name: ${JSON.stringify(HOSTILE_NAME)}`,
  `    description: ${JSON.stringify(HOSTILE_DESCRIPTION)}`,
  'view: landscape',
].join('\n');

test('user text cannot inject markup', async () => {
  await withC4(async (page) => {
    await renderInPage(page, HOSTILE_MODEL);
    const result = await page.evaluate(() => {
      const container = document.getElementById('diagram');
      return {
        injected: container.querySelectorAll('img, b, script:not([data-c4-source])').length,
        texts: [...container.querySelectorAll('svg [data-layout-id="visitor"] text')].map((node) => node.textContent),
      };
    });
    assert.equal(result.injected, 0);
    assert.equal(result.texts[0], HOSTILE_NAME);
    assert.ok(result.texts.slice(2).join(' ').includes(HOSTILE_DESCRIPTION));
  });
});

test('the SVG text escaper escapes apostrophes as well as markup characters', () => {
  const { escapeSvgText } = require('../../js/ArchUML/c4/c4-render.js');
  assert.equal(escapeSvgText('<a href=\'x\' title="y">&</a>'), '&lt;a href=&#39;x&#39; title=&quot;y&quot;&gt;&amp;&lt;/a&gt;');
});

test('rendering the same view twice produces identical SVG', async () => {
  await withC4(async (page) => {
    const first = await renderInPage(page, CONTAINER_VIEW);
    const second = await renderInPage(page, CONTAINER_VIEW);
    assert.ok(first.startsWith('<svg'));
    assert.equal(second, first);
  });
});

test('no style attributes are emitted by the C4 renderer', async () => {
  await withC4(async (page) => {
    const svgText = await renderInPage(page, CONTAINER_VIEW);
    const styled = await page.evaluate((text) => {
      const parsed = new DOMParser().parseFromString(text, 'image/svg+xml');
      return [...parsed.querySelectorAll('[style], style')].map((node) => node.tagName);
    }, svgText);
    assert.deepEqual(styled, []);
  });
});

test('the exported svgText is a standalone SVG', async () => {
  await withC4(async (page) => {
    const svgText = await renderInPage(page, CONTAINER_VIEW);
    const result = await page.evaluate(async (text) => {
      const parsed = new DOMParser().parseFromString(text, 'image/svg+xml');
      const root = parsed.documentElement;
      const shapes = [...root.querySelectorAll('rect, path, circle, ellipse, polygon, polyline, line')];
      const image = new Image();
      image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text);
      await image.decode();
      return {
        parseError: parsed.querySelector('parsererror') !== null,
        namespace: root.namespaceURI,
        unbaked: shapes.filter((shape) => !shape.hasAttribute('fill') || !shape.hasAttribute('stroke')).map((shape) => shape.outerHTML),
        classes: root.querySelectorAll('[class]').length,
        cascadeColours: /var\(|currentColor/.test(text),
        imageWidth: image.naturalWidth,
      };
    }, svgText);
    assert.equal(result.parseError, false);
    assert.equal(result.namespace, 'http://www.w3.org/2000/svg');
    assert.deepEqual(result.unbaked, [], 'every shape bakes its fill and stroke');
    assert.equal(result.classes, 0, 'no colour depends on a class');
    assert.equal(result.cascadeColours, false);
    assert.ok(result.imageWidth > 0, 'the SVG renders as a standalone image');
  });
});

test('a host palette replaces the default colours', async () => {
  await withC4(async (page) => {
    await renderInPage(page, CONTAINER_VIEW, { palette: { containerFill: '#ffeedd' } });
    const fills = await page.evaluate(() => ['api', 'student'].map((id) =>
      document.querySelector(`#diagram svg [data-layout-id="${id}"] rect, #diagram svg [data-layout-id="${id}"] path`).getAttribute('fill')));
    assert.equal(fills[0], '#ffeedd');
    const { PALETTE } = require('../../js/ArchUML/c4/c4-render.js');
    assert.equal(fills[1], PALETTE.personFill);
  });
});

// ---- Growth rounds (routing redesign §6.4) ---------------------------------------------------------------------
// `layoutView` places and routes, and grows the corridors the router asks for. These tests replace the router (the
// routing engine is the renderer's collaborator, resolved through `ArchUMLC4Route` when a view is laid out) with a
// stub that asks for growth, and spy on the placement engine to see which corridor extents it is given.

const SHOP_MODEL = fs.readFileSync(path.join(ARCHUML, 'tests/c4/fixtures/shop.yml'), 'utf8');
const RIGHT_FLOW = (selector) => `\nviews:\n  wide:\n    view: ${selector}\n    direction: right\n`;

/** A classic-script context without a DOM holding the bundle (for the seed layout) and every C4 script, in order. */
function layoutContextWithoutDom() {
  const context = {
    document: { readyState: 'loading', addEventListener() {}, documentElement: {} },
    MutationObserver: class { observe() {} },
  };
  context.window = context;
  context.self = context;
  vm.createContext(context);
  ['uml-bundle.js'].concat(MANIFEST.core, MANIFEST.render).forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(ARCHUML, file), 'utf8'), context, { filename: file });
  });
  return context;
}

const layoutRealm = layoutContextWithoutDom();
const REAL_ROUTER = layoutRealm.ArchUMLC4Route;
const REAL_PLACER = layoutRealm.ArchUMLC4Place;
/** A copy made of this realm's objects, so strict deep equality can compare values from the layout realm. */
const plain = (value) => JSON.parse(JSON.stringify(value));

/** A router that routes every edge straight between box centres and asks for `growthOf(call)` on each call. */
function stubRouter(growthOf) {
  const calls = [];
  return {
    calls,
    engine: {
      CFG: REAL_ROUTER.CFG,
      route(scene, options) {
        calls.push({ scene, noGrowth: plain(options.noGrowth) });
        const centre = (id) => ({ x: scene.boxes[id].x + scene.boxes[id].width / 2, y: scene.boxes[id].y + scene.boxes[id].height / 2 });
        return {
          edges: scene.edges.map((edge) => ({
            id: edge.id, points: [centre(edge.source), centre(edge.target)], labelBox: null, bends: 0,
            sides: ['bottom', 'top'], labelFallback: false, fallbackRoute: false,
          })),
          growth: growthOf(calls.length, scene),
          stats: {},
        };
      },
    },
  };
}

/**
 * Lays out `selector` of `text` with `router` in place of the routing engine, and returns the corridor extents
 * (`[[corridorId, units]]`, copied when placement is called) that each placement call received. The real placement
 * engine runs with the options `placementOptions` makes of the ones it is given (unchanged by default).
 */
function layoutWithRouter(text, selector, router, pins, placementOptions = (options) => options) {
  const extents = [];
  layoutRealm.ArchUMLC4Route = router.engine;
  layoutRealm.ArchUMLC4Place = Object.assign({}, REAL_PLACER, {
    place(graph, options) {
      extents.push(options.corridorExtra ? plain(Array.from(options.corridorExtra.entries())) : []);
      return REAL_PLACER.place(graph, placementOptions(options));
    },
  });
  try {
    const view = layoutRealm.ArchUMLC4.project(layoutRealm.ArchUMLC4.load(text), selector);
    layoutRealm.ArchUMLC4Render.layoutView(view, (line) => String(line).length * 10, { pins: new Map(pins || []) });
  } finally {
    layoutRealm.ArchUMLC4Route = REAL_ROUTER;
    layoutRealm.ArchUMLC4Place = REAL_PLACER;
  }
  return extents;
}

/** The first rank corridor of a scene, by id: the corridor the stub asks to grow. */
const firstRankCorridor = (scene) => scene.corridors.filter((corridor) => corridor.axis === 'main').map((corridor) => corridor.id).sort()[0];

[['down', SHOP_MODEL, 'containers of shop'], ['right', SHOP_MODEL + RIGHT_FLOW('containers of shop'), 'wide']].forEach(([direction, text, selector]) => {
  test(`growth adds up over at most two rounds, then the view is routed a last time (${direction})`, () => {
    const by = 50;
    const router = stubRouter((call, scene) => [{ corridorId: firstRankCorridor(scene), axis: 'main', by }]);
    const extents = layoutWithRouter(text, selector, router);
    const grown = firstRankCorridor(router.calls[0].scene);
    assert.equal(router.calls.length, 3, 'one first route and one route after each of the two growth rounds');
    assert.deepEqual(extents, [[], [[grown, by]], [[grown, 2 * by]]]);
    assert.deepEqual(router.calls.map((call) => call.noGrowth), [[], [], []], 'nothing is pinned, so every corridor may grow');
  });

  test(`growth that leaves the placement unchanged is not routed again (${direction})`, () => {
    // A corridor wider than anything it holds needs can absorb the growth asked for: placement then returns the same
    // boxes, and the deterministic router would only repeat its first answer. The placer here ignores the growth.
    const router = stubRouter((call, scene) => [{ corridorId: firstRankCorridor(scene), axis: 'main', by: 50 }]);
    const ignoringGrowth = (options) => Object.assign({}, options, { corridorExtra: null });
    const extents = layoutWithRouter(text, selector, router, null, ignoringGrowth);
    assert.equal(extents.length, 2, 'the view is placed again with the growth');
    assert.equal(router.calls.length, 1, 'the unchanged placement is not routed a second time');
  });

  test(`a view whose router asks for no growth is placed and routed once (${direction})`, () => {
    const router = stubRouter(() => []);
    assert.deepEqual(layoutWithRouter(text, selector, router), [[]]);
    assert.equal(router.calls.length, 1);
  });

  test(`corridors at or before a pinned box are never grown (${direction})`, () => {
    const router = stubRouter(() => []);
    // Far along both axes and clear of every other box, so the corridors before it differ by axis in both flows.
    layoutWithRouter(text, selector, router, [['orders', [2000, 500]]]);
    const { scene, noGrowth } = router.calls[0];
    const pinned = scene.boxes.orders;
    // A corridor's from/to run along its own axis: the flow axis for a rank corridor, the other axis for a gap one.
    const flowAxis = direction === 'right' ? 'x' : 'y';
    const crossAxis = flowAxis === 'x' ? 'y' : 'x';
    const movedBy = (mainAxis, otherAxis) => scene.corridors
      .filter((corridor) => pinned[corridor.axis === 'main' ? mainAxis : otherAxis] >= corridor.from).map((corridor) => corridor.id).sort();
    const expected = plain(movedBy(flowAxis, crossAxis));
    assert.ok(expected.length > 0 && expected.length < scene.corridors.length, `precondition: the pin lies after ${expected.length} of ${scene.corridors.length} corridors`);
    assert.notDeepEqual(plain(movedBy(crossAxis, flowAxis)), expected, 'precondition: swapping the axes would name other corridors');
    assert.deepEqual(noGrowth.slice().sort(), expected);
  });
});

// ---- Boundary labels (routing redesign §3.1) --------------------------------------------------------------------
// `layoutView` places each boundary label after routing, clear of routes and edge labels. These tests give it routes
// from a stub router, so the obstacles sit exactly where the test needs them.

/** The layout of `selector` in `text` with a router that returns `routesOf(scene)` (`[{points, labelBox}]` per edge). */
function layoutWithRoutes(text, selector, routesOf) {
  layoutRealm.ArchUMLC4Route = {
    CFG: REAL_ROUTER.CFG,
    route(scene) {
      const routes = routesOf(scene);
      return {
        edges: scene.edges.map((edge, index) => Object.assign({ id: edge.id, bends: 0, labelFallback: false, fallbackRoute: false }, routes[index])),
        growth: [],
        stats: {},
      };
    },
  };
  try {
    const view = layoutRealm.ArchUMLC4.project(layoutRealm.ArchUMLC4.load(text), selector);
    return plain(layoutRealm.ArchUMLC4Render.layoutView(view, (line) => String(line).length * 10));
  } finally {
    layoutRealm.ArchUMLC4Route = REAL_ROUTER;
  }
}

const LABEL_FOREIGN_CLEAR = 12;
const LABEL_BOX_CLEAR = 8;

/**
 * Routes for the shop's scope boundary: one runs along its whole bottom label line, one crosses its top padding 40 in
 * from the left border, and the edge label of a third (`labelFrom`..`labelTo` in from the left border) lies in that
 * padding too. Every other edge runs outside the boundary.
 */
function blockedLabelLines(labelFrom, labelTo) {
  return (scene) => {
    const box = scene.boundaries.shop;
    const outside = { points: [{ x: box.x - 200, y: box.y }, { x: box.x - 200, y: box.y + 10 }], labelBox: null };
    const bottomRow = box.y + box.height - 25;
    return scene.edges.map((edge, index) => [
      { points: [{ x: box.x, y: bottomRow }, { x: box.x + box.width, y: bottomRow }], labelBox: null },
      { points: [{ x: box.x + 40, y: box.y - 50 }, { x: box.x + 40, y: box.y + 50 }], labelBox: null },
      Object.assign({}, outside, { labelBox: { x: box.x + labelFrom, y: box.y + 2, width: labelTo - labelFrom, height: 26 } }),
    ][index] || outside);
  };
}

test('a boundary label whose label line is blocked slides along its top padding past routes and edge labels', () => {
  const layout = layoutWithRoutes(SHOP_MODEL, 'containers of shop', blockedLabelLines(100, 300));
  const box = layout.boundaries.shop;
  const label = layout.boundaryLabels.find((candidate) => candidate.id === 'shop');
  assert.ok(label.y >= box.y && label.y + label.height <= box.y + 30, `the label is in the top padding (y ${label.y - box.y})`);
  assert.ok(label.x >= box.x + 300 + LABEL_BOX_CLEAR, `the label starts ${label.x - box.x} in, clear of the edge label ending 300 in`);
  assert.ok(label.x + label.width <= box.x + box.width - 15, 'the label ends inside the padding');
  assert.equal(label.labelFallback, false);
});

test('a boundary label with no clear span on either line is marked as a fallback at the top-left', () => {
  // The edge label covers the top padding from the crossing to the far border, so no span there holds the label.
  const layout = layoutWithRoutes(SHOP_MODEL, 'containers of shop', (scene) => blockedLabelLines(60, scene.boundaries.shop.width)(scene));
  const box = layout.boundaries.shop;
  const label = layout.boundaryLabels.find((candidate) => candidate.id === 'shop');
  assert.deepEqual([label.x, label.labelFallback], [box.x + 15, true]);
  assert.ok(label.width > 40 - LABEL_FOREIGN_CLEAR - 15, 'precondition: the label is wider than the span left of the crossing');
});

// ---- Constants shared with placement ------------------------------------------------------------------------------
// The seed and the boundary labels space and pad as the placement engine does, so the renderer reads those constants
// from `ArchUMLC4Place.CFG` instead of keeping copies that could drift apart.

/** `run()` with the placement engine's constants changed by `changes`; its placements stay exactly the same. */
function withPlacementConstants(changes, run) {
  layoutRealm.ArchUMLC4Place = Object.assign({}, REAL_PLACER, { CFG: Object.freeze(Object.assign({}, REAL_PLACER.CFG, changes)) });
  try {
    return run(layoutRealm.ArchUMLC4Place.CFG);
  } finally {
    layoutRealm.ArchUMLC4Place = REAL_PLACER;
  }
}

test('the seed spaces ranks and neighbours by the placement engine’s level gaps', () => {
  const box = { width: 300, height: 100, parent: null, role: 'element', external: false };
  const fanOut = {
    items: ['a', 'b', 'c'].map((id) => Object.assign({ id }, box)),
    boundaries: [],
    edges: [{ id: 'a->b', source: 'a', target: 'b', labelWidth: 0, labelHeight: 0 }, { id: 'a->c', source: 'a', target: 'c', labelWidth: 0, labelHeight: 0 }],
    scopeId: null,
  };
  const gapsOf = (seed) => ({ rank: seed.b.y - (seed.a.y + box.height), neighbour: seed.c.x - (seed.b.x + box.width) });
  [{}, { levelGapX: REAL_PLACER.CFG.levelGapX + 100, levelGapY: REAL_PLACER.CFG.levelGapY + 100 }].forEach((changes) => {
    withPlacementConstants(changes, (cfg) => {
      const gaps = gapsOf(plain(layoutRealm.ArchUMLC4Render.seedPositions(fanOut)));
      assert.deepEqual(gaps, { rank: cfg.levelGapY, neighbour: cfg.levelGapX }, `with ${JSON.stringify(changes)}`);
    });
  });
});

test('a boundary label sits on the line the placement engine’s boundary padding gives it', () => {
  const routesOutside = (scene) => scene.edges.map(() => {
    const box = scene.boundaries.shop;
    return { points: [{ x: box.x - 200, y: box.y }, { x: box.x - 200, y: box.y + 10 }], labelBox: null };
  });
  const labelOf = () => {
    const layout = layoutWithRoutes(SHOP_MODEL, 'containers of shop', routesOutside);
    return { box: layout.boundaries.shop, label: layout.boundaryLabels.find((candidate) => candidate.id === 'shop') };
  };
  const before = labelOf();
  const added = 20;
  const after = withPlacementConstants({ boundaryPad: REAL_PLACER.CFG.boundaryPad + added }, labelOf);
  assert.deepEqual(after.box, before.box, 'precondition: the boundary itself is placed where it was');
  assert.equal(before.label.labelFallback, false, 'precondition: nothing blocks the label line');
  assert.deepEqual([after.label.x, after.label.y], [before.label.x + added / 2, before.label.y - added / 2],
    'half the padding sits between the boundary line and its label, on both axes');
});
