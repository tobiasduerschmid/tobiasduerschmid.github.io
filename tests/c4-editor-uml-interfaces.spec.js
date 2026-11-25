// @ts-check
// The interfaces view `interfaces of api` edited end to end on the C4 editor (UML-view editing spec §5.5, §4.2, §6,
// §7.4–§7.7, §9.3, §14 D1 and D3; plan Task 46): a use is drawn by keyboard and by pointer, each one undo step, and
// deleted after a confirmation; options say who provides a ball and which operations a use names; an interface is
// added only to the subject; Planner Web App is
// moved below Registration API by every path, after which its socket and the subject's ball face each other and the
// drawing comes back the same from the YAML; a ball does not move; an overlap that a turned ball or a new consumer
// causes is named with its offer; the Position section and Reset layout work on the view's positions; and an
// interface added on the canvas takes the id of its first name.
//
// Pages come from tests/helpers/c4-uml-editing.js (the editor from the ArchUML manifests, with the diagram editor's
// `core` group). Facts about the model come from the C4 core, and a sentence is compared with the function that owns
// its words (the refusal table). The drawing is read as the component renderer stamps it (plumbing, as in Task 2b's
// tests): boxes `rect.uml-component-box[data-layout-id]`, and the two parts of each line, the polylines
// `[data-route-style="component"]` whose `data-layout-source` is `<box>.<ball>` and whose `data-layout-target` is
// `<box>.<socket>`. The session's hit targets are found by `uml-pg-edit-hitbox`, which spec §3.7 keeps as a contract.
const { test, expect } = require('@playwright/test');
const { auditInteractiveState } = require('./a11y-helpers');
const { dragBetween } = require('./helpers/c4-editor-page.js');
const {
  C4, INTERFACES_REFERENCE, openUmlEditor, hostLog, canvas, option, messageRegion,
} = require('./helpers/c4-uml-editing.js');
const refusalTable = require('../js/ArchUML/c4/editor/c4-editor-uml-refusals.js');

const VIEW = 'interfaces of api';
const USE_OF_ENROLLMENT = 'web->coordinator';
// In the drawing of `interfaces of api`: the Planner Web App (e1) with its Enrollment API socket (r1), the subject
// Registration API (e2) with its Enrollment API ball (p1), and the Billing System (e3).
const BOX = { web: 'e1', api: 'e2', billing: 'e3' };
const HIT_LAYER = '.uml-pg-edit-layer';
// The C4 editor's large arrow step in a move, in drawing units (spec §7.4: Shift with an arrow).
const LARGE_STEP = 50;
// Where the line between the Enrollment API ball and its socket must keep clear of the two boxes (drawing units).
const CLEARANCE = 1;

const textOf = (page) => page.evaluate(() => window.c4Editors.editor.getText());
const palette = (editor) => editor.getByRole('group', { name: 'Add to the diagram', exact: true });
const button = (editor, name) => editor.getByRole('button', { name, exact: true });
const menu = (editor, name) => editor.getByRole('menu', { name, exact: true });
const inspector = (editor) => editor.getByRole('region', { name: 'Inspector' });
const nameEditor = (editor, name) => editor.getByRole('textbox', { name, exact: true });

// ---- Texts ---------------------------------------------------------------------------------------------------------

/** `text` with `from` replaced by `to`; throws when the fixture no longer holds `from`. */
function replaced(text, from, to) {
  if (!text.includes(from)) throw new Error(`the fixture no longer holds ${JSON.stringify(from)}`);
  return text.replace(from, to);
}

// The Registration API also provides Schedule API; the Planner Web App uses that one instead of the Enrollment API,
// so the Enrollment API ball is free for a new use from the Planner Web App.
const SCHEDULE_IN_USE = replaced(replaced(INTERFACES_REFERENCE, '        provides:\n',
  '        provides:\n          schedule-api:\n            name: Schedule API\n            operations:\n              list-sections: GET /v1/sections\n'),
'uses: enrollment-api.submit-plan}', 'uses: schedule-api}');

