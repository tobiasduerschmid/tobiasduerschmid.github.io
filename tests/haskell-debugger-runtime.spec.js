// @ts-check
const { test, expect } = require('@playwright/test');

// Integration-level contract: real sandboxed adapter/compiler, observed only
// through its public message protocol. The host document is test-owned.
const HOST_PATH = '/__haskell_debugger_contract__';
const NAMESPACE = 'sebook-haskell-runtime';

async function startRuntime(page) {
  await page.route(`**${HOST_PATH}`, route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html lang="en"><title>Haskell debugger contract</title><body></body></html>',
  }));
  await page.goto(HOST_PATH);
  await page.evaluate(namespace => {
    const frame = document.createElement('iframe');
    frame.title = 'Haskell runtime';
    frame.sandbox = 'allow-scripts';
    frame.src = '/haskell-runtime-frame.html';
    const messages = [];
    window.addEventListener('message', event => {
      if (event.source === frame.contentWindow && event.data?.namespace === namespace) {
        messages.push(event.data.message);
      }
    });
    window.haskellDebugContract = { frame, messages };
    document.body.append(frame);
  }, NAMESPACE);
  await page.waitForFunction(() => window.haskellDebugContract.messages.some(message => message.type === 'ready'), null, { timeout: 90_000 });
}

async function send(page, message) {
  return page.evaluate(({ namespace, message }) => {
    const host = window.haskellDebugContract;
    const cursor = host.messages.length;
    host.frame.contentWindow.postMessage({ namespace, message }, '*');
    return cursor;
  }, { namespace: NAMESPACE, message });
}

async function waitForMessage(page, type, cursor = 0) {
  await page.waitForFunction(({ type, cursor }) => window.haskellDebugContract.messages.slice(cursor).some(message => message.type === type || (type === 'paused' && message.type === 'debugComplete')), { type, cursor }, { timeout: 30_000 });
  const result = await page.evaluate(({ type, cursor }) => window.haskellDebugContract.messages.slice(cursor).find(message => message.type === type || (type === 'paused' && message.type === 'debugComplete')), { type, cursor });
  expect(result.type, result.error || 'runtime response').toBe(type);
  return result;
}

async function startDebug(page, code, options = {}) {
  return send(page, { type: 'start', filename: '/tutorial/Main.hs', code, files: {}, ...options });
}

async function command(page, value, response = 'paused') {
  const cursor = await send(page, { type: 'command', command: value });
  return waitForMessage(page, response, cursor);
}

async function allMessages(page) {
  return page.evaluate(() => window.haskellDebugContract.messages);
}

function lastSnapshot(message) { return message.snapshots[message.snapshots.length - 1]; }

