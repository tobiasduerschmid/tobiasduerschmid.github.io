// @ts-check
// The C4 editor's message region (UML-view editing spec §7.5, §7.7, §14 D6): one visible line directly before the
// canvas that shows the current instruction, refusal, result, or notice, with an optional offer and Dismiss. A refusal
// carries the label "Not done:" and an icon; the live region still speaks the editor's own words, once. The region is
// not itself live, never disappears on a timer, and is hidden in print. In C4-notation views the refusals of the shared
// actions and the instructions of Move and Add relationship go through it (D6).
//
// The editor is mounted from the manifests by tests/helpers/c4-uml-editing.js with the site's theme stylesheets; its
// host records every polite announcement (the host hears each one the live region does). Offers have no producer in a
// C4-notation view yet, so the tests that need one show a message through the region's report path, `show`, on the
// region the editor itself created (see keepMessageRegions).
const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { auditInteractiveState } = require('./a11y-helpers');
const { PARAGRAPH_PX } = require('./helpers/c4-editor-page.js');
const { openUmlEditor, hostLog, canvas, option, messageRegion } = require('./helpers/c4-uml-editing.js');

// The reviewed refusal table of the UML-notation views (spec §5.1; js/ArchUML/c4/editor/c4-editor-uml-refusals.js), with
// the values each code is filled with: the table's fixed values, or the first written-out case of a code whose words
// depend on the model.
const REFUSALS = JSON.parse(fs.readFileSync(path.join(__dirname, '../js/ArchUML/tests/c4/fixtures/uml-refusals.json'), 'utf8'));
const REFUSAL_VALUES = Object.fromEntries(REFUSALS.rows.map(({ code }) => [code, (REFUSALS.cases[code] || [{ values: REFUSALS.fill }])[0].values]));
const NOT_AVAILABLE = 'Not available in this design model';

const CONTAINERS = 'containers of registration';
// A lock on the database's name: Delete on it is refused with the editor's lock sentence, and asks nothing.
const LOCKED_DATABASE = { lockedFields: ['systems.registration.containers.db.name'] };
// An offer the tests can see work: it opens another view, which the canvas names.
const COMPONENTS_OFFER = { label: 'Show its components', view: 'components of api' };
const COMPONENTS_CANVAS = 'Canvas: Component view: Registration API';
// A refusal long enough to wrap over several lines of the row at any width.
const LONG_REFUSAL = `Error: ${'A long refusal that wraps over several lines of the row. '.repeat(4)}`;

const message = (editor) => messageRegion(editor).getByRole('paragraph');
const regionButton = (editor, name) => messageRegion(editor).getByRole('button', { name, exact: true });
const renameField = (editor, name) => canvas(editor).getByRole('textbox', { name: `Name of ${name}` });
// The editor's polite live region (the magnification readout is a status too, so it is told apart by its text).
const spoken = (editor, text) => editor.getByRole('status').filter({ hasText: text });
const lastAnnounced = async (page) => (await hostLog(page)).announced.at(-1);

/**
 * Test plumbing, run in the page before the editor mounts: wraps the message part's factory at the part registry, which
 * the mount reads at mount time, so every region the editor creates is kept in `window.messageRegions`.
 */
function keepMessageRegions() {
  const parts = window.ArchUMLC4EditorParts;
  const create = parts.messages.createMessageRegion;
  window.messageRegions = [];
  parts.messages = Object.assign({}, parts.messages, {
    createMessageRegion(...args) {
      const region = create(...args);
      window.messageRegions.push(region);
      return region;
    },
  });
}

/** An editor on the container view of the reference model, with the site's themes; `settings` as for openUmlEditor. */
function openContainerEditor(page, settings = {}) {
  return openUmlEditor(page, Object.assign({ view: CONTAINERS, siteThemes: true, beforeMount: keepMessageRegions }, settings));
}

/**
 * Shows a message through the editor's report path (its region's `show`). `offer` is `{ label, view }`, which opens
 * `view`, or `{ label, select }`, which selects the element `select` and so changes neither the view nor the document.
 */
function showMessage(page, { text, kind, offer = null }) {
  return page.evaluate(({ shown, offered }) => {
    const editor = window.c4Editors.editor;
    const run = offered && (offered.view ? () => editor.openView(offered.view) : () => editor.select(offered.select));
    window.messageRegions[0].show({ text: shown.text, kind: shown.kind, offer: offered ? { label: offered.label, run } : null });
  }, { shown: { text, kind }, offered: offer });
}

