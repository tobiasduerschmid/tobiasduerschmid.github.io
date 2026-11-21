'use strict';

// Inferred class and sequence diagrams carry, per diagram line, the source
// range that line came from. These tests pin the ranges that the diagram
// viewers highlight: a class, a member, a relationship and a call.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const test = require('node:test');
require('../../js/uml-analyzer-python.js');
require('../../js/uml-analyzer-js.js');
const { analyzeJavaSources } = require('../../js/uml-analyzer-java.js');
const compiler = require('../../js/vendor/typescript/5.9.3/typescript.min.js');
const views = require('../../js/uml-diagram-views.js');

/** The source range of the one diagram line that matches pattern. */
function sourceOf(result, kind, pattern) {
  const lines = result[kind + 'Diagram'].split('\n');
  const matches = lines.flatMap((line, index) => pattern.test(line) ? [index] : []);
  assert.equal(matches.length, 1, `exactly one ${kind} line matches ${pattern}:\n${lines.join('\n')}`);
  return result[kind + 'DiagramSources'][matches[0]];
}

const range = (file, startLine, endLine = startLine) => ({ file, startLine, endLine });

const python = `class Engine:
    def start(self) -> None:
        pass


class Car:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine
        self.speed = 0

    def drive(self) -> int:
        self.engine.start()
        return self.speed


if __name__ == "__main__":
    car = Car(Engine())
    speed = car.drive()
    print(speed)
`;

