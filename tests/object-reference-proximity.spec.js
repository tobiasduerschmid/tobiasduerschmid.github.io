// @ts-check
const { test, expect } = require('@playwright/test');
const control = (lab, name) => lab.getByRole('button', { name, exact: true });
const diagramFor = lab => lab.getByRole('region', { name: 'Object reference diagram', exact: true });
async function settled(lab) {
  await expect(diagramFor(lab).locator('.orl-graph')).toHaveAttribute('aria-busy', 'false');
}
async function geometry(lab) {
  await settled(lab);
  return diagramFor(lab).evaluate(region => {
    const origin = region.getBoundingClientRect();
    return Object.fromEntries(Array.from(region.querySelectorAll('.orl-object-row'), row => {
      const rect = row.getBoundingClientRect();
      return [row.dataset.objectId, { x: rect.left - origin.left, y: rect.top - origin.top,
        width: rect.width, height: rect.height }];
    }));
  });
}

test('a named primitive and its list slot reach one object; equal distinct strings stay distinct', async ({ page }) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/SEBook/tools/python.html');
  const lab = page.getByRole('region', { name: 'Object reference lab: Changing a row or replacing a slot', exact: true });
  const code = 't = "draft"\nrow = [t]\nother = "".join(["dr", "aft"])\nrow.append(other)\nprint(t is row[0], t is row[1])';
  await lab.getByRole('textbox', { name: 'Python code', exact: true }).fill(code);
  await expect(lab.getByRole('status')).toContainText(/Step 1 of/, { timeout: 90_000 });
  while (await control(lab, 'Forward').isEnabled()) await control(lab, 'Forward').click();
  await settled(lab);
  await expect(lab.getByRole('region', { name: 'Program output', exact: true })).toHaveText('True False');
  const diagram = diagramFor(lab);
  const t = diagram.locator('.orl-object-row').filter({ has: page.getByText('t', { exact: true }) });
  const identity = await t.getAttribute('data-object-id');
  await expect(t.getByRole('region', { name: identity + ': str', exact: true })).toContainText("'draft'");
  await expect(diagram.getByRole('button', { name: 'Follow [0] to ' + identity + ': str', exact: true })).toBeVisible();
  await expect(diagram.getByRole('region', { name: /o\d+: str$/ })).toHaveCount(2);
  const arrows = await diagram.evaluate(root => [...root.querySelectorAll('.orl-reference-edge')].map(path => ({
    target: path.dataset.targetObject, length: path.getTotalLength()
  })));
  expect(arrows).toHaveLength(2);
  expect(new Set(arrows.map(arrow => arrow.target)).size).toBe(2);
  expect(arrows.every(arrow => arrow.length < 220), 'two adjacent string objects need no page-length detour').toBe(true);
  await control(lab, 'Restart').click();
  await expect(lab.getByRole('status')).toContainText('Step 1 of');
  await expect(lab.getByRole('textbox', { name: 'Python code', exact: true })).toHaveValue(code);
  await expect(control(lab, 'Back')).toBeDisabled();
  await expect(control(lab, 'Stop')).toHaveCount(0);
  await expect(control(lab, 'Trace Python')).toHaveCount(0);
  await control(lab, 'Restore original code').click();
  await expect(lab.getByRole('textbox', { name: 'Python code', exact: true })).not.toHaveValue(code);
});

test('surviving objects keep their relative order, Back restores positions, and output-only steps do not flicker', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/SEBook/tools/python.html');
  const lab = page.getByRole('region', { name: 'Object reference lab: Which references survive a copy?', exact: true });
  let before = await geometry(lab);
  let sawObjects = false;
  while (await control(lab, 'Forward').isEnabled()) {
    await control(lab, 'Forward').click();
    const after = await geometry(lab);
    sawObjects ||= Object.keys(after).length > 4;
    const survivors = Object.keys(before).filter(id => after[id]);
    const position = await lab.getByRole('status').innerText();
    if (/Next: line (8|9)\b/.test(position)) {
      // Appending one new value to either copy does not require reordering or
      // moving existing objects into other columns. Extra height is available.
      for (const id of survivors) {
        expect(after[id].x, `${id} stays in place while another value is appended`).toBe(before[id].x);
        expect(after[id].y, `${id} stays in place while another value is appended`).toBe(before[id].y);
      }
    }
    for (const a of survivors) for (const b of survivors) {
      if (a === b || Math.abs(before[a].x - before[b].x) > 12 || Math.abs(after[a].x - after[b].x) > 12) continue;
      expect(Math.sign(after[a].y - after[b].y), `${a} and ${b} should not swap within their layer`)
        .toBe(Math.sign(before[a].y - before[b].y));
    }
    await control(lab, 'Back').click();
    expect(await geometry(lab), 'Back returns to the same recorded diagram positions').toEqual(before);
    await control(lab, 'Forward').click();
    expect(await geometry(lab)).toEqual(after);
    before = after;
  }
  expect(sawObjects).toBe(true);
  const diagram = diagramFor(lab);
  const finalGeometry = await geometry(lab);
  // End-of-execution and the preceding print have the same graph.
  const retained = await diagram.locator('.orl-object').first().elementHandle();
  await control(lab, 'Back').click();
  expect(await geometry(lab)).toEqual(finalGeometry);
  expect(await retained.evaluate(card => card.isConnected && getComputedStyle(card).opacity === '1')).toBe(true);
  expect(await diagram.evaluate(root => root.getAnimations({ subtree: true }).length)).toBe(0);
});

