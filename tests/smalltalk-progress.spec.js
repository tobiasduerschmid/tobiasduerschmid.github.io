const { test, expect } = require('@playwright/test');
const { loadTutorialConfig } = require('./tutorial-helpers');
const { a11yCheckpoint } = require('./a11y-helpers');
const config = loadTutorialConfig('smalltalk');
const KEY = 'tutorial-progress-smalltalk';
const STEP = config.steps[0].key;
const invalidSource = 'increment\n count := ) invalidSavedDraft.';
const output = page => page.getByRole('region', { name: 'Program output', exact: true });
test.setTimeout(180000);
async function ready(page, query = '') {
  await page.goto('/SEBook/tools/smalltalk-tutorial' + query);
  await expect(page.locator('.tvm-loading')).toBeHidden({ timeout: 120000 });
  await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled();
  await expect(page.getByRole('checkbox', { name: 'Auto-save', exact: true })).toBeVisible();
}
async function stored(page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), KEY); }
async function run(page, expected) {
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(output(page)).toContainText(new RegExp('Result: ' + expected + '\\s*$'), { timeout: 30000 });
  await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled();
}

test('reload restores accepted code separately from an invalid draft', async ({ page }) => {
  await ready(page);
  const acceptedChanges = await page.evaluate(async invalidSource => {
    const workspace = window._tutorial._smalltalkAdapter.getWorkspace();
    await workspace.commit({ baseRevision: workspace.snapshot().revision, action: 'acceptMethod', params: {
      target: { kind: 'method', className: 'SEBookCounter', side: 'instance', selector: 'increment' },
      source: 'increment count := count + 2. ^ self', protocol: 'accessing',
    } });
    const generated = await workspace.evaluate("Object subclass: #SEBookSavedGenerated instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Progress'. SEBookSavedGenerated compile: 'answer ^ 42' classified: 'accessing'. SEBookCounter class removeSelector: #checkIndependentCounters");
    if (generated.error) throw new Error(generated.error.message);
    const program = workspace.snapshot();
    if (!program.changes.entries.some(entry => entry.entity.className === 'SEBookSavedGenerated' && entry.after !== null)) throw new Error('Generated definition was not captured');
    if (!program.changes.entries.some(entry => entry.entity.selector === 'checkIndependentCounters' && entry.after === null)) throw new Error('Native removal was not captured');
    workspace.setDraft({ target: { kind: 'method', className: 'SEBookCounter', side: 'instance', selector: 'increment' }, baseRevision: program.revision, source: invalidSource });
    await workspace.evaluate('Smalltalk at: #ProgressLiveCounter put: SEBookCounter new');
    return program.changes.source;
  }, invalidSource);
  await expect.poll(async () => {
    const value = await stored(page); return value && value.smalltalk_workspace && value.smalltalk_workspace.steps[STEP].program.changes.source;
  }).toBe(acceptedChanges);
  await ready(page);
  const restored = await page.evaluate(() => {
    const workspace = window._tutorial._smalltalkAdapter.getWorkspace();
    return { program: workspace.snapshot(), drafts: workspace.getDrafts() };
  });
  expect(restored.program.changes.source).toBe(acceptedChanges);
  expect(restored.drafts[0].source).toBe(invalidSource);
  await page.getByRole('listbox', { name: 'Methods', exact: true }).selectOption({ label: 'increment' });
  await expect(page.getByRole('region', { name: 'Method source', exact: true })).toContainText('invalidSavedDraft');
  await run(page, 2);
  const native = await page.evaluate(async () => {
    const workspace = window._tutorial._smalltalkAdapter.getWorkspace();
    const generated = await workspace.evaluate('SEBookSavedGenerated new answer');
    const removed = await workspace.evaluate('SEBookCounter class includesSelector: #checkIndependentCounters');
    const live = await workspace.evaluate('Smalltalk includesKey: #ProgressLiveCounter');
    return { generated: generated.value.text, removed: removed.value.booleanValue, live: live.value.booleanValue };
  });
  expect(native).toEqual({ generated: '42', removed: false, live: false });
});

