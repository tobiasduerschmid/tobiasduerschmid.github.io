// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { countInArtwork, openPlayerSettings } = require('./song-player-helpers');

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
const CAST = ['tenor', ...TEAMMATES.map(([role]) => role), 'hero'];
// The viewer's hero pushes him from the keyboard on the closing line.
const closingLine = () => mark('outro-3', 'keyboard');
const ISSUE_REVEALS = [
  ['pm-4', 'wrong'], ['build-3', 'fail'], ['test-2', 'failed'],
  ['ui-1', 'repair'], ['backend-2', 'broken'], ['security-1', 'keys'],
].map(([id, word]) => mark(id, word));
const midSolo = (section) => {
  const [first] = sections.get(section).lines;
  return (first.start + first.end) / 2;
};
// The curtain starts to fall on the closing chord, hiding the stage.
const CURTAIN = 279.5;

test('the office clock and sunrise agree after the overnight aging', async ({ page }) => {
  const morning = mark('ui-4', 'overnight') + .25;
  for (const [time, hourAngle, minuteAngle] of [[3,285,180], [storyLines.get('pm-1').start - 2.5,90,0], [morning + 5.1,280,120]]) {
    await seek(page, time);
    const hands = await page.locator('.oh-clock-hand').evaluateAll(nodes => nodes.map(node => node.transform.baseVal.getItem(0).angle));
    expect(hands[0], `hour hand at ${time}s`).toBeCloseTo(hourAngle, 1);
    expect(hands[1], `minute hand at ${time}s`).toBeCloseTo(minuteAngle, 1);
  }
  const samples = [];
  for (let offset = 0; offset <= 5; offset += .1) {
    await seek(page, morning + offset);
    samples.push(await page.locator('.oh-sun').evaluate(node => {
      const glow = document.querySelector('[fill="url(#oh-sun-glow)"]');
      return { x: Number(node.getAttribute('cx')), y: Number(node.getAttribute('cy')), opacity: Number(node.getAttribute('opacity')),
        glowX: Number(glow.getAttribute('cx')), glowY: Number(glow.getAttribute('cy')) };
    }));
  }
  const visible = samples.filter(point => point.opacity > .1);
  expect(visible.length, 'the sun emerges during the sunrise').toBeGreaterThan(5);
  for (let i = 1; i < visible.length; i++) {
    expect(visible[i].x, 'the rising sun advances from the left').toBeGreaterThanOrEqual(visible[i-1].x);
    expect(visible[i].y, 'the morning sun climbs rather than setting again').toBeLessThanOrEqual(visible[i-1].y);
    expect(visible[i].glowX).toBe(visible[i].x);
    expect(visible[i].glowY).toBe(visible[i].y);
  }
});

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

/** Waits until every teammate, and the hero who joins them, wears a face of their own (the Teammate never does). */
async function expectTeammatesWearHeads(page) {
  await expect.poll(() => countInArtwork(page, HERO_HEAD), { message: 'each teammate and the hero wear their own copy' }).toBe(TEAMMATES.length + 1);
}

