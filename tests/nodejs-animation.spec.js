const { loadStory } = require('../scripts/narration/source');
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');
const { chromiumLaunchOptions } = require('../scripts/chromium-launch-options');
// Decode real audio on a virtual output; CI must not depend on a sound device.
test.use({ launchOptions: { ...chromiumLaunchOptions(), args: ['--disable-audio-output'] } });
const timing = require('../_data/explainers/nodejs_timing.json');
const { readFileSync } = require('node:fs');
const story = loadStory('nodejs');

const pageURL = '/SEBook/tools/nodejs.html';
const player = (page) => page.getByRole('region', { name: 'Node.js in motion', exact: true });

async function seekToCue(page, sceneId, pose) {
  const index = story.scenes.findIndex((scene) => scene.id === sceneId);
  const cueIndex = story.scenes[index].cues.findIndex((cue) => cue.pose === pose);
  const animation = player(page);
  await animation.getByRole('combobox', { name: 'Scene' }).selectOption(String(index));
  const cue = timing.scenes[index].cues[cueIndex];
  const time = Number(((cue.start + cue.end) / 2).toFixed(2));
  await animation.getByRole('slider', { name: 'Animation position' }).fill(String(time));
  await expect(animation.getByRole('region', { name: 'Narration' })).toHaveText(story.scenes[index].cues[cueIndex].text);
  const audio = animation.getByLabel('Node.js narration by Kokoro');
  await expect.poll(() => audio.evaluate((element) => element.currentTime)).toBeCloseTo(time, 1);
  return animation.getByRole('img');
}

test('Node.js explainer starts paused and provides its complete narration', async ({ page, request }) => {
  await page.goto(pageURL);
  const animation = player(page);
  await expect(animation.getByRole('button', { name: 'Play narration' })).toBeVisible();
  await expect(animation.getByRole('heading', { name: 'JavaScript beyond the browser' })).toBeVisible();
  await expect(animation.getByRole('slider', { name: 'Animation position' })).toHaveValue('0');
  await animation.getByText('Transcript and visual descriptions', { exact: true }).click();
  await expect(animation.getByText(/A callback is a function you pass/)).toBeVisible();
  const scriptLink = animation.getByRole('link', { name: 'Download TTS script' });
  const response = await request.get(await scriptLink.getAttribute('href'));
  expect(response.ok()).toBe(true);
  expect(await response.text()).toContain('A callback is a function you pass');
});

test('scene navigation synchronizes the blocking and non-blocking explanations', async ({ page }) => {
  await page.goto(pageURL);
  const animation = player(page);
  await animation.getByRole('combobox', { name: 'Scene' }).selectOption({ label: '3. Blocking' });
  await expect(animation.getByRole('heading', { name: 'Blocking: the thread waits' })).toBeVisible();
  await expect(animation.getByRole('region', { name: 'Narration' })).toContainText('readFileSync');
  await animation.getByRole('button', { name: 'Next scene' }).click();
  await expect(animation.getByRole('heading', { name: 'Non-blocking: use the waiting time' })).toBeVisible();
  await expect(animation.getByRole('region', { name: 'Narration' })).toContainText(/readFile/i);
  await a11yCheckpoint(page, 'non-blocking scene', { include: '#nodejs-animation', feature: 'nodejs-animation' });
  await animation.getByRole('button', { name: 'Previous scene' }).click();
  await expect(animation.getByRole('heading', { name: 'Blocking: the thread waits' })).toBeVisible();
});

