// @ts-check
// The integrated C4 editor (spec §3.4, §9.1, §9.2, §9.5): every editor part loaded from the manifest's `editor` list
// and mounted with `ArchUMLC4Editor.mount`, so the outline, inspector, panels, actions, and scaffolds work together
// through the state controller. Canvas navigation has its own spec (c4-editor-canvas.spec.js) and canvas drags come
// later, so these tests drive the editor from the outline, the inspector, and the panels.
// The page is built with setContent and loads the ArchUML scripts and the merged stylesheet from disk, so the test
// needs no site build. Its root font size is 62.5%, as on this site. Edits are checked through the text the host
// receives (spec §3.4 `onTextChange`), read back with the C4 core.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { a11yCheckpoint } = require('./a11y-helpers');

const REPO = path.join(__dirname, '..');
const ARCHUML = path.join(REPO, 'js/ArchUML');
const C4 = require(path.join(ARCHUML, 'c4/c4-core.js'));
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ARCHUML, 'c4/manifest.json'), 'utf8'));
const SCRIPTS = ['uml-bundle.js', ...MANIFEST.core, ...MANIFEST.render, ...MANIFEST.editor].map((file) => path.join(ARCHUML, file));
// The SEBook host adapter, for the source editor it gives the YAML tab (spec §3.4 `createSourceEditor`).
const SITE_ADAPTER = path.join(REPO, 'js/c4-editor-site.js');
const STYLESHEET = path.join(ARCHUML, 'css/c4-editor.css');
const FIXTURES = path.join(ARCHUML, 'tests/c4/fixtures');
const REFERENCE = fs.readFileSync(path.join(FIXTURES, 'course-registration.yml'), 'utf8');
const INTERFACES_SEED = fs.readFileSync(path.join(FIXTURES, 'interfaces-step2-seed.yml'), 'utf8');
const FEATURE = { feature: 'c4-editor' };

/** `text` with `from` replaced once; a fixture anchor that is missing fails the test instead of changing nothing. */
function replaceOnce(text, from, to) {
  if (!text.includes(from)) throw new Error(`fixture anchor not found: ${from}`);
  return text.replace(from, to);
}

// The reference model with no technology on the Registration API: one warning, c4/no-technology, on that field.
const API_WITHOUT_TECHNOLOGY = replaceOnce(REFERENCE, '        technology: Python, FastAPI\n', '');

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>C4 editor integration</title>
<style>html { font-size: 62.5%; } body { margin: 0; font-size: 20px; } main { padding: 16px; }</style>
</head><body><main><h1>C4 editor integration</h1><div id="first"></div><div id="second"></div></main></body></html>`;

/** Loads the page, the merged stylesheet, and every script the manifest lists (plus the site adapter when asked). */
async function loadEditorPage(page, { siteAdapter = false } = {}) {
  await page.setContent(PAGE);
  await page.addStyleTag({ path: STYLESHEET });
  for (const script of siteAdapter ? [...SCRIPTS, SITE_ADAPTER] : SCRIPTS) await page.addScriptTag({ path: script });
  await page.evaluate(() => {
    window.editors = {};
    window.hostTexts = {};
    window.hostSelections = {};
  });
}

/**
 * Mounts an editor on the element with id `rootId`. The host records every text (spec §3.4 `onTextChange`) and
 * selection it hears; `siteSourceEditor` hands the YAML tab the SEBook adapter's source editor.
 */
async function mountEditor(page, rootId, { text = REFERENCE, view = 'containers of registration', profile = 'expert', siteSourceEditor = false, reveal = 'all', lockedFields = [] } = {}) {
  await page.evaluate(({ id, settings }) => {
    const texts = [];
    const selections = [];
    window.hostTexts[id] = texts;
    window.hostSelections[id] = selections;
    const host = {
      onTextChange: (changed) => texts.push(changed),
      onSelectionChange: (selection) => selections.push(selection),
    };
    if (settings.siteSourceEditor) host.createSourceEditor = window.SebookC4EditorSite.createSourceEditor;
    window.editors[id] = window.ArchUMLC4Editor.mount(document.getElementById(id), {
      text: settings.text, view: settings.view, profile: settings.profile, reveal: settings.reveal, lockedFields: settings.lockedFields, host,
    });
  }, { id: rootId, settings: { text, view, profile, siteSourceEditor, reveal, lockedFields } });
  return page.locator(`#${rootId}`);
}