test('targeted save retains native accepted changes and reports quota failure without corrupting the last save', async ({ page }) => {
  await ready(page);
  await page.evaluate(async source => {
    const workspace = window._tutorial._smalltalkAdapter.getWorkspace();
    await workspace.commit({ baseRevision: workspace.snapshot().revision, action: 'acceptMethod', params: {
      target: { kind: 'method', className: 'SEBookCounter', side: 'instance', selector: 'increment' },
      source: 'increment count := count + 2. ^ self', protocol: 'accessing',
    } });
    workspace.setDraft({ target: { kind: 'file', path: 'Counter.st' }, baseRevision: workspace.snapshot().revision, source });
  }, ') invalid file draft');
  const saved = await page.evaluate(() => window._tutorial._saveFile('Counter.st'));
  expect(saved).toBe(true);
  const before = await stored(page);
  expect(before.smalltalk_workspace.steps[STEP].drafts[0].source).toBe(') invalid file draft');
  expect(before.smalltalk_workspace.steps[STEP].program.changes.source).toContain('count + 2');
  const result = await page.evaluate(key => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) { if (name === key) throw new DOMException('Quota exceeded', 'QuotaExceededError'); return original.call(this, name, value); };
    try { return window._tutorial._autoSaveProgress(); } finally { Storage.prototype.setItem = original; }
  }, KEY);
  expect(result).toBe(false);
  await expect(page.getByRole('status').filter({ hasText: 'Auto-save failed' })).toContainText('Your latest changes are not saved');
  await expect(page.getByText('Save failed', { exact: true })).toBeVisible();
  expect(await stored(page)).toEqual(before);
});

test('disabling Auto-save prevents saving and restoring accepted code or drafts', async ({ page }) => {
  await ready(page);
  const beforeReset = await page.evaluate(() => window._tutorial._smalltalkAdapter.getProgram().revision);
  const toggle = page.getByRole('checkbox', { name: 'Auto-save', exact: true });
  await toggle.focus(); await expect(toggle).toBeFocused(); await toggle.press('Space');
  await page.getByRole('dialog', { name: 'Delete saved progress?', exact: true }).getByRole('button', { name: 'Yes', exact: true }).click();
  // Deletion also resets native accepted source; edit after that transaction.
  await expect.poll(() => page.evaluate(() => window._tutorial._smalltalkAdapter.getProgram().revision), { timeout: 30000 }).not.toBe(beforeReset);
  await page.evaluate(async source => {
    const workspace = window._tutorial._smalltalkAdapter.getWorkspace();
    await workspace.commit({ baseRevision: workspace.snapshot().revision, action: 'acceptMethod', params: {
      target: { kind: 'method', className: 'SEBookCounter', side: 'instance', selector: 'increment' },
      source: 'increment count := count + 2. ^ self', protocol: 'accessing',
    } });
    workspace.setDraft({ target: { kind: 'method', className: 'SEBookCounter', side: 'instance', selector: 'increment' }, baseRevision: workspace.snapshot().revision, source });
  }, invalidSource);
  expect(await stored(page)).toBeNull();
  await run(page, 2);
  await ready(page);
  await expect(page.getByRole('checkbox', { name: 'Auto-save', exact: true })).not.toBeChecked();
  expect(await page.evaluate(() => window._tutorial._smalltalkAdapter.getWorkspace().getDrafts())).toEqual([]);
  expect(await stored(page)).toBeNull();
  await run(page, 1);
});

test('legacy saved files remain unaccepted and Reset persists a clean starter', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(({ key, source }) => localStorage.setItem(key, JSON.stringify({ step: 0, files: { 'Counter.st': { content: source, language: 'smalltalk' } }, stepsPassed: [] })), { key: KEY, source: ') legacy malformed file' });
  await ready(page);
  expect(await page.evaluate(() => window._tutorial._smalltalkAdapter.getWorkspace().getDrafts())).toEqual([
    { target: { kind: 'file', path: 'Counter.st' }, baseRevision: 0, source: ') legacy malformed file' },
  ]);
  await run(page, 1);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('link', { name: 'Reset Current Step', exact: true }).click();
  await expect.poll(async () => {
    const value = await stored(page); return value && value.smalltalk_workspace && value.smalltalk_workspace.steps[STEP].drafts;
  }, { timeout: 30000 }).toEqual([]);
  await ready(page);
  expect(await page.evaluate(() => window._tutorial._smalltalkAdapter.getWorkspace().getDrafts())).toEqual([]);
  await run(page, 1);
});

