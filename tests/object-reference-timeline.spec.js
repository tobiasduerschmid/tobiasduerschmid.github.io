// @ts-check
const { test, expect } = require('@playwright/test');

test('future-aware playback retains object order while reclaiming unused space', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/SEBook/tools/python.html');
  const lab = page.getByRole('region', { name: 'Object reference lab: Which references survive a copy?', exact: true });
  const diagram = lab.getByRole('region', { name: 'Object reference diagram', exact: true });
  let before = {};
  while (await lab.getByRole('button', { name: 'Forward', exact: true }).isEnabled()) {
    await lab.getByRole('button', { name: 'Forward', exact: true }).click();
    await expect(diagram.locator('.orl-graph')).toHaveAttribute('aria-busy', 'false');
    const after = await diagram.evaluate(root => {
      const origin = root.getBoundingClientRect();
      return Object.fromEntries([...root.querySelectorAll('[data-object-id]')].map(row => {
        const card = row.querySelector('.orl-object').getBoundingClientRect();
        return [row.getAttribute('data-object-id'), { x: card.left - origin.left, y: card.top - origin.top }];
      }));
    });
    const survivors = Object.keys(before).filter(id => after[id]);
    for (const a of survivors) for (const b of survivors) for (const axis of ['x', 'y']) {
      const oldOrder = before[a][axis] - before[b][axis], newOrder = after[a][axis] - after[b][axis];
      if (Math.abs(oldOrder) > 1 && Math.abs(newOrder) > 1) {
        expect(Math.sign(newOrder), `${a} and ${b} retain their ${axis} order while compacting`).toBe(Math.sign(oldOrder));
      }
    }
    if (Object.keys(after).length === 2) {
      const bounds = await diagram.boundingBox();
      expect(bounds.height, 'two early objects should not reserve a full page for future copies').toBeLessThan(350);
    }
    before = after;
  }
  expect(Object.keys(before).length).toBeGreaterThan(4);
});

test('the nested-loop example spreads across a wide panel instead of forming a narrow tower', async ({ page }) => {
  await page.setViewportSize({ width: 2048, height: 1200 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/SEBook/tools/python.html');
  const lab = page.getByRole('region', { name: 'Object reference lab: Does assigning the loop name replace a list entry?', exact: true });
  const diagram = lab.getByRole('region', { name: 'Object reference diagram', exact: true });
  while (await lab.getByRole('button', { name: 'Forward', exact: true }).isEnabled()) {
    await lab.getByRole('button', { name: 'Forward', exact: true }).click();
  }
  await expect(diagram.locator('.orl-graph')).toHaveAttribute('aria-busy', 'false');
  const space = await diagram.evaluate(root => {
    const box = root.getBoundingClientRect();
    const cards = [...root.querySelectorAll('.orl-object')].map(card => card.getBoundingClientRect());
    return { width: box.width, height: box.height, spread: Math.max(...cards.map(c => c.right)) - Math.min(...cards.map(c => c.left)) };
  });
  expect(space.height, 'six small cards should fit in a short wide diagram').toBeLessThan(600);
  expect(space.spread, 'use multiple columns across the available width').toBeGreaterThan(space.width * 0.6);
});
