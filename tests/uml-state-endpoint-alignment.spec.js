const { test, expect } = require('@playwright/test');
const path = require('path');

const bundlePath = path.join(__dirname, '..', 'js', 'ArchUML', 'uml-bundle.js');
const orderLifecycle = `@startuml
[*] --> Created : Order Placed
Created --> Paid : payment_received
Paid --> Shipped : ship_order
Shipped --> Delivered : delivery_confirmed
Delivered --> [*]
Created --> Cancelled : cancel_order [within 24hrs]
Paid --> Refunded : refund_requested / processRefund()
Cancelled --> [*]
Refunded --> [*]
@enduml`;

async function renderState(page, source) {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.setContent('<main><div id="diagram"></div></main>');
  await page.addScriptTag({ path: bundlePath });
  await page.evaluate((text) => {
    window.UMLStateDiagram.render(document.getElementById('diagram'), text);
  }, source);
  await expect(page.getByRole('img')).toBeVisible();
  // Authored node/relationship IDs are the public layout editor contract.
  return page.getByRole('img').evaluate((svg) => ({
    circles: [...svg.querySelectorAll('circle[data-layout-bounds-id]')].map((circle) => ({
      id: circle.getAttribute('data-layout-bounds-id'),
      x: circle.cx.baseVal.value, y: circle.cy.baseVal.value, radius: circle.r.baseVal.value,
    })),
    nodes: [...svg.querySelectorAll('rect[data-layout-bounds-id]')].map((node) => {
      const box = node.getBBox();
      return { id: node.getAttribute('data-layout-bounds-id'),
        x: box.x, y: box.y, w: box.width, h: box.height };
    }),
    routes: [...svg.querySelectorAll('polyline[data-layout-source][data-layout-target]')].map((route) => {
      const toSvg = svg.getScreenCTM().inverse().multiply(route.getScreenCTM());
      return {
        source: route.getAttribute('data-layout-source'),
        target: route.getAttribute('data-layout-target'),
        points: [...route.points].map(({ x, y }) => ({ x, y })),
        svgPoints: [...route.points].map((point) => {
          const position = point.matrixTransform(toSvg);
          return { x: position.x, y: position.y };
        }),
      };
    }),
  }));
}

function expectAttached(point, node) {
  expect(point.x).toBeGreaterThanOrEqual(node.x - 0.01);
  expect(point.x).toBeLessThanOrEqual(node.x + node.w + 0.01);
  expect(point.y).toBeGreaterThanOrEqual(node.y - 0.01);
  expect(point.y).toBeLessThanOrEqual(node.y + node.h + 0.01);
  expect(Math.min(Math.abs(point.x - node.x), Math.abs(point.x - node.x - node.w),
    Math.abs(point.y - node.y), Math.abs(point.y - node.y - node.h)),
  `transition remains attached to ${node.id}`).toBeLessThan(0.01);
}

test('order refund transition aligns its free endpoint instead of drawing a tiny jog', async ({ page }) => {
  const geometry = await renderState(page, orderLifecycle);
  const refund = geometry.routes.find((route) => route.source === 'Paid' && route.target === 'Refunded');
  const shipping = geometry.routes.find((route) => route.source === 'Paid' && route.target === 'Shipped');
  expect(refund).toBeDefined();
  expect(shipping).toBeDefined();
  const ys = refund.points.map((point) => point.y);
  expect(Math.max(...ys) - Math.min(...ys), 'refund transition is a single horizontal line').toBeLessThan(0.01);
  expectAttached(refund.points[0], geometry.nodes.find((node) => node.id === 'Paid'));
  expectAttached(refund.points.at(-1), geometry.nodes.find((node) => node.id === 'Refunded'));
  expect(Math.abs(refund.points[0].y - shipping.points[0].y),
    'the two Paid transitions remain distinguishable').toBeGreaterThanOrEqual(12);
});