test('Kokoro narration plays and pauses with synchronized animation progress', async ({ page }) => {
  await page.goto(pageURL);
  const animation = player(page);
  await animation.getByRole('button', { name: 'Play narration' }).click();
  await expect(animation.getByRole('button', { name: 'Pause narration' })).toBeVisible();
  const position = animation.getByRole('slider', { name: 'Animation position' });
  await expect.poll(async () => Number(await position.inputValue())).toBeGreaterThan(0.2);
  const audio = animation.getByLabel('Node.js narration by Kokoro');
  expect(await audio.evaluate((element) => element.currentSrc)).toMatch(/nodejs-basics\.mp3$/);
  expect(await audio.evaluate((element) => element.duration)).toBeCloseTo(timing.duration, 0);
  await animation.getByRole('button', { name: 'Pause narration' }).click();
  await expect(animation.getByRole('button', { name: 'Play narration' })).toBeVisible();
  const pausedAt = await audio.evaluate((element) => element.currentTime);
  await page.clock.install();
  await page.clock.fastForward(2000);
  expect(await audio.evaluate((element) => element.currentTime)).toBe(pausedAt);
  // A final media timeupdate may settle the range to the nearest hundredth.
  await expect.poll(async () => Number(await position.inputValue())).toBeCloseTo(pausedAt, 2);
});

test('narration downloads as a compressed MP3 and the credit omits the music note', async ({ page, request }) => {
  await page.goto(pageURL);
  const animation = player(page);
  const download = animation.getByRole('link', { name: 'Download narration', exact: true });
  const response = await request.get(await download.getAttribute('href'));
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toMatch(/^audio\/(?:mpeg|mp3)\b/);
  expect((await response.body()).length * 8 / timing.duration).toBeLessThan(64000);
  await expect(animation.getByText('Narration: Kokoro.', { exact: false })).toBeVisible();
  await expect(animation.getByText('No music.', { exact: false })).toHaveCount(0);
});

test('keyboard seeking reaches the last scene and replay returns to the start', async ({ page }) => {
  await page.goto(pageURL);
  const animation = player(page);
  const seek = animation.getByRole('slider', { name: 'Animation position' });
  await seek.focus();
  await seek.press('End');
  await expect(animation.getByRole('heading', { name: 'Predict the output' })).toBeVisible();
  await expect(animation.getByRole('region', { name: 'Narration' })).toContainText('A, C, B');
  await animation.getByRole('button', { name: 'Restart narration' }).click();
  await expect(seek).toHaveValue('0');
  await expect(animation.getByRole('heading', { name: 'JavaScript beyond the browser' })).toBeVisible();
});

test('seeking within the callback scene reveals matching syntax and narration', async ({ page }) => {
  await page.goto(pageURL);
  const art = await seekToCue(page, 'callbacks', 'error');
  await expect(art.locator('pre:visible')).toContainText('if (error)');
  await expect(art.locator('pre:visible')).toContainText('return;');
  await expect(art.locator('.nja-terminal code')).toHaveText('Error: file missing');
  await a11yCheckpoint(page, 'callback error branch', { include: '#nodejs-animation', feature: 'nodejs-animation' });
  await seekToCue(page, 'callbacks', 'inline');
  await expect(art.locator('pre:visible')).toContainText('(error, text) => {');
  await seekToCue(page, 'callbacks', 'success');
  await expect(art.locator('.nja-terminal code')).toHaveText('Hello from disk.');
  await expect(art.locator('pre:visible')).toContainText('function onFile(error, text)');
});

test('blocking and non-blocking scenes trace different output orders for the same file', async ({ page }) => {
  await page.goto(pageURL);
  const art = await seekToCue(page, 'blocking', 'read');
  await expect(art.locator('.nja-terminal code')).toHaveText('(nothing yet)');
  await expect(art).toContainText('Waiting inside readFileSync');
  await seekToCue(page, 'blocking', 'complete');
  await expect(art.locator('.nja-terminal code')).toHaveText('Hello from disk.\nNext');
  await seekToCue(page, 'nonblocking', 'continue');
  await expect(art.locator('.nja-terminal code')).toHaveText('Next');
  await expect(art).toContainText('Reading note.txt');
  await seekToCue(page, 'nonblocking', 'run');
  await expect(art.locator('.nja-terminal code')).toHaveText('Next\nHello from disk.');
  await seekToCue(page, 'nonblocking', 'ready');
  await expect(art.locator('.nja-terminal code')).toHaveText('Next');
});

