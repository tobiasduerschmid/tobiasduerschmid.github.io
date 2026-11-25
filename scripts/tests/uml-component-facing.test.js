'use strict';

// The component renderer's `layout ports facing` (spec §6, §14 D3). With the directive and a saved position of a
// component, the ball and the socket of each assembly sit on the sides of their two boxes that face each other.
// Without either, every drawing stays as it is. The inputs are the `toUml` texts of the shipped interfaces views,
// frozen in fixtures/uml-component-facing (Task 2b), so these tests depend on the bundle alone.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { before, after, test } = require('node:test');
const { chromium } = require('playwright');
const { chromiumLaunchOptions } = require('../chromium-launch-options');
const figures = require('./helpers/uml-component-figure');

const {
  replaced, renderFigure, contains, overlaps, boxById, pointToRect, routeToRect, statementsOf, routesOf, distanceToAssembly, ballOf,
  nearest,
} = figures;

const FROZEN = path.join(__dirname, 'fixtures/uml-component-facing');
const frozen = (name) => fs.readFileSync(path.join(FROZEN, name), 'utf8');
const FROZEN_NAMES = fs.readdirSync(FROZEN).filter((name) => name.endsWith('.puml')).sort();

/** `interfaces of api`: e1 uses e2's Enrollment API (assembly p1 → r1); e2 uses e3's Tuition Charges (p2 → r2). */
const API = frozen('course-registration-interfaces--api.puml');
/** `interfaces of app` of interfaces-shop.yml: e1 uses e2's Card Payments API (p2 → r1); e1's own p1 joins nothing. */
const SHOP = frozen('interfaces-shop--app.puml');
const API_HORIZONTAL = replaced(API, 'layout vertical\n', 'layout horizontal\n');
const SHOP_HORIZONTAL = replaced(SHOP, 'layout vertical\n', 'layout horizontal\n');
const DIRECTIVE = 'layout ports facing';
const WIDTH = 760;

let browser;
before(async () => { browser = await chromium.launch(chromiumLaunchOptions()); });
after(async () => { if (browser) await browser.close(); });

const withBundle = (run) => figures.withBundle(browser, run);
const draw = (text, width = WIDTH) => withBundle((page) => renderFigure(page, text, width));

// ---- texts ------------------------------------------------------------------------------------------------------

/** `text` with the directive on its own line after the direction line (as `toUml` writes it), else after @startuml. */
function withDirective(text, directive = DIRECTIVE) {
  const direction = text.match(/^layout (?:vertical|horizontal)$/m);
  return direction
    ? replaced(text, `${direction[0]}\n`, `${direction[0]}\n${directive}\n`)
    : replaced(text, '@startuml\n', `@startuml\n${directive}\n`);
}

/** `text` with a layout block after @startuml that saves `positions`: `{ id: [x, y] }`, a box's top-left corner. */
function withPositions(text, positions) {
  const lines = Object.entries(positions).map(([id, [x, y]]) => `node "${id}" x=${x} y=${y}`);
  return replaced(text, '@startuml\n', `@startuml\n@layout\n${lines.join('\n')}\n@endlayout\n`);
}

const pinned = (text, positions) => withDirective(withPositions(text, positions));

// ---- reading sides from the drawing ----------------------------------------------------------------------------

const EDGES = {
  top: (box) => ({ x: box.x, y: box.y, width: box.width, height: 0 }),
  bottom: (box) => ({ x: box.x, y: box.y + box.height, width: box.width, height: 0 }),
  left: (box) => ({ x: box.x, y: box.y, width: 0, height: box.height }),
  right: (box) => ({ x: box.x + box.width, y: box.y, width: 0, height: box.height }),
};

/** The side of `box` whose edge `point` lies nearest to. */
function sideOf(box, point) {
  return nearest(Object.keys(EDGES), (side) => pointToRect(point, EDGES[side](box)));
}

