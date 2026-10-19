'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { analyzeJavaSources } = require('../../js/uml-analyzer-java.js');

function analyze(classes, body) {
  const result = analyzeJavaSources({ 'Example.java': classes +
    ' class Example { public static void main(String[] args) { ' + body + ' } }' });
  assert.deepEqual(result.errors, []);
  return result;
}

function calls(result) {
  return result.sequenceDiagram.split('\n').flatMap(line => {
    const call = line.match(/^(\S+) -> (\S+): (\w+)\(/);
    return call ? [{ from: call[1], to: call[2], method: call[3] }] : [];
  });
}

const job = 'class Job { boolean first() { return true; } boolean second() { return false; } void send() {} void cancel() {} void after() {} }';

for (const tail of ['else { job.cancel(); }', '']) {
  test(`Java evaluates an else-if predicate only on the preceding false path (${tail || 'no final else'})`, () => {
    const result = analyze(job, 'Job job = new Job(); if (job.first()) { job.send(); } '
      + 'else if (job.second()) { job.after(); } ' + tail);
    assert.deepEqual(calls(result).map(call => call.method), tail
      ? ['first', 'send', 'second', 'after', 'cancel'] : ['first', 'send', 'second', 'after']);
    const diagram = result.sequenceDiagram;
    assert.ok(diagram.indexOf('else [else]') < diagram.indexOf(': second()'));
    assert.ok(diagram.indexOf(': second()') < diagram.indexOf(': after()'));
    assert.ok(!result.sequenceWarnings.some(warning => ['unsupported', 'conditional'].includes(warning.code)));
  });
}

test('Java joins all else-if alternatives while keeping sibling assignments isolated', () => {
  const result = analyze(job, 'Job left = new Job(); Job right = new Job(); Job selected = left; '
    + 'if (condition) { selected = right; selected.send(); } '
    + 'else if (selected.second()) { selected.send(); } else { selected.send(); } selected.send();');
  const sends = calls(result).filter(call => call.method === 'send');
  assert.deepEqual(sends.slice(0, 3).map(call => call.to), ['right', 'left', 'left']);
  assert.ok(!['left', 'right'].includes(sends[3].to));
  assert.equal(calls(result).find(call => call.method === 'second').to, 'left');
  assert.ok(result.sequenceWarnings.some(warning => warning.code === 'identity'));
});

for (const declaration of [
  'Job first = new Job(), second = new Job();',
  'Job first, second; first = new Job(); second = new Job();',
  'Job first = new Job(), second = first;'
]) test(`Java retains every variable in a declaration: ${declaration}`, () => {
  const result = analyze(job, declaration + ' first.send(); second.send();');
  const sends = calls(result).filter(call => call.method === 'send');
  assert.equal(sends.length, 2);
  if (declaration.includes('second = first')) assert.equal(sends[0].to, sends[1].to);
  else assert.notEqual(sends[0].to, sends[1].to);
  assert.ok(!result.sequenceWarnings.some(warning => warning.code === 'unresolved'));
});

test('Java declaration splitting preserves generic commas and left-to-right initializer calls', () => {
  const classes = job + ' class Pair<A, B> { Pair(boolean a, boolean b) {} void send() {} }';
  const result = analyze(classes, 'Job job = new Job(); Pair<Job, Job> first = new Pair<Job, Job>(job.first(), job.second()), second = new Pair<Job, Job>(false, true); first.send(); second.send();');
  assert.deepEqual(calls(result).map(call => call.method), ['first', 'second', 'send', 'send']);
  const sends = calls(result).filter(call => call.method === 'send');
  assert.notEqual(sends[0].to, sends[1].to);
  assert.deepEqual(result.sequenceWarnings, []);
});

test('Java constructors with three generic arguments do not split into declarations', () => {
  const result = analyze(job + ' class Triple<A, B, C> { Triple(boolean ready) {} void send() {} }',
    'Job job = new Job(); Triple<Job, Job, Job> first = new Triple<Job, Job, Job>(job.first()), second = new Triple<Job, Job, Job>(job.second()); first.send(); second.send();');
  assert.deepEqual(calls(result).map(call => call.method), ['first', 'second', 'send', 'send']);
  assert.deepEqual(result.sequenceWarnings, []);
});

test('Java unbraced nested conditionals keep the dangling else with the inner condition', () => {
  const result = analyze(job, 'Job job = new Job(); if (job.first()) if (job.second()) job.send(); else job.cancel(); job.after();');
  assert.deepEqual(calls(result).map(call => call.method), ['first', 'second', 'send', 'cancel', 'after']);
  const lines = result.sequenceDiagram.split('\n');
  let depth = 0;
  const depthAtCall = {};
  for (const line of lines) {
    if (/^(alt|opt|loop) /.test(line)) depth++;
    if (line === 'end') depth--;
    const call = line.match(/ -> .*: (\w+)\(/);
    if (call) depthAtCall[call[1]] = depth;
  }
  assert.deepEqual(depthAtCall, { first: 0, second: 1, send: 2, cancel: 2, after: 0 });
});
