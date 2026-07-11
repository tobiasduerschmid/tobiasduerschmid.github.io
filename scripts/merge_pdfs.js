const {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFString,
  StandardFonts,
  rgb,
} = require('pdf-lib');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('@playwright/test');
const { execFileSync } = require('node:child_process');

const {
  chapterPdfFilename,
  loadUniqueChapterEntries,
  resolveBookConfiguration,
} = require('./pdf-pipeline-config');
const { escapeHtml } = require('./pdf-html');
const { assertPdfToolsAvailable } = require('./pdf-tools');

const TOC_LINK_PREFIX = 'https://sebook.invalid/__pdf_toc__/';

function tocPlaceholderUrl(index) {
  return `${TOC_LINK_PREFIX}${index}`;
}

function expectedChapterPdfEntries(navPath, pdfsDir) {
  return loadUniqueChapterEntries([navPath]).map(entry => ({
    path: path.join(pdfsDir, chapterPdfFilename(entry.url)),
    name: entry.topicName,
    category: entry.category,
    url: entry.url,
  }));
}

function assertExpectedChapterPdfs(entries, book) {
  if (entries.length === 0) {
    throw new Error(`Cannot merge ${book}: its navigation contains no SEBook chapter URLs.`);
  }

  const missing = entries.filter(entry => !fs.existsSync(entry.path));
  if (missing.length === 0) return entries;

  const details = missing.map(entry => `  - ${entry.url} -> ${entry.path}`).join('\n');
  throw new AggregateError(
    missing.map(entry => new Error(`Missing chapter PDF: ${entry.path}`)),
    [
      `Cannot merge ${book}: ${missing.length} expected chapter PDF${missing.length === 1 ? ' is' : 's are'} missing.`,
      details,
      'Run npm run pdf from the repository root, then retry the merge.',
    ].join('\n'),
  );
}

function rewriteTocPlaceholderLinks(document, tocEntries, introPageCount) {
  const seen = new Map();
  const invalid = [];
  const uriName = PDFName.of('URI');
  const actionName = PDFName.of('A');

  for (let pageIndex = 0; pageIndex < introPageCount; pageIndex += 1) {
    const page = document.getPage(pageIndex);
    const annotations = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
    if (!annotations) continue;

    for (let annotationIndex = 0; annotationIndex < annotations.size(); annotationIndex += 1) {
      const annotation = annotations.lookup(annotationIndex, PDFDict);
      const action = annotation.lookupMaybe(actionName, PDFDict);
      const uri = action && action.lookupMaybe(uriName, PDFString, PDFHexString);
      if (!uri) continue;

      const uriText = uri.decodeText();
      if (!uriText.startsWith(TOC_LINK_PREFIX)) continue;

      const encodedIndex = uriText.slice(TOC_LINK_PREFIX.length);
      if (!/^\d+$/.test(encodedIndex)) {
        invalid.push(uriText);
        continue;
      }

      const tocIndex = Number(encodedIndex);
      const tocEntry = tocEntries[tocIndex];
      if (!tocEntry) {
        invalid.push(uriText);
        continue;
      }

      const targetPageIndex = introPageCount + tocEntry.page - 1;
      const targetPage = document.getPage(targetPageIndex);
      action.delete(uriName);
      action.set(PDFName.of('S'), PDFName.of('GoTo'));
      action.set(PDFName.of('D'), document.context.obj([targetPage.ref, PDFName.of('Fit')]));
      seen.set(tocIndex, (seen.get(tocIndex) || 0) + 1);
    }
  }

  const missing = tocEntries
    .map((_, index) => index)
    .filter(index => !seen.has(index));
  const duplicates = [...seen]
    .filter(([, count]) => count !== 1)
    .map(([index, count]) => `${index} (${count} annotations)`);

  if (missing.length || duplicates.length || invalid.length) {
    const problems = [];
    if (missing.length) problems.push(`missing indexes: ${missing.join(', ')}`);
    if (duplicates.length) problems.push(`duplicate indexes: ${duplicates.join(', ')}`);
    if (invalid.length) problems.push(`invalid placeholders: ${invalid.join(', ')}`);
    throw new Error(`Could not build complete ToC links (${problems.join('; ')}).`);
  }

  return seen.size;
}

