// @ts-check
const { test, expect } = require('@playwright/test');

test.use({ reducedMotion: 'reduce' });

for (const picker of ['select', 'preview']) {
  test(`Bruin disables ineffective controls and preserves human choices via ${picker}`, async ({ page, context }) => {
    await context.addCookies([{ name: 'se-gym-active', value: 'true', domain: '127.0.0.1', path: '/' }]);
    await page.goto('/se-gym/');
    await page.getByRole('button', { name: 'Customize Hero', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Customize your hero' });
    const kind = dialog.getByLabel('Hero type', { exact: true });
    await kind.selectOption('human');
    await dialog.getByLabel('Hair style', { exact: true }).selectOption({ index: 2 });
    await dialog.getByLabel('Outfit style', { exact: true }).selectOption('hoodie');
    const hair = await dialog.getByLabel('Hair style', { exact: true }).inputValue();
    if (picker === 'select') await kind.selectOption('bruin');
    else await dialog.getByRole('button', { name: 'Choose Hero type: Bruin mascot', exact: true }).click();

    const inactive = ['Hair color', 'Hair style', 'Eye shape', 'Ears', 'Eyelashes', 'Eyebrows',
      'Nose shape', 'Mouth', 'Cheek tint', 'Facial hair', 'Facial details', 'Head shape',
      'Body frame', 'Outfit style', 'Vector emblem'];
    for (const name of inactive) await expect(dialog.getByLabel(name, { exact: true })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Rocket', exact: true })).toBeDisabled();
    const accessories = dialog.getByRole('group', { name: 'Accessories and headwear', exact: true }).getByRole('checkbox');
    await expect(accessories.first()).toBeDisabled();
    for (const checkbox of await accessories.all()) await expect(checkbox).toBeDisabled();
    const hairSwatches = dialog.getByRole('group', { name: 'Preset swatches for hair', exact: true }).getByRole('button');
    await expect(hairSwatches.first()).toBeDisabled();
    for (const swatch of await hairSwatches.all()) await expect(swatch).toBeDisabled();
    for (const slider of await dialog.getByRole('group', { name: 'HSL sliders for hair', exact: true }).getByRole('slider').all()) {
      await expect(slider).toBeDisabled();
    }
    for (const control of await dialog.getByRole('group', { name: 'Head fine tuning', exact: true }).getByRole('button').all()) {
      await expect(control).toBeDisabled();
    }
    for (const name of ['Skin tone', 'Eye color', 'Suit color', 'Cape/headwear color', 'Cape lining/accent']) {
      await expect(dialog.getByLabel(name, { exact: true })).toBeEnabled();
    }
    await expect(dialog.getByRole('button', { name: 'Move bruin mascot up', exact: true })).toBeEnabled();
    await expect(dialog.getByText(/For the Bruin, skin tone changes fur/)).toBeVisible();

    await kind.selectOption('human');
    for (const name of inactive) await expect(dialog.getByLabel(name, { exact: true })).toBeEnabled();
    await expect(dialog.getByLabel('Hair style', { exact: true })).toHaveValue(hair);
    await expect(dialog.getByLabel('Outfit style', { exact: true })).toHaveValue('hoodie');
    await expect(dialog.getByRole('button', { name: 'Rocket', exact: true })).toBeEnabled();
    await expect(dialog.getByRole('button', { name: 'Move head up', exact: true })).toBeEnabled();
    await expect(dialog.getByText(/For the Bruin, skin tone changes fur/)).toBeHidden();
  });
}
