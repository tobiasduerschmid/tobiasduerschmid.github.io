const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { loadLesson } = require('../scripts/narration/source');
const { openPlayerSettings, seekNarration, serveAudioRanges } = require('./helpers/narration-player');
const { a11yCheckpoint } = require('./a11y-helpers');

const pattern = loadLesson('strategy');
const timing = JSON.parse(readFileSync('_data/explainers/strategy_timing.json', 'utf8'));
const predictionScene = pattern.story.scenes.findIndex(scene => scene.cues.some(cue => cue.prediction));
const predictionCue = pattern.story.scenes[predictionScene].cues.findIndex(cue => cue.prediction);
const predictionTiming = timing.scenes[predictionScene].cues[predictionCue];
const prediction = pattern.story.scenes[predictionScene].cues[predictionCue];
const explanation = pattern.story.scenes[predictionScene].cues[predictionCue + 1];

// Exercise a text-only lesson and a shuffled multi-question check through the
// production Liquid includes, quiz renderer, and transport. The fixture's only
// variations are authorable data: no media and a two-question checkpoint.
const investigation = loadLesson('therac25');
const checkedScenes = investigation.story.scenes.filter(scene => scene.checkpoint);
const questions = checkedScenes.slice(0, 2).map(scene => scene.checkpoint);
const practice = checkedScenes[2].checkpoint;
investigation.story.audio = null;
investigation.story.scenes = checkedScenes.slice(0, 2).map(scene => ({ ...scene }));
delete investigation.story.scenes[1].checkpoint;
investigation.study = {
  version: 1,
  exercises: [{ id: 'controller', title: 'Console and controller', scene: checkedScenes[0].id, cue: checkedScenes[0].cues[0].id,
    type: 'class', prompt: 'Connect the console to the controller it uses.',
    starter: '@startuml\nclass Console\nclass Controller\n@enduml',
    solution: '@startuml\nclass Console\nclass Controller\nConsole --> Controller\n@enduml',
    checks: ['The console points to the controller.'] }],
  comparisons: [{ id: 'evidence', title: 'Compare evidence', question: 'What does each observation establish?',
    before: { scene: checkedScenes[0].id, cue: checkedScenes[0].cues[0].id, label: 'Initial report' },
    after: { scene: checkedScenes[1].id, cue: checkedScenes[1].cues[0].id, label: 'Configuration evidence' },
    consequences: ['Keep observed results separate from explanations of their cause.'] }],
  reviews: {
    [checkedScenes[0].id]: questions.map((_, index) => ({
      scene: checkedScenes[index].id, cue: checkedScenes[index].cues[0].id, retry: practice,
    })),
  },
};
let fixture;

test.beforeAll(() => {
  const data = {
    narration_lessons: { therac25: investigation },
    explainers: {
      therac25: investigation.story,
      therac25_quizzes: { [checkedScenes[0].id]: { questions, shuffle_questions: true } },
    },
  };
  fixture = execFileSync('bundle', ['exec', 'ruby', '-e', `
    require 'jekyll'
    require 'json'
    site = Jekyll::Site.new(Jekyll.configuration('quiet' => true, 'disable_disk_cache' => true))
    site.data = JSON.parse(STDIN.read)
    template = Liquid::Template.parse('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Prediction and review fixture</title>{% include ai-training-opt-out-meta.html %}</head><body><main><h1>Prediction and review fixture</h1>{% include narration.html topic="therac25" %}</main></body></html>')
    print template.render!({ 'site' => site.site_payload['site'] }, registers: { site: site })
  `], { cwd: path.resolve(__dirname, '..'), input: JSON.stringify(data), encoding: 'utf8' });
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // Randomness is a boundary: two questions shuffle into reverse order.
    Math.random = () => 0;
    document.addEventListener('play', event => {
      if (event.target instanceof HTMLMediaElement) event.target.muted = true;
    }, true);
  });
});

async function openPattern(page) {
  await serveAudioRanges(page, pattern.story.audio);
  await page.goto(pattern.lesson.chapter);
  const player = page.getByRole('region', { name: pattern.story.title, exact: true });
  await expect(player.getByRole('button', { name: 'Play narration', exact: true })).toBeVisible();
  return player;
}

async function setSpeed(player, speed) {
  await openPlayerSettings(player);
  await player.getByRole('combobox', { name: /speed/i }).selectOption(String(speed));
  await player.getByRole('button', { name: 'Close settings', exact: true }).click();
}

async function reachPrediction(player) {
  await seekNarration(player, predictionTiming.end - 0.45);
  await player.getByRole('button', { name: 'Play narration', exact: true }).click();
  await expect(player.getByRole('region', { name: 'Pause and predict', exact: true })).toBeVisible();
}

