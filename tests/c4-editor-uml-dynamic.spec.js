// @ts-check
// The dynamic view `dynamic enroll` edited end to end on the C4 editor (UML-view editing spec §5.3, §7.3–§7.7; plan
// Task 45): what the options say about each lifeline and step; the step and fragment forms that confirm every new step
// and fragment, on every path (a drag, the pointer alone, the keyboard alone), each as one undo step announced with its
// place, and Escape adding nothing; a step dragged to another place, and a dragged step a lock refuses put back where it
// was; moving steps and lifelines without a drag; a selected step's row in the scenario
// form; focus after the forms and across a redraw; two editors on one page, each with its own forms; and the
// accessibility of a message being drawn and of both forms.
//
// Pages come from tests/helpers/c4-uml-editing.js. Facts about the model come from the C4 core, and every place label,
// announcement, and refusal is compared with the function that owns its words: the dynamic view module
// (c4-editor-uml-dynamic.js) for places and results, the refusal table for refusals. Drawing coordinates are read from
// the session's hit layer (`uml-pg-edit-layer`, `uml-pg-edit-hitbox`, `uml-pg-edge-hitbox`) and the bundle's
// `UMLShared.renderedLayoutBox`; target marks by `uml-pg-target-mark` and their state classes: spec §3.7 keeps these as
// the module's contract.
const { test, expect } = require('@playwright/test');
const { auditInteractiveState } = require('./a11y-helpers');
const {
  C4, INTERFACES_REFERENCE, openUmlEditor, openTwoUmlEditors, hostLog, canvas, elements, option, messageRegion,
} = require('./helpers/c4-uml-editing.js');
const dynamicView = require('../js/ArchUML/c4/editor/c4-editor-uml-dynamic.js');
const refusalTable = require('../js/ArchUML/c4/editor/c4-editor-uml-refusals.js');
const { createEditorState } = require('../js/ArchUML/c4/editor/c4-editor-state.js');

const VIEW = 'dynamic enroll';
const SCENARIO = 'enroll';
const HIT_LAYER = '.uml-pg-edit-layer';
// The drawing is wide: on a wide screen every lifeline is in view at the editor's first magnification.
const WIDE = { width: 1920, height: 1080 };

// A model whose scenario has one step of each kind an arrow can show (C4 spec §6.3): a call along a relationship, an
// asynchronous message along a `message` connector, a delivery from a queue back along its reader's relationship, and
// a reply to the open call.
const STEP_KINDS = `schema: c4-design/1
name: Shop
systems:
  shop:
    name: Shop
    description: Sells books online.
    containers:
      web: {name: Web Shop, description: Takes orders., collaborators: {orders: places orders through}}
      orders:
        name: Order Service
        description: Records orders.
        collaborators:
          events: {description: publishes order events to, connector: message}
      events: {name: Order Events, description: Carries order events., kind: queue}
      mailer: {name: Mailer, description: Mails receipts., collaborators: {events: reads order events from}}
scenarios:
  order:
    title: Place an order
    steps:
      - web -> orders: places the order through
      - orders -> events: publishes an order event to
      - events -> mailer: delivers the order event to
      - orders -> web: confirms the order to
`;

// ---- Facts from the model and from the view module that owns the words -------------------------------------------

const textOf = (page, rootId = 'editor') => page.evaluate((id) => window.c4Editors[id].getText(), rootId);

/** What the dynamic view module reads of `view` drawn from `text` (plan Task 34's context). */
function contextOf(text, view = VIEW, profile = 'novice') {
  const design = C4.load(text);
  const viewModel = C4.project(design, view);
  return { design, viewModel, uml: C4.toUml(viewModel), profile, checksReleased: true, layout: viewModel.layout };
}

/** The drawn line of the step at `position` (`{ containerPath, index }`) in `view` of `text`. */
function lineOfStep(text, position, view = VIEW) {
  const { uml } = contextOf(text, view);
  const line = uml.source.lines.findIndex((entry) => entry && (entry.kind === 'message' || entry.kind === 'fragment')
    && entry.index === position.index && JSON.stringify(entry.containerPath) === JSON.stringify(position.containerPath));
  if (line < 0) throw new Error(`no drawn step at ${JSON.stringify(position)}`);
  return line;
}

/** The scenario's steps in a short form: "from -> to: description", and fragments with their branches. */
function brief(steps) {
  return steps.map((step) => (step.kind === 'fragment'
    ? { [step.operator]: step.branches.map((branch) => ({ when: branch.when, steps: brief(branch.steps) })) }
    : `${step.from} -> ${step.to}: ${step.description}`));
}
const stepsOf = (text, scenario = SCENARIO) => brief(C4.load(text).model.scenarios.get(scenario).steps);

/** The step-form answer the module turns into `addStep`, and that plan: what the form and the canvas must produce. */
function addedStep(text, { from, to, position, description }) {
  const context = contextOf(text);
  const form = dynamicView.plan({ op: 'relation.add', tool: 'message', from, to, label: null, at: position }, context);
  return dynamicView.fromForm('step', Object.assign({}, form.initial, { description }), context);
}

/** Applies `plan`'s commands to `text` with the core, as the editor does in one batch. */
function applied(text, plan) {
  const result = C4.edit(C4.load(text), { op: 'batch', commands: plan.commands });
  if (result.error) throw new Error(result.message);
  return result.text;
}

