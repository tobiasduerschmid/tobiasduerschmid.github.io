// @ts-check
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const userStories = yaml.load(fs.readFileSync(path.join(__dirname, '../_data/quizzes/user_stories.yml'), 'utf8'));
const questionCount = userStories.questions.length;
const questionText = page => page.locator('.workout-quiz-card .question-text');
const normalizeQuestion = text => text.replace(/^\s*-\s+/gm, '').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
const optionName = text => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$');

async function currentQuestion(page) {
  const visibleText = normalizeQuestion(await questionText(page).innerText());
  const question = userStories.questions.find(item => normalizeQuestion(item.question) === visibleText);
  expect(question, 'the visible question must come from the selected authored deck').toBeTruthy();
  return question;
}

async function submitIncorrectAnswer(page) {
  const question = await currentQuestion(page);
  const required = question.type === 'multiple' ? question.correct_indices : [question.correct_index];
  const optional = question.optional_indices || [];
  const incorrectIndex = question.options.findIndex((_, index) => !required.includes(index) && !optional.includes(index));
  expect(incorrectIndex, 'choose a distractor so the completed workout retains reviewable answers').toBeGreaterThanOrEqual(0);
  await page.getByRole(question.type === 'multiple' ? 'checkbox' : 'radio', {
    name: optionName(question.options[incorrectIndex]),
  }).click();
  if (question.type === 'multiple') {
    await page.getByRole('button', { name: 'Submit Answer', exact: true }).click();
  }
  await expect(page.getByText('Explanation', { exact: true })).toBeVisible();
}

async function expectUnansweredQuestion(page) {
  const question = await currentQuestion(page);
  const options = page.getByRole(question.type === 'multiple' ? 'checkbox' : 'radio', { checked: true });
  await expect(options).toHaveCount(0);
  await expect(page.getByText('Explanation', { exact: true })).toBeHidden();
  const submit = page.getByRole('button', { name: 'Submit Answer', exact: true });
  if (question.type === 'multiple') await expect(submit).toBeDisabled();
  else await expect(submit).toHaveCount(0);
}

const GYM_URL = '/se-gym/';
const QUIZ_URL = `${GYM_URL}?quiz=user_stories`;
const SAVED_SUMMARY = 'Saved workout: 1 of 2 completed.';

test.use({ reducedMotion: 'reduce' });


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
  await submitIncorrectAnswer(page);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  const savedQuestion = await questionText(page).innerText();
  await page.getByRole('button', { name: 'Back to Gym Entrance', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved workout:' })).toHaveText(SAVED_SUMMARY);
  return savedQuestion;
}

async function expectOriginalWorkoutResumes(page, savedQuestion) {
  await expect(page.getByRole('status').filter({ hasText: 'Saved workout:' })).toHaveText(SAVED_SUMMARY);
  await page.getByRole('button', { name: 'Resume Saved Workout', exact: true }).click();
  await expect(questionText(page)).toHaveText(savedQuestion);
  await expectUnansweredQuestion(page);
}

async function completeLinkedQuiz(page) {
  // Complete every authored question through its visible controls.
  for (let question = 0; question < questionCount; question++) {
    await submitIncorrectAnswer(page);
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
  await submitIncorrectAnswer(page);
  await a11yCheckpoint(page, 'linked quiz feedback while another workout is paused', { feature: 'se-gym' });
  await page.getByRole('button', { name: 'Back to Gym Entrance', exact: true }).click();

  await expect(page).toHaveURL(/\/se-gym\/$/);
  await expectOriginalWorkoutResumes(page, savedQuestion);
  await submitIncorrectAnswer(page);
  await page.getByRole('button', { name: 'Back to Gym Entrance', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved workout:' })).toHaveText('Saved workout: 2 of 2 completed.');
});

test('starting a selected workout after leaving a linked quiz replaces the paused workout', async ({ page, context, baseURL }) => {
  await pauseUserStoriesWorkout(page, context, baseURL);
  await page.goto(QUIZ_URL);
  await submitIncorrectAnswer(page);
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
  await submitIncorrectAnswer(page);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.goto(GYM_URL);

  await expectOriginalWorkoutResumes(page, savedQuestion);
});

test('a quiz link saves resumable progress when no workout was paused', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'se-gym-active', value: 'true', url: baseURL }]);
  await page.goto(QUIZ_URL);
  await submitIncorrectAnswer(page);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  const nextQuestion = await questionText(page).innerText();

  await page.getByRole('button', { name: 'Back to Gym Entrance', exact: true }).click();
  await page.reload();

  await expect(page.getByRole('status').filter({ hasText: 'Saved workout:' })).toHaveText(`Saved workout: 1 of ${questionCount} completed.`);
  await page.getByRole('button', { name: 'Resume Saved Workout', exact: true }).click();
  await expect(questionText(page)).toHaveText(nextQuestion);
  await expectUnansweredQuestion(page);
});

for (const nextAction of ['return', 'restart', 'review']) {
  test(`completing a linked quiz then choosing ${nextAction} preserves the paused workout`, async ({ page, context, baseURL }) => {
    const savedQuestion = await pauseUserStoriesWorkout(page, context, baseURL);
    await page.goto(QUIZ_URL);
    await completeLinkedQuiz(page);

    if (nextAction === 'restart') {
      await page.getByRole('button', { name: 'Restart Workout', exact: true }).click();
      await submitIncorrectAnswer(page);
    } else if (nextAction === 'review') {
      await page.getByRole('button', { name: 'Review Incorrect', exact: true }).click();
      await submitIncorrectAnswer(page);
    }
    // Results provide the same entrance action in both the header and the footer.
    await page.getByRole('button', { name: 'Back to Gym Entrance', exact: true }).first().click();
    await page.reload();

    await expectOriginalWorkoutResumes(page, savedQuestion);
  });
}
