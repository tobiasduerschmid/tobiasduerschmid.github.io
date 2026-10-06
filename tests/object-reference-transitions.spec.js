// @ts-check
const { test, expect } = require('@playwright/test');
const control = (lab, name) => lab.getByRole('button', { name, exact: true });
const diagram = lab => lab.getByRole('region', { name: 'Object reference diagram', exact: true });
async function ready(lab) { await expect(diagram(lab).locator('.orl-graph')).toHaveAttribute('aria-busy', 'false'); }
async function still(lab) {
  await ready(lab);
  await expect.poll(() => diagram(lab).evaluate(root => root.getAnimations({ subtree: true }).length)).toBe(0);
}
async function cardPosition(card) {
  return card.evaluate(node => {
    const a = node.getBoundingClientRect(), b = node.closest('.orl-graph').getBoundingClientRect();
    return { x: a.x - b.x, y: a.y - b.y };
  });
}

test('a loop name enters without moving its unchanged target, then the same name and arrow interpolate on rebinding', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/SEBook/tools/python.html');
  const lab = page.getByRole('region', { name: 'Object reference lab: Does assigning the loop name replace a list entry?', exact: true });
  for (let i = 0; i < 2; i++) await control(lab, 'Forward').click();
  await still(lab);
  const target = diagram(lab).getByRole('region', { name: 'o2: list', exact: true });
  const before = await cardPosition(target);
  await control(lab, 'Forward').click();
  await ready(lab);
  const binding = diagram(lab).locator('.orl-binding').filter({ has: page.getByText('batch', { exact: true }) });
  await expect(binding).toHaveAttribute('data-change', 'added');
  await expect(target).toHaveAttribute('data-change', '');
  const positions = await target.evaluate(async node => {
    const result = [];
    for (let i = 0; i < 8; i++) {
      const a = node.getBoundingClientRect(), b = node.closest('.orl-graph').getBoundingClientRect();
      result.push({ x: a.x - b.x, y: a.y - b.y, animations: node.getAnimations().length });
      await new Promise(requestAnimationFrame);
    }
    return result;
  });
  for (const position of positions) {
    expect(position.x).toBeCloseTo(before.x, 1);
    expect(position.y).toBeCloseTo(before.y, 1);
    expect(position.animations, 'a new binding must not animate a stationary object').toBe(0);
  }
  await still(lab);
  const labelHandle = await binding.elementHandle();
  const bindingId = await binding.getAttribute('data-binding-id');
  const arrowHandle = await diagram(lab).evaluateHandle((root, id) => [...root.querySelectorAll('.orl-binding-edge')]
    .find(path => path.dataset.bindingId === id), bindingId);
  await control(lab, 'Forward').click(); // batch = []
  await ready(lab);
  expect(await labelHandle.evaluate(node => node.isConnected), 'the name is moved, not replaced').toBe(true);
  expect(await arrowHandle.evaluate(node => node.isConnected), 'the arrow retains its identity').toBe(true);
  await expect(binding).toHaveAttribute('data-change', 'changed');
  const samples = await arrowHandle.evaluate(async path => {
    const result = [];
    for (let i = 0; i < 8; i++) {
      const label = [...path.closest('.orl-graph').querySelectorAll('.orl-binding')]
        .find(node => node.dataset.bindingId === path.dataset.bindingId);
      const slot = label.querySelector('.orl-name-slot').getBoundingClientRect();
      const start = path.getPointAtLength(0).matrixTransform(path.getScreenCTM());
      result.push({ x: start.x, y: start.y, error: Math.hypot(start.x - slot.right, start.y - slot.top - slot.height / 2),
        opacity: getComputedStyle(path).opacity });
      await new Promise(requestAnimationFrame);
    }
    return result;
  });
  expect(samples.every(sample => sample.error < 3 && sample.opacity === '1'), 'the visible pointer stays attached to its moving origin').toBe(true);
  expect(new Set(samples.map(sample => sample.x + ':' + sample.y)).size, 'the pointer origin moves through intermediate positions').toBeGreaterThan(2);
  await still(lab);
  await expect(diagram(lab).getByRole('region', { name: 'o6: list', exact: true }).getByText('Added', { exact: true })).toBeVisible();
});

test('change cues compare with the previous step when quick steps supersede its layout', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/SEBook/tools/python.html?reduce-motion=1');
  const lab = page.getByRole('region', { name: 'Object reference lab: Changing a row or replacing a slot', exact: true });
  await expect(control(lab, 'Forward')).toBeEnabled();
  // A held key or fast clicking requests steps before each layout finishes.
  await control(lab, 'Forward').evaluate(button => { for (let i = 0; i < 4; i++) button.click(); });
  await still(lab);
  await expect(lab.getByRole('status').filter({ hasText: /^Step 5 of/ })).toBeVisible();
  // Step 5 appended to the row; the board already existed at step 4.
  await expect(diagram(lab).getByRole('region', { name: 'o1: list', exact: true }).getByText('Changed', { exact: true })).toBeVisible();
  await expect(diagram(lab).getByRole('region', { name: 'o3: list', exact: true }).getByText('Added', { exact: true })).toHaveCount(0);
});

for (const theme of ['light', 'dark']) {
  test(`change cues distinguish data mutation from name rebinding in ${theme} reduced-motion frames`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/SEBook/tools/python.html?reduce-motion=1');
    if (theme === 'dark') await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
    const lab = page.getByRole('region', { name: 'Object reference lab: Changing a row or replacing a slot', exact: true });
    for (let i = 0; i < 4; i++) await control(lab, 'Forward').click();
    await still(lab);
    const row = diagram(lab).getByRole('region', { name: 'o1: list', exact: true });
    await expect(row.getByText('Changed', { exact: true })).toBeVisible();
    expect(await row.evaluate(node => getComputedStyle(node).boxShadow)).not.toBe('none');
    const added = diagram(lab).getByRole('region', { name: 'o4: int', exact: true });
    await expect(added.getByText('Added', { exact: true })).toBeVisible();
    await control(lab, 'Forward').click();
    await still(lab);
    await expect(row.getByText('Changed', { exact: true })).toHaveCount(0);
    const board = diagram(lab).getByRole('region', { name: 'o3: list', exact: true });
    await expect(board.getByText('Changed', { exact: true })).toBeVisible();
    const position = await cardPosition(board);
    await control(lab, 'Forward').click(); // Output-only state.
    await still(lab);
    await expect(diagram(lab).getByText('Changed', { exact: true })).toHaveCount(0);
    await expect(diagram(lab).getByText('Added', { exact: true })).toHaveCount(0);
    expect(await cardPosition(board), 'clearing a change label must not change layout').toEqual(position);
    expect(await diagram(lab).evaluate(root => root.getAnimations({ subtree: true }).length)).toBe(0);
  });
}
