// @ts-check
// The readable fit of the shared diagram view (js/ArchUML/uml-bundle.js, sizeDiagramForReadability; C4 figures use
// it): a diagram whose container declares data-uml-fit="readable" fits its pane only while its smallest label stays
// at the container's text size (16 px here), and otherwise keeps that size and scrolls; it never gets the fit control.
// The real renderer and stylesheet, with a synthetic drawing, so the rule is checked apart from any layout.
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');

// Inline the real CSS import tree so this component fixture needs no server.
function readStyle(file) {
  return fs.readFileSync(file, 'utf8').replace(/@import url\("([^"]+)"\);/g,
    (_, relative) => readStyle(path.resolve(path.dirname(file), relative)));
}

/** A readable-fit figure in an 800 px window (a 784 px pane): `width` SVG units wide, its text `fontSize` units. */
async function readableFitFixture(page, { width, fontSize }) {
  await page.setViewportSize({ width: 800, height: 600 });
  await page.setContent(`<html lang="en"><head><title>Readable fit</title></head><body>
    <main><p>Readable fit test</p><figure><div class="uml-c4-diagram-container" data-uml-fit="readable" role="img" aria-label="Readable diagram">
    <svg viewBox="0 0 ${width} 300"><rect width="${width}" height="300" fill="white" stroke="black"/><text x="20" y="60" font-size="${fontSize}">Label</text></svg>
    </div></figure><button>After diagram</button></main></body></html>`);
  await page.addStyleTag({ content: readStyle(path.join(root, 'css/uml-diagram.css')) });
  await page.addScriptTag({ path: path.join(root, 'js/ArchUML/uml-bundle.js') });
  const diagram = page.getByRole('img', { name: 'Readable diagram' });
  await diagram.evaluate(el => window.UMLShared.autoFitSVG(el));
  return diagram;
}

/** The diagram's pane, its drawing's width, and its label's size on screen. */
const readableFitSizes = diagram => diagram.evaluate(el => {
  const label = el.querySelector('text');
  return {
    pane: el.clientWidth,
    drawing: el.querySelector('svg').getBoundingClientRect().width,
    label: parseFloat(getComputedStyle(label).fontSize) * label.getScreenCTM().d,
    overflowing: el.scrollWidth > el.clientWidth + 1,
  };
});

const fitControls = page => page.getByRole('button', { name: /^(Fit diagram to screen|Restore previous diagram view)$/ });

test('a host default preserves CRC sizing unless the author explicitly overrides it', async ({ page }) => {
  await page.setContent('<main><p>Lesson text</p></main>');
  await page.addStyleTag({ content: readStyle(path.join(root, 'css/uml-diagram.css')) });
  await page.addScriptTag({ path: path.join(root, 'js/ArchUML/uml-bundle.js') });
  await page.evaluate(() => {
    const root = document.querySelector('main');
    for (const fit of [null, 'readable']) {
      const source = document.createElement('div');
      source.setAttribute('data-uml-type', 'crc');
      source.setAttribute('data-uml-spec', 'card "Cart" {\n responsibility: Track purchases\n collaborator: Product\n}');
      if (fit) source.setAttribute('data-uml-fit', fit);
      root.appendChild(source);
    }
    window.UMLShared.renderAll({ root, fit: 'readable' });
  });
  const cards = page.getByRole('img');
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toHaveAttribute('data-uml-fit', 'off');
  await expect(cards.nth(1)).toHaveAttribute('data-uml-fit', 'readable');
  await expect(cards.first()).toContainText('Track purchases');
  // Older rendered figures can have a type but no serialized sizing policy.
  await cards.first().evaluate(element => element.removeAttribute('data-uml-fit'));
  await page.evaluate(() => window.UMLShared.renderAll({ root: document.querySelector('main'), fit: 'readable' }));
  await expect(cards.first()).toHaveAttribute('data-uml-fit', 'off');
});

