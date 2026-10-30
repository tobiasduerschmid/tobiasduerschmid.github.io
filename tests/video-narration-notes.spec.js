const { loadStory, loadRegistry } = require('../scripts/narration/source');
// The printable notes of every video narration (docs/video-narration.md,
// "Printable notes"): the page that "Save lesson notes as PDF" opens and prints.
const { test, expect } = require('@playwright/test');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { PDFDocument, PDFName, PDFRawStream } = require('pdf-lib');
const yaml = require('js-yaml');
const { a11yCheckpoint } = require('./a11y-helpers');

const data = file => yaml.load(readFileSync(require.resolve(`../_data/${file}`), 'utf8'));
// Rendered text: emphasis markers gone, typographic apostrophes and quotes plain.
const plain = text => text.replace(/\*\*/g, '').replace(/[’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
// A Letter page inside the notes' print margins, at CSS's 96 pixels per inch.
const INCH = 96;
const LETTER = { width: (8.5 - 2 * 0.5) * INCH, height: (11 - 0.4 - 0.55) * INCH };
// The picture a row shows: its cue at rest, just before the cue ends.
const REST_LEAD = 0.3;
const ROWS_PER_PAGE = 3;
const picturesReady = page => expect(page.locator('[data-notes-status]')).toHaveText('The pictures are ready.', { timeout: 60000 });

// The words a stage shows and where, in stage pixels.
function stageWords(stage) {
  const box = stage.getBoundingClientRect();
  const shown = (node) => {
    for (let element = node.parentElement; element && element !== stage.parentElement; element = element.parentElement) {
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) < 0.35) return false;
    }
    return true;
  };
  const found = [];
  const walker = document.createTreeWalker(stage, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.textContent.trim() || !shown(node)) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const rect = range.getBoundingClientRect();
    if (rect.width < 1) continue;
    found.push({ text: node.textContent.trim(), x: rect.left - box.left, y: rect.top - box.top });
  }
  return found.sort((a, b) => a.y - b.y || a.x - b.x || a.text.localeCompare(b.text));
}

