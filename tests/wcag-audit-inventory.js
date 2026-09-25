// Built-page inventory shared by the screen and print WCAG audits.
const fs = require('node:fs');
const path = require('node:path');

const INFO_PAGE_URLS = new Set([
  '/cookies/', '/shortcuts/', '/glossary/', '/settings/',
  '/uml-python-workspace.html',
]);

// These documents serve runtime roles, but they are still emitted HTML and
// receive the same screen and print audit as public pages.
const RUNTIME_ONLY = new Map([
  ['/haskell-runtime-frame.html', {
    reason: 'Hidden execution iframe for the Haskell tutorial, exercised by tests/haskell-course-backend.spec.js.',
  }],
  ['/vm/snapshot/', {
    reason: 'Build-time v86 snapshot harness, exercised by vm/build-snapshot.js and runtime supply-chain tests.',
  }],
]);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() ? [full] : [];
  });
}

function canonicalUrl(siteRoot, file) {
  const relative = path.relative(siteRoot, file).split(path.sep).join('/');
  const url = `/${relative}`;
  return url.endsWith('/index.html') ? url.slice(0, -'index.html'.length) : url;
}

function sourceTutorialUrls(sourceRoot, siteRoot) {
  const urls = new Set();
  for (const file of walk(path.join(sourceRoot, 'SEBook'))) {
    if (!/\.(md|html)$/.test(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    if (!/^layout:\s*tutorial\s*$/m.test(text)) continue;
    const relative = path.relative(sourceRoot, file).split(path.sep).join('/');
    const tutorialUrl = `/${relative.replace(/\.(md|html)$/, '.html')}`;
    urls.add(tutorialUrl);
    const printPath = tutorialUrl.replace(/\.html$/, '/print');
    if (fs.existsSync(path.join(siteRoot, `${printPath.slice(1)}/index.html`))) urls.add(`${printPath}/`);
    if (fs.existsSync(path.join(siteRoot, `${printPath.slice(1)}.html`))) urls.add(`${printPath}.html`);
  }
  return urls;
}

function featureFor(url, tutorialUrls, splitTutorialPrint) {
  if (url === '/') return 'home';
  if (url === '/404.html') return 'errorPages';
  if (INFO_PAGE_URLS.has(url)) return 'infoPages';
  if (tutorialUrls.has(url)) {
    return splitTutorialPrint && /\/print(?:\/|\.html)$/.test(url) ? 'tutorialPrint' : 'tutorials';
  }
  if (url.startsWith('/SEBook/')) return 'sebook';
  if (url.startsWith('/se-gym/') || url.startsWith('/se-gym-stats/')) return 'seGym';
  if (url.startsWith('/blog/')) return 'blog';
  if (/^\/(?:tutorial-.*-popup|uml-popup)\.html$/.test(url)) return 'popouts';
  return 'standalone';
}

function buildAuditInventory({ sourceRoot, siteRoot, splitTutorialPrint = false, urlFilter = null, pageLimit = 0 }) {
  if (!fs.existsSync(siteRoot)) throw new Error(`Built site is missing: ${siteRoot}`);
  if (!Number.isInteger(pageLimit) || pageLimit < 0) throw new Error('pageLimit must be a non-negative integer');

  const htmlFiles = walk(siteRoot).filter((file) => file.endsWith('.html'));
  if (htmlFiles.length === 0) throw new Error(`Built site has no HTML files: ${siteRoot}`);
  const fileByUrl = new Map();
  for (const file of htmlFiles) {
    const url = canonicalUrl(siteRoot, file);
    if (fileByUrl.has(url)) throw new Error(`Duplicate built URL ${url}: ${fileByUrl.get(url)} and ${file}`);
    fileByUrl.set(url, file);
  }

  const tutorialUrls = sourceTutorialUrls(sourceRoot, siteRoot);
  const featureNames = [
    'home', 'errorPages', 'infoPages', 'tutorials',
    ...(splitTutorialPrint ? ['tutorialPrint'] : []),
    'sebook', 'seGym', 'blog', 'popouts', 'standalone', 'runtimeDocuments',
  ];
  const allGroups = Object.fromEntries(featureNames.map((name) => [name, []]));
  const runtimeOnlyDocuments = [];
  for (const url of fileByUrl.keys()) {
    if (RUNTIME_ONLY.has(url)) {
      runtimeOnlyDocuments.push({ url, ...RUNTIME_ONLY.get(url) });
      allGroups.runtimeDocuments.push(url);
      continue;
    }
    allGroups[featureFor(url, tutorialUrls, splitTutorialPrint)].push(url);
  }

  const userFacingCount = Object.entries(allGroups)
    .filter(([feature]) => feature !== 'runtimeDocuments')
    .reduce((count, [, urls]) => count + urls.length, 0);
  const auditedCount = Object.values(allGroups).reduce((count, urls) => count + urls.length, 0);
  if (auditedCount !== fileByUrl.size || runtimeOnlyDocuments.length !== allGroups.runtimeDocuments.length) {
    throw new Error('Built HTML inventory was not partitioned exactly once');
  }

  const groups = {};
  for (const [feature, urls] of Object.entries(allGroups)) {
    urls.sort();
    const filtered = urlFilter ? urls.filter((url) => {
      urlFilter.lastIndex = 0;
      return urlFilter.test(url);
    }) : urls;
    groups[feature] = pageLimit > 0 ? filtered.slice(0, pageLimit) : filtered;
  }
  runtimeOnlyDocuments.sort((a, b) => a.url.localeCompare(b.url));
  return {
    groups,
    inventory: {
      builtHtmlCount: fileByUrl.size,
      userFacingCount,
      selectedPageCount: Object.values(groups).reduce((count, urls) => count + urls.length, 0),
      fullGroupPageCounts: Object.fromEntries(Object.entries(allGroups).map(([feature, urls]) => [feature, urls.length])),
      runtimeOnlyDocuments,
    },
  };
}

module.exports = { buildAuditInventory };
