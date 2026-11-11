const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');

const source = page => page.getByRole('textbox', { name: 'ArchUML diagram source', exact: true });
const property = (page, name) => page.getByLabel(name, { exact: true });
const classDiagram = '@startuml\nclass A\nclass B\nclass C\nA -- B : original\n@enduml';
const sequence = '@startuml\nparticipant A\nparticipant B\nalt [ready]\nA -> B: first()\nelse [otherwise]\nB -> A: second()\nend\n@enduml';
const movedSequence = '@startuml\nparticipant A\nparticipant B\nalt [ready]\nelse [otherwise]\nB -> A: second()\nA -> B: first()\nend\n@enduml';

async function open(page, type, text) {
  await page.addInitScript(({ type, text }) => localStorage.setItem('uml-pg-autosave-' + type, text), { type, text });
  await page.goto('/SEBook/tools/uml-playground');
  await property(page, 'Diagram type:').selectOption(type);
  await expect(source(page)).toHaveValue(text);
}

async function select(target) {
  await target.focus();
  await target.press('Enter');
}

async function selectFirstRelation(page) {
  await select(page.getByRole('button', { name: /^Relation segment 1 of/ }).first());
}

async function expectDiagram(page, expected) {
  const lines = text => text.split('\n').map(line => line.trim().replace(/\s*:\s*/g, ': '));
  await expect.poll(async () => lines(await source(page).inputValue())).toEqual(lines(expected));
}

test('editing a relation label after rewiring keeps the new endpoint', async ({ page }) => {
  await open(page, 'class', classDiagram);
  await selectFirstRelation(page);
  await property(page, 'Target endpoint').selectOption('C');
  const label = property(page, 'Label');
  await label.fill('rewired');
  await label.press('Tab');

  await expectDiagram(page, classDiagram.replace('A -- B : original', 'A -- C : rewired'));
  await expect(property(page, 'Target endpoint')).toHaveValue('C');
});

test('changing relation type refreshes its applicable fields and retains keyboard focus', async ({ page }) => {
  await open(page, 'class', classDiagram);
  await selectFirstRelation(page);
  const type = property(page, 'Type');
  await type.focus();
  await type.selectOption('gen');

  await expect(type).toBeFocused();
  await expect(property(page, 'Target navigability')).toHaveCount(0);
  await expect(property(page, 'Target multiplicity / cardinality')).toHaveCount(0);
  await type.selectOption('assoc');
  await expect(type).toBeFocused();
  await expect(property(page, 'Target navigability')).toBeVisible();
  await expect(property(page, 'Target multiplicity / cardinality')).toBeVisible();
  await a11yCheckpoint(page, 'retained relation type properties', { include: '#uml-pg-props-pane' });
});

test('editing a message label after moving its branch changes the moved message', async ({ page }) => {
  await open(page, 'sequence', sequence);
  await selectFirstRelation(page);
  await property(page, 'Branch').selectOption('1');
  await expectDiagram(page, movedSequence);
  const label = property(page, 'Label');
  await label.fill('renamed()');
  await label.press('Tab');

  await expectDiagram(page, movedSequence.replace('first()', 'renamed()'));
});

test('moving a message repeatedly between branches retains the selected message and focus', async ({ page }) => {
  await open(page, 'sequence', sequence);
  await selectFirstRelation(page);
  const branch = property(page, 'Branch');
  await branch.focus();
  for (const value of ['1', '0', '1']) {
    await branch.selectOption(value);
    await expect(branch).toBeFocused();
    await expect(branch).toHaveValue(value);
    await expectDiagram(page, value === '0' ? sequence : movedSequence);
  }
});

test('changing a loop to an alternative exposes branch editing while keeping Kind focused', async ({ page }) => {
  const loop = '@startuml\nparticipant A\nparticipant B\nloop [ready]\nA -> B: first()\nend\n@enduml';
  await open(page, 'sequence', loop);
  await select(page.getByRole('button', { name: /^Fragment .*Enter to select/ }).first());
  await expect(page.getByRole('button', { name: 'Add branch', exact: true })).toHaveCount(0);
  const kind = property(page, 'Kind');
  await kind.focus();
  await kind.selectOption('alt');

  await expect(kind).toBeFocused();
  await expect(page.getByRole('button', { name: 'Add branch', exact: true })).toBeVisible();
  await expectDiagram(page, loop.replace('loop [ready]', 'alt [ready]'));
});
