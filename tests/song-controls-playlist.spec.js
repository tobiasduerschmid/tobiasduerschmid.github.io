const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const coursePlaylists = yaml.load(fs.readFileSync(path.join(__dirname, '../_data/song_playlists.yml'), 'utf8'));
const defaultSongCount = coursePlaylists.find(playlist => playlist.id === 'cs35l').songs.length;

const git = { title: 'Snapshots and Pointers: a song about Git', path: '/assets/song-player/snapshots-and-pointers.html' };
const network = { title: 'Unbox the Stack: a song about networking', path: '/assets/song-player/unbox-the-stack.html' };
const shell = { title: 'Small Tools, One Job Each: a song about the Unix shell', path: '/assets/song-player/small-tools-one-job-each.html' };
const playlistPath = '/SEBook/playlist.html';
const queue = (page) => page.getByRole('list', { name: 'Your playlist', exact: true });
const audioFor = (page, song) => page.getByLabel(`${song.title} audio`, { exact: true });

// Editing/playback cases use an existing student's two-song list. Adding a
// catalog entry must not silently change that student's saved queue.
const savedTwoSongState = (baseURL) => ({ cookies: [], origins: [{
  origin: new URL(baseURL).origin,
  localStorage: [{ name: 'song-player-playlist', value: JSON.stringify({ version: 1, songs: ['snapshots_and_pointers', 'unbox_the_stack'] }) }],
}] });
test.use({ storageState: async ({ baseURL }, use) => {
  await use(savedTwoSongState(baseURL));
} });

test.beforeEach(async ({ context }) => {
  // Keep real media responses; bypass WEBrick's incorrect cached If-Range/304 handling.
  await context.route('**/*', (route) => route.continue());
});

