const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');

const SAVED_HERO = {
  version: 1,
  kind: 'human',
  appearance: {
    skin: '#875a50',
    hairColor: '#1f140c',
    hairStyle: 'short',
    eyeColor: '#3a5a3a',
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
    suit: '#5a1fbd',
    capeOuter: '#15538f',
    capeInner: '#ffd100',
    accessories: [],
    emblem: '',
  },
};

// reducedMotion is a BrowserContext option, not a top-level TestOptions field.
test.use({ viewport: { width: 390, height: 844 }, contextOptions: { reducedMotion: 'reduce' } });

test.beforeEach(async ({ page, context, baseURL }) => {
  await context.addCookies([
    { name: 'se-gym-active', value: 'true', url: baseURL },
    { name: 'se-gym-workout-fullscreen', value: 'false', url: baseURL },
    { name: 'se-gym-show-workout-hero', value: 'true', url: baseURL },
    { name: 'se-gym', value: encodeURIComponent(JSON.stringify([{ type: 'quiz', id: 'user_stories' }])), url: baseURL },
  ]);
  await page.addInitScript((hero) => {
    if (!localStorage.getItem('se-gym-hero-avatar')) {
      localStorage.setItem('se-gym-hero-avatar', JSON.stringify(hero));
    }
  }, SAVED_HERO);
});

// Decorative artwork deliberately has no accessible role. The host names and
// SVG trait hooks identify the renderer's public display surfaces without
// coupling the checks to its helpers or to a particular SVG path hierarchy.
function hero(page, variant) {
  return page.locator(`[data-gym-hero-host="${variant}"] [data-gym-hero-svg]`);
}

async function expectSavedHuman(svg) {
  await expect(svg).toBeVisible();
  await expect(svg).toHaveAttribute('data-hero-kind', 'human');
  await expect(svg).toHaveCSS('--hero-skin-light', SAVED_HERO.appearance.skin);
  await expect(svg).toHaveCSS('--hero-suit', SAVED_HERO.outfit.suit);
  await expect(svg.locator('[data-hero-slot="hair"][data-hero-option="short"]'))
    .toHaveAttribute('display', 'inline');
}

async function expectMotionPaused(svg, paused) {
  await expect.poll(() => svg.evaluate((element) => element.animationsPaused()), {
    message: `hero SVG animation should be ${paused ? 'paused' : 'running'}`,
  }).toBe(paused);
}

test('mobile startup loads only the visible hero and avoids duplicate scripts', async ({ page }) => {
  const templateRequests = [];
  const errors = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/assets/se-gym-hero-template.svg') {
      templateRequests.push(request.url());
    }
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/se-gym/');
  await expectSavedHuman(hero(page, 'mobile'));
  await expect(page.locator('[data-gym-hero-svg]')).toHaveCount(1);
  await expect(page.locator('[data-gym-hero-host]:not([data-gym-hero-host="mobile"]) [data-gym-hero-svg]'))
    .toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Choose Hero type:/, includeHidden: true }))
    .toHaveCount(0);
  expect(templateRequests, 'the reusable hero artwork is downloaded once').toHaveLength(1);

  const scriptUrls = await page.locator('script[src]').evaluateAll((scripts) => scripts.map((script) => script.src));
  expect(scriptUrls.filter((url, index) => scriptUrls.indexOf(url) !== index),
    'external scripts should not execute twice on the same page').toEqual([]);
  expect(errors, 'startup must not raise JavaScript errors').toEqual([]);
  await a11yCheckpoint(page, 'mobile gym with lazily loaded hero', { feature: 'se-gym' });
});

test('plain quiz view does not download or mount unused avatar artwork', async ({ page }) => {
  const templateRequests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/assets/se-gym-hero-template.svg') {
      templateRequests.push(request.url());
    }
  });

  await page.goto('/se-gym/?plain=true&quiz=user-stories');
  await expect(page.getByText(/Which INVEST criteria are violated/)).toBeVisible();
  await expect(page.getByRole('group', { name: 'Answer options' }).getByRole('checkbox')).toHaveCount(6);
  await page.getByRole('group', { name: 'Answer options' }).getByRole('checkbox').first().check();
  await expect(page.getByRole('button', { name: 'Submit Answer', exact: true })).toBeEnabled();
  await expect(page.locator('[data-gym-hero-svg]')).toHaveCount(0);
  expect(templateRequests, 'plain quiz mode has no visible avatar to load').toHaveLength(0);
});

