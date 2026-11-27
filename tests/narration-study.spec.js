const { test, expect } = require('@playwright/test');
const { readFileSync } = require('node:fs');
const yaml = require('js-yaml');
const { a11yCheckpoint } = require('./a11y-helpers');
const { loadLesson } = require('../scripts/narration/source');

const observer = loadLesson('observer');
async function openStudy(page, topic = 'observer') {
  const lesson = loadLesson(topic);
  await page.goto(lesson.lesson.chapter);
  const player = page.getByRole('region', { name: lesson.story.title, exact: true });
  await player.getByText('Study tools', { exact: true }).click();
  await expect(player.getByRole('heading', { name: 'Explore this lesson' })).toBeVisible();
  return player;
}

test('a summary question reviews its original teaching cue and returns with its answer retained', async ({ page }) => {
  await page.goto(observer.lesson.chapter);
  const player = page.getByRole('region', { name: observer.story.title, exact: true });
  const original = yaml.load(readFileSync('_data/explainers/observer_quizzes.yml', 'utf8')).summary.questions[0];
  const reference = observer.study.reviews.summary[0];
  const scene = observer.story.scenes.find(scene => scene.id === reference.scene);
  const cue = scene.cues.find(cue => cue.id === reference.cue);
  await player.getByRole('button', { name: 'Player settings', exact: true }).click();
  await player.getByRole('combobox', { name: 'Scene', exact: true }).selectOption(String(observer.story.scenes.length - 1));
  await player.getByRole('button', { name: 'Knowledge check', exact: true }).click();
  const check = player.getByRole('region', { name: /— Summary quiz$/ });
  const wrong = original.options.find((_, index) => index !== original.correct_index);
  await check.getByRole('radio').filter({ hasText: wrong }).click();
  await check.getByRole('button', { name: 'Review this explanation', exact: true }).click();
  await expect(player.getByRole('region', { name: 'Scene', exact: true }).getByText(cue.note, { exact: true })).toBeVisible();
  await expect(player.getByRole('button', { name: 'Play narration', exact: true })).toBeVisible();
  await player.getByRole('button', { name: 'Return to question', exact: true }).click();
  await expect(check.getByRole('radio').filter({ hasText: wrong })).toBeChecked();
  await check.getByRole('button', { name: 'Try a similar question', exact: true }).click();
  const practice = player.getByRole('region', { name: /— Similar question$/ });
  await expect(practice.getByText(reference.retry.question, { exact: true })).toBeVisible();
  await practice.getByRole('radio').filter({ hasText: reference.retry.options[reference.retry.correct_index] }).click();
  await expect(practice.getByRole('status')).toContainText('original answer and score are unchanged');
  await a11yCheckpoint(page, 'narration-study-reattempt', { include: '#observer-animation' });
  await practice.getByRole('button', { name: 'Return to question', exact: true }).click();
  await expect(check.getByRole('radio').filter({ hasText: wrong })).toBeChecked();
});

test('search finds explanation text, preserves review marks, and jumps while paused', async ({ page }) => {
  const player = await openStudy(page);
  const review = player.getByRole('region', { name: 'Search and review', exact: true });
  await review.getByRole('searchbox').fill('notification');
  await expect(review.getByRole('button', { name: /Review later:/ }).first()).toBeVisible();
  const title = await review.getByRole('button', { name: /Review later:/ }).first().getAttribute('aria-label');
  await review.getByRole('button', { name: title, exact: true }).press('Space');
  await review.getByLabel('Only steps marked for review').check();
  await expect(review.getByRole('button', { name: /Remove review mark:/ })).toHaveCount(1);
  await review.getByRole('searchbox').fill('no-such-concept');
  await expect(review.getByRole('status')).toContainText('No matching steps');
  await review.getByRole('searchbox').fill('');
  await a11yCheckpoint(page, 'narration-study-search', { include: '#observer-animation' });
  await review.getByRole('button', { name: title.replace('Review later: ', ''), exact: true }).click();
  await expect(player.getByRole('heading', { name: 'Explore this lesson' })).toBeHidden();
  await expect(player.getByRole('button', { name: 'Play narration', exact: true })).toBeVisible();
  await expect(player.getByRole('status').filter({ hasText: 'Narration paused.' })).toBeVisible();
});

