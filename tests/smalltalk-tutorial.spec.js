const { test, expect } = require('@playwright/test');
const { loadTutorialConfig } = require('./tutorial-helpers');
const { a11yCheckpoint } = require('./a11y-helpers');
const config = loadTutorialConfig('smalltalk');
const output = page => page.getByRole('region', { name: 'Program output', exact: true });
const runButton = page => page.getByRole('button', { name: 'Run', exact: true });
const terminal = page => page.getByRole('region', { name: 'Smalltalk live terminal', exact: true });
test.setTimeout(180000);

test.beforeEach(async ({ page }) => {
  // Observe public transport durations, including startup before the adapter
  // exists. The real class, operation, request options and result stay intact.
  await page.addInitScript(() => {
    const api = window.SEBookSmalltalk = window.SEBookSmalltalk || {};
    let Host;
    window.smalltalkRequestTimings = [];
    Object.defineProperty(api, 'RuntimeHost', {
      configurable: true, get: () => Host,
      set: value => {
        Host = value;
        const request = Host.prototype.request;
        Host.prototype.request = async function (session, operation, payload, options = {}) {
          const observed = { role: session.role, operation, purpose: options.purpose || null, state: 'pending' };
          window.smalltalkRequestTimings.push(observed);
          const started = performance.now();
          try {
            const result = await request.call(this, session, operation, payload, options);
            observed.state = 'resolved'; return result;
          } catch (error) { observed.state = error.code || 'rejected'; throw error; }
          finally { observed.ms = Math.round(performance.now() - started); }
        };
      },
    });
  });
});

test.afterEach(async ({ page }, testInfo) => {
  if (!page.isClosed()) {
    const timings = await page.evaluate(() => window.smalltalkRequestTimings || []).catch(() => []);
    await testInfo.attach('native-request-timings', { body: JSON.stringify(timings), contentType: 'application/json' });
    if (testInfo.status !== testInfo.expectedStatus) console.log(JSON.stringify({ nativeRequestTimings: timings }));
  }
});

async function ready(page) {
  await page.goto('/SEBook/tools/smalltalk-tutorial');
  await expect(page.locator('.tvm-loading')).toBeHidden({ timeout: 120000 });
  await expect(page.getByRole('alert').filter({ hasText: 'Tutorial Error' })).toHaveCount(0);
  await expect(runButton(page)).toBeEnabled();
  await expect(page.getByRole('region', { name: 'Smalltalk System Browser' })).toBeVisible();
  await expect(terminal(page)).toBeVisible();
  await expect(page.getByRole('heading', { name: config.steps[0].title, exact: true })).toBeVisible();
}
async function typeSource(page, label, text) {
  const input = page.getByRole('textbox', { name: new RegExp('^' + label) });
  await input.focus();
  await input.press('ControlOrMeta+A');
  await input.press('Backspace');
  await page.keyboard.insertText(text);
}
async function evaluate(page, source, expected) {
  const evaluateButton = terminal(page).getByRole('button', { name: 'Evaluate', exact: true });
  await expect(evaluateButton).toBeEnabled({ timeout: 120000 });
  await typeSource(page, 'Smalltalk expression', source);
  await evaluateButton.click();
  await expect(terminal(page).getByRole('region', { name: 'Evaluation result', exact: true })).toHaveText(expected, { timeout: 30000 });
}

test('Smalltalk tutorial starts its real Browser and terminal and reuses one image for Run', async ({ page }) => {
  let workers = 0;
  page.on('worker', worker => { if (worker.url().startsWith('data:text/javascript')) workers++; });
  const startupStart = Date.now();
  await ready(page);
  const coldStartupMs = Date.now() - startupStart;
  await expect(page.getByRole('button', { name: 'Accept', exact: true })).toBeDisabled();
  await a11yCheckpoint(page, 'Smalltalk tutorial Browser and terminal', { feature: 'smalltalk-tutorial' });
  await runButton(page).click();
  await expect(output(page)).toContainText(/Result: 1\s*$/, { timeout: 30000 });
  await expect(runButton(page)).toBeEnabled();
  const before = workers;
  const start = Date.now();
  await runButton(page).click();
  await expect(output(page)).toContainText(/Result: 1\s*$/, { timeout: 30000 });
  await expect(runButton(page)).toBeEnabled();
  const runMs = Date.now() - start;
  const expressionStart = Date.now();
  await evaluate(page, 'retained := SEBookCounter new. retained increment; value', '1');
  console.log(JSON.stringify({ coldStartupMs, warmRunMs: runMs, terminalMs: Date.now() - expressionStart }));
  expect(workers).toBe(before);
});

