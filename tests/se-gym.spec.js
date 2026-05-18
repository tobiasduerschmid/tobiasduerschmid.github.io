// @ts-check
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');

// Feature key used by `A11Y_INTERACTIVE_FEATURES` to scope a targeted sweep
// (e.g. `A11Y_INTERACTIVE_FEATURES=se-gym`). Without the env var or with
// `A11Y_INTERACTIVE_CHECKS` unset, every `a11yCheckpoint` below is a no-op.
const A11Y_FEATURE = 'se-gym';

const GYM_URL = '/se-gym/';
// A page with both a quiz and flashcard include
const GIT_PAGE_URL = '/SEBook/tools/git.html';

// The toggle inputs are visually hidden inside custom .switch labels.
// We need to click the visible slider span, not the hidden input.
const ACTIVATE_TOGGLE_SLIDER = '#activatePersonalGymToggle + .slider';
const ANALYZE_TOGGLE_SLIDER = '#analyzePerformanceToggle + .slider';
const TIMED_TOGGLE_SLIDER = '#timedPracticeToggle + .slider';
const SHOW_WORKOUT_HERO_SLIDER = '#showWorkoutHeroToggle + .slider';

function parseIndices(value) {
  if (!value) return [];
  return value.split(',').map(part => part.trim()).filter(Boolean).map(Number);
}

async function answerWorkoutMultipleChoice(card, includeOptional = false) {
  const firstOption = card.locator('.quiz-option').first();
  const required = parseIndices(await firstOption.getAttribute('data-correct-indices'));
  const optional = parseIndices(await firstOption.getAttribute('data-optional-indices'));
  const accepted = new Set(includeOptional ? required.concat(optional) : required);
  const options = card.locator('.quiz-option');
  const count = await options.count();

  for (let i = 0; i < count; i++) {
    const option = options.nth(i);
    const index = Number(await option.getAttribute('data-index'));
    if (accepted.has(index)) {
      await option.click();
    }
  }

  await card.locator('.submit-answer-btn').click();
}

/**
 * Helper: clear all se-gym cookies and localStorage before each test.
 */
async function clearState(page) {
  await page.context().clearCookies();
  await page.evaluate(() => {
    try { localStorage.removeItem('se-gym-stats'); } catch (e) { /* */ }
  });
}

/**
 * Helper: set a cookie via the page context.
 */
async function setCookie(context, name, value) {
  await context.addCookies([{
    name,
    value: encodeURIComponent(value),
    domain: '127.0.0.1',
    path: '/',
  }]);
}

async function expectNoHorizontalScroll(page, stateName) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
  }));
  expect(
    metrics.scrollWidth,
    `${stateName} should fit within the mobile viewport without horizontal page scrolling`,
  ).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

async function expectTapTarget(locator, label, minSize = 44) {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error(`${label} should have a measurable visible tap target`);
  }
  expect(box.width, `${label} should be at least ${minSize}px wide`).toBeGreaterThanOrEqual(minSize - 0.5);
  expect(box.height, `${label} should be at least ${minSize}px tall`).toBeGreaterThanOrEqual(minSize - 0.5);
}

// ==================== LIBRARY VIEW TESTS ====================

