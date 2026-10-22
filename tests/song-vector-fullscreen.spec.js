// @ts-check
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');

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

async function startFullscreen(page, native = false, touch = false) {
  await page.clock.install();
  await page.goto(PLAYER_PATH);
  if (!native) await noNativeFullscreen(page);
  const audio = page.getByLabel(`${SONG_TITLE} audio`, { exact: true });
  const activate = (button) => touch ? button.tap() : button.click();
  await activate(page.getByRole('button', { name: 'Mute song', exact: true }));
  await activate(page.getByRole('button', { name: 'Play song', exact: true }));
  await expect.poll(() => audio.evaluate((media) => media.currentTime)).toBeGreaterThan(0);
  await activate(enter(page));
  await expect(exit(page)).toBeVisible();
  if (native) await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  return audio;
}

test.describe('desktop fullscreen idle controls', () => {
  test.use({ viewport: { width: 1280, height: 900 }, hasTouch: false });

  for (const native of [false, true]) {
    test(`controls hide after inactivity and wake on mouse or keyboard in ${native ? 'native fullscreen @chromium' : 'fallback fullscreen'}`, async ({ page }) => {
      const audio = await startFullscreen(page, native);
      const controls = page.getByRole('region', { name: 'Song controls', exact: true });
      const picture = page.getByTestId('song-picture');
      await page.mouse.move(100, 100);
      const before = await picture.boundingBox();
      await page.clock.fastForward(4000);
      await expect(controls).toBeHidden();
      await expect(page.getByRole('region', { name: 'Current lyrics' })).toBeVisible();
      expect(await picture.boundingBox(), 'hiding controls must not resize the artwork').toEqual(before);
      await expect(page.getByRole('button', { name: 'Pause video', exact: true })).toHaveCSS('cursor', 'none');
      await a11yCheckpoint(page, 'fullscreen controls hidden', { feature: 'song-player' });
      await page.mouse.move(110, 100);
      await expect(controls).toBeVisible();
      await page.clock.fastForward(2000);
      await page.mouse.move(120, 100);
      await page.clock.fastForward(2000);
      await expect(controls).toBeVisible();
      await page.clock.fastForward(2000);
      await expect(controls).toBeHidden();
      await page.keyboard.press('c');
      await expect(controls).toBeVisible();
      await expect(page.getByRole('region', { name: 'Current lyrics' })).toBeHidden();
      await page.clock.fastForward(4000);
      await expect(controls).toBeHidden();
      await page.keyboard.press('k');
      await expect(audio).toHaveJSProperty('paused', true);
      await page.clock.fastForward(4000);
      await expect(controls).toBeVisible();
      await page.keyboard.press('k');
      await expect(audio).toHaveJSProperty('paused', false);
      await page.clock.fastForward(4000);
      await expect(controls).toBeHidden();
      await page.keyboard.press('Shift+Tab');
      await expect(page.getByRole('combobox', { name: 'Audio track', exact: true })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(controls).toBeVisible();
      await expect(page.getByRole('button', { name: 'Pause video', exact: true })).toBeFocused();
      await page.getByRole('button', { name: 'Pause song', exact: true }).focus();
      await page.clock.fastForward(4000);
      await expect(controls).toBeVisible();
      await expect(page.getByRole('button', { name: 'Pause song', exact: true })).toBeFocused();
      await a11yCheckpoint(page, 'fullscreen keyboard controls', { feature: 'song-player' });
      await page.keyboard.press('Space');
      await expect(audio).toHaveJSProperty('paused', true);
      await page.mouse.move(140, 100);
      await page.clock.fastForward(4000);
      await expect(controls).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(enter(page)).toBeFocused();
      await page.keyboard.press('Space');
      await expect(audio).toHaveJSProperty('paused', false);
      await page.clock.fastForward(4000);
      await expect(controls).toBeVisible();
    });
  }

  test('fullscreen controls stay available during hover, scrubbing, and buffering', async ({ page }) => {
    const audio = await startFullscreen(page);
    const controls = page.getByRole('region', { name: 'Song controls', exact: true });
    await page.getByRole('button', { name: 'Closed captions (CC)', exact: true }).hover();
    await page.clock.fastForward(4000);
    await expect(controls).toBeVisible();
    const seek = page.getByRole('slider', { name: 'Song position' });
    const box = await seek.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(100, 100);
    await page.clock.fastForward(4000);
    await expect(controls).toBeVisible();
    await page.mouse.up();
    await expect(audio).toHaveJSProperty('seeking', false);
    // Pointer scrubbing must not leave the focused slider pinning the toolbar.
    await page.clock.fastForward(4000);
    await expect(controls).toBeHidden();
    // Media readiness is a browser boundary; exercise its real event handlers.
    await audio.dispatchEvent('waiting');
    await page.clock.fastForward(4000);
    await expect(controls).toBeVisible();
    await audio.dispatchEvent('playing');
    await page.clock.fastForward(4000);
    await expect(controls).toBeHidden();
  });

  test('pointer-used controls hide again after shortcuts and a speed selection', async ({ page }) => {
    const audio = await startFullscreen(page);
    const controls = page.getByRole('region', { name: 'Song controls', exact: true });
    // Fullscreen leaves its button focused; using a playback shortcut there
    // must not be mistaken for navigating the toolbar with Tab.
    await page.mouse.move(100, 100);
    await page.keyboard.press('c');
    await page.keyboard.press('ArrowLeft');
    await expect(audio).toHaveJSProperty('seeking', false);
    await page.clock.fastForward(4000);
    await expect(controls).toBeHidden();
    await page.mouse.move(110, 100);
    const speed = page.getByRole('combobox', { name: 'Playback speed' });
    // Native pickers may consume pointerup; deliver only their opening event,
    // then choose through the native select API instead of OS popup coordinates.
    await speed.dispatchEvent('pointerdown', { pointerType: 'mouse', pointerId: 1 });
    await speed.focus();
    await speed.selectOption('1.5');
    await expect(speed).toHaveValue('1.5');
    await page.mouse.move(120, 100);
    await page.clock.fastForward(4000);
    await expect(controls).toBeHidden();
    await expect(audio).toHaveJSProperty('playbackRate', 1.5);
    await expect(audio).toHaveJSProperty('paused', false);
  });

  test('dismissing an unchanged speed picker does not pin controls in older browsers', async ({ page }) => {
    const audio = await startFullscreen(page);
    // Feature detection and native-picker events are browser boundaries. A
    // native picker can omit change and pointerup after an unchanged selection.
    await page.evaluate(() => {
      const supports = CSS.supports.bind(CSS);
      CSS.supports = (...args) => args[0] === 'selector(select:open)' ? false : supports(...args);
    });
    const speed = page.getByRole('combobox', { name: 'Playback speed' });
    await page.mouse.move(100, 100);
    await speed.dispatchEvent('pointerdown', { pointerType: 'mouse', pointerId: 1 });
    await speed.focus();
    await speed.dispatchEvent('keydown', { key: 'Enter' });
    await expect(speed).toHaveValue('1');
    await page.clock.fastForward(4000);
    await expect(page.getByRole('region', { name: 'Song controls', exact: true })).toBeHidden();
    await expect(audio).toHaveJSProperty('paused', false);
    // Keyboard editing can reopen a still-focused picker without a new Tab.
    await page.mouse.move(110, 100);
    await speed.dispatchEvent('pointerdown', { pointerType: 'mouse', pointerId: 1 });
    await speed.focus();
    await speed.dispatchEvent('keydown', { key: 'Enter' });
    await speed.dispatchEvent('keydown', { key: ' ' });
    await page.clock.fastForward(4000);
    await expect(page.getByRole('region', { name: 'Song controls', exact: true })).toBeVisible();
  });

  test('F enters fullscreen and hides idle controls without requiring a pointer click', async ({ page }) => {
    await page.clock.install();
    await page.goto(PLAYER_PATH);
    await noNativeFullscreen(page);
    const audio = page.getByLabel(`${SONG_TITLE} audio`, { exact: true });
    await audio.evaluate((media) => { media.muted = true; });
    await page.getByRole('button', { name: 'Play song', exact: true }).focus();
    await page.keyboard.press('Tab');
    // Safari's system keyboard settings can skip buttons during native Tab
    // navigation; explicitly select the same starting control in each engine.
    await page.getByRole('button', { name: 'Play song', exact: true }).focus();
    await page.keyboard.press('Space');
    await expect.poll(() => audio.evaluate((media) => media.currentTime)).toBeGreaterThan(0);
    await page.keyboard.press('f');
    const controls = page.getByRole('region', { name: 'Song controls', exact: true });
    await expect(exit(page)).toBeVisible();
    await page.clock.fastForward(4000);
    await expect(controls).toBeHidden();
    await expect(audio).toHaveJSProperty('paused', false);
    await page.keyboard.press('Tab');
    await page.getByRole('slider', { name: 'Song position' }).focus();
    await expect(page.getByRole('slider', { name: 'Song position' })).toBeFocused();
    await page.clock.fastForward(4000);
    await expect(controls).toBeVisible();
  });
});

for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`touch reveals idle fullscreen controls without pausing at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const audio = await startFullscreen(page, false, true);
    const controls = page.getByRole('region', { name: 'Song controls', exact: true });
    const picture = page.getByRole('button', { name: 'Pause video', exact: true });
    await page.clock.fastForward(4000);
    await expect(controls).toBeHidden();
    await picture.tap();
    await page.clock.fastForward(500); // Resolve the single/double-tap gesture window.
    await expect(controls).toBeVisible();
    await expect(audio).toHaveJSProperty('paused', false);
    await expectFramed(page, viewport.height > viewport.width);
    await page.clock.fastForward(4000);
    await expect(controls).toBeHidden();
    const position = await audio.evaluate((media) => media.currentTime);
    const bounds = await picture.boundingBox();
    // Use exposed artwork above the landscape toolbar. Portrait rotates the
    // picture, so its forward-seek half is the lower half of the screen.
    const point = { x: bounds.x + bounds.width * 0.75, y: bounds.y + bounds.height * (viewport.width > viewport.height ? 0.25 : 0.75) };
    await page.touchscreen.tap(point.x, point.y);
    await page.touchscreen.tap(point.x, point.y);
    await expect.poll(() => audio.evaluate((media) => media.currentTime)).toBeGreaterThan(position + 4);
    await expect(audio).toHaveJSProperty('paused', false);
    await page.keyboard.press('Shift'); // Reveal controls before moving assistive focus.
    await page.getByRole('combobox', { name: 'Playback speed' }).focus();
    await page.clock.fastForward(4000);
    await expect(controls).toBeVisible();
    await exit(page).tap();
    await expect(enter(page)).toBeVisible();
  });
}

test('lyrics-only fullscreen controls can be revealed by touch without pausing', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const audio = await startFullscreen(page, false, true);
  const controls = page.getByRole('region', { name: 'Song controls', exact: true });
  await page.clock.fastForward(4000);
  await expect(controls).toBeHidden();
  await expect(page.getByRole('region', { name: 'Current lyrics', exact: true })).toBeVisible();
  await page.getByRole('dialog', { name: 'Full screen music player', exact: true }).tap({ position: { x: 195, y: 422 } });
  await page.clock.fastForward(500);
  await expect(controls).toBeVisible();
  await expect(audio).toHaveJSProperty('paused', false);
  await exit(page).tap();
});

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
    // Rotate the emulated display without resizing Chromium's native fullscreen
    // window, which the browser protocol disallows on some platforms.
    const session = await page.context().newCDPSession(page);
    await session.send('Emulation.setDeviceMetricsOverride', {
      width: 844, height: 390, deviceScaleFactor: 1, mobile: false,
      screenOrientation: { type: 'landscapePrimary', angle: 90 },
    });
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
  test(`playlist keeps ${native ? 'native full screen @chromium' : 'fallback full screen'} across navigation and automatic advance`, async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/SEBook/playlist.html');
    const player = page.locator('#playlist-frame').contentFrame();
    await expect(enter(player)).toBeVisible();
    if (!native) await noNativeFullscreen(page); // The persistent host owns this API.
    await enter(player).click();
    await expect(exit(player)).toBeVisible();
    const expectFullscreen = async () => {
      await expect(exit(player)).toBeVisible();
      await expectFramed(player, true);
      if (native) await expect.poll(() => page.evaluate(() => document.fullscreenElement?.id)).toBe('playlist-video');
      else await expect(page.locator('#playlist-frame')).toHaveClass(/is-song-fullscreen/);
    };
    // Record every native exit, including a brief exit followed by re-entry.
    await page.evaluate(() => {
      window.playlistFullscreenExits = 0;
      document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) window.playlistFullscreenExits++;
      });
    });
    await expectFullscreen();
    await player.getByRole('button', { name: 'Next song', exact: true }).click();
    await expect(page.locator('#playlist-frame')).toHaveAttribute('title', frameTitle);
    await expectFullscreen();
    await player.getByRole('button', { name: 'Previous song', exact: true }).click();
    await expect(page.locator('#playlist-frame')).toHaveAttribute('title', /Small Tools/);
    await expectFullscreen();
    // Use the real media end, so the ended event, queue, and new player all participate.
    const audio = player.getByLabel('Small Tools, One Job Each: a song about the Unix shell audio', { exact: true });
    await expect.poll(() => audio.evaluate((media) => media.readyState)).toBeGreaterThan(0);
    await audio.evaluate((media) => { media.muted = true; media.pause(); media.currentTime = media.duration - 0.4; });
    await expect(audio).toHaveJSProperty('seeking', false);
    await player.getByRole('button', { name: 'Play song', exact: true }).click();
    await expect(page.locator('#playlist-frame')).toHaveAttribute('title', frameTitle);
    await expectFullscreen();
    expect(await page.evaluate(() => window.playlistFullscreenExits)).toBe(0);
    await page.keyboard.press('Escape');
    await expect(enter(player)).toBeFocused();
    await expect(page.locator('#playlist-frame')).not.toHaveClass(/is-song-fullscreen/);
    await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
    const checkbox = page.getByRole('checkbox', { name: 'Pause before quiz answers' });
    await checkbox.focus();
    await expect(checkbox).toBeFocused();
    await page.getByRole('button', { name: 'Clear playlist', exact: true }).click();
    await expect(page.locator('#playlist-frame')).toBeHidden();
  });
}
