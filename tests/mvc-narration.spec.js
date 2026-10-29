const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');
const { readFileSync } = require('node:fs');
const yaml = require('js-yaml');

const story = yaml.load(readFileSync(require.resolve('../_data/explainers/mvc.yml'), 'utf8'));
const examples = yaml.load(readFileSync(require.resolve('../_data/explainers/mvc_code.yml'), 'utf8'));
const quizzes = yaml.load(readFileSync(require.resolve('../_data/explainers/mvc_quizzes.yml'), 'utf8'));
const dashboard = yaml.load(readFileSync(require.resolve('../_data/explainers/mvc_ui.yml'), 'utf8'));
const timing = require('../_data/explainers/mvc_timing.json');
const url = '/SEBook/designpatterns/mvc.html';
const player = page => page.getByRole('region', { name: story.title, exact: true });
const sceneIndex = id => story.scenes.findIndex(scene => scene.id === id);
const questionsOf = id => quizzes[id].questions || [quizzes[id]];

async function seek(page, time) {
  const animation = player(page);
  await animation.getByRole('slider', { name: 'Animation position' }).fill(String(Number(time.toFixed(2))));
  await expect.poll(() => animation.locator('audio').evaluate(audio => audio.currentTime)).toBeCloseTo(time, 1);
}
const cueMiddle = (id, cue) => {
  const cueTiming = timing.scenes[sceneIndex(id)].cues[cue];
  return (cueTiming.start + cueTiming.end) / 2;
};
async function theme(page, dark) {
  const toggle = page.getByRole('checkbox', { name: 'Toggle dark mode' });
  if (await toggle.isChecked() !== dark) await toggle.press('Space');
}

test('code marks follow every cue in all four languages without moving the narration', async ({ page }) => {
  test.setTimeout(120000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  const animation = player(page);
  for (const scene of story.scenes.filter(candidate => candidate.code)) {
    for (const [cueIndex, cue] of scene.cues.entries()) {
      await seek(page, cueMiddle(scene.id, cueIndex));
      for (const language of story.languages) {
        await animation.getByRole('combobox', { name: 'Code language' }).selectOption(language);
        await expect(animation.getByRole('region', { name: 'Narration', exact: true })).toHaveText(cue.text);
        const code = animation.locator('.nja-stage pre:visible');
        await expect(code).toHaveAttribute('aria-label', `${examples[language].filename} code`);
        const marked = await code.locator('[aria-current="true"]').evaluateAll(lines => lines.map(line => Number(line.dataset.line)));
        expect(marked, `${language}/${scene.id}/${cueIndex}`).toEqual(examples[language].blocks[scene.code].focus[cue.focus] || []);
      }
    }
  }
  expect(errors).toEqual([]);
});

test('each scene names its part of the pattern description', async ({ page }) => {
  await page.goto(url);
  const animation = player(page);
  for (const [index, scene] of story.scenes.entries()) {
    await seek(page, timing.scenes[index].start + 0.5);
    const parts = animation.locator('.nja-scene:visible').getByRole('list', { name: 'Part of the pattern description' });
    if (!scene.part) {
      await expect(parts).toHaveCount(0);
      continue;
    }
    await expect(parts.getByRole('listitem')).toHaveText(['Context', 'Problem', 'Solution', 'Consequences']);
    await expect(parts.locator('[aria-current="step"]')).toHaveText(scene.part);
  }
});

// How many steps a diagram shows, read from its text: one word unique to each
// CRC card, or the messages that each scenario step adds.
const REVEALED_STEPS = {
  structure: texts => ['rules', 'Displays', 'Receives'].filter(word => texts.some(text => text.includes(word))).length,
  input: texts => texts.filter(text => text === 'setMinutes("Study", 90)' || text === 'update()').length,
  setup: texts => ['«create»', 'attach(bars)', 'makeController()'].filter(message => texts.includes(message)).length,
};

test('class diagrams highlight the discussed role, and CRC cards and messages appear one step per cue', async ({ page }) => {
  await page.goto(url);
  const animation = player(page);
  for (const [index, scene] of story.scenes.entries()) {
    if (!scene.diagram) continue;
    for (const [cueIndex, cue] of scene.cues.entries()) {
      const name = cue.diagram || scene.diagram;
      await seek(page, timing.scenes[index].cues[cueIndex].start + 0.5);
      // A cue that switches diagrams also renames the region for it.
      const diagram = animation.getByRole('region', { name: story.diagrams[name].label, exact: true });
      await expect(diagram.locator('svg')).toBeVisible();
      if (cue.diagram_focus) {
        const label = diagram.locator('svg text').filter({ hasText: new RegExp(`^${cue.diagram_focus}$`) }).first();
        await expect(label).toBeVisible();
        // The texture must cover the discussed class's name, not just exist elsewhere.
        expect(await label.evaluate(text => {
          const box = text.getBBox();
          const x = box.x + box.width / 2, y = box.y + box.height / 2;
          return [...text.closest('svg').querySelectorAll('[fill^="url("]')].some(shape => {
            const area = shape.getBBox();
            return x >= area.x && x <= area.x + area.width && y >= area.y && y <= area.y + area.height;
          });
        }), `${scene.id}/${cueIndex}: ${cue.diagram_focus} is highlighted`).toBe(true);
      }
      if (cue.diagram_steps) {
        const texts = (await diagram.locator('svg text').allTextContents()).map(text => text.trim());
        expect(REVEALED_STEPS[name](texts), `${scene.id}/${cueIndex}`).toBe(cue.diagram_steps);
      }
    }
  }
});

// In the player the dashboard is a live app: rows are spin buttons, bars are toggle buttons.
const liveDashboard = animation => animation.locator('.nja-scene:visible').getByRole('group', { name: /^Screen time/ });
const row = (board, category) => board.getByRole('spinbutton', { name: category, exact: true });
const bar = (board, category) => board.getByRole('button', { name: new RegExp(`^${category}, \\d+ minutes$`) });

test('each narrated cue moves the live dashboard to its state', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(url);
  const animation = player(page);
  for (const [index, scene] of story.scenes.entries()) {
    if (!scene.ui) continue;
    for (const [cueIndex, cue] of scene.cues.entries()) {
      await seek(page, timing.scenes[index].cues[cueIndex].start + 0.5);
      const panel = dashboard.panels[cue.ui_state];
      const board = liveDashboard(animation);
      for (const category of dashboard.categories) {
        await expect(row(board, category), `${scene.id}/${cueIndex}`).toHaveValue(String(panel.minutes[category]));
        await expect(bar(board, category)).toHaveAttribute('aria-pressed', String(category === (panel.selected || '')));
      }
      await expect(board.getByText('read-only', { exact: true })).toBeVisible({ visible: Boolean(panel.readonly) });
      await expect(board.getByText(panel.result, { exact: true })).toBeVisible();
    }
  }
});

