'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
require('../../js/uml-analyzer-python.js');

function infer(sources, options) {
  const result = global.analyzePythonSources(typeof sources === 'string' ? { 'model.py': sources } : sources, options);
  assert.deepEqual(result.errors, []);
  return result;
}

function edges(diagram, source) {
  return diagram.split('\n').filter(line => line.startsWith(source + ' ') && /[.>*o-]{2,}/.test(line)).sort();
}

const types = 'class Item:\n    pass\nclass Other:\n    pass\n';

test('separate scalar and collection fields preserve their roles and multiplicities', () => {
  const { classDiagram } = infer(types + 'class Box:\n    primary: Item\n    others: list[Item]\n');
  assert.deepEqual(edges(classDiagram, 'Box'), ['Box --> "*" Item : others', 'Box --> "1" Item : primary']);
});

test('retained fields preserve distinct roles without inferring ownership from allocation', () => {
  const { classDiagram } = infer(types + `class Box:
    def __init__(self, primary: Item):
        self.primary: Item = primary
        self.owned: list[Item] = []
        self.shared: list[Item] = []
    def add(self, item: Item):
        self.shared.append(item)
        self.owned.append(Item())
`);
  assert.deepEqual(edges(classDiagram, 'Box'), [
    'Box --> "*" Item : owned', 'Box --> "*" Item : shared', 'Box --> "1" Item : primary',
  ]);
});

for (const annotation of ['Item | Other', 'Union[Item, Other]', '"typing.Union[Item, Other]"']) {
  test(`${annotation} retains both alternative targets as optional scalar relationships`, () => {
    const { classDiagram } = infer(types + `class Box:\n    value: ${annotation}\n`);
    assert.deepEqual(edges(classDiagram, 'Box'), ['Box --> "0..1" Item', 'Box --> "0..1" Other']);
  });
}

test('nested collection alternatives keep each target cardinality independent', () => {
  const { classDiagram } = infer(types + 'class Box:\n    value: "Item | dict[str, list[Other]] | None"\n');
  assert.deepEqual(edges(classDiagram, 'Box'), ['Box --> "*" Other', 'Box --> "0..1" Item']);
});

test('unannotated assignments retain all targets and multiplicities from the supplied parameter', () => {
  const { classDiagram } = infer(types + `class Box:
    def __init__(self, value: Item | list[Other]):
        self.value = value
`);
  assert.deepEqual(edges(classDiagram, 'Box'), ['Box --> "*" Other', 'Box --> "0..1" Item']);
});

test('union parameter and return dependencies retain every known class', () => {
  const { classDiagram } = infer(types + 'class Service:\n    def convert(self, value: Item | Other) -> Item | Other:\n        pass\n');
  assert.deepEqual(edges(classDiagram, 'Service'), ['Service ..> Item', 'Service ..> Other']);
});

