const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { startLocalSiteServer } = require('../scripts/local-site-server');

const storyboard = yaml.load(fs.readFileSync(path.join(__dirname, '../_data/songs/it_works_on_my_machine.yml'), 'utf8'));
const lines = new Map(storyboard.sections.flatMap(section => section.lines).map(line => [line.id, line]));
const mark = (line, word) => lines.get(line).marks[word];
let sourceServer;
let stageUrl;
const RELEASE = mark('backend-4', 'gone');
const CLIPBOARD_RELEASE = mark('pm-4', 'wrong');
const PALETTE_RELEASE = mark('ui-4', 'overnight');
const PACKAGE_RELEASE = mark('build-1', 'new');
const FINALE = lines.get('refrain-3-1').start + 1;
const INCIDENTS = [
  { name: 'requirements', before: CLIPBOARD_RELEASE - 0.01, settled: CLIPBOARD_RELEASE + 3 },
  { name: 'dependencies', before: PACKAGE_RELEASE - 0.01, settled: PACKAGE_RELEASE + 3 },
  { name: 'tests', before: lines.get('test-2').start - 1, settled: lines.get('test-3').end },
  { name: 'coupling', before: PALETTE_RELEASE - 0.12, settled: 171 },
  { name: 'coffee', before: RELEASE - 0.1, settled: RELEASE + 3 },
  { name: 'secrets', before: mark('security-4', 'launch') - 0.1, settled: lines.get('security-4').end + 1 },
];

const renderErrors = new WeakMap();
test.beforeAll(async () => {
  const configuredBaseUrl = process.env.SONG_AFTERMATH_BASE_URL;
  if (!configuredBaseUrl) sourceServer = await startLocalSiteServer({ rootDirectory: path.resolve(__dirname, '..') });
  stageUrl = `${configuredBaseUrl || sourceServer.baseUrl}/scripts/song-video/stage.html?song=it_works_on_my_machine`;
});

test.afterAll(async () => {
  if (sourceServer) await sourceServer.close();
});

test.beforeEach(async ({ page }) => {
  const errors = [];
  renderErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
});

test.afterEach(async ({ page }) => {
  expect(renderErrors.get(page), 'the source stage renders and seeks without script or asset errors').toEqual([]);
});

async function openStage(page, motion = 'no-preference') {
  await page.emulateMedia({ reducedMotion: motion });
  await page.goto(stageUrl);
  await page.evaluate(() => window.songVideo.ready);
}

async function seek(page, time) {
  await page.evaluate(t => window.songVideo.seek(t), time);
}

// This decorative SVG/HTML artwork has no interactive role. Its stable test IDs
// identify the pictured objects. Playwright visibility alone ignores opacity,
// so measure paint eligibility through the element and its ancestors as well.
async function paintedBounds(locator) {
  return locator.evaluateAll(nodes => nodes.flatMap(node => {
    const bounds = node.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return [];
    let opacity = 1;
    for (let element = node; element; element = element.parentElement) {
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') return [];
      opacity *= Number(style.opacity);
    }
    return opacity > 0.01 ? [{ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }] : [];
  }));
}

async function painted(locator) {
  return (await paintedBounds(locator)).length > 0;
}

async function expectPainted(page, name, expected, reason) {
  await expect.poll(() => painted(page.getByTestId(`aftermath-${name}`)), { message: reason }).toBe(expected);
}

async function expectResidues(page, names, reason) {
  for (const { name } of INCIDENTS) {
    await expectPainted(page, name, names.includes(name), `${reason}: ${name}`);
  }
}

test('the office opens with its permanent paper bin and no aftermath', async ({ page }) => {
  await openStage(page);
  await seek(page, 0);
  await expect(page.getByTestId('aftermath-bin')).toHaveCount(1);
  await expectPainted(page, 'bin', true, 'the empty bin is present from the opening');
  await expectResidues(page, [], 'the opening office is clean');
});

