// @ts-check
// The deployment view `deployment production` edited end to end on the C4 editor (UML-view editing spec §5.4, §5.6,
// §6, §7.3–§7.7; plan Task 43): nesting changes only by a drop on a node marked possible or by "Move to…", and a drop
// anywhere else changes nothing and says why; the options describe each node, hosted element, and link; a node added
// on the canvas is named in place and takes the id of its first name; a link is drawn with the keyboard alone and
// with the pointer alone, each through this editor's link form; a node that appears through the inspector and lands
// on a node that keeps a position is named as an overlap; two editors on one page keep their own link forms.
//
// Pages come from tests/helpers/c4-uml-editing.js. Facts about the model come from the C4 core, and a sentence is
// compared with the function that owns its words (the refusal table). Drawing coordinates are read with the bundle's
// `UMLShared.renderedLayoutBox`; a drag's target marks by the class `uml-pg-target-mark` and their state classes, which
// spec §3.7 keeps as a contract of the module.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { auditInteractiveState } = require('./a11y-helpers');
const { emptySpotInCanvas } = require('./helpers/c4-editor-page.js');
const {
  C4, INTERFACES_REFERENCE, openUmlEditor, openTwoUmlEditors, hostLog, canvas, elements, option, messageRegion,
} = require('./helpers/c4-uml-editing.js');
const refusalTable = require('../js/ArchUML/c4/editor/c4-editor-uml-refusals.js');

const VIEW = 'deployment production';
const ENVIRONMENT = 'production';
// The drawing is wide: on a wide screen every node is in view without scrolling.
const WIDE = { width: 1600, height: 1100 };

const textOf = (page, rootId = 'editor') => page.evaluate((id) => window.c4Editors[id].getText(), rootId);
const palette = (editor) => editor.getByRole('group', { name: 'Add to the diagram', exact: true });
const menu = (editor, name) => editor.getByRole('menu', { name, exact: true });
const menuItem = (editor, menuName, name) => menu(editor, menuName).getByRole('menuitem', { name, exact: true });
const nameEditor = (editor, name) => editor.getByRole('textbox', { name, exact: true });
const linkForm = (editor, title) => editor.getByRole('dialog', { name: title, exact: true });
const nodesOf = (text) => C4.load(text).model.environments.get(ENVIRONMENT).nodes;
const keptPositions = (text) => {
  const view = C4.project(C4.load(text), VIEW);
  return view.layout ? Object.fromEntries(view.layout.positions) : {};
};

/** Waits until the host of `rootId` heard exactly `count` changes (one per undo step) and returns the last text. */
async function changes(page, count, message, rootId = 'editor') {
  await expect.poll(() => page.evaluate((id) => window.c4HostLogs[id].texts.length, rootId), { message }).toBe(count);
  return page.evaluate((id) => window.c4HostLogs[id].texts.at(-1), rootId);
}

/**
 * A client point of box `alias` where it lies above no box drawn inside it: its centre (`at: 'centre'`), the middle
 * of the band just below its top edge, where a node draws its name (`'band'`), or the middle of its right margin
 * (`'right'`), right of the nodes a node holds. With `scroll` (the default) its hit target is scrolled into view
 * first; a drag reads its drop point without scrolling, which would move the pressed box away from the pointer.
 */
function boxPoint(editor, alias, { at = 'centre', scroll = true } = {}) {
  return canvas(editor).evaluate((region, { name, where, scrollFirst }) => {
    const svg = region.querySelector('.c4-editor__diagram svg');
    const hit = [...region.querySelectorAll('.uml-pg-edit-hitbox')].find((target) => target.getAttribute('data-layout-id') === name);
    if (hit && scrollFirst) hit.scrollIntoView({ block: 'center', inline: 'center' });
    const box = window.UMLShared.renderedLayoutBox(svg, name);
    const x = where === 'right' ? box.x + box.width - 16 : box.x + box.width / 2;
    const y = where === 'band' ? box.y + 14 : box.y + box.height / 2;
    const point = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM());
    return { x: point.x, y: point.y };
  }, { name: alias, where: at, scrollFirst: scroll });
}


/** Every top-level node's drawn box, by alias, in drawing units. */
function drawnBoxes(editor, aliases) {
  return canvas(editor).evaluate((region, names) => {
    const svg = region.querySelector('.c4-editor__diagram svg');
    return Object.fromEntries(names.map((name) => {
      const box = window.UMLShared.renderedLayoutBox(svg, name);
      return [name, box && { x: box.x, y: box.y, width: box.width, height: box.height }];
    }));
  }, aliases);
}

