'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { projectExpression, projectLoop, projectSequence } = require('../../js/uml-expression-views.js');

test('logical spelling changes preserve operand order, grouping, and comparison semantics', () => {
  for (const language of ['java', 'cpp', 'js', 'typescript']) {
    assert.equal(projectExpression('ready && (!closed || retry())', { language }), 'ready and (not(closed) or retry())');
    assert.equal(projectExpression('!left == right', { language }), 'not(left) == right');
    assert.equal(projectExpression('a !== b || x === y || a != b', { language }), 'a !== b or x === y or a != b');
    assert.equal(projectExpression('flags & mask || flags | mask', { language }), 'flags & mask or flags | mask');
  }
});

test('truthiness and Boolean conversion are not fabricated when projecting a guard', () => {
  assert.equal(projectExpression('items and not ready or False', { language: 'python' }), 'items and not ready or false');
  assert.equal(projectExpression('items || fallback()', { language: 'js' }), 'items or fallback()');
  assert.equal(projectExpression('TrueValue && True', { language: 'js' }), 'TrueValue and True');
  assert.equal(projectExpression('True and FalseAlarm', { language: 'python' }), 'true and FalseAlarm');
});

test('operators and punctuation inside literal values are opaque', () => {
  const examples = [
    ['java', 'text == "a && !b, c" && ready', 'text == "a && !b, c" and ready'],
    ['python', 'text == "True and False" and True', 'text == "True and False" and true'],
    ['cpp', 'text == R"tag(a && "!b")tag" && ready', 'text == R"tag(a && "!b")tag" and ready'],
    ['js', '`a && ${ready || fallback}` && ready', '`a && ${ready || fallback}` and ready'],
    ['js', '`outer ${`a&&b`} tail` && ready', '`outer ${`a&&b`} tail` and ready'],
    ['js', '/a&&[!|]/.test(text) && ready', '/a&&[!|]/.test(text) and ready'],
    ['js', 'items.some(value => /a&&b/.test(value))', 'items.some(value => /a&&b/.test(value))'],
    ['js', 'items.some(value => { return /a|b/.test(value); })', 'items.some(value => {return /a|b/.test(value);})'],
    ['js', 'value / divisor > 2 && ready', 'value / divisor > 2 and ready']
  ];
  for (const [language, source, expected] of examples) assert.equal(projectExpression(source, { language }), expected);
  assert.equal(projectExpression('ready && "unfinished', { language: 'java' }), 'ready && "unfinished');
});

test('the same foreach intent uses the same Design label across source languages', () => {
  const examples = [
    ['python', 'for item in items'], ['java', 'for (String item : items)'],
    ['cpp', 'for (const std::string & item : items)'], ['typescript', 'for item of items']
  ];
  for (const [language, source] of examples) assert.equal(projectLoop(source, { language }), 'for each item in items');
  assert.equal(projectLoop('for key in object', { language: 'js' }), 'for each key in keys of object');
  assert.equal(projectLoop('for (const key in object)', { language: 'typescript' }), 'for each key in keys of object');
  assert.equal(projectLoop('for (String item : new String [ ] { "book" , "pen" })', { language: 'java' }), 'for each item in ["book", "pen"]');
});

test('C-style loops expose initialization, repetition condition, and update separately', () => {
  for (const language of ['java', 'cpp', 'typescript']) {
    assert.equal(projectLoop('for (int i = 0; i < count && ready; ++i)', { language }),
      'start i := 0; while i < count and ready; after each iteration i := i + 1');
    assert.equal(projectLoop('for (;;)', { language }), 'repeat');
  }
  assert.equal(projectLoop('for (let i = 0; i < size; i += step)', { language: 'typescript' }),
    'start i := 0; while i < size; after each iteration i := i + (step)');
  assert.equal(projectLoop('for (next(); ready(); step())', { language: 'java' }),
    'start next(); while ready(); after each iteration step()');
  assert.equal(projectLoop('for (let i: number = 0; i < size; i++)', { language: 'typescript' }),
    'start i := 0; while i < size; after each iteration i := i + 1');
  assert.equal(projectLoop('for (*cursor = 0; *cursor < 10; ++*cursor)', { language: 'cpp' }),
    'start * cursor := 0; while * cursor < 10; after each iteration ++ * cursor');
  assert.equal(projectLoop('for (Iterator cursor = begin; cursor != end; cursor++)', { language: 'cpp' }),
    'start cursor := begin; while cursor != end; after each iteration cursor++');
  assert.equal(projectExpression('counter += step', { language: 'cpp', assignment: true }), 'counter += step');
  assert.equal(projectExpression('items += additions', { language: 'python', assignment: true }), 'items += additions');
});

test('pre-test and post-test loops remain distinguishable', () => {
  assert.equal(projectLoop('while (ready && !closed)', { language: 'java' }), 'while ready and not(closed)');
  for (const label of ['do (ready)', 'do-while (ready)', 'do, then while ready']) {
    assert.equal(projectLoop(label, { language: 'cpp' }), 'repeat; then while ready');
  }
});