async function openPaused(page, song) {
  await page.goto(song.path);
  const audio = audioFor(page, song);
  await audio.evaluate((media) => { media.muted = true; });
  await page.getByRole('button', { name: 'Play song', exact: true }).click();
  await expect.poll(() => audio.evaluate((media) => media.currentTime)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Pause song', exact: true }).click();
  return audio;
}

async function seek(audio, time) {
  await audio.evaluate((media, seconds) => { media.currentTime = seconds; }, time);
  await expect(audio).toHaveJSProperty('seeking', false);
  await expect.poll(() => audio.evaluate((media) => media.currentTime)).toBeCloseTo(time, 1);
}

for (const song of [git, network]) {
  test(`${song.title}: C toggles captions only in the focused player`, async ({ page }) => {
    await page.goto(song.path);
    const captions = page.getByRole('region', { name: 'Current lyrics', exact: true });
    const cc = page.getByRole('button', { name: 'Closed captions (CC)', exact: true });
    await page.getByRole('button', { name: 'Play video', exact: true }).focus();
    await page.keyboard.press('c');
    await expect(captions).toBeHidden();
    await expect(cc).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('Shift+C');
    await expect(captions).toBeVisible();
    await expect(cc).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.down('c');
    await page.keyboard.down('c'); // Holding C must not flicker subtitles on and off.
    await page.keyboard.up('c');
    await expect(captions).toBeHidden();
    await cc.click();
    await expect(captions).toBeVisible();
    await expect(cc).toHaveAttribute('aria-keyshortcuts', 'c');
    await page.keyboard.press('Control+c');
    await expect(captions).toBeVisible();
    await page.getByRole('combobox', { name: 'Audio track', exact: true }).focus();
    await page.keyboard.press('c');
    await expect(captions).toBeVisible();
    await page.getByRole('link', { name: 'Skip to music player', exact: true }).focus();
    await page.keyboard.press('c');
    await expect(captions).toBeVisible();
  });

  test(`${song.title}: Space plays and pauses when the fullscreen button has focus`, async ({ page }) => {
    const audio = await openPaused(page, song);
    const enter = page.getByRole('button', { name: 'Enter full screen', exact: true });
    const exit = page.getByRole('button', { name: 'Exit full screen', exact: true });
    await enter.focus();
    await page.keyboard.press('Space');
    await expect(audio).toHaveJSProperty('paused', false);
    await expect(enter).toBeVisible();
    await page.keyboard.press('Space');
    await expect(audio).toHaveJSProperty('paused', true);
    await page.keyboard.press('Enter');
    await expect(exit).toBeVisible();
    await exit.focus();
    await page.keyboard.press('Space');
    await expect(audio).toHaveJSProperty('paused', false);
    await expect(exit).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(enter).toBeVisible();
    await page.keyboard.press('Space');
    await expect(audio).toHaveJSProperty('paused', true);
    await expect(enter).toBeVisible();
  });

  test(`${song.title}: picture click and keyboard activation toggle playback`, async ({ page }) => {
    await page.goto(song.path);
    const audio = audioFor(page, song);
    await page.getByRole('button', { name: 'Play video', exact: true }).click();
    await expect.poll(() => audio.evaluate((media) => media.currentTime)).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Pause video', exact: true }).click();
    await expect(audio).toHaveJSProperty('paused', true);
    await page.getByRole('button', { name: 'Play video', exact: true }).focus();
    await page.keyboard.press('Space');
    await expect(audio).toHaveJSProperty('paused', false);
    await page.keyboard.press('Enter');
    await expect(audio).toHaveJSProperty('paused', true);
  });

  test(`${song.title}: double clicks seek five seconds without toggling playback`, async ({ page }) => {
    const audio = await openPaused(page, song);
    const picture = page.getByRole('button', { name: 'Play video', exact: true });
    const bounds = await picture.boundingBox();
    await seek(audio, 30);
    await picture.dblclick({ position: { x: bounds.width * 0.25, y: bounds.height * 0.4 } });
    await expect.poll(() => audio.evaluate((media) => media.currentTime)).toBeCloseTo(25, 1);
    await picture.dblclick({ position: { x: bounds.width * 0.75, y: bounds.height * 0.4 } });
    await expect.poll(() => audio.evaluate((media) => media.currentTime)).toBeCloseTo(30, 1);
    await expect(audio).toHaveJSProperty('paused', true);
    await seek(audio, 3);
    await picture.dblclick({ position: { x: 10, y: 10 } });
    await expect(audio).toHaveJSProperty('currentTime', 0);
    await page.getByRole('button', { name: 'Forward 5 seconds', exact: true }).click();
    await expect.poll(() => audio.evaluate((media) => media.currentTime)).toBeCloseTo(5, 1);
    await expect(audio).toHaveJSProperty('paused', true);
    await page.getByRole('button', { name: 'Play song', exact: true }).click();
    await page.getByRole('button', { name: 'Pause video', exact: true }).dblclick({ position: { x: bounds.width * 0.75, y: 10 } });
    await expect.poll(() => audio.evaluate((media) => media.currentTime)).toBeGreaterThan(10);
    await expect(audio).toHaveJSProperty('paused', false);
  });

  test(`${song.title}: speed survives a track switch and reload without changing the paused position`, async ({ page }) => {
    const audio = await openPaused(page, song);
    await seek(audio, 40);
    await page.getByRole('combobox', { name: 'Playback speed' }).selectOption('1.5');
    await expect(audio).toHaveJSProperty('playbackRate', 1.5);
    await expect(audio).toHaveJSProperty('currentTime', 40);
    const originalDuration = await audio.evaluate((media) => media.duration);
    await page.getByRole('combobox', { name: 'Audio track', exact: true }).selectOption('described');
    await expect.poll(() => audio.evaluate((media) => media.duration)).toBeGreaterThan(originalDuration);
    await expect(audio).toHaveJSProperty('playbackRate', 1.5);
    await page.getByRole('combobox', { name: 'Audio track', exact: true }).selectOption('original');
    await expect.poll(() => audio.evaluate((media) => media.currentTime)).toBeCloseTo(40, 1);
    await expect(audio).toHaveJSProperty('playbackRate', 1.5);
    await page.reload();
    await expect(page.getByRole('combobox', { name: 'Playback speed' })).toHaveValue('1.5');
    await expect(audio).toHaveJSProperty('paused', true);
  });

  test(`${song.title}: focused shortcuts seek consistently on the picture and timeline`, async ({ page }) => {
    const audio = await openPaused(page, song);
    await seek(audio, 30.375);
    await page.getByRole('button', { name: 'Play video', exact: true }).focus();
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => audio.evaluate((media) => media.currentTime)).toBeCloseTo(25.375, 2);
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => audio.evaluate((media) => media.currentTime)).toBeCloseTo(30.375, 2);
    await page.keyboard.press('k');
    await expect(audio).toHaveJSProperty('paused', false);
    await page.keyboard.press('k');
    await expect(audio).toHaveJSProperty('paused', true);
    await page.keyboard.press('f');
    await expect(page.getByRole('button', { name: 'Exit full screen', exact: true })).toBeVisible();
    await page.keyboard.press('f');
    await expect(page.getByRole('button', { name: 'Enter full screen', exact: true })).toBeVisible();
    const position = page.getByRole('slider', { name: 'Song position' });
    await position.focus();
    await seek(audio, 30.375);
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => audio.evaluate((media) => media.currentTime)).toBeCloseTo(25.375, 2);
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => audio.evaluate((media) => media.currentTime)).toBeCloseTo(30.375, 2);
    await page.keyboard.down('ArrowLeft');
    await page.keyboard.down('ArrowLeft');
    await page.keyboard.up('ArrowLeft');
    await expect.poll(() => audio.evaluate((media) => media.currentTime)).toBeCloseTo(20.375, 2);
    await page.keyboard.press('k');
    await expect(audio).toHaveJSProperty('paused', true);
    await page.getByRole('combobox', { name: 'Playback speed' }).focus();
    await page.keyboard.press('f');
    await expect(page.getByRole('button', { name: 'Enter full screen', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Full transcript', exact: true }).focus();
    // The link is inside the player, so explicitly leave the player via its skip link.
    await page.getByRole('link', { name: 'Skip to music player', exact: true }).focus();
    await page.keyboard.press('k');
    await expect(audio).toHaveJSProperty('paused', true);
  });

  test(`${song.title}: number keys jump to tenths of the selected track, including zero`, async ({ page }) => {
    const audio = await openPaused(page, song);
    const originalDuration = await audio.evaluate((media) => media.duration);
    for (const track of ['original', 'described']) {
      await page.getByRole('combobox', { name: 'Audio track', exact: true }).selectOption(track);
      if (track === 'described') {
        await expect.poll(() => audio.evaluate((media) => media.duration)).toBeGreaterThan(originalDuration);
      }
      const duration = await audio.evaluate((media) => media.duration);
      for (const control of [page.getByRole('button', { name: 'Play video', exact: true }), page.getByRole('slider', { name: 'Song position' })]) {
        await control.focus();
        for (const digit of [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]) {
          await page.keyboard.press(String(digit));
          await expect(audio).toHaveJSProperty('seeking', false);
          await expect.poll(() => audio.evaluate((media) => media.currentTime), {
            message: `${digit} must seek to ${digit * 10}% of the ${track} track`,
          }).toBeCloseTo(duration * digit / 10, 2);
          await expect(audio).toHaveJSProperty('paused', true);
        }
      }
    }
  });

  test(`${song.title}: number shortcuts leave dropdowns and outside focus alone`, async ({ page }) => {
    const audio = await openPaused(page, song);
    await seek(audio, 30);
    for (const control of [
      page.getByRole('combobox', { name: 'Playback speed' }),
      page.getByRole('combobox', { name: 'Audio track', exact: true }),
      page.getByRole('link', { name: 'Skip to music player', exact: true }),
    ]) {
      await control.focus();
      await page.keyboard.press('5');
      await page.keyboard.press('0');
      await expect(audio).toHaveJSProperty('currentTime', 30);
    }
    await page.getByRole('button', { name: 'Play video', exact: true }).focus();
    // Match the produced character so layouts requiring Shift for digits work.
    for (const key of ['Control+5', 'Meta+5', 'Alt+5', '%']) {
      await page.keyboard.press(key);
      await expect(audio).toHaveJSProperty('currentTime', 30);
    }
  });
}

