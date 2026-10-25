// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { countInArtwork } = require('./song-player-helpers');

// "It Works on My Machine" as the live player draws it: the Teammate, the
// tenor, keeps his own drawn face, and the six teammates who answer him wear
// the viewer's SE Gym hero face (js/song-video/opera-cast.js); the props
// (js/song-video/machine-kit.js) never hide a singer's face.

const PLAYER = '/assets/song-player/it-works-on-my-machine.html';
const STORAGE_KEY = 'se-gym-hero-avatar';

// Times come from the storyboard's sung words, so a re-recorded take moves
// the checks with the choreography instead of silently testing other scenes.
const storyboard = yaml.load(fs.readFileSync(path.join(__dirname, '..', '_data/songs/it_works_on_my_machine.yml'), 'utf8'));
const sections = new Map(storyboard.sections.map((section) => [section.id, section]));
const storyLines = new Map(storyboard.sections.flatMap((section) => section.lines).map((line) => [line.id, line]));
const mark = (id, word) => storyLines.get(id).marks[word];

// Each teammate, by role, with the section they sing.
const TEAMMATES = [
  ['pm', 'pm'], ['build', 'build'], ['test', 'test'], ['ui', 'ui'], ['backend', 'backend'], ['security', 'security'],
];
const CAST = ['tenor', ...TEAMMATES.map(([role]) => role)];
const midSolo = (section) => {
  const [first] = sections.get(section).lines;
  return (first.start + first.end) / 2;
};
// The curtain starts to fall on the closing chord, hiding the stage.
const CURTAIN = 279.5;

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
// API of the live player. The artwork has no interactive role; stable test
// IDs name the parts whose behavior is checked.
async function seek(page, seconds) {
  await page.evaluate((time) => window.Timeline.seek(time), seconds);
}

const HERO_HEAD = '[data-testid="song-hero-head"]';

/** Waits until every teammate wears a face of their own (the Teammate never does). */
async function expectTeammatesWearHeads(page) {
  await expect.poll(() => countInArtwork(page, HERO_HEAD), { message: 'each teammate wears its own copy' }).toBe(TEAMMATES.length);
}

test.beforeEach(async ({ page }) => {
  await page.goto(PLAYER);
  await expect(page.getByRole('button', { name: 'Play song', exact: true })).toBeEnabled();
  await expect(page.getByTestId('song-picture')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
});

test('every teammate sings in the saved hero\'s own face; the Teammate keeps his', async ({ page }) => {
  const saved = JSON.stringify(savedHuman);
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: STORAGE_KEY, value: saved });
  await page.reload();
  await expect(page.getByTestId('song-picture')).toBeVisible();
  await expectTeammatesWearHeads(page);
  for (const [role, section] of TEAMMATES) {
    await seek(page, midSolo(section));
    const face = page.getByTestId(`oc-${role}`).getByTestId('song-hero-head');
    await expect(face, `the ${role} singer wears the saved face`).toBeVisible();
    await expect(face).toHaveAttribute('data-hero-kind', 'human');
    await expect(face).toHaveCSS('--hero-skin-light', savedHuman.appearance.skin);
    const teammate = page.getByTestId(`oc-${role}`);
    await expect(teammate.getByTestId('oc-drawn-face')).toBeHidden();
    const tenor = page.getByTestId('oc-tenor');
    await expect(tenor.getByTestId('oc-drawn-face'), 'the Teammate keeps his own face').toBeVisible();
    await expect(tenor.getByTestId('song-hero-head')).toHaveCount(0);
  }
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY), 'the song never changes the Gym hero').toBe(saved);
});

test('without a saved hero, the teammates wear the SE Gym\'s default human face, never saved', async ({ page }) => {
  await expectTeammatesWearHeads(page);
  const defaultSkin = await page.evaluate(() => window.HeroAvatar.DEFAULTS.appearance.skin);
  for (const [role, section] of [TEAMMATES[0], TEAMMATES.at(-1)]) {
    await seek(page, midSolo(section));
    const face = page.getByTestId(`oc-${role}`).getByTestId('song-hero-head');
    await expect(face, `the ${role} singer wears the default face`).toBeVisible();
    await expect(face).toHaveAttribute('data-hero-kind', 'human');
    await expect(face).toHaveCSS('--hero-skin-light', defaultSkin);
  }
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBeNull();
});

