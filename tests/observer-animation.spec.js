const { loadStory } = require('../scripts/narration/source');
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');
const { readFileSync } = require('node:fs');
const yaml = require('js-yaml');
const story = loadStory('observer');
const examples = yaml.load(readFileSync(require.resolve('../_data/explainers/observer_code.yml'), 'utf8'));
const quizzes = yaml.load(readFileSync(require.resolve('../_data/explainers/observer_quizzes.yml'), 'utf8'));
const timing = require('../_data/explainers/observer_timing.json');
const url = '/SEBook/designpatterns/observer.html';
const sceneIndex = id => story.scenes.findIndex(scene => scene.id === id);
// Each section ends in one question; the summary section lists several.
const questionsOf = id => quizzes[id].questions || [quizzes[id]];
const singleChecks = story.scenes.filter(scene => !quizzes[scene.id].questions).length;
const player = page => page.getByRole('region', { name: story.title, exact: true });
async function seek(page, time) {
  const animation = player(page);
  await animation.getByRole('slider', { name: 'Animation position' }).fill(String(Number(time.toFixed(2))));
  await expect.poll(() => animation.locator('audio').evaluate(audio => audio.currentTime)).toBeCloseTo(time, 1);
}
async function theme(page, dark) {
  const toggle = page.getByRole('checkbox', { name: 'Toggle dark mode' });
  if (await toggle.isChecked() !== dark) await toggle.press('Space');
}

