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
            const style = getComputedStyle(node);
            return {
              size: parseFloat(style.fontSize),
              overflows: node.scrollWidth > node.clientWidth + 1,
              outside: box.left < frame.left - 1 || box.right > frame.right + 1,
              lines: Math.round((box.height - 2) / parseFloat(style.lineHeight)),
            };
          });
          const where = `${sceneId} ${tile} at ${width} px`;
          expect(fit.size, `${where}: text size`).toBeGreaterThanOrEqual(0.9 * paragraph);
          expect(fit.overflows, `${where}: text overflows its chip`).toBe(false);
          expect(fit.outside, `${where}: chip sticks out of its tile`).toBe(false);
          expect(fit.lines, `${where}: a one-word label breaks across lines`).toBe(1);
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

// ---------------------------------------------------------------------------
// The live collage in the player (js/composite-collage.js).
const { openPlayerSettings, seekNarration, setSiteTheme, serveAudioRanges, paintedColor } = require('./helpers/narration-player');
const timing = require('../_data/explainers/composite_timing.json');
const url = '/SEBook/designpatterns/composite.html';
const { panels } = collage;
const player = page => page.getByRole('region', { name: story.title, exact: true });
const sceneIndex = id => story.scenes.findIndex(scene => scene.id === id);
const cueMiddle = (sceneId, cueId) => {
  const scene = story.scenes[sceneIndex(sceneId)];
  const cueTiming = timing.scenes[sceneIndex(sceneId)].cues[scene.cues.findIndex(cue => cue.id === cueId)];
  return (cueTiming.start + cueTiming.end) / 2;
};
const seek = (page, sceneId, cueId) => seekNarration(player(page), cueMiddle(sceneId, cueId));
// The live collage of the scene on screen, and its parts.
const liveCollage = page => player(page).locator('.nja-scene:visible').getByRole('group', { name: /^Summer story/ });
const canvasOf = live => live.getByRole('img', { name: /^Canvas/ });
const treeRows = live => live.getByRole('list', { name: 'Layout tree' }).getByRole('listitem');
const statusOf = live => live.getByRole('status');
const shareButton = (live, id) => live.getByRole('button', { name: `Share ${id}`, exact: true });

test('each cue moves the live picture to its narrated state', async ({ page }) => {
  test.setTimeout(180000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url);
  for (const scene of story.scenes) {
    for (const cue of scene.cues) {
      await seek(page, scene.id, cue.id);
      const at = `${scene.id}/${cue.id}`;
      const panel = panels[cue.ui_state];
      const rows = collageSpec.rowsFor(collage, panel);
      const live = liveCollage(page);
      await expect(canvasOf(live), at).toHaveAccessibleName(collageSpec.canvasDescription(collage, panel));
      const items = treeRows(live);
      await expect(items, at).toHaveCount(rows.length);
      for (const [index, row] of rows.entries()) {
        const item = items.nth(index);
        await expect(shareButton(item, row.id), `${at}: ${row.id}`).toBeVisible();
        await expect(item.locator('.composite-tag'), `${at}: ${row.id}`).toHaveText(collageSpec.rowTags(collage, panel, row));
      }
      await expect(live.getByText(panel.note, { exact: true }), at).toBeVisible();
      const pending = live.getByText(/waits to go under beach/);
      if (panel.caption === 'pending') await expect(pending, at).toBeVisible();
      else await expect(pending, at).toBeHidden();
      await expect(live.getByRole('img', { name: /^Carousel post/ }), at).toHaveCount((panel.neighbors || []).includes('carousel') ? 1 : 0);
    }
  }
});

