'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { analyzeCppSources } = require('../../js/uml-analyzer-cpp.js');

function infer(source) {
  const result = analyzeCppSources({ 'main.cpp': source });
  assert.deepEqual(result.errors, [], 'valid C++ examples should analyze successfully');
  return result;
}

function calls(result) {
  return result.sequenceDiagram.split('\n').filter(line => line.includes(' -> '));
}

for (const declaration of [
  'Worker& alias(first)', 'Worker& alias{first}',
  'Worker* alias(&first)', 'Worker* alias{&first}',
  'Borrowed alias(first)'
]) {
  test(`C++ direct initialization preserves the borrowed receiver: ${declaration}`, () => {
    const access = declaration.includes('Worker*') ? '->' : '.';
    const result = infer(`struct Worker { void run() {} }; using Borrowed = Worker&;
      int main() { Worker first; ${declaration}; alias${access}run(); }`);
    assert.deepEqual(calls(result), ['Main -> first: run()']);
    assert.deepEqual(result.sequenceDiagram.match(/^create .+$/gm), ['create first']);
    assert.deepEqual(result.sequenceWarnings, []);
  });
}

test('C++ nested blocks propagate the returned receiver and skip unreachable statements', () => {
  const result = infer(`struct Worker { void run() {} };
    Worker& pick(Worker& first, Worker& second) {
      { { return first; } second.run(); }
      return second;
    }
    int main() { Worker first; Worker second; pick(first, second).run(); }`);
  assert.deepEqual(calls(result), ['Main -> Main: pick(first, second)', 'Main -> first: run()']);
  assert.deepEqual(result.sequenceWarnings, []);
});

test('C++ a void return in a nested block ends only its current invocation', () => {
  const result = infer(`struct Worker {
      void run() {} void finish() {}
      void stop() { { return; } run(); }
    };
    int main() { Worker worker; worker.stop(); worker.finish(); }`);
  assert.deepEqual(calls(result), ['Main -> worker: stop()', 'Main -> worker: finish()']);
  assert.deepEqual(result.sequenceWarnings, []);
});

test('C++ a nested loop break omits the remaining body and increment calls', () => {
  const result = infer(`struct Worker { void run() {} void step() {} void finish() {} };
    int main() {
      Worker worker;
      for (int i = 0; i < 3; worker.step()) { { break; } worker.run(); }
      worker.finish();
    }`);
  assert.deepEqual(calls(result), ['Main -> worker: finish()']);
  assert.ok(result.sequenceWarnings.some(warning => warning.code === 'control'));
});

test('C++ a nested loop continue still evaluates its increment and next condition', () => {
  const result = infer(`struct Worker { bool check() { return true; } void run() {} void step() {} };
    int main() {
      Worker worker;
      for (; worker.check(); worker.step()) { { continue; } worker.run(); }
    }`);
  assert.deepEqual(calls(result), [
    'Main -> worker: check()', 'Main -> worker: step()', 'Main -> worker: check()'
  ]);
});

