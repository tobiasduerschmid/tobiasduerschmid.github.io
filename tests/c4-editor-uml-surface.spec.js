// @ts-check
// The C4 surface over an editable UML-notation view (UML-view editing spec §7.2–§7.7): the canvas draws the code view,
// mounts one diagram-editor session on the drawing, and lays the listbox "Elements in this view" over it. The listbox is
// the keyboard's and assistive technology's: its options name and describe the drawn boxes and lines. The session's hit
// targets are the pointer's: aria-hidden, and at least 24 × 24 CSS px at every magnification. Focus follows the rules of
// §7.7 when the selection changes, when the view is drawn again, and when an offer opens a view.
//
// Every drag has a single-pointer and a keyboard path (§7.4): M or "Move…" moves a box, a line's menu or its "⋯" button
// adds, moves, and removes bends, "Move the target end to…" moves an end, C draws a line through the marked targets.
// Names are edited in place (F2, a double-click); menus open with Shift+F10; Escape closes one layer per press. After
// each drawing of a view that keeps positions, an overlap of a box that keeps one is named with an offer (§6 rule 4).
//
// Pages come from tests/helpers/c4-uml-editing.js (the editor from the ArchUML manifests, with the diagram editor's
// `core` group). Facts about the model (names, the view's title, what is drawn, where a box is kept) come from the C4
// core; a sentence is compared with the function that owns its words. The hit layer, its segments
// (`uml-pg-edge-hitbox`), the bend numbers (`uml-pg-bend-number`), and the target marks (`uml-pg-target-mark`) are found
// by the classes spec §3.7 keeps as contracts of the module. Drawing coordinates are read with the bundle's
// `UMLShared.renderedLayoutBox` (test plumbing).
const { test, expect } = require('@playwright/test');
const { auditInteractiveState } = require('./a11y-helpers');
const { centreOf, dragBetween } = require('./helpers/c4-editor-page.js');
const {
  C4, INTERFACES_REFERENCE, openUmlEditor, openTwoUmlEditors, hostLog, canvas, elements, option, messageRegion,
} = require('./helpers/c4-uml-editing.js');
const refusalTable = require('../js/ArchUML/c4/editor/c4-editor-uml-refusals.js');
const sharedActions = require('../js/ArchUML/c4/editor/c4-editor-actions-shared.js');

const CODE_VIEW = 'code of policy';
const CONTAINERS = 'containers of registration';
const CODE_ELEMENTS = 'Code elements of Enrollment Policy';
const DEPENDENCY = 'EnrollmentPolicy delegates each eligibility check to EnrollmentRule';
const HIT_LAYER = '.uml-pg-edit-layer';
const MINIMUM_TARGET_PX = 24;

/** Every uncaught error of the page, in the order it happened. */
function pageErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

const callEditor = (page, method, ...args) => page.evaluate(({ name, values }) => window.c4Editors.editor[name](...values), { name: method, values: args });
const optionSet = (editor, name) => elements(editor).getByRole('group', { name, exact: true });
const focusedOption = (page, editor) => elements(editor).getByRole('option').and(page.locator(':focus'));
const magnification = (editor) => editor.getByRole('group', { name: 'Magnification' }).getByRole('status');

/** The reference model with code of policy keeping the positions `pins` (`{ id: [x, y] }`). */
function withCodePins(pins) {
  const lines = Object.entries(pins).map(([id, [x, y]]) => `      ${id}: [${x}, ${y}]`).join('\n');
  return `${INTERFACES_REFERENCE}layout:\n  ${CODE_VIEW}:\n    positions:\n${lines}\n`;
}

/** Presses Ctrl/Cmd plus `key` `times` times on the canvas's focused option, as the canvas's magnification keys. */
async function magnify(page, key, times) {
  for (let pressed = 0; pressed < times; pressed += 1) await page.keyboard.press(`ControlOrMeta+${key}`);
}

/**
 * The pointer targets of the session's hit layer, measured in the page: whether the layer is hidden from assistive
 * technology, the smallest width and height of its boxes in CSS px, and each segment line's computed stroke width and
 * vector effect.
 */
function hitTargets(editor) {
  return canvas(editor).evaluate((region, selector) => {
    const layer = region.querySelector(selector);
    if (!layer) return null;
    const boxes = [...layer.querySelectorAll('rect.uml-pg-edit-hitbox')].map((rect) => rect.getBoundingClientRect());
    const lines = [...layer.querySelectorAll('line.uml-pg-edge-hitbox')].map((line) => getComputedStyle(line));
    return {
      hidden: layer.getAttribute('aria-hidden'),
      boxes: boxes.length,
      smallestBox: Math.min(...boxes.map((box) => Math.min(box.width, box.height))),
      lines: lines.length,
      thinnestLine: Math.min(...lines.map((style) => parseFloat(style.strokeWidth))),
      lineEffects: [...new Set(lines.map((style) => style.vectorEffect))],
    };
  }, HIT_LAYER);
}

test.describe('the listbox over an editable code view (spec §7.3)', () => {
  test('the listbox "Elements in this view" offers the code elements and lines with type descriptions, and the hit targets are aria-hidden and at least 24 × 24 CSS px at 50% and 200%', async ({ page }) => {
    const errors = pageErrors(page);
    const editor = await openUmlEditor(page, { view: CODE_VIEW, siteThemes: true });

    const codeElements = optionSet(editor, CODE_ELEMENTS);
    await expect(codeElements.getByRole('option', { name: 'EnrollmentPolicy', exact: true })).toHaveAccessibleDescription(/^class; /);
    await expect(codeElements.getByRole('option', { name: 'EnrollmentRule', exact: true })).toHaveAccessibleDescription(/^interface; /);
    await expect(codeElements.getByRole('option', { name: 'PrerequisiteRule', exact: true })).toHaveAccessibleDescription(/^class; /);
    await expect(codeElements.getByRole('option', { name: 'UnitCapRule', exact: true })).toHaveAccessibleDescription(/^class; /);
    const lines = optionSet(editor, 'Lines');
    await expect(lines.getByRole('option', { name: 'PrerequisiteRule implements EnrollmentRule', exact: true }))
      .toHaveAccessibleDescription(/^realization; routed for you; /);
    await expect(lines.getByRole('option', { name: 'UnitCapRule implements EnrollmentRule', exact: true }))
      .toHaveAccessibleDescription(/^realization; routed for you; /);
    await expect(lines.getByRole('option', { name: DEPENDENCY, exact: true })).toHaveAccessibleDescription(/^dependency; /);
    // Every option says what Enter does there: a code view opens nothing.
    for (const name of ['EnrollmentPolicy', DEPENDENCY]) {
      await expect(option(editor, name), `${name} says what Enter does`).toHaveAccessibleDescription(/Enter: nothing to open$/);
    }

    await option(editor, 'EnrollmentPolicy').focus();
    for (const [key, times, level] of [['-', 5, '50%'], ['=', 15, '200%']]) {
      await magnify(page, key, times);
      await expect(magnification(editor)).toHaveText(level);
      await expect.poll(async () => (await hitTargets(editor) || { smallestBox: 0 }).smallestBox, {
        message: `every box target is at least ${MINIMUM_TARGET_PX} CSS px at ${level}`,
      }).toBeGreaterThanOrEqual(MINIMUM_TARGET_PX);
      const targets = await hitTargets(editor);
      expect(targets && targets.hidden, `the hit layer is hidden from assistive technology at ${level}`).toBe('true');
      expect(targets && targets.boxes, 'one box target per drawn class').toBe(4);
      expect(targets && targets.lines, 'the lines have segment targets').toBeGreaterThan(0);
      expect(targets && targets.thinnestLine, `every segment target is ${MINIMUM_TARGET_PX} CSS px wide at ${level}`).toBeGreaterThanOrEqual(MINIMUM_TARGET_PX);
      expect(targets && targets.lineEffects, 'segment targets keep their width at every magnification').toEqual(['non-scaling-stroke']);
    }
    expect(errors).toEqual([]);
  });

  test('a pinned class\'s option says "position kept"', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE_VIEW, text: withCodePins({ EnrollmentPolicy: [80, 40] }) });

    await expect(option(editor, 'EnrollmentPolicy')).toHaveAccessibleDescription(/; position kept; /);
    await expect(option(editor, 'UnitCapRule')).not.toHaveAccessibleDescription(/position kept/);
  });

  test('with diagnostics shown an option names its problem count', async ({ page }) => {
    // Each code element of the reference model has one finding: it has no responsibilities (rule rdd/no-responsibility).
    const findings = C4.check(C4.load(INTERFACES_REFERENCE)).filter((finding) => finding.element === 'EnrollmentPolicy');
    expect(findings).toHaveLength(1);
    const editor = await openUmlEditor(page, { view: CODE_VIEW });

    await expect(option(editor, 'EnrollmentPolicy')).toHaveAccessibleDescription(/; 1 problem; /);
  });

  test('with diagnostics withheld until Check now, no option names a problem count', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE_VIEW, checks: { display: 'on-request' } });

    await expect(option(editor, 'EnrollmentPolicy')).toHaveAccessibleDescription(/^class; /);
    await expect(option(editor, 'EnrollmentPolicy')).not.toHaveAccessibleDescription(/problem/);
  });
});

