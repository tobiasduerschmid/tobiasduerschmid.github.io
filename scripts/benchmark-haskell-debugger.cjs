#!/usr/bin/env node
'use strict';

// Measure real demand tracing through the sandbox's public message protocol.
// Serve the revision under test first, then run:
// node scripts/benchmark-haskell-debugger.cjs --base-url http://127.0.0.1:4000 \
//   --iterations 3 --output /tmp/haskell-debugger.json
const { chromium } = require('playwright');
const { writeFile } = require('node:fs/promises');
const { parseArgs } = require('node:util');
const os = require('node:os');
const assert = require('node:assert/strict');

const NAMESPACE = 'sebook-haskell-runtime';
const HOST_PATH = '/__haskell_debugger_benchmark__';
const SOURCE = 'module Main where\nbump :: Int -> Int\nbump n = n + 1\nmain = print (map bump [1..150])\n';
const EXPECTED_OUTPUT = '[' + Array.from({ length: 150 }, (_, index) => index + 2).join(',') + ']\n';

async function measureSession(page) {
  await page.route(`**${HOST_PATH}`, route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html lang="en"><title>Haskell debugger benchmark</title><body></body></html>',
  }));
  await page.goto(HOST_PATH);
  return page.evaluate(({ namespace, source }) => new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.title = 'Haskell debugger benchmark';
    frame.sandbox = 'allow-scripts';
    frame.src = '/haskell-runtime-frame.html';
    const started = performance.now();
    let runStarted, continued, bootMs, startMs;
    let stdout = '', stderr = '', events = 0;
    const timer = setTimeout(() => reject(new Error('Debugger benchmark timed out')), 90_000);
    const send = message => frame.contentWindow.postMessage({ namespace, message }, '*');
    window.addEventListener('message', event => {
      if (event.source !== frame.contentWindow || event.data?.namespace !== namespace) return;
      const message = event.data.message;
      events += message.snapshots?.length || 0;
      if (message.type === 'ready') {
        bootMs = performance.now() - started;
        runStarted = performance.now();
        send({ type: 'start', filename: '/tutorial/Main.hs', code: source, files: {} });
      } else if (message.type === 'paused') {
        if (continued !== undefined) {
          clearTimeout(timer);
          reject(new Error('Continue unexpectedly paused without a breakpoint'));
          return;
        }
        startMs = performance.now() - runStarted;
        continued = performance.now();
        send({ type: 'command', command: 1 });
      } else if (message.type === 'stdout') stdout += message.text;
      else if (message.type === 'stderr') stderr += message.text;
      else if (message.type === 'debugComplete') {
        clearTimeout(timer);
        resolve({ bootMs, startMs, continueMs: performance.now() - continued,
          events, stdout, stderr, exitCode: message.exitCode, error: message.error });
      } else if (message.type === 'error') {
        clearTimeout(timer);
        reject(new Error(message.message));
      }
    });
    document.body.append(frame);
  }), { namespace: NAMESPACE, source: SOURCE });
}

async function main() {
  const { values } = parseArgs({ options: {
    'base-url': { type: 'string', default: 'http://127.0.0.1:4000' },
    iterations: { type: 'string', default: '3' },
    output: { type: 'string' },
  } });
  const iterations = Number(values.iterations);
  if (!Number.isInteger(iterations) || iterations < 1) throw new Error('--iterations must be a positive integer');
  const browser = await chromium.launch();
  const records = [];
  try {
    for (let sample = 0; sample < iterations; sample += 1) {
      const context = await browser.newContext({ baseURL: values['base-url'] });
      try {
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const result = await measureSession(page);
        assert.equal(result.exitCode, 0, result.error || result.stderr);
        assert.equal(result.stdout, EXPECTED_OUTPUT);
        assert.equal(result.stderr, '');
        assert.equal(result.events, 302);
        assert.deepEqual(errors, []);
        records.push({ sample, bootMs: result.bootMs, startMs: result.startMs,
          continueMs: result.continueMs, events: result.events });
        process.stderr.write(`Continue ${result.continueMs.toFixed(1)} ms (${result.events} demand events)\n`);
      } finally { await context.close(); }
    }
    const samples = records.map(record => record.continueMs).toSorted((a, b) => a - b);
    const middle = Math.floor(samples.length / 2);
    const report = {
      measuredAt: new Date().toISOString(), browser: browser.version(),
      platform: `${os.platform()} ${os.arch()}`, cpu: os.cpus()[0]?.model,
      baseURL: values['base-url'], source: SOURCE,
      note: 'Fresh sandbox and browser context per sample; localhost delivery; Continue measured from first pause to completion; real compiler and unmodified vendor runtime; no UI or network throttling.',
      medianContinueMs: samples.length % 2 ? samples[middle] : (samples[middle - 1] + samples[middle]) / 2,
      records,
    };
    const json = JSON.stringify(report, null, 2) + '\n';
    if (values.output) await writeFile(values.output, json);
    process.stdout.write(json);
  } finally { await browser.close(); }
}

main().catch(error => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
