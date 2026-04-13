// @ts-check
const { test, expect } = require('@playwright/test');

function parseIndices(value) {
  if (!value) return [];
  return value.split(',').map(part => part.trim()).filter(Boolean).map(Number);
}

async function answerVisibleMultipleChoice(card, includeOptional = false) {
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

test.describe('Interactive Quiz Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the verification post
    await page.goto('http://localhost:4000/blog/quiz-verification/?noshuffle=1');
  });

  test('Multiple choice question type', async ({ page }) => {
    // Navigate to the MCQ (it's the 5th question, index 4)
    for (let i = 0; i < 4; i++) {
        await page.locator('.quiz-question-card.active .quiz-option').first().click();
        await page.click('.quiz-question-card.active .next-btn');
    }

    const mcq = page.locator('.quiz-question-card.active');
    await expect(mcq).toContainText('Select all that apply');
    
    // Check for submit button
    const submitBtn = mcq.locator('.submit-answer-btn');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeDisabled();

    // Select options (Correct indices are 0, 1, 2)
    const options = mcq.locator('.quiz-option');
    await options.nth(0).click();
    await expect(submitBtn).toBeEnabled();
    
    await options.nth(1).click();
    await options.nth(2).click();

    // Submit
    await submitBtn.click();
    
    // Check results
    await expect(submitBtn).toBeHidden();
    await expect(mcq.locator('.quiz-explanation')).toBeVisible();
    
    // Verify that selected correct ones have 'correct' class
    await expect(options.nth(0)).toHaveClass(/correct/);
    await expect(options.nth(1)).toHaveClass(/correct/);
    await expect(options.nth(2)).toHaveClass(/correct/);
  });

  test('Quiz initialization and basic flow', async ({ page }) => {
    // 1. Check if quiz title is correct
    await expect(page.locator('.quiz-header h3')).toHaveText('Review Quiz');

    // 2. Answer first question correctly
    // Question 1 correct answer is index 1 ("Using external tools...")
    await page.locator('.quiz-question-card.active .quiz-option').nth(1).click();
    await expect(page.locator('.quiz-question-card.active .quiz-option').nth(1)).toHaveClass(/correct/);
    await expect(page.locator('.quiz-question-card.active .quiz-explanation')).not.toHaveClass(/hidden/);

    // 3. Move to next question
    await page.click('.quiz-question-card.active .next-btn');

    // 4. Verify second question text
    await expect(page.locator('.quiz-question-card.active .question-text')).toContainText('benefits more from using AI');
  });

  test('Handling incorrect answers and review mode', async ({ page }) => {
    // Question 1: Correct (index 1)
    await page.locator('.quiz-question-card.active .quiz-option').nth(1).click();
    await page.click('.quiz-question-card.active .next-btn');

    // Question 2: Correct (index 2)
    await page.locator('.quiz-question-card.active .quiz-option').nth(2).click();
    await page.click('.quiz-question-card.active .next-btn');

    // Question 3: INCORRECT (index 0, correct is 1)
    await page.locator('.quiz-question-card.active .quiz-option').nth(0).click();
    await expect(page.locator('.quiz-question-card.active .quiz-option').nth(0)).toHaveClass(/incorrect/);
    await expect(page.locator('.quiz-question-card.active .quiz-option').nth(1)).toHaveClass(/correct/);
    await page.click('.quiz-question-card.active .next-btn');

    // Question 4: Correct (index 1)
    await page.locator('.quiz-question-card.active .quiz-option').nth(1).click();
    await page.click('.quiz-question-card.active .next-btn');

    // Question 5 (MCQ): Correct (indices 0, 1, 2)
    await page.locator('.quiz-question-card.active .quiz-option').nth(0).click();
    await page.locator('.quiz-question-card.active .quiz-option').nth(1).click();
    await page.locator('.quiz-question-card.active .quiz-option').nth(2).click();
    await page.click('.quiz-question-card.active .submit-answer-btn');
    await page.click('.quiz-question-card.active .next-btn');

    // Verify Results page
    await expect(page.locator('.quiz-results')).not.toHaveClass(/hidden/);
    await expect(page.locator('.current-score')).toHaveText('4');

    // Verify Review button appears
    await expect(page.locator('.review-btn')).toBeVisible();

    // Start Review
    await page.click('.review-btn');

    // Verify we are back at Question 3 (the incorrect one)
    await expect(page.locator('.quiz-question-card.active .question-text')).toContainText('CS student');
    
    // Verify options are reset in review mode
    await expect(page.locator('.quiz-question-card.active .quiz-option').nth(0)).not.toHaveClass(/incorrect/);
  });

  test('Quiz restart functionality', async ({ page }) => {
    // Answer first question
    await page.locator('.quiz-question-card.active .quiz-option').nth(0).click();
    await page.click('.quiz-question-card.active .next-btn');
    
    // Quick skip to the end (need to answer 4 more questions)
    for (let i = 0; i < 4; i++) {
        const card = page.locator('.quiz-question-card.active');
        const type = await card.getAttribute('data-type');
        
        await card.locator('.quiz-option').first().click();
        if (type === 'multiple') {
            await card.locator('.submit-answer-btn').click();
        }
        await card.locator('.next-btn').click();
    }

    await page.click('.restart-btn');

    // Verify we are back at Question 1
    await expect(page.locator('.quiz-question-card.active .question-text')).toContainText('cognitive offloading');
    await expect(page.locator('.progress-fill')).toHaveAttribute('style', 'width: 0%;');
  });

  test('Optional indices are accepted when selected in SEBook quizzes', async ({ page }) => {
    await page.goto('http://localhost:4000/SEBook/userstories/?noshuffle=1');

    for (let i = 0; i < 4; i++) {
      const card = page.locator('.quiz-question-card.active');
      await answerVisibleMultipleChoice(card);
      await card.locator('.next-btn').click();
    }

    const finalCard = page.locator('.quiz-question-card.active');
    await expect(finalCard).toContainText('homepage to load blazing fast');
    await answerVisibleMultipleChoice(finalCard, true);

    await expect(finalCard.locator('.quiz-option.selected.incorrect')).toHaveCount(0);
    await finalCard.locator('.next-btn').click();

    await expect(page.locator('.quiz-results:not(.hidden)')).toBeVisible();
    await expect(page.locator('.quiz-results:not(.hidden) .current-score')).toHaveText('5');
  });
});
