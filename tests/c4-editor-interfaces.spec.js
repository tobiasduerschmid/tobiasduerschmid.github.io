// @ts-check
// The C4 editor's Interfaces section and interface form (spec §9.5): the element inspector lists the interfaces a
// system, container, or component provides (the generic list editor, Add interface, Describe fully, Show interfaces
// view), and an interface opens a form with Basics and a two-tab tablist, Syntactic view and Semantic view, whose tab
// names carry their problem counts. The page holds an editor root with the state, the actions module, and the
// inspector; the test selects through the state, as the outline, canvas, and Problems panel do. Every edit is checked
// through the text the host receives (spec §3.4 `onTextChange`), read back with the C4 core.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { a11yCheckpoint } = require('./a11y-helpers');

const ARCHUML = path.resolve(__dirname, '../js/ArchUML');
const C4 = require(path.join(ARCHUML, 'c4/c4-core.js'));
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ARCHUML, 'c4/manifest.json'), 'utf8'));
// The modules the interface form works with, loaded explicitly (the integration step registers them in the manifest).
const SCRIPTS = ['uml-bundle.js'].concat(MANIFEST.core, MANIFEST.render, [
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
]);
const STYLESHEETS = ['css/c4-editor.css']
  .map((file) => path.join(ARCHUML, file));
const FIXTURES = path.join(ARCHUML, 'tests/c4/fixtures');
const REFERENCE = fs.readFileSync(path.join(FIXTURES, 'course-registration.yml'), 'utf8');
// Tutorial step 2's seed: the Enrollment API with its syntax only (no purpose, errors, units, or formats yet).
const SEED = fs.readFileSync(path.join(FIXTURES, 'interfaces-step2-seed.yml'), 'utf8');
const FEATURE = { feature: 'c4-editor' };

const API = ['systems', 'registration', 'containers', 'api'];
const ENROLLMENT_API = API.concat('provides', 'enrollment-api');
const UNITS_ENROLLED = ENROLLMENT_API.concat('types', 'EnrollmentOutcome', 'fields', 'units_enrolled');
const ENROLLMENT_LOCK = ENROLLMENT_API.join('.');

/**
 * Opens a page with one editor root holding the inspector region, the editor state (on `text`, open at `view`, with
 * `select` selected), the actions module, and the inspector. The state's clock advances one second per reading, so no
 * two edits merge into one undo step by timing.
 */
async function openInspector(page, {
  text = SEED, view = 'containers of registration', select = { interfaceId: 'enrollment-api' }, profile = 'expert',
  lockedFields = [], scaffolds = {},
} = {}) {
  await page.setContent([
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>C4 editor interfaces</title></head>',
    '<body><main><h1>C4 editor interfaces</h1><p>Paragraph text sets the reading size.</p>',
    '<div id="editor" class="c4-editor"><section id="inspector" aria-label="Inspector"></section></div>',
    '</main></body></html>',
  ].join(''));
  // The site's root rule makes 1rem = 10 px; widgets must not shrink text with rem.
  await page.addStyleTag({ content: 'html { font-size: 62.5%; } body { font-size: 1.8rem; }' });
  for (const stylesheet of STYLESHEETS) await page.addStyleTag({ path: stylesheet });
  for (const script of SCRIPTS) await page.addScriptTag({ path: path.join(ARCHUML, script) });
  await page.evaluate((settings) => {
    const root = document.getElementById('editor');
    const parts = window.ArchUMLC4EditorParts;
    const texts = [];
    let clock = 0;
    const host = { onTextChange: (text) => texts.push(text), confirm: () => Promise.resolve(true) };
    const state = parts.state.createEditorState({
      text: settings.text, host, view: settings.view, profile: settings.profile, now: () => (clock += 1000),
    });
    const ids = parts.dom.idFactory('ed1');
    const announce = parts.dom.createAnnouncer(root);
    const options = { profile: settings.profile, scaffolds: settings.scaffolds, checks: {}, lockedFields: settings.lockedFields, readOnly: false };
    const actions = parts.actions.createActions(root, { state, dom: parts.dom, host, ids, announce, scaffolds: settings.scaffolds });
    const inspector = parts.inspector.createInspector(document.getElementById('inspector'),
      { state, dom: parts.dom, ids, announce, host, options, actions, layout: { revealRegion: () => true } });
    if (settings.select) state.select(settings.select);
    window.harness = { state, actions, inspector, texts };
  }, { text, view, select, profile, lockedFields, scaffolds });
  return page.getByRole('region', { name: 'Inspector' });
}

/** The text the editor holds now, as the host last heard it (or the initial text). */
async function currentText(page, initial) {
  const texts = await page.evaluate(() => window.harness.texts);
  return texts.length > 0 ? texts[texts.length - 1] : initial;
}

function hostChanges(page) {
  return page.evaluate(() => window.harness.texts.length);
}

function interfaceOf(text, id) {
  const { model } = C4.load(text);
  expect(model, 'the edited text is still readable YAML').not.toBeNull();
  return model.interfaces.get(id);
}

/** The diagnostics the core reports on `text` for the interface `id`, as `rule @ path`. */
function interfaceFindings(text, id) {
  return C4.check(C4.load(text)).filter((diagnostic) => diagnostic.interface === id)
    .map((diagnostic) => `${diagnostic.rule} @ ${diagnostic.path.join('.')}`);
}

function section(inspector, name) {
  return inspector.getByRole('region', { name });
}

async function openTab(inspector, name) {
  const tab = inspector.getByRole('tab', { name: new RegExp(`^${name}`) });
  await tab.click();
  return inspector.getByRole('tabpanel', { name: new RegExp(`^${name}`) });
}

/** One field's row under Meaning of data, by its read-only "name: type" label. */
function meaningRow(panel, label) {
  return section(panel, 'Meaning of data').getByRole('group', { name: label, exact: true });
}

/** The semantic block of one operation, headed by its syntax line. */
function operationBlock(panel, heading) {
  return panel.getByRole('region', { name: heading });
}

async function openDisclosure(scope, name) {
  const summary = scope.locator('summary', { hasText: name });
  if (!(await summary.evaluate((node) => node.parentElement.open))) await summary.click();
  return summary.locator('xpath=..');
}

