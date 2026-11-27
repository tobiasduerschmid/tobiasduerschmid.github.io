// Closer looks: an optional code example offered during one cue. Opening it
// pauses the narration; continuing resumes where it paused; ignoring it costs
// nothing. The Layers lesson's first look is the reference example.
const { test, expect } = require('@playwright/test');
const { readFileSync } = require('node:fs');
const { a11yCheckpoint } = require('./a11y-helpers');
const { lessonIds, loadLesson } = require('../scripts/narration/source');
const { closerLookAnchors } = require('../scripts/narration/closer-look');

const timing = JSON.parse(readFileSync('_data/explainers/layered_style_timing.json', 'utf8'));
const cue = timing.scenes.find(scene => scene.id === 'callbacks').cues.find(item => item.id === 'not_uses');
const inside = Math.round((cue.start + cue.end) / 2);
const clock = time => `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`;
const TITLE = 'Calls go up, imports point down';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener('play', event => {
      if (event.target instanceof HTMLMediaElement) event.target.muted = true;
    }, true);
  });
  // WEBrick otherwise sometimes answers conditional MP3 range requests with 304.
  await page.route('**/assets/audio/**', route => {
    const headers = { ...route.request().headers() };
    if (headers.range) { delete headers['if-none-match']; delete headers['if-modified-since']; }
    return route.continue({ headers });
  });
});

async function openLayers(page) {
  await page.goto('/SEBook/architectural_styles/layers.html');
  const player = page.getByRole('region', { name: 'One floor down', exact: true });
  await expect(player.getByRole('button', { name: 'Play narration', exact: true })).toBeVisible();
  return player;
}
const position = player => player.getByRole('slider', { name: 'Narration position' });
const offer = player => player.getByRole('button', { name: `See it in code: ${TITLE}` });
const panel = player => player.getByRole('region', { name: TITLE });
async function seek(player, seconds) {
  await position(player).fill(String(seconds));
}

test('the offer shows only while its cue plays', async ({ page }) => {
  const player = await openLayers(page);
  await seek(player, cue.start - 3);
  await expect(offer(player)).toBeHidden();
  await seek(player, inside);
  await expect(offer(player)).toBeVisible();
  await seek(player, cue.end + 3);
  await expect(offer(player)).toBeHidden();
});

test('E opens the look, pauses the narration, and focuses its heading', async ({ page }) => {
  const player = await openLayers(page);
  await seek(player, inside);
  await player.getByRole('button', { name: 'Play narration', exact: true }).click();
  await expect(player.getByRole('button', { name: 'Pause narration', exact: true })).toBeVisible();
  await page.keyboard.press('e');
  await expect(panel(player)).toBeVisible();
  await expect(panel(player).getByRole('heading', { name: TITLE })).toBeFocused();
  await expect(player.getByRole('button', { name: 'Play narration', exact: true })).toBeVisible();
  await a11yCheckpoint(page, 'closer look open', { include: '.narration-closer-look:not([hidden])', feature: 'narration-closer-look' });
});

test('Continue narration resumes where the look paused it', async ({ page }) => {
  const player = await openLayers(page);
  await seek(player, inside);
  await offer(player).click();
  const resume = panel(player).getByRole('button', { name: `Continue narration (${clock(inside)})` }).first();
  await resume.click();
  await expect(panel(player)).toBeHidden();
  await expect(player.getByRole('button', { name: 'Pause narration', exact: true })).toBeVisible();
  await expect.poll(async () => Number(await position(player).inputValue())).toBeGreaterThan(inside);
  expect(Number(await position(player).inputValue())).toBeLessThan(inside + 5);
});

test('Escape closes the look, keeps the narration paused, and returns to the offer', async ({ page }) => {
  const player = await openLayers(page);
  await seek(player, inside);
  await offer(player).click();
  await expect(panel(player)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel(player)).toBeHidden();
  await expect(player.getByRole('button', { name: 'Play narration', exact: true })).toBeVisible();
  await expect(offer(player)).toBeFocused();
});

