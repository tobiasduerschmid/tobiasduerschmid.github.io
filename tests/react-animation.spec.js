const { loadStory } = require('../scripts/narration/source');
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');
const { chromiumLaunchOptions } = require('../scripts/chromium-launch-options');
// Decode real audio on a virtual output; CI must not depend on a sound device.
test.use({ launchOptions: { ...chromiumLaunchOptions(), args: ['--disable-audio-output'] } });
const story = loadStory('react');
const timing = require('../_data/explainers/react_timing.json');
const pageURL = '/SEBook/tools/react.html';
const player = (page) => page.getByRole('region', { name: 'React in motion', exact: true });

async function seekToCue(page, sceneId, pose) {
  const sceneIndex = story.scenes.findIndex((scene) => scene.id === sceneId);
  const cueIndex = story.scenes[sceneIndex].cues.findIndex((cue) => cue.pose === pose);
  const animation = player(page);
  await animation.getByRole('combobox', { name: 'Scene', exact: true }).selectOption(String(sceneIndex));
  const cue = timing.scenes[sceneIndex].cues[cueIndex];
  const time = Number(((cue.start + cue.end) / 2).toFixed(2));
  await animation.getByRole('slider', { name: 'Animation position' }).fill(String(time));
  await expect(animation.getByRole('region', { name: 'Narration' })).toHaveText(story.scenes[sceneIndex].cues[cueIndex].text);
  await expect.poll(() => animation.getByLabel('React narration by Kokoro').evaluate((audio) => audio.currentTime)).toBeCloseTo(time, 1);
  return animation.getByRole('img');
}

test('starts paused with a complete downloadable script, captions and compressed Kokoro MP3', async ({ page, request }) => {
  await page.goto(pageURL);
  const animation = player(page);
  await expect(animation.getByRole('button', { name: 'Play narration' })).toBeVisible();
  await expect(animation.getByRole('slider', { name: 'Animation position' })).toHaveValue('0');
  await expect(animation.getByRole('heading', { name: 'Describe the screen from data' })).toBeVisible();
  await expect(animation.getByText('Narration: Kokoro.', { exact: false })).toBeVisible();
  await expect(animation.getByText('No music.', { exact: false })).toHaveCount(0);
  for (const [name, phrase] of [['Download TTS script', 'React is a Javascript library'], ['Download narration', null]]) {
    const link = animation.getByRole('link', { name, exact: true });
    const response = await request.get(await link.getAttribute('href'));
    expect(response.ok()).toBe(true);
    if (phrase) expect(await response.text()).toContain(phrase);
    else {
      expect(response.headers()['content-type']).toMatch(/^audio\/(mpeg|mp3)\b/);
      expect((await response.body()).length * 8 / timing.duration).toBeLessThan(64000);
    }
  }
  const captions = await request.get(story.captions);
  expect(captions.ok()).toBe(true);
  expect(await captions.text()).toContain('WEBVTT');
});

test('actual MP3 playback drives progress, pauses, and supports transport and speed', async ({ page }) => {
  await page.goto(pageURL);
  const animation = player(page);
  await animation.getByRole('button', { name: 'Play narration' }).click();
  const slider = animation.getByRole('slider', { name: 'Animation position' });
  await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(0.2);
  const audio = animation.getByLabel('React narration by Kokoro');
  expect(await audio.evaluate((element) => element.duration)).toBeCloseTo(timing.duration, 0);
  await animation.getByRole('combobox', { name: 'Speed', exact: true }).selectOption('1.25');
  expect(await audio.evaluate((element) => element.playbackRate)).toBe(1.25);
  await animation.getByRole('button', { name: 'Mute narration', exact: true }).click();
  expect(await audio.evaluate((element) => element.muted)).toBe(true);
  await animation.getByRole('button', { name: 'Pause narration' }).click();
  await expect(animation.getByRole('button', { name: 'Play narration' })).toBeVisible();
  const pausedAt = await audio.evaluate((element) => element.currentTime);
  await page.clock.install();
  await page.clock.fastForward(2000);
  expect(await audio.evaluate((element) => element.currentTime)).toBe(pausedAt);
  // A final media timeupdate may settle the range to the nearest hundredth.
  await expect.poll(async () => Number(await slider.inputValue())).toBeCloseTo(pausedAt, 2);
  await animation.getByRole('button', { name: 'Next scene' }).click();
  await expect(animation.getByRole('heading', { name: 'A function that describes UI' })).toBeVisible();
  await animation.getByRole('button', { name: 'Previous scene' }).click();
  await slider.focus();
  await slider.press('End');
  await expect(animation.getByRole('heading', { name: "Synchronize beyond React's UI" })).toBeVisible();
  await animation.getByRole('button', { name: 'Restart narration' }).click();
  await expect(slider).toHaveValue('0');
});

