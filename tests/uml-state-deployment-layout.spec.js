const { test, expect } = require('@playwright/test');
const path = require('path');

const bundlePath = path.join(__dirname, '..', 'js', 'ArchUML', 'uml-bundle.js');
const stylesheetPath = path.join(__dirname, '..', 'css', 'uml-diagram.css');
const deployment = `@startuml
node LoadBalancer {
  component Nginx
}
node AppNode1 {
  component UserService
  component OrderService
}
node AppNode2 {
  component PaymentService
  component NotificationService
}
node DataNode {
  component MongoDB
  component Redis
}
LoadBalancer --> AppNode1 : HTTP
LoadBalancer --> AppNode2 : HTTP
AppNode1 --> DataNode : TCP
AppNode2 --> DataNode : TCP
AppNode1 ..> AppNode2 : gRPC
@enduml`;

const stateExamples = [
  ['Order lifecycle', `@startuml
[*] --> Created : Order Placed
Created --> Paid : payment_received
Paid --> Shipped : ship_order
Shipped --> Delivered : delivery_confirmed
Delivered --> [*]
Created --> Cancelled : cancel_order [within 24hrs]
Paid --> Refunded : refund_requested / processRefund()
Cancelled --> [*]
Refunded --> [*]
@enduml`, 6],
  ['Music player', `@startuml
[*] --> Idle
Idle --> Buffering : playTrack(trackId)
Buffering --> Playing : bufferReady
Buffering --> Idle : loadError / showErrorMessage()
Playing --> Paused : pauseButton
Paused --> Playing : playButton
Playing --> Buffering : skipTrack(nextId) / clearBuffer()
Playing --> Idle : stopButton
@enduml`, 7],
];

async function render(page, api, source) {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.setContent('<main><div id="diagram"></div></main>');
  await page.addStyleTag({ path: stylesheetPath });
  await page.locator('#diagram').evaluate((container) => { container.style.width = '920px'; });
  await page.addScriptTag({ path: bundlePath });
  await page.evaluate(({ api, source }) => {
    window[api].render(document.getElementById('diagram'), source);
  }, { api, source });
  await expect(page.getByRole('img')).toBeVisible();
}

function segmentEntersBox(a, b, box) {
  // A route can end on a node border. Only a visible segment inside the
  // rectangle is a collision; tolerate SVG's subpixel coordinate rounding.
  const epsilon = 0.5;
  if (Math.abs(a.x - b.x) < epsilon) {
    return a.x > box.x + epsilon && a.x < box.x + box.w - epsilon &&
      Math.max(a.y, b.y) > box.y + epsilon && Math.min(a.y, b.y) < box.y + box.h - epsilon;
  }
  return a.y > box.y + epsilon && a.y < box.y + box.h - epsilon &&
    Math.max(a.x, b.x) > box.x + epsilon && Math.min(a.x, b.x) < box.x + box.w - epsilon;
}

