const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildAuditInventory } = require('../../tests/wcag-audit-inventory');
const { writeAuditCheckpoint } = require('../../tests/wcag-audit-report');

function fixture(t) {
  const sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wcag-inventory-'));
  const siteRoot = path.join(sourceRoot, '_site');
  t.after(() => fs.rmSync(sourceRoot, { recursive: true, force: true }));
  function write(relative, content = '<!doctype html>') {
    const file = path.join(sourceRoot, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  for (const page of [
    'index.html', '404.html', 'cookies/index.html',
    'SEBook/topic/example-tutorial.html', 'SEBook/topic/example-tutorial/print/index.html',
    'SEBook/topic/chapter.html', 'se-gym-stats/index.html', 'blog/index.html',
    'tutorial-output-popup.html', 'test-uml.html', 'AIH.html', 'myindex.html',
    'haskell-runtime-frame.html', 'vm/snapshot/index.html',
  ]) write(`_site/${page}`);
  write('SEBook/topic/example-tutorial.md', '---\nlayout: tutorial\n---\n');
  return { sourceRoot, siteRoot };
}

test('built HTML is partitioned once, including public standalones and documented runtime-only documents', (t) => {
  const input = fixture(t);
  const { groups, inventory } = buildAuditInventory(input);
  assert.equal(inventory.builtHtmlCount, 14);
  assert.equal(inventory.userFacingCount, 12);
  assert.equal(inventory.selectedPageCount, 14);
  assert.deepEqual(groups.home, ['/']);
  assert.deepEqual(groups.tutorials, [
    '/SEBook/topic/example-tutorial.html', '/SEBook/topic/example-tutorial/print/',
  ]);
  assert.deepEqual(groups.seGym, ['/se-gym-stats/']);
  assert.deepEqual(groups.popouts, ['/tutorial-output-popup.html']);
  assert.deepEqual(groups.standalone, ['/AIH.html', '/myindex.html', '/test-uml.html']);
  assert.deepEqual(groups.runtimeDocuments, ['/haskell-runtime-frame.html', '/vm/snapshot/']);
  assert.deepEqual(inventory.runtimeOnlyDocuments.map((item) => item.url), [
    '/haskell-runtime-frame.html', '/vm/snapshot/',
  ]);
  assert.ok(inventory.runtimeOnlyDocuments.every((item) => item.reason));
  const assigned = Object.values(groups).flat();
  assert.equal(assigned.length, inventory.builtHtmlCount);
  assert.equal(new Set(assigned).size, assigned.length);
  assert.ok(!assigned.includes('/index.html'));
  assert.ok(assigned.includes('/myindex.html'));
});

test('print tutorial split, URL filter, and per-feature smoke limit preserve distinct selection scopes', (t) => {
  const input = fixture(t);
  const fullPrint = buildAuditInventory({ ...input, splitTutorialPrint: true });
  assert.deepEqual(fullPrint.groups.tutorials, ['/SEBook/topic/example-tutorial.html']);
  assert.deepEqual(fullPrint.groups.tutorialPrint, ['/SEBook/topic/example-tutorial/print/']);

  const filtered = buildAuditInventory({ ...input, urlFilter: /(?:AIH|test-uml)\.html$/, pageLimit: 1 });
  assert.deepEqual(filtered.groups.standalone, ['/AIH.html']);
  assert.equal(filtered.inventory.selectedPageCount, 1);
  assert.equal(filtered.inventory.userFacingCount, 12);
  assert.equal(filtered.inventory.fullGroupPageCounts.standalone, 3);
});

test('missing build fails instead of reporting an empty audit, and checkpoints remain valid JSON', (t) => {
  const { sourceRoot, siteRoot } = fixture(t);
  assert.throws(() => buildAuditInventory({ sourceRoot, siteRoot: path.join(sourceRoot, 'missing') }), /Built site is missing/);
  const reportPath = path.join(sourceRoot, 'tmp', 'report.json');
  writeAuditCheckpoint(reportPath, { progress: { completedPages: 1 } });
  writeAuditCheckpoint(reportPath, { progress: { completedPages: 2, currentPage: { stage: 'dark axe' } } });
  assert.deepEqual(JSON.parse(fs.readFileSync(reportPath, 'utf8')).progress, {
    completedPages: 2, currentPage: { stage: 'dark axe' },
  });
  assert.equal(fs.existsSync(`${reportPath}.tmp`), false);
});
