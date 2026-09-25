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
// post-solution state and at every knowledge check. With the env var omitted the
// checkpoints below are no-ops.
const A11Y_FEATURE = 'python-tutorial';

/**
 * Tests: Python Essentials Interactive Tutorial (Pyodide backend)
 *
 * Two serial describe blocks share one page each — Pyodide loads only twice
 * per run (instead of once per test).
 *
 * Block 1 – Structure, navigation, run/clear, editor.
 * Block 2 – YAML-driven: applies each step's solution, verifies test count,
 *           answers the quiz, and advances to the next step.
 */

const TUTORIAL_URL     = '/SEBook/tools/python-tutorial';
const BOOT_TIMEOUT     = 60_000;
const TEST_RUN_TIMEOUT = 30_000;

const config = loadTutorialConfig('python');
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
    await expect(runBtn).toHaveText(/^▶\s+/, { timeout: TEST_RUN_TIMEOUT });
    const output = await page.locator('.tvm-output-pre').textContent().catch(() => '');
    expect(output || '').not.toContain('Already running');
  }).toPass({ timeout: TEST_RUN_TIMEOUT });
}

/**
 * Pyodide: make the solution's editor models durable in the worker before
 * clicking Test. The tutorial validates files from /tutorial, so the harness
 * must not race Monaco's autosave debounce or a UI Run click.
 */
async function passCurrentStepTestsPython(page, timeout = TEST_RUN_TIMEOUT) {
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

test('Python learners can skip to unvisited steps and resume drafts without recording passes', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Restore an earlier gated save: the tutorial's current navigation policy
  // must also apply to learners returning with only their first step unlocked.
  await page.addInitScript(() => {
    if (!localStorage.getItem('tutorial-progress-python')) {
      localStorage.setItem('tutorial-progress-python', JSON.stringify({
        step: 0, stepsUnlocked: [0], stepsVisited: [0],
        stepsPassed: [], quizPassed: [], files: {},
      }));
    }
  });
  await page.goto(TUTORIAL_URL);
  await waitForTutorialReady(page);
  const targetIndex = steps.findIndex(step => step.title === 'Loops');
  const target = page.getByRole('button', { name: `Step ${targetIndex + 1}: Loops`, exact: true });
  await expect(target).toBeEnabled();
  await target.focus();
  await page.keyboard.press('Enter');
  await expectActiveStep(page, targetIndex);
  await expect(page.getByRole('button', { name: /Test My Work/ })).toBeEnabled();
  const draft = steps[targetIndex].files[0].content + '\n# My saved loop practice\n';
  await setEditorContent(page, draft);
  await page.getByRole('button', { name: /^Next →$/ }).click();
  const skip = page.getByRole('button', { name: 'Skip Knowledge Check', exact: true });
  await expect(skip).toBeVisible();
  await a11yCheckpoint(page, 'Python optional knowledge check', { feature: A11Y_FEATURE });
  await skip.click();
  await expectActiveStep(page, targetIndex + 1);
  await target.click();
  await expectActiveStep(page, targetIndex);
  await expect.poll(() => page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('tutorial-progress-python'));
    return saved?.files?.['loops.py']?.content;
  })).toBe(draft);

  // Reopen without a deep-link hash so the saved resume position is exercised.
  await page.goto(TUTORIAL_URL);
  await waitForTutorialReady(page);
  await expectActiveStep(page, targetIndex);
  await expect.poll(() => page.evaluate(() =>
    window.monaco.editor.getEditors()[0].getModel().getValue())).toBe(draft);
  await expect(page.getByRole('button', {
    name: `Step ${steps.length}: ${steps.at(-1).title}`, exact: true,
  })).toBeEnabled();
  const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('tutorial-progress-python')));
  expect(progress.stepsPassed).toEqual([]);
  expect(progress.quizPassed).toEqual([]);
  expect(errors).toEqual([]);
});