test.beforeEach(async ({ page }) => {
  await page.goto(PLAYER);
  await expect(page.getByRole('button', { name: 'Play song', exact: true })).toBeEnabled();
  await expect(page.getByTestId('song-picture')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
});

// These are painted SVG marks, not interactive controls. Measure actual
// opacity because Playwright's visibility check includes transparent SVG.
const visibleMarks = (locator) => locator.evaluateAll(nodes => nodes.filter(node => Number(getComputedStyle(node).opacity) > 0.5).length);
async function buildMarks(page) {
  const board = page.getByTestId('oh-build-board');
  return {
    failed: await visibleMarks(board.getByTestId('oh-build-fail')),
    passed: await visibleMarks(board.getByTestId('oh-build-pass')),
    pending: await visibleMarks(board.getByTestId('oh-build-pending')),
  };
}

// Inspect the rendered light, not the controller's cue tables. These are
// deliberate color filters on opaque artwork, so geometry and opacity must
// remain intact when attention passes between singers.
const paintedLight = locator => locator.evaluate(node => {
  const style = getComputedStyle(node);
  const value = name => Number(style.filter.match(new RegExp(`${name}\\(([^)]+)\\)`))?.[1] ?? 1);
  return { brightness: value('brightness'), chroma: value('saturate'), opacity: Number(style.opacity) };
});

test('stage light favors each current singer, then brings up the answering ensemble', async ({ page }) => {
  const lead = page.getByTestId('oc-tenor');
  await seek(page, midSolo('verse-1'));
  const leadSolo = await paintedLight(lead);
  expect(leadSolo.brightness).toBeGreaterThanOrEqual(1);
  for (const time of [91, 91.5, 117.5, 120, 181.9, 213.6, 260]) {
    await seek(page, time);
    expect((await paintedLight(lead)).brightness, `solo or phrase gap at ${time}s keeps his key light on`).toBeGreaterThanOrEqual(1);
    await expect(page.getByTestId('tm-lead-spot'), `follow spot remains on at ${time}s`).toHaveCSS('opacity', '1');
  }
  for (const [role, section] of TEAMMATES) {
    await seek(page, midSolo(section));
    const singer = await paintedLight(page.getByTestId(`oc-${role}`));
    const listener = await paintedLight(lead);
    expect(singer.brightness, `${role} receives the key light`).toBeGreaterThan(listener.brightness + 0.06);
    expect(singer.chroma, `${role} retains slightly more color than the listener`).toBeGreaterThan(listener.chroma);
    expect(listener.brightness, 'the lead retains the brighter half-strength key light').toBeGreaterThanOrEqual(0.93);
    expect(listener.opacity, 'listening must not make a figure transparent').toBe(1);
  }
  await seek(page, midSolo('refrain-3'));
  const chorusWaiting = await paintedLight(page.getByTestId('oc-pm'));
  expect(chorusWaiting.brightness, 'the waiting finale cast stays half lit').toBeGreaterThanOrEqual(0.93);
  expect((await paintedLight(lead)).brightness).toBeGreaterThan(chorusWaiting.brightness + 0.06);
  await seek(page, closingLine() + 0.5);
  for (const [role] of TEAMMATES) {
    expect((await paintedLight(page.getByTestId(`oc-${role}`))).brightness, `${role} joins the final answer`).toBeGreaterThanOrEqual(1);
  }
  await seek(page, midSolo('verse-1'));
  expect(await paintedLight(lead), 'reverse seeks restore the opening light').toEqual(leadSolo);
});

test('light crossfades smoothly and directs attention to the final CI result without fading the subjects', async ({ page }) => {
  const lead = page.getByTestId('oc-tenor');
  const board = page.getByTestId('oh-build-board');
  const pm = page.getByTestId('oc-pm');
  const handoff = storyLines.get('pm-1').start;
  const levels = [];
  for (const offset of [-0.65, -0.5, -0.35, -0.18]) {
    await seek(page, handoff + offset);
    levels.push((await paintedLight(pm)).brightness);
  }
  expect(levels[1]).toBeGreaterThan(levels[0]);
  expect(levels[2]).toBeGreaterThan(levels[1]);
  expect(levels[3]).toBeGreaterThan(levels[2]);
  const failed = mark('outro-1', 'strange') - 1;
  await seek(page, failed - 4);
  const ambientBoard = await paintedLight(board);
  await seek(page, failed + 0.15);
  const resultBoard = await paintedLight(board);
  const reacting = await paintedLight(lead);
  expect(resultBoard.brightness).toBeGreaterThan(ambientBoard.brightness + 0.1);
  expect(reacting.brightness, 'he is still singing: the CI reveal keeps him fully lit').toBeGreaterThanOrEqual(1);
  expect(resultBoard.opacity).toBe(1);
  expect(reacting.opacity).toBe(1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openPlayerSettings(page);
  await page.getByRole('checkbox', { name: 'Use lyrics-only mode' }).uncheck();
  await seek(page, failed + 0.15);
  expect(await paintedLight(board), 'reduced motion preserves the intended hierarchy').toEqual(resultBoard);
  await seek(page, failed - 4);
  expect(await paintedLight(board), 'no stale light after a reverse seek').toEqual(ambientBoard);
});

test('speakers keep full light at line boundaries, with bright half light for sleep and quick dialogue', async ({ page }) => {
  const roleOf = { Teammate: 'tenor', ...Object.fromEntries(TEAMMATES.map(([role, section]) => [sections.get(section).voice, role])) };
  const cases = storyboard.sections.flatMap(section => section.lines.map(lyric => ({
    id: lyric.id, start: lyric.start, end: lyric.end,
    roles: (lyric.voice || section.voice) === 'All six teammates' ? TEAMMATES.map(([role]) => role) : [roleOf[lyric.voice || section.voice]],
  })));
  for (const lyric of cases) for (const time of [lyric.start - 0.1, lyric.end + 0.2]) {
    await test.step(`${lyric.id} at ${time}s`, async () => {
      await seek(page, time);
      for (const role of lyric.roles) {
        const singer = page.getByTestId(`oc-${role}`);
        await expect(singer, `${role} remains on stage through the phrase`).toBeAttached();
        expect((await paintedLight(singer)).brightness, `${role} keeps the full-light buffer`).toBeGreaterThanOrEqual(1);
      }
    });
  }
  // When listening or sleeping, supporting actors retain the brighter half light.
  for (const [role, time] of [['backend', mark('verse-6-2', 'dotenv')], ['security', 245.2], ['security', 247.7], ['security', 250.5]]) {
    await seek(page, time);
    expect((await paintedLight(page.getByTestId(`oc-${role}`))).brightness, `${role} stays half lit at ${time}s`).toBeGreaterThanOrEqual(0.93);
  }
  for (const time of [mark('build-4', 'laptop') + 0.5, mark('security-9', 'again') + 0.2, closingLine() + 0.5, 274]) {
    await seek(page, time);
    expect((await paintedLight(page.getByTestId('oc-tenor'))).brightness, `important reaction or spoken outro at ${time}s stays fully lit`).toBeGreaterThanOrEqual(1);
    await expect(page.getByTestId('tm-lead-spot')).toHaveCSS('opacity', '1');
  }
});

test('each technical setback adds one failed build check, retained through local successes', async ({ page }) => {
  for (const [i, at] of ISSUE_REVEALS.entries()) {
    await seek(page, at - 0.01);
    const failedBefore = Math.max(0, i - 1);
    expect(await buildMarks(page), `before issue ${i + 1}`).toEqual({ failed: failedBefore, passed: 6 - failedBefore, pending: 0 });
    await seek(page, at + 0.3);
    expect(await buildMarks(page), `after issue ${i + 1}; requirements do not fail a technical check`).toEqual({ failed: i, passed: 6 - i, pending: 0 });
  }
  for (const [time, failed] of [
    [mark('refrain-1-4', 'green') + 1, 1],
    [mark('refrain-2-4', 'green') + 1, 3],
    [mark('backend-3', 'dawn') + 1, 4],
    [mark('refrain-3-4', 'green') + 1, 5],
  ]) {
    await seek(page, time);
    expect(await buildMarks(page), `local success at ${time}s does not erase accumulated failures`).toEqual({ failed, passed: 6 - failed, pending: 0 });
  }
});

test('the final CI run waits with unlit ellipses, then fails one second before Strange and pulses every build light', async ({ page }) => {
  const failed = mark('outro-1', 'strange') - 1;
  const running = failed - 3;
  const screen = (state) => page.getByTestId(`mk-laptop-screen-${state}`);
  const paintedScreenText = (state) => screen(state).evaluateAll(nodes => nodes.filter(node => {
    for (let part = node; part; part = part.parentElement) {
      const style = getComputedStyle(part);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) < 0.5) return false;
    }
    return true;
  }).map(node => node.textContent));
  const glow = () => page.getByTestId('oh-build-glow').evaluateAll(nodes => nodes.map(node => Number(getComputedStyle(node).opacity)));
  for (const time of [running + 0.3, failed - 0.01]) {
    await seek(page, time);
    expect(await paintedScreenText('running')).toEqual(['CI tests running']);
    expect(await paintedScreenText('error')).toEqual([]);
    expect(await buildMarks(page)).toEqual({ failed: 0, passed: 0, pending: 6 });
    expect(await glow(), 'all lamps are unlit while CI is pending').toEqual(Array(6).fill(0));
  }
  await seek(page, failed + 0.3);
  expect(await paintedScreenText('error')).toEqual(['CI Build failed']);
  expect(await paintedScreenText('running')).toEqual([]);
  expect(await buildMarks(page)).toEqual({ failed: 6, passed: 0, pending: 0 });
  const first = await glow();
  await seek(page, failed + 0.8);
  const second = await glow();
  first.forEach((level, i) => expect(level - second[i], `lamp ${i + 1} visibly pulses`).toBeGreaterThan(0.1));
  expect(await buildMarks(page), 'the crosses stay legible throughout the pulse').toEqual({ failed: 6, passed: 0, pending: 0 });
  const colors = await page.getByTestId('oh-build-lens').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).fill.match(/[\d.]+/g).map(Number)));
  colors.forEach(([red, green, blue]) => { expect(red).toBeGreaterThan(green * 2); expect(red).toBeGreaterThan(blue * 2); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // The real player's accessible default switches to lyrics-only mode.
  // Explicitly opt back into artwork to inspect its reduced-motion states.
  await openPlayerSettings(page);
  await expect(page.getByRole('checkbox', { name: 'Use lyrics-only mode' })).toBeChecked();
  await page.getByRole('checkbox', { name: 'Use lyrics-only mode' }).uncheck();
  await expect(page.getByTestId('oh-build-board')).toBeVisible();
  await seek(page, failed + 0.3);
  const steady = await glow();
  await seek(page, failed + 1);
  expect(await glow(), 'reduced motion keeps all failed lights steady').toEqual(steady);
  await seek(page, running + 0.3);
  expect(await paintedScreenText('running'), 'rewinding restores the waiting screen').toEqual(['CI tests running']);
  expect(await buildMarks(page)).toEqual({ failed: 0, passed: 0, pending: 6 });
});

