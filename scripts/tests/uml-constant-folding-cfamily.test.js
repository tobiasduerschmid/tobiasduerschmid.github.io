'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { analyzeJavaSources } = require('../../js/uml-analyzer-java.js');
const { analyzeCppSources } = require('../../js/uml-analyzer-cpp.js');
const { project } = require('../../js/uml-diagram-views.js');

const fixtures = {
  java: {
    analyze: analyzeJavaSources, file: 'Main.java',
    wrap: body => 'class Sink { void consume(int item) {} void consumeText(String item) {} void change(int[] values) { values[0] = 9; } } class Main { public static void main(String[] args) { Sink sink = new Sink(); ' + body + ' } }',
    declaration: 'int[] items = {base, base + 1};',
    array: 'int[] items = {1, 2};',
    alias: 'int[] alias = items; alias[0] = 9;',
    branch: 'if (args.length > 0) { items[0] = 9; }',
    narrow: 'byte[] items = {1, 2};',
    loop: 'for (int item : items) { sink.consume(item); }',
  },
  cpp: {
    analyze: analyzeCppSources, file: 'example.cpp',
    wrap: body => '#include <string>\n#include <vector>\nclass Sink { public: void consume(int item) {} void consumeText(std::string item) {} void change(int* values) { values[0] = 9; } }; int main(int argc, char** argv) { Sink sink; ' + body + ' }',
    declaration: 'int items[] = {base, base + 1};',
    array: 'int items[] = {1, 2};',
    alias: 'int* alias = items; alias[0] = 9;',
    branch: 'if (argc > 1) { items[0] = 9; }',
    narrow: 'short items[] = {1, 2};',
    loop: 'for (int item : items) { sink.consume(item); }',
  },
};

function infer(language, body) {
  const fixture = fixtures[language];
  const raw = fixture.analyze({ [fixture.file]: fixture.wrap(body) });
  assert.deepEqual(raw.errors, []);
  const original = structuredClone(raw);
  const design = project(raw, { language, view: 'design' });
  assert.equal(project(raw, { language, view: 'implementation' }).sequenceDiagram, raw.sequenceDiagram);
  assert.deepEqual(raw, original, 'Design projection does not mutate the raw analysis');
  return { raw, labels: design.sequenceDiagram.split('\n').filter(line => /^loop /.test(line)) };
}

function expectItems(language, body, expected = 'items') {
  const { labels } = infer(language, body);
  assert.deepEqual(labels, [`loop [for each item in ${expected}]`]);
}

for (const [language, fixture] of Object.entries(fixtures)) {
  test(`${language}: a fresh scalar contributes its value to a literal iterable`, () => {
    expectItems(language, 'int base = 1; ' + fixture.declaration + fixture.loop, '[1, 2]');
  });

  for (const [name, before] of [
    ['element write', 'items[0] = 9;'],
    ['alias escape', fixture.alias],
    ['array argument escape', 'sink.change(items);'],
    ['mutation on one branch', fixture.branch],
  ]) {
    test(`${language}: ${name} prevents stale iterable substitution`, () => {
      expectItems(language, fixture.array + before + fixture.loop);
    });
  }

  test(`${language}: scalar mutation in an initializer invalidates its old value`, () => {
    expectItems(language, 'int base = 1; int previous = base++; ' + fixture.declaration + fixture.loop);
  });

  test(`${language}: scalar compound assignment invalidates its old value`, () => {
    expectItems(language, 'int base = 1; base |= 2; ' + fixture.declaration + fixture.loop);
  });

  test(`${language}: a prefix update initializer is not pure constant arithmetic`, () => {
    expectItems(language, 'int previous = 1; int base = ++previous + 1; ' + fixture.declaration + fixture.loop);
  });

  test(`${language}: unsupported narrowing types stay symbolic`, () => {
    expectItems(language, fixture.narrow + fixture.loop);
  });

  test(`${language}: loop-carried scalar state cannot become a fixed nested iterable`, () => {
    const { labels } = infer(language, 'int base = 1; for (int i = 0; i < 2; ++i) { ' + fixture.declaration + fixture.loop + ' base++; }');
    assert.ok(labels.includes('loop [for each item in items]'));
    assert.ok(!labels.some(label => label.includes('for each item in [')));
  });
}

test('C++: an exact fixed-array bound permits substitution', () => {
  expectItems('cpp', 'int items[2] = {1, 2}; ' + fixtures.cpp.loop, '[1, 2]');
});

test('C++: a partially initialized array is not mistaken for its initializer list', () => {
  expectItems('cpp', 'int items[4] = {1, 2}; ' + fixtures.cpp.loop);
});

test('C++: a reference loop variable can mutate a later iteration and later loops', () => {
  const { labels } = infer('cpp', fixtures.cpp.array + 'for (int& item : items) { sink.consume(item); item = 9; } ' + fixtures.cpp.loop);
  assert.deepEqual(labels, ['loop [for each item in items]', 'loop [for each item in items]']);
});

