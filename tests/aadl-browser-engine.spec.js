const { test, expect } = require('@playwright/test');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const AxeBuilder = require('@axe-core/playwright').default;
const { chromiumLaunchOptions } = require('../scripts/chromium-launch-options');
const tutorial = yaml.load(readFileSync(path.join(__dirname, '../_data/tutorials/aadl.yml'), 'utf8'));

// Exercise normal browser scheduling: Playwright otherwise disables background
// throttling, which can conceal startup stalls in a hidden runtime frame.
test.use({ launchOptions: {
  ...chromiumLaunchOptions(),
  ignoreDefaultArgs: ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'],
} });

// Opt-in integration uses real hosted CheerpJ and the pinned OSATE artifacts.
// Fixture insertion is setup; all conclusions come from the real engine and UI.
test.describe('AADL in-browser engine', () => {
  test.skip(process.env.AADL_BROWSER_ENGINE !== '1', 'Set AADL_BROWSER_ENGINE=1 for real Java runtime integration.');
  test.setTimeout(480000);

  async function open(page) {
    await page.goto('/SEBook/architecture/aadl-tutorial');
    await expect(page.getByRole('button', { name: /Analyze model$/ })).toBeEnabled({ timeout: 240000 });
  }
  async function source(page, text) {
    await page.evaluate(content => window._tutorial.editorModels['Model.aadl'].model.setValue(content), text);
  }
  async function analyze(page, finding) {
    await page.getByRole('button', { name: /Analyze model$/ }).click();
    const evidence = page.getByRole('region', { name: 'Latency evidence', exact: true });
    await expect(evidence.getByRole('heading', { name: 'response: ' + finding, exact: true })).toBeVisible({ timeout: 240000 });
    await expect(page.getByRole('button', { name: /Analyze model$/ })).toBeEnabled();
    return evidence;
  }

  test('changes during first startup resolve the latest architecture without restarting', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/SEBook/architecture/aadl-tutorial');
    const status = page.getByRole('status').filter({ hasText: /elapsed/ });
    await expect(status).toContainText(/Starting the browser Java runtime|Loading the AADL language|Initializing OSATE/, { timeout: 30000 });
    const changed = tutorial.steps[0].files[0].content
      .replace('control: system Controller;', 'navigator: system Controller;')
      .replaceAll('control.speed', 'navigator.speed')
      .replaceAll('control.command', 'navigator.command')
      .replaceAll('control.control', 'navigator.control');
    const runtime = page.frames().find(frame => frame.url().startsWith('data:text/html'));
    await expect(page.getByRole('textbox', { name: /Code pane/ })).toBeEditable();
    await source(page, changed);
    await expect(page.getByRole('img', { name: /communication/i })).toBeVisible({ timeout: 240000 });
    expect(runtime.isDetached(), 'source edits must retain the initializing engine').toBe(false);
    await page.getByText('Model details', { exact: true }).click();
    await expect(page.getByRole('table', { name: /Components/ })).toContainText('navigator');
    await expect(await analyze(page, 'Satisfied')).toContainText('18–22 ms');
    expect(errors).toEqual([]);
  });

  test('same-root edits update the graph and distinguish failure, missing evidence, invalid source, and repair', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await open(page);
    const original = tutorial.steps[0].files[0].content;
    await analyze(page, 'Satisfied');
    await expect(page.getByRole('img', { name: /communication/i })).toBeVisible();
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(audit.violations).toEqual([]);
    await source(page, original.replace('0 ms .. 25 ms', '0 ms .. 21 ms'));
    await expect(page.getByText(/Previous model; source changed/)).toBeVisible();
    await analyze(page, 'Violated');
    await source(page, original.replace('0 ms .. 25 ms', '0 ms .. 22 ms'));
    await expect(await analyze(page, 'Satisfied')).toContainText('18–22 ms');
    await source(page, original.replace('{Latency => 8 ms .. 12 ms;}', ''));
    await expect(await analyze(page, 'Inconclusive')).toContainText('Explicit latency contribution');
    await source(page, original.replace('command: in data port Drive_Command;', 'command: out data port Drive_Command;'));
    await expect(page.getByRole('region', { name: 'Model diagnostics' })).toContainText(/error/i, { timeout: 240000 });
    await expect(page.getByRole('region', { name: 'Latency evidence' })).not.toContainText('Satisfied');
    await source(page, original);
    await analyze(page, 'Satisfied');
    const runtime = page.frames().find(frame => frame.url().startsWith('data:text/html'));
    expect(await runtime.evaluate(() => {
      let parentDenied = false;
      try { void parent.document.body; } catch { parentDenied = true; }
      return { origin: location.origin, parentDenied };
    })).toEqual({ origin: 'null', parentDenied: true });
    expect(errors).toEqual([]);
  });

  test('reference repairs pass semantic checks and edits revoke the result', async ({ page }) => {
    await open(page);
    for (const [index, step] of tutorial.steps.entries()) {
      if (!step.tests?.length) continue;
      await page.getByRole('button', { name: `Step ${index + 1}: ${step.title}`, exact: true }).click();
      await expect(page.getByRole('heading', { name: step.title, exact: true })).toBeVisible();
      await source(page, step.solution.files[0].content);
      await page.getByRole('button', { name: /Test My Work/ }).click();
      await expect(page.getByText(`✅ All ${step.tests.length} tests passed!`, { exact: true })).toBeVisible({ timeout: 240000 });
      await source(page, 'package Broken public end Different;');
      await expect(page.getByText(`✅ All ${step.tests.length} tests passed!`, { exact: true })).toBeHidden();
    }
  });

  test('Stop discards startup and changing lessons prevents an in-flight result reaching the destination', async ({ page }) => {
    await page.goto('/SEBook/architecture/aadl-tutorial');
    await expect(page.getByRole('button', { name: 'Stop model update', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Stop model update', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Stopped.' })).toBeVisible();
    await expect(page.getByTitle('AADL execution runtime', { exact: true })).toHaveCount(0);
    await analyze(page, 'Satisfied');
    await page.getByRole('button', { name: /Analyze model$/ }).click();
    await page.getByRole('button', { name: 'Step 2: Port Contracts', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Port Contracts', exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Model diagnostics' })).toContainText(/error/i, { timeout: 240000 });
    await expect(page.getByRole('region', { name: 'Latency evidence' })).not.toContainText('Satisfied');
  });
});
