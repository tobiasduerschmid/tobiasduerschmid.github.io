const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { chromium } = require('@playwright/test');
const { execSync } = require('child_process');

async function mergePDFs() {
  console.log('Starting Unified SE Book PDF merge (preserving accessibility tags)...');

  const navPath = path.join(__dirname, '../_data/sebook_nav.yml');
  const navContent = fs.readFileSync(navPath, 'utf8');
  const nav = yaml.load(navContent);

  const pdfsDir = path.join(__dirname, '../pdfs');
  const outputPath = path.join(pdfsDir, 'SEBook_Full.pdf');
  const tempMergedPath = path.join(pdfsDir, 'SEBook_Full_base.pdf');
  const stampsPath = path.join(pdfsDir, 'SEBook_Full_stamps.pdf');
  const introPath = path.join(pdfsDir, '_intro.pdf');

  // 1. Identify all individual PDFs in order from nav
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

  const uniquePdfEntries = pdfEntries.filter((v, i, a) => a.findIndex(t => t.path === v.path) === i);
  console.log(`Found ${uniquePdfEntries.length} unique PDF chapters.`);

  // 2. Generate Initial Intro to get page count
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  async function generateIntro(tocData) {
    const categories = Array.from(new Set(tocData.map(e => e.category)));
    const tocHtml = `
      <html>
        <head>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
            @page { margin: 2.5cm; }
            body { font-family: 'Inter', sans-serif; color: #333; margin: 0; padding: 0; line-height: 1.4; }
            .title-page { height: 9.5in; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
            .title-page h1 { font-size: 54pt; color: #2774AE; margin-bottom: 0; font-weight: 700; }
            .title-page .subtitle { font-size: 24pt; color: #666; font-weight: 400; margin-top: 10px; }
            .title-page .author { margin-top: 100px; font-size: 18pt; color: #333; font-weight: 600; }
            .title-page .date { margin-top: 10px; font-size: 12pt; color: #999; }
            .toc-container { page-break-before: always; padding-top: 20px; }
            .toc-header { font-size: 32pt; font-weight: 700; color: #2774AE; margin-bottom: 40px; border-bottom: 4px solid #FFD100; padding-bottom: 15px; }
            .toc-category-group { margin-bottom: 25px; page-break-inside: avoid; }
            .toc-category-title { font-size: 15pt; font-weight: 700; color: #2774AE; background: #f0f4f8; padding: 6px 12px; border-radius: 6px; margin-bottom: 12px; }
            .toc-item { display: flex; align-items: baseline; margin-bottom: 8px; padding: 0 10px; font-size: 11pt; }
            .toc-name { font-weight: 500; color: #444; }
            .toc-dots { flex-grow: 1; border-bottom: 1px dotted #bbb; margin: 0 8px; position: relative; top: -4px; }
            .toc-page { font-weight: 700; color: #2774AE; min-width: 35px; text-align: right; }
          </style>
        </head>
        <body>
          <div class="title-page">
            <h1>SE Book</h1>
            <div class="subtitle">Collection of topics for students in software engineering courses.</div>
            <div class="author">Tobias Dürschmid</div>
            <div class="date">Unified Edition • ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
          </div>
          <div class="toc-container">
            <div class="toc-header">Table of Contents</div>
            ${categories.map(cat => `
              <div class="toc-category-group">
                <div class="toc-category-title">${cat}</div>
                ${tocData.filter(e => e.category === cat).map(e => `
                  <div class="toc-item">
                    <span class="toc-name">${e.name}</span><span class="toc-dots"></span><span class="toc-page">${e.page}</span>
                  </div>
                `).join('')}
              </div>
            `).join('')}
          </div>
        </body>
      </html>
    `;
    await page.setContent(tocHtml);
    await page.pdf({
      path: introPath,
      format: 'Letter',
      printBackground: true,
      tagged: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });
  }

  // Pass 1: Dummy data to get page count
  await generateIntro(uniquePdfEntries.map(e => ({ ...e, page: 1 })));
  const introDoc1 = await PDFDocument.load(fs.readFileSync(introPath));
  const actualIntroPageCount = introDoc1.getPageCount();
  console.log(`Intro generated. Pages: ${actualIntroPageCount}`);

  // 3. Real Page Count calculation (Page 1 = First content page)
  const tocEntries = [];
  let currentRunningPage = 1;
  for (const entry of uniquePdfEntries) {
    const bytes = fs.readFileSync(entry.path);
    const doc = await PDFDocument.load(bytes);
    const count = doc.getPageCount();
    tocEntries.push({
      ...entry,
      page: currentRunningPage
    });
    currentRunningPage += count;
  }

  // Pass 2: Real data
  await generateIntro(tocEntries);
  await browser.close();

  // 4. Merge with qpdf (Using the tagged intro as base)
  console.log('Merging tagged PDFs with qpdf...');
  const qpdfMergeCommand = `qpdf "${introPath}" --pages . "${uniquePdfEntries.map(e => e.path).join('" "')}" -- "${tempMergedPath}"`;
  execSync(qpdfMergeCommand);

  // 5. Create "Stamps" (page numbers)
  console.log('Generating page number overlay...');
  const baseDoc = await PDFDocument.load(fs.readFileSync(tempMergedPath));
  const totalPagesCount = baseDoc.getPageCount();

  const stampDoc = await PDFDocument.create();
  const helveticaFont = await stampDoc.embedFont(StandardFonts.Helvetica);
  const marginPt = 56.7; // 2cm

  for (let i = 0; i < totalPagesCount; i++) {
    const page = stampDoc.addPage([612, 792]);
    if (i >= actualIntroPageCount) {
      const fontSize = 10;
      const color = rgb(0.4, 0.4, 0.4); 
      const { width } = page.getSize();
      page.drawLine({
        start: { x: marginPt, y: marginPt - 10 },
        end: { x: width - marginPt, y: marginPt - 10 },
        thickness: 0.5,
        color: rgb(0.93, 0.93, 0.93),
      });
      page.drawText('SE Book - Tobias Dürschmid', {
        x: marginPt,
        y: marginPt - 25,
        size: fontSize,
        font: helveticaFont,
        color: color,
      });
      const pageNumText = `Page ${i - actualIntroPageCount + 1} of ${totalPagesCount - actualIntroPageCount}`;
      const textWidth = helveticaFont.widthOfTextAtSize(pageNumText, fontSize);
      page.drawText(pageNumText, {
        x: width - marginPt - textWidth,
        y: marginPt - 25,
        size: fontSize,
        font: helveticaFont,
        color: color,
      });
    }
  }
  fs.writeFileSync(stampsPath, await stampDoc.save());

  // 6. Final Overlay
  console.log('Final overlay...');
  const qpdfOverlayCommand = `qpdf "${tempMergedPath}" --overlay "${stampsPath}" -- "${outputPath}"`;
  execSync(qpdfOverlayCommand);

  // Cleanup
  [introPath, tempMergedPath, stampsPath].forEach(p => {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  });

  console.log(`Success! Tagged & Numbered PDF created at: ${outputPath}`);
}

mergePDFs().catch(console.error);
