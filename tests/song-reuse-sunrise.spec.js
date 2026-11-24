// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { openPlayerSettings } = require('./song-player-helpers');

const song = yaml.load(fs.readFileSync(path.join(__dirname, '../_data/songs/not_a_one_time_investment.yml'), 'utf8'));
const EARLY = 12; // The ground-floor bases are complete; the sky is still dawn.
const MIDDLE = song.duration / 2;
const LATE = song.duration - 1;

// These decorative test IDs are stable artwork hooks, not accessibility
// labels: the player supplies the equivalent visual description separately.
async function sunrisePicture(page) {
  const sun = await page.getByTestId('reuse-sun').boundingBox();
  const opacity = (id) => page.getByTestId(id).evaluate(node => Number(getComputedStyle(node).opacity));
  const light = (id) => page.getByTestId(id).evaluateAll(nodes => nodes.reduce((sum, node) => sum + Number(getComputedStyle(node).opacity), 0));
  const roomBrightness = await page.getByTestId('reuse-window-light').evaluateAll(nodes => nodes.map(node => Number(getComputedStyle(node).opacity)));
  return {
    sunTop: Math.round(sun.y * 100) / 100,
    sunLeft: Math.round(sun.x * 100) / 100,
    cloudLight: await page.getByTestId('reuse-cloud-highlight').evaluate(node => getComputedStyle(node).stopColor),
    morning: await opacity('reuse-morning-sky'),
    stars: await opacity('reuse-stars'),
    roomBrightness,
    windows: roomBrightness.reduce((sum, brightness) => sum + brightness, 0),
    reflectedSky: await page.getByTestId('reuse-window-sky-reflection').evaluate(node => getComputedStyle(node).stopColor),
    lamps: await light('reuse-lamp-glow'),
  };
}

// The same public absolute-time renderer drives native audio and exports.
// Isolating it here keeps the dawn check independent of media codec support.
async function seek(page, time) {
  await page.evaluate(time => window.Timeline.seek(time), time);
}

const paintOpacity = locator => locator.evaluate(node => {
  let opacity = 1;
  for (let current = node; current; current = current.parentElement) {
    const style = getComputedStyle(current);
    if (style.display === 'none' || style.visibility === 'hidden') return 0;
    opacity *= Number(style.opacity);
  }
  return opacity;
});
const painted = async locator => (await paintOpacity(locator)) > 0;

async function buildingHeights(page) {
  return page.getByTestId('reuse-building-courses').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute('height'))));
}

async function heroFooting(page) {
  return page.getByTestId('oc-foreman').evaluate(hero => {
    const stage = document.querySelector('.bs-art').getBoundingClientRect();
    const feet = [...hero.querySelectorAll('.oc-sole')].map(node => node.getBoundingClientRect());
    const x = (Math.min(...feet.map(r => r.left)) + Math.max(...feet.map(r => r.right))) / 2;
    const y = Math.max(...feet.map(r => r.bottom));
    const localX = (x - stage.x) * 960 / stage.width;
    const roofs = [...document.querySelectorAll('[data-testid="reuse-site-roof-course"]')]
      .map(node => node.getBBox()).filter(r => localX >= r.x && localX <= r.x + r.width);
    const courses = document.querySelectorAll('[data-testid="reuse-building-courses"]');
    // Clip-path geometry has no painted screen box in Chromium/Firefox.
    const laid = Number(courses[courses.length - 1].getAttribute('y'));
    const roof = Math.min(...roofs.map(r => r.y));
    return {
      x: localX,
      y: (y - stage.y) * 540 / stage.height,
      support: Math.max(laid, roof),
    };
  });
}

// Compare the sun and painted highlights in their shared SVG viewport.
// WebKit's getScreenCTM omits the stage's CSS scaling; mixing it with a
// screen bounding box would measure unrelated coordinate systems.
async function cloudLightAxes(page) {
  return page.getByTestId('reuse-cloud-bank').evaluateAll(banks => banks.map(bank => {
    const shape = bank.querySelector('[data-testid="reuse-cloud-shape"]');
    const light = bank.querySelector('[data-testid="reuse-cloud-light-direction"]');
    const point = end => {
      const local = new DOMPoint(Number(light.getAttribute(`x${end}`)), Number(light.getAttribute(`y${end}`)));
      const viewport = local.matrixTransform(shape.getCTM());
      return { x: viewport.x, y: viewport.y };
    };
    return { from: point(1), to: point(2) };
  }));
}

