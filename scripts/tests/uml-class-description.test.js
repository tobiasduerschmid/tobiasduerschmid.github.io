'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const context = { window: {}, setInterval() {}, clearInterval() {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../js/uml-auto-describe.js'), 'utf8'), context);
const descriptions = context.window.UMLAutoDescribe;

const renderer = {
  document: { readyState: 'loading', addEventListener() {}, documentElement: {} },
  MutationObserver: class { observe() {} },
};
renderer.window = renderer;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../js/ArchUML/uml-bundle.js'), 'utf8'), renderer);


for (const multiplicity of ['*', '0..*']) {
  test(`class text alternatives explain that ${multiplicity} permits zero without inventing a reverse bound`, () => {
    const source = `class Team {}\nclass Member {}\nTeam --> "${multiplicity}" Member`;
    const summary = descriptions.describe('class', source);
    const verbose = descriptions.describeVerbose('class', source);
    const relationships = verbose.sections.find(section => section.heading === 'Relationships').items.join('; ');
    for (const text of [summary, relationships]) {
      assert.match(text, /Team references Member with multiplicity unspecified to zero or more/);
      assert.doesNotMatch(text, /one to/);
    }
  });
}

test('class text alternatives preserve an explicit nonempty lower bound', () => {
  const source = 'class Team {}\nclass Member {}\nTeam "1" --> "1..*" Member';
  assert.match(descriptions.describe('class', source), /multiplicity one to one or more/);
});

// These are the public class renderer's supported diamond/navigation spellings.
// The text alternative must preserve the same ownership end and endpoint bounds.
const ownershipArrows = [
  ['*-->', 'composes', false, ['navigable from Whole to Part']],
  ['o-->', 'aggregates', false, ['navigable from Whole to Part']],
  ['*<-->', 'composes', false, ['navigable in both directions']],
  ['o<-->', 'aggregates', false, ['navigable in both directions']],
  ['*--x', 'composes', false, ['not navigable from Whole to Part']],
  ['o--x', 'aggregates', false, ['not navigable from Whole to Part']],
  ['*x-->', 'composes', false, ['not navigable from Part to Whole', 'navigable from Whole to Part']],
  ['ox-->', 'aggregates', false, ['not navigable from Part to Whole', 'navigable from Whole to Part']],
  ['*<--x', 'composes', false, ['navigable from Part to Whole', 'not navigable from Whole to Part']],
  ['o<--x', 'aggregates', false, ['navigable from Part to Whole', 'not navigable from Whole to Part']],
  ['<-->*', 'composes', true, ['navigable in both directions']],
  ['<-->o', 'aggregates', true, ['navigable in both directions']],
  ['<--*', 'composes', true, ['navigable from Whole to Part']],
  ['<--o', 'aggregates', true, ['navigable from Whole to Part']],
  ['x--*', 'composes', true, ['not navigable from Whole to Part']],
  ['x--o', 'aggregates', true, ['not navigable from Whole to Part']],
  ['--*', 'composes', true, []],
  ['--o', 'aggregates', true, []],
  ['*<-->x', 'composes', false, ['not navigable from Whole to Part']],
];

function alternativeTexts(source) {
  const verbose = descriptions.describeVerbose('class', source);
  const section = verbose.sections.find(item => item.heading === 'Relationships');
  assert.ok(section, 'the detailed alternative must retain relationships');
  return [descriptions.describe('class', source), section.items.join('; ')];
}

for (const [arrow, verb, reverse, navigation] of ownershipArrows) {
  test(`class alternatives preserve ${arrow} ownership, direction, role and endpoint multiplicities`, () => {
    const relationship = reverse
      ? `Part "0..*" ${arrow} "1" Whole : retained`
      : `Whole "1" ${arrow} "0..*" Part : retained`;
    const source = `class Whole\nclass Part\n${relationship}`;
    const rendered = renderer.UMLClassDiagram.parse(source).relationships;
    assert.equal(rendered.length, 1, 'the fixture must be supported by the actual renderer');
    assert.equal(rendered[0].from, 'Whole');
    assert.equal(rendered[0].to, 'Part');
    assert.equal(rendered[0].fromMult, '1');
    assert.equal(rendered[0].toMult, '0..*');
    assert.equal(rendered[0].type, verb === 'composes' ? 'composition' : 'aggregation');
    for (const text of alternativeTexts(source)) {
      assert.ok(text.includes(`Whole ${verb} Part with multiplicity one to zero or more labeled "retained"`), text);
      for (const direction of navigation) assert.ok(text.includes('; ' + direction), text);
    }
  });
}

for (const [arrow, directions] of [
  ['x-->', ['not navigable from Right to Left', 'navigable from Left to Right']],
  ['<--x', ['navigable from Right to Left', 'not navigable from Left to Right']],
  ['x--x', ['not navigable in either direction']],
]) {
  test(`class alternatives preserve both navigation markers on ${arrow}`, () => {
    for (const text of alternativeTexts(`class Left\nclass Right\nLeft "0..1" ${arrow} "*" Right : collaborators`)) {
      assert.ok(text.includes('with multiplicity zero or one to zero or more labeled "collaborators"'), text);
      for (const direction of directions) assert.ok(text.includes('; ' + direction), text);
    }
  });
}

test('reverse references describe multiplicities in the direction of the reference', () => {
  for (const text of alternativeTexts('class Part\nclass Whole\nPart "*" <-- "1" Whole : items')) {
    assert.match(text, /Whole references Part with multiplicity one to zero or more labeled "items"/);
  }
});
