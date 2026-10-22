const { test, expect } = require('@playwright/test');

const audioPage = '/blog/evidence-based-study-tips-for-college-students/';

async function openPlayer(page, preferences = {}, unavailable = null) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ preferences, unavailable }) => {
    for (const [key, value] of Object.entries(preferences)) localStorage.setItem(key, value);
    // Browser policies and quota failures are external storage boundaries.
    for (const operation of unavailable === 'read' ? ['getItem'] : unavailable === 'write' ? ['setItem'] : []) {
      const original = Storage.prototype[operation];
      Storage.prototype[operation] = function (key, ...args) {
        if (key === 'cap_volume' || key === 'cap_speed') throw new DOMException('Storage unavailable', 'SecurityError');
        return original.call(this, key, ...args);
      };
    }
  }, { preferences, unavailable });
  await page.goto(audioPage);
  return { player: page.getByRole('region', { name: 'Audio player', exact: true }), errors };
}

for (const [key, value] of [
  ['cap_volume', '2'], ['cap_volume', '-0.1'], ['cap_volume', 'invalid'],
  ['cap_speed', '-1'], ['cap_speed', '100'], ['cap_speed', 'invalid'],
]) {
  test(`audio controls recover from invalid saved ${key}=${value}`, async ({ page }) => {
    const { player, errors } = await openPlayer(page, { [key]: value });
    await player.getByRole('button', { name: 'Mute', exact: true }).click();
    await expect(player.getByRole('button', { name: 'Unmute', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(player.getByRole('slider', { name: 'Volume', exact: true })).toHaveValue('0');
    await expect(player.locator('audio')).toHaveJSProperty('volume', 0);
    await player.getByRole('button', { name: '1.5x playback speed', exact: true }).click();
    await expect(player.getByRole('button', { name: '1.5x playback speed', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(player.locator('audio')).toHaveJSProperty('playbackRate', 1.5);
    expect(errors).toEqual([]);
  });
}

for (const unavailable of ['read', 'write']) {
  test(`audio controls work when saved preferences cannot ${unavailable === 'read' ? 'be read' : 'be written'}`, async ({ page }) => {
    const { player, errors } = await openPlayer(page, {}, unavailable);
    await player.getByRole('button', { name: 'Mute', exact: true }).click();
    await expect(player.getByRole('slider', { name: 'Volume', exact: true })).toHaveValue('0');
    await expect(player.locator('audio')).toHaveJSProperty('volume', 0);
    await player.getByRole('button', { name: '2x playback speed', exact: true }).click();
    await expect(player.getByRole('button', { name: '2x playback speed', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(player.locator('audio')).toHaveJSProperty('playbackRate', 2);
    expect(errors).toEqual([]);
  });
}

for (const [volume, speed] of [[0.25, 1.5], [0, 0.5], [1, 2], [0.5, 1.25]]) {
  test(`audio controls restore saved volume ${volume} and speed ${speed}`, async ({ page }) => {
    const { player, errors } = await openPlayer(page, { cap_volume: String(volume), cap_speed: String(speed) });
    await expect(player.getByRole('slider', { name: 'Volume', exact: true })).toHaveValue(String(volume));
    await expect(player.locator('audio')).toHaveJSProperty('volume', volume);
    await expect(player.locator('audio')).toHaveJSProperty('playbackRate', speed);
    expect(errors).toEqual([]);
  });
}
