'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { analyze } = require('../../js/uml-return-summaries.js');
const readStatement = node => node;
const summarize = body => analyze(body, { parameters: ['first', 'second'], receiver: 'self', readStatement });
const returned = name => ({ kind: 'return', name });
const assign = (name, value, declare = false) => ({ kind: 'assign', name, value, declare });
const branch = (consequent, alternate = []) => ({ kind: 'if', consequent, alternate });
const scope = body => ({ kind: 'scope', body });

test('return summaries distinguish receiver and each input object through aliases', () => {
  assert.deepEqual(summarize([returned('self')]), { kind: 'receiver' });
  assert.deepEqual(summarize([returned('second')]), { kind: 'parameter', index: 1 });
  assert.deepEqual(summarize([assign('chosen', 'first'), assign('first', 'second'), returned('chosen')]),
    { kind: 'parameter', index: 0 }, 'an alias captures identity before rebinding');
  assert.equal(summarize([assign('first', null), returned('first')]), null);
});

test('all considered return paths must agree, including early returns and fallthrough', () => {
  assert.deepEqual(summarize([branch([returned('first')], [returned('first')])]), { kind: 'parameter', index: 0 });
  assert.deepEqual(summarize([branch([returned('first')]), returned('first')]), { kind: 'parameter', index: 0 });
  assert.equal(summarize([branch([returned('first')], [returned('second')])]), null);
  assert.equal(summarize([branch([returned('first')])]), null, 'implicit return is not the input object');
  assert.equal(summarize([returned(null)]), null);
  assert.equal(summarize([]), null);
});

test('reaching definitions join by return origin rather than branch traversal order', () => {
  assert.deepEqual(summarize([branch([assign('chosen', 'first')], [assign('chosen', 'first')]), returned('chosen')]),
    { kind: 'parameter', index: 0 });
  assert.equal(summarize([branch([assign('chosen', 'first')], [assign('chosen', 'second')]), returned('chosen')]), null);
  assert.equal(summarize([branch([assign('chosen', 'first')]), returned('chosen')]), null);
});

test('lexical shadowing ends at its block while assignments to outer aliases persist', () => {
  assert.deepEqual(summarize([scope([assign('first', 'second', true)]), returned('first')]), { kind: 'parameter', index: 0 });
  assert.deepEqual(summarize([scope([assign('first', 'second')]), returned('first')]), { kind: 'parameter', index: 1 });
  assert.equal(summarize([scope([assign('hidden', 'first', true)]), returned('hidden')]), null);
  assert.deepEqual(summarize([scope([assign('chosen', 'second', true), returned('chosen')])]), { kind: 'parameter', index: 1 });
});

test('unsupported behavior declines a summary without treating it as a purity proof', () => {
  assert.equal(summarize([{ kind: 'unknown' }, returned('self')]), null);
  assert.deepEqual(summarize([returned('first'), { kind: 'unknown' }]), { kind: 'parameter', index: 0 }, 'unreachable code cannot affect a return');
});

test('large or deeply nested methods stop at fixed budgets', () => {
  let visits = 0;
  const result = analyze([...Array(1000).fill({ kind: 'noop' }), returned('first')], {
    parameters: ['first'], readStatement(node) { visits++; return node; }
  });
  assert.equal(result, null);
  assert.ok(visits <= 128);
  let nested = [returned('first')];
  for (let i = 0; i < 30; i++) nested = [scope(nested)];
  assert.equal(summarize(nested), null);
  assert.deepEqual(summarize([returned('first')]), { kind: 'parameter', index: 0 });
});
