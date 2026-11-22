// @ts-check
// Stage A1 of the UML editor (UML-view editing spec §3.11, §14 D5; plan Task 25c): every move and every bend of a
// line has a path without a drag (WCAG 2.5.7) and a keyboard path (2.1.1). An item's menu (right-click, its "⋯"
// button, or Shift+F10 and the Menu key) offers "Move…", then a click places the item, or the arrow keys move it and
// Enter places it; a line's menu adds, moves, and removes bends. Every drag, the arrow-key nudge of a focused element,
// the menus' existing items, and the tab order stay as they are.
//
// The source field `#uml-pg-input` and the tool status line `#uml-pg-tool-status` are the editor's contract (spec
// §3.7). The source field is hidden on this page, so a text goes in as a script would put it. Player's saved position
// lies off the 10 px grid, so a path that snapped a keyboard step would fail the oracles below.
const fs = require('node:fs');
const { test, expect } = require('@playwright/test');
const { auditInteractiveState } = require('./a11y-helpers');

const EDITOR = '/SEBook/tools/uml-editor';
// The drawing puts its leftmost box at the canvas's padding, so Game, drawn left of Player, keeps Player off the grid.
const PLAYERS = ['@startuml', 'class Player @pos(123, 57)', 'class Game @pos(-300, 57)', 'Player --> Game', '@enduml'].join('\n');
const SERVICES = ['@startuml', 'component Backend {', '  portout "dbOut" as b_dbout', '}', 'component Database {',
  '  portin "dbIn" as db_in', '}', 'b_dbout --> db_in', '@enduml'].join('\n');
const SERVERS = ['@startuml', 'node Server', 'node Client', '@enduml'].join('\n');
const CHAT = ['@startuml', 'participant Alice', 'participant Bob', 'Alice -> Bob : hello', '@enduml'].join('\n');
const MOVING_PLAYER = 'Moving Player: click where it should go, or use the arrow keys and press Enter. Escape cancels.';
const PLAYER_STAYS = 'Move cancelled; Player stays where it was.';
const DRAWING_CHANGED = 'The drawing changed, so the move was cancelled.';

test.skip(({ browserName }) => browserName !== 'chromium', 'the UML editor suites run in Chromium');

const sourceOf = (page) => page.getByLabel('ArchUML diagram source', { exact: true });
const toolStatus = (page) => page.locator('#uml-pg-tool-status');
const element = (page, name) => page.getByRole('button', { name: new RegExp(`^Element ${name} — `) });
const segmentOf = (page) => page.getByRole('button', { name: /^Relation segment \d+ of / }).first();
const actionsFor = (page, label) => page.getByRole('button', { name: `Actions for ${label}`, exact: true });
const menuOf = (page) => page.getByRole('menu');

/** The editor with `text` drawn as a diagram of `type`, in visual edit mode. */
async function openWith(page, type, text) {
  await page.goto(EDITOR);
  await expect(page.getByRole('region', { name: 'Visual editor palette', exact: true })).toBeVisible();
  await page.getByLabel('Diagram type:').selectOption(type);
  await putSource(page, text);
  await expect(page.locator('#uml-pg-output svg .uml-pg-edit-layer')).toHaveCount(1);
  // The pointer below works in the viewport's coordinates.
  await page.locator('#uml-pg-output svg').scrollIntoViewIfNeeded();
}

/** A press of the pointer at the centre of `locator`, as a hand's press goes to the point (a drawn hit box lies over
 * an element's keyboard target). */
async function clickAt(page, locator, options = {}) {
  await locator.scrollIntoViewIfNeeded();
  const { x, y } = await centreOf(locator);
  if (options.modifiers) for (const key of options.modifiers) await page.keyboard.down(key);
  await page.mouse.click(x, y, { button: options.button || 'left' });
  if (options.modifiers) for (const key of options.modifiers) await page.keyboard.up(key);
}