test('touch taps support playback and double-tap seeking', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 } });
  await context.route('**/*', (route) => route.continue());
  const page = await context.newPage();
  await page.goto(`${baseURL}${network.path}`);
  const audio = audioFor(page, network);
  await audio.evaluate((media) => { media.muted = true; });
  await page.getByRole('button', { name: 'Play video', exact: true }).tap();
  await expect.poll(() => audio.evaluate((media) => media.currentTime)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Pause song', exact: true }).tap();
  await seek(audio, 30);
  const bounds = await page.getByRole('button', { name: 'Play video', exact: true }).boundingBox();
  await page.touchscreen.tap(bounds.x + 15, bounds.y + 20);
  await page.touchscreen.tap(bounds.x + 15, bounds.y + 20);
  await expect.poll(() => audio.evaluate((media) => media.currentTime)).toBeCloseTo(25, 1);
  await expect(audio).toHaveJSProperty('paused', true);
  await context.close();
});

test('previous and next songs follow edited order and stop at the list boundaries', async ({ page }) => {
  await page.goto(playlistPath);
  const frame = page.locator('#playlist-frame').contentFrame();
  const previous = frame.getByRole('button', { name: 'Previous song', exact: true });
  const next = frame.getByRole('button', { name: 'Next song', exact: true });
  await expect(previous).toBeDisabled();
  await next.click();
  await expect(frame.getByRole('heading', { name: network.title, exact: true })).toBeVisible();
  await expect(next).toBeDisabled();
  await expect(previous).toBeFocused();
  await previous.press('Enter');
  await expect(frame.getByRole('heading', { name: git.title, exact: true })).toBeVisible();
  await expect(previous).toBeDisabled();
  await expect(next).toBeFocused();
  await page.getByRole('button', { name: `Move up: ${network.title}`, exact: true }).click();
  await expect(next).toBeDisabled();
  await expect(previous).toBeEnabled();
  await previous.click();
  await expect(frame.getByRole('heading', { name: network.title, exact: true })).toBeVisible();
  await expect(previous).toBeDisabled();
  await expect(next).toBeEnabled();
  await a11yCheckpoint(page, 'playlist song navigation', { feature: 'song-playlist', include: '#song-playlist' });
  await page.getByRole('button', { name: 'Clear playlist', exact: true }).click();
  await expect(page.locator('#playlist-frame')).toBeHidden();
});

