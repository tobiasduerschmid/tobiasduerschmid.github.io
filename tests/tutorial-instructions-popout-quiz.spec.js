// @ts-check
const { test, expect } = require('@playwright/test');
const { loadTutorialConfig, expectActiveStep } = require('./tutorial-helpers');
const { a11yCheckpoint } = require('./a11y-helpers');

const tutorial = loadTutorialConfig('pluscal');

// While instructions are detached, the main window hides its step view, so
// learners open knowledge checks and change steps from the popout.
test('choosing another step in the instructions popout closes its open knowledge check', async ({ page }) => {
  await page.goto('/SEBook/verification/pluscal-tutorial');
  await expectActiveStep(page, 0);
  const popoutOpened = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Open instructions in separate window' }).click();
  const popout = await popoutOpened;
  await expect(popout.getByRole('heading', { name: tutorial.steps[0].title, exact: true })).toBeVisible();
  await popout.getByRole('button', { name: 'Next →', exact: true }).click();
  const knowledgeCheck = popout.getByRole('heading', { name: tutorial.steps[0].quiz.title, exact: true });
  await expect(knowledgeCheck).toBeVisible();

  await popout.getByRole('button', { name: `Step 2: ${tutorial.steps[1].title}`, exact: true }).click();

  await expect(popout.getByRole('heading', { name: tutorial.steps[1].title, exact: true })).toBeVisible();
  await expect(knowledgeCheck).toBeHidden();
  await a11yCheckpoint(popout, 'instructions popout after leaving a knowledge check');
});