/** Where the line of `assembly` meets its two boxes: the end at the provider's box and the end at the consumer's. */
function assemblyEnds(figure, assembly) {
  const routes = routesOf(figure, assembly);
  const fromProvider = routes.find((route) => route.source === assembly.providerPort);
  const toConsumer = routes.find((route) => route.target === assembly.consumerPort);
  assert.ok(fromProvider && toConsumer, `${assembly.providerPort} → ${assembly.consumerPort} is drawn as a joined ball and socket`);
  return { provider: fromProvider.points[0], consumer: toConsumer.points.at(-1) };
}

/** The sides of its two boxes on which the line of `assembly` ends. */
function assemblySides(figure, assembly) {
  const ends = assemblyEnds(figure, assembly);
  return {
    provider: sideOf(boxById(figure, assembly.provider), ends.provider),
    consumer: sideOf(boxById(figure, assembly.consumer), ends.consumer),
  };
}

function assemblyOf(text, providerPort) {
  const found = statementsOf(text).assemblies.find((assembly) => assembly.providerPort === providerPort);
  assert.ok(found, `the text joins ${providerPort}`);
  return found;
}

/** `box` shrunk by `inset` on every side: its interior, without the edge a line ends on. */
function interior(box, inset = 1) {
  return { x: box.x + inset, y: box.y + inset, width: box.width - 2 * inset, height: box.height - 2 * inset };
}

/** The lowest y of the text written inside `box`: its name and keyword lines. */
function headerBottom(figure, box) {
  const lines = figure.texts.filter((entry) => contains(box, entry));
  assert.ok(lines.length > 0, `box ${box.id} shows its name`);
  return Math.max(...lines.map((entry) => entry.y + entry.height));
}

// ---- placements --------------------------------------------------------------------------------------------------

// Saved top-left corners in SVG user units. A box is about 270 wide and 70 to 150 tall, depending on how many of its
// ports sit on its left and right sides, so an offset of 300 down or 600 across leaves a clear gap.
const ENROLLMENT = assemblyOf(API, 'e2.p1');     // provider e2, consumer e1
const CARD_PAYMENTS = assemblyOf(SHOP, 'e2.p2'); // provider e2, consumer e1

/**
 * For each direction, the consumer of the assembly under test placed that way of its provider, in both views, with
 * the sides the directive gives the two ends. In `interfaces of api`, e3 stays beside or below e2, out of the way.
 */
const FACING = {
  below: {
    expected: { consumer: 'top', provider: 'bottom' },
    views: [
      { name: 'interfaces of app', text: SHOP, assembly: CARD_PAYMENTS, positions: { e2: [0, 0], e1: [0, 300] } },
      { name: 'interfaces of api', text: API, assembly: ENROLLMENT, positions: { e2: [0, 0], e1: [0, 300], e3: [700, 0] } },
    ],
  },
  above: {
    expected: { consumer: 'bottom', provider: 'top' },
    views: [
      { name: 'interfaces of app', text: SHOP, assembly: CARD_PAYMENTS, positions: { e1: [0, 0], e2: [0, 300] } },
      { name: 'interfaces of api', text: API, assembly: ENROLLMENT, positions: { e1: [0, 0], e2: [0, 300], e3: [700, 300] } },
    ],
  },
  'left of': {
    expected: { consumer: 'right', provider: 'left' },
    views: [
      { name: 'interfaces of app', text: SHOP, assembly: CARD_PAYMENTS, positions: { e1: [0, 0], e2: [600, 0] } },
      { name: 'interfaces of api', text: API, assembly: ENROLLMENT, positions: { e1: [0, 0], e2: [700, 0], e3: [700, 300] } },
    ],
  },
  'right of': {
    expected: { consumer: 'left', provider: 'right' },
    views: [
      { name: 'interfaces of app', text: SHOP, assembly: CARD_PAYMENTS, positions: { e2: [0, 0], e1: [600, 0] } },
      { name: 'interfaces of api', text: API, assembly: ENROLLMENT, positions: { e2: [0, 0], e1: [700, 0], e3: [0, 300] } },
    ],
  },
};

/** `interfaces of api` under layout horizontal: e2 and e3 where the automatic layout puts them, e1 moved below e2. */
const HORIZONTAL_PINS = { e2: [466, 0], e3: [952, 0], e1: [466, 300] };

/** Every placement the tests draw: the four directions in both views, the shop's two diagonals, and the reference
 * view under layout horizontal. */