test.describe('SE Gym - Library View', () => {
  test.beforeEach(async ({ page }) => {
    await clearState(page);
  });

  test('page loads with library view visible', async ({ page }) => {
    await page.goto(GYM_URL);
    await expect(page.locator('#gym-entrance')).toBeVisible();
    await expect(page.locator('#gym-workout')).toBeHidden();
    await expect(page.locator('h1')).toContainText('SE Gym');
    await a11yCheckpoint(page, 'gym entrance — inactive (default)', { feature: A11Y_FEATURE, darkMode: true });
  });

  test('activate toggle is off by default and sections are dimmed', async ({ page }) => {
    await page.goto(GYM_URL);
    const toggle = page.locator('#activatePersonalGymToggle');
    await expect(toggle).not.toBeChecked();
    await expect(page.locator('#gym-controls-body')).toHaveClass(/pd-inactive/);
    await expect(page.locator('#gym-entrance-sections')).toHaveClass(/pd-inactive/);
  });

  test('activate toggle enables controls and sections', async ({ page }) => {
    await page.goto(GYM_URL);
    await page.locator(ACTIVATE_TOGGLE_SLIDER).click();
    await expect(page.locator('#gym-controls-body')).not.toHaveClass(/pd-inactive/);
    await expect(page.locator('#gym-entrance-sections')).not.toHaveClass(/pd-inactive/);
    await a11yCheckpoint(page, 'gym entrance — activated (controls visible)', { feature: A11Y_FEATURE, darkMode: true });
  });

  test('activate toggle persists across page reload', async ({ page }) => {
    await page.goto(GYM_URL);
    await page.locator(ACTIVATE_TOGGLE_SLIDER).click();
    await page.reload();
    await expect(page.locator('#activatePersonalGymToggle')).toBeChecked();
    await expect(page.locator('#gym-controls-body')).not.toHaveClass(/pd-inactive/);
  });

  test('deactivating toggle clears the gym', async ({ page, context }) => {
    // Activate and add a quiz to the gym
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'se-gym', JSON.stringify([{ type: 'quiz', id: 'git' }]));
    await page.goto(GYM_URL);

    // Verify the quiz is in the gym
    await expect(page.locator('#gym-selected .gym-item')).toHaveCount(1);

    // Deactivate
    await page.locator(ACTIVATE_TOGGLE_SLIDER).click();
    await expect(page.locator('.confirm-modal-box')).toBeVisible();
    await page.locator('#confirm-modal-yes').click();

    // Re-activate and check gym is empty
    await page.locator(ACTIVATE_TOGGLE_SLIDER).click();
    await expect(page.locator('#gym-selected .empty-gym-msg')).toBeVisible();
  });

  test('available quizzes and flashcards are listed', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await page.goto(GYM_URL);

    const quizItems = page.locator('#available-quizzes .gym-item');
    const flashcardItems = page.locator('#available-flashcards .gym-item');

    // Should have at least some quizzes and flashcards
    await expect(quizItems.first()).toBeVisible();
    await expect(flashcardItems.first()).toBeVisible();

    // Check that items have badges and titles
    await expect(quizItems.first().locator('.gym-item-badge')).toBeVisible();
    await expect(quizItems.first().locator('.gym-item-title')).toBeVisible();
  });

  test('clicking + button adds quiz to gym', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await page.goto(GYM_URL);

    // Find the git quiz add button
    const gitAddBtn = page.locator('#available-quizzes .gym-add-btn[data-id="git"]');
    await gitAddBtn.click();

    // The button should now show a check icon
    await expect(gitAddBtn).toHaveClass(/in-gym/);
    await expect(gitAddBtn.locator('i')).toHaveClass(/fa-check/);

    // Should appear in "Your Gym" section
    await expect(page.locator('#gym-selected .gym-item')).toHaveCount(1);
    await expect(page.locator('#gym-selected .gym-item-title')).toContainText('Version Control and Git');
  });

  test('clicking + button again removes quiz from gym', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await page.goto(GYM_URL);

    const gitAddBtn = page.locator('#available-quizzes .gym-add-btn[data-id="git"]');

    // Add then remove
    await gitAddBtn.click();
    await expect(gitAddBtn).toHaveClass(/in-gym/);
    await gitAddBtn.click();
    await expect(gitAddBtn).not.toHaveClass(/in-gym/);

    // Your Gym should be empty again
    await expect(page.locator('#gym-selected .empty-gym-msg')).toBeVisible();
  });

  test('removing from "Your Gym" section works', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'se-gym', JSON.stringify([{ type: 'quiz', id: 'git' }]));
    await page.goto(GYM_URL);

    // Click the remove button in the "Your Gym" section
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#gym-selected .gym-remove-selected[data-id="git"]').click();

    // Gym should be empty
    await expect(page.locator('#gym-selected .empty-gym-msg')).toBeVisible();

    // The add button in the available section should no longer be "in-gym"
    await expect(page.locator('#available-quizzes .gym-add-btn[data-id="git"]')).not.toHaveClass(/in-gym/);
  });

  test('empty gym button clears all items', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'se-gym', JSON.stringify([
      { type: 'quiz', id: 'git' },
      { type: 'flashcard', id: 'git' },
    ]));
    await page.goto(GYM_URL);

    await expect(page.locator('#gym-selected .gym-item')).toHaveCount(2);
    await page.locator('#empty-gym-btn').click();
    await expect(page.locator('.confirm-modal-box')).toBeVisible();
    await page.locator('#confirm-modal-yes').click();
    await expect(page.locator('#gym-selected .empty-gym-msg')).toBeVisible();
  });

  test('Start Workout button is disabled when gym is empty', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await page.goto(GYM_URL);
    await expect(page.locator('#start-workout-btn')).toBeDisabled();
  });

  test('Start Workout button is enabled when gym has items', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'se-gym', JSON.stringify([{ type: 'quiz', id: 'git' }]));
    await page.goto(GYM_URL);
    await expect(page.locator('#start-workout-btn')).toBeEnabled();
  });

  test('gym summary shows card count', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'se-gym', JSON.stringify([{ type: 'quiz', id: 'git' }]));
    await page.goto(GYM_URL);
    const summary = page.locator('#gym-summary');
    await expect(summary).toContainText('total cards available');
    await expect(summary).toContainText('Will draw');
  });

  test('gym persists across page reload', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await page.goto(GYM_URL);

    // Add git quiz
    await page.locator('#available-quizzes .gym-add-btn[data-id="git"]').click();
    await expect(page.locator('#gym-selected .gym-item')).toHaveCount(1);

    // Reload
    await page.reload();
    await expect(page.locator('#gym-selected .gym-item')).toHaveCount(1);
    await expect(page.locator('#available-quizzes .gym-add-btn[data-id="git"]')).toHaveClass(/in-gym/);
  });

  test('timed practice toggle reveals timer settings and persists', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await page.goto(GYM_URL);

    await expect(page.locator('#timed-practice-panel')).toBeHidden();
    await page.locator(TIMED_TOGGLE_SLIDER).click();
    await expect(page.locator('#timedPracticeToggle')).toBeChecked();
    await expect(page.locator('#timed-practice-panel')).toBeVisible();
    await expect(page.locator('input[name="timedPracticeMode"][value="total"]')).toBeChecked();
    const radioBox = await page.locator('input[name="timedPracticeMode"][value="total"]').boundingBox();
    expect(radioBox.width).toBeGreaterThanOrEqual(24);
    expect(radioBox.height).toBeGreaterThanOrEqual(24);

    await page.reload();
    await expect(page.locator('#timedPracticeToggle')).toBeChecked();
    await expect(page.locator('#timed-practice-panel')).toBeVisible();
  });

  test('timed practice info tooltip stays anchored to the question button', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await page.goto(GYM_URL);

    const infoButton = page.locator('button[aria-describedby="timed-practice-tooltip"]');
    const tooltip = page.locator('#timed-practice-tooltip');
    await infoButton.click();
    await expect(tooltip).toBeVisible();

    const buttonBox = await infoButton.boundingBox();
    const tooltipBox = await tooltip.boundingBox();
    expect(buttonBox).not.toBeNull();
    expect(tooltipBox).not.toBeNull();
    expect(tooltipBox.y).toBeGreaterThan(buttonBox.y);
    expect(tooltipBox.y - buttonBox.y).toBeLessThan(80);
    expect(Math.abs(tooltipBox.x - buttonBox.x)).toBeLessThan(260);
  });

  test('timed practice per-card mode updates the workout countdown estimate', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'se-gym', JSON.stringify([{ type: 'quiz', id: 'scrum' }]));
    await page.goto(GYM_URL);

    await page.locator(TIMED_TOGGLE_SLIDER).click();
    await page.locator('input[name="timedPracticeMode"][value="per-question"]').check();
    await page.locator('#timed-practice-seconds-per-question').fill('30');
    await page.locator('#timed-practice-seconds-per-question').dispatchEvent('change');
    await page.locator('#max-cards').fill('2');

    await expect(page.locator('#timed-practice-note')).toContainText('1:00');
    await expect(page.locator('#timed-practice-note')).toContainText('2 cards');
  });

  test('timed practice accepts one second per card', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'se-gym', JSON.stringify([{ type: 'quiz', id: 'scrum' }]));
    await page.goto(GYM_URL);

    await page.locator(TIMED_TOGGLE_SLIDER).click();
    await page.locator('input[name="timedPracticeMode"][value="per-question"]').check();
    await page.locator('#timed-practice-seconds-per-question').fill('1');
    await page.locator('#max-cards').fill('2');

    await expect(page.locator('#timed-practice-seconds-per-question')).toHaveAttribute('aria-invalid', 'false');
    await expect(page.locator('#timed-practice-note')).toContainText('0:02');
  });

  test('show hero during workout is off by default and persists when enabled', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'se-gym', JSON.stringify([{ type: 'quiz', id: 'scrum' }]));
    await page.goto(GYM_URL);

    await expect(page.getByLabel('Show hero during workout')).not.toBeChecked();
    await page.getByRole('button', { name: 'Start Workout' }).click();
    await expect(page.locator('#gym-workout')).not.toHaveClass(/workout-hero-enabled/);
    await expect(page.locator('.workout-hero-visual:visible')).toHaveCount(0);

    await page.getByRole('button', { name: /Back to Gym Entrance/i }).click();
    await page.locator(SHOW_WORKOUT_HERO_SLIDER).click();
    await expect(page.getByLabel('Show hero during workout')).toBeChecked();

    await page.reload();
    await expect(page.getByLabel('Show hero during workout')).toBeChecked();
  });
});

// ==================== MOBILE LAYOUT TESTS ====================

