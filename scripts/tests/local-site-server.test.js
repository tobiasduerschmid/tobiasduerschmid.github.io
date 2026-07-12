const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { generatePDFs } = require('../generate_pdfs');
const { startLocalSiteServer } = require('../local-site-server');

function makeTemporaryDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sebook-local-site-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function writeFixture(rootDirectory, relativePath, contents) {
  const fixturePath = path.join(rootDirectory, relativePath);
  fs.mkdirSync(path.dirname(fixturePath), { recursive: true });
  fs.writeFileSync(fixturePath, contents);
}

function request(baseUrl, { method = 'GET', requestPath = '/' } = {}) {
  const serverUrl = new URL(baseUrl);
  return new Promise((resolve, reject) => {
    const outgoingRequest = http.request({
      hostname: serverUrl.hostname,
      method,
      path: requestPath,
      port: serverUrl.port,
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({
        body: Buffer.concat(chunks),
        headers: response.headers,
        statusCode: response.statusCode,
      }));
    });
    outgoingRequest.on('error', reject);
    outgoingRequest.end();
  });
}

function requestUrl(url) {
  const target = new URL(url);
  return request(target.origin, { requestPath: `${target.pathname}${target.search}` });
}

function writeSinglePageNavigation(directory, pageUrl) {
  const navPath = path.join(directory, 'nav.yml');
  fs.writeFileSync(navPath, JSON.stringify({
    topics: [{
      name: 'Testing',
      items: [{ name: 'Local page', url: pageUrl }],
    }],
  }));
  return navPath;
}

function fakeBrowserFor({ goto, title = 'Local page' }) {
  let browserClosed = false;
  const page = {
    async evaluate() { return { pdfPath: null, title }; },
    goto,
    async pdf() {},
    async waitForTimeout() {},
  };
  return {
    browserType: {
      async launch() {
        return {
          async close() { browserClosed = true; },
          async newPage() { return page; },
        };
      },
    },
    wasBrowserClosed: () => browserClosed,
  };
}

test('local site server resolves Jekyll routes with correct MIME and HEAD behavior', async (t) => {
  const temporaryDirectory = makeTemporaryDirectory(t);
  const siteDirectory = path.join(temporaryDirectory, '_site');
  writeFixture(siteDirectory, 'SEBook/topic.html', '<h1>Topic</h1>');
  writeFixture(siteDirectory, 'tutorial/print/index.html', '<h1>Print tutorial</h1>');
  writeFixture(siteDirectory, 'assets/site.css', 'body { color: black; }');
  writeFixture(siteDirectory, 'assets/runtime.js', 'globalThis.ready = true;');

  const server = await startLocalSiteServer({ rootDirectory: siteDirectory });
  t.after(() => server.close());

  const extensionlessPage = await request(server.baseUrl, {
    requestPath: '/SEBook/topic?instructor-mode=true',
  });
  assert.equal(extensionlessPage.statusCode, 200);
  assert.equal(extensionlessPage.headers['content-type'], 'text/html; charset=utf-8');
  assert.equal(extensionlessPage.body.toString(), '<h1>Topic</h1>');

  const directoryIndex = await request(server.baseUrl, { requestPath: '/tutorial/print/' });
  assert.equal(directoryIndex.statusCode, 200);
  assert.equal(directoryIndex.body.toString(), '<h1>Print tutorial</h1>');

  const stylesheetHead = await request(server.baseUrl, {
    method: 'HEAD',
    requestPath: '/assets/site.css',
  });
  assert.equal(stylesheetHead.statusCode, 200);
  assert.equal(stylesheetHead.headers['content-type'], 'text/css; charset=utf-8');
  assert.equal(stylesheetHead.headers['content-length'], String(Buffer.byteLength('body { color: black; }')));
  assert.equal(stylesheetHead.body.length, 0);

  const script = await request(server.baseUrl, { requestPath: '/assets/runtime.js' });
  assert.equal(script.headers['content-type'], 'text/javascript; charset=utf-8');
});

test('local site server rejects unsafe paths and unsupported methods', async (t) => {
  const temporaryDirectory = makeTemporaryDirectory(t);
  const siteDirectory = path.join(temporaryDirectory, '_site');
  writeFixture(siteDirectory, 'index.html', '<h1>Home</h1>');
  writeFixture(temporaryDirectory, 'outside.txt', 'must stay private');

  const server = await startLocalSiteServer({ rootDirectory: siteDirectory });
  t.after(() => server.close());

  const traversal = await request(server.baseUrl, {
    requestPath: '/%2e%2e%2foutside.txt',
  });
  assert.equal(traversal.statusCode, 403);
  assert.equal(traversal.body.includes(Buffer.from('must stay private')), false);

  const malformedPath = await request(server.baseUrl, { requestPath: '/%E0%A4%A' });
  assert.equal(malformedPath.statusCode, 400);

  const unsupportedMethod = await request(server.baseUrl, { method: 'POST' });
  assert.equal(unsupportedMethod.statusCode, 405);
  assert.equal(unsupportedMethod.headers.allow, 'GET, HEAD');

  const missing = await request(server.baseUrl, { requestPath: '/missing.html' });
  assert.equal(missing.statusCode, 404);
});