test('unsupported progress warns while preserving recoverable drafts and running the starter', async ({ page }) => {
  await ready(page);
  await page.evaluate(({ key, step, source }) => {
    const program = window._tutorial._smalltalkAdapter.getProgram();
    program.changes.source = 'This unsupported accepted source must never execute';
    localStorage.setItem(key, JSON.stringify({ step: 0, files: {}, smalltalk_workspace: { version: 99, steps: { [step]: {
      program, drafts: [{ target: { kind: 'method', className: 'SEBookCounter', side: 'instance', selector: 'increment' }, baseRevision: 0, source }],
    } } } }));
  }, { key: KEY, step: STEP, source: invalidSource });
  await ready(page);
  await expect(page.getByRole('alert', { name: 'Smalltalk progress restoration', exact: true })).toContainText('unsupported');
  expect(await page.evaluate(() => window._tutorial._smalltalkAdapter.getWorkspace().getDrafts()[0].source)).toBe(invalidSource);
  await run(page, 1);
  await a11yCheckpoint(page, 'unsupported Smalltalk progress restoration', { feature: 'smalltalk-progress' });
});

test('step reordering restores accepted code and drafts by stable key', async ({ page }) => {
  await ready(page);
  await page.evaluate(async ({ key, step, source }) => {
    const tutorial = window._tutorial;
    const workspace = tutorial._smalltalkAdapter.getWorkspace();
    await workspace.commit({ baseRevision: workspace.snapshot().revision, action: 'acceptMethod', params: {
      target: { kind: 'method', className: 'SEBookCounter', side: 'instance', selector: 'increment' },
      source: 'increment count := count + 2. ^ self', protocol: 'accessing',
    } });
    workspace.setDraft({ target: { kind: 'method', className: 'SEBookCounter', side: 'instance', selector: 'increment' }, baseRevision: workspace.snapshot().revision, source });
    tutorial.saveProgress();
    // Public transfer format from a prior ordering: this lesson was index 1.
    const record = JSON.parse(localStorage.getItem(key));
    record.stepKeys = ['additional-counter', step]; record.step = 1;
    const other = structuredClone(record.smalltalk_workspace.steps[step]);
    other.program.stepKey = 'additional-counter'; other.drafts[0].source = 'other step draft';
    record.smalltalk_workspace.steps['additional-counter'] = other;
    localStorage.setItem(key, JSON.stringify(record));
  }, { key: KEY, step: STEP, source: invalidSource });
  const before = await stored(page);
  expect(before.smalltalk_workspace.steps['additional-counter'].drafts[0].source).toBe('other step draft');
  await ready(page);
  expect(await page.evaluate(() => window._tutorial._smalltalkAdapter.getWorkspace().getDrafts()[0].source)).toBe(invalidSource);
  expect((await stored(page)).smalltalk_workspace.steps['additional-counter']).toEqual(before.smalltalk_workspace.steps['additional-counter']);
  await run(page, 2);
});

test('native compile failure leaves imported accepted source and drafts available without overwriting the record', async ({ page }) => {
  await ready(page);
  const imported = await page.evaluate(({ key, step, source }) => {
    const program = window._tutorial._smalltalkAdapter.getProgram();
    program.changes.source = "!SEBookCounter methodsFor: 'accessing'!\nincrement\n ^ )\n! !";
    const record = { step: 0, files: {}, smalltalk_workspace: { version: 1, steps: { [step]: {
      program, drafts: [{ target: { kind: 'method', className: 'SEBookCounter', side: 'instance', selector: 'increment' }, baseRevision: 0, source }],
    } } } };
    localStorage.setItem(key, JSON.stringify(record)); return record;
  }, { key: KEY, step: STEP, source: invalidSource });
  await page.reload();
  await expect(page.getByRole('alert').filter({ has: page.getByRole('heading', { name: 'Tutorial Error', exact: true }) })).toContainText('Failed to restore progress', { timeout: 120000 });
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
  expect(await stored(page)).toEqual(imported);
});

