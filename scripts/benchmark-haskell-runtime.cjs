#!/usr/bin/env node
'use strict';

// Measures the real sandbox-frame protocol, including compiler work and message
// delivery, without the tutorial UI, polling, network throttling, or mocked Wasm.
// Serve the site first; source JS assets must reflect the revision being measured.
// node scripts/benchmark-haskell-runtime.cjs --base-url http://127.0.0.1:4018 \
//   --iterations 3 --output /tmp/haskell-runtime.json
const { chromium } = require('playwright');
const { writeFile } = require('node:fs/promises');
const { parseArgs } = require('node:util');
const os = require('node:os');

const NAMESPACE = 'sebook-haskell-runtime';
const HOST_PATH = '/__haskell_benchmark__';
const REQUEST_TIMEOUT_MS = 90_000;

function optionsFromArguments() {
  const { values } = parseArgs({ options: {
    'base-url': { type: 'string', default: 'http://127.0.0.1:4000' },
    iterations: { type: 'string', default: '3' },
    output: { type: 'string' },
  } });
  const iterations = Number(values.iterations);
  if (!Number.isInteger(iterations) || iterations < 1) {
    throw new Error('--iterations must be a positive integer');
  }
  return { baseURL: values['base-url'], iterations, output: values.output };
}

async function bootRuntime(page) {
  await page.route(`**${HOST_PATH}`, route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html lang="en"><title>Haskell latency benchmark</title><body></body></html>',
  }));
  await page.goto(HOST_PATH);
  return page.evaluate(({ namespace, timeoutMs }) => new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.title = 'Haskell runtime benchmark';
    frame.sandbox = 'allow-scripts';
    frame.src = '/haskell-runtime-frame.html';
    const pending = new Map();
    const started = performance.now();
    const timer = setTimeout(() => reject(new Error('Runtime boot timed out')), timeoutMs);
    window.haskellBenchmark = { frame, pending, nextId: 0 };
    window.addEventListener('message', event => {
      if (event.source !== frame.contentWindow || event.data?.namespace !== namespace) return;
      const message = event.data.message;
      if (message.type === 'ready') {
        clearTimeout(timer);
        resolve(performance.now() - started);
      } else if (message.type === 'error') {
        clearTimeout(timer);
        reject(new Error(message.message));
      }
      const request = pending.get(message.id);
      if (request) {
        pending.delete(message.id);
        clearTimeout(request.timer);
        request.resolve({ elapsedMs: performance.now() - request.started, message });
      }
    });
    document.body.append(frame);
  }), { namespace: NAMESPACE, timeoutMs: REQUEST_TIMEOUT_MS });
}

async function request(page, message) {
  return page.evaluate(({ namespace, message, timeoutMs }) => new Promise((resolve, reject) => {
    const runtime = window.haskellBenchmark;
    const id = ++runtime.nextId;
    const timer = setTimeout(() => {
      runtime.pending.delete(id);
      reject(new Error(`${message.type} request ${id} timed out`));
    }, timeoutMs);
    runtime.pending.set(id, { started: performance.now(), resolve, timer });
    runtime.frame.contentWindow.postMessage({ namespace, message: { ...message, id } }, '*');
  }), { namespace: NAMESPACE, message, timeoutMs: REQUEST_TIMEOUT_MS });
}

async function writeSource(page, path, content) {
  const result = await request(page, { type: 'write', path, content });
  if (result.message.type !== 'write_ok') throw new Error(JSON.stringify(result.message));
  return result.elapsedMs;
}

function checkResult(result, expected, name) {
  if (result.message.type !== 'run_done' || result.message.exitCode !== 0 ||
      !expected.test(result.message.stdout || '')) {
    throw new Error(`${name} did not produce its expected result: ${JSON.stringify(result.message)}`);
  }
}

async function measureRepeated(page, records, options, scenario) {
  for (let index = 0; index <= options.iterations; index += 1) {
    const result = await request(page, scenario.message);
    checkResult(result, scenario.expected, scenario.name);
    const record = {
      scenario: scenario.name, phase: index === 0 ? 'first' : 'repeated',
      sample: index, elapsedMs: result.elapsedMs,
    };
    records.push(record);
    process.stderr.write(`${record.scenario} ${record.phase} ${record.elapsedMs.toFixed(1)} ms\n`);
  }
}

