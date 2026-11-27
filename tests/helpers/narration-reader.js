const { expect } = require('@playwright/test');

// Read prediction answers through their native disclosures, including when
// scripts are disabled. Print must expose those answers without interaction.
async function openNarrationDocument(page, url, view, story) {
  await page.emulateMedia({ media: view === 'print' ? 'print' : 'screen' });
  await page.goto(url);
  if (view === 'print') return;

  for (const [sceneIndex, scene] of story.scenes.entries()) {
    const section = page.locator('.nja-transcript-scene').filter({
      has: page.locator(`[data-reading-scene="${scene.id}"]`),
    });
    for (const [cueIndex, cue] of scene.cues.entries()) {
      if (!cue.prediction) continue;
      const next = scene.cues[cueIndex + 1];
      // Consecutive prediction prompts stay visible until their answer.
      if (next && next.prediction) continue;
      const answer = next
        ? page.locator(`[data-reading-scene="${scene.id}"][data-reading-cue="${cueIndex + 1}"]`).getByText(next.text, { exact: true })
        : section.getByText(scene.takeaway, { exact: true });
      const summary = next
        ? `Reveal step ${sceneIndex + 1}.${cueIndex + 2} and explanation`
        : 'Reveal section takeaway';
      await expect(answer).toBeHidden();
      await section.getByText(summary, { exact: true }).press('Enter');
      await expect(answer).toBeVisible();
    }
  }
}

module.exports = { openNarrationDocument };