/** The label of the insertion place at `position` in `view` of `text`, as the module words it. */
function placeLabel(text, position) {
  const ref = `seqmsg:${lineOfStep(text, { containerPath: [], index: 0 })}`;
  const place = dynamicView.places(ref, contextOf(text)).find((each) => samePosition(each.position, position));
  return place ? place.label : dynamicView.plan({ op: 'relation.add', tool: 'message', from: 'web', to: 'coordinator', at: position },
    contextOf(text)).initial.places.find((each) => samePosition(each.position, position)).label;
}

function samePosition(a, b) {
  return a.index === b.index && JSON.stringify(a.containerPath) === JSON.stringify(b.containerPath);
}

// ---- The page ----------------------------------------------------------------------------------------------------

/** Waits until the host of `rootId` heard exactly `count` changes (one per undo step) and returns the last text. */
async function changes(page, count, message, rootId = 'editor') {
  await expect.poll(() => page.evaluate((id) => window.c4HostLogs[id].texts.length, rootId), { message }).toBe(count);
  return page.evaluate((id) => window.c4HostLogs[id].texts.at(-1), rootId);
}

const palette = (editor) => editor.getByRole('group', { name: 'Add to the diagram', exact: true });
const tool = (editor, name) => palette(editor).getByRole('button', { name, exact: true });
/**
 * Opens the step form from the palette's Message tool with the keyboard. With lifelines drawn, a pointer click on the
 * tool arms it for drawing (spec §7.4, §7.5); Enter on the tool opens the form at the focus.
 */
async function openStepFormWithTool(editor) {
  await tool(editor, 'Message').focus();
  await editor.page().keyboard.press('Enter');
}
const stepForm = (editor, title = 'Add a step') => editor.getByRole('dialog', { name: title, exact: true });
const fragmentForm = (editor, title = 'Add a fragment') => editor.getByRole('dialog', { name: title, exact: true });
const menu = (editor, name) => editor.getByRole('menu', { name, exact: true });
const menuItem = (editor, menuName, name) => menu(editor, menuName).getByRole('menuitem', { name, exact: true });
const inspector = (editor) => editor.getByRole('region', { name: 'Inspector' });
/** The option of step `n` of the drawn scenario ("Step 2: Registration Coordinator to Enrollment Policy"). */
const stepOption = (editor, n) => elements(editor).getByRole('option', { name: new RegExp(`^Step ${n}: `) });

/** The client centre of the hit target of lifeline `alias`, or the client point of its lifeline at client height `y`. */
function lifelinePoint(editor, alias, y = null) {
  return canvas(editor).evaluate((region, { layer, id, height }) => {
    const target = region.querySelector(`${layer} .uml-pg-edit-hitbox[data-layout-id="${id}"]`);
    target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const box = target.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: height === null ? box.top + box.height / 2 : height };
  }, { layer: HIT_LAYER, id: alias, height: y });
}

/** The client y of the drawn message on line `line`. */
function messageY(editor, line) {
  return canvas(editor).evaluate((region, { layer, id }) => {
    const segment = region.querySelector(`${layer} .uml-pg-edge-hitbox[data-route-id="${id}"]`);
    const box = segment.getBoundingClientRect();
    return box.top + box.height / 2;
  }, { layer: HIT_LAYER, id: `seqmsg:${line}` });
}

/** The client centre of the drawn message on line `line`, where a press starts a drag of the message. */
function messageCentre(editor, line) {
  return canvas(editor).evaluate((region, { layer, id }) => {
    const segment = region.querySelector(`${layer} .uml-pg-edge-hitbox[data-route-id="${id}"]`);
    const box = segment.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  }, { layer: HIT_LAYER, id: `seqmsg:${line}` });
}

/** Where the drawing puts the message on line `line`: the drawing-unit y of its segment's start. */
function messageDrawnAt(editor, line) {
  return canvas(editor).evaluate((region, { layer, id }) => Number(region
    .querySelector(`${layer} .uml-pg-edge-hitbox[data-route-id="${id}"]`).getAttribute('y1')), { layer: HIT_LAYER, id: `seqmsg:${line}` });
}

/** The client y of the bottom of the drawn fragment on line `line` (the lower edge of its frame). */
function fragmentBottom(editor, line) {
  return canvas(editor).evaluate((region, id) => {
    const svg = region.querySelector('.c4-editor__diagram svg');
    const fragment = window.ArchUMLDiagramEditorParts.scene.findRenderedFragments(svg).find((each) => each.id === id);
    const frame = fragment.frameBox;
    return new DOMPoint(frame.x, frame.y + frame.height).matrixTransform(svg.getScreenCTM()).y;
  }, `frag:${line}`);
}

/** A press on the drawn message on line `line`, dragged straight up or down to client height `y`, and released. */
async function dragMessage(editor, line, y) {
  const page = editor.page();
  const from = await messageCentre(editor, line);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x, y, { steps: 10 });
  await page.mouse.up();
}

/** The client y of the top of the drawn fragment on line `line` (its frame, where its operator label sits). */
function fragmentTop(editor, line) {
  return canvas(editor).evaluate((region, id) => {
    const svg = region.querySelector('.c4-editor__diagram svg');
    const fragment = window.ArchUMLDiagramEditorParts.scene.findRenderedFragments(svg).find((each) => each.id === id);
    return new DOMPoint(fragment.labelBox.x, fragment.labelBox.y).matrixTransform(svg.getScreenCTM()).y;
  }, `frag:${line}`);
}

/** The client y of the drawn step at `position` in the drawing of `text`: a message's line, a fragment's top. */
function stepY(editor, text, position) {
  const line = lineOfStep(text, position);
  return contextOf(text).uml.source.lines[line].kind === 'fragment' ? fragmentTop(editor, line) : messageY(editor, line);
}