test.describe('C4 editor Interfaces section', () => {
  test('keyboard only: add an interface to the API, an operation, a purpose, an error, and a unit', async ({ page }) => {
    const inspector = await openInspector(page, { text: REFERENCE, select: 'api' });
    const interfaces = section(inspector, 'Interfaces');

    await interfaces.getByRole('textbox', { name: 'New interface name' }).focus();
    await page.keyboard.type('Enrollment API');
    await page.keyboard.press('Tab');
    await expect(interfaces.getByRole('combobox', { name: 'Style of the new interface' })).toBeFocused();
    await page.keyboard.type('re');
    await page.keyboard.press('Enter');
    await expect(inspector.getByRole('heading', { name: 'Enrollment API', level: 3 }), 'the new interface\'s form opens').toBeFocused();

    const syntactic = inspector.getByRole('tabpanel', { name: /^Syntactic view/ });
    await syntactic.getByRole('textbox', { name: 'New operation syntax' }).focus();
    await page.keyboard.type('POST /v1/enrollments');
    await page.keyboard.press('Enter');
    await syntactic.locator('summary', { hasText: 'post-v1-enrollments: POST /v1/enrollments' }).focus();
    await page.keyboard.press('Enter');
    await syntactic.getByRole('textbox', { name: 'New output field of post-v1-enrollments' }).focus();
    await page.keyboard.type('units_enrolled');
    await page.keyboard.press('Tab');
    await page.keyboard.type('number');
    await page.keyboard.press('Enter');
    await expect(syntactic.getByRole('combobox', { name: 'Type of units_enrolled' })).toHaveValue('number');

    await inspector.getByRole('tab', { name: /^Syntactic view/ }).focus();
    await page.keyboard.press('ArrowRight');
    const semantic = inspector.getByRole('tabpanel', { name: /^Semantic view/ });
    const block = operationBlock(semantic, 'post-v1-enrollments: POST /v1/enrollments');
    await block.getByRole('textbox', { name: 'Purpose' }).focus();
    await page.keyboard.type('When a client submits a plan, the API enrolls the student in every section, or in none.');
    await page.keyboard.press('Tab');
    await block.getByRole('textbox', { name: 'New error name' }).focus();
    await page.keyboard.type('invalid-plan');
    await page.keyboard.press('Tab');
    await page.keyboard.type('422');
    await page.keyboard.press('Tab');
    await page.keyboard.type('the plan lists a section twice; the client shows the duplicate');
    await page.keyboard.press('Enter');
    await expect(block.getByRole('textbox', { name: 'Name of error 1' })).toHaveValue('invalid-plan');
    await meaningRow(semantic, 'units_enrolled: number').getByRole('textbox', { name: 'Unit' }).focus();
    await page.keyboard.type('quarter units');
    await page.keyboard.press('Tab');

    await expect.poll(async () => interfaceOf(await currentText(page, REFERENCE), 'enrollment-api')?.operations[0].output.fields[0].unit)
      .toBe('quarter units');
    const text = await currentText(page, REFERENCE);
    const operation = 'systems.registration.containers.api.provides.enrollment-api.operations.post-v1-enrollments';
    const findings = interfaceFindings(text, 'enrollment-api');
    expect(findings).not.toContain(`interface/no-purpose @ ${operation}`);
    expect(findings).not.toContain(`interface/no-errors @ ${operation}`);
    expect(findings).not.toContain(`interface/no-unit @ ${operation}.output.units_enrolled`);
    expect(interfaceOf(text, 'enrollment-api').style).toBe('rest');
    expect(text, 'a field with a unit is written as a block map').toMatch(/units_enrolled:\n\s+type: number\n\s+unit: quarter units\n/);
  });

  test('each interface row shows its name, style, operation count, and problem count, and Show interfaces view opens the view', async ({ page }) => {
    const inspector = await openInspector(page, { select: 'api' });
    const row = section(inspector, 'Interfaces').getByRole('list', { name: 'Interfaces' }).getByRole('listitem');
    await expect(row).toHaveCount(1);
    await expect(row.getByRole('button', { name: 'Enrollment API', exact: true })).toBeVisible();
    await expect(row).toContainText('REST, 1 operation, 4 warnings');

    await section(inspector, 'Interfaces').getByRole('button', { name: 'Show interfaces view' }).click();
    expect(await page.evaluate(() => window.harness.state.getView())).toBe('interfaces of api');
  });

  test('a row opens its interface form, and Back returns to the element with focus on that row', async ({ page }) => {
    const inspector = await openInspector(page, { select: 'api' });
    await section(inspector, 'Interfaces').getByRole('button', { name: 'Enrollment API', exact: true }).click();
    await expect(inspector.getByRole('heading', { name: 'Enrollment API', level: 3 })).toBeVisible();
    await expect(inspector.getByText('Registration API › Enrollment API')).toBeVisible();

    await inspector.getByRole('button', { name: 'Back to Registration API' }).click();
    await expect(section(inspector, 'Interfaces').getByRole('button', { name: 'Enrollment API', exact: true })).toBeFocused();
  });

  test('Change interface id… in a row\'s menu renames the interface in a dialog and returns focus to the row', async ({ page }) => {
    const inspector = await openInspector(page, { select: 'api' });
    await section(inspector, 'Interfaces').getByRole('button', { name: 'Actions for interface 1' }).click();
    await page.getByRole('menuitem', { name: 'Change interface id…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Change the id of Enrollment API' });
    const newId = dialog.getByRole('textbox', { name: 'New interface id' });
    await expect(newId).toBeFocused();
    await newId.fill('enrollments');
    await newId.press('Enter');

    await expect(dialog).toHaveCount(0);
    await expect.poll(async () => [...C4.load(await currentText(page, SEED)).model.interfaces.keys()])
      .toEqual(['enrollments', 'tuition-charges']);
    await expect(section(inspector, 'Interfaces').getByRole('button', { name: 'Enrollment API', exact: true })).toBeFocused();
  });

  for (const [how, close] of [
    ['Cancel', (dialog) => dialog.getByRole('button', { name: 'Cancel' }).click()],
    ['Escape', (dialog) => dialog.getByRole('textbox', { name: 'New interface id' }).press('Escape')],
  ]) {
    test(`Change interface id… in the form can be backed out of with ${how}: nothing changes and focus returns`, async ({ page }) => {
      const inspector = await openInspector(page);
      const opener = inspector.getByRole('button', { name: 'Change interface id…' });
      await opener.click();
      const dialog = page.getByRole('dialog', { name: 'Change the id of Enrollment API' });
      await dialog.getByRole('textbox', { name: 'New interface id' }).fill('enrollments');
      await close(dialog);

      await expect(dialog).toHaveCount(0);
      await expect(opener).toBeFocused();
      expect(await hostChanges(page), 'backing out writes nothing').toBe(0);
      await opener.click();
      await expect(page.getByRole('dialog', { name: 'Change the id of Enrollment API' })
        .getByRole('textbox', { name: 'New interface id' }), 'the dialog reopens with the current id').toHaveValue('enrollment-api');
    });
  }

  test('Change interface id… keeps the dialog open and names the problem when the new id is taken', async ({ page }) => {
    const inspector = await openInspector(page);
    await inspector.getByRole('button', { name: 'Change interface id…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Change the id of Enrollment API' });
    const newId = dialog.getByRole('textbox', { name: 'New interface id' });
    await newId.fill('tuition-charges');
    await dialog.getByRole('button', { name: 'Change id' }).click();

    await expect(newId).toHaveAttribute('aria-invalid', 'true');
    await expect(newId).toHaveAccessibleDescription(/Error: /);
    expect(await hostChanges(page)).toBe(0);
    await newId.fill('enrollments');
    await newId.press('Enter');
    await expect(dialog).toHaveCount(0);
    await expect(inspector.getByText('enrollments', { exact: true })).toBeVisible();
    await expect(inspector.getByRole('button', { name: 'Change interface id…' })).toBeFocused();
  });

  test('the style select defines each option and defaults to Not sure yet for novices', async ({ page }) => {
    const inspector = await openInspector(page, { text: REFERENCE, select: 'api', profile: 'novice' });
    const style = section(inspector, 'Interfaces').getByRole('combobox', { name: 'Style of the new interface' });
    await expect(style.locator('option:checked')).toHaveText('Not sure yet');
    await expect(style.locator('option')).toHaveText([
      'Not sure yet',
      'REST: requests to resources over HTTP',
      'RPC: calls a function on a remote server',
      'GraphQL: queries a typed schema over HTTP',
      'SOAP: XML messages with a formal contract',
      'Message: commands sent through a queue to one receiver',
      'Event: announcements a publisher sends to any subscriber',
      'Stream: a continuous sequence of records',
      'Library: calls inside one running program',
      'File: a document two systems exchange',
    ]);

    await section(inspector, 'Interfaces').getByRole('textbox', { name: 'New interface name' }).fill('Enrollment API');
    await section(inspector, 'Interfaces').getByRole('button', { name: 'Add interface' }).click();
    await expect.poll(async () => interfaceOf(await currentText(page, REFERENCE), 'enrollment-api')?.name).toBe('Enrollment API');
    expect(interfaceOf(await currentText(page, REFERENCE), 'enrollment-api').style, 'no style is written').toBeNull();
    await expect(section(inspector, 'Basics').getByRole('combobox', { name: 'Style' }).locator('option:checked')).toHaveText('Not sure yet');
  });

  test('Describe fully converts the shorthand in one undo step and keeps uses resolving', async ({ page }) => {
    const withUse = C4.edit(C4.load(REFERENCE), { op: 'setUses', relationshipId: 'web->coordinator', uses: ['coordinator.evaluate'] });
    expect(withUse.error, 'the fixture names the shorthand operation').toBeUndefined();
    const inspector = await openInspector(page, { text: withUse.text, view: 'components of api', select: 'coordinator' });
    const row = section(inspector, 'Interfaces').getByRole('listitem');
    await expect(row.getByRole('textbox', { name: 'Syntax line 1' }), 'a shorthand row edits its syntax lines inline').toHaveValue('evaluate(proposal) -> Outcome');

    await row.getByRole('button', { name: 'Describe fully' }).click();

    await expect.poll(() => hostChanges(page)).toBe(1);
    const text = await currentText(page, withUse.text);
    const described = interfaceOf(text, 'coordinator');
    expect(described).toMatchObject({ shorthand: false, providerId: 'coordinator' });
    expect(described.operations.map((operation) => [operation.id, operation.syntax])).toEqual([['evaluate', 'evaluate(proposal) -> Outcome']]);
    expect(C4.check(C4.load(text)).filter((diagnostic) => diagnostic.rule === 'model/unknown-reference')).toEqual([]);
    expect(C4.load(text).model.relationships.find((relationship) => relationship.id === 'web->coordinator').uses)
      .toMatchObject([{ interfaceId: 'coordinator', operationId: 'evaluate' }]);

    await page.evaluate(() => window.harness.state.undo());
    expect(await currentText(page, withUse.text), 'Undo restores the exact text').toBe(withUse.text);
  });

  test('a shorthand syntax line edited in its row is written to the provides list', async ({ page }) => {
    const inspector = await openInspector(page, { text: REFERENCE, view: 'components of api', select: 'coordinator' });
    const row = section(inspector, 'Interfaces').getByRole('listitem');
    await row.getByRole('textbox', { name: 'New syntax line' }).fill('cancel(attempt) -> Outcome');
    await row.getByRole('button', { name: 'Add syntax line' }).click();

    await expect.poll(async () => C4.load(await currentText(page, REFERENCE)).model.elements.get('coordinator').provides)
      .toEqual(['evaluate(proposal) -> Outcome', 'cancel(attempt) -> Outcome']);
  });
});

