const { test, expect } = require('@playwright/test');

const source = page => page.getByRole('textbox', { name: 'ArchUML diagram source', exact: true });
const element = (page, name) => page.getByRole('button', { name: `Element ${name} — Enter to select, arrows to nudge, Delete to remove`, exact: true });
const undo = page => page.getByRole('button', { name: /Undo$/ });
async function open(page, type, text) {
  await page.addInitScript(({ type, text }) => localStorage.setItem('uml-pg-autosave-' + type, text), { type, text });
  await page.goto('/SEBook/tools/uml-playground.html');
  await page.getByLabel('Diagram type:', { exact: true }).selectOption(type);
  await expect(source(page)).toHaveValue(text);
}
async function select(target) { await target.focus(); await target.press('Enter'); }
async function edit(page, name, value) {
  const field = page.getByRole('textbox', { name, exact: true });
  await field.fill(value);
  await field.press('Enter');
}

for (const key of ['Delete', 'Backspace', 'Control+z', 'Control+y']) {
  test(`${key} outside the editor cannot mutate a selected diagram`, async ({ page }) => {
    await open(page, 'class', '@startuml\nclass A\nclass B\nA --|> B\n@enduml');
    await select(element(page, 'A'));
    await page.keyboard.press('ArrowRight');
    if (key === 'Control+y') await undo(page).click();
    const before = await source(page).inputValue();
    await page.locator('#main-content').focus();
    await page.keyboard.press(key);
    await expect(source(page)).toHaveValue(before);
  });
}

test('a fresh edit after Undo starts a new history branch even during coalescing', async ({ page }) => {
  await open(page, 'class', '@startuml\nclass A\nclass B\n@enduml');
  // Keep edit timestamps in the same burst while browser event timers still run.
  await page.clock.setFixedTime(new Date('2026-10-20T00:00:00Z'));
  await select(element(page, 'A'));
  await edit(page, 'Highlight color (#hex or color name)', 'red');
  const redOnly = await source(page).inputValue();
  await select(element(page, 'B'));
  await edit(page, 'Highlight color (#hex or color name)', 'blue');
  await undo(page).click();
  await expect(source(page)).toHaveValue(redOnly);
  await select(element(page, 'A'));
  await edit(page, 'Highlight color (#hex or color name)', 'green');
  await expect(page.getByRole('button', { name: /Redo$/ })).toBeDisabled();
  await undo(page).click();
  await expect(source(page)).toHaveValue(redOnly);
});

for (const historyAction of ['Undo', 'Redo']) {
  test(`${historyAction} cannot steal focus from the next control the student chooses`, async ({ page }) => {
    await open(page, 'class', '@startuml\nclass A\nclass B\n@enduml');
    await select(element(page, 'A'));
    await page.keyboard.press('ArrowRight');
    if (historyAction === 'Redo') await undo(page).click();
    const now = new Date('2026-10-20T00:00:00Z');
    await page.clock.install({ time: now });
    await page.clock.pauseAt(now);
    await page.getByRole('button', { name: new RegExp(historyAction + '$') }).click();
    const add = page.getByRole('button', { name: 'Add element: Class', exact: true });
    await add.focus();
    await page.clock.runFor(1);
    await expect(add).toBeFocused();
    await add.press('Enter');
    await expect(element(page, 'Class')).toBeVisible();
    await expect(element(page, 'A')).toBeVisible();
    await expect(element(page, 'B')).toBeVisible();
  });
}

for (const key of ['ArrowRight', 'F2']) {
  test(`${key} cannot steal focus from the student's next control`, async ({ page }) => {
    await open(page, 'class', '@startuml\nclass A\nclass B\n@enduml');
    await select(element(page, 'A'));
    const now = new Date('2026-10-20T00:00:00Z');
    await page.clock.install({ time: now });
    await page.clock.pauseAt(now);
    await page.keyboard.press(key);
    const add = page.getByRole('button', { name: 'Add element: Class', exact: true });
    await add.focus();
    await page.clock.runFor(1);
    await expect(add).toBeFocused();
    await add.press('Enter');
    await expect(element(page, 'Class')).toBeVisible();
  });
}

for (const action of ['Reset Selected', 'Layout']) {
  test(`${action} can be undone without losing the preceding layout`, async ({ page }) => {
    const original = '@startuml\nclass A @pos(300, 200)\nclass B\nA --> B\n@enduml';
    await open(page, 'class', original);
    if (action === 'Layout') await page.getByLabel('Layout:', { exact: true }).selectOption('horizontal');
    else { await select(element(page, 'A')); await page.getByRole('button', { name: 'Reset Selected', exact: true }).click(); }
    await expect(source(page)).not.toHaveValue(original);
    await undo(page).click();
    await expect(source(page)).toHaveValue(original);
  });
}

test('class appearance changes preserve quoted member delimiters', async ({ page }) => {
  await open(page, 'class', '@startuml\nclass A { +label: String = "a;b"; +other: String = \'c;d\' }\n@enduml');
  await select(element(page, 'A'));
  await edit(page, 'Highlight color (#hex or color name)', 'red');
  await expect(source(page)).toHaveValue(/"a;b"/);
  await expect(source(page)).toHaveValue(/'c;d'/);
});

test('renaming a Venn set preserves its region contents', async ({ page }) => {
  const original = '@startuml\nset A\nset B\nA : onlyA\nA & B : both\n@enduml';
  await open(page, 'venn', original);
  await select(element(page, 'A'));
  await edit(page, 'Identifier', 'Renamed');
  await expect(source(page)).toHaveValue('@startuml\nset Renamed\nset B\nRenamed : onlyA\nRenamed & B : both\n@enduml');
  await expect(page.locator('#uml-pg-output')).toContainText('both');
  await expect(page.locator('#uml-pg-output')).not.toContainText('Unknown set');
  await undo(page).click();
  await expect(source(page)).toHaveValue(original);
});

