// @ts-check
const { artworkHasText, openPlayerSettings } = require('./song-player-helpers');
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const PLAYER_PATH = '/assets/song-player/snapshots-and-pointers.html';
const SONG_TITLE = 'Snapshots and Pointers: a song about Git';
const storyboard = yaml.load(fs.readFileSync(path.join(__dirname, '..', '_data/songs/snapshots_and_pointers.yml'), 'utf8'));
const lines = storyboard.sections.flatMap((section) => section.lines);
const describedPlan = JSON.parse(fs.readFileSync(path.join(__dirname, '..', storyboard.described_timeline), 'utf8'));
const audioPlayer = (page) => page.getByLabel(`${SONG_TITLE} audio`, { exact: true });
const lyrics = (page) => page.getByLabel('Current lyrics', { exact: true });

test.beforeEach(async ({ context }) => {
  // Keep real media responses; bypass WEBrick's incorrect cached If-Range/304 handling.
  await context.route('**/*', (route) => route.continue());
});

async function loadPlayer(page) {
  await page.goto(PLAYER_PATH);
  await expect(page.getByRole('button', { name: 'Play song', exact: true })).toBeEnabled();
  await expect(page.getByTestId('song-picture')
    .or(page.getByRole('region', { name: 'Current visual description' }))
    .filter({ visible: true })).toBeVisible();
  return audioPlayer(page);
}

async function loadAudioThenPause(page) {
  const audio = await loadPlayer(page);
  await audio.evaluate((element) => { element.muted = true; });
  await page.getByRole('button', { name: 'Play song', exact: true }).click();
  await expect.poll(() => audio.evaluate((element) => element.currentTime)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Pause song', exact: true }).click();
  await expect(audio).toHaveJSProperty('paused', true);
  return audio;
}

// The native media API is the seek control's platform contract. It avoids
// browser-specific shadow-DOM coordinates and still exercises real seek events.
async function seek(audio, time) {
  await audio.evaluate((element, seconds) => new Promise((resolve) => {
    element.addEventListener('seeked', resolve, { once: true });
    element.currentTime = seconds;
  }), time);
  await expect.poll(() => audio.evaluate((element) => element.currentTime), {
    message: 'native media must seek to the requested time; the local server must support HTTP byte ranges',
  }).toBeCloseTo(time, 2);
}

// The artwork's SVG text is visible content even though its equivalent visual
// description keeps the animated stage out of the accessibility tree.
async function visibleSvgWords(page) {
  return page.locator('svg text').evaluateAll((nodes) => nodes.filter((node) => {
    for (let ancestor = node; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) < 0.01) return false;
    }
    return node.getBoundingClientRect().width > 0;
  }).map((node) => node.textContent.trim()));
}

test('the chapter embeds the player and retains audio description and transcript', async ({ page }) => {
  await page.goto('/SEBook/tools/git.html');
  const frameElement = page.getByTitle(`${SONG_TITLE}: interactive music player`);
  await frameElement.scrollIntoViewIfNeeded();
  await expect(frameElement).toBeVisible();
  await expect(frameElement.contentFrame().getByRole('button', { name: 'Play song', exact: true })).toBeEnabled();
  const frame = await (await frameElement.elementHandle()).contentFrame();
  await expect.poll(() => artworkHasText(frame, 'homework_final.txt'), { message: 'the embedded player builds the artwork' }).toBe(true);
  await expect(frameElement.contentFrame().getByRole('link', { name: 'Full transcript', exact: true })).toBeHidden();
  await expect(frameElement.contentFrame().getByLabel('Current visual description', { exact: true })).toBeHidden();
  await expect.poll(() => frameElement.evaluate((element) => (
    element.contentDocument.documentElement.scrollHeight - element.contentWindow.innerHeight
  )), { message: 'the embedded player must fit its frame without an internal vertical scrollbar' }).toBeLessThanOrEqual(1);
  await page.getByText('Full transcript', { exact: true }).click();
  await openPlayerSettings(frameElement.contentFrame());
  await expect(frameElement.contentFrame().getByRole('combobox', { name: 'Audio track', exact: true })).toBeVisible();
  await expect(page.getByText(lines[0].visual, { exact: false })).toBeVisible();
  await expect(page.locator('video')).toHaveCount(0);
  await expect(frameElement.contentFrame().locator('video')).toHaveCount(0);
});

