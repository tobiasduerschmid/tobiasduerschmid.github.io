'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { analyze } = require('../../js/haskell/cycle-analysis');

const check = (source, expression) => analyze(source, { filename: 'Main.hs', expression });

test('demanded local self aliases are blocked at their original source location', () => {
  const result = check('main = print (let x = x in (x :: Int))');
  assert.equal(result.blocked, true);
  assert.equal(result.diagnostics[0].line, 1);
  assert.equal(result.diagnostics[0].column, 19);
  assert.match(result.diagnostics[0].message, /x → x/);
});

test('mutual aliases in a layout where group form one diagnostic per binding', () => {
  const result = check('main = print (a :: Int)\n  where\n    a = b\n    b = a\n');
  assert.equal(result.blocked, true);
  assert.deepEqual(result.diagnostics.map(d => d.line), [3, 4]);
});

test('unused cycles warn without blocking lazy programs or unrelated test expressions', () => {
  const source = 'module Main where\nbad = bad\nmain = print (42 :: Int)\n';
  assert.equal(check(source).blocked, false);
  assert.equal(check(source).diagnostics.length, 1);
  assert.equal(check(source, 'True').blocked, false);
  assert.equal(check(source, 'bad == (1 :: Int)').blocked, true);
});

test('recursive functions and productive constructor cycles are not alias cycles', () => {
  for (const source of ['ones = 1 : ones\nmain = print (take 3 ones)',
    'fac n = if n == 0 then 1 else n * fac (n - 1)\nmain = print (fac 4)',
    'pair = (1, pair)\nmain = print (fst pair)']) {
    assert.deepEqual(check(source).diagnostics, [], source);
    assert.equal(check(source).blocked, false, source);
  }
});

test('lexical identity distinguishes parameters, lambdas, and sibling let bindings', () => {
  const source = 'x = 42\nf x = x\ng = \\x -> x\na = let x = y; y = 7 in x\nb = let y = x in y\nmain = print (f x)';
  assert.deepEqual(check(source).diagnostics, []);
  const nested = check('main = print (let x = x in let x = 7 in (x :: Int))');
  assert.equal(nested.diagnostics.length, 1);
  assert.equal(nested.blocked, false);
});

test('unselected branches and unknown functions do not prove demand', () => {
  for (const source of ['bad = bad\nmain = print (if True then 7 else bad)',
    'bad = bad\nsafe x = 42\nmain = print (safe bad)',
    'bad = bad\nmain = print (False && bad)',
    'bad = bad\nmain = print (Just bad)']) {
    assert.equal(check(source).blocked, false, source);
  }
});

test('comments, literals, apostrophes, annotations and tabs retain source identity', () => {
  assert.deepEqual(check('main = putStrLn "let x = x in x"\n{- bad = bad {- nested -} -}\n-- bad = bad').diagnostics, []);
  const result = check("main = print (let x' = x' in (x' :: Int))");
  assert.equal(result.blocked, true);
  assert.match(result.diagnostics[0].message, /x' → x'/);
  assert.equal(check('main = print x\n\twhere\n\t\tx = x').blocked, true);
});

test('shadowed strict primitives and custom instances cannot create a false blocking proof', () => {
  for (const source of ['bad = bad\nprint x = putStrLn "fine"\nmain = print bad',
    'import Other\nbad = bad\nmain = print bad',
    'data D = D\ninstance Show D where\n  show _ = "fine"\nbad = bad :: D\nmain = print bad']) {
    assert.equal(check(source).blocked, false, source);
  }
});

test('main IO alias cycles are blocked independently of value-printing assumptions', () => {
  assert.equal(check('main = let a = b; b = a in a').blocked, true);
});

test('do bindings use their own scope and demanded output is checked', () => {
  assert.equal(check('main = do\n  let x = x\n  print (x :: Int)').blocked, true);
  assert.equal(check('x = x\nmain = do\n  x <- pure 7\n  print x').blocked, false);
});

