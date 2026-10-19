'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { analyzeJavaSources } = require('../../js/uml-analyzer-java.js');
const { analyzeCppSources } = require('../../js/uml-analyzer-cpp.js');
require('../../js/uml-analyzer-python.js');
require('../../js/uml-analyzer-js.js');
const compiler = require('../../js/vendor/typescript/5.9.3/typescript.min.js');

const suppliedReferences = [
  {
    language: 'Python', analyze: global.analyzePythonSources, path: 'model.py',
    code: 'class Part:\n    pass\nclass Whole:\n    def __init__(self, part: Part):\n        self.part: Part = part\n',
    multiplicity: '1',
  },
  {
    language: 'Java', analyze: analyzeJavaSources, path: 'Model.java',
    code: 'class Part {} class Whole { Part part; Whole(Part part) { this.part = part; } }',
    multiplicity: '0..1',
  },
  {
    language: 'TypeScript', analyze: sources => global.analyzeJSSources(sources, compiler), path: 'model.ts',
    code: 'class Part {} class Whole { constructor(public part: Part) {} }',
    multiplicity: '1',
  },
  {
    language: 'C++', analyze: analyzeCppSources, path: 'model.cpp',
    code: 'struct Part {}; struct Whole { Part* part; Whole(Part* supplied): part(supplied) {} };',
    multiplicity: '0..1',
  },
];

for (const example of suppliedReferences) {
  test(`${example.language}: retaining a supplied object makes no whole-part or inverse bound claim`, () => {
    const result = example.analyze({ [example.path]: example.code });
    assert.deepEqual(result.errors, []);
    const relationship = result.classDiagram.split('\n').filter(line => /^Whole .* Part$/.test(line));
    assert.deepEqual(relationship, [`Whole --> "${example.multiplicity}" Part`]);
  });
}

for (const initializer of ['', ' = null', ' = new Part()']) {
  test(`Java reference ${initializer || 'without initializer'} does not prove a non-null invariant`, () => {
    const result = analyzeJavaSources({ 'Model.java': `class Part {} class Whole { Part part${initializer}; }` });
    assert.deepEqual(result.errors, []);
    assert.match(result.classDiagram, /^Whole --> "0\.\.1" Part$/m);
  });
}

for (const extension of ['js', 'ts']) {
  test(`${extension}: allocation without a field annotation leaves multiplicity unspecified`, () => {
    const result = global.analyzeJSSources({ [`model.${extension}`]:
      'class Part {} class Whole { part = new Part(); }' }, compiler);
    assert.deepEqual(result.errors, []);
    assert.match(result.classDiagram, /^Whole --> Part$/m);
    assert.doesNotMatch(result.classDiagram, /[o*]--/);
  });
}

test('C++ exclusive typed storage retains composition without claiming every part has an owner', () => {
  const result = analyzeCppSources({ 'model.cpp': `
    struct Part {};
    struct Whole { std::unique_ptr<Part> part; };
  ` });
  assert.deepEqual(result.errors, []);
  assert.match(result.classDiagram, /^Whole \*-- "0\.\.1" Part$/m);
});

test('C++ raw new does not establish exclusive ownership or cleanup', () => {
  const result = analyzeCppSources({ 'model.cpp': 'struct Part {}; struct Whole { Part* part = new Part(); };' });
  assert.deepEqual(result.errors, []);
  assert.match(result.classDiagram, /^Whole --> "0\.\.1" Part$/m);
});

for (const name of ['vector', 'unique_ptr']) {
  test(`C++ a supplied domain type named ${name} is not treated as a standard wrapper`, () => {
    const result = analyzeCppSources({ 'model.cpp': `
      struct Part {};
      namespace domain { template<typename T> struct ${name} {}; }
      struct Whole { domain::${name}<Part> value; };
    ` });
    assert.deepEqual(result.errors, []);
    assert.match(result.classDiagram, new RegExp(`^Whole \\*-- "1" domain__${name}$`, 'm'));
    assert.doesNotMatch(result.classDiagram, /^Whole .* Part$/m);
  });
}
