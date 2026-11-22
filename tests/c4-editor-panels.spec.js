// @ts-check
// The C4 editor's bottom panels (Problems, Review, Explain, YAML), the YAML-error banner with its command gate, and
// the novice scaffolds (empty-state guide, definitions, carry-down tray, responsibility trace, reveal and display
// modes), spec §7.3, §9.1–§9.3. Each test mounts the parts on a blank page with the scripts loaded from disk. The
// toolbar, canvas, and inspector arrive from other lanes, so the page carries labelled stand-ins: an Add button the
// toolbar gates the same way, and inspector fields that answer focus requests as the inspector contract says.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const ARCHUML = path.resolve(__dirname, '../js/ArchUML');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ARCHUML, 'c4/manifest.json'), 'utf8'));
const SCRIPTS = MANIFEST.core.concat([
  'c4/editor/c4-editor-dom.js',
  'c4/editor/c4-editor-state.js',
  'c4/editor/c4-editor-panels.js',
  'c4/editor/c4-editor-scaffolds.js',
]).map((file) => path.join(ARCHUML, file));
const PANELS_CSS = path.join(ARCHUML, 'css/c4-editor.css');
const FIXTURES = path.join(ARCHUML, 'tests/c4/fixtures');
const COURSE = fs.readFileSync(path.join(FIXTURES, 'course-registration.yml'), 'utf8');
const INTERFACES = fs.readFileSync(path.join(FIXTURES, 'course-registration-interfaces.yml'), 'utf8');

const SEATS_PATH = ['systems', 'registration', 'containers', 'api', 'components', 'seats'];
const API_PATH = ['systems', 'registration', 'containers', 'api'];

/** Replaces `from` (which must occur) by `to`: a fixture variant that states exactly what it changes. */
function variant(text, from, to) {
  if (!text.includes(from)) throw new Error(`Fixture text not found: ${from}`);
  return text.replace(from, to);
}

// Seat Gateway without its technology (warning c4/no-technology) and with a responsibility that reads as a method
// call (warning rdd/not-an-obligation, the inline lint of the responsibility editor).
const SEATS_UNFINISHED = variant(
  variant(COURSE, '            name: Seat Gateway\n            technology: Python module\n', '            name: Seat Gateway\n'),
  '              - know: which seats are held for each attempt\n', '              - know: getSeats()\n');
// The API's "hold a seat" responsibility without its id, so nothing refines it yet.
const HOLDS_WITHOUT_ID = variant(
  variant(COURSE, '            id: api-holds\n            refines: sys-holds\n', '            refines: sys-holds\n'),
  '              - do: hold every requested seat atomically, or none\n                refines: api-holds\n',
  '              - do: hold every requested seat atomically, or none\n');
// Seat Gateway's container-crossing call to the database without its technology (warning c4/cross-container-technology).
const CROSSING_WITHOUT_TECHNOLOGY = variant(COURSE,
  '              db: {description: writes seat holds to, technology: SQL/TCP}\n', '              db: writes seat holds to\n');
// Line 6 cannot be read: a compact mapping nested in a plain scalar.
const BROKEN_AT_LINE_6 = variant(COURSE, 'enterprise: UCLA\n', 'enterprise: UCLA: x\n');
const EMPTY_MODEL = 'schema: c4-design/1\nname: Campus Booking\n';

const PAGE = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>C4 editor panels</title></head>'
  + '<body><main><h1>C4 editor panels</h1><p>Paragraph text sets the reading size.</p>'
  + '<div id="editor" class="c4-editor"></div></main></body></html>';

/**
 * Runs in the page: mounts the state and every part of this lane into #editor, in the spec's DOM order (toolbar,
 * banner, canvas with the tray and the guide, inspector, panels), and records what the host and the live region hear.
 */
function mountHarness({ text, view, options }) {
  const parts = window.ArchUMLC4EditorParts;
  const { dom } = parts;
  const root = document.getElementById(options.rootId || 'editor');
  const ids = dom.idFactory(options.instanceId || 'ed1');
  const record = { text: [], selections: [], announcements: [], addClicks: 0, quickFixes: [] };
  const host = {
    onTextChange(nextText, info) { record.text.push({ text: nextText, info }); },
    onSelectionChange(selection) { record.selections.push(selection); },
  };
  const state = parts.state.createEditorState({ text, view, host, profile: options.profile, checks: options.checks });
  const liveRegion = dom.createAnnouncer(root);
  const announce = (message) => { record.announcements.push(message); liveRegion(message); };

  const addButton = dom.el('button', { type: 'button', text: 'Add', on: { click() { record.addClicks += 1; } } });
  const toolbar = dom.el('div', { role: 'toolbar', 'aria-label': 'Editor commands' }, addButton);
  const bannerRegion = dom.el('div');
  const trayRegion = dom.el('div');
  const guideRegion = dom.el('div');
  const canvas = dom.el('div', { role: 'region', 'aria-label': 'Canvas' }, [trayRegion, guideRegion]);
  // Stand-in inspector fields that follow the focus-request contract: a selection whose `focus.path` ends in a
  // field's key focuses that field.
  const nameField = dom.el('input', { id: ids('name'), value: 'Registration API' });
  const technologyField = dom.el('input', { id: ids('technology') });
  const inspector = dom.el('div', { role: 'region', 'aria-label': 'Inspector' }, [
    dom.el('label', { for: ids('name'), text: 'Name' }), nameField,
    dom.el('label', { for: ids('technology'), text: 'Technology' }), technologyField,
  ]);
  state.on('selection', (selection) => {
    const fieldPath = selection && selection.focus ? selection.focus.path : [];
    if (fieldPath[fieldPath.length - 1] === 'technology') technologyField.focus();
  });
  const panelRegion = dom.el('div');
  root.append(toolbar, bannerRegion, canvas, inspector, panelRegion);

  const quickFixRegistry = {
    quickFixFor(diagnostic) {
      if (diagnostic.rule !== 'c4/no-technology') return null;
      return {
        label: 'Write TBD',
        apply({ anchor, returnFocus }) {
          record.quickFixes.push({ element: diagnostic.element, anchor: anchor.textContent, returnsFocusToAnchor: returnFocus === anchor });
        },
      };
    },
  };
  const deps = { state, dom, host, ids, announce, options, actions: options.withQuickFix ? quickFixRegistry : undefined };
  const gate = parts.panels.createCommandGate(root, deps);
  gate.gate(addButton);
  deps.gate = gate;
  const panels = parts.panels.createPanels(panelRegion, Object.assign({ bannerRegion }, deps));
  const tray = parts.scaffolds.createCarryDownTray(trayRegion, deps);
  const guide = parts.scaffolds.createEmptyStateGuide(guideRegion, deps);
  const trace = parts.scaffolds.createTraceAnnouncer(deps);
  const mounted = { state, panels, tray, guide, trace, gate, record, options };
  // The first editor is `window.editor` (assigned, since #editor would otherwise answer that name).
  if (!options.instanceId) window.editor = mounted;
}

