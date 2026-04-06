// @ts-check
const { test, expect } = require('@playwright/test');
const {
  loadTutorialConfig,
  answerQuizCorrectly,
  setEditorContent,
} = require('./tutorial-helpers');

/**
 * Tests: React Essentials Interactive Tutorial (React/Babel backend)
 *
 * Two serial describe blocks share one page each — the tutorial boots only
 * twice per run (instead of once per test).
 *
 * The React backend transpiles JSX in-browser via Babel and renders into a
 * sandboxed iframe. After applying a solution, the preview must be rebuilt
 * via Ctrl+S before clicking Run Tests — hence the local passCurrentStepTests
 * override that adds saveAndWaitForPreview().
 *
 * Block 1 – Structure, navigation, preview, editor.
 * Block 2 – YAML-driven: applies each step's solution, verifies test count,
 *           answers the quiz, and advances to the next step.
 */

const TUTORIAL_URL     = '/SEBook/tools/react-tutorial';
const BOOT_TIMEOUT     = 30_000;
const TEST_RUN_TIMEOUT = 20_000;

const config = loadTutorialConfig('react');
const steps  = config.steps;

async function waitForTutorialReady(page) {
  await page.waitForSelector('.tvm-preview-frame', { timeout: BOOT_TIMEOUT });
  await page.waitForSelector('.tvm-step-btn',      { timeout: 10_000 });
  await expect(page.locator('.tvm-loading')).toBeHidden({ timeout: BOOT_TIMEOUT });
}

async function saveAndWaitForPreview(page) {
  await page.locator('.tvm-editor-container').click();
  await page.keyboard.press('Control+s');
  await page.waitForTimeout(1_200);
}

/**
 * React backend needs a preview rebuild after applying the solution.
 */
async function passCurrentStepTests(page, timeout = TEST_RUN_TIMEOUT) {
  await page.waitForFunction(() => window.monaco?.editor?.getEditors?.()?.length > 0,
    { timeout: 15_000 });
  // applySolution() triggers an iframe preview rebuild which can briefly
  // destroy the execution context — catch and continue since the solution
  // still applies successfully.
  try {
    await page.evaluate(() => window._tutorial.applySolution());
  } catch (e) {
    if (!e.message.includes('context') && !e.message.includes('destroyed') && !e.message.includes('navigation')) {
      throw e;
    }
    await page.waitForTimeout(2_000);
  }
  await saveAndWaitForPreview(page);
  await page.waitForTimeout(2_000);
  await page.locator('.tvm-btn-test').click();
  await expect(page.locator('.tvm-test-summary.all-pass')).toBeVisible({ timeout });
}

// =============================================================================
// Block 1 – Structure, navigation, preview, editor
// =============================================================================
test.describe.serial('React Tutorial', () => {
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
    expect(await page.locator('.tvm-step-btn').count()).toBe(steps.length);
    await expect(page.locator('.tvm-step-btn').first()).toHaveClass(/active/);
    await expect(page.locator('.tvm-step-content')).not.toBeEmpty();
  });

  test('live preview panel is present — no terminal', async () => {
    await expect(page.locator('.tvm-preview-frame')).toBeVisible();
    await expect(page.locator('.tvm-terminal-container')).toHaveCount(0);
  });

  test('refresh button is present in the preview header', async () => {
    await expect(page.locator('.tvm-refresh-btn')).toBeVisible();
  });

  test('editor shows a file tab on the first step', async () => {
    const tabs = page.locator('.tvm-tab');
    await expect(tabs.first()).toBeVisible({ timeout: 10_000 });
    expect(await tabs.count()).toBeGreaterThanOrEqual(1);
    await expect(page.locator('.tvm-editor-container')).toBeVisible();
  });

  test('preview frame renders HTML content', async () => {
    await page.waitForFunction(
      () => (document.querySelector('.tvm-preview-frame')?.getAttribute('srcdoc') ?? '').length > 100,
      { timeout: 10_000 });
    const srcdoc = await page.locator('.tvm-preview-frame').getAttribute('srcdoc');
    expect(srcdoc?.length ?? 0).toBeGreaterThan(100);
  });

  // --- Preview / editor ---

  test('preview updates after saving editor content', async () => {
    await page.waitForFunction(() => window.monaco?.editor?.getEditors?.()?.length > 0,
      { timeout: 15_000 });
    const before = await page.locator('.tvm-preview-frame').getAttribute('srcdoc');
    await setEditorContent(page, [
      'function App() { return <h1>Changed</h1>; }',
      'const root = ReactDOM.createRoot(document.getElementById("root"));',
      'root.render(<App />);',
    ].join('\n'));
    await saveAndWaitForPreview(page);
    const after = await page.locator('.tvm-preview-frame').getAttribute('srcdoc');
    expect(after).not.toBe(before);
  });

  test('refresh button rebuilds the preview', async () => {
    await page.locator('.tvm-refresh-btn').click();
    await page.waitForTimeout(1_500);
    const srcdoc = await page.locator('.tvm-preview-frame').getAttribute('srcdoc');
    expect(srcdoc?.length ?? 0).toBeGreaterThan(100);
  });

  test('editor content can be modified', async () => {
    await page.waitForFunction(() => window.monaco?.editor?.getEditors?.()?.length > 0,
      { timeout: 15_000 });
    const before = await page.evaluate(() =>
      window.monaco.editor.getEditors()[0].getModel().getValue());
    expect(before).toBeTruthy();
    await setEditorContent(page, before + '\n// added comment');
    const after = await page.evaluate(() =>
      window.monaco.editor.getEditors()[0].getModel().getValue());
    expect(after).toContain('// added comment');
  });

  // --- Quiz flow (also unlocks step 2 for the navigation test) ---

  test('quiz flow: passing step 1 → next → quiz → continue advances to step 2', async () => {
    await passCurrentStepTests(page, TEST_RUN_TIMEOUT);
    await page.locator('.tvm-btn-next').click();
    await page.waitForSelector('.tvm-quiz-panel .quiz-question-card.active', { timeout: 5_000 });
    await answerQuizCorrectly(page);
    await page.locator('.tvm-quiz-continue-btn').click();
    await expect(page.locator('.tvm-step-btn').nth(1)).toHaveClass(/active/);
    await expect(page.locator('.tvm-quiz-panel')).toBeHidden();
  });

  // --- Navigation (step 2 is now unlocked) ---

  test('step buttons navigate between unlocked steps; prev button navigates back', async () => {
    const stepButtons = page.locator('.tvm-step-btn');
    await stepButtons.first().click();
    await expect(stepButtons.first()).toHaveClass(/active/);
    await stepButtons.nth(1).click();
    await expect(stepButtons.nth(1)).toHaveClass(/active/);
    await page.locator('.tvm-btn-prev').click();
    await expect(stepButtons.first()).toHaveClass(/active/);
  });
});

// =============================================================================
// Block 2 – YAML-driven step-by-step tests (one shared page, one boot)
// =============================================================================
test.describe.serial('React Tutorial — step-by-step', () => {
  test.setTimeout(120_000);

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
        expect(await page.locator('.tvm-test-item').count()).toBe(step.tests.length);
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