test.describe('Haskell live demand debugger', () => {
  test.setTimeout(150_000);
  test.beforeEach(async ({ page }) => startRuntime(page));

  for (const type of ['run', 'runTest', 'start']) {
    test(`${type} rejects a demanded alias cycle before compiling or evaluating`, async ({ page }) => {
      // The unrelated undefined name is a safety backstop: a missing preflight
      // produces a compiler error instead of executing a browser-freezing loop.
      const code = 'module Main where\nbad = bad\nbackstop = missingCycleTestName\nmain = print (bad :: Int)\n';
      const written = await send(page, { type: 'write', id: 1, path: '/tutorial/Main.hs', content: code });
      await waitForMessage(page, 'write_ok', written);
      const cursor = await send(page, { type, id: 2, path: '/tutorial/Main.hs', filename: '/tutorial/Main.hs', code,
        expression: 'bad == (1 :: Int)' });
      const response = await waitForMessage(page, type === 'start' ? 'debugComplete' : 'run_done', cursor);
      expect(response.exitCode).toBe(1);
      expect(response.error).toContain('Execution blocked');
      expect(response.error).toContain('Main.hs:2');
    });
  }

  test('explains equation selection, recursive arguments, and if decisions without forcing previews', async ({ page }) => {
    await startDebug(page, `module Main where
countAtLeast :: Int -> [Int] -> Int
countAtLeast threshold [] = 0
countAtLeast threshold (x:xs) = contribution + countAtLeast threshold xs
  where contribution = if x >= threshold then 1 else 0
joinRows :: [[Int]] -> [Int]
joinRows [] = []
joinRows (row:rows) = row ++ joinRows rows
main :: IO ()
main = print (countAtLeast 60 [60,59,60])
`);
    await waitForMessage(page, 'paused');
    const complete = await command(page, 1, 'debugComplete');
    expect(complete.exitCode, complete.error).toBe(0);
    const messages = await allMessages(page);
    expect(messages.filter(m => m.type === 'stdout').map(m => m.text).join('')).toBe('2\n');
    const trace = messages.flatMap(m => m.snapshots || []);
    const calls = trace.filter(s => s.event === 'call' && s.stack.at(-1).function === 'countAtLeast');
    expect(calls).toHaveLength(4);
    const firstCall = trace.filter(s => s.call_id === calls[0].call_id);
    expect(firstCall.filter(s => ['try', 'reject', 'select'].includes(s.event)).map(s => [s.event, s.line]))
      .toEqual([['try', 3], ['reject', 3], ['try', 4], ['select', 4]]);
    const returned = trace.filter(s => s.event === 'return' && s.stack.at(-1).function === 'countAtLeast');
    expect(returned.map(s => s.return_value.repr)).toEqual(['0', '1', '1', '2']);
    expect(returned.map(s => s.stack.at(-1).arguments[1].repr)).toEqual(['[]', '[60]', '[59, 60]', '[60, 59, 60]']);
    expect(returned.at(-1).stack.at(-1).locals.threshold.repr).toBe('60');
    expect(returned.at(-1).stack.at(-1).locals.x.repr).toBe('60');
    expect(returned.at(-1).stack.at(-1).locals.xs.repr).toBe('[59, 60]');
    expect(trace.filter(s => s.event === 'true' || s.event === 'false').map(s => s.event)).toEqual(['true', 'false', 'true']);
    // Earlier snapshots must not acquire values learned later in the run.
    expect(calls[0].stack.at(-1).arguments.map(a => a.repr)).toEqual(['_', '_']);
  });

  test('records an early catch-all and never claims that later equations were tried', async ({ page }) => {
    await startDebug(page, `module Main where
count :: [Int] -> Int
count _ = 0
count (x:xs) = 1 + count xs
main = print (count (error "unused list"))
`);
    await waitForMessage(page, 'paused');
    const complete = await command(page, 1, 'debugComplete');
    expect(complete.exitCode, complete.error).toBe(0);
    const trace = (await allMessages(page)).flatMap(m => m.snapshots || []);
    const result = trace.find(s => s.event === 'return' && s.stack.at(-1).function === 'count');
    expect(result.return_value.repr).toBe('0');
    expect(result.stack.at(-1).arguments[0].repr).toBe('_');
    expect(result.stack.at(-1).equations.map(e => e.status)).toEqual(['selected', 'not reached']);
  });

  test('observes only demanded fields of typed lists, tuples, and optional values', async ({ page }) => {
    await startDebug(page, `module Main where
ignore :: Int -> Int
ignore _ = 7
first :: [Int] -> Int
first (x:_) = x
left :: (Int,Int) -> Int
left (x,_) = x
present :: Maybe Int -> Bool
present Nothing = False
present (Just _) = True
ones :: [Int]
ones = 1 : ones
main = print (ignore (error "unused"), first (9 : error "tail"), left (5, error "right"), present (Just (error "inside")), take 3 ones)
`);
    await waitForMessage(page, 'paused');
    const complete = await command(page, 1, 'debugComplete');
    expect(complete.exitCode, complete.error).toBe(0);
    const messages = await allMessages(page);
    expect(messages.filter(m => m.type === 'stdout').map(m => m.text).join('')).toBe('(7,9,5,True,[1,1,1])\n');
    const returns = messages.flatMap(m => m.snapshots || []).filter(s => s.event === 'return');
    expect(returns.find(s => s.stack.at(-1).function === 'first').stack.at(-1).arguments[0].repr).toBe('9 : _');
    expect(returns.find(s => s.stack.at(-1).function === 'left').stack.at(-1).arguments[0].repr).toBe('(5, _)');
    expect(returns.find(s => s.stack.at(-1).function === 'present').stack.at(-1).arguments[0].repr).toBe('Just (_)');
  });

  test('records false guards before a later guard succeeds and preserves where scope', async ({ page }) => {
    await startDebug(page, `module Main where
choose :: Int -> [Int] -> Int
choose cutoff (x:xs)
  | x < cutoff = x
  | otherwise = replacement
  where replacement = 99
choose _ [] = 0
main = print (choose 10 [20])
`);
    await waitForMessage(page, 'paused');
    const complete = await command(page, 1, 'debugComplete');
    expect(complete.exitCode, complete.error).toBe(0);
    const messages = await allMessages(page);
    expect(messages.filter(m => m.type === 'stdout').map(m => m.text).join('')).toBe('99\n');
    const trace = messages.flatMap(m => m.snapshots || []);
    expect(trace.filter(s => ['true', 'false'].includes(s.event)).map(s => [s.event, s.line])).toEqual([['false', 4], ['true', 5]]);
    const result = trace.find(s => s.event === 'return' && s.stack.at(-1).function === 'choose');
    expect(result.stack.at(-1).equations.map(e => e.status)).toEqual(['selected', 'not reached']);
    expect(result.return_value.repr).toBe('99');
  });

  test('preserves polymorphic functions, custom types, records, and literal patterns', async ({ page }) => {
    await startDebug(page, `module Main where
import Prelude hiding (Int)
import qualified Prelude
data Int = Count Bool
data Record = Record { item :: Bool }
identity :: a -> a
identity x = x
adder :: Prelude.Int -> Prelude.Int -> Prelude.Int
adder x = (x +)
constantFunction :: Prelude.Int -> Prelude.Int
constantFunction = adder 1
unwrap :: Int -> Bool
unwrap (Count value) = value
field Record{item = flag} = flag
label "yes" = True
label _ = False
main = print (identity (unwrap (Count True)), field (Record False), label "no", constantFunction 4)
`);
    await waitForMessage(page, 'paused');
    const complete = await command(page, 1, 'debugComplete');
    expect(complete.exitCode, complete.error).toBe(0);
    const messages = await allMessages(page);
    expect(messages.filter(m => m.type === 'stdout').map(m => m.text).join('')).toBe('(True,False,False,5)\n');
  });

  test('labels a delayed condition with its captured call and keeps earlier partial results intact', async ({ page }) => {
    await startDebug(page, `module Main where
scores :: Int -> [Int] -> [Int]
scores cutoff xs = [if x >= cutoff then x else 0 | x <- xs]
main = print (scores 60 [60,59,60])
`);
    await waitForMessage(page, 'paused');
    const complete = await command(page, 1, 'debugComplete');
    expect(complete.exitCode, complete.error).toBe(0);
    const messages = await allMessages(page);
    expect(messages.filter(m => m.type === 'stdout').map(m => m.text).join('')).toBe('[60,0,60]\n');
    const trace = messages.flatMap(m => m.snapshots || []);
    const returned = trace.find(s => s.event === 'return' && s.stack.at(-1).function === 'scores');
    expect(returned.return_value.repr).toBe('_ : _');
    const decisions = trace.filter(s => ['true', 'false'].includes(s.event));
    expect(decisions.map(s => s.event)).toEqual(['true', 'false', 'true']);
    expect(decisions.every(s => s.deferred && s.call_id === returned.call_id)).toBe(true);
    expect(decisions.at(-1).stack.at(-1).arguments[0].repr).toBe('60');
  });

  test('pauses recursive evaluation at original source lines and steps out of the live demand stack', async ({ page }) => {
    await startDebug(page, `module Main where
fac 0 = 1
fac n = n * fac (n - 1)
main = print (fac 3)
`, { breakpoints: [{ file: '/tutorial/Main.hs', line: 3 }] });
    const initial = lastSnapshot(await waitForMessage(page, 'paused'));
    expect(initial.file).toBe('/tutorial/Main.hs');
    expect(initial.line).toBe(4);
    expect(initial.event).toBe('call');
    expect((await allMessages(page)).some(message => message.type === 'debugComplete')).toBe(false);
    const recursion = lastSnapshot(await command(page, 1));
    expect(recursion.line).toBe(3);
    expect(recursion.stack.at(-1).function).toBe('fac');
    expect(recursion.stack.at(-1).locals.n.repr).toContain('evaluated');
    await send(page, { type: 'breakpoints', changes: [{ op: 'remove', file: '/tutorial/Main.hs', line: 3 }] });
    const returned = lastSnapshot(await command(page, 4));
    expect(returned.event).toBe('return');
    expect(returned.call_id).toBe(recursion.call_id);
    const complete = await command(page, 1, 'debugComplete');
    expect(complete.exitCode).toBe(0);
    const messages = await allMessages(page);
    expect(messages.filter(message => message.type === 'stdout').map(message => message.text).join('')).toBe('6\n');
    const snapshots = messages.filter(message => message.snapshots).flatMap(message => message.snapshots);
    expect(Math.max(...snapshots.map(snapshot => snapshot.depth))).toBe(4);
    expect(snapshots.filter(snapshot => snapshot.event === 'select' && snapshot.line === 3)).toHaveLength(3);
  });

  test('keeps infinite lists and unused exceptional arguments lazy while tracing imported guards', async ({ page }) => {
    await startDebug(page, `module Main where
import Helpers
unused = error "must remain unevaluated"
main = print (safe (error "unused argument"), take 4 ones, category (-2))
`, { files: { '/tutorial/Helpers.hs': `module Helpers where
safe x = 42
ones = 1 : ones
category n
  | n < 0 = "negative"
  | otherwise = "positive"
` } });
    await waitForMessage(page, 'paused');
    const complete = await command(page, 1, 'debugComplete');
    expect(complete.exitCode, complete.error).toBe(0);
    const messages = await allMessages(page);
    expect(messages.filter(message => message.type === 'stdout').map(message => message.text).join('')).toBe('(42,[1,1,1,1],"negative")\n');
    const calls = messages.filter(message => message.snapshots).flatMap(message => message.snapshots).filter(snapshot => snapshot.event === 'select');
    expect(calls.some(snapshot => snapshot.file === '/tutorial/Main.hs' && snapshot.line === 3)).toBe(false);
    expect(calls.some(snapshot => snapshot.file === '/tutorial/Helpers.hs' && snapshot.line === 5)).toBe(true);
    expect(calls.some(snapshot => snapshot.file === '/tutorial/Helpers.hs' && snapshot.line === 6)).toBe(false);
  });

  test('pauses and resumes a deep recursive demand without exhausting its continuation buffer', async ({ page }) => {
    await startDebug(page, `module Main where
count :: Int -> Int
count 0 = 0
count n = 1 + count (n - 1)
main = print (count 150)
`, { breakpoints: [{ file: '/tutorial/Main.hs', line: 3 }] });
    await waitForMessage(page, 'paused');
    const baseCase = lastSnapshot(await command(page, 1));
    expect(baseCase.line).toBe(3);
    expect(baseCase.depth).toBe(151);
    const returned = lastSnapshot(await command(page, 4));
    expect(returned.event).toBe('return');
    expect(returned.call_id).toBe(baseCase.call_id);
    const complete = await command(page, 1, 'debugComplete');
    expect(complete.exitCode, complete.error).toBe(0);
    const messages = await allMessages(page);
    expect(messages.filter(message => message.type === 'stdout').map(message => message.text).join('')).toBe('150\n');
    expect(messages.filter(message => message.type === 'stderr').map(message => message.text).join('')).toBe('');
  });

  test('preserves arguments, Unicode output without a newline, and separate stderr', async ({ page }) => {
    await startDebug(page, `module Main where
import System.Environment (getArgs)
import System.IO (hPutStr, stderr)
main = do
  args <- getArgs
  print args
  hPutStr stderr "diagnostic λ"
  putStr "café λ 🎵"
`, { args: ['first', 'two words'] });
    await waitForMessage(page, 'paused');
    const complete = await command(page, 1, 'debugComplete');
    expect(complete.exitCode, complete.error).toBe(0);
    const messages = await allMessages(page);
    expect(messages.filter(message => message.type === 'stdout').map(message => message.text).join('')).toBe('["first","two words"]\ncafé λ 🎵\n');
    expect(messages.filter(message => message.type === 'stderr').map(message => message.text).join('')).toBe('diagnostic λ\n');
  });

  test('preserves inline do and let layout and same-line module bodies', async ({ page }) => {
    await startDebug(page, `module Main where
import Inline
value = let x = 1
            y = 2
        in x + y
main = do putStrLn "A"
          print (value, answer)
`, { files: { '/tutorial/Inline.hs': 'module Inline where answer = 42' } });
    await waitForMessage(page, 'paused');
    const complete = await command(page, 1, 'debugComplete');
    expect(complete.exitCode, complete.error).toBe(0);
    const messages = await allMessages(page);
    expect(messages.filter(message => message.type === 'stdout').map(message => message.text).join('')).toBe('A\n(3,42)\n');
  });

  test('preserves Haskell tab-stop layout without changing literal tab characters', async ({ page }) => {
    await startDebug(page, 'module Main where\n\tmain\t= do putStr "a\tb"\n\t\t     print (7 :: Int)\n');
    await waitForMessage(page, 'paused');
    const complete = await command(page, 1, 'debugComplete');
    expect(complete.exitCode, complete.error).toBe(0);
    const messages = await allMessages(page);
    expect(messages.filter(message => message.type === 'stdout').map(message => message.text).join('')).toBe('a\tb7\n');
  });

  test('publishes output produced before a breakpoint without repeating it on completion', async ({ page }) => {
    await startDebug(page, `module Main where
import System.IO (hPutStr, stderr)
value = 42
main = do
  putStr "before "
  hPutStr stderr "diagnostic "
  print value
`, { breakpoints: [{ file: '/tutorial/Main.hs', line: 3 }] });
    await waitForMessage(page, 'paused');
    const pause = lastSnapshot(await command(page, 1));
    expect(pause.line).toBe(3);
    const pausedMessages = await allMessages(page);
    expect(pausedMessages.filter(message => message.type === 'stdout').map(message => message.text).join('')).toBe('before ');
    expect(pausedMessages.filter(message => message.type === 'stderr').map(message => message.text).join('')).toBe('diagnostic ');
    await command(page, 1, 'debugComplete');
    const messages = await allMessages(page);
    expect(messages.filter(message => message.type === 'stdout').map(message => message.text).join('')).toBe('before 42\n');
    expect(messages.filter(message => message.type === 'stderr').map(message => message.text).join('')).toBe('diagnostic \n');
  });

  test('continuing through many demands records every call and still pauses at the next breakpoint', async ({ page }) => {
    await startDebug(page, `module Main where
import System.IO (hPutStrLn, stderr)
bump :: Int -> Int
bump n = n + 1
answer = 999
main = do
  hPutStrLn stderr "before the trace"
  print (map bump [1..150])
  print answer
`, { breakpoints: [{ file: '/tutorial/Main.hs', line: 5 }] });
    await waitForMessage(page, 'paused');
    const pause = lastSnapshot(await command(page, 1));
    expect(pause.line).toBe(5);
    expect(pause.event).toBe('select');
    const pausedMessages = await allMessages(page);
    const demands = pausedMessages.flatMap(message => message.snapshots || [])
      .filter(snapshot => snapshot.line === 4);
    expect(demands.filter(snapshot => snapshot.event === 'select')).toHaveLength(150);
    expect(demands.filter(snapshot => snapshot.event === 'return')).toHaveLength(150);
    const listOutput = '[' + Array.from({ length: 150 }, (_, index) => index + 2).join(',') + ']\n';
    expect(pausedMessages.filter(message => message.type === 'stdout').map(message => message.text).join('')).toBe(listOutput);
    expect(pausedMessages.filter(message => message.type === 'stderr').map(message => message.text).join('')).toBe('before the trace\n');

    const complete = await command(page, 1, 'debugComplete');
    expect(complete.exitCode, complete.error).toBe(0);
    const messages = await allMessages(page);
    expect(messages.filter(message => message.type === 'stdout').map(message => message.text).join('')).toBe(listOutput + '999\n');
    expect(messages.filter(message => message.type === 'stderr').map(message => message.text).join('')).toBe('before the trace\n');
  });

  test('continuing stops exactly at the configured history limit', async ({ page }) => {
    await startDebug(page, `module Main where
bump :: Int -> Int
bump n = n + 1
main = print (map bump [1..20])
`, { options: { max_history: 8 } });
    await waitForMessage(page, 'paused');
    const complete = await command(page, 1, 'debugComplete');
    expect(complete.exitCode).toBe(1);
    expect(complete.error).toMatch(/history limit/i);
    const messages = await allMessages(page);
    expect(messages.filter(message => message.type === 'capReached')).toHaveLength(1);
    expect(messages.flatMap(message => message.snapshots || [])).toHaveLength(8);
  });

  test('reports compilation errors as completed debug sessions', async ({ page }) => {
    await startDebug(page, 'module Main where\nmain = print unknownValue\n');
    const complete = await waitForMessage(page, 'debugComplete');
    expect(complete.exitCode).toBe(1);
    expect(complete.error).toMatch(/undefined value.*unknownValue/i);
    expect(complete.error).toMatch(/Main\.hs": line 2,/);
    expect(complete.errorReported).toBe(true);
  });

  test('reports runtime exceptions without waiting forever for a completion marker', async ({ page }) => {
    await startDebug(page, 'module Main where\nmain = print (head ([] :: [Int]))\n');
    await waitForMessage(page, 'paused');
    const complete = await command(page, 1, 'debugComplete');
    expect(complete.exitCode).toBe(1);
    expect(complete.error).toMatch(/head|empty|Exception/i);
  });
});
