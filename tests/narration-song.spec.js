const { test, expect } = require('@playwright/test');
const { readFileSync } = require('node:fs');
const yaml = require('js-yaml');
const { loadLesson } = require('../scripts/narration/source');
const { a11yCheckpoint } = require('./a11y-helpers');
const { openPlayerSettings } = require('./helpers/narration-player');

const topics = ['scrum', 'strategy', 'nodejs', 'therac25'];
const lessons = topics.map(topic => ({ topic, ...loadLesson(topic) }));
const quizOf = topic => yaml.load(readFileSync(`_data/explainers/${topic}_quizzes.yml`, 'utf8'));

async function useViewportFullscreen(page) {
  await page.addInitScript(() => {
    Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false });
    Object.defineProperty(Document.prototype, 'webkitFullscreenEnabled', { get: () => false });
    Element.prototype.webkitRequestFullscreen = undefined;
  });
}

async function open(page, lesson) {
  // Keep real media playback silent, including song frames created after the quiz.
  // The local headless audio device can interrupt unmuted playback.
  await page.addInitScript(() => {
    document.addEventListener('play', event => {
      if (event.target instanceof HTMLMediaElement) event.target.muted = true;
    }, true);
  });
  // WEBrick can return 304 for conditional MP3 range requests after a seek.
  // Request the actual bytes; the media and transport still run unchanged.
  await page.route('**/assets/audio/**', route => {
    const headers = { ...route.request().headers() };
    if (headers.range) {
      delete headers['if-none-match'];
      delete headers['if-modified-since'];
    }
    return route.continue({ headers });
  });
  await page.goto(lesson.lesson.chapter);
  const player = page.getByRole('region', { name: lesson.story.title, exact: true });
  await expect(player.getByRole('button', { name: 'Play narration', exact: true })).toBeVisible();
  return player;
}

for (const mode of ['inline', 'native fullscreen', 'viewport fullscreen', 'inline dark mobile']) {
  test(`Scrum final quiz replaces the player surface and Previous song restores it (${mode})`, async ({ page }) => {
    const inline = mode.startsWith('inline');
    if (mode === 'viewport fullscreen') await useViewportFullscreen(page);
    if (mode === 'inline dark mobile') await page.setViewportSize({ width: 320, height: 800 });
    const lesson = lessons.find(item => item.topic === 'scrum');
    const player = await open(page, lesson);
    if (mode === 'inline dark mobile') await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
    const scene = lesson.story.scenes.at(-1);
    const questions = quizOf('scrum')[scene.id].questions;
    const host = player.locator('[data-vn-video]');
    const songFrame = player.getByTitle('Inspect and Adapt: a Scrum musical: interactive music player');
    const song = songFrame.contentFrame();
    const songAudio = song.getByLabel('Inspect and Adapt: a Scrum musical audio', { exact: true });
    if (!inline) await player.getByRole('button', { name: 'Enter full screen', exact: true }).click();
    async function openSummary() {
      await openPlayerSettings(player);
      await player.getByRole('combobox', { name: 'Scene', exact: true }).selectOption(String(lesson.story.scenes.length - 1));
      await player.getByRole('button', { name: 'Knowledge check', exact: true }).click();
    }
    await openSummary();
    const check = player.getByRole('region', { name: /— Summary quiz$/ });
    for (const [index, question] of questions.entries()) {
      await check.getByRole('radio').filter({ hasText: question.options[question.correct_index] }).click();
      await check.getByRole('button', { name: index < questions.length - 1 ? 'Next Question' : 'See Results', exact: true }).click();
    }
    await expect(check.getByText('Knowledge Check Complete!', { exact: true })).toBeVisible();
    await expect(songFrame).toHaveCount(0);
    const continueButton = check.getByRole('button', { name: 'Continue to song', exact: true });
    await continueButton.focus();
    await page.keyboard.press('Enter');
    await expect(song.getByRole('button', { name: 'Pause song', exact: true })).toBeFocused();
    await expect(songAudio).toHaveJSProperty('paused', false);
    await expect(player.locator('audio')).toHaveJSProperty('paused', true);
    await expect(player.getByRole('button', { name: 'Play narration', exact: true })).toBeHidden();
    if (inline) {
      expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
      await song.getByRole('button', { name: 'Enter full screen', exact: true }).click();
      await expect(song.getByRole('button', { name: 'Exit full screen', exact: true })).toBeVisible();
      await song.getByRole('button', { name: 'Exit full screen', exact: true }).click();
    } else {
      await expect(song.getByRole('button', { name: 'Exit full screen', exact: true })).toBeVisible();
      if (mode === 'native fullscreen') expect(await host.evaluate(el => document.fullscreenElement === el)).toBe(true);
      else await expect(host).toHaveClass(/is-viewport-fullscreen/);
    }
    await song.getByRole('button', { name: 'Pause song', exact: true }).click();
    await a11yCheckpoint(page, `song inside narration (${mode})`, { include: '#scrum-video', feature: 'narration-ux' });
    const completedPosition = await player.locator('audio').evaluate(audio => audio.currentTime);
    await song.getByRole('button', { name: 'Previous song', exact: true }).click();
    await expect(songAudio).toHaveJSProperty('paused', true);
    await expect(player.getByRole('button', { name: 'Play narration', exact: true })).toBeFocused();
    await expect(player.locator('audio')).toHaveJSProperty('paused', true);
    await expect(player.locator('audio')).toHaveJSProperty('currentTime', completedPosition);
    await expect(songFrame).toBeHidden();
    if (mode === 'native fullscreen') expect(await host.evaluate(el => document.fullscreenElement === el)).toBe(true);
    else if (mode === 'viewport fullscreen') await expect(host).toHaveClass(/is-viewport-fullscreen/);
    else expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
    // Revisit the completed quiz: reuse the song session without losing the host.
    await openSummary();
    await check.getByRole('button', { name: 'Continue to song', exact: true }).click();
    await expect(songFrame).toHaveCount(1);
    await expect(song.getByRole('button', { name: 'Pause song', exact: true })).toBeFocused();
    await song.getByRole('button', { name: 'Previous song', exact: true }).click();
    await expect(player.getByRole('button', { name: 'Play narration', exact: true })).toBeFocused();
  });
}

