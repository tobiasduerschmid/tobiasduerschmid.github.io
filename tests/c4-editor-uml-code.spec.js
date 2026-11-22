// @ts-check
// The code view `code of policy` edited end to end on the C4 editor (UML-view editing spec §5.2, §5.6, §6, §7.3–§7.7;
// plan Task 41): the palette offers the view module's tools and lists the notation's other tools as unavailable, with
// their reasons; the inspector's Position section and the toolbar's Reset layout work on the view's kept positions;
// "New scenario…" and "New environment…" reach the views a model without scenarios or environments lacks; every main
// row of §5.2 has a keyboard path, a pointer path, and (where the row has one) a drag, each one undo step; a class
// added without a drop point lands on no other box; a class just added is named in place and takes the id of its
// first name; a line drawn between two classes asks which kind, listing the kinds this design model cannot record.
//
// Pages come from tests/helpers/c4-uml-editing.js (the editor from the ArchUML manifests, with the diagram editor's
// `core` group). Facts about the model come from the C4 core, and a sentence is compared with the function that owns
// its words (the refusal table). Drawing coordinates are read with the bundle's `UMLShared.renderedLayoutBox`, and the
// session's segment targets by the class `uml-pg-edge-hitbox`, which spec §3.7 keeps as a contract of the module.
const { test, expect } = require('@playwright/test');
const { auditInteractiveState } = require('./a11y-helpers');
const { centreOf, dragBetween, emptySpotInCanvas } = require('./helpers/c4-editor-page.js');
const {
  C4, INTERFACES_REFERENCE, openUmlEditor, hostLog, canvas, elements, option, messageRegion,
} = require('./helpers/c4-uml-editing.js');
const refusalTable = require('../js/ArchUML/c4/editor/c4-editor-uml-refusals.js');

const CODE_VIEW = 'code of policy';
const POLICY = 'policy';
const CLASSES = ['EnrollmentPolicy', 'EnrollmentRule', 'PrerequisiteRule', 'UnitCapRule'];
// The tools a code view offers a novice and an expert alike (spec §5.2), in the palette's order.
const ELEMENT_TOOLS = ['Class', 'Abstract class', 'Interface', 'Enum'];
const MORE_TOOLS = 'More UML tools (not available here)';
// The three lines this design model records between code elements (spec §5.2), in the palette's order, and the
// association tools it has no place for (spec §5.6).
const LINE_KINDS = ['Generalization', 'Realization', 'Dependency'];
const ASSOCIATIONS = ['Composition', 'Aggregation', 'Association'];
// An unavailable tool is listed before any line is drawn, so its sentence speaks of "the source" and "the target".
const ROLE_WORDS = { Source: 'the source', Target: 'the target' };

const textOf = (page) => page.evaluate(() => window.c4Editors.editor.getText());
const palette = (editor) => editor.getByRole('group', { name: 'Add to the diagram', exact: true });
const button = (editor, name) => editor.getByRole('button', { name, exact: true });
const menu = (editor, name) => editor.getByRole('menu', { name, exact: true });
const inspector = (editor) => editor.getByRole('region', { name: 'Inspector' });
const nameEditor = (editor, name) => editor.getByRole('textbox', { name, exact: true });

/** The reference model with code of policy keeping the positions `pins` (`{ id: [x, y] }`). */
function withCodePins(pins) {
  const lines = Object.entries(pins).map(([id, [x, y]]) => `      ${id}: [${x}, ${y}]`).join('\n');
  return `${INTERFACES_REFERENCE}layout:\n  ${CODE_VIEW}:\n    positions:\n${lines}\n`;
}

// The four classes kept apart from each other, so a box added beside them is the only one that could overlap.
const APART = { EnrollmentPolicy: [40, 40], EnrollmentRule: [340, 40], PrerequisiteRule: [40, 300], UnitCapRule: [340, 300] };

/** `text` without its top-level section `key` (the lines from `key:` up to the next top-level key). */
function withoutSection(text, key) {
  const lines = text.split('\n');
  const start = lines.indexOf(`${key}:`);
  if (start < 0) throw new Error(`no top-level ${key} in the fixture`);
  const end = lines.findIndex((line, index) => index > start && /^[a-z]/.test(line));
  return lines.slice(0, start).concat(lines.slice(end)).join('\n');
}

/** Where code of policy keeps each box in `text`, as `{ id: [x, y] }` (none: an empty object). */
function keptPositions(text) {
  const view = C4.project(C4.load(text), CODE_VIEW);
  return view.layout ? Object.fromEntries(view.layout.positions) : {};
}

