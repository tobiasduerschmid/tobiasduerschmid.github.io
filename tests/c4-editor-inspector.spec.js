// @ts-check
// The C4 editor's inspector (spec §9.1, §9.2, §9.3): the element form (Basics, Responsibilities, Collaborators,
// Relationships in this view, Position, Design choices, More, Decisions affecting it), the relationship form, the
// derived-relationship form, and the generic list editor it reorders lists with. The page holds an editor root with
// the state, the actions module, and the inspector in its region; the test selects through the state, as the canvas
// and outline do. Every edit is checked through the text the host receives (spec §3.4 `onTextChange`), read back with
// the C4 core, never through the inspector's internals.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { a11yCheckpoint } = require('./a11y-helpers');

const ARCHUML = path.resolve(__dirname, '../js/ArchUML');
const C4 = require(path.join(ARCHUML, 'c4/c4-core.js'));
const { isLockedPath } = require(path.join(ARCHUML, 'c4/editor/c4-editor-state.js'));
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ARCHUML, 'c4/manifest.json'), 'utf8'));
// The modules the inspector works with, loaded explicitly (the integration step registers them in the manifest).
// The renderer measures text through the ArchUML bundle, which every page with an editor loads.
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
const WITH_INTERFACES = fs.readFileSync(path.join(FIXTURES, 'course-registration-interfaces.yml'), 'utf8');
const FEATURE = { feature: 'c4-editor' };

/**
 * The reference model with Seat Gateway's relationship to the database declared on the Registration API instead
 * (spec §9.2's move-down example; Ruling 19): api → db is then a container relationship no component sends.
 */
const API_DECLARES_DB = (() => {
  const result = C4.edit(C4.load(REFERENCE), {
    op: 'batch',
    commands: [
      { op: 'removeRelationship', relationshipId: 'seats->db' },
      { op: 'addRelationship', sourceId: 'api', targetId: 'db', description: 'writes seat holds to', technology: 'SQL/TCP' },
    ],
  });
  if (result.error) throw new Error(`The api-declares-db variant could not be built: ${result.message}`);
  return result.text;
})();

/**
 * Opens a page with one editor root holding the inspector region, the editor state (on `text`, open at `view`, with
 * `select` selected), the actions module, and the inspector. The state's clock advances one second per reading, so
 * no two edits merge into one undo step by timing.
 */