for (const [direction, targetPosition, axis] of [
  ['layout landscape', 'x=300 y=4', 'y'],
  ['layout portrait', 'x=4 y=300', 'x'],
]) {
  test(`automatic attachments align without moving authored nodes (${direction})`, async ({ page }) => {
    const geometry = await renderState(page, `@startuml
${direction}
state Source
state Target
Source --> Target : proceed
@layout
node Source x=0 y=0
node Target ${targetPosition}
@endlayout
@enduml`);
    const route = geometry.routes[0];
    const source = geometry.nodes.find((node) => node.id === 'Source');
    const target = geometry.nodes.find((node) => node.id === 'Target');
    const coordinates = route.points.map((point) => point[axis]);
    expect(geometry.routes).toHaveLength(1);
    expect(Math.max(...coordinates) - Math.min(...coordinates)).toBeLessThan(0.01);
    expect({ x: source.x, y: source.y }).toEqual({ x: 0, y: 0 });
    expect(target[axis]).toBe(4);
    expect(target[axis === 'x' ? 'y' : 'x']).toBe(300);
    expectAttached(route.points[0], source);
    expectAttached(route.points.at(-1), target);
  });
}

test('endpoint alignment keeps incoming transitions separated', async ({ page }) => {
  const geometry = await renderState(page, `@startuml
layout landscape
First --> Target : first
Second --> Target : second
@layout
node First x=0 y=0
node Second x=0 y=70
node Target x=350 y=5
@endlayout
@enduml`);
  const first = geometry.routes.find((route) => route.source === 'First');
  const second = geometry.routes.find((route) => route.source === 'Second');
  const ys = first.points.map((point) => point.y);
  expect(Math.max(...ys) - Math.min(...ys), 'eligible incoming transition is straight').toBeLessThan(0.01);
  expect(Math.abs(first.points.at(-1).y - second.points.at(-1).y),
    'separate incoming arrowheads remain distinguishable').toBeGreaterThanOrEqual(13);
});

test('alignment reserves exits used by neighboring transitions that cannot be straightened', async ({ page }) => {
  const geometry = await renderState(page, `@startuml
layout landscape
Source --> Far : forward
Source --> Near : beside
@layout
node Source x=0 y=0
node Far x=350 y=18.5
node Near x=100 y=100
@endlayout
@enduml`);
  expect(geometry.routes).toHaveLength(2);
  const forward = geometry.routes.find((route) => route.target === 'Far');
  const beside = geometry.routes.find((route) => route.target === 'Near');
  expect(Math.abs(forward.points[0].y - beside.points[0].y),
    'a nearby branch keeps its separately allocated source attachment').toBeGreaterThanOrEqual(13);
});

test('endpoint alignment does not straighten through an intervening state', async ({ page }) => {
  const geometry = await renderState(page, `@startuml
layout landscape
state Obstacle
Source --> Target : proceed
@layout
node Source x=0 y=0
node Obstacle x=180 y=0
node Target x=400 y=4
@endlayout
@enduml`);
  const route = geometry.routes[0];
  const obstacle = geometry.nodes.find((node) => node.id === 'Obstacle');
  expect(geometry.routes).toHaveLength(1);
  for (let index = 1; index < route.points.length; index++) {
    const a = route.points[index - 1], b = route.points[index];
    const enters = a.y === b.y
      ? a.y > obstacle.y && a.y < obstacle.y + obstacle.h &&
        Math.max(a.x, b.x) > obstacle.x && Math.min(a.x, b.x) < obstacle.x + obstacle.w
      : a.x > obstacle.x && a.x < obstacle.x + obstacle.w &&
        Math.max(a.y, b.y) > obstacle.y && Math.min(a.y, b.y) < obstacle.y + obstacle.h;
    expect(enters, 'transition stays outside the intervening state').toBe(false);
  }
  expectAttached(route.points[0], geometry.nodes.find((node) => node.id === 'Source'));
  expectAttached(route.points.at(-1), geometry.nodes.find((node) => node.id === 'Target'));
});

test('straightening does not hide a transition on an unrelated state outline', async ({ page }) => {
  const geometry = await renderState(page, `@startuml
layout landscape
state Obstacle
Source --> Target
@layout
node Source x=0 y=0
node Obstacle x=180 y=24
node Target x=400 y=4
@endlayout
@enduml`);
  const route = geometry.routes[0];
  const obstacle = geometry.nodes.find((node) => node.id === 'Obstacle');
  for (let i = 1; i < route.points.length; i++) {
    const a = route.points[i - 1], b = route.points[i];
    const tracesOutline = Math.abs(a.y - b.y) < 0.01 && Math.abs(a.y - obstacle.y) < 1.5 &&
      Math.min(Math.max(a.x, b.x), obstacle.x + obstacle.w) > Math.max(Math.min(a.x, b.x), obstacle.x);
    expect(tracesOutline, 'transition does not reuse an unrelated state outline').toBe(false);
  }
});

