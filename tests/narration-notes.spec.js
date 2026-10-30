const { test, expect } = require('@playwright/test');
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { PDFDocument, PDFName, PDFDict } = require('pdf-lib');
const { ROOT, lessonIds, loadLesson } = require('../scripts/narration/source');
const { a11yCheckpoint } = require('./a11y-helpers');

const readData = name => yaml.load(readFileSync(path.join(ROOT, '_data/explainers', name), 'utf8'));
const plain = text => text.replace(/\*\*/g, '').replace(/’/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...').replace(/\s+/g, ' ').trim();
const ready = page => expect(page.locator('[data-notes-status]')).toHaveText('The pictures are ready.', { timeout: 60000 });

function handout(topic) {
  const entry = loadLesson(topic);
  const notes = readData(`${topic}_notes.yml`);
  const quizzes = existsSync(path.join(ROOT, '_data/explainers', `${topic}_quizzes.yml`)) ? readData(`${topic}_quizzes.yml`) : {};
  const cues = entry.story.scenes.flatMap((scene, sceneIndex) => scene.cues.map((cue, cueIndex) => ({
    ...cue,
    heading: `${sceneIndex + 1}.${cueIndex + 1} ${cue.step}`,
    points: notes[`${scene.id}-${cue.id}`] || notes[`${scene.id}-${cueIndex + 1}`],
  })));
  const questions = entry.story.scenes.flatMap(scene => {
    const check = quizzes[scene.id] || scene.checkpoint;
    return check ? check.questions || [check] : [];
  });
  return { ...entry, cues, questions };
}

async function expectQuestions(page, questions) {
  await expect(page.locator('.vn-check')).toHaveCount(questions.length);
  if (!questions.length) {
    await expect(page.getByRole('region', { name: 'Answers', exact: true })).toHaveCount(0);
    return;
  }
  const answers = page.getByRole('region', { name: 'Answers', exact: true }).getByRole('listitem');
  await expect(answers).toHaveCount(questions.length);
  for (const [index, question] of questions.entries()) {
    const check = page.getByRole('region', { name: new RegExp(`^Question ${index + 1} `) });
    await expect(check).toContainText(question.question);
    await expect(check.getByRole('listitem')).toHaveText(question.options);
    await expect(check.getByRole('textbox', { name: 'Your answer and reasoning', exact: true })).toBeVisible();
    await expect(answers.nth(index)).toContainText(question.options[question.correct_index]);
    await expect(answers.nth(index)).toContainText(question.explanation);
  }
}

for (const topic of lessonIds()) {
  const { lesson, story, cues, questions } = handout(topic);
  test(`${topic}: exporting from the lesson opens a complete, editable handout`, async ({ page }) => {
    test.setTimeout(120000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // The native print dialog is a browser boundary; the actual PDF is checked below.
    await page.addInitScript(() => {
      window.printRequests = 0;
      window.print = () => { window.printRequests += 1; };
    });
    await page.goto(lesson.chapter);
    await page.getByRole('link', { name: 'Save lesson notes as PDF', exact: true }).click();
    await ready(page);
    await expect(page).toHaveURL(new RegExp(`${lesson.notes_url}$`));
    await expect(page.getByRole('heading', { level: 1, name: story.title, exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.printRequests)).toBe(1);
    for (const cue of cues) {
      const row = page.getByRole('region', { name: cue.heading, exact: true });
      await expect(row.getByRole('img', { name: cue.visual, exact: true })).toBeVisible();
      // A visual may itself contain lists; these hooks identify the handout's authored points.
      expect((await row.locator('.vn-note-points > ul > li').allTextContents()).map(plain), cue.heading).toEqual(cue.points.map(plain));
      await expect(row.getByRole('textbox', { name: 'Your notes', exact: true })).toBeVisible();
    }
    await expectQuestions(page, questions);
    await page.getByRole('button', { name: 'Save as PDF or print', exact: true }).click();
    expect(await page.evaluate(() => window.printRequests)).toBe(2);
    expect(errors).toEqual([]);
    await page.setViewportSize({ width: 320, height: 740 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth), 'handout fits a narrow phone viewport').toBeLessThanOrEqual(321);
    await a11yCheckpoint(page, `${topic} editable lesson notes`, { feature: 'narration-notes' });
  });
}

test('a missing animation file still exports the descriptions and editable notes', async ({ page }) => {
  const { lesson, cues } = handout('scrum');
  // Simulate a network failure at the browser boundary without replacing the renderer.
  await page.route('**/js/video-narration-stage.js?*', route => route.abort('connectionfailed'));
  await page.addInitScript(() => {
    window.printRequests = 0;
    window.print = () => { window.printRequests += 1; };
  });
  await page.goto(`${lesson.notes_url}#export`);
  await expect(page.locator('[data-notes-status]')).toHaveText('Some pictures could not be drawn. Their descriptions and your notes remain available to print.');
  await expect(page).toHaveURL(new RegExp(`${lesson.notes_url}$`));
  expect(await page.evaluate(() => window.printRequests)).toBe(1);
  const row = page.getByRole('region', { name: cues[0].heading, exact: true });
  await expect(row.getByRole('img', { name: cues[0].visual, exact: true })).toContainText(cues[0].visual);
  await row.getByRole('textbox', { name: 'Your notes', exact: true }).fill('My notes still work without the animation.');
  await page.getByRole('button', { name: 'Save as PDF or print', exact: true }).click();
  expect(await page.evaluate(() => window.printRequests)).toBe(2);
});

// Each renderer family has a real PDF check. These structural assertions support
// accessibility review; they do not establish complete WCAG/PDF conformance.
for (const topic of ['scrum', 'mvc', 'nodejs', 'react', 'therac25']) {
  const { lesson, cues } = handout(topic);
  test(`${topic}: printed notes keep light, unclipped content and PDF reading semantics`, async ({ page }) => {
    test.setTimeout(120000);
    await page.goto(lesson.notes_url);
    await ready(page);
    await page.setViewportSize({ width: 720, height: 1000 });
    await page.emulateMedia({ media: 'print', colorScheme: 'dark' });
    await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
    await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(page.getByRole('button', { name: 'Save as PDF or print' })).toBeHidden();
    await expect(page.getByRole('navigation', { name: 'Lesson views' })).toBeHidden();
    if (topic === 'nodejs' || topic === 'react') {
      // These lessons draw their paused artwork as HTML; print must retain it.
      const pictures = page.locator('.vn-note-art-drawing > .nja-model');
      await expect(pictures).toHaveCount(cues.length);
      for (const picture of await pictures.all()) await expect(picture).toBeVisible();
    }
    const clipped = await page.locator('.vn-note').evaluateAll(rows => rows.flatMap(row => {
      const box = row.getBoundingClientRect();
      return [...row.querySelectorAll('.vn-note-head, .vn-note-points, .vn-check-question, .vn-check-options')]
        .filter(part => {
          const bounds = part.getBoundingClientRect();
          return bounds.right > box.right + 1 || bounds.bottom > box.bottom + 1;
        }).map(() => row.querySelector('h3').textContent.trim());
    }));
    expect(clipped, 'authored text extends outside its printed row').toEqual([]);
    const pdf = await PDFDocument.load(await page.pdf({ format: 'Letter', printBackground: true, preferCSSPageSize: true, tagged: true }));
    expect(pdf.getPageCount()).toBeGreaterThan(1);
    expect(pdf.getTitle()).toContain('Notes');
    expect(pdf.catalog.lookup(PDFName.of('Lang')).decodeText()).toMatch(/^en\b/);
    expect(pdf.catalog.lookup(PDFName.of('StructTreeRoot'), PDFDict)).toBeTruthy();
    expect(pdf.catalog.lookup(PDFName.of('MarkInfo'), PDFDict).get(PDFName.of('Marked')).toString()).toBe('true');
    const elements = pdf.context.enumerateIndirectObjects().map(([, object]) => object)
      .filter(object => object instanceof PDFDict && object.has(PDFName.of('S')));
    const tags = elements.map(element => element.get(PDFName.of('S')).toString());
    expect(tags).toEqual(expect.arrayContaining(['/H1', '/H2', '/H3', '/L', '/LI']));
    const descriptions = elements.filter(element => element.get(PDFName.of('S')).toString() === '/Figure')
      .map(element => element.lookup(PDFName.of('Alt'))?.decodeText());
    for (const cue of cues) expect(descriptions, `PDF alternative for ${cue.heading}`).toContain(cue.visual);
  });
}

test('student notes and reasoning survive a reload and print as literal multiline text', async ({ page }) => {
  const { lesson } = loadLesson('observer');
  const note = ['First observation: <strong>keep this literal</strong>.',
    ...Array.from({ length: 20 }, (_, index) => `Observation ${index + 2}: changes must reach every subscriber.`)].join('\n');
  const reasoning = 'My choice depends on who owns the subscription.\n<script>window.unwantedNoteScript = true</script>';
  await page.goto(lesson.notes_url);
  await ready(page);
  await page.getByRole('textbox', { name: 'Your notes', exact: true }).first().fill(note);
  await page.getByRole('textbox', { name: 'Your answer and reasoning', exact: true }).first().fill(reasoning);
  await expect(page.locator('[data-notes-save-status]')).toHaveText('Notes saved on this browser.');
  await page.reload();
  await ready(page);
  const noteField = page.getByRole('textbox', { name: 'Your notes', exact: true }).first();
  const answerField = page.getByRole('textbox', { name: 'Your answer and reasoning', exact: true }).first();
  await expect(noteField).toHaveValue(note);
  await expect(answerField).toHaveValue(reasoning);
  await a11yCheckpoint(page, 'saved student notes', { feature: 'narration-notes' });
  await page.emulateMedia({ media: 'print' });
  await expect(noteField).toBeHidden();
  await expect(answerField).toBeHidden();
  const writtenNote = page.locator('[data-notes-written^="cue:"] p').first();
  const writtenAnswer = page.locator('[data-notes-written^="question:"] p').first();
  await expect(writtenNote).toBeVisible();
  await expect(writtenAnswer).toBeVisible();
  expect(await writtenNote.textContent()).toBe(note);
  expect(await writtenAnswer.textContent()).toBe(reasoning);
  await expect(writtenNote).toHaveCSS('white-space', 'pre-wrap');
  await expect(writtenNote.locator('*')).toHaveCount(0);
  await expect(writtenAnswer.locator('*')).toHaveCount(0);
  expect(await page.evaluate(() => window.unwantedNoteScript)).toBeUndefined();
  const bounds = await writtenNote.evaluate(element => ({
    textBottom: element.getBoundingClientRect().bottom,
    rowBottom: element.closest('.vn-note').getBoundingClientRect().bottom,
    rowHeight: element.closest('.vn-note').getBoundingClientRect().height,
  }));
  expect(bounds.rowHeight, 'a long student note expands beyond the blank handout row').toBeGreaterThan(3 * 96);
  expect(bounds.textBottom).toBeLessThanOrEqual(bounds.rowBottom);
});

test('unavailable browser storage reports the failure while retaining printable edits', async ({ page, context }) => {
  // Storage denial is a browser boundary, as in private browsing or quota failure.
  await page.addInitScript(() => {
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('sebook-narration-notes-')) throw new DOMException('Storage blocked', 'QuotaExceededError');
      return setItem.call(this, key, value);
    };
  });
  await page.goto(loadLesson('nodejs').lesson.notes_url);
  await ready(page);
  const text = 'Keep my event-loop observation even when storage is unavailable.';
  const field = page.getByRole('textbox', { name: 'Your notes', exact: true }).first();
  await field.fill(text);
  await expect(field).toHaveValue(text);
  await expect(page.locator('[data-notes-save-status]')).toContainText('Notes could not be saved.');
  const otherTab = await context.newPage();
  await otherTab.goto(loadLesson('nodejs').lesson.notes_url);
  await ready(otherTab);
  await otherTab.getByRole('textbox', { name: 'Your notes', exact: true }).nth(1).fill('A different note saved in another tab.');
  await expect(page.getByRole('textbox', { name: 'Your notes', exact: true }).nth(1)).toHaveValue('A different note saved in another tab.');
  await expect(field).toHaveValue(text);
  await expect(page.locator('[data-notes-save-status]')).toContainText('Notes could not be saved.');
  await otherTab.close();
  await a11yCheckpoint(page, 'notes storage unavailable', { feature: 'narration-notes' });
  await page.emulateMedia({ media: 'print' });
  const written = page.locator('[data-notes-written^="cue:"] p').first();
  await expect(written).toBeVisible();
  expect(await written.textContent()).toBe(text);
});

test('another tab can update and delete a saved note even while its field is focused', async ({ page, context }) => {
  const url = loadLesson('observer').lesson.notes_url;
  await page.goto(url);
  await ready(page);
  const field = page.getByRole('textbox', { name: 'Your notes', exact: true }).first();
  await field.fill('Original saved note');
  await expect(field).toBeFocused();
  const otherTab = await context.newPage();
  await otherTab.goto(url);
  await ready(otherTab);
  await expect(field).toBeFocused();
  const otherField = otherTab.getByRole('textbox', { name: 'Your notes', exact: true }).first();
  await expect(otherField).toHaveValue('Original saved note');
  await otherField.fill('Revised from the second tab');
  await expect(field).toHaveValue('Revised from the second tab');
  await otherField.fill('');
  await expect(field).toHaveValue('');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('[data-notes-written^="cue:"]').first()).toBeHidden();
  await otherTab.close();
});

