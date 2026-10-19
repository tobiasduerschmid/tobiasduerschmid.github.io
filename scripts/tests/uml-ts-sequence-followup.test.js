'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
require('../../js/uml-analyzer-js.js');
const compiler = require('../../js/vendor/typescript/5.9.3/typescript.min.js');

function analyze(source) {
  const result = global.analyzeJSSources({ 'main.ts': source }, compiler);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.sequenceWarnings, []);
  return result.sequenceDiagram;
}

function calls(diagram, method) {
  return diagram.split('\n').filter(line => line.includes(`: ${method}(`));
}

test('TypeScript captures a method receiver before an argument rebinds its variable', () => {
  const diagram = analyze(`
    class Service { send(other: Service) {} }
    const first = new Service();
    const second = new Service();
    let current = first;
    current.send(current = second);
    current.send(first);
  `);

  assert.deepEqual(calls(diagram, 'send'), [
    'Main -> first: send(current = second)',
    'Main -> second: send(first)'
  ]);
});

test('TypeScript captures each method argument before evaluating later assignments', () => {
  const diagram = analyze(`
    class Service { run() {} stop() {} }
    class Runner { go(a: Service, b: Service) { a.run(); b.stop(); } }
    const first = new Service();
    const second = new Service();
    let current = first;
    const runner = new Runner();
    runner.go((current as Service), current = second);
  `);

  assert.deepEqual(calls(diagram, 'run'), ['runner -> first: run()']);
  assert.deepEqual(calls(diagram, 'stop'), ['runner -> second: stop()']);
});

test('TypeScript assignment expressions pass their assigned object identity to a method', () => {
  const diagram = analyze(`
    class Service { run() {} stop() {} }
    class Runner { go(a: Service, b: Service) { a.run(); b.stop(); } }
    const first = new Service();
    const second = new Service();
    let current = second;
    const runner = new Runner();
    runner.go(current = first, current = second);
  `);

  assert.deepEqual(calls(diagram, 'run'), ['runner -> first: run()']);
  assert.deepEqual(calls(diagram, 'stop'), ['runner -> second: stop()']);
});

for (const construction of ['const runner = new Runner(current, current = second);',
  'new Runner(current, current = second);']) {
  test(`TypeScript preserves argument identities during construction: ${construction}`, () => {
    const diagram = analyze(`
      class Service { run() {} stop() {} }
      class Runner { constructor(a: Service, b: Service) { a.run(); b.stop(); } }
      const first = new Service();
      const second = new Service();
      let current = first;
      ${construction}
    `);
    const runner = diagram.match(/^participant (\w+): Runner$/m)?.[1];

    assert.ok(runner, 'the constructed Runner has its own lifeline');
    assert.deepEqual(calls(diagram, 'run'), [`${runner} -> first: run()`]);
    assert.deepEqual(calls(diagram, 'stop'), [`${runner} -> second: stop()`]);
  });
}
