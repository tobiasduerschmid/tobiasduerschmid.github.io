// @ts-check
const { test, expect } = require('@playwright/test');
const {
  loadTutorialConfig,
  passCurrentStepTests,
  answerQuizCorrectly,
  setEditorContent,
} = require('./tutorial-helpers');

/**
 * Tests: Makefiles Tutorial (v86 backend)
 *
 * Two serial describe blocks share one page each — the v86 VM boots only
 * twice per run (instead of once per test).
 *
 * Note: The last step (step 7) has no tests or quiz — it is a "big picture"
 * reflection step. No YAML-driven test is generated for it.
 *
 * Block 1 – Structure, navigation, terminal, editor.
 * Block 2 – YAML-driven: applies each step's solution, verifies test count,
 *           answers the quiz, and advances to the next step.
 */

const TUTORIAL_URL     = '/SEBook/tools/makefile-tutorial';
const VM_BOOT_TIMEOUT  = 60_000;
const TEST_RUN_TIMEOUT = 30_000;

const config = loadTutorialConfig('makefile');
const steps  = config.steps;

async function waitForTutorialReady(page) {
  await page.waitForSelector('.tvm-container', { timeout: VM_BOOT_TIMEOUT });
  await page.waitForSelector('.tvm-step-btn',  { timeout: 10_000 });
}

// =============================================================================
// Block 1 – Structure, navigation, terminal, editor
// =============================================================================
test.describe.serial('Makefile Tutorial', () => {
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

  test('editor shows a file tab on the first step', async () => {
    const tabs = page.locator('.tvm-tab');
    await expect(tabs.first()).toBeVisible({ timeout: 10_000 });
    expect(await tabs.count()).toBeGreaterThanOrEqual(1);
    await expect(page.locator('.tvm-editor-container')).toBeVisible();
  });

  test('terminal panel is present', async () => {
    await expect(page.locator('.tvm-terminal-container')).toBeVisible();
    await expect(page.locator('.tvm-terminal-container .xterm')).toBeVisible();
  });

  test('test button triggers execution and shows test items', async () => {
    await page.locator('.tvm-btn-test').click();
    await page.waitForSelector('.tvm-test-summary', { timeout: TEST_RUN_TIMEOUT });
    expect(await page.locator('.tvm-test-item').count()).toBeGreaterThan(0);
  });

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

  // --- Quiz flow (also unlocks step 2 for the navigation test) ---

  test('quiz flow: passing step 1 → next → quiz → continue advances to step 2', async () => {
    await passCurrentStepTestsV86(page, TEST_RUN_TIMEOUT);
    await page.locator('.tvm-btn-next').click();
    await page.waitForSelector('.tvm-quiz-panel .quiz-question-card.active', { timeout: 5_000 });
    await answerQuizCorrectly(page);
    await page.locator('.tvm-quiz-continue-btn').click();
    await expect(page.locator('.tvm-step-btn').nth(1)).toHaveClass(/active/);
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

// Makefile v86: write ALL files (initial step files + solution files) and run
// commands exclusively through _runSilent to avoid 9p FS cache inconsistencies
// with create_file(), and to handle the case where loadStep runs before VM boot.
async function passCurrentStepTestsV86(page, timeout = 30_000) {
  await page.waitForFunction(() => window.monaco?.editor?.getEditors?.()?.length > 0,
    { timeout: 15_000 });
  await page.waitForFunction(() => window._tutorial && window._tutorial.booted,
    { timeout: 60_000 });
  await page.evaluate(function () {
    var tut = window._tutorial;
    var step = tut.steps[tut.currentStep];
    if (!step) return Promise.resolve();
    var solution = step.solution || {};
    // Helper: write file content via _runSilent (shell-side, avoids 9p cache)
    function writeFile(chain, path, content) {
      return chain.then(function () {
        var b64 = btoa(unescape(encodeURIComponent(content || '')));
        var dir = path.indexOf('/') !== -1 ? path.substring(0, path.lastIndexOf('/')) : '';
        var mk = dir ? 'mkdir -p /tutorial/' + dir + ' && ' : '';
        return tut._runSilent(mk + 'printf "' + b64 + '" | base64 -d > /tutorial/' + path);
      });
    }
    var chain = Promise.resolve();
    // 1. Write initial step files (may have been skipped if VM wasn't booted during loadStep)
    (step.files || []).forEach(function (f) {
      chain = writeFile(chain, f.path, f.content);
    });
    // 2. Write solution files (overrides initial files where applicable)
    if (solution.files) {
      tut._suppressAutoSave = true;
      solution.files.forEach(function (f) {
        tut.openFile(f.path, f.content, f.language);
      });
      tut._suppressAutoSave = false;
      var target = step.open_file || (solution.files.length > 0 ? solution.files[solution.files.length - 1].path : null);
      if (target) { tut._setActiveFile(target); tut._renderTabs(); }
      solution.files.forEach(function (f) {
        chain = writeFile(chain, f.path, f.content);
      });
    }
    // 3. Run solution commands
    (solution.commands || []).forEach(function (cmd) {
      chain = chain.then(function () {
        return tut._runSilent(cmd.replace(/^git /, 'git --no-pager '));
      });
    });
    return chain;
  });
  // Widen the terminal to prevent command+marker wrapping past 80 columns
  await page.evaluate(function () {
    return window._tutorial._runSilent('stty columns 200');
  });
  await page.evaluate(function () { return window._tutorial.applySolution(); });
  await page.locator('.tvm-btn-test').click();
  await expect(page.locator('.tvm-test-summary.all-pass')).toBeVisible({ timeout });
}

// =============================================================================
// Block 2 – YAML-driven step-by-step tests (one shared page, one VM boot)
// =============================================================================
test.describe.serial('Makefile Tutorial — step-by-step', () => {
  test.setTimeout(120_000);

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
        await passCurrentStepTestsV86(page, TEST_RUN_TIMEOUT);
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
    }
  }
});