test('learners press Share on any tile and see the design on screen draw it', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url);
  const pressed = async (panel, id, status) => {
    await shareButton(liveCollage(page), id).click();
    await expect(canvasOf(liveCollage(page)), `Share ${id}`).toHaveAccessibleName(collageSpec.pressDescription(collage, panel, id));
    await expect(statusOf(liveCollage(page))).toHaveText(status);
  };
  await seek(page, 'intro', 'try-it');
  await pressed(panels.start, 'bottom', 'Shared bottom: 2 photos.');
  await pressed(panels.start, 'beach', 'Shared beach: 1 photo.');
  await pressed(panels.start, 'story', 'Shared story: 4 photos.');

  // A press replaces the narrated marks and note with its own result.
  await seek(page, 'context', 'part-whole');
  await pressed(panels.wholes, 'right', 'Shared right: 3 photos.');
  await expect(treeRows(liveCollage(page)).locator('.composite-tag')).toHaveCount(0);
  await expect(liveCollage(page).getByText(panels.wholes.note, { exact: true })).toBeHidden();

  // The first design skips the caption in Split.draw, but its Share button draws one alone.
  await seek(page, 'problem', 'every-change');
  await pressed(panels.first_caption_blank, 'story', 'Shared story: 4 photos. The caption’s area stays blank: Split.draw has no branch for captions.');
  await pressed(panels.first_caption_blank, 'caption', 'Shared caption: 0 photos.');
  await liveCollage(page).getByRole('button', { name: 'Back to the narration’s picture', exact: true }).click();
  await expect(canvasOf(liveCollage(page))).toHaveAccessibleName(collageSpec.canvasDescription(collage, panels.first_caption_blank));
  await expect(statusOf(liveCollage(page))).toHaveText('The story is back to the narration’s picture.');

  // In the composite design, the new leaf class is shared like any tile.
  await seek(page, 'transfer', 'caption');
  await pressed(panels.caption, 'left', 'Shared left: 1 photo.');
});

// The page clock is installed, so every step a press schedules runs only when
// the test advances time, and nothing arrives late on its own.
test('a second Share press replaces the first one\'s drawing', async ({ page }) => {
  await page.clock.install();
  await page.goto(url);
  await seek(page, 'intro', 'try-it');
  await page.clock.runFor(500);
  const live = liveCollage(page);
  await shareButton(live, 'story').click();
  await page.clock.runFor(400);
  await shareButton(live, 'beach').click();
  await page.clock.runFor(5000);
  await expect(canvasOf(live)).toHaveAccessibleName(collageSpec.pressDescription(collage, panels.start, 'beach'));
  await expect(statusOf(live)).toHaveText('Shared beach: 1 photo.');
});

test('the narration\'s picture replaces a press that is still drawing', async ({ page }) => {
  await page.clock.install();
  await page.goto(url);
  await seek(page, 'intro', 'try-it');
  await page.clock.runFor(500);
  await shareButton(liveCollage(page), 'story').click();
  await page.clock.runFor(400);
  await seek(page, 'intro', 'pattern-parts');
  await page.clock.runFor(5000);
  const live = liveCollage(page);
  await expect(canvasOf(live)).toHaveAccessibleName(collageSpec.canvasDescription(collage, panels.start));
  await expect(live.getByText(panels.start.note, { exact: true })).toBeVisible();
  await expect(statusOf(live)).toHaveText('');
});

test('a focused Share button keeps focus when the caption joins the tree', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url);
  await seek(page, 'problem', 'client-check');
  await shareButton(liveCollage(page), 'story').focus();
  // The narration moves on by itself, as playback does; the slider would take focus.
  await player(page).locator('audio').evaluate((audio, time) => { audio.currentTime = time; }, cueMiddle('problem', 'every-change'));
  await expect(treeRows(liveCollage(page))).toHaveCount(collage.captioned_rows.length);
  await expect(shareButton(liveCollage(page), 'story')).toBeFocused();
});

test('a focused Share button whose tile leaves the tree hands focus to the nearest split that stays', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url);
  await seek(page, 'problem', 'every-change');
  await shareButton(liveCollage(page), 'caption').focus();
  // Back before the caption arrived, the caption and its split, left, are gone; story holds them both.
  await player(page).locator('audio').evaluate((audio, time) => { audio.currentTime = time; }, cueMiddle('problem', 'client-check'));
  await expect(treeRows(liveCollage(page))).toHaveCount(collage.rows.length);
  await expect(shareButton(liveCollage(page), 'story')).toBeFocused();
});

