// @ts-check
const { test, expect } = require('@playwright/test');

function parseIndices(value) {
  if (!value) return [];
  return value.split(',').map(part => part.trim()).filter(Boolean).map(Number);
}

function activeCard(page) {
  return page.locator('.quiz-question-card.active');
}

async function clickOptionByIndex(card, index) {
  await card.locator(`.quiz-option[data-index="${index}"]`).click();
}

async function clickCorrectSingle(card) {
  const firstOption = card.locator('.quiz-option').first();
  const correct = await firstOption.getAttribute('data-correct');
  expect(correct, 'Single-choice question should expose its correct answer index').toBeTruthy();
  await clickOptionByIndex(card, correct);
}

async function clickIncorrectSingle(card) {
  const firstOption = card.locator('.quiz-option').first();
  const correct = await firstOption.getAttribute('data-correct');
  const options = card.locator('.quiz-option');
  const count = await options.count();

  for (let i = 0; i < count; i++) {
    const option = options.nth(i);
    const index = await option.getAttribute('data-index');
    if (index !== correct) {
      await option.click();
      return index;
    }
  }

  throw new Error('Could not find an incorrect option for single-choice question');
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

async function answerCurrentQuestion(page, options = {}) {
  const card = activeCard(page);
  const type = await card.getAttribute('data-type');
  if (type === 'multiple') {
    await answerVisibleMultipleChoice(card, options.includeOptional);
  } else {
    await clickCorrectSingle(card);
  }
}

async function advanceAnsweredQuestion(page) {
  await activeCard(page).locator('.next-btn').click();
}

test.describe('Interactive Quiz Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/blog/quiz-verification/?noshuffle=1');
  });

  test('Multiple choice question type', async ({ page }) => {
    for (let i = 0; i < 4; i++) {
      await answerCurrentQuestion(page);
      await advanceAnsweredQuestion(page);
    }

    const mcq = activeCard(page);
    await expect(mcq).toHaveAttribute('data-type', 'multiple');
    await expect(mcq).toContainText('Select all that apply');
    
    const submitBtn = mcq.locator('.submit-answer-btn');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeDisabled();

    const required = parseIndices(await mcq.locator('.quiz-option').first().getAttribute('data-correct-indices'));
    expect(required.length, 'Multiple-choice fixture should have required correct answers').toBeGreaterThan(0);

    await clickOptionByIndex(mcq, required[0]);
    await expect(submitBtn).toBeEnabled();
    for (const index of required.slice(1)) {
      await clickOptionByIndex(mcq, index);
    }

    await submitBtn.click();
    
    await expect(submitBtn).toBeHidden();
    await expect(mcq.locator('.quiz-explanation')).toBeVisible();
    await expect(mcq.locator('.quiz-option.selected.correct')).toHaveCount(required.length);
  });

  test('Quiz initialization and basic flow', async ({ page }) => {
    await expect(page.locator('.quiz-header h2')).toHaveText('Review Quiz');

    const firstCard = activeCard(page);
    await clickCorrectSingle(firstCard);
    await expect(firstCard.locator('.quiz-option.correct')).toHaveCount(1);
    await expect(firstCard.locator('.quiz-explanation')).toBeVisible();

    await advanceAnsweredQuestion(page);

    await expect(activeCard(page)).toHaveAttribute('data-question-index', '1');
  });

  test('Handling incorrect answers and review mode', async ({ page }) => {
    await answerCurrentQuestion(page);
    await advanceAnsweredQuestion(page);

    await answerCurrentQuestion(page);
    await advanceAnsweredQuestion(page);

    const missedCard = activeCard(page);
    const missedQuestionIndex = await missedCard.getAttribute('data-question-index');
    await clickIncorrectSingle(missedCard);
    await expect(missedCard.locator('.quiz-option.incorrect')).toHaveCount(1);
    await expect(missedCard.locator('.quiz-option.correct')).toHaveCount(1);
    await advanceAnsweredQuestion(page);

    await answerCurrentQuestion(page);
    await advanceAnsweredQuestion(page);

    await answerCurrentQuestion(page);
    await advanceAnsweredQuestion(page);

    await expect(page.locator('.quiz-results')).toBeVisible();
    await expect(page.locator('.current-score')).toHaveText('4');

    await expect(page.locator('.review-btn')).toBeVisible();
    await page.locator('.review-btn').click();

    // Verify we are back at Question 3 (the incorrect one)
    await expect(activeCard(page)).toHaveAttribute('data-question-index', missedQuestionIndex);
    
    // Verify options are reset in review mode
    await expect(activeCard(page).locator('.quiz-option.incorrect')).toHaveCount(0);
  });

  test('Quiz restart functionality', async ({ page }) => {
    await clickIncorrectSingle(activeCard(page));
    await advanceAnsweredQuestion(page);
    
    for (let i = 0; i < 4; i++) {
      await answerCurrentQuestion(page);
      await advanceAnsweredQuestion(page);
    }

    await page.locator('.restart-btn').click();

    await expect(activeCard(page)).toHaveAttribute('data-question-index', '0');
    await expect(page.locator('.quiz-progress-bar')).toHaveAttribute('aria-valuenow', '0');
  });

  test('Optional indices are accepted when selected in SEBook quizzes', async ({ page }) => {
    await page.goto('/SEBook/userstories/?noshuffle=1');

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
