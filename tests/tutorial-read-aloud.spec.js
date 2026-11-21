// @ts-check
const { test, expect } = require('@playwright/test');
const { loadTutorialConfig, expectActiveStep, clickStep } = require('./tutorial-helpers');
const { installSpeechEngine } = require('./speech-synthesis-fake');

const URL = '/SEBook/verification/tla-tutorial';
const tutorial = loadTutorialConfig('tla');

test('read-aloud stops when the learner moves to another step', async ({ page }) => {
  await installSpeechEngine(page);
  await page.goto(URL);
  await expectActiveStep(page, 0);
  await page.getByRole('button', { name: /^Read Aloud/ }).click();
  const speechControls = page.getByRole('region', { name: 'Text-to-speech controls' });
  await expect(speechControls).toBeVisible();

  await clickStep(page, 1);

  await expect(page.getByRole('heading', { name: tutorial.steps[1].title, exact: true })).toBeVisible();
  await expect(speechControls).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.speechSynthesis.speaking),
    { message: 'the previous step must stop being spoken' }).toBe(false);
});

// Page scripts observe navigation through the event the UML tutorial editor
// also dispatches: one tvm:stepchange per committed step, naming its index.
test('changing steps announces the new step index to page scripts', async ({ page }) => {
  await page.goto(URL);
  await expectActiveStep(page, 0);
  await page.evaluate(() => {
    window.announcedSteps = [];
    document.addEventListener('tvm:stepchange', event => window.announcedSteps.push(event.detail.stepIndex));
  });

  await clickStep(page, 2);

  await expect.poll(() => page.evaluate(() => window.announcedSteps)).toEqual([2]);
});
