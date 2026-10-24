// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

// Firefox repaints rounded borders as background layers (rounded-surfaces.js).
// `force` runs the same repaint in every engine, so each engine can check it.
test('a picture back from outside the stage repaints a frame whose state changed while it was away', async ({ page }) => {
  await page.setContent(`<style>
      .stage { position: relative; width: 960px; height: 540px; }
      .lamp { position: absolute; width: 80px; height: 40px; border: 3px solid rgb(255, 0, 0); border-radius: 10px; background: rgb(0, 0, 0); }
      .lamp.is-lit { border-color: rgb(0, 255, 0); }
    </style>
    <div class="stage" id="stage"><div class="layer"><div class="picture"><div class="lamp"></div></div></div></div>`);
  await page.addScriptTag({ path: path.join(root, 'js/song-video/rounded-surfaces.js') });
  const frames = await page.evaluate(async () => {
    const stage = document.getElementById('stage');
    window.SongRoundedSurfaces.prepare(stage, { force: true });
    const picture = stage.querySelector('.picture');
    const lamp = stage.querySelector('.lamp');
    const frame = () => getComputedStyle(lamp).backgroundImage;
    const nextTask = () => new Promise((resolve) => setTimeout(resolve));
    const before = frame();
    // Culled out of the document, as scene.js does with transparent pictures.
    const placeholder = document.createComment('culled picture');
    picture.replaceWith(placeholder);
    await nextTask();
    lamp.classList.add('is-lit');
    await nextTask();
    placeholder.replaceWith(picture);
    await nextTask();
    return { before, after: frame() };
  });
  expect(frames.before, 'the frame is painted in its first state').toContain('rgb(255, 0, 0)');
  expect(frames.after, 'the returning frame shows the state it gained while away').toContain('rgb(0, 255, 0)');
  expect(frames.after).not.toContain('rgb(255, 0, 0)');
});