async function openEditor(page, { text = COURSE, view = null, options = {}, clock = false } = {}) {
  if (clock) await page.clock.install();
  await page.setContent(PAGE);
  for (const script of SCRIPTS) await page.addScriptTag({ path: script });
  await page.addStyleTag({ path: PANELS_CSS });
  await page.evaluate(mountHarness, { text, view, options });
}

const yamlSource = (page) => page.getByRole('textbox', { name: 'YAML source' });
const tab = (page, name) => page.getByRole('tab', { name });
const recorded = (page) => page.evaluate(() => window.editor.record);
const caretLine = (textarea) => textarea.evaluate((field) => field.value.slice(0, field.selectionStart).split('\n').length);

// ---- Review Focus 3: YAML errors -------------------------------------------------------------------------------

test('a YAML syntax error disables Add with a reason and Go to error moves the caret to the error line', async ({ page }) => {
  await openEditor(page, { view: 'containers of registration' });
  const add = page.getByRole('button', { name: 'Add', exact: true });
  await expect(add).not.toHaveAttribute('aria-disabled', 'true');

  await tab(page, 'YAML').click();
  await yamlSource(page).fill(BROKEN_AT_LINE_6);

  const banner = page.getByText(/^Error: Line 6 of the YAML cannot be read/);
  await expect(banner).toBeVisible();
  await expect(add).toHaveAttribute('aria-disabled', 'true');
  await expect(add).toHaveAccessibleDescription('Fix the YAML error on line 6 first.');
  // An aria-disabled control stays focusable; activating it reaches nothing and announces the reason.
  await add.focus();
  await page.keyboard.press('Enter');
  expect((await recorded(page)).addClicks).toBe(0);
  expect((await recorded(page)).announcements.at(-1)).toBe('Fix the YAML error on line 6 first.');
  // The tray's Refine into… is a visual command too; opening the tray itself changes nothing and stays available.
  await page.getByRole('button', { name: 'Responsibilities to refine' }).click();
  const refine = page.getByRole('button', { name: /^Refine into… DECIDE/ });
  await expect(refine).toHaveAttribute('aria-disabled', 'true');
  await expect(refine).toHaveAccessibleDescription('Fix the YAML error on line 6 first.');
  await refine.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menu')).toHaveCount(0);

  await page.getByRole('button', { name: 'Go to error' }).click();
  await expect(yamlSource(page)).toBeFocused();
  expect(await caretLine(yamlSource(page))).toBe(6);

  // The YAML surface stays editable: repairing it lifts the banner and the gate.
  await yamlSource(page).fill(COURSE);
  await expect(banner).toBeHidden();
  await expect(add).not.toHaveAttribute('aria-disabled', 'true');
  await add.click();
  expect((await recorded(page)).addClicks).toBe(1);
});

// ---- Review Focus 2: two-way YAML sync -------------------------------------------------------------------------

test('text typed in the YAML tab updates the canvas and the inspector keeps focus when host text arrives', async ({ page }) => {
  await openEditor(page, { view: 'containers of registration', clock: true });
  await tab(page, 'YAML').click();
  await yamlSource(page).fill(variant(COURSE, 'name: Planner Web App', 'name: Schedule Planner'));
  // Typing is debounced 250 ms: nothing reaches the state before, one change after.
  await page.clock.runFor(200);
  expect((await recorded(page)).text).toHaveLength(0);
  await page.clock.runFor(100);
  expect((await recorded(page)).text.map((change) => change.info.reason)).toEqual(['source']);
  // The canvas draws the state's projection of the view; the Explain panel describes the same projection.
  await tab(page, 'Explain').click();
  await expect(page.getByRole('tabpanel', { name: 'Explain' })).toContainText('Schedule Planner (Container: TypeScript, React)');

  // The YAML tab stays open while the learner works in the inspector, so the source textarea could take focus when
  // it rewrites itself; it must not.
  await tab(page, 'YAML').click();
  const nameField = page.getByLabel('Name');
  await nameField.focus();
  await nameField.evaluate((field) => field.setSelectionRange(5, 5));
  const hostText = variant(COURSE, 'name: Registration Database', 'name: Enrollment Database');
  await page.evaluate((text) => window.editor.state.setText(text), hostText);
  await page.clock.runFor(1000);

  await expect(yamlSource(page)).toBeVisible();
  await expect(yamlSource(page)).toHaveValue(hostText);
  await expect(nameField).toBeFocused();
  await expect(nameField).toHaveValue('Registration API');
  expect(await nameField.evaluate((field) => field.selectionStart)).toBe(5);
  // Host text is never echoed back to the host.
  expect((await recorded(page)).text).toHaveLength(1);
});

test('host text replaces typing that has not reached the state yet, and destroy cancels the pending sync', async ({ page }) => {
  await openEditor(page, { clock: true });
  await tab(page, 'YAML').click();
  await yamlSource(page).fill(variant(COURSE, 'name: Planner Web App', 'name: Typed Name'));
  const hostText = variant(COURSE, 'name: Planner Web App', 'name: Host Name');
  await page.evaluate((text) => window.editor.state.setText(text), hostText);
  await page.clock.runFor(1000);
  await expect(yamlSource(page)).toHaveValue(hostText);
  expect(await page.evaluate(() => window.editor.state.getText())).toBe(hostText);

  await yamlSource(page).fill(COURSE);
  await page.evaluate(() => window.editor.panels.destroy());
  await page.clock.runFor(1000);
  expect((await recorded(page)).text).toHaveLength(0);
  await expect(page.getByRole('tablist')).toHaveCount(0);
});

// ---- Problems ----------------------------------------------------------------------------------------------------

test('Problems groups diagnostics by severity, names element and field, and counts them on its tab', async ({ page }) => {
  await openEditor(page, { text: SEATS_UNFINISHED, view: 'components of api' });
  const panel = page.getByRole('tabpanel', { name: /^Problems/ });
  const groups = panel.getByRole('list');
  await expect(groups).toHaveCount(2);
  await expect(groups.nth(0)).toHaveAccessibleName('Warnings');
  await expect(groups.nth(1)).toHaveAccessibleName('Suggestions');

  const warnings = panel.getByRole('list', { name: 'Warnings' }).getByRole('listitem');
  await expect(warnings).toHaveCount(2);
  for (const row of await warnings.all()) await expect(row.getByText(/^Warning: /)).toBeVisible();
  await expect(warnings.filter({ hasText: 'Seat Gateway › Technology' })).toHaveCount(1);
  await expect(warnings.filter({ hasText: 'Seat Gateway › Responsibility 1' })).toContainText("'getSeats()'");
  const suggestions = panel.getByRole('list', { name: 'Suggestions' }).getByRole('listitem');
  for (const row of await suggestions.all()) await expect(row.getByText(/^Suggestion: /)).toBeVisible();

  const total = await page.evaluate(() => window.editor.state.getDiagnostics().length);
  await expect(tab(page, /^Problems/)).toHaveAccessibleName(`Problems ${total}`);
});