test('playlist defaults, editing, Undo, and reload preserve student order', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(playlistPath);
  await page.evaluate(() => localStorage.removeItem('song-player-playlist'));
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Start from a playlist' })).toHaveValue('cs35l');
  await expect(queue(page).getByRole('listitem')).toHaveCount(defaultSongCount);
  await expect(queue(page).getByRole('listitem').nth(0)).toContainText(shell.title);
  await expect(queue(page).getByRole('listitem').nth(1)).toContainText(git.title);
  await expect(queue(page).getByRole('listitem').nth(2)).toContainText(network.title);
  await page.getByRole('button', { name: `Move up: ${network.title}`, exact: true }).click();
  await page.getByRole('button', { name: `Move up: ${network.title}`, exact: true }).click();
  await expect(queue(page).getByRole('listitem').nth(0)).toContainText(network.title);
  await page.reload();
  await expect(queue(page).getByRole('listitem').nth(0)).toContainText(network.title);
  await page.getByRole('button', { name: `Remove: ${git.title}`, exact: true }).click();
  await expect(queue(page).getByRole('listitem')).toHaveCount(defaultSongCount - 1);
  await page.getByRole('button', { name: /^Add to playlist\s*: Snapshots and Pointers: a song about Git$/ }).click();
  await expect(queue(page).getByRole('listitem').last()).toContainText(git.title);
  await page.getByRole('button', { name: 'Load playlist', exact: true }).click();
  await expect(queue(page).getByRole('listitem').nth(0)).toContainText(shell.title);
  await page.getByRole('button', { name: 'Undo change', exact: true }).click();
  await expect(queue(page).getByRole('listitem').nth(0)).toContainText(network.title);
  await a11yCheckpoint(page, 'edited video playlist', { feature: 'song-playlist', include: '#song-playlist' });
  expect(errors).toEqual([]);
});

