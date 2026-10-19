'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
require('../../js/uml-analyzer-python.js');

function infer(source) {
  const result = global.analyzePythonSources({ 'main.py': source });
  assert.deepEqual(result.errors, []);
  return result;
}

function messages(result) {
  return result.sequenceDiagram.split('\n').filter(line => /^\S+ -> \S+: /.test(line));
}

const collaborators = `class Worker:
    def work(self, ignored=None):
        return 1
class Other:
    def work(self, ignored=None):
        return 2
class Holder:
    def __init__(self, current, ignored=None):
        self.current = current
    def replace(self, replacement):
        self.current = replacement
        return 1
class Runner:
    def run(self, worker, ignored=None):
        worker.work()
first = Worker()
second = Other()
holder = Holder(first)
runner = Runner()
`;

for (const expression of ['flag and holder.replace(second)', 'flag or holder.replace(second)', '0 < value < holder.replace(second)']) {
  test(`${expression} cannot make a conditional replacement the certain later receiver`, () => {
    const result = infer(collaborators + expression + '\nholder.current.work()');

    assert.deepEqual(messages(result), ['Main -> holder: replace(second)']);
    assert.ok(result.sequenceWarnings.some(warning => warning.code === 'unresolved'));
  });
}

test('short-circuit replacements of the same type retain a symbolic receiver without choosing an input object', () => {
  const result = infer(collaborators + 'third = Worker()\nflag and holder.replace(third)\nholder.current.work()');
  const work = messages(result).find(line => line.endsWith(': work()'));

  assert.ok(work, 'both conditional outcomes retain a known Worker type');
  assert.doesNotMatch(work, /^Main -> (?:first|third):/);
  assert.ok(result.sequenceWarnings.some(warning => warning.code === 'identity'));
});

test('short-circuit paths that agree on the object keep its identity without an ambiguity warning', () => {
  const result = infer(collaborators + 'flag and holder.replace(first)\nholder.current.work()');

  assert.deepEqual(messages(result), ['Main -> holder: replace(first)', 'Main -> first: work()']);
  assert.ok(!result.sequenceWarnings.some(warning => warning.code === 'identity'));
});

test('a receiver evaluated before argument side effects keeps its original object', () => {
  const result = infer(collaborators + 'holder.current.work(holder.replace(second))\nholder.current.work()');

  assert.deepEqual(messages(result), [
    'Main -> holder: replace(second)',
    'Main -> first: work(holder.replace(second))',
    'Main -> second: work()',
  ]);
});

for (const call of [
  'runner.run(holder.current, holder.replace(second))',
  'runner.run(worker=holder.current, ignored=holder.replace(second))',
]) {
  test(`${call} preserves an earlier argument binding through later argument side effects`, () => {
    const result = infer(collaborators + call);

    assert.deepEqual(messages(result), [
      'Main -> holder: replace(second)',
      'Main -> runner: ' + call.substring('runner.'.length),
      'runner -> first: work()',
    ]);
  });
}

test('constructor injection preserves an earlier argument binding through later argument side effects', () => {
  const result = infer(collaborators + 'copy = Holder(holder.current, holder.replace(second))\ncopy.current.work()');

  assert.deepEqual(messages(result), ['Main -> holder: replace(second)', 'Main -> first: work()']);
});

test('an inline constructor argument retains the created object identity in the called body', () => {
  const result = infer(collaborators + 'runner.run(Worker())');
  const created = result.sequenceDiagram.match(/^Main --> (\S+): <<create>>$/gm).at(-1).split(' ')[2].slice(0, -1);

  assert.deepEqual(messages(result), ['Main -> runner: run(Worker())', 'runner -> ' + created + ': work()']);
});

for (const target of ['first', '(first, index)', '[first, index]', '(index, *first)']) {
  test(`for-loop target ${target} cannot reuse its object binding from before the loop`, () => {
    const result = infer(collaborators + `for ${target} in unknown:\n    first.work()\nfirst.work()`);

    assert.deepEqual(messages(result), []);
    assert.ok(result.sequenceWarnings.some(warning => warning.code === 'unresolved'));
  });
}

test('a for-loop field target cannot reuse its object binding from before the loop', () => {
  const result = infer(collaborators + 'for holder.current in unknown:\n    holder.current.work()');

  assert.deepEqual(messages(result), []);
  assert.ok(result.sequenceWarnings.some(warning => warning.code === 'unresolved'));
});

test('an inferred loop element type receives its own lifeline instead of a previous local object identity', () => {
  const result = infer(collaborators + `class Group:
    items: list[Other]
    def visit(self, previous):
        item = previous
        for item in self.items:
            item.work()
group = Group()
group.visit(first)
`);
  const work = messages(result).find(line => line.endsWith(': work()'));
  const receiver = work && work.split(' -> ')[1].split(':')[0];

  assert.ok(receiver, 'the collection annotation supplies the element type');
  assert.notEqual(receiver, 'first');
  assert.ok(result.sequenceDiagram.includes('participant ' + receiver + ': Other'));
});
