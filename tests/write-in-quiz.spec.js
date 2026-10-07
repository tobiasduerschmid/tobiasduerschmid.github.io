// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { auditInteractiveState } = require('./a11y-helpers');
const load = id => yaml.load(fs.readFileSync(path.join(__dirname, '../_data/quizzes', id + '.yml'), 'utf8'));
const python = load('python_output');
const shell = load('shell_output');
const active = quiz => quiz.locator('.quiz-question-card.active');
const input = card => card.getByRole('textbox', { name: 'Output (use spaces):', exact: true });
const check = card => card.getByRole('button', { name: 'Submit Answer', exact: true });

test.use({ reducedMotion: 'reduce' });
test.setTimeout(150_000);

test('embedded Python output questions require text, accept whitespace, score once, and restart cleanly', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/SEBook/tools/python.html?noshuffle=1');
  const quiz = page.getByRole('region', { name: python.title + ' quiz', exact: true });
  await expect(check(active(quiz))).toBeDisabled();
  await input(active(quiz)).fill('   ');
  await input(active(quiz)).press('Enter');
  await expect(active(quiz).getByText('Explanation:', { exact: true })).toBeHidden();
  await expect(quiz.getByRole('radio')).toHaveCount(0);
  for (const question of python.questions) {
    const card = active(quiz);
    await expect(card.getByText(question.question, { exact: true })).toBeVisible();
    await input(card).fill('  ' + question.answer.replace(/ /g, '   ') + '  ');
    await input(card).press('Enter');
    await expect(card.getByText('Correct.', { exact: true })).toBeVisible();
    await expect(input(card)).not.toBeEditable();
    await expect(check(card)).toBeHidden();
    await expect(card.getByRole('region', { name: /^Object reference lab:/ })).toHaveCount(0);
    await card.getByRole('button', { name: 'Next Question', exact: true }).click();
  }
  await expect(quiz.getByText('Your Score: 6/6', { exact: true })).toBeVisible();
  await quiz.getByRole('button', { name: 'Restart Workout', exact: true }).click();
  await expect(input(active(quiz))).toHaveValue('');
  await expect(check(active(quiz))).toBeDisabled();
  expect(errors).toEqual([]);
});

test('shell output feedback, review, and print preserve quiz scoring and answer state', async ({ page }) => {
  await page.goto('/SEBook/tools/shell.html?noshuffle=1');
  const quiz = page.getByRole('region', { name: shell.title + ' quiz', exact: true });
  await input(active(quiz)).fill('2 1');
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await page.emulateMedia({ media: 'print' });
  await expect(quiz.getByText('Explanation:', { exact: true })).toHaveCount(6);
  await expect(quiz.locator('.unix-lab__notice').first()).toBeVisible();
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(input(active(quiz))).toBeEditable();
  await expect(input(active(quiz))).toHaveValue('2 1');
  for (const [index, question] of shell.questions.entries()) {
    const card = active(quiz);
    await input(card).fill(index === 0 ? '21' : question.answer);
    await check(card).click();
    if (index === 0) {
      await expect(card.getByText('Not quite.', { exact: true })).toBeVisible();
      await expect(input(card)).toHaveAttribute('aria-invalid', 'true');
    }
    await card.getByRole('button', { name: 'Next Question', exact: true }).click();
  }
  await expect(quiz.getByText('Your Score: 5/6', { exact: true })).toBeVisible();
  await quiz.getByRole('button', { name: 'Review Incorrect Questions', exact: true }).click();
  await expect(input(active(quiz))).toHaveValue('');
  await input(active(quiz)).fill(shell.questions[0].answer);
  await check(active(quiz)).click();
  await active(quiz).getByRole('button', { name: 'Next Question', exact: true }).click();
  await expect(quiz.getByText('Your Score: 6/6', { exact: true })).toBeVisible();
});