/** The code elements of Enrollment Policy in `text`, by id. */
function codeElements(text) {
  const model = C4.load(text).model;
  return Object.fromEntries(model.elements.get(POLICY).childIds.map((id) => [id, model.elements.get(id)]));
}

/**
 * Every box the canvas draws for code of policy, by alias: its top-left corner and size in drawing units. The aliases
 * are the options' refs (`data-c4-option`, plumbing), lines (`rel:<n>`) left out.
 */
function drawnBoxes(editor) {
  return canvas(editor).evaluate((region) => {
    const svg = region.querySelector('.c4-editor__diagram svg');
    const refs = [...region.querySelectorAll('[data-c4-option]')].map((node) => node.getAttribute('data-c4-option'))
      .filter((ref) => !/^rel:/.test(ref));
    return Object.fromEntries(refs.map((ref) => {
      const box = window.UMLShared.renderedLayoutBox(svg, ref);
      return [ref, box && { x: box.x, y: box.y, width: box.width, height: box.height }];
    }));
  });
}

/** The pairs of `boxes` (by alias) whose rectangles overlap. */
function overlappingPairs(boxes) {
  const entries = Object.entries(boxes);
  const overlaps = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  return entries.flatMap(([a, boxA], index) => entries.slice(index + 1)
    .filter(([, boxB]) => overlaps(boxA, boxB)).map(([b]) => `${a} and ${b}`));
}

/** The client point `point` (client px) in the drawing units of the canvas's drawing. */
function drawingPointOf(editor, point) {
  return canvas(editor).evaluate((region, at) => {
    const svg = region.querySelector('.c4-editor__diagram svg');
    const inDrawing = new DOMPoint(at.x, at.y).matrixTransform(svg.getScreenCTM().inverse());
    return { x: inDrawing.x, y: inDrawing.y };
  }, point);
}

/** The client point of the centre of box `alias`, after scrolling its hit target into view. */
function boxCentre(editor, alias) {
  return canvas(editor).evaluate((region, name) => {
    const svg = region.querySelector('.c4-editor__diagram svg');
    const hit = [...region.querySelectorAll('.uml-pg-edit-hitbox')].find((target) => target.getAttribute('data-layout-id') === name);
    if (hit) hit.scrollIntoView({ block: 'center', inline: 'center' });
    const box = window.UMLShared.renderedLayoutBox(svg, name);
    const centre = new DOMPoint(box.x + box.width / 2, box.y + box.height / 2).matrixTransform(svg.getScreenCTM());
    return { x: centre.x, y: centre.y };
  }, alias);
}

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

/** The in-place name editor of a class just added: Escape keeps its placeholder. */
async function keepPlaceholder(page, editor) {
  await expect(nameEditor(editor, 'Name of class New class')).toBeFocused();
  await page.keyboard.press('Escape');
}

// ---- The palette (spec §5.6, §7.6) ----------------------------------------------------------------------------------

test.describe('the palette of an edited code view', () => {
  test('the palette of code of policy shows Class, Abstract class, Interface, and Enum, then the three line tools, and the disclosure lists Composition with "Composition: not recorded in this design model"', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE_VIEW, profile: 'novice' });

    // Spec §7.4 "Draw a line": click the tool, then the source, then the target.
    await expect(palette(editor).getByRole('button')).toHaveText([...ELEMENT_TOOLS, ...LINE_KINDS]);
    const more = button(editor, MORE_TOOLS);
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await more.click();
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    const composition = button(editor, 'Composition: not recorded in this design model');
    await expect(composition).toBeVisible();
    await expect(composition).toHaveAttribute('aria-disabled', 'true');
    for (const name of ASSOCIATIONS) {
      const summary = refusalTable.verdict('not-in-model/association', ROLE_WORDS).summary || '';
      await expect(button(editor, `${name}: ${summary.charAt(0).toLowerCase()}${summary.slice(1)}`)).toHaveAttribute('aria-disabled', 'true');
    }
  });

  test('the expert profile\'s palette adds Function and Module', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE_VIEW, profile: 'expert' });

    await expect(palette(editor).getByRole('button')).toHaveText([...ELEMENT_TOOLS, 'Function', 'Module', ...LINE_KINDS]);
  });

  test('activating a disabled tool shows its sentence and changes nothing', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE_VIEW });
    await button(editor, MORE_TOOLS).click();

    // A disabled control stays focusable (aria-disabled), so a keyboard user reaches it and hears why.
    await button(editor, 'Composition: not recorded in this design model').focus();
    await page.keyboard.press('Enter');

    const sentence = refusalTable.verdict('not-in-model/association', ROLE_WORDS).message;
    await expect(messageRegion(editor)).toContainText('Not done:');
    await expect(messageRegion(editor)).toContainText(sentence);
    expect((await hostLog(page)).texts, 'nothing was written').toEqual([]);
  });

  test('key A opens the Add menu with the view\'s tools, then the unavailable ones disabled', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE_VIEW });
    await option(editor, 'EnrollmentPolicy').focus();

    await page.keyboard.press('a');

    const add = menu(editor, 'Add');
    for (const name of ELEMENT_TOOLS) await expect(add.getByRole('menuitem', { name, exact: true })).not.toHaveAttribute('aria-disabled', 'true');
    await expect(add.getByRole('menuitem', { name: /^Composition / })).toHaveAttribute('aria-disabled', 'true');
  });
});

