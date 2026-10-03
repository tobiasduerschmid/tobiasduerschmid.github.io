const features = require('./helpers/smalltalk-features');
const { test, expect } = require('@playwright/test');
test.beforeEach(() => test.skip(!features.refactorings, 'Native refactorings are deferred; their implementation is retained for future activation.'));
const fs = require('node:fs');
const path = require('node:path');
const { mountSmalltalkFixture } = require('./helpers/smalltalk-runtime');
const { a11yCheckpoint } = require('./a11y-helpers');
test.setTimeout(180000);
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/smalltalk/refactoring-cases.json'), 'utf8'));
const program = { version: 1, revision: 0, files: [{ path: '/catalog.st', kind: 'source', format: 'filein', content: fs.readFileSync(path.join(__dirname, 'fixtures/smalltalk/refactoring-catalog.st'), 'utf8') }], changes: { version: 1, source: '', entries: [] }, runCommand: null };
async function nativeBoolean(page, source) {
  const result = await page.evaluate(source => window.smalltalkFixtureWorkspace.evaluate(source), source);
  expect(result.error).toBeNull(); expect(result.value.booleanValue).toBe(true);
}
async function selectNativeRange(page, target, selected) {
  const result = await page.evaluate(target => window.smalltalkFixtureWorkspace.browse({ kind: 'source', target, offset: 0, limit: 1 }), target);
  const visible = result.source.replace(/\r\n?/g, '\n'), start = visible.indexOf(selected);
  expect(start, 'Native fixture selection exists in accepted source').toBeGreaterThanOrEqual(0);
  const editor = page.getByRole('textbox', { name: /^Smalltalk method source/ });
  await editor.focus(); await editor.press('Control+Home');
  for (const unused of Array.from(visible.slice(0, start))) { void unused; await editor.press('ArrowRight'); }
  for (const unused of Array.from(selected)) { void unused; await editor.press('Shift+ArrowRight'); }
}

