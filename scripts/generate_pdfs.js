const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

async function generatePDFs() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Load navigation to find all SEBook pages
  const navPath = path.join(__dirname, '../_data/sebook_nav.yml');
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

  const outputDir = path.join(__dirname, '../pdfs');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`Starting High-Quality PDF generation for ${uniqueUrls.length} pages...`);

  for (const entry of uniqueUrls) {
    const { url, topicName, category } = entry;
    const fullUrl = `http://localhost:4000${url}`;
    const filename = url.replace(/\/SEBook\//, '').replace(/\//g, '_').replace('.html', '') + '.pdf';
    const outputPath = path.join(outputDir, filename);

    console.log(`Generating: ${filename} from ${fullUrl}`);

    try {
      const response = await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 60000 });
      const status = response.status();
      const pageTitle = await page.title();

      if (status !== 200) {
        console.error(`Warning: Received status ${status} for ${fullUrl} - PDF might be incorrect.`);
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
      console.error(`Failed to generate PDF for ${url}:`, error.message);
    }
  }

  await browser.close();
  console.log('High-Quality PDF generation complete! Check the /pdfs directory.');
}

generatePDFs().catch(console.error);
