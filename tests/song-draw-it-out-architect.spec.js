// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { countInArtwork } = require('./song-player-helpers');

const PLAYER = '/assets/song-player/draw-it-out.html';
const STORAGE_KEY = 'se-gym-hero-avatar';

// Times come from the storyboard's sung words, so a re-recorded take moves
// the checks with the choreography instead of silently testing other scenes.
const storyboard = yaml.load(fs.readFileSync(path.join(__dirname, '..', '_data/songs/draw_it_out.yml'), 'utf8'));
const storyLines = new Map(storyboard.sections.flatMap((section) => section.lines).map((line) => [line.id, line]));
const mark = (id, word) => storyLines.get(id).marks[word];
const quiz4 = storyLines.get('quiz-4');

// The architect's scenes: drafting the plan ("first"), the floor plan's
// pipes, the flaw on paper, the first chorus, the safe association, the
// bottleneck, the ball and socket, quiz questions 2, 4, and 6 once
// answered, and the outro's two hooks ("cheap").
const architectTimes = [
  mark('intro-4', 'first') + 0.6,
  mark('verse-1-4', 'part') + 0.4,
  mark('verse-1-5', 'flaw') + 0.5,
  mark('chorus-1-2', 'class') + 0.4,
  mark('verse-3-7', 'safe') + 0.4,
  mark('verse-4-2', 'bottlenecks') + 0.3,
  mark('verse-6-5', 'snap') + 0.4,
  ...['quiz-2', 'quiz-4', 'quiz-6'].map((id) => storyLines.get(id).answer_at + 0.9),
  mark('outro-1', 'cheap') + 0.5,
  mark('outro-2', 'cheap') + 0.5,
];

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
    accessory: 'round-rim-glasses', accessories: ['round-rim-glasses'], emblem: '',
  },
};

// These are renderer tests: Timeline.seek is the public deterministic-frame
// API used by both the live player and the exporter. The artwork has no
// interactive role; stable test IDs name the parts whose behavior is taught.
async function seek(page, seconds) {
  await page.evaluate((time) => window.Timeline.seek(time), seconds);
}

/** Reloads the player with `setup` running before any page script. */
async function reopenWith(page, setup, arg) {
  await page.addInitScript(setup, arg);
  await page.reload();
  await expect(page.getByTestId('song-picture')).toBeVisible();
}

const HERO_HEAD = '[data-testid="song-hero-head"]';

/** Waits until every architect in the song, on stage or not, wears a face of its own. */
async function expectEveryArchitectWearsAHead(page) {
  const architects = await countInArtwork(page, '[data-testid="dio-architect"]');
  expect(architects, 'the song casts the architect').toBeGreaterThan(0);
  await expect.poll(() => countInArtwork(page, HERO_HEAD), { message: 'each architect wears its own copy' }).toBe(architects);
}

/** The architect on stage: painted, not faded out with an earlier scene. */
async function architectOnStage(page) {
  const architects = page.getByTestId('dio-architect');
  const painted = await architects.evaluateAll((nodes) => nodes.map((node) => {
    for (let ancestor = node; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    }
    return true;
  }));
  expect(painted.filter(Boolean), 'exactly one architect is on stage').toHaveLength(1);
  return architects.nth(painted.indexOf(true));
}

