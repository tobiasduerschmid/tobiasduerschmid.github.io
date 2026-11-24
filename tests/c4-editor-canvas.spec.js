// @ts-check
// The C4 editor's canvas (spec §9.1 Canvas, §9.2 Interactions, Focus, Announcements): the listbox of elements over the
// drawing, keyboard focus that moves in reading order with selection following it, zooming into and out of
// elements (Enter, the zoom badge, Alt+ArrowUp; a double-click edits text instead, ED-12), panning and magnifying with
// the pointer, and the focus and announcement rules that go with them.
// The page is built with setContent and loads every part from the manifest, so the canvas works with the real
// outline, inspector, panels, and actions. It has a 96 px sticky header, like the site's navbar, and the 62.5% root
// font size of this site. The model's facts (names, children) come from the C4 core, the oracle for what the canvas
// must show.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { a11yCheckpoint } = require('./a11y-helpers');

const ARCHUML = path.join(__dirname, '../js/ArchUML');
const C4 = require(path.join(ARCHUML, 'c4/c4-core.js'));
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ARCHUML, 'c4/manifest.json'), 'utf8'));
const SCRIPTS = ['uml-bundle.js', ...MANIFEST.core, ...MANIFEST.render, ...MANIFEST.editor].map((file) => path.join(ARCHUML, file));
const STYLESHEET = path.join(ARCHUML, 'css/c4-editor.css');
const REFERENCE = fs.readFileSync(path.join(ARCHUML, 'tests/c4/fixtures/course-registration.yml'), 'utf8');
const REFERENCE_MODEL = C4.load(REFERENCE).model;
const FEATURE = { feature: 'c4-editor' };
const NAVBAR_PX = 96;

