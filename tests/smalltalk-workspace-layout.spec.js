const { test, expect } = require('@playwright/test');
const { writeFile } = require('node:fs/promises');

test.setTimeout(180000);
const terminal = page => page.getByRole('region', { name: 'Smalltalk live terminal', exact: true });
const source = page => page.getByRole('region', { name: 'Method source', exact: true });

async function ready(page) {
  await page.goto('/SEBook/tools/smalltalk-tutorial');
  await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled({ timeout: 120000 });
  await expect(page.getByRole('region', { name: 'Smalltalk System Browser', exact: true })).toBeVisible();
  await expect(terminal(page)).toBeVisible();
  await page.getByRole('listbox', { name: 'Methods', exact: true }).selectOption({ label: 'increment' });
  await expect(source(page)).not.toHaveAttribute('aria-busy', 'true', { timeout: 30000 });
  await expect(source(page)).toContainText('count + 1', { timeout: 30000 });
}

async function typeSource(page, label, text) {
  const input = page.getByRole('textbox', { name: new RegExp('^' + label) });
  await input.focus();
  // Monaco chooses its modifier from the emulated platform, not the test host.
  const selectAll = await page.evaluate(() => /Macintosh/.test(navigator.userAgent) ? 'Meta+A' : 'Control+A');
  await input.press(selectAll);
  await expect(input).toBeFocused();
  await page.keyboard.press('Backspace');
  await expect(input).toHaveValue('');
  await page.keyboard.insertText(text);
  // Native Monaco indentation can add leading whitespace on pasted lines.
  // Verify all authored lines, then retain the actual exact draft for later.
  await expect.poll(async () => (await input.inputValue()).split('\n').map(line => line.trim())).toEqual(text.split('\n').map(line => line.trim()));
  return input.inputValue();
}

async function expectEditorValue(page, label, text) {
  const input = page.getByRole('textbox', { name: new RegExp('^' + label) });
  await input.focus();
  const selectAll = await page.evaluate(() => /Macintosh/.test(navigator.userAgent) ? 'Meta+A' : 'Control+A');
  await input.press(selectAll);
  await expect(input).toHaveValue(text);
}

async function usableControl(control) {
  await expect(control).toBeInViewport({ ratio: 1 });
  const geometry = await control.evaluate(node => {
    const rect = node.getBoundingClientRect();
    return { width: rect.width, height: rect.height, fontSize: parseFloat(getComputedStyle(node).fontSize), unoccluded: node.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)) };
  });
  expect(geometry.width).toBeGreaterThanOrEqual(24);
  expect(geometry.height).toBeGreaterThanOrEqual(24);
  expect(geometry.fontSize).toBeGreaterThanOrEqual(17);
  expect(geometry.unoccluded).toBe(true);
}

async function pressButton(page, name) {
  const button = page.getByRole('button', { name, exact: true });
  await button.focus();
  await expect(button).toBeFocused();
  await usableControl(button);
  await button.press('Enter');
  return button;
}

async function evaluate(page, text, result) {
  const button = terminal(page).getByRole('button', { name: 'Evaluate', exact: true });
  await expect(button).toBeEnabled({ timeout: 120000 });
  await typeSource(page, 'Smalltalk expression', text);
  await button.click();
  await expect(terminal(page).getByRole('region', { name: 'Evaluation result', exact: true })).toHaveText(result, { timeout: 30000 });
}

// Monaco's hidden input is not its usable writing surface. Measure the rendered
// editor, clipping by scroll ancestors and the viewport, then hit-test the text
// area so an overlaid dock cannot masquerade as available source space.
async function editorGeometry(region) {
  return region.locator('.monaco-editor').evaluate(editor => {
    const line = editor.querySelector('.view-line') || editor.querySelector('.view-lines');
    const style = getComputedStyle(line);
    const lineHeight = parseFloat(style.lineHeight);
    const rect = editor.getBoundingClientRect();
    let top = Math.max(0, rect.top), bottom = Math.min(innerHeight, rect.bottom);
    let left = Math.max(0, rect.left), right = Math.min(innerWidth, rect.right);
    for (let parent = editor.parentElement; parent; parent = parent.parentElement) {
      const css = getComputedStyle(parent), bounds = parent.getBoundingClientRect();
      if (/(auto|scroll|hidden|clip)/.test(css.overflowY)) { top = Math.max(top, bounds.top); bottom = Math.min(bottom, bounds.bottom); }
      if (/(auto|scroll|hidden|clip)/.test(css.overflowX)) { left = Math.max(left, bounds.left); right = Math.min(right, bounds.right); }
    }
    let visibleRows = 0;
    for (let y = top + lineHeight / 2; y + lineHeight / 2 <= bottom; y += lineHeight) {
      const points = [left + Math.min(90, (right - left) / 3), left + (right - left) / 2];
      if (points.every(x => editor.contains(document.elementFromPoint(x, y)))) visibleRows++;
      else break;
    }
    return { height: rect.height, top: rect.top, bottom: rect.bottom, clippedHeight: Math.max(0, bottom - top), lineHeight, visibleRows, fontSize: parseFloat(style.fontSize) };
  });
}