// ---- Position and Reset layout (spec §6, §7.6) -------------------------------------------------------------------

test.describe('kept positions in the inspector and the toolbar', () => {
  test('the Position section of a pinned class has step buttons, X and Y, and Return to automatic layout', async ({ page }) => {
    const start = withCodePins({ EnrollmentPolicy: [80, 40] });
    const editor = await openUmlEditor(page, { view: CODE_VIEW, text: start });
    await option(editor, 'EnrollmentPolicy').focus();
    const summary = inspector(editor).locator('summary', { hasText: 'Position' });
    await summary.click();
    const position = summary.locator('xpath=..');

    await expect(position.getByText('Pinned at 80, 40 in this view.')).toBeVisible();
    for (const direction of ['up', 'left', 'right', 'down']) await expect(position.getByRole('button', { name: `Move ${direction}` })).toBeVisible();
    await expect(position.getByRole('spinbutton', { name: 'X' })).toHaveValue('80');
    await expect(position.getByRole('spinbutton', { name: 'Y' })).toHaveValue('40');
    const step = Number(await position.getByRole('combobox', { name: 'Step' }).inputValue());

    await position.getByRole('button', { name: 'Move right' }).click();

    await expect.poll(async () => keptPositions(await textOf(page)).EnrollmentPolicy).toEqual([80 + step, 40]);
    expect((await hostLog(page)).texts, 'one click is one change').toHaveLength(1);
    await expect(position.getByText(`Pinned at ${80 + step}, 40 in this view.`)).toBeVisible();

    await position.getByRole('spinbutton', { name: 'Y' }).fill('90');
    await position.getByRole('spinbutton', { name: 'Y' }).press('Enter');
    await expect.poll(async () => keptPositions(await textOf(page)).EnrollmentPolicy).toEqual([80 + step, 90]);

    await position.getByRole('button', { name: 'Return to automatic layout' }).click();
    await expect.poll(async () => keptPositions(await textOf(page)).EnrollmentPolicy).toBeUndefined();
    await expect(position.getByText('Placed automatically.')).toBeVisible();
  });

  test('Reset layout removes the view\'s layout entry in one undo step', async ({ page }) => {
    const start = withCodePins(APART);
    const editor = await openUmlEditor(page, { view: CODE_VIEW, text: start });
    const reset = editor.getByRole('group', { name: 'Layout' }).getByRole('button', { name: 'Reset layout' });
    await expect(reset).not.toHaveAttribute('aria-disabled', 'true');

    await reset.click();

    const written = await oneChange(page, 'Reset layout is one change');
    expect(C4.project(C4.load(written), CODE_VIEW).layout, 'the view keeps no layout entry').toBeNull();
    expect(C4.load(written).model.layout.has(CODE_VIEW), 'the model has no layout entry for the view').toBe(false);
    await expect(messageRegion(editor)).toContainText('The layout of this view is automatic again.');
    await expect(reset).toHaveAttribute('aria-disabled', 'true');
    await undoOnceTo(page, editor, start, 'one Undo brings the positions back');
  });
});

// ---- New scenario… and New environment… (spec §7.6) ----------------------------------------------------------------