for (const allocation of ['new Worker()', 'std::make_shared<Worker>()']) {
  test(`C++ a nested allocation cannot swallow the enclosing call: ${allocation}`, () => {
    const type = allocation.startsWith('new') ? 'Worker*' : 'std::shared_ptr<Worker>';
    const result = infer(`#include <memory>
      struct Worker { void run() {} };
      ${type} choose(${type} worker) { worker->run(); return worker; }
      int main() { auto selected = choose(${allocation}); selected->run(); }`);
    assert.deepEqual(calls(result).map(line => line.match(/: (\w+)\(/)[1]), ['choose', 'run', 'run']);
    assert.ok(result.sequenceWarnings.some(warning => warning.code === 'unsupported'),
      'allocation expressions outside supported declaration construction must be disclosed');
  });
}

for (const initializer of ['= new Worker()', '(new Worker())', '{new Worker()}']) {
  test(`C++ complete allocation initializers remain supported: ${initializer}`, () => {
    const result = infer(`struct Worker { void run() {} };
      int main() { Worker* worker ${initializer}; worker->run(); }`);
    assert.deepEqual(calls(result), ['Main -> worker: run()']);
    assert.deepEqual(result.sequenceDiagram.match(/^create .+$/gm), ['create worker']);
    assert.deepEqual(result.sequenceWarnings, []);
  });
}

for (const declaration of [
  'auto worker(new Worker())',
  'auto worker{std::make_unique<Worker>()}',
  'auto worker(std::make_shared<Worker>())',
  'std::unique_ptr<Worker> worker(new Worker())',
  'std::unique_ptr<Worker> worker{std::make_unique<Worker>()}',
  'Owned worker(new Worker())'
]) {
  test(`C++ deduced and owning direct initializers retain their allocation: ${declaration}`, () => {
    const result = infer(`#include <memory>
      struct Worker { void run() {} }; using Owned = std::unique_ptr<Worker>;
      int main() { ${declaration}; worker->run(); }`);
    assert.deepEqual(calls(result), ['Main -> worker: run()']);
    assert.deepEqual(result.sequenceDiagram.match(/^create .+$/gm), ['create worker']);
    assert.deepEqual(result.sequenceWarnings, []);
  });
}

test('C++ a value object keeps its own construction when its argument allocates another object', () => {
  const result = infer(`struct Worker { void run() {} };
    struct Holder { Holder(Worker* worker) {} void open() {} };
    int main() { Holder holder(new Worker()); holder.open(); }`);
  assert.match(result.sequenceDiagram, /^participant holder: Holder$/m);
  assert.deepEqual(calls(result), ['Main -> holder: open()']);
  assert.deepEqual(result.sequenceDiagram.match(/^create .+$/gm), ['create holder']);
  assert.ok(result.sequenceWarnings.some(warning => warning.code === 'unsupported'));
});

test('C++ direct deduced initialization does not swallow a call containing an allocation', () => {
  const result = infer(`struct Worker { void run() {} };
    Worker* choose(Worker* worker) { worker->run(); return worker; }
    int main() { auto worker(choose(new Worker())); worker->run(); }`);
  assert.deepEqual(calls(result).map(line => line.match(/: (\w+)\(/)[1]), ['choose', 'run', 'run']);
  assert.ok(result.sequenceWarnings.some(warning => warning.code === 'unsupported'));
});

test('C++ nullable value wrappers preserve construction from a non-allocation argument', () => {
  const result = infer(`#include <optional>
    struct Worker { Worker(int count) { start(); } void start() {} void run() {} };
    int main() { std::optional<Worker> worker{1}; worker->run(); }`);
  assert.deepEqual(calls(result), ['worker -> worker: start()', 'Main -> worker: run()']);
  assert.deepEqual(result.sequenceDiagram.match(/^create .+$/gm), ['create worker']);
  assert.deepEqual(result.sequenceWarnings, []);
});

test('C++ reports incomplete value-copy initialization from a known object', () => {
  const result = infer(`struct Worker { void run() {} };
    int main() { Worker first; Worker second = first; second.run(); }`);
  assert.ok(result.sequenceWarnings.some(warning => warning.code === 'unsupported'),
    'value copies must not silently imply that the copy is the original object');
  assert.match(result.sequenceDiagram, /Warning: partial sequence inference/);
});

for (const type of ['auto', 'const auto']) {
  test(`C++ reports incomplete deduced value-copy initialization: ${type}`, () => {
    const result = infer(`struct Worker { void run() {} };
      int main() { Worker first; ${type} second = first; second.run(); }`);
    assert.ok(result.sequenceWarnings.some(warning => warning.code === 'unsupported'),
      'deducing the copied value type must not hide the incomplete copy semantics');
    assert.match(result.sequenceDiagram, /Warning: partial sequence inference/);
  });
}

for (const type of ['auto&', 'auto&&']) {
  test(`C++ deduced borrowing needs no value-copy warning: ${type}`, () => {
    const result = infer(`struct Worker { void run() {} };
      int main() { Worker first; ${type} borrowed = first; borrowed.run(); }`);
    assert.deepEqual(calls(result), ['Main -> first: run()']);
    assert.deepEqual(result.sequenceWarnings, []);
  });
}

test('C++ borrowing a known object needs no value-copy warning', () => {
  const result = infer(`struct Worker { void run() {} };
    int main() { Worker first; Worker& borrowed = first; borrowed.run(); }`);
  assert.deepEqual(calls(result), ['Main -> first: run()']);
  assert.deepEqual(result.sequenceWarnings, []);
});

test('C++ a nested break ends its nearest loop and preserves the enclosing iteration', () => {
  const result = infer(`struct Worker { void run() {} int step() { return 1; } void finish() {} };
    int main() {
      Worker worker;
      for (int i = 0; i < 2; i += worker.step()) {
        while (true) { { { break; } } worker.finish(); }
        { { worker.run(); } }
      }
      worker.finish();
    }`);
  assert.deepEqual(calls(result), [
    'Main -> worker: run()', 'Main -> worker: step()', 'Main -> worker: finish()'
  ]);
});

test('C++ an unconditional nested return after a loop remains the returned receiver', () => {
  const result = infer(`struct Worker { void run() {} };
    Worker& pick(Worker& first, Worker& second) {
      for (int i = 0; i < 2; ++i) { first.run(); }
      { { { return first; } } second.run(); }
      return second;
    }
    int main() { Worker first; Worker second; pick(first, second).run(); }`);
  assert.deepEqual(calls(result), [
    'Main -> Main: pick(first, second)', 'Main -> first: run()', 'Main -> first: run()'
  ]);
});

test('C++ returns inside loops disclose that continuation after the loop is approximate', () => {
  const result = infer(`struct Worker { bool check() { return true; } void run() {} };
    int main() { Worker worker; do { { { return 0; } } } while (worker.check()); worker.run(); }`);
  assert.ok(result.sequenceWarnings.some(warning => warning.code === 'control'));
  assert.ok(calls(result).every(line => !line.includes(': check(')),
    'the loop condition cannot execute after the unconditional return in its body');
});
