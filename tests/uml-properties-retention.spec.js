const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');

const source = page => page.getByLabel('ArchUML diagram source', { exact: true });
const pageErrors = new WeakMap();

test.beforeEach(async ({ page }) => {
  const errors = [];
  pageErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page), 'retained property edits must not raise browser errors').toEqual([]);
});

async function openElement(page, type, text, name) {
  await page.addInitScript(({ type, text }) => {
    localStorage.setItem('uml-pg-autosave-' + type, text);
  }, { type, text });
  await page.goto('/SEBook/tools/uml-playground.html');
  await page.getByLabel('Diagram type:', { exact: true }).selectOption(type);
  await page.getByRole('checkbox', { name: 'Visual edit', exact: true }).check();
  await expect(source(page)).toHaveValue(text);
  const element = page.getByRole('button', {
    name: `Element ${name} — Enter to select, arrows to nudge, Delete to remove`, exact: true
  });
  await element.focus();
  await element.press('Enter');
}

for (const example of [
  { type: 'state', declaration: 'state Parent {\n  state Child\n  Child --> Parent : done\n}', add: '+ Add sub-state', retained: 'Child --> Renamed : done', added: 'state Sub' },
  { type: 'component', declaration: 'component Parent {\n  portin input\n}', add: '+ Add port-out', retained: 'portin "?input"?', added: 'portout "?out"?' },
  { type: 'deployment', declaration: 'node Parent {\n  artifact Existing\n}', add: '+ Component', retained: 'artifact Existing', added: 'component Component' },
  { type: 'er', declaration: 'entity Parent {\n  # existing\n}', add: '+ Add attribute', retained: '# existing', added: 'new_attribute' }
]) {
  test(`${example.type} child edits preserve a container identifier just changed in Properties`, async ({ page }) => {
    await openElement(page, example.type, `@startuml\n${example.declaration}\n@enduml`, 'Parent');
    const identifier = page.getByRole('textbox', { name: 'Identifier', exact: true });
    await identifier.fill('Renamed');
    await identifier.press('Enter');
    await expect(source(page)).toHaveValue(/Renamed/);

    await page.getByRole('button', { name: example.add, exact: true }).click();

    await expect(source(page)).toHaveValue(/Renamed/);
    await expect(source(page)).not.toHaveValue(/\bParent\b/);
    await expect(source(page)).toHaveValue(new RegExp(example.retained));
    await expect(source(page)).toHaveValue(new RegExp(example.added));
    await a11yCheckpoint(page, `${example.type} retained container properties`, { include: '#uml-pg-props-pane' });
  });
}

test('renaming an implicit display label updates its retained field before later styling', async ({ page }) => {
  await openElement(page, 'usecase', '@startuml\nactor Parent\n@enduml', 'Parent');
  const identifier = page.getByRole('textbox', { name: 'Identifier', exact: true });
  const label = page.getByRole('textbox', { name: 'Display label', exact: true });
  await identifier.fill('Renamed');
  await identifier.press('Tab');
  await expect(label).toBeFocused();
  await expect(label).toHaveValue('Renamed');

  const highlight = page.getByRole('textbox', { name: 'Highlight color (#hex or name)', exact: true });
  await highlight.fill('#336699');
  await highlight.press('Enter');

  await expect(source(page)).not.toHaveValue(/\bParent\b/);
  await expect(source(page)).toHaveValue(/Renamed/);
  await expect(source(page)).toHaveValue(/#336699/);
  await a11yCheckpoint(page, 'retained generic name properties', { include: '#uml-pg-props-pane' });
});

test('a Venn label rename refreshes the identifier before it is changed back', async ({ page }) => {
  await openElement(page, 'venn', '@startuml\nset A\n@enduml', 'A');
  const label = page.getByRole('textbox', { name: 'Display label', exact: true });
  await label.fill('B');
  await label.press('Enter');
  const identifier = page.getByRole('textbox', { name: 'Identifier', exact: true });
  await expect(identifier).toHaveValue('B');
  await identifier.fill('A');
  await identifier.press('Enter');

  await expect(source(page)).toHaveValue(/^set A$/m);
  await expect(source(page)).not.toHaveValue(/^set B$/m);
  await expect(label).toHaveValue('A');
});

test('system membership applies to a system just renamed in Properties', async ({ page }) => {
  await openElement(page, 'usecase', '@startuml\nusecase "Sign in" as Login\nrectangle "System" as sys { }\n@enduml', 'System');
  const identifier = page.getByRole('textbox', { name: 'Identifier', exact: true });
  await identifier.fill('account');
  await identifier.press('Tab');
  await expect(page.getByRole('textbox', { name: 'Display label', exact: true })).toBeFocused();

  await page.getByRole('checkbox', { name: 'Include Sign in', exact: true }).check();

  await expect(source(page)).toHaveValue(/rectangle "System" as account\s*\{\s*Login\s*\}/);
  await expect(page.getByRole('checkbox', { name: 'Include Sign in', exact: true })).toBeChecked();
  await a11yCheckpoint(page, 'retained system membership properties', { include: '#uml-pg-props-pane' });
});

test('successive CRC property edits preserve the name and both independent lists', async ({ page }) => {
  await openElement(page, 'crc', '@startuml\ncard Player {\n  responsibility: Take a turn\n  collaborator: Board\n}\n@enduml', 'Player');
  const name = page.getByRole('textbox', { name: 'Class name', exact: true });
  await name.fill('Monopoly Player');
  await name.press('Tab');
  const responsibilities = page.getByRole('textbox', { name: 'Responsibilities (one per line)', exact: true });
  await expect(responsibilities).toBeFocused();
  await responsibilities.fill('Take a turn\nChoose the next state');
  await page.getByRole('textbox', { name: 'Collaborators (one per line)', exact: true }).click();
  const collaborators = page.getByRole('textbox', { name: 'Collaborators (one per line)', exact: true });
  await collaborators.fill('Board\nPlayerState');
  await collaborators.press('Tab');

  await expect(source(page)).toHaveValue(/card "Monopoly Player" as Player/);
  await expect(source(page)).toHaveValue(/responsibility: Choose the next state/);
  await expect(source(page)).toHaveValue(/collaborator: Board/);
  await expect(source(page)).toHaveValue(/collaborator: PlayerState/);
  await a11yCheckpoint(page, 'retained CRC properties', { include: '#uml-pg-props-pane' });
});
