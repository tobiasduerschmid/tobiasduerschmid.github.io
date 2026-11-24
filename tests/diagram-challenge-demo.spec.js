// @ts-check
const { test, expect } = require('@playwright/test');
const { loadTutorialConfig } = require('./tutorial-helpers');
const { a11yCheckpoint } = require('./a11y-helpers');

// Runtime features for multi-folder design-question tutorials: shared and
// read-only files, the Files tree, project search, the authored-diagram
// pane, and diagram challenges. The demo tutorial is the fixture: step 1 is
// a code-first challenge, step 2 adds a view prediction, a contrast view,
// and an evidence check, and step 3 is plan-first with the results card.
const DEMO = '/SEBook/tools/diagram-challenge-demo';
const URL = DEMO + '?autosave=false';
const config = loadTutorialConfig('diagram-challenge-demo');
const BOOT_TIMEOUT = 90_000;
const sharedFile = path => config.shared_files.find(file => file.path === path).content;

async function waitForBoot(page) {
  await expect(page.locator('.tvm-loading')).toBeHidden({ timeout: BOOT_TIMEOUT });
  await expect(page.getByRole('button', { name: /^▶\s*Run$/ })).toBeEnabled({ timeout: BOOT_TIMEOUT });
}

/** @param {string} [hash] a step deep link such as '#review' */
async function openDemo(page, hash = '') {
  await page.goto(URL + hash);
  await waitForBoot(page);
}

/** Editor contents are the oracle for edits; Monaco's view only renders lines in view. */
async function fileText(page, path) {
  return page.evaluate(target => window._tutorial.editorModels[target].model.getValue(), path);
}

function codeEditor(page) {
  return page.getByRole('textbox', { name: /code editor/ }).first();
}

test.describe('shared and read-only files', () => {
  test('typing into a read-only file leaves it unchanged', async ({ page }) => {
    await openDemo(page);
    await codeEditor(page).focus();
    await page.keyboard.type('broken = True');

    // Monaco shows the message beside the cursor and announces it as an alert.
    await expect(page.getByRole('alert').filter({ hasText: 'This file is read-only in this tutorial.' })).toHaveCount(1);
    expect(await fileText(page, 'scenario.py')).toBe(sharedFile('scenario.py'));
  });

  test('a step marked readonly locks files that other steps leave editable', async ({ page }) => {
    // Step 1's diagram challenge gates Next, so open step 2 by its deep link.
    await openDemo(page, '#review');
    await expect(page.getByRole('heading', { name: 'Review Without Editing' })).toBeVisible();
    await page.getByRole('treeitem', { name: 'notes.md', exact: true }).click();
    await codeEditor(page).focus();
    await page.keyboard.type('edited in review');

    await expect(page.getByRole('alert').filter({ hasText: 'This file is read-only in this tutorial.' })).toHaveCount(1);
    expect(await fileText(page, 'notes.md')).toBe(sharedFile('notes.md'));
  });

  test('Run still executes a read-only file', async ({ page }) => {
    await openDemo(page);
    await page.getByRole('button', { name: /^▶\s*Run$/ }).click();

    await expect(page.getByRole('region', { name: 'Program output', exact: true }))
      .toContainText('Order A-100 sent to: partner-gateway, trip-site-notifications, warehouse-etl', { timeout: BOOT_TIMEOUT });
  });
});

function fileTree(page) {
  return page.getByRole('tree', { name: 'Files' });
}

function treeItem(page, name) {
  return fileTree(page).getByRole('treeitem', { name, exact: true });
}

function fileTabs(page) {
  return page.getByRole('group', { name: /^File tabs/ });
}

