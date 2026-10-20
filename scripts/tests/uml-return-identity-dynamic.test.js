'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
require('../../js/uml-analyzer-python.js');
require('../../js/uml-analyzer-js.js');
const ts = require('../../js/vendor/typescript/5.9.3/typescript.min.js');

const fixtures = [
  {
    language: 'Python',
    analyze: source => global.analyzePythonSources({ 'example.py': source }),
    source: (body, use = 'chosen = echo.same(original, other, ready)\nchosen.work()', signature = 'value: Item, other: Item, ready: bool') => `class Item:
    def work(self) -> None:
        pass
    def fluent(self) -> "Item":
        return self
class Echo:
    def same(self, ${signature}) -> Item:
${body.split('\n').map(line => '        ' + line).join('\n')}
original = Item()
other = Item()
echo = Echo()
${use}`,
    bodies: {
      direct: 'return value',
      alias: 'alias = value\nreturn alias',
      branches: 'if ready:\n    return value\nelse:\n    return value',
      joinedAlias: 'if ready:\n    alias = value\nelse:\n    alias = value\nreturn alias',
      earlyReturn: 'if ready:\n    return value\nreturn value',
      rebound: 'value = other\nreturn value',
      ambiguous: 'if ready:\n    return value\nelse:\n    return other',
      fallthrough: 'if ready:\n    return value',
      unsupported: 'for index in [1, 2]:\n    pass\nreturn value',
      effect: 'value.work()\nreturn value',
      field: 'return self.value'
    },
    chain: 'echo.same(original, other, ready).work()',
    fluent: 'original.fluent().work()',
    inherited: `class Parent:
    def work(self) -> None:
        pass
    def fluent(self) -> "Parent":
        return self
class Child(Parent):
    pass
child = Child()
child.fluent().work()`
  },
  {
    language: 'TypeScript',
    analyze: source => global.analyzeJSSources({ 'example.ts': source }, ts),
    source: (body, use = 'const chosen: Item = echo.same(original, other, ready); chosen.work();', signature = 'value: Item, other: Item, ready: boolean') => `class Item { work(): void {} fluent(): Item { return this; } }
class Echo { same(${signature}): Item { ${body} } }
let original = new Item(); const other = new Item(); const echo = new Echo();
${use}`,
    bodies: {
      direct: 'return value;',
      alias: 'const alias = value; return alias;',
      branches: 'if (ready) { return value; } else { return value; }',
      joinedAlias: 'let alias; if (ready) { alias = value; } else { alias = value; } return alias;',
      earlyReturn: 'if (ready) return value; return value;',
      rebound: 'value = other; return value;',
      ambiguous: 'if (ready) return value; else return other;',
      fallthrough: 'if (ready) return value;',
      unsupported: 'for (const index of [1, 2]) {} return value;',
      effect: 'value.work(); return value;',
      field: 'return this.value;'
    },
    chain: 'echo.same(original, other, ready).work();',
    fluent: 'original.fluent().work();',
    inherited: 'class Parent { work(): void {} fluent(): Parent { return this; } } class Child extends Parent {} const child = new Child(); child.fluent().work();'
  }
];

function analyze(fixture, source) {
  const result = fixture.analyze(source);
  assert.deepEqual(result.errors, [], 'valid supported source must still produce diagrams');
  assert.ok(result.sequenceDiagram, 'a modeled interaction must remain visible');
  return result;
}