// Measure painted details relative to their bank, so a moving bank alone
// cannot satisfy the local-motion check. SVG coordinates avoid zoom effects.
async function cloudDetails(page) {
  return page.getByTestId('reuse-cloud-bank').evaluateAll(banks => banks.map(bank => {
    const shape = bank.querySelector('[data-testid="reuse-cloud-shape"]');
    const toLocal = shape.getCTM().inverse();
    const position = id => {
      const detail = bank.querySelector(`[data-testid="${id}"] path`);
      const bounds = detail.getBBox();
      const local = new DOMPoint(bounds.x, bounds.y).matrixTransform(detail.getCTM()).matrixTransform(toLocal);
      return [Number(local.x.toFixed(3)), Number(local.y.toFixed(3))];
    };
    return { folds: position('reuse-cloud-folds'), wisps: position('reuse-cloud-edge-wisps'), width: shape.getBBox().width };
  }));
}

// Sample the painted silhouette in its own coordinates, excluding bank drift.
async function cloudSilhouettes(page) {
  return page.getByTestId('reuse-cloud-outline').evaluateAll(paths => paths.map(path => {
    const length = path.getTotalLength();
    return Array.from({ length: 24 }, (_, i) => {
      const point = path.getPointAtLength(length * i / 24);
      return [Number(point.x.toFixed(3)), Number(point.y.toFixed(3))];
    });
  }));
}

async function ambientPositions(page) {
  const clouds = await page.getByTestId('reuse-cloud-bank').evaluateAll(nodes => nodes.map(node => {
    const rect = node.getBoundingClientRect();
    return [rect.x, rect.y];
  }));
  const truck = await page.getByTestId('reuse-site-forklift').boundingBox();
  return { clouds, silhouettes: await cloudSilhouettes(page), details: await cloudDetails(page), highlights: await cloudLightAxes(page), truck: [truck.x, truck.y] };
}

test('Not a One-Time Investment: patch outcomes hold long enough to read before the next picture', async ({ page }) => {
  await page.goto(song.player);
  const lyric = id => song.sections.flatMap(section => section.lines).find(line => line.id === id);
  const fixedDate = page.getByText('7 April: 1.0.1g', { exact: true });
  const passed = page.getByTestId('reuse-patch-result').getByText('✓ all tests passed', { exact: true });
  for (const [time, outcome] of [
    [lyric('v3-9').marks.fix + 0.35, fixedDate],
    [lyric('v3-9').marks.week + 0.55, fixedDate],
    [lyric('v3-14').marks.test + 0.8, passed],
    [lyric('v3-9').marks.week + 0.55, fixedDate],
  ]) {
    await seek(page, time);
    expect(await paintOpacity(outcome), 'the result holds at full opacity instead of disappearing during its entrance').toBeGreaterThan(0.95);
  }
});