test('students edit the live dashboard, and only the views that need it redraw', async ({ page }) => {
  await page.goto(url);
  const animation = player(page);
  await seek(page, cueMiddle('intro', 1));
  const board = liveDashboard(animation);
  await expect(row(board, 'Study')).toHaveValue('90');
  // An edit changes the data, so every view follows at once.
  await row(board, 'Social').fill('60');
  await expect(bar(board, 'Social')).toHaveAccessibleName('Social, 60 minutes');
  await expect(board.getByText('Social 20%', { exact: true })).toBeVisible();
  await expect(board.getByRole('status')).toHaveText(/Social is now 60 minutes/);
  // A click is a request to the bar chart alone.
  await expect(board.locator('.mvc-pane.is-redrawn')).toHaveCount(0);
  await bar(board, 'Games').click();
  await expect(bar(board, 'Games')).toHaveAttribute('aria-pressed', 'true');
  await expect(board.locator('.mvc-pane.is-redrawn')).toHaveCount(1);
  await expect(board.getByRole('status')).toHaveText(/only the bar chart redrew/);
  // Swapping in a controller that ignores input makes the table read-only.
  await board.getByRole('checkbox', { name: /read-only/ }).check();
  await row(board, 'Study').fill('5');
  await expect(row(board, 'Study')).toHaveValue('90');
  await expect(board.getByRole('status')).toHaveText(/ignored the edit/);
  await expect(board.getByText('Study 30%', { exact: true })).toBeVisible();
});

