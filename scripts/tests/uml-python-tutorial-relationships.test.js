'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');
require('../../js/uml-analyzer-python.js');

const tutorial = yaml.load(fs.readFileSync(path.join(__dirname,
  '../../_data/tutorials/uml-class-diagram-python.yml'), 'utf8'));

// Compare the relationships students see, independently of class members,
// formatting, declaration order, or which equivalent arrow direction is used.
function relationships(diagram) {
  const arrowKinds = {
    '--|>': 'inheritance', '<|--': 'inheritance',
    '*-->': 'composition', '<--*': 'composition',
    'o-->': 'aggregation', '<--o': 'aggregation',
    '-->': 'association', '<--': 'association',
    '..>': 'dependency', '<..': 'dependency',
  };
  const result = [];
  for (const line of diagram.split('\n')) {
    const match = line.trim().match(/^(\w+)\s+(?:"([^"]+)"\s+)?([.*o<|>x-]{2,})\s+(?:"([^"]+)"\s+)?(\w+)\s*(?::.*)?$/);
    if (!match) continue;
    const [, left, leftMultiplicity, arrow, rightMultiplicity, right] = match;
    assert.ok(arrowKinds[arrow], `Unsupported relationship notation: ${line}`);
    const reversed = arrow.startsWith('<');
    const normalize = value => value === '0..*' ? '*' : (value || null);
    result.push({
      source: reversed ? right : left,
      target: reversed ? left : right,
      kind: arrowKinds[arrow],
      sourceMultiplicity: normalize(reversed ? rightMultiplicity : leftMultiplicity),
      targetMultiplicity: normalize(reversed ? leftMultiplicity : rightMultiplicity),
    });
  }
  return result.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

function infer(sources, options) {
  const result = global.analyzePythonSources(sources, options);
  assert.deepEqual(result.errors, [], 'Published Python examples must be analyzable');
  return relationships(result.classDiagram);
}

for (const key of ['first-class', 'visibility', 'types', 'inheritance', 'association',
  'ownership', 'multiplicity', 'abstract-classes', 'store-capstone']) {
  test(`class tutorial ${key}: solution relationships match the visible target`, () => {
    const step = tutorial.steps.find(candidate => candidate.key === key);
    assert.ok(step, `Missing class tutorial lesson: ${key}`);
    const inferredTarget = step.instructions.match(/data-uml-role="inferred-target"[^>]*?@startuml\b([\s\S]*?)@enduml/);
    const target = inferredTarget || step.instructions.match(/@startuml\b([\s\S]*?)@enduml/);
    assert.ok(target, 'The exercise must publish its target diagram');
    const expected = relationships(target[1]);
    const sources = Object.fromEntries(step.solution.files.map(file => [file.path, file.content]));

    const actual = infer(sources, {
      hideMultiplicity: (step.uml_hide || []).includes('multiplicity'),
    });

    assert.deepEqual(actual, expected,
      'Relationship kind, direction, and visible multiplicities must agree with the target');
  });
}

// Storing either supplied or newly constructed objects establishes associations.
// Ownership requires lifecycle evidence beyond these Python storage patterns.
const cases = [
  {
    name: 'a retained typed parameter gives a scalar association',
    body: `    def __init__(self, part: Part):
        self.part: Part = part`,
    kind: 'association', multiplicity: '1',
  },
  {
    name: 'a typed parameter appended to a collection gives association',
    body: `    def __init__(self):
        self.parts: list[Part] = []
    def add_part(self, part: Part):
        self.parts.append(part)`,
    kind: 'association', multiplicity: '*',
  },
  {
    name: 'a retained direct constructor gives association',
    body: `    def __init__(self):
        self.part: Part = Part()`,
    kind: 'association', multiplicity: '1',
  },
  {
    name: 'a direct constructor appended to a collection gives association',
    body: `    def __init__(self):
        self.parts: list[Part] = []
        self.parts.append(Part())`,
    kind: 'association', multiplicity: '*',
  },
  {
    name: 'a locally constructed object appended to a collection gives association',
    body: `    def __init__(self):
        self.parts: list[Part] = []
        part = Part()
        self.parts.append(part)`,
    kind: 'association', multiplicity: '*',
  },
  {
    name: 'a collection annotation without insertion gives association',
    body: `    def __init__(self):
        self.parts: list[Part] = []`,
    kind: 'association', multiplicity: '*',
  },
];

for (const example of cases) {
  test(`documented Python inference: ${example.name}`, () => {
    const sources = { 'model.py': `class Part:\n    pass\n\nclass Whole:\n${example.body}\n` };

    assert.deepEqual(infer(sources), [{
      source: 'Whole', target: 'Part', kind: example.kind,
      sourceMultiplicity: null, targetMultiplicity: example.multiplicity,
    }]);
  });
}
