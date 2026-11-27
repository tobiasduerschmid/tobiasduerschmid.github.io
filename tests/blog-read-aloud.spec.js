const { test, expect } = require('@playwright/test');
const { serveAudioRanges } = require('./helpers/narration-player');
const { audio: audioPath, chapters } = require('../_data/blog_audio/how-should-i-use-ai-as-a-college-student.json');

const postUrl = '/blog/how-should-i-use-ai-as-a-college-student/';

test('the read-aloud player can jump to an article subsection while paused', async ({ page }) => {
  await serveAudioRanges(page, audioPath);
  await page.goto(postUrl, { waitUntil: 'domcontentloaded' });

  const player = page.getByRole('region', { name: 'Audio player', exact: true });
  const sectionPicker = player.getByRole('combobox', { name: 'Section', exact: true });
  await expect(sectionPicker).toBeVisible();

  const heading = page.getByRole('heading', { name: /Socratic Interaction/, level: 3 });
  const sectionTitle = await heading.textContent();
  const captionsUrl = await page.getByRole('link', { name: 'Download captions', exact: true }).getAttribute('href');
  const response = await page.request.get(captionsUrl);
  expect(response.ok(), 'The recording has a downloadable captions file').toBe(true);
  const captions = (await response.text()).split('\n');
  const titleLine = captions.indexOf(sectionTitle);
  expect(titleLine, 'The subsection starts with its spoken heading').toBeGreaterThan(1);
  const [hours, minutes, seconds] = captions[titleLine - 1].split(' --> ')[0].split(':').map(Number);
  const displayTime = (hours * 60 + minutes) + ':' + String(Math.floor(seconds)).padStart(2, '0');

  await sectionPicker.selectOption({ label: sectionTitle });
  await player.getByRole('button', { name: 'Jump to section', exact: true }).press('Enter');

  await expect(player.getByLabel('Current time')).toHaveText(displayTime);
  await expect(player.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
});

test('section skip buttons move to adjacent sections from the playback position', async ({ page }) => {
  await serveAudioRanges(page, audioPath);
  await page.goto(postUrl, { waitUntil: 'domcontentloaded' });

  const player = page.getByRole('region', { name: 'Audio player', exact: true });
  const previous = player.getByRole('button', { name: 'Previous section', exact: true });
  const next = player.getByRole('button', { name: 'Next section', exact: true });
  const sectionPicker = player.getByRole('combobox', { name: 'Section', exact: true });
  const pausedTime = () => player.locator('audio').evaluate(audio => (
    audio.paused && !audio.seeking && audio.readyState >= 2 ? audio.currentTime : -1
  ));

  await sectionPicker.selectOption({ label: 'Self-Check Quiz' });
  await next.press('Enter');
  await expect.poll(pausedTime).toBeCloseTo(chapters[1].start, 2);
  await next.click();
  await expect.poll(pausedTime).toBeCloseTo(chapters[2].start, 2);
  await previous.click();
  await expect.poll(pausedTime).toBeCloseTo(chapters[1].start, 2);
});

test('section skip buttons are unavailable beyond the first and last sections', async ({ page }) => {
  await serveAudioRanges(page, audioPath);
  await page.goto(postUrl, { waitUntil: 'domcontentloaded' });

  const player = page.getByRole('region', { name: 'Audio player', exact: true });
  const previous = player.getByRole('button', { name: 'Previous section', exact: true });
  const next = player.getByRole('button', { name: 'Next section', exact: true });
  await expect(previous).toBeDisabled();
  await expect(next).toBeEnabled();

  await player.getByRole('combobox', { name: 'Section', exact: true }).selectOption({ label: 'Self-Check Quiz' });
  await player.getByRole('button', { name: 'Jump to section', exact: true }).click();
  await expect(previous).toBeEnabled();
  await expect(next).toBeDisabled();
});
