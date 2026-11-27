const { test, expect } = require('@playwright/test');
const { loadLesson, ROOT } = require('../scripts/narration/source');
const { narrationPlayer, seekNarration, serveAudioRanges } = require('./helpers/narration-player');

const topic = 'blog_ai_usage';
const article = loadLesson(topic);
const destination = '/blog/evidence-based-study-tips-for-college-students/';
const title = 'Evidence-Based Study Tips for College Students';
const timing = require(`${ROOT}/_data/explainers/${topic}_timing.json`);
const sceneIndex = article.story.scenes.findIndex(scene => scene.essay_beats.some(beat => beat.signal?.link?.href === destination));
const referenceBeat = article.story.scenes[sceneIndex].essay_beats.find(beat => beat.signal?.link?.href === destination);
const pictureTime = timing.scenes[sceneIndex].cues[referenceBeat.from - 1].start + 0.25;
const captionTime = timing.scenes[sceneIndex].cues[referenceBeat.signal.cue - 1].start + 0.25;

async function openPlayer(page) {
  await serveAudioRanges(page, article.story.audio);
  await page.goto(article.lesson.chapter);
  const player = narrationPlayer(page, article);
  await expect(player.getByRole('button', { name: 'Play narration', exact: true })).toBeVisible();
  return player;
}

async function openFullScreen(player) {
  await player.getByRole('button', { name: 'Enter full screen', exact: true }).click();
  await expect(player.getByRole('button', { name: 'Exit full screen', exact: true })).toBeVisible();
}

function withoutNativeFullscreen(page) {
  return page.addInitScript(() => {
    Element.prototype.requestFullscreen = undefined;
    Element.prototype.webkitRequestFullscreen = undefined;
  });
}

const layouts = [
  { name: 'desktop', viewport: { width: 1280, height: 800 } },
  { name: 'phone', viewport: { width: 320, height: 740 } },
  { name: 'full screen', viewport: { width: 1024, height: 768 }, fullscreen: true },
  { name: 'viewport full screen', viewport: { width: 1024, height: 768 }, fullscreen: true, fallback: true },
];

for (const { name, viewport, fullscreen, fallback } of layouts) {
  test(`${name}: the link on the picture opens the written study guide`, async ({ page }) => {
    await page.setViewportSize(viewport);
    if (fallback) await withoutNativeFullscreen(page);
    const player = await openPlayer(page);
    const callout = player.getByRole('link', { name: 'See Evidence-Based Study Tips', exact: true });
    await expect(callout).toHaveCount(0);
    await seekNarration(player, pictureTime);
    if (fullscreen) await openFullScreen(player);
    await expect(callout).toHaveAttribute('href', destination);
    await player.getByRole('button', { name: 'Play video', exact: true }).press('Shift+Tab');
    await expect(callout).toBeFocused();
    await callout.click();
    await expect(page).toHaveURL(destination);
    await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  });

  test(`${name}: the linked title in the caption opens the written study guide with Enter`, async ({ page }) => {
    await page.setViewportSize(viewport);
    if (fallback) await withoutNativeFullscreen(page);
    const player = await openPlayer(page);
    const caption = player.getByRole('region', { name: 'Narration', exact: true });
    const linkedTitle = caption.getByRole('link', { name: title, exact: true });
    await seekNarration(player, pictureTime);
    await expect(linkedTitle).toHaveCount(0);
    await seekNarration(player, captionTime);
    // A keyboard seek previews the current chapter until Escape or blur.
    await page.keyboard.press('Escape');
    if (fullscreen) await openFullScreen(player);
    await expect(linkedTitle).toHaveAttribute('href', destination);
    await linkedTitle.click({ trial: true });
    await linkedTitle.focus();
    await expect(linkedTitle).toBeFocused();
    await linkedTitle.press('Enter');
    await expect(page).toHaveURL(destination);
    await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
  });
}

test.describe('a touch-screen phone', () => {
  test.use({ viewport: { width: 320, height: 740 }, isMobile: true, hasTouch: true });

  test('a tap immediately after a seek follows the caption link', async ({ page }) => {
    const player = await openPlayer(page);
    await seekNarration(player, captionTime);
    await expect(player.getByRole('tooltip')).toBeVisible();
    await player.getByRole('region', { name: 'Narration', exact: true })
      .getByRole('link', { name: title, exact: true }).tap();
    await expect(page).toHaveURL(destination);
  });
});

test('the written AI article still links to the written study guide', async ({ page }) => {
  await page.goto('/blog/how-should-i-use-ai-as-a-college-student/');
  const passage = page.getByText('Learn more about desirable difficulties and their importance for learning', { exact: false });
  await passage.getByRole('link', { name: title, exact: true }).click();
  await expect(page).toHaveURL(destination);
  await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
});
