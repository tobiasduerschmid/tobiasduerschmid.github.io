// @ts-check
// The C4 editor inspector's supplementary forms (spec §9.1): scenarios (an ordered step list whose from/to pickers
// offer only steps that `ArchUMLC4.classifySteps` accepts, and fragments with guards), deployment environments and
// nodes (kind, technology, instances, hosts, nested nodes, node collaborators), the members of code elements, and the
// top-level records (decisions, requirements, groups, custom views). The page holds an editor root with the state, the
// actions module, and the inspector; the test selects through the state, as the outline and canvas do. Every edit is
// checked through the text the host receives (spec §3.4 `onTextChange`), read back with the C4 core.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { a11yCheckpoint } = require('./a11y-helpers');

const ARCHUML = path.resolve(__dirname, '../js/ArchUML');
const C4 = require(path.join(ARCHUML, 'c4/c4-core.js'));
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ARCHUML, 'c4/manifest.json'), 'utf8'));
// The modules the inspector works with, loaded explicitly (the integration step registers them in the manifest).
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
const REFERENCE = fs.readFileSync(path.join(ARCHUML, 'tests/c4/fixtures/course-registration.yml'), 'utf8');
const FEATURE = { feature: 'c4-editor' };

/** The reference model with one custom view and one top-level group, so their forms have something to edit. */
const WITH_RECORDS = REFERENCE.replace(/^decisions:/m, [
  'groups:',
  '  campus:',
  '    name: Campus systems',
  '',
  'views:',
  '  api-for-reviewers:',
  '    view: components of api',
  '    title: The API for reviewers',
  '',
  'decisions:',
].join('\n'));

/** The reference model with a second system of `count` containers in a chain, which the enroll scenario never uses. */
function withArchive(count) {
  const containers = Array.from({ length: count }, (unused, index) => [
    `      part-${index + 1}:`,
    `        name: Archive part ${index + 1}`,
    index + 1 < count ? `        collaborators:\n          part-${index + 2}: copies old records to` : null,
  ].filter(Boolean).join('\n'));
  return REFERENCE.replace(/^systems:\n/m, ['systems:', '  archive:', '    name: Archive', '    containers:'].concat(containers, ['']).join('\n'));
}

async function openInspector(page, { text = REFERENCE, view, select, profile = 'expert', lockedFields = [] }) {
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
    // Counts the step classifications the step pickers cost (spec §9.2): those the core makes while the forms ask it
    // for the ends of a step, through `ArchUMLC4.stepEnds` or its answer's `tosOf` and `problemOf`. The model checks
    // classify too, so a classification made outside those questions is not counted.
    let classifications = 0;
    let asking = 0;
    const whileAsking = (ask) => (...args) => {
      asking += 1;
      try {
        return ask(...args);
      } finally {
        asking -= 1;
      }
    };
    const projection = window.ArchUMLC4Parts.projection;
    const classifySteps = projection.classifySteps;
    projection.classifySteps = (...args) => {
      if (asking > 0) classifications += 1;
      return classifySteps(...args);
    };
    const stepEnds = window.ArchUMLC4.stepEnds;
    window.ArchUMLC4.stepEnds = whileAsking((...args) => {
      const ends = stepEnds(...args);
      return Object.assign({}, ends, { tosOf: whileAsking(ends.tosOf), problemOf: whileAsking(ends.problemOf) });
    });
    const texts = [];
    let clock = 0;
    const host = { onTextChange: (changed) => texts.push(changed), confirm: () => Promise.resolve(true) };
    const state = parts.state.createEditorState({
      text: settings.text, host, view: settings.view, profile: settings.profile, now: () => (clock += 1000),
    });
    const ids = parts.dom.idFactory('ed1');
    const announce = parts.dom.createAnnouncer(root);
    const options = { profile: settings.profile, scaffolds: {}, checks: {}, lockedFields: settings.lockedFields, readOnly: false };
    const actions = parts.actions.createActions(root, { state, dom: parts.dom, host, ids, announce, scaffolds: {} });
    parts.inspector.createInspector(document.getElementById('inspector'),
      { state, dom: parts.dom, ids, announce, host, options, actions, layout: { revealRegion: () => true } });
    state.select(settings.select);
    window.harness = { state, texts, classifications: () => classifications };
  }, { text, view, select, profile, lockedFields });
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

