const { test, expect: standardExpect } = require('@playwright/test');
const expect = standardExpect.configure({ timeout: 30000 });
const { mountSmalltalkFixture } = require('./helpers/smalltalk-runtime');
const { a11yCheckpoint } = require('./a11y-helpers');

test.setTimeout(180000);

const program = {
  version: 1,
  stepKey: 'all-protocols',
  revision: 0,
  files: [{
    path: '/counter.st',
    kind: 'source',
    format: 'filein',
    content: "Object subclass: #SEBookCounter instanceVariableNames: 'count' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Star'!\n!SEBookCounter methodsFor: 'initialization'!\ninitialize count := 0! !\n!SEBookCounter methodsFor: 'counting'!\nincrement count := count + 1. ^ self!\nvalue ^ count! !\n!SEBookCounter class methodsFor: 'tutorial entry points'!\nrunExample ^ self new increment; value! !",
  }],
  changes: { version: 1, source: '', entries: [] },
  runCommand: null,
};

test('selecting * lists every method of the class on the current side', async ({ page }) => {
  const cleanup = await mountSmalltalkFixture(page, { program, views: ['browser'] });
  const protocols = page.getByRole('listbox', { name: 'Protocols', exact: true });
  const methods = page.getByRole('listbox', { name: 'Methods', exact: true });
  const protocolSearch = page.getByRole('region', { name: 'Protocols', exact: true });
  try {
    await page.getByLabel('Search packages', { exact: true }).fill('SEBook-Star');
    await page.getByRole('region', { name: 'Packages', exact: true }).getByRole('button', { name: 'Search', exact: true }).click();
    await page.getByRole('listbox', { name: 'Packages', exact: true }).selectOption({ label: 'SEBook-Star' });
    await page.getByRole('listbox', { name: 'Classes', exact: true }).selectOption({ label: 'SEBookCounter' });

    await expect(protocols.getByRole('option', { name: 'counting', exact: true })).toHaveCount(1);
    await expect(protocols.getByRole('option').first()).toHaveText('*');
    await expect(protocols.getByRole('option', { name: 'initialization', exact: true })).toHaveCount(1);

    await page.getByLabel('Search protocols', { exact: true }).fill('INIT');
    await protocolSearch.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(protocols.getByRole('option', { name: '*', exact: true })).toHaveCount(0);
    await expect(protocols.getByRole('option', { name: 'initialization', exact: true })).toHaveCount(1);
    await expect(protocols.getByRole('option', { name: 'counting', exact: true })).toHaveCount(0);

    await page.getByLabel('Search protocols', { exact: true }).fill('*');
    await protocolSearch.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(protocols.getByRole('option', { name: '*', exact: true })).toHaveCount(1);
    await expect(protocols.getByRole('option', { name: 'initialization', exact: true })).toHaveCount(0);

    await page.getByLabel('Search protocols', { exact: true }).fill('');
    await protocolSearch.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(protocols.getByRole('option', { name: '*', exact: true })).toHaveCount(1);

    await protocols.selectOption({ label: '*' });
    await expect(methods.getByRole('option')).toHaveText(['increment', 'initialize', 'value']);
    await a11yCheckpoint(page, 'protocols-all-methods', { feature: 'smalltalk-browser' });

    await page.getByText('More browsing queries', { exact: true }).click();
    await page.getByRole('button', { name: 'Class definition', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Method source', exact: true })).toContainText('Object subclass: #SEBookCounter');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(protocols.getByRole('option', { name: '*', selected: true })).toHaveCount(1);
    await expect(methods.getByRole('option')).toHaveText(['increment', 'initialize', 'value']);
    await expect(page.getByRole('region', { name: 'Method source', exact: true })).toContainText('Select a method, class definition, or class comment.');

    await methods.selectOption({ label: 'increment' });
    await expect(page.getByRole('region', { name: 'Method source', exact: true })).toContainText('count := count + 1');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(methods.getByRole('option')).toHaveText(['increment', 'initialize', 'value']);

    await protocols.selectOption({ label: 'counting' });
    await expect(methods.getByRole('option')).toHaveText(['increment', 'value']);
    await protocols.selectOption({ label: '*' });
    await expect(methods.getByRole('option')).toHaveText(['increment', 'initialize', 'value']);
    await protocols.selectOption({ label: '*' });
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(protocols.getByRole('option', { name: 'counting', selected: true })).toHaveCount(1);
    await expect(methods.getByRole('option')).toHaveText(['increment', 'value']);
    await page.getByRole('button', { name: 'Forward', exact: true }).click();
    await expect(protocols.getByRole('option', { name: '*', selected: true })).toHaveCount(1);
    await expect(methods.getByRole('option')).toHaveText(['increment', 'initialize', 'value']);

    await page.getByRole('radio', { name: 'Class', exact: true }).check();
    await expect(protocols.getByRole('option', { name: 'tutorial entry points', exact: true })).toHaveCount(1);
    await expect(protocols.getByRole('option', { name: 'counting', exact: true })).toHaveCount(0);
    await protocols.selectOption({ label: '*' });
    await expect(methods.getByRole('option')).toHaveText(['runExample']);
  } finally {
    await cleanup();
  }
});
