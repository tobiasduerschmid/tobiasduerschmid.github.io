// @ts-check
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');

test.use({ reducedMotion: 'reduce' });

async function expectOnlyQuizChrome(page) {
  await expect(page.getByRole('heading', { level: 1 })).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeHidden();
  await expect(page.getByRole('contentinfo')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Back to Gym Entrance' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Challenge a Friend', exact: true })).toHaveCount(0);
  // Decorative art has no accessible name; its visibility is the contract here.
  await expect(page.locator('svg[aria-hidden="true"]:visible')).toHaveCount(0);
}

async function submitIndependentAnswer(page) {
  await page.getByRole('checkbox', { name: /Independent$/ }).click();
  await page.getByRole('button', { name: 'Submit Answer' }).click();
  await expect(page.getByText('Explanation', { exact: true })).toBeVisible();
}

test('plain quiz link shows the selected quiz without site or gym chrome', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/se-gym/?plain=true&quiz=user-stories');

  await expect(page).toHaveTitle(/INVEST/);
  await expect(page.getByText(/Which INVEST criteria are violated/)).toBeVisible();
  await expect(page.getByRole('group', { name: 'Answer options' }).getByRole('checkbox')).toHaveCount(6);
  await expectOnlyQuizChrome(page);
  await a11yCheckpoint(page, 'plain quiz question', { feature: 'se-gym' });
  expect(errors, 'plain quiz must load without JavaScript errors').toEqual([]);
});

test('plain links also accept the existing underscore quiz identifier', async ({ page }) => {
  await page.goto('/se-gym/?plain=true&quiz=user_stories');
  await expect(page.getByText(/Which INVEST criteria are violated/)).toBeVisible();
  await expectOnlyQuizChrome(page);
});

for (const query of ['quiz=user_stories', 'plain=false&quiz=user-stories']) {
  test(`ordinary quiz links retain site and gym navigation: ${query}`, async ({ page }) => {
    await page.goto(`/se-gym/?${query}`);
    await expect(page.getByText(/Which INVEST criteria are violated/)).toBeVisible();
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
  await submitIndependentAnswer(page);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  const savedQuestion = await page.getByText(/Read the following user story/).innerText();
  await page.getByRole('button', { name: 'Back to Gym Entrance' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved workout:' })).toHaveText('Saved workout: 1 of 5 completed.');
  await page.getByRole('checkbox', { name: 'Intermediate', exact: true }).uncheck();
  const timedPractice = page.getByRole('checkbox', { name: 'Timed Practice', exact: true });
  await timedPractice.focus();
  await timedPractice.press('Space');
  await expect(timedPractice).toBeChecked();

  await page.goto('/se-gym/?plain=true&quiz=user-stories');
  await expect(page.getByRole('timer')).toHaveCount(0);
  // This real quiz has five questions; choosing Independent answers exactly one correctly.
  await submitIndependentAnswer(page);
  await a11yCheckpoint(page, 'plain quiz feedback', { feature: 'se-gym' });
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  for (let question = 1; question < 5; question++) {
    await submitIndependentAnswer(page);
    await page.getByRole('button', { name: 'Next', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'Workout Complete!' })).toBeVisible();
  await expect(page.getByText('Score: 1/5', { exact: true })).toBeVisible();
  await expectOnlyQuizChrome(page);
  await a11yCheckpoint(page, 'plain quiz results', { feature: 'se-gym' });
  await page.getByRole('button', { name: 'Restart Workout', exact: true }).click();
  await expect(page.getByText(/Which INVEST criteria are violated/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit Answer' })).toBeDisabled();
  await expectOnlyQuizChrome(page);

  await page.goto('/se-gym/');
  await expect(page.getByRole('status').filter({ hasText: 'Saved workout:' })).toHaveText('Saved workout: 1 of 5 completed.');
  await page.getByRole('button', { name: 'Resume Saved Workout' }).click();
  await expect(page.getByText(savedQuestion, { exact: true })).toBeVisible();
});
