const { test, expect } = require('@playwright/test');
const { loadTutorialConfig, expectActiveStep, waitForTutorialReady } = require('./tutorial-helpers');
const { a11yCheckpoint } = require('./a11y-helpers');

const config = loadTutorialConfig('uml-class-diagram-python');
const url = '/SEBook/tools/uml-class-diagram-python.html?autosave=true&instructor-mode=true';
const storageKey = 'tutorial-progress-uml-class-diagram-python';

async function openQuiz(page) {
  await page.getByRole('button', { name: /^Next →$/ }).click();
  await expect(page.getByRole('radio').first()).toBeVisible();
}

async function openPopout(page) {
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Open instructions in separate window' }).click();
  return popupPromise;
}

test('a passed knowledge check can be repeated after revisiting and reloading the step', async ({ page }) => {
  test.setTimeout(120_000);
  // Preserve authored order so the fixture's answer keys select the correct options.
  await page.addInitScript(() => { Math.random = () => 0.999999; });
  await page.goto(url);
  await waitForTutorialReady(page);
  await openQuiz(page);
  const questions = config.steps[0].quiz.questions;
  for (let index = 0; index < questions.length; index++) {
    await page.getByRole('radio').nth(questions[index].correct_index).click();
    await page.getByRole('button', { name: index + 1 < questions.length ? 'Next Question' : 'See Results', exact: true }).click();
  }
  await page.getByRole('button', { name: /Continue to Step 2/ }).click();
  await expectActiveStep(page, 1);
  await page.getByRole('button', { name: /Previous/ }).click();
  await expectActiveStep(page, 0);
  await openQuiz(page);
  await a11yCheckpoint(page, 'revisited knowledge check', { include: '.tvm-quiz-panel' });
  await page.getByRole('button', { name: /Back to Step/ }).click();
  await page.reload();
  await waitForTutorialReady(page);
  await expectActiveStep(page, 0);
  const popup = await openPopout(page);
  await openQuiz(popup);
  // Retaking a quiz must not erase completion or previously unlocked lessons.
  const progress = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
  expect(progress.quizPassed).toContain(0);
  expect(progress.stepsUnlocked).toContain(1);
  await popup.close();
});

for (const surface of ['main tutorial', 'instructions popout']) {
  test(`a saved final quiz remains available in the ${surface}`, async ({ page }) => {
    test.setTimeout(120_000);
    const last = config.steps.length - 1;
    // Seed the documented progress import format to exercise a completed tutorial.
    await page.goto('/');
    await page.evaluate(({ key, last }) => localStorage.setItem(key, JSON.stringify({
      step: last, stepsVisited: [last], stepsPassed: [last], quizPassed: [last],
      stepsUnlocked: Array.from({ length: last + 1 }, (_, index) => index), files: {},
    })), { key: storageKey, last });
    await page.goto(url);
    await waitForTutorialReady(page);
    await expectActiveStep(page, last);
    const quizPage = surface === 'instructions popout' ? await openPopout(page) : page;
    await openQuiz(quizPage);
    await expect(quizPage.getByRole('heading', { name: config.steps[last].quiz.title })).toBeVisible();
  });
}
