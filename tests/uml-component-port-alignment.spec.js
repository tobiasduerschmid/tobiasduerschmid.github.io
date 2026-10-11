const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, '..', 'js', 'ArchUML', 'uml-bundle.js');
const examples = fs.readFileSync(path.join(__dirname, '..', 'test-uml.html'), 'utf8');

function componentExample(title) {
  return examples.split(`<h2>${title}</h2>`)[1]
    .split('<code class="language-uml-component">')[1].split('</code>')[0];
}

async function renderComponent(page, spec) {
  await page.setContent('<main><div id="diagram"></div></main>');
  await page.addScriptTag({ path: bundlePath });
  await page.evaluate((source) => {
    window.UMLComponentDiagram.render(document.getElementById('diagram'), source);
  }, spec);
  await expect(page.getByRole('img')).toBeVisible();
}

async function renderedGeometry(page) {
  // The layout editor exposes diagram elements and relationship endpoints by
  // their authored IDs. Measure the rendered SVG, never the layout algorithm.
  return page.getByRole('img').evaluate((svg) => {
    const ports = [...svg.querySelectorAll('rect[data-layout-kind="port"]')].map((port) => {
      const box = port.getBBox();
      return { id: port.getAttribute('data-layout-id'),
        parent: port.getAttribute('data-layout-parent'),
        side: port.getAttribute('data-port-side'),
        x: box.x + box.width / 2, y: box.y + box.height / 2,
        height: box.height };
    });
    const routes = [...svg.querySelectorAll('polyline[data-layout-source][data-layout-target]')]
      .map((route) => ({
        source: route.getAttribute('data-layout-source'),
        target: route.getAttribute('data-layout-target'),
        points: [...route.points].map(({ x, y }) => ({ x, y })),
      }));
    return { ports, routes };
  });
}

test('adjacent gateway ports align before their reciprocal links are routed', async ({ page }) => {
  await renderComponent(page, componentExample('27. Microservice API Gateway (Port-to-Port)'));
  const { ports, routes } = await renderedGeometry(page);
  for (const [source, target] of [
    ['Notifications.n_out1', 'Events.e_p2'],
    ['Events.e_out2', 'Notifications.n_p1'],
  ]) {
    const route = routes.find((item) => item.source === source && item.target === target);
    expect(route, `${source} connects to ${target}`).toBeDefined();
    const ys = route.points.map((point) => point.y);
    expect(Math.max(...ys) - Math.min(...ys), `${source} has no avoidable vertical jog`).toBeLessThan(0.01);
    const sourcePort = ports.find((port) => port.id === source);
    const targetPort = ports.find((port) => port.id === target);
    expect(route.points[0].y, 'route remains attached to source port').toBeCloseTo(sourcePort.y, 2);
    expect(route.points.at(-1).y, 'route remains attached to target port').toBeCloseTo(targetPort.y, 2);
  }
  for (let i = 0; i < ports.length; i++) {
    for (let j = i + 1; j < ports.length; j++) {
      const a = ports[i], b = ports[j];
      if (a.parent !== b.parent || a.side !== b.side) continue;
      expect(Math.abs(a.y - b.y), `${a.id} and ${b.id} keep room for their labels`)
        .toBeGreaterThanOrEqual((a.height + b.height) / 2 + 8);
    }
  }
});

test('small endpoint jogs preserve explicitly positioned component ports', async ({ page }) => {
  await renderComponent(page, `@startuml
component Sender {
  portout "send" as outgoing
}
component Receiver {
  portin "receive" as incoming
}
outgoing --> incoming : message
@layout
node Sender x=0 y=0
node Receiver x=350 y=0
node Sender.outgoing x=140 y=60
node Receiver.incoming x=350 y=65
@endlayout
@enduml`);
  const { ports, routes } = await renderedGeometry(page);
  expect(ports.find((port) => port.id === 'Sender.outgoing').y).toBe(60);
  expect(ports.find((port) => port.id === 'Receiver.incoming').y).toBe(65);
  expect(routes).toHaveLength(1);
  expect(routes[0].points[0].y).toBe(60);
  expect(routes[0].points.at(-1).y).toBe(65);
});

test('ports near a component bottom retain room for their readable labels', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await renderComponent(page, componentExample('27c. Component Dashed Visual Style'));
  const labels = await page.getByRole('img').evaluate((svg) => {
    return [['Source', 'events'], ['Worker', 'jobs'], ['Worker', 'status']].map(([parent, name]) => {
      const component = svg.querySelector(`rect.uml-component-box[data-layout-id="${parent}"]`).getBBox();
      const label = [...svg.querySelectorAll('text')].find((element) => element.textContent === name).getBBox();
      return { parent, name, clearance: component.y + component.height - label.y - label.height };
    });
  });
  expect(labels).toHaveLength(3);
  for (const label of labels) {
    expect(label.clearance, `${label.parent}.${label.name} label clears the component border`)
      .toBeGreaterThanOrEqual(4);
  }
});
