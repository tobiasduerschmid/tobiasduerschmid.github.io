// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const PLAYER = '/assets/song-player/every-module-keeps-a-secret.html';

// Times come from the storyboard's sung words, so a re-recorded take moves
// the checks with the choreography instead of silently testing other scenes.
const storyboard = yaml.load(fs.readFileSync(path.join(__dirname, '..', '_data/songs/every_module_keeps_a_secret.yml'), 'utf8'));
const storyLines = new Map(storyboard.sections.flatMap((section) => section.lines).map((line) => [line.id, line]));
const lineStart = (id) => storyLines.get(id).start;
const mark = (id, word) => storyLines.get(id).marks[word];
// The iceberg swaps gears for the submarine on "freely"; the plant becomes
// wind 0.1 s before "wind" and cross-fades for 0.6 s.
const beforeSwap = mark('verse-3-4', 'promise');
const afterSwap = mark('verse-3-5', 'same');
const windAt = mark('verse-3-11', 'wind') - 0.1;
const elsewhere = lineStart('bridge-4');

// These are renderer tests: Timeline.seek is the public deterministic-frame
// API used by both the live player and exporter. Artwork has no interactive
// role; the stable test IDs name the visual parts whose behavior is taught.
async function seek(page, seconds) {
  await page.evaluate(time => window.Timeline.seek(time), seconds);
}

