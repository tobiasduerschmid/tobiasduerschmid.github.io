'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const diagnostics = fs.readFileSync(path.join(__dirname, '../../js/uml-sequence-diagnostics.js'), 'utf8');
const constants = fs.readFileSync(path.join(__dirname, '../../js/uml-constant-values.js'), 'utf8');
const analyzer = fs.readFileSync(path.join(__dirname, '../../js/uml-analyzer-java.js'), 'utf8');

function infer(source) {
  // A synchronous parser loop must fail the test rather than hang the test runner.
  return vm.runInNewContext(diagnostics + '\n' + constants + '\n' + analyzer + '\nanalyzeJavaSources(sources)', {
    sources: { 'Example.java': source }
  }, { timeout: 1000 });
}

test('Java accepts array dimensions after parameter names', () => {
  const result = infer('class Example { public void read(int values[], String grid[][]) {} }');
  assert.equal(result.errors.length, 0);
  assert.match(result.classDiagram, /\+read\(values: int\[\], grid: String\[\]\[\]\)/);
});

test('Java sequence inference passes standalone blocks and preserves following calls', () => {
  const result = infer(`
    class Reader { void read() {} }
    class Example { public static void main(String[] args) {
      Reader reader = new Reader();
      { reader.read(); }
      reader.read();
    } }
  `);
  assert.equal(result.errors.length, 0);
  assert.equal((result.sequenceDiagram.match(/Main -> reader: read\(\)/g) || []).length, 2);
});

test('Java bounds sequence expansion without returning a partial diagram', () => {
  const repeated = method => `this.${method}();`.repeat(20);
  const result = infer(`
    class Fanout {
      void run() { ${repeated('middle')} }
      void middle() { ${repeated('leaf')} }
      void leaf() { ${repeated('ping')} }
      void ping() {}
      public static void main(String[] args) { Fanout fanout = new Fanout(); fanout.run(); }
    }
  `);
  assert.match(result.classDiagram, /class Fanout/);
  assert.equal(result.sequenceDiagram, '');
  assert.ok(result.errors.some(error => /sequence inference limit/i.test(error)));
});

for (const source of [
  'class Example { void keepRoster(Roster* roster) {} }',
  'class Example { void read(int value = ) {} }',
  'class Example { void read( }',
  'enum Example { RED, ? }',
  'enum Example { RED, " }',
  'class Example { static void main(String[] args) { f (true) { } else { } } }',
]) {
  test(`Java finishes inference for incomplete editor input: ${source}`, () => {
    const result = infer(source);
    assert.equal(typeof result.classDiagram, 'string');
    assert.equal(typeof result.sequenceDiagram, 'string');
    const repaired = infer('class Example { public void read(int value) {} }');
    assert.match(repaired.classDiagram, /\+read\(value: int\)/);
  });
}
