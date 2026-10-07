// @ts-check
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');

async function openCustomizer(page, context) {
  await context.addCookies([{ name: 'se-gym-active', value: 'true', domain: '127.0.0.1', path: '/' }]);
  await page.goto('/se-gym/');
  await page.getByRole('button', { name: 'Customize Hero', exact: true }).click();
  return page.getByRole('dialog', { name: 'Customize your hero' });
}

for (const width of [1280, 320]) {
  test(`Prof offers a fixed appearance and restores editable heroes at ${width}px`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 900 });
    const dialog = await openCustomizer(page, context);
    await dialog.getByLabel('Hero type', { exact: true }).selectOption('human');
    await dialog.getByLabel('Hair style', { exact: true }).selectOption('short');
    const tobias = dialog.getByRole('button', { name: 'Choose Hero type: Prof', exact: true });
    await tobias.focus();
    await page.keyboard.press('Enter');
    await expect(tobias).toHaveAttribute('aria-pressed', 'true');
    await expect(dialog.getByText('Prof has a fixed appearance.', { exact: false })).toBeVisible();
    await expect(dialog.getByRole('group', { name: 'Appearance', exact: true })).toBeHidden();
    await expect(dialog.getByRole('group', { name: 'Body', exact: true })).toBeHidden();
    await expect(dialog.getByRole('group', { name: 'Outfit & decor', exact: true })).toBeHidden();
    await expect(dialog.getByRole('group', { name: 'Fine tuning', exact: true })).toBeHidden();
    await expect(dialog.getByRole('button', { name: 'Randomize', exact: true })).toHaveCount(0);
    await a11yCheckpoint(page, 'fixed Prof avatar', { include: ['#hero-customizer-modal'] });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await dialog.getByLabel('Hero type', { exact: true }).selectOption('human');
    await expect(dialog.getByLabel('Hair style', { exact: true })).toBeVisible();
    await expect(dialog.getByLabel('Hair style', { exact: true })).toHaveValue('short');
    await expect(dialog.getByLabel('Hair style', { exact: true })).toBeEnabled();
    await dialog.getByLabel('Hero type', { exact: true }).selectOption('bruin');
    await expect(dialog.getByRole('group', { name: 'Body', exact: true })).toBeVisible();
  });
}

test('Prof survives saving and reloading with shared motion controls', async ({ page, context }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const dialog = await openCustomizer(page, context);
  await dialog.getByLabel('Hero type', { exact: true }).selectOption('tobias');
  await dialog.getByRole('group', { name: 'Top hero customizer actions' }).getByRole('button', { name: 'Save', exact: true }).click();
  await page.reload();
  // The SVG markers are the shared renderer/rig contract, including decorative art.
  const hero = page.locator('#gym-entrance .gym-entrance-visual-left [data-gym-hero-svg]');
  await expect(hero).toHaveAttribute('data-hero-kind', 'tobias');
  await expect(hero.locator('[data-hero-tobias="portrait"]')).toBeVisible();
  await expect(hero.locator('[data-hero-human-arms]')).toBeVisible();
  await expect.poll(() => hero.evaluate(svg => svg.animationsPaused())).toBe(false);
  const positions = await hero.evaluate(svg => {
    svg.pauseAnimations();
    const bar = svg.querySelector('[data-hero-motion="barbell-lift"]');
    svg.setCurrentTime(0);
    const raised = bar.getCTM().f;
    svg.setCurrentTime(1.21);
    const lowered = bar.getCTM().f;
    svg.unpauseAnimations();
    return { raised, lowered };
  });
  expect(positions.lowered).toBeGreaterThan(positions.raised);
  await page.getByRole('button', { name: 'Pause Hero Motion', exact: true }).click();
  await expect.poll(() => hero.evaluate(svg => svg.animationsPaused())).toBe(true);
  await page.getByRole('button', { name: 'Play Hero Motion', exact: true }).click();
  await expect.poll(() => hero.evaluate(svg => svg.animationsPaused())).toBe(false);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => hero.evaluate(svg => svg.animationsPaused())).toBe(true);
  await page.getByRole('button', { name: 'Customize Hero', exact: true }).click();
  await expect(dialog.getByLabel('Hero type', { exact: true })).toHaveValue('tobias');
  await expect(dialog.getByRole('group', { name: 'Appearance', exact: true })).toBeHidden();
  expect(errors).toEqual([]);
});
