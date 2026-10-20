'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');
const edits = require('../../tests/helpers/uml-lab-edits');
require('../../js/uml-analyzer-python.js');
const { analyzeJavaSources } = require('../../js/uml-analyzer-java.js');
const { analyzeCppSources } = require('../../js/uml-analyzer-cpp.js');
require('../../js/uml-analyzer-js.js');
const compiler = require('../../js/vendor/typescript/5.9.3/typescript.min.js');

const labs = yaml.load(fs.readFileSync(path.join(__dirname, '../../_data/uml_code_labs.yml'), 'utf8'));
const analyzers = {
  python: { analyze: global.analyzePythonSources, filename: 'example.py' },
  java: { analyze: analyzeJavaSources, filename: 'App.java' },
  cpp: { analyze: analyzeCppSources, filename: 'example.cpp' },
  typescript: { analyze: sources => global.analyzeJSSources(sources, compiler), filename: 'example.ts' }
};
const calls = diagram => diagram.split('\n').filter(line => line.includes(' -> '));
const publicOperations = {
  visibility: ['displayName'],
  inheritance: ['speak'],
  dependency: ['keepRoster'],
  message_order: ['capture', 'authorize', 'refund'],
  self_calls: ['validate', 'save', 'submit'],
  message_receivers: ['read'],
  alternatives: ['approve', 'decline', 'pay'],
  loop_boundary: ['addItem', 'finish']
};
const constructorNames = {
  python: { Student: '__init__', Team: '__init__' },
  java: { Student: 'Student', Team: 'Team' },
  cpp: { Student: 'Student', Team: 'Team' },
  typescript: { Student: 'constructor', Team: 'constructor' }
};