/** The text the editor on `rootId` holds now, as its host last heard it (or `initial`). */
async function currentText(page, rootId, initial) {
  const texts = await page.evaluate((id) => window.hostTexts[id], rootId);
  return texts.length > 0 ? texts[texts.length - 1] : initial;
}

function hostChanges(page, rootId) {
  return page.evaluate((id) => window.hostTexts[id].length, rootId);
}

async function elementName(page, rootId, initial, elementId) {
  return C4.load(await currentText(page, rootId, initial)).model.elements.get(elementId).name;
}

const outline = (editor) => editor.getByRole('tree', { name: 'Model outline' });
const treeItem = (editor, name) => outline(editor).getByRole('treeitem', { name, exact: true });
const inspector = (editor) => editor.getByRole('region', { name: 'Inspector', exact: true });
const inspectorTitle = (editor) => inspector(editor).getByRole('heading', { level: 3 });
/** A field of the element form's Basics section, by its label. */
const basicsField = (editor, label) => inspector(editor).getByRole('region', { name: 'Basics' }).getByRole('textbox', { name: label, exact: true });
const canvas = (editor) => editor.getByRole('region', { name: /^Canvas/ });

/** Opens the item's view and selects it, as Enter on an outline item does. */
async function chooseInOutline(editor, name) {
  await treeItem(editor, name).focus();
  await treeItem(editor, name).press('Enter');
}