for (const [topic, lesson] of Object.entries(loadRegistry('video'))) {
  const story = loadStory(topic);
  const timing = data(`explainers/${topic}_timing.json`);
  const notes = data(`explainers/${topic}_notes.yml`);
  const quizzes = data(`explainers/${topic}_quizzes.yml`);
  const cues = story.scenes.flatMap((scene, sceneIndex) => scene.cues.map((cue, cueIndex) => ({
    cue,
    points: notes[`${scene.id}-${cueIndex + 1}`],
    heading: `${sceneIndex + 1}.${cueIndex + 1} ${cue.step}`,
    rest: timing.scenes[sceneIndex].cues[cueIndex].end - REST_LEAD,
  })));
  const questions = story.scenes.flatMap(scene => (quizzes[scene.id] ? quizzes[scene.id].questions || [quizzes[scene.id]] : []));
  const notesUrl = `${lesson.views}/notes/`;

  test(`${topic} notes: every cue's picture beside its key points`, async ({ page }) => {
    await page.goto(notesUrl);
    await expect(page.getByRole('heading', { level: 1, name: story.title })).toBeVisible();
    await picturesReady(page);
    for (const { cue, points, heading } of cues) {
      const row = page.getByRole('region', { name: heading, exact: true });
      await expect(row.getByRole('img', { name: cue.visual, exact: true })).toBeVisible();
      expect((await row.getByRole('listitem').allTextContents()).map(plain), heading).toEqual(points.map(plain));
    }
    await a11yCheckpoint(page, `${topic} notes`, { feature: 'video-narration-notes' });
  });

  test(`${topic} notes: each picture shows the paused video's words in the same places`, async ({ page, context }) => {
    test.setTimeout(120000);
    const video = await context.newPage();
    await video.setViewportSize({ width: 960, height: 540 });
    await video.goto(lesson.animation.page);
    await video.evaluate(() => window.VideoNarrationStage.ready);
    await page.goto(notesUrl);
    await picturesReady(page);
    const near = (a, b) => a.text === b.text && Math.abs(a.x - b.x) < 1.5 && Math.abs(a.y - b.y) < 1.5;
    const differ = {};
    for (const { heading, rest } of cues) {
      await video.evaluate(time => window.VideoNarrationStage.seek(time), rest);
      const paused = await video.locator('#stage').evaluate(stageWords);
      // Measured at full size, so the pose is compared, not the scaling.
      const copy = page.getByRole('region', { name: heading, exact: true }).locator('.stage');
      await copy.evaluate(stage => stage.parentElement.style.setProperty('--vn-still-scale', '1'));
      const still = await copy.evaluate(stageWords);
      const missing = paused.filter(word => !still.some(other => near(word, other))).map(word => word.text);
      const extra = still.filter(word => !paused.some(other => near(word, other))).map(word => word.text);
      if (missing.length || extra.length) differ[heading] = { missing, extra };
    }
    expect(differ).toEqual({});
  });

  test(`${topic} notes: each section's check follows it, and the answers close the notes`, async ({ page }) => {
    await page.goto(notesUrl);
    const answers = page.getByRole('region', { name: 'Answers' }).getByRole('listitem');
    await expect(answers).toHaveCount(questions.length);
    for (const [index, question] of questions.entries()) {
      const check = page.getByRole('region', { name: new RegExp(`^Question ${index + 1} `) });
      await expect(check).toContainText(question.question);
      expect(await check.getByRole('listitem').allTextContents()).toEqual(question.options);
      await expect(answers.nth(index)).toContainText(`${question.options[question.correct_index]}. ${question.explanation}`);
    }
  });

  test(`${topic} notes: print keeps only the lesson, three whole rows a page`, async ({ page }) => {
    await page.setViewportSize({ width: LETTER.width, height: 1000 });
    await page.goto(notesUrl);
    await picturesReady(page);
    await page.emulateMedia({ media: 'print' });
    const printed = await page.evaluate(() => {
      const title = document.querySelector('h1');
      const rows = [...document.querySelectorAll('h3')].map(heading => heading.closest('section')).filter(section => !section.matches('[aria-labelledby$="-answers"]'));
      const answers = document.querySelector('h2[id$="-answers"]').closest('section');
      // The lesson is its title (with the line above it), its rows, and the answers.
      const lesson = [title, title.previousElementSibling, ...rows, answers];
      const strays = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const range = document.createRange();
        range.selectNodeContents(walker.currentNode);
        const shown = walker.currentNode.textContent.trim() && range.getClientRects().length > 0;
        if (shown && !lesson.some(part => part.contains(walker.currentNode))) strays.push(walker.currentNode.textContent.trim().slice(0, 40));
      }
      const clipped = rows.filter((row) => {
        const bottom = row.getBoundingClientRect().bottom;
        return [...row.querySelectorAll('h2, h3, p, li, [role="img"]')].some(part => part.getBoundingClientRect().bottom > bottom + 0.5);
      }).map(row => row.querySelector('h3').textContent);
      // The height a page must hold: the title and the first three rows, and
      // any three rows in a row (a margin at a page break is dropped).
      const top = element => element.getBoundingClientRect().top;
      const bottom = element => element.getBoundingClientRect().bottom;
      const spans = rows.slice(2).map((row, index) => bottom(row) - top(rows[index]));
      return { strays, clipped, firstPage: bottom(rows[2]) - top(title.parentElement), page: Math.max(...spans) };
    });
    expect(printed.strays, 'text outside the lesson prints').toEqual([]);
    expect(printed.clipped, 'rows whose content runs past their edge').toEqual([]);
    expect(printed.firstPage).toBeLessThanOrEqual(LETTER.height);
    expect(printed.page).toBeLessThanOrEqual(LETTER.height);
  });

  test(`${topic} notes: saved as a PDF, the rows fill Letter pages three at a time`, async ({ page }) => {
    await page.goto(notesUrl);
    await picturesReady(page);
    // Without the answers, the pages hold only rows, so a printout that
    // shrank its pages, or split a row, shows in the page count.
    await page.getByRole('region', { name: 'Answers' }).evaluate(answers => answers.remove());
    const pdf = await page.pdf({ format: 'Letter', preferCSSPageSize: true });
    const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
    expect(pages).toBe(Math.ceil((cues.length + questions.length) / ROWS_PER_PAGE));
  });

  test(`${topic} notes: every printed picture remains vector graphics`, async ({ page }) => {
    await page.goto(notesUrl);
    await picturesReady(page);
    const pdf = await PDFDocument.load(await page.pdf({ format: 'Letter', printBackground: true }));
    // Inspect every PDF object, including images inside patterns and soft masks
    // that are missed by checking only the page's direct image resources.
    const images = pdf.context.enumerateIndirectObjects().filter(([, object]) => (
      object instanceof PDFRawStream && object.dict.get(PDFName.of('Subtype')) === PDFName.of('Image')
    ));
    expect(images.length, 'raster images in the notes PDF').toBe(0);
  });

  test(`${topic} notes: dark mode prints the same light artwork`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(notesUrl);
    await picturesReady(page);
    await page.emulateMedia({ media: 'print' });
    // Compare the PDF drawing/font streams, ignoring document timestamps.
    const drawingStreams = async () => {
      const pdf = await PDFDocument.load(await page.pdf({ format: 'Letter', printBackground: true }));
      return pdf.context.enumerateIndirectObjects()
        .filter(([, object]) => object instanceof PDFRawStream)
        .map(([, object]) => createHash('sha256').update(object.getContents()).digest('hex'));
    };
    const light = await drawingStreams();
    await page.emulateMedia({ media: 'print', colorScheme: 'dark' });
    await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
    await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
    expect(await drawingStreams()).toEqual(light);
  });

  test(`${topic}: the button under the video opens the notes and the print dialog`, async ({ page }) => {
    await page.addInitScript(() => {
      window.printRequests = 0;
      window.print = () => { window.printRequests += 1; };
    });
    await page.goto(lesson.chapter);
    await page.getByRole('link', { name: 'Save lesson notes as PDF' }).click();
    await expect(page).toHaveURL(new RegExp(`${notesUrl}$`));
    await picturesReady(page);
    expect(await page.evaluate(() => window.printRequests)).toBe(1);
    await page.getByRole('button', { name: 'Save as PDF or print' }).click();
    expect(await page.evaluate(() => window.printRequests)).toBe(2);
  });
}
