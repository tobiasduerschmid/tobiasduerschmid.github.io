const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');
const fs = require('fs');

const examples = [
  { type: 'class', model: 'class Account {\n+ balance: Money\n}\nclass Money\nAccount --> Money', target: 'Element: Account' },
  { type: 'sequence', model: 'participant Client\nparticipant Server\nClient -> Server : request', target: 'Text: Client' },
  { type: 'state', model: 'state Idle\nstate Running\nIdle --> Running : start', target: 'Element: Idle' },
  { type: 'component', model: 'component Service\ncomponent Store\nService --> Store', target: 'Element: Service' },
  { type: 'deployment', model: 'node Server\nnode Database\nServer --> Database', target: 'Element: Server' },
  { type: 'usecase', model: 'actor User\nusecase Login\nUser --> Login', target: 'Element: User' },
  { type: 'activity', model: '(*) --> "Validate"\n"Validate" --> (*)', target: 'Text: Validate' },
];

async function openDiagram(page, example = examples[0]) {
  const source = `@startuml\n${example.model}\n@enduml`;
  await page.addInitScript(({ type, source }) => {
    if (!localStorage.getItem('uml-pg-autosave-' + type)) localStorage.setItem('uml-pg-autosave-' + type, source);
  }, { type: example.type, source });
  await page.goto('/SEBook/tools/uml-playground');
  await page.getByLabel('Diagram type:').selectOption(example.type);
  await expect(page.getByRole('textbox', { name: 'ArchUML diagram source' })).toHaveValue(source);
  await expect(page.getByRole('region', { name: 'Diagram preview', exact: true }).locator('svg')).toContainText(example.target.replace(/^(Element|Text): /, ''));
  await expect(page.getByLabel('Callout target', { exact: true })).toContainText(example.target);
  await page.getByRole('button', { name: 'Callouts', exact: true }).click();
}

async function addCallout(page, target, text) {
  await page.getByLabel('Callout target', { exact: true }).selectOption({ label: target });
  await page.getByLabel('Explanation', { exact: true }).fill(text);
  await page.getByRole('button', { name: 'Add callout', exact: true }).click();
  // These SVG classes are the documented ArchUML teaching-callout contract.
  await expect(page.locator('.uml-callouts')).toContainText(text);
}

for (const example of examples) {
  test(`${example.type}: attach a callout through the editor`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await openDiagram(page, example);
    await addCallout(page, example.target, 'Explain this notation');
    await expect(page.getByRole('textbox', { name: 'ArchUML diagram source' })).toHaveValue(/callout right of .+ : Explain this notation/);
    await page.getByRole('button', { name: /Undo/ }).click();
    await expect(page.locator('.uml-callout')).toHaveCount(0);
    await page.getByRole('button', { name: /Redo/ }).click();
    await expect(page.locator('.uml-callouts')).toContainText('Explain this notation');
    expect(errors).toEqual([]);
  });
}

test('edit and remove imported callouts without changing note content', async ({ page }) => {
  await openDiagram(page, { ...examples[0], model: 'class Account\nnote right of Account\ncallout is ordinary note text\nend note\ncallout top of element Account : Original explanation' });
  await page.getByLabel('Saved callout').selectOption({ label: '1. Original explanation' });
  await page.getByLabel('Explanation', { exact: true }).fill('Revised explanation');
  await page.getByLabel('Preferred position').selectOption('left');
  await page.getByRole('button', { name: 'Save callout', exact: true }).click();
  await expect(page.locator('.uml-callout')).toHaveCount(1);
  await expect(page.locator('.uml-callouts')).toContainText('Revised explanation');
  await page.getByRole('button', { name: 'Remove callout', exact: true }).click();
  await expect(page.locator('.uml-callout')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'ArchUML diagram source' })).toHaveValue(/callout is ordinary note text/);
});

