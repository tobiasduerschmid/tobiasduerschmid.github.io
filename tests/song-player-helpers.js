const { expect } = require('@playwright/test');

async function openPlayerSettings(player) {
  const button = player.getByRole('button', { name: 'Player settings', exact: true });
  if (await button.getAttribute('aria-expanded') !== 'true') await button.click();
  await expect(player.getByRole('region', { name: 'Player settings', exact: true })).toBeVisible();
}

module.exports = { openPlayerSettings };
