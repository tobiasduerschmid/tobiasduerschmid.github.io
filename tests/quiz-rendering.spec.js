const { test, expect } = require('@playwright/test');

test.describe('SEBook quiz rendering', () => {
  test('tools composite quiz renders when Parsons answers contain angle-bracket placeholders', async ({ page }) => {
    await page.goto('/SEBook/tools/?noshuffle=1');

    const quiz = page.locator('.quiz-container[data-quiz-id="tools"]');
    await expect(quiz.locator('.quiz-question-card.active')).toHaveCount(1);
    await expect(quiz.locator('.quiz-question-card.active .question-text')).toContainText('massive log file');

    await expect(quiz.locator('bad-commit-hash')).toHaveCount(0);
    await expect(quiz.locator('url')).toHaveCount(0);
    await expect(quiz.locator('.quiz-correct-answers code').filter({ hasText: 'git revert <bad-commit-hash>' })).toHaveCount(1);
    await expect(quiz.locator('.quiz-correct-answers code').filter({ hasText: 'git remote add origin <url>' })).toHaveCount(1);
  });
});
