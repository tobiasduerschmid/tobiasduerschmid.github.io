// @ts-check
const { test, expect } = require('@playwright/test');
const { startRuntime, request, writeSource } = require('./haskell-runtime-helpers');

// These are semantic compiler regressions, not cache implementation tests.
// The real sandboxed compiler must preserve fresh evaluation and current source
// regardless of how much parsing, type checking, or import work it reuses.
test.setTimeout(120_000); // Real compiler boot plus sequential state transitions.
test.beforeEach(async ({ page }) => startRuntime(page));

function evaluate(page, expression, path = 'Main.hs') {
  return request(page, { type: 'evaluate', path, expression, silent: true });
}

function expectOutput(result, output) {
  expect(result.type).toBe('run_done');
  expect(result.exitCode, result.stderr || result.error).toBe(0);
  expect(result.stderr).toBe('');
  expect(result.stdout.trim()).toBe(output);
}

function checkSignature(page, type) {
  return request(page, {
    type: 'runTest', path: 'Main.hs', expression: 'True',
    signature: { name: 'answer', type }, silent: true,
  });
}

test('repeated interpreter commands start with fresh top-level mutable state', async ({ page }) => {
  await writeSource(page, `module Main where
import Data.IORef
import System.IO.Unsafe (unsafePerformIO)
counter :: IORef Int
counter = unsafePerformIO (newIORef 0)
bump :: IO ()
bump = do
  modifyIORef counter (+1)
  readIORef counter >>= print
`);

  expectOutput(await evaluate(page, 'bump'), '1');
  expectOutput(await evaluate(page, 'bump'), '1');
  expectOutput(await evaluate(page, ':type bump'), 'IO ()');
  expectOutput(await evaluate(page, 'bump'), '1');
});

test('same-content editor synchronization preserves behavior and later dependency edits take effect', async ({ page }) => {
  const main = 'module Main where\nimport qualified Middle\nanswer = Middle.value + 1\n';
  const middle = 'module Middle where\nimport qualified Bonus\nvalue = Bonus.bonus * 2\n';
  await writeSource(page, main);
  await writeSource(page, middle, 'Middle.hs');
  await writeSource(page, 'module Bonus where\nbonus = 3\n', 'Bonus.hs');
  expectOutput(await evaluate(page, 'answer'), '7');

  await writeSource(page, main);
  await writeSource(page, middle, 'Middle.hs');
  await writeSource(page, 'module Bonus where\nbonus = 3\n', 'Bonus.hs');
  expectOutput(await evaluate(page, 'answer'), '7');

  await writeSource(page, 'module Bonus where\nbonus = 8\n', 'Bonus.hs');
  expectOutput(await evaluate(page, 'answer'), '17');
  expectOutput(await evaluate(page, 'answer'), '17');
});

test('source changes made by Haskell IO are observed by the next interpreter command', async ({ page }) => {
  await writeSource(page, 'module Main where\nimport qualified Middle\nanswer = Middle.value + 1\n');
  await writeSource(page, 'module Middle where\nimport qualified Bonus\nvalue = Bonus.bonus * 2\n', 'Middle.hs');
  await writeSource(page, 'module Bonus where\nbonus = 3\n', 'Bonus.hs');
  expectOutput(await evaluate(page, 'answer'), '7');

  const edited = 'module Bonus where\nbonus = 8\n';
  expectOutput(await evaluate(page,
    `writeFile "/tutorial/Bonus.hs" ${JSON.stringify(edited)} >> putStrLn "updated"`), 'updated');

  // No host write intervenes: mutation tracking must include the program's IO.
  expectOutput(await evaluate(page, 'answer'), '17');
  expectOutput(await evaluate(page, 'answer'), '17');
});

test('repeated headerless expressions follow edits and module switches without retaining old definitions', async ({ page }) => {
  await writeSource(page, 'answer :: Int\nanswer = 3\n');
  expectOutput(await evaluate(page, 'answer'), '3');
  expectOutput(await evaluate(page, 'answer + 1'), '4');

  await writeSource(page, 'answer :: Int\nanswer = 8\n');
  expectOutput(await evaluate(page, 'answer'), '8');
  expectOutput(await evaluate(page, 'answer + 1'), '9');

  await writeSource(page, 'answer :: Int\nanswer = True\n');
  expect((await evaluate(page, 'answer')).exitCode).toBe(1);
  await writeSource(page, 'answer :: Int\nanswer = 8\n');
  expectOutput(await evaluate(page, 'answer'), '8');

  await writeSource(page, 'module Other where\nanswer = 12\n', 'Other.hs');
  expectOutput(await evaluate(page, 'answer', 'Other.hs'), '12');
  expectOutput(await evaluate(page, 'answer'), '8');

  const explicit = 'module Main where\nanswer = 21\n';
  await writeSource(page, explicit);
  expectOutput(await evaluate(page, 'answer'), '21');
  const source = await request(page, { type: 'read', path: 'Main.hs' });
  expect(source.type).toBe('read_ok');
  expect(source.content).toBe(explicit);
});