test.describe('Files tree', () => {
  test('tree is a role=tree with aria-expanded folders', async ({ page }) => {
    await openDemo(page);

    await expect(fileTree(page)).toBeVisible();
    await expect(treeItem(page, 'services')).toHaveAttribute('aria-expanded', 'true');
    await expect(treeItem(page, 'opc')).toHaveAttribute('aria-expanded', 'false');
    await expect(treeItem(page, 'scenario.py')).toHaveAttribute('aria-selected', 'true');
    await expect(treeItem(page, 'scenario.py')).not.toHaveAttribute('aria-expanded');
    await a11yCheckpoint(page, 'diagram-challenge-demo: files tree');
  });

  test('ArrowDown/ArrowRight/Enter open a nested file and add one tab', async ({ page }) => {
    await openDemo(page);
    await treeItem(page, 'scenario.py').focus();

    await page.keyboard.press('Home');
    await expect(treeItem(page, 'deploy')).toBeFocused();
    // deploy, broker.toml, infra, __init__.py, bus.py, services, opc
    for (let row = 0; row < 6; row++) await page.keyboard.press('ArrowDown');
    await expect(treeItem(page, 'opc')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(treeItem(page, 'opc')).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('ArrowRight');
    await expect(treeItem(page, 'partners')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await expect(treeItem(page, 'glamping_co.py')).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(fileTabs(page).getByRole('button', { name: 'services/opc/partners/glamping_co.py', exact: true }))
      .toHaveAttribute('aria-current', 'true');
    await expect(fileTabs(page).getByRole('button', { name: /^Close / })).toHaveCount(2);
    await expect(treeItem(page, 'glamping_co.py')).toHaveAttribute('aria-selected', 'true');
  });

  test('ArrowLeft collapses an open folder and then moves to its parent', async ({ page }) => {
    await openDemo(page);
    await treeItem(page, 'bus.py').focus();

    await page.keyboard.press('ArrowLeft');
    await expect(treeItem(page, 'infra')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(treeItem(page, 'infra')).toHaveAttribute('aria-expanded', 'false');
    await expect(fileTree(page).getByRole('treeitem', { name: 'bus.py', exact: true, includeHidden: true })).toBeHidden();
  });

  test('closing a tab keeps the model and the draft', async ({ page }) => {
    await openDemo(page);
    await treeItem(page, 'notes.md').click();
    await codeEditor(page).focus();
    await page.keyboard.type('broker.toml binds three queues. ');

    await fileTabs(page).getByRole('button', { name: 'Close notes.md', exact: true }).click();
    await expect(fileTabs(page).getByRole('button', { name: 'notes.md', exact: true })).toHaveCount(0);
    await expect(fileTabs(page).getByRole('button', { name: 'scenario.py', exact: true })).toHaveAttribute('aria-current', 'true');

    await treeItem(page, 'notes.md').click();
    await expect(fileTabs(page).getByRole('button', { name: 'notes.md', exact: true })).toHaveAttribute('aria-current', 'true');
    expect(await fileText(page, 'notes.md')).toBe('broker.toml binds three queues. ' + sharedFile('notes.md'));
  });

  test('narrow viewport shows the tree as a disclosure above the editor', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openDemo(page);
    const disclosure = page.locator('summary', { hasText: 'Files' });

    await expect(disclosure).toBeVisible();
    await expect(page.getByRole('tree', { name: 'Files', includeHidden: true })).toBeHidden();
    await disclosure.click();
    await expect(fileTree(page)).toBeVisible();
    const disclosureBox = await disclosure.boundingBox();
    const tabsBox = await fileTabs(page).boundingBox();
    expect(disclosureBox.y + disclosureBox.height).toBeLessThanOrEqual(tabsBox.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await a11yCheckpoint(page, 'diagram-challenge-demo: narrow files disclosure');
  });
});

test.describe('project search', () => {
  test('Ctrl/Cmd+Shift+F opens search and a result opens the file at its line', async ({ page }) => {
    await openDemo(page);
    await codeEditor(page).focus();
    await page.keyboard.press('ControlOrMeta+Shift+F');
    const query = page.getByLabel('Search all files', { exact: true });
    await expect(query).toBeFocused();

    await query.fill('order.placed');
    await page.getByRole('list', { name: 'Search results' }).getByRole('button', { name: /^Line 8\b/ }).click();

    await expect(fileTabs(page).getByRole('button', { name: 'deploy/broker.toml', exact: true }))
      .toHaveAttribute('aria-current', 'true');
    await expect(codeEditor(page)).toBeFocused();
    expect(await page.evaluate(() => window._tutorial.editor.getPosition().lineNumber)).toBe(8);
    await expect(treeItem(page, 'broker.toml')).toHaveAttribute('aria-selected', 'true');
  });

  test('result count is announced in a status region', async ({ page }) => {
    await openDemo(page);
    await page.getByRole('button', { name: 'Search files', exact: true }).click();
    await page.getByLabel('Search all files', { exact: true }).fill('order.placed');

    await expect(page.getByRole('region', { name: 'Project search' }).getByRole('status'))
      .toHaveText('2 results in 2 files.');
    await a11yCheckpoint(page, 'diagram-challenge-demo: search results');
  });

  test('Escape closes search and returns focus to the control that opened it', async ({ page }) => {
    await openDemo(page);
    const toggle = page.getByRole('button', { name: 'Search files', exact: true });
    await toggle.click();
    await page.keyboard.press('Escape');

    await expect(page.getByRole('region', { name: 'Project search' })).toBeHidden();
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('the field and its three option toggles share one row, which stays in view while the results scroll', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDemo(page);
    const toggle = page.getByRole('button', { name: 'Search files', exact: true });
    await toggle.click();
    const field = page.getByLabel('Search all files', { exact: true });
    await field.fill('e');
    await expect(page.getByRole('region', { name: 'Project search' }).getByRole('status')).toHaveText(/ results in /);

    const row = await field.boundingBox();
    for (const name of ['Match case', 'Whole word', 'Regular expression']) {
      const box = await page.getByRole('checkbox', { name, exact: true }).boundingBox();
      const middle = box.y + box.height / 2;
      expect(middle, `${name} is on the field's row`).toBeGreaterThan(row.y);
      expect(middle, `${name} is on the field's row`).toBeLessThan(row.y + row.height);
    }
    const scrolled = await field.evaluate(element => {
      const sidebar = element.closest('details');
      sidebar.scrollTop = sidebar.scrollHeight;
      return sidebar.scrollTop;
    });
    expect(scrolled, 'the results are long enough to scroll the sidebar').toBeGreaterThan(0);
    await expect(field).toBeInViewport({ ratio: 1 });
    await expect(toggle).toBeInViewport({ ratio: 1 });
  });

  test('an option toggle changes the results', async ({ page }) => {
    await openDemo(page);
    await page.getByRole('button', { name: 'Search files', exact: true }).click();
    await page.getByLabel('Search all files', { exact: true }).fill('order.*');
    const status = page.getByRole('region', { name: 'Project search' }).getByRole('status');
    await expect(status).toHaveText(/ results? in /);
    const literal = await status.textContent();

    await page.getByRole('checkbox', { name: 'Regular expression', exact: true }).check();

    // As a regular expression, .* matches the rest of every line with "order".
    await expect(status).not.toHaveText(literal);
    await expect(page.getByRole('checkbox', { name: 'Regular expression', exact: true })).toBeChecked();
  });

  test('the Files sidebar widens while search is open and narrows when it closes', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDemo(page);
    const sidebar = page.locator('details', { has: page.locator('summary', { hasText: /^Files$/ }) });
    const width = async () => (await sidebar.boundingBox()).width;
    const closed = await width();

    await page.getByRole('button', { name: 'Search files', exact: true }).click();
    await expect.poll(width).toBeGreaterThan(closed + 30);

    await page.keyboard.press('Escape');
    await expect.poll(width).toBeLessThan(closed + 1);
  });
});

const ORDER_EVENTS = {
  id: 'events',
  label: 'Order events',
  type: 'component',
  source: '@startuml\ncomponent TripWebsite\ncomponent OPC\ncomponent Broker\ncomponent WarehouseETL\n' +
    'TripWebsite --> OPC : place order\nOPC --> Broker : order.placed\nBroker --> WarehouseETL : #\n@enduml',
};
const ORDER_CLASSES = {
  id: 'classes',
  label: 'Classes',
  type: 'class',
  source: '@startuml\nclass OrderService {\n  +place(order_id)\n}\nclass Bus {\n  +receivers(topic)\n}\nOrderService --> Bus\n@enduml',
};
const CHECKOUT_CALLS = {
  id: 'checkout',
  label: 'Checkout calls',
  type: 'sequence',
  source: '@startuml\nparticipant Checkout\nparticipant OrderService\nparticipant Bus\n' +
    'Checkout -> OrderService : place("A-100")\nOrderService -> Bus : receivers("order.placed")\n@enduml',
};

// Taller than ORDER_EVENTS, so at reading size it overflows the pane both ways.
const ORDER_FAN_OUT = {
  id: 'fan-out',
  label: 'Order fan-out',
  type: 'component',
  source: '@startuml\ncomponent TripWebsite\ncomponent OPC\ncomponent Broker\ncomponent WarehouseETL\n' +
    'component Loyalty\ncomponent Notifications\ncomponent SupportConsole\ncomponent AffiliateRelay\n' +
    'TripWebsite --> OPC : place order\nOPC --> Broker : order.placed\nBroker --> WarehouseETL : #\n' +
    'Broker --> Loyalty : trip.confirmed\nBroker --> Notifications : trip.*\n' +
    'Broker --> SupportConsole : trip.cancelled\nBroker --> AffiliateRelay : trip.*\n@enduml',
};
// The pane's zoom steps, as shares of the drawing's readable width.
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
const FIT_HINT = 'Click a part of the drawing to read it at full size, or use the + button.';

// includeHidden lets toBeHidden check what is painted, not only ARIA state.
function diagramPane(page, { includeHidden = false } = {}) {
  return page.getByRole('region', { name: 'Diagram', exact: true, includeHidden });
}

/** The scrollable drawing region, named by its auto-generated description. */
function componentDrawing(page) {
  return page.getByRole('region', { name: /^UML component diagram/ });
}

async function drawingWidth(drawing) {
  return (await drawing.locator('svg').boundingBox()).width;
}

// A drawing opens at the widest view in which its smallest label is still
// at least this size on screen (or whole, when that is already legible).
const MIN_LABEL_PX = 12;

/** The smallest label of the shown drawing, in CSS pixels on screen. */
function smallestLabelPx(drawing) {
  return drawing.evaluate(region => Math.min(...[...region.querySelectorAll(':scope > svg text')]
    .filter(label => label.textContent.trim())
    .map(label => {
      const matrix = label.getScreenCTM();
      return parseFloat(getComputedStyle(label).fontSize) * Math.hypot(matrix.c, matrix.d);
    })));
}

/** Whether the whole drawing lies inside the scrollable region's view. */
function wholeDrawingShown(drawing) {
  return drawing.evaluate(region => {
    const box = region.querySelector(':scope > svg').getBoundingClientRect();
    const view = region.getBoundingClientRect();
    return box.left >= view.left - 1 && box.top >= view.top - 1 &&
      box.right <= view.left + region.clientWidth + 1 && box.bottom <= view.top + region.clientHeight + 1;
  });
}

function scrollOffsets(drawing) {
  return drawing.evaluate(region => ({
    left: region.scrollLeft,
    top: region.scrollTop,
    maxLeft: region.scrollWidth - region.clientWidth,
    maxTop: region.scrollHeight - region.clientHeight,
  }));
}

function fitButton(page) {
  return diagramPane(page).getByRole('button', { name: 'Fit whole drawing', exact: true });
}

function readingSizeButton(page) {
  return diagramPane(page).getByRole('button', { name: 'Zoom to 100%', exact: true });
}

/** The zoom the pane shows between its zoom buttons, which also describes them. */
async function expectZoom(page, shown) {
  await expect(diagramPane(page).getByRole('button', { name: 'Zoom in', exact: true })).toHaveAccessibleDescription(shown);
}

/** The drawing is fitted: whole, with Fit unavailable because it is the current view. */
async function expectFitted(page, drawing) {
  await expect(fitButton(page)).toHaveAttribute('aria-disabled', 'true');
  expect(await wholeDrawingShown(drawing)).toBe(true);
}

/**
 * Whether a drawing point (shares of the drawing's size) sits in the middle
 * of the scrollable region on each axis, or as near as scrolling allows: the
 * region is scrolled as far as it goes toward the point.
 */
async function middleAsFarAsScrollAllows(drawing, point) {
  return drawing.evaluate((region, { x, y }) => {
    const box = region.querySelector(':scope > svg').getBoundingClientRect();
    const view = region.getBoundingClientRect();
    const dx = box.left + x * box.width - (view.left + region.clientWidth / 2);
    const dy = box.top + y * box.height - (view.top + region.clientHeight / 2);
    const atLimit = (offset, scroll, max) => (offset > 0 ? scroll >= max - 1 : scroll <= 1);
    return {
      x: Math.abs(dx) <= 2 || atLimit(dx, region.scrollLeft, region.scrollWidth - region.clientWidth),
      y: Math.abs(dy) <= 2 || atLimit(dy, region.scrollTop, region.scrollHeight - region.clientHeight),
    };
  }, point);
}

/** @param {{layout?: 'split'|'maximized'}} [options] */
async function showDiagrams(page, diagrams, options = {}) {
  await page.evaluate(([list, settings]) => window._tutorial.showAuthoredDiagrams(list, settings), [diagrams, options]);
}

function programOutput(page) {
  return page.getByRole('region', { name: 'Program output', exact: true });
}

function runButton(page) {
  return page.getByRole('button', { name: /^▶\s*Run$/ });
}

/** The Files disclosure's control: Playwright maps <details> to a group but gives its <summary> no role. */
function filesDisclosure(page) {
  return page.locator('summary', { hasText: /^Files$/ });
}

test.describe('authored-diagram pane', () => {
  test('Diagram button is disabled with an explanation before lock-in', async ({ page }) => {
    await openDemo(page);
    const reason = 'Lock in your answer to see the diagram.';
    await page.evaluate(text => window._tutorial.setDiagramPaneAvailable(false, text), reason);
    const diagramButton = page.getByRole('button', { name: 'Diagram', exact: true });

    await expect(diagramButton).toHaveAttribute('aria-disabled', 'true');
    await expect(diagramButton).toHaveAccessibleDescription(reason);
    await expect(page.getByText(reason, { exact: true })).toBeVisible();
    await diagramButton.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Editor', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(diagramPane(page, { includeHidden: true })).toBeHidden();
  });

  test('on a wide workspace the pane sits beside the editor and the editor stays visible', async ({ page }) => {
    await page.setViewportSize({ width: 2200, height: 1000 });
    await openDemo(page);
    await showDiagrams(page, [ORDER_EVENTS]);

    await expect(page.getByRole('button', { name: 'Diagram', exact: true })).toHaveAttribute('aria-pressed', 'true');
    const drawing = page.getByRole('region', { name: /^UML component diagram with 4 components/ });
    await expect(drawing).toBeVisible();
    await expect(page.getByRole('code').first()).toBeVisible();
    const editorBox = await fileTabs(page).boundingBox();
    const paneBox = await diagramPane(page).boundingBox();
    expect(paneBox.x).toBeGreaterThanOrEqual(editorBox.x + editorBox.width - 1);
    expect(Math.abs(paneBox.y - editorBox.y)).toBeLessThan(40);
    await a11yCheckpoint(page, 'diagram-challenge-demo: diagram pane');
  });

  test('three diagrams show as tabs', async ({ page }) => {
    await openDemo(page);
    await showDiagrams(page, [ORDER_EVENTS, ORDER_CLASSES, CHECKOUT_CALLS]);
    const tabs = page.getByRole('tablist', { name: 'Diagrams' });

    await expect(tabs.getByRole('tab')).toHaveCount(3);
    await expect(tabs.getByRole('tab', { name: 'Order events' })).toHaveAttribute('aria-selected', 'true');
    await tabs.getByRole('tab', { name: 'Order events' }).focus();
    await page.keyboard.press('ArrowRight');

    await expect(tabs.getByRole('tab', { name: 'Classes' })).toBeFocused();
    await expect(tabs.getByRole('tab', { name: 'Classes' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel', { name: 'Classes' })
      .getByRole('region', { name: /^UML class diagram with 2 classes/ })).toBeVisible();
  });

  test('a drawing too large to read whole opens at the widest legible zoom step, at its top-left corner', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDemo(page);
    await showDiagrams(page, [ORDER_FAN_OUT], { layout: 'maximized' });
    const pane = diagramPane(page);
    const drawing = componentDrawing(page);
    await expect(drawing).toBeVisible();

    expect(await smallestLabelPx(drawing)).toBeGreaterThanOrEqual(MIN_LABEL_PX - 0.1);
    expect(await wholeDrawingShown(drawing), 'the drawing is larger than the pane').toBe(false);
    const opening = await scrollOffsets(drawing);
    expect([opening.left, opening.top]).toEqual([0, 0]);
    await expect(fitButton(page)).not.toHaveAttribute('aria-disabled', 'true');

    // One step out the labels are no longer legible: it was the widest legible view.
    await pane.getByRole('button', { name: 'Zoom out', exact: true }).click();
    expect(await smallestLabelPx(drawing)).toBeLessThan(MIN_LABEL_PX);
  });

  test('a drawing that is legible whole opens whole, at Fit', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDemo(page);
    await showDiagrams(page, [ORDER_CLASSES], { layout: 'maximized' });
    const drawing = page.getByRole('region', { name: /^UML class diagram/ });
    await expect(drawing).toBeVisible();

    await expectFitted(page, drawing);
    expect(await smallestLabelPx(drawing)).toBeGreaterThanOrEqual(MIN_LABEL_PX - 0.1);
  });

  test('Fit and 100% are buttons for the whole drawing and the reading size, and Zoom in returns to the opening step', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDemo(page);
    await showDiagrams(page, [ORDER_FAN_OUT], { layout: 'maximized' });
    const pane = diagramPane(page);
    const drawing = componentDrawing(page);
    await expect(drawing).toBeVisible();
    const openingWidth = await drawingWidth(drawing);

    await readingSizeButton(page).click();
    await expect(readingSizeButton(page)).toBeFocused();
    await expect(readingSizeButton(page)).toHaveAttribute('aria-disabled', 'true');
    await expectZoom(page, '100%');
    // Reading size: the smallest label has the paragraph size.
    const paragraphPx = await drawing.evaluate(region => parseFloat(getComputedStyle(region).fontSize));
    expect(await smallestLabelPx(drawing)).toBeCloseTo(paragraphPx, 0);
    const readableWidth = await drawingWidth(drawing);

    await fitButton(page).click();
    await expect(fitButton(page)).toBeFocused();
    await expectFitted(page, drawing);
    await expect(readingSizeButton(page)).not.toHaveAttribute('aria-disabled', 'true');
    const fittedWidth = await drawingWidth(drawing);
    await expectZoom(page, `${Math.round((fittedWidth / readableWidth) * 100)}%`);

    // The opening view is a zoom step, so the zoom buttons reach it again.
    for (let step = 0; step < ZOOM_STEPS.length && await drawingWidth(drawing) < openingWidth - 1; step++) {
      await pane.getByRole('button', { name: 'Zoom in', exact: true }).click();
    }
    expect(await drawingWidth(drawing)).toBeCloseTo(openingWidth, 0);
  });

  test('zoom in from Fit steps up from the fitted size and keeps the middle of the drawing in view', async ({ page }) => {
    await openDemo(page);
    await showDiagrams(page, [ORDER_EVENTS]);
    const pane = diagramPane(page);
    const drawing = componentDrawing(page);
    await readingSizeButton(page).click();
    await expectZoom(page, '100%');
    const readableWidth = await drawingWidth(drawing);
    await fitButton(page).click();
    await expectFitted(page, drawing);
    const fittedWidth = await drawingWidth(drawing);
    const nextStep = ZOOM_STEPS.find(step => step > fittedWidth / readableWidth);

    await pane.getByRole('button', { name: 'Zoom in' }).click();

    await expect(pane.getByRole('button', { name: 'Zoom in' })).toBeFocused();
    await expectZoom(page, `${nextStep * 100}%`);
    expect(await drawingWidth(drawing)).toBeCloseTo(readableWidth * nextStep, 0);
    expect(await middleAsFarAsScrollAllows(drawing, { x: 0.5, y: 0.5 })).toEqual({ x: true, y: true });
  });

  test('zoom out never enlarges a fitted drawing, and from the smallest step it returns to Fit', async ({ page }) => {
    await openDemo(page);
    await showDiagrams(page, [ORDER_EVENTS]);
    const pane = diagramPane(page);
    const drawing = componentDrawing(page);
    const zoomOut = pane.getByRole('button', { name: 'Zoom out' });
    await fitButton(page).click();
    await expectFitted(page, drawing);
    const fittedWidth = await drawingWidth(drawing);

    await expect(zoomOut).toHaveAttribute('aria-disabled', 'true');
    // A dimmed button still takes a mouse click; it must change nothing.
    await zoomOut.click({ force: true });
    await expectFitted(page, drawing);
    expect(await drawingWidth(drawing)).toBeCloseTo(fittedWidth, 0);

    await pane.getByRole('button', { name: 'Zoom in' }).click();
    await expect(fitButton(page)).not.toHaveAttribute('aria-disabled', 'true');
    await zoomOut.click();
    await expectFitted(page, drawing);
    expect(await drawingWidth(drawing)).toBeCloseTo(fittedWidth, 0);
  });

  test('clicking a fitted drawing shows the clicked part at reading size', async ({ page }) => {
    // A pane large enough that a click on the fitted drawing lands within a
    // pixel of the point it means.
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDemo(page);
    await showDiagrams(page, [ORDER_FAN_OUT], { layout: 'maximized' });
    const pane = diagramPane(page);
    const drawing = componentDrawing(page);
    await readingSizeButton(page).click();
    const readableWidth = await drawingWidth(drawing);
    await fitButton(page).click();
    const fitted = await drawing.locator('svg').boundingBox();
    const clicked = { x: 0.6, y: 0.6 };

    await page.mouse.click(fitted.x + fitted.width * clicked.x, fitted.y + fitted.height * clicked.y);

    await expectZoom(page, '100%');
    await expect(drawing).toBeFocused();
    expect(await drawingWidth(drawing)).toBeCloseTo(readableWidth, 0);
    expect(await middleAsFarAsScrollAllows(drawing, clicked)).toEqual({ x: true, y: true });
    await expect(pane.getByRole('button', { name: 'Zoom out' })).not.toHaveAttribute('aria-disabled', 'true');
  });

  test('dragging the drawing moves it, a drag is not a click, and the arrow keys move it too', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDemo(page);
    await showDiagrams(page, [ORDER_FAN_OUT], { layout: 'maximized' });
    const drawing = componentDrawing(page);
    await expect(drawing).toBeVisible();
    expect(await drawing.evaluate(region => getComputedStyle(region).cursor)).toBe('grab');
    const view = await drawing.boundingBox();
    const start = { x: view.x + view.width * 0.6, y: view.y + view.height * 0.6 };
    const before = await scrollOffsets(drawing);
    const zoomBefore = await drawingWidth(drawing);

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x - 120, start.y - 80, { steps: 6 });
    await page.mouse.up();

    const after = await scrollOffsets(drawing);
    expect(after.left - before.left).toBeCloseTo(Math.min(120, before.maxLeft - before.left), -1);
    expect(after.top - before.top).toBeCloseTo(Math.min(80, before.maxTop - before.top), -1);
    expect(await drawingWidth(drawing), 'the drag did not zoom').toBeCloseTo(zoomBefore, 0);

    await drawing.focus();
    await page.keyboard.press('ArrowLeft');
    await expect.poll(async () => (await scrollOffsets(drawing)).left).toBeLessThan(after.left);
  });

  test('a drag across a fitted drawing does not zoom it the way a click does', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDemo(page);
    await showDiagrams(page, [ORDER_FAN_OUT], { layout: 'maximized' });
    const drawing = componentDrawing(page);
    await fitButton(page).click();
    const box = await drawing.locator('svg').boundingBox();

    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5, { steps: 5 });
    await page.mouse.up();

    await expectFitted(page, drawing);
  });

  test('a newly shown diagram starts from its opening view, not the previous zoom', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDemo(page);
    await showDiagrams(page, [ORDER_FAN_OUT], { layout: 'maximized' });
    const pane = diagramPane(page);
    const drawing = componentDrawing(page);
    await expect(drawing).toBeVisible();
    const openingWidth = await drawingWidth(drawing);
    await pane.getByRole('button', { name: 'Zoom in' }).click();
    expect(await drawingWidth(drawing)).toBeGreaterThan(openingWidth + 1);

    await showDiagrams(page, [ORDER_FAN_OUT], { layout: 'maximized' });

    expect(await drawingWidth(drawing)).toBeCloseTo(openingWidth, 0);
    const offsets = await scrollOffsets(drawing);
    expect([offsets.left, offsets.top]).toEqual([0, 0]);
  });

  test('the fit hint floats over a maximized drawing, and stays out of the way beside the code', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDemo(page);
    await showDiagrams(page, [ORDER_FAN_OUT], { layout: 'maximized' });
    const pane = diagramPane(page);
    const hint = pane.getByText(FIT_HINT, { exact: true });
    await fitButton(page).click();
    await expect(hint).toBeVisible();

    await pane.getByRole('button', { name: 'Code beside diagram' }).click();
    await expect(hint).toBeHidden();

    await pane.getByRole('button', { name: 'Code beside diagram' }).click();
    await expect(hint).toBeVisible();
    await pane.getByRole('button', { name: 'Zoom in' }).click();
    await expect(hint).toBeHidden();
  });

  test('the fit hint never covers the Code links control of a drawing with links', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDemo(page);
    await answerExploreFromCode(page);
    await lockIn(page);
    const pane = diagramPane(page);
    const hint = pane.getByText('Click a part of the drawing to read it at full size, or click an underlined name to open its code.', { exact: true });
    const summary = pane.locator('summary', { hasText: /^Code links$/ });
    await fitButton(page).click();
    await expect(hint).toBeVisible();
    await expect(summary).toBeVisible();

    const [hintBox, summaryBox] = [await hint.boundingBox(), await summary.boundingBox()];
    const overlaps = hintBox.x < summaryBox.x + summaryBox.width && summaryBox.x < hintBox.x + hintBox.width &&
      hintBox.y < summaryBox.y + summaryBox.height && summaryBox.y < hintBox.y + hintBox.height;
    expect(overlaps, `hint ${JSON.stringify(hintBox)} covers summary ${JSON.stringify(summaryBox)}`).toBe(false);
  });

  test('the pane enters and leaves full screen from its own button', async ({ page }) => {
    await openDemo(page);
    await showDiagrams(page, [ORDER_EVENTS]);
    const pane = diagramPane(page);

    await pane.getByRole('button', { name: 'Full screen', exact: true }).click();
    const exit = pane.getByRole('button', { name: 'Exit full screen', exact: true });
    await expect(exit).toHaveAttribute('aria-pressed', 'true');
    await exit.click();
    await expect(pane.getByRole('button', { name: 'Full screen', exact: true })).toHaveAttribute('aria-pressed', 'false');
  });

  test('hideAuthoredDiagrams returns to the editor and removes the Diagram view', async ({ page }) => {
    await openDemo(page);
    await showDiagrams(page, [ORDER_EVENTS]);
    await page.evaluate(() => window._tutorial.hideAuthoredDiagrams());

    await expect(diagramPane(page, { includeHidden: true })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Diagram', exact: true, includeHidden: true })).toBeHidden();
    await expect(page.getByRole('group', { name: 'Workspace view', includeHidden: true })).toBeHidden();
    await expect(page.getByRole('code').first()).toBeVisible();
  });

  test('at ≤900 px the pane stacks below the editor', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 900 });
    await openDemo(page);
    await showDiagrams(page, [ORDER_EVENTS]);

    await expect(diagramPane(page)).toBeVisible();
    const editorBox = await page.getByRole('code').first().boundingBox();
    const paneBox = await diagramPane(page).boundingBox();
    expect(paneBox.y).toBeGreaterThanOrEqual(editorBox.y + editorBox.height - 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
});