test('Browser accepts live edits without losing counter state and fresh checks exclude drafts', async ({ page }) => {
  await ready(page);
  await evaluate(page, 'counter := SEBookCounter new. counter increment; value', '1');
  await page.getByRole('listbox', { name: 'Methods', exact: true }).selectOption({ label: 'increment' });
  await expect(page.getByRole('region', { name: 'Method source', exact: true })).toContainText('count + 1');
  await typeSource(page, 'Smalltalk method source', 'increment\n  count := count + 2.\n  ^ self');
  await runButton(page).click();
  await expect(output(page)).toContainText('Draft changes excluded');
  await expect(output(page)).toContainText(/Result: 1\s*$/, { timeout: 30000 });
  const acceptStarted = Date.now();
  await page.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Compilation status' })).toContainText('Accepted.', { timeout: 30000 });
  console.log(JSON.stringify({ liveMethodAcceptMs: Date.now() - acceptStarted }));
  await evaluate(page, 'counter increment; value', '3');
  await runButton(page).click();
  await expect(output(page)).toContainText(/Result: 2\s*$/, { timeout: 30000 });
  await captureCheckReceipt(page);
  const checkStarted = Date.now();
  await page.getByRole('button', { name: /Test My Work/ }).click();
  await expect(page.locator('.tvm-test-summary')).toContainText('All 3 tests passed!', { timeout: 120000 });
  console.log(JSON.stringify({ threeCheckBatchMs: Date.now() - checkStarted, individualCheckLeaseMs: await page.evaluate(() => window.checkLeaseDurations) }));
  await typeSource(page, 'Smalltalk method source', 'increment\n  count := ) badDraftToken.\n  ^ self');
  await page.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Compilation status' })).toContainText(/error/i, { timeout: 30000 });
  await runButton(page).click();
  await expect(output(page)).toContainText(/Result: 2\s*$/, { timeout: 30000 });
});

