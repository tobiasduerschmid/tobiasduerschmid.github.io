const { test, expect } = require('@playwright/test');

async function openState(page, source, parentName = 'Parent') {
  await page.addInitScript(text => localStorage.setItem('uml-pg-autosave-state', text), source);
  await page.goto('/SEBook/tools/uml-playground.html');
  await page.getByLabel('Diagram type:', { exact: true }).selectOption('state');
  await page.getByRole('checkbox', { name: 'Visual edit', exact: true }).check();
  const parent = page.getByRole('button', { name: `Element ${parentName} — Enter to select, arrows to nudge, Delete to remove`, exact: true });
  await parent.focus();
  await parent.press('Enter');
}

async function stateModel(page) {
  return page.evaluate(() => window.UMLStateDiagram.parse(document.getElementById('uml-pg-input').value));
}

async function openSequence(page, text) {
  await page.addInitScript(source => localStorage.setItem('uml-pg-autosave-sequence', source), text);
  await page.goto('/SEBook/tools/uml-playground.html');
  await page.getByLabel('Diagram type:', { exact: true }).selectOption('sequence');
  await expect(page.getByRole('textbox', { name: 'ArchUML diagram source', exact: true })).toHaveValue(text);
}

test('an unclosed fragment remains editable and reports its missing end', async ({ page }) => {
  await openSequence(page, '@startuml\nparticipant A\nparticipant B\nalt [ready]\nA -> B: work\n@enduml');
  await expect(page.getByRole('region', { name: 'Draft diagnostics' })).toContainText(/alt.*missing.*end/i);
  await expect(page.locator('#uml-pg-output svg')).toBeVisible();
});

test('fragment words inside a multiline note do not produce diagnostics', async ({ page }) => {
  await openSequence(page, '@startuml\nparticipant A\nparticipant B\nnote over A\nopt\nelse\nend\nend note\nA -> B: work\n@enduml');
  await expect(page.getByRole('region', { name: 'Draft diagnostics' })).toBeHidden();
});

test('critical regions are not incorrectly restricted to a single operand', async ({ page }) => {
  await openSequence(page, '@startuml\nparticipant A\nparticipant B\ncritical\nA -> B: first\nelse\nB -> A: second\nend\n@enduml');
  await expect(page.getByRole('region', { name: 'Draft diagnostics' })).toBeHidden();
});

test('a self-generalization example inside a note does not produce a model diagnostic', async ({ page }) => {
  const text = '@startuml\nclass A\nnote right of A\nA --|> A\nend note\n@enduml';
  await page.addInitScript(source => localStorage.setItem('uml-pg-autosave-class', source), text);
  await page.goto('/SEBook/tools/uml-playground.html');
  await expect(page.getByRole('textbox', { name: 'ArchUML diagram source', exact: true })).toHaveValue(text);
  await expect(page.getByRole('region', { name: 'Draft diagnostics' })).toBeHidden();
});

test('adding two substates creates distinct visible state identities', async ({ page }) => {
  await openState(page, '@startuml\nstate Parent {\nstate Existing\n[*] --> Existing\n}\n@enduml');
  await page.getByRole('button', { name: '+ Add sub-state', exact: true }).click();
  await page.getByRole('button', { name: '+ Add sub-state', exact: true }).click();
  const children = (await stateModel(page)).states.filter(state => state.parent === 'Parent' && state.type === 'state');
  expect(children).toHaveLength(3);
  expect(new Set(children.map(state => state.name)).size).toBe(3);
  for (const state of children) {
    await expect(page.getByRole('button', { name: `Element ${state.name} — Enter to select, arrows to nudge, Delete to remove`, exact: true })).toBeVisible();
  }
});

const stateReferences = '@startuml\nstate Parent {\nstate Child\nstate Done\n[*] --> Child\nChild --> Done: finish\nChild : entry / begin()\nnote right of Done: Child is an example\n}\n@enduml';