test.describe('SE Gym - Mobile layout', () => {
  test.use({
    viewport: { width: 320, height: 760 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });

  test.beforeEach(async ({ page }) => {
    await clearState(page);
  });

  test('library controls fit narrow touch screens with usable targets', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await page.goto(GYM_URL);

    await expect(page.getByRole('heading', { name: 'SE Gym' })).toBeVisible();
    await expectNoHorizontalScroll(page, 'SE Gym library');
    await expectTapTarget(page.getByRole('button', { name: 'Start Workout' }), 'Start Workout button');
    await expectTapTarget(page.getByRole('button', { name: /^Add .+ to gym$/i }).first(), 'quiz add button');
    await expectTapTarget(page.getByRole('button', { name: /Info about personal gym/i }), 'personal gym info button');
    await expectTapTarget(page.getByLabel('Toggle personal gym activation'), 'personal gym activation switch');
    await expectTapTarget(page.getByRole('spinbutton', { name: /max cards/i }), 'max cards input');
  });

  test('workout cards fit narrow touch screens with usable answer targets', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'se-gym', JSON.stringify([{ type: 'quiz', id: 'scrum' }]));
    await page.goto(GYM_URL);

    await page.getByRole('spinbutton', { name: /max cards/i }).fill('1');
    await page.getByRole('button', { name: 'Start Workout' }).click();

    await expect(page.getByRole('button', { name: /Back to Gym Entrance/i })).toBeVisible();
    await expect(page.getByRole('radio').first()).toBeVisible();
    await expectNoHorizontalScroll(page, 'SE Gym workout');
    await expectTapTarget(page.getByRole('button', { name: /Back to Gym Entrance/i }), 'Back to Gym Entrance button');
    await expectTapTarget(page.getByRole('radio').first(), 'first answer option');
  });

  test('workout hero setting does not show side heroes on mobile', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'se-gym-show-workout-hero', 'true');
    await setCookie(context, 'se-gym', JSON.stringify([{ type: 'quiz', id: 'scrum' }]));
    await page.goto(GYM_URL);

    await expect(page.getByLabel('Show hero during workout')).toBeChecked();
    await page.getByRole('spinbutton', { name: /max cards/i }).fill('1');
    await page.getByRole('button', { name: 'Start Workout' }).click();

    await expect(page.locator('#gym-workout')).toHaveClass(/workout-hero-enabled/);
    await expect(page.locator('.workout-hero-visual:visible')).toHaveCount(0);
    await expect(page.getByRole('radio').first()).toBeVisible();
    await expectNoHorizontalScroll(page, 'SE Gym workout with hero setting enabled on mobile');
  });

  test('flashcard code blocks stay readable on narrow touch screens', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'se-gym', JSON.stringify([{ type: 'flashcard', id: 'python_syntax_explain' }]));
    await page.goto(GYM_URL);

    await page.getByRole('spinbutton', { name: /max cards/i }).fill('12');
    await page.getByRole('button', { name: 'Start Workout' }).click();

    let foundExponentiationCard = false;
    for (let i = 0; i < 12; i++) {
      const question = page.locator('.workout-flashcard .flashcard-question');
      await expect(question).toBeVisible();
      const questionText = await question.textContent();
      if (questionText && questionText.includes('2 ** 8')) {
        foundExponentiationCard = true;
        break;
      }

      await page.getByRole('button', { name: 'Show Answer' }).click();
      await page.getByRole('button', { name: 'I got it wrong' }).click();
    }

    expect(foundExponentiationCard, 'expected the Python exponentiation flashcard to appear').toBeTruthy();

    const codeBlock = page.locator('.workout-flashcard .flashcard-question pre').first();
    await expect(codeBlock).toBeVisible();
    await expect(codeBlock).toHaveCSS('white-space', 'pre');
    await expect(codeBlock.locator('code')).toHaveCSS('white-space', 'pre');

    const metrics = await codeBlock.evaluate((pre) => {
      const question = pre.closest('.flashcard-question');
      const card = pre.closest('.workout-flashcard');
      const preBox = pre.getBoundingClientRect();
      const cardBox = card.getBoundingClientRect();
      const questionBox = question.getBoundingClientRect();
      return {
        preWidth: preBox.width,
        preLeft: preBox.left,
        preRight: preBox.right,
        cardWidth: cardBox.width,
        cardLeft: cardBox.left,
        cardRight: cardBox.right,
        questionWidth: questionBox.width,
      };
    });

    expect(metrics.preWidth, 'code block should use the available flashcard width').toBeGreaterThan(metrics.questionWidth * 0.8);
    expect(metrics.preLeft, 'code block should stay inside the flashcard').toBeGreaterThanOrEqual(metrics.cardLeft - 1);
    expect(metrics.preRight, 'code block should stay inside the flashcard').toBeLessThanOrEqual(metrics.cardRight + 1);
    await expectNoHorizontalScroll(page, 'SE Gym flashcard code block');
  });
});

// ==================== SESSION TESTS ====================