test('customizer opens with the saved appearance and saves it for later workout views', async ({ page }) => {
  await page.goto('/se-gym/');
  await expectSavedHuman(hero(page, 'mobile'));
  const customize = page.getByRole('button', { name: 'Customize Hero', exact: true });
  // Exercise keyboard focus restoration; Safari deliberately does not focus
  // buttons on pointer clicks, so a click alone has no opener focus to restore.
  await customize.focus();
  await customize.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Customize your hero' });
  await expect(dialog).toBeVisible();
  await expectSavedHuman(hero(page, 'preview'));
  await expect(dialog.getByLabel('Skin tone', { exact: true })).toHaveValue(SAVED_HERO.appearance.skin);
  await dialog.getByRole('button', { name: 'Choose Hero type: Bruin mascot', exact: true }).click();
  await expect(hero(page, 'preview')).toHaveAttribute('data-hero-kind', 'bruin');
  await a11yCheckpoint(page, 'lazy hero customizer open', { feature: 'se-gym-hero-avatar' });
  await dialog.getByRole('group', { name: 'Top hero customizer actions' })
    .getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(customize).toBeFocused();
  await expect(hero(page, 'mobile')).toHaveAttribute('data-hero-kind', 'bruin');

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(hero(page, 'left')).toHaveAttribute('data-hero-kind', 'bruin');
  await expect(hero(page, 'right')).toHaveAttribute('data-hero-kind', 'bruin');
  await page.getByRole('spinbutton', { name: 'Max cards:' }).fill('1');
  await page.getByRole('button', { name: 'Start Workout', exact: true }).click();
  await expect(hero(page, 'workout-left')).toBeVisible();
  await expect(hero(page, 'workout-left')).toHaveAttribute('data-hero-kind', 'bruin');
  await expect(hero(page, 'workout-right')).toHaveAttribute('data-hero-kind', 'bruin');
  await page.getByRole('group', { name: 'Answer options' }).getByRole('checkbox').first().check();
  await page.getByRole('button', { name: 'Submit Answer', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Workout Complete!', exact: true })).toBeVisible();
  await expect(hero(page, 'results')).toBeVisible();
  await expect(hero(page, 'results')).toHaveAttribute('data-hero-kind', 'bruin');

  await page.reload();
  await expect(hero(page, 'left')).toHaveAttribute('data-hero-kind', 'bruin');
});

test('crossing the desktop breakpoint preserves saved artwork and unique SVG references', async ({ page }) => {
  const templateRequests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/assets/se-gym-hero-template.svg') {
      templateRequests.push(request.url());
    }
  });
  await page.setViewportSize({ width: 1179, height: 900 });
  await page.goto('/se-gym/');
  await expectSavedHuman(hero(page, 'mobile'));
  await expect(hero(page, 'left')).toHaveCount(0);
  await expect(hero(page, 'right')).toHaveCount(0);

  await page.setViewportSize({ width: 1180, height: 900 });
  await expectSavedHuman(hero(page, 'left'));
  await expectSavedHuman(hero(page, 'right'));
  await expect(hero(page, 'mobile')).toBeHidden();
  const duplicateIds = await page.locator('[data-gym-hero-svg] [id]').evaluateAll((elements) => {
    const ids = elements.map((element) => element.id);
    return ids.filter((id, index) => ids.indexOf(id) !== index);
  });
  expect(duplicateIds, 'each avatar must resolve its own gradients and clipping paths').toEqual([]);
  expect(templateRequests, 'responsive changes reuse the downloaded artwork').toHaveLength(1);

  await page.setViewportSize({ width: 390, height: 844 });
  await expectSavedHuman(hero(page, 'mobile'));
  await expect(hero(page, 'left')).toBeHidden();
  await expect(hero(page, 'right')).toBeHidden();
});

test('scrolling pauses offscreen hero motion and resumes it when visible', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/se-gym/');
  const mobileHero = hero(page, 'mobile');
  await expectSavedHuman(mobileHero);
  await mobileHero.scrollIntoViewIfNeeded();
  await expectMotionPaused(mobileHero, false);

  await page.getByRole('heading', { name: 'Available Quizzes', exact: true }).scrollIntoViewIfNeeded();
  await expectMotionPaused(mobileHero, true);
  await mobileHero.scrollIntoViewIfNeeded();
  await expectMotionPaused(mobileHero, false);
});

test('returning onscreen respects the explicit hero pause control', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/se-gym/');
  const mobileHero = hero(page, 'mobile');
  await expectSavedHuman(mobileHero);
  await page.getByRole('button', { name: 'Pause Hero Motion', exact: true }).click();
  await page.getByRole('heading', { name: 'Available Quizzes', exact: true }).scrollIntoViewIfNeeded();
  await mobileHero.scrollIntoViewIfNeeded();
  await expectMotionPaused(mobileHero, true);
  await page.getByRole('button', { name: 'Play Hero Motion', exact: true }).click();
  await mobileHero.scrollIntoViewIfNeeded();
  await expectMotionPaused(mobileHero, false);
});