for (const binding of ['const int&', 'int const&', 'const auto&']) {
  test(`C++: ${binding} reads retain known range values for this and later loops`, () => {
    const { labels } = infer('cpp', fixtures.cpp.array + `for (${binding} item : items) { sink.consume(item); } ` + fixtures.cpp.loop);
    assert.deepEqual(labels, ['loop [for each item in [1, 2]]', 'loop [for each item in [1, 2]]']);
  });
}

test('C++: a const string-reference range retains complete literal values', () => {
  expectItems('cpp', 'std::string items[] = {"book", "pen"}; for (const std::string& item : items) { sink.consumeText(item); }', '["book", "pen"]');
});

for (const body of [
  'items[0] = 9; sink.consume(item);',
  'const_cast<int&>(item) = 9; sink.consume(item);',
  'sink.change(const_cast<int*>(&item)); sink.consume(item);',
  'const int& alias = item; const_cast<int&>(alias) = 9; sink.consume(item);',
  'unknown(item); sink.consume(item);',
]) {
  test(`C++: const-reference range with ${body} keeps current and later values symbolic`, () => {
    const { labels } = infer('cpp', fixtures.cpp.array + `for (const int& item : items) { ${body} } ` + fixtures.cpp.loop);
    assert.deepEqual(labels, ['loop [for each item in items]', 'loop [for each item in items]']);
  });
}

test('C++: a const-reference argument can escape through a callee that casts away const', () => {
  const source = fixtures.cpp.wrap(fixtures.cpp.array + 'for (const int& item : items) { sink.changeBorrowed(item); } ' + fixtures.cpp.loop)
    .replace('void consume(int item) {}', 'void consume(int item) {} void changeBorrowed(const int& value) { const_cast<int&>(value) = 9; }');
  const raw = analyzeCppSources({ 'example.cpp': source });
  assert.deepEqual(raw.errors, []);
  const labels = project(raw, { language: 'cpp', view: 'design' }).sequenceDiagram.split('\n').filter(line => /^loop /.test(line));
  assert.deepEqual(labels, ['loop [for each item in items]', 'loop [for each item in items]']);
});

for (const binding of ['const volatile int&', 'auto&&']) {
  test(`C++: ${binding} does not establish a supported read-only range`, () => {
    expectItems('cpp', fixtures.cpp.array + `for (${binding} item : items) { sink.consume(item); }`);
  });
}

test('C++: a const pointer reference does not make its pointee a known immutable value', () => {
  expectItems('cpp', 'int first = 1; int second = 2; int* items[] = {&first, &second}; for (int* const& item : items) { *item = 9; sink.consume(*item); }');
});

test('C++: a const-reference parameter declaration does not prove an external callee read-only', () => {
  const source = fixtures.cpp.wrap(fixtures.cpp.array + 'for (const int& item : items) { sink.external(item); } ' + fixtures.cpp.loop)
    .replace('void consume(int item) {}', 'void consume(int item) {} void external(const int& value);');
  const raw = analyzeCppSources({ 'example.cpp': source });
  assert.deepEqual(raw.errors, []);
  const labels = project(raw, { language: 'cpp', view: 'design' }).sequenceDiagram.split('\n').filter(line => /^loop /.test(line));
  assert.deepEqual(labels, ['loop [for each item in items]', 'loop [for each item in items]']);
});

test('C++: a scalar reference escape prevents constant propagation', () => {
  expectItems('cpp', 'int base = 1; int& alias = base; alias = 8; ' + fixtures.cpp.declaration + fixtures.cpp.loop);
});

test('C++: local array shadowing does not replace the outer value', () => {
  expectItems('cpp', fixtures.cpp.array + '{ int items[] = {8, 9}; } ' + fixtures.cpp.loop, '[1, 2]');
});

test('C++: standard containers with compatible literal values are known', () => {
  expectItems('cpp', 'std::vector<int> items{1, 2}; ' + fixtures.cpp.loop, '[1, 2]');
});

test('C++: a string-container size constructor is not a sequence of integers', () => {
  const { labels } = infer('cpp', 'std::vector<std::string> items{3}; for (std::string item : items) { sink.consumeText(item); }');
  assert.deepEqual(labels, ['loop [for each item in items]']);
});

for (const language of Object.keys(fixtures)) {
  test(`${language}: string literals retain punctuation, repeated spaces, and escapes`, () => {
    const declaration = language === 'java' ? 'String[] items' : 'std::string items[]';
    const type = language === 'java' ? 'String' : 'std::string';
    const { labels } = infer(language, declaration + ' = {"a,  b", "quote\\\"\\n"}; for (' + type + ' item : items) { sink.consumeText(item); }');
    assert.deepEqual(labels, ['loop [for each item in ["a,  b", "quote\\\"\\n"]]']);
  });
}