test('no prop in front of a singer covers their face, from the overture to the closing curtain', async ({ page }) => {
  test.setTimeout(240_000);
  await expectTeammatesWearHeads(page);
  const covered = [];
  for (let time = 0; time < CURTAIN; time += 0.5) {
    await seek(page, time);
    const hits = await page.evaluate((cast) => {
      const stage = document.getElementById('stage');
      const shown = (node) => {
        for (let n = node; n && n !== stage; n = n.parentElement) {
          const style = getComputedStyle(n);
          if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) < 0.3) return false;
        }
        return true;
      };
      const painted = (node) => {
        const box = node.getBoundingClientRect();
        if (box.width < 1 || box.height < 1 || !shown(node)) return null;
        if (node instanceof SVGGraphicsElement) {
          if (node instanceof SVGSVGElement || node instanceof SVGGElement || node.closest('defs, clipPath, mask')) return null;
          const style = getComputedStyle(node);
          return style.fill === 'none' && style.stroke === 'none' ? null : box;
        }
        const style = getComputedStyle(node);
        const fills = style.backgroundColor !== 'rgba(0, 0, 0, 0)' || style.backgroundImage !== 'none' || parseFloat(style.borderTopWidth) > 0;
        const text = [...node.childNodes].some((child) => child.nodeType === Node.TEXT_NODE && child.textContent.trim());
        return fills || text ? box : null;
      };
      const out = [];
      for (const role of cast) {
        const figure = stage.querySelector(`[data-testid="oc-${role}"]`);
        if (!figure || !shown(figure)) continue;
        const worn = figure.querySelector('[data-testid="song-hero-head"] [data-hero-head-assembly]');
        const head = worn && shown(worn) ? worn : figure.querySelector('[data-testid="oc-drawn-face"]');
        const face = head && head.getBoundingClientRect();
        if (!face || face.width < 1) continue;
        for (const prop of stage.querySelectorAll('.scene > *')) {
          // Confetti is meant to rain over everyone; it is not a prop.
          if (prop.classList.contains('confetti-layer')) continue;
          // Only what is painted in front of the singer can hide a face.
          const layer = prop.closest('.layer');
          const inFront = layer !== figure.closest('.layer') || (figure.compareDocumentPosition(prop) & Node.DOCUMENT_POSITION_FOLLOWING);
          if (!inFront || !shown(prop)) continue;
          for (const part of [prop, ...prop.querySelectorAll('*')]) {
            const box = painted(part);
            if (!box) continue;
            const overlap = Math.max(0, Math.min(box.right, face.right) - Math.max(box.left, face.left))
              * Math.max(0, Math.min(box.bottom, face.bottom) - Math.max(box.top, face.top));
            if (overlap > 16) {
              out.push(`${role}: ${(prop.textContent || prop.className).replace(/\s+/g, ' ').trim().slice(0, 30)}`);
              break;
            }
          }
        }
      }
      return out;
    }, CAST);
    for (const hit of new Set(hits)) covered.push(`${time.toFixed(1)}s ${hit}`);
  }
  expect(covered, 'faces covered by props').toEqual([]);
});

test('in each refrain the laptop rests on his raised palm beside his head, the other arm flung wide', async ({ page }) => {
  for (const n of [1, 2, 3]) {
    await seek(page, mark(`refrain-${n}-1`, 'machine') + 0.2);
    const tenor = page.getByTestId('oc-tenor');
    const laptops = page.getByTestId('mk-laptop');
    // A laptop's painted box: the union of its parts (its own box is only a placement).
    const raised = await laptops.evaluateAll((nodes) => nodes.filter((node) => {
      for (let n = node; n; n = n.parentElement) if (getComputedStyle(n).opacity === '0' || getComputedStyle(n).display === 'none') return false;
      return true;
    }).map((node) => [...node.querySelectorAll('*')].map((part) => part.getBoundingClientRect()).filter((box) => box.width > 0 && box.height > 0)
      .reduce((all, box) => ({
        left: Math.min(all.left, box.left), right: Math.max(all.right, box.right),
        top: Math.min(all.top, box.top), bottom: Math.max(all.bottom, box.bottom),
      }), { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity })));
    expect(raised, `refrain ${n}: one laptop on stage`).toHaveLength(1);
    const [laptop] = raised;
    const palm = await tenor.getByTestId('oc-arm-right').getByTestId('oc-hand').boundingBox();
    const other = await tenor.getByTestId('oc-arm-left').getByTestId('oc-hand').boundingBox();
    const face = await tenor.getByTestId('oc-drawn-face').boundingBox();
    expect(palm && other && face, 'the hands and the face are painted').toBeTruthy();
    if (!palm || !other || !face) return;
    expect(Math.abs(laptop.bottom - palm.y), `refrain ${n}: the laptop sits on the palm`).toBeLessThan(6);
    expect(Math.abs((laptop.left + laptop.right) / 2 - (palm.x + palm.width / 2)), `refrain ${n}: the laptop is centred over the hand`).toBeLessThan(14);
    expect(laptop.left, `refrain ${n}: the laptop is beside his head, not over it`).toBeGreaterThanOrEqual(face.x + face.width);
    // Shoulder height is a little below the chin; a hand at rest hangs by the hip.
    expect(other.y + other.height / 2, `refrain ${n}: the other hand is flung out at shoulder height, not at his hip`).toBeLessThan(face.y + face.height + 30);
  }
});
