// @ts-check
const fs = require('node:fs/promises');
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');

const CARD_SOURCE = `@startuml
card "Shopping cart" as Cart @pos(40, 80) {
  responsibility: Know products; preserve {quantities} and @pos(2, 3) as text
  responsibility: Calculate total
  collaborator: Catalog
}
card Catalog @pos(620, 80) {
  responsibility: Supply Cart with current prices
}
@enduml`;

function cardButton(page, name) {
  return page.getByRole('button', { name: `Element ${name} — Enter to select, arrows to nudge, Delete to remove`, exact: true });
}

async function openCrcPlayground(page, source = CARD_SOURCE) {
  await page.goto('/SEBook/tools/uml-playground');
  await page.getByLabel('Diagram type:').selectOption('crc');
  await page.getByRole('textbox', { name: 'ArchUML diagram source', exact: true }).fill(source);
  await expect(cardButton(page, 'Shopping cart')).toBeVisible();
}

async function changeField(page, label, value) {
  const field = page.getByLabel(label, { exact: true });
  await field.fill(value);
  await field.press('Tab');
  await expect(page.getByLabel(label, { exact: true })).toHaveValue(value);
}

test('CRC cards can be created and edited visually from an empty model', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/SEBook/tools/uml-editor');
  await page.getByLabel('Diagram type:').selectOption('crc');
  await page.getByRole('button', { name: 'Add element: CRC Card', exact: true }).click();
  await cardButton(page, 'Card').focus();
  await cardButton(page, 'Card').press('Enter');
  await expect(page.getByLabel('Class name', { exact: true })).toBeVisible();

  await changeField(page, 'Class name', 'Shopping cart');
  await expect(page.getByLabel('Responsibilities (one per line)', { exact: true })).toBeFocused();
  await changeField(page, 'Responsibilities (one per line)', 'Know products; preserve {quantities}\nCalculate total');
  await expect(page.getByLabel('Collaborators (one per line)', { exact: true })).toBeFocused();
  await changeField(page, 'Collaborators (one per line)', 'Catalog\nCustomer');

  const preview = page.getByRole('region', { name: 'Diagram preview', exact: true });
  await expect(preview).toContainText('Shopping cart');
  await expect(preview).toContainText('Know products; preserve {quantities}');
  await expect(preview).toContainText('Calculate total');
  await expect(preview).toContainText('Catalog');
  await expect(preview).toContainText('Customer');
  await expect(page.getByRole('button', { name: /Extend a relation/ })).toHaveCount(0);
  await a11yCheckpoint(page, 'CRC card properties', { feature: 'crc-editor', include: '#uml-playground-wrap' });
  expect(errors).toEqual([]);
});

test('CRC keyboard movement preserves prose and deleting a card removes only that card with undo', async ({ page }) => {
  await openCrcPlayground(page);
  const source = page.getByRole('textbox', { name: 'ArchUML diagram source', exact: true });
  const cart = cardButton(page, 'Shopping cart');
  await cart.focus();
  await cart.press('Enter');
  await expect(page.getByLabel('Responsibilities (one per line)', { exact: true })).toHaveValue('Know products; preserve {quantities} and @pos(2, 3) as text\nCalculate total');
  await cart.press('ArrowRight');
  await expect(source).toHaveValue(/card "Shopping cart" as Cart @pos\(50, 80\)/);
  await expect(source).toHaveValue(/responsibility: Know products; preserve \{quantities\} and @pos\(2, 3\) as text/);
  await expect(cart).toBeFocused();
  const beforeDelete = await source.inputValue();

  await cart.press('Delete');
  await expect(cardButton(page, 'Shopping cart')).toHaveCount(0);
  await expect(cardButton(page, 'Catalog')).toBeVisible();
  await expect(source).not.toHaveValue(/Calculate total/);
  await expect(source).toHaveValue(/responsibility: Supply Cart with current prices/);
  await page.getByRole('button', { name: /Undo/, exact: false }).click();
  await expect(source).toHaveValue(beforeDelete);
  await expect(cardButton(page, 'Shopping cart')).toBeVisible();
});

test('CRC duplication retains all responsibilities and collaborators', async ({ page }) => {
  await openCrcPlayground(page);
  const cart = cardButton(page, 'Shopping cart');
  await cart.focus();
  await cart.press('Enter');
  await cart.press('ControlOrMeta+d');
  await expect(cardButton(page, 'Shopping cart')).toHaveCount(2);
  await expect(page.getByLabel('Responsibilities (one per line)', { exact: true })).toHaveValue('Know products; preserve {quantities} and @pos(2, 3) as text\nCalculate total');
  await expect(page.getByLabel('Collaborators (one per line)', { exact: true })).toHaveValue('Catalog');
});

test('CRC drafts survive switching and reload and export a standalone SVG', async ({ page }) => {
  await openCrcPlayground(page);
  await expect(page.getByRole('status').filter({ hasText: '✓ Saved' })).toBeVisible();
  await page.getByLabel('Diagram type:').selectOption('class');
  await page.getByLabel('Diagram type:').selectOption('crc');
  await expect(cardButton(page, 'Shopping cart')).toBeVisible();
  await page.reload();
  await page.getByLabel('Diagram type:').selectOption('crc');
  await expect(page.getByRole('textbox', { name: 'ArchUML diagram source', exact: true })).toHaveValue(CARD_SOURCE);

  const pendingDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: /Download SVG/ }).click();
  const download = await pendingDownload;
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const svg = await fs.readFile(downloadPath, 'utf8');
  expect(svg).toContain('<svg');
  expect(svg).toContain('Shopping cart');
  expect(svg).toContain('Calculate total');
  expect(svg).toContain('Catalog');
});

test('a quoted CRC class name without an alias survives visual edits and duplication', async ({ page }) => {
  await openCrcPlayground(page, `@startuml
card "Shopping cart" {
  responsibility: Compare A --> B; retain {quantities}
  collaborator: Customer
}
@enduml`);
  const cart = cardButton(page, 'Shopping cart');
  await cart.focus();
  await cart.press('Enter');
  await changeField(page, 'Class name', 'Order basket');
  const renamed = cardButton(page, 'Order basket');
  await expect(renamed).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'ArchUML diagram source', exact: true })).toHaveValue(/card "Order basket" as "Shopping cart"/);
  await renamed.focus();
  await renamed.press('ArrowRight');
  await expect(page.getByLabel('Responsibilities (one per line)', { exact: true })).toHaveValue('Compare A --> B; retain {quantities}');
  await renamed.press('ControlOrMeta+d');
  await expect(cardButton(page, 'Order basket')).toHaveCount(2);
  await expect(page.getByLabel('Collaborators (one per line)', { exact: true })).toHaveValue('Customer');
});


test('CRC property commits preserve backward keyboard focus', async ({ page }) => {
  await openCrcPlayground(page);
  const cart = cardButton(page, 'Shopping cart');
  await cart.focus();
  await cart.press('Enter');
  const collaborators = page.getByLabel('Collaborators (one per line)', { exact: true });
  const responsibilities = page.getByLabel('Responsibilities (one per line)', { exact: true });
  await collaborators.fill('Catalog\nCustomer');
  await collaborators.press('Shift+Tab');
  await expect(responsibilities).toBeFocused();
  await responsibilities.fill('Know selected products');
  await responsibilities.press('Shift+Tab');
  await expect(page.getByLabel('Class name', { exact: true })).toBeFocused();
  await expect(page.getByRole('region', { name: 'Diagram preview', exact: true })).toContainText('Know selected products');
});