/** The state of the drag's target mark over box `alias`: 'possible', 'not possible', or null when it has none. */
function markOf(editor, alias) {
  return canvas(editor).evaluate((region, name) => {
    const mark = region.querySelector(`.uml-pg-target-mark[data-target-ref="${name}"]`);
    if (!mark) return null;
    return mark.classList.contains('is-possible') ? 'possible' : 'not possible';
  }, alias);
}

/** Opens the menu of option `name` with Shift+F10. */
async function openMenuOf(page, editor, name) {
  await option(editor, name).focus();
  await page.keyboard.press('Shift+F10');
  await expect(menu(editor, `Actions for ${name}`)).toBeVisible();
}

// ---- Nesting (spec §5.4, §9.3 "Nesting") ----------------------------------------------------------------------------

test.describe('nesting changes only on purpose', () => {
  test.beforeEach(async ({ page }) => { await page.setViewportSize(WIDE); });

  test('browser dropped beside its parent changes nothing and shows layout/inside-node; Move to… At the top level moves it, and the undo label is "Moved Web browser out of Student\'s computer to the top level"', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW });
    const from = await boxPoint(editor, 'browser', { at: 'band' });
    const spot = await emptySpotInCanvas(canvas(editor), 40);
    if (!spot) throw new Error('the canvas shows no empty spot to drop on');

    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(spot.x, spot.y, { steps: 8 });
    await page.mouse.up();

    const refusal = refusalTable.verdict('layout/inside-node', { Name: 'Web browser', Parent: "Student's computer" });
    await expect(messageRegion(editor)).toContainText(refusal.message);
    expect(await textOf(page), 'the drop changed nothing').toBe(INTERFACES_REFERENCE);

    await openMenuOf(page, editor, 'Web browser');
    await menuItem(editor, 'Actions for Web browser', 'Move to…').click();
    await menuItem(editor, 'Move Web browser to', 'At the top level (not inside a node)').click();

    const written = await changes(page, 1, 'Move to… is one change');
    expect(nodesOf(written).get('browser').parentId).toBeNull();
    await editor.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect.poll(async () => (await hostLog(page)).announced, { message: 'Undo names the step by its label' })
      .toContain("Undone: Moved Web browser out of Student's computer to the top level.");
    await expect.poll(() => textOf(page)).toBe(INTERFACES_REFERENCE);
  });

  test('api-pod dragged onto data-centre, marked possible, moves inside it in one undo step', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW });
    const from = await boxPoint(editor, 'api_pod', { at: 'band' });

    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 10, from.y + 10, { steps: 3 });
    const to = await boxPoint(editor, 'data_centre', { scroll: false });
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await expect.poll(() => markOf(editor, 'data_centre'), { message: 'the data centre is marked as a possible parent' }).toBe('possible');
    expect(await markOf(editor, 'ingress'), 'infrastructure is marked as not possible').toBe('not possible');
    await page.mouse.up();

    const written = await changes(page, 1, 'the drop is one change');
    expect(nodesOf(written).get('api-pod').parentId).toBe('data-centre');
    await editor.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect.poll(() => textOf(page), { message: 'one Undo takes the move back' }).toBe(INTERFACES_REFERENCE);
  });
});

// ---- The listbox (spec §7.3) ----------------------------------------------------------------------------------------

test('options say kind, technology, and inside <parent> or at the top level; links say declared or derived', async ({ page }) => {
  await page.setViewportSize(WIDE);
  const editor = await openUmlEditor(page, { view: VIEW });
  const set = (name) => elements(editor).getByRole('group', { name, exact: true });

  await expect(set('Nodes').getByRole('option', { name: 'API pod', exact: true }))
    .toHaveAccessibleDescription(/^execution environment; Kubernetes pod; 3 instances; inside Campus cloud; /);
  await expect(set('Nodes').getByRole('option', { name: "Student's computer", exact: true })).toHaveAccessibleDescription(/^device; at the top level; /);
  await expect(set('Hosted').getByRole('option', { name: 'Registration API on API pod', exact: true })).toHaveAccessibleDescription(/^container; /);
  await expect(set('Links').getByRole('option', { name: 'Ingress load balancer forwards HTTPS requests to API pod', exact: true }))
    .toHaveAccessibleDescription(/^declared link; /);
  await expect(set('Links').getByRole('option', { name: 'Registration API writes seat holds to Registration Database', exact: true }))
    .toHaveAccessibleDescription(/^derived from the relationship from Seat Gateway to Registration Database; follows the model; /);
});

