const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');

const surfaces = [
  ['coding', '/SEBook/tools/cs131-refresher-tutorial.html'],
  ['diagram', '/SEBook/designpatterns/monopoly-state-pattern-uml-homework'],
];

for (const [kind, url] of surfaces) {
  for (const dark of [false, true]) {
    test(`${kind} tutorial keeps its views in browser fullscreen (${dark ? 'dark' : 'light'})`, async ({ page }) => {
      await page.goto(url);
      await page.evaluate(dark => document.documentElement.classList.toggle('dark-mode', dark), dark);
      const bar = page.getByRole('navigation', { name: 'Tutorial navigation' });
      const button = bar.getByRole('button', { name: 'Full screen', exact: true });
      await expect(button).toBeVisible();
      await expect(button).not.toHaveAttribute('aria-keyshortcuts');
      await button.focus();
      await page.keyboard.press('f');
      await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
      if (kind === 'diagram') await page.getByRole('button', { name: 'Add element: Class', exact: true }).press('Enter');
      await button.click();
      await expect.poll(() => page.evaluate(() => document.fullscreenElement === document.documentElement)).toBe(true);
      const exit = bar.getByRole('button', { name: 'Exit full screen', exact: true });
      await expect(exit).toHaveAttribute('aria-pressed', 'true');
      await expect(exit).toBeInViewport({ ratio: 1 });
      await exit.blur();
      await page.mouse.move(0, 0);
      await expect(bar.getByRole('link', { name: 'Print', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /Test My Work/ })).toBeVisible();
      if (kind === 'diagram') {
        await expect(page.getByRole('button', { name: 'Element Class — Enter to select, arrows to nudge, Delete to remove', exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Add element: Class', exact: true }).press('Enter');
        await expect(page.locator('#uml-pg-input')).toHaveValue(/class Class2/);
      } else {
        await expect(page.getByRole('button', { name: 'cs131/param_passing.cpp', exact: true })).toBeVisible();
      }
      await a11yCheckpoint(page, 'tutorial fullscreen navigation', { include: '#navnav' });
      await exit.click();
      await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
      await expect(button).toHaveAttribute('aria-pressed', 'false');
      await button.click();
      await page.evaluate(() => document.exitFullscreen());
      await expect(button).toBeVisible();
      await expect(button).toHaveAttribute('aria-pressed', 'false');
    });
  }
}

test('denied browser fullscreen leaves all tutorial controls usable', async ({ page }) => {
  await page.addInitScript(() => {
    Element.prototype.requestFullscreen = () => Promise.reject(new DOMException('Denied', 'NotAllowedError'));
  });
  await page.goto(surfaces[1][1]);
  const bar = page.getByRole('navigation', { name: 'Tutorial navigation' });
  const button = bar.getByRole('button', { name: 'Full screen', exact: true });
  await button.click();
  await expect(bar.getByRole('status').filter({ hasText: 'could not enter fullscreen' })).toBeVisible();
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Add element: Class', exact: true }).press('Enter');
  await expect(page.locator('#uml-pg-input')).toHaveValue(/class Class/);
});