test('laptop workspace exposes ten source lines and usable terminal controls', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await ready(page);
  await evaluate(page, 'counter := SEBookCounter new. counter increment; value', '1');
  // Exercise the dock with both Program output and a retained terminal result.
  // An empty output region must not be the only layout that fits.
  const run = page.getByRole('button', { name: 'Run', exact: true });
  await run.click();
  await expect(page.getByRole('region', { name: 'Program output', exact: true })).toContainText(/Result: 1\s*$/, { timeout: 30000 });
  await expect(run).toBeEnabled();
  // Return to coding after Run; its contextual hover help is intentionally
  // dismissible, rather than part of the workspace's available source area.
  await page.getByRole('textbox', { name: /^Smalltalk method source/ }).focus();
  await source(page).locator('.monaco-editor').hover({ position: { x: 80, y: 40 } });
  await expect(page.getByRole('tooltip')).toBeHidden();
  const measurements = [];
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1366, height: 768 }]) {
    await page.setViewportSize(viewport);
    for (const dark of [false, true]) {
      const theme = page.getByRole('checkbox', { name: 'Toggle dark mode', exact: true });
      if (await theme.isChecked() !== dark) { await theme.focus(); await theme.press('Space'); }
      if (dark) await expect(theme).toBeChecked(); else await expect(theme).not.toBeChecked();
      await expect(page.locator('html')).not.toHaveClass(/dark-mode-transition/);
      const geometry = await editorGeometry(source(page));
      measurements.push({ viewport, dark, source: geometry });
      await page.screenshot({ path: testInfo.outputPath(`workspace-${viewport.width}-${dark ? 'dark' : 'light'}.png`), fullPage: true });
      await writeFile(testInfo.outputPath('workspace-measurements.json'), JSON.stringify(measurements, null, 2));
      await testInfo.attach('workspace-measurements', { body: JSON.stringify(measurements, null, 2), contentType: 'application/json' });
      expect(geometry.visibleRows, JSON.stringify(geometry)).toBeGreaterThanOrEqual(10);
      expect(geometry.fontSize).toBeGreaterThanOrEqual(17);
      await usableControl(source(page).getByRole('button', { name: 'Accept', exact: true }));
      await usableControl(terminal(page).getByRole('button', { name: 'Evaluate', exact: true }));
      await expect(terminal(page).getByRole('region', { name: 'Evaluation result', exact: true })).toBeInViewport({ ratio: 1 });
      const expression = await editorGeometry(terminal(page).getByRole('region', { name: 'Smalltalk expression', exact: true }));
      expect(expression.visibleRows).toBeGreaterThanOrEqual(2);
      expect(expression.fontSize).toBeGreaterThanOrEqual(17);
    }
  }
});

test('narrow and zoom-equivalent layouts keep source and terminal reachable in document flow', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await ready(page);
  // At 200% zoom, a 1280×720 viewport provides 640×360 CSS pixels.
  // Source and terminal may appear sequentially; neither may become trapped.
  for (const viewport of [{ width: 640, height: 360 }, { width: 320, height: 900 }]) {
    await page.setViewportSize(viewport);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await typeSource(page, 'Smalltalk method source', 'increment\n  count := count + 2.\n  ^ self');
    const accept = source(page).getByRole('button', { name: 'Accept', exact: true });
    await accept.scrollIntoViewIfNeeded();
    await usableControl(accept);
    await expect(accept).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath(`source-reflow-${viewport.width}.png`), fullPage: true });
    await evaluate(page, '6 * 7', '42');
    await usableControl(terminal(page).getByRole('button', { name: 'Evaluate', exact: true }));
    await terminal(page).getByRole('region', { name: 'Evaluation result', exact: true }).scrollIntoViewIfNeeded();
    const resultText = terminal(page).getByRole('region', { name: 'Evaluation result', exact: true }).getByText('42', { exact: true });
    // Fractional document scrolling may round an edge by less than a CSS pixel.
    // Check the actual result text, not the containing section's padding.
    const resultRect = await resultText.boundingBox();
    expect(resultRect.y).toBeGreaterThanOrEqual(-1);
    expect(resultRect.y + resultRect.height).toBeLessThanOrEqual(viewport.height + 1);
    await expect(resultText).toBeInViewport();
    await expect(source(page)).toContainText('count + 2');
    await page.screenshot({ path: testInfo.outputPath(`terminal-reflow-${viewport.width}.png`), fullPage: true });
  }
});

