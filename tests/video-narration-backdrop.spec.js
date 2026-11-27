// Every video narration's backdrop holds still apart from slow, large light:
// no small points (dust, motes, sparks) drift across the sheet behind the
// lesson's pictures, where they only distract.
const { loadRegistry } = require('../scripts/narration/source');
const { test, expect } = require('@playwright/test');

// Where each small painted piece of the backdrop sits: everything on the stage
// outside the lesson's pictures (the camera layer) and the HUD, keyed by its
// place in the document so a piece is compared with itself.
function smallBackdropPieces() {
  const pieces = {};
  [...document.querySelectorAll('#stage *')].forEach((node, index) => {
    if (node.closest('.camera, .hud')) return;
    const box = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    if (box.width > 0 && box.width <= 8 && box.height <= 8 && style.visibility !== 'hidden') {
      pieces[index] = { name: node.className.baseVal ?? node.className, x: box.x, y: box.y };
    }
  });
  return pieces;
}

for (const [topic, lesson] of Object.entries(loadRegistry('video'))) {
  test(`${topic}: no small points drift across the backdrop`, async ({ page }) => {
    await page.setViewportSize({ width: 960, height: 540 });
    await page.goto(lesson.animation.page);
    await page.evaluate(() => window.VideoNarrationStage.ready);
    await page.evaluate(() => window.VideoNarrationStage.seek(5));
    const before = await page.evaluate(smallBackdropPieces);
    await page.evaluate(() => window.VideoNarrationStage.seek(25));
    const after = await page.evaluate(smallBackdropPieces);
    const moved = Object.entries(after)
      .filter(([index, piece]) => !before[index] || Math.hypot(piece.x - before[index].x, piece.y - before[index].y) > 0.5)
      .map(([, piece]) => piece.name);
    expect(moved).toEqual([]);
  });
}
