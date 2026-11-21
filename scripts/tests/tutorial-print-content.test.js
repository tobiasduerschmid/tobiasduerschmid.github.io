const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPOSITORY_ROOT = path.resolve(__dirname, '../..');
const HARNESS_PATH = path.join(__dirname, 'fixtures', 'tutorial-print-harness.rb');

function renderPrintView(tutorial) {
  return execFileSync('bundle', ['exec', 'ruby', HARNESS_PATH], {
    cwd: REPOSITORY_ROOT,
    input: JSON.stringify(tutorial),
    encoding: 'utf8',
  });
}

// The text a reader sees for an HTML fragment: markup is dropped and
// character references are decoded. Interpreted file text changes this text.
function displayedText(html) {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&amp;/g, '&');
}

// Markup-like text a starter or solution file without a language can hold:
// C includes, Java generics, a script element, and an already-escaped entity.
const FILE_TEXT = [
  '#include <stdio.h>',
  'List<String> names = new ArrayList<>();',
  '<script>window.printViewInjected = true;</script>',
  'if (low < high && high > 0) {}',
  'Write &lt; to show a less-than sign.',
  '',
].join('\n');
const FILE = { path: 'notes.txt', content: FILE_TEXT };

for (const [section, step] of [
  ['starter file', { title: 'Notes', instructions: 'Read the notes.', files: [FILE] }],
  ['solution file', { title: 'Notes', instructions: 'Read the notes.', solution: { files: [FILE] } }],
]) {
  test(`the print view shows a ${section} without a language exactly as written`, () => {
    const html = renderPrintView({ title: 'Print fixture', steps: [step] });

    const blocks = [...html.matchAll(/<pre\b[^>]*>([\s\S]*?)<\/pre>/g)].map(match => match[1]);
    const fileBlock = blocks.find(block => block.includes('names = new ArrayList'));
    assert.ok(fileBlock, `the print view must show ${FILE.path}`);
    assert.equal(displayedText(fileBlock), FILE_TEXT, `${FILE.path} must print as literal text`);
  });
}
