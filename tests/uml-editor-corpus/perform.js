'use strict';
/**
 * Performs a gesture of the UML editor's corpus on a page and observes what it leaves
 * (spec 2026-11-12 §9.2).
 *
 * A gesture is data, so a fixture can store it: `{ id, family, type, page, start, steps, covers }`.
 * - `page` is one of EDITOR_PAGES; `type` is the diagram type chosen before the start is loaded.
 * - `start` is the document the gesture starts from: a string is loaded into the source as a script
 *   would (an untrusted `input` event: rendered at once, no undo step); `null` keeps the page's own
 *   document for `type`; `{ draft }` makes the text the page's stored draft for `type` before the page
 *   loads, so the page restores it at load, or at the switch to `type` (persistence pages only;
 *   placeDraft says how). The harness fails the gesture when the source does not hold the draft then.
 * - `steps` is a list of `{ do, … }` objects; STEP_ACTIONS lists them. Steps name elements by role and
 *   name, by label, or by the ids and classes of spec §3.7 (`target`), and pointers by points read
 *   from the drawing (`point`). No step waits on the clock: a gesture that needs a timer to run says
 *   so with `{ do: 'advance', ms }`.
 *
 * A target is `{ role, name, exact }`, `{ label, exact }`, `{ text, exact }`, or `{ css }`, with an
 * optional `within` (another target) and `nth`. A point is `{ target, at, offset }` (`at` is a
 * fraction of the target's box, its centre by default; `offset` is in CSS px), `{ svg: { x, y } }`
 * (a point of the drawing, in its own coordinates), or `{ client: { x, y } }`.
 */

const { expect } = require('@playwright/test');
const clock = require('./clock');
const { observe } = require('./observe');

const EDITOR_PAGES = Object.freeze([
  '/SEBook/tools/uml-editor',
  '/SEBook/tools/uml-playground',
  '/SEBook/designpatterns/monopoly-state-pattern-uml-homework',
]);
const THEMES = Object.freeze(['light', 'dark', 'print']);
const DARK_MODE_COOKIE = 'dark-mode=true; path=/';

const SOURCE = '#uml-pg-input';
const TYPE_SELECT = '#uml-pg-type';
// A `{ draft }` start waits under this key of the page's storage while the page reloads (placeDraft).
const PENDING_DRAFT_KEY = 'uml-editor-corpus-pending-draft';
const OUTPUT_SVG = '#uml-pg-output svg';
const UNDO = '#uml-pg-undo';
const REDO = '#uml-pg-redo';

// ---------- locating ----------

function locate(page, target) {
  if (!target || typeof target !== 'object') throw new Error(`perform: a target must be an object, got ${JSON.stringify(target)}`);
  const scope = target.within ? locate(page, target.within) : page;
  const exact = target.exact !== false;
  let locator;
  if (target.role) locator = scope.getByRole(target.role, target.name === undefined ? {} : { name: target.name, exact });
  else if (target.label) locator = scope.getByLabel(target.label, { exact });
  else if (target.text) locator = scope.getByText(target.text, { exact });
  else if (target.css) locator = scope.locator(target.css);
  else throw new Error(`perform: a target needs role, label, text, or css: ${JSON.stringify(target)}`);
  return Number.isInteger(target.nth) ? locator.nth(target.nth) : locator;
}

async function svgPointToClient(page, svgPoint) {
  const output = page.locator(OUTPUT_SVG).first();
  await output.scrollIntoViewIfNeeded();
  return output.evaluate((svg, point) => {
    const matrix = svg.getScreenCTM();
    const p = svg.createSVGPoint();
    p.x = point.x;
    p.y = point.y;
    const client = p.matrixTransform(matrix);
    return { x: client.x, y: client.y };
  }, svgPoint);
}

/** The viewport point of a point spec (see the header). */
async function pointOf(page, point) {
  if (point.client) return { x: point.client.x, y: point.client.y };
  if (point.svg) return svgPointToClient(page, point.svg);
  if (!point.target) throw new Error(`perform: a point needs target, svg, or client: ${JSON.stringify(point)}`);
  const locator = locate(page, point.target);
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error(`perform: the point's target has no box: ${JSON.stringify(point.target)}`);
  const at = point.at || { x: 0.5, y: 0.5 };
  const offset = point.offset || { x: 0, y: 0 };
  return { x: box.x + box.width * at.x + offset.x, y: box.y + box.height * at.y + offset.y };
}

// ---------- steps ----------

async function withModifiers(page, modifiers, run) {
  const keys = modifiers || [];
  for (const key of keys) await page.keyboard.down(key);
  try {
    await run();
  } finally {
    for (const key of [...keys].reverse()) await page.keyboard.up(key);
  }
}

