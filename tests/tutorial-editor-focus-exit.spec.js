// @ts-check
const { test, expect } = require('@playwright/test');
const { waitForTutorialReady } = require('./tutorial-helpers');

test('Escape leaves the tutorial code editor without changing the code', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/SEBook/designpatterns/observer-tutorial.html');
  await waitForTutorialReady(page, { bootTimeout: 90_000 });

  const editor = page.locator('.tvm-editor-container .monaco-editor textarea.inputarea').first();
  await expect(editor).toBeVisible();
  const initialCode = await page.evaluate(() => window._tutorial.editor.getValue());

  await editor.focus();
  await expect(editor).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(editor).not.toBeFocused();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.closest('.monaco-editor'))).toBeNull();
  expect(await page.evaluate(() => window._tutorial.editor.getValue())).toBe(initialCode);
});

test('Escape dismisses Monaco find before leaving the editor', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/SEBook/designpatterns/observer-tutorial.html');
  await waitForTutorialReady(page, { bootTimeout: 90_000 });

  const editor = page.locator('.tvm-editor-container .monaco-editor textarea.inputarea').first();
  await editor.focus();
  await page.keyboard.press('Control+f');
  await expect(page.locator('.tvm-editor-container .find-widget')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(editor).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(editor).not.toBeFocused();
});

test('Escape dismisses Monaco suggestions before leaving the editor', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/SEBook/designpatterns/observer-tutorial.html');
  await waitForTutorialReady(page, { bootTimeout: 90_000 });

  const editor = page.locator('.tvm-editor-container .monaco-editor textarea.inputarea').first();
  await editor.focus();
  await page.evaluate(() => {
    window.monaco.languages.registerCompletionItemProvider('python', {
      provideCompletionItems(_model, position) {
        return { suggestions: [{
          label: 'escapeProbe',
          kind: window.monaco.languages.CompletionItemKind.Text,
          insertText: 'escapeProbe',
          range: new window.monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
        }] };
      },
    });
    window._tutorial.editor.trigger('test', 'editor.action.triggerSuggest', {});
  });
  await expect(page.locator('.suggest-widget').filter({ visible: true })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(editor).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(editor).not.toBeFocused();
});

test('Escape moves focus from a detached editor to its Close window control', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/SEBook/designpatterns/observer-tutorial.html');
  await waitForTutorialReady(page, { bootTimeout: 90_000 });

  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.locator('.tvm-tab-popout').first().click(),
  ]);
  const closeWindow = popup.locator('#exitEditorBtn');
  const editor = popup.locator('#editorRoot .monaco-editor textarea.inputarea');
  await expect(closeWindow).toBeVisible();
  await expect(closeWindow).toHaveAccessibleName('Close window');
  await expect(editor).toBeVisible();
  await editor.focus();
  await popup.keyboard.press('Escape');
  await expect(closeWindow).toBeFocused();
  await popup.keyboard.press('Enter').catch((error) => {
    if (!popup.isClosed()) throw error;
  });
  await expect.poll(() => popup.isClosed()).toBe(true);
});
