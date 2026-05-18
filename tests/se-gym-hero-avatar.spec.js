// @ts-check
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');

const A11Y_FEATURE = 'se-gym-hero-avatar';
const GYM_URL = '/se-gym/';

const ACTIVATE_TOGGLE_SLIDER = '#activatePersonalGymToggle + .slider';

const CHOICE_PREVIEW_VIEWBOXES = {
  full: '238 34 324 596',
  hair: '292 54 216 346',
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
  upper: '246 86 308 374',
};

const DEFAULT_SAVED_HERO = {
  version: 1,
  kind: 'human',
  appearance: {
    skin: '#dfa07a',
    hairColor: '#1f140c',
    hairStyle: 'short',
    eyeColor: '#1f140c',
    eyebrowStyle: 'arched',
    headStyle: 'default',
    eyeShape: 'round',
    eyelashStyle: 'none',
    noseShape: 'soft',
    mouthStyle: 'smile',
    blushStyle: 'natural',
    facialHair: 'none',
    faceFeature: 'none',
  },
  body: { type: 'athletic' },
  outfit: {
    style: 'super-suit',
    suit: '#1F6EBD',
    capeOuter: '#15538f',
    capeInner: '#FFD100',
    accessory: 'none',
    accessories: [],
    emblem: '',
  },
};

async function clearState(page) {
  await page.context().clearCookies();
  await page.evaluate(() => {
    try { localStorage.removeItem('se-gym-hero-avatar'); } catch (e) { /* */ }
  });
}

async function useDefaultSavedHero(page) {
  await page.addInitScript((hero) => {
    localStorage.setItem('se-gym-hero-avatar', JSON.stringify(hero));
  }, DEFAULT_SAVED_HERO);
}

async function installStaticChoicePreviewManifest(page, assets) {
  await page.route('**/assets/se-gym-hero-choice-previews/*.svg', async (route) => {
    await route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#FFD100"/><path d="M3 6Q8 1 13 6V14H3Z" fill="#2774AE"/></svg>',
    });
  });
  await page.addInitScript(({ manifestAssets }) => {
    window.SEGymHeroChoicePreviewBaseUrl = '/assets/se-gym-hero-choice-previews/';
    window.SEGymHeroChoicePreviews = {
      count: Object.values(manifestAssets).reduce((total, group) => total + Object.keys(group).length, 0),
      assets: manifestAssets,
    };
  }, { manifestAssets: assets });
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

function heroCustomizerActions(page, placement = 'top') {
  return page.getByRole('group', { name: placement === 'top' ? 'Top hero customizer actions' : 'Bottom hero customizer actions' });
}

function heroCustomizerAction(page, name, placement = 'top') {
  return heroCustomizerActions(page, placement).getByRole('button', {
    name,
    exact: typeof name === 'string',
  });
}

async function scrollChoiceButtonIntoView(page, accessibleName) {
  const button = page.getByRole('button', { name: accessibleName });
  await button.evaluate((element) => {
    element.scrollIntoView({ block: 'center', inline: 'nearest' });
    const scrollRoot = element.closest('.hero-cust-box');
    if (scrollRoot) scrollRoot.dispatchEvent(new Event('scroll', { bubbles: true }));
  });
  await expect(button).toBeVisible();
  return button;
}

