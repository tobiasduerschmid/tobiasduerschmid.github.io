// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { countInArtwork } = require('./song-player-helpers');

const PLAYER_PATH = '/assets/song-player/snapshots-and-pointers.html';
const storyboard = yaml.load(fs.readFileSync(path.join(__dirname, '..', '_data/songs/snapshots_and_pointers.yml'), 'utf8'));
const infoHidingStoryboard = yaml.load(fs.readFileSync(path.join(__dirname, '..', '_data/songs/every_module_keeps_a_secret.yml'), 'utf8'));
const songPlayers = [
  { name: 'Git', path: PLAYER_PATH, storyboard, cameoTime: 12 },
  {
    name: 'Networking', path: '/assets/song-player/unbox-the-stack.html', cameoTime: 3,
    storyboard: yaml.load(fs.readFileSync(path.join(__dirname, '..', '_data/songs/unbox_the_stack.yml'), 'utf8')),
  },
  {
    name: 'Shell', path: '/assets/song-player/small-tools-one-job-each.html', cameoTime: 6,
    storyboard: yaml.load(fs.readFileSync(path.join(__dirname, '..', '_data/songs/small_tools_one_job_each.yml'), 'utf8')),
  },
  {
    // The hero codes at a laptop while verse 2's store services appear. (Agent 00
    // takes the case-file and finale cameos; see song-information-hiding-scenes.)
    name: 'Information hiding', path: '/assets/song-player/every-module-keeps-a-secret.html', cameoTime: infoHidingStoryboard.sections.find((section) => section.id === 'verse-2').lines[0].start + 1,
    storyboard: infoHidingStoryboard,
  },
  {
    name: 'User stories', path: '/assets/song-player/invest-in-your-stories.html', cameoTime: 5,
    storyboard: yaml.load(fs.readFileSync(path.join(__dirname, '..', '_data/songs/invest_in_your_stories.yml'), 'utf8')),
  },
  {
    name: 'Test-driven development', path: '/assets/song-player/red-green-refactor.html', cameoTime: 317,
    storyboard: yaml.load(fs.readFileSync(path.join(__dirname, '..', '_data/songs/red_green_refactor.yml'), 'utf8')),
  },
  {
    name: 'Object-oriented programming', path: '/assets/song-player/let-the-object-decide.html', cameoTime: 3,
    storyboard: yaml.load(fs.readFileSync(path.join(__dirname, '..', '_data/songs/let_the_object_decide.yml'), 'utf8')),
  },
  {
    // The hero codes at a laptop while the intro sings "Just keep coding".
    name: 'UML diagrams', path: '/assets/song-player/draw-it-out.html', cameoTime: 3,
    storyboard: yaml.load(fs.readFileSync(path.join(__dirname, '..', '_data/songs/draw_it_out.yml'), 'utf8')),
  },
  {
    // The hero types at a desk while the Teammate sings "No need to worry".
    name: 'Working on a team', path: '/assets/song-player/it-works-on-my-machine.html', cameoTime: 5,
    storyboard: yaml.load(fs.readFileSync(path.join(__dirname, '..', '_data/songs/it_works_on_my_machine.yml'), 'utf8')),
  },
];
const lines = new Map(storyboard.sections.flatMap((section) => section.lines).map((line) => [line.id, line]));
const finalCelebration = lines.get('chorus-4-8').marks.moves + 0.2;
const STORAGE_KEY = 'se-gym-hero-avatar';
const humanHero = {
  version: 1,
  kind: 'human',
  appearance: {
    skin: '#35241f', hairColor: '#66418c', eyebrowColor: '#3d2818', facialHairColor: '#b7bdc8',
    hairStyle: 'locs', eyeColor: '#3a5a7a', eyebrowStyle: 'arched', headStyle: 'broad',
    eyeShape: 'round', earShape: 'oval', eyelashStyle: 'none', noseShape: 'soft',
    mouthStyle: 'smile', blushStyle: 'natural', facialHair: 'none', faceFeature: 'none',
  },
  body: { type: 'average' },
  outfit: {
    style: 'hoodie', suit: '#BD1F6E', capeOuter: '#5a158f', capeInner: '#FFD100',
    accessory: 'round-rim-glasses', accessories: ['round-rim-glasses'], emblem: '',
  },
  fineTune: { eyes: { vertical: 1, spread: 1, width: 0, height: 0 } },
};
const bruinHero = {
  ...humanHero, kind: 'bruin',
  appearance: { ...humanHero.appearance, skin: '#512d22', hairStyle: 'bald', hairColor: '#3d2818' },
  outfit: { ...humanHero.outfit, style: 'super-suit', suit: '#BD8F1F', capeOuter: '#15568f', capeInner: '#8F1FFF', accessory: 'none', accessories: [] },
  fineTune: { mascot: { vertical: 1, spread: 0, width: 1, height: 0 } },
};
const profHero = { ...humanHero, kind: 'tobias' };
const heroSamples = [
  { name: 'custom human', hero: humanHero, skin: '#35241f', hair: '#66418c', suit: '#BD1F6E' },
  { name: 'custom Bruin', hero: bruinHero, skin: '#512d22', hair: '#3d2818', suit: '#BD8F1F' },
  // Prof is the fixed portrait in the Gym too; saved editable human fields
  // must not silently turn this choice back into the generic human character.
  { name: 'Prof', hero: profHero, skin: '#edbea5', hair: '#897257', suit: '#009bb7' },
];

test.beforeEach(async ({ context }) => {
  // WEBrick incorrectly returns 304 for cached If-Range requests. Routing
  // disables that cache path while still loading the real media and artwork.
  await context.route('**/*', (route) => route.continue());
});

