const { loadStory, loadLesson } = require('../scripts/narration/source');
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');
const { readFileSync } = require('node:fs');
const yaml = require('js-yaml');

const topic = 'uml_class_diagram';
const story = loadStory(topic);
const { lesson } = loadLesson(topic);
const examples = yaml.load(readFileSync(require.resolve(`../_data/explainers/${topic}_code.yml`), 'utf8'));
const quizzes = yaml.load(readFileSync(require.resolve(`../_data/explainers/${topic}_quizzes.yml`), 'utf8'));
const timing = require(`../_data/explainers/${topic}_timing.json`);
const url = '/SEBook/uml_class_diagram.html';
const player = page => page.getByRole('region', { name: story.title, exact: true });
const sceneIndex = id => story.scenes.findIndex(scene => scene.id === id);
const questionsOf = id => quizzes[id].questions || [quizzes[id]];
const cueMiddle = (id, cue) => {
  const cueTiming = timing.scenes[sceneIndex(id)].cues[cue];
  return (cueTiming.start + cueTiming.end) / 2;
};
// Callouts wrap onto several SVG text lines, so compare without whitespace.
const squeeze = text => text.replace(/\s+/g, '');
const calloutsOf = diagram => [...diagram.source.matchAll(/^callout .+? : (.+)$/gm)].map(match => match[1]);

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
  await page.route('**/assets/audio/uml-class-diagram.mp3', route => {
    const headers = { ...route.request().headers() };
    if (headers.range) {
      delete headers['if-none-match'];
      delete headers['if-modified-since'];
    }
    return route.continue({ headers });
  });
}

// The default viewport stacks the code above the diagram; laptop widths put
// them side by side, where long lines wrap and fewer lines fit the window.
for (const viewport of [{ width: 1280, height: 720 }, { width: 1440, height: 900 }]) {
  test(`code marks follow every cue in all four languages without moving the narration at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    test.setTimeout(120000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize(viewport);
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
          const block = examples[language].blocks[scene.code];
          const marked = await code.locator('[aria-current="true"]').evaluateAll(lines => lines.map(line => Number(line.dataset.line)));
          expect(marked, `${language}/${scene.id}/${cueIndex}`).toEqual(block.focus[cue.focus] || []);
          // The window shows every marked line or, when they cannot all fit, the
          // line the block names for this cue.
          const shown = await code.evaluate((pre, keyLine) => {
            const view = pre.getBoundingClientRect();
            const visible = line => {
              const box = line.getBoundingClientRect();
              return box.top >= view.top - 1 && box.bottom <= view.bottom + 1;
            };
            if ([...pre.querySelectorAll('[aria-current="true"]')].every(visible)) return 'every mark';
            const key = keyLine && pre.querySelector(`[data-line="${keyLine}"]`);
            return key && visible(key) ? 'key line' : 'discussed code hidden';
          }, Object.hasOwn(block.scroll || {}, cue.focus) ? block.scroll[cue.focus] : null);
          expect(shown, `${language}/${scene.id}/${cueIndex}`).not.toBe('discussed code hidden');
        }
      }
    }
    expect(errors).toEqual([]);
  });
}

test('each scene shows the class-diagram roadmap and marks only its own part', async ({ page }) => {
  await page.goto(url);
  const animation = player(page);
  for (const [index, scene] of story.scenes.entries()) {
    await seek(page, timing.scenes[index].start + 0.5);
    const parts = animation.locator('.nja-scene:visible').getByRole('list', { name: lesson.parts_label, exact: true });
    await expect(parts.getByRole('listitem')).toHaveText(lesson.parts);
    await expect(parts.locator('[aria-current="step"]')).toHaveText(scene.part ? [scene.part] : []);
  }
});

test('every cue shows its own diagram, callouts, and highlighted class', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(url);
  const animation = player(page);
  for (const [index, scene] of story.scenes.entries()) {
    if (!scene.diagram) continue;
    for (const [cueIndex, cue] of scene.cues.entries()) {
      await seek(page, timing.scenes[index].cues[cueIndex].start + 0.5);
      const diagram = story.diagrams[cue.diagram || scene.diagram];
      const region = animation.locator('.nja-scene:visible [data-np-diagram]');
      await expect(region).toHaveAttribute('aria-label', diagram.label);
      const svg = region.locator('svg');
      await expect(svg).toBeVisible();
      const text = squeeze(await svg.evaluate(node => node.textContent));
      for (const callout of calloutsOf(diagram)) expect(text, `${scene.id}/${cue.id}`).toContain(squeeze(callout));
      if (cue.diagram_focus) {
        const label = svg.locator('text').filter({ hasText: new RegExp(`^${cue.diagram_focus}$`) }).first();
        await expect(label).toBeVisible();
        // The texture must cover the discussed class's label, not just exist elsewhere.
        expect(await label.evaluate(node => {
          const box = node.getBBox();
          const x = box.x + box.width / 2, y = box.y + box.height / 2;
          return [...node.closest('svg').querySelectorAll('[fill^="url("]')].some(shape => {
            const area = shape.getBBox();
            return x >= area.x && x <= area.x + area.width && y >= area.y && y <= area.y + area.height;
          });
        }), `${scene.id}/${cue.id}: ${cue.diagram_focus} is highlighted`).toBe(true);
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

// These checkpoints audit the player's states. The collapsed transcript repeats
// every step's code in four languages; the reader test and the page audit cover it.
for (const dark of [false, true]) {
  test(`player and quiz are readable and accessible in ${dark ? 'dark' : 'light'} mode, including mobile`, async ({ page }, testInfo) => {
    // Each checkpoint audits a page that carries the whole transcript; allow for a loaded machine.
    test.setTimeout(300000);
    await page.setViewportSize({ width: 1500, height: 1000 });
    await page.goto(url);
    await theme(page, dark);
    const animation = player(page);
    const include = `#${topic}-animation .nja-player`;
    for (const [id, cue] of [['intro', 1], ['class_box', 2], ['generalization', 2], ['multiplicity', 3], ['composition', 3], ['reading', 1]]) {
      await seek(page, cueMiddle(id, cue));
      await a11yCheckpoint(page, `${id} ${dark ? 'dark' : 'light'}`, { include, feature: 'uml-class-diagram-narration' });
      await animation.locator('.nja-player').screenshot({ path: testInfo.outputPath(`${id}.png`) });
    }
    await page.setViewportSize({ width: 320, height: 850 });
    for (const id of ['visibility', 'aggregation']) {
      await seek(page, cueMiddle(id, 0));
      await expect.poll(() => animation.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      await a11yCheckpoint(page, `mobile ${id}`, { include, feature: 'uml-class-diagram-narration' });
    }
    await animation.getByRole('button', { name: 'Knowledge check', exact: true }).click();
    const question = questionsOf('aggregation')[0];
    const wrong = Number(Object.keys(question.option_feedback)[0]);
    await animation.locator('.np-quiz').getByRole('radio').filter({ hasText: question.options[wrong] }).click();
    await expect(animation.getByText(question.option_feedback[wrong], { exact: true })).toBeVisible();
    await a11yCheckpoint(page, 'mobile incorrect answer', { include, feature: 'uml-class-diagram-narration' });
    await animation.locator('.nja-player').screenshot({ path: testInfo.outputPath('quiz-mobile.png') });
  });
}

