const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');

const PLAYGROUND = '/SEBook/tools/uml-playground';
const TUTORIAL = '/SEBook/designpatterns/monopoly-state-pattern-uml-homework';
const DRAFT = '@startuml\nclass Class { +name: str }\nclass Class2\nClass --|> Class\nClass *-- Class2\n@enduml';

async function openDraft(page) {
  await page.goto(PLAYGROUND);
  const source = page.getByRole('textbox', { name: 'ArchUML diagram source', exact: true });
  await source.fill(DRAFT);
  await expect(page.getByRole('region', { name: 'Draft diagnostics' })).toContainText('an element cannot generalize itself');
  return source;
}


// The editor has separate accessible and visual SVG hitboxes. Use the visible
// coordinates for real pointer actions, without focusing the keyboard overlay.
async function clickDiagramItem(page, item, button = 'left') {
  const id = await item.getAttribute('data-layout-id');
  await page.locator('#uml-pg-output .uml-pg-edit-hitbox[data-layout-id=' + JSON.stringify(id) + ']').click({ button });
}

async function expectBrowserFullscreen(page, active) {
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.id || null))
    .toBe(active ? 'uml-playground-wrap' : null);
}

for (const [surface, url] of [['playground', PLAYGROUND], ['tutorial', TUTORIAL]]) {
  for (const dark of [false, true]) {
    test(`${surface} browser fullscreen has an unobscured exit in ${dark ? 'dark' : 'light'} mode`, async ({ page }) => {
      await page.goto(url);
      await page.evaluate(dark => document.documentElement.classList.toggle('dark-mode', dark), dark);
      const entry = page.getByRole('button', { name: '⛶ Full screen', exact: true });
      await entry.click();
      await expectBrowserFullscreen(page, true);
      const controls = page.getByRole('group', { name: 'Fullscreen controls', exact: true });
      const exit = controls.getByRole('button', { name: 'Exit full screen', exact: true });
      await expect(exit).toBeFocused();
      await expect(exit).toBeInViewport({ ratio: 1 });
      await exit.click({ trial: true });
      await a11yCheckpoint(page, 'UML fullscreen exit controls', { include: '#uml-pg-fullscreen-bar' });
      // Narrow screens may scroll the palette/editor; exit must remain reachable.
      await page.setViewportSize({ width: 390, height: 700 });
      await page.locator('#uml-playground-wrap').evaluate(el => { el.scrollTop = el.scrollHeight; });
      await expect(exit).toBeInViewport({ ratio: 1 });
      await exit.click();
      await expectBrowserFullscreen(page, false);
      await expect(entry).toBeFocused();
      await entry.click();
      await expectBrowserFullscreen(page, true);
      await page.keyboard.press('Escape');
      await expectBrowserFullscreen(page, false);
      await expect(entry).toBeFocused();
      // Browser-driven exits must update the controls too.
      await entry.click();
      await expectBrowserFullscreen(page, true);
      await page.evaluate(() => document.exitFullscreen());
      await expect(entry).toBeVisible();
      await expect(entry).toHaveAttribute('aria-pressed', 'false');
    });
  }
}

test('a student can click the canvas after typing and toggle browser fullscreen with F', async ({ page }) => {
  const source = await openDraft(page);
  await source.press('End');
  await source.press('f');
  await expectBrowserFullscreen(page, false);
  await expect(source).toHaveValue(DRAFT + 'f');
  await source.fill(DRAFT);
  const preview = page.getByRole('region', { name: 'Diagram preview', exact: true });
  await preview.click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Control+f');
  await expectBrowserFullscreen(page, false);
  await page.keyboard.press('Escape');
  await page.keyboard.press('f');
  await expectBrowserFullscreen(page, true);
  await page.keyboard.press('f');
  await expectBrowserFullscreen(page, false);
  await page.locator('#main-content').focus();
  await page.keyboard.press('f');
  await expectBrowserFullscreen(page, false);
});