async function openPausedPlayer(page) {
  await page.goto(PLAYER_PATH);
  await expect(page.getByTestId('song-picture')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play song', exact: true })).toBeEnabled();
  // Selecting a track loads native metadata while leaving playback paused.
  // This keeps artwork tests independent of real-time audio decoding speed.
  const track = page.getByRole('combobox', { name: 'Audio track', exact: true });
  await track.selectOption('described');
  await expect(page.getByRole('slider', { name: 'Song position', exact: true })).toBeEnabled();
  await track.selectOption('original');
  const audio = page.getByLabel(`${storyboard.title} audio`, { exact: true });
  await expect.poll(() => audio.evaluate((element) => element.duration)).toBeCloseTo(storyboard.duration, 1);
  await expect(audio).toHaveJSProperty('paused', true);
  return audio;
}

async function seek(page, seconds) {
  await page.getByRole('slider', { name: 'Song position', exact: true }).fill(String(Math.round(seconds * 10) / 10));
}

// SongKit.confetti owns the stable decorative layer/piece classes. These have
// no accessibility role: the equivalent scene description is provided outside
// the animated stage. Inspect resolved paint, not the animation's private state.
async function paintedConfetti(page) {
  return page.locator('.confetti-piece').evaluateAll((pieces) => pieces.filter((piece) => {
    for (let ancestor = piece; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) < 0.01) return false;
    }
    return piece.getBoundingClientRect().width > 0;
  }).map((piece) => {
    const style = getComputedStyle(piece);
    return { transform: style.transform, opacity: style.opacity };
  }));
}

async function studentGeometry(student) {
  return student.evaluate((node) => {
    const rounded = (value) => Math.round(value * 1000) / 1000 || 0;
    const effectiveOpacity = (shape) => {
      let opacity = 1;
      for (let ancestor = shape; ancestor && ancestor !== node; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        if (style.display === 'none' || style.visibility === 'hidden') return 0;
        opacity *= Number(style.opacity);
      }
      return rounded(opacity);
    };
    // Stable part hooks let the oracle distinguish pupil movement from merely
    // moving the whole head. SVG-local geometry excludes stage camera motion,
    // viewport scaling, and browser rounding between the two sibling SVGs.
    const parts = Object.fromEntries(['head', 'arm-left', 'arm-right', 'gaze', 'blink-open', 'blink-closed'].map((name) => [name,
      [...node.querySelectorAll(`[data-student-motion="${name}"]`)].map((part) => {
        const matrix = part.parentNode.getCTM().inverse().multiply(part.getCTM());
        const box = part.getBBox();
        return {
          matrix: [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f].map(rounded),
          bounds: [box.x, box.y, box.width, box.height].map(rounded),
          opacity: effectiveOpacity(part),
        };
      }),
    ]));
    return { parts };
  });
}

test('celebration paper follows seeking without accumulating particles or persisting into other scenes', async ({ page }) => {
  await openPausedPlayer(page);
  const initialCount = await countInArtwork(page, '.confetti-piece');
  expect(initialCount, 'all celebrations have a small, fixed paper budget').toBeGreaterThan(0);
  expect(initialCount, 'all celebrations have a small, fixed paper budget').toBeLessThanOrEqual(150);

  await seek(page, finalCelebration - 0.2);
  await expect.poll(() => paintedConfetti(page)).toEqual([]);
  const pictureTime = Math.round((finalCelebration + 0.6) * 10) / 10;
  await seek(page, pictureTime);
  await expect.poll(() => paintedConfetti(page)).not.toEqual([]);
  const firstPicture = await paintedConfetti(page);

  for (const destination of [12, 240, 145.9, pictureTime - 0.2]) {
    await seek(page, destination);
    await seek(page, pictureTime);
    await expect.poll(() => paintedConfetti(page), {
      message: 'returning to an audio position must reproduce the same paper pose',
    }).toEqual(firstPicture);
  }
  expect(await countInArtwork(page, '.confetti-piece'), 'seeking never adds paper').toBe(initialCount);
  await seek(page, 240);
  await expect.poll(() => paintedConfetti(page)).toEqual([]);
});

