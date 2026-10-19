'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
require('../../js/uml-analyzer-python.js');

function diagram(source) {
  const result = global.analyzePythonSources({ 'example.py': source });
  assert.deepEqual(result.errors, []);
  return result.sequenceDiagram;
}

function calls(source) {
  return diagram(source).split('\n').filter(line => line.includes(' -> '));
}

const probe = `
class Probe:
    def ready(self) -> bool:
        return True
    def alternate(self) -> bool:
        return False
    def read(self) -> int:
        return 7
    def work(self, value=0) -> None:
        pass
    def values(self) -> list:
        return [1, 2]
`;

test('calls that compute an if guard precede its conditional body', () => {
  const output = diagram(probe + `
probe = Probe()
if probe.ready():
    probe.work()
`);
  const guardCall = output.indexOf('Main -> probe: ready()');
  assert.ok(guardCall >= 0 && guardCall < output.indexOf('opt [probe.ready()]'));
  assert.match(output, /opt \[probe\.ready\(\)\][\s\S]*Main -> probe: work\(\)/);
});

for (const [operator, guard] of [['and', 'probe.ready()'], ['or', 'not (probe.ready())']]) {
  test(`the right side of ${operator} remains conditional`, () => {
    const output = diagram(probe + `
probe = Probe()
if probe.ready() ${operator} probe.alternate():
    probe.work()
`);
    const secondCall = output.indexOf('Main -> probe: alternate()');
    const conditional = output.indexOf(`opt [${guard}]`);
    assert.ok(conditional >= 0 && secondCall > conditional, 'The second predicate must be inside its short-circuit condition');
    assert.equal((output.match(/Main -> probe: ready\(\)/g) || []).length, 1);
  });
}

test('an elif predicate is evaluated only in the first condition’s else path', () => {
  const output = diagram(probe + `
probe = Probe()
if probe.ready():
    probe.work(1)
elif probe.alternate():
    probe.work(2)
else:
    probe.work(3)
`);
  const secondCall = output.indexOf('Main -> probe: alternate()');
  assert.ok(secondCall > output.indexOf('else [else]'), 'An elif predicate is not an unconditional prelude or part of the first branch');
  assert.ok(secondCall < output.indexOf('alt [probe.alternate()]'), 'The elif predicate must run before choosing its own branch');
});

test('a for iterable is evaluated once before the loop fragment', () => {
  const output = diagram(probe + `
probe = Probe()
for value in probe.values():
    probe.work(value)
`);
  assert.ok(output.indexOf('Main -> probe: values()') >= 0);
  assert.ok(output.indexOf('Main -> probe: values()') < output.indexOf('loop ['));
  assert.equal((output.match(/Main -> probe: values\(\)/g) || []).length, 1);
});

test('a while condition is evaluated initially and again after its body', () => {
  assert.deepEqual(calls(probe + `
probe = Probe()
while probe.ready():
    probe.work()
`), ['Main -> probe: ready()', 'Main -> probe: work()', 'Main -> probe: ready()']);
});

test('breaking from a while loop does not evaluate its guard again', () => {
  assert.deepEqual(calls(probe + `
probe = Probe()
while probe.ready():
    probe.work()
    break
`), ['Main -> probe: ready()', 'Main -> probe: work()']);
});

test('an unreachable break after continue does not suppress a while recheck', () => {
  assert.deepEqual(calls(probe + `
probe = Probe()
while probe.ready():
    probe.work()
    continue
    break
`), ['Main -> probe: ready()', 'Main -> probe: work()', 'Main -> probe: ready()']);
});

test('later chained-comparison calls are guarded by preceding comparisons', () => {
  const output = diagram(probe + `
probe = Probe()
if 0 < probe.read() < probe.values():
    probe.work()
`);
  const guard = output.indexOf('opt [0 < probe.read()]');
  const laterCall = output.indexOf('Main -> probe: values()');
  assert.ok(guard >= 0 && laterCall > guard);
  assert.equal((output.match(/Main -> probe: read\(\)/g) || []).length, 1);
});