for (const [index, incident] of INCIDENTS.entries()) {
  test(`${incident.name} leaves its trace after the action and keeps earlier damage`, async ({ page }) => {
    await openStage(page);
    await seek(page, incident.before);
    await expectPainted(page, incident.name, false, `${incident.name} has not happened yet`);
    await seek(page, incident.settled);
    await expectResidues(page, INCIDENTS.slice(0, index + 1).map(item => item.name), 'only completed incidents have residue');
  });
}

test('direct and backward seeks reconstruct the same six settled traces', async ({ page }) => {
  await openStage(page);
  await seek(page, FINALE);
  await expectResidues(page, INCIDENTS.map(item => item.name), 'direct seek to the finale');
  const direct = await Promise.all(INCIDENTS.map(({ name }) => page.getByTestId(`aftermath-${name}`).boundingBox()));
  await seek(page, 0);
  await expectResidues(page, [], 'seeking back removes events that have not happened');
  for (const incident of INCIDENTS) await seek(page, incident.settled);
  await seek(page, FINALE);
  await expectResidues(page, INCIDENTS.map(item => item.name), 'replaying all incidents retains the same six groups');
  const replay = await Promise.all(INCIDENTS.map(({ name }) => page.getByTestId(`aftermath-${name}`).boundingBox()));
  for (const [index, { name }] of INCIDENTS.entries()) {
    expect(replay[index], `${name} settles at the same position regardless of seek history`).toEqual(direct[index]);
    await expect(page.getByTestId(`aftermath-${name}`), `${name} is not duplicated by replay`).toHaveCount(1);
  }
  await seek(page, lines.get('outro-2').start);
  await expectResidues(page, INCIDENTS.map(item => item.name), 'all six groups remain through the outro');
});