test.describe('C4 editor interface form: tabs and problems', () => {
  test('the tabs follow the tabs pattern and name their problem counts', async ({ page }) => {
    const inspector = await openInspector(page);
    const tablist = inspector.getByRole('tablist', { name: 'Views of Enrollment API' });
    const syntactic = tablist.getByRole('tab', { name: /^Syntactic view/ });
    // The step 2 seed lacks submit-plan's purpose and errors, the unit of units_enrolled, and the format of decided_at.
    const semantic = tablist.getByRole('tab', { name: 'Semantic view, 4 warnings', exact: true });
    await expect(syntactic).toHaveAttribute('aria-selected', 'true');

    await syntactic.focus();
    await page.keyboard.press('ArrowRight');
    await expect(semantic).toBeFocused();
    await expect(semantic).toHaveAttribute('aria-selected', 'true');
    await expect(syntactic).toHaveAttribute('aria-selected', 'false');
    const panelId = await semantic.getAttribute('aria-controls');
    const panel = inspector.getByRole('tabpanel', { name: 'Semantic view, 4 warnings' });
    await expect(panel).toHaveAttribute('id', /** @type {string} */ (panelId));
    await expect(panel.getByRole('heading', { name: 'Meaning of data' })).toBeVisible();

    await page.keyboard.press('Home');
    await expect(syntactic).toBeFocused();
    await expect(syntactic).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('End');
    await expect(semantic).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(syntactic).toBeFocused();
    await expect(inspector.getByRole('tabpanel', { name: /^Syntactic view/ }).getByRole('heading', { name: 'Operations' })).toBeVisible();
    await a11yCheckpoint(page, 'c4-editor-interface-form-syntactic', FEATURE);
  });

  test('Problems › Show selects the tab that holds the field', async ({ page }) => {
    const inspector = await openInspector(page);
    await page.evaluate(() => {
      const { state } = window.harness;
      const panels = window.ArchUMLC4EditorParts.panels;
      const missingUnit = state.getDiagnostics().find((diagnostic) => diagnostic.rule === 'interface/no-unit');
      const located = panels.locateDiagnostic(state.getDesign().model, missingUnit);
      state.select(Object.assign({}, located.selection, { focus: { path: located.fieldPath, request: 1 } }));
    });

    await expect(inspector.getByRole('tab', { name: /^Semantic view/ })).toHaveAttribute('aria-selected', 'true');
    const semantic = inspector.getByRole('tabpanel', { name: /^Semantic view/ });
    await expect(meaningRow(semantic, 'units_enrolled: number').getByRole('textbox', { name: 'Unit' })).toBeFocused();
  });

  test('a missing unit shows Warning: inline, linked by aria-describedby, without aria-invalid', async ({ page }) => {
    const inspector = await openInspector(page);
    const semantic = await openTab(inspector, 'Semantic view');
    const unit = meaningRow(semantic, 'units_enrolled: number').getByRole('textbox', { name: 'Unit' });
    await expect(unit).toHaveAccessibleDescription(/Warning: EnrollmentOutcome\.units_enrolled /);
    await expect(meaningRow(semantic, 'units_enrolled: number').getByText(/^Warning: EnrollmentOutcome\.units_enrolled /)).toBeVisible();
    await expect(unit).not.toHaveAttribute('aria-invalid', /.*/);
  });

  test('locked syntax leaves are read-only with the reason, and meanings stay editable', async ({ page }) => {
    const inspector = await openInspector(page, {
      lockedFields: [`${ENROLLMENT_LOCK}.types.*.fields.*.type`, `${ENROLLMENT_LOCK}.operations.*.syntax`],
    });
    const syntactic = inspector.getByRole('tabpanel', { name: /^Syntactic view/ });
    const operation = await openDisclosure(syntactic, 'submit-plan: POST /v1/enrollments');
    const syntax = operation.getByRole('textbox', { name: 'Syntax', exact: true });
    await expect(syntax).toHaveAttribute('readonly', '');
    await expect(syntax).toHaveAccessibleDescription(/^Locked: given by the task/);
    const outcome = await openDisclosure(syntactic, 'EnrollmentOutcome');
    await expect(outcome.getByRole('textbox', { name: 'Type of units_enrolled' }), 'a locked type reads as text').toHaveAttribute('readonly', '');

    const semantic = await openTab(inspector, 'Semantic view');
    const meaning = meaningRow(semantic, 'units_enrolled: number').getByRole('textbox', { name: 'Meaning' });
    await meaning.fill('total units the student holds in the term after this attempt');
    await meaning.press('Tab');
    await expect.poll(async () => interfaceOf(await currentText(page, SEED), 'enrollment-api').types.get('EnrollmentOutcome').fields
      .find((field) => field.name === 'units_enrolled').meaning).toBe('total units the student holds in the term after this attempt');
  });

  test('a lock on the types map also locks the meanings under it (no implicit exemption)', async ({ page }) => {
    const inspector = await openInspector(page, { lockedFields: [`${ENROLLMENT_LOCK}.types`] });
    const semantic = await openTab(inspector, 'Semantic view');
    await expect(meaningRow(semantic, 'units_enrolled: number').getByRole('textbox', { name: 'Meaning' })).toHaveAttribute('readonly', '');
  });

  // A new operation would get a syntax at a path the wildcard lock covers; errors lie outside it.
  test('a wildcard lock on operation syntax withholds Add operation with the reason, and errors can still be added', async ({ page }) => {
    const inspector = await openInspector(page, { lockedFields: [`${ENROLLMENT_LOCK}.operations.*.syntax`] });
    const operations = section(inspector, 'Operations');
    await expect(operations.getByRole('textbox', { name: 'New operation syntax' })).toHaveCount(0);
    await expect(operations.getByText('Locked: the task gives the operations here, so no operation can be added.')).toBeVisible();

    const semantic = await openTab(inspector, 'Semantic view');
    await expect(operationBlock(semantic, 'submit-plan: POST /v1/enrollments').getByRole('textbox', { name: 'New error name' })).toBeEditable();
  });

  test('a wildcard lock on the restrictions withholds Add restriction with the reason', async ({ page }) => {
    const inspector = await openInspector(page, { lockedFields: [`${ENROLLMENT_LOCK}.restrictions.*`] });
    const semantic = await openTab(inspector, 'Semantic view');
    const allOperations = section(semantic, 'All operations');
    await expect(allOperations.getByRole('textbox', { name: 'New restriction' })).toHaveCount(0);
    await expect(allOperations.getByText('Locked: the task gives the restrictions here, so no restriction can be added.')).toBeVisible();
  });

  // Renaming rewrites the YAML key, so a lock anywhere under the interface would stop matching what it locked.
  test('a lock inside an interface withholds Change interface id… in the form and in its row, with the reason', async ({ page }) => {
    const lockedFields = [`${ENROLLMENT_LOCK}.types`];
    const form = await openInspector(page, { lockedFields });
    const basics = section(form, 'Basics');
    await expect(basics.getByRole('button', { name: 'Change interface id…' })).toHaveCount(0);
    await expect(basics.getByText('Locked: Enrollment API or a part of it is given by the task, so its id cannot be changed here.')).toBeVisible();

    const element = await openInspector(page, { lockedFields, select: 'api' });
    await section(element, 'Interfaces').getByRole('button', { name: 'Actions for interface 1' }).click();
    await expect(page.getByRole('menuitem', { name: 'Change interface id…' })).toHaveAttribute('aria-disabled', 'true');
  });

  test('a lock under an operation, a type, or a field makes its id or name read-only, and its siblings stay renamable', async ({ page }) => {
    const inspector = await openInspector(page, { lockedFields: [
      `${ENROLLMENT_LOCK}.operations.submit-plan.purpose`,
      `${ENROLLMENT_LOCK}.types.EnrollmentOutcome.fields.units_enrolled.unit`,
    ] });
    const syntactic = inspector.getByRole('tabpanel', { name: /^Syntactic view/ });
    const operation = await openDisclosure(syntactic, 'submit-plan: POST /v1/enrollments');
    await expect(operation.getByRole('textbox', { name: 'Id', exact: true })).toHaveAttribute('readonly', '');
    const outcome = await openDisclosure(syntactic, 'EnrollmentOutcome');
    await expect(outcome.getByRole('textbox', { name: 'Name', exact: true })).toHaveAttribute('readonly', '');
    await expect(outcome.getByRole('textbox', { name: 'Name of units_enrolled' })).toHaveAttribute('readonly', '');
    await expect(outcome.getByRole('textbox', { name: 'Name of status' })).toBeEditable();
  });

  // renameType also rewrites every input, output, and field type that names the type, so a lock there refuses it.
  test('a lock on an operation output that names a type makes that type\'s name read-only, with the reason', async ({ page }) => {
    const inspector = await openInspector(page, { lockedFields: [`${ENROLLMENT_LOCK}.operations.submit-plan.output`] });
    const syntactic = inspector.getByRole('tabpanel', { name: /^Syntactic view/ });
    const outcome = await openDisclosure(syntactic, 'EnrollmentOutcome');
    await expect(outcome.getByRole('textbox', { name: 'Name', exact: true })).toHaveAttribute('readonly', '');
    await expect(outcome.getByText('Locked: the task gives a part of the design that names EnrollmentOutcome, so its name cannot be changed here.'))
      .toBeVisible();
    const request = await openDisclosure(syntactic, 'EnrollmentRequest');
    await expect(request.getByRole('textbox', { name: 'Name', exact: true })).toBeEditable();
  });

  // renameOperation and changeInterfaceId also rewrite the `uses` entries that name them, outside the interface.
  test('a lock on a uses entry that names an operation refuses renaming the operation and the interface', async ({ page }) => {
    const usesLock = 'systems.registration.containers.api.components.billing-gateway.collaborators.billing.uses';
    const inspector = await openInspector(page, { select: { interfaceId: 'tuition-charges' }, lockedFields: [usesLock] });
    const basics = section(inspector, 'Basics');
    await expect(basics.getByRole('button', { name: 'Change interface id…' })).toHaveCount(0);
    await expect(basics.getByText('Locked: the task gives a part of the design that names Tuition Charges, so its id cannot be changed here.'))
      .toBeVisible();
    const syntactic = inspector.getByRole('tabpanel', { name: /^Syntactic view/ });
    const operation = await openDisclosure(syntactic, /^charge-tuition: /);
    await expect(operation.getByRole('textbox', { name: 'Id', exact: true })).toHaveAttribute('readonly', '');
  });

  test('a lock under an error makes its name read-only and leaves its description editable', async ({ page }) => {
    const errorLock = 'systems.billing.provides.tuition-charges.operations.charge-tuition.errors.malformed-message.code';
    const inspector = await openInspector(page, { select: { interfaceId: 'tuition-charges' }, lockedFields: [errorLock] });
    const semantic = await openTab(inspector, 'Semantic view');
    const block = operationBlock(semantic, /^charge-tuition: /);
    await expect(block.getByRole('textbox', { name: 'Name of error 1' })).toHaveAttribute('readonly', '');
    await expect(block.getByRole('textbox', { name: 'When error 1 happens' })).toBeEditable();
  });

  test('a lock on one Realizes entry locks the whole group, since a choice rewrites the list', async ({ page }) => {
    const text = SEED.replace('                syntax: POST /v1/enrollments\n',
      '                syntax: POST /v1/enrollments\n                realizes: [api-holds]\n');
    expect(interfaceOf(text, 'enrollment-api').operations[0].realizes, 'the seed now realizes api-holds').toEqual(['api-holds']);
    const inspector = await openInspector(page, { text, lockedFields: [`${ENROLLMENT_LOCK}.operations.submit-plan.realizes.0`] });
    const semantic = await openTab(inspector, 'Semantic view');
    const api = operationBlock(semantic, 'submit-plan: POST /v1/enrollments').getByRole('group', { name: 'Realizes' })
      .getByRole('group', { name: 'Registration API' });
    await expect(api.getByRole('checkbox', { name: /^DO hold a seat in every section/ })).toBeDisabled();
    await expect(api.getByRole('checkbox', { name: /^DECIDE whether a student may enroll/ })).toBeDisabled();
  });
});

