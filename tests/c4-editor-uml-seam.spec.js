// @ts-check
// The C4 editor's canvas draws a UML-notation view through the renderer's delegated-view seam (UML-view editing spec
// §7.1): from the view model, with the view's layout entry, without rewriting the document to tell the renderer which
// view to draw. And a design may keep a layout entry for a UML view (spec §4.2: named parts, not a pin map): the editor
// mounts on that view, opens it, and takes the entry from the YAML surface without an error. A view the renderer draws
// nothing for (a new scenario's dynamic view) is an empty drawing with its palette, and a drawing made while the editor
// is hidden is laid out again when it is shown.
//
// The editor is mounted from the manifests by tests/helpers/c4-uml-editing.js; its host records the texts it is told.
// Facts about the model (the view's title, its brief description, the drawn aliases) come from the C4 core.
const { test, expect } = require('@playwright/test');
const { auditInteractiveState } = require('./a11y-helpers');
const { C4, INTERFACES_REFERENCE, openUmlEditor, hostLog, canvas } = require('./helpers/c4-uml-editing.js');
const { loadC4Editor } = require('./helpers/c4-editor-page.js');

/** Every uncaught error of the page, in the order it happened. */
function pageErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

const callEditor = (page, method, ...args) => page.evaluate(({ name, values }) => window.c4Editors.editor[name](...values), { name: method, values: args });

/** The reference model with a `layout:` entry for view `selector` holding the YAML of `part` (spec §4.2). */
const withLayoutEntry = (selector, part) => `${INTERFACES_REFERENCE}layout:\n  ${selector}:\n    ${part}\n`;

// Two documents a learner can write whose code view the canvas must draw: one that keeps positions in that view, and
// one that names its initial view with a quoted key, which a rewritten `view:` line would duplicate.
const CODE_VIEW_DOCUMENTS = [
  {
    name: 'a design that keeps positions in that view',
    text: withLayoutEntry('code of policy', 'positions:\n      EnrollmentPolicy: [80, 40]\n      EnrollmentRule: [420, 40]'),
  },
  {
    name: 'a design whose top-level view key is quoted',
    text: INTERFACES_REFERENCE.replace('schema: c4-design/1\n', 'schema: c4-design/1\n"view": containers of registration\n'),
  },
];

test.describe('the canvas draws a UML-notation view through the delegated-view seam', () => {
  for (const { name, text } of CODE_VIEW_DOCUMENTS) {
    test(`opening code of policy draws the class diagram and leaves the YAML text unchanged (${name})`, async ({ page }) => {
      expect(text).not.toBe(INTERFACES_REFERENCE);
      const errors = pageErrors(page);
      const view = C4.project(C4.load(text), 'code of policy');
      const editor = await openUmlEditor(page, { text, view: 'containers of registration' });

      await callEditor(page, 'openView', 'code of policy');

      await expect(canvas(editor)).toHaveAccessibleName(`Canvas: ${view.title}`);
      // The code view's module gives the listbox of its elements, which lies over the drawing (spec §7.2, §7.3), so
      // the drawing is a group named by the view's title, as every drawing with a listbox is.
      const drawing = canvas(editor).getByRole('group', { name: view.title, exact: true });
      await expect(drawing).toBeVisible();
      await expect(drawing.getByRole('listbox', { name: 'Elements in this view' })).toBeVisible();
      for (const alias of Object.keys(C4.toUml(view).ids)) {
        // The drawn name, an SVG text; each option's accessible name repeats it.
        await expect(drawing.locator('text').filter({ hasText: new RegExp(`^${alias}$`) }), `the class ${alias} is drawn`).toBeVisible();
      }
      expect(await callEditor(page, 'getText'), 'the document is the one the learner wrote').toBe(text);
      expect((await hostLog(page)).texts, 'the host is told of no text change').toEqual([]);
      expect(errors).toEqual([]);
    });
  }
});

// A scenario made with "New scenario…" has no step, so its dynamic view has no lifeline yet (Review Focus 1).
const EMPTY_SCENARIO = INTERFACES_REFERENCE.replace('\ndeployment:\n', '\n  drop:\n    title: Drop a section\n\ndeployment:\n');

