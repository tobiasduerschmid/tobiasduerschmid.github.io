// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Tests: Node.js Essentials Interactive Tutorial (WebContainers backend)
 *
 * WebContainers requires Cross-Origin Isolation. On the first page load the
 * COI service worker installs and reloads the page — Playwright automatically
 * follows the reload. After that, WebContainers boots (Node.js-in-WASM).
 * Allow up to 90 s for the full boot sequence.
 */

const TUTORIAL_URL    = '/SEBook/tools/nodejs-tutorial';
const BOOT_TIMEOUT    = 90_000;
const TEST_RUN_TIMEOUT = 40_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wait for the tutorial UI to appear after WebContainers has booted. */
async function waitForTutorialReady(page) {
  // The xterm terminal is only present once WebContainers is running
  await page.waitForSelector('.tvm-terminal-container .xterm', { timeout: BOOT_TIMEOUT });
  await page.waitForSelector('.tvm-step-btn',                  { timeout: 10_000 });
  await expect(page.locator('.tvm-loading')).toBeHidden({ timeout: BOOT_TIMEOUT });
}

/** Type a command into the xterm terminal. */
async function typeInTerminal(page, command) {
  await page.locator('.tvm-terminal-container').click();
  await page.waitForTimeout(150);
  await page.keyboard.type(command, { delay: 15 });
  await page.keyboard.press('Enter');
}

/** Set Monaco editor content. */
async function setEditorContent(page, content) {
  return page.evaluate((text) => {
    const editors = window.monaco?.editor?.getEditors?.();
    if (!editors || editors.length === 0) return false;
    editors[0].getModel().setValue(text);
    return true;
  }, content);
}

/**
 * Answer every question in the currently visible quiz correctly.
 */
