'use strict';

// The bundle's component renderer as the C4 interfaces view uses it (spec §6.6, "Bundle requirements"):
// display names, C4 type keywords, an explicit layout direction, and parsing of generated text.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { before, after, test } = require('node:test');
const { chromium } = require('playwright');
const { chromiumLaunchOptions } = require('../chromium-launch-options');
const C4 = require('../../js/ArchUML/c4/c4-core.js');
const figures = require('./helpers/uml-component-figure');

const {
  replaced, renderFigure, contains, overlaps, boxById, pointToRect, routeToRect, statementsOf, routesOf,
  distanceToAssembly, ballOf, nearest, declaredPortCount, portsOf,
} = figures;

const FIXTURES = path.join(__dirname, '../../js/ArchUML/tests/c4/fixtures');
const REFERENCE = fs.readFileSync(path.join(FIXTURES, 'course-registration-interfaces.yml'), 'utf8');
const ENDPOINT = fs.readFileSync(path.join(FIXTURES, 'interfaces-endpoint.yml'), 'utf8');
const SHOP = fs.readFileSync(path.join(FIXTURES, 'interfaces-shop.yml'), 'utf8');
const MAX_READABLE_WIDTH_EM = 44;

let browser;
before(async () => { browser = await chromium.launch(chromiumLaunchOptions()); });
after(async () => { if (browser) await browser.close(); });

/** Calls `run(page)` on a page that has loaded the bundle; the page is closed afterwards. */
const withBundle = (run) => figures.withBundle(browser, run);

/** The component text the core generates for `selector` in the model `yamlText`. */
function componentText(yamlText, selector) {
  const design = C4.load(yamlText);
  assert.notEqual(design.model, null, 'the fixture model loads');
  const generated = C4.toUml(C4.project(design, selector));
  assert.equal(generated.type, 'component');
  return generated.text;
}

// ---- display names and keywords -----------------------------------------------------------------------------

test("a component's display name is drawn and measured, and its alias stays a hook", async () => {
  const figure = await withBundle((page) => renderFigure(page, '@startuml\ncomponent "Registration API" as e1 {\n  provide "A" as p1\n}\n@enduml', 760));
  const rect = boxById(figure, 'e1');
  const name = figure.texts.find((entry) => entry.text === 'Registration API');
  assert.ok(name, `the display name is drawn; texts: ${JSON.stringify(figure.texts.map((entry) => entry.text))}`);
  assert.ok(contains(rect, name), 'the box is measured around its display name');
  assert.equal(figure.texts.some((entry) => entry.text === 'e1'), false, 'the alias is never drawn');
});

test('keywords are drawn as a second italic line', async () => {
  const figure = await withBundle((page) => renderFigure(page,
    '@startuml\ncomponent "Registration API" as e1 <<Container: Python, FastAPI>> {\n  provide "A" as p1\n}\n@enduml', 760));
  const rect = boxById(figure, 'e1');
  const name = figure.texts.find((entry) => entry.text === 'Registration API');
  const keyword = figure.texts.find((entry) => entry.text === '«Container: Python, FastAPI»');
  assert.ok(name && keyword, `name and keyword are drawn; texts: ${JSON.stringify(figure.texts.map((entry) => entry.text))}`);
  assert.equal(keyword.italic, true, 'the keyword line is italic');
  assert.equal(name.italic, false, 'the name line is not italic');
  assert.ok(keyword.y >= name.y + name.height - 1, 'the keyword is the line under the name');
  assert.ok(contains(rect, keyword), 'the keyword lies inside the box');
});

// ---- explicit layout direction -------------------------------------------------------------------------------

const REFERENCE_TEXT = componentText(REFERENCE, 'interfaces of api');
const WIDTHS = [320, 760, 1440];

async function boxesAtEveryWidth(text) {
  return withBundle(async (page) => {
    const byWidth = [];
    for (const width of WIDTHS) {
      const figure = await renderFigure(page, text, width);
      byWidth.push(['e1', 'e2', 'e3'].map((id) => boxById(figure, id)));
    }
    return byWidth;
  });
}