function everyPlacement() {
  const placements = [];
  for (const [direction, { views }] of Object.entries(FACING)) {
    for (const view of views) placements.push({ name: `${view.name}, consumer ${direction} its provider`, text: view.text, positions: view.positions });
  }
  placements.push(
    { name: 'interfaces of app, diagonal with the larger gap down', text: SHOP, positions: { e2: [0, 0], e1: [400, 400] } },
    { name: 'interfaces of app, diagonal with the larger gap across', text: SHOP, positions: { e2: [0, 0], e1: [700, 150] } },
    { name: 'interfaces of api under layout horizontal, consumer below its provider', text: API_HORIZONTAL, positions: HORIZONTAL_PINS },
  );
  return placements;
}

// ---- facing ----------------------------------------------------------------------------------------------------

const SIDE_WORDS = { top: 'upper', bottom: 'lower', left: 'left', right: 'right' };

for (const [direction, { expected, views }] of Object.entries(FACING)) {
  test(`with the directive, a consumer placed ${direction} its provider has its socket on its ${SIDE_WORDS[expected.consumer]} side `
    + `and the provider's ball on its ${SIDE_WORDS[expected.provider]} side`, async (t) => {
    for (const view of views) {
      await t.test(view.name, async () => {
        const figure = await draw(pinned(view.text, view.positions));
        assert.deepEqual(assemblySides(figure, view.assembly), expected);
      });
    }
  });
}

test('placed diagonally, the sides face along the larger gap, and with equal gaps along the diagram\'s direction', async (t) => {
  const down = { consumer: 'top', provider: 'bottom' };
  const across = { consumer: 'left', provider: 'right' };
  // The gaps are measured between the boxes as the automatic layout sizes them, before any port turns.
  const automatic = { vertical: await draw(SHOP), horizontal: await draw(SHOP_HORIZONTAL) };
  /** e1 (the consumer) below and right of e2 with gaps `across` and `down` between the automatically sized boxes. */
  const diagonal = (layout, gapAcross, gapDown) => {
    const provider = boxById(automatic[layout], 'e2');
    return { e2: [0, 0], e1: [provider.width + gapAcross, provider.height + gapDown] };
  };
  const cases = [
    { name: 'the larger gap down', text: SHOP, positions: { e2: [0, 0], e1: [400, 400] }, expected: down },
    { name: 'the larger gap across', text: SHOP, positions: { e2: [0, 0], e1: [700, 150] }, expected: across },
    { name: 'equal gaps under layout vertical', text: SHOP, positions: diagonal('vertical', 150, 150), expected: down },
    { name: 'equal gaps under layout horizontal', text: SHOP_HORIZONTAL, positions: diagonal('horizontal', 150, 150), expected: across },
    { name: 'a gap across one unit larger, under layout vertical', text: SHOP, positions: diagonal('vertical', 151, 150), expected: across },
    { name: 'a gap down one unit larger, under layout horizontal', text: SHOP_HORIZONTAL, positions: diagonal('horizontal', 150, 151), expected: down },
  ];
  for (const { name, text, positions, expected } of cases) {
    await t.test(name, async () => {
      const figure = await draw(pinned(text, positions));
      assert.deepEqual(assemblySides(figure, CARD_PAYMENTS), expected);
    });
  }
});

test('a ball in several assemblies faces the partner of its first one', async () => {
  // e1 provides Charges to e2 (first) and to e3; e2 is placed right of e1, e3 below it.
  const text = withDirective([
    '@startuml', 'layout vertical',
    'component "Card Gateway" as e1 <<Software System>> {', '  provide "Charges" as p1', '}',
    'component "Checkout" as e2 <<Container>> {', '  require "Charges" as r1', '}',
    'component "Refunds" as e3 <<Container>> {', '  require "Charges" as r2', '}',
    'p1 --> r1', 'p1 --> r2', '@enduml',
  ].join('\n'));
  const figure = await draw(withPositions(text, { e1: [0, 0], e2: [700, 0], e3: [0, 300] }));
  const [first, second] = statementsOf(text).assemblies;
  assert.deepEqual(assemblySides(figure, first), { provider: 'right', consumer: 'left' });
  assert.deepEqual(assemblySides(figure, second), { provider: 'right', consumer: 'top' });
});

