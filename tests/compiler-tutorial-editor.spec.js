const { test, expect } = require('@playwright/test');
const path = require('node:path');

const settings = { tokenRules: [{ name: 'NUMBER', pattern: '[0-9]+' }] };

async function openBridge(page) {
  await page.goto('about:blank');
  await page.setContent('<main><div id="rules"></div><div id="code"></div><label>Source program<textarea></textarea></label></main>');
  await page.addScriptTag({ path: path.join(__dirname, '../js/compiler-lab-view.js') });
  await page.addScriptTag({ path: path.join(__dirname, '../js/compiler-tutorial-editor.js') });
  // Monaco is an external collaborator. This port implements only its public
  // model value/subscription contract; the form and browser DOM are real.
  await page.evaluate(() => {
    window.makeModel = value => {
      const listeners = new Set();
      return {
        getValue: () => value,
        setValue: next => { value = next; [...listeners].forEach(listener => listener()); },
        isDisposed: () => false,
        onDidChangeContent: listener => {
          listeners.add(listener);
          return { dispose: () => listeners.delete(listener) };
        },
      };
    };
    window.rulesBridge = new window.CompilerTutorialEditor(document.querySelector('#rules'), document.querySelector('#code'));
  });
}

test('malformed saved settings report recovery guidance and a corrected model restores editing', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await openBridge(page);
  for (const malformed of [
    '{',
    JSON.stringify({ tokenRules: [null] }),
    JSON.stringify({ tokenRules: [], ast: { discardTokens: 'NUMBER' } }),
    JSON.stringify({ tokenRules: [], ast: { foldRules: { expr: ['left', 'right'] } } }),
    JSON.stringify({ tokenRules: [], ast: { foldRules: { expr: [] } } }),
  ]) {
    await page.evaluate(value => {
      window.model = window.makeModel(value);
      window.rulesBridge.activate(window.model);
    }, malformed);
    await expect(page.getByRole('alert')).toContainText('Reset Step');
    await expect(page.getByLabel('Token name 1', { exact: true })).toHaveCount(0);
    await page.evaluate(value => window.model.setValue(JSON.stringify(value)), settings);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByLabel('Token name 1', { exact: true })).toHaveValue('NUMBER');
    await page.getByLabel('Regular expression 1', { exact: true }).fill('[1-9][0-9]*');
    expect(await page.evaluate(() => JSON.parse(window.model.getValue()).tokenRules[0].pattern)).toBe('[1-9][0-9]*');
  }
  expect(errors).toEqual([]);
});

test('tokenizer edits preserve valid hidden compiler metadata without exposing extra controls', async ({ page }) => {
  await openBridge(page);
  const metadata = { startRule: 'expr', ast: { discardTokens: ['LPAREN'], inlineRules: ['factor'], foldRules: { expr: 'left' } } };
  await page.evaluate(value => {
    window.model = window.makeModel(JSON.stringify(value));
    window.rulesBridge.activate(window.model);
  }, { ...settings, ...metadata });
  await expect(page.getByText('AST construction settings', { exact: true })).toHaveCount(0);
  await page.getByLabel('Regular expression 1', { exact: true }).fill('[1-9][0-9]*');
  expect(await page.evaluate(() => {
    const value = JSON.parse(window.model.getValue());
    return { startRule: value.startRule, ast: value.ast };
  })).toEqual(metadata);
});

test('persistent source follows its current model in both directions and releases old subscriptions', async ({ page }) => {
  await openBridge(page);
  await page.evaluate(() => {
    window.first = window.makeModel('first');
    window.second = window.makeModel('second');
    window.sourceBridge = new window.CompilerTutorialSource(document.querySelector('textarea'));
    window.sourceBridge.activate(window.first);
  });
  const source = page.getByLabel('Source program', { exact: true });
  await expect(source).toHaveValue('first');
  await source.fill('edited');
  expect(await page.evaluate(() => window.first.getValue())).toBe('edited');
  await page.evaluate(() => window.first.setValue('reset'));
  await expect(source).toHaveValue('reset');
  await page.evaluate(() => {
    window.sourceBridge.activate(window.second);
    window.first.setValue('old update');
  });
  await expect(source).toHaveValue('second');
  await source.fill('current update');
  expect(await page.evaluate(() => [window.first.getValue(), window.second.getValue()])).toEqual(['old update', 'current update']);
  await page.evaluate(() => window.sourceBridge.destroy());
  await source.fill('after destruction');
  expect(await page.evaluate(() => window.second.getValue())).toBe('current update');
});