test('SE Gym round-trips the complete Smalltalk extension and retains existing transfer limits', async ({ page }) => {
  const value = { step: 0, files: {}, smalltalk_workspace: { version: 1, steps: { [STEP]: { program: { changes: { source: 'generated source and native removals' } }, drafts: [{ source: invalidSource }] } } } };
  await page.goto('/se-gym/');
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: KEY, value });
  await page.reload();
  await page.getByRole('button', { name: /Download Tutorial Progress$/ }).click();
  const downloaded = page.waitForEvent('download');
  await page.locator('#tutorial-export-confirm').click();
  const download = await downloaded;
  const fs = require('node:fs/promises');
  const exported = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
  expect(exported.entries[KEY].value).toEqual(value);
  await page.evaluate(key => localStorage.removeItem(key), KEY);
  const upload = payload => page.locator('#upload-tutorial-progress-input').setInputFiles({ name: 'progress.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(payload)) });
  await upload(exported);
  await page.locator('#tutorial-import-confirm').click();
  expect(await stored(page)).toEqual(value);
  await upload({ format: 'se-gym-tutorial-progress', version: 1, entries: Object.fromEntries(Array.from({ length: 250 }, (_, index) => ['tutorial-progress-entry-' + index, { value: {} }])) });
  await expect(page.locator('#tutorial-import-list').getByRole('checkbox')).toHaveCount(250);
  await page.locator('#tutorial-import-cancel').click();
  const atLimit = { format: 'se-gym-tutorial-progress', version: 1, entries: { [KEY]: { value: { padding: '' } } } };
  atLimit.entries[KEY].value.padding = 'x'.repeat(4 * 1024 * 1024 - Buffer.byteLength(JSON.stringify(atLimit)));
  expect(Buffer.byteLength(JSON.stringify(atLimit))).toBe(4 * 1024 * 1024);
  await upload(atLimit);
  await expect(page.locator('#tutorial-import-modal')).not.toHaveClass(/is-hidden/);
  await page.locator('#tutorial-import-cancel').click();
  await upload({ format: 'se-gym-tutorial-progress', version: 1, entries: Object.fromEntries(Array.from({ length: 251 }, (_, index) => ['tutorial-progress-entry-' + index, { value: {} }])) });
  await expect(page.getByRole('status').filter({ hasText: 'too many tutorial entries' })).toBeVisible();
  await upload({ format: 'se-gym-tutorial-progress', version: 1, entries: { [KEY]: { value: { padding: 'x'.repeat(4 * 1024 * 1024) } } } });
  await expect(page.getByRole('status').filter({ hasText: 'too large' })).toBeVisible();
  expect(await stored(page)).toEqual(value);
});

