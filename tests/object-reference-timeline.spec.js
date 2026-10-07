// @ts-check
const { test, expect } = require('@playwright/test');

for (const width of [320, 390]) {
  test(`mobile playback reclaims empty diagram margins at ${width}px`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/SEBook/tools/python.html');
    const lab = page.getByRole('region', { name: 'Object reference lab: Changing a row or replacing a slot', exact: true });
    // Entering/exiting the generator creates temporary aliases whose future
    // reservations used to leave large blank bands above and between cards.
    await lab.getByRole('textbox', { name: 'Python code', exact: true }).fill(
      'numbers = [1, 3, 5]\nodds = (n for n in numbers)\nshared = odds\nnext(odds)\nnext(shared)\nprint(next(odds))');
    await expect(lab.getByRole('status')).toContainText('Step 1 of 17', { timeout: 90_000 });
    const graph = lab.getByRole('region', { name: 'Object reference diagram', exact: true }).locator('.orl-graph');
    const geometry = async () => {
      await expect(graph).toHaveAttribute('aria-busy', 'false');
      return graph.evaluate(root => {
        const box = root.getBoundingClientRect();
        const rows = [...root.querySelectorAll('.orl-object-row')].map(row => {
          const card = row.getBoundingClientRect();
          return { x: card.left - box.left, y: card.top - box.top, width: card.width, height: card.height };
        });
        const occupied = [...root.querySelectorAll('.orl-object-row, .orl-reference-edge')]
          .map(element => element.getBoundingClientRect());
        return { rows, top: Math.min(...occupied.map(r => r.top)) - box.top,
          bottom: box.bottom - Math.max(...occupied.map(r => r.bottom)),
          pageOverflow: document.documentElement.scrollWidth - innerWidth };
      });
    };
    for (let step = 2; step <= 17; step++) {
      await lab.getByRole('button', { name: 'Forward', exact: true }).click();
      const bounds = await geometry();
      if (step === 2) {
        // The first line event is before the first assignment executes.
        await expect(graph).toHaveText('No data references to show yet.');
        continue;
      }
      expect(bounds.rows.length).toBeGreaterThan(0);
      expect(bounds.top, `step ${step} has no unused future alias margin`).toBeLessThanOrEqual(22);
      expect(bounds.top, 'cards and routes retain an inset').toBeGreaterThanOrEqual(0);
      expect(bounds.bottom, 'no unused space after the last card or route').toBeLessThanOrEqual(22);
      expect(bounds.bottom).toBeGreaterThanOrEqual(0);
      expect(bounds.pageOverflow, 'the diagram must not widen the page').toBeLessThanOrEqual(1);
      if (step === 14) {
        await lab.getByRole('button', { name: 'Back', exact: true }).click();
        await geometry();
        await lab.getByRole('button', { name: 'Forward', exact: true }).click();
        expect(await geometry(), 'revisiting the step restores the compact scene').toEqual(bounds);
      }
    }
  });
}

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