test('reading and print views include every step, diagram, and question without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const questions = story.scenes.reduce((count, scene) => count + questionsOf(scene.id).length, 0);
  for (const view of ['read', 'print']) {
    await page.goto(`/SEBook/uml_class_diagram/${view}/`);
    await expect(page.locator('audio')).toHaveCount(0);
    await expect(page.locator('.np-reading-step')).toHaveCount(story.scenes.reduce((count, scene) => count + scene.cues.length, 0));
    for (const scene of story.scenes) {
      const section = page.locator(`#${topic}-reading-${scene.id}`);
      const parts = section.getByRole('list', { name: lesson.parts_label, exact: true });
      if (scene.part) await expect(parts.locator('[aria-current="step"]')).toHaveText(scene.part);
      else await expect(parts).toHaveCount(0);
      for (const [index, cue] of scene.cues.entries()) {
        const step = page.locator(`[data-reading-scene="${scene.id}"][data-reading-cue="${index}"]`);
        await expect(step.getByText(cue.text, { exact: true })).toBeVisible();
        if (scene.diagram) await expect(step.locator('.np-diagram svg')).toBeVisible();
      }
    }
    await expect(page.locator('.np-print-question')).toHaveCount(questions);
    await expect(page.getByText('Summary quiz:', { exact: true })).toHaveCount(questionsOf('summary').length);
  }
  await context.close();
});

test('reading view keeps the chosen language and theme and is accessible', async ({ page }) => {
  // The reader is every step in four languages; auditing it twice takes longer than the default.
  test.setTimeout(300000);
  await page.goto(url);
  await player(page).getByRole('combobox', { name: 'Code language' }).selectOption('cpp');
  await theme(page, true);
  await player(page).getByRole('link', { name: 'Read at my own pace', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Code language' })).toHaveValue('cpp');
  await expect(page.locator('[data-transcript-language="python"]:visible')).toHaveCount(0);
  await a11yCheckpoint(page, 'uml class diagram reader dark', { include: '#main-content', feature: 'uml-class-diagram-narration' });
  await page.getByRole('button', { name: 'Dark mode' }).click();
  await a11yCheckpoint(page, 'uml class diagram reader light', { include: '#main-content', feature: 'uml-class-diagram-narration' });
  await page.setViewportSize({ width: 320, height: 850 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
