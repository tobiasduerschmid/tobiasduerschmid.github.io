// @ts-check
// The C4 editor's shared commands (spec §9.2): element commands (Delete with confirmation, rename, Move to…,
// Change id…), the relationship Move to…, the anchored relationship form with its read-aloud preview, and the
// context menus that offer them. The canvas, outline, and inspector call these commands, so the page here holds
// only an editor state and the actions module; a "More actions" button stands in for the option or "⋯" button
// that opens a menu. Every edit is checked through the text the host receives (spec §3.4 `onTextChange`), read
// back with the C4 core.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { a11yCheckpoint } = require('./a11y-helpers');

const ARCHUML = path.resolve(__dirname, '../js/ArchUML');
const C4 = require(path.join(ARCHUML, 'c4/c4-core.js'));
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ARCHUML, 'c4/manifest.json'), 'utf8'));
const SCRIPTS = MANIFEST.core.concat([
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
]);
const STYLESHEET = path.join(ARCHUML, 'css/c4-editor.css');
const REFERENCE = fs.readFileSync(path.join(ARCHUML, 'tests/c4/fixtures/course-registration.yml'), 'utf8');
const FEATURE = { feature: 'c4-editor' };

/**
 * The reference model with Seat Gateway's relationship to the database declared on the Registration API instead
 * (spec §9.2's move-down example): api → db is then a container relationship that no component inside api sends.
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
 * Opens a page with one editor root, its state (on `text`, in `profile`), and the actions module. The host records
 * every text change and view change; with `hostConfirm`, `host.confirm` records each request and answers
 * `window.confirmAnswer`. The state's clock advances one second per reading, so no two edits ever merge into one
 * undo step by timing: one undo step means one edit.
 */
async function openEditor(page, { text = REFERENCE, profile = 'expert', hostConfirm = true } = {}) {
  await page.setContent([
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>C4 editor actions</title></head>',
    '<body><main><h1>C4 editor actions</h1><p>Paragraph text sets the reading size.</p>',
    '<div id="editor" class="c4-editor"><button type="button" id="trigger">More actions</button>',
    '<button type="button">Next control</button></div>',
    '</main></body></html>',
  ].join(''));
  // The site's root rule makes 1rem = 10 px; widgets must not shrink text with rem. The base editor stylesheet
  // (another module) hides the live region visually; this stand-in does the same so visible text is unambiguous.
  await page.addStyleTag({ content: [
    'html { font-size: 62.5%; } body { font-size: 1.8rem; }',
    '.c4-editor__sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }',
  ].join('\n') });
  await page.addStyleTag({ path: STYLESHEET });
  for (const script of SCRIPTS) await page.addScriptTag({ path: path.join(ARCHUML, script) });
  await page.evaluate(({ initialText, profileName, withHostConfirm }) => {
    const root = document.getElementById('editor');
    const parts = window.ArchUMLC4EditorParts;
    const texts = [];
    const views = [];
    const confirms = [];
    const handedOver = [];
    let clock = 0;
    const host = {
      onTextChange: (text, info) => texts.push({ text, edits: info.edits.length }),
      onViewChange: (selector) => views.push(selector),
    };
    if (withHostConfirm) {
      window.confirmAnswer = true;
      host.confirm = (request) => {
        confirms.push({ title: request.title, message: request.message, details: request.details,
          confirmLabel: request.confirmLabel, trigger: request.trigger ? request.trigger.id : null });
        return Promise.resolve(window.confirmAnswer);
      };
    }
    const state = parts.state.createEditorState({ text: initialText, host, profile: profileName, now: () => (clock += 1000) });
    const ids = parts.dom.idFactory('ed1');
    const announce = parts.dom.createAnnouncer(root);
    const actions = parts.actions.createActions(root, { state, dom: parts.dom, host, ids, announce });
    const trigger = document.getElementById('trigger');
    const handlers = {
      onMove: (id) => handedOver.push(['move', id]),
      onAddRelationship: (id) => handedOver.push(['add relationship', id]),
    };
    window.harness = { state, actions, texts, views, confirms, handedOver, trigger, handlers };
  }, { initialText: text, profileName: profile, withHostConfirm: hostConfirm });
}

