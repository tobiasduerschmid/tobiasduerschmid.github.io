// @ts-check
const { test, expect } = require('@playwright/test');
const {
  loadTutorialConfig,
  passCurrentStepTests,
  answerQuizCorrectly,
  setEditorContent,
} = require('./tutorial-helpers');

/**
 * Tests: TDD with pytest Tutorial (Pyodide backend)
 *
 * Two serial describe blocks share one page each — Pyodide loads only twice
 * per run (instead of once per test).
 *
 * Block 1 – Structure, navigation, run/clear, editor.
 * Block 2 – YAML-driven: applies each step's solution, verifies test count,
 *           answers the quiz, and advances to the next step.
 *
 * Note: The final step ("The Big Picture") has no tests — it is a reflection
 * step with no automated verification. No YAML-driven test is generated for it.
 * Tutorial has 5 TDD steps (prerequisite content lives in the Testing
 * Foundations tutorial): 1-Red-Green-Refactor, 2-FizzBuzz Kata, 3-Password
 * Validator (+ invalid-input + parametrize), 4-TDD with AI Assistants,
 * 5-Big Picture.
 */

const TUTORIAL_URL     = '/SEBook/tools/tdd-tutorial';
const BOOT_TIMEOUT     = 60_000;
const TEST_RUN_TIMEOUT = 90_000;

const config = loadTutorialConfig('tdd');
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
  await expect(runBtn).toHaveText(/▶|Run/, { timeout: TEST_RUN_TIMEOUT });
}

/**
 * Pyodide: running the active file before clicking Test triggers
 * loadPackagesFromImports() on the file content, which loads pytest (and any
 * other needed packages) into the Pyodide runtime.  Without this, test commands
 * that use __run_capture() → exec() → import pytest fail with ModuleNotFoundError
 * because exec() bypasses Pyodide's package-loading mechanism.
 */
async function passCurrentStepTestsTDD(page, timeout = TEST_RUN_TIMEOUT) {
  await page.waitForFunction(() => window.monaco?.editor?.getEditors?.()?.length > 0,
    { timeout: 15_000 });
  await page.evaluate(() => window._tutorial.applySolution());
  await page.waitForTimeout(1_000);
  // Run the active file to trigger loadPackagesFromImports (loads pytest etc.)
  await clickRun(page);
  await page.waitForTimeout(500);
  await page.locator('.tvm-btn-test').click();
  await expect(page.locator('.tvm-test-summary.all-pass')).toBeVisible({ timeout });
}

