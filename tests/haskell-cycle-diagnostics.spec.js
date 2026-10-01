// @ts-check
const { test, expect } = require('@playwright/test');
const { setEditorContent } = require('./tutorial-helpers');
const { a11yCheckpoint } = require('./a11y-helpers');

const run = page => page.getByRole('button', { name: /run$/i });
const diagnostics = page => page.getByRole('region', { name: /^Haskell cycle diagnostics/ });
const output = page => page.getByRole('region', { name: 'Program output' });

test('shows a cycle before execution, blocks Run and Debug, and clears it after a correction', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/SEBook/tools/haskell-backend-demo-tutorial');
  await expect(run(page)).toBeEnabled({ timeout: 90_000 });
  await setEditorContent(page, 'module Main where\nmain = print (let x = x in (x :: Int))\nbackstop = missingCycleTestName\n');
  // Verify detection before clicking; the undefined backstop also ensures
  // a missing command gate cannot execute this cycle in the test browser.
  await expect(diagnostics(page)).toContainText('Execution blocked');
  await expect(diagnostics(page)).toContainText('Main.hs:2');
  await a11yCheckpoint(page, 'haskell-cycle-warning');
  await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
  // The checkpoint above already audits both settled themes; await the actual
  // paint here before screenshots rather than sampling color transitions.
  await expect(diagnostics(page)).toHaveCSS('background-color', 'rgb(32, 32, 32)');
  await diagnostics(page).focus();
  await expect(diagnostics(page)).toBeFocused();
  await page.setViewportSize({ width: 320, height: 640 });
  await expect(diagnostics(page)).toBeVisible();
  expect(await diagnostics(page).evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('cycle-warning-mobile-dark.png'), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.screenshot({ path: test.info().outputPath('cycle-warning-dark.png'), fullPage: true });
  await page.evaluate(() => document.documentElement.classList.remove('dark-mode'));
  await page.screenshot({ path: test.info().outputPath('cycle-warning-light.png'), fullPage: true });
  await run(page).press('Enter');
  await expect(output(page)).toContainText('Execution blocked');
  await expect(run(page)).toBeEnabled();
  await page.getByRole('button', { name: 'Start debugger', exact: true }).press('Enter');
  await expect(page.getByRole('button', { name: 'Start debugger', exact: true })).toBeVisible();
  await setEditorContent(page, 'module Main where\nmain = print (42 :: Int)\n');
  await expect(diagnostics(page)).not.toContainText('Cyclic value alias');
  await run(page).click();
  await expect(output(page)).toContainText('42', { timeout: 30_000 });
  await expect(run(page)).toBeEnabled();
});

test('unused cycles remain warnings and do not prevent a productive lazy Run', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto('/SEBook/tools/haskell-backend-demo-tutorial');
  await expect(run(page)).toBeEnabled({ timeout: 90_000 });
  await setEditorContent(page, 'module Main where\nmain = print (let unused = unused; ones = 1 : ones in take 3 ones)\n');
  await expect(diagnostics(page)).toContainText('may remain unused');
  await expect(diagnostics(page)).not.toContainText('Execution blocked');
  await run(page).click();
  await expect(output(page)).toContainText('[1,1,1]', { timeout: 30_000 });
});

test('Test My Work checks the test demand and releases the controls after blocking', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto('/SEBook/tools/haskell-backend-demo-tutorial');
  await expect(run(page)).toBeEnabled({ timeout: 90_000 });
  // Undefined backstop guarantees a guard regression cannot hang the browser.
  await setEditorContent(page, 'module Main where\ndoubleScores = doubleScores\nbackstop = missingCycleTestName\nmain = print (42 :: Int)\n');
  await expect(diagnostics(page)).toContainText('may remain unused');
  await page.getByRole('button', { name: /Test My Work/i }).click();
  await expect(output(page)).toContainText('Execution blocked');
  await expect(page.getByRole('button', { name: /Test My Work/i })).toBeEnabled();
  await expect(run(page)).toBeEnabled();
});
