const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');

test.use({ reducedMotion: 'reduce' });

test('restarting chapter flashcards resets each answer disclosure to collapsed', async ({ page }) => {
  await page.goto('/SEBook/designpatterns/singleton.html');
  const deck = page.getByRole('region', { name: 'Singleton Pattern Flashcards flashcards', exact: true });
  const cardCount = await deck.getByRole('button', { name: 'Show Answer', exact: true, includeHidden: true }).count();
  expect(cardCount).toBeGreaterThan(0);

  for (let round = 0; round < 2; round++) {
    for (let card = 0; card < cardCount; card++) {
      const reveal = deck.getByRole('button', { name: 'Show Answer', exact: true });
      await expect(reveal).toHaveAttribute('aria-expanded', 'false');
      await reveal.click();
      await expect(deck.getByRole('group', { name: 'Did you get it right?', exact: true })).toBeVisible();
      await deck.getByRole('button', { name: 'I got it right', exact: true }).click();
    }
    await expect(deck.getByText(`Your Score: ${cardCount}/${cardCount}`, { exact: true })).toBeVisible();
    if (round === 0) {
      await deck.getByRole('button', { name: 'Restart Workout', exact: true }).click();
      await a11yCheckpoint(page, 'restarted chapter flashcards', {
        feature: 'review-analysis-robustness', include: '.flashcards-container', darkMode: true,
      });
    }
  }
});
