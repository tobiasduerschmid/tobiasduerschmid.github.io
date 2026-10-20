// @ts-check
const { test, expect } = require('@playwright/test');

const fit = page => page.getByRole('button', { name: 'Fit diagram to screen', exact: true });
const restore = page => page.getByRole('button', { name: 'Restore previous diagram view', exact: true });

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

test('authored UML pages receive controls automatically without exposing them in print', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/test-uml.html');
  await expect(fit(page).first()).toBeVisible();
  await fit(page).first().click();
  await expect(restore(page)).toHaveCount(1);
  await expect(restore(page)).toBeInViewport();
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
  await expect(fit(page)).toHaveCount(1);
  const diagramBox = await target.boundingBox();
  const buttonBox = await fit(page).boundingBox();
  expect(Math.abs(buttonBox.y - diagramBox.y)).toBeLessThan(16);
  await fit(page).click();
  const bounds = await pane.boundingBox();
  const drawing = await target.locator('svg').boundingBox();
  const restoreBox = await restore(page).boundingBox();
  expect(restoreBox.y).toBeGreaterThanOrEqual(bounds.y);
  expect(drawing.y + drawing.height).toBeLessThanOrEqual(bounds.y + bounds.height + 1);
  await page.screenshot({ path: test.info().outputPath('tutorial-target-fitted.png') });
  await restore(page).click();
  await expect(fit(page)).toHaveCount(1);
});
