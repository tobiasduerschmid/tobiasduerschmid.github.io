const { loadStory, loadRegistry } = require('../scripts/narration/source');
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');
const { readFileSync } = require('node:fs');
const yaml = require('js-yaml');

const story = loadStory('uml_sequence_diagram');
const lesson = loadRegistry('pattern').uml_sequence_diagram;
const examples = yaml.load(readFileSync(require.resolve('../_data/explainers/uml_sequence_diagram_code.yml'), 'utf8'));
const quizzes = yaml.load(readFileSync(require.resolve('../_data/explainers/uml_sequence_diagram_quizzes.yml'), 'utf8'));
const game = yaml.load(readFileSync(require.resolve('../_data/explainers/uml_sequence_diagram_ui.yml'), 'utf8'));
const timing = require('../_data/explainers/uml_sequence_diagram_timing.json');
const url = '/SEBook/uml_sequence_diagram.html';
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

// WEBrick may answer a conditional MP3 range request with 304 instead of the
// bytes Chromium needs after seeking; drop validators from range requests.
async function serveAudioRanges(page) {
  await page.route('**/assets/audio/uml-sequence-diagram.mp3', route => {
    const headers = { ...route.request().headers() };
    if (headers.range) {
      delete headers['if-none-match'];
      delete headers['if-modified-since'];
    }
    return route.continue({ headers });
  });
}

// The scan panel's text alternative, built from the same numbers it shows.
function panelLabel(state) {
  const panel = game.panels[state];
  const scenario = game.scenarios[panel.scenario];
  const capitalized = name => name[0].toUpperCase() + name.slice(1);
  const probe = `Probe: level ${game.probe.level}; each scan covers ${game.probe.power} points${panel.after ? `; ${scenario.probe_crystals_after} crystals` : ''}.`;
  const rocks = scenario.rocks.map(rock => {
    const scanned = panel.after ? rock.size - rock.unscanned_after : 0;
    let status = '';
    if (panel.after && rock.unscanned_after === 0) status = `, sample of ${rock.crystals} crystals collected`;
    else if (panel.after && rock.tagged_after > 0) status = `, tagged for ${rock.tagged_after} passes`;
    return ` ${capitalized(rock.name)}: scanned ${scanned} of ${rock.size}${status}.`;
  }).join('');
  const outcome = panel.after
    ? ` Sounds queued: ${scenario.sounds_after.join(', ')}. ${scenario.star_map_after > 0 ? `A star map charting ${scenario.star_map_after} asteroids appeared.` : 'No star map.'}`
    : '';
  return `Scan panel, ${scenario.title.toLowerCase()}, ${panel.after ? 'after' : 'before'} the scan. ${probe}${rocks}${outcome}`;
}

test('code marks follow every cue in all four languages without moving the narration', async ({ page }) => {
  test.setTimeout(180000);
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
        // The window shows the line the cue is about: the block's scroll line for a focus taller than it, else the first mark.
        const shown = (examples[language].blocks[scene.code].scroll || {})[cue.focus] || marked[0];
        if (shown) {
          await expect.poll(() => code.evaluate((pre, line) => {
            const target = pre.querySelector(`[data-line="${line}"]`).getBoundingClientRect();
            const view = pre.getBoundingClientRect();
            return target.top >= view.top && target.bottom <= view.bottom;
          }, shown), `${language}/${scene.id}/${cueIndex}: line ${shown} is in view`).toBe(true);
        }
      }
    }
  }
  expect(errors).toEqual([]);
});

test('each scene names its part of a sequence diagram', async ({ page }) => {
  await page.goto(url);
  const animation = player(page);
  for (const [index, scene] of story.scenes.entries()) {
    await seek(page, timing.scenes[index].start + 0.5);
    const parts = animation.locator('.nja-scene:visible').getByRole('list', { name: lesson.parts_label, exact: true });
    await expect(parts.getByRole('listitem')).toHaveText(lesson.parts);
    await expect(parts.locator('[aria-current="step"]')).toHaveText(scene.part ? [scene.part] : []);
  }
});

// The message labels of a diagram's first `count` steps, or of the whole source.
function messages(diagram, count) {
  const text = diagram.steps ? diagram.steps.slice(0, count).join('') : diagram.source;
  return [...text.matchAll(/-> \w+: (.+)$/gm)].map(match => match[1]);
}

