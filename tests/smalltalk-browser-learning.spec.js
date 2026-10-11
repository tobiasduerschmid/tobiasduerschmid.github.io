const { test, expect: standardExpect } = require('@playwright/test');
const expect = standardExpect.configure({ timeout: 30000 });
const { mountSmalltalkFixture } = require('./helpers/smalltalk-runtime');
const { selectAllInMonaco } = require('./helpers/monaco-keyboard');
const { a11yCheckpoint } = require('./a11y-helpers');

test.setTimeout(180000);

const sourceRegion = page => page.getByRole('region', { name: 'Method source', exact: true });
async function replaceSource(page, text) {
  const input = page.getByRole('textbox', { name: /^Smalltalk method source/ });
  await input.focus();
  await selectAllInMonaco(input);
  await input.press('Backspace');
  await expect(input).toHaveValue('');
  await page.keyboard.insertText(text);
  await expect(input).toHaveValue(text);
}

test('lesson navigation and draft review retain edits while browsing the image', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/SEBook/tools/smalltalk-tutorial');
  await expect(page.getByRole('button', { name: 'Run', exact: true })).toBeEnabled({ timeout: 120000 });
  const methods = page.getByRole('listbox', { name: 'Methods', exact: true });
  const review = page.getByRole('button', { name: /^Review drafts/ });
  await expect(review).toBeDisabled();
  await methods.selectOption({ label: 'increment' });
  await expect(sourceRegion(page)).toContainText('count + 1');
  await replaceSource(page, 'increment count := count + 2. ^ self');
  await methods.selectOption({ label: 'value' });
  await expect(sourceRegion(page)).toContainText('^ count');
  await replaceSource(page, 'value ^ count + 10');
  await expect(review).toHaveText('Review drafts (2)');

  const classes = page.getByRole('region', { name: 'Classes', exact: true });
  await classes.getByLabel('Search classes', { exact: true }).filter({ visible: true }).click();
  await classes.getByRole('searchbox', { name: 'Search classes', exact: true }).fill('SmallInteger');
  await classes.getByRole('button', { name: 'Search', exact: true }).click();
  await classes.getByRole('listbox', { name: 'Classes', exact: true }).selectOption({ label: 'SmallInteger' });
  await expect(sourceRegion(page)).toContainText('SmallInteger');
  await page.getByRole('button', { name: 'Lesson code', exact: true }).click();
  await expect(sourceRegion(page)).toContainText('SEBookCounter');
  await expect(methods.getByRole('option', { name: 'increment', exact: true })).toHaveCount(1);
  await expect(review).toHaveText('Review drafts (2)');

  await review.click();
  const saved = page.getByRole('region', { name: 'Browser source views', exact: true });
  await expect(saved.getByRole('button', { name: 'Saved drafts', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await saved.getByRole('button', { name: /method.*SEBookCounter.*instance side.*increment/ }).click();
  await saved.getByRole('button', { name: 'Edit in Browser', exact: true }).click();
  await expect(saved).toBeHidden();
  await expect(sourceRegion(page)).toContainText('increment count := count + 2. ^ self');
  await page.screenshot({ path: testInfo.outputPath('browser-lesson-draft.png'), fullPage: true });
  await page.getByRole('button', { name: 'Focus source editor', exact: true }).click();
  await expect(sourceRegion(page).getByText('SEBookCounter >> increment · instance side', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('browser-source-focus.png'), fullPage: true });
  await page.getByRole('button', { name: 'Restore layout', exact: true }).click();
  await sourceRegion(page).getByRole('button', { name: 'Revert', exact: true }).click();
  await expect(review).toHaveText('Review drafts (1)');
  await review.click();
  await saved.getByRole('button', { name: /method.*SEBookCounter.*instance side.*value/ }).click();
  await saved.getByRole('button', { name: 'Revert draft', exact: true }).click();
  await saved.getByRole('button', { name: 'Browse image', exact: true }).click();
  await expect(review).toHaveText('Review drafts (0)');
  await expect(review).toBeDisabled();
  await a11yCheckpoint(page, 'lesson-code-and-draft-review', { feature: 'smalltalk-browser' });
});

const program = {
  version: 1, revision: 0, stepKey: 'pane-navigation',
  files: [{ path: '/counter.st', kind: 'source', format: 'filein', content: "Object subclass: #SEBookPaneCounter instanceVariableNames: '' classVariableNames: '' poolDictionaries: '' category: 'SEBook-PaneNavigation'!\n!SEBookPaneCounter methodsFor: 'accessing'!\nvalue ^ 17! !" }],
  changes: { version: 1, source: '', entries: [] }, runCommand: null,
};

test('a removed-target draft remains recoverable when its Browser jump cannot open', async ({ page }) => {
  const draft = { target: { kind: 'method', className: 'SEBookMissingDraftClass', side: 'instance', selector: 'answer' }, baseRevision: 0, source: 'answer ^ 23' };
  const cleanup = await mountSmalltalkFixture(page, { program, drafts: [draft], views: ['browser'] });
  try {
    await page.getByRole('button', { name: 'Review drafts (1)', exact: true }).click();
    const saved = page.getByRole('region', { name: 'Browser source views', exact: true });
    await saved.getByRole('button', { name: /method.*SEBookMissingDraftClass.*answer/ }).click();
    await saved.getByRole('button', { name: 'Edit in Browser', exact: true }).click();
    await expect(saved.getByRole('status', { name: 'Source view status', exact: true })).toContainText('The draft remains available here for recovery.');
    await expect(saved).toBeVisible();
    await expect(saved.getByRole('button', { name: 'Download draft source', exact: true })).toBeEnabled();
    await expect(saved.getByRole('region', { name: 'Selected saved source', exact: true })).toContainText('answer ^ 23');
    await a11yCheckpoint(page, 'missing-draft-target-recovery', { feature: 'smalltalk-browser' });
  } finally { await cleanup(); }
});

for (const delayedKind of ['classes', 'source']) test(`closing draft review cancels late ${delayedKind} navigation without replacing the Browser selection`, async ({ page }) => {
  const cancellationProgram = { ...program, files: program.files.map(file => ({ ...file,
    content: file.content + "\n!SEBookPaneCounter methodsFor: 'accessing'!\nother ^ 29! !",
  })) };
  const draft = { target: { kind: 'method', className: 'SEBookPaneCounter', side: 'instance', selector: 'other' }, baseRevision: 0, source: 'other ^ 31' };
  const cleanup = await mountSmalltalkFixture(page, { program: cancellationProgram, drafts: [draft], views: ['browser'] });
  try {
    await page.evaluate(() => window.smalltalkFixtureBrowser.navigate({ kind: 'method', className: 'SEBookPaneCounter', packageName: 'SEBook-PaneNavigation', side: 'instance', selector: 'value' }));
    await expect(sourceRegion(page)).toContainText('value ^ 17');
    await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Review drafts (1)', exact: true }).click();
    const saved = page.getByRole('region', { name: 'Browser source views', exact: true });
    await saved.getByRole('button', { name: /method.*SEBookPaneCounter.*other/ }).click();

    // Deliver real native results in a controlled order. The source preflight
    // must finish before we hold the class lookup or source navigation result.
    await page.evaluate(kind => {
      const workspace = window.smalltalkFixtureWorkspace, browse = workspace.browse.bind(workspace);
      let passedPreflight = false;
      const delivery = new Promise(resolve => { window.deliverDraftNavigation = resolve; });
      window.draftNavigationHeld = new Promise(resolve => {
        workspace.browse = async query => {
          const isDraftSource = query.kind === 'source' && query.target.selector === 'other';
          if (!passedPreflight && isDraftSource) {
            const result = await browse(query); passedPreflight = true; return result;
          }
          if (!passedPreflight || query.kind !== kind) return browse(query);
          workspace.browse = browse;
          const result = await browse(query); resolve(); await delivery; return result;
        };
      });
    }, delayedKind);
    await saved.getByRole('button', { name: 'Edit in Browser', exact: true }).click();
    await page.evaluate(() => window.draftNavigationHeld);
    await saved.getByRole('button', { name: 'Browse image', exact: true }).click();
    await expect(saved).toBeHidden();
    await expect(sourceRegion(page)).not.toHaveAttribute('aria-busy', 'true');
    await expect(sourceRegion(page)).toContainText('value ^ 17');
    await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeDisabled();
    const classes = page.getByRole('listbox', { name: 'Classes', exact: true });
    if (delayedKind === 'source') {
      // A new choice made after cancelling must also survive late delivery.
      await classes.focus(); await classes.press('Enter');
      await expect(sourceRegion(page).getByRole('heading', { name: 'Class definition', exact: true })).toBeVisible();
      await expect(sourceRegion(page)).not.toHaveAttribute('aria-busy', 'true');
    }
    const focused = delayedKind === 'source' ? classes : page.getByRole('button', { name: 'Review drafts (1)', exact: true });
    await expect(focused).toBeFocused();
    await page.evaluate(async () => {
      window.deliverDraftNavigation();
      await new Promise(requestAnimationFrame);
    });
    if (delayedKind === 'source') await expect(sourceRegion(page).getByRole('heading', { name: 'Class definition', exact: true })).toBeVisible();
    else await expect(sourceRegion(page)).toContainText('value ^ 17');
    await expect(sourceRegion(page)).not.toContainText('other ^ 31');
    await expect(focused).toBeFocused();
    if (delayedKind === 'source') {
      await page.getByRole('button', { name: 'Back', exact: true }).click();
      await expect(sourceRegion(page)).toContainText('value ^ 17');
      await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeDisabled();
    }
    await expect(page.getByRole('button', { name: 'Review drafts (1)', exact: true })).toBeEnabled();
  } finally { await page.evaluate(() => window.deliverDraftNavigation?.()); await cleanup(); }
});

for (const width of [320, 800]) test(`narrow pane navigation preserves keyboard focus at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const cleanup = await mountSmalltalkFixture(page, { program, views: ['browser'] });
  try {
    const navigation = page.getByRole('navigation', { name: 'Browser panes', exact: true });
    const packageSearch = page.getByRole('searchbox', { name: 'Search packages', exact: true });
    await packageSearch.fill('SEBook-PaneNavigation');
    await packageSearch.press('Enter');
    const packages = page.getByRole('listbox', { name: 'Packages', exact: true });
    await expect(packages.getByRole('option', { name: 'SEBook-PaneNavigation', exact: true })).toHaveCount(1);
    await packages.focus();
    await packages.press('Home');
    const classes = page.getByRole('listbox', { name: 'Classes', exact: true });
    await expect(classes).toBeFocused();
    await expect(navigation.getByRole('button', { name: 'Classes', exact: true })).toHaveAttribute('aria-current', 'step');
    await classes.press('Home');
    const protocols = page.getByRole('listbox', { name: 'Protocols', exact: true });
    await expect(protocols).toBeFocused();
    await expect(navigation.getByRole('button', { name: 'Protocols', exact: true })).toHaveAttribute('aria-current', 'step');
    await protocols.press('End');
    const methods = page.getByRole('listbox', { name: 'Methods', exact: true });
    await expect(methods).toBeFocused();
    await expect(navigation.getByRole('button', { name: 'Methods', exact: true })).toHaveAttribute('aria-current', 'step');
    await methods.press('Home');
    await expect(sourceRegion(page)).toContainText('value ^ 17');
    await expect(methods).toBeFocused();
    await a11yCheckpoint(page, `pane-focus-${width}`, { feature: 'smalltalk-browser' });
  } finally { await cleanup(); }
});
