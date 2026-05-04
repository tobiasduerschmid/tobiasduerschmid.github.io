// @ts-check
const { test, expect } = require('@playwright/test');
const {
  loadTutorialConfig,
  passCurrentStepTests,
  answerQuizCorrectly,
  setEditorContent,
  expectActiveStep,
  expectStepCount,
  expectRenderedStepTests,
} = require('./tutorial-helpers');

/**
 * Tests: Testing Foundations with pytest Tutorial (Pyodide backend)
 *
 * Prerequisite tutorial for the TDD tutorial. Covers:
 *   1-Why Test, 2-pytest + oracle-strength drill, 3-Partitions & Boundaries,
 *   4-Test Behavior Not Implementation (+ AAA + coverage ≠ quality).
 *
 * Block 1 – Structure, navigation, run/clear, editor.
 * Block 2 – YAML-driven: applies each step's solution, verifies test count,
 *           answers the quiz, and advances to the next step.
 */

const TUTORIAL_URL     = '/SEBook/tools/testing-foundations-tutorial';
const BOOT_TIMEOUT     = 60_000;
const TEST_RUN_TIMEOUT = 90_000;

const config = loadTutorialConfig('testing-foundations');
const steps  = config.steps;

async function waitForTutorialReady(page) {
  await page.waitForSelector('.tvm-output-panel', { timeout: BOOT_TIMEOUT });
  await page.waitForSelector('.tvm-step-btn',     { timeout: 10_000 });
  await expect(page.locator('.tvm-loading')).toBeHidden({ timeout: BOOT_TIMEOUT });
}

async function clickRun(page) {
  const runBtn = page.locator('.tvm-run-btn');
  await expect(runBtn).toBeVisible({ timeout: 5_000 });
  await expect(async () => {
    await runBtn.click();
    await expect(runBtn).toHaveText(/▶|Run/, { timeout: TEST_RUN_TIMEOUT });
    const output = await page.locator('.tvm-output-pre').textContent().catch(() => '');
    expect(output || '').not.toContain('Already running');
  }).toPass({ timeout: TEST_RUN_TIMEOUT });
}

/**
 * Pyodide: make the solution's editor models durable in the worker before
 * clicking Test. The tutorial validates files from /tutorial, so the harness
 * must not race Monaco's autosave debounce.
 */
async function passCurrentStepTestsFoundations(page, timeout = TEST_RUN_TIMEOUT) {
  await page.waitForFunction(() => window.monaco?.editor?.getEditors?.()?.length > 0,
    { timeout: 15_000 });
  await page.evaluate(() => window._tutorial.applySolution());
  await page.evaluate(async () => {
    const tutorial = window._tutorial;
    const files = Object.keys(tutorial?.editorModels || {});
    await Promise.all(files.map((filename) => tutorial._syncFileToBackend(filename)));
  });
  await page.locator('.tvm-btn-test').click();
  await expect(page.locator('.tvm-test-summary')).toContainText(/All \d+ tests passed!/, { timeout });
}