test('exercise drafts preview actual edits and survive switching activities', async ({ page }) => {
  const player = await openStudy(page);
  await player.getByLabel('Study activity').selectOption('practice');
  const practice = player.getByRole('region', { name: 'Try this example', exact: true });
  const source = practice.getByLabel('Your diagram source');
  const exercise = observer.study.exercises[0];
  await expect(source).toHaveValue(exercise.starter);
  await source.fill('@startuml\nclass StudentDraft\n@enduml');
  await expect(practice.getByRole('region', { name: 'Your diagram preview', includeHidden: true })).toBeHidden();
  await practice.getByRole('button', { name: 'Preview my diagram' }).click();
  await expect(practice.getByRole('region', { name: 'Your diagram preview' })).toContainText('StudentDraft');
  await player.getByLabel('Study activity').selectOption('review');
  await player.getByLabel('Study activity').selectOption('practice');
  await expect(source).toHaveValue('@startuml\nclass StudentDraft\n@enduml');
  await source.fill('');
  await practice.getByRole('button', { name: 'Preview my diagram' }).click();
  await expect(practice.getByRole('status')).toContainText('Enter diagram source');
  await practice.getByRole('button', { name: 'Reset to starter' }).click();
  await expect(source).toHaveValue(exercise.starter);
  await practice.getByText('Show worked solution and self-check', { exact: true }).click();
  await expect(practice.getByRole('checkbox')).toHaveCount(exercise.checks.length);
  await a11yCheckpoint(page, 'narration-study-exercise', { include: '#observer-animation' });
});

test('video search returns keyboard focus to the chosen scene', async ({ page }) => {
  const lesson = loadLesson('scrum');
  const scene = lesson.story.scenes.at(-1);
  const cue = scene.cues.at(-1);
  const player = await openStudy(page, 'scrum');
  await player.getByRole('button', { name: `${scene.label} · ${cue.step}`, exact: true }).press('Enter');
  await expect(player.getByRole('heading', { name: scene.title, exact: true })).toBeFocused();
  await expect(player.getByRole('button', { name: 'Play narration', exact: true })).toBeVisible();
});

test('inspection links named elements and code with their explanation in the selected language', async ({ page }) => {
  const player = await openStudy(page);
  await player.getByLabel('Study activity').selectOption('inspect');
  const inspect = player.getByRole('region', { name: 'Inspect diagram and code', exact: true });
  await inspect.getByLabel('Inspect a scene').selectOption('subject');
  const cue = observer.story.scenes.find(scene => scene.id === 'subject').cues[1];
  const target = inspect.getByRole('group', { name: 'Explanations to inspect' }).getByRole('button', { name: new RegExp(cue.step.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) });
  await target.press('Enter');
  await expect(target).toHaveAttribute('aria-pressed', 'true');
  await expect(target).toBeFocused();
  await expect(inspect.getByText(cue.note, { exact: true })).toBeVisible();
  await player.getByLabel('Code language').selectOption('java');
  await expect(inspect.getByRole('region', { name: 'Java source code' })).toBeVisible();
  const scene = observer.story.scenes.find(scene => scene.id === 'subject');
  const code = yaml.load(readFileSync('_data/explainers/observer_code.yml', 'utf8')).java.blocks[scene.code];
  const notify = scene.cues[2];
  const sourceLine = code.source.split('\n')[code.focus[notify.focus][0] - 1].trim();
  await inspect.getByRole('region', { name: 'Java source code' }).getByText(sourceLine, { exact: true }).click();
  await expect(inspect.getByText(notify.note, { exact: true })).toBeVisible();
  await inspect.getByRole('img').getByText('Subject', { exact: true }).click();
  await expect(inspect.getByText(scene.cues[0].note, { exact: true })).toBeVisible();
  const line = inspect.getByRole('region', { name: 'Java source code' }).getByText(sourceLine, { exact: true });
  await line.scrollIntoViewIfNeeded();
  const bounds = await line.evaluate(element => {
    const text = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    while (text.nextNode()) {
      const word = /\S+/.exec(text.currentNode.textContent);
      if (!word) continue;
      const range = document.createRange();
      range.setStart(text.currentNode, word.index);
      range.setEnd(text.currentNode, word.index + word[0].length);
      return range.getBoundingClientRect().toJSON();
    }
    throw new Error('No source text to select');
  });
  await page.mouse.move(bounds.x + bounds.width * 0.1, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.9, bounds.y + bounds.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.getSelection().toString().trim())).not.toBe('');
  await expect(inspect.getByText(scene.cues[0].note, { exact: true })).toBeVisible();
  await expect(player.getByRole('button', { name: 'Play narration', exact: true })).toBeVisible();
  await a11yCheckpoint(page, 'narration-study-inspection', { include: '#observer-animation' });
});

test('paired designs keep consequences behind a deliberate reveal and retain the learner explanation', async ({ page }) => {
  const player = await openStudy(page);
  await player.getByLabel('Study activity').selectOption('compare');
  const compare = player.getByRole('region', { name: 'Compare designs', exact: true });
  const item = observer.study.comparisons[0];
  await expect(compare.getByRole('heading', { name: item.before.label, exact: true })).toBeVisible();
  await expect(compare.getByRole('heading', { name: item.after.label, exact: true })).toBeVisible();
  await expect(compare.getByText(item.consequences[0], { exact: true })).toBeHidden();
  await compare.getByLabel('Your design choice and reasons').fill('The registration contract isolates new views.');
  await compare.getByText('Show consequences', { exact: true }).click();
  await expect(compare.getByText(item.consequences[0], { exact: true })).toBeVisible();
  await compare.getByLabel('Choose a comparison').selectOption(observer.study.comparisons[1].id);
  await compare.getByLabel('Choose a comparison').selectOption(item.id);
  await expect(compare.getByLabel('Your design choice and reasons')).toHaveValue('The registration contract isolates new views.');
  await a11yCheckpoint(page, 'narration-study-comparison', { include: '#observer-animation' });
});