for (const direction of ['', 'layout landscape', 'layout portrait']) {
  test(`deployment connectors stay outside nodes (${direction || 'automatic layout'})`, async ({ page }) => {
    await render(page, 'UMLDeploymentDiagram', deployment.replace('@startuml', `@startuml\n${direction}`));
    const geometry = await page.getByRole('img').evaluate((svg) => {
      const box = (element) => {
        const value = element.getBBox();
        return { x: value.x, y: value.y, w: value.width, h: value.height };
      };
      const rectangles = [...svg.querySelectorAll('rect')].filter((element) => !element.closest('defs')).map(box);
      const nodes = ['LoadBalancer', 'AppNode1', 'AppNode2', 'DataNode'].map((name) => {
        const label = [...svg.querySelectorAll('text')].find((element) => element.textContent === name);
        const text = box(label);
        const containing = rectangles.filter((rect) => text.x >= rect.x && text.y >= rect.y &&
          text.x + text.w <= rect.x + rect.w && text.y + text.h <= rect.y + rect.h);
        return { name, ...containing.sort((a, b) => b.w * b.h - a.w * a.h)[0] };
      });
      const routes = [...svg.querySelectorAll('polyline')].filter((element) => !element.closest('defs'))
        .map((element) => [...element.points].map(({ x, y }) => ({ x, y })))
        // Open arrowhead wings are diagonal; the relationship shafts are orthogonal.
        .filter((points) => points.every((point, index) => index === 0 ||
          Math.abs(point.x - points[index - 1].x) < 0.01 || Math.abs(point.y - points[index - 1].y) < 0.01));
      return { nodes, routes };
    });
    expect(geometry.nodes).toHaveLength(4);
    expect(geometry.routes).toHaveLength(5);
    for (const route of geometry.routes) {
      for (let index = 1; index < route.length; index++) {
        for (const node of geometry.nodes) {
          expect(segmentEntersBox(route[index - 1], route[index], node),
            `connector ${JSON.stringify(route)} stays outside ${node.name}`).toBe(false);
        }
      }
      for (const endpoint of [route[0], route.at(-1)]) {
        const attached = geometry.nodes.some((node) =>
          ((Math.abs(endpoint.x - node.x) < 0.5 || Math.abs(endpoint.x - node.x - node.w) < 0.5) &&
            endpoint.y >= node.y - 0.5 && endpoint.y <= node.y + node.h + 0.5) ||
          ((Math.abs(endpoint.y - node.y) < 0.5 || Math.abs(endpoint.y - node.y - node.h) < 0.5) &&
            endpoint.x >= node.x - 0.5 && endpoint.x <= node.x + node.w + 0.5));
        expect(attached, 'connector ends on a node boundary').toBe(true);
      }
    }
  });
}

for (const connection of ['Server --> API', 'API --> Server']) {
  test(`deployment connection ${connection} stays inside its enclosing node`, async ({ page }) => {
    await render(page, 'UMLDeploymentDiagram', `@startuml
node Server {
  component API
}
${connection} : hosts
@enduml`);
    const geometry = await page.getByRole('img').evaluate((svg) => {
      const rectangles = [...svg.querySelectorAll('rect')].filter((element) => !element.closest('defs'));
      const box = (element) => {
        const b = element.getBBox();
        return { x: b.x, y: b.y, w: b.width, h: b.height };
      };
      const nodeForLabel = (name) => {
        const text = box([...svg.querySelectorAll('text')].find((element) => element.textContent === name));
        return rectangles.map(box).filter((rect) => text.x >= rect.x && text.y >= rect.y &&
          text.x + text.w <= rect.x + rect.w && text.y + text.h <= rect.y + rect.h)
          .sort((a, b) => a.w * a.h - b.w * b.h)[0];
      };
      const routes = [...svg.querySelectorAll('polyline[data-layout-source][data-layout-target]')]
        .map((element) => [...element.points].map(({ x, y }) => ({ x, y })));
      return { parent: nodeForLabel('Server'), child: nodeForLabel('API'), routes };
    });
    expect(geometry.routes).toHaveLength(1);
    const endpoints = connection.startsWith('Server')
      ? [geometry.parent, geometry.child] : [geometry.child, geometry.parent];
    for (const [index, endpoint] of [geometry.routes[0][0], geometry.routes[0].at(-1)].entries()) {
      const box = endpoints[index];
      expect(endpoint.x).toBeGreaterThanOrEqual(box.x - 0.5);
      expect(endpoint.x).toBeLessThanOrEqual(box.x + box.w + 0.5);
      expect(endpoint.y).toBeGreaterThanOrEqual(box.y - 0.5);
      expect(endpoint.y).toBeLessThanOrEqual(box.y + box.h + 0.5);
      expect(Math.min(Math.abs(endpoint.x - box.x), Math.abs(endpoint.x - box.x - box.w),
        Math.abs(endpoint.y - box.y), Math.abs(endpoint.y - box.y - box.h)),
      'connector remains attached to the authored endpoint').toBeLessThan(0.5);
    }
    for (const point of geometry.routes[0]) {
      expect(point.x).toBeGreaterThanOrEqual(geometry.parent.x - 0.5);
      expect(point.y).toBeGreaterThanOrEqual(geometry.parent.y - 0.5);
      expect(point.x).toBeLessThanOrEqual(geometry.parent.x + geometry.parent.w + 0.5);
      expect(point.y).toBeLessThanOrEqual(geometry.parent.y + geometry.parent.h + 0.5);
    }
    for (let i = 1; i < geometry.routes[0].length; i++) {
      expect(segmentEntersBox(geometry.routes[0][i - 1], geometry.routes[0][i], geometry.child),
        'containment connection stops at the nested component boundary').toBe(false);
    }
  });
}

