// @ts-check
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');

const A11Y_FEATURE = 'se-gym-hero-avatar';
const GYM_URL = '/se-gym/';

const ACTIVATE_TOGGLE_SLIDER = '#activatePersonalGymToggle + .slider';

const CHOICE_PREVIEW_VIEWBOXES = {
  full: '238 34 324 596',
  hair: '292 54 216 278',
  eyebrows: '352 138 96 78',
  eyes: '352 154 96 78',
  nose: '370 178 60 50',
  mouth: '360 202 80 66',
  cheeks: '342 178 116 94',
  'head-shape': '326 92 148 184',
  'facial-hair': '344 184 112 92',
  'face-detail': '350 178 100 82',
  body: '270 228 260 340',
  outfit: '286 226 228 294',
};

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
  await page.locator('#hero-customizer-modal input[name="hero-cust-accessory"]:checked').evaluateAll((checkboxes) => {
    const firstChecked = checkboxes[0];
    for (const checkbox of checkboxes) {
      checkbox.checked = false;
    }
    if (firstChecked) {
      firstChecked.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
}

async function setColorInput(page, selector, value) {
  await page.locator(selector).evaluate((input, nextValue) => {
    input.value = nextValue;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

async function setSelectInput(page, selector, value) {
  await page.locator(selector).evaluate((select, nextValue) => {
    select.value = nextValue;
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

async function setCheckboxInput(page, selector, checked) {
  await page.locator(selector).evaluate((checkbox, nextChecked) => {
    checkbox.checked = nextChecked;
    checkbox.dispatchEvent(new Event('input', { bubbles: true }));
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
  }, checked);
}

async function choicePreviewSvg(page, accessibleName) {
  const button = page.getByRole('button', { name: accessibleName });
  await button.scrollIntoViewIfNeeded();
  await expect(button).toBeVisible();
  const svg = button.locator('[data-hero-choice-svg]');
  await expect(svg).toHaveCount(1, { timeout: 15000 });
  return svg;
}

async function expectChoiceSlotVisible(svg, slot, option, message) {
  await expect.poll(async () => svg
    .locator(`[data-hero-slot="${slot}"][data-hero-option="${option}"]`)
    .first()
    .getAttribute('display'), {
    message,
    timeout: 15000,
  }).toBe('inline');
}

async function expectNoVisiblePendingChoicePreviews(page) {
  await expect.poll(async () => page.evaluate(() => {
    const pendingSvgs = Array.from(document.querySelectorAll(
      '#hero-customizer-modal .hero-cust-choice-button[data-choice-pending="true"] [data-hero-choice-svg]'
    ));
    return pendingSvgs.filter((svg) => getComputedStyle(svg).visibility !== 'hidden').length;
  }), {
    message: 'pending choice previews should hide stale SVGs',
    timeout: 5000,
  }).toBe(0);
}

function colorToRgb(color) {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const expanded = hex.length === 3
      ? hex.split('').map((part) => part + part).join('')
      : hex;
    return {
      r: parseInt(expanded.slice(0, 2), 16),
      g: parseInt(expanded.slice(2, 4), 16),
      b: parseInt(expanded.slice(4, 6), 16),
    };
  }
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) throw new Error(`Unsupported color: ${color}`);
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
  };
}

function relativeLuminance(color) {
  const rgb = colorToRgb(color.trim());
  const channel = (value) => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return channel(rgb.r) * 0.2126 + channel(rgb.g) * 0.7152 + channel(rgb.b) * 0.0722;
}

function contrastRatio(colorA, colorB) {
  const a = relativeLuminance(colorA);
  const b = relativeLuminance(colorB);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

async function entranceHeroSignatures(page) {
  return page.locator('#gym-entrance [data-gym-hero-svg]').evaluateAll((svgs) => {
    function visibleOption(svg, slot) {
      const groups = Array.from(svg.querySelectorAll(`[data-hero-slot="${slot}"]`));
      const visible = groups.find((group) => group.getAttribute('display') === 'inline');
      return visible ? visible.getAttribute('data-hero-option') : '';
    }

    return svgs.map((svg) => {
      const styles = getComputedStyle(svg);
      const accessories = Array.from(svg.querySelectorAll('[data-hero-slot="accessory"]'))
        .filter((group) => group.getAttribute('display') === 'inline')
        .map((group) => group.getAttribute('data-hero-option'))
        .join(',');
      return [
        svg.getAttribute('data-hero-body'),
        visibleOption(svg, 'hair'),
        visibleOption(svg, 'head-shape'),
        visibleOption(svg, 'outfit-style'),
        styles.getPropertyValue('--hero-skin-light').trim(),
        styles.getPropertyValue('--hero-suit').trim(),
        styles.getPropertyValue('--hero-hair').trim(),
        accessories,
      ].join('|');
    });
  });
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

  test('Your Hero entry appears directly below the intro copy', async ({ page }) => {
    await page.goto(GYM_URL);

    const placement = await page.evaluate(() => {
      const intro = Array.from(document.querySelectorAll('#gym-entrance .gym-subtitle'))
        .find((node) => node.textContent.includes('own study gym by adding quizzes and flashcard sets'));
      const heroSection = document.getElementById('hero-customizer-section');
      const startRow = document.querySelector('#gym-entrance .gym-start-row');
      return {
        heroHeading: heroSection && heroSection.querySelector('h2') ? heroSection.querySelector('h2').textContent.trim() : '',
        directlyAfterIntro: Boolean(intro && heroSection && intro.nextElementSibling === heroSection),
        beforeStartButton: Boolean(
          heroSection &&
          startRow &&
          (heroSection.compareDocumentPosition(startRow) & Node.DOCUMENT_POSITION_FOLLOWING)
        ),
      };
    });

    expect(placement).toEqual({
      heroHeading: 'Your Hero',
      directlyAfterIntro: true,
      beforeStartButton: true,
    });
  });

  test('Clicking Customize opens the modal and moves focus to the first control', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    const modal = page.getByRole('dialog', { name: 'Customize your hero' });
    await expect(modal).toBeVisible();
    await expect(page.getByLabel('Hero type', { exact: true })).toBeFocused();
    await a11yCheckpoint(page, 'hero customizer open', { feature: A11Y_FEATURE, darkMode: true });
  });

  test('Style preview buttons are generated from the central avatar choice registry', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await clearAccessories(page);

    const registryHairValues = await page.evaluate(() =>
      window.HeroAvatar.CHOICE_SETS.hairStyle.groups.flatMap((group) =>
        group.options.map((option) => option.value)
      )
    );
    const selectHairValues = await page.locator('#hero-cust-hair-style option').evaluateAll((options) =>
      options.map((option) => option.value)
    );
    expect(selectHairValues).toEqual(registryHairValues);

    const longHairButton = page.getByRole('button', { name: 'Choose Hair style: Long and flowing' });
    await expect(longHairButton).toBeVisible();
    await longHairButton.click();

    await expect(page.getByLabel('Hair style', { exact: true })).toHaveValue('long');
    await expect(longHairButton).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#hero-customizer-modal [data-gym-hero-svg]')).toHaveCount(1);
    await expect(page.locator(
      '#hero-customizer-modal [data-gym-hero-svg] [data-hero-slot="hair"][data-hero-option="long"]'
    )).toHaveAttribute('display', 'inline');
  });

  test('Style preview buttons crop into the selected avatar detail', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await clearAccessories(page);

    const previewCrops = [
      { name: 'Choose Hero type: Bruin mascot', viewBox: CHOICE_PREVIEW_VIEWBOXES.full },
      { name: 'Choose Hair style: Long and flowing', viewBox: CHOICE_PREVIEW_VIEWBOXES.hair },
      { name: 'Choose Eyebrows: Thin', viewBox: CHOICE_PREVIEW_VIEWBOXES.eyebrows },
      { name: 'Choose Eye shape: Almond', viewBox: CHOICE_PREVIEW_VIEWBOXES.eyes },
      { name: 'Choose Nose shape: Button', viewBox: CHOICE_PREVIEW_VIEWBOXES.nose },
      { name: 'Choose Mouth: Grin', viewBox: CHOICE_PREVIEW_VIEWBOXES.mouth },
      { name: 'Choose Cheek tint: None', viewBox: CHOICE_PREVIEW_VIEWBOXES.cheeks },
      { name: 'Choose Head shape: Round face', viewBox: CHOICE_PREVIEW_VIEWBOXES['head-shape'] },
      { name: 'Choose Facial hair: Full beard', viewBox: CHOICE_PREVIEW_VIEWBOXES['facial-hair'] },
      { name: 'Choose Facial details: Freckles', viewBox: CHOICE_PREVIEW_VIEWBOXES['face-detail'] },
      { name: 'Choose Body type: Broad-shouldered build', viewBox: CHOICE_PREVIEW_VIEWBOXES.body },
      { name: 'Choose Outfit style: Hoodie', viewBox: CHOICE_PREVIEW_VIEWBOXES.outfit },
    ];

    for (const crop of previewCrops) {
      const svg = await choicePreviewSvg(page, crop.name);
      await expect(svg, `${crop.name} preview should crop to its own feature area`)
        .toHaveAttribute('viewBox', crop.viewBox);
    }
  });

  test('Avatar choices use respectful labels and canonical exported values', async ({ page }) => {
    await page.goto(GYM_URL);

    const summary = await page.evaluate(() => {
      const flatten = (choiceSet) => choiceSet.groups.flatMap((group) => group.options);
      const labelsByValue = (choiceSet) => Object.fromEntries(
        flatten(choiceSet).map((option) => [option.value, option.label])
      );
      const legacyLocs = JSON.parse(JSON.stringify(window.HeroAvatar.DEFAULTS));
      legacyLocs.appearance.hairStyle = 'dreads-bun';
      legacyLocs.body.type = 'voluptuous';
      const legacyHip = JSON.parse(JSON.stringify(window.HeroAvatar.DEFAULTS));
      legacyHip.body.type = 'pear';
      const legacyDetails = JSON.parse(JSON.stringify(window.HeroAvatar.DEFAULTS));
      legacyDetails.appearance.eyeShape = 'monolid';
      legacyDetails.body.type = 'stocky';
      legacyDetails.outfit.accessory = 'forehead-accent';
      legacyDetails.outfit.accessories = ['forehead-accent'];

      return {
        hairValues: flatten(window.HeroAvatar.CHOICE_SETS.hairStyle).map((option) => option.value),
        eyeValues: flatten(window.HeroAvatar.CHOICE_SETS.eyeShape).map((option) => option.value),
        bodyValues: flatten(window.HeroAvatar.CHOICE_SETS.bodyType).map((option) => option.value),
        accessoryValues: flatten(window.HeroAvatar.CHOICE_SETS.accessory).map((option) => option.value),
        hairLabels: labelsByValue(window.HeroAvatar.CHOICE_SETS.hairStyle),
        eyeLabels: labelsByValue(window.HeroAvatar.CHOICE_SETS.eyeShape),
        bodyLabels: labelsByValue(window.HeroAvatar.CHOICE_SETS.bodyType),
        accessoryLabels: labelsByValue(window.HeroAvatar.CHOICE_SETS.accessory),
        legacyLocsValidation: window.HeroAvatar.validateAvatar(legacyLocs),
        normalizedLegacyLocs: window.HeroAvatar.normalizeAvatar(legacyLocs),
        legacyHipValidation: window.HeroAvatar.validateAvatar(legacyHip),
        normalizedLegacyHip: window.HeroAvatar.normalizeAvatar(legacyHip),
        legacyDetailsValidation: window.HeroAvatar.validateAvatar(legacyDetails),
        normalizedLegacyDetails: window.HeroAvatar.normalizeAvatar(legacyDetails),
      };
    });

    expect(summary.hairValues).not.toContain('dreads-bun');
    expect(summary.hairValues).toContain('locs-bun');
    expect(summary.eyeValues).not.toContain('monolid');
    expect(summary.eyeValues).not.toContain('soft-monolid');
    expect(summary.eyeValues).toEqual(expect.arrayContaining(['single-eyelid', 'soft-single-eyelid']));
    expect(summary.bodyValues).not.toContain('pear');
    expect(summary.bodyValues).not.toContain('voluptuous');
    expect(summary.bodyValues).not.toContain('stocky');
    expect(summary.bodyValues).toEqual(expect.arrayContaining(['solid', 'fuller-hip', 'full-frame']));
    expect(summary.accessoryValues).not.toContain('forehead-accent');
    expect(summary.accessoryValues).toContain('forehead-jewel');
    expect(summary.hairLabels['rounded-afro']).toBe('Rounded Afro');
    expect(summary.hairLabels['locs-bun']).toBe('Locs bun');
    expect(summary.eyeLabels['single-eyelid']).toBe('Single eyelid');
    expect(summary.eyeLabels['soft-single-eyelid']).toBe('Soft single eyelid');
    expect(summary.bodyLabels.solid).toBe('Solid build');
    expect(summary.bodyLabels['full-frame']).toBe('Full frame');
    expect(summary.accessoryLabels['draped-scarf']).toBe('Draped head scarf');
    expect(summary.accessoryLabels['forehead-jewel']).toBe('Forehead jewel');
    expect(summary.legacyLocsValidation.ok).toBe(true);
    expect(summary.normalizedLegacyLocs.appearance.hairStyle).toBe('locs-bun');
    expect(summary.normalizedLegacyLocs.body.type).toBe('full-frame');
    expect(summary.legacyHipValidation.ok).toBe(true);
    expect(summary.normalizedLegacyHip.body.type).toBe('fuller-hip');
    expect(summary.legacyDetailsValidation.ok).toBe(true);
    expect(summary.normalizedLegacyDetails.appearance.eyeShape).toBe('single-eyelid');
    expect(summary.normalizedLegacyDetails.body.type).toBe('solid');
    expect(summary.normalizedLegacyDetails.outfit.accessories).toEqual(['forehead-jewel']);
  });

  test('Style preview buttons re-render after randomize changes the base avatar', async ({ page }) => {
    test.setTimeout(45000);
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();

    const longHairPreview = await choicePreviewSvg(page, 'Choose Hair style: Long and flowing');

    await setColorInput(page, '#hero-cust-hair-color', '#123456');
    await expect.poll(async () => longHairPreview.evaluate((svg) =>
      getComputedStyle(svg).getPropertyValue('--hero-hair').trim().toLowerCase()
    ), {
      message: 'hair preview button should update after direct color changes',
      timeout: 15000,
    }).toBe('#123456');

    const randomize = page.getByRole('button', { name: 'Randomize' });
    await randomize.click();
    const randomizedHairColor = (await page.getByLabel('Hair color', { exact: true }).inputValue()).toLowerCase();
    expect(randomizedHairColor, 'randomize should choose from generated avatar colors').not.toBe('#123456');

    await page.getByRole('button', { name: 'Choose Hair style: Long and flowing' }).scrollIntoViewIfNeeded();
    await expect.poll(async () => longHairPreview.evaluate((svg) =>
      getComputedStyle(svg).getPropertyValue('--hero-hair').trim().toLowerCase()
    ), {
      message: 'hair preview button should re-render after randomize',
      timeout: 15000,
    }).toBe(randomizedHairColor);
  });

  test('Style preview buttons stay current across mixed avatar changes', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await clearAccessories(page);

    const shortHairSvg = await choicePreviewSvg(page, 'Choose Hair style: Short crop');
    await expectChoiceSlotVisible(shortHairSvg, 'hair', 'short', 'short hair preview should render before mutations');

    const eyebrowThinSvg = await choicePreviewSvg(page, 'Choose Eyebrows: Thin');
    await expectChoiceSlotVisible(eyebrowThinSvg, 'eyebrow', 'thin', 'eyebrow option preview should render before mutations');

    const hoodieSvg = await choicePreviewSvg(page, 'Choose Outfit style: Hoodie');
    await expectChoiceSlotVisible(hoodieSvg, 'outfit-style', 'hoodie', 'outfit option preview should render before mutations');

    const longHairButton = page.getByRole('button', { name: 'Choose Hair style: Long and flowing' });
    await longHairButton.scrollIntoViewIfNeeded();
    await longHairButton.click();
    await expectNoVisiblePendingChoicePreviews(page);
    await expectChoiceSlotVisible(
      eyebrowThinSvg,
      'hair',
      'long',
      'face previews should inherit the changed base hair style'
    );
    await expectChoiceSlotVisible(
      eyebrowThinSvg,
      'eyebrow',
      'thin',
      'face previews should preserve their own option delta'
    );

    await setCheckboxInput(page, '#hero-customizer-modal input[name="hero-cust-accessory"][value="hijab"]', true);
    await expectNoVisiblePendingChoicePreviews(page);
    await expectChoiceSlotVisible(
      shortHairSvg,
      'hair',
      'bald',
      'non-selected hair previews should hide hair under head-covering accessories'
    );

    await setSelectInput(page, '#hero-cust-body-type', 'broad');
    await expectNoVisiblePendingChoicePreviews(page);
    await page.getByRole('button', { name: 'Choose Outfit style: Hoodie' }).scrollIntoViewIfNeeded();
    await expect.poll(async () => hoodieSvg.evaluate((svg) => svg.getAttribute('data-hero-body')), {
      message: 'outfit previews should inherit body type changes',
      timeout: 15000,
    }).toBe('broad');

    await setColorInput(page, '#hero-cust-suit', '#7a2cff');
    await expectNoVisiblePendingChoicePreviews(page);
    await expect.poll(async () => hoodieSvg.evaluate((svg) =>
      getComputedStyle(svg).getPropertyValue('--hero-suit').trim().toLowerCase()
    ), {
      message: 'outfit previews should inherit suit color changes',
      timeout: 15000,
    }).toBe('#7a2cff');
  });

  test('Bruin mascot option replaces the human avatar and saves to page heroes', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();

    const heroType = page.getByLabel('Hero type', { exact: true });
    await expect(heroType).toHaveValue('human');
    await heroType.selectOption('bruin');

    const preview = page.locator('#hero-customizer-modal [data-gym-hero-svg]');
    await expect(preview).toHaveAttribute('data-hero-kind', 'bruin');
    await expect(preview.locator('[data-hero-kind-layer="bruin"][data-hero-slot="mascot"]')).toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-kind-layer="bruin"][data-hero-slot="mascot-arms"]')).toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-kind-layer="bruin"][data-hero-slot="mascot-paws"]')).toHaveAttribute('display', 'inline');
    const humanLayerDisplays = await preview.locator('[data-hero-kind-layer="human"]').evaluateAll((layers) =>
      layers.map((layer) => layer.getAttribute('display'))
    );
    expect(humanLayerDisplays.length).toBeGreaterThan(0);
    expect(humanLayerDisplays.every((display) => display === 'none')).toBe(true);
    await expect(page.getByLabel('Skin tone')).toHaveValue('#8b5a35');

    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('dialog', { name: 'Customize your hero' })).toBeHidden();

    await expect.poll(async () => page.locator('#gym-entrance [data-gym-hero-svg]').evaluateAll((svgs) =>
      svgs.length >= 2 && svgs.every((svg) => svg.getAttribute('data-hero-kind') === 'bruin')
    ), {
      message: 'saved bruin mascot should apply to every page hero',
    }).toBe(true);

    const savedKind = await page.evaluate(() => JSON.parse(localStorage.getItem('se-gym-hero-avatar')).kind);
    expect(savedKind).toBe('bruin');
  });

  test('Avatar color controls expose all presets and HSL sliders on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();

    const colorControls = [
      { presetsLabel: 'Preset swatches for skin', hslLabel: 'HSL sliders for skin', presets: 12 },
      { presetsLabel: 'Preset swatches for hair', hslLabel: 'HSL sliders for hair', presets: 15 },
      { presetsLabel: 'Preset swatches for eyes', hslLabel: 'HSL sliders for eyes', presets: 8 },
      { presetsLabel: 'Preset swatches for suit', hslLabel: 'HSL sliders for suit', presets: 12 },
      { presetsLabel: 'Preset swatches for cape and headwear', hslLabel: 'HSL sliders for cape and headwear', presets: 10 },
      { presetsLabel: 'Preset swatches for accent', hslLabel: 'HSL sliders for accent', presets: 8 },
    ];

    for (const control of colorControls) {
      const presets = page.getByRole('group', { name: control.presetsLabel });
      const hsl = page.getByRole('group', { name: control.hslLabel });

      await expect(presets, `${control.presetsLabel} should be visible on mobile`).toBeVisible();
      await expect(presets.getByRole('button')).toHaveCount(control.presets);
      await expect(hsl.getByLabel(/^Hue /)).toBeVisible();
      await expect(hsl.getByLabel(/^Saturation /)).toBeVisible();
      await expect(hsl.getByLabel(/^Lightness /)).toBeVisible();
      await expect(hsl.getByRole('slider')).toHaveCount(3);

      const rangeBackgrounds = await hsl.locator('input[type="range"]').evaluateAll((ranges) =>
        ranges.map((range) => getComputedStyle(range).getPropertyValue('--hero-cust-range-bg'))
      );
      expect(rangeBackgrounds.every((background) => background.includes('linear-gradient'))).toBe(true);
    }

    const hairPreset = page
      .getByRole('group', { name: 'Preset swatches for hair' })
      .getByRole('button', { name: 'Use hair preset #854A3A' });
    await hairPreset.click();

    await expect(page.getByLabel('Hair color', { exact: true })).toHaveValue('#854a3a');
    await expect(hairPreset).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => page.locator('#hero-customizer-modal [data-gym-hero-svg]').evaluate((svg) =>
      getComputedStyle(svg).getPropertyValue('--hero-hair').trim().toLowerCase()
    ), {
      message: 'selected hair preset should update the avatar preview color',
    }).toBe('#854a3a');

    const hairHsl = page.getByRole('group', { name: 'HSL sliders for hair' });
    const hue = hairHsl.getByLabel(/^Hue /);
    const saturation = hairHsl.getByLabel(/^Saturation /);
    const lightness = hairHsl.getByLabel(/^Lightness /);

    await hue.fill('210');
    await saturation.fill('70');
    await lightness.fill('0');
    await expect(page.getByLabel('Hair color', { exact: true })).toHaveValue('#000000');
    await expect(hue).toHaveValue('210');
    await expect(saturation).toHaveValue('70');
    await expect(lightness).toHaveValue('0');

    await lightness.fill('100');
    await expect(page.getByLabel('Hair color', { exact: true })).toHaveValue('#ffffff');
    await expect(hue).toHaveValue('210');
    await expect(saturation).toHaveValue('70');
    await expect(lightness).toHaveValue('100');
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
      const svg = el.querySelector('.se-gym-hero-svg').getBoundingClientRect();
      return {
        height: rect.height,
        width: rect.width,
        svgHeight: svg.height,
        svgWidth: svg.width,
        top: rect.top,
        bottom: rect.bottom,
        modalTop: modal.top,
        modalBottom: modal.bottom,
      };
    });
    expect(previewMetrics.height).toBeGreaterThan(0);
    expect(previewMetrics.svgWidth).toBeGreaterThanOrEqual(360);
    expect(previewMetrics.svgHeight).toBeGreaterThanOrEqual(320);
    expect(previewMetrics.top).toBeGreaterThanOrEqual(previewMetrics.modalTop - 1);
    expect(previewMetrics.bottom).toBeLessThanOrEqual(previewMetrics.modalBottom + 1);
  });

  test('Random avatar generation keeps combinations valid, varied, and visually coherent', async ({ page }) => {
    await page.goto(GYM_URL);

    const summary = await page.evaluate(() => {
      const originalRandom = Math.random;
      let seed = 246813579;
      Math.random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };

      const skinBands = {
        light: new Set(['#fce0c0', '#f4d3a5', '#f0c294']),
        medium: new Set(['#e4b477', '#dfa07a', '#c9925d', '#c08660']),
        deep: new Set(['#a06840', '#8b5a35', '#7a4e2f']),
        darkest: new Set(['#5c3a22', '#3d2515']),
      };
      const commonBodyTypes = new Set(['average', 'athletic', 'lean', 'slim', 'straight', 'soft', 'medium-lean', 'soft-medium', 'short-soft', 'short-curved', 'tall-soft', 'soft-athletic', 'medium-full']);
      const specializedBodyTypes = new Set([
        'petite-curved', 'narrow-shoulders', 'compact-lean', 'athletic-curved',
        'muscular', 'compact-strong', 'broad-lean', 'tall-lean', 'tall-curved',
        'soft-tapered', 'hourglass', 'fuller-hip', 'soft-full-hips', 'full-frame',
        'plus-size', 'balanced-full',
      ]);
      const costumeAccessories = new Set(['crown', 'halo', 'monocle', 'eyepatch', 'mask']);
      const manualOnlyAccessories = new Set(['crown', 'halo', 'monocle', 'eyepatch', 'mask', 'forehead-jewel', 'headwrap']);
      const coveredHairAccessories = new Set(['draped-scarf', 'hijab', 'headwrap']);
      const currentCampusAccessories = new Set(['over-ear-headphones', 'wireless-earbuds', 'wired-earbuds', 'chain-necklace', 'campus-lanyard', 'bandana']);
      const expressiveManualHair = new Set(['mohawk', 'bowl-cut', 'pigtails', 'top-knot']);
      const upbeatMouthStyles = new Set(['grin', 'bright-smile', 'cheerful-grin', 'open-smile', 'excited-smile']);
      const everydayCampusOutfits = new Set(['hoodie', 'crewneck-sweatshirt', 'varsity-jacket', 'denim-jacket', 'flannel-overshirt', 'striped-knit', 'windbreaker', 'collared-shirt', 'kurta-top', 'campus-blouse', 'cardigan']);
      const costumeOutfits = new Set(['super-suit', 'captain-jacket']);
      const technicalOutfits = new Set(['lab-coat', 'utility-vest']);
      const naturalHairColors = new Set([
        '#1f140c', '#3d2818', '#6a4830', '#a07050', '#c08555', '#d8b074',
        '#e8d090', '#704530', '#1a1a1a', '#2e2e2e', '#5e3a2f', '#854a3a', '#7a4a2f',
      ]);
      const bandCounts = { light: 0, medium: 0, deep: 0, darkest: 0 };
      const presentationBands = { male: new Set(), female: new Set() };
      const bodyTypes = new Set();
      const campusAccessoryTypes = new Set();
      const mouthTypes = new Set();
      const invalid = [];
      let maleSamples = 0;
      let femaleSamples = 0;
      let commonBodySamples = 0;
      let specializedBodySamples = 0;
      let costumeAccessorySamples = 0;
      let manualOnlyAccessorySamples = 0;
      let coveredFacialHairSamples = 0;
      let femaleFacialHairSamples = 0;
      let expressiveManualHairSamples = 0;
      let costumeOutfitSamples = 0;
      let everydayCampusOutfitSamples = 0;
      let technicalOutfitSamples = 0;
      let accentHairColorSamples = 0;
      let hijabSamples = 0;
      let headwrapSamples = 0;
      let coveredHairSamples = 0;
      let bantuKnotsSamples = 0;
      let facialHairSamples = 0;
      let cleanShavenSamples = 0;
      let layeredAccessorySamples = 0;
      let currentCampusAccessorySamples = 0;
      let upbeatMouthSamples = 0;
      let neutralMouthSamples = 0;

      try {
        for (let i = 0; i < 640; i++) {
          const avatar = window.HeroAvatar.randomAvatar();
          const validation = window.HeroAvatar.validateAvatar(avatar);
          if (!validation.ok) invalid.push(validation.error);

          if (avatar.appearance.presentation === 'male') maleSamples++;
          if (avatar.appearance.presentation === 'female') femaleSamples++;

          for (const [name, tones] of Object.entries(skinBands)) {
            if (tones.has(avatar.appearance.skin)) {
              bandCounts[name]++;
              if (presentationBands[avatar.appearance.presentation]) {
                presentationBands[avatar.appearance.presentation].add(name);
              }
            }
          }

          const bodyType = avatar.body.type;
          bodyTypes.add(bodyType);
          if (commonBodyTypes.has(bodyType)) commonBodySamples++;
          if (specializedBodyTypes.has(bodyType)) specializedBodySamples++;

          const accessories = avatar.outfit.accessories || [];
          if (accessories.length > 1) layeredAccessorySamples++;
          for (const accessory of accessories) {
            if (currentCampusAccessories.has(accessory)) campusAccessoryTypes.add(accessory);
          }
          if (accessories.some((accessory) => currentCampusAccessories.has(accessory))) currentCampusAccessorySamples++;
          if (accessories.some((accessory) => costumeAccessories.has(accessory))) costumeAccessorySamples++;
          if (accessories.some((accessory) => manualOnlyAccessories.has(accessory))) manualOnlyAccessorySamples++;
          if (accessories.includes('hijab')) hijabSamples++;
          if (accessories.includes('headwrap')) headwrapSamples++;
          if (accessories.some((accessory) => coveredHairAccessories.has(accessory) || accessory === 'turban')) coveredHairSamples++;
          if (avatar.appearance.hairStyle === 'bantu-knots') bantuKnotsSamples++;
          if (expressiveManualHair.has(avatar.appearance.hairStyle)) expressiveManualHairSamples++;
          if (costumeOutfits.has(avatar.outfit.style)) costumeOutfitSamples++;
          if (everydayCampusOutfits.has(avatar.outfit.style)) everydayCampusOutfitSamples++;
          if (technicalOutfits.has(avatar.outfit.style)) technicalOutfitSamples++;
          if (!naturalHairColors.has(avatar.appearance.hairColor.toLowerCase())) accentHairColorSamples++;
          mouthTypes.add(avatar.appearance.mouthStyle);
          if (upbeatMouthStyles.has(avatar.appearance.mouthStyle)) upbeatMouthSamples++;
          if (avatar.appearance.mouthStyle === 'neutral') neutralMouthSamples++;
          if (avatar.appearance.facialHair === 'none') {
            cleanShavenSamples++;
          } else {
            facialHairSamples++;
            if (avatar.appearance.presentation === 'female') femaleFacialHairSamples++;
            if (accessories.some((accessory) => coveredHairAccessories.has(accessory))) coveredFacialHairSamples++;
          }
        }
      } finally {
        Math.random = originalRandom;
      }

      return {
        invalidCount: invalid.length,
        firstInvalid: invalid[0] || null,
        coveredSkinBands: Object.values(bandCounts).filter((count) => count > 0).length,
        presentationSkinBandCounts: {
          male: presentationBands.male.size,
          female: presentationBands.female.size,
        },
        bodyVariety: bodyTypes.size,
        maleSamples,
        femaleSamples,
        commonBodySamples,
        specializedBodySamples,
        costumeAccessorySamples,
        manualOnlyAccessorySamples,
        coveredFacialHairSamples,
        femaleFacialHairSamples,
        expressiveManualHairSamples,
        costumeOutfitSamples,
        everydayCampusOutfitSamples,
        technicalOutfitSamples,
        accentHairColorSamples,
        hijabSamples,
        headwrapSamples,
        coveredHairSamples,
        bantuKnotsSamples,
        facialHairSamples,
        cleanShavenSamples,
        layeredAccessorySamples,
        currentCampusAccessorySamples,
        currentCampusAccessoryVariety: campusAccessoryTypes.size,
        mouthVariety: mouthTypes.size,
        upbeatMouthSamples,
        neutralMouthSamples,
      };
    });

    expect(summary.invalidCount, summary.firstInvalid || 'random avatars should validate').toBe(0);
    expect(summary.coveredSkinBands).toBe(4);
    expect(summary.presentationSkinBandCounts.male).toBe(4);
    expect(summary.presentationSkinBandCounts.female).toBe(4);
    expect(Math.abs(summary.maleSamples - summary.femaleSamples)).toBeLessThanOrEqual(80);
    expect(summary.bodyVariety).toBeGreaterThanOrEqual(24);
    expect(summary.commonBodySamples).toBeGreaterThan(summary.specializedBodySamples);
    expect(summary.costumeAccessorySamples).toBe(0);
    expect(summary.manualOnlyAccessorySamples).toBe(0);
    expect(summary.coveredFacialHairSamples).toBe(0);
    expect(summary.femaleFacialHairSamples).toBe(0);
    expect(summary.expressiveManualHairSamples).toBe(0);
    expect(summary.costumeOutfitSamples).toBe(0);
    expect(summary.everydayCampusOutfitSamples).toBeGreaterThan(560);
    expect(summary.technicalOutfitSamples).toBeLessThan(50);
    expect(summary.accentHairColorSamples).toBeLessThan(40);
    expect(summary.hijabSamples).toBeGreaterThan(0);
    expect(summary.headwrapSamples).toBe(0);
    expect(summary.coveredHairSamples).toBeGreaterThan(0);
    expect(summary.bantuKnotsSamples).toBe(0);
    expect(summary.facialHairSamples).toBeGreaterThan(0);
    expect(summary.cleanShavenSamples).toBeGreaterThan(0);
    expect(summary.layeredAccessorySamples).toBeGreaterThan(0);
    expect(summary.currentCampusAccessorySamples).toBeGreaterThan(60);
    expect(summary.currentCampusAccessoryVariety).toBe(6);
    expect(summary.mouthVariety).toBeGreaterThanOrEqual(7);
    expect(summary.upbeatMouthSamples).toBeGreaterThan(360);
    expect(summary.neutralMouthSamples).toBeLessThan(40);
  });

  test('Milestone power layer supports every tier without becoming a customization control', async ({ page }) => {
    await page.goto(GYM_URL);

    const tiers = await page.locator('#gym-entrance [data-gym-hero-svg]').first().evaluate((svg) => {
      const result = {};
      for (const tier of ['bronze', 'silver', 'gold', 'diamond']) {
        window.HeroAvatar.applyMilestoneToSvg(svg, tier);
        result[tier] = {
          attr: svg.getAttribute('data-hero-milestone'),
          visibleLayerCount: Array.from(svg.querySelectorAll(`[data-hero-slot="milestone-power"][data-hero-option="${tier}"]`))
            .filter((group) => group.getAttribute('display') === 'inline').length,
          metal: getComputedStyle(svg).getPropertyValue('--hero-milestone-metal').trim(),
        };
      }
      window.HeroAvatar.applyMilestoneToSvg(svg, 'none');
      result.none = {
        attr: svg.getAttribute('data-hero-milestone'),
        visibleNonNoneLayerCount: Array.from(svg.querySelectorAll('[data-hero-slot="milestone-power"]'))
          .filter((group) => group.getAttribute('data-hero-option') !== 'none' && group.getAttribute('display') === 'inline').length,
      };
      return result;
    });

    for (const tier of ['bronze', 'silver', 'gold', 'diamond']) {
      expect(tiers[tier].attr).toBe(tier);
      expect(tiers[tier].visibleLayerCount).toBeGreaterThanOrEqual(2);
      expect(tiers[tier].metal).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(tiers.none).toEqual({ attr: 'none', visibleNonNoneLayerCount: 0 });

    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await expect(page.locator('#hero-customizer-modal [data-hero-choice="milestone"]')).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Customize your hero' })).toBeVisible();
  });

  test('Exercise milestones automatically make page heroes look more powerful', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.evaluate(() => {
      PersonalGym.setAnalyzePerformance(true);
      PersonalGym.saveStats({ milestone: { seen: 1000, correct: 950 } });
    });

    await page.reload();

    await expect(page.locator('#milestone-banner')).toContainText('Diamond milestone');
    const heroes = page.locator('#gym-entrance [data-gym-hero-svg]');
    await expect(heroes.first()).toHaveAttribute('data-hero-milestone', 'diamond');
    await expect(heroes.nth(1)).toHaveAttribute('data-hero-milestone', 'diamond');
    await expect(heroes.first().locator('[data-hero-slot="milestone-power"][data-hero-option="diamond"]').first())
      .toHaveAttribute('display', 'inline');
  });

  test('Unsaved page heroes randomize independently on load', async ({ page }) => {
    await page.addInitScript(() => {
      let seed = 1357911;
      Math.random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };
    });
    await page.goto(GYM_URL);

    const signatures = await entranceHeroSignatures(page);
    expect(signatures.length).toBeGreaterThanOrEqual(2);
    expect(new Set(signatures).size).toBeGreaterThan(1);
    expect(await page.evaluate(() => localStorage.getItem('se-gym-hero-avatar'))).toBeNull();
  });

  test('Hero SVGs are hidden until avatar customization is applied', async ({ page }) => {
    await page.goto(GYM_URL);

    const readiness = await page.locator('#gym-entrance [data-gym-hero-svg]').evaluateAll((svgs) =>
      svgs.map((svg) => ({
        ready: svg.getAttribute('data-hero-avatar-ready'),
        opacity: getComputedStyle(svg).opacity,
      }))
    );
    expect(readiness.length).toBeGreaterThanOrEqual(2);
    for (const hero of readiness) {
      expect(hero.ready).toBe('true');
      expect(hero.opacity).toBe('1');
    }

    const preHydrationStyles = await page.evaluate(() => {
      const original = document.querySelector('#gym-entrance [data-gym-hero-svg]');
      const clone = original.cloneNode(true);
      clone.removeAttribute('data-hero-avatar-ready');
      document.body.appendChild(clone);
      const hiddenOpacity = getComputedStyle(clone).opacity;
      clone.setAttribute('data-hero-avatar-ready', 'true');
      const readyOpacity = getComputedStyle(clone).opacity;
      clone.remove();
      return { hiddenOpacity, readyOpacity };
    });

    expect(preHydrationStyles).toEqual({ hiddenOpacity: '0', readyOpacity: '1' });
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
    await page.getByLabel('Hair style', { exact: true }).selectOption('long');
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
    await page.getByLabel('Head shape', { exact: true }).selectOption('default');
    await page.getByLabel('Hair style', { exact: true }).selectOption('long');

    const faceLayer = page.locator(
      '#hero-customizer-modal [data-gym-hero-svg] [data-hero-slot="face-clear"][data-hero-option="default"]'
    );
    await expect(faceLayer).toHaveAttribute('display', 'inline');
    await expect(page.locator(
      '#hero-customizer-modal [data-gym-hero-svg] [data-hero-slot="hairline"][data-hero-option="long"]'
    )).toHaveAttribute('display', 'inline');

    const layerComposition = await page.locator('#hero-customizer-modal [data-gym-hero-svg]')
      .evaluate((svg) => {
        const hair = svg.querySelector('[data-hero-slot="hair"][data-hero-option="long"]');
        const faceClear = svg.querySelector('[data-hero-slot="face-clear"][data-hero-option="default"]');
        const hairline = svg.querySelector('[data-hero-slot="hairline"][data-hero-option="long"]');
        const eyebrow = svg.querySelector('[data-hero-slot="eyebrow"][data-hero-option="arched"]');
        const skinGradient = svg.querySelector('linearGradient[id^="skin-"]');
        return {
          skinGradientUnits: skinGradient && skinGradient.getAttribute('gradientUnits'),
          skinGradientY1: skinGradient && skinGradient.getAttribute('y1'),
          skinGradientY2: skinGradient && skinGradient.getAttribute('y2'),
          faceAfterHair: Boolean(
            hair &&
            faceClear &&
            (hair.compareDocumentPosition(faceClear) & Node.DOCUMENT_POSITION_FOLLOWING)
          ),
          hairlineAfterFaceClear: Boolean(
            faceClear &&
            hairline &&
            (faceClear.compareDocumentPosition(hairline) & Node.DOCUMENT_POSITION_FOLLOWING)
          ),
          eyebrowAfterHairline: Boolean(
            hairline &&
            eyebrow &&
            (hairline.compareDocumentPosition(eyebrow) & Node.DOCUMENT_POSITION_FOLLOWING)
          ),
        };
      });

    expect(layerComposition).toEqual({
      skinGradientUnits: 'userSpaceOnUse',
      skinGradientY1: '82',
      skinGradientY2: '270',
      faceAfterHair: true,
      hairlineAfterFaceClear: true,
      eyebrowAfterHairline: true,
    });

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

  test('Long and side-panel hair styles connect cleanly at the temples', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await clearAccessories(page);

    const styles = [
      'long',
      'long-layers',
      'straight-long-layers',
      'long-straight',
      'loose-waves',
      'wavy-lob',
      'side-part-lob',
      'wolf-cut',
      'sleek-bob-bangs',
      'curtain-bangs',
      'soft-bangs',
      'low-pony-bangs',
      'butterfly-layers',
      'wavy',
      'center-part',
      'shoulder-length',
      'half-up',
      'locs',
      'box-braids',
      'ponytail',
    ];
    const sidePanelStyles = [
      'long',
      'long-layers',
      'straight-long-layers',
      'long-straight',
      'loose-waves',
      'wavy-lob',
      'side-part-lob',
      'wolf-cut',
      'sleek-bob-bangs',
      'curtain-bangs',
      'soft-bangs',
      'low-pony-bangs',
      'butterfly-layers',
      'wavy',
      'center-part',
      'shoulder-length',
      'half-up',
    ];

    const connectivityFailures = await page.evaluate(({ styles, sidePanelStyles }) => {
      const svg = document.querySelector('#hero-customizer-modal [data-gym-hero-svg]');
      const sidePanelSet = new Set(sidePanelStyles);
      const baseState = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(window.HeroAvatar.DEFAULTS)));
      baseState.outfit.accessory = 'none';
      baseState.outfit.accessories = [];

      function pointHits(points) {
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
      }

      const failures = [];
      for (const style of styles) {
        const state = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(baseState)));
        state.appearance.hairStyle = style;
        window.HeroAvatar.applyToSvg(svg, state);

        const root = svg.querySelector('[data-hero-slot="hair-root"][data-hero-option="' + style + '"]');
        if (!root || root.getAttribute('display') !== 'inline') {
          failures.push({
            style,
            name: 'hair root display',
            slot: root && root.getAttribute('data-hero-slot'),
            option: root && root.getAttribute('data-hero-option'),
            display: root && root.getAttribute('display'),
          });
        }

        const templeSlots = pointHits([
          { name: 'left temple root', x: 356, y: 178 },
          { name: 'right temple root', x: 444, y: 178 },
        ]);
        for (const point of templeSlots) {
          if (point.slot !== 'hair-root' || point.option !== style) {
            failures.push(Object.assign({ style }, point));
          }
        }

        if (sidePanelSet.has(style)) {
          const filledBackHairSlots = pointHits([
            { name: 'left crown volume', x: 360, y: 170 },
            { name: 'right crown volume', x: 440, y: 170 },
            { name: 'left hair behind head', x: 346, y: 205 },
            { name: 'right hair behind head', x: 454, y: 205 },
          ]);

          for (const point of filledBackHairSlots) {
            const validCrownLayer = point.name.includes('crown volume') && ['hair', 'hair-root', 'hairline'].includes(point.slot);
            const validBackHairLayer = !point.name.includes('crown volume') && point.slot === 'hair';
            if (point.option !== style || (!validCrownLayer && !validBackHairLayer)) {
              failures.push(Object.assign({ style }, point));
            }
          }
        }
      }
      return failures;
    }, { styles, sidePanelStyles });

    expect(
      connectivityFailures,
      'Long and side-panel hair styles should connect at temples and fill side panels'
    ).toEqual([]);
  });

  test('Every selectable hair style keeps the facial feature area clear', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await clearAccessories(page);

    const blockedFeatureHitsByStyle = await page.evaluate(() => {
      const svg = document.querySelector('#hero-customizer-modal [data-gym-hero-svg]');
      const styles = Array.from(document.querySelectorAll('#hero-cust-hair-style option'))
        .map((node) => node.value)
        .filter(Boolean);
      const baseState = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(window.HeroAvatar.DEFAULTS)));
      baseState.appearance.headStyle = 'soft-oval';
      baseState.outfit.accessory = 'none';
      baseState.outfit.accessories = [];

      return styles.map((style) => {
        const state = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(baseState)));
        state.appearance.hairStyle = style;
        window.HeroAvatar.applyToSvg(svg, state);

        const blockedFeatureHits = (() => {
          const points = [
            { name: 'left eye', x: 381, y: 185 },
            { name: 'right eye', x: 419, y: 185 },
            { name: 'left cheek', x: 366, y: 204 },
            { name: 'right cheek', x: 434, y: 204 },
            { name: 'mouth', x: 400, y: 225 },
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
          }).filter((hit) => ['hair', 'hairline', 'hair-root'].includes(hit.slot));
        })();

        return { style, blockedFeatureHits };
      }).filter((result) => result.blockedFeatureHits.length > 0);
    });

    expect(
      blockedFeatureHitsByStyle,
      'No selectable hair style should place hair over eyes, cheeks, or mouth'
    ).toEqual([]);
  });

  test('Bantu knots sit on a connected hairline without exposing the scalp', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await clearAccessories(page);

    await page.getByLabel('Head shape', { exact: true }).selectOption('soft-oval');
    await page.getByLabel('Hair style', { exact: true }).selectOption('bantu-knots');

    const preview = page.locator('#hero-customizer-modal [data-gym-hero-svg]');
    await expect(preview.locator('[data-hero-slot="hair"][data-hero-option="bantu-knots"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="hairline"][data-hero-option="bantu-knots"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="hair-root"][data-hero-option="bantu-knots"]'))
      .toHaveAttribute('display', 'inline');

    const hairlineCoverage = await preview.evaluate((svg) => {
      const points = [
        { name: 'top forehead hairline', x: 400, y: 158 },
        { name: 'left temple hairline', x: 360, y: 168 },
        { name: 'right temple hairline', x: 440, y: 168 },
        { name: 'center knot', x: 400, y: 106 },
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

    expect(hairlineCoverage).toEqual([
      { name: 'top forehead hairline', slot: 'hairline', option: 'bantu-knots' },
      { name: 'left temple hairline', slot: 'hair-root', option: 'bantu-knots' },
      { name: 'right temple hairline', slot: 'hair-root', option: 'bantu-knots' },
      { name: 'center knot', slot: 'hair', option: 'bantu-knots' },
    ]);
  });

  test('Raised and tied hair options keep the scalp visually connected', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await clearAccessories(page);

    await page.getByLabel('Head shape', { exact: true }).selectOption('soft-oval');
    const hairStyle = page.getByLabel('Hair style', { exact: true });
    const preview = page.locator('#hero-customizer-modal [data-gym-hero-svg]');
    const styles = [
      'coily-puff',
      'double-puffs',
      'bantu-knots',
      'bun',
      'space-buns',
      'low-bun',
      'messy-bun',
      'claw-clip-updo',
      'ponytail',
      'high-pony',
      'sleek-low-pony',
      'pigtails',
      'top-knot',
    ];

    for (const style of styles) {
      await hairStyle.selectOption(style);
      await expect(preview.locator(`[data-hero-slot="hairline"][data-hero-option="${style}"]`))
        .toHaveAttribute('display', 'inline');
      await expect(preview.locator(`[data-hero-slot="hair-root"][data-hero-option="${style}"]`))
        .toHaveAttribute('display', 'inline');

      const coverage = await preview.evaluate((svg) => {
        const points = [
          { name: 'top forehead hairline', x: 400, y: 158 },
          { name: 'left temple root', x: 356, y: 178 },
          { name: 'right temple root', x: 444, y: 178 },
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

      expect(coverage[0], `${style} should have visible hairline at the forehead`).toMatchObject({
        slot: 'hairline',
        option: style,
      });
      expect(coverage[1], `${style} should connect at the left temple`).toMatchObject({
        slot: 'hair-root',
        option: style,
      });
      expect(coverage[2], `${style} should connect at the right temple`).toMatchObject({
        slot: 'hair-root',
        option: style,
      });
    }
  });

  test('Close-cropped hair aligns with taller head shapes', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await clearAccessories(page);

    const hairStyle = page.getByLabel('Hair style', { exact: true });
    const headShape = page.getByLabel('Head shape', { exact: true });
    const preview = page.locator('#hero-customizer-modal [data-gym-hero-svg]');

    await headShape.selectOption('oblong');
    for (const style of ['fade', 'buzz']) {
      await hairStyle.selectOption(style);
      await expect(preview.locator(`[data-hero-slot="hair"][data-hero-option="${style}"]`))
        .toHaveAttribute('display', 'inline');

      const alignment = await preview.evaluate((svg) => {
        const hair = svg.querySelector('[data-hero-slot="hair"][display="inline"]');
        const head = svg.querySelector('[data-hero-slot="head-shape"][display="inline"]');
        const hairBox = hair.getBBox();
        const headBox = head.getBBox();
        return {
          hairTop: hairBox.y,
          headTop: headBox.y,
          hairBottom: hairBox.y + hairBox.height,
        };
      });

      expect(alignment.hairTop).toBeLessThanOrEqual(alignment.headTop + 2);
      expect(alignment.hairBottom).toBeGreaterThan(176);
    }
  });

  test('New campus hair and multiple headwear styles update the preview', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await clearAccessories(page);
    await page.getByLabel('Hair style', { exact: true }).selectOption('coils');
    await page.getByLabel('Outfit style', { exact: true }).selectOption('hoodie');
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
    await expect(page.getByLabel('Hair style', { exact: true })).toHaveValue('coils');
  });

  test('Textured crop and rectangular glasses update the preview', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await clearAccessories(page);
    await page.getByLabel('Hair style', { exact: true }).selectOption('textured-crop');
    await page.getByLabel('Rectangular glasses', { exact: true }).check();

    const preview = page.locator('#hero-customizer-modal [data-gym-hero-svg]');
    await expect(preview.locator('[data-hero-slot="hair"][data-hero-option="textured-crop"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="accessory"][data-hero-option="rectangular-glasses"]'))
      .toHaveAttribute('display', 'inline');
  });

  test('Dark skin and dark hair combinations keep feature separation', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await clearAccessories(page);

    await setColorInput(page, '#hero-cust-skin', '#3d2515');
    await setColorInput(page, '#hero-cust-hair-color', '#1a1a1a');
    await page.getByLabel('Hair style', { exact: true }).selectOption('center-part');
    await page.getByLabel('Head shape', { exact: true }).selectOption('oblong');
    await page.getByLabel('Mouth', { exact: true }).selectOption('full-lips');
    await page.getByLabel('Glasses', { exact: true }).check();

    const preview = page.locator('#hero-customizer-modal [data-gym-hero-svg]');
    await expect(preview.locator('[data-hero-slot="hair"][data-hero-option="center-part"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="accessory"][data-hero-option="glasses"]'))
      .toHaveAttribute('display', 'inline');

    const tokens = await preview.evaluate((svg) => {
      const styles = getComputedStyle(svg);
      const roundFrame = svg.querySelector('[data-hero-slot="accessory"][data-hero-option="glasses"] circle');
      const gradientStop = svg.querySelector('linearGradient[id^="hair-grad-"] stop');
      const nose = svg.querySelector('[data-hero-slot="nose-shape"][data-hero-option="soft"] [data-hero-face-detail="nose"]');
      const smileLine = svg.querySelector('[data-hero-slot="mouth-style"][data-hero-option="smile"] path[stroke*="--hero-mouth-line"]');
      const cheek = svg.querySelector('ellipse[fill*="--hero-cheek"]');
      const lipFill = svg.querySelector('[data-hero-slot="mouth-style"][data-hero-option="full-lips"] path[fill*="--hero-lip-fill"]');
      const lipHighlight = svg.querySelector('[data-hero-slot="mouth-style"][data-hero-option="full-lips"] path[stroke*="--hero-lip-highlight"]');
      const faceClear = svg.querySelector('[data-hero-slot="face-clear"][data-hero-option="oblong"]');
      const facePolish = svg.querySelector('[data-hero-polish="face"]');
      const eyebrow = svg.querySelector('[data-hero-slot="eyebrow"][data-hero-option="arched"]');
      return {
        skin: styles.getPropertyValue('--hero-skin-light').trim(),
        skinHighlightSoft: styles.getPropertyValue('--hero-skin-highlight-soft').trim(),
        skinMid: styles.getPropertyValue('--hero-skin-mid').trim(),
        facePlaneShadow: styles.getPropertyValue('--hero-face-plane-shadow').trim(),
        jawLine: styles.getPropertyValue('--hero-jaw-line').trim(),
        hairLight: styles.getPropertyValue('--hero-hair-light').trim(),
        hairRim: styles.getPropertyValue('--hero-hair-rim').trim(),
        faceLine: styles.getPropertyValue('--hero-face-line').trim(),
        faceMark: styles.getPropertyValue('--hero-face-mark').trim(),
        mouthLine: styles.getPropertyValue('--hero-mouth-line').trim(),
        eyebrow: styles.getPropertyValue('--hero-eyebrow').trim(),
        cheekFill: cheek ? getComputedStyle(cheek).fill.trim() : '',
        cheekOpacity: cheek ? getComputedStyle(cheek).opacity.trim() : '',
        lipFill: lipFill ? getComputedStyle(lipFill).fill.trim() : '',
        lipHighlight: lipHighlight ? getComputedStyle(lipHighlight).stroke.trim() : '',
        glassesFrame: styles.getPropertyValue('--hero-glasses-frame').trim(),
        glassesFrameDark: styles.getPropertyValue('--hero-glasses-frame-dark').trim(),
        noseFill: nose ? getComputedStyle(nose).fill.trim() : '',
        noseOpacity: nose ? getComputedStyle(nose).opacity.trim() : '',
        contourOpacity: styles.getPropertyValue('--hero-contour-opacity').trim(),
        hairDetailOpacity: styles.getPropertyValue('--hero-hair-detail-opacity').trim(),
        faceHighlightOpacity: styles.getPropertyValue('--hero-face-highlight-opacity').trim(),
        faceShadowOpacity: styles.getPropertyValue('--hero-face-shadow-opacity').trim(),
        jawLineOpacity: styles.getPropertyValue('--hero-jaw-line-opacity').trim(),
        neckShadowOpacity: styles.getPropertyValue('--hero-neck-shadow-opacity').trim(),
        smileLineStroke: smileLine ? getComputedStyle(smileLine).stroke.trim() : '',
        roundGlassesStroke: roundFrame ? getComputedStyle(roundFrame).stroke.trim() : '',
        gradientStop: gradientStop ? gradientStop.getAttribute('stop-color') : '',
        polishAfterFaceClear: Boolean(
          faceClear &&
          facePolish &&
          (faceClear.compareDocumentPosition(facePolish) & Node.DOCUMENT_POSITION_FOLLOWING)
        ),
        featuresAfterPolish: Boolean(
          facePolish &&
          eyebrow &&
          (facePolish.compareDocumentPosition(eyebrow) & Node.DOCUMENT_POSITION_FOLLOWING)
        ),
      };
    });

    expect(tokens.polishAfterFaceClear).toBe(true);
    expect(tokens.featuresAfterPolish).toBe(true);
    expect(tokens.skinHighlightSoft.toLowerCase()).not.toBe(tokens.skin.toLowerCase());
    expect(tokens.skinMid.toLowerCase()).not.toBe(tokens.skin.toLowerCase());
    expect(contrastRatio(tokens.glassesFrame, tokens.skin)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(tokens.glassesFrameDark, tokens.skin)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(tokens.roundGlassesStroke, tokens.skin)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(tokens.hairRim, tokens.skin)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(tokens.faceLine, tokens.skin)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(tokens.faceMark, tokens.skin)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(tokens.cheekFill, tokens.skin)).toBeLessThanOrEqual(1.8);
    expect(contrastRatio(tokens.lipFill, tokens.skin)).toBeLessThanOrEqual(2.1);
    expect(contrastRatio(tokens.lipHighlight, tokens.lipFill)).toBeLessThanOrEqual(1.6);
    expect(contrastRatio(tokens.mouthLine, tokens.skin)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(tokens.smileLineStroke, tokens.skin)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(tokens.noseFill, tokens.skin)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(tokens.eyebrow, tokens.skin)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(tokens.jawLine, tokens.skin)).toBeGreaterThanOrEqual(3);
    expect(Number(tokens.noseOpacity)).toBeGreaterThanOrEqual(0.9);
    expect(Number(tokens.cheekOpacity)).toBeLessThanOrEqual(0.4);
    expect(Number(tokens.contourOpacity)).toBeGreaterThanOrEqual(0.5);
    expect(Number(tokens.hairDetailOpacity)).toBeGreaterThanOrEqual(0.7);
    expect(Number(tokens.faceHighlightOpacity)).toBeGreaterThanOrEqual(0.18);
    expect(Number(tokens.faceShadowOpacity)).toBeGreaterThanOrEqual(0.24);
    expect(Number(tokens.jawLineOpacity)).toBeGreaterThanOrEqual(0.4);
    expect(Number(tokens.neckShadowOpacity)).toBeGreaterThanOrEqual(0.5);
    expect(tokens.hairLight.toLowerCase()).not.toBe(tokens.hairRim.toLowerCase());
    expect(tokens.gradientStop).toContain('--hero-hair-light');
  });

  test('Additional culturally flexible outfit and accessory options update the preview', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await clearAccessories(page);

    await page.getByLabel('Outfit style', { exact: true }).selectOption('kurta-top');
    await page.getByLabel('Wireframe glasses', { exact: true }).check();
    await page.getByLabel('Small hoop earrings', { exact: true }).check();
    await page.getByLabel('Forehead jewel', { exact: true }).check();

    const preview = page.locator('#hero-customizer-modal [data-gym-hero-svg]');
    await expect(preview.locator('[data-hero-slot="outfit-style"][data-hero-option="kurta-top"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="accessory"][data-hero-option="wireframe-glasses"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="accessory"][data-hero-option="hoop-earrings"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="accessory"][data-hero-option="forehead-jewel"]'))
      .toHaveAttribute('display', 'inline');

    await clearAccessories(page);
    await page.getByLabel('Hair style', { exact: true }).selectOption('straight-long-layers');
    await page.getByLabel('Outfit style', { exact: true }).selectOption('campus-blouse');
    await page.getByLabel('Hair clips', { exact: true }).check();
    await expect(preview.locator('[data-hero-slot="hair"][data-hero-option="straight-long-layers"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="hairline"][data-hero-option="straight-long-layers"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="outfit-style"][data-hero-option="campus-blouse"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="accessory"][data-hero-option="hair-clips"]'))
      .toHaveAttribute('display', 'inline');

    await clearAccessories(page);
    await page.getByLabel('Hair style', { exact: true }).selectOption('long-straight');
    await page.getByLabel('Outfit style', { exact: true }).selectOption('collared-shirt');
    await page.getByLabel('Draped head scarf', { exact: true }).check();
    await expect(preview.locator('[data-hero-slot="outfit-style"][data-hero-option="collared-shirt"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="accessory"][data-hero-option="draped-scarf"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="hair"][data-hero-option="long-straight"]'))
      .toHaveAttribute('display', 'none');

    await clearAccessories(page);
    await page.getByLabel('Outfit style', { exact: true }).selectOption('cardigan');
    await expect(preview.locator('[data-hero-slot="outfit-style"][data-hero-option="cardigan"]'))
      .toHaveAttribute('display', 'inline');

    for (const outfit of ['captain-jacket', 'utility-vest']) {
      await page.getByLabel('Outfit style', { exact: true }).selectOption(outfit);
      await expect(preview.locator(`[data-hero-slot="outfit-style"][data-hero-option="${outfit}"]`))
        .toHaveAttribute('display', 'inline');
    }

    for (const outfit of ['crewneck-sweatshirt', 'flannel-overshirt', 'striped-knit']) {
      await page.getByLabel('Outfit style', { exact: true }).selectOption(outfit);
      await expect(preview.locator(`[data-hero-slot="outfit-style"][data-hero-option="${outfit}"]`))
        .toHaveAttribute('display', 'inline');
    }

    for (const label of ['Round-rim glasses', 'Safety goggles', 'Tech visor', 'Over-ear headphones', 'Wireless earbuds', 'Wired earbuds', 'Chain necklace', 'Campus lanyard', 'Bandana']) {
      await clearAccessories(page);
      await page.getByLabel(label, { exact: true }).check();
      const checkedValue = await page.getByLabel(label, { exact: true }).inputValue();
      await expect(preview.locator(`[data-hero-slot="accessory"][data-hero-option="${checkedValue}"]`))
        .toHaveAttribute('display', 'inline');
    }
  });

  test('Expanded natural hair styles update the preview', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await clearAccessories(page);

    const hairStyle = page.getByLabel('Hair style', { exact: true });
    const preview = page.locator('#hero-customizer-modal [data-gym-hero-svg]');
      const styles = [
      'textured-fringe',
      'straight-fringe',
      'side-parted-short',
      'soft-two-block',
      'middle-part-flow',
      'slick-back',
      'long-layers',
      'long-straight',
      'loose-waves',
      'wavy-lob',
      'side-part-lob',
      'wolf-cut',
      'sleek-bob-bangs',
      'curtain-bangs',
      'soft-bangs',
      'straight-long-layers',
      'low-pony-bangs',
      'butterfly-layers',
      'curly-bob',
      'voluminous-curls',
      'curly-layers',
      'coils',
      'two-strand-twists',
      'twist-out',
      'coily-puff',
      'double-puffs',
      'bantu-knots',
      'rounded-afro',
      'loose-locs',
      'long-braid',
      'french-braid',
      'braided-pony',
      'side-braid',
      'braided-bun',
      'knotless-braids',
      'layered-bob',
      'high-pony',
      'space-buns',
      'sleek-low-pony',
      'claw-clip-updo',
    ];
    const hairlineStyles = new Set(['textured-fringe', 'middle-part-flow', 'straight-long-layers', 'wavy-lob', 'side-part-lob', 'wolf-cut', 'sleek-bob-bangs', 'soft-bangs', 'low-pony-bangs', 'butterfly-layers', 'curly-layers', 'coils', 'two-strand-twists', 'twist-out', 'coily-puff', 'double-puffs', 'bantu-knots', 'french-braid', 'braided-pony', 'knotless-braids', 'space-buns', 'claw-clip-updo']);

    for (const style of styles) {
      await hairStyle.selectOption(style);
      await expect(hairStyle).toHaveValue(style);
      await expect(preview.locator(`[data-hero-slot="hair"][data-hero-option="${style}"]`))
        .toHaveAttribute('display', 'inline');
      if (hairlineStyles.has(style)) {
        await expect(preview.locator(`[data-hero-slot="hairline"][data-hero-option="${style}"]`))
          .toHaveAttribute('display', 'inline');
      }
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

    const preview = page.locator('#hero-customizer-modal [data-gym-hero-svg]');
    const headShape = page.getByLabel('Head shape', { exact: true });
    const shapes = ['diamond', 'full-oval', 'tapered-oval', 'gentle-taper', 'soft-round-jaw', 'soft-angular'];

    for (const shape of shapes) {
      await headShape.selectOption(shape);
      await expect(preview.locator(`[data-hero-slot="head-shape"][data-hero-option="${shape}"]`))
        .toHaveAttribute('display', 'inline');
      await expect(preview.locator(`[data-hero-slot="head-features"][data-hero-option="${shape}"]`))
        .toHaveAttribute('display', 'inline');
      await expect(headShape).toHaveValue(shape);
    }
    await expect(preview.locator('[data-hero-slot="head-shape"][data-hero-option="default"]'))
      .toHaveAttribute('display', 'none');
  });

  test('Facial hair and facial details update the preview', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();

    const preview = page.locator('#hero-customizer-modal [data-gym-hero-svg]');
    const facialHair = page.getByLabel('Facial hair', { exact: true });
    const faceFeature = page.getByLabel('Facial details', { exact: true });
    const cheekTint = page.getByLabel('Cheek tint', { exact: true });

    for (const value of [
      'stubble',
      'mustache',
      'soul-patch',
      'goatee',
      'sideburns',
      'chin-strap',
      'short-beard',
      'trimmed-beard',
      'full-beard',
    ]) {
      await facialHair.selectOption(value);
      await expect(facialHair).toHaveValue(value);
      await expect(preview.locator(`[data-hero-slot="facial-hair"][data-hero-option="${value}"]`))
        .toHaveAttribute('display', 'inline');
    }
    for (const value of ['short-beard', 'trimmed-beard', 'full-beard']) {
      await facialHair.selectOption(value);
      const beardIsOpaque = await preview
        .locator(`[data-hero-slot="facial-hair"][data-hero-option="${value}"]`)
        .evaluate((group) => Array.from(group.querySelectorAll('[fill]:not([fill="none"])'))
          .every((node) => Number(node.getAttribute('opacity') || '1') >= 0.85));
      expect(beardIsOpaque).toBe(true);
    }

    for (const value of ['freckles', 'beauty-mark', 'dimples', 'cheek-lines']) {
      await faceFeature.selectOption(value);
      await expect(faceFeature).toHaveValue(value);
      await expect(preview.locator(`[data-hero-slot="face-feature"][data-hero-option="${value}"]`))
        .toHaveAttribute('display', 'inline');
    }

    await cheekTint.selectOption('none');
    await expect(cheekTint).toHaveValue('none');
    const hiddenCheekOpacities = await preview.locator('ellipse[fill*="--hero-cheek"]').evaluateAll((nodes) =>
      nodes.map((node) => Number(getComputedStyle(node).opacity))
    );
    expect(hiddenCheekOpacities.length).toBeGreaterThan(0);
    expect(hiddenCheekOpacities.every((opacity) => opacity === 0)).toBe(true);

    await faceFeature.selectOption('freckles');
    await expect(preview.locator('[data-hero-slot="face-feature"][data-hero-option="freckles"]'))
      .toHaveAttribute('display', 'inline');
    const stillHiddenCheeks = await preview.locator('ellipse[fill*="--hero-cheek"]').evaluateAll((nodes) =>
      nodes.every((node) => Number(getComputedStyle(node).opacity) === 0)
    );
    expect(stillHiddenCheeks).toBe(true);

    await cheekTint.selectOption('natural');
    await expect(cheekTint).toHaveValue('natural');
    const visibleCheekOpacity = await preview.locator('ellipse[fill*="--hero-cheek"]').evaluateAll((nodes) =>
      Math.max(...nodes.map((node) => Number(getComputedStyle(node).opacity)))
    );
    expect(visibleCheekOpacity).toBeGreaterThan(0);

    await facialHair.selectOption('none');
    await faceFeature.selectOption('none');
    await expect(preview.locator('[data-hero-slot="facial-hair"][data-hero-option="none"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="face-feature"][data-hero-option="none"]'))
      .toHaveAttribute('display', 'inline');
  });

  test('Expanded facial structure controls update the preview', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();

    const preview = page.locator('#hero-customizer-modal [data-gym-hero-svg]');
    const eyeShape = page.getByLabel('Eye shape', { exact: true });
    const noseShape = page.getByLabel('Nose shape', { exact: true });
    const mouth = page.getByLabel('Mouth', { exact: true });

    for (const value of ['almond', 'single-eyelid', 'soft-single-eyelid', 'hooded', 'smiling', 'wide']) {
      await eyeShape.selectOption(value);
      await expect(eyeShape).toHaveValue(value);
      await expect(preview.locator(`[data-hero-slot="eye-shape"][data-hero-option="${value}"]`))
        .toHaveAttribute('display', 'inline');
      const irisDetailsAreClipped = await preview
        .locator(`[data-hero-slot="eye-shape"][data-hero-option="${value}"]`)
        .evaluate((group) => Array.from(group.querySelectorAll('circle')).every((circle) => circle.closest('g[clip-path]')));
      expect(irisDetailsAreClipped).toBe(true);
    }

    for (const value of ['rounded', 'broad', 'narrow', 'button', 'defined-bridge', 'rounded-tip', 'soft-upturned', 'gentle-bridge', 'soft-low-bridge']) {
      await noseShape.selectOption(value);
      await expect(noseShape).toHaveValue(value);
      await expect(preview.locator(`[data-hero-slot="nose-shape"][data-hero-option="${value}"]`))
        .toHaveAttribute('display', 'inline');
    }

    for (const value of ['soft-smile', 'grin', 'neutral', 'full-lips', 'bright-smile', 'cheerful-grin', 'open-smile', 'excited-smile']) {
      await mouth.selectOption(value);
      await expect(mouth).toHaveValue(value);
      await expect(preview.locator(`[data-hero-slot="mouth-style"][data-hero-option="${value}"]`))
        .toHaveAttribute('display', 'inline');
    }

    await eyeShape.selectOption('round');
    await noseShape.selectOption('soft');
    await mouth.selectOption('smile');
    await expect(preview.locator('[data-hero-slot="eye-shape"][data-hero-option="round"]'))
      .toHaveAttribute('display', 'inline');
    const roundIrisDetailsAreClipped = await preview
      .locator('[data-hero-slot="eye-shape"][data-hero-option="round"]')
      .evaluate((group) => Array.from(group.querySelectorAll('circle')).every((circle) => circle.closest('g[clip-path]')));
    expect(roundIrisDetailsAreClipped).toBe(true);
    await expect(preview.locator('[data-hero-slot="nose-shape"][data-hero-option="soft"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="mouth-style"][data-hero-option="smile"]'))
      .toHaveAttribute('display', 'inline');
  });

  test('Typing an emoji into the emblem updates the preview text', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await page.getByLabel('Emblem (one emoji)').fill('🚀');
    const preview = page.locator('#hero-customizer-modal .hero-cust-preview [data-gym-hero-svg]');
    const emblemText = preview.locator('[data-hero-emblem-text]');
    await expect(emblemText).toHaveText('🚀');
    const emblemGroup = preview.locator('[data-hero-slot="emblem"]');
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
    await page.getByLabel('Outfit style', { exact: true }).selectOption('varsity-jacket');
    await clearAccessories(page);
    await page.getByLabel('Rectangular glasses', { exact: true }).check();
    await page.getByLabel('Earrings', { exact: true }).check();
    await page.getByLabel('Hair style', { exact: true }).selectOption('afro');
    await page.getByLabel('Head shape', { exact: true }).selectOption('soft-square');
    await page.getByLabel('Body type', { exact: true }).selectOption('broad');
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

  test('Use random heroes removes saved customization and restores independent page randomization', async ({ page }) => {
    await page.addInitScript(() => {
      let seed = 97531;
      Math.random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };
    });

    await page.goto(GYM_URL);
    await page.evaluate(() => {
      const state = {
        version: 1,
        appearance: {
          skin: '#dfa07a',
          hairColor: '#101010',
          hairStyle: 'locs',
          eyeColor: '#1f140c',
          eyebrowStyle: 'arched',
          headStyle: 'soft-square',
          eyeShape: 'round',
          noseShape: 'soft',
          mouthStyle: 'smile',
          facialHair: 'none',
          faceFeature: 'none',
        },
        body: { type: 'tall' },
        outfit: {
          style: 'varsity-jacket',
          suit: '#1F6EBD',
          capeOuter: '#15538f',
          capeInner: '#FFD100',
          accessory: 'glasses',
          accessories: ['glasses'],
          emblem: '🌟',
        },
      };
      localStorage.setItem('se-gym-hero-avatar', JSON.stringify(state));
    });
    await page.reload();

    const savedSignatures = await entranceHeroSignatures(page);
    expect(savedSignatures.length).toBeGreaterThanOrEqual(2);
    expect(new Set(savedSignatures).size).toBe(1);

    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await page.getByRole('button', { name: 'Use random heroes' }).click();

    await expect(page.locator('#hero-cust-status')).toContainText(/Saved hero removed/i);
    expect(await page.evaluate(() => localStorage.getItem('se-gym-hero-avatar'))).toBeNull();

    const randomSignatures = await entranceHeroSignatures(page);
    expect(randomSignatures.length).toBeGreaterThanOrEqual(2);
    expect(new Set(randomSignatures).size).toBeGreaterThan(1);

    await page.reload();
    const randomReloadSignatures = await entranceHeroSignatures(page);
    expect(new Set(randomReloadSignatures).size).toBeGreaterThan(1);
  });

  test('Expanded body shape options update the hero preview', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();

    const preview = page.locator('#hero-customizer-modal [data-gym-hero-svg]');
    const bodyOptions = [
      'petite-curved',
      'narrow-shoulders',
      'compact-lean',
      'medium-lean',
      'straight',
      'soft',
      'soft-medium',
      'short-soft',
      'short-curved',
      'athletic-curved',
      'soft-athletic',
      'v-shape',
      'compact-strong',
      'broad-lean',
      'solid',
      'tall-lean',
      'tall-soft',
      'tall-curved',
      'balanced-curved',
      'medium-curved',
      'rounded',
      'medium-full',
      'soft-tapered',
      'fuller-hip',
      'soft-full-hips',
      'full-frame',
      'balanced-full',
    ];

    for (const value of bodyOptions) {
      await page.getByLabel('Body type', { exact: true }).selectOption(value);
      await expect(page.getByLabel('Body type', { exact: true })).toHaveValue(value);
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

    await page.getByLabel('Hair style', { exact: true }).selectOption('long-layers');
    await page.getByLabel('Rectangular glasses', { exact: true }).check();
    await page.getByLabel('Hero mask', { exact: true }).check();
    await page.getByLabel('Beanie', { exact: true }).check();
    await page.getByLabel('Hijab', { exact: true }).check();
    await page.getByLabel('Earrings', { exact: true }).check();
    await page.getByLabel('Hair clips', { exact: true }).check();
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
    await expect(preview.locator('[data-hero-slot="accessory"][data-hero-option="hair-clips"]'))
      .toHaveAttribute('display', 'none');
    await expect(preview.locator('[data-hero-slot="accessory"][data-hero-option="halo"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="hair"][data-hero-option="long-layers"]'))
      .toHaveAttribute('display', 'none');
    await expect(preview.locator('[data-hero-slot="hairline"][data-hero-option="long-layers"]'))
      .toHaveAttribute('display', 'none');

    const faceAccessoryOrder = await preview.evaluate((svg) => {
      const mask = svg.querySelector('[data-hero-slot="accessory"][data-hero-option="mask"]');
      const faceFeatures = svg.querySelector('[data-hero-slot="head-features"][data-hero-option="default"]');
      const nose = svg.querySelector('[data-hero-face-detail="nose"]');
      const faceAccessories = ['glasses', 'rectangular-glasses', 'wireframe-glasses', 'round-rim-glasses', 'safety-goggles', 'tech-visor', 'visor', 'spectacles', 'mask', 'monocle', 'eyepatch'];
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
        appearance: { skin: '#dfa07a', hairColor: '#aa3300', hairStyle: 'locs', eyeColor: '#1f140c', eyebrowStyle: 'arched', facialHair: 'none', faceFeature: 'none' },
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
    await page.getByLabel('Hair style', { exact: true }).selectOption('textured-crop');
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
      appearance: { skin: '#dfa07a', hairColor: '#101010', hairStyle: 'ponytail', eyeColor: '#1f140c', eyebrowStyle: 'straight', facialHair: 'none', faceFeature: 'freckles' },
      body: { type: 'curvy' },
      outfit: { suit: '#1F6EBD', capeOuter: '#15538f', capeInner: '#FFD100', accessory: 'rectangular-glasses', accessories: ['rectangular-glasses', 'earrings'], emblem: '' }
    };

    await page.locator('#hero-cust-upload-input').setInputFiles({
      name: 'avatar.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(validAvatar)),
    });
    await expect(page.getByLabel('Hair style', { exact: true })).toHaveValue('ponytail');
    await expect(page.getByLabel('Body type', { exact: true })).toHaveValue('curvy');
    await expect(page.getByLabel('Facial details', { exact: true })).toHaveValue('freckles');
    await expect(page.getByLabel('Cheek tint', { exact: true })).toHaveValue('natural');
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
    const hairStyle = page.getByLabel('Hair style', { exact: true });
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
