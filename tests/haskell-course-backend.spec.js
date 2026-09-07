// @ts-check
const { test, expect } = require('@playwright/test');

// Compiler integration tests use the documented frame-message protocol from
// js/haskell-worker.js. Only the test-owned host document is supplied here;
// the sandboxed adapter, compiler, Wasm, and libraries are the real site assets.
const HOST_PATH = '/__haskell_course_contract__';
const NAMESPACE = 'sebook-haskell-runtime';
const BOOT_TIMEOUT = 90_000;
const REQUEST_TIMEOUT = 30_000;

async function startRuntime(page) {
  await page.route(`**${HOST_PATH}`, (route) => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html lang="en"><title>Haskell contract host</title><body></body></html>',
  }));
  await page.goto(HOST_PATH);
  await page.evaluate((namespace) => {
    const messages = [];
    const frame = document.createElement('iframe');
    frame.title = 'Haskell runtime';
    frame.sandbox = 'allow-scripts';
    frame.src = '/haskell-runtime-frame.html';
    window.addEventListener('message', (event) => {
      if (event.source === frame.contentWindow && event.data?.namespace === namespace) {
        messages.push(event.data.message);
      }
    });
    window.haskellContract = { frame, messages, nextId: 0 };
    document.body.append(frame);
  }, NAMESPACE);
  await page.waitForFunction(() => window.haskellContract.messages.some(
    (message) => message.type === 'ready'
  ), null, { timeout: BOOT_TIMEOUT });
}

async function request(page, message) {
  const id = await page.evaluate(({ namespace, message }) => {
    const runtime = window.haskellContract;
    const id = ++runtime.nextId;
    runtime.frame.contentWindow.postMessage({ namespace, message: { ...message, id } }, '*');
    return id;
  }, { namespace: NAMESPACE, message });
  await page.waitForFunction((id) => window.haskellContract.messages.some(
    (message) => message.id === id
  ), id, { timeout: REQUEST_TIMEOUT });
  return page.evaluate((id) => window.haskellContract.messages.find(
    (message) => message.id === id
  ), id);
}

async function writeSource(page, content, path = 'Main.hs') {
  const result = await request(page, { type: 'write', path, content });
  expect(result.type, `workspace should accept ${path}`).toBe('write_ok');
}

async function expectProgramOutput(page, expected) {
  const result = await request(page, { type: 'run', path: 'Main.hs' });
  expect(result.exitCode, result.stderr || result.error).toBe(0);
  expect(result.stdout.trim()).toBe(expected);
  expect(result.stderr).toBe('');
}

