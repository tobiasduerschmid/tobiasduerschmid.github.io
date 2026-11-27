const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');
const { setSiteTheme } = require('./helpers/narration-player');

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
const url = '/SEBook/process/scrum.html';
const lesson = page => page.getByRole('region', { name: 'Scrum in one sprint', exact: true });
// The animation iframe is decorative; its title identifies the painted picture.
const picture = page => lesson(page).locator('iframe[title="Scrum animation"]');

for (const { width, dark } of [{ width: 320, dark: false }, { width: 390, dark: true }]) {
  test(`the mobile header leaves room for the picture at ${width}px in ${dark ? 'dark' : 'light'} mode`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/SEBook/designprinciples/blood-groups.html');
    await setSiteTheme(page, dark);
    const player = page.getByRole('region', { name: 'What does your code know?', exact: true });
    const header = player.getByRole('region', { name: 'Scene navigation', exact: true });
    await expect(player.getByRole('button', { name: 'Play lesson', exact: true })).toBeVisible();
    expect((await header.boundingBox()).height).toBeLessThan(250);
    expect(await header.evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
    const navigation = header.getByRole('navigation', { name: 'Lesson sections', exact: true });
    for (const row of await navigation.getByRole('list').all()) {
      const buttons = row.getByRole('button');
      const positions = await buttons.evaluateAll(elements => elements.map(element => ({
        top: element.offsetTop, height: element.getBoundingClientRect().height,
      })));
      for (const target of positions) {
        expect(target.top).toBe(positions[0].top);
        expect(target.height).toBeGreaterThanOrEqual(24);
      }
    }
    await player.getByRole('button', { name: 'Mute narration', exact: true }).tap();
    await player.getByRole('button', { name: 'Play lesson', exact: true }).tap();
    await player.getByRole('button', { name: 'Pause narration', exact: true }).tap();
    await expect(player.getByRole('button', { name: 'Play lesson', exact: true })).toBeVisible();
    // A late section remains reachable by keyboard in the horizontal strip.
    await navigation.getByRole('list').first().getByRole('button').last().press('Enter');
    await expect(navigation.getByRole('list').first().locator('[aria-current="step"]')).toContainText('Change');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await a11yCheckpoint(page, 'compact mobile header', { include: '#blood_groups-video .vn-scenes', feature: 'narration-landscape' });
  });
}

for (const native of [true, false]) {
  test(`the mobile header auto-hides only during idle ${native ? 'native' : 'fallback'} fullscreen playback`, async ({ page }) => {
    if (!native) await page.addInitScript(() => {
      delete Element.prototype.requestFullscreen;
      delete Element.prototype.webkitRequestFullscreen;
    });
    await page.goto(url);
    const player = lesson(page);
    const header = player.getByRole('region', { name: 'Scene navigation', exact: true });
    await player.getByRole('button', { name: 'Mute narration', exact: true }).tap();
    await player.getByRole('button', { name: 'Play lesson', exact: true }).tap();
    await player.getByRole('button', { name: 'Enter full screen', exact: true }).tap();
    const exit = player.getByRole('button', { name: 'Exit full screen', exact: true });
    await expect(exit).toBeVisible();
    await expect(header).toBeVisible();
    const pictureHeight = await player.locator('.vn-screen').evaluate(element => element.clientHeight);
    await expect(header).toBeHidden({ timeout: 7000 });
    await expect(exit).toBeHidden();
    expect(await player.locator('.vn-screen').evaluate(element => element.clientHeight)).toBeGreaterThan(pictureHeight);
    // The first tap reveals both bars without pausing playback.
    const bounds = await player.getByRole('button', { name: 'Pause video', exact: true }).boundingBox();
    await page.touchscreen.tap(bounds.x + bounds.width * 0.8, bounds.y + bounds.height * 0.5);
    await expect(header).toBeVisible();
    await expect(exit).toBeVisible();
    await expect(player.locator('audio')).toHaveJSProperty('paused', false);
    // Assistive/keyboard focus must never disappear with the idle timer.
    await header.getByRole('button').first().focus();
    await page.clock.install();
    await page.clock.runFor(4000);
    await expect(header.getByRole('button').first()).toBeFocused();
    await expect(header).toBeVisible();
    await expect(exit).toBeVisible();
    await player.getByRole('button', { name: 'Pause narration', exact: true }).tap();
    await exit.tap();
    await expect(header).toBeVisible();
    await expect(player.getByRole('button', { name: 'Play lesson', exact: true })).toBeVisible();
  });
}

test.describe('desktop navigation', () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false });
  test('the desktop header remains visible when fullscreen playback controls hide', async ({ page }) => {
    await page.goto(url);
    const player = lesson(page);
    await player.getByRole('button', { name: 'Mute narration', exact: true }).click();
    await player.getByRole('button', { name: 'Play narration', exact: true }).click();
    await player.getByRole('button', { name: 'Enter full screen', exact: true }).click();
    await expect(player.getByRole('button', { name: 'Exit full screen', exact: true })).toBeHidden({ timeout: 7000 });
    await expect(player.getByRole('region', { name: 'Scene navigation', exact: true })).toBeVisible();
  });
});

