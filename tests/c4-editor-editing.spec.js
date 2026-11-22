// @ts-check
// Editing on the C4 editor's canvas (spec §9.2 "Direct manipulation" and the Interactions table): dragging is the
// default way to move an element, connect two, and add one from the palette; every drag also has a single-pointer
// alternative (WCAG 2.5.7) and a keyboard path; renaming happens in place; Delete and Backspace confirm first; the
// context menu opens by right-click, long press, or keyboard. Every change is one undo step and is announced.
// The page is built with setContent and loads every part from the manifest, with a 96 px sticky header and the site's
// 62.5% root font size. The C4 core, run in Node on the host's text, is the oracle for what the model says.
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
const CONTAINERS = 'containers of registration';
const CONTAINERS_KEY = C4.project(C4.load(REFERENCE), CONTAINERS).key;
const FEATURE = { feature: 'c4-editor' };
// A moved box snaps to a 10-unit grid or aligns with another box within 6 units, so a drop lands within 10 units.
const SNAP_TOLERANCE = 10;
const NAVBAR_PX = 96;

// Tall enough that the whole container view, the palette, and the page header are on screen together: pointer
// gestures need their start and end inside the viewport.
test.use({ viewport: { width: 1400, height: 1200 } });

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>C4 editor editing</title>
<style>
  html { font-size: 62.5%; }
  body { margin: 0; font-size: 20px; }
  header { position: sticky; top: 0; z-index: 10; height: ${NAVBAR_PX}px; background: #ffffff; border-bottom: 1px solid #555555; }
  main { padding: 16px; }
  .after { height: 150vh; }
</style>
</head><body><header><p>Site navigation</p></header><main><h1>C4 editor editing</h1><div id="editor"></div><div class="after"></div></main></body></html>`;

/**
 * Mounts an editor on #editor. The host records every text it hears, and answers `confirm` with the next of
 * `window.confirmAnswers` (true when none is left), recording each request. With `fit`, the toolbar's Fit shows the
 * whole drawing in the canvas, so a pointer gesture can reach every element without scrolling the canvas.
 * `lockedFields` is the host option (spec §11); `without` leaves those manifest files unloaded.
 */
async function openEditor(page, { text = REFERENCE, view = CONTAINERS, profile = 'expert', fit = false, lockedFields = [], without = [] } = {}) {
  await page.setContent(PAGE);
  await page.addStyleTag({ path: STYLESHEET });
  for (const script of SCRIPTS.filter((file) => !without.some((left) => file.endsWith(left)))) await page.addScriptTag({ path: script });
  await page.evaluate(({ modelText, selector, chosenProfile, locks }) => {
    window.hostTexts = [];
    window.confirmRequests = [];
    window.confirmAnswers = [];
    window.editor = window.ArchUMLC4Editor.mount(document.getElementById('editor'), {
      text: modelText, view: selector, profile: chosenProfile, lockedFields: locks,
      host: {
        onTextChange: (changed) => window.hostTexts.push(changed),
        confirm(request) {
          window.confirmRequests.push(request);
          return Promise.resolve(window.confirmAnswers.length > 0 ? window.confirmAnswers.shift() : true);
        },
      },
    });
  }, { modelText: text, selector: view, chosenProfile: profile, locks: lockedFields });
  // The toolbar just below the sticky header, so the drawing below it is in view.
  await page.evaluate((header) => window.scrollTo(0, document.getElementById('editor').getBoundingClientRect().top + window.scrollY - header - 8), NAVBAR_PX);
  const editor = page.locator('#editor');
  if (fit) await button(editor, 'Fit').click();
  return editor;
}

const canvas = (editor) => editor.getByRole('region', { name: /^Canvas/ });
const option = (editor, name) => canvas(editor).getByRole('listbox', { name: 'Elements in this view' }).getByRole('option', { name, exact: true });
const palette = (editor) => editor.getByRole('group', { name: 'Add to the diagram' });
const status = (editor, text) => editor.getByRole('status').filter({ hasText: text });
const renameField = (editor, name) => canvas(editor).getByRole('textbox', { name: `Name of ${name}` });
const button = (editor, name) => editor.getByRole('button', { name, exact: true });

/**
 * Makes Full screen take its overlay path, which turns on at once (the browser's full screen settles asynchronously),
 * so "F did not toggle full screen" is checked against a state that would already show it.
 */
function useOverlayFullScreen(page) {
  return page.evaluate(() => { document.getElementById('editor').requestFullscreen = undefined; });
}

function hostTexts(page) {
  return page.evaluate(() => window.hostTexts);
}

async function currentModel(page) {
  const texts = await hostTexts(page);
  return C4.load(texts.length > 0 ? texts[texts.length - 1] : REFERENCE).model;
}

/** The pinned `[x, y]` of an element in the container view, from the host's latest text; undefined when not pinned. */
async function pinOf(page, elementId) {
  const pins = (await currentModel(page)).layout.get(CONTAINERS_KEY);
  return pins ? pins.get(elementId) : undefined;
}

/** The drawn top-left corner of an element's box in layout coordinates (its group's translation). */
function drawnCorner(editor, elementId) {
  return canvas(editor).locator(`[data-layout-id="${elementId}"]`).evaluate((node) => {
    const { e, f } = node.transform.baseVal.consolidate().matrix;
    return { x: e, y: f };
  });
}

/** The drawn top-left corners of every element of the view, by id, in layout coordinates. */
function drawnCorners(editor) {
  return canvas(editor).locator('[data-layout-id]').evaluateAll((nodes) => Object.fromEntries(nodes.map((node) => {
    const { e, f } = node.transform.baseVal.consolidate().matrix;
    return [node.getAttribute('data-layout-id'), { x: e, y: f }];
  })));
}

/**
 * Checks what the reader sees after a move (spec §9.2): `movedId` is drawn at its pin, and every other element is
 * drawn where it was before the move, so the move shows relative to its neighbours.
 */
async function expectMovedAlone(editor, page, movedId, before) {
  const pin = await pinOf(page, movedId);
  await expect.poll(() => drawnCorner(editor, movedId), `${movedId} is drawn at its pin`).toEqual({ x: pin[0], y: pin[1] });
  const after = await drawnCorners(editor);
  const others = Object.keys(before).filter((id) => id !== movedId);
  expect(others.length, 'the check covers the other elements').toBeGreaterThanOrEqual(3);
  others.forEach((id) => expect(after[id], `${id} stays where it was drawn`).toEqual(before[id]));
}

/** A client point in the layout coordinates of the view (the frame of pins), with the size of `elementId`'s box. */
function layoutOfClient(editor, point, elementId = 'api') {
  return canvas(editor).locator(`[data-layout-id="${elementId}"]`).evaluate((node, client) => {
    const layout = new DOMPoint(client.x, client.y).matrixTransform(node.parentNode.getScreenCTM().inverse());
    const size = node.getBBox();
    return { x: layout.x, y: layout.y, width: size.width, height: size.height };
  }, point);
}

/** CSS px per drawing unit at the current magnification. */
function drawingScale(editor) {
  return canvas(editor).locator('svg').first().evaluate((svg) => svg.getBoundingClientRect().width / svg.viewBox.baseVal.width);
}

async function centreOf(locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Presses at `from`, moves to `to` in steps (so the drag passes its threshold), and releases unless `release` is false. */
async function dragBetween(page, from, to, { release = true } = {}) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  if (release) await page.mouse.up();
}

/** An empty spot of the drawing: below every element box and boundary, inside the drawing and the canvas region. */
async function emptySpotOnDrawing(editor) {
  return canvas(editor).evaluate((region) => {
    const svg = region.querySelector('svg');
    const drawing = svg.getBoundingClientRect();
    const visible = region.getBoundingClientRect();
    const occupied = [...svg.querySelectorAll('[data-layout-id], [data-c4-boundary]')].map((node) => node.getBoundingClientRect());
    const left = Math.max(drawing.left, visible.left);
    const right = Math.min(drawing.right, visible.right);
    const bottom = Math.min(drawing.bottom, visible.bottom);
    for (let y = bottom - 20; y > drawing.top; y -= 10) {
      for (let x = left + 60; x < right - 60; x += 20) {
        const free = occupied.every((box) => x < box.left - 60 || x > box.right + 60 || y < box.top - 40 || y > box.bottom + 40);
        if (free) return { x, y };
      }
    }
    return null;
  });
}

test.describe('C4 editor canvas editing: moving elements', () => {
  test('dragging an element moves it, pins its position, and is one undo step', async ({ page }) => {
    const editor = await openEditor(page, { fit: true });
    const before = await drawnCorner(editor, 'api');
    const drawnBefore = await drawnCorners(editor);
    const scale = await drawingScale(editor);
    const from = await centreOf(option(editor, 'Registration API'));
    const delta = { x: 120, y: 60 };

    await dragBetween(page, from, { x: from.x + delta.x, y: from.y + delta.y });

    await expect.poll(() => hostTexts(page).then((texts) => texts.length), 'the drag is one change').toBe(1);
    const pin = await pinOf(page, 'api');
    expect(pin, 'the moved element is pinned in the container view').toBeDefined();
    expect(Math.abs(pin[0] - (before.x + delta.x / scale))).toBeLessThanOrEqual(SNAP_TOLERANCE);
    expect(Math.abs(pin[1] - (before.y + delta.y / scale))).toBeLessThanOrEqual(SNAP_TOLERANCE);
    await expect(status(editor, 'Moved Registration API')).toContainText('position pinned');
    await expectMovedAlone(editor, page, 'api', drawnBefore);

    await button(editor, 'Undo').click();
    await expect.poll(() => hostTexts(page).then((texts) => texts[texts.length - 1]), 'one undo restores the text').toBe(REFERENCE);
  });

  test('a box dragged near another\'s edge aligns with it and shows a guide', async ({ page }) => {
    const editor = await openEditor(page, { fit: true });
    const web = await drawnCorner(editor, 'web');
    const scale = await drawingScale(editor);
    const from = await centreOf(option(editor, 'Registration API'));
    const api = await drawnCorner(editor, 'api');
    // Down by a step, and sideways by 3 drawing units off Planner Web App's left edge.
    const sideways = (web.x + 3 - api.x) * scale;

    await dragBetween(page, from, { x: from.x + sideways, y: from.y + 60 }, { release: false });
    // The guide is drawn feedback only (hidden from assistive technology); its class is the stylesheet's hook.
    await expect(canvas(editor).locator('.c4-editor__align-guide').first()).toBeAttached();
    await page.mouse.up();

    await expect.poll(async () => (await pinOf(page, 'api') || [])[0], 'the box takes the edge, not the 10-unit grid').toBe(web.x);
  });

  test('Shift keeps a drag on one axis', async ({ page }) => {
    const editor = await openEditor(page, { fit: true });
    const before = await drawnCorner(editor, 'api');
    const from = await centreOf(option(editor, 'Registration API'));

    await page.keyboard.down('Shift');
    await dragBetween(page, from, { x: from.x + 90, y: from.y + 25 });
    await page.keyboard.up('Shift');

    await expect.poll(() => pinOf(page, 'api'), 'a mostly sideways drag keeps its height').toEqual([expect.any(Number), before.y]);
  });

  test('dragging onto an invalid target or pressing Escape mid-drag leaves the text unchanged', async ({ page }) => {
    const editor = await openEditor(page, { fit: true });
    await useOverlayFullScreen(page);
    const from = await centreOf(option(editor, 'Registration API'));

    // Dropped on the page's header, outside the drawing.
    await dragBetween(page, from, { x: from.x, y: 40 });
    await expect(status(editor, 'Move canceled; Registration API stays where it was.')).toHaveCount(1);

    await dragBetween(page, from, { x: from.x + 100, y: from.y + 40 }, { release: false });
    await page.keyboard.press('f');
    await expect(button(editor, 'Full screen'), 'F does not toggle full screen during a drag').toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('Escape');
    await page.mouse.up();

    expect(await hostTexts(page), 'neither drag changed the text').toEqual([]);
    await expect(canvas(editor).locator('.c4-editor__ghost')).toHaveCount(0);
  });

  test('context-menu Move… then a click on the destination moves and pins without dragging', async ({ page }) => {
    const editor = await openEditor(page, { fit: true });
    const spot = await emptySpotOnDrawing(editor);
    expect(spot, 'the drawing has an empty spot').not.toBeNull();
    const wanted = await layoutOfClient(editor, spot);

    await option(editor, 'Registration API').click({ button: 'right' });
    const menu = page.getByRole('menu', { name: 'Actions for Registration API' });
    await menu.getByRole('menuitem', { name: 'Move…' }).click();
    await expect(status(editor, 'Moving Registration API')).toHaveCount(1);
    await page.mouse.click(spot.x, spot.y);

    await expect.poll(() => hostTexts(page).then((texts) => texts.length)).toBe(1);
    const pin = await pinOf(page, 'api');
    expect(pin, 'Move… pins the element').toBeDefined();
    // Centred on the clicked point, up to the grid snap.
    expect(Math.abs(pin[0] + wanted.width / 2 - wanted.x)).toBeLessThanOrEqual(SNAP_TOLERANCE);
    expect(Math.abs(pin[1] + wanted.height / 2 - wanted.y)).toBeLessThanOrEqual(SNAP_TOLERANCE);
  });

  test('M then arrows then Enter pins the element and announces its position', async ({ page }) => {
    const editor = await openEditor(page);
    const before = await drawnCorner(editor, 'api');
    const drawnBefore = await drawnCorners(editor);
    await option(editor, 'Registration API').focus();

    await page.keyboard.press('m');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Shift+ArrowUp');
    await page.keyboard.press('Enter');

    await expect.poll(() => pinOf(page, 'api')).toEqual([before.x + 20, before.y - 50]);
    await expect(status(editor, `Moved Registration API to ${before.x + 20}, ${before.y - 50}; position pinned.`)).toHaveCount(1);
    await expectMovedAlone(editor, page, 'api', drawnBefore);
    await expect(option(editor, 'Registration API')).toBeFocused();
  });

  /** Presses `positiveKey` `count` times, or `negativeKey` -`count` times (Move steps of 10 units). */
  async function pressSteps(page, count, positiveKey, negativeKey) {
    for (let step = 0; step < Math.abs(count); step++) await page.keyboard.press(count > 0 ? positiveKey : negativeKey);
  }

  /** The drawn box of an element in layout coordinates: its group's translation and its drawn height. */
  function drawnBox(editor, elementId) {
    return canvas(editor).locator(`[data-layout-id="${elementId}"]`).evaluate((node) => {
      const { e, f } = node.transform.baseVal.consolidate().matrix;
      return { x: e, y: f, height: node.getBBox().height };
    });
  }

  /** M, arrow keys to `moverId`'s corner plus `offset` of `ontoId`'s box, Enter; returns the pin the move asks for. */
  async function moveOnto(page, editor, moverId, ontoId, offset) {
    const mover = await drawnBox(editor, moverId);
    const onto = await drawnBox(editor, ontoId);
    const right = Math.round((onto.x + offset.x - mover.x) / 10);
    const down = Math.round((onto.y + offset.y(onto) - mover.y) / 10);
    await option(editor, NAMES.get(moverId)).focus();
    await page.keyboard.press('m');
    await pressSteps(page, right, 'ArrowRight', 'ArrowLeft');
    await pressSteps(page, down, 'ArrowDown', 'ArrowUp');
    await page.keyboard.press('Enter');
    return [mover.x + right * 10, mover.y + down * 10];
  }

  const NAMES = new Map([...C4.load(REFERENCE).model.elements.values()].map((element) => [element.id, element.name]));
  const LOWER_HALF = { x: 40, y: (box) => box.height / 2 };

  test('a drop onto another element lands where it was dropped, and the announcement names what made room', async ({ page }) => {
    const editor = await openEditor(page);
    const before = await drawnCorners(editor);
    const pin = await moveOnto(page, editor, 'db', 'api', LOWER_HALF);

    await expect.poll(() => pinOf(page, 'db')).toEqual(pin);
    await expect.poll(() => drawnCorner(editor, 'db'), 'the dropped element is drawn where it was dropped').toEqual({ x: pin[0], y: pin[1] });
    const api = await drawnBox(editor, 'api');
    expect(api.y + api.height, 'the Registration API makes room above it').toBeLessThanOrEqual(pin[1]);
    const after = await drawnCorners(editor);
    const moved = Object.keys(before).filter((id) => id !== 'db' && (after[id].x !== before[id].x || after[id].y !== before[id].y))
      .map((id) => NAMES.get(id));
    expect(moved).toContain('Registration API');
    expect(moved.length, 'a short list of what made room').toBeLessThanOrEqual(2);
    await expect(status(editor, `Moved Registration Database to ${pin[0]}, ${pin[1]}; position pinned. ${moved.join(' and ')} moved to make room.`))
      .toHaveCount(1);
  });

  test('a drop onto another pinned element is nudged clear of it, and the announcement says where it is drawn', async ({ page }) => {
    const editor = await openEditor(page);
    await option(editor, 'Registration API').focus();
    await page.keyboard.press('m');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect.poll(() => hostTexts(page).then((texts) => texts.length), 'the Registration API is pinned').toBe(1);

    const pin = await moveOnto(page, editor, 'db', 'api', LOWER_HALF);
    await expect.poll(() => pinOf(page, 'db')).toEqual(pin);
    const api = await drawnBox(editor, 'api');
    await expect.poll(() => drawnCorner(editor, 'db'), 'the later pin gives way below the pinned Registration API')
      .toEqual({ x: pin[0], y: api.y + api.height + 20 });
    await expect(status(editor, `Moved Registration Database to ${pin[0]}, ${pin[1]}: it is drawn at ${pin[0]}, ${api.y + api.height + 20}, `
      + 'nudged down so it does not overlap another pinned element; position pinned.')).toHaveCount(1);
  });

  test('during a Move, F does not toggle full screen and Escape cancels without a change', async ({ page }) => {
    const editor = await openEditor(page);
    await useOverlayFullScreen(page);
    await option(editor, 'Registration API').focus();

    await page.keyboard.press('m');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('f');
    await expect(button(editor, 'Full screen')).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('Escape');

    await expect(status(editor, 'Move canceled; Registration API stays where it was.')).toHaveCount(1);
    await expect(option(editor, 'Registration API'), 'the first Escape ends the Move, not the selection').toHaveAttribute('aria-selected', 'true');
    expect(await hostTexts(page)).toEqual([]);
  });
});

test.describe('C4 editor canvas editing: adding elements from the palette', () => {
  test('dragging a Container tile onto the canvas places a pinned container where it was dropped', async ({ page }) => {
    const editor = await openEditor(page, { fit: true });
    const spot = await emptySpotOnDrawing(editor);
    expect(spot, 'the drawing has an empty spot').not.toBeNull();
    const dropped = await layoutOfClient(editor, spot);

    await dragBetween(page, await centreOf(palette(editor).getByRole('button', { name: 'Container' })), spot);

    await expect(renameField(editor, 'New container')).toBeFocused();
    expect((await hostTexts(page)).length, 'adding and pinning is one change; the release clicks nothing').toBe(1);
    const model = await currentModel(page);
    const added = [...model.elements.values()].filter((element) => element.name === 'New container');
    expect(added.map((element) => element.parentId)).toEqual(['registration']);
    const pin = await pinOf(page, added[0].id);
    expect(pin, 'the new container is pinned').toBeDefined();
    const size = await canvas(editor).locator(`[data-layout-id="${added[0].id}"]`).evaluate((node) => {
      const box = node.getBBox();
      return { width: box.width, height: box.height };
    });
    expect(dropped.x, 'the drop point lies on the new box').toBeGreaterThanOrEqual(pin[0]);
    expect(dropped.x).toBeLessThanOrEqual(pin[0] + size.width);
    expect(dropped.y).toBeGreaterThanOrEqual(pin[1]);
    expect(dropped.y).toBeLessThanOrEqual(pin[1] + size.height);
    await expect(renameField(editor, 'New container')).toBeFocused();
  });

  test('clicking a palette tile adds an element at an automatic position with its name ready for editing', async ({ page }) => {
    const editor = await openEditor(page);

    await palette(editor).getByRole('button', { name: 'Container' }).click();

    await expect.poll(() => hostTexts(page).then((texts) => texts.length), 'a click adds exactly one element').toBe(1);
    const added = [...(await currentModel(page)).elements.values()].find((element) => element.name === 'New container');
    expect(added.parentId).toBe('registration');
    expect(await pinOf(page, added.id), 'a clicked tile places the element automatically').toBeUndefined();
    const field = renameField(editor, 'New container');
    await expect(field).toBeFocused();
    await expect(field).toHaveValue('New container');
    await a11yCheckpoint(page, 'c4-editor-canvas-rename', Object.assign({ include: '#editor' }, FEATURE));

    await page.keyboard.type('Audit Log');
    await page.keyboard.press('Enter');
    // The first name also gives the element its id (spec §4.10 as amended by final review I6).
    await expect.poll(async () => (await currentModel(page)).elements.get('audit-log')?.name, 'the id follows the first name').toBe('Audit Log');
    expect((await currentModel(page)).elements.has(added.id), 'the placeholder id is gone').toBe(false);
    await expect(option(editor, 'Audit Log')).toBeFocused();
    expect((await hostTexts(page)).length, 'naming is one change').toBe(2);

    // Once it has a name, the element keeps its id like every other element.
    await page.keyboard.press('F2');
    await page.keyboard.type('Audit Trail');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await currentModel(page)).elements.get('audit-log')?.name).toBe('Audit Trail');
  });

  test('a locked layout keeps a placeholder\'s id when it is first named, and the name still changes', async ({ page }) => {
    // The placeholder's pin sits under a locked path, so giving it a new id would change a locked part.
    const placeholder = REFERENCE.replace('      db:\n', '      new-container:\n        name: New container\n      db:\n')
      + `layout:\n  ${CONTAINERS_KEY}:\n    new-container: [900, 120]\n`;
    const editor = await openEditor(page, { text: placeholder, lockedFields: ['layout'] });
    await option(editor, 'New container').focus();
    await page.keyboard.press('F2');
    await page.keyboard.type('Seat Cache');
    await page.keyboard.press('Enter');

    await expect.poll(async () => (await currentModel(page)).elements.get('new-container')?.name).toBe('Seat Cache');
    await expect(status(editor, 'Renamed New container to Seat Cache.')).toHaveCount(1);
  });

  test('a container dropped from the palette takes its id from its first name, and its position follows', async ({ page }) => {
    const editor = await openEditor(page, { fit: true });
    const spot = await emptySpotOnDrawing(editor);
    expect(spot, 'the drawing has an empty spot').not.toBeNull();
    await dragBetween(page, await centreOf(palette(editor).getByRole('button', { name: 'Container' })), spot);
    const placeholderId = [...(await currentModel(page)).elements.values()].find((element) => element.name === 'New container').id;
    const pin = await pinOf(page, placeholderId);

    // The field opens with its placeholder name selected, so typing replaces it.
    await expect(renameField(editor, 'New container')).toBeFocused();
    await page.keyboard.type('Seat Cache');
    await page.keyboard.press('Enter');

    await expect.poll(async () => (await currentModel(page)).elements.get('seat-cache')?.parentId).toBe('registration');
    expect(await pinOf(page, 'seat-cache'), 'the pin moves to the new id').toEqual(pin);
    expect(await pinOf(page, placeholderId), 'no pin is left under the placeholder id').toBeUndefined();
    await expect(option(editor, 'Seat Cache')).toBeFocused();
    await expect(status(editor, 'Renamed New container to Seat Cache; its id is now seat-cache.')).toHaveCount(1);
  });

  test('a palette add during Add relationship ends the mode and says so', async ({ page }) => {
    const editor = await openEditor(page);
    await option(editor, 'Registration API').focus();
    await page.keyboard.press('c');
    await expect(status(editor, 'Adding a relationship from Registration API')).toHaveCount(1);

    await palette(editor).getByRole('button', { name: 'Container' }).click();

    await expect(status(editor, /^No relationship added\. Added New container inside Course Registration\.$/)).toHaveCount(1);
    await expect(canvas(editor).locator('.is-drop-target'), 'no element is still marked as a target').toHaveCount(0);
    await expect(renameField(editor, 'New container')).toBeFocused();
    await page.keyboard.press('Enter');
    await option(editor, 'Registration Database').focus();
    await page.keyboard.press('Enter');

    await expect(page.getByRole('dialog', { name: 'Add relationship' }), 'Enter no longer picks a target').toHaveCount(0);
    expect((await hostTexts(page)).length, 'only the add changed the text').toBe(1);
  });

  test('a palette drop during a Move ends the Move without moving the element', async ({ page }) => {
    const editor = await openEditor(page, { fit: true });
    await option(editor, 'Registration API').focus();
    await page.keyboard.press('m');
    const spot = await emptySpotOnDrawing(editor);
    expect(spot, 'the drawing has an empty spot').not.toBeNull();

    await dragBetween(page, await centreOf(palette(editor).getByRole('button', { name: 'Container' })), spot);

    await expect(renameField(editor, 'New container')).toBeFocused();
    // The new container lies below the drawing, so its boundary grows down to hold it and may push the element below
    // the boundary further down; the announcement then names that element too.
    await expect(status(editor, /^Move canceled; Registration API stays where it was\. Added New container inside Course Registration; position pinned\.( [^.]+ moved to make room\.)?$/))
      .toHaveCount(1);
    expect(await pinOf(page, 'api'), 'the element in Move stays unpinned').toBeUndefined();
    expect((await hostTexts(page)).length, 'only the add changed the text').toBe(1);
  });

  test('a press on a tile without moving adds nothing until the click', async ({ page }) => {
    const editor = await openEditor(page);
    const tile = palette(editor).getByRole('button', { name: 'Container' });
    const centre = await centreOf(tile);

    await page.mouse.move(centre.x, centre.y);
    await page.mouse.down();
    expect(await hostTexts(page), 'a press alone adds nothing (WCAG 2.5.2)').toEqual([]);
    await page.mouse.up();
    await expect.poll(() => hostTexts(page).then((texts) => texts.length)).toBe(1);
  });

  test('A opens the Add menu from the drawing at full width', async ({ page }) => {
    const editor = await openEditor(page);
    await option(editor, 'Registration API').focus();

    await page.keyboard.press('a');
    const menu = page.getByRole('menu', { name: 'Add' });
    await expect(menu.getByRole('menuitem')).toHaveText(['Container']);
    await page.keyboard.press('Enter');

    await expect(renameField(editor, 'New container')).toBeFocused();
    expect((await hostTexts(page)).length).toBe(1);
  });

  test('the palette in a component view offers Component only for novices', async ({ page }) => {
    const novice = await openEditor(page, { view: 'components of api', profile: 'novice' });
    await expect(palette(novice).getByRole('button')).toHaveText(['Component']);
    await expect(button(novice, 'All types')).toHaveCount(0);

    const expert = await openEditor(page, { view: 'components of api', profile: 'expert' });
    await button(expert, 'All types').click();
    await expect(palette(expert).getByRole('button')).toHaveText(['Component', 'Person', 'Software system', 'Container', 'Code element']);
  });
});

test.describe('C4 editor canvas editing: relationships', () => {
  /** Fills the anchored form and confirms it with Enter. */
  async function describeRelationship(page, dialog) {
    await expect(dialog.getByText('Reads as:')).toBeVisible();
    await dialog.getByLabel('Description').fill('reads course data from');
    await expect(dialog.getByText('Planner Web App reads course data from Registration Database')).toBeVisible();
    await dialog.getByLabel('Technology').fill('SQL/TCP');
    await dialog.getByLabel('Description').press('Enter');
  }

  /** The relationships from Planner Web App to Registration Database in the host's latest text. */
  async function webToDatabase(page) {
    return (await currentModel(page)).relationships
      .filter((relationship) => relationship.sourceId === 'web' && relationship.targetId === 'db')
      .map((relationship) => ({ description: relationship.description, technology: relationship.technology }));
  }

  test('dragging from a connect handle onto a target opens the relationship form with the sentence preview and writes a collaborator', async ({ page }) => {
    const editor = await openEditor(page, { fit: true });
    await option(editor, 'Planner Web App').click();
    // The handle is pointer-only and hidden from assistive technology; data-c4-handle is its documented hook.
    const handle = canvas(editor).locator('[data-c4-handle="web"]');
    await expect(handle).toBeVisible();

    await dragBetween(page, await centreOf(handle), await centreOf(option(editor, 'Registration Database')), { release: false });
    await expect(option(editor, 'Registration Database'), 'the valid target under the pointer is marked').toHaveClass(/is-drop-hover/);
    await page.mouse.up();
    await describeRelationship(page, page.getByRole('dialog', { name: 'Add relationship' }));

    await expect.poll(() => webToDatabase(page)).toEqual([{ description: 'reads course data from', technology: 'SQL/TCP' }]);
    expect((await hostTexts(page)).length, 'one change').toBe(1);
  });

  test('click-then-click connect writes the same collaborator without dragging', async ({ page }) => {
    const editor = await openEditor(page, { fit: true });
    await option(editor, 'Planner Web App').click();
    await canvas(editor).locator('[data-c4-handle="web"]').click();
    await expect(status(editor, 'Adding a relationship from Planner Web App')).toHaveCount(1);

    await option(editor, 'Registration Database').click();
    await describeRelationship(page, page.getByRole('dialog', { name: 'Add relationship' }));

    await expect.poll(() => webToDatabase(page)).toEqual([{ description: 'reads course data from', technology: 'SQL/TCP' }]);
  });

  test('C then Enter on the target opens the same form from the keyboard', async ({ page }) => {
    const editor = await openEditor(page);
    await option(editor, 'Planner Web App').focus();

    await page.keyboard.press('c');
    await option(editor, 'Registration Database').focus();
    await page.keyboard.press('Enter');
    await describeRelationship(page, page.getByRole('dialog', { name: 'Add relationship' }));

    await expect.poll(() => webToDatabase(page)).toEqual([{ description: 'reads course data from', technology: 'SQL/TCP' }]);
    await expect(option(editor, 'Planner Web App'), 'focus returns to the source').toBeFocused();
  });

  test('the toolbar\'s Add relationship starts from the selected element', async ({ page }) => {
    const editor = await openEditor(page, { fit: true });
    await option(editor, 'Planner Web App').click();

    await button(editor, 'Add relationship').click();
    await expect(status(editor, 'Adding a relationship from Planner Web App')).toHaveCount(1);
    await expect(option(editor, 'Registration Database'), 'valid targets are marked').toHaveClass(/is-drop-target/);
    await option(editor, 'Registration Database').click();
    await describeRelationship(page, page.getByRole('dialog', { name: 'Add relationship' }));

    await expect.poll(() => webToDatabase(page)).toEqual([{ description: 'reads course data from', technology: 'SQL/TCP' }]);
  });

  test('a target that contains the source is refused with its reason, and Escape ends the mode', async ({ page }) => {
    const editor = await openEditor(page);
    await option(editor, 'Planner Web App').focus();

    await page.keyboard.press('c');
    await option(editor, 'Course Registration').focus();
    await page.keyboard.press('Enter');
    await expect(status(editor, 'Error: Course Registration contains Planner Web App')).toHaveCount(1);
    await page.keyboard.press('Escape');

    await expect(status(editor, 'No relationship added.')).toHaveCount(1);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await hostTexts(page)).toEqual([]);
  });
});

test.describe('C4 editor canvas editing: rename, delete, and the context menu', () => {
  test('F2 and clicking the selected name rename in place', async ({ page }) => {
    const editor = await openEditor(page);
    await option(editor, 'Registration API').focus();

    await page.keyboard.press('F2');
    const field = renameField(editor, 'Registration API');
    await expect(field).toBeFocused();
    await field.fill('Enrollment API');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await currentModel(page)).elements.get('api').name).toBe('Enrollment API');
    await expect(option(editor, 'Enrollment API')).toBeFocused();

    // A click on the name of the selected element opens the same field; Escape keeps the name. The name lies under
    // the element's (transparent) option, which is what a pointer presses.
    const name = await centreOf(canvas(editor).locator('[data-layout-id="api"] text').first());
    await page.mouse.click(name.x, name.y);
    await expect(renameField(editor, 'Enrollment API')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(renameField(editor, 'Enrollment API')).toHaveCount(0);
    await expect(option(editor, 'Enrollment API')).toBeFocused();
    expect((await hostTexts(page)).length, 'Escape changed nothing').toBe(1);
  });

  test('Undo and Redo announce the step they take back or repeat, from the toolbar and the keys', async ({ page }) => {
    const editor = await openEditor(page);
    await option(editor, 'Registration API').focus();
    await page.keyboard.press('F2');
    await renameField(editor, 'Registration API').fill('Enrollment API');
    await page.keyboard.press('Enter');
    await expect(option(editor, 'Enrollment API')).toBeFocused();

    await button(editor, 'Undo').click();
    await expect(status(editor, 'Undone: Rename Registration API.')).toHaveCount(1);
    await option(editor, 'Registration API').focus();
    await page.keyboard.press('Control+y');
    await expect(status(editor, 'Redone: Rename Registration API.')).toHaveCount(1);
    await page.keyboard.press('Control+z');
    await expect(status(editor, 'Undone: Rename Registration API.')).toHaveCount(1);
  });

  test('an empty name stays in the field with its reason', async ({ page }) => {
    const editor = await openEditor(page);
    await option(editor, 'Registration API').focus();
    await page.keyboard.press('F2');
    const field = renameField(editor, 'Registration API');
    await field.fill('   ');
    await page.keyboard.press('Enter');

    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(field).toHaveAccessibleDescription(/^Error: A name needs some text/);
    expect(await hostTexts(page)).toEqual([]);
  });

  test('Delete asks for confirmation naming dependent references and removes them', async ({ page }) => {
    const editor = await openEditor(page);
    const dependents = C4.dependentsOf(C4.load(REFERENCE), 'web').map((dependent) => dependent.label);
    expect(dependents.length, 'Planner Web App has references to remove').toBeGreaterThan(0);
    await option(editor, 'Planner Web App').focus();

    await page.keyboard.press('Delete');

    await expect.poll(() => hostTexts(page).then((texts) => texts.length)).toBe(1);
    const [request] = await page.evaluate(() => window.confirmRequests);
    expect(request.title).toBe('Delete Planner Web App?');
    expect(request.details).toEqual(dependents);
    const model = await currentModel(page);
    expect(model.elements.has('web')).toBe(false);
    expect(model.relationships.filter((relationship) => relationship.sourceId === 'web' || relationship.targetId === 'web')).toEqual([]);
    await expect(canvas(editor).getByRole('option', { name: 'Planner Web App', exact: true })).toHaveCount(0);
    await expect(canvas(editor).locator('[role="option"]:focus'), 'focus moves to a neighbouring element').toHaveCount(1);
  });

  test('Backspace also deletes after confirmation, and a declined confirmation keeps the element', async ({ page }) => {
    const editor = await openEditor(page);
    await page.evaluate(() => { window.confirmAnswers = [false, true]; });
    await option(editor, 'Registration Database').focus();

    await page.keyboard.press('Backspace');
    await expect(status(editor, 'Kept Registration Database.')).toHaveCount(1);
    expect(await hostTexts(page)).toEqual([]);

    await option(editor, 'Registration Database').focus();
    await page.keyboard.press('Backspace');
    await expect.poll(async () => (await currentModel(page)).elements.has('db')).toBe(false);
    expect((await page.evaluate(() => window.confirmRequests)).length, 'each Backspace asked first').toBe(2);
  });

  test('Shift+F10 opens the focused element\'s menu and Escape returns focus to it', async ({ page }) => {
    const editor = await openEditor(page);
    await option(editor, 'Registration API').focus();

    await page.keyboard.press('Shift+F10');
    const menu = page.getByRole('menu', { name: 'Actions for Registration API' });
    await expect(menu.getByRole('menuitem')).toHaveText(['Move…', 'Add relationship', 'Move to…', 'Zoom in', 'Change id…', 'Delete']);
    await a11yCheckpoint(page, 'c4-editor-canvas-element-menu', Object.assign({ include: '#editor' }, FEATURE));
    await page.keyboard.press('Escape');

    await expect(menu).toHaveCount(0);
    await expect(option(editor, 'Registration API')).toBeFocused();
  });

  test('the "⋯" button of the selected element opens its menu', async ({ page }) => {
    const editor = await openEditor(page, { fit: true });
    await option(editor, 'Registration API').click();
    // The button is pointer-only and hidden from assistive technology (Shift+F10 is its keyboard path);
    // data-c4-more is its documented hook.
    const more = canvas(editor).locator('[data-c4-more="api"]');
    await expect(more).toBeVisible();

    const centre = await centreOf(more);
    await page.mouse.click(centre.x, centre.y);
    await expect(page.getByRole('menu', { name: 'Actions for Registration API' })).toBeVisible();
    await expect(canvas(editor).locator('[data-c4-more="web"]'), 'other elements show no button').toBeHidden();
  });

  test('touch: a long press opens the context menu', async ({ page }) => {
    const editor = await openEditor(page, { fit: true });
    const centre = await centreOf(option(editor, 'Registration API'));
    const touch = await page.context().newCDPSession(page);

    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: centre.x, y: centre.y, id: 1 }] });
    await expect(page.getByRole('menu', { name: 'Actions for Registration API' }), 'the menu opens while the finger rests').toBeVisible();
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

    const menu = page.getByRole('menu', { name: 'Actions for Registration API' });
    await expect(menu, 'lifting the finger keeps the menu open').toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Move…' }), 'focus is in the menu').toBeFocused();
    expect(await hostTexts(page), 'a long press changes nothing').toEqual([]);
  });
});

test.describe('C4 editor canvas editing: locks (spec §11)', () => {
  test('Delete on an element the task locks names the lock and asks nothing', async ({ page }) => {
    const editor = await openEditor(page, { lockedFields: ['systems.registration.containers.db.name'] });
    await option(editor, 'Registration Database').focus();

    await page.keyboard.press('Delete');

    await expect(status(editor, 'Locked: Registration Database or a part of it is given by the task, so it cannot be deleted here.'),
      'the refusal names the element and the deletion, not the YAML path').toHaveCount(1);
    expect(await page.evaluate(() => window.confirmRequests), 'no confirmation for a refused delete').toEqual([]);
    expect(await hostTexts(page)).toEqual([]);
  });

  test('a rename under a lock is refused by the editor, whichever control sends it', async ({ page }) => {
    const editor = await openEditor(page, { lockedFields: ['systems.registration.containers.api.name'] });
    await option(editor, 'Registration API').focus();
    await page.keyboard.press('F2');
    await renameField(editor, 'Registration API').fill('Enrollment API');
    await page.keyboard.press('Enter');

    await expect(renameField(editor, 'Registration API'))
      .toHaveAccessibleDescription('Locked: Registration API or a part of it is given by the task, so it cannot be renamed here.');
    expect(await hostTexts(page)).toEqual([]);
  });
});

// ---- Help lists the keys the editor answers (spec §9.2) --------------------------------------------------------------
//
// Each row of Help has a probe: the key pressed where Help says it works, and what a learner then notices. Help must
// list exactly the probed keys, so a row for a key nothing handles (or a handled key Help omits) fails the test.

const HELP_PROBES = {
  'Arrow keys': async (page, editor) => {
    await option(editor, 'Planner Web App').focus();
    await page.keyboard.press('ArrowRight');
    await expect(option(editor, 'Planner Web App')).not.toBeFocused();
    await expect(canvas(editor).locator('[role="option"]:focus')).toHaveCount(1);
  },
  'Enter': async (page, editor) => {
    await option(editor, 'Registration API').focus();
    await page.keyboard.press('Enter');
    await expect(canvas(editor)).toHaveAccessibleName(/^Canvas: Component view/);
  },
  'Alt+↑ (Option+↑ on a Mac)': async (page, editor) => {
    await page.keyboard.press('Alt+ArrowUp');
    await expect(canvas(editor)).toHaveAccessibleName(/^Canvas: Container view/);
  },
  'F2': async (page, editor) => {
    await option(editor, 'Registration API').focus();
    await page.keyboard.press('F2');
    await expect(renameField(editor, 'Registration API')).toBeFocused();
    await page.keyboard.press('Escape');
  },
  'Delete or Backspace': async (page, editor) => {
    await page.evaluate(() => { window.confirmAnswers = [false]; });
    await option(editor, 'Registration Database').focus();
    await page.keyboard.press('Delete');
    await expect(status(editor, 'Kept Registration Database.')).toHaveCount(1);
  },
  'M': async (page, editor) => {
    await option(editor, 'Registration API').focus();
    await page.keyboard.press('m');
    await expect(status(editor, /^Moving Registration API:/)).toHaveCount(1);
    await page.keyboard.press('Escape');
  },
  'C': async (page, editor) => {
    await option(editor, 'Registration API').focus();
    await page.keyboard.press('c');
    await expect(status(editor, 'Adding a relationship from Registration API')).toHaveCount(1);
    await page.keyboard.press('Escape');
  },
  'Shift+F10 or the Menu key': async (page, editor) => {
    await option(editor, 'Registration API').focus();
    await page.keyboard.press('Shift+F10');
    await expect(page.getByRole('menu', { name: 'Actions for Registration API' })).toBeVisible();
    await page.keyboard.press('Escape');
  },
  'A': async (page, editor) => {
    await canvas(editor).focus();
    await page.keyboard.press('a');
    await expect(page.getByRole('menu', { name: 'Add' })).toBeVisible();
    await page.keyboard.press('Escape');
  },
  'F': async (page, editor) => {
    await useOverlayFullScreen(page);
    await canvas(editor).focus();
    await page.keyboard.press('f');
    await expect(button(editor, 'Full screen')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('f');
    await expect(button(editor, 'Full screen')).toHaveAttribute('aria-pressed', 'false');
  },
  'Ctrl+= and Ctrl+− (Cmd on a Mac)': async (page, editor) => {
    const readout = editor.getByRole('group', { name: 'Magnification' }).getByRole('status');
    await canvas(editor).focus();
    await page.keyboard.press('Control+=');
    await expect(readout).toHaveText('110%');
    await page.keyboard.press('Control+-');
    await expect(readout).toHaveText('100%');
  },
  'Ctrl+0 (Cmd+0 on a Mac)': async (page, editor) => {
    const readout = editor.getByRole('group', { name: 'Magnification' }).getByRole('status');
    await canvas(editor).focus();
    await page.keyboard.press('Control+=');
    await expect(readout).toHaveText('110%');
    await page.keyboard.press('Control+0');
    await expect(readout).toHaveText('100%');
  },
  'Ctrl+Z and Ctrl+Y (Cmd+Z and Cmd+Shift+Z on a Mac)': async (page, editor) => {
    const changed = REFERENCE.replace('technology: PostgreSQL 16', 'technology: PostgreSQL 17');
    await page.evaluate((text) => window.editor.setText(text), changed);
    await canvas(editor).focus();
    await page.keyboard.press('Control+z');
    await expect.poll(async () => (await hostTexts(page)).at(-1)).toBe(REFERENCE);
    await page.keyboard.press('Control+y');
    await expect.poll(async () => (await hostTexts(page)).at(-1)).toBe(changed);
  },
  'Escape': async (page, editor) => {
    await option(editor, 'Registration API').focus();
    await expect(editor.getByRole('region', { name: 'Inspector', exact: true })).toContainText('Registration API');
    await page.keyboard.press('Escape');
    await expect(editor.getByRole('region', { name: 'Inspector', exact: true })).toContainText('Select an element');
  },
  'Shift+?': async (page, editor) => {
    await canvas(editor).focus();
    await page.keyboard.press('Shift+?');
    await expect(page.getByRole('dialog', { name: 'C4 editor help' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(canvas(editor), 'closing Help returns focus to where it was opened').toBeFocused();
  },
};

/**
 * The keys Help lists, in order. A dialog hands focus back in its close event, which the browser queues after the
 * Escape, so the helper waits for focus to be back on the canvas before the caller focuses anything else.
 */
async function helpKeys(page, editor) {
  await canvas(editor).focus();
  await page.keyboard.press('Shift+?');
  const help = page.getByRole('dialog', { name: 'C4 editor help' });
  await expect(help).toBeVisible();
  const keys = await help.getByRole('term').allTextContents();
  await page.keyboard.press('Escape');
  await expect(help).toHaveCount(0);
  await expect(canvas(editor), 'closing Help returns focus to the canvas').toBeFocused();
  return keys;
}

test.describe('C4 editor canvas editing: Help', () => {
  test('Help lists only keys the editor answers, and each one acts where Help says', async ({ page }) => {
    const editor = await openEditor(page);
    const listed = await helpKeys(page, editor);

    expect(listed, 'Help lists exactly the keys that have a probe').toEqual(Object.keys(HELP_PROBES));
    for (const key of listed) {
      await test.step(`${key} acts`, () => HELP_PROBES[key](page, editor));
    }
  });

  test('without the canvas editing part, Help leaves out its keys', async ({ page }) => {
    const editor = await openEditor(page, { without: ['c4/editor/c4-editor-canvas-editing.js'] });
    const listed = await helpKeys(page, editor);

    for (const key of ['F2', 'Delete or Backspace', 'M', 'C', 'Shift+F10 or the Menu key']) {
      expect(listed, `Help does not list ${key}`).not.toContain(key);
    }
    expect(listed).toContain('Arrow keys');
  });
});

test.describe('C4 editor canvas editing: the carry-down tray', () => {
  const HOLDS = 'DO hold a seat in every section of a plan, or in none';
  const toggle = (editor) => canvas(editor).getByRole('button', { name: 'Responsibilities to refine' });
  const trayItem = (editor, text) => canvas(editor).getByRole('list', { name: 'Responsibilities to refine' })
    .getByRole('listitem').filter({ hasText: text });
  const refineButton = (editor, text) => trayItem(editor, text).getByRole('button', { name: /^Refine into…/ });
  // The scope's parts in the container view: the drop targets the open tray lies over.
  const SCOPE_PARTS = [...C4.load(REFERENCE).model.elements.values()]
    .filter((element) => element.parentId === 'registration').map((element) => element.name);

  /** True when the topmost thing painted at the centre of `locator` is the element itself (nothing covers it). */
  function isUncoveredAtCentre(locator) {
    return locator.evaluate((node) => {
      const box = node.getBoundingClientRect();
      const hit = node.ownerDocument.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return hit !== null && node.contains(hit);
    });
  }

  /**
   * The toggle against the scope boundary, both read in one evaluate: how far the toggle's bottom is from the
   * boundary's top edge, the toggle's left, and the boundary's top and horizontal span, in client px.
   */
  function toggleOnBoundary(editor, scopeId) {
    return toggle(editor).evaluate((node, id) => {
      const group = node.ownerDocument.querySelector(`[data-c4-boundary="${id}"]`);
      const boundary = (group.querySelector('rect') || group).getBoundingClientRect();
      const box = node.getBoundingClientRect();
      return { gap: Math.abs(box.bottom - boundary.top), x: box.left, top: boundary.top, left: boundary.left, right: boundary.right };
    }, scopeId);
  }

  test('the tray toggle sits on the top edge of the scope boundary and comes before the elements in focus order', async ({ page }) => {
    const editor = await openEditor(page, { fit: true });
    // The header is laid on the boundary when the stage reports its size (a ResizeObserver), so the test waits for that.
    await expect.poll(async () => (await toggleOnBoundary(editor, 'registration')).gap, 'the toggle rests on the boundary\'s top edge')
      .toBeLessThanOrEqual(2);
    const placed = await toggleOnBoundary(editor, 'registration');
    expect(placed.x).toBeGreaterThanOrEqual(placed.left - 1);
    expect(placed.x).toBeLessThan(placed.right);
    expect(await toggle(editor).evaluate((node, first) => Boolean(node.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING),
      await option(editor, 'Student').elementHandle()), 'Tab reaches the toggle before the elements').toBe(true);

    // It follows the boundary when the magnification changes.
    await button(editor, 'Zoom in').click();
    await expect.poll(async () => {
      const moved = await toggleOnBoundary(editor, 'registration');
      return moved.top !== placed.top && moved.gap <= 2 && Math.abs(moved.x - placed.x - (moved.left - placed.left)) <= 2;
    }, 'the toggle follows the magnified boundary').toBe(true);
  });

  test('dragging a tray item onto a part writes a refining responsibility as one undo step', async ({ page }) => {
    const editor = await openEditor(page, { fit: true });
    await toggle(editor).click();
    const from = await centreOf(trayItem(editor, HOLDS).getByRole('paragraph').filter({ hasText: HOLDS }));

    await dragBetween(page, from, await centreOf(option(editor, 'Registration Database')), { release: false });
    await expect(option(editor, 'Registration Database'), 'the part under the pointer is marked').toHaveClass(/is-drop-hover/);
    await expect(option(editor, 'Planner Web App'), 'every part of the scope is a valid target').toHaveClass(/is-drop-target/);
    await expect(option(editor, 'Student'), 'an element outside the scope is no target').not.toHaveClass(/is-drop-target/);
    await expect(trayItem(editor, HOLDS), 'the open tray steps aside, so no part is hidden under it').toBeHidden();
    await page.mouse.up();

    await expect(status(editor, "Registration Database now refines 'hold a seat in every section of a plan, or in none'.")).toHaveCount(1);
    expect((await hostTexts(page)).length, 'one change').toBe(1);
    const db = (await currentModel(page)).elements.get('db');
    expect(db.responsibilities.at(-1)).toMatchObject({ kind: 'do', text: 'hold a seat in every section of a plan, or in none', refines: ['sys-holds'] });
    await expect(option(editor, 'Registration Database'), 'the part that now refines it is focused, so its copy can be reworded').toBeFocused();
    await expect(toggle(editor), 'the tray closes, so the focused part is not under it').toHaveAttribute('aria-expanded', 'false');
    expect(await isUncoveredAtCentre(option(editor, 'Registration Database')), 'the focused part is visible (WCAG 2.4.11)').toBe(true);

    await page.keyboard.press('Control+z');
    await expect.poll(async () => (await hostTexts(page)).at(-1), 'one undo step takes it back').toBe(REFERENCE);
  });

  test('a tray item dropped outside the scope\'s parts, or Escape mid-drag, refines nothing', async ({ page }) => {
    const editor = await openEditor(page, { fit: true });
    await useOverlayFullScreen(page);
    await toggle(editor).click();
    const from = await centreOf(trayItem(editor, HOLDS).getByRole('paragraph').filter({ hasText: HOLDS }));

    await dragBetween(page, from, await centreOf(option(editor, 'Student')));
    await expect(status(editor, /^No responsibility refined: drop it on a part of Course Registration/)).toHaveCount(1);

    await dragBetween(page, from, await centreOf(option(editor, 'Registration API')), { release: false });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(status(editor, 'No responsibility refined.')).toHaveCount(1);

    expect(await hostTexts(page), 'neither drag changed the text').toEqual([]);
    await expect(toggle(editor), 'the tray stays open after the drags').toHaveAttribute('aria-expanded', 'true');
    await expect(trayItem(editor, HOLDS)).toBeVisible();
  });

  test('a part of the scope that receives focus while the tray is open is not covered by the tray', async ({ page }) => {
    const editor = await openEditor(page, { fit: true });
    expect(SCOPE_PARTS, 'the fixture\'s scope has parts to focus').toEqual(['Planner Web App', 'Registration API', 'Registration Database']);

    for (const part of SCOPE_PARTS) {
      await toggle(editor).click();
      await expect(trayItem(editor, HOLDS)).toBeVisible();
      await option(editor, part).focus();
      await expect(toggle(editor), `focusing ${part} closes the tray`).toHaveAttribute('aria-expanded', 'false');
      expect(await isUncoveredAtCentre(option(editor, part)), `${part} is not hidden under the tray (WCAG 2.4.11)`).toBe(true);
    }
  });

  test('Escape closes an open Refine into… menu first, then the tray, and returns focus to the tray\'s toggle', async ({ page }) => {
    const editor = await openEditor(page, { fit: true });
    await toggle(editor).click();
    await refineButton(editor, HOLDS).focus();
    await page.keyboard.press('ArrowDown');
    await expect(canvas(editor).getByRole('menu')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(canvas(editor).getByRole('menu'), 'the first Escape closes the menu').toHaveCount(0);
    await expect(refineButton(editor, HOLDS)).toBeFocused();
    await expect(toggle(editor), 'the tray is still open').toHaveAttribute('aria-expanded', 'true');

    await page.keyboard.press('Escape');
    await expect(toggle(editor), 'the second Escape closes the tray').toHaveAttribute('aria-expanded', 'false');
    await expect(toggle(editor)).toBeFocused();
    await expect(trayItem(editor, HOLDS)).toBeHidden();
  });

  test('letters in the tray\'s Refine into… menu move between parts and never fire the canvas\'s letter keys', async ({ page }) => {
    const editor = await openEditor(page, { fit: true });
    await useOverlayFullScreen(page);
    await toggle(editor).click();
    await refineButton(editor, HOLDS).focus();
    await page.keyboard.press('ArrowDown');
    const menu = canvas(editor).getByRole('menu');
    await expect(menu.getByRole('menuitem').first()).toBeFocused();

    for (const key of ['f', 'a', 'Shift+?']) await page.keyboard.press(key);
    await expect(button(editor, 'Full screen'), 'F does not toggle full screen').toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('menu', { name: 'Add' }), 'A does not open the Add menu').toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'C4 editor help' }), '? does not open Help').toHaveCount(0);
    await expect(menu, 'the menu stays open').toBeVisible();

    // Type-ahead: R moves to the next part whose name starts with R.
    await menu.getByRole('menuitem', { name: 'Planner Web App' }).focus();
    await page.keyboard.press('r');
    await expect(menu.getByRole('menuitem', { name: 'Registration API' })).toBeFocused();
    await page.keyboard.press('r');
    await expect(menu.getByRole('menuitem', { name: 'Registration Database' })).toBeFocused();
  });
});