for (const resource of ['/js/smalltalk/fresh-runner.js', '/js/vendor/smalltalk/manifest.json']) {
  test('startup failure offers a meaningful retry: ' + resource, async ({ page }) => {
    // Fault injection exercises the real loader; no replacement runtime.
    await page.route('**' + resource, route => route.fulfill({ status: 503, body: 'Unavailable' }));
    await page.goto('/SEBook/tools/smalltalk-tutorial');
    await expect(page.getByRole('alert').filter({ hasText: 'Tutorial Error' })).toContainText(/Failed to start tutorial/, { timeout: 30000 });
    await page.unroute('**' + resource);
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    // Retry rebuilds the shell asynchronously; absence of the old spinner
    // alone does not establish readiness of the replacement runtime.
    await expect(runButton(page)).toBeEnabled({ timeout: 120000 });
    await expect(page.locator('.tvm-loading')).toBeHidden({ timeout: 120000 });
    await expect(page.getByRole('alert').filter({ hasText: 'Tutorial Error' })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Smalltalk System Browser' })).toBeVisible();
    await runButton(page).click();
    await expect(output(page)).toContainText(/Result: 1\s*$/, { timeout: 30000 });
  });
}

test('each check gets a fresh image, only Boolean true passes, and helper disposal preserves its injected host', async ({ page }) => {
  const { installSmalltalk } = require('./helpers/smalltalk-runtime');
  await installSmalltalk(page);
  await page.addScriptTag({ url: '/js/smalltalk/fresh-runner.js' });
  const observed = await page.evaluate(async step => {
    const api = window.SEBookSmalltalk;
    const host = await api.RuntimeHost.create({ manifestURL: '/js/vendor/smalltalk/manifest.json' });
    const runner = await api.FreshRunner.create({ host });
    const program = api.normalizeProgram({ stepKey: step.key, files: step.files, runFile: step.run_file, runCommand: step.run_command });
    try {
      const result = await runner.runTests([
        { command: '(Smalltalk includesKey: #FreshCheckSentinel) ifTrue: [false] ifFalse: [Smalltalk at: #FreshCheckSentinel put: true. true]' },
        { command: 'Smalltalk includesKey: #FreshCheckSentinel' },
        { command: "'true'" }, { command: '1' }, { command: 'true' }, { command: 'self error: \'check failure\'' },
      ], { program });
      runner.dispose();
      let disposedCode;
      try { await runner.runTests([], { program }); } catch (error) { disposedCode = error.code; }
      const stillUsable = await host.withFreshSession(session => host.request(session, 'evaluate', { source: '42', bindings: 'isolated' }));
      return { checks: result.results.map(item => item.passed), errors: result.results.map(item => item.error === null ? null : item.error && item.error.code), disposedCode, stillUsable: stillUsable.value.text };
    } finally { runner.dispose(); host.dispose(); }
  }, config.steps[0]);
  expect(observed).toEqual({ checks: [true, false, false, false, true, false], errors: [null, null, null, null, null, 'EVALUATION_ERROR'], disposedCode: 'CANCELLED', stillUsable: '42' });
});

test('an absent Run entry reports successful loading without restarting the live image', async ({ page }) => {
  await ready(page);
  await page.evaluate(async () => {
    const tutorial = window._tutorial;
    delete tutorial.steps[0].run_command;
    await tutorial.loadStep(0);
  });
  await runButton(page).click();
  await expect(output(page)).toContainText('Program loaded successfully; no run_command configured.');
  await page.evaluate(async () => {
    const step = window._tutorial.steps[0];
    step.key = 'empty-smalltalk-workspace'; step.files = [];
    delete step.run_file; delete step.smalltalk_target;
    await window._tutorial.loadStep(0);
  });
  await runButton(page).click();
  await expect(output(page)).toContainText('Program loaded successfully; no run_command configured.');
});

test('solution and reset replace accepted source and reset live objects', async ({ page }) => {
  await ready(page);
  await evaluate(page, 'Smalltalk at: #ResetProof put: 17. true', 'true');
  await page.evaluate(() => window._tutorial.applySolution());
  await runButton(page).click();
  await expect(output(page)).toContainText(/Result: 2\s*$/, { timeout: 30000 });
  await evaluate(page, 'Smalltalk includesKey: #ResetProof', 'false');
  await page.evaluate(() => window._tutorial.resetStep());
  await runButton(page).click();
  await expect(output(page)).toContainText(/Result: 1\s*$/, { timeout: 30000 });
});

/** Hold only delivery of a completed real native check, never its value or source. */
async function holdFirstCheck(page) {
  await page.evaluate(() => {
    const prototype = SEBookSmalltalk.RuntimeHost.prototype;
    const request = prototype.request;
    let held = false;
    window.checkGate = { reached: false, sources: [] };
    prototype.request = async function (session, operation, payload, options = {}) {
      const result = await request.call(this, session, operation, payload, options);
      if (operation === 'evaluate' && options.purpose === 'check') {
        window.checkGate.sources.push(payload.source);
        if (!held) {
          held = true;
          window.checkGate.nativeValue = result.value.booleanValue;
          await new Promise(resolve => {
            window.checkGate.release = resolve;
            window.checkGate.reached = true;
          });
        }
      }
      return result;
    };
  });
}

/** Observe the public receipt while retaining the production page's grading path. */
async function captureCheckReceipt(page) {
  await page.evaluate(() => {
    const adapter = window._tutorial._smalltalkAdapter;
    const runTests = adapter.runTests.bind(adapter);
    window.checkReceipt = null;
    window.checkLeaseDurations = [];
    const prototype = SEBookSmalltalk.RuntimeHost.prototype;
    const lease = prototype.withFreshSession;
    prototype.withFreshSession = async function (...args) {
      const start = performance.now();
      try { return await lease.apply(this, args); }
      finally { window.checkLeaseDurations.push(Math.round(performance.now() - start)); }
    };
    adapter.runTests = async (...args) => {
      try {
        const receipt = await runTests(...args);
        window.checkReceipt = { program: receipt.program, results: receipt.results };
        return receipt;
      } catch (error) {
        window.checkReceipt = { error: error.code };
        throw error;
      }
    };
  });
}

for (const change of ['acceptance', 'step']) {
  test('a frozen check batch cannot grant credit after ' + change + ' changes', async ({ page }) => {
    await ready(page);
    await page.evaluate(async () => {
      const tutorial = window._tutorial;
      await tutorial.applySolution();
      const next = structuredClone(tutorial.steps[0]);
      next.key = 'second-counter'; next.title = 'Another counter';
      tutorial.steps.push(next);
      // Extend the skip-enabled fixture's navigation to its newly added step.
      tutorial._stepsUnlocked.add(1);
    });
    await captureCheckReceipt(page);
    await holdFirstCheck(page);
    if (change === 'acceptance') {
      await page.getByRole('listbox', { name: 'Methods', exact: true }).selectOption({ label: 'increment' });
      await expect(page.getByRole('region', { name: 'Method source', exact: true })).toContainText('count + 2');
      await typeSource(page, 'Smalltalk method source', 'increment\n  count := count + 3.\n  ^ self');
    }
    await page.getByRole('button', { name: /Test My Work/ }).click();
    await page.waitForFunction(() => window.checkGate.reached, null, { timeout: 30000 });
    expect(await page.evaluate(() => window.checkGate.nativeValue)).toBe(true);
    if (change === 'acceptance') {
      await page.getByRole('button', { name: 'Accept', exact: true }).click();
      await expect(page.getByRole('status', { name: 'Compilation status' })).toContainText('Accepted.', { timeout: 30000 });
    } else {
      await page.evaluate(() => window._tutorial.loadStep(1));
      await expect(page.getByRole('heading', { name: 'Another counter', exact: true })).toBeVisible();
    }
    await page.evaluate(() => window.checkGate.release());
    await page.waitForFunction(() => window.checkReceipt !== null, null, { timeout: 120000 });
    await expect(runButton(page)).toBeEnabled({ timeout: 30000 });
    await expect(page.locator('.tvm-test-summary.all-pass')).toHaveCount(0);
    const saved = await page.evaluate(() => {
      window._tutorial.saveProgress();
      return JSON.parse(localStorage.getItem('tutorial-progress-smalltalk'));
    });
    expect(saved.stepsPassed).toEqual([]);
    if (change === 'acceptance') {
      const receipt = await page.evaluate(() => window.checkReceipt);
      expect(receipt.results.map(row => row.passed)).toEqual([true, true, true]);
      expect(receipt.program.files[0].content).toContain('count + 2');
      expect(receipt.program.changes.source).not.toContain('count + 3');
      await runButton(page).click();
      await expect(output(page)).toContainText(/Result: 3\s*$/, { timeout: 30000 });
    }
  });
}

test('destroy releases the owned live session', async ({ page }) => {
  await ready(page);
  expect(page.workers().filter(worker => worker.url().startsWith('data:text/javascript'))).toHaveLength(1);
  await page.evaluate(() => window._tutorial.destroy());
  await expect.poll(() => page.workers().filter(worker => worker.url().startsWith('data:text/javascript')).length).toBe(0);
});

test('tutorial grading replays accepted class/method removals and a modified core method', async ({ page }) => {
  await ready(page);
  await page.evaluate(async () => {
    const tutorial = window._tutorial;
    const workspace = tutorial._smalltalkAdapter.getWorkspace();
    const program = workspace.snapshot();
    // These definitions are in the authored baseline, so absence in a fresh
    // check requires replaying their accepted removal rather than omitting them.
    program.files[0].content += "\nObject subclass: #SEBookRemovedClass instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Smalltalk'!\n!SEBookCounter methodsFor: 'testing'!\nobsolete ^ 17\n! !\n";
    await workspace.replaceProgram(program);
    const mutation = await workspace.evaluate("Smalltalk removeClassNamed: #SEBookRemovedClass. SEBookCounter removeSelector: #obsolete. Object compile: 'yourself \"integrated core overlay\" ^ self' classified: 'accessing'. true");
    if (mutation.error) throw new Error(mutation.error.message);
    tutorial.steps[0].tests = [
      { description: 'Accepted class removal', command: '(Smalltalk includesKey: #SEBookRemovedClass) not' },
      { description: 'Accepted method removal', command: '(SEBookCounter includesSelector: #obsolete) not' },
      { description: 'Accepted core method source', command: "(Object sourceCodeAt: #yourself) asString = 'yourself \"integrated core overlay\" ^ self'" },
    ];
  });
  await captureCheckReceipt(page);
  await page.getByRole('button', { name: /Test My Work/ }).click();
  await expect(page.locator('.tvm-test-summary')).toContainText('All 3 tests passed!', { timeout: 120000 });
  expect((await page.evaluate(() => window.checkReceipt.results)).map(row => row.passed)).toEqual([true, true, true]);
});

test('visible grading rejects non-Booleans, errors, output overflow and timeout without damaging live state', async ({ page }) => {
  await ready(page);
  await evaluate(page, 'counter := SEBookCounter new. counter increment; value', '1');
  await page.evaluate(() => {
    window._tutorial.steps[0].tests = [
      { description: 'Boolean false', command: 'false' },
      { description: 'Number is not Boolean true', command: '1' },
      { description: 'String is not Boolean true', command: "'true'" },
      { description: 'Native exception', command: "self error: 'integrated grading error'" },
      { description: 'Transcript overflow', command: 'Transcript show: (String new: 1048577 withAll: $x). true' },
      { description: 'Run deadline', command: '[true] whileTrue: []' },
      { description: 'Next fresh check still works', command: 'true' },
    ];
  });
  await captureCheckReceipt(page);
  await page.getByRole('button', { name: /Test My Work/ }).click();
  await expect(page.locator('.tvm-test-summary')).toContainText(/1\s*\/\s*7 tests passed/, { timeout: 150000 });
  const receipt = await page.evaluate(() => window.checkReceipt);
  expect(receipt.results.map(row => row.passed)).toEqual([false, false, false, false, false, false, true]);
  expect(receipt.results.map(row => row.error && row.error.code)).toEqual([null, null, null, 'EVALUATION_ERROR', 'OUTPUT_LIMIT', 'TIMEOUT', null]);
  await evaluate(page, 'counter increment; value', '2');
});

test('in-flight grading cancellation settles and preserves the shared live image', async ({ page }) => {
  await ready(page);
  await evaluate(page, 'counter := SEBookCounter new. counter increment; value', '1');
  await page.evaluate(() => {
    const prototype = SEBookSmalltalk.RuntimeHost.prototype;
    const request = prototype.request;
    window.nativeCheckEntered = false;
    prototype.request = function (session, operation, payload, options = {}) {
      let unsubscribe;
      if (operation === 'evaluate' && options.purpose === 'check' && payload.source.includes('grading entered')) {
        unsubscribe = this.subscribe(event => {
          if (event.sessionId === session.sessionId && event.type === 'output' && event.payload.text.includes('grading entered')) {
            window.nativeCheckEntered = true; unsubscribe();
          }
        });
      }
      return request.call(this, session, operation, payload, options).finally(() => { if (unsubscribe) unsubscribe(); });
    };
    window._tutorial.steps[0].tests = [{ description: 'Cancellable native check', command: "Transcript show: 'grading entered'; cr. [true] whileTrue: []" }];
  });
  await captureCheckReceipt(page);
  await page.getByRole('button', { name: /Test My Work/ }).click();
  await page.waitForFunction(() => window.nativeCheckEntered, null, { timeout: 30000 });
  await page.getByRole('button', { name: /Stop$/, exact: false }).click();
  await page.waitForFunction(() => window.checkReceipt !== null);
  expect(await page.evaluate(() => window.checkReceipt.error)).toBe('CANCELLED');
  await expect(runButton(page)).toBeEnabled();
  await expect(page.locator('.tvm-test-summary.all-pass')).toHaveCount(0);
  await evaluate(page, 'counter increment; value', '2');
  await page.evaluate(() => { window._tutorial.steps[0].tests = [{ description: 'Grading after cancellation', command: 'true' }]; });
  await page.getByRole('button', { name: /Test My Work/ }).click();
  await expect(page.locator('.tvm-test-summary')).toContainText('All 1 tests passed!', { timeout: 60000 });
});

test('Stop cancels a live Run and allows accepted code to run again', async ({ page }) => {
  await ready(page);
  await page.evaluate(async () => {
    window._tutorial.steps[0].run_command = '[true] whileTrue: []';
    await window._tutorial.loadStep(0);
  });
  await runButton(page).click();
  await page.getByRole('button', { name: /Stop$/, exact: false }).click();
  await expect(runButton(page)).toBeEnabled({ timeout: 30000 });
  await expect(output(page)).toContainText('Execution stopped; live session resets before its next use.');
  await page.evaluate(async () => {
    window._tutorial.steps[0].run_command = 'SEBookCounter runExample';
    await window._tutorial.loadStep(0);
  });
  await runButton(page).click();
  await expect(output(page)).toContainText(/Result: 1\s*$/, { timeout: 30000 });
});

test('instructions start at thirty percent and explicit pane resizing survives step loading', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await ready(page);
  const proportion = () => page.evaluate(() => {
    const instructions = document.querySelector('.tvm-instructions-panel').getBoundingClientRect().width;
    const workspace = document.querySelector('.tvm-workspace').getBoundingClientRect().width;
    return instructions / (instructions + workspace);
  });
  await expect.poll(proportion).toBeGreaterThan(0.29);
  await expect.poll(proportion).toBeLessThan(0.31);
  const separator = page.getByRole('separator', { name: 'Resize editor panes', exact: true }).first();
  await expect(separator).toHaveAttribute('aria-valuenow', '30');
  await separator.focus();
  await separator.press('ArrowRight');
  const resized = await proportion();
  expect(resized).toBeGreaterThan(0.31);
  expect(resized).toBeLessThan(0.34);
  await page.evaluate(() => window._tutorial.loadStep(0));
  await expect.poll(proportion).toBeCloseTo(resized, 2);
  await expect(page.getByRole('button', { name: 'Restart session', exact: true })).toHaveCount(1);
  await a11yCheckpoint(page, 'Smalltalk resized workspace', { feature: 'smalltalk-tutorial' });
});

