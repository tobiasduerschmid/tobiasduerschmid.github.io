const { test, expect } = require('@playwright/test');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

async function setup(page) {
  await page.setContent('<main><p>Surrounding paragraph.</p><div id="diagram"></div></main>');
  await page.addStyleTag({ path: path.join(root, 'css/uml-diagram.css') });
  await page.addStyleTag({ path: path.join(root, 'js/ArchUML/css/callouts.css') });
  await page.addScriptTag({ path: path.join(root, 'js/ArchUML/uml-bundle.js') });
  await page.addScriptTag({ path: path.join(root, 'js/uml-auto-describe.js') });
}

async function render(page, type, source) {
  return page.evaluate(({ type, source }) => {
    const names = { class: 'Class', sequence: 'Sequence', state: 'State', component: 'Component', usecase: 'UseCase' };
    const container = document.getElementById('diagram');
    window[`UML${names[type]}Diagram`].render(container, source);
    window.UMLShared.applySvgAccessibility(container, type, source);
  }, { type, source });
}

const examples = [
  ['class', 'interface Account {\n+ balance: Money\n}\nclass Money\nAccount --> Money', 'text "+"', 'Public visibility'],
  ['class', 'interface Account', 'text "«interface»"', 'An interface contract'],
  ['sequence', 'participant client: Client\nparticipant server: Server\nclient -> server: request()', 'edge 1 end', 'Caller waits for completion'],
  ['sequence', 'participant client: Client\nparticipant server: Server\nclient -> server: request()', 'shape line', 'A participant lifeline'],
  ['state', '[*] --> Idle\nIdle --> Active : start', 'element Idle', 'A condition during the object lifetime'],
  ['component', 'component Service {\nportin "api" as api\n}', 'element Service.api', 'A named interaction point'],
  ['component', 'component Client\ncomponent Server\nClient ..> Server : uses', 'text "uses"', 'The dependency label'],
  ['class', 'class Account {\n+ balance: Money\n}', 'element Account', 'The class box'],
  ['class', 'class Account\nclass Savings\nSavings --|> Account', 'shape polygon', 'The generalization triangle'],
  ['usecase', 'usecase \"Buy item\" as Buy\nusecase \"Login\" as Login\nBuy ..> Login', 'edge 1 end', 'Included behavior'],
  ['usecase', 'usecase \"Buy item\" as Buy', 'element Buy', 'The use case oval'],
  ['usecase', 'actor Customer\nusecase "Buy" as Buy\nCustomer -- Buy', 'text "Buy"', 'A goal the system supports'],
];

for (const [type, model, target, text] of examples) {
  test(`${type}: teaching callouts can point to ${target}`, async ({ page }) => {
    await setup(page);
    await render(page, type, `@startuml\n${model}\ncallout right of ${target} : ${text}\n@enduml`);
    await expect(page.getByText(text, { exact: true })).toBeVisible();
    await expect(page.getByRole('img')).toHaveAccessibleName(new RegExp(text));
    // These SVG classes are the documented styling/export contract.
    await expect(page.locator('.uml-callout-pointer')).toHaveCount(1);
    expect(await page.locator('.uml-callout-box').evaluate(box => {
      const a = box.getBoundingClientRect();
      return [...box.ownerSVGElement.querySelectorAll('.uml-model-layer text')].every(label => {
        const b = label.getBoundingClientRect();
        return a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
      });
    }), 'callout must not cover a model label').toBe(true);
  });
}

test('callouts use dark blue in light mode and gold in dark mode, with light print colors', async ({ page }) => {
  await setup(page);
  await render(page, 'class', 'class Account\ncallout right of text "Account" : A template for objects');
  const box = page.locator('.uml-callout-box');
  const label = page.getByText('A template for objects', { exact: true });
  await expect(box).toHaveCSS('fill', 'rgb(0, 59, 92)');
  await expect(label).toHaveCSS('fill', 'rgb(255, 255, 255)');
  await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
  await expect(box).toHaveCSS('fill', 'rgb(255, 209, 0)');
  await expect(label).toHaveCSS('fill', 'rgb(0, 59, 92)');
  await expect(page.locator('svg')).toHaveCSS('filter', 'none');
  await page.emulateMedia({ media: 'print' });
  await expect(box).toHaveCSS('fill', 'rgb(0, 59, 92)');
  await expect(label).toHaveCSS('fill', 'rgb(255, 255, 255)');
  await expect(page.locator('.uml-model-layer')).toHaveCSS('filter', 'none');
});