for (const [name, source, labelCount] of stateExamples) {
  test(`${name} transition labels remain visible and clear of every route`, async ({ page }) => {
    await render(page, 'UMLStateDiagram', source);
    const geometry = await page.getByRole('img').evaluate((image) => {
      // An overflowing image exposes its scroll container to accessibility.
      // Content must fit its SVG canvas, not the scroll viewport.
      const svg = image.matches('svg') ? image : image.querySelector('svg');
      const labels = [...svg.querySelectorAll('text[data-layout-kind="edge-label"]')].map((element) => {
        const box = element.getBBox();
        const screen = element.getBoundingClientRect();
        return { text: element.textContent, route: element.getAttribute('data-layout-route-id'), x: box.x, y: box.y, w: box.width, h: box.height,
          screen: { x: screen.x, y: screen.y, w: screen.width, h: screen.height } };
      });
      const routes = [...svg.querySelectorAll('polyline[data-layout-source][data-layout-target]')]
        .map((element) => ({ id: element.getAttribute('data-layout-route-id'),
          points: [...element.points].map(({ x, y }) => ({ x, y })) }));
      const bounds = svg.getBoundingClientRect();
      return { labels, routes, bounds: { x: bounds.x, y: bounds.y, w: bounds.width, h: bounds.height } };
    });
    expect(geometry.labels).toHaveLength(labelCount);
    expect(geometry.routes.length).toBeGreaterThan(labelCount);
    for (const label of geometry.labels) {
      expect(label.screen.x).toBeGreaterThanOrEqual(geometry.bounds.x - 0.5);
      expect(label.screen.y).toBeGreaterThanOrEqual(geometry.bounds.y - 0.5);
      expect(label.screen.x + label.screen.w).toBeLessThanOrEqual(geometry.bounds.x + geometry.bounds.w + 0.5);
      expect(label.screen.y + label.screen.h).toBeLessThanOrEqual(geometry.bounds.y + geometry.bounds.h + 0.5);
      for (const route of geometry.routes) {
        for (let index = 1; index < route.points.length; index++) {
          expect(segmentEntersBox(route.points[index - 1], route.points[index], label), `${label.text} remains readable`).toBe(false);
        }
      }
      if (/^(refund_requested|loadError)/.test(label.text)) {
        const distance = (route) => Math.min(...route.points.slice(1).map((end, index) => {
          const start = route.points[index];
          const dx = Math.max(0, Math.min(start.x, end.x) - label.x - label.w, label.x - Math.max(start.x, end.x));
          const dy = Math.max(0, Math.min(start.y, end.y) - label.y - label.h, label.y - Math.max(start.y, end.y));
          return Math.hypot(dx, dy);
        }));
        const ownRoute = geometry.routes.find(route => route.id === label.route);
        expect(ownRoute, 'the label retains its relationship identity').toBeDefined();
        expect(distance(ownRoute), `${label.text} stays beside its own transition`).toBeLessThanOrEqual(20);
        expect(distance(ownRoute), `${label.text} is closest to its own transition`).toBeLessThanOrEqual(
          Math.min(...geometry.routes.map(distance)) + 0.5);
      }
    }
  });
}
