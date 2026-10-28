// @ts-check
const { test: base, expect } = require('@playwright/test');
const { loadTutorialConfig } = require('./tutorial-helpers');
const { a11yCheckpoint } = require('./a11y-helpers');

const tutorial = loadTutorialConfig('python-debugging');
const tour = tutorial.steps[1].files.find(file => file.path === 'tour.py').content;
const additionLine = tour.split('\n').findIndex(line => line.includes('total += score')) + 1;
const TIMEOUT = 60_000;

// Real tutorial/controller and detached shared renderer. Selecting the lesson
// is fixture setup; all actions under test use the public browser controls.
// The separate python-debugging-keyboard suite checks complete Tab navigation.
const test = base.extend({
  debuggerPages: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/SEBook/tools/python-debugging?instructor-mode=true&autosave=false');
    await expect(page.getByRole('button', { name: 'Start debugger', exact: true }))
      .toBeEnabled({ timeout: TIMEOUT });
    await expect(page.locator('.tvm-loading')).toBeHidden({ timeout: TIMEOUT });
    await page.evaluate(async () => { await window._tutorial.loadStep(1); });
    await expect(page.getByRole('button', { name: 'tour.py', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /\bDebug$/ }).press('Enter');
    const popupPromise = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Open debugger in a separate window', exact: true }).press('Enter');
    const popup = await popupPromise;
    popup.on('pageerror', error => errors.push(error.message));
    await expect(popup.getByRole('combobox', { name: 'Breakpoint file', exact: true })).toBeVisible();
    // Python supplies a default uncaught-exception breakpoint. Start these
    // focused add/edit checks with an empty manager through its public control.
    await popup.getByRole('button', { name: 'Remove exception breakpoint', exact: true }).press('Enter');
    await expect(popup.getByRole('textbox', { name: 'Exception type filter', exact: true })).toHaveCount(0);
    await use({ page, popup });
    expect(errors, 'main and detached debugger stay free of JavaScript errors').toEqual([]);
  },
});
test.setTimeout(120_000);

async function addBreakpoint(popup, line = additionLine) {
  await popup.getByRole('combobox', { name: 'Breakpoint file', exact: true }).selectOption('tour.py');
  await popup.getByRole('spinbutton', { name: 'Breakpoint line', exact: true }).fill(String(line));
  await popup.getByRole('button', { name: 'Add breakpoint', exact: true }).press('Enter');
  await expect(popup.getByRole('button', { name: 'Edit condition', exact: true })).toHaveCount(1);
}

async function pauseAtAddition(page, popup) {
  await addBreakpoint(popup);
  await page.getByRole('button', { name: 'Start debugger', exact: true }).press('Enter');
  const proceed = popup.getByRole('button', { name: 'Continue', exact: true });
  await expect(proceed).toBeEnabled({ timeout: TIMEOUT });
  await proceed.press('Enter');
  await expect(popup.getByText(`paused at breakpoint at tour.py:${additionLine}`, { exact: true }))
    .toBeVisible({ timeout: TIMEOUT });
}

