'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const context = { window: {}, setInterval() {}, clearInterval() {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../js/uml-auto-describe.js'), 'utf8'), context);
const descriptions = context.window.UMLAutoDescribe;

for (const creation of ['Main --> sensor: <<create>>', 'sensor <-- Main: <<create>>']) {
  test(`creation is distinct from a reply in both text alternatives: ${creation}`, () => {
    const source = `participant sensor: Sensor\n${creation}\nMain -> sensor: read()\nsensor --> Main: int`;
    const summary = descriptions.describe('sequence', source);
    const verbose = descriptions.describeVerbose('sequence', source);
    const messages = verbose.sections.find(section => section.heading === 'Messages').items.join('; ');
    for (const text of [summary, messages]) {
      assert.match(text, /Main creates sensor/);
      assert.match(text, /Main calls sensor with "read\(\)"/);
      assert.match(text, /sensor replies to Main with "int"/);
      assert.doesNotMatch(text, /replies to.*create/);
    }
    assert.match(summary, /2 participants/);
    const participants = verbose.sections.find(section => section.heading === 'Participants').items;
    assert.deepEqual(Array.from(participants).sort(), ['Main', 'Sensor']);
  });
}

test('implicit lifelines are counted once across repeated calls and later declarations', () => {
  const source = 'Main -> service: start()\nservice -> service: finish()\nparticipant service: Service';
  const summary = descriptions.describe('sequence', source);
  const verbose = descriptions.describeVerbose('sequence', source);
  assert.match(summary, /2 participants/);
  assert.match(summary, /service calls service with "finish\(\)"/);
  const participants = verbose.sections.find(section => section.heading === 'Participants').items;
  assert.deepEqual(Array.from(participants).sort(), ['Main', 'Service']);
});
