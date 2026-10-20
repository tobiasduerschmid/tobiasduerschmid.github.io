'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');
require('../../js/uml-analyzer-python.js');

function targetDiagram(instructions) {
  const diagrams = [...instructions.matchAll(/<div\b([^>]*?)data-uml-spec=(["'])(@startuml[\s\S]*?@enduml)\s*\2/g)];
  const target = diagrams.find(match => match[1].includes('inferred-target')) || diagrams.at(-1);
  assert.ok(target, 'The exercise must publish a target diagram');
  return target[3].replaceAll('&quot;', '"');
}

function classMembers(diagram) {
  return Object.fromEntries([...diagram.matchAll(/\bclass\s+(\w+)\s*\{([\s\S]*?)^\s*\}/gm)]
    .map(([, name, body]) => [name, body.split('\n').map(line => line.trim()).filter(Boolean)
      .map(line => line.replace(/\s+/g, '').replace(/^([+#-])(\{abstract\})/, '$2$1')).sort()]));
}

function interactions(diagram) {
  return diagram.split('\n').map(line => line.trim())
    .filter(line => /^\w+\s+-+>|^(?:alt|opt|loop|else|end)\b/.test(line));
}

for (const kind of ['class', 'sequence']) {
  const tutorial = yaml.load(fs.readFileSync(path.join(__dirname,
    `../../_data/tutorials/uml-${kind}-diagram-python.yml`), 'utf8'));
  for (const step of tutorial.steps.filter(step => step.solution?.files)) {
    test(`${kind} tutorial ${step.key}: target notation matches the implementation view of its solution`, () => {
      const source = Object.fromEntries(step.solution.files.map(file => [file.path, file.content]));
      const result = global.analyzePythonSources(source, {
        hideVisibility: (step.uml_hide || []).includes('visibility'),
        hideMultiplicity: (step.uml_hide || []).includes('multiplicity'),
      });
      assert.deepEqual(result.errors, []);
      const labels = kind === 'class' ? classMembers : interactions;
      assert.deepEqual(labels(targetDiagram(step.instructions)), labels(result[kind + 'Diagram']),
        'Target labels must use the same source names, types, and expressions as Implementation details');
    });
  }
}