// Ctrl/Cmd+F belongs to the browser and to Monaco, except while focus is in
// the Diagram pane (or the Diagram view is shown and focus is elsewhere in the
// workspace outside the code editor), where it opens a find bar for the shown
// drawing. Ctrl/Cmd+Shift+F stays project search. Pinch zoom (wheel events
// with ctrlKey) zooms the drawing around the pointer instead of the page.
test.describe('diagram pane: find and pinch zoom', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  function findBar(page) {
    return diagramPane(page).getByRole('search', { name: 'Find in diagram' });
  }

  function findField(page) {
    return findBar(page).getByLabel('Find in diagram', { exact: true });
  }

  /** The drawing labels framed as matches, and the one marked current. */
  function marks(page) {
    return diagramPane(page).evaluate(pane => {
      const label = box => box.nextElementSibling.textContent.replace(/\s+/g, ' ').trim();
      const boxes = [...pane.querySelectorAll('rect.tutorial-diagram-pane__hit-box')];
      const current = boxes.filter(box => box.classList.contains('tutorial-diagram-pane__hit-box--current'));
      return {
        labels: boxes.map(label),
        current: current.map(label),
        currentStroke: current.length ? parseFloat(getComputedStyle(current[0]).strokeWidth) : 0,
        otherStroke: boxes.length > current.length
          ? parseFloat(getComputedStyle(boxes.find(box => !current.includes(box))).strokeWidth) : 0,
      };
    });
  }

  test('Ctrl/Cmd+F in the Diagram pane opens its find bar, not project search', async ({ page }) => {
    await openDemo(page);
    await showDiagrams(page, [ORDER_FAN_OUT], { layout: 'maximized' });
    await componentDrawing(page).focus();

    await page.keyboard.press('ControlOrMeta+F');

    await expect(findField(page)).toBeFocused();
    await expect(page.getByRole('region', { name: 'Project search' })).toBeHidden();
  });

  test('typing a label frames every match and reports the first of them', async ({ page }) => {
    await openDemo(page);
    await showDiagrams(page, [ORDER_FAN_OUT], { layout: 'maximized' });
    await componentDrawing(page).focus();
    await page.keyboard.press('ControlOrMeta+F');

    await findField(page).fill('trip.');

    await expect(findBar(page).getByRole('status')).toHaveText('1 of 4');
    const shown = await marks(page);
    expect([...shown.labels].sort()).toEqual(['trip.*', 'trip.*', 'trip.cancelled', 'trip.confirmed']);
    expect(shown.current).toHaveLength(1);
    expect(shown.currentStroke).toBeGreaterThan(shown.otherStroke);
    await findField(page).fill('no such label');
    await expect(findBar(page).getByRole('status')).toHaveText('No matches');
    await a11yCheckpoint(page, 'diagram-challenge-demo: diagram find bar');
  });

  test('a regular expression finds labels by pattern, and an invalid one says why', async ({ page }) => {
    await openDemo(page);
    await showDiagrams(page, [ORDER_FAN_OUT], { layout: 'maximized' });
    await componentDrawing(page).focus();
    await page.keyboard.press('ControlOrMeta+F');
    const status = findBar(page).getByRole('status');

    // As plain text the pattern matches nothing; as a pattern it matches the specific topics.
    await findField(page).fill('^trip\\.c');
    await expect(status).toHaveText('No matches');
    await findBar(page).getByLabel('Regular expression', { exact: true }).check();
    await expect(status).toHaveText('1 of 2');
    expect([...(await marks(page)).labels].sort()).toEqual(['trip.cancelled', 'trip.confirmed']);

    await findField(page).fill('trip.(');
    await expect(status).toHaveText(/^Invalid regular expression/);
    expect((await marks(page)).labels).toEqual([]);
  });

  test('Enter moves to the next match at reading size, Shift+Enter back', async ({ page }) => {
    await openDemo(page);
    await showDiagrams(page, [ORDER_FAN_OUT], { layout: 'maximized' });
    const pane = diagramPane(page);
    await componentDrawing(page).focus();
    await page.keyboard.press('ControlOrMeta+F');
    await findField(page).fill('trip.');
    await expect(findBar(page).getByRole('status')).toHaveText('1 of 4');

    await page.keyboard.press('Enter');

    await expect(findBar(page).getByRole('status')).toHaveText('2 of 4');
    await expect(findField(page)).toBeFocused();
    await expectZoom(page, '100%');
    const current = pane.locator('rect.tutorial-diagram-pane__hit-box--current + text');
    const point = await current.evaluate(node => {
      const svg = node.ownerSVGElement.getBoundingClientRect();
      const box = node.getBoundingClientRect();
      return { x: (box.left + box.width / 2 - svg.left) / svg.width, y: (box.top + box.height / 2 - svg.top) / svg.height };
    });
    expect(await middleAsFarAsScrollAllows(componentDrawing(page), point)).toEqual({ x: true, y: true });
    await page.keyboard.press('Shift+Enter');
    await expect(findBar(page).getByRole('status')).toHaveText('1 of 4');
    await findBar(page).getByRole('button', { name: 'Previous match' }).click();
    await expect(findBar(page).getByRole('status')).toHaveText('4 of 4');
  });

  test('Escape closes the find bar, clears the marks, and returns focus', async ({ page }) => {
    await openDemo(page);
    await showDiagrams(page, [ORDER_FAN_OUT], { layout: 'maximized' });
    const drawing = componentDrawing(page);
    await drawing.focus();
    await page.keyboard.press('ControlOrMeta+F');
    await findField(page).fill('Broker');

    await page.keyboard.press('Escape');

    await expect(findBar(page)).toBeHidden();
    await expect(drawing).toBeFocused();
    expect((await marks(page)).labels).toEqual([]);
  });

  test('Ctrl+F in the code editor still opens the editor’s own find', async ({ page }) => {
    // Playwright's Cmd+F on macOS does not reach Monaco's key bindings, so
    // the page runs as on Linux, where the editor's find is Ctrl+F.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'platform', { get: () => 'Linux x86_64' });
      Object.defineProperty(navigator, 'userAgent', {
        get: () => 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      });
    });
    await openDemo(page);
    await showDiagrams(page, [ORDER_EVENTS], { layout: 'split' });
    // The first line of code: the editor's middle can sit under the diagram
    // when the code is stacked above it.
    await page.locator('.monaco-editor .view-line').first().click();

    await page.keyboard.press('Control+F');

    await expect(page.getByRole('textbox', { name: 'Find', exact: true })).toBeFocused();
    await expect(findBar(page)).toBeHidden();
    await expect(page.getByRole('region', { name: 'Project search' })).toBeHidden();
  });

  /** Dispatch one wheel event over the drawing; returns whether the page's default was prevented. */
  function wheel(drawing, { x, y, deltaY, ctrlKey = true }) {
    return drawing.evaluate((region, init) => {
      const target = document.elementFromPoint(init.x, init.y) || region;
      const event = new WheelEvent('wheel', {
        bubbles: true, cancelable: true, clientX: init.x, clientY: init.y, deltaY: init.deltaY, ctrlKey: init.ctrlKey,
      });
      return !target.dispatchEvent(event);
    }, { x, y, deltaY, ctrlKey });
  }

  /** Where a drawing point (shares of its size) is on screen. */
  function screenPoint(drawing, share) {
    return drawing.evaluate((region, { x, y }) => {
      const box = region.querySelector(':scope > svg').getBoundingClientRect();
      return { x: box.left + x * box.width, y: box.top + y * box.height };
    }, share);
  }

  test('pinch zoom over the drawing zooms around the pointer, not the page', async ({ page }) => {
    await openDemo(page);
    await showDiagrams(page, [ORDER_FAN_OUT], { layout: 'maximized' });
    const pane = diagramPane(page);
    const drawing = componentDrawing(page);
    // At reading size this drawing is wider than the pane, so scrolling can
    // keep a point under the pointer while it grows; on an axis where the
    // drawing still fits, it stays as near as scrolling allows.
    await readingSizeButton(page).click();
    await expectZoom(page, '100%');
    const before = await drawing.locator('svg').boundingBox();
    const view = await drawing.boundingBox();
    const pointer = { x: view.x + view.width * 0.4, y: view.y + view.height * 0.55 };
    const share = { x: (pointer.x - before.x) / before.width, y: (pointer.y - before.y) / before.height };

    for (let step = 0; step < 6; step++) {
      expect(await wheel(drawing, { ...pointer, deltaY: -8 }), 'the page does not zoom').toBe(true);
    }

    await expectZoom(page, /^1[5-7]\d%$/);
    await expect.poll(async () => Math.abs((await screenPoint(drawing, share)).x - pointer.x),
      { message: 'the point under the pointer stays put' }).toBeLessThanOrEqual(2);
    await expect.poll(async () => {
      const dy = (await screenPoint(drawing, share)).y - pointer.y;
      return drawing.evaluate((region, offset) => {
        const max = region.scrollHeight - region.clientHeight;
        return Math.abs(offset) <= 2 || (offset > 0 ? region.scrollTop >= max - 1 : region.scrollTop <= 1);
      }, dy);
    }, { message: 'vertically, as near as scrolling allows' }).toBe(true);
    expect(await page.evaluate(() => window.visualViewport.scale)).toBe(1);
    await expect(pane.getByRole('button', { name: 'Zoom out' })).not.toHaveAttribute('aria-disabled', 'true');
  });

  test('pinching out stops at Fit and pinching in stops at the largest zoom step', async ({ page }) => {
    await openDemo(page);
    await showDiagrams(page, [ORDER_FAN_OUT], { layout: 'maximized' });
    const pane = diagramPane(page);
    const drawing = componentDrawing(page);
    const box = await drawing.boundingBox();
    const pointer = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

    for (let step = 0; step < 40; step++) await wheel(drawing, { ...pointer, deltaY: -50 });
    await expectZoom(page, `${ZOOM_STEPS[ZOOM_STEPS.length - 1] * 100}%`);
    await expect(pane.getByRole('button', { name: 'Zoom in' })).toHaveAttribute('aria-disabled', 'true');

    for (let step = 0; step < 60; step++) await wheel(drawing, { ...pointer, deltaY: 50 });
    await expectFitted(page, drawing);
  });

  test('two-finger scrolling without a pinch still scrolls the drawing', async ({ page }) => {
    await openDemo(page);
    await showDiagrams(page, [ORDER_FAN_OUT], { layout: 'maximized' });
    const pane = diagramPane(page);
    const drawing = componentDrawing(page);
    await readingSizeButton(page).click();
    const box = await drawing.boundingBox();

    expect(await wheel(drawing, { x: box.x + box.width / 2, y: box.y + box.height / 2, deltaY: 40, ctrlKey: false }))
      .toBe(false);
    await expectZoom(page, '100%');
  });
});