test('printing the chapter reveals the transcript and hides the media controls', async ({ page }) => {
  await page.goto('/SEBook/tools/git.html');
  const transcriptLine = page.getByText(lines[0].visual, { exact: false });
  await expect(transcriptLine).toBeHidden();
  await page.emulateMedia({ media: 'print' });
  await expect(transcriptLine).toBeVisible();
  await expect(page.getByTitle(`${SONG_TITLE}: interactive music player`)).toBeHidden();
  await page.emulateMedia({ media: 'screen' });
  await expect(transcriptLine).toBeHidden();
  await page.getByText('Full transcript', { exact: true }).click();
  await page.emulateMedia({ media: 'print' });
  await page.emulateMedia({ media: 'screen' });
  await expect(transcriptLine).toBeVisible();
});

test('audio description holds the picture during narration and preserves position when switching tracks', async ({ page }) => {
  const audio = await loadAudioThenPause(page);
  await seek(audio, 0);
  await openPlayerSettings(page);
  const track = page.getByRole('combobox', { name: 'Audio track', exact: true });
  await track.selectOption('described');
  await expect.poll(() => audio.evaluate((element) => element.duration)).toBeCloseTo(describedPlan.duration, 1);
  await seek(audio, 1);
  await expect(lyrics(page)).toContainText('(narrator)');
  const firstFile = page.getByText('homework_final.txt', { exact: true });
  const firstPose = await firstFile.boundingBox();
  await seek(audio, 8);
  expect(await firstFile.boundingBox()).toEqual(firstPose);
  const songAt = 12;
  await seek(audio, describedPlan.holds[0].outputEnd + songAt);
  await expect(lyrics(page)).toContainText("software engineer's Time Stone");
  await openPlayerSettings(page);
  await track.selectOption('original');
  await expect.poll(() => audio.evaluate((element) => element.duration)).toBeCloseTo(storyboard.duration, 1);
  await expect.poll(() => audio.evaluate((element) => element.currentTime)).toBeCloseTo(songAt, 1);
  await expect(audio).toHaveJSProperty('paused', true);
  await expect(audio).toHaveJSProperty('playbackRate', 1);
  await a11yCheckpoint(page, 'audio track switched back', { feature: 'song-vector-player' });
});

test('switching audio tracks during playback continues at the same song position', async ({ page }) => {
  const audio = await loadAudioThenPause(page);
  await seek(audio, 119.8);
  await page.getByRole('button', { name: 'Play song', exact: true }).click();
  await openPlayerSettings(page);
  await page.getByRole('combobox', { name: 'Audio track', exact: true }).selectOption('described');
  await expect.poll(() => audio.evaluate((element) => element.duration)).toBeCloseTo(describedPlan.duration, 1);
  await expect(page.getByRole('button', { name: 'Pause song', exact: true })).toBeEnabled();
  await expect(lyrics(page)).toContainText('creating one is instant');
  await expect(audio).toHaveJSProperty('playbackRate', 1);
  await expect.poll(() => visibleSvgWords(page)).toContain('feature');
});

test('a failed described track can recover the original song at the same position', async ({ page }) => {
  const audio = await loadAudioThenPause(page);
  await seek(audio, 120);
  await page.route('**/assets/audio/snapshots-and-pointers-described.m4a', (route) => route.abort('failed'));
  await openPlayerSettings(page);
  const track = page.getByRole('combobox', { name: 'Audio track', exact: true });
  await track.selectOption('described');
  await expect(page.getByRole('status')).toContainText('audio could not load');
  await openPlayerSettings(page);
  await track.selectOption('original');
  await expect.poll(() => audio.evaluate((element) => element.currentTime)).toBeCloseTo(120, 1);
  await expect(audio).toHaveJSProperty('paused', true);
  await expect(page.getByRole('button', { name: 'Play song', exact: true })).toBeEnabled();
});

test('the vector song player waits for an explicit playback action', async ({ page }) => {
  const mediaRequests = [];
  const errors = [];
  page.on('request', (request) => { if (/\.(m4a|mp4)(?:\?|$)/.test(request.url())) mediaRequests.push(request.url()); });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(PLAYER_PATH);
  await expect(page.getByRole('main', { name: `${SONG_TITLE} music player` })).toBeVisible();
  const audio = audioPlayer(page);
  await expect(audio).toBeHidden();
  await expect(audio).toHaveAttribute('preload', 'none');
  await expect(audio).not.toHaveAttribute('autoplay');
  await expect(page.getByRole('button', { name: 'Play song', exact: true })).toBeEnabled();
  await expect.poll(() => artworkHasText(page, 'homework_final.txt'), { message: 'the player builds the artwork' }).toBe(true);
  await expect(audio).toHaveJSProperty('paused', true);
  expect(mediaRequests, 'audio and fallback video must not download before Play').toEqual([]);
  expect(errors, 'standalone player must initialize without JavaScript or asset errors').toEqual([]);
  await a11yCheckpoint(page, 'song-player ready', { feature: 'song-vector-player' });
});