// ---- Places without a drag, and the first rename (spec §7.4, §5.1 D1) -----------------------------------------------

test.describe('adding nodes without a drag', () => {
  test.beforeEach(async ({ page }) => { await page.setViewportSize(WIDE); });

  test('"Add a node inside Campus cloud" in its menu adds the node inside it; the Node tile, with that node selected, asks, and "At the top level" adds one there', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW });

    await openMenuOf(page, editor, 'Campus cloud');
    await menuItem(editor, 'Actions for Campus cloud', 'Add a node inside Campus cloud').press('Enter');
    let written = await changes(page, 1, 'the menu adds one node');
    expect(nodesOf(written).get('new-node').parentId).toBe('campus-cloud');

    // The new node is selected, so the tile asks where the next one goes (spec §7.4).
    await palette(editor).getByRole('button', { name: 'Node', exact: true }).click();
    await editor.getByRole('menuitem', { name: 'At the top level', exact: true }).click();
    await page.keyboard.press('Escape');
    written = await changes(page, 2, 'the tile adds one more');
    expect(nodesOf(written).get('new-node-2').parentId).toBeNull();
  });

  test('a node added on the canvas opens its name editor with "New node" selected; Escape keeps the placeholder; renaming it then gives it the id of its new name in one undo step, and a second rename keeps that id', async ({ page }) => {
    // Edits within 600 ms join one undo step: the clock is moved on between the three, so each is a step of its own.
    await page.clock.install();
    const editor = await openUmlEditor(page, { view: VIEW });

    await palette(editor).getByRole('button', { name: 'Node', exact: true }).click();
    const field = nameEditor(editor, 'Name of node New node');
    await expect(field).toBeFocused();
    await expect(field).toHaveValue('New node');
    expect(await field.evaluate((input) => [input.selectionStart, input.selectionEnd]), 'the whole name is selected').toEqual([0, 'New node'.length]);
    await page.keyboard.press('Escape');
    const added = await changes(page, 1, 'the addition is one change');
    expect(nodesOf(added).get('new-node').name, 'Escape keeps the placeholder').toBe('New node');
    await page.clock.fastForward(1000);

    await option(editor, 'New node').focus();
    await page.keyboard.press('F2');
    await nameEditor(editor, 'Name of node New node').fill('Edge proxy');
    await page.keyboard.press('Enter');
    const renamed = await changes(page, 2, 'the first rename is one change');
    expect(nodesOf(renamed).get('edge-proxy').name, 'the first rename gives the node the id of its name').toBe('Edge proxy');
    expect(nodesOf(renamed).has('new-node'), 'the placeholder id is gone').toBe(false);
    await page.clock.fastForward(1000);

    await option(editor, 'Edge proxy').focus();
    await page.keyboard.press('F2');
    await nameEditor(editor, 'Name of node Edge proxy').fill('Front proxy');
    await page.keyboard.press('Enter');
    const again = await changes(page, 3, 'the second rename is one change');
    expect(nodesOf(again).get('edge-proxy').name, 'a second rename keeps the id').toBe('Front proxy');

    await editor.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect.poll(() => textOf(page), { message: 'one Undo takes back the second rename' }).toBe(renamed);
    await editor.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect.poll(() => textOf(page), { message: 'one more Undo takes back the first rename with its id' }).toBe(added);
  });

  test('F2 on api-pod starts from "API pod" without "×3"', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW });
    await option(editor, 'API pod').focus();
    await page.keyboard.press('F2');
    await expect(nameEditor(editor, 'Name of node API pod')).toHaveValue('API pod');
  });
});

// ---- Links without a drag (WCAG 2.5.7; spec §7.4) ---------------------------------------------------------------------

