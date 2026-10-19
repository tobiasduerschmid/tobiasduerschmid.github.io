'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { analyzeJavaSources } = require('../../js/uml-analyzer-java.js');
require('../../js/uml-analyzer-js.js');
const context = vm.createContext({ console, define(_name, _deps, factory) { factory(() => {}); } });
vm.runInContext(fs.readFileSync(path.join(__dirname,
  '../../js/vendor/monaco-editor/0.44.0/min/vs/language/typescript/tsWorker.js'), 'utf8'), context);

function analyze(language, sources) {
  const result = language === 'java' ? analyzeJavaSources(sources) : global.analyzeJSSources(sources, context.ts);
  assert.deepEqual(result.errors, []);
  return result;
}

function classWithMember(diagram, member) {
  const classes = [...diagram.matchAll(/(?:class|interface) ([\w$]+)(?:[^\n]*) \{\n([^}]*)\}/g)];
  const match = classes.find(item => new RegExp(`\\b${member}\\b`).test(item[2]));
  assert.ok(match, `Class with ${member} must remain in the diagram:\n${diagram}`);
  return match[1];
}

for (const language of ['java', 'ts']) {
  test(`${language}: distinct roles to one target retain their own multiplicities`, () => {
    const source = language === 'java'
      ? 'class Person {} class Office { Person primary; java.util.List<Person> backups; }'
      : 'class Person {} class Office { primary: Person; backups: Person[]; }';
    const diagram = analyze(language, { [`office.${language}`]: source }).classDiagram;
    assert.match(diagram, /Office (?:-->|o--) "1" Person : primary/);
    assert.match(diagram, /Office (?:-->|o--) "\*" Person : backups/);
  });

  test(`${language}: an internally created role does not absorb an injected role`, () => {
    const source = language === 'java'
      ? 'class Engine {} class Pair { Engine owned = new Engine(); Engine shared; Pair(Engine supplied) { this.shared = supplied; } }'
      : 'class Engine {} class Pair { owned = new Engine(); shared: Engine; constructor(supplied: Engine) { this.shared = supplied; } }';
    const diagram = analyze(language, { [`pair.${language}`]: source }).classDiagram;
    assert.match(diagram, /Pair "1" \*-- "1" Engine : owned/);
    assert.match(diagram, /Pair o-- "1" Engine : shared/);
  });

  test(`${language}: self-references retain distinct roles`, () => {
    const source = language === 'java'
      ? 'class Node { Node parent; java.util.List<Node> children; }'
      : 'class Node { parent: Node | null; children: Node[]; }';
    const diagram = analyze(language, { [`tree.${language}`]: source }).classDiagram;
    assert.match(diagram, /Node --> "(?:1|0\.\.1)" Node : parent/);
    assert.match(diagram, /Node (?:-->|o--) "\*" Node : children/);
  });
}

test('TypeScript union relationships retain every alternative, including aliases and collection elements', () => {
  const diagram = analyze('ts', { 'choice.ts': `
    class Cat {} class Dog {}
    type Pet = Cat | Dog;
    class Household { pet: Pet | null; visitors: Array<Pet>; }
  ` }).classDiagram;
  for (const target of ['Cat', 'Dog']) {
    assert.match(diagram, new RegExp(`Household --> "0\\.\\.1" ${target} : pet \\(alternative\\)`));
    assert.match(diagram, new RegExp(`Household --> "\\*" ${target} : visitors \\(alternative\\)`));
  }
});

test('TypeScript supplied imports and aliases keep duplicate class names separate', () => {
  const diagram = analyze('ts', {
    'sales/item.ts': 'export default class Item { salesCode: string; }',
    'stock/item.ts': 'export class Item { stockCode: string; }',
    'order.ts': `import SalesItem from './sales/item'; import * as Stock from './stock/item';
      class Order { sold: SalesItem; stocked: Stock.Item; }`
  }).classDiagram;
  const sales = classWithMember(diagram, 'salesCode');
  const stock = classWithMember(diagram, 'stockCode');
  assert.notEqual(sales, stock);
  assert.match(diagram, new RegExp(`Order --> "1" ${sales}(?:\\n|$)`));
  assert.match(diagram, new RegExp(`Order --> "1" ${stock}(?:\\n|$)`));
});

