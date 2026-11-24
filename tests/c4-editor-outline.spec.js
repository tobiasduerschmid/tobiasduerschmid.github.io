// @ts-check
// The C4 editor's outline (spec §9.1 Outline, §9.2 shortcut scope, Delete, Rename, and "Re-parent an element"): a
// `role="tree"` of the model with keyboard navigation, type-ahead, Enter to open an item's view, a filter field,
// drag re-parenting onto valid parents only, and the item menu's "Move to…" as the single-pointer and keyboard
// alternative. The page holds only an editor state, the actions module (which owns Delete, rename, and Move to…,
// Ruling 5), and the outline. Every edit is checked through the text the host receives (spec §3.4 `onTextChange`),
// read back with the C4 core; view and selection changes through `onViewChange` and `onSelectionChange`.
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
  'c4/editor/c4-editor-outline.js',
]);
const STYLESHEETS = ['css/c4-editor.css'].map((file) => path.join(ARCHUML, file));
const REFERENCE = fs.readFileSync(path.join(ARCHUML, 'tests/c4/fixtures/course-registration.yml'), 'utf8');
const FEATURE = { feature: 'c4-editor' };
const SEAT_COMMENT = '# Seat holds expire after 15 minutes.';
/** The reference model with a comment inside Seat Gateway's entry, which a re-parent must carry along. */
const COMMENTED = REFERENCE.replace('            name: Seat Gateway\n', `            ${SEAT_COMMENT}\n            name: Seat Gateway\n`);
/** Two people and two systems; two names start with "M", one before and one after Advisor. */
const MENTORING = [
  'schema: c4-design/1',
  'name: Mentoring',
  'people:',
  '  mentor: {name: Mentor}',
  '  advisor: {name: Advisor}',
  'systems:',
  '  matching: {name: Matching Service}',
  '  scheduler: {name: Scheduler}',
  '',
].join('\n');

/**
 * Opens a page with one editor root holding the outline region, an editor state (on `text`, opened at `view`; the
 * mount's `reveal` option as given), the
 * actions module, and the outline. The host records every text, view, and selection change; `host.confirm`
 * records each request and answers yes. The root also records every keydown that reaches it, as the editor's own
 * shortcut handling would see it.
 */
async function openOutline(page, { text = REFERENCE, view = 'landscape', reveal = 'all' } = {}) {
  await page.setContent([
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>C4 editor outline</title></head>',
    '<body><main><h1>C4 editor outline</h1><p>Paragraph text sets the reading size.</p>',
    '<div id="editor" class="c4-editor"><section aria-label="Outline"><div id="outline-region"></div></section></div>',
    '</main></body></html>',
  ].join(''));
  // The site's root rule makes 1rem = 10 px; widgets must not shrink text with rem.
  await page.addStyleTag({ content: 'html { font-size: 62.5%; } body { font-size: 1.8rem; }' });
  for (const sheet of STYLESHEETS) await page.addStyleTag({ path: sheet });
  for (const script of SCRIPTS) await page.addScriptTag({ path: path.join(ARCHUML, script) });
  await page.evaluate(({ initialText, initialView, revealMode }) => {
    const root = document.getElementById('editor');
    const parts = window.ArchUMLC4EditorParts;
    const texts = [];
    const views = [];
    const selections = [];
    const confirms = [];
    const keysAtRoot = [];
    let clock = 0;
    const host = {
      onTextChange: (text) => texts.push(text),
      onViewChange: (selector) => views.push(selector),
      onSelectionChange: (selection) => selections.push(selection),
      confirm: (request) => {
        confirms.push(request.title);
        return Promise.resolve(true);
      },
    };
    const state = parts.state.createEditorState({ text: initialText, view: initialView, host, now: () => (clock += 1000) });
    const ids = parts.dom.idFactory('ed1');
    const announce = parts.dom.createAnnouncer(root);
    const escape = parts.dom.createEscapeStack(root);
    const actions = parts.actions.createActions(root, { state, dom: parts.dom, host, ids, announce });
    const region = document.getElementById('outline-region');
    const outline = parts.outline.createOutline(region,
      { state, dom: parts.dom, actions, host, ids, announce, escape, options: { reveal: revealMode } });
    // Added last, so it sees each keydown after the editor-wide Escape stack has had its turn.
    root.addEventListener('keydown', (event) => keysAtRoot.push({ key: event.key, handled: event.defaultPrevented }));
    window.harness = { state, outline, texts, views, selections, confirms, keysAtRoot };
  }, { initialText: text, initialView: view, revealMode: reveal });
  return page.getByRole('tree', { name: 'Model outline' });
}

