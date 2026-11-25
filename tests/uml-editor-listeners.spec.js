// @ts-check
// Leak guard of the UML editor refactor, stage R3 (spec §3.7 and §3.8): a drag listens on the document
// only while it runs, and an open menu only while it is open. After each gesture below the document
// holds the same pointer, mouse, and key listeners as before it. It held at stage R0, where the drags
// shared listeners that lived as long as the page, and it must keep holding once every drag is a session.
// The listeners are read through the Chrome DevTools Protocol (DOMDebugger.getEventListeners).
const { test, expect } = require('@playwright/test');

const EDITOR = '/SEBook/tools/uml-editor';
const ORDERS = ['@startuml', 'class Order', 'class Customer', 'Order --> Customer', '@enduml'].join('\n');
const WATCHED_EVENTS = /^(pointer|mouse|key)/;

test.skip(({ browserName }) => browserName !== 'chromium', 'DOMDebugger.getEventListeners is Chromium\'s');

/**
 * The document's pointer, mouse, and key listeners, one entry per listener: its event, its phase, and
 * where its handler is defined, so a leaked listener names its handler.
 */
async function documentListeners(page) {
  const devTools = await page.context().newCDPSession(page);
  try {
    const { result } = await devTools.send('Runtime.evaluate', { expression: 'document' });
    const { listeners } = await devTools.send('DOMDebugger.getEventListeners', { objectId: result.objectId });
    return listeners
      .filter((listener) => WATCHED_EVENTS.test(listener.type))
      .map((listener) => `${listener.type}${listener.useCapture ? ' (capture)' : ''} at ${listener.scriptId}:${listener.lineNumber}:${listener.columnNumber}`)
      .sort();
  } finally {
    await devTools.detach();
  }
}

/**
 * The editor with the class diagram ORDERS drawn. Returns the source field (hidden on this page; ORDERS
 * goes in as a script would put it), Order's diagram item, and the diagram type's label, a visible
 * point beside the canvas.
 */
async function openOrders(page) {
  await page.goto(EDITOR);
  await expect(page.getByRole('region', { name: 'Visual editor palette', exact: true })).toBeVisible();
  const typeLabel = page.getByText('Diagram type:', { exact: true });
  await page.getByLabel('Diagram type:').selectOption('class');
  const source = page.getByLabel('ArchUML diagram source', { exact: true });
  await source.evaluate((textarea, text) => {
    textarea.value = text;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }, ORDERS);
  const order = page.getByRole('button', { name: /^Element Order — / });
  await expect(order).toBeVisible();
  // The pointer below works in the viewport's coordinates.
  await order.scrollIntoViewIfNeeded();
  return { source, order, beside: typeLabel };
}

async function centreOf(locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('the locator has no box on the page');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Presses on `from` and moves the pointer in steps by `by`, without releasing. */
async function pressAndMove(page, from, by) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + by.x, from.y + by.y, { steps: 8 });
}

test.describe('after a drag released on the canvas, a drag released outside it, a drag cancelled with Escape, and a menu closed by an outside press, the document holds the same pointer and key listeners as before', () => {
  test('a drag released on the canvas', async ({ page }) => {
    const { source, order } = await openOrders(page);
    const before = await documentListeners(page);

    await pressAndMove(page, await centreOf(order), { x: 60, y: 40 });
    await page.mouse.up();

    await expect(source, 'the drag moved Order').not.toHaveValue(ORDERS);
    expect(await documentListeners(page)).toEqual(before);
  });

  test('a drag released outside the canvas', async ({ page }) => {
    const { source, order, beside } = await openOrders(page);
    const outside = await centreOf(beside);
    const before = await documentListeners(page);

    const from = await centreOf(order);
    await pressAndMove(page, from, { x: outside.x - from.x, y: outside.y - from.y });
    await page.mouse.up();

    await expect(source, 'the drag moved Order').not.toHaveValue(ORDERS);
    expect(await documentListeners(page)).toEqual(before);
  });

  test('a drag cancelled with Escape', async ({ page }) => {
    const { source, order } = await openOrders(page);
    const before = await documentListeners(page);

    await pressAndMove(page, await centreOf(order), { x: 60, y: 40 });
    await page.keyboard.press('Escape');
    await page.mouse.up();

    // The editor's tool status line (a uml-pg-* id, spec §3.7) says the drag was cancelled.
    await expect(page.locator('#uml-pg-tool-status')).toHaveText('Cancelled.');
    await expect(source, 'the cancelled drag wrote nothing').toHaveValue(ORDERS);
    expect(await documentListeners(page)).toEqual(before);
  });

  test('a menu closed by a press outside it', async ({ page }) => {
    const { order, beside } = await openOrders(page);
    const before = await documentListeners(page);

    // Order's drawn hit box lies over its keyboard target, so the press goes to the point, as a hand's does.
    const { x, y } = await centreOf(order);
    await page.mouse.click(x, y, { button: 'right' });
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    // The open menu listens for a press outside it, so the comparison after it closes means something.
    await expect.poll(() => documentListeners(page), { message: 'the open menu listens on the document' }).not.toEqual(before);
    await beside.click();

    await expect(menu).toBeHidden();
    expect(await documentListeners(page)).toEqual(before);
  });
});
