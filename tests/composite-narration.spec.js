const { loadStory } = require('../scripts/narration/source');
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');
const { openPlayerSettings, setSiteTheme, serveAudioRanges } = require('./helpers/narration-player');
const { readFileSync } = require('node:fs');
const yaml = require('js-yaml');

const story = loadStory('composite');
const examples = yaml.load(readFileSync(require.resolve('../_data/explainers/composite_code.yml'), 'utf8'));
const quizzes = yaml.load(readFileSync(require.resolve('../_data/explainers/composite_quizzes.yml'), 'utf8'));
const library = yaml.load(readFileSync(require.resolve('../_data/explainers/composite_ui.yml'), 'utf8'));
const timing = require('../_data/explainers/composite_timing.json');
const url = '/SEBook/designpatterns/composite.html';
const player = page => page.getByRole('region', { name: story.title, exact: true });
const sceneIndex = id => story.scenes.findIndex(scene => scene.id === id);
const questionsOf = id => quizzes[id].questions || [quizzes[id]];
// Pattern lessons label their slider "Animation position"; video narrations
// use the shared seekNarration helper with "Narration position".
async function seekTo(page, time) {
  const animation = player(page);
  await animation.getByRole('slider', { name: 'Animation position' }).fill(String(Number(time.toFixed(2))));
  await expect.poll(() => animation.locator('audio').evaluate(audio => audio.currentTime)).toBeCloseTo(time, 1);
}
const cueMiddle = (id, cueId) => {
  const scene = story.scenes[sceneIndex(id)];
  const cueTiming = timing.scenes[sceneIndex(id)].cues[scene.cues.findIndex(cue => cue.id === cueId)];
  return (cueTiming.start + cueTiming.end) / 2;
};
const seek = (page, id, cueId) => seekTo(page, cueMiddle(id, cueId));
const titleOf = row => (row.kind === 'episode' ? `${row.show}: ${row.name}` : row.name);
const rowsOf = panel => (['added', 'uncounted'].includes(panel.episode) ? [...library.rows, ...library.episode] : library.rows);
// The live library of the scene on screen.
const liveLibrary = page => player(page).locator('.nja-scene:visible').getByRole('group', { name: /^Music library/ });