test("an explicit layout direction wins over the container's shape", async () => {
  assert.equal(REFERENCE_TEXT.split('\n')[1], 'layout vertical');
  const vertical = await boxesAtEveryWidth(REFERENCE_TEXT);
  vertical.slice(1).forEach((boxes, index) => assert.deepEqual(boxes, vertical[0],
    `the ${WIDTHS[index + 1]} px container gives the coordinates of the ${WIDTHS[0]} px one`));
  const [web, api, billing] = vertical[0];
  assert.ok(web.y + web.height <= api.y, 'Planner Web App (declared first) is above Registration API');
  assert.ok(api.y + api.height <= billing.y, 'Registration API is above Billing System (declared last)');

  const horizontal = await boxesAtEveryWidth(REFERENCE_TEXT.replace('layout vertical', 'layout horizontal'));
  horizontal.slice(1).forEach((boxes, index) => assert.deepEqual(boxes, horizontal[0],
    `layout horizontal: the ${WIDTHS[index + 1]} px container gives the coordinates of the ${WIDTHS[0]} px one`));
  const [left, middle, right] = horizontal[0];
  for (const [a, b] of [[left, middle], [middle, right], [left, right]]) {
    assert.ok(a.y < b.y + b.height && b.y < a.y + a.height, 'layout horizontal puts the components in one row');
  }
  assert.ok(left.x + left.width <= middle.x && middle.x + middle.width <= right.x, 'the row follows declaration order');
});

// ---- generated text parses into exactly the intended statements (1b Review Focus 4) ---------------------------

/** The 1b Task 9 adversarial shop, plus a reader kiosk that uses the shop app, so `interfaces of app` has a
 * consumer, the scope, and a provider. */
const HOSTILE_SHOP = replaced(replaced(replaced(replaced(replaced(SHOP,
  'name: Shop App', 'name: "<script>"'),
  'name: Payment Provider', 'name: "Seat {Gateway}"'),
  'technology: Python, Flask', 'technology: "a >> b <<c"'),
  'name: Card Payments API', 'name: "Evil\\" } --> x\\n@enduml"'),
  'syntax: POST /v3/charges', 'syntax: "a --> b }"')
  + '  kiosk:\n    name: Reader Kiosk\n    description: Prints course readers in the library.\n'
  + '    collaborators:\n      app: {description: looks up readers in, uses: app.get-readers-id}\n';