// =============================================================================
// Block 1 – Structure, navigation, run/clear, editor
// =============================================================================
test.describe.serial('Testing Foundations Tutorial', () => {
  test.setTimeout(120_000);

  /** @type {import('@playwright/test').Page} */
  let page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto(TUTORIAL_URL);
    await waitForTutorialReady(page);
  });

  test.afterAll(async () => { await page?.close(); });

  // --- Structure ---

  test('tutorial loads with correct number of steps from YAML', async () => {
    await expect(page.locator('.tvm-container')).toBeVisible();
    await expect(page.locator('.tvm-loading')).toBeHidden();
    await expectStepCount(page, steps.length);
    await expectActiveStep(page, 0);
    await expect(page.locator('.tvm-step-content')).not.toBeEmpty();
  });

  test('output panel is present — no terminal for Pyodide backend', async () => {
    await expect(page.locator('.tvm-output-panel')).toBeVisible();
    await expect(page.locator('.tvm-terminal-container')).toHaveCount(0);
  });

  test('run and clear buttons are present', async () => {
    await expect(page.locator('.tvm-run-btn')).toBeVisible();
    await expect(page.locator('.tvm-clear-btn')).toBeVisible();
  });

  test('editor shows a file tab on the first step', async () => {
    const tabs = page.locator('.tvm-tab');
    await expect(tabs.first()).toBeVisible({ timeout: 10_000 });
    expect(await tabs.count()).toBeGreaterThanOrEqual(1);
    await expect(page.locator('.tvm-editor-container').first()).toBeVisible();
  });

  // --- Run / clear ---

  test('clicking run executes Python and shows output', async () => {
    await page.waitForFunction(() => window.monaco?.editor?.getEditors?.()?.length > 0,
      { timeout: 15_000 });
    await setEditorContent(page, 'print("Hello Foundations!")');
    await page.locator('.tvm-editor-container').first().click();
    await page.keyboard.press('Control+s');
    await clickRun(page);
    await expect(page.locator('.tvm-output-pre'))
      .toContainText('Hello Foundations!', { timeout: TEST_RUN_TIMEOUT });
  });

  test('clear button empties the output panel', async () => {
    await page.locator('.tvm-clear-btn').click();
    const text = await page.locator('.tvm-output-pre').textContent();
    expect(text?.trim() ?? '').toBe('');
  });

  // --- Editor ---

  test('editor content can be modified', async () => {
    await page.waitForFunction(() => window.monaco?.editor?.getEditors?.()?.length > 0,
      { timeout: 15_000 });
    const before = await page.evaluate(() =>
      window.monaco.editor.getEditors()[0].getModel().getValue());
    expect(before).toBeTruthy();
    await setEditorContent(page, before + '\n# added comment');
    const after = await page.evaluate(() =>
      window.monaco.editor.getEditors()[0].getModel().getValue());
    expect(after).toContain('# added comment');
  });

  // --- Quiz flow (also unlocks step 2 for the navigation test) ---

  test('quiz flow: passing step 1 → next → quiz → continue advances to step 2', async () => {
    await passCurrentStepTests(page, TEST_RUN_TIMEOUT);
    await page.locator('.tvm-btn-next').click();
    await page.waitForSelector('.tvm-quiz-panel .quiz-question-card.active', { timeout: 5_000 });
    await answerQuizCorrectly(page);
    await page.locator('.tvm-quiz-continue-btn').click();
    await expectActiveStep(page, 1);
    await expect(page.locator('.tvm-quiz-panel')).toBeHidden();
  });

  // --- Navigation (step 2 is now unlocked) ---

  test('step buttons navigate between unlocked steps; prev button navigates back', async () => {
    const stepButtons = page.locator('.tvm-step-btn');
    await stepButtons.first().click();
    await expectActiveStep(page, 0);
    await stepButtons.nth(1).click();
    await expectActiveStep(page, 1);
    await page.locator('.tvm-btn-prev').click();
    await expectActiveStep(page, 0);
  });
});

// =============================================================================
// Block 2 – YAML-driven step-by-step tests (one shared page, one boot)
// =============================================================================
test.describe.serial('Testing Foundations Tutorial — step-by-step', () => {
  test.setTimeout(200_000);

  /** @type {import('@playwright/test').Page} */
  let page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto(TUTORIAL_URL);
    await waitForTutorialReady(page);
  });

  test.afterAll(async () => { await page?.close(); });

  for (let i = 0; i < steps.length; i++) {
    const step   = steps[i];
    const isLast = i === steps.length - 1;

    if (step.tests?.length > 0) {
      test(`step ${i + 1} "${step.title}": solution passes all ${step.tests.length} tests`, async () => {
        if (!step.solution) {
          throw new Error(`Step ${i + 1} "${step.title}" has tests but no solution key in the YAML`);
        }
        await passCurrentStepTestsFoundations(page, TEST_RUN_TIMEOUT);
        await expectRenderedStepTests(page, step);
      });
    }

    if (step.quiz?.questions?.length > 0 && !isLast) {
      test(`step ${i + 1} "${step.title}": quiz gate — advances to step ${i + 2}`, async () => {
        await page.locator('.tvm-btn-next').click();
        await expect(page.locator('.tvm-quiz-panel')).toBeVisible({ timeout: 5_000 });
        await answerQuizCorrectly(page);
        await expect(page.locator('.tvm-quiz-panel .quiz-results:not(.hidden)')).toBeVisible();
        await expect(page.locator('.tvm-quiz-continue-btn')).toBeVisible();
        await page.locator('.tvm-quiz-continue-btn').click();
        await expect(page.locator('.tvm-quiz-panel')).toBeHidden({ timeout: 5_000 });
      });
    }
  }
});