test.describe('Personal Gym - Workout', () => {
  test.beforeEach(async ({ page }) => {
    await clearState(page);
  });

  test('starting a workout shows workout view and hides library', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'se-gym', JSON.stringify([{ type: 'quiz', id: 'git' }]));
    await page.goto(GYM_URL);

    await page.locator('#start-workout-btn').click();

    await expect(page.locator('#gym-workout')).toBeVisible();
    await expect(page.locator('#gym-entrance')).toBeHidden();
    await a11yCheckpoint(page, 'gym workout — quiz card showing', { feature: A11Y_FEATURE, darkMode: true });
  });

  test('workout shows progress bar', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'se-gym', JSON.stringify([{ type: 'quiz', id: 'git' }]));
    await page.goto(GYM_URL);

    await page.locator('#start-workout-btn').click();
    await expect(page.locator('.workout-progress-bar')).toBeVisible();
  });

  test('timed practice shows a countdown clock during workout', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'se-gym-timed-practice', 'true');
    await setCookie(context, 'se-gym-timer-mode', 'total');
    await setCookie(context, 'se-gym-timer-total-minutes', '1');
    await setCookie(context, 'se-gym', JSON.stringify([{ type: 'quiz', id: 'scrum' }]));
    await page.goto(GYM_URL);

    await page.locator('#max-cards').fill('1');
    await page.locator('#start-workout-btn').click();

    await expect(page.locator('#timed-practice-clock')).toBeVisible();
    await expect(page.locator('#timed-practice-clock-value')).toHaveText(/^(1:00|0:5[0-9])$/);
    await expect(page.locator('#timed-practice-extend-btn')).toBeVisible();
  });

  test('timed practice add-minute status accumulates repeated extensions', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'se-gym-timed-practice', 'true');
    await setCookie(context, 'se-gym-timer-mode', 'total');
    await setCookie(context, 'se-gym-timer-total-minutes', '1');
    await setCookie(context, 'se-gym', JSON.stringify([{ type: 'quiz', id: 'scrum' }]));
    await page.goto(GYM_URL);

    await page.locator('#max-cards').fill('1');
    await page.locator('#start-workout-btn').click();
    await page.locator('#timed-practice-extend-btn').click();
    await expect(page.locator('#timed-practice-status')).toContainText('Added 1 minute total');
    await page.locator('#timed-practice-extend-btn').click();
    await expect(page.locator('#timed-practice-status')).toContainText('Added 2 minutes total');
  });

  test('timed practice timeout stops the workout and shows results', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'se-gym-timed-practice', 'true');
    await setCookie(context, 'se-gym-timer-mode', 'per-question');
    await setCookie(context, 'se-gym-timer-seconds-per-question', '1');
    await setCookie(context, 'se-gym', JSON.stringify([{ type: 'quiz', id: 'scrum' }]));
    await page.goto(GYM_URL);

    await page.locator('#max-cards').fill('1');
    await page.locator('#start-workout-btn').click();

    await expect(page.locator('#workout-results')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#workout-summary')).toContainText('Time is up');
    await expect(page.locator('#workout-score')).toHaveText('0');
    await expect(page.locator('#workout-total')).toHaveText('1');
    await expect(page.locator('#timed-practice-clock')).toBeHidden();
  });

  test('timed practice per-card countdown uses selected workout size', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'se-gym-timed-practice', 'true');
    await setCookie(context, 'se-gym-timer-mode', 'per-question');
    await setCookie(context, 'se-gym-timer-seconds-per-question', '30');
    await setCookie(context, 'se-gym', JSON.stringify([{ type: 'quiz', id: 'scrum' }]));
    await page.goto(GYM_URL);

    await page.locator('#max-cards').fill('2');
    await page.locator('#start-workout-btn').click();

    await expect(page.locator('#timed-practice-clock')).toBeVisible();
    await expect(page.locator('#timed-practice-clock-value')).toHaveText(/^(1:00|0:5[0-9])$/);
  });

  test('show hero during workout displays heroes beside the question on desktop', async ({ page, context }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'se-gym-show-workout-hero', 'true');
    await setCookie(context, 'se-gym', JSON.stringify([{ type: 'quiz', id: 'scrum' }]));
    await page.goto(GYM_URL);

    await expect(page.getByLabel('Show hero during workout')).toBeChecked();
    await page.getByRole('spinbutton', { name: /max cards/i }).fill('1');
    await page.getByRole('button', { name: 'Start Workout' }).click();

    const leftHero = page.locator('.workout-hero-visual-left [data-gym-hero-svg]');
    const rightHero = page.locator('.workout-hero-visual-right [data-gym-hero-svg]');
    await expect(leftHero).toBeVisible();
    await expect(rightHero).toBeVisible();
    await expect(leftHero).toHaveAttribute('data-hero-avatar-ready', 'true');
    await expect(rightHero).toHaveAttribute('data-hero-avatar-ready', 'true');

    const positions = await page.evaluate(() => {
      const question = document.querySelector('.workout-quiz-card .question-text');
      const left = document.querySelector('.workout-hero-visual-left');
      const right = document.querySelector('.workout-hero-visual-right');
      if (!question || !left || !right) return null;
      const questionRect = question.getBoundingClientRect();
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      return {
        leftRightEdge: leftRect.right,
        questionLeftEdge: questionRect.left,
        rightLeftEdge: rightRect.left,
        questionRightEdge: questionRect.right,
      };
    });
    expect(positions, 'desktop workout should render a question with side heroes').not.toBeNull();
    expect(positions.leftRightEdge, 'left workout hero should sit to the left of the question').toBeLessThanOrEqual(positions.questionLeftEdge);
    expect(positions.rightLeftEdge, 'right workout hero should sit to the right of the question').toBeGreaterThanOrEqual(positions.questionRightEdge);
    await a11yCheckpoint(page, 'gym workout - quiz card with side heroes enabled', { feature: A11Y_FEATURE, darkMode: true });
  });

  test('workout renders quiz card with quiz UI', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    // Use a quiz with no parsons questions so max-cards=1 always yields a standard quiz card
    await setCookie(context, 'se-gym', JSON.stringify([{ type: 'quiz', id: 'scrum' }]));
    await page.goto(GYM_URL);

    // Set max cards to 1 so we only get one card
    await page.locator('#max-cards').fill('1');
    await page.locator('#start-workout-btn').click();

    // Should have quiz UI elements
    const quizCard = page.locator('.workout-quiz-card');
    await expect(quizCard).toBeVisible();
    await expect(quizCard.locator('.question-text')).toBeVisible();
    await expect(quizCard.locator('.quiz-options')).toBeVisible();
    await expect(quizCard.locator('.quiz-option').first()).toBeVisible();
  });

  test('workout renders flashcard with flashcard UI', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'se-gym', JSON.stringify([{ type: 'flashcard', id: 'git' }]));
    await page.goto(GYM_URL);

    await page.locator('#max-cards').fill('1');
    await page.locator('#start-workout-btn').click();

    // Should have flashcard UI elements
    const flashcard = page.locator('.workout-flashcard');
    await expect(flashcard).toBeVisible();
    await expect(flashcard.locator('.flashcard-question')).toBeVisible();
    await expect(flashcard.locator('.show-answer-btn')).toBeVisible();
  });

  test('quiz card interaction: answering shows explanation and next', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'se-gym', JSON.stringify([{ type: 'quiz', id: 'git' }]));
    await page.goto(GYM_URL);

    await page.locator('#max-cards').fill('2');
    await page.locator('#start-workout-btn').click();

    const quizCard = page.locator('.workout-quiz-card');
    await expect(quizCard).toBeVisible();
    const type = await quizCard.getAttribute('data-type');

    if (type === 'parsons') {
      // Click a parsons line to move it to the target, then check
      await quizCard.locator('.parsons-line').first().click();
      await quizCard.locator('.parsons-check-btn').click();
    } else {
      // Click first option
      await quizCard.locator('.quiz-option').first().click();
      // If multiple choice, need to submit
      if (type === 'multiple') {
        await quizCard.locator('.submit-answer-btn').click();
      }
    }

    // Explanation should appear
    await expect(quizCard.locator('.quiz-explanation')).toBeVisible();
    // Next button should be visible
    await expect(quizCard.locator('.next-btn')).toBeVisible();
    await a11yCheckpoint(page, 'gym workout — quiz card with explanation revealed', { feature: A11Y_FEATURE, darkMode: true });
  });

  test('quiz card answer shortcuts select visible options', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'se-gym', JSON.stringify([{ type: 'quiz', id: 'scrum' }]));
    await page.goto(GYM_URL);

    await page.locator('#max-cards').fill('2');
    await page.locator('#start-workout-btn').click();

    let quizCard = page.locator('.workout-quiz-card');
    await expect(quizCard).toBeVisible();
    await expect(quizCard.locator('.quiz-shortcuts-hint')).toBeVisible();
    await expect(quizCard.locator('.quiz-option').first()).toBeFocused();

    await page.keyboard.press('A');
    await expect(quizCard.locator('.quiz-explanation')).toBeVisible();
    await expect(quizCard.locator('.quiz-shortcuts-hint')).toBeHidden();

    await quizCard.locator('.next-btn').click();
    quizCard = page.locator('.workout-quiz-card');
    await expect(quizCard).toBeVisible();
    await expect(quizCard.locator('.quiz-option').first()).toBeFocused();

    await page.keyboard.press('1');
    await expect(quizCard.locator('.quiz-explanation')).toBeVisible();
  });

  test('multiple-answer quiz shortcut uses Enter to submit', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'se-gym', JSON.stringify([{ type: 'quiz', id: 'user_stories' }]));
    await page.goto(GYM_URL);

    await page.locator('#max-cards').fill('1');
    await page.locator('#start-workout-btn').click();

    const quizCard = page.locator('.workout-quiz-card');
    await expect(quizCard).toBeVisible();
    await expect(quizCard).toHaveAttribute('data-type', 'multiple');
    await expect(quizCard.locator('.quiz-shortcuts-hint')).toContainText(/Enter|Return/);
    await expect(quizCard.locator('.quiz-option').first()).toBeFocused();

    await page.keyboard.press('1');
    await expect(quizCard.locator('.submit-answer-btn')).toBeEnabled();
    await page.keyboard.press('Enter');

    await expect(quizCard.locator('.quiz-explanation')).toBeVisible();
    await expect(quizCard.locator('.quiz-shortcuts-hint')).toBeHidden();
  });

  test('Parsons shortcuts move numbered lines and Enter checks order', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'se-gym', JSON.stringify([{ type: 'quiz', id: 'shell_parson' }]));
    await page.goto(GYM_URL);

    await page.locator('#max-cards').fill('1');
    await page.locator('#start-workout-btn').click();

    const quizCard = page.locator('.workout-quiz-card[data-type="parsons"]');
    await expect(quizCard).toBeVisible();
    await expect(quizCard.locator('.parsons-shortcuts-hint')).toContainText(/Enter|Return/);
    await expect(quizCard.locator('.parsons-line').first()).toBeFocused();
    await expect(quizCard.locator('.parsons-shortcut-label').first()).toHaveText('1');
    await expect(quizCard.locator('.parsons-shortcut-label').first()).toHaveCSS('background-color', 'rgb(246, 248, 250)');
    await expect(quizCard.locator('.parsons-shortcuts-hint kbd').first()).toHaveCSS('background-color', 'rgb(246, 248, 250)');
    await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
    await expect(quizCard.locator('.parsons-shortcut-label').first()).toHaveCSS('background-color', 'rgb(37, 37, 37)');
    await expect(quizCard.locator('.parsons-shortcuts-hint kbd').first()).toHaveCSS('background-color', 'rgb(37, 37, 37)');
    await page.evaluate(() => document.documentElement.classList.remove('dark-mode'));

    await page.keyboard.press('1');
    await expect(quizCard.locator('.parsons-target .parsons-line[data-shortcut-index="1"]')).toHaveCount(1);

    await page.keyboard.press('Enter');
    await expect(quizCard.locator('.quiz-explanation')).toBeVisible();
    await expect(quizCard.locator('.next-btn')).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page.locator('#workout-results')).toBeVisible();
    await expect(page.locator('#workout-restart-btn')).toBeFocused();
  });

  test('flashcard interaction: show answer then assess', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'se-gym', JSON.stringify([{ type: 'flashcard', id: 'git' }]));
    await page.goto(GYM_URL);

    await page.locator('#max-cards').fill('1');
    await page.locator('#start-workout-btn').click();

    const flashcard = page.locator('.workout-flashcard');

    // Answer should be hidden initially
    await expect(flashcard.locator('.flashcard-answer-container')).toHaveClass(/hidden/);
    await a11yCheckpoint(page, 'gym workout — flashcard front (answer hidden)', { feature: A11Y_FEATURE, darkMode: true });

    // Click "Show Answer"
    await flashcard.locator('.show-answer-btn').click();

    // Answer should be visible
    await expect(flashcard.locator('.flashcard-answer-container')).not.toHaveClass(/hidden/);

    // Assessment buttons should appear
    await expect(flashcard.locator('.assessment-buttons')).not.toHaveClass(/hidden/);
    await expect(flashcard.locator('.correct-btn')).toBeVisible();
    await expect(flashcard.locator('.incorrect-btn')).toBeVisible();
    await a11yCheckpoint(page, 'gym workout — flashcard back (answer + assessment)', { feature: A11Y_FEATURE, darkMode: true });
  });

  test('flashcard shortcuts assess revealed cards', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'se-gym', JSON.stringify([{ type: 'flashcard', id: 'git' }]));
    await page.goto(GYM_URL);

    await page.locator('#max-cards').fill('2');
    await page.locator('#start-workout-btn').click();

    let flashcard = page.locator('.workout-flashcard');
    await expect(flashcard).toBeVisible();
    await expect(flashcard.locator('.flashcard-shortcuts-hint')).toBeHidden();
    await expect(flashcard.locator('.show-answer-btn')).toBeFocused();

    await flashcard.locator('.show-answer-btn').click();
    await expect(flashcard.locator('.flashcard-shortcuts-hint')).toBeVisible();
    await expect(flashcard.locator('.correct-btn')).toBeFocused();
    await page.keyboard.press('z');

    flashcard = page.locator('.workout-flashcard');
    await expect(flashcard).toBeVisible();
    await expect(flashcard.locator('.show-answer-btn')).toBeFocused();
    await flashcard.locator('.show-answer-btn').click();
    await page.keyboard.press('ArrowRight');

    await expect(page.locator('#workout-results')).toBeVisible();
    await expect(page.locator('#workout-score')).toHaveText('1');
    await expect(page.locator('#workout-total')).toHaveText('2');
    await expect(page.locator('#workout-review-btn')).toBeVisible();
  });

  test('workout completes and shows results', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'se-gym', JSON.stringify([{ type: 'flashcard', id: 'git' }]));
    await page.addInitScript(() => {
      localStorage.setItem('se-gym-hero-avatar', JSON.stringify({
        version: 1,
        kind: 'bruin',
        appearance: {
          presentation: 'male',
          skin: '#8b5a35',
          hairColor: '#3d2818',
          hairStyle: 'bald',
          eyeColor: '#1f140c',
          eyebrowStyle: 'arched',
          headStyle: 'default',
          eyeShape: 'round',
          noseShape: 'soft',
          mouthStyle: 'smile',
          blushStyle: 'none',
          facialHair: 'none',
          faceFeature: 'none'
        },
        body: { type: 'athletic' },
        outfit: {
          style: 'super-suit',
          suit: '#1F6EBD',
          capeOuter: '#15538f',
          capeInner: '#FFD100',
          accessory: 'none',
          accessories: [],
          emblem: ''
        }
      }));
    });
    await page.goto(GYM_URL);

    await page.locator('#max-cards').fill('1');
    await page.locator('#start-workout-btn').click();

    // Complete the single flashcard
    await page.locator('.show-answer-btn').click();
    await page.locator('.correct-btn').click();

    // Results should appear
    await expect(page.locator('#workout-results')).toBeVisible();
    await expect(page.locator('#workout-score')).toHaveText('1');
    await expect(page.locator('#workout-total')).toHaveText('1');
    const resultsHero = page.locator('#workout-results .workout-results-hero [data-gym-hero-svg]');
    await expect(resultsHero).toBeVisible();
    await expect(resultsHero).toHaveAttribute('data-hero-kind', 'bruin');
    await expect(resultsHero.locator('[data-hero-kind-layer="bruin"][data-hero-slot="mascot"]'))
      .toHaveAttribute('display', 'inline');
    await a11yCheckpoint(page, 'gym workout — results screen', { feature: A11Y_FEATURE, darkMode: true });
  });

  test('workout results: back to gym entrance works', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'se-gym', JSON.stringify([{ type: 'flashcard', id: 'git' }]));
    await page.goto(GYM_URL);

    await page.locator('#max-cards').fill('1');
    await page.locator('#start-workout-btn').click();
    await page.locator('.show-answer-btn').click();
    await page.locator('.correct-btn').click();

    await page.locator('#workout-back-btn').click();
    await expect(page.locator('#gym-entrance')).toBeVisible();
    await expect(page.locator('#gym-entrance')).toHaveCSS('display', 'grid');
    await expect(page.locator('#gym-workout')).toBeHidden();
  });

  test('workout results: review incorrect shows only missed cards', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'se-gym', JSON.stringify([{ type: 'flashcard', id: 'git' }]));
    await page.goto(GYM_URL);

    await page.locator('#max-cards').fill('2');
    await page.locator('#start-workout-btn').click();

    // Card 1: mark correct
    await page.locator('.show-answer-btn').click();
    await page.locator('.correct-btn').click();

    // Card 2: mark incorrect
    await page.locator('.show-answer-btn').click();
    await page.locator('.incorrect-btn').click();

    // Should see results with review button
    await expect(page.locator('#workout-results')).toBeVisible();
    await expect(page.locator('#workout-score')).toHaveText('1');
    await expect(page.locator('#workout-review-btn')).toBeVisible();

    // Start review
    await page.locator('#workout-review-btn').click();

    // Should show a new card (the incorrect one)
    await expect(page.locator('#workout-results')).toBeHidden();
    await expect(page.locator('.workout-flashcard')).toBeVisible();
  });

  test('workout results: restart reshuffles cards', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'se-gym', JSON.stringify([{ type: 'flashcard', id: 'git' }]));
    await page.goto(GYM_URL);

    await page.locator('#max-cards').fill('1');
    await page.locator('#start-workout-btn').click();
    await page.locator('.show-answer-btn').click();
    await page.locator('.correct-btn').click();

    // Results visible
    await expect(page.locator('#workout-results')).toBeVisible();

    // Restart
    await page.locator('#workout-restart-btn').click();

    // Workout should restart with a card visible
    await expect(page.locator('#workout-results')).toBeHidden();
    await expect(page.locator('.workout-flashcard')).toBeVisible();
  });

  test('back to gym entrance button works during workout', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'se-gym', JSON.stringify([{ type: 'quiz', id: 'git' }]));
    await page.goto(GYM_URL);

    await page.locator('#start-workout-btn').click();
    await expect(page.locator('#gym-workout')).toBeVisible();

    await page.locator('#back-to-library-btn').click();
    await expect(page.locator('#gym-entrance')).toBeVisible();
    await expect(page.locator('#gym-entrance')).toHaveCSS('display', 'grid');
    await expect(page.locator('#gym-workout')).toBeHidden();
  });

  test('max cards limits the number of workout cards', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'se-gym', JSON.stringify([{ type: 'quiz', id: 'git' }]));
    await page.goto(GYM_URL);

    // Git quiz has many questions; limit to 2
    await page.locator('#max-cards').fill('2');
    await page.locator('#start-workout-btn').click();

    // Answer 2 quiz cards, handling both single and multiple choice types
    for (let i = 0; i < 2; i++) {
      const card = page.locator('.workout-quiz-card');
      await expect(card).toBeVisible();
      const type = await card.getAttribute('data-type');

      if (type === 'parsons') {
        await card.locator('.parsons-line').first().click();
        await card.locator('.parsons-check-btn').click();
      } else {
        await card.locator('.quiz-option').first().click();
        if (type === 'multiple') {
          await card.locator('.submit-answer-btn').click();
        }
      }
      await card.locator('.next-btn').click();
    }

    // Should show results after 2 cards
    await expect(page.locator('#workout-results')).toBeVisible();
    await expect(page.locator('#workout-total')).toHaveText('2');
  });

  test('workout accepts optional quiz indices when selected', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'se-gym', JSON.stringify([{ type: 'quiz', id: 'user_stories' }]));
    await page.goto(GYM_URL);

    await page.locator('#max-cards').fill('5');
    await page.locator('#start-workout-btn').click();

    for (let i = 0; i < 5; i++) {
      const card = page.locator('.workout-quiz-card');
      await expect(card).toBeVisible();
      const questionText = await card.locator('.question-text').innerText();
      const includeOptional = questionText.includes('homepage to load blazing fast');

      await answerWorkoutMultipleChoice(card, includeOptional);
      await expect(card.locator('.quiz-option.selected.incorrect')).toHaveCount(0);
      await card.locator('.next-btn').click();
    }

    await expect(page.locator('#workout-results')).toBeVisible();
    await expect(page.locator('#workout-score')).toHaveText('5');
    await expect(page.locator('#workout-review-btn')).toBeHidden();
  });
});

