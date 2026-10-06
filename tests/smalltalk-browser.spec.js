const { test, expect: standardExpect } = require('@playwright/test');
const expect = standardExpect.configure({ timeout: 30000 });
const { mountSmalltalkFixture } = require('./helpers/smalltalk-runtime');
const { a11yCheckpoint } = require('./a11y-helpers');
const { selectAllInMonaco } = require('./helpers/monaco-keyboard');
test.setTimeout(180000);
const program = { version: 1, stepKey: 'browser', revision: 0, files: [{ path: '/counter.st', kind: 'source', format: 'filein', content: "Object subclass: #SEBookCounter instanceVariableNames: 'saved' classVariableNames: '' poolDictionaries: '' category: 'SEBook-Tests'!\n!SEBookCounter methodsFor: 'accessing'!\nvalue ^ 1!\nsaved: value saved := value!\nsaved ^ saved! !" }], changes: { version: 1, source: '', entries: [] }, runCommand: null };
async function selectCounter(page) {
  await page.getByLabel('Search packages', { exact: true }).fill('SEBook-Tests');
  await page.getByRole('region', { name: 'Packages', exact: true }).getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('listbox', { name: 'Packages', exact: true }).selectOption({ label: 'SEBook-Tests' });
  await page.getByRole('listbox', { name: 'Classes', exact: true }).selectOption({ label: 'SEBookCounter' });
  await page.getByRole('listbox', { name: 'Protocols', exact: true }).selectOption({ label: 'accessing' });
  await page.getByRole('listbox', { name: 'Methods', exact: true }).selectOption({ label: 'value' });
  await expect(page.getByRole('region', { name: 'Method source', exact: true })).toContainText('value ^ 1');
}
async function replaceSource(page, value) {
  const editor = page.getByRole('textbox', { name: /Smalltalk method source/ });
  await editor.focus(); await editor.press('Control+Home'); await editor.press('Control+Shift+End');
  await expect.poll(() => editor.evaluate(input => input.value.length > 0 && input.selectionStart === 0 && input.selectionEnd === input.value.length), { message: 'Monaco select-all is ready before replacing source' }).toBe(true);
  await page.keyboard.insertText(value);
  await expect.poll(() => page.evaluate(() => window.smalltalkFixtureWorkspace.getDrafts().find(draft => draft.target.className === 'SEBookCounter' && draft.target.selector === 'value')?.source), { message: 'Replacement creates exactly the intended draft source' }).toBe(value);
}
test('Browser preserves an invalid method draft across navigation', async ({ page }) => {
  const cleanup = await mountSmalltalkFixture(page, { program });
  try {
    await selectCounter(page);
    await expect(page.getByRole('button', { name: 'Accept', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Revert', exact: true })).toBeDisabled();
    await a11yCheckpoint(page, 'browser-loaded', { feature: 'smalltalk-browser' });
    await replaceSource(page, 'value ^ 2');
    await page.getByRole('button', { name: 'Accept', exact: true }).click();
    await expect(page.getByRole('status', { name: 'Compilation status' })).toContainText('Accepted.');
    await replaceSource(page, 'value ^ ) "badDraftToken"');
    await page.getByRole('button', { name: 'Accept', exact: true }).click();
    await expect(page.getByRole('status', { name: 'Compilation status' })).toContainText(/error/i);
    await a11yCheckpoint(page, 'browser-compile-error', { feature: 'smalltalk-browser' });
    await page.getByRole('listbox', { name: 'Methods', exact: true }).selectOption({ label: 'saved' });
    await page.getByRole('listbox', { name: 'Methods', exact: true }).selectOption({ label: 'value' });
    await expect(page.getByRole('region', { name: 'Method source', exact: true })).toContainText('badDraftToken');
    await page.getByRole('button', { name: 'Revert', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Method source', exact: true })).toContainText('value ^ 2');
    const expression = page.getByRole('textbox', { name: /Smalltalk expression/ });
    await expression.focus(); await selectAllInMonaco(expression); await page.keyboard.insertText('SEBookCounter new value');
    await page.getByRole('button', { name: 'Evaluate', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Evaluation result', exact: true })).toHaveText('2');
  } finally { await cleanup(); }
});
test('Native query results navigate system methods and preserve browser history', async ({ page }) => {
  const cleanup = await mountSmalltalkFixture(page, { program });
  try {
    await selectCounter(page);
    await page.getByRole('button', { name: 'Implementors', exact: true }).click();
    const results = page.getByRole('region', { name: 'Native query results', exact: true });
    await expect(results.getByRole('button', { name: 'SEBookCounter>>value', exact: true })).toBeVisible();
    await results.getByRole('button', { name: 'BlockClosure>>value', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Method source', exact: true })).toContainText('value');
    await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Method source', exact: true })).toContainText('value ^ 1');
    await page.getByRole('button', { name: 'Forward', exact: true }).click();
    await expect(page.getByRole('listbox', { name: 'Classes', exact: true })).toHaveValue('BlockClosure');
    await a11yCheckpoint(page, 'browser-native-query', { feature: 'smalltalk-browser' });
    const close = results.getByRole('button', { name: 'Close query results', exact: true });
    await close.focus(); await close.press('Enter');
    await expect(results).toBeHidden();
    await expect(page.getByRole('button', { name: 'Implementors', exact: true })).toBeFocused();
  } finally { await cleanup(); }
});
module.exports = { program, selectCounter, replaceSource };

test('clicking the selected class again opens its definition', async ({ page }) => {
  const cleanup = await mountSmalltalkFixture(page, { program });
  try {
    await selectCounter(page);
    const classes = page.getByRole('listbox', { name: 'Classes', exact: true });
    const source = page.getByRole('region', { name: 'Method source', exact: true });
    await expect(classes.getByRole('option')).toHaveText(['SEBookCounter']);
    // WebKit renders native options without individual hit-test rectangles.
    // Click the single visible row through its owning listbox.
    await classes.click({ position: { x: 20, y: 15 } });
    await expect(source.getByRole('heading', { name: 'Class definition', exact: true })).toBeVisible();
    await expect(source).toContainText('subclass:');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(source.getByRole('heading', { name: 'Method source', exact: true })).toBeVisible();
    await expect(source).toContainText('value ^ 1');
    await classes.focus();
    await classes.press('Enter');
    await expect(source.getByRole('heading', { name: 'Class definition', exact: true })).toBeVisible();
    await expect(source).toContainText('subclass:');
  } finally { await cleanup(); }
});

test('Closing Hierarchy results after collapsing queries focuses visible source', async ({ page }) => {
  const cleanup = await mountSmalltalkFixture(page, { program });
  try {
    await selectCounter(page);
    const disclosure = page.getByText('More browsing queries', { exact: true });
    await disclosure.click();
    await page.getByRole('button', { name: 'Hierarchy', exact: true }).click();
    const results = page.getByRole('region', { name: 'Native query results', exact: true });
    await expect(results.getByRole('status', { name: 'Query status' })).toContainText('results on this page.');
    await disclosure.click();
    await expect(page.getByRole('button', { name: 'Hierarchy', exact: true })).toBeHidden();
    const close = results.getByRole('button', { name: 'Close query results', exact: true });
    await close.focus(); await close.press('Enter');
    await expect(results).toBeHidden();
    const source = page.getByRole('region', { name: 'Method source', exact: true });
    await expect(source).toBeFocused();
    await expect(source).toBeVisible();
  } finally { await cleanup(); }
});

test('native terminal compilation refreshes clean Browser source and preserves stale drafts', async ({ page }) => {
  const cleanup = await mountSmalltalkFixture(page, { program });
  try {
    await selectCounter(page);
    const expression = page.getByRole('textbox', { name: /Smalltalk expression/ });
    await expression.focus(); await selectAllInMonaco(expression);
    await page.keyboard.insertText("SEBookCounter compile: 'value ^ 4' classified: 'accessing'. true");
    await page.getByRole('button', { name: 'Evaluate', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Evaluation result', exact: true })).toHaveText('true');
    await expect(page.getByRole('region', { name: 'Method source', exact: true })).toContainText('value ^ 4');
    await expect(page.getByRole('button', { name: 'Accept', exact: true })).toBeDisabled();
    await replaceSource(page, 'value ^ ) "crossViewDraft"');
    await expression.focus(); await selectAllInMonaco(expression);
    await page.keyboard.insertText("SEBookCounter compile: 'value ^ 5' classified: 'accessing'. true");
    await page.getByRole('button', { name: 'Evaluate', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Evaluation result', exact: true })).toHaveText('true');
    await expect(page.getByRole('region', { name: 'Method source', exact: true })).toContainText('crossViewDraft');
    await expect(page.getByRole('region', { name: 'Method source', exact: true })).toContainText('Accepted code changed');
    await page.getByRole('button', { name: 'Revert', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Method source', exact: true })).toContainText('value ^ 5');
  } finally { await cleanup(); }
});

async function openSourceViews(page) {
  await page.getByText('More browsing queries', { exact: true }).click();
  const trigger = page.getByRole('button', { name: 'Source views', exact: true });
  await trigger.focus(); await trigger.press('Enter');
  await expect(page.getByRole('region', { name: 'Browser source views', exact: true })).toBeFocused();
}
async function replaceFileSource(page, value) {
  const editor = page.getByRole('textbox', { name: /Smalltalk file or saved draft source/ });
  await editor.focus(); await selectAllInMonaco(editor); await editor.press('Backspace'); await page.keyboard.insertText(value);
}
async function readDownload(page, action) {
  const downloadPromise = page.waitForEvent('download'); await action();
  const download = await downloadPromise;
  return require('fs').readFileSync(await download.path(), 'utf8');
}
test('Authored raw source drafts accept natively and exported accepted files replay fresh', async ({ page }) => {
  const restored = { target: { kind: 'file', path: '/counter.st' }, baseRevision: 0, source: program.files[0].content.replace('value ^ 1', 'value ^ 7') };
  const cleanup = await mountSmalltalkFixture(page, { program, drafts: [restored], views: ['browser'] });
  let accepted;
  try {
    await openSourceViews(page);
    await page.getByRole('button', { name: '/counter.st', exact: true }).click();
    const view = page.getByRole('region', { name: 'Browser source views', exact: true });
    await expect(view).toContainText('value ^ 7');
    await expect(view).toContainText(/filein/);
    await page.getByRole('button', { name: 'Accept file', exact: true }).focus();
    await page.getByRole('button', { name: 'Accept file', exact: true }).press('Enter');
    await expect(page.getByRole('status', { name: 'Source view status' })).toContainText('Accepted');
    await expect(page.getByRole('button', { name: 'Accept file', exact: true })).toBeDisabled();
    await expect(view).toBeFocused();
    await a11yCheckpoint(page, 'raw-file-accepted', { feature: 'smalltalk-browser' });
    accepted = JSON.parse(await readDownload(page, () => page.getByRole('button', { name: 'Export accepted program', exact: true }).click()));
    expect(accepted.files[0]).toMatchObject({ path: '/counter.st', kind: 'source', format: 'filein' });
    expect(accepted.files[0].content).toContain('value ^ 7');
    const result = await page.evaluate(() => window.smalltalkFixtureWorkspace.evaluate('SEBookCounter new value'));
    expect(result.error).toBeNull(); expect(result.value.text).toBe('7');
  } finally { await cleanup(); }
  const { withSmalltalk } = require('./helpers/smalltalk-runtime');
  const fresh = await withSmalltalk(page, async (runtime, accepted) => runtime.withFreshSession(async session => {
    await runtime.loadProgram(session, accepted);
    return runtime.request(session, 'evaluate', { source: 'SEBookCounter new value', bindings: 'isolated' });
  }), accepted);
  expect(fresh.error).toBeNull(); expect(fresh.value.text).toBe('7');
});

test('Invalid raw-file drafts survive view switching and revert without executing resources', async ({ page }) => {
  const resourceProgram = { ...program, files: [...program.files, { path: '/notes.txt', kind: 'resource', format: null, content: 'Resource is data, not source.' }] };
  const cleanup = await mountSmalltalkFixture(page, { program: resourceProgram, views: ['browser'] });
  try {
    await openSourceViews(page); await page.getByRole('button', { name: '/counter.st', exact: true }).click();
    await replaceFileSource(page, program.files[0].content.replace('value ^ 1', 'value ^ ) "invalidRawDraft"'));
    const accept = page.getByRole('button', { name: 'Accept file', exact: true });
    await page.getByRole('textbox', { name: /Smalltalk file or saved draft source/ }).press('Escape');
    await expect(accept).toBeFocused(); await accept.press('Enter');
    await expect(page.getByRole('status', { name: 'Source view status' })).toContainText(/error/i);
    await expect(accept).toBeFocused();
    await a11yCheckpoint(page, 'raw-file-error', { feature: 'smalltalk-browser' });
    await page.getByRole('button', { name: 'Accepted changes', exact: true }).click();
    await page.getByRole('button', { name: 'Source files', exact: true }).click();
    await page.getByRole('button', { name: '/counter.st', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Browser source views', exact: true })).toContainText('invalidRawDraft');
    await page.getByRole('button', { name: 'Revert draft', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Browser source views', exact: true })).not.toContainText('invalidRawDraft');
    await page.getByRole('button', { name: '/notes.txt', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Browser source views', exact: true })).toContainText(/Resources.*not.*executable/i);
    await expect(accept).toBeDisabled();
    await page.getByRole('button', { name: 'Browse image', exact: true }).focus();
    await page.getByRole('button', { name: 'Browse image', exact: true }).press('Enter');
    await expect(page.getByRole('button', { name: 'Source views', exact: true })).toBeFocused();
  } finally { await cleanup(); }
});

test('Accepted native changes export durable code while removed-target drafts remain recoverable', async ({ page }) => {
  const cleanup = await mountSmalltalkFixture(page, { program, views: ['browser'] });
  try {
    await selectCounter(page); await replaceSource(page, 'value ^ 9');
    await page.getByRole('button', { name: 'Accept', exact: true }).click();
    await expect(page.getByRole('status', { name: 'Compilation status' })).toContainText('Accepted.');
    await page.evaluate(() => window.smalltalkFixtureWorkspace.setDraft({ target: { kind: 'method', className: 'SEBookCounter', side: 'instance', selector: 'value' }, baseRevision: window.smalltalkFixtureWorkspace.snapshot().revision, source: 'value ^ 123 "orphanRecoveryMarker"' }));
    await openSourceViews(page); await page.getByRole('button', { name: 'Accepted changes', exact: true }).click();
    const view = page.getByRole('region', { name: 'Browser source views', exact: true });
    await expect(view).toContainText('value ^ 9'); await expect(view).toContainText(/SEBookCounter.*value/);
    const accepted = JSON.parse(await readDownload(page, () => page.getByRole('button', { name: 'Export accepted program', exact: true }).click()));
    expect(accepted.changes.source).toContain('value ^ 9');
    expect(JSON.stringify(accepted)).not.toContain('orphanRecoveryMarker');
    expect(accepted).not.toHaveProperty('drafts'); expect(accepted).not.toHaveProperty('handles');
    await a11yCheckpoint(page, 'accepted-changes', { feature: 'smalltalk-browser' });
    await page.evaluate(async replacement => {
      const workspace = window.smalltalkFixtureWorkspace;
      await workspace.replaceProgram(replacement);
    }, { ...program, files: [{ ...program.files[0], content: program.files[0].content.replaceAll('SEBookCounter', 'ReplacementCounter') }] });
    const oldClass = await page.evaluate(() => window.smalltalkFixtureWorkspace.browse({ kind: 'classes', search: 'SEBookCounter', offset: 0, limit: 100 }));
    expect(oldClass.items).toHaveLength(0);
    await page.getByRole('button', { name: 'Saved drafts', exact: true }).click();
    await page.getByRole('button', { name: /method.*SEBookCounter.*value/ }).click();
    await expect(view).toContainText('orphanRecoveryMarker'); await expect(view).toContainText(/base revision 1/);
    await expect(view).toContainText(/recover.*source|source.*recover/i);
    const recovered = await readDownload(page, () => page.getByRole('button', { name: 'Download draft source', exact: true }).click());
    expect(recovered).toContain('orphanRecoveryMarker');
    await expect(page.getByRole('button', { name: 'Accept file', exact: true })).toBeDisabled();
    await page.setViewportSize({ width: 320, height: 900 });
    await expect(page.getByRole('button', { name: 'Download draft source', exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), { message: 'Source view reflows at320px after editor layout' }).toBe(true);
    await page.screenshot({ path: '/private/tmp/smalltalk-source-views-320-light.png', fullPage: true });
    await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
    await page.screenshot({ path: '/private/tmp/smalltalk-source-views-320-dark.png', fullPage: true });
    await page.evaluate(() => document.documentElement.classList.remove('dark-mode'));
    await a11yCheckpoint(page, 'recoverable-draft-narrow', { feature: 'smalltalk-browser' });
    await page.getByRole('button', { name: 'Revert draft', exact: true }).click();
    await expect(view).not.toContainText('orphanRecoveryMarker');
  } finally { await cleanup(); }
});

test('Final native package page preserves selection identity and keyboard focus', async ({ page }) => {
  const cleanup = await mountSmalltalkFixture(page, { program, views: ['browser'] });
  try {
    await page.evaluate(() => window.smalltalkFixtureBrowser.navigate({ kind: 'class', className: 'SEBookCounter', packageName: 'SEBook-Tests', side: 'instance' }));
    const list = page.getByRole('listbox', { name: 'Packages', exact: true });
    const next = page.getByRole('button', { name: 'Next packages', exact: true, includeHidden: true });
    await expect(next).toBeVisible();
    while (await next.isVisible()) {
      const before = await list.getByRole('option').count();
      await next.focus(); await next.press('Enter');
      await expect.poll(() => list.getByRole('option').count(), { message: 'Native package page appended' }).toBeGreaterThan(before);
    }
    await expect(list).toBeFocused();
    await expect(list.getByRole('option', { name: 'SEBook-Tests', exact: true })).toHaveCount(1);
    await expect(list).toHaveValue('SEBook-Tests');
  } finally { await cleanup(); }
});

test('Final query page returns keyboard focus to a visible result', async ({ page }) => {
  // Public browse-result boundary controls only pagination/focus, not Smalltalk execution.
  const { installSmalltalk } = require('./helpers/smalltalk-runtime'); await installSmalltalk(page);
  for (const url of ['/js/smalltalk/workspace.js', '/js/smalltalk/source-views.js', '/js/smalltalk/browser.js']) await page.addScriptTag({ url });
  await page.evaluate(async () => {
    const target = { kind: 'method', className: 'Counter', side: 'instance', selector: 'value', packageName: 'Example' };
    const workspace = { snapshot: () => ({ revision: 0, files: [], changes: { source: '', entries: [] } }), getDrafts: () => [], subscribe: () => () => {},
      async browse({ kind, offset }) {
        return { revision: 0, source: 'value ^ 1', items: kind === 'implementors' ? [{ id: 'result-' + offset, label: offset ? 'Last implementation' : 'First implementation', target }] : [], nextOffset: kind === 'implementors' && !offset ? 1 : null };
      },
    };
    const view = window.SEBookSmalltalk.Browser.mount({ root: document.body, workspace,
      createEditor({ element, ariaLabel }) {
        const input = document.createElement('textarea'); input.setAttribute('aria-label', ariaLabel); element.append(input);
        return { getValue: () => input.value, setValue: value => { input.value = value; }, dispose: () => input.remove() };
      },
    });
    await view.ready; await view.navigate(target); window.cleanupQueryFocus = () => view.dispose();
  });
  try {
    await page.getByRole('button', { name: 'Implementors', exact: true }).click();
    const results = page.getByRole('region', { name: 'Native query results', exact: true });
    const next = results.getByRole('button', { name: 'Next results', exact: true, includeHidden: true });
    await expect(next).toBeVisible(); await next.focus(); await next.press('Enter');
    await expect(next).toBeHidden();
    await expect(results.getByRole('button', { name: 'Last implementation', exact: true })).toBeFocused();
  } finally { await page.evaluate(() => window.cleanupQueryFocus()); }
});

// Public Workspace events control only presentation refresh/print in these component cases.
// Native file compilation and durable replay remain covered by the real-image journeys above.
async function mountSourcePresentationFixture(page) {
  await page.goto('/robots.txt');
  await page.setContent('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noai, noimageai, noarchive"><meta name="tdm-reservation" content="1"><title>Source presentation fixture</title></head><body><main><h1>Smalltalk source presentation</h1><section class="smalltalk-browser" id="source-root"><h2>System Browser</h2></section></main></body></html>');
  for (const url of ['/css/bootstrap.ucla.css', '/css/design-tokens.css', '/css/portfolio.css', '/css/smalltalk-browser.css', '/css/print-light.css']) await page.addStyleTag({ url });
  for (const url of ['/js/smalltalk/protocol.js', '/js/smalltalk/workspace.js', '/js/smalltalk/source-views.js']) await page.addScriptTag({ url });
  await page.evaluate(() => {
    let program = { version: 1, revision: 0, files: [
      { path: '/one.st', kind: 'source', format: 'doit', content: 'uniquePrintedSourceToken := 42.' },
      { path: '/resource.txt', kind: 'resource', format: null, content: 'Distinct resource content.' },
    ], changes: { version: 1, source: '', entries: [] }, runCommand: null };
    let drafts = [{ target: { kind: 'method', className: 'FormerCounter', side: 'instance', selector: 'oldValue' }, baseRevision: 0, source: 'oldValue ^ \'uniqueRecoveryPrintToken\'' }];
    const listeners = new Set(); const copy = value => structuredClone(value);
    const emit = type => listeners.forEach(listener => listener({ type, program: copy(program), drafts: copy(drafts) }));
    const workspace = {
      snapshot: () => copy(program), getDrafts: () => copy(drafts),
      subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
      setDraft(draft) { drafts = drafts.filter(entry => window.SEBookSmalltalk.entityKey(entry.target) !== window.SEBookSmalltalk.entityKey(draft.target)).concat(copy(draft)); emit('drafts'); },
      revertDraft(target) { drafts = drafts.filter(entry => window.SEBookSmalltalk.entityKey(entry.target) !== window.SEBookSmalltalk.entityKey(target)); emit('drafts'); },
      updateProgram(nextProgram) { program = copy(nextProgram); emit('program'); },
    };
    const view = window.SEBookSmalltalk.SourceViews.mount({ root: document.getElementById('source-root'), workspace, onClose() {},
      createEditor({ element, value, ariaLabel }) {
        const input = document.createElement('textarea'); input.value = value; input.setAttribute('aria-label', ariaLabel); element.append(input);
        return { getValue: () => input.value, setValue: value => { input.value = value; }, dispose: () => input.remove() };
      },
    });
    window.sourcePresentationWorkspace = workspace; window.disposeSourcePresentation = () => view.dispose(); view.open();
  });
}

test('Source choices preserve surviving keyboard identities and focus elsewhere during subscribed refreshes', async ({ page }) => {
  await mountSourcePresentationFixture(page);
  try {
    const fileChoice = page.getByRole('button', { name: '/one.st', exact: true });
    await fileChoice.focus();
    await page.evaluate(() => window.sourcePresentationWorkspace.setDraft({ target: { kind: 'file', path: '/one.st' }, baseRevision: 0, source: 'uniquePrintedSourceToken := 43.' }));
    await expect(fileChoice).toBeFocused();
    const exportControl = page.getByRole('button', { name: 'Export accepted program', exact: true });
    await exportControl.focus();
    await page.evaluate(() => window.sourcePresentationWorkspace.setDraft({ target: { kind: 'file', path: '/one.st' }, baseRevision: 0, source: 'uniquePrintedSourceToken := 44.' }));
    await expect(exportControl).toBeFocused();
    await page.getByRole('button', { name: 'Saved drafts', exact: true }).click();
    const recoveryChoice = page.getByRole('button', { name: /FormerCounter.*oldValue/ });
    await recoveryChoice.focus();
    await page.evaluate(() => {
      const workspace = window.sourcePresentationWorkspace;
      workspace.updateProgram({ ...workspace.snapshot(), revision: 1 });
    });
    await expect(recoveryChoice).toBeFocused();
  } finally { await page.evaluate(() => window.disposeSourcePresentation()); }
});

test('Removed focused source choices return keyboard focus to the visible source-view control', async ({ page }) => {
  await mountSourcePresentationFixture(page);
  try {
    await page.getByRole('button', { name: '/one.st', exact: true }).focus();
    await page.evaluate(() => {
      const workspace = window.sourcePresentationWorkspace;
      workspace.updateProgram({ ...workspace.snapshot(), revision: 1, files: workspace.snapshot().files.filter(file => file.path !== '/one.st') });
    });
    await expect(page.getByRole('button', { name: 'Source files', exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Saved drafts', exact: true }).click();
    await page.getByRole('button', { name: /FormerCounter.*oldValue/ }).focus();
    await page.evaluate(() => window.sourcePresentationWorkspace.revertDraft({ kind: 'method', className: 'FormerCounter', side: 'instance', selector: 'oldValue' }));
    await expect(page.getByRole('button', { name: 'Saved drafts', exact: true })).toBeFocused();
    await expect(page.getByRole('button', { name: /FormerCounter.*oldValue/ })).toHaveCount(0);
  } finally { await page.evaluate(() => window.disposeSourcePresentation()); }
});

async function expectPrintedAccessibleSource(page, source) {
  const printedSource = page.getByText(source, { exact: true }).filter({ visible: true });
  await expect(printedSource).toBeVisible();
  await expect(printedSource).toMatchAriaSnapshot('- text: ' + JSON.stringify(source));
  // All engines verify semantic source exposure; Chromium additionally checks its native AX tree.
  if (page.context().browser().browserType().name() !== 'chromium') return;
  const session = await page.context().newCDPSession(page);
  try {
    const tree = await session.send('Accessibility.getFullAXTree');
    expect(tree.nodes.some(node => !node.ignored && node.name && node.name.value.includes(source))).toBe(true);
  } finally { await session.detach(); }
}
for (const kind of ['authored', 'recovery']) {
  test(`Printed ${kind} source has an accessible alternative when its editor is hidden`, async ({ page }) => {
    await mountSourcePresentationFixture(page);
    try {
      if (kind === 'authored') await page.getByRole('button', { name: '/one.st', exact: true }).click();
      else {
        await page.getByRole('button', { name: 'Saved drafts', exact: true }).click();
        await page.getByRole('button', { name: /FormerCounter.*oldValue/ }).click();
      }
      await page.emulateMedia({ media: 'print' });
      await expect(page.getByRole('textbox', { name: 'Smalltalk file or saved draft source', exact: true, includeHidden: true })).toBeHidden();
      await expectPrintedAccessibleSource(page, kind === 'authored' ? 'uniquePrintedSourceToken := 42.' : 'oldValue ^ \'uniqueRecoveryPrintToken\'');
    } finally { await page.evaluate(() => window.disposeSourcePresentation()); }
  });
}

test('Printed resource content has one visible representation', async ({ page }) => {
  await mountSourcePresentationFixture(page);
  try {
    await page.getByRole('button', { name: '/resource.txt', exact: true }).click();
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByText('Distinct resource content.', { exact: true }).filter({ visible: true })).toHaveCount(1);
    await expectPrintedAccessibleSource(page, 'Distinct resource content.');
  } finally { await page.evaluate(() => window.disposeSourcePresentation()); }
});