test.describe('focus (spec §7.7)', () => {
  test('selecting EnrollmentPolicy in the outline focuses its option', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE_VIEW });
    const item = editor.getByRole('tree', { name: 'Model outline' }).getByRole('treeitem', { name: 'EnrollmentPolicy', exact: true });

    await item.click();

    await expect(option(editor, 'EnrollmentPolicy')).toBeFocused();
    await expect(option(editor, 'EnrollmentPolicy')).toHaveAttribute('aria-selected', 'true');
  });

  test('a focused option is not hidden under the 96 px sticky header', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 640 });
    const editor = await openUmlEditor(page, { view: CODE_VIEW, header: true });
    const first = option(editor, 'EnrollmentPolicy');
    await first.focus();
    await page.keyboard.press('ArrowRight');
    await expect(first).not.toBeFocused();
    // Scroll the page so the first option lies under the sticky header, then come back to it with the arrow keys.
    await first.evaluate((target) => window.scrollBy(0, target.getBoundingClientRect().top - 40));
    expect((await first.boundingBox() || { y: 0 }).y, 'the option starts under the header').toBeLessThan(96);

    await page.keyboard.press('ArrowLeft');

    await expect(first).toBeFocused();
    // The page scrolls by whole CSS px, so the option may start a fraction of a pixel above the header's edge.
    expect((await first.boundingBox() || { y: 0 }).y, 'the focused option shows below the 96 px header').toBeGreaterThan(95);
  });

  test('after a redraw focus is on the option found by model id', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE_VIEW });
    await option(editor, 'UnitCapRule').focus();
    // UnitCapRule keeps its id and gets a name, so the drawing names its box anew.
    const renamed = INTERFACES_REFERENCE.replace('              UnitCapRule:\n', '              UnitCapRule:\n                name: Unit Cap Rule\n');
    const drawnName = C4.project(C4.load(renamed), CODE_VIEW).uml.classes.find((drawn) => drawn.id === 'UnitCapRule').name;
    expect(drawnName).not.toBe('UnitCapRule');

    await callEditor(page, 'setText', renamed);

    await expect(option(editor, drawnName)).toBeFocused();
  });

  test('typing in the Members form while code of policy is open keeps focus in the field across the redraw', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE_VIEW });
    await option(editor, 'EnrollmentPolicy').focus();
    const field = editor.getByRole('region', { name: 'Inspector' }).getByRole('textbox', { name: 'Operation 1', exact: true });
    await field.focus();
    // The caret at the end of the field's text, where the learner goes on typing.
    await field.evaluate((input) => input.setSelectionRange(input.value.length, input.value.length));

    await page.keyboard.type(' const');
    // A field of the form writes its text when it changes: Enter commits it, as leaving the field does.
    await page.keyboard.press('Enter');

    await expect.poll(() => callEditor(page, 'getText'), { message: 'the typed text reaches the document' })
      .toContain('+ decide(student, section): Decision const');
    await expect(field).toBeFocused();
    await expect(option(editor, 'EnrollmentPolicy'), 'the redrawn view still selects the class').toHaveAttribute('aria-selected', 'true');
  });

  test('accepting an offer to open a view focuses that view\'s first option', async ({ page }) => {
    // A view module that refuses every move in the code view with an offer to open the containers view: a double at the
    // port of the view modules (plan Task 34), so the offer comes through the session's own report path.
    const editor = await openUmlEditor(page, {
      view: CODE_VIEW,
      beforeMount: () => {
        const views = window.ArchUMLC4EditorParts.umlViews;
        const real = views['uml-class'];
        views['uml-class'] = Object.assign({}, real, {
          plan: (operation, context) => (operation.op === 'layout.set'
            ? { kind: 'refuse', code: 'test/offer', summary: 'Not here', message: 'Positions are kept in the containers view.',
              offer: { kind: 'open-view', label: 'Open the containers view', view: 'containers of registration' } }
            : real.plan(operation, context)),
        });
      },
    });
    const from = await centreOf(canvas(editor).locator(`${HIT_LAYER} rect.uml-pg-edit-hitbox`).first());
    await dragBetween(page, from, { x: from.x + 120, y: from.y + 40 });
    const offer = messageRegion(editor).getByRole('button', { name: 'Open the containers view', exact: true });
    await expect(messageRegion(editor)).toContainText('Positions are kept in the containers view.');

    await offer.click();

    await expect(canvas(editor)).toHaveAccessibleName(`Canvas: ${C4.project(C4.load(INTERFACES_REFERENCE), CONTAINERS).title}`);
    const focused = focusedOption(page, editor);
    await expect(focused).toHaveCount(1);
    const name = await focused.evaluate((target) => target.querySelector('title').textContent);
    await page.keyboard.press('ArrowLeft');
    await expect(option(editor, name), 'the focused option is the first: there is none before it').toBeFocused();
  });
});

test.describe('editors without editing on the canvas', () => {
  test('a read-only editor offers the listbox and navigation but no tools, hit targets, or message row', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE_VIEW, readOnly: true });

    await expect(optionSet(editor, 'Lines').getByRole('option', { name: DEPENDENCY, exact: true })).toBeAttached();
    await option(editor, 'EnrollmentPolicy').focus();
    await page.keyboard.press('ArrowRight');
    await expect(focusedOption(page, editor), 'the arrow keys move between the options').toHaveCount(1);
    await expect(option(editor, 'EnrollmentPolicy')).not.toBeFocused();
    const tools = editor.getByRole('group', { name: 'Add to the diagram' }).getByRole('button');
    for (const tool of await tools.all()) await expect(tool).toBeDisabled();
    await expect(canvas(editor).locator(HIT_LAYER)).toHaveCount(0);
    await expect(messageRegion(editor)).toHaveCount(0);
  });

  test('without the diagram-editor scripts the code view is drawn as before', async ({ page }) => {
    const errors = pageErrors(page);
    const editor = await openUmlEditor(page, { view: CODE_VIEW, diagramEditor: false });

    const view = C4.project(C4.load(INTERFACES_REFERENCE), CODE_VIEW);
    await expect(canvas(editor).getByRole('group', { name: view.title, exact: true })).toBeVisible();
    await expect(optionSet(editor, CODE_ELEMENTS).getByRole('option')).toHaveCount(4);
    await expect(canvas(editor).locator(HIT_LAYER)).toHaveCount(0);
    await option(editor, 'EnrollmentPolicy').focus();
    await page.keyboard.press('ArrowRight');
    await expect(focusedOption(page, editor), 'the arrow keys move between the options').toHaveCount(1);
    await expect(option(editor, 'EnrollmentPolicy')).not.toBeFocused();
    expect((await hostLog(page)).texts, 'nothing was written').toEqual([]);
    expect(errors).toEqual([]);
  });
});

