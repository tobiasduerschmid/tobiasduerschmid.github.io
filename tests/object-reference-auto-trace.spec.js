// @ts-check
const { test, expect } = require('@playwright/test');
const { auditInteractiveState } = require('./a11y-helpers');

test.setTimeout(150_000);
const action = (lab, name) => lab.getByRole('button', { name, exact: true });
const editorFor = lab => lab.getByRole('textbox', { name: 'Python code', exact: true });

async function openAtStepFive(page, query = '') {
  await page.goto('/SEBook/tools/python.html' + query);
  const lab = page.getByRole('region', { name: 'Object reference lab: Changing a row or replacing a slot', exact: true });
  for (let step = 1; step < 5; step += 1) await action(lab, 'Forward').click();
  await expect(lab.getByRole('status')).toContainText(/Step 5 of \d+ · Next: line 4/);
  await expect(lab.getByRole('region', { name: 'Object reference diagram', exact: true }).locator('.orl-graph'))
    .toHaveAttribute('aria-busy', 'false');
  return lab;
}

test('editing automatically retraces at the same step and keeps editing focus, selection, and print current', async ({ page }) => {
  const lab = await openAtStepFive(page);
  const editor = editorFor(lab);
  const code = (await editor.inputValue()).replace('append(1)', 'append(9)');
  await editor.fill(code);
  const selection = await editor.evaluate(input => [input.selectionStart, input.selectionEnd]);
  await expect(lab.getByRole('status')).toContainText(/Step 5 of \d+ · Next: line 4/, { timeout: 120_000 });
  await expect(editor).toBeFocused();
  expect(await editor.evaluate(input => [input.selectionStart, input.selectionEnd])).toEqual(selection);
  await expect(lab.getByRole('region', { name: 'Object reference diagram', exact: true }).getByText('9', { exact: true })).toBeVisible();
  await action(lab, 'Back').click();
  await expect(lab.getByRole('status')).toContainText(/Step 4 of \d+ · Next: line 3/);
  await action(lab, 'Forward').click();
  await expect(lab.getByRole('status')).toContainText(/Step 5 of \d+ · Next: line 4/);
  await auditInteractiveState(page, 'Automatically updated Python reference state', { include: '.object-reference-lab' });
  await page.emulateMedia({ media: 'print' });
  await expect(lab.locator('.orl-print-step').last()).toContainText('Output:\n[[0, 9], [2]]\n[0, 9]');
});

test('temporary syntax errors preserve the requested step across correction', async ({ page }) => {
  const lab = await openAtStepFive(page);
  const editor = editorFor(lab);
  const original = await editor.inputValue();
  await editor.fill('row = [');
  await expect(lab.getByRole('alert')).toContainText('SyntaxError', { timeout: 120_000 });
  await expect(editor).toBeEditable();
  await editor.fill(original.replace('append(1)', 'append(8)'));
  await expect(lab.getByRole('status')).toContainText(/Step 5 of \d+ · Next: line 4/, { timeout: 120_000 });
  await expect(lab.getByRole('alert')).toBeHidden();
  await expect(lab.getByRole('region', { name: 'Object reference diagram', exact: true }).getByText('8', { exact: true })).toBeVisible();
});

test('a shorter successful program selects its final available step', async ({ page }) => {
  const lab = await openAtStepFive(page);
  await editorFor(lab).fill('print("shorter")');
  await expect(lab.getByRole('status')).toContainText('Step 3 of 3 · End of execution', { timeout: 120_000 });
  await expect(lab.getByRole('status')).toContainText('ends before step 5');
  await expect(lab.getByRole('region', { name: 'Program output', exact: true })).toHaveText('shorter');
  await expect(action(lab, 'Forward')).toBeDisabled();
  await action(lab, 'Back').click();
  await expect(lab.getByRole('status')).toContainText('Step 2 of 3');
  await editorFor(lab).fill('');
  await expect(lab.getByRole('status')).toContainText('Step 2 of 2 · End of execution', { timeout: 120_000 });
  await expect(lab.getByRole('region', { name: 'Program output', exact: true })).toHaveText('(no output yet)');
});

