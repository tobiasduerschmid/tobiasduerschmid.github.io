const { expect } = require('@playwright/test');

// Every narration player keeps its scene, speed, and lesson choices behind the
// "Player settings" toggle of its control bar, as the song player does
// (_includes/narration-player-controls.html). Opens that panel of `player`, a
// locator for one narration, unless it is already open.
async function openPlayerSettings(player) {
  const toggle = player.getByRole('button', { name: 'Player settings' });
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  await expect(player.getByRole('region', { name: 'Player settings' })).toBeVisible();
}

module.exports = { openPlayerSettings };