/** Puts `text` into the source field as a script would, which draws it after the render debounce. */
async function putSource(page, text) {
  await sourceOf(page).evaluate((textarea, value) => {
    textarea.value = value;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
}

async function centreOf(locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('the locator has no box on the page');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** The centre of `name`'s drawn box, moved by `by`, in drawing units. */
async function drawnCentreOf(page, name, by = { x: 0, y: 0 }) {
  return page.locator(`.uml-pg-edit-hitbox[data-layout-id="${name}"]`).evaluate((rect, step) => ({
    x: Number(rect.getAttribute('x')) + Number(rect.getAttribute('width')) / 2 + step.x,
    y: Number(rect.getAttribute('y')) + Number(rect.getAttribute('height')) / 2 + step.y,
  }), by);
}

/** Where the drawing point `point` is on the page now, as the editor maps a pointer to the drawing. */
async function pageOfDrawingPoint(page, point) {
  return page.locator('#uml-pg-output svg').evaluate((svg, at) => {
    const rect = svg.getBoundingClientRect();
    const box = svg.viewBox.baseVal;
    return { x: rect.left + ((at.x - box.x) / box.width) * rect.width, y: rect.top + ((at.y - box.y) / box.height) * rect.height };
  }, point);
}

/** Opens the menu of the focused diagram item `item` with `key`; returns the menu. */
async function openMenuWithKey(page, item, key = 'Shift+F10') {
  await item.focus();
  await page.keyboard.press(key);
  await expect(menuOf(page)).toHaveCount(1);
  return menuOf(page);
}

/** Starts "Move…" of `item` from its menu, opened with the keys. */
async function startMove(page, item) {
  const menu = await openMenuWithKey(page, item);
  await menu.getByRole('menuitem', { name: 'Move…', exact: true }).click();
}

/** The saved position `@pos(x, y)` of `name` in `text`. */
function savedPosition(text, name) {
  const match = text.match(new RegExp(`class ${name} @pos\\((-?[\\d.]+), (-?[\\d.]+)\\)`));
  if (!match) throw new Error(`${name} has no saved position in:\n${text}`);
  return { x: Number(match[1]), y: Number(match[2]) };
}

/** The labels of a menu's items, in order. */
async function itemLabels(menu) {
  return menu.getByRole('menuitem').evaluateAll((items) => items.map((item) => item.childNodes[0].textContent));
}

/** The middle of the longest segment of the selected line, in page coordinates. Lines are drawn across and down, so
 * a segment's middle is the centre of its box. */
async function middleOfLongestSegment(page) {
  return page.locator('.uml-pg-edge-hitbox.is-selected').evaluateAll((lines) => {
    const boxes = lines.map((line) => line.getBoundingClientRect());
    boxes.sort((p, q) => Math.max(q.width, q.height) - Math.max(p.width, p.height));
    return { x: boxes[0].x + boxes[0].width / 2, y: boxes[0].y + boxes[0].height / 2 };
  });
}

/** The centres of the bend numbers on the drawing, in page coordinates, with their text. */
async function bendNumbers(page) {
  return page.locator('.uml-pg-bend-number').evaluateAll((marks) => marks.map((mark) => {
    const box = mark.querySelector('circle').getBoundingClientRect();
    return { text: mark.textContent, x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }));
}

/** Selects Player → Game with a click on its segment's middle. */
async function selectTheLine(page) {
  await clickAt(page, segmentOf(page));
  await expect(page.locator('.uml-pg-edge-hitbox.is-selected')).not.toHaveCount(0);
}

test.describe('a move without a drag', () => {
  test('"Move…" and a click move a class without a drag: the source equals the source after dragging the class by its centre to the same point, and one Undo takes the move back', async ({ page }) => {
    // Player is selected first in both runs (with Enter: a click just before the drag's press would make a double-click),
    // so the Properties pane that a selection opens has opened, and each run measures Player where it is when its
    // pointer goes: the toolbar shows Cancel while a move runs.
    // In drawing units, so the same place is meant whatever the drawing's scale on the page.
    const offset = { x: -47, y: 63 };
    await openWith(page, 'class', PLAYERS);
    const player = element(page, 'Player');
    await player.focus();
    await page.keyboard.press('Enter');

    await clickAt(page, player, { button: 'right' });
    await menuOf(page).getByRole('menuitem', { name: 'Move…', exact: true }).click();
    await expect(toolStatus(page)).toHaveText(MOVING_PLAYER);
    await expect(sourceOf(page), 'starting a move writes nothing').toHaveValue(PLAYERS);
    const target = await pageOfDrawingPoint(page, await drawnCentreOf(page, 'Player', offset));
    await page.mouse.click(target.x, target.y);
    await expect(sourceOf(page)).not.toHaveValue(PLAYERS);
    const moved = await sourceOf(page).inputValue();
    await expect(player, 'focus is on the moved item').toBeFocused();
    await page.keyboard.press('Control+z');
    await expect(sourceOf(page), 'one Undo takes the move back').toHaveValue(PLAYERS);

    await openWith(page, 'class', PLAYERS);
    await player.focus();
    await page.keyboard.press('Enter');
    const from = await pageOfDrawingPoint(page, await drawnCentreOf(page, 'Player'));
    const to = await pageOfDrawingPoint(page, await drawnCentreOf(page, 'Player', offset));
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
    await expect(sourceOf(page)).not.toHaveValue(PLAYERS);
    expect(moved, 'the move without a drag writes what the drag writes').toBe(await sourceOf(page).inputValue());
  });

  test('Shift+F10, "Move…", three presses of Right, and Enter give the source that three arrow-key nudges of the focused class give', async ({ page }) => {
    await openWith(page, 'class', PLAYERS);
    await startMove(page, element(page, 'Player'));
    for (let press = 1; press <= 3; press++) {
      await page.keyboard.press('ArrowRight');
      await expect(sourceOf(page), `after press ${press} of Right the source is unchanged`).toHaveValue(PLAYERS);
      await expect(toolStatus(page), `after press ${press} the move still runs`).toHaveText(MOVING_PLAYER);
    }
    await page.keyboard.press('Enter');
    await expect(sourceOf(page)).not.toHaveValue(PLAYERS);
    const moved = await sourceOf(page).inputValue();

    await openWith(page, 'class', PLAYERS);
    await element(page, 'Player').focus();
    for (let press = 0; press < 3; press++) await page.keyboard.press('ArrowRight');
    await expect(sourceOf(page)).not.toHaveValue(PLAYERS);
    expect(moved).toBe(await sourceOf(page).inputValue());
    expect(savedPosition(moved, 'Player').x % 10, 'the steps are exact: Player stays off the grid').not.toBe(0);
  });

  test('with Snap checked, Shift+Right inside a move moves the class by exactly 1 px', async ({ page }) => {
    await openWith(page, 'class', PLAYERS);
    await expect(page.getByLabel('Snap to layout grid')).toBeChecked();
    await startMove(page, element(page, 'Player'));
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Enter');
    await expect(sourceOf(page)).not.toHaveValue(PLAYERS);
    const moved = savedPosition(await sourceOf(page).inputValue(), 'Player');
    await page.keyboard.press('Control+z');
    await expect(sourceOf(page)).toHaveValue(PLAYERS);

    // Where Player is drawn now, as a write of every drawn position (Shift+Left, then Shift+Right, back) states it.
    await element(page, 'Player').focus();
    await page.keyboard.press('Shift+ArrowLeft');
    await page.keyboard.press('Shift+ArrowRight');
    await expect(sourceOf(page)).not.toHaveValue(PLAYERS);
    const drawn = savedPosition(await sourceOf(page).inputValue(), 'Player');
    expect(moved).toEqual({ x: drawn.x + 1, y: drawn.y });
  });
});

test.describe('cancelling a move', () => {
  const ways = {
    'Escape': async (page) => page.keyboard.press('Escape'),
    'the Cancel button': async (page) => page.locator('#uml-pg-tool-cancel').click(),
    'a press outside the canvas': async (page) => page.getByText('Diagram type:', { exact: true }).click(),
  };
  for (const [way, cancel] of Object.entries(ways)) {
    test(`${way} cancels a move and leaves the source unchanged`, async ({ page }) => {
      await openWith(page, 'class', PLAYERS);
      await startMove(page, element(page, 'Player'));
      await page.keyboard.press('ArrowDown');
      await expect(page.locator('#uml-pg-tool-cancel')).toBeVisible();

      await cancel(page);

      await expect(toolStatus(page)).toHaveText(PLAYER_STAYS);
      await expect(page.locator('#uml-pg-tool-cancel')).toBeHidden();
      await expect(sourceOf(page)).toHaveValue(PLAYERS);
      // The move has ended: the next arrow key on the focused class is its own nudge again, written at once.
      await element(page, 'Player').focus();
      await page.keyboard.press('ArrowLeft');
      await expect(sourceOf(page)).not.toHaveValue(PLAYERS);
      await expect(toolStatus(page)).not.toHaveText(/^Moving/);
    });
  }

  // Review Focus 6: the drawing is made again while a move runs.
  const redraws = {
    'typing in the source': async (page, nudged) => {
      await page.clock.install();
      await putSource(page, `${nudged}\n`);
      // The render debounce: the drawing is made again once the typing has paused.
      await page.clock.runFor(500);
      return `${nudged}\n`;
    },
    'Undo': async (page) => {
      await page.keyboard.press('Control+z');
      return PLAYERS;
    },
    'switching the diagram type': async (page, nudged) => {
      await page.getByLabel('Diagram type:').selectOption('state');
      await page.getByLabel('Diagram type:').selectOption('class');
      return nudged;
    },
  };
  for (const [what, redraw] of Object.entries(redraws)) {
    test(`${what} while a move runs ends the move, applies nothing, and announces that the drawing changed`, async ({ page }) => {
      await openWith(page, 'class', PLAYERS);
      // One step to undo: Player nudged once with its own arrow key.
      await element(page, 'Player').focus();
      await page.keyboard.press('ArrowRight');
      await expect(sourceOf(page)).not.toHaveValue(PLAYERS);
      const nudged = await sourceOf(page).inputValue();
      await startMove(page, element(page, 'Player'));
      await page.keyboard.press('ArrowDown');

      const expected = await redraw(page, nudged);

      await expect(toolStatus(page)).toHaveText(DRAWING_CHANGED);
      await expect(page.locator('#uml-pg-tool-cancel')).toBeHidden();
      await expect(sourceOf(page), 'the move applied nothing').toHaveValue(expected);
    });
  }
});

test.describe('opening an item\'s menu', () => {
  for (const key of ['Shift+F10', 'ContextMenu']) {
    test(`${key} on a focused class opens exactly one menu, with focus on its first item, also when the contextmenu event that Windows and Linux browsers send for the key follows`, async ({ page }) => {
      await openWith(page, 'class', PLAYERS);
      const player = element(page, 'Player');
      const menu = await openMenuWithKey(page, player, key);
      const first = menu.getByRole('menuitem').first();
      await expect(first).toBeFocused();

      // The macOS runner sends no contextmenu event for the key, so the test sends the one Windows and Linux send:
      // to the item, and to the menu's focused item.
      const prevented = [];
      for (const target of [player, first]) {
        prevented.push(await target.evaluate((node) => {
          const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
          node.dispatchEvent(event);
          return event.defaultPrevented;
        }));
      }

      expect(prevented, 'no browser menu opens over the editor\'s').toEqual([true, true]);
      await expect(menuOf(page)).toHaveCount(1);
      await expect(menu.getByRole('menuitem').first()).toBeFocused();
    });
  }

  test('the "⋯" button of a selected class opens its menu with one click, is at least 24 by 24 CSS px at 50% and 200% zoom, and Tab does not stop on it', async ({ page }) => {
    await openWith(page, 'class', PLAYERS);
    await clickAt(page, element(page, 'Player'));
    const button = actionsFor(page, 'Player');
    await expect(button).toHaveAttribute('aria-haspopup', 'menu');

    await button.click();
    await expect(menuOf(page)).toHaveCount(1);
    await expect(menuOf(page).getByRole('menuitem', { name: 'Move…', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menuOf(page)).toHaveCount(0);
    await expect(element(page, 'Player'), 'closing the menu returns focus to the item').toBeFocused();

    // The editor's zoom steps by 1.2: four steps out reach 48%, four in from there and four more reach 207%.
    for (const [steps, readout] of [[{ out: 4 }, '48%'], [{ in: 8 }, '207%']]) {
      const name = steps.out ? 'Zoom out' : 'Zoom in';
      for (let step = 0; step < (steps.out || steps.in); step++) await page.getByRole('button', { name, exact: true }).click();
      await expect(page.locator('#uml-pg-zoom-readout')).toHaveText(readout);
      const box = await button.boundingBox();
      expect(box && box.width, `width at ${readout}`).toBeGreaterThanOrEqual(24);
      expect(box && box.height, `height at ${readout}`).toBeGreaterThanOrEqual(24);
    }

    const tabStops = await page.locator('#uml-pg-output svg [tabindex="0"]').count();
    await element(page, 'Player').focus();
    for (let press = 0; press <= tabStops; press++) {
      await page.keyboard.press('Tab');
      await expect(button, `Tab press ${press + 1} does not stop on the button`).not.toBeFocused();
    }
  });

  const hitsAt = (page, points) => page.evaluate((at) => at.map(({ x, y }) => {
    const hit = document.elementFromPoint(x, y);
    return {
      onButton: !!(hit && hit.closest('.uml-pg-action-button')),
      id: hit && hit.closest('[data-layout-id]') ? hit.closest('[data-layout-id]').getAttribute('data-layout-id') : null,
      handle: !!(hit && hit.closest('.uml-pg-extend-handle-group')),
      route: hit ? hit.getAttribute('data-route-id') : null,
    };
  }), points);
  const cornersOf = (box) => [
    { x: box.x + 1, y: box.y + 1 }, { x: box.x + box.width - 1, y: box.y + 1 },
    { x: box.x + box.width - 1, y: box.y + box.height - 1 }, { x: box.x + 1, y: box.y + box.height - 1 },
  ];

  test('while the button is shown, a press at the centre of each port and handle of the selected item, at each corner of its box, and at the middle of a selected line\'s longest segment reaches that target, not the button', async ({ page }) => {
    await openWith(page, 'component', SERVICES);
    const backend = element(page, 'Backend');
    await clickAt(page, backend);
    await expect(actionsFor(page, 'Backend')).toBeVisible();
    const ports = page.getByRole('button', { name: /^Port / });
    const portCentres = await Promise.all((await ports.all()).map(centreOf));
    const portIds = await ports.evaluateAll((targets) => targets.map((target) => target.getAttribute('data-layout-id')));
    const handle = page.getByRole('button', { name: 'Extend a relation from Backend', exact: true });
    const corners = cornersOf(/** @type {any} */ (await page.locator('.uml-pg-edit-hitbox[data-layout-id="Backend"]').boundingBox()));

    // A port on the side of Backend's "+" handle may lie under that handle, as before this stage; either way the press
    // reaches the port or the handle, not the button.
    const portHits = await hitsAt(page, portCentres);
    portHits.forEach((hit, at) => expect(hit.onButton || !(hit.id === portIds[at] || hit.handle), `port ${portIds[at]}`).toBe(false));
    expect(await hitsAt(page, [await centreOf(handle)]), 'the handle\'s centre does not reach the button').toEqual([expect.objectContaining({ onButton: false })]);
    for (const hit of await hitsAt(page, corners)) expect(hit, 'a corner reaches Backend').toEqual(expect.objectContaining({ onButton: false, id: 'Backend' }));

    await clickAt(page, segmentOf(page));
    await expect(page.getByRole('button', { name: /^Actions for / })).toBeVisible();
    const lineHits = await hitsAt(page, [await middleOfLongestSegment(page)]);
    expect(lineHits[0].onButton, 'the middle of the longest segment reaches the line').toBe(false);
    expect(lineHits[0].route).not.toBeNull();

    await openWith(page, 'deployment', SERVERS);
    await clickAt(page, element(page, 'Server'));
    await expect(actionsFor(page, 'Server')).toBeVisible();
    const serverHandle = page.getByRole('button', { name: 'Extend a relation from Server', exact: true });
    expect(await hitsAt(page, [await centreOf(serverHandle)]), 'the handle\'s centre does not reach the button').toEqual([expect.objectContaining({ onButton: false })]);
    const serverCorners = cornersOf(/** @type {any} */ (await page.locator('.uml-pg-edit-hitbox[data-layout-id="Server"]').boundingBox()));
    for (const hit of await hitsAt(page, serverCorners)) expect(hit).toEqual(expect.objectContaining({ onButton: false, id: 'Server' }));
  });
});

test.describe('what "Move…" moves', () => {
  test('a port moved with "Move…" stays on its component\'s border', async ({ page }) => {
    await openWith(page, 'component', SERVICES);
    const port = page.getByRole('button', { name: /^Port dbOut/ });
    const component = await page.locator('.uml-pg-edit-hitbox[data-layout-id="Backend"]').boundingBox();
    if (!component) throw new Error('Backend is not drawn');
    await startMove(page, port);
    await page.mouse.click(component.x + component.width / 2, component.y + component.height + 60);
    await expect(sourceOf(page)).not.toHaveValue(SERVICES);

    const portBox = await page.locator('.uml-pg-edit-hitbox.is-port').first().boundingBox();
    const after = await page.locator('.uml-pg-edit-hitbox[data-layout-id="Backend"]').boundingBox();
    if (!portBox || !after) throw new Error('the port or its component is not drawn');
    const centre = { x: portBox.x + portBox.width / 2, y: portBox.y + portBox.height / 2 };
    const fromSides = [Math.abs(centre.x - after.x), Math.abs(centre.x - (after.x + after.width)),
      Math.abs(centre.y - after.y), Math.abs(centre.y - (after.y + after.height))];
    expect(Math.min(...fromSides), 'the port\'s centre lies on a side of Backend').toBeLessThanOrEqual(1.5);
    expect(centre.y, 'it went to the side nearest the click: the bottom').toBeGreaterThan(after.y + after.height / 2);
  });

  test('two selected classes moved through "Move…" keep their distance', async ({ page }) => {
    await openWith(page, 'class', PLAYERS);
    await clickAt(page, element(page, 'Player'));
    await clickAt(page, element(page, 'Game'), { modifiers: ['Shift'] });
    await startMove(page, element(page, 'Player'));
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(sourceOf(page)).not.toHaveValue(PLAYERS);

    const text = await sourceOf(page).inputValue();
    const player = savedPosition(text, 'Player');
    const game = savedPosition(text, 'Game');
    expect({ x: player.x - game.x, y: player.y - game.y }, 'Player is where it was from Game').toEqual({ x: 423, y: 0 });
    await page.keyboard.press('Control+z');
    await expect(sourceOf(page), 'one move, one undo step').toHaveValue(PLAYERS);
  });
});

test.describe('bends without a drag', () => {
  test('"Add a bend" puts a bend in the middle of the line\'s longest segment, shows "1" at it, and arrow keys and Enter place it', async ({ page }) => {
    await openWith(page, 'class', PLAYERS);
    await selectTheLine(page);
    // In drawing units: Player → Game is drawn as one straight segment, the line's longest.
    const [x1, y1, x2, y2] = await segmentOf(page).evaluate((line) => ['x1', 'y1', 'x2', 'y2'].map((name) => Number(line.getAttribute(name))));
    const menu = await openMenuWithKey(page, segmentOf(page));
    await menu.getByRole('menuitem', { name: 'Add a bend', exact: true }).click();
    await expect(toolStatus(page)).toHaveText(/^Moving bend 1 of .+: click where it should go, or use the arrow keys and press Enter\. Escape cancels\.$/);

    const marks = page.locator('.uml-pg-bend-number');
    await expect(marks).toHaveText(['1']);
    await expect(marks, 'at the middle of the segment').toHaveAttribute('transform', `translate(${(x1 + x2) / 2} ${(y1 + y2) / 2})`);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(sourceOf(page), 'the bend is a preview until Enter').toHaveValue(PLAYERS);
    await page.keyboard.press('Enter');

    await expect(sourceOf(page)).not.toHaveValue(PLAYERS);
    await selectTheLine(page);
    await expect.poll(async () => (await bendNumbers(page)).map((mark) => mark.text), 'the line keeps its bend').toContain('1');
  });

  test('"Move bend 1…" and a click move that bend, "Remove bend 1" removes it, and "Straighten" leaves no bend, each as one undo step', async ({ page }) => {
    // Writes under one key within 600 ms join one undo step, as two quick drags of a line do; the clock passes that
    // window between the steps below.
    await page.clock.install();
    await openWith(page, 'class', PLAYERS);
    await selectTheLine(page);
    for (let added = 0; added < 2; added++) {
      const menu = await openMenuWithKey(page, segmentOf(page));
      await menu.getByRole('menuitem', { name: 'Add a bend', exact: true }).click();
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await expect(toolStatus(page)).not.toHaveText(/^Moving/);
      await page.clock.fastForward(1000);
      await selectTheLine(page);
    }

    /** Runs `act` and checks that it changed the source as one undo step. */
    async function oneUndoStep(act) {
      const before = await sourceOf(page).inputValue();
      await act();
      await expect(sourceOf(page)).not.toHaveValue(before);
      const after = await sourceOf(page).inputValue();
      await segmentOf(page).focus();
      await page.keyboard.press('Control+z');
      await expect(sourceOf(page), 'one Undo takes it back').toHaveValue(before);
      await segmentOf(page).focus();
      await page.keyboard.press('Control+Shift+z');
      await expect(sourceOf(page)).toHaveValue(after);
      await page.clock.fastForward(1000);
      await selectTheLine(page);
    }

    await oneUndoStep(async () => {
      const menu = await openMenuWithKey(page, segmentOf(page));
      await menu.getByRole('menuitem', { name: 'Move bend 1…', exact: true }).click();
      await expect(toolStatus(page)).toHaveText(/^Moving bend 1 of /);
      const at = (await bendNumbers(page)).find((mark) => mark.text === '1');
      if (!at) throw new Error('bend 1 shows no number');
      await page.mouse.click(at.x + 30, at.y + 40);
    });
    await oneUndoStep(async () => {
      const menu = await openMenuWithKey(page, segmentOf(page));
      await menu.getByRole('menuitem', { name: 'Remove bend 1', exact: true }).click();
    });
    await oneUndoStep(async () => {
      const menu = await openMenuWithKey(page, segmentOf(page));
      await menu.getByRole('menuitem', { name: 'Straighten', exact: true }).click();
    });
    const menu = await openMenuWithKey(page, segmentOf(page));
    await expect(menu.getByRole('menuitem', { name: /bend \d|Straighten/ }), 'a straight line offers no bend to move or remove').toHaveCount(0);
  });

  test('a sequence message\'s menu has no bend item', async ({ page }) => {
    await openWith(page, 'sequence', CHAT);
    const message = page.getByRole('button', { name: /^Relation segment 1 of seqmsg:/ }).first();
    const menu = await openMenuWithKey(page, message);
    await expect(menu.getByRole('menuitem').first()).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /bend|Straighten/ })).toHaveCount(0);
  });
});

test.describe('what stays', () => {
  test('the items the element menu and the line menu had before keep their labels and their order', async ({ page }) => {
    await openWith(page, 'class', PLAYERS);
    const elementMenu = await openMenuWithKey(page, element(page, 'Player'));
    const elementItems = await itemLabels(elementMenu);
    expect(elementItems.filter((label) => label !== 'Move…'))
      .toEqual(['Rename label', 'Add attribute', 'Add method', 'Edit properties', 'Add callout', 'Duplicate', 'Delete']);
    expect(elementItems[elementItems.indexOf('Edit properties') + 1], '"Move…" follows "Edit properties"').toBe('Move…');
    await page.keyboard.press('Escape');

    await selectTheLine(page);
    const lineMenu = await openMenuWithKey(page, segmentOf(page));
    const lineItems = await itemLabels(lineMenu);
    expect(lineItems.filter((label) => label !== 'Add a bend')).toEqual(['Edit relation', 'Add callout', 'Invert direction', 'Delete']);
    expect(lineItems[1], '"Add a bend" follows "Edit relation"').toBe('Add a bend');
  });

  test('print and Download SVG show no "⋯" button, no bend number, and no menu', async ({ page }) => {
    await openWith(page, 'class', PLAYERS);
    await selectTheLine(page);
    let menu = await openMenuWithKey(page, segmentOf(page));
    await menu.getByRole('menuitem', { name: 'Add a bend', exact: true }).click();
    await page.keyboard.press('Enter');
    await expect(toolStatus(page)).not.toHaveText(/^Moving/);
    await selectTheLine(page);
    await expect(page.getByRole('button', { name: /^Actions for / })).toBeVisible();
    await expect(page.locator('.uml-pg-bend-number')).toHaveCount(1);
    menu = await openMenuWithKey(page, segmentOf(page));

    await page.emulateMedia({ media: 'print' });
    await expect(page.getByRole('button', { name: /^Actions for / })).toBeHidden();
    await expect(page.locator('.uml-pg-bend-number')).toBeHidden();
    await expect(menuOf(page)).toBeHidden();
    await page.emulateMedia({ media: 'screen' });
    await page.keyboard.press('Escape');

    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download SVG/ }).click();
    const file = await (await downloading).path();
    const svg = fs.readFileSync(file, 'utf8');
    expect(svg).not.toContain('uml-pg-action-button');
    expect(svg).not.toContain('Actions for');
    expect(svg).not.toContain('uml-pg-bend-number');
    expect(svg).not.toContain('uml-pg-context-menu');
  });
});

test.describe('accessibility of the new states', () => {
  const states = {
    'the menu open': async (page) => {
      await openMenuWithKey(page, element(page, 'Player'));
    },
    'a move running': async (page) => {
      await startMove(page, element(page, 'Player'));
      await page.keyboard.press('ArrowRight');
      await expect(toolStatus(page)).toHaveText(MOVING_PLAYER);
    },
    'bend numbers shown': async (page) => {
      await selectTheLine(page);
      const menu = await openMenuWithKey(page, segmentOf(page));
      await menu.getByRole('menuitem', { name: 'Add a bend', exact: true }).click();
      await expect(page.locator('.uml-pg-bend-number')).toHaveCount(1);
    },
  };
  for (const theme of ['light', 'dark']) {
    for (const width of [320, 1440]) {
      for (const [state, reach] of Object.entries(states)) {
        test(`no WCAG 2.2 AA finding with ${state}, in ${theme} mode at ${width} CSS px`, async ({ page, baseURL }) => {
          // The theme comes from the saved preference, so the editor draws once in it and nothing redraws mid-state.
          await page.context().addCookies([{ name: 'dark-mode', value: theme === 'dark' ? 'true' : 'false', url: String(baseURL) }]);
          await page.setViewportSize({ width, height: 900 });
          await openWith(page, 'class', PLAYERS);
          await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark-mode/ : /^(?!.*dark-mode)/);
          await reach(page);
          await auditInteractiveState(page, `UML editor with ${state}, ${theme} mode, ${width} px`, {
            include: '#uml-playground-wrap',
            darkMode: false,
          });
        });
      }
    }
  }
});
