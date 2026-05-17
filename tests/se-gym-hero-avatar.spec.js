// @ts-check
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');

const A11Y_FEATURE = 'se-gym-hero-avatar';
const GYM_URL = '/se-gym/';

const ACTIVATE_TOGGLE_SLIDER = '#activatePersonalGymToggle + .slider';

async function clearState(page) {
  await page.context().clearCookies();
  await page.evaluate(() => {
    try { localStorage.removeItem('se-gym-hero-avatar'); } catch (e) { /* */ }
  });
}

async function activatePersonalGym(page) {
  await page.locator(ACTIVATE_TOGGLE_SLIDER).click();
  await expect(page.locator('#activatePersonalGymToggle')).toBeChecked();
}

test.describe('SE Gym Hero Avatar Customizer', () => {
  test.beforeEach(async ({ page }) => {
    await clearState(page);
  });

  test('Customize button is hidden until Personal Gym is activated', async ({ page }) => {
    await page.goto(GYM_URL);
    const btn = page.getByRole('button', { name: 'Customize Hero' });
    await expect(btn).toBeHidden();
    await activatePersonalGym(page);
    await expect(btn).toBeVisible();
  });

  test('Clicking Customize opens the modal and moves focus to the first control', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    const modal = page.getByRole('dialog', { name: 'Customize your hero' });
    await expect(modal).toBeVisible();
    await expect(page.getByLabel('Skin tone')).toBeFocused();
    await a11yCheckpoint(page, 'hero customizer open', { feature: A11Y_FEATURE });
  });

  test('Escape closes the modal and returns focus to the trigger', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    const btn = page.getByRole('button', { name: 'Customize Hero' });
    await btn.click();
    await expect(page.getByRole('dialog', { name: 'Customize your hero' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Customize your hero' })).toBeHidden();
    await expect(btn).toBeFocused();
  });

  test('Close button closes the modal and returns focus to the trigger', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    const btn = page.getByRole('button', { name: 'Customize Hero' });
    await btn.click();
    await page.getByRole('button', { name: 'Close hero customizer' }).click();
    await expect(page.getByRole('dialog', { name: 'Customize your hero' })).toBeHidden();
    await expect(btn).toBeFocused();
  });

  test('Changing hair style updates the preview SVG slot', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await page.getByLabel('Accessory or headwear').selectOption('none');
    await page.getByLabel('Hair style').selectOption('long');
    const longGroup = page.locator(
      '#hero-customizer-modal [data-gym-hero-svg] [data-hero-slot="hair"][data-hero-option="long"]'
    );
    await expect(longGroup).toHaveAttribute('display', 'inline');
    const shortGroup = page.locator(
      '#hero-customizer-modal [data-gym-hero-svg] [data-hero-slot="hair"][data-hero-option="short"]'
    );
    await expect(shortGroup).toHaveAttribute('display', 'none');
  });

  test('New campus hair and headwear styles update the preview', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await page.getByLabel('Hair style').selectOption('coils');
    await page.getByLabel('Outfit style').selectOption('hoodie');
    await page.getByLabel('Accessory or headwear').selectOption('hijab');

    const preview = page.locator('#hero-customizer-modal [data-gym-hero-svg]');
    await expect(preview.locator('[data-hero-slot="outfit-style"][data-hero-option="hoodie"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="accessory"][data-hero-option="hijab"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="hair"][data-hero-option="coils"]'))
      .toHaveAttribute('display', 'none');
    await expect(page.getByLabel('Hair style')).toHaveValue('coils');
  });

  test('Typing an emoji into the emblem updates the preview text', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await page.getByLabel('Emblem (one emoji)').fill('🚀');
    const emblemText = page.locator('#hero-customizer-modal [data-hero-emblem-text]');
    await expect(emblemText).toHaveText('🚀');
    const emblemGroup = page.locator('#hero-customizer-modal [data-hero-slot="emblem"]');
    await expect(emblemGroup).toHaveAttribute('display', 'inline');

    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(emblemText).toHaveText('');
    await expect(emblemGroup).toHaveAttribute('display', 'none');
  });

  test('Non-emoji emblem text is rejected with a status message', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await page.getByLabel('Emblem (one emoji)').fill('hello');
    await expect(page.locator('#hero-cust-status')).toContainText('Emblem must be a single emoji.');
  });

  test('Save persists to localStorage and applies to all on-page heroes', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await page.getByLabel('Suit color').fill('#aa22aa');
    await page.getByLabel('Outfit style').selectOption('varsity-jacket');
    await page.getByLabel('Accessory or headwear').selectOption('none');
    await page.getByLabel('Hair style').selectOption('afro');
    await page.getByLabel('Broad-shouldered build').check();
    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.getByRole('dialog', { name: 'Customize your hero' })).toBeHidden();

    const saved = await page.evaluate(() => localStorage.getItem('se-gym-hero-avatar'));
    expect(saved).not.toBeNull();
    const parsed = JSON.parse(String(saved));
    expect(parsed.outfit.suit.toLowerCase()).toBe('#aa22aa');
    expect(parsed.outfit.style).toBe('varsity-jacket');
    expect(parsed.appearance.hairStyle).toBe('afro');
    expect(parsed.body.type).toBe('broad');

    // All three on-page SVGs are updated to broad body type and afro hair.
    const pageSvgs = page.locator('#gym-entrance [data-gym-hero-svg]');
    const count = await pageSvgs.count();
    expect(count).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < count; i++) {
      const svg = pageSvgs.nth(i);
      await expect(svg).toHaveAttribute('data-hero-body', 'broad');
      const afroVisible = await svg
        .locator('[data-hero-slot="hair"][data-hero-option="afro"]')
        .getAttribute('display');
      expect(afroVisible).toBe('inline');
    }
  });

  test('Reload preserves saved customization (no randomization)', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.evaluate(() => {
      const state = {
        version: 1,
        appearance: { skin: '#dfa07a', hairColor: '#aa3300', hairStyle: 'locs', eyeColor: '#1f140c', eyebrowStyle: 'arched' },
        body: { type: 'tall' },
        outfit: { suit: '#1F6EBD', capeOuter: '#15538f', capeInner: '#FFD100', accessory: 'glasses', emblem: '🌟' }
      };
      localStorage.setItem('se-gym-hero-avatar', JSON.stringify(state));
    });
    await page.reload();

    const svg = page.locator('#gym-entrance [data-gym-hero-svg]').first();
    await expect(svg).toHaveAttribute('data-hero-body', 'tall');
    await expect(svg.locator('[data-hero-slot="hair"][data-hero-option="locs"]'))
      .toHaveAttribute('display', 'inline');
    await expect(svg.locator('[data-hero-slot="accessory"][data-hero-option="glasses"]'))
      .toHaveAttribute('display', 'inline');
    await expect(svg.locator('[data-hero-emblem-text]')).toHaveText('🌟');
  });

  test('Download exports a JSON file with the current state', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await page.getByLabel('Hair style').selectOption('curly');
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#hero-cust-download').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('se-gym-hero-avatar.json');
    const stream = await download.createReadStream();
    let buf = '';
    if (stream) {
      for await (const chunk of stream) buf += chunk.toString();
    }
    const parsed = JSON.parse(buf);
    expect(parsed.appearance.hairStyle).toBe('curly');
    expect(parsed.version).toBe(1);
  });

  test('Upload of malformed JSON shows error and does not mutate localStorage', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();

    await page.locator('#hero-cust-upload-input').setInputFiles({
      name: 'broken.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{not valid json'),
    });
    await expect(page.locator('#hero-cust-status')).toContainText(/Could not parse/i);
    const stored = await page.evaluate(() => localStorage.getItem('se-gym-hero-avatar'));
    expect(stored).toBeNull();
  });

  test('Upload of valid JSON populates preview but requires Save to persist', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();

    const validAvatar = {
      version: 1,
      appearance: { skin: '#dfa07a', hairColor: '#101010', hairStyle: 'ponytail', eyeColor: '#1f140c', eyebrowStyle: 'straight' },
      body: { type: 'curvy' },
      outfit: { suit: '#1F6EBD', capeOuter: '#15538f', capeInner: '#FFD100', accessory: 'none', emblem: '' }
    };

    await page.locator('#hero-cust-upload-input').setInputFiles({
      name: 'avatar.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(validAvatar)),
    });
    await expect(page.getByLabel('Hair style')).toHaveValue('ponytail');
    await expect(page.getByLabel('Curved frame')).toBeChecked();
    // Preview updated but not yet saved
    const storedBefore = await page.evaluate(() => localStorage.getItem('se-gym-hero-avatar'));
    expect(storedBefore).toBeNull();
    await page.getByRole('button', { name: /save/i }).click();
    const storedAfter = await page.evaluate(() => localStorage.getItem('se-gym-hero-avatar'));
    expect(storedAfter).not.toBeNull();
  });

  test('Randomize button changes preview and shows a status message', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    const hairStyle = page.getByLabel('Hair style');
    const initial = await hairStyle.inputValue();
    // Click randomize until the hair style changes; collisions are possible.
    let changed = false;
    for (let attempt = 0; attempt < 16 && !changed; attempt++) {
      await page.getByRole('button', { name: /randomize/i }).click();
      const current = await hairStyle.inputValue();
      if (current !== initial) changed = true;
    }
    expect(changed, 'randomize should produce a different hair style within 16 attempts').toBe(true);
    await expect(page.locator('#hero-cust-status')).toContainText(/Randomized/i);
  });
});