test('scorch flames grow through the outro without depending on playback history', async ({ page }) => {
  const launch = mark('security-4', 'launch') + 0.2;
  const earlyTime = launch + 3, lateTime = mark('outro-3', 'keyboard_2') + 2.3;
  async function flameState() {
    return page.getByTestId('aftermath-flames').evaluate(node => {
      const toStage = node.ownerSVGElement.getScreenCTM().inverse();
      return [...node.querySelectorAll('.ta-flame-shell')].flatMap(flame => {
        for (let ancestor = flame; ancestor; ancestor = ancestor.parentElement) {
          if (getComputedStyle(ancestor).display === 'none') return [];
        }
        const matrix = toStage.multiply(flame.getScreenCTM());
        const length = flame.getTotalLength();
        const points = Array.from({ length: 65 }, (_, i) =>
          flame.getPointAtLength(length * i / 64).matrixTransform(matrix));
        const xs = points.map(point => point.x), ys = points.map(point => point.y);
        const width = Math.max(...xs) - Math.min(...xs), height = Math.max(...ys) - Math.min(...ys);
        const outline = path => {
          const length = path.getTotalLength();
          return Array.from({ length: 17 }, (_, i) => {
            const point = path.getPointAtLength(length * i / 16);
            return [point.x, point.y];
          }).flat();
        };
        return [{ width, height, x: Math.min(...xs), y: Math.min(...ys), opacity: getComputedStyle(flame).opacity,
          root: [matrix.e, matrix.f], shape: outline(flame),
          core: outline(flame.parentElement.querySelector('.ta-flame-core')) }];
      });
    });
  }
  await openStage(page);
  await seek(page, lateTime);
  const direct = await flameState();
  await seek(page, launch - 0.01);
  await expectPainted(page, 'flames', false, 'there is no fire before the rocket exhaust');
  await seek(page, launch + 0.1);
  await expectPainted(page, 'flames', false, 'flames wait until the nozzle has passed the wall');
  await seek(page, earlyTime);
  const early = await flameState();
  expect(early, 'three small fires remain after the rocket clears the wall').toHaveLength(3);
  await seek(page, lateTime);
  const late = await flameState();
  expect(late, 'direct and forward seeks reconstruct the same growth').toEqual(direct);
  expect(late.length, 'the fire gradually spreads to nearby tongues').toBeGreaterThan(early.length);
  expect(late.length, 'the scorch retains only a few small flames').toBeLessThanOrEqual(7);
  const coverage = flames => {
    const left = Math.min(...flames.map(flame => flame.x)), top = Math.min(...flames.map(flame => flame.y));
    return (Math.max(...flames.map(flame => flame.x + flame.width)) - left)
      * (Math.max(...flames.map(flame => flame.y + flame.height)) - top);
  };
  expect(coverage(late), 'more of the scorched wall becomes involved before the curtain closes').toBeGreaterThan(coverage(early) * 1.5);
  for (let i = 0; i < early.length; i++) {
    expect(late[i].width * late[i].height, 'the original flames grow through the remaining song')
      .toBeGreaterThan(early[i].width * early[i].height * 1.5);
  }
  for (const flame of late) {
    expect(flame.opacity, 'flame paint stays opaque instead of flashing').toBe('1');
    expect(flame.x).toBeGreaterThan(590);
    expect(flame.x + flame.width).toBeLessThan(690);
    expect(flame.y).toBeGreaterThan(100);
    expect(flame.y + flame.height).toBeLessThan(240);
  }
  await seek(page, earlyTime);
  expect(await flameState(), 'rewinding restores the earlier small flames exactly').toEqual(early);
  await seek(page, earlyTime + 0.4);
  const curling = await flameState();
  expect(curling[0].root, 'flame motion remains attached to the same burned spot').toEqual(early[0].root);
  for (const part of ['shape', 'core']) {
    expect(Math.max(...curling[0][part].map((value, i) => Math.abs(value - early[0][part][i]))),
      'the flame silhouette and inner core curl instead of swiveling as rigid stickers').toBeGreaterThan(0.3);
  }

  await openStage(page, 'reduce');
  await seek(page, earlyTime);
  const reducedEarly = await flameState();
  await seek(page, lateTime);
  const reducedLate = await flameState();
  expect(reducedLate.length, 'reduced motion retains the slowly spreading fire').toBe(late.length);
  for (let i = 0; i < reducedEarly.length; i++) {
    expect(reducedLate[i].width * reducedLate[i].height, 'slow growth remains in reduced motion')
      .toBeGreaterThan(reducedEarly[i].width * reducedEarly[i].height * 1.5);
    reducedLate[i].shape.forEach((value, axis) => expect(value, 'reduced-motion tongues do not sway or stretch')
      .toBeCloseTo(reducedEarly[i].shape[axis], 6));
    expect(reducedLate[i].core, 'reduced-motion inner fire retains its still silhouette').toEqual(reducedEarly[i].core);
  }
  await seek(page, lateTime - .5);
  const beforeCurtain = await flameState();
  expect(reducedLate[0].height, 'slow growth continues until the curtain finishes closing').toBeGreaterThan(beforeCurtain[0].height);
});