test('cyclic and densely shared scenes keep every primitive and reference reachable without overlapping cards', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/SEBook/tools/python.html');
  await page.waitForFunction(() => Boolean(window.ObjectReferenceGraph));
  const scene = {
    scopes: [{ id: 'global', name: 'Global names', bindings: [{ name: 'start', target: 'a' }] }],
    objects: [
      { id: 'a', type: 'list', entries: [{ label: '[0]', target: 'a' }, { label: '[1]', target: 'b' }, { label: '[2]', target: 'x' }] },
      { id: 'b', type: 'list', entries: [{ label: '[0]', target: 'a' }, { label: '[1]', target: 'x' }, { label: '[2]', target: 'y' }, { label: '[3]', target: 'z' }] },
      { id: 'c', type: 'list', entries: [{ label: '[0]', target: 'x' }, { label: '[1]', target: 'y' }, { label: '[2]', target: 'z' }] },
      { id: 'd', type: 'list', entries: [{ label: '[0]', target: 'x' }, { label: '[1]', target: 'y' }, { label: '[2]', target: 'z' }] },
      { id: 'x', type: 'str', value: "'shared'" }, { id: 'y', type: 'int', value: '17' }, { id: 'z', type: 'NoneType', value: 'None' }
    ]
  };
  await page.evaluate(async step => {
    const fixture = document.createElement('div');
    fixture.className = 'object-reference-lab';
    fixture.setAttribute('role', 'region'); fixture.setAttribute('aria-label', 'Graph geometry fixture');
    const scroll = document.createElement('div'); scroll.className = 'orl-graph-scroll';
    const host = document.createElement('div'); host.className = 'orl-graph';
    scroll.append(host); fixture.append(scroll); document.querySelector('main').prepend(fixture);
    const graph = new window.ObjectReferenceGraph.ReferenceGraph(host);
    await graph.render(step);
  }, scene);
  const fixture = page.getByRole('region', { name: 'Graph geometry fixture', exact: true });
  for (const width of [1400, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(fixture.locator('.orl-graph')).toHaveAttribute('aria-busy', 'false');
    await expect(fixture.locator('.orl-object')).toHaveCount(scene.objects.length);
    await expect.poll(() => fixture.evaluate(root => {
      const graph = root.querySelector('.orl-graph');
      const failures = [];
      const cards = [...root.querySelectorAll('.orl-object-row')].map(row => ({ id: row.dataset.objectId, bounds: row.getBoundingClientRect() }));
      const paths = [...root.querySelectorAll('.orl-reference-edge')];
      if (paths.length !== root.querySelectorAll('[data-reference-target]').length) failures.push('missing arrow');
      for (let a = 0; a < cards.length; a++) for (let b = a + 1; b < cards.length; b++) {
        const x = cards[a].bounds, y = cards[b].bounds;
        if (x.left < y.right - 1 && x.right > y.left + 1 && x.top < y.bottom - 1 && x.bottom > y.top + 1) failures.push('overlapping cards');
      }
      for (const path of paths) {
        const matrix = path.getScreenCTM(), length = path.getTotalLength();
        const bounds = graph.getBoundingClientRect();
        for (let t = 0; t <= length; t += 2) {
          const p = path.getPointAtLength(t).matrixTransform(matrix);
          if (p.x < bounds.left - 1 || p.x > bounds.right + 1 || p.y < bounds.top - 1 || p.y > bounds.bottom + 1) failures.push('clipped arrow');
          for (const card of cards) {
            const r = card.bounds;
            if (card.id !== path.dataset.sourceObject && card.id !== path.dataset.targetObject
                && p.x > r.left + 1 && p.x < r.right - 1 && p.y > r.top + 1 && p.y < r.bottom - 1) failures.push('arrow crosses an unrelated object or name');
          }
        }
      }
      return [...new Set(failures)];
    })).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
  }
});
