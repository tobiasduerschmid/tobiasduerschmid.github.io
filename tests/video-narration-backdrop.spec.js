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

// The words the drafting-room sheet prints (its title block, dimension
// figures, section marks) that still show and touch any part of the picture:
// visible text, a filled or bordered box, or a drawn shape in the lesson's
// pictures or HUD. A shown word under or beside the picture reads as one of
// its labels, so none may remain.
function lettersTouchingThePicture() {
  const stage = document.getElementById('stage');
  const visible = node => node.checkVisibility({ opacityProperty: true, visibilityProperty: true });
  const boxes = [];
  for (const node of stage.querySelectorAll('.camera *, .hud *')) {
    if (!visible(node)) continue;
    const style = getComputedStyle(node);
    const filled = node instanceof HTMLElement && !/^(transparent|rgba\(\d+, \d+, \d+, 0\))$/.test(style.backgroundColor);
    const bordered = node instanceof HTMLElement && parseFloat(style.borderTopWidth) > 0 && style.borderTopStyle !== 'none';
    if (filled || bordered || node instanceof SVGGeometryElement) boxes.push(node.getBoundingClientRect());
    for (const child of node.childNodes) {
      if (child.nodeType !== Node.TEXT_NODE || !child.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(child);
      boxes.push(...range.getClientRects());
    }
  }
  return [...stage.querySelectorAll('.dr-lettering')]
    .filter(word => Number(getComputedStyle(word).opacity) > 0)
    .filter((word) => {
      const box = word.getBoundingClientRect();
      return boxes.some(other => other.width > 0 && other.height > 0
        && other.left < box.right && other.right > box.left && other.top < box.bottom && other.bottom > box.top);
    })
    .map(word => word.textContent);
}

for (const [topic, lesson] of Object.entries(loadRegistry('video'))) {
  if (lesson.animation.theme !== 'drafting-room') continue;
  test(`${topic}: no sheet lettering shows under or against the pictures`, async ({ page }) => {
    const timing = require(`../_data/explainers/${topic}_timing.json`);
    await page.setViewportSize({ width: 960, height: 540 });
    await page.goto(lesson.animation.page);
    await page.evaluate(() => window.VideoNarrationStage.ready);
    const touching = {};
    for (const scene of timing.scenes) {
      for (const cue of scene.cues) {
        await page.evaluate(time => window.VideoNarrationStage.seek(time), cue.end - 0.3);
        const words = await page.evaluate(lettersTouchingThePicture);
        if (words.length) touching[`${scene.id}/${cue.id}`] = words;
      }
    }
    expect(touching).toEqual({});
  });
}
