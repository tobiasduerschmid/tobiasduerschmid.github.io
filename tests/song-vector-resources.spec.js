// Resource budgets guard against retaining the whole animated song on phones.
const { test, expect, devices } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const songDirectory = path.join(__dirname, '../_data/songs');
const songs = fs.readdirSync(songDirectory).filter(file => file.endsWith('.yml'))
  .map(file => yaml.load(fs.readFileSync(path.join(songDirectory, file), 'utf8')));
const { defaultBrowserType, ...phone } = devices['iPhone 13 Pro'];

test.use({ ...phone, isMobile: ({ browserName }, use) => use(browserName !== 'firefox') });

test.beforeEach(async ({ context }) => {
  // Keep real media but bypass WEBrick's broken If-Range cache responses.
  await context.route('**/*', route => route.continue());
});

async function expectRenderingBudget(page, label) {
  const result = await page.evaluate(() => {
    const renderedAnimations = document.getAnimations().filter(animation => animation.effect.target.getClientRects().length).length;
    // WebKit can keep allocating style data for every pose of an animation
    // inside a display:none subtree that was once rendered, until a phone runs
    // out of memory. Transparent pictures must leave the document instead.
    const stage = document.getElementById('stage');
    const hiddenInPlace = Array.from(stage.querySelectorAll(':scope > .layer > *'))
      .filter(picture => getComputedStyle(picture).display === 'none' && picture.getAnimations({ subtree: true }).length)
      .length;
    // Put each culled picture back to read its authored opacity: culling must
    // never remove visible artwork, even after a backward seek.
    const culledOpacities = window.SongScene.culledPictures(stage).map(({ node, placeholder }) => {
      placeholder.replaceWith(node);
      const opacity = Number(getComputedStyle(node).opacity);
      node.replaceWith(placeholder);
      return opacity;
    }).filter(opacity => opacity !== 0);
    return { renderedAnimations, hiddenInPlace, culledOpacities };
  });
  // A ceiling on rendering work, not an exact count of authored artwork.
  expect(result.renderedAnimations, label).toBeLessThan(200);
  expect(result.hiddenInPlace, `${label}: animated pictures hidden in place`).toBe(0);
  expect(result.culledOpacities, 'only transparent pictures may leave the document').toEqual([]);
}

for (const song of songs) {
  const playerPath = song.player;
  test(`${song.title}: renderer-only bounded rendering through forward and backward seeks`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('crash', () => errors.push('Browser process crashed'));
    await page.goto(playerPath);
    await expect(page.getByTestId('song-picture')).toBeVisible();
    await expectRenderingBudget(page, 'initial load must not retain every section');
    // Exercise the shared player/exporter pose contract independently of codecs.
    // Native media seeking and synchronization are covered by player tests.
    const times = song.sections.map(section => section.lines[0].start + 1);
    for (const time of [...times, ...times.toReversed(), ...times]) {
      await page.evaluate(time => window.Timeline.seek(time), time);
      await expect(page.getByTestId('song-picture')).toBeVisible();
      await expectRenderingBudget(page, `animation budget at ${time}s`);
    }
    expect(errors).toEqual([]);
  });

  test(`${song.title}: lyrics-only mode avoids and releases artwork`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(playerPath);
    const mode = page.getByRole('checkbox', { name: 'Use lyrics-only mode' });
    await expect(mode).toBeChecked();
    await page.evaluate(() => document.fonts.ready);
    // A rendered frame lets pending scene initialization complete in the old player.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    await expect(page.getByRole('region', { name: 'Current visual description' })).toBeVisible();
    for (let cycle = 0; cycle < 2; cycle += 1) {
      await mode.uncheck();
      await expect(page.getByTestId('song-picture')).toBeVisible();
      await expectRenderingBudget(page, 're-enabling animation must not duplicate scenes');
      await mode.check();
      expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
      await expect(page.getByTestId('song-picture')).toBeHidden();
    }
    await expect(page.getByRole('button', { name: 'Play song', exact: true })).toBeEnabled();
  });
}