test('newly mounted responsive heroes honor reduced motion', async ({ page }) => {
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
    'the browser must receive the OS reduced-motion preference before loading the page').toBe(true);
  await page.goto('/se-gym/');
  await expectSavedHuman(hero(page, 'mobile'));
  await expectMotionPaused(hero(page, 'mobile'), true);
  await expect(page.getByRole('button', { name: 'Motion Reduced', exact: true })).toBeDisabled();

  await page.setViewportSize({ width: 1440, height: 900 });
  await expectSavedHuman(hero(page, 'left'));
  await expectSavedHuman(hero(page, 'right'));
  await expectMotionPaused(hero(page, 'left'), true);
  await expectMotionPaused(hero(page, 'right'), true);
});

test('each shared avatar keeps its styles, gradients and clipping paths within its own artwork', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/se-gym/');
  await expectSavedHuman(hero(page, 'left'));
  await expectSavedHuman(hero(page, 'right'));

  const artwork = await page.locator('[data-gym-hero-svg]').evaluateAll((svgs) => svgs.map((svg) => {
    const foreignStyleMatches = [];
    const invalidReferences = [];
    let matchedRules = 0;
    let referenceCount = 0;
    function inspectRules(rules) {
      for (const rule of rules) {
        if (rule.selectorText) {
          const targets = Array.from(document.querySelectorAll(rule.selectorText));
          if (targets.length) matchedRules++;
          if (targets.some((target) => target !== svg && !svg.contains(target))) {
            foreignStyleMatches.push(rule.selectorText);
          }
        }
        if (rule.cssRules) inspectRules(rule.cssRules);
      }
    }
    function inspectReferences(value) {
      for (const match of value.matchAll(/url\(["']?#([^\s)"']+)["']?\)/g)) {
        referenceCount++;
        const target = document.getElementById(match[1]);
        if (!target || !svg.contains(target)) invalidReferences.push(match[1]);
      }
    }
    for (const style of svg.querySelectorAll('style')) {
      inspectRules(style.sheet.cssRules);
      inspectReferences(style.textContent);
    }
    for (const element of svg.querySelectorAll('*')) {
      for (const attribute of element.attributes) inspectReferences(attribute.value);
      const href = element.getAttribute('href') || element.getAttribute('xlink:href');
      if (href && href.startsWith('#')) {
        referenceCount++;
        const target = document.getElementById(href.slice(1));
        if (!target || !svg.contains(target)) invalidReferences.push(href);
      }
    }
    const hair = svg.querySelector('[data-hero-slot="hair"][data-hero-option="short"]');
    return {
      matchedRules,
      referenceCount,
      foreignStyleMatches,
      invalidReferences,
      hairClip: getComputedStyle(hair).clipPath,
    };
  }));
  expect(artwork).toHaveLength(2);
  for (const instance of artwork) {
    expect(instance.matchedRules, 'embedded SVG rules must still affect the mounted artwork').toBeGreaterThan(0);
    expect(instance.referenceCount, 'the full artwork retains its paint and clipping references').toBeGreaterThan(0);
    expect(instance.hairClip, 'hair retains its authored shoulder clipping').toMatch(/^url\(/);
    expect(instance.foreignStyleMatches, 'one avatar stylesheet must not recolor another avatar').toEqual([]);
    expect(instance.invalidReferences, 'paint and clipping references must resolve inside the same avatar').toEqual([]);
  }
});

const RECOVERY_ACTIONS = [
  ['online', async (page) => {
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
  }],
  ['view switch', async (page) => {
    await page.getByRole('button', { name: 'Start Workout', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Submit Answer', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Back to Gym Entrance', exact: true }).click();
  }],
];

for (const [recovery, recover] of RECOVERY_ACTIONS) {
  test(`hero loading recovers from a transient network failure after ${recovery}`, async ({ page }) => {
    let connectionRestored = false;
    // Fault injection belongs at the HTTP boundary. Successful retries still
    // use the real built asset; no renderer or loader functions are mocked.
    await page.route('**/assets/se-gym-hero-template.svg*', (route) => (
      connectionRestored ? route.continue() : route.abort('internetdisconnected')
    ));
    const failedDownload = page.waitForEvent('requestfailed', (request) => (
      new URL(request.url()).pathname === '/assets/se-gym-hero-template.svg'
    ));
    await page.goto('/se-gym/');
    await failedDownload;
    await expect(hero(page, 'mobile')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Start Workout', exact: true })).toBeEnabled();

    connectionRestored = true;
    await recover(page);
    await expectSavedHuman(hero(page, 'mobile'));
  });
}