test('a newer seek wins when metadata arrives during a chapter jump', async ({ page }) => {
  await page.goto(pageURL);
  const animation = player(page);
  const cue = timing.scenes.find((scene) => scene.id === 'blocking').cues[1];
  const target = Number(((cue.start + cue.end) / 2).toFixed(2));
  const audio = animation.getByLabel('Node.js narration by Kokoro');
  // Model a new control input after metadata becomes readable but before its
  // queued listener applies the chapter selection. No network or audio is mocked.
  await audio.evaluate((element, time) => {
    element.addEventListener('loadedmetadata', () => {
      const seek = element.closest('section').querySelector('input[type="range"]');
      seek.value = String(time);
      seek.dispatchEvent(new Event('input', { bubbles: true }));
    }, { once: true, capture: true });
  }, target);
  await animation.getByRole('combobox', { name: 'Scene' }).selectOption('2');
  await expect.poll(() => audio.evaluate((element) => element.currentTime)).toBeCloseTo(target, 1);
  await expect(animation.getByRole('region', { name: 'Narration' })).toContainText('This call does not return');
});

test('each new example has a purpose and code stays paired with its explanation', async ({ page }) => {
  await page.goto(pageURL);
  const art = await seekToCue(page, 'syntax', 'execute');
  await expect(art).toContainText('Greet Sam and count');
  await expect(art.locator('.nja-terminal code')).toHaveText('Hello Sam');
  await seekToCue(page, 'await', 'pending');
  await expect(art.locator('pre')).toContainText('await fs.readFile');
  await expect(art).toContainText('Paused at await');
  await seekToCue(page, 'await', 'fulfilled');
  await expect(art.locator('.nja-terminal code')).toHaveText('Hello from disk.');
  await seekToCue(page, 'await', 'rejected');
  await expect(art.locator('.nja-terminal code')).toHaveText('Error: file missing');
  await seekToCue(page, 'npm', 'install');
  await expect(art.locator('pre:visible')).toContainText('npm install express');
  await seekToCue(page, 'npm', 'import');
  await expect(art.locator('pre:visible')).toContainText('const express = require("express");');
  await expect(art).toContainText('Server: not started');
});

test('reduced motion preserves all explanations and mobile controls remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 850 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(pageURL);
  const animation = player(page);
  await expect(animation.getByLabel('Animate visuals')).not.toBeChecked();
  await animation.getByRole('combobox', { name: 'Scene' }).selectOption({ label: '5. Callbacks' });
  await expect(animation.getByRole('heading', { name: 'A function you hand over' })).toBeVisible();
  await expect(animation.getByRole('region', { name: 'Narration' })).toContainText('callback');
  const bounds = await animation.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(321);
  await a11yCheckpoint(page, 'mobile callback scene', { include: '#nodejs-animation', feature: 'nodejs-animation' });
});

test('a paused callback remains on the execution track when the layout reflows', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(pageURL);
  const art = await seekToCue(page, 'nonblocking', 'run');
  await page.setViewportSize({ width: 320, height: 850 });
  const callback = art.getByTestId('nodejs-callback-token');
  await expect.poll(async () => {
    const token = await callback.boundingBox();
    const thread = await art.getByTestId('nodejs-js-thread').boundingBox();
    return token.x >= thread.x && token.y >= thread.y
      && token.x + token.width <= thread.x + thread.width
      && token.y + token.height <= thread.y + thread.height;
  }).toBe(true);
  await expect(art.locator('.nja-terminal code')).toHaveText('Next\nHello from disk.');
});

test('transcript is available without JavaScript and in print', async ({ browser, page }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const noScriptPage = await context.newPage();
  await noScriptPage.goto(pageURL);
  await player(noScriptPage).getByText('Transcript and visual descriptions', { exact: true }).click();
  await expect(player(noScriptPage).getByText(/A callback is a function you pass/)).toBeVisible();
  await context.close();
  await page.goto(pageURL);
  await page.emulateMedia({ media: 'print' });
  await expect(player(page).getByText(/A callback is a function you pass/)).toBeVisible();
  await expect(player(page).getByRole('button', { name: 'Play narration' })).toBeHidden();
});