test('target repeated labels, connectors, and symbols', async ({ page }) => {
  await openDiagram(page, { ...examples[0], model: 'class Account {\n+ save()\n}\nclass Store {\n+ save()\n}\nAccount --> Store' });
  await addCallout(page, 'Text: +save() (2)', 'Second operation');
  await page.getByRole('button', { name: 'New callout', exact: true }).click();
  await addCallout(page, 'Relationship 1 — end', 'Arrowhead');
  await page.getByRole('button', { name: 'New callout', exact: true }).click();
  await addCallout(page, 'Shape: rect 1', 'Class compartment');
  await expect(page.locator('.uml-callout')).toHaveCount(3);
});

test('callout controls support keyboard entry in both themes', async ({ page }) => {
  await openDiagram(page);
  await expect(page.getByLabel('Callout target', { exact: true })).toBeFocused();
  await page.getByLabel('Callout target', { exact: true }).selectOption({ label: 'Element: Account' });
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Preferred position')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Explanation', { exact: true })).toBeFocused();
  await page.keyboard.type('Keyboard explanation');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.locator('.uml-callouts')).toContainText('Keyboard explanation');
  // The checkpoint audits both themes with transitions disabled during its flip.
  await a11yCheckpoint(page, 'uml-callout-editor');
  await page.getByRole('button', { name: 'Close callouts', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Callouts', exact: true })).toBeFocused();
});

