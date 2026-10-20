'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { analyzeJavaSources } = require('../../js/uml-analyzer-java.js');
const { analyzeCppSources } = require('../../js/uml-analyzer-cpp.js');

function java(methods, body, extra = '') {
  const source = `class Worker { void run() {} ${methods} } ${extra}
    class Main { public static void main(String[] args) {
      Worker original = new Worker(); Worker other = new Worker(); ${body}
    } }`;
  return checked(analyzeJavaSources({ 'Main.java': source }));
}

function cpp(methods, body, extra = '') {
  const source = `struct Worker { void run() {} ${methods} }; ${extra}
    int main() { Worker original; Worker other; ${body} }`;
  return checked(analyzeCppSources({ 'main.cpp': source }));
}

function checked(result) {
  assert.deepEqual(result.errors, []);
  return result;
}

function calls(result, method) {
  return result.sequenceDiagram.split('\n').flatMap(line => {
    const match = line.match(/^(\S+) -> (\S+): (\w+)\(/);
    return match && (!method || match[3] === method) ? [{ from: match[1], to: match[2], method: match[3] }] : [];
  });
}

function expectRunOn(result, receivers) {
  assert.deepEqual(calls(result, 'run').map(call => call.to), receivers);
  assert.ok(!result.sequenceWarnings.some(warning => warning.code === 'identity'));
}

test('Java: an argument returned through a local alias retains the original lifeline', () => {
  expectRunOn(java('Worker choose(Worker worker) { Worker alias = worker; return alias; }',
    'Worker chosen = other.choose(original); chosen.run();'), ['original']);
});

test('Java: a fluent return-this chain stays on the receiver', () => {
  expectRunOn(java('Worker configure() { return this; }', 'original.configure().configure().run();'), ['original']);
});

test('Java: matching return paths and fallthrough aliases retain one identity', () => {
  expectRunOn(java('Worker choose(Worker worker, boolean ready) { if (ready) { return worker; } return worker; }',
    'other.choose(original, true).run();'), ['original']);
});

test('Java: agreeing branch assignments can return a different argument', () => {
  expectRunOn(java('Worker choose(Worker first, Worker second, boolean ready) { Worker alias = first; if (ready) { alias = second; } else { alias = second; } return alias; }',
    'original.choose(original, other, true).run();'), ['other']);
});

test('Java: returned arguments can be arguments of another expanded call', () => {
  expectRunOn(java('Worker choose(Worker worker) { return worker; } void accept(Worker worker) { worker.run(); }',
    'other.accept(other.choose(original));'), ['original']);
});

test('Java: earlier arguments retain their identity when a later argument rebinds the variable', () => {
  expectRunOn(java('Worker choose(Worker first, Worker second) { return first; }',
    'Worker selected = original; other.choose(selected, selected = other).run(); selected.run();'), ['original', 'other']);
});

test('Java: receiver evaluation precedes argument rebinding', () => {
  expectRunOn(java('Worker configure(Worker ignored) { return this; }',
    'Worker selected = original; selected.configure(selected = other).run(); selected.run();'), ['original', 'other']);
});

test('Java: constructor arguments also preserve their evaluation-time identity', () => {
  expectRunOn(java('', 'Worker selected = original; Holder holder = new Holder(selected, selected = other);',
    'class Holder { Holder(Worker first, Worker second) { first.run(); second.run(); } }'), ['original', 'other']);
});

test('Java: a static identity method can be followed by a call on its returned argument', () => {
  expectRunOn(java('', 'Selector.choose(original).run();',
    'class Selector { static Worker choose(Worker worker) { return worker; } }'), ['original']);
});

test('Java: an inherited unique-arity method uses the matching inherited return summary', () => {
  expectRunOn(java('', 'Selector selector = new Selector(); selector.choose(original).run();',
    'class Parent { Worker choose(Worker worker) { return worker; } } class Selector extends Parent { Worker choose(Worker first, Worker second) { return second; } }'), ['original']);
});

test('Java: unique arity selects the matching body and return origin', () => {
  const result = java('void first() {} void second() {} void send() { first(); } void send(int value) { second(); } Worker choose(Worker first) { return first; } Worker choose(Worker first, Worker second) { return second; }',
    'original.send(); original.send(1); original.choose(original).run(); original.choose(original, other).run();');
  assert.deepEqual(calls(result).filter(call => ['first', 'second'].includes(call.method)).map(call => call.method), ['first', 'second']);
  expectRunOn(result, ['original', 'other']);
  assert.ok(!result.sequenceWarnings.some(warning => warning.code === 'dispatch'));
});

test('Java: same-arity overloads do not claim a known return alias', () => {
  const result = java('Worker choose(Worker first) { return first; } Worker choose(Other second) { return this; }',
    'other.choose(original).run();', 'class Other {}');
  assert.ok(!['original', 'other'].includes(calls(result, 'run')[0].to));
  assert.ok(result.sequenceWarnings.some(warning => warning.code === 'dispatch'));
  assert.ok(result.sequenceWarnings.some(warning => warning.code === 'identity'));
});

test('Java: same-arity inherited overloads retain an ambiguity warning', () => {
  const result = java('', 'Selector selector = new Selector(); selector.choose(original).run();',
    'class Parent { Worker choose(Worker worker) { return worker; } } class Selector extends Parent { Worker choose(Other other) { return null; } } class Other {}');
  assert.ok(result.sequenceWarnings.some(warning => warning.code === 'dispatch'));
  assert.notEqual(calls(result, 'run')[0].to, 'original');
});

test('Java: varargs do not receive a fixed-arity identity proof', () => {
  const result = java('Worker choose(Worker worker, Worker... rest) { return worker; }',
    'other.choose(original, other).run();');
  assert.ok(result.sequenceWarnings.some(warning => warning.code === 'dispatch'));
  assert.notEqual(calls(result, 'run')[0].to, 'original');
});

for (const [name, method] of [
  ['different return origins', 'Worker choose(Worker worker, boolean ready) { if (ready) return worker; return this; }'],
  ['an unsupported loop', 'Worker choose(Worker worker, boolean ready) { while (ready) { ready = false; } return worker; }'],
  ['a field return', 'Worker field; Worker choose(Worker worker, boolean ready) { return field; }'],
  ['a side effect in the guard', 'Worker choose(Worker worker, boolean ready) { if (ready = true) return worker; return worker; }'],
]) test(`Java: ${name} remains an uncertain return`, () => {
  const result = java(method, 'other.choose(original, true).run();');
  assert.ok(!['original', 'other'].includes(calls(result, 'run')[0].to));
  assert.ok(result.sequenceWarnings.some(warning => warning.code === 'identity'));
});

test('C++: agreeing conditional borrowed returns keep the argument lifeline', () => {
  expectRunOn(cpp('', 'choose(original, true).run();',
    'Worker& choose(Worker& worker, bool ready) { if (ready) { return worker; } else { return worker; } }'), ['original']);
});

test('C++: a borrowed local alias retains the argument across return paths', () => {
  expectRunOn(cpp('', 'choose(&original, true).run();',
    'Worker& choose(Worker* worker, bool ready) { Worker* alias = worker; if (ready) return *alias; return *alias; }'), ['original']);
});

test('C++: differing branch returns do not select the final textual return', () => {
  const result = cpp('', 'choose(original, other, true).run();',
    'Worker& choose(Worker& first, Worker& second, bool ready) { if (ready) return first; return second; }');
  assert.ok(!['original', 'other'].includes(calls(result, 'run')[0].to));
  assert.ok(result.sequenceWarnings.some(warning => warning.code === 'identity'));
});

test('C++: returning by value does not reuse the original object identity', () => {
  const result = cpp('', 'copy(original).run();', 'Worker copy(Worker& worker) { return worker; }');
  assert.equal(calls(result, 'run').length, 1);
  assert.notEqual(calls(result, 'run')[0].to, 'original');
});

test('C++: a value-copy local is not treated as a borrowed alias in a summary', () => {
  const result = cpp('', 'choose(original, true).run();',
    'Worker& choose(Worker& worker, bool ready) { Worker alias = worker; if (ready) return worker; return alias; }');
  assert.ok(!['original', 'other'].includes(calls(result, 'run')[0].to));
  assert.ok(result.sequenceWarnings.some(warning => warning.code === 'identity'));
});

test('C++: pointer-parameter rebinding is distinguished from object copying', () => {
  const result = cpp('', 'choose(&original, &other, true)->run();',
    'Worker* choose(Worker* first, Worker* second, bool ready) { if (ready) { first = second; return first; } first = second; return first; }');
  assert.deepEqual(calls(result, 'run').map(call => call.to), ['other']);
});

test('C++: a side-effectful condition does not establish a shared return origin', () => {
  const result = cpp('', 'choose(original)->run();',
    'bool ready() { return true; } Worker* choose(Worker& worker) { if (ready()) return &worker; return &worker; }');
  assert.notEqual(calls(result, 'run')[0].to, 'original');
  assert.ok(result.sequenceWarnings.some(warning => warning.code === 'identity'));
});

test('C++: unspecified argument evaluation order cannot establish a returned alias', () => {
  const result = cpp('', 'Worker* selected = &original; choose(selected, selected = &other)->run();',
    'Worker* choose(Worker* first, Worker* second) { return first; }');
  assert.ok(!['original', 'other'].includes(calls(result, 'run')[0].to));
  assert.ok(result.sequenceWarnings.some(warning => warning.code === 'ordering'));
  assert.ok(result.sequenceWarnings.some(warning => warning.code === 'identity'));
});
