// @ts-check
const { test, expect } = require('@playwright/test');

const fit = page => page.getByRole('button', { name: 'Fit diagram to screen', exact: true });
const restore = page => page.getByRole('button', { name: 'Restore previous diagram view', exact: true });

for (const dark of [false, true]) {
  test(`Monopoly earlier diagrams start fully visible on mobile in ${dark ? 'dark' : 'light'} mode`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(diagrams => {
      for (const [type, text] of Object.entries(diagrams)) {
        localStorage.setItem('uml-pg-autosave-monopoly-state-pattern-uml-' + type, text);
      }
    }, require('./fixtures/monopoly-uml'));
    await page.goto('/SEBook/designpatterns/monopoly-state-pattern-uml-homework');
    await page.evaluate(dark => document.documentElement.classList.toggle('dark-mode', dark), dark);
    await page.getByRole('button', { name: 'Next →', exact: true }).click();
    await page.getByRole('button', { name: 'Next →', exact: true }).click();
    const earlier = page.getByRole('region', { name: 'Earlier Diagrams', exact: true });
    const diagrams = earlier.getByRole('img');
    await expect(diagrams).toHaveCount(2);
    for (const diagram of await diagrams.all()) {
      await expect(diagram.locator('svg')).toBeVisible();
      await expect.poll(() => diagram.evaluate(container => {
        const drawing = container.querySelector('svg').getBoundingClientRect();
        return drawing.width <= container.clientWidth + 1 &&
          drawing.height <= container.clientHeight + 1 &&
          container.scrollWidth <= container.clientWidth + 1 &&
          container.scrollHeight <= container.clientHeight + 1;
      })).toBe(true);
    }
    await expect(earlier.getByRole('button', { name: 'Fit diagram to screen', exact: true })).toHaveCount(0);
    await earlier.screenshot({ path: test.info().outputPath(`earlier-diagrams-${dark ? 'dark' : 'light'}.png`) });
  });
}

test('the playground keeps its existing zoom controls without a duplicate fit button', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await page.goto('/SEBook/tools/uml-playground.html');
  const canvas = page.locator('#uml-pg-output svg');
  await expect(canvas).toBeVisible();
  await expect(fit(page)).toHaveCount(0);
  const previousWidth = (await canvas.boundingBox()).width;
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  expect((await canvas.boundingBox()).width).toBeGreaterThan(previousWidth);
  await expect(fit(page)).toHaveCount(0);
});

test('authored UML pages start fitted without exposing controls in print', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/test-uml.html');
  await expect(restore(page).first()).toBeVisible();
  await expect(fit(page)).toHaveCount(0);
  await page.emulateMedia({ media: 'print' });
  await expect(fit(page)).toHaveCount(0);
  await expect(restore(page)).toHaveCount(0);
});

test('the tutorial target keeps its fit control attached and fits inside the lesson pane', async ({ page }) => {
  test.setTimeout(120_000);
  const { waitForTutorialReady } = require('./tutorial-helpers');
  await page.setViewportSize({ width: 1100, height: 850 });
  await page.goto('/SEBook/tools/uml-sequence-diagram-python.html#moderated-broadcast');
  await waitForTutorialReady(page, { bootTimeout: 90_000 });
  const target = page.locator('.tvm-step-content [data-uml-type="sequence"]');
  const pane = page.locator('.tvm-step-content-wrap');
  await expect(target.locator('svg')).toBeVisible();
  await target.scrollIntoViewIfNeeded();
  await expect(restore(page)).toHaveCount(1);
  // Explicitly enlarge before testing the fit/restore interaction.
  await restore(page).click();
  await expect(fit(page)).toHaveCount(1);
  await fit(page).scrollIntoViewIfNeeded();
  // Fitting preserves the lesson's scroll position. Align the diagram with
  // the pane's content area before requiring the whole fitted drawing to show.
  await target.evaluate(element => {
    const pane = element.closest('.tvm-step-content-wrap');
    pane.scrollTop += element.getBoundingClientRect().top - pane.getBoundingClientRect().top
      - parseFloat(getComputedStyle(pane).paddingTop);
  });
  const previousScrollTop = await pane.evaluate(element => element.scrollTop);
  const diagramBox = await target.boundingBox();
  const buttonBox = await fit(page).boundingBox();
  expect(Math.abs(buttonBox.y - diagramBox.y)).toBeLessThan(16);
  // Locator.click() applies the page's button scroll margin before clicking.
  // Use the visible center to exercise pointer activation without moving it.
  await expect(fit(page)).toBeInViewport({ ratio: 1 });
  await page.mouse.click(buttonBox.x + buttonBox.width / 2, buttonBox.y + buttonBox.height / 2);
  expect(await pane.evaluate(element => element.scrollTop)).toBe(previousScrollTop);
  const bounds = await pane.boundingBox();
  const drawing = await target.locator('svg').boundingBox();
  const restoreBox = await restore(page).boundingBox();
  expect(restoreBox.y).toBeCloseTo(buttonBox.y, 0);
  expect(restoreBox.x).toBeCloseTo(buttonBox.x, 0);
  expect(restoreBox.y).toBeGreaterThanOrEqual(bounds.y);
  expect(drawing.y + drawing.height).toBeLessThanOrEqual(bounds.y + bounds.height + 1);
  const bottomPadding = await pane.evaluate(el => parseFloat(getComputedStyle(el).paddingBottom))
    + await target.evaluate(el => parseFloat(getComputedStyle(el).paddingBottom));
  // This tall target is height-limited: fitting should use the available space,
  // not shrink it further by counting the lesson's top padding a second time.
  expect(bounds.y + bounds.height - bottomPadding - drawing.y - drawing.height).toBeLessThanOrEqual(2);
  await page.screenshot({ path: test.info().outputPath('tutorial-target-fitted.png') });
  await restore(page).click();
  await expect(fit(page)).toHaveCount(1);
});