test('named callouts follow element renames and are removed with their target', async ({ page }) => {
  await openDiagram(page);
  await addCallout(page, 'Element: Account', 'Account explanation');
  await page.getByRole('button', { name: 'Close callouts', exact: true }).click();
  await page.getByRole('button', { name: /^Element Account —/ }).press('Enter');
  await page.getByLabel('Name (id)', { exact: true }).fill('Wallet');
  await page.getByLabel('Name (id)', { exact: true }).press('Enter');
  await expect(page.locator('.uml-callouts')).toContainText('Account explanation');
  await expect(page.getByRole('textbox', { name: 'ArchUML diagram source' })).toHaveValue(/of element Wallet : Account explanation/);
  await page.getByRole('button', { name: /^Element Wallet —/ }).press('Delete');
  await expect(page.locator('.uml-callout')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Diagram preview', exact: true }).locator('svg')).toBeVisible();
  await page.getByRole('button', { name: /Undo/ }).click();
  await expect(page.locator('.uml-callouts')).toContainText('Account explanation');
});

test('changing layout preserves an unfinished explanation', async ({ page }) => {
  await openDiagram(page);
  await page.getByLabel('Callout target', { exact: true }).selectOption({ label: 'Element: Account' });
  await page.getByLabel('Explanation', { exact: true }).fill('Still writing this explanation');
  await page.getByLabel('Layout:', { exact: true }).selectOption('horizontal');
  await expect(page.getByLabel('Explanation', { exact: true })).toHaveValue('Still writing this explanation');
  await page.getByRole('button', { name: 'Add callout', exact: true }).click();
  await expect(page.locator('.uml-callouts')).toContainText('Still writing this explanation');
});

test('saving during a pending source render never overwrites a model declaration', async ({ page }) => {
  await openDiagram(page, { ...examples[0], model: 'class Account\ncallout right of element Account : Original' });
  await page.getByLabel('Saved callout').selectOption({ label: '1. Original' });
  await page.getByLabel('Explanation', { exact: true }).fill('Revised');
  await page.clock.install({ time: new Date('2026-10-20T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-20T12:00:01Z'));
  const source = page.getByRole('textbox', { name: 'ArchUML diagram source' });
  const updated = '@startuml\nclass Other\nclass Account\ncallout right of element Account : Original\n@enduml';
  await source.fill(updated);
  await page.getByRole('button', { name: 'Save callout', exact: true }).click();
  await expect(source).toHaveValue(updated);
  await page.clock.runFor(200);
  await page.getByRole('button', { name: 'Save callout', exact: true }).click();
  await expect(source).toHaveValue(updated.replace(': Original', ': Revised'));
  await expect(page.locator('.uml-callouts')).toContainText('Revised');
});

test('a renamed target cannot be overwritten by a stale callout draft', async ({ page }) => {
  await openDiagram(page, { ...examples[0], model: 'class Account\ncallout right of element Account : Original' });
  await page.getByLabel('Saved callout').selectOption({ label: '1. Original' });
  await page.getByLabel('Explanation', { exact: true }).fill('Unfinished revision');
  await page.getByRole('textbox', { name: 'ArchUML diagram source' }).fill('@startuml\nclass Wallet\ncallout right of element Wallet : Original\n@enduml');
  await expect(page.getByRole('button', { name: /^Element Wallet —/ })).toBeVisible();
  await expect(page.getByLabel('Explanation', { exact: true })).toHaveValue('Unfinished revision');
  await expect(page.getByRole('button', { name: 'Save callout', exact: true })).toBeDisabled();
  await expect(page.getByRole('region', { name: 'Teaching callouts' }).getByRole('status')).toContainText('changed');
  await page.getByLabel('Saved callout').selectOption({ label: '1. Original' });
  await expect(page.getByLabel('Callout target', { exact: true })).toHaveValue('element Wallet');
  await expect(page.getByRole('button', { name: 'Save callout', exact: true })).toBeEnabled();
});

test('closing and reopening a draft keeps its chosen target', async ({ page }) => {
  await openDiagram(page);
  await page.getByRole('button', { name: /^Element Account —/ }).press('Enter');
  await page.getByRole('button', { name: 'Add teaching callout', exact: true }).click();
  await expect(page.getByLabel('Callout target', { exact: true })).toHaveValue('element Account');
  await page.getByLabel('Callout target', { exact: true }).selectOption({ label: 'Element: Money' });
  await page.getByLabel('Explanation', { exact: true }).fill('Describe Money');
  await page.getByRole('button', { name: 'Close callouts', exact: true }).click();
  await page.getByRole('button', { name: 'Callouts', exact: true }).click();
  await expect(page.getByLabel('Callout target', { exact: true })).toHaveValue('element Money');
  await expect(page.getByLabel('Explanation', { exact: true })).toHaveValue('Describe Money');
});

test('a new draft cannot save a target removed from the diagram', async ({ page }) => {
  await openDiagram(page);
  await page.getByLabel('Callout target', { exact: true }).selectOption({ label: 'Element: Account' });
  await page.getByLabel('Explanation', { exact: true }).fill('Describe Account');
  await page.getByRole('textbox', { name: 'ArchUML diagram source' }).fill('@startuml\nclass Wallet\n@enduml');
  await expect(page.getByRole('button', { name: /^Element Wallet —/ })).toBeVisible();
  await expect(page.getByLabel('Explanation', { exact: true })).toHaveValue('Describe Account');
  await expect(page.getByRole('button', { name: 'Add callout', exact: true })).toBeDisabled();
});

test('Properties attaches a callout to the selected generalization connector', async ({ page }) => {
  await openDiagram(page, { ...examples[0], model: 'class Account\nclass Money\nAccount --|> Money' });
  await page.getByRole('button', { name: /^Relation segment 1 of edge-0 —/ }).press('Enter');
  await page.getByRole('button', { name: 'Add teaching callout', exact: true }).click();
  await expect(page.getByLabel('Callout target', { exact: true })).toHaveValue(/^shape /);
  await page.getByLabel('Explanation', { exact: true }).fill('Generalization');
  await page.getByRole('button', { name: 'Add callout', exact: true }).click();
  await expect(page.locator('.uml-callouts')).toContainText('Generalization');
});

test('Properties resolves a sequence participant through its display label', async ({ page }) => {
  await openDiagram(page, { type: 'sequence', target: 'Text: c: Client', model: 'participant c: Client\nparticipant s: Server\nc -> s : request' });
  await page.getByRole('button', { name: /^Element c: Client —/ }).press('Enter');
  await page.getByRole('button', { name: 'Add teaching callout', exact: true }).click();
  await expect(page.getByLabel('Callout target', { exact: true })).toHaveValue('text "c: Client"');
});

for (const [surface, path] of [
  ['standalone', '/SEBook/tools/uml-editor'],
  ['tutorial', '/SEBook/designpatterns/monopoly-state-pattern-uml-homework'],
]) {
  test(`${surface}: add and export a callout with the source editor hidden`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(path);
    await page.getByRole('button', { name: 'Add element: Class', exact: true }).press('Enter');
    await page.getByRole('button', { name: 'Add teaching callout', exact: true }).click();
    await page.getByLabel('Explanation', { exact: true }).fill('Created with visual controls');
    await page.getByRole('button', { name: 'Add callout', exact: true }).click();
    await expect(page.locator('.uml-callouts')).toContainText('Created with visual controls');
    if (surface === 'standalone') {
      await page.getByRole('button', { name: /Full screen/ }).click();
      await page.getByLabel('Explanation', { exact: true }).focus();
      await expect(page.getByLabel('Explanation', { exact: true })).toBeInViewport({ ratio: 1 });
      await page.getByRole('button', { name: 'Got it — dismiss tips', exact: true }).click();
      await page.locator('#uml-playground-wrap').screenshot({ path: testInfo.outputPath('callout-editor.png') });
    }
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download SVG/ }).click();
    const file = testInfo.outputPath('annotated-diagram.svg');
    await (await download).saveAs(file);
    expect(fs.readFileSync(file, 'utf8')).toContain('Created with visual controls');
  });
}