for (const { name, hero, skin, hair, suit } of heroSamples) {
  test(`the saved ${name} appears at the laptop without changing the Gym configuration`, async ({ page }, testInfo) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const saved = JSON.stringify(hero);
    await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: STORAGE_KEY, value: saved });
    await openPausedPlayer(page);
    await seek(page, 12);
    const student = page.getByTestId('song-student-avatar');
    await expect(student).toHaveAttribute('data-avatar-state', 'saved');
    await expect(student).toHaveCSS('opacity', '1');
    const portrait = student.locator('[data-gym-hero-svg]');
    await expect(portrait).toBeVisible();
    await expect(portrait).toHaveAttribute('data-hero-kind', hero.kind);
    // These are the shared renderer's material/feature contracts. Checking
    // them on the mounted portrait catches replacing it with a default hero.
    await expect(portrait).toHaveCSS('--hero-skin-light', skin);
    await expect(portrait).toHaveCSS('--hero-hair', hair);
    await expect(portrait).toHaveCSS('--hero-suit', suit);
    if (hero.kind === 'human') {
      await expect(portrait.locator('[data-hero-slot="hair"][data-hero-option="locs"]')).toBeVisible();
      await expect(portrait.locator('[data-hero-slot="accessory"][data-hero-option="round-rim-glasses"]')).toBeVisible();
      await expect(portrait.locator('[data-hero-slot="outfit-style"][data-hero-option="hoodie"]')).toBeVisible();
      // Moving pupils must preserve the shared eye artwork's shaded paint,
      // including the per-instance gradient references that avoid ID clashes.
      const irisPaint = await portrait.locator('[data-hero-slot="eye-shape"][data-hero-option="round"] circle[fill*="--hero-eye"]').evaluateAll((irises) => irises.map((iris) => {
        const reference = getComputedStyle(iris).fill.match(/#([^"')]+)/);
        const gradient = reference && document.getElementById(reference[1]);
        return Boolean(gradient && ['linearGradient', 'radialGradient'].includes(gradient.localName));
      }));
      expect(irisPaint, 'both moving irises should retain their shaded eye-color gradient').toEqual([true, true]);
    }
    if (hero.kind === 'bruin') {
      await expect(portrait.locator('[data-hero-bruin-anatomy="head"]')).toBeVisible();
      await expect(portrait).toHaveCSS('--hero-cape', hero.outfit.capeOuter);
    }
    await expect(portrait.locator('[data-hero-barbell], [data-hero-human-arms], [data-hero-slot="mascot-arms"]')).toHaveCount(0);
    await expect(portrait.locator('animate, animateTransform, animateMotion, set')).toHaveCount(0);
    await page.getByTestId('song-picture').screenshot({ path: `/tmp/git-mv-${hero.kind}-${testInfo.project.name}.png` });
    await student.screenshot({ path: `/tmp/git-mv-${hero.kind}-${testInfo.project.name}-closeup.png` });

    for (const cameoTime of [169, 174, 228, 234, 240]) {
      await seek(page, cameoTime);
      await expect(student).toBeVisible();
      await expect(student).toHaveCSS('opacity', '1');
      await expect(portrait).toHaveAttribute('data-hero-kind', hero.kind);
      if (cameoTime === 234) {
        await page.getByTestId('song-picture').screenshot({ path: `/tmp/git-mv-${hero.kind}-${testInfo.project.name}-finale.png` });
        const viewport = page.viewportSize();
        await page.setViewportSize({ width: 670, height: 900 });
        await page.getByTestId('song-picture').screenshot({ path: `/tmp/git-mv-${hero.kind}-${testInfo.project.name}-narrow-finale.png` });
        await page.setViewportSize(viewport);
      }
      if (cameoTime === 169 || cameoTime === 174) {
        const viewport = page.viewportSize();
        await page.setViewportSize({ width: 670, height: 900 });
        await page.getByTestId('song-picture').screenshot({ path: `/tmp/git-mv-${hero.kind}-${testInfo.project.name}-remotes-${cameoTime}.png` });
        await page.setViewportSize(viewport);
      }
    }
    for (const noCameoTime of [100, 178]) {
      await seek(page, noCameoTime);
      await expect(student).toBeHidden();
    }
    expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(saved);
    expect(errors, 'personalizing the art must not produce page errors').toEqual([]);
  });
}

for (const { name, hero } of heroSamples) {
  test(`the ${name} working pose follows song time and respects reduced motion`, async ({ page }, testInfo) => {
    await page.addInitScript(({ key, hero }) => localStorage.setItem(key, JSON.stringify(hero)), { key: STORAGE_KEY, hero });
    await page.goto(PLAYER_PATH);
    const student = page.getByTestId('song-student-avatar');
    await expect(student).toHaveAttribute('data-avatar-state', 'saved');
    await page.evaluate(() => window.Timeline.seek(12));
    await expect(student).toBeVisible();
    const firstPose = await studentGeometry(student);
    expect(firstPose.parts['blink-open'][0].opacity, 'the eyes should be open between blinks').toBeGreaterThan(0.9);
    expect(firstPose.parts['blink-closed'][0].opacity, 'closed eyelids should disappear between blinks').toBeLessThan(0.1);
    await page.evaluate(() => window.Timeline.seek(12.7));
    const nextPose = await studentGeometry(student);
    for (const part of ['head', 'arm-left', 'arm-right', 'gaze']) {
      expect(firstPose.parts[part], `${part} should be present on the working character`).not.toEqual([]);
      expect(nextPose.parts[part], `${part} should subtly move while working`).not.toEqual(firstPose.parts[part]);
    }
    await student.screenshot({ path: `/tmp/git-mv-${hero.kind}-${testInfo.project.name}-working.png` });
    await page.evaluate(() => window.Timeline.seek(12.57));
    const blinkPose = await studentGeometry(student);
    expect(blinkPose.parts['blink-closed'][0].opacity, 'the authored eyelids should close during a blink').toBeGreaterThan(0.9);
    expect(blinkPose.parts['blink-open'][0].opacity, 'the open eyes should disappear during a blink').toBeLessThan(0.1);
    await student.screenshot({ path: `/tmp/git-mv-${hero.kind}-${testInfo.project.name}-blink.png` });
    await page.evaluate(() => window.Timeline.seek(15));
    await page.evaluate(() => window.Timeline.seek(12));
    expect(await studentGeometry(student), 'a backward seek should reproduce the same working pose').toEqual(firstPose);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await page.getByRole('checkbox', { name: 'Use lyrics-only mode', exact: true }).uncheck();
    await expect(page.getByTestId('song-picture')).toBeVisible();
    await expect(student).toHaveAttribute('data-avatar-state', 'saved');
    await page.evaluate(() => window.Timeline.seek(12));
    await expect(student).toBeVisible();
    const reducedPose = await studentGeometry(student);
    for (const time of [12.57, 12.7]) {
      await page.evaluate((time) => window.Timeline.seek(time), time);
      expect(await studentGeometry(student), 'opting into the picture with reduced motion should keep the character still').toEqual(reducedPose);
    }
  });
}

test('an unavailable optional hero template leaves normal-speed playback usable', async ({ page }) => {
  await page.addInitScript(({ key, hero }) => localStorage.setItem(key, JSON.stringify(hero)), { key: STORAGE_KEY, hero: humanHero });
  // Fault injection at the asset-loading boundary exercises actual recovery;
  // successful template loading always uses the real repository asset above.
  await page.route('**/assets/se-gym-hero-template.svg*', (route) => route.abort('failed'));
  const templateFailed = page.waitForEvent('requestfailed', (request) => request.url().includes('/assets/se-gym-hero-template.svg'));
  const audio = await openPausedPlayer(page);
  await templateFailed;
  await seek(page, 12);
  await expect(page.getByTestId('song-student-avatar')).toHaveAttribute('data-avatar-state', 'fallback');
  await expect(page.getByTestId('song-student-avatar')).toBeVisible();
  await page.getByRole('button', { name: 'Mute song', exact: true }).click();
  await page.getByRole('button', { name: 'Play song', exact: true }).click();
  await expect.poll(() => audio.evaluate((element) => element.currentTime)).toBeGreaterThan(12.1);
  await expect(audio).toHaveJSProperty('playbackRate', 1);
});

