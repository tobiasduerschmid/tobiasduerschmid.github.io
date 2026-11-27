const { test, expect } = require('@playwright/test');
const { serveAudioRanges } = require('./helpers/narration-player');
const { audio: audioPath, chapters } = require('../_data/blog_audio/how-should-i-use-ai-as-a-college-student.json');

const postUrl = '/blog/how-should-i-use-ai-as-a-college-student/';

test('selecting an article subsection immediately seeks the paused read-aloud', async ({ page }) => {
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
  await expect(player.getByLabel('Current time')).toHaveText(displayTime);
  await expect(player.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await expect(player.getByRole('button', { name: 'Jump to section', exact: true })).toHaveCount(0);
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

  await next.press('Enter');
  await expect.poll(pausedTime).toBeCloseTo(chapters[1].start, 2);
  await next.click();
  await expect.poll(pausedTime).toBeCloseTo(chapters[2].start, 2);
  await expect(sectionPicker).toHaveValue(String(chapters[2].start));
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
  await expect(previous).toBeEnabled();
  await expect(next).toBeDisabled();
});

test('choosing a section in the floating player continues playing at that heading', async ({ page }) => {
  await serveAudioRanges(page, audioPath);
  await page.goto(postUrl, { waitUntil: 'domcontentloaded' });
  const player = page.getByRole('region', { name: 'Audio player', exact: true });
  await player.getByRole('button', { name: 'Play', exact: true }).click();
  const heading = page.getByRole('heading', { name: /Socratic Interaction/, level: 3 });
  await heading.scrollIntoViewIfNeeded();
  await player.getByRole('button', { name: 'Player settings' }).click();
  const choice = chapters.find(chapter => chapter.title === 'Self-Check Quiz');
  await player.getByRole('combobox', { name: 'Section', exact: true }).selectOption({ label: choice.title });
  await expect.poll(() => player.locator('audio').evaluate(audio => audio.currentTime)).toBeGreaterThan(choice.start + 0.1);
  await expect(player.getByRole('button', { name: 'Pause', exact: true })).toBeInViewport();
  await expect(player.getByLabel('Current section')).toHaveText(choice.title);
  await expect(heading).toBeInViewport();
});

test('the narration credit and downloads follow the Read Aloud preference', async ({ page }) => {
  await page.goto(postUrl, { waitUntil: 'domcontentloaded' });
  const toggle = page.getByRole('checkbox', { name: 'Toggle read aloud' });
  const credit = page.getByText('Synthetic narration: Fish Audio Drama 3. Built with Fish Audio.', { exact: false });
  const downloads = page.getByRole('link', { name: /^Download (narration script|narration|captions)$/ });
  await expect(credit).toBeVisible();
  await expect(downloads).toHaveCount(3);
  await toggle.press('Space');
  await expect(credit).toBeHidden();
  await expect(downloads).toHaveCount(0);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(credit).toBeHidden();
  await toggle.press('Space');
  await expect(credit).toBeVisible();
  await expect(downloads).toHaveCount(3);
});

test('the timeline previews section names without seeking, inline and while floating', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto(postUrl, { waitUntil: 'domcontentloaded' });
  const player = page.getByRole('region', { name: 'Audio player', exact: true });
  const seek = player.getByRole('slider', { name: 'Seek audio position' });
  const preview = player.getByRole('tooltip');
  await expect(player.getByLabel('Total duration')).not.toHaveText('--:--');
  await seek.scrollIntoViewIfNeeded();
  const bar = await seek.boundingBox();
  await seek.hover({ position: { x: bar.width * 0.1, y: bar.height / 2 } });
  await expect(preview).toContainText(chapters[1].title);
  await expect(player.getByLabel('Current time')).toHaveText('0:00');
  await preview.hover();
  await expect(preview).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(preview).toBeHidden();

  await player.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('heading', { name: /Socratic Interaction/, level: 3 }).scrollIntoViewIfNeeded();
  await expect(player.getByRole('button', { name: 'Player settings' })).toBeInViewport();
  const floatingBar = await seek.boundingBox();
  await seek.hover({ position: { x: floatingBar.width - 1, y: floatingBar.height / 2 } });
  await expect(preview).toContainText(chapters.at(-1).title);
  await expect(preview).toBeInViewport({ ratio: 1 });
  await preview.hover();
  await page.keyboard.press('Escape');
  await expect(preview).toBeHidden();
  await player.getByRole('button', { name: 'Skip back 15 seconds' }).focus();
  await page.keyboard.press('Shift+Tab');
  await expect(seek).toBeFocused();
  await expect(preview).toContainText(chapters[0].title);
  await seek.hover({ position: { x: floatingBar.width * 0.1, y: floatingBar.height / 2 } });
  await expect(preview).toContainText(chapters[1].title);
  await page.mouse.move(1, 1);
  await expect(preview).toContainText(chapters[0].title);
  await page.keyboard.press('Escape');
  await expect(preview).toBeHidden();
});