test('the lead gains a subtle cheek-only blush with all six revelations, retained through gestures and seeks', async ({ page }) => {
  const tenor = page.getByTestId('oc-tenor');
  const cheekPaint = () => tenor.getByTestId('oc-cheek-flush').evaluateAll(nodes => nodes.map(node => Number(getComputedStyle(node).opacity)));
  const skinPaint = () => tenor.getByTestId('oc-face-complexion').evaluate(gradient => [...gradient.children].map(stop => getComputedStyle(stop).stopColor));
  await seek(page, ISSUE_REVEALS[0] - 0.1);
  const originalSkin = await skinPaint();
  let previous = await cheekPaint();
  expect(previous).toEqual([0, 0]);
  for (const at of ISSUE_REVEALS) {
    await seek(page, at + 0.8);
    const halfway = await cheekPaint();
    await seek(page, at + 1.7);
    const settled = await cheekPaint();
    settled.forEach((amount, i) => {
      expect(halfway[i], `cheek ${i + 1} eases warmer after ${at}s`).toBeGreaterThan(previous[i]);
      expect(amount, `each revelation adds warmth after ${at}s`).toBeGreaterThan(halfway[i]);
      expect(amount, 'the extra cheek wash stays subtle').toBeLessThan(0.5);
    });
    expect(await skinPaint(), 'the forehead, nose and ears retain their original skin palette').toEqual(originalSkin);
    previous = settled;
  }
  for (const time of [mark('refrain-3-1', 'machine'), mark('outro-1', 'worked'), closingLine()]) {
    await seek(page, time);
    expect(await cheekPaint(), `acting at ${time}s preserves the accumulated cheek flush`).toEqual(previous);
  }
  await seek(page, ISSUE_REVEALS[0] - 0.1);
  expect(await cheekPaint(), 'rewinding removes later redness').toEqual([0, 0]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openPlayerSettings(page);
  await expect(page.getByRole('checkbox', { name: 'Use lyrics-only mode' })).toBeChecked();
  await page.getByRole('checkbox', { name: 'Use lyrics-only mode' }).uncheck();
  await expect(page.getByTestId('oh-build-board')).toBeVisible();
  await seek(page, closingLine());
  expect(await cheekPaint(), 'reduced motion retains the same final blush').toEqual(previous);
});

// What tells one worn face from another: its kind, skin, hair colour, and the
// hair and facial hair it shows. Read from the worn head itself.
async function faceOf(page, role) {
  return page.getByTestId(`oc-${role}`).getByTestId('song-hero-head').evaluate((head) => {
    const shown = (slot) => [...head.querySelectorAll(`[data-hero-slot="${slot}"]`)]
      .filter((group) => group.getAttribute('display') !== 'none' && getComputedStyle(group).display !== 'none')
      .map((group) => group.getAttribute('data-hero-option'));
    const style = getComputedStyle(head);
    return {
      kind: head.getAttribute('data-hero-kind'),
      skin: style.getPropertyValue('--hero-skin-light').trim(),
      hairColor: style.getPropertyValue('--hero-hair').trim(),
      hair: shown('hair'),
      facialHair: shown('facial-hair').filter((option) => option !== 'none'),
    };
  });
}

test('each teammate is a woman with a random face of her own, kept from her solo to the finale; the laptop keeps the saved hero', async ({ page }) => {
  const saved = JSON.stringify(savedHuman);
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: STORAGE_KEY, value: saved });
  await page.reload();
  await expect(page.getByTestId('song-picture')).toBeVisible();
  await expect(page.getByTestId('song-student-avatar'), 'the overture\'s laptop shows the viewer\'s hero').toHaveAttribute('data-avatar-state', 'saved');
  await expectTeammatesWearHeads(page);
  const finale = mark('refrain-3-2', 'finest');
  const solos = {};
  for (const [role, section] of TEAMMATES) {
    await seek(page, midSolo(section));
    const face = await faceOf(page, role);
    expect(face.kind, `the ${role} wears a human hero's face`).toBe('human');
    expect(face.facialHair, `the ${role} has no facial hair`).toEqual([]);
    expect(face.hair.length, `the ${role} shows one hairstyle`).toBe(1);
    await expect(page.getByTestId(`oc-${role}`).getByTestId('oc-drawn-face')).toBeHidden();
    const tenor = page.getByTestId('oc-tenor');
    await expect(tenor.getByTestId('oc-drawn-face'), 'the Teammate keeps his own face').toBeVisible();
    await expect(tenor.getByTestId('song-hero-head')).toHaveCount(0);
    solos[role] = face;
  }
  await seek(page, finale);
  for (const [role] of TEAMMATES) {
    const face = await faceOf(page, role);
    // The UI Developer aged overnight in her solo: the same face, silver hair.
    if (role === 'ui') expect(face.hairColor, 'the UI Developer is still silver-haired').not.toBe(solos.ui.hairColor);
    expect({ ...face, hairColor: null }, `the ${role} keeps her face into the finale`).toEqual({ ...solos[role], hairColor: null });
  }
  const looks = new Set(Object.values(solos).map((face) => JSON.stringify(face)));
  expect(looks.size, 'six teammates, six faces').toBeGreaterThan(1);
  // For the closing line, the viewer's own hero pushes him from the keyboard.
  await seek(page, closingLine());
  const hero = page.getByTestId('oc-hero').getByTestId('song-hero-head');
  await expect(hero, 'the saved hero pushes him from the keyboard').toBeVisible();
  await expect(hero).toHaveCSS('--hero-skin-light', savedHuman.appearance.skin);
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY), 'the song never changes the Gym hero').toBe(saved);
});

test('a saved Prof hero sings the closing line with the teammates: the mouth opens on its words', async ({ page }) => {
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: STORAGE_KEY, value: JSON.stringify({ ...savedHuman, kind: 'tobias' }) });
  await page.reload();
  await expect(page.getByTestId('song-picture')).toBeVisible();
  // "Step away from the keyboard": the ensemble's "away", sung by the hero too.
  // The worn head arrives after the first frame, so draw the moment again.
  const away = mark('outro-3', 'away') + 0.1;
  await seek(page, away);
  const hero = page.getByTestId('oc-hero').getByTestId('song-hero-head');
  await expect(hero).toHaveAttribute('data-hero-kind', 'tobias');
  await seek(page, away);
  await expect(hero.locator('.song-hero-singing-mouth'), 'the Prof\'s mouth is open').toBeVisible();
});

test('without a saved hero, the teammates still wear random women\'s faces, and nothing is saved', async ({ page }) => {
  await expectTeammatesWearHeads(page);
  for (const [role, section] of [TEAMMATES[0], TEAMMATES.at(-1)]) {
    await seek(page, midSolo(section));
    const face = await faceOf(page, role);
    expect(face.kind).toBe('human');
    expect(face.facialHair).toEqual([]);
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
    expect(laptop.bottom, `refrain ${n}: the thumb overlaps the laptop rim`).toBeGreaterThan(palm.y);
    expect(laptop.bottom, `refrain ${n}: the fingers remain below the base`).toBeLessThan(palm.y + palm.height);
    expect(Math.abs((laptop.left + laptop.right) / 2 - (palm.x + palm.width / 2)), `refrain ${n}: the laptop is centred over the hand`).toBeLessThan(14);
    expect(laptop.left, `refrain ${n}: the laptop is beside his head, not over it`).toBeGreaterThanOrEqual(face.x + face.width);
    // Shoulder height is a little below the chin; a hand at rest hangs by the hip.
    expect(other.y + other.height / 2, `refrain ${n}: the other hand is flung out at shoulder height, not at his hip`).toBeLessThan(face.y + face.height + 30);
  }
});

test('audience members raise and lower their hands without detaching their shoulders', async ({ page }) => {
  const ask = mark('verse-1-2', 'need');
  const lower = mark('verse-1-2', 'users') + 0.5;
  const shoulders = () => page.getByTestId('mk-audience-arm').evaluateAll((arms) => arms.map((arm) => {
    const point = arm.getPointAtLength(0);
    const position = new DOMPoint(point.x, point.y).matrixTransform(arm.getCTM());
    return [position.x, position.y];
  }));
  await seek(page, ask - 0.15);
  const resting = await shoulders();
  expect(resting.length, 'the questioning audience is on stage').toBeGreaterThan(0);
  for (const time of [ask, ask + 0.15, ask + 0.3, ask + 0.7, lower + 0.2]) {
    await seek(page, time);
    const posed = await shoulders();
    expect(posed).toHaveLength(resting.length);
    posed.forEach(([x, y], i) => expect(Math.hypot(x - resting[i][0], y - resting[i][1]),
      `audience shoulder ${i} at ${time.toFixed(2)}s stays attached`).toBeLessThan(0.2));
  }
});


test('bare and clothed forearms remain joined across the wrist through bends and hand turns', async ({ page }) => {
  const gaps = await page.evaluate(() => {
    const C = window.OperaCast;
    const K = window.SongKit;
    const failures = [];
    // Three sleeve constructions: rolled, short/bare elbow, and long.
    for (const role of ['tenor', 'build', 'pm']) {
      const svg = K.svg('svg', { viewBox: '0 0 160 300', width: 160, height: 300 }, document.body);
      const body = C.buildFigure(svg, K.svg('g', {}, svg), role);
      const poses = [
        C.REST,
        { ...C.REST, right: C.reach([125, 65]), left: C.reach([132, 100]), rightHand: 65, leftHand: -55, rightShape: 'point', leftShape: 'thumb' },
        { ...C.REST, right: [-70, 20], left: [90, 90], rightHand: -55, leftHand: 65, rightShape: 'flat', leftShape: 'open' },
      ];
      poses.forEach((pose, index) => {
        body.pose(pose, 0, 0, 0);
        for (const side of ['left', 'right']) {
          const arm = body.arms[side];
          const intoForearm = arm.limbFill.getCTM().inverse().multiply(arm.hand.getCTM());
          // Sample the whole proximal hand edge, not only its centre.
          for (const x of [-4, -2, 0, 2, 4]) {
            const point = new DOMPoint(x, -0.5).matrixTransform(intoForearm);
            if (!arm.limbFill.isPointInFill(point)) failures.push({ role, side, pose: index, x });
          }
        }
      });
      svg.remove();
    }
    return failures;
  });
  expect(gaps, 'skin or cloth must meet the entire wrist as the hand turns').toEqual([]);
});