/** The names of the children of `parentId` in the reference model. */
function childNames(parentId) {
  return [...REFERENCE_MODEL.elements.values()].filter((element) => element.parentId === parentId).map((element) => element.name);
}

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>C4 editor canvas</title>
<style>
  html { font-size: 62.5%; }
  body { margin: 0; font-size: 20px; }
  header { position: sticky; top: 0; z-index: 10; height: ${NAVBAR_PX}px; background: #ffffff; border-bottom: 1px solid #555555; }
  main { padding: 16px; }
  .after { height: 150vh; }
</style>
</head><body><header><p>Site navigation</p></header><main><h1>C4 editor canvas</h1><div id="editor"></div><div class="after"></div></main></body></html>`;

/** Loads every part and mounts an editor on #editor showing `view`; the host records texts and selections. */
async function openEditor(page, { text = REFERENCE, view = 'containers of registration' } = {}) {
  await page.setContent(PAGE);
  await page.addStyleTag({ path: STYLESHEET });
  for (const script of SCRIPTS) await page.addScriptTag({ path: script });
  await page.evaluate(({ modelText, selector }) => {
    window.hostTexts = [];
    window.editor = window.ArchUMLC4Editor.mount(document.getElementById('editor'), {
      text: modelText, view: selector, profile: 'expert', host: { onTextChange: (changed) => window.hostTexts.push(changed) },
    });
  }, { modelText: text, selector: view });
  return page.locator('#editor');
}

const canvas = (editor) => editor.getByRole('region', { name: /^Canvas/ });
const elements = (editor) => canvas(editor).getByRole('listbox', { name: 'Elements in this view' });
const option = (editor, name) => elements(editor).getByRole('option', { name, exact: true });
const inspectorTitle = (editor) => editor.getByRole('region', { name: 'Inspector', exact: true }).getByRole('heading', { level: 3 });

/** The accessible name of the focused element, read from its `<title>` (options are named by aria-labelledby). */
function focusedOptionName(page) {
  return page.evaluate(() => {
    const focused = document.activeElement;
    if (!focused || focused.getAttribute('role') !== 'option') return null;
    return document.getElementById(focused.getAttribute('aria-labelledby')).textContent;
  });
}

/** The box of the focused option in the drawing (relative to its SVG), so scrolling between reads does not matter. */
function focusedBoxInDrawing(page) {
  return page.evaluate(() => {
    const box = document.activeElement.getBoundingClientRect();
    const drawing = document.activeElement.ownerSVGElement.getBoundingClientRect();
    return { top: box.top - drawing.top, bottom: box.bottom - drawing.top, left: box.left - drawing.left, right: box.right - drawing.left };
  });
}

/** The client box of the focused element. */
function focusedBox(page) {
  return page.evaluate(() => {
    const box = document.activeElement.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom, left: box.left, right: box.right };
  });
}

/**
 * Gives the canvas's tab stop focus the way a keyboard user does: from the canvas region, Tab past the controls
 * above the drawing (the carry-down tray's toggle) to the one option in the tab order.
 */
async function tabIntoElements(page, editor) {
  await canvas(editor).focus();
  for (let presses = 0; presses < 4 && (await focusedOptionName(page)) === null; presses += 1) await page.keyboard.press('Tab');
}

async function lastHostText(page) {
  const texts = await page.evaluate(() => window.hostTexts);
  return texts.length > 0 ? texts[texts.length - 1] : REFERENCE;
}

test.describe('C4 editor canvas: keyboard navigation', () => {
  test('arrow keys move focus between elements in reading order and the inspector follows', async ({ page }) => {
    const editor = await openEditor(page);
    const optionCount = await elements(editor).getByRole('option').count();
    expect(optionCount, 'the view has elements to visit').toBeGreaterThan(1);
    await tabIntoElements(page, editor);

    const visited = [];
    for (let step = 0; step < optionCount; step += 1) {
      if (step > 0) await page.keyboard.press(step % 2 === 0 ? 'ArrowRight' : 'ArrowDown');
      const name = await focusedOptionName(page);
      expect(name, `step ${step}: focus stays on an element of the drawing`).not.toBeNull();
      await expect(option(editor, name), 'selection follows focus').toHaveAttribute('aria-selected', 'true');
      await expect(inspectorTitle(editor), 'the inspector shows the focused element').toHaveText(name);
      visited.push({ name, box: await focusedBoxInDrawing(page) });
    }
    expect(new Set(visited.map((item) => item.name)).size, 'every element is reached once').toBe(optionCount);
    // Reading order: each next element starts on a later row, or on the same row further right.
    for (let index = 1; index < visited.length; index += 1) {
      const before = visited[index - 1].box;
      const after = visited[index].box;
      const centre = (after.top + after.bottom) / 2;
      const sameRow = centre >= before.top && centre <= before.bottom;
      expect(sameRow ? after.left > before.left : centre > before.bottom,
        `${visited[index].name} follows ${visited[index - 1].name} in reading order`).toBe(true);
    }
    await a11yCheckpoint(page, 'c4-editor-canvas-focused-option', Object.assign({ include: '#editor' }, FEATURE));

    await page.keyboard.press('ArrowLeft');
    expect(await focusedOptionName(page), 'ArrowLeft goes back one element').toBe(visited[visited.length - 2].name);
    await page.keyboard.press('ArrowUp');
    expect(await focusedOptionName(page), 'ArrowUp goes back one element').toBe(visited[visited.length - 3].name);
  });

  test('only the selected element is a tab stop, and selecting in the outline moves the tab stop', async ({ page }) => {
    const editor = await openEditor(page);
    await expect(elements(editor).locator('[tabindex="0"]')).toHaveCount(1);

    await editor.getByRole('tree', { name: 'Model outline' }).getByRole('treeitem', { name: 'Registration Database', exact: true }).click();
    await expect(option(editor, 'Registration Database')).toHaveAttribute('aria-selected', 'true');
    await tabIntoElements(page, editor);
    expect(await focusedOptionName(page)).toBe('Registration Database');
  });

  test('Enter on Registration API opens its component view and focuses its first component', async ({ page }) => {
    const editor = await openEditor(page);
    await option(editor, 'Registration API').focus();
    await page.keyboard.press('Enter');

    await expect(canvas(editor)).toHaveAccessibleName('Canvas: Component view: Registration API');
    const focused = await focusedOptionName(page);
    expect(childNames('api'), 'focus is on a component of Registration API').toContain(focused);
    await expect(option(editor, focused)).toHaveAttribute('aria-selected', 'true');
    // The first component: nothing inside Registration API comes before it in reading order.
    await page.keyboard.press('ArrowLeft');
    expect(childNames('api'), 'ArrowLeft leaves the components').not.toContain(await focusedOptionName(page));
  });

  test('Alt+ArrowUp returns to the container view with Registration API focused', async ({ page }) => {
    const editor = await openEditor(page, { view: 'components of api' });
    await option(editor, childNames('api')[0]).focus();
    await page.keyboard.press('Alt+ArrowUp');

    await expect(canvas(editor)).toHaveAccessibleName('Canvas: Container view: Course Registration');
    expect(await focusedOptionName(page)).toBe('Registration API');
    await expect(option(editor, 'Registration API')).toHaveAttribute('aria-selected', 'true');
  });

  test('Alt+ArrowUp stops at the context view, the top view, and says so', async ({ page }) => {
    const editor = await openEditor(page, { view: 'containers of registration' });
    await option(editor, 'Registration API').focus();
    await page.keyboard.press('Alt+ArrowUp');
    await expect(canvas(editor)).toHaveAccessibleName('Canvas: System context view: Course Registration');

    await option(editor, 'Course Registration').focus();
    await page.keyboard.press('Alt+ArrowUp');
    await expect(editor.getByRole('status').filter({ hasText: 'This is the top view; no view contains it.' })).toHaveCount(1);
    await expect(canvas(editor)).toHaveAccessibleName('Canvas: System context view: Course Registration');
  });

  test('zooming into an element without children offers Add the first component, which adds one', async ({ page }) => {
    const editor = await openEditor(page);
    await option(editor, 'Planner Web App').focus();
    await page.keyboard.press('Enter');

    await expect(canvas(editor)).toHaveAccessibleName('Canvas: Component view: Planner Web App');
    const addFirst = canvas(editor).getByRole('button', { name: 'Add the first component', exact: true });
    await expect(addFirst).toBeFocused();

    await page.keyboard.press('Enter');
    await expect.poll(async () => C4.load(await lastHostText(page)).model.elements.get('web').childIds.length,
      'Planner Web App gets one component').toBe(1);
    const web = C4.load(await lastHostText(page)).model;
    const added = web.elements.get(web.elements.get('web').childIds[0]).name;
    // Spec §9.2 Add details: the new element is selected with its name ready for in-place editing.
    await expect(canvas(editor).getByRole('textbox', { name: `Name of ${added}` }), 'the new component\'s name is ready to edit').toBeFocused();
    await page.keyboard.press('Enter');
    expect(await focusedOptionName(page), 'keeping the name focuses the new component').toBe(added);
    await expect(addFirst).toHaveCount(0);
  });

  test('zooming in from a scrolled canvas reveals the Add the first component button and its note', async ({ page }) => {
    const editor = await openEditor(page);
    await option(editor, 'Planner Web App').focus();
    // The canvas keeps its scroll position across views, so scroll it away from the top where the empty scope appears.
    const scrolledTop = await canvas(editor).evaluate((region) => {
      region.scrollTop = 350;
      return region.scrollTop;
    });
    expect(scrolledTop, 'the container view is tall enough to scroll').toBeGreaterThan(0);
    await page.keyboard.press('Enter');

    const addFirst = canvas(editor).getByRole('button', { name: 'Add the first component', exact: true });
    await expect(addFirst).toBeFocused();
    const note = canvas(editor).getByText('Planner Web App has no components yet.', { exact: true });
    const visibleArea = await canvas(editor).evaluate((region) => {
      const box = region.getBoundingClientRect();
      const top = box.top + region.clientTop;
      return { top: Math.max(top, 0), bottom: Math.min(top + region.clientHeight, window.innerHeight) };
    });
    for (const [label, target] of [['the focused button', addFirst], ['the note', note]]) {
      const box = await target.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom };
      });
      expect(box.top, `${label} is inside the canvas region`).toBeGreaterThanOrEqual(visibleArea.top);
      expect(box.bottom, `${label} is inside the canvas region`).toBeLessThanOrEqual(visibleArea.bottom);
      expect(box.top, `${label} is below the ${NAVBAR_PX} px header`).toBeGreaterThanOrEqual(NAVBAR_PX);
    }
  });

  test('re-rendering keeps focus on the focused element', async ({ page }) => {
    const editor = await openEditor(page);
    await option(editor, 'Registration API').focus();
    await page.evaluate((text) => window.editor.setText(text.replace('name: Registration Database', 'name: Seat Database')), REFERENCE);

    await expect(option(editor, 'Seat Database')).toBeVisible();
    expect(await focusedOptionName(page)).toBe('Registration API');
  });

  test('arrow keys on the focused canvas region scroll it', async ({ page }) => {
    const editor = await openEditor(page, { view: 'components of api' });
    await canvas(editor).focus();
    const scroll = () => canvas(editor).evaluate((region) => ({ left: region.scrollLeft, top: region.scrollTop }));
    const before = await scroll();
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await scroll()).left, 'ArrowRight scrolls right').toBeGreaterThan(before.left);
    await page.keyboard.press('ArrowDown');
    await expect.poll(async () => (await scroll()).top, 'ArrowDown scrolls down').toBeGreaterThan(before.top);
    await expect(canvas(editor), 'focus stays on the region').toBeFocused();
  });

  test('the focused option is not obscured by the sticky navbar', async ({ page }) => {
    const editor = await openEditor(page);
    // The canvas's top edge sits behind the sticky header, as after scrolling the page down to the editor.
    await canvas(editor).evaluate((region) => window.scrollBy(0, region.getBoundingClientRect().top - 20));
    await canvas(editor).evaluate((region) => region.focus({ preventScroll: true }));
    for (let presses = 0; presses < 4 && (await focusedOptionName(page)) === null; presses += 1) await page.keyboard.press('Tab');

    const optionCount = await elements(editor).getByRole('option').count();
    expect(optionCount, 'the view has elements to focus').toBeGreaterThan(1);
    for (let step = 0; step < optionCount; step += 1) {
      if (step > 0) await page.keyboard.press('ArrowRight');
      const box = await focusedBox(page);
      const viewportHeight = await page.evaluate(() => window.innerHeight);
      expect(box.top, `${await focusedOptionName(page)} is below the ${NAVBAR_PX} px header`).toBeGreaterThanOrEqual(NAVBAR_PX);
      expect(box.bottom, `${await focusedOptionName(page)} is inside the viewport`).toBeLessThanOrEqual(viewportHeight);
    }
  });

  test('view changes are announced', async ({ page }) => {
    const editor = await openEditor(page);
    await option(editor, 'Registration API').focus();
    await page.keyboard.press('Enter');

    const brief = C4.describe(C4.project(C4.load(REFERENCE), 'components of api')).brief;
    await expect(editor.getByRole('status').filter({ hasText: brief })).toHaveCount(1);
  });
});

test.describe('C4 editor canvas: pointer navigation', () => {
  test('clicking the zoom badge of Registration API opens its view; double-clicking the box edits its name instead', async ({ page }) => {
    const editor = await openEditor(page);
    // A double-click edits text in place (ED-12): it opens the name field and never zooms.
    await option(editor, 'Registration API').dblclick();
    await expect(canvas(editor).getByRole('textbox', { name: /of Registration API$/ })).toBeFocused();
    await expect(canvas(editor)).toHaveAccessibleName('Canvas: Container view: Course Registration');
    await page.keyboard.press('Escape');

    // The badge is a pointer shortcut for Enter, hidden from assistive technology; data-c4-zoom is its documented hook.
    await canvas(editor).locator('[data-c4-zoom="api"]').click();
    await expect(canvas(editor)).toHaveAccessibleName('Canvas: Component view: Registration API');
  });

  test('only elements with children carry a zoom badge', async ({ page }) => {
    const editor = await openEditor(page);
    const shown = C4.project(C4.load(REFERENCE), 'containers of registration').nodes.map((node) => node.id);
    const withChildren = shown.filter((id) => REFERENCE_MODEL.elements.get(id).childIds.length > 0);
    const badges = await canvas(editor).locator('[data-c4-zoom]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-c4-zoom')));
    expect(badges).toEqual(withChildren);
  });

  test('dragging empty canvas pans and Ctrl+wheel magnifies', async ({ page }) => {
    const editor = await openEditor(page, { view: 'components of api' });
    // An empty point of the drawing: inside the drawing, on no element, handle, or badge.
    const start = await canvas(editor).evaluate((region) => {
      const drawing = region.querySelector('svg').getBoundingClientRect();
      const visible = region.getBoundingClientRect();
      for (let y = visible.top + 40; y < Math.min(drawing.bottom, visible.bottom) - 10; y += 15) {
        for (let x = visible.left + 140; x < Math.min(drawing.right, visible.right) - 10; x += 15) {
          const hit = document.elementFromPoint(x, y);
          if (hit && hit.closest('svg') && !hit.closest('[role="option"], [data-c4-handle], [data-c4-zoom]')) return { x, y };
        }
      }
      return null;
    });
    expect(start, 'the drawing has empty space to drag').not.toBeNull();
    const scroll = () => canvas(editor).evaluate((region) => ({ left: region.scrollLeft, top: region.scrollTop }));
    const before = await scroll();

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x - 60, start.y - 30, { steps: 4 });
    await page.mouse.up();
    expect(await scroll(), 'dragging left and up shows more of the right and bottom').toEqual({ left: before.left + 60, top: before.top + 30 });

    const readout = editor.getByRole('group', { name: 'Magnification' }).getByRole('status');
    await expect(readout).toHaveText('100%');
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -200);
    await page.keyboard.up('Control');
    await expect.poll(async () => parseInt(await readout.textContent(), 10), 'Ctrl+wheel up magnifies').toBeGreaterThan(100);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, 400);
    await page.keyboard.up('Control');
    await expect.poll(async () => parseInt(await readout.textContent(), 10), 'Ctrl+wheel down reduces').toBeLessThan(100);
  });

  test('a two-finger pinch magnifies the drawing', async ({ page }) => {
    const editor = await openEditor(page, { view: 'components of api' });
    const centre = await canvas(editor).evaluate((region) => {
      const box = region.getBoundingClientRect();
      return { x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2) };
    });
    const readout = editor.getByRole('group', { name: 'Magnification' }).getByRole('status');
    const touch = await page.context().newCDPSession(page);
    const fingers = (spread) => [{ x: centre.x - spread, y: centre.y, id: 1 }, { x: centre.x + spread, y: centre.y, id: 2 }];
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: fingers(30) });
    for (const spread of [40, 50, 60]) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: fingers(spread) });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

    await expect.poll(async () => parseInt(await readout.textContent(), 10), 'spreading two fingers magnifies').toBeGreaterThan(150);
  });
});
