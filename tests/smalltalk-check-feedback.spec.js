const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');
test.setTimeout(180000);

async function ready(page) {
  await page.goto('/SEBook/tools/smalltalk-tutorial');
  await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled({ timeout: 120000 });
}

test('checks show excluded drafts, actual values, and native errors without rendering result text as HTML', async ({ page }) => {
  await ready(page);
  // Authored fixtures exercise the real grading pipeline and native image.
  await page.evaluate(() => {
    const tutorial = window._tutorial;
    tutorial.steps[0].tests = [
      { description: 'False assertion', command: 'false' },
      { description: 'Non-Boolean answer', command: '17' },
      { description: 'Native failure', command: "self error: '<img src=x onerror=alert(1)>'" },
    ];
    const workspace = tutorial._smalltalkAdapter.getWorkspace();
    workspace.setDraft({ target: { kind: 'method', className: 'SEBookCounter', side: 'instance', selector: 'increment' },
      baseRevision: workspace.snapshot().revision, source: 'increment ^ self' });
  });
  await page.getByRole('button', { name: /Test My Work/ }).click();
  const results = page.getByRole('region', { name: 'Smalltalk check results', exact: true });
  await expect(results).toContainText('1 draft excluded');
  await expect(results).toContainText('Returned false', { timeout: 120000 });
  await expect(results).toContainText('Returned 17 (SmallInteger); expected Boolean true');
  await expect(results).toContainText('EVALUATION_ERROR');
  await expect(results).toContainText('<img src=x onerror=alert(1)>');
  await expect(results.getByRole('img')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Test My Work/ })).toBeEnabled();
  await a11yCheckpoint(page, 'Smalltalk diagnostic checks', { feature: 'smalltalk-tutorial' });
});

test('stopping checks reports cancellation without marking assertions failed or losing live bindings', async ({ page }) => {
  await ready(page);
  await page.evaluate(async () => {
    const tutorial = window._tutorial;
    tutorial.steps[0].tests = [{ description: 'A cancellable check', command: '[true] whileTrue: []' }];
    await tutorial._smalltalkAdapter.workspace.evaluate('retained := 42');
  });
  await page.getByRole('button', { name: /Test My Work/ }).click();
  await expect(page.getByRole('status', { name: 'Smalltalk check progress', exact: true })).toContainText('Checking 1 of 1');
  await page.getByRole('button', { name: /Stop$/ }).click();
  await expect(page.getByRole('region', { name: 'Smalltalk check results', exact: true })).toContainText('Checks stopped. No completion credit awarded.');
  await expect(page.getByText(/0\s*\/\s*1 tests passed/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Test My Work/ })).toBeEnabled();
  await expect(page.getByRole('button', { name: /Test My Work/ })).toBeFocused();
  // Public Workspace proves Stop cancels only the independent check image.
  const result = await page.evaluate(() => window._tutorial._smalltalkAdapter.workspace.evaluate('retained'));
  expect(result.value.text).toBe('42');
  await expect(page.getByRole('region', { name: 'Program output', exact: true })).not.toContainText('live session resets');
});