test('folded forearms stay painted and apron edges cannot cut through sleeves', async ({ page }) => {
  const result = await page.evaluate(() => {
    const C = window.OperaCast, K = window.SongKit;
    const failures = [];
    let sampledSkin = 0, sampledCloth = 0;
    for (const role of ['build', 'ui']) {
      const fixture = document.createElement('div');
      fixture.className = `oc-figure oc-figure--${role}`;
      fixture.style.cssText = 'position:fixed;inset:0;width:640px;height:800px;z-index:10000';
      document.body.appendChild(fixture);
      const svg = K.svg('svg', { viewBox: '-40 0 240 300', width: 640, height: 800 }, fixture);
      const body = C.buildFigure(svg, K.svg('g', {}, svg), role);
      const poses = role === 'build'
        ? [[163, 229], [90, 240], [120, 270], [0, 150], [-20, 130], [90, 240]]
        : [-4, 0, 2, 4, 6, 10, 2, 0, -4].map(up => [up, 84.6]);
      for (const angles of poses) {
        body.pose({ ...C.REST, left: angles, right: angles }, 0, 0, 0);
        for (const side of ['left', 'right']) {
          const arm = body.arms[side];
          const matrix = arm.fore.getScreenCTM();
          const elbow = new DOMPoint(...C.ELBOW).matrixTransform(matrix);
          const wrist = new DOMPoint(...C.WRIST).matrixTransform(matrix);
          const scale = Math.hypot(matrix.a, matrix.b);
          if (role === 'build') {
            const length = Math.hypot(wrist.x - elbow.x, wrist.y - elbow.y);
            // The entire forearm cross-section, including its edges where
            // deep flexion overlaps the shirt. Hit testing includes clips.
            for (let t = .06; t <= .94; t += .04) {
              for (const across of [-6, -5, -4, -3, 0, 3, 4, 5, 6]) {
                const point = new DOMPoint(
                  elbow.x + (wrist.x - elbow.x) * t + (wrist.y - elbow.y) / length * across * scale,
                  elbow.y + (wrist.y - elbow.y) * t - (wrist.x - elbow.x) / length * across * scale,
                );
                if (!arm.limbFill.isPointInFill(point.matrixTransform(arm.limbFill.getScreenCTM().inverse()))) continue;
                sampledSkin++;
                if (!document.elementsFromPoint(point.x, point.y).includes(arm.limbFill)) {
                  failures.push({ role, side, angles, t, across, issue: 'clipped forearm' });
                }
              }
            }
          } else {
            const shoulder = new DOMPoint(side === 'left' ? 160 - C.SHOULDER[0] : C.SHOULDER[0], C.SHOULDER[1])
              .matrixTransform(svg.getScreenCTM());
            const length = Math.hypot(elbow.x - shoulder.x, elbow.y - shoulder.y);
            const u = [(elbow.x - shoulder.x) / length, (elbow.y - shoulder.y) / length];
            // Cloth beside the torso must stay continuous on both sides
            // of the elbow, including before and after changing depth.
            for (const along of [1, 3, 6]) {
              const across = side === 'left' ? 6.2 : -6.2;
              const point = new DOMPoint(elbow.x - u[0] * along * scale + u[1] * across * scale,
                elbow.y - u[1] * along * scale - u[0] * across * scale);
              if (!arm.sleeveFill.isPointInFill(point.matrixTransform(arm.sleeveFill.getScreenCTM().inverse()))) continue;
              sampledCloth++;
              const top = document.elementsFromPoint(point.x, point.y).find(node => node instanceof SVGGeometryElement);
              if (!arm.root.contains(top) && !arm.shoulder.contains(top)) {
                failures.push({ role, side, angles, along, issue: 'garment cuts sleeve' });
              }
            }
          }
        }
      }
      fixture.remove();
    }
    return { failures, sampledSkin, sampledCloth };
  });
  expect(result.sampledSkin).toBeGreaterThan(1000);
  expect(result.sampledCloth).toBeGreaterThan(30);
  expect(result.failures, 'visible arm surfaces must survive clipping and garment layering').toEqual([]);
});

test('held objects keep a closed contact and their required orientation through gestures', async ({ page }) => {
  const examples = [
    ['pm', 'left', 'clipboard', [-1, 0], ['pm-1', 'pm-2', 'pm-4'], mark('pm-4', 'wrong')],
    ['build', 'left', 'wrench', [0, 0], ['build-1', 'build-2', 'build-4']],
    ['test', 'left', 'magnifier', [0, 0], ['test-1', 'test-2', 'test-4']],
    ['ui', 'right', 'palette', [1.6, 3], ['ui-1', 'ui-2', 'ui-4'], mark('ui-4', 'overnight')],
    ['backend', 'left', 'mug', [-4, 0], ['backend-1', 'backend-2', 'backend-4'], mark('backend-4', 'gone')],
  ];
  for (const [role, side, prop, contact, lines, heldUntil = Infinity] of examples) {
    for (const line of lines) {
      const { start, end } = storyLines.get(line);
      // Grip remains required through the wind-up, ending only at the authored
      // release. The aftermath suite checks the empty hand and single flying prop.
      const samples = [start + 0.1, (start + end) / 2, end - 0.65];
      if (heldUntil >= start && heldUntil < end) samples.push(heldUntil - 0.01);
      for (const time of samples.filter(time => time < heldUntil)) {
        await seek(page, time);
        const arm = page.getByTestId(`oc-${role}`).getByTestId(`oc-arm-${side}`);
        await expect(arm.getByTestId('oc-hand'), `${role} keeps hold at ${time}`).toHaveAttribute('data-hand-shape', /^(grip|edge)$/);
        const geometry = await arm.evaluate((arm, { contact }) => {
          const prop = arm.querySelector('[data-testid="oc-held-prop"]');
          const hand = arm.querySelector('[data-testid="oc-hand"]');
          const m = prop.getCTM();
          const p = new DOMPoint(...contact).matrixTransform(hand.getCTM().inverse().multiply(m));
          const visible = (node) => {
            for (let n = node; n && n !== hand; n = n.parentElement) if (getComputedStyle(n).display === 'none') return false;
            return true;
          };
          const touching = [...hand.querySelectorAll('.oc-skin')].some((skin) => visible(skin) && skin.isPointInFill(p));
          const up = new DOMPoint(0, -10).matrixTransform(m), origin = new DOMPoint(0, 0).matrixTransform(m);
          return { touching, upX: up.x - origin.x, upY: up.y - origin.y };
        }, { contact });
        expect(geometry.touching, `${prop}: the fingers touch its actual handle/edge at ${time}`).toBe(true);
        if (['mug', 'clipboard', 'palette'].includes(prop)) {
          expect(Math.abs(geometry.upX), `${prop}: remains upright at ${time}`).toBeLessThan(0.02);
          expect(geometry.upY).toBeLessThan(0);
        }
      }
    }
  }
});

