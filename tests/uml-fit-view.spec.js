// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');

// Inline the real CSS import tree so this component fixture needs no server.
function readStyle(file) {
  return fs.readFileSync(file, 'utf8').replace(/@import url\("([^"]+)"\);/g,
    (_, relative) => readStyle(path.resolve(path.dirname(file), relative)));
}

// Real renderer + stylesheet, with deliberately wide/tall SVG content. These
// dimensions exercise the view contract independently of layout algorithms.
async function diagramFixture(page, { width = 2000, height = 900 } = {}) {
  await page.setViewportSize({ width: 800, height: 600 });
  await page.setContent(`<html lang="en"><head><title>Diagram view</title></head><body>
    <main><p>Diagram view test</p><figure><div class="uml-class-diagram-container" role="img" aria-label="Example diagram">
    <svg viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="white" stroke="black"/><text x="20" y="30" font-size="16">Example</text></svg>
    </div><figcaption>Example diagram</figcaption></figure><button>After diagram</button></main></body></html>`);
  await page.addStyleTag({ content: readStyle(path.join(root, 'css/uml-diagram.css')) });
  await page.addScriptTag({ path: path.join(root, 'js/ArchUML/uml-bundle.js') });
  await page.evaluate(() => window.UMLShared.autoFitSVG(document.querySelector('[aria-label="Example diagram"]')));
  return page.getByRole('img', { name: 'Example diagram' });
}

const fitButtons = page => page.getByRole('button', { name: 'Fit diagram to screen', exact: true });
const restoreButton = page => page.getByRole('button', { name: 'Restore previous diagram view', exact: true });

async function expectFits(page, diagram) {
  const size = await diagram.locator('svg').boundingBox();
  const viewport = await diagram.boundingBox();
  expect(size.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(size.height).toBeLessThanOrEqual(page.viewportSize().height - 64);
  expect(await diagram.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
}

test('overflowing diagrams offer one top-right control and restore their previous scale and scroll', async ({ page }) => {
  const diagram = await diagramFixture(page);
  await expect(fitButtons(page)).toHaveCount(1);
  await diagram.evaluate(el => { el.scrollLeft = 300; });
  const before = await diagram.locator('svg').boundingBox();
  const scroll = await diagram.evaluate(el => el.scrollLeft);
  const bounds = await diagram.boundingBox();
  const box = await fitButtons(page).boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(24);
  expect(box.height).toBeGreaterThanOrEqual(24);
  expect(Math.abs(box.x + box.width - bounds.x - bounds.width)).toBeLessThan(16);
  expect(Math.abs(box.y - bounds.y)).toBeLessThan(16);
  expect(box.y + box.height).toBeLessThanOrEqual(before.y);
  await fitButtons(page).click();
  await expect(restoreButton(page)).toHaveCount(1);
  await expect(fitButtons(page)).toHaveCount(0);
  await expectFits(page, diagram);
  await expect(restoreButton(page)).toBeFocused();
  await restoreButton(page).press('Enter');
  await expect(fitButtons(page)).toHaveCount(1);
  expect((await diagram.locator('svg').boundingBox()).width).toBeCloseTo(before.width, 0);
  expect(await diagram.evaluate(el => el.scrollLeft)).toBe(scroll);
});

test('fitting diagrams have no controls until resizing makes them overflow', async ({ page }) => {
  await diagramFixture(page, { width: 400, height: 150 });
  await expect(fitButtons(page)).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 600 });
  await expect(fitButtons(page)).toHaveCount(1);
  await page.setViewportSize({ width: 800, height: 600 });
  await expect(fitButtons(page)).toHaveCount(0);
});

test('fit survives resizing and repeated renderer updates without duplicate controls', async ({ page }) => {
  const diagram = await diagramFixture(page);
  await fitButtons(page).click();
  await page.setViewportSize({ width: 320, height: 400 });
  await page.evaluate(() => {
    const container = document.querySelector('[aria-label="Example diagram"]');
    for (let i = 0; i < 3; i++) window.UMLShared.autoFitSVG(container);
  });
  await expect(restoreButton(page)).toHaveCount(1);
  await expectFits(page, diagram);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('tooltips support keyboard dismissal and pointer travel onto the help', async ({ page }) => {
  await diagramFixture(page);
  const button = fitButtons(page);
  await button.focus();
  const tip = page.getByRole('tooltip');
  await expect(tip).toHaveText('Fit diagram to screen');
  await expect(button).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();
  await page.getByRole('button', { name: 'After diagram' }).focus();
  await button.hover();
  await expect(tip).toBeVisible();
  await tip.hover();
  await expect(tip).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();
});

test('touch long press reveals help without activating fit', async ({ page }) => {
  await diagramFixture(page);
  const button = fitButtons(page);
  await button.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: 60, clientY: 60 });
  await expect(page.getByRole('tooltip')).toBeVisible();
  await button.dispatchEvent('pointerup', { pointerType: 'touch' });
  await button.dispatchEvent('click'); // compatibility click after releasing a long press
  await expect(fitButtons(page)).toHaveCount(1);
  await button.click();
  await expect(restoreButton(page)).toHaveCount(1);
});