test('the timeline marker opens the look at its cue from anywhere', async ({ page }) => {
  const player = await openLayers(page);
  await player.getByRole('button', { name: `Closer look: ${TITLE}, at ${clock(cue.start)}` }).click();
  await expect(panel(player)).toBeVisible();
  expect(Number(await position(player).inputValue())).toBeCloseTo(cue.start, 0);
  await expect(panel(player).getByRole('button', { name: `Continue narration (${clock(cue.start)})` }).first()).toBeVisible();
});

test('playing or seeking elsewhere leaves the look', async ({ page }) => {
  const player = await openLayers(page);
  await seek(player, inside);
  await offer(player).click();
  await player.getByRole('button', { name: 'Play narration', exact: true }).click();
  await expect(panel(player)).toBeHidden();
  await expect(player.getByRole('button', { name: 'Pause narration', exact: true })).toBeVisible();
  await player.getByRole('button', { name: 'Pause narration', exact: true }).click();
  await offer(player).click();
  await seek(player, 30);
  await expect(panel(player)).toBeHidden();
});

test('Replay the explanation plays its cue from the start', async ({ page }) => {
  const player = await openLayers(page);
  await seek(player, inside);
  await offer(player).click();
  await panel(player).getByRole('button', { name: `Replay the explanation (${clock(cue.start)})` }).click();
  await expect(panel(player)).toBeHidden();
  await expect(player.getByRole('button', { name: 'Pause narration', exact: true })).toBeVisible();
  const at = Number(await position(player).inputValue());
  expect(at).toBeGreaterThanOrEqual(cue.start - 0.1);
  expect(at).toBeLessThan(inside);
});

test('steps focus the lines they discuss, and a removed layer is marked', async ({ page }) => {
  const player = await openLayers(page);
  await seek(player, inside);
  await offer(player).click();
  const look = panel(player);
  await look.getByRole('button', { name: 'Who imports whom?' }).click();
  await expect(look.getByRole('button', { name: 'Who imports whom?' })).toHaveAttribute('aria-pressed', 'true');
  await expect(look.locator('[data-code-language="python"] [aria-current="true"]').first()).toContainText('from engine.core import Body, CollisionListener, Engine');
  await look.getByRole('button', { name: 'Remove a layer' }).click();
  await expect(look.getByRole('group', { name: '«layer» Game rules' }).first()).toContainText('deleted');
  await expect(look.getByRole('group', { name: '«layer» Engine' }).first()).toContainText('still builds');
});

test('the code language follows the site preference and every language fits without wrapping', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const player = await openLayers(page);
  await seek(player, inside);
  await offer(player).click();
  const select = panel(player).getByRole('combobox', { name: 'Example language' });
  for (const language of ['python', 'java', 'cpp', 'typescript']) {
    await select.selectOption(language);
    const heights = await panel(player).locator(`[data-code-language="${language}"] .nja-code-line`).evaluateAll(lines => lines.map(line => line.getBoundingClientRect().height));
    expect(Math.max(...heights), `${language} lines wrap`).toBeLessThan(Math.min(...heights) * 1.5);
  }
  const saved = (await page.context().cookies()).find(cookie => cookie.name === 'sebook-code-language');
  expect(saved && saved.value).toBe('typescript');
});

test('in viewport full screen, Escape closes the look and stays in full screen', async ({ page }) => {
  await page.addInitScript(() => {
    delete Element.prototype.requestFullscreen;
    delete Element.prototype.webkitRequestFullscreen;
  });
  const player = await openLayers(page);
  await seek(player, inside);
  await player.getByRole('button', { name: 'Enter full screen' }).click();
  await expect(player.getByRole('button', { name: 'Exit full screen' })).toBeAttached();
  await offer(player).click();
  await expect(panel(player)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel(player)).toBeHidden();
  await expect(player.getByRole('button', { name: 'Exit full screen' })).toBeAttached();
});

