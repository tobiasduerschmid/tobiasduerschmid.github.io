// @ts-check
const { test, expect } = require('@playwright/test');
const { luminance, paletteOf, textContrast, contrastOnPaper } = require('./print-helpers');

// Paper has no use for filled controls, and the print audit counts a large dark
// block as a defect. Inline code keeps one plain print colour, even inside a
// heading whose print colour is lighter. Light text on a fill must not depend on
// the browser printing backgrounds, which it skips unless told otherwise.

const BODY_TEXT_CONTRAST = 4.5;
const DARK_SURFACE = 0.35;

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ media: 'print' });
});

test('buttons print as plain controls, never as dark filled blocks', async ({ page }) => {
  await page.goto('/cookies/');
  const buttons = page.getByRole('button');
  const total = await buttons.count();
  expect(total, 'the page lists its storage with delete buttons').toBeGreaterThan(0);

  for (let index = 0; index < total; index += 1) {
    const button = buttons.nth(index);
    const name = (await button.textContent())?.trim() || `button ${index + 1}`;
    expect.soft(luminance((await paletteOf(button)).background), `${name}: fill`).toBeGreaterThanOrEqual(DARK_SURFACE);
    expect.soft(await textContrast(button), `${name}: label contrast`).toBeGreaterThanOrEqual(BODY_TEXT_CONTRAST);
  }
});

test('inline code inside a heading stays readable in print', async ({ page }) => {
  await page.goto('/SEBook/uml_use_case_diagram.html');
  const headingCode = page.getByRole('heading').getByRole('code');
  const total = await headingCode.count();
  expect(total, 'the chapter names its include/extend relationships in headings').toBeGreaterThan(0);

  for (let index = 0; index < total; index += 1) {
    const code = headingCode.nth(index);
    const text = (await code.textContent())?.trim();
    expect.soft(await textContrast(code), `code "${text}"`).toBeGreaterThanOrEqual(BODY_TEXT_CONTRAST);
  }
});

test('the selected diagram tab stays legible when backgrounds are not printed', async ({ page }) => {
  await page.goto('/uml-popup.html');
  const selected = page.getByRole('button', { name: 'Class Diagram', pressed: true });
  await expect(selected, 'the class diagram tab starts selected').toBeVisible();
  expect(await contrastOnPaper(selected)).toBeGreaterThanOrEqual(BODY_TEXT_CONTRAST);
});

test('step numbers in a tutorial print view stay legible when backgrounds are not printed', async ({ page }) => {
  await page.goto('/SEBook/tools/shell-pipeline-tutorial/print.html');
  // The number is a styled badge with no role of its own, so the class is the only hook.
  const badges = page.locator('.step-number');
  const total = await badges.count();
  expect(total, 'the print view numbers its steps').toBeGreaterThan(0);

  for (let index = 0; index < total; index += 1) {
    expect.soft(await contrastOnPaper(badges.nth(index)), `step ${index + 1}`).toBeGreaterThanOrEqual(BODY_TEXT_CONTRAST);
  }
});
