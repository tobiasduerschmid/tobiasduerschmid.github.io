const { loadStory, loadRegistry } = require('../scripts/narration/source');
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');
const { readFileSync } = require('node:fs');
const yaml = require('js-yaml');

const story = loadStory('uml_component_diagram');
const lesson = loadRegistry('pattern')['uml_component_diagram'];
const quizzes = yaml.load(readFileSync(require.resolve('../_data/explainers/uml_component_diagram_quizzes.yml'), 'utf8'));
const timing = require('../_data/explainers/uml_component_diagram_timing.json');
const url = '/SEBook/uml_component_diagram.html';
const player = page => page.getByRole('region', { name: story.title, exact: true });
const sceneIndex = id => story.scenes.findIndex(scene => scene.id === id);
const questionsOf = id => quizzes[id].questions || [quizzes[id]];
const cueStart = (sceneId, cue) => timing.scenes[sceneIndex(sceneId)].cues[cue].start;
const callouts = source => [...source.matchAll(/^callout .* : (.+)$/gm)].map(match => match[1]);

async function seek(page, time) {
  const animation = player(page);
  await animation.getByRole('slider', { name: 'Animation position' }).fill(String(Number(time.toFixed(2))));
  await expect.poll(() => animation.locator('audio').evaluate(audio => audio.currentTime)).toBeCloseTo(time, 1);
}
async function theme(page, dark) {
  const toggle = page.getByRole('checkbox', { name: 'Toggle dark mode' });
  if (await toggle.isChecked() !== dark) await toggle.press('Space');
}

// WEBrick may answer a conditional MP3 range request with 304 instead of the
// bytes Chromium needs after seeking; drop validators from range requests.
async function serveAudioRanges(page) {
  await page.route('**/assets/audio/uml-component-diagram.mp3', route => {
    const headers = { ...route.request().headers() };
    if (headers.range) {
      delete headers['if-none-match'];
      delete headers['if-modified-since'];
    }
    return route.continue({ headers });
  });
}

test('a lesson without code offers no language choice and names its own parts', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  const animation = player(page);
  await expect(animation.getByRole('combobox', { name: 'Code language' })).toHaveCount(0);
  for (const [index, scene] of story.scenes.entries()) {
    await seek(page, timing.scenes[index].start + 0.5);
    const parts = animation.locator('.nja-scene:visible').getByRole('list', { name: lesson.parts_label, exact: true });
    await expect(parts.getByRole('listitem')).toHaveText(lesson.parts);
    await expect(parts.locator('[aria-current="step"]')).toHaveText(scene.part ? [scene.part] : []);
  }
  expect(errors).toEqual([]);
});

test('each cue shows its diagram, highlights the component it names, and points at the notation it explains', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(url);
  const animation = player(page);
  for (const [index, scene] of story.scenes.entries()) {
    if (!scene.diagram) continue;
    for (const [cueIndex, cue] of scene.cues.entries()) {
      await seek(page, timing.scenes[index].cues[cueIndex].start + 0.5);
      const source = story.diagrams[cue.diagram || scene.diagram];
      const diagram = animation.getByRole('region', { name: source.label, exact: true });
      await expect(diagram.locator('svg')).toBeVisible();
      for (const text of callouts(source.source)) {
        await expect(diagram.locator('.uml-callout').filter({ hasText: text })).toBeVisible();
      }
      if (cue.diagram_focus) {
        const label = diagram.locator('svg text').filter({ hasText: new RegExp(`^${cue.diagram_focus}$`) }).first();
        await expect(label).toBeVisible();
        // The texture must cover the discussed component's name, not just exist elsewhere.
        expect(await label.evaluate(node => {
          const box = node.getBBox();
          const x = box.x + box.width / 2, y = box.y + box.height / 2;
          return [...node.closest('svg').querySelectorAll('[fill^="url("]')].some(shape => {
            const area = shape.getBBox();
            return x >= area.x && x <= area.x + area.width && y >= area.y && y <= area.y + area.height;
          });
        }), `${scene.id}/${cue.id}: ${cue.diagram_focus} is highlighted`).toBe(true);
      } else {
        await expect(diagram.locator('svg [fill^="url("]')).toHaveCount(0);
      }
    }
  }
});

test('narration stops inside the silence before each check and resumes only when asked', async ({ page }) => {
  test.setTimeout(180000);
  await serveAudioRanges(page);
  // Record where playback first stops; the player then re-pauses after moving
  // to the end of the finished section, which must not overwrite it.
  await page.addInitScript(() => {
    const pause = HTMLMediaElement.prototype.pause;
    HTMLMediaElement.prototype.pause = function recordPause() {
      if (window.pausedAt === null) window.pausedAt = this.currentTime;
      return pause.call(this);
    };
  });
  await page.goto(url);
  const animation = player(page);
  for (const [index, scene] of story.scenes.entries()) {
    const end = timing.scenes[index].end;
    await seek(page, end - 0.9);
    await page.evaluate(() => { window.pausedAt = null; });
    await animation.getByRole('button', { name: 'Play narration' }).click();
    const questions = questionsOf(scene.id);
    const kind = questions.length > 1 ? 'Summary quiz' : 'Knowledge check';
    const quiz = animation.getByRole('region', { name: `${index + 1}. ${scene.label} — ${kind}`, exact: true });
    await expect(quiz).toBeVisible();
    expect(await page.evaluate(() => window.pausedAt), `${scene.id}: stops before the next section's speech`).toBeLessThan(end - 0.1);
    expect(await animation.locator('audio').evaluate(audio => audio.paused)).toBe(true);
    for (const question of questions) {
      await expect(quiz.getByText(question.question, { exact: true })).toBeVisible();
      await quiz.getByRole('radio').filter({ hasText: question.options[question.correct_index] }).click();
      await expect(quiz.getByText(question.explanation, { exact: true })).toBeVisible();
      if (question !== questions.at(-1)) await quiz.getByRole('button', { name: /^Next/ }).click();
    }
    await quiz.getByRole('button', { name: 'See Results' }).click();
    await quiz.getByRole('button', { name: index + 1 < story.scenes.length ? 'Continue narration' : 'Finish review' }).click();
    await expect(quiz).toBeHidden();
    if (index + 1 < story.scenes.length) {
      await animation.getByRole('button', { name: 'Pause narration' }).click();
      await expect(animation.getByRole('button', { name: 'Play narration' })).toBeEnabled();
      await expect(animation.getByRole('heading', { name: story.scenes[index + 1].title, exact: true })).toBeVisible();
    }
  }
});

