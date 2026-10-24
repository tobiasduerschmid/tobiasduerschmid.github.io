const { expect } = require('@playwright/test');

async function openPlayerSettings(player) {
  const button = player.getByRole('button', { name: 'Player settings', exact: true });
  if (await button.getAttribute('aria-expanded') !== 'true') await button.click();
  await expect(player.getByRole('region', { name: 'Player settings', exact: true })).toBeVisible();
}

/**
 * Counts the elements matching `selector` in the song's whole artwork: the
 * stage, plus the transparent top-level pictures that scene.js keeps out of
 * the document until they show again. `target` is the player's page or frame.
 */
async function countInArtwork(target, selector) {
  return target.evaluate((selector) => {
    const stage = document.getElementById('stage');
    const roots = [stage, ...window.SongScene.culledPictures(stage).map(({ node }) => node)];
    return roots.reduce((count, root) => count + root.querySelectorAll(selector).length, 0);
  }, selector);
}

/** Whether some element of the song's whole artwork (as for countInArtwork) has exactly `text`. */
async function artworkHasText(target, text) {
  return target.evaluate((text) => {
    const stage = document.getElementById('stage');
    const roots = [stage, ...window.SongScene.culledPictures(stage).map(({ node }) => node)];
    return roots.some((root) => [root, ...root.querySelectorAll('*')].some((node) => node.textContent.trim() === text));
  }, text);
}

module.exports = { artworkHasText, countInArtwork, openPlayerSettings };
