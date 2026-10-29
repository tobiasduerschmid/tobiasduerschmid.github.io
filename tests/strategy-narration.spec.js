const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');
const { readFileSync } = require('node:fs');
const yaml = require('js-yaml');

const story = yaml.load(readFileSync(require.resolve('../_data/explainers/strategy.yml'), 'utf8'));
const examples = yaml.load(readFileSync(require.resolve('../_data/explainers/strategy_code.yml'), 'utf8'));
const quizzes = yaml.load(readFileSync(require.resolve('../_data/explainers/strategy_quizzes.yml'), 'utf8'));
const split = yaml.load(readFileSync(require.resolve('../_data/explainers/strategy_ui.yml'), 'utf8'));
const timing = require('../_data/explainers/strategy_timing.json');
const url = '/SEBook/designpatterns/strategy.html';
const player = page => page.getByRole('region', { name: story.title, exact: true });
const sceneIndex = id => story.scenes.findIndex(scene => scene.id === id);
const questionsOf = id => quizzes[id].questions || [quizzes[id]];
const dollars = cents => `$${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;

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

// WEBrick may answer a conditional MP3 range request with 304 instead of the
// bytes Chromium needs after seeking; drop validators from range requests.
async function serveAudioRanges(page) {
  await page.route('**/assets/audio/strategy-pattern.mp3', route => {
    const headers = { ...route.request().headers() };
    if (headers.range) {
      delete headers['if-none-match'];
      delete headers['if-modified-since'];
    }
    return route.continue({ headers });
  });
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

// An anonymous lifeline (`participant equal as : EqualSplit`) displays ": EqualSplit".
function displayedLabel(diagram, focus) {
  const anonymous = diagram.source.match(new RegExp(`^participant ${focus} as (: \\w+)$`, 'm'));
  return anonymous ? anonymous[1] : focus;
}

// The message labels of the first `count` sequence steps, in diagram order.
function messages(diagram, count) {
  return diagram.steps.slice(0, count).flatMap(step => [...step.matchAll(/-> \w+: (.+)$/gm)].map(match => match[1]));
}

test('diagrams highlight the cue\'s role, class, or lifeline, and the sequence reveals one step per cue', async ({ page }) => {
  await page.goto(url);
  const animation = player(page);
  for (const [index, scene] of story.scenes.entries()) {
    if (!scene.diagram) continue;
    const source = story.diagrams[scene.diagram];
    const diagram = animation.getByRole('region', { name: source.label });
    for (const [cueIndex, cue] of scene.cues.entries()) {
      await seek(page, timing.scenes[index].cues[cueIndex].start + 0.5);
      await expect(diagram.locator('svg')).toBeVisible();
      if (cue.diagram_focus) {
        const text = displayedLabel(source, cue.diagram_focus);
        const label = diagram.locator('svg text').filter({ hasText: new RegExp(`^${text}(:|$)`) }).first();
        await expect(label).toBeVisible();
        // The texture must cover the discussed element's label, not just exist elsewhere.
        expect(await label.evaluate(node => {
          const box = node.getBBox();
          const x = box.x + box.width / 2, y = box.y + box.height / 2;
          return [...node.closest('svg').querySelectorAll('[fill^="url("]')].some(shape => {
            const area = shape.getBBox();
            return x >= area.x && x <= area.x + area.width && y >= area.y && y <= area.y + area.height;
          });
        }), `${scene.id}/${cueIndex}: ${cue.diagram_focus} is highlighted`).toBe(true);
      }
      if (cue.diagram_steps) {
        // Each step adds its messages; later messages stay hidden until their cue.
        const all = new Set(messages(source, source.steps.length));
        const shown = await diagram.locator('svg text').evaluateAll((nodes, labels) => nodes
          .map(node => node.textContent.trim()).filter(text => labels.includes(text)), [...all]);
        expect(shown.sort(), `${scene.id}/${cueIndex}`).toEqual(messages(source, cue.diagram_steps).sort());
      }
    }
  }
});

test('the table marks the operation being read or the strategy class being built', async ({ page }) => {
  await page.goto(url);
  const animation = player(page);
  const label = id => [...split.operations, ...split.methods].find(item => item.id === id).label;
  for (const [index, scene] of story.scenes.entries()) {
    if (!scene.table) continue;
    for (const [cueIndex, cue] of scene.cues.entries()) {
      await seek(page, timing.scenes[index].cues[cueIndex].start + 0.5);
      const table = animation.locator('.nja-scene:visible').getByRole('table', { name: 'Split methods by operation' });
      await expect(table).toBeVisible();
      const focus = cue.table_focus || {};
      if (focus.column) {
        await expect(table.locator('thead th.is-marked')).toHaveText(label(focus.column));
        await expect(table.locator('tbody td.is-marked')).toHaveCount(split.methods.length);
      } else if (focus.row) {
        await expect(table.locator('tbody tr.is-marked th')).toHaveText(label(focus.row));
      } else {
        await expect(table.locator('.is-marked')).toHaveCount(0);
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

test('the split panel shows each traced choice and its shares', async ({ page }) => {
  await page.goto(url);
  const animation = player(page);
  const trace = story.scenes[sceneIndex('collaborations')];
  for (const [cueIndex, cue] of trace.cues.entries()) {
    await seek(page, cueMiddle('collaborations', cueIndex));
    const shown = split.cases[split.panels[cue.ui_state]];
    const method = split.methods.find(entry => entry.id === shown.method).label;
    const owed = split.people.map(person => `${person} owes ${dollars(shown.shares[person])}`).join(', ');
    await expect(animation.getByRole('img', { name: `Group expense panel: ${split.expense}, ${dollars(shown.total)}, split ${method}. ${owed}. Receipt: ${shown.label}.`, exact: true })).toBeVisible();
  }
});

// These checkpoints audit the player's states. The collapsed transcript repeats
// every step's code in four languages; the reader test and the page audit cover it.
for (const dark of [false, true]) {
  test(`player and quiz are readable and accessible in ${dark ? 'dark' : 'light'} mode, including mobile`, async ({ page }, testInfo) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1500, height: 1000 });
    await page.goto(url);
    await theme(page, dark);
    const animation = player(page);
    for (const [id, cue] of [['context', 1], ['problem', 0], ['solution', 0], ['concrete_roles', 1], ['collaborations', 3]]) {
      await seek(page, cueMiddle(id, cue));
      await a11yCheckpoint(page, `${id} ${dark ? 'dark' : 'light'}`, { include: '#strategy-animation .nja-player', feature: 'strategy-narration' });
      await animation.locator('.nja-player').screenshot({ path: testInfo.outputPath(`${id}.png`) });
    }
    await page.setViewportSize({ width: 320, height: 850 });
    for (const id of ['problem', 'collaborations']) {
      await seek(page, cueMiddle(id, 0));
      await expect.poll(() => animation.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      await a11yCheckpoint(page, `mobile ${id}`, { include: '#strategy-animation .nja-player', feature: 'strategy-narration' });
    }
    await animation.getByRole('button', { name: 'Knowledge check', exact: true }).click();
    const question = questionsOf('collaborations')[0];
    const wrong = Number(Object.keys(question.option_feedback)[0]);
    await animation.locator('.np-quiz').getByRole('radio').filter({ hasText: question.options[wrong] }).click();
    await expect(animation.getByText(question.option_feedback[wrong], { exact: true })).toBeVisible();
    await a11yCheckpoint(page, 'mobile incorrect answer', { include: '#strategy-animation .nja-player', feature: 'strategy-narration' });
    await animation.locator('.nja-player').screenshot({ path: testInfo.outputPath('quiz-mobile.png') });
  });
}

test('reading and print views include every step, diagram, and question without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const questions = story.scenes.reduce((count, scene) => count + questionsOf(scene.id).length, 0);
  for (const view of ['read', 'print']) {
    await page.goto(`/SEBook/designpatterns/strategy/${view}/`);
    await expect(page.locator('audio')).toHaveCount(0);
    await expect(page.locator('.np-reading-step')).toHaveCount(story.scenes.reduce((count, scene) => count + scene.cues.length, 0));
    for (const scene of story.scenes) {
      for (const [index, cue] of scene.cues.entries()) {
        const step = page.locator(`[data-reading-scene="${scene.id}"][data-reading-cue="${index}"]`);
        await expect(step.getByText(cue.text, { exact: true })).toBeVisible();
        if (scene.diagram) await expect(step.locator('.np-diagram svg')).toBeVisible();
        if (scene.table) await expect(step.getByRole('table', { name: 'Split methods by operation' })).toBeVisible();
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
  await theme(page, true);
  await player(page).getByRole('link', { name: 'Read at my own pace', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Code language' })).toHaveValue('java');
  await expect(page.locator('[data-transcript-language="python"]:visible')).toHaveCount(0);
  await a11yCheckpoint(page, 'strategy reader dark', { include: '#main-content', feature: 'strategy-narration' });
  await page.getByRole('button', { name: 'Dark mode' }).click();
  await a11yCheckpoint(page, 'strategy reader light', { include: '#main-content', feature: 'strategy-narration' });
  await page.setViewportSize({ width: 320, height: 850 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
