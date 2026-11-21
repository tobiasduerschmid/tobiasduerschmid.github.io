// @ts-check
const { test, expect } = require('@playwright/test');
const { loadTutorialConfig, expectActiveStep, openInstructionsPopout } = require('./tutorial-helpers');
const { a11yCheckpoint } = require('./a11y-helpers');

const tutorial = loadTutorialConfig('pluscal');

// While instructions are detached, the main window hides its step view, so
// learners open knowledge checks and change steps from the popout.
async function openKnowledgeCheckInPopout(page) {
  await page.goto('/SEBook/verification/pluscal-tutorial');
  await expectActiveStep(page, 0);
  const popout = await openInstructionsPopout(page);
  await expect(popout.getByRole('heading', { name: tutorial.steps[0].title, exact: true })).toBeVisible();
  await popout.getByRole('button', { name: 'Next →', exact: true }).click();
  const knowledgeCheck = popout.getByRole('heading', { name: tutorial.steps[0].quiz.title, exact: true });
  await expect(knowledgeCheck).toBeVisible();
  return { popout, knowledgeCheck };
}

test('choosing another step in the instructions popout closes its open knowledge check', async ({ page }) => {
  const { popout, knowledgeCheck } = await openKnowledgeCheckInPopout(page);

  await popout.getByRole('button', { name: `Step 2: ${tutorial.steps[1].title}`, exact: true }).click();

  await expect(popout.getByRole('heading', { name: tutorial.steps[1].title, exact: true })).toBeVisible();
  await expect(knowledgeCheck).toBeHidden();
  await a11yCheckpoint(popout, 'instructions popout after leaving a knowledge check');
});

test('going back to the step from the instructions popout also leaves the knowledge check in the main window', async ({ page }) => {
  const { popout, knowledgeCheck } = await openKnowledgeCheckInPopout(page);

  await popout.getByRole('button', { name: '← Back to Step', exact: true }).click();
  await expect(popout.getByRole('heading', { name: tutorial.steps[0].title, exact: true })).toBeVisible();
  await expect(knowledgeCheck).toBeHidden();
  // Closing the popout returns the instructions to the main window.
  await popout.close();

  await expect(page.getByRole('heading', { name: tutorial.steps[0].title, exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: tutorial.steps[0].quiz.title, exact: true })).toBeHidden();
});