test('Space on a focused collage button presses it and leaves the narration paused', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url);
  await seek(page, 'intro', 'try-it');
  const live = liveCollage(page);
  const paused = () => player(page).locator('audio').evaluate(audio => audio.paused);
  await shareButton(live, 'bottom').focus();
  await page.keyboard.press('Space');
  await expect(statusOf(live)).toHaveText('Shared bottom: 2 photos.');
  expect(await paused(), 'Space started the narration').toBe(true);
  await live.getByRole('button', { name: 'Back to the narration’s picture', exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(statusOf(live)).toHaveText('The story is back to the narration’s picture.');
  expect(await paused(), 'Space started the narration').toBe(true);
});

// On a phone the canvas sits above the tree, so a press near the bottom of the
// tree would otherwise draw off screen.
test('on a phone, a Share press brings the whole canvas into view and keeps focus on the button', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(url);
  await seek(page, 'problem', 'every-change');
  const live = liveCollage(page);
  const taco = shareButton(live, 'taco');
  await taco.evaluate(button => button.scrollIntoView({ block: 'end' }));
  await expect(canvasOf(live), 'the canvas starts partly or wholly off screen').not.toBeInViewport({ ratio: 1 });
  await taco.click();
  await expect(statusOf(live)).toHaveText('Shared taco: 1 photo.');
  await expect(canvasOf(live)).toBeInViewport({ ratio: 1 });
  const covered = await canvasOf(live).evaluate(canvas => {
    const box = canvas.getBoundingClientRect();
    return [box.top + 2, box.bottom - 2].filter(y => !canvas.contains(document.elementFromPoint(box.left + box.width / 2, y)));
  });
  expect(covered, 'canvas edges hidden under another element').toEqual([]);
  await expect(taco).toBeFocused();
});

// With motion on, each drawing step stays on screen for 320 ms. The clock
// advances 400 ms per frame, so exactly one more step has happened.
test('with motion on, a Share press draws one tile at a time and outlines each split as it cuts', async ({ page }) => {
  await page.clock.install();
  await page.goto(url);
  await seek(page, 'intro', 'try-it');
  await page.clock.runFor(500);
  const live = liveCollage(page);
  const outline = live.locator('.composite-area-label');
  await shareButton(live, 'story').click();
  await expect(outline).toHaveText('story · side by side');
  await expect(canvasOf(live)).toHaveAccessibleName('Canvas: nothing drawn yet.');
  await page.clock.runFor(400);
  await expect(canvasOf(live)).toHaveAccessibleName(`Canvas, in reading order: beach, ${collage.positions['0,0,2,4']}.`);
  await expect(outline).toHaveText('story · side by side');
  await page.clock.runFor(400);
  await expect(outline).toHaveText('right · stacked');
  await expect(statusOf(live)).toHaveText('');
  await page.clock.runFor(5000);
  await expect(canvasOf(live)).toHaveAccessibleName(collageSpec.pressDescription(collage, panels.start, 'story'));
  await expect(statusOf(live)).toHaveText('Shared story: 4 photos.');
});