test('dictionary keys and values execute as pairs before the enclosing call', () => {
  const messages = calls(probe + `
probe = Probe()
probe.work({probe.read(): probe.ready(), probe.alternate(): probe.values()})
`);
  assert.deepEqual(messages.map(message => message.match(/: (\w+)\(/)[1]),
    ['read', 'ready', 'alternate', 'values', 'work']);
});

test('a conditional expression chooses its value only after evaluating the condition', () => {
  const output = diagram(probe + `
probe = Probe()
value = probe.read() if probe.ready() else probe.alternate()
`);
  const guard = output.indexOf('Main -> probe: ready()');
  assert.ok(guard >= 0 && guard < output.indexOf('alt [probe.ready()]'));
  assert.ok(output.indexOf('Main -> probe: alternate()') > output.indexOf('else [else]'));
});

test('constructor arguments execute before the new object is created', () => {
  const output = diagram(probe + `
class Worker:
    def __init__(self, value: int):
        self.value = value
    def work(self):
        pass
probe = Probe()
worker = Worker(probe.read())
`);
  const inputCall = output.indexOf('Main -> probe: read()');
  assert.ok(inputCall >= 0 && inputCall < output.indexOf('create worker'));
});

test('a constructor reads the old binding before assigning its result to that name', () => {
  assert.deepEqual(calls(probe + `
class Wrapper:
    def __init__(self, value: Probe):
        value.work()
    def run(self):
        pass
probe = Probe()
probe = Wrapper(probe)
`), ['probe_2 -> probe: work()']);
});

test('constructor inputs execute once when assigning into a collection', () => {
  const messages = calls(probe + `
class Worker:
    def __init__(self, value: int):
        self.value = value
    def work(self):
        pass
probe = Probe()
workers = [None]
workers[0] = Worker(probe.read())
`);
  assert.deepEqual(messages, ['Main -> probe: read()']);
});

test('a call producing a receiver executes before the outer call arguments', () => {
  assert.deepEqual(calls(probe + `
class Factory:
    def create(self) -> Probe:
        return Probe()
factory = Factory()
probe = Probe()
factory.create().work(probe.read())
`), ['Main -> factory: create()', 'Main -> probe: read()', 'Main -> factory_create_result: work(probe.read())']);
});

test('a returned expression runs before control leaves the method', () => {
  assert.deepEqual(calls(probe + `
class Service:
    def value(self, probe: Probe) -> int:
        return probe.read()
        probe.work()
probe = Probe()
service = Service()
value = service.value(probe)
`), ['Main -> service: value(probe)', 'service -> probe: read()']);
});

test('calls after a direct break or continue are unreachable', () => {
  for (const statement of ['break', 'continue']) {
    assert.deepEqual(calls(probe + `
probe = Probe()
for value in [1, 2]:
    probe.read()
    ${statement}
    probe.work()
`), ['Main -> probe: read()']);
  }
});

test('module initialization remains available inside the main entry block', () => {
  assert.deepEqual(calls(probe + `
probe = Probe()
if __name__ == "__main__":
    probe.work()
`), ['Main -> probe: work()']);
});

test('an inequality involving __name__ is a condition rather than the main entry guard', () => {
  const output = diagram(probe + `
probe = Probe()
if __name__ != "__main__":
    probe.work()
`);
  assert.match(output, /opt \[__name__ != '__main__'\]/);
});

test('the reversed equality form of the main guard includes module initialization', () => {
  assert.deepEqual(calls(probe + `
probe = Probe()
if "__main__" == __name__:
    probe.work()
`), ['Main -> probe: work()']);
});

test('an alias of the second object keeps that object’s identity', () => {
  assert.deepEqual(calls(probe + `
first = Probe()
second = Probe()
alias = second
alias.work()
`), ['Main -> second: work()']);
});

test('an alias assignment in one alternative does not leak into its sibling or the merged scope', () => {
  assert.deepEqual(calls(probe + `
first = Probe()
second = Probe()
selected = first
if flag:
    selected = second
else:
    selected.work()
selected.read()
`), ['Main -> first: work()']);
});

test('an alias shared by every alternative remains known after the merge', () => {
  assert.deepEqual(calls(probe + `
first = Probe()
second = Probe()
if flag:
    selected = second
else:
    selected = second
selected.read()
`), ['Main -> second: read()']);
});

test('an alias changed only in a loop is not assumed to change when it runs zero times', () => {
  assert.deepEqual(calls(probe + `
first = Probe()
second = Probe()
selected = first
for value in values:
    selected = second
selected.read()
`), []);
});

test('reassigning an alias does not retain its former object type', () => {
  assert.deepEqual(calls(probe + `
probe = Probe()
alias = probe
alias = 3
alias.work()
`), []);
});

test('a method-local object does not reuse a same-named caller object', () => {
  assert.deepEqual(calls(probe + `
class Service:
    def run(self):
        probe = Probe()
        probe.work()
probe = Probe()
service = Service()
service.run()
probe.read()
`), ['Main -> service: run()', 'service -> service_probe: work()', 'Main -> probe: read()']);
});

test('method arguments preserve caller object identities across parameter names', () => {
  assert.deepEqual(calls(probe + `
class Service:
    def run(self, first: Probe):
        first.work()
first = Probe()
second = Probe()
service = Service()
service.run(second)
`), ['Main -> service: run(second)', 'service -> second: work()']);
});

test('keyword arguments preserve their caller object identities', () => {
  assert.deepEqual(calls(probe + `
class Service:
    def run(self, first: Probe):
        first.work()
first = Probe()
second = Probe()
service = Service()
service.run(first=second)
`), ['Main -> service: run(first=second)', 'service -> second: work()']);
});