for (const topic of ['uml_class_diagram', 'uml_sequence_diagram', 'uml_state_diagram', 'uml_component_diagram', 'observer', 'state', 'strategy', 'mvc']) {
  test(`${topic}: every exercise starter and solution draws in the real renderer`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const player = await openStudy(page, topic);
    await player.getByLabel('Study activity').selectOption('practice');
    const practice = player.getByRole('region', { name: 'Try this example', exact: true });
    for (const exercise of loadLesson(topic).study.exercises) {
      await practice.getByLabel('Choose an exercise').selectOption(exercise.id);
      await expect(practice.getByRole('region', { name: 'Your diagram preview' }).getByRole('img')).toBeVisible();
      await practice.getByText('Show worked solution and self-check', { exact: true }).click();
      await expect(practice.getByRole('region', { name: 'Worked solution diagram' }).getByRole('img')).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
}

for (const dark of [false, true]) {
  test(`fullscreen hides study tools and keeps navigation usable in ${dark ? 'dark fallback' : 'light native'} mode`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    if (dark) await page.addInitScript(() => {
      delete Element.prototype.requestFullscreen;
      delete Element.prototype.webkitRequestFullscreen;
    });
    const player = await openStudy(page);
    if (dark) await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
    await player.getByLabel('Study activity').selectOption('practice');
    const draft = 'class MyObserver {}';
    await player.getByLabel('Your diagram source').fill(draft);
    await player.getByRole('button', { name: 'Enter full screen', exact: true }).click();
    await expect(player.getByText('Study tools', { exact: true })).toBeHidden();
    await expect(player.getByLabel('Your diagram source')).toBeHidden();
    await player.getByRole('button', { name: 'Mute narration', exact: true }).click();
    await player.getByRole('button', { name: 'Play narration', exact: true }).click();
    await expect(player.getByRole('button', { name: 'Pause narration', exact: true })).toBeVisible();
    await player.getByRole('button', { name: 'Pause narration', exact: true }).click();
    await player.getByRole('button', { name: 'Player settings', exact: true }).click();
    await player.getByRole('combobox', { name: 'Scene', exact: true }).selectOption('1');
    await player.getByRole('button', { name: 'Close settings', exact: true }).click();
    const navigation = player.getByRole('button', { name: 'Problem: jump to its start', exact: true }).filter({ visible: true });
    await expect(navigation).toBeInViewport();
    await navigation.click();
    await expect(player.getByRole('heading', { name: 'The document knows every widget', exact: true })).toBeVisible();
    await a11yCheckpoint(page, `narration-navigation-fullscreen-${dark}`, { include: '#observer-animation' });
    await player.getByRole('button', { name: 'Exit full screen', exact: true }).click();
    await expect(player.getByText('Study tools', { exact: true })).toBeVisible();
    await player.getByText('Study tools', { exact: true }).click();
    await player.getByLabel('Study activity').selectOption('practice');
    await expect(player.getByLabel('Your diagram source')).toHaveValue(draft);
  });
}

for (const topic of ['observer', 'uml_class_diagram']) {
  test(`${topic}: printed study answers are complete and reading choices survive printing`, async ({ page }, testInfo) => {
    const { lesson, study } = loadLesson(topic);
    const exercise = study.exercises[0];
    const comparison = study.comparisons[0];
    await page.goto(`${lesson.views}/read/?theme=dark`);
    const practice = page.getByRole('region', { name: 'Practice and compare', exact: true });
    const worked = practice.getByText(`Worked solution and self-check: ${exercise.title}`, { exact: true });
    const consequence = practice.getByText(comparison.consequences[0], { exact: true });
    await expect(consequence).toBeHidden();
    await worked.click();
    await expect(practice.getByText(exercise.checks[0], { exact: true })).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    await expect(consequence).toBeVisible();
    await expect(page.locator('html')).not.toHaveClass(/dark-mode/);
    await page.pdf({ path: testInfo.outputPath(`${topic}-study.pdf`), printBackground: true });
    await page.emulateMedia({ media: 'screen' });
    await expect(consequence).toBeHidden();
    await expect(practice.getByText(exercise.checks[0], { exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveClass(/dark-mode/);
    await page.goto(`${lesson.views}/print/?theme=dark`);
    await expect(consequence).toBeVisible();
    await expect(practice.getByText(exercise.checks[0], { exact: true })).toBeVisible();
    await expect(page.locator('html')).not.toHaveClass(/dark-mode/);
  });
}
