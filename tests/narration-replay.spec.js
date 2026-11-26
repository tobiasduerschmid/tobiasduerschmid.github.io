const { test, expect } = require('@playwright/test');
const { readFileSync, existsSync } = require('node:fs');
const yaml = require('js-yaml');
const { lessonIds, loadLesson } = require('../scripts/narration/source');
const { openPlayerSettings } = require('./helpers/narration-player');
const { a11yCheckpoint } = require('./a11y-helpers');

const lessons = lessonIds().map(topic => {
  const lesson = loadLesson(topic);
  const file = `_data/explainers/${topic}_quizzes.yml`;
  const quizzes = lesson.kind === 'case-study'
    ? Object.fromEntries(lesson.story.scenes.filter(scene => scene.checkpoint).map(scene => [scene.id, scene.checkpoint]))
    : existsSync(file) ? yaml.load(readFileSync(file, 'utf8')) : {};
  const checks = lesson.story.scenes.flatMap((scene, index) => quizzes[scene.id] ? [index] : []);
  return { topic, ...lesson, quizzes, checks };
}).filter(lesson => lesson.story.audio && lesson.checks.length);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener('play', event => {
      if (event.target instanceof HTMLMediaElement) event.target.muted = true;
    }, true);
  });
  // WEBrick otherwise sometimes answers conditional MP3 range requests with 304.
  await page.route('**/assets/audio/**', route => {
    const headers = { ...route.request().headers() };
    if (headers.range) { delete headers['if-none-match']; delete headers['if-modified-since']; }
    return route.continue({ headers });
  });
});

async function open(page, lesson) {
  await page.goto(lesson.lesson.chapter);
  const player = page.getByRole('region', { name: lesson.story.title, exact: true });
  await expect(player.getByRole('button', { name: 'Play narration', exact: true })).toBeVisible();
  return player;
}

async function openCheck(player, lesson, index) {
  await openPlayerSettings(player);
  await player.getByRole('combobox', { name: /^(Scene|Review a scene)$/ }).selectOption(String(index));
  if (lesson.kind === 'case-study') {
    await player.getByRole('button', { name: 'Close settings', exact: true }).click();
    for (const cue of lesson.story.scenes[index].cues.slice(1)) {
      await player.getByRole('button', { name: 'Next step', exact: true }).click();
    }
    const lastCue = lesson.story.scenes[index].cues.at(-1);
    await player.getByRole('button', { name: lastCue.prediction ? 'Reveal explanation' : 'Knowledge check', exact: true }).click();
  } else await player.getByRole('button', { name: 'Knowledge check', exact: true }).click();
  return player.getByRole('region', { name: /— (Knowledge check|Summary quiz)$/ });
}

async function answer(check, question, correct) {
  const index = correct ? question.correct_index : question.options.findIndex((_, index) => index !== question.correct_index);
  await check.getByRole('radio').filter({ hasText: question.options[index] }).click();
  await expect(check.getByText(question.explanation, { exact: true })).toBeVisible();
}

async function expectReplaying(player, lesson, startIndex) {
  const timing = JSON.parse(readFileSync(`_data/explainers/${lesson.topic}_timing.json`, 'utf8'));
  const start = timing.scenes[startIndex].start;
  await expect(player.getByRole('button', { name: 'Pause narration', exact: true })).toBeVisible();
  await expect(player.getByRole('heading', { name: lesson.story.scenes[startIndex].title, exact: true })).toBeVisible();
  await expect.poll(() => player.locator('audio').evaluate(audio => audio.currentTime))
    .toBeGreaterThanOrEqual(start);
  expect(await player.locator('audio').evaluate(audio => audio.currentTime)).toBeLessThan(start + 2);
}

async function finishPlaybackScene(player, lesson, timing, sceneIndex) {
  const scene = lesson.story.scenes[sceneIndex];
  for (const [cueIndex, cue] of scene.cues.entries()) {
    if (!cue.prediction) continue;
    await player.locator('audio').evaluate((audio, end) => { audio.currentTime = end - 0.04; }, timing.scenes[sceneIndex].cues[cueIndex].end);
    await player.getByRole('button', { name: 'Reveal explanation', exact: true }).click();
  }
  if (!scene.cues.at(-1).prediction) {
    await player.locator('audio').evaluate((audio, end) => { audio.currentTime = end - 0.04; }, timing.scenes[sceneIndex].end);
  }
}

for (const lesson of lessons) {
  test(`${lesson.topic}: a wrong first check can replay from the beginning`, async ({ page }) => {
    const player = await open(page, lesson);
    const index = lesson.checks[0];
    const question = lesson.quizzes[lesson.story.scenes[index].id];
    const check = await openCheck(player, lesson, index);
    const replay = check.getByRole('button', { name: 'Re-listen to segment', exact: true });
    await expect(replay).toBeHidden();
    await answer(check, question, false);
    await expect(replay).toBeVisible();
    await replay.press('Enter');
    await expect(check).toBeHidden();
    await expectReplaying(player, lesson, 0);
    await expect(player.getByRole('button', { name: 'Pause narration', exact: true })).toBeFocused();
  });
}