/** Presses Delete on the locked database, which the actions refuse with the lock sentence. */
async function refuseDeletingTheDatabase(page, editor) {
  await option(editor, 'Registration Database').focus();
  await page.keyboard.press('Delete');
  await expect.poll(() => lastAnnounced(page), 'the refusal is announced').toMatch(/^Locked: Registration Database\b/);
}

test.use({ viewport: { width: 1400, height: 1000 } });

/** The drawing's box on the page (its SVG): what must stay where it is when a message appears. */
const drawingBox = (editor) => canvas(editor).locator('svg').first().boundingBox();

/** How far below the message region's bottom edge `locator` starts, in CSS px (negative while the region covers it). */
async function spaceBelowMessage(editor, locator) {
  const [row, box] = await Promise.all([messageRegion(editor).boundingBox(), locator.boundingBox()]);
  return box.y - (row.y + row.height);
}

/** Scrolls the canvas as a learner would, until `locator` starts `offset` CSS px below the canvas's top edge. */
async function scrollCanvasUntil(editor, locator, offset) {
  await canvas(editor).evaluate((region, { top, below }) => { region.scrollTop += top - region.getBoundingClientRect().top - below; },
    { top: (await locator.boundingBox()).y, below: offset });
}

test.describe('the message region sits before the canvas', () => {
  test('an editable editor keeps a one-line message row directly before the canvas; a read-only editor has none', async ({ page }) => {
    // Without the message part the editor is laid out as before it existed: the canvas's box to keep.
    await openContainerEditor(page, { beforeMount: () => { delete window.ArchUMLC4EditorParts.messages; } });
    const canvasWithoutRegion = await canvas(page.locator('#editor')).boundingBox();

    const editor = await openContainerEditor(page);
    const region = messageRegion(editor);
    await expect(region).toBeVisible();
    const canvasRegion = await canvas(editor).elementHandle();
    expect(await region.evaluate((element, drawing) => element.nextElementSibling === drawing, canvasRegion),
      'the region comes directly before the canvas region in DOM order').toBe(true);
    expect(await canvas(editor).boundingBox(), 'the canvas keeps its box').toEqual(canvasWithoutRegion);

    const [row, frame] = await Promise.all([region.boundingBox(), canvas(editor).boundingBox()]);
    expect(row.y - frame.y, 'the row is drawn at the top of the canvas').toBeGreaterThanOrEqual(0);
    expect(row.y - frame.y).toBeLessThan(0.5 * PARAGRAPH_PX);
    expect(row.x).toBeGreaterThanOrEqual(frame.x);
    expect(row.x + row.width, 'within the canvas\'s width').toBeLessThanOrEqual(frame.x + frame.width);
    expect(row.width, 'across it').toBeGreaterThan(frame.width - PARAGRAPH_PX);
    expect(row.height, 'an empty row keeps the height of a line of text').toBeGreaterThanOrEqual(1.2 * PARAGRAPH_PX);
    expect(row.height, 'but not of two').toBeLessThan(2 * 1.4 * PARAGRAPH_PX);
    const drawing = await drawingBox(editor);
    expect(drawing.y, 'at the canvas\'s top, the drawing starts below the row').toBeGreaterThanOrEqual(row.y + row.height);

    await showMessage(page, { text: 'Error: That name is taken.', kind: 'refusal', offer: COMPONENTS_OFFER });
    await expect(regionButton(editor, 'Dismiss')).toBeVisible();
    expect((await region.boundingBox()).height, 'a one-line message with its buttons keeps the row\'s height').toBeCloseTo(row.height, 0);

    const readOnly = await openContainerEditor(page, { readOnly: true });
    await expect(canvas(readOnly)).toBeVisible();
    await expect(messageRegion(readOnly)).toHaveCount(0);
  });

  // A drawing taller than the canvas can be scrolled; a drawing fitted to the canvas is shorter than it.
  for (const { drawing, fit } of [{ drawing: 'a drawing taller than the canvas', fit: false }, { drawing: 'a fitted drawing', fit: true }]) {
    test(`a message that appears never moves the drawing, however long it is (${drawing})`, async ({ page }) => {
      const editor = await openContainerEditor(page);
      if (fit) await editor.getByRole('button', { name: 'Fit', exact: true }).click();
      await expect(editor.getByRole('group', { name: 'Magnification' }).getByRole('status')).toHaveText(fit ? /^(?!100%)/ : '100%');
      const [before, frame] = await Promise.all([drawingBox(editor), canvas(editor).boundingBox()]);

      await showMessage(page, { text: LONG_REFUSAL, kind: 'refusal', offer: COMPONENTS_OFFER });
      await expect(regionButton(editor, 'Dismiss')).toBeVisible();
      expect((await messageRegion(editor).boundingBox()).height, 'the row grows for a long message').toBeGreaterThan(2 * 1.4 * PARAGRAPH_PX);

      expect(await drawingBox(editor), 'the drawing stays where it was').toEqual(before);
      expect(await canvas(editor).boundingBox(), 'and so does the canvas').toEqual(frame);
    });
  }

  test('scrolled to its top, the canvas shows its drawing below the whole message, also after the message wraps anew at another width', async ({ page }) => {
    const editor = await openContainerEditor(page);
    const gapAtTheTop = async () => {
      await canvas(editor).evaluate((region) => { region.scrollTop = 0; });
      const [row, drawing] = await Promise.all([messageRegion(editor).boundingBox(), drawingBox(editor)]);
      return drawing.y - (row.y + row.height);
    };
    await showMessage(page, { text: LONG_REFUSAL, kind: 'refusal' });
    await expect(regionButton(editor, 'Dismiss')).toBeVisible();
    const wide = await messageRegion(editor).boundingBox();
    await expect.poll(gapAtTheTop, 'at 1400 px').toBeGreaterThanOrEqual(0);

    // Narrower, the editor stacks and the canvas is narrower: the message takes more lines.
    await page.setViewportSize({ width: 600, height: 1000 });

    await expect.poll(async () => (await messageRegion(editor).boundingBox()).height, 'the message wraps over more lines').toBeGreaterThan(wide.height);
    await expect.poll(gapAtTheTop, 'at 600 px').toBeGreaterThanOrEqual(0);
  });

  test('with size fill, the canvas ends at the bottom of the height the host gives the editor', async ({ page }) => {
    // A host that gives the editor its height, as a tutorial's workspace pane does.
    const editor = await openContainerEditor(page, {
      size: 'fill',
      beforeMount: () => Object.assign(document.getElementById('editor').style, { height: '600px', overflow: 'auto' }),
    });
    await expect(messageRegion(editor)).toBeVisible();
    const fillsToBottom = async () => {
      const [frame, drawingRegion] = await Promise.all([editor.boundingBox(), canvas(editor).boundingBox()]);
      return Math.round(frame.y + frame.height - (drawingRegion.y + drawingRegion.height));
    };

    // One gap (0.5em) between the canvas's bottom and the editor's, give or take a pixel of rounding.
    await expect.poll(fillsToBottom, 'the canvas ends inside the editor, not past it').toBeGreaterThanOrEqual(0);
    expect(await fillsToBottom(), 'and reaches its bottom').toBeLessThanOrEqual(0.5 * PARAGRAPH_PX + 1);
  });

  test('an element focused in the canvas is revealed below the message row, not under it (WCAG 2.4.11)', async ({ page }) => {
    const editor = await openContainerEditor(page);
    for (let click = 0; click < 10; click += 1) await editor.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await option(editor, 'Planner Web App').focus();
    await showMessage(page, { text: 'Error: That name is taken.', kind: 'refusal' });
    // Scroll the canvas so the element before it in reading order lies just under the canvas's top edge.
    const student = option(editor, 'Student');
    await canvas(editor).evaluate((region, top) => { region.scrollTop += top - region.getBoundingClientRect().top - 10; },
      (await student.boundingBox()).y);

    await page.keyboard.press('ArrowLeft');

    await expect(student).toBeFocused();
    const [row, focused] = await Promise.all([messageRegion(editor).boundingBox(), student.boundingBox()]);
    expect(focused.y, 'the focused element starts below the message row').toBeGreaterThanOrEqual(row.y + row.height);
  });

  test('a focused element that a wrapped instruction would cover is revealed below it, at 320 px (WCAG 2.4.11)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    const editor = await openContainerEditor(page);
    // The smallest magnification, with the canvas at its top: the drawing cannot simply be scrolled down to the element.
    for (let click = 0; click < 8; click += 1) await editor.getByRole('button', { name: 'Zoom out', exact: true }).click();
    await expect(editor.getByRole('group', { name: 'Magnification' }).getByRole('status')).toHaveText('25%');
    const student = option(editor, 'Student');
    await student.focus();

    await page.keyboard.press('m');

    await expect(message(editor)).toHaveText(/^Moving Student:/);
    expect((await messageRegion(editor).boundingBox()).height, 'the instruction wraps over several lines').toBeGreaterThan(2 * 1.4 * PARAGRAPH_PX);
    await expect(student).toBeFocused();
    await expect.poll(() => spaceBelowMessage(editor, student), 'the focused element starts below the message').toBeGreaterThanOrEqual(0);
  });

  test('a refusal shown over the focused name field, which lay wholly under the empty row, moves the field below it (WCAG 2.4.11)', async ({ page }) => {
    const editor = await openContainerEditor(page);
    await option(editor, 'Student').focus();
    await page.keyboard.press('F2');
    const field = renameField(editor, 'Student');
    await expect(field).toBeFocused();
    // The learner scrolls the canvas until the field lies wholly in the empty row at its top, where it still shows.
    await scrollCanvasUntil(editor, field, 5);
    const [emptyRow, placed] = await Promise.all([messageRegion(editor).boundingBox(), field.boundingBox()]);
    expect(placed.y + placed.height, 'the field lies within the row').toBeLessThanOrEqual(emptyRow.y + emptyRow.height);

    // A refusal that fits the row: the row keeps its height, only what it shows changes.
    await showMessage(page, { text: 'Error: That name is taken.', kind: 'refusal' });

    await expect(message(editor)).toHaveText('Not done: That name is taken.');
    expect((await messageRegion(editor).boundingBox()).height, 'the refusal is one line').toBeCloseTo(emptyRow.height, 0);
    await expect(field).toBeFocused();
    await expect.poll(() => spaceBelowMessage(editor, field), 'the focused field starts below the message').toBeGreaterThanOrEqual(0);
  });

  test('a focused element that still shows below a longer message stays where it is: the drawing does not move under the pointer', async ({ page }) => {
    const editor = await openContainerEditor(page);
    const student = option(editor, 'Student');
    await student.focus();
    await scrollCanvasUntil(editor, student, 10);
    const before = await student.boundingBox();

    await showMessage(page, { text: LONG_REFUSAL, kind: 'refusal' });

    await expect(regionButton(editor, 'Dismiss')).toBeVisible();
    const row = await messageRegion(editor).boundingBox();
    expect(before.y, 'the message covers the top of the focused element').toBeLessThan(row.y + row.height);
    expect(before.y + before.height, 'but not all of it (WCAG 2.4.11)').toBeGreaterThan(row.y + row.height);
    expect(await student.boundingBox(), 'which stays where it was').toEqual(before);
  });

  test('a focused element the learner scrolled out of the canvas stays out of view when a message appears: the drawing does not move', async ({ page }) => {
    const editor = await openContainerEditor(page);
    const student = option(editor, 'Student');
    await student.focus();
    await scrollCanvasUntil(editor, student, -((await student.boundingBox()).height + 10));
    const [frame, placed] = await Promise.all([canvas(editor).boundingBox(), student.boundingBox()]);
    expect(placed.y + placed.height, 'the focused element lies above the canvas\'s top edge').toBeLessThan(frame.y);
    const before = await drawingBox(editor);

    await showMessage(page, { text: LONG_REFUSAL, kind: 'refusal' });

    await expect(regionButton(editor, 'Dismiss')).toBeVisible();
    await expect(student).toBeFocused();
    expect(await drawingBox(editor), 'the drawing stays where it was').toEqual(before);
  });

  test('the name field of an element under a message opens below the message (WCAG 2.4.11)', async ({ page }) => {
    const editor = await openContainerEditor(page);
    await showMessage(page, { text: 'Error: That name is taken.', kind: 'refusal' });
    await option(editor, 'Student').focus();
    await scrollCanvasUntil(editor, option(editor, 'Student'), 10);

    await page.keyboard.press('F2');

    const field = renameField(editor, 'Student');
    await expect(field).toBeFocused();
    await expect.poll(() => spaceBelowMessage(editor, field), 'the focused field starts below the message').toBeGreaterThanOrEqual(0);
  });

  test('a press on the message\'s text reaches the drawing beneath; its buttons take their own', async ({ page }) => {
    const editor = await openContainerEditor(page);
    await showMessage(page, { text: 'Error: That name is taken.', kind: 'refusal', offer: COMPONENTS_OFFER });
    const pressed = (locator) => locator.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return { canvas: Boolean(hit && hit.closest('[role="region"][aria-label^="Canvas"]')), self: element.contains(hit) };
    });

    expect(await pressed(message(editor)), 'the text lets the press through to the canvas').toEqual({ canvas: true, self: false });
    expect(await pressed(regionButton(editor, 'Dismiss')), 'Dismiss takes its press').toEqual({ canvas: false, self: true });
  });

  test('print hides the region', async ({ page }) => {
    const editor = await openContainerEditor(page, LOCKED_DATABASE);
    await refuseDeletingTheDatabase(page, editor);
    await expect(messageRegion(editor)).toBeVisible();

    await page.emulateMedia({ media: 'print' });

    const anyRegion = editor.getByRole('region', { name: 'Messages', exact: true, includeHidden: true });
    await expect(anyRegion, 'the region is still there').toHaveCount(1);
    await expect(anyRegion).toBeHidden();
  });

  test('printing while a long message is shown leaves the drawing where it was on screen', async ({ page }) => {
    const editor = await openContainerEditor(page);
    await showMessage(page, { text: LONG_REFUSAL, kind: 'refusal' });
    await expect(regionButton(editor, 'Dismiss')).toBeVisible();
    const before = await drawingBox(editor);

    await page.emulateMedia({ media: 'print' });
    await expect(messageRegion(editor)).toHaveCount(0);
    await page.emulateMedia({ media: 'screen' });

    await expect(messageRegion(editor)).toBeVisible();
    await expect.poll(() => drawingBox(editor), 'the drawing is back where it was').toEqual(before);
  });
});

