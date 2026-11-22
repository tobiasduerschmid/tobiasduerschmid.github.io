// @ts-check
// The shared actions the canvases of the UML-notation views call (UML-view editing spec §5.1, §14 D1): the first-rename
// rule for each kind of named thing (an element, a deployment node, a provided interface), the two rename actions that
// join the element's (`renameNode`, `renameInterface`), the Name fields of the node and interface forms that call them,
// and the model-wide wording of a rename, a delete, and an added relationship. The page holds one editor state, the
// shared actions, and the inspector, loaded from the ArchUML manifests (`loadC4Editor`). A placeholder is put into the
// model through the state, as the canvases add it; every edit is read back from the editor's text with the C4 core.
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { auditInteractiveState } = require('./a11y-helpers');
const { C4, loadC4Editor } = require('./helpers/c4-editor-page.js');
const { INTERFACES_REFERENCE } = require('./helpers/c4-uml-editing.js');

// The function that owns the model-wide sentences and undo labels; the tests compare with it instead of repeating them.
const { modelWideWording } = require(path.join(__dirname, '../js/ArchUML/c4/editor/c4-editor-actions-shared.js'));

const API_INTERFACE_PATH = 'systems.registration.containers.api.provides';

/**
 * Opens a page with one editor root holding an editor state (on `text`, with `view` open and `lockedFields`), the
 * shared actions, and the inspector. The host records every text change with its undo label; every message the
 * actions or the inspector announce is recorded in order. The state's clock advances one second per reading, so no
 * two edits merge into one undo step by timing: one undo step means one edit.
 */
async function openActions(page, { text = INTERFACES_REFERENCE, view = 'code of policy', lockedFields = [], siteThemes = false } = {}) {
  await loadC4Editor(page, { title: 'C4 editor shared actions', siteThemes });
  await page.evaluate((settings) => {
    const root = document.getElementById('editor');
    root.classList.add('c4-editor');
    const region = document.createElement('section');
    region.setAttribute('aria-label', 'Inspector');
    root.append(region);
    const parts = window.ArchUMLC4EditorParts;
    const changes = [];
    const announced = [];
    let clock = 0;
    const host = {
      onTextChange: (changed, info) => changes.push({ text: changed, label: info.label }),
      confirm: () => Promise.resolve(true),
    };
    const state = parts.state.createEditorState({
      text: settings.text, host, view: settings.view, lockedFields: settings.lockedFields, now: () => (clock += 1000),
    });
    const ids = parts.dom.idFactory('ed1');
    const live = parts.dom.createAnnouncer(root);
    const announce = (message, details) => {
      announced.push(message);
      live(message, details);
    };
    const options = { profile: 'expert', scaffolds: {}, checks: {}, lockedFields: settings.lockedFields, readOnly: false };
    const actions = parts.actions.createActions(root, { state, dom: parts.dom, host, ids, announce, options });
    parts.inspector.createInspector(region, { state, dom: parts.dom, ids, announce, host, options, actions, layout: { revealRegion: () => true } });
    window.harness = { state, actions, changes, announced };
  }, { text, view, lockedFields });
  return page.getByRole('region', { name: 'Inspector' });
}

/** Dispatches `command` through the editor state (as a canvas adds a thing) and returns its selection. */
async function dispatch(page, command) {
  const result = await page.evaluate((sent) => window.harness.state.dispatch(sent), command);
  expect(result.ok, `precondition: ${command.op} is accepted (${result.message})`).toBe(true);
  return result.selection;
}

const textNow = (page) => page.evaluate(() => window.harness.state.getText());
const modelNow = async (page) => C4.load(await textNow(page)).model;
const changeCount = (page) => page.evaluate(() => window.harness.changes.length);
const lastLabel = (page) => page.evaluate(() => window.harness.changes[window.harness.changes.length - 1].label);
const announcedSince = (page, count) => page.evaluate((from) => window.harness.announced.slice(from), count);

/** The text, change count, and announcement count before an action, for the oracles after it. */
async function before(page) {
  return {
    text: await textNow(page),
    changes: await changeCount(page),
    announced: await page.evaluate(() => window.harness.announced.length),
  };
}