for (const motion of ['no-preference', 'reduce']) {
  test(`paint and coffee keep dripping downward through the remaining song (${motion})`, async ({ page }) => {
    await openStage(page, motion);
    async function bounds(selector) {
      return page.locator(selector).evaluateAll(nodes => {
        if (!nodes.length) return null;
        const points = nodes.flatMap(node => {
          const box = node.getBBox();
          const m = node.ownerSVGElement.getScreenCTM().inverse().multiply(node.getScreenCTM());
          return [[box.x, box.y], [box.x + box.width, box.y + box.height]]
            .map(point => new DOMPoint(...point).matrixTransform(m));
        });
        const x = Math.min(...points.map(point => point.x)), y = Math.min(...points.map(point => point.y));
        return { x, y, width: Math.max(...points.map(point => point.x)) - x,
          bottom: Math.max(...points.map(point => point.y)) };
      });
    }
    const end = mark('outro-3', 'keyboard_2') + .7;
    for (const { name, from, trail, head } of [
      { name: 'paint', from: PALETTE_RELEASE + 3, trail: '.ta-paint-drip', head: '.ta-paint-pool' },
      { name: 'coffee', from: RELEASE + 3, trail: '[data-aftermath-art="drips"]', head: '[data-testid="aftermath-coffee"]' },
    ]) {
      await seek(page, from);
      const early = await bounds(trail), splash = await bounds(head);
      expect(early, `${name} has distinct trails below its splash`).not.toBeNull();
      await seek(page, end - 8);
      const nearEnd = await bounds(trail);
      await seek(page, end);
      const late = await bounds(trail);
      expect(late.bottom - early.bottom, `${name} visibly lengthens over the remaining song`).toBeGreaterThan(40);
      expect(late.bottom - early.bottom).toBeLessThan(70);
      expect(late.bottom - nearEnd.bottom, `${name} continues running near the closing line`).toBeGreaterThan(1);
      expect(late.bottom, `${name} remains on the wall`).toBeLessThan(404);
      expect(late.x, `${name} does not drift sideways`).toBeCloseTo(early.x, 6);
      expect(late.width, `${name} does not widen as it drips`).toBeCloseTo(early.width, 6);
      expect(late.y, `${name} retains the original wall root`).toBeCloseTo(early.y, 6);
      expect(await bounds(head), `${name} splash head is not stretched`).toEqual(splash);
      await seek(page, from);
      expect(await bounds(trail), `${name} rewinds to the same earlier drip length`).toEqual(early);
      await seek(page, 0);
      await seek(page, end);
      expect(await bounds(trail), `${name} direct seek does not depend on previous flow`).toEqual(late);
    }
  });
}

test('the Product Manager throws the held clipboard into the bin without replacing it in the hand', async ({ page }) => {
  await openStage(page);
  const held = page.getByTestId('oc-pm').getByTestId('oc-arm-left').getByTestId('oc-held-prop');
  await seek(page, CLIPBOARD_RELEASE - 0.01);
  await expect(held).toHaveCount(1);
  await expect(held).toHaveAttribute('data-prop', 'clipboard');
  await expectPainted(page, 'requirements', false, 'the clipboard is still held before the throw');
  for (const time of [CLIPBOARD_RELEASE, CLIPBOARD_RELEASE + 0.01, CLIPBOARD_RELEASE + 3, FINALE]) {
    await seek(page, time);
    await expect(held, 'the thrown clipboard cannot remain or respawn in the carrying hand').toHaveCount(0);
    await expectPainted(page, 'requirements', true, 'the same clipboard remains in flight or in the bin');
    await expect(page.getByTestId('aftermath-requirements')).toHaveCount(1);
  }
  await seek(page, CLIPBOARD_RELEASE - 0.01);
  await expect(held, 'seeking before the throw restores the original held clipboard once').toHaveCount(1);
  await expectPainted(page, 'requirements', false, 'reverse seeking removes the discarded copy');
});

test('the UI Developer releases the held palette once and leaves paint on the wall', async ({ page }) => {
  await openStage(page);
  const held = page.getByTestId('oc-ui').getByTestId('oc-arm-right').getByTestId('oc-held-prop');
  await seek(page, PALETTE_RELEASE - 0.01);
  await expect(held).toHaveCount(1);
  await expect(held).toHaveAttribute('data-prop', 'palette');
  await expectPainted(page, 'coupling', false, 'the wall is unpainted before the throw');
  await expectPainted(page, 'flying-palette', false, 'the palette is still owned by its hand before release');
  for (const time of [PALETTE_RELEASE, PALETTE_RELEASE + 0.01, 171, FINALE]) {
    await seek(page, time);
    await expect(held, 'the thrown palette cannot remain or respawn in the carrying hand').toHaveCount(0);
    await expectPainted(page, 'flying-palette', true, 'the same palette stays visible in flight or settled below the paint');
    await expect(page.getByTestId('aftermath-flying-palette')).toHaveCount(1);
  }
  await expectPainted(page, 'coupling', true, 'the paint from the thrown palette remains through the finale');
  await expect(page.getByTestId('aftermath-coupling')).toHaveCount(1);
  await seek(page, PALETTE_RELEASE - 0.01);
  await expect(held, 'seeking before the throw restores the original held palette once').toHaveCount(1);
  await expectPainted(page, 'coupling', false, 'reverse seeking restores the unpainted wall');
  await expectPainted(page, 'flying-palette', false, 'reverse seeking removes the released palette');
});