test('callouts stay readable in narrow panes and do not accumulate after rerendering', async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 320, height: 900 });
  const source = 'class Account\ncallout right of text "Account" : The class specifies the structure and behavior shared by its instances.';
  await render(page, 'class', source);
  await render(page, 'class', source);
  await expect(page.locator('.uml-callout-box')).toHaveCount(1);
  const measurements = await page.locator('.uml-callout text').evaluateAll(labels => labels.map(label => {
    const scale = label.getScreenCTM();
    return parseFloat(getComputedStyle(label).fontSize) * Math.hypot(scale.c, scale.d);
  }));
  const paragraph = await page.getByText('Surrounding paragraph.', { exact: true }).evaluate(p => parseFloat(getComputedStyle(p).fontSize));
  expect(Math.min(...measurements)).toBeGreaterThanOrEqual(paragraph - 0.1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

// Inspect the painted pointer outline in screen coordinates. This independent
// segment/rectangle oracle catches needles crossing labels even when their
// boxes do not overlap; it does not assume the renderer's placement strategy.
async function layoutProblems(page) {
  return page.locator('svg').evaluate(svg => {
    const boxes = [...svg.querySelectorAll('.uml-callout-box')];
    const tails = [...svg.querySelectorAll('.uml-callout-pointer')];
    const labels = [...svg.querySelectorAll('.uml-model-layer text')];
    const lines = [...svg.querySelectorAll('.uml-model-layer line')];
    const strokes = [...svg.querySelectorAll('.uml-model-layer line, .uml-model-layer polyline, .uml-model-layer path')];
    const problems = [];
    const overlap = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
    function segmentHitsRect(a, b, rect) {
      let low = 0, high = 1;
      for (const [axis, start, end] of [['x', rect.left + 1, rect.right - 1], ['y', rect.top + 1, rect.bottom - 1]]) {
        const delta = b[axis] - a[axis];
        if (delta === 0) { if (a[axis] <= start || a[axis] >= end) return false; }
        else {
          const first = (start - a[axis]) / delta, last = (end - a[axis]) / delta;
          low = Math.max(low, Math.min(first, last)); high = Math.min(high, Math.max(first, last));
          if (low >= high) return false;
        }
      }
      return low < high;
    }
    boxes.forEach((box, index) => {
      const rect = box.getBoundingClientRect();
      for (const label of labels) if (overlap(rect, label.getBoundingClientRect())) problems.push(`Box ${index + 1} covers ${label.textContent}`);
      for (const other of boxes.slice(index + 1)) if (overlap(rect, other.getBoundingClientRect())) problems.push(`Box ${index + 1} covers another callout`);
      for (const line of lines) {
        const transform = line.getScreenCTM();
        const a = new DOMPoint(line.x1.baseVal.value, line.y1.baseVal.value).matrixTransform(transform);
        const b = new DOMPoint(line.x2.baseVal.value, line.y2.baseVal.value).matrixTransform(transform);
        if (segmentHitsRect(a, b, rect)) problems.push(`Box ${index + 1} covers a model line`);
      }
    });
    tails.forEach((tail, index) => {
      const transform = tail.getScreenCTM();
      const points = [...tail.points].map(point => new DOMPoint(point.x, point.y).matrixTransform(transform));
      for (const stroke of strokes) {
        if (stroke.closest('defs')) continue;
        const length = stroke.getTotalLength();
        for (let distance = 0; distance <= length; distance += 2) {
          const local = stroke.getPointAtLength(distance);
          const point = new DOMPoint(local.x, local.y).matrixTransform(stroke.getScreenCTM());
          // A pointer may attach to its target stroke at the tip.
          if (Math.hypot(point.x - points[1].x, point.y - points[1].y) < 12 * Math.hypot(transform.a, transform.b)) continue;
          if (tail.isPointInFill(point.matrixTransform(transform.inverse()))) {
            problems.push(`Pointer ${index + 1} crosses a model stroke`);
            break;
          }
        }
      }
      for (const element of labels.concat(boxes.filter((_, other) => other !== index))) {
        const rect = element.getBoundingClientRect();
        const containsCorner = [[rect.left + 1, rect.top + 1], [rect.right - 1, rect.bottom - 1]].some(([x, y]) =>
          tail.isPointInFill(new DOMPoint(x, y).matrixTransform(transform.inverse())));
        if (containsCorner || points.some((point, i) => segmentHitsRect(point, points[(i + 1) % points.length], rect))) {
          problems.push(`Pointer ${index + 1} crosses ${element.textContent || 'another callout'}`);
        }
      }
    });
    return problems;
  });
}

const fs = require('node:fs');
const chapterFiles = fs.readdirSync(path.join(root, 'SEBook')).filter(file => /^uml_.*_diagram\.md$/.test(file));
for (const file of chapterFiles) {
  test(`${file}: every authored diagram has clear teaching callouts`, async ({ page }) => {
    await setup(page);
    const markdown = fs.readFileSync(path.join(root, 'SEBook', file), 'utf8');
    let index = 0;
    const failures = [];
    for (const match of markdown.matchAll(/<div\b[^>]*\bdata-uml-spec=(["'])([\s\S]*?)\1[^>]*>/g)) {
      index++;
      const type = match[0].match(/data-uml-type=["']([^"']+)["']/)[1];
      const source = await page.evaluate(raw => {
        const textarea = document.createElement('textarea'); textarea.innerHTML = raw;
        return textarea.value.replace(/^\s*> ?/gm, '');
      }, match[2]);
      expect(source, `Diagram ${index} has a notation explanation`).toContain('callout ');
      await render(page, type, source);
      const problems = await layoutProblems(page);
      if (problems.length) failures.push({ diagram: index, problems });
    }
    expect(failures).toEqual([]);
  });
}

test('nearby callouts stay compact, with short wide pointers that miss labels', async ({ page }) => {
  await setup(page);
  await render(page, 'class', `layout horizontal
layout landscape
class User {
  - username: String
  # id: int
  + login(): boolean
}
callout left of text "-" : Private: only this class can access it.
callout left of text "#" : Protected: accessible in this class and subclasses.
callout left of text "+" : Public: any client can access it.`);
  expect(await layoutProblems(page)).toEqual([]);
  const geometry = await page.locator('.uml-callout').evaluateAll(groups => groups.map(group => {
    const box = group.querySelector('.uml-callout-box');
    const [a, tip, b] = [...group.querySelector('.uml-callout-pointer').points];
    return {
      height: box.height.baseVal.value,
      length: Math.hypot((a.x + b.x) / 2 - tip.x, (a.y + b.y) / 2 - tip.y),
      base: Math.hypot(a.x - b.x, a.y - b.y),
    };
  }));
  // These sit in empty space beside the markers; the old layout sent 60-unit needles.
  expect(Math.max(...geometry.map(item => item.length))).toBeLessThan(50);
  expect(Math.min(...geometry.map(item => item.base))).toBeGreaterThan(13);

  await render(page, 'class', `layout horizontal
layout landscape
class Student { - name: String }
class Course { - title: String }
Student "*" -- "1..*" Course : enrolled in
callout bottom of text "1..*" : Multiplicity 1..*: at least one
callout top of text "*" : Multiplicity *: zero or more
callout bottom of edge 1 middle : Association: links between objects`);
  expect(await layoutProblems(page)).toEqual([]);
  const association = await page.locator('.uml-callout-pointer').evaluateAll(tails => tails.map(tail => {
    const [a, tip, b] = [...tail.points];
    return Math.hypot((a.x + b.x) / 2 - tip.x, (a.y + b.y) / 2 - tip.y);
  }));
  expect(Math.max(...association)).toBeLessThan(75);

  await render(page, 'class', `class Order
class LineItem
Order *-- LineItem
callout right of edge 1 start : The filled diamond marks Order as the composite owner of its line items.`);
  expect(await layoutProblems(page)).toEqual([]);
  const diamond = await page.locator('.uml-callout-pointer').evaluate(tail => {
    const [a, tip, b] = [...tail.points];
    return { length: Math.hypot((a.x + b.x) / 2 - tip.x, (a.y + b.y) / 2 - tip.y),
      base: Math.hypot(a.x - b.x, a.y - b.y) };
  });
  expect(diamond.length).toBeLessThan(30);
  expect(diamond.base).toBeGreaterThan(13);
});

test('inheritance explanations stay beside their triangles with short pointers', async ({ page }) => {
  await setup(page);
  await render(page, 'class', `interface Vehicle {\n+ startEngine(): void\n}\nclass Car {\n- make: String\n+ startEngine(): void\n}\nclass Sedan\nclass SUV\nCar ..|> Vehicle\nSedan --|> Car\nSUV --|> Car
callout right of shape polygon occurrence 1 : Dashed line and hollow triangle: Car realizes the Vehicle contract.
callout left of shape polygon occurrence 2 : Solid line and hollow triangle: the triangle points to the superclass.`);
  expect(await layoutProblems(page)).toEqual([]);
  const lengths = await page.locator('.uml-callout-pointer').evaluateAll(tails => tails.map(tail => {
    const [a, tip, b] = [...tail.points];
    return Math.hypot((a.x + b.x) / 2 - tip.x, (a.y + b.y) / 2 - tip.y);
  }));
  // The supplied bad examples had pointers hundreds of SVG units long.
  // These examples have nearby empty space, within roughly five text lines.
  expect(Math.max(...lengths)).toBeLessThan(100);
});

test('a diagram rendered inside a hidden panel gains its callouts when revealed', async ({ page }) => {
  await setup(page);
  await page.locator('main').evaluate(main => { main.hidden = true; });
  await render(page, 'class', 'class Account {\n+ balance: Money\n}\ncallout left of text "+" : Public field');
  await page.locator('main').evaluate(main => { main.hidden = false; });
  await expect(page.getByText('Public field', { exact: true })).toBeVisible();
  expect(await layoutProblems(page)).toEqual([]);
});

test('worker-rendered diagrams retain their teaching callouts', async ({ page }) => {
  await page.goto('/SEBook/uml_class_diagram.html');
  const result = await page.evaluate(async () => {
    const target = document.createElement('div');
    target.id = 'worker-callout-example';
    document.querySelector('main').appendChild(target);
    const client = window.UMLLive.createClient();
    try {
      return await client.render({ type: 'class', syntax: 'class Account\ncallout right of text "Account" : A template for objects', target, readOnly: true });
    } finally { client.dispose(); }
  });
  expect(result).toBe(true);
  await expect(page.locator('#worker-callout-example').getByText('A template for objects', { exact: true })).toBeVisible();
});

test('standalone SVG output includes readable callout colors', async ({ page }) => {
  const { renderUML } = require('../js/ArchUML/uml_to_svg.js');
  const svg = await renderUML('class', 'class Account\ncallout right of text "Account" : A template for objects');
  await page.setContent(svg);
  await expect(page.locator('.uml-callout-box')).toHaveCSS('fill', 'rgb(0, 59, 92)');
  await expect(page.getByText('A template for objects', { exact: true })).toHaveCSS('fill', 'rgb(255, 255, 255)');
});

test('downloading from the editor retains the current callout colors', async ({ page }, testInfo) => {
  await page.goto('/SEBook/tools/uml-playground.html');
  await page.locator('#uml-pg-input').fill('class Account\ncallout right of text "Account" : A template for objects');
  const output = page.locator('#uml-pg-output');
  await expect(output.locator('.uml-callout-box')).toBeVisible();
  const fill = await output.locator('.uml-callout-box').evaluate(box => getComputedStyle(box).fill);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Download SVG/ }).click();
  const file = testInfo.outputPath('callout.svg');
  await (await download).saveAs(file);
  await page.setContent(fs.readFileSync(file, 'utf8'));
  await expect(page.locator('.uml-callout-box')).toHaveCSS('fill', fill);
  await expect(page.getByText('A template for objects', { exact: true })).toBeVisible();
});
