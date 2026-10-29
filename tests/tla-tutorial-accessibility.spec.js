const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { a11yCheckpoint } = require('./a11y-helpers');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const pluscal = yaml.load(fs.readFileSync(path.join(__dirname, '../_data/tutorials/pluscal.yml'), 'utf8'));

const URL = '/SEBook/verification/tla-tutorial';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function openTutorial(page) {
  await page.goto(URL);
  await expect(page.getByRole('button', { name: 'Check every reachable state', exact: true })).toBeEnabled();
}

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  for (const dark of [false, true]) {
    test(`TLA lesson is readable and accessible at ${viewport.width}px in ${dark ? 'dark' : 'light'} mode`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.setViewportSize(viewport);
      await openTutorial(page);
      const theme = page.getByRole('checkbox', { name: 'Toggle dark mode', exact: true });
      await expect(theme).not.toBeChecked();
      if (dark) {
        await theme.focus();
        await page.keyboard.press('Space');
        await expect(theme).toBeChecked();
      }
      const workspace = page.getByRole('region', { name: 'Model checking and exploration', exact: true });
      await expect(workspace).toBeVisible();
      await expect(workspace.getByRole('button', { name: 'Explore one behavior', exact: true })).toBeEnabled();
      await expect(workspace.getByRole('button', { name: 'Check syntax / translate PlusCal', exact: true })).toBeEnabled();

      // These are rendered readability/reflow requirements, independent of CSS structure.
      const dimensions = await workspace.evaluate(element => ({ width: element.clientWidth, scrollWidth: element.scrollWidth }));
      expect(dimensions.scrollWidth, 'model workspace must fit its available width').toBeLessThanOrEqual(dimensions.width + 1);
      for (const control of await workspace.getByRole('button').all()) {
        const size = await control.evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize));
        expect(size, 'model action labels must be paragraph-sized').toBeGreaterThanOrEqual(16);
      }
      const title = page.getByRole('navigation', { name: 'Tutorial navigation' }).getByText('TLA+ and PlusCal', { exact: true });
      await expect(title).toBeVisible();
      const titleSize = await title.evaluate(element => ({ width: element.clientWidth, scrollWidth: element.scrollWidth,
        left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right }));
      expect(titleSize.scrollWidth, 'the tutorial title must not be clipped on narrow screens').toBeLessThanOrEqual(titleSize.width + 1);
      expect(titleSize.left).toBeGreaterThanOrEqual(0);
      expect(titleSize.right, 'the tutorial title must fit inside the viewport').toBeLessThanOrEqual(viewport.width + 1);

      const audit = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      expect(audit.violations).toEqual([]);
      await a11yCheckpoint(page, `tla-page-${viewport.width}-${dark ? 'dark' : 'light'}`);
      expect(errors, 'the real tutorial must load without JavaScript errors').toEqual([]);
    });
  }
}

test('learners can navigate lessons, reveal a hint, and reach model actions using the keyboard', async ({ page }) => {
  await openTutorial(page);
  const secondStep = page.getByRole('button', { name: 'Step 2: An Invariant Counterexample', exact: true });
  await secondStep.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'An Invariant Counterexample', exact: true })).toBeVisible();
  const hint = page.getByText('Hint: inspect the boundary', { exact: true });
  await hint.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Evaluate the guard of', { exact: false })).toBeVisible();

  await page.getByRole('button', { name: 'Check every reachable state', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Explore one behavior', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Check syntax / translate PlusCal', exact: true })).toBeFocused();
  await a11yCheckpoint(page, 'tla-keyboard-hint');
});

test('the print view includes all lessons and their model configurations', async ({ page }) => {
  await page.goto(URL + '/print');
  for (const title of ['States and Transitions', 'An Invariant Counterexample', 'Concurrent Updates in PlusCal', 'Safety, Liveness, and Fairness']) {
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  }
  await expect(page.getByText('CHECK_DEADLOCK FALSE', { exact: false })).not.toHaveCount(0);
  const audit = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(audit.violations).toEqual([]);
  await a11yCheckpoint(page, 'tla-print');
});

