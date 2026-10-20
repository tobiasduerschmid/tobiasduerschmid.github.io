const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

const pythonDeck = yaml.load(fs.readFileSync(path.resolve(__dirname, '../_data/flashcards/python_syntax_generate.yml'), 'utf8'));

test.use({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });

test('arrow keys scroll a revealed Gym code answer without grading the card', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.install();
  await page.goto('/se-gym/?flashcards=python_syntax_generate');
  await expect(page.getByRole('button', { name: 'Show Answer', exact: true })).toBeVisible();
  // A learner may reveal an answer after every page-load retry has finished.
  await page.clock.runFor(6100);

  let code;
  for (let index = 0; index < pythonDeck.cards.length; index++) {
    await page.getByRole('button', { name: 'Show Answer', exact: true }).click();
    // Code blocks have no named landmark; these classes identify the public
    // answer content, without reaching into the workout's JavaScript state.
    const blocks = page.locator('.flashcard-answer pre');
    const overflowing = await blocks.evaluateAll((elements) => elements.findIndex((element) => element.scrollWidth > element.clientWidth));
    if (overflowing !== -1) {
      code = blocks.nth(overflowing);
      break;
    }
    await page.getByRole('button', { name: 'I got it wrong', exact: true }).click();
  }
  expect(code, 'the Python generation deck must provide a horizontally overflowing code answer').toBeTruthy();
  await expect(code).toHaveAttribute('tabindex', '0');
  const question = page.locator('.flashcard-question');
  const originalQuestion = await question.innerText();
  const correctButton = page.getByRole('button', { name: 'I got it right', exact: true });
  await expect(correctButton).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(code).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => code.evaluate((element) => element.scrollLeft), {
    message: 'ArrowRight must scroll the answer instead of marking it wrong',
  }).toBeGreaterThan(0);
  await expect(question).toHaveText(originalQuestion);
  await expect(correctButton).toBeVisible();
  await expect(code).toBeFocused();

  const audit = await new AxeBuilder({ page })
    .include('.workout-flashcard')
    .withRules(['scrollable-region-focusable'])
    .analyze();
  expect(audit.violations).toEqual([]);
  await page.keyboard.press('Tab');
  await expect(correctButton).toBeFocused();
  expect(errors).toEqual([]);
});
