const { test, expect } = require('@playwright/test');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

let server;
let origin;
const valid = { tokenRules: [{ name: 'N', pattern: '[0-9]+' }], grammar: 'S = N;', source: '42' };

// Serve the real three runtime files. Worker import paths, structured cloning,
// native regex execution and termination are browser behavior, not test doubles.
test.beforeAll(async () => {
  server = http.createServer(async (request, response) => {
    if (request.url === '/') {
      response.setHeader('Content-Type', 'text/html');
      response.end('<!doctype html><title>Compiler worker contract</title><script src="/js/compiler-lab-client.js"></script>');
      return;
    }
    if (!/^\/js\/compiler-lab-(client|worker|core)\.js$/.test(request.url)) {
      response.writeHead(404).end();
      return;
    }
    response.setHeader('Content-Type', 'text/javascript');
    response.end(await fs.readFile(path.join(__dirname, '..', request.url)));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + server.address().port;
});

test.afterAll(async () => {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
});

test('the browser worker preserves all derivations and the core result contract', async ({ page }) => {
  await page.goto(origin);
  const result = await page.evaluate(async config => {
    const client = new window.CompilerLabClient();
    try { return await client.run(config); }
    finally { client.destroy(); }
  }, { ...valid, grammar: 'S = A | B; A = N; B = N;', ast: { inlineRules: ['S', 'A', 'B'] } });
  expect(result.ok).toBe(true);
  expect(result.tokens.map(token => [token.type, token.value])).toEqual([['N', '42']]);
  expect(result.parseTrees).toHaveLength(2);
  expect(result.asts).toHaveLength(1);
  expect(result.astParseTreeIndices).toEqual([[0, 1]]);
  expect(result.diagnostics).toEqual([]);
});

test('replacing, stopping and destroying a run settle it without contaminating the next run', async ({ page }) => {
  await page.goto(origin);
  const results = await page.evaluate(async config => {
    const client = new window.CompilerLabClient();
    const first = client.run(config);
    const replacement = client.run({ ...config, source: '7' });
    const replaced = await first;
    const completed = await replacement;
    const stopped = client.run(config);
    client.cancel();
    const destroyed = client.run(config);
    client.destroy();
    return [replaced, completed, await stopped, await destroyed];
  }, valid);
  expect(results[0].cancelled).toBe(true);
  expect(results[1].ok).toBe(true);
  expect(results[1].tokens[0].value).toBe('7');
  expect(results[2].cancelled).toBe(true);
  expect(results[3].cancelled).toBe(true);
  for (const result of [results[0], results[2], results[3]]) {
    expect(result.ok).toBe(false);
    expect(result.incomplete).toBe(true);
    expect(result.parseTrees).toEqual([]);
  }
});

test('the watchdog terminates a native regex that cannot finish and later compilation still works', async ({ page }) => {
  await page.goto(origin);
  const results = await page.evaluate(async config => {
    const client = new window.CompilerLabClient({ timeoutMs: 250 });
    const timeout = await client.run({ tokenRules: [{ name: 'N', pattern: '(a+)+b' }], grammar: 'S = N;', source: 'a'.repeat(80) });
    client.timeoutMs = 4000;
    const recovered = await client.run(config);
    client.destroy();
    return [timeout, recovered];
  }, valid);
  expect(results[0].ok).toBe(false);
  expect(results[0].incomplete).toBe(true);
  expect(results[0].diagnostics[0].stage).toBe('execution');
  expect(results[0].diagnostics[0].message).toContain('execution limit');
  expect(results[1].ok).toBe(true);
  expect(results[1].tokens[0].value).toBe('42');
});

test('worker startup and uncloneable configuration errors resolve as execution diagnostics', async ({ page }) => {
  await page.goto(origin);
  const results = await page.evaluate(async config => {
    const missing = new window.CompilerLabClient({ workerUrl: '/missing-worker.js' });
    const client = new window.CompilerLabClient();
    const failedStart = await missing.run(config);
    const failedClone = await client.run({ ...config, extra: () => {} });
    const recovered = await client.run(config);
    missing.destroy();
    client.destroy();
    return [failedStart, failedClone, recovered];
  }, valid);
  for (const result of results.slice(0, 2)) {
    expect(result.ok).toBe(false);
    expect(result.incomplete).toBe(true);
    expect(result.diagnostics[0].stage).toBe('execution');
  }
  expect(results[2].ok).toBe(true);
});