test('signature checks follow their requested type and recover from changed source errors', async ({ page }) => {
  await writeSource(page, 'module Main where\nanswer :: Int\nanswer = 42\n');
  expectOutput(await checkSignature(page, 'Int'), '');
  expectOutput(await checkSignature(page, 'Int'), '');
  expect((await checkSignature(page, 'Double')).exitCode).toBe(1);
  expectOutput(await checkSignature(page, 'Int'), '');

  await writeSource(page, 'module Main where\nanswer :: Double\nanswer = 42\n');
  expectOutput(await checkSignature(page, 'Double'), '');
  expectOutput(await checkSignature(page, 'Double'), '');

  await writeSource(page, 'module Main where\nanswer :: Double\nanswer = True\n');
  const invalid = await checkSignature(page, 'Double');
  expect(invalid.exitCode).toBe(1);
  expect(invalid.stderr || invalid.error).toMatch(/Bool|Double|type/i);

  await writeSource(page, 'module Main where\nanswer :: Double\nanswer = 17\n');
  expectOutput(await checkSignature(page, 'Double'), '');
  expectOutput(await evaluate(page, 'answer == 17'), 'True');
});

test('interpreter scopes and signature checks preserve learner modules with helper-like names', async ({ page }) => {
  const files = ['SEBookExpressionScope', 'SEBookSignatureCheck'].flatMap(prefix =>
    ['', '1', '2', '3', '4', '5', '6'].map(suffix => {
      const moduleName = prefix + suffix;
      return {
        path: `${moduleName}.hs`,
        content: `module ${moduleName} where\nsentinel = "student-owned ${moduleName}"\n`,
      };
    }));
  for (const file of files) await writeSource(page, file.content, file.path);
  await writeSource(page, 'answer :: Int\nanswer = 42\n');
  expectOutput(await evaluate(page, 'answer'), '42');
  expectOutput(await evaluate(page, 'answer + 1'), '43');

  await writeSource(page, 'module Main where\nanswer :: Int\nanswer = 42\n');
  expectOutput(await checkSignature(page, 'Int'), '');
  expectOutput(await checkSignature(page, 'Int'), '');
  expectOutput(await evaluate(page, 'answer'), '42');

  for (const file of files) {
    const preserved = await request(page, { type: 'read', path: file.path });
    expect(preserved.type, `${file.path} must still exist`).toBe('read_ok');
    expect(preserved.content, `${file.path} remains learner-owned`).toBe(file.content);
  }
});

test('files rewritten by learner IO remain learner-owned during later evaluation and scope cleanup', async ({ page }) => {
  await writeSource(page, `import qualified System.Directory as D
answer :: Int
answer = 42
claimFiles :: IO ()
claimFiles = do
  names <- D.listDirectory "/tutorial"
  let others = filter (/= "Main.hs") names
  mapM_ (\\name -> writeFile ("/tutorial/" ++ name) ("-- learner-owned " ++ name ++ "\\n")) others
  print others
`);

  // Discover files using the same public filesystem API as learner programs.
  // No assertion depends on the adapter's choice of private filename or count.
  const claimed = await evaluate(page, 'claimFiles');
  expect(claimed.exitCode, claimed.stderr || claimed.error).toBe(0);
  const firstFiles = JSON.parse(claimed.stdout.trim());
  expectOutput(await evaluate(page, 'answer'), '42');
  for (const path of firstFiles) {
    const preserved = await request(page, { type: 'read', path });
    expect(preserved.type, `${path} must survive another evaluation`).toBe('read_ok');
    expect(preserved.content).toBe(`-- learner-owned ${path}\n`);
  }

  // Claim again, then switch modules so deferred cleanup is exercised as well.
  const reclaimed = await evaluate(page, 'claimFiles');
  expect(reclaimed.exitCode, reclaimed.stderr || reclaimed.error).toBe(0);
  const finalFiles = JSON.parse(reclaimed.stdout.trim());
  await writeSource(page, 'module Main where\nanswer = 9\n');
  expectOutput(await evaluate(page, 'answer'), '9');
  for (const path of finalFiles) {
    const preserved = await request(page, { type: 'read', path });
    expect(preserved.type, `${path} must survive a module switch`).toBe('read_ok');
    expect(preserved.content).toBe(`-- learner-owned ${path}\n`);
  }
});