test.describe('C4 editor: the parts working together', () => {
  test('the manifest loads every part and the mount fills the outline, inspector, and panels with them', async ({ page }) => {
    await loadEditorPage(page);
    const editor = await mountEditor(page, 'first');

    await expect(outline(editor)).toBeVisible();
    await expect(inspector(editor)).toContainText('Select an element');
    await expect(editor.getByRole('tablist')).toBeVisible();
    for (const tab of [/^Problems/, /^Review/, /^Explain/, /^YAML/]) await expect(editor.getByRole('tab', { name: tab })).toBeVisible();
    await expect(canvas(editor)).toHaveAccessibleName('Canvas: Container view: Course Registration');
    await a11yCheckpoint(page, 'c4-editor-integrated-light', Object.assign({ include: '#first' }, FEATURE));
    await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
    await a11yCheckpoint(page, 'c4-editor-integrated-dark', Object.assign({ include: '#first' }, FEATURE));
  });

  test("with reveal 'on-request', Show inside in Explain also opens the outline below the scope (spec §9.3)", async ({ page }) => {
    await loadEditorPage(page);
    const editor = await mountEditor(page, 'first', { reveal: 'on-request' });
    await expect(treeItem(editor, 'Course Registration')).toHaveAttribute('aria-expanded', 'false');
    await expect(treeItem(editor, 'Registration API')).toHaveCount(0);

    await editor.getByRole('tab', { name: /^Explain/ }).click();
    await editor.getByRole('button', { name: 'Show inside' }).click();

    await expect(treeItem(editor, 'Course Registration')).toHaveAttribute('aria-expanded', 'true');
    await expect(treeItem(editor, 'Registration API')).toBeVisible();
  });

  test('a YAML error shows its banner above the regions, and Go to error moves the caret into the YAML tab', async ({ page }) => {
    await loadEditorPage(page);
    const editor = await mountEditor(page, 'first', { text: `${REFERENCE}extra: [unclosed\n` });

    const banner = editor.getByText(/^Error: Line \d+ of the YAML cannot be read/);
    await expect(banner).toBeVisible();
    expect(await banner.evaluate((node, outlineRegion) => Boolean(node.compareDocumentPosition(outlineRegion) & Node.DOCUMENT_POSITION_FOLLOWING),
      await editor.getByRole('region', { name: 'Outline', exact: true }).elementHandle()), 'the banner comes before the outline').toBe(true);
    await editor.getByRole('button', { name: 'Go to error' }).click();
    await expect(editor.getByRole('textbox', { name: 'YAML source' })).toBeFocused();
  });

  test('selecting an element in the outline shows its form in the inspector, and another selection replaces it', async ({ page }) => {
    await loadEditorPage(page);
    const editor = await mountEditor(page, 'first');

    await chooseInOutline(editor, 'Registration API');
    await expect(inspectorTitle(editor)).toHaveText('Registration API');
    await expect(basicsField(editor, 'Technology')).toHaveValue('Python, FastAPI');

    await chooseInOutline(editor, 'Planner Web App');
    await expect(inspectorTitle(editor)).toHaveText('Planner Web App');
    await expect(basicsField(editor, 'Technology')).toHaveValue('TypeScript, React');
    expect(await page.evaluate(() => window.hostSelections.first.at(-1)), 'the host hears the selection').toEqual({ elementId: 'web' });
  });

  test('Problems › Show focuses the inspector field the problem names', async ({ page }) => {
    await loadEditorPage(page);
    const editor = await mountEditor(page, 'first', { text: API_WITHOUT_TECHNOLOGY });

    await editor.getByRole('tab', { name: /^Problems/ }).click();
    const row = editor.getByRole('listitem').filter({ hasText: 'Warning:' }).filter({ hasText: 'Registration API' });
    await row.getByRole('button', { name: /^Show / }).click();

    const technology = basicsField(editor, 'Technology');
    await expect(inspectorTitle(editor)).toHaveText('Registration API');
    await expect(technology).toBeFocused();
    await expect(technology).toHaveAccessibleDescription(/Warning: Registration API/);
  });

  test('Escape closes one layer per press: the menu, then the dialog, then the selection (spec §9.2)', async ({ page }) => {
    await loadEditorPage(page);
    const editor = await mountEditor(page, 'first');
    await chooseInOutline(editor, 'Registration API');
    const item = treeItem(editor, 'Registration API');
    await expect(inspectorTitle(editor)).toHaveText('Registration API');

    await item.press('Shift+F10');
    const menu = editor.getByRole('menu', { name: 'Actions for Registration API' });
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(item).toBeFocused();
    await expect(inspectorTitle(editor), 'closing the menu keeps the selection').toHaveText('Registration API');

    await item.press('Shift+F10');
    await menu.getByRole('menuitem', { name: 'Change id…' }).click();
    const dialog = editor.getByRole('dialog', { name: 'Change the id of Registration API' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(item).toBeFocused();
    await expect(inspectorTitle(editor), 'closing the dialog keeps the selection').toHaveText('Registration API');

    await page.keyboard.press('Escape');
    await expect(inspector(editor)).toContainText('Select an element');
    await expect(item).toBeFocused();
    expect(await page.evaluate(() => window.hostSelections.first.at(-1)), 'the host hears the cleared selection').toBeNull();
    expect(await hostChanges(page, 'first'), 'no Escape changed the model').toBe(0);
  });

  for (const [place, field] of [
    ['the outline\'s filter', (editor) => editor.getByRole('searchbox', { name: 'Filter the outline' })],
    ['an inspector field', (editor) => basicsField(editor, 'Technology')],
  ]) {
    test(`Escape in a form field (${place}) leaves the selection alone`, async ({ page }) => {
      await loadEditorPage(page);
      const editor = await mountEditor(page, 'first');
      await chooseInOutline(editor, 'Registration API');

      await field(editor).focus();
      await page.keyboard.press('Escape');

      await expect(field(editor)).toBeFocused();
      await expect(inspectorTitle(editor)).toHaveText('Registration API');
    });
  }

  test('two editors on one page keep separate ids and separate undo histories', async ({ page }) => {
    await loadEditorPage(page);
    const first = await mountEditor(page, 'first');
    const second = await mountEditor(page, 'second');
    await chooseInOutline(first, 'Registration API');
    await chooseInOutline(second, 'Registration API');

    const ids = await page.evaluate(() => {
      const all = [...document.querySelectorAll('#first [id], #second [id]')].map((node) => node.id);
      const referenced = [...document.querySelectorAll('#first, #second')].flatMap((editorRoot) => [...editorRoot.querySelectorAll(
        '[aria-labelledby], [aria-describedby], [aria-controls], [for]',
      )].flatMap((node) => ['aria-labelledby', 'aria-describedby', 'aria-controls', 'for']
        .flatMap((name) => (node.getAttribute(name) || '').split(/\s+/).filter(Boolean))
        .map((target) => ({ target, inSameEditor: editorRoot.contains(document.getElementById(target)) }))));
      return { duplicates: all.filter((id, index) => all.indexOf(id) !== index), outside: referenced.filter((reference) => !reference.inSameEditor) };
    });
    expect(ids.duplicates, 'no id is used twice on the page').toEqual([]);
    expect(ids.outside, 'every ARIA reference points into its own editor').toEqual([]);

    const name = basicsField(first, 'Name');
    await name.fill('Enrollment API Service');
    await name.press('Enter');
    await expect.poll(() => elementName(page, 'first', REFERENCE, 'api')).toBe('Enrollment API Service');

    await canvas(second).focus();
    await page.keyboard.press('Control+z');
    expect(await hostChanges(page, 'second'), 'the second editor had nothing to undo').toBe(0);
    expect(await elementName(page, 'first', REFERENCE, 'api'), 'undo in the second editor leaves the first alone').toBe('Enrollment API Service');

    await canvas(first).focus();
    await page.keyboard.press('Control+z');
    await expect.poll(() => elementName(page, 'first', REFERENCE, 'api')).toBe('Registration API');
    await expect(inspectorTitle(second)).toHaveText('Registration API');
  });

  test('destroy with every part loaded removes every listener and leaves the host element empty', async ({ page }) => {
    await loadEditorPage(page);
    const client = await page.context().newCDPSession(page);
    async function listenerCount() {
      let total = 0;
      for (const expression of ['window', 'document', 'document.getElementById("first")']) {
        const { result } = await client.send('Runtime.evaluate', { expression });
        const { listeners } = await client.send('DOMDebugger.getEventListeners', { objectId: result.objectId });
        total += listeners.length;
      }
      return total;
    }
    // A first mount lets the shared ArchUML scripts install their one-time page listeners before the count.
    await mountEditor(page, 'first');
    await page.evaluate(() => window.editors.first.destroy());
    const before = await listenerCount();

    const editor = await mountEditor(page, 'first');
    await chooseInOutline(editor, 'Registration API');
    await treeItem(editor, 'Registration API').press('Shift+F10');
    await expect(editor.getByRole('menu')).toBeVisible();
    expect(await listenerCount()).toBeGreaterThan(before);
    await page.evaluate(() => window.editors.first.destroy());

    expect(await listenerCount()).toBe(before);
    await expect(page.locator('#first > *')).toHaveCount(0);
    expect(await page.locator('#first').evaluate((element) => element.getAttributeNames())).toEqual(['id']);
  });
});

// ---- The YAML tab shares the editor's undo history (spec §3.4, Ruling 11) -----------------------------------------
//
// The site host keeps one history: undo keys in the YAML tab's source editor go to the editor. Typing that has not
// reached the state yet (the 250 ms sync) is applied first, so Ctrl+Z takes back the typing, and the next one the
// form edit before it. The page clock is installed, so the sync never runs on its own between the keys.

test.describe('C4 editor: one undo history for the YAML tab and the forms', () => {
  test('Ctrl+Z in the YAML tab first takes back the typing still waiting to sync, then the form edit before it', async ({ page }) => {
    await page.clock.install();
    await loadEditorPage(page, { siteAdapter: true });
    const editor = await mountEditor(page, 'first', { siteSourceEditor: true });
    await chooseInOutline(editor, 'Registration API');
    await page.clock.runFor(10);
    const name = basicsField(editor, 'Name');
    await name.fill('Enrollment API Service');
    await name.press('Enter');
    await expect.poll(() => elementName(page, 'first', REFERENCE, 'api')).toBe('Enrollment API Service');
    const renamed = await currentText(page, 'first', REFERENCE);
    // Past the 600 ms in which edits merge, so the typing is a step of its own.
    await page.clock.runFor(1000);

    await editor.getByRole('tab', { name: /^YAML/ }).click();
    const source = editor.getByRole('textbox', { name: 'YAML source' });
    await source.focus();
    await source.press('Control+End');
    await page.keyboard.type('\n# typed');
    await page.keyboard.press('Control+z');

    await expect.poll(() => currentText(page, 'first', REFERENCE), 'the first undo takes back the typing only').toBe(renamed);
    await expect(source).toHaveValue(renamed);
    await page.keyboard.press('Control+z');
    await expect.poll(() => elementName(page, 'first', REFERENCE, 'api'), 'the second undo takes back the form edit').toBe('Registration API');
    await expect(source).toHaveValue(REFERENCE);
  });
});

// ---- The anchored relationship form's More: the Uses picker (spec §9.5) --------------------------------------------
//
// The form writes on submit: the relationship's fields and its `uses` go into one batch, so the host hears one change
// and one undo takes back both.

const SUBMIT_PLAN = 'submit-plan: POST /v1/enrollments';

/** The relationship from `sourceId` to `targetId` in `text`, read with the core. */
function relationshipIn(text, sourceId, targetId) {
  return C4.load(text).model.relationships.find((relationship) => relationship.sourceId === sourceId && relationship.targetId === targetId) || null;
}

test.describe('C4 editor: the anchored relationship form names the interfaces it uses', () => {
  test('a summary relationship added from a derived edge writes its uses in the same undo step', async ({ page }) => {
    await loadEditorPage(page);
    const editor = await mountEditor(page, 'first', { text: INTERFACES_SEED });
    await chooseInOutline(editor, 'Planner Web App');
    await inspector(editor).getByRole('button', { name: /^Planner Web App → Registration API/ }).click();
    await inspector(editor).getByRole('button', { name: 'Add a summary relationship' }).click();

    const form = editor.getByRole('dialog', { name: 'Add relationship' });
    await form.getByRole('textbox', { name: 'Description' }).fill('submits plans to');
    await form.getByText('More', { exact: true }).click();
    await form.getByRole('checkbox', { name: SUBMIT_PLAN }).check();
    await form.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(form).toHaveCount(0);

    expect(await hostChanges(page, 'first'), 'one change for the relationship and its uses').toBe(1);
    const added = relationshipIn(await currentText(page, 'first', INTERFACES_SEED), 'web', 'api');
    expect(added && added.description).toBe('submits plans to');
    expect(added && added.uses.map((use) => use.text)).toEqual(['enrollment-api.submit-plan']);

    await canvas(editor).focus();
    await page.keyboard.press('Control+z');
    await expect.poll(async () => relationshipIn(await currentText(page, 'first', INTERFACES_SEED), 'web', 'api'),
      'one undo removes the relationship with its uses').toBeNull();
  });

  test('editing a declared relationship in the anchored form writes its fields and uses as one undo step', async ({ page }) => {
    await loadEditorPage(page);
    // The canvas will open this form for a declared relationship; until it exists, the actions open it directly.
    await page.evaluate((text) => {
      const parts = window.ArchUMLC4EditorParts;
      const root = document.getElementById('first');
      root.classList.add('c4-editor');
      const texts = [];
      window.hostTexts.first = texts;
      const state = parts.state.createEditorState({ text, host: { onTextChange: (changed) => texts.push(changed) } });
      const ids = parts.dom.idFactory('anchored');
      window.harness = { state };
      window.harness.actions = parts.actions.createActions(root, { state, dom: parts.dom, ids, host: {}, options: { lockedFields: [] } });
      window.harness.result = window.harness.actions.openRelationshipForm({ relationshipId: 'web->coordinator' }, {});
    }, INTERFACES_SEED);

    const form = page.getByRole('dialog', { name: 'Edit relationship' });
    await form.getByRole('textbox', { name: 'Technology' }).fill('JSON/HTTPS/2');
    await form.getByText('More', { exact: true }).click();
    await form.getByRole('checkbox', { name: SUBMIT_PLAN }).check();
    await form.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(form).toHaveCount(0);

    expect(await hostChanges(page, 'first'), 'one change for the fields and the uses').toBe(1);
    const edited = relationshipIn(await currentText(page, 'first', INTERFACES_SEED), 'web', 'coordinator');
    expect(edited && edited.technology).toBe('JSON/HTTPS/2');
    expect(edited && edited.uses.map((use) => use.text)).toEqual(['enrollment-api.submit-plan']);
    await page.evaluate(() => window.harness.state.undo());
    expect(await currentText(page, 'first', INTERFACES_SEED), 'one undo restores the relationship').toBe(INTERFACES_SEED);
  });

  test('a lock under the relationship\'s uses disables the More picker', async ({ page }) => {
    await loadEditorPage(page);
    await page.evaluate((text) => {
      const parts = window.ArchUMLC4EditorParts;
      const root = document.getElementById('first');
      root.classList.add('c4-editor');
      const state = parts.state.createEditorState({ text, host: { onTextChange() {} } });
      const actions = parts.actions.createActions(root, {
        state, dom: parts.dom, ids: parts.dom.idFactory('locked'), host: {},
        options: { lockedFields: ['systems.registration.containers.web.collaborators.coordinator.uses.*'] },
      });
      actions.openRelationshipForm({ relationshipId: 'web->coordinator' }, {});
    }, INTERFACES_SEED);

    const form = page.getByRole('dialog', { name: 'Edit relationship' });
    await form.getByText('More', { exact: true }).click();
    await expect(form.getByRole('checkbox', { name: SUBMIT_PLAN })).toBeDisabled();
  });
});

// ---- The anchored form's empty Uses picker leads to the target's new interface (spec §9.5) -------------------------
//
// When the target offers no described interface, More's "Add an interface to <target>" keeps the learner's work: it
// submits the form, then opens the target in the inspector with focus on the new interface's name.

/** Opens the anchored Add relationship form from Planner Web App to Registration Database with the canvas keys. */
async function openAddRelationshipToDatabase(page, editor) {
  const elements = canvas(editor).getByRole('listbox', { name: 'Elements in this view' });
  await elements.getByRole('option', { name: 'Planner Web App', exact: true }).focus();
  await page.keyboard.press('c');
  await elements.getByRole('option', { name: 'Registration Database', exact: true }).focus();
  await page.keyboard.press('Enter');
  const form = editor.getByRole('dialog', { name: 'Add relationship' });
  await expect(form).toBeVisible();
  return form;
}

test.describe('C4 editor: the anchored form offers to add an interface to the target', () => {
  test('Add an interface adds the relationship, then focuses the target\'s new interface name', async ({ page }) => {
    await loadEditorPage(page);
    const editor = await mountEditor(page, 'first');
    const form = await openAddRelationshipToDatabase(page, editor);
    await form.getByRole('textbox', { name: 'Description' }).fill('reads course data from');
    await form.getByText('More', { exact: true }).click();

    await form.getByRole('button', { name: 'Add an interface to Registration Database' }).click();

    await expect(form).toHaveCount(0);
    expect(await hostChanges(page, 'first'), 'the relationship is one change').toBe(1);
    const added = relationshipIn(await currentText(page, 'first', REFERENCE), 'web', 'db');
    expect(added && added.description).toBe('reads course data from');
    await expect(inspectorTitle(editor)).toHaveText('Registration Database');
    await expect(inspector(editor).getByRole('textbox', { name: 'New interface name' })).toBeFocused();
    await a11yCheckpoint(page, 'c4-editor-anchored-add-interface', Object.assign({ include: '#first' }, FEATURE));
  });

  test('from a derived edge in the inspector, Add an interface also leaves focus on the new interface name', async ({ page }) => {
    await loadEditorPage(page);
    const editor = await mountEditor(page, 'first');
    await chooseInOutline(editor, 'Registration API');
    await inspector(editor).getByRole('button', { name: /^Registration API → Registration Database/ }).click();
    await inspector(editor).getByRole('button', { name: 'Add a summary relationship' }).click();
    const form = editor.getByRole('dialog', { name: 'Add relationship' });
    await form.getByRole('textbox', { name: 'Description' }).fill('stores registrations in');
    await form.getByText('More', { exact: true }).click();

    await form.getByRole('button', { name: 'Add an interface to Registration Database' }).click();

    await expect(form).toHaveCount(0);
    expect(relationshipIn(await currentText(page, 'first', REFERENCE), 'api', 'db')).not.toBeNull();
    await expect(inspectorTitle(editor)).toHaveText('Registration Database');
    await expect(inspector(editor).getByRole('textbox', { name: 'New interface name' })).toBeFocused();
  });

  test('without a description the form stays open with its reason, and nothing is written', async ({ page }) => {
    await loadEditorPage(page);
    const editor = await mountEditor(page, 'first');
    const form = await openAddRelationshipToDatabase(page, editor);
    await form.getByText('More', { exact: true }).click();

    await form.getByRole('button', { name: 'Add an interface to Registration Database' }).click();

    await expect(form).toBeVisible();
    await expect(form.getByRole('textbox', { name: 'Description' })).toHaveAttribute('aria-invalid', 'true');
    expect(await hostChanges(page, 'first')).toBe(0);
  });

  test('a lock on the target\'s provides leaves the button out', async ({ page }) => {
    await loadEditorPage(page);
    const editor = await mountEditor(page, 'first', { lockedFields: ['systems.registration.containers.db.provides'] });
    const form = await openAddRelationshipToDatabase(page, editor);
    await form.getByText('More', { exact: true }).click();

    await expect(form.getByText('Neither Registration Database nor the elements around it offer a described interface yet.')).toBeVisible();
    await expect(form.getByRole('button', { name: /^Add an interface/ })).toHaveCount(0);
  });
});
