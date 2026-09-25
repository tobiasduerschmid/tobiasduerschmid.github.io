const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { collectAuthoredSourceFiles, findSourceCandidates } = require('../../tests/wcag-source-candidates');

test('WCAG source candidates exclude documentation, tests, and vendor code', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wcag-sources-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  for (const [name, content] of Object.entries({
    'index.html': '<button>Open tooltip</button>',
    'SEBook/chapter.md': 'A tooltip explains the term.',
    'js/tutorial.js': 'function showTooltip() {}',
    '_data/tutorials/lesson.yml': 'hint: "Tooltip help"',
    'docs/notes.md': 'tooltip',
    '.agents/skills/guide.md': 'tooltip',
    'tests/tooltip.spec.js': 'tooltip',
    'js/vendor/tooltips.js': 'tooltip',
    'README.md': 'tooltip',
  })) {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }

  const files = collectAuthoredSourceFiles(root);
  assert.deepEqual(files.map((file) => path.relative(root, file)), [
    'SEBook/chapter.md',
    '_data/tutorials/lesson.yml',
    'index.html',
    'js/tutorial.js',
  ]);

  const matches = findSourceCandidates(['tooltip'], files, root);
  assert.deepEqual(matches.map((match) => match.file), [
    'SEBook/chapter.md',
    '_data/tutorials/lesson.yml',
    'index.html',
    'js/tutorial.js',
  ]);
});

test('documentation-only pattern hits are not implementation candidates', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wcag-sources-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'docs'));
  fs.writeFileSync(path.join(root, 'docs', 'accessibility.md'), 'transcript');

  const files = collectAuthoredSourceFiles(root);
  assert.deepEqual(findSourceCandidates(['transcript'], files, root), []);
});