test.describe('reaching the views a model lacks', () => {
  test('a model without scenarios offers New scenario… and "Drop a section" opens dynamic drop-a-section', async ({ page }) => {
    const start = withoutSection(INTERFACES_REFERENCE, 'scenarios');
    const editor = await openUmlEditor(page, { view: CODE_VIEW, text: start });
    await expect(button(editor, 'Dynamic'), 'no scenario: no Dynamic level').toHaveCount(0);

    await button(editor, 'New scenario…').click();
    const dialog = editor.getByRole('dialog', { name: 'New scenario' });
    await dialog.getByRole('textbox', { name: 'Title' }).fill('Drop a section');
    await dialog.getByRole('textbox', { name: 'Title' }).press('Enter');

    await expect.poll(async () => (await hostLog(page)).views.at(-1)).toBe('dynamic drop-a-section');
    const written = await oneChange(page, 'the scenario is one change');
    expect(C4.load(written).model.scenarios.get('drop-a-section').title).toBe('Drop a section');
    await expect(button(editor, 'Dynamic')).toHaveAttribute('aria-pressed', 'true');
    await expect(button(editor, 'New scenario…'), 'the model has a scenario now').toHaveCount(0);
  });

  test('a model without environments offers New environment…', async ({ page }) => {
    const start = withoutSection(INTERFACES_REFERENCE, 'deployment');
    const editor = await openUmlEditor(page, { view: CODE_VIEW, text: start });
    await expect(button(editor, 'Deployment'), 'no environment: no Deployment level').toHaveCount(0);

    await button(editor, 'New environment…').click();
    const dialog = editor.getByRole('dialog', { name: 'New environment' });
    await dialog.getByRole('textbox', { name: 'Name' }).fill('Staging');
    await dialog.getByRole('textbox', { name: 'Name' }).press('Enter');

    await expect.poll(async () => (await hostLog(page)).views.at(-1)).toBe('deployment staging');
    const written = await oneChange(page, 'the environment is one change');
    expect(C4.load(written).model.environments.get('staging').name).toBe('Staging');
  });

  test('Escape in the New scenario dialog adds nothing', async ({ page }) => {
    const start = withoutSection(INTERFACES_REFERENCE, 'scenarios');
    const editor = await openUmlEditor(page, { view: CODE_VIEW, text: start });
    await button(editor, 'New scenario…').click();
    await editor.getByRole('dialog', { name: 'New scenario' }).getByRole('textbox', { name: 'Title' }).fill('Drop a section');

    await page.keyboard.press('Escape');

    await expect(editor.getByRole('dialog', { name: 'New scenario' })).toHaveCount(0);
    expect((await hostLog(page)).texts, 'nothing was written').toEqual([]);
    await expect(button(editor, 'New scenario…')).toBeFocused();
  });
});

// ---- Every main row of §5.2 by keyboard, by pointer, and by drag: one undo step each (spec §7.4, §7.5) --------------