function mergeTaggedPdfs(introPath, chapterPaths, outputPath) {
  execFileSync(
    'cpdf',
    ['-merge', '-process-struct-trees', introPath, ...chapterPaths, '-o', outputPath],
    { stdio: 'inherit' },
  );
}

function addPdfBookmarks(bookmarksPath, inputPath, outputPath) {
  execFileSync(
    'cpdf',
    ['-add-bookmarks', bookmarksPath, inputPath, '-o', outputPath],
    { stdio: 'inherit' },
  );
}

function overlayPdfStamps(inputPath, stampsPath, outputPath) {
  try {
    execFileSync(
      'qpdf',
      [inputPath, '--overlay', stampsPath, '--', outputPath],
      { stdio: 'inherit' },
    );
  } catch (error) {
    if (error.status === 3) {
      console.warn('qpdf finished with warnings (status 3), which is normal for complex merges.');
      return;
    }
    throw error;
  }
}

function createIntroHtml({
  book,
  tocData,
  dateLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
}) {
  const indexedTocData = tocData.map((entry, tocIndex) => ({ ...entry, tocIndex }));
  const categories = Array.from(new Set(indexedTocData.map(entry => entry.category)));

  return `
    <html lang="en">
      <head>
        <title>${escapeHtml(book)} table of contents</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
          @page { margin: 2.5cm; background: #fff; }
          html, body { background: #fff; }
          body { font-family: 'Inter', sans-serif; color: #333; margin: 0; padding: 0; line-height: 1.4; }
          .title-page { height: 9in; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
          .title-page h1 { font-size: 54pt; color: #2774AE; margin-bottom: 0; font-weight: 700; }
          .title-page .subtitle { font-size: 24pt; color: #666; font-weight: 400; margin-top: 10px; }
          .title-page .author { margin-top: 100px; font-size: 18pt; color: #333; font-weight: 600; }
          .title-page .date { margin-top: 10px; font-size: 12pt; color: #595959; }
          .toc-container { page-break-before: always; padding-top: 20px; }
          .toc-header { font-size: 32pt; font-weight: 700; color: #2774AE; margin: 0 0 40px; border-bottom: 4px solid #FFD100; padding-bottom: 15px; }
          .toc-category-group { margin-bottom: 25px; page-break-inside: avoid; }
          .toc-category-title { font-size: 15pt; font-weight: 700; color: #2774AE; background: #f0f4f8; padding: 6px 12px; border-radius: 6px; margin: 0 0 12px; }
          .toc-item { display: flex; align-items: baseline; margin-bottom: 8px; padding: 0 10px; font-size: 12pt; height: 19.3px; line-height: 1.2; overflow: hidden; }
          .toc-item, .toc-item:visited { color: #333; text-decoration: none; }
          .toc-name { min-width: 0; overflow: hidden; text-decoration: underline; text-overflow: ellipsis; white-space: nowrap; }
          .toc-dots { flex: 1 1 auto; min-width: 1em; margin: 0 0.4em; border-bottom: 1px dotted #999; }
          .toc-page { flex: 0 0 auto; font-weight: 700; color: #2774AE; min-width: 35px; text-align: right; }
        </style>
      </head>
      <body>
        <div class="title-page">
          <h1>${escapeHtml(book)}</h1>
          <div class="subtitle">Collection of topics for students in software engineering courses.</div>
          <div class="author">Tobias Dürschmid</div>
          <div class="date">${escapeHtml(dateLabel)}</div>
        </div>
        <div class="toc-container">
          <h2 class="toc-header">Table of Contents</h2>
          ${categories.map(category => `
            <div class="toc-category-group">
              <h3 class="toc-category-title">${escapeHtml(category)}</h3>
              ${indexedTocData.filter(entry => entry.category === category).map(entry => `
                <a class="toc-item" href="${tocPlaceholderUrl(entry.tocIndex)}">
                  <span class="toc-name">${escapeHtml(entry.name)}</span><span class="toc-dots"></span><span class="toc-page">${entry.page}</span>
                </a>
              `).join('')}
            </div>
          `).join('')}
        </div>
      </body>
    </html>
  `;
}