/** The height halfway between the drawn steps at `above` and `below` (positions in the drawing of `text`). */
async function heightBetween(editor, text, above, below) {
  return ((await stepY(editor, text, above)) + (await stepY(editor, text, below))) / 2;
}

/** The marks drawn now over the lifelines: `{ ref, possible, struck, dashed, shown }` each, in the drawing's order. */
function targetMarks(editor) {
  return canvas(editor).locator('.uml-pg-target-mark').evaluateAll((marks) => marks.map((mark) => {
    const outline = getComputedStyle(mark.querySelector('.uml-pg-target-mark-outline'));
    return {
      ref: mark.getAttribute('data-target-ref'),
      possible: mark.classList.contains('is-possible'),
      struck: mark.querySelector('.uml-pg-target-mark-sign') !== null,
      dashed: outline.strokeDasharray !== 'none',
      shown: outline.display !== 'none' && outline.visibility !== 'hidden' && outline.stroke !== 'none',
    };
  }));
}

/** Fills the open step form's Description with `description` and confirms it. */
async function confirmStep(editor, description, title = 'Add a step') {
  const form = stepForm(editor, title);
  await form.getByRole('textbox', { name: 'Description' }).fill(description);
  await form.getByRole('button', { name: title === 'Add a step' ? 'Add the step' : 'Save the step' }).click();
  await expect(form).toHaveCount(0);
}

const STEP_2 = { containerPath: [], index: 1 };
const ALT = { containerPath: [], index: 2 };

// ---- What the options say (spec §7.3) ----------------------------------------------------------------------------

test.describe('what the options say', () => {
  test.use({ viewport: WIDE });

  test('a call, a reply, an asynchronous message, and a delivery each say so in their option', async ({ page }) => {
    const editor = await openUmlEditor(page, { text: STEP_KINDS, view: 'dynamic order' });
    const described = [
      ['Step 1: Web Shop to Order Service', /^call; /],
      ['Step 2: Order Service to Order Events', /^asynchronous message; /],
      ['Step 3: Order Events to Mailer', /^delivery; /],
      ['Step 4: Order Service to Web Shop', /^reply; /],
    ];
    for (const [name, words] of described) await expect(option(editor, name), name).toHaveAccessibleDescription(words);
  });

  test('a step in a branch names its fragment, branch, and guard', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW });
    await expect(stepOption(editor, 3)).toHaveAccessibleDescription(/; in alt, branch 1: eligible;/);
    await expect(stepOption(editor, 5)).toHaveAccessibleDescription(/; in alt, branch 2: not eligible;/);
  });

  test('an invalid step\'s option names its problem count when diagnostics are shown', async ({ page }) => {
    // The teammate's draft of the C4 tutorial's step 8 in this model: the Seat Gateway reports straight to the web app,
    // which no relationship backs and no request asked for (xlevel/scenario-step).
    const text = INTERFACES_REFERENCE.replace('              - coordinator -> web: reports the refusal and its reason to',
      '              - seats -> web: reports the refusal and its reason to');
    const editor = await openUmlEditor(page, { text, view: VIEW });
    await expect(stepOption(editor, 5)).toHaveAccessibleDescription(/^invalid step; .*; 1 problem;/);
    await expect(stepOption(editor, 4)).not.toHaveAccessibleDescription(/problem/);
  });

  test('a lifeline says "lifeline 2 of 5" and "in Registration API"', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW });
    await expect(option(editor, 'Registration Coordinator')).toHaveAccessibleDescription(/^lifeline 2 of 5; in Registration API;/);
  });

  test('while a message is drawn, possible and other lifelines carry their two marks in both themes', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW, siteThemes: true });
    const advice = dynamicView.targets({ op: 'relation.add', from: 'web', to: null, open: 'to' }, contextOf(INTERFACES_REFERENCE));
    await option(editor, 'Planner Web App').focus();
    await page.keyboard.press('c');

    for (const theme of ['light', 'dark']) {
      if (theme === 'dark') await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
      await expect.poll(() => targetMarks(editor), { message: `the marks in ${theme} mode` }).toEqual(advice.map((each) => ({
        ref: each.ref, possible: each.ok, struck: !each.ok, dashed: each.ok, shown: true,
      })));
    }
    expect(advice.filter((each) => each.ok).map((each) => each.ref), 'the advice marks the coordinator possible').toEqual(['coordinator']);
  });
});

// ---- The step form (spec §5.3) -----------------------------------------------------------------------------------

