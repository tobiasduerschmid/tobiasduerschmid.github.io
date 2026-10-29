const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { a11yCheckpoint } = require('./a11y-helpers');

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

test('the beginner PlusCal lesson offers property feedback and accessible hints on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/SEBook/verification/pluscal-tutorial');
  await expect(page.getByRole('button', { name: 'Check every reachable state', exact: true })).toBeEnabled();
  await expect(page.getByRole('heading', { name: 'A Counter That Stops at Two', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Test My Work/ })).toBeVisible();
  await page.getByRole('button', { name: 'Step 2: One Extra Iteration', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'One Extra Iteration', exact: true })).toBeVisible();
  await page.getByText('Hint: try the boundary value', { exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('When', { exact: false }).filter({ hasText: 'should the loop run once more?' })).toBeVisible();
  const audit = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(audit.violations).toEqual([]);
  await a11yCheckpoint(page, 'pluscal-mobile-hint');
});

test('the beginner PlusCal print view preserves the worked example and repair exercise', async ({ page }) => {
  await page.goto('/SEBook/verification/pluscal-tutorial/print');
  await expect(page.getByRole('heading', { name: 'A Counter That Stops at Two', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'One Extra Iteration', exact: true })).toBeVisible();
  await expect(page.getByText('CountWithinLimit', { exact: false })).not.toHaveCount(0);
  const audit = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(audit.violations).toEqual([]);
  await a11yCheckpoint(page, 'pluscal-print');
});