function contrastRatio(foreground, background) {
  const luminance = color => {
    const channels = color.match(/[\d.]+/g).slice(0, 3).map(value => {
      const s = Number(value) / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('language changes preserve the narration and highlight the corresponding code in all four languages', async ({ page }) => {
  test.setTimeout(120000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  const animation = player(page);
  await expect(animation.getByRole('button', { name: 'Play narration' })).toBeVisible();
  for (const [index, scene] of story.scenes.entries()) {
    if (scene.diagram) {
      for (const [cueIndex, cue] of scene.cues.entries()) {
        await seek(page, timing.scenes[index].cues[cueIndex].start + 1);
        await expect(animation.getByRole('region', { name: story.diagrams[scene.diagram].label }).locator('svg')).toBeVisible();
        const diagram = animation.getByRole('region', { name: story.diagrams[scene.diagram].label });
        const label = diagram.getByText(cue.diagram_focus, { exact: true });
        await expect(label).toBeVisible();
        // The texture must actually cover the discussed class's label, not just exist elsewhere.
        expect(await label.evaluate(text => {
          const box = text.getBBox();
          const x = box.x + box.width / 2, y = box.y + box.height / 2;
          return [...text.closest('svg').querySelectorAll('rect[fill^="url("]')].some(rect => {
            const area = rect.getBBox();
            return x >= area.x && x <= area.x + area.width && y >= area.y && y <= area.y + area.height;
          });
        }), `${scene.id}: ${cue.diagram_focus} is highlighted`).toBe(true);
        await expect(animation.getByRole('region', { name: 'Narration', exact: true })).toHaveText(cue.text);
      }
    }
    if (!scene.code) continue;
    for (const [cueIndex, cue] of scene.cues.entries()) {
      const time = (timing.scenes[index].cues[cueIndex].start + timing.scenes[index].cues[cueIndex].end) / 2;
      await seek(page, time);
      for (const language of story.languages) {
        await animation.getByRole('combobox', { name: 'Code language' }).selectOption(language);
        await expect(animation.getByRole('region', { name: 'Narration', exact: true })).toHaveText(cue.text);
        await expect(animation.getByRole('slider')).toHaveValue(String(Number(time.toFixed(2))));
        const code = animation.locator('.nja-stage pre:visible');
        await expect(code).toHaveAttribute('aria-label', `${examples[language].filename} code`);
        const marked = await code.locator('[aria-current="true"]').evaluateAll(lines => lines.map(line => Number(line.dataset.line)));
        expect(marked).toEqual(examples[language].blocks[scene.code].focus[cue.focus] || []);
        expect(await code.locator('.nja-line-source').allTextContents()).toEqual(examples[language].blocks[scene.code].source.trimEnd().split('\n'));
        if (marked.length) {
          const visibleFocus = await code.evaluate(element => {
            const container = element.getBoundingClientRect();
            const line = element.querySelector('[aria-current="true"]').getBoundingClientRect();
            return line.bottom > container.top && line.top < container.bottom;
          });
          expect(visibleFocus, `${language}/${scene.id}/${cue.focus}: focus is scrolled into view`).toBe(true);
        }
      }
    }
  }
  expect(errors).toEqual([]);
});

test('each section ends in exactly one tutorial question and resumes only when requested', async ({ page }) => {
  test.setTimeout(120000);
  // WEBrick may answer a conditional MP3 range request with 304 instead of
  // the bytes Chromium needs after seeking. Keep the real narration while
  // removing cache validators from these range requests.
  await page.route('**/assets/audio/observer-pattern.mp3', route => {
    const headers = { ...route.request().headers() };
    if (headers.range) {
      delete headers['if-none-match'];
      delete headers['if-modified-since'];
    }
    return route.continue({ headers });
  });
  await page.goto(url);
  const animation = player(page);
  for (const [index, scene] of story.scenes.entries()) {
    await seek(page, timing.scenes[index].end - 0.2);
    await animation.getByRole('button', { name: 'Play narration' }).click();
    const questions = questionsOf(scene.id);
    const kind = questions.length > 1 ? 'Summary quiz' : 'Knowledge check';
    const quiz = animation.getByRole('region', { name: `${index + 1}. ${scene.label} — ${kind}`, exact: true });
    await expect(quiz).toBeVisible();
    expect(await animation.locator('audio').evaluate(audio => audio.paused)).toBe(true);
    for (const question of questions) {
      await expect(quiz.getByText(question.question, { exact: true })).toBeVisible();
      await expect(quiz.locator('.quiz-question-card:visible')).toHaveCount(1);
      await expect(quiz.locator('.quiz-question-card:visible').getByRole('radio')).toHaveCount(question.options.length);
      await quiz.getByRole('radio').filter({ hasText: question.options[question.correct_index] }).click();
      await expect(quiz.getByText(question.explanation, { exact: true })).toBeVisible();
      if (question !== questions.at(-1)) await quiz.getByRole('button', { name: 'Next Question' }).click();
    }
    expect(await animation.locator('audio').evaluate(audio => audio.paused)).toBe(true);
    await quiz.getByRole('button', { name: 'See Results' }).click();
    await quiz.getByRole('button', { name: index + 1 < story.scenes.length ? 'Continue narration' : 'Finish review' }).click();
    await expect(quiz).toBeHidden();
    if (index + 1 < story.scenes.length) {
      await expect(animation.getByRole('button', { name: 'Pause narration' })).toBeVisible();
      await animation.getByRole('button', { name: 'Pause narration' }).click();
      await expect(animation.getByRole('button', { name: 'Play narration' })).toBeEnabled();
      await expect(animation.getByRole('heading', { name: story.scenes[index + 1].title, exact: true })).toBeVisible();
    } else {
      await expect(animation.getByText('Narration and final knowledge check finished. Revisit any section to review.')).toBeVisible();
    }
  }
});

for (const dark of [false, true]) {
  test(`diagram, code and quiz are readable in ${dark ? 'dark' : 'light'} mode, including mobile`, async ({ page }, testInfo) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto(url);
    await theme(page, dark);
    const animation = player(page);
    // Wait for the site's theme transition and verify a light/dark surface,
    // without requiring a particular shade in future palette refinements.
    const brightness = () => animation.locator('.nja-player').evaluate(element => {
      const channels = getComputedStyle(element).backgroundColor.match(/[\d.]+/g).slice(0, 3).map(Number);
      return channels.reduce((sum, value) => sum + value, 0) / 3;
    });
    if (dark) await expect.poll(brightness).toBeLessThan(60);
    else await expect.poll(brightness).toBeGreaterThan(220);
    await seek(page, timing.scenes[sceneIndex('conditions')].start + 1);
    const beforeDiagram = animation.getByRole('region', { name: 'Before-design dependencies' });
    await expect(beforeDiagram.locator('svg')).toBeVisible();
    for (const name of ['DocumentBefore', 'Preview', 'CharacterCount', 'SaveButton']) await expect(beforeDiagram.getByText(name, { exact: true })).toBeVisible();
    const references = await beforeDiagram.locator('polyline[data-layout-source]').evaluateAll(arrows => arrows.map(arrow => [arrow.dataset.layoutSource, arrow.dataset.layoutTarget]));
    expect(references.sort()).toEqual([
      ['DocumentBefore', 'CharacterCount'], ['DocumentBefore', 'Preview'], ['DocumentBefore', 'SaveButton'],
    ]);
    await expect(beforeDiagram.getByText('0..1', { exact: true })).toHaveCount(3);
    const codeBounds = await animation.locator('.nja-stage pre:visible').boundingBox();
    const diagramBounds = await beforeDiagram.boundingBox();
    expect(diagramBounds.x).toBeGreaterThanOrEqual(codeBounds.x + codeBounds.width);
    expect(diagramBounds.y).toBeLessThan(codeBounds.y + codeBounds.height);
    expect(await beforeDiagram.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    await expect(animation.locator('.np-diagram-caption:visible')).toContainText('UI widgets and presentation rules tend to change more often than the domain model');
    await a11yCheckpoint(page, 'before dependencies beside code', { include: '#observer-animation', feature: 'observer-animation' });
    await animation.locator('.nja-player').screenshot({ path: testInfo.outputPath('before.png') });
    await seek(page, timing.scenes[sceneIndex('roles')].start + 1);
    const diagram = animation.getByRole('region', { name: 'Observer pattern role diagram' });
    await expect(diagram.locator('svg')).toBeVisible();
    for (const name of ['Subject', 'Observer', 'ConcreteSubject', 'ConcreteObserver']) await expect(diagram.getByText(name, { exact: true })).toBeVisible();
    await a11yCheckpoint(page, 'role diagram', { include: '#observer-animation', feature: 'observer-animation' });
    await animation.locator('.nja-player').screenshot({ path: testInfo.outputPath('roles.png') });
    await seek(page, timing.scenes[sceneIndex('views')].cues[2].start + 1);
    await animation.getByRole('combobox', { name: 'Code language' }).selectOption('typescript');
    const solution = animation.getByRole('region', { name: 'Observer solution dependencies' });
    for (const name of ['Subject', 'Observer', 'Document', 'Preview', 'CharacterCount', 'SaveButton']) await expect(solution.getByText(name, { exact: true })).toBeVisible();
    // ArchUML describes inheritance/realization as well as the direct association.
    await expect(solution.locator('svg')).toHaveAccessibleName(/Document extends Subject/);
    await expect(solution.locator('svg')).toHaveAccessibleName(/Preview implements Observer/);
    await expect(solution.locator('svg')).toHaveAccessibleName(/CharacterCount implements Observer/);
    await expect(solution.locator('svg')).toHaveAccessibleName(/SaveButton implements Observer/);
    await expect(solution.locator('svg')).toHaveAccessibleName(/Subject references Observer/);
    const solutionCodeBounds = await animation.locator('.nja-stage pre:visible').boundingBox();
    const solutionDiagramBounds = await solution.boundingBox();
    expect(solutionDiagramBounds.x).toBeGreaterThanOrEqual(solutionCodeBounds.x + solutionCodeBounds.width);
    expect(solutionDiagramBounds.y).toBeLessThan(solutionCodeBounds.y + solutionCodeBounds.height);
    expect(await solution.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    await a11yCheckpoint(page, 'marked TypeScript code', { include: '#observer-animation', feature: 'observer-animation' });
    await animation.locator('.nja-player').screenshot({ path: testInfo.outputPath('code.png') });
    await page.setViewportSize({ width: 320, height: 850 });
    await seek(page, timing.scenes[sceneIndex('conditions')].start + 1);
    await expect.poll(() => animation.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    await beforeDiagram.focus();
    await beforeDiagram.press('Home');
    const beforeDependencyScroll = await beforeDiagram.evaluate(element => element.scrollLeft);
    await beforeDiagram.press('ArrowRight');
    await expect.poll(() => beforeDiagram.evaluate(element => element.scrollLeft)).toBeGreaterThan(beforeDependencyScroll);
    await a11yCheckpoint(page, 'mobile before dependencies', { include: '#observer-animation', feature: 'observer-animation' });
    await animation.locator('.nja-player').screenshot({ path: testInfo.outputPath('before-mobile.png') });
    await seek(page, timing.scenes[sceneIndex('roles')].start + 1);
    await diagram.focus();
    await diagram.press('Home');
    const beforeScroll = await diagram.evaluate(element => element.scrollLeft);
    await diagram.press('ArrowRight');
    await expect.poll(() => diagram.evaluate(element => element.scrollLeft)).toBeGreaterThan(beforeScroll);
    await a11yCheckpoint(page, 'mobile diagram', { include: '#observer-animation', feature: 'observer-animation' });
    await seek(page, timing.scenes[sceneIndex('views')].cues[2].start + 1);
    await expect.poll(() => animation.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    await a11yCheckpoint(page, 'mobile code', { include: '#observer-animation', feature: 'observer-animation' });
    await animation.getByRole('button', { name: 'Knowledge check', exact: true }).click();
    const quiz = animation.locator('.np-quiz');
    const disabledPlay = animation.getByRole('button', { name: 'Play narration' });
    await expect(disabledPlay).toBeDisabled();
    await disabledPlay.hover();
    await expect.poll(async () => {
      const colors = await disabledPlay.evaluate(button => [
        getComputedStyle(button.querySelector('i')).color, getComputedStyle(button).backgroundColor,
      ]);
      return contrastRatio(...colors);
    }, { message: 'The disabled Play icon remains legible, including on hover.' }).toBeGreaterThanOrEqual(4.5);
    await quiz.getByRole('radio').filter({ hasText: quizzes.views.options[0] }).click();
    await expect(quiz.getByText(quizzes.views.option_feedback[0], { exact: true })).toBeVisible();
    await a11yCheckpoint(page, 'mobile incorrect quiz answer', { include: '#observer-animation', feature: 'observer-animation' });
    await animation.locator('.nja-player').screenshot({ path: testInfo.outputPath('quiz-mobile.png') });
    await quiz.getByRole('button', { name: 'See Results' }).click();
    await quiz.getByRole('button', { name: 'Try Again', exact: true }).click();
    const correct = quiz.getByRole('radio').filter({ hasText: quizzes.views.options[2] });
    await correct.focus();
    await correct.press('Space');
    await expect(quiz.getByText(quizzes.views.explanation, { exact: true })).toBeVisible();
    await a11yCheckpoint(page, 'mobile correct quiz answer', { include: '#observer-animation', feature: 'observer-animation' });
    await expect.poll(() => animation.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  });
}

test('the edit trace supports reversible seeking and a quiz can be skipped without losing the language', async ({ page }) => {
  await page.goto(url);
  const animation = player(page);
  await animation.getByRole('combobox', { name: 'Code language' }).selectOption('java');
  await seek(page, timing.scenes[sceneIndex('trace')].cues[3].start + 1);
  await expect(animation.getByRole('img', { name: /document Hello, character count 5/ })).toBeVisible();
  await seek(page, timing.scenes[sceneIndex('trace')].cues[0].start + 1);
  await expect(animation.getByRole('img', { name: /document empty, character count 0, Save disabled/ })).toBeVisible();
  await animation.getByRole('button', { name: 'Knowledge check', exact: true }).click();
  await animation.getByRole('button', { name: 'Skip Knowledge Check' }).click();
  await expect(animation.getByRole('combobox', { name: 'Code language' })).toHaveValue('java');
  await expect(animation.getByRole('heading', { name: 'Flexibility has a cost', exact: true })).toBeVisible();
  await animation.getByRole('button', { name: 'Pause narration' }).click();
});

test('previous and next navigate directly past knowledge checks, whether closed or open', async ({ page }) => {
  await page.goto(url);
  const animation = player(page);
  const selection = animation.getByRole('combobox', { name: 'Scene', exact: true });
  const quiz = animation.locator('.np-quiz');
  await animation.getByRole('combobox', { name: 'Code language' }).selectOption('java');
  await seek(page, timing.scenes[3].start + 1);
  for (const openCheck of [false, true]) {
    if (openCheck) await animation.getByRole('button', { name: 'Knowledge check', exact: true }).click();
    await animation.getByRole('button', { name: 'Next scene', exact: true }).click();
    await expect(selection).toHaveValue('4');
    await expect(quiz).toBeHidden();
    await expect(animation.getByRole('heading', { name: story.scenes[4].title, exact: true })).toBeVisible();
    if (openCheck) await animation.getByRole('button', { name: 'Knowledge check', exact: true }).click();
    await animation.getByRole('button', { name: 'Previous scene', exact: true }).click();
    await expect(selection).toHaveValue('3');
    await expect(quiz).toBeHidden();
    await expect(animation.getByRole('heading', { name: story.scenes[3].title, exact: true })).toBeVisible();
    await expect(animation.getByRole('button', { name: 'Play narration' })).toBeEnabled();
  }
  // Skipping during playback preserves playback; only reaching a section's end opens a check.
  await animation.getByRole('button', { name: 'Play narration' }).click();
  await animation.getByRole('button', { name: 'Next scene', exact: true }).click();
  await expect(selection).toHaveValue('4');
  await expect(quiz).toBeHidden();
  await expect(animation.getByRole('button', { name: 'Pause narration' })).toBeVisible();
  await animation.getByRole('button', { name: 'Previous scene', exact: true }).click();
  await expect(selection).toHaveValue('3');
  await expect(quiz).toBeHidden();
  await expect(animation.getByRole('button', { name: 'Pause narration' })).toBeVisible();
  await expect(animation.getByRole('combobox', { name: 'Code language' })).toHaveValue('java');
});

test('all languages and quiz explanations remain available without JavaScript; print uses the chosen language', async ({ browser, page }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const noJS = await context.newPage();
  await noJS.goto(url);
  await player(noJS).getByText('Transcript, code, and visual descriptions', { exact: true }).click();
  for (const example of Object.values(examples)) await expect(player(noJS).getByText(`${example.label} — ${example.filename}`, { exact: true })).toBeVisible();
  await expect(player(noJS).getByText('Knowledge check:', { exact: true })).toHaveCount(singleChecks);
  await context.close();
  await page.goto(url);
  await player(page).getByRole('combobox', { name: 'Code language' }).selectOption('cpp');
  await theme(page, true);
  await page.emulateMedia({ media: 'print' });
  await expect(player(page).getByRole('button', { name: 'Play narration' })).toBeHidden();
  await expect(player(page).getByText('C++ — observer_demo.cpp', { exact: true })).toBeVisible();
  await expect(player(page).getByText('Python — observer_demo.py', { exact: true })).toBeHidden();
  await expect(player(page).getByText(quizzes.ui.explanation, { exact: true })).toBeVisible();
});

test('changing UML emphasis keeps its scale steady through every animation frame', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(url);
  await expect(player(page).getByRole('button', { name: 'Play narration' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  for (const index of ['roles', 'views'].map(sceneIndex)) {
    await seek(page, timing.scenes[index].cues[0].start + 1);
    const sizes = await player(page).evaluate(async (root, nextTime) => {
      const previous = root.querySelector('.nja-scene:not([hidden]) [data-np-diagram] svg').getBoundingClientRect();
      const frames = [[previous.width, previous.height]];
      const slider = root.querySelector('.nja-seek');
      slider.value = String(nextTime);
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      const started = performance.now();
      // Sample the transition, including the renderer's delayed settling interval.
      while (performance.now() - started < 650) {
        const svg = root.querySelector('.nja-scene:not([hidden]) [data-np-diagram] svg');
        const box = svg.getBoundingClientRect();
        frames.push([box.width, box.height]);
        await new Promise(requestAnimationFrame);
      }
      return frames;
    }, timing.scenes[index].cues[1].start + 1);
    for (const dimension of [0, 1]) {
      const values = sizes.map(size => size[dimension]);
      expect(Math.max(...values) - Math.min(...values), 'No transient zoom while changing the highlighted class').toBeLessThan(1);
    }
  }
});

test('self-paced and print HTML include every step and visualization without audio or JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const view of ['read', 'print']) {
    await page.goto(`/SEBook/designpatterns/observer/${view}/`);
    await expect(page.locator('audio')).toHaveCount(0);
    const steps = page.locator('.np-reading-step');
    await expect(steps).toHaveCount(story.scenes.reduce((count, scene) => count + scene.cues.length, 0));
    for (const scene of story.scenes) {
      for (const [index, cue] of scene.cues.entries()) {
        const step = page.locator(`[data-reading-scene="${scene.id}"][data-reading-cue="${index}"]`);
        await expect(step.getByText(cue.text, { exact: true })).toBeVisible();
        if (scene.diagram) await expect(step.locator('.np-diagram svg')).toBeVisible();
        if (scene.code) {
          for (const language of story.languages) {
            const marks = await step.locator(`[data-transcript-language="${language}"] [aria-current="true"]`).evaluateAll(lines => lines.map(line => Number(line.dataset.line)));
            expect(marks).toEqual(examples[language].blocks[scene.code].focus[cue.focus] || []);
          }
        }
        if (scene.ui) await expect(step.getByRole('img', { name: /^Text editor:/ })).toBeVisible();
      }
    }
    await expect(page.getByText('Knowledge check:', { exact: true })).toHaveCount(singleChecks);
    await expect(page.locator('[data-reading-scene="trace"][data-reading-cue="3"]').getByRole('img', { name: /document Hello, character count 5.*detached and retains Hi/ })).toBeVisible();
  }
  await context.close();
});

test('reading and print views preserve the selected language and print all diagrams in light mode', async ({ page }, testInfo) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(url);
  const animation = player(page);
  await animation.getByRole('combobox', { name: 'Code language' }).selectOption('cpp');
  await theme(page, true);
  await animation.getByRole('link', { name: 'Read at my own pace', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Code language' })).toHaveValue('cpp');
  await expect(page.getByRole('button', { name: 'Dark mode' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-transcript-language="python"]:visible')).toHaveCount(0);
  await page.locator('[data-reading-scene="conditions"][data-reading-cue="0"]').screenshot({ path: testInfo.outputPath('reader-dark.png') });
  await a11yCheckpoint(page, 'self-paced dark', { include: '#main-content', feature: 'observer-animation' });
  await page.getByRole('button', { name: 'Dark mode' }).click();
  await a11yCheckpoint(page, 'self-paced light', { include: '#main-content', feature: 'observer-animation' });
  await page.getByRole('combobox', { name: 'Code language' }).selectOption('java');
  await page.setViewportSize({ width: 320, height: 850 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await a11yCheckpoint(page, 'self-paced mobile', { include: '#main-content', feature: 'observer-animation' });
  await page.getByRole('link', { name: 'Print view', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Code language' })).toHaveValue('java');
  await expect(page.locator('html')).not.toHaveClass(/dark-mode/);
  const printPalette = () => page.evaluate(() => ['body', '.nja-editor', '.np-diagram', 'h4', '.np-reading-note'].map(selector => {
    const style = getComputedStyle(document.querySelector(selector));
    return [style.color, style.backgroundColor];
  }));
  const lightPalette = await printPalette();
  await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
  await expect.poll(printPalette, { message: 'The print view stays light regardless of the surrounding theme.' }).toEqual(lightPalette);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('[data-transcript-language="python"]:visible')).toHaveCount(0);
  await expect(page.locator('.np-reading-step')).toHaveCount(story.scenes.reduce((count, scene) => count + scene.cues.length, 0));
  await expect(page.getByText(quizzes.ui.explanation, { exact: true })).toBeVisible();
  await expect(page.locator('.np-diagram svg:visible')).toHaveCount(story.scenes.filter(scene => scene.diagram).reduce((count, scene) => count + scene.cues.length, 0));
  await page.pdf({ path: testInfo.outputPath('observer-lesson.pdf'), format: 'A4', printBackground: true, margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' } });
});

test('view links carry language and theme through a reading, print, and narration round trip', async ({ page }) => {
  await page.goto('/SEBook/designpatterns/observer/read/?language=java&theme=dark');
  await expect(page.getByRole('combobox', { name: 'Code language' })).toHaveValue('java');
  const printLink = page.getByRole('link', { name: 'Print view', exact: true });
  // Use the href as a copied/new-tab link: no click handler should be required.
  await expect(printLink).toHaveAttribute('href', /language=java&theme=dark/);
  await page.goto(await printLink.getAttribute('href'));
  await expect(page.locator('html')).not.toHaveClass(/dark-mode/);
  await page.getByRole('link', { name: 'Reading view', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Dark mode' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('combobox', { name: 'Code language' })).toHaveValue('java');
  await page.getByRole('combobox', { name: 'Code language' }).selectOption('typescript');
  const narratedLink = page.getByRole('link', { name: 'Back to narrated version', exact: true });
  await expect(narratedLink).toHaveAttribute('href', /language=typescript&theme=dark#observer-animation$/);
  await narratedLink.click();
  await expect(player(page).getByRole('combobox', { name: 'Code language' })).toHaveValue('typescript');
  await expect(page.locator('html')).toHaveClass(/dark-mode/);
  await expect(page.getByRole('checkbox', { name: 'Toggle dark mode' })).toBeChecked();
  await seek(page, timing.scenes[sceneIndex('conditions')].start + 1);
  await expect(player(page).locator('.nja-stage pre:visible')).toHaveAttribute('aria-label', `${examples.typescript.filename} code`);
  await theme(page, false);
  await expect(player(page).getByRole('link', { name: 'Read at my own pace', exact: true })).toHaveAttribute('href', /language=typescript&theme=light/);
});

test('compact controls and a collapsible contents list leave room for the lesson', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(url + '#observer-animation');
  const animation = player(page);
  const toolbar = animation.locator('.nja-playback-controls');
  await expect(toolbar).toBeVisible();
  expect((await toolbar.boundingBox()).height, 'Player controls occupy at most a quarter of the viewport').toBeLessThanOrEqual(200);
  await expect(animation.getByRole('combobox', { name: 'Code language' })).toBeInViewport();
  await expect(animation.getByRole('heading', { name: story.scenes[0].title, exact: true })).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('compact-player-light.png') });
  await theme(page, true);
  await page.screenshot({ path: testInfo.outputPath('compact-player-dark.png') });
  await page.goto('/SEBook/designpatterns/observer/read/');
  await expect(page.getByRole('heading', { name: /1\. How a pattern is described/ })).toBeInViewport();
  const contents = page.getByRole('group').filter({ has: page.locator('summary', { hasText: 'Lesson sections' }) });
  await expect(contents.getByRole('link', { name: story.scenes[sceneIndex('consequences')].label, exact: true })).toBeHidden();
  await contents.locator('summary').click();
  await expect(contents.getByRole('link', { name: story.scenes[sceneIndex('consequences')].label, exact: true })).toBeVisible();
});

test('prediction cues defer the takeaway and remain reversible', async ({ page }) => {
  await page.goto(url);
  const animation = player(page);
  for (const id of ['conditions', 'trace', 'transfer']) {
    const sceneIndex = story.scenes.findIndex(scene => scene.id === id);
    const scene = story.scenes[sceneIndex];
    const prediction = scene.cues.findIndex(cue => cue.prediction);
    expect(prediction, `${id} has a prediction prompt before its explanation`).toBeGreaterThanOrEqual(0);
    const takeaway = animation.locator('.nja-stage').getByText(scene.takeaway, { exact: true });
    await seek(page, timing.scenes[sceneIndex].cues[prediction].start + 1);
    await expect(takeaway).toBeHidden();
    await expect(animation.getByRole('region', { name: 'Narration', exact: true })).toHaveText(scene.cues[prediction].text);
    await seek(page, timing.scenes[sceneIndex].cues[prediction + 1].start + 1);
    await expect(takeaway).toBeVisible();
    await seek(page, timing.scenes[sceneIndex].cues[prediction].start + 1);
    await expect(takeaway).toBeHidden();
  }
});