test('saved-avatar loading and celebration rendering preserve the native audio clock under CPU throttling @chromium', async ({ page, context }) => {
  await page.addInitScript(({ key, hero }) => localStorage.setItem(key, JSON.stringify(hero)), { key: STORAGE_KEY, hero: humanHero });
  // Deliver the real optional template after playback starts, so the test
  // covers expensive personalization work occurring while the music plays.
  let deliverTemplate;
  const templateGate = new Promise((resolve) => { deliverTemplate = resolve; });
  await page.route('**/assets/se-gym-hero-template.svg*', async (route) => {
    await templateGate;
    await route.continue();
  });
  const client = await context.newCDPSession(page);
  try {
    await client.send('Emulation.setCPUThrottlingRate', { rate: 8 });
    const audio = await openPausedPlayer(page);
    await seek(page, 12);
    await page.getByRole('button', { name: 'Mute song', exact: true }).click();
    await page.getByRole('button', { name: 'Play song', exact: true }).click();
    await expect.poll(() => audio.evaluate((element) => element.currentTime)).toBeGreaterThan(12.1);
    const before = await audio.evaluate((element) => ({ audio: element.currentTime, wall: performance.now() }));
    deliverTemplate();
    // The optional full avatar template can legitimately take longer than the
    // normal five-second matcher budget at an artificial eightfold slowdown.
    await expect(page.getByTestId('song-student-avatar')).toHaveAttribute('data-avatar-state', 'saved', { timeout: 15000 });
    await expect.poll(() => audio.evaluate((element) => element.currentTime)).toBeGreaterThan(before.audio + 1);
    const after = await audio.evaluate((element) => ({ audio: element.currentTime, wall: performance.now() }));
    expect(Math.abs((after.audio - before.audio) - (after.wall - before.wall) / 1000),
      'the song clock must keep normal wall-clock speed while the saved artwork loads').toBeLessThan(0.5);
    await expect(audio).toHaveJSProperty('playbackRate', 1);

    await page.getByRole('button', { name: 'Pause song', exact: true }).click();
    await seek(page, finalCelebration + 0.5);
    await expect(page.getByTestId('song-student-avatar')).toBeVisible();
    await expect.poll(() => paintedConfetti(page)).not.toEqual([]);
    await page.getByRole('button', { name: 'Play song', exact: true }).click();
    await expect.poll(() => audio.evaluate((element) => element.currentTime)).toBeGreaterThan(finalCelebration + 1);
    await expect(audio).toHaveJSProperty('playbackRate', 1);
  } finally {
    deliverTemplate();
    await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await client.detach();
  }
});

// The shared absolute-time renderer is also an exporter API. These cases let
// engines with unavailable native audio codecs verify artwork independently;
// they intentionally make no claim about playback in that engine.
test('renderer-only: confetti reproduces an absolute pose across backward seeks', async ({ page }) => {
  await page.goto(PLAYER_PATH);
  await expect(page.getByTestId('song-picture')).toBeVisible();
  await page.evaluate((time) => window.Timeline.seek(time), finalCelebration + 0.6);
  await expect.poll(() => paintedConfetti(page)).not.toEqual([]);
  const firstPicture = await paintedConfetti(page);
  await page.evaluate(() => window.Timeline.seek(12));
  await expect.poll(() => paintedConfetti(page)).toEqual([]);
  await page.evaluate((time) => window.Timeline.seek(time), finalCelebration + 0.6);
  await expect.poll(() => paintedConfetti(page)).toEqual(firstPicture);
});

