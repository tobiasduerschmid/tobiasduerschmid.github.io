// @ts-check
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');

const GYM_URL = '/se-gym/';
const QUIZ_URL = `${GYM_URL}?quiz=user_stories`;
const SAVED_SUMMARY = 'Saved workout: 1 of 2 completed.';

test.use({ reducedMotion: 'reduce' });

async function submitIndependentAnswer(page) {
  await page.getByRole('checkbox', { name: /Independent$/ }).click();
  await page.getByRole('button', { name: 'Submit Answer', exact: true }).click();
  await expect(page.getByText('Explanation', { exact: true })).toBeVisible();
}

async function pauseUserStoriesWorkout(page, context, baseURL) {
  await context.addCookies([
    { name: 'se-gym-active', value: 'true', url: baseURL },
    {
      name: 'se-gym',
      value: encodeURIComponent(JSON.stringify([{ type: 'quiz', id: 'design_pattern_singleton' }])),
      url: baseURL,
    },
  ]);
  await page.goto(GYM_URL);
  await page.getByRole('spinbutton', { name: 'Max cards:' }).fill('2');
  await page.getByRole('button', { name: 'Start targeted practice for INVEST Criteria Violations Quiz', exact: true }).click();
  await submitIndependentAnswer(page);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  const savedQuestion = await page.getByText(/Read the following user story/).innerText();
  await page.getByRole('button', { name: 'Back to Gym Entrance', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved workout:' })).toHaveText(SAVED_SUMMARY);
  return savedQuestion;
}

async function expectOriginalWorkoutResumes(page, savedQuestion) {
  await expect(page.getByRole('status').filter({ hasText: 'Saved workout:' })).toHaveText(SAVED_SUMMARY);
  await page.getByRole('button', { name: 'Resume Saved Workout', exact: true }).click();
  await expect(page.getByText(savedQuestion, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit Answer', exact: true })).toBeDisabled();
}

async function completeLinkedQuiz(page) {
  // This real deck contains five multiple-answer questions with the same options.
  for (let question = 0; question < 5; question++) {
    await submitIndependentAnswer(page);
    await page.getByRole('button', { name: 'Next', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'Workout Complete!', exact: true })).toBeVisible();
}

for (const startButtonName of ['Start Workout', 'Start Workout from controls']) {
  test(`${startButtonName} replaces a paused workout with the selected workout`, async ({ page, context, baseURL }) => {
    await pauseUserStoriesWorkout(page, context, baseURL);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Resume Saved Workout', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Start Workout', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Start Workout from controls', exact: true })).toBeEnabled();
    await a11yCheckpoint(page, 'paused workout with resume and fresh start available', { feature: 'se-gym', darkMode: true });
    await page.getByRole('spinbutton', { name: 'Max cards:' }).fill('3');

    await page.getByRole('button', { name: startButtonName, exact: true }).click();

    await expect(page.getByRole('button', { name: 'Back to Gym Entrance', exact: true })).toBeVisible();
    await expect(page.getByText('Singleton Pattern Quiz', { exact: true }).filter({ visible: true })).toBeVisible();
    await page.getByRole('button', { name: 'Back to Gym Entrance', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Saved workout:' })).toHaveText('Saved workout: 0 of 3 completed.');
    await page.reload();
    await page.getByRole('button', { name: 'Resume Saved Workout', exact: true }).click();
    await expect(page.getByText('Singleton Pattern Quiz', { exact: true }).filter({ visible: true })).toBeVisible();
  });
}

test('quiz link starts immediately and returning to the entrance preserves the paused workout', async ({ page, context, baseURL }) => {
  const savedQuestion = await pauseUserStoriesWorkout(page, context, baseURL);

  await page.goto(QUIZ_URL);
  await submitIndependentAnswer(page);
  await a11yCheckpoint(page, 'linked quiz feedback while another workout is paused', { feature: 'se-gym' });
  await page.getByRole('button', { name: 'Back to Gym Entrance', exact: true }).click();

  await expect(page).toHaveURL(/\/se-gym\/$/);
  await expectOriginalWorkoutResumes(page, savedQuestion);
  await submitIndependentAnswer(page);
  await page.getByRole('button', { name: 'Back to Gym Entrance', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved workout:' })).toHaveText('Saved workout: 2 of 2 completed.');
});

test('starting a selected workout after leaving a linked quiz replaces the paused workout', async ({ page, context, baseURL }) => {
  await pauseUserStoriesWorkout(page, context, baseURL);
  await page.goto(QUIZ_URL);
  await submitIndependentAnswer(page);
  await page.getByRole('button', { name: 'Back to Gym Entrance', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Max cards:' }).fill('3');

  await page.getByRole('button', { name: 'Start Workout', exact: true }).click();

  await expect(page.getByText('Singleton Pattern Quiz', { exact: true }).filter({ visible: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to Gym Entrance', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved workout:' })).toHaveText('Saved workout: 0 of 3 completed.');
  await page.reload();
  await expect(page.getByRole('status').filter({ hasText: 'Saved workout:' })).toHaveText('Saved workout: 0 of 3 completed.');
});

test('leaving a linked quiz after answering preserves the paused workout across navigation', async ({ page, context, baseURL }) => {
  const savedQuestion = await pauseUserStoriesWorkout(page, context, baseURL);

  await page.goto(QUIZ_URL);
  await submitIndependentAnswer(page);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.goto(GYM_URL);

  await expectOriginalWorkoutResumes(page, savedQuestion);
});

test('a quiz link saves resumable progress when no workout was paused', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'se-gym-active', value: 'true', url: baseURL }]);
  await page.goto(QUIZ_URL);
  await submitIndependentAnswer(page);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  const nextQuestion = await page.getByText(/Read the following user story/).innerText();

  await page.getByRole('button', { name: 'Back to Gym Entrance', exact: true }).click();
  await page.reload();

  await expect(page.getByRole('status').filter({ hasText: 'Saved workout:' })).toHaveText('Saved workout: 1 of 5 completed.');
  await page.getByRole('button', { name: 'Resume Saved Workout', exact: true }).click();
  await expect(page.getByText(nextQuestion, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit Answer', exact: true })).toBeDisabled();
});

for (const nextAction of ['return', 'restart', 'review']) {
  test(`completing a linked quiz then choosing ${nextAction} preserves the paused workout`, async ({ page, context, baseURL }) => {
    const savedQuestion = await pauseUserStoriesWorkout(page, context, baseURL);
    await page.goto(QUIZ_URL);
    await completeLinkedQuiz(page);

    if (nextAction === 'restart') {
      await page.getByRole('button', { name: 'Restart Workout', exact: true }).click();
      await submitIndependentAnswer(page);
    } else if (nextAction === 'review') {
      await page.getByRole('button', { name: 'Review Incorrect', exact: true }).click();
      await submitIndependentAnswer(page);
    }
    // Results provide the same entrance action in both the header and the footer.
    await page.getByRole('button', { name: 'Back to Gym Entrance', exact: true }).first().click();
    await page.reload();

    await expectOriginalWorkoutResumes(page, savedQuestion);
  });
}
