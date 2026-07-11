// @ts-check
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const yaml = require('js-yaml');
const { a11yCheckpoint } = require('./a11y-helpers');

const A11Y_FEATURE = 'se-gym-hero-avatar';
const GYM_URL = '/se-gym/';

const ACTIVATE_TOGGLE_SLIDER = '#activatePersonalGymToggle + .slider';
const MILESTONE_CONFIG = [
  { tier: 'bronze', key: 'gym_milestone_bronze', strength: 20 },
  { tier: 'silver', key: 'gym_milestone_silver', strength: 40 },
  { tier: 'gold', key: 'gym_milestone_gold', strength: 60 },
  { tier: 'diamond', key: 'gym_milestone_diamond', strength: 80 },
  { tier: 'infinity', key: 'gym_milestone_infinity', strength: 100 },
];

function readGymMilestoneThresholds() {
  const configPath = path.resolve(__dirname, '..', '_config.yml');
  const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
  const thresholds = {};
  let previous = 0;
  for (const milestone of MILESTONE_CONFIG) {
    const value = Number(config[milestone.key]);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`${milestone.key} in _config.yml must be a positive number.`);
    }
    if (value <= previous) {
      throw new Error(`${milestone.key} in _config.yml must be greater than the previous gym milestone threshold.`);
    }
    thresholds[milestone.tier] = value;
    previous = value;
  }
  return thresholds;
}

const GYM_MILESTONE_THRESHOLDS = readGymMilestoneThresholds();

function correctSeenCount(seen) {
  return Math.max(0, Math.min(seen, Number((seen * 0.95).toFixed(3))));
}