// Compare two rendered states in the same browser rather than pinning an
// illustrator's particular paths or storing platform-dependent PNG baselines.
async function paintedGeometry(locator) {
  return locator.evaluate(root => {
    const round = value => Math.round(value * 1000) / 1000;
    const painted = node => {
      for (let ancestor = node; ancestor; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      }
      return true;
    };
    return [root, ...root.querySelectorAll('*')]
      .filter(node => node instanceof SVGGraphicsElement && painted(node))
      .map(node => {
        const bounds = node.getBoundingClientRect();
        const matrix = node.getCTM();
        const style = getComputedStyle(node);
        return {
          bounds: [bounds.x, bounds.y, bounds.width, bounds.height].map(round),
          transform: matrix ? [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f].map(round) : [],
          fill: style.fill,
          stroke: style.stroke,
          strokeDashoffset: style.strokeDashoffset,
          opacity: style.opacity,
          length: node instanceof SVGGeometryElement ? round(node.getTotalLength()) : null,
          text: node instanceof SVGTextElement ? node.textContent : null,
        };
      });
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto(PLAYER);
  await expect(page.getByRole('button', { name: 'Play song', exact: true })).toBeEnabled();
  await expect(page.getByTestId('song-picture')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
});

async function showReducedMotionVideo(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // The accessible default is lyrics-only. A viewer may explicitly choose
  // the illustration while retaining the OS request to reduce motion.
  const lyricsOnly = page.getByRole('checkbox', { name: 'Use lyrics-only mode' });
  await expect(lyricsOnly).toBeChecked();
  await lyricsOnly.uncheck();
  await expect(page.getByTestId('song-picture')).toBeVisible();
  await expect(page.getByTestId('ih-iceberg')).toBeAttached();
}

test('iceberg keeps its public interface while its hidden implementation changes', async ({ page }) => {
  // Freeze decorative rotation so the difference must be the implementation
  // change, not merely another position in an idle gear animation.
  await showReducedMotionVideo(page);
  const tip = page.getByTestId('ih-iceberg-tip');
  const internals = page.getByTestId('ih-iceberg-mechanism');
  const submarine = page.getByTestId('ih-iceberg-submarine');
  const promise = page.getByText('Stays the same', { exact: true });

  await seek(page, beforeSwap);
  await expect(promise).toBeVisible();
  const beforeTip = await paintedGeometry(tip);
  const beforeInternals = await paintedGeometry(internals);
  expect(beforeTip.length, 'the interface must actually be painted').toBeGreaterThan(0);
  expect(beforeInternals.length, 'the original gear implementation must be painted').toBeGreaterThan(0);
  expect(await paintedGeometry(submarine), 'the replacement submarine must be hidden before the swap').toEqual([]);

  await seek(page, afterSwap);
  await expect(promise).toBeVisible();
  expect(await paintedGeometry(tip), 'changing the hidden implementation must leave the exposed tip unchanged').toEqual(beforeTip);
  expect(await paintedGeometry(internals), 'a different implementation must be visible below the water').not.toEqual(beforeInternals);
  expect((await paintedGeometry(submarine)).length, 'the submarine must replace the gears below the unchanged interface').toBeGreaterThan(0);
});

test('phone keeps charging through the switch from solar to wind', async ({ page }) => {
  const outlet = page.getByTestId('ih-power-outlet');
  const battery = page.getByTestId('ih-power-battery');
  const source = page.getByTestId('ih-power-source');

  await seek(page, windAt - 1.3);
  expect((await paintedGeometry(source.filter({ hasText: 'Solar' }))).length, 'solar must supply the initial scene').toBeGreaterThan(0);
  expect(await paintedGeometry(source.filter({ hasText: 'Wind' })), 'wind must not be painted before the switch').toEqual([]);
  const beforeOutlet = await paintedGeometry(outlet);
  expect(beforeOutlet.length, 'the outlet must actually be painted').toBeGreaterThan(0);
  const batteryLevels = [];
  // Sample before, during, and after the source cross-fade: an earlier
  // absolute-time animation reset the battery mid-scene, incorrectly
  // suggesting that changing the source failed.
  for (const time of [windAt - 0.3, windAt + 0.1, windAt + 0.3, windAt + 0.6, windAt + 1.7]) {
    await seek(page, time);
    const box = await battery.boundingBox();
    expect(box, `battery must be visible at ${time}s`).not.toBeNull();
    batteryLevels.push(box.height);
  }
  for (let index = 1; index < batteryLevels.length; index++) {
    expect(batteryLevels[index], 'charge must never fall during the source transition').toBeGreaterThanOrEqual(batteryLevels[index - 1]);
  }
  expect(batteryLevels.at(-1), 'charging should make visible progress').toBeGreaterThan(batteryLevels[0]);
  expect(await paintedGeometry(outlet), 'the same outlet must serve both sources').toEqual(beforeOutlet);
  expect(await paintedGeometry(source.filter({ hasText: 'Solar' })), 'solar must give way to wind').toEqual([]);
  expect((await paintedGeometry(source.filter({ hasText: 'Wind' }))).length, 'wind must supply the later scene').toBeGreaterThan(0);
});

for (const scene of [
  { name: 'iceberg', testId: 'ih-iceberg', time: mark('verse-3-7', 'cache') },
  { name: 'power plant', testId: 'ih-power-scene', time: windAt + 1.7 },
]) {
  test(`${scene.name} reproduces the same illustration after seeking away and back`, async ({ page }) => {
    const illustration = page.getByTestId(scene.testId);
    await seek(page, scene.time);
    const before = await paintedGeometry(illustration);
    expect(before.length, 'the illustration must actually be painted').toBeGreaterThan(0);
    await seek(page, elsewhere);
    await seek(page, scene.time);
    expect(await paintedGeometry(illustration)).toEqual(before);
  });
}

test('reduced motion freezes decorative motion while keeping the source change understandable', async ({ page }) => {
  await showReducedMotionVideo(page);
  const iceberg = page.getByTestId('ih-iceberg');
  await seek(page, lineStart('verse-3-4'));
  const stillIceberg = await paintedGeometry(iceberg);
  await seek(page, beforeSwap);
  expect(await paintedGeometry(iceberg), 'water and gears must stop their decorative motion').toEqual(stillIceberg);

  const power = page.getByTestId('ih-power-scene');
  await seek(page, windAt - 1.3);
  const solar = await paintedGeometry(power);
  await seek(page, windAt + 1.7);
  const wind = await paintedGeometry(power);
  expect(wind, 'the essential solar-to-wind change must remain visible').not.toEqual(solar);
  await seek(page, windAt + 2.7);
  expect(await paintedGeometry(power), 'wind rotors and energy dashes must stop their decorative motion').toEqual(wind);
});

// ------------------------------------------------------------------
// Agent 00 wears the viewer's saved SE Gym face
// ------------------------------------------------------------------

const STORAGE_KEY = 'se-gym-hero-avatar';
// A descriptor as the SE Gym saves it, with traits a default face lacks. The
// pendant is body-bound, so it must stay off a head worn neck up.
const savedHuman = {
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
    accessory: 'round-rim-glasses', accessories: ['round-rim-glasses', 'chain-necklace'], emblem: '',
  },
};
// Agent 00's scenes: the Y2K cameo, the case-file cameo and the finale
// (both once laptop cameos), the caper's toast, and verse 2's gateway.
const agentTimes = [
  mark('intro-6', 'zero') + 0.6,
  mark('intro-19', 'secret') + 0.9,
  lineStart('verse-1-1') - 1.2,
  mark('verse-2-8', 'gateway_2') + 0.5,
  lineStart('outro-3') + 1.2,
];
// The finale: he steps in, raises his martini on "change", then winks.
const finale = lineStart('outro-3') + 0.4;
const toast = mark('outro-3', 'change');

/** Reloads the player with `setup` running before any page script. */
async function reopenWith(page, setup, arg) {
  await page.addInitScript(setup, arg);
  await page.reload();
  await expect(page.getByTestId('song-picture')).toBeVisible();
}

const luminance = (hex) => [0.2126, 0.7152, 0.0722]
  .reduce((sum, weight, i) => sum + weight * parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16), 0);