// Spec §6, "Boxes and lines": where the two boxes overlap along the facing direction, the ball and the socket sit at
// one x or one y and the line is straight. A port on a left or right side sits below its box's name and keyword and
// clear of its bottom edge, so two boxes beside each other get a straight line only at a height where both can hold a
// port. Where they overlap only outside such heights, the ports still face each other and the line bends in the gap.
// With the provider at [0, 0] and the consumer right of it, both views are straight up to the consumer 40 lower and
// bend from 45 lower on (measured 2026-11-14). Across a vertical gap every shared x can hold a port.
test('where both boxes can hold a port at one x or one y across the gap, the ball and the socket sit there and the line '
  + 'is straight', async (t) => {
  const cases = Object.entries(FACING).flatMap(([direction, { views }]) => views.map((view) => ({
    ...view, name: `${view.name}, consumer ${direction} its provider`, across: direction === 'below' || direction === 'above' ? 'x' : 'y',
  }))).concat([
    { name: 'interfaces of api, consumer below its provider and 150 to the right', text: API, assembly: ENROLLMENT,
      positions: { e2: [0, 0], e1: [150, 300], e3: [700, 0] }, across: 'x' },
    { name: 'interfaces of app, consumer right of its provider and 40 lower', text: SHOP, assembly: CARD_PAYMENTS,
      positions: { e2: [0, 0], e1: [600, 40] }, across: 'y' },
  ]);
  for (const { name, text, assembly, positions, across } of cases) {
    await t.test(name, async () => {
      const figure = await draw(pinned(text, positions));
      const points = routesOf(figure, assembly).flatMap((route) => route.points);
      const values = new Set(points.map((point) => Math.round(point[across] * 10) / 10));
      assert.equal(values.size, 1, `the line runs at one ${across}: ${JSON.stringify(points)}`);
    });
  }
});

test('where boxes beside each other overlap only at heights one of them cannot hold a port, the ball and the socket still '
  + 'face each other below each name and keyword, and the line, which may bend, crosses neither box', async (t) => {
  const cases = [
    { name: 'interfaces of app, consumer right of its provider and 60 lower', text: SHOP, assembly: CARD_PAYMENTS,
      positions: { e2: [0, 0], e1: [600, 60] }, expected: FACING['right of'].expected },
    { name: 'interfaces of api, consumer right of its provider and 60 lower', text: API, assembly: ENROLLMENT,
      positions: { e2: [0, 0], e1: [700, 60], e3: [0, 300] }, expected: FACING['right of'].expected },
    { name: 'interfaces of api, consumer right of its provider and 110 lower, the boxes overlapping by a sliver', text: API,
      assembly: ENROLLMENT, positions: { e2: [0, 0], e1: [700, 110], e3: [0, 300] }, expected: FACING['right of'].expected },
    { name: 'interfaces of app, consumer left of its provider and 60 higher', text: SHOP, assembly: CARD_PAYMENTS,
      positions: { e1: [0, 0], e2: [600, 60] }, expected: FACING['left of'].expected },
  ];
  for (const { name, text, assembly, positions, expected } of cases) {
    await t.test(name, async () => {
      const figure = await draw(pinned(text, positions));
      const boxes = { provider: boxById(figure, assembly.provider), consumer: boxById(figure, assembly.consumer) };
      assert.ok(boxes.consumer.y < boxes.provider.y + boxes.provider.height && boxes.provider.y < boxes.consumer.y + boxes.consumer.height,
        'the two boxes overlap along y');
      assert.deepEqual(assemblySides(figure, assembly), expected);
      const ends = assemblyEnds(figure, assembly);
      for (const role of ['provider', 'consumer']) {
        const box = boxes[role];
        assert.ok(ends[role].y > headerBottom(figure, box) && ends[role].y < box.y + box.height,
          `the ${role}'s end lies beside box ${box.id} below its name and keyword and above its bottom edge `
          + `(y ${ends[role].y.toFixed(1)})`);
        for (const route of routesOf(figure, assembly)) {
          assert.ok(routeToRect(route.points, interior(box)) > 0, `the line crosses box ${box.id}: ${JSON.stringify(route.points)}`);
        }
      }
    });
  }
});