test.describe('accessibility of the code view\'s surface', () => {
  for (const width of [320, 1440]) {
    test(`auditInteractiveState with the listbox focused and a class selected, in light and dark mode, at ${width} CSS px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const editor = await openUmlEditor(page, { view: CODE_VIEW, siteThemes: true });
      await option(editor, 'EnrollmentPolicy').focus();
      await expect(option(editor, 'EnrollmentPolicy')).toHaveAttribute('aria-selected', 'true');

      await auditInteractiveState(page, `C4 editor code view surface at ${width} px`, { include: '#editor' });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'the page does not scroll sideways (WCAG 1.4.10)').toBe(true);
    });
  }
});

// ---- Paths without a drag, in-place editors, menus, and Escape (spec §7.4, §7.5, §7.7; plan Task 40) ------------------

const MOVING = /^Moving /;
// The text the in-place name editor of a code element shows under its field (spec §7.4 In-place editors).
const NAME_INSTRUCTION = 'Enter saves, Escape cancels. Class names have no spaces; a space is drawn as _.';
const NEIGHBOURS = 'Outside Enrollment Policy';
// code of policy with two boxes from outside Enrollment Policy: Registration Coordinator asks EnrollmentPolicy, and
// EnrollmentPolicy looks up held seats through Seat Gateway (each drawn as one lifted box).
const WITH_NEIGHBOURS = INTERFACES_REFERENCE
  .replace('              billing-gateway: asks for tuition charges through\n            invariants',
    '              billing-gateway: asks for tuition charges through\n              EnrollmentPolicy: asks each eligibility question of\n            invariants')
  .replace('collaborators: {EnrollmentRule: delegates each eligibility check to}',
    'collaborators: {EnrollmentRule: delegates each eligibility check to, seats: looks up held seats through}');
const ASKS_POLICY = 'Registration Coordinator asks each eligibility question of EnrollmentPolicy';

const textOf = (page) => callEditor(page, 'getText');
const menu = (editor, name) => editor.getByRole('menu', { name, exact: true });
const item = (scope, name) => scope.getByRole('menuitem', { name, exact: true });
const nameEditor = (editor, name) => editor.getByRole('textbox', { name, exact: true });

/** Where code of policy keeps each box in `text`, as `{ id: [x, y] }` (none: an empty object). */
function keptPositions(text) {
  const view = C4.project(C4.load(text), CODE_VIEW);
  return view.layout ? Object.fromEntries(view.layout.positions) : {};
}

/** The bends code of policy keeps for the line from `from` to `to` in `text`, or null. */
function keptBends(text, from, to) {
  const view = C4.project(C4.load(text), CODE_VIEW);
  const route = view.layout ? view.layout.routes.find((candidate) => candidate.from === from && candidate.to === to) : null;
  return route ? route.points : null;
}

/**
 * The box drawn for `alias` in the drawing units of the canvas's drawing (its top-left corner and size), with the client
 * point of its centre shifted by `offset` drawing units. The canvas is scrolled to show the box first: the drawing can
 * be wider than the page.
 */
function drawnBox(editor, alias, offset = { x: 0, y: 0 }) {
  return canvas(editor).evaluate((region, { name, by }) => {
    const svg = region.querySelector('.c4-editor__diagram svg');
    const box = window.UMLShared.renderedLayoutBox(svg, name);
    if (!box) return null;
    const hit = [...region.querySelectorAll('.uml-pg-edit-hitbox')].find((target) => target.getAttribute('data-layout-id') === name);
    if (hit) hit.scrollIntoView({ block: 'center', inline: 'center' });
    const centre = new DOMPoint(box.x + box.width / 2 + by.x, box.y + box.height / 2 + by.y).matrixTransform(svg.getScreenCTM());
    return { x: box.x, y: box.y, width: box.width, height: box.height, client: { x: centre.x, y: centre.y } };
  }, { name: alias, by: offset });
}

/** The ref of the option named `name` (its `data-c4-option`, plumbing that names the line's hit targets). */
const refOf = (editor, name) => option(editor, name).getAttribute('data-c4-option');

/** The client points of the ends and the middle of the longest drawn segment of line `ref`. */
function longestSegment(editor, ref) {
  return canvas(editor).evaluate((region, routeId) => {
    const lines = [...region.querySelectorAll(`.uml-pg-edge-hitbox[data-route-id="${routeId}"]`)];
    const svg = region.querySelector('.c4-editor__diagram svg');
    const toClient = (x, y) => new DOMPoint(x, y).matrixTransform(svg.getScreenCTM());
    const segments = lines.map((line) => ['x1', 'y1', 'x2', 'y2'].map((name) => Number(line.getAttribute(name))));
    const longestAt = segments.reduce((best, next, index) => (Math.hypot(next[2] - next[0], next[3] - next[1])
      > Math.hypot(segments[best][2] - segments[best][0], segments[best][3] - segments[best][1]) ? index : best), 0);
    lines[longestAt].scrollIntoView({ block: 'center', inline: 'center' });
    const [x1, y1, x2, y2] = segments[longestAt];
    const middle = toClient((x1 + x2) / 2, (y1 + y2) / 2);
    return { drawing: { x: (x1 + x2) / 2, y: (y1 + y2) / 2 }, client: { x: middle.x, y: middle.y } };
  }, ref);
}

/** The bend numbers drawn now: their text and the drawing point they stand at. */
function bendNumbers(editor) {
  return canvas(editor).locator('.uml-pg-bend-number').evaluateAll((marks) => marks.map((mark) => {
    const at = /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(mark.getAttribute('transform'));
    const box = mark.getBoundingClientRect();
    return { text: mark.textContent, x: Number(at[1]), y: Number(at[2]), client: { x: box.x + box.width / 2, y: box.y + box.height / 2 } };
  }));
}

/** Presses Ctrl/Cmd+Z with focus where it is (the canvas's undo key) and waits until the document is `expected`. */
async function undoTo(page, expected, message) {
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => textOf(page), { message }).toBe(expected);
}

/** The reference model with code of policy keeping the positions `pins` and the routes `routes` (YAML lines). */
function withCodeLayout(text, pins, routes = []) {
  const positions = Object.entries(pins).map(([id, [x, y]]) => `      ${id}: [${x}, ${y}]`).join('\n');
  const routeLines = routes.length > 0 ? `\n    routes:\n${routes.map((route) => `      - ${route}`).join('\n')}` : '';
  return `${text}layout:\n  ${CODE_VIEW}:\n    positions:\n${positions}${routeLines}\n`;
}

test.describe('moves without a drag steer the module (spec §7.4)', () => {
  test('M, three presses of Right, and Enter move a class by exactly three key steps (30 units) with snapping on, as one undo step, and the result names its place', async ({ page }) => {
    // 83, 41 lies off the 10-unit grid: snapping would round a pointer's place, but a key step is exact.
    const start = withCodePins({ EnrollmentPolicy: [83, 41] });
    const editor = await openUmlEditor(page, { view: CODE_VIEW, text: start });
    await option(editor, 'EnrollmentPolicy').focus();

    await page.keyboard.press('m');
    await expect(messageRegion(editor)).toContainText(MOVING);
    for (let step = 0; step < 3; step += 1) await page.keyboard.press('ArrowRight');
    expect((await hostLog(page)).texts, 'the arrow keys move a preview only').toEqual([]);
    await page.keyboard.press('Enter');

    await expect.poll(async () => keptPositions(await textOf(page)).EnrollmentPolicy).toEqual([113, 41]);
    await expect(messageRegion(editor)).toContainText('Moved EnrollmentPolicy to 113, 41.');
    await expect(option(editor, 'EnrollmentPolicy'), 'focus is on the moved option').toBeFocused();
    await undoTo(page, start, 'one Undo takes the move back');
  });

  test('Escape in Move puts the box back', async ({ page }) => {
    const start = withCodePins({ EnrollmentPolicy: [83, 41] });
    const editor = await openUmlEditor(page, { view: CODE_VIEW, text: start });
    const before = await drawnBox(editor, 'EnrollmentPolicy');
    await option(editor, 'EnrollmentPolicy').focus();
    await page.keyboard.press('m');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');

    await page.keyboard.press('Escape');

    await expect(messageRegion(editor)).toContainText('Move canceled; EnrollmentPolicy stays where it was.');
    await expect.poll(async () => { const box = await drawnBox(editor, 'EnrollmentPolicy'); return box && [box.x, box.y]; })
      .toEqual([before && before.x, before && before.y]);
    expect((await hostLog(page)).texts, 'nothing was written').toEqual([]);
    await expect(option(editor, 'EnrollmentPolicy')).toBeFocused();
  });

  test('"Move…" then a click at a point gives the YAML that dragging the class to that point gives', async ({ page }) => {
    // In drawing units, so the same place is meant whatever the drawing's scale on the page.
    const offset = { x: -47, y: 63 };
    let editor = await openUmlEditor(page, { view: CODE_VIEW });
    await option(editor, 'EnrollmentPolicy').focus();
    await page.keyboard.press('Shift+F10');
    await item(menu(editor, 'Actions for EnrollmentPolicy'), 'Move…').click();
    await expect(messageRegion(editor)).toContainText(MOVING);
    expect((await hostLog(page)).texts, 'starting a move writes nothing').toEqual([]);
    const target = (await drawnBox(editor, 'EnrollmentPolicy', offset)).client;
    await page.mouse.click(target.x, target.y);
    await expect.poll(async () => (await hostLog(page)).texts.length).toBe(1);
    const moved = await textOf(page);

    editor = await openUmlEditor(page, { view: CODE_VIEW });
    const from = (await drawnBox(editor, 'EnrollmentPolicy')).client;
    const to = (await drawnBox(editor, 'EnrollmentPolicy', offset)).client;
    await dragBetween(page, from, to);
    await expect.poll(async () => (await hostLog(page)).texts.length).toBe(1);

    expect(moved, 'the move without a drag writes what the drag writes').toBe(await textOf(page));
  });

  test('dragging a class moves it as one undo step', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE_VIEW });
    const from = (await drawnBox(editor, 'EnrollmentPolicy')).client;

    await dragBetween(page, from, { x: from.x + 90, y: from.y + 30 });

    await expect.poll(async () => (await hostLog(page)).texts.length).toBe(1);
    expect(keptPositions(await textOf(page)).EnrollmentPolicy, 'the class keeps its new place').toBeTruthy();
    await option(editor, 'EnrollmentPolicy').focus();
    await undoTo(page, INTERFACES_REFERENCE, 'one Undo takes the drag back');
  });

  test('a drag replaces no SVG until the drop, and the drop is one dispatch', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE_VIEW });
    await canvas(editor).evaluate((region) => {
      window.replacedDrawings = 0;
      const touchesSvg = (node) => node.nodeType === 1 && (node.nodeName.toLowerCase() === 'svg' || node.querySelector('svg') !== null);
      new MutationObserver((records) => records.forEach((record) => {
        if ([...record.addedNodes, ...record.removedNodes].some(touchesSvg)) window.replacedDrawings += 1;
      })).observe(region, { childList: true, subtree: true });
    });
    const from = (await drawnBox(editor, 'EnrollmentPolicy')).client;
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 80, from.y + 40, { steps: 8 });
    expect(await page.evaluate(() => window.replacedDrawings), 'the preview moves the drawn parts in place').toBe(0);

    await page.mouse.up();

    await expect.poll(() => page.evaluate(() => window.replacedDrawings), { message: 'the drop draws the view again' }).toBeGreaterThan(0);
    expect((await hostLog(page)).texts, 'the drop is one change of the document').toHaveLength(1);
  });

  test('an external setText during a drag puts the preview back', async ({ page }) => {
    const pins = { EnrollmentPolicy: [40, 40], EnrollmentRule: [420, 40], PrerequisiteRule: [300, 320], UnitCapRule: [600, 320] };
    const start = withCodeLayout(INTERFACES_REFERENCE, pins);
    const editor = await openUmlEditor(page, { view: CODE_VIEW, text: start });
    // A change elsewhere in the drawing: UnitCapRule's operation is reworded, so the drawing is another one.
    const outside = start.replace('UnitCapRule:\n                kind: class\n                implements: [EnrollmentRule]\n                operations: ["+ evaluate(student, section): RuleResult"]',
      'UnitCapRule:\n                kind: class\n                implements: [EnrollmentRule]\n                operations: ["+ evaluate(student, section): CapResult"]');
    expect(outside).not.toBe(start);
    const before = await drawnBox(editor, 'EnrollmentPolicy');
    const from = before.client;
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 120, from.y + 60, { steps: 8 });

    await callEditor(page, 'setText', outside);
    await page.mouse.move(from.x + 140, from.y + 70, { steps: 2 });
    await page.mouse.up();

    await expect.poll(async () => { const box = await drawnBox(editor, 'EnrollmentPolicy'); return box && [Math.round(box.x), Math.round(box.y)]; },
      { message: 'the class is drawn where the document keeps it' }).toEqual([Math.round(before.x), Math.round(before.y)]);
    expect(await textOf(page), 'the drop wrote nothing').toBe(outside);
    await expect(messageRegion(editor)).toContainText('The drawing changed, so the move was cancelled.');
  });
});

test.describe('bends and the "⋯" button of a selected line (spec §7.4)', () => {
  test('a selected line\'s "⋯" button opens its menu with one click', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE_VIEW });
    await option(editor, DEPENDENCY).focus();
    const more = canvas(editor).getByRole('button', { name: `Actions for ${DEPENDENCY}`, exact: true });
    await expect(more).toBeVisible();
    const size = await more.boundingBox();
    expect(Math.min(size ? size.width : 0, size ? size.height : 0), 'the button is at least 24 × 24 CSS px').toBeGreaterThanOrEqual(MINIMUM_TARGET_PX);

    await more.click();

    await expect(menu(editor, `Actions for ${DEPENDENCY}`)).toBeVisible();
    await expect(item(menu(editor, `Actions for ${DEPENDENCY}`), 'Add a bend')).toBeFocused();
  });

  test('a press on the middle of a selected line\'s longest segment starts a bend, not the "⋯" button', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE_VIEW });
    await option(editor, DEPENDENCY).focus();
    await expect(canvas(editor).getByRole('button', { name: `Actions for ${DEPENDENCY}`, exact: true })).toBeVisible();
    const middle = (await longestSegment(editor, await refOf(editor, DEPENDENCY))).client;

    await dragBetween(page, middle, { x: middle.x + 30, y: middle.y + 50 });

    await expect.poll(async () => keptBends(await textOf(page), 'EnrollmentPolicy', 'EnrollmentRule'), { message: 'the line keeps a bend' })
      .not.toBeNull();
    await expect(menu(editor, `Actions for ${DEPENDENCY}`)).toHaveCount(0);
  });

  test('Add a bend puts it in the middle of the longest segment, shows "1" in its handle while the line is selected, and enters Move', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE_VIEW });
    await option(editor, DEPENDENCY).focus();
    const middle = (await longestSegment(editor, await refOf(editor, DEPENDENCY))).drawing;
    await page.keyboard.press('Shift+F10');

    await item(menu(editor, `Actions for ${DEPENDENCY}`), 'Add a bend').click();

    await expect(messageRegion(editor)).toContainText(/Moving bend 1 of /);
    await expect.poll(() => bendNumbers(editor)).toEqual([expect.objectContaining({ text: '1', x: middle.x, y: middle.y })]);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    expect((await hostLog(page)).texts, 'the bend is a preview until Enter').toEqual([]);
    await page.keyboard.press('Enter');
    await expect.poll(async () => keptBends(await textOf(page), 'EnrollmentPolicy', 'EnrollmentRule')).not.toBeNull();
    await expect(option(editor, DEPENDENCY), 'the line stays selected').toHaveAttribute('aria-selected', 'true');
    await expect.poll(async () => (await bendNumbers(editor)).map((mark) => mark.text)).toEqual(['1']);
  });

  test('on the dependency of code of policy, "Move bend 1…" then a click moves that bend, "Remove bend 1" removes it, and "Straighten" leaves no bend, each as one undo step', async ({ page }) => {
    // Edits within 600 ms join one undo step; the clock passes that window between the steps below.
    await page.clock.install();
    const start = withCodeLayout(INTERFACES_REFERENCE, { EnrollmentPolicy: [40, 40], EnrollmentRule: [420, 40], PrerequisiteRule: [300, 320], UnitCapRule: [600, 320] });
    const editor = await openUmlEditor(page, { view: CODE_VIEW, text: start });
    const lineMenu = menu(editor, `Actions for ${DEPENDENCY}`);
    for (let added = 0; added < 2; added += 1) {
      await option(editor, DEPENDENCY).focus();
      await page.keyboard.press('Shift+F10');
      await item(lineMenu, 'Add a bend').click();
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await expect(messageRegion(editor)).not.toContainText(MOVING);
      await page.clock.fastForward(1000);
    }
    expect(keptBends(await textOf(page), 'EnrollmentPolicy', 'EnrollmentRule'), 'the line keeps two bends').toHaveLength(4);

    /** Runs `act` from the line's menu and checks that it changed the document as one undo step. */
    async function oneUndoStep(act) {
      const before = await textOf(page);
      await option(editor, DEPENDENCY).focus();
      await page.keyboard.press('Shift+F10');
      await act();
      await expect.poll(() => textOf(page)).not.toBe(before);
      await option(editor, DEPENDENCY).focus();
      await undoTo(page, before, 'one Undo takes it back');
      await page.keyboard.press('ControlOrMeta+Shift+z');
      await expect.poll(() => textOf(page)).not.toBe(before);
      await page.clock.fastForward(1000);
    }

    await oneUndoStep(async () => {
      await item(lineMenu, 'Move bend 1…').click();
      await expect(messageRegion(editor)).toContainText(/Moving bend 1 of /);
      const bend = (await bendNumbers(editor)).find((mark) => mark.text === '1');
      if (!bend) throw new Error('bend 1 shows no number');
      await page.mouse.click(bend.client.x + 30, bend.client.y + 40);
    });
    await oneUndoStep(() => item(lineMenu, 'Remove bend 1').click());
    expect(keptBends(await textOf(page), 'EnrollmentPolicy', 'EnrollmentRule'), 'one bend is left').toHaveLength(3);
    await oneUndoStep(() => item(lineMenu, 'Straighten').click());
    expect(keptBends(await textOf(page), 'EnrollmentPolicy', 'EnrollmentRule'), 'a straight line keeps its two ends').toHaveLength(2);
  });
});

test.describe('ends, menus, and in-place editors (spec §7.4)', () => {
  test('"Move to…" on the dependency\'s target end lists the possible targets first and the others disabled with their short reason, and the choice is one undo step', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE_VIEW });
    await option(editor, DEPENDENCY).focus();
    await page.keyboard.press('Shift+F10');

    await item(menu(editor, `Actions for ${DEPENDENCY}`), 'Move the target end to…').click();

    const chooser = editor.getByRole('menu', { name: /^Move the target end of / });
    await expect(chooser.getByRole('menuitem')).toHaveText(['PrerequisiteRule', 'UnitCapRule', /^EnrollmentPolicy /]);
    const self = sharedActions.endsProblem(C4.load(INTERFACES_REFERENCE).model, 'EnrollmentPolicy', 'EnrollmentPolicy');
    expect(self && self.code).toBe('self-loop');
    await expect(chooser.getByRole('menuitem').nth(2)).toHaveAttribute('aria-disabled', 'true');
    await expect(chooser.getByRole('menuitem', { name: 'PrerequisiteRule', exact: true })).not.toHaveAttribute('aria-disabled', 'true');
    await chooser.getByRole('menuitem', { name: 'PrerequisiteRule', exact: true }).click();

    await expect.poll(async () => C4.load(await textOf(page)).model.relationships
      .filter((relationship) => relationship.sourceId === 'EnrollmentPolicy').map((relationship) => relationship.targetId))
      .toEqual(['PrerequisiteRule']);
    expect((await hostLog(page)).texts, 'one change').toHaveLength(1);
    await option(editor, 'EnrollmentPolicy').focus();
    await undoTo(page, INTERFACES_REFERENCE, 'one Undo takes the move back');
  });

  test('F2 opens "Name of class EnrollmentPolicy" with its instruction line', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE_VIEW });
    await option(editor, 'EnrollmentPolicy').focus();

    await page.keyboard.press('F2');

    const field = nameEditor(editor, 'Name of class EnrollmentPolicy');
    await expect(field).toBeFocused();
    await expect(field).toHaveValue('EnrollmentPolicy');
    await expect(field).toHaveAccessibleDescription(NAME_INSTRUCTION);
    await expect(editor.getByText(NAME_INSTRUCTION, { exact: true }), 'the instruction is visible').toBeVisible();
    await page.keyboard.type('EligibilityPolicy');
    await page.keyboard.press('Enter');
    await expect.poll(async () => C4.load(await textOf(page)).model.elements.get('EnrollmentPolicy').name).toBe('EligibilityPolicy');
  });

  test('a double-click on a class edits its name in place and opens no view', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE_VIEW });
    const title = await canvas(editor).getAttribute('aria-label');
    const centre = (await drawnBox(editor, 'UnitCapRule')).client;

    await page.mouse.dblclick(centre.x, centre.y);

    await expect(nameEditor(editor, 'Name of class UnitCapRule')).toBeFocused();
    await expect(canvas(editor)).toHaveAttribute('aria-label', title || '');
    expect((await hostLog(page)).views, 'no view opened').toEqual([]);
  });

  test('Enter on a class says there is nothing to open', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE_VIEW });
    await option(editor, 'EnrollmentPolicy').focus();

    await page.keyboard.press('Enter');

    await expect.poll(async () => (await hostLog(page)).announced).toContain('There is nothing to open on EnrollmentPolicy.');
    await expect(canvas(editor)).toHaveAccessibleName(`Canvas: ${C4.project(C4.load(INTERFACES_REFERENCE), CODE_VIEW).title}`);
  });

  test('Shift+F10 opens the focused option\'s menu', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE_VIEW });
    await option(editor, 'EnrollmentPolicy').focus();

    await page.keyboard.press('Shift+F10');

    const actions = menu(editor, 'Actions for EnrollmentPolicy');
    await expect(actions).toBeVisible();
    await expect(actions.getByRole('menuitem').first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(actions).toHaveCount(0);
    await expect(option(editor, 'EnrollmentPolicy'), 'closing the menu gives focus back').toBeFocused();
  });

  test('a menu item that cannot run is aria-disabled with its short reason, and activating it shows the sentence', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE_VIEW });
    const line = 'PrerequisiteRule implements EnrollmentRule';
    const routed = refusalTable.verdict('layout/inheritance-line', {});
    await option(editor, line).focus();
    await page.keyboard.press('Shift+F10');
    const addBend = menu(editor, `Actions for ${line}`).getByRole('menuitem', { name: /^Add a bend/ });

    await expect(addBend).toHaveAttribute('aria-disabled', 'true');
    await expect(addBend).toContainText(routed.summary || '');
    await expect(addBend, 'the first item has focus').toBeFocused();
    await page.keyboard.press('Enter');

    await expect(menu(editor, `Actions for ${line}`), 'the sentence shows with the menu').toHaveAccessibleDescription(routed.message);
    await expect(editor.getByText(routed.message, { exact: true }), 'the sentence is visible').toBeVisible();
    expect((await hostLog(page)).texts, 'nothing was written').toEqual([]);
  });

  test('Escape closes the in-place editor, then the menu, then Move, then full screen, then the selection', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE_VIEW });
    const full = editor.getByRole('button', { name: 'Full screen' });
    await option(editor, 'EnrollmentPolicy').focus();
    await page.keyboard.press('f');
    await expect(full).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('F2');
    await expect(nameEditor(editor, 'Name of class EnrollmentPolicy')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(nameEditor(editor, 'Name of class EnrollmentPolicy')).toHaveCount(0);
    await expect(option(editor, 'EnrollmentPolicy')).toBeFocused();
    await expect(full, 'the editor was the only layer closed').toHaveAttribute('aria-pressed', 'true');

    await page.keyboard.press('m');
    await expect(messageRegion(editor)).toContainText(MOVING);
    await page.keyboard.press('Shift+F10');
    const actions = menu(editor, 'Actions for EnrollmentPolicy');
    await expect(actions).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(actions).toHaveCount(0);
    await expect(messageRegion(editor), 'the menu was the only layer closed').toContainText(MOVING);

    await page.keyboard.press('Escape');
    await expect(messageRegion(editor)).toContainText('Move canceled; EnrollmentPolicy stays where it was.');
    await expect(full).toHaveAttribute('aria-pressed', 'true');

    await page.keyboard.press('Escape');
    await expect(full).toHaveAttribute('aria-pressed', 'false');
    await expect(option(editor, 'EnrollmentPolicy')).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('Escape');
    await expect(option(editor, 'EnrollmentPolicy')).toHaveAttribute('aria-selected', 'false');
    expect((await hostLog(page)).texts, 'nothing was written').toEqual([]);
  });

  test('an external setText while an in-place editor is open refuses the commit as stale, keeps the typed text, and changes nothing', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE_VIEW });
    await option(editor, 'EnrollmentPolicy').focus();
    await page.keyboard.press('F2');
    const field = nameEditor(editor, 'Name of class EnrollmentPolicy');
    await field.fill('EligibilityPolicy');
    // The tutorial's Reset or YAML typed elsewhere: UnitCapRule's operation is reworded, so the drawing changes.
    const outside = INTERFACES_REFERENCE.replace('UnitCapRule:\n                kind: class\n                implements: [EnrollmentRule]\n                operations: ["+ evaluate(student, section): RuleResult"]',
      'UnitCapRule:\n                kind: class\n                implements: [EnrollmentRule]\n                operations: ["+ evaluate(student, section): CapResult"]');
    await callEditor(page, 'setText', outside);
    await expect(field, 'the editor stays open over the new drawing').toBeVisible();

    await field.press('Enter');

    const stale = refusalTable.verdict('stale', {}).message;
    await expect(messageRegion(editor)).toContainText(stale);
    await expect(field).toHaveValue('EligibilityPolicy');
    expect(await textOf(page), 'nothing was written').toBe(outside);
  });
});

test.describe('C mode: drawing a line through the marked targets (spec §7.4)', () => {
  /** The marks drawn now: `{ ref, possible, struck, dashed, stroke }` for each, in the drawing's order. */
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

  test('during C on EnrollmentPolicy the possible and other targets carry their two marks in both themes', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE_VIEW, siteThemes: true });
    await option(editor, 'EnrollmentPolicy').focus();
    await page.keyboard.press('c');

    for (const theme of ['light', 'dark']) {
      if (theme === 'dark') await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
      await expect.poll(() => targetMarks(editor), { message: `the marks in ${theme} mode` }).toEqual([
        { ref: 'EnrollmentPolicy', possible: false, struck: true, dashed: false, shown: true },
        { ref: 'EnrollmentRule', possible: true, struck: false, dashed: true, shown: true },
        { ref: 'PrerequisiteRule', possible: true, struck: false, dashed: true, shown: true },
        { ref: 'UnitCapRule', possible: true, struck: false, dashed: true, shown: true },
      ]);
    }
  });

  test('in C mode the arrow keys reach the possible targets first, then the others, each described "not available: <short reason>", and Enter on one shows its sentence', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE_VIEW });
    await option(editor, 'EnrollmentPolicy').focus();
    await page.keyboard.press('c');
    await expect(messageRegion(editor)).toContainText(/^Drawing a line from EnrollmentPolicy/);

    const reached = [];
    for (let press = 0; press < 4; press += 1) {
      await page.keyboard.press('ArrowRight');
      reached.push(await focusedOption(page, editor).evaluate((target) => target.querySelector('title').textContent));
    }

    expect(reached).toEqual(['EnrollmentRule', 'PrerequisiteRule', 'UnitCapRule', 'EnrollmentPolicy']);
    await expect(option(editor, 'EnrollmentPolicy')).toHaveAccessibleDescription(/^not available: \S/);
    await expect(option(editor, 'UnitCapRule')).not.toHaveAccessibleDescription(/not available/);
    await page.keyboard.press('Enter');
    const sentence = sharedActions.endsProblem(C4.load(INTERFACES_REFERENCE).model, 'EnrollmentPolicy', 'EnrollmentPolicy').message;
    await expect(messageRegion(editor)).toContainText(sentence.replace(/^Error: /, ''));
    expect((await hostLog(page)).texts, 'nothing was written').toEqual([]);
  });
});

test.describe('focus after deletes and moves (spec §7.7)', () => {
  test('after a delete focus goes to the next option, after a move to the moved option', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE_VIEW });
    await option(editor, 'PrerequisiteRule').focus();

    await page.keyboard.press('Delete');
    await editor.getByRole('dialog', { name: 'Delete PrerequisiteRule?' }).getByRole('button', { name: 'Delete' }).click();

    await expect(option(editor, 'PrerequisiteRule')).toHaveCount(0);
    await expect(option(editor, 'UnitCapRule'), 'the next option in reading order').toBeFocused();
    await page.keyboard.press('m');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect.poll(async () => keptPositions(await textOf(page)).UnitCapRule).toBeTruthy();
    await expect(option(editor, 'UnitCapRule'), 'the moved option').toBeFocused();
  });

  test('an inspector reveal scrolls only the inspector and the focused option stays in view', async ({ page }) => {
    // 700 CSS px stacks the regions (the editor's layout breakpoint).
    await page.setViewportSize({ width: 700, height: 800 });
    const editor = await openUmlEditor(page, { view: CODE_VIEW });
    await option(editor, 'EnrollmentPolicy').focus();
    const before = await page.evaluate(() => ({ page: window.scrollY }));
    const canvasScroll = await canvas(editor).evaluate((region) => region.scrollTop);

    await page.keyboard.press('ArrowRight');

    const next = focusedOption(page, editor);
    await expect(next).toHaveCount(1);
    await expect(editor.getByRole('region', { name: 'Inspector' })).toContainText('EnrollmentRule');
    expect(await page.evaluate(() => window.scrollY), 'the page did not scroll').toBe(before.page);
    expect(await canvas(editor).evaluate((region) => region.scrollTop), 'the canvas did not scroll').toBe(canvasScroll);
    await expect(next).toBeInViewport();
  });
});

/** The box's menu item "Return to automatic layout", and the document it writes. */
async function returnToAutomaticLayout(page, editor, name) {
  const writes = (await hostLog(page)).texts.length;
  await option(editor, name).focus();
  await page.keyboard.press('Shift+F10');
  await item(menu(editor, `Actions for ${name}`), 'Return to automatic layout').click();
  await expect.poll(async () => (await hostLog(page)).texts.length).toBe(writes + 1);
}

test.describe('overlaps are never silent (spec §6 rule 4)', () => {
  // Every class of code of policy kept apart: EnrollmentPolicy at the top left, UnitCapRule close below it.
  const APART = { EnrollmentPolicy: [40, 40], EnrollmentRule: [420, 40], PrerequisiteRule: [420, 320], UnitCapRule: [40, 160] };
  const GROWN = INTERFACES_REFERENCE.replace('operations: ["+ decide(student, section): Decision"]',
    'operations: ["+ decide(student, section): Decision", "+ explain(decision): Reason", "+ cap(student): Units", "+ prerequisites(section): Courses", "+ history(student): Courses", "+ audit(decision): Record"]');

  /** The pairs of drawn boxes `aliases` that overlap now. */
  function overlapping(editor, aliases) {
    return canvas(editor).evaluate((region, names) => {
      const svg = region.querySelector('.c4-editor__diagram svg');
      const boxes = names.map((name) => [name, window.UMLShared.renderedLayoutBox(svg, name)]);
      const pairs = [];
      boxes.forEach(([a, boxA], i) => boxes.slice(i + 1).forEach(([b, boxB]) => {
        if (boxA.x < boxB.x + boxB.width && boxB.x < boxA.x + boxA.width && boxA.y < boxB.y + boxB.height && boxB.y < boxA.y + boxA.height) pairs.push([a, b]);
      }));
      return pairs;
    }, aliases);
  }

  test('a class that grows over another raises the overlap notice, and its offer moves it to a free place', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE_VIEW, text: withCodeLayout(INTERFACES_REFERENCE, APART) });
    const classes = Object.keys(APART);
    expect(await overlapping(editor, classes), 'apart at first').toEqual([]);
    await expect(messageRegion(editor)).not.toContainText('overlaps');

    await callEditor(page, 'setText', withCodeLayout(GROWN, APART));

    await expect(messageRegion(editor)).toContainText('EnrollmentPolicy now overlaps UnitCapRule.');
    const offer = messageRegion(editor).getByRole('button', { name: 'Move EnrollmentPolicy to a free place', exact: true });
    await offer.click();
    await expect.poll(async () => keptPositions(await textOf(page)).EnrollmentPolicy).not.toEqual(APART.EnrollmentPolicy);
    await expect.poll(() => overlapping(editor, classes), { message: 'no box overlaps another' }).toEqual([]);
    await expect(option(editor, 'EnrollmentPolicy'), 'focus is on the moved box').toBeFocused();
  });

  test('a pair already named is not named again after an unrelated edit while it stays overlapped', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE_VIEW, text: withCodeLayout(INTERFACES_REFERENCE, APART) });
    await callEditor(page, 'setText', withCodeLayout(GROWN, APART));
    await expect(messageRegion(editor)).toContainText('EnrollmentPolicy now overlaps UnitCapRule.');

    // An edit that changes no box: the system's description.
    await callEditor(page, 'setText', withCodeLayout(GROWN, APART).replace('Plans term schedules and enrolls students in their sections.',
      'Plans term schedules and enrolls each student in every section of a plan.'));

    await expect.poll(async () => (await hostLog(page)).announced.filter((said) => said.includes('now overlaps')).length,
      { message: 'the pair was named once' }).toBe(1);
    await expect(messageRegion(editor)).not.toContainText('overlaps');
  });

  test('a class dropped from the Class tile onto a pinned class raises the notice', async ({ page }) => {
    // Tall enough that the tile and the class are both in view: a drag needs both ends on screen at once, and reading
    // one end's place must not scroll the other away.
    await page.setViewportSize({ width: 1280, height: 1600 });
    const editor = await openUmlEditor(page, { view: CODE_VIEW, text: withCodeLayout(INTERFACES_REFERENCE, APART) });
    // The palette offers the view's own tools (Class, Abstract class, …; spec §7.6).
    const tile = editor.getByRole('group', { name: 'Add to the diagram' }).getByRole('button', { name: 'Class', exact: true });
    const from = await centreOf(tile);
    const onto = (await drawnBox(editor, 'UnitCapRule')).client;
    expect(await centreOf(tile), 'reading the class\'s place scrolled nothing').toEqual(from);

    await dragBetween(page, from, onto);

    await expect.poll(async () => C4.load(await textOf(page)).model.elements.get('policy').childIds.length).toBe(5);
    const added = C4.load(await textOf(page)).model.elements.get('policy').childIds.find((id) => !(id in APART) && id !== 'UnitCapRule');
    const name = C4.load(await textOf(page)).model.elements.get(added || '').name;
    await expect(messageRegion(editor)).toContainText(`${name} now overlaps UnitCapRule.`);
  });

  test('returning a pinned class to automatic layout where another class is pinned raises the notice', async ({ page }) => {
    // UnitCapRule is kept 80 units right of and 30 below where EnrollmentPolicy is drawn once it returns to automatic
    // layout, so the two overlap. A kept place is in the layout's frame, which the renderer draws shifted to fit the drawing's margins; a
    // first run finds where EnrollmentPolicy lands and that shift (a kept box's drawn place less its kept place).
    const away = { EnrollmentPolicy: [900, 600], UnitCapRule: [100, 100] };
    let editor = await openUmlEditor(page, { view: CODE_VIEW, text: withCodeLayout(INTERFACES_REFERENCE, away) });
    await returnToAutomaticLayout(page, editor, 'EnrollmentPolicy');
    const landing = await drawnBox(editor, 'EnrollmentPolicy');
    const kept = await drawnBox(editor, 'UnitCapRule');
    const spot = [Math.round(landing.x - (kept.x - away.UnitCapRule[0])) + 80, Math.round(landing.y - (kept.y - away.UnitCapRule[1])) + 30];
    editor = await openUmlEditor(page, { view: CODE_VIEW, text: withCodeLayout(INTERFACES_REFERENCE, { EnrollmentPolicy: [900, 600], UnitCapRule: spot }) });
    await expect(messageRegion(editor)).not.toContainText('overlaps');

    await returnToAutomaticLayout(page, editor, 'EnrollmentPolicy');

    await expect.poll(async () => keptPositions(await textOf(page)).EnrollmentPolicy).toBeUndefined();
    await expect(messageRegion(editor)).toContainText('EnrollmentPolicy now overlaps UnitCapRule.');
  });

  test('a lifted box that appears in code of policy through a dependency added to the YAML, and lands on a pinned class, is named when code of policy is drawn next', async ({ page }) => {
    const withDependency = INTERFACES_REFERENCE.replace('collaborators: {EnrollmentRule: delegates each eligibility check to}',
      'collaborators: {EnrollmentRule: delegates each eligibility check to, seats: looks up held seats through}');
    // UnitCapRule is kept where Seat Gateway is drawn once the dependency exists. A first run finds that place and the
    // shift between the layout's frame and the drawing (a kept box's drawn place less its kept place).
    const others = { EnrollmentPolicy: [40, 40], EnrollmentRule: [420, 40], PrerequisiteRule: [40, 400] };
    const away = Object.assign({ UnitCapRule: [1200, 900] }, others);
    let editor = await openUmlEditor(page, { view: CODE_VIEW, text: withCodeLayout(withDependency, away) });
    const seats = await drawnBox(editor, 'Seat_Gateway');
    const kept = await drawnBox(editor, 'UnitCapRule');
    const pins = Object.assign({}, others, {
      UnitCapRule: [Math.round(seats.x - (kept.x - away.UnitCapRule[0])), Math.round(seats.y - (kept.y - away.UnitCapRule[1]))],
    });
    editor = await openUmlEditor(page, { view: CODE_VIEW, text: withCodeLayout(INTERFACES_REFERENCE, pins) });
    await expect(messageRegion(editor)).not.toContainText('overlaps');
    await callEditor(page, 'openView', CONTAINERS);
    await callEditor(page, 'setText', withCodeLayout(withDependency, pins));

    await callEditor(page, 'openView', CODE_VIEW);

    await expect(messageRegion(editor)).toContainText('Seat Gateway now overlaps UnitCapRule.');
  });
});

test.describe('print, export, locks, and two editors', () => {
  test('print shows the drawing light with no hit layer, mark, menu, or message region', async ({ page }) => {
    // A page prints in light mode whatever theme the reader saved: on the site the print controller takes dark mode
    // away (the built-site print audit checks that path); this page has the site's themes and starts light.
    const editor = await openUmlEditor(page, { view: CODE_VIEW, siteThemes: true });
    await option(editor, 'EnrollmentPolicy').focus();
    await page.keyboard.press('c');
    await expect(canvas(editor).locator('.uml-pg-target-mark').first()).toBeVisible();
    await expect(messageRegion(editor)).toBeVisible();

    await page.emulateMedia({ media: 'print' });

    await expect(canvas(editor).locator(HIT_LAYER)).toBeHidden();
    await expect(canvas(editor).locator('.uml-pg-target-mark').first(), 'no target mark prints').toBeHidden();
    await expect(messageRegion(editor)).toBeHidden();
    const filters = await canvas(editor).locator('.c4-editor__diagram').evaluate((diagram) => [getComputedStyle(diagram).filter,
      getComputedStyle(diagram.querySelector('svg')).filter]);
    expect(filters, 'print draws the drawing as it is, without a filter').toEqual(['none', 'none']);

    await page.emulateMedia({ media: 'screen' });
    await page.keyboard.press('Escape');
    await page.keyboard.press('Shift+F10');
    await expect(menu(editor, 'Actions for EnrollmentPolicy')).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    await expect(menu(editor, 'Actions for EnrollmentPolicy'), 'no menu prints').toBeHidden();
  });

  test('Download SVG of an edited code view contains no hit layer and no mark', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE_VIEW, exportSvg: true });
    const from = (await drawnBox(editor, 'EnrollmentPolicy')).client;
    await dragBetween(page, from, { x: from.x + 60, y: from.y + 20 });
    await expect.poll(async () => (await hostLog(page)).texts.length).toBe(1);
    await option(editor, 'EnrollmentPolicy').focus();
    await page.keyboard.press('c');
    await expect(canvas(editor).locator('.uml-pg-target-mark').first()).toBeAttached();

    await editor.getByRole('button', { name: 'Download SVG', exact: true }).click();

    await expect.poll(async () => (await hostLog(page)).exported.length).toBe(1);
    const svg = (await hostLog(page)).exported[0];
    expect(svg).toContain('EnrollmentPolicy');
    expect(svg).not.toContain('uml-pg-edit-layer');
    expect(svg).not.toContain('uml-pg-target-mark');
  });

  test('a press on a locked class shows "Locked: …" in the message region', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE_VIEW, lockedFields: ['layout'] });
    const from = (await drawnBox(editor, 'EnrollmentPolicy')).client;

    await dragBetween(page, from, { x: from.x + 60, y: from.y + 30 });

    await expect(messageRegion(editor)).toContainText(/Locked: /);
    expect((await hostLog(page)).texts, 'nothing was written').toEqual([]);
  });

  test('two editors in code views keep distinct ids and Escape in one leaves the other\'s menu open', async ({ page }) => {
    const [first, second] = await openTwoUmlEditors(page, { view: CODE_VIEW }, { view: CODE_VIEW });
    await option(second, 'EnrollmentPolicy').focus();
    await page.keyboard.press('Shift+F10');
    const secondMenu = menu(second, 'Actions for EnrollmentPolicy');
    await expect(secondMenu).toBeVisible();
    // Every id the editors, their sessions, menus, and listboxes give. The renderer's shared <defs> (shadow and texture
    // patterns that every UML drawing repeats) are the bundle's, not the editors': left out here, and reported.
    const duplicates = await page.evaluate(() => {
      const seen = new Map();
      document.querySelectorAll('[id]').forEach((element) => {
        if (!element.closest('defs')) seen.set(element.id, (seen.get(element.id) || 0) + 1);
      });
      return [...seen].filter(([, count]) => count > 1).map(([id]) => id);
    });
    expect(duplicates, 'no two elements of the editors share an id').toEqual([]);

    // A key pressed in the first editor reaches only the first editor's listeners.
    await option(first, 'EnrollmentPolicy').evaluate((target) => target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));

    await expect(secondMenu).toBeVisible();
    await expect(menu(first, 'Actions for EnrollmentPolicy')).toHaveCount(0);
  });
});

test.describe('accessibility of the paths without a drag', () => {
  for (const width of [320, 1440]) {
    test(`auditInteractiveState with a tool armed, in Move, with an in-place editor, a chooser, a refusal with an offer, and the relationship form open, in light and dark mode, at ${width} CSS px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const editor = await openUmlEditor(page, { view: CODE_VIEW, siteThemes: true, text: WITH_NEIGHBOURS });
      const audit = (state) => auditInteractiveState(page, `C4 editor code view ${state} at ${width} px`, { include: '#editor' });

      await option(editor, 'EnrollmentPolicy').focus();
      await page.keyboard.press('c');
      await expect(messageRegion(editor)).toContainText(/^Drawing a line/);
      await audit('with C armed');
      await page.keyboard.press('Escape');

      await page.keyboard.press('m');
      await expect(messageRegion(editor)).toContainText(MOVING);
      await audit('in Move');
      await page.keyboard.press('Escape');

      await page.keyboard.press('F2');
      await expect(nameEditor(editor, 'Name of class EnrollmentPolicy')).toBeFocused();
      await audit('with an in-place editor');
      await page.keyboard.press('Escape');

      await option(editor, ASKS_POLICY).focus();
      await page.keyboard.press('Shift+F10');
      await item(menu(editor, `Actions for ${ASKS_POLICY}`), 'Move the target end to…').click();
      await expect(editor.getByRole('menu', { name: /^Move the target end of / })).toBeVisible();
      await audit('with a chooser');
      await page.keyboard.press('Escape');

      await optionSet(editor, NEIGHBOURS).getByRole('option', { name: 'Seat Gateway', exact: true }).focus();
      await page.keyboard.press('F2');
      await expect(messageRegion(editor).getByRole('button', { name: /^Open / })).toBeVisible();
      await audit('with a refusal and its offer');

      await option(editor, 'EnrollmentPolicy').focus();
      await page.keyboard.press('c');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Enter');
      const kinds = editor.getByRole('menu', { name: /^Draw a line from EnrollmentPolicy to / });
      await expect(kinds).toBeVisible();
      await item(kinds, 'Dependency').click();
      await expect(editor.getByRole('dialog')).toBeVisible();
      await audit('with the relationship form open');
    });
  }
});