test('editing during execution replaces the running program and returns to the saved step', async ({ page }) => {
  const lab = await openAtStepFive(page);
  const editor = editorFor(lab);
  const original = await editor.inputValue();
  const diagram = lab.getByRole('region', { name: 'Object reference diagram', exact: true });
  const oldDiagram = await diagram.innerText();
  await expect(action(lab, 'Trace Python')).toHaveCount(0);
  // A real blocking built-in makes cancellation observable without faking our worker.
  await editor.fill('import time\ntime.sleep(60)\nprint("obsolete")');
  await expect(lab.getByRole('status')).toContainText('Recording execution', { timeout: 120_000 });
  await expect(editor).toBeEditable();
  await expect(diagram).toHaveText(oldDiagram, { useInnerText: true });
  await editor.fill(original.replace('append(1)', 'append(7)'));
  await expect(diagram).toHaveText(oldDiagram, { useInnerText: true });
  await expect(lab.getByRole('status')).toContainText(/Step 5 of \d+ · Next: line 4/, { timeout: 120_000 });
  await expect(lab.getByRole('region', { name: 'Object reference diagram', exact: true }).getByText('7', { exact: true })).toBeVisible();
  await expect(lab.getByRole('alert')).toBeHidden();
  await expect(action(lab, 'Stop')).toHaveCount(0);
});

test('rapid edits and composition keep the latest source; restoring cancels pending edits', async ({ page }) => {
  const lab = await openAtStepFive(page);
  const editor = editorFor(lab);
  const original = await editor.inputValue();
  const now = new Date();
  await page.clock.install({ time: now });
  await page.clock.pauseAt(now);
  await editor.fill('print("first")');
  await page.clock.runFor(300);
  await editor.fill('print("latest")');
  await page.clock.runFor(300);
  await expect(lab.getByRole('status')).toContainText('Code changed');
  await expect(action(lab, 'Stop')).toHaveCount(0);
  await page.clock.runFor(1000);
  await expect(lab.getByRole('status')).toContainText('Step 3 of 3', { timeout: 120_000 });
  await expect(lab.getByRole('region', { name: 'Program output', exact: true })).toHaveText('latest');

  await editor.dispatchEvent('compositionstart');
  await editor.fill('print("composed")');
  await page.clock.runFor(2000);
  await expect(lab.getByRole('status')).toContainText('Code changed');
  await editor.dispatchEvent('compositionend');
  await page.clock.runFor(1000);
  await expect(lab.getByRole('region', { name: 'Program output', exact: true })).toHaveText('composed', { timeout: 120_000 });

  await editor.fill('print("reset")');
  await action(lab, 'Restore original code').click();
  await page.clock.runFor(2000);
  await expect(editor).toHaveValue(original);
  await expect(lab.getByRole('status')).toContainText('Step 1 of 8');
  await expect(action(lab, 'Stop')).toHaveCount(0);
});