test('code marks follow every cue in all four languages', async ({ page }) => {
  test.setTimeout(120000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  const animation = player(page);
  for (const scene of story.scenes.filter(candidate => candidate.code)) {
    for (const cue of scene.cues) {
      await seek(page, scene.id, cue.id);
      for (const language of story.languages) {
        await animation.getByRole('combobox', { name: 'Code language' }).selectOption(language);
        await expect(animation.getByRole('region', { name: 'Narration', exact: true })).toHaveText(cue.text);
        const code = animation.locator('.nja-stage pre:visible');
        await expect(code).toHaveAttribute('aria-label', `${examples[language].filename} code`);
        const marked = await code.locator('[aria-current="true"]').evaluateAll(lines => lines.map(line => Number(line.dataset.line)));
        expect(marked, `${language}/${scene.id}/${cue.id}`).toEqual(examples[language].blocks[scene.code].focus[cue.focus] || []);
      }
    }
  }
  expect(errors).toEqual([]);
});

test('each scene names its part of the pattern description', async ({ page }) => {
  await page.goto(url);
  const animation = player(page);
  for (const [index, scene] of story.scenes.entries()) {
    await seekTo(page, timing.scenes[index].start + 0.5);
    const parts = animation.locator('.nja-scene:visible').getByRole('list', { name: 'Part of the pattern description' });
    await expect(parts.getByRole('listitem')).toHaveText(['Context', 'Problem', 'Solution', 'Consequences']);
    await expect(parts.locator('[aria-current="step"]')).toHaveText(scene.part ? [scene.part] : []);
  }
});

// The message labels of the first `count` sequence steps, in diagram order.
const messages = (diagram, count) => diagram.steps.slice(0, count)
  .flatMap(step => [...step.matchAll(/-> \w+: (.+)$/gm)].map(match => match[1]));

test('diagrams highlight the cue\'s class, role, or lifeline, and the trace reveals one step per cue', async ({ page }) => {
  await page.goto(url);
  const animation = player(page);
  for (const scene of story.scenes) {
    if (!scene.diagram) continue;
    for (const cue of scene.cues) {
      const source = story.diagrams[cue.diagram || scene.diagram];
      const diagram = animation.getByRole('region', { name: source.label });
      await seek(page, scene.id, cue.id);
      await expect(diagram.locator('svg')).toBeVisible();
      if (cue.diagram_focus) {
        const label = diagram.locator('svg text').filter({ hasText: new RegExp(`^${cue.diagram_focus}(:|$)`) }).first();
        await expect(label).toBeVisible();
        // The texture must cover the discussed element's label, not just exist elsewhere.
        expect(await label.evaluate(node => {
          const box = node.getBBox();
          const x = box.x + box.width / 2, y = box.y + box.height / 2;
          return [...node.closest('svg').querySelectorAll('[fill^="url("]')].some(shape => {
            const area = shape.getBBox();
            return x >= area.x && x <= area.x + area.width && y >= area.y && y <= area.y + area.height;
          });
        }), `${scene.id}/${cue.id}: ${cue.diagram_focus} is highlighted`).toBe(true);
      }
      if (cue.diagram_steps) {
        // Each step adds its messages; later messages stay hidden until their cue.
        const labels = [...new Set(messages(source, source.steps.length))];
        const shown = await diagram.locator('svg text').evaluateAll((nodes, wanted) => nodes
          .map(node => node.textContent.trim()).filter(text => wanted.includes(text)), labels);
        expect(shown.sort(), `${scene.id}/${cue.id}`).toEqual(messages(source, cue.diagram_steps).sort());
      }
    }
  }
});

test('each cue moves the live library to its narrated state', async ({ page }) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url);
  for (const scene of story.scenes.filter(candidate => candidate.ui)) {
    for (const cue of scene.cues) {
      await seek(page, scene.id, cue.id);
      const panel = library.panels[cue.ui_state];
      const live = liveLibrary(page);
      const rows = rowsOf(panel);
      const items = live.getByRole('list', { name: 'Library' }).getByRole('listitem');
      await expect(items, `${scene.id}/${cue.id}`).toHaveCount(rows.length);
      for (const [index, row] of rows.entries()) {
        const words = [];
        if ((panel.marked || []).includes(row.id)) words.push(panel.mark);
        if (row.id === panel.current) words.push('playing');
        else if ((panel.visited || []).includes(row.id)) words.push('visited');
        if ((panel.flags || {})[row.id]) words.push(panel.flags[row.id]);
        const item = items.nth(index);
        await expect(item.getByRole('button', { name: `Play ${titleOf(row)}`, exact: true })).toBeVisible();
        await expect(item.locator('.composite-tag'), `${scene.id}/${cue.id}: ${row.id}`).toHaveText(words);
      }
      const queue = live.getByRole('list', { name: /^Queue/ });
      if ((panel.queue || []).length) await expect(queue.getByRole('listitem')).toHaveText(panel.queue);
      else await expect(queue).toBeHidden();
      await expect(live.getByText(panel.note, { exact: true })).toBeVisible();
    }
  }
});

