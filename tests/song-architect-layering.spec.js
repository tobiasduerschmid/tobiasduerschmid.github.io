// @ts-check
const { test, expect } = require('@playwright/test');

const PLAYER = '/assets/song-player/draw-it-out.html';

// The architect (js/song-video/architect.js) as the live player draws it.
// The song itself never swings the architect's arm across its body, so a
// stand-in scene is served in place of its choreography: one architect,
// first pointing across itself at shoulder height, then ticking something
// off across itself at waist height.
const SCENE = `
window.SongChoreographies = window.SongChoreographies || {};
window.SongChoreographies.draw_it_out = function ({ kit, layers }) {
  const scene = kit.scene(layers.content, 0, 30);
  window.ArchitectKit.architect(scene, {
    x: 400, y: 150, tag: '', at: 0.1,
    moves: [[1, 'point', { to: [380, 270], hold: 1.5 }], [5, 'check', { to: [370, 350], hold: 20 }]],
  });
};`;

/**
 * At every sampled point where both parts are painted, whether `upper` is
 * the one on top (hit testing reports the painted elements top first).
 */
async function onTopWhereBothPaint(page, upper, lower) {
  return page.evaluate(([upperId, lowerId]) => {
    const a = document.querySelector(`[data-testid="${upperId}"]`);
    const b = document.querySelector(`[data-testid="${lowerId}"]`);
    const [ra, rb] = [a.getBoundingClientRect(), b.getBoundingClientRect()];
    const answers = [];
    for (let x = Math.max(ra.left, rb.left) + 0.5; x < Math.min(ra.right, rb.right); x += 1.5) {
      for (let y = Math.max(ra.top, rb.top) + 0.5; y < Math.min(ra.bottom, rb.bottom); y += 1.5) {
        const hits = document.elementsFromPoint(x, y);
        const [i, j] = [hits.findIndex((node) => a.contains(node)), hits.findIndex((node) => b.contains(node))];
        if (i >= 0 && j >= 0) answers.push(i < j);
      }
    }
    return answers;
  }, [upper, lower]);
}

test('an arm swung across the body passes in front of the collar, the other shoulder, and the other arm', async ({ page }) => {
  await page.route('**/js/song-video/songs/draw_it_out.js', (route) => route.fulfill({ contentType: 'text/javascript', body: SCENE }));
  await page.goto(PLAYER);
  await expect(page.getByTestId('song-picture')).toBeVisible();

  // Pointing across at shoulder height, the sleeve lies over the collar and
  // the other armhole.
  await page.evaluate(() => window.Timeline.seek(2));
  for (const lower of ['dio-arch-collar', 'dio-arch-roll-shoulder']) {
    const onTop = await onTopWhereBothPaint(page, 'dio-arch-pen-shoulder', lower);
    expect(onTop.length, `the sleeve crosses ${lower}`).toBeGreaterThan(0);
    expect(onTop.every(Boolean), `the sleeve is in front of ${lower}`).toBe(true);
  }

  // Ticking off across the waist, the forearm and hand pass over the other arm.
  await page.evaluate(() => window.Timeline.seek(5.2));
  const onTop = await onTopWhereBothPaint(page, 'dio-arch-pen-forearm', 'dio-arch-roll-forearm');
  expect(onTop.length, 'the forearms cross').toBeGreaterThan(0);
  expect(onTop.every(Boolean), 'the crossing forearm is in front').toBe(true);
});