test('Python class, member, association and call lines map to their statements', () => {
  const result = global.analyzePythonSources({ 'car.py': python }, {});
  assert.deepEqual(result.errors, []);
  assert.deepEqual(sourceOf(result, 'class', /^class Car \{/), range('car.py', 6, 13));
  assert.deepEqual(sourceOf(result, 'class', /\+drive\(\)/), range('car.py', 11, 13));
  assert.deepEqual(sourceOf(result, 'class', /\+speed/), range('car.py', 9));
  assert.deepEqual(sourceOf(result, 'class', /^Car --> .*Engine/), range('car.py', 8));
  assert.deepEqual(sourceOf(result, 'sequence', /-> \w+: start\(\)/), range('car.py', 12));
  assert.deepEqual(sourceOf(result, 'sequence', /^Main -> car: drive\(\)/), range('car.py', 18));
  assert.deepEqual(sourceOf(result, 'sequence', /^car --> Main: /), range('car.py', 18), 'a reply links to the call it answers');
  assert.deepEqual(sourceOf(result, 'sequence', /^participant car: Car/), range('car.py', 6, 13), 'a lifeline links to its class');
  assert.deepEqual(sourceOf(result, 'sequence', /^participant Main /), range('car.py', 17, 19), 'Main links to the entry-point block');
});

test('Python inheritance and dependency lines map to the code that needs them', () => {
  const source = `class Receipt:
    pass


class Shape:
    def area(self) -> float:
        return 0.0


@register
class Square(Shape):
    def area(self) -> float:
        return 1.0

    def print_receipt(self) -> None:
        receipt = Receipt()
`;
  const result = global.analyzePythonSources({ 'shapes.py': source }, {});
  assert.deepEqual(sourceOf(result, 'class', /^class Square \{/), range('shapes.py', 10, 16), 'a class range includes its decorators');
  assert.deepEqual(sourceOf(result, 'class', /^Square --\|> Shape$/), range('shapes.py', 11), 'inheritance names the class line, not a decorator');
  assert.deepEqual(sourceOf(result, 'class', /^Square \.\.> Receipt$/), range('shapes.py', 16));
});

test('A Python sequence keeps its sources aligned when a warning note is inserted', () => {
  const source = python.replace('    print(speed)', '    while True:\n        car.drive()');
  const result = global.analyzePythonSources({ 'car.py': source }, {});
  const lines = result.sequenceDiagram.split('\n');
  assert.ok(lines.includes('note over Main'), 'the partial-sequence note is present');
  assert.equal(result.sequenceDiagramSources.length, lines.length);
  const drives = lines.flatMap((line, index) => /^Main -> car: drive\(\)/.test(line) ? [result.sequenceDiagramSources[index]] : []);
  assert.deepEqual(drives, [range('car.py', 18), range('car.py', 20)]);
});

const java = `class Engine {
    void start() {
    }
}

class Car {
    private Engine engine;
    private int speed;

    Car(Engine engine) {
        this.engine = engine;
    }

    int drive() {
        engine.start();
        return speed;
    }
}

class Main {
    public static void main(String[] args) {
        Car car = new Car(new Engine());
        int speed = car.drive();
    }
}
`;

/** Browsers parse Java with tree-sitter; the token parser is the fallback. */
async function treeSitterJava(t) {
  const vendor = path.resolve(__dirname, '../../js/vendor/tree-sitter');
  const runtime = path.join(vendor, 'web-tree-sitter-0.25.10/tree-sitter.js');
  // Node treats the pinned browser ESM as CommonJS by filename.
  const source = fs.readFileSync(runtime, 'utf8').replaceAll('import.meta.url', JSON.stringify(pathToFileURL(runtime).href));
  const { Parser, Language } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  await Parser.init({ locateFile: name => path.join(path.dirname(runtime), name) });
  const parser = new Parser();
  parser.setLanguage(await Language.load(path.join(vendor, 'tree-sitter-java-0.23.5/tree-sitter-java.wasm')));
  const { javaSyntaxWorkspace } = await import('../../js/uml-java-syntax.mjs');
  const workspace = javaSyntaxWorkspace(parser);
  t.after(() => workspace.dispose());
  return sources => analyzeJavaSources(sources, {}, workspace.parse(sources));
}

function expectJavaRanges(analyze) {
  const result = analyze({ 'Main.java': java });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(sourceOf(result, 'class', /^class Car \{/), range('Main.java', 6, 18));
  assert.deepEqual(sourceOf(result, 'class', /drive\(\)/), range('Main.java', 14, 17));
  assert.deepEqual(sourceOf(result, 'class', /-speed: int/), range('Main.java', 8));
  assert.deepEqual(sourceOf(result, 'class', /^Car --> .*Engine/), range('Main.java', 11));
  assert.deepEqual(sourceOf(result, 'sequence', /-> \w+: start\(\)/), range('Main.java', 15));
  assert.deepEqual(sourceOf(result, 'sequence', /^Main -> car: drive\(\)/), range('Main.java', 23));
  assert.deepEqual(sourceOf(result, 'sequence', /^Main --> car: <<create>>/), range('Main.java', 22));
  assert.deepEqual(sourceOf(result, 'sequence', /^participant Main /), range('Main.java', 21, 24));
}

function expectJavaHeaders(analyze) {
  const source = `class Receipt {
}

abstract class Shape {
    abstract double area();
}

@Deprecated
class Square extends Shape {
    @Override
    double area() {
        return 1.0;
    }

    @Deprecated
    void print(Receipt receipt) {
    }
}
`;
  const result = analyze({ 'Shapes.java': source });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(sourceOf(result, 'class', /^class Square \{/), range('Shapes.java', 8, 18), 'a class range includes its annotations');
  assert.deepEqual(sourceOf(result, 'class', /^Square --\|> Shape$/), range('Shapes.java', 9));
  assert.deepEqual(sourceOf(result, 'class', /^Square \.\.> Receipt$/), range('Shapes.java', 16));
}

test('Java class, member, association and call lines map to their declarations', () => {
  expectJavaRanges(sources => analyzeJavaSources(sources));
});

test('Java inheritance and dependency lines name the declaration line, not an annotation', () => {
  expectJavaHeaders(sources => analyzeJavaSources(sources));
});

test('Java ranges are the same when the browser\'s tree-sitter parser reads the code', async t => {
  const analyze = await treeSitterJava(t);
  expectJavaRanges(analyze);
  expectJavaHeaders(analyze);
});

const typescript = `class Engine {
  start(): void {
  }
}

class Car {
  private speed: number = 0;

  constructor(private engine: Engine) {
  }

  drive(): number {
    this.engine.start();
    return this.speed;
  }
}

const car = new Car(new Engine());
const speed = car.drive();
`;

test('TypeScript class, member, association and call lines map to their nodes', () => {
  const result = global.analyzeJSSources({ 'car.ts': typescript }, compiler);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(sourceOf(result, 'class', /^class Car \{/), range('car.ts', 6, 16));
  assert.deepEqual(sourceOf(result, 'class', /\+drive\(\)/), range('car.ts', 12, 15));
  assert.deepEqual(sourceOf(result, 'class', /-speed: number/), range('car.ts', 7));
  assert.deepEqual(sourceOf(result, 'class', /^Car --> .*Engine/), range('car.ts', 9));
  assert.deepEqual(sourceOf(result, 'sequence', /-> \w+: start\(\)/), range('car.ts', 13));
  assert.deepEqual(sourceOf(result, 'sequence', /^Main -> car: drive\(\)/), range('car.ts', 19));
});

test('TypeScript inheritance and dependency lines name the declaration line, not a decorator', () => {
  const source = `function sealed(target: unknown, context?: unknown): void {}
function logged(target: unknown, context?: unknown): void {}

class Receipt {}

class Shape {}

@sealed
class Square extends Shape {
  @logged
  print(receipt: Receipt): void {
  }
}
`;
  const result = global.analyzeJSSources({ 'shapes.ts': source }, compiler);
  assert.deepEqual(sourceOf(result, 'class', /^class Square \{/), range('shapes.ts', 8, 13), 'a class range includes its decorators');
  assert.deepEqual(sourceOf(result, 'class', /^Square --\|> Shape$/), range('shapes.ts', 9));
  assert.deepEqual(sourceOf(result, 'class', /^Square \.\.> Receipt$/), range('shapes.ts', 11));
});

test('TypeScript lines stay in the learner\'s file after symbol resolution rewrites it', () => {
  // Same-named classes are renamed and the alias is expanded across lines in
  // the analyzed copy; the ranges must still name lines of the original file.
  const other = 'export class Item {\n  name: string = \'\';\n}\n';
  const main = `import { Item as Other } from './a';
type Pair = {
  left: Other;
  right: Other;
};
export class Item {
  pair: Pair | null = null;
  count: number = 0;
  ping(): void {
  }
}
const item = new Item();
item.ping();
`;
  const result = global.analyzeJSSources({ 'a.ts': other, 'b.ts': main }, compiler);
  assert.deepEqual(sourceOf(result, 'class', /\+count: number/), range('b.ts', 8));
  assert.deepEqual(sourceOf(result, 'class', /\+ping\(\)/), range('b.ts', 9, 10));
  assert.deepEqual(sourceOf(result, 'class', /\+name: string/), range('a.ts', 2));
  assert.deepEqual(sourceOf(result, 'sequence', /^Main -> item: ping\(\)/), range('b.ts', 13));
});

test('The design view keeps class sources aligned when it drops a default constructor', () => {
  const source = 'class Counter {\n    public Counter() {\n    }\n\n    public void tick() {\n    }\n}\n';
  const result = analyzeJavaSources({ 'Counter.java': source });
  const design = views.project(result, { language: 'java', view: 'design' });
  assert.ok(!/Counter\(\)/.test(design.classDiagram), 'the default constructor is hidden in design view');
  assert.equal(design.classDiagramSources.length, design.classDiagram.split('\n').length);
  assert.deepEqual(sourceOf(design, 'class', /tick\(\)/), range('Counter.java', 5, 6));
});

const { analyzeCppSources } = require('../../js/uml-analyzer-cpp.js');

const cpp = `class Engine {
public:
    void start() {
    }
};

class Car {
    Engine* engine;
    int speed;
public:
    Car(Engine* engine) : engine(engine), speed(0) {
    }

    int drive();
};

int Car::drive() {
    engine->start();
    return speed;
}

int main() {
    Car* car = new Car(new Engine());
    int speed = car->drive();
    return 0;
}
`;

test('C++ class, member, association and call lines map to their declarations', () => {
  const result = analyzeCppSources({ 'main.cpp': cpp });
  assert.deepEqual(result.errors, []);
  assert.equal(result.classDiagramSources.length, result.classDiagram.split('\n').length);
  assert.equal(result.sequenceDiagramSources.length, result.sequenceDiagram.split('\n').length);
  assert.deepEqual(sourceOf(result, 'class', /^class Car \{/), range('main.cpp', 7, 15));
  assert.deepEqual(sourceOf(result, 'class', /drive\(\)/), range('main.cpp', 17, 20), 'an out-of-class body is the definition');
  assert.deepEqual(sourceOf(result, 'class', /Car\(engine/), range('main.cpp', 11, 12));
  assert.deepEqual(sourceOf(result, 'class', /-speed: int/), range('main.cpp', 9));
  assert.deepEqual(sourceOf(result, 'class', /^Car --> .*Engine/), range('main.cpp', 8));
  assert.deepEqual(sourceOf(result, 'sequence', /-> \w+: start\(\)/), range('main.cpp', 18));
  assert.deepEqual(sourceOf(result, 'sequence', /^Main -> car: drive\(\)/), range('main.cpp', 24));
  assert.deepEqual(sourceOf(result, 'sequence', /^car --> Main: int/), range('main.cpp', 24), 'a reply links to the call it answers');
  assert.deepEqual(sourceOf(result, 'sequence', /^Main --> car: <<create>>/), range('main.cpp', 23));
  assert.deepEqual(sourceOf(result, 'sequence', /^participant car: Car/), range('main.cpp', 7, 15), 'a lifeline links to its class');
  assert.deepEqual(sourceOf(result, 'sequence', /^participant Main /), range('main.cpp', 22, 26), 'Main links to main()');
});

test('C++ inheritance and dependency lines name the class head and the method', () => {
  const header = `struct Receipt {
};

class Shape {
public:
    virtual double area() = 0;
};
`;
  const source = `template <typename T>
class Square
    : public Shape {
public:
    double area() override { return 1.0; }

    void print(Receipt receipt) {
    }
};
`;
  const result = analyzeCppSources({ 'shape.h': header, 'square.cpp': source });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(sourceOf(result, 'class', /^class Square \{/), range('square.cpp', 1, 9), 'a class range includes its template header');
  assert.deepEqual(sourceOf(result, 'class', /^abstract class Shape \{/), range('shape.h', 4, 7));
  assert.deepEqual(sourceOf(result, 'class', /\{abstract\} \+area\(\)/), range('shape.h', 6));
  assert.deepEqual(sourceOf(result, 'class', /^Square --\|> Shape$/), range('square.cpp', 2));
  assert.deepEqual(sourceOf(result, 'class', /^Square \.\.> Receipt$/), range('square.cpp', 7));
});