async function movePointer(page, point, steps) {
  const { x, y } = await pointOf(page, point);
  await page.mouse.move(x, y, { steps: steps || 1 });
}

const STEP_ACTIONS = {
  // Controls (HTML): Playwright's own actions, with their checks.
  click: (page, step) => locate(page, step.target).click({ button: step.button, modifiers: step.modifiers, clickCount: step.clickCount }),
  dblclick: (page, step) => locate(page, step.target).dblclick({ modifiers: step.modifiers }),
  hover: (page, step) => locate(page, step.target).hover(),
  focus: (page, step) => locate(page, step.target).focus(),
  fill: (page, step) => locate(page, step.target).fill(step.value),
  select: (page, step) => locate(page, step.target).selectOption(step.value),
  check: (page, step) => locate(page, step.target).check(),
  uncheck: (page, step) => locate(page, step.target).uncheck(),
  // Keys: on a target (focused first), or on whatever has focus.
  press: (page, step) => (step.target ? locate(page, step.target).press(step.key) : page.keyboard.press(step.key)),
  type: (page, step) => (step.target ? locate(page, step.target).pressSequentially(step.text) : page.keyboard.type(step.text)),
  keyDown: (page, step) => page.keyboard.down(step.key),
  keyUp: (page, step) => page.keyboard.up(step.key),
  // Pointer on the drawing: points read from it.
  pointerMove: (page, step) => movePointer(page, step.point, step.steps),
  pointerDown: async (page, step) => {
    if (step.point) await movePointer(page, step.point);
    await page.mouse.down({ button: step.button });
  },
  pointerUp: async (page, step) => {
    if (step.point) await movePointer(page, step.point, step.steps);
    await page.mouse.up({ button: step.button });
  },
  pointerClick: async (page, step) => {
    const { x, y } = await pointOf(page, step.point);
    await withModifiers(page, step.modifiers, () => page.mouse.click(x, y, { button: step.button, clickCount: step.clickCount }));
  },
  pointerDblclick: async (page, step) => {
    const { x, y } = await pointOf(page, step.point);
    await withModifiers(page, step.modifiers, () => page.mouse.dblclick(x, y));
  },
  // Press at `from`, move to each of `via` and then to `to`, and release unless `release` is false.
  drag: async (page, step) => {
    await withModifiers(page, step.modifiers, async () => {
      await movePointer(page, step.from);
      await page.mouse.down();
      for (const point of step.via || []) await movePointer(page, point, step.steps);
      await movePointer(page, step.to, step.steps || 8);
      if (step.release !== false) await page.mouse.up();
    });
  },
  wheel: async (page, step) => {
    await movePointer(page, step.point);
    await withModifiers(page, step.modifiers, () => page.mouse.wheel(step.deltaX || 0, step.deltaY || 0));
  },
  // An event no device here can make (a pointercancel), dispatched on a target or the document.
  dispatch: (page, step) => page.evaluate(({ css, type, init }) => {
    const target = css ? document.querySelector(css) : document;
    if (!target) throw new Error(`perform: no element for ${css}`);
    const EventType = /^pointer/.test(type) ? PointerEvent : /^key/.test(type) ? KeyboardEvent : Event;
    target.dispatchEvent(new EventType(type, { bubbles: true, cancelable: true, ...(init || {}) }));
  }, { css: step.css || null, type: step.type, init: step.init || null }),
  advance: (page, step) => clock.advance(page, step.ms),
  reload: async (page) => {
    await page.reload();
    await bootEditor(page);
  },
};

async function performSteps(page, steps) {
  for (const [index, step] of steps.entries()) {
    const action = STEP_ACTIONS[step.do];
    if (!action) throw new Error(`perform: step ${index + 1} has an unknown action "${step.do}"; known: ${Object.keys(STEP_ACTIONS).join(', ')}`);
    try {
      await action(page, step);
    } catch (error) {
      error.message = `step ${index + 1} ${JSON.stringify(step)}: ${error.message}`;
      throw error;
    }
  }
}

// ---------- the page ----------

/** Waits for the page's fonts and the editor's first drawing, then runs its timers until nothing is pending. */
async function bootEditor(page) {
  await page.evaluate(() => document.fonts.ready.then(() => true));
  await clock.quiesce(page);
  await expect(page.getByRole('region', { name: 'Visual editor palette', exact: true })).toBeVisible();
}

async function loadStart(page, start) {
  await page.locator(SOURCE).evaluate((textarea, text) => {
    textarea.value = text;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }, start);
  await clock.quiesce(page);
}

/** The text of a `{ draft }` start, else null. */
function draftOf(start) {
  return start !== null && typeof start === 'object' ? start.draft : null;
}