test('with motion on, a cue that continues the trace draws its new tiles one at a time', async ({ page }) => {
  await page.clock.install();
  await page.goto(url);
  const live = liveCollage(page);
  await seek(page, 'collaborations', 'press');
  await expect(live.getByText(panels.trace_press.note, { exact: true })).toBeVisible();
  await seek(page, 'collaborations', 'recursion');
  await expect(live.getByText(panels.trace_drawn.note, { exact: true })).toBeVisible();
  await expect(canvasOf(live)).toHaveAccessibleName('Canvas: nothing drawn yet.');
  await page.clock.runFor(400);
  await expect(canvasOf(live)).toHaveAccessibleName(`Canvas, in reading order: beach, ${collage.positions['0,0,2,4']}, drawn 1st.`);
  await expect(treeRows(live).filter({ hasText: 'drawing' })).toHaveCount(1);
  await expect(treeRows(live).filter({ hasText: 'drawing' }).first()).toHaveAttribute('data-tile', 'story');
  await page.clock.runFor(400);
  await expect(treeRows(live).filter({ hasText: 'drawing' }).last()).toHaveAttribute('data-tile', 'right');
  await page.clock.runFor(5000);
  await expect(canvasOf(live)).toHaveAccessibleName(collageSpec.canvasDescription(collage, panels.trace_drawn));
});

test('the illustrations and the Share icons keep their colors in dark mode, in the player and the reader', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const view of [url, viewUrl('read')]) {
    const painted = {};
    for (const dark of [false, true]) {
      await page.goto(view);
      if (view === url) {
        await setSiteTheme(page, dark);
      } else {
        const themeButton = page.getByRole('button', { name: 'Dark mode' });
        if (await themeButton.getAttribute('aria-pressed') !== String(dark)) await themeButton.click();
        await expect(themeButton).toHaveAttribute('aria-pressed', String(dark));
      }
      const scope = view === url ? liveCollage(page) : page.locator('.composite-collage').first();
      painted[dark] = await paintedColor(page, scope.locator('.composite-cell[data-tile="beach"] img.composite-art'));
      // The Share icon is drawn in strokes of the theme's text color; it must not be inverted again.
      const icon = view === url ? shareButton(scope, 'story').locator('svg') : scope.locator('.composite-share-chip svg').first();
      expect(await icon.evaluate(svg => getComputedStyle(svg).filter), `${view} ${dark ? 'dark' : 'light'}: Share icon filter`).toBe('none');
    }
    painted[true].forEach((channel, index) => {
      expect(Math.abs(channel - painted[false][index]), `${view}: the beach art paints ${painted[true]} in dark mode and ${painted[false]} in light`).toBeLessThanOrEqual(6);
    });
  }
});

test('live tiles sit where their areas say, every illustration loads, and narrow chips stay readable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { width: storyWidth, height: storyHeight } = collage.canvas;
  for (const width of [1280, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(url);
    await seek(page, 'intro', 'photo-dump');
    const live = liveCollage(page);
    const canvas = await live.locator('.composite-canvas').boundingBox();
    for (const { tile, area: [x, y, w, h] } of collage.expected.start.drawn) {
      const cell = await live.locator(`.composite-cell[data-tile="${tile}"]`).boundingBox();
      const where = `${tile} at ${width} px`;
      expect(Math.abs(cell.x - (canvas.x + canvas.width * x / storyWidth)), `${where}: left`).toBeLessThanOrEqual(4);
      expect(Math.abs(cell.y - (canvas.y + canvas.height * y / storyHeight)), `${where}: top`).toBeLessThanOrEqual(4);
      expect(Math.abs(cell.width - canvas.width * w / storyWidth), `${where}: width`).toBeLessThanOrEqual(4);
      expect(Math.abs(cell.height - canvas.height * h / storyHeight), `${where}: height`).toBeLessThanOrEqual(4);
    }
    const art = live.locator('.composite-canvas img.composite-art');
    await expect(art).toHaveCount(collage.expected.start.drawn.length);
    const failed = await art.evaluateAll(images => Promise.all(images.map(image => image.decode().then(() => null, () => image.getAttribute('src')))));
    expect(failed.filter(Boolean), 'illustrations that failed to load').toEqual([]);
    const note = await player(page).locator('.nja-scene:visible .nja-note').evaluate(node => parseFloat(getComputedStyle(node).fontSize));
    for (const tile of ['gig', 'taco']) {
      for (const label of await live.locator(`.composite-cell[data-tile="${tile}"]`).locator('.composite-chip, .composite-tag, .composite-badge').all()) {
        const fit = await label.evaluate(node => {
          const box = node.getBoundingClientRect();
          const frame = node.closest('.composite-cell').getBoundingClientRect();
          const style = getComputedStyle(node);
          return {
            size: parseFloat(style.fontSize),
            overflows: node.scrollWidth > node.clientWidth + 1,
            outside: box.left < frame.left - 1 || box.right > frame.right + 1,
            lines: Math.round((box.height - 2) / parseFloat(style.lineHeight)),
          };
        });
        expect(fit.size, `${tile} at ${width} px: text size`).toBeGreaterThanOrEqual(0.9 * note);
        expect(fit.overflows, `${tile} at ${width} px: text overflows its chip`).toBe(false);
        expect(fit.outside, `${tile} at ${width} px: chip sticks out of its tile`).toBe(false);
        expect(fit.lines, `${tile} at ${width} px: a one-word label breaks across lines`).toBe(1);
      }
    }
  }
});