test('an empty list survives reload and remains editable without browser storage', async ({ page, context }) => {
  await page.goto(playlistPath);
  await page.getByRole('button', { name: 'Clear playlist', exact: true }).click();
  await page.reload();
  await expect(queue(page).getByRole('listitem')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Play playlist', exact: true })).toBeDisabled();
  await context.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
  });
  await page.reload();
  await expect(queue(page).getByRole('listitem')).toHaveCount(defaultSongCount);
  await page.getByRole('button', { name: `Remove: ${git.title}`, exact: true }).click();
  await expect(queue(page).getByRole('listitem')).toHaveCount(defaultSongCount - 1);
  await expect(page.getByRole('status')).toContainText('this visit only');
});

test('playlist playback begins only on request and advances through the edited order', async ({ page }) => {
  await page.goto(playlistPath);
  const frame = page.locator('#playlist-frame').contentFrame();
  await expect(audioFor(frame, git)).toHaveJSProperty('paused', true);
  await page.getByRole('button', { name: `Move up: ${network.title}`, exact: true }).click();
  await page.getByRole('button', { name: 'Play playlist', exact: true }).click();
  const networkAudio = audioFor(frame, network);
  await expect.poll(() => networkAudio.evaluate((media) => media.currentTime)).toBeGreaterThan(0);
  await networkAudio.evaluate((media) => { media.muted = true; media.currentTime = media.duration - 0.3; });
  await expect(frame.getByRole('heading', { name: git.title, exact: true })).toBeVisible();
  const gitAudio = audioFor(frame, git);
  // Browser autoplay policies can require another gesture for a new media element.
  // Either start the next song, or provide an explicit, working continuation.
  await expect.poll(async () => (await gitAudio.evaluate((media) => media.currentTime)) > 0
    || (await page.getByRole('status').textContent()) === 'Video ready. Press Play in the video to continue.').toBe(true);
  if (await gitAudio.evaluate((media) => media.paused)) {
    await expect(page.getByRole('status')).toHaveText('Video ready. Press Play in the video to continue.');
    await frame.getByRole('button', { name: 'Play video', exact: true }).click();
  }
  await expect.poll(() => gitAudio.evaluate((media) => media.currentTime)).toBeGreaterThan(0);
  await expect(frame.getByText('Press the Play song button to start playback.', { exact: true })).toBeHidden();
  await gitAudio.evaluate((media) => { media.muted = true; media.currentTime = media.duration - 0.3; });
  await expect(page.getByRole('status')).toHaveText('Playlist finished.');
  await expect(gitAudio).toHaveJSProperty('paused', true);
});

test('speed settings are shared with the players and storage entries are deletable', async ({ page }) => {
  await page.goto('/settings/');
  await page.getByLabel('Music video playback speed', { exact: true }).selectOption('2');
  await page.goto(network.path);
  await expect(page.getByRole('combobox', { name: 'Playback speed' })).toHaveValue('2');
  await page.goto(playlistPath);
  await page.getByRole('button', { name: 'Load playlist', exact: true }).click();
  await page.goto('/cookies/');
  for (const key of ['song-player-speed', 'song-player-playlist']) {
    const row = page.getByRole('row').filter({ has: page.getByText(key, { exact: true }) });
    await expect(row).toContainText('set');
    await row.getByRole('button').click();
    await expect(row).toContainText('not set');
  }
  await page.goto(network.path);
  await expect(page.getByRole('combobox', { name: 'Playback speed' })).toHaveValue('1');
});