test('a retained-state Run entry shares objects with the terminal and Restart clears bindings', async ({ page }) => {
  await ready(page);
  await page.evaluate(async () => {
    window._tutorial.steps[0].run_command = 'Smalltalk at: #RunCounter ifAbsentPut: [SEBookCounter new]. (Smalltalk at: #RunCounter) increment; value';
    await window._tutorial.loadStep(0);
  });
  for (const value of [1, 2]) {
    await runButton(page).click();
    await expect(output(page)).toContainText(new RegExp('Result: ' + value + '\\s*$'));
    await expect(runButton(page)).toBeEnabled();
  }
  await evaluate(page, '(Smalltalk at: #RunCounter) increment; value', '3');
  await terminal(page).getByRole('button', { name: 'Restart session', exact: true }).click();
  await evaluate(page, 'Smalltalk includesKey: #RunCounter', 'false');
});

test('Accept and Run rejects an invalid draft before executing and supports caller cancellation', async ({ page }) => {
  await ready(page);
  const observed = await page.evaluate(async () => {
    window._tutorial.steps[0].run_command = 'Smalltalk at: #InvalidRunExecuted put: true. SEBookCounter runExample';
    await window._tutorial.loadStep(0);
    const adapter = window._tutorial._smalltalkAdapter;
    const workspace = adapter.getWorkspace();
    const target = { kind: 'method', className: 'SEBookCounter', side: 'instance', selector: 'increment' };
    workspace.setDraft({ target, baseRevision: workspace.snapshot().revision, source: 'increment count := ) broken.' });
    let invalidCode;
    try { await adapter.run({ acceptDrafts: true }); } catch (error) { invalidCode = error.code; }
    const retained = workspace.getDrafts().length;
    const executed = (await workspace.evaluate('Smalltalk includesKey: #InvalidRunExecuted')).value.booleanValue;
    workspace.revertDraft(target);
    const controller = new AbortController(); controller.abort();
    let cancelledCode;
    try { await adapter.run({ signal: controller.signal }); } catch (error) { cancelledCode = error.code; }
    let checksCancelledCode;
    try { await adapter.runTests([{ command: 'true' }], { signal: controller.signal }); } catch (error) { checksCancelledCode = error.code; }
    workspace.setDraft({ target, baseRevision: workspace.snapshot().revision, source: 'increment count := count + 2. ^ self' });
    const result = await adapter.run({ acceptDrafts: true });
    return { invalidCode, retained, executed, cancelledCode, checksCancelledCode, remaining: workspace.getDrafts().length, result: result.result.value.text };
  });
  expect(observed).toMatchObject({ invalidCode: 'COMPILE_ERROR', retained: 1, executed: false, cancelledCode: 'CANCELLED', checksCancelledCode: 'CANCELLED', remaining: 0, result: '2' });
});

