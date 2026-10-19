'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { analyzeCppSources } = require('../../js/uml-analyzer-cpp.js');

function infer(source, options) {
  const result = analyzeCppSources({ 'main.cpp': source }, options);
  assert.deepEqual(result.errors, [], 'valid C++ examples analyze without errors');
  return result;
}

function relationships(diagram, source) {
  return diagram.split('\n').filter(line => line.startsWith(source + ' ') && /(?:-->|\*--|o--)/.test(line));
}

test('C++ retains distinct fields with the same relationship target and cardinality', () => {
  const { classDiagram } = infer('struct Person {}; struct Team { Person* manager; Person* deputy; };');

  assert.deepEqual(new Set(relationships(classDiagram, 'Team')), new Set([
    'Team "1" --> "0..1" Person : manager',
    'Team "1" --> "0..1" Person : deputy'
  ]));
});

test('C++ repeated targets retain each field role and its own relationship kind and cardinality', () => {
  const { classDiagram } = infer(`
    struct Person {};
    struct Team { Person leader; Person* deputy; std::vector<Person> members; };
  `);

  assert.deepEqual(new Set(relationships(classDiagram, 'Team')), new Set([
    'Team "1" *-- "1" Person : leader',
    'Team "1" --> "0..1" Person : deputy',
    'Team "1" *-- "*" Person : members'
  ]));
});

test('C++ hiding multiplicity still distinguishes repeated field roles', () => {
  const { classDiagram } = infer(`
    struct Person {}; struct Team { Person leader; std::vector<Person> members; };
  `, { hideMultiplicity: true });

  assert.deepEqual(new Set(relationships(classDiagram, 'Team')), new Set([
    'Team *-- Person : leader',
    'Team *-- Person : members'
  ]));
});

test('C++ leaves the compact unambiguous relationship notation unchanged', () => {
  const { classDiagram } = infer('struct Person {}; struct Team { Person* manager; };');

  assert.deepEqual(relationships(classDiagram, 'Team'), ['Team "1" --> "0..1" Person']);
});

test('C++ inherited field receivers use the field declaration namespace despite a shadowing child type', () => {
  const { sequenceDiagram } = infer(`
    namespace original {
      struct Service { void use() {} };
      struct Base { Service service; };
    }
    namespace child {
      struct Service { void use() {} };
      struct Derived : original::Base { void run() { service.use(); } };
    }
    int main() { child::Derived client; client.run(); }
  `);

  assert.match(sequenceDiagram, /participant (\w+): original__Service\n/);
  const receiver = sequenceDiagram.match(/participant (\w+): original__Service\n/)[1];
  assert.ok(sequenceDiagram.includes('client -> ' + receiver + ': use()'));
  assert.doesNotMatch(sequenceDiagram, /participant \w+: child__Service\n/);
});

test('C++ distinct qualified classes cannot collide with underscore-containing class names', () => {
  const { classDiagram, sequenceDiagram } = infer(`
    namespace shipping { struct Item { void ship() {} }; }
    struct shipping__Item { void count() {} };
    struct Store { shipping::Item parcel; shipping__Item stock; };
    int main() {
      shipping::Item parcel; shipping__Item stock;
      parcel.ship(); stock.count();
    }
  `);

  const parcelClass = classDiagram.match(/class (\w+) \{\s*\+ship\(\)/)[1];
  const stockClass = classDiagram.match(/class (\w+) \{\s*\+count\(\)/)[1];
  assert.notEqual(parcelClass, stockClass, 'different C++ types need different diagram class identities');
  assert.ok(classDiagram.includes('Store "1" *-- "1" ' + parcelClass));
  assert.ok(classDiagram.includes('Store "1" *-- "1" ' + stockClass));
  assert.ok(sequenceDiagram.includes('participant parcel: ' + parcelClass));
  assert.ok(sequenceDiagram.includes('participant stock: ' + stockClass));
});
