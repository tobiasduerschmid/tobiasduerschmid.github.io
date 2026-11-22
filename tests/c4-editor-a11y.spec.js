// @ts-check
// The C4 editor's keyboard and pointer contract (spec §9.2) and its WCAG 2.2 AA checkpoints, across the whole editor:
// the Escape order (one layer per press, innermost first, also in the browser's real full screen), the focus table,
// the three ways to build a model from nothing (dragging, single clicks for WCAG 2.5.7, and the keyboard alone), and
// axe in light and dark mode at 320 and 1440 px.
// The page is built with setContent (tests/helpers/c4-editor-page.js) with a 96 px sticky site header; the C4 core,
// run in Node on the text the host received, is the oracle for what the model says.
const { test, expect } = require('@playwright/test');
const { auditInteractiveState } = require('./a11y-helpers');
const { C4, REFERENCE, BLANK, loadC4Editor, centreOf, dragBetween, emptySpotInCanvas } = require('./helpers/c4-editor-page');

const CONTAINERS = 'containers of registration';

const canvas = (editor) => editor.getByRole('region', { name: /^Canvas/ });
const listbox = (editor) => canvas(editor).getByRole('listbox', { name: 'Elements in this view' });
const option = (editor, name) => listbox(editor).getByRole('option', { name, exact: true });
const button = (editor, name) => editor.getByRole('button', { name, exact: true });
const inspector = (editor) => editor.getByRole('region', { name: 'Inspector', exact: true });
const fullScreenButton = (editor) => button(editor, 'Full screen');

/**
 * Mounts an editor on #editor whose host records every text and answers `confirm` with true. `secure` serves the page
 * from an HTTPS origin, where the Keyboard Lock API exists.
 */
async function openEditor(page, { text = REFERENCE, view = CONTAINERS, profile = 'expert', secure = false, header = true, beforeScripts } = {}) {
  await loadC4Editor(page, { title: 'C4 editor accessibility', header, secure, beforeScripts });
  await page.evaluate(({ modelText, selector, chosenProfile }) => {
    window.hostTexts = [];
    window.saved = [];
    window.editor = window.ArchUMLC4Editor.mount(document.getElementById('editor'), {
      text: modelText, view: selector, profile: chosenProfile,
      host: {
        onTextChange: (changed) => window.hostTexts.push(changed),
        confirm: () => Promise.resolve(true),
        saveFile: (savedText, info) => { window.saved.push({ text: savedText, info }); return Promise.resolve(); },
      },
    });
  }, { modelText: text, selector: view, chosenProfile: profile });
  return page.locator('#editor');
}

/** Whether the browser's own full screen shows the editor (test plumbing: the Fullscreen API has no rendered cue). */
function inBrowserFullScreen(page) {
  return page.evaluate(() => document.fullscreenElement === document.getElementById('editor'));
}

/**
 * Records the Keyboard Lock API calls (a browser API at the editor's boundary) and passes them on. Headless Chromium
 * never leaves full screen on Escape by itself, so whether the editor keeps the Escape key is observed here.
 */
function recordKeyboardLock() {
  window.keyboardLock = [];
  const { keyboard } = navigator;
  if (!keyboard) return;
  const lock = keyboard.lock.bind(keyboard);
  const unlock = keyboard.unlock.bind(keyboard);
  keyboard.lock = (keys) => { window.keyboardLock.push(`lock ${keys.join(' ')}`); return lock(keys); };
  keyboard.unlock = () => { window.keyboardLock.push('unlock'); return unlock(); };
}

const keyboardLockCalls = (page) => page.evaluate(() => window.keyboardLock);

test.use({ viewport: { width: 1400, height: 1200 } });