test('boxes that overlap keep the sides of the automatic layout', async (t) => {
  const cases = [
    { name: 'interfaces of app', text: SHOP, assembly: CARD_PAYMENTS, positions: { e2: [0, 0], e1: [100, 40] } },
    { name: 'interfaces of api', text: API, assembly: ENROLLMENT, positions: { e2: [0, 0], e1: [120, 30], e3: [0, 300] } },
  ];
  for (const { name, text, assembly, positions } of cases) {
    await t.test(name, async () => {
      const automatic = await draw(text);
      const figure = await draw(pinned(text, positions));
      assert.deepEqual(assemblySides(figure, assembly), assemblySides(automatic, assembly));
    });
  }
});

test('the directive turns the ports in any letter case', async () => {
  const figure = await draw(pinned(SHOP, FACING.below.views[0].positions).replace(DIRECTIVE, 'Layout PORTS Facing'));
  assert.deepEqual(assemblySides(figure, CARD_PAYMENTS), FACING.below.expected);
});

test('an inline @pos gives a component its position as a layout block does', async () => {
  const text = withDirective([
    '@startuml', 'layout vertical',
    'component "Card Gateway" as gateway {', '  provide "Charges" as charges', '}',
    'component "Checkout" as checkout @pos(700, 0) {', '  require "Charges" as pay', '}',
    'charges --> pay', '@enduml',
  ].join('\n'));
  const figure = await draw(text);
  const assembly = { providerPort: 'gateway.charges', consumerPort: 'checkout.pay', provider: 'gateway', consumer: 'checkout' };
  assert.equal(boxById(figure, 'checkout').x, 700, 'the inline @pos places the consumer');
  assert.deepEqual(assemblySides(figure, assembly), { consumer: 'left', provider: 'right' });
});

// ---- lines and boxes ----------------------------------------------------------------------------------------------

test('the line of an assembly crosses neither of its two boxes, in each placement', async (t) => {
  for (const placement of everyPlacement()) {
    await t.test(placement.name, async () => {
      const figure = await draw(pinned(placement.text, placement.positions));
      for (const assembly of statementsOf(placement.text).assemblies) {
        for (const id of [assembly.provider, assembly.consumer]) {
          for (const route of routesOf(figure, assembly)) {
            assert.ok(routeToRect(route.points, interior(boxById(figure, id))) > 0,
              `${assembly.providerPort} → ${assembly.consumerPort} crosses box ${id}: ${JSON.stringify(route.points)}`);
          }
        }
      }
    });
  }
});

test('under layout horizontal, a consumer pinned below its provider has facing ports and its line crosses neither box', async () => {
  const figure = await draw(pinned(API_HORIZONTAL, HORIZONTAL_PINS));
  assert.deepEqual(assemblySides(figure, ENROLLMENT), { consumer: 'top', provider: 'bottom' });
  for (const id of ['e1', 'e2']) {
    for (const route of routesOf(figure, ENROLLMENT)) {
      assert.ok(routeToRect(route.points, interior(boxById(figure, id))) > 0, `the line crosses box ${id}: ${JSON.stringify(route.points)}`);
    }
  }
});

test('a pinned box keeps its top-left corner on its saved position when its ports change sides', async () => {
  const { text, positions } = FACING['left of'].views[1];
  const control = await draw(withPositions(text, positions));
  const figure = await draw(pinned(text, positions));
  assert.notDeepEqual(assemblySides(figure, ENROLLMENT), assemblySides(control, ENROLLMENT), 'the directive turns the ports');
  for (const [id, [x, y]] of Object.entries(positions)) {
    const box = boxById(figure, id);
    assert.deepEqual({ x: box.x, y: box.y }, { x, y }, `box ${id} keeps its saved corner`);
  }
});

test('a box without a saved position stays where the automatic layout puts it', async () => {
  // e1 and e3 are saved right of and below the subject e2, which has no position.
  const automatic = boxById(await draw(API), 'e2');
  const figure = await draw(pinned(API, { e1: [500, 153], e3: [300, 450] }));
  const box = boxById(figure, 'e2');
  assert.deepEqual({ x: box.x, y: box.y }, { x: automatic.x, y: automatic.y });
});