for (const priorFocus of ['source', 'toolbar', 'another element']) {
  test(`a student deletes only the clicked relation after focusing ${priorFocus}, then undoes it`, async ({ page }) => {
    const source = await openDraft(page);
    if (priorFocus === 'toolbar') await page.getByRole('button', { name: '100%', exact: true }).focus();
    if (priorFocus === 'another element') await page.locator('.uml-pg-edit-a11y-target[data-layout-id="Class2"]').focus();
    const relation = page.getByRole('button', { name: /^Relation segment/ }).last();
    // SVG lines have zero-width/height DOM boxes despite a clickable stroke.
    await relation.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'center' }));
    const line = await relation.boundingBox();
    await page.mouse.click(line.x + line.width / 2, line.y + line.height / 2);
    await expect(page.getByRole('heading', { name: /^Relation(?: —|$)/ })).toBeVisible();
    // Do not use locator.press(): the click must transfer focus for the learner.
    await page.keyboard.press('Delete');
    await expect(source).not.toHaveValue(/Class \*-- Class2/);
    await expect(source).toHaveValue(/class Class2/);
    await expect(source).toHaveValue(/Class --\|> Class/);
    await page.getByRole('button', { name: /Undo/ }).click();
    await expect(source).toHaveValue(/Class \*-- Class2/);
  });
}

test('draft diagnostics stay above the full-width canvas instead of pushing it aside', async ({ page }) => {
  await openDraft(page);
  const diagnostics = page.getByRole('region', { name: 'Draft diagnostics' });
  const canvas = page.locator('#uml-pg-output');
  await expect.poll(async () => {
    const warning = await diagnostics.boundingBox();
    const drawing = await canvas.boundingBox();
    return warning && drawing && warning.y + warning.height <= drawing.y + 1;
  }).toBe(true);
  const preview = await page.getByRole('region', { name: 'Diagram preview', exact: true }).boundingBox();
  const drawing = await canvas.boundingBox();
  expect(drawing.width).toBeGreaterThan(preview.width * 0.9);
});


test('a student can rename through the context menu in fullscreen and undo after leaving', async ({ page }) => {
  await page.goto(TUTORIAL);
  await page.getByRole('button', { name: 'Add element: Class', exact: true }).press('Enter');
  await page.getByRole('button', { name: '⛶ Full screen', exact: true }).click();
  await expectBrowserFullscreen(page, true);
  await expect(page.getByRole('button', { name: 'Exit full screen', exact: true })).toBeFocused();
  const node = page.getByRole('button', { name: 'Element Class — Enter to select, arrows to nudge, Delete to remove', exact: true });
  await clickDiagramItem(page, node, 'right');
  await page.getByRole('menuitem', { name: /Rename label/ }).click();
  const rename = page.getByRole('textbox', { name: 'Rename Class', exact: true });
  await expect(rename).toBeFocused();
  await rename.fill('FirstDraft');
  await rename.press('f');
  await expect(rename).toHaveValue('FirstDraftf');
  await expectBrowserFullscreen(page, true);
  await rename.press('Enter');
  await expect(page.locator('#uml-pg-input')).toHaveValue(/FirstDraftf/);
  await page.getByRole('button', { name: 'Exit full screen', exact: true }).click();
  await expectBrowserFullscreen(page, false);
  await page.getByRole('button', { name: /Undo$/ }).click();
  await expect(page.locator('#uml-pg-input')).not.toHaveValue(/FirstDraftf/);
  await expect(node).toBeVisible();
});

test('a denied browser fullscreen request leaves the editor usable', async ({ page }) => {
  await page.addInitScript(() => {
    Element.prototype.requestFullscreen = () => Promise.reject(new DOMException('Fullscreen denied', 'NotAllowedError'));
  });
  await page.goto(TUTORIAL);
  await page.getByRole('button', { name: '⛶ Full screen', exact: true }).click();
  await expectBrowserFullscreen(page, false);
  await expect(page.locator('#uml-pg-tool-status')).toContainText('could not enter fullscreen');
  await page.getByRole('button', { name: 'Add element: Class', exact: true }).press('Enter');
  await expect(page.locator('#uml-pg-input')).toHaveValue(/class Class/);
});

