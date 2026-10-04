const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Adapter, assess, readConfig } = require('../../js/compiler-tutorial-adapter.js');
const { compile } = require('../../js/compiler-lab-core.js');

const number = { type: 'NUMBER', value: '12', children: [], start: 4, end: 6 };
const result = { ok: true, tokens: [{ type: 'NUMBER', value: '12', line: 1, column: 5 }], ast: number, diagnostics: [] };

test('compiler checks compare token kinds, lexemes and their complete order', () => {
  assert.equal(assess(result, { tokens: [{ type: 'NUMBER', value: '12' }] }), true);
  assert.equal(assess(result, { tokens: [{ type: 'NUMBER', value: '1' }] }), false);
  assert.equal(assess(result, { tokens: [] }), false);
});

test('AST checks pin structure and values while accepting source-span differences', () => {
  assert.equal(assess(result, { ast: { type: 'NUMBER', value: '12', children: [] } }), true);
  assert.equal(assess(result, { ast: { type: 'NUMBER', value: '13', children: [] } }), false);
  assert.equal(assess(result, { ast: { type: 'NUMBER', children: [number] } }), false);
});

test('AST checks reject unwanted ambiguity and can specify every valid alternative', () => {
  const other = { type: 'NUMBER', value: '13', children: [] };
  const ambiguous = { ...result, asts: [number, other] };
  assert.equal(assess(ambiguous, { ast: number }), false);
  assert.equal(assess(ambiguous, { asts: [other, number] }), true);
  assert.equal(assess(ambiguous, { asts: [number, number] }), false);
});

test('unordered AST expectations match overlapping broad and specific patterns regardless of order', () => {
  const parsed = compile({
    tokenRules: [{ name: 'NUMBER', pattern: '[0-9]+' }, { name: 'PLUS', pattern: '\\+' }, { name: 'STAR', pattern: '\\*' }],
    grammar: 'S = A | B; A = NUMBER PLUS Product; Product = NUMBER STAR NUMBER; B = Sum STAR NUMBER; Sum = NUMBER PLUS NUMBER;',
    source: '1+2*3',
    ast: { inlineRules: ['S'], foldRules: { A: 'left', B: 'left', Product: 'left', Sum: 'left' } },
  });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.asts.length, 2);
  const broad = { type: 'BinaryExpression' };
  const specific = { type: 'BinaryExpression', value: '+' };
  assert.equal(assess(parsed, { asts: [broad, specific] }), true);
  assert.equal(assess(parsed, { asts: [specific, broad] }), true);
});

test('negative checks require the intended phase rather than any failure', () => {
  const syntaxError = { ok: false, diagnostics: [{ stage: 'syntax', message: 'Missing operand' }] };
  assert.equal(assess(syntaxError, { error: 'syntax' }), true);
  assert.equal(assess(syntaxError, { error: 'lexical' }), false);
  assert.equal(assess(result, { error: 'syntax' }), false);
  assert.equal(assess({ ...syntaxError, cancelled: true }, { error: 'syntax' }), false);
});

test('absent or misspelled compiler expectations cannot silently pass a check', () => {
  assert.throws(() => assess(result, undefined), /compiler/);
  assert.throws(() => assess(result, { toknes: [] }), /toknes/);
  assert.throws(() => assess(result, []), /compiler object/);
  assert.throws(() => assess(result, { tokens: null }), /array/);
  assert.throws(() => assess(result, { error: '' }), /diagnostic stage/);
  assert.throws(() => assess(result, { error: 'syntax', ast: number }), /cannot also/);
  assert.equal(assess(result, {}), true);
});

test('misspelled nested AST criteria cannot silently become broad passing patterns', () => {
  assert.throws(() => assess(result, { ast: { type: 'NUMBER', childen: [number] } }), /childen/);
  assert.throws(() => assess(result, { asts: [{ type: 'NUMBER', vlaue: 'wrong' }] }), /vlaue/);
  assert.throws(() => assess(result, { ast: { type: 'NUMBER', children: [{ type: 'NUMBER', vlaue: 'wrong' }] } }), /vlaue/);
  assert.equal(assess(result, { ast: { type: 'NUMBER', start: 0, end: 2 } }), true);
});

test('malformed token, source and sparse tree expectations cannot silently earn credit', () => {
  assert.throws(() => assess(result, { tokens: Array(1) }), /token expectation/i);
  assert.throws(() => assess(result, { tokens: [null] }), /token expectation/i);
  assert.throws(() => assess(result, { tokens: [{ type: 'NUMBER', value: '12', vlaue: 'wrong' }] }), /vlaue/);
  assert.throws(() => assess(result, { source: 12 }), /source.*string/i);
  assert.throws(() => assess(result, { asts: Array(1) }), /AST expectation/i);
  assert.throws(() => assess(result, { ast: { type: 'NUMBER', children: Array(1) } }), /AST expectation/i);
});