for (const width of [320, 390]) {
  test(`mobile ${width}px: SE Gym write-in answers use the real output without option shortcuts`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/se-gym/?plain=true&quiz=shell_output');
    for (let index = 0; index < shell.questions.length; index++) {
      const card = page.locator('.workout-quiz-card[data-type="write-in"]');
      await expect(input(card)).toBeVisible();
      const questionText = (await card.locator('.question-text').innerText()).trim();
      const question = shell.questions.find(q => q.question === questionText);
      expect(question).toBeTruthy();
      await expect(input(card)).toHaveAttribute('autocapitalize', 'off');
      const box = await input(card).boundingBox();
      const source = await card.locator('.program-lab__source').boundingBox();
      expect(await card.locator('.program-lab__source').evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      expect(source.y + source.height).toBeLessThan(box.y);
      expect(source.width).toBeGreaterThan(box.width * 0.85);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await input(card).pressSequentially(question.answer);
      await input(card).press('Enter');
      await expect(card.getByText('Correct.', { exact: true })).toBeVisible();
      if (index === 0 && width === 320) await auditInteractiveState(page, 'Mobile write-in answer feedback', { include: '.workout-quiz-card' });
      await card.getByRole('button', { name: 'Next', exact: true }).click();
    }
    await expect(page.getByText('Score: 6/6', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Restart Workout', exact: true }).click();
    await expect(input(page.locator('.workout-quiz-card[data-type="write-in"]'))).toHaveValue('');
    expect(errors).toEqual([]);
  });
}

for (const viewport of [{ width: 320, height: 667 }, { width: 390, height: 844 }]) {
  test(`normal Gym fits Python source and submission on a ${viewport.width}px phone`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/se-gym/?quiz=python_output');
    const card = page.locator('.workout-quiz-card[data-type="write-in"]');
    for (let index = 0; index < python.questions.length; index++) {
      await expect(check(card)).toBeVisible();
      const source = card.locator('.program-lab__source');
      await expect(source).toBeInViewport({ ratio: 1 });
      await expect(check(card)).toBeInViewport({ ratio: 1 });
      const sourceBox = await source.boundingBox();
      expect(await source.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      const submitBox = await check(card).boundingBox();
      expect(sourceBox.y).toBeGreaterThanOrEqual(0);
      expect(submitBox.y + submitBox.height).toBeLessThanOrEqual(viewport.height);
      expect(await source.evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
      const text = (await card.locator('.question-text').innerText()).trim();
      const question = python.questions.find(q => q.question === text);
      await input(card).fill(question.answer);
      await check(card).click();
      await expect(card.getByText('Correct.', { exact: true })).toBeVisible();
      await card.getByRole('button', { name: 'Next', exact: true }).click();
    }
  });
}

test('an incorrect Python write-in answer offers its exact trace inside the explanation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/se-gym/?plain=true&quiz=python_output');
  const card = page.locator('.workout-quiz-card[data-type="write-in"]');
  const questionText = (await card.locator('.question-text').innerText()).trim();
  const question = python.questions.find(q => q.question === questionText);
  await input(card).fill('0');
  await check(card).click();
  const explanation = card.getByText('Explanation:', { exact: true }).locator('..');
  const lab = explanation.getByRole('region', { name: /^Object reference lab:/ });
  await expect(lab.getByText(/^Compare each step with your prediction/)).toBeHidden();
  await expect(lab.getByText(/^Use Forward and Back/)).toBeHidden();
  await expect(lab.getByText(/^Each box is one object/)).toBeHidden();
  await expect(lab.getByText('Explain the prepared example', { exact: true })).toBeHidden();
  const next = explanation.getByRole('button', { name: 'Next', exact: true });
  await expect(next).toHaveCount(2);
  await expect(lab.getByRole('textbox', { name: 'Python code', exact: true })).toHaveValue(question.program.code.trimEnd());
  await expect(lab.getByRole('button', { name: 'Forward', exact: true })).toBeEnabled({ timeout: 120_000 });
  await lab.getByRole('button', { name: 'Forward', exact: true }).click();
  await expect(lab.getByRole('status')).toContainText('Step 2 of');
  const traceBox = await lab.boundingBox();
  const beforeBox = await next.first().boundingBox();
  const afterBox = await next.last().boundingBox();
  expect(beforeBox.y + beforeBox.height).toBeLessThanOrEqual(traceBox.y);
  expect(afterBox.y).toBeGreaterThanOrEqual(traceBox.y + traceBox.height);
  await auditInteractiveState(page, 'Mobile incorrect Python write-in trace', { include: '.workout-quiz-card' });
  await next.last().click();
  await expect(page.getByRole('region', { name: /^Object reference lab:/ })).toHaveCount(0);
});

test('SE Gym saves write-in progress, tracks performance, and reviews missed answers', async ({ page }) => {
  await page.goto('/se-gym/');
  const activation = page.getByRole('checkbox', { name: 'Toggle personal gym activation' });
  await activation.focus();
  await activation.press('Space');
  const analysis = page.getByRole('checkbox', { name: 'Toggle performance analysis' });
  if (!(await analysis.isChecked())) {
    await analysis.focus();
    await analysis.press('Space');
  }
  await page.getByRole('button', { name: 'Start targeted practice for Shell Output Puzzles', exact: true }).click();
  const card = page.locator('.workout-quiz-card[data-type="write-in"]');
  let missedQuestion;
  for (let index = 0; index < shell.questions.length; index++) {
    const text = (await card.locator('.question-text').innerText()).trim();
    const question = shell.questions.find(q => q.question === text);
    if (index === 0) missedQuestion = question;
    await input(card).fill(index === 0 ? '0' : question.answer);
    await check(card).click();
    await card.getByRole('button', { name: 'Next', exact: true }).click();
    if (index === 1) {
      const upcoming = await card.locator('.question-text').innerText();
      await page.getByRole('button', { name: 'Back to Gym Entrance', exact: true }).click();
      await expect(page.getByRole('status').filter({ hasText: 'Saved workout:' })).toHaveText('Saved workout: 2 of 6 completed.');
      await page.reload();
      await page.getByRole('button', { name: 'Resume Saved Workout', exact: true }).click();
      await expect(card.locator('.question-text')).toHaveText(upcoming);
    }
  }
  await expect(page.getByText('Score: 5/6', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Review Incorrect', exact: true }).click();
  await expect(card.locator('.question-text')).toHaveText(missedQuestion.question);
  await expect(input(card)).toHaveValue('');
  await input(card).fill(missedQuestion.answer);
  await check(card).click();
  await card.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Score: 6/6', { exact: true })).toBeVisible();
  // Public statistics contract: one recorded attempt per submission, including review.
  const stats = await page.evaluate(() => window.PersonalGym.getStats());
  const attempts = Object.entries(stats).filter(([key]) => key.startsWith('quiz:shell_output:'));
  expect(attempts).toHaveLength(6);
  expect(attempts.reduce((sum, [, value]) => sum + value.seen, 0)).toBe(7);
  expect(attempts.reduce((sum, [, value]) => sum + value.correct, 0)).toBe(6);
});

test('the CS35L chapter renders both new decks inside its existing master quiz', async ({ page }) => {
  await page.goto('/SEBook/CS35L.html?noshuffle=1');
  const quiz = page.getByRole('region', { name: 'Current CS 35L Quizzes quiz', exact: true });
  await expect(quiz.locator('[data-type="write-in"]')).toHaveCount(12);
  // Loaded once even when a page includes several related decks.
  await expect(page.locator('script[src$="/js/quiz-write-in.js"]')).toHaveCount(1);
});

for (const enabled of [true, false]) {
  test(`write-in answers use Gym confetti and respect its preference (${enabled})`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'more-confetti', value: String(enabled), url: baseURL }]);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/se-gym/?plain=true&quiz=shell_output');
    const card = page.locator('.workout-quiz-card[data-type="write-in"]');
    const text = (await card.locator('.question-text').innerText()).trim();
    const question = shell.questions.find(q => q.question === text);
    await input(card).fill(question.answer);
    await check(card).click();
    await expect(card.getByText('Correct.', { exact: true })).toBeVisible();
    if (enabled) await expect.poll(() => page.locator('.site-confetti-piece').count()).toBeGreaterThan(0);
    else await expect(page.locator('.site-confetti-piece')).toHaveCount(0);
    await expect(page.locator('.unix-lab__confetti-piece')).toHaveCount(0);
  });
}
