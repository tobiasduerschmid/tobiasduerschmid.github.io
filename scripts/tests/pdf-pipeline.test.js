const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { chromium } = require('@playwright/test');
const {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFString,
} = require('pdf-lib');

const { generatePDFs } = require('../generate_pdfs');
const {
  addPdfBookmarks,
  assertExpectedChapterPdfs,
  createIntroHtml,
  expectedChapterPdfEntries,
  mergeTaggedPdfs,
  overlayPdfStamps,
  rewriteTocPlaceholderLinks,
  tocPlaceholderUrl,
} = require('../merge_pdfs');
const {
  chapterPdfFilename,
  configuredNavPaths,
} = require('../pdf-pipeline-config');
const { assertPdfToolsAvailable } = require('../pdf-tools');

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

test('PDF generation covers the ordered union of every configured book navigation', async (t) => {
  const temporaryDirectory = makeTemporaryDirectory(t);
  const dataDirectory = path.join(temporaryDirectory, '_data');
  const outputDirectory = path.join(temporaryDirectory, 'pdfs');
  fs.mkdirSync(dataDirectory, { recursive: true });

  const navPaths = configuredNavPaths(temporaryDirectory);
  const navEntries = [
    [
      { name: 'Shared', url: '/SEBook/shared.html' },
      { name: 'SE Book only', url: '/SEBook/sebook-only.html' },
    ],
    [
      { name: 'Shared course page', url: '/SEBook/shared.html' },
      { name: 'CS35L only', url: '/SEBook/cs35l-only.html' },
    ],
    [
      { name: 'CS130 only', url: '/SEBook/cs130-only.html' },
    ],
  ];
  navPaths.forEach((navPath, index) => {
    fs.writeFileSync(navPath, JSON.stringify({
      topics: [{ name: `Book ${index + 1}`, items: navEntries[index] }],
    }));
  });

  const visitedUrls = [];
  const generatedPaths = [];
  let browserClosed = false;
  const page = {
    async goto(url) {
      visitedUrls.push(url);
      return { status: () => 200 };
    },
    async $() { return null; },
    async evaluate() { return { pdfPath: null, title: 'Rendered title' }; },
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

  await generatePDFs({
    browserType,
    navPaths,
    outputDir: outputDirectory,
    baseUrl: 'https://example.test',
    siteDirectory: path.join(temporaryDirectory, 'intentionally-missing-site'),
  });

  const expectedUrls = [
    '/SEBook/shared.html',
    '/SEBook/sebook-only.html',
    '/SEBook/cs35l-only.html',
    '/SEBook/cs130-only.html',
  ];
  assert.deepEqual(visitedUrls, expectedUrls.map(url => `https://example.test${url}`));
  assert.deepEqual(
    generatedPaths,
    expectedUrls.map(url => path.join(outputDirectory, chapterPdfFilename(url))),
  );
  assert.equal(browserClosed, true);
});

test('PDF headers escape navigation categories and rendered page titles', async (t) => {
  const temporaryDirectory = makeTemporaryDirectory(t);
  const navPath = path.join(temporaryDirectory, 'nav.yml');
  const category = 'Safety <script>alert("&")</script>';
  const pageTitle = 'A "quoted" & <img src=x onerror=alert(1)> \'title\'';
  fs.writeFileSync(navPath, JSON.stringify({
    topics: [{
      name: category,
      items: [{ name: 'Hostile metadata', url: '/SEBook/hostile.html' }],
    }],
  }));

  let headerTemplate;
  const page = {
    async evaluate() { return { pdfPath: null, title: pageTitle }; },
    async goto() { return { status: () => 200 }; },
    async pdf(options) { headerTemplate = options.headerTemplate; },
    async waitForTimeout() {},
  };
  const browserType = {
    async launch() {
      return {
        async close() {},
        async newPage() { return page; },
      };
    },
  };

  await generatePDFs({
    baseUrl: 'https://example.test',
    browserType,
    navPath,
    outputDir: temporaryDirectory,
  });

  assert.match(
    headerTemplate,
    /Safety &lt;script&gt;alert\(&quot;&amp;&quot;\)&lt;\/script&gt;/,
  );
  assert.match(
    headerTemplate,
    /A &quot;quoted&quot; &amp; &lt;img src=x onerror=alert\(1\)&gt; &#39;title&#39;/,
  );
  assert.equal(headerTemplate.includes(category), false);
  assert.equal(headerTemplate.includes(pageTitle), false);
});

test('PDF intro puts a readable, aligned table of contents directly after its title', async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());

  await page.setContent(createIntroHtml({
    book: 'Test Book',
    dateLabel: 'July 2026',
    tocData: [{
      category: 'Software Architecture',
      name: 'Architectural Tactics for Reliable Distributed Systems',
      page: 1029,
    }],
  }));

  const layout = await page.evaluate(() => {
    const dots = document.querySelector('.toc-dots');
    const name = document.querySelector('.toc-name');
    const pageNumber = document.querySelector('.toc-page');
    const pageRule = Array.from(document.styleSheets)
      .flatMap(styleSheet => Array.from(styleSheet.cssRules))
      .find(rule => rule.constructor.name === 'CSSPageRule');
    return {
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      dotsFlexGrow: getComputedStyle(dots).flexGrow,
      dotsWidth: dots.getBoundingClientRect().width,
      fontSize: getComputedStyle(document.querySelector('.toc-item')).fontSize,
      nameRight: name.getBoundingClientRect().right,
      pageBackground: pageRule ? pageRule.style.backgroundColor : '',
      pageNumberLeft: pageNumber.getBoundingClientRect().left,
      rootBackground: getComputedStyle(document.documentElement).backgroundColor,
    };
  });

  assert.equal(layout.pageBackground, 'rgb(255, 255, 255)');
  assert.equal(layout.rootBackground, 'rgb(255, 255, 255)');
  assert.equal(layout.bodyBackground, 'rgb(255, 255, 255)');
  assert.equal(layout.fontSize, '16px');
  assert.equal(layout.dotsFlexGrow, '1');
  assert.equal(layout.dotsWidth >= 16, true);
  assert.equal(layout.pageNumberLeft - layout.nameRight >= 16, true);

  const pdfBytes = await page.pdf({
    format: 'Letter',
    printBackground: true,
    tagged: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  const document = await PDFDocument.load(pdfBytes);
  assert.equal(document.getPageCount(), 2, 'title and ToC should occupy consecutive pages');
});

test('PDF merge validation reports every missing chapter before merging', (t) => {
  const temporaryDirectory = makeTemporaryDirectory(t);
  const navPath = path.join(temporaryDirectory, 'nav.yml');
  const pdfsDirectory = path.join(temporaryDirectory, 'pdfs');
  fs.mkdirSync(pdfsDirectory);
  fs.writeFileSync(navPath, JSON.stringify({
    topics: [{
      name: 'Testing',
      items: [
        { name: 'Present', url: '/SEBook/present.html' },
        { name: 'Missing one', url: '/SEBook/missing-one.html' },
        { name: 'Missing two', url: '/SEBook/missing-two.html' },
      ],
    }],
  }));
  fs.writeFileSync(path.join(pdfsDirectory, chapterPdfFilename('/SEBook/present.html')), 'present');

  const entries = expectedChapterPdfEntries(navPath, pdfsDirectory);
  assert.throws(
    () => assertExpectedChapterPdfs(entries, 'Test Book'),
    error => {
      assert.equal(error instanceof AggregateError, true);
      assert.equal(error.errors.length, 2);
      assert.match(error.message, /2 expected chapter PDFs are missing/);
      assert.equal(error.message.includes('/SEBook/missing-one.html'), true);
      assert.equal(error.message.includes('/SEBook/missing-two.html'), true);
      assert.equal(error.message.includes('/SEBook/present.html'), false);
      assert.match(error.message, /Run npm run pdf/);
      return true;
    },
  );
});

test('each ToC entry keeps its own valid in-document PDF destination', async () => {
  const document = await PDFDocument.create();
  const tocPage = document.addPage([612, 792]);
  document.addPage([612, 792]);
  document.addPage([612, 792]);

  const annotationRefs = [
    tocPlaceholderUrl(0),
    tocPlaceholderUrl(1),
    'https://example.test/unrelated',
  ].map((uri, index) => {
    const action = document.context.obj({
      Type: 'Action',
      S: 'URI',
      URI: PDFString.of(uri),
    });
    const annotation = document.context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [50, 700 - (index * 30), 550, 720 - (index * 30)],
      Border: [0, 0, 0],
      A: action,
    });
    return document.context.register(annotation);
  });
  tocPage.node.set(PDFName.of('Annots'), document.context.obj(annotationRefs));

  const rewritten = rewriteTocPlaceholderLinks(document, [
    { name: 'First', page: 1 },
    { name: 'Second', page: 2 },
  ], 1);
  assert.equal(rewritten, 2);

  const reloaded = await PDFDocument.load(await document.save());
  const annotations = reloaded.getPage(0).node.lookup(PDFName.of('Annots'), PDFArray);
  assert.equal(annotations.size(), 3, 'links on the same ToC page must accumulate');

  const pageRefs = new Set(reloaded.getPages().map(page => page.ref.toString()));
  for (let index = 0; index < 2; index += 1) {
    const annotation = annotations.lookup(index, PDFDict);
    const action = annotation.lookup(PDFName.of('A'), PDFDict);
    assert.equal(action.lookup(PDFName.of('S'), PDFName).toString(), '/GoTo');
    assert.equal(action.has(PDFName.of('URI')), false);
    const destination = action.lookup(PDFName.of('D'), PDFArray);
    const targetRef = destination.get(0);
    assert.equal(pageRefs.has(targetRef.toString()), true, 'destination must reference a page in this PDF');
    assert.equal(targetRef.toString(), reloaded.getPage(index + 1).ref.toString());
  }

  const unrelatedAction = annotations
    .lookup(2, PDFDict)
    .lookup(PDFName.of('A'), PDFDict);
  assert.equal(
    unrelatedAction.lookup(PDFName.of('URI'), PDFString).decodeText(),
    'https://example.test/unrelated',
  );
});

test('PDF tool preflight names every unavailable executable with platform guidance', () => {
  const invoked = [];
  const run = (command, args) => {
    invoked.push([command, args]);
    if (command === 'qpdf') return { status: null, error: { code: 'ENOENT' } };
    return { status: 0 };
  };

  assert.throws(
    () => assertPdfToolsAvailable({ run, platform: 'linux' }),
    error => {
      assert.match(error.message, /qpdf is unavailable/);
      assert.doesNotMatch(error.message, /cpdf is unavailable/);
      assert.match(error.message, /Linux:/);
      assert.match(error.message, /Coherent PDF CLI/);
      return true;
    },
  );
  assert.deepEqual(invoked, [
    ['cpdf', ['-version']],
    ['qpdf', ['--version']],
  ]);
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
    async evaluate() { return { pdfPath: null, title: 'Healthy' }; },
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
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: { ...process.env, PDF_BASE_URL: 'https://example.test' },
    },
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /PDF generation failed/);
  assert.match(result.stderr, /forced browser launch failure/);
});