test.describe('the step form', () => {
  test.use({ viewport: WIDE });

  test('the step form\'s Position select lists every place, and choosing one adds the step there', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW });
    await openStepFormWithTool(editor);
    const form = stepForm(editor);
    const places = dynamicView.plan({ op: 'element.add', tool: 'message' }, contextOf(INTERFACES_REFERENCE)).initial.places;
    const position = form.getByRole('combobox', { name: 'Position' });
    await expect(position.getByRole('option')).toHaveText(places.map((place) => place.label));

    await form.getByRole('combobox', { name: 'Sender' }).selectOption({ label: 'Planner Web App' });
    await form.getByRole('combobox', { name: 'Receiver' }).selectOption({ label: 'Registration Coordinator' });
    const chosen = places.find((place) => samePosition(place.position, ALT));
    await position.selectOption({ label: chosen.label });
    await confirmStep(editor, 'asks for the plan\'s status from');

    const written = await changes(page, 1, 'the step is one change');
    expect(written).toBe(applied(INTERFACES_REFERENCE, addedStep(INTERFACES_REFERENCE,
      { from: 'web', to: 'coordinator', position: ALT, description: 'asks for the plan\'s status from' })));
  });

  test('choosing another connector in the step form shows the warning, and its button opens the relationship', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW });
    await option(editor, 'Planner Web App').focus();
    await page.keyboard.press('c');
    await option(editor, 'Registration Coordinator').focus();
    await page.keyboard.press('Enter');
    const form = stepForm(editor);
    const connector = form.getByRole('combobox', { name: 'Connector' });
    await expect(connector).toHaveValue('');
    await expect(connector.locator('option:checked')).toHaveText('Follows the relationship: call');

    await connector.selectOption('message');
    const initial = dynamicView.plan({ op: 'relation.add', tool: 'message', from: 'web', to: 'coordinator' }, contextOf(INTERFACES_REFERENCE)).initial;
    await expect(form.getByText(initial.connector.warnings.message)).toBeVisible();
    await form.getByRole('button', { name: 'Open the relationship' }).click();

    await expect(form).toHaveCount(0);
    await expect.poll(async () => (await hostLog(page)).selections.at(-1)).toEqual({ relationshipId: initial.connector.relationshipId });
    expect(await textOf(page), 'nothing was written').toBe(INTERFACES_REFERENCE);
  });

  test('after confirming the step form focus is on the new step\'s option, and after Escape ("No step added.") on the control that started it', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW });
    await openStepFormWithTool(editor);
    await expect(stepForm(editor)).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(stepForm(editor)).toHaveCount(0);
    await expect(messageRegion(editor)).toContainText('No step added.');
    await expect(tool(editor, 'Message'), 'focus returns to the tool that opened the form').toBeFocused();
    expect((await hostLog(page)).texts).toEqual([]);

    await option(editor, 'Planner Web App').focus();
    await page.keyboard.press('c');
    await option(editor, 'Registration Coordinator').focus();
    await page.keyboard.press('Enter');
    await confirmStep(editor, 'asks for the plan\'s status from');
    await changes(page, 1, 'the step is one change');
    // The new step is the last of the scenario: step 6.
    await expect(stepOption(editor, 6)).toBeFocused();
  });

  test('typing in the scenario form while dynamic enroll is open keeps focus in the field across the redraw', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW });
    await page.evaluate(() => window.c4Editors.editor.select({ scenarioId: 'enroll' }));
    const field = inspector(editor).getByRole('textbox', { name: 'Description of step 2', exact: true });
    await field.focus();
    await field.evaluate((input) => input.setSelectionRange(input.value.length, input.value.length));

    await page.keyboard.type(' first');
    await page.keyboard.press('Enter');

    await changes(page, 1, 'the typed text is one change');
    expect(stepsOf(await textOf(page))[1]).toBe('coordinator -> policy: asks for an eligibility decision from first');
    await expect(field).toBeFocused();
  });
});

// ---- The paths of spec §7.4, each one undo step announced with its place (WCAG 2.5.7, 2.1.1) ---------------------

test.describe('a new step and a new fragment on every path', () => {
  test.use({ viewport: WIDE });

  test('pointer only, Message, then web\'s lifeline, then coordinator\'s lifeline at the height between steps 2 and 3 opens the step form at "after step 2", and confirming adds the step there', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW });
    // The height between step 2 and the alt that holds step 3: the place after step 2.
    const height = await heightBetween(editor, INTERFACES_REFERENCE, STEP_2, ALT);
    await tool(editor, 'Message').click();
    const web = await lifelinePoint(editor, 'web', height);
    await page.mouse.click(web.x, web.y);
    const coordinator = await lifelinePoint(editor, 'coordinator', height);
    await page.mouse.click(coordinator.x, coordinator.y);

    const form = stepForm(editor);
    await expect(form.getByRole('combobox', { name: 'Position' }).locator('option:checked')).toHaveText(placeLabel(INTERFACES_REFERENCE, ALT));
    await confirmStep(editor, 'asks for the plan\'s status from');

    const plan = addedStep(INTERFACES_REFERENCE, { from: 'web', to: 'coordinator', position: ALT, description: 'asks for the plan\'s status from' });
    expect(await changes(page, 1, 'one undo step')).toBe(applied(INTERFACES_REFERENCE, plan));
    await expect(messageRegion(editor)).toContainText(plan.message);
  });

  test('keyboard only, C on a lifeline opens the step form at the end of the scenario, and C on step 2 opens it after step 2', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW });
    const end = C4.toUml(C4.project(C4.load(INTERFACES_REFERENCE), VIEW)).source.scenarioEnd;

    await option(editor, 'Planner Web App').focus();
    await page.keyboard.press('c');
    await option(editor, 'Registration Coordinator').focus();
    await page.keyboard.press('Enter');
    await expect(stepForm(editor).getByRole('combobox', { name: 'Position' }).locator('option:checked'))
      .toHaveText(placeLabel(INTERFACES_REFERENCE, end));
    await page.keyboard.press('Escape');
    await expect(stepForm(editor)).toHaveCount(0);

    // Closing the form hands focus back to the lifeline that was focused when it opened; wait for that before
    // moving on, or the hand-back would take focus off step 2 again.
    await expect(option(editor, 'Registration Coordinator')).toBeFocused();

    await stepOption(editor, 2).focus();
    await expect(stepOption(editor, 2)).toBeFocused();
    await page.keyboard.press('c');
    await expect(stepForm(editor).getByRole('combobox', { name: 'Position' }).locator('option:checked'))
      .toHaveText(placeLabel(INTERFACES_REFERENCE, ALT));
  });

  test('a fragment added by dragging the Fragment tile to a height, by Fragment, an operator, and a click at a height, and by A then Fragment lands where its path says (at that height; after the focused step)', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW });
    const height = await heightBetween(editor, INTERFACES_REFERENCE, STEP_2, ALT);
    const where = (form) => form.getByRole('combobox', { name: 'Position' }).locator('option:checked');

    // A drag of the tile to a height.
    const tile = await tool(editor, 'Fragment').boundingBox();
    const coordinator = await lifelinePoint(editor, 'coordinator', height);
    await page.mouse.move(tile.x + tile.width / 2, tile.y + tile.height / 2);
    await page.mouse.down();
    await page.mouse.move(coordinator.x, coordinator.y, { steps: 10 });
    await page.mouse.up();
    await expect(where(fragmentForm(editor)), 'dragged to the height after step 2').toHaveText(placeLabel(INTERFACES_REFERENCE, ALT));
    await page.keyboard.press('Escape');

    // Fragment, an operator, and a click at a height.
    await tool(editor, 'Fragment').click();
    await menuItem(editor, 'Fragment', 'opt').click();
    await page.mouse.click(coordinator.x, coordinator.y);
    await expect(where(fragmentForm(editor)), 'clicked at the height after step 2').toHaveText(placeLabel(INTERFACES_REFERENCE, ALT));
    await expect(fragmentForm(editor).getByRole('combobox', { name: 'Operator' })).toHaveValue('opt');
    await page.keyboard.press('Escape');

    // A, then Fragment, with step 2 focused: after the focused step.
    await stepOption(editor, 2).focus();
    await page.keyboard.press('a');
    await menuItem(editor, 'Add', 'Fragment').click();
    const form = fragmentForm(editor);
    await expect(where(form), 'after the focused step').toHaveText(placeLabel(INTERFACES_REFERENCE, ALT));
    await form.getByRole('textbox', { name: 'Guard' }).fill('a plan was submitted');
    await form.getByRole('button', { name: 'Add the fragment' }).click();

    const written = await changes(page, 1, 'one undo step');
    expect(stepsOf(written)[2]).toEqual({ alt: [{ when: 'a plan was submitted', steps: [] }] });
  });
});

