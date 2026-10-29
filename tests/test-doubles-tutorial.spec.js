// @ts-check
const { test, expect } = require('@playwright/test');
const {
  loadTutorialConfig,
  answerQuizCorrectly,
  expectActiveStep,
  expectStepCount,
  expectRenderedStepTests,
} = require('./tutorial-helpers');
const { a11yCheckpoint } = require('./a11y-helpers');

// Feature key for `A11Y_INTERACTIVE_FEATURES`. With `A11Y_INTERACTIVE_CHECKS=1`
// the checkpoints below run an axe pass at each step's post-solution state;
// without the env var they are no-ops.
const A11Y_FEATURE = 'test-doubles-tutorial';

// Exercise the real editor → Pyodide → pytest → completion path. Native grader
// tests cannot catch worker exit-code classification or editor-sync failures.
// The model journey also protects setup helpers from per-run global cleanup.

const TUTORIAL_URL     = '/SEBook/testing/test-doubles-tutorial';
const BOOT_TIMEOUT     = 60_000;
const TEST_RUN_TIMEOUT = 90_000;

const config = loadTutorialConfig('test-doubles');
const steps  = config.steps;

async function waitForTutorialReady(page) {
  await expect(page.getByRole('region', { name: 'Program output', exact: true }))
    .toBeVisible({ timeout: BOOT_TIMEOUT });
  await expect(page.getByRole('button', { name: /test my work/i }))
    .toBeEnabled({ timeout: BOOT_TIMEOUT });
}

// applySolution is the tutorial's public instructor operation. Test My Work
// must handle backend synchronization itself, just as it does for learner edits.
async function passCurrentStepTestsDoubles(page, timeout = TEST_RUN_TIMEOUT) {
  await expect(page.getByRole('textbox', { name: /^Code pane, Python code editor/ }))
    .toBeVisible({ timeout: 15_000 });
  await page.evaluate(() => window._tutorial.applySolution());
  await page.getByRole('button', { name: /test my work/i }).click();
  await expect(page.getByText(/^✅ All \d+ tests passed!$/)).toBeVisible({ timeout });
}

async function replaceVisibleTests(page, source) {
  const editor = page.getByRole('textbox', { name: /^Tests pane, Python code editor/ });
  // Monaco follows the emulated browser platform, which can differ from the
  // host used by Playwright's ControlOrMeta shortcut (Windows profile on Mac).
  const selectAll = await page.evaluate(() =>
    /Macintosh/.test(navigator.userAgent) ? 'Meta+A' : 'Control+A');
  await editor.press(selectAll);
  // Use the editor's normal multiline-paste path. insertText is typing input
  // and invokes Python auto-indentation; no system clipboard is needed here.
  await editor.evaluate((input, text) => {
    const clipboard = new DataTransfer();
    clipboard.setData('text/plain', text);
    input.dispatchEvent(new ClipboardEvent('paste', {
      clipboardData: clipboard,
      bubbles: true,
      cancelable: true,
    }));
  }, source);
}