test.describe('the main rows of the code view by every path, one undo step each', () => {
  const ROWS = [
    {
      name: 'Add Class by keyboard (A, then Class)',
      async run(page, editor) {
        await option(editor, 'EnrollmentPolicy').focus();
        await page.keyboard.press('a');
        await menu(editor, 'Add').getByRole('menuitem', { name: 'Class', exact: true }).press('Enter');
        await keepPlaceholder(page, editor);
      },
      check: (written) => expect(Object.values(codeElements(written)).map((element) => element.name)).toContain('New class'),
    },
    {
      name: 'Add Class by pointer (a click on the tile)',
      async run(page, editor) {
        await palette(editor).getByRole('button', { name: 'Class', exact: true }).click();
        await keepPlaceholder(page, editor);
      },
      check: (written) => expect(Object.values(codeElements(written)).map((element) => element.name)).toContain('New class'),
    },
    {
      name: 'Add Class by drag (the tile onto the drawing)',
      async run(page, editor) {
        const from = await centreOf(palette(editor).getByRole('button', { name: 'Class', exact: true }));
        const spot = await emptySpotInCanvas(canvas(editor), 40);
        if (!spot) throw new Error('the canvas shows no empty spot to drop on');
        await dragBetween(page, from, spot);
        await keepPlaceholder(page, editor);
      },
      check: (written) => expect(Object.values(codeElements(written)).map((element) => element.name)).toContain('New class'),
    },
    {
      name: 'Rename by keyboard (F2)',
      async run(page, editor) {
        await option(editor, 'UnitCapRule').focus();
        await page.keyboard.press('F2');
        await nameEditor(editor, 'Name of class UnitCapRule').fill('CreditCapRule');
        await page.keyboard.press('Enter');
      },
      check: (written) => expect(codeElements(written).UnitCapRule.name).toBe('CreditCapRule'),
    },
    {
      name: 'Rename by pointer (a double-click)',
      async run(page, editor) {
        const at = await boxCentre(editor, 'UnitCapRule');
        await page.mouse.dblclick(at.x, at.y);
        await nameEditor(editor, 'Name of class UnitCapRule').fill('CreditCapRule');
        await page.keyboard.press('Enter');
      },
      check: (written) => expect(codeElements(written).UnitCapRule.name).toBe('CreditCapRule'),
    },
    {
      name: 'Draw a realization by keyboard (C, the arrow keys, Enter)',
      async run(page, editor) {
        await option(editor, 'EnrollmentPolicy').focus();
        await page.keyboard.press('c');
        await expect(messageRegion(editor)).toContainText(/^Drawing a line from EnrollmentPolicy/);
        await page.keyboard.press('ArrowRight');
        await expect(option(editor, 'EnrollmentRule')).toBeFocused();
        await page.keyboard.press('Enter');
        await menu(editor, 'Draw a line from EnrollmentPolicy to EnrollmentRule').getByRole('menuitem', { name: 'Realization', exact: true }).press('Enter');
      },
      check: (written) => expect(codeElements(written).EnrollmentPolicy.code.implements).toEqual(['EnrollmentRule']),
    },
    {
      name: 'Draw a realization by pointer ("Draw a line", then a click on the target)',
      async run(page, editor) {
        await option(editor, 'EnrollmentPolicy').focus();
        await page.keyboard.press('Shift+F10');
        await menu(editor, 'Actions for EnrollmentPolicy').getByRole('menuitem', { name: 'Draw a line', exact: true }).click();
        const at = await boxCentre(editor, 'EnrollmentRule');
        await page.mouse.click(at.x, at.y);
        await menu(editor, 'Draw a line from EnrollmentPolicy to EnrollmentRule').getByRole('menuitem', { name: 'Realization', exact: true }).click();
      },
      check: (written) => expect(codeElements(written).EnrollmentPolicy.code.implements).toEqual(['EnrollmentRule']),
    },
    {
      name: 'Move a class by keyboard (M, Right, Enter)',
      async run(page, editor) {
        await option(editor, 'EnrollmentPolicy').focus();
        await page.keyboard.press('m');
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('Enter');
      },
      check: (written) => expect(keptPositions(written).EnrollmentPolicy).toEqual([APART.EnrollmentPolicy[0] + 10, APART.EnrollmentPolicy[1]]),
      text: withCodePins(APART),
    },
    {
      name: 'Move a class by pointer ("Move…", then a click)',
      async run(page, editor) {
        await option(editor, 'EnrollmentPolicy').focus();
        await page.keyboard.press('Shift+F10');
        await menu(editor, 'Actions for EnrollmentPolicy').getByRole('menuitem', { name: 'Move…', exact: true }).click();
        const at = await boxCentre(editor, 'EnrollmentPolicy');
        await page.mouse.click(at.x + 40, at.y + 20);
      },
      check: (written) => expect(keptPositions(written).EnrollmentPolicy).not.toEqual(APART.EnrollmentPolicy),
      text: withCodePins(APART),
    },
    {
      name: 'Move a class by drag',
      async run(page, editor) {
        const from = await boxCentre(editor, 'EnrollmentPolicy');
        await dragBetween(page, from, { x: from.x + 40, y: from.y + 20 });
      },
      check: (written) => expect(keptPositions(written).EnrollmentPolicy).not.toEqual(APART.EnrollmentPolicy),
      text: withCodePins(APART),
    },
  ];

  for (const row of ROWS) {
    test(`${row.name} is one undo step`, async ({ page }) => {
      const start = row.text || INTERFACES_REFERENCE;
      const editor = await openUmlEditor(page, { view: CODE_VIEW, text: start });

      await row.run(page, editor);

      const written = await oneChange(page, `${row.name} is one change`);
      row.check(written);
      await undoOnceTo(page, editor, start, `one Undo takes ${row.name} back`);
    });
  }
});

// ---- Adding a class (spec §6 rule 2, §7.4 In-place editors, §5.1 Identity) ------------------------------------------