test('detached breakpoint entry is idempotent and retains drafts across controller updates', async ({ debuggerPages }) => {
  const { page, popup } = debuggerPages;
  await addBreakpoint(popup);
  await expect(page.getByRole('button', { name: 'Edit condition', exact: true })).toHaveCount(1);
  await popup.getByRole('button', { name: 'Add breakpoint', exact: true }).press('Enter');
  await expect(popup.getByRole('button', { name: 'Edit condition', exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Edit condition', exact: true })).toHaveCount(1);

  const line = popup.getByRole('spinbutton', { name: 'Breakpoint line', exact: true });
  await line.fill(String(additionLine + 1));
  await popup.getByRole('button', { name: 'Add Exception Breakpoint', exact: true }).press('Enter');
  await expect(popup.getByRole('textbox', { name: 'Exception type filter', exact: true })).toBeVisible();
  // The subsequent controller update has arrived, so a duplicate add that
  // incorrectly toggled the existing breakpoint off cannot pass on stale UI.
  await expect(popup.getByRole('button', { name: 'Edit condition', exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Edit condition', exact: true })).toHaveCount(1);
  await expect(line).toHaveValue(String(additionLine + 1));
  await expect(popup.getByRole('combobox', { name: 'Breakpoint file', exact: true })).toHaveValue('tour.py');
  await expect(popup.getByRole('button', { name: 'Add Exception Breakpoint', exact: true })).toBeFocused();
});

test('detached exception filters survive editing, mode selection, and normal Tab navigation', async ({ debuggerPages }) => {
  const { page, popup } = debuggerPages;
  await popup.getByRole('button', { name: 'Add Exception Breakpoint', exact: true }).press('Enter');
  const filter = popup.getByRole('textbox', { name: 'Exception type filter', exact: true });
  const mainFilter = page.getByRole('textbox', { name: 'Exception type filter', exact: true });
  await expect(filter).toHaveValue('');
  await expect(mainFilter).toHaveValue('');
  await filter.fill('ValueError');
  await filter.press('Enter');
  await expect(mainFilter).toHaveValue('ValueError');
  await expect(filter).toHaveValue('ValueError');

  // Moving on with an unsaved edit commits it without resetting the browser's
  // native Tab destination when the controller redraws the manager.
  await filter.fill('TypeError');
  await popup.keyboard.press('Tab');
  await expect(popup.getByRole('radio', { name: 'Uncaught', exact: true })).toBeFocused();
  await expect(mainFilter).toHaveValue('TypeError');
  await popup.keyboard.press('ArrowRight');
  await expect(popup.getByRole('radio', { name: 'All raised', exact: true })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'All raised', exact: true })).toBeChecked();
  await expect(filter).toHaveValue('TypeError');
  await expect(mainFilter).toHaveValue('TypeError');
  await a11yCheckpoint(popup, 'detached exception filter edited', { feature: 'debugger-controls' });
});

test('detached watchpoint dialog contains Tab and honors Enter on Cancel and Delete', async ({ debuggerPages }) => {
  const { page, popup } = debuggerPages;
  const expression = popup.getByRole('textbox', { name: 'Data watchpoint expression', exact: true });
  await expression.fill('total');
  await expression.press('Enter');
  const remove = popup.getByRole('button', { name: 'Remove data watchpoint', exact: true });
  await expect(remove).toHaveCount(1);
  await remove.press('Enter');
  const dialog = popup.getByRole('dialog', { name: 'Remove Data Watchpoint', exact: true });
  const cancel = dialog.getByRole('button', { name: 'Cancel', exact: true });
  const keep = dialog.getByRole('button', { name: 'Turn into Watch', exact: true });
  const remember = dialog.getByRole('checkbox', { name: "Don't ask again", exact: true });
  await expect(cancel).toBeFocused();
  await popup.keyboard.press('Shift+Tab');
  await expect(remember).toBeFocused();
  await popup.keyboard.press('Shift+Tab');
  await expect(keep).toBeFocused();
  await popup.keyboard.press('Tab');
  await expect(remember).toBeFocused();
  await popup.keyboard.press('Tab');
  await expect(cancel).toBeFocused();
  await a11yCheckpoint(popup, 'detached watchpoint confirmation', { feature: 'debugger-controls' });
  await popup.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  await expect(remove).toHaveCount(1);
  await expect(remove).toBeFocused();

  // A removed control needs a visible destination even when the usual
  // breakpoint-entry fallback is inside a collapsed group.
  const codeGroup = popup.getByRole('button', { name: 'Code Breakpoints', exact: true });
  await codeGroup.press('Enter');
  await expect(codeGroup).toHaveAttribute('aria-expanded', 'false');
  await remove.press('Enter');
  await expect(cancel).toBeFocused();
  await popup.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Delete', exact: true })).toBeFocused();
  await popup.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  await expect(remove).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Remove data watchpoint', exact: true })).toHaveCount(0);
  const managerFocus = popup.getByRole('region', { name: 'Breakpoints', exact: true }).locator(':focus');
  await expect(managerFocus).toBeVisible();
  await expect(managerFocus).toBeEnabled();
  await expect(popup.getByRole('region', { name: 'Watch', exact: true }))
    .toContainText('Watches are evaluated on every step.');
});

test('detached stack selection retains focus and execution updates preserve an unsent watch', async ({ debuggerPages }) => {
  const { page, popup } = debuggerPages;
  await pauseAtAddition(page, popup);
  const caller = popup.getByRole('button', { name: /^main\s*tour\.py:/ });
  await caller.press('Enter');
  await expect(caller).toBeFocused();
  await expect(caller).toHaveAttribute('aria-pressed', 'true');
  const callee = popup.getByRole('button', { name: /^process_scores\s*tour\.py:/ });
  await callee.press('Enter');
  await expect(callee).toBeFocused();
  await expect(callee).toHaveAttribute('aria-pressed', 'true');

  const watch = popup.getByRole('textbox', { name: 'Watch expression', exact: true });
  await watch.fill('total + score');
  await popup.getByRole('button', { name: 'Step Over', exact: true }).press('Enter');
  await expect(popup.getByRole('button', { name: 'Edit total: 8', exact: true })).toBeVisible({ timeout: TIMEOUT });
  await expect(watch).toHaveValue('total + score');
  await watch.press('Enter');
  await expect(watch).toHaveValue('');
  await expect(watch).toBeFocused();
  await expect(popup.getByRole('region', { name: 'Watch', exact: true })).toContainText('total + score');
});

test('detached variable editing labels its input and restores focus after Cancel and Enter', async ({ debuggerPages }) => {
  const { page, popup } = debuggerPages;
  await pauseAtAddition(page, popup);
  const original = popup.getByRole('button', { name: 'Edit total: 0', exact: true });
  await original.press('Enter');
  const input = popup.getByRole('textbox', { name: 'New value for total', exact: true });
  await expect(input).toBeFocused();
  await input.fill('4');
  await input.press('Escape');
  await expect(original).toBeFocused();
  await expect(input).toHaveCount(0);

  await popup.keyboard.press('Enter');
  await expect(input).toBeFocused();
  await input.fill('4');
  await input.press('Enter');
  const changed = popup.getByRole('button', { name: 'Edit total: 4', exact: true });
  await expect(changed).toBeVisible({ timeout: TIMEOUT });
  await expect(changed).toBeFocused();
  const inlineValue = page.getByRole('button', { name: 'Edit total: 4', exact: true });
  await expect(inlineValue).toBeVisible();

  // The inline Python renderer also replays local edits; verify its distinct
  // integration retains focus and publishes the confirmed value to the popout.
  await inlineValue.press('Enter');
  const inlineInput = page.getByRole('textbox', { name: 'New value for total', exact: true });
  await expect(inlineInput).toBeFocused();
  await inlineInput.fill('7');
  await inlineInput.press('Enter');
  const inlineChanged = page.getByRole('button', { name: 'Edit total: 7', exact: true });
  await expect(inlineChanged).toBeVisible({ timeout: TIMEOUT });
  await expect(inlineChanged).toBeFocused();
  await expect(popup.getByRole('button', { name: 'Edit total: 7', exact: true })).toBeVisible();
});
