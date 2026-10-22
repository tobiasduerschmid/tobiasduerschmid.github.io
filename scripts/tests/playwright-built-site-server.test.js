const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs/promises');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { before, after, describe, test } = require('node:test');
const { expect } = require('@playwright/test');

const repositoryRoot = path.resolve(__dirname, '../..');

describe('Playwright serving an existing build', { timeout: 30_000 }, () => {
  let directory, server, baseUrl;
  let serverOutput = '';
  const builtPage = '<h1>Previously built tutorial</h1>';
  const image = Buffer.from([0, 1, 2, 3, 254, 255]);

  before(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'sebook-playwright-built-'));
    await fs.mkdir(path.join(directory, '_site', 'tutorial'), { recursive: true });
    await fs.writeFile(path.join(directory, '_config.yml'), 'destination: _site\n');
    await fs.writeFile(path.join(directory, 'tutorial.html'), '---\n---\nREBUILT SOURCE');
    await fs.writeFile(path.join(directory, '_site', 'index.html'), '<h1>Built home</h1>');
    await fs.writeFile(path.join(directory, '_site', 'tutorial.html'), builtPage);
    await fs.writeFile(path.join(directory, '_site', 'tutorial', 'print.html'), '<h1>Print</h1>');
    await fs.writeFile(path.join(directory, '_site', 'image.bin'), image);

    const portProbe = net.createServer();
    portProbe.listen(0, '127.0.0.1');
    await once(portProbe, 'listening');
    const port = portProbe.address().port;
    await new Promise(resolve => portProbe.close(resolve));
    baseUrl = `http://127.0.0.1:${port}`;
    const environment = {
      ...process.env, PLAYWRIGHT_SERVE_BUILT_SITE: '1', JEKYLL_PORT: String(port),
      BUNDLE_GEMFILE: path.join(repositoryRoot, 'Gemfile'),
    };
    const config = spawnSync(process.execPath, ['-e',
      'process.stdout.write(require("./playwright.config.js").webServer.command)',
    ], { cwd: repositoryRoot, env: environment, encoding: 'utf8' });
    assert.equal(config.status, 0, config.stderr);
    // Execute the configured entry point; no HTTP routing or file-serving doubles.
    server = spawn('/bin/sh', ['-c', `exec ${config.stdout}`], {
      cwd: directory, env: environment, stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout.on('data', data => { serverOutput += data; });
    server.stderr.on('data', data => { serverOutput += data; });
    await expect.poll(async () => {
      assert.equal(server.exitCode, null, serverOutput);
      try { return (await fetch(baseUrl, { signal: AbortSignal.timeout(500) })).status; }
      catch { return null; }
    }, { timeout: 20_000, message: 'The configured built-site server must become ready' }).toBe(200);
  });

  after(async () => {
    if (server && server.exitCode === null) {
      const exited = once(server, 'exit');
      server.kill('SIGTERM');
      await exited;
    }
    if (directory) await fs.rm(directory, { recursive: true, force: true });
  });

  test('extensionless tutorial URLs serve HTML beside a print directory', async () => {
    const response = await fetch(`${baseUrl}/tutorial`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /^text\/html/);
    assert.equal(await response.text(), builtPage);
  });

  test('byte-range requests return the requested image bytes', async () => {
    const response = await fetch(`${baseUrl}/image.bin`, { headers: { Range: 'bytes=1-3' } });
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('content-range'), 'bytes 1-3/6');
    assert.equal(response.headers.get('content-length'), '3');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), image.subarray(1, 4));
  });

  test('serving an existing build does not regenerate it from source', async () => {
    const response = await fetch(`${baseUrl}/tutorial.html`);
    assert.equal(await response.text(), builtPage);
    assert.equal(await fs.readFile(path.join(directory, '_site', 'tutorial.html'), 'utf8'), builtPage);
  });
});
