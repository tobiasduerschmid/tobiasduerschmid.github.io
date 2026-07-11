const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

async function generatePDFs({
  browserType = chromium,
  navPath = path.join(__dirname, '../_data/sebook_nav.yml'),
  outputDir = path.join(__dirname, '../pdfs'),
  baseUrl = 'http://localhost:4000',
} = {}) {
  // Load navigation to find all SEBook pages
  const navContent = fs.readFileSync(navPath, 'utf8');
  const nav = yaml.load(navContent);

  const urls = [];

  /**
   * Recursively extract URLs from nav while preserving the top-level category
   * @param {Array} items - Nav items to process
   * @param {string} category - The top-level topic name (e.g., "Tools", "Testing")
   */
  function extractUrls(items, category = '') {
    if (!items) return;
    items.forEach(item => {
      // If we are at the top level (no category inherited), use this item's name as the category
      const currentCategory = category || item.name;

      if (item.url && item.url.startsWith('/SEBook/')) {
        urls.push({
          url: item.url,
          topicName: item.name,
          category: currentCategory
        });
      }
      if (item.subtopics) extractUrls(item.subtopics, currentCategory);
      if (item.items) extractUrls(item.items, currentCategory);
    });
  }

  extractUrls(nav.topics);

  // Unique URLs only
  const uniqueUrls = urls.filter((v, i, a) => a.findIndex(t => t.url === v.url) === i);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Starting High-Quality PDF generation for ${uniqueUrls.length} pages...`);

  const failures = [];
  const browser = await browserType.launch();
  try {
    const page = await browser.newPage();

    for (const entry of uniqueUrls) {
      const { url, topicName, category } = entry;
      const fullUrl = `${baseUrl}${url}`;
      const filename = url.replace(/\/SEBook\//, '').replace(/\//g, '_').replace('.html', '') + '.pdf';
      const outputPath = path.join(outputDir, filename);

      console.log(`Generating: ${filename} from ${fullUrl}`);

      try {
        let renderedUrl = fullUrl;
        let response = await page.goto(renderedUrl, { waitUntil: 'networkidle', timeout: 60000 });

        // If the page declares a pdf-url meta tag, use that URL for PDF generation instead
        const pdfUrlMeta = await page.$('meta[name="pdf-url"]');
        if (pdfUrlMeta) {
          const pdfPath = await pdfUrlMeta.getAttribute('content');
          if (!pdfPath) {
            throw new Error(`The pdf-url meta tag for ${url} has no content.`);
          }
          const separator = pdfPath.includes('?') ? '&' : '?';
          renderedUrl = `${baseUrl}${pdfPath}${separator}instructor-mode=true`;
          console.log(`  Using print URL: ${renderedUrl}`);
          response = await page.goto(renderedUrl, { waitUntil: 'networkidle', timeout: 60000 });
        }

        if (!response) {
          throw new Error(`Navigation to ${renderedUrl} produced no HTTP response.`);
        }
        const status = response.status();
        if (status !== 200) {
          throw new Error(`Received HTTP ${status} for ${renderedUrl}.`);
        }

        // Extract the Page Title (h1) to use as the right header
        // We look for .post-title or the first H1 in #main-content
        const displayPageTitle = await page.evaluate(() => {
          const h1 = document.querySelector('#main-content h1, .post-title, h1');
          return h1 ? h1.innerText.trim() : document.title.split('|')[0].trim();
        });

        console.log(`  Category: "${category}", Topic: "${topicName}", Page Title: "${displayPageTitle}"`);

        // We wait a bit to ensure styles are applied
        await page.waitForTimeout(500);

        await page.pdf({
          path: outputPath,
          format: 'Letter',
          printBackground: true,
          displayHeaderFooter: true,
          tagged: true, // Generate tagged (accessible) PDF
          headerTemplate: `
            <div style="font-size: 12pt; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; width: 100%; margin: 0 2cm; padding-bottom: 5px; border-bottom: 0.5px solid #eee; display: flex; justify-content: space-between; -webkit-print-color-adjust: exact;">
              <span style="font-weight: 700; color: #2774AE;">${category}</span>
              <span style="font-weight: 400; color: #000000; text-align: right; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; margin-left: 20px;">${displayPageTitle}</span>
            </div>`,
          footerTemplate: ` `,
          margin: {
            top: '2cm',
            right: '2cm',
            bottom: '2cm',
            left: '2cm'
          }
        });
      } catch (error) {
        const failure = new Error(`Failed to generate PDF for ${url}: ${error.message}`, { cause: error });
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
      `Failed to generate ${failures.length} of ${uniqueUrls.length} PDFs.`,
    );
  }

  console.log('High-Quality PDF generation complete! Check the /pdfs directory.');
}

if (require.main === module) {
  generatePDFs().catch(error => {
    console.error('PDF generation failed:', error);
    process.exitCode = 1;
  });
}

module.exports = { generatePDFs };