/** The sequence diagram text of a scenario in `text`, as the canvas draws it. */
function sequenceText(text, scenarioId) {
  return C4.toUml(C4.project(C4.load(text), `dynamic ${scenarioId}`)).text;
}

function section(inspector, name) {
  return inspector.getByRole('region', { name, exact: true });
}

async function optionLabels(select) {
  return select.locator('option').evaluateAll((options) => options.filter((option) => option.value !== '').map((option) => option.textContent));
}

test.describe('C4 editor inspector: scenarios', () => {
  test('adding an alt fragment with two guards to the enroll scenario renders an alt in the sequence diagram', async ({ page }) => {
    const inspector = await openInspector(page, { view: 'dynamic enroll', select: { scenarioId: 'enroll' } });
    await expect(inspector.getByRole('heading', { name: 'Scenario: Enroll in a planned schedule' })).toBeVisible();
    const insert = section(inspector, 'Steps').getByRole('group', { name: 'New fragment', exact: true });

    await insert.getByRole('combobox', { name: 'Fragment' }).selectOption('alt');
    await insert.getByRole('textbox', { name: 'Guard', exact: true }).fill('the plan has sections');
    await insert.getByRole('textbox', { name: 'Guard of the second branch' }).fill('the plan is empty');
    await insert.getByRole('button', { name: 'Insert fragment' }).click();

    await expect.poll(() => hostChanges(page), { message: 'the fragment and its guards arrive as one change' }).toBe(1);
    const uml = sequenceText(await currentText(page, REFERENCE), 'enroll');
    expect(uml).toContain('alt [the plan has sections]');
    expect(uml).toContain('else [the plan is empty]');
    await expect(section(inspector, 'Steps').getByRole('textbox', { name: 'Guard of branch 2 of step 4' }))
      .toHaveValue('the plan is empty');
  });

  test('the step target picker offers only collaborators that back a valid step', async ({ page }) => {
    const inspector = await openInspector(page, { view: 'dynamic enroll', select: { scenarioId: 'enroll' } });
    const newStep = section(inspector, 'Steps').getByRole('group', { name: 'New step', exact: true });

    await newStep.getByRole('combobox', { name: 'From' }).selectOption({ label: 'Registration Coordinator' });

    // Forward along its relationships, and the reply to the Planner Web App's still-open request; never the database
    // (no relationship of the coordinator reaches it) or the containers the coordinator lives in.
    await expect.poll(() => optionLabels(newStep.getByRole('combobox', { name: 'To' })))
      .toEqual(['Planner Web App', 'Enrollment Policy', 'Seat Gateway', 'Billing Gateway']);
  });

  test('the step target picker offers a reply only where the request it answers is still open', async ({ page }) => {
    const inspector = await openInspector(page, { view: 'dynamic enroll', select: { scenarioId: 'enroll' } });
    const newStep = section(inspector, 'Steps').getByRole('group', { name: 'New step', exact: true });

    await newStep.getByRole('combobox', { name: 'From' }).selectOption({ label: 'Planner Web App' });

    // The Student → Planner Web App relationship would let the web app answer the student, but no step of the
    // scenario asks it anything, so that reply is not offered.
    await expect.poll(() => optionLabels(newStep.getByRole('combobox', { name: 'To' })))
      .toEqual(['Registration API', 'Registration Coordinator']);
  });

  test('opening a scenario costs as many step classifications in a large model as in a small one', async ({ page }) => {
    // The pickers must stay cheap as models grow (spec §9.2): the work per step position may not multiply with the
    // number of element pairs, so a model with 40 more related containers costs no more classifications.
    const classificationsToOpen = async (text) => {
      const inspector = await openInspector(page, { text, view: 'dynamic enroll', select: { scenarioId: 'enroll' } });
      await expect(section(inspector, 'Steps').getByRole('group', { name: 'New step', exact: true })).toBeVisible();
      return page.evaluate(() => window.harness.classifications());
    };
    const large = withArchive(40);
    expect(C4.load(large).model.elements.size, 'the large model really has 41 more elements').toBe(C4.load(REFERENCE).model.elements.size + 41);

    const small = await classificationsToOpen(REFERENCE);
    expect(small, 'the step pickers of the small model are counted, so the comparison measures them').toBeGreaterThan(0);
    expect(await classificationsToOpen(large), 'classifications to open the scenario in the large model').toBe(small);
  });

  test('a step added from the pickers is written to the scenario and drawn as a message', async ({ page }) => {
    const inspector = await openInspector(page, { view: 'dynamic enroll', select: { scenarioId: 'enroll' } });
    const newStep = section(inspector, 'Steps').getByRole('group', { name: 'New step', exact: true });

    await newStep.getByRole('combobox', { name: 'From' }).selectOption({ label: 'Registration Coordinator' });
    await newStep.getByRole('combobox', { name: 'To' }).selectOption({ label: 'Planner Web App' });
    await newStep.getByRole('textbox', { name: 'Description' }).fill('confirms the enrollment to');
    await newStep.getByRole('button', { name: 'Add step' }).click();

    await expect.poll(() => hostChanges(page)).toBe(1);
    const steps = (await currentModel(page, REFERENCE)).scenarios.get('enroll').steps;
    expect(steps[steps.length - 1]).toMatchObject({ kind: 'message', from: 'coordinator', to: 'web', description: 'confirms the enrollment to' });
    expect(sequenceText(await currentText(page, REFERENCE), 'enroll')).toContain('coordinator --> web: confirms the enrollment to');
  });

  test('editing the guard of an existing branch rewrites only that guard', async ({ page }) => {
    const inspector = await openInspector(page, { view: 'dynamic enroll', select: { scenarioId: 'enroll' } });
    const guard = section(inspector, 'Steps').getByRole('textbox', { name: 'Guard of branch 2 of step 3' });

    await guard.fill('the student is not eligible');
    await guard.press('Enter');

    await expect.poll(() => hostChanges(page)).toBe(1);
    const text = await currentText(page, REFERENCE);
    expect(text).toBe(REFERENCE.replace('- when: not eligible', '- when: the student is not eligible'));
  });

  test('a branch added to an alt and then removed leaves the scenario as it was', async ({ page }) => {
    const inspector = await openInspector(page, { view: 'dynamic enroll', select: { scenarioId: 'enroll' } });
    const steps = section(inspector, 'Steps');

    await steps.getByRole('textbox', { name: 'Guard of a new branch of step 3' }).fill('the plan is on hold');
    await steps.getByRole('button', { name: 'Add a branch to step 3' }).click();
    await expect.poll(() => hostChanges(page)).toBe(1);
    expect(sequenceText(await currentText(page, REFERENCE), 'enroll')).toContain('else [the plan is on hold]');

    await steps.getByRole('button', { name: 'Remove branch 3 of step 3' }).click();
    await expect.poll(() => hostChanges(page)).toBe(2);
    expect(await currentText(page, REFERENCE)).toBe(REFERENCE);
  });

  test('Move up in a step\'s menu reorders the scenario\'s steps', async ({ page }) => {
    const inspector = await openInspector(page, { view: 'dynamic enroll', select: { scenarioId: 'enroll' } });

    await section(inspector, 'Steps').getByRole('button', { name: 'Actions for step 2', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Move up' }).click();

    await expect.poll(() => hostChanges(page)).toBe(1);
    const steps = (await currentModel(page, REFERENCE)).scenarios.get('enroll').steps;
    expect(steps.slice(0, 2).map((step) => `${step.from}->${step.to}`)).toEqual(['coordinator->policy', 'web->coordinator']);
    await expect(section(inspector, 'Steps').getByRole('button', { name: 'Actions for step 1', exact: true })).toBeFocused();
  });
});

test.describe('C4 editor inspector: deployment', () => {
  test('a deployment node hosts a container and a system', async ({ page }) => {
    const inspector = await openInspector(page, { view: 'deployment production', select: { environmentId: 'production', nodeId: 'api-pod' } });
    await expect(inspector.getByRole('heading', { name: 'Deployment node: API pod' })).toBeVisible();
    const hosts = section(inspector, 'Hosts');
    await expect(hosts.getByRole('checkbox', { name: 'Registration API' })).toBeChecked();

    await hosts.getByRole('checkbox', { name: 'Billing System' }).check();

    await expect.poll(() => hostChanges(page)).toBe(1);
    const model = await currentModel(page, REFERENCE);
    const hosted = model.environments.get('production').nodes.get('api-pod').hosts;
    expect(hosted.slice().sort()).toEqual(['api', 'billing']);
    expect(hosted.map((id) => model.elements.get(id).type).sort()).toEqual(['container', 'system']);
  });

  test('an infrastructure node offers no hosts and says why', async ({ page }) => {
    const inspector = await openInspector(page, { view: 'deployment production', select: { environmentId: 'production', nodeId: 'ingress' } });

    await expect(section(inspector, 'Hosts').getByRole('checkbox')).toHaveCount(0);
    await expect(section(inspector, 'Hosts')).toContainText('infrastructure');
  });

  test('a node collaborator is added with its target, description, and technology', async ({ page }) => {
    const inspector = await openInspector(page, { view: 'deployment production', select: { environmentId: 'production', nodeId: 'api-pod' } });
    const add = section(inspector, 'Node collaborators').getByRole('group', { name: 'New node collaborator' });

    await add.getByRole('combobox', { name: 'Target node' }).selectOption({ label: 'Managed database' });
    await add.getByRole('textbox', { name: 'Description' }).fill('reads and writes through');
    await add.getByRole('textbox', { name: 'Technology' }).fill('TCP');
    await add.getByRole('button', { name: 'Add node collaborator' }).click();

    await expect.poll(() => hostChanges(page)).toBe(1);
    const node = (await currentModel(page, REFERENCE)).environments.get('production').nodes.get('api-pod');
    expect(node.relationships).toEqual([expect.objectContaining({ targetId: 'postgres', description: 'reads and writes through', technology: 'TCP' })]);
  });

  test('the environment form renames the environment and lists its nodes as buttons that open them', async ({ page }) => {
    const inspector = await openInspector(page, { view: 'deployment production', select: { environmentId: 'production' } });
    const name = section(inspector, 'Basics').getByRole('textbox', { name: 'Name', exact: true });

    await name.fill('Production (fall term)');
    await name.press('Enter');
    await expect.poll(() => hostChanges(page)).toBe(1);
    expect((await currentModel(page, REFERENCE)).environments.get('production').name).toBe('Production (fall term)');

    await section(inspector, 'Nodes').getByRole('button', { name: 'Campus cloud' }).click();
    await expect(inspector.getByRole('heading', { name: 'Deployment node: Campus cloud' })).toBeVisible();
  });

  test('a node collaborator is removed with its button', async ({ page }) => {
    const inspector = await openInspector(page, { view: 'deployment production', select: { environmentId: 'production', nodeId: 'ingress' } });

    await section(inspector, 'Node collaborators').getByRole('button', { name: 'Remove the collaborator to API pod' }).click();

    await expect.poll(() => hostChanges(page)).toBe(1);
    expect((await currentModel(page, REFERENCE)).environments.get('production').nodes.get('ingress').relationships).toEqual([]);
    expect(await currentText(page, REFERENCE)).not.toContain('forwards HTTPS requests to');
  });

  test('a nested node is added inside the selected node', async ({ page }) => {
    const inspector = await openInspector(page, { view: 'deployment production', select: { environmentId: 'production', nodeId: 'laptop' } });
    const add = section(inspector, 'Nested nodes').getByRole('group', { name: 'New nested node' });

    await add.getByRole('textbox', { name: 'Name' }).fill('Phone browser');
    await add.getByRole('button', { name: 'Add nested node' }).click();

    await expect.poll(() => hostChanges(page)).toBe(1);
    const laptop = (await currentModel(page, REFERENCE)).environments.get('production').nodes.get('laptop');
    expect(laptop.childIds).toEqual(['browser', 'phone-browser']);
  });
});

test.describe('C4 editor inspector: code members', () => {
  test('an interface operation edited in the form appears in the code view', async ({ page }) => {
    const inspector = await openInspector(page, { view: 'code of policy', select: 'EnrollmentRule' });
    const operation = section(inspector, 'Members').getByRole('textbox', { name: 'Operation 1', exact: true });

    await operation.fill('+ evaluate(student, section, term): RuleResult');
    await operation.press('Enter');

    await expect.poll(() => hostChanges(page)).toBe(1);
    const uml = C4.toUml(C4.project(C4.load(await currentText(page, REFERENCE)), 'code of policy')).text;
    expect(uml).toMatch(/interface EnrollmentRule \{\n {2}\+ evaluate\(student, section, term\): RuleResult\n\}/);
  });

  test('checking Implements writes the realization drawn in the code view', async ({ page }) => {
    const inspector = await openInspector(page, { view: 'code of policy', select: 'EnrollmentPolicy' });

    await section(inspector, 'Members').getByRole('group', { name: 'Implements' }).getByRole('checkbox', { name: 'EnrollmentRule' }).check();

    await expect.poll(() => hostChanges(page)).toBe(1);
    const uml = C4.toUml(C4.project(C4.load(await currentText(page, REFERENCE)), 'code of policy')).text;
    expect(uml).toContain('EnrollmentPolicy ..|> EnrollmentRule');
  });
});

test.describe('C4 editor inspector: top-level records', () => {
  test('a decision\'s status and consequences are written to the decision', async ({ page }) => {
    const inspector = await openInspector(page, { view: 'containers of registration', select: { decisionId: 'one-database' } });
    await expect(inspector.getByRole('heading', { name: 'Decision: Keep plans and seat holds in one relational database' })).toBeVisible();

    await inspector.getByRole('combobox', { name: 'Status' }).selectOption('superseded');
    await expect.poll(() => hostChanges(page)).toBe(1);
    const consequences = inspector.getByRole('textbox', { name: 'Consequences' });
    await consequences.fill('The database is a single point of failure; a replica is planned.');
    await consequences.blur();

    await expect.poll(() => hostChanges(page)).toBe(2);
    const decision = (await currentModel(page, REFERENCE)).decisions.get('one-database');
    expect(decision).toMatchObject({ status: 'superseded', consequences: 'The database is a single point of failure; a replica is planned.',
      affects: ['db', 'seats'] });
  });

  test('a requirement keeps the shorthand until it gets a kind', async ({ page }) => {
    const inspector = await openInspector(page, { view: 'containers of registration', select: { requirementId: 'FR-09' } });

    await inspector.getByRole('combobox', { name: 'Kind' }).selectOption('quality');

    await expect.poll(() => hostChanges(page)).toBe(1);
    const requirement = (await currentModel(page, REFERENCE)).requirements.get('FR-09');
    expect(requirement).toMatchObject({ text: 'A student is enrolled in every section of a plan, or in none.', kind: 'quality' });
  });

  test('a group\'s name is edited in the group form', async ({ page }) => {
    const inspector = await openInspector(page, { text: WITH_RECORDS, view: 'landscape', select: { groupId: 'campus', scopeId: null } });
    const name = inspector.getByRole('textbox', { name: 'Name' });

    await name.fill('University systems');
    await name.press('Enter');

    await expect.poll(() => hostChanges(page)).toBe(1);
    expect((await currentModel(page, WITH_RECORDS)).groups.get('/campus').name).toBe('University systems');
  });

  test('a custom view\'s title and derived edges are edited in the view form', async ({ page }) => {
    const inspector = await openInspector(page, { text: WITH_RECORDS, view: 'landscape', select: { viewId: 'api-for-reviewers' } });

    await inspector.getByRole('checkbox', { name: 'Show derived relationships' }).uncheck();

    await expect.poll(() => hostChanges(page)).toBe(1);
    const view = (await currentModel(page, WITH_RECORDS)).views.get('api-for-reviewers');
    expect(view).toMatchObject({ view: 'components of api', title: 'The API for reviewers', derived: false });
  });
});

test.describe('C4 editor inspector: supplementary forms and locks', () => {
  test('a locked scenario is read-only and offers no step commands', async ({ page }) => {
    const inspector = await openInspector(page, { view: 'dynamic enroll', select: { scenarioId: 'enroll' }, lockedFields: ['scenarios.enroll'] });
    const steps = section(inspector, 'Steps');

    await expect(steps.getByRole('group', { name: 'New step', exact: true })).toHaveCount(0);
    await expect(steps.getByRole('button', { name: /^Actions for step/ })).toHaveCount(0);
    await expect(steps.getByRole('textbox', { name: 'Description of step 1', exact: true })).toHaveAttribute('readonly', '');
    await expect(steps.getByText('Locked: given by the task').first()).toBeVisible();
  });

  test('a lock on one branch removes every Remove branch button, since removing renumbers the branches', async ({ page }) => {
    const inspector = await openInspector(page, { view: 'dynamic enroll', select: { scenarioId: 'enroll' },
      lockedFields: ['scenarios.enroll.steps.2.alt.1'] });
    const steps = section(inspector, 'Steps');

    await expect(steps.getByRole('textbox', { name: 'Guard of branch 2 of step 3' })).toHaveAttribute('readonly', '');
    await expect(steps.getByRole('button', { name: /^Remove branch \d of step 3$/ })).toHaveCount(0);
    await expect(steps.getByRole('textbox', { name: 'Guard of branch 1 of step 3' })).not.toHaveAttribute('readonly', '');
  });

  test('a lock on an alt\'s branch list removes Add a branch, since adding changes the locked list', async ({ page }) => {
    const inspector = await openInspector(page, { view: 'dynamic enroll', select: { scenarioId: 'enroll' },
      lockedFields: ['scenarios.enroll.steps.2.alt'] });
    const steps = section(inspector, 'Steps');

    await expect(steps.getByRole('textbox', { name: 'Guard of branch 1 of step 3' })).toHaveAttribute('readonly', '');
    await expect(steps.getByRole('button', { name: 'Add a branch to step 3' })).toHaveCount(0);
    await expect(steps.getByRole('group', { name: 'New step', exact: true }), 'the scenario\'s own list stays open').toBeVisible();
  });

  test('a wildcard lock on every branch guard removes Add a branch, since the new branch\'s guard would be locked', async ({ page }) => {
    const inspector = await openInspector(page, { view: 'dynamic enroll', select: { scenarioId: 'enroll' },
      lockedFields: ['scenarios.enroll.steps.2.alt.*.when'] });
    const steps = section(inspector, 'Steps');

    await expect(steps.getByRole('textbox', { name: 'Guard of branch 2 of step 3' })).toHaveAttribute('readonly', '');
    await expect(steps.getByRole('button', { name: 'Add a branch to step 3' })).toHaveCount(0);
    await expect(steps.getByRole('textbox', { name: 'Guard of a new branch of step 3' })).toHaveCount(0);
    await expect(steps.getByRole('group', { name: 'New step', exact: true }), 'the scenario\'s own list stays open').toBeVisible();
  });

  test('a lock on one existing branch guard keeps Add a branch, since the new branch is not locked', async ({ page }) => {
    const inspector = await openInspector(page, { view: 'dynamic enroll', select: { scenarioId: 'enroll' },
      lockedFields: ['scenarios.enroll.steps.2.alt.0.when'] });
    const steps = section(inspector, 'Steps');

    await expect(steps.getByRole('textbox', { name: 'Guard of branch 1 of step 3' })).toHaveAttribute('readonly', '');
    await expect(steps.getByRole('button', { name: 'Add a branch to step 3' })).toBeVisible();
    await expect(steps.getByRole('textbox', { name: 'Guard of a new branch of step 3' })).toBeEditable();
  });

  test('a lock on one hosted element freezes every Hosts checkbox, since each toggle rewrites the list', async ({ page }) => {
    const inspector = await openInspector(page, { view: 'deployment production', select: { environmentId: 'production', nodeId: 'api-pod' },
      lockedFields: ['deployment.production.nodes.campus-cloud.nodes.api-pod.hosts.0'] });
    const hosts = section(inspector, 'Hosts');

    await expect(hosts.getByRole('checkbox', { name: 'Registration API' })).toBeDisabled();
    await expect(hosts.getByRole('checkbox', { name: 'Billing System' })).toBeDisabled();
    await expect(hosts.getByText(/^Locked: given by the task/).first()).toBeVisible();
    await expect(section(inspector, 'Basics').getByRole('textbox', { name: 'Technology' }), 'the node itself stays editable').toBeEditable();
  });

  test('a lock on one node collaborator removes its Remove button', async ({ page }) => {
    const inspector = await openInspector(page, { view: 'deployment production', select: { environmentId: 'production', nodeId: 'ingress' },
      lockedFields: ['deployment.production.nodes.campus-cloud.nodes.ingress.collaborators.api-pod'] });
    const links = section(inspector, 'Node collaborators');

    await expect(links.getByRole('textbox', { name: 'Description of the link to API pod' })).toHaveAttribute('readonly', '');
    await expect(links.getByRole('button', { name: 'Remove the collaborator to API pod' })).toHaveCount(0);
  });

  for (const theme of ['light', 'dark']) {
    test(`the scenario form is accessible in ${theme} mode`, async ({ page }) => {
      await openInspector(page, { view: 'dynamic enroll', select: { scenarioId: 'enroll' } });
      if (theme === 'dark') await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
      await a11yCheckpoint(page, `c4-editor-supplementary-scenario-${theme}`, FEATURE);
      const paragraph = await page.locator('main > p').evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
      const guard = await page.getByRole('textbox', { name: 'Guard of branch 1 of step 3' })
        .evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
      expect(guard, 'a guard field reads at paragraph size').toBeGreaterThanOrEqual(paragraph);
    });
  }
});
