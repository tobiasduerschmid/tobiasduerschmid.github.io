'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
require('../../js/uml-analyzer-python.js');
require('../../js/uml-analyzer-js.js');
const { analyzeJavaSources } = require('../../js/uml-analyzer-java.js');
const { analyzeCppSources } = require('../../js/uml-analyzer-cpp.js');
const ts = require('../../js/vendor/typescript/5.9.3/typescript.min.js');
const analyzers = {
  Python: source => global.analyzePythonSources({ 'example.py': source }),
  Java: source => analyzeJavaSources({ 'Example.java': source }),
  'C++': source => analyzeCppSources({ 'example.cpp': source }),
  TypeScript: source => global.analyzeJSSources({ 'example.ts': source }, ts)
};

function methods(language, bodies, entry = 'payment.authorize()') {
  const entries = Object.entries(bodies);
  if (language === 'Python') return 'class Payment:\n' + entries.map(([name, body]) =>
    `    def ${name}(self):\n        ${body.replaceAll('this.', 'self.') || 'pass'}\n`).join('') +
    '\npayment = Payment()\n' + entry;
  if (language === 'TypeScript') return 'class Payment {\n' + entries.map(([name, body]) =>
    `${name}(): void { ${body}; }`).join('\n') + '\n}\nconst payment = new Payment();\n' + entry + ';';
  const declarations = entries.map(([name, body]) => `void ${name}() { ${body.replaceAll('this.', language === 'C++' ? 'this->' : 'this.')}; }`).join('\n');
  return language === 'Java'
    ? `class Payment { ${declarations} } class Example { public static void main(String[] args) { Payment payment = new Payment(); ${entry}; } }`
    : `class Payment { public: ${declarations} }; int main() { Payment payment; ${entry}; }`;
}

for (const [language, analyze] of Object.entries(analyzers)) {
  test(`${language}: mutual recursion carries a warning into the diagram without claiming proven nontermination`, () => {
    const result = analyze(methods(language, { authorize: 'this.capture()', capture: 'this.refund()', refund: 'this.authorize()' }));
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.sequenceWarnings.map(item => item.code), ['recursion']);
    assert.match(result.sequenceWarnings[0].message, /termination is not checked/);
    assert.match(result.sequenceDiagram, /Warning: partial sequence inference/);
    assert.match(result.sequenceDiagram, /may be unreachable/);
    assert.match(result.classDiagram, /class Payment/);
  });

  test(`${language}: deep nonrecursive calls report truncation separately`, () => {
    const result = analyze(methods(language, { authorize: 'this.capture()', capture: 'this.refund()', refund: 'this.finish()', finish: 'this.save()', save: '' }));
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.sequenceWarnings.map(item => item.code), ['depth']);
    assert.doesNotMatch(result.sequenceWarnings[0].message, /recurs/i);
  });

  test(`${language}: independent repeated calls are complete and warnings do not leak between analyses`, () => {
    analyze(methods(language, { authorize: 'this.authorize()' }));
    const result = analyze(methods(language, { authorize: 'this.capture()', capture: '' }, language === 'Python'
      ? 'payment.authorize()\npayment.authorize()' : 'payment.authorize(); payment.authorize()'));
    assert.deepEqual(result.sequenceWarnings, []);
    assert.equal(result.sequenceDiagram.split('\n').filter(line => / -> .*: capture\(\)/.test(line)).length, 2);
    assert.doesNotMatch(result.sequenceDiagram, /Warning:/);
  });

  test(`${language}: unresolved member calls are not silently presented as a complete sequence`, () => {
    const result = analyze(methods(language, { authorize: '' }, language === 'Python' ? 'payment.authorize()\nmissing.send()' : 'payment.authorize(); missing.send()'));
    assert.ok(result.sequenceWarnings.some(item => item.code === 'unresolved'));
  });
}

const java = analyzers.Java;
const typescript = analyzers.TypeScript;
const python = analyzers.Python;
const cpp = analyzers['C++'];
const calls = result => result.sequenceDiagram.split('\n').filter(line => / -> /.test(line)).map(line => line.split(': ')[1]);

test('Java: argument calls precede the outer call exactly once', () => {
  const result = java(`class Service { int read() { return 1; } void use(int value) {} }
    class Example { public static void main(String[] args) { Service s = new Service(); s.use(s.read()); } }`);
  assert.deepEqual(calls(result).map(label => label.split('(')[0]), ['read', 'use']);
});

test('Java: constructor argument calls precede construction', () => {
  const result = java(`class Service { int read() { return 1; } }
    class Client { Client(int value) {} void send() {} }
    class Example { public static void main(String[] args) { Service s = new Service(); Client c = new Client(s.read()); c.send(); } }`);
  assert.ok(result.sequenceDiagram.indexOf(': read()') < result.sequenceDiagram.indexOf('create c'));
  assert.equal(calls(result).filter(label => label === 'read()').length, 1);
});