test.describe('links between nodes', () => {
  test.beforeEach(async ({ page }) => { await page.setViewportSize(WIDE); });

  /** Fills the link form and confirms it with Enter. */
  async function fillLinkForm(page, editor) {
    const form = linkForm(editor, 'Add a link');
    await expect(form).toBeVisible();
    await expect(form.getByRole('textbox', { name: 'Description', exact: true })).toBeFocused();
    await form.getByRole('textbox', { name: 'Description', exact: true }).fill('reaches over the internet');
    await form.getByRole('textbox', { name: 'Technology', exact: true }).fill('HTTPS');
    await page.keyboard.press('Enter');
  }

  const linkOf = (text) => nodesOf(text).get('laptop').relationships.find((link) => link.targetId === 'campus-cloud');

  test('a link drawn with the keyboard (C on laptop, arrows and Enter on campus-cloud) opens the link form and adds the link in one undo step', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW });
    await option(editor, "Student's computer").focus();

    await page.keyboard.press('c');
    await expect(messageRegion(editor)).toContainText(/^Drawing a line from Student's computer/);
    for (let step = 0; step < 6 && !(await option(editor, 'Campus cloud').evaluate((node) => node === document.activeElement)); step += 1) {
      await page.keyboard.press('ArrowDown');
    }
    await expect(option(editor, 'Campus cloud')).toBeFocused();
    await page.keyboard.press('Enter');
    await fillLinkForm(page, editor);

    const written = await changes(page, 1, 'the link is one change');
    expect([linkOf(written).description, linkOf(written).technology]).toEqual(['reaches over the internet', 'HTTPS']);
    await editor.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect.poll(() => textOf(page)).toBe(INTERFACES_REFERENCE);
  });

  test('a link drawn with the pointer only (the link tool, then a click on laptop and one on campus-cloud) opens the link form and adds the link in one undo step', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW });

    await palette(editor).getByRole('button', { name: 'Link between nodes', exact: true }).click();
    const laptop = await boxPoint(editor, 'laptop', { at: 'right' });
    await page.mouse.click(laptop.x, laptop.y);
    const cloud = await boxPoint(editor, 'campus_cloud', { at: 'right' });
    await page.mouse.click(cloud.x, cloud.y);
    await fillLinkForm(page, editor);

    const written = await changes(page, 1, 'the link is one change');
    expect([linkOf(written).description, linkOf(written).technology]).toEqual(['reaches over the internet', 'HTTPS']);
    await editor.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect.poll(() => textOf(page)).toBe(INTERFACES_REFERENCE);
  });

  // The box menu's "Draw a line", then a click on the target (as in the code view); the form's fields are typed.
  test('a link drawn with "Draw a line" and a click on campus-cloud opens the link form and adds the link in one undo step', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW });

    await openMenuOf(page, editor, "Student's computer");
    await menuItem(editor, "Actions for Student's computer", 'Draw a line').click();
    const cloud = await boxPoint(editor, 'campus_cloud', { at: 'right' });
    await page.mouse.click(cloud.x, cloud.y);
    await fillLinkForm(page, editor);

    const written = await changes(page, 1, 'the link is one change');
    expect(linkOf(written).description).toBe('reaches over the internet');
  });

  test('"Move to…" on a link\'s target end lists the nodes that can take it and moves the end in one undo step', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW });
    const name = 'Ingress load balancer forwards HTTPS requests to API pod';
    await option(editor, name).focus();
    await page.keyboard.press('Shift+F10');
    await menuItem(editor, `Actions for ${name}`, 'Move the target end to…').click();

    const chooser = menu(editor, `Move the target end of ${name} to`);
    await expect(chooser.getByRole('menuitem', { name: 'Managed database', exact: true })).toBeEnabled();
    await expect(chooser.getByRole('menuitem', { name: /^Registration API on API pod/ })).toHaveAttribute('aria-disabled', 'true');
    await chooser.getByRole('menuitem', { name: 'Managed database', exact: true }).click();

    const written = await changes(page, 1, 'moving the end is one change');
    expect(nodesOf(written).get('ingress').relationships.map((link) => link.targetId)).toEqual(['postgres']);
  });

  test('Escape in the link form adds nothing and says so', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW });
    await option(editor, "Student's computer").focus();
    await page.keyboard.press('c');
    for (let step = 0; step < 6 && !(await option(editor, 'Campus cloud').evaluate((node) => node === document.activeElement)); step += 1) {
      await page.keyboard.press('ArrowDown');
    }
    await page.keyboard.press('Enter');
    await expect(linkForm(editor, 'Add a link')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(linkForm(editor, 'Add a link')).toHaveCount(0);
    expect(await textOf(page)).toBe(INTERFACES_REFERENCE);
  });
});