test.describe('C4 editor interface form: semantic view', () => {
  test('Meaning of data shows each field\'s type and offers Unit only for numbers', async ({ page }) => {
    const inspector = await openInspector(page);
    const semantic = await openTab(inspector, 'Semantic view');
    const unitsRow = meaningRow(semantic, 'units_enrolled: number');
    await expect(unitsRow.getByText('units_enrolled: number', { exact: true })).toBeVisible();
    await expect(unitsRow.getByRole('textbox', { name: 'Unit' })).toBeVisible();
    await expect(unitsRow.getByRole('textbox', { name: /^Type/ }), 'the type is read-only text here').toHaveCount(0);
    const studentRow = meaningRow(semantic, 'student_id: string');
    await expect(studentRow.getByRole('textbox', { name: 'Format' })).toBeVisible();
    await expect(studentRow.getByRole('textbox', { name: 'Unit' })).toHaveCount(0);

    await section(semantic, 'Meaning of data').getByRole('checkbox', { name: 'Show all properties' }).check();
    await expect(studentRow.getByRole('textbox', { name: 'Unit' })).toBeVisible();
  });

  test('the filter Fields that need a unit or format narrows Meaning of data', async ({ page }) => {
    const inspector = await openInspector(page);
    const semantic = await openTab(inspector, 'Semantic view');
    const meaning = section(semantic, 'Meaning of data');
    await meaning.getByRole('checkbox', { name: 'Fields that need a unit or format' }).check();
    // A row is a group named "name: type" (an Example disclosure is a group named "Example: …").
    await expect(meaning.getByRole('group', { name: /^[A-Za-z_][\w-]*: \S+$/ })).toHaveText([/^units_enrolled: number/, /^decided_at: datetime/]);
  });

  test('the novice profile puts purpose, errors, and Realizes first and the rest in disclosures labelled with their state', async ({ page }) => {
    const inspector = await openInspector(page, { profile: 'novice' });
    const semantic = await openTab(inspector, 'Semantic view');
    const block = operationBlock(semantic, 'submit-plan: POST /v1/enrollments');
    const order = await block.evaluate((node) => [...node.querySelectorAll('.c4-editor__field-label, summary')]
      .map((label) => label.textContent.trim()).filter((label) => /^(Purpose|Errors|Realizes|Side effects|Restrictions|Examples)/.test(label)));
    expect(order).toEqual(['Purpose', 'Errors', 'Realizes', 'Side effects: not described yet', 'Restrictions: not described yet', 'Examples: none yet']);
  });

  test('Realizes writes the responsibility id once and offers descendants\' responsibilities grouped by owner', async ({ page }) => {
    const inspector = await openInspector(page, { profile: 'novice' });
    const semantic = await openTab(inspector, 'Semantic view');
    const realizes = operationBlock(semantic, 'submit-plan: POST /v1/enrollments').getByRole('group', { name: 'Realizes' });
    await expect(realizes.getByRole('group')).toHaveText([/^Registration API/, /^Registration Coordinator/, /^Enrollment Policy/,
      /^Seat Gateway/, /^Billing Gateway/]);
    const seats = realizes.getByRole('group', { name: 'Seat Gateway' });
    await expect(seats.getByRole('checkbox', { name: 'KNOW which seats are held for each attempt (Seat Gateway)' })).toBeVisible();
    await expect(realizes.getByText(/private to/), 'novices judge for themselves').toHaveCount(0);

    await seats.getByRole('checkbox', { name: 'DO hold every requested seat atomically, or none (Seat Gateway)' }).check();
    await expect.poll(() => hostChanges(page)).toBe(1);
    const text = await currentText(page, SEED);
    expect(text.match(/id: seats-do-1\b/g), 'the generated id is written once').toHaveLength(1);
    expect(interfaceOf(text, 'enrollment-api').operations[0].realizes).toEqual(['seats-do-1']);
    await expect(seats.getByRole('checkbox', { name: /^DO hold every requested seat/ })).toBeChecked();

    await page.evaluate(() => window.harness.state.undo());
    expect(await currentText(page, SEED), 'one undo step removes the id and the realizes entry').toBe(SEED);
  });

  test('the expert profile notes a descendant\'s responsibility that refines none of the provider\'s', async ({ page }) => {
    const inspector = await openInspector(page);
    const semantic = await openTab(inspector, 'Semantic view');
    const seats = operationBlock(semantic, 'submit-plan: POST /v1/enrollments').getByRole('group', { name: 'Realizes' })
      .getByRole('group', { name: 'Seat Gateway' });
    await expect(seats.getByRole('checkbox', { name: /^KNOW which seats are held/ })).toHaveAccessibleDescription('private to Seat Gateway');
    await expect(seats.getByRole('checkbox', { name: /^DO hold every requested seat/ })).not.toHaveAccessibleDescription(/private/);
  });

  test('an example row writes the values typed into its field boxes', async ({ page }) => {
    const inspector = await openInspector(page, { profile: 'novice' });
    const semantic = await openTab(inspector, 'Semantic view');
    const block = operationBlock(semantic, 'submit-plan: POST /v1/enrollments');
    const examples = await openDisclosure(block, 'Examples:');
    await examples.getByRole('textbox', { name: 'Input student_id (string)' }).fill('905123456');
    await examples.getByRole('textbox', { name: 'Output status (string)' }).fill('enrolled');
    await examples.getByRole('textbox', { name: 'Output units_enrolled (number)' }).fill('8');
    await examples.getByRole('button', { name: 'Add example' }).click();

    await expect.poll(async () => interfaceOf(await currentText(page, SEED), 'enrollment-api').operations[0].examples.length).toBe(1);
    const [example] = interfaceOf(await currentText(page, SEED), 'enrollment-api').operations[0].examples;
    expect(example.inputText).toBe('{student_id: "905123456"}');
    expect(example.outputText, 'a number is written unquoted').toBe('{status: enrolled, units_enrolled: 8}');
  });

  test('an expert example that does not parse stays as a draft with Error: and the line, and is not written', async ({ page }) => {
    const inspector = await openInspector(page);
    const semantic = await openTab(inspector, 'Semantic view');
    const block = operationBlock(semantic, 'submit-plan: POST /v1/enrollments');
    await block.getByRole('checkbox', { name: 'Write the new example as YAML' }).check();
    const input = block.getByRole('textbox', { name: 'Input as YAML flow text' });
    await input.fill('{student_id: "905123456", section_ids: [187204,');
    await block.getByRole('button', { name: 'Add example' }).click();

    await expect(input).toHaveAccessibleDescription(/^Error: .+ \(line 1\)/);
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(input, 'the draft stays in place').toHaveValue('{student_id: "905123456", section_ids: [187204,');
    expect(await hostChanges(page)).toBe(0);

    await input.fill('{student_id: "905123456", section_ids: ["187204"]}');
    await block.getByRole('button', { name: 'Add example' }).click();
    await expect.poll(async () => interfaceOf(await currentText(page, SEED), 'enrollment-api').operations[0].examples
      .map((example) => example.inputText)).toEqual(['{student_id: "905123456", section_ids: ["187204"]}']);
  });
});