// A maximized diagram (what lock-in opens) has the workspace to itself: the
// Files sidebar steps aside and OUTPUT keeps only its bar with Run. Working
// with code again (the Editor view, opening a file, Run, search) brings them
// back; beside the code, Files folds into a drawer so code and diagram share
// the width.
test.describe('authored-diagram pane layouts', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('a maximized diagram spans the workspace and leaves OUTPUT its Run bar', async ({ page }) => {
    await openDemo(page);
    await showDiagrams(page, [ORDER_EVENTS], { layout: 'maximized' });

    await expect(fileTree(page)).toBeHidden();
    await expect(programOutput(page)).toBeHidden();
    await expect(runButton(page)).toBeVisible();
    const paneBox = await diagramPane(page).boundingBox();
    const viewBox = await page.getByRole('group', { name: 'Workspace view' }).boundingBox();
    const runBox = await runButton(page).boundingBox();
    // The workspace runs from the view toggle's left edge to the window's right edge.
    expect(paneBox.x).toBeLessThanOrEqual(viewBox.x + 1);
    expect(paneBox.x + paneBox.width).toBeGreaterThanOrEqual(1440 - 1);
    // Down to OUTPUT's bar: no empty output area below the diagram.
    expect(paneBox.y + paneBox.height).toBeGreaterThanOrEqual(runBox.y - 24);
    await a11yCheckpoint(page, 'diagram-challenge-demo: maximized diagram');
  });

  test('Run from a maximized diagram brings back the code and OUTPUT beside the diagram', async ({ page }) => {
    await openDemo(page);
    await showDiagrams(page, [ORDER_EVENTS], { layout: 'maximized' });
    await runButton(page).click();

    await expect(programOutput(page)).toContainText('Order A-100 sent to:', { timeout: BOOT_TIMEOUT });
    await expect(codeEditor(page)).toBeVisible();
    await expect(page.getByRole('region', { name: /^UML component diagram/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Code beside diagram' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('the Editor view restores Files and OUTPUT after a maximized diagram', async ({ page }) => {
    await openDemo(page);
    await showDiagrams(page, [ORDER_EVENTS], { layout: 'maximized' });
    await page.getByRole('button', { name: 'Editor', exact: true }).click();

    await expect(fileTree(page)).toBeVisible();
    await expect(programOutput(page)).toBeVisible();
    await expect(codeEditor(page)).toBeVisible();
  });

  test('beside the code, Files folds into a drawer that opens on request', async ({ page }) => {
    await openDemo(page);
    await showDiagrams(page, [ORDER_EVENTS], { layout: 'split' });

    await expect(fileTree(page)).toBeHidden();
    await expect(filesDisclosure(page)).toBeVisible();
    await expect(programOutput(page)).toBeVisible();
    const viewBox = await page.getByRole('group', { name: 'Workspace view' }).boundingBox();
    const paneBox = await diagramPane(page).boundingBox();
    // Code and diagram share the width; the folded drawer takes almost none.
    expect(paneBox.width).toBeGreaterThan((1440 - viewBox.x) * 0.4);

    await filesDisclosure(page).click();
    await expect(fileTree(page)).toBeVisible();
    await treeItem(page, 'notes.md').click();
    await expect(fileTabs(page).getByRole('button', { name: 'notes.md', exact: true })).toHaveAttribute('aria-current', 'true');
    await expect(page.getByRole('region', { name: /^UML component diagram/ })).toBeVisible();
    await a11yCheckpoint(page, 'diagram-challenge-demo: diagram beside code with Files open');
  });

  test('search from a maximized diagram opens beside it, and a result brings back the code and OUTPUT', async ({ page }) => {
    await openDemo(page);
    await showDiagrams(page, [ORDER_EVENTS], { layout: 'maximized' });
    await diagramPane(page).getByRole('region', { name: /^UML component diagram/ }).focus();
    await page.keyboard.press('ControlOrMeta+Shift+F');
    const query = page.getByLabel('Search all files', { exact: true });

    await expect(query).toBeFocused();
    await query.fill('order.placed');
    await page.getByRole('list', { name: 'Search results' }).getByRole('button', { name: /^Line 8\b/ }).click();
    await expect(fileTabs(page).getByRole('button', { name: 'deploy/broker.toml', exact: true })).toHaveAttribute('aria-current', 'true');
    await expect(codeEditor(page)).toBeVisible();
    await expect(programOutput(page)).toBeVisible();
    await expect(page.getByRole('region', { name: /^UML component diagram/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Code beside diagram' })).toHaveAttribute('aria-pressed', 'true');
  });
});

// At 1280 px with the instructions open, the workspace is too narrow to put
// code and diagram side by side: the code goes above the diagram and both
// keep the workspace's width. The pane's tools stay on one row.
test.describe('code beside the diagram at 1280 px', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('the code sits above the diagram, both as wide as the workspace, and the pane tools fit one row', async ({ page }) => {
    await openDemo(page);
    await showDiagrams(page, [ORDER_FAN_OUT], { layout: 'split' });
    const pane = diagramPane(page);
    await expect(componentDrawing(page)).toBeVisible();

    // Monaco draws the editor; its box is the code area.
    const editorBox = await page.locator('.monaco-editor').first().boundingBox();
    const paneBox = await pane.boundingBox();
    expect(paneBox.y).toBeGreaterThanOrEqual(editorBox.y + editorBox.height - 1);
    expect(paneBox.width).toBeGreaterThanOrEqual(editorBox.width - 2);
    expect((await componentDrawing(page).boundingBox()).height).toBeGreaterThanOrEqual(150);
    const tops = await pane.getByRole('group', { name: 'Diagram view controls' }).getByRole('button')
      .evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().top));
    expect(Math.max(...tops) - Math.min(...tops), 'one row of tools').toBeLessThanOrEqual(4);
    await a11yCheckpoint(page, 'diagram-challenge-demo: code above the diagram');
  });

  test('the divider between them moves up and down from the keyboard', async ({ page }) => {
    await openDemo(page);
    await showDiagrams(page, [ORDER_FAN_OUT], { layout: 'split' });
    const divider = page.getByRole('separator', { name: 'Resize code and diagram panes' });
    await expect(divider).toHaveAttribute('aria-orientation', 'horizontal');
    const code = page.locator('.monaco-editor').first();
    const before = (await code.boundingBox()).height;

    await divider.focus();
    for (let presses = 0; presses < 3; presses++) await page.keyboard.press('ArrowDown');

    await expect.poll(async () => (await code.boundingBox()).height).toBeGreaterThan(before + 40);
  });
});

// ---------------------------------------------------------------------------
// Diagram challenges
// ---------------------------------------------------------------------------

const HYPOTHESIS = 'Your hypothesis, in one sentence';
const VIEW_WISH = 'What would you want a diagram of this code to show?';

function challenge(page) {
  return page.getByRole('region', { name: 'Diagram challenge', exact: true });
}

/** A stage of the challenge: 'Answer from the code', 'The agent’s reply', … */
function stage(page, name) {
  return challenge(page).getByRole('region', { name, exact: true });
}

function question(scope, number) {
  return scope.getByRole('group', { name: new RegExp(`^Question ${number}:`) });
}

// A locked Next button also shows a lock icon in its name.
function nextButton(page) {
  return page.getByRole('button', { name: /^Next →/ });
}

/** Search opens deploy/broker.toml at line 13 (`key = "order.*"`). */
async function openBindingLine(page) {
  await page.getByRole('button', { name: 'Search files', exact: true }).click();
  await page.getByLabel('Search all files', { exact: true }).fill('"order.*"');
  await page.getByRole('list', { name: 'Search results' }).getByRole('button', { name: /^Line 13\b/ }).click();
}

/** Step 1, Part A: hypothesis, one pinned line, view wish, then the choices. */
async function answerExploreFromCode(page) {
  const fromCode = stage(page, 'Answer from the code');
  await fromCode.getByLabel(HYPOTHESIS).fill('The bindings in deploy/broker.toml decide.');
  await openBindingLine(page);
  await fromCode.getByRole('button', { name: 'Pin this line' }).click();
  await fromCode.getByLabel(VIEW_WISH).fill('Every consumer of the exchange with its binding key.');
  await question(fromCode, 1).getByLabel('partner-gateway', { exact: true }).check();
  await question(fromCode, 2).getByLabel('deploy/broker.toml', { exact: true }).check();
  await fromCode.getByLabel('Fairly sure', { exact: true }).check();
}

async function lockIn(page) {
  await challenge(page).getByRole('button', { name: /^Lock in my (answer|plan)$/ }).click();
  await page.getByRole('dialog', { name: 'Lock in your answer?' }).getByRole('button', { name: 'Lock in', exact: true }).click();
}

/** After lock-in Part A folds into a closed summary; open it to read the locked answer. */
async function openLockedAnswer(page) {
  const summary = stage(page, 'Answer from the code').locator('summary', { hasText: /^Your locked answer/ });
  await summary.click();
  await expect(summary.locator('..')).toHaveAttribute('open', '');
}

async function setDarkMode(page) {
  const theme = page.getByRole('checkbox', { name: 'Toggle dark mode', exact: true });
  await theme.focus();
  await page.keyboard.press('Space');
  await expect(theme).toBeChecked();
}

/**
 * How an answer option looks: its label's weight, any generated mark beside
 * the label, and the frame around the option's row with its contrast against
 * the surface behind the row. A visual property needs computed styles.
 */
function optionLook(input) {
  return input.evaluate(element => {
    const rgb = value => (value.match(/[\d.]+/g) || []).map(Number);
    const opaque = value => {
      const [, , , alpha = 1] = rgb(value);
      return value !== 'transparent' && alpha > 0;
    };
    const luminance = value => {
      const [r, g, b] = rgb(value).map(channel => {
        const c = channel / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const label = element.labels[0];
    const row = element.closest('.tutorial-diagram-challenge__option');
    const marks = ['::before', '::after'].map(pseudo => getComputedStyle(label, pseudo).content)
      .filter(content => content && content !== 'none' && content !== 'normal');
    const style = getComputedStyle(row);
    const outlined = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
    const bordered = style.borderTopStyle !== 'none' && parseFloat(style.borderTopWidth) > 0;
    const frameColor = outlined ? style.outlineColor : style.borderTopColor;
    let surface = row.parentElement;
    while (surface && !opaque(getComputedStyle(surface).backgroundColor)) surface = surface.parentElement;
    const behind = surface ? getComputedStyle(surface).backgroundColor : 'rgb(255, 255, 255)';
    const [lighter, darker] = [luminance(frameColor), luminance(behind)].sort((a, b) => b - a);
    return {
      labelWeight: Number(getComputedStyle(label).fontWeight),
      mark: marks.length ? marks.join(' ') : 'none',
      frameWidth: outlined ? parseFloat(style.outlineWidth) : bordered ? parseFloat(style.borderTopWidth) : 0,
      frameContrast: (lighter + 0.05) / (darker + 0.05),
    };
  });
}

/** Step 1 after lock-in: fix Part B, the follow-up, then the debrief. */
async function finishExplore(page) {
  const withDiagram = stage(page, 'Answer with the diagram');
  await question(withDiagram, 1).getByLabel('trip-site-notifications', { exact: true }).check();
  await question(withDiagram, 1).getByLabel('warehouse-etl', { exact: true }).check();
  await withDiagram.getByRole('button', { name: 'Check my answers' }).click();
  await withDiagram.getByRole('button', { name: 'Continue to the new question' }).click();
  const followUp = stage(page, 'A new question');
  await followUp.getByLabel('trip-site-notifications', { exact: true }).check();
  await followUp.getByLabel('warehouse-etl', { exact: true }).check();
  await followUp.getByRole('button', { name: 'Check my answer' }).click();
  await followUp.getByRole('button', { name: 'Show the comparison' }).click();
  const compare = stage(page, 'Compare your answers');
  await compare.getByLabel('What did the diagram put side by side that you had to search for?')
    .fill('Every consumer of the exchange next to its binding.');
  await compare.getByRole('group', { name: 'Which mechanism hid the answer in the code?' })
    .getByLabel('Bindings in a configuration file, with wildcard keys').check();
  await compare.getByRole('button', { name: 'Finish the challenge' }).click();
  await expect(compare.getByText(/^Challenge complete with a score of 100%/)).toBeVisible();
}

test.describe('diagram challenge: answering from the code', () => {
  test('answer choices appear only after the hypothesis is written', async ({ page }) => {
    await openDemo(page);
    const fromCode = stage(page, 'Answer from the code');

    await expect(question(fromCode, 1)).toBeHidden();
    await expect(fromCode.getByText('The answer choices appear after you write your hypothesis.')).toBeVisible();
    await fromCode.getByLabel(HYPOTHESIS).fill('Something in deploy/ decides.');
    await expect(question(fromCode, 1)).toBeVisible();
    await expect(fromCode.getByRole('button', { name: 'Lock in my answer' })).toBeDisabled();
    await expect(fromCode.getByText(/^Still to do: pin 1 more line; say what a diagram should show; answer question 1/))
      .toBeVisible();
    await a11yCheckpoint(page, 'diagram-challenge-demo: exploring', { feature: 'diagram-challenge' });
  });

  test('at the time budget a status note suggests locking in, without interrupting', async ({ page }) => {
    await page.clock.install();
    await openDemo(page);
    const fromCode = stage(page, 'Answer from the code');
    const nudge = fromCode.getByText(/^You have worked on this for about 7 minutes\. When you are ready, lock in your best answer/);

    await page.clock.fastForward('06:50');
    await expect(nudge).toBeHidden();
    await page.clock.fastForward('00:20');
    await expect(nudge).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(fromCode.getByLabel(HYPOTHESIS)).toBeEditable();
  });

  test('Pin this line records the cursor line, which opens again from the pin', async ({ page }) => {
    await openDemo(page);
    const fromCode = stage(page, 'Answer from the code');
    await openBindingLine(page);
    await fromCode.getByRole('button', { name: 'Pin this line' }).click();

    const pin = fromCode.getByRole('button', { name: 'deploy/broker.toml:13', exact: true });
    await expect(pin).toBeVisible();
    await treeItem(page, 'scenario.py').click();
    await pin.click();
    await expect(fileTabs(page).getByRole('button', { name: 'deploy/broker.toml', exact: true })).toHaveAttribute('aria-current', 'true');
    expect(await page.evaluate(() => window._tutorial.editor.getPosition().lineNumber)).toBe(13);
    await fromCode.getByRole('button', { name: 'Remove deploy/broker.toml:13' }).click();
    await expect(pin).toHaveCount(0);
  });

  test('lock-in confirms, freezes part A, and opens the maximized diagram', async ({ page }) => {
    await openDemo(page);
    await expect(page.getByRole('button', { name: 'Diagram', exact: true })).toHaveAttribute('aria-disabled', 'true');
    await answerExploreFromCode(page);
    await lockIn(page);

    await expect(stage(page, 'The agent’s reply').getByRole('heading', { name: 'The agent’s reply' })).toBeFocused();
    await openLockedAnswer(page);
    await expect(question(stage(page, 'Answer from the code'), 1).getByLabel('partner-gateway', { exact: true })).toBeDisabled();
    await expect(page.getByRole('region', { name: /^UML component diagram with 5 components/ })).toBeVisible();
    await expect(codeEditor(page)).toBeHidden();
    await a11yCheckpoint(page, 'diagram-challenge-demo: locked', { feature: 'diagram-challenge' });
  });

  test('locked answers stay clearly marked, not by color alone, in light and dark mode', async ({ page }) => {
    await openDemo(page);
    await answerExploreFromCode(page);
    await lockIn(page);
    await openLockedAnswer(page);
    const fromCode = stage(page, 'Answer from the code');
    const chosenAnswer = question(fromCode, 1).getByLabel('partner-gateway', { exact: true });
    const otherAnswer = question(fromCode, 1).getByLabel('warehouse-etl', { exact: true });
    const chosenConfidence = fromCode.getByLabel('Fairly sure', { exact: true });
    // Native controls keep their state: checked, and disabled after lock-in.
    await expect(chosenAnswer).toBeChecked();
    await expect(chosenAnswer).toBeDisabled();
    await expect(chosenConfidence).toBeChecked();
    await expect(chosenConfidence).toBeDisabled();

    for (const theme of ['light', 'dark']) {
      if (theme === 'dark') await setDarkMode(page);
      for (const chosen of [chosenAnswer, chosenConfidence]) {
        // The theme switch fades colors; wait until the frame has settled.
        await expect.poll(async () => (await optionLook(chosen)).frameContrast,
          { message: `${theme}: the frame stands out (WCAG 1.4.11)` }).toBeGreaterThanOrEqual(3);
        const look = await optionLook(chosen);
        expect(look.labelWeight, `${theme}: a chosen answer's text is bold`).toBeGreaterThanOrEqual(700);
        // A neutral tag, not a check mark: a locked answer may be wrong.
        expect(look.mark, `${theme}: a chosen answer is tagged as yours`).toContain('Your answer');
        expect(look.mark, `${theme}: no check mark that reads as correct`).not.toContain('✔');
        expect(look.frameWidth, `${theme}: a chosen answer's row is framed`).toBeGreaterThanOrEqual(2);
      }
      const other = await optionLook(otherAnswer);
      expect(other.labelWeight).toBeLessThan(600);
      expect(other.mark).toBe('none');
      expect(other.frameWidth).toBe(0);
    }
  });

  test('an evidence note opens its file at the line and returns to split view', async ({ page }) => {
    await openDemo(page);
    await answerExploreFromCode(page);
    await lockIn(page);
    await stage(page, 'The agent’s reply').locator('summary', { hasText: /^Evidence/ }).click();
    await stage(page, 'The agent’s reply')
      .getByRole('button', { name: /^warehouse-etl binds #, which is drawn as any key deploy\/broker\.toml:18$/ }).click();

    await expect(fileTabs(page).getByRole('button', { name: 'deploy/broker.toml', exact: true })).toHaveAttribute('aria-current', 'true');
    expect(await page.evaluate(() => window._tutorial.editor.getPosition().lineNumber)).toBe(18);
    await expect(codeEditor(page)).toBeVisible();
    await expect(page.getByRole('region', { name: /^UML component diagram/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Code beside diagram' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('part B starts from part A, and Check marks each question and moves focus to the result', async ({ page }) => {
    await openDemo(page);
    await answerExploreFromCode(page);
    await lockIn(page);
    const withDiagram = stage(page, 'Answer with the diagram');

    await expect(question(withDiagram, 1).getByLabel('partner-gateway', { exact: true })).toBeChecked();
    await expect(question(withDiagram, 2).getByLabel('deploy/broker.toml', { exact: true })).toBeChecked();
    await withDiagram.getByRole('button', { name: 'Check my answers' }).click();
    await expect(withDiagram.getByRole('heading', { name: '1 of 2 correct' })).toBeFocused();
    await expect(question(withDiagram, 1).getByText('Not correct yet')).toBeVisible();
    await expect(question(withDiagram, 2).getByText('Correct', { exact: true })).toBeVisible();
    await question(withDiagram, 1).getByLabel('warehouse-etl', { exact: true }).check();
    await expect(question(withDiagram, 1).getByText('Changed since your last check')).toBeVisible();
  });

  test('the comparison leads with correctness and keeps hideable times secondary', async ({ page }) => {
    await openDemo(page);
    await answerExploreFromCode(page);
    await lockIn(page);
    await finishExplore(page);
    const compare = stage(page, 'Compare your answers');
    const first = compare.getByRole('heading', { name: 'Question 1', exact: true }).locator('..');

    // Part A chose only partner-gateway; Part B's first check had all three.
    await expect(first.getByRole('definition').first()).toHaveText(
      'Not correct. Found: partner-gateway. Missed: trip-site-notifications, warehouse-etl.');
    await expect(first.getByRole('definition').nth(1)).toHaveText(
      'Correct: partner-gateway, trip-site-notifications, warehouse-etl.');
    const times = compare.getByText(/^Your experience, not an experiment: from the code .* · with the diagram .* · new question .*\.$/);
    await expect(times).toBeVisible();
    await compare.getByRole('button', { name: 'Hide times' }).click();
    await expect(times).toBeHidden();
    await expect(compare.getByRole('button', { name: 'Hide times' })).toHaveAttribute('aria-pressed', 'true');
    await a11yCheckpoint(page, 'diagram-challenge-demo: comparison', { feature: 'diagram-challenge' });
  });
});

// ---------------------------------------------------------------------------
// Short instructions, pins in the code, feedback, and orientation
// ---------------------------------------------------------------------------

const RETRY_POINTER = 'Look for it in the diagram, then check it in the code through the evidence notes in the agent’s reply.';

/** The vertical middle of an element's box. */
async function middleY(locator) {
  const box = await locator.boundingBox();
  return box.y + box.height / 2;
}

test.describe('diagram challenge: finished parts fold away', () => {
  test('after lock-in, part A, the evidence list, and the files read are closed summaries', async ({ page }) => {
    await openDemo(page);
    await answerExploreFromCode(page);
    await lockIn(page);
    const fromCode = stage(page, 'Answer from the code');
    const reply = stage(page, 'The agent’s reply');

    const locked = fromCode.locator('summary', { hasText: /^Your locked answer/ });
    await expect(locked).toHaveText('Your locked answer: 1 line pinned, Fairly sure');
    await expect(fromCode.getByLabel(HYPOTHESIS)).toBeHidden();
    await expect(question(fromCode, 1)).toBeHidden();
    await locked.click();
    await expect(fromCode.getByLabel(HYPOTHESIS)).toHaveValue('The bindings in deploy/broker.toml decide.');
    await expect(fromCode.getByLabel(HYPOTHESIS)).not.toBeEditable();

    const evidenceNote = reply.getByRole('button', { name: /^warehouse-etl binds #/ });
    await expect(evidenceNote).toBeHidden();
    await reply.locator('summary', { hasText: 'Evidence (5)' }).click();
    await expect(evidenceNote).toBeVisible();
    await expect(reply.getByText('infra/bus.py', { exact: true })).toBeHidden();
    await reply.locator('summary', { hasText: 'Files read (4)' }).click();
    await expect(reply.getByText('infra/bus.py', { exact: true })).toBeVisible();
    // The summary and the parts the questions need stay open.
    await expect(reply.getByText(/^Summary: The view shows the publisher/)).toBeVisible();
    await expect(reply.getByRole('button', { name: 'Show the diagram' })).toBeVisible();
  });
});

test.describe('diagram challenge: pinning from the code', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('a pin shows its line’s text, marks that line in the editor, and counts toward what is needed', async ({ page }) => {
    await openDemo(page);
    const fromCode = stage(page, 'Answer from the code');
    const pins = fromCode.getByRole('group', { name: /^Evidence you pinned/ });
    await expect(pins).toHaveAccessibleName('Evidence you pinned (0 of 1)');

    await openBindingLine(page);
    await fromCode.getByRole('button', { name: 'Pin this line' }).click();
    await expect(pins).toHaveAccessibleName('Evidence you pinned (1 of 1)');
    await expect(pins.getByRole('listitem')).toContainText('key = "order.*"');

    // A mark in the editor's margin, level with line 13, stays after the
    // reveal highlight fades.
    const editor = page.locator('.monaco-editor').first();
    const mark = editor.locator('.tvm-editor-line-mark');
    await expect(mark).toHaveCount(1);
    const lineNumber = editor.locator('.line-numbers', { hasText: /^13$/ });
    expect(Math.abs(await middleY(mark) - await middleY(lineNumber))).toBeLessThan(4);
    await fromCode.getByRole('button', { name: 'Remove deploy/broker.toml:13' }).click();
    await expect(mark).toHaveCount(0);
  });

  test('the editor pins the cursor line with Ctrl+Alt+P and from its context menu', async ({ page }) => {
    await openDemo(page);
    const fromCode = stage(page, 'Answer from the code');
    await openBindingLine(page);
    await expect(codeEditor(page)).toBeFocused();

    // The Desktop Chrome device reports Windows, so Monaco binds Ctrl, not Cmd.
    await page.keyboard.press('Control+Alt+KeyP');
    await expect(fromCode.getByRole('button', { name: 'deploy/broker.toml:13', exact: true })).toBeVisible();

    // The context menu from the keyboard (Shift+F10); ArrowDown moves to its
    // first item. Monaco's menu would ignore a click that lands as it opens.
    await page.locator('.monaco-editor .view-line', { hasText: 'key = "#"' }).click();
    await page.keyboard.press('Shift+F10');
    await expect(page.getByRole('menuitem', { name: /^Pin line as evidence/ })).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(fromCode.getByRole('button', { name: 'deploy/broker.toml:18', exact: true })).toBeVisible();
    await expect(challenge(page).getByRole('status').filter({ hasText: 'Pinned deploy/broker.toml:18.' })).toHaveCount(1);
  });
});

test.describe('diagram challenge: check feedback', () => {
  test('a failed check points into the diagram, and moving on waits for a right answer', async ({ page }) => {
    await openDemo(page);
    await answerExploreFromCode(page);
    await lockIn(page);
    const withDiagram = stage(page, 'Answer with the diagram');
    const check = withDiagram.getByRole('button', { name: 'Check my answers' });
    const retryLine = withDiagram.getByText('You can change an answer and check again.');

    await question(withDiagram, 2).getByLabel('services/opc/orders.py', { exact: true }).check();
    await check.click();
    await expect(withDiagram.getByRole('heading', { name: '0 of 2 correct' })).toBeFocused();
    await expect(question(withDiagram, 1).getByText(RETRY_POINTER)).toBeVisible();
    await expect(retryLine).toBeVisible();
    await expect(withDiagram.getByRole('button', { name: /new question|comparison/i })).toHaveCount(0);

    await question(withDiagram, 2).getByLabel('deploy/broker.toml', { exact: true }).check();
    await check.click();
    const skip = withDiagram.getByRole('button', { name: 'Skip to the new question', exact: true });
    await expect(skip).toBeVisible();
    await expect(question(withDiagram, 2).getByText(RETRY_POINTER)).toHaveCount(0);
    // Secondary, unlike the primary Check: a different fill.
    const fill = locator => locator.evaluate(element => getComputedStyle(element).backgroundColor);
    expect(await fill(skip)).not.toBe(await fill(check));

    await question(withDiagram, 1).getByLabel('trip-site-notifications', { exact: true }).check();
    await question(withDiagram, 1).getByLabel('warehouse-etl', { exact: true }).check();
    await check.click();
    await expect(withDiagram.getByRole('heading', { name: '2 of 2 correct' })).toBeFocused();
    await expect(withDiagram.getByRole('button', { name: 'Continue to the new question', exact: true })).toBeVisible();
    await expect(skip).toHaveCount(0);
    await expect(retryLine).toBeHidden();
  });
});

test.describe('diagram challenge: where you are', () => {
  test('a stepper names the challenge’s phases and marks the current one', async ({ page }) => {
    await openDemo(page);
    const phases = challenge(page).getByRole('list', { name: 'Challenge progress' }).getByRole('listitem');

    await expect(phases).toHaveText(['From the code', 'With the diagram', 'New question', 'Compare']);
    await expect(phases.nth(0)).toHaveAttribute('aria-current', 'step');
    await answerExploreFromCode(page);
    await lockIn(page);
    await expect(phases.nth(0)).toHaveText(/^✓\s*From the code, done$/);
    await expect(phases.nth(0)).not.toHaveAttribute('aria-current');
    await expect(phases.nth(1)).toHaveAttribute('aria-current', 'step');
  });

  test('a reload after lock-in returns to the live part with the diagram shown', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(DEMO);
    await waitForBoot(page);
    await answerExploreFromCode(page);
    await lockIn(page);
    await page.reload();
    await waitForBoot(page);

    await expect(componentDrawing(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Diagram', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(stage(page, 'Answer with the diagram').getByRole('heading', { name: 'Answer with the diagram' })).toBeInViewport();
  });
});

test.describe('diagram challenge: plan-first questions and their views', () => {
  test('a plan card shows the whole question, and each answer opens its view', async ({ page }) => {
    await openDemo(page, '#choose-view');
    const plan = stage(page, 'Plan your requests');

    await expect(plan.getByRole('group', { name: 'Question 2: Which queue receives every order event, whatever its key?', exact: true }))
      .toBeVisible();
    await expect(plan.getByText('Which view would you ask the agent for to answer it?')).toHaveCount(2);
    await question(plan, 1).getByLabel('No diagram: read services/trip_site/checkout.py').check();
    await question(plan, 2).getByLabel('A component diagram of the order events').check();
    await lockIn(page);
    const withDiagram = stage(page, 'Answer with the diagram');

    await expect(page.getByText('Q2 · Order events', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Editor', exact: true }).click();
    await expect(componentDrawing(page)).toBeHidden();
    await question(withDiagram, 2).getByRole('button', { name: 'Open its view: Q2 · Order events', exact: true }).click();
    await expect(componentDrawing(page)).toBeVisible();
    await expect(question(withDiagram, 1).getByRole('button', { name: /^Open its view/ })).toHaveCount(0);
    await expect(question(withDiagram, 1).getByText('Expert’s choice: No diagram: read services/trip_site/checkout.py'))
      .toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Diagram search and code links
// ---------------------------------------------------------------------------

// Labels that only the step's "Order events" diagram shows: the code spells
// the queue `trip-site-notifications`.
const DIAGRAM_ONLY_LABEL = 'TripSiteNotifications';
const EVENT_LINKS = config.steps[0].diagram_challenge.reply.diagrams[0].links;
const linkFor = text => EVENT_LINKS.find(link => link.text === text);

function searchField(page) {
  return page.getByLabel('Search all files', { exact: true });
}

/** Ctrl/Cmd+Shift+F, which works wherever focus is in the tutorial, also over a maximized diagram. */
async function searchProject(page, text) {
  await page.keyboard.press('ControlOrMeta+Shift+F');
  await expect(searchField(page)).toBeFocused();
  await searchField(page).fill(text);
}

function searchStatus(page) {
  return page.getByRole('region', { name: 'Project search' }).getByRole('status');
}

/** The result list of one diagram, named by its "Diagram: <label>" heading. */
function diagramResults(page, label) {
  return page.getByRole('list', { name: 'Search results' })
    .getByRole('list', { name: new RegExp('^Diagram: ' + label + ' \\d+ results?$') });
}

/** A label of the shown drawing, by its exact text. */
function drawingLabel(page, text) {
  return diagramPane(page).locator('svg text').filter({ hasText: new RegExp('^\\s*' + text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$') });
}

/**
 * How a drawing label is marked, as a reader sees it: weight, underline, and
 * any frame drawn behind it, with the contrasts that make each legible. In
 * dark mode the site shows the SVG through `invert(1) hue-rotate(180deg)`, so
 * colors inside the drawing are compared as that filter paints them, against
 * the pane surface behind the drawing.
 */
function labelLook(label) {
  return label.evaluate(node => {
    const rgb = value => (String(value).match(/[\d.]+/g) || []).map(Number).slice(0, 3).map(c => c / 255);
    // CSS filter functions as color matrices (Filter Effects 1, §13).
    const FILTERS = {
      'invert(1)': ([r, g, b]) => [1 - r, 1 - g, 1 - b],
      'hue-rotate(180deg)': ([r, g, b]) => [
        -0.574 * r + 1.430 * g + 0.144 * b,
        0.426 * r + 0.430 * g + 0.144 * b,
        0.426 * r + 1.430 * g - 0.856 * b,
      ].map(c => Math.min(1, Math.max(0, c))),
    };
    const svg = node.ownerSVGElement;
    const filter = getComputedStyle(svg).filter;
    const steps = filter && filter !== 'none' ? filter.split(/\s+(?=[a-z-]+\()/) : [];
    const painted = value => steps.reduce((color, step) => {
      if (!FILTERS[step]) throw new Error('unknown filter ' + step);
      return FILTERS[step](color);
    }, rgb(value));
    const luminance = ([r, g, b]) => {
      const lin = c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    };
    const contrast = (a, b) => {
      const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (lighter + 0.05) / (darker + 0.05);
    };
    let surface = svg.parentElement;
    const opaque = value => value !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(value);
    while (surface && !opaque(getComputedStyle(surface).backgroundColor)) surface = surface.parentElement;
    const behind = rgb(surface ? getComputedStyle(surface).backgroundColor : 'rgb(255, 255, 255)');
    const style = getComputedStyle(node);
    const frame = node.previousElementSibling;
    const framed = !!frame && frame.tagName === 'rect' && frame.classList.contains('tutorial-diagram-pane__hit-box');
    const look = {
      weight: Number(style.fontWeight),
      underlined: style.textDecorationLine.includes('underline'),
      cursor: style.cursor,
      textContrast: contrast(painted(style.fill), behind),
      framed,
    };
    if (framed) {
      const box = getComputedStyle(frame);
      const frameBox = frame.getBoundingClientRect();
      const labelBox = node.getBoundingClientRect();
      Object.assign(look, {
        frameWidth: parseFloat(box.strokeWidth),
        frameContrast: contrast(painted(box.stroke), behind),
        frameAroundLabel: frameBox.left <= labelBox.left && frameBox.right >= labelBox.right &&
          frameBox.top <= labelBox.top && frameBox.bottom >= labelBox.bottom,
        textOnFillContrast: contrast(painted(style.fill), painted(box.fill)),
      });
    }
    return look;
  });
}

/** Text contrast of a control against the first opaque surface behind it. */
function controlContrast(control) {
  return control.evaluate(node => {
    const rgb = value => (String(value).match(/[\d.]+/g) || []).map(Number);
    const opaque = value => value !== 'transparent' && (rgb(value)[3] === undefined || rgb(value)[3] > 0);
    const luminance = value => {
      const [r, g, b] = rgb(value).map(channel => {
        const c = channel / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    let surface = node;
    while (surface && !opaque(getComputedStyle(surface).backgroundColor)) surface = surface.parentElement;
    const behind = surface ? getComputedStyle(surface).backgroundColor : 'rgb(255, 255, 255)';
    const [lighter, darker] = [luminance(getComputedStyle(node).color), luminance(behind)].sort((a, b) => b - a);
    return (lighter + 0.05) / (darker + 0.05);
  });
}

test.describe('diagram search and code links', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('search finds diagram text only after lock-in, under a diagram heading', async ({ page }) => {
    await openDemo(page);
    await codeEditor(page).focus();
    await searchProject(page, DIAGRAM_ONLY_LABEL);
    await expect(searchStatus(page)).toHaveText(`No results for “${DIAGRAM_ONLY_LABEL}”.`);
    await page.keyboard.press('Escape');

    await answerExploreFromCode(page);
    await lockIn(page);
    await searchProject(page, DIAGRAM_ONLY_LABEL);

    await expect(searchStatus(page)).toHaveText('1 result in 1 diagram.');
    await expect(diagramResults(page, 'Order events').getByRole('button', { name: DIAGRAM_ONLY_LABEL, exact: true })).toBeVisible();
    await searchField(page).fill('order.placed');
    await expect(searchStatus(page)).toHaveText('3 results in 2 files and 1 diagram.');
    await a11yCheckpoint(page, 'diagram-challenge-demo: diagram search results');
  });

  test('while the contrast view is pending, search does not reach the main reply diagram', async ({ page }) => {
    await openDemo(page, '#review');
    const fromCode = stage(page, 'Answer from the code');
    await question(fromCode, 1).getByLabel('order.* on trip-site-notifications').check();
    await fromCode.getByLabel('Sure', { exact: true }).check();
    await fromCode.getByRole('group', { name: 'Which view would you ask the agent for?' }).getByLabel('Class diagram').check();
    await lockIn(page);
    await searchProject(page, DIAGRAM_ONLY_LABEL);

    await expect(searchStatus(page)).toHaveText(`No results for “${DIAGRAM_ONLY_LABEL}”.`);
    await searchField(page).fill('GlampingCoGateway');
    await expect(searchStatus(page)).toHaveText('2 results in 1 file and 1 diagram.');
  });

  test('a diagram result shows its tab with every hit framed and the first at reading size', async ({ page }) => {
    await openDemo(page);
    await showDiagrams(page, [ORDER_CLASSES, ORDER_FAN_OUT], { layout: 'split' });
    await page.getByRole('button', { name: 'Editor', exact: true }).click();
    await codeEditor(page).focus();
    await searchProject(page, 'SupportConsole');
    await diagramResults(page, 'Order fan-out').getByRole('button', { name: 'SupportConsole', exact: true }).click();

    const pane = diagramPane(page);
    await expect(page.getByRole('button', { name: 'Diagram', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Code beside diagram' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('tab', { name: 'Order fan-out' })).toHaveAttribute('aria-selected', 'true');
    await expectZoom(page, '100%');
    await expect(pane.getByRole('status')).toHaveText('1 label marked in Order fan-out.');
    const hit = drawingLabel(page, 'SupportConsole');
    const look = await labelLook(hit);
    expect(look.weight).toBeGreaterThanOrEqual(700);
    expect(look).toMatchObject({ framed: true, frameAroundLabel: true });
    expect(look.frameWidth).toBeGreaterThanOrEqual(2);
    const drawing = componentDrawing(page);
    const point = await hit.evaluate(node => {
      const svg = node.ownerSVGElement.getBoundingClientRect();
      const box = node.getBoundingClientRect();
      return { x: (box.left + box.width / 2 - svg.left) / svg.width, y: (box.top + box.height / 2 - svg.top) / svg.height };
    });
    expect(await middleAsFarAsScrollAllows(drawing, point)).toEqual({ x: true, y: true });
    expect((await labelLook(drawingLabel(page, 'Broker'))).framed).toBe(false);

    // A new query clears the marks.
    await searchField(page).fill('Loyalty');
    await expect(pane.locator('rect.tutorial-diagram-pane__hit-box')).toHaveCount(0);
  });

  test('clicking a linked label opens its code beside the diagram', async ({ page }) => {
    await openDemo(page);
    await answerExploreFromCode(page);
    await lockIn(page);
    const link = linkFor('WarehouseETL');
    await drawingLabel(page, link.text).click();

    await expect(fileTabs(page).getByRole('button', { name: link.path, exact: true })).toHaveAttribute('aria-current', 'true');
    await expect.poll(() => page.evaluate(() => window._tutorial.currentEditorLocation())).toEqual({ path: link.path, line: link.line });
    await expect(codeEditor(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Code beside diagram' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('a click on a linked label in Fit view opens its code instead of zooming, as the hint says', async ({ page }) => {
    await openDemo(page);
    await answerExploreFromCode(page);
    await lockIn(page);
    const pane = diagramPane(page);
    const link = linkFor('OPC');
    await fitButton(page).click();
    await expect(pane.getByText('Click a part of the drawing to read it at full size, or click an underlined name to open its code.', { exact: true }))
      .toBeVisible();

    await drawingLabel(page, link.text).click();

    await expect.poll(() => page.evaluate(() => window._tutorial.currentEditorLocation())).toEqual({ path: link.path, line: link.line });
    await expectFitted(page, componentDrawing(page));
  });

  test('each code link is a button that opens its code from the keyboard', async ({ page }) => {
    await openDemo(page);
    await answerExploreFromCode(page);
    await lockIn(page);
    const link = linkFor('TripSiteNotifications');
    const summary = diagramPane(page).locator('summary', { hasText: /^Code links$/ });
    await summary.focus();
    await page.keyboard.press('Enter');
    const button = diagramPane(page).getByRole('button', { name: `${link.text}, opens ${link.path}:${link.line}`, exact: true });
    await expect(button).toBeVisible();
    await button.focus();
    await page.keyboard.press('Enter');

    await expect(fileTabs(page).getByRole('button', { name: link.path, exact: true })).toHaveAttribute('aria-current', 'true');
    await expect.poll(() => page.evaluate(() => window._tutorial.currentEditorLocation())).toEqual({ path: link.path, line: link.line });
    await a11yCheckpoint(page, 'diagram-challenge-demo: code links');
  });

  test('Code links opens over the drawing without shrinking it, and Escape closes it', async ({ page }) => {
    await openDemo(page);
    await answerExploreFromCode(page);
    await lockIn(page);
    const drawing = componentDrawing(page);
    await expect(drawing).toBeVisible();
    const before = await drawing.boundingBox();
    const summary = diagramPane(page).locator('summary', { hasText: /^Code links$/ });

    await summary.click();
    const firstLink = diagramPane(page).getByRole('button', { name: /, opens / }).first();
    await expect(firstLink).toBeVisible();
    expect(await drawing.boundingBox()).toEqual(before);

    await firstLink.focus();
    await page.keyboard.press('Escape');
    await expect(firstLink).toBeHidden();
    await expect(summary).toBeFocused();
  });

  // A note cites project files as path:line; each citation of a project
  // file is a link, and a path outside the project stays plain text.
  const CITING_NOTE = {
    id: 'cited',
    label: 'Cited bindings',
    type: 'component',
    source: '@startuml\ncomponent OPC\ncomponent Broker\nOPC --> Broker : order.placed\n' +
      'note bottom of Broker\nBindings: deploy/broker.toml:13 and\ndeploy/broker.toml:13 again; not foo.py:3\nend note\n@enduml',
  };

  test('a path:line in a diagram note opens its file by click and from the list', async ({ page }) => {
    await openDemo(page);
    await showDiagrams(page, [CITING_NOTE], { layout: 'split' });
    const citations = diagramPane(page).locator('svg .tutorial-diagram-pane__link');
    await expect(citations).toHaveText(['deploy/broker.toml:13', 'deploy/broker.toml:13']);
    expect(await citations.first().evaluate(node => getComputedStyle(node).textDecorationLine)).toContain('underline');

    await citations.first().click();
    await expect(fileTabs(page).getByRole('button', { name: 'deploy/broker.toml', exact: true })).toHaveAttribute('aria-current', 'true');
    await expect.poll(() => page.evaluate(() => window._tutorial.currentEditorLocation())).toEqual({ path: 'deploy/broker.toml', line: 13 });

    await page.evaluate(() => window._tutorial.revealSource('scenario.py', 1));
    await diagramPane(page).locator('summary', { hasText: /^Code links$/ }).click();
    const listed = diagramPane(page).getByRole('button', { name: 'Open deploy/broker.toml at line 13', exact: true });
    await expect(listed).toHaveCount(1);
    await listed.focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => window._tutorial.currentEditorLocation())).toEqual({ path: 'deploy/broker.toml', line: 13 });
  });

  test('a path:line code span in an explanation opens its file by click and by keyboard', async ({ page }) => {
    await openDemo(page);
    await answerExploreFromCode(page);
    await lockIn(page);
    // The comparison shows each question's explanation.
    const withDiagram = stage(page, 'Answer with the diagram');
    await withDiagram.getByRole('button', { name: 'Check my answers' }).click();
    // One of two is right: the learner may skip ahead and fix it later.
    await withDiagram.getByRole('button', { name: 'Skip to the new question' }).click();
    const followUp = stage(page, 'A new question');
    await followUp.getByLabel('trip-site-notifications', { exact: true }).check();
    await followUp.getByLabel('warehouse-etl', { exact: true }).check();
    await followUp.getByRole('button', { name: 'Check my answer' }).click();
    await followUp.getByRole('button', { name: 'Show the comparison' }).click();
    const reference = stage(page, 'Compare your answers')
      .getByRole('button', { name: 'Open deploy/broker.toml at line 13', exact: true });
    await expect(reference).toBeVisible();
    await expect(reference.locator('code')).toHaveText('deploy/broker.toml:13');

    await reference.click();
    await expect(fileTabs(page).getByRole('button', { name: 'deploy/broker.toml', exact: true })).toHaveAttribute('aria-current', 'true');
    await expect.poll(() => page.evaluate(() => window._tutorial.currentEditorLocation())).toEqual({ path: 'deploy/broker.toml', line: 13 });

    await page.evaluate(() => window._tutorial.revealSource('scenario.py', 1));
    await reference.focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => window._tutorial.currentEditorLocation())).toEqual({ path: 'deploy/broker.toml', line: 13 });
  });

  test('search marks and linked labels stay legible, not by color alone, in light and dark mode', async ({ page }) => {
    await openDemo(page);
    await answerExploreFromCode(page);
    await lockIn(page);
    await searchProject(page, 'orders');
    await diagramResults(page, 'Order events').getByRole('button', { name: 'orders', exact: true }).click();
    // The Code links list closes on a press elsewhere, so it opens last.
    await diagramPane(page).locator('summary', { hasText: /^Code links$/ }).click();
    const hit = drawingLabel(page, 'orders');
    const linked = drawingLabel(page, 'WarehouseETL');
    const codeLink = diagramPane(page).getByRole('button', { name: /^WarehouseETL, opens / });

    for (const theme of ['light', 'dark']) {
      if (theme === 'dark') await setDarkMode(page);
      // The theme switch fades colors; wait until the button has settled.
      await expect.poll(() => controlContrast(codeLink), { message: `${theme}: code link text (WCAG 1.4.3)` })
        .toBeGreaterThanOrEqual(4.5);
      // The drawing's filter flips at once, but the pane surface behind it
      // fades to its dark color, so the frame is compared once that settles.
      await expect.poll(async () => (await labelLook(hit)).frameContrast,
        { message: `${theme}: the frame stands out (WCAG 1.4.11)` }).toBeGreaterThanOrEqual(3);
      const hitLook = await labelLook(hit);
      expect(hitLook.frameWidth, `${theme}: the hit is framed`).toBeGreaterThanOrEqual(2);
      expect(hitLook.textOnFillContrast, `${theme}: the hit's text on its fill (WCAG 1.4.3)`).toBeGreaterThanOrEqual(4.5);
      expect(hitLook.weight, `${theme}: the hit is bold`).toBeGreaterThanOrEqual(700);
      const linkLook = await labelLook(linked);
      expect(linkLook.underlined, `${theme}: a linked label is underlined`).toBe(true);
      expect(linkLook.cursor).toBe('pointer');
      expect(linkLook.textContrast, `${theme}: a linked label's text (WCAG 1.4.3)`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

test.describe('diagram challenge: contrast view and view prediction', () => {
  test('the contrast question comes before the main reply', async ({ page }) => {
    await openDemo(page, '#review');
    const fromCode = stage(page, 'Answer from the code');
    await question(fromCode, 1).getByLabel('order.* on trip-site-notifications').check();
    await fromCode.getByLabel('Sure', { exact: true }).check();
    await fromCode.getByRole('group', { name: 'Which view would you ask the agent for?' }).getByLabel('Class diagram').check();
    await lockIn(page);
    const reply = stage(page, 'The agent’s reply');

    await expect(page.getByRole('region', { name: /^UML class diagram with 3 classes/ })).toBeVisible();
    await expect(reply.getByRole('heading', { name: 'Second reply' })).toBeHidden();
    await expect(stage(page, 'Answer with the diagram')).toHaveCount(0);
    await reply.getByRole('group', { name: /^Can this class diagram show/ }).getByLabel(/^Yes/).check();
    await reply.getByRole('button', { name: 'Check my answer' }).click();

    await expect(reply.getByRole('heading', { name: 'Second reply' })).toBeFocused();
    await expect(reply.getByText(/^Bus keeps its bindings in a list at run time/)).toBeVisible();
    await expect(page.getByRole('tablist', { name: 'Diagrams' }).getByRole('tab', { name: 'Order events' }))
      .toHaveAttribute('aria-selected', 'true');
    await expect(stage(page, 'Answer with the diagram')).toBeVisible();
  });
});

test.describe('diagram challenge: gating, persistence, reset, instructor mode', () => {
  test('Next stays locked until the challenge is passed', async ({ page }) => {
    await openDemo(page);
    await expect(nextButton(page)).toBeDisabled();
    await answerExploreFromCode(page);
    await lockIn(page);
    await expect(nextButton(page)).toBeDisabled();

    await finishExplore(page);
    await expect(nextButton(page)).toBeEnabled();
    await nextButton(page).click();
    await expect(page.getByRole('heading', { name: 'Review Without Editing', level: 2 })).toBeVisible();
  });

  test('reload restores each challenge state', async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto(DEMO);
    await waitForBoot(page);
    const fromCode = () => stage(page, 'Answer from the code');
    const reload = async () => {
      await page.reload();
      await waitForBoot(page);
    };

    await fromCode().getByLabel(HYPOTHESIS).fill('The bindings decide.');
    await question(fromCode(), 1).getByLabel('partner-gateway', { exact: true }).check();
    await reload();
    await expect(fromCode().getByLabel(HYPOTHESIS)).toHaveValue('The bindings decide.');
    await expect(question(fromCode(), 1).getByLabel('partner-gateway', { exact: true })).toBeChecked();

    await openBindingLine(page);
    await fromCode().getByRole('button', { name: 'Pin this line' }).click();
    await fromCode().getByLabel(VIEW_WISH).fill('Each consumer with its binding.');
    await question(fromCode(), 2).getByLabel('deploy/broker.toml', { exact: true }).check();
    await fromCode().getByLabel('Fairly sure', { exact: true }).check();
    await lockIn(page);
    await reload();
    await expect(stage(page, 'The agent’s reply')).toBeVisible();
    await expect(fromCode().getByRole('button', { name: 'Lock in my answer' })).toBeHidden();
    await openLockedAnswer(page);
    await expect(question(fromCode(), 1).getByLabel('partner-gateway', { exact: true })).toBeDisabled();
    await expect(fromCode().getByRole('button', { name: 'deploy/broker.toml:13', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Diagram', exact: true })).not.toHaveAttribute('aria-disabled', 'true');

    const withDiagram = stage(page, 'Answer with the diagram');
    await question(withDiagram, 1).getByLabel('trip-site-notifications', { exact: true }).check();
    await question(withDiagram, 1).getByLabel('warehouse-etl', { exact: true }).check();
    await withDiagram.getByRole('button', { name: 'Check my answers' }).click();
    await withDiagram.getByRole('button', { name: 'Continue to the new question' }).click();
    await reload();
    await expect(stage(page, 'A new question')).toBeVisible();
    await expect(question(stage(page, 'Answer with the diagram'), 1).getByText('Correct', { exact: true })).toBeVisible();

    const followUp = stage(page, 'A new question');
    await followUp.getByLabel('trip-site-notifications', { exact: true }).check();
    await followUp.getByLabel('warehouse-etl', { exact: true }).check();
    await followUp.getByRole('button', { name: 'Check my answer' }).click();
    await followUp.getByRole('button', { name: 'Show the comparison' }).click();
    await reload();
    const compare = stage(page, 'Compare your answers');
    await expect(compare).toBeVisible();
    await expect(nextButton(page)).toBeDisabled();

    await compare.getByLabel('What did the diagram put side by side that you had to search for?').fill('Consumers beside bindings.');
    await compare.getByRole('group', { name: 'Which mechanism hid the answer in the code?' })
      .getByLabel('Bindings in a configuration file, with wildcard keys').check();
    await compare.getByRole('button', { name: 'Finish the challenge' }).click();
    await reload();
    await expect(stage(page, 'Compare your answers').getByText('You completed this challenge. Further checks are practice.')).toBeVisible();
    await expect(stage(page, 'Compare your answers').getByLabel('What did the diagram put side by side that you had to search for?'))
      .toHaveValue('Consumers beside bindings.');
    await expect(nextButton(page)).toBeEnabled();
  });

  test('the timer pauses while another step is shown', async ({ page }) => {
    await page.clock.install();
    await openDemo(page, '#review');
    await page.clock.fastForward('02:00');
    await page.getByRole('button', { name: '← Previous', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Explore the Project', level: 2 })).toBeVisible();
    await page.clock.fastForward('30:00');
    await page.getByRole('button', { name: /^Step 2:/ }).click();

    const fromCode = stage(page, 'Answer from the code');
    await question(fromCode, 1).getByLabel('order.* on trip-site-notifications').check();
    await fromCode.getByLabel('Sure', { exact: true }).check();
    await fromCode.getByRole('group', { name: 'Which view would you ask the agent for?' }).getByLabel('Component diagram').check();
    await lockIn(page);
    const reply = stage(page, 'The agent’s reply');
    await reply.getByRole('group', { name: /^Can this class diagram show/ }).getByLabel(/^No/).check();
    await reply.getByRole('button', { name: 'Check my answer' }).click();
    await stage(page, 'Answer with the diagram').getByRole('button', { name: 'Check my answer' }).click();
    await stage(page, 'Answer with the diagram').getByRole('button', { name: 'Continue to the evidence check' }).click();
    const evidence = stage(page, 'Check the diagram against the code');
    await evidence.getByLabel(/^Yes: its binding key/).check();
    await evidence.getByRole('button', { name: 'Check my answer' }).click();
    await evidence.getByRole('button', { name: 'Show the comparison' }).click();

    // Two minutes on this step count; the half hour on step 1 does not.
    await expect(stage(page, 'Compare your answers').getByText(/^Your experience, not an experiment: from the code 2 min \d+ s · /))
      .toBeVisible();
  });

  test('Reset Step clears the challenge after confirmation', async ({ page }) => {
    await openDemo(page);
    await answerExploreFromCode(page);
    await lockIn(page);
    await page.getByRole('link', { name: 'Reset Current Step' }).click();
    const dialog = page.getByRole('dialog', { name: 'Reset the current step?' });

    await expect(dialog).toContainText('your diagram challenge answers and times');
    await dialog.getByRole('button', { name: 'Reset step', exact: true }).click();
    const fromCode = stage(page, 'Answer from the code');
    await expect(fromCode.getByLabel(HYPOTHESIS)).toHaveValue('');
    await expect(fromCode.getByRole('button', { name: 'Lock in my answer' })).toBeDisabled();
    await expect(stage(page, 'The agent’s reply')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Diagram', exact: true })).toHaveAttribute('aria-disabled', 'true');
  });

  test('instructor mode works like the student view, never locks, and shows keys only after Solution', async ({ page }) => {
    await page.goto(URL + '&instructor-mode=true');
    await waitForBoot(page);
    const fromCode = stage(page, 'Answer from the code');

    await expect(challenge(page).getByText('Instructor mode: work through this step as a student would. It never locks, and nothing you enter is saved. Press Solution to show the answer keys.'))
      .toBeVisible();
    await expect(challenge(page).getByText('(answer key)')).toHaveCount(0);
    await fromCode.getByLabel(HYPOTHESIS).fill('The bindings decide.');
    await question(fromCode, 1).getByLabel('warehouse-etl', { exact: true }).check();
    await expect(question(fromCode, 1).getByLabel('warehouse-etl', { exact: true })).toBeChecked();
    await expect(stage(page, 'The agent’s reply')).toHaveCount(0);
    await expect(nextButton(page)).toBeEnabled();

    await page.getByRole('link', { name: 'Solution' }).click();

    await expect(question(fromCode, 1).getByLabel('partner-gateway (answer key)')).toBeChecked();
    await expect(fromCode.getByText(/^Its binding # matches every key/)).toBeVisible();
    await expect(stage(page, 'The agent’s reply').getByRole('button', { name: 'Show the diagram' })).toBeVisible();
    await expect(challenge(page).getByRole('status').filter({ hasText: 'Answer keys shown.' })).toHaveCount(1);
    await expect(nextButton(page)).toBeEnabled();
    await a11yCheckpoint(page, 'diagram-challenge-demo: instructor answer key', { feature: 'diagram-challenge' });
  });
});

// Saved progress with steps 1 and 2 passed: known answers and times.
const PASSED_EXPLORE = {
  v: 1, state: 'done', passed: true,
  a: { answers: { receivers: [0], bindings: 0 }, confidence: 'fairly-sure', seconds: 372.4 },
  b: { answers: { receivers: [0, 1, 2], bindings: 0 }, checked: { receivers: [0, 1, 2], bindings: 0 }, first: { receivers: [0, 1, 2], bindings: 0 }, attempts: 1, seconds: 65 },
  f: { answers: { cancelled: [1, 2] }, checked: { cancelled: [1, 2] }, first: { cancelled: [1, 2] }, attempts: 1, seconds: 40 },
  d: { consolidation: 'Side by side.', answers: { mechanism: 0 }, checked: { mechanism: 0 }, attempts: 1 },
};
const PASSED_REVIEW = {
  v: 1, state: 'done', passed: true,
  a: { answers: { 'cancel-route': 1 }, confidence: 'sure', view: 'class', seconds: 95 },
  c: { answers: { fits: 0 }, checked: { fits: 0 } },
  b: { answers: { 'cancel-route': 0 }, checked: { 'cancel-route': 0 }, first: { 'cancel-route': 0 }, attempts: 1, seconds: 31 },
  e: { answers: { verified: 0 }, checked: { verified: 0 }, attempts: 1 },
  d: { consolidation: 'Bindings.', answers: { mechanism: 0 }, checked: { mechanism: 0 }, attempts: 1 },
};
const SAVED_PROGRESS = {
  step: 2, progressVersion: 1, stepKeys: ['explore', 'review', 'choose-view'],
  stepsUnlocked: [0, 1, 2], stepsVisited: [0, 1], stepsPassed: [0, 1], quizPassed: [],
  files: {}, stepFiles: {},
  diagramChallenges: { 'key:explore': PASSED_EXPLORE, 'key:review': PASSED_REVIEW },
};

async function seedProgress(page) {
  await page.addInitScript(progress => {
    localStorage.setItem('tutorial-progress-diagram-challenge-demo', JSON.stringify(progress));
  }, SAVED_PROGRESS);
}

function resultsRow(scope, title) {
  return scope.getByRole('table', { name: 'Correct answers and times for each diagram challenge' })
    .getByRole('row', { name: new RegExp('^' + title) });
}

test.describe('diagram challenge: plan-first and the results card', () => {
  test('results card lists every challenge with both times', async ({ page }) => {
    await seedProgress(page);
    await page.goto(DEMO + '#choose-view');
    await waitForBoot(page);
    const plan = stage(page, 'Plan your requests');
    await question(plan, 1).getByLabel('No diagram: read services/trip_site/checkout.py').check();
    await question(plan, 2).getByLabel('A component diagram of the order events').check();
    await lockIn(page);
    const withDiagram = stage(page, 'Answer with the diagram');
    await question(withDiagram, 1).getByLabel('place()', { exact: true }).check();
    await question(withDiagram, 2).getByLabel('warehouse-etl', { exact: true }).check();
    await withDiagram.getByRole('button', { name: 'Check my answers' }).click();
    await withDiagram.getByRole('button', { name: 'Continue to the evidence check' }).click();
    const evidence = stage(page, 'Check the diagram against the code');
    await question(evidence, 1).getByLabel(/^That the diagram shows every binding/).check();
    await question(evidence, 2).getByLabel(/^No: the diagram shows all three/).check();
    await evidence.getByRole('button', { name: 'Check my answers' }).click();
    await evidence.getByRole('button', { name: 'Show the comparison' }).click();
    const compare = stage(page, 'Compare your answers');

    await expect(compare.getByText('Your plan', { exact: true }).first()).toBeVisible();
    await expect(resultsRow(compare, 'Explore the Project').getByRole('cell')).toHaveText([
      '1 of 2 correct6 min 12 s · Fairly sure', '2 of 2 correct1 min 5 s', '1 of 1 correct40 s',
      /^The bindings live in deploy\/broker\.toml/,
    ]);
    await expect(resultsRow(compare, 'Review Without Editing').getByRole('cell')).toHaveText([
      '0 of 1 correct1 min 35 s · Sure', '1 of 1 correct31 s', 'None', /^Imports and classes show/,
    ]);
    await compare.getByLabel('When was reading one file faster than asking for a diagram?').fill('For the checkout call.');
    await compare.getByRole('button', { name: 'Finish the challenge' }).click();
    await expect(compare.getByText(/^Challenge complete/)).toBeVisible();
    await a11yCheckpoint(page, 'diagram-challenge-demo: results card', { feature: 'diagram-challenge' });
  });

  test('the print view fills the results card from saved progress', async ({ page }) => {
    await seedProgress(page);
    await page.goto(DEMO + '/print');
    const results = page.getByRole('region', { name: 'Your results across the challenges' });

    await expect(resultsRow(results, 'Explore the Project').getByRole('cell').first()).toHaveText('1 of 2 correct6 min 12 s · Fairly sure');
    await expect(resultsRow(results, 'Review Without Editing').getByRole('cell').nth(1)).toHaveText('1 of 1 correct31 s');
  });
});

test.describe('diagram challenge: print view and popout', () => {
  test('print view renders the diagram and shows keys only in instructor mode', async ({ page }) => {
    await page.goto(DEMO + '/print');
    const block = page.getByRole('region', { name: 'Diagram challenge', exact: true })
      .filter({ hasText: 'Which queues receive an order.placed event?' });

    await expect(block.getByRole('heading', { name: 'Shown after you lock in' })).toBeVisible();
    // Production builds name the figure with the full auto-description; the
    // development build's client-side render starts with the same words.
    await expect(block.getByRole('img', { name: /^UML component diagram/ })).toBeVisible();
    await expect(block.getByText('warehouse-etl binds #, which is drawn as any key: deploy/broker.toml:18')).toBeVisible();
    await expect(block.getByRole('heading', { name: 'Diagram challenge key', includeHidden: true })).toBeHidden();

    await page.goto(DEMO + '/print?instructor-mode=true');
    await expect(page.getByRole('region', { name: 'Diagram challenge', exact: true })
      .filter({ hasText: 'Which queues receive an order.placed event?' })
      .getByRole('heading', { name: 'Diagram challenge key' })).toBeVisible();
  });

  test('popout shows the challenge read-only with a pointer to the main window', async ({ page }) => {
    await openDemo(page);
    const fromCode = stage(page, 'Answer from the code');
    await fromCode.getByLabel(HYPOTHESIS).fill('The bindings decide.');
    await question(fromCode, 1).getByLabel('warehouse-etl', { exact: true }).check();
    const popupOpened = page.waitForEvent('popup');
    await page.getByRole('button', { name: /Open instructions in separate window$/ }).click();
    const popup = await popupOpened;
    const detached = popup.getByRole('region', { name: 'Diagram challenge', exact: true });

    await expect(detached.getByText('Answer this diagram challenge in the main tutorial window.')).toBeVisible();
    await expect(question(detached, 1).getByLabel('warehouse-etl', { exact: true })).toBeChecked();
    await expect(question(detached, 1).getByLabel('warehouse-etl', { exact: true })).toBeDisabled();
    await expect(detached.getByRole('button', { name: 'Close this window and answer in the main window' })).toBeVisible();
    await expect(detached.getByRole('button', { name: /^Lock in/ })).toHaveCount(0);
    await a11yCheckpoint(popup, 'diagram-challenge-demo: read-only popout', { feature: 'diagram-challenge' });
  });
});
