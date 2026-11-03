/* Build-time HTML snapshots. No audio, player, or artwork JS ships in the reader. */
const { readFileSync } = require('node:fs');
const { chromium } = require('playwright');
const { chromiumLaunchOptions } = require('./chromium-launch-options');

async function renderSnapshots(input, artworkPath) {
  const browser = await chromium.launch(chromiumLaunchOptions());
  try {
    const page = await browser.newPage();
    await page.setContent(input.html);
    await page.addScriptTag({ path: artworkPath });
    return await page.evaluate(({ scenes, renderer }) => {
      const art = window[renderer];
      for (const step of document.querySelectorAll('[data-reading-scene]')) {
        const scene = scenes.find(scene => scene.id === step.dataset.readingScene);
        const cue = scene.cues[Number(step.dataset.readingCue)];
        if (art.renderStatic) art.renderStatic(step, scene.id, cue);
        else art.render(step, scene.id, cue, 1, false);
        // The visible description is the text alternative; code remains selectable
        // and accessible outside this purely illustrated model.
        step.querySelector('.nja-model').setAttribute('aria-hidden', 'true');
        step.querySelectorAll('i').forEach(icon => icon.setAttribute('aria-hidden', 'true'));
        step.querySelectorAll('.is-highlighted[data-line]').forEach(line => line.setAttribute('aria-current', 'true'));
        step.querySelectorAll('[data-code-variant][hidden]').forEach(variant => variant.remove());
      }
      return document.body.innerHTML;
    }, input);
  } finally {
    await browser.close();
  }
}

renderSnapshots(JSON.parse(readFileSync(0, 'utf8')), process.argv[2])
  .then(html => process.stdout.write(html))
  .catch(error => { console.error(error); process.exitCode = 1; });