test.describe('C4 editor interface form: opening and styles', () => {
  test('choosing Inline fields for a typed output keeps the choice and replaces the type with the first field in one undo step', async ({ page }) => {
    const inspector = await openInspector(page);
    const syntactic = inspector.getByRole('tabpanel', { name: /^Syntactic view/ });
    const operation = await openDisclosure(syntactic, 'submit-plan');
    const picker = operation.getByRole('combobox', { name: 'Output of submit-plan' });
    await picker.selectOption({ label: 'Inline fields' });

    await expect(picker, 'the picker keeps the learner\'s choice').toHaveValue(/inline/);
    await expect(picker).toHaveAccessibleDescription(/stays EnrollmentOutcome until you add its first field/);
    expect(await hostChanges(page), 'nothing is written before the first field').toBe(0);

    await operation.getByRole('textbox', { name: 'New output field of submit-plan' }).fill('status');
    await operation.getByRole('button', { name: 'Add output field' }).click();
    await expect.poll(async () => interfaceOf(await currentText(page, SEED), 'enrollment-api').operations[0].output.fields
      ?.map((entry) => entry.name)).toEqual(['status']);
    expect(await hostChanges(page), 'one change').toBe(1);
    await page.evaluate(() => window.harness.state.undo());
    await expect.poll(async () => interfaceOf(await currentText(page, SEED), 'enrollment-api').operations[0].output.typeText)
      .toBe('EnrollmentOutcome');
  });

  test('choosing Inline fields for an absent input keeps showing Inline fields until its first field is added', async ({ page }) => {
    const inspector = await openInspector(page);
    const syntactic = inspector.getByRole('tabpanel', { name: /^Syntactic view/ });
    const operation = await openDisclosure(syntactic, 'submit-plan');
    const picker = operation.getByRole('combobox', { name: 'Input of submit-plan' });
    await picker.selectOption({ label: 'None' });
    await expect.poll(async () => interfaceOf(await currentText(page, SEED), 'enrollment-api').operations[0].input ?? null).toBeNull();

    await picker.selectOption({ label: 'Inline fields' });
    await expect(picker).toHaveValue(/inline/);
    await expect(picker).toHaveAccessibleDescription(/written when you add its first field/);
    await operation.getByRole('textbox', { name: 'New input field of submit-plan' }).fill('student_id');
    await operation.getByRole('textbox', { name: 'New input field of submit-plan' }).press('Enter');
    await expect.poll(async () => interfaceOf(await currentText(page, SEED), 'enrollment-api').operations[0].input?.fields
      ?.map((entry) => entry.name)).toEqual(['student_id']);
    await expect(picker).toHaveValue(/inline/);
  });

  test('openInterfaceForm opens an operation with focus on its syntax, and Back returns focus to the opener', async ({ page }) => {
    const inspector = await openInspector(page, { select: null });
    await page.evaluate(() => {
      const opener = document.createElement('button');
      opener.textContent = 'Edit submit-plan';
      document.querySelector('main').appendChild(opener);
      window.harness.inspector.openInterfaceForm('enrollment-api', { operationId: 'submit-plan', focus: 'syntax', returnFocus: opener });
    });
    const syntactic = inspector.getByRole('tabpanel', { name: /^Syntactic view/ });
    await expect(syntactic.getByRole('textbox', { name: 'Syntax', exact: true })).toBeFocused();
    await expect(syntactic.getByRole('textbox', { name: 'Syntax', exact: true })).toHaveValue('POST /v1/enrollments');

    await inspector.getByRole('button', { name: 'Back to Registration API' }).click();
    await expect(page.getByRole('button', { name: 'Edit submit-plan' })).toBeFocused();
  });

  for (const theme of ['light', 'dark']) {
    test(`every control is at least 24 × 24 px and text is paragraph size in ${theme} mode`, async ({ page }) => {
      const inspector = await openInspector(page);
      if (theme === 'dark') await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
      const semantic = await openTab(inspector, 'Semantic view');
      await expect(section(semantic, 'Meaning of data')).toBeVisible();
      const measured = await page.evaluate(() => {
        const paragraph = parseFloat(getComputedStyle(document.querySelector('main p')).fontSize);
        const controls = [...document.querySelectorAll('#inspector :is(button, input, select, textarea, summary, [role="tab"])')]
          .filter((node) => node.getClientRects().length > 0)
          .map((node) => ({ name: node.getAttribute('aria-label') || node.textContent.trim() || node.id, box: node.getBoundingClientRect() }));
        const small = controls.filter(({ box }) => box.width < 24 || box.height < 24).map(({ name }) => name);
        const textSizes = [...document.querySelectorAll('#inspector :is(input, select, textarea, [role="tab"], .c4-editor__field-label, h4)')]
          .filter((node) => node.getClientRects().length > 0).map((node) => parseFloat(getComputedStyle(node).fontSize));
        const hintSizes = [...document.querySelectorAll('#inspector :is(.c4-editor__field-hint, .c4-editor__field-problem)')]
          .filter((node) => node.getClientRects().length > 0).map((node) => parseFloat(getComputedStyle(node).fontSize));
        return { paragraph, small, textSizes, hintSizes, controlCount: controls.length };
      });
      expect(measured.controlCount).toBeGreaterThan(10);
      expect(measured.small, 'controls smaller than 24 × 24 px').toEqual([]);
      expect(Math.min(...measured.textSizes)).toBeGreaterThanOrEqual(measured.paragraph);
      expect(Math.min(...measured.hintSizes), 'hints and problems are at least 0.9em').toBeGreaterThanOrEqual(measured.paragraph * 0.9 - 0.01);
      await a11yCheckpoint(page, `c4-editor-interface-form-${theme}`, FEATURE);
    });
  }
});