// ---- The drags of spec §7.4: a message drawn at a height, a head dragged sideways -----------------------------------

test.describe('drags', () => {
  test.use({ viewport: WIDE });

  test('dragging from web\'s lifeline to coordinator\'s at the height between steps 2 and 3 opens the step form at "after step 2"', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW });
    const height = await heightBetween(editor, INTERFACES_REFERENCE, STEP_2, ALT);
    const web = await lifelinePoint(editor, 'web', height);
    const coordinator = await lifelinePoint(editor, 'coordinator', height);

    await page.mouse.move(web.x, web.y);
    await page.mouse.down();
    await page.mouse.move(coordinator.x, coordinator.y, { steps: 10 });
    await page.mouse.up();

    await expect(stepForm(editor).getByRole('combobox', { name: 'Position' }).locator('option:checked'))
      .toHaveText(placeLabel(INTERFACES_REFERENCE, ALT));
  });

  test('dragging Enrollment Policy\'s head left of Registration Coordinator\'s moves it there in the lifeline order, as one announced change', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW });
    const policy = await lifelinePoint(editor, 'policy');
    const coordinator = await lifelinePoint(editor, 'coordinator');

    await page.mouse.move(policy.x, policy.y);
    await page.mouse.down();
    await page.mouse.move(coordinator.x - 40, policy.y, { steps: 10 });
    await page.mouse.up();

    const plan = dynamicView.plan({ op: 'lifeline.reorder', order: ['web', 'policy', 'coordinator', 'seats', 'billing_gateway'], moved: 'policy' },
      contextOf(INTERFACES_REFERENCE));
    expect(await changes(page, 1, 'one undo step')).toBe(applied(INTERFACES_REFERENCE, plan));
    await expect(messageRegion(editor)).toContainText(plan.message);
  });

  test('dragging step 1 down between step 2 and the alt moves it there, as one announced change', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const editor = await openUmlEditor(page, { view: VIEW });
    const line = lineOfStep(INTERFACES_REFERENCE, { containerPath: [], index: 0 });

    await dragMessage(editor, line, await heightBetween(editor, INTERFACES_REFERENCE, STEP_2, ALT));

    const plan = dynamicView.plan({ op: 'message.move', ref: `seqmsg:${line}`, at: ALT }, contextOf(INTERFACES_REFERENCE));
    expect(await changes(page, 1, 'one undo step')).toBe(applied(INTERFACES_REFERENCE, plan));
    await expect(messageRegion(editor)).toContainText(plan.message);
    expect(errors, 'the drag raises no error').toEqual([]);
  });

  test('dragging step 2 below the alt, the last step, moves it to the end of the scenario', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW });
    const line = lineOfStep(INTERFACES_REFERENCE, STEP_2);

    await dragMessage(editor, line, (await fragmentBottom(editor, lineOfStep(INTERFACES_REFERENCE, ALT))) + 20);

    const end = contextOf(INTERFACES_REFERENCE).uml.source.scenarioEnd;
    const plan = dynamicView.plan({ op: 'message.move', ref: `seqmsg:${line}`, at: end }, contextOf(INTERFACES_REFERENCE));
    expect(await changes(page, 1, 'one undo step')).toBe(applied(INTERFACES_REFERENCE, plan));
    expect(stepsOf(applied(INTERFACES_REFERENCE, plan)).at(-1), 'step 2 is the scenario\'s last step now')
      .toBe('coordinator -> policy: asks for an eligibility decision from');
  });

  test('a step dragged in a scenario the task locks is drawn where it was again and says why, and nothing is written', async ({ page }) => {
    const lockedFields = ['scenarios.enroll'];
    const editor = await openUmlEditor(page, { view: VIEW, lockedFields });
    const line = lineOfStep(INTERFACES_REFERENCE, { containerPath: [], index: 0 });
    const drawnAt = await messageDrawnAt(editor, line);

    await dragMessage(editor, line, await heightBetween(editor, INTERFACES_REFERENCE, STEP_2, ALT));

    const plan = dynamicView.plan({ op: 'message.move', ref: `seqmsg:${line}`, at: ALT }, contextOf(INTERFACES_REFERENCE));
    const lock = createEditorState({ text: INTERFACES_REFERENCE, view: VIEW, lockedFields, host: { onTextChange: () => {} } })
      .lockRefusal({ op: 'batch', commands: plan.commands });
    await expect(messageRegion(editor)).toContainText('Not done:');
    await expect(messageRegion(editor)).toContainText(lock.message);
    await expect.poll(() => messageDrawnAt(editor, line), { message: 'the preview is put back' }).toBe(drawnAt);
    expect((await hostLog(page)).texts, 'nothing was written').toEqual([]);
  });

  test('a plain click on Enrollment Policy\'s head, which may be dragged, still selects it and changes nothing', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW });
    const policy = await lifelinePoint(editor, 'policy');
    await page.mouse.click(policy.x, policy.y);

    await expect.poll(async () => (await hostLog(page)).selections.at(-1)).toEqual({ elementId: 'policy' });
    expect((await hostLog(page)).texts, 'nothing was written').toEqual([]);
  });
});