test.describe('a dynamic view with no lifeline yet', () => {
  test('a new, empty scenario\'s dynamic view is drawn as an empty view with the palette\'s add tools, and nothing throws', async ({ page }) => {
    const errors = pageErrors(page);
    const editor = await openUmlEditor(page, { text: EMPTY_SCENARIO, view: 'dynamic drop' });

    await expect(canvas(editor)).toHaveAccessibleName(`Canvas: ${C4.project(C4.load(EMPTY_SCENARIO), 'dynamic drop').title}`);
    await expect(canvas(editor), 'the view is not named as one that cannot be drawn').not.toContainText('cannot be drawn');
    const palette = editor.getByRole('group', { name: 'Add to the diagram', exact: true });
    await expect(palette.getByRole('button', { name: 'Message', exact: true }), 'a step can be added from the palette').toBeEnabled();
    expect(errors).toEqual([]);
  });

  for (const width of [320, 1440]) {
    test(`auditInteractiveState on the empty dynamic view and its step form, in light and dark mode, at ${width} CSS px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const editor = await openUmlEditor(page, { text: EMPTY_SCENARIO, view: 'dynamic drop', siteThemes: true });
      const audit = (state) => auditInteractiveState(page, `C4 editor empty dynamic view ${state} at ${width} px`, { include: '#editor' });
      await expect(canvas(editor)).not.toContainText('cannot be drawn');
      await audit('as drawn');

      // The palette at wide screens, the Add menu at narrow ones (docs/c4-editor.md): both list Message.
      if (width >= 1440) {
        await editor.getByRole('group', { name: 'Add to the diagram', exact: true }).getByRole('button', { name: 'Message', exact: true }).click();
      } else {
        await editor.getByRole('button', { name: 'Add', exact: true }).click();
        await editor.getByRole('menuitem', { name: 'Message', exact: true }).click();
      }
      await expect(editor.getByRole('dialog', { name: 'Add a step', exact: true })).toBeVisible();
      await audit('with the step form open');
    });
  }
});

test.describe('a drawing made while the canvas is hidden', () => {
  test('a view drawn again while its editor is hidden (another surface shown) is laid out once the editor is shown, with every option', async ({ page }) => {
    // The tutorial's YAML surface hides the visual editor while the learner types there.
    const editor = await openUmlEditor(page, { view: 'dynamic enroll' });
    const listbox = canvas(editor).getByRole('listbox', { name: 'Elements in this view' });
    const shown = await listbox.getByRole('option').count();
    const lifelines = await listbox.getByRole('option', { name: 'Planner Web App', exact: true }).count();
    expect(lifelines, 'a lifeline is an option of the drawing').toBe(1);

    // Test plumbing: the surface switch hides the editor's container with display: none (css/tutorial-c4.css).
    const setShown = (shown) => page.evaluate((display) => { document.getElementById('editor').parentElement.style.display = display; }, shown ? '' : 'none');
    await setShown(false);
    await callEditor(page, 'setText', INTERFACES_REFERENCE.replace('submits the plan to', 'sends the plan to'));
    await expect(canvas(editor)).toBeHidden();
    await setShown(true);

    await expect(listbox.getByRole('option'), 'the listbox offers what the drawing shows').toHaveCount(shown);
    await expect(listbox.getByRole('option', { name: 'Planner Web App', exact: true })).toHaveCount(1);
  });
});

// One layout entry per UML view type, each a part that view type keeps (spec §4.2).
const UML_LAYOUT_ENTRIES = [
  ['code of policy', 'positions:\n      EnrollmentPolicy: [80, 40]'],
  ['deployment production', 'positions:\n      laptop: [40, 40]'],
  ['dynamic enroll', 'lifelines: [web, policy, coordinator, seats, billing-gateway]'],
  ['interfaces of api', 'positions:\n      web: [60, 360]'],
];

test.describe('a design that keeps a layout entry for a UML view', () => {
  for (const [selector, part] of UML_LAYOUT_ENTRIES) {
    test(`a design holding a layout entry for a UML view mounts on that view, opens it, and takes it by setText without an error (${selector})`, async ({ page }) => {
      const text = withLayoutEntry(selector, part);
      const canvasName = `Canvas: ${C4.project(C4.load(text), selector).title}`;
      const errors = pageErrors(page);

      const editor = await openUmlEditor(page, { text, view: selector });
      await expect(canvas(editor), 'the editor mounts on the view').toHaveAccessibleName(canvasName);

      await callEditor(page, 'openView', 'containers of registration');
      await callEditor(page, 'openView', selector);
      await expect(canvas(editor), 'the view opens from a C4-notation view').toHaveAccessibleName(canvasName);

      await callEditor(page, 'setText', INTERFACES_REFERENCE);
      await callEditor(page, 'setText', text);
      await expect(canvas(editor), 'the view stays open when the entry is typed in').toHaveAccessibleName(canvasName);
      expect(await callEditor(page, 'getText')).toBe(text);
      expect(errors).toEqual([]);
    });
  }
});

// The shared relationship form serves a canvas gesture that writes more than the relationship (plan Task 36): a
// sentence above its fields says why it opened, and the extra commands join the relationship in one batch. The page
// holds an editor state and the shared actions, loaded from the manifests with the diagram editor's core scripts, as
// the editor pages of the UML-notation views load them; the host records every change with its undo label.
test.describe('the relationship form of a canvas gesture', () => {
  const LEAD = 'UnitCapRule is not a collaborator of EnrollmentPolicy yet. Describe what EnrollmentPolicy asks of it.';
  const PIN = { op: 'setUmlLayout', viewKey: 'code of policy', positions: { UnitCapRule: [540, 300] } };

  test('alsoDispatch adds the relationship and the extra commands in one undo step, and the lead sentence is shown', async ({ page }) => {
    const errors = pageErrors(page);
    await loadC4Editor(page, { title: 'C4 editor relationship form', diagramEditor: true });
    await page.evaluate(({ text }) => {
      const root = document.getElementById('editor');
      root.classList.add('c4-editor');
      const parts = window.ArchUMLC4EditorParts;
      const changes = [];
      let clock = 0;
      const host = { onTextChange: (changed, info) => changes.push(info.label) };
      const state = parts.state.createEditorState({ text, host, view: 'code of policy', now: () => (clock += 1000) });
      const ids = parts.dom.idFactory('ed1');
      const announce = parts.dom.createAnnouncer(root);
      const options = { profile: 'expert', scaffolds: {}, checks: {}, lockedFields: [], readOnly: false };
      window.harness = { state, changes, actions: parts.actions.createActions(root, { state, dom: parts.dom, host, ids, announce, options }) };
    }, { text: INTERFACES_REFERENCE });

    const added = page.evaluate(({ lead, pin }) => window.harness.actions.openRelationshipForm(
      { sourceId: 'EnrollmentPolicy', targetId: 'UnitCapRule' }, { lead, alsoDispatch: [pin] }), { lead: LEAD, pin: PIN });
    const form = page.getByRole('dialog', { name: 'Add relationship' });
    await expect(form.getByText(LEAD, { exact: true }), 'the lead sentence is shown above the fields').toBeVisible();
    const description = form.getByRole('textbox', { name: 'Description' });
    await expect(description).toHaveAccessibleDescription(new RegExp(LEAD.replace(/\./g, '\\.')));
    await description.fill('asks for the unit cap through');
    await form.getByRole('button', { name: 'Add', exact: true }).click();
    expect((await added).ok, 'the form adds the relationship').toBe(true);

    const model = C4.load(await page.evaluate(() => window.harness.state.getText())).model;
    expect(model.relationships.some((relationship) => relationship.sourceId === 'EnrollmentPolicy' && relationship.targetId === 'UnitCapRule'
      && relationship.description === 'asks for the unit cap through'), 'the relationship is in the model').toBe(true);
    expect(model.layout.get('code of policy').positions.get('UnitCapRule'), 'and the extra command was written').toEqual([540, 300]);
    expect(await page.evaluate(() => window.harness.changes.length), 'the host heard of one change').toBe(1);
    await page.evaluate(() => window.harness.state.undo());
    expect(await page.evaluate(() => window.harness.state.getText()), 'one undo takes both back').toBe(INTERFACES_REFERENCE);
    expect(errors).toEqual([]);
  });
});
