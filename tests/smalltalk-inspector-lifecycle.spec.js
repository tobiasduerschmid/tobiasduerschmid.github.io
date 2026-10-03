const { test, expect } = require('@playwright/test');
const { installSmalltalk } = require('./helpers/smalltalk-runtime');

// Deliberately deferred public Workspace boundary: these tests control only
// response timing/cleanup failures, not Smalltalk evaluation or native semantics.
async function mountDeferredInspector(page, { startInspection = true } = {}) {
  await page.goto('/robots.txt');
  await page.setContent('<main><div id="root"></div></main>');
  await page.addScriptTag({ content: 'window.SEBookSmalltalk = {};' });
  await page.addScriptTag({ url: '/js/smalltalk/inspector.js' });
  await page.evaluate(() => {
    const listeners = new Set(); const pending = []; const released = [];
    let releaseFails = false, sessionId = 'original', resultSerial = 0, deferEvaluation = false, resolveEvaluation;
    const workspace = {
      subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
      async evaluate() {
        if (deferEvaluation) await new Promise(resolve => { resolveEvaluation = resolve; });
        return { value: { className: 'Array', text: 'an Array', handle: 'root-' + (++resultSerial) }, error: null };
      },
      inspect() { return new Promise(resolve => pending.push(resolve)); },
      async releaseHandles(handles, options = {}) {
        if (releaseFails) throw Object.assign(new Error('release transport failed'), { code: 'RECOVERED_FAILURE' });
        released.push({ handles, sessionId: options.sessionId }); return { released: handles.length };
      },
      async restart() { sessionId = 'replacement'; listeners.forEach(listener => listener({ type: 'runtime', detail: { type: 'recovered', stateRewound: true } })); },
    };
    const view = window.SEBookSmalltalk.Inspector.mount({ root: document.getElementById('root'), workspace,
      createEditor({ element, value, ariaLabel }) {
        const input = document.createElement('textarea'); input.setAttribute('aria-label', ariaLabel); input.value = value; element.append(input);
        return { getValue: () => input.value, setValue: value => { input.value = value; }, dispose: () => input.remove() };
      },
    });
    window.inspectorLifecycle = { dispose: () => view.dispose(), released,
      resolve() { pending.shift()({ sessionId: 'original', className: 'Array', slots: [{ name: '1', value: { className: 'Array', text: 'an Array', handle: 'late-child' } }], nextOffset: null }); },
      output(text) { listeners.forEach(listener => listener({ type: 'runtime', detail: { type: 'output', payload: { stream: 'stdout', text } } })); },
      deferNextEvaluation() { deferEvaluation = true; }, resolveEvaluation() { deferEvaluation = false; resolveEvaluation(); },
      pending: () => pending.length, failRelease: value => { releaseFails = value; }, currentSession: () => sessionId };
  });
  await page.getByRole('textbox', { name: 'Smalltalk expression', exact: true }).fill('anArray');
  await page.getByRole('button', { name: 'Evaluate', exact: true }).click();
  if (startInspection) {
    await page.getByRole('button', { name: 'Inspect result', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.inspectorLifecycle.pending())).toBe(1);
  }
}