// ---- Moving steps and lifelines without a drag (spec §7.4) --------------------------------------------------------

test.describe('moves without a drag', () => {
  test.use({ viewport: WIDE });

  test('M with Down moves a step through the places and the announcement names each', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW });
    const ref = `seqmsg:${lineOfStep(INTERFACES_REFERENCE, STEP_2)}`;
    const places = dynamicView.places(ref, contextOf(INTERFACES_REFERENCE));
    const after = places.slice(places.findIndex((place) => place.current) + 1);
    await stepOption(editor, 2).focus();

    await page.keyboard.press('m');
    for (const place of after.slice(0, 3)) {
      await page.keyboard.press('ArrowDown');
      await expect(messageRegion(editor)).toContainText(place.label);
    }
    expect((await hostLog(page)).texts, 'the keys only choose a place').toEqual([]);
    await page.keyboard.press('Enter');

    const moved = dynamicView.plan({ op: 'message.move', ref, at: after[2].at }, contextOf(INTERFACES_REFERENCE));
    expect(await changes(page, 1, 'one undo step')).toBe(applied(INTERFACES_REFERENCE, moved));
    await expect(messageRegion(editor)).toContainText(moved.message);
  });

  test('M with Left at the edge of its box moves the whole box and says so', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW });
    await option(editor, 'Registration Coordinator').focus();

    await page.keyboard.press('m');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Enter');

    const plan = dynamicView.plan(dynamicView.menu('coordinator', contextOf(INTERFACES_REFERENCE))[0].operation, contextOf(INTERFACES_REFERENCE));
    expect(await changes(page, 1, 'one undo step')).toBe(applied(INTERFACES_REFERENCE, plan));
    expect(plan.message, 'the module words the whole box\'s move').toMatch(/Registration API box/);
    await expect(messageRegion(editor)).toContainText(plan.message);
  });

  test('"Move earlier", "Move later", "Move into…", and "Move out of the fragment" in a step\'s menu each move it to the next place in reading order', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW });
    const moved = 'coordinator -> policy: asks for an eligibility decision from';
    /** The drawn ref and option name of the moved step in `text`. */
    const movedStep = (text) => {
      const found = dynamicView.optionSets(contextOf(text))[1].options.find((each) => each.name.endsWith(': Registration Coordinator to Enrollment Policy'));
      return { ref: found.ref, name: found.name };
    };
    let text = INTERFACES_REFERENCE;
    for (const [index, label] of ['Move into the following alt', 'Move out of the fragment', 'Move earlier', 'Move later'].entries()) {
      const before = text;
      const { ref, name } = movedStep(before);
      const item = dynamicView.menu(ref, contextOf(before)).find((each) => each.label === label);
      const plan = dynamicView.plan(item.operation, contextOf(before));
      await option(editor, name).focus();
      await page.keyboard.press('Shift+F10');
      await menuItem(editor, `Actions for ${name}`, label).click();

      text = await changes(page, index + 1, `${label} is one undo step`);
      expect(text, `${label} moves the step to the module's next place`).toBe(applied(before, plan));
      await expect(messageRegion(editor)).toContainText(plan.message);
    }
    expect(stepsOf(text).at(-1), 'the last move, Move later, took it from the alt\'s last branch to the end of the scenario').toBe(moved);
  });

  test('"Move left" and "Move right" on a lifeline swap it with its neighbour inside its box and, at the box\'s edge, move the whole box', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW });
    const lifelineOrder = (text) => C4.toUml(C4.project(C4.load(text), VIEW)).text.split('\n')
      .filter((line) => line.startsWith('participant ')).map((line) => line.split(/[ :]/)[1]);
    let text = INTERFACES_REFERENCE;
    /**
     * Clicks `label` for lifeline `id` (named `name`) on `path`, then checks the text against the module's plan and the
     * plan's message where `path` says its result: the canvas in its Messages region, the inspector in the editor's live status.
     */
    const move = async (id, name, label, count, path) => {
      const before = text;
      const item = dynamicView.menu(id, contextOf(before)).find((each) => each.label === label);
      const plan = dynamicView.plan(item.operation, contextOf(before));
      await option(editor, name).focus();
      await path.click(name, label);
      text = await changes(page, count, `${label} on ${name} is one undo step`);
      expect(text, `${label} on ${name} writes the module's plan`).toBe(applied(before, plan));
      await expect(path.said(), `${label} on ${name} says the module's result`).toContainText(plan.message);
      return lifelineOrder(text);
    };
    const fromCanvasMenu = {
      click: async (name, label) => {
        await page.keyboard.press('Shift+F10');
        await menuItem(editor, `Actions for ${name}`, label).click();
      },
      said: () => messageRegion(editor),
    };
    const fromPosition = {
      click: async (name, label) => {
        await inspector(editor).getByText('Position', { exact: true }).click();
        await inspector(editor).getByRole('group', { name: 'Move in the lifeline order' }).getByRole('button', { name: label }).click();
      },
      // The editor's live status, not its zoom readout (also a status).
      said: () => editor.getByRole('status').filter({ hasNotText: /^\d+%$/ }),
    };

    expect(await move('policy', 'Enrollment Policy', 'Move left', 1, fromCanvasMenu), 'inside its box it swaps with its left neighbour')
      .toEqual(['web', 'policy', 'coordinator', 'seats', 'billing_gateway']);
    expect(await move('policy', 'Enrollment Policy', 'Move left', 2, fromCanvasMenu), 'at its box\'s left edge the whole box moves past the neighbouring box')
      .toEqual(['policy', 'coordinator', 'seats', 'billing_gateway', 'web']);
    expect(await move('billing_gateway', 'Billing Gateway', 'Move right', 3, fromCanvasMenu), 'at its box\'s right edge the whole box moves past the neighbouring box')
      .toEqual(['web', 'policy', 'coordinator', 'seats', 'billing_gateway']);
    expect(await move('policy', 'Enrollment Policy', 'Move right', 4, fromCanvasMenu), 'inside its box it swaps with its right neighbour')
      .toEqual(['web', 'coordinator', 'policy', 'seats', 'billing_gateway']);
    // The same items in the inspector's Position section of the lifeline.
    expect(await move('policy', 'Enrollment Policy', 'Move left', 5, fromPosition), 'the Position section\'s Move left swaps it back')
      .toEqual(['web', 'policy', 'coordinator', 'seats', 'billing_gateway']);
  });

  test('"Move to…" on a message\'s receiver lists the possible receivers first and the others disabled with their short reason, and the choice changes the receiver', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW });
    const ref = `seqmsg:${lineOfStep(INTERFACES_REFERENCE, STEP_2)}`;
    const advice = dynamicView.targets({ op: 'relation.rewire', ref, open: 'to' }, contextOf(INTERFACES_REFERENCE));
    const names = Object.fromEntries(dynamicView.optionSets(contextOf(INTERFACES_REFERENCE))[0].options.map((each) => [each.ref, each.name]));
    await stepOption(editor, 2).focus();
    await page.keyboard.press('Shift+F10');
    const actions = 'Actions for Step 2: Registration Coordinator to Enrollment Policy';
    await menuItem(editor, actions, 'Move the target end to…').click();

    const chooser = editor.getByRole('menu').last();
    const items = chooser.getByRole('menuitem');
    const possible = advice.filter((each) => each.ok && each.ref !== 'policy');
    const others = advice.filter((each) => !each.ok);
    for (const [index, each] of possible.entries()) await expect(items.nth(index)).toHaveAccessibleName(new RegExp(`^${names[each.ref]}`));
    for (const each of others) {
      const item = chooser.getByRole('menuitem', { name: new RegExp(`^${names[each.ref]}`) });
      await expect(item).toHaveAttribute('aria-disabled', 'true');
      await expect(item).toContainText(refusalTable.verdict(each.code, each.values).summary);
    }
    await chooser.getByRole('menuitem', { name: new RegExp(`^${names[possible[0].ref]}`) }).click();

    const written = await changes(page, 1, 'one undo step');
    expect(stepsOf(written)[1]).toBe(`coordinator -> ${C4.toUml(C4.project(C4.load(INTERFACES_REFERENCE), VIEW)).ids[possible[0].ref]}: asks for an eligibility decision from`);
  });
});