test('in the first design, a click on one bar redraws every view', async ({ page }) => {
  await page.goto(url);
  const animation = player(page);
  await seek(page, cueMiddle('problem', 1));
  const board = liveDashboard(animation);
  await expect(row(board, 'Study')).toHaveValue('90');
  await expect(board.locator('.mvc-pane.is-redrawn')).toHaveCount(0);
  await bar(board, 'Video').click();
  await expect(board.locator('.mvc-pane.is-redrawn')).toHaveCount(3);
  await expect(board.getByRole('status')).toHaveText(/redraws all three views/);
});

for (const dark of [false, true]) {
  test(`player and quiz are readable and accessible in ${dark ? 'dark' : 'light'} mode, including mobile`, async ({ page }, testInfo) => {
    // Each axe pass over these diagram-heavy scenes takes several seconds.
    test.setTimeout(240000);
    await page.setViewportSize({ width: 1500, height: 1000 });
    await page.goto(url);
    await theme(page, dark);
    const animation = player(page);
    // The dashboard, CRC cards, code beside a sequence diagram, and the read-only dashboard.
    for (const [id, cue] of [['intro', 0], ['solution', 3], ['collaborations', 3], ['transfer', 1]]) {
      await seek(page, cueMiddle(id, cue));
      await a11yCheckpoint(page, `${id} ${dark ? 'dark' : 'light'}`, { include: '#mvc-animation', feature: 'mvc-narration' });
      await animation.locator('.nja-player').screenshot({ path: testInfo.outputPath(`${id}.png`) });
    }
    await page.setViewportSize({ width: 320, height: 850 });
    for (const id of ['problem', 'collaborations']) {
      await seek(page, cueMiddle(id, 0));
      await expect.poll(() => animation.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      await a11yCheckpoint(page, `mobile ${id}`, { include: '#mvc-animation', feature: 'mvc-narration' });
    }
    await animation.getByRole('button', { name: 'Knowledge check', exact: true }).click();
    const question = questionsOf('collaborations')[0];
    const wrong = Number(Object.keys(question.option_feedback)[0]);
    await animation.locator('.np-quiz').getByRole('radio').filter({ hasText: question.options[wrong] }).click();
    await expect(animation.getByText(question.option_feedback[wrong], { exact: true })).toBeVisible();
    await a11yCheckpoint(page, 'mobile incorrect answer', { include: '#mvc-animation', feature: 'mvc-narration' });
    await animation.locator('.nja-player').screenshot({ path: testInfo.outputPath('quiz-mobile.png') });
  });
}

test('reading and print views include every step, diagram, and question without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const questions = story.scenes.reduce((count, scene) => count + questionsOf(scene.id).length, 0);
  for (const view of ['read', 'print']) {
    await page.goto(`/SEBook/designpatterns/mvc/${view}/`);
    await expect(page.locator('audio')).toHaveCount(0);
    await expect(page.locator('.np-reading-step')).toHaveCount(story.scenes.reduce((count, scene) => count + scene.cues.length, 0));
    for (const scene of story.scenes) {
      for (const [index, cue] of scene.cues.entries()) {
        const step = page.locator(`[data-reading-scene="${scene.id}"][data-reading-cue="${index}"]`);
        await expect(step.getByText(cue.text, { exact: true })).toBeVisible();
        if (scene.diagram) await expect(step.locator('.np-diagram svg')).toBeVisible();
        if (scene.ui) await expect(step.getByRole('img', { name: /^Screen time dashboard\./ })).toBeVisible();
      }
    }
    await expect(page.locator('.np-print-question')).toHaveCount(questions);
    await expect(page.getByText('Summary quiz:', { exact: true })).toHaveCount(questionsOf('summary').length);
  }
  await context.close();
});

test('reading view keeps the chosen language and theme and is accessible', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(url);
  await player(page).getByRole('combobox', { name: 'Code language' }).selectOption('cpp');
  await theme(page, true);
  await player(page).getByRole('link', { name: 'Read at my own pace', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Code language' })).toHaveValue('cpp');
  await expect(page.locator('[data-transcript-language="python"]:visible')).toHaveCount(0);
  await a11yCheckpoint(page, 'mvc reader dark', { include: '#main-content', feature: 'mvc-narration' });
  await page.getByRole('button', { name: 'Dark mode' }).click();
  await a11yCheckpoint(page, 'mvc reader light', { include: '#main-content', feature: 'mvc-narration' });
  await page.setViewportSize({ width: 320, height: 850 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
