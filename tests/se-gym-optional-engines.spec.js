const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, contextOptions: { reducedMotion: 'reduce' } });

function selectedQuestion(type, deck, id) {
  return '/se-gym/?plain=true&questions=' + encodeURIComponent(`${type}:${deck}:${id}`);
}

function watchRenderingErrors(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && message.text().startsWith('Could not render question content:')) {
      errors.push(message.text());
    }
  });
  return () => expect(errors, 'lazy question renderers must complete without errors').toEqual([]);
}

test('a selected UML question renders its classes and relationship description', async ({ page }) => {
  const checkErrors = watchRenderingErrors(page);
  await page.goto(selectedQuestion('quiz', 'uml_class_diagram_examples', 1));
  const question = page.locator('#workout-card-area');
  const diagram = question.getByRole('img');
  await expect(diagram).toBeVisible();
  await expect(diagram).toContainText('Customer');
  await expect(diagram).toContainText('Order');
  await expect(diagram).toHaveAccessibleName(/Customer references Order with multiplicity one to zero or more/);

  await question.getByRole('radio', { name: /Association: One Customer can place many Orders/ }).tap();
  await expect(question.getByText('Explanation', { exact: true })).toBeVisible();
  await expect(diagram).toBeVisible();
  await a11yCheckpoint(page, 'lazy UML workout question and feedback', { feature: 'se-gym', include: '#workout-card-area' });
  await question.getByRole('button', { name: 'Next', exact: true }).tap();
  await expect(page.getByText('Score: 1/1', { exact: true })).toBeVisible();
  checkErrors();
});

test('mathematical option feedback is typeset when the learner reveals it', async ({ page }) => {
  const checkErrors = watchRenderingErrors(page);
  await page.goto(selectedQuestion('quiz', 'debugging', 5));
  const question = page.locator('#workout-card-area');
  await question.getByRole('radio', { name: /Manually git checkout each commit/ }).tap();
  const feedback = question.getByRole('note').filter({ hasText: /Linear search through 87 commits/ });
  await expect(feedback).toBeVisible();
  // MathJax's rendered container is its public output, independent of the
  // loader's internals. Visible glyphs plus assistive MathML preserve both views.
  const formula = feedback.locator('mjx-container');
  await expect(formula).toBeVisible();
  await expect(formula.locator('mjx-math')).toBeVisible();
  await expect(formula.locator('mjx-assistive-mml math')).toHaveCount(1);
  await expect(formula.locator('mjx-merror')).toHaveCount(0);
  await expect(feedback).not.toContainText('\\log_2');
  await a11yCheckpoint(page, 'lazy mathematical workout feedback', { feature: 'se-gym', include: '#workout-card-area' });
  await question.getByRole('button', { name: 'Next', exact: true }).tap();
  await expect(page.getByText('Score: 0/1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Restart Workout', exact: true }).tap();
  await question.getByRole('radio', { name: /Manually git checkout each commit/ }).tap();
  await expect(feedback.locator('mjx-container')).toBeVisible();
  checkErrors();
});

test('a lazy write-in question grades output and provides its working explanation trace', async ({ page }) => {
  // The real Python trace starts its browser runtime on the first wrong answer.
  test.setTimeout(150000);
  const checkErrors = watchRenderingErrors(page);
  await page.goto(selectedQuestion('quiz', 'python_output', 'python-output-alias'));
  const question = page.locator('#workout-card-area');
  const answer = question.getByRole('textbox', { name: 'Output (use spaces):', exact: true });
  await expect(question.getByText('A second name remembers the original task list. What lengths are printed?', { exact: true })).toBeVisible();
  await answer.fill('0');
  await question.getByRole('button', { name: 'Submit Answer', exact: true }).tap();
  await expect(question.getByText('Not quite.', { exact: true })).toBeVisible();
  await expect(answer).toHaveAttribute('aria-invalid', 'true');
  const trace = question.getByRole('region', { name: /^Object reference lab:/ });
  await expect(trace).toBeVisible();
  await expect(trace.getByRole('textbox', { name: 'Python code', exact: true })).toHaveValue(/tasks\.append\(8\)/);
  const forward = trace.getByRole('button', { name: 'Forward', exact: true });
  await expect(forward).toBeEnabled({ timeout: 120000 });
  await forward.tap();
  await expect(trace.getByRole('status')).toContainText('Step 2 of');
  await a11yCheckpoint(page, 'lazy write-in workout explanation trace', { feature: 'se-gym', include: '#workout-card-area' });
  await question.getByRole('button', { name: 'Next', exact: true }).last().tap();
  await expect(page.getByText('Score: 0/1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Review Incorrect', exact: true }).tap();
  await answer.fill('2 1');
  await question.getByRole('button', { name: 'Submit Answer', exact: true }).tap();
  await expect(question.getByText('Correct.', { exact: true })).toBeVisible();
  await expect(answer).not.toBeEditable();
  checkErrors();
});