for (const song of songPlayers) {
  for (const { name, hero, skin, hair, suit } of heroSamples) {
    test(`${song.name} renderer-only: the ${name} remains a saved character without workout animation`, async ({ page }, testInfo) => {
      await page.addInitScript(({ key, hero }) => localStorage.setItem(key, JSON.stringify(hero)), { key: STORAGE_KEY, hero });
      await page.goto(song.path);
      const student = page.getByTestId('song-student-avatar');
      await expect(student).toHaveAttribute('data-avatar-state', 'saved');
      await page.evaluate((time) => window.Timeline.seek(time), song.cameoTime);
      const portrait = student.locator('[data-gym-hero-svg]');
      await expect(portrait).toBeVisible();
      await expect(portrait).toHaveAttribute('data-hero-kind', hero.kind);
      await expect(portrait).toHaveCSS('--hero-skin-light', skin);
      await expect(portrait).toHaveCSS('--hero-hair', hair);
      await expect(portrait).toHaveCSS('--hero-suit', suit);
      await expect(portrait.locator('[data-hero-barbell], animate, animateTransform, animateMotion, set')).toHaveCount(0);
      // The laptop prop shows the storyboard's emblem, or the shared mark without one.
      const laptopLogo = song.storyboard.student?.laptop_logo;
      if (laptopLogo) await expect(student.locator('.student-laptop-logo')).toHaveAttribute('href', laptopLogo);
      else await expect(student.locator('.student-laptop-mark')).toBeVisible();
      if (song.name === 'Shell') {
        // The saved avatar remains the same person in every scene.
        for (const time of [28, 101.7, 267, 6]) {
          await page.evaluate((time) => window.Timeline.seek(time), time);
          await expect(portrait).toBeVisible();
          await expect(portrait).toHaveAttribute('data-hero-kind', hero.kind);
        }
      }
      expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(JSON.stringify(hero));
      await page.getByTestId('song-picture').screenshot({ path: `/tmp/${song.name}-mv-${hero.kind}-${testInfo.project.name}-renderer.png` });
      await student.screenshot({ path: `/tmp/${song.name}-mv-${hero.kind}-${testInfo.project.name}-renderer-closeup.png` });
    });
  }

  for (const storage of ['missing', 'malformed', 'blocked']) {
    test(`${song.name}: a ${storage} saved avatar uses the default Bruin without saving it`, async ({ page }, testInfo) => {
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.addInitScript(({ mode, key }) => {
        if (mode === 'malformed') localStorage.setItem(key, '{invalid JSON');
        if (mode === 'blocked') Object.defineProperty(window, 'localStorage', {
          get() { throw new DOMException('Storage disabled by browser policy', 'SecurityError'); },
        });
      }, { mode: storage, key: STORAGE_KEY });
      await page.goto(song.path);
      await expect(page.getByRole('button', { name: 'Play song', exact: true })).toBeEnabled();
      await page.evaluate((time) => window.Timeline.seek(time), song.cameoTime);
      const audio = page.getByLabel(`${song.storyboard.title} audio`, { exact: true });
      const student = page.getByTestId('song-student-avatar');
      await expect(student).toBeVisible();
      const portrait = student.locator('[data-gym-hero-svg]');
      await expect(portrait).toBeVisible();
      await expect(portrait).toHaveAttribute('data-hero-kind', 'bruin');
      await expect(portrait).toHaveCSS('--hero-skin-light', '#8b5a35');
      await expect(portrait).toHaveCSS('--hero-hair', '#3d2818');
      await expect(portrait).toHaveCSS('--hero-suit', '#1F6EBD');
      await expect(portrait.locator('[data-hero-bruin-anatomy="head"]')).toBeVisible();
      if (storage !== 'blocked') {
        expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(storage === 'missing' ? null : '{invalid JSON');
      }
      await student.screenshot({ path: `/tmp/${song.name}-mv-default-bruin-${storage}-${testInfo.project.name}.png` });
      await page.getByRole('button', { name: 'Mute song', exact: true }).click();
      await page.getByRole('button', { name: 'Play song', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Pause song', exact: true })).toBeEnabled();
      await expect.poll(() => audio.evaluate((element) => element.currentTime)).toBeGreaterThan(0.1);
      await expect(audio).toHaveJSProperty('playbackRate', 1);
      expect(errors, 'optional saved data must not break the player').toEqual([]);
    });
  }
}

// Renderer API: screenshots compare two visits to the same time, not a stored
// pixel baseline. This pins reproducible playback without prescribing paths.
// The midnight clock turns over on the sung "came", and the fireworks start with it.
const infoHidingLines = songPlayers.find((song) => song.name === 'Information hiding').storyboard.sections.flatMap((section) => section.lines);
const midnight = infoHidingLines.find((line) => line.id === 'intro-16').marks.came;
const inVerseOne = infoHidingLines.find((line) => line.id === 'verse-1-3').start;

test('information hiding renderer-only: fireworks move and reproduce the same frame after rewinding', async ({ page }, testInfo) => {
  await page.goto('/assets/song-player/every-module-keeps-a-secret.html');
  await expect(page.getByTestId('song-picture')).toBeVisible();
  const celebration = page.getByTestId('song-fireworks').first();
  await page.evaluate((time) => window.Timeline.seek(time), midnight + 0.78);
  await expect(celebration).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const first = await celebration.screenshot({ path: testInfo.outputPath('fireworks-first.png') });
  await page.evaluate((time) => window.Timeline.seek(time), midnight + 1.08);
  expect((await celebration.screenshot()).equals(first), 'sparks must move as the song advances').toBe(false);
  await page.evaluate((time) => window.Timeline.seek(time), inVerseOne);
  await expect(celebration).toBeHidden();
  await page.evaluate((time) => window.Timeline.seek(time), midnight - 0.001);
  await expect(page.locator('.ih-clock-time')).toHaveText('23:59:59');
  await expect(celebration).toBeHidden();
  await page.evaluate((time) => window.Timeline.seek(time), midnight + 0.78);
  await expect(page.locator('.ih-clock-time')).toHaveText('00:00:00');
  const rewound = await celebration.screenshot({ path: testInfo.outputPath('fireworks-rewound.png') });
  // Chromium can dither background gradients by one channel level between
  // otherwise identical captures. Compare decoded pixels, allowing only that
  // rounding difference; displaced sparks or changed colors still fail.
  const maxChannelDifference = await page.evaluate(async (images) => {
    const pixels = await Promise.all(images.map(async (base64) => {
      const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d');
      context.drawImage(bitmap, 0, 0);
      bitmap.close();
      return context.getImageData(0, 0, canvas.width, canvas.height).data;
    }));
    if (pixels[0].length !== pixels[1].length) return Infinity;
    let maximum = 0;
    for (let i = 0; i < pixels[0].length; i++) maximum = Math.max(maximum, Math.abs(pixels[0][i] - pixels[1][i]));
    return maximum;
  }, [first.toString('base64'), rewound.toString('base64')]);
  expect(maxChannelDifference, 'rewinding must reproduce the same fireworks').toBeLessThanOrEqual(1);
});

test('information hiding renderer-only: decorative fireworks respect reduced motion', async ({ page }) => {
  await page.goto('/assets/song-player/every-module-keeps-a-secret.html');
  await expect(page.getByTestId('song-picture')).toBeVisible();
  await page.evaluate((time) => window.Timeline.seek(time), midnight + 0.78);
  const celebration = page.getByTestId('song-fireworks').first();
  await expect(celebration).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(celebration).toBeHidden();
});

async function tddBodyGeometry(page, time) {
  return page.evaluate(time => {
    window.Timeline.seek(time);
    return Array.from(document.querySelectorAll('.tdd-lamp-glass, .tdd-page, .tdd-glove, .tdd-shoe, .tdd-slipper'), node => {
      const box = node.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    });
  }, time);
}

test('TDD renderer-only: the opening couple stands still without a rhythmic pulse', async ({ page }) => {
  await page.goto('/assets/song-player/red-green-refactor.html');
  await expect(page.getByTestId('song-picture')).toBeVisible();
  const still = await tddBodyGeometry(page, 1.2);
  expect(still.length).toBeGreaterThan(2);
  for (const time of [1.5, 2.1, 3.4, 5.0]) expect(await tddBodyGeometry(page, time)).toEqual(still);
});

test('TDD renderer-only: the final ballroom pose holds steady and survives rewinding', async ({ page }) => {
  await page.goto('/assets/song-player/red-green-refactor.html');
  await expect(page.getByTestId('song-picture')).toBeVisible();
  const finish = await tddBodyGeometry(page, 343);
  expect(finish.length).toBeGreaterThan(2);
  for (const time of [344, 345.5]) expect(await tddBodyGeometry(page, time)).toEqual(finish);
  await tddBodyGeometry(page, 5);
  expect(await tddBodyGeometry(page, 343)).toEqual(finish);
});

test('TDD renderer-only: Code alternates grounded steps instead of floating', async ({ page }) => {
  await page.goto('/assets/song-player/red-green-refactor.html');
  await expect(page.getByTestId('song-picture')).toBeVisible();
  const samples = await page.evaluate(() => {
    // The couple's picture joins the stage as they enter, after the title.
    window.Timeline.seek(26);
    const dancer = document.querySelector('.tdd-dancer--code');
    return Array.from({ length: 40 }, (_, i) => {
      window.Timeline.seek(26 + i * 0.05);
      return Array.from(dancer.querySelectorAll('.tdd-slipper'), shoe => {
        const point = new DOMPoint(shoe.cx.baseVal.value, shoe.cy.baseVal.value);
        return point.matrixTransform(dancer.getScreenCTM().inverse().multiply(shoe.getScreenCTM())).y;
      });
    });
  });
  for (const sample of samples) {
    expect(sample).toHaveLength(2);
    // At least one supporting foot remains at its resting height.
    expect(Math.max(...sample)).toBeCloseTo(-3, 1);
  }
  for (const side of [0, 1]) expect(Math.min(...samples.map(sample => sample[side]))).toBeLessThan(-5);
});

test('TDD renderer-only: comparison verdicts leave the run labels clear', async ({ page }) => {
  await page.goto('/assets/song-player/red-green-refactor.html');
  await expect(page.getByTestId('song-picture')).toBeVisible();
  await page.evaluate(() => window.Timeline.seek(84.5));
  const verdict = await page.getByText('Trusted', { exact: true }).boundingBox();
  expect(verdict).not.toBeNull();
  for (const text of ['code written', 'never red', 'Green from the start']) {
    const label = await page.getByText(text, { exact: true }).boundingBox();
    expect(label).not.toBeNull();
    const overlapWidth = Math.min(verdict.x + verdict.width, label.x + label.width) - Math.max(verdict.x, label.x);
    const overlapHeight = Math.min(verdict.y + verdict.height, label.y + label.height) - Math.max(verdict.y, label.y);
    expect(overlapWidth <= 0 || overlapHeight <= 0, `Trusted must not cover ${text}`).toBe(true);
  }
});

test('TDD renderer-only: Code starts each cycle happy after the preceding scene', async ({ page }) => {
  await page.goto('/assets/song-player/red-green-refactor.html');
  await expect(page.getByTestId('song-picture')).toBeVisible();
  const mouth = page.locator('.tdd-dancer--code .tdd-mouth');
  await page.evaluate(() => window.Timeline.seek(1.2));
  const happy = await mouth.getAttribute('d');
  for (const time of [88.8, 153.4, 294.2]) {
    await page.evaluate(t => window.Timeline.seek(t), time);
    await expect(mouth).toHaveAttribute('d', happy);
  }
});

test('TDD renderer-only: the fresh-stack caption stays clear of pushed and popped values', async ({ page }) => {
  await page.goto('/assets/song-player/red-green-refactor.html');
  await expect(page.getByTestId('song-picture')).toBeVisible();
  const caption = page.getByText('a fresh stack', { exact: true });
  const value = page.locator('.tdd-stack').filter({ has: caption }).locator('.tdd-block');
  for (const time of [171.08, 171.2, 171.46, 173.7, 173.9, 174.1, 174.3, 178.5]) {
    await page.evaluate(t => window.Timeline.seek(t), time);
    const a = await caption.boundingBox();
    const b = await value.boundingBox();
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
    const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
    expect(overlapX <= 0 || overlapY <= 0, `caption must clear the value at ${time}s`).toBe(true);
  }
});

test('TDD renderer-only: regression score names fit their measures', async ({ page }) => {
  await page.goto('/assets/song-player/red-green-refactor.html');
  await expect(page.getByTestId('song-picture')).toBeVisible();
  await page.evaluate(() => window.Timeline.seek(240));
  const labels = page.locator('.tdd-staff-label');
  await expect(labels).toHaveCount(4);
  await expect(labels.first()).toBeVisible();
  for (const label of await labels.all()) {
    const overflow = await label.evaluate(node => node.scrollWidth - node.clientWidth);
    expect(overflow, await label.innerText()).toBeLessThanOrEqual(1);
  }
});

for (const [skin, hair, darkHair, darkSkin] of [
  ['#f8dfcf', '#ead08a', false, false],
  ['#291713', '#140b08', true, true],
  ['#bb8175', '#66418c', true, false],
]) {
  test(`TDD Code inherits the saved human skin ${skin} across scenes and themes`, async ({ page }) => {
    const saved = JSON.stringify({ ...humanHero, appearance: { ...humanHero.appearance, skin, hairColor: hair } });
    await page.addInitScript(({ key, saved }) => localStorage.setItem(key, saved), { key: STORAGE_KEY, saved });
    await page.goto('/assets/song-player/red-green-refactor.html');
    await expect(page.getByTestId('song-picture')).toBeVisible();
    const rgb = `rgb(${skin.slice(1).match(/../g).map((part) => parseInt(part, 16)).join(', ')})`;
    for (const dark of [false, true]) {
      await page.evaluate((dark) => document.documentElement.classList.toggle('dark-mode', dark), dark);
      for (const time of [2, 120, 343]) {
        await tddBodyGeometry(page, time);
        await expect(page.locator('.tdd-page-grad .tdd-stop--bottom')).toHaveCSS('stop-color', rgb);
        for (const part of ['.tdd-paper', '.tdd-arm--code .tdd-arm-fore', '.tdd-code-shin']) {
          for (const node of await page.locator(part).all()) await expect(node).toHaveCSS('fill', rgb);
        }
        const hairRgb = `rgb(${hair.slice(1).match(/../g).map((part) => parseInt(part, 16)).join(', ')})`;
        for (const brace of await page.locator('.tdd-brace').all()) await expect(brace).toHaveCSS('stroke', hairRgb);
        for (const rim of await page.locator('.tdd-brace-rim').all()) {
          await expect(rim).toHaveCSS('stroke', darkHair ? 'rgb(255, 241, 217)' : 'none');
        }
        // Four arm segments, the neck, and the two ankles use an independent outer rim.
        await expect(page.locator('.tdd-skin-rim')).toHaveCount(7);
        for (const rim of await page.locator('.tdd-skin-rim').all()) {
          await expect(rim).toHaveCSS('stroke', darkSkin ? 'rgb(255, 241, 217)' : 'none');
        }
        const shading = await page.locator('.tdd-dancer--code').evaluate((arm) => {
          const rgb = (color) => color.match(/\d+/g).map(Number);
          const brightness = (color) => rgb(color).reduce((sum, channel) => sum + channel, 0);
          const base = getComputedStyle(arm.querySelector('.tdd-arm-fore')).fill;
          const shadow = getComputedStyle(arm.querySelector('.tdd-arm-fore')).stroke;
          const highlight = getComputedStyle(arm.querySelector('.tdd-arm-shine')).stroke;
          return { base: brightness(base), shadow: brightness(shadow), highlight: brightness(highlight), shadowRgb: rgb(shadow) };
        });
        expect(shading.shadow).toBeLessThan(shading.base);
        expect(shading.highlight).toBeGreaterThan(shading.base);
        // The shadow stays proportional to each chosen skin channel instead of purple.
        const baseChannels = skin.slice(1).match(/../g).map((part) => parseInt(part, 16));
        const ratios = shading.shadowRgb.map((channel, i) => channel / baseChannels[i]);
        expect(Math.max(...ratios) - Math.min(...ratios)).toBeLessThan(0.06);
        await expect(page.locator('.tdd-code-bar--id').first()).toHaveCSS('fill', 'rgb(231, 224, 255)');
        const contrast = await page.locator('.tdd-dancer--code .tdd-eye').first().evaluate((eye, skin) => {
          const ink = getComputedStyle(eye).fill.match(/\d+/g).map(Number);
          const hex = '#' + ink.map((n) => n.toString(16).padStart(2, '0')).join('');
          return window.HeroAvatar.contrastRatio(skin, hex);
        }, skin);
        expect(contrast).toBeGreaterThanOrEqual(3);
      }
    }
    expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(saved);
    await page.getByTestId('song-picture').screenshot({ path: `/tmp/tdd-code-skin-${skin.slice(1)}.png` });
  });
}

for (const [name, saved] of [['unsaved', null], ['Bruin', JSON.stringify(bruinHero)], ['Prof', JSON.stringify({ ...humanHero, kind: 'tobias' })], ['invalid', '{broken']]) {
  test(`TDD Code keeps her original palette with ${name} avatar data`, async ({ page }) => {
    await page.addInitScript(({ key, saved }) => {
      if (saved === null) localStorage.removeItem(key);
      else localStorage.setItem(key, saved);
    }, { key: STORAGE_KEY, saved });
    await page.goto('/assets/song-player/red-green-refactor.html');
    await expect(page.getByTestId('song-student-avatar')).toHaveAttribute('data-avatar-state', /saved|default/);
    await tddBodyGeometry(page, 2);
    await expect(page.locator('.tdd-page-grad .tdd-stop--bottom')).toHaveCSS('stop-color', 'rgb(221, 213, 251)');
    await expect(page.locator('.tdd-paper')).toHaveCSS('fill', 'rgb(231, 224, 255)');
    await expect(page.locator('.tdd-brace').first()).toHaveCSS('stroke', 'rgb(242, 193, 78)');
    await expect(page.locator('.tdd-brace-rim').first()).toHaveCSS('stroke', 'none');
    await expect(page.locator('.tdd-skin-rim').first()).toHaveCSS('stroke', 'none');
    expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(saved);
  });
}

test('TDD Code remains usable when avatar storage is denied', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      if (key === 'se-gym-hero-avatar') throw new DOMException('Storage denied', 'SecurityError');
      return getItem.call(this, key);
    };
  });
  await page.goto('/assets/song-player/red-green-refactor.html');
  await expect(page.getByTestId('song-student-avatar')).toHaveAttribute('data-avatar-state', 'default');
  await tddBodyGeometry(page, 120);
  await expect(page.locator('.tdd-page-grad .tdd-stop--bottom')).toHaveCSS('stop-color', 'rgb(221, 213, 251)');
  await expect(page.getByRole('button', { name: 'Play song', exact: true })).toBeEnabled();
  expect(errors).toEqual([]);
});