test('students press Play on any row and get the queue of the design on screen', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url);
  const press = async name => {
    await liveLibrary(page).getByRole('button', { name: `Play ${name}`, exact: true }).click();
  };
  const queue = () => liveLibrary(page).getByRole('list', { name: /^Queue/ }).getByRole('listitem');
  const status = () => liveLibrary(page).getByRole('status');
  const { expected } = library;

  await seek(page, 'intro', 'try-it');
  await press('Throwbacks');
  await expect(queue()).toHaveText(expected.throwbacks.queue);
  await expect(status()).toHaveText('Played Throwbacks: 2 titles, 7:30.');
  await press('Sunroof Down');
  await expect(queue()).toHaveText(expected.sunroof.queue);
  await expect(status()).toHaveText('Played Sunroof Down: 1 title, 3:00.');
  await press('Road Trip');
  await expect(queue()).toHaveText(expected.road_trip.queue);
  await expect(status()).toHaveText('Played Road Trip: 4 titles, 14:00.');

  // The problem scene's library is drawn by the first design, which loses the order.
  await seek(page, 'problem', 'two-lists');
  await press('Road Trip');
  await expect(queue()).toHaveText(expected.first_design_road_trip);
  await expect(status()).toHaveText('Played Road Trip: 4 titles, 14:00. The first design queues a playlist’s own songs before its nested playlists.');
  await liveLibrary(page).getByRole('button', { name: 'Back to the narration’s picture' }).click();
  await expect(liveLibrary(page).getByRole('list', { name: /^Queue/ })).toBeHidden();
  await expect(liveLibrary(page).getByText(library.panels.first_start.note, { exact: true })).toBeVisible();
  await expect(status()).toHaveText('The library is back to the narration’s picture.');

  // With the forgotten loop, the episode plays but its length is not counted.
  await seek(page, 'problem', 'every-change');
  await press('Road Trip');
  await expect(queue()).toHaveText(library.panels.first_missing.queue);
  await expect(status()).toContainText('Played Road Trip: 5 titles, 14:00.');
  await expect(status()).toContainText('Its length leaves out the episode');

  // The finished transfer: a new leaf kind fits the composite unchanged.
  await seek(page, 'transfer', 'episode');
  await press('Road Trip');
  await expect(queue()).toHaveText(expected.with_episode.queue);
  await expect(status()).toHaveText('Played Road Trip: 5 titles, 29:00.');
});

test('narration stops inside the silence before each check and resumes only when asked', async ({ page }) => {
  test.setTimeout(180000);
  await serveAudioRanges(page, story.audio);
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
    const speechEnd = timing.scenes[index].cues.at(-1).speech_end ?? end - scene.cues.at(-1).pause_after;
    await seekTo(page, end - 0.9);
    await page.evaluate(() => { window.pausedAt = null; });
    await animation.getByRole('button', { name: 'Play narration' }).click();
    const questions = questionsOf(scene.id);
    const kind = questions.length > 1 ? 'Summary quiz' : 'Knowledge check';
    const quiz = animation.getByRole('region', { name: `${index + 1}. ${scene.label} — ${kind}`, exact: true });
    await expect(quiz).toBeVisible();
    const pausedAt = await page.evaluate(() => window.pausedAt);
    expect(pausedAt, `${scene.id}: stops before the next section's speech`).toBeLessThan(end - 0.1);
    expect(pausedAt - speechEnd, `${scene.id}: at least two seconds to inspect the finished picture`).toBeGreaterThanOrEqual(2);
    expect(await animation.locator('audio').evaluate(audio => audio.paused)).toBe(true);
    for (const question of questions) {
      await expect(quiz.getByText(question.question, { exact: true })).toBeVisible();
      await quiz.getByRole('radio').filter({ hasText: question.options[question.correct_index] }).click();
      await expect(quiz.getByText(question.explanation, { exact: true })).toBeVisible();
      if (question !== questions.at(-1)) await quiz.getByRole('button', { name: /^Next/ }).click();
    }
    if (questions.length > 1) await quiz.getByRole('button', { name: 'See Results' }).click();
    await quiz.getByRole('button', { name: index + 1 < story.scenes.length ? 'Continue narration' : 'Finish review' }).click();
    await expect(quiz).toBeHidden();
    if (index + 1 < story.scenes.length) {
      await animation.getByRole('button', { name: 'Pause narration' }).click();
      await expect(animation.getByRole('button', { name: 'Play narration' })).toBeEnabled();
      await expect(animation.getByRole('heading', { name: story.scenes[index + 1].title, exact: true })).toBeVisible();
    }
  }
});

