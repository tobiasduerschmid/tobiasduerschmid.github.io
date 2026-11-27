const { test, expect } = require('@playwright/test');
const { readFileSync } = require('node:fs');
const yaml = require('js-yaml');
const { loadLesson } = require('../scripts/narration/source');
const { openPlayerSettings, seekNarration, serveAudioRanges } = require('./helpers/narration-player');
const { a11yCheckpoint } = require('./a11y-helpers');

const option = 'Only pause for the final knowledge check';
const lessons = ['scrum', 'strategy', 'therac25'].map(topic => {
  const lesson = loadLesson(topic);
  const quizzes = lesson.kind === 'case-study' ? {} : yaml.load(readFileSync(`_data/explainers/${topic}_quizzes.yml`, 'utf8'));
  return {
    topic, ...lesson,
    timing: JSON.parse(readFileSync(`_data/explainers/${topic}_timing.json`, 'utf8')),
    checks: lesson.story.scenes.flatMap((scene, index) => quizzes[scene.id] || scene.checkpoint ? [index] : []),
  };
});

async function open(page, lesson) {
  await serveAudioRanges(page, lesson.story.audio);
  await page.goto(lesson.lesson.chapter);
  const player = page.getByRole('region', { name: lesson.story.title, exact: true });
  await player.getByRole('button', { name: 'Mute narration', exact: true }).click();
  await openPlayerSettings(player);
  await player.getByRole('checkbox', { name: option, exact: true }).check();
  // Prediction pauses are a separate choice; isolate the knowledge checks.
  await player.getByRole('checkbox', { name: 'Pause and predict', exact: true }).uncheck();
  await player.getByRole('combobox', { name: /^(Narration speed|Speed)$/ }).selectOption('2');
  await player.getByRole('button', { name: 'Close settings', exact: true }).click();
  return player;
}

async function playEnd(player, lesson, index) {
  await seekNarration(player, lesson.timing.scenes[index].end - 0.3);
  await player.getByRole('button', { name: 'Play narration', exact: true }).click();
}