test.describe('a message stays until something replaces or clears it', () => {
  test('a message is still shown after the clock moves 60 seconds', async ({ page }) => {
    await page.clock.install();
    const editor = await openContainerEditor(page, LOCKED_DATABASE);
    await refuseDeletingTheDatabase(page, editor);
    await expect(message(editor)).toContainText('Registration Database');
    const shown = await message(editor).textContent();

    await page.clock.runFor(60_000);

    await expect(message(editor)).toHaveText(shown || '');
    await expect(regionButton(editor, 'Dismiss')).toBeVisible();
  });

  const CLEARING = [
    {
      way: 'a successful edit',
      async clear(page, editor) {
        await option(editor, 'Planner Web App').focus();
        await page.keyboard.press('F2');
        await renameField(editor, 'Planner Web App').fill('Course Planner');
        await page.keyboard.press('Enter');
        await expect(option(editor, 'Course Planner'), 'the rename is made').toBeVisible();
      },
    },
    {
      way: 'another view',
      async clear(page, editor) {
        await editor.getByRole('group', { name: 'View', exact: true }).getByRole('button', { name: 'Context', exact: true }).click();
        await expect(canvas(editor)).toHaveAccessibleName('Canvas: System context view: Course Registration');
      },
    },
    {
      way: 'Dismiss',
      async clear(page, editor) {
        await regionButton(editor, 'Dismiss').click();
      },
    },
  ];

  test.describe('a successful edit, another view, and Dismiss each clear it', () => {
    for (const { way, clear } of CLEARING) {
      test(`a refusal leaves the region after ${way}`, async ({ page }) => {
        const editor = await openContainerEditor(page, LOCKED_DATABASE);
        await refuseDeletingTheDatabase(page, editor);
        await expect(message(editor)).not.toHaveText('');

        await clear(page, editor);

        await expect(message(editor)).toHaveText('');
        await expect(regionButton(editor, 'Dismiss')).toBeHidden();
      });
    }
  });
});

