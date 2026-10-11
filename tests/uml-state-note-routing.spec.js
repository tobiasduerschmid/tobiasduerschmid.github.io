const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const bundle = path.join(__dirname, '../js/ArchUML/uml-bundle.js');
const examples = fs.readFileSync(path.join(__dirname, '../test-uml.html'), 'utf8');
const stateWithNote = examples.split('<h2>35. State Diagram with Note</h2>')[1]
  .split('<code class="language-uml-state">')[1].split('</code>')[0];

async function renderNote(page, source) {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.setContent('<main><div id="diagram"></div></main>');
  await page.addScriptTag({ path: bundle });
  await page.evaluate((source) => window.UMLStateDiagram.render(document.getElementById('diagram'), source), source);
  const image = page.getByRole('img');
  await expect(image).toBeVisible();
  return image.evaluate((svg) => {
    const bounds = (element) => {
      const b = element.getBBox();
      return { x: b.x, y: b.y, w: b.width, h: b.height };
    };
    const points = (element) => element.tagName.toLowerCase() === 'line'
      ? [{ x: Number(element.getAttribute('x1')), y: Number(element.getAttribute('y1')) },
        { x: Number(element.getAttribute('x2')), y: Number(element.getAttribute('y2')) }]
      : [...element.points].map(({ x, y }) => ({ x, y }));
    // Diagram leaders and notation have no separate accessible roles. Their
    // actual SVG geometry is the contract being checked, not router internals.
    return {
      notes: [...svg.querySelectorAll('.uml-note-box')].map(bounds),
      leaders: [...svg.querySelectorAll('.uml-note-connector')].map(points),
      svgLeaders: [...svg.querySelectorAll('.uml-note-connector')].map((leader) => {
        const transform = svg.getScreenCTM().inverse().multiply(leader.getScreenCTM());
        return points(leader).map((point) => {
          const position = new DOMPoint(point.x, point.y).matrixTransform(transform);
          return { x: position.x, y: position.y };
        });
      }),
      canvas: { w: svg.viewBox.baseVal.width, h: svg.viewBox.baseVal.height },
      labels: [...svg.querySelectorAll('text')].map((text) => ({ text: text.textContent, ...bounds(text) })),
      routes: [...svg.querySelectorAll('polyline[data-layout-source][data-layout-target]')].map(points),
      states: [...svg.querySelectorAll('rect[data-layout-bounds-id]')].map((node) => ({
        id: node.getAttribute('data-layout-bounds-id'), stroke: Number(node.getAttribute('stroke-width')), ...bounds(node),
      })),
    };
  });
}

function segmentEntersRect(a, b, rect) {
  let enter = 0, leave = 1;
  for (const [axis, size] of [['x', 'w'], ['y', 'h']]) {
    const delta = b[axis] - a[axis];
    const min = rect[axis] + 0.1, max = rect[axis] + rect[size] - 0.1;
    if (Math.abs(delta) < 0.001) {
      if (a[axis] <= min || a[axis] >= max) return false;
      continue;
    }
    const first = (min - a[axis]) / delta, last = (max - a[axis]) / delta;
    enter = Math.max(enter, Math.min(first, last));
    leave = Math.min(leave, Math.max(first, last));
    if (enter >= leave) return false;
  }
  return leave > 0 && enter < 1;
}

for (const direction of ['auto', 'portrait', 'landscape']) {
test(`state note leaders do not cross transition labels or shafts (${direction})`, async ({ page }) => {
  const source = direction === 'auto' ? stateWithNote : stateWithNote.replace('@startuml', `@startuml\nlayout ${direction}`);
  const geometry = await renderNote(page, source);
  expect(geometry.leaders).toHaveLength(1);
  expect(geometry.labels.some((label) => label.text === 'retry')).toBe(true);
  for (const leader of geometry.leaders) {
    for (let index = 1; index < leader.length; index++) {
      for (const label of geometry.labels) {
        expect(segmentEntersRect(leader[index - 1], leader[index], label),
          `note leader leaves ${label.text} readable`).toBe(false);
      }
      for (const state of geometry.states) {
        expect(segmentEntersRect(leader[index - 1], leader[index], state),
          `note leader stays outside ${state.id}`).toBe(false);
      }
      for (const route of geometry.routes) {
        for (let segment = 1; segment < route.length; segment++) {
          const a = route[segment - 1], b = route[segment];
          const stroke = { x: Math.min(a.x, b.x) - 0.5, y: Math.min(a.y, b.y) - 0.5,
            w: Math.abs(a.x - b.x) + 1, h: Math.abs(a.y - b.y) + 1 };
          expect(segmentEntersRect(leader[index - 1], leader[index], stroke),
            'note leader does not cross a transition').toBe(false);
        }
      }
    }
    const endpoint = leader.at(-1);
    const target = geometry.states.find((state) => state.id === 'Processing');
    expect(Math.min(Math.abs(endpoint.x - target.x), Math.abs(endpoint.x - target.x - target.w),
      Math.abs(endpoint.y - target.y), Math.abs(endpoint.y - target.y - target.h)),
    'note still attaches to Processing').toBeLessThan(0.01);
    expect(endpoint.x).toBeGreaterThanOrEqual(target.x - 0.01);
    expect(endpoint.x).toBeLessThanOrEqual(target.x + target.w + 0.01);
    expect(endpoint.y).toBeGreaterThanOrEqual(target.y - 0.01);
    expect(endpoint.y).toBeLessThanOrEqual(target.y + target.h + 0.01);
  }
  for (const leader of geometry.svgLeaders) {
    for (const point of leader) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(geometry.canvas.w);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(geometry.canvas.h);
    }
  }
});
}

