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

  test('after showAuthoredDiagrams the pane sits beside the editor and the editor stays visible', async ({ page }) => {
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

  test('zoom in from Fit steps up from the fitted size and keeps the middle of the drawing in view', async ({ page }) => {
    await openDemo(page);
    await showDiagrams(page, [ORDER_EVENTS]);
    const pane = diagramPane(page);
    const drawing = componentDrawing(page);
    // ArchUML first fits a drawing that overflows its pane.
    await expect(pane.getByText('Fit', { exact: true })).toBeVisible();
    const fittedWidth = await drawingWidth(drawing);
    await pane.getByRole('button', { name: 'Reset zoom' }).click();
    await expect(pane.getByText('100%', { exact: true })).toBeVisible();
    const readableWidth = await drawingWidth(drawing);
    await pane.getByRole('button', { name: 'Fit diagram to screen', exact: true }).click();
    await expect(pane.getByText('Fit', { exact: true })).toBeVisible();
    const nextStep = ZOOM_STEPS.find(step => step > fittedWidth / readableWidth);

    await pane.getByRole('button', { name: 'Zoom in' }).click();

    await expect(pane.getByRole('button', { name: 'Zoom in' })).toBeFocused();
    await expect(pane.getByText(`${nextStep * 100}%`, { exact: true })).toBeVisible();
    expect(await drawingWidth(drawing)).toBeCloseTo(readableWidth * nextStep, 0);
    expect(await middleAsFarAsScrollAllows(drawing, { x: 0.5, y: 0.5 })).toEqual({ x: true, y: true });
  });

  test('zoom out never enlarges a fitted drawing, and from the smallest step it returns to Fit', async ({ page }) => {
    await openDemo(page);
    await showDiagrams(page, [ORDER_EVENTS]);
    const pane = diagramPane(page);
    const drawing = componentDrawing(page);
    const zoomOut = pane.getByRole('button', { name: 'Zoom out' });
    await expect(pane.getByText('Fit', { exact: true })).toBeVisible();
    const fittedWidth = await drawingWidth(drawing);

    await expect(zoomOut).toHaveAttribute('aria-disabled', 'true');
    // A dimmed button still takes a mouse click; it must change nothing.
    await zoomOut.click({ force: true });
    await expect(pane.getByText('Fit', { exact: true })).toBeVisible();
    expect(await drawingWidth(drawing)).toBeCloseTo(fittedWidth, 0);

    await pane.getByRole('button', { name: 'Zoom in' }).click();
    await expect(pane.getByText('Fit', { exact: true })).toBeHidden();
    await zoomOut.click();
    await expect(pane.getByText('Fit', { exact: true })).toBeVisible();
    expect(await drawingWidth(drawing)).toBeCloseTo(fittedWidth, 0);
  });

  test('clicking a fitted drawing shows the clicked part at reading size', async ({ page }) => {
    await openDemo(page);
    await showDiagrams(page, [ORDER_FAN_OUT]);
    const pane = diagramPane(page);
    const drawing = componentDrawing(page);
    const hint = pane.getByText(FIT_HINT, { exact: true });
    await expect(hint).toBeVisible();
    await pane.getByRole('button', { name: 'Reset zoom' }).click();
    const readableWidth = await drawingWidth(drawing);
    await pane.getByRole('button', { name: 'Fit diagram to screen', exact: true }).click();
    const fitted = await drawing.locator('svg').boundingBox();
    const clicked = { x: 0.6, y: 0.6 };

    await page.mouse.click(fitted.x + fitted.width * clicked.x, fitted.y + fitted.height * clicked.y);

    await expect(pane.getByText('100%', { exact: true })).toBeVisible();
    await expect(drawing).toBeFocused();
    await expect(hint).toBeHidden();
    expect(await drawingWidth(drawing)).toBeCloseTo(readableWidth, 0);
    expect(await middleAsFarAsScrollAllows(drawing, clicked)).toEqual({ x: true, y: true });
  });

  test('a newly shown diagram starts whole, at Fit, after the previous one was zoomed', async ({ page }) => {
    await openDemo(page);
    await showDiagrams(page, [ORDER_EVENTS]);
    const pane = diagramPane(page);
    await pane.getByRole('button', { name: 'Zoom in' }).click();
    await expect(pane.getByText('Fit', { exact: true })).toBeHidden();

    await showDiagrams(page, [ORDER_FAN_OUT]);

    await expect(pane.getByText('Fit', { exact: true })).toBeVisible();
    await expect(pane.getByText(FIT_HINT, { exact: true })).toBeVisible();
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
    await expect(question(stage(page, 'Answer from the code'), 1).getByLabel('partner-gateway', { exact: true })).toBeDisabled();
    await expect(page.getByRole('region', { name: /^UML component diagram with 5 components/ })).toBeVisible();
    await expect(codeEditor(page)).toBeHidden();
    await a11yCheckpoint(page, 'diagram-challenge-demo: locked', { feature: 'diagram-challenge' });
  });

  test('locked answers stay clearly marked, not by color alone, in light and dark mode', async ({ page }) => {
    await openDemo(page);
    await answerExploreFromCode(page);
    await lockIn(page);
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
        expect(look.mark, `${theme}: a chosen answer shows a check mark`).toContain('✔');
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

  test('instructor mode shows keys and never locks', async ({ page }) => {
    await page.goto(URL + '&instructor-mode=true');
    await waitForBoot(page);

    await expect(challenge(page).getByText('Instructor mode: answer keys and every panel are shown, and this step never locks.'))
      .toBeVisible();
    await expect(question(stage(page, 'Answer from the code'), 1).getByLabel('partner-gateway (answer key)')).toBeChecked();
    await expect(stage(page, 'Answer from the code').getByText(/^Its binding # matches every key/)).toBeVisible();
    await expect(stage(page, 'The agent’s reply').getByRole('button', { name: 'Show the diagram' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Diagram', exact: true })).not.toHaveAttribute('aria-disabled', 'true');
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
