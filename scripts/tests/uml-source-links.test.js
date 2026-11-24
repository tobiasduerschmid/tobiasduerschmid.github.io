'use strict';

// The diagram viewers render a syntax that can differ from the analyzed one
// by layout directives; source links must still name the right lines.

const assert = require('node:assert/strict');
const test = require('node:test');
const { alignSources, describe } = require('../../js/uml-source-links.js');

const car = { file: 'car.py', startLine: 5, endLine: 11 };
const drive = { file: 'car.py', startLine: 10, endLine: 11 };
const engine = { file: 'car.py', startLine: 7, endLine: 7 };

test('sources follow their lines when layout directives are replaced', () => {
  const analyzed = ['@startuml', 'layout landscape', 'layout compact', 'class Car {', '  +drive()', '}', 'Car --> Engine', '@enduml'];
  const rendered = ['@startuml', 'layout portrait', 'class Car {', '  +drive()', '}', 'Car --> Engine', '@enduml'];
  const aligned = alignSources(analyzed.join('\n'), [null, null, null, car, drive, null, engine, null], rendered.join('\n'));
  assert.deepEqual(aligned, [null, null, car, drive, null, engine, null]);
});

test('class lines describe a class, its members and each relationship kind', () => {
  const syntax = ['class Car {', '  +drive()', '}', 'Car --|> Vehicle', 'Car ..|> Drivable', 'Car ..> Receipt', 'Car --> "1" Engine'].join('\n');
  const at = line => ({ file: 'car.py', startLine: line, endLine: line });
  const labels = describe('class', syntax, [at(1), at(2), null, at(4), at(5), at(6), at(7)]).map(entry => entry.label);
  assert.deepEqual(labels, ['Class Car', 'Car member +drive()', 'Car inherits from Vehicle',
    'Car realizes Drivable', 'Car depends on Receipt', 'Car is associated with Engine']);
});

test('sequence lines describe lifelines, calls, replies and creations; lines without a source are skipped', () => {
  const syntax = ['participant Main as : Main', 'participant car: Car', 'activate Main',
    'Main --> car: <<create>>', 'Main -> car: drive()', 'car --> Main: int', 'Main -> car: stop()'].join('\n');
  const at = line => ({ file: 'car.py', startLine: line, endLine: line });
  const entries = describe('sequence', syntax, [at(9), at(1), null, at(10), at(11), at(11), null]);
  assert.deepEqual(entries.map(entry => entry.label), ['Lifeline : Main', 'Lifeline car: Car', 'Main creates car',
    'Call Main to car: drive()', 'Reply car to Main: int']);
  assert.deepEqual(entries.filter(entry => entry.kind === 'participant').map(entry => entry.participant), [0, 1]);
});