async function answerQuizCorrectly(page) {
  while (true) {
    const results = page.locator('.tvm-quiz-panel .quiz-results:not(.hidden)');
    if (await results.count() > 0) break;

    const card = page.locator('.tvm-quiz-panel .quiz-question-card.active');
    await expect(card).toBeVisible({ timeout: 5_000 });

    const type = await card.getAttribute('data-type');
    if (type === 'multiple') {
      const firstOption = card.locator('.quiz-option').first();
      const correctStr  = await firstOption.getAttribute('data-correct-indices');
      const correctSet  = new Set(correctStr.split(',').map(Number));
      const options     = card.locator('.quiz-option');
      const count       = await options.count();
      for (let i = 0; i < count; i++) {
        if (correctSet.has(Number(await options.nth(i).getAttribute('data-index'))))
          await options.nth(i).click();
      }
      await card.locator('.submit-answer-btn').click();
    } else {
      const firstOption = card.locator('.quiz-option').first();
      const correctIdx  = await firstOption.getAttribute('data-correct');
      const options     = card.locator('.quiz-option');
      const count       = await options.count();
      for (let i = 0; i < count; i++) {
        if (await options.nth(i).getAttribute('data-index') === correctIdx) {
          await options.nth(i).click();
          break;
        }
      }
    }

    const nextBtn = card.locator('.next-btn');
    await expect(nextBtn).toBeVisible({ timeout: 3_000 });
    await nextBtn.click();
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Node.js Tutorial', () => {
  test.setTimeout(180_000);

  test.beforeEach(async ({ page }) => {
    // waitUntil: 'domcontentloaded' avoids hanging on the COI service-worker
    // reload — Playwright tracks the reload automatically.
    await page.goto(TUTORIAL_URL, { waitUntil: 'domcontentloaded' });
    await waitForTutorialReady(page);
  });

  // --- Loading & Structure -------------------------------------------------

  test('tutorial loads and displays the first step', async ({ page }) => {
    await expect(page.locator('.tvm-container')).toBeVisible();
    await expect(page.locator('.tvm-loading')).toBeHidden();

    const stepButtons = page.locator('.tvm-step-btn');
    expect(await stepButtons.count()).toBeGreaterThanOrEqual(5); // nodejs.yml has 5 steps

    await expect(stepButtons.first()).toHaveClass(/active/);
    await expect(page.locator('.tvm-step-content')).not.toBeEmpty();
  });

  test('terminal panel is present with xterm', async ({ page }) => {
    await expect(page.locator('.tvm-terminal-container')).toBeVisible();
    await expect(page.locator('.tvm-terminal-container .xterm')).toBeVisible();
    // WebContainers backend must NOT have an output panel
    await expect(page.locator('.tvm-output-panel')).toHaveCount(0);
  });

  test('editor shows a JavaScript file tab on the first step', async ({ page }) => {
    const tabs = page.locator('.tvm-tab');
    await expect(tabs.first()).toBeVisible({ timeout: 10_000 });
    expect(await tabs.count()).toBeGreaterThanOrEqual(1);
    await expect(page.locator('.tvm-editor-container')).toBeVisible();
  });

  // --- Step Navigation -----------------------------------------------------

  test('clicking step buttons navigates between steps', async ({ page }) => {
    const stepButtons = page.locator('.tvm-step-btn');
    if (await stepButtons.count() < 2) return;

    await stepButtons.nth(1).click();
    await expect(stepButtons.nth(1)).toHaveClass(/active/);
    await expect(stepButtons.first()).not.toHaveClass(/active/);

    await stepButtons.first().click();
    await expect(stepButtons.first()).toHaveClass(/active/);
  });

  test('prev/next buttons navigate and next opens quiz gate', async ({ page }) => {
    const stepButtons = page.locator('.tvm-step-btn');
    await stepButtons.nth(1).click();
    await expect(stepButtons.nth(1)).toHaveClass(/active/);

    const prevBtn = page.locator('.tvm-btn-prev');
    await expect(prevBtn).toBeVisible();
    await prevBtn.click();
    await expect(stepButtons.first()).toHaveClass(/active/);

    await page.locator('.tvm-btn-next').click();
    await expect(page.locator('.tvm-quiz-panel')).toBeVisible({ timeout: 5_000 });
  });

  // --- Terminal Interaction ------------------------------------------------

  test('node --version runs in the terminal', async ({ page }) => {
    await typeInTerminal(page, 'node --version');
    // WebContainers bundles a specific Node version; output starts with v
    await page.waitForTimeout(3_000);
    const terminal = page.locator('.tvm-terminal-container');
    const text = await terminal.textContent();
    expect(text).toMatch(/v\d+\.\d+/);
  });

  // --- Test Runner ---------------------------------------------------------

  test('test button exists on step 1 and triggers test execution', async ({ page }) => {
    const testBtn = page.locator('.tvm-btn-test');
    await expect(testBtn).toBeVisible();

    await testBtn.click();
    await page.waitForSelector('.tvm-test-summary', { timeout: TEST_RUN_TIMEOUT });

    const items = page.locator('.tvm-test-item');
    expect(await items.count()).toBeGreaterThan(0);

    const count = await items.count();
    for (let i = 0; i < count; i++) {
      const cls = await items.nth(i).getAttribute('class');
      expect(cls).toMatch(/pass|fail/);
    }
  });

  test('passing tests shows all-pass summary for step 1', async ({ page }) => {
    await page.waitForFunction(() => window.monaco?.editor?.getEditors?.()?.length > 0,
      { timeout: 15_000 });

    // Step 1: add the required console.log line
    await setEditorContent(page, 'console.log("Hello from Node.js!");');
    await page.locator('.tvm-editor-container').click();
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(1_500); // allow WebContainers FS write

    await page.locator('.tvm-btn-test').click();
    await expect(page.locator('.tvm-test-summary.all-pass')).toBeVisible(
      { timeout: TEST_RUN_TIMEOUT });
  });

  // --- Quiz Flow -----------------------------------------------------------

  test('quiz panel appears after clicking next', async ({ page }) => {
    await page.locator('.tvm-btn-next').click();
    const quizPanel = page.locator('.tvm-quiz-panel');
    await expect(quizPanel).toBeVisible({ timeout: 5_000 });

    const card = quizPanel.locator('.quiz-question-card.active');
    await expect(card).toBeVisible();
    expect(await card.locator('.quiz-option').count()).toBeGreaterThanOrEqual(2);
  });

  test('answering quiz correctly shows continue button', async ({ page }) => {
    await page.locator('.tvm-btn-next').click();
    await page.waitForSelector('.tvm-quiz-panel .quiz-question-card.active', { timeout: 5_000 });

    await answerQuizCorrectly(page);

    await expect(page.locator('.tvm-quiz-panel .quiz-results:not(.hidden)')).toBeVisible();
    await expect(page.locator('.tvm-quiz-continue-btn')).toBeVisible();
  });

  test('quiz continue button advances to next step', async ({ page }) => {
    await page.locator('.tvm-btn-next').click();
    await page.waitForSelector('.tvm-quiz-panel .quiz-question-card.active', { timeout: 5_000 });
    await answerQuizCorrectly(page);

    await page.locator('.tvm-quiz-continue-btn').click();

    await expect(page.locator('.tvm-step-btn').nth(1)).toHaveClass(/active/);
    await expect(page.locator('.tvm-quiz-panel')).toBeHidden();
    await expect(page.locator('.tvm-step-content')).toBeVisible();
  });

  // --- Multiple Steps Have Tests / Quizzes ---------------------------------

  test('multiple steps have test buttons', async ({ page }) => {
    const stepButtons = page.locator('.tvm-step-btn');
    const stepCount   = await stepButtons.count();
    let stepsWithTests = 0;

    for (let i = 0; i < Math.min(stepCount, 5); i++) {
      await stepButtons.nth(i).click();
      await page.waitForTimeout(500);
      if (await page.locator('.tvm-btn-test').isVisible()) stepsWithTests++;
    }
    expect(stepsWithTests).toBeGreaterThanOrEqual(4);
  });

  test('multiple steps have quiz gates', async ({ page }) => {
    const stepButtons = page.locator('.tvm-step-btn');
    const stepCount   = await stepButtons.count();
    let stepsWithQuiz = 0;

    for (let i = 0; i < Math.min(stepCount, 5); i++) {
      await stepButtons.nth(i).click();
      await page.waitForTimeout(500);
      const nextBtn = page.locator('.tvm-btn-next');
      if (await nextBtn.isVisible()) {
        await nextBtn.click();
        try {
          await expect(page.locator('.tvm-quiz-panel')).toBeVisible({ timeout: 3_000 });
          stepsWithQuiz++;
          await stepButtons.nth(i).click();
          await page.waitForTimeout(300);
        } catch { /* no quiz */ }
      }
    }
    expect(stepsWithQuiz).toBeGreaterThanOrEqual(4);
  });
});
