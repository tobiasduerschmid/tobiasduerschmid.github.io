// @ts-check
const { test, expect } = require('@playwright/test');
const {
  loadTutorialConfig,
  expectActiveStep,
  expectStepCount,
} = require('./tutorial-helpers');

const TUTORIAL_URL = '/SEBook/tools/multi-backend-placeholder-tutorial';
const BOOT_TIMEOUT = 90_000;
const RUN_TIMEOUT = 30_000;
const WARM_SWITCH_TIMEOUT_MS = 10_000;

const config = loadTutorialConfig('multi-backend-placeholder');
const steps = config.steps;

async function waitForTutorialReady(page) {
  await page.waitForSelector('.tvm-output-panel', { timeout: BOOT_TIMEOUT });
  await page.waitForSelector('.tvm-preview-panel', { state: 'attached', timeout: BOOT_TIMEOUT });
  await page.waitForSelector('.tvm-step-btn', { timeout: 10_000 });
  await expect(page.locator('.tvm-loading')).toBeHidden({ timeout: BOOT_TIMEOUT });
}

async function clickRun(page) {
  const runBtn = page.locator('.tvm-run-btn');
  await expect(runBtn).toBeVisible({ timeout: 10_000 });
  await runBtn.click();
  await expect(runBtn).toHaveText(/^▶\s+/, { timeout: RUN_TIMEOUT });
}

async function goNext(page, stepIndex, opts = {}) {
  const start = Date.now();
  await page.locator('.tvm-btn-next').click();
  await expectActiveStep(page, stepIndex);
  await expect(page.locator('.tvm-loading')).toBeHidden({ timeout: BOOT_TIMEOUT });
  const elapsed = Date.now() - start;
  if (opts.maxMs) {
    expect(elapsed, `step ${stepIndex + 1} should be warm after ${opts.label || 'backend prewarm'}`)
      .toBeLessThan(opts.maxMs);
  }
  return elapsed;
}

async function expectOutputRuntime(page) {
  await expect(page.locator('.tvm-output-panel')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.tvm-preview-panel')).toBeHidden();
  await expect(page.locator('.tvm-run-btn')).toBeVisible();
}

async function expectPreviewRuntime(page, heading) {
  await expect(page.locator('.tvm-preview-panel')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.tvm-output-panel')).toBeHidden();
  await expect(page.frameLocator('.tvm-preview-frame').getByRole('heading', { name: heading }))
    .toBeVisible({ timeout: 20_000 });
}

test.describe.serial('Multi-backend placeholder tutorial', () => {
  test.setTimeout(180_000);

  /** @type {import('@playwright/test').Page} */
  let page;

  /** @type {import('@playwright/test').BrowserContext} */
  let context;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto(TUTORIAL_URL);
    await waitForTutorialReady(page);
  });

  test.afterAll(async () => { await context?.close(); });

  test('hidden tutorial loads with six backend-switching steps', async () => {
    await expect(page.locator('.tvm-container')).toBeVisible();
    await expectStepCount(page, steps.length);
    expect(steps.map((step) => step.backend)).toEqual([
      'pyodide',
      'react',
      'webcontainer',
      'react',
      'pyodide',
      'webcontainer',
    ]);
    await expectActiveStep(page, 0);
    await expect(page.locator('.tvm-step-timer')).toContainText(/^Time left /);
  });

  test('python, react, node, react, python, node sequence remains usable', async () => {
    await expectOutputRuntime(page);
    await clickRun(page);
    await expect(page.locator('.tvm-output-pre'))
      .toContainText('Python placeholder one', { timeout: RUN_TIMEOUT });

    await goNext(page, 1);
    await expectPreviewRuntime(page, 'React placeholder one');

    await goNext(page, 2);
    await expectOutputRuntime(page);
    await clickRun(page);
    await expect(page.locator('.tvm-output-pre'))
      .toContainText('Node placeholder one', { timeout: RUN_TIMEOUT });

    await goNext(page, 3, { maxMs: WARM_SWITCH_TIMEOUT_MS, label: 'second React step' });
    await expectPreviewRuntime(page, 'React placeholder two');

    await goNext(page, 4, { maxMs: WARM_SWITCH_TIMEOUT_MS, label: 'second Python step' });
    await expectOutputRuntime(page);
    await clickRun(page);
    await expect(page.locator('.tvm-output-pre'))
      .toContainText('Python placeholder two', { timeout: RUN_TIMEOUT });

    await goNext(page, 5, { maxMs: WARM_SWITCH_TIMEOUT_MS, label: 'second Node.js step' });
    await expectOutputRuntime(page);
    await clickRun(page);
    await expect(page.locator('.tvm-output-pre'))
      .toContainText('Node placeholder two', { timeout: RUN_TIMEOUT });
  });

  test('timed practice lockout persists and still allows previous-step navigation', async () => {
    await page.evaluate(() => {
      localStorage.setItem('tutorial-time-practice-multi-backend-placeholder', JSON.stringify({
        steps: {
          4: {
            completed: false,
            deadline: Date.now() - 1000,
          },
        },
      }));
      return window._tutorial.loadStep(4);
    });
    await expectActiveStep(page, 4);
    await expect(page.locator('.tvm-timed-practice-lockout')).toBeVisible();
    await expect(page.locator('.tvm-step-timer')).toContainText(/^Try again in /);
    const lockoutRemaining = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('tutorial-time-practice-multi-backend-placeholder') || '{}');
      return state.steps['4'].lockoutUntil - Date.now();
    });
    expect(lockoutRemaining).toBeGreaterThan(55 * 60 * 1000);

    await page.locator('.tvm-btn-prev').click();
    await expectActiveStep(page, 3);
    await expectPreviewRuntime(page, 'React placeholder two');
  });
});
