// @ts-check
const { test, expect } = require('@playwright/test');
const {
  loadTutorialConfig,
  answerQuizCorrectly,
  setEditorContent,
  expectActiveStep,
  expectStepCount,
  expectRenderedStepTests,
} = require('./tutorial-helpers');

/**
 * Tests: Playwright Tutorial — End-to-End Testing for React Apps (React backend
 * with Playwright-compatible test runner).
 *
 * Two serial describe blocks share one page each — the tutorial boots only
 * twice per run (instead of once per test).
 *
 * The Playwright tutorial uses the same React backend as react-tutorial but
 * additionally runs Playwright-style specs against the live preview via the
 * in-browser shim (js/playwright-compat/runner.js). The instructor-check
 * `tests:` block in each step uses `playwright: { title, should_fail }` to
 * verify the student's spec(s) pass or fail as expected against the current
 * App.jsx state.
 *
 * Block 1 – Structure, navigation, preview, editor, Playwright runner.
 * Block 2 – YAML-driven: applies each step's solution, verifies test count,
 *           answers the quiz, and advances to the next step.
 */

const TUTORIAL_URL     = '/SEBook/tools/playwright-tutorial';
const BOOT_TIMEOUT     = 30_000;
const TEST_RUN_TIMEOUT = 60_000;

const config = loadTutorialConfig('playwright');
const steps  = config.steps;

async function waitForTutorialReady(page) {
  await page.waitForSelector('.tvm-preview-frame', { timeout: BOOT_TIMEOUT });
  await page.waitForSelector('.tvm-step-btn',      { timeout: 10_000 });
  await expect(page.locator('.tvm-loading')).toBeHidden({ timeout: BOOT_TIMEOUT });
}

async function saveAndWaitForPreview(page) {
  await page.locator('.tvm-editor-container').first().click();
  await page.keyboard.press('Control+s');
  await expect(page.frameLocator('.tvm-preview-frame').locator('body')).toBeVisible({ timeout: 5_000 });
}

/**
 * Apply this step's solution into the editor models, rebuild the preview,
 * then click "Test My Work" and assert all-pass.
 *
 * The Playwright tutorial steps include `playwright.should_fail: true|false`
 * checks that depend on the current App.jsx + spec content. The solution
 * provides the *post-edit* state (e.g. Step 5 ships an App.jsx with the CSS
 * class already renamed). Applying the solution should leave the editor in
 * the state where every instructor check passes.
 */
async function passCurrentStepTests(page, timeout = TEST_RUN_TIMEOUT) {
  await page.waitForFunction(() => window.monaco?.editor?.getEditors?.()?.length > 0,
    { timeout: 15_000 });

  // applySolution() rebuilds the iframe; wrap so a transient navigation error
  // doesn't fail the test (the solution still applies).
  try {
    await page.evaluate(() => window._tutorial.applySolution());
  } catch (e) {
    if (!/context|destroyed|navigation/i.test(e.message)) throw e;
    await expect(page.frameLocator('.tvm-preview-frame').locator('body')).toBeVisible({ timeout: 5_000 });
  }

  await saveAndWaitForPreview(page);

  await page.locator('.tvm-btn-test').click();
  await expect(page.locator('.tvm-test-summary')).toContainText(/All \d+ tests passed!/, { timeout });
}

// =============================================================================
// Block 1 – Structure, navigation, preview, editor
// =============================================================================
test.describe.serial('Playwright Tutorial', () => {
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

  test('live preview panel is present — no terminal', async () => {
    await expect(page.locator('.tvm-preview-frame')).toBeVisible();
    await expect(page.locator('.tvm-terminal-container')).toHaveCount(0);
  });

  test('Playwright runner is enabled (test button in preview toolbar)', async () => {
    await expect(page.locator('.tvm-preview-test-btn')).toBeVisible();
  });

  test('refresh button is present in the preview header', async () => {
    await expect(page.locator('.tvm-refresh-btn')).toBeVisible();
  });

  test('editor shows file tabs on the first step (split-editor mode)', async () => {
    const tabs = page.locator('.tvm-tab');
    await expect(tabs.first()).toBeVisible({ timeout: 10_000 });
    expect(await tabs.count()).toBeGreaterThanOrEqual(1);
    await expect(page.locator('.tvm-editor-container').first()).toBeVisible();
  });

  test('preview frame renders the React Todo app', async () => {
    await page.waitForFunction(
      () => (document.querySelector('.tvm-preview-frame')?.getAttribute('srcdoc') ?? '').length > 100,
      { timeout: 10_000 });
    const frame = page.frameLocator('.tvm-preview-frame');
    await expect(frame.locator('h1')).toHaveText('Todo Lab', { timeout: 10_000 });
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
test.describe.serial('Playwright Tutorial — step-by-step', () => {
  test.setTimeout(240_000);

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
        await passCurrentStepTests(page, TEST_RUN_TIMEOUT);
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