test.describe('adding a class on the canvas', () => {
  test('a class added by a click in a view without positions overlaps no box', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE_VIEW });

    await palette(editor).getByRole('button', { name: 'Class', exact: true }).click();
    await keepPlaceholder(page, editor);

    await expect.poll(async () => Object.keys(await drawnBoxes(editor)).length).toBe(5);
    expect(overlappingPairs(await drawnBoxes(editor))).toEqual([]);
  });

  test('a class added by A in a view that keeps positions goes to a free place and overlaps no box', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE_VIEW, text: withCodePins(APART) });
    await option(editor, 'EnrollmentPolicy').focus();

    await page.keyboard.press('a');
    await menu(editor, 'Add').getByRole('menuitem', { name: 'Class', exact: true }).press('Enter');
    await keepPlaceholder(page, editor);

    await expect.poll(async () => Object.keys(keptPositions(await textOf(page))).length, { message: 'the new class is kept too' }).toBe(5);
    expect(overlappingPairs(await drawnBoxes(editor))).toEqual([]);
  });

  test('a tile dropped in code of policy without positions pins every class where it is drawn and the new one at the drop point', async ({ page }) => {
    // Tall enough that the tile and the drop point are both in view, so reading one never scrolls the other away.
    await page.setViewportSize({ width: 1280, height: 1600 });
    const editor = await openUmlEditor(page, { view: CODE_VIEW });
    const before = await drawnBoxes(editor);
    const from = await centreOf(palette(editor).getByRole('button', { name: 'Class', exact: true }));
    const spot = await emptySpotInCanvas(canvas(editor), 60);
    if (!spot) throw new Error('the canvas shows no empty spot to drop on');
    const dropAt = await drawingPointOf(editor, spot);

    await dragBetween(page, from, spot);
    await keepPlaceholder(page, editor);

    const written = await textOf(page);
    const added = Object.keys(codeElements(written)).find((id) => !CLASSES.includes(id));
    expect(Object.keys(keptPositions(written)).sort(), 'every class and the new one are kept').toEqual([...CLASSES, added].sort());
    const after = await drawnBoxes(editor);
    // The drawing may be fitted anew, which shifts every box alike: each class stays where it was beside the others.
    const shift = { x: after.EnrollmentPolicy.x - before.EnrollmentPolicy.x, y: after.EnrollmentPolicy.y - before.EnrollmentPolicy.y };
    for (const alias of CLASSES) {
      expect(after[alias].x - shift.x, `${alias} keeps its drawn place`).toBeCloseTo(before[alias].x, 0);
      expect(after[alias].y - shift.y, `${alias} keeps its drawn place`).toBeCloseTo(before[alias].y, 0);
    }
    const box = after[Object.keys(after).find((alias) => !CLASSES.includes(alias)) || ''];
    const point = { x: dropAt.x + shift.x, y: dropAt.y + shift.y };
    expect(point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height,
      'the new class lies under the drop point').toBe(true);
  });

  test('a class just added opens its name editor with "New class" selected; Escape keeps the name and Undo removes the class', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE_VIEW });

    await palette(editor).getByRole('button', { name: 'Class', exact: true }).click();

    const field = nameEditor(editor, 'Name of class New class');
    await expect(field).toBeFocused();
    await expect(field).toHaveValue('New class');
    expect(await field.evaluate((input) => [input.selectionStart, input.selectionEnd]), 'the whole name is selected').toEqual([0, 'New class'.length]);
    await page.keyboard.press('Escape');
    await expect(field).toHaveCount(0);
    const written = await oneChange(page, 'the addition is one change');
    expect(Object.values(codeElements(written)).map((element) => element.name)).toContain('New class');
    await undoOnceTo(page, editor, INTERFACES_REFERENCE, 'Undo removes the class');
  });

  test('a class added on the canvas and renamed takes the id of its first name', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE_VIEW });
    const expectedId = C4.edit(C4.load(INTERFACES_REFERENCE),
      { op: 'addElement', parentId: POLICY, type: 'code', kind: 'class', name: 'WaitlistRule' }).selection.elementId;

    await palette(editor).getByRole('button', { name: 'Class', exact: true }).click();
    await nameEditor(editor, 'Name of class New class').fill('WaitlistRule');
    await page.keyboard.press('Enter');

    await expect.poll(async () => Object.keys(codeElements(await textOf(page))).sort()).toEqual([...CLASSES, expectedId].sort());
    expect(codeElements(await textOf(page))[expectedId].name).toBe('WaitlistRule');
  });
});

// ---- Members, lines, and their options (spec §5.2, §7.3, §7.4) ------------------------------------------------------