test('TDD renderer-only: the bug travels wholly through the open test-fence gap', async ({ page }) => {
  await page.goto('/assets/song-player/red-green-refactor.html');
  await expect(page.getByTestId('song-picture')).toBeVisible();
  const pose = (time) => page.evaluate((time) => {
    window.Timeline.seek(time);
    const fence = document.querySelector('.tdd-fence');
    const pickets = [...fence.querySelectorAll('.tdd-picket')];
    const rect = (node) => {
      const { x, y, width, height } = node.getBoundingClientRect();
      return { x, y, right: x + width, bottom: y + height, width, height };
    };
    const gap = pickets.findIndex((node) => node.classList.contains('tdd-picket--new'));
    return {
      bug: rect(fence.querySelector('.tdd-bug svg')),
      opacity: Number(getComputedStyle(fence.querySelector('.tdd-bug')).opacity),
      left: rect(pickets[gap - 1]), right: rect(pickets[gap + 1]),
      rails: [...fence.querySelectorAll('.tdd-fence-rail')].map(rect),
    };
  }, time);
  const entry = await pose(228.81);
  expect(entry.bug.bottom).toBeLessThan(entry.left.y);
  for (const time of [228.9, 229, 229.1, 229.2, 229.3, 229.4, 229.5, 229.6, 229.7]) {
    const { bug, left, right, rails, opacity } = await pose(time);
    if (time >= 229) expect(opacity).toBe(1);
    expect(bug.x).toBeGreaterThan(left.right);
    expect(bug.right).toBeLessThan(right.x);
    expect(Math.abs((bug.x + bug.right) / 2 - (left.right + right.x) / 2)).toBeLessThan(1);
    for (const rail of rails) {
      expect(rail.right <= bug.x || rail.x >= bug.right, 'the rail must leave the passage open').toBe(true);
    }
  }
  const exit = await pose(229.7);
  expect(exit.bug.y).toBeGreaterThan(exit.left.bottom);
  expect(await pose(228.81)).toEqual(entry);
});