test('one click leaves its snapshot unchanged, then commits the next render', async ({ page }) => {
  await page.goto(pageURL);
  const art = await seekToCue(page, 'events', 'click');
  await expect(art.locator('.ra-snapshot')).toContainText('likes = 0');
  await expect(art.locator('.ra-request')).toContainText('next likes = 1');
  await expect(art.locator('.ra-button')).toContainText('Like: 0');
  await seekToCue(page, 'events', 'commit');
  await expect(art.locator('.ra-snapshot')).toContainText('likes = 1');
  await expect(art.locator('.ra-button')).toContainText('Like: 1');
  await expect(art.locator('.ra-course-title')).toHaveText('React');
  await seekToCue(page, 'events', 'handler');
  await expect(art.locator('.ra-button')).toContainText('Like: 0');
});

test('prediction hides the answer and contrasts replacement with updater functions', async ({ page }) => {
  await page.goto(pageURL);
  const art = await seekToCue(page, 'updates', 'question');
  await expect(art.locator('.ra-mini-preview')).toHaveText('Next buttonLike: ?');
  await seekToCue(page, 'updates', 'replace');
  await expect(art.locator('.ra-mini-preview')).toHaveText('Next buttonLike: 1');
  await expect(art.locator('pre:visible')).toContainText('setLikes(likes + 1)');
  await seekToCue(page, 'updates', 'updater');
  await expect(art.locator('.ra-mini-preview')).toHaveText('Next buttonLike: 2');
  await expect(art.locator('pre:visible')).toContainText('setLikes(n => n + 1)');
  await seekToCue(page, 'updates', 'question');
  await expect(art.locator('.ra-queue-result')).toHaveText(['?', '?']);
});

test('shared state, stable keys, and effects agree with their narrated outcomes', async ({ page }) => {
  await page.goto(pageURL);
  const art = await seekToCue(page, 'shared', 'together');
  await expect(art.locator('.ra-button')).toContainText('Like: 1');
  await expect(art.locator('.ra-shared-total')).toHaveText('Total: 1');
  await expect(art.locator('pre:visible')).toContainText('onClick={onLike}');
  await seekToCue(page, 'shared', 'owner');
  await expect(art.locator('.ra-shared-total')).toHaveText('Total: 0');
  await seekToCue(page, 'lists', 'keys');
  let reactItem = await art.locator('.ra-item-react').boundingBox();
  let nodeItem = await art.locator('.ra-item-node').boundingBox();
  expect(nodeItem.y + nodeItem.height).toBeLessThanOrEqual(reactItem.y);
  await expect(art.locator('.ra-item-react .ra-key')).toHaveText('r');
  await seekToCue(page, 'lists', 'map');
  reactItem = await art.locator('.ra-item-react').boundingBox();
  nodeItem = await art.locator('.ra-item-node').boundingBox();
  expect(reactItem.y + reactItem.height).toBeLessThanOrEqual(nodeItem.y);
  await seekToCue(page, 'effects', 'synchronize');
  await expect(art.locator('.ra-tab-title')).toHaveText('Likes: 1');
  await seekToCue(page, 'effects', 'outside');
  await expect(art.locator('.ra-tab-title')).toHaveText('Courses');
});

