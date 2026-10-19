'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { analyzeJavaSources } = require('../../js/uml-analyzer-java.js');

function diagram(fieldType) {
  const result = analyzeJavaSources({
    'Item.java': 'package domain; public class Item {}',
    'Store.java': `import java.util.*; import domain.Item; class Store { ${fieldType} items; }`,
  });
  assert.deepEqual(result.errors, []);
  return result.classDiagram;
}

test('Java resolves a qualified generic element without treating its package as the outer type', () => {
  assert.match(diagram('java.util.List<domain.Item>'), /Store "1" o-- "\*" Item/);
});

test('Java follows nested collection and map-value types to their element class', () => {
  for (const type of ['List<List<Item>>', 'Map<String, List<Item>>', 'List<Map<String, Item>>']) {
    assert.match(diagram(type), /Store "1" o-- "\*" Item/, type);
  }
});

test('Java distinguishes an optional single reference from a collection of references', () => {
  const single = diagram('Optional<Item>');
  assert.match(single, /Store "1" --> "0\.\.1" Item/);
  assert.doesNotMatch(single, /Store .*"\*" Item/);
  assert.match(diagram('Optional<List<Item>>'), /Store "1" o-- "\*" Item/);
});

test('Java bounded generic wildcards preserve the named element relationship', () => {
  for (const type of ['List<? extends Item>', 'List<? super Item>']) {
    assert.match(diagram(type), /Store "1" o-- "\*" Item/, type);
  }
});

test('Java user-defined generic fields still refer to their outer class', () => {
  const result = analyzeJavaSources({
    'Store.java': 'class Item {} class Envelope<T> {} class Store { Envelope<Item> items; }',
  });
  assert.deepEqual(result.errors, []);
  assert.match(result.classDiagram, /Store "1" --> "1" Envelope/);
  assert.doesNotMatch(result.classDiagram, /Store .* Item\n/);
});
