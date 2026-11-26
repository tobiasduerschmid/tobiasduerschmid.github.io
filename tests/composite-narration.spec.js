const { loadStory } = require('../scripts/narration/source');
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');
const { readFileSync } = require('node:fs');
const yaml = require('js-yaml');
const collageSpec = require('./helpers/composite-collage');

const story = loadStory('composite');
const quizzes = yaml.load(readFileSync(require.resolve('../_data/explainers/composite_quizzes.yml'), 'utf8'));
const collage = collageSpec.load();
const viewUrl = view => `/SEBook/designpatterns/composite/${view}/`;
const questionsOf = id => quizzes[id].questions || [quizzes[id]];
const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const startsWith = text => new RegExp(`^${escapeRegExp(text)}`);
const cueCount = story.scenes.reduce((count, scene) => count + scene.cues.length, 0);
const step = (page, sceneId, index) => page.locator(`[data-reading-scene="${sceneId}"][data-reading-cue="${index}"]`);
// The steps that answer a prediction: the reader keeps them in a closed disclosure.
const answerSteps = story.scenes.flatMap(scene => scene.cues
  .flatMap((cue, index) => (cue.prediction ? [{ scene, index: index + 1 }] : [])));
// Summaries toggle natively, so this works with or without JavaScript.
async function revealAnswers(page) {
  for (const summary of await page.locator('.np-reading-answer > summary').all()) await summary.click();
}

// The static picture's name, up to the end of its canvas description.
const staticName = panel => `Summer story, drawn by the ${panel.design} design. ${collageSpec.canvasDescription(collage, panel)}`;
// How many illustrations a narrated picture draws: its photos on the canvas,
// plus the carousel's thumbnails.
function artCount(panel) {
  const rows = collageSpec.rowsFor(collage, panel);
  const kinds = new Map(rows.map(row => [row.id, row.kind]));
  let drawn = collageSpec.share(collageSpec.tree(rows), 'story', panel.design).drawn;
  if (panel.drawn) drawn = drawn.slice(0, panel.drawn.length);
  return drawn.filter(entry => kinds.get(entry.tile) === 'photo').length
    + ((panel.neighbors || []).includes('carousel') ? collage.neighbors.carousel.length : 0);
}
const readerArtCount = story.scenes.flatMap(scene => scene.cues).reduce((count, cue) => count + artCount(collage.panels[cue.ui_state]), 0);

test('reading and print views include every step, diagram, picture, and question without JavaScript', async ({ browser }) => {
  test.setTimeout(120000);
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const questions = story.scenes.reduce((count, scene) => count + questionsOf(scene.id).length, 0);
  for (const view of ['read', 'print']) {
    await page.goto(viewUrl(view));
    await expect(page.locator('audio')).toHaveCount(0);
    await expect(page.locator('.np-reading-step')).toHaveCount(cueCount);
    for (const { scene, index } of answerSteps) {
      await expect(step(page, scene.id, index).getByText(scene.cues[index].text, { exact: true }), `${view}: ${scene.id} keeps its answer hidden`).toBeHidden();
    }
    await revealAnswers(page);
    for (const scene of story.scenes) {
      for (const [index, cue] of scene.cues.entries()) {
        const at = step(page, scene.id, index);
        await expect(at.getByText(cue.text, { exact: true })).toBeVisible();
        if (scene.diagram) await expect(at.locator('.np-diagram svg')).toBeVisible();
        const panel = collage.panels[cue.ui_state];
        await expect(at.getByRole('img', { name: startsWith(staticName(panel)) }), `${view}: ${scene.id}/${cue.id}`).toBeVisible();
      }
    }
    await expect(page.locator('.np-print-question')).toHaveCount(questions);
    await expect(page.getByText('Summary quiz:', { exact: true })).toHaveCount(questionsOf('summary').length);
  }
  await context.close();
});

