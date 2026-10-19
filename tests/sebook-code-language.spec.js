const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');

const classChapter = '/SEBook/uml_class_diagram.html';
const observerChapter = '/SEBook/designpatterns/observer.html';
const tab = (scope, name) => scope.getByRole('tab', { name, exact: true });

async function expectLanguage(page, name) {
  const selectors = page.getByRole('tablist').filter({ has: tab(page, name) });
  await expect(selectors).not.toHaveCount(0);
  await expect(selectors.getByRole('tab', { selected: true })).toHaveText(Array(await selectors.count()).fill(name));
}

test('one choice applies to every example, survives navigation, and preserves unsupported preferences', async ({ page }) => {
  await page.goto(classChapter);
  await expectLanguage(page, 'Python');
  await tab(page.getByRole('tablist', { name: 'Simple class code language' }), 'C++').click();
  await expectLanguage(page, 'C++');
  await page.reload();
  await expectLanguage(page, 'C++');

  await page.goto('/SEBook/testing/goodtests.html');
  await expectLanguage(page, 'C++');
  await tab(page.getByRole('tablist', { name: 'Discount test code language' }), 'TypeScript (Node.js)').click();
  await expectLanguage(page, 'TypeScript (Node.js)');

  await page.goto(classChapter);
  const lab = page.getByRole('region', { name: 'UML code lab: Member visibility', exact: true });
  await expect(tab(lab, 'Python')).toHaveAttribute('aria-selected', 'true');
  await expect(tab(page.getByRole('tablist', { name: 'Simple class code language' }), 'TypeScript')).toHaveAttribute('aria-selected', 'true');
  await page.goto('/SEBook/development_practices/modern_code_review.html');
  await expectLanguage(page, 'Python');
  await page.goto('/SEBook/designpatterns/strategy.html');
  await expectLanguage(page, 'TypeScript');
});

test('Observer tabs and dropdowns share the preference without restarting narration', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(observerChapter);
  const animation = page.getByRole('region', { name: 'Observer in a user interface', exact: true });
  const language = animation.getByRole('combobox', { name: 'Code language' });
  const tabs = page.getByRole('tablist', { name: 'Observer code language' });
  const position = animation.getByRole('slider', { name: 'Animation position' });
  await expect(animation.getByRole('button', { name: 'Play narration' })).toBeVisible();
  await position.fill('120');
  await expect.poll(() => animation.locator('audio').evaluate(audio => audio.currentTime)).toBeCloseTo(120, 1);
  await tab(tabs, 'Java').click();
  await expect(language).toHaveValue('java');
  await expect(position).toHaveValue('120');
  await language.selectOption('typescript');
  await expect(tab(tabs, 'TypeScript')).toHaveAttribute('aria-selected', 'true');
  await expect(position).toHaveValue('120');
  await animation.getByRole('link', { name: 'Read at my own pace', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Code language' })).toHaveValue('typescript');
  await page.getByRole('combobox', { name: 'Code language' }).selectOption('cpp');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Code language' })).toHaveValue('cpp');
  await page.getByRole('link', { name: 'Print view', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Code language' })).toHaveValue('cpp');
  await page.goto(classChapter);
  await expectLanguage(page, 'C++');
  expect(errors).toEqual([]);
});

test('settings and storage deletion update open chapters and restore the default', async ({ page, context }) => {
  await page.goto('/SEBook/testing/goodtests.html');
  const settings = await context.newPage();
  await settings.goto('/settings/');
  const language = settings.getByRole('combobox', { name: 'SE Book code language' });
  await expect(language).toHaveValue('python');
  await language.selectOption('java');
  await expectLanguage(page, 'Java');
  await settings.reload();
  await expect(language).toHaveValue('java');
  await a11yCheckpoint(settings, 'shared code language setting', { feature: 'sebook-code-language' });

  const inventory = await context.newPage();
  await inventory.goto('/cookies/');
  const entry = inventory.getByRole('row').filter({ has: inventory.getByRole('cell', { name: 'sebook-code-language', exact: true }) });
  await expect(entry.getByText('set', { exact: true })).toBeVisible();
  await entry.getByRole('button', { name: 'Delete sebook-code-language', exact: true }).click();
  await expect(entry.getByText('not set', { exact: true })).toBeVisible();
  await expect(language).toHaveValue('python');
  await expectLanguage(page, 'Python');
  await page.reload();
  await expectLanguage(page, 'Python');
});
