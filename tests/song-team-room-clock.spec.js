// @ts-check
const { test, expect } = require('@playwright/test');

test.use({ timezoneId: 'America/Los_Angeles' });

// The hands are decorative artwork; their stable IDs identify the visible
// orientation, without exposing the clock's timer or other internal state.
async function expectClock(page, angles) {
  for (const [hand, angle] of Object.entries(angles)) {
    await expect.poll(() => page.getByTestId(`team-room-${hand}-hand`).evaluate(
      node => node.transform.baseVal.getItem(0).angle,
    ), { message: `the ${hand} hand shows local system time` }).toBeCloseTo(angle, 1);
  }
}

for (const reducedMotion of ['no-preference', 'reduce']) {
  test(`Scrum wall clock follows local time while paused and seeking (${reducedMotion})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    // Freeze Date while leaving timers running: the clock must refresh itself
    // without a media frame, including across local midnight.
    await page.clock.setFixedTime(new Date('2026-11-22T07:59:58Z'));
    await page.goto('/assets/song-player/inspect-and-adapt.html');
    // Reduced motion initially selects lyrics-only mode; opt into the picture.
    await page.getByRole('checkbox', { name: 'Use lyrics-only mode', exact: true }).uncheck();
    const audio = page.getByLabel('Inspect and Adapt: a Scrum musical audio', { exact: true });
    await expect(page.getByTestId('team-room-second-hand')).toBeVisible();
    await expect(audio).toHaveJSProperty('paused', true);
    await expectClock(page, { hour: 360, minute: 359.8, second: 348 });

    await page.clock.setFixedTime(new Date('2026-11-22T08:00:01Z'));
    await expectClock(page, { hour: 0, minute: 0.1, second: 6 });
    await expect(audio).toHaveJSProperty('paused', true);
    await expect(audio).toHaveJSProperty('currentTime', 0);

    // Timeline.seek is the renderer's public API. Neither forward nor backward
    // seeking may substitute song elapsed time for the wall clock.
    await page.evaluate(() => window.Timeline.seek(180));
    await expectClock(page, { hour: 0, minute: 0.1, second: 6 });
    await page.evaluate(() => window.Timeline.seek(0));
    await expectClock(page, { hour: 0, minute: 0.1, second: 6 });

    await page.clock.setFixedTime(new Date('2026-11-22T11:04:05Z'));
    await expectClock(page, { hour: 92, minute: 24.5, second: 30 });
  });
}