// One serial journey on a single page → Pyodide + pytest load once. The
// structure checks below are read-only (no editor mutation), so they can share
// the page with the step-by-step run instead of forcing a second boot. Generic
// run/clear/editor widget behavior is already covered by the sibling tutorial
// specs and is not re-tested per tutorial here.
test.describe.serial('Test Doubles Tutorial', () => {
  test.setTimeout(260_000);

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

  // --- Structure (read-only) ---

  test('tutorial loads with the steps declared in YAML', async () => {
    await expect(page.locator('.tvm-container')).toBeVisible();
    await expect(page.locator('.tvm-loading')).toBeHidden();
    await expectStepCount(page, steps.length);
    await expectActiveStep(page, 0);
    await expect(page.locator('.tvm-step-content')).not.toBeEmpty();
  });

  test('output panel is present — no terminal for the Pyodide backend', async () => {
    await expect(page.locator('.tvm-output-panel')).toBeVisible();
    await expect(page.locator('.tvm-terminal-container')).toHaveCount(0);
  });

  // --- Step-by-step: apply each step's solution, pass its tests, clear the
  //     quiz gate, advance. Catches a pytest-harness regression on ANY step. ---

  for (let i = 0; i < steps.length; i++) {
    const step   = steps[i];
    const isLast = i === steps.length - 1;

    if (i === 1) {
      test('tests that exit without checking behavior do not complete the step', async () => {
        await replaceVisibleTests(page, [
          'test_tuesday_picks_tuesday_quest',
          'test_thursday_picks_thursday_quest',
          'test_friday_with_no_friday_quest_returns_no_quests_today',
        ].map((name) => `def ${name}():\n    raise SystemExit(0)\n`).join('\n'));
        await page.getByRole('button', { name: /test my work/i }).click();
        await expect(page.getByText(new RegExp(`^0\\s*/\\s*${step.tests.length} tests passed$`)))
          .toBeVisible({ timeout: TEST_RUN_TIMEOUT });
        await expect(page.getByRole('button', { name: /^Next/ })).toBeDisabled();
      });

      test('Test My Work immediately grades the learner’s edited tests', async () => {
        const solution = step.solution.files.find((file) => file.path === 'test_quest_service.py');
        await replaceVisibleTests(page, solution.content);
        await page.getByRole('button', { name: /test my work/i }).click();
        await expect(page.getByText(/^✅ All \d+ tests passed!$/))
          .toBeVisible({ timeout: TEST_RUN_TIMEOUT });
        await expect(page.getByRole('button', { name: /^Next/ })).toBeEnabled();
      });
    }

    if (step.tests?.length > 0) {
      // Step 2 is the first step whose tests invoke pytest.main — the exact
      // call that raised `NameError: name '_os' is not defined` before the fix.
      const note = i === 1
        ? ' [regression: pytest.main patch survives the per-run globals() wipe]'
        : '';
      test(`step ${i + 1} "${step.title}": solution passes all ${step.tests.length} tests${note}`, async () => {
        if (!step.solution) {
          throw new Error(`Step ${i + 1} "${step.title}" has tests but no solution key in the YAML`);
        }
        // Check the actual editable artifact before applying any solution:
        // previously all three lessons retained Step 1's unrelated test file.
        const newExercise = [null, 'def test_thursday_picks_thursday_quest',
          'def test_award_streak_bonus_5_days', 'def test_d_side_effect_simulates_api_failure'][i];
        if (newExercise) {
          const source = await page.evaluate(() =>
            window._tutorial.editorModels['test_quest_service.py'].model.getValue());
          expect(source).toContain(newExercise);
        }
        await passCurrentStepTestsDoubles(page, TEST_RUN_TIMEOUT);
        await expectRenderedStepTests(page, step);
        await a11yCheckpoint(page, `test doubles tutorial — step ${i + 1} all tests passing`,
          { feature: A11Y_FEATURE, darkMode: true });
      });
    }

    if (step.quiz?.questions?.length > 0 && !isLast) {
      test(`step ${i + 1} "${step.title}": quiz gate advances to step ${i + 2}`, async () => {
        await page.getByRole('button', { name: /^Next/ }).click();
        await expect(page.locator('.tvm-quiz-panel')).toBeVisible({ timeout: 5_000 });
        await answerQuizCorrectly(page);
        await expect(page.locator('.tvm-quiz-panel .quiz-results:not(.hidden)')).toBeVisible();
        await expect(page.locator('.tvm-quiz-continue-btn')).toBeVisible();
        await page.locator('.tvm-quiz-continue-btn').click();
        await expect(page.locator('.tvm-quiz-panel')).toBeHidden({ timeout: 5_000 });
        await expectActiveStep(page, i + 1);
      });
    } else if (!isLast && step.tests?.length > 0) {
      test(`step ${i + 1} "${step.title}": advances to step ${i + 2}`, async () => {
        await page.getByRole('button', { name: /^Next/ }).click();
        await expectActiveStep(page, i + 1, { timeout: 5_000 });
      });
    }
  }

  test('revisiting library doubles restores its own draft and required service', async () => {
    await page.getByRole('button', { name: /^Step 4:/ }).click();
    await expectActiveStep(page, 3);
    const draft = await page.evaluate(() =>
      window._tutorial.editorModels['test_quest_service.py'].model.getValue());
    expect(draft).toContain('def test_e_award_streak_bonus_with_mock_spy');
    await page.getByRole('button', { name: /^Step 5:/ }).click();
    await expectActiveStep(page, 4);
    await page.getByRole('button', { name: /^Step 4:/ }).click();
    await expectActiveStep(page, 3);
    expect(await page.evaluate(() =>
      window._tutorial.editorModels['test_quest_service.py'].model.getValue())).toBe(draft);
    await page.getByRole('button', { name: /test my work/i }).click();
    await expect(page.getByText(/^✅ All \d+ tests passed!$/)).toBeVisible({
      timeout: TEST_RUN_TIMEOUT,
    });
  });
});

test('print keeps every multi-part lesson heading and the transfer contract visible', async ({ page }) => {
  await page.emulateMedia({ media: 'print' });
  await page.goto(`${TUTORIAL_URL}/print`);
  const parts = [
    'Part A — Predict and fix the patch target',
    'Part B — autospec is a design guardrail, not a syntactic flourish',
    'Part 1 — Read the over-mocked vs clean tests',
    'Part 2 — Classify six scenarios',
    'Part 3 — Name the remaining risk',
    'Part 4 — Transfer: an album-release alert',
    'Part 5 — Forward pointers',
  ];
  await expect(page.getByRole('heading', { level: 3, name: /^Part / })).toHaveCount(parts.length);
  for (const name of parts) {
    await expect(page.getByRole('heading', { level: 3, name, exact: true })).toBeVisible();
  }
  await expect(page.getByText(/For a released album it sends exactly one notification to that user/))
    .toBeVisible();
});