/** The reference model with `interfaces of api` keeping the positions `pins` (`{ id: [x, y] }`). */
function withPins(pins, text = INTERFACES_REFERENCE) {
  const lines = Object.entries(pins).map(([id, [x, y]]) => `      ${id}: [${x}, ${y}]`).join('\n');
  return `${text}layout:\n  ${VIEW}:\n    positions:\n${lines}\n`;
}

// The Planner Web App kept above the Registration API, the Billing System right of and below both: the drawing reaches
// down past the place below the subject where the Planner Web App is moved to, so a click there is on the drawing.
const BESIDE = { web: [40, 40], api: [40, 240], billing: [560, 560] };

/** Where `interfaces of api` keeps each box in `text`, as `{ id: [x, y] }` (none: an empty object). */
function keptPositions(text) {
  const view = C4.project(C4.load(text), VIEW);
  return view.layout ? Object.fromEntries(view.layout.positions) : {};
}

function usesOf(text, relationshipId) {
  return C4.load(text).model.relationships.find((relationship) => relationship.id === relationshipId).uses.map((use) => use.text);
}

// ---- Reading the drawing -------------------------------------------------------------------------------------------

/**
 * The drawing of the canvas in drawing units: `boxes` by alias (`{ x, y, width, height }`), and for the line of
 * each ball (`p<n>`) its two ends: `ball`, where its provider-side part leaves the provider's box, and `socket`,
 * where its consumer-side part meets the consumer's box, with every point of both parts (`points`).
 */
function drawingOf(editor) {
  return canvas(editor).evaluate((region) => {
    const svg = region.querySelector('.c4-editor__diagram svg');
    const box = (element) => { const b = element.getBBox(); return { x: b.x, y: b.y, width: b.width, height: b.height }; };
    const boxes = Object.fromEntries([...svg.querySelectorAll('rect.uml-component-box')].map((rect) => [rect.getAttribute('data-layout-id'), box(rect)]));
    const parts = [...svg.querySelectorAll('polyline[data-route-style="component"]')].map((line) => ({
      source: line.getAttribute('data-layout-source'), target: line.getAttribute('data-layout-target'),
      points: [...line.points].map((point) => ({ x: point.x, y: point.y })),
    }));
    return { boxes, parts };
  });
}

/** The ends and points of the line from ball `ball` to socket `socket` in `drawing`. */
function lineOf(drawing, ball, socket) {
  const fromBall = drawing.parts.find((part) => part.source && part.source.endsWith(`.${ball}`));
  const toSocket = drawing.parts.find((part) => part.target && part.target.endsWith(`.${socket}`));
  if (!fromBall || !toSocket) throw new Error(`no line from ${ball} to ${socket} is drawn`);
  return { ball: fromBall.points[0], socket: toSocket.points.at(-1), points: fromBall.points.concat(toSocket.points) };
}

const EDGE_DISTANCE = {
  upper: (box, point) => Math.abs(point.y - box.y),
  lower: (box, point) => Math.abs(point.y - (box.y + box.height)),
  left: (box, point) => Math.abs(point.x - box.x),
  right: (box, point) => Math.abs(point.x - (box.x + box.width)),
};

/** The side of `box` whose edge lies nearest to `point`. */
function sideOf(box, point) {
  return Object.keys(EDGE_DISTANCE).sort((a, b) => EDGE_DISTANCE[a](box, point) - EDGE_DISTANCE[b](box, point))[0];
}

/** Whether the segment from `a` to `b` passes through the inside of `box` (its edges excluded by `inset`). */
function crossesInside(a, b, box, inset = CLEARANCE) {
  const inside = { left: box.x + inset, right: box.x + box.width - inset, top: box.y + inset, bottom: box.y + box.height - inset };
  for (let step = 0; step <= 100; step += 1) {
    const x = a.x + ((b.x - a.x) * step) / 100;
    const y = a.y + ((b.y - a.y) * step) / 100;
    if (x > inside.left && x < inside.right && y > inside.top && y < inside.bottom) return true;
  }
  return false;
}

