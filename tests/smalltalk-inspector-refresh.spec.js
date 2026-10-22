const { test, expect: standardExpect } = require('@playwright/test');
const { mountSmalltalkFixture } = require('./helpers/smalltalk-runtime');
const { a11yCheckpoint } = require('./a11y-helpers');
const { selectAllInMonaco } = require('./helpers/monaco-keyboard');
const expect = standardExpect.configure({ timeout: 30000 });
test.setTimeout(180000);

const program = {
  version: 1, stepKey: 'refresh', revision: 0,
  files: [{ path: '/counter.st', kind: 'source', format: 'filein', content:
    "Object subclass: #RefreshCounter instanceVariableNames: 'count' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Tests'!\n" +
    "!RefreshCounter methodsFor: 'testing'!\ninitialize super initialize. count := 0!\nadvance count := count + 5! !" }],
  changes: { version: 1, source: '', entries: [] }, runCommand: null,
};

async function evaluate(page, source, value) {
  const input = page.getByRole('textbox', { name: /Smalltalk expression/ });
  await input.focus(); await selectAllInMonaco(input);
  await expect.poll(() => input.evaluate(node => node.selectionStart === 0 && node.selectionEnd === node.value.length)).toBe(true);
  await input.press('Backspace'); await page.keyboard.insertText(source);
  await expect(input).toHaveValue(source);
  await page.getByRole('button', { name: 'Evaluate', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Evaluate', exact: true })).toBeEnabled();
  await expect(page.getByRole('region', { name: 'Evaluation result', exact: true })).toHaveText(value);
}

test('Refresh shows mutations of the retained counter and becomes unavailable after restart', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const cleanup = await mountSmalltalkFixture(page, { program, views: ['inspector'] });
  try {
    await evaluate(page, 'counter := RefreshCounter new', 'a RefreshCounter');
    await page.getByRole('button', { name: 'Inspect result', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Result object', exact: true });
    await expect(panel.getByRole('definition').getByText('0', { exact: true })).toBeVisible();
    await evaluate(page, 'counter advance. counter advance. 10', '10');
    await expect(panel.getByRole('definition').getByText('0', { exact: true })).toBeVisible();
    const refresh = panel.getByRole('button', { name: 'Refresh Result object', exact: true });
    await refresh.focus(); await refresh.press('Enter');
    await expect(panel.getByRole('term')).toHaveText('count');
    await expect(panel.getByRole('definition').getByText('10', { exact: true })).toBeVisible();
    await expect(panel.getByRole('status', { name: 'Result inspection status' })).toContainText('Refreshed');
    await expect(refresh).toBeFocused();
    await a11yCheckpoint(page, 'inspector-refreshed', { feature: 'smalltalk-inspector' });

    await page.setViewportSize({ width: 320, height: 800 });
    await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
    await page.getByRole('button', { name: 'Restart session', exact: true }).click();
    await expect(panel.getByRole('status')).toContainText('Stale object');
    await expect(refresh).toBeDisabled();
    await expect(panel.getByRole('button', { name: 'Expand count', exact: true })).toBeDisabled();
    await expect(panel.getByRole('definition').getByText('10', { exact: true })).toBeVisible();
    await a11yCheckpoint(page, 'refreshed-inspector-restarted', { feature: 'smalltalk-inspector' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
  } finally { await cleanup(); }
});

test('Refresh replaces paged slots and starts again at the beginning', async ({ page }) => {
  const cleanup = await mountSmalltalkFixture(page, { program, views: ['inspector'] });
  try {
    await evaluate(page, 'values := (1 to: 26) asArray', 'a Array');
    await page.getByRole('button', { name: 'Inspect result', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Result object', exact: true });
    const next = panel.getByRole('button', { name: 'Next slots for Result', exact: true, includeHidden: true });
    await next.click(); await expect(panel.getByRole('term')).toHaveCount(26);
    await evaluate(page, 'values at: 1 put: 101. values at: 26 put: 126', '126');

    await panel.getByRole('button', { name: 'Refresh Result object', exact: true }).click();
    await expect(panel.getByRole('term')).toHaveCount(25);
    await expect(panel.getByRole('term').first()).toHaveText('1');
    await expect(panel.getByRole('definition').first().getByText('101', { exact: true })).toBeVisible();
    await next.click(); await expect(panel.getByRole('term')).toHaveCount(26);
    await expect(panel.getByRole('term').last()).toHaveText('26');
    await expect(panel.getByRole('definition').last().getByText('126', { exact: true })).toBeVisible();
    await expect(next).toBeHidden();
  } finally { await cleanup(); }
});

// Observe only the public native Workspace contract, so handle ownership can be
// checked by trying to inspect a live handle instead of reading view internals.
async function observeNativeInspections(page) {
  await page.evaluate(() => {
    const workspace = window.smalltalkFixtureWorkspace;
    const inspect = workspace.inspect.bind(workspace);
    const responses = [];
    workspace.inspect = async (...args) => {
      const response = await inspect(...args); responses.push(response); return response;
    };
    window.refreshHandles = {
      responses,
      async probe(handle) {
        try {
          const response = await inspect(handle, 0, 25);
          await workspace.releaseHandles(response.slots.map(slot => slot.value.handle), { sessionId: response.sessionId });
          return 'live';
        } catch (error) { return error.code; }
      },
    };
  });
}

test('Refresh releases obsolete children while expanded panels and the terminal result keep their roots', async ({ page }) => {
  const cleanup = await mountSmalltalkFixture(page, { program, views: ['inspector'] });
  try {
    await observeNativeInspections(page);
    await evaluate(page, 'holder := Array with: (Array with: 42) with: (Array with: 13)', 'a Array');
    await page.getByRole('button', { name: 'Inspect result', exact: true }).click();
    const parent = page.getByRole('region', { name: 'Result object', exact: true });
    await expect(parent.getByRole('term')).toHaveCount(2);
    const children = await page.evaluate(() => window.refreshHandles.responses[0].slots.map(slot => slot.value.handle));
    await parent.getByRole('button', { name: 'Expand 1', exact: true }).click();
    const child = page.getByRole('region', { name: '1 object', exact: true });
    await expect(child.getByRole('definition').getByText('42', { exact: true })).toBeVisible();

    // No new evaluation: holder remains the terminal result during refresh.
    await parent.getByRole('button', { name: 'Refresh Result object', exact: true }).click();
    await expect(parent.getByRole('status')).toContainText('Refreshed');
    await expect.poll(() => page.evaluate(handle => window.refreshHandles.probe(handle), children[1])).toBe('STALE_HANDLE');
    expect(await page.evaluate(handle => window.refreshHandles.probe(handle), children[0])).toBe('live');
    await child.getByRole('button', { name: 'Refresh 1 object', exact: true }).click();
    await expect(child.getByRole('definition').getByText('42', { exact: true })).toBeVisible();

    await parent.getByRole('button', { name: 'Close Result inspector', exact: true }).click();
    await page.getByRole('button', { name: 'Inspect result', exact: true }).click();
    await expect(parent.getByRole('term')).toHaveCount(2);
    await child.getByRole('button', { name: 'Close 1 inspector', exact: true }).click();
    await expect.poll(() => page.evaluate(handle => window.refreshHandles.probe(handle), children[0])).toBe('STALE_HANDLE');
  } finally { await cleanup(); }
});

test('Closing an inspector during Refresh releases its late native slot handles', async ({ page }) => {
  const cleanup = await mountSmalltalkFixture(page, { program, views: ['inspector'] });
  try {
    await evaluate(page, 'Array with: (Array with: 42)', 'a Array');
    await page.getByRole('button', { name: 'Inspect result', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Result object', exact: true });
    await expect(panel.getByRole('term')).toHaveCount(1);
    await observeNativeInspections(page);
    await page.evaluate(() => {
      const workspace = window.smalltalkFixtureWorkspace;
      const inspect = workspace.inspect.bind(workspace);
      let deliver;
      const gate = new Promise(resolve => { deliver = resolve; });
      window.deliverRefresh = deliver;
      workspace.inspect = async (...args) => { const result = await inspect(...args); await gate; return result; };
    });
    await panel.getByRole('button', { name: 'Refresh Result object', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.refreshHandles.responses.length)).toBe(1);
    const lateHandle = await page.evaluate(() => window.refreshHandles.responses[0].slots[0].value.handle);
    await panel.getByRole('button', { name: 'Close Result inspector', exact: true }).click();
    await page.evaluate(() => window.deliverRefresh());
    await expect.poll(() => page.evaluate(handle => window.refreshHandles.probe(handle), lateHandle)).toBe('STALE_HANDLE');
    await expect(panel).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Inspect result', exact: true })).toBeFocused();
  } finally { await cleanup(); }
});
