const { test, expect: baseExpect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');
const features = require('./helpers/smalltalk-features');
const expect = baseExpect.configure({ timeout: 30000 });
test.setTimeout(180000);
const terminal = page => page.getByRole('region', { name: 'Smalltalk live terminal', exact: true });
async function ready(page) {
  await page.goto('/SEBook/tools/smalltalk-tutorial');
  await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled({ timeout: 120000 });
  await page.getByRole('listbox', { name: 'Methods', exact: true }).selectOption({ label: 'increment' });
}
async function edit(page, label, source) {
  const input = page.getByRole('textbox', { name: new RegExp('^' + label) });
  await input.focus(); await input.press('Control+Home'); await input.press('Control+Shift+End');
  await expect.poll(() => input.evaluate(node => node.selectionStart === 0 && node.selectionEnd === node.value.length), { message: 'Monaco selects the source before replacement' }).toBe(true);
  await page.keyboard.insertText(source);
}
async function evaluate(page, source, expected) {
  await edit(page, 'Smalltalk expression', source);
  await terminal(page).getByRole('button', { name: 'Evaluate', exact: true }).click();
  await expect(terminal(page).getByRole('region', { name: 'Evaluation result', exact: true })).toHaveText(expected);
}
async function detach(page) {
  await page.getByText('Browser tools', { exact: true }).click();
  const opened = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Detach System Browser', exact: true }).click();
  const popup = await opened;
  await expect(popup.getByRole('region', { name: 'Method source', exact: true })).toContainText('count + 1');
  return popup;
}
async function rename(page) {
  await page.getByRole('button', { name: 'Refactor', exact: true }).click();
  await page.getByLabel('Refactoring action', { exact: true }).selectOption('renameMethod');
  await page.getByLabel('New selector', { exact: true }).fill('advance');
  await page.getByRole('button', { name: 'Preview refactoring', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Apply refactoring', exact: true })).toBeEnabled({ timeout: 60000 });
  await page.getByRole('button', { name: 'Apply refactoring', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Native Smalltalk refactoring', exact: true })).toBeHidden({ timeout: 60000 });
}
test('a stale popup edit cannot overwrite a renamed method', async ({ page }) => {
  test.skip(!features.refactorings, 'Native refactorings are deferred by the production capability.');
  await ready(page); const popup = await detach(page);
  // The parent prepares while accepted source is still clean. The popup then types
  // against that revision before the parent's native change is applied.
  await page.getByRole('button', { name: 'Refactor', exact: true }).click();
  await page.getByLabel('Refactoring action', { exact: true }).selectOption('renameMethod');
  await page.getByLabel('New selector', { exact: true }).fill('advance');
  await page.getByRole('button', { name: 'Preview refactoring', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Apply refactoring', exact: true })).toBeEnabled({ timeout: 60000 });
  await edit(popup, 'Smalltalk method source', 'increment\n count := count + 99.\n ^ self');
  const retainedSource = await popup.getByRole('textbox', { name: /^Smalltalk method source/ }).inputValue();
  await page.getByRole('button', { name: 'Apply refactoring', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Native Smalltalk refactoring', exact: true })).toBeHidden({ timeout: 60000 });
  await popup.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(popup.getByRole('status', { name: 'Compilation status' })).toContainText('changed');
  await expect(popup.getByRole('region', { name: 'Method source', exact: true })).toContainText('count + 99');
  await expect(popup.getByRole('textbox', { name: /^Smalltalk method source/ })).toHaveValue(retainedSource);
  await evaluate(page, '(SEBookCounter includesSelector: #increment) not and: [(SEBookCounter new advance; value) = 1]', 'true');
  await evaluate(popup, 'SEBookCounter new advance; value', '1');
  await a11yCheckpoint(popup, 'stale-popup-draft', { feature: 'smalltalk-popout' });
  await popup.getByRole('button', { name: 'Revert', exact: true }).click();
  await expect(popup.getByRole('heading', { name: 'Class definition', exact: true })).toBeVisible();
  await expect(popup.getByRole('region', { name: 'Method source', exact: true })).toContainText('Accepted source');
  await expect(popup.getByRole('textbox', { name: /^Smalltalk method source/ })).not.toHaveValue(retainedSource);
});

test('popup drafts survive navigation, Accept updates both views, and Run retains the same live object', async ({ page, context }) => {
  const runtimeWorkers = [];
  context.on('page', created => created.on('worker', worker => { if (worker.url().startsWith('data:text/javascript')) runtimeWorkers.push(worker); }));
  page.on('worker', worker => { if (worker.url().startsWith('data:text/javascript')) runtimeWorkers.push(worker); });
  await ready(page);
  await evaluate(page, 'retained := SEBookCounter new. retained increment; value', '1');
  const popup = await detach(page);
  await edit(popup, 'Smalltalk method source', 'increment\n count := count + 2.\n ^ self');
  await popup.getByRole('listbox', { name: 'Methods', exact: true }).selectOption({ label: 'value' });
  await popup.getByRole('listbox', { name: 'Methods', exact: true }).selectOption({ label: 'increment' });
  await expect(popup.getByRole('region', { name: 'Method source', exact: true })).toContainText('count + 2');
  await popup.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(popup.getByRole('status', { name: 'Compilation status' })).toContainText('Accepted.');
  await expect(page.getByRole('region', { name: 'Method source', exact: true })).toContainText('count + 2');
  await evaluate(popup, 'retained increment; value', '3');
  await evaluate(page, 'retained value', '3');
  await popup.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(popup.getByRole('status').filter({ hasText: 'Run finished.' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Program output', exact: true })).toContainText(/Result: 2\s*$/);
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await evaluate(popup, 'retained value', '3');
  expect(runtimeWorkers).toHaveLength(1);
  await popup.setViewportSize({ width: 320, height: 900 });
  await a11yCheckpoint(popup, 'popup-narrow', { feature: 'smalltalk-popout' });
  await popup.screenshot({ path: '/private/tmp/task11-popup-light.png', fullPage: true });
  await page.getByRole('checkbox', { name: 'Toggle dark mode' }).focus();
  await page.getByRole('checkbox', { name: 'Toggle dark mode' }).press('Space');
  await expect(page.getByRole('checkbox', { name: 'Toggle dark mode' })).toBeChecked();
  // html.dark-mode is the documented site-wide theme contract.
  await expect(popup.locator('html')).toHaveClass(/dark-mode/);
  await popup.screenshot({ path: '/private/tmp/task11-popup-dark.png', fullPage: true });
  await popup.getByRole('button', { name: 'Close window', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Detach System Browser', exact: true })).toBeFocused();
});

test('native popup preview changes the accepted method seen by the parent', async ({ page }) => {
  test.skip(!features.refactorings, 'Native refactorings are deferred by the production capability.');
  await ready(page); const popup = await detach(page);
  await rename(popup);
  await expect(popup.getByRole('region', { name: 'Method source', exact: true })).toContainText('advance');
  await evaluate(page, 'SEBookCounter new advance; value', '1');
  await evaluate(popup, '(SEBookCounter includesSelector: #increment) not', 'true');
  await a11yCheckpoint(popup, 'native-popup-applied', { feature: 'smalltalk-popout' });
});

test('Source views detaches raw files as drafts and Accept file uses the owner controller', async ({ page }) => {
  await ready(page);
  await page.getByText('Browser tools', { exact: true }).click();
  await page.getByText('More browsing queries', { exact: true }).click();
  await page.getByRole('button', { name: 'Source views', exact: true }).click();
  await page.getByRole('button', { name: 'Counter.st', exact: true }).click();
  const opened = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Detach source file', exact: true }).click();
  const popup = await opened;
  const source = popup.getByRole('region', { name: 'Selected saved source', exact: true });
  await expect(source).toContainText('count + 1');
  const input = popup.getByRole('textbox', { name: /^Smalltalk file or saved draft source/ });
  await input.focus(); await input.press('ControlOrMeta+End'); await popup.keyboard.insertText('\n"A retained raw-file draft"');
  await expect(page.getByRole('region', { name: 'Selected saved source', exact: true })).toContainText('A retained raw-file draft');
  await evaluate(page, 'SEBookCounter new increment; value', '1');
  await popup.getByRole('button', { name: 'Accept file', exact: true }).click();
  await expect(popup.getByRole('status', { name: 'Source view status' })).toContainText('Accepted file.', { timeout: 60000 });
  await expect(page.getByRole('region', { name: 'Selected saved source', exact: true })).toContainText('Accepted file');
  await a11yCheckpoint(popup, 'raw-source-popup', { feature: 'smalltalk-popout' });
});

test('closing the owner during evaluation settles the popup and keeps its draft recoverable', async ({ page }) => {
  await ready(page); const popup = await detach(page);
  await edit(popup, 'Smalltalk method source', 'increment\n count := count + 7.\n ^ self');
  await edit(popup, 'Smalltalk expression', '[true] whileTrue');
  await terminal(popup).getByRole('button', { name: 'Evaluate', exact: true }).click();
  await expect(terminal(popup).getByRole('status', { name: 'Live session status' })).toContainText('Evaluating');
  await page.close();
  await expect(terminal(popup).getByRole('button', { name: 'Evaluate', exact: true })).toBeEnabled();
  await expect(terminal(popup).getByRole('status', { name: 'Live session status' })).toContainText('disconnected');
  await expect(popup.getByRole('region', { name: 'Method source', exact: true })).toContainText('count + 7');
});

test('closing a popup during native inspection releases its late slot handles and leaves the parent usable', async ({ page }) => {
  await ready(page); const popup = await detach(page);
  await evaluate(page, 'parentObject := SEBookCounter new. parentObject', 'a SEBookCounter');
  await evaluate(popup, 'box := Array with: SEBookCounter new. box', 'a Array');
  // Hold only delivery of the real native result, so closure is deterministic.
  // The facade and native handle table remain production code.
  await page.evaluate(() => {
    const workspace = window._tutorial._smalltalkAdapter.getWorkspace();
    const inspect = workspace.inspect.bind(workspace), release = workspace.releaseHandles.bind(workspace);
    const delivered = new Promise(resolve => { window.deliverPopupInspection = resolve; });
    window.popupInspectionStarted = new Promise(resolve => {
      workspace.inspect = async (...args) => {
        const result = await inspect(...args); window.popupInspectionHandles = result.slots.map(slot => slot.value.handle).filter(Boolean);
        resolve(); await delivered; workspace.inspect = inspect; return result;
      };
    });
    window.popupInspectionReleased = new Promise(resolve => {
      workspace.releaseHandles = async (handles, options) => {
        const result = await release(handles, options);
        if (window.popupInspectionHandles && window.popupInspectionHandles.every(handle => handles.includes(handle))) resolve();
        return result;
      };
    });
  });
  await popup.getByRole('button', { name: 'Inspect result', exact: true }).click();
  await page.evaluate(() => window.popupInspectionStarted);
  await popup.close();
  await page.evaluate(() => window.deliverPopupInspection());
  await page.evaluate(() => window.popupInspectionReleased);
  const releasedCodes = await page.evaluate(async () => {
    const workspace = window._tutorial._smalltalkAdapter.getWorkspace();
    return Promise.all(window.popupInspectionHandles.map(handle => workspace.inspect(handle, 0, 20).then(() => 'still-live', error => error.code)));
  });
  expect(releasedCodes).toEqual(['STALE_HANDLE']);
  await page.getByRole('button', { name: 'Inspect result', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Result object', exact: true })).toContainText('count');
  await evaluate(page, 'parentObject increment; value', '1');
});

for (const origin of ['parent', 'popup']) test(`${origin} Revert restores accepted source in both Browsers`, async ({ page }) => {
  await ready(page); const popup = await detach(page);
  const sender = origin === 'parent' ? page : popup;
  const receiver = origin === 'parent' ? popup : page;
  const accepted = await receiver.getByRole('textbox', { name: /^Smalltalk method source/ }).inputValue();
  await edit(sender, 'Smalltalk method source', 'increment\n count := count + 99.\n ^ self');
  await expect(receiver.getByRole('region', { name: 'Method source', exact: true })).toContainText('count + 99');
  await sender.getByRole('button', { name: 'Revert', exact: true }).click();
  for (const browser of [sender, receiver]) {
    await expect(browser.getByRole('textbox', { name: /^Smalltalk method source/ })).toHaveValue(accepted);
    await expect(browser.getByRole('region', { name: 'Method source', exact: true })).toContainText('Accepted source');
    await expect(browser.getByRole('button', { name: 'Accept', exact: true })).toBeDisabled();
    await expect(browser.getByRole('button', { name: 'Revert', exact: true })).toBeDisabled();
  }
});

test('a newer local edit survives accepted-source delivery after remote Revert', async ({ page }) => {
  await ready(page); const popup = await detach(page);
  await edit(popup, 'Smalltalk method source', 'increment\n count := count + 99.\n ^ self');
  await expect(page.getByRole('region', { name: 'Method source', exact: true })).toContainText('count + 99');
  // Delay only delivery of the real native source result after Revert.
  await page.evaluate(() => {
    const workspace = window._tutorial._smalltalkAdapter.getWorkspace();
    const browse = workspace.browse.bind(workspace);
    const delivery = new Promise(resolve => { window.deliverRevertedSource = resolve; });
    window.revertedSourceStarted = new Promise(resolve => {
      workspace.browse = async query => {
        if (query.kind !== 'source') return browse(query);
        workspace.browse = browse;
        const result = await browse(query); resolve(); await delivery; return result;
      };
    });
  });
  await popup.getByRole('button', { name: 'Revert', exact: true }).click();
  await page.evaluate(() => window.revertedSourceStarted);
  await edit(page, 'Smalltalk method source', 'increment\n count := count + 77.\n ^ self');
  const newer = await page.getByRole('textbox', { name: /^Smalltalk method source/ }).inputValue();
  await page.evaluate(() => window.deliverRevertedSource());
  await expect(popup.getByRole('region', { name: 'Method source', exact: true })).toContainText('count + 77');
  await expect(page.getByRole('textbox', { name: /^Smalltalk method source/ })).toHaveValue(newer);
  await expect(page.getByRole('region', { name: 'Method source', exact: true })).toContainText('Unaccepted draft');
  await expect(page.getByRole('button', { name: 'Accept', exact: true })).toBeEnabled();
});
