// @ts-check
const { test, expect } = require('@playwright/test');

const DECK_URL = '/se-deck/';
// A page with both a quiz and flashcard include
const GIT_PAGE_URL = '/SEBook/tools/git/';

// The toggle inputs are visually hidden inside custom .switch labels.
// We need to click the visible slider span, not the hidden input.
const ACTIVATE_TOGGLE_SLIDER = '#activatePersonalDeckToggle + .slider';
const ANALYZE_TOGGLE_SLIDER = '#analyzePerformanceToggle + .slider';

/**
 * Helper: clear all se-deck cookies and localStorage before each test.
 */
async function clearState(page) {
  await page.context().clearCookies();
  await page.evaluate(() => {
    try { localStorage.removeItem('se-deck-stats'); } catch (e) { /* */ }
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

test.describe('Personal Deck - Library View', () => {
  test.beforeEach(async ({ page }) => {
    await clearState(page);
  });

  test('page loads with library view visible', async ({ page }) => {
    await page.goto(DECK_URL);
    await expect(page.locator('#deck-library')).toBeVisible();
    await expect(page.locator('#deck-session')).toBeHidden();
    await expect(page.locator('h1')).toContainText('Personal Deck');
  });

  test('activate toggle is off by default and sections are dimmed', async ({ page }) => {
    await page.goto(DECK_URL);
    const toggle = page.locator('#activatePersonalDeckToggle');
    await expect(toggle).not.toBeChecked();
    await expect(page.locator('#deck-controls-body')).toHaveClass(/pd-inactive/);
    await expect(page.locator('#deck-library-sections')).toHaveClass(/pd-inactive/);
  });

  test('activate toggle enables controls and sections', async ({ page }) => {
    await page.goto(DECK_URL);
    await page.locator(ACTIVATE_TOGGLE_SLIDER).click();
    await expect(page.locator('#deck-controls-body')).not.toHaveClass(/pd-inactive/);
    await expect(page.locator('#deck-library-sections')).not.toHaveClass(/pd-inactive/);
  });

  test('activate toggle persists across page reload', async ({ page }) => {
    await page.goto(DECK_URL);
    await page.locator(ACTIVATE_TOGGLE_SLIDER).click();
    await page.reload();
    await expect(page.locator('#activatePersonalDeckToggle')).toBeChecked();
    await expect(page.locator('#deck-controls-body')).not.toHaveClass(/pd-inactive/);
  });

  test('deactivating toggle clears the deck', async ({ page, context }) => {
    // Activate and add a quiz to the deck
    await setCookie(context, 'se-deck-active', 'true');
    await setCookie(context, 'se-deck', JSON.stringify([{ type: 'quiz', id: 'git' }]));
    await page.goto(DECK_URL);

    // Verify the quiz is in the deck
    await expect(page.locator('#deck-selected .deck-item')).toHaveCount(1);

    // Deactivate
    await page.locator(ACTIVATE_TOGGLE_SLIDER).click();

    // Re-activate and check deck is empty
    await page.locator(ACTIVATE_TOGGLE_SLIDER).click();
    await expect(page.locator('#deck-selected .empty-deck-msg')).toBeVisible();
  });

  test('available quizzes and flashcards are listed', async ({ page, context }) => {
    await setCookie(context, 'se-deck-active', 'true');
    await page.goto(DECK_URL);

    const quizItems = page.locator('#available-quizzes .deck-item');
    const flashcardItems = page.locator('#available-flashcards .deck-item');

    // Should have at least some quizzes and flashcards
    await expect(quizItems.first()).toBeVisible();
    await expect(flashcardItems.first()).toBeVisible();

    // Check that items have badges and titles
    await expect(quizItems.first().locator('.deck-item-badge')).toBeVisible();
    await expect(quizItems.first().locator('.deck-item-title')).toBeVisible();
  });

  test('clicking + button adds quiz to deck', async ({ page, context }) => {
    await setCookie(context, 'se-deck-active', 'true');
    await page.goto(DECK_URL);

    // Find the git quiz add button
    const gitAddBtn = page.locator('#available-quizzes .deck-add-btn[data-id="git"]');
    await gitAddBtn.click();

    // The button should now show a check icon
    await expect(gitAddBtn).toHaveClass(/in-deck/);
    await expect(gitAddBtn.locator('i')).toHaveClass(/fa-check/);

    // Should appear in "Your Deck" section
    await expect(page.locator('#deck-selected .deck-item')).toHaveCount(1);
    await expect(page.locator('#deck-selected .deck-item-title')).toContainText('Version Control and Git');
  });

  test('clicking + button again removes quiz from deck', async ({ page, context }) => {
    await setCookie(context, 'se-deck-active', 'true');
    await page.goto(DECK_URL);

    const gitAddBtn = page.locator('#available-quizzes .deck-add-btn[data-id="git"]');

    // Add then remove
    await gitAddBtn.click();
    await expect(gitAddBtn).toHaveClass(/in-deck/);
    await gitAddBtn.click();
    await expect(gitAddBtn).not.toHaveClass(/in-deck/);

    // Your Deck should be empty again
    await expect(page.locator('#deck-selected .empty-deck-msg')).toBeVisible();
  });

  test('removing from "Your Deck" section works', async ({ page, context }) => {
    await setCookie(context, 'se-deck-active', 'true');
    await setCookie(context, 'se-deck', JSON.stringify([{ type: 'quiz', id: 'git' }]));
    await page.goto(DECK_URL);

    // Click the remove button in the "Your Deck" section
    await page.locator('#deck-selected .deck-remove-selected[data-id="git"]').click();

    // Deck should be empty
    await expect(page.locator('#deck-selected .empty-deck-msg')).toBeVisible();

    // The add button in the available section should no longer be "in-deck"
    await expect(page.locator('#available-quizzes .deck-add-btn[data-id="git"]')).not.toHaveClass(/in-deck/);
  });

  test('empty deck button clears all items', async ({ page, context }) => {
    await setCookie(context, 'se-deck-active', 'true');
    await setCookie(context, 'se-deck', JSON.stringify([
      { type: 'quiz', id: 'git' },
      { type: 'flashcard', id: 'git' },
    ]));
    await page.goto(DECK_URL);

    await expect(page.locator('#deck-selected .deck-item')).toHaveCount(2);
    await page.locator('#empty-deck-btn').click();
    await expect(page.locator('#deck-selected .empty-deck-msg')).toBeVisible();
  });

  test('start session button is disabled when deck is empty', async ({ page, context }) => {
    await setCookie(context, 'se-deck-active', 'true');
    await page.goto(DECK_URL);
    await expect(page.locator('#start-session-btn')).toBeDisabled();
  });

  test('start session button is enabled when deck has items', async ({ page, context }) => {
    await setCookie(context, 'se-deck-active', 'true');
    await setCookie(context, 'se-deck', JSON.stringify([{ type: 'quiz', id: 'git' }]));
    await page.goto(DECK_URL);
    await expect(page.locator('#start-session-btn')).toBeEnabled();
  });

  test('deck summary shows card count', async ({ page, context }) => {
    await setCookie(context, 'se-deck-active', 'true');
    await setCookie(context, 'se-deck', JSON.stringify([{ type: 'quiz', id: 'git' }]));
    await page.goto(DECK_URL);
    const summary = page.locator('#deck-summary');
    await expect(summary).toContainText('total cards available');
    await expect(summary).toContainText('Will draw');
  });

  test('deck persists across page reload', async ({ page, context }) => {
    await setCookie(context, 'se-deck-active', 'true');
    await page.goto(DECK_URL);

    // Add git quiz
    await page.locator('#available-quizzes .deck-add-btn[data-id="git"]').click();
    await expect(page.locator('#deck-selected .deck-item')).toHaveCount(1);

    // Reload
    await page.reload();
    await expect(page.locator('#deck-selected .deck-item')).toHaveCount(1);
    await expect(page.locator('#available-quizzes .deck-add-btn[data-id="git"]')).toHaveClass(/in-deck/);
  });
});

// ==================== SESSION TESTS ====================

test.describe('Personal Deck - Session', () => {
  test.beforeEach(async ({ page }) => {
    await clearState(page);
  });

  test('starting a session shows session view and hides library', async ({ page, context }) => {
    await setCookie(context, 'se-deck-active', 'true');
    await setCookie(context, 'se-deck', JSON.stringify([{ type: 'quiz', id: 'git' }]));
    await page.goto(DECK_URL);

    await page.locator('#start-session-btn').click();

    await expect(page.locator('#deck-session')).toBeVisible();
    await expect(page.locator('#deck-library')).toBeHidden();
  });

  test('session shows progress bar', async ({ page, context }) => {
    await setCookie(context, 'se-deck-active', 'true');
    await setCookie(context, 'se-deck', JSON.stringify([{ type: 'quiz', id: 'git' }]));
    await page.goto(DECK_URL);

    await page.locator('#start-session-btn').click();
    await expect(page.locator('.session-progress-bar')).toBeVisible();
  });

  test('session renders quiz card with quiz UI', async ({ page, context }) => {
    await setCookie(context, 'se-deck-active', 'true');
    await setCookie(context, 'se-deck', JSON.stringify([{ type: 'quiz', id: 'git' }]));
    await page.goto(DECK_URL);

    // Set max cards to 1 so we only get one card
    await page.locator('#max-cards').fill('1');
    await page.locator('#start-session-btn').click();

    // Should have quiz UI elements
    const quizCard = page.locator('.session-quiz-card');
    await expect(quizCard).toBeVisible();
    await expect(quizCard.locator('.question-text')).toBeVisible();
    await expect(quizCard.locator('.quiz-options')).toBeVisible();
    await expect(quizCard.locator('.quiz-option').first()).toBeVisible();
  });

  test('session renders flashcard with flashcard UI', async ({ page, context }) => {
    await setCookie(context, 'se-deck-active', 'true');
    await setCookie(context, 'se-deck', JSON.stringify([{ type: 'flashcard', id: 'git' }]));
    await page.goto(DECK_URL);

    await page.locator('#max-cards').fill('1');
    await page.locator('#start-session-btn').click();

    // Should have flashcard UI elements
    const flashcard = page.locator('.session-flashcard');
    await expect(flashcard).toBeVisible();
    await expect(flashcard.locator('.flashcard-question')).toBeVisible();
    await expect(flashcard.locator('.show-answer-btn')).toBeVisible();
  });

  test('quiz card interaction: answering shows explanation and next', async ({ page, context }) => {
    await setCookie(context, 'se-deck-active', 'true');
    await setCookie(context, 'se-deck', JSON.stringify([{ type: 'quiz', id: 'git' }]));
    await page.goto(DECK_URL);

    await page.locator('#max-cards').fill('2');
    await page.locator('#start-session-btn').click();

    const quizCard = page.locator('.session-quiz-card');
    await expect(quizCard).toBeVisible();
    const type = await quizCard.getAttribute('data-type');

    // Click first option
    await quizCard.locator('.quiz-option').first().click();
    // If multiple choice, need to submit
    if (type === 'multiple') {
      await quizCard.locator('.submit-answer-btn').click();
    }

    // Explanation should appear
    await expect(quizCard.locator('.quiz-explanation')).toBeVisible();
    // Next button should be visible
    await expect(quizCard.locator('.next-btn')).toBeVisible();
  });

  test('flashcard interaction: show answer then assess', async ({ page, context }) => {
    await setCookie(context, 'se-deck-active', 'true');
    await setCookie(context, 'se-deck', JSON.stringify([{ type: 'flashcard', id: 'git' }]));
    await page.goto(DECK_URL);

    await page.locator('#max-cards').fill('1');
    await page.locator('#start-session-btn').click();

    const flashcard = page.locator('.session-flashcard');

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

  test('session completes and shows results', async ({ page, context }) => {
    await setCookie(context, 'se-deck-active', 'true');
    await setCookie(context, 'se-deck', JSON.stringify([{ type: 'flashcard', id: 'git' }]));
    await page.goto(DECK_URL);

    await page.locator('#max-cards').fill('1');
    await page.locator('#start-session-btn').click();

    // Complete the single flashcard
    await page.locator('.show-answer-btn').click();
    await page.locator('.correct-btn').click();

    // Results should appear
    await expect(page.locator('#session-results')).toBeVisible();
    await expect(page.locator('#session-score')).toHaveText('1');
    await expect(page.locator('#session-total')).toHaveText('1');
  });

  test('session results: back to library works', async ({ page, context }) => {
    await setCookie(context, 'se-deck-active', 'true');
    await setCookie(context, 'se-deck', JSON.stringify([{ type: 'flashcard', id: 'git' }]));
    await page.goto(DECK_URL);

    await page.locator('#max-cards').fill('1');
    await page.locator('#start-session-btn').click();
    await page.locator('.show-answer-btn').click();
    await page.locator('.correct-btn').click();

    await page.locator('#session-back-btn').click();
    await expect(page.locator('#deck-library')).toBeVisible();
    await expect(page.locator('#deck-session')).toBeHidden();
  });

  test('session results: review incorrect shows only missed cards', async ({ page, context }) => {
    await setCookie(context, 'se-deck-active', 'true');
    await setCookie(context, 'se-deck', JSON.stringify([{ type: 'flashcard', id: 'git' }]));
    await page.goto(DECK_URL);

    await page.locator('#max-cards').fill('2');
    await page.locator('#start-session-btn').click();

    // Card 1: mark correct
    await page.locator('.show-answer-btn').click();
    await page.locator('.correct-btn').click();

    // Card 2: mark incorrect
    await page.locator('.show-answer-btn').click();
    await page.locator('.incorrect-btn').click();

    // Should see results with review button
    await expect(page.locator('#session-results')).toBeVisible();
    await expect(page.locator('#session-score')).toHaveText('1');
    await expect(page.locator('#session-review-btn')).toBeVisible();

    // Start review
    await page.locator('#session-review-btn').click();

    // Should show a new card (the incorrect one)
    await expect(page.locator('#session-results')).toBeHidden();
    await expect(page.locator('.session-flashcard')).toBeVisible();
  });

  test('session results: restart reshuffles cards', async ({ page, context }) => {
    await setCookie(context, 'se-deck-active', 'true');
    await setCookie(context, 'se-deck', JSON.stringify([{ type: 'flashcard', id: 'git' }]));
    await page.goto(DECK_URL);

    await page.locator('#max-cards').fill('1');
    await page.locator('#start-session-btn').click();
    await page.locator('.show-answer-btn').click();
    await page.locator('.correct-btn').click();

    // Results visible
    await expect(page.locator('#session-results')).toBeVisible();

    // Restart
    await page.locator('#session-restart-btn').click();

    // Session should restart with a card visible
    await expect(page.locator('#session-results')).toBeHidden();
    await expect(page.locator('.session-flashcard')).toBeVisible();
  });

  test('back to library button works during session', async ({ page, context }) => {
    await setCookie(context, 'se-deck-active', 'true');
    await setCookie(context, 'se-deck', JSON.stringify([{ type: 'quiz', id: 'git' }]));
    await page.goto(DECK_URL);

    await page.locator('#start-session-btn').click();
    await expect(page.locator('#deck-session')).toBeVisible();

    await page.locator('#back-to-library-btn').click();
    await expect(page.locator('#deck-library')).toBeVisible();
    await expect(page.locator('#deck-session')).toBeHidden();
  });

  test('max cards limits the number of session cards', async ({ page, context }) => {
    await setCookie(context, 'se-deck-active', 'true');
    await setCookie(context, 'se-deck', JSON.stringify([{ type: 'quiz', id: 'git' }]));
    await page.goto(DECK_URL);

    // Git quiz has many questions; limit to 2
    await page.locator('#max-cards').fill('2');
    await page.locator('#start-session-btn').click();

    // Answer 2 quiz cards, handling both single and multiple choice types
    for (let i = 0; i < 2; i++) {
      const card = page.locator('.session-quiz-card');
      await expect(card).toBeVisible();
      const type = await card.getAttribute('data-type');

      await card.locator('.quiz-option').first().click();
      if (type === 'multiple') {
        await card.locator('.submit-answer-btn').click();
      }
      await card.locator('.next-btn').click();
    }

    // Should show results after 2 cards
    await expect(page.locator('#session-results')).toBeVisible();
    await expect(page.locator('#session-total')).toHaveText('2');
  });
});

// ==================== + BUTTON ON INCLUDES ====================

test.describe('Personal Deck - Toggle Button on Includes', () => {
  test.beforeEach(async ({ page }) => {
    await clearState(page);
  });

  test('+ button is hidden when personal deck is not active', async ({ page }) => {
    await page.goto(GIT_PAGE_URL);
    // The toggle button should exist but be hidden
    const toggleBtn = page.locator('.se-deck-toggle').first();
    await expect(toggleBtn).toBeHidden();
  });

  test('+ button is visible when personal deck is active', async ({ page, context }) => {
    await setCookie(context, 'se-deck-active', 'true');
    await page.goto(GIT_PAGE_URL);
    const toggleBtn = page.locator('.se-deck-toggle').first();
    await expect(toggleBtn).toBeVisible();
  });

  test('+ button toggles to check icon when clicked', async ({ page, context }) => {
    await setCookie(context, 'se-deck-active', 'true');
    await page.goto(GIT_PAGE_URL);

    const toggleBtn = page.locator('.se-deck-toggle').first();
    await expect(toggleBtn.locator('i')).toHaveClass(/fa-plus/);

    await toggleBtn.click();
    await expect(toggleBtn).toHaveClass(/in-deck/);
    await expect(toggleBtn.locator('i')).toHaveClass(/fa-check/);
  });

  test('+ button adds item to cookie deck', async ({ page, context }) => {
    await setCookie(context, 'se-deck-active', 'true');
    await page.goto(GIT_PAGE_URL);

    const toggleBtn = page.locator('.se-deck-toggle').first();
    await toggleBtn.click();

    // Verify cookie was set
    const deck = await page.evaluate(() => {
      var nameEQ = 'se-deck=';
      var ca = document.cookie.split(';');
      for (var i = 0; i < ca.length; i++) {
        var c = ca[i].trim();
        if (c.indexOf(nameEQ) === 0) return JSON.parse(decodeURIComponent(c.substring(nameEQ.length)));
      }
      return [];
    });
    expect(deck.length).toBeGreaterThan(0);
    expect(deck[0].id).toBe('git');
  });

  test('clicking + again removes from deck', async ({ page, context }) => {
    await setCookie(context, 'se-deck-active', 'true');
    await page.goto(GIT_PAGE_URL);

    const toggleBtn = page.locator('.se-deck-toggle').first();
    await toggleBtn.click();
    await expect(toggleBtn).toHaveClass(/in-deck/);

    await toggleBtn.click();
    await expect(toggleBtn).not.toHaveClass(/in-deck/);
    await expect(toggleBtn.locator('i')).toHaveClass(/fa-plus/);
  });
});

// ==================== PERFORMANCE TRACKING ====================

test.describe('Personal Deck - Performance Tracking', () => {
  test.beforeEach(async ({ page }) => {
    await clearState(page);
  });

  test('analyze performance toggle is off by default', async ({ page, context }) => {
    await setCookie(context, 'se-deck-active', 'true');
    await page.goto(DECK_URL);
    await expect(page.locator('#analyzePerformanceToggle')).not.toBeChecked();
  });

  test('analyze performance toggle persists across reload', async ({ page, context }) => {
    await setCookie(context, 'se-deck-active', 'true');
    await page.goto(DECK_URL);

    await page.locator(ANALYZE_TOGGLE_SLIDER).click();
    await page.reload();
    await expect(page.locator('#analyzePerformanceToggle')).toBeChecked();
  });

  test('difficult questions section is hidden when analyze is off', async ({ page, context }) => {
    await setCookie(context, 'se-deck-active', 'true');
    await page.goto(DECK_URL);
    await expect(page.locator('#difficult-deck-section')).toBeHidden();
  });

  test('difficult questions section is hidden when analyze is on but no difficult questions', async ({ page, context }) => {
    await setCookie(context, 'se-deck-active', 'true');
    await setCookie(context, 'analyze-performance', 'true');
    await page.goto(DECK_URL);
    // No stats exist, so no difficult questions
    await expect(page.locator('#difficult-deck-section')).toBeHidden();
  });

  test('difficult questions appear when stats exceed threshold', async ({ page, context }) => {
    await setCookie(context, 'se-deck-active', 'true');
    await setCookie(context, 'analyze-performance', 'true');
    await page.goto(DECK_URL);

    // Inject stats: a question that was answered incorrectly >40% of the time
    // We need to hash a question from the embedded data, so we do it via the page
    await page.evaluate(() => {
      // Get any quiz question from ALL_CARD_DATA
      var quizIds = Object.keys(ALL_CARD_DATA.quizzes);
      var firstQuiz = ALL_CARD_DATA.quizzes[quizIds[0]];
      var question = firstQuiz.questions[0];
      var h = PersonalDeck.hashQuestion(question.question);
      // 10 seen, 3 correct = 70% failure rate
      var stats = {};
      stats[h] = { seen: 10, correct: 3 };
      PersonalDeck.saveStats(stats);
    });

    // Reload to pick up the stats
    await page.reload();

    await expect(page.locator('#difficult-deck-section')).toBeVisible();
    await expect(page.locator('.difficult-heading')).toContainText('Difficult Questions');
  });

  test('difficult deck can be added to session', async ({ page, context }) => {
    await setCookie(context, 'se-deck-active', 'true');
    await setCookie(context, 'analyze-performance', 'true');
    await page.goto(DECK_URL);

    // Inject difficult stats
    await page.evaluate(() => {
      var quizIds = Object.keys(ALL_CARD_DATA.quizzes);
      var firstQuiz = ALL_CARD_DATA.quizzes[quizIds[0]];
      var question = firstQuiz.questions[0];
      var h = PersonalDeck.hashQuestion(question.question);
      var stats = {};
      stats[h] = { seen: 10, correct: 2 };
      PersonalDeck.saveStats(stats);
    });
    await page.reload();

    // Add difficult deck
    await page.locator('#difficult-add-btn').click();
    await expect(page.locator('#difficult-add-btn')).toHaveClass(/in-deck/);

    // Start session should be enabled
    await expect(page.locator('#start-session-btn')).toBeEnabled();
  });

  test('session records performance when analyze is on', async ({ page, context }) => {
    await setCookie(context, 'se-deck-active', 'true');
    await setCookie(context, 'analyze-performance', 'true');
    await setCookie(context, 'se-deck', JSON.stringify([{ type: 'flashcard', id: 'git' }]));
    await page.goto(DECK_URL);

    await page.locator('#max-cards').fill('1');
    await page.locator('#start-session-btn').click();

    // Answer the flashcard incorrectly
    await page.locator('.show-answer-btn').click();
    await page.locator('.incorrect-btn').click();

    // Check that stats were recorded
    const hasStats = await page.evaluate(() => {
      var stats = PersonalDeck.getStats();
      return Object.keys(stats).length > 0;
    });
    expect(hasStats).toBe(true);
  });

  test('deactivating analyze toggle shows confirm modal', async ({ page, context }) => {
    await setCookie(context, 'se-deck-active', 'true');
    await setCookie(context, 'analyze-performance', 'true');
    await page.goto(DECK_URL);

    await expect(page.locator('#analyzePerformanceToggle')).toBeChecked();
    await page.locator(ANALYZE_TOGGLE_SLIDER).click();

    // The #confirm-modal wrapper has 0x0 dimensions (fixed-position children),
    // so check the visible modal box instead
    await expect(page.locator('.confirm-modal-box')).toBeVisible();
    await expect(page.locator('#confirm-modal-msg')).toContainText('delete');
  });

  test('confirm modal "Yes" clears stats and deactivates', async ({ page, context }) => {
    await setCookie(context, 'se-deck-active', 'true');
    await setCookie(context, 'analyze-performance', 'true');
    await page.goto(DECK_URL);

    // Inject some stats
    await page.evaluate(() => {
      PersonalDeck.saveStats({ test: { seen: 5, correct: 1 } });
    });

    await page.locator(ANALYZE_TOGGLE_SLIDER).click();
    await page.locator('#confirm-modal-yes').click();

    // Modal should close
    await expect(page.locator('.confirm-modal-box')).toBeHidden();

    // Toggle should be unchecked
    await expect(page.locator('#analyzePerformanceToggle')).not.toBeChecked();

    // Stats should be cleared
    const statsEmpty = await page.evaluate(() => {
      return Object.keys(PersonalDeck.getStats()).length === 0;
    });
    expect(statsEmpty).toBe(true);
  });

  test('confirm modal "No" keeps toggle on', async ({ page, context }) => {
    await setCookie(context, 'se-deck-active', 'true');
    await setCookie(context, 'analyze-performance', 'true');
    await page.goto(DECK_URL);

    await page.locator(ANALYZE_TOGGLE_SLIDER).click();
    await page.locator('#confirm-modal-no').click();

    // Modal should close
    await expect(page.locator('.confirm-modal-box')).toBeHidden();
    // Toggle should revert to checked
    await expect(page.locator('#analyzePerformanceToggle')).toBeChecked();
  });

  test('questions below 40% failure threshold are NOT in difficult deck', async ({ page, context }) => {
    await setCookie(context, 'se-deck-active', 'true');
    await setCookie(context, 'analyze-performance', 'true');
    await page.goto(DECK_URL);

    // Inject stats: 10 seen, 7 correct = 30% failure rate (below 40% threshold)
    await page.evaluate(() => {
      var quizIds = Object.keys(ALL_CARD_DATA.quizzes);
      var firstQuiz = ALL_CARD_DATA.quizzes[quizIds[0]];
      var question = firstQuiz.questions[0];
      var h = PersonalDeck.hashQuestion(question.question);
      var stats = {};
      stats[h] = { seen: 10, correct: 7 };
      PersonalDeck.saveStats(stats);
    });
    await page.reload();

    // Difficult section should remain hidden (30% failure < 40% threshold)
    await expect(page.locator('#difficult-deck-section')).toBeHidden();
  });

  test('difficult deck deduplicates questions across sets', async ({ page, context }) => {
    await setCookie(context, 'se-deck-active', 'true');
    await setCookie(context, 'analyze-performance', 'true');
    await page.goto(DECK_URL);

    // Inject stats with high failure rate for one question
    const count = await page.evaluate(() => {
      var quizIds = Object.keys(ALL_CARD_DATA.quizzes);
      var firstQuiz = ALL_CARD_DATA.quizzes[quizIds[0]];
      var question = firstQuiz.questions[0];
      var h = PersonalDeck.hashQuestion(question.question);
      var stats = {};
      stats[h] = { seen: 10, correct: 1 };
      PersonalDeck.saveStats(stats);

      // Now get difficult cards count - the same question hash should only appear once
      // even if it's in a meta-deck and base deck
      return document.querySelectorAll('#difficult-deck-section').length; // just to trigger
    });

    await page.reload();

    // The difficult count should show exactly 1 card (not duplicated)
    const difficultCountText = await page.locator('#difficult-count').textContent();
    expect(difficultCountText).toContain('1');
  });
});