for (const choice of ['Yes', 'No']) test('multi-step Auto-save ' + choice + ' keeps deletion distinct from ordinary disabling', async ({ page }) => {
  await ready(page, '?instructor-mode=true');
  await page.evaluate(async source => {
    const tutorial = window._tutorial;
    const workspace = tutorial._smalltalkAdapter.getWorkspace();
    await workspace.commit({ baseRevision: workspace.snapshot().revision, action: 'acceptMethod', params: {
      target: { kind: 'method', className: 'SEBookCounter', side: 'instance', selector: 'increment' },
      source: 'increment count := count + 2. ^ self', protocol: 'accessing',
    } });
    workspace.setDraft({ target: { kind: 'method', className: 'SEBookCounter', side: 'instance', selector: 'increment' }, baseRevision: workspace.snapshot().revision, source });
    const second = structuredClone(tutorial.steps[0]); second.key = 'second-counter'; second.title = 'Second native step';
    tutorial.steps.push(second);
    await tutorial.loadStep(1);
  }, invalidSource);
  const before = await stored(page);
  expect(before.smalltalk_workspace.steps[STEP].drafts[0].source).toBe(invalidSource);
  const revision = await page.evaluate(() => window._tutorial._smalltalkAdapter.getProgram().revision);
  const toggle = page.getByRole('checkbox', { name: 'Auto-save', exact: true });
  await toggle.focus(); await toggle.press('Space');
  await page.getByRole('dialog', { name: 'Delete saved progress?', exact: true }).getByRole('button', { name: choice, exact: true }).click();
  if (choice === 'Yes') {
    await expect.poll(() => page.evaluate(() => window._tutorial._smalltalkAdapter.getProgram().revision), { timeout: 30000 }).not.toBe(revision);
    expect(await stored(page)).toBeNull();
  } else expect(await stored(page)).toEqual(before);
  await toggle.focus(); await toggle.press('Space');
  const reenabling = await stored(page);
  if (choice === 'Yes') expect(reenabling.smalltalk_workspace.steps[STEP]).toBeUndefined();
  else expect(reenabling.smalltalk_workspace.steps[STEP].drafts[0].source).toBe(invalidSource);
  await page.evaluate(() => window._tutorial.loadStep(0));
  const drafts = await page.evaluate(() => window._tutorial._smalltalkAdapter.getWorkspace().getDrafts());
  if (choice === 'Yes') expect(drafts).toEqual([]);
  else expect(drafts[0].source).toBe(invalidSource);
  await run(page, choice === 'Yes' ? 1 : 2);
});

test('authored absolute source paths migrate original legacy keys into visible canonical file drafts', async ({ page }) => {
  await ready(page, '?instructor-mode=true');
  await page.evaluate(async key => {
    const tutorial = window._tutorial;
    const step = structuredClone(tutorial.steps[0]); step.key = 'absolute-counter'; step.title = 'Absolute authored source';
    step.files[0].path = '/tutorial/Counter.st'; step.run_file = '/tutorial/Counter.st';
    tutorial.steps.push(step);
    localStorage.setItem(key, JSON.stringify({ step: 0, files: { '/tutorial/Counter.st': { content: ') absolute legacy source', language: 'smalltalk' } } }));
    await tutorial.loadStep(1);
  }, KEY);
  expect(await page.evaluate(() => window._tutorial._smalltalkAdapter.getProgram().files[0].path)).toBe('Counter.st');
  const record = await stored(page);
  expect(record.smalltalk_workspace.steps['absolute-counter'].drafts[0].source).toBe(') absolute legacy source');
  expect(record.files['/tutorial/Counter.st']).toBeUndefined();
  await page.getByText('Browser tools', { exact: true }).click();
  await page.getByText('More browsing queries', { exact: true }).click();
  await page.getByRole('button', { name: 'Source views', exact: true }).click();
  await page.getByRole('region', { name: 'Browser source views', exact: true }).getByRole('button', { name: 'Counter.st', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Selected saved source', exact: true })).toContainText(') absolute legacy source');
  await run(page, 1);
});

test('conflicting legacy aliases retain alternative source and warn again after reload', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(key => localStorage.setItem(key, JSON.stringify({ step: 0, files: {
    'Counter.st': { content: ') canonical learner version' }, '/tutorial/Counter.st': { content: ') alternative absolute version' },
  } })), KEY);
  await ready(page);
  const warning = page.getByRole('alert', { name: 'Smalltalk progress restoration', exact: true });
  await expect(warning).toContainText('/tutorial/Counter.st');
  await expect(warning).toContainText('original progress record for export');
  const saved = await stored(page);
  expect(saved.smalltalk_workspace.steps[STEP].drafts[0].source).toBe(') canonical learner version');
  expect(saved.files['Counter.st']).toBeUndefined();
  expect(saved.files['/tutorial/Counter.st'].content).toBe(') alternative absolute version');
  await ready(page);
  await expect(warning).toContainText('/tutorial/Counter.st');
  expect((await stored(page)).files['/tutorial/Counter.st'].content).toBe(') alternative absolute version');
  await run(page, 1);
  await a11yCheckpoint(page, 'conflicting legacy Smalltalk aliases', { feature: 'smalltalk-progress' });
});