/** The sides the Enrollment API line ends on, and whether any of its segments crosses the web or api box. */
function enrollmentLine(drawing) {
  const line = lineOf(drawing, 'p1', 'r1');
  const [web, api] = [drawing.boxes[BOX.web], drawing.boxes[BOX.api]];
  const segments = line.points.slice(1).map((point, index) => [line.points[index], point]);
  return {
    socketSide: sideOf(web, line.socket),
    ballSide: sideOf(api, line.ball),
    crosses: segments.some(([a, b]) => crossesInside(a, b, web) || crossesInside(a, b, api)),
  };
}

/** The alias of the first ball of `interfaceId` in the drawing of `interfaces of api` of `text`. */
function ballOf(text, interfaceId) {
  const { ids } = C4.toUml(C4.project(C4.load(text), VIEW));
  return Object.keys(ids).find((alias) => /^p\d+$/.test(alias) && ids[alias] === interfaceId);
}

/** The client centre of the hit target of `alias` in the session's hit layer, scrolled into view. */
function hitCentre(editor, alias) {
  return canvas(editor).evaluate((region, { layer, id }) => {
    const rect = region.querySelector(`${layer} .uml-pg-edit-hitbox[data-layout-id="${id}"]`);
    if (!rect) return null;
    rect.scrollIntoView({ block: 'center', inline: 'center' });
    const box = rect.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  }, { layer: HIT_LAYER, id: alias });
}

/**
 * The client point that lies `units` drawing units below the bottom of box `alias`, at its centre's x. The drawing is
 * fitted to the canvas first (see fitted), so the point lies inside the canvas: a click outside it places nothing.
 */
function clientPointBelow(editor, alias, units) {
  return canvas(editor).evaluate((region, { id, below }) => {
    const svg = region.querySelector('.c4-editor__diagram svg');
    const box = window.UMLShared.renderedLayoutBox(svg, id);
    const point = new DOMPoint(box.x + box.width / 2, box.y + box.height + below).matrixTransform(svg.getScreenCTM());
    return { x: point.x, y: point.y };
  }, { id: alias, below: units });
}

/** Fits the drawing to the canvas with the toolbar's Fit, so that every box and the room below them are in view. */
async function fitted(editor) {
  await button(editor, 'Fit').click();
}

// ---- Steps every test shares ---------------------------------------------------------------------------------------

/** Undoes once with the toolbar's Undo and waits until the document is `expected` again. */
async function undoOnceTo(page, editor, expected, message) {
  await button(editor, 'Undo').click();
  await expect.poll(() => textOf(page), { message }).toBe(expected);
}

/** Waits until the host heard exactly one change, the gesture's one undo step, and returns its text. */
async function oneChange(page, message) {
  await expect.poll(async () => (await hostLog(page)).texts.length, { message }).toBe(1);
  return (await hostLog(page)).texts[0];
}

/**
 * Checks a move of the Planner Web App below the Registration API (spec §9.3 "Interfaces positions"): its socket on
 * its upper side, the subject's ball on its lower side, the line crossing neither box, its position in the layout
 * entry, and the same drawing when the editor is opened again on the written YAML.
 */
async function expectMovedBelow(page, editor, written) {
  const kept = keptPositions(written);
  const drawing = await drawingOf(editor);
  expect(kept.web, 'the Planner Web App keeps a position in interfaces of api').toBeDefined();
  expect(kept.web[1], 'it is kept below the Registration API').toBeGreaterThan(kept.api[1] + drawing.boxes[BOX.api].height);
  expect(enrollmentLine(drawing)).toEqual({ socketSide: 'upper', ballSide: 'lower', crosses: false });

  const again = await openUmlEditor(page, { view: VIEW, text: written });
  const redrawn = await drawingOf(again);
  expect(redrawn.boxes, 'the same boxes').toEqual(drawing.boxes);
  expect(lineOf(redrawn, 'p1', 'r1'), 'the same ball and socket places and route points').toEqual(lineOf(drawing, 'p1', 'r1'));
}

// ---- Drawing and deleting a use (spec §5.5, §7.4) ------------------------------------------------------------------