for (const speed of [1, 1.5]) {
  test(`prediction holds after its authored pause at ${speed}x until an intentional reveal`, async ({ page }) => {
    if (speed > 1) {
      await page.setViewportSize({ width: 320, height: 720 });
      await page.addInitScript(() => {
        Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false });
        Object.defineProperty(Document.prototype, 'webkitFullscreenEnabled', { get: () => false });
        Element.prototype.webkitRequestFullscreen = undefined;
      });
    }
    const player = await openPattern(page);
    await setSpeed(player, speed);
    if (speed > 1) {
      await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
      await player.getByRole('button', { name: 'Enter full screen', exact: true }).click();
    }
    await reachPrediction(player);
    await expect(player.getByRole('region', { name: 'Narration', exact: true })).toHaveText(prediction.text);
    await expect(player.locator('audio')).toHaveJSProperty('paused', true);
    await player.getByRole('button', { name: 'Play narration', exact: true }).click();
    await expect(player.getByRole('button', { name: 'Reveal explanation', exact: true })).toBeFocused();
    await expect(player.locator('audio')).toHaveJSProperty('paused', true);
    await a11yCheckpoint(page, `prediction hold at ${speed}x`, { include: '#strategy-animation', feature: 'narration-study' });
    if (speed > 1) {
      await player.getByRole('button', { name: 'Reveal explanation', exact: true }).press('Escape');
      await expect(player.getByRole('button', { name: 'Enter full screen', exact: true })).toBeVisible();
      await expect(player.locator('audio')).toHaveJSProperty('paused', true);
      await player.getByRole('button', { name: 'Enter full screen', exact: true }).click();
    }
    await player.getByRole('button', { name: 'Reveal explanation', exact: true }).press('Enter');
    await expect(player.getByRole('region', { name: 'Pause and predict', exact: true })).toBeHidden();
    await expect(player.getByRole('region', { name: 'Narration', exact: true })).toHaveText(explanation.text);
    await expect(player.getByRole('button', { name: 'Pause narration', exact: true })).toBeVisible();
  });
}

test('seeking away clears a hold, revisiting restores it, and opt-out permits continuous playback', async ({ page }) => {
  const player = await openPattern(page);
  await reachPrediction(player);
  await seekNarration(player, timing.scenes[predictionScene].cues[predictionCue + 1].start);
  await expect(player.getByRole('region', { name: 'Pause and predict', exact: true })).toBeHidden();
  await expect(player.getByRole('region', { name: 'Narration', exact: true })).toHaveText(explanation.text);
  await reachPrediction(player);
  await openPlayerSettings(player);
  await player.getByRole('checkbox', { name: 'Pause and predict', exact: true }).uncheck();
  await player.getByRole('button', { name: 'Close settings', exact: true }).click();
  await expect(player.getByRole('region', { name: 'Pause and predict', exact: true })).toBeHidden();
  await player.getByRole('button', { name: 'Play narration', exact: true }).click();
  await expect(player.getByRole('region', { name: 'Narration', exact: true })).toHaveText(explanation.text);
});

test('the last audio cue holds its prediction before opening the final check', async ({ page }) => {
  const lesson = loadLesson('therac25');
  const finalScene = lesson.story.scenes.at(-1);
  const finalTiming = JSON.parse(readFileSync('_data/explainers/therac25_timing.json', 'utf8')).scenes.at(-1);
  await serveAudioRanges(page, lesson.story.audio);
  await page.goto(lesson.lesson.chapter);
  const player = page.getByRole('region', { name: lesson.story.title, exact: true });
  await expect(player.getByRole('button', { name: 'Play narration', exact: true })).toBeVisible();
  await seekNarration(player, finalTiming.end - 0.45);
  await player.getByRole('button', { name: 'Play narration', exact: true }).click();
  await expect(player.getByRole('region', { name: 'Pause and predict', exact: true })).toBeVisible();
  await expect(player.getByRole('region', { name: 'Narration', exact: true })).toHaveText(finalScene.cues.at(-1).text);
  await expect(player.getByRole('region', { name: /— Knowledge check$/ })).toBeHidden();
  await player.getByRole('button', { name: 'Reveal explanation', exact: true }).click();
  await expect(player.getByRole('region', { name: /— Knowledge check$/ })).toBeVisible();
  await expect(player.locator('audio')).toHaveJSProperty('paused', true);
});

async function openInvestigation(page) {
  await page.route('**/__prediction_review_fixture__', route => route.fulfill({ contentType: 'text/html', body: fixture }));
  await page.goto('/__prediction_review_fixture__');
  return page.getByRole('region', { name: investigation.story.title, exact: true });
}

async function reachTextPrediction(player, scene = investigation.story.scenes[0]) {
  for (const cue of scene.cues.slice(1)) {
    await player.getByRole('button', { name: 'Next step', exact: true }).click();
    await expect(player.getByRole('region', { name: 'Narration', exact: true })).toHaveText(cue.text);
  }
}

