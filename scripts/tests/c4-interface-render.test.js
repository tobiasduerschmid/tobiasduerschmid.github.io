'use strict';

// Interfaces in C4-notation views (spec §6.1 "Interfaces in C4 views", §6.4 step 5): with the `interfaces`
// annotation a box names the interfaces it provides and an edge label names the interface it uses; without the
// annotation the drawing is unchanged; pins are top-left corners shared by the plain and the annotated view.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { before, after, test } = require('node:test');
const { chromium } = require('playwright');
const { chromiumLaunchOptions } = require('../chromium-launch-options');

const ARCHUML = path.join(__dirname, '../../js/ArchUML');
const FIXTURES = path.join(ARCHUML, 'tests/c4/fixtures');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ARCHUML, 'c4/manifest.json'), 'utf8'));
const MILESTONE_1_MODEL = fs.readFileSync(path.join(FIXTURES, 'course-registration.yml'), 'utf8');
const INTERFACES_MODEL = fs.readFileSync(path.join(FIXTURES, 'course-registration-interfaces.yml'), 'utf8');
const ANNOTATED_CONTAINERS = 'containers of registration with interfaces';
const ANNOTATED_COMPONENTS = 'components of api with interfaces';
const BOX_WIDTH = 300;

/** `text` with `from` replaced by `to`; fails loudly when the fixture no longer contains `from`. */
function edited(text, from, to) {
  assert.ok(text.includes(from), `the fixture contains ${JSON.stringify(from)}`);
  return text.replace(from, to);
}

/** The interfaces model in which the Planner Web App uses three interfaces of the Registration API. */
const THREE_INTERFACES_MODEL = edited(edited(INTERFACES_MODEL,
  '        provides:\n          enrollment-api:\n',
  '        provides:\n'
  + '          schedule-api:\n            name: Schedule API\n            description: Lists the sections of a draft schedule.\n'
  + '          seat-api:\n            name: Seat API\n            description: Reports the open seats of a section.\n'
  + '          enrollment-api:\n'),
'uses: enrollment-api.submit-plan}', 'uses: [enrollment-api.submit-plan, schedule-api, seat-api]}');

/** The interfaces model in which the web app's relationship declares no technology, so the interface supplies it. */
const INTERFACE_TECHNOLOGY_MODEL = edited(INTERFACES_MODEL,
  'coordinator: {description: submits plans to, technology: JSON/HTTPS, uses:', 'coordinator: {description: submits plans to, uses:');

const LONG_ENROLLMENT_NAME = 'Enrollment and Schedule Planning Service';
const LONG_CHARGES_NAME = 'Tuition Charges and Refund Request Queue';
const LONG_NAMES_MODEL = edited(edited(INTERFACES_MODEL,
  'name: Enrollment API', `name: ${LONG_ENROLLMENT_NAME}`), 'name: Tuition Charges', `name: ${LONG_CHARGES_NAME}`);

let browser;
let page;
before(async () => {
  browser = await chromium.launch(chromiumLaunchOptions());
  page = await browser.newPage();
  await page.setContent('<!doctype html><html lang="en"><title>C4 interface render test</title><body></body></html>');
  await page.addScriptTag({ path: path.join(ARCHUML, 'uml-bundle.js') });
  for (const file of MANIFEST.core.concat(MANIFEST.render)) {
    await page.addScriptTag({ path: path.join(ARCHUML, file) });
  }
});
after(async () => { if (browser) await browser.close(); });

/**
 * What `render()` draws for `view: <selector>` of `model`: per element its translation, its outline box (in
 * diagram units) and its text lines; per edge its label lines; and the view model's `pinAdjusted` marks.
 */
function drawingOf(model, selector) {
  return page.evaluate((source) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const { viewModel } = window.ArchUMLC4Render.render(container, source);
    const textsOf = (group) => [...group.querySelectorAll('text')].map((line) => ({
      text: line.textContent, fontSize: line.getAttribute('font-size'), width: line.getComputedTextLength(),
    }));
    const nodes = Object.fromEntries([...container.querySelectorAll('[data-layout-id]')].map((group) => {
      const [x, y] = group.getAttribute('transform').match(/translate\(([-\d.]+),([-\d.]+)\)/).slice(1).map(Number);
      const outline = group.firstElementChild.getBBox();
      return [group.getAttribute('data-layout-id'), {
        x, y, box: { x: x + outline.x, y: y + outline.y, width: outline.width, height: outline.height }, texts: textsOf(group),
      }];
    }));
    const edges = Object.fromEntries([...container.querySelectorAll('[data-layout-route-id]')]
      .map((group) => [group.getAttribute('data-layout-route-id'), textsOf(group)]));
    const pinAdjusted = Object.fromEntries(viewModel.nodes.map((node) => [node.id, node.pinAdjusted]));
    container.remove();
    return { nodes, edges, pinAdjusted };
  }, `view: ${selector}\n${model}`);
}