test('Python learners can skip the final knowledge check without claiming completion', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(TUTORIAL_URL);
  await waitForTutorialReady(page);
  await page.getByRole('button', {
    name: `Step ${steps.length}: ${steps.at(-1).title}`, exact: true,
  }).click();
  await expectActiveStep(page, steps.length - 1);
  await page.getByRole('button', { name: /^Next →$/ }).click();
  await page.getByRole('button', { name: 'Skip Knowledge Check', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Review Finished', exact: true })).toBeVisible();
  await expect(page.getByText('Tutorial complete — great job!', { exact: true })).toBeHidden();
  const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('tutorial-progress-python')));
  expect(progress.stepsPassed).toEqual([]);
  expect(progress.quizPassed).toEqual([]);
  expect(progress.stepsUnlocked).not.toContain(steps.length);
});

test('Python final knowledge check records its own pass and finishes review', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(TUTORIAL_URL);
  await waitForTutorialReady(page);
  await page.getByRole('button', {
    name: `Step ${steps.length}: ${steps.at(-1).title}`, exact: true,
  }).click();
  await expectActiveStep(page, steps.length - 1);
  await page.getByRole('button', { name: /^Next →$/ }).click();
  await a11yCheckpoint(page, 'Python final knowledge check', { feature: A11Y_FEATURE, darkMode: true });
  await answerQuizCorrectly(page);
  const finish = page.getByRole('button', { name: 'Finish Review', exact: true });
  await expect(finish).toBeVisible();
  await a11yCheckpoint(page, 'Python final quiz results', { feature: A11Y_FEATURE, darkMode: true });
  await finish.click();
  await expect(page.getByRole('heading', { name: 'Review Finished', exact: true })).toBeVisible();
  const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('tutorial-progress-python')));
  expect(progress.quizPassed).toEqual([steps.length - 1]);
  expect(progress.stepsPassed).toEqual([]);
  expect(progress.stepsUnlocked).not.toContain(steps.length);
});

