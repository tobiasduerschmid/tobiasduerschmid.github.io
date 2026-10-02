// @ts-check
const { test, expect } = require('@playwright/test');
const { startRuntime, request, writeSource } = require('./haskell-runtime-helpers');

const signature = { name: 'canAffordPizza', type: 'Double -> Double -> Bool' };
function program(declaration, { imports = '', definitions = '', equation = 'budget >= price', samples = '9.50 12.00' } = {}) {
  return `module Main where
${imports}
${definitions}
${declaration}
canAffordPizza budget price = ${equation}
main :: IO ()
main = print (canAffordPizza ${samples})
`;
}
async function checkSignature(page, source) {
  await writeSource(page, source);
  return request(page, { type: 'runTest', path: 'Main.hs', expression: 'True', signature });
}

const accepted = [
  ['direct declaration', program('canAffordPizza :: Double -> Double -> Bool')],
  ['multiline with nested comments and parentheses', program('canAffordPizza\n  :: ((Double)) {- outer {- inner -} -}\n  -> (Double -> Bool)')],
  ['shared declaration', program('other, canAffordPizza :: Double -> Double -> Bool', { definitions: 'other b p = b >= p' })],
  ['local alias', program('canAffordPizza :: Money -> Money -> Decision', { definitions: 'type Money = Double\ntype Decision = Bool' })],
  ['parameterized alias', program('canAffordPizza :: Amount Double -> Amount Double -> Bool', { definitions: 'type Amount a = a' })],
  ['imported parameterized alias', program('canAffordPizza :: Prices.Amount Double -> Prices.Amount Double -> Bool', { imports: 'import qualified Prices' })],
  ['imported concrete alias', program('canAffordPizza :: Money -> Money -> Bool', { imports: 'import Prices (Money)' })],
  ['complete function alias', program('canAffordPizza :: Checker', { definitions: 'type Amount a = a\ntype Checker = Amount Double -> Amount Double -> Bool' })],
];

for (const [name, source] of accepted) {
  test(`explicit signature accepts ${name} through compiler type equivalence`, async ({ page }) => {
    await startRuntime(page);
    await writeSource(page, 'module Prices where\ntype Amount a = a\ntype Money = Double\n', 'Prices.hs');
    const result = await checkSignature(page, source);
    expect(result.exitCode, result.stderr || result.error || name).toBe(0);
    expect(result.stderr).toBe('');
  });
}

const rejected = [
  ['inferred-only type', program('', { definitions: 'sampleBudget :: Double\nsampleBudget = 9.5', samples: 'sampleBudget 12.00' })],
  ['commented declaration', program('-- canAffordPizza :: Double -> Double -> Bool')],
  ['local declaration for a different binding', program('', { definitions: 'helper = True\n  where\n    canAffordPizza :: Double -> Double -> Bool\n    canAffordPizza b p = b >= p' })],
  ['Ord-polymorphic declaration', program('canAffordPizza :: Ord a => a -> a -> Bool')],
  ['Fractional-polymorphic declaration that would default to Double', program('canAffordPizza :: Fractional a => a -> a -> Bool', { equation: 'True', definitions: 'default (Double)' })],
  ['RealFrac-polymorphic declaration that would default to Double', program('canAffordPizza :: RealFrac a => a -> a -> Bool', { equation: 'True', definitions: 'default (Double)' })],
  ['Float declaration', program('canAffordPizza :: Float -> Float -> Bool')],
  ['alias to wrong primitive', program('canAffordPizza :: Amount Float -> Amount Float -> Bool', { definitions: 'type Amount a = a' })],
  ['learner alias shadowing the expected primitive', program('canAffordPizza :: Double -> Double -> Bool', { imports: 'import Prelude hiding (Double)', definitions: 'type Double = Float' })],
  ['correct declaration with incompatible sample inputs', program('canAffordPizza :: Double -> Double -> Bool', { samples: '"9.50" "12.00"' })],
];

for (const [name, source] of rejected) {
  test(`explicit signature rejects ${name}`, async ({ page }) => {
    await startRuntime(page);
    const result = await checkSignature(page, source);
    expect(result.exitCode, name).toBe(1);
  });
}

test('signature failures recover after edits without stale imports or overwriting learner files', async ({ page }) => {
  test.setTimeout(60_000); // Several sequential real compiler reloads in this recovery journey.
  await startRuntime(page);
  const existingFiles = Array.from({ length: 6 }, (_, i) => ({
    path: `SEBookSignatureCheck${i + 1}.hs`,
    source: `module SEBookSignatureCheck${i + 1} where\nsentinel = "student-owned"\n`,
  }));
  for (const file of existingFiles) await writeSource(page, file.source, file.path);
  const bad = await checkSignature(page, program('canAffordPizza :: Double -> Double -> Bool', { samples: '"9.50" "12.00"' }));
  expect(bad.exitCode).toBe(1);
  const corrected = await checkSignature(page, program('canAffordPizza :: Amount Double -> Amount Double -> Bool', { definitions: 'type Amount a = a' }));
  expect(corrected.exitCode, corrected.stderr || corrected.error).toBe(0);
  const falseExpression = await request(page, { type: 'runTest', path: 'Main.hs', expression: 'False', signature });
  expect(falseExpression.exitCode, 'matching type does not replace the Boolean command').toBe(1);
  const trueExpression = await request(page, { type: 'runTest', path: 'Main.hs', expression: 'True', signature });
  expect(trueExpression.exitCode, trueExpression.stderr || trueExpression.error).toBe(0);
  const behavior = await request(page, { type: 'runTest', path: 'Main.hs', expression: 'not (canAffordPizza 9.50 12.00)' });
  expect(behavior.exitCode, behavior.stderr || behavior.error).toBe(0);
  const run = await request(page, { type: 'run', path: 'Main.hs' });
  expect(run.exitCode, run.stderr || run.error).toBe(0);
  expect(run.stdout.trim()).toBe('False');
  for (const file of existingFiles) {
    const read = await request(page, { type: 'read', path: file.path });
    expect(read.type).toBe('read_ok');
    expect(read.content, `${file.path} remains unchanged`).toBe(file.source);
  }
});