test('authored transition routes keep their exact endpoints and bends', async ({ page }) => {
  const geometry = await renderState(page, `@startuml
layout landscape
Source --> Target : proceed
@layout
node Source x=0 y=0
node Target x=300 y=4
route edge-0 points="120,24 200,24 200,28 300,28"
@endlayout
@enduml`);
  expect(geometry.routes).toHaveLength(1);
  expect(geometry.routes[0].svgPoints).toEqual([
    { x: 120, y: 24 }, { x: 200, y: 24 }, { x: 200, y: 28 }, { x: 300, y: 28 },
  ]);
});

test('parallel forward transitions align without merging their shafts or arrowheads', async ({ page }) => {
  const geometry = await renderState(page, `@startuml
layout landscape
Source --> Target : accept
Source --> Target : decline
@layout
node Source x=0 y=0
node Target x=300 y=4
@endlayout
@enduml`);
  expect(geometry.routes).toHaveLength(2);
  for (const route of geometry.routes) {
    const ys = route.points.map((point) => point.y);
    expect(Math.max(...ys) - Math.min(...ys), 'each parallel transition is straight').toBeLessThan(0.01);
    expectAttached(route.points[0], geometry.nodes.find((node) => node.id === 'Source'));
    expectAttached(route.points.at(-1), geometry.nodes.find((node) => node.id === 'Target'));
  }
  expect(Math.abs(geometry.routes[0].points[0].y - geometry.routes[1].points[0].y),
    'parallel routes remain distinguishable').toBeGreaterThanOrEqual(13);
});

test('straightened forward transitions preserve return lanes and pseudostate attachments', async ({ page }) => {
  const geometry = await renderState(page, `@startuml
layout landscape
[*] --> Source
Source --> Target : proceed
Target --> Source : retry
Target --> [*]
@layout
node Source x=100 y=0
node Target x=400 y=4
node __initial__0 x=0 y=16
node __final__0 x=600 y=17
@endlayout
@enduml`);
  const forward = geometry.routes.find((route) => route.source === 'Source' && route.target === 'Target');
  const back = geometry.routes.find((route) => route.source === 'Target' && route.target === 'Source');
  const source = geometry.nodes.find((node) => node.id === 'Source');
  const target = geometry.nodes.find((node) => node.id === 'Target');
  expect(geometry.routes).toHaveLength(4);
  expect(forward.points.every((point) => Math.abs(point.y - forward.points[0].y) < 0.01)).toBe(true);
  expectAttached(back.points[0], target);
  expectAttached(back.points.at(-1), source);
  expect(Math.max(...back.points.map((point) => point.y)), 'return remains outside the forward flow')
    .toBeGreaterThan(Math.max(source.y + source.h, target.y + target.h));
  for (const [id, endpoint] of [
    ['__initial__0', geometry.routes.find((route) => route.source === '__initial__0').points[0]],
    ['__final__0', geometry.routes.find((route) => route.target === '__final__0').points.at(-1)],
  ]) {
    const circle = geometry.circles.filter((item) => item.id === id).sort((a, b) => b.radius - a.radius)[0];
    expect(circle, `${id} renders its pseudostate symbol`).toBeDefined();
    const gap = Math.hypot(endpoint.x - circle.x, endpoint.y - circle.y) - circle.radius;
    expect(gap, 'the route does not enter the pseudostate symbol').toBeGreaterThanOrEqual(-0.01);
    // Final rings reserve two pixels for their outline around the circle.
    expect(gap, 'the route remains at the pseudostate outline').toBeLessThanOrEqual(2.01);
    expect(Math.min(Math.abs(endpoint.x - circle.x), Math.abs(endpoint.y - circle.y)),
      'the endpoint stays on a cardinal attachment of the circle').toBeLessThan(0.01);
  }
});