// ---- The offers of the refusal table (spec §5.4, §3.4) -----------------------------------------------------------------

test.describe('the offers of a refusal', () => {
  test.beforeEach(async ({ page }) => { await page.setViewportSize(WIDE); });

  const offer = (editor, label) => messageRegion(editor).getByRole('button', { name: label, exact: true });

  /** Starts a line from option `from` with C and picks option `to` with the arrow keys and Enter. */
  async function drawWithKeyboard(page, editor, from, to) {
    await option(editor, from).focus();
    await page.keyboard.press('c');
    for (let step = 0; step < 12 && !(await option(editor, to).evaluate((node) => node === document.activeElement)); step += 1) {
      await page.keyboard.press('ArrowDown');
    }
    await expect(option(editor, to)).toBeFocused();
    await page.keyboard.press('Enter');
  }

  test('ingress to api-pod again is link-exists, and "Show the link" shows the ingress in the inspector without a change', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW });
    await drawWithKeyboard(page, editor, 'Ingress load balancer', 'API pod');

    const refusal = refusalTable.verdict('link-exists', { 'Node A': 'Ingress load balancer', 'Node B': 'API pod' });
    await expect(messageRegion(editor)).toContainText(refusal.message);
    await offer(editor, 'Show the link').click();

    await expect.poll(async () => (await hostLog(page)).selections.at(-1)).toEqual({ environmentId: ENVIRONMENT, nodeId: 'ingress' });
    await expect(editor.getByRole('region', { name: 'Inspector' }).getByRole('textbox', { name: 'Name', exact: true }).first())
      .toHaveValue('Ingress load balancer');
    expect(await textOf(page), 'showing changes nothing').toBe(INTERFACES_REFERENCE);
  });

  test('deleting a derived path is derived/path, and "Show the relationship" selects the relationship it is drawn from', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW });
    const name = 'Registration API writes seat holds to Registration Database';
    const { model } = C4.load(INTERFACES_REFERENCE);
    const relationship = model.relationships.find((candidate) => model.elements.get(candidate.sourceId).name === 'Seat Gateway'
      && model.elements.get(candidate.targetId).name === 'Registration Database');

    await option(editor, name).focus();
    await page.keyboard.press('Delete');
    const refusal = refusalTable.verdict('derived/path', { Source: 'Seat Gateway', Target: 'Registration Database', description: relationship.description });
    await expect(messageRegion(editor)).toContainText(refusal.message);
    await offer(editor, 'Show the relationship').click();

    await expect.poll(async () => (await hostLog(page)).selections.at(-1)).toEqual({ relationshipId: relationship.id });
    expect(await textOf(page), 'showing changes nothing').toBe(INTERFACES_REFERENCE);
  });

  test('two instances of one element are same-element-instances, and "Add a link from API pod to Canary pod…" opens the link form and adds the link in one undo step', async ({ page }) => {
    const text = fs.readFileSync(path.join(__dirname, '../js/ArchUML/tests/c4/fixtures/uml-editing.yml'), 'utf8');
    const editor = await openUmlEditor(page, { view: VIEW, text });
    // C mode's arrow keys pass over targets that cannot take the line, so the refused target is clicked.
    await option(editor, 'Registration API on API pod').focus();
    await page.keyboard.press('c');
    const canary = await boxPoint(editor, 'api_canary');
    await page.mouse.click(canary.x, canary.y);
    const refusal = refusalTable.verdict('same-element-instances', { Element: 'Registration API', 'Node A': 'API pod', 'Node B': 'Canary pod' });
    await expect(messageRegion(editor)).toContainText(refusal.message);

    await offer(editor, 'Add a link from API pod to Canary pod…').click();
    const form = linkForm(editor, 'Add a link');
    await expect(form).toBeVisible();
    await form.getByRole('textbox', { name: 'Description', exact: true }).fill('mirrors traffic to');
    await page.keyboard.press('Enter');

    const written = await changes(page, 1, 'the offered link is one change');
    expect(nodesOf(written).get('api-pod').relationships.filter((link) => link.targetId === 'canary').map((link) => link.description))
      .toEqual(['mirrors traffic to']);
    await editor.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect.poll(() => textOf(page), { message: 'one Undo takes the link back' }).toBe(text);
  });
});

// ---- Review Focus 7 and 5 ----------------------------------------------------------------------------------------------