test('PlusCal begins with exploration and offers an accessible boundary hint on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/SEBook/verification/pluscal-tutorial');
  await expect(page.getByRole('button', { name: 'Check every reachable state', exact: true })).toBeEnabled();
  await expect(page.getByRole('heading', { name: 'Playlist States', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Test My Work/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Step 2: The Boundary Counterexample', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'The Boundary Counterexample', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Test My Work/ })).toBeVisible();
  const guidance = page.getByText('Make three rows for the guard:', { exact: false });
  await expect(guidance).toBeHidden();
  await page.getByText('Help With the Boundary', { exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(guidance).toBeVisible();
  const audit = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(audit.violations).toEqual([]);
  await a11yCheckpoint(page, 'pluscal-mobile-hint');
});

for (const [key, summary, content] of [
  ['temporal-truth', 'Compare the Four Behaviors', 'Never satisfies neither formula.'],
  ['scoped-evidence', 'Compare Recurrence and Stabilization', 'Alternation satisfies']
]) {
  test(key + ': the comparison stays optional and opens by keyboard', async ({ page }) => {
    await page.goto('/SEBook/verification/pluscal-tutorial#' + key);
    const detail = page.getByText(content, { exact: false });
    await expect(detail).toBeHidden();
    const disclosure = page.getByText(summary, { exact: true });
    await disclosure.focus();
    await page.keyboard.press('Enter');
    await expect(detail).toBeVisible();
    await a11yCheckpoint(page, 'pluscal-disclosure-' + key, { feature: 'pluscal-tutorial' });
    await disclosure.focus();
    await page.keyboard.press('Space');
    await expect(detail).toBeHidden();
  });
}

test('every PlusCal lesson is reachable by keyboard on a narrow screen', async ({ page }) => {
  test.setTimeout(120000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/SEBook/verification/pluscal-tutorial');
  const navigation = page.getByRole('navigation', { name: 'Tutorial navigation' });
  const title = navigation.getByText(pluscal.title, { exact: true });
  await expect(title).toBeVisible();
  const titleSize = await title.evaluate(element => ({ width: element.clientWidth, scrollWidth: element.scrollWidth,
    left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right }));
  expect(titleSize.scrollWidth, 'the tutorial title must remain readable at 320px').toBeLessThanOrEqual(titleSize.width + 1);
  expect(titleSize.left).toBeGreaterThanOrEqual(0);
  expect(titleSize.right).toBeLessThanOrEqual(321);

  for (const [index, step] of pluscal.steps.entries()) {
    const stepButton = page.getByRole('button', { name: 'Step ' + (index + 1) + ': ' + step.title, exact: true });
    await stepButton.focus();
    await page.keyboard.press('Enter');
    await expect(stepButton).toHaveAttribute('aria-current', 'step');
    await expect(page.getByRole('heading', { name: step.title, exact: true })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Step ' + (index + 1) + ' of ' + pluscal.steps.length })).toBeVisible();
    await a11yCheckpoint(page, 'pluscal-' + step.key, { feature: 'pluscal-tutorial' });
  }
  expect(errors, 'all lessons must load without JavaScript errors').toEqual([]);
});

for (const choice of ['skip', 'continue with a low score']) {
  test('PlusCal learners can ' + choice + ' on the optional knowledge check', async ({ page }) => {
    await page.goto('/SEBook/verification/pluscal-tutorial');
    await expect(page.getByRole('heading', { name: pluscal.steps[0].title, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Next →', exact: true }).click();
    await expect(page.getByText('Your score is for feedback. Passing is optional.', { exact: true })).toBeVisible();
    if (choice === 'skip') {
      await page.getByRole('button', { name: 'Skip Knowledge Check', exact: true }).click();
    } else {
      const questions = pluscal.steps[0].quiz.questions;
      for (const [index, question] of questions.entries()) {
        const wrongAnswer = question.options[(question.correct_index + 1) % question.options.length];
        await page.getByRole('radio', { name: wrongAnswer }).check();
        await page.getByRole('button', { name: index + 1 === questions.length ? 'See Results' : 'Next Question', exact: true }).click();
      }
      await expect(page.getByText('You scored 0/2. Review the explanations, try again, or continue when you are ready.', { exact: true })).toBeVisible();
      await a11yCheckpoint(page, 'pluscal-optional-quiz-feedback', { feature: 'pluscal-tutorial' });
      await page.getByRole('button', { name: /Continue to Step 2/ }).click();
    }
    await expect(page.getByRole('heading', { name: pluscal.steps[1].title, exact: true })).toBeVisible();
  });
}

test('the PlusCal print view includes every lesson and its supplied properties', async ({ page }) => {
  await page.goto('/SEBook/verification/pluscal-tutorial/print');
  for (const step of pluscal.steps) {
    await expect(page.getByRole('heading', { name: step.title, exact: true })).toBeVisible();
  }
  await expect(page.getByText('CountWithinLimit', { exact: false })).not.toHaveCount(0);
  const audit = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(audit.violations).toEqual([]);
  await a11yCheckpoint(page, 'pluscal-print');
});
