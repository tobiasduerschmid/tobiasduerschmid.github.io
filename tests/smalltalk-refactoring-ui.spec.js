const features = require('./helpers/smalltalk-features');
const { test, expect: standardExpect } = require('@playwright/test');
const expect = standardExpect.configure({ timeout: 30000 });
const fs = require('node:fs');
const { mountSmalltalkFixture } = require('./helpers/smalltalk-runtime');
const { a11yCheckpoint } = require('./a11y-helpers');
test.setTimeout(180000);
const source = fs.readFileSync(require('node:path').join(__dirname, 'fixtures/smalltalk/refactorings.st'), 'utf8');
const program = { version: 1, revision: 0, files: [{ path: '/fixture.st', kind: 'source', format: 'filein', content: source }], changes: { version: 1, source: '', entries: [] }, runCommand: null };
const target = { kind: 'method', className: 'SEBookRenameTarget', side: 'instance', selector: 'oldSelector', packageName: 'SEBook-Refactor-Target' };
async function open(page, action = 'renameMethod') {
  await page.getByRole('button', { name: 'Refactor', exact: true }).click();
  await page.getByLabel('Refactoring action', { exact: true }).selectOption(action);
}
async function previewRename(page) {
  await open(page); await page.getByLabel('New selector', { exact: true }).fill('newSelector');
  await page.getByRole('button', { name: 'Preview refactoring', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Apply refactoring', exact: true })).toBeEnabled({ timeout: 60000 });
}
async function mount(page, data = program, selected = target) {
  const cleanup = await mountSmalltalkFixture(page, { program: data, views: ['browser', 'refactorings'] });
  await page.evaluate(target => window.smalltalkFixtureBrowser.navigate(target), selected);
  return cleanup;
}
async function behavior(page, expression) {
  const result = await page.evaluate(source => window.smalltalkFixtureWorkspace.evaluate(source), expression);
  expect(result.error).toBeNull(); expect(result.value.booleanValue).toBe(true);
}
test('native refactoring preview applies once and ordinary edits end Undo history', async ({ page }) => {
  test.skip(!features.refactorings, 'Native refactorings are deferred; their implementation is retained for future activation.');
  const cleanup = await mount(page);
  try {
    await previewRename(page);
    const dialog = page.getByRole('dialog', { name: 'Native Smalltalk refactoring', exact: true });
    await expect(dialog).toContainText('Base revision 0');
    await expect(dialog.getByRole('heading', { name: /SEBook-Refactor-(Target|Outside).*SEBookRename/ })).toHaveCount(7);
    for (const definition of ['SEBookRenameTarget', 'SEBookRenameChild', 'SEBookRenameCaller']) await expect(dialog).toContainText(definition);
    await expect(dialog).toContainText(/dynamic/i); await expect(dialog).toContainText('SEBook-Refactor-Outside');
    await behavior(page, '(SEBookRenameCaller new call: SEBookRenameChild new) = 42');
    await a11yCheckpoint(page, 'native-preview', { feature: 'smalltalk-refactoring' });
    await page.getByRole('button', { name: 'Apply refactoring', exact: true }).click();
    await expect(dialog).toBeHidden({ timeout: 60000 });
    expect(await page.evaluate(() => window.smalltalkFixtureWorkspace.snapshot().revision)).toBe(1);
    await expect(page.getByRole('button', { name: 'Undo refactoring', exact: true })).toBeEnabled();
    await behavior(page, '(SEBookRenameCaller new call: SEBookRenameChild new) = 42 and: [(SEBookRenameTarget includesSelector: #oldSelector) not]');
    await page.getByRole('button', { name: 'Undo refactoring', exact: true }).focus();
    await page.getByRole('button', { name: 'Undo refactoring', exact: true }).press('Enter');
    await expect(page.getByRole('button', { name: 'Redo refactoring', exact: true })).toBeFocused();
    await behavior(page, 'SEBookRenameTarget new oldSelector = 41');
    await page.getByRole('button', { name: 'Redo refactoring', exact: true }).press('Enter');
    await expect(page.getByRole('button', { name: 'Undo refactoring', exact: true })).toBeFocused();
    await page.evaluate(async target => { const workspace = window.smalltalkFixtureWorkspace; await workspace.commit({ baseRevision: workspace.snapshot().revision, action: 'acceptMethod', params: { target: { ...target, selector: 'newSelector' }, source: 'newSelector ^ 73', protocol: 'accessing' } }); }, target);
    await expect(page.getByRole('button', { name: 'Undo refactoring', exact: true })).toBeDisabled();
    await expect(page.getByRole('status', { name: 'Refactoring history', exact: true })).toContainText(/ordinary accepted.*edit/i);
    await a11yCheckpoint(page, 'disabled-history', { feature: 'smalltalk-refactoring' });
    await page.evaluate(target => window.smalltalkFixtureBrowser.navigate({ ...target, selector: 'newSelector' }), target);
    await page.getByText('More browsing queries', { exact: true }).click();
    await page.getByRole('button', { name: 'Versions', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Native query results', exact: true })).toContainText('newSelector ^ 41');
    await page.getByRole('button', { name: /^Select version 2(?:\s|$)/ }).click();
    await page.getByRole('button', { name: 'Restore version', exact: true }).click();
    await expect(page.getByRole('status', { name: 'Query status', exact: true })).toContainText(/restored.*new edit/i, { timeout: 60000 });
    await behavior(page, 'SEBookRenameTarget new newSelector = 41');
  } finally { await cleanup(); }
});

test('required options and native collisions explain errors without mutation', async ({ page }) => {
  test.skip(!features.refactorings, 'Native refactorings are deferred; their implementation is retained for future activation.');
  const cleanup = await mount(page);
  try {
    await open(page);
    await page.getByRole('button', { name: 'Preview refactoring', exact: true }).click();
    await expect(page.getByRole('status', { name: 'Refactoring status', exact: true })).toContainText(/required/);
    await expect(page.getByLabel('New selector', { exact: true })).toHaveAttribute('aria-invalid', 'true');
    await a11yCheckpoint(page, 'required-option-error', { feature: 'smalltalk-refactoring' });
    await page.getByLabel('New selector', { exact: true }).fill('collision');
    await page.getByRole('button', { name: 'Preview refactoring', exact: true }).click();
    await expect(page.getByRole('status', { name: 'Refactoring status', exact: true })).toContainText(/failed/i);
    await expect(page.getByRole('button', { name: 'Apply refactoring', exact: true })).toBeDisabled();
    await behavior(page, 'SEBookRenameTarget new oldSelector = 41 and: [SEBookRenameTarget new collision = 99]');
    await a11yCheckpoint(page, 'native-precondition-error', { feature: 'smalltalk-refactoring' });
  } finally { await cleanup(); }
});

test('Cancel and Escape abandon previews and return keyboard focus without mutation', async ({ page }) => {
  test.skip(!features.refactorings, 'Native refactorings are deferred; their implementation is retained for future activation.');
  const cleanup = await mount(page);
  try {
    await previewRename(page);
    await page.getByRole('button', { name: 'Cancel', exact: true }).focus();
    await page.keyboard.press('Tab'); await expect(page.getByLabel('Refactoring action', { exact: true })).toBeFocused();
    await page.keyboard.press('Shift+Tab'); await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Cancel', exact: true }).press('Enter');
    await expect(page.getByRole('button', { name: 'Refactor', exact: true })).toBeFocused();
    await behavior(page, 'SEBookRenameTarget new oldSelector = 41 and: [(SEBookRenameTarget includesSelector: #newSelector) not]');
    await previewRename(page); await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Native Smalltalk refactoring', exact: true })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Refactor', exact: true })).toBeFocused();
    await expect(page.getByRole('button', { name: 'Undo refactoring', exact: true })).toBeDisabled();
  } finally { await cleanup(); }
});

test('stale previews never reapply and edited options require a new preview', async ({ page }) => {
  test.skip(!features.refactorings, 'Native refactorings are deferred; their implementation is retained for future activation.');
  const cleanup = await mount(page);
  try {
    await previewRename(page); await page.getByLabel('New selector', { exact: true }).fill('otherSelector');
    await expect(page.getByRole('button', { name: 'Apply refactoring', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Preview refactoring', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Apply refactoring', exact: true })).toBeEnabled({ timeout: 60000 });
    await page.evaluate(target => window.smalltalkFixtureWorkspace.commit({ baseRevision: 0, action: 'acceptMethod', params: { target, source: 'oldSelector ^ 52', protocol: 'accessing' } }), target);
    await expect(page.getByRole('dialog', { name: 'Native Smalltalk refactoring', exact: true })).toContainText('current revision 1');
    await expect(page.getByRole('status', { name: 'Refactoring status', exact: true })).toContainText(/stale/);
    await expect(page.getByRole('button', { name: 'Apply refactoring', exact: true })).toBeDisabled();
    await behavior(page, 'SEBookRenameTarget new oldSelector = 52 and: [(SEBookRenameTarget includesSelector: #otherSelector) not]');
    await a11yCheckpoint(page, 'stale-preview', { feature: 'smalltalk-refactoring' });
  } finally { await cleanup(); }
});

test('Monaco selection after astral text, CRLF and standalone CR reaches the exact native identifier', async ({ page }) => {
  test.skip(!features.refactorings, 'Native refactorings are deferred; their implementation is retained for future activation.');
  const cleanup = await mount(page);
  try {
    const nativeSource = 'localValue\r\n    "😀 before selection"\r    | local |\r\n    local := 42.\r    ^ local';
    const localTarget = { ...target, selector: 'localValue' };
    await page.evaluate(async ({ target, source }) => { const workspace = window.smalltalkFixtureWorkspace; await workspace.commit({ baseRevision: 0, action: 'acceptMethod', params: { target, source, protocol: 'accessing' } }); await window.smalltalkFixtureBrowser.navigate(target); }, { target: localTarget, source: nativeSource });
    const retained = await page.evaluate(target => window.smalltalkFixtureWorkspace.browse({ kind: 'source', target, offset: 0, limit: 1 }), localTarget);
    expect(retained.source).toBe(nativeSource);
    const editor = page.getByRole('textbox', { name: /^Smalltalk method source/ });
    await editor.focus(); await editor.press('Control+Home'); await editor.press('ArrowDown'); await editor.press('ArrowDown'); await editor.press('Home'); await editor.press('Home');
    for (let i = 0; i < 6; i++) await editor.press('ArrowRight');
    for (let i = 0; i < 5; i++) await editor.press('Shift+ArrowRight');
    await open(page, 'renameTemporary');
    const start = nativeSource.indexOf('| local') + 2;
    await expect(page.getByRole('dialog', { name: 'Native Smalltalk refactoring', exact: true })).toContainText('Selected source range ' + start + '–' + (start + 5));
    await page.getByLabel('New temporary name', { exact: true }).fill('renamedLocal');
    await page.getByRole('button', { name: 'Preview refactoring', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Native change preview', exact: true })).toContainText('renamedLocal', { timeout: 60000 });
    await page.getByRole('button', { name: 'Apply refactoring', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Native Smalltalk refactoring', exact: true })).toBeHidden();
    await behavior(page, 'SEBookRenameTarget new localValue = 42');
    await page.getByRole('button', { name: 'Undo refactoring', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Redo refactoring', exact: true })).toBeEnabled();
    const undone = await page.evaluate(target => window.smalltalkFixtureWorkspace.browse({ kind: 'source', target, offset: 0, limit: 1 }), localTarget);
    expect(undone.source).toBe(nativeSource);
    await editor.focus(); await editor.press('End'); await page.keyboard.insertText(' "unaccepted draft"');
    await expect(page.getByRole('button', { name: 'Refactor', exact: true })).toBeDisabled();
    await expect(page.getByRole('region', { name: 'Method source', exact: true })).toContainText('Accept or Revert before refactoring');
  } finally { await cleanup(); }
});

test('native preview remains readable in both themes at320px and200percent text', async ({ page }) => {
  test.skip(!features.refactorings, 'Native refactorings are deferred; their implementation is retained for future activation.');
  const cleanup = await mount(page);
  try {
    await previewRename(page);
    await page.setViewportSize({ width: 320, height: 900 });
    const dialog = page.getByRole('dialog', { name: 'Native Smalltalk refactoring', exact: true });
    await expect(dialog).toBeVisible();
    await expect.poll(() => dialog.evaluate(node => node.scrollWidth <= node.clientWidth), { message: 'Preview reflows without horizontal scroll' }).toBe(true);
    await page.screenshot({ path: '/private/tmp/task8-preview-320-light.png', fullPage: true });
    await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
    await page.screenshot({ path: '/private/tmp/task8-preview-320-dark.png', fullPage: true });
    await page.evaluate(() => document.documentElement.classList.remove('dark-mode'));
    await a11yCheckpoint(page, 'preview-narrow', { feature: 'smalltalk-refactoring' });
    await dialog.evaluate(node => { node.style.fontSize = '200%'; node.style.letterSpacing = '.12em'; node.style.wordSpacing = '.16em'; });
    await expect.poll(() => dialog.evaluate(node => node.scrollWidth <= node.clientWidth), { message: 'Preview supports enlarged spaced text' }).toBe(true);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Refactor', exact: true })).toBeFocused();
  } finally { await cleanup(); }
});

test('failed native Apply reports checkpoint recovery and resets live handles', async ({ page }) => {
  test.skip(!features.refactorings, 'Native refactorings are deferred; their implementation is retained for future activation.');
  const cleanup = await mount(page);
  try {
    await page.evaluate(async () => {
      const facade = window.smalltalkFixtureRefactorings, prepare = facade.prepare.bind(facade);
      // Trace the real public preview response to select the native fault fixture's token.
      facade.prepare = async request => { const preview = await prepare(request); window.failureFixturePreview = preview; return preview; };
      await window.smalltalkFixtureWorkspace.evaluate("object := SEBookRenameTarget new. shared := Array with: 73 with: nil. shared at: 2 put: shared. object saved: shared. alias := object. FileStream forceNewFileNamed: '/refactoring.txt' do: [:stream | stream nextPutAll: 'original']");
    });
    await page.evaluate(async () => { window.failureFixtureHandle = (await window.smalltalkFixtureWorkspace.evaluate('object')).value.handle; });
    await previewRename(page);
    const injected = await page.evaluate(() => window.smalltalkFixtureWorkspace.evaluate("SEBookFailureChange injectInto: '" + window.failureFixturePreview.token + "'"));
    expect(injected.error).toBeNull();
    await page.getByRole('button', { name: 'Apply refactoring', exact: true }).click();
    await expect(page.getByRole('status', { name: 'Refactoring status', exact: true })).toContainText(/Recovery restored the image and reset live handles/, { timeout: 60000 });
    await expect(page.getByRole('button', { name: 'Apply refactoring', exact: true })).toBeDisabled();
    await behavior(page, "(SEBookRenameTarget instVarNames = #('saved')) and: [object == alias and: [object saved == shared and: [shared first = 73 and: [shared second == shared and: [(FileStream readOnlyFileNamed: '/refactoring.txt' do: [:stream | stream contents]) = 'original' and: [object oldSelector = 41 and: [(SEBookRenameTarget includesSelector: #newSelector) not]]]]]]]");
    const staleHandle = await page.evaluate(() => window.smalltalkFixtureWorkspace.inspect(window.failureFixtureHandle, 0, 20).catch(error => ({ code: error.code })));
    expect(staleHandle.code).toBe('STALE_HANDLE');
    await a11yCheckpoint(page, 'recovered-native-failure', { feature: 'smalltalk-refactoring' });
  } finally { await cleanup(); }
});

test('Versions retains native source provenance and stale restore never overwrites a later edit', async ({ page }) => {
  const cleanup = await mount(page);
  try {
    await page.getByText('More browsing queries', { exact: true }).click();
    await page.getByRole('button', { name: 'Versions', exact: true }).click();
    const region = page.getByRole('region', { name: 'Native query results', exact: true });
    await expect(region).toContainText('oldSelector ^ 41');
    await region.getByRole('button', { name: /^Select version 1(?:\s|$)/ }).click();
    await expect(page.getByRole('region', { name: 'Selected method version', exact: true })).toContainText('Native ChangeSet source · captured revision 0');
    await page.evaluate(target => window.smalltalkFixtureWorkspace.commit({ baseRevision: 0, action: 'acceptMethod', params: { target, source: 'oldSelector ^ 63', protocol: 'accessing' } }), target);
    await page.getByRole('button', { name: 'Restore version', exact: true }).click();
    await expect(page.getByRole('status', { name: 'Query status', exact: true })).toContainText(/restore failed.*source changed/i);
    await behavior(page, 'SEBookRenameTarget new oldSelector = 63');
    await expect(region).toContainText(/unavailable prior versions cannot be restored/);
    await a11yCheckpoint(page, 'stale-version-restore', { feature: 'smalltalk-refactoring' });
  } finally { await cleanup(); }
});

test('Versions preserves a method draft and restores its captured target after navigation', async ({ page }) => {
  const cleanup = await mount(page);
  try {
    await page.getByText('More browsing queries', { exact: true }).click();
    await page.getByRole('button', { name: 'Versions', exact: true }).click();
    await page.getByRole('button', { name: /^Select version 1(?:\s|$)/ }).click();
    const editor = page.getByRole('textbox', { name: /^Smalltalk method source/ });
    await editor.focus(); await editor.press('ControlOrMeta+A');
    await expect.poll(() => editor.evaluate(input => input.value.length > 0 && input.selectionStart === 0 && input.selectionEnd === input.value.length), { message: 'Monaco select-all is ready before replacing source' }).toBe(true);
    await page.keyboard.insertText('oldSelector ^ 81');
    await page.getByRole('button', { name: 'Restore version', exact: true }).click();
    await expect(page.getByRole('status', { name: 'Query status', exact: true })).toContainText(/Accept or Revert.*draft/);
    const drafts = await page.evaluate(() => window.smalltalkFixtureWorkspace.getDrafts());
    expect(drafts[0].source).toBe('oldSelector ^ 81');
    await behavior(page, 'SEBookRenameTarget new oldSelector = 41');
    await page.getByRole('button', { name: 'Revert', exact: true }).click();
    await page.getByRole('button', { name: /^Select version 1(?:\s|$)/ }).click();
    await page.evaluate(target => window.smalltalkFixtureBrowser.navigate({ ...target, className: 'SEBookRenameChild' }), target);
    await page.getByRole('button', { name: 'Restore version', exact: true }).click();
    await expect(page.getByRole('status', { name: 'Query status', exact: true })).toContainText(/restored.*new edit/i, { timeout: 60000 });
    await expect(page.getByRole('listbox', { name: 'Classes', exact: true })).toHaveValue('SEBookRenameTarget');
    expect(await page.evaluate(() => window.smalltalkFixtureWorkspace.snapshot().revision)).toBe(1);
    await behavior(page, 'SEBookRenameTarget new oldSelector = 41 and: [SEBookRenameChild new oldSelector = 42]');
  } finally { await cleanup(); }
});

for (const dismissal of ['Cancel', 'Escape', 'dispose']) {
  test(`a late native preview token is canceled after ${dismissal} without stealing focus`, async ({ page }) => {
  test.skip(!features.refactorings, 'Native refactorings are deferred; their implementation is retained for future activation.');
    // Public timing seam only: token ownership, not Smalltalk transformations.
    // Real engine preview/cancel/recovery are verified in the native journeys above.
    await page.goto('/robots.txt');
    await page.setContent('<!doctype html><html lang="en"><head><title>Refactoring lifetime test</title></head><body><main><h1>Refactoring lifetime</h1><button id="open">Refactor</button><button id="other">Other control</button><div id="root" class="smalltalk-browser"></div></main></body></html>');
    for (const url of ['/css/design-tokens.css', '/css/smalltalk-browser.css']) await page.addStyleTag({ url });
    for (const url of ['/js/smalltalk/protocol.js', '/js/smalltalk/refactoring-view.js']) await page.addScriptTag({ url });
    await page.evaluate(() => {
      window.lateCanceledTokens = [];
      const facade = {
        historyState: () => ({ canUndo: false, canRedo: false }),
        catalog: async () => [{ action: 'renameMethod', label: 'Rename method', applicable: true, options: { inputs: [{ name: 'newSelector', type: 'text', label: 'New selector', required: true }] } }],
        prepare: () => new Promise(resolve => { window.finishLatePreview = () => resolve({ token: 'late-owned-token', baseRevision: 0, changes: { entries: [] }, warnings: [], consequences: [] }); }),
        cancel: async preview => { window.lateCanceledTokens.push(preview.token); },
        apply: () => { throw new Error('Apply is not part of this cancellation case'); },
      };
      const workspace = { snapshot: () => ({ revision: 0 }), subscribe: () => () => {} };
      const view = SEBookSmalltalk.RefactoringView.mount({ root: document.getElementById('root'), workspace, refactorings: facade });
      window.disposeLateView = () => view.dispose();
      document.getElementById('open').addEventListener('click', () => view.open({ target: { kind: 'method', className: 'Counter', side: 'instance', selector: 'value' } }));
    });
    try {
      await page.getByRole('button', { name: 'Refactor', exact: true }).click();
      await page.getByLabel('New selector', { exact: true }).fill('otherValue');
      await page.getByRole('button', { name: 'Preview refactoring', exact: true }).click();
      await expect(page.getByRole('status', { name: 'Refactoring status', exact: true })).toContainText(/Preparing/);
      if (dismissal === 'Cancel') await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      else if (dismissal === 'Escape') await page.keyboard.press('Escape');
      else await page.evaluate(() => window.disposeLateView());
      await page.getByRole('button', { name: 'Other control', exact: true }).focus();
      await page.evaluate(() => window.finishLatePreview());
      await expect.poll(() => page.evaluate(() => window.lateCanceledTokens), { message: 'Late preview token canceled through original facade' }).toEqual(['late-owned-token']);
      await expect(page.getByRole('button', { name: 'Other control', exact: true })).toBeFocused();
      await expect(page.getByRole('dialog', { name: 'Native Smalltalk refactoring', exact: true })).toBeHidden();
    } finally { await page.evaluate(() => window.disposeLateView()); }
  });
}

for (const boundary of ['Apply', 'onApplied']) {
  test(`disposal during pending ${boundary} preserves current focus and commit completion`, async ({ page }) => {
  test.skip(!features.refactorings, 'Native refactorings are deferred; their implementation is retained for future activation.');
    // This public seam controls UI continuation timing only. The native Apply,
    // Undo/Redo and runtime behavior journey above covers mutation semantics.
    await page.goto('/robots.txt');
    await page.setContent('<!doctype html><html lang="en"><head><title>Apply lifetime test</title></head><body><main><h1>Apply lifetime</h1><button id="open">Refactor</button><button id="other">Other control</button><section id="root" class="smalltalk-browser" tabindex="-1"></section></main></body></html>');
    for (const url of ['/css/design-tokens.css', '/css/smalltalk-browser.css']) await page.addStyleTag({ url });
    for (const url of ['/js/smalltalk/protocol.js', '/js/smalltalk/refactoring-view.js']) await page.addScriptTag({ url });
    await page.evaluate(boundary => {
      window.applyCompletions = 0; window.appliedCallbacks = 0;
      const facade = {
        historyState: () => ({ canUndo: false, canRedo: false }),
        catalog: async () => [{ action: 'renameMethod', label: 'Rename method', applicable: true, options: { inputs: [] } }],
        prepare: async () => ({ token: 'apply-owned-token', baseRevision: 0, changes: { entries: [] }, warnings: [], consequences: [] }),
        cancel: async () => {},
        apply: async () => {
          if (boundary === 'Apply') await new Promise(resolve => { window.finishPendingBoundary = resolve; });
          window.applyCompletions++;
        },
      };
      const view = SEBookSmalltalk.RefactoringView.mount({
        root: document.getElementById('root'),
        workspace: { snapshot: () => ({ revision: 0 }), subscribe: () => () => {} },
        refactorings: facade,
        onApplied: async () => {
          window.appliedCallbacks++;
          if (boundary === 'onApplied') await new Promise(resolve => { window.finishPendingBoundary = resolve; });
        },
      });
      window.disposeApplyView = () => view.dispose();
      document.getElementById('open').addEventListener('click', () => view.open({ target: { kind: 'method', className: 'Counter', side: 'instance', selector: 'value' } }));
    }, boundary);
    try {
      await page.getByRole('button', { name: 'Refactor', exact: true }).click();
      await page.getByRole('button', { name: 'Preview refactoring', exact: true }).click();
      await page.getByRole('button', { name: 'Apply refactoring', exact: true }).click();
      await expect(page.getByRole('status', { name: 'Refactoring status', exact: true })).toContainText('Applying native changes');
      if (boundary === 'onApplied') await expect.poll(() => page.evaluate(() => window.appliedCallbacks)).toBe(1);
      await page.evaluate(() => window.disposeApplyView());
      await page.getByRole('button', { name: 'Other control', exact: true }).focus();
      await page.evaluate(async () => {
        window.finishPendingBoundary();
        // Let the deferred continuation's microtasks finish before the next paint.
        await new Promise(resolve => requestAnimationFrame(resolve));
      });
      await expect(page.getByRole('button', { name: 'Other control', exact: true })).toBeFocused();
      expect(await page.evaluate(() => window.applyCompletions)).toBe(1);
      expect(await page.evaluate(() => window.appliedCallbacks)).toBe(boundary === 'Apply' ? 0 : 1);
      await expect(page.getByRole('dialog', { name: 'Native Smalltalk refactoring', exact: true })).toHaveCount(0);
      await expect(page.getByRole('region', { name: 'Native refactoring history', exact: true })).toHaveCount(0);
    } finally { await page.evaluate(() => window.disposeApplyView()); }
  });
}
