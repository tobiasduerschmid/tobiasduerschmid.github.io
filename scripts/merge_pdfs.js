const { PDFDocument, rgb, StandardFonts, PDFName } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { chromium } = require('@playwright/test');
const { execSync } = require('child_process');

const book = process.argv[2] || 'SE Book';

var nav_path
if (book == 'SE Book') {
  nav_path = 'sebook'
} else {
  nav_path = book
}
async function mergePDFs() {
  console.log('Starting Unified SE Book PDF merge (preserving accessibility tags)...');

  const navPath = path.join(__dirname, `../_data/${nav_path}_nav.yml`);
  const navContent = fs.readFileSync(navPath, 'utf8');
  const nav = yaml.load(navContent);

  const pdfsDir = path.join(__dirname, '../pdfs');
  const outputPath = path.join(pdfsDir, book + '_Full.pdf');
  const tempMergedPath = path.join(pdfsDir, book + '_Full_base.pdf');
  const stampsPath = path.join(pdfsDir, book + '_Full_stamps.pdf');
  const introPath = path.join(pdfsDir, '_' + book + '_intro.pdf');

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
            .toc-item { display: flex; align-items: baseline; margin-bottom: 8px; padding: 0 10px; font-size: 11pt; height: 19.3px; line-height: 1.2; overflow: hidden; }
            .toc-page { font-weight: 700; color: #2774AE; min-width: 35px; text-align: right; }
          </style>
        </head>
        <body>
          <div class="title-page">
            <h1>${book}</h1>
            <div class="subtitle">Collection of topics for students in software engineering courses.</div>
            <div class="author">Tobias Dürschmid</div>
            <div class="date">${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
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

  // 4. Merge with cpdf (Preserves accessibility tags and internal links)
  console.log('Merging tagged PDFs with cpdf...');
  const cpdfMergeCommand = `cpdf -merge -process-struct-trees "${introPath}" ${uniquePdfEntries.map(e => `"${e.path}"`).join(' ')} -o "${tempMergedPath}"`;
  execSync(cpdfMergeCommand);

  // 4b. Add Bookmarks with cpdf
  console.log('Adding PDF bookmarks...');
  const bookmarksPath = path.join(pdfsDir, book + '_bookmarks.txt');
  let bookmarksContent = '';
  const categoriesInOrder = Array.from(new Set(tocEntries.map(e => e.category)));
  categoriesInOrder.forEach(cat => {
    const firstEntry = tocEntries.find(e => e.category === cat);
    // Level 0 for Category
    bookmarksContent += `0 "${cat}" ${actualIntroPageCount + firstEntry.page}\n`;
    tocEntries.filter(e => e.category === cat).forEach(e => {
      // Level 1 for Topic
      bookmarksContent += `1 "${e.name}" ${actualIntroPageCount + e.page}\n`;
    });
  });
  fs.writeFileSync(bookmarksPath, bookmarksContent);
  const tempBookmarkedPath = path.join(pdfsDir, book + '_Full_bookmarked.pdf');
  const cpdfBookmarksCommand = `cpdf -add-bookmarks "${bookmarksPath}" "${tempMergedPath}" -o "${tempBookmarkedPath}"`;
  execSync(cpdfBookmarksCommand);

  // 5. Create "Stamps" (page numbers & clickable ToC links)
  console.log('Generating page number overlay and ToC links...');
  const baseDoc = await PDFDocument.load(fs.readFileSync(tempBookmarkedPath));
  const totalPagesCount = baseDoc.getPageCount();

  const stampDoc = await PDFDocument.create();
  const helveticaFont = await stampDoc.embedFont(StandardFonts.Helvetica);
  const marginPt = 56.7; // 2cm

  // Coordinate math for ToC links
  const topMargin = 72; // ~1 inch margin
  const headerHeight = 100; // Header + spacers
  const itemHeight = 19.3; 
  const catMargin = 25;
  const itemsPerPage = 28; // Estimate based on height

  for (let i = 0; i < totalPagesCount; i++) {
    const page = stampDoc.addPage([612, 792]);
    
    // Header/Footer Stamping
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
      page.drawText(`${book} - Tobias Dürschmid`, {
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

    // ToC Link Overlay (Typically begins on page 2 (index 1) of the intro)
    if (i >= 1 && i < actualIntroPageCount) {
      let currentY = 792 - topMargin - headerHeight;
      const tIndex = i - 1; // 0-based index for ToC pages
      
      let entryIndex = 0;
      categoriesInOrder.forEach(cat => {
        currentY -= catMargin;
        tocEntries.filter(e => e.category === cat).forEach(e => {
          // Simplistic distribution: assign items to pages based on itemsPerPage
          const itemPageIndex = Math.floor(entryIndex / itemsPerPage);
          if (itemPageIndex === tIndex) {
            const targetY = currentY;
            if (targetY > 72) {
               const link = stampDoc.context.obj({
                Type: 'Annot',
                Subtype: 'Link',
                Rect: [marginPt, targetY, 612 - marginPt, targetY + itemHeight],
                Border: [0, 0, 0],
                A: {
                  Type: 'Action',
                  S: 'GoTo',
                  D: [baseDoc.getPage(actualIntroPageCount + e.page - 1).ref, 'XYZ', null, null, null],
                },
              });
              page.node.set(PDFName.of('Annots'), stampDoc.context.obj([link]));
            }
          }
          currentY -= itemHeight;
          if (currentY < 72) currentY = 792 - topMargin - headerHeight; // Reset for next "virtual" page
          entryIndex++;
        });
      });
    }
  }
  fs.writeFileSync(stampsPath, await stampDoc.save());

  // 6. Final Overlay
  console.log('Final overlay...');
  const qpdfOverlayCommand = `qpdf "${tempBookmarkedPath}" --overlay "${stampsPath}" -- "${outputPath}"`;
  try {
    execSync(qpdfOverlayCommand);
  } catch (e) {
    if (e.status === 3) {
      console.warn('qpdf finished with warnings (status 3), which is normal for complex merges.');
    } else {
      throw e;
    }
  }

  // Cleanup
  [introPath, tempMergedPath, tempBookmarkedPath, stampsPath, bookmarksPath].forEach(p => {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  });

  console.log(`Success! Tagged & Numbered PDF with Bookmarks created at: ${outputPath}`);
}

mergePDFs().catch(console.error);
