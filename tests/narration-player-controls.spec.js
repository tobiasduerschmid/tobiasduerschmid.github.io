const { readFileSync } = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { test, expect } = require('@playwright/test');
const { ROOT, lessonIds, loadLesson } = require('../scripts/narration/source');

// Every narration kind (video, pattern, explainer, case study) shares one
// control bar, the song player's (_includes/narration-player-controls.html):
// the same controls in the same order, wherever the lesson lives. Lessons are
// discovered from _data/narrations, so a new lesson is checked too.
const TRANSPORT = ['Play narration', 'Back 5 seconds', 'Forward 5 seconds', 'Previous scene', 'Next scene'];
const VIEW = ['Mute narration', 'Closed captions (CC)', 'Player settings', 'Enter full screen'];
const lessons = lessonIds().map(topic => ({ topic, ...loadLesson(topic) })).filter(({ story }) => story.audio);

// A lesson's code examples, keyed by language, each with the label its select shows.
const examplesOf = topic => yaml.load(readFileSync(path.join(ROOT, '_data/explainers', `${topic}_code.yml`), 'utf8'));
const playerOf = (page, story) => page.getByRole('region', { name: story.title, exact: true });

// The bar has no role of its own, so its stable class hook scopes the query
// away from the lesson's other buttons (navigation, checkpoints).
async function barButtons(player) {
  return player.locator('.nja-controls .vn-toolbar button:visible')
    .evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-label') || button.textContent.trim()));
}

for (const { topic, kind, lesson, story } of lessons) {
  test(`${topic}: the control bar offers the song player's controls in its order`, async ({ page }) => {
    await page.goto(lesson.chapter);
    const player = playerOf(page, story);
    await expect(player.getByRole('button', { name: 'Play narration', exact: true })).toBeVisible();
    const names = await barButtons(player);
    // Only a case study's step buttons lead the transport.
    const lead = names.slice(0, names.indexOf('Play narration'));
    expect(lead).toEqual(kind === 'case-study' ? ['Previous step', 'Next step'] : []);
    expect(names.slice(lead.length)).toEqual([...TRANSPORT, ...VIEW]);
    await expect(player.getByRole('slider', { name: 'Volume', exact: true })).toBeVisible();
    // The clock shows the position and the whole length, as the song player's does.
    await expect(player.getByRole('status', { name: 'Playback time' })).toHaveText(/^0:00 \/ \d+:\d{2}$/);
  });
}

for (const { topic, lesson, story } of lessons.filter(({ story }) => story.languages)) {
  test(`${topic}: the code language stays in the bar, outside the player settings`, async ({ page }) => {
    await page.goto(lesson.chapter);
    const player = playerOf(page, story);
    const language = player.getByRole('combobox', { name: 'Code language' });
    await expect(language).toBeVisible();
    await expect(player.getByRole('button', { name: 'Player settings', exact: true })).toHaveAttribute('aria-expanded', 'false');
    const examples = examplesOf(topic);
    await expect(language.locator('option')).toHaveText(story.languages.map(id => examples[id].label));
    // Switching never opens the settings panel or moves the narration.
    const position = player.getByRole('slider', { name: /position/ });
    await position.fill('60');
    await language.selectOption(story.languages[1]);
    await expect(language).toHaveValue(story.languages[1]);
    await expect(player.getByRole('region', { name: 'Player settings', exact: true })).toBeHidden();
    await expect(position).toHaveValue('60');
  });
}

for (const { topic, lesson, story } of lessons.filter(({ topic }) => ['scrum', 'strategy', 'nodejs', 'therac25'].includes(topic))) {
  test(`${topic}: player settings open over the player and close with their button or Escape`, async ({ page }) => {
    await page.goto(lesson.chapter);
    const player = playerOf(page, story);
    const toggle = player.getByRole('button', { name: 'Player settings', exact: true });
    const settings = player.getByRole('region', { name: 'Player settings', exact: true });
    const close = settings.getByRole('button', { name: 'Close settings', exact: true });
    await toggle.click();
    await expect(settings).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(close).toBeFocused();
    await expect(settings.getByRole('combobox', { name: /Scene|Review a scene/ })).toBeVisible();
    await close.click();
    await expect(settings).toBeHidden();
    await expect(toggle).toBeFocused();
    await toggle.click();
    await expect(close).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(settings).toBeHidden();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeFocused();
  });
}