// ==================== DIFFICULTY LEVELS ====================

test.describe('Personal Gym - Difficulty', () => {
  // The Singleton quiz is the canonical fixture: 3 questions have a
  // difficulty (intermediate, advanced, expert) and 2 have none. This lets
  // us check that the "skip" filter excludes the marked levels while
  // unmarked questions stay in regardless.
  const SINGLETON_QUIZ_ID = 'design_pattern_singleton';

  test.beforeEach(async ({ page }) => {
    await clearState(page);
  });

  test('difficulty chip renders on the SEBook quiz embed when set', async ({ page }) => {
    await page.goto('/SEBook/designpatterns/singleton.html');
    // Quiz embed shows one question at a time (`.active`), but every card
    // is in the DOM. Verify (a) the active card exists and (b) every card
    // with a difficulty has a properly-labelled chip emitted.
    await expect(page.locator('.quiz-question-card.active')).toHaveCount(1);
    const chips = page.locator('.quiz-question-card[data-difficulty] .quiz-difficulty');
    const count = await chips.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(chips.nth(i)).toHaveAttribute('aria-label', /Difficulty:/i);
    }
  });

  test('difficulty chip is hidden during question by default and revealed on answer', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'se-gym', JSON.stringify([{ type: 'quiz', id: SINGLETON_QUIZ_ID }]));
    await page.goto(GYM_URL);
    await page.locator('#max-cards').fill('20');
    await page.locator('#start-workout-btn').click();

    // Skip past any questions that lack a difficulty until we land on one
    // that has it; that's the only case where the toggle is observable.
    for (let i = 0; i < 5; i++) {
      const card = page.locator('.workout-quiz-card').first();
      await expect(card).toBeVisible();
      const chip = card.locator('.quiz-difficulty');
      const chipCount = await chip.count();
      if (chipCount > 0) {
        // Default toggle is OFF → chip is hidden until answered.
        await expect(chip).toBeHidden();
        const type = await card.getAttribute('data-type');
        if (type === 'multiple') {
          await card.locator('.quiz-option').first().click();
          await card.locator('.submit-answer-btn').click();
        } else {
          await card.locator('.quiz-option').first().click();
        }
        await expect(chip).toBeVisible();
        return;
      }
      // Card had no difficulty — answer and continue.
      const type = await card.getAttribute('data-type');
      if (type === 'multiple') {
        await card.locator('.quiz-option').first().click();
        await card.locator('.submit-answer-btn').click();
      } else {
        await card.locator('.quiz-option').first().click();
      }
      await card.locator('.next-btn').click();
    }
    throw new Error('No difficulty-tagged question encountered in the Singleton quiz');
  });

  test('show-difficulty toggle reveals the chip up front and persists', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'se-gym', JSON.stringify([{ type: 'quiz', id: SINGLETON_QUIZ_ID }]));
    await page.goto(GYM_URL);

    await page.locator('#showDifficultyToggle + .slider').click();
    await expect(page.locator('#showDifficultyToggle')).toBeChecked();

    // Reload — the cookie must keep the toggle on.
    await page.reload();
    await expect(page.locator('#showDifficultyToggle')).toBeChecked();

    await page.locator('#max-cards').fill('20');
    await page.locator('#start-workout-btn').click();

    // Walk to a difficulty-tagged card; chip should be visible from the start.
    for (let i = 0; i < 5; i++) {
      const card = page.locator('.workout-quiz-card').first();
      await expect(card).toBeVisible();
      const chip = card.locator('.quiz-difficulty');
      if (await chip.count() > 0) {
        await expect(chip).toBeVisible();
        return;
      }
      const type = await card.getAttribute('data-type');
      if (type === 'multiple') {
        await card.locator('.quiz-option').first().click();
        await card.locator('.submit-answer-btn').click();
      } else {
        await card.locator('.quiz-option').first().click();
      }
      await card.locator('.next-btn').click();
    }
    throw new Error('No difficulty-tagged question encountered in the Singleton quiz');
  });

  test('all difficulty checkboxes are checked by default', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await page.goto(GYM_URL);
    for (const level of ['basic', 'intermediate', 'advanced', 'expert']) {
      await expect(
        page.locator(`.difficulty-filter-checkbox[data-difficulty="${level}"]`)
      ).toBeChecked();
    }
  });

  test('unchecking all four levels still includes questions with no assigned difficulty', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'se-gym', JSON.stringify([{ type: 'quiz', id: SINGLETON_QUIZ_ID }]));
    await page.goto(GYM_URL);

    // Uncheck every level — questions WITH a difficulty should drop out;
    // questions WITHOUT one should still appear.
    for (const level of ['basic', 'intermediate', 'advanced', 'expert']) {
      await page.locator(`.difficulty-filter-checkbox[data-difficulty="${level}"]`).uncheck();
    }

    // The Singleton quiz has 5 questions; 3 are tagged (intermediate,
    // advanced, expert) and 2 are not. Summary should report 2 cards.
    await expect(page.locator('#gym-summary')).toContainText('2 total cards');

    await page.locator('#max-cards').fill('20');
    await page.locator('#start-workout-btn').click();
    await expect(page.locator('#workout-total')).toHaveText('2');

    // Walk through both cards — none should display a difficulty chip
    // pre-answer or post-answer (because they have no assigned level).
    for (let i = 0; i < 2; i++) {
      const card = page.locator('.workout-quiz-card').first();
      await expect(card).toBeVisible();
      await expect(card.locator('.quiz-difficulty')).toHaveCount(0);
      const type = await card.getAttribute('data-type');
      if (type === 'multiple') {
        await card.locator('.quiz-option').first().click();
        await card.locator('.submit-answer-btn').click();
      } else {
        await card.locator('.quiz-option').first().click();
      }
      await card.locator('.next-btn').click();
    }

    await expect(page.locator('#workout-results')).toBeVisible();
  });

  test('unchecking a single level only excludes that level from the workout', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'se-gym', JSON.stringify([{ type: 'quiz', id: SINGLETON_QUIZ_ID }]));
    await page.goto(GYM_URL);

    // Uncheck just "expert" — should leave 4 cards (2 untagged + intermediate + advanced).
    await page.locator('.difficulty-filter-checkbox[data-difficulty="expert"]').uncheck();
    await expect(page.locator('#gym-summary')).toContainText('4 total cards');

    // Also uncheck "advanced" — should leave 3 cards (2 untagged + intermediate).
    await page.locator('.difficulty-filter-checkbox[data-difficulty="advanced"]').uncheck();
    await expect(page.locator('#gym-summary')).toContainText('3 total cards');

    // Cookie persists across reloads — checked/unchecked state survives.
    await page.reload();
    await expect(page.locator('.difficulty-filter-checkbox[data-difficulty="expert"]')).not.toBeChecked();
    await expect(page.locator('.difficulty-filter-checkbox[data-difficulty="advanced"]')).not.toBeChecked();
    await expect(page.locator('.difficulty-filter-checkbox[data-difficulty="basic"]')).toBeChecked();
    await expect(page.locator('.difficulty-filter-checkbox[data-difficulty="intermediate"]')).toBeChecked();
  });

  test('workout results show overall and per-difficulty breakdown with pie charts', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'se-gym', JSON.stringify([{ type: 'quiz', id: SINGLETON_QUIZ_ID }]));
    await page.goto(GYM_URL);
    await page.locator('#max-cards').fill('20');
    await page.locator('#start-workout-btn').click();

    // Walk through every Singleton question, picking the first option
    // (correct or not) so we get a mix of right/wrong.
    while (await page.locator('.workout-quiz-card').count() > 0) {
      const card = page.locator('.workout-quiz-card').first();
      const type = await card.getAttribute('data-type');
      if (type === 'multiple') {
        await card.locator('.quiz-option').first().click();
        await card.locator('.submit-answer-btn').click();
      } else {
        await card.locator('.quiz-option').first().click();
      }
      await card.locator('.next-btn').click();
    }

    await expect(page.locator('#workout-results')).toBeVisible();
    const breakdown = page.locator('#workout-breakdown');
    await expect(breakdown).toBeVisible();

    // Overall row always present.
    const overallRow = breakdown.locator('.workout-breakdown-row.is-overall');
    await expect(overallRow).toHaveCount(1);
    await expect(overallRow.locator('.workout-breakdown-pie')).toBeVisible();
    await expect(overallRow.locator('.workout-breakdown-stat')).toContainText(/\d+ \/ 5 \(\d+%\)/);

    // Per-difficulty rows for the three tagged levels in the Singleton quiz.
    for (const level of ['intermediate', 'advanced', 'expert']) {
      const row = breakdown.locator(`.workout-breakdown-row.level-${level}`);
      await expect(row).toHaveCount(1);
      await expect(row.locator('.workout-breakdown-pie')).toBeVisible();
      await expect(row.locator('.workout-breakdown-stat')).toContainText(/\d+ \/ 1 \(\d+%\)/);
    }

    // "Basic" had no cards in the Singleton quiz → not shown.
    await expect(breakdown.locator('.workout-breakdown-row.level-basic')).toHaveCount(0);

    // Untagged appears because 2 of 5 questions have no difficulty.
    const untaggedRow = breakdown.locator('.workout-breakdown-row.level-untagged');
    await expect(untaggedRow).toHaveCount(1);
    await expect(untaggedRow.locator('.workout-breakdown-stat')).toContainText(/\d+ \/ 2 \(\d+%\)/);
  });
});