test('an unavailable fullscreen enhancement leaves the player usable', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // Reproduce a browser extension or network failure at this optional resource.
  await page.route(/\/song-video\/(?:fullscreen|presentation)\.js(?:\?|$)/, (route) => route.abort('blockedbyclient'));
  await loadPlayer(page);
  await expect(page.getByRole('button', { name: 'Enter full screen', exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'Closed captions (CC)', exact: true }).click();
  await expect(lyrics(page)).toBeHidden();
  await expect(audioPlayer(page)).toHaveJSProperty('playbackRate', 1);
  expect(errors).toEqual([]);
  await a11yCheckpoint(page, 'fullscreen enhancement unavailable', { feature: 'song-vector-player' });
});

test('closed captions overlay the picture and can be switched off and back on', async ({ page }) => {
  const audio = await loadAudioThenPause(page);
  await seek(audio, 91.5);
  const captions = page.getByRole('button', { name: 'Closed captions (CC)', exact: true });
  await expect(captions).toHaveAttribute('aria-pressed', 'true');
  await expect(lyrics(page)).toContainText("a hash can't drift");
  const picture = await page.getByTestId('song-picture').boundingBox();
  const captionBox = await lyrics(page).boundingBox();
  expect(captionBox.y).toBeGreaterThanOrEqual(picture.y);
  expect(captionBox.y + captionBox.height).toBeLessThanOrEqual(picture.y + picture.height);
  await captions.press('Enter');
  await expect(lyrics(page)).toBeHidden();
  await expect(captions).toHaveAttribute('aria-pressed', 'false');
  await seek(audio, 119.8);
  await captions.press('Enter');
  await expect(lyrics(page)).toContainText('creating one is instant');
  await expect(audio).toHaveJSProperty('playbackRate', 1);
});

test('integrated seek and mute controls operate the audio without changing its speed', async ({ page }) => {
  const audio = await loadAudioThenPause(page);
  const progress = page.getByRole('slider', { name: 'Song position', exact: true });
  await progress.fill('91.5');
  await expect(lyrics(page)).toContainText("a hash can't drift");
  await expect(audio).toHaveJSProperty('paused', true);
  await progress.press('Home');
  await expect(lyrics(page)).toContainText('Press play');
  await page.getByRole('button', { name: 'Unmute song', exact: true }).click();
  await expect(audio).toHaveJSProperty('muted', false);
  await page.getByRole('button', { name: 'Mute song', exact: true }).click();
  await expect(audio).toHaveJSProperty('muted', true);
  await expect(audio).toHaveJSProperty('playbackRate', 1);
});

test('five-second buttons seek both tracks and stop at the beginning and end', async ({ page }) => {
  const audio = await loadAudioThenPause(page);
  const forward = page.getByRole('button', { name: 'Forward 5 seconds', exact: true });
  const back = page.getByRole('button', { name: 'Back 5 seconds', exact: true });
  await seek(audio, 5);
  await back.click();
  await expect(audio).toHaveJSProperty('currentTime', 0);
  await forward.click();
  await expect(audio).toHaveJSProperty('currentTime', 5);
  await openPlayerSettings(page);
  await page.getByRole('combobox', { name: 'Audio track', exact: true }).selectOption('described');
  await expect.poll(() => audio.evaluate((element) => element.duration)).toBeCloseTo(describedPlan.duration, 1);
  await seek(audio, 5);
  await forward.click();
  await expect(audio).toHaveJSProperty('currentTime', 10);
  const duration = await audio.evaluate((element) => element.duration);
  await seek(audio, duration - 3);
  await forward.click();
  await expect.poll(() => audio.evaluate((element) => element.currentTime)).toBeCloseTo(duration, 5);
  await expect(audio).toHaveJSProperty('playbackRate', 1);
});