/** The picture's mean luminance (0–255) in a 2×2 px square centred on (x, y). */
async function paintedLuminance(page, { x, y }) {
  const png = await page.screenshot({ clip: { x: x - 1, y: y - 1, width: 2, height: 2 } });
  return page.evaluate(async (base64) => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0);
    const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    return sum / (data.length / 4);
  }, png.toString('base64'));
}

/** The Agent 00 on stage: painted, not faded out with an earlier scene. */
async function agentOnStage(page) {
  const agents = page.getByTestId('ih-agent');
  const painted = await agents.evaluateAll((nodes) => nodes.map((node) => {
    for (let ancestor = node; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    }
    return true;
  }));
  expect(painted.filter(Boolean), 'exactly one Agent 00 is on stage').toHaveLength(1);
  return agents.nth(painted.indexOf(true));
}

/**
 * Whether each eye of the visible worn face (picture left to right) is
 * shut: the painted centre of its iris shows nearer the saved skin's
 * lightness than the dark iris's.
 */
async function shutEyes(page, { skin, iris }) {
  await page.getByTestId('song-picture').scrollIntoViewIfNeeded();
  const centres = await page.getByTestId('song-hero-head').filter({ visible: true })
    .locator('[data-hero-slot="eye-shape"] circle[fill*="--hero-eye"]')
    .evaluateAll((irises) => irises.map((node) => node.getBoundingClientRect())
      .filter((box) => box.width > 0)
      .map((box) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 }))
      .sort((a, b) => a.x - b.x));
  expect(centres, 'the worn face shows two eyes').toHaveLength(2);
  const threshold = (luminance(skin) + luminance(iris)) / 2;
  const shut = [];
  for (const centre of centres) shut.push(await paintedLuminance(page, centre) > threshold);
  return shut;
}

