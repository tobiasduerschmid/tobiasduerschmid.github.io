// @ts-check
//
// Covers the CS131 refresher, the first tutorial to mix v86 (C++) steps with
// pyodide (Python) steps. The behaviour unique to this tutorial — and the
// reason this spec exists separately from multi-backend-placeholder — is the
// terminal runtime panel: mixed mode previously built only the output and
// preview panels, so a v86 step had nowhere to render.
const { test, expect } = require('@playwright/test');
const {
  loadTutorialConfig,
  expectActiveStep,
  expectStepCount,
  passCurrentStepTests,
  expectRenderedStepTests,
} = require('./tutorial-helpers');

const TUTORIAL_URL = '/SEBook/tools/cs131-refresher-tutorial';
const BOOT_TIMEOUT = 120_000;
const TEST_TIMEOUT = 60_000;

const config = loadTutorialConfig('cs131-refresher');
const steps = config.steps;

const outputPanel = (page) => page.locator('.tvm-output-panel');
const previewPanel = (page) => page.locator('.tvm-preview-panel');
const terminalPanel = (page) => page.locator('.tvm-terminal-panel');

/** Exactly one runtime panel is visible, and it is the one the backend needs. */
async function expectRuntimePanelFor(page, backend) {
  const expectations = {
    v86: [terminalPanel(page), outputPanel(page), previewPanel(page)],
    pyodide: [outputPanel(page), terminalPanel(page), previewPanel(page)],
  }[backend];
  const [visible, ...hidden] = expectations;
  await expect(visible).toBeVisible({ timeout: BOOT_TIMEOUT });
  for (const panel of hidden) await expect(panel).toBeHidden();
}

async function gotoStep(page, index) {
  await page.getByRole('button', { name: new RegExp(`^Step ${index + 1}:`) }).click();
  await expectActiveStep(page, index);
  await expect(page.locator('.tvm-loading')).toBeHidden({ timeout: BOOT_TIMEOUT });
}

test.describe.serial('CS131 refresher tutorial', () => {
  test.setTimeout(360_000);

  /** @type {import('@playwright/test').Page} */
  let page;
  /** @type {import('@playwright/test').BrowserContext} */
  let context;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(180_000);
    context = await browser.newContext();
    page = await context.newPage();
    // Instructor mode exposes applySolution() for the per-step gate checks.
    await page.goto(`${TUTORIAL_URL}?instructor-mode=true`);
    await page.waitForSelector('.tvm-step-btn', { timeout: BOOT_TIMEOUT });
    await expect(page.locator('.tvm-loading')).toBeHidden({ timeout: BOOT_TIMEOUT });
  });

  test.afterAll(async () => { await context?.close(); });

  test('alternates C++ VM steps with Python steps', async () => {
    await expectStepCount(page, 8);
    expect(steps.map((step) => step.backend)).toEqual([
      'v86', 'pyodide', 'pyodide', 'v86', 'pyodide', 'pyodide', 'v86', 'pyodide',
    ]);
    expect(config.backend).toBe('multiple');
    // Mixed mode empties top-level setup_commands, so the VM's working
    // directory has to come from the per-backend map or step 1's tests
    // would read a path that was never created.
    expect(config.setup_commands_by_backend.v86).toContain('mkdir -p /tutorial/cs131');
    await expectActiveStep(page, 0);
  });

  test('a v86 step renders the terminal instead of the output panel', async () => {
    await expectRuntimePanelFor(page, 'v86');
    await expect(page.locator('.tvm-terminal-container .xterm')).toBeVisible({ timeout: BOOT_TIMEOUT });
    // The Run button lives in the output panel, which v86 steps replace.
    await expect(page.locator('.tvm-run-btn')).toBeHidden();
  });

  test('switching to a Python step swaps the terminal for the output panel', async () => {
    await gotoStep(page, 1);
    await expectRuntimePanelFor(page, 'pyodide');
    await expect(page.locator('.tvm-run-btn')).toBeVisible();

    await gotoStep(page, 0);
    await expectRuntimePanelFor(page, 'v86');
  });

  test('every step gates on its own backend and passes for the published solution', async () => {
    for (const [index, step] of steps.entries()) {
      await gotoStep(page, index);
      await expectRuntimePanelFor(page, step.backend);
      await passCurrentStepTests(page, TEST_TIMEOUT);
      // The result rows only exist after a run; assert the step's own gates ran.
      await expectRenderedStepTests(page, step);
    }
  });
});
