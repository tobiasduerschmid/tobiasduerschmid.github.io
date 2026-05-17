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

async function clearAccessories(page) {
  const checkboxes = page.locator('#hero-customizer-modal input[name="hero-cust-accessory"]');
  const count = await checkboxes.count();
  for (let i = 0; i < count; i++) {
    const checkbox = checkboxes.nth(i);
    if (await checkbox.isChecked()) await checkbox.uncheck();
  }
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
    await a11yCheckpoint(page, 'hero customizer open', { feature: A11Y_FEATURE, darkMode: true });
  });

  test('Hero preview stays visible while modal controls scroll', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();

    const modalBox = page.locator('#hero-customizer-modal .hero-cust-box');
    const previewPane = page.locator('#hero-customizer-modal .hero-cust-preview-pane');
    await expect(previewPane).toBeVisible();

    await modalBox.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect.poll(async () => modalBox.evaluate((el) => el.scrollTop), {
      message: 'modal should scroll to later controls while the preview remains available',
    }).toBeGreaterThan(0);

    const previewMetrics = await previewPane.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const modal = el.closest('.hero-cust-box').getBoundingClientRect();
      return {
        height: rect.height,
        top: rect.top,
        bottom: rect.bottom,
        modalTop: modal.top,
        modalBottom: modal.bottom,
      };
    });
    expect(previewMetrics.height).toBeGreaterThan(0);
    expect(previewMetrics.top).toBeGreaterThanOrEqual(previewMetrics.modalTop - 1);
    expect(previewMetrics.bottom).toBeLessThanOrEqual(previewMetrics.modalBottom + 1);
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
    await clearAccessories(page);
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

  test('Long hair stays behind the face surface around facial features', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await clearAccessories(page);
    await page.getByLabel('Head shape').selectOption('default');
    await page.getByLabel('Hair style').selectOption('long');

    const faceLayer = page.locator(
      '#hero-customizer-modal [data-gym-hero-svg] [data-hero-slot="face-clear"][data-hero-option="default"]'
    );
    await expect(faceLayer).toHaveAttribute('display', 'inline');

    const slotsAtCheeks = await page.locator('#hero-customizer-modal [data-gym-hero-svg]')
      .evaluate((svg) => {
        const points = [
          { name: 'left cheek surface', x: 365, y: 200 },
          { name: 'right cheek surface', x: 435, y: 200 },
        ];

        return points.map((point) => {
          const svgPoint = svg.createSVGPoint();
          svgPoint.x = point.x;
          svgPoint.y = point.y;
          const screenPoint = svgPoint.matrixTransform(svg.getScreenCTM());
          const element = document.elementFromPoint(screenPoint.x, screenPoint.y);
          const slot = element && element.closest('[data-hero-slot]');
          return {
            name: point.name,
            slot: slot && slot.getAttribute('data-hero-slot'),
            option: slot && slot.getAttribute('data-hero-option'),
          };
        });
      });

    for (const point of slotsAtCheeks) {
      expect(point.slot, `${point.name} should not be covered by hair`).not.toBe('hair');
    }
  });

  test('New campus hair and multiple headwear styles update the preview', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await clearAccessories(page);
    await page.getByLabel('Hair style').selectOption('coils');
    await page.getByLabel('Outfit style').selectOption('hoodie');
    await page.getByLabel('Hijab', { exact: true }).check();
    await page.getByLabel('Earrings', { exact: true }).check();

    const preview = page.locator('#hero-customizer-modal [data-gym-hero-svg]');
    await expect(preview.locator('[data-hero-slot="outfit-style"][data-hero-option="hoodie"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="accessory"][data-hero-option="hijab"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="accessory"][data-hero-option="earrings"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="hair"][data-hero-option="coils"]'))
      .toHaveAttribute('display', 'none');
    await expect(page.getByLabel('Hair style')).toHaveValue('coils');
  });

  test('Textured crop and rectangular glasses update the preview', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await clearAccessories(page);
    await page.getByLabel('Hair style').selectOption('textured-crop');
    await page.getByLabel('Rectangular glasses', { exact: true }).check();

    const preview = page.locator('#hero-customizer-modal [data-gym-hero-svg]');
    await expect(preview.locator('[data-hero-slot="hair"][data-hero-option="textured-crop"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="accessory"][data-hero-option="rectangular-glasses"]'))
      .toHaveAttribute('display', 'inline');
  });

  test('Expanded natural hair styles update the preview', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await clearAccessories(page);

    const hairStyle = page.getByLabel('Hair style');
    const preview = page.locator('#hero-customizer-modal [data-gym-hero-svg]');
    const styles = [
      'long-layers',
      'curtain-bangs',
      'curly-bob',
      'coily-puff',
      'double-puffs',
      'bantu-knots',
      'side-braid',
      'braided-bun',
    ];

    for (const style of styles) {
      await hairStyle.selectOption(style);
      await expect(hairStyle).toHaveValue(style);
      await expect(preview.locator(`[data-hero-slot="hair"][data-hero-option="${style}"]`))
        .toHaveAttribute('display', 'inline');
    }
  });

  test('Customizer keyboard shortcut chips meet light-mode contrast', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();

    const contrastRatios = await page.locator('#hero-cust-emblem-hint kbd').evaluateAll((nodes) => {
      function parseRgb(color) {
        const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!match) throw new Error(`Unsupported color ${color}`);
        return [Number(match[1]), Number(match[2]), Number(match[3])];
      }
      function luminance([r, g, b]) {
        return [r, g, b].map((channel) => {
          const v = channel / 255;
          return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
      }
      function ratio(foreground, background) {
        const l1 = luminance(foreground);
        const l2 = luminance(background);
        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
      }
      return nodes.map((node) => {
        const style = getComputedStyle(node);
        return ratio(parseRgb(style.color), parseRgb(style.backgroundColor));
      });
    });

    expect(contrastRatios.length).toBeGreaterThan(0);
    expect(Math.min(...contrastRatios)).toBeGreaterThanOrEqual(4.5);
  });

  test('New natural head shapes update the preview', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await page.getByLabel('Head shape').selectOption('diamond');

    const preview = page.locator('#hero-customizer-modal [data-gym-hero-svg]');
    await expect(preview.locator('[data-hero-slot="head-shape"][data-hero-option="diamond"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="head-features"][data-hero-option="diamond"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="head-shape"][data-hero-option="default"]'))
      .toHaveAttribute('display', 'none');
    await expect(page.getByLabel('Head shape')).toHaveValue('diamond');
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
    await clearAccessories(page);
    await page.getByLabel('Rectangular glasses', { exact: true }).check();
    await page.getByLabel('Earrings', { exact: true }).check();
    await page.getByLabel('Hair style').selectOption('afro');
    await page.getByLabel('Head shape').selectOption('soft-square');
    await page.getByLabel('Body type').selectOption('broad');
    await page.getByRole('button', { name: /save/i }).click();
    await expect(page.getByRole('dialog', { name: 'Customize your hero' })).toBeHidden();

    const saved = await page.evaluate(() => localStorage.getItem('se-gym-hero-avatar'));
    expect(saved).not.toBeNull();
    const parsed = JSON.parse(String(saved));
    expect(parsed.outfit.suit.toLowerCase()).toBe('#aa22aa');
    expect(parsed.outfit.style).toBe('varsity-jacket');
    expect(parsed.outfit.accessory).toBe('rectangular-glasses');
    expect(parsed.outfit.accessories).toEqual(['rectangular-glasses', 'earrings']);
    expect(parsed.appearance.hairStyle).toBe('afro');
    expect(parsed.appearance.headStyle).toBe('soft-square');
    expect(parsed.body.type).toBe('broad');

    // All on-page SVGs are updated to broad body type, afro hair, and soft-square head shape.
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
      const headVisible = await svg
        .locator('[data-hero-slot="head-shape"][data-hero-option="soft-square"]')
        .getAttribute('display');
      expect(headVisible).toBe('inline');
      const rectangularGlassesVisible = await svg
        .locator('[data-hero-slot="accessory"][data-hero-option="rectangular-glasses"]')
        .getAttribute('display');
      expect(rectangularGlassesVisible).toBe('inline');
      const earringsVisible = await svg
        .locator('[data-hero-slot="accessory"][data-hero-option="earrings"]')
        .getAttribute('display');
      expect(earringsVisible).toBe('inline');
    }
  });

  test('Expanded body shape options update the hero preview', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();

    const preview = page.locator('#hero-customizer-modal [data-gym-hero-svg]');
    const bodyOptions = [
      'petite-curved',
      'narrow-shoulders',
      'straight',
      'soft',
      'athletic-curved',
      'v-shape',
      'compact-strong',
      'stocky',
      'tall-curved',
      'balanced-curved',
      'rounded',
      'soft-tapered',
      'soft-full-hips',
      'balanced-full',
    ];

    for (const value of bodyOptions) {
      await page.getByLabel('Body type').selectOption(value);
      await expect(page.getByLabel('Body type')).toHaveValue(value);
      await expect(preview).toHaveAttribute('data-hero-body', value);
      await expect(preview.locator(`[data-hero-slot="body-shape"][data-hero-option="${value}"]`))
        .toHaveAttribute('display', 'inline');
    }
  });

  test('Accessory combinations compose into coherent face, head, and detail layers', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await clearAccessories(page);

    await page.getByLabel('Hair style').selectOption('long-layers');
    await page.getByLabel('Rectangular glasses', { exact: true }).check();
    await page.getByLabel('Hero mask', { exact: true }).check();
    await page.getByLabel('Beanie', { exact: true }).check();
    await page.getByLabel('Hijab', { exact: true }).check();
    await page.getByLabel('Earrings', { exact: true }).check();
    await page.getByLabel('Halo', { exact: true }).check();

    const preview = page.locator('#hero-customizer-modal [data-gym-hero-svg]');
    await expect(preview.locator('[data-hero-slot="accessory"][data-hero-option="mask"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="accessory"][data-hero-option="rectangular-glasses"]'))
      .toHaveAttribute('display', 'none');
    await expect(preview.locator('[data-hero-slot="accessory"][data-hero-option="hijab"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="accessory"][data-hero-option="beanie"]'))
      .toHaveAttribute('display', 'none');
    await expect(preview.locator('[data-hero-slot="accessory"][data-hero-option="earrings"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="accessory"][data-hero-option="halo"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="hair"][data-hero-option="long-layers"]'))
      .toHaveAttribute('display', 'none');

    const faceAccessoryOrder = await preview.evaluate((svg) => {
      const mask = svg.querySelector('[data-hero-slot="accessory"][data-hero-option="mask"]');
      const faceFeatures = svg.querySelector('[data-hero-slot="head-features"][data-hero-option="default"]');
      const nose = svg.querySelector('[data-hero-face-detail="nose"]');
      const faceAccessories = ['glasses', 'rectangular-glasses', 'visor', 'spectacles', 'mask', 'monocle', 'eyepatch'];
      return {
        maskAfterHeadFeatures: Boolean(
          mask &&
          faceFeatures &&
          (faceFeatures.compareDocumentPosition(mask) & Node.DOCUMENT_POSITION_FOLLOWING)
        ),
        maskAfterNose: Boolean(
          mask &&
          nose &&
          (nose.compareDocumentPosition(mask) & Node.DOCUMENT_POSITION_FOLLOWING)
        ),
        visibleFaceAccessories: faceAccessories.filter((option) => {
          const group = svg.querySelector(`[data-hero-slot="accessory"][data-hero-option="${option}"]`);
          return group && group.getAttribute('display') === 'inline';
        }),
      };
    });
    expect(faceAccessoryOrder).toEqual({
      maskAfterHeadFeatures: true,
      maskAfterNose: true,
      visibleFaceAccessories: ['mask'],
    });
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
    await page.getByLabel('Hair style').selectOption('textured-crop');
    await clearAccessories(page);
    await page.getByLabel('Rectangular glasses', { exact: true }).check();
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
    expect(parsed.appearance.hairStyle).toBe('textured-crop');
    expect(parsed.outfit.accessories).toEqual(['rectangular-glasses']);
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
      outfit: { suit: '#1F6EBD', capeOuter: '#15538f', capeInner: '#FFD100', accessory: 'rectangular-glasses', accessories: ['rectangular-glasses', 'earrings'], emblem: '' }
    };

    await page.locator('#hero-cust-upload-input').setInputFiles({
      name: 'avatar.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(validAvatar)),
    });
    await expect(page.getByLabel('Hair style')).toHaveValue('ponytail');
    await expect(page.getByLabel('Body type')).toHaveValue('curvy');
    await expect(page.getByLabel('Rectangular glasses', { exact: true })).toBeChecked();
    await expect(page.getByLabel('Earrings', { exact: true })).toBeChecked();
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
