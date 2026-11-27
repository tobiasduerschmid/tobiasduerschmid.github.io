const { test, expect } = require('@playwright/test');
const { lessonIds, loadLesson } = require('../scripts/narration/source');
const { isArticleNarration, narrationPlayer, openPlayerSettings } = require('./helpers/narration-player');
const { a11yCheckpoint } = require('./a11y-helpers');

const cookieName = 'sebook-narration-preferences';
const lessons = lessonIds().map(topic => ({ topic, ...loadLesson(topic) })).filter(({ story }) => story.audio);
const representatives = ['scrum', 'strategy', 'nodejs', 'therac25'].map(topic => lessons.find(lesson => lesson.topic === topic));

async function open(page, lesson) {
  await page.goto(lesson.lesson.chapter);
  const player = narrationPlayer(page, lesson);
  await expect(player.getByRole('button', { name: 'Play narration', exact: true })).toBeVisible();
  return player;
}

async function expectPreferences(player, captions, speed, { article = false, finalCheckOnly = false } = {}) {
  await expect(player.getByRole('button', { name: 'Closed captions (CC)', exact: true })).toHaveAttribute('aria-pressed', String(captions));
  const caption = player.getByRole('region', { name: 'Narration', exact: true, includeHidden: true });
  if (captions) await expect(caption).toBeVisible();
  else await expect(caption).toBeHidden();
  await openPlayerSettings(player);
  await expect(player.getByRole('combobox', { name: /^(Narration speed|Speed)$/ })).toHaveValue(String(speed));
  const finalCheck = player.getByRole('checkbox', { name: 'Only pause for the final knowledge check', exact: true });
  if (article) await expect(finalCheck).toHaveCount(0);
  else await expect(finalCheck).toBeChecked({ checked: finalCheckOnly });
  await expect(player.locator('audio')).toHaveJSProperty('playbackRate', speed);
  await expect(player.locator('audio')).toHaveJSProperty('paused', true);
  await player.getByRole('button', { name: 'Close settings', exact: true }).click();
}

for (const lesson of lessons) {
  const article = isArticleNarration(lesson.lesson);
  test(`${lesson.topic}: restores the shared cookie in its captions, speed selector, and audio`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: cookieName, value: encodeURIComponent(JSON.stringify({ captions: false, speed: 2, finalCheckOnly: true })), url: baseURL }]);
    const player = await open(page, lesson);
    await expectPreferences(player, false, 2, { article, finalCheckOnly: true });
  });
}

for (const article of lessons.filter(({ lesson }) => isArticleNarration(lesson))) {
  test(`${article.topic}: article choices survive reload and preserve the lesson's knowledge-check choice`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: cookieName, value: encodeURIComponent(JSON.stringify({ finalCheckOnly: true })), url: baseURL }]);
    const player = await open(page, article);
    await player.getByRole('button', { name: 'Closed captions (CC)', exact: true }).click();
    await openPlayerSettings(player);
    await expect(player.getByRole('checkbox', { name: 'Pause and predict', exact: true })).toHaveCount(0);
    await player.getByRole('combobox', { name: /^(Narration speed|Speed)$/ }).selectOption('1.5');
    await expectPreferences(player, false, 1.5, { article: true });
    await page.reload();
    await expectPreferences(player, false, 1.5, { article: true });
    const lessonPlayer = await open(page, representatives[0]);
    await expectPreferences(lessonPlayer, false, 1.5, { finalCheckOnly: true });
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
    expect(JSON.parse(decodeURIComponent(cookie.value))).toMatchObject({ captions: false, speed: 0.5, finalCheckOnly: false });
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
  const captionSize = page.getByRole('combobox', { name: 'Narration caption size', exact: true });
  const landscape = page.getByRole('checkbox', { name: 'Narration landscape in full screen', exact: true });
  const predictions = page.getByRole('checkbox', { name: 'Narration pause and predict', exact: true });
  const motion = page.getByRole('combobox', { name: 'Narration animation', exact: true });
  await expect(captions).toBeChecked();
  await expect(speed).toHaveValue('1');
  await captions.press('Space');
  await expect(captions).not.toBeChecked();
  await expect(finalCheck).not.toBeChecked();
  await finalCheck.press('Space');
  await speed.selectOption('1.25');
  await captionSize.selectOption('2');
  await landscape.press('Space');
  await predictions.press('Space');
  await motion.selectOption('still');
  await page.getByRole('slider', { name: 'Narration volume', exact: true }).fill('35');
  await page.getByRole('checkbox', { name: 'Mute narration', exact: true }).press('Space');
  await page.reload();
  await expect(captions).not.toBeChecked();
  await expect(speed).toHaveValue('1.25');
  await expect(finalCheck).toBeChecked();
  await expect(captionSize).toHaveValue('2');
  await expect(landscape).not.toBeChecked();
  await expect(predictions).not.toBeChecked();
  await expect(motion).toHaveValue('still');
  await expect(page.getByRole('slider', { name: 'Narration volume', exact: true })).toHaveValue('35');
  await expect(page.getByRole('checkbox', { name: 'Mute narration', exact: true })).toBeChecked();
  await a11yCheckpoint(page, 'shared narration preferences', { feature: 'narration-preferences' });
  const player = await open(page, representatives[0]);
  await expectPreferences(player, false, 1.25, { finalCheckOnly: true });
  await expectExtraPreferences(player, { captionSize: '2', volume: 0.35, muted: true, enabled: false });
  await page.goto('/cookies/');
  const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: cookieName, exact: true }) });
  await expect(row.getByText('set', { exact: true })).toBeVisible();
  await row.getByRole('button', { name: `Delete ${cookieName}`, exact: true }).click();
  await expect(row.getByText('not set', { exact: true })).toBeVisible();
  const resetPlayer = await open(page, representatives[0]);
  await expectPreferences(resetPlayer, true, 1);
  await expectExtraPreferences(resetPlayer, { captionSize: '1', volume: 1, muted: false, enabled: true });
});