// =============================================================================
// Block 1 – Structure, navigation, run/clear, editor
// =============================================================================
test.describe.serial('Python Tutorial', () => {
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
    await expect(page.locator('.tvm-editor-container')).toBeVisible();
  });

  // --- Run / clear ---

  test('clicking run executes code and shows output', async () => {
    await page.waitForFunction(() => window.monaco?.editor?.getEditors?.()?.length > 0,
      { timeout: 15_000 });
    await setEditorContent(page, 'print("Hello, CS 35L!")');
    await page.locator('.tvm-editor-container').click();
    await page.keyboard.press('Control+s');
    await clickRun(page);
    await expect(page.locator('.tvm-output-pre'))
      .toContainText('Hello, CS 35L!', { timeout: TEST_RUN_TIMEOUT });
  });

  test('clear button empties the output panel', async () => {
    await page.locator('.tvm-clear-btn').click();
    const text = await page.locator('.tvm-output-pre').textContent();
    expect(text?.trim() ?? '').toBe('');
  });

  test('syntax errors appear in output', async () => {
    await page.waitForFunction(() => window.monaco?.editor?.getEditors?.()?.length > 0,
      { timeout: 15_000 });
    await setEditorContent(page, 'def broken(:');
    await page.locator('.tvm-editor-container').click();
    await page.keyboard.press('Control+s');
    await clickRun(page);
    await expect(page.locator('.tvm-output-pre'))
      .toContainText(/Error|error|SyntaxError/i, { timeout: TEST_RUN_TIMEOUT });
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

  // --- Optional quiz flow ---

  test('quiz flow: passing step 1 → next → quiz → continue advances to step 2', async () => {
    await passCurrentStepTestsPython(page, TEST_RUN_TIMEOUT);
    await page.evaluate(() => {
      const quiz = window._tutorial.steps[0].quiz;
      quiz.shuffle = false;
      const multipleQuestion = (quiz.questions || []).find(q => q.type === 'multiple');
      if (!multipleQuestion) {
        throw new Error('Expected a multiple-choice quiz question on tutorial step 1');
      }
      multipleQuestion.optional_indices = [2];
    });
    await page.locator('.tvm-btn-next').click();
    await page.waitForSelector('.tvm-quiz-panel .quiz-question-card.active', { timeout: 5_000 });

    const firstCard = page.locator('.tvm-quiz-panel .quiz-question-card.active');
    await expect(firstCard.locator('.quiz-shortcuts-hint')).toContainText('B/2');
    const shortcutKey = firstCard.locator('.quiz-shortcuts-hint kbd').first();
    const lightShortcutBg = await shortcutKey.evaluate((el) => getComputedStyle(el).backgroundColor);
    await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
    const darkShortcutBg = await shortcutKey.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(darkShortcutBg).not.toBe(lightShortcutBg);
    await page.evaluate(() => document.documentElement.classList.remove('dark-mode'));
    await expect(firstCard.locator('.quiz-option').first()).toBeFocused();
    await page.keyboard.press('B');
    await expect(firstCard.locator('.quiz-option').nth(1)).toHaveClass(/correct/);
    const nextShortcutKey = firstCard.locator('.quiz-next-shortcut-hint kbd');
    const lightNextBg = await nextShortcutKey.evaluate((el) => getComputedStyle(el).backgroundColor);
    await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
    const darkNextBg = await nextShortcutKey.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(darkNextBg).not.toBe(lightNextBg);
    await page.evaluate(() => document.documentElement.classList.remove('dark-mode'));
    await expect(firstCard.locator('.quiz-shortcuts-hint')).toBeHidden();
    await firstCard.locator('.next-btn').click();

    const multipleCard = page.locator('.tvm-quiz-panel .quiz-question-card.active');
    await expect(multipleCard).toContainText('Which of the following statements about Python are correct');
    const firstMultipleOption = multipleCard.locator('.quiz-option').first();
    const required = (await firstMultipleOption.getAttribute('data-correct-indices')).split(',').filter(Boolean);
    const optional = (await firstMultipleOption.getAttribute('data-optional-indices')).split(',').filter(Boolean);
    const accepted = new Set(required.concat(optional));
    expect(accepted.size).toBe(4);
    await expect(multipleCard.locator('.quiz-shortcuts-hint')).toBeVisible();
    await expect(multipleCard.locator('.quiz-shortcuts-hint')).toContainText(/Enter|Return/);
    await expect(multipleCard.locator('.quiz-option').first()).toBeFocused();
    for (const key of ['1', '2', '3', '4']) {
      await page.keyboard.press(key);
    }
    await page.keyboard.press('Enter');
    await expect(multipleCard.locator('.quiz-option.selected.incorrect')).toHaveCount(0);
    await expect(multipleCard.locator('.optional-answer-note')).toHaveText('Optional:');
    await multipleCard.locator('.next-btn').click();

    await answerQuizCorrectly(page);
    await page.locator('.tvm-quiz-continue-btn').click();
    await expectActiveStep(page, 1);
    await expect(page.locator('.tvm-quiz-panel')).toBeHidden();
  });

  // --- Navigation ---

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
test.describe.serial('Python Tutorial — step-by-step', () => {
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
        await passCurrentStepTestsPython(page, TEST_RUN_TIMEOUT);
        await expectRenderedStepTests(page, step);
        await a11yCheckpoint(page, `python tutorial — step ${i + 1} all tests passing`, { feature: A11Y_FEATURE, darkMode: true });
      });
    }

    if (step.quiz?.questions?.length > 0 && !isLast) {
      test(`step ${i + 1} "${step.title}": knowledge check — advances to step ${i + 2}`, async () => {
        await page.locator('.tvm-btn-next').click();
        await expect(page.locator('.tvm-quiz-panel')).toBeVisible({ timeout: 5_000 });
        await a11yCheckpoint(page, `python tutorial — step ${i + 1} knowledge check (first question)`, { feature: A11Y_FEATURE, darkMode: true });
        await answerQuizCorrectly(page);
        await expect(page.locator('.tvm-quiz-panel .quiz-results:not(.hidden)')).toBeVisible();
        await expect(page.locator('.tvm-quiz-continue-btn')).toBeVisible();
        await a11yCheckpoint(page, `python tutorial — step ${i + 1} quiz results`, { feature: A11Y_FEATURE, darkMode: true });
        await page.locator('.tvm-quiz-continue-btn').click();
        await expect(page.locator('.tvm-quiz-panel')).toBeHidden({ timeout: 5_000 });
        await expectActiveStep(page, i + 1);
      });
    }
  }
});
