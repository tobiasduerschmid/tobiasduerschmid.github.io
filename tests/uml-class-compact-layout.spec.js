const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const strategyPage = fs.readFileSync(path.join(__dirname, '../SEBook/designpatterns/strategy.md'), 'utf8');
const duckStrategy = [...strategyPage.matchAll(/data-uml-spec='([^']+)'/g)]
  .map((match) => match[1]).find((source) => source.includes('class FlyNullObject'));
const classNames = ['Duck', 'MallardDuck', 'RubberDuck', 'FlyBehavior', 'FlyWithWings',
  'FlyNullObject', 'QuackBehavior', 'Quack', 'Squeak'];

async function renderGeometry(page, source = duckStrategy) {
  await page.setContent('<main><div id="diagram"></div></main>');
  await page.addScriptTag({ path: path.join(__dirname, '../js/ArchUML/uml-bundle.js') });
  await page.evaluate((source) => window.UMLClassDiagram.render(document.getElementById('diagram'), source), source);
  const image = page.getByRole('img');
  await expect(image).toBeVisible();
  return image.evaluate((svg, names) => {
    const texts = [...svg.querySelectorAll('text')];
    const rects = [...svg.querySelectorAll('rect')].filter((rect) => !rect.closest('defs'));
    const bounds = (element) => {
      const box = element.getBBox();
      const matrix = svg.getScreenCTM().inverse().multiply(element.getScreenCTM());
      const topLeft = new DOMPoint(box.x, box.y).matrixTransform(matrix);
      const bottomRight = new DOMPoint(box.x + box.width, box.y + box.height).matrixTransform(matrix);
      return { x: topLeft.x, y: topLeft.y, width: bottomRight.x - topLeft.x, height: bottomRight.y - topLeft.y };
    };
    const boxes = {};
    for (const name of names) {
      const text = texts.find((text) => text.textContent.trim() === name);
      if (!text) continue;
      const label = bounds(text);
      // Class compartments share their outer outline. Choose the largest
      // visible rectangle enclosing the class name, including its body.
      boxes[name] = rects.map(bounds).filter((box) => label.x >= box.x - 1 &&
        label.y >= box.y - 1 && label.x + label.width <= box.x + box.width + 1 &&
        label.y + label.height <= box.y + box.height + 1)
        .sort((a, b) => b.width * b.height - a.width * a.height)[0];
    }
    return { boxes, viewBox: { width: svg.viewBox.baseVal.width, height: svg.viewBox.baseVal.height },
      notes: [...svg.querySelectorAll('.uml-note-box')].map(bounds),
      labels: texts.filter((text) => ['flyBehavior', 'quackBehavior'].includes(text.textContent.trim())).map(bounds) };
  }, classNames);
}

function intersects(a, b) {
  return Math.min(a.x + a.width, b.x + b.width) > Math.max(a.x, b.x) + 0.5 &&
    Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y) + 0.5;
}

test('landscape hierarchy siblings do not inherit spacing from unrelated association labels', async ({ page }) => {
  const { boxes } = await renderGeometry(page);
  expect(Object.keys(boxes)).toHaveLength(9);
  for (const pair of [['MallardDuck', 'RubberDuck'], ['FlyWithWings', 'FlyNullObject'], ['Quack', 'Squeak']]) {
    const [left, right] = pair.map((name) => boxes[name]).sort((a, b) => a.x - b.x);
    const gap = right.x - left.x - left.width;
    expect(gap, `${pair.join(' and ')} retain a readable routing corridor`).toBeGreaterThanOrEqual(24);
    expect(gap, `${pair.join(' and ')} need at most six label-height lines of whitespace`).toBeLessThanOrEqual(120);
  }
});

test('short hierarchy families use their own parent height', async ({ page }) => {
  const { boxes } = await renderGeometry(page);
  for (const [parent, child] of [['FlyBehavior', 'FlyWithWings'], ['QuackBehavior', 'Quack']]) {
    const gap = boxes[child].y - boxes[parent].y - boxes[parent].height;
    expect(gap, `${child} stays below its parent with room for the inheritance arrow`).toBeGreaterThanOrEqual(24);
    expect(gap, `${parent} does not reserve the taller Duck body height`).toBeLessThanOrEqual(120);
  }
});

test('a compacted hierarchy preserves every class and association label without overlaps', async ({ page }) => {
  const { boxes, labels, notes } = await renderGeometry(page);
  expect(Object.keys(boxes)).toHaveLength(9);
  expect(labels).toHaveLength(2);
  expect(notes).toHaveLength(1);
  const overlaps = [];
  for (const [name, box] of Object.entries(boxes)) {
    for (const [otherName, other] of Object.entries(boxes)) {
      if (name < otherName && intersects(box, other)) overlaps.push([name, otherName]);
    }
    [...labels, ...notes].forEach((label, index) => { if (intersects(box, label)) overlaps.push([name, `annotation ${index}`]); });
  }
  expect(overlaps).toEqual([]);
});

test('manual class coordinates take precedence over automatic family compaction', async ({ page }) => {
  const source = duckStrategy.replace('@startuml', '@startuml\n@layout schema=1 renderer="archuml-visual-editor"\nnode "FlyWithWings" x=100 y=500\nnode "FlyNullObject" x=800 y=500\n@endlayout');
  const { boxes } = await renderGeometry(page, source);
  expect(boxes.FlyNullObject.x - boxes.FlyWithWings.x).toBeCloseTo(700, 1);
  expect(boxes.FlyNullObject.y - boxes.FlyWithWings.y).toBeCloseTo(0, 1);
});
