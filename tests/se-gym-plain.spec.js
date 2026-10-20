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

test.use({ reducedMotion: 'reduce' });

async function expectOnlyQuizChrome(page) {
  await expect(page.getByRole('button', { name: /^(Exit full screen|Full screen)$/ })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeHidden();
  await expect(page.getByRole('contentinfo')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Back to Gym Entrance' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Challenge a Friend', exact: true })).toHaveCount(0);
  // Decorative art has no accessible name; its visibility is the contract here.
  await expect(page.locator('svg[aria-hidden="true"]:visible')).toHaveCount(0);
}

async function expectAuthoredQuestion(page) {
  const question = await currentQuestion(page);
  const role = question.type === 'multiple' ? 'checkbox' : 'radio';
  const group = page.getByRole(question.type === 'multiple' ? 'group' : 'radiogroup', { name: 'Answer options', exact: true });
  await expect(group.getByRole(role)).toHaveCount(question.options.length);
  for (const option of question.options) {
    await expect(group.getByRole(role, { name: optionName(option) })).toBeVisible();
  }
}

test('plain quiz link shows the selected quiz without site or gym chrome', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/se-gym/?plain=true&quiz=user-stories');

  await expect(page).toHaveTitle(/INVEST/);
  await expectAuthoredQuestion(page);
  await expectOnlyQuizChrome(page);
  await a11yCheckpoint(page, 'plain quiz question', { feature: 'se-gym' });
  expect(errors, 'plain quiz must load without JavaScript errors').toEqual([]);
});

test('plain links also accept the existing underscore quiz identifier', async ({ page }) => {
  await page.goto('/se-gym/?plain=true&quiz=user_stories');
  await expectAuthoredQuestion(page);
  await expectOnlyQuizChrome(page);
});

for (const query of ['quiz=user_stories', 'plain=false&quiz=user-stories']) {
  test(`ordinary quiz links retain site and gym navigation: ${query}`, async ({ page }) => {
    await page.goto(`/se-gym/?${query}`);
    await expectAuthoredQuestion(page);
    await expect(page).toHaveTitle(/SE Gym/);
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to Gym Entrance' })).toBeVisible();
  });
}

for (const query of ['', '&quiz=missing-quiz']) {
  test(`plain link explains an unavailable quiz instead of showing a blank page: ${query || 'missing ID'}`, async ({ page }) => {
    await page.goto(`/se-gym/?plain=true${query}`);
    const message = page.getByRole('status').filter({ hasText: /quiz/i });
    await expect(message).toBeVisible();
    await expect(message).toContainText(/quiz=|not found/i);
    await expectOnlyQuizChrome(page);
    await a11yCheckpoint(page, 'plain quiz unavailable', { feature: 'se-gym' });
  });
}

test('plain quiz completion and restart preserve a saved workout and ignore gym restrictions', async ({ page }) => {
  test.setTimeout(60000);
  await page.goto('/se-gym/');
  const gymActivation = page.getByRole('checkbox', { name: 'Toggle personal gym activation' });
  await gymActivation.focus();
  await gymActivation.press('Space');
  await expect(gymActivation).toBeChecked();
  await page.getByRole('button', { name: 'Start targeted practice for INVEST Criteria Violations Quiz', exact: true }).click();
  await submitIncorrectAnswer(page);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  const savedQuestion = await questionText(page).innerText();
  await page.getByRole('button', { name: 'Back to Gym Entrance' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved workout:' })).toHaveText(`Saved workout: 1 of ${questionCount} completed.`);
  await page.getByRole('checkbox', { name: 'Intermediate', exact: true }).uncheck();
  const timedPractice = page.getByRole('checkbox', { name: 'Timed Practice', exact: true });
  await timedPractice.focus();
  await timedPractice.press('Space');
  await expect(timedPractice).toBeChecked();

  await page.goto('/se-gym/?plain=true&quiz=user-stories');
  await expect(page.getByRole('timer')).toHaveCount(0);
  // Plain view includes the full authored deck despite the saved difficulty filter.
  await submitIncorrectAnswer(page);
  await a11yCheckpoint(page, 'plain quiz feedback', { feature: 'se-gym' });
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  for (let question = 1; question < questionCount; question++) {
    await submitIncorrectAnswer(page);
    await page.getByRole('button', { name: 'Next', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'Workout Complete!' })).toBeVisible();
  await expect(page.getByText(`Score: 0/${questionCount}`, { exact: true })).toBeVisible();
  await expectOnlyQuizChrome(page);
  await a11yCheckpoint(page, 'plain quiz results', { feature: 'se-gym' });
  await page.getByRole('button', { name: 'Restart Workout', exact: true }).click();
  await expectAuthoredQuestion(page);
  await expectUnansweredQuestion(page);
  await expectOnlyQuizChrome(page);

  await page.goto('/se-gym/');
  await expect(page.getByRole('status').filter({ hasText: 'Saved workout:' })).toHaveText(`Saved workout: 1 of ${questionCount} completed.`);
  await page.getByRole('button', { name: 'Resume Saved Workout' }).click();
  await expect(questionText(page)).toHaveText(savedQuestion);
});