const coursePrograms = [
  {
    name: 'typed expressions, tuples, guards, and mutual recursion',
    source: `module Main where
isEven 0 = True
isEven n = isOdd (n - 1)
isOdd 0 = False
isOdd n = isEven (n - 1)
category :: Int -> String
category n | n < 0 = "negative"
           | n == 0 = "zero"
           | otherwise = "positive"
average :: Fractional a => a -> a -> a
average x y = total / 2 where total = x + y
main :: IO ()
main = do
  print (map category [-1,0,1], isEven 0, isOdd 11)
  print (average (3 :: Double) 4, 10^30 :: Integer)
  print (snd (99, "abc"), 'c' : "at", drop 2 [1..5 :: Int])
`,
    output: '(["negative","zero","positive"],True,True)\n(3.5,1000000000000000000000000000000)\n("abc","cat",[3,4,5])',
  },
  {
    name: 'closures, shadowing, currying, composition, and fold direction',
    source: `module Main where
import Data.List (foldl')
factory offset = let shift x = x + offset in shift
shadow a b = let c = \\a -> a; d = \\c -> b in \\e z -> c d e
positive = (\\x y z -> x (z y)) (filter (> 0)) 7
main :: IO ()
main = do
  print ((sum . map (factory 3)) [1,2,3 :: Int])
  print (shadow 'a' 17 True 3, positive (\\n -> [n-8,n-7,n-6]))
  print (foldl (-) 0 [1,2,3 :: Int], foldr (-) 0 [1,2,3 :: Int])
  print (foldl' (+) 0 [1..1000 :: Int], map (*2) (filter odd [1..8 :: Int]))
`,
    output: '15\n(17,[1])\n(-6,2)\n(500500,[2,6,10,14])',
  },
  {
    name: 'polymorphic trees, records, Maybe, and constrained types',
    source: `module Main where
data Tree a = Empty | Node a [Tree a] deriving (Eq, Show)
flatten Empty = []
flatten (Node x children) = x : concatMap flatten children
data Color = Red | Blue deriving (Eq, Show)
data Shape = Circle {radius :: Float, color :: Color}
           | Rectangle {width :: Float, height :: Float, color :: Color}
           | Shapeless deriving Show
safeHead [] = Nothing
safeHead (x:_) = Just x
smaller :: Ord a => a -> a -> a
smaller x y = if x < y then x else y
main :: IO ()
main = do
  print (flatten (Node 1 [Empty,Node 2 [],Node 3 [Node 4 []]]))
  print (flatten (Node 'a' [Node 'b' []]), safeHead ([] :: [Int]))
  print (safeHead "hello", smaller "beta" "alpha")
  let original = Circle 2 Red
  print (color original, color (original {color = Blue}), radius original)
`,
    output: '[1,2,3,4]\n("ab",Nothing)\n(Just \'h\',"alpha")\n(Red,Blue,2.0)',
  },
  {
    name: 'lazy infinite lists and unused exceptional expressions',
    source: `module Main where
fibs :: [Integer]
fibs = 0 : 1 : zipWith (+) fibs (tail fibs)
factory x = let a = 0 in \\_ -> a + 1
main :: IO ()
main = do
  print (take 10 fibs)
  print (take 5 [x*x | x <- [1..], odd x])
  print (take 4 [(x,y) | x <- [1,2], y <- [1,2]])
  print (head (42 : undefined :: [Int]), factory (div 1 0) 0)
  print (foldr (\\x rest -> x == 3 || rest) False [1..])
`,
    output: '[0,1,1,2,3,5,8,13,21,34]\n[1,9,25,49,81]\n[(1,1),(1,2),(2,1),(2,2)]\n(42,1)\nTrue',
  },
];

test.describe('Haskell course language contract', () => {
  test.setTimeout(150_000);
  test.beforeEach(async ({ page }) => startRuntime(page));

  for (const program of coursePrograms) {
    test(`the browser executes ${program.name}`, async ({ page }) => {
      await writeSource(page, program.source);
      await expectProgramOutput(page, program.output);
    });
  }

  test('Boolean gates distinguish success, wrong answers, type errors, and exceptions', async ({ page }) => {
    await writeSource(page, 'module Main where\ndouble x = x * 2\nmain = print (double 3)\n');
    const expressions = [
      { expression: 'double 3 == 6 && double (-2) == -4', exitCode: 0 },
      { expression: 'double 3 == 3', exitCode: 1 },
      { expression: 'double True == 2', exitCode: 1 },
      { expression: 'head ([] :: [Int]) == 0', exitCode: 1 },
      { expression: 'double 0 == 0', exitCode: 0 },
    ];
    for (const check of expressions) {
      const result = await request(page, { type: 'runTest', path: 'Main.hs', expression: check.expression });
      expect(result.exitCode, check.expression).toBe(check.exitCode);
    }
    await expectProgramOutput(page, '6');
  });

  test('edited local modules are recompiled before the next execution', async ({ page }) => {
    await writeSource(page, 'module Course.Scores where\nboost = map (+1)\n', 'Course/Scores.hs');
    await writeSource(page, `module Main where
import Course.Scores
import Data.List (sort)
main = print (boost (sort [3,1,2 :: Int]))
`);
    await expectProgramOutput(page, '[2,3,4]');
    await writeSource(page, 'module Course.Scores where\nboost = map (*2)\n', 'Course/Scores.hs');
    await expectProgramOutput(page, '[2,4,6]');
  });
});
