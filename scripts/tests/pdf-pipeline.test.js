const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { generatePDFs } = require('../generate_pdfs');
const {
  addPdfBookmarks,
  mergeTaggedPdfs,
  overlayPdfStamps,
} = require('../merge_pdfs');

const repositoryRoot = path.resolve(__dirname, '../..');

function makeTemporaryDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sebook-pdf-pipeline-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function installArgumentRecorder(directory, executableName) {
  const executablePath = path.join(directory, executableName);
  const source = `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const record = { executable: path.basename(process.argv[1]), args: process.argv.slice(2) };
fs.appendFileSync(process.env.PDF_TOOL_CAPTURE, JSON.stringify(record) + '\\n');
`;
  fs.writeFileSync(executablePath, source, { mode: 0o755 });
}

test('PDF tools receive filenames with shell metacharacters as literal arguments', (t) => {
  const temporaryDirectory = makeTemporaryDirectory(t);
  const capturePath = path.join(temporaryDirectory, 'arguments.jsonl');
  const injectedFilePath = path.join(temporaryDirectory, 'injected-command-ran');
  const originalPath = process.env.PATH;
  const originalCapturePath = process.env.PDF_TOOL_CAPTURE;

  installArgumentRecorder(temporaryDirectory, 'cpdf');
  installArgumentRecorder(temporaryDirectory, 'qpdf');
  process.env.PATH = `${temporaryDirectory}${path.delimiter}${originalPath || ''}`;
  process.env.PDF_TOOL_CAPTURE = capturePath;
  t.after(() => {
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
    if (originalCapturePath === undefined) delete process.env.PDF_TOOL_CAPTURE;
    else process.env.PDF_TOOL_CAPTURE = originalCapturePath;
  });

  const hostilePath = `chapter\"; touch \"${injectedFilePath}\"; #.pdf`;
  const introPath = path.join(temporaryDirectory, `intro 'quoted'.pdf`);
  const outputPath = path.join(temporaryDirectory, 'merged $(substitution).pdf');
  const bookmarksPath = path.join(temporaryDirectory, 'bookmarks & notes.txt');
  const stampsPath = path.join(temporaryDirectory, 'stamps; still-one-argument.pdf');

  mergeTaggedPdfs(introPath, [hostilePath], outputPath);
  addPdfBookmarks(bookmarksPath, outputPath, hostilePath);
  overlayPdfStamps(hostilePath, stampsPath, outputPath);

  const records = fs.readFileSync(capturePath, 'utf8')
    .trim()
    .split('\n')
    .map(line => JSON.parse(line));
  assert.deepEqual(records, [
    {
      executable: 'cpdf',
      args: ['-merge', '-process-struct-trees', introPath, hostilePath, '-o', outputPath],
    },
    {
      executable: 'cpdf',
      args: ['-add-bookmarks', bookmarksPath, outputPath, '-o', hostilePath],
    },
    {
      executable: 'qpdf',
      args: [hostilePath, '--overlay', stampsPath, '--', outputPath],
    },
  ]);
  assert.equal(fs.existsSync(injectedFilePath), false, 'filename content must never execute as a command');
});

test('PDF generation reports every failed page after attempting the batch', async (t) => {
  const temporaryDirectory = makeTemporaryDirectory(t);
  const navPath = path.join(temporaryDirectory, 'nav.yml');
  fs.writeFileSync(navPath, JSON.stringify({
    topics: [{
      name: 'Testing',
      items: [
        { name: 'Broken navigation', url: '/SEBook/broken-navigation.html' },
        { name: 'Broken response', url: '/SEBook/broken-response.html' },
        { name: 'Healthy', url: '/SEBook/healthy.html' },
      ],
    }],
  }));

  const visitedUrls = [];
  const generatedPaths = [];
  let browserClosed = false;
  const page = {
    async goto(url) {
      visitedUrls.push(url);
      if (url.endsWith('/broken-navigation.html')) throw new Error('simulated navigation failure');
      if (url.endsWith('/broken-response.html')) return { status: () => 503 };
      return { status: () => 200 };
    },
    async $() { return null; },
    async evaluate() { return 'Healthy'; },
    async waitForTimeout() {},
    async pdf(options) { generatedPaths.push(options.path); },
  };
  const browserType = {
    async launch() {
      return {
        async newPage() { return page; },
        async close() { browserClosed = true; },
      };
    },
  };

  await assert.rejects(
    generatePDFs({
      browserType,
      navPath,
      outputDir: temporaryDirectory,
      baseUrl: 'https://example.test',
    }),
    error => {
      assert.equal(error instanceof AggregateError, true);
      assert.equal(error.errors.length, 2);
      assert.match(error.errors[0].message, /broken-navigation\.html: simulated navigation failure/);
      assert.match(error.errors[1].message, /broken-response\.html: Received HTTP 503/);
      return true;
    },
  );
  assert.deepEqual(visitedUrls, [
    'https://example.test/SEBook/broken-navigation.html',
    'https://example.test/SEBook/broken-response.html',
    'https://example.test/SEBook/healthy.html',
  ]);
  assert.deepEqual(generatedPaths, [path.join(temporaryDirectory, 'healthy.pdf')]);
  assert.equal(browserClosed, true);
});

test('unsupported merge identifiers fail the command without evaluating their contents', (t) => {
  const temporaryDirectory = makeTemporaryDirectory(t);
  const injectedFilePath = path.join(temporaryDirectory, 'injected-command-ran');
  const hostileBook = `../../unknown\"; touch \"${injectedFilePath}\"; #`;

  const result = spawnSync(
    process.execPath,
    [path.join(repositoryRoot, 'scripts/merge_pdfs.js'), hostileBook],
    { cwd: repositoryRoot, encoding: 'utf8' },
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unsupported book/);
  assert.equal(fs.existsSync(injectedFilePath), false, 'book identifier must never execute as a command');
});

test('prototype property names are not accepted as book identifiers', () => {
  const result = spawnSync(
    process.execPath,
    [path.join(repositoryRoot, 'scripts/merge_pdfs.js'), '__proto__'],
    { cwd: repositoryRoot, encoding: 'utf8' },
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unsupported book/);
});

test('an explicitly empty book identifier is rejected', () => {
  const result = spawnSync(
    process.execPath,
    [path.join(repositoryRoot, 'scripts/merge_pdfs.js'), ''],
    { cwd: repositoryRoot, encoding: 'utf8' },
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unsupported book/);
});

test('fatal PDF generation errors produce a nonzero command exit', (t) => {
  const temporaryDirectory = makeTemporaryDirectory(t);
  const preloadPath = path.join(temporaryDirectory, 'fail-playwright-launch.js');
  fs.writeFileSync(preloadPath, `
const Module = require('node:module');
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '@playwright/test') {
    return { chromium: { launch: async () => { throw new Error('forced browser launch failure'); } } };
  }
  return originalLoad.call(this, request, parent, isMain);
};
`);

  const result = spawnSync(
    process.execPath,
    ['--require', preloadPath, path.join(repositoryRoot, 'scripts/generate_pdfs.js')],
    { cwd: repositoryRoot, encoding: 'utf8' },
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /PDF generation failed/);
  assert.match(result.stderr, /forced browser launch failure/);
});