test.describe('a use of an interface', () => {
  test('keyboard only, C on Planner Web App then arrows and Enter on Enrollment API adds the use in one undo step', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW, text: SCHEDULE_IN_USE });
    await option(editor, 'Planner Web App').focus();

    await page.keyboard.press('c');
    await expect(messageRegion(editor)).toContainText(/^Drawing a line from Planner Web App/);
    for (let press = 0; press < 8 && !(await option(editor, 'Enrollment API').evaluate((node) => node === document.activeElement)); press += 1) {
      await page.keyboard.press('ArrowRight');
    }
    await expect(option(editor, 'Enrollment API')).toBeFocused();
    await page.keyboard.press('Enter');

    const written = await oneChange(page, 'the use is one change');
    expect(usesOf(written, USE_OF_ENROLLMENT)).toEqual(['schedule-api', 'enrollment-api']);
    await undoOnceTo(page, editor, SCHEDULE_IN_USE, 'one Undo takes the use back');
  });

  test('pointer only, the Use an interface tool then two clicks does the same', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW, text: SCHEDULE_IN_USE });

    await palette(editor).getByRole('button', { name: 'Use an interface', exact: true }).click();
    const box = await hitCentre(editor, BOX.web);
    await page.mouse.click(box.x, box.y);
    const ball = await hitCentre(editor, ballOf(SCHEDULE_IN_USE, 'enrollment-api'));
    await page.mouse.click(ball.x, ball.y);

    const written = await oneChange(page, 'the use is one change');
    expect(usesOf(written, USE_OF_ENROLLMENT)).toEqual(['schedule-api', 'enrollment-api']);
    await undoOnceTo(page, editor, SCHEDULE_IN_USE, 'one Undo takes the use back');
  });

  // The "⋯" button of the selected box is the other single-pointer way to "Draw a line" (spec §7.4, WCAG 2.5.7); the
  // view's one line tool, Use an interface, is then drawn without a chooser.
  test('"Draw a line" from the "⋯" button of Planner Web App, then a click on Enrollment API, does the same', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW, text: SCHEDULE_IN_USE });
    const box = await hitCentre(editor, BOX.web);
    await page.mouse.click(box.x, box.y);

    await canvas(editor).getByRole('button', { name: 'Actions for Planner Web App', exact: true }).click();
    await menu(editor, 'Actions for Planner Web App').getByRole('menuitem', { name: 'Draw a line', exact: true }).click();
    const ball = await hitCentre(editor, ballOf(SCHEDULE_IN_USE, 'enrollment-api'));
    await page.mouse.click(ball.x, ball.y);

    const written = await oneChange(page, 'the use is one change');
    expect(usesOf(written, USE_OF_ENROLLMENT)).toEqual(['schedule-api', 'enrollment-api']);
    await undoOnceTo(page, editor, SCHEDULE_IN_USE, 'one Undo takes the use back');
  });

  test('Delete on that line asks before it removes the use', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW });
    await option(editor, 'Planner Web App uses Enrollment API').focus();

    await page.keyboard.press('Delete');

    const dialog = editor.getByRole('dialog', { name: 'Delete the use of Enrollment API by Planner Web App?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('listitem')).toHaveText(['Planner Web App submits plans to Registration Coordinator']);
    expect((await hostLog(page)).texts, 'nothing is written before the answer').toEqual([]);
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
    const written = await oneChange(page, 'the deletion is one change');
    expect(usesOf(written, USE_OF_ENROLLMENT), 'the use is gone and the relationship stays').toEqual([]);
    await undoOnceTo(page, editor, INTERFACES_REFERENCE, 'one Undo brings the use back');
  });

  test('options say "provided by <element>" and, for a use, the operations used', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW });

    await expect(option(editor, 'Enrollment API')).toHaveAccessibleDescription(/provided by Registration API/);
    await expect(option(editor, 'Tuition Charges')).toHaveAccessibleDescription(/provided by Billing System/);
    await expect(option(editor, 'Planner Web App uses Enrollment API')).toHaveAccessibleDescription(/operation used: submit-plan \(POST \/v1\/enrollments\)/);
  });
});

// ---- Adding an interface (spec §5.5) -------------------------------------------------------------------------------

