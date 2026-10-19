'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { analyzeCppSources } = require('../../js/uml-analyzer-cpp.js');

test('C++ resolves an alias in its declaration namespace when the use site shadows its target', () => {
  const result = analyzeCppSources({ 'main.cpp': `
    namespace catalog { struct Item {}; using Entry = Item; }
    namespace checkout { struct Item {}; struct Order { catalog::Entry item; }; }
  ` });
  assert.deepEqual(result.errors, []);
  assert.match(result.classDiagram, /checkout__Order "1" \*-- "1" catalog__Item/);
  assert.doesNotMatch(result.classDiagram, /checkout__Order .* checkout__Item/);
});

test('C++ alias chains retain declaration scopes and use-site reference qualifiers', () => {
  const result = analyzeCppSources({ 'main.cpp': `
    namespace catalog { struct Item {}; using Entry = Item; }
    namespace checkout { using Purchase = catalog::Entry; struct Item {}; }
    struct Basket { const checkout::Purchase& item; };
  ` });
  assert.deepEqual(result.errors, []);
  assert.match(result.classDiagram, /Basket "1" --> "1" catalog__Item/);
});

test('C++ optional and smart-pointer wrappers preserve their collection element multiplicity', () => {
  for (const wrapper of ['optional', 'unique_ptr', 'shared_ptr', 'weak_ptr']) {
    const result = analyzeCppSources({ 'main.cpp': `
      struct Item {}; struct Basket { std::${wrapper}<std::vector<Item>> items; };
    ` });
    assert.deepEqual(result.errors, []);
    assert.match(result.classDiagram, /Basket "1" (?:\*--|o--|-->) "\*" Item/, wrapper);
    assert.doesNotMatch(result.classDiagram, /Basket .*"0\.\.1" Item/, wrapper);
  }
});

test('C++ owning a wrapper does not imply owning its borrowed pointees', () => {
  for (const type of ['std::optional<Item*>', 'std::unique_ptr<std::vector<Item*>>', 'std::shared_ptr<std::vector<Item*>>']) {
    const result = analyzeCppSources({ 'main.cpp': `struct Item {}; struct Basket { ${type} items; };` });
    assert.deepEqual(result.errors, []);
    assert.match(result.classDiagram, /Basket "1" --> "(?:0\.\.1|\*)" Item/, type);
    assert.doesNotMatch(result.classDiagram, /Basket .*\*--/, type);
  }
});

test('C++ an optional fixed-size collection can contain zero elements when absent', () => {
  const result = analyzeCppSources({ 'main.cpp': 'struct Item {}; struct Basket { std::optional<std::array<Item, 3>> items; };' });
  assert.deepEqual(result.errors, []);
  assert.match(result.classDiagram, /Basket "1" \*-- "0\.\.3" Item/);
});

test('C++ borrowing a nullable owning pointer preserves the pointee cardinality', () => {
  const result = analyzeCppSources({ 'main.cpp': 'struct Item {}; struct Basket { std::reference_wrapper<std::unique_ptr<Item>> item; };' });
  assert.deepEqual(result.errors, []);
  assert.match(result.classDiagram, /Basket "1" --> "0\.\.1" Item/);
});