test('playlist reflows at 320 pixels, supports keyboard reordering, and prints a readable list', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(playlistPath);
  const up = page.getByRole('button', { name: `Move up: ${network.title}`, exact: true });
  await up.focus();
  await page.keyboard.press('Enter');
  await expect(queue(page).getByRole('listitem').nth(0)).toContainText(network.title);
  await expect(page.getByRole('button', { name: `Play: ${network.title}`, exact: true })).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await a11yCheckpoint(page, 'mobile playlist', { feature: 'song-playlist', include: '#song-playlist' });
  await page.emulateMedia({ media: 'print' });
  await expect(queue(page).getByRole('listitem').nth(0)).toContainText(network.title);
  await expect(page.getByRole('button', { name: 'Play playlist', exact: true })).toBeHidden();
  await expect(page.locator('#playlist-frame')).toBeHidden();
});

async function dragRow(page, from, to, cancelWith = null) {
  const list = queue(page);
  const handle = list.getByRole('listitem').nth(from).locator('.song-playlist-drag-handle');
  await handle.scrollIntoViewIfNeeded();
  const start = await handle.boundingBox();
  const end = await list.getByRole('listitem').nth(to).boundingBox();
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width / 2, end.y + (from < to ? end.height - 12 : 12), { steps: 10 });
  if (cancelWith === 'escape') await page.keyboard.press('Escape');
  if (cancelWith === 'outside') await page.mouse.move(2, 100);
  await page.mouse.up();
}

test('drag reordering preserves the current song, supports Undo and persistence, and cancels safely', async ({ page }) => {
  await page.goto(playlistPath);
  const frame = page.locator('#playlist-frame').contentFrame();
  await frame.getByRole('button', { name: 'Play song', exact: true }).click();
  const audio = audioFor(frame, git);
  await expect.poll(() => audio.evaluate((media) => media.currentTime)).toBeGreaterThan(0);
  await frame.getByRole('button', { name: 'Pause song', exact: true }).click();
  await seek(audio, 40);
  for (const cancellation of ['escape', 'outside']) {
    await dragRow(page, 0, 1, cancellation);
    await expect(queue(page).getByRole('listitem').first()).toContainText(git.title);
    await expect(page.getByRole('button', { name: 'Undo change', exact: true })).toBeDisabled();
  }
  await dragRow(page, 0, 1);
  await expect(queue(page).getByRole('listitem').first()).toContainText(network.title);
  await expect(audio).toHaveJSProperty('currentTime', 40);
  await expect(frame.getByRole('button', { name: 'Next song', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Undo change', exact: true }).click();
  await expect(queue(page).getByRole('listitem').first()).toContainText(git.title);
  await dragRow(page, 1, 0);
  await expect(queue(page).getByRole('listitem').first()).toContainText(network.title);
  await page.reload();
  await expect(queue(page).getByRole('listitem').first()).toContainText(network.title);
  await page.getByRole('button', { name: `Remove: ${git.title}`, exact: true }).click();
  await expect(queue(page).locator('.song-playlist-drag-handle')).toBeHidden();
  await expect(frame.getByRole('button', { name: 'Previous song', exact: true })).toBeDisabled();
  await expect(frame.getByRole('button', { name: 'Next song', exact: true })).toBeDisabled();
});

test('touch dragging reorders without scrolling the grip @chromium', async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    hasTouch: true, viewport: { width: 820, height: 1100 }, storageState: savedTwoSongState(baseURL),
  });
  await context.route('**/*', (route) => route.continue());
  const page = await context.newPage();
  await page.goto(`${baseURL}${playlistPath}`);
  await queue(page).scrollIntoViewIfNeeded();
  const first = await queue(page).getByRole('listitem').first().boundingBox();
  const handle = await queue(page).getByRole('listitem').last().locator('.song-playlist-drag-handle').boundingBox();
  const session = await context.newCDPSession(page);
  const x = handle.x + handle.width / 2;
  const y = handle.y + handle.height / 2;
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - 20 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: first.y + 12 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(queue(page).getByRole('listitem').first()).toContainText(network.title);
  await context.close();
});