// Below 1100 px the SE Book theme gives every content image `height: auto`, which
// would shrink an illustration to its own proportions inside a taller tile.
test('every illustration covers its tile, and the polaroid frame keeps its border, at desktop, tablet, and phone widths', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const neighbors = story.scenes[sceneIndex('applicability')].cues.findIndex(cue => cue.id === 'neighbors');
  const views = {
    player: async () => { await page.goto(url); await seek(page, 'applicability', 'neighbors'); return liveCollage(page); },
    reader: async () => { await page.goto(viewUrl('read')); await revealAnswers(page); return step(page, 'applicability', neighbors); },
  };
  // Gaps between each illustration and its tile, in em of the tile's text.
  const gaps = scope => scope.locator('.composite-canvas img.composite-art').evaluateAll(images => images.map(image => {
    const cell = image.closest('.composite-cell');
    const art = image.getBoundingClientRect();
    const box = cell.getBoundingClientRect();
    const em = parseFloat(getComputedStyle(cell).fontSize);
    return { tile: cell.dataset.tile, top: (art.top - box.top) / em, right: (box.right - art.right) / em, bottom: (box.bottom - art.bottom) / em, left: (art.left - box.left) / em, em };
  }));
  const desktopFrame = {};
  for (const width of [1280, 800, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [view, open] of Object.entries(views)) {
      const measured = await gaps(await open());
      expect(measured.map(({ tile }) => tile).sort(), `${view} at ${width} px: illustrated tiles`).toEqual(['beach', 'cat', 'gig', 'taco']);
      for (const { tile, em, ...sides } of measured) {
        const where = `${view} at ${width} px: ${tile}`;
        if (tile === collage.neighbors.frame) {
          desktopFrame[view] ??= sides;
          for (const [side, gap] of Object.entries(sides)) expect(gap, `${where}: the frame's ${side} border, in em, as at 1280 px`).toBeCloseTo(desktopFrame[view][side], 1);
        } else {
          for (const [side, gap] of Object.entries(sides)) expect(Math.abs(gap * em), `${where}: gap at the ${side}, in px`).toBeLessThanOrEqual(1);
        }
      }
    }
  }
  expect(desktopFrame.player.bottom, 'the polaroid frame is deeper at the bottom').toBeGreaterThan(desktopFrame.player.top);
});

// ---------------------------------------------------------------------------
// The player: code marks, parts, diagrams, checks, themes, and the reader link.
const examples = yaml.load(readFileSync(require.resolve('../_data/explainers/composite_code.yml'), 'utf8'));

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
    await seekNarration(animation, timing.scenes[index].start + 0.5);
    const parts = animation.locator('.nja-scene:visible').getByRole('list', { name: 'Part of the pattern description' });
    await expect(parts.getByRole('listitem')).toHaveText(['Context', 'Problem', 'Solution', 'Consequences']);
    await expect(parts.locator('[aria-current="step"]')).toHaveText(scene.part ? [scene.part] : []);
  }
});