for (const variant of [
  { name: 'desktop light', width: 1440, height: 1000, dark: false },
  { name: 'mobile dark', width: 320, height: 850, dark: true },
]) {
  test(`code has distinct syntax colors and unchanged text in ${variant.name}`, async ({ page }) => {
    await page.setViewportSize({ width: variant.width, height: variant.height });
    await page.goto(pageURL);
    const theme = page.getByRole('checkbox', { name: 'Toggle dark mode' });
    if (await theme.isChecked() !== variant.dark) await theme.press('Space');
    const art = await seekToCue(page, 'syntax', 'values');
    const code = art.locator('pre:visible');
    const colors = [];
    for (const token of ['let', 'Hello', '0', 'log']) {
      colors.push(await code.getByText(token, { exact: true }).evaluate((element) => getComputedStyle(element).color));
    }
    expect(new Set(colors).size, 'Keywords, strings, numbers, and functions have distinct syntax colors.').toBe(4);
    await a11yCheckpoint(page, `${variant.name}, syntax colors`, {
      include: '#nodejs-animation', feature: 'nodejs-animation',
    });
    await player(page).getByText('Transcript and visual descriptions', { exact: true }).click();
    const source = story.scenes.find((scene) => scene.id === 'syntax').code;
    const transcriptCode = player(page).getByRole('code').filter({ hasText: 'const greeting' });
    await expect(transcriptCode).toHaveText(source);
    const transcriptColors = [];
    for (const token of ['let', 'Hello', '0', 'log']) {
      transcriptColors.push(await transcriptCode.getByText(token, { exact: true }).evaluate((element) => getComputedStyle(element).color));
    }
    expect(new Set(transcriptColors).size).toBe(4);
    await a11yCheckpoint(page, `${variant.name}, highlighted transcript`, {
      include: '#nodejs-animation', feature: 'nodejs-animation',
    });
  });

  test(`all nine scenes remain readable in ${variant.name}`, async ({ page }, testInfo) => {
    test.setTimeout(180000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width: variant.width, height: variant.height });
    await page.goto(pageURL);
    const theme = page.getByRole('checkbox', { name: 'Toggle dark mode' });
    if (await theme.isChecked() !== variant.dark) await theme.press('Space');
    await expect(theme).toBeChecked({ checked: variant.dark });
    const animation = player(page);
    for (let index = 0; index < 9; index++) {
      await animation.getByRole('combobox', { name: 'Scene' }).selectOption(String(index));
      const art = animation.getByRole('img');
      await expect(art).toBeVisible();
      const overflow = await art.evaluate((element) => element.scrollWidth - element.clientWidth);
      expect(overflow, `scene ${index + 1} horizontal overflow`).toBeLessThanOrEqual(1);
      const missingIcons = await art.locator('i:visible').evaluateAll((icons) => icons
        .filter((icon) => ['none', 'normal', '""'].includes(getComputedStyle(icon, '::before').content))
        .map((icon) => icon.className));
      expect(missingIcons, `scene ${index + 1} icon assets`).toEqual([]);
      await a11yCheckpoint(page, `${variant.name}, scene ${index + 1}`, {
        include: '#nodejs-animation', feature: 'nodejs-animation',
      });
      await expect(animation.getByRole('combobox', { name: 'Scene' })).toHaveValue(String(index));
      await animation.locator('.nja-player').screenshot({ path: testInfo.outputPath(`scene-${index + 1}.png`) });
      for (const cue of story.scenes[index].cues.slice(1)) {
        await seekToCue(page, story.scenes[index].id, cue.pose);
        await expect(art).toHaveAttribute('aria-label', cue.visual);
        expect(await art.evaluate((element) => element.scrollWidth - element.clientWidth),
          `${story.scenes[index].id}/${cue.pose} horizontal overflow`).toBeLessThanOrEqual(1);
        await a11yCheckpoint(page, `${variant.name}, ${story.scenes[index].id}/${cue.pose}`, {
          include: '#nodejs-animation', feature: 'nodejs-animation',
        });
        await animation.locator('.nja-player').screenshot({ path: testInfo.outputPath(`${story.scenes[index].id}-${cue.pose}.png`) });
      }
    }
    expect(errors).toEqual([]);
  });
}
