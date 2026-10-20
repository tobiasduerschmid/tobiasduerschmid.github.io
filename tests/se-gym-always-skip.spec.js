// @ts-check
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint, interactiveA11yEnabled } = require('./a11y-helpers');

const GYM_URL = '/se-gym/';
const QUIZ_URL = `${GYM_URL}?quiz=user_stories`;
const FLASHCARDS_URL = `${GYM_URL}?flashcards=user_stories`;
const SKIPPED_KEY = 'se-gym-skipped-questions';
const PAYMENT_QUESTION = /As a customer, I want to pay for the items in my cart/;
const PROFILE_QUESTION = /As a developer, I want the profile page implemented/;
const DATABASE_QUESTION = /As a developer, I want to add a hidden ID column/;
const FIRST_FLASHCARD = 'What is the primary purpose of Acceptance Criteria in a user story?';
const SECOND_FLASHCARD = 'What is the standard template for writing a User Story?';

test.use({ reducedMotion: 'reduce' });
// Auditing the Gym's full DOM in both themes takes longer than a behavior run.
if (interactiveA11yEnabled('se-gym')) test.setTimeout(120_000);

test.beforeEach(async ({ page, context, baseURL }) => {
  // Control the random source, rather than replacing the site's deck or
  // ordering code. Equal recency ties keep the real deck's authored order.
  await page.addInitScript(() => { Math.random = () => 0; });
  await context.addCookies([
    { name: 'se-gym-active', value: 'true', url: baseURL },
    { name: 'analyze-performance', value: 'true', url: baseURL },
    { name: 'se-gym-show-workout-hero', value: 'false', url: baseURL },
  ]);
});

async function seedSkippedQuestions(page, exclusions) {
  // Browser storage is the persistence boundary. Navigate first so this setup
  // runs once, and does not overwrite changes after reload or restoration.
  await page.goto(GYM_URL);
  await page.evaluate(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
  }, { key: SKIPPED_KEY, value: exclusions });
}

