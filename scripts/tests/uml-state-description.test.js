'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const context = { window: {}, setInterval() {}, clearInterval() {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../js/uml-auto-describe.js'), 'utf8'), context);
const descriptions = context.window.UMLAutoDescribe;

const delivery = `@startuml
layout horizontal
[*] --> Delivering
state Delivering {
  [*] --> Driving
  Driving --> Waiting : arrived
  Waiting --> Unlocked : enterPin(code) [pin matches]
  Unlocked : exit / lockLid()
}
Waiting : entry / notifyCustomer()
Waiting : enterPin(code) [pin wrong] / beep()
Delivering --> Returning : when(battery < 15%)
state Unlocked #fff0ac hatched
@enduml`;

test('state text alternatives announce composite states and the states inside them', () => {
  const summary = descriptions.describe('state', delivery);
  assert.match(summary, /Delivering is a composite state containing Driving, Waiting, Unlocked/);
  assert.match(summary, /the initial pseudostate of Delivering transitions to Driving/);
  assert.match(summary, /Delivering transitions to Returning on when\(battery < 15%\)/);
  const states = JSON.stringify(descriptions.describeVerbose('state', delivery).sections);
  assert.match(states, /Unlocked \(inside Delivering\)/);
  assert.doesNotMatch(states, /#fff0ac|hatched/);
});

test('state text alternatives list entry, exit, and do behaviors and internal transitions', () => {
  const summary = descriptions.describe('state', delivery);
  assert.match(summary, /Waiting lists entry \/ notifyCustomer\(\); internal transition enterPin\(code\) \[pin wrong\] \/ beep\(\)/);
  assert.match(summary, /Unlocked lists exit \/ lockLid\(\)/);
  const block = descriptions.describe('state', 'state Returning {\n  do / driveToBase()\n}\nReturning --> [*]');
  assert.match(block, /Returning lists do \/ driveToBase\(\)/);
  assert.match(block, /Returning transitions to the final state/);
});

test('authored positions and layout blocks stay out of state text alternatives', () => {
  const source = 'state Driving @pos(60, 40)\nstate Waiting @pos(240, 40)\n[*] --> Driving\n@layout schema=1 renderer="archuml-visual-editor"\nnode "__initial__0" x=0 y=56\n@endlayout';
  const summary = descriptions.describe('state', source);
  assert.match(summary, /2 states \(Driving, Waiting\)/);
  assert.doesNotMatch(summary, /@pos|node|__initial__/);
});

test('a description row without a slash is not announced as a behavior', () => {
  const summary = descriptions.describe('state', 'Red --> Green : test fails\nRed : write a tiny failing test');
  assert.doesNotMatch(summary, /lists|internal transition/);
});