async function expectExtraPreferences(player, { captionSize, volume, muted, enabled }) {
  await openPlayerSettings(player);
  await expect(player.getByRole('combobox', { name: 'Caption size', exact: true })).toHaveValue(captionSize);
  await expect(player.getByRole('checkbox', { name: 'Landscape in full screen', exact: true })).toBeChecked({ checked: enabled });
  const predictions = player.getByRole('checkbox', { name: 'Pause and predict', exact: true });
  if (await predictions.count()) await expect(predictions).toBeChecked({ checked: enabled });
  const motion = player.getByRole('checkbox', { name: 'Animate visuals', exact: true });
  if (await motion.count()) await expect(motion).toBeChecked({ checked: enabled });
  await expect(player.locator('audio')).toHaveJSProperty('volume', volume);
  await expect(player.locator('audio')).toHaveJSProperty('muted', muted);
  await expect(player.locator('audio')).toHaveJSProperty('paused', true);
  await player.getByRole('button', { name: 'Close settings', exact: true }).click();
}

test('all player settings transfer between narration kinds without losing unsupported choices', async ({ page, context }) => {
  let player = await open(page, representatives[0]);
  const caption = player.getByRole('region', { name: 'Narration', exact: true });
  const initialSize = await caption.evaluate(element => parseFloat(getComputedStyle(element).fontSize));
  await player.getByRole('slider', { name: 'Volume', exact: true }).fill('35');
  await player.getByRole('button', { name: 'Mute narration', exact: true }).click();
  await openPlayerSettings(player);
  await player.getByRole('combobox', { name: 'Caption size', exact: true }).selectOption('2');
  await expect.poll(() => caption.evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeCloseTo(initialSize * 2, 1);
  await player.getByRole('checkbox', { name: 'Landscape in full screen', exact: true }).uncheck();
  await player.getByRole('checkbox', { name: 'Pause and predict', exact: true }).uncheck();
  await player.getByRole('checkbox', { name: 'Animate visuals', exact: true }).uncheck();
  await player.getByRole('combobox', { name: 'Scene', exact: true }).selectOption('2');

  player = await open(page, representatives[1]);
  await expect(player.getByRole('heading', { name: representatives[1].story.scenes[0].title, exact: true })).toBeVisible();
  await expectExtraPreferences(player, { captionSize: '2', volume: 0.35, muted: true, enabled: false });
  await player.getByRole('combobox', { name: 'Code language', exact: true }).selectOption('java');
  await openPlayerSettings(player);
  await player.getByRole('combobox', { name: 'Caption size', exact: true }).selectOption('1.25');
  // Patterns have no animation checkbox; changing another choice preserves it.
  for (const lesson of [representatives[2], representatives[3], representatives[1]]) {
    player = await open(page, lesson);
    await expectExtraPreferences(player, { captionSize: '1.25', volume: 0.35, muted: true, enabled: false });
  }
  await expect(player.getByRole('combobox', { name: 'Code language', exact: true })).toHaveValue('java');
  await page.reload();
  await expectExtraPreferences(player, { captionSize: '1.25', volume: 0.35, muted: true, enabled: false });
  const cookies = await context.cookies();
  expect(cookies.find(cookie => cookie.name === 'sebook-code-language').value).toBe('java');
  expect(JSON.parse(decodeURIComponent(cookies.find(cookie => cookie.name === cookieName).value)))
    .toMatchObject({ captionSize: 1.25, volume: 0.35, muted: true, landscape: false, predictions: false, motion: false });
});

test('animation follows the system until a saved choice overrides it and can return to the system default', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let player = await open(page, representatives[2]);
  await openPlayerSettings(player);
  let motion = player.getByRole('checkbox', { name: 'Animate visuals', exact: true });
  await expect(motion).not.toBeChecked();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(motion).toBeChecked();
  await motion.uncheck();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(motion).not.toBeChecked();
  await page.reload();
  await openPlayerSettings(player);
  await expect(motion).not.toBeChecked();
  await page.goto('/settings/');
  await page.getByRole('combobox', { name: 'Narration animation', exact: true }).selectOption('system');
  player = await open(page, representatives[0]);
  await openPlayerSettings(player);
  motion = player.getByRole('checkbox', { name: 'Animate visuals', exact: true });
  await expect(motion).toBeChecked();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(motion).not.toBeChecked();
});