test.describe('members and lines of the code view', () => {
  test('a member line opens "Operation 1 of EnrollmentPolicy" with the model\'s text', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE_VIEW });
    const modelText = C4.load(INTERFACES_REFERENCE).model.elements.get('EnrollmentPolicy').code.operations[0];
    const at = await canvas(editor).evaluate((region) => {
      const svg = region.querySelector('.c4-editor__diagram svg');
      const text = [...svg.querySelectorAll('text')].find((node) => node.textContent.includes('decide('));
      text.scrollIntoView({ block: 'center', inline: 'center' });
      const box = text.getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    });

    await page.mouse.dblclick(at.x, at.y);

    const field = nameEditor(editor, 'Operation 1 of EnrollmentPolicy');
    await expect(field).toBeFocused();
    await expect(field).toHaveValue(modelText);
  });

  test('the chooser that opens when a line is drawn between two classes lists Generalization, Realization, and Dependency, then Composition, Aggregation, and Association disabled with their short reasons', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE_VIEW });
    await option(editor, 'PrerequisiteRule').focus();
    await page.keyboard.press('c');
    await expect(messageRegion(editor)).toContainText(/^Drawing a line from PrerequisiteRule/);
    for (let press = 0; press < CLASSES.length; press += 1) {
      if (await option(editor, 'UnitCapRule').evaluate((node) => node === document.activeElement)) break;
      await page.keyboard.press('ArrowRight');
    }
    await expect(option(editor, 'UnitCapRule')).toBeFocused();

    await page.keyboard.press('Enter');

    const chooser = menu(editor, 'Draw a line from PrerequisiteRule to UnitCapRule');
    const items = chooser.getByRole('menuitem');
    await expect(items).toHaveCount(LINE_KINDS.length + ASSOCIATIONS.length);
    const labels = await items.evaluateAll((nodes) => nodes.map((node) => node.firstChild.textContent.trim()));
    expect(labels).toEqual([...LINE_KINDS, ...ASSOCIATIONS]);
    const realization = refusalTable.verdict('implements-target', { Target: 'UnitCapRule', targetKind: 'class' });
    await expect(chooser.getByRole('menuitem', { name: 'Generalization', exact: true })).not.toHaveAttribute('aria-disabled', 'true');
    await expect(chooser.getByRole('menuitem', { name: `Realization ${realization.summary}`, exact: true })).toHaveAttribute('aria-disabled', 'true');
    await expect(chooser.getByRole('menuitem', { name: 'Dependency', exact: true })).not.toHaveAttribute('aria-disabled', 'true');
    const unrecorded = refusalTable.verdict('not-in-model/association', ROLE_WORDS).summary;
    for (const name of ASSOCIATIONS) {
      await expect(chooser.getByRole('menuitem', { name: `${name} ${unrecorded}`, exact: true })).toHaveAttribute('aria-disabled', 'true');
    }
  });

  test('the inheritance trunk opens a chooser of "PrerequisiteRule implements EnrollmentRule" and "UnitCapRule implements EnrollmentRule"', async ({ page }) => {
    const editor = await openUmlEditor(page, { view: CODE_VIEW });
    // The trunk is the drawn segment that leaves EnrollmentRule's box, under the realization's hollow triangle (at most
    // 24 drawing units tall): both realizations share it.
    const trunk = await canvas(editor).evaluate((region) => {
      const svg = region.querySelector('.c4-editor__diagram svg');
      const parent = window.UMLShared.renderedLayoutBox(svg, 'EnrollmentRule');
      const onBorder = (x, y) => x >= parent.x && x <= parent.x + parent.width && y >= parent.y + parent.height - 2 && y <= parent.y + parent.height + 24;
      const segment = [...region.querySelectorAll('.uml-pg-edge-hitbox')].find((line) => {
        if (!/^edge-/.test(line.getAttribute('data-route-id') || '')) return false;
        const [x1, y1, x2, y2] = ['x1', 'y1', 'x2', 'y2'].map((name) => Number(line.getAttribute(name)));
        return onBorder(x1, y1) || onBorder(x2, y2);
      });
      if (!segment) return null;
      segment.scrollIntoView({ block: 'center', inline: 'center' });
      const [x1, y1, x2, y2] = ['x1', 'y1', 'x2', 'y2'].map((name) => Number(segment.getAttribute(name)));
      const middle = new DOMPoint((x1 + x2) / 2, (y1 + y2) / 2).matrixTransform(svg.getScreenCTM());
      return { x: middle.x, y: middle.y };
    });
    if (!trunk) throw new Error('code of policy draws no segment that leaves EnrollmentRule');

    await page.mouse.click(trunk.x, trunk.y);

    const chooser = menu(editor, 'Lines here');
    await expect(chooser.getByRole('menuitem')).toHaveText(['PrerequisiteRule implements EnrollmentRule', 'UnitCapRule implements EnrollmentRule']);
    await chooser.getByRole('menuitem', { name: 'UnitCapRule implements EnrollmentRule', exact: true }).click();
    await expect(option(editor, 'UnitCapRule implements EnrollmentRule')).toBeFocused();
    expect((await hostLog(page)).texts, 'choosing a line changes nothing').toEqual([]);
  });

  test('options say generalization, realization, or dependency, "routed for you" on an inheritance line, and "ends at <deep name> inside <box>" on a lifted end', async ({ page }) => {
    // UnitCapRule also extends PrerequisiteRule, and EnrollmentPolicy uses SeatHolds, a class inside Seat Gateway,
    // which code of policy draws as the one box Seat Gateway.
    const text = INTERFACES_REFERENCE
      .replace('              UnitCapRule:\n                kind: class\n', '              UnitCapRule:\n                kind: class\n                extends: [PrerequisiteRule]\n')
      .replace('collaborators: {EnrollmentRule: delegates each eligibility check to}',
        'collaborators: {EnrollmentRule: delegates each eligibility check to, SeatHolds: looks up held seats through}')
      .replace('            collaborators:\n              db: {description: writes seat holds to, technology: SQL/TCP}\n',
        '            collaborators:\n              db: {description: writes seat holds to, technology: SQL/TCP}\n            code:\n              SeatHolds:\n                kind: class\n');
    expect(C4.load(text).model.elements.get('SeatHolds'), 'the variant has SeatHolds inside Seat Gateway').toBeTruthy();
    const editor = await openUmlEditor(page, { view: CODE_VIEW, text });
    const lines = elements(editor).getByRole('group', { name: 'Lines', exact: true });

    await expect(lines.getByRole('option', { name: 'UnitCapRule extends PrerequisiteRule', exact: true }))
      .toHaveAccessibleDescription(/^generalization; routed for you; /);
    await expect(lines.getByRole('option', { name: 'PrerequisiteRule implements EnrollmentRule', exact: true }))
      .toHaveAccessibleDescription(/^realization; routed for you; /);
    await expect(lines.getByRole('option', { name: 'EnrollmentPolicy delegates each eligibility check to EnrollmentRule', exact: true }))
      .toHaveAccessibleDescription(/^dependency; /);
    await expect(lines.getByRole('option', { name: 'EnrollmentPolicy looks up held seats through SeatHolds', exact: true }))
      .toHaveAccessibleDescription(/^dependency; ends at SeatHolds inside Seat Gateway; /);
  });
});