test('on a phone the offer sits under the picture and the code scrolls instead of drawing arrows', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const player = await openLayers(page);
  await seek(player, inside);
  const picture = await player.locator('.nja-stage').boundingBox();
  const offerBox = await offer(player).boundingBox();
  expect(offerBox.y).toBeGreaterThanOrEqual(picture.y + picture.height - 1);
  await offer(player).click();
  await expect(panel(player).locator('.narration-closer-look-relations').first()).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('dark mode keeps the relation arrows in theme colors', async ({ page }) => {
  const player = await openLayers(page);
  await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
  await seek(player, inside);
  await offer(player).click();
  const relations = panel(player).locator('[data-code-language="python"] .narration-closer-look-relations');
  await expect(relations).toHaveCSS('filter', 'none');
});

test('a lesson without closer looks shows no offer or marker', async ({ page }) => {
  await page.goto('/SEBook/process/scrum.html');
  const player = page.getByRole('region', { name: 'Scrum in one sprint', exact: true });
  await expect(player.getByRole('button', { name: 'Play narration', exact: true })).toBeVisible();
  await expect(player.locator('[data-closer-look-offer]')).toHaveCount(0);
  await expect(player.getByRole('group', { name: 'Open a closer look' })).toBeHidden();
});

for (const [view, url] of [['lesson notes', '/SEBook/architectural_styles/layers/notes/'], ['reading view', '/SEBook/architectural_styles/layers/read/']]) {
  test(`the ${view} show the closer look after its cue with every step`, async ({ page }) => {
    await page.goto(url);
    const look = page.getByRole('region', { name: `Closer look ${TITLE}` });
    await expect(look).toBeVisible();
    for (const question of ['Who owns the interface?', 'Who calls whom?', 'Who imports whom?', 'Remove a layer']) {
      await expect(look.getByText(question, { exact: true })).toBeVisible();
    }
    await expect(look.locator('[data-code-language]:not([hidden])')).toContainText('from engine.core import Body, CollisionListener, Engine');
    await look.getByRole('combobox', { name: 'Example language' }).selectOption('java');
    await expect(look.locator('[data-code-language]:not([hidden])')).toContainText('public interface CollisionListener');
    // A static closer look shows the language for this page only; it saves no preference.
    expect((await page.context().cookies()).find(cookie => cookie.name === 'sebook-code-language')).toBeUndefined();
    expect(await page.evaluate(() => localStorage.getItem('sebook-code-language'))).toBeNull();
    await a11yCheckpoint(page, `closer look in the ${view}`, { include: '.narration-closer-look--static', feature: 'narration-closer-look' });
  });
}

test('printed notes keep the closer look and drop its language select', async ({ page }) => {
  await page.emulateMedia({ media: 'print' });
  await page.goto('/SEBook/architectural_styles/layers/notes/');
  const look = page.getByRole('region', { name: `Closer look ${TITLE}` });
  await expect(look).toBeVisible();
  await expect(look.getByRole('combobox', { name: 'Example language' })).toBeHidden();
  await expect(look.locator('[data-code-language]:not([hidden]) pre').first()).toBeVisible();
});

test('the shortcuts page documents the closer-look key', async ({ page }) => {
  await page.goto('/shortcuts/');
  const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'E', exact: true }) });
  await expect(row).toContainText('closer look');
});