for (const lesson of lessons) {
  test(`${lesson.kind}: encountering a completed or skipped check again starts unanswered`, async ({ page }) => {
    await page.addInitScript(() => document.addEventListener('play', event => {
      if (event.target instanceof HTMLMediaElement) event.target.muted = true;
    }, true));
    const player = await open(page, lesson);
    const check = player.locator('.narration-check');
    const finalIndex = lesson.checks.at(-1);
    for (let visit = 0; visit < 3; visit++) {
      await playEnd(player, lesson, finalIndex);
      await expect(check).toBeVisible();
      await expect(check.getByRole('radio', { checked: true })).toHaveCount(0);
      await expect(check.getByRole('radio').first()).toBeEnabled();
      await expect(check.locator('.quiz-question-card.active')).toHaveAttribute('data-question-index', '0');
      await expect(check.locator('.quiz-results')).toBeHidden();
      await expect(check.locator('.current-score')).toHaveText('0');
      if (visit === 0) {
        const count = await check.locator('.quiz-question-card').count();
        for (let question = 0; question < count; question++) {
          await check.getByRole('radio').first().click();
          await check.locator('.next-btn:visible').click();
        }
        if (count > 1) {
          await expect(check.locator('.quiz-results')).toBeVisible();
          await check.locator('.tvm-quiz-continue-btn').click();
        }
      } else {
        if (visit === 2) await check.getByRole('radio').first().click();
        await check.getByRole('button', { name: 'Skip Knowledge Check', exact: true }).click();
      }
      await expect(check).toBeHidden();
      const song = player.locator('iframe.vn-song-frame');
      if (await song.isVisible()) {
        await song.contentFrame().getByRole('button', { name: 'Previous song', exact: true }).click();
      }
    }
  });

  test(`${lesson.kind}: skips segment checks, keeps the final check, and can restore all checks`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const player = await open(page, lesson);
    // The persistent panel exists before its accessible heading is populated.
    const check = player.locator('.narration-check');
    for (const index of [lesson.checks[0], lesson.checks.at(-2)]) {
      await playEnd(player, lesson, index);
      await expect(player.getByRole('heading', { name: lesson.story.scenes[index + 1].title, exact: true })).toBeVisible();
      await expect(check).toBeHidden();
      await expect(player.getByRole('button', { name: 'Pause narration', exact: true })).toBeVisible();
      await player.getByRole('button', { name: 'Pause narration', exact: true }).click();
    }

    // Explicit review still works when automatic segment checks are skipped.
    const firstLabel = lesson.story.scenes[lesson.checks[0]].label;
    const marker = player.getByRole('group', { name: 'Knowledge checks and closer looks', exact: true })
      .getByRole('button', { name: new RegExp(firstLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) });
    const grouped = await marker.getAttribute('aria-expanded') !== null;
    await marker.click();
    if (grouped) {
      await player.getByRole('region', { name: /^Choose a knowledge check/ })
        .getByRole('button', { name: `Knowledge check: ${firstLabel}`, exact: true }).click();
    }
    await expect(check).toBeVisible();
    await expect(check.getByRole('heading', { level: 3 })).toContainText(firstLabel);
    await check.getByRole('button', { name: 'Skip Knowledge Check', exact: true }).click();
    await player.getByRole('button', { name: 'Pause narration', exact: true }).click();

    const finalIndex = lesson.checks.at(-1);
    await playEnd(player, lesson, finalIndex);
    await expect(check).toBeVisible();
    await expect(check.getByRole('heading', { level: 3 })).toContainText(lesson.story.scenes[finalIndex].label);
    await expect(player.locator('audio')).toHaveJSProperty('paused', true);
    await page.reload();
    await expect(player.getByRole('button', { name: 'Unmute narration', exact: true })).toBeVisible();
    await openPlayerSettings(player);
    await expect(player.getByRole('checkbox', { name: option, exact: true })).toBeChecked();
    await player.getByRole('checkbox', { name: option, exact: true }).uncheck();
    await player.getByRole('checkbox', { name: 'Pause and predict', exact: true }).uncheck();
    await a11yCheckpoint(page, `${lesson.kind} knowledge-check preference`, { include: `#${await player.getAttribute('id')}`, feature: 'narration-preferences' });
    await player.getByRole('button', { name: 'Close settings', exact: true }).click();
    await playEnd(player, lesson, lesson.checks[0]);
    await expect(check).toBeVisible();
    await expect(check.getByRole('heading', { level: 3 })).toContainText(lesson.story.scenes[lesson.checks[0]].label);
    expect(errors).toEqual([]);
  });
}

test('case-study step navigation also skips intermediate checks and keeps the last one', async ({ page }) => {
  const lesson = lessons.find(item => item.kind === 'case-study');
  const player = await open(page, lesson);
  for (const index of [lesson.checks[0], lesson.checks.at(-1)]) {
    await openPlayerSettings(player);
    await player.getByRole('combobox', { name: 'Review a scene', exact: true }).selectOption(String(index));
    await player.getByRole('button', { name: 'Close settings', exact: true }).click();
    for (const cue of lesson.story.scenes[index].cues.slice(1)) {
      await player.getByRole('button', { name: 'Next step', exact: true }).click();
      await expect(player.getByRole('region', { name: 'Narration', exact: true })).toHaveText(cue.text);
    }
    const final = index === lesson.checks.at(-1);
    const step = player.locator('[data-narration-action="next-step"]');
    await expect(step).toHaveText(final ? 'Knowledge check' : 'Next scene');
    await step.click();
    if (final) await expect(player.locator('.narration-check')).toBeVisible();
    else {
      await expect(player.locator('.narration-check')).toBeHidden();
      await expect(player.getByRole('heading', { name: lesson.story.scenes[index + 1].title, exact: true })).toBeVisible();
    }
    await expect(player.locator('audio')).toHaveJSProperty('paused', true);
  }
});