test.describe('refusals', () => {
  test('a refusal shows the label "Not done:" and an icon', async ({ page }) => {
    const editor = await openContainerEditor(page, LOCKED_DATABASE);
    await refuseDeletingTheDatabase(page, editor);

    const label = messageRegion(editor).getByText('Not done:', { exact: true });
    await expect(label).toBeVisible();
    await expect(message(editor), 'the label comes before the sentence').toHaveText(/^Not done: Locked: Registration Database\b/);
    // The icon repeats the label without words, so it is hidden from assistive technology (WCAG 1.1.1, 1.4.1).
    const icon = label.locator('svg');
    await expect(icon).toBeVisible();
    await expect(icon).toHaveAttribute('aria-hidden', 'true');
    const box = await icon.boundingBox();
    expect(box && box.width, 'the icon is about as large as the text').toBeGreaterThanOrEqual(0.75 * PARAGRAPH_PX);
  });

  test('an existing refusal is announced with its words unchanged, and Error is not repeated after the label', async ({ page }) => {
    const editor = await openContainerEditor(page);
    await option(editor, 'Registration API').focus();
    await page.keyboard.press('F2');
    await renameField(editor, 'Registration API').fill('');
    await page.keyboard.press('Enter');

    // The rename field shows the action's own refusal: the words the live region must keep.
    const field = renameField(editor, 'Registration API');
    await expect(field).toHaveAccessibleDescription(/^Error: /);
    const words = await field.evaluate((input) => document.getElementById(input.getAttribute('aria-describedby')).textContent);
    expect(await lastAnnounced(page)).toBe(words);
    await expect(spoken(editor, words)).toHaveCount(1);
    await expect(message(editor)).toHaveText(`Not done: ${words.replace(/^Error: /, '')}`);
    await expect(message(editor)).not.toContainText('Error');
  });

  test('a refusal that does not say it is one is announced with "Not done:" before it', async ({ page }) => {
    const editor = await openContainerEditor(page);
    const sentence = 'This design model records no compositions.';

    await showMessage(page, { text: sentence, kind: 'refusal' });

    await expect.poll(() => lastAnnounced(page)).toBe(`Not done: ${sentence}`);
    await expect(message(editor)).toHaveText(`Not done: ${sentence}`);
  });

  test('a refusal leaves focus where it was', async ({ page }) => {
    const editor = await openContainerEditor(page, LOCKED_DATABASE);
    await refuseDeletingTheDatabase(page, editor);
    await expect(regionButton(editor, 'Dismiss')).toBeVisible();
    await expect(option(editor, 'Registration Database')).toBeFocused();
  });
});