const CHOICE_PREVIEW_VIEWBOXES = {
  full: '238 34 324 596',
  hair: '288 38 224 268',
  eyebrows: '352 138 96 78',
  eyes: '352 154 96 78',
  ears: '326 154 148 80',
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

const FACE_SAFE_CROWN_REGION = Object.freeze({
  left: 328,
  top: 56,
  right: 472,
  bottom: 186,
  sampleStep: 4,
});

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
    earShape: 'oval',
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

async function setCookie(context, name, value) {
  await context.addCookies([{
    name,
    value: encodeURIComponent(value),
    domain: '127.0.0.1',
    path: '/',
  }]);
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
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#FFD100"/><path d="M3 6Q8 1 13 6V14H3Z" fill="#1f140c"/></svg>',
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
  await setCookie(page.context(), 'se-gym-active', 'true');
  if (await page.locator('#activatePersonalGymToggle').isChecked()) {
    await page.locator('#activatePersonalGymToggle').evaluate((toggle) => {
      toggle.dispatchEvent(new Event('change', { bubbles: true }));
    });
  } else {
    await page.locator(ACTIVATE_TOGGLE_SLIDER).click();
  }
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

async function readHeroAnimationState(page) {
  return page.evaluate(() => {
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
      pageTimes: pageSvgs.map((svg) => typeof svg.getCurrentTime === 'function' ? svg.getCurrentTime() : 0),
      modalPaused: modalSvg ? modalSvg.animationsPaused() : null,
      cssAnimatedCount: cssAnimated.length,
      cssPaused: cssAnimated.every((node) => getComputedStyle(node).animationPlayState === 'paused'),
    };
  });
}

function fineTuneOutput(page, target, axis) {
  return page.locator(`#hero-cust-tune-${target}-${axis}`);
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

async function measureForegroundCrown(hairline, hairStyle) {
  return hairline.evaluate((group, { style, region }) => {
    const svg = group.ownerSVGElement;
    const screenTransform = group.getScreenCTM();
    const geometryCount = group.querySelectorAll(
      'path, ellipse, circle, rect, polygon, polyline, line, use'
    ).length;
    const bounds = group.getBBox();
    const paintMap = [];
    const unsafePaintedPoints = [];
    let paintedPointCount = 0;
    let unsafePaintedPointCount = 0;

    const auditRegion = {
      left: Math.min(region.left, bounds.x) - region.sampleStep,
      top: Math.min(region.top, bounds.y) - region.sampleStep,
      right: Math.max(region.right, bounds.x + bounds.width) + region.sampleStep,
      bottom: Math.max(region.bottom, bounds.y + bounds.height) + region.sampleStep,
    };

    for (let y = auditRegion.top; y <= auditRegion.bottom; y += region.sampleStep) {
      for (let x = auditRegion.left; x <= auditRegion.right; x += region.sampleStep) {
        const point = svg.createSVGPoint();
        point.x = x;
        point.y = y;
        const screenPoint = point.matrixTransform(screenTransform);
        const isPainted = document.elementsFromPoint(screenPoint.x, screenPoint.y)
          .some((element) => element.closest && element.closest('[data-hero-slot="hairline"]') === group);
        paintMap.push(isPainted ? '1' : '0');
        if (!isPainted) continue;

        paintedPointCount++;
        const isFaceSafe = x >= region.left
          && x <= region.right
          && y >= region.top
          && y <= region.bottom;
        if (!isFaceSafe) {
          unsafePaintedPointCount++;
          if (unsafePaintedPoints.length < 12) unsafePaintedPoints.push({ x, y });
        }
      }
    }

    return {
      style,
      geometryCount,
      paintedPointCount,
      unsafePaintedPointCount,
      unsafePaintedPoints,
      paintMap: paintMap.join(''),
      bounds: {
        left: bounds.x,
        top: bounds.y,
        right: bounds.x + bounds.width,
        bottom: bounds.y + bounds.height,
      },
    };
  }, { style: hairStyle, region: FACE_SAFE_CROWN_REGION });
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

    const closedBefore = await readHeroAnimationState(page);
    expect(closedBefore.pageCount).toBeGreaterThan(0);
    expect(closedBefore.pagePaused).toEqual(closedBefore.pagePaused.map(() => false));

    await page.getByRole('button', { name: 'Customize Hero' }).click();
    const openState = await readHeroAnimationState(page);
    expect(openState.pagePaused).toEqual(openState.pagePaused.map(() => true));
    expect(openState.modalPaused).toBe(false);
    if (openState.cssAnimatedCount > 0) expect(openState.cssPaused).toBe(true);

    await heroCustomizerAction(page, 'Cancel').click();
    const closedAfter = await readHeroAnimationState(page);
    expect(closedAfter.pagePaused).toEqual(closedAfter.pagePaused.map(() => false));
  });

  test('Reduced motion override keeps hero SVG animations paused through customizer close', async ({ page }) => {
    await page.goto(`${GYM_URL}?reduce-motion=1`);
    await activatePersonalGym(page);

    const closedBefore = await readHeroAnimationState(page);
    expect(closedBefore.pageCount).toBeGreaterThan(0);
    expect(closedBefore.pagePaused).toEqual(closedBefore.pagePaused.map(() => true));

    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await expect(page.getByRole('dialog', { name: 'Customize your hero' })).toBeVisible();

    await expect.poll(async () => {
      const state = await readHeroAnimationState(page);
      return state.modalPaused;
    }, {
      message: 'modal preview should also pause when reduced motion is forced',
    }).toBe(true);

    const openState = await readHeroAnimationState(page);
    expect(openState.pagePaused).toEqual(openState.pagePaused.map(() => true));

    await heroCustomizerAction(page, 'Cancel').click();
    const closedAfter = await readHeroAnimationState(page);
    expect(closedAfter.pagePaused).toEqual(closedAfter.pagePaused.map(() => true));
  });

  test('Visible hero motion control pauses and resumes every page hero', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);

    const motionButton = page.getByRole('button', { name: 'Pause Hero Motion' });
    await expect(motionButton).toBeVisible();
    await expect.poll(async () => {
      const state = await readHeroAnimationState(page);
      return state.pageTimes.length > 0 && state.pageTimes.every((time) => time > 0.05);
    }).toBe(true);
    await motionButton.click();

    await expect(page.getByRole('button', { name: 'Play Hero Motion' })).toHaveAttribute('aria-pressed', 'true');
    const paused = await readHeroAnimationState(page);
    expect(paused.pagePaused).toEqual(paused.pagePaused.map(() => true));
    expect(paused.pageTimes.every((time) => time > 0.05), 'manual pause should freeze instead of rewinding').toBe(true);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const stillPaused = await readHeroAnimationState(page);
    expect(stillPaused.pageTimes).toHaveLength(paused.pageTimes.length);
    stillPaused.pageTimes.forEach((time, index) => {
      expect(time, `hero ${index} should remain at its paused animation time`).toBeCloseTo(paused.pageTimes[index], 4);
    });

    await page.getByRole('button', { name: 'Play Hero Motion' }).click();
    await expect(page.getByRole('button', { name: 'Pause Hero Motion' })).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(async () => {
      const state = await readHeroAnimationState(page);
      return state.pageTimes.every((time, index) => time > paused.pageTimes[index] + 0.02);
    }, { message: 'Play should advance every hero beyond its frozen timeline position' }).toBe(true);
    const resumed = await readHeroAnimationState(page);
    expect(resumed.pagePaused).toEqual(resumed.pagePaused.map(() => false));
  });

  test('Standalone stats hero stops automatically when no motion control is present', async ({ page }) => {
    test.setTimeout(12000);
    await page.goto('/se-gym-stats/');
    const hero = page.locator('.stats-hero [data-gym-hero-svg]');
    await expect(hero).toHaveAttribute('data-hero-avatar-ready', 'true');
    await expect(page.locator('#toggle-hero-motion-btn')).toHaveCount(0);
    await expect.poll(() => hero.evaluate((svg) => svg.getCurrentTime()), {
      message: 'standalone hero should animate before its automatic stop',
      timeout: 2500,
    }).toBeGreaterThan(0.05);
    expect(await hero.evaluate((svg) => svg.animationsPaused())).toBe(false);
    const activeTime = await hero.evaluate((svg) => svg.getCurrentTime());
    await expect.poll(() => hero.evaluate((svg) => svg.animationsPaused()), { timeout: 7000 }).toBe(true);
    const stoppedTime = await hero.evaluate((svg) => svg.getCurrentTime());
    expect(stoppedTime).toBeGreaterThan(activeTime);
    await hero.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    expect(await hero.evaluate((svg) => svg.getCurrentTime())).toBeCloseTo(stoppedTime, 4);
    const remainsStoppedAfterPreferenceRoundTrip = await hero.evaluate((svg) => {
      const state = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(window.HeroAvatar.DEFAULTS)));
      window.__prefersReducedMotion = () => true;
      window.HeroAvatar.applyToSvg(svg, state);
      window.__prefersReducedMotion = () => false;
      window.HeroAvatar.applyToSvg(svg, state);
      return svg.animationsPaused();
    });
    expect(remainsStoppedAfterPreferenceRoundTrip).toBe(true);
  });

  test('Hero motion synchronizes the causal lift rig while varying biological cadence', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);

    const motionClockFailures = await page.evaluate(() => {
      const failures = [];
      const sharedTiming = {
        dur: '2.2s',
        keyTimes: '0;0.55;1',
        calcMode: 'spline',
        keySplines: '0.5 0 0.4 1; 0.2 0.7 0.3 1',
        begin: '0s',
      };

      for (const svg of document.querySelectorAll('[data-gym-hero-svg]')) {
        const variantClass = Array.from(svg.classList).find((name) => name.startsWith('se-gym-hero-svg-'));
        const label = variantClass || 'unlabeled hero svg';
        const allAnimations = Array.from(svg.querySelectorAll('animate, animateTransform'));
        const linkedCycleAnimations = allAnimations.filter((node) =>
          node.getAttribute('dur') === sharedTiming.dur
        );

        if (linkedCycleAnimations.length === 0) {
          failures.push({ label, reason: 'missing shared-cycle animations' });
          continue;
        }

        for (const node of allAnimations) {
          if (node.getAttribute('begin') !== '0s') {
            failures.push({
              label,
              reason: 'animation does not start on the shared zero-time boundary',
              details: {
                tagName: node.tagName,
                attributeName: node.getAttribute('attributeName'),
                dur: node.getAttribute('dur'),
                begin: node.getAttribute('begin'),
                values: node.getAttribute('values'),
              },
            });
          }
          const durationSeconds = Number.parseFloat(node.getAttribute('dur') || '');
          const liftCycles = durationSeconds / 2.2;
          if (!Number.isFinite(durationSeconds) || Math.abs(liftCycles - Math.round(liftCycles)) > 0.0001) {
            failures.push({
              label,
              reason: 'animation duration is not a harmonic of the 2.2 second lift cycle',
              details: { dur: node.getAttribute('dur'), attributeName: node.getAttribute('attributeName') },
            });
          }
        }

        const blinkAnimations = Array.from(svg.querySelectorAll(
          '[data-hero-motion="eye-blink"] > animate, ' +
          '[data-hero-motion="eye-blink"] > animateTransform, ' +
          '[data-hero-motion="closed-eyelids"] > animate, ' +
          '[data-hero-motion="eyelash-blink"] > animateTransform'
        ));
        if (blinkAnimations.length !== 4) {
          failures.push({ label, reason: 'incomplete authored blink rig', details: blinkAnimations.length });
        }
        const blinkKeyTimes = blinkAnimations.map((node) => node.getAttribute('keyTimes') || '');
        if (new Set(blinkKeyTimes).size !== 1) {
          failures.push({ label, reason: 'eye, lid, and eyelash blink timelines drift apart', details: blinkKeyTimes });
        }
        for (const node of blinkAnimations) {
          const keyTimes = (node.getAttribute('keyTimes') || '').split(';').map(Number);
          const values = (node.getAttribute('values') || '').split(';');
          const monotonic = keyTimes.every((time, index) => index === 0 || time > keyTimes[index - 1]);
          if (
            node.getAttribute('dur') !== '13.2s'
            || node.getAttribute('begin') !== '0s'
            || keyTimes.length !== values.length
            || keyTimes[0] !== 0
            || keyTimes[keyTimes.length - 1] !== 1
            || !monotonic
          ) {
            failures.push({
              label,
              reason: 'blink cue has an invalid or unsynchronized SMIL timeline',
              details: { dur: node.getAttribute('dur'), begin: node.getAttribute('begin'), keyTimes, values },
            });
          }
        }
        const eyeOpacity = svg.querySelector('[data-hero-motion="eye-blink"] > animate[attributeName="opacity"]');
        if (eyeOpacity) {
          const keyTimes = eyeOpacity.getAttribute('keyTimes').split(';').map(Number);
          const values = eyeOpacity.getAttribute('values').split(';');
          const closureStarts = keyTimes.filter((time, index) => index > 0 && values[index] === '0' && values[index - 1] === '1');
          const blinkGaps = closureStarts.map((time, index) => {
            const next = closureStarts[(index + 1) % closureStarts.length];
            return index === closureStarts.length - 1 ? 1 + next - time : next - time;
          });
          if (closureStarts.length !== 3 || Math.max(...blinkGaps) - Math.min(...blinkGaps) < 0.05) {
            failures.push({ label, reason: 'blink cadence should contain three non-uniform intervals', details: { closureStarts, blinkGaps } });
          }
        } else {
          failures.push({ label, reason: 'missing eye-opacity blink driver' });
        }

        const bodyLift = svg.querySelector('[data-hero-motion="body-lift"]');
        const bodyFrameTransforms = bodyLift
          ? Array.from(bodyLift.children).filter((node) => node.localName === 'animateTransform')
          : [];
        if (bodyFrameTransforms.length > 0) {
          failures.push({ label, reason: 'planted body frame should not translate the boots' });
        }
        const capeTranslations = Array.from(svg.querySelectorAll('[data-hero-motion="cape-rock"] > animateTransform'))
          .filter((node) => node.getAttribute('type') === 'translate');
        if (capeTranslations.length > 0) {
          failures.push({ label, reason: 'cape should rotate locally without inheriting a body translation' });
        }

        for (const node of linkedCycleAnimations) {
          const details = {
            tagName: node.tagName,
            attributeName: node.getAttribute('attributeName'),
            id: node.id || null,
            values: node.getAttribute('values'),
            begin: node.getAttribute('begin'),
            dur: node.getAttribute('dur'),
            keyTimes: node.getAttribute('keyTimes'),
            calcMode: node.getAttribute('calcMode'),
            keySplines: node.getAttribute('keySplines'),
          };

          for (const [name, value] of Object.entries(sharedTiming)) {
            if (details[name] !== value) {
              failures.push({ label, reason: 'motion animation does not use shared timing', expected: { [name]: value }, details });
            }
          }
        }
      }

      return failures;
    });

    expect(motionClockFailures).toEqual([]);
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
      { label: 'Cross pendant', value: 'cross-pendant' },
      { label: 'Star of David pendant', value: 'six-point-star-pendant' },
      { label: 'Dharma wheel pendant', value: 'wheel-pendant' },
      { label: 'Om pendant', value: 'sacred-syllable-pendant' },
      { label: 'Hamsa pendant', value: 'open-hand-pendant' },
      { label: 'Student ID badge', value: 'student-id-badge' },
      { label: 'Backpack straps', value: 'backpack-straps' },
      { label: 'Messenger bag strap', value: 'messenger-bag' },
      { label: 'Circuit pin', value: 'circuit-pin' },
      { label: 'Code patch', value: 'code-patch' },
      { label: 'Stud earrings', value: 'stud-earrings' },
      { label: 'Collar pin', value: 'collar-pin' },
      { label: 'Study badge', value: 'study-badge' },
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
        function transformedBox(svg, featureNode, bbox) {
          const rawBox = {
            x: bbox.x,
            y: bbox.y,
            width: bbox.width,
            height: bbox.height,
            right: bbox.x + bbox.width,
            bottom: bbox.y + bbox.height,
          };
          const nodeMatrix = featureNode.getCTM && featureNode.getCTM();
          const svgMatrix = svg.getCTM && svg.getCTM();
          if (!nodeMatrix || !svgMatrix || !svgMatrix.inverse) return rawBox;
          const matrix = svgMatrix.inverse().multiply(nodeMatrix);
          const points = [
            new DOMPoint(bbox.x, bbox.y).matrixTransform(matrix),
            new DOMPoint(bbox.x + bbox.width, bbox.y).matrixTransform(matrix),
            new DOMPoint(bbox.x, bbox.y + bbox.height).matrixTransform(matrix),
            new DOMPoint(bbox.x + bbox.width, bbox.y + bbox.height).matrixTransform(matrix),
          ];
          const x = Math.min(...points.map((point) => point.x));
          const y = Math.min(...points.map((point) => point.y));
          const right = Math.max(...points.map((point) => point.x));
          const bottom = Math.max(...points.map((point) => point.y));
          return { x, y, width: right - x, height: bottom - y, right, bottom };
        }
        const viewBox = parseBox(node.getAttribute('viewBox'));
        const upper = parseBox('246 86 308 374');
        const feature = Array.from(node.querySelectorAll(`[data-hero-slot="accessory"][data-hero-option="${value}"] *`)).reduce((box, featureNode) => {
          try {
            const bbox = featureNode.getBBox();
            if (!bbox || bbox.width <= 0 || bbox.height <= 0) return box;
            return unionBox(box, transformedBox(node, featureNode, bbox));
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
        const micAfterMouth = await page.locator('#hero-customizer-modal .hero-cust-preview [data-gym-hero-svg]').evaluate((node) => {
          const mouthLayer = node.querySelector('[data-hero-mouth-layer]');
          const mic = node.querySelector('[data-hero-accessory-part="mic-boom"]');
          return Boolean(mouthLayer && mic && (mouthLayer.compareDocumentPosition(mic) & Node.DOCUMENT_POSITION_FOLLOWING));
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
      { key: 'earShape', crop: 'ears', viewBox: CHOICE_PREVIEW_VIEWBOXES.ears },
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

      function transformedBox(featureNode, bbox) {
        const rawBox = {
          x: bbox.x,
          y: bbox.y,
          width: bbox.width,
          height: bbox.height,
          right: bbox.x + bbox.width,
          bottom: bbox.y + bbox.height,
        };
        const nodeMatrix = featureNode.getCTM && featureNode.getCTM();
        const svgMatrix = svg.getCTM && svg.getCTM();
        if (!nodeMatrix || !svgMatrix || !svgMatrix.inverse) return rawBox;
        const matrix = svgMatrix.inverse().multiply(nodeMatrix);
        const points = [
          new DOMPoint(bbox.x, bbox.y).matrixTransform(matrix),
          new DOMPoint(bbox.x + bbox.width, bbox.y).matrixTransform(matrix),
          new DOMPoint(bbox.x, bbox.y + bbox.height).matrixTransform(matrix),
          new DOMPoint(bbox.x + bbox.width, bbox.y + bbox.height).matrixTransform(matrix),
        ];
        const x = Math.min(...points.map((point) => point.x));
        const y = Math.min(...points.map((point) => point.y));
        const right = Math.max(...points.map((point) => point.x));
        const bottom = Math.max(...points.map((point) => point.y));
        return { x, y, width: right - x, height: bottom - y, right, bottom };
      }

      function visibleBox(selector) {
        return Array.from(svg.querySelectorAll(selector)).reduce((box, node) => {
          if (node.closest('[display="none"]')) return box;
          try {
            const bbox = node.getBBox();
            if (!bbox || bbox.width <= 0 || bbox.height <= 0) return box;
            return unionBox(box, transformedBox(node, bbox));
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
        containsDeclared: Boolean(
          viewBox &&
          declared &&
          declared.x >= viewBox.x - tolerance &&
          declared.y >= viewBox.y - tolerance &&
          declared.right <= viewBox.right + tolerance &&
          declared.bottom <= viewBox.bottom + tolerance
        ),
        expandsForLongHair: Boolean(
          viewBox &&
          declared &&
          viewBox.bottom > declared.bottom + tolerance
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
    expect(hairCrop.containsDeclared, `long hair preview should include the registry crop ${hairCrop.declared}`).toBe(true);
    expect(hairCrop.expandsForLongHair, `long hair preview should expand beyond the compact hair crop ${hairCrop.declared}`).toBe(true);
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
      expect(contrastRatio('#1f140c', color), `representative dark hair should remain visible on ${color}`).toBeGreaterThanOrEqual(3);
      expect(contrastRatio('#ffd100', color), `representative yellow skin should remain visible on ${color}`).toBeGreaterThanOrEqual(3);
    }
    expect(contrastRatio('#e9ecf2', previewColors.border)).toBeGreaterThanOrEqual(3);
    expect(previewColors.backgroundImage).toContain('linear-gradient');

    const headsetChoice = page.locator('#hero-customizer-modal label.hero-cust-accessory-choice').filter({ hasText: 'Headset with mic' });
    await expect(headsetChoice.locator('[data-hero-choice-preview-img]'))
      .toHaveAttribute('src', '/assets/se-gym-hero-choice-previews/accessory-headset-mic.svg');
  });

  test('Production choice thumbnails keep their true colors in dark mode (no SVG inversion)', async ({ page }) => {
    await page.addInitScript(() => { document.documentElement.classList.add('dark-mode'); });
    await installStaticChoicePreviewManifest(page, {
      hairStyle: { long: 'hair-style-long.svg' },
    });

    await page.goto(GYM_URL);
    await page.evaluate(() => { document.documentElement.classList.add('dark-mode'); });
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();

    const hairImage = page.getByRole('button', { name: 'Choose Hair style: Long and flowing' })
      .locator('[data-hero-choice-preview-img]');
    await expect(hairImage).toHaveAttribute('src', '/assets/se-gym-hero-choice-previews/hair-style-long.svg');

    // portfolio.css inverts every `.post-content img[src$=".svg"]` in dark mode
    // for line-art diagrams. These thumbnails are full-color avatar art, so that
    // inversion would render skin/hair/suit as their negatives — the per-component
    // override in se-gym.css must win and keep the colors intact.
    const filter = await hairImage.evaluate((img) => getComputedStyle(img).filter);
    expect(filter, `thumbnail must stay vector-native and opt out of SVG inversion (got "${filter}")`).toBe('none');
  });

  test('Live heroes and generated thumbnails remain vector-native at every layer', async ({ page }) => {
    await installStaticChoicePreviewManifest(page, {
      hairStyle: { long: 'hair-style-long.svg' },
    });
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();

    const hero = page.locator('#hero-customizer-modal [data-gym-hero-svg]');
    const vectorAudit = await hero.evaluate((svg) => ({
      embeddedRasterCount: svg.querySelectorAll('image, foreignObject').length,
      fontGlyphCount: svg.querySelectorAll('text').length,
      rasterizingDefinitionCount: svg.querySelectorAll('filter, feGaussianBlur, feDropShadow').length,
      filterAttributeCount: svg.querySelectorAll('[filter]').length,
      externalReferenceCount: Array.from(svg.querySelectorAll('[href], [xlink\\:href]')).filter((node) => {
        const href = node.getAttribute('href') || node.getAttribute('xlink:href') || '';
        return href && !href.startsWith('#');
      }).length,
      rootFilter: getComputedStyle(svg).filter,
      renderingHints: {
        shapes: svg.getAttribute('shape-rendering'),
        text: svg.getAttribute('text-rendering'),
        color: svg.getAttribute('color-interpolation'),
      },
      filteredElements: Array.from(svg.querySelectorAll('*'))
        .filter((node) => getComputedStyle(node).filter !== 'none')
        .map((node) => ({
          tag: node.localName,
          slot: node.getAttribute('data-hero-slot'),
          option: node.getAttribute('data-hero-option'),
          filter: getComputedStyle(node).filter,
        })),
    }));

    expect(vectorAudit).toEqual({
      embeddedRasterCount: 0,
      fontGlyphCount: 0,
      rasterizingDefinitionCount: 0,
      filterAttributeCount: 0,
      externalReferenceCount: 0,
      rootFilter: 'none',
      renderingHints: {
        shapes: 'geometricPrecision',
        text: 'geometricPrecision',
        color: 'sRGB',
      },
      filteredElements: [],
    });

    const thumbnail = page.getByRole('button', { name: 'Choose Hair style: Long and flowing' })
      .locator('[data-hero-choice-preview-img]');
    await expect(thumbnail).toHaveAttribute('src', /\.svg$/);
    expect(await thumbnail.evaluate((img) => getComputedStyle(img).filter)).toBe('none');
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
    test.setTimeout(180000);
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

      function transformedBox(svg, featureNode, bbox) {
        const rawBox = {
          x: bbox.x,
          y: bbox.y,
          width: bbox.width,
          height: bbox.height,
          right: bbox.x + bbox.width,
          bottom: bbox.y + bbox.height,
        };
        const nodeMatrix = featureNode.getCTM && featureNode.getCTM();
        const svgMatrix = svg.getCTM && svg.getCTM();
        if (!nodeMatrix || !svgMatrix || !svgMatrix.inverse) return rawBox;
        const matrix = svgMatrix.inverse().multiply(nodeMatrix);
        const points = [
          new DOMPoint(bbox.x, bbox.y).matrixTransform(matrix),
          new DOMPoint(bbox.x + bbox.width, bbox.y).matrixTransform(matrix),
          new DOMPoint(bbox.x, bbox.y + bbox.height).matrixTransform(matrix),
          new DOMPoint(bbox.x + bbox.width, bbox.y + bbox.height).matrixTransform(matrix),
        ];
        const x = Math.min(...points.map((point) => point.x));
        const y = Math.min(...points.map((point) => point.y));
        const right = Math.max(...points.map((point) => point.x));
        const bottom = Math.max(...points.map((point) => point.y));
        return { x, y, width: right - x, height: bottom - y, right, bottom };
      }

      function visibleUnionBox(svg, selector) {
        return Array.from(svg.querySelectorAll(selector)).reduce((box, node) => {
          if (node.closest('[display="none"]')) return box;
          try {
            const bbox = node.getBBox();
            if (!bbox || bbox.width <= 0 || bbox.height <= 0) return box;
            return unionBox(box, transformedBox(svg, node, bbox));
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
          const bbox = group.getBBox();
          const box = transformedBox(svg, group, bbox);
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
      legacyDetails.appearance.presentation = 'female';
      legacyDetails.appearance.headStyle = 'feminine';
      legacyDetails.appearance.eyeShape = 'monolid';
      legacyDetails.appearance.faceFeature = 'cheek-lines';
      legacyDetails.body.type = 'stocky';
      legacyDetails.outfit.accessory = 'forehead-accent';
      legacyDetails.outfit.accessories = ['forehead-accent'];

      return {
        hairGroups: window.HeroAvatar.CHOICE_SETS.hairStyle.groups.map((group) => ({ key: group.key, label: group.label })),
        headGroupLabels: window.HeroAvatar.CHOICE_SETS.headStyle.groups.map((group) => group.label),
        bodyGroups: window.HeroAvatar.CHOICE_SETS.bodyType.groups.map((group) => ({ key: group.key, label: group.label })),
        hairValues: flatten(window.HeroAvatar.CHOICE_SETS.hairStyle).map((option) => option.value),
        eyeValues: flatten(window.HeroAvatar.CHOICE_SETS.eyeShape).map((option) => option.value),
        earValues: flatten(window.HeroAvatar.CHOICE_SETS.earShape).map((option) => option.value),
        eyelashValues: flatten(window.HeroAvatar.CHOICE_SETS.eyelashStyle).map((option) => option.value),
        noseValues: flatten(window.HeroAvatar.CHOICE_SETS.noseShape).map((option) => option.value),
        mouthValues: flatten(window.HeroAvatar.CHOICE_SETS.mouthStyle).map((option) => option.value),
        faceFeatureValues: flatten(window.HeroAvatar.CHOICE_SETS.faceFeature).map((option) => option.value),
        bodyValues: flatten(window.HeroAvatar.CHOICE_SETS.bodyType).map((option) => option.value),
        accessoryValues: flatten(window.HeroAvatar.CHOICE_SETS.accessory).map((option) => option.value),
        hairLabels: labelsByValue(window.HeroAvatar.CHOICE_SETS.hairStyle),
        eyeLabels: labelsByValue(window.HeroAvatar.CHOICE_SETS.eyeShape),
        earLabels: labelsByValue(window.HeroAvatar.CHOICE_SETS.earShape),
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
    expect(summary.hairGroups).toEqual([
      { key: 'short', label: 'Short styles' },
      { key: 'long', label: 'Medium and long styles' },
      { key: 'textured', label: 'Curls, coils, and textured styles' },
      { key: 'braids-locs-tied', label: 'Braids, locs, and tied styles' },
      { key: 'bald', label: 'No visible hair' },
    ]);
    expect(summary.headGroupLabels).not.toContain('Natural face shapes');
    expect(summary.bodyGroups).toEqual([
      { key: 'narrow-medium', label: 'Narrow and medium frames' },
      { key: 'shoulder-broad', label: 'Shoulder-tapered and broad frames' },
      { key: 'curved-full', label: 'Curved and full frames' },
    ]);
    expect(summary.hairValues).toContain('locs-bun');
    expect(summary.eyeValues).not.toContain('monolid');
    expect(summary.eyeValues).not.toContain('soft-monolid');
    expect(summary.eyeValues).toEqual(expect.arrayContaining(['single-eyelid', 'soft-single-eyelid', 'wide-single-eyelid', 'tapered-almond', 'upturned-almond', 'downturned-soft', 'deep-set']));
    expect(summary.earValues).toEqual(expect.arrayContaining(['oval', 'small-round', 'broad-round', 'narrow', 'attached-lobe', 'free-lobe', 'prominent', 'soft-angled']));
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
      'collar-pin',
      'study-badge',
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
    expect(summary.earLabels['oval']).toBe('Balanced oval');
    expect(summary.earLabels['attached-lobe']).toBe('Attached lobes');
    expect(summary.earLabels['free-lobe']).toBe('Free lobes');
    expect(summary.earLabels['soft-angled']).toBe('Soft angled');
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
    expect(summary.bodyLabels.petite).toBe('Narrow frame');
    expect(summary.bodyLabels.tall).toBe('Long-torso tapered frame');
    expect(summary.bodyLabels.solid).toBe('Broad straight frame');
    expect(summary.bodyLabels['short-curved']).toBe('Hip-accented curved frame');
    expect(summary.bodyLabels['balanced-full']).toBe('Full straight frame');
    expect(summary.bodyLabels['tall-soft']).toBe('Soft medium-full frame');
    expect(summary.bodyLabels['full-frame']).toBe('Full frame');
    expect(summary.accessoryLabels['draped-scarf']).toBe('Draped head scarf');
    expect(summary.accessoryLabels['forehead-jewel']).toBe('Forehead jewel');
    expect(summary.accessoryLabels['headset-mic']).toBe('Headset with mic');
    expect(summary.accessoryLabels['cross-pendant']).toBe('Cross pendant');
    expect(summary.accessoryLabels['six-point-star-pendant']).toBe('Star of David pendant');
    expect(summary.accessoryLabels['wheel-pendant']).toBe('Dharma wheel pendant');
    expect(summary.accessoryLabels['sacred-syllable-pendant']).toBe('Om pendant');
    expect(summary.accessoryLabels['open-hand-pendant']).toBe('Hamsa pendant');
    expect(summary.accessoryLabels['student-id-badge']).toBe('Student ID badge');
    expect(summary.accessoryLabels['utility-belt']).toBe('Utility belt');
    expect(summary.accessoryLabels['code-patch']).toBe('Code patch');
    expect(summary.accessoryLabels['embroidered-prayer-cap']).toBe('Embroidered prayer cap');
    expect(summary.accessoryLabels['wrapped-dastar']).toBe('Wrapped dastar');
    expect(summary.accessoryLabels['hero-cape-clasp']).toBe('Hero cape clasp');
    expect(summary.accessoryValues).not.toContain('smartwatch');
    expect(summary.accessoryValues).not.toContain('hero-gauntlets');
    expect(summary.legacyLocsValidation.ok).toBe(true);
    expect(summary.normalizedLegacyLocs.appearance.hairStyle).toBe('locs-bun');
    expect(summary.normalizedLegacyLocs.body.type).toBe('full-frame');
    expect(summary.legacyHipValidation.ok).toBe(true);
    expect(summary.normalizedLegacyHip.body.type).toBe('fuller-hip');
    expect(summary.legacyDetailsValidation.ok).toBe(true);
    expect(summary.normalizedLegacyDetails.appearance).not.toHaveProperty('presentation');
    expect(summary.normalizedLegacyDetails.appearance.headStyle).toBe('soft-features');
    expect(summary.normalizedLegacyDetails.appearance.eyeShape).toBe('single-eyelid');
    expect(summary.normalizedLegacyDetails.appearance.faceFeature).toBe('none');
    expect(summary.normalizedLegacyDetails.body.type).toBe('solid');
    expect(summary.normalizedLegacyDetails.outfit.accessories).toEqual(['forehead-jewel']);
  });

  test('Every visible hair choice has distinct authored geometry', async ({ page }) => {
    await page.goto(GYM_URL);

    const audit = await page.evaluate(() => {
      const svg = document.querySelector('[data-gym-hero-svg]');
      const values = window.HeroAvatar.CHOICE_SETS.hairStyle.groups
        .flatMap((group) => group.options.map((option) => option.value))
        .filter((value) => value !== 'bald');
      const fingerprints = new Map();
      const missing = [];
      for (const value of values) {
        const group = svg.querySelector(`[data-hero-slot="hair"][data-hero-option="${value}"]`);
        const visualCount = group
          ? group.querySelectorAll('path, ellipse, circle, rect, polygon, polyline, line, use').length
          : 0;
        if (!group || visualCount === 0) {
          missing.push(value);
          continue;
        }
        const fingerprint = group.innerHTML
          .replace(/<!--[\s\S]*?-->/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (!fingerprints.has(fingerprint)) fingerprints.set(fingerprint, []);
        fingerprints.get(fingerprint).push(value);
      }
      return {
        missing,
        duplicates: Array.from(fingerprints.values()).filter((styles) => styles.length > 1),
      };
    });

    expect(audit.missing).toEqual([]);
    expect(audit.duplicates).toEqual([]);
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
    expect(representativeHairColor).toBe('#1f140c');

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
      { presetsLabel: 'Preset swatches for skin', hslLabel: 'HSL sliders for skin', presets: 15 },
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
      .getByRole('button', { name: 'Use skin preset deepest neutral' })).toBeVisible();
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

  test('Random avatar generation keeps traits independent, valid, and varied', async ({ page }) => {
    await page.goto(GYM_URL);

    const summary = await page.evaluate(() => {
      const originalRandom = Math.random;
      let seed = 246813579;
      Math.random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };

      const skinBands = {
        light: new Set(['#f8dfcf', '#f4d0c4', '#e8c8a8']),
        medium: new Set(['#ddb08a', '#cf9e82', '#bd8075', '#ad7953']),
        deep: new Set(['#9b6042', '#875a50', '#754b39', '#633f2b']),
        darkest: new Set(['#512d22', '#452a2b', '#35241f', '#291713']),
      };
      const bodyFamilyEntries = Object.entries(window.HeroAvatar.RANDOM_TRAIT_POLICY.bodyFamilies);
      const bodyFamilyByType = new Map(bodyFamilyEntries.flatMap(([family, values]) =>
        values.map((value) => [value, family])
      ));
      const costumeAccessories = new Set(['crown', 'halo', 'monocle', 'eyepatch', 'mask']);
      const religiousAccessories = new Set(['cross-pendant', 'six-point-star-pendant', 'wheel-pendant', 'sacred-syllable-pendant', 'open-hand-pendant', 'embroidered-prayer-cap', 'wrapped-dastar', 'hijab', 'turban']);
      const manualOnlyAccessories = new Set(['crown', 'halo', 'monocle', 'eyepatch', 'mask', 'forehead-jewel', ...religiousAccessories]);
      const coveredHairAccessories = new Set(['draped-scarf', 'hijab', 'headwrap', 'wrapped-dastar']);
      const currentCampusAccessories = new Set(['over-ear-headphones', 'wireless-earbuds', 'wired-earbuds', 'chain-necklace', 'delicate-pendant-necklace', 'campus-lanyard', 'bandana']);
      const expressiveManualHair = new Set(['mohawk', 'bowl-cut', 'pigtails', 'top-knot']);
      const upbeatMouthStyles = new Set(['grin', 'closed-smile', 'small-smile', 'bright-smile', 'wide-smile', 'cheerful-grin', 'open-smile', 'excited-smile']);
      const prominentEyelashStyles = new Set(['outer-corner', 'soft-fan', 'full-upper', 'long-classic', 'long-doll', 'long-glam', 'winged', 'dense']);
      const everydayCampusOutfits = new Set(['hoodie', 'crewneck-sweatshirt', 'soft-tee', 'varsity-jacket', 'denim-jacket', 'flannel-overshirt', 'striped-knit', 'windbreaker', 'track-jacket', 'polo-shirt', 'collared-shirt', 'open-collar-shirt', 'oxford-shirt', 'blazer', 'kurta-top', 'campus-blouse', 'cardigan', 'scholar-vest']);
      const costumeOutfits = new Set(['super-suit', 'captain-jacket']);
      const technicalOutfits = new Set(['lab-coat', 'utility-vest']);
      const naturalHairColors = new Set([
        '#1f140c', '#3d2818', '#6a4830', '#a07050', '#c08555', '#d8b074',
        '#e8d090', '#704530', '#1a1a1a', '#2e2e2e', '#5e3a2f', '#854a3a', '#7a4a2f',
      ]);
      const bandCounts = { light: 0, medium: 0, deep: 0, darkest: 0 };
      const skinHairSupport = Object.fromEntries(Object.keys(skinBands).map((band) => [band, new Set()]));
      const hairSkinSupport = {
        short: new Set(),
        long: new Set(),
        textured: new Set(),
        'braids-locs-tied': new Set(),
        bald: new Set(),
      };
      const hairFamilyByStyle = new Map();
      for (const group of window.HeroAvatar.CHOICE_SETS.hairStyle.groups) {
        for (const option of group.options) hairFamilyByStyle.set(option.value, group.key);
      }
      const skinTraitSupport = Object.fromEntries(Object.keys(skinBands).map((band) => [band, {
        eyeShape: new Set(),
        eyeColor: new Set(),
        noseShape: new Set(),
        headStyle: new Set(),
        hairColor: new Set(),
      }]));
      const hairEyeSupport = Object.fromEntries(Object.keys(hairSkinSupport).map((family) => [family, new Set()]));
      const hairFacialHairSupport = Object.fromEntries(Object.keys(hairSkinSupport).map((family) => [family, new Set()]));
      const hairLashSupport = Object.fromEntries(Object.keys(hairSkinSupport).map((family) => [family, new Set()]));
      const facialHairLashSupport = { facialHair: new Set(), none: new Set() };
      const bodyTraitSupport = Object.fromEntries(bodyFamilyEntries.map(([family]) => [
        family,
        { facialHair: new Set(), lashes: new Set() },
      ]));
      const choiceCount = (key) => window.HeroAvatar.CHOICE_SETS[key].groups
        .reduce((count, group) => count + group.options.length, 0);
      const traitCatalogSizes = {
        eyeShape: choiceCount('eyeShape'),
        noseShape: choiceCount('noseShape'),
        headStyle: choiceCount('headStyle'),
      };
      const facialHairSkinBands = new Set();
      const prominentEyelashSkinBands = new Set();
      const bodyFamilySkinBands = Object.fromEntries(bodyFamilyEntries.map(([family]) => [family, new Set()]));
      const bodyFamilyCounts = Object.fromEntries(bodyFamilyEntries.map(([family]) => [family, 0]));
      const bodyTypes = new Set();
      const sampledHairStyles = new Set();
      const sampledFacialHairStyles = new Set();
      const campusAccessoryTypes = new Set();
      const mouthTypes = new Set();
      const invalid = [];
      let maleSamples = 0;
      let femaleSamples = 0;
      let incompatibleHairClipSamples = 0;
      let costumeAccessorySamples = 0;
      let manualOnlyAccessorySamples = 0;
      let religiousAccessorySamples = 0;
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
      let prominentEyelashSamples = 0;
      let legacyPresentationFieldSamples = 0;

      try {
        for (let i = 0; i < 640; i++) {
          const avatar = window.HeroAvatar.randomAvatar();
          const validation = window.HeroAvatar.validateAvatar(avatar);
          if (!validation.ok) invalid.push(validation.error);

          if (Object.prototype.hasOwnProperty.call(avatar.appearance, 'presentation')) {
            legacyPresentationFieldSamples++;
          }

          if (avatar.appearance.presentation === 'male') maleSamples++;
          if (avatar.appearance.presentation === 'female') femaleSamples++;

          const skinBand = Object.entries(skinBands)
            .find(([, tones]) => tones.has(avatar.appearance.skin))?.[0];
          const hairFamily = hairFamilyByStyle.get(avatar.appearance.hairStyle);
          sampledHairStyles.add(avatar.appearance.hairStyle);
          sampledFacialHairStyles.add(avatar.appearance.facialHair);
          const hasVisibleFacialHair = !['none', 'clean-shaven'].includes(avatar.appearance.facialHair);
          const facialHairCategory = hasVisibleFacialHair ? 'facialHair' : 'none';
          const lashCategory = prominentEyelashStyles.has(avatar.appearance.eyelashStyle) ? 'prominent' : 'plain';
          if (skinBand) bandCounts[skinBand]++;
          if (skinBand && hairFamily) {
            skinHairSupport[skinBand].add(hairFamily);
            hairSkinSupport[hairFamily].add(skinBand);
            hairEyeSupport[hairFamily].add(avatar.appearance.eyeShape);
            hairFacialHairSupport[hairFamily].add(facialHairCategory);
            hairLashSupport[hairFamily].add(lashCategory);
          }
          facialHairLashSupport[facialHairCategory].add(lashCategory);
          if (skinBand) {
            skinTraitSupport[skinBand].eyeShape.add(avatar.appearance.eyeShape);
            skinTraitSupport[skinBand].eyeColor.add(avatar.appearance.eyeColor);
            skinTraitSupport[skinBand].noseShape.add(avatar.appearance.noseShape);
            skinTraitSupport[skinBand].headStyle.add(avatar.appearance.headStyle);
            skinTraitSupport[skinBand].hairColor.add(avatar.appearance.hairColor);
          }

          const bodyType = avatar.body.type;
          const bodyFamily = bodyFamilyByType.get(bodyType);
          bodyTypes.add(bodyType);
          bodyFamilyCounts[bodyFamily]++;
          if (skinBand) bodyFamilySkinBands[bodyFamily].add(skinBand);
          bodyTraitSupport[bodyFamily].facialHair.add(facialHairCategory);
          bodyTraitSupport[bodyFamily].lashes.add(lashCategory);

          const accessories = avatar.outfit.accessories || [];
          if (
            accessories.includes('hair-clips')
            && window.HeroAvatar.ACCESSORY_COMPATIBILITY.hairClipIncompatibleStyles.includes(avatar.appearance.hairStyle)
          ) incompatibleHairClipSamples++;
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
          if (prominentEyelashStyles.has(avatar.appearance.eyelashStyle)) {
            prominentEyelashSamples++;
            if (skinBand) prominentEyelashSkinBands.add(skinBand);
          }
          if (!hasVisibleFacialHair) {
            cleanShavenSamples++;
          } else {
            facialHairSamples++;
            if (skinBand) facialHairSkinBands.add(skinBand);
          }
        }
      } finally {
        Math.random = originalRandom;
      }

      return {
        registeredHairValues: window.HeroAvatar.CHOICE_SETS.hairStyle.groups.flatMap((group) => group.options.map((option) => option.value)),
        randomPolicyHairValues: Object.values(window.HeroAvatar.RANDOM_TRAIT_POLICY.hairFamilies).flat(),
        registeredBodyValues: window.HeroAvatar.CHOICE_SETS.bodyType.groups.flatMap((group) => group.options.map((option) => option.value)),
        randomPolicyBodyValues: window.HeroAvatar.RANDOM_TRAIT_POLICY.bodyTypes,
        registeredFacialHairValues: window.HeroAvatar.CHOICE_SETS.facialHair.groups.flatMap((group) => group.options.map((option) => option.value)),
        randomPolicyFacialHairValues: window.HeroAvatar.RANDOM_TRAIT_POLICY.facialHairStyles,
        sampledHairStyles: Array.from(sampledHairStyles),
        sampledFacialHairStyles: Array.from(sampledFacialHairStyles),
        missingManualOnlyExclusions: Array.from(manualOnlyAccessories)
          .filter((accessory) => !window.HeroAvatar.RANDOM_TRAIT_POLICY.excludedAccessories.includes(accessory)),
        invalidCount: invalid.length,
        firstInvalid: invalid[0] || null,
        coveredSkinBands: Object.values(bandCounts).filter((count) => count > 0).length,
        skinHairSupport: Object.fromEntries(Object.entries(skinHairSupport).map(([band, families]) => [band, families.size])),
        hairSkinSupport: Object.fromEntries(Object.entries(hairSkinSupport).map(([family, bands]) => [family, bands.size])),
        skinTraitSupport: Object.fromEntries(Object.entries(skinTraitSupport).map(([band, traits]) => [
          band,
          Object.fromEntries(Object.entries(traits).map(([trait, values]) => [trait, values.size])),
        ])),
        hairEyeSupport: Object.fromEntries(Object.entries(hairEyeSupport).map(([family, values]) => [family, values.size])),
        hairFacialHairSupport: Object.fromEntries(Object.entries(hairFacialHairSupport).map(([family, values]) => [family, values.size])),
        hairLashSupport: Object.fromEntries(Object.entries(hairLashSupport).map(([family, values]) => [family, values.size])),
        facialHairLashSupport: Object.fromEntries(Object.entries(facialHairLashSupport).map(([category, values]) => [category, values.size])),
        bodyTraitSupport: Object.fromEntries(Object.entries(bodyTraitSupport).map(([family, traits]) => [
          family,
          Object.fromEntries(Object.entries(traits).map(([trait, values]) => [trait, values.size])),
        ])),
        traitCatalogSizes,
        facialHairSkinBandCount: facialHairSkinBands.size,
        prominentEyelashSkinBandCount: prominentEyelashSkinBands.size,
        bodyFamilySkinBandCounts: Object.fromEntries(Object.entries(bodyFamilySkinBands)
          .map(([family, bands]) => [family, bands.size])),
        bodyFamilyCounts,
        bodyVariety: bodyTypes.size,
        maleSamples,
        femaleSamples,
        incompatibleHairClipSamples,
        costumeAccessorySamples,
        manualOnlyAccessorySamples,
        religiousAccessorySamples,
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
        prominentEyelashSamples,
        legacyPresentationFieldSamples,
      };
    });

    expect(summary.invalidCount, summary.firstInvalid || 'random avatars should validate').toBe(0);
    expect([...summary.randomPolicyHairValues].sort()).toEqual([...summary.registeredHairValues].sort());
    expect(new Set(summary.randomPolicyHairValues).size).toBe(summary.randomPolicyHairValues.length);
    expect([...summary.randomPolicyBodyValues].sort()).toEqual([...summary.registeredBodyValues].sort());
    expect(new Set(summary.randomPolicyBodyValues).size).toBe(summary.randomPolicyBodyValues.length);
    expect([...summary.randomPolicyFacialHairValues].sort()).toEqual([...summary.registeredFacialHairValues].sort());
    expect([...summary.sampledHairStyles].sort()).toEqual([...summary.randomPolicyHairValues].sort());
    expect([...summary.sampledFacialHairStyles].sort()).toEqual([...summary.randomPolicyFacialHairValues].sort());
    expect(summary.missingManualOnlyExclusions).toEqual([]);
    expect(summary.coveredSkinBands).toBe(4);
    expect(Object.values(summary.skinHairSupport).every((familyCount) => familyCount >= 4)).toBe(true);
    expect(summary.hairSkinSupport).toEqual({
      short: 4,
      long: 4,
      textured: 4,
      'braids-locs-tied': 4,
      bald: 4,
    });
    for (const support of Object.values(summary.skinTraitSupport)) {
      expect(support.eyeShape).toBeGreaterThanOrEqual(Math.ceil(summary.traitCatalogSizes.eyeShape * 0.8));
      expect(support.eyeColor).toBeGreaterThanOrEqual(6);
      expect(support.noseShape).toBeGreaterThanOrEqual(Math.ceil(summary.traitCatalogSizes.noseShape * 0.8));
      expect(support.headStyle).toBeGreaterThanOrEqual(Math.ceil(summary.traitCatalogSizes.headStyle * 0.8));
      expect(support.hairColor).toBeGreaterThanOrEqual(12);
    }
    expect(summary.hairEyeSupport.short).toBeGreaterThanOrEqual(14);
    expect(summary.hairEyeSupport.long).toBeGreaterThanOrEqual(14);
    expect(summary.hairEyeSupport.textured).toBeGreaterThanOrEqual(14);
    expect(summary.hairEyeSupport['braids-locs-tied']).toBeGreaterThanOrEqual(14);
    expect(summary.hairEyeSupport.bald).toBeGreaterThanOrEqual(12);
    expect(Object.values(summary.hairFacialHairSupport).every((support) => support === 2)).toBe(true);
    expect(Object.values(summary.hairLashSupport).every((support) => support === 2)).toBe(true);
    expect(summary.facialHairLashSupport).toEqual({ facialHair: 2, none: 2 });
    for (const support of Object.values(summary.bodyTraitSupport)) {
      expect(support).toEqual({ facialHair: 2, lashes: 2 });
    }
    expect(summary.facialHairSkinBandCount).toBeGreaterThanOrEqual(3);
    expect(summary.prominentEyelashSkinBandCount).toBeGreaterThanOrEqual(3);
    expect(Object.values(summary.bodyFamilySkinBandCounts).every((bandCount) => bandCount === 4)).toBe(true);
    expect(Object.values(summary.bodyFamilyCounts).every((sampleCount) => sampleCount > 120)).toBe(true);
    expect(summary.maleSamples).toBe(0);
    expect(summary.femaleSamples).toBe(0);
    expect(summary.legacyPresentationFieldSamples).toBe(0);
    expect(summary.bodyVariety).toBe(summary.registeredBodyValues.length);
    expect(summary.incompatibleHairClipSamples).toBe(0);
    expect(summary.costumeAccessorySamples).toBe(0);
    expect(summary.manualOnlyAccessorySamples).toBe(0);
    expect(summary.religiousAccessorySamples).toBe(0);
    expect(summary.expressiveManualHairSamples).toBeGreaterThan(0);
    expect(summary.costumeOutfitSamples).toBe(0);
    // The neutral generator reserves a small lane for technical outfits while
    // keeping the overwhelming majority in everyday campus clothing.
    expect(summary.everydayCampusOutfitSamples + summary.technicalOutfitSamples).toBe(640);
    expect(summary.everydayCampusOutfitSamples).toBeGreaterThan(summary.technicalOutfitSamples * 10);
    expect(summary.accentHairColorSamples).toBeLessThan(64);
    expect(summary.hijabSamples).toBe(0);
    expect(summary.headwrapSamples).toBeGreaterThan(0);
    expect(summary.coveredHairSamples).toBeGreaterThan(0);
    expect(summary.bantuKnotsSamples).toBeGreaterThan(0);
    expect(summary.facialHairSamples).toBeGreaterThan(0);
    expect(summary.cleanShavenSamples).toBeGreaterThan(0);
    expect(summary.layeredAccessorySamples).toBeGreaterThan(0);
    expect(summary.currentCampusAccessorySamples).toBeGreaterThan(60);
    expect(summary.currentCampusAccessoryVariety).toBe(7);
    expect(summary.mouthVariety).toBeGreaterThanOrEqual(7);
    expect(summary.upbeatMouthSamples).toBeGreaterThan(summary.neutralMouthSamples * 5);
    expect(summary.prominentEyelashSamples).toBeGreaterThan(0);
  });

  test('Milestone power layer supports every tier without becoming a customization control', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.goto(GYM_URL);

    const entranceHero = page.locator('#gym-entrance .gym-entrance-visual-left [data-gym-hero-svg]');
    await entranceHero.scrollIntoViewIfNeeded();
    await expect(entranceHero).toBeVisible();

    const tiers = await entranceHero.evaluate((svg) => {
      const milestoneFixture = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(window.HeroAvatar.DEFAULTS)));
      milestoneFixture.body.type = 'average';
      window.HeroAvatar.applyToSvg(svg, milestoneFixture);
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
      for (const tier of ['bronze', 'silver', 'gold', 'diamond', 'infinity']) {
        window.HeroAvatar.applyMilestoneToSvg(svg, tier);
        result[tier] = {
          attr: svg.getAttribute('data-hero-milestone'),
          muscleStrength: svg.getAttribute('data-hero-muscle-strength'),
          visibleLayerCount: Array.from(svg.querySelectorAll(`[data-hero-slot="milestone-power"][data-hero-option="${tier}"]`))
            .filter((group) => group.getAttribute('display') === 'inline').length,
          visibleMuscleLayerCount: Array.from(svg.querySelectorAll(`[data-hero-slot="muscle-strength"][data-hero-option="${tier}"]`))
            .filter((group) => group.getAttribute('display') === 'inline').length,
          visibleOtherMuscleLayerCount: Array.from(svg.querySelectorAll('[data-hero-slot="muscle-strength"]'))
            .filter((group) => group.getAttribute('data-hero-option') !== tier && group.getAttribute('display') === 'inline').length,
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
        visibleNonNoneMuscleLayerCount: Array.from(svg.querySelectorAll('[data-hero-slot="muscle-strength"]'))
          .filter((group) => group.getAttribute('data-hero-option') !== 'none' && group.getAttribute('display') === 'inline').length,
      };
      window.HeroAvatar.applyMilestoneToSvg(svg, 'silver', 50);
      const activeLinearPath = svg.querySelector('[data-hero-slot="muscle-strength"][data-hero-option="silver"][data-hero-muscle-zone="left-upper"] path');
      const upperLinearPath = svg.querySelector('[data-hero-slot="muscle-strength"][data-hero-option="gold"][data-hero-muscle-zone="left-upper"] path');
      result.linear = {
        attr: svg.getAttribute('data-hero-milestone'),
        muscleStrength: svg.getAttribute('data-hero-muscle-strength'),
        lower: svg.getAttribute('data-hero-muscle-lower'),
        upper: svg.getAttribute('data-hero-muscle-upper'),
        blend: Number(svg.getAttribute('data-hero-muscle-blend')),
        visibleMuscleLayerCount: Array.from(svg.querySelectorAll('[data-hero-slot="muscle-strength"]'))
          .filter((group) => group.getAttribute('display') === 'inline').length,
        activeMuscleLayerCount: svg.querySelectorAll('[data-hero-slot="muscle-strength"][data-hero-muscle-active="true"][display="inline"]').length,
        silverCount: Array.from(svg.querySelectorAll('[data-hero-slot="muscle-strength"][data-hero-option="silver"]'))
          .filter((group) => group.getAttribute('display') === 'inline').length,
        goldCount: Array.from(svg.querySelectorAll('[data-hero-slot="muscle-strength"][data-hero-option="gold"]'))
          .filter((group) => group.getAttribute('display') === 'inline').length,
        activeSilhouetteD: activeLinearPath && activeLinearPath.getAttribute('d'),
        lowerTemplateD: activeLinearPath && activeLinearPath.getAttribute('data-hero-template-d'),
        upperTemplateD: upperLinearPath && upperLinearPath.getAttribute('data-hero-template-d'),
      };
      result.samples = {};
      for (const strength of [13, 25, 38, 50, 63, 75, 88, 100]) {
        window.HeroAvatar.applyMilestoneToSvg(svg, 'none', strength);
        const visibleMuscleGroups = Array.from(svg.querySelectorAll('[data-hero-slot="muscle-strength"]'))
          .filter((group) => group.getAttribute('display') === 'inline');
        result.samples[strength] = {
          visibleMuscleLayerCount: visibleMuscleGroups.length,
          activeMuscleLayerCount: visibleMuscleGroups.filter((group) => group.getAttribute('data-hero-muscle-active') === 'true').length,
          visibleZoneCount: new Set(visibleMuscleGroups.map((group) => group.getAttribute('data-hero-muscle-zone'))).size,
        };
      }
      if (visual) visual.style.pointerEvents = previousVisualPointerEvents;
      svg.style.pointerEvents = previousSvgPointerEvents;
      return result;
    });

    for (const tier of ['bronze', 'silver', 'gold', 'diamond', 'infinity']) {
      expect(tiers[tier].attr).toBe(tier);
      expect(tiers[tier].muscleStrength).toBe({ bronze: '20', silver: '40', gold: '60', diamond: '80', infinity: '100' }[tier]);
      expect(tiers[tier].visibleLayerCount).toBeGreaterThanOrEqual(2);
      expect(tiers[tier].visibleMuscleLayerCount).toBe(4);
      expect(tiers[tier].visibleOtherMuscleLayerCount).toBe(0);
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
    expect(tiers.none).toEqual({ attr: 'none', visibleNonNoneLayerCount: 0, visibleNonNoneMuscleLayerCount: 0 });
    expect(tiers.linear).toMatchObject({
      attr: 'silver',
      muscleStrength: '50',
      lower: 'silver',
      upper: 'gold',
      visibleMuscleLayerCount: 4,
      activeMuscleLayerCount: 4,
      silverCount: 4,
      goldCount: 0,
    });
    expect(tiers.linear.blend).toBeCloseTo(0.5, 2);
    expect(tiers.linear.activeSilhouetteD).not.toBe(tiers.linear.lowerTemplateD);
    expect(tiers.linear.activeSilhouetteD).not.toBe(tiers.linear.upperTemplateD);
    for (const strength of ['13', '25', '38', '50', '63', '75', '88', '100']) {
      expect(tiers.samples[strength], `strength ${strength} should render one muscle layer per zone`).toEqual({
        visibleMuscleLayerCount: 4,
        activeMuscleLayerCount: 4,
        visibleZoneCount: 4,
      });
    }

    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await expect(page.locator('#hero-customizer-modal [data-hero-choice="milestone"]')).toHaveCount(0);
    await expect(page.locator('#hero-customizer-modal #hero-cust-muscle-strength')).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Customize your hero' })).toBeVisible();
  });

  test('Exercise milestones automatically make page heroes look more powerful', async ({ page }) => {
    const diamondSeenCount = GYM_MILESTONE_THRESHOLDS.diamond;
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await setCookie(page.context(), 'analyze-performance', 'true');
    await page.evaluate(({ seen, correct }) => {
      PersonalGym.setAnalyzePerformance(true);
      PersonalGym.saveStats({ milestone: { seen, correct } });
    }, { seen: diamondSeenCount, correct: correctSeenCount(diamondSeenCount) });

    await page.reload();

    await expect(page.locator('#milestone-banner')).toContainText('Diamond milestone');
    await expect(page.locator('#milestone-banner')).toContainText(`${diamondSeenCount}+ exercises`);
    const heroes = page.locator('#gym-entrance [data-gym-hero-svg]');
    await expect(heroes.first()).toHaveAttribute('data-hero-milestone', 'diamond');
    await expect(heroes.nth(1)).toHaveAttribute('data-hero-milestone', 'diamond');
    await expect(heroes.first()).toHaveAttribute('data-hero-muscle-strength', '80');
    await expect(heroes.first().locator('[data-hero-slot="muscle-strength"][data-hero-option="diamond"]').first())
      .toHaveAttribute('display', 'inline');
  });

  test('Infinity milestone is the top tier and uses the max procedural muscle outline', async ({ page }) => {
    const infinitySeenCount = GYM_MILESTONE_THRESHOLDS.infinity;
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await setCookie(page.context(), 'analyze-performance', 'true');
    await page.evaluate(({ seen, correct }) => {
      PersonalGym.setAnalyzePerformance(true);
      PersonalGym.saveStats({ milestone: { seen, correct } });
    }, { seen: infinitySeenCount, correct: correctSeenCount(infinitySeenCount) });

    await page.reload();

    await expect(page.locator('#milestone-banner')).toContainText('Infinity milestone');
    await expect(page.locator('#milestone-banner')).toContainText(`${infinitySeenCount}+ exercises`);
    const hero = page.locator('#gym-entrance [data-gym-hero-svg]').first();
    await expect(hero).toHaveAttribute('data-hero-milestone', 'infinity');
    await expect(hero).toHaveAttribute('data-hero-muscle-strength', '100');
    await expect(hero.locator('[data-hero-slot="muscle-strength"][data-hero-option="infinity"]').first())
      .toHaveAttribute('display', 'inline');
    const muscle = await hero.evaluate((svg) => {
      const visibleMuscleGroups = Array.from(svg.querySelectorAll('[data-hero-slot="muscle-strength"]'))
        .filter((group) => group.getAttribute('display') === 'inline');
      return {
        visibleMuscleLayerCount: visibleMuscleGroups.length,
        activeMuscleLayerCount: visibleMuscleGroups.filter((group) => group.getAttribute('data-hero-muscle-active') === 'true').length,
        visibleOptions: Array.from(new Set(visibleMuscleGroups.map((group) => group.getAttribute('data-hero-option')))),
        visibleZoneCount: new Set(visibleMuscleGroups.map((group) => group.getAttribute('data-hero-muscle-zone'))).size,
      };
    });
    expect(muscle).toEqual({
      visibleMuscleLayerCount: 4,
      activeMuscleLayerCount: 4,
      visibleOptions: ['infinity'],
      visibleZoneCount: 4,
    });
    await expect(hero.locator('[data-hero-slot="milestone-power"][data-hero-option="infinity"]').first())
      .toHaveAttribute('display', 'inline');
  });

  test('Exercise progress linearly blends muscle strength between milestone tiers', async ({ page }) => {
    const silverSeenCount = GYM_MILESTONE_THRESHOLDS.silver;
    const goldSeenCount = GYM_MILESTONE_THRESHOLDS.gold;
    const midpointSeenCount = silverSeenCount + ((goldSeenCount - silverSeenCount) / 2);
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await setCookie(page.context(), 'analyze-performance', 'true');
    await page.evaluate(({ seen, correct }) => {
      PersonalGym.setAnalyzePerformance(true);
      PersonalGym.saveStats({ milestone: { seen, correct } });
    }, { seen: midpointSeenCount, correct: correctSeenCount(midpointSeenCount) });

    await page.reload();

    await expect(page.locator('#milestone-banner')).toContainText('Silver milestone');
    await expect(page.locator('#milestone-banner')).toContainText(`${silverSeenCount}+ exercises`);
    const hero = page.locator('#gym-entrance [data-gym-hero-svg]').first();
    await expect(hero).toHaveAttribute('data-hero-milestone', 'silver');
    await expect(hero).toHaveAttribute('data-hero-muscle-strength', '50');
    const muscle = await hero.evaluate((svg) => ({
      lower: svg.getAttribute('data-hero-muscle-lower'),
      upper: svg.getAttribute('data-hero-muscle-upper'),
      blend: Number(svg.getAttribute('data-hero-muscle-blend')),
      visibleMuscleLayerCount: Array.from(svg.querySelectorAll('[data-hero-slot="muscle-strength"]'))
        .filter((group) => group.getAttribute('display') === 'inline').length,
      activeMuscleLayerCount: svg.querySelectorAll('[data-hero-slot="muscle-strength"][data-hero-muscle-active="true"][display="inline"]').length,
      silverCount: Array.from(svg.querySelectorAll('[data-hero-slot="muscle-strength"][data-hero-option="silver"]'))
        .filter((group) => group.getAttribute('display') === 'inline').length,
      goldCount: Array.from(svg.querySelectorAll('[data-hero-slot="muscle-strength"][data-hero-option="gold"]'))
        .filter((group) => group.getAttribute('display') === 'inline').length,
    }));

    expect(muscle).toMatchObject({
      lower: 'silver',
      upper: 'gold',
      visibleMuscleLayerCount: 4,
      activeMuscleLayerCount: 4,
      silverCount: 4,
      goldCount: 0,
    });
    expect(muscle.blend).toBeCloseTo(0.5, 2);
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

  test('Representative hair families keep distinct face-safe foreground crowns', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await clearAccessories(page);

    const representativeStyles = ['short', 'straight-long-layers', 'coils', 'box-braids', 'locs-bun', 'mohawk'];
    const hairStyle = page.getByLabel('Hair style', { exact: true });
    const preview = page.getByRole('dialog', { name: 'Customize your hero' })
      .locator('[data-gym-hero-svg]');
    const crowns = [];

    for (const style of representativeStyles) {
      await hairStyle.selectOption(style);
      const activeHairline = preview.locator(
        `[data-hero-slot="hairline"][data-hero-option="${style}"]`
      );
      await expect(activeHairline).toHaveAttribute('display', 'inline');
      crowns.push(await measureForegroundCrown(activeHairline, style));
    }

    const invalidCrowns = crowns.filter(({ geometryCount, paintedPointCount, unsafePaintedPointCount }) =>
      geometryCount === 0
      || paintedPointCount === 0
      || unsafePaintedPointCount > 0
    );
    expect(invalidCrowns, 'foreground crowns should render nonempty geometry inside the face-safe crown region')
      .toEqual([]);

    const stylesByPaintMap = new Map();
    for (const crown of crowns) {
      const matchingStyles = stylesByPaintMap.get(crown.paintMap) || [];
      matchingStyles.push(crown.style);
      stylesByPaintMap.set(crown.paintMap, matchingStyles);
    }
    const collapsedCrowns = Array.from(stylesByPaintMap.values()).filter((styles) => styles.length > 1);
    expect(collapsedCrowns, 'representative hair families should retain visibly distinct crown silhouettes')
      .toEqual([]);
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
    await expect(eyelashes.locator('option')).toHaveCount(19);
    await eyelashes.selectOption('winged');

    const preview = page.locator('#hero-customizer-modal [data-gym-hero-svg]');
    await expect(preview.locator('[data-hero-slot="eyelash-style"][data-hero-option="winged"]'))
      .toHaveAttribute('display', 'inline');

    const failures = await preview.evaluate((svg) => {
      const baseState = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(window.HeroAvatar.DEFAULTS)));
      const styles = ['none', 'short-soft', 'short-dense', 'barely-there', 'subtle', 'short-natural', 'short-corner', 'short-upper', 'outer-corner', 'soft-fan', 'balanced-fan', 'delicate-long', 'soft-lift', 'full-upper', 'long-classic', 'long-doll', 'long-glam', 'winged', 'dense'];
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
        state.appearance.headStyle = 'soft-features';
        state.appearance.eyelashStyle = style;
        window.HeroAvatar.applyToSvg(svg, state);

        if (!visibleSlot('eyelash-style', style)) failures.push({ slot: 'eyelash-style', style, reason: 'selected style is not visible' });
        const group = svg.querySelector(`[data-hero-slot="eyelash-style"][data-hero-option="${style}"]`);
        const lashPaths = group ? Array.from(group.querySelectorAll('path[stroke*="--hero-eyebrow"]')) : [];
        if (style !== 'none' && lashPaths.length === 0) failures.push({ slot: 'eyelash-style', style, reason: 'style has no lash paths' });
        const lashSegmentCount = lashPaths.reduce((total, path) => total + quadraticLashSegments(path.getAttribute('d') || '').length, 0);
        if (style !== 'none' && (lashSegmentCount < 6 || lashSegmentCount > 16)) {
          failures.push({ slot: 'eyelash-style', style, reason: 'style should use a restrained cluster of three to eight tufts per eye', lashSegmentCount });
        }
        for (const path of lashPaths) {
          const d = path.getAttribute('d') || '';
          for (const segment of verticalLineSegments(d)) failures.push({ slot: 'eyelash-style', style, segment, d });
        }
      }

      const eyeFitChecks = [
        { eyeShape: 'round', family: 'round' },
        { eyeShape: 'gentle-round', family: 'round' },
        { eyeShape: 'wide', family: 'wide-round' },
        { eyeShape: 'bright-wide', family: 'wide-round' },
        { eyeShape: 'single-eyelid', family: 'compact' },
        { eyeShape: 'deep-set', family: 'deep-set' },
        { eyeShape: 'tapered-almond', family: 'angled-almond' },
        { eyeShape: 'relaxed-almond', family: 'angled-almond' },
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

      const openState = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(baseState)));
      openState.appearance.eyelashStyle = 'long-glam';
      window.HeroAvatar.applyToSvg(svg, openState);
      const openPath = svg.querySelector('[data-hero-slot="eyelash-style"][data-hero-option="long-glam"] [data-hero-lash-path]');
      const openSegments = quadraticLashSegments(openPath ? openPath.getAttribute('d') || '' : '');
      const openMaxLength = Math.max(...openSegments.map((segment) => Math.hypot(segment.ex - segment.sx, segment.ey - segment.sy)));
      const leftRoots = openSegments.filter((segment) => segment.sx < 400).map((segment) => segment.sx).sort((a, b) => a - b);
      const rootGaps = leftRoots.slice(1).map((root, index) => (root - leftRoots[index]).toFixed(2));
      if (new Set(rootGaps).size < 3) {
        failures.push({ slot: 'eyelash-style', reason: 'glam lashes should form authored, uneven clusters rather than an evenly spaced fan', rootGaps });
      }

      const framedState = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(openState)));
      framedState.outfit.accessory = 'glasses';
      framedState.outfit.accessories = ['glasses'];
      window.HeroAvatar.applyToSvg(svg, framedState);
      const framedPath = svg.querySelector('[data-hero-slot="eyelash-style"][data-hero-option="long-glam"] [data-hero-lash-path]');
      const framedSegments = quadraticLashSegments(framedPath ? framedPath.getAttribute('d') || '' : '');
      const framedMaxLength = Math.max(...framedSegments.map((segment) => Math.hypot(segment.ex - segment.sx, segment.ey - segment.sy)));
      if (!framedPath || framedPath.getAttribute('data-hero-lash-fit') !== 'under-frames' || framedMaxLength > openMaxLength * 0.75) {
        failures.push({ slot: 'eyelash-style', reason: 'eye frames should shorten prominent lashes enough to prevent rim collisions', openMaxLength, framedMaxLength });
      }

      for (const headStyle of ['soft-features', 'heart']) {
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
        const screenPoint = svgPoint.matrixTransform(group.getScreenCTM());
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
      // This is the high-risk composition from the reported regression: long
      // side panels plus eyewear and a full beard. The layer invariant must hold
      // for every hair option, not only for an unadorned default face.
      baseState.appearance.facialHair = 'full-beard';
      baseState.outfit.accessory = 'glasses';
      baseState.outfit.accessories = ['glasses'];

      return styles.map((style) => {
        const state = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(baseState)));
        state.appearance.hairStyle = style;
        window.HeroAvatar.applyToSvg(svg, state);

        const hair = svg.querySelector(`[data-hero-slot="hair"][data-hero-option="${style}"]`);
        const faceSurface = svg.querySelector('[data-hero-slot="face-clear"]');
        const facePaintsAfterHair = Boolean(
          hair &&
          faceSurface &&
          (hair.compareDocumentPosition(faceSurface) & Node.DOCUMENT_POSITION_FOLLOWING)
        );

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
          }).filter((hit) => ['hair', 'hair-cap', 'hairline', 'hair-root'].includes(hit.slot));
        })();

        return { style, facePaintsAfterHair, blockedFeatureHits };
      }).filter((result) => !result.facePaintsAfterHair || result.blockedFeatureHits.length > 0);
    });

    expect(
      blockedFeatureHitsByStyle,
      'No selectable hair style should place hair over eyes, cheeks, or mouth'
    ).toEqual([]);
  });

  test('Foreground hair shapes stay out of the eye area', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await clearAccessories(page);

    const eyeIntersectionFailures = await page.evaluate(() => {
      const svg = document.querySelector('#hero-customizer-modal [data-gym-hero-svg]');
      const styles = Array.from(document.querySelectorAll('#hero-cust-hair-style option'))
        .map((node) => node.value)
        .filter(Boolean);
      const headStyles = ['default', 'full-cheeks', 'broad', 'oblong', 'soft-full-cheek-jaw'];
      const eyeShapes = ['round', 'wide', 'almond'];
      const foregroundHairSlots = ['hair-cap', 'hairline', 'hair-root'];
      const eyePoints = [
        { name: 'left eye center', x: 381, y: 185 },
        { name: 'right eye center', x: 419, y: 185 },
        { name: 'left eye outer', x: 374, y: 185 },
        { name: 'right eye outer', x: 426, y: 185 },
        { name: 'left upper eye', x: 381, y: 180 },
        { name: 'right upper eye', x: 419, y: 180 },
      ];
      const baseState = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(window.HeroAvatar.DEFAULTS)));
      const failures = [];

      baseState.outfit.accessory = 'none';
      baseState.outfit.accessories = [];

      function stackedSlotsAt(point) {
        const svgPoint = svg.createSVGPoint();
        svgPoint.x = point.x;
        svgPoint.y = point.y;
        const screenPoint = svgPoint.matrixTransform(svg.getScreenCTM());
        return document.elementsFromPoint(screenPoint.x, screenPoint.y)
          .map((element) => {
            const slot = element.closest && element.closest('[data-hero-slot]');
            return slot && {
              slot: slot.getAttribute('data-hero-slot'),
              option: slot.getAttribute('data-hero-option'),
            };
          })
          .filter(Boolean);
      }

      for (const hairStyle of styles) {
        for (const headStyle of headStyles) {
          for (const eyeShape of eyeShapes) {
            const state = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(baseState)));
            state.appearance.hairStyle = hairStyle;
            state.appearance.headStyle = headStyle;
            state.appearance.eyeShape = eyeShape;
            window.HeroAvatar.applyToSvg(svg, state);

            for (const point of eyePoints) {
              const foregroundHairHits = stackedSlotsAt(point)
                .filter((hit) => foregroundHairSlots.includes(hit.slot));
              if (foregroundHairHits.length) {
                failures.push({
                  hairStyle,
                  headStyle,
                  eyeShape,
                  point: point.name,
                  foregroundHairHits,
                });
              }
            }
          }
        }
      }

      return failures;
    });

    expect(
      eyeIntersectionFailures,
      'Foreground hair geometry should leave the eyes clear instead of relying on eye layers to hide intersections'
    ).toEqual([]);
  });

  test('Every selectable hair style has complete visible behavior across face shapes, coverings, and opaque hats', async ({ page }) => {
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
      const coveringHeadwear = window.HeroAvatar.ACCESSORY_COMPATIBILITY.hairCoverings;
      const opaqueHats = window.HeroAvatar.ACCESSORY_COMPATIBILITY.opaqueHats;
      const hairlineVisibleCoverings = new Set(
        window.HeroAvatar.ACCESSORY_COMPATIBILITY.hairlineVisibleCoverings
      );
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
            if (['hair', 'hair-cap', 'hairline', 'hair-root'].includes(hit.slot)) {
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
          const shouldRevealHairline = hairStyle !== 'bald' && hairlineVisibleCoverings.has(headwear);
          if (visibleSlot('hair-cap', 'head-covering') !== shouldRevealHairline) {
            failures.push({ hairStyle, headwear, reason: 'covering uses the wrong hairline visibility policy' });
          }
          if (shouldRevealHairline && bboxArea('hair-cap', 'head-covering') < 24) {
            failures.push({ hairStyle, headwear, reason: 'visible covering hairline has no rendered geometry' });
          }
          for (const slot of ['hair', 'hairline', 'hair-root']) {
            if (hairStyle !== 'bald' && visibleSlot(slot, hairStyle)) {
              failures.push({ hairStyle, headwear, slot, reason: 'covered hair detail remains visible' });
            }
          }
        }

        for (const headwear of opaqueHats) {
          const coveredState = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(baseState)));
          coveredState.appearance.hairStyle = hairStyle;
          coveredState.outfit.accessory = headwear;
          coveredState.outfit.accessories = [headwear];
          window.HeroAvatar.applyToSvg(svg, coveredState);

          if (!visibleSlot('hair', hairStyle)) {
            failures.push({ hairStyle, headwear, reason: 'opaque hat should preserve the selected authored hair geometry' });
          }
          if (!visibleSlot('accessory', headwear)) {
            failures.push({ hairStyle, headwear, reason: 'opaque hat accessory is not visible' });
          }
          if (visibleSlot('hair-cap', 'head-covering')) {
            failures.push({ hairStyle, headwear, reason: 'opaque hat should not use the crown-shaped covering hair cap' });
          }
          const activeHair = svg.querySelector(`[data-hero-slot="hair"][data-hero-option="${hairStyle}"]`);
          const activeHairline = svg.querySelector(`[data-hero-slot="hairline"][data-hero-option="${hairStyle}"]`);
          const clip = svg.querySelector('[data-hero-under-hat-hair-clip]');
          const hairlineClip = svg.querySelector('[data-hero-under-hat-hairline-clip]');
          const activeClip = activeHair ? activeHair.style.getPropertyValue('clip-path') : '';
          const activeHairlineClip = activeHairline ? activeHairline.style.getPropertyValue('clip-path') : '';
          if (hairStyle !== 'bald' && (!clip || !activeClip.includes(clip.id))) {
            failures.push({ hairStyle, headwear, reason: 'opaque hat should clip only the hidden crown while preserving lower authored hair' });
          }
          if (hairStyle !== 'bald' && (!hairlineClip || !activeHairlineClip.includes(hairlineClip.id))) {
            failures.push({ hairStyle, headwear, reason: 'opaque hat should keep foreground hair inside the face-safe lower crown' });
          }
          for (const point of [
            { name: 'upper-left crown', x: 360, y: 112 },
            { name: 'upper crown', x: 400, y: 92 },
            { name: 'upper-right crown', x: 440, y: 112 },
            { name: 'hat crown edge', x: 400, y: 148 },
          ]) {
            const hit = hitSlot(point);
            if (['hair', 'hairline', 'hair-root'].includes(hit.slot)) {
              failures.push(Object.assign({ hairStyle, headwear, reason: 'authored crown geometry protrudes above an opaque hat' }, hit));
            }
          }
          for (const point of protectedFacePoints.slice(0, 4)) {
            const hit = hitSlot(point);
            if (hit.slot === 'accessory' && hit.option === headwear) {
              failures.push(Object.assign({ hairStyle, headwear, reason: 'opaque hat obscures an eye' }, hit));
            }
            if (['hair', 'hairline', 'hair-root'].includes(hit.slot)) {
              failures.push(Object.assign({ hairStyle, headwear, reason: 'opaque-hat hair obscures an eye' }, hit));
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
        const screenPoint = svgPoint.matrixTransform(group.getScreenCTM());
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
      const headStyles = ['default', 'round', 'oblong', 'soft-square', 'soft-features'];
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
        { name: 'top forehead hairline', x: 400, y: 158, slot: 'hairline' },
        { name: 'left temple hairline', x: 360, y: 168, slot: 'hair-root' },
        { name: 'right temple hairline', x: 440, y: 168, slot: 'hair-root' },
        { name: 'center knot', x: 400, y: 106, slot: 'hair' },
      ];

      function slotCoversPoint(point) {
        const group = svg.querySelector(
          `[data-hero-slot="${point.slot}"][data-hero-option="bantu-knots"]`
        );
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

      return points.map((point) => {
        if (slotCoversPoint(point)) {
          return { name: point.name, slot: point.slot, option: 'bantu-knots', covered: true };
        }
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
          covered: false,
        };
      });
    });

    expect(hairlineCoverage).toEqual([
      { name: 'top forehead hairline', slot: 'hairline', option: 'bantu-knots', covered: true },
      { name: 'left temple hairline', slot: 'hair-root', option: 'bantu-knots', covered: true },
      { name: 'right temple hairline', slot: 'hair-root', option: 'bantu-knots', covered: true },
      { name: 'center knot', slot: 'hair', option: 'bantu-knots', covered: true },
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
      'low-twist-bun',
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

        function slotCoversPoint(point, slotName) {
          const group = svg.querySelector(`[data-hero-slot="${slotName}"][data-hero-option="${style}"]`);
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

        const points = [
          { name: 'top forehead hairline', x: 400, y: 158 },
          { name: 'left temple root', x: 356, y: 178 },
          { name: 'right temple root', x: 444, y: 178 },
        ];
        const coverage = points.map((point) => {
          const expectedSlot = point.name === 'top forehead hairline' ? 'hairline' : 'hair-root';
          if (slotCoversPoint(point, expectedSlot)) {
            return { name: point.name, slot: expectedSlot, option: style, covered: true };
          }
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
            covered: false,
          };
        });
        const expected = [
          { point: 'top forehead hairline', slot: 'hairline' },
          { point: 'left temple root', slot: 'hair-root' },
          { point: 'right temple root', slot: 'hair-root' },
        ];
        for (const expectedHit of expected) {
          const hit = coverage.find((item) => item.name === expectedHit.point);
          if (!hit || !hit.covered || hit.slot !== expectedHit.slot || hit.option !== style) {
            failures.push({
              style,
              point: expectedHit.point,
              slot: hit && hit.slot,
              option: hit && hit.option,
              covered: hit && hit.covered,
            });
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
    await page.getByLabel('Earrings', { exact: true }).check();
    await page.getByLabel('Hijab', { exact: true }).check();

    const preview = page.locator('#hero-customizer-modal [data-gym-hero-svg]');
    await expect(preview.locator('[data-hero-slot="outfit-style"][data-hero-option="hoodie"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="accessory"][data-hero-option="hijab"]'))
      .toHaveAttribute('display', 'inline');
    await expect(page.locator('#hero-customizer-modal input[name="hero-cust-accessory"][value="earrings"]')).not.toBeChecked();
    await expect(preview.locator('[data-hero-slot="accessory"][data-hero-option="earrings"]'))
      .toHaveAttribute('display', 'none');
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

  test('Preset and custom human skin tones keep facial features and eyewear distinguishable', async ({ page }) => {
    await page.goto(GYM_URL);

    const audit = await page.evaluate(() => {
      const hairs = Array.from(new Set(window.HeroAvatar.PALETTES.hair));
      const skins = new Set(window.HeroAvatar.PALETTES.skin);
      for (const h of [5, 15, 25, 35, 45, 55]) {
        for (const s of [15, 35, 55, 75]) {
          for (const l of [18, 32, 46, 60, 74, 86]) {
            skins.add(window.HeroAvatar.hslToHex({ h, s, l }));
          }
        }
      }
      const requiredTokens = [
        'faceLine',
        'faceMark',
        'eyebrow',
        'glassesFrame',
        'glassesFrameDark',
        'glassesMetal',
        'mouthLine',
        'jawLine',
      ];
      const failures = [];
      for (const skin of skins) {
        for (const hair of hairs) {
          const tokens = window.HeroAvatar.avatarContrastTokens(skin, hair);
          for (const token of requiredTokens) {
            const ratio = window.HeroAvatar.contrastRatio(tokens[token], skin);
            if (ratio < 3) failures.push({ skin, hair, token, ratio });
          }
        }
      }
      return { skinCount: skins.size, pairCount: skins.size * hairs.length, failures };
    });

    expect(audit.skinCount).toBeGreaterThan(140);
    expect(audit.pairCount).toBeGreaterThan(2000);
    expect(audit.failures).toEqual([]);
  });

  test('Dark skin and dark hair combinations keep feature separation without harsh face lines', async ({ page }) => {
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
      function renderedPaint(element, property, tokenName) {
        if (!element) return '';
        const value = getComputedStyle(element)[property].trim();
        if (value) return value;
        return styles.getPropertyValue(tokenName).trim();
      }
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
        skinScatter: styles.getPropertyValue('--hero-skin-scatter').trim(),
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
        cheekFill: renderedPaint(cheek, 'fill', '--hero-cheek'),
        cheekOpacity: cheek ? getComputedStyle(cheek).opacity.trim() : '',
        lipFill: renderedPaint(lipFill, 'fill', '--hero-lip-fill'),
        lipHighlight: renderedPaint(lipHighlight, 'stroke', '--hero-lip-highlight'),
        glassesFrame: styles.getPropertyValue('--hero-glasses-frame').trim(),
        glassesFrameDark: styles.getPropertyValue('--hero-glasses-frame-dark').trim(),
        noseFill: renderedPaint(nose, 'fill', '--hero-face-line'),
        noseOpacity: nose ? getComputedStyle(nose).opacity.trim() : '',
        noseHighlightOpacity: styles.getPropertyValue('--hero-nose-highlight-opacity').trim(),
        contourOpacity: styles.getPropertyValue('--hero-contour-opacity').trim(),
        hairDetailOpacity: styles.getPropertyValue('--hero-hair-detail-opacity').trim(),
        faceCoreHighlightOpacity: styles.getPropertyValue('--hero-face-core-highlight-opacity').trim(),
        faceFormShadowOpacity: styles.getPropertyValue('--hero-face-form-shadow-opacity').trim(),
        jawLineOpacity: styles.getPropertyValue('--hero-jaw-line-opacity').trim(),
        neckShadowOpacity: styles.getPropertyValue('--hero-neck-shadow-opacity').trim(),
        smileLineStroke: renderedPaint(smileLine, 'stroke', '--hero-mouth-line'),
        roundGlassesStroke: renderedPaint(roundFrame, 'stroke', '--hero-glasses-frame'),
        gradientStop: gradientStop ? gradientStop.getAttribute('stop-color') : '',
        polishAfterFaceClear: Boolean(
          faceClear &&
          facePolish &&
          (faceClear.compareDocumentPosition(facePolish) & Node.DOCUMENT_POSITION_FOLLOWING)
        ),
        facePolishPathCount: facePolish ? facePolish.querySelectorAll('path').length : -1,
        facePolishEllipseCount: facePolish ? facePolish.querySelectorAll('ellipse').length : -1,
        featuresAfterPolish: Boolean(
          facePolish &&
          eyebrow &&
          (facePolish.compareDocumentPosition(eyebrow) & Node.DOCUMENT_POSITION_FOLLOWING)
        ),
      };
    });

    expect(tokens.polishAfterFaceClear).toBe(true);
    expect(tokens.facePolishPathCount).toBe(2);
    expect(tokens.facePolishEllipseCount).toBe(2);
    expect(tokens.featuresAfterPolish).toBe(true);
    expect(tokens.skinHighlightSoft.toLowerCase()).not.toBe(tokens.skin.toLowerCase());
    expect(tokens.skinMid.toLowerCase()).not.toBe(tokens.skin.toLowerCase());
    expect(contrastRatio(tokens.glassesFrame, tokens.skin)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(tokens.glassesFrameDark, tokens.skin)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(tokens.roundGlassesStroke, tokens.skin)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(tokens.hairRim, tokens.skin)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(tokens.faceLine, tokens.skin)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(tokens.faceMark, tokens.skin)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(tokens.facePlaneShadow, tokens.skin)).toBeLessThanOrEqual(1.8);
    expect(contrastRatio(tokens.skinScatter, tokens.skin)).toBeLessThanOrEqual(1.75);
    expect(contrastRatio(tokens.cheekFill, tokens.skin)).toBeLessThanOrEqual(1.8);
    expect(contrastRatio(tokens.lipFill, tokens.skin)).toBeLessThanOrEqual(2.1);
    expect(contrastRatio(tokens.lipHighlight, tokens.lipFill)).toBeLessThanOrEqual(1.6);
    expect(contrastRatio(tokens.mouthLine, tokens.skin)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(tokens.smileLineStroke, tokens.skin)).toBeGreaterThanOrEqual(3);
    // The nose plane is form shading, not an ink outline. It should remain
    // visible on deep skin without becoming a harsh vertical stripe; nostrils
    // and other semantic marks are covered by the higher-contrast faceMark token.
    expect(contrastRatio(tokens.noseFill, tokens.skin)).toBeGreaterThanOrEqual(1.4);
    expect(contrastRatio(tokens.noseFill, tokens.skin)).toBeLessThanOrEqual(2.2);
    expect(contrastRatio(tokens.eyebrow, tokens.skin)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(tokens.jawLine, tokens.skin)).toBeGreaterThanOrEqual(3);
    expect(Number(tokens.noseOpacity)).toBeGreaterThanOrEqual(0.45);
    expect(Number(tokens.noseOpacity)).toBeLessThanOrEqual(0.6);
    expect(Number(tokens.noseHighlightOpacity)).toBeGreaterThanOrEqual(0.28);
    expect(Number(tokens.noseHighlightOpacity)).toBeLessThanOrEqual(0.36);
    expect(Number(tokens.cheekOpacity)).toBeLessThanOrEqual(0.22);
    expect(Number(tokens.contourOpacity)).toBeLessThanOrEqual(0.4);
    expect(Number(tokens.hairDetailOpacity)).toBeGreaterThanOrEqual(0.35);
    expect(Number(tokens.hairDetailOpacity)).toBeLessThanOrEqual(0.55);
    expect(Number(tokens.faceCoreHighlightOpacity)).toBeGreaterThanOrEqual(0.25);
    expect(Number(tokens.faceCoreHighlightOpacity)).toBeLessThanOrEqual(0.35);
    expect(Number(tokens.faceFormShadowOpacity)).toBeLessThanOrEqual(0.35);
    expect(Number(tokens.jawLineOpacity)).toBeLessThanOrEqual(0.3);
    expect(Number(tokens.neckShadowOpacity)).toBeGreaterThanOrEqual(0.35);
    expect(Number(tokens.neckShadowOpacity)).toBeLessThanOrEqual(0.48);
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
    await expect(preview.locator('[data-hero-slot="hair-cap"][data-hero-option="head-covering"]'))
      .toHaveAttribute('display', 'inline');

    await clearAccessories(page);
    await setCheckboxInput(page, '#hero-customizer-modal input[name="hero-cust-accessory"][value="hijab"]', true);
    await expect(preview.locator('[data-hero-slot="accessory"][data-hero-option="hijab"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="hair-cap"][data-hero-option="head-covering"]'))
      .toHaveAttribute('display', 'none');

    await clearAccessories(page);
    await setSelectInput(page, '#hero-cust-facial-hair', 'full-beard');
    await setCheckboxInput(page, '#hero-customizer-modal input[name="hero-cust-accessory"][value="headwrap"]', true);
    await setCheckboxInput(page, '#hero-customizer-modal input[name="hero-cust-accessory"][value="forehead-jewel"]', true);
    await expect(preview.locator('[data-hero-slot="facial-hair"][data-hero-option="full-beard"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="accessory"][data-hero-option="headwrap"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="accessory"][data-hero-option="forehead-jewel"]'))
      .toHaveAttribute('display', 'inline');

    await clearAccessories(page);
    await setSelectInput(page, '#hero-cust-outfit-style', 'lab-coat');
    const labCoatArms = await preview.evaluate((svg) => ({
      armColor: getComputedStyle(svg).getPropertyValue('--hero-arm').trim().toLowerCase(),
      activeArmFills: Array.from(svg.querySelectorAll('[data-hero-slot="muscle-strength"][display="inline"]'))
        .map((group) => group.querySelector('path')?.getAttribute('fill') || ''),
    }));
    expect(labCoatArms.armColor).toBe('#eef3f7');
    expect(labCoatArms.activeArmFills).toHaveLength(4);
    expect(labCoatArms.activeArmFills.every((fill) => fill.includes('arm-suit-'))).toBe(true);

    const selectedSuitColor = (await page.locator('#hero-cust-suit').inputValue()).toLowerCase();
    await setSelectInput(page, '#hero-cust-outfit-style', 'hoodie');
    const hoodieArms = await preview.evaluate((svg) => ({
      armColor: getComputedStyle(svg).getPropertyValue('--hero-arm').trim().toLowerCase(),
      activeArmFills: Array.from(svg.querySelectorAll('[data-hero-slot="muscle-strength"][display="inline"]'))
        .map((group) => group.querySelector('path')?.getAttribute('fill') || ''),
    }));
    expect(hoodieArms.armColor).toBe(selectedSuitColor);
    expect(hoodieArms.activeArmFills).toHaveLength(4);
    expect(hoodieArms.activeArmFills.every((fill) => fill.includes('arm-suit-'))).toBe(true);

    await setSelectInput(page, '#hero-cust-outfit-style', 'cardigan');
    await expect(preview.locator('[data-hero-slot="outfit-style"][data-hero-option="cardigan"]'))
      .toHaveAttribute('display', 'inline');

    for (const outfit of ['captain-jacket', 'utility-vest', 'soft-tee', 'track-jacket', 'scholar-vest']) {
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
      'stud-earrings',
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
      'collar-pin',
      'study-badge',
      'utility-belt',
      'embroidered-prayer-cap',
      'wrapped-dastar',
      'hero-cape-clasp',
      'bandana',
    ]);

    expect(accessoryFailures).toEqual([]);
  });

  test('Expanded hair styles update the preview', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await clearAccessories(page);

    const styles = [
      'short',
      'soft-crop',
      'textured-crop',
      'wispy-crop',
      'clean-taper',
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
      'rounded-curls',
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
      'low-twist-bun',
      'claw-clip-updo',
    ];
    const hairlineStyles = new Set(['short', 'soft-crop', 'textured-crop', 'wispy-crop', 'clean-taper', 'casual-messy-crop', 'textured-fringe', 'straight-fringe', 'neat-straight-fringe', 'soft-rounded-fringe', 'side-parted-short', 'neat-side-swept-fringe', 'thick-side-swept', 'ivy-league', 'soft-two-block', 'middle-part-flow', 'slick-back', 'fade', 'crew-cut', 'buzz', 'pixie', 'mohawk', 'undercut', 'pompadour', 'bowl-cut', 'straight-long-layers', 'wavy-lob', 'side-part-lob', 'wolf-cut', 'sleek-bob-bangs', 'soft-bangs', 'low-pony-bangs', 'butterfly-layers', 'curly-bob', 'rounded-curls', 'curly-layers', 'coils', 'two-strand-twists', 'twist-out', 'coily-puff', 'double-puffs', 'bantu-knots', 'french-braid', 'braided-pony', 'knotless-braids', 'low-bun', 'low-twist-bun', 'space-buns', 'claw-clip-updo']);

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

  test('Vector emblem shortcut icons are named and meet non-text contrast', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();

    const shortcutButtons = page.locator('.hero-cust-quickbtn[data-emblem-quickpick]');
    await expect(shortcutButtons).toHaveCount(8);
    const results = await shortcutButtons.evaluateAll((nodes) => {
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
        return {
          name: node.getAttribute('aria-label') || '',
          hasVector: Boolean(node.querySelector('svg path, svg circle, svg ellipse')),
          hasTextGlyph: Array.from(node.childNodes).some((child) => child.nodeType === Node.TEXT_NODE && child.textContent.trim()),
          contrast: ratio(parseRgb(style.color), parseRgb(style.backgroundColor)),
        };
      });
    });

    expect(results.every((result) => result.name && result.hasVector && !result.hasTextGlyph)).toBe(true);
    expect(Math.min(...results.map((result) => result.contrast))).toBeGreaterThanOrEqual(3);
  });

  test('Expanded head shapes update the preview', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();

    const preview = page.locator('#hero-customizer-modal [data-gym-hero-svg]');
    const headShape = page.getByLabel('Head shape', { exact: true });
    const shapes = ['diamond', 'full-oval', 'soft-full-cheek-jaw', 'compact-round', 'long-soft-oval', 'wide-soft-jaw', 'tapered-oval', 'gentle-taper', 'soft-round-jaw', 'soft-angular'];

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

  test('Ear shape choices update the preview and saved avatar', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();

    const preview = page.locator('#hero-customizer-modal [data-gym-hero-svg]');
    const earShape = page.getByLabel('Ears', { exact: true });
    await expect(earShape.locator('option')).toHaveCount(12);

    for (const shape of ['small-round', 'petite-lobe', 'photo-rounded-lobe', 'rounded-attached', 'free-lobe', 'prominent', 'soft-angled', 'long-soft']) {
      await earShape.selectOption(shape);
      await expect(preview.locator(`[data-hero-slot="ear-shape"][data-hero-option="${shape}"]`))
        .toHaveAttribute('display', 'inline');
      await expect(earShape).toHaveValue(shape);
    }
    await expect(preview.locator('[data-hero-slot="ear-shape"][data-hero-option="oval"]'))
      .toHaveAttribute('display', 'none');

    await earShape.selectOption('photo-rounded-lobe');
    await heroCustomizerAction(page, 'Save').click();

    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('se-gym-hero-avatar')));
    expect(saved.appearance.earShape).toBe('photo-rounded-lobe');
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

      for (const value of ['stubble', 'soft-beard-shadow', 'soft-mustache', 'neat-mustache', 'fine-mustache-stubble', 'mustache', 'soul-patch', 'goatee', 'rounded-goatee', 'sideburns', 'chin-strap', 'short-beard', 'trimmed-beard', 'full-beard']) {
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

      for (const value of ['freckles', 'nose-freckles', 'cheek-freckles', 'forehead-freckles', 'beauty-mark', 'small-moles', 'dimples', 'soft-dimples', 'chin-dimple', 'smile-lines', 'under-eye-lines']) {
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

      for (const value of ['gentle-round', 'almond', 'soft-almond', 'relaxed-almond', 'tapered-almond', 'upturned-almond', 'downturned-soft', 'single-eyelid', 'soft-single-eyelid', 'wide-single-eyelid', 'hooded', 'deep-set', 'smiling', 'wide', 'bright-wide']) {
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

      for (const value of ['rounded', 'broad', 'medium-broad-soft-tip', 'narrow', 'button', 'defined-bridge', 'rounded-tip', 'short-soft-tip', 'wide-rounded-tip', 'balanced-bridge', 'soft-wide-tip', 'soft-upturned', 'gentle-bridge', 'soft-low-bridge', 'low-wide-bridge', 'soft-flat-bridge', 'aquiline-bridge']) {
        const state = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(baseState)));
        state.appearance.noseShape = value;
        window.HeroAvatar.applyToSvg(svg, state);
        if (!visibleSlot('nose-shape', value)) failures.push({ slot: 'nose-shape', value });
      }

      for (const value of ['soft-smile', 'small-smile', 'grin', 'neutral', 'full-lips', 'soft-full-lips', 'bright-smile', 'wide-smile', 'photo-smile', 'warm-smile', 'soft-open-grin', 'cheerful-grin', 'open-smile', 'excited-smile']) {
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

  test('Selecting a curated emblem renders only its authored SVG symbol', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await page.getByLabel('Vector emblem', { exact: true }).selectOption('🚀');
    const preview = page.locator('#hero-customizer-modal .hero-cust-preview [data-gym-hero-svg]');
    const emblemArt = preview.locator('[data-hero-emblem-art]');
    await expect(emblemArt).toHaveAttribute('data-hero-emblem-value', '🚀');
    await expect(emblemArt.locator('[data-hero-emblem-vector="🚀"]')).toHaveAttribute('display', 'inline');
    await expect(emblemArt.locator('[data-hero-emblem-vector]:not([data-hero-emblem-vector="🚀"])')).toHaveCount(7);
    await expect(emblemArt.locator('text, image, foreignObject')).toHaveCount(0);
    const emblemGroup = preview.locator('[data-hero-slot="emblem"]');
    await expect(emblemGroup).toHaveAttribute('display', 'inline');

    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    await expect(emblemArt).toHaveAttribute('data-hero-emblem-value', '');
    await expect(emblemArt.locator('[data-hero-emblem-vector][display="inline"]')).toHaveCount(0);
    await expect(emblemGroup).toHaveAttribute('display', 'none');
  });

  test('Emblem validation accepts only the vector-backed registry', async ({ page }) => {
    await page.goto(GYM_URL);
    const validity = await page.evaluate(() => ({
      empty: window.HeroAvatar.isValidEmblem(''),
      rocket: window.HeroAvatar.isValidEmblem('🚀'),
      star: window.HeroAvatar.isValidEmblem('🌟'),
      arbitraryEmoji: window.HeroAvatar.isValidEmblem('😀'),
      text: window.HeroAvatar.isValidEmblem('hello'),
    }));
    expect(validity).toEqual({ empty: true, rocket: true, star: true, arbitraryEmoji: false, text: false });
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
    await page.getByLabel('Body frame', { exact: true }).selectOption('broad');
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

  test('Fine tuning moves and scales individual avatar elements without randomizing them', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();

    await a11yCheckpoint(page, 'hero avatar fine tuning controls', { feature: A11Y_FEATURE, darkMode: true });

    const eyesVerticalSlider = page.getByRole('slider', { name: 'Eyes Up/down adjustment', exact: true });
    await expect(eyesVerticalSlider).toBeVisible();
    await expect(eyesVerticalSlider).toHaveAttribute('min', '-20');
    await expect(eyesVerticalSlider).toHaveAttribute('max', '20');

    const overflowingFineTuneButtons = await page.locator('#hero-customizer-modal .hero-cust-tune-button, #hero-customizer-modal .hero-cust-tune-reset')
      .evaluateAll((buttons) => buttons
        .filter((button) => button.offsetParent !== null && button.scrollWidth > button.clientWidth + 1)
        .map((button) => button.textContent.trim()));
    expect(overflowingFineTuneButtons, 'fine-tune button labels should fit inside their buttons').toEqual([]);

    await page.getByRole('button', { name: 'Move eyes up', exact: true }).click();
    await page.getByRole('button', { name: 'Move eyes outward', exact: true }).click();
    await page.getByRole('button', { name: 'Make eyes width more', exact: true }).click();
    await page.getByRole('button', { name: 'Make eyes height less', exact: true }).click();

    await expect(eyesVerticalSlider).toHaveValue('-1');
    await expect(fineTuneOutput(page, 'eyes', 'vertical')).toHaveText('-1');
    await expect(fineTuneOutput(page, 'eyes', 'spread')).toHaveText('+1');
    await expect(fineTuneOutput(page, 'eyes', 'width')).toHaveText('+1');
    await expect(fineTuneOutput(page, 'eyes', 'height')).toHaveText('-1');

    await setSelectInput(page, '#hero-cust-body-type', 'athletic');
    await page.getByRole('button', { name: 'Make body width more', exact: true }).click();
    const previewSvg = page.locator('#hero-customizer-modal [data-gym-hero-svg]');
    const bodySurface = previewSvg.locator('[data-hero-body-fit-target="surface"]');
    const articulatedArms = previewSvg.locator('[data-hero-body-fit-target="arms"]');
    const activeSilhouette = previewSvg.locator('[data-hero-slot="silhouette"][display="inline"]').first();
    await expect(bodySurface).toHaveAttribute('data-hero-fine-tune', 'body');
    await expect(bodySurface).toHaveAttribute('transform', /matrix/);
    await expect(articulatedArms).not.toHaveAttribute('data-hero-fine-tune', 'body');
    await expect(activeSilhouette).not.toHaveAttribute('data-hero-fine-tune', 'body');
    await expect(activeSilhouette).not.toHaveAttribute('transform', /matrix/);

    await heroCustomizerAction(page, 'Randomize').click();
    await expect(fineTuneOutput(page, 'eyes', 'vertical')).toHaveText('-1');
    await expect(fineTuneOutput(page, 'eyes', 'spread')).toHaveText('+1');
    await expect(fineTuneOutput(page, 'eyes', 'width')).toHaveText('+1');
    await expect(fineTuneOutput(page, 'eyes', 'height')).toHaveText('-1');

    await heroCustomizerAction(page, 'Save').click();
    await expect(page.getByRole('dialog', { name: 'Customize your hero' })).toBeHidden();

    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('se-gym-hero-avatar')));
    expect(saved.fineTune.eyes).toEqual({
      vertical: -1,
      spread: 1,
      width: 1,
      height: -1,
    });

    const pageSvg = page.locator('#gym-entrance [data-gym-hero-svg]').first();
    const eyeSlot = pageSvg.locator('[data-hero-slot="eye-shape"]').first();
    await expect(eyeSlot).toHaveAttribute('data-hero-fine-tune', 'eyes');
    await expect(eyeSlot).toHaveAttribute('transform', /matrix/);
    const catchlights = pageSvg.locator('[data-hero-eye-catchlights]');
    const closedEyelids = pageSvg.locator('[data-hero-motion="closed-eyelids"]');
    await expect(catchlights).toHaveAttribute('data-hero-fine-tune', 'eyes');
    await expect(catchlights).toHaveAttribute('transform', /matrix/);
    await expect(closedEyelids).toHaveAttribute('data-hero-fine-tune', 'eyes');
    await expect(closedEyelids).toHaveAttribute('transform', /matrix/);
  });

  test('Undo and redo controls stay visible and restore hero edits', async ({ page }) => {
    await useDefaultSavedHero(page);
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();

    const undo = page.getByRole('button', { name: 'Undo', exact: true });
    const redo = page.getByRole('button', { name: 'Redo', exact: true });
    await expect(undo).toBeVisible();
    await expect(redo).toBeVisible();
    await expect(undo).toBeDisabled();
    await expect(redo).toBeDisabled();
    await expect(undo).toHaveAttribute('aria-keyshortcuts', /Control\+Z/);
    await expect(redo).toHaveAttribute('aria-keyshortcuts', /Control\+Y/);

    const hairStyle = page.getByLabel('Hair style', { exact: true });
    await setSelectInput(page, '#hero-cust-hair-style', 'afro');
    await expect(hairStyle).toHaveValue('afro');
    await expect(undo).toBeEnabled();
    await expect(redo).toBeDisabled();

    await page.keyboard.press('Control+Z');
    await expect(hairStyle).toHaveValue('short');
    await expect(redo).toBeEnabled();

    await page.keyboard.press('Control+Y');
    await expect(hairStyle).toHaveValue('afro');

    const suitColor = page.getByLabel('Suit color', { exact: true });
    const suitHue = page.locator('#hero-cust-suit-hue');
    await expect(suitColor).toHaveValue('#1f6ebd');
    await suitHue.evaluate((input) => {
      input.value = '20';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const firstSuitColor = await suitColor.inputValue();
    await suitHue.evaluate((input) => {
      input.value = '80';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const secondSuitColor = await suitColor.inputValue();
    await suitHue.evaluate((input) => {
      input.value = '140';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await undo.click();
    await expect(suitColor).toHaveValue(secondSuitColor);
    await undo.click();
    await expect(suitColor).toHaveValue(firstSuitColor);
    await undo.click();
    await expect(suitColor).toHaveValue('#1f6ebd');

    await page.getByRole('button', { name: 'Move eyes up', exact: true }).click();
    await expect(fineTuneOutput(page, 'eyes', 'vertical')).toHaveText('-1');
    await undo.click();
    await expect(fineTuneOutput(page, 'eyes', 'vertical')).toHaveText('0');
    await redo.click();
    await expect(fineTuneOutput(page, 'eyes', 'vertical')).toHaveText('-1');

    const modalBox = page.locator('#hero-customizer-modal .hero-cust-box');
    await modalBox.evaluate((box) => {
      box.scrollTop = box.scrollHeight;
      box.dispatchEvent(new Event('scroll', { bubbles: true }));
    });
    await expect(undo).toBeInViewport();
    await expect(redo).toBeInViewport();
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

  test('Body frame choices render distinct silhouettes in the hero preview', async ({ page }) => {
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

      function pointInSvg(group, x, y) {
        const point = svg.createSVGPoint();
        point.x = x;
        point.y = y;
        const svgMatrix = svg.getCTM();
        const groupMatrix = group?.getCTM();
        if (!svgMatrix || !groupMatrix) return null;
        return point.matrixTransform(svgMatrix.inverse().multiply(groupMatrix));
      }

      function distance(left, right) {
        if (!left || !right) return Number.POSITIVE_INFINITY;
        return Math.hypot(left.x - right.x, left.y - right.y);
      }

      function unionBounds(left, right) {
        if (!left) return right;
        if (!right) return left;
        return {
          left: Math.min(left.left, right.left),
          top: Math.min(left.top, right.top),
          right: Math.max(left.right, right.right),
          bottom: Math.max(left.bottom, right.bottom),
        };
      }

      function transformedBounds(node) {
        const box = node.getBBox();
        const svgMatrix = svg.getCTM();
        const nodeMatrix = node.getCTM();
        if (!svgMatrix || !nodeMatrix) return null;
        const matrix = svgMatrix.inverse().multiply(nodeMatrix);
        const corners = [
          [box.x, box.y],
          [box.x + box.width, box.y],
          [box.x, box.y + box.height],
          [box.x + box.width, box.y + box.height],
        ].map(([x, y]) => {
          const point = svg.createSVGPoint();
          point.x = x;
          point.y = y;
          return point.matrixTransform(matrix);
        });
        return {
          left: Math.min(...corners.map((point) => point.x)),
          top: Math.min(...corners.map((point) => point.y)),
          right: Math.max(...corners.map((point) => point.x)),
          bottom: Math.max(...corners.map((point) => point.y)),
        };
      }

      function handBounds(side) {
        const handLayers = Array.from(svg.querySelectorAll(
          '[data-hero-motion="barbell-lift"] > [data-hero-kind-layer="human"]'
        ));
        const hands = handLayers[handLayers.length - 1];
        return Array.from(hands.querySelectorAll('path, ellipse')).reduce((bounds, node) => {
          const box = node.getBBox();
          const centerX = box.x + box.width / 2;
          if ((side === 'left' && centerX >= 400) || (side === 'right' && centerX <= 400)) return bounds;
          return unionBounds(bounds, transformedBounds(node));
        }, null);
      }

      function pointInside(bounds, point, padding = 2) {
        return Boolean(bounds && point
          && point.x >= bounds.left - padding
          && point.x <= bounds.right + padding
          && point.y >= bounds.top - padding
          && point.y <= bounds.bottom + padding);
      }

      const profiles = values.map((value) => {
        const state = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(baseState)));
        state.body.type = value;
        window.HeroAvatar.applyToSvg(svg, state);
        svg.pauseAnimations();
        svg.setCurrentTime(0);
        const group = visibleBodyGroup();
        const bbox = group.getBBox();
        const paths = bodyPaths(group);
        const activeLeftUpper = svg.querySelector(
          '[data-hero-slot="muscle-strength"][data-hero-muscle-zone="left-upper"][display="inline"] path'
        );
        const lowerBody = svg.querySelector('[data-hero-body-fit-target="lower-body"]');
        const leftForearm = svg.querySelector('[data-arm-side="left-forearm"]');
        const rightForearm = svg.querySelector('[data-arm-side="right-forearm"]');
        const barHands = svg.querySelector('[data-hero-motion="barbell-lift"] > [data-hero-kind-layer="human"]');
        const leftWrist = pointInSvg(leftForearm, 322, 68);
        const rightWrist = pointInSvg(rightForearm, 478, 68);
        const leftGrip = pointInSvg(barHands, 316, 83);
        const rightGrip = pointInSvg(barHands, 484, 83);
        const gripContained = pointInside(handBounds('left'), leftWrist)
          && pointInside(handBounds('right'), rightWrist);
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
          muscleStrength: Number(svg.getAttribute('data-hero-muscle-strength')),
          armVolume: Number(svg.getAttribute('data-hero-arm-volume')),
          renderedArmWidth: Number(activeLeftUpper.getBoundingClientRect().width.toFixed(2)),
          renderedLowerBodyHeight: Number(lowerBody.getBoundingClientRect().height.toFixed(2)),
          gripDistance: Number(Math.max(distance(leftWrist, leftGrip), distance(rightWrist, rightGrip)).toFixed(2)),
          gripContained,
          armFitTransform: svg.querySelector('[data-hero-body-fit-target="arms"]')?.getAttribute('transform') || '',
          lowerBodyFitTransform: svg.querySelector('[data-hero-body-fit-target="lower-body"]')?.getAttribute('transform') || '',
        };
      });

      const gripFailures = [];
      for (const bodyType of ['petite', 'average', 'broad', 'plus-size']) {
        const state = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(baseState)));
        state.body.type = bodyType;
        window.HeroAvatar.applyToSvg(svg, state);
        svg.pauseAnimations();
        for (const strength of [0, 20, 40, 60, 80, 100]) {
          window.HeroAvatar.applyMilestoneToSvg(svg, 'none', strength);
          for (const time of [0, 1.21]) {
            svg.setCurrentTime(time);
            const leftWrist = pointInSvg(svg.querySelector('[data-arm-side="left-forearm"]'), 322, 68);
            const rightWrist = pointInSvg(svg.querySelector('[data-arm-side="right-forearm"]'), 478, 68);
            const leftBounds = handBounds('left');
            const rightBounds = handBounds('right');
            if (!pointInside(leftBounds, leftWrist) || !pointInside(rightBounds, rightWrist)) {
              gripFailures.push({ bodyType, strength, time, leftWrist, rightWrist, leftBounds, rightBounds });
            }
          }
        }
      }

      const bodyAccessoryProfiles = ['petite', 'average', 'plus-size'].map((bodyType) => {
        const state = window.HeroAvatar.normalizeAvatar(JSON.parse(JSON.stringify(baseState)));
        state.body.type = bodyType;
        state.outfit.accessory = 'utility-belt';
        state.outfit.accessories = ['utility-belt'];
        window.HeroAvatar.applyToSvg(svg, state);
        svg.pauseAnimations();
        svg.setCurrentTime(0);
        const torso = visibleBodyGroup();
        const belt = svg.querySelector('[data-hero-slot="accessory"][data-hero-option="utility-belt"]');
        const beltBounds = transformedBounds(belt);
        return {
          bodyType,
          torsoWidth: filledWidthAt(bodyPaths(torso), 424),
          beltWidth: beltBounds.right - beltBounds.left,
          missingFits: window.HeroAvatar.ACCESSORY_COMPATIBILITY.bodyBoundAccessories.filter((option) => {
            const group = svg.querySelector(`[data-hero-slot="accessory"][data-hero-option="${option}"]`);
            return !group || group.getAttribute('data-hero-body-accessory-fit') !== bodyType;
          }),
        };
      });
      return { values, profiles, gripFailures, bodyAccessoryProfiles };
    });

    expect(summary.values).toEqual([
      'petite',
      'lean',
      'slim-shouldered',
      'average',
      'medium-lean',
      'tall',
      'athletic',
      'soft-athletic',
      'muscular',
      'compact-strong',
      'broad',
      'broad-lean',
      'solid',
      'curvy',
      'short-curved',
      'fuller-hip',
      'balanced-curved',
      'full-frame',
      'balanced-full',
      'plus-size',
      'tall-soft',
    ]);

    const profile = Object.fromEntries(summary.profiles.map((item) => [item.value, item]));
    expect(summary.gripFailures).toEqual([]);
    for (const accessoryProfile of summary.bodyAccessoryProfiles) {
      expect(accessoryProfile.missingFits, `${accessoryProfile.bodyType} should fit every body-bound accessory`).toEqual([]);
      expect(accessoryProfile.beltWidth, `${accessoryProfile.bodyType} utility belt should follow its torso width`)
        .toBeLessThanOrEqual(accessoryProfile.torsoWidth + 12);
    }
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
    expect(profile.tall.renderedLowerBodyHeight, 'frame fitting should preserve the shared planted foot baseline').toBeCloseTo(profile.average.renderedLowerBodyHeight, 1);
    expect(profile.petite.renderedLowerBodyHeight, 'frame fitting should preserve the shared planted foot baseline').toBeCloseTo(profile.average.renderedLowerBodyHeight, 1);
    expect(profile.petite.armVolume, 'petite should keep a lighter limb-volume baseline').toBeLessThan(profile.average.armVolume);
    expect(profile.muscular.armVolume, 'muscular should use a substantially fuller limb silhouette').toBeGreaterThan(profile.average.armVolume + 0.15);
    expect(profile['plus-size'].armVolume, 'plus-size should use fuller limbs that match its torso').toBeGreaterThan(profile.average.armVolume + 0.12);
    expect(profile.petite.renderedArmWidth, 'petite limb volume should alter the visible arm silhouette').toBeLessThan(profile.average.renderedArmWidth);
    expect(profile.muscular.renderedArmWidth, 'muscular limb volume should alter the visible arm silhouette').toBeGreaterThan(profile.average.renderedArmWidth);
    expect(profile.broad.armFitTransform, 'arm pivots should remain fixed so broad wrists stay attached to the bar').toBe(profile.petite.armFitTransform);
    for (const value of summary.values) {
      expect(profile[value].muscleStrength, `${value} should not imply milestone muscle definition`).toBe(0);
      expect(profile[value].gripContained, `${value} wrists should stay inside the barbell hand silhouettes`).toBe(true);
    }
  });

  test('Accessory combinations compose into coherent face, head, and detail layers', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await clearAccessories(page);

    const normalizedConflicts = await page.evaluate(() => {
      const state = JSON.parse(JSON.stringify(window.HeroAvatar.DEFAULTS));
      state.outfit.accessory = 'rectangular-glasses';
      state.outfit.accessories = [
        'rectangular-glasses', 'mask',
        'beanie', 'hijab',
        'earrings', 'hair-clips', 'forehead-jewel',
        'wired-earbuds', 'wireless-earbuds', 'over-ear-headphones', 'headset-mic',
        'delicate-pendant-necklace', 'chain-necklace',
        'messenger-bag', 'backpack-straps',
        'halo',
      ];
      return window.HeroAvatar.normalizeAvatar(state).outfit.accessories;
    });
    expect(normalizedConflicts).toEqual(['mask', 'hijab', 'headset-mic', 'backpack-straps', 'forehead-jewel', 'halo']);

    const audioEarConflicts = await page.evaluate(() =>
      window.HeroAvatar.ACCESSORY_COMPATIBILITY.earConcealingAudio.map((audio) => {
        const state = JSON.parse(JSON.stringify(window.HeroAvatar.DEFAULTS));
        state.outfit.accessory = 'hoop-earrings';
        state.outfit.accessories = ['hoop-earrings', audio];
        return {
          audio,
          accessories: window.HeroAvatar.normalizeAvatar(state).outfit.accessories,
        };
      })
    );
    expect(audioEarConflicts).toEqual([
      { audio: 'over-ear-headphones', accessories: ['over-ear-headphones'] },
      { audio: 'headset-mic', accessories: ['headset-mic'] },
    ]);

    await setCheckboxInput(page, '#hero-customizer-modal input[name="hero-cust-accessory"][value="hoop-earrings"]', true);
    await setCheckboxInput(page, '#hero-customizer-modal input[name="hero-cust-accessory"][value="over-ear-headphones"]', true);
    await expect(page.getByLabel('Small hoop earrings', { exact: true })).not.toBeChecked();
    await expect(page.getByLabel('Over-ear headphones', { exact: true })).toBeChecked();
    await expect(page.locator('#hero-cust-status')).toContainText('Removed one accessory');
    await setCheckboxInput(page, '#hero-customizer-modal input[name="hero-cust-accessory"][value="hoop-earrings"]', true);
    await expect(page.getByLabel('Small hoop earrings', { exact: true })).not.toBeChecked();
    await expect(page.locator('#hero-cust-status')).toContainText('audio gear conceals');
    await clearAccessories(page);

    const incompatibleHairClipStates = await page.evaluate(() =>
      window.HeroAvatar.ACCESSORY_COMPATIBILITY.hairClipIncompatibleStyles.map((hairStyle) => {
        const state = JSON.parse(JSON.stringify(window.HeroAvatar.DEFAULTS));
        state.appearance.hairStyle = hairStyle;
        state.outfit.accessory = 'hair-clips';
        state.outfit.accessories = ['hair-clips'];
        return {
          hairStyle,
          accessories: window.HeroAvatar.normalizeAvatar(state).outfit.accessories,
        };
      })
    );
    expect(incompatibleHairClipStates).toEqual([
      { hairStyle: 'bald', accessories: [] },
      { hairStyle: 'mohawk', accessories: [] },
    ]);

    await setSelectInput(page, '#hero-cust-hair-style', 'bald');
    await setCheckboxInput(page, '#hero-customizer-modal input[name="hero-cust-accessory"][value="hair-clips"]', true);
    await expect(page.getByLabel('Hair clips', { exact: true })).not.toBeChecked();
    await expect(page.locator('#hero-cust-status')).toContainText('compatible placement');

    await setSelectInput(page, '#hero-cust-hair-style', 'long-layers');
    await setCheckboxInput(page, '#hero-customizer-modal input[name="hero-cust-accessory"][value="hair-clips"]', true);
    await expect(page.getByLabel('Hair clips', { exact: true })).toBeChecked();
    await setSelectInput(page, '#hero-cust-hair-style', 'mohawk');
    await expect(page.getByLabel('Hair clips', { exact: true })).not.toBeChecked();
    await expect(page.locator('#hero-cust-status')).toContainText('Removed hair clips');
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
      .toHaveAttribute('display', 'none');
    await expect(preview.locator('[data-hero-slot="accessory"][data-hero-option="hair-clips"]'))
      .toHaveAttribute('display', 'none');
    await expect(preview.locator('[data-hero-slot="accessory"][data-hero-option="halo"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="hair"][data-hero-option="long-layers"]'))
      .toHaveAttribute('display', 'none');
    await expect(preview.locator('[data-hero-slot="hairline"][data-hero-option="long-layers"]'))
      .toHaveAttribute('display', 'none');

    const checkedAccessories = await page
      .locator('#hero-customizer-modal input[name="hero-cust-accessory"]:checked')
      .evaluateAll((inputs) => inputs.map((input) => input.value).sort());
    expect(checkedAccessories).toEqual(['halo', 'hijab', 'mask']);
    await expect(page.locator('#hero-customizer-modal input[name="hero-cust-accessory"][value="earrings"]'))
      .not.toBeChecked();
    await expect(page.locator('#hero-customizer-modal input[name="hero-cust-accessory"][value="hair-clips"]'))
      .not.toBeChecked();

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
    for (const value of ['wired-earbuds', 'wireless-earbuds', 'over-ear-headphones', 'headset-mic']) {
      await setCheckboxInput(page, `#hero-customizer-modal input[name="hero-cust-accessory"][value="${value}"]`, true);
    }
    for (const value of ['chain-necklace', 'delicate-pendant-necklace']) {
      await setCheckboxInput(page, `#hero-customizer-modal input[name="hero-cust-accessory"][value="${value}"]`, true);
    }
    for (const value of ['backpack-straps', 'messenger-bag']) {
      await setCheckboxInput(page, `#hero-customizer-modal input[name="hero-cust-accessory"][value="${value}"]`, true);
    }
    expect(await page.locator('#hero-customizer-modal input[name="hero-cust-accessory"]:checked').evaluateAll(
      (inputs) => inputs.map((input) => input.value).sort()
    )).toEqual(['delicate-pendant-necklace', 'headset-mic', 'messenger-bag']);

    await clearAccessories(page);
    for (const value of ['hair-clips', 'forehead-jewel', 'earrings', 'wireless-earbuds', 'chain-necklace']) {
      await setCheckboxInput(page, `#hero-customizer-modal input[name="hero-cust-accessory"][value="${value}"]`, true);
    }
    await setCheckboxInput(page, '#hero-customizer-modal input[name="hero-cust-accessory"][value="hijab"]', true);
    expect(await page.locator('#hero-customizer-modal input[name="hero-cust-accessory"]:checked').evaluateAll(
      (inputs) => inputs.map((input) => input.value).sort()
    )).toEqual(['forehead-jewel', 'hijab']);
    await expect(page.locator('#hero-cust-status')).toContainText('Removed 4 accessories');

    await clearAccessories(page);
    await setCheckboxInput(page, '#hero-customizer-modal input[name="hero-cust-accessory"][value="forehead-jewel"]', true);
    await setCheckboxInput(page, '#hero-customizer-modal input[name="hero-cust-accessory"][value="wrapped-dastar"]', true);
    expect(await page.locator('#hero-customizer-modal input[name="hero-cust-accessory"]:checked').evaluateAll(
      (inputs) => inputs.map((input) => input.value).sort()
    )).toEqual(['forehead-jewel', 'wrapped-dastar']);
    await expect(preview.locator('[data-hero-slot="accessory"][data-hero-option="forehead-jewel"]'))
      .toHaveAttribute('display', 'inline');
    await expect(preview.locator('[data-hero-slot="accessory"][data-hero-option="wrapped-dastar"]'))
      .toHaveAttribute('display', 'inline');

    await clearAccessories(page);
    await setCheckboxInput(page, '#hero-customizer-modal input[name="hero-cust-accessory"][value="hijab"]', true);
    await setCheckboxInput(page, '#hero-customizer-modal input[name="hero-cust-accessory"][value="over-ear-headphones"]', true);
    await expect(preview.locator('[data-hero-slot="accessory"][data-hero-option="over-ear-headphones"]'))
      .toHaveAttribute('display', 'inline');
    const headphonesAboveCovering = await preview.evaluate((svg) => {
      const headphones = svg.querySelector('[data-hero-slot="accessory"][data-hero-option="over-ear-headphones"]');
      const hijab = svg.querySelector('[data-hero-slot="accessory"][data-hero-option="hijab"]');
      return Boolean(headphones && hijab && (hijab.compareDocumentPosition(headphones) & Node.DOCUMENT_POSITION_FOLLOWING));
    });
    expect(headphonesAboveCovering).toBe(true);

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
    await expect(svg.locator('[data-hero-emblem-art]')).toHaveAttribute('data-hero-emblem-value', '🌟');
    await expect(svg.locator('[data-hero-emblem-vector="🌟"]')).toHaveAttribute('display', 'inline');
  });

  test('Download exports a JSON file with the current state', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    await page.getByLabel('Hair style', { exact: true }).selectOption('textured-crop');
    await clearAccessories(page);
    await page.getByLabel('Rectangular glasses', { exact: true }).check();
    await page.getByRole('button', { name: 'Move nose down', exact: true }).click();
    await page.getByRole('button', { name: 'Make nose width more', exact: true }).click();
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
    expect(parsed.fineTune.nose.vertical).toBe(1);
    expect(parsed.fineTune.nose.width).toBe(1);
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
      outfit: { suit: '#1F6EBD', capeOuter: '#15538f', capeInner: '#FFD100', accessory: 'rectangular-glasses', accessories: ['rectangular-glasses', 'earrings'], emblem: '' },
      fineTune: { mouth: { vertical: -2, spread: 1, width: 3, height: -1 } }
    };

    await page.locator('#hero-cust-upload-input').setInputFiles({
      name: 'avatar.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(validAvatar)),
    });
    await expect(page.getByLabel('Hair style', { exact: true })).toHaveValue('ponytail');
    await expect(page.getByLabel('Body frame', { exact: true })).toHaveValue('curvy');
    await expect(page.getByLabel('Facial details', { exact: true })).toHaveValue('freckles');
    await expect(page.getByLabel('Cheek tint', { exact: true })).toHaveValue('natural');
    await expect(page.getByLabel('Rectangular glasses', { exact: true })).toBeChecked();
    await expect(page.getByLabel('Earrings', { exact: true })).toBeChecked();
    await expect(fineTuneOutput(page, 'mouth', 'vertical')).toHaveText('-2');
    await expect(fineTuneOutput(page, 'mouth', 'spread')).toHaveText('+1');
    await expect(fineTuneOutput(page, 'mouth', 'width')).toHaveText('+3');
    await expect(fineTuneOutput(page, 'mouth', 'height')).toHaveText('-1');
    // Preview updated but not yet saved
    const storedBefore = await page.evaluate(() => localStorage.getItem('se-gym-hero-avatar'));
    expect(storedBefore).toBeNull();
    await heroCustomizerAction(page, /save/i).click();
    const storedAfter = await page.evaluate(() => localStorage.getItem('se-gym-hero-avatar'));
    expect(storedAfter).not.toBeNull();
    expect(JSON.parse(String(storedAfter)).fineTune.mouth).toEqual({ vertical: -2, spread: 1, width: 3, height: -1 });
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

