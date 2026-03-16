// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Interactive Quiz Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the verification post
    await page.goto('http://localhost:4000/blog/quiz-verification/');
  });

  test('Quiz initialization and basic flow', async ({ page }) => {
    // 1. Check if quiz title is correct
    await expect(page.locator('.quiz-header h3')).toHaveText('AI & Learning Fundamentals');

    // 2. Answer first question correctly
    // Question 1 correct answer is index 1 ("Using external tools...")
    await page.locator('.quiz-option').nth(1).click();
    await expect(page.locator('.quiz-option').nth(1)).toHaveClass(/correct/);
    await expect(page.locator('.quiz-explanation')).not.toHaveClass(/hidden/);

    // 3. Move to next question
    await page.click('.next-btn');

    // 4. Verify second question text (just to be sure we progressed)
    await expect(page.locator('.quiz-question-card.active .question-text')).toContainText('benefit more from using AI');
  });

  test('Handling incorrect answers and review mode', async ({ page }) => {
    // Question 1: Correct (index 1)
    await page.locator('.quiz-option').nth(1).click();
    await page.click('.next-btn');

    // Question 2: Correct (index 2)
    await page.locator('.quiz-question-card.active .quiz-option').nth(2).click();
    await page.click('.next-btn');

    // Question 3: INCORRECT (index 0, correct is 1)
    await page.locator('.quiz-question-card.active .quiz-option').nth(0).click();
    await expect(page.locator('.quiz-question-card.active .quiz-option').nth(0)).toHaveClass(/incorrect/);
    await expect(page.locator('.quiz-question-card.active .quiz-option').nth(1)).toHaveClass(/correct/);
    await page.click('.next-btn');

    // Question 4: Correct (index 1)
    await page.locator('.quiz-question-card.active .quiz-option').nth(1).click();
    await page.click('.next-btn');

    // Verify Results page
    await expect(page.locator('.quiz-results')).not.toHaveClass(/hidden/);
    await expect(page.locator('.current-score')).toHaveText('3');

    // Verify Review button appears
    await expect(page.locator('.review-btn')).toBeVisible();

    // Start Review
    await page.click('.review-btn');

    // Verify we are back at Question 3 (the incorrect one)
    await expect(page.locator('.quiz-question-card.active .question-text')).toContainText('Beneficial Offloading');
    
    // Verify options are reset in review mode
    await expect(page.locator('.quiz-question-card.active .quiz-option').nth(0)).not.toHaveClass(/incorrect/);
  });

  test('Quiz restart functionality', async ({ page }) => {
    // Answer first question
    await page.locator('.quiz-option').nth(0).click();
    await page.click('.next-btn');
    
    // Quick skip to the end (mocking is easier if we had more control, but we'll just fast forward)
    // Actually, we can just test the restart button if we reach the end
    // For brevity, let's just finish it
    for (let i = 0; i < 3; i++) {
        await page.locator('.quiz-question-card.active .quiz-option').first().click();
        await page.click('.next-btn');
    }

    await page.click('.restart-btn');

    // Verify we are back at Question 1
    await expect(page.locator('.quiz-question-card.active .question-text')).toContainText('cognitive offloading');
    await expect(page.locator('.progress-fill')).toHaveAttribute('style', 'width: 0%');
  });
});
