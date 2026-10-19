'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { analyzeJavaSources } = require('../../js/uml-analyzer-java.js');
const { analyzeCppSources } = require('../../js/uml-analyzer-cpp.js');
require('../../js/uml-analyzer-python.js');
require('../../js/uml-analyzer-js.js');
const compiler = require('../../js/vendor/typescript/5.9.3/typescript.min.js');

const analyzers = {
  Python: source => global.analyzePythonSources({ 'example.py': source }),
  Java: source => analyzeJavaSources({ 'Example.java': source }),
  TypeScript: source => global.analyzeJSSources({ 'example.ts': source }, compiler),
  'C++': source => analyzeCppSources({ 'example.cpp': source })
};

function analyze(language, source) {
  const result = analyzers[language](source);
  assert.deepEqual(result.errors, []);
  return result;
}

function messages(result) {
  return result.sequenceDiagram.split('\n').flatMap(line => {
    const match = line.match(/^(\S+) -> (\S+): (\w+)\(/);
    return match ? [{ from: match[1], to: match[2], method: match[3] }] : [];
  });
}

const javaMain = (classes, body) => `${classes} class Example { public static void main(String[] args) { ${body} } }`;

test('Java cleanup follows the try and catch alternatives before continuation', () => {
  const result = analyze('Java', javaMain('class Job { void run() {} void fail() {} void close() {} void after() {} }',
    'Job job = new Job(); try { job.run(); } catch (Exception e) { job.fail(); } finally { job.close(); } job.after();'));
  assert.deepEqual(messages(result).map(call => call.method), ['run', 'fail', 'close', 'after']);
});

for (const [language, source] of [
  ['Java', javaMain('class Job { int choose() { return 1; } void run() {} }', 'Job job = new Job(); switch (job.choose()) { case 1: job.run(); break; }')],
  ['TypeScript', 'class Job { choose(): number { return 1; } run(): void {} } const job = new Job(); switch (job.choose()) { case 1: job.run(); break; }']
]) test(`${language} evaluates the switch selector before the selected messages`, () => {
  assert.deepEqual(messages(analyze(language, source)).map(call => call.method), ['choose', 'run']);
});

for (const [language, source] of [
  ['Java', javaMain('class Sensor { void read() {} } class Reader { void run() { Sensor local = new Sensor(); local.read(); } }',
    'Reader reader = new Reader(); reader.run(); reader.run();')],
  ['TypeScript', 'class Sensor { read() {} } class Reader { run() { const local = new Sensor(); local.read(); } } const reader = new Reader(); reader.run(); reader.run();']
]) test(`${language} gives separate allocations in repeated invocations separate lifelines`, () => {
  const result = analyze(language, source);
  const reads = messages(result).filter(call => call.method === 'read');
  assert.equal(reads.length, 2);
  assert.notEqual(reads[0].to, reads[1].to);
  const creations = result.sequenceDiagram.match(/^create (.+)$/gm);
  assert.equal(new Set(creations).size, creations.length);
});

test('Java passes the actual receiver identity into a method parameter', () => {
  const result = analyze('Java', javaMain('class Sensor { void read() {} } class Reader { void run(Sensor sensor) { sensor.read(); } }',
    'Sensor left = new Sensor(); Sensor right = new Sensor(); Reader reader = new Reader(); reader.run(right); left.read();'));
  assert.deepEqual(messages(result).filter(call => call.method === 'read').map(call => call.to), ['right', 'left']);
});

for (const construction of ['new Reader(right);', 'Reader reader = null; reader = new Reader(right);']) {
  test(`Java preserves constructor argument identities in ${construction}`, () => {
    const result = analyze('Java', javaMain('class Sensor { void read() {} } class Reader { Reader(Sensor sensor) { sensor.read(); } }',
      'Sensor right = new Sensor(); ' + construction));
    assert.deepEqual(messages(result).filter(call => call.method === 'read').map(call => call.to), ['right']);
  });
}

for (const [language, source] of [
  ['Java', javaMain('class Sensor { void read() {} }', 'Sensor left = new Sensor(); Sensor right = new Sensor(); Sensor selected = left; if (condition) { selected = right; selected.read(); } else { selected.read(); } selected.read();')],
  ['C++', 'class Sensor { public: void read() {} }; int main() { Sensor left; Sensor right; Sensor* selected = &left; if (condition) { selected = &right; selected->read(); } else { selected->read(); } selected->read(); }']
]) test(`${language} isolates branch bindings and marks an uncertain receiver after their join`, () => {
  const result = analyze(language, source);
  const reads = messages(result).filter(call => call.method === 'read');
  assert.deepEqual(reads.slice(0, 2).map(call => call.to), ['right', 'left']);
  assert.equal(reads.length, 3);
  assert.ok(!['left', 'right'].includes(reads[2].to), 'the post-branch receiver must not pretend either input is certain');
  assert.ok(result.sequenceWarnings.some(warning => warning.code === 'identity'));
});

for (const [operator, guard] of [['&&', /opt \[.*truthy/], ['||', /opt \[.*falsy/], ['??', /opt \[.*nullish/]]) {
  test(`TypeScript places the right operand of ${operator} inside a conditional fragment`, () => {
    const result = analyze('TypeScript', `class Job { check() { return true; } run() {} } const job = new Job(); job.check() ${operator} job.run();`);
    assert.deepEqual(messages(result).map(call => call.method), ['check', 'run']);
    assert.match(result.sequenceDiagram, guard);
    const lines = result.sequenceDiagram.split('\n');
    assert.ok(lines.findIndex(line => guard.test(line)) < lines.findIndex(line => /: run\(/.test(line)));
    assert.ok(!result.sequenceWarnings.some(warning => warning.code === 'conditional'));
  });
}

test('TypeScript conditional expression branches are alternatives with isolated reference assignments', () => {
  const result = analyze('TypeScript', `class Sensor { read() {} } const left = new Sensor(); const right = new Sensor(); let selected = left;
    condition ? (selected = right, selected.read()) : selected.read(); selected.read();`);
  const reads = messages(result).filter(call => call.method === 'read');
  assert.deepEqual(reads.slice(0, 2).map(call => call.to), ['right', 'left']);
  assert.ok(!['left', 'right'].includes(reads[2].to));
  assert.match(result.sequenceDiagram, /^alt /m);
  assert.match(result.sequenceDiagram, /^else /m);
});

test('TypeScript computed member names evaluate their calls before call arguments', () => {
  const result = analyze('TypeScript', `class Job { key() { return 'run'; } argument() { return 1; } run(value: number) {} }
    const job = new Job(); job[job.key()](job.argument());`);
  assert.deepEqual(messages(result).map(call => call.method), ['key', 'argument']);
  assert.ok(result.sequenceWarnings.some(warning => warning.code === 'unresolved'));
});

for (const expression of ['await job.run()', 'job?.run()', 'job.run?.()']) {
  test(`TypeScript reports deferred or conditional execution at a top-level call: ${expression}`, () => {
    const result = analyze('TypeScript', `class Job { run() {} } const job = new Job(); ${expression};`);
    assert.ok(result.sequenceWarnings.some(warning => ['conditional', 'deferred'].includes(warning.code)));
  });
}

for (const [language, source] of [
  ['Java', javaMain('class Sensor { void read() {} }', 'Sensor selected = new Sensor(); Sensor saved = selected; selected = new Sensor(); saved.read(); selected.read();')],
  ['TypeScript', 'class Sensor { read() {} } let selected = new Sensor(); const saved = selected; selected = new Sensor(); saved.read(); selected.read();']
]) test(`${language} reassigning a fresh allocation leaves previous aliases on the original object`, () => {
  const result = analyze(language, source);
  const reads = messages(result).filter(call => call.method === 'read');
  assert.equal(reads.length, 2);
  assert.equal(reads[0].to, 'selected');
  assert.notEqual(reads[0].to, reads[1].to);
  assert.ok(!result.sequenceWarnings.some(warning => warning.code === 'unresolved'));
});

for (const [language, source] of [
  ['Java', javaMain('class Sensor { void read() {} }', 'Sensor left = new Sensor(); Sensor right = new Sensor(); Sensor selected = left; while (condition) { selected = right; } selected.read();')],
  ['C++', 'class Sensor { public: void read() {} }; int main() { Sensor left; Sensor right; Sensor* selected = &left; while (condition) { selected = &right; } selected->read(); }']
]) test(`${language} includes the zero-iteration path when joining receiver bindings after a loop`, () => {
  const result = analyze(language, source);
  const reads = messages(result).filter(call => call.method === 'read');
  assert.equal(reads.length, 1);
  assert.ok(!['left', 'right'].includes(reads[0].to));
  assert.ok(result.sequenceWarnings.some(warning => warning.code === 'identity'));
});

test('C++ branch writes do not leak into sibling branches through shared object fields', () => {
  const result = analyze('C++', `class Sensor { public: void read() {} };
    class Holder { public: Sensor* selected; void run(Sensor* other) { if (condition) { selected = other; selected->read(); } else { selected->read(); } selected->read(); } };
    int main() { Sensor left; Sensor right; Holder holder; holder.selected = &left; holder.run(&right); }`);
  const reads = messages(result).filter(call => call.method === 'read');
  assert.deepEqual(reads.slice(0, 2).map(call => call.to), ['right', 'left']);
  assert.equal(reads.length, 3);
  assert.ok(!['left', 'right'].includes(reads[2].to));
});

for (const [loop, expected] of [
  ['do { selected = &right; selected->read(); } while (selected->check());', ['right', 'right']],
  ['for (; selected->check(); selected = &left) { selected = &right; selected->read(); }', ['left', 'right', 'left']]
]) test(`C++ loop headers see the receiver assignments made earlier in the iteration: ${loop}`, () => {
  const result = analyze('C++', 'class Sensor { public: bool check() { return true; } void read() {} }; '
    + 'int main() { Sensor left; Sensor right; Sensor* selected = &left; ' + loop + ' }');
  assert.deepEqual(messages(result).map(call => call.to), expected);
  assert.ok(!result.sequenceWarnings.some(warning => warning.code === 'identity'));
});

test('C++ for-loop initialization changes receivers even on the zero-iteration path', () => {
  const result = analyze('C++', 'class Sensor { public: bool check() { return true; } void read() {} }; '
    + 'int main() { Sensor left; Sensor right; Sensor* selected = &left; '
    + 'for (selected = &right; selected->check();) {} selected->read(); }');
  assert.deepEqual(messages(result).map(call => call.to), ['right', 'right', 'right']);
  assert.ok(!result.sequenceWarnings.some(warning => warning.code === 'identity'));
});

for (const exit of ['return;', '{ return; }']) {
  test(`C++ discloses conditional early exits with either statement syntax: ${exit}`, () => {
    const result = analyze('C++', 'class Job { public: void send() {} void run(bool done) { if (done) '
      + exit + ' send(); } }; int main() { Job job; job.run(true); }');
    assert.ok(result.sequenceWarnings.some(warning => warning.code === 'control'));
  });
}

for (const [language, source] of [
  ['Python', 'class Job:\n    def run(self):\n        pass\njob = Job()\nmissing.call()\n' + 'job.run()\n'.repeat(5100)],
  ['Java', javaMain('class Job { void run() {} }', 'Job job = new Job(); missing.call();' + 'job.run();'.repeat(5100))],
  ['C++', 'class Job { public: void run() {} }; int main() { Job job; missing.call();' + 'job.run();'.repeat(5100) + '}'],
  ['TypeScript', 'class Job { run() {} } const job = new Job(); missing.call();' + 'job.run();'.repeat(5100)]
]) test(`${language} a resource failure cannot publish a warning-only diagram as successful inference`, () => {
  const result = analyzers[language](source);
  assert.ok(result.errors.some(error => /sequence inference limit/i.test(error)));
  assert.equal(result.sequenceDiagram, '');
  assert.match(result.classDiagram, /class Job/);
});

for (const [language, source] of [
  ['Python', 'class Job:\n    def run(self):\n        pass\njob = Job()\nvalues = [' + Array(5100).fill('job.run()').join(',') + ']'],
  ['TypeScript', 'class Job { run() {} } const job = new Job(); const values = [' + Array(5100).fill('job.run()').join(',') + '];'],
  ['C++', 'class Job { public: int run() { return 1; } }; int main() { Job job; int values[] = {' + Array(5100).fill('job.run()').join(',') + '}; }']
]) test(`${language} bounds call-heavy expressions as well as statement counts`, () => {
  const result = analyzers[language](source);
  assert.ok(result.errors.some(error => /sequence inference limit/i.test(error)));
  assert.equal(result.sequenceDiagram, '');
});

const loops = [
  ['while (job.check()) { job.run(); }', ['check', 'run', 'check']],
  ['do { job.run(); } while (job.check());', ['run', 'check']],
  ['for (job.start(); job.check(); job.step()) { job.run(); }', ['start', 'check', 'run', 'step', 'check']]
];
for (const language of ['Java', 'TypeScript', 'C++']) {
  for (const [loop, expected] of loops) {
    test(`${language} preserves the evaluation order of ${loop}`, () => {
      const body = `void start() {} bool check() { return true; } void run() {} void step() {}`;
      const source = language === 'Java' ? javaMain('class Job { ' + body.replace('bool', 'boolean') + ' }', 'Job job = new Job(); ' + loop)
        : language === 'C++' ? 'class Job { public: ' + body + ' }; int main() { Job job; ' + loop + ' }'
          : 'class Job { start() {} check() { return true; } run() {} step() {} } const job = new Job(); ' + loop;
      const result = analyze(language, source);
      assert.deepEqual(messages(result).map(call => call.method), expected);
      assert.match(result.sequenceDiagram, /^loop /m);
      assert.ok(!result.sequenceWarnings.some(warning => warning.code === 'unsupported'));
    });
  }
}