for (const preference of ['animated', 'system', 'SEBook', 'system with site override off']) {
  test(`step changes keep connectors attached with ${preference} motion preference`, async ({ page }) => {
    const reduced = preference !== 'animated';
    await page.emulateMedia({ reducedMotion: preference.startsWith('system') ? 'reduce' : 'no-preference' });
    const query = preference === 'SEBook' ? '?reduce-motion=1'
      : preference === 'system with site override off' ? '?reduce-motion=0' : '';
    const lab = await openAtStepFive(page, query);
    const diagram = lab.getByRole('region', { name: 'Object reference diagram', exact: true });
    await expect.poll(() => diagram.evaluate(root => root.getAnimations({ subtree: true })
      .filter(animation => animation.playState === 'running').length)).toBe(0);
    await action(lab, 'Forward').click(); // A list slot now points to a new object.
    await expect(diagram.locator('.orl-graph')).toHaveAttribute('aria-busy', 'false');
    const active = await diagram.evaluate(root => root.getAnimations({ subtree: true })
      .filter(animation => animation.playState === 'running').length);
    if (reduced) expect(active).toBe(0);
    else expect(active, 'object/reference changes have a visible transition').toBeGreaterThan(0);
    // Sample actual animation frames: arrows must meet their measured ports
    // throughout motion, not only in the settled picture.
    const failures = await diagram.evaluate(async (root, reduced) => {
      const errors = [];
      const still = () => JSON.stringify([...root.querySelectorAll('.orl-object-row, .orl-reference-edge')]
        .map(node => { const box = node.getBoundingClientRect(); return [box.x, box.y, node.getAttribute('d')]; }));
      const initial = still();
      const near = (point, bounds) => point.x >= bounds.left - 5 && point.x <= bounds.right + 5
        && point.y >= bounds.top - 5 && point.y <= bounds.bottom + 5;
      for (let frame = 0; frame < 8; frame += 1) {
        await new Promise(requestAnimationFrame);
        if (reduced && still() !== initial) errors.push('motion with reduced motion enabled');
        for (const route of root.querySelectorAll('.orl-reference-edge')) {
          const source = Array.from(root.querySelectorAll('[data-reference-id][data-reference-target]'))
            .find(port => port.dataset.referenceId === route.dataset.referenceId);
          const target = root.querySelector('[data-object-id="' + route.dataset.targetObject + '"] .orl-object');
          const matrix = route.getScreenCTM();
          if (!source || !target || !matrix) { errors.push('missing endpoint'); continue; }
          const start = route.getPointAtLength(0).matrixTransform(matrix);
          const end = route.getPointAtLength(route.getTotalLength()).matrixTransform(matrix);
          if (!near(start, source.getBoundingClientRect())) errors.push('detached source');
          if (!near(end, target.getBoundingClientRect())) errors.push('detached target');
        }
      }
      return errors;
    }, reduced);
    expect(failures).toEqual([]);
    await expect.poll(() => diagram.evaluate(root => root.getAnimations({ subtree: true })
      .filter(animation => animation.playState === 'running').length)).toBe(0);
    await action(lab, 'Back').click();
    await action(lab, 'Restore original code').click();
    await expect(diagram).toContainText('No data references to show yet.');
    await expect.poll(() => diagram.evaluate(root => root.getAnimations({ subtree: true }).length)).toBe(0);
  });
}

for (const preference of ['system', 'SEBook']) {
  test(`turning on ${preference} reduced motion settles an active transition immediately`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const lab = await openAtStepFive(page);
    const diagram = lab.getByRole('region', { name: 'Object reference diagram', exact: true });
    await expect(diagram.locator('.orl-graph')).toHaveAttribute('aria-busy', 'false');
    await expect.poll(() => diagram.evaluate(root => root.getAnimations({ subtree: true }).length)).toBe(0);
    await action(lab, 'Forward').click();
    await expect(diagram.locator('.orl-graph')).toHaveAttribute('aria-busy', 'false');
    expect(await diagram.evaluate(root => root.getAnimations({ subtree: true }).length)).toBeGreaterThan(0);
    if (preference === 'system') await page.emulateMedia({ reducedMotion: 'reduce' });
    else await page.evaluate(() => document.documentElement.classList.add('prm-reduce'));
    await expect.poll(() => diagram.evaluate(root => root.getAnimations({ subtree: true }).length)).toBe(0);
    const frames = await diagram.evaluate(async root => {
      const sample = () => JSON.stringify([...root.querySelectorAll('.orl-object-row, .orl-reference-edge')]
        .map(node => { const box = node.getBoundingClientRect(); return [box.x, box.y, node.getAttribute('d')]; }));
      const frames = [sample()];
      for (let i = 0; i < 8; i++) { await new Promise(requestAnimationFrame); frames.push(sample()); }
      return frames;
    });
    expect(new Set(frames).size, 'reduced motion presents one complete still frame').toBe(1);
  });
}