for (const viewport of [{ width: 1280, height: 800 }, { width: 320, height: 640 }]) {
  test(`read-aloud controls follow the reader after playback starts at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await serveAudioRanges(page, audioPath);
    await page.goto(postUrl, { waitUntil: 'domcontentloaded' });

    const player = page.getByRole('region', { name: 'Audio player', exact: true });
    const play = player.getByRole('button', { name: 'Play', exact: true });
    const pause = player.getByRole('button', { name: 'Pause', exact: true });
    const settings = player.getByRole('button', { name: 'Player settings' });
    const section = page.getByRole('heading', { name: /Socratic Interaction/, level: 3 });
    const readSection = () => section.evaluate(heading => heading.scrollIntoView({ block: 'center' }));

    await readSection();
    await expect(play).not.toBeInViewport();
    await play.click();
    await expect(pause).toBeInViewport({ ratio: 1 });
    await expect(settings).toBeHidden();
    const inlineScroll = await page.evaluate(() => window.scrollY);

    await readSection();
    await expect(pause).toBeInViewport({ ratio: 1 });
    await expect(section).toBeInViewport({ ratio: 1 });
    const skipSeconds = player.getByRole('button', { name: 'Skip forward 15 seconds' }).getByText('15');
    const numberOfLines = await skipSeconds.evaluate(label => {
      const range = document.createRange();
      range.selectNodeContents(label);
      return range.getClientRects().length;
    });
    expect(numberOfLines, 'The seconds fit on one line inside the skip arrow').toBe(1);
    await pause.click();
    await expect(play).toBeInViewport({ ratio: 1 });
    await player.getByRole('button', { name: 'Next section', exact: true }).click();
    await expect.poll(() => player.locator('audio').evaluate(audio => audio.currentTime)).toBeCloseTo(chapters[1].start, 2);
    const nowReading = player.getByLabel('Current section', { exact: true });
    await expect(nowReading).toHaveText(chapters[1].title);
    await expect(nowReading).toBeInViewport();

    await settings.press('Enter');
    await expect(settings).toHaveAttribute('aria-expanded', 'true');
    const speed = player.getByRole('button', { name: '1.5x playback speed' });
    await speed.click();
    await expect(speed).toHaveAttribute('aria-pressed', 'true');
    await expect(section).toBeInViewport();
    await settings.press('Enter');
    await expect(speed).toBeHidden();

    await page.evaluate(position => window.scrollTo(0, position), inlineScroll);
    await expect(settings).toBeHidden();
    await expect(play).toBeInViewport({ ratio: 1 });
    await expect(speed).toBeVisible();
  });
}

test('the floating player returns to the article when the recording finishes', async ({ page }) => {
  await serveAudioRanges(page, audioPath);
  await page.goto(postUrl, { waitUntil: 'domcontentloaded' });
  const player = page.getByRole('region', { name: 'Audio player', exact: true });
  const play = player.getByRole('button', { name: 'Play', exact: true });
  await play.click();
  await page.getByRole('heading', { name: /Socratic Interaction/, level: 3 }).scrollIntoViewIfNeeded();
  await expect(player.getByRole('button', { name: 'Pause', exact: true })).toBeInViewport({ ratio: 1 });

  const media = player.locator('audio');
  await media.evaluate(audio => { audio.currentTime = audio.duration - 0.25; });
  await expect(media).toHaveJSProperty('ended', true);
  await expect(play).not.toBeInViewport();
});

test('the last link on the page can receive keyboard focus clear of the floating player', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto(postUrl, { waitUntil: 'domcontentloaded' });
  const player = page.getByRole('region', { name: 'Audio player', exact: true });
  await player.getByRole('button', { name: 'Play', exact: true }).click();
  const privacyLink = page.getByRole('link', { name: /View, manage, and learn how data is handled/ });
  await privacyLink.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(privacyLink).toBeFocused();
  await expect(player.getByRole('button', { name: 'Pause', exact: true })).toBeInViewport();
  await expect.poll(async () => {
    const link = await privacyLink.boundingBox();
    const bar = await player.boundingBox();
    return bar.y - (link.y + link.height);
  }).toBeGreaterThanOrEqual(0);
});