// ---- The Uses picker (spec §9.5) -------------------------------------------------------------------------------
//
// The relationship form names the interfaces the source uses: one fieldset per group that §4.11 allows, operations
// first and "Some operations of <name> (unspecified)" last, written with setUses. The DOM-free grouping is checked
// in Node; the form through the text the host receives.

const INTERFACES_FIXTURE = fs.readFileSync(path.join(FIXTURES, 'course-registration-interfaces.yml'), 'utf8');
const EVENTS = fs.readFileSync(path.join(FIXTURES, 'interfaces-events.yml'), 'utf8');
const WEB_TO_COORDINATOR = 'web->coordinator';
const ENTERED_GROUP = 'Interfaces of Registration API (where the request enters)';
const SUBMIT_PLAN = 'submit-plan: POST /v1/enrollments';
const UNSPECIFIED = 'Some operations of Enrollment API (unspecified)';

/** `text` with `from` replaced once; a fixture anchor that is missing fails the test instead of changing nothing. */
function replaceOnce(text, from, to) {
  if (!text.includes(from)) throw new Error(`fixture anchor not found: ${from}`);
  return text.replace(from, to);
}

// The seed's Enrollment API with a second operation before submit-plan, which realizes api-holds.
const TWO_OPERATIONS = replaceOnce(SEED, [
  '            operations:',
  '              submit-plan:',
  '                syntax: POST /v1/enrollments',
  '                input: EnrollmentRequest',
  '                output: EnrollmentOutcome',
].join('\n'), [
  '            operations:',
  '              list-enrollments:',
  '                syntax: GET /v1/enrollments',
  '                output: EnrollmentOutcome',
  '              submit-plan:',
  '                syntax: POST /v1/enrollments',
  '                input: EnrollmentRequest',
  '                output: EnrollmentOutcome',
  '                realizes: [api-holds]',
].join('\n'));

function relationshipOf(text, relationshipId) {
  const { model } = C4.load(text);
  expect(model, 'the edited text is still readable YAML').not.toBeNull();
  return model.relationships.find((relationship) => relationship.id === relationshipId);
}

function usesOf(text, relationshipId) {
  return relationshipOf(text, relationshipId).uses.map((use) => use.text);
}

async function expectBoxes(scope, names) {
  const boxes = scope.getByRole('checkbox');
  await expect(boxes).toHaveCount(names.length);
  for (const [index, name] of names.entries()) await expect(boxes.nth(index)).toHaveAccessibleName(name);
}

test.describe('C4 editor Uses picker: grouping (DOM-free)', () => {
  const Interfaces = require(path.join(ARCHUML, 'c4/editor/c4-editor-interfaces.js'));
  // The container's components come before its own interface, so document order alone would list the target first.
  const SHOP = [
    'schema: c4-design/1',
    'name: Shop',
    'systems:',
    '  shop:',
    '    name: Shop',
    '    containers:',
    '      web:',
    '        name: Web App',
    '        collaborators:',
    '          checkout: {description: checks out through}',
    '          api: {description: places orders with}',
    '      api:',
    '        name: Shop API',
    '        components:',
    '          checkout:',
    '            name: Checkout',
    '            provides:',
    '              checkout-rpc:',
    '                name: Checkout RPC',
    '                style: rpc',
    '                operations:',
    '                  pay: {syntax: "pay(cart): Receipt"}',
    '        provides:',
    '          shop-api:',
    '            name: Shop API v1',
    '            style: rest',
    '            operations:',
    '              place-order: {syntax: POST /orders}',
    '',
  ].join('\n');
  const titles = (groups) => groups.map((group) => group.title);

  test('a relationship entering a container lists the entered container\'s interfaces before the target\'s own', () => {
    const groups = Interfaces.usesGroups(C4.load(SHOP), { sourceId: 'web', targetId: 'checkout' });
    expect(titles(groups)).toEqual(['Interfaces of Shop API (where the request enters)', 'Interfaces of Checkout']);
  });

  test('a relationship to a container lists its own interfaces before remote interfaces of its parts', () => {
    const groups = Interfaces.usesGroups(C4.load(SHOP), { sourceId: 'web', targetId: 'api' });
    expect(titles(groups)).toEqual(['Interfaces of Shop API', 'Interfaces of Checkout (inside Shop API)']);
  });

  test('a subscriber lists the interfaces it emits into the topic before those the topic carries for others', () => {
    // The shipping service's own event interface comes after the Order Service's in the document.
    const text = replaceOnce(EVENTS, '          - do: ship the materials of every placed order\n', [
      '          - do: ship the materials of every placed order',
      '        provides:',
      '          shipment-events:',
      '            name: Shipment events',
      '            style: event',
      '            operations:',
      '              order-shipped: {syntax: OrderShipped on the topic orders.shipped}',
      '',
    ].join('\n'));
    const groups = Interfaces.usesGroups(C4.load(text), { sourceId: 'shipping', targetId: 'order-topic' });
    expect(titles(groups)).toEqual(['Interfaces Shipping Service emits', 'Interfaces carried by Order Topic']);
  });

  test('choosing a whole interface replaces its operations, and an operation replaces the whole interface', () => {
    const others = [{ interfaceId: 'tuition-charges', operationId: null }];
    const withOperation = others.concat({ interfaceId: 'enrollment-api', operationId: 'submit-plan' });
    expect(Interfaces.toggleUse(withOperation, { interfaceId: 'enrollment-api', operationId: null }, true).map(Interfaces.useText))
      .toEqual(['tuition-charges', 'enrollment-api']);
    const withWhole = others.concat({ interfaceId: 'enrollment-api', operationId: null });
    expect(Interfaces.toggleUse(withWhole, { interfaceId: 'enrollment-api', operationId: 'submit-plan' }, true).map(Interfaces.useText))
      .toEqual(['tuition-charges', 'enrollment-api.submit-plan']);
    expect(Interfaces.toggleUse(withWhole, { interfaceId: 'enrollment-api', operationId: null }, false).map(Interfaces.useText))
      .toEqual(['tuition-charges']);
  });
});

