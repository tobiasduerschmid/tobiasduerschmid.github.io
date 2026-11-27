const { test, expect } = require('@playwright/test');
const { loadLesson, ROOT } = require('../scripts/narration/source');
const { openPlayerSettings, serveAudioRanges } = require('./helpers/narration-player');
const { a11yCheckpoint } = require('./a11y-helpers');

for (const [topic, slug, photoDescription] of [
  ['blog_ai_usage', 'how-should-i-use-ai-as-a-college-student', /^Student working on a computer/],
  ['blog_study_tips', 'evidence-based-study-tips-for-college-students', /^Students working on a laptop/],
]) {
  test(`${slug}: one click on the photo plays the animation on the article page`, async ({ page }) => {
    const { story } = loadLesson(topic);
    await serveAudioRanges(page, story.audio);
    await page.goto(`/blog/${slug}/`);
    const articleUrl = page.url();
    const photo = page.getByRole('img', { name: photoDescription });
    const playOnPhoto = page.getByRole('button', { name: 'Play animated article', exact: true });
    const player = page.getByRole('region', { name: 'Animated article', exact: true });
    await expect(photo).toBeVisible();
    await expect(playOnPhoto).toBeVisible();
    await expect(player).toBeHidden();
    const [photoBox, buttonBox] = await Promise.all([photo.boundingBox(), playOnPhoto.boundingBox()]);
    expect(buttonBox.x + buttonBox.width / 2).toBeCloseTo(photoBox.x + photoBox.width / 2, 0);
    expect(buttonBox.y + buttonBox.height / 2).toBeCloseTo(photoBox.y + photoBox.height / 2, 0);
    await a11yCheckpoint(page, `${slug} video cover`, { include: '[data-blog-video-cover]', feature: 'blog-video-narration' });

    await playOnPhoto.click();

    await expect(page).toHaveURL(articleUrl);
    await expect(photo).toBeHidden();
    await expect(player.getByRole('button', { name: 'Pause narration', exact: true })).toBeFocused();
    await expect.poll(() => player.locator('audio').evaluate(audio => audio.currentTime)).toBeGreaterThan(0);
    const art = player.frameLocator('iframe[title$=" animation"]');
    await expect(art.getByText(story.scenes[0].essay_beats[0].title, { exact: true })).toBeVisible();
    await expect(player.getByRole('button', { name: 'Previous section', exact: true })).toBeVisible();
    await expect(player.getByRole('button', { name: 'Next section', exact: true })).toBeVisible();
    await expect(player.getByRole('button', { name: 'Closed captions (CC)' })).toBeVisible();
    await expect(player.getByRole('button', { name: 'Enter full screen' })).toBeVisible();
    await expect(player.getByText('Study tools', { exact: true })).toBeHidden();
    await expect(player.getByText(story.scenes[0].takeaway, { exact: true })).toBeHidden();
    await expect(player.getByText(/^Tip: turn your phone sideways/)).toBeHidden();
    await player.getByRole('button', { name: 'Player settings' }).click();
    await expect(player.getByRole('combobox', { name: 'Section', exact: true }).getByRole('option')).toHaveCount(story.scenes.length);
    await a11yCheckpoint(page, `${slug} inline animation`, { include: `#${topic}-video`, feature: 'blog-video-narration' });
  });

  test(`${slug}: the standalone video plays synced artwork and captions`, async ({ page }) => {
    const { story } = loadLesson(topic);
    const timing = require(`${ROOT}/_data/explainers/${topic}_timing.json`);
    await serveAudioRanges(page, story.audio);
    await page.goto(`/blog/${slug}/`);
    const articleImage = await page.getByRole('img', { name: photoDescription }).getAttribute('src');
    const reader = page.getByRole('region', { name: 'Audio player' });
    const readAloud = await reader.locator('audio source').getAttribute('src');
    const readerTime = () => reader.locator('audio').evaluate(audio => audio.currentTime);
    await reader.getByRole('button', { name: 'Next section', exact: true }).click();
    await expect.poll(readerTime).toBeCloseTo(timing.scenes[1].start, 1);
    await reader.getByRole('button', { name: 'Previous section', exact: true }).click();
    await expect.poll(readerTime).toBeCloseTo(0, 1);
    await page.getByRole('link', { name: 'Watch the animated article' }).click();

    const player = page.getByRole('region', { name: 'Animated article', exact: true });
    const thumbnail = player.locator('.vn-animation-cover');
    await expect(thumbnail).toHaveAttribute('src', articleImage);
    await expect(thumbnail).toBeVisible();
    const videoSpeech = await player.locator('audio source').getAttribute('src');
    expect(new URL(videoSpeech, page.url()).pathname).toBe(new URL(readAloud, page.url()).pathname);
    await player.getByRole('button', { name: 'Play video', exact: true }).click();
    await expect(thumbnail).toBeHidden();
    await expect.poll(() => player.locator('audio').evaluate(audio => audio.currentTime)).toBeGreaterThan(0);
    await player.getByRole('button', { name: 'Pause narration' }).click();

    const scenes = player.getByRole('combobox', { name: 'Section', exact: true });
    await openPlayerSettings(player);
    await expect(scenes.getByRole('option')).toHaveCount(story.scenes.length);
    const chapterIndex = story.scenes.length - 2;
    await scenes.selectOption(String(chapterIndex));
    await expect.poll(() => player.locator('audio').evaluate(audio => audio.currentTime)).toBeCloseTo(timing.scenes[chapterIndex].start, 1);
    await expect(player.getByRole('region', { name: 'Narration' })).toHaveText(story.scenes[chapterIndex].cues[0].text);
    const art = player.frameLocator('iframe[title$=" animation"]');
    await expect(art.getByText(story.scenes[chapterIndex].essay_beats[0].title, { exact: true })).toBeVisible();
    await a11yCheckpoint(page, `${slug} video`, { include: `#${topic}-video`, feature: 'blog-video-narration' });
  });
}

