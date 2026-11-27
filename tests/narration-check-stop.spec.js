// A knowledge check stops the narration before the next section is heard.
// The stop must hold where the player gets the fewest chances to notice the
// boundary: in a background tab, which runs no animation frames and updates
// media time only a few times a second, and at high speed. The audio and
// captions are versioned by the speech they carry, so a browser or CDN never
// pairs a page's timing with an older rendering, and a page whose audio comes
// from another rendering says so instead of pausing mid-sentence.
const { test, expect } = require('@playwright/test');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { loadStory, loadRegistry } = require('../scripts/narration/source');
const { seekNarration, serveAudioRanges } = require('./helpers/narration-player');

const topic = 'layered_style';
const story = loadStory(topic);
const lesson = loadRegistry('video')[topic];
const timing = JSON.parse(readFileSync(path.join(__dirname, `../_data/explainers/${topic}_timing.json`), 'utf8'));
const quizzes = yaml.load(readFileSync(path.join(__dirname, `../_data/explainers/${topic}_quizzes.yml`), 'utf8'));
// Checks with another section after them, where audio could run on.
const checked = story.scenes.flatMap((scene, index) => (quizzes[scene.id] && index < story.scenes.length - 1 ? [index] : []));
const player = page => page.getByRole('region', { name: story.title, exact: true });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener('play', event => {
      if (event.target instanceof HTMLMediaElement) event.target.muted = true;
    }, true);
  });
  await serveAudioRanges(page, story.audio);
});

for (const index of checked.slice(0, 3)) {
  test(`the check after ${story.scenes[index].id} stops before the next section in a background tab at 16x`, async ({ page }) => {
    // A hidden tab runs no animation frames in the page; only media time updates remain.
    await page.addInitScript(() => {
      if (window === window.top) window.requestAnimationFrame = () => 0;
    });
    await page.goto(lesson.chapter);
    const boundary = timing.scenes[index].end;
    await seekNarration(player(page), boundary - 3);
    await player(page).getByRole('button', { name: 'Play narration', exact: true }).click();
    await player(page).locator('audio').evaluate(audio => { audio.playbackRate = 16; });
    await expect(player(page).getByRole('region', { name: /— (Knowledge check|Summary quiz)$/ })).toBeVisible();
    const furthestPlayed = await player(page).locator('audio').evaluate(audio => Math.max(
      ...Array.from({ length: audio.played.length }, (_, i) => audio.played.end(i))));
    expect(furthestPlayed).toBeLessThanOrEqual(boundary);
  });
}

test('the audio and captions are versioned by the speech they carry', async ({ page }) => {
  await page.goto(lesson.chapter);
  const version = `?v=${story.speech_sha256.slice(0, 16)}`;
  await expect(player(page).locator('audio source')).toHaveAttribute('src', `${story.audio}${version}`);
  await expect(player(page).locator('audio track')).toHaveAttribute('src', `${story.captions}${version}`);
});

test('a page whose audio comes from another rendering asks for a reload', async ({ page }) => {
  // Another lesson's audio stands in for a rendering this page's timing does not describe.
  const other = loadStory('pipes_and_filters').audio;
  await page.route(url => url.pathname === story.audio, route => route.fulfill({
    path: path.join(__dirname, '..', other), contentType: 'audio/mpeg',
  }));
  await page.goto(lesson.chapter);
  await player(page).getByRole('button', { name: 'Play narration', exact: true }).click();
  await expect(player(page).getByRole('status').filter({ hasText: 'Reload the page' })).toBeVisible();
});