// An init script: in the top document, before any of the page's scripts run, it moves a pending
// draft to the autosave key it names. It runs on every later navigation too, and finds nothing then.
function movePendingDraft(pendingKey) {
  if (window !== window.top) return;
  const pending = localStorage.getItem(pendingKey);
  if (pending === null) return;
  localStorage.removeItem(pendingKey);
  const { key, text } = JSON.parse(pending);
  localStorage.setItem(key, text);
}

/**
 * Makes `draft` the stored draft of `type` and reloads the page, which restores it. Storing the draft
 * in this page and reloading is not enough: leaving the page runs the editor's `pagehide` autosave,
 * which stores the source over the draft before the next page reads it. So the draft waits under
 * PENDING_DRAFT_KEY, and movePendingDraft puts it under the autosave key when the next page starts.
 */
async function placeDraft(page, type, draft) {
  const key = await page.evaluate((diagramType) => {
    const config = JSON.parse(document.getElementById('uml-pg-config').textContent);
    return config.persistence === false ? null : window.UMLEditor.autosaveKey(diagramType);
  }, type);
  if (key === null) throw new Error('perform: a { draft } start needs a page with persistence');
  await page.addInitScript(movePendingDraft, PENDING_DRAFT_KEY);
  await page.evaluate(({ pendingKey, pending }) => localStorage.setItem(pendingKey, JSON.stringify(pending)),
    { pendingKey: PENDING_DRAFT_KEY, pending: { key, text: draft } });
  await page.reload();
  await bootEditor(page);
}

async function chooseType(page, type) {
  const select = page.locator(TYPE_SELECT);
  if ((await select.inputValue()) === type) return;
  await select.selectOption(type);
  await clock.quiesce(page);
}

/**
 * Opens the gesture's page with a paused clock, chooses its diagram type, and loads its start.
 * The theme is set before the page loads, never switched afterwards (a switch redraws the editor
 * and moves what lies under the pointer): `dark` is the saved preference (the site's cookie, read
 * by its head script before anything draws); `print` is the print medium, whose controller gives
 * the page the light palette.
 */
async function openGesturePage(page, gesture, { theme = 'light' } = {}) {
  if (!EDITOR_PAGES.includes(gesture.page)) throw new Error(`perform: ${gesture.page} is not an editor page`);
  if (!THEMES.includes(theme)) throw new Error(`perform: unknown theme ${theme}`);
  await clock.installPausedClock(page);
  if (theme === 'dark') await page.addInitScript((cookie) => { document.cookie = cookie; }, DARK_MODE_COOKIE);
  if (theme === 'print') await page.emulateMedia({ media: 'print' });
  await page.goto(gesture.page);
  await bootEditor(page);
  const draft = draftOf(gesture.start);
  if (draft !== null) await placeDraft(page, gesture.type, draft);
  await chooseType(page, gesture.type);
  if (typeof gesture.start === 'string') await loadStart(page, gesture.start);
  if (draft !== null) await expect(page.locator(SOURCE), 'the page restored the { draft } start').toHaveValue(draft);
}

async function pressHistoryButton(page, css) {
  const button = page.locator(css);
  // A gesture that changed nothing leaves the button disabled: then there is nothing to undo or redo.
  if (await button.isEnabled()) await button.click();
}

const performUndo = (page) => pressHistoryButton(page, UNDO);
const performRedo = (page) => pressHistoryButton(page, REDO);

/**
 * The corpus protocol for one gesture: open its page, perform its steps, and observe the page after
 * them, after Undo, and after Redo (each through the toolbar's button), with the clock settled before
 * each observation and quiet before each Undo and Redo. `hooks.beforeSteps(page)` and
 * `hooks.afterSteps(page)` let a mode watch the steps alone (the operation log of plan Task 11).
 */
async function runGesture(page, gesture, hooks = {}) {
  await openGesturePage(page, gesture);
  if (hooks.beforeSteps) await hooks.beforeSteps(page);
  await performSteps(page, gesture.steps);
  await clock.settle(page);
  if (hooks.afterSteps) await hooks.afterSteps(page);
  const after = await observe(page);
  await clock.quiesce(page);
  await performUndo(page);
  await clock.settle(page);
  const afterUndo = await observe(page);
  await clock.quiesce(page);
  await performRedo(page);
  await clock.settle(page);
  const afterRedo = await observe(page);
  return { after, afterUndo, afterRedo };
}

module.exports = {
  EDITOR_PAGES,
  THEMES,
  STEP_ACTIONS,
  locate,
  pointOf,
  performSteps,
  bootEditor,
  openGesturePage,
  performUndo,
  performRedo,
  runGesture,
};
