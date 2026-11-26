const { expect } = require('@playwright/test');

// Every narration player keeps its scene, speed, caption-size, and other
// player choices behind the "Player settings" toggle of its control bar, as
// the song player does (_includes/narration-player-controls.html); a lesson's
// code language stays in the bar. Opens that panel of `player`, a locator for
// one narration, unless it is already open.
async function openPlayerSettings(player) {
  const toggle = player.getByRole('button', { name: 'Player settings' });
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  await expect(player.getByRole('region', { name: 'Player settings' })).toBeVisible();
}

// Moves `player`'s narration to `time` seconds the way a viewer does, with the
// position slider, and waits until the audio is there.
async function seekNarration(player, time) {
  await player.getByRole('slider', { name: /^(Narration|Animation) position$/ }).fill(String(Number(time.toFixed(2))));
  await expect.poll(() => player.locator('audio').evaluate(audio => audio.currentTime)).toBeCloseTo(time, 1);
}

// Sets the site's light or dark mode with its toggle, then waits for the
// colors' cross-fade to settle, so contrast is measured on final colors.
async function setSiteTheme(page, dark) {
  const toggle = page.getByRole('checkbox', { name: 'Toggle dark mode' });
  if (await toggle.isChecked() !== dark) await toggle.press('Space');
  await page.waitForFunction(() => document.getAnimations().every(animation => !(animation instanceof CSSTransition) || animation.playState !== 'running'));
}

// WEBrick may answer a conditional MP3 range request with 304 instead of the
// bytes Chromium needs after seeking; drops the validators from range
// requests for the lesson's audio at `audioPath`.
async function serveAudioRanges(page, audioPath) {
  await page.route(`**${audioPath}`, route => {
    const headers = { ...route.request().headers() };
    if (headers.range) {
      delete headers['if-none-match'];
      delete headers['if-modified-since'];
    }
    return route.continue({ headers });
  });
}

// The color the browser paints at the middle of `locator`, read back from a
// screenshot of it, as [red, green, blue]. Unlike a computed style, this
// includes filters such as the page's dark-mode inversion of article SVGs.
async function paintedColor(page, locator) {
  const png = (await locator.screenshot({ animations: 'disabled' })).toString('base64');
  return page.evaluate(async data => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const [red, green, blue] = context.getImageData(Math.floor(image.width / 2), Math.floor(image.height / 2), 1, 1).data;
    return [red, green, blue];
  }, png);
}

module.exports = { openPlayerSettings, seekNarration, setSiteTheme, serveAudioRanges, paintedColor };