test('the narrow tutorial keeps Browser source before a reachable terminal without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await ready(page);
  const geometry = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    sourceBottom: document.querySelector('.smalltalk-source-editor').getBoundingClientRect().bottom,
    terminalTop: document.querySelector('.smalltalk-inspector').getBoundingClientRect().top,
  }));
  expect(geometry.width).toBeLessThanOrEqual(320);
  expect(geometry.sourceBottom).toBeLessThanOrEqual(geometry.terminalTop);
  await evaluate(page, '1 + 1', '2');
  await a11yCheckpoint(page, 'Smalltalk narrow workspace light', { feature: 'smalltalk-tutorial' });
  await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
  await a11yCheckpoint(page, 'Smalltalk narrow workspace dark', { feature: 'smalltalk-tutorial' });
});

test('the text-only Run output releases its native result handle', async ({ page }) => {
  await ready(page);
  await page.evaluate(async () => {
    window._tutorial.steps[0].run_command = 'SEBookCounter new';
    await window._tutorial.loadStep(0);
    const adapter = window._tutorial._smalltalkAdapter;
    const run = adapter.run.bind(adapter);
    // Observe the public result while preserving the complete native operation.
    adapter.run = async options => {
      const result = await run(options);
      window.runResultHandle = result.result.value.handle;
      return result;
    };
  });
  await runButton(page).click();
  await expect(output(page)).toContainText('Result:');
  await expect(runButton(page)).toBeEnabled();
  const code = await page.evaluate(async () => {
    if (!window.runResultHandle) throw new Error('Expected a native object result handle');
    try { await window._tutorial._smalltalkAdapter.getWorkspace().inspect(window.runResultHandle, 0, 10); }
    catch (error) { return error.code; }
    return 'handle still retained';
  });
  expect(code).toBe('STALE_HANDLE');
});