// These checkpoints audit the player's states: a sketch, a folder tree, callouts,
// highlights, cards, and the widest diagram.
for (const dark of [false, true]) {
  test(`player and quiz are readable and accessible in ${dark ? 'dark' : 'light'} mode, including mobile`, async ({ page }, testInfo) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1500, height: 1000 });
    await page.goto(url);
    await theme(page, dark);
    const animation = player(page);
    for (const [id, cue] of [['intro', 1], ['runtime_view', 2], ['interfaces', 1], ['ports', 0], ['trace', 2], ['when_to_use', 0]]) {
      await seek(page, cueStart(id, cue) + 0.5);
      await a11yCheckpoint(page, `${id} ${dark ? 'dark' : 'light'}`, { include: '#uml_component_diagram-animation .nja-player', feature: 'uml-component-diagram-narration' });
      await animation.locator('.nja-player').screenshot({ path: testInfo.outputPath(`${id}.png`) });
    }
    await page.setViewportSize({ width: 320, height: 850 });
    for (const id of ['interfaces', 'trace']) {
      await seek(page, cueStart(id, 0) + 0.5);
      await expect.poll(() => animation.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      await a11yCheckpoint(page, `mobile ${id}`, { include: '#uml_component_diagram-animation .nja-player', feature: 'uml-component-diagram-narration' });
    }
    await animation.getByRole('button', { name: 'Knowledge check', exact: true }).click();
    const question = questionsOf('trace')[0];
    const wrong = Number(Object.keys(question.option_feedback)[0]);
    await animation.locator('.np-quiz').getByRole('radio').filter({ hasText: question.options[wrong] }).click();
    await expect(animation.getByText(question.option_feedback[wrong], { exact: true })).toBeVisible();
    await a11yCheckpoint(page, 'mobile incorrect answer', { include: '#uml_component_diagram-animation .nja-player', feature: 'uml-component-diagram-narration' });
    await animation.locator('.nja-player').screenshot({ path: testInfo.outputPath('quiz-mobile.png') });
  });
}

test('reading and print views include every step, diagram, and question without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const questions = story.scenes.reduce((count, scene) => count + questionsOf(scene.id).length, 0);
  for (const view of ['read', 'print']) {
    await page.goto(`/SEBook/uml_component_diagram/${view}/`);
    await expect(page.locator('audio')).toHaveCount(0);
    await expect(page.locator('.np-reading-step')).toHaveCount(story.scenes.reduce((count, scene) => count + scene.cues.length, 0));
    for (const scene of story.scenes) {
      for (const [index, cue] of scene.cues.entries()) {
        const step = page.locator(`[data-reading-scene="${scene.id}"][data-reading-cue="${index}"]`);
        await expect(step.getByText(cue.text, { exact: true })).toBeVisible();
        if (scene.diagram) await expect(step.locator('.np-diagram svg')).toBeVisible();
        if (scene.cards) await expect(step.locator('.np-cards dt')).toHaveText(scene.cards.map(card => card.title));
      }
      // A scene inside a part names the lesson's own parts, not a pattern description's.
      const parts = page.locator(`#uml_component_diagram-reading-${scene.id}`).getByRole('list', { name: lesson.parts_label, exact: true });
      await expect(parts).toHaveCount(scene.part ? 1 : 0);
      if (scene.part) {
        await expect(parts.getByRole('listitem')).toHaveText(lesson.parts);
        await expect(parts.locator('[aria-current="step"]')).toHaveText(scene.part);
      }
    }
    await expect(page.locator('.np-print-question')).toHaveCount(questions);
    await expect(page.getByText('Summary quiz:', { exact: true })).toHaveCount(questionsOf('summary').length);
    await expect(page.getByRole('heading', { name: 'Complete examples' })).toHaveCount(0);
  }
  await context.close();
});

test('reading view keeps the theme, has no code controls, and is accessible', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(url);
  await theme(page, true);
  await player(page).getByRole('link', { name: 'Read at my own pace', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Code language' })).toHaveCount(0);
  await a11yCheckpoint(page, 'component diagrams reader dark', { include: '#main-content', feature: 'uml-component-diagram-narration' });
  await page.getByRole('button', { name: 'Dark mode' }).click();
  await a11yCheckpoint(page, 'component diagrams reader light', { include: '#main-content', feature: 'uml-component-diagram-narration' });
  await page.setViewportSize({ width: 320, height: 850 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
