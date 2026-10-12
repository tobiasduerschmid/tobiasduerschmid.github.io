// @ts-check
const { test, expect } = require('@playwright/test');

const PLAYER_PATH = '/assets/song-player/snapshots-and-pointers.html';
const SONG_TITLE = 'Snapshots and Pointers: a song about Git';
const frameTitle = `${SONG_TITLE}: interactive music player`;
const enter = (scope) => scope.getByRole('button', { name: 'Enter full screen', exact: true });
const exit = (scope) => scope.getByRole('button', { name: 'Exit full screen', exact: true });

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

test.beforeEach(async ({ context }) => {
  // Keep real media responses; bypass WEBrick's incorrect cached If-Range/304 handling.
  await context.route('**/*', (route) => route.continue());
});

async function noNativeFullscreen(scope) {
  // Browser capability is the external boundary. Exercise the real player and
  // parent integration with the platform path unavailable (as on iPhone).
  // Apply to the loaded document: Firefox can replace a lazy iframe document
  // after its init script runs, losing an earlier own-property override.
  const documentRoot = scope.locator('html');
  await documentRoot.evaluate(() => {
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, get: () => false });
  });
  await expect.poll(() => documentRoot.evaluate(() => document.fullscreenEnabled)).toBe(false);
}

async function expectFramed(scope, rotated) {
  const controls = scope.getByRole('region', { name: 'Song controls', exact: true });
  await expect(controls).toBeVisible();
  await expect(scope.getByRole('region', { name: 'Current lyrics', exact: true })).toBeVisible();
  await expect.poll(() => controls.evaluate((controls) => {
    const screen = controls.closest('.song-player-screen');
    const picture = screen.querySelector('[data-testid="song-picture"]').getBoundingClientRect();
    const captions = screen.querySelector('[aria-label="Current lyrics"]').getBoundingClientRect();
    const viewport = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
    const inside = (box, boundary) => box.left >= boundary.left - 1 && box.top >= boundary.top - 1
      && box.right <= boundary.right + 1 && box.bottom <= boundary.bottom + 1;
    const clippedControls = [...controls.querySelectorAll('button, input, select')]
      .filter((element) => element.getClientRects().length && !inside(element.getBoundingClientRect(), viewport))
      .map((element) => element.getAttribute('aria-label') || element.tagName);
    return {
      pictureInside: inside(picture, viewport), captionsInside: inside(captions, picture), clippedControls,
      rotated: picture.height > picture.width,
    };
  }), { message: 'the picture, overlaid captions, and every control must fit the visible screen' }).toEqual({
    pictureInside: true, captionsInside: true, clippedControls: [], rotated,
  });
}

