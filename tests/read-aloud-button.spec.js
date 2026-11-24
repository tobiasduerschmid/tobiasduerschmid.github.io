// @ts-check
const { test, expect } = require('@playwright/test');
const { installSpeechEngine } = require('./speech-synthesis-fake');
const { a11yCheckpoint } = require('./a11y-helpers');

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// WCAG 2.5.3 Label in Name: speech-input users say what they see, so the
// accessible name must contain the visible label in every state.
async function expectNameToIncludeVisibleLabel(button) {
  const label = (await button.innerText()).trim();
  await expect(button).toHaveAccessibleName(new RegExp(escapeRegExp(label), 'i'));
}

for (const { surface, url, region } of [
  { surface: 'tutorial', url: '/SEBook/verification/tla-tutorial', region: '#navnav' },
  { surface: 'SEBook chapter', url: '/SEBook/testing.html', region: '#togglesContainer' },
]) {
  test(`the ${surface} Read Aloud button names its visible label while idle, reading, and stopped`, async ({ page }) => {
    await installSpeechEngine(page);
    await page.goto(url);
    // The button's name changes with its state, so locate it by its stable id.
    const button = page.locator('#tts-read-btn');
    await expect(button).toHaveText(/Read Aloud/);
    await expectNameToIncludeVisibleLabel(button);

    await button.click();
    await expect(button).toHaveText(/Stop/);
    await expectNameToIncludeVisibleLabel(button);
    await a11yCheckpoint(page, `${surface} Read Aloud while reading`, { include: region });

    await button.click();
    await expect(button).toHaveText(/Read Aloud/);
    await expectNameToIncludeVisibleLabel(button);
  });
}
