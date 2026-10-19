'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
require('../../js/uml-analyzer-python.js');
require('../../js/uml-analyzer-js.js');
const ts = require('../../js/vendor/typescript/5.9.3/typescript.min.js');
const { project } = require('../../js/uml-diagram-views.js');

const languages = [
  {
    language: 'python',
    analyze: body => global.analyzePythonSources({ 'example.py': `class Sink:
    def use(self, value: int) -> None:
        pass
sink = Sink()
${body}` }),
    loop: 'for item in items:\n    sink.use(item)\n',
    setup: 'first = 3 - 2\nitems = [first, first + 1]\n',
    cases: {
      mutation: 'items[0] = 9\n',
      alias: 'alias = items\nalias.append(9)\n',
      escape: 'mutate(items)\n',
      'unknown call': 'mutate()\n',
      'branch uncertainty': 'if ready:\n    items = [8, 9]\n',
      'augmented update': 'items += [9]\n',
      'descriptor read': 'value = sink.value\n',
      deletion: 'del items[0]\n'
    }
  },
  {
    language: 'typescript',
    analyze: body => global.analyzeJSSources({ 'example.ts': `class Sink { use(value: number): void {} }
let sink = new Sink();
${body}` }, ts),
    loop: 'for (const item of items) { sink.use(item); }\n',
    setup: 'const first = 3 - 2;\nlet items = [first, first + 1];\n',
    cases: {
      mutation: 'items[0] = 9;\n',
      alias: 'const alias = items; alias.push(9);\n',
      escape: 'mutate(items);\n',
      'unknown call': 'mutate();\n',
      'branch uncertainty': 'if (ready) { items = [8, 9]; }\n',
      'augmented update': 'items += [9];\n',
      'descriptor read': 'const value = sink.value;\n',
      deletion: 'delete items[0];\n'
    }
  }
];

for (const fixture of languages) {
  test(`${fixture.language}: Design expands proven local values and preserves source notation`, () => {
    const raw = fixture.analyze(fixture.setup + fixture.loop);
    const original = structuredClone(raw);
    assert.deepEqual(raw.errors, []);
    assert.match(raw.sequenceDiagram, /loop \[for .*items\]/);
    assert.match(project(raw, { language: fixture.language }).sequenceDiagram, /loop \[for each item in \[1, 2\]\]/);
    assert.equal(project(raw, { language: fixture.language, view: 'implementation' }).sequenceDiagram, original.sequenceDiagram);
    assert.deepEqual(raw, original, 'the view does not modify analyzer evidence');
  });

  for (const [reason, intervening] of Object.entries(fixture.cases)) {
    test(`${fixture.language}: ${reason} prevents a stale iterable substitution`, () => {
      const raw = fixture.analyze(fixture.setup + intervening + fixture.loop);
      assert.match(project(raw, { language: fixture.language }).sequenceDiagram, /loop \[for each item in items\]/);
    });
  }

  test(`${fixture.language}: conflicting occurrences of the same loop retain their variable`, () => {
    const reassignment = fixture.language === 'python' ? 'items = [3, 4]\n' : 'items = [3, 4];\n';
    const raw = fixture.analyze(fixture.setup + fixture.loop + reassignment + fixture.loop);
    const design = project(raw, { language: fixture.language }).sequenceDiagram;
    assert.equal((design.match(/loop \[for each item in items\]/g) || []).length, 2);
  });

  test(`${fixture.language}: a loop body that exposes its iterable retains the name`, () => {
    const loop = fixture.language === 'python'
      ? 'for item in items:\n    sink.use(item)\n    mutate(items)\n'
      : 'for (const item of items) { sink.use(item); mutate(items); }\n';
    const raw = fixture.analyze(fixture.setup + loop);
    assert.match(project(raw, { language: fixture.language }).sequenceDiagram, /loop \[for each item in items\]/);
  });

  test(`${fixture.language}: outer iterations cannot lend their initial values to nested loops`, () => {
    const body = fixture.language === 'python'
      ? 'for round in [0, 1]:\n    for item in items:\n        sink.use(item)\n    items = [3, 4]\n'
      : 'for (const round of [0, 1]) { for (const item of items) { sink.use(item); } items = [3, 4]; }\n';
    const raw = fixture.analyze(fixture.setup + body);
    assert.match(project(raw, { language: fixture.language }).sequenceDiagram, /loop \[for each item in items\]/);
  });

  test(`${fixture.language}: rebinding a receiver in the loop prevents assuming its old method is inert`, () => {
    const body = fixture.language === 'python'
      ? 'for item in items:\n    sink = external\n    sink.use(item)\n'
      : 'for (const item of items) { sink = external; sink.use(item); }\n';
    const raw = fixture.analyze(fixture.setup + body);
    assert.deepEqual(raw.sequenceLoopConstants, []);
  });

  test(`${fixture.language}: replacing a declared method prevents a later inert-body proof`, () => {
    const replacement = fixture.language === 'python' ? 'sink.use = replacement\n' : 'sink.use = replacement;\n';
    const raw = fixture.analyze(replacement + fixture.setup + fixture.loop);
    assert.match(project(raw, { language: fixture.language }).sequenceDiagram, /loop \[for each item in items\]/);
  });
}

test('Python numeric spellings are never mistaken for approximate parser values', () => {
  for (const literal of ['0x10', '0b10', '9007199254740993', '1j']) {
    const fixture = languages[0];
    const raw = fixture.analyze(`items = [${literal}, 2]\n` + fixture.loop);
    assert.match(project(raw, { language: 'python' }).sequenceDiagram, /loop \[for each item in items\]/);
  }
});

test('TypeScript block shadowing does not lend an inner collection to an outer loop', () => {
  const fixture = languages[1];
  const raw = fixture.analyze('let items = input; { let items = [1, 2]; }\n' + fixture.loop);
  assert.match(project(raw, { language: 'typescript' }).sequenceDiagram, /loop \[for each item in items\]/);
});

test('method-local constants do not reuse a caller collection with the same name', () => {
  const sources = [
    ['python', global.analyzePythonSources({ 'example.py': `class Sink:
    def use(self, value: int) -> None:
        pass
    def run(self, items):
        for item in items:
            self.use(item)
sink = Sink()
items = [1, 2]
sink.run(unknown)
` })],
    ['typescript', global.analyzeJSSources({ 'example.ts': `class Sink {
  use(value: number): void {}
  run(items: number[]): void { for (const item of items) { this.use(item); } }
}
const sink = new Sink();
const items = [1, 2];
sink.run(unknown);
` }, ts)]
  ];
  for (const [language, raw] of sources) {
    assert.match(project(raw, { language }).sequenceDiagram, /loop \[for each item in items\]/);
  }
});

test('a TypeScript default argument can mutate captured state even when the method body is empty', () => {
  const raw = global.analyzeJSSources({ 'example.ts': `let items = [1, 2];
class Sink { use(value: number = items.pop()): void {} }
const sink = new Sink();
items = [1, 2];
for (const item of items) { sink.use(); }
` }, ts);
  assert.match(project(raw, { language: 'typescript' }).sequenceDiagram, /loop \[for each item in items\]/);
});

test('a Python decorator prevents assuming an empty method remains inert', () => {
  const raw = global.analyzePythonSources({ 'example.py': `class Sink:
    @decorate
    def use(self, value):
        pass
sink = Sink()
items = [1, 2]
for item in items:
    sink.use(item)
` });
  assert.match(project(raw, { language: 'python' }).sequenceDiagram, /loop \[for each item in items\]/);
});
