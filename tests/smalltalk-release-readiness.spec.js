const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');
test.setTimeout(180000);

test('Smalltalk Run accessible name follows its visible label after Run and checks', async ({ page }) => {
  await page.goto('/SEBook/tools/smalltalk-tutorial');
  const run = page.getByRole('button', { name: /^(?:Run|Running…|Testing…|Checking…|Restarting…|Runtime unavailable)$/ });
  await expect(run).toBeEnabled({ timeout: 90000 });
  async function matchesVisibleLabel() {
    const visible = await run.evaluate(button => {
      const clone = button.cloneNode(true);
      clone.querySelectorAll('[aria-hidden="true"], .sr-only, .visually-hidden').forEach(node => node.remove());
      return clone.textContent.trim().replace(/\s+/g, ' ');
    });
    await expect.soft(run).toHaveAccessibleName(visible);
  }
  await matchesVisibleLabel();
  await run.click();
  await expect(page.getByRole('region', { name: 'Program output', exact: true })).toContainText(/Result: 1\s*$/, { timeout: 30000 });
  await expect(run).toBeEnabled();
  await matchesVisibleLabel();
  await page.getByRole('button', { name: /Test My Work/ }).click();
  await expect(run).toBeDisabled();
  await matchesVisibleLabel();
  await expect(page.getByRole('status').filter({ hasText: /(?:All 3|[0-3] of 3) tests passed/ })).toBeVisible({ timeout: 90000 });
  await expect(run).toBeEnabled();
  await matchesVisibleLabel();
});

test('mounted Smalltalk workspace retains terminal state through Run and remains accessible', async ({ page, browser }, testInfo) => {
  const timings = { browser: browser.version(), project: testInfo.project.name };
  const started = performance.now();
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('/SEBook/tools/smalltalk-tutorial');
  const run = page.getByRole('button', { name: 'Run', exact: true });
  const terminal = page.getByRole('region', { name: 'Smalltalk live terminal', exact: true });
  await expect(run).toBeEnabled({ timeout: 90000 });
  await expect(page.getByRole('region', { name: 'Smalltalk System Browser', exact: true })).toBeVisible();
  await expect(page.getByRole('listbox', { name: 'Methods', exact: true })).toBeEnabled();
  await expect(terminal.getByRole('button', { name: 'Evaluate', exact: true })).toBeEnabled();
  timings.navigationToReadyMs = Math.round(performance.now() - started);

  async function evaluate(source, expected) {
    const input = terminal.getByRole('textbox', { name: /^Smalltalk expression/ });
    await input.focus();
    // Monaco uses the emulated user-agent platform; ControlOrMeta instead uses
    // the test host, which can select only its textarea on a different platform.
    const selectAll = await page.evaluate(() => /Macintosh/.test(navigator.userAgent) ? 'Meta+A' : 'Control+A');
    await input.press(selectAll);
    await expect(input).toBeFocused();
    await page.keyboard.press('Backspace');
    await expect(input).toHaveValue('');
    await page.keyboard.insertText(source);
    await expect(input).toHaveValue(source);
    const began = performance.now();
    await terminal.getByRole('button', { name: 'Evaluate', exact: true }).click();
    await expect(terminal.getByRole('button', { name: 'Evaluate', exact: true })).toBeEnabled();
    await expect(terminal.getByRole('region', { name: 'Evaluation result', exact: true })).toHaveText(expected, { timeout: 30000 });
    await expect(terminal.getByRole('status', { name: 'Live session status', exact: true })).toContainText('Evaluation complete.');
    return Math.round(performance.now() - began);
  }
  timings.terminalEvaluationMs = await evaluate('releaseCounter := SEBookCounter new. releaseCounter increment; value', '1');
  const runStarted = performance.now();
  await run.click();
  await expect(page.getByRole('region', { name: 'Program output', exact: true })).toContainText(/Result: 1\s*$/, { timeout: 30000 });
  timings.warmRunMs = Math.round(performance.now() - runStarted);
  await evaluate('releaseCounter value + 1', '2');
  await a11yCheckpoint(page, 'smalltalk-mounted-light', { feature: 'smalltalk-release' });

  const theme = page.getByRole('checkbox', { name: 'Toggle dark mode', exact: true });
  await theme.focus(); await theme.press('Space');
  await expect(theme).toBeChecked();
  await expect(page.locator('html')).not.toHaveClass(/dark-mode-transition/);
  await page.setViewportSize({ width: 320, height: 1000 });
  await a11yCheckpoint(page, 'smalltalk-mounted-narrow-dark', { feature: 'smalltalk-release' });
  await page.emulateMedia({ media: 'print' });
  await a11yCheckpoint(page, 'smalltalk-mounted-print', { feature: 'smalltalk-release' });
  await testInfo.attach('smalltalk-release-observed-timings', {
    body: JSON.stringify(timings, null, 2), contentType: 'application/json',
  });
});
