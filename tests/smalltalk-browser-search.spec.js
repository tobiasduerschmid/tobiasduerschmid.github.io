const { test, expect: standardExpect } = require('@playwright/test');
const expect = standardExpect.configure({ timeout: 30000 });
const { mountSmalltalkFixture } = require('./helpers/smalltalk-runtime');

test.setTimeout(180000);

const anchorSource = [
  "Object subclass: #SEBookSearchAnchor instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Smalltalk'!",
  "!SEBookSearchAnchor methodsFor: 'testing'!",
  'anchor ^ 1! !',
].join('\n');
const program = {
  version: 1,
  stepKey: 'image-search',
  revision: 0,
  files: [{ path: '/anchor.st', kind: 'source', format: 'filein', content: anchorSource }],
  changes: { version: 1, source: '', entries: [] },
  runCommand: null,
};

async function selectAnchorPackage(page) {
  const packageSearch = page.getByRole('searchbox', { name: 'Search packages', exact: true });
  await packageSearch.fill('SEBook-Smalltalk');
  await packageSearch.press('Enter');
  await page.getByRole('listbox', { name: 'Packages', exact: true }).selectOption({ label: 'SEBook-Smalltalk' });
}

test('submitting a class search finds a class that is not in the selected package', async ({ page }) => {
  const cleanup = await mountSmalltalkFixture(page, { program });
  try {
    await selectAnchorPackage(page);
    const classes = page.getByRole('listbox', { name: 'Classes', exact: true });
    const classSearch = page.getByRole('searchbox', { name: 'Search classes', exact: true });
    await expect(classes.getByRole('option', { name: 'SEBookSearchAnchor', exact: true })).toBeAttached();
    await classSearch.fill('');
    await classSearch.press('Enter');
    await expect(classes.getByRole('option', { name: 'SEBookSearchAnchor', exact: true })).toBeAttached();
    await expect(classes.getByRole('option', { name: 'SmallInteger', exact: true })).toHaveCount(0);

    await classSearch.fill('smallinteger');
    await classSearch.press('Enter');
    await expect(classes.getByRole('option', { name: 'SmallInteger', exact: true })).toBeAttached();
    await classes.selectOption({ label: 'SmallInteger' });

    await expect(page.getByRole('listbox', { name: 'Packages', exact: true })).toHaveValue('Kernel-Numbers');
    await expect(classes).toHaveValue('SmallInteger');
    await expect(page.getByRole('region', { name: 'Method source', exact: true })).toContainText('SmallInteger');
  } finally { await cleanup(); }
});

test('submitting a method search finds a method outside the selected package', async ({ page }) => {
  const cleanup = await mountSmalltalkFixture(page, { program });
  try {
    await selectAnchorPackage(page);
    await page.getByRole('listbox', { name: 'Classes', exact: true }).selectOption({ label: 'SEBookSearchAnchor' });
    await page.getByRole('listbox', { name: 'Protocols', exact: true }).selectOption({ label: 'testing' });
    const methods = page.getByRole('listbox', { name: 'Methods', exact: true });
    const methodSearch = page.getByRole('searchbox', { name: 'Search methods', exact: true });
    await expect(methods.getByRole('option', { name: 'anchor', exact: true })).toBeAttached();
    await methodSearch.fill('');
    await methodSearch.press('Enter');
    await expect(methods.getByRole('option', { name: 'anchor', exact: true })).toBeAttached();
    await expect(methods.getByRole('option', { name: 'Number>>copySignTo:', exact: true })).toHaveCount(0);

    await methodSearch.fill('copySignTo:');
    await methodSearch.press('Enter');
    await expect(methods.getByRole('option', { name: 'Number>>copySignTo:', exact: true })).toBeAttached();
    await methods.selectOption({ label: 'Number>>copySignTo:' });

    await expect(page.getByRole('listbox', { name: 'Packages', exact: true })).toHaveValue('Kernel-Numbers');
    await expect(page.getByRole('listbox', { name: 'Classes', exact: true })).toHaveValue('Number');
    await expect(page.getByRole('listbox', { name: 'Protocols', exact: true })).toHaveValue('mathematical functions');
    await expect(methods).toHaveValue('copySignTo:');
    await expect(page.getByRole('radio', { name: 'Instance', exact: true })).toBeChecked();
    await expect(page.getByRole('region', { name: 'Method source', exact: true })).toContainText('copySignTo:');
  } finally { await cleanup(); }
});
