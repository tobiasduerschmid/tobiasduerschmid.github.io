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

/**
 * Tests: Test Doubles Tutorial (Pyodide + pytest backend)
 *
 * WHY THIS SPEC EXISTS
 * --------------------
 * The Test Doubles tutorial shipped with no end-to-end coverage while its
 * sibling pytest tutorials (testing-foundations, tdd) each had a full
 * step-by-step spec. That gap let a harness bug ship and reach a student:
 *
 *   The global setup installs a long-lived `pytest.main` monkeypatch
 *   (`_make_pytest_patch`) so each pytest run re-imports fresh student source.
 *   Its inner `_patched` referenced `_os` / `_TUTORIAL_DIR` as *module
 *   globals*. But the Pyodide worker wipes globals() down to a whitelist before
 *   every run (js/pyodide-worker.js). So the first time `_patched` invoked
 *   pytest.main, the names were already gone:
 *       NameError: name '_os' is not defined
 *   The fix binds those names as closure cells (immune to the wipe).
 *
 * The first `pytest.main([...])` call in the whole tutorial is STEP 2's final
 * test — Step 1's checks only inspect source / import the module, so the bug
 * surfaced on Step 2 exactly as reported. Step 2's all-pass summary is the
 * regression guard: it is unreachable while the patch crashes.
 *
 * The reference solution is applied via the tutorial's own applySolution(), so
 * the oracle ("All N tests passed!") is not coupled to the exercise's text.
 */

const TUTORIAL_URL     = '/SEBook/testing/test-doubles-tutorial';
const BOOT_TIMEOUT     = 60_000;
const TEST_RUN_TIMEOUT = 90_000;

const config = loadTutorialConfig('test-doubles');
const steps  = config.steps;

async function waitForTutorialReady(page) {
  await page.waitForSelector('.tvm-output-panel', { timeout: BOOT_TIMEOUT });
  await page.waitForSelector('.tvm-step-btn',     { timeout: 10_000 });
  await expect(page.locator('.tvm-loading')).toBeHidden({ timeout: BOOT_TIMEOUT });
}

/**
 * Apply the current step's reference solution and confirm every test passes.
 *
 * This is a split-editor, file-autosaved Pyodide tutorial: clicking Test runs
 * pytest against files in /tutorial. We must make the solution durable in the
 * worker (explicit _syncFileToBackend on every model) before clicking Test, so
 * the run reads the solution rather than racing Monaco's autosave debounce.
 * Mirrors the testing-foundations / tdd specs for the same backend.
 */
async function passCurrentStepTestsDoubles(page, timeout = TEST_RUN_TIMEOUT) {
  await page.waitForFunction(() => window.monaco?.editor?.getEditors?.()?.length > 0,
    { timeout: 15_000 });
  await page.evaluate(() => window._tutorial.applySolution());
  await page.evaluate(async () => {
    const tutorial = window._tutorial;
    const files = Object.keys(tutorial?.editorModels || {});
    await Promise.all(files.map((filename) => tutorial._syncFileToBackend(filename)));
  });
  await page.locator('.tvm-btn-test').click();
  // ✅ All N tests passed!  (`.all-pass`). A failed harness/test renders the
  // partial form "M / N tests passed", so this matcher would time out — which
  // is exactly the signal we want if the pytest.main patch regresses.
  await expect(page.locator('.tvm-test-summary')).toContainText(/All \d+ tests passed!/, { timeout });
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
        await passCurrentStepTestsDoubles(page, TEST_RUN_TIMEOUT);
        await expectRenderedStepTests(page, step);
        await a11yCheckpoint(page, `test doubles tutorial — step ${i + 1} all tests passing`,
          { feature: A11Y_FEATURE, darkMode: true });
      });
    }

    if (step.quiz?.questions?.length > 0 && !isLast) {
      test(`step ${i + 1} "${step.title}": quiz gate advances to step ${i + 2}`, async () => {
        await page.locator('.tvm-btn-next').click();
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
        await page.locator('.tvm-btn-next').click();
        await expectActiveStep(page, i + 1, { timeout: 5_000 });
      });
    }
  }
});