test('callout panel reflows on a narrow screen and is hidden in print', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await openDiagram(page);
  await addCallout(page, 'Element: Account', 'A template for accounts');
  const panel = page.getByRole('region', { name: 'Teaching callouts' });
  expect(await panel.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await a11yCheckpoint(page, 'uml-callout-editor-narrow', { include: '#uml-pg-callout-panel' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Got it — dismiss tips', exact: true }).click();
  await panel.scrollIntoViewIfNeeded();
  await page.locator('#uml-playground-wrap').screenshot({ path: testInfo.outputPath('callout-editor.png') });
  await page.emulateMedia({ media: 'print' });
  await expect(panel).toBeHidden();
  await expect(page.getByRole('button', { name: 'Callouts', exact: true })).toBeHidden();
  await expect(page.locator('.uml-callouts')).toContainText('A template for accounts');
});

for (const example of [examples[0], { type: 'sequence', target: 'Text: c: Client', model: 'participant c: Client\nparticipant s: Server\nc -> s : request' }]) {
  test(`${example.type}: right-click adds a callout directly to the clicked element`, async ({ page }) => {
    await openDiagram(page, example);
    await page.getByRole('button', { name: 'Close callouts' }).click();
    const label = example.type === 'class' ? 'Money' : 'c: Client';
    const node = page.getByRole('button', { name: new RegExp('^Element ' + label + ' —') });
    await node.scrollIntoViewIfNeeded();
    const box = await node.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
    await page.getByRole('menuitem', { name: 'Add callout', exact: true }).click();
    await expect(page.getByLabel('Callout target', { exact: true })).toHaveValue(example.type === 'class' ? 'element Money' : 'text "c: Client"');
    await expect(page.getByLabel('Explanation', { exact: true })).toBeFocused();
    await page.getByLabel('Explanation', { exact: true }).fill('Explain the clicked element');
    await page.getByRole('button', { name: 'Add callout', exact: true }).click();
    await expect(page.locator('.uml-callouts')).toContainText('Explain the clicked element');
  });
}

test('right-click attaches a callout to a relationship without choosing its target again', async ({ page }) => {
  await openDiagram(page, { ...examples[0], model: 'class Account\nclass Money\nAccount --|> Money' });
  await page.getByRole('button', { name: 'Close callouts' }).click();
  const route = page.getByRole('button', { name: /^Relation segment 1 of edge-0 —/ });
  await route.scrollIntoViewIfNeeded();
  const box = await route.evaluate(element => { const b = element.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; });
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
  await page.getByRole('menuitem', { name: 'Add callout', exact: true }).click();
  await expect(page.getByLabel('Callout target', { exact: true })).toHaveValue(/^shape /);
  await expect(page.getByLabel('Explanation', { exact: true })).toBeFocused();
});

async function beginCalloutDrag(page, index = 0) {
  await page.locator('.uml-callout-box').nth(index).scrollIntoViewIfNeeded();
  const box = await page.locator('.uml-callout-box').nth(index).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
}

test('dragging snaps a callout to the nearest element, persists, and is one undo step', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openDiagram(page);
  await addCallout(page, 'Element: Account', 'Keep this explanation');
  await page.getByRole('button', { name: 'Close callouts' }).click();
  const source = page.getByRole('textbox', { name: 'ArchUML diagram source' });
  const before = await source.inputValue();
  await expect(page.getByRole('button', { name: /^Element Money —/ })).toBeVisible();
  await page.locator('.uml-callout-box').scrollIntoViewIfNeeded();
  const destination = await page.getByRole('button', { name: /^Element Money —/ }).boundingBox();
  await beginCalloutDrag(page);
  await page.mouse.move(destination.x + destination.width + 16, destination.y + destination.height / 2, { steps: 8 });
  await expect(page.locator('.uml-pg-callout-snap-target')).toBeVisible();
  await page.mouse.up();
  await expect(source).toHaveValue(/callout right of element Money : Keep this explanation/);
  await expect(page.getByRole('button', { name: 'Edit callout: Keep this explanation', exact: true })).toBeFocused();
  await page.getByRole('button', { name: /Undo/ }).click();
  await expect(source).toHaveValue(before);
  await page.getByRole('button', { name: 'Callouts', exact: true }).click();
  await expect(page.getByLabel('Callout target', { exact: true })).toHaveValue('element Account');
  await expect(page.getByRole('button', { name: 'Save callout', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: /Redo/ }).click();
  await expect(source).toHaveValue(/callout right of element Money : Keep this explanation/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('uml-pg-autosave-class'))).toContain('callout right of element Money : Keep this explanation');
  await page.reload();
  await expect(source).toHaveValue(/callout right of element Money : Keep this explanation/);
});

test('Escape cancels a callout drag in fullscreen without changing the diagram', async ({ page }) => {
  await openDiagram(page);
  await page.getByRole('button', { name: /Full screen/ }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.id)).toBe('uml-playground-wrap');
  await addCallout(page, 'Element: Account', 'Do not move this');
  await page.getByRole('button', { name: 'Close callouts' }).click();
  const source = page.getByRole('textbox', { name: 'ArchUML diagram source' });
  const before = await source.inputValue();
  await expect(page.getByRole('button', { name: /^Element Money —/ })).toBeVisible();
  await page.locator('.uml-callout-box').scrollIntoViewIfNeeded();
  const destination = await page.getByRole('button', { name: /^Element Money —/ }).boundingBox();
  await beginCalloutDrag(page);
  await page.mouse.move(destination.x + destination.width / 2, destination.y + destination.height / 2, { steps: 8 });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.locator('.uml-pg-callout-snap-target')).toHaveCount(0);
  await expect(source).toHaveValue(before);
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.id)).toBe('uml-playground-wrap');
});