test('state note routing preserves an authored note position', async ({ page }) => {
  await renderNote(page, stateWithNote);
  const noteId = await page.evaluate((source) => window.UMLStateDiagram.parse(source).notes[0].id, stateWithNote);
  const source = stateWithNote.replace('@enduml', `@layout\nnode "${noteId}" x=600 y=-100\n@endlayout\n@enduml`);
  const geometry = await renderNote(page, source);
  expect(geometry.notes).toHaveLength(1);
  expect(geometry.notes[0].x).toBe(600);
  expect(geometry.notes[0].y).toBe(-100);
  expect(geometry.leaders).toHaveLength(1);
  for (let index = 1; index < geometry.leaders[0].length; index++) {
    for (const label of geometry.labels) {
      expect(segmentEntersRect(geometry.leaders[0][index - 1], geometry.leaders[0][index], label),
        `saved-note leader keeps ${label.text} readable`).toBe(false);
    }
  }
});

test('a slightly offset state note uses a straight leader by sliding its attachment', async ({ page }) => {
  const spec = '@startuml\nstate Processing\nnote right of Processing: check\n@enduml';
  await renderNote(page, spec);
  const noteId = await page.evaluate((source) => window.UMLStateDiagram.parse(source).notes[0].id, spec);
  const source = spec.replace('@enduml', `@layout\nnode Processing x=0 y=0\nnode "${noteId}" x=300 y=8\n@endlayout\n@enduml`);
  const geometry = await renderNote(page, source);
  expect(geometry.leaders).toHaveLength(1);
  const ys = geometry.leaders[0].map((point) => point.y);
  expect(Math.max(...ys) - Math.min(...ys), 'free note attachments avoid an unnecessary jog').toBeLessThan(0.01);
  expect(geometry.notes[0].x).toBe(300);
  expect(geometry.notes[0].y).toBe(8);
});

test('state note leaders stay clear of unrelated state outlines', async ({ page }) => {
  const spec = '@startuml\nstate Target\nstate Obstacle\nnote right of Target: check\n@enduml';
  await renderNote(page, spec);
  const noteId = await page.evaluate((source) => window.UMLStateDiagram.parse(source).notes[0].id, spec);
  const source = spec.replace('@enduml', `@layout\nnode Target x=0 y=0\nnode Obstacle x=200 y=24\nnode "${noteId}" x=400 y=5\n@endlayout\n@enduml`);
  const geometry = await renderNote(page, source);
  expect(geometry.leaders).toHaveLength(1);
  const obstacle = geometry.states.find((state) => state.id === 'Obstacle');
  const outline = { x: obstacle.x - obstacle.stroke / 2, y: obstacle.y - obstacle.stroke / 2,
    w: obstacle.w + obstacle.stroke, h: obstacle.h + obstacle.stroke };
  const leader = geometry.leaders[0];
  for (let index = 1; index < leader.length; index++) {
    expect(segmentEntersRect(leader[index - 1], leader[index], outline),
      'the note leader must remain distinguishable from the state outline').toBe(false);
  }
  for (const [point, box] of [[leader[0], geometry.notes[0]],
    [leader.at(-1), geometry.states.find((state) => state.id === 'Target')]]) {
    expect(point.x).toBeGreaterThanOrEqual(box.x - 0.01);
    expect(point.x).toBeLessThanOrEqual(box.x + box.w + 0.01);
    expect(point.y).toBeGreaterThanOrEqual(box.y - 0.01);
    expect(point.y).toBeLessThanOrEqual(box.y + box.h + 0.01);
    expect(Math.min(Math.abs(point.x - box.x), Math.abs(point.x - box.x - box.w),
      Math.abs(point.y - box.y), Math.abs(point.y - box.y - box.h)),
    'the leader still attaches to its note and target state').toBeLessThan(0.01);
  }
});