for (const [language, source] of [
  ['Java', `class Service { boolean ready() { return true; } void send() {} }
    class Example { public static void main(String[] args) { Service s = new Service(); if (s.ready()) { s.send(); } } }`],
  ['TypeScript', 'class Service { ready(): boolean { return true; } send(): void {} } const s = new Service(); if (s.ready()) { s.send(); }']
]) test(`${language}: condition calls precede guarded messages`, () => {
  assert.deepEqual(calls(analyzers[language](source)), ['ready()', 'send()']);
});

for (const [language, source] of [
  ['Java', 'class Service { void send() {} void run(boolean done) { if (done) { return; } send(); } } class Example { public static void main(String[] args) { Service s = new Service(); s.run(true); } }'],
  ['C++', 'class Service { public: void send() {} void run(bool done) { if (done) { return; } send(); } }; int main() { Service s; s.run(true); }'],
  ['TypeScript', 'class Service { send(): void {} run(done: boolean): void { if (done) { return; } this.send(); } } const s = new Service(); s.run(true);']
]) test(`${language}: a conditional early return warns about later calls`, () => {
  assert.ok(analyzers[language](source).sequenceWarnings.some(item => item.code === 'control'));
});

test('TypeScript: short circuit calls stay conditional and async execution discloses its approximation', () => {
  const result = typescript('class Service { async send(): Promise<void> {} } const s = new Service(); const ready = true; ready && s.send();');
  assert.match(result.sequenceDiagram, /opt \[ready is truthy\][\s\S]*s: send\(\)[\s\S]*\nend/);
  assert.ok(result.sequenceWarnings.some(item => item.code === 'deferred'));
});

test('Python: finite recursion is cautioned without calling it an infinite loop', () => {
  const result = python('class Counter:\n    def down(self, n):\n        if n > 0:\n            self.down(n - 1)\ncounter = Counter()\ncounter.down(2)');
  assert.ok(result.sequenceWarnings.some(item => item.code === 'recursion'));
  assert.ok(result.sequenceWarnings.every(item => !/infinite loop/i.test(item.message)));
});

test('Python: lambda creation does not execute the body and reports deferred inference', () => {
  const result = python('class Service:\n    def send(self):\n        pass\ns = Service()\ncallback = lambda: s.send()\ncallback()');
  assert.ok(result.sequenceWarnings.some(item => item.code === 'deferred'));
  assert.ok(!calls(result).includes('send()'));
});

test('Python: partially parsed comprehensions and context managers report missing interactions', () => {
  for (const source of ['values = [s.send() for s in services]', 'with manager.open():\n    manager.send()']) {
    assert.ok(python(source).sequenceWarnings.some(item => item.code === 'unsupported'));
  }
});

test('C++: ambiguous overload bodies are disclosed', () => {
  const result = cpp('class Service { public: void use(int x) {} void use(double x) {} }; int main() { Service s; s.use(1); }');
  assert.ok(result.sequenceWarnings.some(item => item.code === 'dispatch'));
});

for (const [language, source] of [
  ['Python', 'class Service:\n    def send(self):\n        pass\nclass Client:\n    def __init__(self, service: Service):\n        service.send()\ns = Service()\nc = Client(s)'],
  ['Java', 'class Service { void send() {} } class Client { Client(Service s) { s.send(); } } class Example { public static void main(String[] args) { Service s = new Service(); Client c = new Client(s); } }'],
  ['TypeScript', 'class Service { send(): void {} } class Client { constructor(s: Service) { s.send(); } } const s = new Service(); const c = new Client(s);']
]) test(`${language}: constructor-only classes retain calls made during construction`, () => {
  assert.ok(calls(analyzers[language](source)).includes('send()'));
});

for (const [language, source] of [
  ['Python', 'while True:\n    pass'], ['Java', 'class Example { public static void main(String[] args) { while (true) {} } }'],
  ['C++', 'int main() { for (;;) {} }'], ['TypeScript', 'while (true) {}']
]) test(`${language}: potentially unbounded loops warn even with no resolved messages`, () => {
  const result = analyzers[language](source);
  assert.ok(result.sequenceWarnings.some(item => item.code === 'loop'));
  assert.match(result.sequenceDiagram, /Warning: partial sequence inference/);
});

for (const [language, source] of [
  ['Python', 'class Service:\n    async def send(self):\n        pass\ns = Service()\ns.send()'],
  ['TypeScript', 'class Service { async send(): Promise<void> {} } const s = new Service(); s.send();']
]) test(`${language}: async method calls warn even when the body is empty`, () => {
  assert.ok(analyzers[language](source).sequenceWarnings.some(item => item.code === 'deferred'));
});

test('C++: multiple argument calls disclose unspecified evaluation order', () => {
  const result = cpp('class Service { public: int first() { return 1; } int second() { return 2; } void use(int a, int b) {} }; int main() { Service s; s.use(s.first(), s.second()); }');
  assert.ok(result.sequenceWarnings.some(item => item.code === 'ordering'));
});
