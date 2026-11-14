// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { openPlayerSettings } = require('./song-player-helpers');

const song = yaml.load(fs.readFileSync(path.join(__dirname, '../_data/songs/not_a_one_time_investment.yml'), 'utf8'));
const EARLY = 12; // The opening construction has finished; the sky is still dawn.
const MIDDLE = song.duration / 2;
const LATE = song.duration - 1;

// These decorative test IDs are stable artwork hooks, not accessibility
// labels: the player supplies the equivalent visual description separately.
async function sunrisePicture(page) {
  const sun = await page.getByTestId('reuse-sun').boundingBox();
  const opacity = (id) => page.getByTestId(id).evaluate(node => Number(getComputedStyle(node).opacity));
  const light = (id) => page.getByTestId(id).evaluateAll(nodes => nodes.reduce((sum, node) => sum + Number(getComputedStyle(node).opacity), 0));
  return {
    sunTop: Math.round(sun.y * 100) / 100,
    sunLeft: Math.round(sun.x * 100) / 100,
    cloudLight: await page.getByTestId('reuse-cloud-highlight').evaluate(node => getComputedStyle(node).stopColor),
    morning: await opacity('reuse-morning-sky'),
    stars: await opacity('reuse-stars'),
    windows: await light('reuse-window-light'),
    lamps: await light('reuse-lamp-glow'),
  };
}

// The same public absolute-time renderer drives native audio and exports.
// Isolating it here keeps the dawn check independent of media codec support.
async function seek(page, time) {
  await page.evaluate(time => window.Timeline.seek(time), time);
}

async function ambientPositions(page) {
  const clouds = await page.getByTestId('reuse-cloud-bank').evaluateAll(nodes => nodes.map(node => {
    const rect = node.getBoundingClientRect();
    return [rect.x, rect.y];
  }));
  const truck = await page.getByTestId('reuse-site-forklift').boundingBox();
  return { clouds, truck: [truck.x, truck.y] };
}

test('Not a One-Time Investment: benefit cards take turns between the towers, including after rewind', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(song.player);
  const quality = page.getByTestId('reuse-benefit-quality');
  const productivity = page.getByTestId('reuse-benefit-productivity');
  const painted = locator => locator.evaluate(node => {
    for (let current = node; current; current = current.parentElement) {
      const style = getComputedStyle(current);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    }
    return true;
  });
  for (const [time, qualityVisible, productivityVisible] of [
    [20.2, true, false], [23.7, false, true], [28, false, false], [20.2, true, false],
  ]) {
    await seek(page, time);
    expect(await painted(quality), `quality card at ${time}s`).toBe(qualityVisible);
    expect(await painted(productivity), `productivity card at ${time}s`).toBe(productivityVisible);
  }
  const hall = await page.getByTestId('reuse-hall').boundingBox();
  const site = await page.getByTestId('reuse-site').boundingBox();
  for (const [time, card] of [[20.2, quality], [23.7, productivity]]) {
    await seek(page, time);
    const bounds = await card.boundingBox();
    expect(bounds.x, 'the card clears the hall').toBeGreaterThan(hall.x + hall.width);
    expect(bounds.x + bounds.width, 'the card clears the construction tower').toBeLessThan(site.x);
  }
});

test('Not a One-Time Investment: the ground is present from frame zero and the towers stay sharp', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(song.player);
  const ground = page.getByTestId('reuse-ground');
  for (const time of [0, 0.5, 20, 173, 288, 0]) {
    await seek(page, time);
    await expect(ground).toBeVisible();
    await expect(ground).toHaveCSS('opacity', '1');
    await expect(page.getByTestId('reuse-hall')).toHaveCSS('filter', 'none');
    await expect(page.getByTestId('reuse-site')).toHaveCSS('filter', 'none');
  }
});

test('Not a One-Time Investment: one hero remains visible across every lyric and scene boundary', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(song.player);
  const hero = page.getByTestId('oc-foreman');
  const times = [0, ...song.sections.flatMap(section => section.lines.map(line => line.start + 0.2)), song.duration - 0.1];
  for (const time of [...times, ...times.toReversed()]) {
    await seek(page, time);
    await expect(hero, `the same performer is present at ${time}s`).toHaveCount(1);
    await expect(hero).toBeVisible();
  }
});

test('Not a One-Time Investment: the hero sings the words and rests between lines and at quiz pauses', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(song.player);
  const lyric = song.sections.flatMap(section => section.lines).find(line => line.id === 'v1-1');
  const mouth = page.getByTestId('oc-foreman').getByTestId('song-hero-head').locator('.song-hero-singing-mouth');
  await expect(page.getByTestId('oc-foreman').getByTestId('song-hero-head')).toBeVisible();
  const shape = () => mouth.locator('path').evaluateAll(paths => paths.map(path => path.getAttribute('d')));
  const firstWord = lyric.marks.most + 0.1;
  await seek(page, firstWord);
  await expect(mouth).toBeVisible();
  const firstShape = await shape();
  await seek(page, lyric.marks.code - 0.04);
  await expect.poll(shape, { message: 'the mouth closes toward the next word' }).not.toEqual(firstShape);

  // This instrumental begins after the spoken intro has ended.
  await seek(page, song.sections[0].lines.at(-1).end + 0.5);
  await expect(mouth).toBeHidden();
  for (const question of song.sections.flatMap(section => section.lines).filter(line => line.pause_at !== undefined)) {
    await seek(page, question.pause_at);
    await expect(mouth, 'the singer waits while the reader considers the question').toBeHidden();
    await seek(page, question.answer_at + 0.1);
    await expect(mouth, 'the singer resumes with the answer').toBeVisible();
  }
  await seek(page, firstWord);
  await expect(mouth).toBeVisible();
  expect(await shape(), 'rewinding restores the same sung mouth shape').toEqual(firstShape);
});