/** The action reached the host as one change, and one undo restores the text it started from. */
async function expectOneUndoStep(page, start) {
  expect(await changeCount(page) - start.changes, 'the rename reached the host as one change').toBe(1);
  await page.evaluate(() => window.harness.state.undo());
  expect(await textNow(page), 'one undo restores the text before the rename').toBe(start.text);
}

const renameElement = (page, id, name, options) => page.evaluate(([elementId, newName, settings]) =>
  window.harness.actions.renameElement(elementId, newName, settings), [id, name, options]);
const renameNode = (page, nodeId, name) => page.evaluate(([id, newName]) =>
  window.harness.actions.renameNode('production', id, newName), [nodeId, name]);
const renameInterface = (page, id, name, options) => page.evaluate(([interfaceId, newName, settings]) =>
  window.harness.actions.renameInterface(interfaceId, newName, settings), [id, name, options]);

const nodeOf = (model, nodeId) => model.environments.get('production').nodes.get(nodeId);

function section(inspector, name) {
  return inspector.getByRole('region', { name, exact: true });
}

test.describe('the first rename of an element', () => {
  test('a class added as "New class" takes the id of its first name, also when it already holds a position in code of policy', async ({ page }) => {
    await openActions(page);
    await dispatch(page, { op: 'batch', commands: [
      { op: 'addElement', parentId: 'policy', type: 'code', kind: 'class', name: 'New class' },
      { op: 'setUmlLayout', viewKey: 'code of policy', positions: { NewClass: [80, 300] } },
    ] });
    const start = await before(page);

    const result = await renameElement(page, 'NewClass', 'Seat Rule');

    expect(result).toMatchObject({ ok: true, elementId: 'SeatRule' });
    const model = await modelNow(page);
    expect(model.elements.get('SeatRule')).toMatchObject({ name: 'Seat Rule', kind: 'class', parentId: 'policy' });
    expect(model.elements.has('NewClass'), 'the placeholder id is gone').toBe(false);
    expect(model.layout.get('code of policy').positions.get('SeatRule'), 'the position follows the id').toEqual([80, 300]);
    expect(await announcedSince(page, start.announced)).toEqual(['Renamed New class to Seat Rule; its id is now SeatRule.']);
    await expectOneUndoStep(page, start);
  });

  test('an abstract class, an interface, an enum, a function, and a module added under their placeholders do the same', async ({ page }) => {
    await openActions(page);
    const kinds = [
      { kind: 'abstract_class', placeholder: 'New abstract class', name: 'Base Rule', id: 'BaseRule' },
      { kind: 'interface', placeholder: 'New interface', name: 'Seat Check', id: 'SeatCheck' },
      { kind: 'enum', placeholder: 'New enum', name: 'Rule Outcome', id: 'RuleOutcome' },
      { kind: 'function', placeholder: 'New function', name: 'Count Units', id: 'CountUnits' },
      { kind: 'module', placeholder: 'New module', name: 'Rule Helpers', id: 'RuleHelpers' },
    ];
    const added = [];
    for (const { kind, placeholder } of kinds) {
      added.push((await dispatch(page, { op: 'addElement', parentId: 'policy', type: 'code', kind, name: placeholder })).elementId);
    }

    for (const [index, { kind, name, id }] of kinds.entries()) {
      const result = await renameElement(page, added[index], name);
      expect(result, `the ${kind} takes the id of its first name`).toMatchObject({ ok: true, elementId: id });
    }

    const model = await modelNow(page);
    for (const { kind, name, id } of kinds) {
      expect(model.elements.get(id), `the ${kind} is ${name} under ${id}`).toMatchObject({ name, kind, parentId: 'policy' });
    }
    expect(added.filter((id) => model.elements.has(id)), 'no placeholder id is left').toEqual([]);
  });

  test('an element named before keeps its id', async ({ page }) => {
    await openActions(page);
    // A class that kept its placeholder id when it was named (a lock or a reference held the id at the time).
    await dispatch(page, { op: 'batch', commands: [
      { op: 'addElement', parentId: 'policy', type: 'code', kind: 'class', name: 'New class' },
      { op: 'setElementField', elementId: 'NewClass', field: 'name', value: 'Seat Rule' },
    ] });
    const start = await before(page);

    const result = await renameElement(page, 'NewClass', 'Seat Check');

    expect(result).toMatchObject({ ok: true, elementId: 'NewClass' });
    expect((await modelNow(page)).elements.get('NewClass').name).toBe('Seat Check');
    expect(await announcedSince(page, start.announced)).toEqual(['Renamed Seat Rule to Seat Check.']);
  });

  test('a class still named "New class" under an id of its own keeps that id', async ({ page }) => {
    const text = C4.edit(C4.load(INTERFACES_REFERENCE), {
      op: 'batch', commands: [
        { op: 'addElement', parentId: 'policy', type: 'code', kind: 'class', name: 'Seat Rule' },
        { op: 'setElementField', elementId: 'SeatRule', field: 'name', value: 'New class' },
      ],
    }).text;
    await openActions(page, { text });

    const result = await renameElement(page, 'SeatRule', 'Seat Check');

    expect(result).toMatchObject({ ok: true, elementId: 'SeatRule' });
    expect((await modelNow(page)).elements.get('SeatRule').name).toBe('Seat Check');
  });

  test('a second rename of a class that took its id from its first name keeps that id', async ({ page }) => {
    await openActions(page);
    await dispatch(page, { op: 'addElement', parentId: 'policy', type: 'code', kind: 'class', name: 'New class' });
    expect(await renameElement(page, 'NewClass', 'Seat Rule'), 'precondition: the first rename gives the id').toMatchObject({ elementId: 'SeatRule' });
    const start = await before(page);

    const result = await renameElement(page, 'SeatRule', 'Seat Check');

    expect(result).toMatchObject({ ok: true, elementId: 'SeatRule' });
    expect((await modelNow(page)).elements.get('SeatRule').name).toBe('Seat Check');
    expect(await announcedSince(page, start.announced)).toEqual(['Renamed Seat Rule to Seat Check.']);
  });

  test('a class whose only other references are its stored route and its place in a lifeline order takes the id of its first name', async ({ page }) => {
    await openActions(page);
    await dispatch(page, { op: 'batch', commands: [
      { op: 'addElement', parentId: 'policy', type: 'code', kind: 'class', name: 'New class' },
      { op: 'setUmlLayout', viewKey: 'code of policy',
        routes: [{ from: 'NewClass', to: 'EnrollmentRule', relation: 'collaborator', points: [[100, 320], [200, 320]] }] },
      { op: 'setUmlLayout', viewKey: 'dynamic enroll', lifelines: ['web', 'coordinator', 'NewClass'] },
    ] });

    const result = await renameElement(page, 'NewClass', 'Seat Rule');

    expect(result).toMatchObject({ ok: true, elementId: 'SeatRule' });
    const layout = (await modelNow(page)).layout;
    expect(layout.get('code of policy').routes.map((route) => [route.from, route.to]), 'the route follows the id').toEqual([['SeatRule', 'EnrollmentRule']]);
    expect(layout.get('dynamic enroll').lifelines, 'the lifeline place follows the id').toEqual(['web', 'coordinator', 'SeatRule']);
  });

  test('a placeholder container whose component has a place in a lifeline order keeps its id when first named', async ({ page }) => {
    await openActions(page, { view: 'containers of registration' });
    await dispatch(page, { op: 'batch', commands: [
      { op: 'addElement', parentId: 'registration', type: 'container', name: 'New container' },
      { op: 'addElement', parentId: 'new-container', type: 'component', name: 'Seat Cache' },
      { op: 'setUmlLayout', viewKey: 'dynamic enroll', lifelines: ['web', 'seat-cache'] },
    ] });

    const result = await renameElement(page, 'new-container', 'Cache Service');

    expect(result, 'an entry of a part of it is not its own').toMatchObject({ ok: true, elementId: 'new-container' });
    expect((await modelNow(page)).elements.get('new-container').name).toBe('Cache Service');
  });

  test('a placeholder container that the open view is inside (components of new-container) keeps its id when first named', async ({ page }) => {
    await openActions(page, { view: 'containers of registration' });
    await dispatch(page, { op: 'addElement', parentId: 'registration', type: 'container', name: 'New container' });
    const opened = await page.evaluate(() => window.harness.state.openView('components of new-container'));
    expect(opened.ok, 'precondition: the view inside the placeholder is open').toBe(true);
    const start = await before(page);

    const result = await renameElement(page, 'new-container', 'Seat Cache');

    expect(result).toMatchObject({ ok: true, elementId: 'new-container' });
    expect((await modelNow(page)).elements.get('new-container').name).toBe('Seat Cache');
    expect(await announcedSince(page, start.announced)).toEqual(['Renamed New container to Seat Cache.']);
  });
});