// These checkpoints audit the player's states. The collapsed transcript repeats
// every step's code in four languages; the reader test and the page audit cover it.
for (const dark of [false, true]) {
  test(`player, live library, and quiz are readable and accessible in ${dark ? 'dark' : 'light'} mode, including mobile`, async ({ page }, testInfo) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1500, height: 1000 });
    await page.goto(url);
    await setSiteTheme(page, dark);
    const animation = player(page);
    for (const [id, cue] of [['intro', 'try-it'], ['problem', 'every-change'], ['playlist_role', 'safe-add'], ['collaborations', 'recursion'], ['solution', 'client'], ['transfer', 'episode']]) {
      await seek(page, id, cue);
      await a11yCheckpoint(page, `${id} ${dark ? 'dark' : 'light'}`, { include: '#composite-animation .nja-player', feature: 'composite-narration' });
      await animation.locator('.nja-player').screenshot({ path: testInfo.outputPath(`${id}.png`) });
    }
    await page.setViewportSize({ width: 320, height: 850 });
    for (const [id, cue] of [['problem', 'lost-order'], ['collaborations', 'loop']]) {
      await seek(page, id, cue);
      await expect.poll(() => animation.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      await a11yCheckpoint(page, `mobile ${id}`, { include: '#composite-animation .nja-player', feature: 'composite-narration' });
    }
    await openPlayerSettings(animation);
    await animation.getByRole('button', { name: 'Knowledge check', exact: true }).click();
    const question = questionsOf('collaborations')[0];
    const wrong = Number(Object.keys(question.option_feedback)[0]);
    await animation.getByRole('region', { name: /— (Knowledge check|Summary quiz)$/ }).getByRole('radio').filter({ hasText: question.options[wrong] }).click();
    await expect(animation.getByText(question.option_feedback[wrong], { exact: true })).toBeVisible();
    await a11yCheckpoint(page, 'mobile incorrect answer', { include: '#composite-animation .nja-player', feature: 'composite-narration' });
    await animation.locator('.nja-player').screenshot({ path: testInfo.outputPath('quiz-mobile.png') });
  });
}

test('reading and print views include every step, diagram, picture, and question without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const questions = story.scenes.reduce((count, scene) => count + questionsOf(scene.id).length, 0);
  for (const view of ['read', 'print']) {
    await page.goto(`/SEBook/designpatterns/composite/${view}/`);
    await expect(page.locator('audio')).toHaveCount(0);
    await expect(page.locator('.np-reading-step')).toHaveCount(story.scenes.reduce((count, scene) => count + scene.cues.length, 0));
    for (const scene of story.scenes) {
      for (const [index, cue] of scene.cues.entries()) {
        const step = page.locator(`[data-reading-scene="${scene.id}"][data-reading-cue="${index}"]`);
        await expect(step.getByText(cue.text, { exact: true })).toBeVisible();
        if (scene.diagram) await expect(step.locator('.np-diagram svg')).toBeVisible();
        if (scene.ui) {
          const panel = library.panels[cue.ui_state];
          await expect(step.getByRole('img', { name: new RegExp(`^${library.app}, drawn by the ${panel.design === 'first' ? 'first' : 'composite'} design`) })).toBeVisible();
        }
      }
    }
    await expect(page.locator('.np-print-question')).toHaveCount(questions);
    await expect(page.getByText('Summary quiz:', { exact: true })).toHaveCount(questionsOf('summary').length);
  }
  await context.close();
});

test('reading view keeps the chosen language and theme and is accessible', async ({ page }) => {
  // The reader is every step in four languages; auditing it twice takes longer than the default.
  test.setTimeout(120000);
  await page.goto(url);
  await player(page).getByRole('combobox', { name: 'Code language' }).selectOption('java');
  await setSiteTheme(page, true);
  await player(page).getByRole('link', { name: 'Read at my own pace', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Code language' })).toHaveValue('java');
  await expect(page.locator('[data-transcript-language="python"]:visible')).toHaveCount(0);
  await a11yCheckpoint(page, 'composite reader dark', { include: '#main-content', feature: 'composite-narration' });
  await page.getByRole('button', { name: 'Dark mode' }).click();
  await a11yCheckpoint(page, 'composite reader light', { include: '#main-content', feature: 'composite-narration' });
  await page.setViewportSize({ width: 320, height: 850 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