// Every lesson's looks: the marker opens each one in its own player, every
// language fits the desktop panel without wrapping, and Continue returns.
const lessonsWithLooks = lessonIds().map(topic => loadLesson(topic)).filter(lesson => closerLookAnchors(lesson.story).length);
for (const lesson of lessonsWithLooks) {
  const lessonTiming = JSON.parse(readFileSync(`_data/explainers/${lesson.id}_timing.json`, 'utf8'));
  for (const { scene, cue: cueId, look } of closerLookAnchors(lesson.story)) {
    test(`${lesson.id}: the closer look "${look.title}" opens, fits, and returns`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(lesson.lesson.chapter);
      const player = page.getByRole('region', { name: lesson.story.title, exact: true });
      await expect(player.getByRole('button', { name: 'Play narration', exact: true })).toBeVisible();
      const start = lessonTiming.scenes.find(item => item.id === scene).cues.find(item => item.id === cueId).start;
      await player.getByRole('button', { name: `Closer look: ${look.title}, at ${clock(start)}` }).click();
      const lookPanel = player.getByRole('region', { name: look.title, exact: true });
      await expect(lookPanel).toBeVisible();
      await expect(lookPanel.getByRole('heading', { name: look.title })).toBeFocused();
      const select = lookPanel.getByRole('combobox', { name: 'Example language' });
      for (const language of await select.locator('option').evaluateAll(options => options.map(option => option.value))) {
        await select.selectOption(language);
        const heights = await lookPanel.locator(`[data-code-language="${language}"] .nja-code-line`).evaluateAll(lines => lines.map(line => line.getBoundingClientRect().height));
        expect(Math.max(...heights), `${language} lines wrap`).toBeLessThan(Math.min(...heights) * 1.5);
      }
      for (const [index, step] of look.steps.entries()) {
        await lookPanel.getByRole('button', { name: step.question, exact: true }).click();
        await expect(lookPanel.locator('[data-closer-look-step-text]').nth(index)).toBeVisible();
        await expect(lookPanel.locator('[data-code-language]:not([hidden]) [aria-current="true"]').first()).toBeVisible();
      }
      await a11yCheckpoint(page, `${lesson.id} closer look`, { include: '.narration-closer-look:not([hidden])', feature: 'narration-closer-look' });
      await lookPanel.getByRole('button', { name: /^▶? ?Continue (narration|lesson)/ }).first().click();
      await expect(lookPanel).toBeHidden();
    });
  }
}

test('a knowledge check hides the offer, and E does not open a look over it', async ({ page }) => {
  const player = await openLayers(page);
  await player.getByRole('button', { name: 'Knowledge check: Rules: sending news upward' }).click();
  await expect(player.getByRole('region', { name: /Knowledge check$/ })).toBeVisible();
  await expect(offer(player)).toBeHidden();
  await page.keyboard.press('e');
  await expect(panel(player)).toBeHidden();
});

test('Escape from the example language select closes the look and stays in viewport full screen', async ({ page }) => {
  await page.addInitScript(() => {
    delete Element.prototype.requestFullscreen;
    delete Element.prototype.webkitRequestFullscreen;
  });
  const player = await openLayers(page);
  await seek(player, inside);
  await player.getByRole('button', { name: 'Enter full screen' }).click();
  await offer(player).click();
  await panel(player).getByRole('combobox', { name: 'Example language' }).focus();
  await page.keyboard.press('Escape');
  await expect(panel(player)).toBeHidden();
  await expect(player.getByRole('button', { name: 'Exit full screen' })).toBeAttached();
});

test('a case study page has unique closer-look ids in its player and transcript', async ({ page }) => {
  await page.goto(loadLesson('therac25').lesson.chapter);
  const ids = await page.locator('[id*="-look-"]').evaluateAll(elements => elements.map(element => element.id));
  expect(ids.length).toBeGreaterThan(1);
  expect(new Set(ids).size).toBe(ids.length);
});

test('printed reading views drop the screen-only arrows and keep group tabs off the code', async ({ page }) => {
  await page.emulateMedia({ media: 'print' });
  await page.goto('/SEBook/architectural_styles/layers/read/');
  const look = page.getByRole('region', { name: `Closer look ${TITLE}` });
  await expect(look.locator('.narration-closer-look-relations').first()).toBeHidden();
  await expect(look.locator('.narration-closer-look-legend')).toBeHidden();
  await expect(look.locator('.narration-closer-look-group-tab').first()).toHaveCSS('position', 'static');
});