test('renaming a substate through its parent preserves transitions and state behavior', async ({ page }) => {
  await openState(page, stateReferences);
  const name = page.getByRole('textbox', { name: 'Sub-state 1 name', exact: true });
  await name.fill('Renamed');
  await name.press('Tab');
  const model = await stateModel(page);
  expect(model.states.some(state => state.name === 'Child')).toBe(false);
  expect(model.states.find(state => state.name === 'Renamed').entryAction).toBe('begin()');
  expect(model.transitions.some(edge => edge.from === 'Renamed' && edge.to === 'Done')).toBe(true);
  expect(model.notes[0].lines).toEqual(['Child is an example']);
});

test('removing a substate through its parent removes its incident transitions', async ({ page }) => {
  await openState(page, stateReferences);
  await page.getByRole('button', { name: 'Remove sub-state 1', exact: true }).click();
  const model = await stateModel(page);
  expect(model.states.some(state => state.name === 'Child')).toBe(false);
  expect(model.transitions.some(edge => edge.from === 'Child' || edge.to === 'Child')).toBe(false);
  expect(model.states.some(state => state.name === 'Done')).toBe(true);
  expect(model.notes[0].lines).toEqual(['Child is an example']);
});

const inlineStateReferences = '@startuml\nstate Outer { state Child }\nstate Elsewhere\nChild --> Elsewhere : leave\n@enduml';

test('renaming an inline substate through its parent updates its declaration and external transition', async ({ page }) => {
  await openState(page, inlineStateReferences, 'Outer');
  const name = page.getByRole('textbox', { name: 'Sub-state 1 name', exact: true });
  await name.fill('Renamed');
  await name.press('Tab');
  const model = await stateModel(page);
  expect(model.states.some(state => state.name === 'Child')).toBe(false);
  expect(model.states.find(state => state.name === 'Renamed')?.parent).toBe('Outer');
  expect(model.states.find(state => state.name === 'Elsewhere')?.parent || null).toBe(null);
  expect(model.transitions.some(edge => edge.from === 'Renamed' && edge.to === 'Elsewhere' && edge.label === 'leave')).toBe(true);
  await expect(page.getByRole('button', { name: 'Element Renamed — Enter to select, arrows to nudge, Delete to remove', exact: true })).toBeVisible();
});

test('removing an inline substate through its parent removes its declaration and external transition', async ({ page }) => {
  await openState(page, inlineStateReferences, 'Outer');
  await page.getByRole('button', { name: 'Remove sub-state 1', exact: true }).click();
  const model = await stateModel(page);
  expect(model.states.some(state => state.name === 'Child')).toBe(false);
  expect(model.transitions.some(edge => edge.from === 'Child' || edge.to === 'Child')).toBe(false);
  expect(model.states.some(state => state.name === 'Outer')).toBe(true);
  expect(model.states.some(state => state.name === 'Elsewhere')).toBe(true);
  await expect(page.getByRole('button', { name: 'Element Child — Enter to select, arrows to nudge, Delete to remove', exact: true })).toHaveCount(0);
});

test('adding a direct substate preserves nested states, kinds, and action text', async ({ page }) => {
  await openState(page, '@startuml\nstate Parent {\nentry / configure({key: "}"}); start()\nstate Middle {\nentry / begin()\nstate Choice <<choice>>\nstate Leaf\n[*] --> Choice\nChoice --> Leaf : [ready]\n}\nnote right of Middle\nstate Example\nend note\n[*] --> Middle\n}\n@enduml');
  await page.getByRole('button', { name: '+ Add sub-state', exact: true }).click();
  const model = await stateModel(page);
  const states = Object.fromEntries(model.states.map(state => [state.name, state]));
  expect(states.Middle.parent).toBe('Parent');
  expect(states.Leaf.parent).toBe('Middle');
  expect(states.Choice.parent).toBe('Middle');
  expect(states.Choice.type).toBe('choice');
  expect(states.Parent.entryAction).toBe('configure({key: "}"}); start()');
  expect(states.Middle.entryAction).toBe('begin()');
  expect(states.Example).toBeUndefined();
  expect(model.notes[0].lines).toEqual(['state Example']);
  expect(model.transitions.find(edge => edge.from === 'Choice' && edge.to === 'Leaf').parent).toBe('Middle');
});
