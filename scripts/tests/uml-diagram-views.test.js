'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { mapType, project } = require('../../js/uml-diagram-views.js');
require('../../js/uml-analyzer-python.js');
const { analyzeJavaSources } = require('../../js/uml-analyzer-java.js');
const { analyzeCppSources } = require('../../js/uml-analyzer-cpp.js');
require('../../js/uml-analyzer-js.js');
const ts = require('../../js/vendor/typescript/5.9.3/typescript.min.js');

const cases = [
  { language: 'python', analyze: global.analyzePythonSources, filename: 'sample.py', source: `class Sample:
    count: int
    ready: bool
    name: str
    score: float
    def __init__(self, name: str) -> None:
        self.name: str = name
    def read(self, index: int) -> str:
        return self.name
    def clear(self) -> None:
        pass
    def __str__(self) -> str:
        return self.name
` },
  { language: 'java', analyze: analyzeJavaSources, filename: 'Sample.java', source: `class Sample {
    int count; boolean ready; String name; double score;
    Sample(String name) { this.name = name; }
    String read(int index) { return name; }
    void clear() {}
  }` },
  { language: 'cpp', analyze: analyzeCppSources, filename: 'sample.cpp', source: `class Sample {
    int count; bool ready; std::string name; double score;
    public: Sample(std::string name) : name(name) {}
    std::string read(int index) { return name; }
    void clear() {}
  };` },
  { language: 'typescript', analyze: sources => global.analyzeJSSources(sources, ts), filename: 'sample.ts', source: `class Sample {
    count: bigint; ready: boolean; name: string; score: number;
    constructor(name: string) { this.name = name; }
    read(index: bigint): string { return this.name; }
    clear(): void {}
  }` }
];