test('generated component text cannot inject statements', async () => {
  const text = componentText(HOSTILE_SHOP, 'interfaces of app');
  const parsed = await withBundle((page) => page.evaluate((source) => window.UMLComponentDiagram.parse(source), text));
  assert.deepEqual(parsed.components.map((component) => [
    component.name, parsed.displayNameMap[component.name], component.ports.map((port) => `${port.kind} ${port.alias}`),
  ]), [
    ['e1', 'Reader Kiosk', ['require r1']],
    ['e2', '<script>', ['provide p1', 'require r2']],
    ['e3', 'Seat (Gateway)', ['provide p2']],
  ], text);
  const names = parsed.components.flatMap((component) => component.ports.map((port) => port.name))
    .concat(Object.values(parsed.displayNameMap));
  names.forEach((name) => assert.doesNotMatch(name, /["{}]/, `name ${name} keeps no quote or brace`));
  assert.deepEqual(parsed.connectors.map((connector) => [connector.fromPort, connector.toPort, connector.label]), [
    ['p1', 'r1', 'GET /readers/{id}'],
    ['p2', 'r2', 'a --> b }'],
  ]);
});

test('a REST path keeps its braces in a connector label', async () => {
  const parsed = await withBundle((page) => page.evaluate(() => window.UMLComponentDiagram.parse(
    'component "Shop App" as e1 {\n  provide "Readers" as p1\n}\ncomponent "Kiosk" as e2 {\n  require "Readers" as r2\n}\n'
    + 'p1 --> r2 : GET /readers/{id}')));
  assert.equal(parsed.connectors.length, 1);
  assert.equal(parsed.connectors[0].label, 'GET /readers/{id}');
});

// ---- render gates on views generated by the core --------------------------------------------------------------

const MOBILE_CONSUMER = '      mobile:\n        name: Mobile App\n        kind: mobile_app\n        technology: Swift\n'
  + '        description: Enrolls students from a phone.\n        collaborators:\n'
  + '          api: {description: submits plans to, technology: JSON/HTTPS, uses: enrollment-api.submit-plan}\n';
const API_DECLARATION = '      api:\n        name: Registration API\n';
const API_CHOICES = '        choices:\n          technology:\n            chosen: FastAPI 0.115 on Python 3.12\n';
const SCHEDULE_API = '          schedule-api:\n            name: Schedule API\n            description: Lists the sections a student can plan.\n'
  + '            operations:\n              list-sections: GET /v1/sections\n';
const WEB_TO_COORDINATOR = '          coordinator: {description: submits plans to, technology: JSON/HTTPS, uses: enrollment-api.submit-plan}\n';
const WEB_TO_SCHEDULE = '          api: {description: reads sections from, technology: JSON/HTTPS, uses: schedule-api.list-sections}\n';

const GATED_VIEWS = {
  reference: REFERENCE_TEXT,
  'one interface with two consumers': componentText(replaced(REFERENCE, API_DECLARATION, MOBILE_CONSUMER + API_DECLARATION), 'interfaces of api'),
  'one component with two provided interfaces': componentText(
    replaced(replaced(REFERENCE, API_CHOICES, SCHEDULE_API + API_CHOICES), WEB_TO_COORDINATOR, WEB_TO_COORDINATOR + WEB_TO_SCHEDULE), 'interfaces of api'),
  endpoint: componentText(ENDPOINT, 'interfaces of api'),
};

let gatedRender = null;

/** The gated views, rendered once in a 760 px container and shared by the gate tests. */
function gatedFigures() {
  gatedRender = gatedRender || withBundle(async (page) => {
    const figures = {};
    for (const [name, text] of Object.entries(GATED_VIEWS)) figures[name] = await renderFigure(page, text, 760);
    return figures;
  });
  return gatedRender;
}

for (const view of Object.keys(GATED_VIEWS)) {
  test(`${view}: labels overlap no component box, no ball, no connector, and no other label`, async () => {
    const figure = (await gatedFigures())[view];
    const { headers } = statementsOf(GATED_VIEWS[view]);
    const labels = figure.texts.filter((entry) => !headers.has(entry.text));
    for (const label of labels) {
      for (const box of figure.boxes) assert.equal(overlaps(label, box), false, `"${label.text}" overlaps the box ${box.id}`);
      for (const ball of figure.balls) {
        assert.ok(pointToRect(ball, label) > ball.r, `"${label.text}" covers the ball at (${ball.x}, ${ball.y})`);
      }
      for (const route of figure.routes) {
        assert.ok(routeToRect(route.points, label) > 0, `"${label.text}" is crossed by the connector ${route.source || route.target}`);
      }
    }
    figure.texts.forEach((a, i) => figure.texts.slice(i + 1).forEach((b) => {
      assert.equal(overlaps(a, b), false, `"${a.text}" overlaps "${b.text}"`);
    }));
  });

  test(`${view}: each interface name is next to its ball`, async () => {
    const figure = (await gatedFigures())[view];
    for (const assembly of statementsOf(GATED_VIEWS[view]).assemblies) {
      const ball = ballOf(figure, assembly);
      const names = figure.texts.filter((entry) => entry.text === assembly.interfaceName
        && nearest(figure.balls, (other) => pointToRect(other, entry)) === ball);
      assert.equal(names.length, 1, `one "${assembly.interfaceName}" label belongs to the ball of ${assembly.providerPort} → ${assembly.consumerPort}`);
      assert.ok(pointToRect(ball, names[0]) <= ball.r + 2 * names[0].height,
        `"${assembly.interfaceName}" sits beside its ball (distance ${pointToRect(ball, names[0]).toFixed(1)})`);
    }
  });

  test(`${view}: each assembly label is nearest its own connector`, async () => {
    const figure = (await gatedFigures())[view];
    const { assemblies } = statementsOf(GATED_VIEWS[view]);
    const claimed = new Set();
    for (const assembly of assemblies.filter((entry) => entry.label)) {
      const label = figure.texts.find((entry) => entry.text === assembly.label && !claimed.has(entry)
        && nearest(assemblies, (other) => distanceToAssembly(figure, other, entry)) === assembly);
      assert.ok(label, `a "${assembly.label}" label is nearer ${assembly.providerPort} → ${assembly.consumerPort} than any other connector`);
      assert.ok(distanceToAssembly(figure, assembly, label) <= label.height,
        `"${assembly.label}" sits beside its connector (distance ${distanceToAssembly(figure, assembly, label).toFixed(1)})`);
      claimed.add(label);
    }
  });
}

// Final review I4: the three boxes of the reference interfaces view are stacked and overlap, yet each assembly left the
// boxes' left sides for a lane beside the column (two bends each). An assembly between neighbours of a vertical stack
// runs straight down between them: its two routes (on either side of the ball and socket) share one x.
test('reference: each assembly between stack neighbours runs straight down between them', async () => {
  const figure = (await gatedFigures()).reference;
  const { assemblies } = statementsOf(GATED_VIEWS.reference);
  assert.equal(assemblies.length, 2, 'the view joins its three boxes by two assemblies');
  for (const assembly of assemblies) {
    const points = routesOf(figure, assembly).flatMap((route) => route.points);
    const xs = new Set(points.map((point) => Math.round(point.x * 10) / 10));
    assert.equal(xs.size, 1, `${assembly.providerPort} → ${assembly.consumerPort} runs at one x: ${JSON.stringify(points)}`);
  }
});

test('the reference interfaces view fits the readable width', async () => {
  const { readableWidth } = (await gatedFigures()).reference;
  const readable = readableWidth.match(/([\d.]+)em\)$/);
  assert.ok(readable, `the figure states its readable width: ${readableWidth}`);
  assert.ok(Number(readable[1]) <= MAX_READABLE_WIDTH_EM, `readable width ${readable[1]}em is at most ${MAX_READABLE_WIDTH_EM}em`);
});

test('no ball sits beside a consumer of its interface', async () => {
  const view = 'one interface with two consumers';
  const figure = (await gatedFigures())[view];
  const { assemblies } = statementsOf(GATED_VIEWS[view]);
  const consumers = new Set(assemblies.map((assembly) => assembly.consumer));
  for (const assembly of assemblies) {
    const ball = ballOf(figure, assembly);
    for (const consumer of [...consumers].filter((id) => id !== assembly.provider)) {
      const gap = pointToRect(ball, boxById(figure, consumer)) - ball.r;
      assert.ok(gap > 2 * ball.r, `the ${assembly.interfaceName} ball of ${assembly.providerPort} is ${gap.toFixed(1)} units from consumer ${consumer}`);
    }
  }
});

// ---- ports stacked on one side in an explicit vertical layout ----------------------------------------------------

/** The renderer's minimum vertical pitch between two ports on one side of a box (a symbol plus its name). */
const MIN_PORT_PITCH = 40;

/** A middle component (e2) under `layout vertical` with one joined require and interfaces that have no partner in
 * scope; every interface port goes on its left side. */
const PLANNER_ON_TOP = '@startuml\nlayout vertical\n'
  + 'component "Planner Web App" as e1 <<Container: TypeScript>> {\n  provide "Enrollment API" as p1\n}\n';
const STACKED_PORT_VIEWS = {
  'one joined require and two unjoined provides': PLANNER_ON_TOP
    + 'component "Registration API" as e2 <<Container: Python>> {\n  require "Enrollment API" as r1\n'
    + '  provide "Schedule API" as p2\n  provide "Waitlist API" as p3\n}\n'
    + 'p1 --> r1 : POST /v1/plans\n@enduml',
  'one joined require, an unjoined require, and two unjoined provides': PLANNER_ON_TOP
    + 'component "Registration API" as e2 <<Container: Python>> {\n  require "Enrollment API" as r1\n'
    + '  require "Tuition Feed" as r2\n  provide "Schedule API" as p2\n  provide "Waitlist API" as p3\n}\n'
    + 'p1 --> r1 : POST /v1/plans\n@enduml',
};

for (const [view, text] of Object.entries(STACKED_PORT_VIEWS)) {
  test(`layout vertical, ${view}: the box is tall enough for every port on its sides`, async () => {
    const figure = await withBundle((page) => renderFigure(page, text, 760));
    const box = boxById(figure, 'e2');
    const ports = portsOf(figure, box);
    assert.equal(ports.length, declaredPortCount(text, 'e2'), `every port of e2 is drawn: ${JSON.stringify(ports)}`);
    for (const side of ['left', 'right']) {
      const ys = ports.filter((port) => port.side === side).map((port) => port.y).sort((a, b) => a - b);
      ys.slice(1).forEach((y, index) => assert.ok(y - ys[index] >= MIN_PORT_PITCH - 0.5,
        `${side} ports at y ${ys[index].toFixed(1)} and ${y.toFixed(1)} are at least ${MIN_PORT_PITCH} apart`));
    }
    const symbols = figure.portSymbols.filter((symbol) => symbol.id.startsWith('e2.'));
    for (const symbol of symbols) {
      assert.ok(symbol.y >= box.y && symbol.y + symbol.height <= box.y + box.height,
        `the symbol of ${symbol.id} lies within the height of its box`);
      for (const label of figure.texts) assert.equal(overlaps(symbol, label), false, `"${label.text}" overlaps the symbol of ${symbol.id}`);
    }
    symbols.forEach((a, i) => symbols.slice(i + 1).forEach((b) => {
      assert.equal(overlaps(a, b), false, `the symbols of ${a.id} and ${b.id} overlap`);
    }));
    figure.texts.forEach((a, i) => figure.texts.slice(i + 1).forEach((b) => {
      assert.equal(overlaps(a, b), false, `"${a.text}" overlaps "${b.text}"`);
    }));
  });
}
