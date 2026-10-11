const { test, expect } = require('@playwright/test');
const path = require('path');

// Render through the public API with real browser font metrics. Geometry is
// the contract here; exact coordinates and the choice of routing algorithm are not.
for (const direction of ['', 'top to bottom direction', 'layout portrait']) {
  for (const { relationshipCount, reciprocal } of [
    { relationshipCount: 3, reciprocal: false },
    { relationshipCount: 6, reciprocal: false },
    { relationshipCount: 8, reciprocal: true },
  ]) {
    test(`${direction || 'default'}: ${relationshipCount} ${reciprocal ? 'reciprocal' : 'parallel'} multiline component labels remain distinct`, async ({ page }) => {
      await page.setContent('<main><div id="diagram"></div></main>');
      await page.addScriptTag({ path: path.resolve('js/ArchUML/uml-bundle.js') });
      const source = [
        '@startuml', direction, 'component Client', 'component Server',
        ...Array.from({ length: relationshipCount }, (_, i) =>
          `${reciprocal && i % 2 ? 'Server --> Client' : 'Client --> Server'} : request${i} /users/subscriptions/{userId}`),
        '@enduml',
      ].join('\n');
      await page.evaluate(source => window.UMLComponentDiagram.render(document.getElementById('diagram'), source), source);
      const geometry = await page.getByRole('img').evaluate(svg => {
        const boxes = [...svg.querySelectorAll('text')].filter(el => el.textContent.includes('request')).map(el => {
          const box = el.getBBox();
          return { text: el.textContent.trim(), route: el.closest('[data-layout-kind="edge-label"]').getAttribute('data-layout-id').replace(/^label:/, ''),
            left: box.x, top: box.y, right: box.x + box.width, bottom: box.y + box.height };
        });
        const collisions = [];
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i], b = boxes[j];
            if (a.left < b.right + 2 && a.right + 2 > b.left && a.top < b.bottom + 2 && a.bottom + 2 > b.top) {
              collisions.push([a.text, b.text]);
            }
          }
        }
        // Authored relationship IDs are the layout editor's identity contract.
        const routes = [...svg.querySelectorAll('polyline[data-layout-route-id]')].map(el => ({
          id: el.getAttribute('data-layout-route-id'), points: [...el.points],
        }));
        function distance(box, route) {
          return Math.min(...route.points.slice(1).map((end, i) => {
            const start = route.points[i];
            const dx = Math.max(0, Math.min(start.x, end.x) - box.right, box.left - Math.max(start.x, end.x));
            const dy = Math.max(0, Math.min(start.y, end.y) - box.bottom, box.top - Math.max(start.y, end.y));
            return Math.hypot(dx, dy);
          }));
        }
        const ambiguousLabels = boxes.filter(box => {
          const ownRoute = routes.find(route => route.id === box.route);
          return !ownRoute || distance(box, ownRoute) > Math.min(...routes.map(route => distance(box, route))) + 0.1;
        }).map(box => box.text);
        const componentBoxes = [...svg.querySelectorAll('rect.uml-component-box')].map(el => {
          const box = el.getBBox();
          return { left: box.x, top: box.y, right: box.x + box.width, bottom: box.y + box.height };
        });
        const nodeCollisions = boxes.filter(a => componentBoxes.some(b =>
          a.left < b.right + 2 && a.right + 2 > b.left && a.top < b.bottom + 2 && a.bottom + 2 > b.top
        )).map(box => box.text);
        const routeCollisions = boxes.filter(box => routes.some(route => distance(box, route) < 2)).map(box => box.text);
        return { count: boxes.length, routeCount: routes.length, nodeCount: componentBoxes.length,
          collisions, ambiguousLabels, nodeCollisions, routeCollisions };
      });
      expect(geometry.count, 'Every relationship keeps its label').toBe(relationshipCount);
      expect(geometry.routeCount, 'Every relationship keeps its route').toBe(relationshipCount);
      expect(geometry.nodeCount, 'Both component bodies are checked').toBe(2);
      expect(geometry.nodeCollisions, 'Labels remain outside component bodies').toEqual([]);
      expect(geometry.routeCollisions, 'No relationship line passes through a label').toEqual([]);
      expect(geometry.collisions, 'Multiline labels must have separate readable bounds').toEqual([]);
      expect(geometry.ambiguousLabels, 'A label stays closest to its own parallel relationship').toEqual([]);
    });
  }
}

test('long API path segments remain readable without breaking component rendering', async ({ page }) => {
  await page.setContent('<main><div id="diagram"></div></main>');
  await page.addScriptTag({ path: path.resolve('js/ArchUML/uml-bundle.js') });
  await page.evaluate(() => window.UMLComponentDiagram.render(document.getElementById('diagram'), `@startuml
component Client
component Server
Client --> Server : GET /subscriptionNotificationConfiguration/{userId}
@enduml`));
  await expect(page.getByRole('img')).toBeVisible();
  await expect(page.getByRole('img')).toContainText('/subscriptionNotificationConfiguration');
  await expect(page.getByRole('img')).toContainText('/{userId}');
});
