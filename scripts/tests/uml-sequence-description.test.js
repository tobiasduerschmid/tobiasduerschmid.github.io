'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const context = { window: {}, setInterval() {}, clearInterval() {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../js/uml-auto-describe.js'), 'utf8'), context);
const descriptions = context.window.UMLAutoDescribe;

test('found messages describe an external sender without adding a fictitious participant', () => {
  const source = 'participant rover: navigate\no-> rover: navigate(commands)';
  const summary = descriptions.describe('sequence', source);
  const verbose = descriptions.describeVerbose('sequence', source);
  const messages = verbose.sections.find(section => section.heading === 'Messages').items.join('; ');
  for (const text of [summary, messages]) {
    assert.match(text, /found message from outside the diagram to rover with "navigate\(commands\)"/i);
    assert.doesNotMatch(text, /o calls/);
  }
  assert.match(summary, /1 participant/);
  assert.deepEqual(Array.from(verbose.sections.find(section => section.heading === 'Participants').items), ['navigate']);
});

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

function messageTexts(source) {
  const summary = descriptions.describe('sequence', source);
  const verbose = descriptions.describeVerbose('sequence', source);
  const messages = verbose.sections.find(section => section.heading === 'Messages').items.join('; ');
  const participants = Array.from(verbose.sections.find(section => section.heading === 'Participants').items);
  return { summary, messages, participants };
}

test('messages to a selector lifeline such as sensor[i] stay in both text alternatives', () => {
  const { summary, messages, participants } = messageTexts(
    'participant hub: AlarmHub\nparticipant sensor[i]: WindowSensor\nloop [for each window]\nhub -> sensor[i]: getStatus()\nsensor[i] --> hub: status\nend');
  for (const text of [summary, messages]) {
    assert.match(text, /hub calls sensor\[i\] with "getStatus\(\)"/);
    assert.match(text, /sensor\[i\] replies to hub with "status"/);
  }
  assert.match(summary, /2 participants/);
  assert.deepEqual(participants, ['AlarmHub', 'WindowSensor']);
});

test('anonymous lifelines are named by their type, and a highlight line adds no lifeline', () => {
  const { summary, participants } = messageTexts(
    'participant dog: Dog\nparticipant following as : Following\ndog -> following: throwBall(dog)\nparticipant following #fff0ac hatched');
  assert.match(summary, /2 participants \(Dog, Following\)/);
  assert.deepEqual(participants, ['Dog', 'Following']);
});

test('a lost message names its sender and no fictitious receiver', () => {
  const { summary, messages, participants } = messageTexts(
    'participant sender: Sender\nparticipant receiver: Receiver\nsender ->> receiver: Datagram [3]\nsender ->o : Datagram [4]');
  for (const text of [summary, messages]) {
    assert.match(text, /lost message from sender with "Datagram \[4\]", which never reaches a receiver/);
    assert.doesNotMatch(text, /calls o\b/);
  }
  assert.deepEqual(participants, ['Sender', 'Receiver']);
});

test('a guillemet creation message with arguments is described as creation, not a reply', () => {
  const { summary, messages } = messageTexts(
    'participant main as : Main\nparticipant bars: BarChartView\ncreate bars\nmain --> bars: «create»(dataset)');
  for (const text of [summary, messages]) {
    assert.match(text, /main creates bars with "\(dataset\)"/);
    assert.doesNotMatch(text, /replies to/);
  }
});

test('implicit lifelines are counted once across repeated calls and later declarations', () => {
  const source = 'Main -> service: start()\nservice -> service: finish()\nparticipant service: Service';
  const summary = descriptions.describe('sequence', source);
  const verbose = descriptions.describeVerbose('sequence', source);
  assert.match(summary, /2 participants/);
  assert.match(summary, /service calls service with "finish\(\)"/);
  const participants = verbose.sections.find(section => section.heading === 'Participants').items;
  assert.deepEqual(Array.from(participants).sort(), ['Main', 'Service']);
});

test('separate optional frames with equal guards stay distinct in text alternatives', () => {
  const source = `opt [accepted]
checkout -> payment: approve()
checkout -> payment: record()
end
opt [accepted]
checkout -> payment: decline()
end`;
  const summary = descriptions.describe('sequence', source);
  const verbose = descriptions.describeVerbose('sequence', source);
  const messages = verbose.sections.find(section => section.heading === 'Messages').items.join('; ');
  for (const text of [summary, messages]) {
    assert.equal((text.match(/in optional fragment \[accepted\]/g) || []).length, 2);
    assert.match(text, /optional fragment \[accepted\], checkout calls payment with "approve\(\)"/);
    assert.match(text, /optional fragment \[accepted\], checkout calls payment with "decline\(\)"/);
  }
  const fragments = verbose.sections.find(section => section.heading === 'Combined fragments').items;
  assert.equal(fragments.length, 2);
});

test('inference warnings remain in both accessible descriptions of an exported diagram', () => {
  const Diagnostics = require('../../js/uml-sequence-diagnostics.js');
  const diagnostics = new Diagnostics();
  diagnostics.add('recursion', 'Payment.authorize');
  const source = diagnostics.result('participant Main as : Main\nMain -> Main: authorize()').sequenceDiagram;
  const summary = descriptions.describe('sequence', source);
  const verbose = descriptions.describeVerbose('sequence', source);
  assert.match(summary, /Recursive call detected/);
  assert.match(verbose.summary, /Recursive call detected/);
  assert.match(verbose.sections.find(section => section.heading === 'Inference warnings').items.join(' '), /Later calls and returns may be unreachable/);
});