test.describe('the first rename of a deployment node', () => {
  test('the first rename of a node still named "New node" with the id new-node gives it the id of its new name in one undo step, announced "…; its id is now <id>."', async ({ page }) => {
    await openActions(page, { view: 'deployment production' });
    expect(await dispatch(page, { op: 'addNode', environmentId: 'production', name: 'New node' })).toMatchObject({ nodeId: 'new-node' });
    const start = await before(page);

    const result = await renameNode(page, 'new-node', 'Seat Worker');

    expect(result).toMatchObject({ ok: true, nodeId: 'seat-worker' });
    const model = await modelNow(page);
    expect(nodeOf(model, 'seat-worker')).toMatchObject({ name: 'Seat Worker', parentId: null });
    expect(nodeOf(model, 'new-node'), 'the placeholder id is gone').toBeUndefined();
    expect(await announcedSince(page, start.announced)).toEqual(['Renamed New node to Seat Worker; its id is now seat-worker.']);
    expect(await lastLabel(page)).toBe('Rename New node');
    await expectOneUndoStep(page, start);
  });

  test('an infrastructure node still named "New infrastructure node" does the same', async ({ page }) => {
    await openActions(page, { view: 'deployment production' });
    await dispatch(page, { op: 'addNode', environmentId: 'production', parentNodeId: 'campus-cloud', kind: 'infrastructure', name: 'New infrastructure node' });
    const start = await before(page);

    const result = await renameNode(page, 'new-infrastructure-node', 'Edge Firewall');

    expect(result).toMatchObject({ ok: true, nodeId: 'edge-firewall' });
    expect(nodeOf(await modelNow(page), 'edge-firewall')).toMatchObject({ name: 'Edge Firewall', kind: 'infrastructure', parentId: 'campus-cloud' });
    expect(await announcedSince(page, start.announced)).toEqual(['Renamed New infrastructure node to Edge Firewall; its id is now edge-firewall.']);
    await expectOneUndoStep(page, start);
  });

  test('a second rename keeps the id', async ({ page }) => {
    await openActions(page, { view: 'deployment production' });
    await dispatch(page, { op: 'addNode', environmentId: 'production', name: 'New node' });
    expect(await renameNode(page, 'new-node', 'Seat Worker'), 'precondition: the first rename gives the id').toMatchObject({ nodeId: 'seat-worker' });
    const start = await before(page);

    const result = await renameNode(page, 'seat-worker', 'Hold Worker');

    expect(result).toMatchObject({ ok: true, nodeId: 'seat-worker' });
    expect(nodeOf(await modelNow(page), 'seat-worker').name).toBe('Hold Worker');
    expect(await announcedSince(page, start.announced)).toEqual(['Renamed Seat Worker to Hold Worker.']);
  });

  test('a "New node" that another node links to keeps its id', async ({ page }) => {
    await openActions(page, { view: 'deployment production' });
    await dispatch(page, { op: 'addNode', environmentId: 'production', name: 'New node' });
    await dispatch(page, { op: 'setNodeLink', environmentId: 'production', nodeId: 'browser', targetNodeId: 'new-node', description: 'syncs drafts with' });
    const start = await before(page);

    const result = await renameNode(page, 'new-node', 'Seat Worker');

    expect(result).toMatchObject({ ok: true, nodeId: 'new-node' });
    const model = await modelNow(page);
    expect(nodeOf(model, 'new-node').name).toBe('Seat Worker');
    expect(nodeOf(model, 'browser').relationships.map((link) => link.targetId), 'the link still names it').toContain('new-node');
    expect(await announcedSince(page, start.announced)).toEqual(['Renamed New node to Seat Worker.']);
  });

  test('a "New node" with a link of its own to another node takes the id of its first name', async ({ page }) => {
    await openActions(page, { view: 'deployment production' });
    await dispatch(page, { op: 'addNode', environmentId: 'production', name: 'New node' });
    await dispatch(page, { op: 'setNodeLink', environmentId: 'production', nodeId: 'new-node', targetNodeId: 'ingress', description: 'sends jobs to' });

    const result = await renameNode(page, 'new-node', 'Seat Worker');

    expect(result).toMatchObject({ ok: true, nodeId: 'seat-worker' });
    expect(nodeOf(await modelNow(page), 'seat-worker').relationships.map((link) => link.targetId)).toEqual(['ingress']);
  });

  test('a "New node" whose only link to it is its own takes the id of its first name', async ({ page }) => {
    // The core refuses a link from a node to itself (link-self), so the hand-written YAML holds it.
    const added = C4.edit(C4.load(INTERFACES_REFERENCE), { op: 'addNode', environmentId: 'production', name: 'New node' }).text;
    const text = added.replace('      new-node:\n        name: New node\n',
      '      new-node:\n        name: New node\n        collaborators:\n          new-node: retries its own jobs through\n');
    expect(nodeOf(C4.load(text).model, 'new-node').relationships.map((link) => link.targetId), 'precondition: the node links to itself').toEqual(['new-node']);
    await openActions(page, { text, view: 'deployment production' });

    const result = await renameNode(page, 'new-node', 'Seat Worker');

    expect(result, 'no other node links to it').toMatchObject({ ok: true, nodeId: 'seat-worker' });
    expect(nodeOf(await modelNow(page), 'seat-worker').relationships.map((link) => link.targetId), 'its own link follows the id').toEqual(['seat-worker']);
  });

  test('a "New node" whose id a lock holds keeps its id, and its name still changes', async ({ page }) => {
    // A task gives the placeholder with its position and locks the layout, so a new id would change a locked part.
    const text = C4.edit(C4.load(INTERFACES_REFERENCE), {
      op: 'batch', commands: [
        { op: 'addNode', environmentId: 'production', name: 'New node' },
        { op: 'setUmlLayout', viewKey: 'deployment production', positions: { 'new-node': [600, 40] } },
      ],
    }).text;
    await openActions(page, { text, view: 'deployment production', lockedFields: ['layout'] });
    const start = await before(page);

    const result = await renameNode(page, 'new-node', 'Seat Worker');

    expect(result).toMatchObject({ ok: true, nodeId: 'new-node' });
    const model = await modelNow(page);
    expect(nodeOf(model, 'new-node').name).toBe('Seat Worker');
    expect(model.layout.get('deployment production').positions.get('new-node'), 'the locked position is untouched').toEqual([600, 40]);
    expect(await announcedSince(page, start.announced)).toEqual(['Renamed New node to Seat Worker.']);
  });

  test('the node form\'s Name field gives a "New node" the id of its first name', async ({ page }) => {
    const inspector = await openActions(page, { view: 'deployment production' });
    await dispatch(page, { op: 'addNode', environmentId: 'production', name: 'New node' });
    await expect(inspector.getByRole('heading', { name: 'Deployment node: New node' }), 'precondition: the node form is open').toBeVisible();
    const start = await before(page);

    const name = section(inspector, 'Basics').getByRole('textbox', { name: 'Name', exact: true });
    await name.fill('Seat Worker');
    await name.press('Enter');

    await expect(inspector.getByRole('heading', { name: 'Deployment node: Seat Worker' }), 'the form stays on the renamed node').toBeVisible();
    const model = await modelNow(page);
    expect(nodeOf(model, 'seat-worker')).toMatchObject({ name: 'Seat Worker' });
    expect(nodeOf(model, 'new-node')).toBeUndefined();
    expect(await announcedSince(page, start.announced)).toEqual(['Renamed New node to Seat Worker; its id is now seat-worker.']);
    await expectOneUndoStep(page, start);
  });
});

