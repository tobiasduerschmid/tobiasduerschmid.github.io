const { test, expect } = require('@playwright/test');
test.setTimeout(120000);

test('instruction separator reports its responsive pane size after narrow startup', async ({ page }) => {
  await page.setViewportSize({ width: 769, height: 1000 });
  await page.goto('/SEBook/tools/smalltalk-tutorial');
  await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled({ timeout: 90000 });
  await page.setViewportSize({ width: 1600, height: 1000 });
  const separator = page.getByRole('separator', { name: 'Resize editor panes', exact: true });
  await expect(separator).toBeVisible();
  await expect(separator).toHaveAttribute('aria-valuenow', '30');

  await separator.focus();
  await separator.press('ArrowRight');
  const resized = Number(await separator.getAttribute('aria-valuenow'));
  expect(resized).toBeGreaterThan(30);
  await page.setViewportSize({ width: 1120, height: 1000 });
  await expect.poll(async () => Number(await separator.getAttribute('aria-valuenow')), {
    message: 'An explicitly sized instruction pane occupies a greater percentage of a narrower desktop layout',
  }).toBeGreaterThan(resized);
  await expect(separator).toBeFocused();
});
