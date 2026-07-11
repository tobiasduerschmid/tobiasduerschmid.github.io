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
const { a11yCheckpoint } = require('./a11y-helpers');

// Feature key for `A11Y_INTERACTIVE_FEATURES`. With the flag enabled
// (`A11Y_INTERACTIVE_CHECKS=1`) this spec runs an axe pass at every step's
// post-solution state and at every quiz gate. With the env var omitted the
// checkpoints below are no-ops.
const A11Y_FEATURE = 'react-tutorial';

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

const TUTORIAL_URL     = '/SEBook/tools/react-tutorial.html';
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
  const saveModifier = await page.evaluate(() =>
    /Macintosh|Mac OS X|iPhone|iPad|iPod/.test(navigator.userAgent) ? 'Meta' : 'Control');
  await page.keyboard.press(`${saveModifier}+s`);
  await expect(page.frameLocator('.tvm-preview-frame').locator('body')).toBeVisible({ timeout: 5_000 });
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
    await expect(page.frameLocator('.tvm-preview-frame').locator('body')).toBeVisible({ timeout: 5_000 });
  }
  await saveAndWaitForPreview(page);
  await page.locator('.tvm-btn-test').click();
  await expect(page.locator('.tvm-test-summary')).toContainText(/All \d+ tests passed!/, { timeout });
}

// =============================================================================
// Block 1 – Structure, navigation, preview, editor
// =============================================================================
test.describe.serial('React Tutorial', () => {
  test.setTimeout(120_000);

  /** @type {import('@playwright/test').Page} */
  let page;

  /** @type {import('@playwright/test').BrowserContext} */
  let context;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(120_000);
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto(TUTORIAL_URL);
    await waitForTutorialReady(page);
  });

  test.afterAll(async () => { await context?.close(); });

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
    await setEditorContent(page, [
      'function App() { return <h1>Changed</h1>; }',
      'const root = ReactDOM.createRoot(document.getElementById("root"));',
      'root.render(<App />);',
    ].join('\n'));
    await saveAndWaitForPreview(page);
    // _patchReactPreview hot-reloads via postMessage once Babel is loaded —
    // srcdoc stays the same, so check the rendered DOM inside the iframe.
    const frame = page.frameLocator('.tvm-preview-frame');
    await expect(frame.locator('h1')).toHaveText('Changed', { timeout: 5_000 });
  });

  test('refresh button rebuilds the preview', async () => {
    const frameBody = page.frameLocator('.tvm-preview-frame').locator('body');
    await frameBody.evaluate((body) => body.setAttribute('data-refresh-probe', 'stale'));
    await page.locator('.tvm-refresh-btn').click();
    await expect
      .poll(() => frameBody.evaluate((body) => body.getAttribute('data-refresh-probe') || ''), {
        timeout: 5_000,
        message: 'Expected refresh to rebuild the preview iframe document',
      })
      .toBe('');
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
test.describe.serial('React Tutorial — step-by-step', () => {
  test.setTimeout(120_000);

  /** @type {import('@playwright/test').Page} */
  let page;

  /** @type {import('@playwright/test').BrowserContext} */
  let context;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(120_000);
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto(TUTORIAL_URL);
    await waitForTutorialReady(page);
  });

  test.afterAll(async () => { await context?.close(); });

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
        await a11yCheckpoint(page, `react tutorial — step ${i + 1} all tests passing`, { feature: A11Y_FEATURE, darkMode: true });
      });
    }

    if (step.quiz?.questions?.length > 0 && !isLast) {
      test(`step ${i + 1} "${step.title}": quiz gate — advances to step ${i + 2}`, async () => {
        await page.locator('.tvm-btn-next').click();
        await expect(page.locator('.tvm-quiz-panel')).toBeVisible({ timeout: 5_000 });
        await a11yCheckpoint(page, `react tutorial — step ${i + 1} quiz gate (first question)`, { feature: A11Y_FEATURE, darkMode: true });
        await answerQuizCorrectly(page);
        await expect(page.locator('.tvm-quiz-panel .quiz-results:not(.hidden)')).toBeVisible();
        await expect(page.locator('.tvm-quiz-continue-btn')).toBeVisible();
        await a11yCheckpoint(page, `react tutorial — step ${i + 1} quiz results`, { feature: A11Y_FEATURE, darkMode: true });
        await page.locator('.tvm-quiz-continue-btn').click();
        await expect(page.locator('.tvm-quiz-panel')).toBeHidden({ timeout: 5_000 });
      });
    }
  }
});