for (const restart of ['adapter', 'terminal']) {
  test('a successful ' + restart + ' restart repairs a failed Stop recovery and permits Run, load and reset', async ({ page }) => {
    await ready(page);
    const failure = await page.evaluate(async () => {
      const tutorial = window._tutorial;
      tutorial.steps[0].run_command = '(Delay forMilliseconds: 5000) wait. true';
      await tutorial.loadStep(0);
      const adapter = tutorial._smalltalkAdapter;
      const Worker = window.Worker;
      let fail = true;
      window.Worker = class extends Worker {
        constructor(...args) { if (fail) { fail = false; throw new Error('transient recovery fixture'); } super(...args); }
      };
      try {
        const pending = adapter.run(); await Promise.resolve(); adapter.stop();
        const stopped = await pending.catch(error => ({ code: error.code }));
        const unavailable = await adapter.run().catch(error => ({ code: error.code }));
        return { stopped: stopped.code, unavailable: unavailable.code };
      } finally { window.Worker = Worker; }
    });
    expect(failure).toEqual({ stopped: 'CANCELLED', unavailable: 'RECOVERED_FAILURE' });
    await expect(output(page)).toContainText('Session recovery failed:');
    await expect(output(page)).toContainText('Select Restart session to retry.');
    await expect(page.getByRole('alert', { name: 'Smalltalk session recovery', exact: true })).toContainText('Select Restart session to retry.');
    if (restart === 'adapter') await page.evaluate(() => window._tutorial._smalltalkAdapter.restart());
    else {
      await terminal(page).getByRole('button', { name: 'Restart session', exact: true }).click();
      await expect(terminal(page).getByRole('status', { name: 'Live session status' })).toContainText('Session restarted.', { timeout: 30000 });
    }
    const value = await page.evaluate(async () => (await window._tutorial._smalltalkAdapter.run()).result.value.booleanValue);
    expect(value).toBe(true);
    await page.evaluate(async () => {
      window._tutorial.steps[0].run_command = 'SEBookCounter runExample';
      await window._tutorial.loadStep(0);
      await window._tutorial.resetStep();
    });
    await runButton(page).click();
    await expect(output(page)).toContainText(/Result: 1\s*$/, { timeout: 30000 });
  });
}

