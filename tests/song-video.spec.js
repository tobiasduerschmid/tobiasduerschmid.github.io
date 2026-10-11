// @ts-check
/**
 * Song videos in SE Book chapters keep their accessibility contract: captions
 * of exactly the sung lyrics, an audio-described cut whose captions carry the
 * narration too, a transcript that describes what the video shows for every
 * line, no autoplay, and media that actually loads. Each song's storyboard in
 * _data/songs/ is the spec that the page, the captions, and the rendered
 * videos are all generated from.
 *
 * Playwright's bundled Chromium can't decode H.264, so these tests check what
 * the browser can: the captions track (parsed by the browser's TextTrack
 * API), the rendered page, and the served media files.
 */
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { test, expect } = require('@playwright/test');

const SONGS = [
  { id: 'snapshots_and_pointers', page: '/SEBook/tools/git.html' },
];
const EXTRAS_TOGGLE = 'Audio description and lyrics';
const NARRATOR = '(narrator) ';

const withoutNotes = (text) => text.replace(/♪/g, '').trim();

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

for (const { id, page: pagePath } of SONGS) {
  const storyboard = yaml.load(fs.readFileSync(path.join(__dirname, '..', '_data', 'songs', `${id}.yml`), 'utf8'));
  const lines = storyboard.sections.flatMap((section) => section.lines);
  const sung = lines.flatMap((line) => (line.answer ? [line.text, `(crowd) ${line.answer}`] : [line.text]));
  const describedLabel = `${storyboard.title}, with audio description`;

  test.describe(`Song video: ${storyboard.title}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(pagePath);
    });

    test('captions carry every sung line, in order, without overlapping', async ({ page }) => {
      const video = page.getByLabel(storyboard.title, { exact: true });
      await expect(video).toBeVisible();

      const cues = await captionCues(video);

      const words = cues.map((cue) => withoutNotes(cue.text)).filter((text) => text !== '[music]');
      expect(words).toEqual(sung);
      for (let i = 1; i < cues.length; i++) {
        expect(cues[i].start, `cue ${i + 1} starts before cue ${i} ends`).toBeGreaterThanOrEqual(cues[i - 1].end);
      }
      expect(cues[cues.length - 1].end).toBeLessThanOrEqual(storyboard.duration);
    });

    test('audio-described cut captions the whole narration and every sung line, in order', async ({ page }) => {
      await page.getByText(EXTRAS_TOGGLE).click();
      const described = page.getByLabel(describedLabel);
      await expect(described).toBeVisible();

      const texts = (await captionCues(described)).map((cue) => withoutNotes(cue.text)).filter((text) => text !== '[music]');

      const narration = texts.filter((text) => text.startsWith(NARRATOR)).map((text) => text.slice(NARRATOR.length));
      expect(narration.join(' ')).toBe(storyboard.sections.map((section) => section.narration).join(' '));
      expect(texts.filter((text) => !text.startsWith(NARRATOR))).toEqual(sung);
    });

    test('transcript gives every line with what the video shows for it', async ({ page }) => {
      await page.getByText(EXTRAS_TOGGLE).click();
      const transcript = page.getByRole('group').filter({ hasText: EXTRAS_TOGGLE });
      await expect(transcript).toBeVisible();

      for (const line of lines) {
        await expect(transcript).toContainText(line.text);
        await expect(transcript).toContainText(line.visual);
      }
    });

    test('the videos wait for the reader: no autoplay, nothing preloaded', async ({ page }) => {
      await page.getByText(EXTRAS_TOGGLE).click();
      for (const video of [page.getByLabel(storyboard.title, { exact: true }), page.getByLabel(describedLabel)]) {
        await expect(video).not.toHaveAttribute('autoplay');
        await expect(video).toHaveAttribute('preload', 'none');
      }
    });

    test('both cuts, their captions, and the poster are served', async ({ request }) => {
      const media = [
        [storyboard.video, 'video/mp4'],
        [storyboard.captions, 'text/vtt'],
        [storyboard.described_video, 'video/mp4'],
        [storyboard.described_captions, 'text/vtt'],
        [storyboard.poster, 'image/jpeg'],
      ];
      for (const [url, type] of media) {
        const response = await request.head(url);
        expect(response.status(), `${url} status`).toBe(200);
        expect(response.headers()['content-type'], `${url} type`).toContain(type);
      }
    });
  });
}
