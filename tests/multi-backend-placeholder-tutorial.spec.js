// @ts-check
const { test, expect } = require('@playwright/test');
const {
  loadTutorialConfig,
  answerQuizCorrectly,
  expectActiveStep,
  expectStepCount,
} = require('./tutorial-helpers');

const TUTORIAL_URL = '/SEBook/tools/multi-backend-placeholder-tutorial';
const BOOT_TIMEOUT = 90_000;
const RUN_TIMEOUT = 30_000;
const WARM_SWITCH_TIMEOUT_MS = 10_000;
const TIMER_STORAGE_KEY = 'tutorial-time-practice-multi-backend-placeholder';

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

async function expectTimedPracticeClock(page) {
  const timer = page.getByRole('timer', { name: /^Time left / });
  await expect(timer).toBeVisible({ timeout: 10_000 });
  await expect(timer).toContainText(/^Time left /);
  return timer;
}

async function goNext(page, stepIndex, opts = {}) {
  const start = Date.now();
  await page.locator('.tvm-btn-next').click();
  await expectActiveStep(page, stepIndex);
  await expect(page.locator('.tvm-loading')).toBeHidden({ timeout: BOOT_TIMEOUT });
  await expectTimedPracticeClock(page);
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

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(120_000);
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
    expect(steps.map((step) => step['max-time'])).toEqual([10, 10, 10, 10, 10, 10]);
    expect(steps[5].quiz?.title).toBe('Step 6 — Knowledge Check');
    await expectActiveStep(page, 0);
    await expectTimedPracticeClock(page);
  });

  test('python, react, node, react, python, node sequence remains usable', async () => {
    await expectOutputRuntime(page);
    await expectTimedPracticeClock(page);
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

  test('timed practice remains active through the final knowledge check and completes when passed', async () => {
    await expectActiveStep(page, 5);
    await expectTimedPracticeClock(page);

    await page.locator('.tvm-btn-next').click();
    await expect(page.locator('.tvm-quiz-panel')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('heading', { name: 'Step 6 — Knowledge Check' })).toBeVisible();
    await expectTimedPracticeClock(page);

    await answerQuizCorrectly(page);
    await expect(page.locator('.tvm-quiz-panel .quiz-results:not(.hidden)'))
      .toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('timer', { name: /^Time left / })).toBeHidden();

    const completed = await page.evaluate((storageKey) => {
      const state = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return state.steps?.['5']?.completed === true;
    }, TIMER_STORAGE_KEY);
    expect(completed).toBe(true);
  });

  test('urgent timed countdown respects reduced-motion preference', async () => {
    await page.evaluate((storageKey) => {
      const state = JSON.parse(localStorage.getItem(storageKey) || '{"steps":{}}');
      state.steps = state.steps || {};
      state.steps['1'] = {
        completed: false,
        deadline: Date.now() + 30_000,
      };
      localStorage.setItem(storageKey, JSON.stringify(state));
      window.__prefersReducedMotion = () => true;
      return window._tutorial.loadStep(1);
    }, TIMER_STORAGE_KEY);
    await expectActiveStep(page, 1);
    const timer = await expectTimedPracticeClock(page);
    await expect(timer).not.toHaveClass(/is-urgent/);

    await page.evaluate(() => {
      window.__prefersReducedMotion = () => false;
      return window._tutorial.loadStep(1);
    });
    await expectActiveStep(page, 1);
    await expect(timer).toHaveClass(/is-urgent/);
  });

  test('timed practice controls allow extending the active timer', async () => {
    await page.evaluate((storageKey) => {
      const state = JSON.parse(localStorage.getItem(storageKey) || '{"steps":{}}');
      state.steps = state.steps || {};
      state.steps['1'] = {
        completed: false,
        deadline: Date.now() + 30_000,
      };
      localStorage.setItem(storageKey, JSON.stringify(state));
      return window._tutorial.loadStep(1);
    }, TIMER_STORAGE_KEY);
    await expectActiveStep(page, 1);
    const timer = page.getByRole('timer', { name: /^Time left / });
    await expect(timer).toBeVisible();

    await page.getByRole('button', { name: '+5 min' }).click();
    await expect(timer).toHaveText(/^Time left 5:/);
    const extendedText = await timer.textContent();
    await expect.poll(async () => {
      const text = await timer.textContent();
      return text && text !== extendedText && /^Time left 5:\d{2}$/.test(text) ? text : '';
    }, {
      message: 'extended timer should keep the extra five minutes after the next countdown tick',
      timeout: 4_000,
    }).toMatch(/^Time left 5:/);

    await expect(page.getByRole('button', { name: 'Timer off' })).toHaveCount(0);
  });

  test('timed practice lockout persists and still allows previous-step navigation', async () => {
    await page.evaluate((storageKey) => {
      localStorage.setItem(storageKey, JSON.stringify({
        steps: {
          4: {
            completed: false,
            deadline: Date.now() - 1000,
          },
        },
      }));
      window.__prefersReducedMotion = undefined;
      return window._tutorial.loadStep(4);
    }, TIMER_STORAGE_KEY);
    await expectActiveStep(page, 4);
    await expect(page.locator('.tvm-timed-practice-lockout')).toBeVisible();
    await expect(page.getByRole('timer', { name: /^Try again in / })).toContainText(/^Try again in /);
    const lockoutRemaining = await page.evaluate((storageKey) => {
      const state = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return state.steps['4'].lockoutUntil - Date.now();
    }, TIMER_STORAGE_KEY);
    expect(lockoutRemaining).toBeGreaterThan(55 * 60 * 1000);

    await page.locator('.tvm-btn-prev').click();
    await expectActiveStep(page, 3);
    await expectPreviewRuntime(page, 'React placeholder two');
  });

  test('legacy timer-off state is migrated back to a countdown', async () => {
    await page.evaluate((storageKey) => {
      localStorage.setItem(storageKey, JSON.stringify({
        steps: {
          1: { timerDisabled: true },
        },
      }));
      return window._tutorial.loadStep(1);
    }, TIMER_STORAGE_KEY);
    await expectActiveStep(page, 1);
    await expectTimedPracticeClock(page);
    await expect(page.getByRole('button', { name: 'Timer off' })).toHaveCount(0);

    const legacyDisabled = await page.evaluate((storageKey) => {
      const state = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return state.steps?.['1']?.timerDisabled === true;
    }, TIMER_STORAGE_KEY);
    expect(legacyDisabled).toBe(false);
  });
});
