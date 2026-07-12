const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const REPOSITORY_ROOT = path.resolve(__dirname, '..');

const BOOK_CONFIGURATIONS = Object.freeze({
  'SE Book': Object.freeze({ navName: 'sebook' }),
  CS35L: Object.freeze({ navName: 'CS35L' }),
  CS130: Object.freeze({ navName: 'CS130' }),
});

function resolveBookConfiguration(bookName) {
  if (!Object.hasOwn(BOOK_CONFIGURATIONS, bookName)) {
    const supportedBooks = Object.keys(BOOK_CONFIGURATIONS).join(', ');
    throw new Error(`Unsupported book "${bookName}". Expected one of: ${supportedBooks}.`);
  }
  return BOOK_CONFIGURATIONS[bookName];
}

function configuredNavPaths(repositoryRoot = REPOSITORY_ROOT) {
  return Object.values(BOOK_CONFIGURATIONS).map(({ navName }) => (
    path.join(repositoryRoot, '_data', `${navName}_nav.yml`)
  ));
}

function chapterPdfFilename(url) {
  return url
    .replace(/^\/SEBook\//, '')
    .replace(/\.html$/, '')
    .replace(/\//g, '_') + '.pdf';
}

function extractChapterEntries(items, inheritedCategory = '', entries = []) {
  for (const item of items || []) {
    const category = inheritedCategory || item.name;
    if (typeof item.url === 'string' && item.url.startsWith('/SEBook/')) {
      entries.push({
        url: item.url,
        topicName: item.name,
        category,
      });
    }
    extractChapterEntries(item.subtopics, category, entries);
    extractChapterEntries(item.items, category, entries);
  }
  return entries;
}

function loadUniqueChapterEntries(navPaths) {
  if (!Array.isArray(navPaths) || navPaths.length === 0) {
    throw new Error('At least one navigation file is required to generate chapter PDFs.');
  }

  const uniqueEntries = new Map();
  for (const navPath of navPaths) {
    const nav = yaml.load(fs.readFileSync(navPath, 'utf8'));
    for (const entry of extractChapterEntries(nav && nav.topics)) {
      if (!uniqueEntries.has(entry.url)) uniqueEntries.set(entry.url, entry);
    }
  }
  return [...uniqueEntries.values()];
}

module.exports = {
  BOOK_CONFIGURATIONS,
  chapterPdfFilename,
  configuredNavPaths,
  extractChapterEntries,
  loadUniqueChapterEntries,
  resolveBookConfiguration,
};