test('resting laptops meet their desk surfaces before pickup, after return, and through the outro', async ({ page }) => {
  const restTimes = [mark('intro-1', 'leave')];
  for (const n of [1, 2, 3]) {
    restTimes.push(mark(`refrain-${n}-1`, 'works') - 0.66,
      mark(`refrain-${n}-2`, 'the') + 0.45,
      mark(`refrain-${n}-4`, 'green') + 0.5);
  }
  restTimes.push(mark('outro-1', 'worked'));
  for (const motion of ['no-preference', 'reduce']) {
    await page.emulateMedia({ reducedMotion: motion });
    if (motion === 'reduce') {
      // The accessible default is lyrics-only; opt into its reduced-motion
      // picture explicitly before checking the decorative stage geometry.
      const lyricsOnly = page.getByRole('checkbox', { name: 'Use lyrics-only mode' });
      await expect(lyricsOnly).toBeChecked();
      await lyricsOnly.uncheck();
      await expect(page.getByTestId('song-picture')).toBeVisible();
    }
    for (const time of [...restTimes, ...restTimes.toReversed()]) {
      await seek(page, time);
      const contacts = await page.evaluate(() => {
        const shown = (node) => {
          for (let n = node; n; n = n.parentElement) {
            const style = getComputedStyle(n);
            if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
          }
          return true;
        };
        // Sample painted SVG geometry, not the placement div's dimensions.
        // Mapping through the SVG viewport also includes responsive CSS scale
        // in WebKit, whose getScreenCTM omits that outer scale.
        const paintedBounds = (node) => {
          const viewport = node.ownerSVGElement;
          const rect = viewport.getBoundingClientRect(), viewBox = viewport.viewBox.baseVal;
          const sx = rect.width / viewBox.width, sy = rect.height / viewBox.height;
          const screen = new DOMMatrix([sx, 0, 0, sy, rect.left - viewBox.x * sx, rect.top - viewBox.y * sy]);
          const matrix = screen.multiply(viewport.getScreenCTM().inverse()).multiply(node.getScreenCTM());
          const box = node.getBBox();
          const top = new DOMPoint(box.x + box.width / 2, box.y).matrixTransform(matrix);
          const bottom = new DOMPoint(box.x + box.width / 2, box.y + box.height).matrixTransform(matrix);
          return { x: bottom.x, top: top.y, bottom: bottom.y };
        };
        const desks = [...document.querySelectorAll('.mk-desk-top, .student-desk')].filter(shown).map(paintedBounds);
        const bases = [...document.querySelectorAll('.mk-laptop-base, .student-laptop-base')].filter(shown).map(paintedBounds);
        const scale = document.querySelector('.stage').getBoundingClientRect().width / 960;
        return bases.map(base => {
          const desk = desks.toSorted((a, b) => Math.abs(a.x - base.x) - Math.abs(b.x - base.x))[0];
          return (base.bottom - desk.top) / scale;
        });
      });
      expect(contacts, `one resting laptop is painted at ${time}s (${motion})`).toHaveLength(1);
      expect(Math.abs(contacts[0]), `the painted laptop base meets its tabletop at ${time}s (${motion})`).toBeLessThanOrEqual(1);
    }
  }
});

test('the laptop has fingers under its base and a thumb on its rim throughout each lift and return', async ({ page }) => {
  for (const n of [1, 2, 3]) {
    const pickup = mark(`refrain-${n}-1`, 'works') - 0.65;
    const release = mark(`refrain-${n}-2`, 'the') + 0.45;
    for (let time = pickup + 0.02; time < release; time += 0.08) {
      await seek(page, time);
      const contact = await page.evaluate(() => {
        const hand = document.querySelector('[data-testid="oc-tenor"] [data-testid="oc-arm-right"] [data-testid="oc-hand"]');
        const shown = (node) => {
          for (let n = node; n; n = n.parentElement) if (getComputedStyle(n).display === 'none' || getComputedStyle(n).opacity === '0') return false;
          return true;
        };
        const base = [...document.querySelectorAll('[data-testid="mk-laptop"] .mk-laptop-base')].find(shown);
        const box = base.getBBox(), center = box.x + box.width / 2, bottom = box.y + box.height;
        const skins = [...hand.querySelectorAll('.oc-skin')].filter(shown);
        // These outer SVG viewports are axis-aligned. Their painted rectangles
        // include CSS scale, which WebKit omits from getScreenCTM(). Keep each
        // descendant's SVG transform, then map through its actual viewport.
        const paintedMatrix = (node) => {
          const viewport = node.ownerSVGElement;
          const rect = viewport.getBoundingClientRect(), viewBox = viewport.viewBox.baseVal;
          const sx = rect.width / viewBox.width, sy = rect.height / viewBox.height;
          const screen = new DOMMatrix([sx, 0, 0, sy, rect.left - viewBox.x * sx, rect.top - viewBox.y * sy]);
          return screen.multiply(viewport.getScreenCTM().inverse()).multiply(node.getScreenCTM());
        };
        const baseMatrix = paintedMatrix(base);
        const surfaces = skins.map((skin) => ({ skin, fromBase: paintedMatrix(skin).inverse().multiply(baseMatrix) }));
        const inHand = (x, y) => surfaces.some(({ skin, fromBase }) => skin.isPointInFill(new DOMPoint(x, y).matrixTransform(fromBase)));
        // Check the painted surfaces, not a shared contact constant that
        // could be outside the hand. Fingers support a span of the base;
        // the opposing thumb overlaps its front rim.
        const supported = [-3, 0, 3].every((dx) => inHand(center + dx, bottom + 0.8));
        let rimContact = false;
        for (let x = center - 18; x <= center + 18; x += 1) for (let y = bottom - 6; y <= bottom - 1; y += 1) {
          if (base.isPointInFill(new DOMPoint(x, y)) && inHand(x, y)) rimContact = true;
        }
        return { supported, rimContact };
      });
      expect(contact, `refrain ${n}: unsupported laptop at ${time.toFixed(2)}s`).toEqual({ supported: true, rimContact: true });
    }
  }
});

test('data arrows start inside their corresponding time rows and end before the kiosk artwork', async ({ page }) => {
  for (const width of [1280, 320]) {
    await page.setViewportSize({ width, height: 900 });
    // Changing to UTC changes the rendered column width. Backward seeks
    // must also reconnect to the original cells without stale coordinates.
    for (const time of [mark('ui-2', 'detail') + 0.3, mark('verse-4-2', 'showtime') + 0.8]) {
      await seek(page, time);
      const connections = await page.getByTestId('mk-client-connection').evaluateAll((paths) => {
        const rows = [...document.querySelectorAll('.mk-grid-cell--date')];
        const clients = [...document.querySelectorAll('.mk-client')];
        // The stage SVG is axis-aligned. Its painted viewport includes the
        // responsive CSS scale that WebKit leaves out of getScreenCTM().
        const paintedPoint = (node, point) => {
          const viewport = node.ownerSVGElement;
          const rect = viewport.getBoundingClientRect(), viewBox = viewport.viewBox.baseVal;
          const sx = rect.width / viewBox.width, sy = rect.height / viewBox.height;
          const screen = new DOMMatrix([sx, 0, 0, sy, rect.left - viewBox.x * sx, rect.top - viewBox.y * sy]);
          const matrix = screen.multiply(viewport.getScreenCTM().inverse()).multiply(node.getScreenCTM());
          return DOMPoint.fromPoint(point).matrixTransform(matrix);
        };
        return paths.map((path, i) => {
          const origin = paintedPoint(path, path.getPointAtLength(0));
          const row = rows[i].getBoundingClientRect();
          const arrow = path.parentElement.querySelector('[data-testid="mk-client-arrow"]');
          const tip = paintedPoint(arrow, arrow.getPointAtLength(0));
          const wall = clients[i].querySelector('.mk-client-wall').getBoundingClientRect();
          const icon = clients[i].querySelector('.mk-client-icon').getBoundingClientRect();
          const lineBox = path.getBoundingClientRect(), arrowBox = arrow.getBoundingClientRect();
          return {
            inRow: origin.x >= row.left && origin.x <= row.right && Math.abs(origin.y - (row.top + row.height / 2)) < 0.5,
            atKiosk: tip.x < wall.left && tip.y > wall.top && tip.y < wall.bottom,
            clearOfIcon: Math.max(lineBox.right, arrowBox.right) < icon.left,
          };
        });
      });
      expect(connections, `row connections at ${width}px and ${time}s`).toEqual(Array(3).fill({ inRow: true, atKiosk: true, clearOfIcon: true }));
    }
  }
});