test('saved notes are separate per lesson and can be removed from Browser storage', async ({ page }) => {
  for (const topic of ['observer', 'nodejs']) {
    await page.goto(loadLesson(topic).lesson.notes_url);
    await ready(page);
    const field = page.getByRole('textbox', { name: 'Your notes', exact: true }).first();
    await expect(field).toHaveValue('');
    await field.fill(`My ${topic} notes`);
  }
  await page.getByRole('link', { name: 'Manage saved notes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Narration notes', exact: true })).toBeVisible();
  for (const topic of ['observer', 'nodejs']) {
    await expect(page.getByRole('button', { name: `Delete sebook-narration-notes-${topic}`, exact: true })).toBeEnabled();
  }
  await page.evaluate(() => localStorage.setItem('unrelated-notes-test-preference', 'keep'));
  await page.getByRole('button', { name: 'Delete all narration notes', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete data', exact: true }).click();
  await expect(page.getByText('No narration notes stored in your browser.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('unrelated-notes-test-preference'))).toBe('keep');
  for (const topic of ['observer', 'nodejs']) {
    await page.goto(loadLesson(topic).lesson.notes_url);
    await ready(page);
    await expect(page.getByRole('textbox', { name: 'Your notes', exact: true }).first()).toHaveValue('');
  }
});

test.describe('notes without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  for (const topic of ['scrum', 'mvc', 'react', 'therac25']) {
    test(`${topic}: authored notes and visual descriptions remain available without unsafe editing`, async ({ page }) => {
      const { lesson, story, cues } = handout(topic);
      await page.goto(lesson.notes_url);
      await expect(page.getByRole('heading', { level: 1, name: story.title, exact: true })).toBeVisible();
      await expect(page.getByText('Enable JavaScript to edit and save notes here. You can print the lesson with blank writing space without it.', { exact: true })).toBeVisible();
      await expect(page.getByRole('textbox')).toHaveCount(0);
      await expect(page.locator('.vn-note-points > ul')).toHaveCount(cues.length);
      for (const cue of [cues[0], cues.at(-1)]) {
        const row = page.getByRole('region', { name: cue.heading, exact: true });
        await expect(row.getByRole('img', { name: cue.visual, exact: true })).toBeVisible();
        expect((await row.locator('.vn-note-points > ul > li').allTextContents()).map(plain)).toEqual(cue.points.map(plain));
      }
    });
  }
});
