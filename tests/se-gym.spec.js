// @ts-check
const { test, expect } = require('@playwright/test');

const GYM_URL = '/se-gym/';
// A page with both a quiz and flashcard include
const GIT_PAGE_URL = '/SEBook/tools/git/';

// The toggle inputs are visually hidden inside custom .switch labels.
// We need to click the visible slider span, not the hidden input.
const ACTIVATE_TOGGLE_SLIDER = '#activatePersonalGymToggle + .slider';
const ANALYZE_TOGGLE_SLIDER = '#analyzePerformanceToggle + .slider';

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

// ==================== LIBRARY VIEW TESTS ====================

test.describe('SE Gym - Library View', () => {
  test.beforeEach(async ({ page }) => {
    await clearState(page);
  });

  test('page loads with library view visible', async ({ page }) => {
    await page.goto(GYM_URL);
    await expect(page.locator('#gym-entrance')).toBeVisible();
    await expect(page.locator('#gym-workout')).toBeHidden();
    await expect(page.locator('h1')).toContainText('SE Study Gym');
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
  });

  test('workout shows progress bar', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'se-gym', JSON.stringify([{ type: 'quiz', id: 'git' }]));
    await page.goto(GYM_URL);

    await page.locator('#start-workout-btn').click();
    await expect(page.locator('.workout-progress-bar')).toBeVisible();
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

    // Click "Show Answer"
    await flashcard.locator('.show-answer-btn').click();

    // Answer should be visible
    await expect(flashcard.locator('.flashcard-answer-container')).not.toHaveClass(/hidden/);

    // Assessment buttons should appear
    await expect(flashcard.locator('.assessment-buttons')).not.toHaveClass(/hidden/);
    await expect(flashcard.locator('.correct-btn')).toBeVisible();
    await expect(flashcard.locator('.incorrect-btn')).toBeVisible();
  });

  test('workout completes and shows results', async ({ page, context }) => {
    await setCookie(context, 'se-gym-active', 'true');
    await setCookie(context, 'se-gym', JSON.stringify([{ type: 'flashcard', id: 'git' }]));
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
    expect(gym[0].id).toBe('git');
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
      var h = PersonalGym.hashQuestion(question.question);
      // 10 seen, 3 correct = 70% failure rate
      var stats = {};
      stats[h] = { seen: 10, correct: 3 };
      PersonalGym.saveStats(stats);
    });

    // Reload to pick up the stats
    await page.reload();

    await expect(page.locator('#difficult-gym-section')).toBeVisible();
    await expect(page.locator('.difficult-heading')).toContainText('Difficult Questions');
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
      var h = PersonalGym.hashQuestion(question.question);
      var stats = {};
      stats[h] = { seen: 10, correct: 2 };
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
      var h = PersonalGym.hashQuestion(question.question);
      var stats = {};
      stats[h] = { seen: 10, correct: 7 };
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
      var h = PersonalGym.hashQuestion(question.question);
      var stats = {};
      stats[h] = { seen: 10, correct: 1 };
      PersonalGym.saveStats(stats);

      // Now get difficult cards count - the same question hash should only appear once
      // even if it's in a meta-gym and base gym
      return document.querySelectorAll('#difficult-gym-section').length; // just to trigger
    });

    await page.reload();

    // The difficult count should show exactly 1 card (not duplicated)
    const difficultCountText = await page.locator('#difficult-count').textContent();
    expect(difficultCountText).toContain('1');
  });
});