for (const { topic, fallback, mobile } of [
  { topic: 'scrum', fallback: false, mobile: false },
  { topic: 'huggingface2026', fallback: true, mobile: true },
]) {
  test(`${topic}: replay starts after the previous check and returns to retained feedback in fullscreen`, async ({ page }) => {
    if (fallback) await page.addInitScript(() => {
      Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false });
      Object.defineProperty(Document.prototype, 'webkitFullscreenEnabled', { get: () => false });
      Element.prototype.webkitRequestFullscreen = undefined;
    });
    if (mobile) await page.setViewportSize({ width: 320, height: 720 });
    const lesson = lessons.find(lesson => lesson.topic === topic);
    // The final security check follows an unchecked scene; replay must include it.
    const index = topic === 'scrum' ? lesson.checks[1] : lesson.checks.at(-1);
    const previous = lesson.checks.filter(checkIndex => checkIndex < index).at(-1);
    const player = await open(page, lesson);
    if (mobile) await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
    await player.getByRole('button', { name: 'Enter full screen', exact: true }).click();
    const check = await openCheck(player, lesson, index);
    const question = lesson.quizzes[lesson.story.scenes[index].id];
    await answer(check, question, false);
    await a11yCheckpoint(page, `${topic} replay action`, { include: `#${await player.getAttribute('id')}`, feature: 'narration-replay' });
    await check.getByRole('button', { name: 'Re-listen to segment', exact: true }).press('Space');
    await expect(check).toBeHidden();
    await expectReplaying(player, lesson, previous + 1);
    const video = player.locator('[data-vn-video]');
    await expect(video).toBeFocused();
    if (fallback) await expect(video).toHaveClass(/is-viewport-fullscreen/);
    else expect(await video.evaluate(video => document.fullscreenElement === video)).toBe(true);
    // Advance the real media clock to the segment boundary, without waiting for
    // minutes of speech; the production boundary handler must reopen the check.
    const timing = JSON.parse(readFileSync(`_data/explainers/${topic}_timing.json`, 'utf8'));
    for (let scene = previous + 1; scene <= index; scene++) {
      await finishPlaybackScene(player, lesson, timing, scene);
      if (scene < index) {
        await expect(player.getByRole('heading', { name: lesson.story.scenes[scene + 1].title, exact: true })).toBeVisible();
        await expect(player.getByRole('button', { name: 'Pause narration', exact: true })).toBeVisible();
      }
    }
    await expect(check).toBeVisible();
    await expect(check.getByText(question.explanation, { exact: true })).toBeVisible();
    await expect(check.getByRole('button', { name: 'Re-listen to segment', exact: true })).toBeVisible();
    await expect(player.locator('audio')).toHaveJSProperty('paused', true);
  });
}

for (const { mistakes, name } of [
  { mistakes: 1, name: 'a passing summary retains progress and still offers replay for its mistake' },
  { mistakes: 2, name: 'a failed summary retains progress and clears replay after a correct retry' },
]) {
  test(name, async ({ page }) => {
    const lesson = lessons.find(lesson => lesson.topic === 'strategy');
    const index = lesson.checks.at(-1);
    const questions = lesson.quizzes[lesson.story.scenes[index].id].questions;
    const player = await open(page, lesson);
    let check = await openCheck(player, lesson, index);
    const replay = () => check.getByRole('button', { name: 'Re-listen to segment', exact: true });
    await answer(check, questions[0], true);
    await expect(replay()).toBeHidden();
    await check.getByRole('button', { name: 'Next Question', exact: true }).click();
    await answer(check, questions[1], false);
    await replay().click();
    await expectReplaying(player, lesson, index);
    check = await openCheck(player, lesson, index);
    await expect(check.getByText(questions[1].explanation, { exact: true })).toBeVisible();
    await check.getByRole('button', { name: 'Next Question', exact: true }).click();
    for (const [offset, question] of questions.slice(2).entries()) {
      const correct = mistakes === 1 || offset > 0;
      await answer(check, question, correct);
      if (correct) await expect(replay()).toBeHidden();
      else await expect(replay()).toBeVisible();
      await check.getByRole('button', { name: offset + 3 < questions.length ? 'Next Question' : 'See Results', exact: true }).click();
    }
    await expect(check.getByText('Knowledge Check Complete!', { exact: true })).toBeVisible();
    await expect(replay()).toBeVisible();
    await a11yCheckpoint(page, `summary replay after ${mistakes} mistakes`, { include: '#strategy-animation', feature: 'narration-replay' });
    if (mistakes === 1) {
      await expect(check.getByText('Knowledge check passed. You can continue when you are ready.', { exact: true })).toBeVisible();
      await replay().press('Enter');
      await expectReplaying(player, lesson, index);
      return;
    }
    await check.getByRole('button', { name: 'Try Again', exact: true }).click();
    for (const [index, question] of questions.entries()) {
      await expect(replay()).toBeHidden();
      await answer(check, question, true);
      await expect(replay()).toBeHidden();
      await check.getByRole('button', { name: index + 1 < questions.length ? 'Next Question' : 'See Results', exact: true }).click();
    }
    await expect(replay()).toBeHidden();
  });
}
