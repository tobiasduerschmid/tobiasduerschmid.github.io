// @ts-check
const { test, expect } = require('@playwright/test');
const { loadTutorialConfig } = require('./tutorial-helpers');

// The TLA+ and AADL tutorials run official Java tools in a hosted runtime that
// only the opt-in *-browser-engine specs load. Each test here serves the
// repository's engine client adapter with one fixed result, so every run
// exercises how the tutorial reveals a source location the engine reports.
async function serveEngineResult(page, modulePath, className, result) {
  await page.route(`**/js/${modulePath}`, route => route.fulfill({
    contentType: 'text/javascript',
    body: `export class ${className} {
      constructor() { this.onPhase = () => {}; }
      async execute() { return ${JSON.stringify(result)}; }
      supersede() {}
      cancel() {}
      destroy() {}
    }`,
  }));
}

// Both engines report 1-based source ranges with an inclusive end column.
function locationOf(token, file, source) {
  const lines = source.split('\n');
  const index = lines.findIndex(line => line.includes(token));
  const column = lines[index].indexOf(token) + 1;
  return { file, line: index + 1, column, endLine: index + 1, endColumn: column + token.length - 1 };
}

// Monaco exposes its selection through its API, not the accessibility tree.
function focusedEditorSelection(page) {
  return page.evaluate(() => {
    const editor = window.monaco.editor.getEditors().find(candidate => candidate.hasTextFocus());
    if (!editor) return null;
    const model = editor.getModel();
    return { file: model.uri.path.split('/').pop(), text: model.getValueInRange(editor.getSelection()) };
  });
}

test('a model-checker source link opens its file and selects the reported text', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const files = loadTutorialConfig('tla').steps[0].files;
  const specification = files.find(file => file.path === 'Model.tla');
  await serveEngineResult(page, 'tla/client.mjs', 'TLAClient', {
    version: 1,
    status: 'error',
    reason: 'semantic',
    diagnostics: [{
      message: 'Increment is not defined.',
      location: locationOf('Increment', specification.path, specification.content),
    }],
  });
  await page.goto('/SEBook/verification/tla-tutorial');
  const check = page.getByRole('button', { name: 'Check every reachable state', exact: true });
  await check.click();
  const showSource = page.getByRole('button', { name: 'Show source for this message', exact: true });
  await expect(showSource).toBeEnabled();
  await expect(check).toBeEnabled();
  // Leave the module so revealing the reported location has to switch files.
  await page.getByRole('button', { name: 'Model.cfg', exact: true }).click();

  await showSource.click();

  await expect(page.getByRole('button', { name: specification.path, exact: true })).toHaveAttribute('aria-current', 'true');
  await expect(page.getByRole('textbox', { name: /Code pane/ })).toBeFocused();
  await expect.poll(() => focusedEditorSelection(page)).toEqual({ file: specification.path, text: 'Increment' });
  expect(errors, 'revealing a source location must not throw').toEqual([]);
});

test('an architecture diagnostic link selects the reported text in the model', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const model = loadTutorialConfig('aadl').steps[0].files[0];
  const location = locationOf('Controller', model.path, model.content);
  await serveEngineResult(page, 'aadl/client.mjs', 'AADLClient', {
    version: 1,
    status: 'error',
    analyses: [],
    diagnostics: [{ severity: 'error', message: 'Controller cannot be resolved.', ...location }],
  });
  await page.goto('/SEBook/architecture/aadl-tutorial');

  await page.getByRole('button', { name: `${model.path}:${location.line}`, exact: true }).click();

  await expect(page.getByRole('textbox', { name: /Code pane/ })).toBeFocused();
  await expect.poll(() => focusedEditorSelection(page)).toEqual({ file: model.path, text: 'Controller' });
  expect(errors, 'revealing a source location must not throw').toEqual([]);
});