test('Closing an Inspector during evaluation returns keyboard focus to Stop', async ({ page }) => {
  await mountDeferredInspector(page);
  try {
    await page.evaluate(() => window.inspectorLifecycle.resolve());
    await expect(page.getByRole('button', { name: 'Expand 1', exact: true })).toBeVisible();
    await page.evaluate(() => window.inspectorLifecycle.deferNextEvaluation());
    await page.getByRole('button', { name: 'Evaluate', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Inspect result', exact: true })).toBeDisabled();
    const close = page.getByRole('button', { name: 'Close Result inspector', exact: true });
    await close.focus(); await close.press('Enter');
    await expect(page.getByRole('button', { name: 'Stop evaluation', exact: true })).toBeFocused();
    await page.evaluate(() => window.inspectorLifecycle.resolveEvaluation());
    await expect(page.getByRole('button', { name: 'Evaluate', exact: true })).toBeEnabled();
  } finally { await page.evaluate(() => window.inspectorLifecycle.dispose()); }
});

for (const action of ['Close', 'dispose']) {
  test(`Inspector releases late slot handles after ${action}`, async ({ page }) => {
    await mountDeferredInspector(page);
    if (action === 'Close') await page.getByRole('button', { name: 'Close Result inspector', exact: true }).click();
    else await page.evaluate(() => window.inspectorLifecycle.dispose());
    await page.evaluate(() => window.inspectorLifecycle.resolve());
    await expect.poll(() => page.evaluate(() => window.inspectorLifecycle.released.some(entry => entry.handles.includes('late-child') && entry.sessionId === 'original'))).toBe(true);
    await expect(page.getByRole('region', { name: 'Result object', exact: true })).toHaveCount(0);
  });
}

test('Inspector does not release late slots from an invalidated session', async ({ page }) => {
  await mountDeferredInspector(page);
  await page.getByRole('button', { name: 'Restart session', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Live session status', exact: true })).toContainText('Session restarted');
  await page.evaluate(() => window.inspectorLifecycle.resolve());
  await expect(page.getByRole('region', { name: 'Result object', exact: true })).toContainText('Stale object');
  await expect(page.getByRole('button', { name: 'Expand 1', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => window.inspectorLifecycle.released.flatMap(entry => entry.handles))).not.toContain('late-child');
});

test('Inspector reports a live cleanup failure and retries retained ownership', async ({ page }) => {
  await mountDeferredInspector(page);
  await page.evaluate(() => window.inspectorLifecycle.resolve());
  await expect(page.getByRole('button', { name: 'Expand 1', exact: true })).toBeVisible();
  await page.evaluate(() => window.inspectorLifecycle.failRelease(true));
  await page.getByRole('button', { name: 'Close Result inspector', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Inspector cleanup status', exact: true })).toContainText('release transport failed');
  await page.evaluate(() => window.inspectorLifecycle.failRelease(false));
  await page.getByRole('button', { name: 'Retry inspector cleanup', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.inspectorLifecycle.released.some(entry => entry.handles.includes('late-child')))).toBe(true);
  await expect(page.getByRole('button', { name: 'Retry inspector cleanup', exact: true })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Evaluate', exact: true })).toBeFocused();
});

async function mountNativeInspector(page, { deferInspection = false } = {}) {
  await installSmalltalk(page);
  await page.addScriptTag({ url: '/js/smalltalk/workspace.js' });
  await page.addScriptTag({ url: '/js/smalltalk/inspector.js' });
  await page.evaluate(async ({ deferInspection }) => {
    const runtime = await window.SEBookSmalltalk.RuntimeHost.create({ manifestURL: '/js/vendor/smalltalk/manifest.json' });
    const nativeRequest = runtime.request.bind(runtime); let nativeReleaseRequests = 0;
    runtime.request = (...args) => { if (args[1] === 'releaseHandles') nativeReleaseRequests++; return nativeRequest(...args); };
    const workspace = await window.SEBookSmalltalk.Workspace.create({ runtime, program: { version: 1, stepKey: 'cleanup', revision: 0, files: [], changes: { version: 1, source: '', entries: [] }, runCommand: null } });
    const nativeInspect = workspace.inspect.bind(workspace);
    let resolve, childHandle, sessionId, latestHandle; const inspections = [];
    const nativeEvaluate = workspace.evaluate.bind(workspace);
    workspace.evaluate = async (...args) => { const result = await nativeEvaluate(...args); latestHandle = result.value && result.value.handle; return result; };
    const gate = new Promise(ready => { resolve = ready; });
    workspace.inspect = async (...args) => {
      const inspection = await nativeInspect(...args); inspections.push({ handle: args[0], slots: inspection.slots }); childHandle = inspection.slots[0]?.value.handle; sessionId = inspection.sessionId;
      if (deferInspection) await gate; return inspection;
    };
    const root = document.createElement('div'); document.body.append(root);
    const view = window.SEBookSmalltalk.Inspector.mount({ root, workspace,
      createEditor({ element, ariaLabel }) {
        const input = document.createElement('textarea'); input.setAttribute('aria-label', ariaLabel); element.append(input);
        return { getValue: () => input.value, setValue: value => { input.value = value; }, dispose: () => input.remove() };
      },
    });
    window.nativeInspectorCleanup = { resolve, child: () => childHandle,
      async probe(handle) {
        try {
          const result = await nativeInspect(handle, 0, 25);
          await workspace.releaseHandles(result.slots.map(slot => slot.value.handle), { sessionId: result.sessionId });
          return { code: null, slots: result.slots.map(slot => ({ name: slot.name, text: slot.value.text })) };
        } catch (error) { return { code: error.code }; }
      },
      async state() { const result = await this.probe(childHandle); return result.code || 'live'; },
      inspections: () => inspections, latestHandle: () => latestHandle, disposeView: () => view.dispose(),
      async obsoleteRelease() {
        const original = sessionId; const restart = workspace.restart();
        const before = nativeReleaseRequests;
        const result = await workspace.releaseHandles([childHandle], { sessionId: original });
        await restart; return { result, nativeReleaseRequests: nativeReleaseRequests - before };
      },
      dispose() { view.dispose(); workspace.dispose(); runtime.dispose(); } };
  }, { deferInspection });
}

test('native slot handles returned after Close are released in their original session', async ({ page }) => {
  test.setTimeout(120000);
  await mountNativeInspector(page, { deferInspection: true });
  try {
    await page.getByRole('textbox', { name: 'Smalltalk expression', exact: true }).fill('Array with: (Array with: 42)');
    await page.getByRole('button', { name: 'Evaluate', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Evaluation result', exact: true })).toHaveText('a Array');
    await page.getByRole('button', { name: 'Inspect result', exact: true }).click();
    await expect.poll(() => page.evaluate(() => !!window.nativeInspectorCleanup.child()), { timeout: 30000 }).toBe(true);
    await page.getByRole('button', { name: 'Close Result inspector', exact: true }).click();
    await page.evaluate(() => window.nativeInspectorCleanup.resolve());
    await expect.poll(() => page.evaluate(() => window.nativeInspectorCleanup.state()), { timeout: 30000 }).toBe('STALE_HANDLE');
    expect(await page.evaluate(() => window.nativeInspectorCleanup.obsoleteRelease())).toEqual({ result: { released: 0 }, nativeReleaseRequests: 0 });
  } finally { await page.evaluate(() => window.nativeInspectorCleanup.dispose()); }
});

test('native cyclic expansions keep shared handles until the last owner closes and dispose releases the result', async ({ page }) => {
  test.setTimeout(120000);
  await mountNativeInspector(page);
  try {
    const expression = page.getByRole('textbox', { name: 'Smalltalk expression', exact: true });
    await expression.fill('cycle := Array with: nil with: 73. cycle at: 1 put: cycle. cycle');
    await page.getByRole('button', { name: 'Evaluate', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Evaluation result', exact: true })).toHaveText('a Array');
    await page.getByRole('button', { name: 'Inspect result', exact: true }).click();
    const root = page.getByRole('region', { name: 'Result object', exact: true });
    await expect(root).toContainText('73');
    const shared = await page.evaluate(() => window.nativeInspectorCleanup.inspections()[0].slots.find(slot => slot.name === '1').value.handle);
    await root.getByRole('button', { name: 'Expand 1', exact: true }).click();
    await root.getByRole('button', { name: 'Expand 1', exact: true }).click();
    const children = page.getByRole('region', { name: '1 object', exact: true });
    await expect(children).toHaveCount(2);
    await expect(children.nth(1)).toContainText('73');
    await expression.fill('6 * 7'); await page.getByRole('button', { name: 'Evaluate', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Evaluation result', exact: true })).toHaveText('42');
    const lastResult = await page.evaluate(() => window.nativeInspectorCleanup.latestHandle());
    await root.getByRole('button', { name: 'Close Result inspector', exact: true }).click();
    const probeShared = () => page.evaluate(handle => window.nativeInspectorCleanup.probe(handle), shared);
    expect(await probeShared()).toEqual({ code: null, slots: [{ name: '1', text: 'a Array' }, { name: '2', text: '73' }] });
    await children.nth(0).getByRole('button', { name: 'Close 1 inspector', exact: true }).click();
    await expect(children).toHaveCount(1);
    expect(await probeShared()).toEqual({ code: null, slots: [{ name: '1', text: 'a Array' }, { name: '2', text: '73' }] });
    await children.nth(0).getByRole('button', { name: 'Close 1 inspector', exact: true }).click();
    await expect.poll(async () => (await probeShared()).code).toBe('STALE_HANDLE');
    await page.evaluate(() => window.nativeInspectorCleanup.disposeView());
    await expect(page.getByRole('region', { name: 'Smalltalk live terminal', exact: true })).toHaveCount(0);
    await expect.poll(() => page.evaluate(handle => window.nativeInspectorCleanup.probe(handle).then(result => result.code), lastResult)).toBe('STALE_HANDLE');
  } finally { await page.evaluate(() => window.nativeInspectorCleanup.dispose()); }
});

test('terminal output bounds preserve newest Transcript and history text', async ({ page }) => {
  await mountDeferredInspector(page, { startInspection: false });
  const oldest = 'oldest-output-marker';
  await page.evaluate(text => window.inspectorLifecycle.output(text), oldest + '\n' + 'x'.repeat(32768 - oldest.length - 1));
  const transcript = page.getByRole('region', { name: 'Transcript output', exact: true });
  const history = page.getByRole('region', { name: 'Submitted commands and native output', exact: true });
  for (const output of [transcript, history]) {
    await expect(output).toContainText(oldest);
    expect((await output.textContent()).length).toBe(32768);
  }
  await page.evaluate(() => window.inspectorLifecycle.output('\nnewest-output-marker 😀\n'));
  for (const output of [transcript, history]) {
    await expect(output).toContainText('newest-output-marker 😀');
    await expect(output).not.toContainText(oldest);
    expect((await output.textContent()).length).toBeLessThanOrEqual(32768);
  }
  await page.getByRole('button', { name: 'Clear Transcript', exact: true }).click();
  await expect(transcript).toBeEmpty();
  await expect(history).toContainText('newest-output-marker 😀');
});

test('terminal history retains 100 commands at 101 submissions and restores unfinished input', async ({ page }) => {
  test.setTimeout(120000);
  await mountDeferredInspector(page, { startInspection: false });
  const expression = page.getByRole('textbox', { name: 'Smalltalk expression', exact: true });
  const evaluate = page.getByRole('button', { name: 'Evaluate', exact: true });
  const previous = page.getByRole('button', { name: 'Previous command', exact: true });
  const next = page.getByRole('button', { name: 'Next command', exact: true });
  // The setup's anArray submission is command one; add 99 distinct submissions.
  for (let index = 2; index <= 100; index++) {
    await expression.fill('command ' + index); await evaluate.click(); await expect(evaluate).toBeEnabled();
  }
  for (let index = 0; index < 100; index++) await previous.click();
  await expect(expression).toHaveValue('anArray'); await expect(previous).toBeDisabled();
  await expression.fill('command 101'); await evaluate.click(); await expect(evaluate).toBeEnabled();
  await expression.fill('unfinished prompt');
  for (let index = 0; index < 100; index++) await previous.click();
  await expect(expression).toHaveValue('command 2'); await expect(previous).toBeDisabled();
  for (let index = 0; index < 99; index++) await next.click();
  await expect(expression).toHaveValue('command 101'); await expect(next).toBeEnabled();
  await next.click(); await expect(expression).toHaveValue('unfinished prompt'); await expect(next).toBeDisabled();
});

test('terminal help explains how Trait definitions survive replay', async ({ page }) => {
  await mountDeferredInspector(page, { startInspection: false });
  await page.getByText('Live session help', { exact: true }).click();
  await expect(page.getByText(/Keep Trait definitions.*source files.*Restart.*check replay/)).toBeVisible();
});
