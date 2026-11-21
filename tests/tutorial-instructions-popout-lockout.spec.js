// @ts-check
const { test, expect } = require('@playwright/test');
const {
  loadTutorialConfig, waitForTutorialReady, clickStep, openInstructionsPopout,
} = require('./tutorial-helpers');
const { a11yCheckpoint } = require('./a11y-helpers');

const tutorial = loadTutorialConfig('code-comprehension');
// The first timed reading sprint that ends with a knowledge check.
const TIMED_STEP = tutorial.steps.findIndex(step => step['max-time'] && step.quiz);
const step = tutorial.steps[TIMED_STEP];
const ATTEMPT_MS = step['max-time'] * 60_000;

// The tutorial's own clock decides when an attempt ends; the tests move it.
async function openTimedStep(page) {
  await page.clock.install();
  await page.goto('/SEBook/development_practices/code-comprehension-tutorial?instructor-mode=true');
  await waitForTutorialReady(page);
  await clickStep(page, TIMED_STEP);
}

// Like the main window, the break offers only a way back to earlier steps.
async function expectPracticeBreak(popout) {
  await expect(popout.getByRole('heading', { name: 'Practice break', exact: true })).toBeVisible();
  await expect(popout.getByRole('heading', { name: step.title, exact: true })).toBeVisible();
  await expect(popout.getByRole('button', { name: '← Previous', exact: true })).toBeVisible();
  await expect(popout.getByRole('button', { name: 'Next →', exact: true })).toHaveCount(0);
}

test('a detached instructions window shows the practice break when time runs out during a knowledge check', async ({ page }) => {
  test.setTimeout(120_000);
  await openTimedStep(page);
  const popout = await openInstructionsPopout(page);
  await expect(popout.getByRole('heading', { name: step.title, exact: true })).toBeVisible();
  await popout.getByRole('button', { name: 'Next →', exact: true }).click();
  const knowledgeCheck = popout.getByRole('heading', { name: step.quiz.title, exact: true });
  await expect(knowledgeCheck).toBeVisible();

  await page.clock.fastForward(ATTEMPT_MS + 1_000);

  await expectPracticeBreak(popout);
  await expect(knowledgeCheck).toBeHidden();
  await a11yCheckpoint(popout, 'instructions popout during a practice break');
});

test('an instructions window opened during a practice break shows the break', async ({ page }) => {
  test.setTimeout(120_000);
  await openTimedStep(page);
  await page.clock.fastForward(ATTEMPT_MS + 1_000);
  await expect(page.getByRole('heading', { name: 'Practice break', exact: true })).toBeVisible();

  const popout = await openInstructionsPopout(page);

  await expectPracticeBreak(popout);
});