// ==================== + BUTTON ON INCLUDES ====================

test.describe('Personal Gym - Toggle Button on Includes', () => {
  test.beforeEach(async ({ page }) => {
    await clearState(page);
  });

  test('+ button is hidden when personal gym is not active', async ({ page }) => {
    await page.goto(GIT_PAGE_URL);
    // The toggle button should exist but be hidden
    const toggleBtn = page.locator('.se-gym-toggle').first();
    await expect(toggleBtn).toBeHidden();
  });

  test('+ button is visible when personal gym is active', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await page.goto(GIT_PAGE_URL);
    const toggleBtn = page.locator('.se-gym-toggle').first();
    await expect(toggleBtn).toBeVisible();
    await a11yCheckpoint(page, 'sebook page — gym toggle button visible', { feature: A11Y_FEATURE, darkMode: true });
  });

  test('+ button toggles to check icon when clicked', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await page.goto(GIT_PAGE_URL);

    const toggleBtn = page.locator('.se-gym-toggle').first();
    await expect(toggleBtn.locator('i')).toHaveClass(/fa-plus/);

    await toggleBtn.click();
    await expect(toggleBtn).toHaveClass(/in-gym/);
    await expect(toggleBtn.locator('i')).toHaveClass(/fa-check/);
  });

  test('+ button adds item to cookie gym', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await page.goto(GIT_PAGE_URL);

    const toggleBtn = page.locator('.se-gym-toggle').first();
    const expectedGymId = await toggleBtn.getAttribute('data-gym-id');
    await toggleBtn.click();

    // Verify cookie was set
    const gym = await page.evaluate(() => {
      var nameEQ = 'se-gym=';
      var ca = document.cookie.split(';');
      for (var i = 0; i < ca.length; i++) {
        var c = ca[i].trim();
        if (c.indexOf(nameEQ) === 0) return JSON.parse(decodeURIComponent(c.substring(nameEQ.length)));
      }
      return [];
    });
    expect(gym.length).toBeGreaterThan(0);
    expect(gym[0].id).toBe(expectedGymId);
  });

  test('clicking + again removes from gym', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await page.goto(GIT_PAGE_URL);

    const toggleBtn = page.locator('.se-gym-toggle').first();
    await toggleBtn.click();
    await expect(toggleBtn).toHaveClass(/in-gym/);

    await toggleBtn.click();
    await expect(toggleBtn).not.toHaveClass(/in-gym/);
    await expect(toggleBtn.locator('i')).toHaveClass(/fa-plus/);
  });
});