async function scrollHeroCustomizerToTop(page) {
  await page.locator('#hero-customizer-modal').evaluate(async (modal) => {
    const scrollRoot = modal.querySelector('.hero-cust-box');
    if (!scrollRoot) return;
    scrollRoot.scrollTop = 0;
    scrollRoot.dispatchEvent(new Event('scroll', { bubbles: true }));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function choicePreviewSvg(page, accessibleName) {
  const button = await scrollChoiceButtonIntoView(page, accessibleName);
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

  test('Hero customizer actions are available at the top and bottom of the modal', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();

    for (const placement of ['top', 'bottom']) {
      const actions = heroCustomizerActions(page, placement);
      await expect(actions).toBeVisible();
      for (const name of ['Randomize', 'Reset', 'Use random heroes', 'Download', 'Upload', 'Cancel', 'Save']) {
        await expect(heroCustomizerAction(page, name, placement)).toBeVisible();
      }
    }
  });

  test('Opening hero customizer pauses page hero SVG animations but keeps modal preview live', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);

    const readAnimationState = async () => page.evaluate(() => {
      const pageSvgs = Array.from(document.querySelectorAll(
        '#gym-entrance [data-gym-hero-svg], #gym-workout [data-gym-hero-svg]'
      ));
      const modalSvg = document.querySelector('#hero-customizer-modal [data-gym-hero-svg]');
      const cssAnimated = Array.from(document.querySelectorAll(
        '#gym-entrance [data-gym-hero-svg], #gym-entrance [data-gym-hero-svg] *, #gym-workout [data-gym-hero-svg], #gym-workout [data-gym-hero-svg] *'
      )).filter((node) => getComputedStyle(node).animationName !== 'none');

      return {
        pageCount: pageSvgs.length,
        pagePaused: pageSvgs.map((svg) => svg.animationsPaused()),
        modalPaused: modalSvg ? modalSvg.animationsPaused() : null,
        cssAnimatedCount: cssAnimated.length,
        cssPaused: cssAnimated.every((node) => getComputedStyle(node).animationPlayState === 'paused'),
      };
    });

    const closedBefore = await readAnimationState();
    expect(closedBefore.pageCount).toBeGreaterThan(0);
    expect(closedBefore.pagePaused).toEqual(closedBefore.pagePaused.map(() => false));

    await page.getByRole('button', { name: 'Customize Hero' }).click();
    const openState = await readAnimationState();
    expect(openState.pagePaused).toEqual(openState.pagePaused.map(() => true));
    expect(openState.modalPaused).toBe(false);
    if (openState.cssAnimatedCount > 0) expect(openState.cssPaused).toBe(true);

    await heroCustomizerAction(page, 'Cancel').click();
    const closedAfter = await readAnimationState();
    expect(closedAfter.pagePaused).toEqual(closedAfter.pagePaused.map(() => false));
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

  test('Accessory choices render representative preview thumbnails', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await clearAccessories(page);

    const choices = [
      { label: 'Headset with mic', value: 'headset-mic' },
      { label: 'Plain cross pendant', value: 'cross-pendant' },
      { label: 'Six-point star pendant', value: 'six-point-star-pendant' },
      { label: 'Eight-spoke wheel pendant', value: 'wheel-pendant' },
      { label: 'Sacred syllable pendant', value: 'sacred-syllable-pendant' },
      { label: 'Open hand pendant', value: 'open-hand-pendant' },
      { label: 'Student ID badge', value: 'student-id-badge' },
      { label: 'Backpack straps', value: 'backpack-straps' },
      { label: 'Messenger bag strap', value: 'messenger-bag' },
      { label: 'Circuit pin', value: 'circuit-pin' },
      { label: 'Code patch', value: 'code-patch' },
      { label: 'Utility belt', value: 'utility-belt' },
      { label: 'Embroidered prayer cap', value: 'embroidered-prayer-cap' },
      { label: 'Wrapped dastar', value: 'wrapped-dastar' },
      { label: 'Hero cape clasp', value: 'hero-cape-clasp' },
    ];

    for (const choice of choices) {
      const card = page.locator('#hero-customizer-modal label.hero-cust-accessory-choice').filter({ hasText: choice.label });
      await expect(card, `${choice.label} should be listed as an accessory choice`).toHaveCount(1);
      await card.evaluate((el) => {
        const scrollRoot = el.closest('.hero-cust-box');
        el.scrollIntoView({ block: 'center', inline: 'nearest' });
        if (scrollRoot) scrollRoot.dispatchEvent(new Event('scroll', { bubbles: true }));
      });
      await card.locator('input[type="checkbox"]').focus();

      const svg = card.locator('[data-hero-choice-svg]');
      await expect(svg, `${choice.label} should render a representative accessory thumbnail`).toHaveCount(1);
      await expect(svg.locator(`[data-hero-slot="accessory"][data-hero-option="${choice.value}"]`))
        .toHaveAttribute('display', 'inline');
      await expect(svg).toHaveAttribute('viewBox', /-?\d+(\.\d+)?\s+-?\d+(\.\d+)?\s+\d+(\.\d+)?\s+\d+(\.\d+)?/);

      const framing = await svg.evaluate((node, value) => {
        function parseBox(raw) {
          const parts = String(raw || '').trim().split(/\s+/).map(Number);
          if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return null;
          return {
            x: parts[0],
            y: parts[1],
            width: parts[2],
            height: parts[3],
            right: parts[0] + parts[2],
            bottom: parts[1] + parts[3],
          };
        }
        function unionBox(a, b) {
          if (!a) return b;
          if (!b) return a;
          const x = Math.min(a.x, b.x);
          const y = Math.min(a.y, b.y);
          const right = Math.max(a.right, b.right);
          const bottom = Math.max(a.bottom, b.bottom);
          return { x, y, width: right - x, height: bottom - y, right, bottom };
        }
        const viewBox = parseBox(node.getAttribute('viewBox'));
        const upper = parseBox('246 86 308 374');
        const feature = Array.from(node.querySelectorAll(`[data-hero-slot="accessory"][data-hero-option="${value}"] *`)).reduce((box, featureNode) => {
          try {
            const bbox = featureNode.getBBox();
            if (!bbox || bbox.width <= 0 || bbox.height <= 0) return box;
            return unionBox(box, {
              x: bbox.x,
              y: bbox.y,
              width: bbox.width,
              height: bbox.height,
              right: bbox.x + bbox.width,
              bottom: bbox.y + bbox.height,
            });
          } catch (e) {
            return box;
          }
        }, null);
        const tolerance = 0.5;
        return {
          viewBox: node.getAttribute('viewBox'),
          contained: Boolean(viewBox && feature &&
            feature.x >= viewBox.x - tolerance &&
            feature.y >= viewBox.y - tolerance &&
            feature.right <= viewBox.right + tolerance &&
            feature.bottom <= viewBox.bottom + tolerance),
          featureArea: feature ? feature.width * feature.height : 0,
          localArea: viewBox ? viewBox.width * viewBox.height : 0,
          upperArea: upper.width * upper.height,
        };
      }, choice.value);
      expect(framing.viewBox, `${choice.label} should not reuse the generic upper-body accessory crop`)
        .not.toBe(CHOICE_PREVIEW_VIEWBOXES.upper);
      expect(framing.contained, `${choice.label} crop should contain its accessory geometry`).toBe(true);
      expect(framing.localArea, `${choice.label} crop should stay local to the represented accessory`)
        .toBeLessThan(framing.upperArea * 0.85);
      if (choice.value === 'code-patch') {
        expect(framing.featureArea, 'Code patch thumbnail should expose readable code-mark geometry')
          .toBeGreaterThan(1200);
      }
      if (choice.value === 'hero-cape-clasp') {
        expect(framing.featureArea, 'Hero cape clasp thumbnail should expose the shoulder clasp geometry')
          .toBeGreaterThan(3000);
      }
      if (choice.value === 'headset-mic') {
        const micAfterMouth = await svg.evaluate((node) => {
          const mouth = node.querySelector('[data-hero-slot="mouth-style"][data-hero-option="smile"]');
          const mic = node.querySelector('[data-hero-accessory-part="mic-boom"]');
          return Boolean(mouth && mic && (mouth.compareDocumentPosition(mic) & Node.DOCUMENT_POSITION_FOLLOWING));
        });
        expect(micAfterMouth, 'Headset mic boom should layer in front of the mouth').toBe(true);
      }
    }
  });

  test('Style preview buttons declare registry crops and frame represented details', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await clearAccessories(page);

    const previewCrops = [
      { key: 'heroKind', crop: 'full', viewBox: CHOICE_PREVIEW_VIEWBOXES.full },
      { key: 'hairStyle', crop: 'hair', viewBox: CHOICE_PREVIEW_VIEWBOXES.hair },
      { key: 'eyebrowStyle', crop: 'eyebrows', viewBox: CHOICE_PREVIEW_VIEWBOXES.eyebrows },
      { key: 'eyeShape', crop: 'eyes', viewBox: CHOICE_PREVIEW_VIEWBOXES.eyes },
      { key: 'eyelashStyle', crop: 'eyes', viewBox: CHOICE_PREVIEW_VIEWBOXES.eyes },
      { key: 'noseShape', crop: 'nose', viewBox: CHOICE_PREVIEW_VIEWBOXES.nose },
      { key: 'mouthStyle', crop: 'mouth', viewBox: CHOICE_PREVIEW_VIEWBOXES.mouth },
      { key: 'blushStyle', crop: 'cheeks', viewBox: CHOICE_PREVIEW_VIEWBOXES.cheeks },
      { key: 'headStyle', crop: 'head-shape', viewBox: CHOICE_PREVIEW_VIEWBOXES['head-shape'] },
      { key: 'facialHair', crop: 'facial-hair', viewBox: CHOICE_PREVIEW_VIEWBOXES['facial-hair'] },
      { key: 'faceFeature', crop: 'face-detail', viewBox: CHOICE_PREVIEW_VIEWBOXES['face-detail'] },
      { key: 'bodyType', crop: 'body', viewBox: CHOICE_PREVIEW_VIEWBOXES.body },
      { key: 'outfitStyle', crop: 'outfit', viewBox: CHOICE_PREVIEW_VIEWBOXES.outfit },
    ];

    const pickerCrops = await page.evaluate(() =>
      Object.fromEntries(Array.from(document.querySelectorAll('[data-hero-choice-picker]')).map((picker) => [
        picker.getAttribute('data-hero-choice-picker'),
        {
          crop: picker.getAttribute('data-preview-crop'),
          viewBox: picker.getAttribute('data-preview-viewbox'),
          registryCrop: window.HeroAvatar.CHOICE_SETS[picker.getAttribute('data-hero-choice-picker')].preview,
        },
      ]))
    );

    for (const crop of previewCrops) {
      expect(pickerCrops[crop.key], `${crop.key} picker should declare the crop used by its rendered previews`).toEqual({
        crop: crop.crop,
        viewBox: crop.viewBox,
        registryCrop: crop.crop,
      });
    }

    const hairSvg = await choicePreviewSvg(page, 'Choose Hair style: Long and flowing');
    const hairCrop = await hairSvg.evaluate((svg) => {
      function parseBox(value) {
        const parts = String(value || '').trim().split(/\s+/).map(Number);
        if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return null;
        return {
          x: parts[0],
          y: parts[1],
          width: parts[2],
          height: parts[3],
          right: parts[0] + parts[2],
          bottom: parts[1] + parts[3],
        };
      }

      function unionBox(a, b) {
        if (!a) return b;
        if (!b) return a;
        const x = Math.min(a.x, b.x);
        const y = Math.min(a.y, b.y);
        const right = Math.max(a.right, b.right);
        const bottom = Math.max(a.bottom, b.bottom);
        return { x, y, width: right - x, height: bottom - y, right, bottom };
      }

      function visibleBox(selector) {
        return Array.from(svg.querySelectorAll(selector)).reduce((box, node) => {
          if (node.closest('[display="none"]')) return box;
          try {
            const bbox = node.getBBox();
            if (!bbox || bbox.width <= 0 || bbox.height <= 0) return box;
            return unionBox(box, {
              x: bbox.x,
              y: bbox.y,
              width: bbox.width,
              height: bbox.height,
              right: bbox.x + bbox.width,
              bottom: bbox.y + bbox.height,
            });
          } catch (e) {
            return box;
          }
        }, null);
      }

      const viewBox = parseBox(svg.getAttribute('viewBox'));
      const declared = parseBox(svg.closest('[data-hero-choice-picker]').getAttribute('data-preview-viewbox'));
      const feature = visibleBox(
        '[data-hero-slot="hair"][data-hero-option="long"], ' +
        '[data-hero-slot="hairline"][data-hero-option="long"], ' +
        '[data-hero-slot="hair-root"][data-hero-option="long"]'
      );
      const tolerance = 0.5;
      return {
        viewBox: svg.getAttribute('viewBox'),
        declared: svg.closest('[data-hero-choice-picker]').getAttribute('data-preview-viewbox'),
        validViewBox: Boolean(viewBox && viewBox.width > 0 && viewBox.height > 0),
        matchesDeclared: Boolean(
          viewBox &&
          declared &&
          Math.abs(viewBox.x - declared.x) <= tolerance &&
          Math.abs(viewBox.y - declared.y) <= tolerance &&
          Math.abs(viewBox.width - declared.width) <= tolerance &&
          Math.abs(viewBox.height - declared.height) <= tolerance
        ),
        hairFullyInside: Boolean(
          viewBox && feature &&
          feature.x >= viewBox.x - tolerance &&
          feature.y >= viewBox.y - tolerance &&
          feature.right <= viewBox.right + tolerance &&
          feature.bottom <= viewBox.bottom + tolerance
        ),
      };
    });
    expect(hairCrop.validViewBox, `long hair preview should render with a valid viewBox, got ${hairCrop.viewBox}`).toBe(true);
    expect(hairCrop.matchesDeclared, `long hair preview should use the taller registry crop ${hairCrop.declared}`).toBe(true);
    expect(hairCrop.hairFullyInside, `long hair should fit inside the preview frame ${hairCrop.viewBox}`).toBe(true);
  });

  test('Choice thumbnails render visible options first and defer offscreen options until requested', async ({ page }) => {
    await useDefaultSavedHero(page);
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();

    const visibleChoice = page.getByRole('button', { name: 'Choose Hero type: Human hero' });
    await expect(visibleChoice.locator('[data-hero-choice-svg]')).toHaveCount(1);

    const totalButtons = await page.locator('#hero-customizer-modal .hero-cust-choice-button').count();
    const renderedAtOpen = await page.locator('#hero-customizer-modal [data-hero-choice-svg]').count();
    expect(renderedAtOpen, 'opening the customizer should not eagerly render every choice thumbnail')
      .toBeLessThan(totalButtons);

    const offscreenChoice = page.getByRole('button', { name: 'Choose Outfit style: Utility vest' });
    await expect(offscreenChoice.locator('[data-hero-choice-svg]')).toHaveCount(0);

    await offscreenChoice.focus();
    await expect(offscreenChoice).toBeFocused();
    await expect(offscreenChoice.locator('[data-hero-choice-svg]')).toHaveCount(1);
  });

  test('Production choice thumbnail images start loading when the customizer opens', async ({ page }) => {
    const requestedPreviewAssets = [];
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/assets/se-gym-hero-choice-previews/') && url.endsWith('.svg')) {
        requestedPreviewAssets.push(url);
      }
    });
    await installStaticChoicePreviewManifest(page, {
      hairStyle: { long: 'hair-style-long.svg' },
      outfitStyle: { hoodie: 'outfit-style-hoodie.svg' },
    });

    await page.goto(GYM_URL);

    const longHairButton = page.getByRole('button', {
      name: 'Choose Hair style: Long and flowing',
      includeHidden: true,
    });
    const hoodieButton = page.getByRole('button', {
      name: 'Choose Outfit style: Hoodie',
      includeHidden: true,
    });
    const longHairImage = longHairButton.locator('[data-hero-choice-preview-img]');
    const hoodieImage = hoodieButton.locator('[data-hero-choice-preview-img]');

    await expect(longHairImage).toHaveAttribute('data-hero-choice-preview-src', '/assets/se-gym-hero-choice-previews/hair-style-long.svg');
    await expect(longHairImage).toHaveAttribute('loading', 'eager');
    await expect(longHairImage).not.toHaveAttribute('loading', 'lazy');
    await expect(longHairImage).not.toHaveAttribute('src', /./);
    await expect(hoodieImage).not.toHaveAttribute('src', /./);
    expect(requestedPreviewAssets, 'production thumbnails should not request image files before the modal opens').toEqual([]);

    await activatePersonalGym(page);
    expect(requestedPreviewAssets, 'activating Personal Gym alone should not load the modal thumbnails').toEqual([]);

    await page.getByRole('button', { name: 'Customize Hero' }).click();

    await expect(longHairImage).toHaveAttribute('src', '/assets/se-gym-hero-choice-previews/hair-style-long.svg');
    await expect(hoodieImage).toHaveAttribute('src', '/assets/se-gym-hero-choice-previews/outfit-style-hoodie.svg');
    await expect.poll(() => requestedPreviewAssets.length, {
      message: 'production thumbnails should begin network loading as soon as the modal opens',
      timeout: 5000,
    }).toBe(2);
  });

  test('Production choice thumbnail images use dark-mode-safe preview wells', async ({ page }) => {
    await page.addInitScript(() => {
      document.documentElement.classList.add('dark-mode');
    });
    await installStaticChoicePreviewManifest(page, {
      hairStyle: { long: 'hair-style-long.svg' },
      accessory: { 'headset-mic': 'accessory-headset-mic.svg' },
    });

    await page.goto(GYM_URL);
    await page.evaluate(() => {
      document.documentElement.classList.add('dark-mode');
    });
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();

    const longHairButton = page.getByRole('button', { name: 'Choose Hair style: Long and flowing' });
    const hairImage = longHairButton.locator('[data-hero-choice-preview-img]');
    await expect(hairImage).toHaveAttribute('src', '/assets/se-gym-hero-choice-previews/hair-style-long.svg');
    await expect.poll(async () => hairImage.evaluate((img) => img.complete && img.naturalWidth > 0), {
      message: 'production thumbnail should finish loading in dark mode',
      timeout: 5000,
    }).toBe(true);

    const previewColors = await longHairButton.locator('.hero-cust-choice-preview').evaluate((preview) => {
      const styles = getComputedStyle(preview);
      return {
        top: styles.getPropertyValue('--hero-cust-choice-preview-bg-top').trim(),
        bottom: styles.getPropertyValue('--hero-cust-choice-preview-bg-bottom').trim(),
        border: styles.getPropertyValue('--hero-cust-choice-preview-border').trim(),
        backgroundImage: styles.backgroundImage,
      };
    });

    for (const color of [previewColors.top, previewColors.bottom]) {
      expect(contrastRatio('#2774AE', color), `representative blue hair should remain visible on ${color}`).toBeGreaterThanOrEqual(3);
      expect(contrastRatio('#FFD100', color), `representative gold skin should remain visible on ${color}`).toBeGreaterThanOrEqual(3);
    }
    expect(contrastRatio('#e9ecf2', previewColors.border)).toBeGreaterThanOrEqual(3);
    expect(previewColors.backgroundImage).toContain('linear-gradient');

    const headsetChoice = page.locator('#hero-customizer-modal label.hero-cust-accessory-choice').filter({ hasText: 'Headset with mic' });
    await expect(headsetChoice.locator('[data-hero-choice-preview-img]'))
      .toHaveAttribute('src', '/assets/se-gym-hero-choice-previews/accessory-headset-mic.svg');
  });

  test('Large scroll jumps drop thumbnail work for options that moved far away', async ({ page }) => {
    await useDefaultSavedHero(page);
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();

    const transientChoice = page.getByRole('button', { name: 'Choose Outfit style: Utility vest' });
    await expect(transientChoice.locator('[data-hero-choice-svg]')).toHaveCount(0);

    await transientChoice.evaluate(async (button) => {
      const scrollRoot = button.closest('.hero-cust-box');
      if (!scrollRoot) return;
      button.scrollIntoView({ block: 'center', inline: 'nearest' });
      scrollRoot.dispatchEvent(new Event('scroll', { bubbles: true }));
      scrollRoot.scrollTop = 0;
      scrollRoot.dispatchEvent(new Event('scroll', { bubbles: true }));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });

    await expect(transientChoice).not.toBeInViewport();
    await expect(transientChoice.locator('[data-hero-choice-svg]')).toHaveCount(0);

    await transientChoice.focus();
    await expect(transientChoice.locator('[data-hero-choice-svg]')).toHaveCount(1);
  });

  test('Offscreen representative choice thumbnails are not invalidated by avatar changes', async ({ page }) => {
    await useDefaultSavedHero(page);
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();

    const offscreenChoice = page.getByRole('button', { name: 'Choose Outfit style: Utility vest' });
    const offscreenSvg = await choicePreviewSvg(page, 'Choose Outfit style: Utility vest');

    await scrollHeroCustomizerToTop(page);
    await expect(offscreenChoice).not.toBeInViewport();

    await setColorInput(page, '#hero-cust-skin', '#3d2515');
    await expect(offscreenChoice).not.toHaveAttribute('data-choice-pending', 'true');
    await expect(offscreenSvg).toHaveCSS('visibility', 'visible');

    await offscreenChoice.focus();
    await expect(offscreenChoice.locator('[data-hero-choice-svg]')).toHaveCount(1);
    await expect(offscreenSvg).toHaveCSS('visibility', 'visible');
    await expect(offscreenChoice).not.toHaveAttribute('data-choice-pending', 'true');
  });

  test('Every rendered choice preview uses a valid representative viewport and contains visible art', async ({ page }) => {
    test.setTimeout(90000);
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await clearAccessories(page);

    const previewFailures = await page.evaluate(async () => {
      const modal = document.querySelector('#hero-customizer-modal');
      const scrollRoot = modal && modal.querySelector('.hero-cust-box');
      const buttons = Array.from(modal.querySelectorAll('.hero-cust-choice-button'));
      const failures = [];
      const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      function parseBox(value) {
        const parts = String(value || '').trim().split(/\s+/).map(Number);
        if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return null;
        return {
          x: parts[0],
          y: parts[1],
          width: parts[2],
          height: parts[3],
          right: parts[0] + parts[2],
          bottom: parts[1] + parts[3],
        };
      }

      function intersectionArea(a, b) {
        const left = Math.max(a.x, b.x);
        const top = Math.max(a.y, b.y);
        const right = Math.min(a.x + a.width, b.right);
        const bottom = Math.min(a.y + a.height, b.bottom);
        return Math.max(0, right - left) * Math.max(0, bottom - top);
      }

      function unionBox(a, b) {
        if (!a) return b;
        if (!b) return a;
        const x = Math.min(a.x, b.x);
        const y = Math.min(a.y, b.y);
        const right = Math.max(a.right, b.right);
        const bottom = Math.max(a.bottom, b.bottom);
        return { x, y, width: right - x, height: bottom - y, right, bottom };
      }

      function visibleUnionBox(svg, selector) {
        return Array.from(svg.querySelectorAll(selector)).reduce((box, node) => {
          if (node.closest('[display="none"]')) return box;
          try {
            const bbox = node.getBBox();
            if (!bbox || bbox.width <= 0 || bbox.height <= 0) return box;
            return unionBox(box, {
              x: bbox.x,
              y: bbox.y,
              width: bbox.width,
              height: bbox.height,
              right: bbox.x + bbox.width,
              bottom: bbox.y + bbox.height,
            });
          } catch (e) {
            return box;
          }
        }, null);
      }

      function boxContains(outer, inner) {
        const tolerance = 0.5;
        return Boolean(
          outer && inner &&
          inner.x >= outer.x - tolerance &&
          inner.y >= outer.y - tolerance &&
          inner.right <= outer.right + tolerance &&
          inner.bottom <= outer.bottom + tolerance
        );
      }

      function slotAreaInsideViewBox(svg, slot, option, viewBox) {
        const group = svg.querySelector(`[data-hero-slot="${slot}"][data-hero-option="${option}"]`);
        if (!group || group.getAttribute('display') !== 'inline') return { visible: false, area: 0 };
        if (group.closest('[display="none"]')) return { visible: false, area: 0 };
        try {
          const box = group.getBBox();
          return { visible: true, area: box.width > 0 && box.height > 0 ? intersectionArea(box, viewBox) : 0 };
        } catch (e) {
          return { visible: true, area: 0 };
        }
      }

      function expectOptionSlot(svg, label, key, option, viewBox) {
        const slotByKey = {
          hairStyle: 'hair',
          eyebrowStyle: 'eyebrow',
          eyeShape: 'eye-shape',
          eyelashStyle: 'eyelash-style',
          noseShape: 'nose-shape',
          mouthStyle: 'mouth-style',
          headStyle: 'head-shape',
          facialHair: 'facial-hair',
          faceFeature: 'face-feature',
          outfitStyle: 'outfit-style',
        };
        const slot = slotByKey[key];
        if (!slot) return;

        const emptyOptions = new Set(['bald', 'none', 'clean-shaven', 'super-suit']);
        const strokeOnlyKeys = new Set(['eyebrowStyle']);
        const result = slotAreaInsideViewBox(svg, slot, option, viewBox);
        if (!result.visible) {
          failures.push({ label, key, option, slot, reason: 'option-specific slot is not visible in preview' });
          return;
        }
        if (!strokeOnlyKeys.has(key) && !emptyOptions.has(option) && result.area < 4) {
          failures.push({ label, key, option, slot, reason: 'option-specific slot is outside or empty in preview crop', area: Math.round(result.area) });
        }
        if (key === 'hairStyle' && option !== 'bald') {
          const featureBox = visibleUnionBox(
            svg,
            `[data-hero-slot="hair"][data-hero-option="${option}"], ` +
            `[data-hero-slot="hairline"][data-hero-option="${option}"], ` +
            `[data-hero-slot="hair-root"][data-hero-option="${option}"]`
          );
          if (featureBox && !boxContains(viewBox, featureBox)) {
            failures.push({ label, key, option, reason: 'represented hair extends outside preview crop', viewBox: svg.getAttribute('viewBox') });
          }
        }
      }

      if (!modal || !scrollRoot) return [{ reason: 'missing customizer modal or scroll root' }];

      for (const button of buttons) {
        button.scrollIntoView({ block: 'center', inline: 'nearest' });
        scrollRoot.dispatchEvent(new Event('scroll', { bubbles: true }));
        await nextFrame();
      }

      const deadline = performance.now() + 30000;
      while (performance.now() < deadline) {
        if (buttons.every((button) => button.querySelector('[data-hero-choice-svg]'))) break;
        await nextFrame();
      }

      for (const button of buttons) {
        const picker = button.closest('.hero-cust-choice-picker');
        const svg = button.querySelector('[data-hero-choice-svg]');
        const label = button.getAttribute('aria-label');
        const key = picker && picker.getAttribute('data-hero-choice-picker');
        const option = button.getAttribute('data-choice-value');
        if (!svg) {
          failures.push({ label, reason: 'missing preview svg' });
          continue;
        }
        const box = parseBox(svg.getAttribute('viewBox'));
        if (!box) {
          failures.push({ label, reason: 'invalid viewBox', actual: svg.getAttribute('viewBox') });
          continue;
        }
        expectOptionSlot(svg, label, key, option, box);
        if (key === 'heroKind' && svg.getAttribute('data-hero-kind') !== option) {
          failures.push({ label, key, option, reason: 'hero type preview did not apply the represented option', actual: svg.getAttribute('data-hero-kind') });
        }
        if (key === 'bodyType' && svg.getAttribute('data-hero-body') !== option) {
          failures.push({ label, key, option, reason: 'body type preview did not apply the represented option', actual: svg.getAttribute('data-hero-body') });
        }
      }

      const blushPreviews = Object.fromEntries(Array.from(
        modal.querySelectorAll('[data-hero-choice-picker="blushStyle"] .hero-cust-choice-button')
      ).map((button) => {
        const svg = button.querySelector('[data-hero-choice-svg]');
        return [
          button.getAttribute('data-choice-value'),
          svg ? Number.parseFloat(svg.style.getPropertyValue('--hero-cheek-opacity') || '0') : Number.NaN,
        ];
      }));
      if (!(blushPreviews.natural > 0)) {
        failures.push({ key: 'blushStyle', option: 'natural', reason: 'natural cheek preview should show cheek tint', actual: blushPreviews.natural });
      }
      if (!(blushPreviews.subtle > 0 && blushPreviews.subtle < blushPreviews.natural * 0.75)) {
        failures.push({ key: 'blushStyle', option: 'subtle', reason: 'subtle cheek preview should be visibly lighter than natural', actual: blushPreviews.subtle, natural: blushPreviews.natural });
      }
      if (blushPreviews.none !== 0) {
        failures.push({ key: 'blushStyle', option: 'none', reason: 'none cheek preview should hide cheek tint', actual: blushPreviews.none });
      }

      return failures;
    });

    expect(previewFailures).toEqual([]);
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
      legacyDetails.appearance.faceFeature = 'cheek-lines';
      legacyDetails.body.type = 'stocky';
      legacyDetails.outfit.accessory = 'forehead-accent';
      legacyDetails.outfit.accessories = ['forehead-accent'];

      return {
        hairValues: flatten(window.HeroAvatar.CHOICE_SETS.hairStyle).map((option) => option.value),
        eyeValues: flatten(window.HeroAvatar.CHOICE_SETS.eyeShape).map((option) => option.value),
        eyelashValues: flatten(window.HeroAvatar.CHOICE_SETS.eyelashStyle).map((option) => option.value),
        noseValues: flatten(window.HeroAvatar.CHOICE_SETS.noseShape).map((option) => option.value),
        mouthValues: flatten(window.HeroAvatar.CHOICE_SETS.mouthStyle).map((option) => option.value),
        faceFeatureValues: flatten(window.HeroAvatar.CHOICE_SETS.faceFeature).map((option) => option.value),
        bodyValues: flatten(window.HeroAvatar.CHOICE_SETS.bodyType).map((option) => option.value),
        accessoryValues: flatten(window.HeroAvatar.CHOICE_SETS.accessory).map((option) => option.value),
        hairLabels: labelsByValue(window.HeroAvatar.CHOICE_SETS.hairStyle),
        eyeLabels: labelsByValue(window.HeroAvatar.CHOICE_SETS.eyeShape),
        eyelashLabels: labelsByValue(window.HeroAvatar.CHOICE_SETS.eyelashStyle),
        noseLabels: labelsByValue(window.HeroAvatar.CHOICE_SETS.noseShape),
        mouthLabels: labelsByValue(window.HeroAvatar.CHOICE_SETS.mouthStyle),
        faceFeatureLabels: labelsByValue(window.HeroAvatar.CHOICE_SETS.faceFeature),
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
    expect(summary.eyeValues).toEqual(expect.arrayContaining(['single-eyelid', 'soft-single-eyelid', 'wide-single-eyelid', 'tapered-almond', 'upturned-almond', 'downturned-soft', 'deep-set']));
    expect(summary.eyelashValues).not.toContain('soft-lower');
    expect(summary.eyelashValues).not.toContain('short-lower');
    expect(summary.eyelashValues).toEqual(expect.arrayContaining(['none', 'short-soft', 'short-dense', 'barely-there', 'subtle', 'short-natural', 'short-corner', 'short-upper', 'outer-corner', 'soft-fan', 'full-upper', 'long-classic', 'long-doll', 'long-glam', 'winged', 'dense']));
    expect(summary.noseValues).toEqual(expect.arrayContaining(['low-wide-bridge', 'soft-flat-bridge', 'wide-rounded-tip', 'aquiline-bridge']));
    expect(summary.mouthValues).toEqual(expect.arrayContaining(['small-smile', 'wide-smile', 'soft-full-lips']));
    expect(summary.faceFeatureValues).toEqual(expect.arrayContaining(['nose-freckles', 'small-moles', 'chin-dimple', 'under-eye-lines']));
    expect(summary.bodyValues).not.toContain('pear');
    expect(summary.bodyValues).not.toContain('voluptuous');
    expect(summary.bodyValues).not.toContain('stocky');
    expect(summary.bodyValues).toEqual(expect.arrayContaining(['solid', 'fuller-hip', 'full-frame']));
    expect(summary.accessoryValues).not.toContain('forehead-accent');
    expect(summary.accessoryValues).toContain('forehead-jewel');
    expect(summary.accessoryValues).toEqual(expect.arrayContaining([
      'headset-mic',
      'cross-pendant',
      'six-point-star-pendant',
      'wheel-pendant',
      'sacred-syllable-pendant',
      'open-hand-pendant',
      'student-id-badge',
      'backpack-straps',
      'messenger-bag',
      'circuit-pin',
      'code-patch',
      'utility-belt',
      'embroidered-prayer-cap',
      'wrapped-dastar',
      'hero-cape-clasp',
    ]));
    expect(summary.hairLabels['rounded-afro']).toBe('Rounded Afro');
    expect(summary.hairLabels['locs-bun']).toBe('Locs bun');
    expect(summary.eyeLabels['single-eyelid']).toBe('Single eyelid');
    expect(summary.eyeLabels['soft-single-eyelid']).toBe('Soft single eyelid');
    expect(summary.eyeLabels['wide-single-eyelid']).toBe('Wide single eyelid');
    expect(summary.eyelashLabels['short-soft']).toBe('Short soft');
    expect(summary.eyelashLabels['short-dense']).toBe('Short dense');
    expect(summary.eyelashLabels['outer-corner']).toBe('Outer-corner');
    expect(summary.eyelashLabels['short-upper']).toBe('Short upper');
    expect(summary.eyelashLabels['soft-fan']).toBe('Soft fan');
    expect(summary.eyelashLabels['long-classic']).toBe('Long classic');
    expect(summary.eyelashLabels['long-doll']).toBe('Long doll');
    expect(summary.eyelashLabels['long-glam']).toBe('Long glam');
    expect(summary.noseLabels['low-wide-bridge']).toBe('Low wide bridge');
    expect(summary.mouthLabels['soft-full-lips']).toBe('Soft full lips');
    expect(summary.faceFeatureLabels['under-eye-lines']).toBe('Under-eye lines');
    expect(summary.bodyLabels.solid).toBe('Solid build');
    expect(summary.bodyLabels['full-frame']).toBe('Full frame');
    expect(summary.accessoryLabels['draped-scarf']).toBe('Draped head scarf');
    expect(summary.accessoryLabels['forehead-jewel']).toBe('Forehead jewel');
    expect(summary.accessoryLabels['headset-mic']).toBe('Headset with mic');
    expect(summary.accessoryLabels['cross-pendant']).toBe('Plain cross pendant');
    expect(summary.accessoryLabels['six-point-star-pendant']).toBe('Six-point star pendant');
    expect(summary.accessoryLabels['wheel-pendant']).toBe('Eight-spoke wheel pendant');
    expect(summary.accessoryLabels['sacred-syllable-pendant']).toBe('Sacred syllable pendant');
    expect(summary.accessoryLabels['open-hand-pendant']).toBe('Open hand pendant');
    expect(summary.accessoryLabels['student-id-badge']).toBe('Student ID badge');
    expect(summary.accessoryLabels['utility-belt']).toBe('Utility belt');
    expect(summary.accessoryLabels['code-patch']).toBe('Code patch');
    expect(summary.accessoryLabels['embroidered-prayer-cap']).toBe('Embroidered prayer cap');
    expect(summary.accessoryLabels['wrapped-dastar']).toBe('Wrapped dastar');
    expect(summary.accessoryLabels['hero-cape-clasp']).toBe('Hero cape clasp');
    for (const label of [
      summary.accessoryLabels['cross-pendant'],
      summary.accessoryLabels['six-point-star-pendant'],
      summary.accessoryLabels['wheel-pendant'],
      summary.accessoryLabels['sacred-syllable-pendant'],
      summary.accessoryLabels['open-hand-pendant'],
      summary.accessoryLabels['embroidered-prayer-cap'],
      summary.accessoryLabels['wrapped-dastar'],
    ]) {
      expect(label.toLowerCase()).not.toMatch(/christ|jew|judaism|muslim|islam|hindu|buddh|jain|sikh/);
    }
    expect(summary.accessoryValues).not.toContain('smartwatch');
    expect(summary.accessoryValues).not.toContain('hero-gauntlets');
    expect(summary.legacyLocsValidation.ok).toBe(true);
    expect(summary.normalizedLegacyLocs.appearance.hairStyle).toBe('locs-bun');
    expect(summary.normalizedLegacyLocs.body.type).toBe('full-frame');
    expect(summary.legacyHipValidation.ok).toBe(true);
    expect(summary.normalizedLegacyHip.body.type).toBe('fuller-hip');
    expect(summary.legacyDetailsValidation.ok).toBe(true);
    expect(summary.normalizedLegacyDetails.appearance.eyeShape).toBe('single-eyelid');
    expect(summary.normalizedLegacyDetails.appearance.faceFeature).toBe('none');
    expect(summary.normalizedLegacyDetails.body.type).toBe('solid');
    expect(summary.normalizedLegacyDetails.outfit.accessories).toEqual(['forehead-jewel']);
  });

  test('Style preview buttons keep representative thumbnails after randomize changes the base avatar', async ({ page }) => {
    test.setTimeout(45000);
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();

    const longHairPreview = await choicePreviewSvg(page, 'Choose Hair style: Long and flowing');
    const representativeSkinColor = await longHairPreview.evaluate((svg) =>
      getComputedStyle(svg).getPropertyValue('--hero-skin-light').trim().toLowerCase()
    );
    const representativeHairColor = await longHairPreview.evaluate((svg) =>
      getComputedStyle(svg).getPropertyValue('--hero-hair').trim().toLowerCase()
    );
    expect(representativeSkinColor).toBe('#ffd100');
    expect(representativeHairColor).toBe('#2774ae');

    await setColorInput(page, '#hero-cust-hair-color', '#123456');
    await expect.poll(async () => longHairPreview.evaluate((svg) =>
      getComputedStyle(svg).getPropertyValue('--hero-hair').trim().toLowerCase()
    ), {
      message: 'hair preview button should remain representative after direct color changes',
      timeout: 15000,
    }).toBe(representativeHairColor);

    const randomize = heroCustomizerAction(page, 'Randomize');
    await randomize.click();
    const randomizedHairColor = (await page.getByLabel('Hair color', { exact: true }).inputValue()).toLowerCase();
    expect(randomizedHairColor, 'randomize should choose from generated avatar colors').not.toBe('#123456');

    await scrollChoiceButtonIntoView(page, 'Choose Hair style: Long and flowing');
    await expect.poll(async () => longHairPreview.evaluate((svg) =>
      getComputedStyle(svg).getPropertyValue('--hero-hair').trim().toLowerCase()
    ), {
      message: 'hair preview button should not re-render from the randomized base avatar',
      timeout: 15000,
    }).toBe(representativeHairColor);
  });

  test('Style preview buttons remain representative across mixed avatar changes', async ({ page }) => {
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

    await setSelectInput(page, '#hero-cust-hair-style', 'long');
    await scrollChoiceButtonIntoView(page, 'Choose Eyebrows: Thin');
    await expectNoVisiblePendingChoicePreviews(page);
    await expectChoiceSlotVisible(
      eyebrowThinSvg,
      'hair',
      'short',
      'face previews should keep representative default hair after base hair changes'
    );
    await expectChoiceSlotVisible(
      eyebrowThinSvg,
      'eyebrow',
      'thin',
      'face previews should preserve their own option delta'
    );

    await setCheckboxInput(page, '#hero-customizer-modal input[name="hero-cust-accessory"][value="hijab"]', true);
    await scrollChoiceButtonIntoView(page, 'Choose Hair style: Short crop');
    await expectNoVisiblePendingChoicePreviews(page);
    await expectChoiceSlotVisible(
      shortHairSvg,
      'hair',
      'short',
      'hair previews should keep their represented hair visible even when the live avatar wears headwear'
    );

    await setSelectInput(page, '#hero-cust-body-type', 'broad');
    await expectNoVisiblePendingChoicePreviews(page);
    await scrollChoiceButtonIntoView(page, 'Choose Outfit style: Hoodie');
    await expect.poll(async () => hoodieSvg.evaluate((svg) => svg.getAttribute('data-hero-body')), {
      message: 'outfit previews should keep their representative body type',
      timeout: 15000,
    }).toBe('athletic');

    await setColorInput(page, '#hero-cust-suit', '#7a2cff');
    await expectNoVisiblePendingChoicePreviews(page);
    await expect.poll(async () => hoodieSvg.evaluate((svg) =>
      getComputedStyle(svg).getPropertyValue('--hero-suit').trim().toLowerCase()
    ), {
      message: 'outfit previews should keep their representative suit color',
      timeout: 15000,
    }).toBe('#1f6ebd');
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

    await heroCustomizerAction(page, 'Save').click();
    await expect(page.getByRole('dialog', { name: 'Customize your hero' })).toBeHidden();

    await expect.poll(async () => page.locator('#gym-entrance [data-gym-hero-svg]').evaluateAll((svgs) =>
      svgs.length >= 2 && svgs.every((svg) => svg.getAttribute('data-hero-kind') === 'bruin')
    ), {
      message: 'saved bruin mascot should apply to every page hero',
    }).toBe(true);

    const savedKind = await page.evaluate(() => JSON.parse(localStorage.getItem('se-gym-hero-avatar')).kind);
    expect(savedKind).toBe('bruin');
  });

  test('Mobile hero customizer keeps the live preview visible while controls scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();

    const modal = page.getByRole('dialog', { name: 'Customize your hero' });
    const livePreview = modal.locator('.hero-cust-preview [data-gym-hero-svg]');
    await expect(livePreview).toBeInViewport();

    const outfitStyle = page.getByLabel('Outfit style', { exact: true });
    await outfitStyle.evaluate((select) => {
      select.scrollIntoView({ block: 'center', inline: 'nearest' });
      const scrollRoot = select.closest('.hero-cust-box');
      if (scrollRoot) scrollRoot.dispatchEvent(new Event('scroll', { bubbles: true }));
    });
    await outfitStyle.focus();
    await expect(outfitStyle).toBeFocused();
    await expect(livePreview).toBeInViewport();

    const bottomSave = heroCustomizerAction(page, 'Save', 'bottom');
    await bottomSave.evaluate((button) => {
      button.scrollIntoView({ block: 'center', inline: 'nearest' });
      const scrollRoot = button.closest('.hero-cust-box');
      if (scrollRoot) scrollRoot.dispatchEvent(new Event('scroll', { bubbles: true }));
    });
    await bottomSave.focus();
    await expect(bottomSave).toBeFocused();
    await expect(livePreview).toBeInViewport();

    const geometry = await page.evaluate(() => {
      const preview = document.querySelector('#hero-customizer-modal .hero-cust-preview-pane');
      const focused = document.activeElement;
      if (!preview || !focused) return null;
      const previewRect = preview.getBoundingClientRect();
      const focusRect = focused.getBoundingClientRect();
      return {
        previewTop: previewRect.top,
        previewBottom: previewRect.bottom,
        focusTop: focusRect.top,
        focusBottom: focusRect.bottom,
        viewportHeight: window.innerHeight,
      };
    });

    expect(geometry).not.toBeNull();
    expect(geometry.previewTop, 'sticky live preview should stay inside the top of the mobile viewport').toBeGreaterThanOrEqual(0);
    expect(geometry.previewBottom, 'sticky live preview should not consume the whole mobile viewport').toBeLessThan(geometry.viewportHeight * 0.45);
    expect(geometry.focusTop, 'focused bottom control should not be hidden behind the sticky live preview').toBeGreaterThanOrEqual(geometry.previewBottom - 1);
    expect(geometry.focusBottom, 'focused bottom control should remain inside the mobile viewport').toBeLessThanOrEqual(geometry.viewportHeight);
  });

  test('Avatar color controls expose all presets and HSL sliders on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();

    const colorControls = [
      { presetsLabel: 'Preset swatches for skin', hslLabel: 'HSL sliders for skin', presets: 13 },
      { presetsLabel: 'Preset swatches for hair', hslLabel: 'HSL sliders for hair', presets: 16 },
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

    await expect(page
      .getByRole('group', { name: 'Preset swatches for skin' })
      .getByRole('button', { name: 'Use skin preset #FFD100' })).toBeVisible();
    await expect(page
      .getByRole('group', { name: 'Preset swatches for hair' })
      .getByRole('button', { name: 'Use hair preset #2774AE' })).toBeVisible();

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
      const commonBodyTypes = new Set(['average', 'athletic', 'lean', 'curvy', 'solid']);
      const specializedBodyTypes = new Set(['petite', 'tall', 'broad', 'muscular', 'fuller-hip', 'full-frame', 'plus-size']);
      const costumeAccessories = new Set(['crown', 'halo', 'monocle', 'eyepatch', 'mask']);
      const religiousAccessories = new Set(['cross-pendant', 'six-point-star-pendant', 'wheel-pendant', 'sacred-syllable-pendant', 'open-hand-pendant', 'embroidered-prayer-cap', 'wrapped-dastar']);
      const manualOnlyAccessories = new Set(['crown', 'halo', 'monocle', 'eyepatch', 'mask', 'forehead-jewel', 'headwrap', ...religiousAccessories]);
      const coveredHairAccessories = new Set(['draped-scarf', 'hijab', 'headwrap', 'wrapped-dastar']);
      const currentCampusAccessories = new Set(['over-ear-headphones', 'wireless-earbuds', 'wired-earbuds', 'chain-necklace', 'delicate-pendant-necklace', 'campus-lanyard', 'bandana']);
      const expressiveManualHair = new Set(['mohawk', 'bowl-cut', 'pigtails', 'top-knot']);
      const upbeatMouthStyles = new Set(['grin', 'closed-smile', 'small-smile', 'bright-smile', 'wide-smile', 'cheerful-grin', 'open-smile', 'excited-smile']);
      const prominentEyelashStyles = new Set(['outer-corner', 'soft-fan', 'full-upper', 'long-classic', 'long-doll', 'long-glam', 'winged', 'dense']);
      const everydayCampusOutfits = new Set(['hoodie', 'crewneck-sweatshirt', 'varsity-jacket', 'denim-jacket', 'flannel-overshirt', 'striped-knit', 'windbreaker', 'polo-shirt', 'collared-shirt', 'open-collar-shirt', 'oxford-shirt', 'blazer', 'kurta-top', 'campus-blouse', 'cardigan']);
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
      let religiousAccessorySamples = 0;
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
      let maleProminentEyelashSamples = 0;

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
          if (accessories.some((accessory) => religiousAccessories.has(accessory))) religiousAccessorySamples++;
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
          if (avatar.appearance.presentation === 'male' && prominentEyelashStyles.has(avatar.appearance.eyelashStyle)) maleProminentEyelashSamples++;
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
        religiousAccessorySamples,
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
        maleProminentEyelashSamples,
      };
    });

    expect(summary.invalidCount, summary.firstInvalid || 'random avatars should validate').toBe(0);
    expect(summary.coveredSkinBands).toBe(4);
    expect(summary.presentationSkinBandCounts.male).toBe(4);
    expect(summary.presentationSkinBandCounts.female).toBe(4);
    expect(Math.abs(summary.maleSamples - summary.femaleSamples)).toBeLessThanOrEqual(80);
    expect(summary.bodyVariety).toBeGreaterThanOrEqual(10);
    expect(summary.commonBodySamples).toBeGreaterThan(summary.specializedBodySamples);
    expect(summary.costumeAccessorySamples).toBe(0);
    expect(summary.manualOnlyAccessorySamples).toBe(0);
    expect(summary.religiousAccessorySamples).toBe(0);
    expect(summary.coveredFacialHairSamples).toBe(0);
    expect(summary.femaleFacialHairSamples).toBe(0);
    expect(summary.expressiveManualHairSamples).toBe(0);
    expect(summary.costumeOutfitSamples).toBe(0);
    expect(summary.everydayCampusOutfitSamples).toBeGreaterThanOrEqual(560);
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
    expect(summary.currentCampusAccessoryVariety).toBe(7);
    expect(summary.mouthVariety).toBeGreaterThanOrEqual(7);
    expect(summary.upbeatMouthSamples).toBeGreaterThan(360);
    expect(summary.neutralMouthSamples).toBeLessThan(40);
    expect(summary.maleProminentEyelashSamples).toBe(0);
  });

  test('Milestone power layer supports every tier without becoming a customization control', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.goto(GYM_URL);

    const entranceHero = page.locator('#gym-entrance .gym-entrance-visual-left [data-gym-hero-svg]');
    await entranceHero.scrollIntoViewIfNeeded();
    await expect(entranceHero).toBeVisible();

    const tiers = await entranceHero.evaluate((svg) => {
      window.HeroAvatar.applyToSvg(svg, window.HeroAvatar.DEFAULTS);
      const visual = svg.closest('.gym-entrance-visual');
      const previousVisualPointerEvents = visual ? visual.style.pointerEvents : '';
      const previousSvgPointerEvents = svg.style.pointerEvents;
      if (visual) visual.style.pointerEvents = 'auto';
      svg.style.pointerEvents = 'auto';

      function hitAt(x, y) {
        const svgPoint = svg.createSVGPoint();
        svgPoint.x = x;
        svgPoint.y = y;
        const screenPoint = svgPoint.matrixTransform(svg.getScreenCTM());
        const element = document.elementFromPoint(screenPoint.x, screenPoint.y);
        const slot = element && element.closest('[data-hero-slot]');
        const zone = element && element.closest('[data-hero-milestone-zone]');
        return {
          slot: slot && slot.getAttribute('data-hero-slot'),
          option: slot && slot.getAttribute('data-hero-option'),
          zone: zone && zone.getAttribute('data-hero-milestone-zone'),
        };
      }

      const result = {};
      for (const tier of ['bronze', 'silver', 'gold', 'diamond']) {
        window.HeroAvatar.applyMilestoneToSvg(svg, tier);
        result[tier] = {
          attr: svg.getAttribute('data-hero-milestone'),
          visibleLayerCount: Array.from(svg.querySelectorAll(`[data-hero-slot="milestone-power"][data-hero-option="${tier}"]`))
            .filter((group) => group.getAttribute('display') === 'inline').length,
          visibleShoeZoneCount: svg.querySelectorAll(`[data-hero-slot="milestone-power"][data-hero-option="${tier}"][display="inline"] [data-hero-milestone-zone="shoes"]`).length,
          metal: getComputedStyle(svg).getPropertyValue('--hero-milestone-metal').trim(),
          beltHit: hitAt(400, 426),
          leftShoeHit: hitAt(366, 607),
          rightShoeHit: hitAt(434, 607),
        };
      }
      window.HeroAvatar.applyMilestoneToSvg(svg, 'none');
      result.none = {
        attr: svg.getAttribute('data-hero-milestone'),
        visibleNonNoneLayerCount: Array.from(svg.querySelectorAll('[data-hero-slot="milestone-power"]'))
          .filter((group) => group.getAttribute('data-hero-option') !== 'none' && group.getAttribute('display') === 'inline').length,
      };
      if (visual) visual.style.pointerEvents = previousVisualPointerEvents;
      svg.style.pointerEvents = previousSvgPointerEvents;
      return result;
    });

    for (const tier of ['bronze', 'silver', 'gold', 'diamond']) {
      expect(tiers[tier].attr).toBe(tier);
      expect(tiers[tier].visibleLayerCount).toBeGreaterThanOrEqual(2);
      expect(tiers[tier].visibleShoeZoneCount).toBe(1);
      expect(tiers[tier].metal).toMatch(/^#[0-9a-f]{6}$/i);
      expect(tiers[tier].beltHit.slot, `${tier} milestone should not cover the belt`).not.toBe('milestone-power');
      expect(tiers[tier].leftShoeHit, `${tier} milestone should visibly style the left shoe`).toEqual({
        slot: 'milestone-power',
        option: tier,
        zone: 'shoes',
      });
      expect(tiers[tier].rightShoeHit, `${tier} milestone should visibly style the right shoe`).toEqual({
        slot: 'milestone-power',
        option: tier,
        zone: 'shoes',
      });
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

  test('Fringe styles do not render lash-like vertical hair strokes in the eye crop', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await clearAccessories(page);

    const styles = [
      'textured-crop',
      'casual-messy-crop',
      'textured-fringe',
      'straight-fringe',
      'neat-straight-fringe',
      'soft-bangs',
      'low-pony-bangs',
      'sleek-bob-bangs',
    ];

    const lashLikeSegments = await page.locator('#hero-customizer-modal [data-gym-hero-svg]')
      .evaluate((svg, hairStyles) => {
        const baseState = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(window.HeroAvatar.DEFAULTS)));
        baseState.outfit.accessory = 'none';
        baseState.outfit.accessories = [];

        function pointInEyeCrop(point) {
          return point.x >= 350 && point.x <= 450 && point.y >= 118 && point.y <= 172;
        }

        function segmentCrossesBrowBand(from, to) {
          return Math.max(from.y, to.y) >= 158 && Math.min(from.y, to.y) <= 168;
        }

        function lashLikeVerticalSegment(from, to) {
          return (
            pointInEyeCrop(from) &&
            pointInEyeCrop(to) &&
            segmentCrossesBrowBand(from, to) &&
            Math.abs(from.x - to.x) <= 2 &&
            Math.abs(from.y - to.y) >= 12
          );
        }

        function verticalLineSegments(d) {
          const segments = [];
          const commandPattern = /([ML])\s*(-?\d+(?:\.\d+)?)\s*,?\s*(-?\d+(?:\.\d+)?)/gi;
          let current = null;
          let match;
          while ((match = commandPattern.exec(d))) {
            const command = match[1].toUpperCase();
            const next = { x: Number(match[2]), y: Number(match[3]) };
            if (command === 'L' && current && lashLikeVerticalSegment(current, next)) {
              segments.push({ from: current, to: next });
            }
            current = next;
          }
          return segments;
        }

        const failures = [];
        for (const style of hairStyles) {
          const state = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(baseState)));
          state.appearance.hairStyle = style;
          window.HeroAvatar.applyToSvg(svg, state);

          const slots = svg.querySelectorAll(
            '[data-hero-slot="hair"][data-hero-option="' + style + '"],' +
            '[data-hero-slot="hairline"][data-hero-option="' + style + '"]'
          );
          slots.forEach((slot) => {
            if (slot.getAttribute('display') !== 'inline') return;
            slot.querySelectorAll('path[stroke*="--hero-hair-rim"]').forEach((path) => {
              const d = path.getAttribute('d') || '';
              verticalLineSegments(d).forEach((segment) => {
                failures.push({
                  style,
                  slot: slot.getAttribute('data-hero-slot'),
                  segment,
                  d,
                });
              });
            });
          });
        }
        return failures;
      }, styles);

    expect(lashLikeSegments).toEqual([]);
  });

  test('Eyelash options render independently without broken vertical geometry', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();

    const eyelashes = page.getByLabel('Eyelashes', { exact: true });
    await expect(eyelashes.locator('option')).toHaveCount(16);
    await eyelashes.selectOption('winged');

    const preview = page.locator('#hero-customizer-modal [data-gym-hero-svg]');
    await expect(preview.locator('[data-hero-slot="eyelash-style"][data-hero-option="winged"]'))
      .toHaveAttribute('display', 'inline');

    const failures = await preview.evaluate((svg) => {
      const baseState = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(window.HeroAvatar.DEFAULTS)));
      const styles = ['none', 'short-soft', 'short-dense', 'barely-there', 'subtle', 'short-natural', 'short-corner', 'short-upper', 'outer-corner', 'soft-fan', 'full-upper', 'long-classic', 'long-doll', 'long-glam', 'winged', 'dense'];
      const minimumLashSegments = {
        'short-soft': 18,
        'short-dense': 22,
        'long-classic': 22,
        'long-doll': 26,
        'long-glam': 28,
        dense: 28,
      };
      const failures = [];

      function visibleSlot(slot, option) {
        const group = svg.querySelector(`[data-hero-slot="${slot}"][data-hero-option="${option}"]`);
        return group && group.getAttribute('display') === 'inline';
      }

      function pointInEyeCrop(point) {
        return point.x >= 350 && point.x <= 450 && point.y >= 158 && point.y <= 198;
      }

      function lashLikeVerticalSegment(from, to) {
        return (
          pointInEyeCrop(from) &&
          pointInEyeCrop(to) &&
          Math.abs(from.x - to.x) <= 2 &&
          Math.abs(from.y - to.y) >= 8
        );
      }

      function verticalLineSegments(d) {
        const segments = [];
        const commandPattern = /([ML])\s*(-?\d+(?:\.\d+)?)\s*,?\s*(-?\d+(?:\.\d+)?)/gi;
        let current = null;
        let match;
        while ((match = commandPattern.exec(d))) {
          const command = match[1].toUpperCase();
          const next = { x: Number(match[2]), y: Number(match[3]) };
          if (command === 'L' && current && lashLikeVerticalSegment(current, next)) {
            segments.push({ from: current, to: next });
          }
          current = next;
        }
        return segments;
      }

      function quadraticLashSegments(d) {
        const segments = [];
        const pattern = /M\s*(-?\d+(?:\.\d+)?)\s*(-?\d+(?:\.\d+)?)\s*Q\s*(-?\d+(?:\.\d+)?)\s*(-?\d+(?:\.\d+)?)\s*(-?\d+(?:\.\d+)?)\s*(-?\d+(?:\.\d+)?)/gi;
        let match;
        while ((match = pattern.exec(d))) {
          segments.push({
            sx: Number(match[1]),
            sy: Number(match[2]),
            cx: Number(match[3]),
            cy: Number(match[4]),
            ex: Number(match[5]),
            ey: Number(match[6]),
          });
        }
        return segments;
      }

      function upperLashFailures(d, eyeShape) {
        return quadraticLashSegments(d).filter((segment) => {
          const dx = segment.ex - segment.sx;
          const dy = segment.ey - segment.sy;
          const length = Math.sqrt(dx * dx + dy * dy);
          return dy > 0.2 || length > 3.7;
        }).map((segment) => ({ eyeShape, segment }));
      }

      function leftEyeAnchorSpan(d) {
        const leftStarts = quadraticLashSegments(d)
          .map((segment) => segment.sx)
          .filter((x) => x < 400);
        return Math.max(...leftStarts) - Math.min(...leftStarts);
      }

      function leftEyeAnchors(d) {
        return quadraticLashSegments(d)
          .filter((segment) => segment.sx < 400)
          .map((segment) => ({ x: segment.sx, y: segment.sy }));
      }

      for (const style of styles) {
        const state = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(baseState)));
        state.appearance.headStyle = 'feminine';
        state.appearance.eyelashStyle = style;
        window.HeroAvatar.applyToSvg(svg, state);

        if (!visibleSlot('eyelash-style', style)) failures.push({ slot: 'eyelash-style', style, reason: 'selected style is not visible' });
        const group = svg.querySelector(`[data-hero-slot="eyelash-style"][data-hero-option="${style}"]`);
        const lashPaths = group ? Array.from(group.querySelectorAll('path[stroke*="--hero-eyebrow"]')) : [];
        if (style !== 'none' && lashPaths.length === 0) failures.push({ slot: 'eyelash-style', style, reason: 'style has no lash paths' });
        const lashSegmentCount = lashPaths.reduce((total, path) => total + quadraticLashSegments(path.getAttribute('d') || '').length, 0);
        if (minimumLashSegments[style] && lashSegmentCount < minimumLashSegments[style]) {
          failures.push({ slot: 'eyelash-style', style, reason: 'style should render many individual lashes', lashSegmentCount });
        }
        for (const path of lashPaths) {
          const d = path.getAttribute('d') || '';
          for (const segment of verticalLineSegments(d)) failures.push({ slot: 'eyelash-style', style, segment, d });
        }
      }

      const eyeFitChecks = [
        { eyeShape: 'round', family: 'round' },
        { eyeShape: 'wide', family: 'wide-round' },
        { eyeShape: 'single-eyelid', family: 'compact' },
        { eyeShape: 'deep-set', family: 'deep-set' },
        { eyeShape: 'tapered-almond', family: 'angled-almond' },
        { eyeShape: 'almond', family: 'almond' },
      ];
      const pathByEyeShape = {};

      for (const check of eyeFitChecks) {
        const state = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(baseState)));
        state.appearance.eyeShape = check.eyeShape;
        state.appearance.eyelashStyle = 'short-dense';
        window.HeroAvatar.applyToSvg(svg, state);
        if (svg.getAttribute('data-hero-eye-family') !== check.family) {
          failures.push({ slot: 'eyelash-style', eyeShape: check.eyeShape, reason: 'wrong eye-shape lash family' });
        }
        const fittedGroup = svg.querySelector('[data-hero-slot="eyelash-style"][data-hero-option="short-dense"]');
        if (fittedGroup && fittedGroup.hasAttribute('transform')) {
          failures.push({ slot: 'eyelash-style', eyeShape: check.eyeShape, reason: 'eye-shape fit should use generated lash geometry, not group transforms' });
        }
        const activePath = fittedGroup ? fittedGroup.querySelector('[data-hero-lash-path]') : null;
        const d = activePath ? (activePath.getAttribute('d') || '') : '';
        pathByEyeShape[check.eyeShape] = d;
        if (!activePath || activePath.getAttribute('data-hero-lash-family') !== check.family || !d) {
          failures.push({ slot: 'eyelash-style', eyeShape: check.eyeShape, reason: 'missing active family-specific lash path' });
        }
      }

      if (pathByEyeShape.round === pathByEyeShape.almond) {
        failures.push({ slot: 'eyelash-style', reason: 'round eyes should not reuse almond lash geometry' });
      }
      if (pathByEyeShape['tapered-almond'] === pathByEyeShape.almond) {
        failures.push({ slot: 'eyelash-style', reason: 'angled almond eyes should not reuse neutral almond lash geometry' });
      }
      if (pathByEyeShape['deep-set'] === pathByEyeShape['single-eyelid']) {
        failures.push({ slot: 'eyelash-style', reason: 'deep-set eyes should not reuse compact single-eyelid lash geometry' });
      }
      for (const failure of upperLashFailures(pathByEyeShape.round, 'round')) {
        failures.push({ slot: 'eyelash-style', reason: 'round short lashes should stay on the upper lid', failure });
      }
      for (const failure of upperLashFailures(pathByEyeShape['deep-set'], 'deep-set')) {
        failures.push({ slot: 'eyelash-style', reason: 'deep-set short lashes should stay on the upper lid', failure });
      }
      if (leftEyeAnchorSpan(pathByEyeShape.round) < 10.5) {
        failures.push({ slot: 'eyelash-style', reason: 'round lashes should span most of the upper eye width' });
      }
      if (leftEyeAnchorSpan(pathByEyeShape.almond) < 15) {
        failures.push({ slot: 'eyelash-style', reason: 'almond lashes should span most of the upper eye width' });
      }
      if (leftEyeAnchorSpan(pathByEyeShape['deep-set']) < 15) {
        failures.push({ slot: 'eyelash-style', reason: 'deep-set lashes should span most of the upper eye width' });
      }
      const deepSetAnchors = leftEyeAnchors(pathByEyeShape['deep-set']);
      if (Math.max(...deepSetAnchors.map((anchor) => anchor.y)) > 184.5) {
        failures.push({ slot: 'eyelash-style', reason: 'deep-set lash roots should sit on the upper lid instead of inside the eye' });
      }

      for (const headStyle of ['feminine', 'heart']) {
        const headFeatureLashes = svg.querySelectorAll(
          `[data-hero-slot="head-features"][data-hero-option="${headStyle}"] path[stroke*="--hero-eyebrow"]`
        );
        if (headFeatureLashes.length) failures.push({ slot: 'head-features', headStyle, reason: 'head shape still owns lash strokes' });
      }

      return failures;
    });

    expect(failures).toEqual([]);
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

      function topSlotAtPoint(point) {
        const svgPoint = svg.createSVGPoint();
        svgPoint.x = point.x;
        svgPoint.y = point.y;
        const screenPoint = svgPoint.matrixTransform(svg.getScreenCTM());
        const element = document.elementFromPoint(screenPoint.x, screenPoint.y);
        const slot = element && element.closest('[data-hero-slot]');
        return {
          slot: slot && slot.getAttribute('data-hero-slot'),
          option: slot && slot.getAttribute('data-hero-option'),
        };
      }

      function slotCoversPoint(point, slotName, option) {
        const group = svg.querySelector('[data-hero-slot="' + slotName + '"][data-hero-option="' + option + '"]');
        if (!group || group.getAttribute('display') !== 'inline') return false;
        const rect = group.getBoundingClientRect();
        if (!rect.width || !rect.height) return false;
        const svgPoint = svg.createSVGPoint();
        svgPoint.x = point.x;
        svgPoint.y = point.y;
        const screenPoint = svgPoint.matrixTransform(svg.getScreenCTM());
        return (
          screenPoint.x >= rect.left - 0.5 &&
          screenPoint.x <= rect.right + 0.5 &&
          screenPoint.y >= rect.top - 0.5 &&
          screenPoint.y <= rect.bottom + 0.5
        );
      }

      function coveredPointHits(points, candidateSlots, option) {
        return points.map((point) => {
          for (const slotName of candidateSlots) {
            if (slotCoversPoint(point, slotName, option)) {
              return { name: point.name, slot: slotName, option, covered: true };
            }
          }
          const topHit = topSlotAtPoint(point);
          return {
            name: point.name,
            slot: topHit.slot,
            option: topHit.option,
            covered: false,
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

        const templeSlots = coveredPointHits([
          { name: 'left temple root', x: 356, y: 178 },
          { name: 'right temple root', x: 444, y: 178 },
        ], ['hair-root'], style);
        for (const point of templeSlots) {
          if (!point.covered) {
            failures.push(Object.assign({ style }, point));
          }
        }

        if (sidePanelSet.has(style)) {
          const filledBackHairPoints = [
            { name: 'left crown volume', x: 360, y: 170 },
            { name: 'right crown volume', x: 440, y: 170 },
            { name: 'left hair behind head', x: 346, y: 205 },
            { name: 'right hair behind head', x: 454, y: 205 },
          ];

          for (const point of filledBackHairPoints) {
            const candidateSlots = point.name.includes('crown volume')
              ? ['hair', 'hair-root', 'hairline']
              : ['hair'];
            const hit = coveredPointHits([point], candidateSlots, style)[0];
            if (!hit.covered) {
              failures.push(Object.assign({ style }, hit));
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

  test('Every selectable hair style has complete visible hair behavior across face shapes and covering headwear', async ({ page }) => {
    test.setTimeout(90000);
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await clearAccessories(page);

    const hairFailures = await page.evaluate(() => {
      const svg = document.querySelector('#hero-customizer-modal [data-gym-hero-svg]');
      const baseState = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(window.HeroAvatar.DEFAULTS)));
      const hairStyles = Array.from(document.querySelectorAll('#hero-cust-hair-style option'))
        .map((node) => node.value)
        .filter(Boolean);
      const headStyles = Array.from(document.querySelectorAll('#hero-cust-head-style option'))
        .map((node) => node.value)
        .filter(Boolean);
      const coveringHeadwear = ['headwrap', 'draped-scarf', 'hijab', 'turban'];
      const protectedFacePoints = [
        { name: 'left eye outer', x: 374, y: 185 },
        { name: 'left eye center', x: 381, y: 185 },
        { name: 'right eye center', x: 419, y: 185 },
        { name: 'right eye outer', x: 426, y: 185 },
        { name: 'nose bridge', x: 400, y: 198 },
        { name: 'nose tip', x: 400, y: 214 },
        { name: 'left cheek', x: 368, y: 208 },
        { name: 'right cheek', x: 432, y: 208 },
        { name: 'mouth', x: 400, y: 226 },
        { name: 'chin', x: 400, y: 240 },
      ];
      const failures = [];

      baseState.outfit.accessory = 'none';
      baseState.outfit.accessories = [];

      function visibleSlot(slot, option) {
        const group = svg.querySelector(`[data-hero-slot="${slot}"][data-hero-option="${option}"]`);
        return group && group.getAttribute('display') === 'inline';
      }

      function bboxArea(slot, option) {
        const group = svg.querySelector(`[data-hero-slot="${slot}"][data-hero-option="${option}"]`);
        if (!group || group.getAttribute('display') !== 'inline' || typeof group.getBBox !== 'function') return 0;
        try {
          const box = group.getBBox();
          return box.width * box.height;
        } catch (e) {
          return 0;
        }
      }

      function hitSlot(point) {
        const svgPoint = svg.createSVGPoint();
        svgPoint.x = point.x;
        svgPoint.y = point.y;
        const screenPoint = svgPoint.matrixTransform(svg.getScreenCTM());
        const element = document.elementFromPoint(screenPoint.x, screenPoint.y);
        const slot = element && element.closest('[data-hero-slot]');
        return {
          point: point.name,
          slot: slot && slot.getAttribute('data-hero-slot'),
          option: slot && slot.getAttribute('data-hero-option'),
        };
      }

      for (const hairStyle of hairStyles) {
        const state = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(baseState)));
        state.appearance.hairStyle = hairStyle;
        state.appearance.headStyle = 'default';
        window.HeroAvatar.applyToSvg(svg, state);

        if (!visibleSlot('hair', hairStyle)) {
          failures.push({ hairStyle, reason: 'selected hair slot is not visible' });
        }
        if (hairStyle !== 'bald' && bboxArea('hair', hairStyle) < 24) {
          failures.push({ hairStyle, reason: 'selected hair slot has no visible geometry' });
        }

        for (const headStyle of headStyles) {
          const shapedState = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(baseState)));
          shapedState.appearance.hairStyle = hairStyle;
          shapedState.appearance.headStyle = headStyle;
          window.HeroAvatar.applyToSvg(svg, shapedState);

          for (const hit of protectedFacePoints.map(hitSlot)) {
            if (['hair', 'hairline', 'hair-root'].includes(hit.slot)) {
              failures.push(Object.assign({ hairStyle, headStyle, reason: 'hair covers protected facial feature' }, hit));
            }
          }
        }

        for (const headwear of coveringHeadwear) {
          const coveredState = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(baseState)));
          coveredState.appearance.hairStyle = hairStyle;
          coveredState.outfit.accessory = headwear;
          coveredState.outfit.accessories = [headwear];
          window.HeroAvatar.applyToSvg(svg, coveredState);

          if (!visibleSlot('hair', 'bald')) {
            failures.push({ hairStyle, headwear, reason: 'covering headwear should switch hair layer to bald' });
          }
          if (!visibleSlot('accessory', headwear)) {
            failures.push({ hairStyle, headwear, reason: 'covering headwear accessory is not visible' });
          }
          for (const slot of ['hair', 'hairline', 'hair-root']) {
            if (hairStyle !== 'bald' && visibleSlot(slot, hairStyle)) {
              failures.push({ hairStyle, headwear, slot, reason: 'covered hair detail remains visible' });
            }
          }
        }
      }

      return failures;
    });

    expect(hairFailures).toEqual([]);
  });

  test('Front-heavy hair styles keep fitted hairlines across varied head shapes', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await clearAccessories(page);

    const fitFailures = await page.evaluate(() => {
      const svg = document.querySelector('#hero-customizer-modal [data-gym-hero-svg]');
      const baseState = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(window.HeroAvatar.DEFAULTS)));
      const cases = [
        { headStyle: 'round', hairStyle: 'straight-fringe' },
        { headStyle: 'full-cheeks', hairStyle: 'neat-straight-fringe' },
        { headStyle: 'full-oval', hairStyle: 'side-parted-short' },
        { headStyle: 'soft-full-cheek-jaw', hairStyle: 'thick-side-swept' },
        { headStyle: 'broad', hairStyle: 'ivy-league' },
        { headStyle: 'full-cheeks', hairStyle: 'soft-two-block' },
        { headStyle: 'soft-full-cheek-jaw', hairStyle: 'pompadour' },
        { headStyle: 'long-tapered-jaw', hairStyle: 'side-swept' },
      ];
      const failures = [];

      baseState.outfit.accessory = 'none';
      baseState.outfit.accessories = [];

      for (const check of cases) {
        const state = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(baseState)));
        state.appearance.headStyle = check.headStyle;
        state.appearance.hairStyle = check.hairStyle;
        window.HeroAvatar.applyToSvg(svg, state);

        const hairline = svg.querySelector(`[data-hero-slot="hairline"][data-hero-option="${check.hairStyle}"]`);
        if (!hairline || hairline.getAttribute('display') !== 'inline') {
          failures.push(Object.assign({ reason: 'hairline layer missing' }, check));
          continue;
        }

        const box = hairline.getBBox();
        const coversForeheadBand = box.x <= 366 && box.x + box.width >= 434 && box.y <= 156 && box.y + box.height >= 166;
        const hasVisibleGeometry = box.width * box.height >= 24;
        if (!coversForeheadBand || !hasVisibleGeometry) {
          failures.push(Object.assign({
            reason: 'hairline does not cover the upper-forehead band cleared by the face layer',
            box: { x: box.x, y: box.y, width: box.width, height: box.height },
          }, check));
        }
      }

      return failures;
    });

    expect(fitFailures).toEqual([]);
  });

  test('Head-bound hair, accessories, and details fit the selected head shape', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await clearAccessories(page);

    const fitFailures = await page.evaluate(() => {
      const svg = document.querySelector('#hero-customizer-modal [data-gym-hero-svg]');
      const baseState = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(window.HeroAvatar.DEFAULTS)));
      const failures = [];
      const cases = [
        { slot: 'hair', option: 'short', width: true },
        { slot: 'hairline', option: 'short', hairStyle: 'short', width: true },
        { slot: 'hair-root', option: 'long', hairStyle: 'long' },
        { slot: 'accessory', option: 'beanie', accessory: 'beanie', width: true },
        { slot: 'accessory', option: 'glasses', accessory: 'glasses' },
        { slot: 'accessory', option: 'earrings', accessory: 'earrings', width: true },
        { slot: 'face-feature', option: 'freckles', faceFeature: 'freckles' },
      ];

      baseState.outfit.accessory = 'none';
      baseState.outfit.accessories = [];

      function render(check, headStyle) {
        const state = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(baseState)));
        state.appearance.headStyle = headStyle;
        state.appearance.hairStyle = check.hairStyle || 'short';
        state.appearance.faceFeature = check.faceFeature || 'none';
        state.outfit.accessory = check.accessory || 'none';
        state.outfit.accessories = check.accessory ? [check.accessory] : [];
        window.HeroAvatar.applyToSvg(svg, state);
        const group = svg.querySelector(`[data-hero-slot="${check.slot}"][data-hero-option="${check.option}"]`);
        if (!group || group.getAttribute('display') !== 'inline') return null;
        const rect = group.getBoundingClientRect();
        return { width: rect.width, top: rect.top, bottom: rect.bottom, headFit: group.getAttribute('data-hero-head-fit') };
      }

      function screenRectCoversSvgPoint(group, point) {
        const rect = group.getBoundingClientRect();
        if (!rect.width || !rect.height) return false;
        const svgPoint = svg.createSVGPoint();
        svgPoint.x = point.x;
        svgPoint.y = point.y;
        const screenPoint = svgPoint.matrixTransform(svg.getScreenCTM());
        return (
          screenPoint.x >= rect.left - 0.5 &&
          screenPoint.x <= rect.right + 0.5 &&
          screenPoint.y >= rect.top - 0.5 &&
          screenPoint.y <= rect.bottom + 0.5
        );
      }

      function renderCoverage(check) {
        const state = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(baseState)));
        state.appearance.headStyle = check.headStyle;
        state.appearance.hairStyle = check.hairStyle || 'short';
        state.outfit.accessory = check.accessory || 'none';
        state.outfit.accessories = check.accessory ? [check.accessory] : [];
        window.HeroAvatar.applyToSvg(svg, state);
        const group = svg.querySelector(`[data-hero-slot="${check.slot}"][data-hero-option="${check.option}"]`);
        if (!group || group.getAttribute('display') !== 'inline') return null;
        return {
          headFit: group.getAttribute('data-hero-head-fit'),
          uncoveredPoints: check.points.filter((point) => !screenRectCoversSvgPoint(group, point)),
        };
      }

      for (const check of cases) {
        const defaultBox = render(check, 'default');
        const broadBox = render(check, 'broad');
        const narrowBox = render(check, 'narrow');
        const oblongBox = render(check, 'oblong');

        if (!defaultBox || !broadBox || !narrowBox || !oblongBox) {
          failures.push({ check, reason: 'fit layer did not render for every tested head shape' });
          continue;
        }
        if (broadBox.headFit !== 'broad' || narrowBox.headFit !== 'narrow' || oblongBox.headFit !== 'oblong') {
          failures.push({ check, reason: 'fit layer did not record the active head shape', broadBox, narrowBox, oblongBox });
        }
        if (check.width && !(broadBox.width > narrowBox.width + 0.5)) {
          failures.push({ check, reason: 'fit layer should widen on broad heads and narrow on narrow heads', broadWidth: broadBox.width, narrowWidth: narrowBox.width });
        }
      }

      const coverageCases = [
        {
          slot: 'hair',
          option: 'short',
          hairStyle: 'short',
          headStyle: 'full-cheeks',
          points: [{ name: 'left upper temple', x: 352, y: 168 }, { name: 'right upper temple', x: 448, y: 168 }],
        },
        {
          slot: 'hair',
          option: 'straight-fringe',
          hairStyle: 'straight-fringe',
          headStyle: 'full-cheeks',
          points: [{ name: 'left fringe edge', x: 352, y: 162 }, { name: 'right fringe edge', x: 448, y: 162 }],
        },
        {
          slot: 'hair-root',
          option: 'long',
          hairStyle: 'long',
          headStyle: 'broad',
          points: [{ name: 'left temple root', x: 352, y: 180 }, { name: 'right temple root', x: 448, y: 180 }],
        },
        {
          slot: 'accessory',
          option: 'headband',
          accessory: 'headband',
          headStyle: 'full-cheeks',
          points: [{ name: 'left band edge', x: 350, y: 164 }, { name: 'right band edge', x: 450, y: 164 }],
        },
        {
          slot: 'accessory',
          option: 'beanie',
          accessory: 'beanie',
          headStyle: 'full-cheeks',
          points: [{ name: 'left beanie edge', x: 350, y: 164 }, { name: 'right beanie edge', x: 450, y: 164 }],
        },
      ];

      for (const check of coverageCases) {
        const coverage = renderCoverage(check);
        if (!coverage || coverage.headFit !== check.headStyle || coverage.uncoveredPoints.length) {
          failures.push({ check, reason: 'larger head shape should stay covered by fitted hair or headwear', coverage });
        }
      }

      return failures;
    });

    expect(fitFailures).toEqual([]);
  });

  test('Every selectable hair style keeps the costume emblem clear', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await clearAccessories(page);

    const hairOverCostumeHits = await page.evaluate(() => {
      const svg = document.querySelector('#hero-customizer-modal [data-gym-hero-svg]');
      const styles = Array.from(document.querySelectorAll('#hero-cust-hair-style option'))
        .map((node) => node.value)
        .filter(Boolean);
      const headStyles = ['default', 'round', 'oblong', 'soft-square', 'feminine'];
      const bodyTypes = ['petite', 'average', 'athletic', 'broad', 'full-frame'];
      const baseState = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(window.HeroAvatar.DEFAULTS)));
      baseState.outfit.accessory = 'none';
      baseState.outfit.accessories = [];

      function hitSlot(point) {
        const svgPoint = svg.createSVGPoint();
        svgPoint.x = point.x;
        svgPoint.y = point.y;
        const screenPoint = svgPoint.matrixTransform(svg.getScreenCTM());
        const element = document.elementFromPoint(screenPoint.x, screenPoint.y);
        const slot = element && element.closest('[data-hero-slot]');
        return {
          point: point.name,
          slot: slot && slot.getAttribute('data-hero-slot'),
          option: slot && slot.getAttribute('data-hero-option'),
        };
      }

      const points = [
        { name: 'shield top', x: 400, y: 300 },
        { name: 'shield left', x: 374, y: 328 },
        { name: 'shield right', x: 426, y: 328 },
        { name: 'shield center', x: 400, y: 334 },
        { name: 'chest left', x: 360, y: 316 },
        { name: 'chest right', x: 440, y: 316 },
      ];
      const failures = [];

      for (const style of styles) {
        for (const headStyle of headStyles) {
          const state = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(baseState)));
          state.appearance.hairStyle = style;
          state.appearance.headStyle = headStyle;
          window.HeroAvatar.applyToSvg(svg, state);
          for (const hit of points.map(hitSlot)) {
            if (['hair', 'hairline', 'hair-root'].includes(hit.slot)) {
              failures.push(Object.assign({ style, headStyle }, hit));
            }
          }
        }
        for (const bodyType of bodyTypes) {
          const state = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(baseState)));
          state.appearance.hairStyle = style;
          state.body.type = bodyType;
          window.HeroAvatar.applyToSvg(svg, state);
          for (const hit of points.map(hitSlot)) {
            if (['hair', 'hairline', 'hair-root'].includes(hit.slot)) {
              failures.push(Object.assign({ style, bodyType }, hit));
            }
          }
        }
      }
      return failures;
    });

    expect(
      hairOverCostumeHits,
      'No selectable hair style should visually cover the costume emblem or chest panel'
    ).toEqual([]);
  });

  test('Every selectable hair style keeps the center chin and neck area clean', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await clearAccessories(page);

    const centerHairHits = await page.evaluate(() => {
      const svg = document.querySelector('#hero-customizer-modal [data-gym-hero-svg]');
      const baseState = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(window.HeroAvatar.DEFAULTS)));
      baseState.outfit.accessory = 'none';
      baseState.outfit.accessories = [];
      const styles = Array.from(document.querySelectorAll('#hero-cust-hair-style option'))
        .map((node) => node.value)
        .filter(Boolean);
      const points = [
        { name: 'lower chin', x: 400, y: 236 },
        { name: 'under chin', x: 400, y: 244 },
        { name: 'upper neck', x: 400, y: 252 },
      ];

      function hitSlot(point) {
        const svgPoint = svg.createSVGPoint();
        svgPoint.x = point.x;
        svgPoint.y = point.y;
        const screenPoint = svgPoint.matrixTransform(svg.getScreenCTM());
        const element = document.elementFromPoint(screenPoint.x, screenPoint.y);
        const slot = element && element.closest('[data-hero-slot]');
        return {
          point: point.name,
          slot: slot && slot.getAttribute('data-hero-slot'),
          option: slot && slot.getAttribute('data-hero-option'),
        };
      }

      const failures = [];
      for (const style of styles) {
        const state = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(baseState)));
        state.appearance.hairStyle = style;
        window.HeroAvatar.applyToSvg(svg, state);
        for (const hit of points.map(hitSlot)) {
          if (['hair', 'hairline', 'hair-root'].includes(hit.slot)) {
            failures.push(Object.assign({ style }, hit));
          }
        }
      }
      return failures;
    });

    expect(
      centerHairHits,
      'Hair styles should not draw ponytail ties or bob bands below the chin'
    ).toEqual([]);
  });

  test('Top knot fully covers the upper scalp before the knot stem', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await clearAccessories(page);

    await page.getByLabel('Head shape', { exact: true }).selectOption('soft-oval');
    await page.getByLabel('Hair style', { exact: true }).selectOption('top-knot');

    const exposedScalpHits = await page.locator('#hero-customizer-modal [data-gym-hero-svg]').evaluate((svg) => {
      const points = [
        { name: 'left upper scalp', x: 365, y: 146 },
        { name: 'center upper scalp', x: 400, y: 140 },
        { name: 'right upper scalp', x: 435, y: 146 },
        { name: 'forehead cap', x: 400, y: 158 },
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

    for (const hit of exposedScalpHits) {
      expect(hit, `${hit.name} should be covered by top-knot hair`).toMatchObject({
        slot: 'hairline',
        option: 'top-knot',
      });
    }
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

    const failures = await page.evaluate((styles) => {
      const svg = document.querySelector('#hero-customizer-modal [data-gym-hero-svg]');
      const baseState = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(window.HeroAvatar.DEFAULTS)));
      baseState.outfit.accessory = 'none';
      baseState.outfit.accessories = [];
      baseState.appearance.headStyle = 'soft-oval';
      const failures = [];

      for (const style of styles) {
        const state = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(baseState)));
        state.appearance.hairStyle = style;
        window.HeroAvatar.applyToSvg(svg, state);

        const hairline = svg.querySelector(`[data-hero-slot="hairline"][data-hero-option="${style}"]`);
        const root = svg.querySelector(`[data-hero-slot="hair-root"][data-hero-option="${style}"]`);
        if (!hairline || hairline.getAttribute('display') !== 'inline') {
          failures.push({ style, point: 'hairline layer', slot: hairline && hairline.getAttribute('display') });
        }
        if (!root || root.getAttribute('display') !== 'inline') {
          failures.push({ style, point: 'hair-root layer', slot: root && root.getAttribute('display') });
        }

        const points = [
          { name: 'top forehead hairline', x: 400, y: 158 },
          { name: 'left temple root', x: 356, y: 178 },
          { name: 'right temple root', x: 444, y: 178 },
        ];
        const coverage = points.map((point) => {
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
        const expected = [
          { point: 'top forehead hairline', slot: 'hairline' },
          { point: 'left temple root', slot: 'hair-root' },
          { point: 'right temple root', slot: 'hair-root' },
        ];
        for (const expectedHit of expected) {
          const hit = coverage.find((item) => item.name === expectedHit.point);
          if (!hit || hit.slot !== expectedHit.slot || hit.option !== style) {
            failures.push({ style, point: expectedHit.point, slot: hit && hit.slot, option: hit && hit.option });
          }
        }
      }
      return failures;
    }, styles);

    expect(failures).toEqual([]);
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
      const smileLine = svg.querySelector('[data-hero-slot="mouth-style"][data-hero-option="full-lips"] path[stroke*="--hero-mouth-line"]');
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

    await setSelectInput(page, '#hero-cust-outfit-style', 'kurta-top');
    await setCheckboxInput(page, '#hero-customizer-modal input[name="hero-cust-accessory"][value="wireframe-glasses"]', true);
    await setCheckboxInput(page, '#hero-customizer-modal input[name="hero-cust-accessory"][value="hoop-earrings"]', true);
    await setCheckboxInput(page, '#hero-customizer-modal input[name="hero-cust-accessory"][value="forehead-jewel"]', true);

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
    await setSelectInput(page, '#hero-cust-hair-style', 'straight-long-layers');
    await setSelectInput(page, '#hero-cust-outfit-style', 'campus-blouse');
    await setCheckboxInput(page, '#hero-customizer-modal input[name="hero-cust-accessory"][value="hair-clips"]', true);
    await expect(preview.locator('[data-hero-slot="hair"][data-hero-option="straight-long-layers"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="hairline"][data-hero-option="straight-long-layers"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="outfit-style"][data-hero-option="campus-blouse"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="accessory"][data-hero-option="hair-clips"]'))
      .toHaveAttribute('display', 'inline');

    await clearAccessories(page);
    await setSelectInput(page, '#hero-cust-hair-style', 'long-straight');
    await setSelectInput(page, '#hero-cust-outfit-style', 'collared-shirt');
    await setCheckboxInput(page, '#hero-customizer-modal input[name="hero-cust-accessory"][value="draped-scarf"]', true);
    await expect(preview.locator('[data-hero-slot="outfit-style"][data-hero-option="collared-shirt"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="accessory"][data-hero-option="draped-scarf"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="hair"][data-hero-option="long-straight"]'))
      .toHaveAttribute('display', 'none');

    await clearAccessories(page);
    await setSelectInput(page, '#hero-cust-outfit-style', 'cardigan');
    await expect(preview.locator('[data-hero-slot="outfit-style"][data-hero-option="cardigan"]'))
      .toHaveAttribute('display', 'inline');

    for (const outfit of ['captain-jacket', 'utility-vest']) {
      await setSelectInput(page, '#hero-cust-outfit-style', outfit);
      await expect(preview.locator(`[data-hero-slot="outfit-style"][data-hero-option="${outfit}"]`))
        .toHaveAttribute('display', 'inline');
    }

    for (const outfit of ['crewneck-sweatshirt', 'flannel-overshirt', 'striped-knit']) {
      await setSelectInput(page, '#hero-cust-outfit-style', outfit);
      await expect(preview.locator(`[data-hero-slot="outfit-style"][data-hero-option="${outfit}"]`))
        .toHaveAttribute('display', 'inline');
    }

    const accessoryFailures = await page.evaluate((values) => {
      const svg = document.querySelector('#hero-customizer-modal [data-gym-hero-svg]');
      const baseState = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(window.HeroAvatar.DEFAULTS)));
      const failures = [];

      for (const value of values) {
        const state = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(baseState)));
        state.outfit.accessory = value;
        state.outfit.accessories = [value];
        window.HeroAvatar.applyToSvg(svg, state);
        const layer = svg.querySelector(`[data-hero-slot="accessory"][data-hero-option="${value}"]`);
        if (!layer || layer.getAttribute('display') !== 'inline') {
          failures.push({ value, display: layer && layer.getAttribute('display') });
        }
      }

      return failures;
    }, [
      'round-rim-glasses',
      'safety-goggles',
      'tech-visor',
      'over-ear-headphones',
      'headset-mic',
      'wireless-earbuds',
      'wired-earbuds',
      'chain-necklace',
      'delicate-pendant-necklace',
      'cross-pendant',
      'six-point-star-pendant',
      'wheel-pendant',
      'sacred-syllable-pendant',
      'open-hand-pendant',
      'campus-lanyard',
      'student-id-badge',
      'backpack-straps',
      'messenger-bag',
      'circuit-pin',
      'code-patch',
      'utility-belt',
      'embroidered-prayer-cap',
      'wrapped-dastar',
      'hero-cape-clasp',
      'bandana',
    ]);

    expect(accessoryFailures).toEqual([]);
  });

  test('Expanded natural hair styles update the preview', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await clearAccessories(page);

    const styles = [
      'short',
      'textured-crop',
      'wispy-crop',
      'textured-fringe',
      'casual-messy-crop',
      'straight-fringe',
      'neat-straight-fringe',
      'soft-rounded-fringe',
      'side-parted-short',
      'neat-side-swept-fringe',
      'thick-side-swept',
      'ivy-league',
      'soft-two-block',
      'middle-part-flow',
      'slick-back',
      'fade',
      'crew-cut',
      'buzz',
      'pixie',
      'undercut',
      'pompadour',
      'bowl-cut',
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
    const hairlineStyles = new Set(['short', 'textured-crop', 'wispy-crop', 'casual-messy-crop', 'textured-fringe', 'straight-fringe', 'neat-straight-fringe', 'soft-rounded-fringe', 'side-parted-short', 'neat-side-swept-fringe', 'thick-side-swept', 'ivy-league', 'soft-two-block', 'middle-part-flow', 'slick-back', 'fade', 'crew-cut', 'buzz', 'pixie', 'undercut', 'pompadour', 'bowl-cut', 'straight-long-layers', 'wavy-lob', 'side-part-lob', 'wolf-cut', 'sleek-bob-bangs', 'soft-bangs', 'low-pony-bangs', 'butterfly-layers', 'curly-layers', 'coils', 'two-strand-twists', 'twist-out', 'coily-puff', 'double-puffs', 'bantu-knots', 'french-braid', 'braided-pony', 'knotless-braids', 'space-buns', 'claw-clip-updo']);

    const previewFailures = await page.evaluate(async ({ styles, hairlineStyles }) => {
      const select = document.querySelector('#hero-cust-hair-style');
      const svg = document.querySelector('#hero-customizer-modal [data-gym-hero-svg]');
      const hairlineSet = new Set(hairlineStyles);
      const failures = [];
      const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

      if (!select || !svg) return [{ reason: 'missing hair select or preview svg' }];

      for (const style of styles) {
        select.value = style;
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
        await nextFrame();

        const activeHair = svg.querySelector(`[data-hero-slot="hair"][data-hero-option="${style}"]`);
        const activeHairline = svg.querySelector(`[data-hero-slot="hairline"][data-hero-option="${style}"]`);
        if (select.value !== style) {
          failures.push({ style, reason: 'select value did not update', value: select.value });
        }
        if (!activeHair || activeHair.getAttribute('display') !== 'inline') {
          failures.push({ style, reason: 'hair layer not visible' });
        }
        if (hairlineSet.has(style) && (!activeHairline || activeHairline.getAttribute('display') !== 'inline')) {
          failures.push({ style, reason: 'hairline layer not visible' });
        }
      }

      return failures;
    }, { styles, hairlineStyles: Array.from(hairlineStyles) });

    expect(previewFailures).toEqual([]);
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
    const shapes = ['diamond', 'full-oval', 'soft-full-cheek-jaw', 'tapered-oval', 'gentle-taper', 'soft-round-jaw', 'soft-angular'];

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

    const faceFeature = page.getByLabel('Facial details', { exact: true });

    await expect(faceFeature.locator('option[value="cheek-lines"]')).toHaveCount(0);

    const failures = await page.evaluate(() => {
      const svg = document.querySelector('#hero-customizer-modal [data-gym-hero-svg]');
      const baseState = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(window.HeroAvatar.DEFAULTS)));
      const failures = [];

      function visibleSlot(slot, option) {
        const group = svg.querySelector(`[data-hero-slot="${slot}"][data-hero-option="${option}"]`);
        return group && group.getAttribute('display') === 'inline';
      }

      function facialHairBox(facialHair, mouthStyle, headStyle = 'default') {
        const state = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(baseState)));
        state.appearance.facialHair = facialHair;
        state.appearance.mouthStyle = mouthStyle;
        state.appearance.headStyle = headStyle;
        window.HeroAvatar.applyToSvg(svg, state);
        const group = svg.querySelector(`[data-hero-slot="facial-hair"][data-hero-option="${facialHair}"]`);
        if (!group || group.getAttribute('display') !== 'inline') return null;
        const rect = group.getBoundingClientRect();
        return {
          width: rect.width,
          top: rect.top,
          bottom: rect.bottom,
          mouthFit: group.getAttribute('data-hero-mouth-fit'),
          headFit: group.getAttribute('data-hero-head-fit'),
        };
      }

      for (const value of ['stubble', 'soft-mustache', 'fine-mustache-stubble', 'mustache', 'soul-patch', 'goatee', 'sideburns', 'chin-strap', 'short-beard', 'trimmed-beard', 'full-beard']) {
        const state = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(baseState)));
        state.appearance.facialHair = value;
        window.HeroAvatar.applyToSvg(svg, state);
        if (!visibleSlot('facial-hair', value)) failures.push({ slot: 'facial-hair', value });
      }

      for (const value of ['short-beard', 'trimmed-beard', 'full-beard']) {
        const state = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(baseState)));
        state.appearance.facialHair = value;
        window.HeroAvatar.applyToSvg(svg, state);
        const group = svg.querySelector(`[data-hero-slot="facial-hair"][data-hero-option="${value}"]`);
        const beardIsOpaque = group && Array.from(group.querySelectorAll('[fill]:not([fill="none"])'))
          .every((node) => Number(node.getAttribute('opacity') || '1') >= 0.85);
        if (!beardIsOpaque) failures.push({ slot: 'facial-hair', value, beardIsOpaque });
      }

      const smallMustache = facialHairBox('mustache', 'small-smile');
      const wideMustache = facialHairBox('mustache', 'wide-smile');
      if (!smallMustache || !wideMustache || !(wideMustache.width > smallMustache.width + 2)) {
        failures.push({ slot: 'facial-hair', value: 'mustache', reason: 'mustache should widen with wider mouth shapes', smallMustache, wideMustache });
      }

      const neutralBeard = facialHairBox('short-beard', 'neutral');
      const excitedBeard = facialHairBox('short-beard', 'excited-smile');
      if (!neutralBeard || !excitedBeard || !(excitedBeard.bottom > neutralBeard.bottom + 1)) {
        failures.push({ slot: 'facial-hair', value: 'short-beard', reason: 'beard should drop below taller open smiles', neutralBeard, excitedBeard });
      }

      const narrowBeard = facialHairBox('trimmed-beard', 'smile', 'narrow');
      const broadBeard = facialHairBox('trimmed-beard', 'smile', 'broad');
      if (!narrowBeard || !broadBeard || broadBeard.headFit !== 'broad' || narrowBeard.headFit !== 'narrow' || !(broadBeard.width > narrowBeard.width + 1)) {
        failures.push({ slot: 'facial-hair', value: 'trimmed-beard', reason: 'beard should also follow head width while fitting the mouth', narrowBeard, broadBeard });
      }

      for (const value of ['freckles', 'nose-freckles', 'beauty-mark', 'small-moles', 'dimples', 'chin-dimple', 'smile-lines', 'under-eye-lines']) {
        const state = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(baseState)));
        state.appearance.faceFeature = value;
        window.HeroAvatar.applyToSvg(svg, state);
        if (!visibleSlot('face-feature', value)) failures.push({ slot: 'face-feature', value });
      }

      const noCheeksState = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(baseState)));
      noCheeksState.appearance.blushStyle = 'none';
      window.HeroAvatar.applyToSvg(svg, noCheeksState);
      const hiddenCheekOpacities = Array.from(svg.querySelectorAll('ellipse[fill*="--hero-cheek"]'))
        .map((node) => Number(getComputedStyle(node).opacity));
      if (!hiddenCheekOpacities.length || hiddenCheekOpacities.some((opacity) => opacity !== 0)) {
        failures.push({ slot: 'cheek', value: 'none', opacities: hiddenCheekOpacities });
      }

      const frecklesNoCheeksState = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(baseState)));
      frecklesNoCheeksState.appearance.blushStyle = 'none';
      frecklesNoCheeksState.appearance.faceFeature = 'freckles';
      window.HeroAvatar.applyToSvg(svg, frecklesNoCheeksState);
      const stillHiddenCheeks = Array.from(svg.querySelectorAll('ellipse[fill*="--hero-cheek"]'))
        .every((node) => Number(getComputedStyle(node).opacity) === 0);
      if (!visibleSlot('face-feature', 'freckles') || !stillHiddenCheeks) {
        failures.push({ slot: 'face-feature', value: 'freckles', stillHiddenCheeks });
      }

      const visibleCheeksState = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(baseState)));
      visibleCheeksState.appearance.blushStyle = 'natural';
      window.HeroAvatar.applyToSvg(svg, visibleCheeksState);
      const visibleCheekOpacity = Math.max(...Array.from(svg.querySelectorAll('ellipse[fill*="--hero-cheek"]'))
        .map((node) => Number(getComputedStyle(node).opacity)));
      if (!(visibleCheekOpacity > 0)) failures.push({ slot: 'cheek', value: 'natural', visibleCheekOpacity });

      const clearState = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(baseState)));
      clearState.appearance.facialHair = 'none';
      clearState.appearance.faceFeature = 'none';
      window.HeroAvatar.applyToSvg(svg, clearState);
      if (!visibleSlot('facial-hair', 'none')) failures.push({ slot: 'facial-hair', value: 'none' });
      if (!visibleSlot('face-feature', 'none')) failures.push({ slot: 'face-feature', value: 'none' });

      return failures;
    });

    expect(failures).toEqual([]);
  });

  test('Smile and chin-strap layers avoid stray mouth-adjacent strokes', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();

    const failures = await page.evaluate(() => {
      const svg = document.querySelector('#hero-customizer-modal [data-gym-hero-svg]');
      const baseState = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(window.HeroAvatar.DEFAULTS)));
      const filledSmiles = ['smile', 'grin', 'bright-smile', 'wide-smile', 'cheerful-grin', 'open-smile', 'excited-smile'];
      const failures = [];

      const chinState = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(baseState)));
      chinState.appearance.facialHair = 'chin-strap';
      chinState.appearance.mouthStyle = 'smile';
      window.HeroAvatar.applyToSvg(svg, chinState);
      const chinStrap = svg.querySelector('[data-hero-slot="facial-hair"][data-hero-option="chin-strap"]');
      const chinStrokeCount = chinStrap
        ? Array.from(chinStrap.querySelectorAll('[stroke]')).filter((node) => node.getAttribute('stroke') !== 'none').length
        : 0;
      if (!chinStrap || chinStrap.getAttribute('display') !== 'inline' || chinStrokeCount) {
        failures.push({ slot: 'facial-hair', value: 'chin-strap', reason: 'chin strap should be filled shapes without skin-colored cutout strokes', chinStrokeCount });
      }

      for (const mouthStyle of filledSmiles) {
        const state = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(baseState)));
        state.appearance.mouthStyle = mouthStyle;
        window.HeroAvatar.applyToSvg(svg, state);
        const mouth = svg.querySelector(`[data-hero-slot="mouth-style"][data-hero-option="${mouthStyle}"]`);
        const mouthLineStrokes = mouth
          ? Array.from(mouth.querySelectorAll('[stroke*="--hero-mouth-line"]')).length
          : 0;
        const toothStrokeHighlights = mouth
          ? Array.from(mouth.querySelectorAll('path[stroke="#ffffff"]')).length
          : 0;
        if (!mouth || mouth.getAttribute('display') !== 'inline' || mouthLineStrokes || toothStrokeHighlights) {
          failures.push({ slot: 'mouth-style', value: mouthStyle, reason: 'filled smiles should use filled tooth shapes instead of extra outline strokes', mouthLineStrokes, toothStrokeHighlights });
        }
      }

      return failures;
    });

    expect(failures).toEqual([]);
  });

  test('Expanded facial structure controls update the preview', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();

    const failures = await page.evaluate(() => {
      const svg = document.querySelector('#hero-customizer-modal [data-gym-hero-svg]');
      const baseState = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(window.HeroAvatar.DEFAULTS)));
      const failures = [];

      function visibleSlot(slot, option) {
        const group = svg.querySelector(`[data-hero-slot="${slot}"][data-hero-option="${option}"]`);
        return group && group.getAttribute('display') === 'inline';
      }

      for (const value of ['almond', 'soft-almond', 'tapered-almond', 'upturned-almond', 'downturned-soft', 'single-eyelid', 'soft-single-eyelid', 'wide-single-eyelid', 'hooded', 'deep-set', 'smiling', 'wide']) {
        const state = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(baseState)));
        state.appearance.eyeShape = value;
        window.HeroAvatar.applyToSvg(svg, state);
        const group = svg.querySelector(`[data-hero-slot="eye-shape"][data-hero-option="${value}"]`);
        const irisDetailsAreClipped = group && Array.from(group.querySelectorAll('circle'))
          .every((circle) => circle.closest('g[clip-path]'));
        if (!visibleSlot('eye-shape', value) || !irisDetailsAreClipped) {
          failures.push({ slot: 'eye-shape', value, visible: visibleSlot('eye-shape', value), irisDetailsAreClipped });
        }
      }

      for (const value of ['rounded', 'broad', 'medium-broad-soft-tip', 'narrow', 'button', 'defined-bridge', 'rounded-tip', 'wide-rounded-tip', 'soft-upturned', 'gentle-bridge', 'soft-low-bridge', 'low-wide-bridge', 'soft-flat-bridge', 'aquiline-bridge']) {
        const state = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(baseState)));
        state.appearance.noseShape = value;
        window.HeroAvatar.applyToSvg(svg, state);
        if (!visibleSlot('nose-shape', value)) failures.push({ slot: 'nose-shape', value });
      }

      for (const value of ['soft-smile', 'small-smile', 'grin', 'neutral', 'full-lips', 'soft-full-lips', 'bright-smile', 'wide-smile', 'cheerful-grin', 'open-smile', 'excited-smile']) {
        const state = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(baseState)));
        state.appearance.mouthStyle = value;
        window.HeroAvatar.applyToSvg(svg, state);
        if (!visibleSlot('mouth-style', value)) failures.push({ slot: 'mouth-style', value });
      }

      const defaultState = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(baseState)));
      defaultState.appearance.eyeShape = 'round';
      defaultState.appearance.noseShape = 'soft';
      defaultState.appearance.mouthStyle = 'smile';
      window.HeroAvatar.applyToSvg(svg, defaultState);
      const roundGroup = svg.querySelector('[data-hero-slot="eye-shape"][data-hero-option="round"]');
      const roundIrisDetailsAreClipped = roundGroup && Array.from(roundGroup.querySelectorAll('circle'))
        .every((circle) => circle.closest('g[clip-path]'));
      if (!visibleSlot('eye-shape', 'round') || !roundIrisDetailsAreClipped) {
        failures.push({ slot: 'eye-shape', value: 'round', visible: visibleSlot('eye-shape', 'round'), irisDetailsAreClipped: roundIrisDetailsAreClipped });
      }
      if (!visibleSlot('nose-shape', 'soft')) failures.push({ slot: 'nose-shape', value: 'soft' });
      if (!visibleSlot('mouth-style', 'smile')) failures.push({ slot: 'mouth-style', value: 'smile' });

      return failures;
    });

    expect(failures).toEqual([]);
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

    await page.getByRole('button', { name: 'Clear', exact: true }).click();
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
    await heroCustomizerAction(page, /save/i).click();
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
    await heroCustomizerAction(page, 'Use random heroes').click();

    await expect(page.locator('#hero-cust-status')).toContainText(/Saved hero removed/i);
    expect(await page.evaluate(() => localStorage.getItem('se-gym-hero-avatar'))).toBeNull();

    const randomSignatures = await entranceHeroSignatures(page);
    expect(randomSignatures.length).toBeGreaterThanOrEqual(2);
    expect(new Set(randomSignatures).size).toBeGreaterThan(1);

    await page.reload();
    const randomReloadSignatures = await entranceHeroSignatures(page);
    expect(new Set(randomReloadSignatures).size).toBeGreaterThan(1);
  });

  test('Body type choices render distinct silhouettes in the hero preview', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();

    const summary = await page.evaluate(() => {
      const select = document.querySelector('#hero-cust-body-type');
      const svg = document.querySelector('#hero-customizer-modal [data-gym-hero-svg]');
      const values = Array.from(select.options).map((option) => option.value).filter(Boolean);
      const baseState = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(window.HeroAvatar.DEFAULTS)));

      function visibleBodyGroup() {
        return svg.querySelector('[data-hero-slot="body-shape"][display="inline"]')
          || svg.querySelector('[data-hero-default-torso]');
      }

      function bodyPaths(group) {
        return Array.from(group.querySelectorAll('path')).filter((path) => {
          const fill = path.getAttribute('fill');
          return fill && fill !== 'none';
        });
      }

      function filledWidthAt(paths, y) {
        const point = svg.createSVGPoint();
        let min = null;
        let max = null;
        for (let x = 240; x <= 560; x += 2) {
          point.x = x;
          point.y = y;
          const filled = paths.some((path) => path.isPointInFill(point));
          if (!filled) continue;
          if (min === null) min = x;
          max = x;
        }
        return min === null ? 0 : max - min;
      }

      const profiles = values.map((value) => {
        const state = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(baseState)));
        state.body.type = value;
        window.HeroAvatar.applyToSvg(svg, state);
        const group = visibleBodyGroup();
        const bbox = group.getBBox();
        const paths = bodyPaths(group);
        return {
          value,
          selectedBody: svg.getAttribute('data-hero-body'),
          shape: group.getAttribute('data-hero-option') || 'default',
          features: Array.from(svg.querySelectorAll('[data-hero-slot="silhouette"][display="inline"]'))
            .map((node) => node.getAttribute('data-hero-feature')),
          width: Math.round(bbox.width),
          top: Math.round(bbox.y),
          shoulder: filledWidthAt(paths, 276),
          mid: filledWidthAt(paths, 350),
          hip: filledWidthAt(paths, 424),
        };
      });
      return { values, profiles };
    });

    expect(summary.values).toEqual([
      'petite',
      'lean',
      'slim-shouldered',
      'average',
      'tall',
      'athletic',
      'muscular',
      'broad',
      'solid',
      'curvy',
      'fuller-hip',
      'full-frame',
      'plus-size',
    ]);

    const profile = Object.fromEntries(summary.profiles.map((item) => [item.value, item]));
    for (const value of summary.values) {
      expect(profile[value].selectedBody, `${value} should be applied to the preview SVG`).toBe(value);
    }

    expect(profile.petite.shoulder, 'petite should have visibly narrower shoulders than medium').toBeLessThan(profile.average.shoulder - 24);
    expect(profile.broad.shoulder, 'broad should have visibly wider shoulders than medium').toBeGreaterThan(profile.average.shoulder + 40);
    expect(profile.athletic.shoulder, 'athletic should taper clearly from shoulders to hip').toBeGreaterThan(profile.athletic.hip + 28);
    expect(profile.curvy.shape, 'curvy should use the softened curved torso instead of the extreme hourglass').toBe('curvy');
    expect(profile.curvy.features, 'curvy should not use extra waist guide lines').toEqual([]);
    expect(profile['full-frame'].width, 'full-frame should remain broader than the softened curvy frame').toBeGreaterThan(profile.curvy.width + 8);
    expect(profile['fuller-hip'].hip, 'fuller-hip should widen clearly below the torso').toBeGreaterThan(profile['fuller-hip'].shoulder + 24);
    expect(profile['plus-size'].hip, 'plus-size should be wider through the lower torso than full-frame').toBeGreaterThan(profile['full-frame'].hip + 8);
    expect(profile.tall.top, 'tall should use a visibly longer upper-body profile').toBeLessThan(profile.average.top - 6);
  });

  test('Accessory combinations compose into coherent face, head, and detail layers', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await clearAccessories(page);

    await setSelectInput(page, '#hero-cust-hair-style', 'long-layers');
    for (const value of ['rectangular-glasses', 'mask', 'beanie', 'hijab', 'earrings', 'hair-clips', 'halo']) {
      await setCheckboxInput(page, `#hero-customizer-modal input[name="hero-cust-accessory"][value="${value}"]`, true);
    }

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
      const maskShell = mask ? mask.querySelector('[data-hero-mask-shell]') : null;
      const whiteMaskCutouts = mask ? Array.from(mask.querySelectorAll('*')).filter((node) => {
        const fill = (node.getAttribute('fill') || '').trim().toLowerCase();
        return fill === '#ffffff' || fill === 'white';
      }).length : 0;
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
        maskShellFillRule: maskShell ? maskShell.getAttribute('fill-rule') : null,
        whiteMaskCutouts,
      };
    });
    expect(faceAccessoryOrder).toEqual({
      maskAfterHeadFeatures: true,
      maskAfterNose: true,
      visibleFaceAccessories: ['mask'],
      maskShellFillRule: 'evenodd',
      whiteMaskCutouts: 0,
    });

    await clearAccessories(page);
    await setSelectInput(page, '#hero-cust-hair-style', 'long-layers');
    await setCheckboxInput(page, '#hero-customizer-modal input[name="hero-cust-accessory"][value="hero-cape-clasp"]', true);
    await expect(preview.locator('[data-hero-slot="accessory"][data-hero-option="hero-cape-clasp"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="hair"][data-hero-option="long-layers"]'))
      .toHaveAttribute('display', 'inline');

    const claspBehindHair = await preview.evaluate((svg) => {
      const clasp = svg.querySelector('[data-hero-slot="accessory"][data-hero-option="hero-cape-clasp"]');
      const hair = svg.querySelector('[data-hero-slot="hair"][data-hero-option="long-layers"]');
      return Boolean(clasp && hair && (clasp.compareDocumentPosition(hair) & Node.DOCUMENT_POSITION_FOLLOWING));
    });
    expect(claspBehindHair, 'Hero cape clasp should be painted before hair so hair can cover it').toBe(true);
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
    await heroCustomizerAction(page, /save/i).click();
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
      await heroCustomizerAction(page, /randomize/i).click();
      const current = await hairStyle.inputValue();
      if (current !== initial) changed = true;
    }
    expect(changed, 'randomize should produce a different hair style within 16 attempts').toBe(true);
    await expect(page.locator('#hero-cust-status')).toContainText(/Randomized/i);
  });
});
