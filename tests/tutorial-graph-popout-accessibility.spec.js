// @ts-check
const { test, expect } = require('@playwright/test');

test('graph popout exposes its scroll region only after graph content arrives', async ({ page }) => {
  await page.goto('/tutorial-graph-popup.html?channel=graph-accessibility-test&session=graph-session&title=Graph');
  const graph = page.getByRole('region', { name: 'Git graph' });
  const host = page.locator('.graph-host');

  await expect(host).toHaveAttribute('inert', '');
  await expect(graph).toHaveCount(0);
  await page.keyboard.press('Tab');
  await expect(host).not.toBeFocused();

  await page.evaluate(() => {
    const channel = new BroadcastChannel('graph-accessibility-test');
    channel.postMessage({
      type: 'graph-snapshot',
      sessionId: 'graph-session',
      sourceId: 'tutorial-parent',
      html: '<svg role="img" aria-label="Commit graph" width="800" height="1000"></svg>',
    });
    channel.close();
  });

  await expect(host).not.toHaveAttribute('inert');
  await expect(graph).toBeVisible();
  await expect(page.locator('#overlayEl')).toBeHidden();
  await page.keyboard.press('Tab');
  await expect(host).toBeFocused();
});