test.describe('C4 editor Uses picker', () => {
  test('the picker for web → coordinator offers the Enrollment API where the request enters and no in-process interface', async ({ page }) => {
    // Shorthand (in-process) interfaces on the coordinator and on the policy, both components of another container.
    let text = replaceOnce(SEED, '            stereotypes: [coordinator]\n',
      '            stereotypes: [coordinator]\n            provides: ["next(attempt): Step"]\n');
    text = replaceOnce(text, '            stereotypes: [service_provider]\n',
      '            stereotypes: [service_provider]\n            provides: ["decide(student, section): Decision"]\n');
    expect([...C4.load(text).model.interfaces.keys()]).toEqual(expect.arrayContaining(['coordinator', 'policy']));

    const inspector = await openInspector(page, { text, view: 'components of api', select: { relationshipId: WEB_TO_COORDINATOR } });
    const uses = section(inspector, 'Uses');
    const entered = uses.getByRole('group', { name: ENTERED_GROUP });
    await expect(entered.getByRole('group', { name: 'Enrollment API' })).toBeVisible();
    await expectBoxes(uses, [SUBMIT_PLAN, UNSPECIFIED]);
  });

  test('operations come first, in document order, and the unspecified entry last', async ({ page }) => {
    const inspector = await openInspector(page, { text: TWO_OPERATIONS, view: 'components of api', select: { relationshipId: WEB_TO_COORDINATOR } });
    await expectBoxes(section(inspector, 'Uses').getByRole('group', { name: 'Enrollment API' }),
      ['list-enrollments: GET /v1/enrollments', SUBMIT_PLAN, UNSPECIFIED]);
  });

  test('with responsibility: api-holds on the collaborator, submit-plan (which realizes it) is listed first', async ({ page }) => {
    const text = replaceOnce(TWO_OPERATIONS, 'coordinator: {description: submits plans to, technology: JSON/HTTPS}',
      'coordinator: {description: submits plans to, technology: JSON/HTTPS, responsibility: api-holds}');
    const inspector = await openInspector(page, { text, view: 'components of api', select: { relationshipId: WEB_TO_COORDINATOR } });
    await expectBoxes(section(inspector, 'Uses').getByRole('group', { name: 'Enrollment API' }),
      [SUBMIT_PLAN, 'list-enrollments: GET /v1/enrollments', UNSPECIFIED]);
  });

  test('checking an operation writes uses and turns a string collaborator into the map form', async ({ page }) => {
    const text = replaceOnce(SEED, 'coordinator: {description: submits plans to, technology: JSON/HTTPS}', 'coordinator: submits plans to');
    const inspector = await openInspector(page, { text, view: 'components of api', select: { relationshipId: WEB_TO_COORDINATOR } });
    const box = section(inspector, 'Uses').getByRole('checkbox', { name: SUBMIT_PLAN });
    await box.check();

    await expect.poll(async () => usesOf(await currentText(page, text), WEB_TO_COORDINATOR)).toEqual(['enrollment-api.submit-plan']);
    expect(relationshipOf(await currentText(page, text), WEB_TO_COORDINATOR).description, 'the description is kept').toBe('submits plans to');
    expect(await hostChanges(page), 'one change').toBe(1);
    await expect(box, 'focus stays on the box across the re-render').toBeFocused();
    await expect(box).toBeChecked();
  });

  test('unchecking the last entry removes uses', async ({ page }) => {
    const inspector = await openInspector(page, { text: INTERFACES_FIXTURE, view: 'components of api', select: { relationshipId: WEB_TO_COORDINATOR } });
    const box = section(inspector, 'Uses').getByRole('checkbox', { name: SUBMIT_PLAN });
    await expect(box).toBeChecked();
    await box.uncheck();

    await expect.poll(async () => usesOf(await currentText(page, INTERFACES_FIXTURE), WEB_TO_COORDINATOR)).toEqual([]);
    const collaboratorLine = (await currentText(page, INTERFACES_FIXTURE)).split('\n').find((line) => line.trim().startsWith('coordinator:'));
    expect(collaboratorLine, 'no uses key is left behind').not.toContain('uses');
    await expect(box).not.toBeChecked();
  });

  test('choosing the unspecified entry clears the interface\'s operation boxes, and the reverse', async ({ page }) => {
    const inspector = await openInspector(page, { text: INTERFACES_FIXTURE, view: 'components of api', select: { relationshipId: WEB_TO_COORDINATOR } });
    const uses = section(inspector, 'Uses');
    const operation = uses.getByRole('checkbox', { name: SUBMIT_PLAN });
    const whole = uses.getByRole('checkbox', { name: UNSPECIFIED });

    await whole.check();
    await expect.poll(async () => usesOf(await currentText(page, INTERFACES_FIXTURE), WEB_TO_COORDINATOR)).toEqual(['enrollment-api']);
    await expect(operation).not.toBeChecked();

    await operation.check();
    await expect.poll(async () => usesOf(await currentText(page, INTERFACES_FIXTURE), WEB_TO_COORDINATOR)).toEqual(['enrollment-api.submit-plan']);
    await expect(whole).not.toBeChecked();
    expect(await hostChanges(page), 'each choice is one change').toBe(2);
  });

  test('the empty state names the target and offers to add an interface to it, focusing its name field', async ({ page }) => {
    const inspector = await openInspector(page, { view: 'components of api', select: { relationshipId: 'coordinator->policy' } });
    const uses = section(inspector, 'Uses');
    await expect(uses).toContainText('Neither Enrollment Policy nor the elements around it offer a described interface yet.');
    await expect(uses.getByRole('checkbox')).toHaveCount(0);

    await uses.getByRole('button', { name: 'Add an interface to Enrollment Policy' }).click();
    await expect(inspector.getByRole('heading', { name: 'Enrollment Policy', level: 3 })).toBeVisible();
    await expect(section(inspector, 'Interfaces').getByRole('textbox', { name: 'New interface name' })).toBeFocused();
  });

  test('the empty state offers no button when the target cannot take an interface: a person', async ({ page }) => {
    const text = replaceOnce(SEED, '          coordinator: {description: submits plans to, technology: JSON/HTTPS}',
      '          coordinator: {description: submits plans to, technology: JSON/HTTPS}\n          student: shows enrollment results to');
    const inspector = await openInspector(page, { text, view: 'containers of registration', select: { relationshipId: 'web->student' } });
    const uses = section(inspector, 'Uses');
    await expect(uses).toContainText('Neither Student nor the elements around it offer a described interface yet.');
    await expect(uses.getByRole('button', { name: /^Add an interface/ })).toHaveCount(0);
  });

  test('the empty state offers no button when the target\'s interfaces are locked against new entries', async ({ page }) => {
    const providesLock = 'systems.registration.containers.api.components.policy.provides';
    for (const lockedFields of [[providesLock], [`${providesLock}.*`]]) {
      const inspector = await openInspector(page, { view: 'components of api', select: { relationshipId: 'coordinator->policy' }, lockedFields });
      const uses = section(inspector, 'Uses');
      await expect(uses, lockedFields[0]).toContainText('Neither Enrollment Policy nor the elements around it offer a described interface yet.');
      await expect(uses.getByRole('button', { name: /^Add an interface/ }), lockedFields[0]).toHaveCount(0);
    }
  });

  test('a locked relationship shows its uses read-only with the reason', async ({ page }) => {
    const inspector = await openInspector(page, { text: INTERFACES_FIXTURE, view: 'components of api', select: { relationshipId: WEB_TO_COORDINATOR },
      lockedFields: ['systems.registration.containers.web.collaborators.coordinator'] });
    const box = section(inspector, 'Uses').getByRole('checkbox', { name: SUBMIT_PLAN });
    await expect(box).toBeChecked();
    await expect(box).toBeDisabled();
    await expect(box).toHaveAccessibleDescription(/^Locked:/);
    await expect(section(inspector, 'Uses').getByRole('button', { name: /^Add an interface/ })).toHaveCount(0);
  });

  test('a lock on one entry under uses also locks the picker, since a choice rewrites the whole list', async ({ page }) => {
    const inspector = await openInspector(page, { text: INTERFACES_FIXTURE, view: 'components of api', select: { relationshipId: WEB_TO_COORDINATOR },
      lockedFields: ['systems.registration.containers.web.collaborators.coordinator.uses.*'] });
    const uses = section(inspector, 'Uses');
    for (const name of [SUBMIT_PLAN, UNSPECIFIED]) {
      const box = uses.getByRole('checkbox', { name });
      await expect(box, `${name} cannot overwrite the locked entry`).toBeDisabled();
      await expect(box).toHaveAccessibleDescription(/^Locked:/);
    }
    expect(usesOf(await currentText(page, INTERFACES_FIXTURE), WEB_TO_COORDINATOR)).toEqual(['enrollment-api.submit-plan']);
  });

  test('a derived edge lists the union of its sources\' uses, read-only', async ({ page }) => {
    // Three relationships from the web app into the API: two name submit-plan, one the whole interface.
    const text = replaceOnce(INTERFACES_FIXTURE,
      '          coordinator: {description: submits plans to, technology: JSON/HTTPS, uses: enrollment-api.submit-plan}\n', [
        '          coordinator: {description: submits plans to, technology: JSON/HTTPS, uses: enrollment-api.submit-plan}',
        '          seats: {description: checks held seats through, technology: JSON/HTTPS, uses: enrollment-api.submit-plan}',
        '          policy: {description: asks about prerequisites through, technology: JSON/HTTPS, uses: enrollment-api}',
        '',
      ].join('\n'));
    const view = 'containers of registration';
    const edge = C4.project(C4.load(text), view).edges.find((candidate) => candidate.derived && candidate.sourceId === 'web' && candidate.targetId === 'api');
    expect(edge.sources).toHaveLength(3);

    const inspector = await openInspector(page, { text, view, select: { edgeId: edge.id } });
    const uses = section(inspector, 'Uses');
    await expect(uses.getByRole('listitem')).toHaveText(['Enrollment API: submit-plan (POST /v1/enrollments)', UNSPECIFIED]);
    await expect(uses.getByRole('checkbox')).toHaveCount(0);
  });

  test('events: the publisher\'s relationship to the topic lists its own interface under "Interfaces Order Service emits"', async ({ page }) => {
    const inspector = await openInspector(page, { text: EVENTS, view: 'containers of orders-system', select: { relationshipId: 'orders->order-topic' } });
    const emits = section(inspector, 'Uses').getByRole('group', { name: 'Interfaces Order Service emits' });
    await expectBoxes(emits, ['order-placed: OrderPlaced on the topic orders.placed', 'Some operations of Order events (unspecified)']);
    await expect(emits.getByRole('checkbox', { name: 'Some operations of Order events (unspecified)' })).toBeChecked();
  });

  test('events: a subscriber\'s relationship to the topic lists the publisher\'s interface under "Interfaces carried by Order Topic"', async ({ page }) => {
    const inspector = await openInspector(page, { text: EVENTS, view: 'containers of orders-system', select: { relationshipId: 'shipping->order-topic' } });
    const carried = section(inspector, 'Uses').getByRole('group', { name: 'Interfaces carried by Order Topic' });
    await expect(carried.getByRole('checkbox', { name: 'order-placed: OrderPlaced on the topic orders.placed' })).toBeChecked();
  });

  test('the picker placed outside the inspector (the anchored form\'s More) keeps one interface\'s entries exclusive and reports the uses', async ({ page }) => {
    await openInspector(page, { text: SEED, select: null });
    await page.evaluate(() => {
      const parts = window.ArchUMLC4EditorParts;
      const host = document.createElement('div');
      host.id = 'standalone';
      document.querySelector('main').appendChild(host);
      window.reported = [];
      const picker = parts.interfaces.createUsesPicker({
        dom: parts.dom, ids: parts.dom.idFactory('ed2'), design: window.harness.state.getDesign(), name: 'more-uses',
        sourceId: 'web', targetId: 'coordinator', uses: [], onChange: (uses) => { window.reported.push(uses); return true; },
      });
      host.appendChild(picker.element);
      window.picker = picker;
    });
    const standalone = page.locator('#standalone');
    await standalone.getByRole('checkbox', { name: SUBMIT_PLAN }).check();
    await standalone.getByRole('checkbox', { name: UNSPECIFIED }).check();
    await expect(standalone.getByRole('checkbox', { name: SUBMIT_PLAN })).not.toBeChecked();
    expect(await page.evaluate(() => window.reported)).toEqual([['enrollment-api.submit-plan'], ['enrollment-api']]);
    expect(await page.evaluate(() => window.picker.commandFor('web->coordinator')), 'the command a form writes on submit')
      .toEqual({ op: 'setUses', relationshipId: 'web->coordinator', uses: ['enrollment-api'] });
    await standalone.getByRole('checkbox', { name: UNSPECIFIED }).uncheck();
    expect(await page.evaluate(() => window.picker.commandFor('web->coordinator')), 'nothing to write when the choice is unchanged').toBeNull();
    expect(await hostChanges(page), 'the picker itself writes nothing').toBe(0);
  });

  test('a choice its placement does not write leaves the boxes as they were', async ({ page }) => {
    await openInspector(page, { text: SEED, select: null });
    await page.evaluate(() => {
      const parts = window.ArchUMLC4EditorParts;
      const host = document.createElement('div');
      host.id = 'standalone';
      document.querySelector('main').appendChild(host);
      const picker = parts.interfaces.createUsesPicker({
        dom: parts.dom, ids: parts.dom.idFactory('ed2'), design: window.harness.state.getDesign(), name: 'more-uses',
        sourceId: 'web', targetId: 'coordinator', uses: [], onChange: () => false,
      });
      host.appendChild(picker.element);
      window.picker = picker;
    });
    const box = page.locator('#standalone').getByRole('checkbox', { name: SUBMIT_PLAN });
    await box.click();
    await expect(box).not.toBeChecked();
    expect(await page.evaluate(() => window.picker.getUses())).toEqual([]);
  });

  for (const theme of ['light', 'dark']) {
    test(`the picker's controls are at least 24 × 24 px and its text is paragraph size in ${theme} mode`, async ({ page }) => {
      await openInspector(page, { text: INTERFACES_FIXTURE, view: 'components of api', select: { relationshipId: WEB_TO_COORDINATOR } });
      if (theme === 'dark') await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
      const measured = await page.evaluate(() => {
        const paragraph = parseFloat(getComputedStyle(document.querySelector('main p')).fontSize);
        const picker = document.querySelector('#inspector fieldset').closest('section');
        const boxes = [...picker.querySelectorAll('input, button')].map((node) => node.getBoundingClientRect());
        const texts = [...picker.querySelectorAll('legend, label, h4')].map((node) => parseFloat(getComputedStyle(node).fontSize));
        const hints = [...picker.querySelectorAll('.c4-editor__field-hint')].map((node) => parseFloat(getComputedStyle(node).fontSize));
        return { paragraph, small: boxes.filter((box) => box.width < 24 || box.height < 24).length, texts, hints, count: boxes.length };
      });
      expect(measured.count).toBeGreaterThan(1);
      expect(measured.small, 'controls smaller than 24 × 24 px').toBe(0);
      expect(Math.min(...measured.texts)).toBeGreaterThanOrEqual(measured.paragraph);
      expect(Math.min(...measured.hints)).toBeGreaterThanOrEqual(measured.paragraph * 0.9 - 0.01);
      await a11yCheckpoint(page, `c4-editor-uses-picker-${theme}`, FEATURE);
    });
  }
});