test('local site server does not follow symlinks outside the built site', async (t) => {
  const temporaryDirectory = makeTemporaryDirectory(t);
  const siteDirectory = path.join(temporaryDirectory, '_site');
  const outsidePath = path.join(temporaryDirectory, 'outside.txt');
  writeFixture(siteDirectory, 'index.html', '<h1>Home</h1>');
  fs.writeFileSync(outsidePath, 'must stay private');

  try {
    fs.symlinkSync(outsidePath, path.join(siteDirectory, 'linked.txt'), 'file');
  } catch (error) {
    if (['EACCES', 'ENOSYS', 'EPERM'].includes(error.code)) {
      t.skip(`File symlinks are unavailable on this platform: ${error.code}`);
      return;
    }
    throw error;
  }

  const server = await startLocalSiteServer({ rootDirectory: siteDirectory });
  t.after(() => server.close());

  const response = await request(server.baseUrl, { requestPath: '/linked.txt' });
  assert.equal(response.statusCode, 403);
  assert.equal(response.body.includes(Buffer.from('must stay private')), false);
});

test('local site server reports an actionable error when the site has not been built', async (t) => {
  const missingSiteDirectory = path.join(makeTemporaryDirectory(t), '_site');

  await assert.rejects(
    startLocalSiteServer({ rootDirectory: missingSiteDirectory }),
    error => {
      assert.match(error.message, /Built site directory is unavailable/);
      assert.match(error.message, /Run make build/);
      return true;
    },
  );
});

test('PDF generation serves the built site on an ephemeral loopback port and closes it', async (t) => {
  const temporaryDirectory = makeTemporaryDirectory(t);
  const siteDirectory = path.join(temporaryDirectory, '_site');
  const pageUrl = '/SEBook/local.html';
  const navPath = writeSinglePageNavigation(temporaryDirectory, pageUrl);
  writeFixture(siteDirectory, 'SEBook/local.html', '<h1>Locally served</h1>');

  let visitedUrl;
  let servedBody;
  const browser = fakeBrowserFor({
    async goto(url) {
      visitedUrl = url;
      const response = await requestUrl(url);
      servedBody = response.body.toString();
      return { status: () => response.statusCode };
    },
  });

  await generatePDFs({
    browserType: browser.browserType,
    navPath,
    outputDir: path.join(temporaryDirectory, 'pdfs'),
    siteDirectory,
  });

  const serverUrl = new URL(visitedUrl);
  assert.equal(serverUrl.hostname, '127.0.0.1');
  assert.match(serverUrl.port, /^\d+$/);
  assert.equal(Number(serverUrl.port) > 0, true);
  assert.equal(serverUrl.pathname, pageUrl);
  assert.equal(servedBody, '<h1>Locally served</h1>');
  assert.equal(browser.wasBrowserClosed(), true);
  await assert.rejects(request(serverUrl.origin));
});

test('PDF generation closes its local server when rendering fails', async (t) => {
  const temporaryDirectory = makeTemporaryDirectory(t);
  const siteDirectory = path.join(temporaryDirectory, '_site');
  const pageUrl = '/SEBook/broken.html';
  const navPath = writeSinglePageNavigation(temporaryDirectory, pageUrl);
  writeFixture(siteDirectory, 'SEBook/broken.html', '<h1>Broken</h1>');

  let visitedUrl;
  const browser = fakeBrowserFor({
    async goto(url) {
      visitedUrl = url;
      const response = await requestUrl(url);
      assert.equal(response.statusCode, 200);
      throw new Error('simulated rendering failure');
    },
  });

  await assert.rejects(
    generatePDFs({
      browserType: browser.browserType,
      navPath,
      outputDir: path.join(temporaryDirectory, 'pdfs'),
      siteDirectory,
    }),
    error => {
      assert.equal(error instanceof AggregateError, true);
      assert.match(error.message, /Failed to generate 1 of 1 PDFs/);
      return true;
    },
  );

  assert.equal(browser.wasBrowserClosed(), true);
  await assert.rejects(request(new URL(visitedUrl).origin));
});
