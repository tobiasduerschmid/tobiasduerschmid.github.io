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

for (const declaration of [
  'Item[] items = new Item[10];',
  'Item[][] items = new Item[2][10];',
  'Item[] items; Store() { this.items = new Item[10]; }',
]) {
  test(`Java reference-array allocation does not construct owned elements: ${declaration}`, () => {
    const result = analyzeJavaSources({ 'Store.java': `class Item {} class Store { ${declaration} }` });
    assert.deepEqual(result.errors, []);
    assert.match(result.classDiagram, /Store --> "\*" Item/);
    assert.doesNotMatch(result.classDiagram, /Store .*\*--.*Item/);
    assert.doesNotMatch(result.classDiagram, /"10"/);
  });
}

test('Java construction establishes a reference without proving composition', () => {
  const result = analyzeJavaSources({ 'Store.java': 'class Item {} class Store { Item item = new Item(); }' });
  assert.deepEqual(result.errors, []);
  assert.match(result.classDiagram, /Store --> "0\.\.1" Item/);
});

for (const method of ['Store()', 'void addBatch()']) {
  test(`Java array insertion does not create owned elements in ${method}`, () => {
    const result = analyzeJavaSources({ 'Store.java': `import java.util.List;
      class Item {} class Store { List<Item[]> items;
        ${method} { this.items.add(new Item[10]); }
      }` });
    assert.deepEqual(result.errors, []);
    assert.doesNotMatch(result.classDiagram, /Store .*\*--.*Item/);
    assert.match(result.classDiagram, /Store .*"\*" Item/);
  });
}

test('Java array dimensions are evaluated without invoking element constructors', () => {
  const result = analyzeJavaSources({ 'App.java': `
    class Item { Item() { this.initialize(); } void initialize() {} }
    class Counter { int size() { return 10; } }
    class App { public static void main(String[] args) {
      Counter counter = new Counter();
      Item[] items = new Item[counter.size()];
    } }` });
  assert.deepEqual(result.errors, []);
  assert.match(result.sequenceDiagram, /Main -> counter: size\(\)/);
  assert.doesNotMatch(result.sequenceDiagram, /create items|initialize\(\)|participant items/);
});

test('Java resolves a qualified generic element without treating its package as the outer type', () => {
  assert.match(diagram('java.util.List<domain.Item>'), /Store --> "\*" Item/);
});

test('Java follows nested collection and map-value types to their element class', () => {
  for (const type of ['List<List<Item>>', 'Map<String, List<Item>>', 'List<Map<String, Item>>']) {
    assert.match(diagram(type), /Store --> "\*" Item/, type);
  }
});

test('Java distinguishes an optional single reference from a collection of references', () => {
  const single = diagram('Optional<Item>');
  assert.match(single, /Store --> "0\.\.1" Item/);
  assert.doesNotMatch(single, /Store .*"\*" Item/);
  assert.match(diagram('Optional<List<Item>>'), /Store --> "\*" Item/);
});

test('Java bounded generic wildcards preserve the named element relationship', () => {
  for (const type of ['List<? extends Item>', 'List<? super Item>']) {
    assert.match(diagram(type), /Store --> "\*" Item/, type);
  }
});

test('Java user-defined generic fields still refer to their outer class', () => {
  const result = analyzeJavaSources({
    'Store.java': 'class Item {} class Envelope<T> {} class Store { Envelope<Item> items; }',
  });
  assert.deepEqual(result.errors, []);
  assert.match(result.classDiagram, /Store --> "0\.\.1" Envelope/);
  assert.doesNotMatch(result.classDiagram, /Store .* Item\n/);
});