for (const [language, { analyze, filename }] of Object.entries(analyzers)) {
  function infer(source) {
    const result = analyze({ [filename]: source });
    assert.deepEqual(result.errors, []);
    return result;
  }
  function example(id) {
    const original = labs[id][language].code;
    const changed = edits[language][id](original);
    assert.notEqual(changed, original, 'The suggested learner edit must apply to the chapter source');
    return { before: infer(original), after: infer(changed), changed };
  }

  for (const [id, operations] of Object.entries(publicOperations)) {
    test(`${language}: ${id} starts with the same public operations as the other language tabs`, () => {
      const diagram = infer(labs[id][language].code).classDiagram;
      for (const operation of operations) {
        const name = language === 'python'
          ? operation.replace(/[A-Z]/g, letter => '_' + letter.toLowerCase()) : operation;
        assert.ok(diagram.includes('+' + name + '('), `${name} must start public`);
      }
    });
  }

  test(`${language}: Students and Teams can be constructed through their public API`, () => {
    for (const [id, className, parameter] of [
      ['visibility', 'Student', 'name'], ['collection_multiplicity', 'Team', 'members']
    ]) {
      const diagram = infer(labs[id][language].code).classDiagram;
      assert.ok(diagram.includes('+' + constructorNames[language][className] + '(' + parameter + ':'),
        `${className} must accept ${parameter} in its public constructor`);
    }
  });

  test(`${language}: hiding the reading method preserves the non-public field`, () => {
    const { before, after } = example('visibility');
    const field = language === 'python' ? /#_name/ : /-name/;
    assert.ok(after.classDiagram.includes('+' + constructorNames[language].Student + '('),
      'Making the reading method non-public must leave construction public');
    assert.match(before.classDiagram, field);
    assert.match(after.classDiagram, field);
    assert.match(before.classDiagram, /\+display_?[Nn]ame\(\)/);
    assert.doesNotMatch(after.classDiagram, /\+display_?[Nn]ame\(\)/);
    assert.match(after.classDiagram, language === 'python' ? /#_display_name\(\)/ : /-displayName\(\)/);
  });

  test(`${language}: changing a direct parent preserves the path to the ancestor`, () => {
    const { before, after } = example('inheritance');
    assert.match(before.classDiagram, /Puppy --\|> Animal/);
    assert.match(after.classDiagram, /Puppy --\|> Dog/);
    assert.match(after.classDiagram, /Dog --\|> Animal/);
    assert.doesNotMatch(after.classDiagram, /Puppy --\|> Animal/);
    assert.match(after.classDiagram, /class Animal \{[^}]*\+speak\(\)/);
  });

  test(`${language}: removing storage and then the parameter removes two different kinds of coupling`, () => {
    const { before, after, changed } = example('dependency');
    assert.match(before.classDiagram, /Student .*-->.* Roster/);
    assert.match(after.classDiagram, /Student \.\.> Roster/);
    const independent = infer(edits[language].removeParameter(changed)).classDiagram;
    assert.match(independent, /class Student/);
    assert.match(independent, /class Roster/);
    assert.doesNotMatch(independent, /^Student .*Roster$/m);
  });

  test(`${language}: a collection type permits an empty team`, () => {
    const { before, after } = example('collection_multiplicity');
    const scalarMultiplicity = language === 'java' ? '0\\.\\.1' : '1';
    assert.match(before.classDiagram, new RegExp(`^Team --> "${scalarMultiplicity}" Member$`, 'm'));
    assert.match(after.classDiagram, /^Team .* "\*" Member$/m);
    assert.doesNotMatch(after.classDiagram, /"1\.\.\*"/);
  });

  test(`${language}: a nested call stays inside its caller when top-level calls are swapped`, () => {
    const { before, after } = example('message_order');
    assert.deepEqual(calls(before.sequenceDiagram), [
      'Main -> payment: authorize()', 'payment -> payment: capture()', 'Main -> payment: refund()'
    ]);
    assert.deepEqual(calls(after.sequenceDiagram), [
      'Main -> payment: refund()', 'Main -> payment: authorize()', 'payment -> payment: capture()'
    ]);
  });

  test(`${language}: nested self-calls complete in reverse order on one object`, () => {
    const { after } = example('self_calls');
    assert.deepEqual(calls(after.sequenceDiagram), [
      'Main -> checkout: submit()', 'checkout -> checkout: save()', 'checkout -> checkout: validate()'
    ]);
    assert.equal((after.sequenceDiagram.match(/^participant .*: Checkout$/gm) || []).length, 1);
    const execution = after.sequenceDiagram.slice(after.sequenceDiagram.indexOf('Main -> checkout: submit()'));
    assert.match(execution, /submit\(\)\nactivate checkout\ncheckout -> checkout: save\(\)\nactivate checkout\ncheckout -> checkout: validate\(\)\nactivate checkout\ndeactivate checkout\ndeactivate checkout\ndeactivate checkout/);
  });

  test(`${language}: changing an alias moves the message without constructing another object`, () => {
    const { before, after } = example('message_receivers');
    assert.deepEqual(calls(before.sequenceDiagram), ['Main -> indoor: read()']);
    assert.deepEqual(calls(after.sequenceDiagram), ['Main -> outdoor: read()']);
    assert.match(after.sequenceDiagram, /outdoor --> Main:/);
    assert.equal((after.sequenceDiagram.match(/^participant .*: Sensor$/gm) || []).length, 2);
    assert.doesNotMatch(after.sequenceDiagram, /^participant selected|^create selected/m);
  });

  test(`${language}: independent guards replace mutual exclusion with two optional calls`, () => {
    const { before, after } = example('alternatives');
    assert.match(before.sequenceDiagram, /alt \[accepted\]/);
    assert.match(before.sequenceDiagram, /^else(?: \[else\])?$/m);
    assert.equal((after.sequenceDiagram.match(/^opt \[accepted\]$/gm) || []).length, 2);
    assert.match(after.sequenceDiagram, /opt \[accepted\][\s\S]*approve\(\)[\s\S]*end\nopt \[accepted\][\s\S]*decline\(\)/);
    assert.doesNotMatch(after.sequenceDiagram, /^alt |^else /m);
  });

  test(`${language}: moving finalization inside the loop makes it conditional on iteration`, () => {
    const { before, after } = example('loop_boundary');
    const itemType = { python: 'str', java: 'String', cpp: 'std::string', typescript: 'string' }[language];
    const parameter = before.classDiagram.match(/add_?[Ii]tem\(item: ([^)]+)\)/)?.[1];
    assert.equal(parameter?.replace(/^const\s+/, '').replace(/&$/, '').trim(), itemType,
      'Receipt items must use the native string type in every language');
    assert.match(before.sequenceDiagram, /\nend\nMain -> receipt: finish\(\)/);
    assert.match(after.sequenceDiagram, /loop \[[^\n]*\][\s\S]*add_?[Ii]tem\(item\)[\s\S]*finish\(\)[\s\S]*\nend\n/);
    assert.doesNotMatch(after.sequenceDiagram, /\nend\nMain -> receipt: finish\(\)/);
  });
}
