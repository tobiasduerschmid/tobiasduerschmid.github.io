const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const userStories = yaml.load(fs.readFileSync(path.join(__dirname, '../_data/quizzes/user_stories.yml'), 'utf8'));
const normalizeQuestion = text => text.replace(/^\s*-\s+/gm, '').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();

async function expectAnswerOptions(page) {
  await expect(page.getByRole('group', { name: 'Answer options', exact: true })
    .or(page.getByRole('radiogroup', { name: 'Answer options', exact: true }))).toBeVisible();
}

async function submitIncorrectAnswer(page) {
  const visibleQuestion = normalizeQuestion(await page.locator('.workout-quiz-card .question-text').innerText());
  const question = userStories.questions.find(item => normalizeQuestion(item.question) === visibleQuestion);
  expect(question, 'the visible question must belong to the authored deck').toBeTruthy();
  const correct = question.type === 'multiple' ? question.correct_indices : [question.correct_index];
  const accepted = correct.concat(question.optional_indices || []);
  const wrongIndex = question.options.findIndex((_, index) => !accepted.includes(index));
  expect(wrongIndex, 'the authored question must provide a distractor for review').toBeGreaterThanOrEqual(0);
  const optionName = new RegExp(question.options[wrongIndex].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$');
  await page.getByRole(question.type === 'multiple' ? 'checkbox' : 'radio', { name: optionName }).click();
  if (question.type === 'multiple') await page.getByRole('button', { name: 'Submit Answer', exact: true }).click();
  await expect(page.getByText('Explanation', { exact: true })).toBeVisible();
}

test.use({ reducedMotion: 'reduce' });
const isFullscreen = page => page.evaluate(() => document.fullscreenElement === document.documentElement);
async function setup(page, context, baseURL) {
  await context.addCookies([
    { name: 'se-gym-active', value: 'true', url: baseURL },
    { name: 'se-gym', value: encodeURIComponent(JSON.stringify([{ type: 'quiz', id: 'user_stories' }])), url: baseURL },
  ]);
  await page.goto('/se-gym/');
}

for (const start of ['Start Workout', 'Start Workout from controls', 'Start targeted practice for INVEST Criteria Violations Quiz']) {
  test(`saved opt-in enters browser fullscreen through ${start}`, async ({ page, context, baseURL }) => {
    await setup(page, context, baseURL);
    const preference = page.getByRole('checkbox', { name: 'Workout in full screen', exact: true });
    await expect(preference).not.toBeChecked();
    await preference.press('Space');
    await page.reload();
    await expect(preference).toBeChecked();
    await page.getByRole('button', { name: start, exact: true }).click();
    await expect.poll(() => isFullscreen(page)).toBe(true);
    const exit = page.getByRole('button', { name: 'Exit full screen', exact: true }).filter({ visible: true });
    await expect(exit).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeHidden();
    await a11yCheckpoint(page, 'workout fullscreen controls', { include: '.workout-header-row' });
    await page.getByRole('button', { name: 'Back to Gym Entrance', exact: true }).click();
    await expect.poll(() => isFullscreen(page)).toBe(false);
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
    await page.getByRole('button', { name: 'Resume Saved Workout', exact: true }).click();
    await expect.poll(() => isFullscreen(page)).toBe(true);
  });
}

test('workouts stay windowed by default and the saved preference can be changed centrally', async ({ page, context, baseURL }) => {
  await setup(page, context, baseURL);
  await page.getByRole('button', { name: 'Start Workout', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Back to Gym Entrance', exact: true })).toBeVisible();
  await expect.poll(() => isFullscreen(page)).toBe(false);
  await page.goto('/settings/');
  const preference = page.getByRole('checkbox', { name: 'Workout in full screen', exact: true });
  await expect(preference).not.toBeChecked();
  await preference.press('Space');
  await page.goto('/se-gym/');
  await expect(page.getByRole('checkbox', { name: 'Workout in full screen', exact: true })).toBeChecked();
  await page.getByRole('checkbox', { name: 'Workout in full screen', exact: true }).press('Space');
  await page.reload();
  await page.getByRole('button', { name: 'Start Workout', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Back to Gym Entrance', exact: true })).toBeVisible();
  await expect.poll(() => isFullscreen(page)).toBe(false);
  await page.goto('/cookies/');
  await expect(page.locator('tr[data-key="se-gym-workout-fullscreen"]')).toContainText('Off when unset');
});

test('a blocked fullscreen request does not prevent starting the workout', async ({ page, context, baseURL }) => {
  await page.addInitScript(() => { Element.prototype.requestFullscreen = () => Promise.reject(new DOMException('Denied', 'NotAllowedError')); });
  await setup(page, context, baseURL);
  await page.getByRole('checkbox', { name: 'Workout in full screen', exact: true }).press('Space');
  await page.getByRole('button', { name: 'Start Workout', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'could not enter fullscreen' })).toBeVisible();
  await expectAnswerOptions(page);
});

for (const action of ['Restart Workout', 'Review Incorrect']) {
  test(`${action} honors fullscreen preference and results retain an exit`, async ({ page, context, baseURL }) => {
    await setup(page, context, baseURL);
    await page.getByRole('checkbox', { name: 'Workout in full screen', exact: true }).press('Space');
    await page.getByRole('spinbutton', { name: 'Max cards:' }).fill('1');
    await page.getByRole('button', { name: 'Start targeted practice for INVEST Criteria Violations Quiz', exact: true }).click();
    await expect.poll(() => isFullscreen(page)).toBe(true);
    await submitIncorrectAnswer(page);
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Workout Complete!', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Exit full screen', exact: true }).filter({ visible: true }).click();
    await expect.poll(() => isFullscreen(page)).toBe(false);
    await page.getByRole('button', { name: action, exact: true }).click();
    await expect.poll(() => isFullscreen(page)).toBe(true);
    await expectAnswerOptions(page);
  });
}

test('returning to the entrance cancels a fullscreen entry still in progress', async ({ page, context, baseURL }) => {
  // Delay only the browser API completion; the real browser still enters fullscreen.
  await page.addInitScript(() => {
    const request = Element.prototype.requestFullscreen;
    Element.prototype.requestFullscreen = function () {
      return request.call(this).then(() => new Promise(resolve => { window.finishFullscreenEntry = resolve; }));
    };
  });
  await setup(page, context, baseURL);
  await page.getByRole('checkbox', { name: 'Workout in full screen', exact: true }).press('Space');
  await page.getByRole('button', { name: 'Start Workout', exact: true }).click();
  await expect.poll(() => page.evaluate(() => typeof window.finishFullscreenEntry)).toBe('function');
  await page.getByRole('button', { name: 'Back to Gym Entrance', exact: true }).click();
  await page.evaluate(() => window.finishFullscreenEntry());
  await expect.poll(() => isFullscreen(page)).toBe(false);
  await expect(page.getByRole('button', { name: 'Start Workout', exact: true })).toBeVisible();
});