// =============================================================================
// Block 1 – Structure, navigation, run/clear, editor
// =============================================================================
test.describe.serial('TDD Tutorial', () => {
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
    await expect(page.locator('.tvm-editor-container').first()).toBeVisible();
  });

  // --- Run / clear ---

  test('clicking run executes Python and shows output', async () => {
    await page.waitForFunction(() => window.monaco?.editor?.getEditors?.()?.length > 0,
      { timeout: 15_000 });
    await setEditorContent(page, 'print("Hello TDD!")');
    await page.locator('.tvm-editor-container').first().click();
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(500);
    await clickRun(page);
    await expect(page.locator('.tvm-output-pre'))
      .toContainText('Hello TDD!', { timeout: TEST_RUN_TIMEOUT });
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
    await page.locator('.tvm-editor-container').first().click();
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(500);
    await clickRun(page);
    await expect(page.locator('.tvm-output-pre'))
      .toContainText(/Error|error|SyntaxError/i, { timeout: TEST_RUN_TIMEOUT });
  });

  test('debugger starts pytest runs for test files', async ({ browser }) => {
    const debugPage = await browser.newPage();
    try {
      await debugPage.goto(`${TUTORIAL_URL}?instructor-mode=true&autosave=false`);
      await waitForTutorialReady(debugPage);
      await debugPage.waitForFunction(() =>
        window._tutorial && window._tutorial.booted && window._tutorial._debuggerCtl,
        { timeout: BOOT_TIMEOUT });
      await debugPage.evaluate(async () => {
        const tutorial = window._tutorial;
        tutorial.instructorMode = true;
        for (let step = 0; step <= 6; step++) {
          tutorial._stepsUnlocked.add(step);
        }
        tutorial.loadStep(6);
        await new Promise(resolve => setTimeout(resolve, 500));
        await tutorial.applySolution();
      });
      const loadedTestSource = await debugPage.evaluate(() =>
        window._tutorial.editorModels['test_scorer.py'].model.getValue());
      expect(loadedTestSource).toContain('test_one_and_five_create_two_different_events');

      const targetLine = await debugPage.evaluate(() => {
        const tutorial = window._tutorial;
        tutorial._setActiveFile('test_scorer.py');
        const model = tutorial.editorModels['test_scorer.py'].model;
        const lineCount = model.getLineCount();
        for (let line = 1; line <= lineCount; line++) {
          if (model.getLineContent(line).includes('report = score([])')) {
            const ctl = tutorial._debuggerCtl;
            ctl.breakpoints = new Map();
            ctl.watchpoints = [];
            ctl._pendingWatches = [];
            ctl.persistBreakpoints();
            ctl.refreshBpDecorations();
            ctl.toggleBreakpoint('test_scorer.py', line);
            ctl.startSession();
            return line;
          }
        }
        return -1;
      });
      expect(targetLine).toBeGreaterThan(0);

      await debugPage.waitForFunction(() => {
        const ctl = window._tutorial && window._tutorial._debuggerCtl;
        return ctl && ctl.paused && ctl.historyIdx >= 0;
      }, null, { timeout: TEST_RUN_TIMEOUT });
      await debugPage.evaluate(() => window._tutorial._debuggerCtl.handleToolbarCmd('continue'));

      await debugPage.waitForFunction(({ targetLine }) => {
        const ctl = window._tutorial && window._tutorial._debuggerCtl;
        const snap = ctl && ctl.history && ctl.history[ctl.historyIdx];
        return ctl && ctl.paused && snap &&
          snap.line === targetLine &&
          /test_scorer\.py$/.test(snap.file || '');
      }, { targetLine }, { timeout: TEST_RUN_TIMEOUT });

      const state = await debugPage.evaluate(() => {
        const ctl = window._tutorial._debuggerCtl;
        const snap = ctl.history[ctl.historyIdx];
        return {
          line: snap.line,
          file: snap.file,
          debugFilename: ctl.session && ctl.session.debugFilename,
          status: ctl.statusEl && ctl.statusEl.textContent,
          output: document.querySelector('.tvm-output-pre')?.textContent || '',
        };
      });
      expect(state.debugFilename).toBe('/tutorial/test_scorer.py');
      expect(state.output).toContain('test_scorer.py');
      expect(state.status).toContain(String(targetLine));
    } finally {
      await debugPage.close();
    }
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

  // --- Step advance (also unlocks step 2 for the navigation test) ---
  // Step 1 has no quiz — the first knowledge check is after the REFACTOR step
  // (step 3). Passing step 1's tests + Next should advance directly to step 2.

  test('passing step 1 + next advances to step 2', async () => {
    await passCurrentStepTests(page, TEST_RUN_TIMEOUT);
    await page.locator('.tvm-btn-next').click();
    await expect(page.locator('.tvm-step-btn').nth(1)).toHaveClass(/active/, { timeout: 5_000 });
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
test.describe.serial('TDD Tutorial — step-by-step', () => {
  test.setTimeout(200_000);

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
        await passCurrentStepTestsTDD(page, TEST_RUN_TIMEOUT);
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
    } else if (!isLast && step.tests?.length > 0) {
      // No quiz on this step — advance to the next step directly via Next.
      test(`step ${i + 1} "${step.title}": advances to step ${i + 2}`, async () => {
        await page.locator('.tvm-btn-next').click();
        await expect(page.locator('.tvm-step-btn').nth(i + 1)).toHaveClass(/active/, { timeout: 5_000 });
      });
    }
  }
});
