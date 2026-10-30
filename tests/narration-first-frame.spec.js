const { test, expect } = require('@playwright/test');
const { loadLesson } = require('../scripts/narration/source');
const { chromiumLaunchOptions } = require('../scripts/chromium-launch-options');

test.use({ launchOptions: { ...chromiumLaunchOptions(), args: ['--disable-audio-output'] } });

// These are persisted HTML contracts, not substitutes for application code.
// Keep the generated content, scripts, audio, and renderers real; only rename
// the data attributes to reproduce an older page using the current assets.
async function useLegacyMarkup(page, chapter, prefix) {
  await page.route(url => url.pathname === chapter, async route => {
    const response = await route.fetch();
    const body = (await response.text())
      .replace(/data-narration-story\b/g, `data-${prefix}-storyboard`)
      .replace(/data-narration-(timing|examples|quizzes)\b/g, `data-${prefix}-$1`);
    await route.fulfill({ response, body });
  });
}

async function playFirstCue(page, topic) {
  const { lesson, story } = loadLesson(topic);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(lesson.chapter);
  const player = page.getByRole('region', { name: story.title, exact: true });
  const play = player.getByRole('button', { name: 'Play narration', exact: true });
  await expect(play).toBeVisible();
  expect(await player.locator('audio').evaluate(audio => audio.paused)).toBe(true);
  await player.scrollIntoViewIfNeeded();
  await play.click();
  await expect(player.getByRole('button', { name: 'Pause narration', exact: true })).toBeVisible();
  await expect.poll(() => player.locator('audio').evaluate(audio => audio.currentTime)).toBeGreaterThan(0.5);
  const narration = player.getByRole('region', { name: topic === 'therac25' ? 'Current narration' : 'Narration', exact: true });
  await expect(narration).toHaveText(story.scenes[0].cues[0].text);
  return { player, story, errors };
}

async function expectScrumOpeningPicture(page, player) {
  const navigation = player.getByRole('navigation', { name: 'Lesson sections' });
  await expect(navigation.getByRole('button', { name: 'Theory: jump to its start', exact: true })).toBeVisible();
  await expect(navigation.getByRole('button', { name: 'Empiricism: jump to its start', exact: true })).toBeVisible();
  const frame = player.frameLocator('iframe[title="Scrum animation"]');
  // A loaded iframe or visible outer panel can still contain an empty frame.
  // Check painted text from the opening choreography, including ancestor fades.
  for (const text of ['6:58 PM', 'Dining Hall']) {
    const label = frame.getByText(text, { exact: true });
    await expect.poll(() => label.evaluate(element => {
      let opacity = 1;
      for (let node = element; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        opacity *= Number(style.opacity);
      }
      const box = element.getBoundingClientRect();
      return opacity > 0.5 && box.width > 0 && box.height > 0
        && box.right > 0 && box.bottom > 0 && box.left < innerWidth && box.top < innerHeight;
    }), `the opening picture paints ${text}`).toBe(true);
  }
  await player.getByRole('button', { name: 'Pause narration', exact: true }).click();
}

test('the current Scrum page initializes navigation and paints the opening picture during playback', async ({ page }) => {
  const { player, errors } = await playFirstCue(page, 'scrum');
  await expectScrumOpeningPicture(page, player);
  expect(errors).toEqual([]);
});

for (const { topic, prefix } of [
  { topic: 'scrum', prefix: 'np' },
  { topic: 'nodejs', prefix: 'explainer' },
  { topic: 'therac25', prefix: 'case' },
]) {
  test(`${topic}: a cached data-${prefix} page still renders and plays with current assets`, async ({ page }) => {
    await useLegacyMarkup(page, loadLesson(topic).lesson.chapter, prefix);
    const { player, story, errors } = await playFirstCue(page, topic);
    if (topic === 'scrum') {
      await expectScrumOpeningPicture(page, player);
    } else {
      const first = story.scenes[0];
      const visual = topic === 'therac25' ? story.diagrams[first.cues[0].diagram || first.diagram].label : first.cues[0].visual;
      await expect(player.getByRole('img', { name: visual, exact: true })).toBeVisible();
      await player.getByRole('button', { name: 'Pause narration', exact: true }).click();
    }
    expect(errors).toEqual([]);
  });
}

test('common narration data wins when an older script block precedes it', async ({ page }) => {
  const { lesson } = loadLesson('scrum');
  await page.route(url => url.pathname === lesson.chapter, async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      /<script type="application\/json" data-narration-story>([\s\S]*?)<\/script>/,
      (current, text) => {
        const previous = JSON.parse(text);
        previous.scenes[0].cues[0].text = 'This superseded narration must not replace the current script.';
        return `<script type="application/json" data-np-storyboard>${JSON.stringify(previous).replace(/<\//g, '<\\/')}</script>${current}`;
      },
    );
    await route.fulfill({ response, body });
  });
  const { player, errors } = await playFirstCue(page, 'scrum');
  await expectScrumOpeningPicture(page, player);
  expect(errors).toEqual([]);
});