for (const reducedMotion of ['no-preference', 'reduce']) {
  test(`Not a One-Time Investment: unsupported dependencies land on their platform (${reducedMotion})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await page.goto(song.player);
    await page.getByRole('checkbox', { name: 'Use lyrics-only mode' }).uncheck();
    await expect(page.getByTestId('song-picture')).toBeVisible();
    const supportRemoved = song.sections.flatMap(section => section.lines).find(line => line.id === 'v4-5').marks.unpublished;
    const column = page.getByTestId('reuse-fallen-dependencies');
    const platform = page.getByTestId('reuse-dependency-platform');
    await seek(page, supportRemoved - 0.1);
    const supported = await column.boundingBox();
    const base = await platform.boundingBox();
    const scale = base.width / 380;
    const poses = [];
    for (const time of [supportRemoved + 1.4, supportRemoved - 0.1, supportRemoved + 1.4]) {
      await seek(page, time);
      poses.push(await column.boundingBox());
      expect(await paintOpacity(column), 'the collapse stays visible throughout the fall').toBeGreaterThan(0.95);
    }
    expect(poses[0].y - supported.y, 'the unsupported column drops into the missing support space').toBeGreaterThan(40 * scale);
    expect(Math.abs(poses[0].y + poses[0].height - base.y), 'the falling column rests on the platform').toBeLessThan(3 * scale);
    expect(poses[1], 'rewinding restores the intact stack').toEqual(supported);
    expect(poses[2], 'replaying restores the same settled collapse').toEqual(poses[0]);

    const failed = song.sections.flatMap(section => section.lines).find(line => line.id === 'v4-6').marks.failed;
    await seek(page, failed + 0.35);
    const errors = page.getByTestId('reuse-build-error');
    await expect(errors).toHaveCount(3);
    expect(await paintOpacity(column), 'the tower remains visible while the build failures appear').toBeGreaterThan(0.95);
    const stage = await page.locator('.stage').boundingBox();
    for (const error of await errors.all()) {
      await expect(error).toContainText('npm ERR! 404');
      expect(await paintOpacity(error), 'each build failure can be read alongside the tower').toBeGreaterThan(0.95);
      const bounds = await error.boundingBox();
      expect(bounds.y, 'build errors sit below the tower and its platform').toBeGreaterThan(base.y + base.height);
      expect(bounds.y + bounds.height, 'build errors stay above the caption reserve').toBeLessThan(stage.y + 460 * scale);
    }
  });
}

for (const [number, word, answerPicture] of [
  [1, 'one', 'const isEven = (n) => n % 2 === 0;'],
  [2, 'reuse', 'vetted crypto library'],
]) {
  test(`Not a One-Time Investment: quiz ${number} reveals its solution on the sung answer`, async ({ page }) => {
    await page.goto(song.player);
    const q = song.sections.flatMap(section => section.lines).find(line => line.id === `quiz-${number}`);
    const art = page.getByTestId(`reuse-quiz-art-${number}`);
    const solution = art.getByText(answerPicture, { exact: true });
    for (const [time, visible] of [[q.answer_at + 0.2, false], [q.marks[word] + 0.6, true], [q.pause_at, false]]) {
      await seek(page, time);
      expect(await painted(solution), `solution visibility at ${time}s`).toBe(visible);
    }
  });
}

test('Not a One-Time Investment: the quiz previews the pinned version but waits to update until the answer', async ({ page }) => {
  await page.goto(song.player);
  const q = song.sections.flatMap(section => section.lines).find(line => line.id === 'quiz-3');
  const art = page.getByTestId('reuse-quiz-art-3');
  await seek(page, q.pause_at);
  expect(await paintOpacity(art.getByText('==3.4.1 · pinned', { exact: true }))).toBeGreaterThan(0.95);
  expect(await painted(art.locator('.rk-term')), 'test results stay hidden until the answer').toBe(false);
  await seek(page, q.answer_at + 0.2);
  expect(await painted(art.getByText('==3.4.1 · pinned', { exact: true }))).toBe(true);
  await seek(page, q.marks.then + 0.2);
  expect(await painted(art.getByText('==3.4.2 · pinned', { exact: true }))).toBe(true);
  await seek(page, q.answer_at + 0.2);
  expect(await painted(art.getByText('==3.4.1 · pinned', { exact: true }))).toBe(true);
});

for (const [number, premise] of [
  [3, 'Security fix: 3.4.2'],
  [4, 'Europe: 3 April'],
  [5, 'shared module'],
]) {
  test(`Not a One-Time Investment: quiz ${number} keeps its setup readable at the pause without revealing the answer`, async ({ page }) => {
    await page.goto(song.player);
    const q = song.sections.flatMap(section => section.lines).find(line => line.id === `quiz-${number}`);
    // Include a rewind from the solution: question/premise visibility must
    // depend on song time, not on whether the answer has already been seen.
    for (const time of [q.start + 2, q.answer_at + 0.7, q.pause_at]) {
      await seek(page, time);
      if (time > q.answer_at) continue;
      const question = page.locator('.stage').getByText(q.text, { exact: true });
      const art = page.getByTestId(`reuse-quiz-art-${number}`);
      expect(await paintOpacity(question), 'the question does not fade while waiting for the learner').toBeGreaterThan(0.95);
      expect(await paintOpacity(art.getByText(premise, { exact: true })), 'the premise is available before the answer').toBeGreaterThan(0.95);
      expect(await painted(question.locator('..').locator('.rk-quiz-answer')), 'the answer remains hidden').toBe(false);
      const prompt = await question.boundingBox();
      const visibleText = await art.locator('.rk-label, .rk-note, .rk-pkg-name').all();
      for (const label of visibleText) {
        if (await paintOpacity(label) < 0.95) continue;
        const box = await label.boundingBox();
        expect(box.y, 'problem artwork stays below the question').toBeGreaterThan(prompt.y + prompt.height);
      }
    }
  });
}

test('Not a One-Time Investment: both apps settle on separate modules before the quiz advances', async ({ page }) => {
  await page.goto(song.player);
  const q = song.sections.flatMap(section => section.lines).find(line => line.id === 'quiz-5');
  const art = page.getByTestId('reuse-quiz-art-5');
  const appA = art.getByText('App A', { exact: true });
  const appB = art.getByText('App B', { exact: true });
  await seek(page, q.pause_at);
  expect(await painted(art.getByText('shared module', { exact: true }))).toBe(true);
  const beforeA = await appA.boundingBox();
  const beforeB = await appB.boundingBox();
  expect(beforeA.y - beforeB.y, 'the problem picture shows B displaced').toBeGreaterThan(beforeA.height / 2);
  await seek(page, q.end - 0.3);
  const afterA = await appA.boundingBox();
  const afterB = await appB.boundingBox();
  const secondModule = art.getByText('module v2', { exact: true });
  expect(await painted(art.getByText('module v1', { exact: true }))).toBe(true);
  expect(Math.abs(afterA.y - afterB.y), 'both apps are back at the same supported level').toBeLessThan(1);
  expect(await paintOpacity(secondModule), 'the completed solution is fully visible before the next question').toBeGreaterThan(0.95);
  const module = await secondModule.boundingBox();
  expect(Math.abs(afterB.x + afterB.width / 2 - module.x - module.width / 2), 'B sits over its own module').toBeLessThan(4);
  await seek(page, q.pause_at);
  expect(await painted(art.getByText('shared module', { exact: true })), 'rewinding restores the shared dependency').toBe(true);
});

test('Not a One-Time Investment: the final message and code hold through the exact end without overlaps', async ({ page }) => {
  await page.goto(song.player);
  const message = page.getByText('Reuse done right', { exact: true });
  const codeTitle = page.getByText('JavaScript · built-in', { exact: true });
  const explanation = page.getByText('Eleven lines → one built-in', { exact: true });
  for (const time of [285, song.duration]) {
    await seek(page, time);
    expect(await paintOpacity(message), 'the final takeaway does not fade before the music ends').toBe(1);
    expect(await paintOpacity(codeTitle)).toBe(1);
    const lastLine = await page.getByText('paddingCharacter)', { exact: true }).boundingBox();
    const label = await explanation.boundingBox();
    expect(lastLine.y + lastLine.height, 'the JavaScript example clears the explanation beneath it').toBeLessThan(label.y);
  }
  await seek(page, 0);
  await expect(message, 'restarting clears the ending').toBeHidden();
});

test('Not a One-Time Investment: benefit cards take turns between the towers, including after rewind', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(song.player);
  const quality = page.getByTestId('reuse-benefit-quality');
  const productivity = page.getByTestId('reuse-benefit-productivity');
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

test('Not a One-Time Investment: each chorus builds upward and completed floors hold between choruses', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(song.player);
  await seek(page, EARLY);
  const foundations = await buildingHeights(page);
  expect(foundations.length, 'both building sites have visible foundations').toBeGreaterThanOrEqual(2);
  expect(foundations.every(height => height > 0)).toBe(true);
  let previous = foundations;
  for (const section of song.sections.filter(section => section.id.startsWith('refrain-'))) {
    const index = song.sections.indexOf(section);
    const start = section.lines[0].start - 0.2;
    const end = song.sections[index + 1].lines[0].start - 0.2;
    await seek(page, start - 0.1);
    expect(await buildingHeights(page), 'the preceding verse retains the previous floors').toEqual(previous);
    const snapshots = [];
    for (const time of [start + (end - start) / 3, start + 2 * (end - start) / 3, end]) {
      await seek(page, time);
      const heights = await buildingHeights(page);
      heights.forEach((height, i) => expect(height, 'existing floors never disappear').toBeGreaterThanOrEqual(previous[i]));
      expect(heights.reduce((sum, height) => sum + height, 0), 'each chorus keeps adding courses')
        .toBeGreaterThan(previous.reduce((sum, height) => sum + height, 0));
      snapshots.push([time, heights]);
      previous = heights;
    }
    await seek(page, end + 10);
    expect(await buildingHeights(page), 'construction pauses for the next explanation').toEqual(previous);
    for (const [time, heights] of snapshots.toReversed()) {
      await seek(page, time);
      expect(await buildingHeights(page), 'seeking restores the same courses').toEqual(heights);
    }
  }
  await seek(page, EARLY);
  expect(await buildingHeights(page)).toEqual(foundations);
});

test('Not a One-Time Investment: full-size rockets launch from the ground without gauge cutaways', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(song.player);
  const line = id => song.sections.flatMap(section => section.lines).find(line => line.id === id);
  const first = page.getByTestId('reuse-rocket-ariane4');
  const second = page.getByTestId('reuse-rocket-ariane5');
  const body = rocket => rocket.getByTestId('reuse-rocket-body');
  const poses = [];
  const climbs = [];
  for (const [rocket, parkedAt, launchAt] of [
    [first, line('br-1').marks.ariane + 0.2, line('br-4').start],
    [second, line('br-5').marks.five, line('br-6').start],
  ]) {
    await seek(page, parkedAt);
    const ground = await page.getByTestId('reuse-ground').boundingBox();
    // Measure the support geometry, excluding its decorative outline.
    const feet = await rocket.getByTestId('reuse-rocket-footings').evaluate(node => {
      const art = node.ownerSVGElement;
      const frame = art.getBoundingClientRect();
      const foot = node.getBBox();
      const scale = frame.height / art.viewBox.baseVal.height;
      return { x: frame.x + foot.x * scale, y: frame.y + foot.y * scale, width: foot.width * scale, height: foot.height * scale };
    });
    const label = await rocket.locator('.rk-rocket-name').boundingBox();
    expect(Math.abs(feet.y + feet.height - ground.y), 'launch supports meet the scene ground').toBeLessThan(2);
    expect(label.y, 'the rocket name sits below its platform').toBeGreaterThanOrEqual(feet.y + feet.height - 1);
    expect(Math.abs(label.x + label.width / 2 - feet.x - feet.width / 2), 'the name is centred below its platform').toBeLessThan(2);
    const captions = await page.getByRole('region', { name: 'Current lyrics', exact: true }).boundingBox();
    expect(label.y + label.height, 'the name clears the caption line').toBeLessThan(captions.y);
    const parked = await body(rocket).boundingBox();
    await seek(page, launchAt + 0.45);
    const airborne = await body(rocket).boundingBox();
    expect(await painted(body(rocket)), 'takeoff remains visible').toBe(true);
    expect(airborne.y, 'the rocket lifts off').toBeLessThan(parked.y);
    climbs.push(parked.y - airborne.y);
    expect(airborne.height, 'the rocket keeps its original height').toBeCloseTo(parked.height, 1);
    expect(airborne.width, 'the rocket keeps its original width').toBeCloseTo(parked.width, 1);
    poses.push([rocket, launchAt + 0.45, airborne]);
  }
  expect(climbs[1], 'Ariane 5 climbs farther than Ariane 4 in the same time').toBeGreaterThan(climbs[0]);
  for (const [rocket, times] of [[first, [164, 166, 167.6]], [second, [172, 173, 174.5, 176.2]]]) {
    for (const time of times) {
      await seek(page, time);
      expect(await painted(body(rocket)), `no cutaway hides the rocket at ${time}s`).toBe(true);
      await expect(page.locator('.rk-gauge')).toHaveCount(0);
    }
  }
  await seek(page, line('br-8').marks.veered - 0.1);
  const exited = await body(first).boundingBox();
  const picture = await page.getByTestId('song-picture').boundingBox();
  expect(exited.y + exited.height, 'Ariane 4 exits through the top of the frame').toBeLessThan(picture.y);

  await seek(page, line('br-8').marks.selfdestructed + 0.4);
  const blast = second.getByTestId('reuse-rocket-blast');
  expect(await painted(blast), 'Ariane 5 breaks apart in view').toBe(true);
  const bounds = await blast.boundingBox();
  const centre = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  const banks = await page.getByTestId('reuse-cloud-bank').evaluateAll(nodes => nodes.map(node => {
    const r = node.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
  }));
  expect(banks.some(r => centre.x > r.left && centre.x < r.right && centre.y > r.top && centre.y < r.bottom), 'the explosion is in the clouds').toBe(true);
  for (const [rocket, time, position] of poses) {
    await seek(page, time);
    expect(await body(rocket).boundingBox(), 'rewinding restores the same flight position').toEqual(position);
  }
});

test('Not a One-Time Investment: Ariane 5 breakup resolves into rising smoke before the comparison and rewinds', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(song.player);
  const lines = song.sections.flatMap(section => section.lines);
  const at = lines.find(line => line.id === 'br-8').marks.selfdestructed;
  const rocket = page.getByTestId('reuse-rocket-ariane5');
  const body = rocket.getByTestId('reuse-rocket-body');
  const blast = rocket.getByTestId('reuse-rocket-blast');
  const fire = rocket.getByTestId('reuse-rocket-fire');
  const smoke = rocket.getByTestId('reuse-rocket-smoke');
  const fragments = rocket.getByTestId('reuse-rocket-fragments');
  const opacity = node => node.evaluate(node => Number(getComputedStyle(node).opacity));
  const picture = async () => ({ fire: await opacity(fire), smoke: await smoke.boundingBox(), fragments: await fragments.boundingBox() });

  await seek(page, at - 0.1);
  expect(await painted(body), 'the rocket remains intact before the sung breakup').toBe(true);
  expect(await painted(blast)).toBe(false);
  await seek(page, at + 0.3);
  expect(await painted(body), 'the intact rocket gives way to its fragments').toBe(false);
  expect(await painted(fragments)).toBe(true);
  const burst = await picture();
  expect(burst.fire, 'the fireball is visible').toBeGreaterThan(0);

  await seek(page, at + 1.3);
  expect(await painted(smoke), 'the scene stays on the breakup long enough to see its aftermath').toBe(true);
  const aftermath = await picture();
  expect(aftermath.fire, 'the fire dies before the smoke disperses').toBe(0);
  expect(aftermath.smoke.y, 'smoke billows upward').toBeLessThan(burst.smoke.y);
  expect(aftermath.fragments, 'the rocket sections tumble apart').not.toEqual(burst.fragments);
  await seek(page, lines.find(line => line.id === 'br-10').marks.failed + 0.5);
  expect(await painted(blast), 'the finished explosion gives way to the comparison').toBe(false);
  await expect(page.getByText('Ariane 5: overflows', { exact: true })).toBeVisible();

  await seek(page, at - 0.1);
  expect(await painted(body), 'rewinding restores the intact rocket').toBe(true);
  expect(await painted(blast)).toBe(false);
  await seek(page, at + 0.3);
  expect(await picture(), 'seeking reproduces the same breakup').toEqual(burst);
});

test('Not a One-Time Investment: reduced motion shows a still Ariane 5 breakup when artwork is enabled', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(song.player);
  await openPlayerSettings(page);
  await page.getByRole('checkbox', { name: 'Use lyrics-only mode' }).uncheck();
  await page.getByRole('button', { name: 'Player settings', exact: true }).click();
  const at = song.sections.flatMap(section => section.lines).find(line => line.id === 'br-8').marks.selfdestructed;
  const smoke = page.getByTestId('reuse-rocket-smoke');
  const fragments = page.getByTestId('reuse-rocket-fragments');
  const fire = page.getByTestId('reuse-rocket-fire');
  const picture = async () => ({ smoke: await smoke.boundingBox(), fragments: await fragments.boundingBox(), fire: await fire.evaluate(node => getComputedStyle(node).opacity) });
  await seek(page, at + 0.3);
  expect(await painted(fragments)).toBe(true);
  expect(await painted(smoke)).toBe(true);
  const still = await picture();
  await seek(page, at + 1.3);
  expect(await picture(), 'the breakup stays still with reduced motion').toEqual(still);
});

test('Not a One-Time Investment: one hero remains visible across every lyric and scene boundary', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(song.player);
  const hero = page.getByTestId('oc-foreman');
  await expect(hero).toBeVisible();
  await expect(hero.locator('.oc-shadow'), 'the soles meet the roof without a floating shadow').toBeHidden();
  const times = [0, ...song.sections.flatMap(section => section.lines.map(line => line.start + 0.2)), song.duration - 0.1];
  for (const time of [...times, ...times.toReversed()]) {
    const picture = await page.evaluate(time => {
      window.Timeline.seek(time);
      const heroes = document.querySelectorAll('[data-testid="oc-foreman"]');
      const hero = heroes[0];
      if (!hero) return { count: 0 };
      let opacity = 1;
      for (let node = hero; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        opacity *= style.visibility === 'hidden' || style.display === 'none' ? 0 : Number(style.opacity);
      }
      const bounds = hero.getBoundingClientRect();
      const stage = document.querySelector('.bs-art').getBoundingClientRect();
      return { count: heroes.length, opacity, width: bounds.width,
        left: (bounds.left - stage.left) / stage.width,
        top: (bounds.top - stage.top) / stage.height,
        bottom: (bounds.bottom - stage.top) / stage.height };
    }, time);
    expect(picture.count, `one performer is present at ${time}s`).toBe(1);
    expect(picture.opacity, `the performer is painted at ${time}s`).toBeGreaterThan(0);
    expect(picture.width).toBeGreaterThan(0);
    expect(picture.left, 'the hero stays on the right, clear of the central lesson').toBeGreaterThan(0.8);
    expect(picture.top, 'the hero clears the top of the picture').toBeGreaterThanOrEqual(0);
    expect(picture.bottom, 'the hero stays inside the picture').toBeLessThan(1);
  }
});

test('Not a One-Time Investment: the foreman climbs with the right tower and stays on completed courses', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(song.player);
  await seek(page, EARLY);
  let previous = await heroFooting(page);
  const snapshots = [[EARLY, previous]];
  for (const section of song.sections.filter(section => section.id.startsWith('refrain-'))) {
    const index = song.sections.indexOf(section);
    const start = section.lines[0].start - 0.2;
    const end = song.sections[index + 1].lines[0].start - 0.2;
    await seek(page, start - 0.5);
    expect(await heroFooting(page), 'the foreman rests on the previous floor between builds').toEqual(previous);
    for (const time of [start + (end - start) / 2, end]) {
      await seek(page, time);
      const footing = await heroFooting(page);
      expect(footing.y, 'the foreman climbs as the tower grows').toBeLessThan(previous.y);
      expect(Math.abs(footing.y - footing.support), 'the feet stay within one brick course of the growing roof').toBeLessThan(14);
      previous = footing;
      snapshots.push([time, footing]);
    }
  }
  await seek(page, LATE);
  expect(await heroFooting(page), 'the foreman remains on the finished tower for the outro').toEqual(previous);
  for (const [time, picture] of snapshots.toReversed()) {
    await seek(page, time);
    expect(await heroFooting(page), 'seeking restores the same footing on the tower').toEqual(picture);
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

test('Not a One-Time Investment: clouds drift gently during explanations while the forklift stays still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(song.player);
  await expect(page.getByTestId('song-picture')).toBeVisible();
  await expect(page.getByTestId('reuse-site-forklift')).toHaveCount(1);

  await seek(page, 20);
  const settled = await ambientPositions(page);
  const stage = await page.getByTestId('song-picture').boundingBox();
  expect(settled.clouds.length, 'cloud banks are present').toBeGreaterThan(0);
  for (const time of [68, 163, 255]) {
    await seek(page, time);
    const picture = await ambientPositions(page);
    expect(picture.truck, `the forklift stays still during the explanation at ${time}s`).toEqual(settled.truck);
    picture.clouds.forEach(([x, y], i) => {
      const drift = Math.hypot(x - settled.clouds[i][0], y - settled.clouds[i][1]);
      expect(drift, `cloud ${i + 1} continues drifting at ${time}s`).toBeGreaterThan(0);
      expect(drift, 'cloud movement remains below five percent of the stage width').toBeLessThan(stage.width * 0.05);
    });
  }
  await seek(page, 288);
  const finale = await ambientPositions(page);
  expect(finale.clouds, 'cloud drift continues through the finale').not.toEqual(settled.clouds);
  expect(finale.truck, 'the forklift resumes in the finale').not.toEqual(settled.truck);
  await seek(page, 20);
  expect(await ambientPositions(page), 'rewinding restores the settled picture').toEqual(settled);
});

test('Not a One-Time Investment: cloud folds and wisps move subtly within each bank', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(song.player);
  await expect(page.getByTestId('song-picture')).toBeVisible();
  await seek(page, 0);
  const beginning = await cloudDetails(page);
  expect(beginning.length, 'cloud details are present').toBeGreaterThan(0);
  let previous = beginning;
  for (const time of [30, 120, 240, LATE]) {
    await seek(page, time);
    const picture = await cloudDetails(page);
    picture.forEach((bank, i) => {
      for (const detail of ['folds', 'wisps']) {
        expect(bank[detail][0], `${detail} continue moving within cloud ${i + 1} at ${time}s`).toBeGreaterThan(previous[i][detail][0]);
        expect(bank[detail][0] - beginning[i][detail][0], 'local drift stays under three percent of the cloud width').toBeLessThan(beginning[i].width * 0.03);
        expect(bank[detail][1], 'the wind does not make the clouds bob').toBe(beginning[i][detail][1]);
      }
      expect(bank.wisps[0] - beginning[i].wisps[0], 'thin wisps catch a faster wind than the inner folds')
        .toBeGreaterThan(bank.folds[0] - beginning[i].folds[0]);
    });
    previous = picture;
    await seek(page, time);
    expect(await cloudDetails(page), 'holding song time still holds the local cloud pose').toEqual(picture);
  }
  await seek(page, 0);
  expect(await cloudDetails(page), 'rewinding restores the original cloud details').toEqual(beginning);
});

test('Not a One-Time Investment: cloud silhouettes ripple gently and reproduce the same shape when seeking', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(song.player);
  await expect(page.getByTestId('reuse-cloud-outline').first()).toBeVisible();
  await seek(page, 0);
  const beginning = await cloudSilhouettes(page);
  for (const time of [4, 11, 23, 85, 180, 285]) {
    await seek(page, time);
    const picture = await cloudSilhouettes(page);
    picture.forEach((outline, i) => {
      const movement = outline.map(([x, y], p) => Math.hypot(x - beginning[i][p][0], y - beginning[i][p][1]));
      expect(Math.max(...movement), 'the cloud changes shape as well as drifting').toBeGreaterThan(0.25);
      expect(Math.max(...movement), 'ripples remain small enough to stay behind the lesson').toBeLessThan(6);
    });
    await seek(page, 0);
    expect(await cloudSilhouettes(page), 'rewinding restores the authored silhouette').toEqual(beginning);
    await seek(page, time);
    expect(await cloudSilhouettes(page), 'the same song time restores the same shape').toEqual(picture);
  }
});

test('Not a One-Time Investment: moving cloud highlights always face the rising sun', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(song.player);
  await expect(page.getByTestId('song-picture')).toBeVisible();
  await seek(page, EARLY);
  const dawn = await cloudLightAxes(page);
  expect(dawn.length, 'cloud highlights are present').toBeGreaterThan(0);
  for (const time of [0, EARLY, 80, MIDDLE, 220, LATE]) {
    await seek(page, time);
    const sun = await page.getByTestId('reuse-sun').evaluate(node => {
      const position = new DOMPoint(0, 0).matrixTransform(node.getCTM());
      return { x: position.x, y: position.y };
    });
    for (const { from, to } of await cloudLightAxes(page)) {
      const highlight = { x: to.x - from.x, y: to.y - from.y };
      const sunlight = { x: sun.x - from.x, y: sun.y - from.y };
      const alignment = (highlight.x * sunlight.x + highlight.y * sunlight.y)
        / (Math.hypot(highlight.x, highlight.y) * Math.hypot(sunlight.x, sunlight.y));
      expect(alignment, `the brightest side faces the sun at ${time}s`).toBeGreaterThan(0.999);
    }
  }
  await seek(page, EARLY);
  expect(await cloudLightAxes(page), 'rewinding restores the same highlight direction').toEqual(dawn);
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
  expect(dawn.roomBrightness, 'unoccupied rooms remain dark in blue hour').toContain(0);
  expect(new Set(dawn.roomBrightness.filter(brightness => brightness > 0)).size, 'occupied rooms have varied illumination').toBeGreaterThan(1);
  expect(rising.windows, 'interior lights recede as daylight arrives').toBeLessThan(dawn.windows);
  expect(morning.windows, 'room lights fade as daylight arrives').toBe(0);
  expect(rising.reflectedSky, 'glass reflects the changing dawn sky').not.toEqual(dawn.reflectedSky);
  expect(morning.reflectedSky, 'glass reflections continue changing into golden hour').not.toEqual(rising.reflectedSky);
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
  const buildingsStill = await buildingHeights(page);
  const heroStill = await heroFooting(page);
  for (const time of [MIDDLE, LATE, EARLY]) {
    await seek(page, time);
    await expect.poll(() => sunrisePicture(page), { message: 'reduced motion keeps sun position and ambient illumination fixed' }).toEqual(still);
    expect(await ambientPositions(page), 'reduced motion keeps the clouds and forklift still').toEqual(ambientStill);
    expect(await buildingHeights(page), 'reduced motion shows the completed buildings without construction').toEqual(buildingsStill);
    expect(await heroFooting(page), 'reduced motion holds the hero on the completed tower').toEqual(heroStill);
    await expect(page.getByTestId('oc-foreman')).toBeVisible();
    await expect(page.getByTestId('oc-foreman').locator('.song-hero-singing-mouth')).toBeHidden();
  }
  expect(errors).toEqual([]);
});