test('Not a One-Time Investment: background movement settles during explanations and resumes in the finale', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(song.player);
  await expect(page.getByTestId('song-picture')).toBeVisible();
  await expect(page.getByTestId('reuse-site-forklift')).toHaveCount(1);

  await seek(page, 20);
  const settled = await ambientPositions(page);
  expect(settled.clouds.length, 'cloud banks are present').toBeGreaterThan(0);
  for (const time of [68, 163, 255]) {
    await seek(page, time);
    expect(await ambientPositions(page), `ambient objects stay still during the explanation at ${time}s`).toEqual(settled);
  }
  await seek(page, 288);
  const finale = await ambientPositions(page);
  expect(finale.clouds, 'cloud drift resumes in the finale').not.toEqual(settled.clouds);
  expect(finale.truck, 'the forklift resumes in the finale').not.toEqual(settled.truck);
  await seek(page, 20);
  expect(await ambientPositions(page), 'rewinding restores the settled picture').toEqual(settled);
});

test('Not a One-Time Investment: sunrise advances with song time and rewinds to the same picture', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(song.player);
  await expect(page.getByTestId('song-picture')).toBeVisible();
  await expect(page.getByTestId('reuse-sun')).toHaveCount(1);

  await seek(page, EARLY);
  const dawn = await sunrisePicture(page);
  await seek(page, MIDDLE);
  const rising = await sunrisePicture(page);
  await seek(page, LATE);
  const morning = await sunrisePicture(page);

  expect(rising.sunTop, 'the sun rises above its dawn position').toBeLessThan(dawn.sunTop);
  expect(morning.sunTop, 'the sun continues rising through the song').toBeLessThan(rising.sunTop);
  expect(rising.sunLeft, 'the east-facing sunrise moves right as it climbs').toBeGreaterThan(dawn.sunLeft);
  expect(morning.sunLeft).toBeGreaterThan(rising.sunLeft);
  expect(rising.cloudLight, 'cloud undersides warm as the sun reaches the horizon').not.toEqual(dawn.cloudLight);
  expect(morning.cloudLight, 'cloud light keeps changing as the sun climbs into golden hour').not.toEqual(rising.cloudLight);
  expect(rising.morning, 'daylight grows during the song').toBeGreaterThan(dawn.morning);
  expect(morning.morning).toBeGreaterThan(rising.morning);
  expect(dawn.stars, 'stars are visible at dawn').toBeGreaterThan(0);
  expect(morning.stars, 'stars fade in daylight').toBe(0);
  expect(dawn.windows, 'rooms glow before daylight').toBeGreaterThan(0);
  expect(morning.windows, 'room lights fade as daylight arrives').toBe(0);
  expect(dawn.lamps, 'street lamps glow before daylight').toBeGreaterThan(0);
  expect(morning.lamps, 'street lamps fade as daylight arrives').toBe(0);

  for (const [time, picture] of [[EARLY, dawn], [MIDDLE, rising], [LATE, morning]]) {
    await seek(page, time);
    await expect.poll(() => sunrisePicture(page), { message: `rewinding must reproduce the daylight picture at ${time}s` }).toEqual(picture);
  }
  expect(errors).toEqual([]);
});

test('Not a One-Time Investment: reduced motion holds the daylight picture still when artwork is enabled', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(song.player);
  await openPlayerSettings(page);
  const lyricsOnly = page.getByRole('checkbox', { name: 'Use lyrics-only mode' });
  await expect(lyricsOnly).toBeChecked();
  await lyricsOnly.uncheck();
  await expect(page.getByTestId('song-picture')).toBeVisible();
  await page.getByRole('button', { name: 'Player settings', exact: true }).click();

  await seek(page, EARLY);
  const still = await sunrisePicture(page);
  const ambientStill = await ambientPositions(page);
  for (const time of [MIDDLE, LATE, EARLY]) {
    await seek(page, time);
    await expect.poll(() => sunrisePicture(page), { message: 'reduced motion keeps sun position and ambient illumination fixed' }).toEqual(still);
    expect(await ambientPositions(page), 'reduced motion keeps the clouds and forklift still').toEqual(ambientStill);
    await expect(page.getByTestId('oc-foreman')).toBeVisible();
    await expect(page.getByTestId('oc-foreman').locator('.song-hero-singing-mouth')).toBeHidden();
  }
  expect(errors).toEqual([]);
});