// ---- Accessibility of the new controls (WCAG 2.2 AA; plan Global Constraints) ----------------------------------------

test.describe('accessibility of the palette, the Position section, and New scenario…', () => {
  for (const width of [320, 1440]) {
    test(`auditInteractiveState with the unavailable tools listed, the Position section open, and the New scenario dialog, in light and dark mode, at ${width} CSS px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const text = `${withoutSection(INTERFACES_REFERENCE, 'scenarios')}layout:\n  ${CODE_VIEW}:\n    positions:\n      EnrollmentPolicy: [80, 40]\n`;
      const editor = await openUmlEditor(page, { view: CODE_VIEW, siteThemes: true, profile: 'novice', text });
      const audit = (state) => auditInteractiveState(page, `C4 editor code view ${state} at ${width} px`, { include: '#editor' });

      // At narrow widths the Add menu (key A) stands in for the palette and lists the unavailable tools too.
      if (width >= 1440) {
        await button(editor, MORE_TOOLS).click();
        await expect(button(editor, 'Composition: not recorded in this design model')).toBeVisible();
      } else {
        await option(editor, 'EnrollmentPolicy').focus();
        await page.keyboard.press('a');
        await expect(menu(editor, 'Add').getByRole('menuitem', { name: /^Composition / })).toBeVisible();
      }
      await audit('with the unavailable tools listed');
      await page.keyboard.press('Escape');

      await option(editor, 'EnrollmentPolicy').focus();
      const summary = inspector(editor).locator('summary', { hasText: 'Position' });
      await summary.click();
      await expect(summary.locator('xpath=..').getByRole('button', { name: 'Return to automatic layout' })).toBeVisible();
      await audit('with the Position section of a kept class');

      await button(editor, 'New scenario…').click();
      await expect(editor.getByRole('dialog', { name: 'New scenario' })).toBeVisible();
      await audit('with the New scenario dialog');
    });
  }
});
