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
const CAST = ['tenor', ...TEAMMATES.map(([role]) => role), 'hero'];
// The viewer's hero pushes him from the keyboard on the closing line.
const closingLine = () => mark('outro-3', 'keyboard');
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

test('held objects keep a closed contact and their required orientation through gestures', async ({ page }) => {
  const examples = [
    ['pm', 'left', 'clipboard', [-1, 0], ['pm-1', 'pm-2', 'pm-4']],
    ['build', 'left', 'wrench', [0, 0], ['build-1', 'build-2', 'build-4']],
    ['test', 'left', 'magnifier', [0, 0], ['test-1', 'test-2', 'test-4']],
    ['ui', 'left', 'palette', [1.6, 3], ['ui-1', 'ui-2', 'ui-4']],
    ['backend', 'left', 'mug', [-4, 0], ['backend-1', 'backend-2', 'backend-4']],
  ];
  for (const [role, side, prop, contact, lines] of examples) {
    for (const line of lines) {
      const { start, end } = storyLines.get(line);
      for (const time of [start + 0.1, (start + end) / 2, end - 0.65]) {
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
        const inHand = (x, y) => skins.some((skin) => skin.isPointInFill(new DOMPoint(x, y)
          .matrixTransform(skin.getScreenCTM().inverse().multiply(base.getScreenCTM()))));
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
        return paths.map((path, i) => {
          const origin = path.getPointAtLength(0).matrixTransform(path.getScreenCTM());
          const row = rows[i].getBoundingClientRect();
          const arrow = path.parentElement.querySelector('[data-testid="mk-client-arrow"]');
          const tip = arrow.getPointAtLength(0).matrixTransform(arrow.getScreenCTM());
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
    const downturned = await mouth.locator('.song-hero-expression-seam').evaluate((seam) => {
      const length = seam.getTotalLength();
      const left = seam.getPointAtLength(0), middle = seam.getPointAtLength(length / 2), right = seam.getPointAtLength(length);
      return left.y > middle.y && right.y > middle.y;
    });
    expect(downturned, `${role}: a complaint must not retain the default smile`).toBe(true);
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
      const m = svg.getCTM().inverse().multiply(node.getCTM());
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
