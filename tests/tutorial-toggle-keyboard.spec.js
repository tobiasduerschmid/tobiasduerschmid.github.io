// @ts-check
const { test, expect } = require('@playwright/test');

const TUTORIAL = '/SEBook/designpatterns/observer-tutorial.html?autosave=true';

async function tabTo(page, id) {
  for (let press = 0; press < 16; press += 1) {
    await page.keyboard.press('Tab');
    if (await page.evaluate((targetId) => document.activeElement?.id === targetId, id)) return;
  }
  throw new Error(`${id} was not reachable by keyboard Tab`);
}

async function focusRingContrast(page, labelId) {
  return page.evaluate((id) => {
    const track = document.querySelector(`#${id} .tvm-dark-toggle-track`);
    const nav = document.querySelector('#navnav');
    const luminance = (color) => {
      const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number);
      const linear = rgb.map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
    };
    const ring = luminance(getComputedStyle(track).outlineColor);
    const background = luminance(getComputedStyle(nav).backgroundColor);
    return (Math.max(ring, background) + 0.05) / (Math.min(ring, background) + 0.05);
  }, labelId);
}

test('auto-save switch can be disabled with Space and No keeps saved progress', async ({ page }) => {
  await page.goto(TUTORIAL);
  const toggle = page.getByRole('checkbox', { name: 'Auto-save' });
  await expect(toggle).toBeVisible();
  await expect(toggle).toBeChecked();
  await page.waitForFunction(() => window._tutorial?.currentStep >= 0);
  const savedKey = await page.evaluate(() => {
    const tutorial = window._tutorial;
    if (!tutorial.saveProgress()) throw new Error('Could not prepare saved tutorial progress');
    return tutorial._storageKey();
  });
  expect(await page.evaluate((key) => localStorage.getItem(key), savedKey)).not.toBeNull();

  await tabTo(page, 'autoSaveToggle');
  await expect(toggle).toBeFocused();
  await expect(page.locator('#autoSaveLabel .tvm-dark-toggle-track')).toHaveCSS('outline-style', 'solid');
  expect(await focusRingContrast(page, 'autoSaveLabel')).toBeGreaterThanOrEqual(3);

  await page.keyboard.press('Space');
  const confirmation = page.getByRole('dialog', { name: 'Delete saved progress?' });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'No' }).click();
  await expect(confirmation).toBeHidden();
  await expect(toggle).not.toBeChecked();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('tutorial-autosave'))).toBe('false');
  expect(await page.evaluate((key) => localStorage.getItem(key), savedKey)).not.toBeNull();
  await expect(toggle).toBeFocused();
});

test('dark-mode switch can be reached by Tab and changed with Space', async ({ page }) => {
  await page.goto(TUTORIAL);
  const toggle = page.getByRole('checkbox', { name: 'Toggle dark mode' });
  await expect(toggle).toBeVisible();
  const initialTheme = await page.locator('html').evaluate((html) => html.classList.contains('dark-mode'));

  await tabTo(page, 'darkModeToggle');
  await expect(toggle).toBeFocused();
  await expect(page.locator('#darkModeLabel .tvm-dark-toggle-track')).toHaveCSS('outline-style', 'solid');
  expect(await focusRingContrast(page, 'darkModeLabel')).toBeGreaterThanOrEqual(3);
  await page.keyboard.press('Space');
  await expect(toggle).toBeChecked({ checked: !initialTheme });
  await expect.poll(() => page.locator('html').evaluate((html) => html.classList.contains('dark-mode')))
    .toBe(!initialTheme);
  expect(await focusRingContrast(page, 'darkModeLabel')).toBeGreaterThanOrEqual(3);
});