for (const dark of [false, true]) {
  test(`fit controls remain accessible in ${dark ? 'dark' : 'light'} mode and disappear in print`, async ({ page }) => {
    const diagram = await diagramFixture(page);
    await page.evaluate(dark => document.documentElement.classList.toggle('dark-mode', dark), dark);
    await fitButtons(page).click();
    await expectFits(page, diagram);
    const AxeBuilder = require('@axe-core/playwright').default;
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations).toEqual([]);
    await page.emulateMedia({ media: 'print' });
    await expect(restoreButton(page)).toHaveCount(0);
    expect((await diagram.locator('svg').boundingBox()).width).toBeLessThanOrEqual((await diagram.boundingBox()).width + 1);
  });
}

test('editor canvas fitting preserves its existing zoom and pan for restoration', async ({ page }) => {
  const diagram = await diagramFixture(page);
  await page.addStyleTag({ path: path.join(root, 'css/tutorial-uml-editor.css') });
  await diagram.evaluate(el => {
    el.id = 'uml-pg-output';
    el.closest('main').id = 'main-content';
    const svg = el.querySelector('svg');
    svg.setAttribute('data-uml-pg-editor-canvas', '1');
    svg.style.transform = 'translate(30px, 20px) scale(1.2)';
    svg.style.transformOrigin = '0 0';
    window.UMLShared.autoFitSVG(el);
  });
  const before = await diagram.locator('svg').boundingBox();
  const transform = await diagram.locator('svg').evaluate(el => getComputedStyle(el).transform);
  await fitButtons(page).click();
  await expectFits(page, diagram);
  await restoreButton(page).click();
  await expect(diagram.locator('svg')).toHaveCSS('transform', transform);
  expect((await diagram.locator('svg').boundingBox()).width).toBeCloseTo(before.width, 0);
});

