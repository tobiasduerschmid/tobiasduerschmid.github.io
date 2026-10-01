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
  await page.waitForFunction(({ type, cursor }) => window.haskellDebugContract.messages.slice(cursor).some(message => message.type === type), { type, cursor }, { timeout: 30_000 });
  return page.evaluate(({ type, cursor }) => window.haskellDebugContract.messages.slice(cursor).find(message => message.type === type), { type, cursor });
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
    expect(recursion.stack.at(-1).locals.n.repr).toContain('not inspected');
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
    expect(snapshots.filter(snapshot => snapshot.event === 'call' && snapshot.line === 3)).toHaveLength(3);
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
    const calls = messages.filter(message => message.snapshots).flatMap(message => message.snapshots).filter(snapshot => snapshot.event === 'call');
    expect(calls.some(snapshot => snapshot.file === '/tutorial/Main.hs' && snapshot.line === 3)).toBe(false);
    expect(calls.some(snapshot => snapshot.file === '/tutorial/Helpers.hs' && snapshot.line === 5)).toBe(true);
    expect(calls.some(snapshot => snapshot.file === '/tutorial/Helpers.hs' && snapshot.line === 6)).toBe(false);
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