test('keyboard dock and source focus controls preserve drafts and the live counter', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await ready(page);
  await evaluate(page, 'counter := SEBookCounter new. counter increment; value', '1');
  const draft = await typeSource(page, 'Smalltalk method source', 'increment\n  count := count + 2.\n  ^ self');
  const dock = page.getByRole('region', { name: 'Output and live terminal', exact: true });
  await expect(dock).toBeVisible();
  await pressButton(page, 'Collapse output and terminal');
  await expect(page.getByRole('button', { name: 'Show output and terminal', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await expect(terminal(page).getByRole('textbox', { name: /^Smalltalk expression/ })).toBeHidden();
  await usableControl(page.getByRole('button', { name: 'Run', exact: true }));
  await pressButton(page, 'Show output and terminal');
  await expect(page.getByRole('button', { name: 'Collapse output and terminal', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await expect(terminal(page).getByRole('region', { name: 'Evaluation result', exact: true })).toHaveText('1');
  await pressButton(page, 'Expand output and terminal');
  await expect(page.getByRole('button', { name: 'Restore output and terminal size', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await pressButton(page, 'Restore output and terminal size');
  await pressButton(page, 'Focus source editor');
  await expect(page.getByRole('button', { name: 'Restore layout', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('listbox', { name: 'Methods', exact: true })).toBeHidden();
  await expect(terminal(page).getByRole('textbox', { name: /^Smalltalk expression/ })).toBeHidden();
  expect((await editorGeometry(source(page))).visibleRows).toBeGreaterThanOrEqual(20);
  await expect(source(page)).toContainText('count + 2');
  await usableControl(source(page).getByRole('button', { name: 'Accept', exact: true }));
  await page.screenshot({ path: testInfo.outputPath('source-focus.png'), fullPage: true });
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('heading', { name: 'Live Objects and Independent Checks', exact: true })).toBeVisible();
  await expect(source(page).locator('.smalltalk-source-preview')).toBeVisible();
  await expect(source(page).locator('.smalltalk-source-preview')).toContainText('count + 2');
  await expect(terminal(page).getByRole('region', { name: 'Evaluation result', exact: true })).toBeVisible();
  await expect(terminal(page).getByRole('region', { name: 'Evaluation result', exact: true })).toHaveText('1');
  await page.emulateMedia({ media: 'screen' });
  await pressButton(page, 'Restore layout');
  await expect(page.getByRole('button', { name: 'Focus source editor', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'Collapse output and terminal', exact: true })).toHaveAttribute('aria-expanded', 'true');
  // A dock opened directly from focus mode must respond on the first activation.
  await pressButton(page, 'Focus source editor');
  await pressButton(page, 'Show output and terminal');
  await expect(page.getByRole('button', { name: 'Focus source editor', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(terminal(page).getByRole('textbox', { name: /^Smalltalk expression/ })).toBeVisible();
  await expect(terminal(page).getByRole('region', { name: 'Evaluation result', exact: true })).toHaveText('1');
  await pressButton(page, 'Collapse output and terminal');
  await pressButton(page, 'Focus source editor');
  await pressButton(page, 'Restore layout');
  await expect(page.getByRole('button', { name: 'Show output and terminal', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await pressButton(page, 'Show output and terminal');
  await expect(source(page)).toContainText('count + 2');
  await expect(source(page).getByRole('button', { name: 'Accept', exact: true })).toBeEnabled();
  await expectEditorValue(page, 'Smalltalk method source', draft);
  await expectEditorValue(page, 'Smalltalk expression', 'counter := SEBookCounter new. counter increment; value');
  const history = terminal(page).getByText('History and Transcript', { exact: true });
  await history.click();
  await expect(terminal(page).getByRole('region', { name: 'Submitted commands and native output', exact: true })).toContainText('counter := SEBookCounter new. counter increment; value');
  await history.click();
  // The unaccepted draft remains excluded; the same retained object advances.
  await evaluate(page, 'counter increment; value', '2');
  await pressButton(page, 'Accept');
  await expect(page.getByRole('status', { name: 'Compilation status', exact: true })).toContainText('Accepted.', { timeout: 30000 });
  await evaluate(page, 'counter increment; value', '4');
});

test('compact Browser disclosures support native search, queries and source-view return', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await ready(page);
  const browser = page.getByRole('region', { name: 'Smalltalk System Browser', exact: true });
  const packages = browser.getByRole('region', { name: 'Packages', exact: true });
  await packages.getByLabel('Search packages', { exact: true }).filter({ visible: true }).click();
  await packages.getByRole('searchbox', { name: 'Search packages', exact: true }).fill('SEBook-Smalltalk');
  await packages.getByRole('button', { name: 'Search', exact: true }).click();
  const packageList = packages.getByRole('listbox', { name: 'Packages', exact: true });
  await expect(packageList.getByRole('option', { name: 'SEBook-Smalltalk', exact: true })).toBeAttached({ timeout: 30000 });
  await expect.poll(async () => {
    const labels = await packageList.getByRole('option').allTextContents();
    return labels.length > 0 && labels.every(label => label.includes('SEBook-Smalltalk'));
  }, { timeout: 30000 }).toBe(true);
  await packageList.selectOption({ label: 'SEBook-Smalltalk' });
  await browser.getByRole('listbox', { name: 'Classes', exact: true }).selectOption({ label: 'SEBookCounter' });
  await browser.getByRole('listbox', { name: 'Protocols', exact: true }).selectOption({ label: 'counting' });
  await browser.getByRole('listbox', { name: 'Methods', exact: true }).selectOption({ label: 'increment' });
  await expect(source(page)).not.toHaveAttribute('aria-busy', 'true', { timeout: 30000 });
  await expect(source(page)).toContainText('count + 1');
  const draft = await typeSource(page, 'Smalltalk method source', 'increment\n  count := count + 2.\n  ^ self');
  await browser.getByText('Browser tools', { exact: true }).click();
  await pressButton(page, 'Implementors');
  const results = browser.getByRole('region', { name: 'Native query results', exact: true });
  await expect(results.getByRole('status', { name: 'Query status', exact: true })).toContainText('results on this page', { timeout: 30000 });
  await expect(results).toContainText('SEBookCounter');
  await pressButton(page, 'Close query results');
  await expect(results).toBeHidden();
  const focusIsVisible = await browser.evaluate(region => {
    const active = document.activeElement;
    const rect = active.getBoundingClientRect();
    return region.contains(active) && rect.width > 0 && rect.height > 0 &&
      getComputedStyle(active).visibility === 'visible' &&
      active.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
  });
  expect(focusIsVisible).toBe(true);
  await browser.getByText('Browser tools', { exact: true }).click();
  await browser.getByText('More browsing queries', { exact: true }).click();
  await pressButton(page, 'Source views');
  await expect(browser.getByRole('region', { name: 'Browser source views', exact: true })).toBeVisible();
  await pressButton(page, 'Browse image');
  await expect(source(page)).toBeVisible();
  await expectEditorValue(page, 'Smalltalk method source', draft);
  await expect(source(page).getByRole('button', { name: 'Accept', exact: true })).toBeEnabled();

  const tools = browser.getByText('Browser tools', { exact: true });
  // Package dialogs outlive their disclosure; both dismissal paths must return
  // keyboard focus to the visible summary, rather than a hidden Create button.
  if (!await browser.getByRole('button', { name: 'Create package', exact: true }).isVisible()) await tools.click();
  await pressButton(page, 'Create package');
  await tools.click();
  await pressButton(page, 'Cancel package creation');
  await expect(tools).toBeFocused();
  await expect(tools).toBeVisible();
  await tools.click();
  await pressButton(page, 'Create package');
  await browser.getByRole('textbox', { name: 'New package name', exact: true }).fill('SEBook-Layout-Journey');
  await tools.click();
  await pressButton(page, 'Save package');
  await expect(browser.getByRole('status', { name: 'Compilation status', exact: true })).toHaveText('Package created.', { timeout: 30000 });
  await expect(tools).toBeFocused();
  await expect(tools).toBeVisible();
  await expect(packageList.getByRole('option', { name: 'SEBook-Layout-Journey', exact: true })).toBeAttached();
});