function item(scope, name) {
  return scope.getByRole('treeitem', { name, exact: true });
}

/** The treeitems directly inside `parent`: the ARIA tree structure (treeitem › group › treeitem). */
function childItems(parent) {
  return parent.locator(':scope > [role="group"] > [role="treeitem"]');
}

async function expectNames(items, names) {
  await expect(items).toHaveCount(names.length);
  for (const [index, name] of names.entries()) await expect(items.nth(index)).toHaveAccessibleName(name);
}

/** Expands a collapsed item from the keyboard, as a user would: focus it, then press the Right arrow. */
async function expand(page, treeitem) {
  await expect(treeitem).toHaveAttribute('aria-expanded', 'false');
  await treeitem.focus();
  await page.keyboard.press('ArrowRight');
  await expect(treeitem).toHaveAttribute('aria-expanded', 'true');
}

/** Opens the outline down to Seat Gateway (Course Registration › Registration API) and returns its treeitem. */
async function revealSeatGateway(page, tree) {
  await expand(page, item(tree, 'Course Registration'));
  await expand(page, item(tree, 'Registration API'));
  return item(tree, 'Seat Gateway');
}

/** The visible name of a treeitem: the text a pointer user grabs or drops onto. */
function nameText(tree, name) {
  return item(tree, name).getByText(name, { exact: true });
}

/** Presses the mouse on the item named `fromName` and moves it onto the item named `toName` (pointer events). */
async function dragOver(page, tree, fromName, toName) {
  const start = await nameText(tree, fromName).boundingBox();
  const end = await nameText(tree, toName).boundingBox();
  if (!start || !end) throw new Error('Both rows must be visible to drag');
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 12 });
}

async function dragOnto(page, tree, fromName, toName) {
  await dragOver(page, tree, fromName, toName);
  await page.mouse.up();
}

/** The long-press time the outline waits for before a finger drags instead of scrolling. */
const LONG_PRESS_MS = 500;

/**
 * A finger on the outline, through Chromium's touch input, so the browser itself turns the touches into pointer
 * events. `down(name)` touches the middle of that item's name, `moveTo(name)` slides there in steps, `up()` lifts.
 */
async function touchFinger(page, tree) {
  const cdp = await page.context().newCDPSession(page);
  let at = null;
  const centre = async (name) => {
    const box = await nameText(tree, name).boundingBox();
    if (!box) throw new Error(`${name} must be visible to touch`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  return {
    async down(name) {
      at = await centre(name);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
    },
    async moveTo(name) {
      const end = await centre(name);
      const from = at;
      for (let step = 1; step <= 8; step += 1) {
        at = { x: from.x + ((end.x - from.x) * step) / 8, y: from.y + ((end.y - from.y) * step) / 8 };
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [at] });
      }
    },
    async up() {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    },
  };
}

function hostTexts(page) {
  return page.evaluate(() => window.harness.texts.slice());
}

async function currentModel(page) {
  const texts = await hostTexts(page);
  const design = C4.load(texts.length > 0 ? texts[texts.length - 1] : REFERENCE);
  expect(design.model, 'the edited text is still readable YAML').not.toBeNull();
  return design.model;
}

