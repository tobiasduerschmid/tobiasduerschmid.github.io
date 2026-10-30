const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
const url = '/SEBook/process/scrum.html';
const lesson = page => page.getByRole('region', { name: 'Scrum in one sprint', exact: true });
// The animation iframe is decorative; its title identifies the painted picture.
const picture = page => lesson(page).locator('iframe[title="Scrum animation"]');

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
  const tapHalf = async fraction => {
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height * fraction);
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height * fraction);
  };
  await tapHalf(0.75);
  await expect(position).toHaveValue('20');
  await tapHalf(0.25);
  await expect(position).toHaveValue('15');
});