test('security final decision continues to its paired song and returns to the case study', async ({ page }) => {
  const lesson = loadLesson('huggingface2026');
  const player = await open(page, lesson);
  const scene = lesson.story.scenes.at(-1);
  const title = 'Design It In Before They Break In: a song about designing for security';
  const songFrame = player.getByTitle(`${title}: interactive music player`);
  const song = songFrame.contentFrame();
  const songAudio = song.getByLabel(`${title} audio`, { exact: true });
  await openPlayerSettings(player);
  await player.getByRole('combobox', { name: 'Review a scene' }).selectOption(String(lesson.story.scenes.length - 1));
  for (const cue of scene.cues.slice(1)) await player.getByRole('button', { name: 'Next step', exact: true }).click();
  await player.getByRole('button', { name: 'Choose next action', exact: true }).click();
  const check = player.getByRole('region', { name: /— Choose the next action$/ });
  await check.getByRole('radio').filter({ hasText: scene.checkpoint.options[scene.checkpoint.correct_index] }).click();
  await expect(check.getByText(scene.checkpoint.explanation, { exact: true })).toBeVisible();
  await expect(songFrame).toHaveCount(0);
  await check.getByRole('button', { name: 'Continue to song', exact: true }).press('Enter');
  await expect(song.getByRole('button', { name: 'Pause song', exact: true })).toBeFocused();
  await expect(songAudio).toHaveJSProperty('paused', false);
  await expect(player.locator('audio')).toHaveJSProperty('paused', true);
  await song.getByRole('button', { name: 'Previous song', exact: true }).press('Enter');
  await expect(songAudio).toHaveJSProperty('paused', true);
  await expect(player.getByRole('button', { name: 'Play narration', exact: true })).toBeFocused();
  await expect(player.getByRole('heading', { name: scene.title, exact: true })).toBeVisible();
});