test.describe('C4 editor outline', () => {
  test('the outline mirrors the model hierarchy', async ({ page }) => {
    const tree = await openOutline(page);

    await expectNames(tree.locator(':scope > [role="treeitem"]'),
      ['People', 'Software systems', 'Interfaces', 'Scenarios', 'Deployment environments', 'Decisions', 'Requirements']);
    await expectNames(childItems(item(tree, 'People')), ['Student']);
    await expectNames(childItems(item(tree, 'Software systems')), ['Course Registration', 'Billing System']);
    // Interfaces form one top-level branch, each named with its provider (spec §9.1).
    await expectNames(childItems(item(tree, 'Interfaces')), ['Registration Coordinator interface (Registration Coordinator)']);
    await expectNames(childItems(item(tree, 'Scenarios')), ['Enroll in a planned schedule']);
    await expectNames(childItems(item(tree, 'Deployment environments')), ['Production']);
    await expectNames(childItems(item(tree, 'Decisions')), ['Keep plans and seat holds in one relational database']);
    await expectNames(childItems(item(tree, 'Requirements')), ['FR-07', 'FR-09']);

    await expand(page, item(tree, 'Course Registration'));
    await expectNames(childItems(item(tree, 'Course Registration')), ['Planner Web App', 'Registration API', 'Registration Database']);
    await expand(page, item(tree, 'Registration API'));
    await expectNames(childItems(item(tree, 'Registration API')),
      ['Registration Coordinator', 'Enrollment Policy', 'Seat Gateway', 'Billing Gateway']);
    await expand(page, item(tree, 'Enrollment Policy'));
    await expectNames(childItems(item(tree, 'Enrollment Policy')),
      ['EnrollmentPolicy', 'EnrollmentRule', 'PrerequisiteRule', 'UnitCapRule']);
    await expect(item(tree, 'Seat Gateway'), 'a component without code is a leaf').not.toHaveAttribute('aria-expanded');

    await expand(page, item(tree, 'Production'));
    await expectNames(childItems(item(tree, 'Production')), ["Student's computer", 'Campus cloud', 'University data centre']);
    await expand(page, item(tree, 'Campus cloud'));
    await expectNames(childItems(item(tree, 'Campus cloud')), ['Ingress load balancer', 'API pod', 'Managed database']);

    await a11yCheckpoint(page, 'c4 editor outline expanded', FEATURE);
  });

  test('arrow keys, Home, and End move through the visible items; Right and Left open and close', async ({ page }) => {
    const tree = await openOutline(page);
    const people = item(tree, 'People');
    await people.focus();

    await page.keyboard.press('ArrowDown');
    await expect(item(tree, 'Student')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(item(tree, 'Software systems')).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(item(tree, 'Student')).toBeFocused();

    await page.keyboard.press('ArrowLeft');
    await expect(people, 'Left on a leaf moves to its parent').toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(people).toHaveAttribute('aria-expanded', 'false');
    await expect(item(tree, 'Student'), 'a collapsed branch hides its items').toHaveCount(0);
    await page.keyboard.press('ArrowRight');
    await expect(people).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('ArrowRight');
    await expect(item(tree, 'Student'), 'Right on an open branch moves to its first item').toBeFocused();

    await page.keyboard.press('End');
    await expect(item(tree, 'FR-09')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(people).toBeFocused();
    await expect(tree.locator('[role="treeitem"][tabindex="0"]'), 'the tree is one tab stop').toHaveCount(1);
  });

  test('typing m moves focus to the next item starting with m', async ({ page }) => {
    const tree = await openOutline(page, { text: MENTORING, view: 'landscape' });
    await item(tree, 'Advisor').focus();

    await page.keyboard.press('m');
    await expect(item(tree, 'Matching Service'), 'the search starts after the focused item').toBeFocused();
    await page.keyboard.press('m');
    await expect(item(tree, 'Mentor'), 'it wraps around to the top').toBeFocused();
  });

  test('letters typed in the outline reach the editor as handled, so they never act as shortcuts', async ({ page }) => {
    const tree = await openOutline(page);
    await item(tree, 'Student').focus();

    for (const key of ['a', 'f', 'm', 'c']) await page.keyboard.press(key);

    const keys = await page.evaluate(() => window.harness.keysAtRoot);
    expect(keys).toEqual(['a', 'f', 'm', 'c'].map((key) => ({ key, handled: true })));
  });

  test("Enter on a component opens its container's component view with it selected", async ({ page }) => {
    const tree = await openOutline(page);
    const seats = await revealSeatGateway(page, tree);
    await seats.focus();

    await page.keyboard.press('Enter');

    await expect.poll(() => page.evaluate(() => window.harness.views.at(-1))).toBe('components of api');
    expect(await page.evaluate(() => window.harness.selections.at(-1))).toEqual({ elementId: 'seats' });
    await expect(seats).toHaveAttribute('aria-selected', 'true');
    await expect(seats, 'focus stays in the outline').toBeFocused();
  });

  test('Enter on a scenario opens its dynamic view', async ({ page }) => {
    const tree = await openOutline(page);
    await item(tree, 'Enroll in a planned schedule').focus();

    await page.keyboard.press('Enter');

    await expect.poll(() => page.evaluate(() => window.harness.views.at(-1))).toBe('dynamic enroll');
    expect(await page.evaluate(() => window.harness.selections.at(-1))).toEqual({ scenarioId: 'enroll' });
  });

  test('Enter on a deployment node opens its environment with the node selected', async ({ page }) => {
    const tree = await openOutline(page);
    await expand(page, item(tree, 'Production'));
    await expand(page, item(tree, 'Campus cloud'));
    await item(tree, 'API pod').focus();

    await page.keyboard.press('Enter');

    await expect.poll(() => page.evaluate(() => window.harness.views.at(-1))).toBe('deployment production');
    expect(await page.evaluate(() => window.harness.selections.at(-1))).toEqual({ environmentId: 'production', nodeId: 'api-pod' });
  });

  test('the filter narrows items and keeps ancestors visible', async ({ page }) => {
    const tree = await openOutline(page);
    const filter = page.getByRole('searchbox', { name: 'Filter the outline' });

    await filter.fill('gateway');

    await expectNames(tree.getByRole('treeitem'),
      ['Software systems', 'Course Registration', 'Registration API', 'Seat Gateway', 'Billing Gateway']);
    await expect(page.getByRole('status')).toHaveText('2 items match "gateway".');
    await a11yCheckpoint(page, 'c4 editor outline filtered', FEATURE);

    await filter.press('Escape');
    await expect(filter).toHaveValue('');
    expect(await page.evaluate(() => window.harness.keysAtRoot.filter((entry) => entry.key === 'Escape')),
      'Escape clears the filter and goes no further, so the selection stays').toEqual([{ key: 'Escape', handled: true }]);
    await expect(item(tree, 'Seat Gateway'), 'clearing the filter restores the collapsed outline').toHaveCount(0);
    await expect(item(tree, 'Requirements')).toBeVisible();
  });

  test('the filter says when nothing matches', async ({ page }) => {
    const tree = await openOutline(page);

    await page.getByRole('searchbox', { name: 'Filter the outline' }).fill('zebra');

    await expect(page.getByRole('region', { name: 'Outline' }).getByText('No items match "zebra".')).toBeVisible();
    await expect(tree).toBeHidden();
  });

  test('dragging a component onto another container re-parents it and keeps its comments', async ({ page }) => {
    const tree = await openOutline(page, { text: COMMENTED });
    const seats = await revealSeatGateway(page, tree);

    await dragOnto(page, tree, 'Seat Gateway', 'Planner Web App');

    await expect.poll(async () => (await hostTexts(page)).length, 'one change reaches the host').toBe(1);
    const [text] = await hostTexts(page);
    expect(C4.load(text).model.elements.get('seats').parentId).toBe('web');
    expect(text).toContain(SEAT_COMMENT);
    await expect(page.getByRole('status')).toHaveText('Moved Seat Gateway into Planner Web App.');
    await expect(item(item(tree, 'Planner Web App'), 'Seat Gateway'))
      .toHaveCount(1);
  });

  test('a component cannot be dropped onto a system', async ({ page }) => {
    const tree = await openOutline(page);
    const seats = await revealSeatGateway(page, tree);

    await dragOnto(page, tree, 'Seat Gateway', 'Course Registration');

    await expect(page.getByRole('status')).toHaveText(/^Seat Gateway was not moved/);
    expect(await hostTexts(page)).toEqual([]);
    await expect(item(item(tree, 'Registration API'), 'Seat Gateway'))
      .toHaveCount(1);
  });

  test('Escape during a drag cancels it', async ({ page }) => {
    const tree = await openOutline(page);
    await revealSeatGateway(page, tree);

    await dragOver(page, tree, 'Seat Gateway', 'Planner Web App');
    await page.keyboard.press('Escape');
    await page.mouse.up();

    await expect(page.getByRole('status')).toHaveText(/^Stopped moving Seat Gateway/);
    expect(await hostTexts(page)).toEqual([]);
    expect(await page.evaluate(() => window.harness.keysAtRoot.filter((entry) => entry.key === 'Escape')))
      .toEqual([{ key: 'Escape', handled: true }]);
  });

  test.describe('on a touch screen', () => {
    test.use({ hasTouch: true });
    test.skip(({ browserName }) => browserName !== 'chromium', 'touch input is sent through the Chromium DevTools protocol');

    // The page clock is installed before the outline loads, so the long press elapses only when a test says so.
    test.beforeEach(async ({ page }) => {
      await page.clock.install();
    });

    test('a long press and then a drag onto another container re-parents the component', async ({ page }) => {
      const tree = await openOutline(page);
      await revealSeatGateway(page, tree);
      const finger = await touchFinger(page, tree);

      await finger.down('Seat Gateway');
      await page.clock.runFor(LONG_PRESS_MS);
      await finger.moveTo('Planner Web App');
      await finger.up();

      await expect(page.getByRole('status')).toHaveText('Moved Seat Gateway into Planner Web App.');
      expect((await currentModel(page)).elements.get('seats').parentId).toBe('web');
      expect(await hostTexts(page)).toHaveLength(1);
    });

    test('a quick swipe from one item onto another scrolls instead of moving anything', async ({ page }) => {
      const tree = await openOutline(page);
      await revealSeatGateway(page, tree);
      const finger = await touchFinger(page, tree);

      await finger.down('Seat Gateway');
      await finger.moveTo('Planner Web App');
      await finger.up();
      await page.clock.runFor(LONG_PRESS_MS);

      expect(await hostTexts(page)).toEqual([]);
      await expect(page.getByRole('status')).toHaveText('');
      await expect(item(item(tree, 'Registration API'), 'Seat Gateway')).toHaveCount(1);
    });

    test('a long press lifted without moving opens the item menu', async ({ page }) => {
      const tree = await openOutline(page);
      await revealSeatGateway(page, tree);
      const finger = await touchFinger(page, tree);

      await finger.down('Seat Gateway');
      await page.clock.runFor(LONG_PRESS_MS);
      await finger.up();

      await expect(page.getByRole('menu', { name: 'Actions for Seat Gateway' })).toBeVisible();
      expect(await hostTexts(page)).toEqual([]);
      await a11yCheckpoint(page, 'outline item menu opened by a long press');
    });
  });

  test('Move to… re-parents without dragging', async ({ page }) => {
    const tree = await openOutline(page);
    const seats = await revealSeatGateway(page, tree);
    await nameText(tree, 'Seat Gateway').click();

    await seats.getByRole('button', { name: 'Actions for Seat Gateway' }).click();
    await page.getByRole('menuitem', { name: 'Move to…' }).click();
    await page.getByRole('menuitem', { name: 'Planner Web App' }).click();

    expect((await currentModel(page)).elements.get('seats').parentId).toBe('web');
    expect(await hostTexts(page)).toHaveLength(1);
    await expect(item(tree, 'Seat Gateway'), 'focus follows the moved item').toBeFocused();
  });

  test('Shift+F10 opens the item menu from the keyboard', async ({ page }) => {
    const tree = await openOutline(page);
    const seats = await revealSeatGateway(page, tree);
    await seats.focus();

    await page.keyboard.press('Shift+F10');

    await expect(page.getByRole('menu', { name: 'Actions for Seat Gateway' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Move to…' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(seats, 'Escape returns focus to the item').toBeFocused();
  });

  for (const key of ['Delete', 'Backspace']) {
    test(`${key} on a component deletes it after confirmation and focus moves to the next item`, async ({ page }) => {
      const tree = await openOutline(page);
      const seats = await revealSeatGateway(page, tree);
      await seats.focus();

      await page.keyboard.press(key);

      await expect(item(tree, 'Billing Gateway')).toBeFocused();
      expect(await page.evaluate(() => window.harness.confirms)).toEqual(['Delete Seat Gateway?']);
      expect((await currentModel(page)).elements.has('seats')).toBe(false);
      await expect(item(tree, 'Seat Gateway')).toHaveCount(0);
    });
  }

  test('deleting the only element leaves focus in the outline, on the filter field', async ({ page }) => {
    const tree = await openOutline(page, { text: 'schema: c4-design/1\nname: Solo\npeople:\n  mentor: {name: Mentor}\n' });
    await item(tree, 'Mentor').focus();

    await page.keyboard.press('Delete');

    await expect(page.getByText('The model has nothing in it yet.')).toBeVisible();
    await expect(page.getByRole('searchbox', { name: 'Filter the outline' })).toBeFocused();
  });

  test('F2 renames the element in place and Enter commits', async ({ page }) => {
    const tree = await openOutline(page);
    const seats = await revealSeatGateway(page, tree);
    await seats.focus();

    await page.keyboard.press('F2');
    const field = page.getByRole('textbox', { name: 'Name of Seat Gateway' });
    await expect(field).toBeFocused();
    await expect(field).toHaveValue('Seat Gateway');
    await field.fill('Seat Holder');
    await field.press('Enter');

    expect((await currentModel(page)).elements.get('seats').name).toBe('Seat Holder');
    await expect(item(tree, 'Seat Holder')).toBeFocused();
  });

  test('Escape cancels an in-place rename', async ({ page }) => {
    const tree = await openOutline(page);
    const seats = await revealSeatGateway(page, tree);
    await seats.focus();

    await page.keyboard.press('F2');
    await page.getByRole('textbox', { name: 'Name of Seat Gateway' }).fill('Seat Holder');
    await page.keyboard.press('Escape');

    await expect(seats).toBeFocused();
    expect(await hostTexts(page)).toEqual([]);
    expect(await page.evaluate(() => window.harness.keysAtRoot.filter((entry) => entry.key === 'Escape')),
      'the editor-wide Escape layers (such as clearing the selection) leave it alone').toEqual([{ key: 'Escape', handled: true }]);
  });

  test('an empty name is refused, and the field says why', async ({ page }) => {
    const tree = await openOutline(page);
    const seats = await revealSeatGateway(page, tree);
    await seats.focus();

    await page.keyboard.press('F2');
    const field = page.getByRole('textbox', { name: 'Name of Seat Gateway' });
    await field.fill('   ');
    await field.press('Enter');

    await expect(field).toBeFocused();
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(field).toHaveAccessibleDescription(/^Error: A name needs some text/);
    expect(await hostTexts(page)).toEqual([]);
    await a11yCheckpoint(page, 'c4 editor outline rename error', FEATURE);
  });

  test('new text from the host keeps the focused item focused', async ({ page }) => {
    const tree = await openOutline(page);
    const seats = await revealSeatGateway(page, tree);
    await seats.focus();

    await page.evaluate((text) => window.harness.state.setText(text), REFERENCE.replace('name: Planner Web App', 'name: Schedule Planner'));

    await expect(item(tree, 'Schedule Planner')).toBeVisible();
    await expect(item(tree, 'Seat Gateway')).toBeFocused();
  });

  test('the outline opens down to the scope of the open view', async ({ page }) => {
    const tree = await openOutline(page, { view: 'containers of registration' });

    await expect(item(tree, 'Course Registration')).toHaveAttribute('aria-expanded', 'true');
    await expect(item(tree, 'Registration API')).toBeVisible();
  });

  test("with reveal 'on-request' the outline stays collapsed below the scope", async ({ page }) => {
    const tree = await openOutline(page, { view: 'containers of registration', reveal: 'on-request' });

    await expect(item(tree, 'Course Registration')).toHaveAttribute('aria-expanded', 'false');
    await expect(item(tree, 'Registration API')).toHaveCount(0);
  });

  test("after Show inside, the outline opens below the scope, and later views open their scope too", async ({ page }) => {
    const tree = await openOutline(page, { view: 'containers of registration', reveal: 'on-request' });
    await expect(item(tree, 'Course Registration')).toHaveAttribute('aria-expanded', 'false');

    await page.evaluate(() => window.harness.outline.showInside());

    await expect(item(tree, 'Course Registration')).toHaveAttribute('aria-expanded', 'true');
    await expect(item(tree, 'Registration API')).toBeVisible();
    await page.evaluate(() => window.harness.state.openView('components of api'));
    await expect(item(tree, 'Registration API')).toHaveAttribute('aria-expanded', 'true');
    await expect(item(tree, 'Seat Gateway')).toBeVisible();
  });

  test('an element selected elsewhere is revealed and marked selected', async ({ page }) => {
    const tree = await openOutline(page);

    await page.evaluate(() => window.harness.state.select('seats'));

    await expect(item(tree, 'Seat Gateway')).toBeVisible();
    await expect(item(tree, 'Seat Gateway')).toHaveAttribute('aria-selected', 'true');
    await expect(tree.locator('[aria-selected="true"]')).toHaveCount(1);
  });

  test('outline text and the filter field are paragraph-sized', async ({ page }) => {
    const tree = await openOutline(page);
    const paragraph = await page.locator('main > p').evaluate((node) => getComputedStyle(node).fontSize);

    const label = await nameText(tree, 'Student').evaluate((node) => getComputedStyle(node).fontSize);
    const filter = await page.getByRole('searchbox', { name: 'Filter the outline' }).evaluate((node) => getComputedStyle(node).fontSize);

    expect(label).toBe(paragraph);
    expect(filter).toBe(paragraph);
  });

  test('destroy removes the outline', async ({ page }) => {
    await openOutline(page);

    await page.evaluate(() => window.harness.outline.destroy());
    await page.evaluate(() => window.harness.state.select('seats'));

    await expect(page.getByRole('tree')).toHaveCount(0);
    await expect(page.getByRole('searchbox')).toHaveCount(0);
  });
});
