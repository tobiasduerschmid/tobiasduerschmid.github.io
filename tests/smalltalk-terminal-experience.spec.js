const { test, expect: standardExpect } = require('@playwright/test');
const { selectAllInMonaco } = require('./helpers/monaco-keyboard');
const { a11yCheckpoint } = require('./a11y-helpers');
const expect = standardExpect.configure({ timeout: 30000 });
test.setTimeout(180000);

const terminal = page => page.getByRole('region', { name: 'Smalltalk live terminal', exact: true });
const input = page => terminal(page).getByRole('textbox', { name: /^Smalltalk expression/ });
const result = page => terminal(page).getByRole('region', { name: 'Evaluation result', exact: true });

async function open(page) {
  await page.goto('/SEBook/tools/smalltalk-basics-tutorial#live-scorekeeper-v1');
  await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled({ timeout: 120000 });
}

async function type(page, text) {
  await input(page).focus();
  await selectAllInMonaco(input(page));
  await input(page).press('Backspace');
  // Firefox's synthetic multi-line insertText can duplicate the first line in
  // Monaco's hidden textarea. Type line breaks as real Enter key presses.
  const lines = text.split('\n');
  for (const [index, line] of lines.entries()) {
    if (index) await input(page).press('Enter');
    await page.keyboard.insertText(line);
  }
  await selectAllInMonaco(input(page));
  await expect(input(page)).toHaveValue(text);
  await input(page).press('ArrowRight');
}

async function evaluate(page, text, answer) {
  await type(page, text);
  await input(page).press('Control+Enter');
  await expect(result(page)).toHaveText(answer);
  await expect(terminal(page).getByRole('button', { name: 'Evaluate', exact: true })).toBeEnabled();
}

test('keyboard evaluation retains objects; history reuse edits without executing and preserves a pending draft', async ({ page }) => {
  await open(page);
  await evaluate(page, 'player := SEBookArcadeScore new. player win; value', '1');
  await expect(input(page)).toBeFocused();
  await evaluate(page, 'player win; value', '2');
  await type(page, 'player value + 40');
  await terminal(page).getByText('History and Transcript', { exact: true }).click();
  const history = terminal(page).getByRole('region', { name: 'Submitted commands and native output', exact: true });
  const entry = history.getByRole('article', { name: 'Command 2', exact: true });
  await expect(entry).toContainText('player win; value');
  await expect(entry).toContainText('Result');
  await entry.getByRole('button', { name: 'Reuse command 2', exact: true }).click();
  await expect(input(page)).toBeFocused();
  await selectAllInMonaco(input(page));
  await expect(input(page)).toHaveValue('player win; value');
  await terminal(page).getByRole('button', { name: 'Next command', exact: true }).click();
  await selectAllInMonaco(input(page));
  await expect(input(page)).toHaveValue('player value + 40');
  await input(page).press('Meta+Enter');
  await expect(result(page)).toHaveText('42');
  await terminal(page).getByRole('button', { name: 'Clear history', exact: true }).click();
  await expect(history.getByRole('article')).toHaveCount(0);
  await evaluate(page, 'player value', '2');
});

test('native errors keep the submitted code and explain periods without silently changing Smalltalk', async ({ page }, testInfo) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1366, height: 768 });
  await open(page);
  await type(page, 'player := SEBookArcadeScore new\nplayer win');
  await input(page).press('Control+Enter');
  await expect(result(page)).toContainText('MessageNotUnderstood');
  await expect(terminal(page).getByText(/If these are separate statements/)).toBeVisible();
  await expect(input(page)).toBeFocused();
  await selectAllInMonaco(input(page));
  await expect(input(page)).toHaveValue(/new\s+player win/);
  await terminal(page).getByText('History and Transcript', { exact: true }).click();
  const entry = terminal(page).getByRole('article', { name: 'Command 1', exact: true });
  await expect(entry).toContainText('Error');
  await expect(entry).toContainText('MessageNotUnderstood');
  await a11yCheckpoint(page, 'terminal-native-error', { feature: 'smalltalk-terminal' });
  await page.screenshot({ path: testInfo.outputPath('terminal-error-light.png'), fullPage: true });
  await evaluate(page, 'player := SEBookArcadeScore new.\nplayer win; value', '1');
  await expect(terminal(page).getByText(/If these are separate statements/)).toBeHidden();
  await expect(terminal(page).getByRole('article', { name: 'Command 2', exact: true })).toContainText('Result');
  const dark = page.getByRole('checkbox', { name: 'Toggle dark mode', exact: true });
  await dark.focus(); await dark.press('Space');
  await expect(page.locator('html')).not.toHaveClass(/dark-mode-transition/);
  await a11yCheckpoint(page, 'terminal-recovered-dark', { feature: 'smalltalk-terminal' });
  await page.screenshot({ path: testInfo.outputPath('terminal-history-dark.png'), fullPage: true });
  await page.setViewportSize({ width: 320, height: 900 });
  await input(page).focus();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await a11yCheckpoint(page, 'terminal-mobile', { feature: 'smalltalk-terminal' });
  expect(errors).toEqual([]);
});

test('Run output and terminal share the dock width without losing input, history or live state', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await open(page);
  await evaluate(page, 'player := SEBookArcadeScore new. player win; value', '1');
  await type(page, 'player value');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Program output', exact: true })).toContainText('Result: 1');
  await expect(page.getByRole('button', { name: 'Run output', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(terminal(page)).toBeHidden();
  await page.getByRole('button', { name: 'Live terminal', exact: true }).click();
  await expect(terminal(page)).toBeVisible();
  await expect(result(page)).toHaveText('1');
  await input(page).focus(); await selectAllInMonaco(input(page));
  await expect(input(page)).toHaveValue('player value');
  await input(page).press('Control+Enter');
  await expect(result(page)).toHaveText('1');
  const dock = await page.getByRole('region', { name: 'Output and live terminal', exact: true }).boundingBox();
  const bounds = await terminal(page).boundingBox();
  expect(bounds.width).toBeGreaterThan(dock.width * 0.95);
  await expect(terminal(page).getByRole('button', { name: 'Evaluate', exact: true })).toBeInViewport({ ratio: 1 });
  await a11yCheckpoint(page, 'terminal-dock', { feature: 'smalltalk-terminal' });
  // Printing preserves both sets of results, including the inactive dock view.
  await page.emulateMedia({ media: 'print' });
  await expect(result(page)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Program output', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Program output', exact: true })).toContainText('Result: 1');
});