/** The centre of a locator's painted box, in page pixels. */
async function centre(locator) {
  const box = await locator.boundingBox();
  expect(box, 'the part is painted').not.toBeNull();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.beforeEach(async ({ page }) => {
  await page.goto(PLAYER);
  await expect(page.getByRole('button', { name: 'Play song', exact: true })).toBeEnabled();
  await expect(page.getByTestId('song-picture')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
});

for (const sample of [
  // Very dark skin, the tone furthest from the default.
  { name: 'human hero', hero: savedHuman, skin: '#35241f', hand: 'rgb(53, 36, 31)' },
  // Prof is the Gym's fixed portrait, whatever editable traits were saved.
  { name: 'Prof', hero: { ...savedHuman, kind: 'tobias' }, skin: '#edbea5', hand: 'rgb(237, 190, 165)' },
]) {
  test(`every architect wears the saved ${sample.name}'s own face, with matching hands`, async ({ page }) => {
    const saved = JSON.stringify(sample.hero);
    await reopenWith(page, ({ key, value }) => localStorage.setItem(key, value), { key: STORAGE_KEY, value: saved });
    await expectEveryArchitectWearsAHead(page);
    for (const time of architectTimes) {
      await seek(page, time);
      const architect = await architectOnStage(page);
      const face = architect.getByTestId('song-hero-head');
      await expect(face, `the architect at ${time}s wears the saved face`).toBeVisible();
      await expect(face).toHaveAttribute('data-hero-kind', sample.hero.kind);
      await expect(face).toHaveCSS('--hero-skin-light', sample.skin);
      await expect(architect.getByTestId('dio-arch-drawn-face')).toBeHidden();
      const handTones = await architect.getByTestId('dio-arch-hand').first().evaluate((hand) => {
        const gradient = document.getElementById(getComputedStyle(hand).fill.match(/#([^"')]+)/)?.[1]);
        return gradient ? Array.from(gradient.querySelectorAll('stop'), (stop) => getComputedStyle(stop).stopColor) : [];
      });
      expect(handTones, 'the hands are shaded in the saved skin tone').toContain(sample.hand);
      // Safari redraws filtered artwork that moves every frame inconsistently.
      await expect(face.locator('xpath=..'), 'the moving head carries no SVG filter').toHaveCSS('filter', 'none');
    }
    expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY), 'the song never changes the Gym hero').toBe(saved);
  });
}

test('without a saved hero, the architect wears the SE Gym\'s default human face', async ({ page }) => {
  await expectEveryArchitectWearsAHead(page);
  const defaultSkin = await page.evaluate(() => window.HeroAvatar.DEFAULTS.appearance.skin);
  for (const time of [architectTimes[0], architectTimes.at(-1)]) {
    await seek(page, time);
    const face = (await architectOnStage(page)).getByTestId('song-hero-head');
    await expect(face, `the architect at ${time}s wears the default face`).toBeVisible();
    await expect(face).toHaveAttribute('data-hero-kind', 'human');
    await expect(face).toHaveCSS('--hero-skin-light', defaultSkin);
  }
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY), 'the default face is never saved as the viewer\'s hero').toBeNull();
});

test('without the SE Gym renderer, the architect keeps a drawn face', async ({ page }) => {
  // The hero artwork never arrives: the song stays whole, with the drawn face.
  const failed = page.waitForEvent('requestfailed', (request) => request.url().includes('se-gym-hero-template.svg'));
  await page.route('**/se-gym-hero-template.svg', (route) => route.abort());
  await page.reload();
  await expect(page.getByTestId('song-picture')).toBeVisible();
  await failed;
  for (const time of [architectTimes[0], architectTimes.at(-1)]) {
    await seek(page, time);
    await expect((await architectOnStage(page)).getByTestId('dio-arch-drawn-face')).toBeVisible();
  }
  expect(await countInArtwork(page, `[data-testid="dio-architect"] ${HERO_HEAD}`), 'no architect wears a face').toBe(0);
});

test('the architect thinks a quiz question over, then points the pencil at the sung answer', async ({ page }) => {
  await expectEveryArchitectWearsAHead(page);
  // While the question is open, the pencil rests under the chin.
  await seek(page, (quiz4.start + quiz4.answer_at) / 2);
  const architect = await architectOnStage(page);
  // The painted head: Firefox measures the worn head's own <svg> by its
  // whole viewport, not by what it paints.
  const face = await architect.getByTestId('song-hero-head').locator('[data-hero-head-assembly]').boundingBox();
  const resting = await centre(architect.getByTestId('dio-arch-pencil-tip'));
  expect(resting.x, 'the pencil tip is at the face').toBeGreaterThan(face.x);
  expect(resting.x, 'the pencil tip is at the face').toBeLessThan(face.x + face.width);
  expect(resting.y, 'the pencil tip is at the chin').toBeGreaterThan(face.y + face.height / 2);
  expect(resting.y, 'the pencil tip is at the chin').toBeLessThan(face.y + face.height * 1.25);
  // Once the answer is sung, the pencil points along a line through its bar.
  await seek(page, quiz4.answer_at + 0.9);
  const bar = await page.getByText(quiz4.answer, { exact: true }).boundingBox();
  const barrel = await centre(architect.getByTestId('dio-arch-pencil-barrel'));
  const tip = await centre(architect.getByTestId('dio-arch-pencil-tip'));
  expect(tip.x, 'the pencil points towards the card, on its left').toBeLessThan(barrel.x);
  const atBar = barrel.y + (tip.y - barrel.y) * ((bar.x + bar.width - barrel.x) / (tip.x - barrel.x));
  expect(atBar, 'the pencil\'s line meets the answer bar').toBeGreaterThan(bar.y);
  expect(atBar, 'the pencil\'s line meets the answer bar').toBeLessThan(bar.y + bar.height);
});