test('explicit imports disambiguate same-named classes across supplied modules', () => {
  const { classDiagram } = infer({
    'catalog.py': 'class Item:\n    pass\n',
    'inventory.py': 'class Item:\n    pass\n',
    'store.py': 'from catalog import Item as Product\nimport inventory as stock\nclass Store:\n    product: Product\n    stocked: list[stock.Item]\n',
  });
  assert.match(classDiagram, /^class catalog__Item \{/m);
  assert.match(classDiagram, /^class inventory__Item \{/m);
  assert.deepEqual(edges(classDiagram, 'Store'), ['Store --> "*" inventory__Item', 'Store --> "1" catalog__Item']);
});

test('an ambiguous bare name is retained as an annotation without an invented target', () => {
  const { classDiagram } = infer({
    'catalog.py': 'class Item:\n    pass\n',
    'inventory.py': 'class Item:\n    pass\n',
    'store.py': 'class Store:\n    item: Item\n',
  });
  assert.deepEqual(edges(classDiagram, 'Store'), []);
  assert.match(classDiagram, /\+item: Item/);
});

test('relative imports, re-exports and type aliases resolve within supplied packages', () => {
  const { classDiagram } = infer({
    'shop/types.py': types,
    'shop/__init__.py': 'from .types import Item as Product\n',
    'shop/store.py': 'from . import Product\nfrom .types import Other\nfrom typing import Optional as Maybe\nChoice = Product | list[Other]\nclass Store:\n    product: Maybe[Product]\n    choice: Choice\n',
  });
  assert.deepEqual(edges(classDiagram, 'Store'), [
    'Store --> "*" Other', 'Store --> "0..1" Item : choice', 'Store --> "0..1" Item : product',
  ]);
});

test('qualified constructor aliases and inheritance resolve to their declared class', () => {
  const { classDiagram } = infer({
    'parts.py': 'class Item:\n    pass\n',
    'main.py': 'import parts as p\nfrom parts import Item as Base\nclass Special(Base):\n    pass\nclass Box:\n    def __init__(self):\n        self.item = p.Item()\n',
  });
  assert.match(classDiagram, /^Special --\|> Item$/m);
  assert.deepEqual(edges(classDiagram, 'Box'), ['Box --> Item']);
});

test('a local shadow of an imported constructor does not fabricate ownership', () => {
  const { classDiagram } = infer({
    'parts.py': 'class Item:\n    pass\n',
    'main.py': 'from parts import Item\nclass Box:\n    def build(self, Item):\n        self.item = Item()\n',
  });
  assert.deepEqual(edges(classDiagram, 'Box'), []);
});

test('single-role tutorial notation stays unlabelled when multiplicities are hidden', () => {
  const { classDiagram } = infer(types + 'class Box:\n    items: list[Item]\n', { hideMultiplicity: true });
  assert.deepEqual(edges(classDiagram, 'Box'), ['Box --> Item']);
});

test('reciprocal relationships retain distinct roles instead of merging unrelated cardinalities', () => {
  const { classDiagram } = infer(`class Group:
    primary: "Node"
    backups: list["Node"]
class Node:
    group: Group
`);
  assert.deepEqual(edges(classDiagram, 'Group'), [
    'Group --> "*" Node : backups', 'Group --> "1" Node : primary',
  ]);
  assert.deepEqual(edges(classDiagram, 'Node'), ['Node --> "1" Group']);
});

test('a local class named Optional is not the nullable typing wrapper', () => {
  const { classDiagram } = infer(types + 'class Optional:\n    pass\nclass Box:\n    value: Optional[Item]\n');
  assert.doesNotMatch(classDiagram, /^Box .* Item$/m);
});

test('a shadowed type annotation does not reuse a same-named class from another scope', () => {
  const { classDiagram } = infer(types + 'class Box:\n    Item = 3\n    value: Item\n');
  assert.deepEqual(edges(classDiagram, 'Box'), []);
  assert.match(classDiagram, /\+value: Item/);
});

test('import and type-alias cycles remain unresolved without crashing', () => {
  const { classDiagram } = infer({
    'a.py': 'from b import Choice\nclass Box:\n    value: Choice\n',
    'b.py': 'from a import Choice\n',
    'c.py': 'First = Second\nSecond = First\nclass Other:\n    value: First\n',
  });
  assert.deepEqual(edges(classDiagram, 'Box'), []);
  assert.deepEqual(edges(classDiagram, 'Other'), []);
});

test('nested classes resolve through their containing class', () => {
  const { classDiagram } = infer(`class Left:
    class Item:
        pass
class Right:
    class Item:
        pass
class Box:
    left: Left.Item
    right: Right.Item
`);
  assert.deepEqual(edges(classDiagram, 'Box'), ['Box --> "1" model__Left__Item', 'Box --> "1" model__Right__Item']);
});

test('unavailable explicit imports do not fall back to unrelated supplied classes', () => {
  const { classDiagram } = infer({
    'known.py': types,
    'box.py': 'from unavailable import Item\nclass Box:\n    value: Item\n',
  });
  assert.deepEqual(edges(classDiagram, 'Box'), []);
});

test('reassigned type aliases remain unresolved rather than choosing their final assignment for every use', () => {
  const { classDiagram } = infer(types + `Alias = Item
class First:
    value: Alias
Alias = Other
class Second:
    value: Alias
`);
  assert.deepEqual(edges(classDiagram, 'First'), []);
  assert.deepEqual(edges(classDiagram, 'Second'), []);
});

for (const wrapper of ['Box', 'Optional', 'List']) {
  test(`a supplied generic ${wrapper} field refers to its outer class, not its type argument`, () => {
    const { classDiagram } = infer(`from __future__ import annotations
from typing import Generic, TypeVar
T = TypeVar('T')
class Item:
    pass
class ${wrapper}(Generic[T]):
    pass
class Owner:
    field: ${wrapper}[Item]
`);
    assert.deepEqual(edges(classDiagram, 'Owner'), [`Owner --> "1" ${wrapper}`]);
  });
}

for (const annotation of ['Item', 'known.Item']) {
  test(`an unimported ${annotation} does not bind to a class just because its file was supplied`, () => {
    const { classDiagram } = infer({
      'known.py': 'class Item:\n    pass\n',
      'other.py': `class Box:\n    item: ${annotation}\n`,
    });
    assert.deepEqual(edges(classDiagram, 'Box'), []);
    assert.ok(classDiagram.includes(`+item: ${annotation}`));
  });
}

test('method bodies skip the class namespace while class-body annotations retain it', () => {
  const { classDiagram, sequenceDiagram } = infer(`class Service:
    def run(self):
        pass
class Outer:
    class Service:
        def run(self):
            pass
    configured: Service
    def use(self):
        service = Service()
        service.run()
o = Outer()
o.use()
`);
  assert.deepEqual(edges(classDiagram, 'Outer'), [
    'Outer --> "1" model__Outer__Service', 'Outer ..> model__Service',
  ]);
  assert.match(sequenceDiagram, /^participant o_service: model__Service$/m);
  assert.doesNotMatch(sequenceDiagram, /^participant o_service: model__Outer__Service$/m);
});

test('a missing qualified class member does not fall back to a module-level type', () => {
  const { classDiagram } = infer('class Item:\n    pass\nclass Outer:\n    pass\nclass Box:\n    item: Outer.Item\n');
  assert.deepEqual(edges(classDiagram, 'Box'), []);
});
