'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const context = { window: {}, setInterval() {}, clearInterval() {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../js/uml-auto-describe.js'), 'utf8'), context);
const descriptions = context.window.UMLAutoDescribe;

test('CRC text alternatives preserve each card and its two independent lists', () => {
  const source = `@startuml
caption: A cart asks the catalog for product information.
card "Shopping cart" as Cart {
  // tentative design {}
  # card-shaped comment {}
  responsibility: Know selected products
  responsibility: Calculate the total < tax
  collaborator: Product catalog
}
card Catalog {
}
@enduml`;
  assert.match(descriptions.describe('crc', source), /2 CRC cards.*Shopping cart.*Catalog/);
  const verbose = JSON.parse(JSON.stringify(descriptions.describeVerbose('crc', source)));
  assert.deepEqual(verbose.sections, [
    { heading: 'Shopping cart', items: [
      'Responsibilities: Know selected products; Calculate the total < tax',
      'Collaborators: Product catalog'
    ] },
    { heading: 'Catalog', items: [
      'Responsibilities: none declared',
      'Collaborators: none declared'
    ] }
  ]);
});

test('CRC descriptions ignore layout metadata and preserve escaped display names', () => {
  const source = `@startuml
layout horizontal
card "The \\"cart\\"" as "Shopping cart" @pos(20, 30) {
  responsibility: Know a } character
  collaborator: Catalog: pricing
}
@layout
node Cart 50 80
@endlayout
@enduml`;
  const verbose = descriptions.describeVerbose('crc', source);
  assert.equal(verbose.sections[0].heading, 'The "cart"');
  assert.equal(verbose.sections[0].items[0], 'Responsibilities: Know a } character');
  assert.equal(verbose.sections[0].items[1], 'Collaborators: Catalog: pricing');
  assert.doesNotMatch(verbose.summary, /node|@pos|horizontal/);
});

test('an empty CRC model has an explicit text alternative', () => {
  assert.match(descriptions.describe('crc', '@startuml\n@enduml'), /0 CRC cards/);
  assert.equal(descriptions.describeVerbose('crc', '').sections.length, 0);
});
