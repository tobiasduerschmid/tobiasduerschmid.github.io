const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const width of [1440, 320]) {
  for (const dark of [false, true]) {
    test(`AADL tutorial controls reflow at ${width}px in ${dark ? 'dark' : 'light'} mode`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/SEBook/architecture/aadl-tutorial');
      await expect(page.getByLabel('Root implementation', { exact: true })).toBeVisible();
      const stop = page.getByRole('button', { name: 'Stop model update', exact: true });
      await expect(stop).toBeVisible();
      await stop.click();
      await expect(page.getByRole('button', { name: /Analyze model$/ })).toBeEnabled();
      const theme = page.getByRole('checkbox', { name: 'Toggle dark mode', exact: true });
      if (dark) {
        await theme.focus();
        await page.keyboard.press('Space');
        await expect(theme).toBeChecked();
      }
      const root = page.getByLabel('Root implementation', { exact: true });
      await root.focus();
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'Update root', exact: true })).toBeFocused();
      const size = await root.evaluate(element => ({ font: parseFloat(getComputedStyle(element).fontSize), left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right }));
      expect(size.font).toBeGreaterThanOrEqual(16);
      expect(size.left).toBeGreaterThanOrEqual(0);
      expect(size.right).toBeLessThanOrEqual(width + 1);
      const audit = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      expect(audit.violations).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
}

test('AADL print view includes every lesson and prints light from a saved dark theme', async ({ page, context }) => {
  await context.addCookies([{ name: 'dark-mode', value: 'true', domain: '127.0.0.1', path: '/' }]);
  await page.emulateMedia({ media: 'print' });
  await page.goto('/SEBook/architecture/aadl-tutorial/print');
  await expect(page.getByText('Rover_Budget::Loop.budget', { exact: false })).not.toHaveCount(0);
  await expect(page.locator('html')).not.toHaveClass(/dark-mode/);
  const audit = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(audit.violations).toEqual([]);
});