test('portrait full screen remains usable without a native API and adapts when the phone rotates', async ({ page }, testInfo) => {
  await page.goto(PLAYER_PATH);
  await noNativeFullscreen(page);
  await expect(enter(page)).toBeVisible();
  await enter(page).click();
  await expect(page.getByRole('dialog', { name: 'Full screen music player', exact: true })).toBeVisible();
  await expectFramed(page, true);
  await page.screenshot({ path: `/tmp/git-mv-fullscreen-fallback-${testInfo.project.name}.png` });
  // The fallback is modal even though browser chrome remains present.
  await page.getByRole('combobox', { name: 'Audio track', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Play video', exact: true })).toBeFocused();

  await page.setViewportSize({ width: 844, height: 390 });
  await expectFramed(page, false);
  await exit(page).click();
  await expect(enter(page)).toBeFocused();
  await expect(page.getByRole('dialog', { name: 'Full screen music player', exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page).click();
  await expectFramed(page, true);
  await page.keyboard.press('Escape');
  await expect(enter(page)).toBeFocused();
  await expect(page.getByRole('checkbox', { name: 'Use lyrics-only mode', exact: true })).toBeVisible();
});

test('embedded portrait full screen fills the browser and restores the chapter on exit', async ({ page }, testInfo) => {
  await page.goto('/SEBook/tools/git.html#git-song');
  const frameElement = page.getByTitle(frameTitle);
  await frameElement.scrollIntoViewIfNeeded();
  const player = frameElement.contentFrame();
  await expect(enter(player)).toBeVisible();
  await noNativeFullscreen(player);
  await enter(player).scrollIntoViewIfNeeded();
  const normal = await frameElement.boundingBox();
  // Record where the reader is when they activate full screen. An earlier
  // sample can precede the chapter anchor's smooth scroll or click auto-scroll.
  await enter(player).evaluate((button) => {
    button.addEventListener('click', () => {
      window.songFullscreenScrollAtEntry = window.parent.scrollY;
    }, { capture: true, once: true });
  });
  await enter(player).click();
  const scrollBefore = await player.locator('html').evaluate(() => window.songFullscreenScrollAtEntry);
  await expect(exit(player)).toBeVisible();
  await expect(player.getByRole('dialog', { name: 'Full screen music player', exact: true })).toBeVisible();
  await expect.poll(() => frameElement.evaluate((frame) => {
    const box = frame.getBoundingClientRect();
    return Math.max(Math.abs(box.x), Math.abs(box.y), Math.abs(box.width - innerWidth), Math.abs(box.height - innerHeight));
  })).toBeLessThanOrEqual(1);
  await expectFramed(player, true);
  await page.screenshot({ path: `/tmp/git-mv-fullscreen-embedded-${testInfo.project.name}.png` });
  await page.keyboard.press('Escape');
  await expect(enter(player)).toBeFocused();
  await expect.poll(async () => (await frameElement.boundingBox()).width).toBeCloseTo(normal.width, 1);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(scrollBefore, 0);
  await expect(page.getByText('Full transcript', { exact: true })).toBeVisible();
});

for (const lockResult of ['resolve', 'reject']) {
  test(`native touch full screen handles a ${lockResult === 'resolve' ? 'granted' : 'rejected'} landscape-lock request @chromium`, async ({ page }) => {
    await page.addInitScript((lockResult) => {
      window.fullscreenPlatformCalls = [];
      Object.defineProperty(screen.orientation, 'lock', { configurable: true, value: async (orientation) => {
        window.fullscreenPlatformCalls.push(orientation);
        if (lockResult === 'reject') throw new DOMException('Orientation locking unavailable', 'NotSupportedError');
      } });
      Object.defineProperty(screen.orientation, 'unlock', { configurable: true, value: () => window.fullscreenPlatformCalls.push('unlock') });
    }, lockResult);
    await page.goto(PLAYER_PATH);
    await enter(page).click();
    await expect(exit(page)).toBeVisible();
    await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
    await expect.poll(() => page.evaluate(() => window.fullscreenPlatformCalls)).toContain('landscape');
    // Even a granted lock need not rotate the display immediately; keep the
    // picture usable while portrait, then react to the platform's resize.
    await expectFramed(page, true);
    await page.getByRole('combobox', { name: 'Audio track', exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Play video', exact: true })).toBeFocused();
    await page.setViewportSize({ width: 844, height: 390 });
    await expectFramed(page, false);
    await exit(page).click();
    await expect(enter(page)).toBeFocused();
    await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
    if (lockResult === 'resolve') {
      await expect.poll(() => page.evaluate(() => window.fullscreenPlatformCalls)).toContain('unlock');
    }
  });
}

test('entering and leaving embedded fallback full screen preserves the playing audio clock @chromium', async ({ page }) => {
  await page.goto('/SEBook/tools/git.html#git-song');
  const frameElement = page.getByTitle(frameTitle);
  await frameElement.scrollIntoViewIfNeeded();
  const player = frameElement.contentFrame();
  await expect(enter(player)).toBeVisible();
  await noNativeFullscreen(player);
  const audio = player.getByLabel(`${SONG_TITLE} audio`, { exact: true });
  await player.getByRole('button', { name: 'Mute song', exact: true }).click();
  await player.getByRole('button', { name: 'Play song', exact: true }).click();
  await expect.poll(() => audio.evaluate((element) => element.currentTime)).toBeGreaterThan(0.1);
  const before = await audio.evaluate((element) => ({ time: element.currentTime, source: element.currentSrc }));
  await enter(player).click();
  await expect(exit(player)).toBeVisible();
  await expect(player.getByRole('dialog', { name: 'Full screen music player', exact: true })).toBeVisible();
  await expect.poll(() => audio.evaluate((element) => element.currentTime)).toBeGreaterThan(before.time + 0.1);
  await expect(audio).toHaveJSProperty('currentSrc', before.source);
  await expect(audio).toHaveJSProperty('paused', false);
  await expect(audio).toHaveJSProperty('playbackRate', 1);
  const fullScreenTime = await audio.evaluate((element) => element.currentTime);
  await exit(player).click();
  await expect(enter(player)).toBeVisible();
  await expect.poll(() => audio.evaluate((element) => element.currentTime)).toBeGreaterThan(fullScreenTime + 0.1);
  await expect(audio).toHaveJSProperty('paused', false);
  await expect(audio).toHaveJSProperty('currentSrc', before.source);
});

for (const native of [false, true]) {
  test(`an audio-track failure exposes recovery after leaving ${native ? 'native full screen @chromium' : 'fallback full screen'}`, async ({ page }) => {
    await page.goto(PLAYER_PATH);
    if (!native) await noNativeFullscreen(page);
    const track = page.getByRole('combobox', { name: 'Audio track', exact: true });
    const describedUrl = await track.evaluate((element) => new URL(element.dataset.describedSrc, location.href).href);
    // An unavailable media asset is a real recoverable network failure; the
    // player, audio-track controller, and fullscreen controller remain real.
    await page.route(describedUrl, (route) => route.abort('failed'));
    await enter(page).click();
    await expect(exit(page)).toBeVisible();
    await track.selectOption('described');
    await expect(enter(page)).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: /could not load|failed/i })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Download song audio', exact: true })).toBeVisible();
    await expect(track).toBeEnabled();
  });
}

for (const native of [false, true]) {
  test(`playlist navigation leaves ${native ? 'native full screen @chromium' : 'fallback full screen'} and restores usable focus`, async ({ page }) => {
    await page.goto('/SEBook/playlist.html');
    const player = page.locator('#playlist-frame').contentFrame();
    await expect(enter(player)).toBeVisible();
    if (!native) await noNativeFullscreen(player);
    await enter(player).click();
    await expect(exit(player)).toBeVisible();
    await expectFramed(player, true);
    await player.getByRole('button', { name: 'Next song', exact: true }).click();
    await expect(player.getByRole('heading', { name: 'Unbox the Stack: a song about networking', exact: true })).toBeVisible();
    await expect(player.getByRole('button', { name: 'Previous song', exact: true })).toBeFocused();
    await expect(enter(player)).toBeVisible();
    const checkbox = page.getByRole('checkbox', { name: 'Pause before quiz answers' });
    await checkbox.focus();
    await expect(checkbox).toBeFocused();
  });
}
