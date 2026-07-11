const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const {
  chapterPdfFilename,
  configuredNavPaths,
  loadUniqueChapterEntries,
} = require('./pdf-pipeline-config');
const { escapeHtml } = require('./pdf-html');
const { startLocalSiteServer } = require('./local-site-server');

async function readPageMetadata(page) {
  return page.evaluate(() => {
    const pdfUrlMeta = document.querySelector('meta[name="pdf-url"]');
    const h1 = document.querySelector('#main-content h1, .post-title, h1');
    return {
      pdfPath: pdfUrlMeta ? pdfUrlMeta.getAttribute('content') : null,
      title: h1 ? h1.innerText.trim() : document.title.split('|')[0].trim(),
    };
  });
}

function pdfHeaderTemplate(category, pageTitle) {
  return `
    <div style="font-size: 12pt; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; width: 100%; margin: 0 2cm; padding-bottom: 5px; border-bottom: 0.5px solid #eee; display: flex; justify-content: space-between; -webkit-print-color-adjust: exact;">
      <span style="font-weight: 700; color: #2774AE;">${escapeHtml(category)}</span>
      <span style="font-weight: 400; color: #000000; text-align: right; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; margin-left: 20px;">${escapeHtml(pageTitle)}</span>
    </div>`;
}

async function generateChapterPdf(page, entry, { baseUrl, outputDir }) {
  const { url, topicName, category } = entry;
  const fullUrl = `${baseUrl}${url}`;
  const filename = chapterPdfFilename(url);
  const outputPath = path.join(outputDir, filename);

  console.log(`Generating: ${filename} from ${fullUrl}`);

  let renderedUrl = fullUrl;
  let response = await page.goto(renderedUrl, { waitUntil: 'networkidle', timeout: 60000 });
  let pageMetadata = await readPageMetadata(page);

  if (pageMetadata.pdfPath !== null) {
    const pdfPath = pageMetadata.pdfPath;
    if (!pdfPath) {
      throw new Error(`The pdf-url meta tag for ${url} has no content.`);
    }
    const separator = pdfPath.includes('?') ? '&' : '?';
    renderedUrl = `${baseUrl}${pdfPath}${separator}instructor-mode=true`;
    console.log(`  Using print URL: ${renderedUrl}`);
    response = await page.goto(renderedUrl, { waitUntil: 'networkidle', timeout: 60000 });
    pageMetadata = await readPageMetadata(page);
  }

  if (!response) {
    throw new Error(`Navigation to ${renderedUrl} produced no HTTP response.`);
  }
  const status = response.status();
  if (status !== 200) {
    throw new Error(`Received HTTP ${status} for ${renderedUrl}.`);
  }

  const displayPageTitle = pageMetadata.title;
  console.log(`  Category: "${category}", Topic: "${topicName}", Page Title: "${displayPageTitle}"`);

  // Give client-rendered diagrams and delayed print styles a bounded settling
  // interval after the network becomes idle.
  await page.waitForTimeout(500);

  await page.pdf({
    path: outputPath,
    format: 'Letter',
    printBackground: true,
    displayHeaderFooter: true,
    tagged: true,
    headerTemplate: pdfHeaderTemplate(category, displayPageTitle),
    footerTemplate: ' ',
    margin: {
      top: '2cm',
      right: '2cm',
      bottom: '2cm',
      left: '2cm',
    },
  });
}

async function generatePdfBatch({ browserType, entries, outputDir, baseUrl }) {
  const failures = [];
  const browser = await browserType.launch();
  try {
    // PDF generation reads static server-rendered pages. Blocking service
    // workers prevents COI-enabled tutorials from replacing the document while
    // metadata is being inspected; the print route itself does not need COI.
    const page = await browser.newPage({ serviceWorkers: 'block' });

    for (const entry of entries) {
      try {
        await generateChapterPdf(page, entry, { baseUrl, outputDir });
      } catch (error) {
        const failure = new Error(
          `Failed to generate PDF for ${entry.url}: ${error.message}`,
          { cause: error },
        );
        failures.push(failure);
        console.error(failure.message);
      }
    }
  } finally {
    await browser.close();
  }

  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      `Failed to generate ${failures.length} of ${entries.length} PDFs.`,
    );
  }
}

async function generatePDFs({
  browserType = chromium,
  navPath,
  navPaths,
  outputDir = path.join(__dirname, '../pdfs'),
  baseUrl,
  siteDirectory = path.join(__dirname, '../_site'),
} = {}) {
  if (navPath && navPaths) {
    throw new Error('Pass either navPath or navPaths, not both.');
  }
  const requestedNavPaths = navPaths || (navPath ? [navPath] : configuredNavPaths());
  const uniqueUrls = loadUniqueChapterEntries(requestedNavPaths);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Starting High-Quality PDF generation for ${uniqueUrls.length} pages...`);

  let localSiteServer;
  try {
    let generationBaseUrl = baseUrl;
    if (generationBaseUrl === undefined) {
      localSiteServer = await startLocalSiteServer({ rootDirectory: siteDirectory });
      generationBaseUrl = localSiteServer.baseUrl;
      console.log(`Serving the built site at ${generationBaseUrl}.`);
    }

    await generatePdfBatch({
      browserType,
      entries: uniqueUrls,
      outputDir,
      baseUrl: generationBaseUrl,
    });
  } finally {
    if (localSiteServer) await localSiteServer.close();
  }

  console.log('High-Quality PDF generation complete! Check the /pdfs directory.');
}

if (require.main === module) {
  const cliOptions = process.env.PDF_BASE_URL === undefined
    ? {}
    : { baseUrl: process.env.PDF_BASE_URL };
  generatePDFs(cliOptions).catch(error => {
    console.error('PDF generation failed:', error);
    process.exitCode = 1;
  });
}

module.exports = { generatePDFs };