test.describe('C4 editor Escape order (spec §9.2): popover → menu → dialog → Move → full screen → clear selection', () => {
  for (const secure of [false, true]) {
    const where = secure ? 'in the browser\'s full screen, with the Escape key kept for the editor'
      : 'in the full-screen overlay, where the browser cannot keep the Escape key';
    test(`${where}, Escape closes the menu, then full screen, then the selection, one per press`, async ({ page }) => {
      const editor = await openEditor(page, { secure, beforeScripts: recordKeyboardLock });
      await option(editor, 'Registration API').focus();
      await page.keyboard.press('f');
      await expect(fullScreenButton(editor)).toHaveAttribute('aria-pressed', 'true');
      await expect.poll(() => inBrowserFullScreen(page), 'which full screen is used').toBe(secure);
      await expect.poll(() => keyboardLockCalls(page), 'Escape is kept for the editor').toEqual(secure ? ['lock Escape'] : []);

      await page.keyboard.press('Shift+F10');
      const menu = page.getByRole('menu', { name: 'Actions for Registration API' });
      await expect(menu).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(menu).toHaveCount(0);
      await expect(option(editor, 'Registration API')).toBeFocused();
      await expect(fullScreenButton(editor), 'the menu was the only layer closed').toHaveAttribute('aria-pressed', 'true');
      expect(await inBrowserFullScreen(page)).toBe(secure);

      await page.keyboard.press('Escape');
      await expect(fullScreenButton(editor)).toHaveAttribute('aria-pressed', 'false');
      await expect.poll(() => inBrowserFullScreen(page)).toBe(false);
      await expect.poll(() => keyboardLockCalls(page), 'the Escape key goes back to the browser').toEqual(secure ? ['lock Escape', 'unlock'] : []);
      await expect(option(editor, 'Registration API'), 'leaving full screen keeps the selection').toHaveAttribute('aria-selected', 'true');

      await page.keyboard.press('Escape');
      await expect(option(editor, 'Registration API')).toHaveAttribute('aria-selected', 'false');
    });
  }

  test('in full screen, Escape closes a dialog first and gives focus back to the control that opened it', async ({ page }) => {
    const editor = await openEditor(page, { secure: true });
    await canvas(editor).focus();
    await page.keyboard.press('f');
    await expect(fullScreenButton(editor)).toHaveAttribute('aria-pressed', 'true');

    await button(editor, 'Help').click();
    const help = editor.getByRole('dialog', { name: 'C4 editor help' });
    await expect(help, 'the dialog opens inside the full-screen editor').toBeVisible();
    await page.keyboard.press('Escape');

    await expect(help).toBeHidden();
    await expect(button(editor, 'Help')).toBeFocused();
    await expect(fullScreenButton(editor)).toHaveAttribute('aria-pressed', 'true');
  });

  test('in full screen, Escape ends a Move first, without moving the element', async ({ page }) => {
    const editor = await openEditor(page, { secure: true });
    await option(editor, 'Registration API').focus();
    await page.keyboard.press('f');
    await expect(fullScreenButton(editor)).toHaveAttribute('aria-pressed', 'true');

    await page.keyboard.press('m');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Escape');

    await expect(editor.getByRole('status').filter({ hasText: 'Move canceled' })).toHaveCount(1);
    await expect(fullScreenButton(editor)).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => window.hostTexts), 'a cancelled Move changes nothing').toEqual([]);
  });

  test('in full screen, Escape closes a definition popover first and leaves focus on its term', async ({ page }) => {
    const editor = await openEditor(page, { secure: true, profile: 'novice' });
    await option(editor, 'Registration API').click();
    await page.keyboard.press('f');
    await expect(fullScreenButton(editor)).toHaveAttribute('aria-pressed', 'true');

    const term = inspector(editor).getByRole('button', { name: 'Interface description', exact: true });
    await term.focus();
    const definition = editor.getByRole('tooltip').or(editor.getByRole('dialog', { name: /Interface description/ }));
    await expect(definition).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(definition).toBeHidden();
    await expect(term).toBeFocused();
    await expect(fullScreenButton(editor)).toHaveAttribute('aria-pressed', 'true');
  });
});

// Three people and nothing else: a landscape whose options are the people alone, so the last one has no next option.
const THREE_PEOPLE = `${BLANK}people:
  ann: {name: Ann}
  ben: {name: Ben}
  cat: {name: Cat}
`;

/** The name of the focused option (test plumbing over the accessibility tree). */
async function focusedOptionName(page) {
  const snapshot = await page.locator(':focus').ariaSnapshot();
  return /- option "([^"]+)"/.exec(snapshot)[1];
}

/** The options in the order the arrow keys visit them (the canvas's reading order, spec §9.2), from `start`. */
async function arrowKeyOrder(page, editor, start) {
  await option(editor, start).focus();
  let previous = null;
  for (let name = await focusedOptionName(page); name !== previous; name = await focusedOptionName(page)) {
    previous = name;
    await page.keyboard.press('ArrowLeft');
  }
  const order = [];
  for (let name = await focusedOptionName(page); !order.includes(name); name = await focusedOptionName(page)) {
    order.push(name);
    await page.keyboard.press('ArrowRight');
  }
  return order;
}

