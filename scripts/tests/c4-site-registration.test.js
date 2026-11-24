'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const ROOT = path.join(__dirname, '../..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const withoutLiquidComments = (source) => source.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '');

/** The selector lists (rule preludes with more than one selector) of a stylesheet, comments removed. */
function selectorLists(css) {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return withoutComments
    .split(/[{}]/)
    .map((chunk) => chunk.split(';').pop())
    .filter((prelude) => prelude.includes(','))
    .map((prelude) => prelude.split(',').map((selector) => selector.replace(/\s+/g, ' ').trim()));
}

/** Lists that mention `crcToken` but lack the selector obtained by swapping in `c4Token`. */
function listsMissingC4(css, crcToken, c4Token) {
  return selectorLists(css).filter((list) => {
    const crcSelectors = list.filter((selector) => selector.includes(crcToken));
    return crcSelectors.some((selector) => !list.includes(selector.replace(crcToken, c4Token)));
  });
}

for (const stylesheet of ['css/uml-diagram.css', 'css/print-light.css']) {
  test(`${stylesheet} lists the C4 container wherever it lists the CRC container`, () => {
    const css = read(stylesheet);
    assert.ok(selectorLists(css).some((list) => list.some((s) => s.includes('.uml-crc-diagram-container'))));
    assert.deepEqual(listsMissingC4(css, '.uml-crc-diagram-container', '.uml-c4-diagram-container'), []);
  });
}

test('the unrendered-source hiding list also hides fenced and class-marked C4 blocks', () => {
  const css = read('css/uml-diagram.css');
  assert.deepEqual(listsMissingC4(css, 'code.language-crc', 'code.language-c4'), []);
  assert.deepEqual(listsMissingC4(css, 'code.diagram-crc', 'code.diagram-c4'), []);
});

test('the C4 manifest data file resolves to the ArchUML C4 manifest', () => {
  const link = path.join(ROOT, '_data/archuml_c4_manifest.json');
  assert.ok(fs.lstatSync(link).isSymbolicLink());
  assert.equal(fs.realpathSync(link), fs.realpathSync(path.join(ROOT, 'js/ArchUML/c4/manifest.json')));
});

test('c4-scripts.html emits the core scripts, then the render scripts, from the manifest', () => {
  const include = read('_includes/c4-scripts.html');
  const core = include.indexOf('site.data.archuml_c4_manifest.core');
  const render = include.indexOf('site.data.archuml_c4_manifest.render');
  assert.ok(core >= 0 && render > core, 'core list precedes render list');
  assert.match(include, /<script src="\{\{[^}]*relative_url[^}]*\}\}"[^>]*defer/);
});

test('c4-view.html writes the caption comment first, then the description and panels, then one view line, then the model', () => {
  const template = withoutLiquidComments(read('_includes/c4-view.html'));
  const order = ['# caption:', '# description:', '# panels:', 'view:', 'c4-models/'].map((marker) => template.indexOf(marker));
  assert.ok(order.every((index) => index >= 0), `markers present: ${order}`);
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.equal(template.split('\n').filter((line) => /^view:/.test(line)).length, 1);
  assert.match(template, /^\s*```c4\s*$/m);
  assert.match(template, /include\.model/);
});

test('c4-view.html collapses newlines in the caption, description, and panels lines', () => {
  const template = withoutLiquidComments(read('_includes/c4-view.html'));
  const commentLines = template.split('\n').filter((line) => /^# (caption|description|panels):/.test(line));
  assert.equal(commentLines.length, 3);
  for (const line of commentLines) assert.match(line, /strip_newlines/);
});

// Spec J13: the shared model is the amended §4.2 block (interfaces and chapter amendments), which the
// Milestone 1b fixture holds; the Milestone 1 fixture is never re-synced.
test('the shared course-registration model is the Milestone 1b fixture minus its schema comment and declares no view', () => {
  const fixture = read('js/ArchUML/tests/c4/fixtures/course-registration-interfaces.yml');
  const shared = read('_includes/c4-models/course-registration.yml');
  assert.equal(shared, fixture.slice(fixture.indexOf('\n') + 1));
  assert.doesNotMatch(shared, /^view:/m);
});

test('the sebook layouts load the C4 scripts before the bundle only for C4 pages', () => {
  const single = read('_layouts/sebook.html');
  assert.match(single, /if page\.c4/);
  assert.ok(single.indexOf('c4-scripts.html') < single.indexOf('/js/ArchUML/uml-bundle.js'));

  const combined = read('_layouts/sebook-combined.html');
  assert.match(combined, /if combined_has_c4/);
  assert.ok(combined.indexOf('c4-scripts.html') < combined.indexOf('/js/ArchUML/uml-bundle.js'));
  assert.match(read('_includes/sebook-combined-entry.html'), /combined_page\.c4[\s\S]*combined_has_c4/);
});

test('the UML reference page and the SE Gym loader know the c4 type', () => {
  assert.match(read('SEBook/tools/uml-reference.md'), /^c4: true$/m);
  assert.match(read('SEBook/tools/uml-reference.md'), /'c4':\s+'UMLC4Diagram'/);
  assert.match(read('js/se-gym-workout-loader.js'), /\(\?:freeform\|gitgraph\|folder-tree\|venn\|er\|crc\|c4\)/);
});