test.describe('the offer and Dismiss', () => {
  test('Shift+Tab from the canvas reaches Dismiss, then the offer, which works from the keyboard', async ({ page }) => {
    const editor = await openContainerEditor(page);
    await showMessage(page, { text: 'Error: This view keeps no positions.', kind: 'refusal', offer: COMPONENTS_OFFER });
    await canvas(editor).focus();

    await page.keyboard.press('Shift+Tab');
    await expect(regionButton(editor, 'Dismiss')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(regionButton(editor, COMPONENTS_OFFER.label)).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(canvas(editor), 'the offer did what it says').toHaveAccessibleName(COMPONENTS_CANVAS);
    await expect(message(editor), 'accepting the offer ends the message').toHaveText('');
  });

  test('accepting an offer ends its message and gives focus back, also when its action keeps the view and the document', async ({ page }) => {
    const editor = await openContainerEditor(page);
    const offer = { label: 'Select Registration API', select: 'api' };
    await showMessage(page, { text: 'Error: Choose an element first.', kind: 'refusal', offer });
    await canvas(editor).focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Shift+Tab');

    await page.keyboard.press('Enter');

    await expect(option(editor, 'Registration API'), 'the offer did what it says').toHaveAttribute('aria-selected', 'true');
    await expect(message(editor)).toHaveText('');
    await expect(canvas(editor), 'focus goes back to the control it came from').toBeFocused();
  });

  test('a message without an offer that replaces one with an offer keeps focus in the region, on Dismiss', async ({ page }) => {
    const editor = await openContainerEditor(page);
    await showMessage(page, { text: 'Error: This view keeps no positions.', kind: 'refusal', offer: COMPONENTS_OFFER });
    await regionButton(editor, COMPONENTS_OFFER.label).focus();

    await showMessage(page, { text: 'Error: That name is taken.', kind: 'refusal' });

    await expect(regionButton(editor, 'Dismiss')).toBeFocused();
  });

  test('the announcement of a message with an offer ends with the offer\'s label', async ({ page }) => {
    await openContainerEditor(page);

    await showMessage(page, { text: 'Error: This view keeps no positions.', kind: 'refusal', offer: COMPONENTS_OFFER });

    await expect.poll(() => lastAnnounced(page)).toBe(`Error: This view keeps no positions. ${COMPONENTS_OFFER.label}`);
  });

  test('Dismiss returns focus to the option that had it before the message\'s buttons', async ({ page }) => {
    const editor = await openContainerEditor(page, LOCKED_DATABASE);
    await refuseDeletingTheDatabase(page, editor);

    await regionButton(editor, 'Dismiss').click();

    await expect(option(editor, 'Registration Database')).toBeFocused();
    await expect(message(editor)).toHaveText('');
  });

  test('the buttons are described by the message they act on', async ({ page }) => {
    const editor = await openContainerEditor(page);

    await showMessage(page, { text: 'Error: This view keeps no positions.', kind: 'refusal', offer: COMPONENTS_OFFER });

    await expect(regionButton(editor, 'Dismiss')).toHaveAccessibleDescription('Not done: This view keeps no positions.');
    await expect(regionButton(editor, COMPONENTS_OFFER.label)).toHaveAccessibleDescription('Not done: This view keeps no positions.');
  });
});

test.describe('announcements', () => {
  const MESSAGES = [
    { name: 'a refusal', act: refuseDeletingTheDatabase, settings: LOCKED_DATABASE },
    {
      name: 'an instruction',
      settings: {},
      async act(page, editor) {
        await option(editor, 'Registration API').focus();
        await page.keyboard.press('m');
        await expect.poll(() => lastAnnounced(page)).toMatch(/^Moving Registration API:/);
      },
    },
  ];

  test.describe('each message is announced once in the live region and the visible region is not live', () => {
    for (const { name, act, settings } of MESSAGES) {
      test(`${name} is spoken once and shown in a region that is not live`, async ({ page }) => {
        const editor = await openContainerEditor(page, settings);

        await act(page, editor);

        const said = await lastAnnounced(page);
        await expect(message(editor)).not.toHaveText('');
        await expect(spoken(editor, said), 'the live region speaks it').toHaveCount(1);
        expect((await hostLog(page)).announced.filter((each) => each === said), 'it is announced once').toHaveLength(1);
        expect(await messageRegion(editor).evaluate((region) => region.closest('[aria-live], [role="status"], [role="alert"], [role="log"]') === null
          && region.querySelector('[aria-live], [role="status"], [role="alert"], [role="log"]') === null), 'nothing in or around the region is live').toBe(true);
      });
    }
  });
});

test.describe('C4-notation views (D6)', () => {
  test('Delete on a locked element of a container view shows its sentence in the region', async ({ page }) => {
    const editor = await openContainerEditor(page, LOCKED_DATABASE);

    await refuseDeletingTheDatabase(page, editor);

    await expect(message(editor)).toHaveText(`Not done: ${await lastAnnounced(page)}`);
  });

  test('Move mode\'s instruction in a container view appears in the region', async ({ page }) => {
    const editor = await openContainerEditor(page);
    await option(editor, 'Registration API').focus();

    await page.keyboard.press('m');

    await expect.poll(() => lastAnnounced(page)).toMatch(/^Moving Registration API:/);
    await expect(message(editor)).toHaveText(await lastAnnounced(page));
    await expect(messageRegion(editor).getByText('Not done:')).toHaveCount(0);
  });

  test('when Move mode ends, its instruction leaves the region', async ({ page }) => {
    const editor = await openContainerEditor(page);
    await option(editor, 'Registration API').focus();
    await page.keyboard.press('m');
    await expect(message(editor)).toHaveText(/^Moving Registration API:/);

    await page.keyboard.press('Escape');

    await expect.poll(() => lastAnnounced(page)).toMatch(/^Move canceled/);
    await expect(message(editor)).toHaveText('');
  });

  test('Add relationship\'s instruction appears in the region, and a target it cannot end at shows its refusal there', async ({ page }) => {
    const editor = await openContainerEditor(page);
    await option(editor, 'Registration API').focus();
    await page.keyboard.press('c');
    await expect.poll(() => lastAnnounced(page)).toMatch(/^Adding a relationship from Registration API:/);
    await expect(message(editor)).toHaveText(await lastAnnounced(page));

    // Enter on the source itself: a relationship never points an element at itself.
    await page.keyboard.press('Enter');

    await expect.poll(() => lastAnnounced(page)).toMatch(/^Error: /);
    await expect(message(editor)).toHaveText(`Not done: ${(await lastAnnounced(page)).replace(/^Error: /, '')}`);
  });
});

test.describe('the message region: axe finds no WCAG 2.2 AA violation', () => {
  for (const width of [320, 1440]) {
    test(`with a refusal and an offer shown, at ${width} px, in light and dark mode`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const editor = await openContainerEditor(page);
      await showMessage(page, { text: 'Error: This view keeps no positions for its boxes.', kind: 'refusal', offer: COMPONENTS_OFFER });
      await expect(regionButton(editor, COMPONENTS_OFFER.label)).toBeVisible();

      await auditInteractiveState(page, `C4 editor message region at ${width} px`, { include: '#editor' });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'the page does not scroll sideways (WCAG 1.4.10)').toBe(true);
    });
  }
});