// ==================== PERFORMANCE TRACKING ====================

test.describe('Personal Gym - Performance Tracking', () => {
  test.beforeEach(async ({ page }) => {
    await clearState(page);
  });

  test('analyze performance toggle is off by default', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await page.goto(GYM_URL);
    await expect(page.locator('#analyzePerformanceToggle')).not.toBeChecked();
  });

  test('analyze performance toggle persists across reload', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await page.goto(GYM_URL);

    await page.locator(ANALYZE_TOGGLE_SLIDER).click();
    await page.reload();
    await expect(page.locator('#analyzePerformanceToggle')).toBeChecked();
  });

  test('difficult questions section is hidden when analyze is off', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await page.goto(GYM_URL);
    await expect(page.locator('#difficult-gym-section')).toBeHidden();
  });

  test('difficult questions section is hidden when analyze is on but no difficult questions', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'analyze-performance', 'true');
    await page.goto(GYM_URL);
    // No stats exist, so no difficult questions
    await expect(page.locator('#difficult-gym-section')).toBeHidden();
  });

  test('difficult questions appear when stats exceed threshold', async ({ page, context }) => {
    // Marker: this test renders the otherwise-hidden Difficult Questions
    // section, which is the only way the audit can sweep it.
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'analyze-performance', 'true');
    await page.goto(GYM_URL);

    // Inject stats: a question that was answered incorrectly >40% of the time
    // We need to hash a question from the embedded data, so we do it via the page
    await page.evaluate(() => {
      // Get any quiz question from ALL_CARD_DATA
      var quizIds = Object.keys(ALL_CARD_DATA.quizzes);
      var firstQuiz = ALL_CARD_DATA.quizzes[quizIds[0]];
      var question = firstQuiz.questions[0];
      var key = quizIds[0] + ':' + question.id;
      // 10 seen, 3 correct = 70% failure rate
      var stats = {};
      stats[key] = { seen: 10, correct: 3 };
      PersonalGym.saveStats(stats);
    });

    // Reload to pick up the stats
    await page.reload();

    await expect(page.locator('#difficult-gym-section')).toBeVisible();
    await expect(page.locator('.difficult-heading')).toContainText('Difficult Questions');
    await a11yCheckpoint(page, 'gym entrance — difficult questions section visible', { feature: A11Y_FEATURE, darkMode: true });
  });

  test('difficult gym can be added to workout', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'analyze-performance', 'true');
    await page.goto(GYM_URL);

    // Inject difficult stats
    await page.evaluate(() => {
      var quizIds = Object.keys(ALL_CARD_DATA.quizzes);
      var firstQuiz = ALL_CARD_DATA.quizzes[quizIds[0]];
      var question = firstQuiz.questions[0];
      var key = quizIds[0] + ':' + question.id;
      var stats = {};
      stats[key] = { seen: 10, correct: 2 };
      PersonalGym.saveStats(stats);
    });
    await page.reload();

    // Add difficult gym
    await page.locator('#difficult-add-btn').click();
    await expect(page.locator('#difficult-add-btn')).toHaveClass(/in-gym/);

    // Start Workout should be enabled
    await expect(page.locator('#start-workout-btn')).toBeEnabled();
  });

  test('workout records performance when analyze is on', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'analyze-performance', 'true');
    await setCookie(context, 'se-gym', JSON.stringify([{ type: 'flashcard', id: 'git' }]));
    await page.goto(GYM_URL);

    await page.locator('#max-cards').fill('1');
    await page.locator('#start-workout-btn').click();

    // Answer the flashcard incorrectly
    await page.locator('.show-answer-btn').click();
    await page.locator('.incorrect-btn').click();

    // Check that stats were recorded
    const hasStats = await page.evaluate(() => {
      var stats = PersonalGym.getStats();
      return Object.keys(stats).length > 0;
    });
    expect(hasStats).toBe(true);
  });

  test('deactivating analyze toggle shows confirm modal', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'analyze-performance', 'true');
    await page.goto(GYM_URL);

    await expect(page.locator('#analyzePerformanceToggle')).toBeChecked();
    await page.locator(ANALYZE_TOGGLE_SLIDER).click();

    // The #confirm-modal wrapper has 0x0 dimensions (fixed-position children),
    // so check the visible modal box instead
    await expect(page.locator('.confirm-modal-box')).toBeVisible();
    await expect(page.locator('#confirm-modal-msg')).toContainText('delete');
  });

  test('confirm modal "Yes" clears stats and deactivates', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'analyze-performance', 'true');
    await page.goto(GYM_URL);

    // Inject some stats
    await page.evaluate(() => {
      PersonalGym.saveStats({ test: { seen: 5, correct: 1 } });
    });

    await page.locator(ANALYZE_TOGGLE_SLIDER).click();
    await page.locator('#confirm-modal-yes').click();

    // Modal should close
    await expect(page.locator('.confirm-modal-box')).toBeHidden();

    // Toggle should be unchecked
    await expect(page.locator('#analyzePerformanceToggle')).not.toBeChecked();

    // Stats should be cleared
    const statsEmpty = await page.evaluate(() => {
      return Object.keys(PersonalGym.getStats()).length === 0;
    });
    expect(statsEmpty).toBe(true);
  });

  test('confirm modal "No" keeps toggle on', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'analyze-performance', 'true');
    await page.goto(GYM_URL);

    await page.locator(ANALYZE_TOGGLE_SLIDER).click();
    await page.locator('#confirm-modal-no').click();

    // Modal should close
    await expect(page.locator('.confirm-modal-box')).toBeHidden();
    // Toggle should revert to checked
    await expect(page.locator('#analyzePerformanceToggle')).toBeChecked();
  });

  test('questions below 40% failure threshold are NOT in difficult gym', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'analyze-performance', 'true');
    await page.goto(GYM_URL);

    // Inject stats: 10 seen, 7 correct = 30% failure rate (below 40% threshold)
    await page.evaluate(() => {
      var quizIds = Object.keys(ALL_CARD_DATA.quizzes);
      var firstQuiz = ALL_CARD_DATA.quizzes[quizIds[0]];
      var question = firstQuiz.questions[0];
      var key = quizIds[0] + ':' + question.id;
      var stats = {};
      stats[key] = { seen: 10, correct: 7 };
      PersonalGym.saveStats(stats);
    });
    await page.reload();

    // Difficult section should remain hidden (30% failure < 40% threshold)
    await expect(page.locator('#difficult-gym-section')).toBeHidden();
  });

  test('difficult gym deduplicates questions across sets', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'analyze-performance', 'true');
    await page.goto(GYM_URL);

    // Inject stats with high failure rate for one question
    const count = await page.evaluate(() => {
      var quizIds = Object.keys(ALL_CARD_DATA.quizzes);
      var firstQuiz = ALL_CARD_DATA.quizzes[quizIds[0]];
      var question = firstQuiz.questions[0];
      var key = quizIds[0] + ':' + question.id;
      var stats = {};
      stats[key] = { seen: 10, correct: 1 };
      PersonalGym.saveStats(stats);

      // Now get difficult cards count - the same question hash should only appear once
      // even if it's in a meta-gym and base gym
      return document.querySelectorAll('#difficult-gym-section').length; // just to trigger
    });

    await page.reload();

    // The difficult count should show exactly 1 card (not duplicated)
    await expect(page.locator('#difficult-gym-section')).toBeVisible();
    await expect(page.locator('#difficult-count')).toContainText('1');
  });
});