test('already drawn figures recover readable sizing when their host applies its policy', async ({ page }) => {
  const diagram = await readableFitFixture(page, { width: 2000, fontSize: 16 });
  await diagram.evaluate(el => {
    el.removeAttribute('data-uml-fit');
    el.setAttribute('data-uml-rendered', 'true');
    el.parentElement.classList.add('sebook-figure--archuml');
    window.UMLShared.autoFitSVG(el);
  });
  await expect(page.getByRole('button', { name: 'Restore previous diagram view' })).toBeVisible();
  await page.evaluate(() => window.UMLShared.renderAll({ root: document.querySelector('main'), fit: 'readable' }));
  await expect.poll(async () => (await readableFitSizes(diagram)).label).toBeCloseTo(16, 1);
  await expect(fitControls(page)).toHaveCount(0);
  await expect(diagram).toHaveAttribute('tabindex', '0');
  await diagram.focus();
  await diagram.press('ArrowRight');
  await expect.poll(() => diagram.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
});

test('a readable-fit diagram wider than its pane shrinks to the pane while its labels stay at text size', async ({ page }) => {
  // 1200 units with 32-unit text: readable from 600 px, so it fits the 784 px pane.
  const diagram = await readableFitFixture(page, { width: 1200, fontSize: 32 });
  const sizes = await readableFitSizes(diagram);
  expect(sizes.drawing).toBeCloseTo(sizes.pane, 0);
  expect(sizes.label).toBeGreaterThanOrEqual(16);
  expect(sizes.overflowing).toBe(false);
  await expect(diagram).not.toHaveAttribute('tabindex', '0');
  await expect(fitControls(page)).toHaveCount(0);
});

test('a readable-fit diagram too wide at text size scrolls at that size as one keyboard stop', async ({ page }) => {
  // 2000 units with 16-unit text: readable only at 2000 px, wider than the 784 px pane.
  const diagram = await readableFitFixture(page, { width: 2000, fontSize: 16 });
  const sizes = await readableFitSizes(diagram);
  expect(sizes.label).toBeCloseTo(16, 1);
  expect(sizes.overflowing).toBe(true);
  await expect(fitControls(page)).toHaveCount(0);
  await expect(diagram).toHaveAttribute('tabindex', '0');
  await diagram.focus();
  await diagram.press('ArrowRight');
  await expect.poll(() => diagram.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
});

for (const format of ['attribute', 'fence']) {
  test(`scoped ${format} figures retain readable labels and authored fit choices`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 600 });
    await page.setContent('<html lang="en"><head><title>Instruction diagrams</title></head><body><main><p>Lesson text</p><section aria-label="Instructions"></section><aside aria-label="Other content"></aside></main></body></html>');
    await page.addStyleTag({ content: readStyle(path.join(root, 'css/uml-diagram.css')) });
    await page.addScriptTag({ path: path.join(root, 'js/ArchUML/uml-bundle.js') });
    await page.evaluate(format => {
      const instructions = document.querySelector('section');
      const source = 'class First @pos(0, 0)\nclass Last @pos(900, 0)\nFirst --> Last';
      function appendDiagram(parent, fit) {
        const element = document.createElement(format === 'fence' ? 'pre' : 'div');
        if (format === 'fence') {
          const code = document.createElement('code');
          code.className = 'language-uml-class';
          code.textContent = source;
          element.appendChild(code);
        } else {
          element.setAttribute('data-uml-type', 'class');
          element.setAttribute('data-uml-spec', source);
        }
        if (fit) element.setAttribute('data-uml-fit', fit);
        parent.appendChild(element);
      }
      appendDiagram(instructions);
      appendDiagram(instructions, 'off');
      appendDiagram(document.querySelector('aside'));
      window.UMLShared.renderAll({ root: instructions, fit: 'readable' });
    }, format);

    const instructions = page.getByRole('region', { name: 'Instructions' });
    const diagrams = instructions.getByRole('img');
    await expect(diagrams).toHaveCount(2);
    // Local rendering must not apply the tutorial's policy to the rest of the page.
    await expect(page.getByRole('complementary').getByRole('img')).toHaveCount(0);
    await expect(diagrams.nth(1)).toHaveAttribute('data-uml-fit', 'off');
    const diagram = diagrams.first();
    for (const dark of [false, true]) {
      await page.evaluate(dark => document.documentElement.classList.toggle('dark-mode', dark), dark);
      // SVG/CSS coordinate conversion can round by a fraction of a pixel.
      await expect.poll(async () => (await readableFitSizes(diagram)).label).toBeGreaterThanOrEqual(16 - 0.01);
    }
    await expect(fitControls(page)).toHaveCount(0);
    await expect(diagram).toHaveAttribute('tabindex', '0');
    await diagram.focus();
    await diagram.press('ArrowRight');
    await expect.poll(() => diagram.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
    await page.emulateMedia({ media: 'print' });
    const printSize = await readableFitSizes(diagram);
    expect(printSize.drawing).toBeLessThanOrEqual(printSize.pane + 1);
  });
}
