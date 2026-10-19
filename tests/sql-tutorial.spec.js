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
const { a11yCheckpoint } = require('./a11y-helpers');

// Feature key for `A11Y_INTERACTIVE_FEATURES`. With the flag enabled
// (`A11Y_INTERACTIVE_CHECKS=1`) this spec runs an axe pass at every step's
// post-solution state and at every quiz gate. With the env var omitted the
// checkpoints below are no-ops.
const A11Y_FEATURE = 'sql-tutorial';

/**
 * Tests: SQL Essentials Tutorial (SQLite WebWorker backend)
 *
 * Two serial describe blocks share one page each — the tutorial boots only
 * twice per run (instead of once per test).
 *
 * The SQL backend runs SQLite entirely in the browser via a Web Worker.
 * Query results are rendered as tables inside .tvm-sql-table-wrapper.
 *
 * Block 1 – Structure, navigation, run/clear, editor.
 * Block 2 – YAML-driven: applies each step's solution, verifies test count,
 *           answers the quiz, and advances to the next step.
 */

const TUTORIAL_URL     = '/SEBook/tools/sql-tutorial.html';
const BOOT_TIMEOUT     = 30_000;
const TEST_RUN_TIMEOUT = 20_000;

const config = loadTutorialConfig('sql');
const steps  = config.steps;

async function waitForTutorialReady(page) {
  await page.waitForSelector('.tvm-output-panel', { timeout: BOOT_TIMEOUT });
  await page.waitForSelector('.tvm-step-btn',     { timeout: 10_000 });
  await expect(page.locator('.tvm-loading')).toBeHidden({ timeout: BOOT_TIMEOUT });
}

async function clickRun(page) {
  const runBtn = page.locator('.tvm-run-btn');
  await expect(runBtn).toBeVisible({ timeout: 5_000 });
  await runBtn.click();
  await expect(runBtn).toHaveText(/^▶\s+/, { timeout: TEST_RUN_TIMEOUT });
}