test('the architect moves smoothly: from frame to frame, its pencil never jumps', async ({ page }) => {
  // Verse 4 holds its quickest moves: it rings the bottleneck, thinks it
  // over, points, waits on its watch, then flings the message off.
  const [from, to] = [mark('verse-4-2', 'whom'), mark('verse-4-6', 'block')];
  // The pencil's tip at 30 frames a second, in stage pixels from the
  // architect's own box, so a camera punch that moves the whole stage
  // doesn't count as the architect's motion.
  const tips = await page.evaluate(({ start, end }) => {
    const painted = (node) => {
      for (let ancestor = node; ancestor; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      }
      return true;
    };
    const samples = [];
    for (let frame = Math.ceil(start * 30); frame <= end * 30; frame++) {
      window.Timeline.seek(frame / 30);
      const architect = [...document.querySelectorAll('[data-testid="dio-architect"]')].find(painted);
      if (!architect) continue;
      const box = architect.getBoundingClientRect();
      const scale = box.width / architect.offsetWidth;
      const tip = architect.querySelector('[data-testid="dio-arch-pencil-tip"]').getBoundingClientRect();
      samples.push({ frame, x: (tip.x + tip.width / 2 - box.x) / scale, y: (tip.y + tip.height / 2 - box.y) / scale });
    }
    return samples;
  }, { start: from, end: to });
  expect(tips.length, 'the architect stays on stage through verse 4').toBeGreaterThan(0.9 * 30 * (to - from));
  let path = 0;
  let largest = { step: 0, frame: tips[0].frame };
  for (let i = 1; i < tips.length; i++) {
    if (tips[i].frame !== tips[i - 1].frame + 1) continue;
    const step = Math.hypot(tips[i].x - tips[i - 1].x, tips[i].y - tips[i - 1].y);
    path += step;
    if (step > largest.step) largest = { step, frame: tips[i].frame };
  }
  expect(path, 'the pencil moves through these gestures').toBeGreaterThan(300);
  // Its quickest flick covers a little over half of this in a frame; a pose
  // that snapped from one place to another would cover several times as much.
  expect(largest.step, `the pencil's largest step, at ${(largest.frame / 30).toFixed(2)}s`).toBeLessThan(60);
});

test('ticking, tapping, or ringing something out at its side, the architect reaches out with its whole arm', async ({ page }) => {
  // The flaw tapped on paper, the class ticked off in the first chorus, the
  // bottleneck ringed, and quiz answers 2 and 6 ticked and ringed.
  const gestures = [
    mark('verse-1-5', 'flaw') + 0.5,
    mark('chorus-1-2', 'class') + 0.4,
    mark('verse-4-2', 'bottlenecks') + 0.3,
    ...['quiz-2', 'quiz-6'].map((id) => storyLines.get(id).answer_at + 0.9),
  ];
  for (const time of gestures) {
    await seek(page, time);
    const architect = await architectOnStage(page);
    const figure = await architect.boundingBox();
    const hand = await centre(architect.getByTestId('dio-arch-pen-forearm').getByTestId('dio-arch-hand'));
    // Out from the figure's middle, in widths of its own frame. An elbow
    // kept down at the side with only the forearm swung out (a turn of the
    // shoulder no arm makes) leaves the hand about half a width out; the
    // upper arm raised with the reach takes it well past that.
    const out = Math.abs(hand.x - (figure.x + figure.width / 2)) / figure.width;
    expect(out, `at ${time.toFixed(2)}s the pencil hand is out at the end of a raised arm`).toBeGreaterThan(0.58);
  }
});

test('with reduced motion the architect holds still between its moves', async ({ page }) => {
  // Two moments of the same pose: the pencil under the chin while thinking.
  const [early, late] = [quiz4.start + 1.6, quiz4.answer_at - 0.6];
  const tipAt = async (time) => {
    await seek(page, time);
    return centre((await architectOnStage(page)).getByTestId('dio-arch-pencil-tip'));
  };
  await expectEveryArchitectWearsAHead(page);
  const swaying = [await tipAt(early), await tipAt(late)];
  expect(swaying[0], 'at ease, the architect shifts its weight').not.toEqual(swaying[1]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // The accessible default is lyrics-only. A viewer may explicitly choose
  // the illustration while retaining the OS request to reduce motion.
  const lyricsOnly = page.getByRole('checkbox', { name: 'Use lyrics-only mode' });
  await expect(lyricsOnly).toBeChecked();
  await lyricsOnly.uncheck();
  await expect(page.getByTestId('song-picture')).toBeVisible();
  expect(await tipAt(early), 'with reduced motion the held pose does not move').toEqual(await tipAt(late));
});