test.describe('C4 editor focus table (spec §9.2)', () => {
  test('delete moves focus to the next option in arrow-key order, else to the previous one', async ({ page }) => {
    const editor = await openEditor(page, { text: THREE_PEOPLE, view: 'landscape' });
    const order = await arrowKeyOrder(page, editor, 'Ann');
    const [first, second] = order;
    const last = order.at(-1);
    const beforeLast = order.at(-2);

    await option(editor, first).focus();
    await page.keyboard.press('Delete');
    await expect(option(editor, first)).toHaveCount(0);
    await expect(option(editor, second), 'the next option').toBeFocused();

    await option(editor, last).focus();
    await page.keyboard.press('Delete');
    await expect(option(editor, last)).toHaveCount(0);
    await expect(option(editor, beforeLast), 'the last option deleted: the previous one').toBeFocused();
  });

  test('deleting the only element of a view moves focus to the canvas region, since no listbox is left', async ({ page }) => {
    const editor = await openEditor(page, { text: `${BLANK}people:\n  student: {name: Student}\n`, view: 'landscape' });

    await option(editor, 'Student').focus();
    await page.keyboard.press('Delete');

    await expect(listbox(editor)).toHaveCount(0);
    await expect(canvas(editor)).toBeFocused();
  });

  test('closing a dialog gives focus back to the element whose menu opened it', async ({ page }) => {
    const editor = await openEditor(page);
    await option(editor, 'Registration API').focus();
    await page.keyboard.press('Shift+F10');
    await page.getByRole('menuitem', { name: 'Change id…' }).click();
    const dialog = editor.getByRole('dialog', { name: 'Change the id of Registration API' });
    await expect(dialog.getByRole('textbox', { name: 'New id' }), 'the dialog starts on its field').toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(option(editor, 'Registration API')).toBeFocused();
  });

  test('in the stacked layout, Problems › Show expands a collapsed inspector and focuses the field', async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 1000 });
    const editor = await openEditor(page, { text: REFERENCE.replace('        technology: Python, FastAPI\n', '') });
    await editor.getByRole('button', { name: 'Inspector', exact: true }).click();
    await expect(editor.getByRole('button', { name: 'Inspector', exact: true })).toHaveAttribute('aria-expanded', 'false');

    await editor.getByRole('tab', { name: /^Problems/ }).click();
    await editor.getByRole('button', { name: 'Show Technology of Registration API' }).click();

    await expect(editor.getByRole('button', { name: 'Inspector', exact: true })).toHaveAttribute('aria-expanded', 'true');
    await expect(inspector(editor).getByRole('region', { name: 'Basics' }).getByLabel('Technology', { exact: true })).toBeFocused();
  });
});

// Editor states with their own controls, each reached from a freshly mounted editor; axe runs on each in light and dark.
const AXE_STATES = [
  {
    name: 'a selected element with its inspector form',
    async reach(page, editor) {
      await option(editor, 'Registration API').click();
    },
  },
  {
    name: 'an element menu',
    async reach(page, editor) {
      await option(editor, 'Registration API').focus();
      await page.keyboard.press('Shift+F10');
      await expect(page.getByRole('menu', { name: 'Actions for Registration API' })).toBeVisible();
    },
  },
  {
    name: 'the Change id dialog with an error',
    async reach(page, editor) {
      await option(editor, 'Registration API').focus();
      await page.keyboard.press('Shift+F10');
      await page.getByRole('menuitem', { name: 'Change id…' }).click();
      const field = editor.getByRole('dialog').getByRole('textbox', { name: 'New id' });
      await field.fill('1 api');
      await field.press('Enter');
      await expect(field).toHaveAttribute('aria-invalid', 'true');
    },
  },
  {
    name: 'the relationship form with its read-aloud preview',
    async reach(page, editor) {
      await option(editor, 'Planner Web App').focus();
      await page.keyboard.press('c');
      await option(editor, 'Registration Database').focus();
      await page.keyboard.press('Enter');
      const form = editor.getByRole('dialog', { name: 'Add relationship' });
      await form.getByLabel('Description').fill('reads course data from');
      await expect(form.getByText('Planner Web App reads course data from Registration Database')).toBeVisible();
    },
  },
  {
    name: 'the Review panel',
    async reach(page, editor) {
      await editor.getByRole('tab', { name: /^Review/ }).click();
    },
  },
  {
    name: 'the Explain panel',
    async reach(page, editor) {
      await editor.getByRole('tab', { name: /^Explain/ }).click();
    },
  },
  {
    name: 'the YAML panel',
    async reach(page, editor) {
      await editor.getByRole('tab', { name: /^YAML/ }).click();
    },
  },
  {
    name: 'the full-screen overlay',
    async reach(page, editor) {
      await canvas(editor).focus();
      await page.keyboard.press('f');
      await expect(fullScreenButton(editor)).toHaveAttribute('aria-pressed', 'true');
    },
  },
  {
    name: 'a blank model with the empty-state guide',
    options: { text: BLANK, view: 'landscape', profile: 'novice' },
  },
];