test('repair bandages cover the wall cracks without overlapping the kiosk icons', async ({ page }) => {
  for (const width of [1280, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await seek(page, storyLines.get('ui-3').end - 0.1);
    const repairs = await page.getByTestId('mk-client-repair').evaluateAll((nodes) => nodes.map((node) => {
      const client = node.closest('.mk-client');
      const bandage = node.querySelector('.mk-bandage');
      const box = node.getBoundingClientRect();
      const window = client.querySelector('.mk-client-window').getBoundingClientRect();
      const wall = client.querySelector('.mk-client-wall').getBoundingClientRect();
      const crack = client.querySelector('.mk-crack-line');
      const matrix = bandage.getScreenCTM().inverse().multiply(crack.getScreenCTM());
      const coversCrack = Array.from({ length: 41 }, (_, i) => crack.getPointAtLength(crack.getTotalLength() * i / 40))
        .some((point) => bandage.isPointInFill(point.matrixTransform(matrix)));
      return { visible: Number(node.getAttribute('opacity')) > 0.9,
        belowWindow: box.top > window.bottom, insideWall: box.bottom < wall.bottom, coversCrack };
    }));
    expect(repairs).toEqual(Array(3).fill({ visible: true, belowWindow: true, insideWall: true, coversCrack: true }));
  }
});

test('joyful eyes stay open and facial features stay on the head through turns and full vowels', async ({ page }) => {
  const report = await page.evaluate(() => {
    const { OperaCast: C, SongKit: K } = window;
    const svg = K.svg('svg', { width: 160, height: 300, viewBox: '0 0 160 300' }, document.body);
    const body = C.buildFigure(svg, K.svg('g', {}, svg), 'tenor');
    const face = svg.querySelector('.oc-face-outline');
    const problems = [], nosePositions = [], chinPositions = [], earPositions = [];
    const local = (node, point) => point.matrixTransform(face.getScreenCTM().inverse().multiply(node.getScreenCTM()));
    for (const turn of [-1, -0.5, 0, 0.5, 1]) for (const blink of [0, 0.5, 1]) for (const open of [0, 0.5, 1]) {
      body.pose({ ...C.REST, turn, happy: 1, wide: 0.8, smile: 1, brow: 0.7 }, 0, open, blink);
      for (const eye of svg.querySelectorAll('.oc-eye-white')) {
        const box = eye.getBBox();
        if (!blink && box.height < 5) problems.push(`joy closed an eye at turn ${turn}`);
        if (blink === 1 && eye.isPointInFill(new DOMPoint(box.x + box.width / 2, box.y + box.height / 2))) problems.push('blink left an open eye');
      }
      for (const node of svg.querySelectorAll('.oc-mouth-inside,.oc-lip-light,.oc-upper-lip-volume,.oc-lower-lip-volume,.oc-eye-white,.oc-brow,.oc-nose')) {
        if (!node.getAttribute('d')) continue;
        for (let i = 0; i <= 24; i++) {
          const point = local(node, node.getPointAtLength(node.getTotalLength() * i / 24));
          if (!Number.isFinite(point.x + point.y) || !face.isPointInFill(point)) problems.push(`feature outside face: ${node.getAttribute('class')}/${turn}/${open}/${blink}`);
        }
      }
      if (!blink && !open) {
        const nose = svg.querySelector('.oc-nose');
        nosePositions.push(local(nose, new DOMPoint(0, -40)).x);
        const chin = new DOMPoint(0, 0).matrixTransform(face.getScreenCTM());
        chinPositions.push([chin.x, chin.y]);
        earPositions.push([...svg.querySelectorAll('.oc-ear')].map((ear) => local(ear, new DOMPoint(-54, -65)).x).reduce((a, b) => a + b) / 2);
      }
    }
    body.pose({ ...C.REST, turn: 1 }, 0, 0, 0);
    const closedLips = [...svg.querySelectorAll('.oc-upper-lip-volume,.oc-lower-lip-volume')]
      .map((lip) => lip.getBBox().width > 20 && getComputedStyle(lip).fill !== 'none');
    svg.remove();
    return { problems, nosePositions, chinPositions, earPositions, closedLips };
  });
  expect(report.problems).toEqual([]);
  expect(report.nosePositions[0]).toBeLessThan(-2);
  expect(report.nosePositions.at(-1)).toBeGreaterThan(2);
  for (let i = 1; i < report.nosePositions.length; i++) expect(report.nosePositions[i]).toBeGreaterThan(report.nosePositions[i - 1]);
  for (const chin of report.chinPositions) expect(chin).toEqual(report.chinPositions[0]);
  expect(report.earPositions.at(-1), 'ears sit behind the facial plane, with opposite parallax').toBeLessThan(report.earPositions[0]);
  expect(report.closedLips, 'closed mouths retain filled upper and lower lips').toEqual([true, true]);
});

test('supporting cast is expressive while singing and relaxes while listening', async ({ page }) => {
  await expectTeammatesWearHeads(page);
  for (const [role, section] of TEAMMATES) {
    const first = sections.get(section).lines[0];
    const pauseTime = (first.end + sections.get(section).lines[1].start) / 2;
    const singingTime = Object.values(first.marks)[1] + 0.12;
    await seek(page, singingTime);
    const head = page.getByTestId(`oc-${role}`).getByTestId('song-hero-head');
    const singing = head.locator('.song-hero-singing-mouth');
    await expect(singing).toBeVisible();
    await expect(singing).toHaveAttribute('opacity', '1');
    await seek(page, pauseTime);
    const mouth = head.locator('.song-hero-expression-mouth');
    await expect(mouth).toBeVisible();
    await expect(mouth.locator('.song-hero-expression-seam'), 'the reaction has visible paint, not only geometry').not.toHaveCSS('fill', 'none');
    const shape = await mouth.locator('.song-hero-expression-seam').getAttribute('d');
    await seek(page, singingTime);
    await expect(singing).toBeVisible();
    await seek(page, pauseTime);
    expect(await mouth.locator('.song-hero-expression-seam').getAttribute('d'), 'seeking reproduces the same expression').toBe(shape);
  }
  // They are listening during the lead's finale. A facepalm must not pin
  // every listener into the same unhappy resting mouth indefinitely.
  await seek(page, mark('refrain-3-3', 'ninetysix') + 0.8);
  for (const [role] of TEAMMATES) {
    const seam = page.getByTestId(`oc-${role}`).getByTestId('song-hero-head').locator('.song-hero-expression-seam');
    await expect(seam).toBeVisible();
    const relaxed = await seam.evaluate((node) => node.getPointAtLength(0).y <= node.getPointAtLength(node.getTotalLength() / 2).y);
    expect(relaxed, `${role}: resting face returns to relaxed lips`).toBe(true);
  }
});

test('anger follows an accusation, then clears for an explanation and listening', async ({ page }) => {
  await expectTeammatesWearHeads(page);
  // Inspect the visible lip corners between syllables, independently of
  // which randomized brow or eye shape this cast member happens to wear.
  async function mouthCurvature(role, time) {
    await seek(page, time);
    return page.getByTestId(`oc-${role}`).getByTestId('song-hero-head').locator('.song-hero-expression-seam').evaluate((seam) => {
      // The filled seam travels across the lips and back. Sample the
      // painted contour, without depending on its Bézier control points.
      return seam.getPointAtLength(0).y - seam.getPointAtLength(seam.getTotalLength() / 4).y;
    });
  }
  // Each pair contrasts a specific accusation with an explanation in the
  // same voice. Revisit the explanation after anger to catch retained state.
  for (const [role, explanation, accusation] of [
    ['pm', 'pm-1', 'pm-4'], ['test', 'test-3', 'test-2'],
    ['ui', 'ui-3', 'ui-2'], ['backend', 'backend-3', 'backend-2'],
    ['security', 'security-7', 'security-4'],
  ]) {
    const sample = (id) => storyLines.get(id).end - 0.45;
    const before = await mouthCurvature(role, sample(explanation));
    const angry = await mouthCurvature(role, sample(accusation));
    expect(angry, `${role}: the accusation firms and lowers the mouth corners`).toBeGreaterThan(before + 0.1);
    expect(await mouthCurvature(role, sample(explanation)), `${role}: reverse seek restores the explanation`).toBeCloseTo(before, 6);
  }
});

test('entrance role labels identify every teammate, clear the faces and laptop, then leave costume stickers behind', async ({ page }) => {
  await expectTeammatesWearHeads(page);
  const shortRoles = { pm: 'Product', build: 'Build', test: 'Test', ui: 'UI', backend: 'Backend', security: 'Security' };
  const checkIdentity = async (role, section, compact = false) => {
    const figure = page.getByTestId(`oc-${role}`);
    const label = figure.getByTestId('oc-role-label');
    await expect(label.locator(compact ? '.oc-role-label-short' : '.oc-role-label-name')).toHaveText(compact ? shortRoles[role] : sections.get(section).voice);
    await expect(label).toHaveCSS('opacity', '1');
    const name = await label.boundingBox();
    // A worn head's SVG viewport has spare room for other hairstyles.
    // Compare against the painted assembly, not that invisible rectangle.
    const head = await figure.getByTestId('song-hero-head').locator('[data-hero-head-assembly]').boundingBox();
    expect(name.y + name.height, `${role}: the role name stays above the head`).toBeLessThan(head.y);
    const picture = await page.getByTestId('song-picture').boundingBox();
    expect(head.y - name.y - name.height, `${role}: the label sits right above the head`).toBeLessThan(picture.width / 960 * 12);
    const sticker = figure.getByTestId('oc-role-sticker');
    await expect(sticker).toBeVisible();
    const patch = await sticker.boundingBox();
    const body = await figure.locator('.oc-art').boundingBox();
    expect(patch.y, `${role}: the sticker is on the clothing below the head`).toBeGreaterThan(body.y + body.height * 0.27);
    expect(patch.y + patch.height, `${role}: the sticker stays above the waist`).toBeLessThan(body.y + body.height * 0.53);
    return name;
  };
  for (const [role, section] of TEAMMATES) {
    await seek(page, storyLines.get(`${section}-1`).start);
    await checkIdentity(role, section);
  }
  await seek(page, storyLines.get('test-1').start);
  const fixedLabel = page.getByTestId('oc-test').getByTestId('oc-role-label');
  const settled = await fixedLabel.boundingBox();
  for (const offset of [0.3, 0.8, 1.5, 0]) {
    await seek(page, storyLines.get('test-1').start + offset);
    const current = await fixedLabel.boundingBox();
    expect(current.x, 'gestures do not move the positioned label sideways').toBeCloseTo(settled.x, 3);
    expect(current.y, 'gestures do not move the positioned label vertically').toBeCloseTo(settled.y, 3);
  }
  const overlap = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x
    && a.y < b.y + b.height && a.y + a.height > b.y;
  await seek(page, storyLines.get('refrain-3-1').start + 0.15);
  const labels = await Promise.all(TEAMMATES.map(([role, section]) => checkIdentity(role, section, true)));
  for (const [i, name] of labels.entries()) {
    expect(labels.slice(i + 1).some(other => overlap(name, other)), 'returning role names do not cover each other').toBe(false);
  }
  // The reminders clear before the laptop is lifted into their space.
  for (const offset of [0, 0.4, 1.2]) {
    await seek(page, mark('refrain-3-1', 'works') + offset);
    for (const [role] of TEAMMATES) await expect(page.getByTestId(`oc-${role}`).getByTestId('oc-role-label')).toHaveCSS('opacity', '0');
  }
  await seek(page, mark('refrain-3-4', 'green'));
  for (const [role] of TEAMMATES) {
    const figure = page.getByTestId(`oc-${role}`);
    await expect(figure.getByTestId('oc-role-label')).toHaveCSS('opacity', '0');
    await expect(figure.getByTestId('oc-role-sticker')).toBeVisible();
  }
  await seek(page, storyLines.get('pm-1').start);
  await checkIdentity('pm', 'pm');
});

test('the Test Engineer sleeve leaves the chest sticker intact while holding the magnifier and yawning', async ({ page }) => {
  for (const offset of [0, 0.3, 0.5, 0.7]) {
    await seek(page, mark('test-2', 'night') + offset);
    const covered = await page.getByTestId('oc-test').getByTestId('oc-role-sticker').evaluate(sticker => {
      const sleeves = [...sticker.closest('.oc-art').querySelectorAll('.oc-sleeve')]
        .filter(sleeve => sticker.compareDocumentPosition(sleeve) & Node.DOCUMENT_POSITION_FOLLOWING);
      const paper = sticker.querySelector('.oc-role-sticker-paper');
      const box = paper.getBBox();
      const points = [-0.35, 0, 0.35].flatMap(x => [-0.35, 0, 0.35].map(y => new DOMPoint(
        box.x + box.width * (0.5 + x), box.y + box.height * (0.5 + y),
      ).matrixTransform(paper.getScreenCTM())));
      return points.some(point => sleeves.some(sleeve => sleeve.isPointInFill(point.matrixTransform(sleeve.getScreenCTM().inverse()))));
    });
    expect(covered, 'a construction edge must not cut through the sticker on the chest').toBe(false);
  }
});

test('role stickers stay clear of sleeve roots and drawstrings throughout the supporting cast choreography', async ({ page }) => {
  const windows = Object.fromEntries(TEAMMATES.map(([role, section]) => [role, [
    [sections.get(section).lines[0].start, sections.get(section).lines.at(-1).end],
    [storyLines.get('refrain-3-1').start, storyLines.get('outro-2').end],
  ]]));
  const artifacts = await page.evaluate(windows => {
    const artifacts = [];
    for (const [role, ranges] of Object.entries(windows)) for (const [from, to] of ranges) {
      for (let time = from; time <= to; time += 0.25) {
        window.Timeline.seek(time);
        const figure = document.querySelector(`[data-testid="oc-${role}"]`);
        const sticker = figure.querySelector('[data-testid="oc-role-sticker"]');
        const surfaces = [...figure.querySelectorAll('[data-testid="oc-upper-sleeve"], .oc-drawstring, .oc-aglet')]
          .filter(node => sticker.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING);
        const points = [-7, 0, 7].flatMap(x => [-7, 0, 7].map(y => new DOMPoint(x, y).matrixTransform(sticker.getScreenCTM())));
        if (points.some(point => surfaces.some(surface => {
          const local = point.matrixTransform(surface.getScreenCTM().inverse());
          return surface.classList.contains('oc-drawstring') ? surface.isPointInStroke(local) : surface.isPointInFill(local);
        }))) artifacts.push({ role, time });
      }
    }
    return artifacts;
  }, windows);
  expect(artifacts, 'upper-sleeve construction and hoodie cords must not cut into the role stickers').toEqual([]);
});

test('the finale cast keeps empty hands down while watching green, the CI failure, and his excuse', async ({ page }) => {
  const green = mark('refrain-3-4', 'green');
  const excuse = storyLines.get('outro-1').end;
  // Include the whole held note and transitions, rather than just settled poses.
  for (let time = green; time < excuse; time += 0.25) {
    await seek(page, time);
    for (const [role] of TEAMMATES) {
      const figure = page.getByTestId(`oc-${role}`);
      await expect(figure.getByTestId('oc-held-prop'), `${role} leaves tools backstage`).toHaveCount(0);
      const handsAreDown = await figure.getByTestId('oc-hand').evaluateAll(hands => hands.every(hand => {
        const figure = hand.closest('.oc-art').getBoundingClientRect();
        return hand.getBoundingClientRect().top > figure.top + figure.height * 0.54;
      }));
      expect(handsAreDown, `${role}: hands remain below the waist at ${time}`).toBe(true);
    }
  }
});

test('silent finale reactions change from curiosity to dismay to anger at his excuse', async ({ page }) => {
  await expectTeammatesWearHeads(page);
  const curiousAt = mark('refrain-3-4', 'green') + 0.8;
  const failedAt = mark('outro-1', 'strange') - 1 + 0.65;
  const angryAt = mark('outro-1', 'worked') + 0.4;
  const expressionsAt = async time => {
    await seek(page, time);
    return Promise.all(TEAMMATES.map(async ([role]) => {
      const mouth = page.getByTestId(`oc-${role}`).getByTestId('song-hero-head').locator('.song-hero-expression-seam');
      await expect(mouth, `${role}: a painted closed mouth remains visible`).toBeVisible();
      return mouth.evaluate(seam => {
        // Compare the painted lip contour in its own coordinates; randomized
        // face size, gaze, head turns, and the camera must not change the oracle.
        return (seam.getPointAtLength(0).y - seam.getPointAtLength(seam.getTotalLength() / 4).y) / seam.getBBox().width;
      });
    }));
  };
  for (const motion of ['no-preference', 'reduce']) {
    await page.emulateMedia({ reducedMotion: motion });
    if (motion === 'reduce') {
      // The player correctly defaults to lyrics-only; opt into the reduced
      // artwork to verify the same authored reactions without movement.
      await openPlayerSettings(page);
      await page.getByRole('checkbox', { name: 'Use lyrics-only mode' }).uncheck();
      await expectTeammatesWearHeads(page);
    }
    const curious = await expressionsAt(curiousAt);
    const failed = await expressionsAt(failedAt);
    const angry = await expressionsAt(angryAt);
    const wary = await expressionsAt(mark('outro-2', 'just') + 0.7);
    for (const [i, [role]] of TEAMMATES.entries()) {
      expect(failed[i], `${role}: the failed build lowers the lip corners`).toBeGreaterThan(curious[i] + 0.02);
      expect(angry[i], `${role}: his excuse deepens the angry mouth`).toBeGreaterThan(failed[i] + 0.02);
      expect(wary[i], `${role}: anger persists as he reaches for the keyboard`).toBeGreaterThan(failed[i] + 0.02);
    }
    expect(await expressionsAt(curiousAt), 'reverse seeking restores curiosity rather than retaining anger').toEqual(curious);
  }
});

test('palm gestures have continuous skin and extend the intended digit on both hands', async ({ page }) => {
  const problems = await page.evaluate(() => {
    const { OperaCast: C, SongKit: K } = window;
    const svg = K.svg('svg', { width: 160, height: 300, viewBox: '0 0 160 300' }, document.body);
    const body = C.buildFigure(svg, K.svg('g', {}, svg), 'tenor');
    const problems = [];
    for (const shape of ['point', 'fist', 'thumb', 'pinch', 'grip', 'open', 'spread', 'flat', 'rest', 'edge', 'support']) {
      for (const wrist of [-55, 0, 65]) {
        body.pose({ ...C.REST, right: C.reach([149, 80]), left: C.reach([149, 80]), rightShape: shape, leftShape: shape, rightHand: wrist, leftHand: wrist }, 0, 0, 0);
        for (const side of ['left', 'right']) {
          const arm = body.arms[side], hand = arm.hand;
          const shown = (node) => {
            for (let n = node; n && n !== hand; n = n.parentElement) if (getComputedStyle(n).display === 'none') return false;
            return true;
          };
          const skins = [...hand.querySelectorAll('.oc-skin')].filter(shown);
          const filled = (x, y) => skins.some((skin) => skin.isPointInFill(new DOMPoint(x, y).matrixTransform(skin.getCTM().inverse().multiply(hand.getCTM()))));
          // The palm must be solid between wrist and knuckles, including
          // the regions previously left as triangular holes by finger tubes.
          for (let y = 0.5; y <= 10; y += 0.5) for (let x = -3.5; x <= 3.5; x += 0.5) {
            if (!filled(x, y)) problems.push(`${shape}/${side}/${wrist}: skin hole at ${x},${y}`);
          }
          if (['point', 'thumb', 'open', 'spread', 'support'].includes(shape) && [...hand.querySelectorAll('.oc-nail')].some(shown)) {
            problems.push(`${shape}/${side}: nail on a palm-facing digit`);
          }
          if (shape === 'point' && (!filled(4, 24) || filled(-4, 24))) problems.push(`${side}: wrong pointing digit`);
          if (shape === 'thumb' && (!filled(6.5, 19) || filled(-3, 19))) problems.push(`${side}: wrong extended thumb`);
        }
      }
    }
    svg.remove();
    return problems;
  });
  expect(problems).toEqual([]);
});

test('working props keep their intended direction and the cane stays on the floor', async ({ page }) => {
  const samples = [
    ['tenor', 'trophy', mark('verse-2-5', 'a') + 0.1],
    ['tenor', 'broom', mark('verse-5-3', 'less')],
    ['tenor', 'broom', mark('verse-5-3', 'clutter') + 0.25],
    ['security', 'stamp', mark('security-8', 'rotate') - 0.2],
    ['security', 'stamp', mark('security-8', 'rotate') + 0.35],
    ['ui', 'cane', mark('ui-4', 'aged') + 0.2],
    ['ui', 'cane', mark('ui-4', 'overnight') + 0.2],
  ];
  for (const [role, name, time] of samples) {
    await seek(page, time);
    const prop = page.getByTestId(`oc-${role}`).getByTestId('oc-held-prop');
    const result = await prop.evaluateAll((nodes, name) => {
      const node = nodes.find((node) => node.dataset.prop === name);
      const svg = node.ownerSVGElement;
      const m = svg.getScreenCTM().inverse().multiply(node.getScreenCTM());
      const origin = new DOMPoint(0, 0).matrixTransform(m);
      const tip = new DOMPoint(...(name === 'broom' ? [108, 0] : name === 'cane' ? [3, 128] : [0, -10])).matrixTransform(m);
      return { x: tip.x - origin.x, y: tip.y - origin.y, tipY: tip.y };
    }, name);
    if (name === 'broom') expect(result.y, 'broom bristles point toward the floor').toBeGreaterThan(50);
    else if (name === 'cane') expect(Math.abs(result.tipY - 293), 'rigid cane reaches the floor while the actor leans').toBeLessThan(1.5);
    else {
      expect(Math.abs(result.x), `${name} stays upright during its stroke`).toBeLessThan(0.02);
      expect(result.y).toBeLessThan(0);
    }
  }
});

test('raised clipboards stay in front of the cuff on either hand', async ({ page }) => {
  const result = await page.evaluate(() => {
    const C = window.OperaCast, K = window.SongKit;
    const fixture = document.createElement('div');
    fixture.className = 'oc-figure oc-figure--pm';
    fixture.style.cssText = 'position:fixed;left:0;top:0;width:480px;height:900px;z-index:10000';
    document.body.appendChild(fixture);
    const svg = K.svg('svg', { viewBox: '0 0 160 300', width: 480, height: 900 }, fixture);
    const body = C.buildFigure(svg, K.svg('g', {}, svg), 'pm');
    const failures = [], overlaps = { left: 0, right: 0 };
    for (const side of ['left', 'right']) {
      body.hold(side, 'clipboard');
      for (const target of [[104, 80], [108, 76], [112, 72]]) {
        const joints = C.reach(target);
        body.pose({ ...C.REST, [side]: joints, [`${side}Hand`]: C.handToward(joints, -45) }, 0, 0, 0);
        body.level();
        const arm = body.arms[side];
        const board = arm.held.node.querySelector('.oc-board');
        const cuff = arm.fore.querySelector('.oc-cuff');
        board.style.pointerEvents = cuff.style.pointerEvents = 'all';
        for (let x = 0; x < 22; x += 1) for (let y = -12; y < 15; y += 1) {
          const screen = new DOMPoint(x, y).matrixTransform(board.getScreenCTM());
          if (!cuff.isPointInFill(screen.matrixTransform(cuff.getScreenCTM().inverse()))) continue;
          overlaps[side]++;
          const painted = document.elementsFromPoint(screen.x, screen.y).filter(node => node === board || node === cuff);
          if (painted[0] !== board) failures.push({ side, target, x, y });
        }
      }
      body.hold(side, null);
    }
    fixture.remove();
    return { failures, overlaps };
  });
  expect(result.overlaps.left, 'the raised left-hand clipboard overlaps cloth').toBeGreaterThan(0);
  expect(result.overlaps.right, 'the mirrored pose exercises the same crossing').toBeGreaterThan(0);
  expect(result.failures, 'the cuff must not paint through the solid clipboard').toEqual([]);
});