test('reduced motion, no-JavaScript and print retain the complete lesson', async ({ browser, page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(pageURL);
  await expect(player(page).getByLabel('Animate visuals')).not.toBeChecked();
  await player(page).getByRole('combobox', { name: 'Scene', exact: true }).selectOption('7');
  await expect(player(page).getByRole('img')).toContainText('Course data');
  await page.emulateMedia({ media: 'print' });
  await expect(player(page).getByText(/Here is the adapted child/)).toBeVisible();
  await expect(player(page).getByRole('button', { name: 'Play narration' })).toBeHidden();
  const context = await browser.newContext({ javaScriptEnabled: false });
  const fallback = await context.newPage();
  await fallback.goto(pageURL);
  await expect(player(fallback).getByLabel('React narration by Kokoro')).toBeVisible();
  await player(fallback).getByText('Transcript and visual descriptions', { exact: true }).click();
  await expect(player(fallback).getByText(/Here is the adapted child/)).toBeVisible();
  await context.close();
});

for (const combinedPage of ['/SEBook/CS35L.html', '/SEBook/all.html']) {
  test(`both explainers initialize independently on ${combinedPage}`, async ({ page }, testInfo) => {
    test.setTimeout(120000);
    const errors = [];
    page.on('pageerror', (error) => {
      // Existing all-book asset-loading debt, predating these explainers. Keep
      // it visible in the report without hiding any new player exceptions.
      if (error.message === "Cannot read properties of undefined (reading 'create')"
          && error.stack?.includes('mountWriteInQuestions')) {
        testInfo.annotations.push({ type: 'known-existing-error', description: 'The combined book does not load WriteInQuiz before mounting write-in questions.' });
      } else errors.push(error.message);
    });
    await page.goto(combinedPage, { waitUntil: 'domcontentloaded' });
    const react = player(page);
    const node = page.getByRole('region', { name: 'Node.js in motion', exact: true });
    await expect(react.getByRole('button', { name: 'Play narration' })).toBeVisible();
    await expect(node.getByRole('button', { name: 'Play narration' })).toBeVisible();
    await react.getByRole('combobox', { name: 'Scene', exact: true }).selectOption('4');
    await expect(react.getByRole('heading', { name: 'Follow one click to the screen' })).toBeVisible();
    await expect(node.getByRole('combobox', { name: 'Scene', exact: true })).toHaveValue('0');
    await node.getByRole('combobox', { name: 'Scene', exact: true }).selectOption('2');
    await expect(node.getByRole('heading', { name: 'Blocking: the thread waits' })).toBeVisible();
    await expect(react.getByRole('combobox', { name: 'Scene', exact: true })).toHaveValue('4');
    await expect(react.getByRole('img')).toHaveAttribute('aria-label', story.scenes[4].cues[0].visual);
    expect(errors).toEqual([]);
  });
}

for (const variant of [
  { name: 'desktop light', width: 1440, height: 1050, dark: false },
  { name: 'mobile dark', width: 320, height: 850, dark: true },
]) {
  test(`every cue is readable and accessible in ${variant.name}`, async ({ page }, testInfo) => {
    test.setTimeout(180000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width: variant.width, height: variant.height });
    await page.goto(pageURL);
    const theme = page.getByRole('checkbox', { name: 'Toggle dark mode' });
    if (await theme.isChecked() !== variant.dark) await theme.press('Space');
    for (const scene of story.scenes) {
      for (const cue of scene.cues) {
        const art = await seekToCue(page, scene.id, cue.pose);
        await expect(art).toHaveAttribute('aria-label', cue.visual);
        expect(await art.evaluate((element) => element.scrollWidth - element.clientWidth), `${scene.id}/${cue.pose} overflow`).toBeLessThanOrEqual(1);
        const icons = await art.locator('i:visible').evaluateAll((elements) => elements
          .filter((element) => ['none', 'normal', '""'].includes(getComputedStyle(element, '::before').content))
          .map((element) => element.className));
        expect(icons).toEqual([]);
        await a11yCheckpoint(page, `${variant.name}: ${scene.id}/${cue.pose}`, { include: '#react-animation', feature: 'react-animation' });
        await player(page).locator('.nja-player').screenshot({ path: testInfo.outputPath(`${scene.id}-${cue.pose}.png`) });
      }
    }
    const art = await seekToCue(page, 'jsx', 'expression');
    const code = art.locator('pre:visible');
    const colors = [];
    for (const token of ['const', 'React', 'h2', 'className']) {
      colors.push(await code.getByText(token, { exact: true }).first().evaluate((element) => getComputedStyle(element).color));
    }
    expect(new Set(colors).size, 'JSX keywords, strings, tags, and attributes must be distinct.').toBe(4);
    await player(page).getByText('Transcript and visual descriptions', { exact: true }).click();
    await expect(player(page).getByRole('code').filter({ hasText: 'const title = "React"' })).toHaveText(story.scenes.find((scene) => scene.id === 'jsx').code);
    await a11yCheckpoint(page, `${variant.name}: full transcript`, { include: '#react-animation', feature: 'react-animation' });
    expect(errors).toEqual([]);
  });
}
