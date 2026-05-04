// @ts-check
const { test, expect } = require('@playwright/test');
const {
  loadTutorialConfig,
  answerQuizCorrectly,
  expectRenderedStepTests,
} = require('./tutorial-helpers');

/**
 * Tests: Advanced Git Tutorial (v86 backend)
 *
 * YAML-driven step-by-step tests: applies each step's solution, verifies the
 * declared number of tests pass, then answers the quiz and advances to the
 * next step.
 *
 * Modeled on tests/git-tutorial.spec.js — both share the v86 backend, so the
 * passCurrentStepTestsV86 helper from that file is duplicated here.
 */

const TUTORIAL_URL     = '/SEBook/tools/git-advanced-tutorial';
const VM_BOOT_TIMEOUT  = 60_000;
// v86 commands run serially over a serial port; the advanced tutorial's
// solutions can chain 12+ commands per step (especially Steps 4, 9, 14,
// and the Capstone), so 120s is too tight. 240s gives headroom without
// being excessive on faster hardware.
const TEST_RUN_TIMEOUT = 240_000;

const config = loadTutorialConfig('git-advanced');
const steps  = config.steps;

async function waitForTutorialReady(page) {
  await page.waitForSelector('.tvm-container', { timeout: VM_BOOT_TIMEOUT });
  await page.waitForSelector('.tvm-step-btn',  { timeout: 10_000 });
}

// Git v86: loadStep runs before the VM boots, so initial files may not be synced
// to the VM filesystem. After ensuring the VM is booted, re-sync all step files,
// drain any pending _runSilent commands, then apply the solution.
// (Mirrors passCurrentStepTestsV86 in tests/git-tutorial.spec.js.)
async function passCurrentStepTestsV86(page, timeout = 120_000) {
  await page.waitForFunction(() => window.monaco?.editor?.getEditors?.()?.length > 0,
    { timeout: 15_000 });
  await page.waitForFunction(() => window._tutorial && window._tutorial.booted,
    { timeout: 60_000 });
  // Re-sync initial step files now that VM is booted
  await page.evaluate(function () {
    var tut = window._tutorial;
    var step = tut.steps[tut.currentStep];
    if (!step || !step.files) return Promise.resolve();
    var p = Promise.resolve();
    step.files.forEach(function (f) {
      p = p.then(function () { return tut._syncFileToBackend(f.path); });
    });
    return p;
  });
  // Drain any pending _runSilent commands then widen terminal to prevent
  // command+marker wrapping past 80 columns (which corrupts serial input)
  await page.evaluate(function () {
    return window._tutorial._runSilent('stty columns 200');
  });
  await page.evaluate(function () { return window._tutorial.applySolution(); });
  await page.locator('.tvm-btn-test').click();
  await expect(page.locator('.tvm-test-summary')).toContainText(/All \d+ tests passed!/, { timeout });
}

// =============================================================================
// YAML-driven step-by-step tests (one shared page, one VM boot)
// =============================================================================
test.describe.serial('Advanced Git Tutorial — step-by-step', () => {
  test.setTimeout(300_000);

  /** @type {import('@playwright/test').Page} */
  let page;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120_000);
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
        await passCurrentStepTestsV86(page, TEST_RUN_TIMEOUT);
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