for (const { language, analyze, filename, source } of cases) {
  test(`${language}: design uses UML primitives while implementation preserves current analysis`, () => {
    const raw = analyze({ [filename]: source });
    const original = structuredClone(raw);
    const design = project(raw, { language, view: 'design' });
    for (const label of ['count: Integer', 'ready: Boolean', 'name: String', 'score: Real', 'read(index: Integer): String']) {
      assert.ok(design.classDiagram.includes(label), `${language} shows ${label}`);
    }
    assert.match(design.classDiagram, /\bSample\(name: String\)/);
    assert.doesNotMatch(design.classDiagram, /(?:__init__|constructor)\(/);
    assert.match(design.classDiagram, /clear\(\)(?!:)/);
    assert.deepEqual(raw, original, 'selecting a view does not mutate grading or diagnostic evidence');
    assert.equal(project(raw, { language, view: 'implementation' }).classDiagram, original.classDiagram);
  });
}

test('nullable types, collections and user-defined identities survive abstraction', () => {
  const mappings = [
    ['python', 'list[dict[str, int | None]]', 'Sequence<Map<String, Optional<Integer>>>'],
    ['python', 'Union[str, None]', 'Optional<String>'],
    ['python', 'str | int', 'String | Integer'],
    ['java', 'List<Integer>', 'Sequence<Optional<Integer>>'],
    ['cpp', 'const std::vector<std::string>&', 'Sequence<String>'],
    ['cpp', 'std::array<int, 4>', 'Sequence<Integer> [4]'],
    ['cpp', 'std::string*', 'Optional<String>'],
    ['typescript', 'string[]', 'Sequence<String>'],
    ['typescript', 'string | null', 'Optional<String>'],
    ['python', 'Literal["str", "int"]', 'Literal["str", "int"]'],
    ['python', 'Customer[str]', 'Customer[String]']
  ];
  for (const [language, source, expected] of mappings) {
    assert.equal(mapType(source, { language }), expected, `${language}: ${source}`);
  }
  assert.equal(mapType('str', { language: 'python', declaredTypes: new Set(['str']) }), 'str');
});

test('UnlimitedNatural is explicit model vocabulary, never inferred from a finite unsigned type', () => {
  assert.equal(mapType('unsigned long', { language: 'cpp' }), 'Integer {>=0}');
  assert.equal(mapType('std::size_t', { language: 'cpp' }), 'Integer {>=0}');
  assert.equal(mapType('std::int64_t', { language: 'cpp' }), 'Integer');
  assert.equal(mapType('UnlimitedNatural', { language: 'python' }), 'UnlimitedNatural');
  assert.equal(mapType('number', { language: 'typescript' }), 'Real');
});

test('design abstracts Python name markers while preserving visibility, relationships and protocols', () => {
  const raw = { classDiagram: `class Sample {
  #_name: str
  +__init__(name: str): None
  +__str__(): str
  +unannotated()
  +clear(): None
}
class Other
Sample --> "0..1" Other : selected
Sample --|> Parent`, sequenceDiagram: '', errors: ['partial source'], sequenceDiagnostics: [{ kind: 'unresolved' }] };
  const design = project(raw, { language: 'python' });
  assert.match(design.classDiagram, /#name: String/);
  assert.match(design.classDiagram, /str\(\): String/);
  assert.match(design.classDiagram, /unannotated\(\): \?/);
  assert.match(design.classDiagram, /clear\(\)\n/);
  assert.match(design.classDiagram, /Sample --> "0\.\.1" Other : selected\nSample --\|> Parent/);
  assert.deepEqual(design.errors, raw.errors);
  assert.deepEqual(design.sequenceDiagnostics, raw.sequenceDiagnostics);
  assert.match(project(raw, { language: 'python', retainConstruction: true }).classDiagram, /Sample\(name: String\)/);
});

test('Python name abstraction does not merge distinct source members or alter snake_case', () => {
  const raw = { classDiagram: `class Sample {
  +name: str
  #_name: str
  -__secret: int
  #_display_name(): str
  +__iter__(): Iterator
}`, sequenceDiagram: 'Main -> sample: _display_name()', errors: [] };
  const design = project(raw, { language: 'python' });
  assert.match(design.classDiagram, /\+name: String\n  #_name: String/);
  assert.match(design.classDiagram, /-secret: Integer/);
  assert.match(design.classDiagram, /#display_name\(\): String/);
  assert.match(design.classDiagram, /\+iter\(\): Iterator/);
  assert.equal(design.sequenceDiagram, 'Main -> sample: display_name()');
  assert.equal(project(raw, { language: 'python', view: 'implementation' }).classDiagram, raw.classDiagram);
});

test('bare containers keep unknown element types and nested optional containers keep distinct states', () => {
  assert.equal(mapType('list', { language: 'python' }), 'Sequence<?>');
  assert.equal(mapType('ArrayList', { language: 'java' }), 'Sequence<?>');
  assert.equal(mapType('dict', { language: 'python' }), 'Map<?, ?>');
  assert.equal(mapType('std::optional<std::optional<int>>', { language: 'cpp' }), 'Optional<Optional<Integer>>');
  assert.equal(mapType('std::optional<int>*', { language: 'cpp' }), 'Optional<Optional<Integer>>');
  assert.equal(mapType('Optional<Optional<Integer>>', { language: 'java' }), 'Optional<Optional<Integer>>');
});

test('sequence abstraction maps reply types while preserving literal arguments and control flow', () => {
  const raw = { classDiagram: '', sequenceDiagram: `participant sensor: Sensor
create sensor
Main --> sensor: <<create>>
opt [str == "int"]
Main -> sensor: read("str")
activate sensor
sensor --> Main: reading: str
deactivate sensor
end`, errors: [] };
  const design = project(raw, { language: 'python' });
  assert.equal(design.sequenceDiagram, raw.sequenceDiagram.replace('reading: str', 'reading: String'));
  assert.equal(project(raw, { language: 'python', view: 'implementation' }).sequenceDiagram, raw.sequenceDiagram);
});

test('class defaults use design expressions without mistaking equality or literal contents for assignment', () => {
  const raw = { classDiagram: `class Settings {
  +enabled: bool = ready == True
  +label: str = "True && enabled"
  +configure(active: bool = False): None
}`, sequenceDiagram: '', errors: [] };
  const design = project(raw, { language: 'python' });
  assert.match(design.classDiagram, /enabled: Boolean = ready == true/);
  assert.match(design.classDiagram, /label: String = "True && enabled"/);
  assert.match(design.classDiagram, /configure\(active: Boolean = false\)/);
  assert.equal(project(raw, { language: 'python', view: 'implementation' }).classDiagram, raw.classDiagram);
});

test('C++ parameterized constructors remain in namespace-qualified classes while empty destructors recede', () => {
  const raw = analyzeCppSources({ 'sample.cpp': `namespace sales {
    class Sample { public: Sample(int count) {} ~Sample() {} int read() { return 3; } };
  }` });
  const design = project(raw, { language: 'cpp' });
  assert.match(design.classDiagram, /class sales__Sample/);
  assert.match(design.classDiagram, /read\(\): Integer/);
  assert.match(design.classDiagram, /\+Sample\(count: Integer\)/);
  assert.doesNotMatch(design.classDiagram, /\+~Sample\(/);
  const lifecycle = project(raw, { language: 'cpp', retainConstruction: true });
  assert.match(lifecycle.classDiagram, /\+Sample\(count: Integer\)/);
  assert.match(lifecycle.classDiagram, /\+~Sample\(\)/);
});

test('a Java operation named like its class survives even when a constructor has identical rendered parameters', () => {
  const raw = analyzeJavaSources({ 'Sample.java': 'class Sample { Sample() {} void Sample() {} }' });
  assert.equal((raw.classDiagram.match(/~Sample\(\)/g) || []).length, 2);
  assert.equal((project(raw, { language: 'java' }).classDiagram.match(/~Sample\(\)/g) || []).length, 1);
  assert.equal((project(raw, { language: 'java', retainConstruction: true }).classDiagram.match(/~Sample\(\)/g) || []).length, 2);
});

test('unsupported TypeScript function-valued field types remain intact rather than being partially abstracted', () => {
  const raw = global.analyzeJSSources({ 'sample.ts': 'class Sample { callback: (text: string) => number; }' }, ts);
  assert.match(project(raw, { language: 'typescript' }).classDiagram,
    /\+callback: \(text: string\) => number/);
});

test('qualified domain wrappers are not silently replaced with standard-library collection claims', () => {
  assert.equal(mapType('domain::vector<int>', { language: 'cpp' }), 'domain::vector<Integer>');
  assert.equal(mapType('domain.List<int>', { language: 'java' }), 'domain.List<Integer>');
  assert.equal(mapType('domain.Optional[str]', { language: 'python' }), 'domain.Optional[String]');
});

test('parenthesized nullable element types retain their optionality when abstracted', () => {
  assert.equal(mapType('(string | null)[]', { language: 'typescript' }), 'Sequence<Optional<String>>');
  assert.equal(mapType('(str | None)', { language: 'python' }), 'Optional<String>');
});

test('Java Optional around a boxed primitive denotes one optional value rather than nested absence', () => {
  assert.equal(mapType('Optional<Integer>', { language: 'java' }), 'Optional<Integer>');
});

test('Python quoted forward annotations use the same primitive mapping as evaluated annotations', () => {
  const raw = global.analyzePythonSources({ 'sample.py': `class Sample:
    count: "int"
    def read(self) -> "str":
        return "hello"
  ` });
  const design = project(raw, { language: 'python' });
  assert.match(design.classDiagram, /\+count: Integer/);
  assert.match(design.classDiagram, /\+read\(\): String/);
  assert.equal(mapType('Literal["str"]', { language: 'python' }), 'Literal["str"]');
});

test('C++ qualifiers do not cause a user-defined string class to become a primitive', () => {
  const raw = analyzeCppSources({ 'sample.cpp': 'class string {}; class Box { public: const string& read(); };' });
  assert.match(project(raw, { language: 'cpp' }).classDiagram, /\+read\(\): string\n/);
});

test('separate parenthesized union members are not mistaken for one enclosing pair', () => {
  assert.equal(mapType('(string) | (null)', { language: 'typescript' }), 'Optional<String>');
});

const constructorCases = [
  { language: 'python', analyze: global.analyzePythonSources, filename: 'sample.py', name: '__init__', designName: 'Sample',
    empty: 'class Sample:\n    def __init__(self):\n        pass\n',
    parameterized: 'class Sample:\n    def __init__(self, count: int):\n        pass\n',
    initialized: 'class Sample:\n    def __init__(self):\n        self.count: int = 1\n' },
  { language: 'java', analyze: analyzeJavaSources, filename: 'Sample.java', name: 'Sample',
    empty: 'class Sample { Sample() {} }',
    parameterized: 'class Sample { Sample(int count) {} }',
    initialized: 'class Sample { int count; Sample() { this.count = 1; } }' },
  { language: 'cpp', analyze: analyzeCppSources, filename: 'sample.cpp', name: 'Sample',
    empty: 'class Sample { public: Sample() {} };',
    parameterized: 'class Sample { public: Sample(int count) {} };',
    initialized: 'class Sample { int count; public: Sample() : count(1) {} };' },
  { language: 'typescript', analyze: sources => global.analyzeJSSources(sources, ts), filename: 'sample.ts', name: 'constructor', designName: 'Sample',
    empty: 'class Sample { constructor() {} }',
    parameterized: 'class Sample { constructor(count: number) {} }',
    initialized: 'class Sample { count: number; constructor() { this.count = 1; } }' },
];

for (const example of constructorCases) {
  test(`${example.language}: design omits an empty no-argument constructor and implementation restores it`, () => {
    const raw = example.analyze({ [example.filename]: example.empty });
    const operation = new RegExp(example.name + '\\(');
    const designOperation = new RegExp((example.designName || example.name) + '\\(');
    assert.match(raw.classDiagram, operation);
    assert.doesNotMatch(project(raw, { language: example.language }).classDiagram, designOperation);
    assert.match(project(raw, { language: example.language, view: 'implementation' }).classDiagram, operation);
  });
  for (const kind of ['parameterized', 'initialized']) {
    test(`${example.language}: design retains a ${kind} constructor`, () => {
      const raw = example.analyze({ [example.filename]: example[kind] });
      assert.match(project(raw, { language: example.language }).classDiagram, new RegExp((example.designName || example.name) + '\\('));
    });
  }
}

test('Python documentation and an explicit no-result return do not make a no-argument initializer substantive', () => {
  const raw = global.analyzePythonSources({ 'sample.py': 'class Sample:\n    def __init__(self):\n        "Documented default."\n        return None\n' });
  assert.doesNotMatch(project(raw, { language: 'python' }).classDiagram, /Sample\(/);
});

test('C++ destruction with cleanup behavior remains visible', () => {
  const raw = analyzeCppSources({ 'sample.cpp': 'class Sample { public: ~Sample() { release(); } void release() {} };' });
  assert.match(project(raw, { language: 'cpp' }).classDiagram, /\+~Sample\(\)/);
});

test('equivalent sequence types share one Design spelling, including qualified and readonly forms', () => {
  for (const [language, types] of [
    ['python', ['list[str]', 'typing.List[str]', 'collections.abc.Sequence[str]']],
    ['java', ['List<String>', 'java.util.List<String>', 'String[]']],
    ['cpp', ['std::vector<std::string>', 'std::list<std::string>']],
    ['typescript', ['string[]', 'readonly string[]', 'Array<string>', 'ReadonlyArray<string>']]
  ]) {
    for (const type of types) assert.equal(mapType(type, { language }), 'Sequence<String>', `${language}: ${type}`);
  }
  for (const [language, type] of [['python', 'typing.List'], ['java', 'java.util.List']]) {
    assert.equal(mapType(type, { language }), 'Sequence<?>');
  }
  assert.equal(mapType('domain.List', { language: 'java' }), 'domain.List');
  assert.equal(mapType('List', { language: 'java', declaredTypes: new Set(['List']) }), 'List');
});

test('nested fixed arrays retain their outer and inner bounds', () => {
  assert.equal(mapType('int[3][4]', { language: 'cpp' }), 'Sequence<Sequence<Integer> [4]> [3]');
  assert.equal(mapType('std::array<std::array<int, 4>, 3>', { language: 'cpp' }), 'Sequence<Sequence<Integer> [4]> [3]');
});

test('parentheses inside literal parameter types do not hide the operation return type', () => {
  const python = global.analyzePythonSources({ 'sample.py': 'from typing import Literal\nclass Parser:\n    def choose(self, token: Literal["("]) -> str:\n        return token\n' });
  const typescript = global.analyzeJSSources({ 'sample.ts': 'class Parser { choose(token: "("): string { return token; } }' }, ts);
  assert.match(project(python, { language: 'python' }).classDiagram, /choose\(token: Literal\["\("\]\): String/);
  assert.match(project(typescript, { language: 'typescript' }).classDiagram, /choose\(token: "\("\): String/);
});

test('Python operation names agree between class and sequence views without cross-class collisions', () => {
  const raw = global.analyzePythonSources({ 'sample.py': `class A:
    def _read(self) -> int:
        return 1
class B:
    def read(self) -> int:
        return 2
a = A()
b = B()
first = a._read()
second = b.read()
` });
  const design = project(raw, { language: 'python' });
  assert.match(design.classDiagram, /#read\(\): Integer/);
  assert.match(design.sequenceDiagram, /Main -> a: read\(\)/);
  assert.match(design.sequenceDiagram, /Main -> b: read\(\)/);
  assert.match(project(raw, { language: 'python', view: 'implementation' }).sequenceDiagram, /Main -> a: _read\(\)/);
});

test('Python literal prefixes and escaping survive inference before Design normalization', () => {
  const raw = global.analyzePythonSources({ 'sample.py': String.raw`class Sink:
    def emit(self, value: object) -> None:
        pass
sink = Sink()
count = 2
sink.emit(f"{count} members online")
sink.emit(r"\n")
sink.emit(b"book")
sink.emit("don't change")
` });
  const design = project(raw, { language: 'python' });
  for (const label of ['emit(f"{count} members online")', String.raw`emit(r"\n")`, 'emit(b"book")', 'emit("don\'t change")']) {
    assert.ok(raw.sequenceDiagram.includes(label), `Implementation preserves ${label}`);
    assert.ok(design.sequenceDiagram.includes(label), `Design preserves ${label}`);
  }
});