test('Problems states what the checks cannot judge when they find nothing', async ({ page }) => {
  const rules = await (async () => {
    await openEditor(page);
    return page.evaluate(() => [...new Set(window.editor.state.getDiagnostics().map((diagnostic) => diagnostic.rule))]);
  })();
  await openEditor(page, { options: { checks: { disable: rules } } });
  await expect(page.getByRole('tabpanel', { name: /^Problems/ })).toHaveText(
    'The checks found no problems. They test consistency and some completeness, not whether boundaries, owners, or names are right; see Review.');
  await expect(tab(page, /^Problems/)).toHaveAccessibleName('Problems');
});

test('Problems Show focuses the offending field', async ({ page }) => {
  await openEditor(page, { text: SEATS_UNFINISHED, view: 'components of api' });
  const row = page.getByRole('list', { name: 'Warnings' }).getByRole('listitem').filter({ hasText: 'Seat Gateway › Technology' });
  const show = row.getByRole('button', { name: 'Show Technology of Seat Gateway' });

  await show.click();
  // The request travels through the state: the selection names the element and the field, and the host hears it.
  const selections = (await recorded(page)).selections;
  expect(selections.at(-1)).toMatchObject({ elementId: 'seats', focus: { path: SEATS_PATH.concat('technology') } });
  await expect(page.getByLabel('Technology')).toBeFocused();

  // Showing the same field again is a new request, even though the selection names the same element.
  await show.focus();
  await show.click();
  await expect(page.getByLabel('Technology')).toBeFocused();
  expect((await recorded(page)).selections).toHaveLength(selections.length + 1);
});

test('Problems names the field of a relationship problem and Show focuses that field', async ({ page }) => {
  // Seat Gateway's call to the database without its technology: warning c4/cross-container-technology, whose path
  // is the collaborator entry although the missing part is its technology.
  await openEditor(page, { text: CROSSING_WITHOUT_TECHNOLOGY, view: 'components of api' });
  const row = page.getByRole('list', { name: 'Warnings' }).getByRole('listitem')
    .filter({ hasText: 'Seat Gateway › Relationship to Registration Database › Technology' });
  await expect(row).toHaveCount(1);

  await row.getByRole('button', { name: 'Show Technology of the relationship from Seat Gateway to Registration Database' }).click();
  const selection = (await recorded(page)).selections.at(-1);
  expect(selection.focus.path.at(-1)).toBe('technology');
  expect(selection).toHaveProperty('relationshipId');
  await expect(page.getByLabel('Technology')).toBeFocused();
  // The inspector's relationship form finds the warning beside its Technology field.
  const inline = await page.evaluate((fieldPath) => window.ArchUMLC4EditorParts.panels
    .fieldDiagnostics(window.editor.state, fieldPath, window.editor.options).map((diagnostic) => diagnostic.rule), selection.focus.path);
  expect(inline).toContain('c4/cross-container-technology');
});

test('Problems Show moves the YAML caret to a problem that belongs to no element', async ({ page }) => {
  await openEditor(page, { text: variant(COURSE, 'schema: c4-design/1\n', 'schema: c4-design/1\nbogus: 1\n') });
  const row = page.getByRole('list', { name: 'Errors' }).getByRole('listitem');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('YAML line 3');
  await row.getByRole('button', { name: 'Show line 3 in the YAML' }).click();
  await expect(tab(page, 'YAML')).toHaveAttribute('aria-selected', 'true');
  await expect(yamlSource(page)).toBeFocused();
  expect(await caretLine(yamlSource(page))).toBe(3);
});

test('a quick fix from the actions registry appears on its Problems row and opens at its button', async ({ page }) => {
  // The harness's registry follows c4-editor-actions.js (Ruling 20): `quickFixFor(diagnostic)` gives `{ label,
  // apply({ anchor, returnFocus }) }` for c4/no-technology here, and null otherwise.
  await openEditor(page, { text: SEATS_UNFINISHED, options: { withQuickFix: true } });
  const rows = page.getByRole('list', { name: 'Warnings' }).getByRole('listitem');
  await expect(rows.getByRole('button', { name: /^Write TBD/ })).toHaveCount(1);
  await rows.filter({ hasText: 'Seat Gateway › Technology' }).getByRole('button', { name: 'Write TBD (Seat Gateway › Technology)' }).click();
  expect((await recorded(page)).quickFixes).toEqual([{ element: 'seats', anchor: 'Write TBD (Seat Gateway › Technology)', returnsFocusToAnchor: true }]);
});

// ---- checks.display (spec §9.3) -----------------------------------------------------------------------------------

/** What a learner would see of the diagnostics: Problems rows, YAML markers, and the inline lint of one field. */
async function visibleDiagnostics(page) {
  await tab(page, 'YAML').click();
  const markers = await page.getByRole('list', { name: 'Problems in the YAML' }).getByRole('listitem').count();
  await tab(page, /^Problems/).click();
  const rows = await page.getByRole('tabpanel', { name: /^Problems/ }).getByRole('listitem').count();
  const inlineLint = await page.evaluate((fieldPath) => window.ArchUMLC4EditorParts.panels
    .fieldDiagnostics(window.editor.state, fieldPath, window.editor.options)
    .map((diagnostic) => ({ rule: diagnostic.rule, text: diagnostic.text })), SEATS_PATH.concat('responsibilities', 0));
  return { markers, rows, inlineLint };
}

