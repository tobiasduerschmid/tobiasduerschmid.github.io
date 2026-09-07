const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');

const URL = '/SEBook/tools/cs131-refresher-tutorial.html';
test.describe.configure({ timeout: 150_000 });

test.beforeEach(async ({ page }) => {
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: /^Next →$/ })).toBeVisible({ timeout: 120_000 });
  await expect(page.getByRole('button', { name: /^Next →$/ })).toBeEnabled({ timeout: 120_000 });
});

test('keyboard navigation never puts tutorial controls behind departed tooltips', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const targets = [
    page.getByRole('button', { name: 'Open instructions in separate window' }),
    page.getByRole('button', { name: 'cs131/param_passing.cpp', exact: true }),
    page.getByRole('button', { name: 'Open cs131/param_passing.cpp in a separate window', exact: true }),
  ];

  // Freeze timers after boot to represent rapid keyboard navigation. The
  // assertion concerns visibility when focus arrives, not a grace-period size.
  const clockStart = new Date('2026-09-07T20:00:00Z');
  await page.clock.install({ time: clockStart });
  await page.clock.pauseAt(new Date(clockStart.getTime() + 1000));
  await page.getByRole('link', { name: 'Reset Current Step', exact: true }).focus();
  const checked = new Set();
  for (let stop = 0; stop < 30 && checked.size < targets.length; stop++) {
    await page.keyboard.press('Tab');
    for (let index = 0; index < targets.length; index++) {
      if (!await targets[index].evaluate((element) => element === document.activeElement)) continue;
      const visible = await targets[index].evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return [rect.left + 2, rect.left + rect.width / 2, rect.right - 2].some((x) =>
          [rect.top + 2, rect.top + rect.height / 2, rect.bottom - 2].some((y) => {
            const top = document.elementFromPoint(x, y);
            return top && (top === element || element.contains(top));
          }));
      });
      expect(visible, 'the focused tutorial control must not be fully covered by a departing tooltip').toBe(true);
      checked.add(index);
    }
  }
  expect(checked.size, 'keyboard navigation should reach all three previously obscured controls').toBe(targets.length);
  await page.clock.resume();
  expect(errors).toEqual([]);
});

test('tutorial tooltips remain hoverable and dismiss with Escape', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Open instructions in separate window' });
  const tooltip = page.getByRole('tooltip').filter({ hasText: 'Open instructions in separate window' });
  await trigger.focus();
  await expect(tooltip).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tooltip).toBeHidden();
  await expect(trigger).toBeFocused();

  // Move the pointer from the trigger into the revealed tooltip, then move
  // keyboard focus away while the pointer is still reading that tooltip.
  await page.getByRole('link', { name: 'Print', exact: true }).focus();
  await trigger.hover();
  await expect(tooltip).toBeVisible();
  await trigger.focus();
  await tooltip.hover();
  await page.getByRole('link', { name: 'Print', exact: true }).focus();
  await expect(tooltip).toBeVisible();
  await a11yCheckpoint(page, 'tutorial tooltip remains available to the pointer', { feature: 'tooltips', include: '.tooltip' });
  await page.mouse.move(0, 0);
  await expect(tooltip).toBeHidden();
});