test.describe('the first rename of a provided interface', () => {
  test('the first rename of an interface still named "New interface" with the id new-interface gives it the id of its new name in one undo step', async ({ page }) => {
    await openActions(page, { view: 'interfaces of api' });
    expect(await dispatch(page, { op: 'addInterface', elementId: 'api', name: 'New interface' })).toMatchObject({ interfaceId: 'new-interface' });
    const start = await before(page);

    const result = await renameInterface(page, 'new-interface', 'Seat Availability');

    expect(result).toMatchObject({ ok: true, interfaceId: 'seat-availability' });
    const model = await modelNow(page);
    expect(model.interfaces.get('seat-availability')).toMatchObject({ name: 'Seat Availability', providerId: 'api' });
    expect(model.interfaces.has('new-interface'), 'the placeholder id is gone').toBe(false);
    expect(await announcedSince(page, start.announced)).toEqual(['Renamed New interface to Seat Availability; its id is now seat-availability.']);
    expect(await lastLabel(page)).toBe('Rename New interface');
    await expectOneUndoStep(page, start);
  });

  test('a second rename keeps the id', async ({ page }) => {
    await openActions(page, { view: 'interfaces of api' });
    await dispatch(page, { op: 'addInterface', elementId: 'api', name: 'New interface' });
    expect(await renameInterface(page, 'new-interface', 'Seat Availability'), 'precondition: the first rename gives the id')
      .toMatchObject({ interfaceId: 'seat-availability' });
    const start = await before(page);

    const result = await renameInterface(page, 'seat-availability', 'Seat Counts');

    expect(result).toMatchObject({ ok: true, interfaceId: 'seat-availability' });
    expect((await modelNow(page)).interfaces.get('seat-availability').name).toBe('Seat Counts');
    expect(await announcedSince(page, start.announced)).toEqual(['Renamed Seat Availability to Seat Counts.']);
  });

  test('an interface that a uses entry names keeps its id', async ({ page }) => {
    await openActions(page, { view: 'interfaces of api' });
    await dispatch(page, { op: 'addInterface', elementId: 'api', name: 'New interface' });
    await dispatch(page, { op: 'setUses', relationshipId: 'web->coordinator', uses: ['enrollment-api.submit-plan', 'new-interface'] });

    const result = await renameInterface(page, 'new-interface', 'Seat Availability');

    expect(result).toMatchObject({ ok: true, interfaceId: 'new-interface' });
    expect((await modelNow(page)).interfaces.get('new-interface').name).toBe('Seat Availability');
  });

  test('an interface that a stored view selector names keeps its id', async ({ page }) => {
    await openActions(page, { view: 'interfaces of api' });
    await dispatch(page, { op: 'addInterface', elementId: 'api', name: 'New interface' });
    await dispatch(page, { op: 'setTopLevelEntry', section: 'views', id: 'seat-card', value: { view: 'interface new-interface' } });

    const result = await renameInterface(page, 'new-interface', 'Seat Availability');

    expect(result).toMatchObject({ ok: true, interfaceId: 'new-interface' });
    expect((await modelNow(page)).interfaces.get('new-interface').name).toBe('Seat Availability');
  });

  test('an interface whose description card is the open view keeps its id', async ({ page }) => {
    await openActions(page, { view: 'interfaces of api' });
    await dispatch(page, { op: 'addInterface', elementId: 'api', name: 'New interface' });
    const opened = await page.evaluate(() => window.harness.state.openView('interface new-interface'));
    expect(opened.ok, 'precondition: its description card is open').toBe(true);

    const result = await renameInterface(page, 'new-interface', 'Seat Availability');

    expect(result).toMatchObject({ ok: true, interfaceId: 'new-interface' });
    expect((await modelNow(page)).interfaces.get('new-interface').name).toBe('Seat Availability');
  });

  test('an interface whose id a lock holds keeps its id', async ({ page }) => {
    // A task gives the placeholder with its technology locked, a path under the interface's id.
    const text = C4.edit(C4.load(INTERFACES_REFERENCE), { op: 'addInterface', elementId: 'api', name: 'New interface', technology: 'JSON/HTTPS' }).text;
    await openActions(page, { text, view: 'interfaces of api', lockedFields: [`${API_INTERFACE_PATH}.new-interface.technology`] });
    const start = await before(page);

    const result = await renameInterface(page, 'new-interface', 'Seat Availability');

    expect(result).toMatchObject({ ok: true, interfaceId: 'new-interface' });
    expect((await modelNow(page)).interfaces.get('new-interface')).toMatchObject({ name: 'Seat Availability', technology: 'JSON/HTTPS' });
    expect(await announcedSince(page, start.announced)).toEqual(['Renamed New interface to Seat Availability.']);
  });

  test('the interface form\'s Name field gives a "New interface" the id of its first name', async ({ page }) => {
    const inspector = await openActions(page, { view: 'interfaces of api' });
    await dispatch(page, { op: 'addInterface', elementId: 'api', name: 'New interface' });
    await page.evaluate(() => window.harness.state.select({ interfaceId: 'new-interface' }));
    await expect(inspector.getByRole('heading', { name: 'New interface' }), 'precondition: the interface form is open').toBeVisible();
    const start = await before(page);

    const name = section(inspector, 'Basics').getByRole('textbox', { name: 'Name', exact: true });
    await name.fill('Seat Availability');
    await name.press('Enter');

    await expect(inspector.getByRole('heading', { name: 'Seat Availability' }), 'the form stays on the renamed interface').toBeVisible();
    const model = await modelNow(page);
    expect(model.interfaces.get('seat-availability')).toMatchObject({ name: 'Seat Availability', providerId: 'api' });
    expect(model.interfaces.has('new-interface')).toBe(false);
    expect(await announcedSince(page, start.announced)).toEqual(['Renamed New interface to Seat Availability; its id is now seat-availability.']);
    await expectOneUndoStep(page, start);
  });
});