for (const song of [git, network, shell]) {
  test(`${song.title}: navigation controls are absent outside playlists`, async ({ page }) => {
    await page.goto(song.path);
    await expect(page.getByRole('button', { name: 'Play song', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Previous song', exact: true })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Next song', exact: true })).toBeHidden();
  });

  test(`${song.title}: quiz mode pauses each question, resumes manually, and supports replay and audio description`, async ({ page }) => {
    test.setTimeout(90000);
    await page.goto(playlistPath);
    const checkbox = page.getByRole('checkbox', { name: 'Pause before quiz answers' });
    await expect(checkbox).not.toBeChecked();
    await checkbox.check();
    await page.reload();
    await expect(checkbox).toBeChecked();
    if (song === shell) await page.getByRole('button', { name: /^Add to playlist\s*: Small Tools/ }).click();
    await page.getByRole('button', { name: `Play: ${song.title}`, exact: true }).click();
    const frame = page.locator('#playlist-frame').contentFrame();
    const audio = audioFor(frame, song);
    await expect.poll(() => audio.evaluate((media) => media.currentTime)).toBeGreaterThan(0);
    await frame.getByRole('button', { name: 'Pause song', exact: true }).click();
    // Observe the real transport before the checkpoint's position correction.
    // Checking only currentTime afterwards can hide a late pause that leaked audio.
    await audio.evaluate((media) => {
      media.pause = function () {
        this.dataset.stoppedAt = String(this.currentTime);
        HTMLMediaElement.prototype.pause.call(this);
      };
    });
    const questions = await frame.locator('#song-data').evaluate((element) => JSON.parse(element.textContent).sections.flatMap((section) => section.lines).filter((line) => line.answer_at));
    await frame.getByRole('combobox', { name: 'Playback speed' }).selectOption('2');
    for (const question of questions) {
      await seek(audio, (question.pause_at ?? question.answer_at - 0.12) - 0.4);
      await expect(frame.locator('#song-description')).toHaveText(`Question: ${question.text}`);
      await frame.getByRole('button', { name: 'Play song', exact: true }).click();
      await expect(frame.getByRole('status')).toContainText('Paused before the answer');
      await expect(audio).toHaveJSProperty('paused', true);
      expect(await audio.evaluate((media) => media.currentTime)).toBeLessThan(question.answer_at);
      expect(Number(await audio.getAttribute('data-stopped-at'))).toBeLessThan(question.answer_at);
      await expect(frame.locator('#song-lyrics')).toHaveText(question.text);
      await frame.getByRole('button', { name: 'Play song', exact: true }).click();
      await expect.poll(() => audio.evaluate((media) => media.currentTime)).toBeGreaterThan(question.answer_at + 0.1);
      await frame.getByRole('button', { name: 'Pause song', exact: true }).click();
    }
    const first = questions[0];
    await seek(audio, first.start - 0.1); // Rewind before the question to re-arm it.
    const originalDuration = await audio.evaluate((media) => media.duration);
    await frame.getByRole('combobox', { name: 'Audio track', exact: true }).selectOption('described');
    await expect.poll(() => audio.evaluate((media) => media.duration)).toBeGreaterThan(originalDuration);
    // Start after the section's spoken description; test the question at slow speed.
    const timelineUrl = await frame.getByRole('combobox', { name: 'Audio track', exact: true }).getAttribute('data-described-timeline');
    const timeline = await (await page.request.get(timelineUrl)).json();
    const hold = timeline.holds.findLast((item) => item.songTime <= first.start + 0.01);
    await seek(audio, hold.outputEnd + first.start + 0.01 - hold.songTime);
    await frame.getByRole('combobox', { name: 'Playback speed' }).selectOption('0.5');
    await frame.getByRole('button', { name: 'Play song', exact: true }).click();
    await expect(frame.getByRole('status')).toContainText('Paused before the answer', { timeout: 15000 });
    await expect(audio).toHaveJSProperty('paused', true);
    await expect(frame.locator('#song-lyrics')).toHaveText(first.text);
    await checkbox.uncheck();
    await expect(audio).toHaveJSProperty('paused', true); // Changing a preference must not start media.
    await frame.getByRole('button', { name: 'Play song', exact: true }).click();
    await expect(frame.getByRole('status')).toBeHidden();
    await expect(audio).toHaveJSProperty('paused', false);
  });
}

