'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
require('../../js/uml-analyzer-python.js');
const { analyzeJavaSources } = require('../../js/uml-analyzer-java.js');
const { analyzeCppSources } = require('../../js/uml-analyzer-cpp.js');

const examples = [
  {
    language: 'Python',
    analyze: global.analyzePythonSources,
    sources: { 'example.py': `
class Sensor:
    def calibrate(self) -> None:
        pass

    def read(self) -> int:
        self.calibrate()
        return 25

indoor = Sensor()
outdoor = Sensor()
outside = outdoor.read()
inside = indoor.read()
` }
  },
  {
    language: 'Java',
    analyze: analyzeJavaSources,
    sources: { 'App.java': `
class Sensor {
    void calibrate() { }
    int read() {
        this.calibrate();
        return 25;
    }
}
class App {
    public static void main(String[] args) {
        Sensor indoor = new Sensor();
        Sensor outdoor = new Sensor();
        int outside = outdoor.read();
        int inside = indoor.read();
    }
}
` }
  },
  {
    language: 'C++',
    analyze: analyzeCppSources,
    sources: { 'example.cpp': `
class Sensor {
public:
    void calibrate() { }
    int read() {
        this->calibrate();
        return 25;
    }
};
int main() {
    Sensor indoor;
    Sensor outdoor;
    int outside = outdoor.read();
    int inside = indoor.read();
}
` }
  }
];

for (const { language, analyze, sources } of examples) {
  test(`${language}: calls, self-calls and replies follow the named instance, not the first of its class`, () => {
    const { sequenceDiagram, errors } = analyze(sources);
    assert.deepEqual(errors, []);
    const calls = sequenceDiagram.split('\n').filter(line => line.includes(' -> '));
    assert.deepEqual(calls, [
      'Main -> outdoor: read()',
      'outdoor -> outdoor: calibrate()',
      'Main -> indoor: read()',
      'indoor -> indoor: calibrate()'
    ]);
    assert.match(sequenceDiagram, /^participant indoor: Sensor$/m);
    assert.match(sequenceDiagram, /^participant outdoor: Sensor$/m);
    assert.match(sequenceDiagram, /^outdoor --> Main:/m);
    assert.match(sequenceDiagram, /^indoor --> Main:/m);
  });
}

test('Java: reference copies keep object identity when another variable is rebound', () => {
  const { sequenceDiagram, errors } = analyzeJavaSources({ 'App.java': `
class Sensor {
    int read() { return 25; }
}
class App {
    public static void main(String[] args) {
        Sensor indoor = new Sensor();
        Sensor outdoor = new Sensor();
        Sensor selected = outdoor;
        Sensor original = selected;
        selected = indoor;
        original.read();
        selected.read();
    }
}
` });
  assert.deepEqual(errors, []);
  assert.deepEqual(sequenceDiagram.split('\n').filter(line => line.includes(' -> ')), [
    'Main -> outdoor: read()', 'Main -> indoor: read()'
  ]);
  assert.equal((sequenceDiagram.match(/^participant .*: Sensor$/gm) || []).length, 2);
  assert.equal((sequenceDiagram.match(/^create /gm) || []).length, 2);
});

test('Java: a method-local alias cannot change the caller\'s reference', () => {
  const { sequenceDiagram, errors } = analyzeJavaSources({ 'App.java': `
class Sensor {
    int read() { return 25; }
    void inspect() {
        Sensor local = new Sensor();
        Sensor selected = local;
        selected.read();
    }
}
class App {
    public static void main(String[] args) {
        Sensor indoor = new Sensor();
        Sensor outdoor = new Sensor();
        Sensor selected = outdoor;
        indoor.inspect();
        selected.read();
    }
}
` });
  assert.deepEqual(errors, []);
  assert.deepEqual(sequenceDiagram.split('\n').filter(line => line.includes(' -> ')), [
    'Main -> indoor: inspect()', 'indoor -> local: read()', 'Main -> outdoor: read()'
  ]);
});