for (const fixture of fixtures) {
  for (const kind of ['direct', 'alias', 'branches', 'joinedAlias', 'earlyReturn', 'rebound']) {
    test(`${fixture.language}: ${kind} return preserves the input object lifeline`, () => {
      const result = analyze(fixture, fixture.source(fixture.bodies[kind]));
      assert.match(result.sequenceDiagram, new RegExp(`Main -> ${kind === 'rebound' ? 'other' : 'original'}: work\\(\\)`));
      assert.equal((result.sequenceDiagram.match(/^participant .*: Item$/gm) || []).length, 2,
        'assigning an existing object cannot create a third object lifeline');
    });
  }

  test(`${fixture.language}: returned parameters and receivers support chained calls`, () => {
    for (const use of [fixture.chain, fixture.fluent]) {
      const result = analyze(fixture, fixture.source(fixture.bodies.direct, use));
      assert.match(result.sequenceDiagram, /Main -> original: work\(\)/);
      assert.equal((result.sequenceDiagram.match(/: (?:same|fluent)\(/g) || []).length, 1,
        'following a returned identity must not execute the returning call twice');
    }
  });

  for (const kind of ['ambiguous', 'fallthrough', 'unsupported', 'effect', 'field']) {
    test(`${fixture.language}: ${kind} return does not guess a supplied identity`, () => {
      const result = analyze(fixture, fixture.source(fixture.bodies[kind]));
      assert.doesNotMatch(result.sequenceDiagram, /Main -> (?:original|other): work\(\)/);
      if (kind === 'effect') assert.match(result.sequenceDiagram, /echo -> original: work\(\)/,
        'summary failure must not suppress the actual body interaction');
    });
  }

  test(`${fixture.language}: an empty subclass retains inherited behavior and fluent identity`, () => {
    const result = analyze(fixture, fixture.inherited);
    assert.match(result.sequenceDiagram, /participant child: Child/);
    assert.match(result.sequenceDiagram, /Main -> child: fluent\(\)/);
    assert.match(result.sequenceDiagram, /Main -> child: work\(\)/);
    assert.equal((result.sequenceDiagram.match(/^participant .*: (?:Parent|Child)$/gm) || []).length, 1);
  });
}

const python = fixtures[0], typescript = fixtures[1];

test('Python: reordered keyword actuals preserve the returned argument', () => {
  const result = analyze(python, python.source('return value',
    'chosen = echo.same(other=other, ready=ready, value=original)\nchosen.work()'));
  assert.match(result.sequenceDiagram, /Main -> original: work\(\)/);
});

test('TypeScript: actual argument identity is captured before a later argument rebinds it', () => {
  const result = analyze(typescript, typescript.source('return value;',
    'echo.same(original, original = other, ready).work(); original.work();'));
  assert.match(result.sequenceDiagram, /Main -> original: work\(\)/);
  assert.match(result.sequenceDiagram, /Main -> other: work\(\)/);
});

test('TypeScript: a block-local alias cannot replace the returned parameter', () => {
  const result = analyze(typescript, typescript.source('{ const value = other; } return value;'));
  assert.match(result.sequenceDiagram, /Main -> original: work\(\)/);
});

test('Python: a variadic collection is not its first supplied object', () => {
  const result = analyze(python, python.source('return values',
    'chosen = echo.same(original, other)\nchosen.work()', '*values: Item'));
  assert.doesNotMatch(result.sequenceDiagram, /Main -> (?:original|other): work\(\)/);
});

test('TypeScript: a rest collection is not its first supplied object', () => {
  const result = analyze(typescript, typescript.source('return values;',
    'const chosen: Item = echo.same(original, other); chosen.work();', '...values: Item[]'));
  assert.doesNotMatch(result.sequenceDiagram, /Main -> (?:original|other): work\(\)/);
});

test('Python: an omitted default argument is not another argument', () => {
  const result = analyze(python, python.source('return other',
    'chosen = echo.same(original)\nchosen.work()', 'value: Item, other: Item = None'));
  assert.doesNotMatch(result.sequenceDiagram, /Main -> original: work\(\)/);
});

test('TypeScript: an omitted default argument is not another argument', () => {
  const result = analyze(typescript, typescript.source('return other;',
    'const chosen: Item = echo.same(original); chosen.work();', 'value: Item, other: Item = null'));
  assert.doesNotMatch(result.sequenceDiagram, /Main -> original: work\(\)/);
});

test('Python: replacing a method invalidates its declared return identity', () => {
  const result = analyze(python, python.source('return value',
    'echo.same = lambda value, other, ready: other\nchosen = echo.same(original, other, ready)\nchosen.work()'));
  assert.doesNotMatch(result.sequenceDiagram, /Main -> (?:original|other): work\(\)/);
});

test('TypeScript: replacing a method invalidates its declared return identity', () => {
  const result = analyze(typescript, typescript.source('return value;',
    'echo.same = (value, other, ready) => other; const chosen: Item = echo.same(original, other, ready); chosen.work();'));
  assert.doesNotMatch(result.sequenceDiagram, /Main -> (?:original|other): work\(\)/);
});

test('Python: cached summaries bind each invocation to its own actual object', () => {
  const source = `class Item:
    def work(self) -> None: pass
class Echo:
    def same(self, value: Item) -> Item:
        return value
class Driver:
    def use(self, echo: Echo, value: Item) -> None:
        echo.same(value).work()
first = Item()
second = Item()
echo = Echo()
driver = Driver()
driver.use(echo, first)
driver.use(echo, second)`;
  const result = analyze(python, source);
  assert.match(result.sequenceDiagram, /driver -> first: work\(\)/);
  assert.match(result.sequenceDiagram, /driver -> second: work\(\)/);
  assert.equal((result.sequenceDiagram.match(/: work\(\)/g) || []).length, 2);
});

test('TypeScript: cached summaries bind each invocation to its own actual object', () => {
  const source = `class Item { work(): void {} }
class Echo { same(value: Item): Item { return value; } }
class Driver { use(echo: Echo, value: Item): void { echo.same(value).work(); } }
const first = new Item(); const second = new Item(); const echo = new Echo(); const driver = new Driver();
driver.use(echo, first); driver.use(echo, second);`;
  const result = analyze(typescript, source);
  assert.match(result.sequenceDiagram, /driver -> first: work\(\)/);
  assert.match(result.sequenceDiagram, /driver -> second: work\(\)/);
  assert.equal((result.sequenceDiagram.match(/: work\(\)/g) || []).length, 2);
});

test('TypeScript: a fluent receiver is captured before argument evaluation replaces its variable', () => {
  const result = analyze(typescript, typescript.source('return value;',
    'original.fluent(original = other).work(); original.work();').replace('fluent(): Item', 'fluent(other?: Item): Item'));
  assert.match(result.sequenceDiagram, /Main -> original: fluent\(original = other\)/);
  assert.match(result.sequenceDiagram, /Main -> original: work\(\)/);
  assert.match(result.sequenceDiagram, /Main -> other: work\(\)/);
});

test('Python: a decorated parent does not prove its replacement class returns the same object', () => {
  const source = `class Item:
    def work(self) -> None: pass
@replace_methods
class Echo:
    def same(self, value: Item) -> Item:
        return value
class Child(Echo):
    pass
original = Item()
echo = Child()
chosen = echo.same(original)
chosen.work()`;
  const result = analyze(python, source);
  assert.doesNotMatch(result.sequenceDiagram, /Main -> original: work\(\)/);
});


test('TypeScript: inherited calls and reply types use the defining source file', () => {
  const result = global.analyzeJSSources({
    'parent.ts': 'class Parent { work(): void {} fluent(): Parent { return this; } }',
    'child.ts': 'class Child extends Parent {} const child = new Child(); child.fluent().work();'
  }, ts);
  assert.deepEqual(result.errors, []);
  assert.match(result.sequenceDiagram, /child --> Main: Parent/);
  assert.equal((result.sequenceDiagram.match(/child --> Main:/g) || []).length, 1,
    'an inherited void method has no typed reply');
  assert.match(result.sequenceDiagram, /Main -> child: work\(\)/);
});