test.describe('the refusal table of the UML-notation views (spec §5.1) and Help', () => {
  test('every refusal of the table, shown through the message region\'s show, displays its sentence in the region and is announced once in the live region', async ({ page }) => {
    const editor = await openContainerEditor(page);

    for (const { code } of REFUSALS.rows) {
      const heardBefore = (await hostLog(page)).announced.length;
      const sentence = await page.evaluate(({ refused, values }) => {
        const verdict = window.ArchUMLC4EditorParts.umlRefusals.verdict(refused, values);
        const offer = verdict.offer && { label: verdict.offer.label, run() {} };
        window.messageRegions[0].show({ text: verdict.message, kind: 'refusal', offer });
        return verdict.message;
      }, { refused: code, values: REFUSAL_VALUES[code] });

      // The region shows the label in its own element, so a sentence that begins "Error:" is shown without that word.
      const shown = sentence.replace(/^Error:\s*/, '');
      await expect.soft(message(editor), `${code}: the region shows the sentence after "Not done:"`).toHaveText(`Not done: ${shown}`);
      const heard = (await hostLog(page)).announced.slice(heardBefore);
      expect.soft(heard, `${code}: it is announced once`).toHaveLength(1);
      expect.soft(heard[0] || '', `${code}: the announcement carries the sentence`).toContain(sentence);
      await expect.soft(spoken(editor, sentence), `${code}: the live region speaks it`).toHaveCount(1);
    }
  });

  test(`Help lists every refusal under "${NOT_AVAILABLE}"`, async ({ page }) => {
    const editor = await openContainerEditor(page);

    await editor.getByRole('button', { name: 'Help', exact: true }).click();

    const help = editor.getByRole('dialog', { name: 'C4 editor help' });
    await expect(help.getByRole('heading', { name: NOT_AVAILABLE, level: 3 })).toBeVisible();
    const rows = await page.evaluate(() => window.ArchUMLC4EditorParts.umlRefusals.helpRows());
    expect(rows.map((row) => row.code), 'one row for each code of the table').toEqual(REFUSALS.rows.map((row) => row.code));
    const items = help.getByRole('list', { name: NOT_AVAILABLE }).getByRole('listitem');
    await expect(items).toHaveCount(rows.length);
    for (const [index, row] of rows.entries()) {
      await expect.soft(items.nth(index), `${row.code}: its sentence`).toContainText(row.message);
      if (row.summary !== null) await expect.soft(items.nth(index), `${row.code}: its short reason`).toContainText(row.summary);
    }
  });

  // The list of refusals makes Help many times taller than the window, and Close follows it. Help must still open at
  // its top (title, introduction, keys), with focus on something the learner can see.
  for (const width of [320, 1440]) {
    test(`Help opens at its top at ${width} px: its title is in view and focus is on something in view`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const editor = await openContainerEditor(page);

      await editor.getByRole('button', { name: 'Help', exact: true }).click();

      const help = editor.getByRole('dialog', { name: 'C4 editor help' });
      await expect(help.getByRole('heading', { name: NOT_AVAILABLE, level: 3 })).toBeAttached();
      expect(await help.evaluate((dialog) => dialog.scrollHeight > dialog.clientHeight), 'Help is taller than the window, so where it opens matters').toBe(true);
      await expect(help.getByRole('heading', { name: 'C4 editor help', level: 2 }), 'the title is in view').toBeInViewport({ ratio: 1 });
      await expect(help.locator(':focus'), 'focus is inside Help and in view').toBeInViewport();
    });
  }

  for (const width of [320, 1440]) {
    test(`axe finds no WCAG 2.2 AA violation in Help with its list of refusals, at ${width} px, in light and dark mode`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const editor = await openContainerEditor(page);
      await editor.getByRole('button', { name: 'Help', exact: true }).click();
      await expect(editor.getByRole('dialog', { name: 'C4 editor help' }).getByRole('heading', { name: NOT_AVAILABLE })).toBeVisible();

      await auditInteractiveState(page, `C4 editor Help at ${width} px`, { include: '#editor' });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'the page does not scroll sideways (WCAG 1.4.10)').toBe(true);
    });
  }
});
