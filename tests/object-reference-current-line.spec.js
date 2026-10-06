// @ts-check
const { test, expect } = require('@playwright/test');

test('source marker and printed source describe the objects already visualized', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/SEBook/tools/python.html');
  const lab = page.getByRole('region', { name: 'Object reference lab: Changing a row or replacing a slot', exact: true });
  const forward = lab.getByRole('button', { name: 'Forward', exact: true });
  const marker = lab.locator('.orl-line-number.is-current');
  const source = lab.locator('.orl-source-line.is-current');
  const diagram = lab.getByRole('region', { name: 'Object reference diagram', exact: true });
  await expect(marker).toHaveCount(0);
  await forward.click();
  await expect(marker, 'no statement has produced the initial empty state yet').toHaveCount(0);
  await forward.click();
  await expect(diagram.getByRole('region', { name: 'o1: list', exact: true })).toBeVisible();
  await expect(marker).toHaveText('1');
  await expect(source).toHaveText('row = [0]');
  await expect(lab.getByRole('status')).toContainText('Line 1');
  await forward.click();
  await forward.click();
  await expect(diagram.getByText('1', { exact: true })).toBeVisible();
  await expect(marker).toHaveText('3');
  await expect(source).toHaveText('board[0].append(1)');
  while (await forward.isEnabled()) await forward.click();
  await expect(marker, 'the final state retains the last executed statement').toHaveText('6');
  await expect(source).toHaveText('print(row)');
  await expect(lab.getByRole('region', { name: 'Program output', exact: true })).toHaveText('[[0, 1], [2]]\n[0, 1]');
  await lab.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(marker).toHaveText('5');
  await expect(source).toHaveText('print(board)');

  await page.emulateMedia({ media: 'print' });
  const history = lab.locator('.orl-print-step');
  await expect(history.nth(1).locator('.orl-print-line')).toHaveCount(0);
  await expect(history.nth(2).locator('.orl-print-line')).toHaveText('row = [0]');
  await expect(history.nth(4).locator('.orl-print-line')).toHaveText('board[0].append(1)');
  await expect(history.last().locator('.orl-print-line')).toHaveText('print(row)');
});
