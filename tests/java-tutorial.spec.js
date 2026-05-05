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
const A11Y_FEATURE = 'java-tutorial';

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
  await showOutputPane(page);
  const runBtn = page.locator('.tvm-run-btn');
  await expect(runBtn).toBeVisible({ timeout: 5_000 });
  await runBtn.click();
  await expect(runBtn).toHaveText(/▶|Run/, { timeout: TEST_RUN_TIMEOUT });
}

async function showOutputPane(page) {
  const outputTab = page.locator('.tvm-right-tab[data-panel="output"]');
  if (await outputTab.count()) {
    await outputTab.click();
    await expect(page.locator('.tvm-output-view')).toBeVisible({ timeout: 5_000 });
  }
}

async function showUmlPane(page) {
  const umlTab = page.locator('.tvm-right-tab[data-panel="uml"]');
  if (await umlTab.count()) {
    await umlTab.click();
    await expect(page.locator('.tvm-uml-right-view')).toBeVisible({ timeout: 5_000 });
  }
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
    await expectStepCount(page, steps.length);
    await expectActiveStep(page, 0);
    await expect(page.locator('.tvm-step-content')).not.toBeEmpty();
  });

  test('output panel is present — no terminal for Java backend', async () => {
    await expect(page.locator('.tvm-output-panel')).toBeVisible();
    await expect(page.locator('.tvm-terminal-container')).toHaveCount(0);
  });

  test('run and clear buttons are present', async () => {
    await showOutputPane(page);
    await expect(page.locator('.tvm-run-btn')).toBeVisible();
    await expect(page.locator('.tvm-clear-btn')).toBeVisible();
  });

  test('editor shows a file tab on the first step', async () => {
    const tabs = page.locator('.tvm-tab');
    await expect(tabs.first()).toBeVisible({ timeout: 10_000 });
    expect(await tabs.count()).toBeGreaterThanOrEqual(1);
    await expect(page.locator('.tvm-editor-container')).toBeVisible();
  });

  test('first Java step shows UML by default without widening the page', async () => {
    await page.waitForFunction(
      () => window._tutorial?._umlWatchedFiles?.includes('Welcome.java'),
      { timeout: 15_000 },
    );
    await showUmlPane(page);

    await expect(page.locator('.tvm-right-tab[data-panel="uml"]')).toBeVisible();
    await expect(page.locator('.tvm-right-tab[data-panel="uml"]')).toHaveClass(/active/);
    await expect(page.locator('.tvm-uml-right-view')).toBeVisible();
    await expect(page.locator('.tvm-output-view')).toBeHidden();
    await expect(page.locator('.tvm-uml-right-view svg')).toBeVisible({ timeout: 15_000 });

    const layout = await page.evaluate(() => {
      const container = document.querySelector('.tvm-container');
      const instructions = document.querySelector('.tvm-instructions-panel');
      return {
        watchedFiles: window._tutorial?._umlWatchedFiles || [],
        umlLanguage: window._tutorial?._umlLanguage,
        instructionsRatio:
          instructions && container
            ? instructions.getBoundingClientRect().width / container.getBoundingClientRect().width
            : 0,
        documentOverflow:
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });

    expect(layout.watchedFiles).toContain('Welcome.java');
    expect(layout.umlLanguage).toBe('java');
    expect(layout.instructionsRatio).toBeGreaterThan(0.45);
    expect(layout.instructionsRatio).toBeLessThan(0.55);
    expect(layout.documentOverflow).toBe(0);
  });

  test('clicking run executes Java code and shows output', async () => {
    await showOutputPane(page);
    await page.waitForFunction(() => window.monaco?.editor?.getEditors?.()?.length > 0,
      { timeout: 15_000 });
    await setEditorContent(page, `public class Welcome {
      public static void main(String[] args) {
        System.out.println("Hello, Java!");
      }
    }`);
    await page.locator('.tvm-editor-container').click();
    await page.keyboard.press('Control+s');
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
        await expectRenderedStepTests(page, step);
        await a11yCheckpoint(page, `java tutorial — step ${i + 1} all tests passing`, { feature: A11Y_FEATURE, darkMode: true });
      });
    }

    if (step.quiz?.questions?.length > 0 && !isLast) {
      test(`step ${i + 1} "${step.title}": quiz gate — advances to step ${i + 2}`, async () => {
        await page.locator('.tvm-btn-next').click();
        await expect(page.locator('.tvm-quiz-panel')).toBeVisible({ timeout: 5_000 });
        await a11yCheckpoint(page, `java tutorial — step ${i + 1} quiz gate (first question)`, { feature: A11Y_FEATURE, darkMode: true });
        await answerQuizCorrectly(page);
        await expect(page.locator('.tvm-quiz-panel .quiz-results:not(.hidden)')).toBeVisible();
        await expect(page.locator('.tvm-quiz-continue-btn')).toBeVisible();
        await a11yCheckpoint(page, `java tutorial — step ${i + 1} quiz results`, { feature: A11Y_FEATURE, darkMode: true });
        await page.locator('.tvm-quiz-continue-btn').click();
        await expect(page.locator('.tvm-quiz-panel')).toBeHidden({ timeout: 5_000 });
      });
    }
  }
});