test('locally shadowed seq and imported application operators cannot prove demand', () => {
  assert.equal(check('main = print (let seq x y = y; bad = bad in bad `seq` (42 :: Int))').blocked, false);
  assert.equal(check('import Prelude hiding (($))\nimport Other\nbad = bad\nmain = bad $ 1').blocked, false);
});

test('cycles introduced inside the selected test expression are checked', () => {
  assert.equal(check('main = putStrLn "fine"', 'let bad = bad in bad').blocked, true);
  assert.equal(check('main = putStrLn "fine"', 'let bad = bad in True').blocked, false);
});

test('standard JavaScript object property names are ordinary Haskell names', () => {
  assert.equal(check('constructor = constructor\nmain = print constructor').blocked, true);
  assert.equal(check('toString = toString\nmain = print toString').blocked, true);
});

test('rebindable conditionals and a failing earlier demand never establish a freeze', () => {
  assert.equal(check('{-# LANGUAGE RebindableSyntax #-}\nimport Prelude\nifThenElse c t e = t\nbad = bad\nmain = if bad then print 42 else print 0').blocked, false);
  assert.equal(check('bad = bad\nmain = print (error "stop" `seq` (bad :: Int))').blocked, false);
});

test('large cycles have bounded diagnostic output', () => {
  const source = Array.from({ length: 2500 }, (_, i) => `a${i} = a${(i + 1) % 2500}`).join('\n') + '\nmain = print a0';
  const result = check(source);
  assert.equal(result.blocked, true);
  assert.ok(JSON.stringify(result).length < 100000, 'editor payload must remain bounded');
});

test('an unrelated unsupported equation does not hide a later obvious local cycle', () => {
  assert.equal(check('fac 0 = 1\nfac n = n * fac (n - 1)\nmain = print (let bad = bad in (bad :: Int))').blocked, true);
});

test('unsupported as-pattern and infix binders cannot expose shadowed outer names', () => {
  assert.equal(check('bad = bad\nmain = print (let both@(bad, ignored) = (42, ()) in (bad :: Int))').blocked, false);
  assert.equal(check('main = print (let x + y = (42 :: Int); bad = bad in bad + 1)').blocked, false);
});

test('test expressions can demand exported bindings but not private module bindings', () => {
  assert.equal(check('id = id\nmain = putStrLn "fine"', 'id True').blocked, false);
  assert.equal(check('module Main (main) where\nimport Prelude hiding (id)\nid = id\nmain = putStrLn "fine"', 'id True').blocked, false);
  assert.equal(check('module Main (main, bad) where\nbad = bad\nmain = print (42 :: Int)', 'bad == (1 :: Int)').blocked, true);
});

test('long flat expressions exhaust analysis without overflowing the browser stack', () => {
  assert.equal(check('main = print (' + Array(5000).fill('1').join(' + ') + ' :: Int)').blocked, false);
  assert.equal(check('main = f ' + Array(4000).fill('1').join(' ')).blocked, false);
});

test('evaluating an IO action does not imply executing its output effects', () => {
  assert.equal(check('main = print (let bad = bad in print (bad :: Int) `seq` (42 :: Int))').blocked, false);
  assert.equal(check('main = print (let bad = bad in (do { print (bad :: Int) }) `seq` (42 :: Int))').blocked, false);
  assert.equal(check('main = let bad = bad in print (bad :: Int)').blocked, true);
});

test('comparison and arithmetic checks do not assume the other operand completes', () => {
  assert.equal(check('main = print (let bad = bad in bad < error "stop")').blocked, false);
  assert.equal(check('main = print (let bad = bad in bad + error "stop")').blocked, false);
  assert.equal(check('main = print (let bad = bad in bad * (0 :: Integer))').blocked, false);
  assert.equal(check('main = print (let bad = bad in bad == [error "stop"])').blocked, false);
  assert.equal(check('main = print (let bad = bad in bad == [1,2,3 :: Int])').blocked, true);
});