/** `layoutView`'s boxes and edge label boxes for `selector` of `model`, with the model's own pins. */
function layoutOf(model, selector) {
  return page.evaluate(([source, viewSelector]) => {
    const design = window.ArchUMLC4.load(source);
    const view = window.ArchUMLC4.project(design, viewSelector);
    const layout = window.ArchUMLC4Render.layoutView(view, undefined, { pins: design.model.layout.get(view.key) });
    return { nodes: layout.nodes, labels: layout.edges.map((route) => [route.id, route.labelBox]).filter(([, box]) => box) };
  }, [model, selector]);
}

const lineTexts = (texts) => texts.map((line) => line.text);
const nameLine = (node) => node.texts[0];

function overlaps(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function pairs(list) {
  return list.flatMap((first, index) => list.slice(index + 1).map((second) => [first, second]));
}

function withPins(model, pins) {
  const entries = Object.entries(pins).map(([id, [x, y]]) => `    ${id}: [${x}, ${y}]`).join('\n');
  return `${model}\nlayout:\n  containers of registration:\n${entries}\n`;
}

test('the annotated container view shows provided interfaces on boxes', async () => {
  const { nodes } = await drawingOf(INTERFACES_MODEL, ANNOTATED_CONTAINERS);
  const provides = nodes.api.texts.find((line) => line.text === 'Provides: Enrollment API');
  assert.ok(provides, `the api box draws "Provides: Enrollment API" among ${JSON.stringify(lineTexts(nodes.api.texts))}`);
  assert.equal(provides.fontSize, nameLine(nodes.api).fontSize, 'the Provides line has the size of the name');
  assert.ok(lineTexts(nodes.billing.texts).includes('Provides: Tuition Charges'));
  assert.deepEqual(['student', 'web', 'db'].filter((id) => lineTexts(nodes[id].texts).some((text) => text.startsWith('Provides:'))), [],
    'elements that provide no interface draw no Provides line');
});

test('a provided interface keeps its mark, and a box names two interfaces and then how many more', async () => {
  const components = await drawingOf(INTERFACES_MODEL, ANNOTATED_COMPONENTS);
  assert.match(lineTexts(components.nodes.coordinator.texts).join(' '), /Provides: Enrollment API \(delegated from Registration API\)/);
  const three = await drawingOf(THREE_INTERFACES_MODEL, ANNOTATED_CONTAINERS);
  // A Provides line longer than the box wraps, so both checks read the box's lines joined.
  assert.match(lineTexts(three.nodes.api.texts).join(' '), /Provides: Schedule API, Seat API, \+1 more$/);
});

test('annotated edges add one via line after the technology', async () => {
  const containers = await drawingOf(INTERFACES_MODEL, ANNOTATED_CONTAINERS);
  assert.deepEqual(lineTexts(containers.edges['web->api/sync']), ['submits plans to', '[JSON/HTTPS]', 'via Enrollment API']);
  assert.deepEqual(lineTexts(containers.edges['api->db/sync']), ['writes seat holds to', '[SQL/TCP]'], 'an edge that uses no interface gains no via line');
  const three = await drawingOf(THREE_INTERFACES_MODEL, ANNOTATED_CONTAINERS);
  assert.equal(lineTexts(three.edges['web->api/sync']).at(-1), 'via Enrollment API (+2 more)');
  const context = await drawingOf(INTERFACES_MODEL, 'context of registration with interfaces');
  assert.deepEqual(lineTexts(context.edges['registration->billing/async']), ['requests tuition charges from', 'via Tuition Charges']);
});

test('a technology that comes from the interface is drawn like a declared one', async () => {
  const technologySource = await page.evaluate(([source]) => window.ArchUMLC4.project(window.ArchUMLC4.load(source), 'containers of registration')
    .edges.find((edge) => edge.id === 'web->api/sync').technologySource, [INTERFACE_TECHNOLOGY_MODEL]);
  assert.equal(technologySource, 'interface', 'the fixture edit leaves the interface as the only technology source');
  const plain = await drawingOf(INTERFACE_TECHNOLOGY_MODEL, 'containers of registration');
  assert.deepEqual(lineTexts(plain.edges['web->api/sync']), ['submits plans to', '[JSON/HTTPS]']);
  const annotated = await drawingOf(INTERFACE_TECHNOLOGY_MODEL, ANNOTATED_CONTAINERS);
  assert.deepEqual(lineTexts(annotated.edges['web->api/sync']), ['submits plans to', '[JSON/HTTPS]', 'via Enrollment API']);
});

test('plain views are unchanged by interfaces', async () => {
  const withInterfaces = await drawingOf(INTERFACES_MODEL, 'containers of registration');
  const milestone1 = await drawingOf(MILESTONE_1_MODEL, 'containers of registration');
  const texts = Object.values(withInterfaces.nodes).flatMap((node) => lineTexts(node.texts))
    .concat(Object.values(withInterfaces.edges).flatMap(lineTexts));
  assert.deepEqual(texts.filter((text) => text.startsWith('Provides:') || text.startsWith('via ')), []);
  const coordinates = (drawing) => Object.fromEntries(Object.entries(drawing.nodes).map(([id, node]) => [id, [node.x, node.y]]));
  assert.deepEqual(coordinates(withInterfaces), coordinates(milestone1));
});

test('pins are top-left anchors shared by the plain and the annotated view', async () => {
  // The pin lies 400 units right of every box of the free layout, at the free layout's row of the API.
  const free = await layoutOf(INTERFACES_MODEL, 'containers of registration');
  const right = Math.max(...Object.values(free.nodes).map((box) => box.x + box.width));
  const pin = [right + 400, free.nodes.api.y];
  const model = withPins(INTERFACES_MODEL, { api: pin });
  const plain = await drawingOf(model, 'containers of registration');
  const annotated = await drawingOf(model, ANNOTATED_CONTAINERS);
  assert.deepEqual([plain.nodes.api.x, plain.nodes.api.y], pin, 'the plain view puts the box corner on the pin');
  assert.deepEqual([annotated.nodes.api.x, annotated.nodes.api.y], pin, 'the annotated view reads the same pin');
  assert.deepEqual([plain.pinAdjusted.api, annotated.pinAdjusted.api], [false, false]);
});

test('a box that grows under interfaces pushes the pinned box below it down and marks it pin adjusted', async () => {
  const free = await layoutOf(INTERFACES_MODEL, 'containers of registration');
  const apiPin = [free.nodes.api.x, free.nodes.api.y];
  const dbPin = [apiPin[0], apiPin[1] + free.nodes.api.height + 10];
  const model = withPins(INTERFACES_MODEL, { api: apiPin, db: dbPin });
  const { nodes, pinAdjusted } = await drawingOf(model, ANNOTATED_CONTAINERS);
  const api = nodes.api.box;
  const db = nodes.db.box;
  assert.ok(api.height > free.nodes.api.height, 'the Provides line makes the api box taller');
  assert.deepEqual([nodes.api.x, nodes.api.y], apiPin, 'the upper box keeps its pin');
  assert.equal(pinAdjusted.api, false);
  assert.equal(nodes.db.x, dbPin[0], 'the lower box keeps its horizontal pin');
  assert.ok(db.y >= api.y + api.height, `the db box (top ${db.y}) clears the grown api box (bottom ${api.y + api.height})`);
  assert.ok(db.y <= api.y + api.height + 40, 'the lower box moves by the overlap, not further');
  assert.equal(pinAdjusted.db, true);
});

/** The layout gates of the rendering plan's Task 2 on an annotated view: boxes apart, labels clear and wrapped. */
function annotatedLayoutGates(name, model, selector) {
  test(`element boxes never overlap (${name})`, async () => {
    const { nodes } = await layoutOf(model, selector);
    const overlapping = pairs(Object.entries(nodes)).filter(([[, a], [, b]]) => overlaps(a, b)).map(([[a], [b]]) => `${a} × ${b}`);
    assert.deepEqual(overlapping, []);
  });

  test(`edge labels keep clear of boxes and of each other (${name})`, async () => {
    const { nodes, labels } = await layoutOf(model, selector);
    const onBoxes = labels.flatMap(([id, label]) => Object.entries(nodes).filter(([, box]) => overlaps(label, box)).map(([boxId]) => `${id} label on ${boxId}`));
    const onLabels = pairs(labels).filter(([[, a], [, b]]) => overlaps(a, b)).map(([[a], [b]]) => `${a} label on ${b} label`);
    assert.deepEqual(onBoxes, []);
    assert.deepEqual(onLabels, []);
  });

  test(`every edge label line is at most one box width wide (${name})`, async () => {
    const { edges } = await drawingOf(model, selector);
    const tooWide = Object.entries(edges).flatMap(([id, lines]) => lines.filter((line) => line.width > BOX_WIDTH)
      .map((line) => `${id}: "${line.text}" is ${line.width} wide`));
    assert.deepEqual(tooWide, []);
  });
}

test('the long-name fixture names its interfaces with 40 characters', () => {
  assert.deepEqual([LONG_ENROLLMENT_NAME.length, LONG_CHARGES_NAME.length], [40, 40]);
});

annotatedLayoutGates('annotated container view', INTERFACES_MODEL, ANNOTATED_CONTAINERS);
annotatedLayoutGates('annotated component view', INTERFACES_MODEL, ANNOTATED_COMPONENTS);
annotatedLayoutGates('annotated container view, 40-character interface names', LONG_NAMES_MODEL, ANNOTATED_CONTAINERS);
annotatedLayoutGates('annotated component view, 40-character interface names', LONG_NAMES_MODEL, ANNOTATED_COMPONENTS);