// The static picture is one image to assistive technology; its parts are
// aria-hidden, so these checks reach them through the include's documented
// hooks (_includes/composite-collage-panel.html): .composite-canvas,
// .composite-cell[data-tile], .composite-chip, .composite-tag, .composite-badge,
// and img.composite-art.
test('every illustration loads in the reader and print views', async ({ page }) => {
  for (const view of ['read', 'print']) {
    await page.goto(viewUrl(view));
    const art = page.locator('img.composite-art');
    await expect(art).toHaveCount(readerArtCount);
    const failed = await art.evaluateAll(images => Promise.all(images.map(image => image.decode().then(() => null, () => image.getAttribute('src')))));
    expect(failed.filter(Boolean), `${view}: images that failed to load`).toEqual([]);
    expect(await art.evaluateAll(images => images.filter(image => image.naturalWidth === 0).length), `${view}: empty images`).toBe(0);
  }
});

test('chips on the narrowest tiles stay readable at 320 and 1280 px', async ({ page }) => {
  for (const width of [1280, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(viewUrl('read'));
    await revealAnswers(page);
    for (const [sceneId, index] of [['intro', 0], ['collaborations', 2]]) {
      const at = step(page, sceneId, index);
      await at.scrollIntoViewIfNeeded();
      const paragraph = await at.locator('p').first().evaluate(node => parseFloat(getComputedStyle(node).fontSize));
      for (const tile of ['gig', 'taco']) {
        const cell = at.locator(`.composite-cell[data-tile="${tile}"]`);
        const labels = cell.locator('.composite-chip, .composite-tag, .composite-badge');
        await expect(labels.first()).toBeVisible();
        for (const label of await labels.all()) {
          const fit = await label.evaluate(node => {
            const box = node.getBoundingClientRect();
            const frame = node.closest('.composite-cell').getBoundingClientRect();
            return {
              size: parseFloat(getComputedStyle(node).fontSize),
              overflows: node.scrollWidth > node.clientWidth + 1,
              outside: box.left < frame.left - 1 || box.right > frame.right + 1,
            };
          });
          const where = `${sceneId} ${tile} at ${width} px`;
          expect(fit.size, `${where}: text size`).toBeGreaterThanOrEqual(0.9 * paragraph);
          expect(fit.overflows, `${where}: text overflows its chip`).toBe(false);
          expect(fit.outside, `${where}: chip sticks out of its tile`).toBe(false);
        }
      }
    }
    if (width === 320) {
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    }
  }
});

test('static tiles sit where their areas say', async ({ page }) => {
  await page.goto(viewUrl('read'));
  await revealAnswers(page);
  const { width, height } = collage.canvas;
  for (const [sceneId, index, expected, blank] of [
    ['intro', 0, collage.expected.start.drawn, []],
    ['summary', 0, collage.expected.caption.drawn, []],
    ['problem', 5, collage.expected.caption.drawn, ['caption']],
  ]) {
    const at = step(page, sceneId, index);
    await at.scrollIntoViewIfNeeded();
    const canvas = await at.locator('.composite-canvas').boundingBox();
    for (const { tile, area: [x, y, w, h] } of expected) {
      const cell = await at.locator(`.composite-cell[data-tile="${tile}"]`).boundingBox();
      const where = `${sceneId}/${index}: ${tile}${blank.includes(tile) ? ' (blank)' : ''}`;
      expect(Math.abs(cell.x - (canvas.x + canvas.width * x / width)), `${where}: left`).toBeLessThanOrEqual(4);
      expect(Math.abs(cell.y - (canvas.y + canvas.height * y / height)), `${where}: top`).toBeLessThanOrEqual(4);
      expect(Math.abs(cell.width - canvas.width * w / width), `${where}: width`).toBeLessThanOrEqual(4);
      expect(Math.abs(cell.height - canvas.height * h / height), `${where}: height`).toBeLessThanOrEqual(4);
    }
  }
});

test('the reader is accessible in light and dark mode', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(viewUrl('read'));
  await revealAnswers(page);
  const themeButton = page.getByRole('button', { name: 'Dark mode' });
  for (const dark of [false, true]) {
    if (await themeButton.getAttribute('aria-pressed') !== String(dark)) await themeButton.click();
    await expect(themeButton).toHaveAttribute('aria-pressed', String(dark));
    await a11yCheckpoint(page, `composite reader ${dark ? 'dark' : 'light'}`, { include: '#main-content', feature: 'composite-narration' });
  }
});