async function openInspector(page, {
  text = REFERENCE, view = 'components of api', select = 'seats', profile = 'expert', lockedFields = [], scaffolds = {},
} = {}) {
  await page.setContent([
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>C4 editor inspector</title></head>',
    '<body><main><h1>C4 editor inspector</h1><p>Paragraph text sets the reading size.</p>',
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
    const host = {
      onTextChange: (text) => texts.push(text),
      confirm: () => Promise.resolve(true),
    };
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

async function currentModel(page, initial) {
  const design = C4.load(await currentText(page, initial));
  expect(design.model, 'the edited text is still readable YAML').not.toBeNull();
  return design.model;
}

function hostChanges(page) {
  return page.evaluate(() => window.harness.texts.length);
}

/** A section of the element form, by its heading. */
function section(inspector, name) {
  return inspector.getByRole('region', { name });
}

/** A disclosure of the element form (Position, Design choices, More), opened. */
async function openDisclosure(inspector, name) {
  const summary = inspector.locator('summary', { hasText: name });
  if (!(await summary.evaluate((node) => node.parentElement.open))) await summary.click();
  return summary.locator('xpath=..');
}

function responsibilityRow(inspector, index) {
  return section(inspector, 'Responsibilities').getByRole('listitem').filter({
    has: inspector.page().getByRole('textbox', { name: `Responsibility ${index}`, exact: true }),
  });
}

test.describe('C4 editor inspector: responsibilities', () => {
  test('editing a responsibility kind and text writes the shorthand map', async ({ page }) => {
    const inspector = await openInspector(page);
    const row = responsibilityRow(inspector, 1);

    await row.getByRole('combobox', { name: 'Kind of responsibility 1' }).selectOption({ label: 'DO' });
    await row.getByRole('textbox', { name: 'Responsibility 1', exact: true }).fill('keep the seat holds of each attempt');
    await row.getByRole('textbox', { name: 'Responsibility 1', exact: true }).press('Enter');

    await expect.poll(() => hostChanges(page)).toBe(2);
    const text = await currentText(page, REFERENCE);
    const seats = C4.load(text).model.elements.get('seats');
    expect(seats.responsibilities[0]).toMatchObject({ kind: 'do', text: 'keep the seat holds of each attempt' });
    expect(text, 'the responsibility is written as a map keyed by its kind').toContain('- do: keep the seat holds of each attempt');
    expect(seats.responsibilities[1].text, 'the other responsibility is untouched').toBe('hold every requested seat atomically, or none');
  });

  test('the sentence frame of the chosen kind is visible beside the text and follows a kind change', async ({ page }) => {
    const inspector = await openInspector(page);
    const field = responsibilityRow(inspector, 1).getByRole('textbox', { name: 'Responsibility 1', exact: true });
    await expect(field).toHaveAccessibleDescription(/^Seat Gateway can tell its clients …/);

    await responsibilityRow(inspector, 1).getByRole('combobox', { name: 'Kind of responsibility 1' }).selectOption({ label: 'DECIDE' });
    await expect(responsibilityRow(inspector, 1).getByRole('textbox', { name: 'Responsibility 1', exact: true }))
      .toHaveAccessibleDescription(/^Seat Gateway decides whether …/);
  });

  test('with the sentence frames switched off, no frame is shown', async ({ page }) => {
    const inspector = await openInspector(page, { scaffolds: { sentenceFrames: false } });
    await expect(responsibilityRow(inspector, 1).getByRole('textbox', { name: 'Responsibility 1', exact: true }))
      .not.toHaveAccessibleDescription(/can tell its clients/);
  });

  test('inline lint warns that getSeats() reads as a method', async ({ page }) => {
    const inspector = await openInspector(page);
    const field = responsibilityRow(inspector, 1).getByRole('textbox', { name: 'Responsibility 1', exact: true });
    await field.fill('getSeats()');
    await field.press('Enter');

    const lint = responsibilityRow(inspector, 1).getByText(/^Warning: .*getSeats\(\)/);
    await expect(lint).toBeVisible();
    await expect(responsibilityRow(inspector, 1).getByRole('textbox', { name: 'Responsibility 1', exact: true }))
      .toHaveAccessibleDescription(/Warning: .*getSeats\(\)/);
    await expect(responsibilityRow(inspector, 1).getByRole('textbox', { name: 'Responsibility 1', exact: true }),
      'a warning is not an error, so the field is not invalid').not.toHaveAttribute('aria-invalid', 'true');
    const diagnostics = C4.check(C4.load(await currentText(page, REFERENCE)));
    expect(diagnostics.some((diagnostic) => diagnostic.rule === 'rdd/not-an-obligation' && diagnostic.element === 'seats')).toBe(true);
  });

  test('a new responsibility is added with its kind and text', async ({ page }) => {
    const inspector = await openInspector(page);
    const responsibilities = section(inspector, 'Responsibilities');
    await responsibilities.getByRole('combobox', { name: 'Kind of the new responsibility' }).selectOption({ label: 'DECIDE' });
    await responsibilities.getByRole('textbox', { name: 'New responsibility' }).fill('which seat to release when an attempt fails');
    await responsibilities.getByRole('button', { name: 'Add responsibility' }).click();

    await expect(responsibilityRow(inspector, 3).getByRole('textbox', { name: 'Responsibility 3', exact: true }))
      .toHaveValue('which seat to release when an attempt fails');
    const seats = (await currentModel(page, REFERENCE)).elements.get('seats');
    expect(seats.responsibilities[2]).toMatchObject({ kind: 'decide', text: 'which seat to release when an attempt fails' });
  });
});

test.describe('C4 editor list editor', () => {
  test('Move up in a row\'s menu reorders the list, announces the position, and keeps focus on the moved row', async ({ page }) => {
    const inspector = await openInspector(page);
    await responsibilityRow(inspector, 2).getByRole('button', { name: 'Actions for responsibility 2' }).click();
    await page.getByRole('menuitem', { name: 'Move up' }).click();

    await expect.poll(async () => (await currentModel(page, REFERENCE)).elements.get('seats').responsibilities.map((r) => r.kind))
      .toEqual(['do', 'know']);
    await expect(responsibilityRow(inspector, 1).getByRole('button', { name: 'Actions for responsibility 1' })).toBeFocused();
    await expect(page.getByRole('status')).toHaveText('Moved responsibility 2 to position 1 of 2.');
  });

  test('Move up on the first row is unavailable and says why', async ({ page }) => {
    const inspector = await openInspector(page);
    await responsibilityRow(inspector, 1).getByRole('button', { name: 'Actions for responsibility 1' }).click();
    const moveUp = page.getByRole('menuitem', { name: 'Move up' });
    await expect(moveUp).toHaveAttribute('aria-disabled', 'true');
    await moveUp.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Responsibility 1 is already first.').filter({ visible: true })).toBeVisible();
    expect(await hostChanges(page)).toBe(0);
  });

  test('Remove in a row\'s menu removes the item and moves focus to the row that takes its place', async ({ page }) => {
    const inspector = await openInspector(page);
    await responsibilityRow(inspector, 1).getByRole('button', { name: 'Actions for responsibility 1' }).click();
    await page.getByRole('menuitem', { name: 'Remove' }).click();

    await expect.poll(async () => (await currentModel(page, REFERENCE)).elements.get('seats').responsibilities.map((r) => r.text))
      .toEqual(['hold every requested seat atomically, or none']);
    await expect(responsibilityRow(inspector, 1).getByRole('button', { name: 'Actions for responsibility 1' })).toBeFocused();
  });

  /** The centre of a row's drag handle (decorative for assistive technology; the row menu is its alternative). */
  async function handleCentre(row) {
    await row.scrollIntoViewIfNeeded();
    const box = await row.locator('[data-c4-drag-handle]').boundingBox();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }

  test('dragging a row by its handle above another row reorders the list in one step', async ({ page }) => {
    const inspector = await openInspector(page);
    await section(inspector, 'Responsibilities').scrollIntoViewIfNeeded();
    const from = await handleCentre(responsibilityRow(inspector, 2));
    const firstRow = await responsibilityRow(inspector, 1).boundingBox();

    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x, firstRow.y + 4, { steps: 5 });
    await page.mouse.up();

    await expect.poll(async () => (await currentModel(page, REFERENCE)).elements.get('seats').responsibilities.map((r) => r.kind))
      .toEqual(['do', 'know']);
    expect(await hostChanges(page), 'the drag is one edit').toBe(1);
    await expect(page.getByRole('status')).toHaveText('Moved responsibility 2 to position 1 of 2.');
  });

  test('Escape during a row drag cancels it and leaves the list unchanged', async ({ page }) => {
    const inspector = await openInspector(page);
    await section(inspector, 'Responsibilities').scrollIntoViewIfNeeded();
    const from = await handleCentre(responsibilityRow(inspector, 2));
    const firstRow = await responsibilityRow(inspector, 1).boundingBox();

    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x, firstRow.y + 4, { steps: 5 });
    await page.keyboard.press('Escape');
    await page.mouse.up();

    await expect(page.getByRole('status')).toHaveText('Move canceled; responsibility 2 stays at position 2 of 2.');
    expect(await hostChanges(page)).toBe(0);
  });
});

test.describe('C4 editor inspector: relationships', () => {
  test('Relationships in this view lists outgoing, incoming, and derived edges as buttons that open their forms', async ({ page }) => {
    const inspector = await openInspector(page, { view: 'containers of registration', select: 'api' });
    const relationships = section(inspector, 'Relationships in this view');

    await expect(relationships.getByRole('list', { name: 'Outgoing' })).toHaveCount(0);
    const derived = relationships.getByRole('list', { name: 'Derived' });
    await expect(derived.getByRole('listitem')).toHaveCount(3);
    await derived.getByRole('button', { name: /Registration API → Registration Database/ }).click();

    await expect(inspector.getByRole('heading', { name: 'Derived relationship: Registration API → Registration Database' })).toBeVisible();
    await expect(inspector.getByRole('button', { name: 'Seat Gateway writes seat holds to Registration Database [SQL/TCP]' })).toBeVisible();
  });

  test('a derived edge is reachable from the element\'s Relationships list and Add a summary relationship writes an explicit collaborator', async ({ page }) => {
    const inspector = await openInspector(page, { view: 'containers of registration', select: 'api' });
    await section(inspector, 'Relationships in this view').getByRole('list', { name: 'Derived' })
      .getByRole('button', { name: /Registration API → Registration Database/ }).click();

    await inspector.getByRole('button', { name: 'Add a summary relationship' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add relationship' });
    await dialog.getByRole('textbox', { name: 'Description' }).fill('stores seat holds in');
    await dialog.getByRole('textbox', { name: 'Technology' }).fill('SQL/TCP');
    await dialog.getByRole('textbox', { name: 'Description' }).press('Enter');

    await expect(dialog).toBeHidden();
    const model = await currentModel(page, REFERENCE);
    const summary = model.relationships.find((relationship) => relationship.id === 'api->db');
    expect(summary).toMatchObject({ sourceId: 'api', targetId: 'db', description: 'stores seat holds in', technology: 'SQL/TCP' });
    await expect(inspector.getByRole('heading', { name: 'Relationship: Registration API → Registration Database' })).toBeVisible();
  });

  test('keyboard only: the Move to… button under Relationships in this view moves api → db to Seat Gateway and returns focus to the moved relationship\'s row', async ({ page }) => {
    const inspector = await openInspector(page, { text: API_DECLARES_DB, view: 'containers of registration', select: 'api' });
    const outgoing = section(inspector, 'Relationships in this view').getByRole('list', { name: 'Outgoing' });
    const row = outgoing.getByRole('listitem').filter({ hasText: 'Registration Database' });

    await row.getByRole('button', { name: /^Move to…/ }).focus();
    await page.keyboard.press('Enter');
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('group', { name: 'New source' }).getByRole('menuitem').first()).toBeFocused();
    await page.keyboard.press('s');
    await expect(menu.getByRole('menuitem', { name: 'Seat Gateway' })).toBeFocused();
    await page.keyboard.press('Enter');

    const model = await currentModel(page, API_DECLARES_DB);
    expect(model.relationships.find((relationship) => relationship.sourceId === 'seats' && relationship.targetId === 'db'))
      .toMatchObject({ description: 'writes seat holds to', technology: 'SQL/TCP' });
    expect(model.relationships.some((relationship) => relationship.sourceId === 'api' && relationship.targetId === 'db')).toBe(false);
    const movedRow = section(inspector, 'Relationships in this view').getByRole('list', { name: 'Derived' })
      .getByRole('button', { name: /Registration API → Registration Database/ });
    await expect(movedRow).toBeFocused();
    await expect(movedRow).toHaveAccessibleName(/Seat Gateway writes seat holds to Registration Database/);
  });

  test('the relationship form writes the description and technology through the shared fields', async ({ page }) => {
    const inspector = await openInspector(page, { select: { relationshipId: 'seats->db' } });
    await expect(inspector.getByRole('heading', { name: 'Relationship: Seat Gateway → Registration Database' })).toBeVisible();
    const technology = inspector.getByRole('textbox', { name: 'Technology' });
    await technology.fill('SQL over TLS');
    await technology.press('Enter');

    await expect.poll(async () => (await currentModel(page, REFERENCE)).relationships.find((r) => r.id === 'seats->db').technology)
      .toBe('SQL over TLS');
    await expect(inspector.getByText('Reads as: Seat Gateway writes seat holds to Registration Database [SQL over TLS]')).toBeVisible();
  });

  test('a collaborator is added from the Collaborators section with its target and description', async ({ page }) => {
    const inspector = await openInspector(page, { select: 'policy' });
    const newCollaborator = section(inspector, 'Collaborators').getByRole('group', { name: 'New collaborator' });
    await newCollaborator.getByRole('combobox', { name: 'Target' }).selectOption({ label: 'Seat Gateway' });
    await newCollaborator.getByRole('textbox', { name: 'Description' }).fill('asks for the seats a student holds from');
    await newCollaborator.getByRole('button', { name: 'Add collaborator' }).click();

    await expect.poll(async () => (await currentModel(page, REFERENCE)).relationships.find((r) => r.id === 'policy->seats'))
      .toMatchObject({ description: 'asks for the seats a student holds from' });
  });
});

test.describe('C4 editor inspector: position, id, locks, and provides', () => {
  test('Move right pins the element by one step with a single click', async ({ page }) => {
    const inspector = await openInspector(page);
    const position = await openDisclosure(inspector, 'Position');
    await expect(position.getByText('Placed automatically.')).toBeVisible();
    const x = Number(await position.getByRole('spinbutton', { name: 'X' }).inputValue());
    const y = Number(await position.getByRole('spinbutton', { name: 'Y' }).inputValue());
    const step = Number(await position.getByRole('combobox', { name: 'Step' }).inputValue());

    await position.getByRole('button', { name: 'Move right' }).click();

    await expect.poll(async () => {
      const layout = (await currentModel(page, REFERENCE)).layout;
      const positions = [...layout.values()][0];
      return positions ? positions.get('seats') : null;
    }).toEqual([x + step, y]);
    await expect(position.getByText(`Pinned at ${x + step}, ${y} in this view.`)).toBeVisible();
    expect(await hostChanges(page), 'one click is one edit').toBe(1);
  });

  test('Return to automatic layout unpins the element', async ({ page }) => {
    const inspector = await openInspector(page);
    const position = await openDisclosure(inspector, 'Position');
    await position.getByRole('button', { name: 'Move down' }).click();
    await expect(position.getByText(/^Pinned at/)).toBeVisible();
    await position.getByRole('button', { name: 'Return to automatic layout' }).click();

    await expect(position.getByText('Placed automatically.')).toBeVisible();
    expect((await currentModel(page, REFERENCE)).layout.size).toBe(0);
  });

  test('Change id rejects 1abc with a suggestion', async ({ page }) => {
    const inspector = await openInspector(page);
    const more = await openDisclosure(inspector, 'More');
    await more.getByRole('button', { name: 'Change id…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Change the id of Seat Gateway' });
    const field = dialog.getByRole('textbox', { name: 'New id' });
    await field.fill('1abc');
    await field.press('Enter');

    await expect(dialog.getByText(/^Error: .*; try [a-z][a-z0-9-]*\.$/)).toBeVisible();
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(dialog).toBeVisible();
    expect(await hostChanges(page)).toBe(0);
  });

  test('locked fields are read-only with an explanation', async ({ page }) => {
    const seats = 'systems.registration.containers.api.components.seats';
    const inspector = await openInspector(page, { lockedFields: [`${seats}.name`, `${seats}.responsibilities`] });

    const name = section(inspector, 'Basics').getByRole('textbox', { name: 'Name' });
    await expect(name).not.toBeEditable();
    await expect(name).toHaveAccessibleDescription(/Locked: given by the task/);
    await expect(responsibilityRow(inspector, 1).getByRole('textbox', { name: 'Responsibility 1', exact: true })).not.toBeEditable();
    await expect(section(inspector, 'Responsibilities').getByRole('button', { name: 'Add responsibility' })).toHaveCount(0);
    await expect(section(inspector, 'Responsibilities').getByText(/^Locked: given by the task/).first()).toBeVisible();
    await expect(section(inspector, 'Basics').getByRole('textbox', { name: 'Technology' }), 'an unlocked field stays editable').toBeEditable();
    await expect(section(inspector, 'Basics').getByRole('button', { name: /^Delete / }), 'a locked element cannot be deleted').toHaveCount(0);
    await expect(section(inspector, 'Basics').getByText(/^Locked: Seat Gateway or a part of it is given by the task/)).toBeVisible();
    const more = await openDisclosure(inspector, 'More');
    await expect(more.getByRole('button', { name: 'Change id…' }), 'renaming the key would drop the lock on its parts').toHaveCount(0);
    await expect(more.getByText(/^Locked: Seat Gateway or a part of it is given by the task, so its id/)).toBeVisible();
  });

  test('a lock on the items of a text list freezes their order and removal', async ({ page }) => {
    const seats = 'systems.registration.containers.api.components.seats';
    const text = REFERENCE.replace('owns: [seat holds]', 'owns: [seat holds, seat counts]');
    const inspector = await openInspector(page, { text, lockedFields: [`${seats}.owns.*`] });
    const more = await openDisclosure(inspector, 'More');
    const owns = more.getByRole('list', { name: 'Owns' });
    await expect(owns.getByRole('textbox', { name: 'Owned fact 1', exact: true })).not.toBeEditable();
    await expect(owns.locator('[data-c4-drag-handle]'), 'no row can be dragged').toHaveCount(0);

    await expect(owns.getByRole('button', { name: /^Actions for owned fact/ }), 'no row offers Move or Remove').toHaveCount(0);
    await expect(more.getByText(/^Locked: given by the task/).first()).toBeVisible();
    // Spec §11: the appended item would land at owns.2, which the wildcard lock also covers.
    await expect(more.getByRole('textbox', { name: 'New owned fact' }), 'an appended item would be at a locked path').toHaveCount(0);
    await expect(more.getByText('Locked: the task gives the owned facts here, so no owned fact can be added.')).toBeVisible();
  });

  test('a lock on one named item of a text list still lets the learner append', async ({ page }) => {
    const seats = 'systems.registration.containers.api.components.seats';
    const inspector = await openInspector(page, { lockedFields: [`${seats}.owns.0`] });
    const more = await openDisclosure(inspector, 'More');
    await expect(more.getByRole('textbox', { name: 'New owned fact' })).toBeEditable();
  });

  test('a locked relationship cannot be moved from Relationships in this view', async ({ page }) => {
    const inspector = await openInspector(page, { lockedFields: ['systems.registration.containers.api.components.seats.collaborators'] });
    const outgoing = section(inspector, 'Relationships in this view').getByRole('list', { name: 'Outgoing' });
    const row = outgoing.getByRole('listitem').filter({ hasText: 'Registration Database' });
    await expect(row.getByRole('button', { name: /^Move to…/ })).toHaveCount(0);
    await expect(row.getByText(/^Locked: given by the task/)).toBeVisible();
    await expect(section(inspector, 'Basics').getByRole('button', { name: /^Delete / }), 'a lock on a part also prevents deleting the element').toHaveCount(0);
  });

  test('a container\'s interfaces are described in the Interfaces section, not under More', async ({ page }) => {
    const inspector = await openInspector(page, { text: WITH_INTERFACES, view: 'containers of registration', select: 'api' });
    await expect(section(inspector, 'Interfaces').getByRole('button', { name: 'Enrollment API', exact: true })).toBeVisible();
    const more = await openDisclosure(inspector, 'More');
    await expect(more.getByRole('textbox', { name: /provides|interface/i })).toHaveCount(0);
    await expect(more.getByText(/^Provides/)).toHaveCount(0);
    await more.locator('summary').click();
    expect(await hostChanges(page), 'opening and closing More leaves the interface descriptions untouched').toBe(0);
  });

  test('a code element\'s provides list is edited with the list editor under More', async ({ page }) => {
    const inspector = await openInspector(page, { select: 'EnrollmentRule' });
    const more = await openDisclosure(inspector, 'More');
    await more.getByRole('textbox', { name: 'New interface' }).fill('evaluate(student, section) -> RuleResult');
    await more.getByRole('button', { name: 'Add interface' }).click();

    await expect.poll(async () => (await currentModel(page, REFERENCE)).elements.get('EnrollmentRule').provides)
      .toEqual(['evaluate(student, section) -> RuleResult']);
  });
});

test.describe('C4 editor inspector: focus and host text', () => {
  test('host text arriving while the learner types keeps focus and the unsaved draft', async ({ page }) => {
    const inspector = await openInspector(page);
    const name = section(inspector, 'Basics').getByRole('textbox', { name: 'Name' });
    await name.fill('Seat Gate');

    await page.evaluate(() => {
      const { state } = window.harness;
      const seatsTechnology = /(seats:\n\s+name: Seat Gateway\n\s+technology: )Python module/;
      state.setText(state.getText().replace(seatsTechnology, '$1Python package'), { reason: 'external' });
    });

    await expect(section(inspector, 'Basics').getByRole('textbox', { name: 'Technology' }), 'the form shows the host\'s text').toHaveValue('Python package');
    await expect(name).toBeFocused();
    await expect(name).toHaveValue('Seat Gate');
    expect(await hostChanges(page), 'the draft is not written until the learner commits it').toBe(0);

    await page.keyboard.press('Tab');
    await expect.poll(async () => (await currentModel(page, REFERENCE)).elements.get('seats'), 'Tab commits the carried draft')
      .toMatchObject({ name: 'Seat Gate', technology: 'Python package' });
    await expect(name).toHaveValue('Seat Gate');
    expect(await hostChanges(page), 'the draft is written once').toBe(1);
  });

  test('a focus request in the selection focuses that field (Problems › Show)', async ({ page }) => {
    const inspector = await openInspector(page, { select: null });
    await page.evaluate(() => window.harness.state.select({
      elementId: 'seats', focus: { path: ['systems', 'registration', 'containers', 'api', 'components', 'seats', 'technology'], request: 1 },
    }));
    await expect(section(inspector, 'Basics').getByRole('textbox', { name: 'Technology' })).toBeFocused();
  });

  test('Decisions affecting it lists the decisions that name the element', async ({ page }) => {
    const inspector = await openInspector(page);
    await expect(section(inspector, 'Decisions affecting it').getByRole('listitem'))
      .toHaveText([/Keep plans and seat holds in one relational database \(accepted\)/]);
  });

  test('with nothing selected the inspector says how to choose something', async ({ page }) => {
    const inspector = await openInspector(page, { select: null });
    await expect(inspector.getByText('Select an element, a relationship, a scenario, or a deployment node on the canvas or in the outline to edit it here.')).toBeVisible();
  });
});

test.describe('C4 editor inspector styles', () => {
  for (const theme of ['light', 'dark']) {
    test(`fields and headings are at least paragraph-size in ${theme} mode`, async ({ page }) => {
      const inspector = await openInspector(page);
      if (theme === 'dark') await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
      await openDisclosure(inspector, 'Position');
      const sizes = await page.evaluate(() => {
        const paragraph = parseFloat(getComputedStyle(document.querySelector('main p')).fontSize);
        const sample = ['#inspector input', '#inspector select', '#inspector summary', '#inspector h3', '#inspector .c4-editor__field-hint']
          .map((selector) => parseFloat(getComputedStyle(document.querySelector(selector)).fontSize));
        return { paragraph, sample };
      });
      sizes.sample.slice(0, 4).forEach((size) => expect(size).toBeGreaterThanOrEqual(sizes.paragraph));
      expect(sizes.sample[4], 'hints are at least 0.9em').toBeGreaterThanOrEqual(sizes.paragraph * 0.9 - 0.01);
      await a11yCheckpoint(page, `c4-editor-inspector-${theme}`, FEATURE);
    });
  }

  test('the inspector is hidden in print', async ({ page }) => {
    const inspector = await openInspector(page);
    await page.emulateMedia({ media: 'print' });
    await expect(inspector.getByRole('heading', { name: 'Seat Gateway' })).toBeHidden();
  });
});

test.describe('isLockedPath (spec §11)', () => {
  test('a lock covers the named node and its descendants, segment by segment', () => {
    const locks = ['systems.registration.responsibilities'];
    expect(isLockedPath(['systems', 'registration', 'responsibilities'], locks)).toBe(true);
    expect(isLockedPath(['systems', 'registration', 'responsibilities', 0, 'decide'], locks)).toBe(true);
    expect(isLockedPath(['systems', 'registration'], locks), 'an ancestor of a lock is not locked').toBe(false);
    expect(isLockedPath(['systems', 'registration', 'responsibilitiesX'], locks), 'segments compare whole').toBe(false);
    expect(isLockedPath('systems.registration.responsibilities.1', locks), 'a dotted path works as well').toBe(true);
  });

  test('a * segment matches exactly one key or list index, with no implicit exemption', () => {
    const locks = ['systems.registration.containers.api.provides.enrollment-api.operations.*.syntax'];
    const operation = ['systems', 'registration', 'containers', 'api', 'provides', 'enrollment-api', 'operations', 'submit-plan'];
    expect(isLockedPath(operation.concat('syntax'), locks)).toBe(true);
    expect(isLockedPath(operation.concat('purpose'), locks)).toBe(false);
    expect(isLockedPath(operation, locks), '* does not lock the operation itself').toBe(false);
    expect(isLockedPath(['requirements', 'FR-07'], ['requirements.*'])).toBe(true);
    expect(isLockedPath(['requirements'], ['requirements.*'])).toBe(false);
    expect(isLockedPath(['requirements'], [])).toBe(false);
  });
});