for (const exit of ['Escape', 'browser']) {
  test(`exiting fullscreen with ${exit} cancels an uncommitted inline rename`, async ({ page }) => {
    await page.goto(TUTORIAL);
    await page.getByRole('button', { name: 'Add element: Class', exact: true }).press('Enter');
    const source = page.locator('#uml-pg-input');
    const before = await source.inputValue();
    await page.getByRole('button', { name: '⛶ Full screen', exact: true }).click();
    await expectBrowserFullscreen(page, true);
    await expect(page.getByRole('button', { name: 'Exit full screen', exact: true })).toBeFocused();
    await clickDiagramItem(page, page.getByRole('button', { name: 'Element Class — Enter to select, arrows to nudge, Delete to remove', exact: true }), 'right');
    await page.getByRole('menuitem', { name: /Rename label/ }).click();
    await page.getByRole('textbox', { name: 'Rename Class', exact: true }).fill('Uncommitted label');
    if (exit === 'Escape') await page.keyboard.press('Escape');
    else await page.evaluate(() => document.exitFullscreen());
    await expectBrowserFullscreen(page, false);
    await expect(page.getByRole('button', { name: '⛶ Full screen', exact: true })).toBeFocused();
    await expect(source).toHaveValue(before);
    await expect(page.getByRole('textbox', { name: 'Rename Class', exact: true })).toHaveCount(0);
  });
}

test('adding a class dismisses its help so Undo remains clickable', async ({ page }) => {
  await page.goto(TUTORIAL);
  const add = page.getByRole('button', { name: 'Add element: Class', exact: true });
  await add.hover();
  await add.focus();
  const tip = page.getByRole('tooltip').filter({ hasText: 'Add element: Class —' });
  await expect(tip).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(tip).toBeHidden();
  await page.getByRole('button', { name: /Undo$/ }).click();
  await expect(page.locator('#uml-pg-input')).not.toHaveValue(/class Class\b/);
  // Dismissal is only for activation: a later visit must still offer help.
  await add.focus();
  await expect(tip).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tip).toBeHidden();
});

test('an overlapping palette tooltip cannot block Undo after activation', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.goto(TUTORIAL);
  const add = page.getByRole('button', { name: 'Add element: Class', exact: true });
  await add.press('Enter');
  await add.press('Enter');
  await page.getByRole('button', { name: 'Got it — dismiss tips', exact: true }).click();
  const undo = page.getByRole('button', { name: /Undo$/ });
  await undo.hover();
  await add.focus();
  const tip = page.getByRole('tooltip').filter({ hasText: 'Add element: Class —' });
  await expect(tip).toBeVisible();
  const before = await page.locator('#uml-pg-input').inputValue();
  await add.press('Enter');
  await undo.click();
  await expect(page.locator('#uml-pg-input')).toHaveValue(before);
});

test('fullscreen keeps keyboard help tooltips in front of the editor', async ({ page }) => {
  await page.goto(TUTORIAL);
  await page.getByRole('button', { name: '⛶ Full screen', exact: true }).click();
  await expectBrowserFullscreen(page, true);
  await expect(page.getByRole('button', { name: 'Exit full screen', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Add element: Class', exact: true }).focus();
  const tip = page.getByRole('tooltip').filter({ hasText: 'Add element: Class —' });
  await expect(tip).toBeVisible();
  await expect.poll(() => tip.evaluate(el => {
    const rect = el.getBoundingClientRect();
    const top = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return top === el || el.contains(top);
  })).toBe(true);
});


test('the homework canvas and properties fit a 1366×768 laptop screen', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.addInitScript(() => localStorage.setItem('uml-pg-help-dismissed', '1'));
  await page.goto(TUTORIAL);
  await expect(page.getByRole('region', { name: 'Diagram preview', exact: true })).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('region', { name: 'Properties', exact: true })).toBeInViewport({ ratio: 1 });
});

test('the mouse wheel reaches the homework properties while quick tips are shown', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(TUTORIAL);
  await expect(page.getByRole('region', { name: 'Visual editor tips', exact: true })).toBeVisible();
  await page.getByRole('region', { name: 'Visual editor palette', exact: true }).hover();
  await page.mouse.wheel(0, 1200);
  // Scroll offsets are whole pixels while the layout is fractional.
  await expect(page.getByRole('region', { name: 'Properties', exact: true })).toBeInViewport({ ratio: 0.99 });
});

test('printing a fullscreen editor stays light even when the screen theme is dark', async ({ page }) => {
  await page.goto(TUTORIAL);
  await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
  await page.getByRole('button', { name: '⛶ Full screen', exact: true }).click();
  await expectBrowserFullscreen(page, true);
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('button', { name: 'Exit full screen', exact: true })).toBeHidden();
  await expect.poll(() => page.locator('#uml-playground-wrap').evaluate(el =>
    getComputedStyle(el, '::backdrop').backgroundColor)).toBe('rgb(255, 255, 255)');
});
