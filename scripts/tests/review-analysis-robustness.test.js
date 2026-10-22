'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
require('../../js/uml-analyzer-python.js');
const { analyzeJavaSources } = require('../../js/uml-analyzer-java.js');
require('../../js/uml-analyzer-js.js');
const ts = require('../../js/vendor/typescript/5.9.3/typescript.min.js');

const prototypeNames = ['constructor', 'toString', '__proto__', 'hasOwnProperty'];

for (const name of prototypeNames) {
  test(`Python UML preserves the class ${name} and follows its method calls`, () => {
    const result = global.analyzePythonSources({ 'model.py': `
class ${name}:
    def run(self):
        self.ping()
    def ping(self):
        pass
worker = ${name}()
worker.run()
` });

    assert.deepEqual(result.errors, []);
    assert.match(result.classDiagram, new RegExp(`class ${name} \\{`));
    assert.match(result.sequenceDiagram, new RegExp(`participant worker: ${name}`));
    assert.match(result.sequenceDiagram, /Main -> worker: run\(\)/);
    assert.match(result.sequenceDiagram, /worker -> worker: ping\(\)/);
  });

  test(`Python UML preserves the scalar attribute ${name}`, () => {
    const result = global.analyzePythonSources({ 'model.py': `class Record:\n    ${name}: int\n` });

    assert.deepEqual(result.errors, []);
    assert.match(result.classDiagram, new RegExp(`[+#]${name}: int`));
  });
}

test('Python UML preserves a __proto__ receiver through method calls and branch scopes', () => {
  const result = global.analyzePythonSources({ 'model.py': `
class Worker:
    def run(self):
        self.ping()
    def ping(self):
        pass
__proto__ = Worker()
if unknown_flag:
    __proto__.run()
else:
    __proto__.ping()
__proto__.run()
` });

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.sequenceWarnings, []);
  const calls = result.sequenceDiagram.split('\n').filter(line => line.includes(' -> '));
  assert.deepEqual(calls, [
    'Main -> __proto__: run()',
    '__proto__ -> __proto__: ping()',
    'Main -> __proto__: ping()',
    'Main -> __proto__: run()',
    '__proto__ -> __proto__: ping()',
  ]);
});

test('Python UML binds a __proto__ parameter to the supplied object', () => {
  const result = global.analyzePythonSources({ 'model.py': `
class Worker:
    def ping(self):
        pass
class Runner:
    def run(self, __proto__: Worker):
        __proto__.ping()
worker = Worker()
runner = Runner()
runner.run(worker)
` });

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.sequenceWarnings, []);
  assert.match(result.sequenceDiagram, /runner -> worker: ping\(\)/);
  assert.doesNotMatch(result.sequenceDiagram, /\[object Object\]/);
});

test('Java UML finds main in a class named __proto__ and follows its calls', () => {
  const result = analyzeJavaSources({ 'Main.java': `
class __proto__ {
  void run() { ping(); }
  void ping() {}
  public static void main(String[] args) {
    __proto__ worker = new __proto__();
    worker.run();
  }
}
` });

  assert.deepEqual(result.errors, []);
  assert.match(result.classDiagram, /class __proto__ \{/);
  assert.match(result.sequenceDiagram, /participant worker: __proto__/);
  assert.match(result.sequenceDiagram, /Main -> worker: run\(\)/);
  assert.match(result.sequenceDiagram, /worker -> worker: ping\(\)/);
});

test('Java UML preserves a __proto__ receiver through calls and branch scopes', () => {
  const result = analyzeJavaSources({ 'Main.java': `
class Worker {
  void run() { ping(); }
  void ping() {}
  public static void main(String[] args) {
    Worker __proto__ = new Worker();
    if (args.length > 0) { __proto__.run(); }
    else { __proto__.ping(); }
    __proto__.run();
  }
}
` });

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.sequenceWarnings, []);
  const calls = result.sequenceDiagram.split('\n').filter(line => line.includes(' -> '));
  assert.deepEqual(calls, [
    'Main -> __proto__: run()',
    '__proto__ -> __proto__: ping()',
    'Main -> __proto__: ping()',
    'Main -> __proto__: run()',
    '__proto__ -> __proto__: ping()',
  ]);
});

test('Java UML binds a __proto__ parameter to the supplied object', () => {
  const result = analyzeJavaSources({ 'Main.java': `
class Worker { void ping() {} }
class Runner {
  void run(Worker __proto__) { __proto__.ping(); }
  public static void main(String[] args) {
    Worker worker = new Worker();
    Runner runner = new Runner();
    runner.run(worker);
  }
}
` });

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.sequenceWarnings, []);
  assert.match(result.sequenceDiagram, /runner -> worker: ping\(\)/);
});

for (const allocation of ['Worker worker = new Worker();', 'new Worker();']) {
  test(`Java UML does not invoke a method named constructor during ${allocation}`, () => {
    const result = analyzeJavaSources({ 'Main.java': `
class Worker {
  void constructor() { ping(); }
  void ping() {}
  public static void main(String[] args) { ${allocation} }
}
` });

    assert.deepEqual(result.errors, []);
    assert.match(result.sequenceDiagram, /<<create>>/);
    assert.doesNotMatch(result.sequenceDiagram, /: ping\(\)/);
  });
}

test('Java UML follows a method named constructor only when explicitly called', () => {
  const result = analyzeJavaSources({ 'Main.java': `
class Worker {
  Worker() { initialize(); }
  void initialize() {}
  void constructor() { ping(); }
  void ping() {}
  public static void main(String[] args) {
    Worker worker = new Worker();
    worker.constructor();
  }
}
` });

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.sequenceWarnings, []);
  assert.deepEqual(result.sequenceDiagram.split('\n').filter(line => line.includes(' -> ')), [
    'worker -> worker: initialize()',
    'Main -> worker: constructor()',
    'worker -> worker: ping()',
  ]);
});

test('TypeScript UML follows a __proto__ receiver through calls and branch scopes', () => {
  const result = global.analyzeJSSources({ 'model.ts': `
class Worker {
  run() { this.ping(); }
  ping() {}
}
const __proto__ = new Worker();
if (unknownFlag) { __proto__.run(); }
else { __proto__.ping(); }
__proto__.run();
` }, ts);

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.sequenceWarnings, []);
  const calls = result.sequenceDiagram.split('\n').filter(line => line.includes(' -> '));
  assert.deepEqual(calls, [
    'Main -> __proto__: run()',
    '__proto__ -> __proto__: ping()',
    'Main -> __proto__: ping()',
    'Main -> __proto__: run()',
    '__proto__ -> __proto__: ping()',
  ]);
});

test('TypeScript UML binds a __proto__ parameter to the supplied object', () => {
  const result = global.analyzeJSSources({ 'model.ts': `
class Worker { ping() {} }
class Runner { run(__proto__: Worker) { __proto__.ping(); } }
const worker = new Worker();
const runner = new Runner();
runner.run(worker);
` }, ts);

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.sequenceWarnings, []);
  assert.match(result.sequenceDiagram, /runner -> worker: ping\(\)/);
});