/** Opens the context menu of an element from the stand-in trigger, as the canvas does for its focused option. */
async function openElementMenu(page, elementId) {
  await page.locator('#trigger').focus();
  await page.evaluate((id) => {
    const { actions, trigger, handlers } = window.harness;
    actions.openElementMenu(id, { anchor: trigger, returnFocus: trigger, ...handlers });
  }, elementId);
  return page.getByRole('menu');
}

async function openRelationshipMenu(page, relationshipId) {
  await page.locator('#trigger').focus();
  await page.evaluate((id) => {
    const { actions, trigger } = window.harness;
    actions.openRelationshipMenu(id, { anchor: trigger, returnFocus: trigger });
  }, relationshipId);
  return page.getByRole('menu');
}

/**
 * Chooses a menu item with Enter. Unavailable items are `aria-disabled`, which pointer clicks in Playwright skip;
 * keyboard users still reach them (the first test covers the arrow keys) and hear why they are unavailable.
 */
async function chooseWithKeyboard(page, item) {
  await item.focus();
  await page.keyboard.press('Enter');
}

/** The texts the host received, in order. */
function hostTexts(page) {
  return page.evaluate(() => window.harness.texts.map((change) => change.text));
}

/** The text the editor holds now, as the host last heard it (or the initial text). */
async function currentText(page, initial = REFERENCE) {
  const texts = await hostTexts(page);
  return texts.length > 0 ? texts[texts.length - 1] : initial;
}

/** The model the core reads from the editor's current text. */
async function currentModel(page, initial = REFERENCE) {
  const design = C4.load(await currentText(page, initial));
  expect(design.model, 'the edited text is still readable YAML').not.toBeNull();
  return design.model;
}

function relationshipFacts(model, id) {
  const relationship = model.relationships.find((candidate) => candidate.id === id);
  return relationship ? { description: relationship.description, technology: relationship.technology } : null;
}

/** Asserts that the action reached the host as one change, and that one undo reverts it. */
async function expectOneUndoStep(page, before) {
  expect(await hostTexts(page), 'one change reached the host').toHaveLength(1);
  await page.evaluate(() => window.harness.state.undo());
  expect(await currentText(page, before)).toBe(before);
  expect(await page.evaluate(() => window.harness.state.canUndo()), 'nothing is left to undo').toBe(false);
}

const status = (page) => page.getByRole('status');
/** Text a sighted user sees; the live region repeats some messages for screen readers, visually hidden. */
const visibleText = (page, text) => page.getByText(text).filter({ visible: true });