test('adding a sequence branch preserves the layout attached to the following message', async ({ page }) => {
  const original = '@startuml\nparticipant A\nparticipant B\nalt [ready]\nA -> B: first\nend\nA -> B: after\n@layout schema=1 renderer="archuml-visual-editor"\nnode "label:seqmsg:6" x=200 y=400\n@endlayout\n@enduml';
  await open(page, 'sequence', original);
  await select(page.getByRole('button', { name: /^Fragment .*Enter to select/ }).first());
  await page.getByRole('button', { name: 'Add branch', exact: true }).click();
  const saved = await source(page).inputValue();
  const result = await page.evaluate(text => {
    const data = window.UMLShared.extractLayoutMetadata(text);
    return { line: data.text.split('\n').findIndex(line => line.includes('A -> B: after')), positions: data.layout.positions };
  }, saved);
  expect(result.positions['label:seqmsg:' + result.line]).toEqual({ x: 200, y: 400 });
  await undo(page).click();
  await expect(source(page)).toHaveValue(original);
});

test('a sequence fragment cannot be moved past the diagram end', async ({ page }) => {
  const original = '@startuml\nparticipant A\nparticipant B\nalt [ready]\nA -> B: first\nend\n@enduml';
  await open(page, 'sequence', original);
  await select(page.getByRole('button', { name: /^Fragment .*Enter to select/ }).first());
  await page.getByRole('button', { name: 'Move later', exact: true }).click();
  await expect(source(page)).toHaveValue(original);
});

for (const mode of ['right button', 'Escape']) {
  test(`${mode} prevents a class drag from changing saved layout`, async ({ page }) => {
    const original = '@startuml\nclass A @pos(100, 100)\nclass B @pos(300, 300)\nA --|> B\n@enduml';
    await open(page, 'class', original);
    const target = element(page, 'A');
    await select(target);
    await target.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'center' }));
    const box = await target.boundingBox();
    const button = mode === 'right button' ? 'right' : 'left';
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down({ button });
    await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 20, { steps: 5 });
    if (mode === 'Escape') await page.keyboard.press('Escape');
    await page.mouse.up({ button });
    await expect(source(page)).toHaveValue(original);
    if (mode === 'Escape') {
      const add = page.getByRole('button', { name: 'Add element: Class', exact: true });
      await add.click();
      await expect(add).toHaveAttribute('aria-pressed', 'true');
    }
  });
}

test('Escape cancels a palette drag before dropping the new class', async ({ page }) => {
  const original = '@startuml\nclass A\n@enduml';
  await open(page, 'class', original);
  const add = page.getByRole('button', { name: 'Add element: Class', exact: true });
  const preview = page.getByRole('region', { name: 'Diagram preview', exact: true });
  await add.scrollIntoViewIfNeeded();
  const start = await add.boundingBox();
  const end = await preview.boundingBox();
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width / 2, end.y + 100, { steps: 8 });
  await expect(page.locator('#uml-pg-tool-status')).toContainText('Esc to cancel');
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(source(page)).toHaveValue(original);
});

test('renaming a styled activity preserves its declaration and attached flows', async ({ page }) => {
  const original = '@startuml\n"Work" #lightblue\n(*) --> "Work"\n"Work" --> (*)\n@enduml';
  await open(page, 'activity', original);
  await select(element(page, 'Work'));
  await edit(page, 'Action text', 'Renamed');
  await expect(source(page)).toHaveValue(original.replaceAll('"Work"', '"Renamed"'));
  await expect(element(page, 'Renamed')).toBeVisible();
  await expect(element(page, 'Work')).toHaveCount(0);
  await undo(page).click();
  await expect(source(page)).toHaveValue(original);
});

test('duplicating a composite state preserves comments and gives children independent identities', async ({ page }) => {
  const original = '@startuml\nstate Parent {\n\' explain the child\nstate Child\nChild --> Outside\n}\nstate Outside\n@enduml';
  await open(page, 'state', original);
  await select(element(page, 'Parent'));
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+d' : 'Control+d');
  await expect(source(page)).toHaveValue(/state Parent2(?:\s+@pos\([^)]*\))?\s*\{\s*' explain the child\s*state Child2\s*Child2 --> Outside\s*\}/);
  await expect(element(page, 'Child')).toBeVisible();
  await expect(element(page, 'Child2')).toBeVisible();
  await undo(page).click();
  await expect(source(page)).toHaveValue(original);
});

test('Venn renaming retains multiword, case-insensitive, and compound region and note references', async ({ page }) => {
  const original = '@startuml\nset "My Set"\nset B\nMy Set : single\nmy set+B : plus\n"My Set"∩B : intersection\nnote above of MY SET&B: explanation\n@enduml';
  await open(page, 'venn', original);
  await select(element(page, 'My Set'));
  await edit(page, 'Identifier', 'Renamed');
  await expect(source(page)).toHaveValue('@startuml\nset Renamed\nset B\nRenamed : single\nRenamed+B : plus\n"Renamed"∩B : intersection\nnote above of Renamed&B: explanation\n@enduml');
  const output = page.locator('#uml-pg-output');
  for (const label of ['single', 'plus', 'intersection', 'explanation']) await expect(output).toContainText(label);
  await expect(output).not.toContainText('Unknown set');
  await undo(page).click();
  await expect(source(page)).toHaveValue(original);
});