test('on-request display shows no diagnostics, inline lint included, until Check now', async ({ page }) => {
  await openEditor(page, { text: SEATS_UNFINISHED, options: { checks: { display: 'on-request' } } });
  await expect(page.getByRole('tabpanel', { name: /^Problems/ })).toContainText('Problems are hidden until you choose Check now.');
  expect(await visibleDiagnostics(page)).toEqual({ markers: 0, rows: 0, inlineLint: [] });
  await expect(page.getByRole('button', { name: 'Submit for review' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Check now' }).click();
  await expect(page.getByRole('tabpanel', { name: /^Problems/ })).not.toContainText('Problems are hidden');
  const shown = await visibleDiagnostics(page);
  expect(shown.rows).toBeGreaterThan(0);
  expect(shown.markers).toBe(shown.rows);
  expect(shown.inlineLint).toEqual([{ rule: 'rdd/not-an-obligation', text: expect.stringMatching(/^Warning: .*'getSeats\(\)'/) }]);
});

test('after-submit display shows diagnostics and inline lint only after submitForReview', async ({ page }) => {
  await openEditor(page, { text: SEATS_UNFINISHED, options: { checks: { display: 'after-submit' } } });
  await expect(page.getByRole('tabpanel', { name: /^Problems/ })).toContainText('Problems are hidden until you submit for review.');
  await expect(page.getByRole('button', { name: 'Check now' })).toHaveCount(0);
  // Check now (the tutorial's Ctrl+Enter path calls the host instead) releases nothing in this mode.
  await page.evaluate(() => window.editor.state.checkNow());
  expect(await visibleDiagnostics(page)).toEqual({ markers: 0, rows: 0, inlineLint: [] });

  // The panel offers the button; a host (a tutorial's own submit) calls the same release through the editor API.
  await expect(page.getByRole('button', { name: 'Submit for review' })).toBeVisible();
  await page.evaluate(() => window.editor.state.submitForReview());
  await expect(page.getByRole('tabpanel', { name: /^Problems/ })).not.toContainText('Problems are hidden');
  const shown = await visibleDiagnostics(page);
  expect(shown.rows).toBeGreaterThan(0);
  expect(shown.markers).toBe(shown.rows);
  expect(shown.inlineLint.map((diagnostic) => diagnostic.rule)).toEqual(['rdd/not-an-obligation']);
});

test('an unreadable YAML text is marked in the YAML tab before Check now, while lint stays hidden', async ({ page }) => {
  await openEditor(page, { options: { checks: { display: 'on-request' } } });
  await tab(page, 'YAML').click();
  await yamlSource(page).fill(BROKEN_AT_LINE_6);
  const markers = page.getByRole('list', { name: 'Problems in the YAML' }).getByRole('listitem');
  await expect(markers).toHaveCount(1);
  await expect(markers).toHaveText(/^Line 6: Error: /);
  await expect(yamlSource(page)).toHaveAttribute('aria-invalid', 'true');
  await expect(yamlSource(page)).toHaveAccessibleDescription(/^Line 6: Error: /);
  await tab(page, /^Problems/).click();
  await expect(page.getByRole('tabpanel', { name: /^Problems/ })).toContainText('Problems are hidden until you choose Check now.');
});

test('inline lint stays off with its scaffold switched off, while errors on the field still show', async ({ page }) => {
  const text = variant(SEATS_UNFINISHED, '              - know: getSeats()\n', '              - know: getSeats()\n                refines: no-such-responsibility\n');
  await openEditor(page, { text, options: { scaffolds: { inlineLint: false } } });
  const rules = await page.evaluate((fieldPath) => window.ArchUMLC4EditorParts.panels
    .fieldDiagnostics(window.editor.state, fieldPath, window.editor.options).map((diagnostic) => diagnostic.rule), SEATS_PATH.concat('responsibilities', 0));
  expect(rules).toEqual(['model/unknown-reference']);
});

// ---- Carry-down tray ---------------------------------------------------------------------------------------------

test('the carry-down tray counts descendant refinements and Refine into writes refines', async ({ page }) => {
  await openEditor(page, { view: 'containers of registration' });
  const toggle = page.getByRole('button', { name: 'Responsibilities to refine' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');

  const items = page.getByRole('list', { name: 'Responsibilities to refine' }).getByRole('listitem');
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText('DECIDE whether a student may enroll in a section');
  await expect(items.nth(0)).toContainText('Refined by 1 responsibility');
  const holds = items.filter({ hasText: 'DO hold a seat in every section of a plan, or in none' });
  await expect(holds).toContainText('Refined by 1 responsibility');

  const refine = holds.getByRole('button', { name: 'Refine into… DO hold a seat in every section of a plan, or in none' });
  await refine.click();
  const menu = page.getByRole('menu');
  await expect(menu.getByRole('menuitem')).toHaveText(['Planner Web App', 'Registration API', 'Registration Database']);
  await menu.getByRole('menuitem', { name: 'Registration Database' }).click();

  await expect(holds).toContainText('Refined by 2 responsibilities');
  await expect(menu).toBeHidden();
  await expect(refine).toBeFocused();
  const written = await page.evaluate(() => {
    const db = window.ArchUMLC4.load(window.editor.state.getText()).model.elements.get('db');
    return db.responsibilities.map(({ kind, text, refines }) => ({ kind, text, refines }));
  });
  expect(written.at(-1)).toEqual({ kind: 'do', text: 'hold a seat in every section of a plan, or in none', refines: ['sys-holds'] });
  const changes = (await recorded(page)).text;
  expect(changes).toHaveLength(1);
  expect(changes[0].info.label).toBe('Refine responsibility');
  expect((await recorded(page)).announcements).toContainEqual(
    "Registration Database now refines 'hold a seat in every section of a plan, or in none'. Reword the copy for Registration Database's part.");
});

test('Refine into gives an unnamed parent responsibility an id first, in one undo step, from the keyboard', async ({ page }) => {
  await openEditor(page, { text: HOLDS_WITHOUT_ID, view: 'components of api' });
  await page.getByRole('button', { name: 'Responsibilities to refine' }).click();
  const holds = page.getByRole('listitem').filter({ hasText: 'DO hold a seat in every section of a plan, or in none' });
  await expect(holds).toContainText('Not refined yet');

  await holds.getByRole('button', { name: /^Refine into…/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'Registration Coordinator' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Seat Gateway' })).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(holds).toContainText('Refined by 1 responsibility');
  const links = await page.evaluate(() => {
    const model = window.ArchUMLC4.load(window.editor.state.getText()).model;
    return { parent: model.elements.get('api').responsibilities[1].id, child: model.elements.get('seats').responsibilities.at(-1).refines };
  });
  expect(links).toEqual({ parent: 'api-do-1', child: ['api-do-1'] });

  await page.evaluate(() => window.editor.state.undo());
  expect(await page.evaluate(() => window.editor.state.getText())).toBe(HOLDS_WITHOUT_ID);
});

test('Escape closes the Refine into menu and returns focus to its button', async ({ page }) => {
  await openEditor(page, { view: 'containers of registration' });
  await page.getByRole('button', { name: 'Responsibilities to refine' }).click();
  const refine = page.getByRole('button', { name: /^Refine into… DECIDE/ });
  await refine.click();
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toBeHidden();
  await expect(refine).toBeFocused();
  expect((await recorded(page)).text).toHaveLength(0);
});

test('the carry-down tray appears only for container and component views and only with its scaffold on', async ({ page }) => {
  await openEditor(page, { view: 'context of registration' });
  await expect(page.getByRole('button', { name: 'Responsibilities to refine' })).toHaveCount(0);
  await page.evaluate(() => window.editor.state.openView('components of api'));
  await expect(page.getByRole('button', { name: 'Responsibilities to refine' })).toHaveCount(1);

  await openEditor(page, { view: 'containers of registration', options: { scaffolds: { carryDown: false } } });
  await expect(page.getByRole('button', { name: 'Responsibilities to refine' })).toHaveCount(0);
});

// ---- Responsibility trace -----------------------------------------------------------------------------------------

test('selecting a responsibility announces its trace and marks the responsibilities it refines with text', async ({ page }) => {
  await openEditor(page, { view: 'containers of registration' });
  await page.getByRole('button', { name: 'Responsibilities to refine' }).click();
  await page.evaluate(() => window.editor.state.select({ elementId: 'api', responsibilityIndex: 0 }));

  await expect.poll(async () => (await recorded(page)).announcements.at(-1)).toBe('Refined by 1 responsibility, refines 1');
  const items = page.getByRole('list', { name: 'Responsibilities to refine' }).getByRole('listitem');
  await expect(items.filter({ hasText: 'Linked to the selected responsibility' })).toHaveCount(1);
  await expect(items.filter({ hasText: 'Linked to the selected responsibility' })).toContainText('DECIDE whether a student may enroll in a section');

  // The inspector lists the same trace as text, each entry naming its owner.
  const trace = await page.evaluate(() => {
    const scaffolds = window.ArchUMLC4EditorParts.scaffolds;
    const found = scaffolds.traceOf(window.editor.state.getDesign(), 'api-eligibility');
    return { refines: found.refines.map(scaffolds.traceLinkLabel), refinedBy: found.refinedBy.map(scaffolds.traceLinkLabel), elementIds: found.elementIds };
  });
  expect(trace).toEqual({
    refines: ['DECIDE whether a student may enroll in a section (Course Registration)'],
    refinedBy: ['DECIDE whether prerequisites and unit caps allow enrollment (Enrollment Policy)'],
    elementIds: ['registration', 'policy'],
  });
});

// ---- Empty state and definitions ---------------------------------------------------------------------------------

test('the empty-state guide lists the subgoals in order until the model has a system', async ({ page }) => {
  await openEditor(page, { text: EMPTY_MODEL });
  const guide = page.getByRole('list', { name: 'Start your design' });
  await expect(guide.getByRole('listitem')).toHaveText([
    'Add the system you are designing',
    'Who uses it, and which systems does it depend on?',
    'What must it know, do, or decide? Trace each to a requirement.',
    'Zoom in: add containers and give each responsibility one owner (Refine into…)',
  ]);
  await page.evaluate((text) => window.editor.state.setText(text), `${EMPTY_MODEL}systems:\n  booking:\n    name: Room Booking\n`);
  await expect(guide).toHaveCount(0);

  await openEditor(page, { text: EMPTY_MODEL, options: { scaffolds: { emptyStateGuide: false } } });
  await expect(page.getByRole('list', { name: 'Start your design' })).toHaveCount(0);
});

test('definitions popovers carry the chapter wording and stay off when the scaffold is off', async ({ page }) => {
  await openEditor(page);
  const definitions = await page.evaluate(() => {
    const { scaffolds, dom } = window.ArchUMLC4EditorParts;
    const ids = dom.idFactory('ed1');
    const terms = { container: 'Container', component: 'Component', browser_app: 'Browser app' };
    return Object.entries(terms).map(([term, label]) => {
      const anchor = dom.el('button', { type: 'button', id: ids(`tile-${term}`), text: label });
      document.getElementById('editor').append(anchor);
      return scaffolds.attachDefinition(anchor, term, { dom, options: {} }) !== null;
    });
  });
  expect(definitions).toEqual([true, true, true]);

  const expected = {
    Container: 'An application or data store that must be running for the system to work, such as a web app, an API, or a database schema. Not a Docker container, which is only one way to run it.',
    Component: 'A group of related functionality behind one interface, inside one container. It is deployed with its container, never on its own.',
    'Browser app': 'runs in the user\'s browser — separate from the server that delivers it',
  };
  for (const [label, text] of Object.entries(expected)) {
    const anchor = page.getByRole('button', { name: label, exact: true });
    await anchor.focus();
    await expect(page.getByRole('tooltip')).toHaveText(text);
    await expect(anchor).toHaveAccessibleDescription(text);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('tooltip')).toBeHidden();
    await expect(anchor).toBeFocused();
  }

  const attachedWhenOff = await page.evaluate(() => {
    const { scaffolds, dom } = window.ArchUMLC4EditorParts;
    const anchor = dom.el('button', { type: 'button', id: 'ed1-tile-person', text: 'Person' });
    document.getElementById('editor').append(anchor);
    return scaffolds.attachDefinition(anchor, 'person', { dom, options: { scaffolds: { definitions: false } } });
  });
  expect(attachedWhenOff).toBeNull();
});

// ---- Review, Explain, reveal ----------------------------------------------------------------------------------------

const C4_PROMPTS = [
  'Does each box\'s type match who builds and runs it? Is a data store your team runs drawn as its own software system?',
  'Which element is the only writer of each fact, and the one maker of each decision?',
  'Read each arrow aloud from the element that asks: does it say what is asked, and how it travels where it crosses a container?',
  'Which reader and question is this view for, and which level did you leave out for them?',
  'Does each responsibility keep the meaning of the requirement it traces to?',
];

test('Review asks the C4 judgment questions on C4-notation views and the interface questions on interface views', async ({ page }) => {
  await openEditor(page, { text: INTERFACES, view: 'containers of registration' });
  await tab(page, 'Review').click();
  const prompts = page.getByRole('list', { name: 'Questions the checks cannot answer' }).getByRole('listitem');
  await expect(prompts).toHaveText(C4_PROMPTS);

  await page.evaluate(() => window.editor.state.openView('interface tuition-charges'));
  await expect(prompts).toHaveCount(8);
  await expect(prompts.first()).toHaveText('Could a team that never spoke to you call this operation correctly from the description alone?');
  await expect(prompts.filter({ hasText: 'Can a subscriber receive it twice' })).toHaveCount(0);

  await page.evaluate(() => window.editor.state.openView('dynamic enroll'));
  await expect(page.getByRole('list', { name: 'Questions the checks cannot answer' })).toHaveCount(0);
});

test('reveal on-request hides Explain until Show inside, and Explain always prints', async ({ page }) => {
  await openEditor(page, { view: 'containers of registration', options: { reveal: 'on-request' } });
  await tab(page, 'Explain').click();
  const explain = page.getByRole('tabpanel', { name: 'Explain' });
  await expect(explain).not.toContainText('Container view of Course Registration');
  await explain.getByRole('button', { name: 'Show inside' }).click();
  await expect(explain).toContainText('Container view of Course Registration: 3 containers');
  await expect(explain).toBeFocused();

  await tab(page, /^Problems/).click();
  await expect(explain).toBeHidden();
  await page.emulateMedia({ media: 'print' });
  await expect(explain).toBeVisible();
  await expect(page.getByRole('tablist')).toBeHidden();
});

test('the panel tabs follow the arrow keys, Home, and End', async ({ page }) => {
  await openEditor(page);
  await tab(page, /^Problems/).focus();
  await page.keyboard.press('ArrowRight');
  await expect(tab(page, 'Review')).toBeFocused();
  await expect(tab(page, 'Review')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel', { name: 'Review' })).toBeVisible();
  await page.keyboard.press('End');
  await expect(tab(page, 'YAML')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(tab(page, /^Problems/)).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(tab(page, 'YAML')).toBeFocused();
  await page.keyboard.press('Home');
  await expect(tab(page, /^Problems/)).toHaveAttribute('aria-selected', 'true');
});

test('without the internal source editor there is no YAML tab and the banner names the line', async ({ page }) => {
  await openEditor(page, { text: BROKEN_AT_LINE_6, options: { sourceEditor: false } });
  await expect(tab(page, 'YAML')).toHaveCount(0);
  await expect(page.getByText(/^Error: Line 6 of the YAML cannot be read/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Go to error' })).toHaveCount(0);
});

test('two editors on one page share no ids', async ({ page }) => {
  await openEditor(page);
  await page.evaluate(() => document.querySelector('main').append(Object.assign(document.createElement('div'), { id: 'second', className: 'c4-editor' })));
  await page.evaluate(mountHarness, { text: COURSE, view: 'containers of registration', options: { rootId: 'second', instanceId: 'ed2' } });
  const duplicates = await page.evaluate(() => {
    const seen = new Map();
    document.querySelectorAll('[id]').forEach((node) => seen.set(node.id, (seen.get(node.id) || 0) + 1));
    return [...seen].filter(([, count]) => count > 1).map(([id]) => id);
  });
  expect(duplicates).toEqual([]);
  await expect(page.getByRole('tab', { name: 'YAML' })).toHaveCount(2);
});

// ---- Interface review, sentence frames, definitions, and novice deferral (spec §7.2, §9.3, §9.5) ----------------------

const EVENTS = fs.readFileSync(path.join(FIXTURES, 'interfaces-events.yml'), 'utf8');
// Tutorial step 2's seed: the Enrollment API with its syntax only (no purpose, errors, units, formats, or meanings).
const SEED = fs.readFileSync(path.join(FIXTURES, 'interfaces-step2-seed.yml'), 'utf8');
// The seed with the Planner Web App calling submit-plan across the container boundary, so the operation also needs
// an example (interface/no-example only counts operations used across a boundary).
const SEED_USED = variant(SEED, '          coordinator: {description: submits plans to, technology: JSON/HTTPS}\n',
  '          coordinator: {description: submits plans to, technology: JSON/HTTPS, uses: enrollment-api.submit-plan}\n');
// Billing Gateway, an interfacer that already uses Tuition Charges, also provides an in-process interface of its own.
const GATEWAY_TRANSLATES = variant(INTERFACES,
  '            stereotypes: [interfacer]\n            responsibilities:\n              - do: request tuition charges for a completed enrollment\n',
  '            stereotypes: [interfacer]\n            provides:\n              charge-port:\n                name: Charge port\n'
  + '                style: library\n                operations:\n                  request-charge: {syntax: "request_charge(enrollment)"}\n'
  + '            responsibilities:\n              - do: request tuition charges for a completed enrollment\n');
const INTERFACE_PROMPT_COUNT = 8;
const DELIVERY_PROMPT = 'Can a subscriber receive it twice, out of order, or not at all?';
const TRANSLATION_PROMPT = 'Which formats, units, and terms does it translate?';
const FIELDS_OF_THE_SEED = ['EnrollmentRequest.student_id', 'EnrollmentRequest.term', 'EnrollmentRequest.section_ids',
  'EnrollmentOutcome.status', 'EnrollmentOutcome.units_enrolled', 'EnrollmentOutcome.decided_at', 'EnrollmentOutcome.reason'];

const reviewPrompts = (page) => page.getByRole('list', { name: 'Questions the checks cannot answer' }).getByRole('listitem');
const select = (page, selection) => page.evaluate((chosen) => window.editor.state.select(chosen), selection);

test('the Review panel shows the interface prompts for an element with interfaces, plus the delivery prompt for event interfaces and the translation prompt for an interfacer that provides one interface and uses another', async ({ page }) => {
  await openEditor(page, { text: INTERFACES, view: 'containers of registration' });
  await tab(page, 'Review').click();
  await select(page, { elementId: 'seats' });
  await expect(reviewPrompts(page), 'an element without interfaces gets the C4 questions only').toHaveText(C4_PROMPTS);

  await select(page, { elementId: 'api' });
  await expect(reviewPrompts(page)).toHaveCount(C4_PROMPTS.length + INTERFACE_PROMPT_COUNT);
  await expect(reviewPrompts(page).nth(C4_PROMPTS.length))
    .toHaveText('Could a team that never spoke to you call this operation correctly from the description alone?');
  await expect(reviewPrompts(page).filter({ hasText: DELIVERY_PROMPT }), 'Enrollment API is a REST interface').toHaveCount(0);
  await expect(reviewPrompts(page).filter({ hasText: TRANSLATION_PROMPT }), 'the API is not an interfacer').toHaveCount(0);

  await select(page, { interfaceId: 'enrollment-api' });
  await expect(reviewPrompts(page), 'the interface form asks the same questions').toHaveCount(C4_PROMPTS.length + INTERFACE_PROMPT_COUNT);

  await openEditor(page, { text: EVENTS, view: 'containers of orders-system' });
  await tab(page, 'Review').click();
  await select(page, { elementId: 'orders' });
  await expect(reviewPrompts(page).last()).toHaveText(DELIVERY_PROMPT);

  await openEditor(page, { text: GATEWAY_TRANSLATES, view: 'components of api' });
  await tab(page, 'Review').click();
  await select(page, { elementId: 'billing-gateway' });
  await expect(reviewPrompts(page).last()).toHaveText(TRANSLATION_PROMPT);
  await expect(reviewPrompts(page).filter({ hasText: DELIVERY_PROMPT })).toHaveCount(0);
});

test('the automated results list operations without purpose, errors, or examples, and the novice checklist lists fields without a meaning', async ({ page }) => {
  const gaps = (name) => page.getByRole('tabpanel', { name: 'Review' }).getByRole('list', { name, exact: true }).getByRole('listitem');
  await openEditor(page, { text: SEED_USED, view: 'containers of registration' });
  await tab(page, 'Review').click();
  await select(page, { elementId: 'api' });
  await expect(gaps('Operations without a Purpose')).toHaveText(['submit-plan']);
  await expect(gaps('Operations without Errors')).toHaveText(['submit-plan']);
  await expect(gaps('Operations without Examples')).toHaveText(['submit-plan']);
  await expect(gaps('Fields without a Unit')).toHaveText(['EnrollmentOutcome.units_enrolled']);
  await expect(gaps('Fields without a Format')).toHaveText(['EnrollmentOutcome.decided_at']);
  await expect(gaps('Fields without a Meaning')).toHaveText(FIELDS_OF_THE_SEED);
  await expect(gaps('Checklist: fields without a Meaning'), 'the checklist is a novice scaffold').toHaveCount(0);

  await select(page, { elementId: 'web' });
  await expect(gaps('Operations without a Purpose'), 'only the interfaces under review are listed').toHaveCount(0);

  // The novice profile hides suggestions (interface/no-meaning is one), so its checklist lists every field without a
  // meaning, whether or not the checks ran.
  await openEditor(page, { text: SEED_USED, view: 'containers of registration', options: { profile: 'novice', checks: { display: 'on-request' } } });
  await tab(page, 'Review').click();
  await select(page, { elementId: 'api' });
  await expect(gaps('Checklist: fields without a Meaning')).toHaveText(FIELDS_OF_THE_SEED);
  await expect(gaps('Fields without a Meaning')).toHaveCount(0);
});

// The inspector with its interface form, the actions it needs, and the panels, on one editor root.
const FORM_SCRIPTS = ['uml-bundle.js'].concat(MANIFEST.core, MANIFEST.render, [
  'c4/editor/c4-editor-dom.js',
  'c4/editor/c4-editor-state.js',
  'c4/editor/c4-editor-actions-shared.js',
  'c4/editor/c4-editor-actions-fields.js',
  'c4/editor/c4-editor-actions-canvas.js',
  'c4/editor/c4-editor-actions-ids.js',
  'c4/editor/c4-editor-actions-elements.js',
  'c4/editor/c4-editor-actions-relationships.js',
  'c4/editor/c4-editor-actions-relationship-form.js',
  'c4/editor/c4-editor-actions.js',
  'c4/editor/c4-editor-scaffolds.js',
  'c4/editor/c4-editor-panels.js',
  'c4/editor/c4-editor-lists.js',
  'c4/editor/c4-editor-interfaces-shared.js',
  'c4/editor/c4-editor-interfaces-examples.js',
  'c4/editor/c4-editor-interfaces-meaning.js',
  'c4/editor/c4-editor-interfaces-semantic.js',
  'c4/editor/c4-editor-interfaces-types.js',
  'c4/editor/c4-editor-interfaces-syntactic.js',
  'c4/editor/c4-editor-interfaces-section.js',
  'c4/editor/c4-editor-interfaces-form.js',
  'c4/editor/c4-editor-interfaces.js',
  'c4/editor/c4-editor-inspector-shared.js',
  'c4/editor/c4-editor-inspector-focus.js',
  'c4/editor/c4-editor-inspector-kit.js',
  'c4/editor/c4-editor-inspector-identity.js',
  'c4/editor/c4-editor-inspector-responsibilities.js',
  'c4/editor/c4-editor-inspector-choices.js',
  'c4/editor/c4-editor-inspector-relationships.js',
  'c4/editor/c4-editor-inspector-position.js',
  'c4/editor/c4-editor-inspector-scenarios.js',
  'c4/editor/c4-editor-inspector-deployment.js',
  'c4/editor/c4-editor-inspector-records.js',
  'c4/editor/c4-editor-inspector.js',
]).map((file) => path.join(ARCHUML, file));

async function openInterfaceForm(page, { text = SEED, view = null, select: selection = { interfaceId: 'enrollment-api' },
  profile = 'expert', scaffolds = {}, clock = false } = {}) {
  if (clock) await page.clock.install();
  await page.setContent(PAGE.replace('<div id="editor" class="c4-editor"></div>',
    '<div id="editor" class="c4-editor"><section id="inspector" aria-label="Inspector"></section><div id="panels"></div></div>'));
  // The site's root rule makes 1rem = 10 px; widgets must not shrink text with rem.
  await page.addStyleTag({ content: 'html { font-size: 62.5%; } body { font-size: 1.8rem; }' });
  await page.addStyleTag({ path: PANELS_CSS });
  for (const script of FORM_SCRIPTS) await page.addScriptTag({ path: script });
  await page.evaluate((settings) => {
    const root = document.getElementById('editor');
    const parts = window.ArchUMLC4EditorParts;
    const texts = [];
    let clockTick = 0;
    const host = { onTextChange: (next) => texts.push(next), confirm: () => Promise.resolve(true) };
    const state = parts.state.createEditorState({
      text: settings.text, host, view: settings.view, profile: settings.profile, now: () => (clockTick += 1000),
    });
    const ids = parts.dom.idFactory('ed1');
    const announce = parts.dom.createAnnouncer(root);
    const options = { profile: settings.profile, scaffolds: settings.scaffolds, checks: {}, lockedFields: [], readOnly: false };
    const deps = { state, dom: parts.dom, host, ids, announce, options };
    const actions = parts.actions.createActions(root, { state, dom: parts.dom, host, ids, announce, scaffolds: settings.scaffolds });
    parts.inspector.createInspector(document.getElementById('inspector'), Object.assign({ actions, layout: { revealRegion: () => true } }, deps));
    parts.panels.createPanels(document.getElementById('panels'), deps);
    if (settings.select) state.select(settings.select);
    window.harness = { state, texts };
  }, { text, view, select: selection, profile, scaffolds });
  return page.getByRole('region', { name: 'Inspector' });
}

async function semanticPanel(inspector) {
  await inspector.getByRole('tab', { name: /^Semantic view/ }).click();
  return inspector.getByRole('tabpanel', { name: /^Semantic view/ });
}

/** A regular expression that matches `text` literally, anywhere in a longer string (an accessible description). */
function containing(text) {
  return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
}

const REQUEST_FRAME = 'When a client …, Registration API … and returns ….';
const ERROR_FRAME = 'Happens when …; the client should then ….';

test('sentence frames appear as hint text linked by aria-describedby and never enter the YAML', async ({ page }) => {
  const inspector = await openInterfaceForm(page);
  const semantic = await semanticPanel(inspector);
  const submitPlan = semantic.getByRole('region', { name: 'submit-plan: POST /v1/enrollments' });
  const purpose = submitPlan.getByRole('textbox', { name: 'Purpose' });
  await expect(purpose).toHaveAccessibleDescription(containing(REQUEST_FRAME));
  await expect(submitPlan.getByText(REQUEST_FRAME, { exact: true }), 'the frame is visible beside the field').toBeVisible();
  await expect(purpose, 'a frame is never a field value').toHaveValue('');
  await expect(submitPlan.getByRole('textbox', { name: 'When the new error happens' })).toHaveAccessibleDescription(containing(ERROR_FRAME));
  await expect(submitPlan.getByRole('textbox', { name: 'New side effect' }))
    .toHaveAccessibleDescription(containing('After a successful call, … has changed: ….'));
  await expect(submitPlan.getByRole('textbox', { name: 'New restriction' }))
    .toHaveAccessibleDescription(containing('Only … may call this, and only when ….'));
  const meaningOfData = semantic.getByRole('region', { name: 'Meaning of data' });
  const unitsEnrolled = meaningOfData.getByRole('group', { name: 'units_enrolled: number', exact: true });
  await expect(unitsEnrolled.getByRole('textbox', { name: 'Meaning' }))
    .toHaveAccessibleDescription(containing('The … that this field identifies or measures, for ….'));
  await expect(unitsEnrolled.getByRole('textbox', { name: 'Unit' }))
    .toHaveAccessibleDescription(containing('A value of 1 in this field means one … (second, cent, kilogram, item).'));
  await expect(meaningOfData.getByRole('group', { name: 'decided_at: datetime', exact: true }).getByRole('textbox', { name: 'Format' }))
    .toHaveAccessibleDescription(containing('Written as …: which comes first, day or month? Which time zone?'));

  await purpose.fill('Enrolls the student in every section of the plan, or in none.');
  await purpose.press('Tab');
  await expect.poll(() => page.evaluate(() => window.harness.texts.length)).toBe(1);
  const written = await page.evaluate(() => window.harness.texts[0]);
  expect(written).toContain('purpose: Enrolls the student in every section of the plan, or in none.');
  expect(written, 'no frame text reaches the YAML').not.toContain('…');

  const framesOff = await openInterfaceForm(page, { scaffolds: { sentenceFrames: false } });
  const purposeWithoutFrame = (await semanticPanel(framesOff)).getByRole('textbox', { name: 'Purpose' });
  await expect(purposeWithoutFrame).toBeVisible();
  await expect(purposeWithoutFrame).not.toHaveAccessibleDescription(containing('When a client'));
});

test('the Purpose frame follows the interface style: a sender for message interfaces, a publisher for event interfaces', async ({ page }) => {
  let semantic = await semanticPanel(await openInterfaceForm(page, { text: INTERFACES, select: { interfaceId: 'tuition-charges' } }));
  await expect(semantic.getByRole('textbox', { name: 'Purpose' })).toHaveAccessibleDescription(containing('When a sender sends …, Billing System ….'));
  await expect(semantic.getByRole('textbox', { name: 'Purpose' })).not.toHaveAccessibleDescription(containing('publishes'));

  semantic = await semanticPanel(await openInterfaceForm(page, { text: EVENTS, select: { interfaceId: 'order-events' } }));
  await expect(semantic.getByRole('textbox', { name: 'Purpose' }))
    .toHaveAccessibleDescription(containing('When Order Service publishes …, subscribers can ….'));
  // An emitted event has subscribers, not callers: its restrictions ask what a subscriber may rely on.
  await expect(semantic.getByRole('region', { name: 'order-placed: OrderPlaced on the topic orders.placed' })
    .getByRole('textbox', { name: 'New restriction' }))
    .toHaveAccessibleDescription(containing('A subscriber may receive this … (once, or more than once) and … (in order, or in any order).'));
});

test('the Interface description popover says it is not a C4 abstraction, stays open on hover and focus, and closes on Escape without moving focus', async ({ page }) => {
  const inspector = await openInterfaceForm(page, { clock: true });
  const term = inspector.getByRole('button', { name: 'Interface description', exact: true });
  const popover = page.getByRole('tooltip');
  await expect(term).toHaveAccessibleDescription(containing('Not a C4 abstraction: you describe one wherever a client crosses the boundary'));

  await term.hover();
  await expect(popover).toContainText('Not a C4 abstraction');
  await expect(popover).toContainText('Not to be confused with a UML «interface» in the code view, which lists operations only.');
  await popover.hover();
  await page.clock.runFor(1000);
  await expect(popover, 'the pointer can move onto the popover').toBeVisible();
  await page.mouse.move(0, 0);
  await page.clock.runFor(1000);
  await expect(popover).toBeHidden();

  await term.focus();
  await expect(popover).toBeVisible();
  await page.clock.runFor(1000);
  await expect(popover, 'it stays open while its term has focus').toBeVisible();
  await page.keyboard.press('Escape');
  await expect(popover).toBeHidden();
  await expect(term).toBeFocused();

  for (const [name, text] of [['Syntactic view', 'how to call it: operations, parameters, outputs, types, allowed values, constraints.'],
    ['Semantic view', 'what it means: purpose, effects, who may call it, what can go wrong, examples, units and formats.']]) {
    await expect(inspector.getByRole('button', { name, exact: true })).toHaveAccessibleDescription(text);
  }
  // Shared vocabulary is defined where it is written: in its section of the Semantic view.
  const vocabulary = (await semanticPanel(inspector)).getByRole('region', { name: 'Shared vocabulary' });
  await expect(vocabulary.getByRole('button', { name: 'Shared vocabulary', exact: true }))
    .toHaveAccessibleDescription('terms both sides agree on, so the same word means the same thing.');

  const withoutDefinitions = await openInterfaceForm(page, { scaffolds: { definitions: false } });
  await expect(withoutDefinitions.getByRole('heading', { name: 'Enrollment API' })).toBeVisible();
  await expect(withoutDefinitions.getByRole('button', { name: 'Interface description' })).toHaveCount(0);
});

test('in the novice profile interface/no-purpose appears only after focus has left the interface form once', async ({ page }) => {
  const inspector = await openInterfaceForm(page, { profile: 'novice' });
  const noPurpose = () => page.evaluate(() => window.harness.state.getDiagnostics()
    .filter((diagnostic) => diagnostic.rule === 'interface/no-purpose').map((diagnostic) => `${diagnostic.severity} ${diagnostic.operation}`));
  // Lets the editor finish the work that a focus change queues.
  const settle = () => page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
  expect(await noPurpose()).toEqual([]);

  await inspector.getByRole('textbox', { name: 'Name', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(inspector.getByRole('button', { name: 'Change interface id…' })).toBeFocused();
  await settle();
  expect(await noPurpose(), 'moving inside the form keeps the finding back').toEqual([]);

  await tab(page, /^Problems/).focus();
  await expect.poll(noPurpose).toEqual(['warning submit-plan']);
  await expect(page.getByRole('tabpanel', { name: /^Problems/ }).getByText(/^Warning: .*submit-plan/).first()).toBeVisible();
});

/**
 * Leaves the interface form with its Back button (Enter) in the novice profile and checks that interface/no-purpose
 * is held back before and reported after. Back replaces the form, so the focused button is removed: Chromium fires
 * focusout for that, Firefox does not, and the deferral must not depend on it.
 */
async function leaveWithBackReleasesNoPurpose(page) {
  const inspector = await openInterfaceForm(page, { profile: 'novice' });
  const noPurpose = () => page.evaluate(() => window.harness.state.getDiagnostics()
    .filter((diagnostic) => diagnostic.rule === 'interface/no-purpose').map((diagnostic) => `${diagnostic.severity} ${diagnostic.operation}`));
  const back = inspector.getByRole('button', { name: /^Back to / });
  await back.focus();
  expect(await noPurpose(), 'focus inside the form keeps the finding back').toEqual([]);

  await page.keyboard.press('Enter');
  await expect(inspector.getByRole('heading', { name: 'Enrollment API' })).toHaveCount(0);
  await expect.poll(noPurpose, 'leaving with Back releases the finding').toEqual(['warning submit-plan']);
}

test('in the novice profile leaving the interface form with Back releases interface/no-purpose', async ({ page }) => {
  await leaveWithBackReleasesNoPurpose(page);
});

test('in the novice profile leaving the interface form with Back releases interface/no-purpose in Firefox', async ({ playwright }) => {
  const browser = await playwright.firefox.launch();
  try {
    await leaveWithBackReleasesNoPurpose(await browser.newPage());
  } finally {
    await browser.close();
  }
});

// ---- The YAML panel shows every applied change (controller ruling for plan Task 41) ---------------------------
// An inspector form writes through the state's applySourceText, so its change reaches the host as a 'source' change,
// like typing in the YAML tab. The open YAML tab must still show it: otherwise it keeps the text from before the edit,
// and typing there would write that stale text back over the form's change. This test mounts the whole editor
// (tests/helpers/c4-editor-page.js), because the change comes from the real inspector.

test('a scenario field edited in the inspector while the YAML tab is open shows the new text in the YAML source', async ({ page }) => {
  const { loadC4Editor } = require('./helpers/c4-editor-page.js');
  await loadC4Editor(page, { title: 'C4 editor YAML panel' });
  await page.evaluate((text) => {
    window.mountedEditor = window.ArchUMLC4Editor.mount(document.getElementById('editor'),
      { text, view: 'dynamic enroll', host: { onTextChange() {} } });
  }, COURSE);
  await tab(page, 'YAML').click();
  await expect(yamlSource(page)).toHaveValue(COURSE);
  await page.evaluate(() => window.mountedEditor.select({ scenarioId: 'enroll' }));
  const title = page.getByRole('region', { name: 'Inspector' }).getByRole('textbox', { name: 'Title', exact: true });

  await title.fill('Enroll in a semester plan');
  await title.press('Enter');

  const written = await page.evaluate(() => window.mountedEditor.getText());
  expect(written, 'the inspector wrote the new title').toContain('title: Enroll in a semester plan');
  await expect(yamlSource(page)).toHaveValue(written);
});