test('a text-only final-cue prediction reveals its check before continuing', async ({ page }) => {
  const player = await openInvestigation(page);
  await reachTextPrediction(player);
  await expect(player.getByRole('region', { name: 'Pause and predict', exact: true })).toBeVisible();
  await expect(player.getByRole('button', { name: 'Knowledge check', exact: true })).toBeDisabled();
  await player.getByRole('button', { name: 'Reveal explanation', exact: true }).press('Space');
  await expect(player.getByRole('region', { name: /— Summary quiz$/ })).toBeVisible();
  await expect(player.locator('audio')).toHaveCount(0);
  await expect(player.getByRole('region', { name: 'Pause and predict', exact: true })).toBeHidden();
});

test('silent stepping through an audio lesson stays silent after prediction and check', async ({ page }) => {
  const lesson = loadLesson('therac25');
  const sceneIndex = lesson.story.scenes.findIndex(scene => scene.checkpoint);
  await page.goto(lesson.lesson.chapter);
  const player = page.getByRole('region', { name: lesson.story.title, exact: true });
  await openPlayerSettings(player);
  await player.getByRole('combobox', { name: 'Review a scene', exact: true }).selectOption(String(sceneIndex));
  await player.getByRole('button', { name: 'Close settings', exact: true }).click();
  await reachTextPrediction(player, lesson.story.scenes[sceneIndex]);
  await player.getByRole('button', { name: 'Reveal explanation', exact: true }).click();
  await player.getByRole('button', { name: 'Skip Knowledge Check', exact: true }).click();
  await expect(player.getByRole('region', { name: 'Narration', exact: true })).toHaveText(lesson.story.scenes[sceneIndex + 1].cues[0].text);
  await expect(player.locator('audio')).toHaveJSProperty('paused', true);
  await expect(player.getByRole('button', { name: 'Play narration', exact: true })).toBeVisible();
});

async function answer(check, question, correct) {
  const index = correct ? question.correct_index : question.options.findIndex((_, index) => index !== question.correct_index);
  const option = check.getByRole('radio').filter({ hasText: question.options[index] });
  await option.click();
  await expect(option).toBeChecked();
  await expect(check.getByText(question.explanation, { exact: true })).toBeVisible();
  return option;
}

test('shuffled question review returns to its own answer and fresh practice preserves the original score', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const player = await openInvestigation(page);
  await reachTextPrediction(player);
  await player.getByRole('button', { name: 'Reveal explanation', exact: true }).click();
  const check = player.getByRole('region', { name: /— (Summary quiz|Similar question)$/ });
  const selected = await answer(check, questions[1], false);
  await check.getByRole('button', { name: 'Review this explanation', exact: true }).click();
  await expect(check).toBeHidden();
  await expect(player.getByRole('region', { name: 'Narration', exact: true })).toHaveText(checkedScenes[1].cues[0].text);
  await a11yCheckpoint(page, 'question-specific explanation', { include: '#therac25-case-study', feature: 'narration-study' });
  await player.getByRole('button', { name: 'Return to question', exact: true }).press('Space');
  await expect(check.getByText(questions[1].explanation, { exact: true })).toBeVisible();
  await expect(selected).toBeChecked();
  await expect(selected).toBeDisabled();
  await expect(check.getByRole('button', { name: 'Review this explanation', exact: true })).toBeFocused();

  await check.getByRole('button', { name: 'Try a similar question', exact: true }).click();
  await answer(check, practice, true);
  await expect(check.getByRole('status')).toContainText('original answer and score are unchanged');
  await a11yCheckpoint(page, 'separate practice feedback', { include: '#therac25-case-study', feature: 'narration-study' });
  await check.getByRole('button', { name: 'Return to question', exact: true }).click();
  await expect(selected).toBeChecked();
  await check.getByRole('button', { name: 'Try a similar question', exact: true }).click();
  await expect(check.getByRole('radio').filter({ hasText: practice.options[practice.correct_index] })).toBeEnabled();
  await expect(check.getByText(practice.explanation, { exact: true })).toBeHidden();
  await check.getByRole('button', { name: 'Leave practice', exact: true }).click();
  await check.getByRole('button', { name: 'Next Question', exact: true }).click();
  await answer(check, questions[0], true);
  await check.getByRole('button', { name: 'See Results', exact: true }).click();
  await expect(check.getByText(/^Your Score:\s*1\s*\/\s*2$/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('the reader conceals a prediction answer until its native disclosure opens', async ({ page }) => {
  await page.goto(`${pattern.lesson.views}/read/`);
  const summary = page.getByText(`Reveal step ${predictionScene + 1}.${predictionCue + 2} and explanation`, { exact: true });
  await expect(page.getByText(explanation.text, { exact: true })).toBeHidden();
  await expect(page.getByText(pattern.story.scenes[predictionScene].takeaway, { exact: true })).toBeHidden();
  await summary.press('Enter');
  await expect(page.getByText(explanation.text, { exact: true })).toBeVisible();
  await expect(page.getByText(pattern.story.scenes[predictionScene].takeaway, { exact: true })).toBeVisible();
});
