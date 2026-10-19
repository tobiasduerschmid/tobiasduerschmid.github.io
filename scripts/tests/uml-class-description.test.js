'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const context = { window: {}, setInterval() {}, clearInterval() {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../js/uml-auto-describe.js'), 'utf8'), context);
const descriptions = context.window.UMLAutoDescribe;

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
