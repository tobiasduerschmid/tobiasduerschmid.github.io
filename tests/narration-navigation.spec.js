const { test, expect } = require('@playwright/test');
const { readFileSync } = require('node:fs');
const yaml = require('js-yaml');
const { a11yCheckpoint } = require('./a11y-helpers');
const data = name => yaml.load(readFileSync(require.resolve(`../_data/${name}.yml`), 'utf8'));
const patterns = data('narrated_patterns');
const videos = data('video_narrations');

for (const topic of ['scrum', 'observer', 'state', 'strategy', 'mvc']) {
  const lesson = videos[topic] || patterns[topic];
  const story = data(`explainers/${topic}`);
  const parts = lesson.parts || ['Context', 'Problem', 'Solution', 'Consequences'];
  const partsLabel = lesson.parts_label || 'Part of the pattern description';
  const label = scene => lesson.outline_labels?.[scene.id] || scene.outline || scene.label;
  for (const mobile of [false, true]) {
    test(`${topic}: opening roadmap and scene links work in ${mobile ? 'mobile dark fullscreen' : 'desktop light'} mode`, async ({ page }) => {
      await page.setViewportSize(mobile ? { width: 320, height: 568 } : { width: 1280, height: 900 });
      await page.goto(lesson.chapter);
      await page.evaluate(dark => document.documentElement.classList.toggle('dark-mode', dark), mobile);
      const player = page.getByRole('region', { name: story.title, exact: true });
      const nav = player.getByRole('navigation', { name: 'Lesson sections', exact: true });
      const strip = nav.getByRole('list', { name: partsLabel, exact: true });
      await expect(strip.getByRole('button')).toHaveText(parts);
      await expect(nav.locator('[aria-current="step"]')).toHaveCount(0);
      const initialScenes = story.scenes.filter(scene => scene.part === parts[0]);
      await expect(nav.getByRole('list', { name: `Scenes in ${parts[0]}`, exact: true }).getByRole('button'))
        .toHaveText(initialScenes.map(label));
      if (mobile) await player.getByRole('button', { name: 'Enter full screen', exact: true }).click();
      await a11yCheckpoint(page, `${topic} opening roadmap`, { include: `#${topic}-${topic === 'scrum' ? 'video' : 'animation'} .np-navigation`, feature: 'narration-navigation' });

      for (const part of parts) {
        const sectionButton = strip.getByRole('button', { name: `${part}: jump to its start`, exact: true });
        await sectionButton.press('Enter');
        const scenes = story.scenes.filter(scene => scene.part === part);
        await expect(player.getByRole('heading', { name: scenes[0].title, exact: true })).toBeVisible();
        await expect(sectionButton).toBeFocused();
        await expect(strip.locator('[aria-current="step"]')).toHaveText(part);
        const outline = nav.getByRole('list', { name: `Scenes in ${part}`, exact: true });
        await expect(outline.getByRole('button')).toHaveText(scenes.map(label));
        const last = scenes[scenes.length - 1];
        const sceneButton = outline.getByRole('button', { name: `${label(last)}: jump to its start`, exact: true });
        await sceneButton.press('Enter');
        await expect(player.getByRole('heading', { name: last.title, exact: true })).toBeVisible();
        await expect(sceneButton).toBeFocused();
        await expect(outline.locator('[aria-current="step"]')).toHaveText(label(last));
        expect(await nav.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      }
    });
  }
}