for (const action of ['resetStep', 'applySolution']) {
  test(action + ' clears invalid method and file drafts after successful replacement while Restart retains them', async ({ page }) => {
    await ready(page);
    const before = await page.evaluate(async () => {
      const adapter = window._tutorial._smalltalkAdapter;
      const workspace = adapter.getWorkspace();
      const baseRevision = workspace.snapshot().revision;
      workspace.setDraft({ target: { kind: 'method', className: 'SEBookCounter', side: 'instance', selector: 'increment' }, baseRevision, source: 'increment count := ) invalidMethodDraft.' });
      workspace.setDraft({ target: { kind: 'file', path: workspace.snapshot().files[0].path }, baseRevision, source: ') invalidFileDraft' });
      await adapter.restart();
      return workspace.getDrafts().length;
    });
    expect(before).toBe(2);
    await page.evaluate(action => window._tutorial[action](), action);
    const drafts = await page.evaluate(() => window._tutorial._smalltalkAdapter.getWorkspace().getDrafts());
    expect(drafts).toEqual([]);
    await page.getByRole('listbox', { name: 'Methods', exact: true }).selectOption({ label: 'increment' });
    await expect(page.getByRole('region', { name: 'Method source', exact: true })).toContainText(action === 'resetStep' ? 'count + 1' : 'count + 2');
    await expect(page.getByRole('button', { name: 'Accept', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Accept and Run', exact: true }).click();
    await expect(output(page)).toContainText(new RegExp('Result: ' + (action === 'resetStep' ? 1 : 2) + '\\s*$'), { timeout: 30000 });
  });
}

test('an earlier healthy restart cannot hide a later failed recovery attempt', async ({ page }) => {
  await ready(page);
  const failure = await page.evaluate(async () => {
    const adapter = window._tutorial._smalltalkAdapter;
    const Worker = window.Worker;
    let attempts = 0;
    window.Worker = class extends Worker {
      constructor(...args) { if (++attempts === 2) throw new Error('later recovery fixture'); super(...args); }
    };
    try {
      const earlier = adapter.getWorkspace().restart();
      const later = adapter.restart();
      await earlier;
      const recovery = await later.catch(error => ({ code: error.code }));
      const unavailable = await adapter.run().catch(error => ({ code: error.code }));
      return { recovery: recovery.code, unavailable: unavailable.code };
    } finally { window.Worker = Worker; }
  });
  expect(failure).toEqual({ recovery: 'RECOVERED_FAILURE', unavailable: 'RECOVERED_FAILURE' });
  await expect(output(page)).toContainText('Session recovery failed:');
  await expect(output(page)).toContainText('later recovery fixture');
  await expect(page.getByRole('alert', { name: 'Smalltalk session recovery', exact: true })).toContainText('Select Restart session to retry.');
  await page.evaluate(() => window._tutorial._smalltalkAdapter.restart());
  await expect(page.getByRole('alert', { name: 'Smalltalk session recovery', exact: true })).toBeEmpty();
  await runButton(page).click();
  await expect(output(page)).toContainText(/Result: 1\s*$/, { timeout: 30000 });
});

test('failed solution replacement preserves invalid drafts and accepted source', async ({ page }) => {
  await ready(page);
  await page.evaluate(async () => {
    const tutorial = window._tutorial;
    const workspace = tutorial._smalltalkAdapter.getWorkspace();
    workspace.setDraft({ target: { kind: 'method', className: 'SEBookCounter', side: 'instance', selector: 'increment' }, baseRevision: workspace.snapshot().revision, source: 'increment count := ) retainedInvalidDraft.' });
    tutorial.steps[0].solution.files[0].content = '!SEBookCounter methodsFor: \'accessing\'!\nincrement ^ )! !';
    await tutorial.applySolution();
  });
  await expect(output(page)).toContainText('Acceptance failed:');
  const retained = await page.evaluate(() => window._tutorial._smalltalkAdapter.getWorkspace().getDrafts());
  expect(retained).toHaveLength(1);
  expect(retained[0].source).toContain('retainedInvalidDraft');
  await runButton(page).click();
  await expect(output(page)).toContainText(/Result: 1\s*$/, { timeout: 30000 });
});
