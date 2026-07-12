// @ts-check
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');

const QUEST_PATH = '/software-construction-quest/';
const A11Y_FEATURE = 'software-construction-quest';
const CORRECT_STORY_CRITERION =
  'Given two completed missions, when the learner closes and reopens the quest, then both missions are still marked complete.';

test.describe('Software Construction Quest', () => {
  test('renders the complete semantic quest and a healthy optional world', async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.goto(QUEST_PATH);

    await expect(page.getByRole('heading', { level: 1, name: 'The Broken Build' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Quest map' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Mission 27 Coupled Crisis Capstone preview' }),
    ).toBeVisible();
    await expect(page.getByRole('progressbar')).toHaveAttribute('max', '27');
    await expect(page.getByRole('button', { name: 'Text-only world' })).toBeVisible();
    await expect(page.locator('.scq-canvas canvas, .scq-world-fallback')).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);

    await a11yCheckpoint(page, 'Software Construction Quest — initial mission', {
      feature: A11Y_FEATURE,
      include: '#software-construction-quest-root',
      darkMode: true,
    });
  });

  test('completes a mission, persists it across reload, and resets explicitly', async ({ page }) => {
    await page.goto(QUEST_PATH);

    await page
      .getByRole('radio', { name: 'The app stores progress in localStorage as JSON.' })
      .check();
    await page.getByRole('button', { name: 'Check my reasoning' }).click();
    await expect(page.getByText('Not yet.')).toBeVisible();

    await a11yCheckpoint(page, 'Software Construction Quest — misconception feedback', {
      feature: A11Y_FEATURE,
      include: '#software-construction-quest-root',
      darkMode: true,
    });

    await page.getByRole('radio', { name: CORRECT_STORY_CRITERION }).check();
    await page.getByRole('button', { name: 'Check my reasoning' }).click();

    await expect(page.getByText('Evidence accepted.')).toBeVisible();
    const missionArticle = page.getByRole('article', { name: 'Stakeholder Story Forge' });
    await expect(missionArticle.getByText('Mission complete', { exact: true })).toBeVisible();
    await expect(page.getByRole('progressbar')).toHaveAttribute('value', '1');

    await a11yCheckpoint(page, 'Software Construction Quest — accepted evidence', {
      feature: A11Y_FEATURE,
      include: '#software-construction-quest-root',
      darkMode: true,
    });

    await page.reload();
    await expect(
      page.getByRole('button', { name: 'Mission 1 Story Forge Complete' }),
    ).toBeVisible();
    await expect(page.getByRole('progressbar')).toHaveAttribute('value', '1');

    await page.getByRole('button', { name: 'Reset quest progress' }).click();
    const resetRegion = page.getByRole('region', { name: 'Reset all quest progress?' });
    await expect(resetRegion).toBeVisible();

    await a11yCheckpoint(page, 'Software Construction Quest — reset confirmation', {
      feature: A11Y_FEATURE,
      include: '#software-construction-quest-root',
      darkMode: true,
    });

    await resetRegion.getByRole('button', { name: 'Delete quest progress' }).click();

    await expect(page.getByRole('progressbar')).toHaveAttribute('value', '0');
    await expect(missionArticle.getByText('Mission ready', { exact: true })).toBeVisible();
  });

  test('keeps every district available in the text-only world', async ({ page }) => {
    await page.goto(QUEST_PATH);
    const worldRegion = page.getByRole('region', { name: 'Campus restoration map' });
    const textOnlyToggle = worldRegion.getByRole('button', { name: 'Text-only world' });

    if (await textOnlyToggle.isEnabled()) {
      await textOnlyToggle.click();
    } else {
      await expect(textOnlyToggle).toBeDisabled();
    }

    await expect(textOnlyToggle).toHaveAttribute('aria-pressed', 'true');
    await expect(worldRegion.getByText('Integration Core: repairs remaining')).toBeVisible();

    await a11yCheckpoint(page, 'Software Construction Quest — text-only world', {
      feature: A11Y_FEATURE,
      include: '#software-construction-quest-root',
      darkMode: true,
    });
  });

  test('honors reduced motion without hiding the world or missions', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(QUEST_PATH);

    await expect(page.locator('html')).toHaveClass(/prm-reduce/);
    await expect(page.getByRole('button', { name: 'Pause world motion' })).toBeDisabled();
    await expect(page.getByText('Motion is paused by your reduced-motion preference.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mission 2 Pipeworks Ready' })).toBeVisible();
  });
});