test('the displaced package dents on landing and rests flat on the floor', async ({ page }) => {
  await openStage(page);
  const box = page.getByTestId('aftermath-dependencies');
  async function packageGeometry() {
    return box.evaluate(node => {
      const front = node.querySelector('.mk-box');
      const toStage = node.ownerSVGElement.getScreenCTM().inverse();
      const points = [...node.querySelectorAll('.mk-box, .mk-box-top, .mk-box-side')].flatMap(face => {
        const matrix = toStage.multiply(face.getScreenCTM());
        const length = face.getTotalLength();
        return Array.from({ length: 501 }, (_, i) => face.getPointAtLength(length * i / 500).matrixTransform(matrix));
      });
      const bottom = Math.max(...points.map(point => point.y));
      const base = points.filter(point => point.y > bottom - 0.5);
      const width = Math.max(...points.map(point => point.x)) - Math.min(...points.map(point => point.x));
      // Compare the actual filled face, not its path commands: a dent removes
      // area from its otherwise rectangular silhouette after floor contact.
      const bounds = front.getBBox();
      let filled = 0;
      for (let x = bounds.x + 0.25; x < bounds.x + bounds.width; x += 0.5) {
        for (let y = bounds.y + 0.25; y < bounds.y + bounds.height; y += 0.5) {
          if (front.isPointInFill(new DOMPoint(x, y))) filled += 0.25;
        }
      }
      return { bottom, baseSpan: Math.max(...base.map(point => point.x)) - Math.min(...base.map(point => point.x)), width, filled };
    });
  }
  await seek(page, PACKAGE_RELEASE + 0.3);
  await expectPainted(page, 'dependencies', true, 'the original old package is in flight');
  const airborne = await packageGeometry();
  expect(airborne.bottom, 'the undamaged package has not contacted the floor').toBeLessThan(404);
  expect(await painted(box.locator('.tm-aftermath-box-crease')), 'no impact creases before contact').toBe(false);
  for (const time of [PACKAGE_RELEASE + 3, FINALE]) {
    await seek(page, time);
    const settled = await packageGeometry();
    expect(Math.abs(settled.bottom - 414), 'the painted box bottom rests on the upstage floor plane').toBeLessThanOrEqual(2);
    expect(settled.baseSpan / settled.width, 'a broad flat base supports the box, rather than one tilted corner').toBeGreaterThan(0.7);
    expect(settled.filled, 'the floor impact leaves a small dent in the front silhouette').toBeLessThan(airborne.filled);
    expect(await painted(box.locator('.tm-aftermath-box-crease')), 'the impact crease remains visible').toBe(true);
    await expect(box.locator('.mk-box-version')).toHaveText('1.4.2');
  }
});

test('the Product Manager phone stays visibly clear of the permanent bin', async ({ page }) => {
  await openStage(page);
  for (const time of [35, 43]) {
    await seek(page, time);
    const phones = await paintedBounds(page.locator('.mk-phone-art'));
    expect(phones, `one instructional phone is visible at ${time}s`).toHaveLength(1);
    const bin = await page.getByTestId('aftermath-bin').boundingBox();
    expect(bin).not.toBeNull();
    const phone = phones[0];
    const overlapX = Math.min(phone.x + phone.width, bin.x + bin.width) - Math.max(phone.x, bin.x);
    const overlapY = Math.min(phone.y + phone.height, bin.y + bin.height) - Math.max(phone.y, bin.y);
    expect(overlapX <= 0 || overlapY <= 0, `the phone and bin do not overlap at ${time}s`).toBe(true);
  }
});

