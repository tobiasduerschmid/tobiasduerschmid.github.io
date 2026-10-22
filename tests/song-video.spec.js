// @ts-check
/**
 * Song videos in SE Book chapters keep their accessibility contract: captions
 * of exactly the sung lyrics, an audio-described cut whose captions carry the
 * narration too, a transcript that describes what the video shows for every
 * line, no autoplay, and media that actually loads. Each song's storyboard in
 * _data/songs/ is the spec that the page, the captions, and the rendered
 * videos are all generated from.
 *
 * These tests check the captions track through the browser's TextTrack API,
 * the rendered transcript, and the served media files. Native playback is
 * exercised separately in song-vector-player.spec.js.
 */
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { test, expect } = require('@playwright/test');

const SONGS = [
  { id: 'snapshots_and_pointers', page: '/SEBook/tools/git.html' },
  { id: 'unbox_the_stack', page: '/SEBook/tools/networking.html' },
  { id: 'small_tools_one_job_each', page: '/SEBook/tools/shell.html' },
  { id: 'every_module_keeps_a_secret', page: '/SEBook/designprinciples/informationhiding.html' },
  { id: 'invest_in_your_stories', page: '/SEBook/userstories.html' },
  { id: 'red_green_refactor', page: '/SEBook/testing/tdd.html' },
  { id: 'let_the_object_decide', page: '/SEBook/oop-song.html' },
];
const EXTRAS_TOGGLE = 'Full transcript';
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
  async function playerAudio(page, described = false) {
    const frameElement = page.getByTitle(`${storyboard.title}: interactive music player`);
    await frameElement.scrollIntoViewIfNeeded();
    const frame = frameElement.contentFrame();
    await expect(frame.getByRole('button', { name: 'Play song', exact: true })).toBeVisible();
    if (described) {
      await frame.getByRole('combobox', { name: 'Audio track', exact: true }).selectOption('described');
      await expect(frame.locator('audio source')).toHaveAttribute('src', new RegExp(storyboard.described_soundtrack));
      await expect(frame.locator('audio track')).toHaveAttribute('src', storyboard.described_captions);
    }
    return frame.getByLabel(`${storyboard.title} audio`, { exact: true });
  }

  test.describe(`Song video: ${storyboard.title}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(pagePath);
    });

    test('captions carry every sung line, in order, without overlapping', async ({ page }) => {
      const video = await playerAudio(page);

      const cues = await captionCues(video);

      const words = cues.map((cue) => withoutNotes(cue.text)).filter((text) => text !== '[music]');
      expect(words).toEqual(sung);
      for (let i = 1; i < cues.length; i++) {
        expect(cues[i].start, `cue ${i + 1} starts before cue ${i} ends`).toBeGreaterThanOrEqual(cues[i - 1].end);
      }
      expect(cues[cues.length - 1].end).toBeLessThanOrEqual(storyboard.duration);
    });

    test('audio-described cut captions the whole narration and every sung line, in order', async ({ page }) => {
      const described = await playerAudio(page, true);

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

    test('the player waits for the reader and has no raster video element', async ({ page }) => {
      const audio = await playerAudio(page);
      await expect(audio).not.toHaveAttribute('autoplay');
      await expect(audio).toHaveAttribute('preload', 'none');
      await expect(page.locator('video')).toHaveCount(0);
    });

    test('both audio tracks, captions, and described timing are served', async ({ request }) => {
      const media = [
        [`/${storyboard.soundtrack}`, 'audio/mp4'],
        [storyboard.captions, 'text/vtt'],
        [`/${storyboard.described_soundtrack}`, 'audio/mp4'],
        [storyboard.described_captions, 'text/vtt'],
        [storyboard.described_timeline, 'application/json'],
      ];
      for (const [url, type] of media) {
        const response = await request.head(url);
        expect(response.status(), `${url} status`).toBe(200);
        expect(response.headers()['content-type'], `${url} type`).toContain(type);
      }
    });
  });
}
