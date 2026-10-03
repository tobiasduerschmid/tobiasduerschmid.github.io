const { test, expect: standardExpect } = require('@playwright/test');
const expect = standardExpect.configure({ timeout: 30000 });
const { mountSmalltalkFixture } = require('./helpers/smalltalk-runtime');
const { a11yCheckpoint } = require('./a11y-helpers');
test.setTimeout(180000);
const program = { version: 1, stepKey: 'inspector', revision: 0, files: [{ path: '/counter.st', kind: 'source', format: 'filein', content: "Object subclass: #SEBookCounter instanceVariableNames: 'saved' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Tests'!\n!SEBookCounter methodsFor: 'accessing'!\nvalue ^ 1!\nsaved: value saved := value!\nsaved ^ saved! !" }], changes: { version: 1, source: '', entries: [] }, runCommand: null };
async function replaceSource(page, input, source) {
  await input.focus(); await input.press('Control+Home'); await input.press('Control+Shift+End');
  await expect.poll(() => input.evaluate(node => node.selectionStart === 0 && node.selectionEnd === node.value.length), { message: 'Monaco selects the complete source before replacement' }).toBe(true);
  await input.press('Backspace'); await expect(input).toHaveValue('');
  await page.keyboard.insertText(source);
  await expect(input).toHaveValue(source);
}
async function evaluate(page, source, value) {
  const expression = page.getByRole('textbox', { name: /Smalltalk expression/ });
  await replaceSource(page, expression, source);
  const evaluate = page.getByRole('button', { name: 'Evaluate', exact: true });
  await evaluate.click(); await expect(evaluate).toBeEnabled();
  // Regex matching preserves the submitted-line boundary; string locators normalize whitespace.
  const quotedSource = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await expect(page.getByRole('region', { name: 'Submitted commands and native output', exact: true })).toContainText(new RegExp('^> ' + quotedSource + '\\n', 'm'));
  await expect(page.getByRole('region', { name: 'Evaluation result', exact: true })).toHaveText(value);
  await expect(page.getByRole('button', { name: 'Evaluate', exact: true })).toBeFocused();
}
test('live edits preserve the inspected instance', async ({ page }) => {
  const cleanup = await mountSmalltalkFixture(page, { program });
  try {
    await evaluate(page, 'counter := SEBookCounter new. counter saved: 73. counter', 'a SEBookCounter');
    await page.getByRole('button', { name: 'Inspect result', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Result object', exact: true })).toContainText('73');
    await page.getByLabel('Search packages', { exact: true }).fill('SEBook-Tests');
    await page.getByRole('region', { name: 'Packages', exact: true }).getByRole('button', { name: 'Search', exact: true }).click();
    await page.getByRole('listbox', { name: 'Packages', exact: true }).selectOption({ label: 'SEBook-Tests' });
    await page.getByRole('listbox', { name: 'Classes', exact: true }).selectOption({ label: 'SEBookCounter' });
    await page.getByRole('listbox', { name: 'Protocols', exact: true }).selectOption({ label: 'accessing' });
    await page.getByRole('listbox', { name: 'Methods', exact: true }).selectOption({ label: 'value' });
    await expect(page.getByRole('region', { name: 'Method source', exact: true })).toContainText('value ^ 1');
    const source = page.getByRole('textbox', { name: /Smalltalk method source/ });
    await replaceSource(page, source, 'value ^ 2');
    await page.getByRole('button', { name: 'Accept', exact: true }).click();
    await expect(page.getByRole('status', { name: 'Compilation status' })).toContainText('Accepted.');
    await evaluate(page, 'counter value', '2');
    await evaluate(page, 'counter saved', '73');
    await a11yCheckpoint(page, 'retained-object', { feature: 'smalltalk-inspector' });
  } finally { await cleanup(); }
});
test('terminal retains variables, recalls commands and marks cyclic inspections stale on restart', async ({ page }) => {
  const cleanup = await mountSmalltalkFixture(page, { program, views: ['inspector'] });
  try {
    await evaluate(page, 'box := Array with: 7 with: nil. box at: 2 put: box. box', 'a Array');
    await page.getByRole('button', { name: 'Inspect result', exact: true }).click();
    await page.getByRole('region', { name: 'Result object', exact: true }).getByRole('button', { name: 'Expand 2', exact: true }).click();
    await expect(page.getByRole('region', { name: '2 object', exact: true })).toContainText('7');
    await evaluate(page, "Transcript show: 'hello'; cr. box first + 1", '8');
    await expect(page.getByRole('region', { name: 'Transcript', exact: true })).toContainText('hello');
    await page.getByRole('button', { name: 'Previous command', exact: true }).click();
    await page.getByRole('button', { name: 'Evaluate', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Evaluate', exact: true })).toBeEnabled();
    await expect(page.getByRole('region', { name: 'Evaluation result', exact: true })).toHaveText('8');
    const restart = page.getByRole('button', { name: 'Restart session', exact: true });
    await restart.focus(); await restart.press('Enter');
    await expect(page.getByRole('status', { name: 'Live session status', exact: true })).toContainText('Live bindings and objects were cleared');
    await expect(page.getByRole('region', { name: 'Result object', exact: true })).toContainText('Stale object');
    await expect(restart).toBeFocused();
    await expect(page.getByRole('region', { name: 'Result object', exact: true }).getByRole('button', { name: 'Expand 2', exact: true })).toBeDisabled();
    await evaluate(page, 'box', 'nil');
    await evaluate(page, '6 * 7', '42');
    await a11yCheckpoint(page, 'inspector-restart', { feature: 'smalltalk-inspector' });
  } finally { await cleanup(); }
});

test('Stop interrupts a requested hostile printString and resets inspector handles', async ({ page }) => {
  const hostile = { ...program, files: [...program.files, { path: '/hostile.st', kind: 'source', format: 'filein', content: "Object subclass: #SEBookHostile instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Tests'!\n!SEBookHostile methodsFor: 'printing'!\nprintString Transcript show: 'native hostile print entered'; cr. [true] whileTrue! !" }] };
  const cleanup = await mountSmalltalkFixture(page, { program: hostile, views: ['inspector'] });
  try {
    await evaluate(page, 'object := SEBookHostile new. object', 'a SEBookHostile');
    const transcript = page.getByRole('region', { name: 'Transcript output', exact: true });
    await expect(transcript).not.toContainText('native hostile print entered');
    await page.getByRole('button', { name: 'Inspect result', exact: true }).click();
    const expression = page.getByRole('textbox', { name: /Smalltalk expression/ });
    await replaceSource(page, expression, 'object printString');
    await page.getByRole('button', { name: 'Evaluate', exact: true }).click();
    await expect(transcript).toContainText('native hostile print entered');
    const stop = page.getByRole('button', { name: 'Stop evaluation', exact: true });
    await stop.focus(); await stop.press('Enter');
    await expect(page.getByRole('status', { name: 'Live session status', exact: true })).toContainText('Session reset');
    await expect(page.getByRole('region', { name: 'Result object', exact: true })).toContainText('Stale object');
    await expect(page.getByRole('button', { name: 'Evaluate', exact: true })).toBeFocused();
    await expect(page.getByRole('region', { name: 'Result object', exact: true }).getByRole('button', { name: 'Next slots for Result', exact: true, includeHidden: true })).toBeDisabled();
    await evaluate(page, 'object', 'nil');
    await evaluate(page, '6 * 7', '42');
    await a11yCheckpoint(page, 'hostile-print-stopped', { feature: 'smalltalk-inspector' });
  } finally { await cleanup(); }
});

test('Inspector pages the 25 and 26 indexed-slot boundary with native values', async ({ page }) => {
  const cleanup = await mountSmalltalkFixture(page, { program, views: ['inspector'] });
  try {
    for (const size of [25, 26]) {
      await evaluate(page, `(1 to: ${size}) asArray`, 'a Array');
      await page.getByRole('button', { name: 'Inspect result', exact: true }).click();
      const panel = page.getByRole('region', { name: 'Result object', exact: true });
      await expect(panel.getByRole('term')).toHaveCount(25);
      await expect(panel.getByRole('definition').last().getByText('25', { exact: true })).toBeVisible();
      const next = panel.getByRole('button', { name: 'Next slots for Result', exact: true, includeHidden: true });
      if (size === 25) await expect(next).toBeHidden();
      else {
        await expect(next).toBeVisible(); await next.focus(); await next.press('Enter');
        await expect(panel.getByRole('term')).toHaveCount(26);
        await expect(panel.getByRole('term').last()).toHaveText('26');
        await expect(panel.getByRole('definition').last().getByText('26', { exact: true })).toBeVisible();
        await expect(next).toBeHidden();
        await expect(panel.getByRole('button', { name: 'Expand 26', exact: true })).toBeFocused();
        await a11yCheckpoint(page, 'inspector-next-slot-page', { feature: 'smalltalk-inspector' });
      }
      await panel.getByRole('button', { name: 'Close Result inspector', exact: true }).click();
    }
  } finally { await cleanup(); }
});
