'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const runtime = {
  document: { readyState: 'loading', addEventListener() {}, documentElement: {} },
  MutationObserver: class { observe() {} },
  setInterval() {}, clearInterval() {},
};
runtime.window = runtime;
for (const file of ['js/ArchUML/uml-bundle.js', 'js/uml-auto-describe.js']) {
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'), runtime);
}

const model = '@startuml\nclass Account {\n  + balance: Money\n}\nclass Money\nAccount --> Money\n@enduml';
const annotated = model.replace('@enduml', 'callout left of text "+" : Public visibility.\ncallout bottom of edge 1 end : The arrow points to the referenced type.\n@enduml');

test('teaching callouts leave the UML model and source line positions intact', () => {
  const result = runtime.UMLCallouts.extract(annotated);
  assert.deepEqual(JSON.parse(JSON.stringify(runtime.UMLClassDiagram.parse(result.source))),
    JSON.parse(JSON.stringify(runtime.UMLClassDiagram.parse(model))));
  assert.equal(result.source.split('\n').length, annotated.split('\n').length);
  assert.equal(result.callouts.length, 2);
  assert.equal(result.callouts[0].text, 'Public visibility.');
});

test('callout syntax handles colons in labels and preserves literal markup as text', () => {
  const result = runtime.UMLCallouts.extract('callout top of text "client : Client" : Instance: <Client> & friends.');
  assert.equal(result.callouts[0].target.value, 'client : Client');
  assert.equal(result.callouts[0].text, 'Instance: <Client> & friends.');
});

test('UML comments can quote callout syntax without creating an overlay', () => {
  const source = 'class A\nnote right of A\ncallout left of text "A" : Example syntax\nend note';
  const result = runtime.UMLCallouts.extract(source);
  assert.equal(result.callouts.length, 0);
  assert.equal(result.source, source);
});

test('malformed callouts report an authoring error instead of silently disappearing', () => {
  assert.throws(() => runtime.UMLCallouts.extract('callout sideways of text "A" : Explanation'), /callout.*line 1/i);
  assert.throws(() => runtime.UMLCallouts.extract('callout left of edge 0 : Explanation'), /callout.*line 1/i);
});

test('both accessible descriptions include the teaching explanations without inventing UML relationships', () => {
  const summary = runtime.UMLAutoDescribe.describe('class', annotated);
  assert.ok(summary.startsWith(runtime.UMLAutoDescribe.describe('class', model)));
  assert.match(summary, /Public visibility/);
  assert.match(summary, /The arrow points to the referenced type/);
  const verbose = runtime.UMLAutoDescribe.describeVerbose('class', annotated);
  const notes = verbose.sections.find(section => section.heading === 'Notation callouts');
  assert.equal(notes.items.length, 2);
  assert.match(notes.items[0], /Public visibility/);
});
