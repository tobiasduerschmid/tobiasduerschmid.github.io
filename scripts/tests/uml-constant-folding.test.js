'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
require('../../js/uml-analyzer-python.js');
require('../../js/uml-analyzer-js.js');
const ts = require('../../js/vendor/typescript/5.9.3/typescript.min.js');
const { analyzeJavaSources } = require('../../js/uml-analyzer-java.js');
const { analyzeCppSources } = require('../../js/uml-analyzer-cpp.js');
const { project } = require('../../js/uml-diagram-views.js');

const languages = {
  python: {
    analyze: global.analyzePythonSources, file: 'example.py',
    source: body => 'class Sink:\n    def consume(self, item: int) -> None:\n        pass\nsink = Sink()\n' + body,
    declaration: values => `items: list[int] = [${values}]`,
    loop: body => 'for item in items:\n    sink.consume(item)' + (body ? '\n    ' + body : ''),
    mutate: 'items[0] = 9',
  },
  java: {
    analyze: analyzeJavaSources, file: 'Main.java',
    source: body => 'class Sink { void consume(int item) {} } class Main { public static void main(String[] args) { Sink sink = new Sink(); ' + body + ' } }',
    declaration: values => `int[] items = {${values}};`,
    loop: body => 'for (int item : items) { sink.consume(item); ' + body + ' }',
    mutate: 'items[0] = 9;',
  },
  cpp: {
    analyze: analyzeCppSources, file: 'example.cpp',
    source: body => 'class Sink { public: void consume(int item) {} }; int main() { Sink sink; ' + body + ' }',
    declaration: values => `int items[] = {${values}};`,
    loop: body => 'for (int item : items) { sink.consume(item); ' + body + ' }',
    mutate: 'items[0] = 9;',
  },
  typescript: {
    analyze: sources => global.analyzeJSSources(sources, ts), file: 'example.ts',
    source: body => 'class Sink { consume(item: number): void {} } const sink = new Sink(); ' + body,
    declaration: values => `const items: number[] = [${values}];`,
    loop: body => 'for (const item of items) { sink.consume(item); ' + body + ' }',
    mutate: 'items[0] = 9;',
  },
};

const loopLabels = syntax => syntax.split('\n').filter(line => /^loop /.test(line));
const withoutLoopLabels = syntax => syntax.replace(/^loop \[[^\n]*\]$/gm, 'loop []');

for (const [language, fixture] of Object.entries(languages)) {
  function infer(body) {
    const raw = fixture.analyze({ [fixture.file]: fixture.source(body) });
    assert.deepEqual(raw.errors, []);
    return raw;
  }

  for (const values of ['1, 2', '1, 1 + 1']) {
    test(`${language}: Design exposes known iterable values from ${values} without changing inference`, () => {
      const raw = infer(fixture.declaration(values) + '\n' + fixture.loop(''));
      const original = structuredClone(raw);
      const design = project(raw, { language, view: 'design' });

      assert.deepEqual(loopLabels(design.sequenceDiagram), ['loop [for each item in [1, 2]]']);
      assert.match(raw.sequenceDiagram, /^loop \[[^\n]*\bitems\b[^\n]*\]$/m);
      assert.equal(withoutLoopLabels(design.sequenceDiagram), withoutLoopLabels(raw.sequenceDiagram));
      assert.equal(project(raw, { language, view: 'implementation' }).sequenceDiagram, raw.sequenceDiagram);
      assert.deepEqual(raw, original, 'display projection must leave raw analysis and metadata unchanged');
    });
  }

  test(`${language}: mutation inside a loop keeps the iterable symbolic`, () => {
    const raw = infer(fixture.declaration('1, 2') + '\n' + fixture.loop(fixture.mutate));
    assert.deepEqual(loopLabels(project(raw, { language }).sequenceDiagram), ['loop [for each item in items]']);
  });

  test(`${language}: identical headers cannot reuse a known value for an unknown occurrence`, () => {
    const raw = infer([fixture.declaration('1, 2'), fixture.loop(''), fixture.mutate, fixture.loop('')].join('\n'));
    assert.deepEqual(loopLabels(project(raw, { language }).sequenceDiagram), [
      'loop [for each item in items]', 'loop [for each item in items]',
    ]);
  });
}