test('TypeScript unimported module-local names do not invent a global association', () => {
  const diagram = analyze('ts', {
    'a.ts': 'export class Item {}',
    'b.ts': 'export class Holder { item: Item; }'
  }).classDiagram;
  assert.doesNotMatch(diagram, /Holder .* Item(?:\n|$)/);
});

test('Java package-qualified references, explicit imports and same-package lookup preserve duplicate types', () => {
  const diagram = analyze('java', {
    'sales/Item.java': 'package sales; public class Item { String salesCode; }',
    'stock/Item.java': 'package stock; public class Item { String stockCode; }',
    'sales/Order.java': 'package sales; class Order { Item sold; stock.Item stocked; }',
    'app/Basket.java': 'package app; import stock.Item; class Basket { Item selected; }'
  }).classDiagram;
  const sales = classWithMember(diagram, 'salesCode');
  const stock = classWithMember(diagram, 'stockCode');
  assert.notEqual(sales, stock);
  assert.match(diagram, new RegExp(`Order --> "1" ${sales}(?:\\n|$)`));
  assert.match(diagram, new RegExp(`Order --> "1" ${stock}(?:\\n|$)`));
  assert.match(diagram, new RegExp(`Basket --> "1" ${stock}(?:\\n|$)`));
});

test('Java ambiguous wildcard imports do not select an arbitrary class', () => {
  const diagram = analyze('java', {
    'a/Item.java': 'package a; public class Item { int fromA; }',
    'b/Item.java': 'package b; public class Item { int fromB; }',
    'Holder.java': 'import a.*; import b.*; class Holder { Item item; }'
  }).classDiagram;
  assert.doesNotMatch(diagram, /^Holder .*[-]>?.*$/m);
  assert.equal((diagram.match(/^class /gm) || []).length, 3);
});

