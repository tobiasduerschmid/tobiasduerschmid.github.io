const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const examples = fs.readFileSync(path.join(__dirname, '../test-uml.html'), 'utf8');
const allRelationships = examples.split('<h2>3. All Relationship Types</h2>')[1]
  .split('<code class="language-uml-class">')[1].split('</code>')[0];

async function renderClass(page, source) {
  await page.setContent('<main><div id="diagram"></div></main>');
  await page.addScriptTag({ path: path.join(__dirname, '../js/ArchUML/uml-bundle.js') });
  await page.evaluate((spec) => window.UMLClassDiagram.render(document.getElementById('diagram'), spec), source);
  await expect(page.getByRole('img')).toBeVisible();
}

async function markerBounds(page) {
  // UML diamonds and triangles carry relationship semantics, but have no
  // separate accessible role. Measure their visible polygon outlines.
  return page.getByRole('img').evaluate((svg) => [...svg.querySelectorAll('polygon')]
    .filter((polygon) => polygon.points.length === 3 || polygon.points.length === 4)
    .map((polygon) => {
      const bounds = polygon.getBBox();
      const stroke = Number(polygon.getAttribute('stroke-width')) / 2;
      return { kind: polygon.points.length === 4 ? 'diamond' : 'triangle',
        left: bounds.x - stroke, right: bounds.x + bounds.width + stroke,
        top: bounds.y - stroke, bottom: bounds.y + bounds.height + stroke };
    }));
}

for (const reverse of [false, true]) {
  test(`composition and aggregation diamonds stay distinct beside inheritance${reverse ? ' when declared in reverse order' : ''}`, async ({ page }) => {
    const source = reverse
      ? allRelationships.replace('Shape *-- Color\nShape o-- Canvas', 'Shape o-- Canvas\nShape *-- Color')
      : allRelationships;
    await renderClass(page, source);
    const markers = await markerBounds(page);
    expect(markers.filter((marker) => marker.kind === 'diamond')).toHaveLength(2);
    expect(markers.filter((marker) => marker.kind === 'triangle')).toHaveLength(1);
    for (let i = 0; i < markers.length; i++) {
      for (let j = i + 1; j < markers.length; j++) {
        const a = markers[i], b = markers[j];
        const separation = Math.max(b.left - a.right, a.left - b.right, b.top - a.bottom, a.top - b.bottom);
        expect(separation, `${a.kind} ${i} and ${b.kind} ${j} remain visually separate`).toBeGreaterThanOrEqual(4);
      }
    }
  });
}

test('automatic marker spacing preserves an explicitly authored relationship route', async ({ page }) => {
  const points = [{ x: 210, y: 140 }, { x: 210, y: 185 }, { x: 390, y: 185 }, { x: 390, y: 240 }];
  await renderClass(page, allRelationships);
  const routeId = await page.getByRole('img').evaluate((svg) => [...svg.querySelectorAll('polyline[data-layout-source]')]
    .find((line) => line.getAttribute('data-layout-source') === 'Shape' && line.getAttribute('data-layout-target') === 'Canvas')
    .getAttribute('data-layout-route-id'));
  // Use the route identifier exposed to the editor, then replay the authored
  // override without assuming declaration order or internal relationship IDs.
  const source = allRelationships.replace('@enduml', `@layout
edge "${routeId}" points="${points.map(({ x, y }) => `${x},${y}`).join(' ')}"
@endlayout
@enduml`);
  await page.evaluate((spec) => window.UMLClassDiagram.render(document.getElementById('diagram'), spec), source);
  const route = await page.getByRole('img').evaluate((svg) => {
    const element = [...svg.querySelectorAll('polyline[data-layout-source]')]
      .find((line) => line.getAttribute('data-layout-source') === 'Shape' && line.getAttribute('data-layout-target') === 'Canvas');
    const transform = svg.getCTM().inverse().multiply(element.getCTM());
    return [...element.points].map((point) => {
      const rendered = point.matrixTransform(transform);
      return { x: rendered.x, y: rendered.y };
    });
  });
  expect(route).toEqual(points);
});

async function markerShaftIntrusions(page) {
  return page.getByRole('img').evaluate((svg) => {
    const markers = [...svg.querySelectorAll('polygon')]
      .filter((polygon) => polygon.points.length === 3 || polygon.points.length === 4)
      .map((polygon) => polygon.getBBox());
    const shafts = [...svg.querySelectorAll('line, polyline')].flatMap((element) => {
      const points = element.tagName.toLowerCase() === 'line'
        ? [{ x: Number(element.getAttribute('x1')), y: Number(element.getAttribute('y1')) },
          { x: Number(element.getAttribute('x2')), y: Number(element.getAttribute('y2')) }]
        : [...element.points];
      return points.slice(1).map((point, index) => [points[index], point]);
    });
    return markers.flatMap((marker, index) => shafts.filter(([a, b]) => {
      // Terminating at a marker tip or triangle base is intentional; entering
      // the visible marker interior conceals the relationship's notation.
      if (Math.abs(a.x - b.x) < 0.01) {
        return a.x > marker.x + 0.01 && a.x < marker.x + marker.width - 0.01 &&
          Math.min(a.y, b.y) < marker.y + marker.height - 0.01 && Math.max(a.y, b.y) > marker.y + 0.01;
      }
      if (Math.abs(a.y - b.y) < 0.01) {
        return a.y > marker.y + 0.01 && a.y < marker.y + marker.height - 0.01 &&
          Math.min(a.x, b.x) < marker.x + marker.width - 0.01 && Math.max(a.x, b.x) > marker.x + 0.01;
      }
      return false;
    }).map(([a, b]) => ({ marker: index, a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y } })));
  });
}

test('relationship shafts do not cut through neighboring diamonds or inheritance triangles', async ({ page }) => {
  await renderClass(page, allRelationships);
  expect(await markerShaftIntrusions(page)).toEqual([]);
});

for (const count of [1, 6, 8]) {
  test(`${count} recursive whole-part relationships keep all endpoint diamonds distinct`, async ({ page }) => {
    await renderClass(page, ['@startuml', 'class Whole',
      ...Array.from({ length: count }, (_, index) => `Whole ${index % 2 ? 'o' : '*'}-- Whole : part${index}`),
      '@enduml'].join('\n'));
    const markers = await markerBounds(page);
    expect(markers).toHaveLength(count);
    for (let i = 0; i < markers.length; i++) {
      for (let j = i + 1; j < markers.length; j++) {
        const a = markers[i], b = markers[j];
        expect(Math.max(b.left - a.right, a.left - b.right, b.top - a.bottom, a.top - b.bottom),
          `recursive diamonds ${i} and ${j} remain distinct`).toBeGreaterThanOrEqual(4);
      }
    }
    expect(await markerShaftIntrusions(page), 'recursive shafts do not hide an endpoint diamond').toEqual([]);
  });
}