async function benchmarkWorkloads(page, records, options) {
  const source = 'module Main where\nanswer :: Int\nanswer = 42\ndouble x = x * 2\nmain :: IO ()\nmain = print answer\n';
  await writeSource(page, 'Main.hs', source);
  for (const scenario of [
    { name: 'run', message: { type: 'run', path: 'Main.hs', silent: true }, expected: /^42\s*$/ },
    { name: 'evaluate', message: { type: 'evaluate', path: 'Main.hs', expression: 'double 21', silent: true }, expected: /^42\s*$/ },
    { name: 'type-query', message: { type: 'evaluate', path: 'Main.hs', expression: ':type double', silent: true }, expected: /Num/ },
    { name: 'boolean-test', message: { type: 'runTest', path: 'Main.hs', expression: 'double 21 == 42', silent: true }, expected: /^\s*$/ },
    { name: 'signature-test', message: { type: 'runTest', path: 'Main.hs', expression: 'answer == 42', signature: { name: 'answer', type: 'Int' }, silent: true }, expected: /^\s*$/ },
  ]) await measureRepeated(page, records, options, scenario);

  await writeSource(page, 'Main.hs', source.replace('module Main where\n', ''));
  await measureRepeated(page, records, options, {
    name: 'headerless-evaluate',
    message: { type: 'evaluate', path: 'Main.hs', expression: 'double 21', silent: true },
    expected: /^42\s*$/,
  });

  await writeSource(page, 'Main.hs', 'module Main where\nimport Bonus\nmain = print bonus\n');
  await writeSource(page, 'Bonus.hs', 'module Bonus where\nbonus = 7\n');
  await measureRepeated(page, records, options, {
    name: 'imported-evaluate',
    message: { type: 'evaluate', path: 'Main.hs', expression: 'main', silent: true },
    expected: /^7\s*$/,
  });
  for (let index = 0; index < options.iterations; index += 1) {
    const value = index + 20;
    const syncMs = await writeSource(page, 'Bonus.hs', `module Bonus where\nbonus = ${value}\n`);
    records.push({ scenario: 'module-edit-sync', phase: 'edited', sample: index, elapsedMs: syncMs });
    const result = await request(page, { type: 'evaluate', path: 'Main.hs', expression: 'main', silent: true });
    checkResult(result, new RegExp(`^${value}\\s*$`), 'edited-module-evaluate');
    records.push({ scenario: 'edited-module-evaluate', phase: 'edited', sample: index, elapsedMs: result.elapsedMs });
  }
}

function summarize(records) {
  const groups = new Map();
  for (const record of records) {
    const key = `${record.scenario}/${record.phase}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record.elapsedMs);
  }
  return [...groups].map(([scenario, samples]) => {
    const sorted = samples.toSorted((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    const medianMs = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    return { scenario, samples: samples.length, medianMs, minMs: sorted[0], maxMs: sorted.at(-1) };
  });
}

async function main() {
  const options = optionsFromArguments();
  const browser = await chromium.launch();
  const records = [];
  try {
    const context = await browser.newContext({ baseURL: options.baseURL });
    const page = await context.newPage();
    const bootMs = await bootRuntime(page);
    records.push({ scenario: 'boot', phase: 'fresh-browser-context', sample: 0, elapsedMs: bootMs });
    process.stderr.write(`boot ${bootMs.toFixed(1)} ms\n`);
    await benchmarkWorkloads(page, records, options);
    const report = {
      measuredAt: new Date().toISOString(), browser: browser.version(),
      platform: `${os.platform()} ${os.arch()}`, cpu: os.cpus()[0]?.model,
      baseURL: options.baseURL, iterations: options.iterations,
      note: 'One fresh browser context; localhost delivery; sequential requests; first means first request of that workload, not a fresh compiler instance. No UI or network-throttle costs.',
      summary: summarize(records), records,
    };
    const json = JSON.stringify(report, null, 2) + '\n';
    if (options.output) await writeFile(options.output, json);
    process.stdout.write(json);
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  process.stderr.write(`${error.stack}\n`);
  process.exitCode = 1;
});
