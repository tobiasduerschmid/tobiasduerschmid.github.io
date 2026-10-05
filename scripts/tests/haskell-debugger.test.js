'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { instrument } = require('../../js/debugger/haskell/instrument');

test('Haskell probes describe original equation and guard locations without evaluating arguments', () => {
  const source = `module Main where
-- equals = inside comments are not code
fac 0 = 1
fac n = n * fac (n - 1)
category n
  | n < 0 = "negative = value"
  | otherwise = "positive"
main = print (fac 3)
`;
  const result = instrument(source, '/tutorial/Main.hs');
  assert.deepEqual(result.sites.filter(site => site.kind === 'equation' || site.kind === 'guard').map(({ function: name, line }) => [name, line]),
    [['fac', 3], ['fac', 4], ['category', 5], ['category', 6], ['category', 7], ['main', 8]]);
  assert.equal(result.sites.find(site => site.kind === 'equation' && site.line === 4).bindings.n, 'arg0');
  assert.ok(result.sites.find(site => site.kind === 'entry' && site.function === 'fac').equations.length === 2);
  assert.doesNotMatch(result.code, /show n/);
  assert.match(result.code, /module Main where\nimport qualified SEBookDebug as SEBookTrace/);
});

test('Haskell instrumentation leaves nested layout and record fields within their original expressions', () => {
  const source = `{-# LANGUAGE RecordWildCards #-}
module Main (main) where
import Data.List (sort)
data Pair = Pair { left :: Int, right :: Int }
average x y = total / 2 where total = x + y
choose x = let y = x + 1 in y
main = do
  let p = Pair { left = 2, right = 3 }
  print (choose (left p))
`;
  const result = instrument(source, '/tutorial/Main.hs');
  assert.deepEqual(result.sites.filter(site => site.kind === 'entry').map(site => site.function), ['average', 'choose', 'main']);
  assert.equal(result.sites.find(site => site.kind === 'binding' && site.name === 'total').expression, 'x + y');
  assert.match(result.code, /Pair \{ left = 2, right = 3 \}/);
});

test('Haskell instrumentation keeps where clauses outside guarded RHS probes', () => {
  const result = instrument(`module Main where
f x | ok = x
    | otherwise = -x
  where ok = x > 0
main = print (f 2)
`, '/tutorial/Main.hs');
  assert.deepEqual(result.sites.filter(site => site.kind === 'guard').map(site => site.line), [2, 3]);
  assert.equal(result.sites.find(site => site.kind === 'binding' && site.name === 'ok').expression, 'x > 0');
});

test('Haskell debugger rejects unsupported declaration layout with an actionable error', () => {
  assert.throws(() => instrument('module Main where { main = print 1 }', '/tutorial/Main.hs'), /explicit.*braces/i);
  assert.throws(() => instrument('module Main where\nf x = x; main = print (f 1)\n', '/tutorial/Main.hs'), /semicolon/i);
});


test('Haskell dashed comments and infix binding diagnostics do not create false source locations', () => {
  const result = instrument('module Main where\n--- equals = a comment\nmain = print "done"\n', '/tutorial/Main.hs');
  assert.deepEqual(result.sites.filter(site => site.kind === 'entry').map(site => site.line), [3]);
  assert.throws(() => instrument('module Main where\nx +++ y = x + y\nmain = print (1 +++ 2)\n', '/tutorial/Main.hs'), /named prefix equations/);
});

const { HaskellDebugSession } = require('../../js/debugger/haskell/session');

