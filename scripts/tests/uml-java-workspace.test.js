'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const yaml = require('js-yaml');
const { analyzeJavaSources } = require('../../js/uml-analyzer-java.js');

async function createWorkspace(t) {
  const vendor = path.resolve(__dirname, '../../js/vendor/tree-sitter');
  const runtime = path.join(vendor, 'web-tree-sitter-0.25.10/tree-sitter.js');
  // Node treats the pinned browser ESM as CommonJS by filename.
  const source = fs.readFileSync(runtime, 'utf8').replaceAll('import.meta.url', JSON.stringify(pathToFileURL(runtime).href));
  const { Parser, Language } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  await Parser.init({locateFile: name => path.join(path.dirname(runtime), name)});
  const parser = new Parser();
  parser.setLanguage(await Language.load(path.join(vendor, 'tree-sitter-java-0.23.5/tree-sitter-java.wasm')));
  const { javaSyntaxWorkspace } = await import('../../js/uml-java-syntax.mjs');
  const workspace = javaSyntaxWorkspace(parser);
  t.after(() => workspace.dispose());
  return (sources, options) => analyzeJavaSources(sources, options, workspace.parse(sources));
}

test('the interfaces lesson traces each printShape call on the concrete object passed to it', async t => {
  const analyze = await createWorkspace(t);
  const tutorial = yaml.load(fs.readFileSync(path.join(__dirname, '../../_data/tutorials/java.yml'), 'utf8'));
  const step = tutorial.steps.find(step => step.open_file === 'Shape.java');
  const sources = Object.fromEntries(step.solution.files.map(({path, content}) => [path, content]));

  const result = analyze(sources);

  assert.match(result.sequenceDiagram, /participant Main as : ShapeDemo/);
  assert.match(result.sequenceDiagram, /printShape\(c\)[\s\S]*Main -> c: getArea\(\)[\s\S]*printShape\(r\)[\s\S]*Main -> r: getArea\(\)/);
  assert.deepEqual(result.sequenceWarnings, []);
});

test('editing a record updates component types, removes deleted files, and recovers from incomplete edits', async t => {
  const analyze = await createWorkspace(t);
  const files = {'Ticket.java':'// 🎟\nrecord Ticket(String label, Desk desk) {}', 'Desk.java':'class Desk {}'};
  const first = analyze(files).classDiagram;
  assert.match(first, /Ticket --> "0\.\.1" Desk/);
  assert.match(first, /\+label\(\): String/);

  const incomplete = analyze({'Ticket.java':'// 🎟\nclass Ticket { String label; void update('}).classDiagram;
  assert.match(incomplete, /class Ticket/);
  assert.doesNotMatch(incomplete, /Desk|label\(\)/);

  const edited = analyze({'Ticket.java':'/* 🎟\n updated */\nrecord Ticket(int count) {}'}).classDiagram;
  assert.match(edited, /-count: int/);
  assert.match(edited, /\+count\(\): int/);
  assert.doesNotMatch(edited, /label|Desk/);
});

const selector = 'class Selector { String pick(String s) { text(); return s; } int pick(int n) { number(); return n; } void text() {} void number() {} }';
const main = calls => 'class App { public static void main(String[] args) { Selector s = new Selector(); '+calls+' } }';

test('a literal selects the exact same-arity overload and its reply', () => {
  const result = analyzeJavaSources({'Selector.java':selector,'App.java':main('s.pick(3); s.pick("text");')});
  assert.match(result.sequenceDiagram, /pick\(3\)[\s\S]*s -> s: number\(\)[\s\S]*s --> Main: int/);
  assert.match(result.sequenceDiagram, /pick\("text"\)[\s\S]*s -> s: text\(\)[\s\S]*s --> Main: String/);
  assert.deepEqual(result.sequenceWarnings, []);
});

test('an overload with unknown argument type leaves its body and reply unresolved until a compiler binding is available', async t => {
  const analyze = await createWorkspace(t);
  const source = main('int n = 3; s.pick(n);');
  const files = {'Selector.java':selector, 'App.java':source};
  const preview = analyze(files);
  assert.match(preview.sequenceDiagram, /s: pick\(n\)/);
  assert.doesNotMatch(preview.sequenceDiagram, /s --> Main:|s -> s: (number|text)\(\)/);
  assert.ok(preview.sequenceWarnings.some(w => w.code === 'dispatch'));

  const start = source.indexOf('pick(n)');
  const result = analyze(files, {javaBindings:[{file:'App.java', start, end:start+4, kind:'method', name:'pick',
    declaration:false, owner:'Selector', key:'LSelector;.pick(I)I', parameters:['int'], type:'int'}]});
  assert.match(result.sequenceDiagram, /s -> s: number\(\)/);
  assert.match(result.sequenceDiagram, /s --> Main: int/);
  assert.doesNotMatch(result.sequenceDiagram, /s -> s: text\(\)|s --> Main: String/);
  assert.deepEqual(result.sequenceWarnings, []);
});
