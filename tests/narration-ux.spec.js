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

for (const lesson of lessons) {
  test(`${lesson.topic}: inline controls precede the picture and the timeline names scenes`, async ({ page }) => {
    const player = await open(page, lesson);
    const position = player.getByRole('slider', { name: /position/ });
    const picture = player.getByRole('region', { name: 'Narration', exact: true });
    expect((await position.boundingBox()).y).toBeLessThan((await picture.boundingBox()).y);
    const timing = JSON.parse(readFileSync(`_data/explainers/${lesson.topic}_timing.json`, 'utf8'));
    const time = (timing.scenes[1].start + timing.scenes[1].end) / 2;
    await position.scrollIntoViewIfNeeded();
    const box = await position.boundingBox();
    await page.mouse.move(box.x + box.width * time / timing.duration, box.y + box.height / 2);
    await expect(player.getByRole('tooltip')).toContainText(lesson.story.scenes[1].label);
    await expect(player.getByRole('tooltip')).toContainText(/\d+:\d{2}/);
    await position.fill(time.toFixed(2));
    await expect(position).toHaveAttribute('aria-valuetext', new RegExp(lesson.story.scenes[1].label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
}

for (const topic of ['scrum', 'strategy']) {
  const lesson = lessons.find(item => item.topic === topic);
  const quizzes = quizOf(topic);
  const index = lesson.story.scenes.findIndex(scene => quizzes[scene.id] && !quizzes[scene.id].questions);
  const scene = lesson.story.scenes[index];
  const question = quizzes[scene.id];
  for (const correct of [true, false]) {
    test(`${topic}: one ${correct ? 'correct' : 'incorrect'} answer continues directly after feedback`, async ({ page }) => {
      const player = await open(page, lesson);
      await player.getByRole('button', { name: `Knowledge check: ${scene.label}`, exact: true }).click();
      const check = player.getByRole('region', { name: /— Knowledge check$/ });
      await expect(check.getByText(question.question, { exact: true })).toBeVisible();
      const answer = correct ? question.correct_index : question.options.findIndex((_, i) => i !== question.correct_index);
      await check.getByRole('radio').filter({ hasText: question.options[answer] }).click();
      await expect(check.getByText(question.explanation, { exact: true })).toBeVisible();
      await expect(check.getByRole('button', { name: 'See Results' })).toHaveCount(0);
      await expect(check.getByRole('button', { name: 'Continue narration' })).toBeFocused();
      await a11yCheckpoint(page, `${topic} feedback`, { include: `#${topic === 'scrum' ? 'scrum-video' : 'strategy-animation'}`, feature: 'narration-ux' });
      await page.keyboard.press('Enter');
      await expect(check).toBeHidden();
      await expect(player.getByRole('heading', { name: lesson.story.scenes[index + 1].title, exact: true })).toBeVisible();
      await expect(player.getByRole('button', { name: 'Pause narration' })).toBeVisible();
    });
  }
}

for (const mode of ['native pointer', 'native keyboard', 'native external', 'fallback pointer', 'fallback keyboard']) {
  test(`idle controls hide after ${mode} fullscreen entry and after resuming a check`, async ({ page }) => {
    if (mode.startsWith('fallback')) await useViewportFullscreen(page);
    const lesson = lessons.find(item => item.topic === 'strategy');
    const player = await open(page, lesson);
    const fullscreen = player.getByRole('button', { name: 'Enter full screen' });
    await player.getByRole('button', { name: 'Play narration', exact: true }).click();
    if (mode.endsWith('external')) await player.locator('[data-vn-video]').evaluate(video => video.requestFullscreen());
    else if (mode.endsWith('keyboard')) await fullscreen.press('f');
    else await fullscreen.click();
    const exit = player.getByRole('button', { name: 'Exit full screen', exact: true });
    await expect(exit).toBeVisible();
    // No mouse movement after entry: a stationary pointer must not pin chrome.
    await expect(exit).toBeHidden({ timeout: 7000 });
    await page.keyboard.press('Tab');
    await expect(player.getByRole('slider', { name: /position/ })).toBeVisible();
    await expect(player.getByRole('slider', { name: /position/ })).toBeFocused();

    await player.getByRole('button', { name: 'Knowledge check: Context: one task, many algorithms', exact: true }).click();
    const check = player.getByRole('region', { name: /— Knowledge check$/ });
    await check.getByRole('radio').first().click();
    await check.getByRole('button', { name: 'Continue narration', exact: true }).click();
    await expect(check).toBeHidden();
    await expect(exit).toBeHidden({ timeout: 7000 });
  });
}

test('timeline labels stay hoverable and Escape dismisses them before fullscreen', async ({ page }) => {
  await useViewportFullscreen(page);
  const player = await open(page, lessons.find(item => item.topic === 'strategy'));
  await player.getByRole('button', { name: 'Play narration', exact: true }).click();
  await player.getByRole('button', { name: 'Enter full screen' }).click();
  const exit = player.getByRole('button', { name: 'Exit full screen', exact: true });
  const label = player.getByRole('tooltip');
  await player.getByRole('slider', { name: /position/ }).hover();
  await expect(label).toBeVisible();
  await label.hover();
  await page.clock.install();
  await page.clock.runFor(4000);
  await expect(label).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(label).toBeHidden();
  await expect(exit).toBeVisible();
  await page.clock.runFor(4000);
  await expect(exit).toBeHidden();
});

for (const dark of [false, true]) {
  test(`timeline check targets stay usable at 320px in ${dark ? 'dark' : 'light'} mode`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    const lesson = lessons.find(item => item.topic === 'scrum');
    const player = await open(page, lesson);
    const theme = page.getByRole('checkbox', { name: 'Toggle dark mode' });
    if (await theme.isChecked() !== dark) await theme.press('Space');
    const timeline = player.getByRole('group', { name: 'Narration timeline', exact: true });
    const checks = timeline.getByRole('button');
    await expect(checks.last()).toBeVisible();
    const boxes = await checks.evaluateAll(buttons => buttons.map(button => {
      const { x, y, width, height } = button.getBoundingClientRect();
      return { x, y, width, height };
    }));
    for (const [index, box] of boxes.entries()) {
      expect(box.width).toBeGreaterThanOrEqual(24);
      expect(box.height).toBeGreaterThanOrEqual(24);
      expect(box.x + box.width).toBeLessThanOrEqual(320);
      for (const other of boxes.slice(index + 1)) {
        expect(box.x >= other.x + other.width || other.x >= box.x + box.width || box.y >= other.y + other.height || other.y >= box.y + box.height).toBe(true);
      }
    }
    await a11yCheckpoint(page, 'narrow timeline', { include: '#scrum-video', feature: 'narration-ux' });
    await checks.last().click();
    const choices = player.getByRole('region', { name: 'Choose a knowledge check' });
    if (await choices.isVisible()) {
      await a11yCheckpoint(page, 'grouped knowledge checks', { include: '#scrum-video', feature: 'narration-ux' });
      await choices.getByRole('button', { name: 'Knowledge check: Summary', exact: true }).click();
    }
    await expect(player.getByRole('region', { name: /— Summary quiz$/ })).toBeVisible();
  });
}

test('a multi-question summary retains its results before finishing the narration', async ({ page }) => {
  const lesson = lessons.find(item => item.topic === 'strategy');
  const scene = lesson.story.scenes.at(-1);
  const questions = quizOf('strategy')[scene.id].questions;
  const player = await open(page, lesson);
  await player.getByRole('button', { name: `Knowledge check: ${scene.label}`, exact: true }).click();
  const check = player.getByRole('region', { name: /— Summary quiz$/ });
  for (const [index, question] of questions.entries()) {
    await check.getByRole('radio').filter({ hasText: question.options[question.correct_index] }).click();
    await expect(check.getByText(question.explanation, { exact: true })).toBeVisible();
    await check.getByRole('button', { name: index < questions.length - 1 ? 'Next Question' : 'See Results', exact: true }).click();
  }
  await expect(check.getByText('Knowledge Check Complete!', { exact: true })).toBeVisible();
  await check.getByRole('button', { name: 'Finish review', exact: true }).click();
  await expect(check).toBeHidden();
  await expect(player.getByRole('status').filter({ hasText: 'Narration and final knowledge check finished.' })).toBeVisible();
});

test('grouped check dots support Space, Escape and keyboard selection on phones', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  const player = await open(page, lessons.find(item => item.topic === 'scrum'));
  const dot = player.getByRole('button', { name: /^\d+ knowledge checks:/ }).first();
  await dot.focus();
  await dot.press('Space');
  const menu = player.getByRole('region', { name: 'Choose a knowledge check' });
  await expect(menu).toBeVisible();
  const first = menu.getByRole('button', { name: /^Knowledge check:/ }).first();
  await expect(first).toBeFocused();
  const chapter = (await first.getAttribute('aria-label')).replace('Knowledge check: ', '');
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(dot).toBeFocused();
  await dot.press('Enter');
  await page.keyboard.press('Space');
  await expect(menu).toBeHidden();
  await expect(player.getByRole('region', { name: new RegExp(chapter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' — Knowledge check$') })).toBeVisible();
});

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
      await player.getByRole('group', { name: 'Narration timeline', exact: true }).getByRole('button').last().click();
      const choices = player.getByRole('region', { name: 'Choose a knowledge check' });
      if (await choices.isVisible()) await choices.getByRole('button', { name: `Knowledge check: ${scene.label}`, exact: true }).click();
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