test('full screen keeps the captions and controls with the artwork @chromium', async ({ page }) => {
  const audio = await loadAudioThenPause(page);
  await seek(audio, 12);
  await page.getByRole('button', { name: 'Enter full screen', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Exit full screen', exact: true })).toBeVisible();
  const picture = await page.getByTestId('song-picture').boundingBox();
  const captionBox = await lyrics(page).boundingBox();
  expect(captionBox.y).toBeGreaterThanOrEqual(picture.y);
  expect(captionBox.y + captionBox.height).toBeLessThanOrEqual(picture.y + picture.height);
  await page.getByRole('button', { name: 'Play song', exact: true }).click();
  await expect(audio).toHaveJSProperty('paused', false);
  await expect(audio).toHaveJSProperty('playbackRate', 1);
  await page.getByRole('button', { name: 'Exit full screen', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Enter full screen', exact: true })).toBeVisible();
});

test('keyboard playback advances the audio and artwork, then pauses the audio clock', async ({ page }) => {
  const audio = await loadAudioThenPause(page);
  const line = lines.find((item) => item.id === 'verse-3-4');
  await seek(audio, line.marks.commit - 0.25);
  await expect.poll(() => visibleSvgWords(page)).not.toContain('D');
  const play = page.getByRole('button', { name: 'Play song', exact: true });
  await play.focus();
  await expect(play).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Pause song', exact: true })).toBeFocused();
  await expect.poll(() => visibleSvgWords(page)).toContain('D');
  await expect(audio).toHaveJSProperty('playbackRate', 1);
  await page.keyboard.press('Space');
  await expect(audio).toHaveJSProperty('paused', true);
  const pausedAt = await audio.evaluate((element) => element.currentTime);
  // A rendered animation frame is sufficient to catch a media clock that keeps
  // advancing on pause; no arbitrary wall-clock sleep is needed.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(audio).toHaveJSProperty('currentTime', pausedAt);
  await expect(lyrics(page)).toContainText(line.text);
});

test('the song can be played again after reaching the end', async ({ page }) => {
  const audio = await loadAudioThenPause(page);
  const duration = await audio.evaluate((element) => element.duration);
  await seek(audio, duration - 0.15);
  await page.getByRole('button', { name: 'Play song', exact: true }).click();
  await expect(audio).toHaveJSProperty('ended', true);
  await expect(lyrics(page)).toContainText('End of song.');
  await page.getByRole('button', { name: 'Play song', exact: true }).click();
  await expect(audio).toHaveJSProperty('ended', false);
  await expect.poll(() => audio.evaluate((element) => element.currentTime)).toBeLessThan(5);
  await expect(page.getByRole('button', { name: 'Pause song', exact: true })).toBeVisible();
});

test('forward and backward seeks show the question and crowd answer at their cue boundary', async ({ page }) => {
  const audio = await loadAudioThenPause(page);
  const question = lines.find((line) => line.id === 'quiz-1');
  const lastQuestion = lines.find((line) => line.id === 'quiz-6');
  for (const [time, expected] of [
    [question.answer_at - 0.05, question.text],
    [question.answer_at + 0.05, `(crowd) ${question.answer}`],
    [lastQuestion.answer_at + 0.05, `(crowd) ${lastQuestion.answer}`],
    [question.start + 0.1, question.text],
    [lines[0].start + 0.1, lines[0].text],
  ]) {
    await seek(audio, time);
    await expect(lyrics(page)).toContainText(expected);
  }
  await expect(page.getByLabel('Current visual description', { exact: true })).toContainText(lines[0].visual);
  await seek(audio, 0);
  await expect(lyrics(page)).toContainText('Press play to follow the lyrics.');
  await expect(page.getByLabel('Current visual description', { exact: true })).toContainText('Visual descriptions appear here during the song.');
  await a11yCheckpoint(page, 'song-player sought and paused', { feature: 'song-vector-player' });
});

test('graph scenes recover the same visible commits and pointers after backward seeking', async ({ page }) => {
  const audio = await loadAudioThenPause(page);
  await seek(audio, 119.8); // feature exists on C before main advances to D.
  await expect.poll(() => visibleSvgWords(page)).toEqual(expect.arrayContaining(['A', 'B', 'C', 'main', 'feature', 'HEAD']));
  await expect.poll(() => visibleSvgWords(page)).not.toContain('D');
  await seek(audio, 125.3);
  await expect.poll(() => visibleSvgWords(page)).toEqual(expect.arrayContaining(['C', 'D', 'main', 'feature', 'HEAD']));
  await seek(audio, 119.8);
  await expect.poll(() => visibleSvgWords(page)).not.toContain('D');
  await expect.poll(() => visibleSvgWords(page)).toEqual(expect.arrayContaining(['A', 'B', 'C', 'main', 'feature', 'HEAD']));
});

for (const width of [320, 390]) {
  test(`captions and transport reflow at ${width}px without shrinking their text`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const audio = await loadAudioThenPause(page);
    await seek(audio, 199.6);
    await expect(lyrics(page)).toContainText('The staging area, on my machine!');
    await page.addStyleTag({ content: 'p, label, button, summary, a { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }' });
    const controls = await page.getByRole('region', { name: 'Song controls', exact: true }).locator('button:visible, input:visible, select:visible').all();
    for (const control of [...controls, lyrics(page)]) {
      const box = await control.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    }
    for (const readable of [lyrics(page), page.getByRole('button', { name: 'Play song', exact: true })]) {
      expect(await readable.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(lyrics(page)).toContainText('The staging area, on my machine!');
    await a11yCheckpoint(page, `song-player resized from ${width}px`, { feature: 'song-vector-player' });
  });
}

test('all embedded controls remain reachable at mobile width with enlarged text', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/SEBook/tools/git.html');
  const frameElement = page.getByTitle(`${SONG_TITLE}: interactive music player`);
  await frameElement.scrollIntoViewIfNeeded();
  const frame = frameElement.contentFrame();
  await expect(frame.getByRole('button', { name: 'Play song', exact: true })).toBeVisible();
  // Emulate a reader enlarging the document text to 200%, not a saved preference.
  await frameElement.evaluate((element) => { element.contentDocument.documentElement.style.fontSize = '32px'; });
  const controls = await frame.getByRole('region', { name: 'Song controls', exact: true }).locator('button:visible, input:visible, select:visible').all();
  const frameBox = await frameElement.boundingBox();
  for (const control of controls) {
    const box = await control.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(frameBox.x);
    expect(box.x + box.width).toBeLessThanOrEqual(frameBox.x + frameBox.width);
  }
  expect(await frameElement.evaluate((element) => element.contentDocument.documentElement.scrollWidth)).toBeLessThanOrEqual(frameBox.width);
});

test('reduced motion defaults to lyrics and descriptions while preserving audio and seeking', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const audio = await loadAudioThenPause(page);
  await expect(page.getByRole('link', { name: 'Full transcript', exact: true })).toBeVisible();
  const motion = page.getByRole('checkbox', { name: 'Use lyrics-only mode', exact: true });
  await expect(motion).toBeChecked();
  await expect(page.getByLabel('Current visual description', { exact: true })).toBeVisible();
  await seek(audio, 119.8);
  await expect.poll(() => visibleSvgWords(page)).toEqual([]);
  await expect(lyrics(page)).toContainText("creating one is instant");
  await motion.focus();
  await page.keyboard.press('Space');
  await expect(motion).not.toBeChecked();
  await expect(page.getByLabel('Current visual description', { exact: true })).toBeHidden();
  await expect.poll(() => visibleSvgWords(page)).toContain('feature');
  await a11yCheckpoint(page, 'song-player motion enabled by keyboard', { feature: 'song-vector-player' });
});

test('a hidden player keeps normal-speed audio and catches the artwork up when visible', async ({ page }) => {
  const audio = await loadAudioThenPause(page);
  await seek(audio, 1.8);
  const secondFile = page.getByText('homework_final_2.txt', { exact: true });
  await expect(secondFile).toHaveCSS('opacity', '0');
  // Headless tabs do not reliably become hidden on focus changes. Exercise
  // the browser visibility boundary while keeping real native media running.
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.getByRole('button', { name: 'Play song', exact: true }).click();
  await expect.poll(() => audio.evaluate((element) => element.currentTime)).toBeGreaterThan(3);
  await expect(audio).toHaveJSProperty('paused', false);
  await expect(audio).toHaveJSProperty('playbackRate', 1);
  await expect(secondFile).toHaveCSS('opacity', '0');
  await page.evaluate(() => {
    delete document.visibilityState;
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(secondFile).toHaveCSS('opacity', '1');
  await page.getByRole('button', { name: 'Pause song', exact: true }).click();
});

test('CPU throttling leaves native audio running at normal speed @chromium', async ({ page, context }) => {
  const audio = await loadAudioThenPause(page);
  const client = await context.newCDPSession(page);
  try {
    await seek(audio, 122.8);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 8 });
    await page.getByRole('button', { name: 'Play song', exact: true }).click();
    await expect.poll(() => audio.evaluate((element) => element.currentTime)).toBeGreaterThan(125);
    await expect(audio).toHaveJSProperty('playbackRate', 1);
    await expect.poll(() => visibleSvgWords(page)).toContain('D');
    await page.getByRole('button', { name: 'Pause song', exact: true }).click();
  } finally {
    await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await client.detach();
  }
});

for (const failedAsset of ['/js/song-video/scene.js', '/assets/audio/snapshots-and-pointers.m4a']) {
  test(`a failed ${failedAsset.endsWith('.js') ? 'animation' : 'audio'} load leaves audio downloads and transcript reachable`, async ({ page }) => {
    // Fault injection at the HTTP boundary exercises an otherwise unreachable
    // error response; successful player tests use the real local resources.
    await page.route(`**${failedAsset}`, (route) => route.abort('failed'));
    await page.goto(PLAYER_PATH);
    if (failedAsset.endsWith('.m4a')) await page.getByRole('button', { name: 'Play song', exact: true }).click();
    await expect(page.getByRole('status')).toContainText(/audio/i);
    await expect(page.getByRole('link', { name: 'Download song audio', exact: true })).toHaveAttribute('href', /snapshots-and-pointers\.m4a$/);
    await expect(page.getByRole('link', { name: 'Download audio-described song', exact: true })).toHaveAttribute('href', /snapshots-and-pointers-described\.m4a$/);
    await a11yCheckpoint(page, `song-player failed ${failedAsset}`, { feature: 'song-vector-player' });
  });
}

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('native audio and transcript remain reachable without a video player', async ({ page }) => {
    await page.goto(PLAYER_PATH);
    await expect(audioPlayer(page)).toBeHidden();
    await expect(page.getByLabel(`${SONG_TITLE} without JavaScript`, { exact: true })).toBeVisible();
    await page.getByText('Audio downloads', { exact: true }).click();
    await expect(page.getByRole('link', { name: 'Full transcript', exact: true })).toHaveAttribute('href', /\/SEBook\/tools\/git\.html#/);
    await expect(page.getByRole('link', { name: 'Download audio-described song', exact: true })).toHaveAttribute('href', /snapshots-and-pointers-described\.m4a$/);
    await expect(page.locator('video')).toHaveCount(0);
  });
});

for (const width of [320, 1024]) {
  test(`player settings and volume are usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const audio = await loadAudioThenPause(page);
    const settings = page.getByRole('region', { name: 'Player settings', exact: true });
    const trigger = page.getByRole('button', { name: 'Player settings', exact: true });
    const volume = page.getByRole('slider', { name: 'Volume', exact: true });
    await expect(settings).toBeHidden();
    await volume.fill('40');
    await expect(audio).toHaveJSProperty('volume', 0.4);
    await expect(audio).toHaveJSProperty('muted', false);
    await volume.press('ArrowRight');
    await expect(audio).toHaveJSProperty('volume', 0.41);
    await page.getByRole('button', { name: 'Mute song', exact: true }).click();
    await expect(volume).toHaveValue('0');
    await page.getByRole('button', { name: 'Unmute song', exact: true }).click();
    await expect(volume).toHaveValue('41');
    if (width === 1024) {
      const play = await page.getByRole('button', { name: 'Play song', exact: true }).boundingBox();
      const settingsButton = await trigger.boundingBox();
      expect(Math.abs(play.y - settingsButton.y)).toBeLessThan(5);
    }
    await trigger.focus();
    await trigger.press('Space');
    await expect(page.getByRole('button', { name: 'Close settings' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('combobox', { name: 'Playback speed' })).toBeFocused();
    await page.getByRole('combobox', { name: 'Playback speed' }).selectOption('1.5');
    await expect(audio).toHaveJSProperty('playbackRate', 1.5);
    const baseline = await lyrics(page).evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    const size = page.getByRole('combobox', { name: 'Subtitle font size' });
    await size.selectOption('2');
    expect(await lyrics(page).evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeCloseTo(baseline * 2, 1);
    await page.getByRole('button', { name: 'Close settings' }).focus();
    await page.keyboard.press('Escape');
    await expect(settings).toBeHidden();
    await expect(trigger).toBeFocused();
    await openPlayerSettings(page);
    await a11yCheckpoint(page, `player settings at ${width}px`, { feature: 'song-vector-player' });
    for (const control of await settings.getByRole('combobox').all()) {
      await control.focus();
      const box = await control.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    await page.getByRole('button', { name: 'Close settings' }).click();
    await expect(settings).toBeHidden();
  });
}
