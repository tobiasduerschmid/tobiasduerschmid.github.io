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
      const commonBodyTypes = new Set(['average', 'athletic', 'lean', 'slim', 'straight', 'soft', 'medium-lean', 'soft-medium']);
      const specializedBodyTypes = new Set([
        'petite-curved', 'narrow-shoulders', 'compact-lean', 'athletic-curved',
        'muscular', 'compact-strong', 'broad-lean', 'tall-lean', 'tall-curved',
        'soft-tapered', 'hourglass', 'pear', 'soft-full-hips', 'voluptuous',
        'plus-size', 'balanced-full',
      ]);
      const costumeAccessories = new Set(['crown', 'halo', 'monocle', 'eyepatch', 'mask']);
      const coveredHairAccessories = new Set(['draped-scarf', 'hijab']);
      const expressiveManualHair = new Set(['mohawk', 'bowl-cut', 'pigtails', 'top-knot']);
      const everydayCampusOutfits = new Set(['hoodie', 'varsity-jacket', 'denim-jacket', 'windbreaker', 'collared-shirt', 'kurta-top', 'cardigan']);
      const costumeOutfits = new Set(['super-suit', 'captain-jacket']);
      const technicalOutfits = new Set(['lab-coat', 'utility-vest']);
      const naturalHairColors = new Set([
        '#1f140c', '#3d2818', '#6a4830', '#a07050', '#c08555', '#d8b074',
        '#e8d090', '#704530', '#1a1a1a', '#2e2e2e', '#5e3a2f', '#854a3a', '#7a4a2f',
      ]);
      const bandCounts = { light: 0, medium: 0, deep: 0, darkest: 0 };
      const presentationBands = { male: new Set(), female: new Set() };
      const bodyTypes = new Set();
      const invalid = [];
      let maleSamples = 0;
      let femaleSamples = 0;
      let commonBodySamples = 0;
      let specializedBodySamples = 0;
      let costumeAccessorySamples = 0;
      let coveredFacialHairSamples = 0;
      let femaleFacialHairSamples = 0;
      let expressiveManualHairSamples = 0;
      let costumeOutfitSamples = 0;
      let everydayCampusOutfitSamples = 0;
      let technicalOutfitSamples = 0;
      let accentHairColorSamples = 0;
      let hijabSamples = 0;
      let coveredHairSamples = 0;
      let facialHairSamples = 0;
      let cleanShavenSamples = 0;
      let layeredAccessorySamples = 0;

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
          if (accessories.some((accessory) => costumeAccessories.has(accessory))) costumeAccessorySamples++;
          if (accessories.includes('hijab')) hijabSamples++;
          if (accessories.some((accessory) => coveredHairAccessories.has(accessory) || accessory === 'headwrap' || accessory === 'turban')) coveredHairSamples++;
          if (expressiveManualHair.has(avatar.appearance.hairStyle)) expressiveManualHairSamples++;
          if (costumeOutfits.has(avatar.outfit.style)) costumeOutfitSamples++;
          if (everydayCampusOutfits.has(avatar.outfit.style)) everydayCampusOutfitSamples++;
          if (technicalOutfits.has(avatar.outfit.style)) technicalOutfitSamples++;
          if (!naturalHairColors.has(avatar.appearance.hairColor.toLowerCase())) accentHairColorSamples++;
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
        coveredFacialHairSamples,
        femaleFacialHairSamples,
        expressiveManualHairSamples,
        costumeOutfitSamples,
        everydayCampusOutfitSamples,
        technicalOutfitSamples,
        accentHairColorSamples,
        hijabSamples,
        coveredHairSamples,
        facialHairSamples,
        cleanShavenSamples,
        layeredAccessorySamples,
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
    expect(summary.coveredFacialHairSamples).toBe(0);
    expect(summary.femaleFacialHairSamples).toBe(0);
    expect(summary.expressiveManualHairSamples).toBe(0);
    expect(summary.costumeOutfitSamples).toBe(0);
    expect(summary.everydayCampusOutfitSamples).toBeGreaterThan(560);
    expect(summary.technicalOutfitSamples).toBeLessThan(50);
    expect(summary.accentHairColorSamples).toBeLessThan(40);
    expect(summary.hijabSamples).toBeGreaterThan(0);
    expect(summary.coveredHairSamples).toBeGreaterThan(0);
    expect(summary.facialHairSamples).toBeGreaterThan(0);
    expect(summary.cleanShavenSamples).toBeGreaterThan(0);
    expect(summary.layeredAccessorySamples).toBeGreaterThan(0);
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

  test('Additional culturally flexible outfit and accessory options update the preview', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await clearAccessories(page);

    await page.getByLabel('Outfit style').selectOption('kurta-top');
    await page.getByLabel('Wireframe glasses', { exact: true }).check();
    await page.getByLabel('Small hoop earrings', { exact: true }).check();
    await page.getByLabel('Forehead accent', { exact: true }).check();

    const preview = page.locator('#hero-customizer-modal [data-gym-hero-svg]');
    await expect(preview.locator('[data-hero-slot="outfit-style"][data-hero-option="kurta-top"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="accessory"][data-hero-option="wireframe-glasses"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="accessory"][data-hero-option="hoop-earrings"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="accessory"][data-hero-option="forehead-accent"]'))
      .toHaveAttribute('display', 'inline');

    await clearAccessories(page);
    await page.getByLabel('Hair style').selectOption('long-straight');
    await page.getByLabel('Outfit style').selectOption('collared-shirt');
    await page.getByLabel('Draped scarf', { exact: true }).check();
    await expect(preview.locator('[data-hero-slot="outfit-style"][data-hero-option="collared-shirt"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="accessory"][data-hero-option="draped-scarf"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="hair"][data-hero-option="long-straight"]'))
      .toHaveAttribute('display', 'none');

    await clearAccessories(page);
    await page.getByLabel('Outfit style').selectOption('cardigan');
    await expect(preview.locator('[data-hero-slot="outfit-style"][data-hero-option="cardigan"]'))
      .toHaveAttribute('display', 'inline');

    for (const outfit of ['captain-jacket', 'utility-vest']) {
      await page.getByLabel('Outfit style').selectOption(outfit);
      await expect(preview.locator(`[data-hero-slot="outfit-style"][data-hero-option="${outfit}"]`))
        .toHaveAttribute('display', 'inline');
    }

    for (const label of ['Round-rim glasses', 'Safety goggles', 'Tech visor']) {
      await clearAccessories(page);
      await page.getByLabel(label, { exact: true }).check();
      const checkedValue = await page.getByLabel(label, { exact: true }).inputValue();
      await expect(preview.locator(`[data-hero-slot="accessory"][data-hero-option="${checkedValue}"]`))
        .toHaveAttribute('display', 'inline');
    }
  });

  test('Expanded natural hair styles update the preview', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await clearAccessories(page);

    const hairStyle = page.getByLabel('Hair style');
    const preview = page.locator('#hero-customizer-modal [data-gym-hero-svg]');
    const styles = [
      'straight-fringe',
      'side-parted-short',
      'soft-two-block',
      'slick-back',
      'long-layers',
      'long-straight',
      'loose-waves',
      'curtain-bangs',
      'curly-bob',
      'voluminous-curls',
      'coily-puff',
      'double-puffs',
      'bantu-knots',
      'rounded-afro',
      'loose-locs',
      'long-braid',
      'side-braid',
      'braided-bun',
      'layered-bob',
      'high-pony',
      'sleek-low-pony',
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

    const preview = page.locator('#hero-customizer-modal [data-gym-hero-svg]');
    const headShape = page.getByLabel('Head shape');
    const shapes = ['diamond', 'full-oval', 'tapered-oval', 'soft-round-jaw', 'soft-angular'];

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
    const facialHair = page.getByLabel('Facial hair');
    const faceFeature = page.getByLabel('Facial details');

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
    const eyeShape = page.getByLabel('Eye shape');
    const noseShape = page.getByLabel('Nose shape');
    const mouth = page.getByLabel('Mouth');

    for (const value of ['almond', 'monolid', 'hooded', 'smiling', 'wide']) {
      await eyeShape.selectOption(value);
      await expect(eyeShape).toHaveValue(value);
      await expect(preview.locator(`[data-hero-slot="eye-shape"][data-hero-option="${value}"]`))
        .toHaveAttribute('display', 'inline');
    }

    for (const value of ['rounded', 'broad', 'narrow', 'button', 'defined-bridge']) {
      await noseShape.selectOption(value);
      await expect(noseShape).toHaveValue(value);
      await expect(preview.locator(`[data-hero-slot="nose-shape"][data-hero-option="${value}"]`))
        .toHaveAttribute('display', 'inline');
    }

    for (const value of ['soft-smile', 'grin', 'neutral', 'full-lips']) {
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
      'athletic-curved',
      'v-shape',
      'compact-strong',
      'broad-lean',
      'stocky',
      'tall-lean',
      'tall-curved',
      'balanced-curved',
      'medium-curved',
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
      appearance: { skin: '#dfa07a', hairColor: '#101010', hairStyle: 'ponytail', eyeColor: '#1f140c', eyebrowStyle: 'straight', facialHair: 'none', faceFeature: 'freckles' },
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
    await expect(page.getByLabel('Facial details')).toHaveValue('freckles');
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