test.describe('C4 editor: axe finds no WCAG 2.2 AA violation', () => {
  for (const width of [320, 1440]) {
    for (const state of AXE_STATES) {
      test(`at ${width} px, in light and dark mode: ${state.name}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        const editor = await openEditor(page, state.options);
        if (state.reach) await state.reach(page, editor);
        await auditInteractiveState(page, `C4 editor at ${width} px: ${state.name}`, { include: '#editor' });
      });
    }
  }
});

// ---- Building a model from nothing (spec §9.2 "Direct manipulation", WCAG 2.5.7, 2.1.1) ---------------------------

const palette = (editor) => editor.getByRole('group', { name: 'Add to the diagram' });
const tile = (editor, name) => palette(editor).getByRole('button', { name, exact: true });
const outline = (editor) => editor.getByRole('tree', { name: 'Model outline' });
const treeItem = (editor, name) => outline(editor).getByRole('treeitem', { name, exact: true });
const nameField = (editor) => canvas(editor).getByRole('textbox', { name: /^Name of / });
const relationshipForm = (editor) => editor.getByRole('dialog', { name: 'Add relationship' });
const section = (editor, name) => inspector(editor).getByRole('region', { name });

/** Types the new element's name into the in-place field the editor opened for it, and confirms it with Enter. */
async function nameNewElement(editor, name) {
  await expect(nameField(editor), 'a new element has its name ready for editing').toBeFocused();
  await nameField(editor).fill(name);
  await nameField(editor).press('Enter');
  await expect(option(editor, name)).toBeVisible();
}

/** Fills the anchored relationship form and confirms it with Enter. */
async function describeRelationship(editor, description) {
  const form = relationshipForm(editor);
  await form.getByLabel('Description').fill(description);
  await form.getByLabel('Description').press('Enter');
  await expect(form).toBeHidden();
}

/** Adds a responsibility of `kind` in the inspector's Responsibilities section. */
async function addResponsibility(editor, kind, text) {
  const responsibilities = section(editor, 'Responsibilities');
  await responsibilities.getByRole('combobox', { name: 'Kind of the new responsibility' }).selectOption({ label: kind });
  await responsibilities.getByRole('textbox', { name: 'New responsibility' }).fill(text);
  await responsibilities.getByRole('button', { name: 'Add responsibility' }).click();
}

/** Whether `elementId` has a pinned position in the view with selector `viewSelector`. */
function isPinned(model, design, viewSelector, elementId) {
  const pins = model.layout.get(C4.project(design, viewSelector).key);
  return Boolean(pins && pins.get(elementId));
}

/**
 * What every flow builds: Student uses Course Registration, which charges through Billing System; inside Course
 * Registration, Planner Web App submits plans to Registration API, which has two responsibilities in the order the
 * learner put them; and Payment Gateway, added in the wrong system, now lives in Billing System.
 */
async function expectBuiltModel(page) {
  const texts = await page.evaluate(() => window.hostTexts);
  const design = C4.load(texts.at(-1));
  const { model } = design;
  const byName = new Map([...model.elements.values()].map((element) => [element.name, element]));
  const parentName = (name) => model.elements.get(byName.get(name).parentId)?.name ?? null;
  const relationships = model.relationships.map((relationship) => [
    model.elements.get(relationship.sourceId).name, relationship.description, model.elements.get(relationship.targetId).name,
  ]);

  expect([...byName.keys()].sort()).toEqual(['Billing System', 'Course Registration', 'Payment Gateway', 'Planner Web App', 'Registration API', 'Student']);
  expect(['Planner Web App', 'Registration API', 'Payment Gateway'].map(parentName)).toEqual(['Course Registration', 'Course Registration', 'Billing System']);
  expect(relationships).toEqual(expect.arrayContaining([
    ['Student', 'plans a schedule using', 'Course Registration'],
    ['Course Registration', 'charges tuition through', 'Billing System'],
    ['Planner Web App', 'submits plans to', 'Registration API'],
  ]));
  expect(byName.get('Registration API').responsibilities.map((responsibility) => responsibility.text))
    .toEqual(['hold a seat in every section of a plan, or in none', 'whether a student may enroll in a section']);
  const system = byName.get('Course Registration').id;
  const shown = (selector) => C4.project(design, selector).nodes.map((node) => model.elements.get(node.id)?.name).sort();
  expect(shown(`context of ${system}`), 'the context view').toEqual(['Billing System', 'Course Registration', 'Student']);
  expect(shown(`containers of ${system}`), 'the container view').toEqual(expect.arrayContaining(['Planner Web App', 'Registration API']));
  return { design, byName };
}

test.describe('C4 editor: building a context and container view from an empty model', () => {
  test('pointer (the default): palette drags, connection drags, element drags, row drags, and an outline drag', async ({ page }) => {
    const editor = await openEditor(page, { text: BLANK, view: 'landscape', profile: 'novice' });

    for (const [type, name] of [['Software system', 'Course Registration'], ['Person', 'Student'], ['Software system', 'Billing System']]) {
      const spot = await emptySpotInCanvas(canvas(editor));
      await dragBetween(page, await centreOf(tile(editor, type)), spot);
      await nameNewElement(editor, name);
    }

    await button(editor, 'Fit').click();
    for (const [from, to, description] of [['Student', 'Course Registration', 'plans a schedule using'],
      ['Course Registration', 'Billing System', 'charges tuition through']]) {
      await option(editor, from).click();
      const handle = canvas(editor).locator(`[data-c4-handle]:visible`);
      await dragBetween(page, await centreOf(handle), await centreOf(option(editor, to)));
      await describeRelationship(editor, description);
    }

    const billing = await centreOf(option(editor, 'Billing System'));
    await dragBetween(page, billing, { x: billing.x + 60, y: billing.y + 40 });
    await expect(editor.getByRole('status').filter({ hasText: /Moved Billing System/ })).toHaveCount(1);

    await option(editor, 'Course Registration').dblclick();
    await expect(canvas(editor)).toHaveAccessibleName(/Container view/);
    for (const name of ['Planner Web App', 'Registration API', 'Payment Gateway']) {
      const spot = await emptySpotInCanvas(canvas(editor));
      await dragBetween(page, await centreOf(tile(editor, 'Container')), spot);
      await nameNewElement(editor, name);
    }
    // The learner fits the drawing to the canvas, so both ends of the connection are in view.
    await button(editor, 'Fit').click();
    await option(editor, 'Planner Web App').click();
    await dragBetween(page, await centreOf(canvas(editor).locator('[data-c4-handle]:visible')), await centreOf(option(editor, 'Registration API')));
    await describeRelationship(editor, 'submits plans to');

    await option(editor, 'Registration API').click();
    await addResponsibility(editor, 'DECIDE', 'whether a student may enroll in a section');
    await addResponsibility(editor, 'DO', 'hold a seat in every section of a plan, or in none');
    const rows = section(editor, 'Responsibilities').getByRole('listitem');
    const secondHandle = await centreOf(rows.nth(1).locator('[data-c4-drag-handle]'));
    const firstRow = await rows.nth(0).boundingBox();
    await dragBetween(page, secondHandle, { x: secondHandle.x, y: firstRow.y + 4 });
    await expect(editor.getByRole('status').filter({ hasText: 'Moved responsibility 2 to position 1 of 2.' })).toHaveCount(1);

    const grabbed = treeItem(editor, 'Payment Gateway').getByText('Payment Gateway', { exact: true });
    const dropTarget = treeItem(editor, 'Billing System').getByText('Billing System', { exact: true }).first();
    // Both rows in view below the sticky site header.
    await grabbed.evaluate((element) => element.scrollIntoView({ block: 'center' }));
    const [from, onto] = await Promise.all([grabbed, dropTarget].map((locator) => locator.boundingBox()));
    await dragBetween(page, { x: from.x + from.width / 2, y: from.y + from.height / 2 }, { x: onto.x + onto.width / 2, y: onto.y + onto.height / 2 });
    await expect(treeItem(editor, 'Billing System').getByRole('treeitem', { name: 'Payment Gateway' }), 'the outline shows the new parent').toHaveCount(1);

    const { design, byName } = await expectBuiltModel(page);
    expect(isPinned(design.model, design, 'landscape', byName.get('Billing System').id), 'the dragged element is pinned').toBe(true);
  });
});

test.describe('C4 editor: the same model with single clicks (WCAG 2.5.7)', () => {
  test('palette clicks, click-then-click connect, Move… then a click, row menus, and Move to…', async ({ page }) => {
    const editor = await openEditor(page, { text: BLANK, view: 'landscape', profile: 'novice' });
    /** Opens the selected element's menu with its "⋯" button (a pointer control; data-c4-more is its documented hook). */
    const openMenuOf = async (name) => {
      await option(editor, name).click();
      await canvas(editor).locator('[data-c4-more]:visible').click();
      return page.getByRole('menu', { name: `Actions for ${name}` });
    };
    /** Connects `from` to `to` by clicking the source's connect handle and then the target. */
    const connect = async (from, to, description) => {
      await option(editor, from).click();
      await canvas(editor).locator('[data-c4-handle]:visible').click();
      await option(editor, to).click();
      await describeRelationship(editor, description);
    };

    for (const [type, name] of [['Software system', 'Course Registration'], ['Person', 'Student'], ['Software system', 'Billing System']]) {
      await tile(editor, type).click();
      await nameNewElement(editor, name);
    }
    await button(editor, 'Fit').click();
    await connect('Student', 'Course Registration', 'plans a schedule using');
    await connect('Course Registration', 'Billing System', 'charges tuition through');

    await (await openMenuOf('Billing System')).getByRole('menuitem', { name: 'Move…' }).click();
    const spot = await emptySpotInCanvas(canvas(editor));
    await page.mouse.click(spot.x, spot.y);
    await expect(editor.getByRole('status').filter({ hasText: /Billing System/ })).toHaveCount(1);

    await (await openMenuOf('Course Registration')).getByRole('menuitem', { name: 'Zoom in' }).click();
    await expect(canvas(editor)).toHaveAccessibleName(/Container view/);
    await editor.getByRole('button', { name: 'Add the first container' }).click();
    await nameNewElement(editor, 'Planner Web App');
    for (const name of ['Registration API', 'Payment Gateway']) {
      await tile(editor, 'Container').click();
      await nameNewElement(editor, name);
    }
    await button(editor, 'Fit').click();
    await connect('Planner Web App', 'Registration API', 'submits plans to');

    await option(editor, 'Registration API').click();
    await addResponsibility(editor, 'DECIDE', 'whether a student may enroll in a section');
    await addResponsibility(editor, 'DO', 'hold a seat in every section of a plan, or in none');
    await section(editor, 'Responsibilities').getByRole('button', { name: 'Actions for responsibility 2' }).click();
    await page.getByRole('menuitem', { name: 'Move up' }).click();

    await (await openMenuOf('Payment Gateway')).getByRole('menuitem', { name: 'Move to…' }).click();
    await page.getByRole('menu', { name: 'Move Payment Gateway into' }).getByRole('menuitem', { name: 'Billing System' }).click();

    const { design, byName } = await expectBuiltModel(page);
    expect(isPinned(design.model, design, 'landscape', byName.get('Billing System').id), 'Move… pins the element').toBe(true);
  });
});

test.describe('C4 editor: keyboard only', () => {
  /** Moves focus with the arrow keys, as the canvas's reading order allows, to the option named `name`. */
  async function arrowTo(page, name) {
    for (const key of ['ArrowLeft', 'ArrowRight']) {
      let previous = null;
      for (let current = await focusedOptionName(page); current !== previous; current = await focusedOptionName(page)) {
        if (current === name) return;
        previous = current;
        await page.keyboard.press(key);
      }
    }
    throw new Error(`the arrow keys never reach ${name}`);
  }

  /** A (the Add menu, spec §9.2), the item's first letter, Enter, then the name typed into the in-place field. */
  async function addWithKeyA(page, editor, itemName, name) {
    await page.keyboard.press('a');
    const item = page.getByRole('menuitem', { name: itemName, exact: true });
    await page.keyboard.press(itemName[0].toLowerCase());
    await expect(item).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(nameField(editor)).toBeFocused();
    await page.keyboard.type(name);
    await page.keyboard.press('Enter');
    await expect(option(editor, name)).toBeFocused();
  }

  /** C on the focused option, the arrow keys to the target, Enter, and the description confirmed with Enter. */
  async function connectWithKeyC(page, editor, from, to, description) {
    await arrowTo(page, from);
    await page.keyboard.press('c');
    await arrowTo(page, to);
    await page.keyboard.press('Enter');
    await expect(relationshipForm(editor).getByLabel('Description')).toBeFocused();
    await page.keyboard.type(description);
    await page.keyboard.press('Enter');
    await expect(relationshipForm(editor)).toBeHidden();
  }

  /** Activates a control from the keyboard: focus (as Tab would bring it), then Enter. */
  async function press(locator, key = 'Enter') {
    await locator.focus();
    await locator.press(key);
  }

  test('builds a context and container view from an empty model and uses every editing command without a pointer', async ({ page }) => {
    const editor = await openEditor(page, { text: BLANK, view: 'landscape', profile: 'expert' });
    const latestText = async () => (await page.evaluate(() => window.hostTexts)).at(-1);

    await canvas(editor).focus();
    await addWithKeyA(page, editor, 'Software system', 'Course Registration');
    await addWithKeyA(page, editor, 'Person', 'Student');
    await addWithKeyA(page, editor, 'Software system', 'Billing System');
    await connectWithKeyC(page, editor, 'Student', 'Course Registration', 'plans a schedule using');

    await arrowTo(page, 'Course Registration');
    await page.keyboard.press('Enter');
    const addFirst = editor.getByRole('button', { name: 'Add the first container' });
    await expect(addFirst, 'zooming into an empty system focuses its Add button').toBeFocused();
    await page.keyboard.press('Enter');
    await page.keyboard.type('Planner Web App');
    await page.keyboard.press('Enter');
    await addWithKeyA(page, editor, 'Container', 'Registration API');
    await connectWithKeyC(page, editor, 'Planner Web App', 'Registration API', 'submits plans to');

    // A responsibility and a collaborator for Registration API, in the inspector.
    await arrowTo(page, 'Registration API');
    const responsibilities = section(editor, 'Responsibilities');
    await responsibilities.getByRole('combobox', { name: 'Kind of the new responsibility' }).selectOption({ label: 'DECIDE' });
    await responsibilities.getByRole('textbox', { name: 'New responsibility' }).fill('whether a student may enroll in a section');
    await press(responsibilities.getByRole('button', { name: 'Add responsibility' }));
    const newCollaborator = section(editor, 'Collaborators').getByRole('group', { name: 'New collaborator' });
    await newCollaborator.getByRole('combobox', { name: 'Target' }).selectOption({ label: 'Billing System' });
    await newCollaborator.getByRole('textbox', { name: 'Description' }).fill('charges tuition through');
    await press(newCollaborator.getByRole('button', { name: 'Add collaborator' }));

    // The context view draws Course Registration → Billing System as a derived edge; a summary makes it explicit.
    await press(button(editor, 'Context'));
    await expect(canvas(editor)).toHaveAccessibleName(/System context view/);
    await option(editor, 'Course Registration').focus();
    await press(section(editor, 'Relationships in this view').getByRole('list', { name: 'Derived' })
      .getByRole('button', { name: /Course Registration → Billing System/ }));
    await press(inspector(editor).getByRole('button', { name: 'Add a summary relationship' }));
    await expect(relationshipForm(editor).getByLabel('Description')).toBeFocused();
    await page.keyboard.type('charges tuition through');
    await page.keyboard.press('Enter');

    // Pin Billing System with the Position disclosure's buttons.
    await option(editor, 'Billing System').focus();
    await press(inspector(editor).locator('summary', { hasText: 'Position' }));
    await press(inspector(editor).getByRole('button', { name: 'Move right' }));
    await expect(inspector(editor).getByText(/^Pinned at /)).toBeVisible();

    // Quick fix: Student's relationship goes to the container that receives it.
    await press(editor.getByRole('tab', { name: /^Problems/ }));
    await press(editor.getByRole('button', { name: /^Choose which part receives it/ }).first());
    const newTarget = page.getByRole('menu').getByRole('group', { name: 'New target' });
    await expect(newTarget.getByRole('menuitem').first()).toBeFocused();
    await press(newTarget.getByRole('menuitem', { name: 'Planner Web App' }));

    // A scenario and an environment are written in the YAML tab; the visual editor then adds to them.
    const ids = C4.load(await latestText());
    const idOf = (name) => [...ids.model.elements.values()].find((element) => element.name === name).id;
    await press(editor.getByRole('tab', { name: /^YAML/ }));
    const source = editor.getByRole('textbox', { name: 'YAML source' });
    await source.focus();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+ArrowDown' : 'Control+End');
    await page.keyboard.type(`scenarios:\n  enroll:\n    title: Enroll in a schedule\n    steps:\n      - ${idOf('Planner Web App')} -> ${idOf('Registration API')}: submits the plan to\n`
      + 'deployment:\n  production:\n    name: Production\n');
    await press(treeItem(editor, 'Scenarios'), 'ArrowRight');
    await press(treeItem(editor, 'Enroll in a schedule'));
    const insert = section(editor, 'Steps').getByRole('group', { name: 'New fragment', exact: true });
    await insert.getByRole('combobox', { name: 'Fragment' }).selectOption('alt');
    await insert.getByRole('textbox', { name: 'Guard', exact: true }).fill('the student is eligible');
    await insert.getByRole('textbox', { name: 'Guard of the second branch' }).fill('the student is not eligible');
    await press(insert.getByRole('button', { name: 'Insert fragment' }));

    await press(treeItem(editor, 'Deployment environments'), 'ArrowRight');
    await press(treeItem(editor, 'Production'));
    await canvas(editor).focus();
    await page.keyboard.press('a');
    await page.keyboard.press('n');
    await expect(page.getByRole('menuitem', { name: 'Node', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');

    // A design choice for Registration API.
    await press(button(editor, 'Containers'));
    await option(editor, 'Registration API').focus();
    await press(inspector(editor).locator('summary', { hasText: 'Design choices' }));
    await inspector(editor).getByRole('textbox', { name: 'Chosen technology' }).fill('FastAPI on Python 3.12');
    await inspector(editor).getByRole('textbox', { name: 'Chosen technology' }).press('Tab');
    await expect.poll(async () => C4.load(await latestText()).model.elements.get(idOf('Registration API')).choices?.technology?.chosen)
      .toBe('FastAPI on Python 3.12');

    // Undo and redo from the canvas.
    const withChoice = await page.evaluate(() => window.editor.getText());
    await option(editor, 'Registration API').focus();
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(() => page.evaluate(() => window.editor.getText())).not.toBe(withChoice);
    await page.keyboard.press('ControlOrMeta+y');
    await expect.poll(() => page.evaluate(() => window.editor.getText())).toBe(withChoice);

    await press(button(editor, 'Download YAML'));
    await expect.poll(() => page.evaluate(() => window.saved.map((file) => file.text))).toEqual([withChoice]);

    const { model } = C4.load(withChoice);
    const nameOf = (id) => model.elements.get(id).name;
    expect(model.relationships.map((relationship) => `${nameOf(relationship.sourceId)} → ${nameOf(relationship.targetId)}`).sort()).toEqual([
      'Course Registration → Billing System', 'Planner Web App → Registration API', 'Registration API → Billing System', 'Student → Planner Web App',
    ]);
    expect(model.elements.get(idOf('Registration API')).responsibilities.map((responsibility) => responsibility.text))
      .toEqual(['whether a student may enroll in a section']);
    const design = C4.load(withChoice);
    expect(isPinned(model, design, `context of ${idOf('Course Registration')}`, idOf('Billing System'))).toBe(true);
    expect(C4.toUml(C4.project(design, 'dynamic enroll')).text).toContain('alt [the student is eligible]');
    expect(model.environments.get('production').nodes.size).toBe(1);
  });
});