test('a ball with a saved position of its own keeps it', async () => {
  // e1 is below e2, so the directive would turn e2's Enrollment API ball to e2's lower side; its own saved position
  // puts it on e2's left side, 50 units below e2's top.
  const positions = { ...FACING.below.views[1].positions, 'e2.p1': [0, 50] };
  const figure = await draw(pinned(API, positions));
  const ends = assemblyEnds(figure, ENROLLMENT);
  assert.deepEqual(ends.provider, { x: 0, y: 50 });
  assert.equal(sideOf(boxById(figure, 'e2'), ends.provider), 'left');
});

test('a port outside every assembly keeps its automatic side', async () => {
  const positions = FACING.below.views[0].positions;
  const control = await draw(withPositions(SHOP, positions));
  const figure = await draw(pinned(SHOP, positions));
  /** The side of e1 nearest the centre of everything drawn for its unjoined port (stick and symbol). */
  const sideOfSymbol = (drawing) => {
    const parts = drawing.portSymbols.filter((symbol) => symbol.id === 'e1.p1');
    assert.ok(parts.length > 0, 'the unjoined Shop App interface is drawn');
    const left = Math.min(...parts.map((part) => part.x));
    const right = Math.max(...parts.map((part) => part.x + part.width));
    const top = Math.min(...parts.map((part) => part.y));
    const bottom = Math.max(...parts.map((part) => part.y + part.height));
    return sideOf(boxById(drawing, 'e1'), { x: (left + right) / 2, y: (top + bottom) / 2 });
  };
  assert.notDeepEqual(assemblySides(figure, CARD_PAYMENTS), assemblySides(control, CARD_PAYMENTS), 'the directive turns the joined ports');
  assert.equal(sideOfSymbol(figure), sideOfSymbol(control));
});

// ---- labels and widths -------------------------------------------------------------------------------------------

test('each interface name stays next to its ball and each assembly label nearest its own line, in each placement', async (t) => {
  for (const placement of everyPlacement()) {
    await t.test(placement.name, async () => {
      const figure = await draw(pinned(placement.text, placement.positions));
      const { assemblies } = statementsOf(placement.text);
      const claimed = new Set();
      for (const assembly of assemblies) {
        const ball = ballOf(figure, assembly);
        const names = figure.texts.filter((entry) => entry.text === assembly.interfaceName
          && nearest(figure.balls, (other) => pointToRect(other, entry)) === ball);
        assert.equal(names.length, 1, `one "${assembly.interfaceName}" label belongs to the ball of ${assembly.providerPort} → ${assembly.consumerPort}`);
        assert.ok(pointToRect(ball, names[0]) <= ball.r + 2 * names[0].height,
          `"${assembly.interfaceName}" sits beside its ball (distance ${pointToRect(ball, names[0]).toFixed(1)})`);
        const label = figure.texts.find((entry) => entry.text === assembly.label && !claimed.has(entry)
          && nearest(assemblies, (other) => distanceToAssembly(figure, other, entry)) === assembly);
        assert.ok(label, `a "${assembly.label}" label is nearer ${assembly.providerPort} → ${assembly.consumerPort} than any other connector`);
        assert.ok(distanceToAssembly(figure, assembly, label) <= label.height,
          `"${assembly.label}" sits beside its connector (distance ${distanceToAssembly(figure, assembly, label).toFixed(1)})`);
        claimed.add(label);
      }
    });
  }
});

test('no interface name or label of an assembly overlaps a component box, in each placement', async (t) => {
  for (const placement of everyPlacement()) {
    await t.test(placement.name, async () => {
      const figure = await draw(pinned(placement.text, placement.positions));
      const words = new Set(statementsOf(placement.text).assemblies.flatMap((assembly) => [assembly.interfaceName, assembly.label]));
      for (const label of figure.texts.filter((entry) => words.has(entry.text))) {
        for (const box of figure.boxes) assert.equal(overlaps(label, box), false, `"${label.text}" overlaps the box ${box.id}`);
      }
    });
  }
});