// ---- Selection, in-place editors, and the scenario form (spec §7.4, §7.6) ----------------------------------------

test.describe('selection and in-place editors', () => {
  test.use({ viewport: WIDE });

  test('selecting a step reveals its row in the scenario form', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW });
    await stepOption(editor, 4).focus();

    const row = inspector(editor).locator('[aria-current="true"]');
    await expect(row).toHaveCount(1);
    await expect(row.getByText('Selected on the canvas.')).toBeVisible();
    await expect(row.getByRole('combobox', { name: 'Receiver of step 2 of branch 1 of step 3' })).toBeVisible();
    await expect(stepOption(editor, 4), 'the focused option stays focused').toBeFocused();
  });

  test('F2 on step 2 opens "Description of step 2" and on the alt "Guard of branch 1 of alt"', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW });
    await stepOption(editor, 2).focus();
    await page.keyboard.press('F2');
    // The in-place editor is on the canvas; the scenario form's row field, which the selection reveals, has the same name.
    const description = canvas(editor).getByRole('textbox', { name: 'Description of step 2', exact: true });
    await expect(description).toBeFocused();
    await expect(description).toHaveValue('asks for an eligibility decision from');
    await page.keyboard.press('Escape');

    await option(editor, 'alt: eligible / not eligible').focus();
    await page.keyboard.press('F2');
    await expect(canvas(editor).getByRole('textbox', { name: 'Guard of branch 1 of alt', exact: true })).toHaveValue('eligible');
  });

  test('the guard editor starts with the model\'s guard, quotes, braces, and arrow included, and an edit of it saves the rest intact', async ({ page }) => {
    const guard = 'seats["A"] > {0} -> ok';
    const text = INTERFACES_REFERENCE.replace('- when: eligible', `- when: '${guard}'`);
    const editor = await openUmlEditor(page, { view: VIEW, text });
    await elements(editor).getByRole('option', { name: /^alt: / }).focus();

    await page.keyboard.press('F2');
    const field = canvas(editor).getByRole('textbox', { name: 'Guard of branch 1 of alt', exact: true });
    await expect(field).toHaveValue(guard);
    // The editor opens with its text selected; ArrowRight puts the caret after it (End does not, on macOS).
    await field.press('ArrowRight');
    await field.pressSequentially('!');
    await field.press('Enter');

    const written = await changes(page, 1, 'one undo step');
    expect(C4.load(written).model.scenarios.get(SCENARIO).steps[ALT.index].branches[0].when).toBe(`${guard}!`);
  });
});

