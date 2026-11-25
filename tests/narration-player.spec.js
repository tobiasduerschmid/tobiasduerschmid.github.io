const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { loadLesson } = require('../scripts/narration/source');

// Exercise authored combinations not yet present in the book: a case study
// awaiting speech and an illustrated explainer with a knowledge check. Render
// the real Liquid includes; no player, quiz, renderer, or audio code is replaced.
const investigation = loadLesson('therac25');
investigation.story.audio = null;
const firstCheck = investigation.story.scenes.findIndex(scene => scene.checkpoint);
investigation.story.scenes = investigation.story.scenes.slice(firstCheck, firstCheck + 2);
delete investigation.story.scenes[1].checkpoint;
const explainer = loadLesson('nodejs');
const question = {
  id: 'runtime', type: 'single', question: 'Where can the Node.js runtime execute JavaScript?',
  options: ['Outside the browser', 'Only inside a browser tab'], correct_index: 0,
  explanation: 'Node.js executes JavaScript outside the browser.',
};
let fixture;
let errors;

test.beforeAll(() => {
  const data = {
    narration_lessons: { therac25: investigation, nodejs: explainer },
    explainers: {
      therac25: investigation.story, nodejs: explainer.story,
      nodejs_timing: JSON.parse(readFileSync(path.join(__dirname, '../_data/explainers/nodejs_timing.json'), 'utf8')),
      nodejs_quizzes: { [explainer.story.scenes[0].id]: { questions: [question] } },
    },
  };
  fixture = execFileSync('bundle', ['exec', 'ruby', '-e', `
    require 'jekyll'
    require 'json'
    site = Jekyll::Site.new(Jekyll.configuration('quiet' => true, 'disable_disk_cache' => true))
    site.data = JSON.parse(STDIN.read)
    template = Liquid::Template.parse('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Narration fixture</title>{% include ai-training-opt-out-meta.html %}</head><body><main><h1>Narration fixture</h1>{% include narration.html topic="therac25" %}{% include narration.html topic="nodejs" %}</main></body></html>')
    print template.render!({ 'site' => site.site_payload['site'] }, registers: { site: site })
  `], { cwd: path.resolve(__dirname, '..'), input: JSON.stringify(data), encoding: 'utf8' });
});

test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    document.addEventListener('play', event => {
      if (event.target instanceof HTMLMediaElement) event.target.muted = true;
    }, true);
  });
  // This test-only document uses the preview server's real CSS, JS, and media.
  await page.route('**/__narration_fixture__', route => route.fulfill({
    contentType: 'text/html', body: fixture,
  }));
  await page.goto('/__narration_fixture__');
});
test.afterEach(() => { expect(errors).toEqual([]); });

const textPlayer = page => page.getByRole('region', { name: investigation.story.title, exact: true });
const audioPlayer = page => page.getByRole('region', { name: explainer.story.title, exact: true });
const checkPanel = player => player.getByRole('region', { name: /— Knowledge check$/ });

async function finishSteps(player, scene) {
  for (const cue of scene.cues.slice(1)) {
    await player.getByRole('button', { name: 'Next step', exact: true }).click();
    await expect(player.getByRole('region', { name: 'Narration', exact: true })).toHaveText(cue.text);
  }
}

test('a text-only lesson retains feedback on review and continues through its final scene', async ({ page }) => {
  const player = textPlayer(page);
  const [scene, finalScene] = investigation.story.scenes;
  await expect(player.getByRole('button', { name: 'Next step', exact: true })).toBeVisible();
  await expect(player.locator('audio')).toHaveCount(0);
  await expect(player.getByRole('button', { name: 'Play narration', exact: true })).toHaveCount(0);
  await finishSteps(player, scene);
  await player.getByRole('button', { name: 'Knowledge check', exact: true }).click();
  const check = checkPanel(player);
  const wrongIndex = scene.checkpoint.options.findIndex((_, index) => index !== scene.checkpoint.correct_index);
  await check.getByRole('radio').filter({ hasText: scene.checkpoint.options[wrongIndex] }).click();
  await expect(check.getByText(scene.checkpoint.explanation, { exact: true })).toBeVisible();
  await expect(check.getByRole('button', { name: 'Re-listen to segment' })).toHaveCount(0);
  await check.getByRole('button', { name: 'Review this scene' }).click();
  await expect(player.getByRole('region', { name: 'Narration', exact: true })).toHaveText(scene.cues.at(-1).text);
  await player.getByRole('button', { name: 'Knowledge check', exact: true }).click();
  await expect(check.getByText(scene.checkpoint.explanation, { exact: true })).toBeVisible();
  await check.getByRole('button', { name: 'Continue lesson', exact: true }).click();
  await expect(check).toBeHidden();
  await expect(player.getByRole('region', { name: 'Narration', exact: true })).toHaveText(finalScene.cues[0].text);
  await finishSteps(player, finalScene);
  await player.getByRole('button', { name: 'Finish review', exact: true }).click();
  await expect(player.getByRole('status').filter({ hasText: 'Lesson complete.' })).toBeVisible();
  await expect(player.getByRole('button', { name: 'Player settings', exact: true })).toBeFocused();
});

test('an illustrated explainer can replay a wrong check without changing another player', async ({ page }) => {
  const player = audioPlayer(page);
  const other = textPlayer(page);
  await finishSteps(other, investigation.story.scenes[0]);
  await other.getByRole('button', { name: 'Knowledge check', exact: true }).click();
  await player.getByRole('button', { name: `Knowledge check: ${explainer.story.scenes[0].label}`, exact: true }).click();
  const check = checkPanel(player);
  await check.getByRole('radio').filter({ hasText: question.options[1] }).click();
  await expect(check.getByText(question.explanation, { exact: true })).toBeVisible();
  await check.getByRole('button', { name: 'Re-listen to segment', exact: true }).click();
  await expect(check).toBeHidden();
  await expect(player.getByRole('button', { name: 'Pause narration', exact: true })).toBeVisible();
  await expect(player.getByRole('region', { name: 'Narration', exact: true })).toHaveText(explainer.story.scenes[0].cues[0].text);
  await expect(checkPanel(other)).toBeVisible();
  await expect(checkPanel(other).getByRole('radio').first()).toBeEnabled();
  await player.getByRole('button', { name: 'Pause narration', exact: true }).click();
  await player.getByRole('button', { name: `Knowledge check: ${explainer.story.scenes[0].label}`, exact: true }).click();
  await expect(check.getByText(question.explanation, { exact: true })).toBeVisible();
  await check.getByRole('button', { name: 'Continue narration', exact: true }).click();
  await expect(player.getByRole('region', { name: 'Narration', exact: true })).toHaveText(explainer.story.scenes[1].cues[0].text);
  await expect(checkPanel(other)).toBeVisible();
});
