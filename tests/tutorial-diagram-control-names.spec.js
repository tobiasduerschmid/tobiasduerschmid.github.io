// @ts-check
const { test, expect } = require('@playwright/test');
const { waitForTutorialReady } = require('./tutorial-helpers');

test('diagram icon controls keep action names after tooltip initialization', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/SEBook/designpatterns/observer-tutorial.html');
  await waitForTutorialReady(page, { bootTimeout: 90_000 });

  const toolbar = page.locator('.tvm-uml-right-view .tvm-diagram-toolbar');
  await expect(toolbar).toBeVisible();
  for (const [selector, name] of [
    ['.tvm-diagram-zoom-btn[data-zoom="out"]', 'Zoom out'],
    ['.tvm-diagram-zoom-btn[data-zoom="in"]', 'Zoom in'],
    ['.tvm-diagram-zoom-btn[data-zoom="reset"]', 'Reset zoom'],
    ['.tvm-diagram-fullscreen-btn', 'Fullscreen'],
    ['.tvm-diagram-popout-btn', 'Open in separate window'],
    ['.tvm-diagram-color-reset-btn', 'Reset to default color'],
  ]) {
    await expect(toolbar.locator(selector)).toHaveAccessibleName(name);
  }

  await toolbar.locator('.tvm-diagram-fullscreen-btn').click();
  const fullscreen = page.locator('.tvm-diagram-fullscreen-overlay');
  await expect(fullscreen).toBeVisible();
  for (const [selector, name] of [
    ['.tvm-diagram-fs-zoom-btn[data-zoom="out"]', 'Zoom out'],
    ['.tvm-diagram-fs-zoom-btn[data-zoom="in"]', 'Zoom in'],
    ['.tvm-diagram-fs-zoom-btn[data-zoom="reset"]', 'Reset zoom'],
    ['.tvm-diagram-color-reset-btn', 'Reset to default color'],
  ]) {
    await expect(fullscreen.locator(selector)).toHaveAccessibleName(name);
  }
});