// ---- Review Focus 1 and 5 ----------------------------------------------------------------------------------------

test.describe('review focus', () => {
  test.use({ viewport: WIDE });

  test('Review Focus 1: in a new, empty scenario Message opens the step form with every allowed sender and receiver at the end of the scenario', async ({ page }) => {
    const text = INTERFACES_REFERENCE.replace('\ndeployment:\n', '\n  drop:\n    title: Drop a section\n\ndeployment:\n');
    const editor = await openUmlEditor(page, { text, view: 'dynamic drop' });
    const ends = C4.stepEnds(C4.load(text), { scenarioId: 'drop', containerPath: [], index: 0 });
    const nameOf = (id) => C4.load(text).model.elements.get(id).name;

    await tool(editor, 'Message').click();
    const form = stepForm(editor);
    await expect(form.getByRole('combobox', { name: 'Sender' }).getByRole('option')).toHaveText(['Choose the sender…'].concat(ends.froms.map(nameOf)));
    await expect(form.getByRole('combobox', { name: 'Position' }).locator('option:checked')).toHaveText('At the end of the scenario');
    await form.getByRole('combobox', { name: 'Sender' }).selectOption({ label: nameOf('web') });
    await expect(form.getByRole('combobox', { name: 'Receiver' }).getByRole('option')).toHaveText(['Choose the receiver…'].concat(ends.tosOf('web').map(nameOf)));
    await form.getByRole('combobox', { name: 'Receiver' }).selectOption({ label: nameOf('coordinator') });
    await confirmStep(editor, 'submits the plan to');

    expect(stepsOf(await changes(page, 1, 'one undo step'), 'drop')).toEqual(['web -> coordinator: submits the plan to']);
  });

  test('Review Focus 5: two editors in dynamic views each open their own step form, which writes to its own model', async ({ page }) => {
    const [first, second] = await openTwoUmlEditors(page, { view: VIEW }, { view: VIEW });
    await openStepFormWithTool(second);
    await expect(stepForm(second)).toBeVisible();
    await expect(stepForm(first)).toHaveCount(0);

    const form = stepForm(second);
    await form.getByRole('combobox', { name: 'Sender' }).selectOption({ label: 'Planner Web App' });
    await form.getByRole('combobox', { name: 'Receiver' }).selectOption({ label: 'Registration Coordinator' });
    await confirmStep(second, 'asks for the plan\'s status from');

    await changes(page, 1, 'the second editor wrote one change', 'second');
    expect((await hostLog(page, 'first')).texts, 'the first editor wrote nothing').toEqual([]);
    expect(stepsOf(await textOf(page, 'second')).at(-1)).toBe('web -> coordinator: asks for the plan\'s status from');
  });
});

// ---- Accessibility (spec §9.3) -------------------------------------------------------------------------------------

test.describe('accessibility of a message being drawn and the two forms', () => {
  for (const width of [320, 1440]) {
    test(`auditInteractiveState with a message being drawn, the step form, and the fragment form, in light and dark mode, at ${width} CSS px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const editor = await openUmlEditor(page, { view: VIEW, siteThemes: true });
      const audit = (state) => auditInteractiveState(page, `C4 editor dynamic view ${state} at ${width} px`, { include: '#editor' });

      await option(editor, 'Planner Web App').focus();
      await page.keyboard.press('c');
      await expect(messageRegion(editor)).toContainText(/^Drawing a line from Planner Web App/);
      await audit('with a message being drawn');

      await option(editor, 'Registration Coordinator').focus();
      await page.keyboard.press('Enter');
      await expect(stepForm(editor)).toBeVisible();
      await audit('with the step form');
      await page.keyboard.press('Escape');

      // The keyboard path to the fragment form, which every width offers: A, then Fragment, on a focused step.
      await option(editor, 'Planner Web App').focus();
      await page.keyboard.press('a');
      await menuItem(editor, 'Add', 'Fragment').click();
      await expect(fragmentForm(editor)).toBeVisible();
      await audit('with the fragment form');
    });
  }
});
