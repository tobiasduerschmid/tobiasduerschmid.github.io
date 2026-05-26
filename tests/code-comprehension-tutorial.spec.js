// @ts-check
const { test, expect } = require('@playwright/test');
const {
  expectActiveStep,
  waitForTutorialReady,
} = require('./tutorial-helpers');

const TUTORIAL_URL = '/SEBook/development_practices/code-comprehension-tutorial?instructor-mode=true';
const TIMER_STORAGE_KEY = 'tutorial-time-practice-code-comprehension';
const BOOT_TIMEOUT = 90_000;

async function openTimedSprint(page) {
  await page.goto(TUTORIAL_URL);
  await waitForTutorialReady(page, { bootTimeout: BOOT_TIMEOUT });
  await page.getByRole('button', { name: /^Step 2: Python Reading Sprint/ }).click();
  await expectActiveStep(page, 1);
}

test.describe('Code comprehension tutorial timed practice', () => {
  test('Python reading sprint shows a countdown when opened', async ({ page }) => {
    await openTimedSprint(page);

    const timer = page.getByRole('timer', { name: /^Time left / });
    await expect(timer).toHaveText(/^Time left (7:00|6:5\d)$/);
  });

  test('legacy timer-off state is ignored so the countdown is visible', async ({ page }) => {
    await page.addInitScript((storageKey) => {
      localStorage.setItem(storageKey, JSON.stringify({
        steps: {
          1: { timerDisabled: true },
        },
      }));
    }, TIMER_STORAGE_KEY);

    await openTimedSprint(page);

    await expect(page.getByRole('timer', { name: /^Time left / }))
      .toHaveText(/^Time left (7:00|6:5\d)$/);
    const legacyDisabled = await page.evaluate((storageKey) => {
      const state = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return state.steps?.['1']?.timerDisabled === true;
    }, TIMER_STORAGE_KEY);
    expect(legacyDisabled).toBe(false);
  });
});