for (const [action, variant] of [['extractMethod'], ['addMethod'], ['removeClass'], ['createAccessors'], ['createAccessors', 'class variable'], ['renameClass']]) {
  test(`native catalog ${action}${variant ? " " + variant : ""} options preview and apply through Browser`, async ({ page }) => {
    const item = structuredClone(cases.find(item => item.action === action && item.variant === variant));
    if (action === 'addMethod') item.options.protocols = ['ui-added-protocol'];
    const cleanup = await mountSmalltalkFixture(page, { program, views: ['browser', 'refactorings'] });
    try {
      await page.evaluate(target => window.smalltalkFixtureBrowser.navigate(target), item.target);
      if (item.select) await selectNativeRange(page, item.target, item.select);
      if (action === 'removeClass') await page.evaluate(() => window.smalltalkFixtureWorkspace.evaluate('held := SECatalogRemovable new. formerClass := held class'));
      await page.getByRole('button', { name: 'Refactor', exact: true }).click();
      const catalog = await page.evaluate(target => window.smalltalkFixtureRefactorings.catalog(target), item.target);
      await expect(page.getByLabel('Refactoring action', { exact: true }).getByRole('option')).toHaveCount(catalog.length);
      await page.getByLabel('Refactoring action', { exact: true }).selectOption(action);
      for (const input of catalog.find(entry => entry.action === action).options.inputs) {
        const dialog = page.getByRole('dialog', { name: 'Native Smalltalk refactoring', exact: true });
        const control = dialog.getByRole(input.type === 'boolean' ? 'checkbox' : 'textbox', { name: input.label, exact: true }), value = item.options[input.name];
        if (input.type === 'boolean') await control.setChecked(value);
        else await control.fill(Array.isArray(value) ? value.join('\n') : value);
      }
      await page.getByRole('button', { name: 'Preview refactoring', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Apply refactoring', exact: true })).toBeEnabled({ timeout: 60000 });
      const preview = page.getByRole('region', { name: 'Native change preview', exact: true });
      for (const target of item.expectedTargets) {
        const [className, sideSelector] = target.split('.');
        await expect(preview.getByRole('heading', { name: new RegExp(className + '.*' + sideSelector.split('>>').join('.*') + '$') })).toBeVisible();
      }
      await nativeBoolean(page, item.before);
      if (action === 'removeClass') await expect(preview).toContainText(/obsolete.*does not restore the former class identity/i);
      await a11yCheckpoint(page, 'catalog-' + action + '-preview', { feature: 'smalltalk-refactoring' });
      await page.getByRole('button', { name: 'Apply refactoring', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Native Smalltalk refactoring', exact: true })).toBeHidden({ timeout: 60000 });
      if (action === 'removeClass' || action === 'renameClass') await expect(page.getByRole('region', { name: 'Smalltalk System Browser', exact: true })).toBeFocused();
      else await expect(page.getByRole('button', { name: 'Refactor', exact: true })).toBeFocused();
      await nativeBoolean(page, item.postcondition);
      if (action === 'addMethod') {
        const methods = await page.evaluate(() => window.smalltalkFixtureWorkspace.browse({ kind: 'methods', target: { kind: 'protocol', className: 'SECatalogTarget', side: 'instance', protocol: 'ui-added-protocol' }, offset: 0, limit: 100 }));
        expect(methods.items.some(item => item.label === 'catAdded')).toBe(true);
      }

      await expect(page.getByRole('button', { name: 'Undo refactoring', exact: true })).toBeEnabled();
      await page.getByRole('button', { name: 'Undo refactoring', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Redo refactoring', exact: true })).toBeEnabled({ timeout: 60000 });
      await nativeBoolean(page, item.undo || item.before);
      if (action === 'removeClass') await nativeBoolean(page, '(held class == formerClass) and: [(SECatalogRemovable == formerClass) not]');

    } finally { await cleanup(); }
  });
}

test('integer-list validation and unavailable native actions remain explicit', async ({ page }) => {
  const item = cases.find(item => item.action === 'reorderParameters');
  const cleanup = await mountSmalltalkFixture(page, { program, views: ['browser', 'refactorings'] });
  try {
    await page.evaluate(target => window.smalltalkFixtureBrowser.navigate(target), item.target);
    await page.getByRole('button', { name: 'Refactor', exact: true }).click();
    await page.getByLabel('Refactoring action', { exact: true }).selectOption(item.action);
    await page.getByLabel('New selector', { exact: true }).fill(item.options.newSelector);
    const permutation = page.getByLabel('Old argument position for each new position', { exact: true });
    await permutation.fill('2, not a number');
    await page.getByRole('button', { name: 'Preview refactoring', exact: true }).click();
    await expect(page.getByRole('status', { name: 'Refactoring status', exact: true })).toContainText(/whole numbers/);
    await expect(permutation).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByRole('button', { name: 'Apply refactoring', exact: true })).toBeDisabled();
    await permutation.fill('1\n1');
    await page.getByRole('button', { name: 'Preview refactoring', exact: true }).click();
    await expect(page.getByRole('status', { name: 'Refactoring status', exact: true })).toContainText(/Refactoring failed/, { timeout: 60000 });
    const catalog = await page.evaluate(target => window.smalltalkFixtureRefactorings.catalog(target), item.target);
    const unavailable = catalog.filter(entry => !entry.applicable);
    expect(unavailable.length).toBeGreaterThan(0);
    await page.getByText('Unavailable refactoring actions', { exact: true }).click();
    for (const entry of unavailable) await expect(page.getByRole('dialog', { name: 'Native Smalltalk refactoring', exact: true })).toContainText(entry.reason);
    await a11yCheckpoint(page, 'integer-validation-unavailable-action', { feature: 'smalltalk-refactoring' });
    await nativeBoolean(page, item.before);
  } finally { await cleanup(); }
});

test('every applicable native catalog action renders its declared labeled option types', async ({ page }) => {
  const target = cases.find(item => item.action === 'extractMethod').target;
  const cleanup = await mountSmalltalkFixture(page, { program, views: ['browser', 'refactorings'] });
  try {
    await page.evaluate(target => window.smalltalkFixtureBrowser.navigate(target), target);
    const catalog = await page.evaluate(target => window.smalltalkFixtureRefactorings.catalog(target), target);
    await page.getByRole('button', { name: 'Refactor', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Native Smalltalk refactoring', exact: true });
    for (const entry of catalog.filter(entry => entry.applicable)) {
      await dialog.getByLabel('Refactoring action', { exact: true }).selectOption(entry.action);
      for (const input of entry.options.inputs) {
        const control = dialog.getByRole(input.type === 'boolean' ? 'checkbox' : 'textbox', { name: input.label, exact: true });
        await expect(control).toBeVisible();
      }
      if (entry.options.selection) {
        await expect(dialog).toContainText('Select a nonempty range');
        await expect(dialog.getByRole('button', { name: 'Preview refactoring', exact: true })).toBeDisabled();
      }
    }
    await a11yCheckpoint(page, 'complete-native-catalog-fields', { feature: 'smalltalk-refactoring' });
    await nativeBoolean(page, 'SECatalogTarget new catExtract = 42');
  } finally { await cleanup(); }
});