// =============================================================================
// Block 1 – Structure, navigation, run/clear, editor
// =============================================================================
test.describe.serial('SQL Tutorial', () => {
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

  test('output panel is present — no terminal for SQL backend', async () => {
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
    await expect(page.locator('.tvm-editor-container')).toBeVisible();
  });

  test('SQL editor announces its language to assistive technology', async () => {
    const editor = page.getByRole('textbox', { name: /\bSQL code editor\b/ });
    await expect(editor).toBeVisible();
    await expect(editor).toHaveAccessibleName(/\bSQL code editor\b/);
  });

  // --- Run / clear ---

  test('executing a SELECT query renders a result table', async () => {
    await page.waitForFunction(() => window.monaco?.editor?.getEditors?.()?.length > 0,
      { timeout: 15_000 });
    await setEditorContent(page, "SELECT 'hello' AS msg;");
    await page.locator('.tvm-editor-container').click();
    await page.keyboard.press('Control+s');
    await clickRun(page);
    await expect(page.locator('.tvm-sql-table-wrapper')).toBeVisible({ timeout: TEST_RUN_TIMEOUT });
    await expect(page.locator('.tvm-sql-table-wrapper')).toContainText('hello');
  });

  test('clear button empties the output panel', async () => {
    await page.locator('.tvm-clear-btn').click();
    expect(await page.locator('.tvm-sql-table-wrapper').count()).toBe(0);
    const text = await page.locator('.tvm-output-pre').textContent();
    expect(text?.trim() ?? '').toBe('');
  });

  test('invalid SQL shows an error in the output panel', async () => {
    await page.waitForFunction(() => window.monaco?.editor?.getEditors?.()?.length > 0,
      { timeout: 15_000 });
    await setEditorContent(page, 'SELEC * FORM students;');
    await page.locator('.tvm-editor-container').click();
    await page.keyboard.press('Control+s');
    await clickRun(page);
    await expect(page.locator('.tvm-output-pre'))
      .toContainText(/error|Error|syntax|✗/i, { timeout: TEST_RUN_TIMEOUT });
  });

  // --- Editor ---

  test('editor content can be modified', async () => {
    await page.waitForFunction(() => window.monaco?.editor?.getEditors?.()?.length > 0,
      { timeout: 15_000 });
    const before = await page.evaluate(() =>
      window.monaco.editor.getEditors()[0].getModel().getValue());
    expect(before).toBeTruthy();
    await setEditorContent(page, before + '\n-- added comment');
    const after = await page.evaluate(() =>
      window.monaco.editor.getEditors()[0].getModel().getValue());
    expect(after).toContain('-- added comment');
  });

  // The opening lesson goes straight to the next exercise; checkpoints appear
  // only after the missing-value lesson and after the final query report.

  test('passing the first exercise advances directly to the next lesson', async () => {
    await passCurrentStepTests(page, TEST_RUN_TIMEOUT);
    await page.getByRole('button', { name: /^Next →$/ }).click();
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
test.describe.serial('SQL Tutorial — step-by-step', () => {
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
        // Grading executes the edited files itself: no prior Run or sleep.
        await passCurrentStepTests(page, TEST_RUN_TIMEOUT);
        await expectRenderedStepTests(page, step);
        await a11yCheckpoint(page, `sql tutorial — step ${i + 1} all tests passing`, { feature: A11Y_FEATURE, darkMode: true });
      });
    }

    if (!isLast) {
      test(`step ${i + 1} "${step.title}": advance to step ${i + 2}`, async () => {
        await page.getByRole('button', { name: /^Next →$/ }).click();
        if (step.quiz?.questions?.length) {
          await expect(page.locator('.tvm-quiz-panel')).toBeVisible();
          await a11yCheckpoint(page, `sql tutorial — step ${i + 1} quiz gate (first question)`, { feature: A11Y_FEATURE, darkMode: true });
          await answerQuizCorrectly(page);
          await expect(page.locator('.tvm-quiz-panel .quiz-results:not(.hidden)')).toBeVisible();
          await a11yCheckpoint(page, `sql tutorial — step ${i + 1} quiz results`, { feature: A11Y_FEATURE, darkMode: true });
          await page.getByRole('button', { name: /Continue to Step/ }).click();
        }
        await expectActiveStep(page, i + 1);
      });
    }
  }
});

test('legacy SQL drafts survive while the revised exercises require fresh checks', async ({ page }) => {
  const legacyDraft = { content: 'SELECT name FROM students; -- my saved query', language: 'sql' };
  await page.addInitScript(({ draft }) => {
    localStorage.setItem('tutorial-progress-sql', JSON.stringify({
      step: 6, activeFile: 'final.sql', files: { 'final.sql': draft },
      stepsPassed: [0, 1, 2, 3, 4, 5, 6], quizPassed: [0, 1, 2, 3, 4, 5, 6],
      stepsVisited: [0, 1, 2, 3, 4, 5, 6], stepsUnlocked: [0, 1, 2, 3, 4, 5, 6, 7],
    }));
  }, { draft: legacyDraft });
  await page.goto(TUTORIAL_URL + '?autosave=true');
  await waitForTutorialReady(page);
  await expectActiveStep(page, 0);
  await expect(page.getByRole('status', { name: 'Saved progress update' })).toContainText('recheck');
  await expect(page.getByRole('button', { name: /^Next →/ })).toBeDisabled();
  await expect.poll(async () => page.evaluate(() =>
    JSON.parse(localStorage.getItem('tutorial-progress-sql')).progressVersion)).toBe(config.progress_version);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('tutorial-progress-sql')));
  expect(saved.files['final.sql']).toEqual(legacyDraft);
  expect(saved.stepsPassed).toEqual([]);
  expect(saved.quizPassed).toEqual([]);
});