test.describe('an interface added on a neighbour', () => {
  test('the Provided interface tool with Billing System selected adds nothing and says that Billing System declares its own, with the offer to open its view', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW });
    await option(editor, 'Billing System').focus();

    await palette(editor).getByRole('button', { name: 'Provided interface', exact: true }).click();

    const refusal = refusalTable.verdict('interfaces/declared-elsewhere', { Owner: 'Billing System' });
    await expect(messageRegion(editor)).toContainText(refusal.message);
    await expect(messageRegion(editor).getByRole('button', { name: refusal.offer.label, exact: true })).toBeVisible();
    expect((await hostLog(page)).texts, 'nothing is written').toEqual([]);
  });
});

// ---- Interfaces positions (spec §9.3, §4.2, §14 D3) ----------------------------------------------------------------

test.describe('interfaces positions', () => {
  test.use({ viewport: { width: 1440, height: 1200 } });
  const START = withPins(BESIDE);

  test('Planner Web App dragged below Registration API: socket above, ball below, the line clear of both boxes, and the same drawing from the YAML', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW, text: START });
    await fitted(editor);
    const to = await clientPointBelow(editor, BOX.api, 160);
    const from = await hitCentre(editor, BOX.web);

    await dragBetween(page, from, to);

    await expectMovedBelow(page, editor, await oneChange(page, 'the drag is one change'));
  });

  test('Planner Web App moved below Registration API by "Move…" and a click: the same', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW, text: START });
    await fitted(editor);
    await option(editor, 'Planner Web App').focus();

    await page.keyboard.press('Shift+F10');
    await menu(editor, 'Actions for Planner Web App').getByRole('menuitem', { name: 'Move…', exact: true }).click();
    const to = await clientPointBelow(editor, BOX.api, 160);
    await page.mouse.click(to.x, to.y);

    await expectMovedBelow(page, editor, await oneChange(page, 'the move is one change'));
  });

  test('Planner Web App moved below Registration API with M, Shift+Down, and Enter: the same', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW, text: START });
    const drawn = await drawingOf(editor);
    const [web, api] = [drawn.boxes[BOX.web], drawn.boxes[BOX.api]];
    // Down until the box's top lies 120 units below the subject's bottom: room for the ball, the socket, and the line.
    const presses = Math.ceil((api.y + api.height + 120 - web.y) / LARGE_STEP);
    await option(editor, 'Planner Web App').focus();

    await page.keyboard.press('m');
    for (let press = 0; press < presses; press += 1) await page.keyboard.press('Shift+ArrowDown');
    await page.keyboard.press('Enter');

    const written = await oneChange(page, 'the move is one change');
    expect(keptPositions(written).web).toEqual([BESIDE.web[0], BESIDE.web[1] + presses * LARGE_STEP]);
    await expectMovedBelow(page, editor, written);
  });

  test('dragging the subject\'s ball changes nothing and shows layout/port\'s sentence in the message region', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW, text: START });
    const ball = await hitCentre(editor, 'p1');

    await dragBetween(page, ball, { x: ball.x + 120, y: ball.y + 80 });

    await expect(messageRegion(editor)).toContainText(refusalTable.verdict('layout/port').message);
    expect((await hostLog(page)).texts, 'nothing is written').toEqual([]);
  });
});

// ---- Overlaps (spec §6 rule 4, Review Focus 7) ---------------------------------------------------------------------