for (const sample of [
  // Very dark skin: a hairline bright halo keeps the face and hands readable.
  { name: 'human hero', hero: savedHuman, skin: '#35241f', hand: 'rgb(53, 36, 31)', traits: ['[data-hero-slot="hair"][data-hero-option="locs"]', '[data-hero-slot="accessory"][data-hero-option="round-rim-glasses"]'], halo: true },
  // Prof is the Gym's fixed portrait, whatever editable traits were saved.
  { name: 'Prof', hero: { ...savedHuman, kind: 'tobias' }, skin: '#edbea5', hand: 'rgb(237, 190, 165)', traits: ['[data-hero-tobias="portrait"]'], halo: false },
]) {
  test(`every Agent 00 wears the saved ${sample.name}'s own face, neck up, with matching hands`, async ({ page }) => {
    const saved = JSON.stringify(sample.hero);
    await reopenWith(page, ({ key, value }) => localStorage.setItem(key, value), { key: STORAGE_KEY, value: saved });
    const heads = page.getByTestId('song-hero-head');
    await expect(heads, 'each Agent 00 wears his own copy').toHaveCount(await page.getByTestId('ih-agent').count());
    for (const time of agentTimes) {
      await seek(page, time);
      const agent = await agentOnStage(page);
      const face = agent.getByTestId('song-hero-head');
      await expect(face, `Agent 00 at ${time}s wears the saved face`).toBeVisible();
      await expect(face).toHaveAttribute('data-hero-kind', sample.hero.kind);
      await expect(face).toHaveCSS('--hero-skin-light', sample.skin);
      for (const trait of sample.traits) await expect(face.locator(trait), `the saved ${trait}`).toBeVisible();
      await expect(agent.getByTestId('ih-agent-drawn-face')).toBeHidden();
      const handTones = await agent.getByTestId('ih-agent-hand').first().evaluate((hand) => {
        const gradient = document.getElementById(getComputedStyle(hand).fill.match(/#([^"')]+)/)?.[1]);
        return gradient ? Array.from(gradient.querySelectorAll('stop'), (stop) => getComputedStyle(stop).stopColor) : [];
      });
      expect(handTones, 'his hands are shaded in the saved skin tone').toContain(sample.hand);
      await expect(face.locator('xpath=..'), 'the halo marks only very dark skin or hair').toHaveCSS('filter', sample.halo ? /^url\(/ : 'none');
    }
    await expect(heads.locator('[data-hero-slot="outfit-style"], [data-hero-human-arms], [data-hero-barbell], [data-hero-option="chain-necklace"]').filter({ visible: true }),
      'only the head and neck are worn').toHaveCount(0);
    await expect(heads.locator('animate, animateTransform, animateMotion, set'), 'the song clock drives the face').toHaveCount(0);
    const sharedIds = await heads.evaluateAll((copies) => {
      const seen = new Set();
      return copies.flatMap((copy) => [...copy.querySelectorAll('[id]')].map((node) => node.id))
        .filter((id) => seen.has(id) || !seen.add(id));
    });
    expect(sharedIds, 'hiding one scene must never break another copy\'s clips and paints').toEqual([]);
    expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY), 'the song never changes the Gym hero').toBe(saved);
  });
}

for (const { name, setup, arg } of [
  { name: 'no saved hero', setup: () => {} },
  {
    name: 'a saved Bruin',
    setup: ({ key, value }) => localStorage.setItem(key, value),
    arg: {
      key: STORAGE_KEY,
      value: JSON.stringify({
        ...savedHuman, kind: 'bruin',
        appearance: { ...savedHuman.appearance, skin: '#512d22', hairStyle: 'bald', hairColor: '#3d2818' },
        outfit: { ...savedHuman.outfit, style: 'super-suit', accessory: 'none', accessories: [] },
      }),
    },
  },
  {
    name: 'blocked storage',
    setup: () => Object.defineProperty(window, 'localStorage', {
      get() { throw new DOMException('Storage disabled by browser policy', 'SecurityError'); },
    }),
  },
]) {
  test(`with ${name}, Agent 00 wears the SE Gym's default human face`, async ({ page }) => {
    await reopenWith(page, setup, arg);
    const before = await page.evaluate((key) => { try { return localStorage.getItem(key); } catch { return 'blocked'; } }, STORAGE_KEY);
    const heads = page.getByTestId('song-hero-head');
    await expect(heads, 'each Agent 00 wears his own copy').toHaveCount(await page.getByTestId('ih-agent').count());
    const defaultSkin = await page.evaluate(() => window.HeroAvatar.DEFAULTS.appearance.skin);
    for (const time of [agentTimes[0], agentTimes.at(-1)]) {
      await seek(page, time);
      const agent = await agentOnStage(page);
      const face = agent.getByTestId('song-hero-head');
      await expect(face, `Agent 00 at ${time}s wears the default face`).toBeVisible();
      await expect(face).toHaveAttribute('data-hero-kind', 'human');
      await expect(face).toHaveCSS('--hero-skin-light', defaultSkin);
      await expect(agent.getByTestId('ih-agent-drawn-face')).toBeHidden();
    }
    expect(await page.evaluate((key) => { try { return localStorage.getItem(key); } catch { return 'blocked'; } }, STORAGE_KEY),
      'the default face is never saved as the viewer\'s hero').toBe(before);
  });
}

test('without the SE Gym renderer, Agent 00 keeps a drawn face', async ({ page }) => {
  // The hero artwork never arrives: the song stays whole, with the drawn face.
  const failed = page.waitForEvent('requestfailed', (request) => request.url().includes('se-gym-hero-template.svg'));
  await page.route('**/se-gym-hero-template.svg', (route) => route.abort());
  await page.reload();
  await expect(page.getByTestId('song-picture')).toBeVisible();
  await failed;
  for (const time of [agentTimes[0], agentTimes.at(-1)]) {
    await seek(page, time);
    await expect((await agentOnStage(page)).getByTestId('ih-agent-drawn-face')).toBeVisible();
  }
  await expect(page.getByTestId('song-hero-head')).toHaveCount(0);
});

test('a saved beard falls over Agent 00\'s bow tie', async ({ page }) => {
  // A long, light beard on a bald head: where it hangs over the bow tie,
  // the picture shows the beard, not the black tie.
  const bearded = {
    ...savedHuman,
    appearance: { ...savedHuman.appearance, hairStyle: 'bald', facialHair: 'long-rounded-beard', facialHairColor: '#d8b074' },
    outfit: { ...savedHuman.outfit, accessory: 'none', accessories: [] },
  };
  await reopenWith(page, ({ key, value }) => localStorage.setItem(key, value), { key: STORAGE_KEY, value: JSON.stringify(bearded) });
  await expect(page.getByTestId('song-hero-head').first()).toBeAttached();
  await seek(page, finale + 0.6);
  const agent = await agentOnStage(page);
  await page.getByTestId('song-picture').scrollIntoViewIfNeeded();
  const tie = await agent.getByTestId('ih-agent-bow-tie').boundingBox();
  const centre = { x: tie.x + tie.width / 2, y: tie.y + tie.height / 2 };
  expect(await paintedLuminance(page, centre), 'the beard covers the knot').toBeGreaterThan((luminance('#d8b074') + luminance('#0b0d14')) / 2);
});

// Light skin and dark eyes, so open and shut eyes differ clearly in the picture.
const lightSkinned = {
  ...savedHuman,
  appearance: { ...savedHuman.appearance, skin: '#f4d0c4', eyeColor: '#1f140c', hairStyle: 'short' },
  outfit: { ...savedHuman.outfit, accessory: 'none', accessories: [] },
};
const lightEyes = { skin: '#f4d0c4', iris: '#1f140c' };
// A worn face blinks 2.4 s into each appearance (student-avatar.js blinkAt).
const finaleBlink = finale + 2.48;

test('the worn face winks and blinks on the song clock', async ({ page }) => {
  await reopenWith(page, ({ key, value }) => localStorage.setItem(key, value), { key: STORAGE_KEY, value: JSON.stringify(lightSkinned) });
  await expect(page.getByTestId('song-hero-head').first()).toBeAttached();
  await seek(page, toast + 0.35);
  expect(await shutEyes(page, lightEyes), 'both eyes are open as he raises his martini').toEqual([false, false]);
  await seek(page, toast + 0.9);
  expect(await shutEyes(page, lightEyes), 'he winks his left eye, on the picture\'s right').toEqual([false, true]);
  await seek(page, finaleBlink);
  expect(await shutEyes(page, lightEyes), 'a blink shuts both eyes').toEqual([true, true]);
  await seek(page, elsewhere);
  await seek(page, toast + 0.9);
  expect(await shutEyes(page, lightEyes), 'seeking back reproduces the wink').toEqual([false, true]);
});

test('with reduced motion the worn face stops blinking but still winks', async ({ page }) => {
  await reopenWith(page, ({ key, value }) => localStorage.setItem(key, value), { key: STORAGE_KEY, value: JSON.stringify(lightSkinned) });
  await showReducedMotionVideo(page);
  await expect(page.getByTestId('song-hero-head').first()).toBeAttached();
  await seek(page, finaleBlink);
  expect(await shutEyes(page, lightEyes), 'no decorative blinking').toEqual([false, false]);
  await seek(page, toast + 0.9);
  expect(await shutEyes(page, lightEyes), 'the choreographed wink remains').toEqual([false, true]);
});
