const { test, expect } = require('@playwright/test');
const { readFileSync } = require('node:fs');
const yaml = require('js-yaml');
const { loadStory } = require('../scripts/narration/source');
const views = yaml.load(readFileSync(require.resolve('../_data/narration_views.yml'), 'utf8'));

for (const [topic, view] of Object.entries(views)) {
  // The chapter's player and its reading view link to each other in one theme.
  test(`${topic}: the narrated chapter and its reading view link to each other in the same theme`, async ({ page }) => {
    await page.goto(view.chapter);
    const theme = page.getByRole('checkbox', { name: 'Toggle dark mode' });
    if (!await theme.isChecked()) await theme.press('Space');
    const animation = page.locator(`#${topic}-animation`);
    await expect(animation.getByRole('link', { name: 'Print step-by-step version' })).toHaveAttribute('href', /theme=dark/);
    await animation.getByRole('link', { name: 'Read at my own pace', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Dark mode' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('link', { name: 'Back to narrated version' }).click();
    await expect(page.locator('html')).toHaveClass(/dark-mode/);
    await expect(animation.getByRole('button', { name: 'Play narration' })).toBeVisible();
  });

  // The reading and print views carry the theme between themselves and back.
  test(`${topic}: reading and print views carry the theme in their links`, async ({ page }) => {
    await page.goto(`${view.path}/read/?theme=dark`);
    await expect(page.getByRole('button', { name: 'Dark mode' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('audio')).toHaveCount(0);
    await page.getByRole('link', { name: 'Print view', exact: true }).click();
    await expect(page.locator('html')).not.toHaveClass(/dark-mode/);
    await page.getByRole('link', { name: 'Reading view', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Dark mode' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('link', { name: 'Back to narrated version' })).toHaveAttribute('href', /theme=dark/);
  });
}

for (const topic of ['nodejs', 'react']) {
  const story = loadStory(topic);
  const prediction = story.scenes.find(scene => scene.cues[0].pose === 'question');
  const cueCount = story.scenes.reduce((total, scene) => total + scene.cues.length, 0);

  test(`${topic}: every reading step has settled artwork and highlighted code without JavaScript`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    for (const view of ['read', 'print']) {
      await page.goto(`${views[topic].path}/${view}/`);
      await expect(page.locator('audio')).toHaveCount(0);
      // Prediction answers are opt-in on screen, but remain printable content.
      const reveals = page.getByText(/^Reveal step \d+\.\d+ and explanation$/);
      for (const reveal of await reveals.all()) await reveal.click();
      let stepCount = 0;
      for (const [sceneIndex, scene] of story.scenes.entries()) {
        for (const [cueIndex, cue] of scene.cues.entries()) {
          const step = page.getByRole('region', { name: `${sceneIndex + 1}.${cueIndex + 1} — ${cue.step}`, exact: true });
          await expect(step.getByText(cue.text, { exact: true })).toBeVisible();
          await expect(step.locator('.nja-model')).toBeVisible();
          const alternate = cue.variant === 'alternate' || ['inline', 'import'].includes(cue.pose);
          if (scene.code) {
            const source = await step.locator('.nja-line-source').allTextContents();
            expect(source.join('\n')).toBe(alternate ? scene.alternate_code : scene.code);
            if (cue.focus?.length) {
              expect(await step.locator('[aria-current="true"]').evaluateAll(lines => lines.map(line => Number(line.dataset.line)))).toEqual(cue.focus);
            }
          }
          stepCount++;
        }
      }
      await expect(page.locator('[data-reading-cue]')).toHaveCount(stepCount);
      if (topic === 'react') {
        await expect(page.getByRole('region', { name: '5.3 — Render, then commit', exact: true }).locator('.ra-button')).toHaveText('Like: 1');
        await expect(page.locator('[data-reading-scene="updates"][data-reading-cue="2"] .ra-mini-preview')).toContainText('Like: 2');
        const reordered = page.locator('[data-reading-scene="lists"][data-reading-cue="1"]');
        for (const width of [1440, 320]) {
          await page.setViewportSize({ width, height: 900 });
          const react = await reordered.locator('.ra-item-react').boundingBox();
          const node = await reordered.locator('.ra-item-node').boundingBox();
          expect(node.y + node.height).toBeLessThanOrEqual(react.y);
        }
      } else {
        const dispatched = page.locator('[data-reading-scene="nonblocking"][data-reading-cue="3"]');
        await expect(dispatched.locator('.nja-io-output')).toHaveText('Next\nHello from disk.');
        const token = await dispatched.locator('.nja-callback-token').boundingBox();
        const thread = await dispatched.locator('.nja-thread-track').boundingBox();
        expect(token.y).toBeGreaterThanOrEqual(thread.y);
        expect(token.y + token.height).toBeLessThanOrEqual(thread.y + thread.height);
        await expect(page.locator('[data-reading-scene="predict"][data-reading-cue="1"] .nja-output-slots strong')).toHaveText(['A', 'C', 'B']);
      }
    }
    await context.close();
  });

  test(`${topic}: predictions are hidden until revealed and print includes every illustration`, async ({ page }) => {
    await page.goto(`${views[topic].path}/read/?theme=dark`);
    await expect(page.getByText(prediction.cues[1].text, { exact: true })).toBeHidden();
    await page.getByText(/^Reveal step \d+\.2 and explanation$/).click();
    await expect(page.getByText(prediction.cues[1].text, { exact: true })).toBeVisible();
    await page.getByText(/^Reveal step \d+\.2 and explanation$/).click();
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByText(prediction.cues[1].text, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dark mode' })).toBeHidden();
    await expect(page.locator('.nja-model:visible')).toHaveCount(cueCount);
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  });

  // Printing the chapter must use the very same complete lesson, too.
  test(`${topic}: printing the chapter includes every illustration of the lesson`, async ({ page }) => {
    await page.goto(views[topic].chapter);
    await page.emulateMedia({ media: 'print' });
    const transcript = page.locator(`#${topic}-animation .nja-transcript`);
    await expect(transcript.locator('.nja-model:visible')).toHaveCount(cueCount);
    await expect(transcript.getByText(prediction.cues[1].text, { exact: true })).toBeVisible();
  });
}