/**
 * Each flow arrow's own opacity, in authored order. Scenes that are out of
 * the document while transparent go back in place just long enough to be read.
 */
async function flowArrowOpacities(page) {
  return page.evaluate(() => {
    const stage = document.getElementById('stage');
    const culled = window.SongScene.culledPictures(stage);
    for (const { node, placeholder } of culled) placeholder.replaceWith(node);
    try {
      return Array.from(stage.querySelectorAll('.flow'), arrow => getComputedStyle(arrow).opacity);
    } finally {
      for (const { node, placeholder } of culled) node.replaceWith(placeholder);
    }
  });
}

test('TDD renderer-only: flow arrows do not leak tips before their cues or after rewind', async ({ page }) => {
  await page.goto('/assets/song-player/red-green-refactor.html');
  await expect(page.getByTestId('song-picture')).toBeVisible();
  const song = songPlayers.find(song => song.name === 'Test-driven development').storyboard;
  const cues = new Map(song.sections.flatMap(section => section.lines).map(line => [line.id, line]));
  const entrances = [
    cues.get('verse-1-4').marks.callers,
    cues.get('bridge-1').marks.check,
    cues.get('bridge-3').marks.parts,
    cues.get('bridge-5').marks.whole,
  ];
  expect(await flowArrowOpacities(page)).toHaveLength(entrances.length);
  for (const [index, at] of entrances.entries()) {
    for (const [time, opacity] of [[at - 0.1, '0'], [at + 0.4, '1'], [346, '0'], [at + 0.4, '1'], [0, '0']]) {
      await page.evaluate(time => window.Timeline.seek(time), time);
      // The first arrow belongs to a scene that handles its exit as a whole.
      if (index === 0 && time === 346) continue;
      expect((await flowArrowOpacities(page))[index], `arrow ${index} at ${time}s`).toBe(opacity);
    }
  }
});

