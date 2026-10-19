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
const { project } = require('../../js/uml-diagram-views.js');
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

const busEvidence = {
  java: { kind: 'association', multiplicity: '0..1' },
  cpp: { kind: 'composition', multiplicity: '1' },
  python: { kind: 'association', multiplicity: '1' },
  typescript: { kind: 'association', multiplicity: undefined },
};

for (const [language, analyze] of Object.entries(analyzers)) {
  test(`${language}: inference preserves the reference design's bus roles using only source-supported ownership`, () => {
    const code = sources.find(match => match[1] === language)[2];
    const result = analyze(code);
    assert.deepEqual(result.errors, []);
    const reference = roles(targets[0][1], 'MotherBoard');
    assert.equal(reference.length, 2, 'The reference design must distinguish primary and secondary buses');
    assert.ok(reference.every(role => role.kind === 'composition'), 'The stated lifecycle requirement remains composition');
    assert.deepEqual(roles(result.classDiagram, 'MotherBoard'), reference.map(role => ({ ...role, ...busEvidence[language] })));
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

test('the Java enrollment target and solution permit a student to belong to several courses', () => {
  const tutorial = yaml.load(read('_data/tutorials/java.yml'));
  const step = tutorial.steps.find(step => step.title === 'Design Challenge: Course Enrollment');
  const target = step.instructions.match(/@startuml\b([\s\S]*?)@enduml/)[1];
  const sources = Object.fromEntries([...step.files, ...step.solution.files].map(file => [file.path, file.content]));
  const result = analyzeJavaSources(sources);
  assert.deepEqual(result.errors, []);

  for (const [name, diagram] of [['published target', target], ['inferred solution', result.classDiagram]]) {
    const relation = diagram.match(/^\s*Course\s+(?:"([^"]+)"\s+)?-->\s+"([^"]+)"\s+Student\s*$/m);
    assert.ok(relation, `${name} must retain the Course-to-Student association`);
    assert.equal(relation[1], undefined, `${name} must not infer a course count per student`);
    assert.equal(relation[2], '*', `${name} must allow zero or more students per course`);
  }
});

const tutorial = yaml.load(read('_data/tutorials/uml-sequence-diagram-python.yml'));
function interaction(diagram) {
  return diagram.split('\n').map(line => line.trim()).flatMap(line => {
    if (/^(?:alt |opt |loop |else\b|end$)/.test(line)) return [line];
    const reply = line.match(/^(\w+) --> (\w+): (\w+): (.+)$/);
    if (reply) return [{ from: reply[1], to: reply[2], result: reply[3], type: reply[4] }];
    const call = line.match(/^(\w+) -> (\w+): (.+)$/);
    return call ? [{ from: call[1], to: call[2], call: call[3] }] : [];
  });
}

for (const key of ['first-sequence', 'return-values', 'self-calls',
  'conditional-fragments', 'loops', 'moderated-broadcast']) {
  test(`sequence tutorial ${key}: Design view matches complete target calls, reply types, and nesting`, () => {
    const step = tutorial.steps.find(step => step.key === key);
    const target = [...step.instructions.matchAll(/@startuml\b([\s\S]*?)@enduml/g)].at(-1)[1]
      .replace(/&quot;/g, '"');
    const result = global.analyzePythonSources(Object.fromEntries(
      step.solution.files.filter(file => file.path.endsWith('.py')).map(file => [file.path, file.content])));
    assert.deepEqual(result.errors, []);
    const design = project(result, { language: 'python', view: 'design' });
    assert.deepEqual(interaction(design.sequenceDiagram), interaction(target));
  });
}

for (const [key, signature] of [
  ['loops', 'broadcast_all(channel: Channel, messages: Sequence<String>)'],
  ['moderated-broadcast', 'run_digest(channel: Channel, posts: Sequence<String>)'],
]) {
  test(`sequence tutorial ${key}: starter and solution expose the string-sequence contract`, () => {
    const step = tutorial.steps.find(step => step.key === key);
    for (const [kind, files] of [['starter', step.files], ['solution', step.solution.files]]) {
      const raw = global.analyzePythonSources(Object.fromEntries(
        files.filter(file => file.path.endsWith('.py')).map(file => [file.path, file.content])));
      const design = project(raw, { language: 'python', view: 'design' });
      assert.ok(design.classDiagram.split('\n').some(line => line.trim() === '+' + signature),
        `${kind} must display ${signature}`);
    }
  });
}
