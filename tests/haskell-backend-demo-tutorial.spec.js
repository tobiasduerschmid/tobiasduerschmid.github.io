// @ts-check
const { test, expect } = require('@playwright/test');
const {
  loadTutorialConfig,
  waitForTutorialReady,
  setEditorContent,
  expectActiveStep,
  expectStepCount,
  expectRenderedStepTests,
} = require('./tutorial-helpers');
const { a11yCheckpoint } = require('./a11y-helpers');

const TUTORIAL_URL = '/SEBook/tools/haskell-backend-demo-tutorial';
const PRINT_URL = `${TUTORIAL_URL}/print`;
const BOOT_TIMEOUT = 90_000;
const RUN_TIMEOUT = 30_000;
const A11Y_FEATURE = 'haskell-backend-demo-tutorial';
const INVALID_HASKELL_SOURCE = [
  'module Main where',
  '',
  'doubleScores :: [Int] -> [Int]',
  'doubleScores scores = map (* 2) scores',
  '',
  'main :: IO ()',
  'main = print (doubleScores [1, 2, 3]',
].join('\n');

const config = loadTutorialConfig('haskell-backend-demo');
const [demoStep] = config.steps;

function runButton(page) {
  return page.getByRole('button', { name: /run$/i });
}

function testMyWorkButton(page) {
  return page.getByRole('button', { name: /test my work/i });
}

function collectBrowserErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`page error: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console error: ${message.text()}`);
  });
  return errors;
}

test.describe('Haskell backend demo tutorial', () => {
  test.setTimeout(150_000);

  test('a learner can run, recover from a syntax error, and pass the Haskell checks', async ({ page }) => {
    const browserErrors = collectBrowserErrors(page);
    await page.goto(TUTORIAL_URL);
    await waitForTutorialReady(page, {
      bootTimeout: BOOT_TIMEOUT,
      readySelector: '.tvm-container',
    });

    await expectStepCount(page, 1);
    await expectActiveStep(page, 0);
    await expect(page.getByRole('heading', { name: 'A Pure List Transformation' })).toBeVisible();

    const programOutput = page.getByRole('region', { name: 'Program output' });
    await expect(programOutput).toBeVisible();
    await expect(runButton(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear' })).toBeVisible();
    await a11yCheckpoint(page, 'Haskell demo — initial step ready', {
      feature: A11Y_FEATURE,
      darkMode: true,
    });

    await runButton(page).click();
    await expect(programOutput).toContainText('[1,2,3]', { timeout: RUN_TIMEOUT });
    await expect(runButton(page)).toBeEnabled();
    await expect(programOutput).not.toContainText(':set path=');

    await testMyWorkButton(page).click();
    await expect(page.locator('.tvm-test-summary'))
      .toContainText(/0\s*\/\s*2 tests passed/, { timeout: RUN_TIMEOUT });
    await expect(page.locator('.tvm-test-announcer')).toContainText('0 of 2 tests passed.');
    await a11yCheckpoint(page, 'Haskell demo — starter tests failing', {
      feature: A11Y_FEATURE,
      darkMode: true,
    });

    expect(await setEditorContent(page, INVALID_HASKELL_SOURCE)).toBe(true);
    await runButton(page).click();
    await expect(programOutput).toContainText(/error/i, { timeout: RUN_TIMEOUT });
    await expect(runButton(page)).toBeEnabled();
    await expect(programOutput).not.toContainText(':set path=');
    await a11yCheckpoint(page, 'Haskell demo — syntax error reported', {
      feature: A11Y_FEATURE,
      darkMode: true,
    });

    const solutionFile = demoStep.solution.files.find((file) => file.path === 'Main.hs');
    expect(solutionFile, 'the demo step should declare a Main.hs solution').toBeTruthy();
    expect(await setEditorContent(page, solutionFile.content)).toBe(true);

    await runButton(page).click();
    await expect(programOutput).toContainText('[2,4,6]', { timeout: RUN_TIMEOUT });
    await expect(runButton(page)).toBeEnabled();
    await expect(programOutput).not.toContainText(':set path=');

    await testMyWorkButton(page).click();
    await expect(page.locator('.tvm-test-summary'))
      .toContainText('All 2 tests passed!', { timeout: RUN_TIMEOUT });
    await expectRenderedStepTests(page, demoStep);
    await expect(page.locator('.tvm-test-announcer')).toHaveText('All 2 tests passed.');
    await a11yCheckpoint(page, 'Haskell demo — all tests passing', {
      feature: A11Y_FEATURE,
      darkMode: true,
    });
    expect(browserErrors).toEqual([]);
  });

  test('the print view renders the step and starter Haskell source', async ({ page }) => {
    await page.goto(PRINT_URL);

    await expect(page).toHaveTitle('Haskell Backend Demo — Print View');
    await expect(page.getByRole('heading', { level: 1, name: 'Haskell Backend Demo' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'A Pure List Transformation' })).toBeVisible();
    await expect(page.locator('pre').filter({ hasText: 'module Main where' }).first()).toBeVisible();
    await expect(page.getByText('Main.hs').first()).toBeVisible();
    await a11yCheckpoint(page, 'Haskell demo — print view', { feature: A11Y_FEATURE });
  });
});