const alwaysCode = yaml.load(fs.readFileSync(path.join(__dirname, '..', '_data/songs/always_code.yml'), 'utf8'));
const alwaysCodeLines = alwaysCode.sections.flatMap(section => section.lines);

test('Always Code: each lyric makes a hard scene cut, including after rewind', async ({ page }) => {
  await page.goto('/assets/song-player/always-code.html');
  await expect(page.getByTestId('song-picture')).toBeVisible();
  const scenes = page.locator('.ac-concept-scene');
  const visible = scenes.filter({ visible: true });
  const concepts = ['hello, code!', 'shell', 'pull request', 'before merging', 'changed',
    'explain the change', 'parse', 'normal', 'Client', 'same interface', 'public interface', 'before'];
  const indices = [...alwaysCodeLines.keys()];
  for (const index of [...indices, ...indices.slice().reverse()]) {
    const start = alwaysCodeLines[index].start;
    if (index > 0) {
      await page.evaluate(time => window.Timeline.seek(time), start - 0.001);
      await expect(visible).toHaveCount(1);
      await expect(visible).toContainText(concepts[index - 1]);
    }
    await page.evaluate(time => window.Timeline.seek(time), start);
    await expect(visible).toHaveCount(1);
    await expect(visible).toContainText(concepts[index]);
    await expect(page.locator('.ac-lyric').filter({ visible: true }).locator('.ac-word')).toHaveText(alwaysCodeLines[index].text.split(' '));
  }
});

test('Always Code: the system view reveals sequence calls and returns in order', async ({ page }) => {
  await page.goto('/assets/song-player/always-code.html');
  await expect(page.getByTestId('song-picture')).toBeVisible();
  const start = alwaysCodeLines[8].start;
  const visibleMessages = page.locator('.ac-sequence-message').filter({ visible: true });
  for (const [elapsed, expected] of [
    [0, ['request()']],
    [0.6, ['request()', 'load()']],
    [1.1, ['request()', 'load()', 'data']],
    [1.6, ['request()', 'load()', 'data', 'result']],
    [0, ['request()']],
  ]) {
    await page.evaluate(time => window.Timeline.seek(time), start + elapsed);
    await expect(visibleMessages).toHaveText(expected);
  }
  await page.evaluate(time => window.Timeline.seek(time), alwaysCodeLines[9].start);
  // WebKit retains a nested SVG's nonzero box under display:none. The enclosing
  // scene controls whether it is painted (also verified by the hard-cut test).
  await expect(page.locator('.ac-concept-scene').filter({ has: page.locator('.ac-sequence') })).toBeHidden();
});