test('each cue shows its diagram, highlights the lifeline or class it names, and reveals one step at a time', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(url);
  const animation = player(page);
  for (const [index, scene] of story.scenes.entries()) {
    if (!scene.diagram) continue;
    for (const [cueIndex, cue] of scene.cues.entries()) {
      const source = story.diagrams[cue.diagram || scene.diagram];
      await seek(page, timing.scenes[index].cues[cueIndex].start + 0.5);
      const diagram = animation.getByRole('region', { name: source.label, exact: true });
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
      if (source.steps) {
        // Each step adds its messages; later messages stay hidden until their cue.
        const all = new Set(messages(source, source.steps.length));
        const shown = await diagram.locator('svg text').evaluateAll((nodes, labels) => nodes
          .map(node => node.textContent.trim()).filter(text => labels.includes(text)), [...all]);
        expect(shown.sort(), `${scene.id}/${cue.id}`).toEqual(messages(source, cue.diagram_steps ?? source.steps.length).sort());
      }
    }
  }
});

test('the scan panel and the call stack show the moment each cue describes', async ({ page }) => {
  await page.goto(url);
  const animation = player(page);
  for (const scene of story.scenes.filter(candidate => candidate.panel || candidate.stack)) {
    for (const [cueIndex, cue] of scene.cues.entries()) {
      await seek(page, cueMiddle(scene.id, cueIndex));
      const stage = animation.locator('.nja-scene:visible');
      if (cue.panel_state) {
        await expect(stage.getByRole('img', { name: panelLabel(cue.panel_state), exact: true })).toBeVisible();
      }
      if (cue.frames) {
        // The ArchUML stack draws the frames top first, each as its call above its object; its note marks the running frame.
        const lines = cue.frames.flatMap(frame => [frame.call, `on ${frame.on}`]);
        const stack = stage.locator('.sd-stack-diagram svg');
        await expect(stack).toBeVisible();
        const placed = await stack.locator('text').evaluateAll((nodes, labels) => nodes
          .filter(node => labels.includes(node.textContent.trim()))
          .map(node => {
            const box = node.getBoundingClientRect();
            return { label: node.textContent.trim(), top: box.top, bottom: box.bottom };
          })
          .sort((above, below) => above.top - below.top), lines);
        expect(placed.map(entry => entry.label), `${scene.id}/${cue.id}`).toEqual(lines);
        // Frames side by side would interleave their lines; a stack puts each line wholly below the one above it.
        for (const [index, entry] of placed.slice(1).entries()) {
          expect(entry.top, `${scene.id}/${cue.id}: ${entry.label} sits below ${placed[index].label}`).toBeGreaterThanOrEqual(placed[index].bottom);
        }
        await expect(stack.locator('text', { hasText: 'running now' })).toHaveCount(1);
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
    const lastWord = timing.scenes[index].cues.at(-1).speech_end;
    await seek(page, end - 0.9);
    await page.evaluate(() => { window.pausedAt = null; });
    await animation.getByRole('button', { name: 'Play narration' }).click();
    const questions = questionsOf(scene.id);
    const kind = questions.length > 1 ? 'Summary quiz' : 'Knowledge check';
    const quiz = animation.getByRole('region', { name: `${index + 1}. ${scene.label} — ${kind}`, exact: true });
    await expect(quiz).toBeVisible();
    const pausedAt = await page.evaluate(() => window.pausedAt);
    expect(pausedAt, `${scene.id}: stops before the next section's speech`).toBeLessThan(end - 0.1);
    expect(pausedAt - lastWord, `${scene.id}: at least two seconds to look after the last word`).toBeGreaterThanOrEqual(2);
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

// These checkpoints audit the player's states. The collapsed transcript repeats
// every step's code in four languages; the reader test and the page audit cover it.
for (const dark of [false, true]) {
  test(`player and quiz are readable and accessible in ${dark ? 'dark' : 'light'} mode, including mobile`, async ({ page }, testInfo) => {
    // Twelve audited states take about two minutes, which leaves the default no headroom.
    test.setTimeout(240000);
    await page.setViewportSize({ width: 1500, height: 1000 });
    await page.goto(url);
    await theme(page, dark);
    const animation = player(page);
    for (const [id, cue] of [['intro', 0], ['lifelines', 1], ['calls', 4], ['activations', 1], ['choices', 3], ['runs', 1], ['practice', 0], ['transfer', 1]]) {
      await seek(page, cueMiddle(id, cue));
      await a11yCheckpoint(page, `${id} ${dark ? 'dark' : 'light'}`, { include: '#uml_sequence_diagram-animation .nja-player', feature: 'uml-sequence-diagram-narration' });
      await animation.locator('.nja-player').screenshot({ path: testInfo.outputPath(`${id}.png`) });
    }
    await page.setViewportSize({ width: 320, height: 850 });
    for (const id of ['calls', 'activations', 'runs']) {
      await seek(page, cueMiddle(id, 1));
      await expect.poll(() => animation.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      if (id === 'activations') {
        // The call stack fits its column, like the lesson's diagrams, so no frame is hidden behind a scroll.
        const overhang = await animation.locator('.nja-scene:visible .sd-stack-diagram').evaluate(element => {
          const box = element.getBoundingClientRect();
          const picture = element.querySelector('svg').getBoundingClientRect();
          return Math.max(box.left - picture.left, picture.right - box.right);
        });
        expect(overhang).toBeLessThanOrEqual(1);
      }
      await a11yCheckpoint(page, `mobile ${id}`, { include: '#uml_sequence_diagram-animation .nja-player', feature: 'uml-sequence-diagram-narration' });
    }
    await animation.getByRole('button', { name: 'Knowledge check', exact: true }).click();
    const question = questionsOf('runs')[0];
    const wrong = Number(Object.keys(question.option_feedback)[0]);
    await animation.locator('.np-quiz').getByRole('radio').filter({ hasText: question.options[wrong] }).click();
    await expect(animation.getByText(question.option_feedback[wrong], { exact: true })).toBeVisible();
    await a11yCheckpoint(page, 'mobile incorrect answer', { include: '#uml_sequence_diagram-animation .nja-player', feature: 'uml-sequence-diagram-narration' });
    await animation.locator('.nja-player').screenshot({ path: testInfo.outputPath('quiz-mobile.png') });
  });
}

test('reading and print views include every step, diagram, and question without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const questions = story.scenes.reduce((count, scene) => count + questionsOf(scene.id).length, 0);
  for (const view of ['read', 'print']) {
    await page.goto(`/SEBook/uml_sequence_diagram/${view}/`);
    await expect(page.locator('audio')).toHaveCount(0);
    await expect(page.locator('.np-reading-step')).toHaveCount(story.scenes.reduce((count, scene) => count + scene.cues.length, 0));
    for (const scene of story.scenes) {
      for (const [index, cue] of scene.cues.entries()) {
        const step = page.locator(`[data-reading-scene="${scene.id}"][data-reading-cue="${index}"]`);
        await expect(step.getByText(cue.text, { exact: true })).toBeVisible();
        // The call stack is a second diagram box; the step's own diagram sits in the diagram column.
        if (scene.diagram) await expect(step.locator('.np-diagram-column .np-diagram svg')).toBeVisible();
        if (cue.panel_state) await expect(step.getByRole('img', { name: panelLabel(cue.panel_state), exact: true })).toBeVisible();
        if (cue.frames) await expect(step.locator('.sd-stack-diagram svg')).toBeVisible();
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
  await player(page).getByRole('combobox', { name: 'Code language' }).selectOption('cpp');
  await theme(page, true);
  await player(page).getByRole('link', { name: 'Read at my own pace', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Code language' })).toHaveValue('cpp');
  await expect(page.locator('[data-transcript-language="python"]:visible')).toHaveCount(0);
  await a11yCheckpoint(page, 'sequence diagram reader dark', { include: '#main-content', feature: 'uml-sequence-diagram-narration' });
  await page.getByRole('button', { name: 'Dark mode' }).click();
  await a11yCheckpoint(page, 'sequence diagram reader light', { include: '#main-content', feature: 'uml-sequence-diagram-narration' });
  await page.setViewportSize({ width: 320, height: 850 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
