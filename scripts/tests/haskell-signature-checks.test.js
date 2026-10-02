const test = require('node:test');
const assert = require('node:assert/strict');
const { hasDeclaration } = require('../../js/haskell/signature-checks');

const required = { name: 'canAffordPizza', type: 'Double -> Double -> Bool' };
const equation = 'canAffordPizza budget price = budget >= price\n';
const program = declaration => `module Main where\n${declaration}\n${equation}main = print (canAffordPizza 9.50 12.00)\n`;

for (const [name, declaration] of [
  ['ordinary numeric signature', 'canAffordPizza :: Double -> Double -> Bool'],
  ['whitespace and continued arrow type', 'canAffordPizza\n  :: Double\n  -> Double\n  -> Bool'],
  ['nested comments between type tokens', 'canAffordPizza {- outer {- nested -} -} :: Double {- note -} -> Double -> Bool -- result'],
  ['redundant and right-associated parentheses', 'canAffordPizza :: ((Double) -> ((Double) -> (Bool)))'],
  ['shared signature names', 'otherChecker, canAffordPizza :: Double -> Double -> Bool'],
  ['qualified Prelude primitives', 'canAffordPizza :: Prelude.Double -> Prelude.Double -> Prelude.Bool'],
  ['simple local type synonyms', 'type Money = Double\ntype Decision = Bool\ncanAffordPizza :: Money -> Money -> Decision'],
  ['a synonym for the complete arrow type', 'type Money = Double\ntype Checker = Money -> Money -> Bool\ncanAffordPizza :: Checker'],
]) {
  test(`accepts ${name}`, () => assert.equal(hasDeclaration(program(declaration), required), true));
}

// The compiler owns type equivalence and well-typedness; this API only finds
// declarations, including syntax and aliases it does not semantically parse.
for (const [name, declaration] of [
  ['a left-associated arrow structure', 'canAffordPizza :: (Double -> Double) -> Bool'],
  ['the wrong argument type', 'canAffordPizza :: Int -> Double -> Bool'],
  ['the wrong result type', 'canAffordPizza :: Double -> Double -> Int'],
  ['a generic declaration', 'canAffordPizza :: Ord a => a -> a -> Bool'],
  ['a cyclic synonym', 'type Money = Cost\ntype Cost = Money\ncanAffordPizza :: Money -> Money -> Bool'],
  ['a parameterized synonym', 'type Amount a = a\ncanAffordPizza :: Amount Double -> Amount Double -> Bool'],
  ['an unrelated qualified alias', 'canAffordPizza :: Prices.Double -> Double -> Bool'],
  ['a trailing type application', 'canAffordPizza :: Double -> Double -> Bool Extra'],
]) {
  test(`finds declaration while leaving ${name} to the compiler`, () => assert.equal(hasDeclaration(program(declaration), required), true));
}

test('accepts an explicit module declaration block', () => {
  assert.equal(hasDeclaration('module Main where { canAffordPizza :: Double -> Double -> Bool; canAffordPizza b p = b >= p; main = print True }', required), true);
});

test('accepts a module without a header and tab-indented declarations', () => {
  assert.equal(hasDeclaration('\tcanAffordPizza :: Double -> Double -> Bool\n\t' + equation, required), true);
});

for (const [name, declaration] of [
  ['inferred numeric type', ''],
  ['another function signature', 'anotherFunction :: Double -> Double -> Bool'],
  ['a longer function name', 'canAffordPizzaLater :: Double -> Double -> Bool'],
  ['a commented-out declaration', '-- canAffordPizza :: Double -> Double -> Bool'],
  ['a nested block comment', '{- outer {- nested -} canAffordPizza :: Double -> Double -> Bool -}'],
  ['a string containing the declaration', 'note = "canAffordPizza :: Double -> Double -> Bool"'],
  ['an expression annotation', 'note = canAffordPizza :: Double -> Double -> Bool'],
  ['a local where declaration', 'helper = True\n  where\n    canAffordPizza :: Double -> Double -> Bool\n    canAffordPizza b p = b >= p'],
  ['a local let declaration', 'helper = let canAffordPizza :: Double -> Double -> Bool\n             canAffordPizza b p = b >= p\n         in True'],
  ['a nested explicit declaration block', 'helper = let { canAffordPizza :: Double -> Double -> Bool; canAffordPizza b p = b >= p } in True'],
  ['a mismatched parenthesis', 'canAffordPizza :: (Double -> Double -> Bool'],
]) {
  test(`rejects ${name}`, () => assert.equal(hasDeclaration(program(declaration), required), false));
}

test('leaves a shadowed primitive synonym to compiler type comparison', () => {
  assert.equal(hasDeclaration(program('type Double = Int\ncanAffordPizza :: Double -> Double -> Bool'), required), true);
});

test('only credits the named member of a shared declaration', () => {
  assert.equal(hasDeclaration(program('first, second :: Double -> Double -> Bool'), required), false);
});

test('bounded declaration analysis rejects oversized input', () => {
  assert.equal(hasDeclaration(' '.repeat(200001), required), false);
});

test('rejects a malformed shared-name list and an empty declaration', () => {
  assert.equal(hasDeclaration(program('canAffordPizza, :: Double -> Double -> Bool'), required), false);
  assert.equal(hasDeclaration(program('canAffordPizza ::'), required), false);
});

test('rejects duplicate declarations and invalid names', () => {
  assert.equal(hasDeclaration(program('canAffordPizza :: Double -> Double -> Bool\ncanAffordPizza :: Double -> Double -> Bool'), required), false);
  assert.equal(hasDeclaration(program('canAffordPizza :: Double -> Double -> Bool'), {name: 'Main.canAffordPizza'}), false);
});
