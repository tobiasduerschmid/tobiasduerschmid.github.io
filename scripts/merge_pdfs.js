const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { chromium } = require('@playwright/test');

async function mergePDFs() {
  console.log('Starting Unified SEBook PDF merge...');
  
  const navPath = path.join(__dirname, '../_data/sebook_nav.yml');
  const navContent = fs.readFileSync(navPath, 'utf8');
  const nav = yaml.load(navContent);
  
  const pdfsDir = path.join(__dirname, '../pdfs');
  const outputPath = path.join(pdfsDir, 'SEBook_Full.pdf');
  
  const mergedPdf = await PDFDocument.create();
  const tocEntries = [];

  // 1. Identify all individual PDFs in order
  const pdfEntries = [];
  function extractPdfEntries(items, category = '') {
    if (!items) return;
    items.forEach(item => {
      const currentCategory = category || item.name;
      if (item.url && item.url.startsWith('/SEBook/')) {
        const filename = item.url.replace(/\/SEBook\//, '').replace(/\//g, '_').replace('.html', '') + '.pdf';
        const filePath = path.join(pdfsDir, filename);
        if (fs.existsSync(filePath)) {
          pdfEntries.push({
            path: filePath,
            name: item.name,
            category: currentCategory
          });
        }
      }
      if (item.subtopics) extractPdfEntries(item.subtopics, currentCategory);
      if (item.items) extractPdfEntries(item.items, currentCategory);
    });
  }
  extractPdfEntries(nav.topics);

  // Filter unique paths to avoid duplicates
  const uniquePdfEntries = pdfEntries.filter((v, i, a) => a.findIndex(t => t.path === v.path) === i);

  // 2. Pre-calculate page counts to build TOC
  // We'll estimate TOC takes 2 pages. Title is 1.
  let tocPageCount = 2; 
  let runningPageNumber = 1 + tocPageCount + 1; // Title(1) + TOC(2)

  for (const entry of uniquePdfEntries) {
    const bytes = fs.readFileSync(entry.path);
    const doc = await PDFDocument.load(bytes);
    const count = doc.getPageCount();
    tocEntries.push({
      name: entry.name,
      category: entry.category,
      page: runningPageNumber
    });
    runningPageNumber += count;
  }

  // 3. Generate Title Page & TOC using Playwright
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // 2cm in pixels (approx) for Playwright if needed, but we'll use CSS margins
  const tocHtml = `
    <html>
      <head>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
          @page { margin: 2cm; }
          body { font-family: 'Inter', -apple-system, sans-serif; color: #333; margin: 0; padding: 0; }
          
          .title-page { 
            height: 9in; 
            display: flex; 
            flex-direction: column; 
            justify-content: center; 
            align-items: center; 
            text-align: center;
          }
          .title-page h1 { font-size: 54pt; color: #2774AE; margin-bottom: 0; font-weight: 700; }
          .title-page .subtitle { font-size: 24pt; color: #666; font-weight: 400; margin-top: 10px; }
          .title-page .author { margin-top: 100px; font-size: 18pt; color: #333; font-weight: 600; }
          .title-page .date { margin-top: 10px; font-size: 12pt; color: #999; }
          
          .toc-container { page-break-before: always; padding-top: 20px; }
          .toc-header { font-size: 32pt; font-weight: 700; color: #2774AE; margin-bottom: 40px; border-bottom: 4px solid #FFD100; padding-bottom: 15px; }
          .toc-category-group { margin-bottom: 30px; }
          .toc-category-title { font-size: 16pt; font-weight: 700; color: #2774AE; background: #f8f9fa; padding: 8px 15px; border-radius: 8px; margin-bottom: 15px; }
          .toc-item { display: flex; align-items: baseline; margin-bottom: 10px; padding: 0 15px; font-size: 12pt; }
          .toc-name { font-weight: 500; color: #444; }
          .toc-dots { flex-grow: 1; border-bottom: 1px dotted #ccc; margin: 0 10px; position: relative; top: -4px; }
          .toc-page { font-weight: 700; color: #2774AE; min-width: 30px; text-align: right; }
        </style>
      </head>
      <body>
        <div class="title-page">
          <h1>SEBook</h1>
          <div class="subtitle">Software Engineering Handbook</div>
          <div class="author">Tobias Dürschmid</div>
          <div class="date">Full Collection • ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
        </div>
        
        <div class="toc-container">
          <div class="toc-header">Table of Contents</div>
          ${Array.from(new Set(tocEntries.map(e => e.category))).map(cat => `
            <div class="toc-category-group">
              <div class="toc-category-title">${cat}</div>
              ${tocEntries.filter(e => e.category === cat).map(e => `
                <div class="toc-item">
                  <span class="toc-name">${e.name}</span>
                  <span class="toc-dots"></span>
                  <span class="toc-page">${e.page}</span>
                </div>
              `).join('')}
            </div>
          `).join('')}
        </div>
      </body>
    </html>
  `;

  await page.setContent(tocHtml);
  // Set margin to 0 for Playwright because we handle it in @page CSS
  const introPdfBytes = await page.pdf({ 
    format: 'Letter', 
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });
  await browser.close();

  // 4. Merge everything
  const introDoc = await PDFDocument.load(introPdfBytes);
  const introPages = await mergedPdf.copyPages(introDoc, introDoc.getPageIndices());
  introPages.forEach(p => mergedPdf.addPage(p));

  console.log(`Merging ${uniquePdfEntries.length} individual PDFs...`);
  for (const entry of uniquePdfEntries) {
    const bytes = fs.readFileSync(entry.path);
    const doc = await PDFDocument.load(bytes);
    const pages = await mergedPdf.copyPages(doc, doc.getPageIndices());
    pages.forEach(p => mergedPdf.addPage(p));
  }

  // 5. Add Global Page Numbers (Bottom Right)
  const helveticaFont = await mergedPdf.embedFont(StandardFonts.HelveticaBold);
  const totalPages = mergedPdf.getPageCount();
  const allPages = mergedPdf.getPages();
  
  // 2cm in points (approx 56.7pt)
  const marginPt = 56.7; 

  for (let i = 0; i < totalPages; i++) {
    const page = allPages[i];
    const { width, height } = page.getSize();
    const pageNumText = `${i + 1} / ${totalPages}`;
    const fontSize = 10;
    const textWidth = helveticaFont.widthOfTextAtSize(pageNumText, fontSize);
    
    page.drawText(pageNumText, {
      x: width - marginPt - textWidth,
      y: marginPt / 2, // Slightly higher than the absolute edge
      size: fontSize,
      font: helveticaFont,
      color: rgb(0.4, 0.4, 0.4),
    });
  }

  const finalPdfBytes = await mergedPdf.save();
  fs.writeFileSync(outputPath, finalPdfBytes);
  
  console.log(`Success! Unified PDF created at: ${outputPath}`);
}

mergePDFs().catch(console.error);
