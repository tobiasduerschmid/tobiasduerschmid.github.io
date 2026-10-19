'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const yaml = require('js-yaml');
require('../../js/uml-analyzer-python.js');
require('../../js/uml-analyzer-js.js');
const { analyzeJavaSources } = require('../../js/uml-analyzer-java.js');
const { analyzeCppSources } = require('../../js/uml-analyzer-cpp.js');
const read = file => fs.readFileSync(path.join(__dirname, '../..', file), 'utf8');
const compiler = vm.createContext({ console, define(_name, _deps, factory) { factory(() => {}); } });
vm.runInContext(read('js/vendor/monaco-editor/0.44.0/min/vs/language/typescript/tsWorker.js'), compiler);

const chapter = read('SEBook/uml_class_diagram.md').replace(/^> ?/gm, '');
const ownership = chapter.slice(chapter.indexOf('### Example 4:'), chapter.indexOf('## Putting It All Together'));
const sources = [...ownership.matchAll(/```(\w+)\n([\s\S]*?)```/g)];
const targets = [...ownership.matchAll(/@startuml\b([\s\S]*?)@enduml/g)];

function roles(diagram, owner) {
  return diagram.split('\n').map(line => line.trim())
    .filter(line => line.startsWith(owner + ' ') && / : /.test(line))
    .map(line => {
      const match = line.match(/^[\w]+\s+(?:"[^"]+"\s+)?([*o.<>|-]+)\s+(?:"([^"]+)"\s+)?([\w]+)\s+: (.+)$/);
      assert.ok(match, `Relationship must remain readable: ${line}`);
      const [, arrow, multiplicity, target, role] = match;
      return {
        kind: arrow.includes('*') ? 'composition' : arrow.includes('o') ? 'aggregation' : 'association',
        multiplicity, target: target.replace(/^MotherBoard__/, '').replace(/^_/, ''),
        role: role.replace(/_/g, '').toLowerCase(),
      };
    }).sort((a, b) => a.role.localeCompare(b.role));
}

const analyzers = {
  java: code => analyzeJavaSources({ 'MotherBoard.java': code }),
  cpp: code => analyzeCppSources({ 'motherboard.cpp': code }),
  python: code => global.analyzePythonSources({ 'motherboard.py': code }),
  typescript: code => global.analyzeJSSources({ 'motherboard.ts': code }, compiler.ts),
};

for (const [language, analyze] of Object.entries(analyzers)) {
  test(`${language}: the chapter's two bus roles agree with the inferred model`, () => {
    const code = sources.find(match => match[1] === language)[2];
    const result = analyze(code);
    assert.deepEqual(result.errors, []);
    const expected = roles(targets[0][1], 'MotherBoard');
    assert.equal(expected.length, 2, 'The chapter must distinguish primary and secondary buses');
    assert.deepEqual(roles(result.classDiagram, 'MotherBoard'), expected);
  });
}

test('the chapter array example preserves separate roles without claiming ten owned employees', () => {
  const code = sources.find(match => match[2].includes('class Division'))[2];
  const result = analyzeJavaSources({ 'Division.java': code });
  assert.deepEqual(result.errors, []);
  const expected = roles(targets[1][1], 'Division');
  assert.equal(expected.length, 2);
  assert.deepEqual(roles(result.classDiagram, 'Division'), expected);
  assert.deepEqual(expected.find(edge => edge.role === 'employees'), {
    kind: 'association', multiplicity: '*', target: 'Employee', role: 'employees',
  });
});

const tutorial = yaml.load(read('_data/tutorials/uml-sequence-diagram-python.yml'));
function interaction(diagram) {
  return diagram.split('\n').map(line => line.trim()).flatMap(line => {
    if (/^(?:alt |opt |loop |else\b|end$)/.test(line)) return [line];
    const call = line.match(/^(\w+) -> (\w+): ([\w]+)\(/);
    // Arguments are checked by the executable tutorial graders; long display
    // labels may be abbreviated differently without changing the interaction.
    return call ? [{ from: call[1], to: call[2], method: call[3] }] : [];
  });
}

for (const key of ['first-sequence', 'return-values', 'self-calls',
  'conditional-fragments', 'loops', 'moderated-broadcast']) {
  test(`sequence tutorial ${key}: solution calls retain the target's order and nesting`, () => {
    const step = tutorial.steps.find(step => step.key === key);
    const target = [...step.instructions.matchAll(/@startuml\b([\s\S]*?)@enduml/g)].at(-1)[1];
    const result = global.analyzePythonSources(Object.fromEntries(
      step.solution.files.filter(file => file.path.endsWith('.py')).map(file => [file.path, file.content])));
    assert.deepEqual(result.errors, []);
    assert.deepEqual(interaction(result.sequenceDiagram), interaction(target));
  });
}
