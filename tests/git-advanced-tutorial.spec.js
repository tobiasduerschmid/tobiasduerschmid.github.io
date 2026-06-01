// @ts-check
const { test, expect } = require('@playwright/test');
const {
  loadTutorialConfig,
  answerQuizCorrectly,
  expectRenderedStepTests,
} = require('./tutorial-helpers');
const { a11yCheckpoint } = require('./a11y-helpers');

// Feature key for `A11Y_INTERACTIVE_FEATURES`. With the flag enabled
// (`A11Y_INTERACTIVE_CHECKS=1`) this spec runs an axe pass at every step's
// post-solution state and at every quiz gate. With the env var omitted the
// checkpoints below are no-ops.
const A11Y_FEATURE = 'git-advanced-tutorial';

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

async function waitForTerminalPrompt(page) {
  await expect(page.locator('.tvm-terminal-container .xterm')).toBeVisible({ timeout: VM_BOOT_TIMEOUT });
  await page.waitForFunction(
    () => window._tutorial && window._tutorial.booted && window._tutorial._terminalReadyForInput,
    { timeout: 120_000 },
  );
}

async function terminalBottomReserve(page) {
  return page.evaluate(() => {
    const terminal = document.querySelector('.tvm-terminal-container .xterm');
    const viewport = document.querySelector('.tvm-terminal-container .xterm-viewport');
    const screen = document.querySelector('.tvm-terminal-container .xterm-screen');
    const canvas = document.querySelector('.tvm-terminal-container canvas');
    const term = window._tutorial && window._tutorial.term;
    const dimensions = term?._core?._renderService?.dimensions;
    const rendered = canvas || screen;

    if (!terminal || !viewport || !rendered || !term) {
      throw new Error('Advanced Git terminal did not expose the xterm scrollport and rendered screen');
    }

    const viewportRect = viewport.getBoundingClientRect();
    const renderedRect = rendered.getBoundingClientRect();
    return {
      bottomReservePx: viewportRect.bottom - renderedRect.bottom,
      cellHeightPx: dimensions?.actualCellHeight || renderedRect.height / Math.max(term.rows, 1),
      cols: term.cols,
      rows: term.rows,
      terminalLineHeight: getComputedStyle(terminal).lineHeight,
      viewportHeight: viewportRect.height,
      renderedHeight: renderedRect.height,
    };
  });
}

// =============================================================================
// Terminal layout regression
// =============================================================================
test.describe('Advanced Git Tutorial terminal layout', () => {
  test('terminal prompt row remains fully visible at a 1920x1080 Chrome viewport', async ({ browser }) => {
    test.setTimeout(150_000);
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    try {
      await page.goto(TUTORIAL_URL);
      await waitForTutorialReady(page);
      await waitForTerminalPrompt(page);

      const metrics = await terminalBottomReserve(page);
      expect(metrics.cols, 'terminal should have a usable column count').toBeGreaterThan(40);
      expect(metrics.rows, 'terminal should have a usable row count').toBeGreaterThan(4);
      expect(
        metrics.bottomReservePx,
        `terminal bottom row needs visible breathing room; metrics=${JSON.stringify(metrics)}`,
      ).toBeGreaterThanOrEqual(Math.min(8, metrics.cellHeightPx * 0.35));
    } finally {
      await context.close();
    }
  });
});

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
        await passCurrentStepTestsV86(page, TEST_RUN_TIMEOUT);
        await expectRenderedStepTests(page, step);
        await a11yCheckpoint(page, `git advanced tutorial — step ${i + 1} all tests passing`, { feature: A11Y_FEATURE, darkMode: true });
      });
    }

    if (step.quiz?.questions?.length > 0 && !isLast) {
      test(`step ${i + 1} "${step.title}": quiz gate — advances to step ${i + 2}`, async () => {
        await page.locator('.tvm-btn-next').click();
        await expect(page.locator('.tvm-quiz-panel')).toBeVisible({ timeout: 5_000 });
        await a11yCheckpoint(page, `git advanced tutorial — step ${i + 1} quiz gate (first question)`, { feature: A11Y_FEATURE, darkMode: true });
        await answerQuizCorrectly(page);
        await expect(page.locator('.tvm-quiz-panel .quiz-results:not(.hidden)')).toBeVisible();
        await expect(page.locator('.tvm-quiz-continue-btn')).toBeVisible();
        await a11yCheckpoint(page, `git advanced tutorial — step ${i + 1} quiz results`, { feature: A11Y_FEATURE, darkMode: true });
        await page.locator('.tvm-quiz-continue-btn').click();
        await expect(page.locator('.tvm-quiz-panel')).toBeHidden({ timeout: 5_000 });
      });
    }
  }
});