test.describe('C4 editor element commands', () => {
  test('the element menu lists its commands, moves focus with the arrow keys and letters, and Escape returns focus to its opener', async ({ page }) => {
    await openEditor(page);
    const menu = await openElementMenu(page, 'api');

    await expect(menu).toHaveAccessibleName('Actions for Registration API');
    await expect(menu.getByRole('menuitem')).toHaveText(['Move…', 'Add relationship', 'Move to…', 'Zoom in', 'Change id…', 'Delete']);
    await expect(menu.getByRole('menuitem', { name: 'Move…' })).toBeFocused();
    await a11yCheckpoint(page, 'c4 editor element menu', FEATURE);

    await page.keyboard.press('ArrowDown');
    await expect(menu.getByRole('menuitem', { name: 'Add relationship' })).toBeFocused();
    await page.keyboard.press('End');
    await expect(menu.getByRole('menuitem', { name: 'Delete' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menu.getByRole('menuitem', { name: 'Move…' })).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(menu.getByRole('menuitem', { name: 'Delete' })).toBeFocused();
    await page.keyboard.press('Home');
    await expect(menu.getByRole('menuitem', { name: 'Move…' })).toBeFocused();
    await page.keyboard.press('z');
    await expect(menu.getByRole('menuitem', { name: 'Zoom in' })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(page.locator('#trigger')).toBeFocused();
    expect(await hostTexts(page), 'opening and closing a menu changes nothing').toEqual([]);
  });

  test('a menu closes when Tab leaves it, which moves on from its opener, or when the pointer goes down outside it', async ({ page }) => {
    await openEditor(page);
    let menu = await openElementMenu(page, 'seats');
    await page.keyboard.press('Tab');
    await expect(menu).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Next control' })).toBeFocused();

    menu = await openElementMenu(page, 'seats');
    await page.getByRole('heading', { name: 'C4 editor actions' }).click();
    await expect(menu).toHaveCount(0);
    expect(await hostTexts(page)).toEqual([]);
  });

  test('a menu opens below its opener and stays inside the viewport near the edge', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await openEditor(page);
    const menu = await openElementMenu(page, 'seats');
    const opener = await page.locator('#trigger').boundingBox();
    const below = await menu.boundingBox();
    expect(below.y).toBeGreaterThanOrEqual(opener.y + opener.height);
    expect(below.x, 'the menu starts under its opener').toBeGreaterThanOrEqual(opener.x);
    expect(below.x).toBeLessThan(opener.x + opener.width);

    // A context menu opened at a point in the bottom-right corner (a right-click or long press there).
    await page.evaluate(() => window.harness.actions.openElementMenu('seats', { point: { x: 350, y: 630 } }));
    const cornered = await page.getByRole('menu').boundingBox();
    expect(cornered.x + cornered.width).toBeLessThanOrEqual(360);
    expect(cornered.y + cornered.height).toBeLessThanOrEqual(640);
    expect(Math.min(cornered.x, cornered.y)).toBeGreaterThanOrEqual(0);
  });

  test('Move… and Add relationship hand the element to the canvas, and a person has no Move to… or Zoom in', async ({ page }) => {
    await openEditor(page);
    let menu = await openElementMenu(page, 'seats');
    await menu.getByRole('menuitem', { name: 'Move…' }).click();
    await expect(menu).toHaveCount(0);
    menu = await openElementMenu(page, 'seats');
    await menu.getByRole('menuitem', { name: 'Add relationship' }).click();
    expect(await page.evaluate(() => window.harness.handedOver)).toEqual([['move', 'seats'], ['add relationship', 'seats']]);

    menu = await openElementMenu(page, 'student');
    await expect(menu.getByRole('menuitem')).toHaveText(['Move…', 'Add relationship', 'Change id…', 'Delete']);
  });

  test('Zoom in opens the view inside the element', async ({ page }) => {
    await openEditor(page);
    const menu = await openElementMenu(page, 'api');
    await menu.getByRole('menuitem', { name: 'Zoom in' }).click();

    expect(await page.evaluate(() => window.harness.views)).toEqual(['components of api']);
    expect(await hostTexts(page)).toEqual([]);
  });

  test('Delete asks for confirmation naming dependent references and removes them', async ({ page }) => {
    await openEditor(page);
    const menu = await openElementMenu(page, 'seats');
    await menu.getByRole('menuitem', { name: 'Delete' }).click();

    await expect(status(page)).toHaveText('Deleted Seat Gateway and 3 references to it.');
    const [request] = await page.evaluate(() => window.harness.confirms);
    expect(request.title).toBe('Delete Seat Gateway?');
    expect(request.confirmLabel).toBe('Delete');
    expect(request.trigger, 'focus can return to the control that opened the menu').toBe('trigger');
    // One entry per reference the core removes with it: Registration Coordinator's collaborator, the enroll
    // scenario's step, and the one-database decision.
    expect(request.details).toHaveLength(3);
    expect(request.details[0]).toContain('Registration Coordinator');
    expect(request.details[1]).toContain('enroll');
    expect(request.details[2]).toContain('one-database');
    for (const detail of request.details) expect(request.message, 'the message alone lists every reference').toContain(detail);

    const model = await currentModel(page);
    expect(model.elements.has('seats')).toBe(false);
    expect(model.relationships.filter((relationship) => relationship.targetId === 'seats')).toEqual([]);
    expect(model.decisions.get('one-database').affects).toEqual(['db']);
    await expectOneUndoStep(page, REFERENCE);
  });

  test('cancelling the delete confirmation leaves the text unchanged', async ({ page }) => {
    await openEditor(page);
    await page.evaluate(() => { window.confirmAnswer = false; });
    const menu = await openElementMenu(page, 'seats');
    await menu.getByRole('menuitem', { name: 'Delete' }).click();

    await expect(status(page)).toHaveText('Kept Seat Gateway.');
    expect(await hostTexts(page)).toEqual([]);
  });

  test('without a host confirm, the editor\'s own dialog lists the references and deletes only after Delete', async ({ page }) => {
    await openEditor(page, { hostConfirm: false });
    const menu = await openElementMenu(page, 'policy');
    await menu.getByRole('menuitem', { name: 'Delete' }).click();

    const dialog = page.getByRole('dialog', { name: 'Delete Enrollment Policy?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('listitem')).toHaveCount(2);
    await expect(dialog.getByRole('button', { name: 'Cancel' }), 'a destructive confirmation starts on Cancel').toBeFocused();
    await a11yCheckpoint(page, 'c4 editor delete confirmation', FEATURE);
    expect(await hostTexts(page), 'nothing is deleted before the confirmation').toEqual([]);

    await dialog.getByRole('button', { name: 'Delete' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('#trigger')).toBeFocused();
    await expect(status(page)).toHaveText('Deleted Enrollment Policy and 2 references to it.');
    const model = await currentModel(page);
    expect(model.elements.has('policy')).toBe(false);
    expect(model.elements.has('EnrollmentPolicy'), 'the code inside it goes too').toBe(false);
  });

  test('renaming writes the new name and refuses an empty one', async ({ page }) => {
    await openEditor(page);
    const renamed = await page.evaluate(() => window.harness.actions.renameElement('seats', 'Seat Service'));
    expect(renamed.ok).toBe(true);
    await expect(status(page)).toHaveText('Renamed Seat Gateway to Seat Service.');
    expect((await currentModel(page)).elements.get('seats').name).toBe('Seat Service');

    const textBefore = await currentText(page);
    const refused = await page.evaluate(() => window.harness.actions.renameElement('seats', '   '));
    expect(refused.ok).toBe(false);
    expect(refused.message).toMatch(/^Error: /);
    await expect(status(page)).toHaveText(refused.message);
    expect(await currentText(page)).toBe(textBefore);
  });

  test('a placeholder that a relationship already names keeps its id when it is first named', async ({ page }) => {
    const placeholder = REFERENCE.replace('      db:\n', '      new-container:\n        name: New container\n      db:\n')
      .replace('db: {description: writes seat holds to', 'new-container: reads cached seat counts from\n              db: {description: writes seat holds to');
    expect(C4.load(placeholder).model.elements.get('new-container').name, 'precondition: the fixture has a placeholder').toBe('New container');
    await openEditor(page, { text: placeholder });

    const renamed = await page.evaluate(() => window.harness.actions.renameElement('new-container', 'Seat Cache'));

    expect(renamed.ok).toBe(true);
    await expect(status(page)).toHaveText('Renamed New container to Seat Cache.');
    expect((await currentModel(page)).elements.get('new-container').name, 'a reference to the id keeps it').toBe('Seat Cache');
  });

  test('Move to… lists the other containers and moves the component into the chosen one in one undo step', async ({ page }) => {
    await openEditor(page);
    let menu = await openElementMenu(page, 'seats');
    await menu.getByRole('menuitem', { name: 'Move to…' }).click();

    menu = page.getByRole('menu', { name: 'Move Seat Gateway into' });
    await expect(menu.getByRole('group', { name: 'Course Registration' }).getByRole('menuitem'))
      .toHaveText(['Planner Web App', 'Registration Database']);
    await expect(menu.getByRole('menuitem', { name: 'Planner Web App' })).toBeFocused();
    await menu.getByRole('menuitem', { name: 'Planner Web App' }).click();

    await expect(status(page)).toHaveText('Moved Seat Gateway into Planner Web App.');
    expect((await currentModel(page)).elements.get('seats').parentId).toBe('web');
    await expectOneUndoStep(page, REFERENCE);
  });

  test('Change id… names the problem, suggests a fix, and changes the id once it is valid', async ({ page }) => {
    await openEditor(page);
    const menu = await openElementMenu(page, 'seats');
    await menu.getByRole('menuitem', { name: 'Change id…' }).click();

    const dialog = page.getByRole('dialog', { name: 'Change the id of Seat Gateway' });
    const field = dialog.getByRole('textbox', { name: 'New id' });
    await expect(field).toBeFocused();
    await expect(page.getByRole('menu'), 'the menu closes before the dialog opens').toHaveCount(0);
    await expect(field).toHaveValue('seats');

    await field.fill('Seat Gateway');
    await field.press('Enter');
    await expect(dialog, 'an invalid id keeps the dialog open').toBeVisible();
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(field).toHaveAccessibleDescription(/Error: .*try seat-gateway/);
    await a11yCheckpoint(page, 'c4 editor change id with an error', FEATURE);
    expect(await hostTexts(page)).toEqual([]);

    await field.fill('seat-gateway');
    await field.press('Enter');
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('#trigger'), 'focus returns to the opener although the menu item is gone').toBeFocused();
    await expect(status(page)).toHaveText('Changed the id of Seat Gateway from seats to seat-gateway.');
    const model = await currentModel(page);
    expect(model.elements.has('seat-gateway')).toBe(true);
    expect(model.elements.has('seats')).toBe(false);
    expect(model.relationships.map((relationship) => relationship.id), 'references follow the new id')
      .toContain('coordinator->seat-gateway');
    await expectOneUndoStep(page, REFERENCE);
  });

  test('Change id… refuses an id another element uses, suggesting a free one', async ({ page }) => {
    await openEditor(page);
    const result = await page.evaluate(() => window.harness.actions.changeElementId('seats', 'db'));
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/^Error: .*"db".*try db-2/);
    expect(await hostTexts(page)).toEqual([]);
  });

  test('while the YAML cannot be read, editing commands are unavailable and say why', async ({ page }) => {
    await openEditor(page);
    await page.evaluate(() => window.harness.state.setText('systems: [unclosed', { reason: 'external' }));
    const menu = await openElementMenu(page, 'seats');

    await expect(menu.getByRole('menuitem', { name: 'Delete' })).toHaveAttribute('aria-disabled', 'true');
    await expect(visibleText(page, /^Error: The YAML has errors/)).toBeInViewport();
    await chooseWithKeyboard(page, menu.getByRole('menuitem', { name: 'Delete' }));
    await expect(menu, 'an unavailable command keeps the menu open').toBeVisible();
    expect(await page.evaluate(() => window.harness.confirms)).toEqual([]);
  });
});

test.describe('C4 editor relationship commands', () => {
  test('the relationship form reads the sentence aloud, requires a description, and Enter adds the relationship in one undo step', async ({ page }) => {
    await openEditor(page);
    await page.locator('#trigger').focus();
    await page.evaluate(() => {
      const { actions, trigger } = window.harness;
      window.pending = actions.openRelationshipForm({ sourceId: 'policy', targetId: 'db' }, { anchor: trigger, returnFocus: trigger });
    });

    const dialog = page.getByRole('dialog', { name: 'Add relationship' });
    const description = dialog.getByRole('textbox', { name: 'Description' });
    await expect(description).toBeFocused();
    await expect(dialog.getByText('Reads as:')).toBeVisible();
    await expect(description).toHaveAccessibleDescription(/Enrollment Policy … Registration Database/);

    await description.press('Enter');
    await expect(dialog, 'a relationship needs a description').toBeVisible();
    await expect(description).toHaveAttribute('aria-invalid', 'true');
    await expect(description).toHaveAccessibleDescription(/Error: Describe what Enrollment Policy asks Registration Database for/);
    await a11yCheckpoint(page, 'c4 editor relationship form with an error', FEATURE);

    await description.fill('reads eligibility rules from');
    await dialog.getByRole('textbox', { name: 'Technology' }).fill('SQL/TCP');
    await expect(description).toHaveAccessibleDescription(/Enrollment Policy reads eligibility rules from Registration Database \[SQL\/TCP\]/);
    await expect(description).not.toHaveAttribute('aria-invalid', 'true');
    await description.press('Enter');

    await expect(dialog).toHaveCount(0);
    await expect(page.locator('#trigger')).toBeFocused();
    await expect(status(page)).toHaveText('Added: Enrollment Policy reads eligibility rules from Registration Database [SQL/TCP].');
    expect(await page.evaluate(() => window.pending)).toMatchObject({ ok: true, relationshipId: 'policy->db' });
    expect(relationshipFacts(await currentModel(page), 'policy->db'))
      .toEqual({ description: 'reads eligibility rules from', technology: 'SQL/TCP' });
    await expectOneUndoStep(page, REFERENCE);
  });

  test('Escape in the relationship form adds nothing and returns focus', async ({ page }) => {
    await openEditor(page);
    await page.locator('#trigger').focus();
    await page.evaluate(() => {
      const { actions, trigger } = window.harness;
      window.pending = actions.openRelationshipForm({ sourceId: 'policy', targetId: 'db' }, { anchor: trigger, returnFocus: trigger });
    });
    const dialog = page.getByRole('dialog', { name: 'Add relationship' });
    await dialog.getByRole('textbox', { name: 'Description' }).fill('reads eligibility rules from');
    await page.keyboard.press('Escape');

    await expect(dialog).toHaveCount(0);
    await expect(page.locator('#trigger')).toBeFocused();
    expect(await page.evaluate(() => window.pending)).toMatchObject({ ok: false, cancelled: true });
    expect(await hostTexts(page)).toEqual([]);
  });

  test('the relationship form edits an existing relationship with its connector and shows its problems', async ({ page }) => {
    const vague = REFERENCE.replace('coordinator: {description: submits plans to, technology: JSON/HTTPS}', 'coordinator: uses');
    await openEditor(page, { text: vague });
    await page.evaluate(() => {
      window.pending = window.harness.actions.openRelationshipForm({ relationshipId: 'web->coordinator' }, {});
    });

    const dialog = page.getByRole('dialog', { name: 'Edit relationship' });
    const technology = dialog.getByRole('textbox', { name: 'Technology' });
    await expect(dialog.getByRole('textbox', { name: 'Description' })).toHaveValue('uses');
    await expect(technology, 'a missing technology across containers is a warning, not an error')
      .toHaveAccessibleDescription(/Warning: /);
    await expect(technology).not.toHaveAttribute('aria-invalid', 'true');

    await dialog.getByRole('textbox', { name: 'Description' }).fill('submits plans to');
    await technology.fill('JSON/HTTPS');
    await dialog.getByRole('combobox', { name: 'Connector' }).selectOption({ label: 'Message (sent through a queue to one receiver)' });
    await dialog.getByRole('button', { name: 'Save' }).click();

    await expect(dialog).toHaveCount(0);
    await expect(status(page)).toHaveText('Updated \'submits plans to\' from Planner Web App to Registration Coordinator.');
    const relationship = (await currentModel(page, vague)).relationships.find((candidate) => candidate.id === 'web->coordinator');
    expect([relationship.description, relationship.technology, relationship.connector]).toEqual(['submits plans to', 'JSON/HTTPS', 'message']);
    await expectOneUndoStep(page, vague);
  });

  test('Move to… on the relationship api → db, then New source › Seat Gateway, rewrites it as seats → db with its description and technology, in one undo step', async ({ page }) => {
    await openEditor(page, { text: API_DECLARES_DB });
    let menu = await openRelationshipMenu(page, 'api->db');
    await expect(menu.getByRole('menuitem')).toHaveText(['Move to…', 'Delete']);
    await menu.getByRole('menuitem', { name: 'Move to…' }).click();

    menu = page.getByRole('menu', { name: 'Move \'writes seat holds to\' to a new source or target' });
    const newSource = menu.getByRole('group', { name: 'New source' }).getByRole('menuitem');
    // The moved end's own children come first: the usual move is one level down.
    await expect(newSource.first()).toHaveText('Registration Coordinator');
    await expect(newSource.nth(3)).toHaveText('Billing Gateway');
    await expect(newSource.first()).toBeFocused();
    await a11yCheckpoint(page, 'c4 editor relationship move menu', FEATURE);
    await menu.getByRole('group', { name: 'New source' }).getByRole('menuitem', { name: 'Seat Gateway' }).click();

    await expect(status(page)).toHaveText('Moved \'writes seat holds to\': now from Seat Gateway to Registration Database.');
    const model = await currentModel(page, API_DECLARES_DB);
    expect(relationshipFacts(model, 'seats->db')).toEqual({ description: 'writes seat holds to', technology: 'SQL/TCP' });
    expect(relationshipFacts(model, 'api->db')).toBeNull();
    expect(await page.evaluate(() => window.harness.state.getSelection()), 'the moved relationship is selected for the inspector')
      .toEqual({ relationshipId: 'seats->db' });
    expect(await page.evaluate(() => window.harness.texts.map((change) => change.edits)), 'one text splice').toEqual([1]);
    await expectOneUndoStep(page, API_DECLARES_DB);
  });

  test('Move to… tells same-named targets apart by their type and the element they lie in', async ({ page }) => {
    // Mid-repair in the tutorial a container can share its name with a software system.
    const added = C4.edit(C4.load(REFERENCE), { op: 'addElement', parentId: 'registration', type: 'container', name: 'Billing System' });
    await openEditor(page, { text: added.text });
    let menu = await openRelationshipMenu(page, 'student->web');
    await menu.getByRole('menuitem', { name: 'Move to…' }).click();
    menu = page.getByRole('menu', { name: /^Move 'plans a schedule and enrolls using'/ });

    const namesakes = menu.getByRole('group', { name: 'New target' }).getByRole('menuitem', { name: /^Billing System/ });
    await expect(namesakes).toHaveText(['Billing System (container in Course Registration)', 'Billing System (software system)'],
      { useInnerText: true });
    await expect(menu.getByRole('group', { name: 'New target' }).getByRole('menuitem', { name: 'Registration API', exact: true }),
      'a name no other target has is listed alone').toHaveCount(1);
  });

  test('moving a relationship keeps its connector and design choices', async ({ page }) => {
    await openEditor(page);
    const result = await page.evaluate(() => window.harness.actions.moveRelationship('billing-gateway->billing', { sourceId: 'coordinator' }));
    expect(result).toMatchObject({ ok: true, relationshipId: 'coordinator->billing' });

    const moved = (await currentModel(page)).relationships.find((candidate) => candidate.id === 'coordinator->billing');
    expect([moved.description, moved.technology, moved.connector]).toEqual(['requests tuition charges from', 'AMQP', 'message']);
    expect(moved.choices.technology).toMatchObject({ chosen: 'RabbitMQ', alternatives: ['synchronous HTTPS call'],
      because: 'a billing outage must not block enrollment' });
  });

  test('Move to… refuses a target that would duplicate a declared relationship, with a visible reason', async ({ page }) => {
    await openEditor(page);
    let menu = await openRelationshipMenu(page, 'coordinator->policy');
    await menu.getByRole('menuitem', { name: 'Move to…' }).click();
    menu = page.getByRole('menu', { name: /^Move 'asks for an eligibility decision from'/ });
    const duplicate = menu.getByRole('group', { name: 'New target' }).getByRole('menuitem', { name: /^Seat Gateway/ });

    await expect(duplicate).toHaveAttribute('aria-disabled', 'true');
    await chooseWithKeyboard(page, duplicate);
    await expect(menu, 'a refused target keeps the menu open').toBeVisible();
    await expect(duplicate, 'the reason does not push the focused item out of view').toBeInViewport();
    await expect(visibleText(page, /^Error: Registration Coordinator already has a relationship to Seat Gateway: 'reserves all seats or none through'/))
      .toBeInViewport();
    expect(await hostTexts(page)).toEqual([]);
  });

  test('a relationship without a description cannot be moved until it is described', async ({ page }) => {
    const undescribed = REFERENCE.replace('policy: asks for an eligibility decision from', 'policy:');
    await openEditor(page, { text: undescribed });
    const menu = await openRelationshipMenu(page, 'coordinator->policy');
    const moveTo = menu.getByRole('menuitem', { name: 'Move to…' });

    await expect(moveTo).toHaveAttribute('aria-disabled', 'true');
    await chooseWithKeyboard(page, moveTo);
    await expect(visibleText(page, /^Error: Describe what Registration Coordinator asks Enrollment Policy for/)).toBeInViewport();
    expect(await hostTexts(page)).toEqual([]);
  });

  test('Delete on the relationship menu removes only that relationship', async ({ page }) => {
    await openEditor(page);
    const menu = await openRelationshipMenu(page, 'seats->db');
    await menu.getByRole('menuitem', { name: 'Delete' }).click();

    await expect(status(page)).toHaveText('Deleted \'writes seat holds to\' from Seat Gateway to Registration Database.');
    const model = await currentModel(page);
    expect(relationshipFacts(model, 'seats->db')).toBeNull();
    expect(model.elements.has('seats') && model.elements.has('db')).toBe(true);
    await expectOneUndoStep(page, REFERENCE);
  });

  test('in the novice profile the xlevel/unsent quick fix opens Move to… with the decomposed element\'s children', async ({ page }) => {
    await openEditor(page, { text: API_DECLARES_DB, profile: 'novice' });
    await page.locator('#trigger').focus();
    const fix = await page.evaluate(() => {
      const { state, actions, trigger } = window.harness;
      const diagnostic = state.getDiagnostics().find((candidate) => candidate.rule === 'xlevel/unsent');
      const quickFix = diagnostic ? actions.quickFixFor(diagnostic) : null;
      if (quickFix) quickFix.apply({ anchor: trigger, returnFocus: trigger });
      return { found: Boolean(diagnostic), label: quickFix ? quickFix.label : null };
    });
    expect(fix).toEqual({ found: true, label: 'Choose which part sends it' });

    const newSource = page.getByRole('menu').getByRole('group', { name: 'New source' }).getByRole('menuitem');
    await expect(newSource.first()).toBeFocused();
    await expect(newSource.first()).toHaveText('Registration Coordinator');
    await expect(newSource.nth(1)).toHaveText('Enrollment Policy');
    await expect(newSource.nth(2)).toHaveText('Seat Gateway');
    await expect(newSource.nth(3)).toHaveText('Billing Gateway');
  });
});

test.describe('C4 editor quick fixes', () => {
  test('in the novice profile the xlevel/unreceived quick fix starts Move to… in the New target group', async ({ page }) => {
    const webSendsToApi = REFERENCE.replace('coordinator: {description: submits plans to, technology: JSON/HTTPS}',
      'api: {description: submits plans to, technology: JSON/HTTPS}');
    await openEditor(page, { text: webSendsToApi, profile: 'novice' });
    const label = await page.evaluate(() => {
      const { state, actions, trigger } = window.harness;
      const diagnostic = state.getDiagnostics().find((candidate) => candidate.rule === 'xlevel/unreceived');
      const quickFix = diagnostic ? actions.quickFixFor(diagnostic) : null;
      if (quickFix) quickFix.apply({ anchor: trigger, returnFocus: trigger });
      return quickFix ? quickFix.label : null;
    });
    expect(label).toBe('Choose which part receives it');

    const newTarget = page.getByRole('menu').getByRole('group', { name: 'New target' }).getByRole('menuitem');
    await expect(newTarget.first()).toBeFocused();
    await expect(newTarget.first()).toHaveText('Registration Coordinator');
  });

  test('a diagnostic without an editor quick fix has none', async ({ page }) => {
    await openEditor(page);
    const fix = await page.evaluate(() => window.harness.actions.quickFixFor({ rule: 'c4/vague-relationship',
      path: ['people', 'student', 'collaborators', 'web'] }));
    expect(fix).toBeNull();
  });
});

test.describe('C4 editor action styles', () => {
  /** The menu item's text size, height, and contrast ratio against the colour painted behind it. */
  function measureItem(item) {
    const channels = (color) => color.match(/[\d.]+/g).map(Number);
    const luminance = (color) => {
      const [r, g, b] = channels(color).slice(0, 3).map((value) => {
        const unit = value / 255;
        return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const painted = (element) => {
      for (let node = element; node; node = node.parentElement) {
        const background = getComputedStyle(node).backgroundColor;
        if (channels(background)[3] !== 0) return background;
      }
      return 'rgb(255, 255, 255)';
    };
    const [lighter, darker] = [luminance(getComputedStyle(item).color), luminance(painted(item))].sort((a, b) => b - a);
    return {
      fontSize: parseFloat(getComputedStyle(item).fontSize),
      paragraphSize: parseFloat(getComputedStyle(document.querySelector('main p')).fontSize),
      height: item.getBoundingClientRect().height,
      contrast: (lighter + 0.05) / (darker + 0.05),
    };
  }

  for (const theme of ['light', 'dark']) {
    test(`menu items are paragraph-size, at least 24 pixels tall, and readable in ${theme} mode`, async ({ page }) => {
      await openEditor(page);
      if (theme === 'dark') await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
      const menu = await openElementMenu(page, 'seats');
      const item = menu.getByRole('menuitem', { name: 'Delete' });
      await item.hover();

      const measured = await item.evaluate(measureItem);
      expect(measured.fontSize).toBeGreaterThanOrEqual(measured.paragraphSize);
      expect(measured.height).toBeGreaterThanOrEqual(24);
      expect(measured.contrast).toBeGreaterThanOrEqual(4.5);
    });
  }

  test('menus are hidden in print', async ({ page }) => {
    await openEditor(page);
    const menu = await openElementMenu(page, 'seats');
    await page.emulateMedia({ media: 'print' });
    await expect(menu).toBeHidden();
  });
});