test.describe('the rename actions of nodes and interfaces', () => {
  test('renameNode and renameInterface refuse an empty name as renameElement does, and change nothing', async ({ page }) => {
    await openActions(page, { view: 'deployment production' });
    await dispatch(page, { op: 'addNode', environmentId: 'production', name: 'New node' });
    await dispatch(page, { op: 'addInterface', elementId: 'api', name: 'New interface' });
    const start = await before(page);

    const element = await renameElement(page, 'seats', '  ');
    const node = await renameNode(page, 'new-node', '   ');
    const declared = await renameInterface(page, 'new-interface', '');

    expect([element.ok, node.ok, declared.ok], 'all three refuse').toEqual([false, false, false]);
    // The same refusal, naming the thing that keeps its name.
    const asElement = (message, name) => message.replace(name, 'Seat Gateway');
    expect(asElement(node.message, 'New node')).toBe(element.message);
    expect(asElement(declared.message, 'New interface')).toBe(element.message);
    expect(await announcedSince(page, start.announced), 'each refusal is announced').toEqual([element.message, node.message, declared.message]);
    expect(await changeCount(page), 'nothing reached the host').toBe(start.changes);
    expect(await textNow(page)).toBe(start.text);
  });

  test('the node and interface forms after a first rename pass the audit at 320 and 1440 px in light and dark mode', async ({ page }) => {
    const inspector = await openActions(page, { view: 'deployment production', siteThemes: true });
    await dispatch(page, { op: 'addInterface', elementId: 'api', name: 'New interface' });
    await dispatch(page, { op: 'addNode', environmentId: 'production', name: 'New node' });
    const nodeName = section(inspector, 'Basics').getByRole('textbox', { name: 'Name', exact: true });
    await nodeName.fill('Seat Worker');
    await nodeName.press('Enter');
    await expect(inspector.getByRole('heading', { name: 'Deployment node: Seat Worker' })).toBeVisible();
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await auditInteractiveState(page, `node form after a first rename at ${width} px`, { include: '#editor' });
    }

    await page.evaluate(() => window.harness.state.select({ interfaceId: 'new-interface' }));
    const interfaceName = section(inspector, 'Basics').getByRole('textbox', { name: 'Name', exact: true });
    await interfaceName.fill('Seat Availability');
    await interfaceName.press('Enter');
    await expect(inspector.getByRole('heading', { name: 'Seat Availability' })).toBeVisible();
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await auditInteractiveState(page, `interface form after a first rename at ${width} px`, { include: '#editor' });
    }
  });
});

