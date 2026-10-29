const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const tutorial = yaml.load(fs.readFileSync(path.join(__dirname, '../_data/tutorials/tla.yml'), 'utf8'));
const beginner = yaml.load(fs.readFileSync(path.join(__dirname, '../_data/tutorials/pluscal.yml'), 'utf8'));

// This suite deliberately uses the real hosted Java runtime and official pinned TLC.
// Run explicitly when changing engine artifacts, isolation, or protocol integration.
test.describe('official TLA+ engine in the tutorial', () => {
  test.skip(process.env.TLA_BROWSER_ENGINE !== '1', 'Set TLA_BROWSER_ENGINE=1 to exercise the real hosted JVM.');
  test.setTimeout(240000);

  test.beforeEach(async ({ page }) => {
    await page.goto('/SEBook/verification/tla-tutorial');
    await expect(page.getByRole('button', { name: 'Model.tla', exact: true })).toHaveAttribute('aria-current', 'true');
    await expect(page.getByRole('button', { name: 'Check every reachable state', exact: true })).toBeEnabled();
  });

  async function lesson(page, number) {
    await page.getByRole('button', { name: 'Step ' + number + ': ' + tutorial.steps[number - 1].title, exact: true }).click();
    await expect(page.getByRole('heading', { name: tutorial.steps[number - 1].title, exact: true })).toBeVisible();
  }

  async function check(page, outcome) {
    await page.getByRole('button', { name: 'Check every reachable state', exact: true }).click();
    await expect(page.locator('.tla-result')).toBeVisible({ timeout: 210000 });
    await expect(page.locator('.tla-result')).toHaveAttribute('data-outcome', outcome);
    await expect(page.getByRole('button', { name: 'Check every reachable state', exact: true })).toBeEnabled();
  }

  async function applyReference(page, index) {
    // Set up the authored reference fixture through the real editor model. The
    // test's oracle remains the independently executed upstream checker result.
    await page.evaluate(files => {
      for (const file of files) window._tutorial.editorModels[file.path].model.setValue(file.content);
    }, tutorial.steps[index].solution.files);
  }

  test('complete finite check, invariant counterexample, source link, stale edits, and a repaired model', async ({ page }) => {
    await check(page, 'complete');
    await expect(page.locator('.tla-scope')).toContainText('Model.cfg');
    await lesson(page, 2);
    await check(page, 'counterexample');
    await expect(page.locator('.tla-diagnostics')).toContainText('WithinCapacity');
    await page.getByRole('button', { name: 'State 4', exact: true }).click();
    await expect(page.locator('.tla-variables')).toContainText('3');
    await page.locator('.tla-source button').click();
    await expect(page.getByRole('button', { name: 'Model.tla', exact: true })).toHaveAttribute('aria-current', 'true');
    await applyReference(page, 1);
    await expect(page.getByText('The source has changed. These results describe an earlier version; run again to check your edits.', { exact: true })).toBeVisible();
    await check(page, 'complete');
    await expect(page.getByText('The source has changed. These results describe an earlier version; run again to check your edits.', { exact: true })).toBeHidden();
  });

  test('PlusCal translation and concurrency trace, then a genuine liveness loop and fair repair', async ({ page }) => {
    await lesson(page, 3);
    await page.getByRole('button', { name: 'Check syntax / translate PlusCal', exact: true }).click();
    await expect(page.locator('.tla-result')).toHaveAttribute('data-outcome', 'parsed', { timeout: 210000 });
    await expect(page.locator('.tla-generated')).toContainText('BEGIN TRANSLATION');
    await check(page, 'counterexample');
    await expect(page.locator('.tla-diagnostics')).toContainText('AllCounted');
    await lesson(page, 4);
    await check(page, 'counterexample');
    await expect(page.locator('.tla-trace').getByText(/can repeat forever/)).toBeVisible();
    await applyReference(page, 3);
    await check(page, 'complete');
    await expect(page.locator('.tla-trace')).toBeHidden();
  });

  test('exploration uses genuine successor states and operator evaluation in an opaque runtime', async ({ page }) => {
    await page.getByRole('button', { name: 'Explore one behavior', exact: true }).click();
    await expect(page.locator('.tla-choice-list button')).toHaveCount(1, { timeout: 210000 });
    await page.locator('.tla-choice-list button').first().click();
    await expect(page.locator('.tla-variables')).toContainText('count');
    await expect(page.locator('.tla-choice-list button')).toHaveCount(1);
    await page.locator('.tla-choice-list button').first().click();
    await expect(page.locator('.tla-variables')).toContainText('1');
    await page.getByText('Watch an operator', { exact: true }).click();
    await page.getByLabel('Operator name', { exact: true }).fill('WithinCapacity');
    await page.getByRole('button', { name: 'Evaluate', exact: true }).click();
    await expect(page.locator('.tla-evaluation-result')).toContainText('TRUE');
    const runtime = page.frames().find(frame => frame.url().startsWith('data:text/html'));
    expect(runtime).toBeTruthy();
    expect(await runtime.evaluate(() => {
      let domDenied = false, storageDenied = false;
      try { void parent.document.body; } catch { domDenied = true; }
      try { void localStorage.length; } catch { storageDenied = true; }
      return { origin: location.origin, domDenied, storageDenied };
    })).toEqual({ origin: 'null', domDenied: true, storageDenied: true });
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    await expect(page.locator('iframe[title="TLA+ execution runtime"]')).toHaveCount(0);
  });

  test('beginner YAML checks give feedback and cannot pass by weakening the visible property', async ({ page }) => {
    await page.goto('/SEBook/verification/pluscal-tutorial');
    const testWork = page.getByRole('button', { name: /Test My Work/ });
    await expect(testWork).toBeEnabled();
    await testWork.click();
    await expect(page.locator('.tvm-test-results')).toBeVisible({ timeout: 210000 });
    await expect(page.locator('.tvm-test-item.pass')).toHaveCount(1);
    await expect(page.locator('.tvm-test-detail')).toContainText('instructor-defined invariant');

    await page.getByRole('button', { name: 'Step 2: ' + beginner.steps[1].title, exact: true }).click();
    await testWork.click();
    await expect(page.locator('.tvm-test-results')).toBeVisible({ timeout: 210000 });
    await expect(page.locator('.tvm-test-item.fail')).toHaveCount(1);
    await expect(page.locator('.tvm-test-detail')).toContainText('invariant violation');
    await expect(page.locator('.tla-result')).toHaveAttribute('data-outcome', 'counterexample');

    await page.evaluate(() => {
      const model = window._tutorial.editorModels['Model.tla'].model;
      model.setValue(model.getValue().replace('CountWithinLimit == count <= 2', 'CountWithinLimit == TRUE'));
      window._tutorial.editorModels['Model.cfg'].model.setValue('SPECIFICATION Spec\nCHECK_DEADLOCK FALSE');
    });
    await expect(page.locator('.tvm-test-results')).toHaveCount(0);
    await testWork.click();
    await expect(page.locator('.tvm-test-results')).toBeVisible({ timeout: 210000 });
    await expect(page.locator('.tvm-test-item.fail')).toHaveCount(1);

    await page.evaluate(files => {
      for (const file of files) window._tutorial.editorModels[file.path].model.setValue(file.content);
    }, beginner.steps[1].solution.files);
    await testWork.click();
    await expect(page.locator('.tvm-test-results')).toBeVisible({ timeout: 210000 });
    await expect(page.locator('.tvm-test-item.pass')).toHaveCount(1);
    await expect(page.locator('.tvm-test-detail')).toContainText('holds in every reachable state');
    await page.reload();
    await expect(page.getByRole('button', { name: 'Model.tla', exact: true })).toHaveAttribute('aria-current', 'true');
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('tutorial-progress-pluscal')).stepsPassed)).toContain(1);
  });
});
