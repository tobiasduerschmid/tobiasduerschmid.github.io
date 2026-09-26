// @ts-check
/**
 * The SE Book landing page's teaser video keeps its accessibility contract:
 * captions for the music, an audio-described cut, a full transcript, and
 * media that actually loads. The storyboard in _data/sebook_teaser.yml is the
 * spec both the page and the rendered videos are generated from.
 *
 * Playwright's bundled Chromium can't decode H.264, so these tests check what
 * the browser can: the captions tracks (parsed by the browser's TextTrack
 * API), the rendered page, and the served media files.
 */
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { test, expect } = require('@playwright/test');

const storyboard = yaml.load(fs.readFileSync(path.join(__dirname, '..', '_data', 'sebook_teaser.yml'), 'utf8'));
const DESCRIBED_LABEL = `${storyboard.title}, with audio description`;
const EXTRAS_TOGGLE = 'Audio description and transcript';

/** Cues of a video's captions track as the browser parsed them. */
async function captionCues(video) {
  return video.evaluate(async (element) => {
    const trackElement = element.querySelector('track[kind="captions"]');
    const loaded = new Promise((resolve, reject) => {
      if (trackElement.readyState === 2) resolve();
      trackElement.addEventListener('load', resolve, { once: true });
      trackElement.addEventListener('error', () => reject(new Error(`captions failed to load: ${trackElement.src}`)), { once: true });
    });
    trackElement.track.mode = 'hidden';
    await loaded;
    return [...trackElement.track.cues].map((cue) => ({ start: cue.startTime, end: cue.endTime, text: cue.text }));
  });
}

test.describe('SE Book teaser video', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/SEBook/');
  });

  test('music captions run without gaps from the first to the last second', async ({ page }) => {
    const video = page.getByLabel(storyboard.title, { exact: true });
    await expect(video).toBeVisible();

    const cues = await captionCues(video);

    expect(cues.length, 'the captions track has cues').toBeGreaterThan(0);
    expect(cues[0].start).toBe(0);
    expect(cues[cues.length - 1].end).toBe(storyboard.duration);
    for (let i = 1; i < cues.length; i++) {
      expect(cues[i].start, `caption gap: cue ${i + 1} must start by the time cue ${i} ends`).toBeLessThanOrEqual(cues[i - 1].end);
    }
  });

  test('audio-described cut captions every narrated line', async ({ page }) => {
    await page.getByText(EXTRAS_TOGGLE).click();
    const described = page.getByLabel(DESCRIBED_LABEL);
    await expect(described).toBeVisible();

    const cueTexts = (await captionCues(described)).map((cue) => cue.text);

    const narration = storyboard.scenes.map((scene) => scene.narration).filter(Boolean);
    for (const line of narration) expect(cueTexts, `narration "${line}" is captioned`).toContain(line);
  });

  test('transcript contains every line of on-screen text', async ({ page }) => {
    await page.getByText(EXTRAS_TOGGLE).click();
    const transcript = page.getByRole('list').filter({ hasText: 'On screen:' });
    await expect(transcript).toBeVisible();

    const onScreen = storyboard.scenes.flatMap((scene) => scene.on_screen).map((line) => line.replace(/\*/g, ''));
    for (const line of onScreen) await expect(transcript).toContainText(line);
  });

  test('both cuts and the poster are served', async ({ request }) => {
    const media = [
      [storyboard.video, 'video/mp4'],
      [storyboard.described_video, 'video/mp4'],
      [storyboard.poster, 'image/jpeg'],
    ];
    for (const [url, type] of media) {
      const response = await request.head(url);
      expect(response.status(), `${url} status`).toBe(200);
      expect(response.headers()['content-type'], `${url} type`).toContain(type);
    }
  });
});