test.describe('model-wide wording', () => {
  test('a model-wide rename is announced once, with the model-wide sentence and undo label', async ({ page }) => {
    await openActions(page, { view: 'dynamic enroll' });
    const start = await before(page);

    const result = await renameElement(page, 'seats', 'Seat Store', { wording: 'model-wide' });

    expect(result).toMatchObject({ ok: true, elementId: 'seats' });
    const words = modelWideWording.rename('Seat Gateway', 'Seat Store', null);
    expect(words.message).toBe('Renamed Seat Gateway to Seat Store everywhere in the model.');
    expect(await announcedSince(page, start.announced)).toEqual([words.message]);
    expect(await lastLabel(page)).toBe(words.label);
    expect(words.label).toBe('Rename Seat Gateway everywhere in the model');
  });

  test('a model-wide first rename of an interface names its new id in the model-wide sentence', async ({ page }) => {
    await openActions(page, { view: 'interfaces of api' });
    await dispatch(page, { op: 'addInterface', elementId: 'api', name: 'New interface' });
    const start = await before(page);

    const result = await renameInterface(page, 'new-interface', 'Seat Availability', { wording: 'model-wide' });

    expect(result).toMatchObject({ ok: true, interfaceId: 'seat-availability' });
    const words = modelWideWording.rename('New interface', 'Seat Availability', 'seat-availability');
    expect(words.message).toBe('Renamed New interface to Seat Availability everywhere in the model; its id is now seat-availability.');
    expect(await announcedSince(page, start.announced)).toEqual([words.message]);
    expect(await lastLabel(page)).toBe(words.label);
  });

  test('a model-wide relationship addition says it is added to the model', async ({ page }) => {
    await openActions(page, { view: 'dynamic enroll' });
    const start = await before(page);

    const result = await page.evaluate(() => window.harness.actions.addRelationship(
      { sourceId: 'seats', targetId: 'web', description: 'pushes seat counts to', technology: 'WebSocket' }, { wording: 'model-wide' }));

    expect(result).toMatchObject({ ok: true, relationshipId: 'seats->web' });
    const words = modelWideWording.relationshipAddition('Seat Gateway', 'pushes seat counts to', 'Planner Web App', 'WebSocket');
    expect(words.message).toMatch(/ It is added to the model and appears in the C4 views of both elements\.$/);
    expect(await announcedSince(page, start.announced)).toEqual([words.message]);
    expect(await lastLabel(page)).toBe(words.label);
  });

  test('a model-wide delete of an element says so in its sentence and undo label', async ({ page }) => {
    await openActions(page);
    const start = await before(page);

    const result = await page.evaluate(() => window.harness.actions.deleteElement('UnitCapRule', { wording: 'model-wide' }));

    expect(result).toMatchObject({ ok: true });
    expect((await modelNow(page)).elements.has('UnitCapRule')).toBe(false);
    const words = modelWideWording.elementDeletion('UnitCapRule', 0);
    expect(await announcedSince(page, start.announced)).toEqual([words.message]);
    expect(await lastLabel(page)).toBe(words.label);
  });

  test('a model-wide delete of a relationship says so in its sentence and undo label', async ({ page }) => {
    await openActions(page);
    const start = await before(page);

    const result = await page.evaluate(() => window.harness.actions.deleteRelationship('seats->db', { wording: 'model-wide' }));

    expect(result).toMatchObject({ ok: true });
    expect((await modelNow(page)).relationships.some((relationship) => relationship.id === 'seats->db')).toBe(false);
    const words = modelWideWording.relationshipDeletion('\'writes seat holds to\' from Seat Gateway to Registration Database');
    expect(await announcedSince(page, start.announced)).toEqual([words.message]);
    expect(await lastLabel(page)).toBe(words.label);
  });

  test('without the option every result keeps today\'s words', async ({ page }) => {
    await openActions(page);
    const start = await before(page);

    await renameElement(page, 'seats', 'Seat Store');
    await page.evaluate(() => window.harness.actions.deleteElement('UnitCapRule'));
    await page.evaluate(() => window.harness.actions.deleteRelationship('seats->db'));
    await page.evaluate(() => window.harness.actions.addRelationship({ sourceId: 'seats', targetId: 'web', description: 'pushes seat counts to' }));

    expect(await announcedSince(page, start.announced)).toEqual([
      'Renamed Seat Gateway to Seat Store.',
      'Deleted UnitCapRule.',
      'Deleted \'writes seat holds to\' from Seat Store to Registration Database.',
      'Added: Seat Store pushes seat counts to Planner Web App.',
    ]);
    expect(await page.evaluate(() => window.harness.changes.map((change) => change.label))).toEqual([
      'Rename Seat Gateway',
      'Delete UnitCapRule',
      'Delete \'writes seat holds to\' from Seat Store to Registration Database',
      'Add a relationship from Seat Store',
    ]);
  });
});