test.describe('SE Gym hero — milestone gating of showpiece accessories', () => {
  test.beforeEach(async ({ page }) => {
    await clearState(page);
  });

  // se-gym.html sets window.SEGymHeroMilestone from total exercise attempts; the
  // customizer reads it on open. We set it directly to isolate the gating contract
  // (tier-from-attempts is covered by the milestone tests above).
  async function openCustomizerAtTier(page, tier) {
    await page.evaluate((t) => { window.SEGymHeroMilestone = t; }, tier);
    await page.getByRole('button', { name: 'Customize Hero' }).click();
    const modal = page.getByRole('dialog', { name: 'Customize your hero' });
    await expect(modal).toBeVisible();
    return modal;
  }

  test('showpiece gear is locked at the lowest tier and unlocks at diamond', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);

    let modal = await openCustomizerAtTier(page, 'none');
    // The four gated accessories (utility-belt, hero-cape-clasp, halo, crown) are disabled + flagged.
    await expect(modal.locator('.hero-cust-accessory-choice input[type="checkbox"]:disabled')).toHaveCount(4);
    await expect(modal.locator('.hero-cust-accessory-lock')).toHaveCount(4);
    const crown = modal.locator('.hero-cust-accessory-choice[data-choice-value="crown"]');
    await expect(crown.locator('input[type="checkbox"]')).toBeDisabled();
    await expect(crown.locator('.hero-cust-accessory-lock')).toHaveText(/Diamond/);
    await heroCustomizerAction(page, 'Cancel').click();

    // Reaching diamond unlocks every showpiece item.
    modal = await openCustomizerAtTier(page, 'diamond');
    await expect(modal.locator('.hero-cust-accessory-choice input[type="checkbox"]:disabled')).toHaveCount(0);
    await expect(modal.locator('.hero-cust-accessory-lock')).toHaveCount(0);
  });

  test('a mid tier unlocks only lower-or-equal gear', async ({ page }) => {
    await page.goto(GYM_URL);
    await activatePersonalGym(page);
    const modal = await openCustomizerAtTier(page, 'silver');
    // bronze + silver gear unlocked; gold + diamond gear still locked.
    await expect(modal.locator('.hero-cust-accessory-choice[data-choice-value="utility-belt"] input')).toBeEnabled();
    await expect(modal.locator('.hero-cust-accessory-choice[data-choice-value="hero-cape-clasp"] input')).toBeEnabled();
    await expect(modal.locator('.hero-cust-accessory-choice[data-choice-value="halo"] input')).toBeDisabled();
    await expect(modal.locator('.hero-cust-accessory-choice[data-choice-value="crown"] input')).toBeDisabled();
    await expect(modal.locator('.hero-cust-accessory-choice input[type="checkbox"]:disabled')).toHaveCount(2);
  });
});