// The message labels of the first `count` sequence steps, in diagram order.
const messages = (diagram, count) => diagram.steps.slice(0, count)
  .flatMap(step => [...step.matchAll(/-> \w+: (.+)$/gm)].map(match => match[1]));

test('diagrams highlight the cue\'s class, role, or lifeline, and the trace reveals its messages as the narration reaches them', async ({ page }) => {
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
          const x = box.x + box.width / 2;
          const y = box.y + box.height / 2;
          return [...node.closest('svg').querySelectorAll('[fill^="url("]')].some(shape => {
            const area = shape.getBBox();
            return x >= area.x && x <= area.x + area.width && y >= area.y && y <= area.y + area.height;
          });
        }), `${scene.id}/${cue.id}: ${cue.diagram_focus} is highlighted`).toBe(true);
      }
      if (cue.diagram_steps) {
        const labels = [...new Set(messages(source, source.steps.length))];
        const shown = await diagram.locator('svg text').evaluateAll((nodes, wanted) => nodes
          .map(node => node.textContent.trim()).filter(text => wanted.includes(text)), labels);
        expect(shown.sort(), `${scene.id}/${cue.id}`).toEqual(messages(source, cue.diagram_steps).sort());
      }
    }
  }
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
    await seekNarration(animation, end - 0.9);
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
  test(`player, live collage, and quiz are readable and accessible in ${dark ? 'dark' : 'light'} mode, including mobile`, async ({ page }, testInfo) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width: 1500, height: 1000 });
    await page.goto(url);
    await setSiteTheme(page, dark);
    const animation = player(page);
    for (const [id, cue] of [['intro', 'try-it'], ['problem', 'every-change'], ['split_role', 'safe-add'], ['collaborations', 'recursion'], ['solution', 'composite'], ['transfer', 'caption']]) {
      await seek(page, id, cue);
      await a11yCheckpoint(page, `${id} ${dark ? 'dark' : 'light'}`, { include: '#composite-animation .nja-player', feature: 'composite-narration' });
      await animation.locator('.nja-player').screenshot({ path: testInfo.outputPath(`${id}.png`) });
    }
    await page.setViewportSize({ width: 320, height: 850 });
    const mobile = [['problem', 'every-change'], ['collaborations', 'loop'], ['applicability', 'neighbors']];
    for (const [id, cue] of mobile) {
      await seek(page, id, cue);
      await expect.poll(() => animation.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      await a11yCheckpoint(page, `mobile ${id}`, { include: '#composite-animation .nja-player', feature: 'composite-narration' });
    }
    await openPlayerSettings(animation);
    await animation.getByRole('button', { name: 'Knowledge check', exact: true }).click();
    // The Knowledge check button opens the check of the scene the player is on.
    const question = questionsOf(mobile.at(-1)[0])[0];
    const wrong = Number(Object.keys(question.option_feedback)[0]);
    await animation.getByRole('region', { name: /— (Knowledge check|Summary quiz)$/ }).getByRole('radio').filter({ hasText: question.options[wrong] }).click();
    await expect(animation.getByText(question.option_feedback[wrong], { exact: true })).toBeVisible();
    await a11yCheckpoint(page, 'mobile incorrect answer', { include: '#composite-animation .nja-player', feature: 'composite-narration' });
    await animation.locator('.nja-player').screenshot({ path: testInfo.outputPath('quiz-mobile.png') });
  });
}

test('reading view keeps the chosen language and theme', async ({ page }) => {
  await page.goto(url);
  await player(page).getByRole('combobox', { name: 'Code language' }).selectOption('java');
  await setSiteTheme(page, true);
  await player(page).getByRole('link', { name: 'Read at my own pace', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Code language' })).toHaveValue('java');
  await expect(page.locator('[data-transcript-language="python"]:visible')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Dark mode' })).toHaveAttribute('aria-pressed', 'true');
  await page.setViewportSize({ width: 320, height: 850 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