test('a callout can be retargeted with the keyboard without dragging', async ({ page }, testInfo) => {
  await openDiagram(page);
  await addCallout(page, 'Element: Account', 'Move with the keyboard');
  await page.getByRole('button', { name: 'Close callouts' }).click();
  await page.getByRole('button', { name: 'Edit callout: Move with the keyboard' }).press('Enter');
  await expect(page.getByLabel('Explanation', { exact: true })).toBeFocused();
  await page.getByLabel('Callout target', { exact: true }).selectOption('element Money');
  await page.getByLabel('Preferred position').selectOption('left');
  await page.getByRole('button', { name: 'Save callout', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'ArchUML diagram source' })).toHaveValue(/callout left of element Money : Move with the keyboard/);
  await a11yCheckpoint(page, 'keyboard callout move', { include: '#uml-playground-wrap' });
  await page.screenshot({ path: testInfo.outputPath('callout-move.png') });
});

test('dropping on an unlabeled activity symbol attaches the callout to that symbol', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openDiagram(page, examples[6]);
  await addCallout(page, 'Text: Validate', 'Starting point');
  await page.getByRole('button', { name: 'Close callouts' }).click();
  await page.locator('.uml-callout-box').scrollIntoViewIfNeeded();
  const symbol = page.locator('.uml-model-layer circle').first();
  const box = await symbol.boundingBox();
  await beginCalloutDrag(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole('textbox', { name: 'ArchUML diagram source' })).toHaveValue(/callout \w+ of (element __initial__|shape circle occurrence 1) : Starting point/);
});