test('the inline animation and article read-aloud yield to the most recently played track', async ({ page }) => {
  const { story } = loadLesson('blog_study_tips');
  await serveAudioRanges(page, story.audio);
  await page.goto('/blog/evidence-based-study-tips-for-college-students/');
  const reader = page.getByRole('region', { name: 'Audio player' });
  const readerAudio = reader.locator('audio');
  const playerAudio = page.getByRole('region', { name: 'Animated article', exact: true }).locator('audio');

  await reader.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(readerAudio).toHaveJSProperty('paused', false);
  await page.getByRole('button', { name: 'Play animated article', exact: true }).click();
  await expect(readerAudio).toHaveJSProperty('paused', true);
  await expect(playerAudio).toHaveJSProperty('paused', false);
  await reader.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(playerAudio).toHaveJSProperty('paused', true);
  await expect(readerAudio).toHaveJSProperty('paused', false);
});

test('portrait playback keeps graphic labels readable on a 320px screen', async ({ page }) => {
  const { story } = loadLesson('blog_study_tips');
  await serveAudioRanges(page, story.audio);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/blog/evidence-based-study-tips-for-college-students/');

  await page.getByRole('button', { name: 'Play animated article', exact: true }).press('Enter');

  const player = page.getByRole('region', { name: 'Animated article', exact: true });
  await expect(player.getByRole('button', { name: 'Pause narration', exact: true })).toBeInViewport();
  const frame = player.locator('iframe[title$=" animation"]');
  const firstLabel = story.scenes[0].essay_beats[0].items[0].label;
  const label = frame.contentFrame().getByText(firstLabel, { exact: true });
  await expect(label).toBeVisible();
  expect((await frame.boundingBox()).width).toBeLessThanOrEqual((await player.boundingBox()).width);
  const renderedFont = await label.evaluate(element => parseFloat(getComputedStyle(element).fontSize)
    * element.getBoundingClientRect().height / element.offsetHeight);
  expect(renderedFont).toBeGreaterThanOrEqual(16);
});

test.describe('article with JavaScript disabled', () => {
  test.use({ javaScriptEnabled: false });

  test('the featured photo and standalone watch link are available', async ({ page }) => {
    await page.goto('/blog/evidence-based-study-tips-for-college-students/');
    await expect(page.getByRole('img', { name: /^Students working on a laptop/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Play animated article', exact: true })).toBeHidden();
    await page.getByRole('link', { name: 'Watch the animated article' }).click();
    await expect(page.getByRole('link', { name: 'Read the original article' })).toBeVisible();
  });
});
