const { test, expect } = require('@playwright/test');

const sourceInput = page => page.getByRole('textbox', { name: 'ArchUML diagram source', exact: true });
const element = (page, name) => page.getByRole('button', {
  name: `Element ${name} — Enter to select, arrows to nudge, Delete to remove`, exact: true,
});
const source = '@startuml\nclass Anchor @pos(30, 30)\nclass Class @pos(103, 200)\nclass Class2 @pos(300, 400)\nClass2 --|> Class\n@enduml';

test.use({ viewport: { width: 1600, height: 1200 } });

async function openDiagram(page, text = source) {
  await page.addInitScript(text => localStorage.setItem('uml-pg-autosave-class', text), text);
  await page.goto('/SEBook/tools/uml-playground.html');
  await page.getByRole('checkbox', { name: 'Visual edit', exact: true }).check();
  await expect(sourceInput(page)).toHaveValue(text);
  await expect(element(page, 'Class2')).toBeVisible();
}

async function dragNearCenter(page, offset) {
  const moving = element(page, 'Class2');
  // Open properties before measuring, since its pane changes the canvas width.
  await moving.focus();
  await moving.press('Enter');
  const target = await element(page, 'Class').boundingBox();
  const start = await moving.boundingBox();
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2 + offset, start.y + start.height / 2, { steps: 6 });
  await page.mouse.up();
}

async function centerDifference(page) {
  const target = await element(page, 'Class').boundingBox();
  const moved = await element(page, 'Class2').boundingBox();
  return Math.abs((target.x + target.width / 2) - (moved.x + moved.width / 2));
}

for (const zoom of ['unchanged', 'Zoom out', 'Zoom in']) {
  test(`Snap aligns nearby class centers after dropping at ${zoom}`, async ({ page }) => {
    await openDiagram(page);
    if (zoom !== 'unchanged') await page.getByRole('button', { name: zoom, exact: true }).click();
    await dragNearCenter(page, 2);
    await expect.poll(() => centerDifference(page), { message: 'Dropped class centers must align, not merely show a guide' }).toBeLessThan(0.1);
    const arrowXs = await page.evaluate(() => window.UMLShared.collectEditableRoutes(
      document.querySelector('#uml-pg-output svg'))[0].points.map(point => point.x));
    expect(Math.max(...arrowXs) - Math.min(...arrowXs), 'Aligned generalization has no horizontal jog').toBeLessThan(0.1);
    await page.getByRole('button', { name: /Undo$/ }).click();
    await expect(sourceInput(page)).toHaveValue(source);
  });
}

test('Snap disabled preserves a deliberately small center offset', async ({ page }) => {
  await openDiagram(page);
  await page.getByRole('checkbox', { name: 'Snap to layout grid', exact: true }).uncheck();
  await dragNearCenter(page, 3);
  await expect.poll(() => centerDifference(page)).toBeGreaterThan(2);
});

test('deleting a self-generalization preserves a keyword-named class and its other relation', async ({ page }) => {
  const text = '@startuml\nclass Class { +name: str }\nclass Class2\nClass --|> Class\nClass *-- Class2\n@enduml';
  await openDiagram(page, text);
  // The self-route uses the renderer\'s ordinal fallback rather than a source-line id.
  const selfRoute = page.getByRole('button', { name: /^Relation segment \d+ of edge-0 —/ }).first();
  await selfRoute.focus();
  await selfRoute.press('Enter');
  await page.getByRole('button', { name: /Delete$/ }).click();
  await expect(sourceInput(page)).toHaveValue('@startuml\nclass Class { +name: str }\nclass Class2\nClass *-- Class2\n@enduml');
  await page.getByRole('button', { name: /Undo$/ }).click();
  await expect(sourceInput(page)).toHaveValue(text);
});

test('different-width classes retain center alignment after the source is rendered again', async ({ page }) => {
  await openDiagram(page, source.replace('class Class @pos(103, 200)', 'class Class @pos(103, 200) { +a_long_member_name: int }'));
  await dragNearCenter(page, 2);
  await expect.poll(() => centerDifference(page)).toBeLessThan(0.1);
});

test('Snap keeps grid placement away from another class alignment', async ({ page }) => {
  await openDiagram(page);
  await dragNearCenter(page, 45);
  const text = await sourceInput(page).inputValue();
  const position = text.match(/class Class2 @pos\(([^,]+), ([^)]+)\)/);
  expect(position, 'Moving a class must save its layout').not.toBeNull();
  expect(Number(position[1]) % 10).toBe(0);
  expect(Number(position[2]) % 10).toBe(0);
  expect(await centerDifference(page)).toBeGreaterThan(30);
});
