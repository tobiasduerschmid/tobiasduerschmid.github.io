const test = require('node:test');
const assert = require('node:assert/strict');
const { tokenize } = require('../../js/haskell/syntax');
const { find } = require('../../js/debugger/haskell/call-sites');

function calls(source, arity = 1, bindings = {}) {
  return find(tokenize(source), source, new Map([['f', arity]]), bindings);
}

test('direct calls retain literal structure and references to caller bindings', () => {
  const [call] = calls('f cutoff [x, 60]', 2, { cutoff: 'arg0', x: 'arg1.h' });
  assert.equal(call.callee, 'f');
  assert.equal(call.arguments[0].path, 'arg0');
  assert.equal(call.arguments[1].items[0].path, 'arg1.h');
  assert.equal(call.arguments[1].items[1].text, '60');
});

test('a function passed to a higher-order call is not mistaken for an application', () => {
  assert.equal(calls('map f [1..10]').length, 0);
  assert.equal(calls('foldr f 0 xs', 2).length, 0);
  assert.equal(calls('map (f 1) xs', 2).length, 0);
  const source = 'map (f 1) xs';
  const [call] = calls(source);
  assert.equal(source.slice(call.start, call.end), 'f 1');
});

test('call annotation never splits numeric lexemes unsupported by the shared tokenizer', () => {
  assert.equal(calls('f 1e3').length, 0);
  assert.equal(calls('f 0xff').length, 0);
  assert.equal(calls('f 1.0e-3').length, 0);
  assert.equal(calls('f 60').length, 1);
});

test('ambiguous local scopes retain runtime observations without guessed call identities', () => {
  assert.equal(calls('f 1', 1, { f: 'arg0' }).length, 0);
  assert.equal(calls('f 1 where f x = x + 1').length, 0);
  assert.equal(calls('let f x = x + 1 in f 1').length, 0);
  assert.equal(calls('map (\\f -> f 1) fs').length, 0);
  assert.equal(calls('[f x | f <- fs]').length, 0);
});