test('compiler configuration reads the three declared files without depending on the selected tab', () => {
  const step = { compiler_files: { tokens: 'step/tokens.json', grammar: 'step/grammar.ebnf', source: 'step/source.txt' } };
  const files = { 'step/tokens.json': '{"tokenRules":[],"ast":{"inlineRules":["expr"]}}', 'step/grammar.ebnf': 'expr = NUMBER ;', 'step/source.txt': '12' };
  const config = readConfig(step, path => files[path]);
  assert.equal(config.grammar, 'expr = NUMBER ;');
  assert.equal(config.source, '12');
  assert.deepEqual(config.ast.inlineRules, ['expr']);
  assert.throws(() => readConfig(step, () => undefined), /missing/i);
});

function workspace() {
  return {
    'tokens.json': JSON.stringify({ tokenRules: [{ name: 'NUMBER', pattern: '[0-9]+' }], ast: { inlineRules: ['S'] } }),
    'grammar.ebnf': 'S = NUMBER;',
    'source.txt': '7',
  };
}

function adapterFor(files, client = { run: async config => compile(config), cancel() {}, destroy() {} }) {
  return new Adapter({ getFile: path => files[path], client });
}

test('check source overrides use the frozen learner rules and leave the source file unchanged', async () => {
  const files = workspace();
  const adapter = adapterFor(files);
  const checked = await adapter.check({}, [
    { compiler: { source: '4', ast: { type: 'NUMBER', value: '4', children: [] } } },
    { compiler: { source: '8', ast: { type: 'NUMBER', value: '8', children: [] } } },
  ]);
  assert.deepEqual(checked.results, [true, true]);
  assert.equal(checked.config.source, '7');
  assert.equal(files['source.txt'], '7');
  assert.equal(adapter.isCurrent({}, checked.config), true);
});

test('malformed tokenizer JSON reports an actionable failure and corrected JSON can run next', async () => {
  const files = workspace();
  const valid = files['tokens.json'];
  const adapter = adapterFor(files);
  files['tokens.json'] = '{ "tokenRules": [';
  await assert.rejects(adapter.run({}), /Tokenizer JSON/);
  await assert.rejects(adapter.check({}, [{ compiler: {} }]), /Tokenizer JSON/);
  files['tokens.json'] = valid;
  const run = await adapter.run({});
  assert.equal(run.result.ok, true);
  assert.equal(run.result.ast.value, '7');
});

test('a malformed or changed file invalidates a previous snapshot without throwing', () => {
  const files = workspace();
  const adapter = adapterFor(files);
  const config = adapter.snapshot({});
  files['tokens.json'] = '{';
  assert.equal(adapter.isCurrent({}, config), false);
  files['tokens.json'] = workspace()['tokens.json'];
  files['source.txt'] = '8';
  assert.equal(adapter.isCurrent({}, config), false);
  files['source.txt'] = '7';
  assert.equal(adapter.isCurrent({}, config), true);
});

test('cancellation leaves unfinished criteria unknown and a later batch can pass', async () => {
  const files = workspace();
  let settle;
  const client = {
    run: () => new Promise(resolve => { settle = resolve; }),
    cancel() { settle?.({ ok: false, cancelled: true, diagnostics: [] }); },
    destroy() {},
  };
  const adapter = adapterFor(files, client);
  const checking = adapter.check({}, [{ compiler: {} }, { compiler: {} }]);
  adapter.cancel();
  assert.deepEqual((await checking).results, [null, null]);
  client.run = async config => compile(config);
  assert.deepEqual((await adapter.check({}, [{ compiler: {} }])).results, [true]);
});

test('a check finishing after learner edits carries the original snapshot so its grade can be discarded', async () => {
  const files = workspace();
  let finish;
  const client = { run: config => new Promise(resolve => { finish = () => resolve(compile(config)); }), cancel() {}, destroy() {} };
  const adapter = adapterFor(files, client);
  const checking = adapter.check({}, [{ compiler: { ast: { type: 'NUMBER', value: '7' } } }]);
  files['grammar.ebnf'] = 'S = NUMBER NUMBER;';
  finish();
  const checked = await checking;
  assert.deepEqual(checked.results, [true]);
  assert.equal(checked.config.grammar, 'S = NUMBER;');
  assert.equal(adapter.isCurrent({}, checked.config), false);
});
