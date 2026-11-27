const { test, expect } = require('@playwright/test');
const { readFileSync } = require('node:fs');
const yaml = require('js-yaml');
const { loadLesson } = require('../scripts/narration/source');
const { a11yCheckpoint } = require('./a11y-helpers');
const { openPlayerSettings, setSiteTheme } = require('./helpers/narration-player');

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
  test(`${lesson.topic}: bottom controls and the top playback shortcut stay synchronized`, async ({ page }) => {
    const player = await open(page, lesson);
    const position = player.getByRole('slider', { name: /position/ });
    const captions = await player.getByRole('region', { name: 'Narration', exact: true }).boundingBox();
    const host = await player.locator('[data-vn-video]').boundingBox();
    const bar = await player.locator('.vn-controls').boundingBox();
    expect(bar.y).toBeGreaterThanOrEqual(captions.y + captions.height - 1);
    expect(bar.y + bar.height).toBeCloseTo(host.y + host.height, 0);
    const shortcut = player.getByRole('button', { name: 'Play lesson', exact: true });
    const shortcutBox = await shortcut.boundingBox();
    expect(shortcutBox.y - host.y).toBeLessThan(60);
    expect(shortcutBox.x - host.x).toBeLessThan(60);
    expect(shortcutBox.width).toBeGreaterThanOrEqual(44);
    expect(shortcutBox.height).toBeGreaterThanOrEqual(44);
    await shortcut.click();
    await expect(player.getByRole('button', { name: 'Pause lesson', exact: true })).toBeVisible();
    await player.getByRole('button', { name: 'Pause narration', exact: true }).click();
    await expect(shortcut).toBeVisible();
    await player.getByRole('button', { name: 'Play narration', exact: true }).click();
    await player.getByRole('button', { name: 'Pause lesson', exact: true }).press('Space');
    await expect(player.getByRole('button', { name: 'Play narration', exact: true })).toBeVisible();
    const timing = JSON.parse(readFileSync(`_data/explainers/${lesson.topic}_timing.json`, 'utf8'));
    const time = (timing.scenes[1].start + timing.scenes[1].end) / 2;
    await position.scrollIntoViewIfNeeded();
    const box = await position.boundingBox();
    await page.mouse.move(box.x + box.width * time / timing.duration, box.y + box.height / 2);
    await expect(player.getByRole('tooltip')).toContainText(lesson.story.scenes[1].label);
    await expect(player.getByRole('tooltip')).toContainText(/\d+:\d{2}/);
    await position.fill(time.toFixed(2));
    await expect(position).toHaveAttribute('aria-valuetext', new RegExp(lesson.story.scenes[1].label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await shortcut.press('f');
    await expect(shortcut).toBeHidden();
    await expect(player.locator('[data-vn-video]')).toBeFocused();
    await player.getByRole('button', { name: 'Exit full screen', exact: true }).click();
    await expect(shortcut).toBeVisible();
  });
}

for (const dark of [false, true]) {
  for (const width of [1440, 320]) {
    test(`the compact bar stays at the bottom with readable controls at ${width}px in ${dark ? 'dark' : 'light'} mode`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const player = await open(page, loadLesson('blood_groups'));
      await setSiteTheme(page, dark);
      const video = player.locator('[data-vn-video]');
      const bar = player.locator('.vn-controls');
      const markers = player.getByRole('group', { name: 'Knowledge checks and closer looks', exact: true });
      for (const fullscreen of [false, true]) {
        if (fullscreen) await player.getByRole('button', { name: 'Enter full screen', exact: true }).click();
        await expect.poll(() => video.evaluate(element => {
          const bounds = element.getBoundingClientRect();
          const bar = element.querySelector('.vn-controls').getBoundingClientRect();
          return Math.abs(bar.bottom - bounds.bottom);
        })).toBeLessThan(0.5);
        const controls = await bar.boundingBox();
        // A desktop bar uses at most 110px; narrow layouts may wrap their
        // full-size controls, but must never overflow or add empty lanes.
        expect(controls.height).toBeLessThanOrEqual(width > 1000 ? 110 : 150);
        const targets = await markers.getByRole('button').evaluateAll(buttons => buttons.map(button => {
          const { x, y, width, height } = button.getBoundingClientRect();
          return { x, y, width, height };
        }));
        expect(targets.length).toBeGreaterThan(0);
        for (const [index, target] of targets.entries()) {
          expect(target.width).toBeGreaterThanOrEqual(24);
          expect(target.height).toBeGreaterThanOrEqual(24);
          expect(target.x).toBeGreaterThanOrEqual(controls.x);
          expect(target.x + target.width).toBeLessThanOrEqual(controls.x + controls.width);
          if (index) {
            expect(target.x).toBeGreaterThanOrEqual(targets[index - 1].x + targets[index - 1].width);
            expect(target.y).toBeCloseTo(targets[0].y, 0);
          }
        }
        const shortcut = player.getByRole('button', { name: 'Play lesson', exact: true });
        if (fullscreen) await expect(shortcut).toBeHidden();
        else await expect(shortcut).toBeVisible();
        await a11yCheckpoint(page, `compact ${fullscreen ? 'fullscreen' : 'inline'} bar`, {
          include: '#blood_groups-video .vn-controls, #blood_groups-video .vn-inline-play', feature: 'narration-ux',
        });
        await player.getByRole('button', { name: 'Player settings', exact: true }).click();
        const settings = player.getByRole('region', { name: 'Player settings', exact: true });
        const panel = await settings.boundingBox();
        const currentBar = await bar.boundingBox();
        expect(panel.y + panel.height).toBeLessThanOrEqual(currentBar.y);
        await settings.getByRole('button', { name: 'Close settings', exact: true }).click();
      }
      await player.getByRole('button', { name: 'Exit full screen', exact: true }).click();
      await expect(player.getByRole('button', { name: 'Play lesson', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  }
}

test('a shared timeline group offers both checks and closer looks by keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  const player = await open(page, loadLesson('layered_style'));
  const marker = player.getByRole('group', { name: 'Knowledge checks and closer looks', exact: true })
    .getByRole('button', { name: /^\d+ timeline stops:.*Knowledge check:.*Closer look:|^\d+ timeline stops:.*Closer look:.*Knowledge check:/ }).first();
  await marker.press('Space');
  const menu = player.getByRole('region', { name: 'Choose a knowledge check or closer look', exact: true });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('button', { name: /^Knowledge check:/ }).first()).toBeVisible();
  const look = menu.getByRole('button', { name: /^Closer look:/ }).first();
  await expect(look).toBeVisible();
  const title = (await look.getAttribute('aria-label')).replace(/^Closer look: /, '').replace(/, at \d+:\d+$/, '');
  await a11yCheckpoint(page, 'mixed timeline choices', { include: '#layered_style-video .vn-controls', feature: 'narration-ux' });
  await page.keyboard.press('Escape');
  await expect(marker).toBeFocused();
  await marker.press('Enter');
  await look.press('Space');
  await expect(player.getByRole('region', { name: title, exact: true })).toBeVisible();
  await expect(player.getByRole('button', { name: 'Play lesson', exact: true })).toBeHidden();
});

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
    await expect.poll(() => player.evaluate(element => element.contains(document.activeElement))).toBe(true);

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
  await expect(player.getByRole('status').filter({ hasText: 'Lesson complete.' })).toBeVisible();
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
  await player.getByRole('button', { name: 'Knowledge check', exact: true }).click();
  const check = player.getByRole('region', { name: /— Knowledge check$/ });
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
