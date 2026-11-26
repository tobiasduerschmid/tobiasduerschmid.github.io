const { test, expect } = require('@playwright/test');
const { luminance, paletteOf } = require('./print-helpers');
const { setSiteTheme } = require('./helpers/narration-player');

const title = 'Inspect and Adapt: a Scrum musical: interactive music player';

for (const dark of [true, false]) {
  test(`song player paints the ${dark ? 'dark' : 'light'} theme before its runtime loads`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: 'dark-mode', value: String(dark), url: baseURL }]);

    // Hold a real animation dependency at the network boundary so the
    // frame can paint while its runtime and theme messages are still pending.
    let releaseRuntime;
    const runtimeGate = new Promise((resolve) => { releaseRuntime = resolve; });
    await page.route('**/js/song-video/timeline.js*', async (route) => {
      await runtimeGate;
      await route.continue();
    });

    try {
      await page.goto('/SEBook/process/scrum.html', { waitUntil: 'domcontentloaded' });
      const frameElement = page.getByTitle(title, { exact: true });
      await frameElement.scrollIntoViewIfNeeded();
      await expect(frameElement).toBeVisible();
      const frame = frameElement.contentFrame();
      const content = frame.getByRole('main');
      await expect(content).toBeVisible();

      const background = () => paletteOf(content).then((palette) => luminance(palette.background));
      if (dark) await expect.poll(background, { message: 'the first visible player surface is dark' }).toBeLessThan(0.2);
      else await expect.poll(background, { message: 'the first visible player surface is light' }).toBeGreaterThan(0.8);
    } finally {
      releaseRuntime();
      await page.unrouteAll({ behavior: 'wait' });
    }
  });
}

test('song player follows theme changes after startup and returns to dark after printing', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'dark-mode', value: 'true', url: baseURL }]);
  await page.goto('/SEBook/process/scrum.html');
  const frameElement = page.getByTitle(title, { exact: true });
  const frame = frameElement.contentFrame();
  await expect(frame.getByRole('button', { name: 'Play song', exact: true })).toBeVisible();
  const background = () => paletteOf(frame.getByRole('main')).then((palette) => luminance(palette.background));
  await expect.poll(background).toBeLessThan(0.2);

  await setSiteTheme(page, false);
  await expect.poll(background).toBeGreaterThan(0.8);
  await setSiteTheme(page, true);
  await expect.poll(background).toBeLessThan(0.2);

  await page.emulateMedia({ media: 'print' });
  await expect(frameElement).toBeHidden();
  await expect.poll(async () => luminance((await paletteOf(page.getByRole('main'))).background)).toBeGreaterThan(0.8);
  await page.emulateMedia({ media: 'screen' });
  await expect(frameElement).toBeVisible();
  await expect.poll(background).toBeLessThan(0.2);
});