test('dropping on a connector attaches to the relationship rather than a nearby class', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openDiagram(page);
  await addCallout(page, 'Element: Account', 'Relationship explanation');
  await page.getByRole('button', { name: 'Close callouts' }).click();
  await page.locator('.uml-callout-box').scrollIntoViewIfNeeded();
  const route = page.getByRole('button', { name: /^Relation segment 1 of / });
  const box = await route.evaluate(element => { const b = element.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; });
  await beginCalloutDrag(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  expect(errors).toEqual([]);
  await expect(page.getByRole('textbox', { name: 'ArchUML diagram source' })).toHaveValue(/callout \w+ of edge 1 middle : Relationship explanation/);
});

test('callout focus never applies model shortcuts to a previously selected class', async ({ page }) => {
  await openDiagram(page);
  await page.getByRole('button', { name: /^Element Account —/ }).press('Enter');
  await addCallout(page, 'Element: Account', 'Preserve the class');
  const source = page.getByRole('textbox', { name: 'ArchUML diagram source' });
  const before = await source.inputValue();
  const callout = page.getByRole('button', { name: 'Edit callout: Preserve the class' });
  await callout.press('Delete');
  await callout.press('ControlOrMeta+d');
  await callout.press('ArrowRight');
  await expect(source).toHaveValue(before);
});

test('a drop on a member label prefers that label over its enclosing class', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openDiagram(page);
  await addCallout(page, 'Element: Money', 'Explain this member');
  await page.getByRole('button', { name: 'Close callouts' }).click();
  await page.locator('.uml-callout-box').scrollIntoViewIfNeeded();
  const member = page.locator('.uml-model-layer text').filter({ hasText: '+balance: Money' });
  const box = await member.boundingBox();
  await beginCalloutDrag(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole('textbox', { name: 'ArchUML diagram source' })).toHaveValue(/of text "\+balance: Money" : Explain this member/);
});

test('an unresolved text draft does not block dragging another saved callout', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openDiagram(page);
  await addCallout(page, 'Element: Account', 'First explanation');
  await page.getByRole('button', { name: 'New callout', exact: true }).click();
  await addCallout(page, 'Element: Account', 'Second explanation');
  await page.getByLabel('Saved callout').selectOption({ label: '1. First explanation' });
  await page.getByLabel('Explanation', { exact: true }).fill('Unfinished explanation');
  const source = page.getByRole('textbox', { name: 'ArchUML diagram source' });
  await source.fill((await source.inputValue()).replace('First explanation', 'Changed in source'));
  await expect(page.getByRole('button', { name: 'Save callout', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Close callouts' }).click();
  await page.locator('.uml-callout-box').nth(1).scrollIntoViewIfNeeded();
  const destination = await page.getByRole('button', { name: /^Element Money —/ }).boundingBox();
  await beginCalloutDrag(page, 1);
  await page.mouse.move(destination.x + destination.width + 16, destination.y + destination.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(source).toHaveValue(/callout right of element Money : Second explanation/);
  await page.getByRole('button', { name: 'Callouts', exact: true }).click();
  await expect(page.getByLabel('Explanation', { exact: true })).toHaveValue('Unfinished explanation');
  await expect(page.getByRole('button', { name: 'Save callout', exact: true })).toBeDisabled();
});