test('a pinned drawing with a fixed direction is the same at container widths 320 and 1200', async () => {
  const text = pinned(API, FACING.below.views[1].positions);
  const geometry = ({ boxes, routes, balls }) => ({ boxes, routes, balls });
  assert.deepEqual(geometry(await draw(text, 320)), geometry(await draw(text, 1200)));
});

// ---- guards: what the directive leaves as it is ------------------------------------------------------------------

test('without the directive a moved box keeps its ports on the sides of the automatic layout', async () => {
  const { text, positions } = FACING.below.views[1];
  const automatic = await draw(text);
  const moved = await draw(withPositions(text, positions));
  assert.ok(boxById(moved, 'e1').y > boxById(moved, 'e2').y + boxById(moved, 'e2').height, 'the consumer is moved below its provider');
  assert.deepEqual(assemblySides(moved, ENROLLMENT), assemblySides(automatic, ENROLLMENT));
});

/** The component examples of REFERENCE.md (`<pre><code class="language-uml-component">`, HTML-decoded). */
function referenceExamples() {
  const reference = fs.readFileSync(path.join(__dirname, '../../js/ArchUML/REFERENCE.md'), 'utf8');
  const decode = (text) => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  return [...reference.matchAll(/^[ \t]*<pre><code class="language-uml-component">([\s\S]*?)<\/code>/gm)]
    .map((match, index) => ({ name: `REFERENCE.md component example ${index + 1}`, text: decode(match[1]).trim() }));
}

function routingSpecs() {
  const dir = path.join(__dirname, 'fixtures/c4-routing/specs');
  return fs.readdirSync(dir).filter((name) => /^component-.*\.puml$/.test(name)).sort()
    .map((name) => ({ name: `routing spec ${name}`, text: fs.readFileSync(path.join(dir, name), 'utf8') }));
}

test('the directive without a saved component position draws the same SVG as no directive', async (t) => {
  const sources = referenceExamples().concat(routingSpecs(), FROZEN_NAMES.map((name) => ({ name, text: frozen(name) })), [
    { name: 'interfaces of api with a saved position of a port only', text: withPositions(API, { 'e2.p1': [0, 50] }) },
  ]);
  assert.ok(referenceExamples().length >= 4, 'REFERENCE.md has its component examples');
  assert.ok(routingSpecs().length >= 3, 'the routing specs are found');
  assert.equal(FROZEN_NAMES.length, 28, 'every frozen interfaces view is compared');
  const svgOf = (page, text) => page.evaluate((source) => {
    document.body.replaceChildren();
    const container = document.createElement('div');
    container.style.width = '760px';
    document.body.append(container);
    window.UMLComponentDiagram.render(container, source);
    return container.innerHTML;
  }, text);
  await withBundle(async (page) => {
    for (const { name, text } of sources) {
      await t.test(name, async () => {
        const plain = await svgOf(page, text);
        assert.match(plain, /<svg/, 'the source draws a diagram');
        assert.equal(await svgOf(page, withDirective(text)), plain);
      });
    }
  });
});

const parseIn = (text) => withBundle((page) => page.evaluate((source) => window.UMLComponentDiagram.parse(source), text));

test('the directive line adds no box, port, or connector', async (t) => {
  const statements = (parsed) => ({ components: parsed.components, connectors: parsed.connectors, notes: parsed.notes });
  for (const [name, text] of [['interfaces of api', API], ['interfaces of app', SHOP]]) {
    await t.test(name, async () => {
      assert.deepEqual(statements(await parseIn(withDirective(text))), statements(await parseIn(text)));
    });
  }
});

test('the directive changes neither the direction nor the layout preference', async (t) => {
  const settings = ({ direction, directionLocked, layoutPreference }) => ({ direction, directionLocked, layoutPreference });
  const texts = [['layout vertical', API], ['layout horizontal', API_HORIZONTAL],
    ['no direction, layout landscape', replaced(API, 'layout vertical\n', 'layout landscape\n')]];
  for (const [name, text] of texts) {
    await t.test(name, async () => {
      assert.deepEqual(settings(await parseIn(withDirective(text))), settings(await parseIn(text)));
    });
  }
});