async function mergePDFs(book = 'SE Book') {
  const { navName } = resolveBookConfiguration(book);
  console.log('Starting Unified SE Book PDF merge (preserving accessibility tags)...');

  const navPath = path.join(__dirname, `../_data/${navName}_nav.yml`);
  const pdfsDir = path.join(__dirname, '../pdfs');
  const outputPath = path.join(pdfsDir, book + '_Full.pdf');
  const tempMergedPath = path.join(pdfsDir, book + '_Full_base.pdf');
  const tempLinkedPath = path.join(pdfsDir, book + '_Full_linked.pdf');
  const stampsPath = path.join(pdfsDir, book + '_Full_stamps.pdf');
  const introPath = path.join(pdfsDir, '_' + book + '_intro.pdf');

  // Validate every cheap prerequisite before launching Chromium or reading PDFs.
  const uniquePdfEntries = assertExpectedChapterPdfs(
    expectedChapterPdfEntries(navPath, pdfsDir),
    book,
  );
  assertPdfToolsAvailable();
  console.log(`Found ${uniquePdfEntries.length} unique PDF chapters.`);

  // 2. Generate Initial Intro to get page count
  const browser = await chromium.launch();
  let page;

  async function generateIntro(tocData) {
    await page.setContent(createIntroHtml({ book, tocData }));
    await page.pdf({
      path: introPath,
      format: 'Letter',
      printBackground: true,
      tagged: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });
  }

  let actualIntroPageCount;
  const tocEntries = [];
  try {
    page = await browser.newPage();

    // Pass 1: Dummy data to get page count
    await generateIntro(uniquePdfEntries.map(e => ({ ...e, page: 1 })));
    const introDoc1 = await PDFDocument.load(fs.readFileSync(introPath));
    actualIntroPageCount = introDoc1.getPageCount();
    console.log(`Intro generated. Pages: ${actualIntroPageCount}`);

    // 3. Real Page Count calculation (Page 1 = First content page)
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
  } finally {
    await browser.close();
  }

  // 4. Merge with cpdf (Preserves accessibility tags and internal links)
  console.log('Merging tagged PDFs with cpdf...');
  mergeTaggedPdfs(
    introPath,
    uniquePdfEntries.map(entry => entry.path),
    tempMergedPath,
  );

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
  addPdfBookmarks(bookmarksPath, tempMergedPath, tempBookmarkedPath);

  // 5. Convert Chromium's precisely positioned placeholder links into
  // in-document destinations while every page belongs to the same object graph.
  console.log('Creating in-document ToC links...');
  const baseDoc = await PDFDocument.load(fs.readFileSync(tempBookmarkedPath));
  const linkCount = rewriteTocPlaceholderLinks(baseDoc, tocEntries, actualIntroPageCount);
  fs.writeFileSync(tempLinkedPath, await baseDoc.save());
  console.log(`Created ${linkCount} ToC links.`);

  // 5b. Create the page-number overlay separately. qpdf applies these visual
  // stamps without disturbing the link annotations already present in the base.
  const totalPagesCount = baseDoc.getPageCount();
  const stampDoc = await PDFDocument.create();
  const helveticaFont = await stampDoc.embedFont(StandardFonts.Helvetica);
  const marginPt = 56.7; // 2cm

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
  }
  fs.writeFileSync(stampsPath, await stampDoc.save());

  // 6. Final Overlay
  console.log('Final overlay...');
  overlayPdfStamps(tempLinkedPath, stampsPath, outputPath);

  // Cleanup
  [introPath, tempMergedPath, tempBookmarkedPath, tempLinkedPath, stampsPath, bookmarksPath].forEach(p => {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  });

  console.log(`Success! Tagged & Numbered PDF with Bookmarks created at: ${outputPath}`);
}

if (require.main === module) {
  const requestedBook = process.argv[2] ?? 'SE Book';
  mergePDFs(requestedBook).catch(error => {
    console.error(`PDF merge failed: ${error.message || error}`);
    process.exitCode = 1;
  });
}

module.exports = {
  addPdfBookmarks,
  assertExpectedChapterPdfs,
  createIntroHtml,
  expectedChapterPdfEntries,
  mergePDFs,
  mergeTaggedPdfs,
  overlayPdfStamps,
  resolveBookConfiguration,
  rewriteTocPlaceholderLinks,
  tocPlaceholderUrl,
};
