'use strict';

// A bare `layout compact` line learns the pane the drawing will be shown in;
// every other spec reaches ArchUML exactly as written.
const assert = require('node:assert/strict');
const test = require('node:test');
const { withCompactPane } = require('../../js/archuml-compact-pane.js');

const spec = (...lines) => ['@startuml', ...lines, 'class A', '@enduml'].join('\n');

test('a bare compact line gains the pane size', () => {
  assert.equal(withCompactPane(spec('layout compact'), { width: 600, height: 700 }),
    spec('layout compact 600x700'));
});

test('the size is rounded to whole CSS pixels', () => {
  assert.equal(withCompactPane(spec('layout compact'), { width: 234.4, height: 205.6 }),
    spec('layout compact 234x206'));
});

test('the directive is recognized as ArchUML parses it: any case, surrounding spaces', () => {
  assert.equal(withCompactPane(spec('  Layout   COMPACT  '), { width: 300, height: 200 }),
    spec('  layout compact 300x200'));
});

test('a compact line that already names a size is left alone, valid or not', () => {
  for (const line of ['layout compact 900x500', 'layout compact axb', 'layout compact 0x700']) {
    assert.equal(withCompactPane(spec(line), { width: 600, height: 700 }), spec(line));
  }
});

test('specs without layout compact are untouched', () => {
  for (const line of ['layout landscape', 'layout tight', 'layout vertical', "' layout compact"]) {
    assert.equal(withCompactPane(spec(line), { width: 600, height: 700 }), spec(line));
  }
});

test('other layout lines beside compact are kept', () => {
  assert.equal(withCompactPane(spec('layout landscape', 'layout compact'), { width: 640, height: 480 }),
    spec('layout landscape', 'layout compact 640x480'));
});

test('Windows line endings survive', () => {
  assert.equal(withCompactPane('@startuml\r\nlayout compact\r\nclass A\r\n@enduml', { width: 10, height: 20 }),
    '@startuml\r\nlayout compact 10x20\r\nclass A\r\n@enduml');
});

test('a pane that rounds to nothing, or is missing, leaves the spec for ArchUML to measure', () => {
  for (const pane of [null, undefined, { width: 0, height: 700 }, { width: 600, height: 0.4 },
    { width: NaN, height: 700 }, { width: Infinity, height: 700 }, { width: 600 }]) {
    assert.equal(withCompactPane(spec('layout compact'), pane), spec('layout compact'));
  }
});

test('a missing spec stays missing', () => {
  assert.equal(withCompactPane('', { width: 600, height: 700 }), '');
  assert.equal(withCompactPane(undefined, { width: 600, height: 700 }), undefined);
});