test('Always skip advances a quiz without an answer and survives a fresh visit', async ({ page }) => {
  await page.goto(QUIZ_URL);
  await expect(page.getByText(PAYMENT_QUESTION)).toBeVisible();
  const skip = page.getByRole('button', { name: 'Always skip', exact: true });
  await expect(skip).toBeEnabled();
  await a11yCheckpoint(page, 'quiz question with Always skip', { feature: 'se-gym' });

  await skip.focus();
  await page.keyboard.press('Enter');

  await expect(page.getByText(PROFILE_QUESTION)).toBeVisible();
  await expect(page.getByText(PAYMENT_QUESTION)).toBeHidden();
  await expect(page.getByRole('button', { name: 'Submit Answer', exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.getByText(PROFILE_QUESTION)).toBeVisible();
  await expect(page.getByText(PAYMENT_QUESTION)).toBeHidden();

  await page.goto('/se-gym-stats/');
  await expect(page.getByRole('status').filter({ hasText: 'No data yet' })).toBeVisible();
});

test('skipping a flashcard before revealing its answer persists independently of the quiz', async ({ page }) => {
  await page.goto(FLASHCARDS_URL);
  await expect(page.getByText(FIRST_FLASHCARD, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show Answer', exact: true })).toBeVisible();
  await a11yCheckpoint(page, 'flashcard question with Always skip', { feature: 'se-gym' });

  await page.getByRole('button', { name: 'Always skip', exact: true }).click();

  await expect(page.getByText(SECOND_FLASHCARD, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(SECOND_FLASHCARD, { exact: true })).toBeVisible();
  await expect(page.getByText(FIRST_FLASHCARD, { exact: true })).toBeHidden();
  // Both real decks have an ID 1. A flashcard exclusion must not remove the
  // distinct quiz question from the deck with the same name.
  await page.goto(QUIZ_URL);
  await expect(page.getByText(PAYMENT_QUESTION)).toBeVisible();
});

test('skipping a question in one quiz preserves the same ID in another quiz', async ({ page }) => {
  await page.goto(QUIZ_URL);
  await expect(page.getByText(PAYMENT_QUESTION)).toBeVisible();
  await page.getByRole('button', { name: 'Always skip', exact: true }).click();

  // Singleton's first authored question also has ID 1.
  await page.goto(`${GYM_URL}?quiz=design_pattern_singleton`);
  await expect(page.getByText(/A team needs one shared service, but implements it with calls to/)).toBeVisible();
});

test('new workouts fill the requested card count after excluding skipped questions', async ({ page, context, baseURL }) => {
  await context.addCookies([{
    name: 'se-gym',
    value: encodeURIComponent(JSON.stringify([{ type: 'quiz', id: 'user_stories' }])),
    url: baseURL,
  }]);
  await seedSkippedQuestions(page, { 'quiz:user_stories': ['1'] });
  await page.reload();
  await page.getByRole('spinbutton', { name: 'Max cards:' }).fill('2');

  await page.getByRole('button', { name: 'Start Workout', exact: true }).click();

  await expect(page.getByText(PROFILE_QUESTION)).toBeVisible();
  await page.getByRole('checkbox', { name: /Independent$/ }).click();
  await page.getByRole('button', { name: 'Submit Answer', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText(DATABASE_QUESTION)).toBeVisible();
  await expect(page.getByText(PAYMENT_QUESTION)).toBeHidden();
  await page.getByRole('button', { name: 'Back to Gym Entrance', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved workout:' }))
    .toHaveText('Saved workout: 1 of 2 completed.');
});

test('resuming a paused aggregate workout keeps skips scoped to that aggregate deck', async ({ page, context, baseURL }) => {
  // Four complete Gym page loads can exceed 30 seconds under build/browser
  // contention. Keep the normal per-action and assertion bounds unchanged.
  test.setTimeout(60_000);
  // CS130_current begins with the real user_stories deck. Its cards share
  // source IDs with that deck, but exclusions belong to the selected deck.
  await context.addCookies([{
    name: 'se-gym',
    value: encodeURIComponent(JSON.stringify([{ type: 'quiz', id: 'CS130_current' }])),
    url: baseURL,
  }]);
  await page.goto(GYM_URL);
  await page.getByRole('spinbutton', { name: 'Max cards:' }).fill('2');
  await page.getByRole('button', { name: 'Start Workout', exact: true }).click();
  await expect(page.getByText(PAYMENT_QUESTION)).toBeVisible();
  await page.getByRole('button', { name: 'Always skip', exact: true }).click();
  await expect(page.getByText(PROFILE_QUESTION)).toBeVisible();
  await page.getByRole('button', { name: 'Back to Gym Entrance', exact: true }).click();
  await page.reload();

  await page.getByRole('button', { name: 'Resume Saved Workout', exact: true }).click();

  await expect(page.getByText(PROFILE_QUESTION)).toBeVisible();
  await expect(page.getByText(PAYMENT_QUESTION)).toBeHidden();
  await page.getByRole('button', { name: 'Always skip', exact: true }).click();
  await page.goto(QUIZ_URL);
  await expect(page.getByText(PAYMENT_QUESTION)).toBeVisible();
  await page.getByRole('checkbox', { name: /Independent$/ }).click();
  await page.getByRole('button', { name: 'Submit Answer', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText(PROFILE_QUESTION)).toBeVisible();
  await page.goto(`${GYM_URL}?quiz=CS130_current`);
  await expect(page.getByText(DATABASE_QUESTION)).toBeVisible();
});

test('an entirely skipped deck can be restored from Settings', async ({ page }) => {
  // The real INVEST quiz has five authored questions, IDs 1 through 5.
  await seedSkippedQuestions(page, { 'quiz:user_stories': ['1', '2', '3', '4', '5'] });
  await page.evaluate(() => { localStorage.setItem('sebook-code-language', 'java'); });
  await page.goto(QUIZ_URL);

  await expect(page.getByRole('button', { name: 'Always skip', exact: true })).toBeHidden();
  await expect(page.getByText(PAYMENT_QUESTION)).toBeHidden();
  await a11yCheckpoint(page, 'all questions skipped in a deck', { feature: 'se-gym' });

  await page.goto('/settings/');
  await page.getByRole('button', { name: 'Restore all skipped questions', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: /All skipped questions are available/ })).toBeVisible();
  // Resetting exclusions must leave an unrelated saved preference intact.
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'SE Book code language', exact: true })).toHaveValue('java');
  await page.goto(QUIZ_URL);
  await expect(page.getByText(PAYMENT_QUESTION)).toBeVisible();
});

test('skipping the last eligible question ends the workout without an incorrect result', async ({ page }) => {
  await seedSkippedQuestions(page, { 'quiz:user_stories': ['2', '3', '4', '5'] });
  await page.goto(QUIZ_URL);
  await expect(page.getByText(PAYMENT_QUESTION)).toBeVisible();

  await page.getByRole('button', { name: 'Always skip', exact: true }).click();

  await expect(page.getByText(/No questions remain in this workout/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Always skip', exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Review Incorrect', exact: true })).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Performance breakdown', exact: true })).toBeHidden();
  await expect(page.getByText(/^Score:\s*0\s*\/\s*0$/)).toBeHidden();
  await a11yCheckpoint(page, 'last eligible question skipped', { feature: 'se-gym' });
  await page.reload();
  await expect(page.getByText(PAYMENT_QUESTION)).toBeHidden();
});

test('reviewing skipped questions can restore one without restoring the others', async ({ page }) => {
  await page.goto(FLASHCARDS_URL);
  await expect(page.getByText(FIRST_FLASHCARD, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Always skip', exact: true }).click();
  await expect(page.getByText(SECOND_FLASHCARD, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Always skip', exact: true }).click();
  await page.goto('/se-gym-stats/');
  const skippedQuestions = page.getByRole('region', { name: /^Skipped questions/ });
  const firstSkipped = skippedQuestions.getByRole('listitem').filter({ hasText: FIRST_FLASHCARD });
  const secondSkipped = skippedQuestions.getByRole('listitem').filter({ hasText: SECOND_FLASHCARD });
  await expect(firstSkipped).toBeVisible();
  await expect(secondSkipped).toBeVisible();
  await a11yCheckpoint(page, 'review skipped questions', { feature: 'se-gym' });

  await firstSkipped.getByRole('button', { name: /Show again/ }).click();

  await expect(firstSkipped.getByRole('button', { name: /Restored/ })).toHaveAttribute('aria-disabled', 'true');
  await expect(secondSkipped).toBeVisible();
  await page.goto(FLASHCARDS_URL);
  await expect(page.getByText(FIRST_FLASHCARD, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Show Answer', exact: true }).click();
  await page.getByRole('button', { name: 'I got it right', exact: true }).click();
  await expect(page.getByText('What does the acronym INVEST stand for?', { exact: true })).toBeVisible();
  await expect(page.getByText(SECOND_FLASHCARD, { exact: true })).toBeHidden();
});