for (const { native, width, height } of [
  { native: true, width: 390, height: 844 },
  { native: false, width: 390, height: 844 },
  { native: false, width: 320, height: 568 },
]) {
  test(`${native ? 'native' : 'fallback'} fullscreen at ${width}×${height} rotates a portrait phone, respects the orientation choice, and restores the page`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    if (!native) await page.addInitScript(() => {
      delete Element.prototype.requestFullscreen;
      delete Element.prototype.webkitRequestFullscreen;
    });
    await page.goto(url);
    const player = lesson(page);
    await player.getByRole('button', { name: 'Enter full screen' }).click();
    const exit = player.getByRole('button', { name: 'Exit full screen' });
    await expect(exit).toBeInViewport({ ratio: 1 });
    await expect(player.getByRole('button', { name: 'Player settings', exact: true })).toBeInViewport({ ratio: 1 });
    await expect.poll(async () => {
      const box = await picture(page).boundingBox();
      return box.height / box.width;
    }).toBeCloseTo(16 / 9, 1);
    const rotated = await picture(page).boundingBox();
    expect(rotated.width).toBeGreaterThan(width * 0.6);
    await player.getByRole('button', { name: 'Player settings', exact: true }).click();
    await player.getByRole('checkbox', { name: 'Landscape in full screen' }).uncheck();
    await player.getByRole('button', { name: 'Player settings', exact: true }).click();
    const upright = await picture(page).boundingBox();
    expect(upright.width / upright.height).toBeCloseTo(16 / 9, 1);
    await expect(exit).toBeInViewport();
    await exit.click();
    await expect(player.getByRole('button', { name: 'Enter full screen' })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

for (const dark of [false, true]) {
  test(`landscape fullscreen keeps long scenes, enlarged captions, settings and checks usable in ${dark ? 'dark' : 'light'} mode`, async ({ page }) => {
    // Desktop Chromium cannot resize a native fullscreen window. Use the
    // iPhone presentation path to simulate a physical orientation change.
    await page.addInitScript(() => {
      delete Element.prototype.requestFullscreen;
      delete Element.prototype.webkitRequestFullscreen;
    });
    await page.goto(url);
    await page.evaluate(dark => document.documentElement.classList.toggle('dark-mode', dark), dark);
    const player = lesson(page);
    await player.getByRole('button', { name: 'Enter full screen' }).click();
    await player.getByRole('button', { name: 'Player settings', exact: true }).click();
    await player.getByRole('combobox', { name: 'Scene', exact: true }).selectOption('8');
    await player.getByRole('combobox', { name: 'Caption size' }).selectOption('2');
    await player.getByRole('button', { name: 'Player settings', exact: true }).click();
    await expect(player.getByRole('button', { name: 'Exit full screen' })).toBeInViewport();
    const narration = player.getByRole('region', { name: 'Narration', exact: true });
    await expect(narration).toBeInViewport();
    await narration.focus();
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => narration.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    await a11yCheckpoint(page, 'rotated narration', { include: '#scrum-video [data-vn-video]', feature: 'narration-landscape' });
    // Physically turning the phone must remove the simulated rotation.
    await page.setViewportSize({ width: 844, height: 390 });
    await expect.poll(async () => {
      const box = await picture(page).boundingBox();
      return box.width / box.height;
    }).toBeCloseTo(16 / 9, 1);
    await player.getByRole('button', { name: 'Player settings', exact: true }).click();
    await player.getByRole('button', { name: 'Knowledge check', exact: true }).click();
    await expect(player.getByRole('region', { name: /Knowledge check$/ })).toBeInViewport();
    await player.getByRole('button', { name: 'Exit full screen' }).click();
    await expect(player.getByRole('heading', { name: /Knowledge check$/ })).toBeFocused();
  });
}

test('double taps skip in the correct direction on the rotated picture', async ({ page }) => {
  await page.goto(url);
  const player = lesson(page);
  await player.getByRole('button', { name: 'Enter full screen' }).click();
  const position = player.getByRole('slider', { name: 'Narration position' });
  await position.fill('15');
  const box = await player.getByRole('button', { name: 'Play video', exact: true }).boundingBox();
  // Clockwise rotation maps the picture's left/right halves to top/bottom.
  // Use its upper area (right after rotation), clear of the caption overlay.
  const tapHalf = async fraction => {
    await page.touchscreen.tap(box.x + box.width * 0.8, box.y + box.height * fraction);
    await page.touchscreen.tap(box.x + box.width * 0.8, box.y + box.height * fraction);
  };
  await tapHalf(0.75);
  await expect(position).toHaveValue('20');
  await tapHalf(0.25);
  await expect(position).toHaveValue('15');
});
