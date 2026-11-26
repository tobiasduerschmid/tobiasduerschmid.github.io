const { test, expect } = require('@playwright/test');
const { lessonIds, loadLesson } = require('../scripts/narration/source');
const { openPlayerSettings } = require('./helpers/narration-player');
const { a11yCheckpoint } = require('./a11y-helpers');

const cookieName = 'sebook-narration-preferences';
const lessons = lessonIds().map(topic => ({ topic, ...loadLesson(topic) })).filter(({ story }) => story.audio);
const representatives = ['scrum', 'strategy', 'nodejs', 'therac25'].map(topic => lessons.find(lesson => lesson.topic === topic));

async function open(page, lesson) {
  await page.goto(lesson.lesson.chapter);
  const player = page.getByRole('region', { name: lesson.story.title, exact: true });
  await expect(player.getByRole('button', { name: 'Play narration', exact: true })).toBeVisible();
  return player;
}

async function expectPreferences(player, captions, speed, finalCheckOnly = false) {
  await expect(player.getByRole('button', { name: 'Closed captions (CC)', exact: true })).toHaveAttribute('aria-pressed', String(captions));
  const caption = player.getByRole('region', { name: 'Narration', exact: true, includeHidden: true });
  if (captions) await expect(caption).toBeVisible();
  else await expect(caption).toBeHidden();
  await openPlayerSettings(player);
  await expect(player.getByRole('combobox', { name: /^(Narration speed|Speed)$/ })).toHaveValue(String(speed));
  await expect(player.getByRole('checkbox', { name: 'Only pause for the final knowledge check', exact: true })).toBeChecked({ checked: finalCheckOnly });
  await expect(player.locator('audio')).toHaveJSProperty('playbackRate', speed);
  await expect(player.locator('audio')).toHaveJSProperty('paused', true);
  await player.getByRole('button', { name: 'Close settings', exact: true }).click();
}

for (const lesson of lessons) {
  test(`${lesson.topic}: restores the shared cookie in its captions, speed selector, and audio`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: cookieName, value: encodeURIComponent(JSON.stringify({ captions: false, speed: 2, finalCheckOnly: true })), url: baseURL }]);
    const player = await open(page, lesson);
    await expectPreferences(player, false, 2, true);
  });
}

for (const [index, lesson] of representatives.entries()) {
  test(`${lesson.kind}: player choices survive reload and carry over to another narration kind`, async ({ page, context }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let player = await open(page, lesson);
    await expectPreferences(player, true, 1);
    expect((await context.cookies()).find(cookie => cookie.name === cookieName)).toBeUndefined();
    // The existing keyboard shortcut must save the same preference as a click.
    await player.getByRole('button', { name: 'Closed captions (CC)', exact: true }).press('c');
    await openPlayerSettings(player);
    await player.getByRole('combobox', { name: /^(Narration speed|Speed)$/ }).selectOption('0.5');
    await expectPreferences(player, false, 0.5);
    const cookie = (await context.cookies()).find(cookie => cookie.name === cookieName);
    expect(JSON.parse(decodeURIComponent(cookie.value))).toEqual({ captions: false, speed: 0.5, finalCheckOnly: false });
    expect(cookie.path).toBe('/');
    expect(cookie.sameSite).toBe('Lax');
    expect(cookie.expires).toBeGreaterThan(Date.now() / 1000 + 364 * 24 * 60 * 60);
    await page.reload();
    await expectPreferences(player, false, 0.5);
    await player.getByRole('button', { name: 'Mute narration', exact: true }).click();
    await player.getByRole('button', { name: 'Play narration', exact: true }).click();
    await expect.poll(() => player.locator('audio').evaluate(audio => audio.currentTime)).toBeGreaterThan(0);
    await expect(player.locator('audio')).toHaveJSProperty('playbackRate', 0.5);
    await player.getByRole('button', { name: 'Pause narration', exact: true }).click();
    player = await open(page, representatives[(index + 1) % representatives.length]);
    await expectPreferences(player, false, 0.5);
    await player.getByRole('button', { name: 'Closed captions (CC)', exact: true }).click();
    await page.reload();
    await expectPreferences(player, true, 0.5);
    expect(errors).toEqual([]);
  });
}

test('Settings edits and Browser storage deletion are reflected in narration players', async ({ page }) => {
  await page.goto('/settings/');
  const captions = page.getByRole('checkbox', { name: 'Narration closed captions', exact: true });
  const speed = page.getByRole('combobox', { name: 'Narration playback speed', exact: true });
  const finalCheck = page.getByRole('checkbox', { name: 'Only pause for the final knowledge check', exact: true });
  await expect(captions).toBeChecked();
  await expect(speed).toHaveValue('1');
  await captions.press('Space');
  await expect(captions).not.toBeChecked();
  await expect(finalCheck).not.toBeChecked();
  await finalCheck.press('Space');
  await speed.selectOption('1.25');
  await page.reload();
  await expect(captions).not.toBeChecked();
  await expect(speed).toHaveValue('1.25');
  await expect(finalCheck).toBeChecked();
  await a11yCheckpoint(page, 'shared narration preferences', { feature: 'narration-preferences' });
  const player = await open(page, representatives[0]);
  await expectPreferences(player, false, 1.25, true);
  await page.goto('/cookies/');
  const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: cookieName, exact: true }) });
  await expect(row.getByText('set', { exact: true })).toBeVisible();
  await row.getByRole('button', { name: `Delete ${cookieName}`, exact: true }).click();
  await expect(row.getByText('not set', { exact: true })).toBeVisible();
  await expectPreferences(await open(page, representatives[0]), true, 1);
});