test('vertical scroll containers fit the full diagram and restore vertical position', async ({ page }) => {
  const diagram = await diagramFixture(page, { width: 300, height: 1000 });
  await diagram.evaluate(el => { el.style.height = '250px'; el.style.overflow = 'auto'; el.scrollTop = 200; });
  await expect(fitButtons(page)).toHaveCount(1);
  const previous = await diagram.evaluate(el => el.scrollTop);
  await fitButtons(page).click();
  await expectFits(page, diagram);
  expect(await diagram.evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
  await restoreButton(page).click();
  expect(await diagram.evaluate(el => el.scrollTop)).toBe(previous);
});

test('fitted diagrams use empty side gutters instead of adding vertical space for the control', async ({ page }) => {
  const diagram = await diagramFixture(page, { width: 1200, height: 1200 });
  await diagram.evaluate(el => {
    el.style.width = '760px';
    el.style.height = '360px';
    el.style.overflow = 'auto';
    window.UMLShared.autoFitSVG(el);
  });
  await fitButtons(page).click();
  const frame = await diagram.boundingBox();
  const drawing = await diagram.locator('svg').boundingBox();
  const control = await restoreButton(page).boundingBox();
  expect(drawing.width).toBeGreaterThan(340);
  expect(drawing.y - frame.y).toBeLessThanOrEqual(2);
  expect(frame.y + frame.height - drawing.y - drawing.height).toBeLessThanOrEqual(8);
  expect(control.x).toBeGreaterThanOrEqual(drawing.x + drawing.width + 4);
});

test('fit chooses the larger collision-free layout near the side-gutter boundary', async ({ page }) => {
  const diagram = await diagramFixture(page, { width: 1800, height: 1000 });
  await page.setViewportSize({ width: 800, height: 440 });
  await diagram.evaluate(el => {
    el.style.width = '760px';
    el.style.height = '390px';
    el.style.overflow = 'auto';
    window.UMLShared.autoFitSVG(el);
  });
  await fitButtons(page).click();
  const frame = await diagram.boundingBox();
  const drawing = await diagram.locator('svg').boundingBox();
  const control = await restoreButton(page).boundingBox();
  expect(drawing.width).toBeGreaterThan(600);
  expect(drawing.y - frame.y).toBeLessThanOrEqual(2);
  expect(control.x).toBeGreaterThanOrEqual(drawing.x + drawing.width + 4);
});

test('both icons stay centered and the control has its own space above diagram content', async ({ page }) => {
  const diagram = await diagramFixture(page);
  for (const name of ['Fit diagram to screen', 'Restore previous diagram view']) {
    const button = page.getByRole('button', { name, exact: true });
    // The decorative icon is intentionally absent from the accessibility tree.
    const icon = button.locator('[aria-hidden="true"]');
    const buttonBox = await button.boundingBox();
    const iconBox = await icon.boundingBox();
    const drawing = await diagram.locator('svg').boundingBox();
    expect(Math.abs(iconBox.x + iconBox.width / 2 - buttonBox.x - buttonBox.width / 2)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(iconBox.y + iconBox.height / 2 - buttonBox.y - buttonBox.height / 2)).toBeLessThanOrEqual(0.5);
    expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(drawing.y);
    await button.click();
  }
});

test('nested scroll panes keep controls at their corners and recover their scroll', async ({ page }) => {
  const diagram = await diagramFixture(page, { width: 2000, height: 1800 });
  await diagram.evaluate(el => {
    const pane = document.createElement('div');
    pane.setAttribute('role', 'region');
    pane.setAttribute('aria-label', 'Preview');
    pane.style.height = '250px';
    pane.style.overflow = 'auto';
    el.before(pane);
    pane.appendChild(el);
    window.UMLShared.autoFitSVG(el);
    pane.scrollTop = 500;
  });
  const pane = page.getByRole('region', { name: 'Preview' });
  const scroll = await pane.evaluate(el => el.scrollTop);
  await fitButtons(page).click();
  const svg = await diagram.locator('svg').boundingBox();
  const bounds = await pane.boundingBox();
  expect(svg.y).toBeGreaterThanOrEqual(bounds.y);
  expect(svg.y + svg.height).toBeLessThanOrEqual(bounds.y + bounds.height + 1);
  await page.setViewportSize({ width: 700, height: 500 });
  await expect(restoreButton(page)).toHaveCount(1);
  await restoreButton(page).click();
  expect(await pane.evaluate(el => el.scrollTop)).toBe(scroll);
});


test('small diagrams inside a scrolling lesson pane do not get fit controls', async ({ page }) => {
  const diagram = await diagramFixture(page, { width: 200, height: 100 });
  await diagram.evaluate(el => {
    const pane = el.parentElement;
    pane.style.height = '300px';
    pane.style.overflow = 'auto';
    const prose = document.createElement('p');
    prose.style.height = '1000px';
    prose.textContent = 'Other lesson content';
    pane.appendChild(prose);
    window.UMLShared.autoFitSVG(el);
  });
  await expect(fitButtons(page)).toHaveCount(0);
});

test('fit controls coexist with view choices without overlap or removal on resize', async ({ page }) => {
  const diagram = await diagramFixture(page);
  await page.addStyleTag({ path: path.join(root, 'css/uml-view-controls.css') });
  await page.addScriptTag({ path: path.join(root, 'js/uml-view-controls.js') });
  await diagram.evaluate(el => {
    const choices = document.createElement('div');
    el.parentElement.prepend(choices);
    window.UMLViewControls.mount(choices, { onChange() {} });
  });
  const choices = page.getByRole('group', { name: 'UML view', exact: true });
  const help = page.getByText('Design focus uses UML types', { exact: false });
  const bounds = await choices.boundingBox();
  expect(bounds.height).toBeGreaterThan(24);
  expect((await help.boundingBox()).y).toBeGreaterThanOrEqual(bounds.y + bounds.height);
  await page.setViewportSize({ width: 600, height: 600 });
  await expect(choices).toBeVisible();
  await expect(page.getByRole('button', { name: 'Design focus', exact: true })).toBeVisible();
  const button = await fitButtons(page).boundingBox();
  const updatedHelp = await help.boundingBox();
  expect(button.y).toBeGreaterThanOrEqual(updatedHelp.y + updatedHelp.height);
});

test('a lesson diagram control scrolls with its diagram instead of floating above the prose', async ({ page }) => {
  const diagram = await diagramFixture(page, { width: 2000, height: 1800 });
  await diagram.evaluate(el => {
    const pane = el.parentElement;
    pane.style.height = '300px';
    pane.style.overflow = 'auto';
    const prose = document.createElement('p');
    prose.textContent = 'The suggested target diagram';
    prose.style.height = '150px';
    pane.prepend(prose);
    window.UMLShared.autoFitSVG(el);
  });
  const before = await fitButtons(page).boundingBox();
  const diagramBefore = await diagram.boundingBox();
  expect(Math.abs(before.y - diagramBefore.y)).toBeLessThan(16);
  await diagram.evaluate(el => { el.parentElement.scrollTop = 80; });
  const after = await fitButtons(page).boundingBox();
  expect(before.y - after.y).toBeCloseTo(80, 0);
  await fitButtons(page).click();
  const pane = await diagram.evaluate(el => {
    const bounds = el.parentElement.getBoundingClientRect();
    return { top: bounds.top, bottom: bounds.bottom };
  });
  const svg = await diagram.locator('svg').boundingBox();
  const restore = await restoreButton(page).boundingBox();
  expect(restore.y).toBeGreaterThanOrEqual(pane.top);
  expect(svg.y + svg.height).toBeLessThanOrEqual(pane.bottom + 1);
});

test('viewers that own zoom controls can opt out of the shared fit button', async ({ page }) => {
  const diagram = await diagramFixture(page);
  await diagram.evaluate(el => {
    el.setAttribute('data-uml-fit', 'off');
    window.UMLShared.autoFitSVG(el);
  });
  await expect(fitButtons(page)).toHaveCount(0);
});

for (const nested of [false, true]) {
  test(`fit and restore keep the control anchored in a ${nested ? 'lesson pane' : 'page'} even near the end`, async ({ page }) => {
    const diagram = await diagramFixture(page, { width: 2000, height: 1800 });
    await diagram.evaluate((el, nested) => {
      const figure = el.parentElement;
      const intro = document.createElement('p');
      intro.textContent = 'Introduction before the diagram';
      intro.style.height = '500px';
      figure.prepend(intro);
      if (nested) {
        figure.style.height = '350px';
        figure.style.overflow = 'auto';
      }
      window.UMLShared.autoFitSVG(el);
      const scroller = nested ? figure : document.scrollingElement;
      scroller.scrollTop = 430;
    }, nested);
    // Observe settled positions across animation frames, including browser
    // scroll anchoring and ResizeObserver callbacks after each activation.
    const sample = () => page.evaluate(async () => {
      const button = document.querySelector('button[aria-label="Fit diagram to screen"], button[aria-label="Restore previous diagram view"]');
      const positions = [];
      for (let frame = 0; frame < 6; frame++) {
        await new Promise(requestAnimationFrame);
        const rect = button.getBoundingClientRect();
        positions.push({ x: rect.x, y: rect.y });
      }
      return positions;
    });
    const before = (await sample())[0];
    for (let cycle = 0; cycle < 2; cycle++) {
      await fitButtons(page).click();
      await expectFits(page, diagram);
      for (const position of await sample()) {
        expect(position.x).toBeCloseTo(before.x, 0);
        expect(position.y).toBeCloseTo(before.y, 0);
      }
      await restoreButton(page).click();
      for (const position of await sample()) {
        expect(position.x).toBeCloseTo(before.x, 0);
        expect(position.y).toBeCloseTo(before.y, 0);
      }
    }
    await fitButtons(page).click();
    await diagram.evaluate((el, nested) => {
      const scroller = nested ? el.parentElement : document.scrollingElement;
      scroller.scrollTop += 40;
    }, nested);
    const afterScrolling = (await sample())[0];
    await restoreButton(page).click();
    for (const position of await sample()) {
      expect(position.x).toBeCloseTo(afterScrolling.x, 0);
      expect(position.y).toBeCloseTo(afterScrolling.y, 0);
    }
  });
}

for (const nested of [false, true]) {
  test(`resizing while a fitted diagram is below the ${nested ? 'lesson pane' : 'page'} preserves its usable scale`, async ({ page }) => {
    const diagram = await diagramFixture(page, { width: 2000, height: 1800 });
    await diagram.evaluate((el, nested) => {
      const figure = el.parentElement;
      const intro = document.createElement('p');
      intro.textContent = 'Introduction before the diagram';
      intro.style.height = '1000px';
      figure.prepend(intro);
      if (nested) {
        figure.style.height = '350px';
        figure.style.overflow = 'auto';
      }
      window.UMLShared.autoFitSVG(el);
      (nested ? figure : document.scrollingElement).scrollTop = 1000;
    }, nested);
    await fitButtons(page).click();
    await page.evaluate(() => document.activeElement.blur());
    await diagram.evaluate((el, nested) => {
      (nested ? el.parentElement : document.scrollingElement).scrollTop = 0;
    }, nested);
    expect((await restoreButton(page).boundingBox()).y).toBeGreaterThan(nested ? 350 : 600);
    await page.setViewportSize({ width: 320, height: 550 });
    // Let resize and ResizeObserver callbacks settle while the control is offscreen.
    await page.evaluate(async () => {
      for (let frame = 0; frame < 6; frame++) await new Promise(requestAnimationFrame);
    });
    expect((await diagram.locator('svg').boundingBox()).width).toBeGreaterThan(24);
    expect(await diagram.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await diagram.evaluate((el, nested) => {
      (nested ? el.parentElement : document.scrollingElement).scrollTop = 1000;
    }, nested);
    await expect.poll(async () => (await diagram.locator('svg').boundingBox()).width).toBeGreaterThan(24);
    await expectFits(page, diagram);
    await expect(restoreButton(page)).toHaveCount(1);
  });
}