test('assignment abstraction uses statement context, never comparison or keyword-argument guessing', () => {
  assert.equal(projectExpression('result = ready && enabled', { language: 'java', assignment: true }), 'result := ready and enabled');
  assert.equal(projectExpression('result == ready', { language: 'java', assignment: true }), 'result == ready');
  assert.equal(projectExpression('f(ready=True, label="x=y")', { language: 'python' }), 'f(ready = true, label = "x=y")');
  assert.equal(projectExpression('items[index++] += step', { language: 'cpp', assignment: true }), 'items[index++] += step', 'do not duplicate an effectful lvalue');
  assert.equal(projectExpression('this._read(!this.ready)', { language: 'java' }), 'self._read(not(self.ready))');
});

test('sequence projection changes labels while preserving participants, directions, and fragment structure', () => {
  const source = ['@startuml', 'participant Main', 'participant worker: Worker',
    'loop [for item in items]', 'alt [ready and not stopped]', 'Main -> worker: _send(item, True)',
    'worker --> Main: result: str', 'else [else]', 'Main -> worker: _send("True && stop")', 'end', 'end', '@enduml'].join('\n');
  const projected = projectSequence(source, { language: 'python', projectName: name => name.replace(/^_/, '') });
  assert.match(projected, /loop \[for each item in items\]/);
  assert.match(projected, /Main -> worker: send\(item, true\)/);
  assert.match(projected, /Main -> worker: send\("True && stop"\)/);
  assert.match(projected, /worker --> Main: result: str/);
  assert.deepEqual(projected.split('\n').map(line => line.split(':')[0].replace(/\[.*\]/, '[]')),
    source.split('\n').map(line => line.split(':')[0].replace(/\[.*\]/, '[]')));
  assert.equal(projectSequence(projected, { language: 'python' }), projected, 'projection is stable');
});

test('opaque source constructs retain their spelling when no safe abstraction is available', () => {
  assert.equal(projectExpression('flags &= mask', { language: 'cpp', assignment: true }), 'flags &= mask');
  assert.equal(projectExpression('a ?? b', { language: 'js' }), 'a ?? b');
  assert.equal(projectLoop('for await (item of stream)', { language: 'js' }), 'for await(item of stream)');
  assert.equal(projectSequence('note over A: text && text\nA --> B: <<create>>', { language: 'java' }), 'note over A: text && text\nA --> B: <<create>>');
});

test('casts retain their operation while explicit primitive type positions use the shared mapper', () => {
  const mapType = type => ({ int: 'Integer', string: 'String', bool: 'Boolean', boolean: 'Boolean' }[type] || type);
  assert.equal(projectExpression('(int) score', { language: 'java', mapType }), '(Integer) score');
  assert.equal(projectExpression('(score) + 1', { language: 'java', mapType }), '(score) + 1');
  assert.equal(projectExpression('value as string', { language: 'typescript', mapType }), 'value as String');
  assert.equal(projectExpression('!(boolean) flag', { language: 'java', mapType }), 'not((Boolean) flag)');
  assert.equal(projectExpression('!static_cast<bool>(flag)', { language: 'cpp', mapType }), 'not(static_cast<Boolean>(flag))');
});

test('negation encloses optional-call, optional-index, and constructed-object operands', () => {
  assert.equal(projectExpression('!callback?.()', { language: 'js' }), 'not(callback?.())');
  assert.equal(projectExpression('!items?.[0]', { language: 'js' }), 'not(items?.[0])');
  assert.equal(projectExpression('!new (getType())(arg)', { language: 'js' }), 'not(new(getType())(arg))');
});

test('published loop labs have complete foreach labels, including the Java array expression', () => {
  const fs = require('node:fs');
  const yaml = require('js-yaml');
  require('../../js/uml-analyzer-python.js');
  require('../../js/uml-analyzer-js.js');
  const ts = require('../../js/vendor/typescript/5.9.3/typescript.min.js');
  const { analyzeJavaSources } = require('../../js/uml-analyzer-java.js');
  const { analyzeCppSources } = require('../../js/uml-analyzer-cpp.js');
  const labs = yaml.load(fs.readFileSync(require('node:path').join(__dirname, '../../_data/uml_code_labs.yml'), 'utf8'));
  const analyzers = {
    python: ['example.py', global.analyzePythonSources], java: ['Main.java', analyzeJavaSources],
    cpp: ['example.cpp', analyzeCppSources], typescript: ['example.ts', sources => global.analyzeJSSources(sources, ts)]
  };
  for (const [language, [filename, analyze]] of Object.entries(analyzers)) {
    const raw = analyze({ [filename]: labs.loop_boundary[language].code });
    assert.deepEqual(raw.errors, []);
    const design = projectSequence(raw.sequenceDiagram, { language });
    assert.match(design, /^loop \[for each item in /m);
    assert.doesNotMatch(design, /\.\.\./);
    assert.match(design, /(?:addItem|add_item)\(item\)/);
    if (language === 'java') assert.match(design, /for each item in \["book", "pen"\]/);
  }
});
