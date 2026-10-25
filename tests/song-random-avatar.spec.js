// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { a11yCheckpoint } = require('./a11y-helpers');

// The information-hiding song: the student's laptop cameos, and Agent 00,
// who wears the viewer's hero's head.
const PLAYER = '/assets/song-player/every-module-keeps-a-secret.html';
const CHAPTER = '/SEBook/designprinciples/informationhiding.html';
const PLAYLIST = '/SEBook/playlist.html';
const HERO_KEY = 'se-gym-hero-avatar';
const RANDOM_KEY = 'song-player-random-avatar';
const TITLE = 'Every Module Keeps a Secret: a song about information hiding';

// Times come from the storyboard's sung words, so a re-recorded take moves
// the checks with the choreography.
const storyboard = yaml.load(fs.readFileSync(path.join(__dirname, '..', '_data/songs/every_module_keeps_a_secret.yml'), 'utf8'));
const lines = new Map(storyboard.sections.flatMap((section) => section.lines).map((line) => [line.id, line]));
const start = (id) => lines.get(id).start;
const mark = (id, word) => lines.get(id).marks[word];
// The student watches verse 2's store until its fifth line.
const cameo = { from: start('verse-2-1'), to: start('verse-2-5') - 0.2 };
// Agent 00 toasts the year 2000 in the intro, then returns in verse 2.
const toast = { early: start('intro-6') + 1.5, late: mark('intro-6', 'zero') + 1 };
const gateway = mark('verse-2-8', 'names') + 1;

const savedHero = JSON.stringify({
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
});

/** Stores these entries before any page script reads them, in every frame. */
async function store(page, entries) {
  await page.addInitScript((pairs) => {
    for (const [key, value] of pairs) localStorage.setItem(key, value);
  }, Object.entries(entries));
}

// Timeline.seek is the renderer's public deterministic-frame API; the
// artwork has no interactive role, so stable test IDs name its characters.
async function seek(page, seconds) {
  await page.evaluate((time) => window.Timeline.seek(time), seconds);
}

/** Flips a site switch as a pointer does: on its visible label, not the hidden input. */
async function flip(page, toggle) {
  await page.locator('label', { has: toggle }).click();
}

/** The hero a character shows: the colour tokens it wears. */
function heroColours(locator) {
  return locator.evaluate((node) => Object.fromEntries(Array.from(node.style)
    .filter((name) => name.startsWith('--hero-'))
    .map((name) => [name, node.style.getPropertyValue(name)])));
}

/** The hero's face that Agent 00, painted on stage now, wears. */
async function agentFace(page) {
  const faces = page.getByTestId('ih-agent').getByTestId('song-hero-head');
  const painted = await faces.evaluateAll((nodes) => nodes.map((node) => {
    for (let ancestor = node; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      if (style.display === 'none' || Number(style.opacity) === 0) return false;
    }
    return true;
  }));
  expect(painted.filter(Boolean), 'Agent 00 is on stage').toHaveLength(1);
  return faces.nth(painted.indexOf(true));
}

test('the Random avatar switch is off by default, remembered, and offered only on the playlist', async ({ page }) => {
  await page.goto(PLAYER);
  await expect(page.getByRole('button', { name: 'Play song', exact: true })).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Random avatar' })).toHaveCount(0);

  await page.goto(PLAYLIST);
  const toggle = page.getByRole('switch', { name: 'Random avatar' });
  await expect(toggle).not.toBeChecked();
  await flip(page, toggle);
  await expect(toggle).toBeChecked();
  await expect(page.getByRole('status')).toHaveText('Random avatar on.');
  await a11yCheckpoint(page, 'random avatar switch', { feature: 'song-playlist', include: '#song-playlist' });
  await page.reload();
  await expect(toggle).toBeChecked();
  await toggle.press('Space');
  await expect(toggle).not.toBeChecked();
  await expect(page.getByRole('status')).toHaveText('Random avatar off.');
});

test('with Random avatar on, a player shows a new hero at each entrance and never changes the saved one', async ({ page }) => {
  await store(page, { [HERO_KEY]: savedHero, [RANDOM_KEY]: 'true' });
  await page.goto(PLAYER);
  await expect(page.getByTestId('song-picture')).toBeVisible();
  const student = page.getByTestId('song-student-avatar');
  await expect(student).toHaveAttribute('data-avatar-state', 'random');

  await seek(page, cameo.from + 0.5);
  const atLaptop = await heroColours(student);
  expect(Object.keys(atLaptop), 'the cameo wears a hero').not.toHaveLength(0);
  await seek(page, cameo.to - 0.5);
  expect(await heroColours(student), 'the cameo keeps its hero while on screen').toEqual(atLaptop);
  // Each new hero renders in idle time, so a quick return may repeat one.
  await expect.poll(async () => {
    await seek(page, cameo.to + 1);
    await seek(page, cameo.from + 0.5);
    return heroColours(student);
  }, { message: 'coming back, the cameo shows another hero' }).not.toEqual(atLaptop);

  await seek(page, toast.early);
  const toastHero = await heroColours(await agentFace(page));
  await seek(page, toast.late);
  expect(await heroColours(await agentFace(page)), 'Agent 00 keeps his hero while on stage').toEqual(toastHero);
  await expect.poll(async () => {
    await seek(page, 0);
    await seek(page, gateway);
    return heroColours(await agentFace(page));
  }, { message: 'Agent 00 returns as another hero' }).not.toEqual(toastHero);

  expect(await page.evaluate((key) => localStorage.getItem(key), HERO_KEY), 'the song never changes the saved hero').toBe(savedHero);
});

test('switching Random avatar in the playlist re-dresses the loaded video at once, without starting it', async ({ page }) => {
  await store(page, { [HERO_KEY]: savedHero, 'song-player-playlist': JSON.stringify({ version: 1, songs: ['every_module_keeps_a_secret'] }) });
  await page.goto(PLAYLIST);
  const frame = page.locator('#playlist-frame').contentFrame();
  const student = frame.getByTestId('song-student-avatar');
  const audio = frame.getByLabel(`${TITLE} audio`, { exact: true });
  await expect(student).toHaveAttribute('data-avatar-state', 'saved');
  const toggle = page.getByRole('switch', { name: 'Random avatar' });
  await flip(page, toggle);
  await expect(student).toHaveAttribute('data-avatar-state', 'random');
  await expect(audio).toHaveJSProperty('paused', true);
  await flip(page, toggle);
  await expect(student).toHaveAttribute('data-avatar-state', 'saved');
  await expect(audio).toHaveJSProperty('paused', true);
});

test('a video on an SE Book page follows the stored Random avatar choice', async ({ page }) => {
  await store(page, { [HERO_KEY]: savedHero, [RANDOM_KEY]: 'true' });
  await page.goto(CHAPTER);
  const player = page.getByTitle(`${TITLE}: interactive music player`);
  await player.scrollIntoViewIfNeeded();
  await expect(player.contentFrame().getByTestId('song-student-avatar')).toHaveAttribute('data-avatar-state', 'random');
});