test('the thrown mug has one owner at release and never returns to the hand', async ({ page }) => {
  await openStage(page);
  const hand = page.getByTestId('oc-backend').getByTestId('oc-arm-left');
  const held = hand.getByTestId('oc-held-prop');
  await seek(page, RELEASE - 0.01);
  await expect(held).toHaveCount(1);
  await expect(held).toHaveAttribute('data-prop', 'mug');
  await expectPainted(page, 'flying-mug', false, 'the mug is still held before release');
  for (const time of [RELEASE, RELEASE + 0.01]) {
    await seek(page, time);
    await expect(held, 'release empties the original carrying hand').toHaveCount(0);
    await expectPainted(page, 'flying-mug', true, 'one free mug continues from the hand');
    await expect(page.getByTestId('aftermath-flying-mug')).toHaveCount(1);
  }
  for (const time of [RELEASE + 3, FINALE, lines.get('outro-2').start]) {
    await seek(page, time);
    await expect(held, 'the thrown mug cannot respawn during later poses').toHaveCount(0);
    await expectPainted(page, 'flying-mug', false, 'the flying mug disappears after impact');
    await expectPainted(page, 'coffee', true, 'the coffee impact remains after the mug breaks');
  }
  await seek(page, RELEASE - 0.01);
  await expect(held, 'seeking before the throw restores the original held mug once').toHaveCount(1);
  await expectPainted(page, 'flying-mug', false, 'reverse seek removes the free-flight copy');
});

test('reduced motion retains all settled outcomes without a flying mug', async ({ page }) => {
  await openStage(page, 'reduce');
  await seek(page, RELEASE - 0.01);
  await expectPainted(page, 'coffee', false, 'reduced motion does not show coffee before the throw');
  await seek(page, RELEASE + 0.01);
  await expectPainted(page, 'coffee', true, 'reduced motion shows the impact result at release');
  await expectPainted(page, 'flying-mug', false, 'reduced motion omits rapid mug flight');
  await seek(page, FINALE);
  await expectResidues(page, INCIDENTS.map(item => item.name), 'reduced motion keeps every lasting consequence');
  // The paint trails continue their deliberately slow flow. Its fixed splash
  // head, the coffee stain, and all rigid props retain their settled anchors.
  const fixedBounds = () => Promise.all(INCIDENTS.map(({ name }) => paintedBounds(name === 'coupling'
    ? page.getByTestId('aftermath-coupling').locator('.ta-paint-pool')
    : page.getByTestId(`aftermath-${name}`))));
  const settled = await fixedBounds();
  await seek(page, FINALE + 3);
  expect(await fixedBounds(), 'reduced-motion props and splash heads keep their settled positions').toEqual(settled);
});

test('a fresh reduced-motion scene keeps the canonical coffee impact position', async ({ page, context }) => {
  await openStage(page);
  await seek(page, RELEASE + 3);
  await expectPainted(page, 'coffee', true, 'the normal-motion stain has settled');
  const canonical = await page.getByTestId('aftermath-coffee').boundingBox();
  const reduced = await context.newPage();
  reduced.on('pageerror', error => renderErrors.get(page).push(error.message));
  reduced.on('console', message => {
    if (message.type() === 'error') renderErrors.get(page).push(message.text());
  });
  try {
    // A fresh scene must not depend on a normal-motion release having already
    // populated a cache, or derive a different impact from a static hand pose.
    await openStage(reduced, 'reduce');
    await seek(reduced, RELEASE + 3);
    await expectPainted(reduced, 'coffee', true, 'direct reduced-motion seek paints the same impact');
    expect(await reduced.getByTestId('aftermath-coffee').boundingBox(), 'motion preference does not move the wall stain').toEqual(canonical);
    await reduced.emulateMedia({ reducedMotion: 'no-preference' });
    await seek(reduced, RELEASE - 1);
    await seek(reduced, RELEASE + 3);
    expect(await reduced.getByTestId('aftermath-coffee').boundingBox(), 'changing preference and rewinding preserves that contact').toEqual(canonical);
  } finally {
    await reduced.close();
  }
});
