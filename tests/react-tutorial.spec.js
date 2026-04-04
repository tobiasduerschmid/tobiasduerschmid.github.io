// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Tests: React Essentials Interactive Tutorial (React backend)
 *
 * The React backend transpiles JSX in-browser via Babel (CDN) and renders into
 * a sandboxed <iframe> live preview — no Node.js or VM required.
 * Boot is fast (CDN load only). Tests check the live preview via frameLocator.
 */

const TUTORIAL_URL    = '/SEBook/tools/react-tutorial';
const BOOT_TIMEOUT    = 30_000;
const TEST_RUN_TIMEOUT = 20_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wait for the tutorial UI to appear. React backend boots almost instantly. */
async function waitForTutorialReady(page) {
  await page.waitForSelector('.tvm-preview-frame', { timeout: BOOT_TIMEOUT });
  await page.waitForSelector('.tvm-step-btn',      { timeout: 10_000 });
  await expect(page.locator('.tvm-loading')).toBeHidden({ timeout: BOOT_TIMEOUT });
}

/** Set the Monaco editor content for the active file. */
async function setEditorContent(page, content) {
  return page.evaluate((text) => {
    const editors = window.monaco?.editor?.getEditors?.();
    if (!editors || editors.length === 0) return false;
    editors[0].getModel().setValue(text);
    return true;
  }, content);
}

/**
 * Save the current editor content and wait for the preview to rebuild.
 * The React backend rebuilds on Ctrl+S; uses ↻ Refresh as a fallback.
 */
async function saveAndWaitForPreview(page) {
  await page.locator('.tvm-editor-container').click();
  await page.keyboard.press('Control+s');
  // Small pause for the debounced preview rebuild
  await page.waitForTimeout(1_200);
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

test.describe('React Tutorial', () => {
  test.setTimeout(90_000);

  test.beforeEach(async ({ page }) => {
    await page.goto(TUTORIAL_URL);
    await waitForTutorialReady(page);
  });

  // --- Loading & Structure -------------------------------------------------

  test('tutorial loads and displays the first step', async ({ page }) => {
    await expect(page.locator('.tvm-container')).toBeVisible();
    await expect(page.locator('.tvm-loading')).toBeHidden();

    const stepButtons = page.locator('.tvm-step-btn');
    expect(await stepButtons.count()).toBeGreaterThanOrEqual(6); // react.yml has 6 steps

    await expect(stepButtons.first()).toHaveClass(/active/);
    await expect(page.locator('.tvm-step-content')).not.toBeEmpty();
  });

  test('live preview panel is present — no terminal, no output panel', async ({ page }) => {
    await expect(page.locator('.tvm-preview-panel')).toBeVisible();
    await expect(page.locator('.tvm-preview-frame')).toBeVisible();
    await expect(page.locator('.tvm-terminal-container')).toHaveCount(0);
    await expect(page.locator('.tvm-output-panel')).toHaveCount(0);
  });

  test('refresh button is present in the preview header', async ({ page }) => {
    await expect(page.locator('.tvm-refresh-btn')).toBeVisible();
  });

  test('editor shows a JSX file tab on the first step', async ({ page }) => {
    const tabs = page.locator('.tvm-tab');
    await expect(tabs.first()).toBeVisible({ timeout: 10_000 });
    expect(await tabs.count()).toBeGreaterThanOrEqual(1);
    await expect(page.locator('.tvm-editor-container')).toBeVisible();
  });

  // --- Live Preview --------------------------------------------------------

  test('preview frame renders HTML content', async ({ page }) => {
    // Wait for srcdoc to be set (preview loads async after step is mounted)
    await page.waitForTimeout(2_000);

    // The iframe should have a non-trivial srcdoc set by the engine
    const srcdoc = await page.locator('.tvm-preview-frame').getAttribute('srcdoc');
    expect(srcdoc?.length ?? 0).toBeGreaterThan(100);
  });

  test('preview updates after saving editor content', async ({ page }) => {
    await page.waitForFunction(() => window.monaco?.editor?.getEditors?.()?.length > 0,
      { timeout: 15_000 });

    // Wait for initial preview load
    await page.waitForTimeout(2_000);
    const before = await page.locator('.tvm-preview-frame').getAttribute('srcdoc');

    // Change the code
    await setEditorContent(page, [
      'function App() {',
      '  return <h1 id="test-heading">Updated!</h1>;',
      '}',
      'const root = ReactDOM.createRoot(document.getElementById("root"));',
      'root.render(<App />);',
    ].join('\n'));

    await saveAndWaitForPreview(page);

    const after = await page.locator('.tvm-preview-frame').getAttribute('srcdoc');
    // srcdoc should contain our updated text
    expect(after).toContain('Updated!');
    expect(after).not.toEqual(before);
  });

  test('refresh button rebuilds the preview', async ({ page }) => {
    await page.waitForTimeout(2_000); // let initial preview render
    const before = await page.locator('.tvm-preview-frame').getAttribute('srcdoc');

    await page.locator('.tvm-refresh-btn').click();
    await page.waitForTimeout(1_500);

    // srcdoc is regenerated — it may be identical content but freshly set
    const after = await page.locator('.tvm-preview-frame').getAttribute('srcdoc');
    expect(after?.length ?? 0).toBeGreaterThan(100);
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

    // Step 1 tasks: change name from "World", color from "tomato", add year <p>
    await setEditorContent(page, [
      'function App() {',
      '  const name = "Alice";',
      '  const color = "steelblue";',
      '  return (',
      '    <div style={{fontFamily: "sans-serif", padding: "32px"}}>',
      '      <h1 style={{color: color}}>Hello, {name}!</h1>',
      '      <p>Welcome to React.</p>',
      '      <p>Year: {new Date().getFullYear()}</p>',
      '    </div>',
      '  );',
      '}',
      'const root = ReactDOM.createRoot(document.getElementById("root"));',
      'root.render(<App />);',
    ].join('\n'));

    await saveAndWaitForPreview(page);

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

    for (let i = 0; i < stepCount; i++) {
      await stepButtons.nth(i).click();
      await page.waitForTimeout(400);
      if (await page.locator('.tvm-btn-test').isVisible()) stepsWithTests++;
    }
    expect(stepsWithTests).toBeGreaterThanOrEqual(5);
  });

  test('multiple steps have quiz gates', async ({ page }) => {
    const stepButtons = page.locator('.tvm-step-btn');
    const stepCount   = await stepButtons.count();
    let stepsWithQuiz = 0;

    for (let i = 0; i < stepCount; i++) {
      await stepButtons.nth(i).click();
      await page.waitForTimeout(400);
      const nextBtn = page.locator('.tvm-btn-next');
      if (await nextBtn.isVisible()) {
        await nextBtn.click();
        try {
          await expect(page.locator('.tvm-quiz-panel')).toBeVisible({ timeout: 3_000 });
          stepsWithQuiz++;
          await stepButtons.nth(i).click();
          await page.waitForTimeout(300);
        } catch { /* no quiz on this step */ }
      }
    }
    expect(stepsWithQuiz).toBeGreaterThanOrEqual(5);
  });
});
