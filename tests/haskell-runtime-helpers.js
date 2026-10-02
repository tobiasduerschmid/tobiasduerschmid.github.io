// @ts-check
const { expect } = require('@playwright/test');

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

module.exports = { startRuntime, request, writeSource };