test('a top-level node added in the inspector that lands on a pinned node is named as an overlap when deployment production is drawn next', async ({ page }) => {
  await page.setViewportSize(WIDE);
  const automatic = C4.project(C4.load(INTERFACES_REFERENCE), VIEW);
  expect(automatic.layout, 'precondition: the reference keeps no deployment positions').toBeNull();
  // The data centre is kept where the renderer puts a top-level node that keeps no position, beside the other two.
  const pinned = `${INTERFACES_REFERENCE}layout:\n  ${VIEW}:\n    positions:\n      laptop: [1400, 900]\n      campus-cloud: [0, 0]\n      data-centre: [650, 600]\n`;
  const editor = await openUmlEditor(page, { view: 'containers of registration', text: pinned });

  await page.evaluate((environmentId) => window.c4Editors.editor.select({ environmentId }), ENVIRONMENT);
  const inspector = editor.getByRole('region', { name: 'Inspector' });
  await inspector.getByRole('textbox', { name: 'Name', exact: true }).last().fill('Edge proxy');
  await inspector.getByRole('button', { name: 'Add node', exact: true }).click();
  await changes(page, 1, 'the inspector adds the node');
  await page.evaluate((view) => window.c4Editors.editor.openView(view), VIEW);

  await expect(messageRegion(editor)).toContainText(/^Edge proxy now overlaps University data center\./);
  await expect(messageRegion(editor).getByRole('button', { name: 'Move Edge proxy to a free place', exact: true })).toBeVisible();
});

test('two editors in deployment views each open their own link form, which writes to its own model', async ({ page }) => {
  await page.setViewportSize(WIDE);
  const [first, second] = await openTwoUmlEditors(page, { view: VIEW }, { view: VIEW });

  for (const [editor, rootId, description] of [[first, 'first', 'first link'], [second, 'second', 'second link']]) {
    await option(editor, "Student's computer").focus();
    await page.keyboard.press('c');
    for (let step = 0; step < 6 && !(await option(editor, 'Campus cloud').evaluate((node) => node === document.activeElement)); step += 1) {
      await page.keyboard.press('ArrowDown');
    }
    await page.keyboard.press('Enter');
    const form = linkForm(editor, 'Add a link');
    await expect(form, `the form opens in the ${rootId} editor`).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Add a link', exact: true }), 'one link form is open').toHaveCount(1);
    await form.getByRole('textbox', { name: 'Description', exact: true }).fill(description);
    await page.keyboard.press('Enter');
    await changes(page, 1, `the ${rootId} editor changes once`, rootId);
  }

  for (const [rootId, description] of [['first', 'first link'], ['second', 'second link']]) {
    const link = nodesOf(await textOf(page, rootId)).get('laptop').relationships.find((candidate) => candidate.targetId === 'campus-cloud');
    expect(link.description, `the ${rootId} editor's model holds its own link`).toBe(description);
  }
});

// ---- Accessibility (WCAG 2.2 AA; plan Global Constraints) -------------------------------------------------------------

test.describe('accessibility of a move, the Move to… menu, and the link form', () => {
  for (const width of [320, 1440]) {
    test(`auditInteractiveState with a node being moved, the Move to… menu, and the link form, in light and dark mode, at ${width} CSS px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const editor = await openUmlEditor(page, { view: VIEW, siteThemes: true });
      const audit = (state) => auditInteractiveState(page, `C4 editor deployment view ${state} at ${width} px`, { include: '#editor' });

      await option(editor, "Student's computer").focus();
      await page.keyboard.press('m');
      await expect(messageRegion(editor)).toContainText(/^Moving Student's computer/);
      await audit('with a node being moved');
      await page.keyboard.press('Escape');

      await openMenuOf(page, editor, 'API pod');
      await menuItem(editor, 'Actions for API pod', 'Move to…').click();
      await expect(menu(editor, 'Move API pod to')).toBeVisible();
      await audit('with the Move to… menu');
      await page.keyboard.press('Escape');

      await option(editor, "Student's computer").focus();
      await page.keyboard.press('c');
      for (let step = 0; step < 6 && !(await option(editor, 'Campus cloud').evaluate((node) => node === document.activeElement)); step += 1) {
        await page.keyboard.press('ArrowDown');
      }
      await page.keyboard.press('Enter');
      await expect(linkForm(editor, 'Add a link')).toBeVisible();
      await audit('with the link form');
    });
  }
});
