const test = require('node:test');
const { chromium, expect } = require('@playwright/test');
const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const baseline = require('./fixtures/aadl-budget-result.json');
let server, browser, url;

test.before(async () => {
  server = createServer(async (request, response) => {
    if (request.url === '/') {
      response.setHeader('Content-Type', 'text/html');
      response.end('<!doctype html><html lang="en"><head><title>AADL workspace test</title><link rel="stylesheet" href="/css/aadl-workspace.css"><link rel="stylesheet" href="/css/aadl-diagram.css"></head><body><main><h1>Architecture</h1><div class="aadl-workspace"></div></main></body></html>');
      return;
    }
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (!/^\/(js\/aadl\/|js\/vendor\/elk\/|css\/aadl-)/.test(pathname) || pathname.includes('..')) return response.writeHead(404).end();
    try {
      const content = await readFile(path.join(__dirname, '../..', pathname));
      response.setHeader('Content-Type', pathname.endsWith('.css') ? 'text/css' : 'text/javascript');
      response.end(content);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
});
test.after(async () => { await browser?.close(); await new Promise(resolve => server.close(resolve)); });

async function mount(t) {
  const context = await browser.newContext();
  const page = await context.newPage();
  t.after(() => context.close());
  await page.goto(url);
  await page.evaluate(async () => {
    const { mountAADLView } = await import('/js/aadl/view.mjs');
    window.workspace = mountAADLView(document.querySelector('.aadl-workspace'));
  });
  return page;
}

test('reports the native range and bound with the profile assumptions', async t => {
  const page = await mount(t);
  await page.evaluate(result => window.workspace.render({ phase: 'complete', result, root: 'Rover_Budget::Loop.budget' }), baseline);
  const analysis = page.getByRole('region', { name: 'Latency evidence' });
  await expect(analysis).toContainText('18–22 ms');
  await expect(analysis).toContainText('0–25 ms');
  await expect(analysis).toContainText('Satisfied');
  await expect(analysis).toContainText('explicit budget');
  await expect(page.getByRole('img', { name: /communication/i })).toBeVisible();
});

test('missing input prevents a green claim even when the native tool reports success', async t => {
  const page = await mount(t);
  const missing = structuredClone(baseline);
  missing.model.flows.find(flow => flow.kind === 'path').latency = { present: false };
  missing.analyses[0].results[0].minimumMs = 10;
  missing.analyses[0].results[0].maximumMs = 10;
  await page.evaluate(result => window.workspace.render({ phase: 'complete', result }), missing);
  const analysis = page.getByRole('region', { name: 'Latency evidence' });
  await expect(analysis).toContainText('Inconclusive');
  await expect(analysis).toContainText('10–10 ms');
  await expect(analysis).toContainText('Explicit latency contribution');
  await expect(analysis).not.toContainText('Satisfied');
});

test('invalid edits retain a visibly stale diagram and remove old analysis claims', async t => {
  const page = await mount(t);
  await page.evaluate(result => window.workspace.render({ phase: 'complete', result }), baseline);
  await expect(page.getByRole('img', { name: /communication/i })).toBeVisible();
  await page.evaluate(() => window.workspace.render({ phase: 'invalid', result: { status: 'invalid', diagnostics: [{ severity: 'error', message: 'Unresolved classifier', file: 'Model.aadl', line: 7 }] } }));
  await expect(page.getByText(/Previous model; source changed/)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Latency evidence' })).not.toContainText('Satisfied');
  await expect(page.getByRole('region', { name: 'Model diagnostics' })).toContainText('Unresolved classifier');
});

test('resolved evidence remains accessible in both themes and narrow layouts', async t => {
  const AxeBuilder = require('@axe-core/playwright').default;
  const page = await mount(t);
  await page.setViewportSize({ width: 320, height: 1000 });
  await page.evaluate(result => window.workspace.render({ phase: 'complete', result }), baseline);
  await expect(page.getByRole('img', { name: /communication/i })).toBeVisible();
  for (const dark of [false, true]) {
    await page.evaluate(enabled => document.documentElement.classList.toggle('dark-mode', enabled), dark);
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(audit.violations).toEqual([]);
    const geometry = await page.locator('.aadl-workspace').evaluate(node => ({ width: node.clientWidth, scrollWidth: node.scrollWidth }));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width + 1);
  }
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.aadl-workspace')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.getByText('Asynchronous system: yes', { exact: true })).toBeVisible();
});

test('a completed analysis without end-to-end results explains the missing model element', async t => {
  const page = await mount(t);
  const result = structuredClone(baseline);
  result.analyses = [];
  await page.evaluate(result => window.workspace.render({ phase: 'complete', operation: 'analyze', result }), result);
  await expect(page.getByRole('region', { name: 'Latency evidence' })).toContainText('no end-to-end latency result');
});

test('reanalyzing unchanged source does not claim that the diagram source changed', async t => {
  const page = await mount(t);
  await page.evaluate(result => window.workspace.render({ phase: 'complete', result }), baseline);
  await expect(page.getByRole('img', { name: /communication/i })).toBeVisible();
  await page.evaluate(result => window.workspace.render({ phase: 'analyzing', result, busy: true, stale: false }), baseline);
  await expect(page.getByText(/Previous model; source changed/)).toHaveCount(0);
});
