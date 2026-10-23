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