test('shell quiz displays complete command examples that fit their answer cards', async ({ page }) => {
  const audio = await openPaused(page, shell);
  const questions = await page.locator('#song-data').evaluate((element) => JSON.parse(element.textContent).sections
    .flatMap((section) => section.lines).filter((line) => line.answer_code));
  expect(questions).toHaveLength(9);
  for (const question of questions) {
    await seek(audio, question.answer_at + 0.3);
    const code = page.locator('.quiz-answer code').filter({ hasText: question.answer_code });
    await expect(code).toBeVisible();
    await expect.poll(() => code.evaluate((element) => {
      const text = element.getBoundingClientRect();
      const card = element.closest('.quiz-answer').getBoundingClientRect();
      return text.left >= card.left && text.right <= card.right && text.top >= card.top && text.bottom <= card.bottom;
    }), { message: `${question.answer_code} fits without clipping` }).toBe(true);
  }
  await seek(audio, questions.find((question) => question.id === 'quiz-4').answer_at + 0.3);
  await page.getByTestId('song-picture').screenshot({ path: test.info().outputPath('shell-quiz-command.png') });
});

test('reorder component supports long lists, middle destinations, and edge scrolling', async ({ page }) => {
  await page.goto(playlistPath);
  // Component fixture uses the real reorder module with a minimal consumer.
  await page.setContent('<main><ol aria-label="Your playlist" tabindex="-1"></ol></main>');
  await page.addStyleTag({ content: 'li { height: 100px; margin: 10px; border: 1px solid; } .song-playlist-drag-handle { display: inline-block; width: 60px; height: 60px; touch-action: none; }' });
  await page.addScriptTag({ url: '/js/song-video/playlist-reorder.js' });
  await page.evaluate(() => {
    const list = document.querySelector('ol');
    for (let i = 0; i < 15; i++) {
      const row = document.createElement('li');
      row.dataset.id = String(i);
      const handle = document.createElement('span');
      handle.className = 'song-playlist-drag-handle';
      handle.textContent = `Drag ${i}`;
      row.append(handle);
      list.append(row);
    }
    window.SongPlaylistReorder.bind({ list, signal: new AbortController().signal, onMove: (id, index) => {
      const rows = [...list.children];
      const row = rows.find((item) => item.dataset.id === id);
      rows.splice(rows.indexOf(row), 1);
      rows.splice(index, 0, row);
      list.replaceChildren(...rows);
    } });
  });
  const handle = queue(page).getByRole('listitem').first().locator('.song-playlist-drag-handle');
  await handle.hover();
  await page.mouse.down();
  await page.mouse.move(150, 880, { steps: 10 });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(700);
  const last = await queue(page).getByRole('listitem').last().boundingBox();
  await page.mouse.move(150, last.y + last.height - 10);
  await page.mouse.up();
  await expect(queue(page).getByRole('listitem').last()).toHaveAttribute('data-id', '0');
  await page.evaluate(() => window.scrollTo(0, 0));
  await dragRow(page, 1, 3);
  await expect(queue(page).getByRole('listitem').nth(3)).toHaveAttribute('data-id', '2');
  await expect(queue(page).getByRole('listitem')).toHaveCount(15);
});