test('Haskell breakpoints reject unsupported source lines and honor live removal', () => {
  const messages = [];
  let resumed = 0;
  const session = new HaskellDebugSession({
    sites: [{ id: 0, function: 'f', file: '/tutorial/Main.hs', line: 2, first_line: 2, bindings: { x: 'arg0' }, kind: 'entry', arity: 1, equations: [{ id: 1, line: 2, header: 'f x' }] }, { id: 1, function: 'f', file: '/tutorial/Main.hs', line: 2, kind: 'equation', index: 0, header: 'f x', bindings: { x: 'arg0' } }],
    breakpoints: [{ file: '/tutorial/Main.hs', line: 5 }],
    send: message => messages.push(message), resume: () => { resumed += 1; }, marker: 'test',
  });
  assert.match(messages[0].error, /top-level equation/);
  session.observe('call', 0, 1);
  session.handleMessage({ type: 'command', command: 1 });
  session.updateBreakpoints([{ op: 'add', file: '/tutorial/Main.hs', line: 2 }]);
  session.updateBreakpoints([{ op: 'remove', file: '/tutorial/Main.hs', line: 2 }]);
  session.observe('select', 1, 1);
  assert.equal(messages.filter(message => message.type === 'paused').length, 1);
  assert.equal(resumed, 2);
});


test('Haskell generated line maps retain original compiler diagnostic locations', () => {
  const source = 'module Main where\nf x = x + 1\nmain = print unknownValue\n';
  const result = instrument(source, '/tutorial/Main.hs');
  const generatedLine = result.code.split('\n').findIndex(line => line.includes('print unknownValue')) + 1;
  assert.equal(result.lineMap[generatedLine], 3);
});

test('Haskell generated positions locate learner columns and never invent one', () => {
  // MicroHs counts code points and advances a tab to the next multiple of 8.
  const source = 'module Main where\nlabel :: Int -> String\nlabel n\n\t| n > 0 =\t"é" ++ missing\n'
    + '\t| otherwise = error "boom"\nmain = putStrLn (label 1)\n';
  const result = instrument(source, '/tutorial/Main.hs');
  const columnOf = (text, index) => {
    let column = 1;
    for (let i = 0; i < index; i++) column = text[i] === '\t' ? column + 8 - (column - 1) % 8 : column + 1;
    return column;
  };
  // Line 4: the second tab advances from column 18 to 25, so `"é" ++ ` ends at 31.
  // Line 5: `| otherwise = ` starts at column 9 after the tab.
  for (const [token, line, column] of [['missing', 4, 32], ['error', 5, 23]]) {
    const generated = result.code.split('\n');
    const generatedLine = generated.findIndex(text => text.includes(token)) + 1;
    const generatedColumn = columnOf(generated[generatedLine - 1], generated[generatedLine - 1].indexOf(token));
    assert.notDeepEqual([generatedLine, generatedColumn], [line, column], 'the fixture moves the token');
    assert.deepEqual(result.locate(generatedLine, generatedColumn), { line, column }, token);
  }
  const wrapperLine = result.code.split('\n').findIndex(text => text.includes('SEBookTrace.call')) + 1;
  assert.deepEqual(result.locate(wrapperLine, 1), { line: 3 }, 'generated wrapper text keeps only its line');
});

test('local previews specialize only when every use proves the same type', () => {
  const result = instrument(`module Main where
score :: Int -> Int
score n = contribution + contribution
  where contribution = if n > 0 then 1 else 0
mixed :: (Int,Double)
mixed = (value,value)
  where
    value :: Num a => a
    value = 2
`, '/tutorial/Main.hs');
  const score = result.sites.find(s => s.kind === 'equation' && s.function === 'score');
  assert.equal(score.local_bindings[0].type, 'Int');
  const mixed = result.sites.find(s => s.kind === 'equation' && s.function === 'mixed');
  assert.equal(mixed.local_bindings[0].type, 'Num a => a');
});

test('rebindable if syntax does not imply a local branch has its result type', () => {
  const result = instrument(`{-# LANGUAGE RebindableSyntax #-}
module Main where
f :: Int
f = if True then contribution else False
  where contribution = True
`, '/tutorial/Main.hs');
  const equation = result.sites.find(s => s.kind === 'equation');
  assert.equal(equation.local_bindings[0].type, '');
});
