const { test, expect } = require('@playwright/test');
const path = require('path');
const { loadTutorialConfig, expectActiveStep } = require('./tutorial-helpers');
const { a11yCheckpoint } = require('./a11y-helpers');

const URL = '/SEBook/tools/cs131-refresher-tutorial';
const config = loadTutorialConfig('cs131-refresher');

async function readProgress(page) {
  // This is the documented tutorial export format, not private runtime state.
  return page.evaluate(() => JSON.parse(localStorage.getItem('tutorial-progress-cs131-refresher')));
}

async function openInstructions(page) {
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Open instructions in separate window' }).click({ timeout: 120_000 });
  return popupPromise;
}

test('refresher students can skip checks and continue after errors without recording passes', async ({ page }) => {
  test.setTimeout(360_000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(URL + '?autosave=true', { waitUntil: 'domcontentloaded' });
  const next = page.getByRole('button', { name: /^Next →$/ });
  await expect(next).toBeEnabled({ timeout: 120_000 });
  await next.click({ timeout: 120_000 });
  const skip = page.getByRole('button', { name: 'Skip Knowledge Check' });
  await expect(skip).toBeVisible();
  await a11yCheckpoint(page, 'refresher optional knowledge check', { feature: 'cs131-refresher' });
  await skip.focus();
  await page.keyboard.press('Enter');
  await expectActiveStep(page, 1);

  await page.getByRole('button', { name: /Test My Work/ }).click({ timeout: 120_000 });
  await expect(page.getByText(/\d+\s*\/\s*\d+ tests passed/)).toBeVisible({ timeout: 120_000 });
  await expect(next).toBeEnabled();
  await next.click();

  // The Point quiz has single-answer questions. Choose a known wrong answer
  // by content, independently of the engine's shuffled display order.
  const questions = config.steps[1].quiz.questions;
  for (let i = 0; i < questions.length; i++) {
    const visibleOptions = page.getByRole('radio');
    const texts = await visibleOptions.allTextContents();
    const question = questions.find((q) => texts.some((text) => text.includes(q.options[0].replace(/`/g, ''))));
    expect(question, 'the visible quiz question should come from the authored Point quiz').toBeTruthy();
    const wrong = question.options.find((_, index) => index !== question.correct_index).replace(/`/g, '');
    await visibleOptions.filter({ hasText: wrong }).click();
    await page.getByRole('button', { name: i + 1 < questions.length ? 'Next Question' : 'See Results', exact: true }).click();
  }
  await expect(page.getByText(/You scored 0\/3/)).toBeVisible();
  const continueButton = page.getByRole('button', { name: /Continue to Step 3/ });
  await expect(continueButton).toBeFocused();
  await a11yCheckpoint(page, 'refresher low score continuation', { feature: 'cs131-refresher' });
  await page.keyboard.press('Enter');
  await expectActiveStep(page, 2);
  await expect.poll(async () => (await readProgress(page)).step).toBe(2);
  const progress = await readProgress(page);
  expect(progress.stepsPassed).toEqual([]);
  expect(progress.quizPassed).toEqual([]);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expectActiveStep(page, 2, { timeout: 120_000 });
  const popup = await openInstructions(page);
  const popupNext = popup.getByRole('button', { name: /^Next →$/ });
  await expect(popupNext).toBeEnabled({ timeout: 30_000 });
  await popupNext.click();
  const popupSkip = popup.getByRole('button', { name: 'Skip Knowledge Check' });
  await expect(popupSkip).toBeVisible();
  await a11yCheckpoint(popup, 'refresher optional popup knowledge check', { feature: 'cs131-refresher' });
  await popupSkip.click();
  await expect(popup.getByRole('heading', { name: config.steps[3].title, exact: true })).toBeVisible();
  await popup.close();
  await expectActiveStep(page, 3);

  for (let index = 3; index < config.steps.length - 1; index++) {
    await expectActiveStep(page, index);
    await expect(next).toBeEnabled({ timeout: 120_000 });
    await next.click({ timeout: 120_000 });
    await skip.click();
  }
  await expectActiveStep(page, config.steps.length - 1);
  const finalPopup = await openInstructions(page);
  await finalPopup.getByRole('button', { name: /^Next →$/ }).click();
  await finalPopup.getByRole('button', { name: 'Skip Knowledge Check' }).click();
  await expect(finalPopup.getByRole('heading', { name: 'Review Finished', exact: true })).toBeVisible();
  await finalPopup.close();
  await expect(page.getByRole('heading', { name: 'Review Finished', exact: true })).toBeVisible();
  await expect(page.getByText('Tutorial complete — great job!', { exact: true })).toBeHidden();
  const finalProgress = await readProgress(page);
  expect(finalProgress.stepsPassed).toEqual([]);
  expect(finalProgress.quizPassed).toEqual([]);
  expect(finalProgress.stepsUnlocked).not.toContain(config.steps.length);
  expect(errors).toEqual([]);
});

for (const allowSkip of [false, true]) {
  test(`knowledge check ${allowSkip ? 'allows optional' : 'preserves required'} low-score progression`, async ({ page }) => {
    await page.setContent('<main><h1>Knowledge check</h1><div id="quiz"></div><div id="controls"></div><output aria-label="Progression result">Waiting</output></main>');
    await page.addStyleTag({ content: '.hidden,.is-hidden{display:none}.quiz-question-card:not(.active){display:none}' });
    await page.addScriptTag({ path: path.join(__dirname, '..', 'js/tutorial-quiz.js') });
    await page.evaluate((optional) => {
      window.SebookQuiz.mount({
        hostEl: document.getElementById('quiz'), controlsEl: document.getElementById('controls'),
        stepIndex: 0,
        quiz: { questions: [{ question: 'Which value is even?', options: ['2', '3'], correct_index: 0 }] },
        ...(optional ? { allowSkip: true } : {}),
        onPass: () => { document.querySelector('output').textContent = 'Passed'; },
        onSkip: () => { document.querySelector('output').textContent = 'Continued without passing'; },
      });
    }, allowSkip);
    const skipCheck = page.getByRole('button', { name: 'Skip Knowledge Check' });
    if (allowSkip) await expect(skipCheck).toBeVisible();
    await page.getByRole('radio', { name: /3$/ }).click();
    await page.getByRole('button', { name: 'See Results' }).click();
    await expect(skipCheck).toBeHidden();
    const proceed = page.getByRole('button', { name: /Continue to Step 2/ });
    if (allowSkip) {
      await expect(proceed).toBeFocused();
      await proceed.press('Enter');
      await expect(page.getByLabel('Progression result')).toHaveText('Continued without passing');
    } else {
      await expect(proceed).toBeHidden();
      await expect(page.getByRole('button', { name: 'Skip Knowledge Check' })).toBeHidden();
      await expect(page.getByRole('button', { name: 'Try Again' })).toBeFocused();
      await expect(page.getByLabel('Progression result')).toHaveText('Waiting');
    }
    await page.getByRole('button', { name: 'Try Again' }).click();
    if (allowSkip) await expect(skipCheck).toBeVisible();
    await page.getByRole('radio', { name: /2$/ }).click();
    await page.getByRole('button', { name: 'See Results' }).click();
    await expect(skipCheck).toBeHidden();
    await proceed.click();
    await expect(page.getByLabel('Progression result')).toHaveText('Passed');
  });
}

test('an optional final quiz offers Finish Review after a low score', async ({ page }) => {
  await page.setContent('<main><h1>Review</h1><div id="quiz"></div><div id="controls"><button class="tvm-quiz-back">Back to Step</button><span class="tvm-quiz-status" role="status"></span></div><output aria-label="Pass result">Not passed</output></main>');
  await page.addStyleTag({ content: '.hidden,.is-hidden{display:none}.quiz-question-card:not(.active){display:none}' });
  await page.addScriptTag({ path: path.join(__dirname, '..', 'js/tutorial-quiz.js') });
  await page.evaluate(() => {
    const hostEl = document.getElementById('quiz');
    const controlsEl = document.getElementById('controls');
    window.SebookQuiz.mount({
      hostEl, controlsEl, stepIndex: 0, isFinalQuiz: true, allowSkip: true,
      quiz: { questions: [{ question: 'Which value is even?', options: ['2', '3'], correct_index: 0 }] },
      onPass: () => { document.querySelector('output').textContent = 'Passed'; },
      onSkip: () => { window.SebookQuiz.showReviewFinished(hostEl, controlsEl); },
    });
  });
  await page.getByRole('radio', { name: /3$/ }).click();
  await page.getByRole('button', { name: 'See Results' }).click();
  await expect(page.getByRole('button', { name: 'Skip Knowledge Check' })).toBeHidden();
  const finish = page.getByRole('button', { name: 'Finish Review' });
  await expect(finish).toBeFocused();
  await finish.press('Enter');
  await expect(page.getByRole('heading', { name: 'Review Finished' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back to Step' })).toBeFocused();
  await expect(page.getByLabel('Pass result')).toHaveText('Not passed');
});

test('the refresher print view identifies knowledge checks as optional practice', async ({ page }) => {
  await page.goto(URL + '/print', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Practice target: 80% (optional)', { exact: true })).toHaveCount(config.steps.length);
  await expect(page.getByText('Min. score: 80%', { exact: true })).toHaveCount(0);
});