test.describe('overlaps in an interfaces view', () => {
  test.use({ viewport: { width: 1440, height: 1200 } });

  test('a box that grows over a neighbour when its balls and sockets turn raises the overlap notice, and its offer moves the grown box to a free place', async ({ page }) => {
    // The Billing System sits just below the Registration API. Moving the Planner Web App to the subject's right turns
    // the Enrollment API ball to the subject's right side, and the subject grows taller, over the Billing System.
    const editor = await openUmlEditor(page, { view: VIEW, text: withPins({ web: [0, 0], api: [0, 300], billing: [0, 392] }) });
    await option(editor, 'Planner Web App').focus();
    await page.keyboard.press('m');
    for (let press = 0; press < 14; press += 1) await page.keyboard.press('Shift+ArrowRight');
    for (let press = 0; press < 6; press += 1) await page.keyboard.press('Shift+ArrowDown');

    await page.keyboard.press('Enter');

    await expect(messageRegion(editor)).toContainText('Registration API now overlaps Billing System.');
    expect(Object.keys(keptPositions(await textOf(page))).sort()).toEqual(['api', 'billing', 'web']);
    await messageRegion(editor).getByRole('button', { name: 'Move Registration API to a free place' }).click();
    await expect.poll(async () => keptPositions(await textOf(page)).api, { message: 'the grown box is moved' }).not.toEqual([0, 300]);
    const drawing = await drawingOf(editor);
    const [api, billing] = [drawing.boxes[BOX.api], drawing.boxes[BOX.billing]];
    const overlaps = api.x < billing.x + billing.width && billing.x < api.x + api.width && api.y < billing.y + billing.height && billing.y < api.y + api.height;
    expect(overlaps, 'the Registration API no longer overlaps the Billing System').toBe(false);
  });

  test('a consumer that appears through a use added in the containers view, and lands on a pinned box, is named as an overlap when interfaces of api is drawn next', async ({ page }) => {
    // The Planner Web App is kept where the automatic layout would put a second consumer of the Enrollment API.
    const start = withPins({ web: [320, 0], api: [0, 0], billing: [0, 300] });
    const editor = await openUmlEditor(page, { view: VIEW, text: start });
    await expect(messageRegion(editor)).not.toContainText('overlaps');
    // In the containers view the Registration Database gets a relationship that uses the Enrollment API (YAML
    // written while that view is open: what the containers view's relationship form writes).
    await page.evaluate(() => window.c4Editors.editor.openView('containers of registration'));
    await expect(canvas(editor)).toHaveAccessibleName(/Container/);
    const marker = '          - do: durably store plans, enrollment attempts, and seat holds\n';
    const changed = replaced(start, marker, `${marker}        collaborators:\n          api: {description: reports stored plans to, uses: enrollment-api}\n`);
    await page.evaluate((text) => window.c4Editors.editor.setText(text), changed);

    await page.evaluate((view) => window.c4Editors.editor.openView(view), VIEW);

    await expect(messageRegion(editor)).toContainText(/(Registration Database now overlaps Planner Web App|Planner Web App now overlaps Registration Database)\./);
  });
});

// ---- The Position section and Reset layout (spec §7.6) -------------------------------------------------------------

test.describe('kept positions of an interfaces view in the inspector and the toolbar', () => {
  test('the Position section of a pinned consumer has step buttons, X and Y, and Return to automatic layout', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW, text: withPins({ web: [80, 40], api: [0, 240], billing: [520, 240] }) });
    await option(editor, 'Planner Web App').focus();
    const summary = inspector(editor).locator('summary', { hasText: 'Position' });
    await summary.click();
    const position = summary.locator('xpath=..');

    await expect(position.getByText('Pinned at 80, 40 in this view.')).toBeVisible();
    for (const direction of ['up', 'left', 'right', 'down']) await expect(position.getByRole('button', { name: `Move ${direction}` })).toBeVisible();
    await expect(position.getByRole('spinbutton', { name: 'X' })).toHaveValue('80');
    await expect(position.getByRole('spinbutton', { name: 'Y' })).toHaveValue('40');
    const step = Number(await position.getByRole('combobox', { name: 'Step' }).inputValue());

    await position.getByRole('button', { name: 'Move right' }).click();

    await expect.poll(async () => keptPositions(await textOf(page)).web).toEqual([80 + step, 40]);
    expect((await hostLog(page)).texts, 'one click is one change').toHaveLength(1);
    await position.getByRole('button', { name: 'Return to automatic layout' }).click();
    await expect.poll(async () => keptPositions(await textOf(page)).web).toBeUndefined();
    await expect(position.getByText('Placed automatically.')).toBeVisible();
  });

  test('Reset layout removes the view\'s layout entry in one undo step, and the balls and sockets return to the sides of the automatic layout', async ({ page }) => {
    // Kept with the Planner Web App below the subject, so its socket and the subject's ball have turned.
    const start = withPins({ web: [0, 400], api: [0, 200], billing: [520, 200] });
    const automatic = await openUmlEditor(page, { view: VIEW });
    const automaticSides = enrollmentLine(await drawingOf(automatic));
    const editor = await openUmlEditor(page, { view: VIEW, text: start });
    expect(enrollmentLine(await drawingOf(editor)), 'kept, the ends have turned').not.toEqual(automaticSides);
    const reset = editor.getByRole('group', { name: 'Layout' }).getByRole('button', { name: 'Reset layout' });

    await reset.click();

    const written = await oneChange(page, 'Reset layout is one change');
    expect(C4.load(written).model.layout.has(VIEW), 'the model has no layout entry for the view').toBe(false);
    await expect.poll(async () => enrollmentLine(await drawingOf(editor)), { message: 'the sides of the automatic layout' }).toEqual(automaticSides);
    await undoOnceTo(page, editor, start, 'one Undo brings the positions back');
  });
});

