const { test, expect } = require('@playwright/test');
const { waitForTutorialReady } = require('./tutorial-helpers');
const { a11yCheckpoint } = require('./a11y-helpers');

const LEARNER_COMMAND = 'echo learner-before-setup';
const SETUP_MARKERS = ['SETUP_HEREDOC_ONLY', 'setup-long-value-', 'git branch -D feature-sqrt', '__SIL_', 'setup-blocked-input'];

// xterm renders to canvas. Its public buffer API exposes the same terminal
// text, including scrollback, without depending on renderer DOM or pixels.
async function terminalText(page) {
  return page.evaluate(() => {
    const buffer = window._tutorial.term.buffer.active;
    return Array.from({ length: buffer.length }, (_, index) =>
      buffer.getLine(index).translateToString(true)).join('\n').trimEnd();
  });
}

async function command(page, text) {
  const input = page.getByRole('textbox', { name: 'Terminal input', exact: true });
  await input.focus();
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
  await expect.poll(() => terminalText(page), {
    message: `The interactive terminal returns to its prompt after ${text}`,
    timeout: 15_000,
  }).toMatch(new RegExp(`${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*tutorial:[^\\n]*[#\\$]$`));
}

test('step preparation stays out of terminal scrollback and learner command history', async ({ page }) => {
  test.setTimeout(120_000);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/SEBook/tools/git-advanced-tutorial?instructor-mode=true');
  await waitForTutorialReady(page, {
    readySelector: '.tvm-terminal-container',
    bootTimeout: 90_000,
  });
  await expect.poll(() => terminalText(page), { timeout: 15_000 }).toMatch(/tutorial:[^\n]*[#\$]$/);
  await command(page, LEARNER_COMMAND);

  await page.evaluate(markers => {
    const tutorial = window._tutorial;
    const rebase = tutorial.steps.find(step => step.title.startsWith('Rebase:'));
    // Exercise the real lesson's long multiline Git setup plus a heredoc.
    // This is authored input, not a replacement for the shell transport.
    rebase.setup_commands.push([
      "cat > /tutorial/setup-regression.txt <<'SETUP_HEREDOC_ONLY'",
      'setup-long-value-' + 'quoted \' value " and $literal; '.repeat(20),
      'SETUP_HEREDOC_ONLY',
      // Hold the actual guest shell until the browser releases a file gate.
      // This makes loading-state assertions independent of machine speed.
      'until [ -f /tutorial/setup-release ]; do :; done',
    ].join('\n'));
    window.__setupRenderedMarkers = new Set();
    window.__setupRenderObserver = tutorial.term.onRender(() => {
      const buffer = tutorial.term.buffer.active;
      const text = Array.from({ length: buffer.length }, (_, index) =>
        buffer.getLine(index).translateToString(true)).join('\n');
      markers.filter(marker => text.includes(marker)).forEach(marker =>
        window.__setupRenderedMarkers.add(marker));
    });
  }, SETUP_MARKERS);

  await page.getByRole('button', { name: /^Step 8: Rebase:/ }).click();
  const loading = page.getByRole('status').filter({ hasText: 'Preparing step' });
  const input = page.getByRole('textbox', { name: 'Terminal input', exact: true, includeHidden: true });
  await expect(loading).toBeVisible();
  await expect(input, 'The covered terminal cannot remain a visible input during setup').toBeHidden();
  await input.focus();
  await expect(input, 'The covered terminal cannot accept keyboard focus during setup').not.toBeFocused();
  await page.evaluate(() => {
    // Clipboard reads can finish after loading starts; a queued paste must
    // still be rejected at the real terminal input boundary.
    window._tutorial.term.paste('echo setup-blocked-input\r');
  });
  await a11yCheckpoint(page, 'Advanced Git while preparing a step', {
    feature: 'git-advanced-tutorial', include: '.tvm-terminal-panel',
  });
  await page.evaluate(() => window._tutorial.emulator.create_file('/setup-release', new Uint8Array()));
  await expect(loading).toBeHidden({ timeout: 30_000 });
  await expect(page.getByLabel(/^Live Git graph/).getByText('Add identity helper', { exact: true })).toBeVisible({ timeout: 15_000 });
  const renderedDuringSetup = await page.evaluate(() => {
    window.__setupRenderObserver.dispose();
    return Array.from(window.__setupRenderedMarkers);
  });
  expect(renderedDuringSetup, 'Background setup must never reach the rendered terminal').toEqual([]);
  for (const marker of SETUP_MARKERS) {
    expect(await terminalText(page), 'Background setup must not remain in scrollback').not.toContain(marker);
  }

  // Up must recall the learner's previous command before any other command
  // is entered; clearing all history would hide the bug but lose learner work.
  await page.getByRole('textbox', { name: 'Terminal input', exact: true }).focus();
  await page.keyboard.press('ArrowUp');
  await expect.poll(() => terminalText(page)).toMatch(/tutorial:[^\n]*[#\$] echo learner-before-setup$/);
  await page.keyboard.press('Enter');
  await expect.poll(() => terminalText(page)).toMatch(/learner-before-setup\ntutorial:[^\n]*[#\$]$/);

  await command(page, 'history');
  const history = await terminalText(page);
  expect(history, 'The learner command must survive background preparation').toContain(LEARNER_COMMAND);
  for (const marker of SETUP_MARKERS) {
    expect(history, 'Interactive history must contain no setup commands').not.toContain(marker);
  }
  await a11yCheckpoint(page, 'Advanced Git after background setup', {
    feature: 'git-advanced-tutorial', include: '.tvm-terminal-panel',
  });
  expect(pageErrors, 'Tutorial setup must finish without unhandled browser errors').toEqual([]);
});
