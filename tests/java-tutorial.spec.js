// @ts-check
const { test, expect } = require('@playwright/test');
const {
  loadTutorialConfig,
  passCurrentStepTests,
  answerQuizCorrectly,
  setEditorContent,
} = require('./tutorial-helpers');

/**
 * Tests: Java for C++ and Python Developers (Java backend)
 *
 * Two serial describe blocks share one page each — the Java worker loads only
 * twice per run.
 *
 * Block 1 – Structure, navigation, run, editor.
 * Block 2 – YAML-driven: applies each step's solution, verifies test count,
 *           answers the quiz, and advances to the next step.
 */

const TUTORIAL_URL     = '/SEBook/tools/java-tutorial';
const BOOT_TIMEOUT     = 60_000;
const TEST_RUN_TIMEOUT = 30_000;

const config = loadTutorialConfig('java');
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

// =============================================================================
// Block 1 – Structure, navigation, run, editor
// =============================================================================
test.describe.serial('Java Tutorial — structure', () => {
  test.setTimeout(120_000);

  /** @type {import('@playwright/test').Page} */
  let page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto(TUTORIAL_URL);
    await waitForTutorialReady(page);
  });

  test.afterAll(async () => { await page?.close(); });

  test('tutorial loads with correct number of steps from YAML', async () => {
    await expect(page.locator('.tvm-container')).toBeVisible();
    await expect(page.locator('.tvm-loading')).toBeHidden();
    expect(await page.locator('.tvm-step-btn').count()).toBe(steps.length);
    await expect(page.locator('.tvm-step-btn').first()).toHaveClass(/active/);
    await expect(page.locator('.tvm-step-content')).not.toBeEmpty();
  });

  test('output panel is present — no terminal for Java backend', async () => {
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

  test('clicking run executes Java code and shows output', async () => {
    await page.waitForFunction(() => window.monaco?.editor?.getEditors?.()?.length > 0,
      { timeout: 15_000 });
    await setEditorContent(page, `public class Welcome {
      public static void main(String[] args) {
        System.out.println("Hello, Java!");
      }
    }`);
    await page.locator('.tvm-editor-container').click();
    await page.keyboard.press('Control+s');
    await page.waitForTimeout(500);
    await clickRun(page);
    await expect(page.locator('.tvm-output-pre'))
      .toContainText('Hello, Java!', { timeout: TEST_RUN_TIMEOUT });
  });
});

// =============================================================================
// Block 2 – YAML-driven step-by-step: solution → tests → quiz → advance
// =============================================================================
test.describe.serial('Java Tutorial — step-by-step', () => {
  test.setTimeout(180_000);

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
        await passCurrentStepTests(page, TEST_RUN_TIMEOUT);
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