// ---- An interface added on the canvas (spec §5.1 Identity, §14 D1) -------------------------------------------------

test.describe('an interface added on the canvas', () => {
  test('an interface added on the canvas opens its name editor with "New interface" selected; Escape keeps the placeholder; renaming it then gives it the id of its new name in one undo step, and a second rename keeps that id', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: VIEW });
    const expectedId = C4.edit(C4.load(INTERFACES_REFERENCE), { op: 'addInterface', elementId: 'api', name: 'Waitlist API' }).selection.interfaceId;

    await palette(editor).getByRole('button', { name: 'Provided interface', exact: true }).click();

    const field = editor.getByRole('textbox', { name: /New interface$/ });
    await expect(field).toBeFocused();
    await expect(field).toHaveValue('New interface');
    expect(await field.evaluate((input) => [input.selectionStart, input.selectionEnd]), 'the whole name is selected').toEqual([0, 'New interface'.length]);
    await page.keyboard.press('Escape');
    await expect(field).toHaveCount(0);
    const added = await oneChange(page, 'the addition is one change');
    const placeholderId = [...C4.load(added).model.interfaces.values()].find((declared) => declared.name === 'New interface').id;

    await option(editor, 'New interface').focus();
    await page.keyboard.press('F2');
    await editor.getByRole('textbox', { name: /New interface$/ }).fill('Waitlist API');
    await page.keyboard.press('Enter');

    await expect.poll(async () => (await hostLog(page)).texts.length, { message: 'the rename is one change' }).toBe(2);
    const renamed = C4.load(await textOf(page)).model.interfaces;
    expect([renamed.has(placeholderId), renamed.has(expectedId), renamed.get(expectedId) && renamed.get(expectedId).name])
      .toEqual([false, true, 'Waitlist API']);

    await option(editor, 'Waitlist API').focus();
    await page.keyboard.press('F2');
    await editor.getByRole('textbox', { name: /Waitlist API$/ }).fill('Wait List API');
    await page.keyboard.press('Enter');

    await expect.poll(async () => { const now = C4.load(await textOf(page)).model.interfaces; return now.has(expectedId) && now.get(expectedId).name; })
      .toBe('Wait List API');
  });
});

// ---- Accessibility (WCAG 2.2 AA) -----------------------------------------------------------------------------------

test.describe('accessibility of an edited interfaces view', () => {
  for (const width of [320, 1440]) {
    test(`auditInteractiveState in C mode, during a box move, and with the deletion's confirmation open, in light and dark mode, at ${width} CSS px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const editor = await openUmlEditor(page, { view: VIEW, siteThemes: true, profile: 'novice', text: SCHEDULE_IN_USE });
      const audit = (state) => auditInteractiveState(page, `C4 editor interfaces view ${state} at ${width} px`, { include: '#editor' });

      await option(editor, 'Planner Web App').focus();
      await page.keyboard.press('c');
      await expect(messageRegion(editor)).toContainText(/^Drawing a line from Planner Web App/);
      await audit('in C mode');
      await page.keyboard.press('Escape');

      await option(editor, 'Planner Web App').focus();
      await page.keyboard.press('m');
      await page.keyboard.press('Shift+ArrowDown');
      await audit('during a box move');
      await page.keyboard.press('Escape');

      await option(editor, 'Planner Web App uses Schedule API').focus();
      await page.keyboard.press('Delete');
      await expect(editor.getByRole('dialog', { name: 'Delete the use of Schedule API by Planner Web App?' })).toBeVisible();
      await audit('with the deletion\'s confirmation open');
    });
  }
});