for (const language of ['java', 'ts']) {
  test(`${language}: an unbound receiver never reuses an unrelated known instance`, () => {
    const source = language === 'java' ? `
      class Service { void run() {} }
      class Runner { Service service; void start() { service.run(); } }
      class Main { public static void main(String[] args) {
        Service unrelated = new Service(); Runner runner = new Runner(); runner.start();
      } }`
      : `class Service { run() {} } class Runner { service: Service; start() { this.service.run(); } }
        const unrelated = new Service(); const runner = new Runner(); runner.start();`;
    const diagram = analyze(language, { [`main.${language}`]: source }).sequenceDiagram;
    assert.doesNotMatch(diagram, /runner -> unrelated: run\(/);
    assert.match(diagram, /runner -> (?:runner_)?service: run\(/);
  });
}

test('Java unimported foreign types and unknown qualified names do not bind by basename', () => {
  const diagram = analyze('java', {
    'domain/Item.java': 'package domain; public class Item {}',
    'app/Holder.java': 'package app; class Holder { Item missingImport; missing.pkg.Item missingType; }'
  }).classDiagram;
  assert.doesNotMatch(diagram, /^Holder .* Item(?: :.*)?$/m);
});

test('Java qualified construction retains the resolved ownership role', () => {
  const diagram = analyze('java', {
    'domain/Item.java': 'package domain; public class Item {}',
    'Holder.java': 'class Holder { domain.Item owned = new domain.Item(); }'
  }).classDiagram;
  assert.match(diagram, /^Holder "1" \*-- "1" Item$/m);
});

test('TypeScript repeated union alternatives do not overwrite a different target', () => {
  const diagram = analyze('ts', { 'choice.ts': 'class Cat {} class Dog {} class Home { pet: Cat | Dog | Cat; }' }).classDiagram;
  assert.equal((diagram.match(/Home .* Cat : pet/g) || []).length, 1);
  assert.equal((diagram.match(/Home .* Dog : pet/g) || []).length, 1);
});

test('TypeScript aliases exported through another file preserve nullable cardinality', () => {
  const diagram = analyze('ts', {
    'model.ts': 'export class Item {} export type Maybe<T> = T | null;',
    'index.ts': "export { Item as Renamed, Maybe } from './model';",
    'holder.ts': "import { Renamed, Maybe } from './index'; export class Holder { item: Maybe<Renamed>; }"
  }).classDiagram;
  assert.match(diagram, /^Holder --> "0\.\.1" Item$/m);
});

test('TypeScript union receivers remain unresolved instead of choosing the first class', () => {
  const diagram = analyze('ts', { 'choice.ts': `class Cat { speak() {} } class Dog { speak() {} }
    class Owner { pet: Cat | Dog; act() { this.pet.speak(); } }
    const cat = new Cat(); const dog = new Dog(); const owner = new Owner(); owner.act();`
  }).sequenceDiagram;
  assert.match(diagram, /Main -> owner: act\(/);
  assert.doesNotMatch(diagram, /owner -> (?:cat|dog|owner_pet): speak\(/);
});

test('Java a single-type import takes precedence over a type in the current package', () => {
  const diagram = analyze('java', {
    'app/Item.java': 'package app; public class Item { int localMarker; }',
    'stock/Item.java': 'package stock; public class Item { int importedMarker; }',
    'app/Holder.java': 'package app; import stock.Item; class Holder { Item item; }'
  }).classDiagram;
  const target = classWithMember(diagram, 'importedMarker');
  assert.match(diagram, new RegExp(`^Holder --> "1" ${target}$`, 'm'));
});

test('Java reciprocal references preserve both directed role cardinalities', () => {
  const diagram = analyze('java', { 'model.java': 'class Parent { Child preferred; Child backup; } class Child { java.util.List<Parent> guardians; }' }).classDiagram;
  assert.match(diagram, /Parent --> "1" Child : preferred/);
  assert.match(diagram, /Parent --> "1" Child : backup/);
  assert.match(diagram, /Child o-- "\*" Parent/);
});

test('Java nested declarations with the same name remain bound to the enclosing type', () => {
  const diagram = analyze('java', { 'model.java': 'class A { class Item { int aMarker; } Item member; } class B { class Item { int bMarker; } Item member; }' }).classDiagram;
  const a = classWithMember(diagram, 'aMarker');
  const b = classWithMember(diagram, 'bMarker');
  assert.notEqual(a, b);
  assert.match(diagram, new RegExp(`^A --> "1" ${a}$`, 'm'));
  assert.match(diagram, new RegExp(`^B --> "1" ${b}$`, 'm'));
});

test('TypeScript imported heritage aliases resolve to the declared base and interface', () => {
  const diagram = analyze('ts', {
    'base.ts': 'export class Base {} export interface Task { run(): void; }',
    'child.ts': "import { Base as Parent, Task as Contract } from './base'; export class Child extends Parent implements Contract { run() {} }"
  }).classDiagram;
  assert.match(diagram, /^Child --\|> Base$/m);
  assert.match(diagram, /^Child \.\.\|> Task$/m);
});

for (const language of ['java', 'ts']) {
  test(`${language}: unavailable constructor names do not bind to unrelated supplied classes`, () => {
    const sources = language === 'java' ? {
      'domain/Service.java': 'package domain; public class Service { public void run() {} }',
      'app/Main.java': 'package app; class Main { public static void main(String[] args) { Service service = new Service(); service.run(); } }'
    } : {
      'service.ts': 'export class Service { run() {} }',
      'main.ts': 'export {}; const service = new Service(); service.run();'
    };
    const diagram = analyze(language, sources).sequenceDiagram;
    assert.doesNotMatch(diagram, /(?:create service|service: run\()/);
  });
}

test('TypeScript a field initializer does not discard its other declared union alternative', () => {
  const diagram = analyze('ts', { 'model.ts': 'class Item {} class Other {} class Box { value: Item | Other = new Item(); }' }).classDiagram;
  assert.match(diagram, /^Box "1" \*-- "0\.\.1" Item : value \(alternative\)$/m);
  assert.match(diagram, /^Box --> "0\.\.1" Other : value \(alternative\)$/m);
});

test('TypeScript optional constructor parameter properties remain optional relationships', () => {
  const diagram = analyze('ts', { 'model.ts': 'class Item {} class Box { constructor(public value?: Item) {} }' }).classDiagram;
  assert.match(diagram, /^Box o-- "0\.\.1" Item$/m);
});

test('TypeScript generic aliases apply defaults in declaration scope and support dependent defaults', () => {
  const diagram = analyze('ts', {
    'model.ts': 'export class Item {} export type Maybe<T = Item, U = T> = U | null;',
    'use.ts': "import { Maybe } from './model'; class Item { otherMarker: string; } class Box { value: Maybe; }"
  }).classDiagram;
  const localItem = classWithMember(diagram, 'otherMarker');
  const target = diagram.match(/^Box --> "0\.\.1" ([\w$]+)$/m);
  assert.ok(target, 'defaulted aliases must preserve the nullable reference');
  assert.notEqual(target[1], localItem, 'an alias default binds in its declaration file');
});

test('Java an imported outer class resolves its nested field type', () => {
  const diagram = analyze('java', {
    'types/Outer.java': 'package types; public class Outer { public static class Item {} }',
    'client/Box.java': 'package client; import types.Outer; class Box { Outer.Item item; }'
  }).classDiagram;
  assert.match(diagram, /^Box --> "1" Item$/m);
});

for (const name of ['Optional', 'List']) {
  test(`Java a supplied generic class named ${name} does not inherit library-wrapper multiplicity`, () => {
    const diagram = analyze('java', { 'model.java': `class Item {} class ${name}<T> {} class Box { ${name}<Item> value; }` }).classDiagram;
    assert.match(diagram, new RegExp(`^Box --> "1" ${name}$`, 'm'));
    assert.doesNotMatch(diagram, /^Box .* Item$/m);
  });
}

for (const language of ['java', 'ts']) {
  for (const declarationOrder of ['before', 'after']) {
    test(`${language}: synthetic field receivers avoid named objects declared ${declarationOrder} their first use`, () => {
      const definitions = language === 'java'
        ? 'class Service { void run() {} } class Runner { Service service; void start() { service.run(); service.run(); } }'
        : 'class Service { run() {} } class Runner { service: Service; start() { this.service.run(); this.service.run(); } }';
      const named = language === 'java'
        ? 'Service runner_service = new Service(); Service runner_service_2 = new Service();'
        : 'const runner_service = new Service(); const runner_service_2 = new Service();';
      const owners = language === 'java'
        ? 'Runner runner = new Runner(); Runner other = new Runner();'
        : 'const runner = new Runner(); const other = new Runner();';
      const statements = `${declarationOrder === 'before' ? named : ''} ${owners}
        runner.start(); other.start(); runner.start();
        ${declarationOrder === 'after' ? named : ''} runner_service.run(); runner_service_2.run();`;
      const source = language === 'java'
        ? `${definitions} class Main { public static void main(String[] args) { ${statements} } }`
        : definitions + statements;
      const diagram = analyze(language, { [`main.${language}`]: source }).sequenceDiagram;
      const destinations = owner => [...diagram.matchAll(new RegExp(`^${owner} -> ([\\w$]+): run\\(\\)$`, 'gm'))].map(match => match[1]);
      const runner = destinations('runner');
      const other = destinations('other');
      assert.equal(runner.length, 4, 'all calls on the same unknown field must remain represented');
      assert.equal(new Set(runner).size, 1, 'a stable owner/field role keeps one synthetic lifeline');
      assert.equal(other.length, 2);
      assert.equal(new Set(other).size, 1);
      assert.notEqual(runner[0], other[0], 'different owners do not share an unknown field identity');
      assert.ok(!['runner_service', 'runner_service_2'].includes(runner[0]), 'unknown fields cannot reuse a named object');
      assert.deepEqual(destinations('Main'), ['runner_service', 'runner_service_2'], 'named object calls retain their identities');
    });
  }

  test(`${language}: unbound parameter receivers avoid named-object collisions`, () => {
    const source = language === 'java'
      ? `class Service { void run() {} } class Runner { void start(Service service) { service.run(); service.run(); } }
         class Main { public static void main(String[] args) {
           Service runner_service = new Service(); Runner runner = new Runner(); runner.start(unknown); runner_service.run();
         } }`
      : `class Service { run() {} } class Runner { start(service: Service) { service.run(); service.run(); } }
         const runner_service = new Service(); const runner = new Runner(); runner.start(unknown); runner_service.run();`;
    const diagram = analyze(language, { [`main.${language}`]: source }).sequenceDiagram;
    const destinations = [...diagram.matchAll(/^runner -> ([\w$]+): run\(\)$/gm)].map(match => match[1]);
    assert.equal(destinations.length, 2);
    assert.equal(destinations[0], destinations[1]);
    assert.notEqual(destinations[0], 'runner_service');
    assert.match(diagram, /^Main -> runner_service: run\(\)$/m);
  });
}
