const { test, expect } = require('@playwright/test');

const sourceInput = (page) => page.getByRole('textbox', { name: 'ArchUML diagram source', exact: true });
const undoButton = (page) => page.getByRole('button', { name: /Undo$/ });
const redoButton = (page) => page.getByRole('button', { name: /Redo$/ });

async function openDiagram(page, type, source) {
  await page.addInitScript(({ diagramType, text }) => {
    localStorage.setItem('uml-pg-autosave-' + diagramType, text);
  }, { diagramType: type, text: source });
  await page.goto('/SEBook/tools/uml-playground.html');
  await page.getByLabel('Diagram type:', { exact: true }).selectOption(type);
  await page.getByRole('checkbox', { name: 'Visual edit', exact: true }).check();
  await expect(sourceInput(page)).toHaveValue(source);
}

function elementTarget(page, label, kind = 'Element') {
  return page.getByRole('button', {
    name: `${kind} ${label} — Enter to select, arrows to nudge, Delete to remove`, exact: true,
  });
}

async function selectElement(page, label, kind) {
  const target = elementTarget(page, label, kind);
  await target.focus();
  await target.press('Enter');
}

async function editProperty(page, label, value) {
  const input = page.getByRole('textbox', { name: label, exact: true });
  await input.fill(value);
  await input.press('Enter');
}

async function deleteSelected(page) {
  await page.getByRole('button', { name: /Delete$/, exact: false }).click();
}

const populatedContainers = [
  { type: 'component', label: 'C', body: 'portin "request" as req\nportout "response" as res',
    source: '@startuml\ncomponent C {\nportin "request" as req\nportout "response" as res\n}\ncomponent D\nC.req --> D\n@enduml' },
  { type: 'state', label: 'Outer', body: 'state Inner\n[*] --> Inner',
    source: '@startuml\nstate Outer {\nstate Inner\n[*] --> Inner\n}\n@layout schema=1 renderer="archuml-visual-editor"\nedge "edge-0" points="80,80 80,120 140,120"\n@endlayout\n@enduml' },
  { type: 'deployment', label: 'Server', body: 'component Service\nartifact "app.jar" as App',
    source: '@startuml\nnode Server {\ncomponent Service\nartifact "app.jar" as App\n}\n@enduml' },
  { type: 'er', label: 'Person', body: 'id\nname',
    source: '@startuml\nentity Person {\nid\nname\n}\n@enduml' },
];

for (const fixture of populatedContainers) {
  test(`changing ${fixture.type} appearance preserves its contents`, async ({ page }) => {
    await openDiagram(page, fixture.type, fixture.source);
    await selectElement(page, fixture.label);
    await editProperty(page, 'Highlight color (#hex or name)', 'lightblue');
    const edited = await sourceInput(page).inputValue();
    for (const declaration of fixture.body.split('\n')) expect(edited).toContain(declaration);
    expect(edited).toContain('#lightblue');
    if (fixture.type === 'state') {
      const routes = await page.evaluate(text => window.UMLShared.extractLayoutMetadata(text).layout.routes, edited);
      expect(routes['edge-0'].points).toEqual([{ x: 80, y: 80 }, { x: 80, y: 120 }, { x: 140, y: 120 }]);
    }
    await expect(elementTarget(page, fixture.label)).toBeVisible();
  });
}

test('deleting a classifier preserves unrelated member types, notes, and relation labels', async ({ page }) => {
  await openDiagram(page, 'class', '@startuml\nclass A\nclass B { +owner: A }\nclass C\nnote right of C: A is an example\nB --> C: A\nA --> C: incident\n@enduml');
  await selectElement(page, 'A');
  await deleteSelected(page);
  const source = await sourceInput(page).inputValue();
  expect(source).not.toMatch(/^class A$/m);
  expect(source).not.toContain('A --> C: incident');
  expect(source).toContain('class B { +owner: A }');
  expect(source).toContain('note right of C: A is an example');
  expect(source).toContain('B --> C: A');
  await expect(elementTarget(page, 'B')).toBeVisible();
});

test('renaming rewrites references without changing unrelated property names or text', async ({ page }) => {
  await openDiagram(page, 'class', '@startuml\nclass A\nclass B { +A: int; +owner: A; +find(A: int, value: A): List<A>; +label: String = "A" }\nclass C\nnote right of C: A is an example\nB --> C: A\nA --> C: incident\n@enduml');
  await selectElement(page, 'A');
  await editProperty(page, 'Name (id)', 'Renamed');
  const source = await sourceInput(page).inputValue();
  expect(source).toContain('class Renamed');
  expect(source).toContain('Renamed --> C: incident');
  expect(source).toContain('+A: int');
  expect(source).toContain('+owner: Renamed');
  expect(source).toContain('+find(A: int, value: Renamed): List<Renamed>');
  expect(source).toContain('+label: String = "A"');
  expect(source).toContain('note right of C: A is an example');
  expect(source).toContain('B --> C: A');
  await expect(elementTarget(page, 'B')).toBeVisible();
});

test('class identifier collisions are rejected without changing either classifier', async ({ page }) => {
  const original = '@startuml\nclass A { +a: int }\nclass B { +b: int }\nA --> B\n@enduml';
  await openDiagram(page, 'class', original);
  await selectElement(page, 'A');
  await editProperty(page, 'Name (id)', 'B');
  await expect(sourceInput(page)).toHaveValue(original);
  await expect(page.getByText('"B" is already used. Pick a different identifier.', { exact: true })).toBeVisible();
  await expect(elementTarget(page, 'A')).toBeVisible();
  await expect(elementTarget(page, 'B')).toBeVisible();
});

test('editing an aliased class preserves its label and uses the alias as its identity', async ({ page }) => {
  await openDiagram(page, 'class', '@startuml\nclass "Display Name" as A { name: String }\nclass B\nA --> B\n@enduml');
  await selectElement(page, 'Display Name');
  await expect(page.getByRole('textbox', { name: 'Name (id)', exact: true })).toHaveValue('A');
  await editProperty(page, 'Stereotype (e.g. <<service>>)', 'service');
  await editProperty(page, 'Name (id)', 'Renamed');
  const source = await sourceInput(page).inputValue();
  expect(source).toContain('class "Display Name" as Renamed');
  expect(source).toContain('Renamed --> B');
  expect(source).toContain('name: String');
});

test('ER attribute edits keep attributes separate and retain applied appearance', async ({ page }) => {
  await openDiagram(page, 'er', '@startuml\nentity Person #lightblue {\nid\nname\n}\n@enduml');
  await selectElement(page, 'Person');
  await editProperty(page, 'Attribute 1 name', 'personId');
  const attributes = await page.evaluate(() => window.UMLERDiagram.parse(document.getElementById('uml-pg-input').value).entities[0].attrs);
  expect(attributes.map(attribute => attribute.name)).toEqual(['personId', 'name']);
  await expect(elementTarget(page, 'Person')).toBeVisible();
});

test('each diagram type retains its own undo and redo history', async ({ page }) => {
  const original = '@startuml\nclass A\n@enduml';
  await openDiagram(page, 'class', original);
  await selectElement(page, 'A');
  await editProperty(page, 'Name (id)', 'Renamed');
  const renamed = await sourceInput(page).inputValue();
  await page.getByLabel('Diagram type:', { exact: true }).selectOption('sequence');
  const sequence = await sourceInput(page).inputValue();
  await expect(undoButton(page)).toBeDisabled();
  await page.getByLabel('Diagram type:', { exact: true }).selectOption('class');
  await undoButton(page).click();
  await expect(sourceInput(page)).toHaveValue(original);
  await page.getByLabel('Diagram type:', { exact: true }).selectOption('sequence');
  await expect(sourceInput(page)).toHaveValue(sequence);
  await expect(redoButton(page)).toBeDisabled();
  await page.getByLabel('Diagram type:', { exact: true }).selectOption('class');
  await redoButton(page).click();
  await expect(sourceInput(page)).toHaveValue(renamed);
});

const multilineClass = '@startuml\nclass A {\n +count: int\n +run(): void\n}\nclass B\nA --> B\n@enduml';

test('editing a multiline class leaves no orphan members or closing braces', async ({ page }) => {
  await openDiagram(page, 'class', multilineClass);
  await selectElement(page, 'A');
  await editProperty(page, 'Stereotype (e.g. <<service>>)', 'service');
  const source = await sourceInput(page).inputValue();
  expect(source.match(/count: int/g)).toHaveLength(1);
  expect(source.match(/run\(\): void/g)).toHaveLength(1);
  expect(source.match(/\}/g)).toHaveLength(1);
  expect(source).toContain('A --> B');
});

test('keyboard duplication copies every member of a multiline class', async ({ page }) => {
  await openDiagram(page, 'class', multilineClass);
  await selectElement(page, 'A');
  await page.keyboard.press('ControlOrMeta+d');
  const source = await sourceInput(page).inputValue();
  expect(source.match(/count: int/g)).toHaveLength(2);
  expect(source.match(/run\(\): void/g)).toHaveLength(2);
  expect(source.match(/\{/g)).toHaveLength(2);
  expect(source.match(/\}/g)).toHaveLength(2);
  await expect(elementTarget(page, 'A')).toBeVisible();
  await expect(elementTarget(page, 'B')).toBeVisible();
});

for (const [type, declaration] of [
  ['state', 'state Parent {\nstate Child\n[*] --> Child\nnote right of Child\nstate Child\nend note\n}'],
  ['deployment', 'node Parent {\ncomponent Child\n}'],
]) {
  test(`duplicating a populated ${type} container creates independent child identities`, async ({ page }) => {
    await openDiagram(page, type, `@startuml\n${declaration}\n@enduml`);
    await selectElement(page, 'Parent');
    await page.keyboard.press('ControlOrMeta+d');
    await expect(elementTarget(page, 'Child')).toBeVisible();
    await expect(elementTarget(page, 'Child2')).toBeVisible();
    const model = await page.evaluate(type => {
      const source = window.UMLShared.extractLayoutMetadata(document.getElementById('uml-pg-input').value).text;
      return window[type === 'state' ? 'UMLStateDiagram' : 'UMLDeploymentDiagram'].parse(source);
    }, type);
    const elements = model.states || model.elements;
    expect(elements.find(element => element.name === 'Child').parent || elements.find(element => element.name === 'Child').parentId).toBe('Parent');
    expect(elements.find(element => element.name === 'Child2').parent || elements.find(element => element.name === 'Child2').parentId).toBe('Parent2');
    if (type === 'state') {
      expect(model.transitions.map(transition => transition.to)).toEqual(['Child', 'Child2']);
      expect(model.notes.map(note => note.target)).toEqual(['Child', 'Child2']);
      expect(model.notes.map(note => note.lines)).toEqual([['state Child'], ['state Child']]);
    }
  });
}

test('a system label containing braces survives a property edit with its members', async ({ page }) => {
  await openDiagram(page, 'usecase', '@startuml\nusecase "Checkout" as UC\nrectangle "System {v1}" as S {\nUC\n}\n@enduml');
  await selectElement(page, 'System {v1}');
  await editProperty(page, 'Display label', 'System {v2}');
  const source = await sourceInput(page).inputValue();
  expect(source).toContain('rectangle "System {v2}" as S');
  expect(source).toMatch(/as S\s*\{\s*UC\s*\}/);
  await expect(elementTarget(page, 'Checkout')).toBeVisible();
});

test('adding deployment children preserves quoted labels and nested declarations', async ({ page }) => {
  await openDiagram(page, 'deployment', '@startuml\nnode Server {\nartifact "app;debug.jar" as App\nnode Nested {\ncomponent Inner\n}\n}\n@enduml');
  await selectElement(page, 'Server');
  await page.getByRole('button', { name: '+ Artifact', exact: true }).click();
  const source = await sourceInput(page).inputValue();
  expect(source).toContain('artifact "app;debug.jar" as App');
  expect(source).toMatch(/node Nested\s*\{\s*component Inner\s*\}/);
  const model = await page.evaluate(() => window.UMLDeploymentDiagram.parse(window.UMLShared.extractLayoutMetadata(document.getElementById('uml-pg-input').value).text));
  expect(model.elements.find(element => element.name === 'Artifact').parentId).toBe('Server');
});

test('keyboard focus and property edits keep an ER element inside the visible canvas', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  const original = '@startuml\nentity Person {\npersonId\nname\n}\n@enduml';
  await openDiagram(page, 'er', original);
  const person = elementTarget(page, 'Person');
  await person.focus();
  await expect(person).toBeInViewport({ ratio: 0.99 });
  await person.press('Enter');
  await expect(person).toBeInViewport({ ratio: 0.99 });
  await expect(sourceInput(page)).toHaveValue(original);
  await editProperty(page, 'Highlight color (#hex or name)', 'lightblue');
  await expect(person).toBeInViewport({ ratio: 0.99 });
});

test('the initial ER canvas reveals its first element before keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await openDiagram(page, 'er', '@startuml\nentity Person {\npersonId\nname\n}\n@enduml');
  await page.locator('#uml-pg-output').scrollIntoViewIfNeeded();
  const person = elementTarget(page, 'Person');
  await expect(person).not.toBeFocused();
  await expect(person).toBeInViewport({ ratio: 0.99 });
});

test('an element created from the keyboard is selected and visible on a wide canvas', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await openDiagram(page, 'class', '@startuml\nclass Existing @pos(1600, 80)\n@enduml');
  await page.getByRole('button', { name: 'Add element: Class', exact: true }).press('Enter');
  await expect(elementTarget(page, 'Class')).toBeInViewport({ ratio: 0.99 });
  await expect(page.getByRole('textbox', { name: 'Name (id)', exact: true })).toHaveValue('Class');
});

const inlineDeployment = '@startuml\nnode Server { component "Child; label" as Child; artifact "keep.jar" as Keep }\nnode Elsewhere\nChild --> Elsewhere : leave\nnode Other\nElsewhere --> Other : remain\n@layout schema=1 renderer="archuml-visual-editor"\nedge "rel:5" points="80,80 80,120 140,120"\n@endlayout\n@enduml';

async function expectSurvivingDeploymentRoute(page) {
  const source = await sourceInput(page).inputValue();
  const parsed = await page.evaluate(text => window.UMLShared.extractLayoutMetadata(text), source);
  const line = parsed.text.split('\n').findIndex(row => row === 'Elsewhere --> Other : remain');
  expect(parsed.layout.routes['rel:' + line].points).toEqual([{ x: 80, y: 80 }, { x: 80, y: 120 }, { x: 140, y: 120 }]);
}

test('renaming an inline deployment child preserves its label and rewrites its connector', async ({ page }) => {
  await openDiagram(page, 'deployment', inlineDeployment);
  await selectElement(page, 'Server');
  const child = page.getByRole('textbox', { name: 'Deployment child 1 name', exact: true });
  await child.fill('Renamed');
  await child.press('Tab');
  await expect(sourceInput(page)).toHaveValue(/component "Child; label" as Renamed/);
  await expect(sourceInput(page)).toHaveValue(/Renamed --> Elsewhere : leave/);
  await expect(sourceInput(page)).toHaveValue(/artifact "keep.jar" as Keep/);
  const ids = await page.evaluate(() => window.UMLDeploymentDiagram.parse(window.UMLShared.extractLayoutMetadata(document.getElementById('uml-pg-input').value).text).elements.map(element => element.name));
  expect(ids).toContain('Renamed');
  expect(ids).not.toContain('Child');
  await expectSurvivingDeploymentRoute(page);
});

test('removing an inline deployment child preserves its parent and sibling', async ({ page }) => {
  await openDiagram(page, 'deployment', inlineDeployment);
  await selectElement(page, 'Server');
  await page.getByRole('button', { name: 'Remove deployment child 1', exact: true }).click();
  const source = await sourceInput(page).inputValue();
  expect(source).toContain('node Server');
  expect(source).toContain('artifact "keep.jar" as Keep');
  expect(source).not.toContain('Child');
  const ids = await page.evaluate(() => window.UMLDeploymentDiagram.parse(window.UMLShared.extractLayoutMetadata(document.getElementById('uml-pg-input').value).text).elements.map(element => element.name));
  expect(ids).toEqual(expect.arrayContaining(['Server', 'Keep', 'Elsewhere']));
  expect(ids).not.toContain('Child');
  await expectSurvivingDeploymentRoute(page);
});

for (const action of ['rename', 'delete']) {
  test(`inline substate ${action} preserves declaration-like prose inside an owned note`, async ({ page }) => {
    const note = 'note right of Outer\nstate Child\nChild --> Elsewhere\nend note';
    await openDiagram(page, 'state', `@startuml\nstate Outer { state Child\n${note}\n}\nstate Elsewhere\nChild --> Elsewhere : leave\n@enduml`);
    await selectElement(page, 'Outer');
    if (action === 'rename') {
      const child = page.getByRole('textbox', { name: 'Sub-state 1 name', exact: true });
      await child.fill('Renamed');
      await child.press('Tab');
    } else {
      await page.getByRole('button', { name: 'Remove sub-state 1', exact: true }).click();
    }
    expect(await sourceInput(page).inputValue()).toContain(note);
    const model = await page.evaluate(() => window.UMLStateDiagram.parse(window.UMLShared.extractLayoutMetadata(document.getElementById('uml-pg-input').value).text));
    expect(model.states.some(state => state.name === 'Child')).toBe(false);
    expect(model.notes[0].lines).toEqual(['state Child', 'Child --> Elsewhere']);
  });
}

for (const fixture of [
  { type: 'state', parent: 'Outer', declaration: 'state Outer {\nstate Child { state Grandchild }\n}', child: 'Grandchild' },
  { type: 'deployment', parent: 'Server', declaration: 'node Server { component Child; artifact Grandchild }', child: 'Grandchild' },
]) {
  test(`deleting a ${fixture.type} parent removes owned children and their external references`, async ({ page }) => {
    const keyword = fixture.type === 'state' ? 'state' : 'node';
    await openDiagram(page, fixture.type, `@startuml\n${fixture.declaration}\n${keyword} Outside\nChild --> Outside : first\n${fixture.child} --> Outside : second\n@layout schema=1 renderer="archuml-visual-editor"\nnode "${fixture.child}" x=200 y=200\nedge "edge:${fixture.child}|Outside" points="80,80 80,120 140,120"\n@endlayout\n@enduml`);
    await selectElement(page, fixture.parent);
    await deleteSelected(page);
    const source = await sourceInput(page).inputValue();
    expect(source).not.toMatch(/Child|Grandchild/);
    expect(source).toContain(`${keyword} Outside`);
    await expect(elementTarget(page, 'Outside')).toBeVisible();
    await expect(elementTarget(page, 'Child')).toHaveCount(0);
    await expect(elementTarget(page, fixture.child)).toHaveCount(0);
  });
}

test('deleting a multiline class removes its whole declaration and incident relations', async ({ page }) => {
  await openDiagram(page, 'class', multilineClass);
  await selectElement(page, 'A');
  await deleteSelected(page);
  await expect(sourceInput(page)).toHaveValue('@startuml\nclass B\n@enduml');
});

const portSource = '@startuml\ncomponent C {\nportin "request" as req\n}\ncomponent D\nC.req --> D\n@enduml';

test('deleting a nested port removes the port and its incident connector', async ({ page }) => {
  await openDiagram(page, 'component', portSource);
  await selectElement(page, 'request', 'Port');
  await deleteSelected(page);
  const source = await sourceInput(page).inputValue();
  expect(source).not.toContain('portin');
  expect(source).not.toContain('C.req --> D');
  await expect(elementTarget(page, 'C')).toBeVisible();
  await expect(elementTarget(page, 'D')).toBeVisible();
});

test('renaming a nested port preserves its label and updates qualified references', async ({ page }) => {
  await openDiagram(page, 'component', portSource);
  await selectElement(page, 'request', 'Port');
  await editProperty(page, 'Identifier', 'C.newreq');
  const source = await sourceInput(page).inputValue();
  expect(source).toContain('"request" as newreq');
  expect(source).toContain('C.newreq --> D');
  expect(source).not.toContain('C.req --> D');
  await expect(elementTarget(page, 'request', 'Port')).toBeVisible();
});

test('removing a port through its component also removes the incident connector', async ({ page }) => {
  await openDiagram(page, 'component', portSource);
  await selectElement(page, 'C');
  await page.getByRole('button', { name: 'Remove port 1', exact: true }).click();
  const source = await sourceInput(page).inputValue();
  expect(source).not.toContain('portin');
  expect(source).not.toContain('C.req --> D');
});

test('pointer selection alone preserves source and redo', async ({ page }) => {
  const original = '@startuml\nclass A\nclass B\nA --> B\n@enduml';
  await openDiagram(page, 'class', original);
  await selectElement(page, 'A');
  await editProperty(page, 'Name (id)', 'Renamed');
  await undoButton(page).click();
  await expect(redoButton(page)).toBeEnabled();
  // Native pointer activation exercises the same transparent canvas target as the mouse user.
  await elementTarget(page, 'A').click({ force: true });
  await expect(sourceInput(page)).toHaveValue(original);
  await expect(redoButton(page)).toBeEnabled();
  await redoButton(page).click();
  await expect(sourceInput(page)).toHaveValue(/class Renamed/);
});

test('renaming a use case updates system membership and preserves its display label', async ({ page }) => {
  await openDiagram(page, 'usecase', '@startuml\nusecase "Checkout" as UC\nrectangle S {\n  UC\n}\n@enduml');
  await selectElement(page, 'Checkout');
  await editProperty(page, 'Identifier', 'NewUC');
  const source = await sourceInput(page).inputValue();
  expect(source).toContain('usecase "Checkout" as NewUC');
  expect(source).toMatch(/rectangle S\s*\{\s*NewUC\s*\}/);
  await expect(elementTarget(page, 'Checkout')).toBeVisible();
});

test('deleting a use case removes only its system membership reference', async ({ page }) => {
  await openDiagram(page, 'usecase', '@startuml\nusecase "Checkout" as UC\nusecase "Browse" as Other\nrectangle S {\n  UC\n  Other\n}\n@enduml');
  await selectElement(page, 'Checkout');
  await deleteSelected(page);
  const source = await sourceInput(page).inputValue();
  expect(source).not.toMatch(/\bUC\b/);
  expect(source).toMatch(/rectangle S\s*\{\s*Other\s*\}/);
  await expect(elementTarget(page, 'Browse')).toBeVisible();
});

for (const [kind, members] of [['class', 'name: String; op()'], ['enum', 'RED; GREEN']]) {
  test(`${kind} property edits preserve omitted visibility`, async ({ page }) => {
    await openDiagram(page, 'class', `@startuml\n${kind} C { ${members} }\n@enduml`);
    await selectElement(page, 'C');
    await editProperty(page, 'Stereotype (e.g. <<service>>)', 'example');
    const source = await sourceInput(page).inputValue();
    expect(source).not.toMatch(/[+\-#~]\s*(?:name|op|RED|GREEN)/);
    for (const member of members.split('; ')) expect(source).toContain(member);
    await expect(page.getByRole('combobox', { name: 'Visibility', exact: true }).first()).toHaveValue('');
  });
}

test('deleting a transition preserves the surviving transition route', async ({ page }) => {
  await openDiagram(page, 'state', '@startuml\nstate A @pos(40, 40)\nstate B @pos(280, 40)\nstate C @pos(40, 220)\nstate D @pos(280, 220)\nA --> B: first\nC --> D: second\n@layout schema=1 renderer="archuml-visual-editor"\nedge "edge-0" points="148,61 280,61"\nedge "edge-1" points="148,241 210,241 210,300 280,300 280,241"\n@endlayout\n@enduml');
  const survivingRoute = () => page.evaluate(() => window.UMLShared.collectEditableRoutes(document.querySelector('#uml-pg-output svg'))
    .find((route) => route.source === 'C' && route.target === 'D').points);
  const before = await survivingRoute();
  const first = page.getByRole('button', { name: /^Relation segment \d+ of edge-0 —/ }).first();
  await first.focus();
  await first.press('Enter');
  await deleteSelected(page);
  expect(await survivingRoute()).toEqual(before);
  await expect(sourceInput(page)).not.toHaveValue(/A --> B/);
  await expect(sourceInput(page)).toHaveValue(/C --> D: second/);
});

test('deleting a composite ignores literal note braces when finding its boundary', async ({ page }) => {
  await openDiagram(page, 'state', '@startuml\nstate Parent {\n state Child\n note right of Outside\n literal { character\n end note\n}\nstate Outside\nnote right of Outside: Parent and Child are examples { }\n@enduml');
  await selectElement(page, 'Parent');
  await deleteSelected(page);
  const model = await page.evaluate(() => window.UMLStateDiagram.parse(document.getElementById('uml-pg-input').value));
  expect(model.states.map(state => state.name)).toEqual(['Outside']);
  expect(model.notes.map(note => note.lines)).toEqual([['Parent and Child are examples { }']]);
  await expect(elementTarget(page, 'Outside')).toBeVisible();
});

test('deleting a node together with its incident edge preserves unrelated relations and can be undone', async ({ page }) => {
  const source = '@startuml\nclass A\nclass B\nclass C\nA --> B : removed\nC --> B : survives\n@enduml';
  await openDiagram(page, 'class', source);
  const routeId = await page.evaluate(() => window.UMLShared.collectEditableRoutes(document.querySelector('#uml-pg-output svg'))
    .find(route => route.source === 'A' && route.target === 'B').id);
  await selectElement(page, 'A');
  const route = page.getByRole('button', { name: new RegExp(`^Relation segment \\d+ of ${routeId} — Enter to select, Delete to remove$`) }).first();
  // The route's accessible overlay shares its geometry with the SVG shaft.
  await route.click({ force: true, modifiers: ['Shift'] });
  await expect(page.locator('.uml-pg-edit-hitbox[data-layout-id="A"]')).toHaveClass(/is-selected/);
  await expect(route).toHaveClass(/is-selected/);
  await route.focus();
  await route.press('Delete');
  await expect(sourceInput(page)).toHaveValue('@startuml\nclass B\nclass C\nC --> B : survives\n@enduml');
  await undoButton(page).click();
  await expect(sourceInput(page)).toHaveValue(source);
});

// Keyword-shaped identifiers are valid class names; they must not make
// relationships look like declarations during an identity change.
for (const [name, relation] of [
  ['Class', 'Class --|> Class2'],
  ['Class2', 'Class --|> Class2'],
  ['Class', 'Class2 --|> Class'],
  ['Class2', 'Class2 --|> Class'],
  ['Class', 'Class *-- Class2'],
  ['Class2', 'Class --> Class2: uses'],
  ['Interface', 'Interface ..|> Class2'],
  ['Enum', 'Enum o-- Class2'],
]) {
  test(`renaming ${name} preserves ${relation}`, async ({ page }) => {
    const keyword = /^(Interface|Enum)/.exec(relation)?.[1] || 'Class';
    const original = `@startuml\nclass ${keyword} { + name: String }\nclass Class2\n${relation}\n@enduml`;
    await openDiagram(page, 'class', original);
    await selectElement(page, name);
    await editProperty(page, 'Name (id)', 'Renamed');
    const expectedRelation = relation.replace(new RegExp(`\\b${name}\\b`, 'g'), 'Renamed');
    await expect(sourceInput(page)).toHaveValue(original.replace(new RegExp(`\\b${name}\\b`, 'g'), 'Renamed'));
    // The retained source must still render the relationship, not merely look valid.
    await expect(page.getByRole('button', { name: /^Relation segment/ }).first()).toBeAttached();
    await expect(sourceInput(page)).toHaveValue(new RegExp(expectedRelation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await undoButton(page).click();
    await expect(sourceInput(page)).toHaveValue(original);
    await redoButton(page).click();
    await expect(sourceInput(page)).toHaveValue(original.replace(new RegExp(`\\b${name}\\b`, 'g'), 'Renamed'));
  });
}

for (const name of ['Class', 'Class2']) {
  test(`inline rename of ${name} preserves the generalization`, async ({ page }) => {
    const original = '@startuml\nclass Class\nclass Class2\nClass --|> Class2\n@enduml';
    await openDiagram(page, 'class', original);
    await selectElement(page, name);
    const target = elementTarget(page, name);
    await target.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'center' }));
    const box = await target.boundingBox();
    await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
    const rename = page.getByRole('textbox', { name: `Rename ${name}`, exact: true });
    await rename.fill('Renamed');
    await rename.press('Enter');
    await expect(sourceInput(page)).toHaveValue(original.replace(new RegExp(`\\b${name}\\b`, 'g'), 'Renamed'));
    await expect(page.getByRole('button', { name: /^Relation segment/ }).first()).toBeAttached();
  });
}

for (const operation of ['rename', 'delete']) {
  test(`${operation} of a class preserves a separately declared dotted class`, async ({ page }) => {
    const original = '@startuml\nclass A\nclass A.Part @pos(300, 200)\nclass Target\nA.Part --> Target\nA --> Target\n@enduml';
    await openDiagram(page, 'class', original);
    await selectElement(page, 'A');
    if (operation === 'rename') await editProperty(page, 'Name (id)', 'Renamed');
    else await deleteSelected(page);
    await expect(sourceInput(page)).toHaveValue(/class A\.Part @pos\(300, 200\)/);
    await expect(sourceInput(page)).toHaveValue(/A\.Part --> Target/);
    await expect(elementTarget(page, 'A.Part')).toBeVisible();
    await undoButton(page).click();
    await expect(sourceInput(page)).toHaveValue(original);
  });
}

for (const [id, relation] of [
  ['A', "A '1' --> '*' B: owns"],
  ['B', "A '1' --> '*' B: owns"],
  ['A::B', 'A::B --> B: uses'],
]) {
  test(`renaming ${id} retains endpoint syntax in ${relation}`, async ({ page }) => {
    const source = `@startuml\nclass ${id === 'A::B' ? id : 'A'}\nclass B\n${relation}\n@enduml`;
    await openDiagram(page, 'class', source);
    await selectElement(page, id);
    await editProperty(page, 'Name (id)', 'Renamed');
    await expect(sourceInput(page)).toHaveValue(source.replace(new RegExp(`\\b${id}\\b`, 'g'), 'Renamed'));
    await expect(page.getByRole('button', { name: /^Relation segment/ }).first()).toBeAttached();
  });
}

test('renaming a type updates each argument of square-bracket generics', async ({ page }) => {
  const source = '@startuml\nclass A\nclass B\nclass Holder { +pair: tuple[A, B]; +nested: list[tuple[A, B]]; +find(a: A, b: B): tuple[A, B] }\n@enduml';
  await openDiagram(page, 'class', source);
  await selectElement(page, 'B');
  await editProperty(page, 'Name (id)', 'Renamed');
  await expect(sourceInput(page)).toHaveValue(source.replace(/\bB\b/g, 'Renamed'));
});

for (const operation of ['rename', 'delete']) {
  test(`${operation} of a component updates its actual ports but preserves dotted siblings`, async ({ page }) => {
    const original = '@startuml\ncomponent A { portin "request" as req }\ncomponent A.Part\ncomponent Target\nA.req --> Target\nA.Part --> Target\n@enduml';
    await openDiagram(page, 'component', original);
    await selectElement(page, 'A');
    if (operation === 'rename') {
      await editProperty(page, 'Identifier', 'Renamed');
      await expect(sourceInput(page)).toHaveValue(/Renamed\.req --> Target/);
    } else {
      await deleteSelected(page);
      await expect(sourceInput(page)).not.toHaveValue(/A\.req --> Target/);
    }
    await expect(sourceInput(page)).toHaveValue(/component A\.Part/);
    await expect(sourceInput(page)).toHaveValue(/A\.Part --> Target/);
    await undoButton(page).click();
    await expect(sourceInput(page)).toHaveValue(original);
  });
}

test('editing a namespace relation label keeps its endpoints', async ({ page }) => {
  const original = '@startuml\nclass A::B\nclass Target\nA::B --> Target: old label\n@enduml';
  await openDiagram(page, 'class', original);
  const route = page.getByRole('button', { name: /^Relation segment/ }).first();
  await route.focus();
  await route.press('Enter');
  await editProperty(page, 'Label', 'new label');
  await expect(sourceInput(page)).toHaveValue(/A::B --> Target\s*:\s*new label/);
  await deleteSelected(page);
  await expect(sourceInput(page)).not.toHaveValue(/-->/);
  await expect(elementTarget(page, 'A::B')).toBeVisible();
  await expect(elementTarget(page, 'Target')).toBeVisible();
});

test('renaming a namespace type updates member types and preserves named-note prose', async ({ page }) => {
  const original = '@startuml\nclass A::B\nclass Holder { +value: A::B }\nnote as Explanation\nA::B --> Holder is an example\nend note\nA::B --> Holder\n@enduml';
  await openDiagram(page, 'class', original);
  await selectElement(page, 'A::B');
  await editProperty(page, 'Name (id)', 'Renamed');
  await expect(sourceInput(page)).toHaveValue('@startuml\nclass Renamed\nclass Holder { +value: Renamed }\nnote as Explanation\nA::B --> Holder is an example\nend note\nRenamed --> Holder\n@enduml');
});

test('renaming an activity action changes references without rewriting explanatory text', async ({ page }) => {
  const original = '@startuml\n(*) --> "Work"\n"Work" --> "Done": "Work" complete\nnote right of "Done": "Work" is the old label\n"Done" --> (*)\n@enduml';
  await openDiagram(page, 'activity', original);
  await selectElement(page, 'Work');
  await editProperty(page, 'Action text', 'Renamed');
  await expect(sourceInput(page)).toHaveValue('@startuml\n(*) --> "Renamed"\n"Renamed" --> "Done": "Work" complete\nnote right of "Done": "Work" is the old label\n"Done" --> (*)\n@enduml');
  await undoButton(page).click();
  await expect(sourceInput(page)).toHaveValue(original);
});

const drawnModel = (page, parser) => page.evaluate(name => {
  const source = window.UMLShared.extractLayoutMetadata(document.getElementById('uml-pg-input').value).text;
  return window[name].parse(source);
}, parser);

// Route ids are renderer handles with no accessible equivalent per relation,
// so these tests reach the drawn route through its layout attributes.
async function selectRoute(page, routeId) {
  const segment = page.locator('#uml-pg-output .uml-pg-edge-hitbox[data-layout-id=' + JSON.stringify(routeId) + ']').first();
  await segment.focus();
  await segment.press('Enter');
}

test('the starter sequence exchange draws its request between two lifelines', async ({ page }) => {
  await openDiagram(page, 'sequence', '@startuml\n@enduml');
  await page.getByRole('button', { name: '+ Starter exchange', exact: true }).click();
  await expect(elementTarget(page, 'user: User')).toBeVisible();
  await expect(elementTarget(page, 'p: Service')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Element / })).toHaveCount(2);
  const model = await drawnModel(page, 'UMLSequenceDiagram');
  expect(model.messages.filter(event => event.type === 'message').map(message => [message.from, message.to, message.label]))
    .toEqual([['user', 'p', 'request()']]);
});

test('a lifeline cannot be renamed to a sequence keyword', async ({ page }) => {
  const original = '@startuml\nactor user: User\nparticipant registry: Registry\nuser -> registry : lookup()\n@enduml';
  await openDiagram(page, 'sequence', original);
  await page.getByText(/^Advanced sequence rows/).click();
  await editProperty(page, 'Lifeline 2 identifier', 'ref');
  await expect(page.getByText('"ref" is a sequence-diagram keyword. Pick a different identifier.', { exact: true })).toBeVisible();
  await expect(sourceInput(page)).toHaveValue(original);
});

test('a saved lifeline named with a sequence keyword is explained by the diagnostics', async ({ page }) => {
  await openDiagram(page, 'sequence', '@startuml\nactor actor: User\nparticipant p: Service\nactor -> p : request()\n@enduml');
  await expect(page.getByRole('region', { name: 'Draft diagnostics' }))
    .toContainText('Line 2: the lifeline id "actor" is a sequence-diagram keyword, so lines that start with it are not read as messages.');
});

const componentPorts = async (page, owner) =>
  (await drawnModel(page, 'UMLComponentDiagram')).components.find(component => component.name === owner).ports.map(port => port.alias);
const layeredComponents = '@startuml\ncomponent Frontend {\n  portout "httpOut" as f_out\n}\ncomponent Backend {\n  portin "httpIn" as b_in\n  portout "dbOut" as b_dbout\n  portout "eventOut" as b_eventout\n}\ncomponent Database {\n  portin "dbIn" as db_in\n}\ncomponent EventBus {\n  portin "eventIn" as eb_in\n}\nf_out --> b_in : REST / JSON\nb_dbout --> db_in : SQL\nb_eventout --> eb_in : publish\n@enduml';

test('deleting one port keeps its component\'s other ports and drops connectors to it', async ({ page }) => {
  await openDiagram(page, 'component', layeredComponents);
  await selectElement(page, 'eventOut', 'Port');
  await deleteSelected(page);
  await expect(elementTarget(page, 'eventOut', 'Port')).toHaveCount(0);
  expect(await componentPorts(page, 'Backend')).toEqual(['b_in', 'b_dbout']);
  await expect(page.getByRole('button', { name: /^Element / })).toHaveCount(4);
  await expect(sourceInput(page)).not.toHaveValue(/b_eventout/);
  await expect(sourceInput(page)).toHaveValue(/b_dbout --> db_in : SQL/);
});

test('a selected component connector is the one Properties and Delete change', async ({ page }) => {
  await openDiagram(page, 'component', layeredComponents);
  const sqlRoute = await page.locator('#uml-pg-output [data-layout-source="Backend.b_dbout"][data-layout-target="Database.db_in"]').first().getAttribute('data-layout-route-id');
  await selectRoute(page, sqlRoute);
  await expect(page.getByRole('textbox', { name: 'Label', exact: true })).toHaveValue('SQL');
  await deleteSelected(page);
  await expect(sourceInput(page)).not.toHaveValue(/b_dbout --> db_in/);
  await expect(sourceInput(page)).toHaveValue(/f_out --> b_in : REST \/ JSON/);
  await expect(sourceInput(page)).toHaveValue(/b_eventout --> eb_in : publish/);
});

test('a selected use-case association is the one Delete removes', async ({ page }) => {
  await openDiagram(page, 'usecase', '@startuml\nactor User\nusecase "Login" as UC1\nusecase "Register" as UC2\nUser -- UC1\nUser -- UC2\n@enduml');
  await selectRoute(page, 'usecase:1');
  await expect(page.getByRole('heading', { name: 'Relation — User → UC2', exact: true })).toBeVisible();
  await deleteSelected(page);
  await expect(sourceInput(page)).toHaveValue('@startuml\nactor User\nusecase "Login" as UC1\nusecase "Register" as UC2\nUser -- UC1\n@enduml');
});

const generalizationTree = '@startuml\nclass Square\nclass Property\nclass Railroad\nclass Game\nProperty --|> Square\nRailroad --|> Square\nGame *-- Square\n@enduml';

// A generalization tree's lines carry no route ids, so these tests find a
// line the way a student sees it: by the class edge it meets.
async function selectTreeLine(page, label, edge) {
  const box = await elementTarget(page, label).boundingBox();
  const routeId = await page.locator('#uml-pg-output .uml-pg-edge-hitbox').evaluateAll((lines, { box, edge }) => {
    const bottom = box.y + box.height;
    const line = lines.find(candidate => {
      const r = candidate.getBoundingClientRect();
      const centerX = r.left + r.width / 2;
      // A subclass branch ends on the subclass; the trunk starts below the superclass's triangle.
      const meets = edge === 'top' ? Math.abs(r.bottom - box.y) < 8 : r.top > bottom && r.top - bottom < 24;
      return r.height > r.width && centerX > box.x && centerX < box.x + box.width && meets;
    });
    return line ? line.getAttribute('data-layout-id') : null;
  }, { box, edge });
  expect(routeId, `a tree line meets the ${edge} edge of ${label}`).not.toBeNull();
  await selectRoute(page, routeId);
}

test('a subclass branch of a generalization tree is the generalization Delete removes', async ({ page }) => {
  await openDiagram(page, 'class', generalizationTree);
  await selectTreeLine(page, 'Property', 'top');
  await expect(page.getByRole('heading', { name: 'Relation — Property → Square', exact: true })).toBeVisible();
  await deleteSelected(page);
  await expect(sourceInput(page)).toHaveValue('@startuml\nclass Square\nclass Property\nclass Railroad\nclass Game\nRailroad --|> Square\nGame *-- Square\n@enduml');
});

test('a generalization trunk shared by several subclasses is explained and kept', async ({ page }) => {
  await openDiagram(page, 'class', generalizationTree);
  await selectTreeLine(page, 'Square', 'bottom');
  await expect(page.getByText('This connection could not be matched to one line of the source, so it cannot be edited here.', { exact: true })).toBeVisible();
  await deleteSelected(page);
  await expect(sourceInput(page)).toHaveValue(generalizationTree);
});

const decisionActivity = '@startuml\n(*) --> "Receive Order"\nif "Payment Valid?" then\n  --> [yes] "Process Order"\nelse\n  --> [no] "Reject Order"\nendif\n"Process Order" --> (*)\n"Reject Order" --> (*)\n@enduml';

test('labeling an activity decision branch edits its guard and keeps its target', async ({ page }) => {
  await openDiagram(page, 'activity', decisionActivity);
  const yesRoute = await page.locator('#uml-pg-output [data-layout-kind="edge-label"]', { hasText: '[yes]' }).first().getAttribute('data-layout-route-id');
  await selectRoute(page, yesRoute);
  await editProperty(page, 'Guard', 'approved');
  await expect(sourceInput(page)).toHaveValue(/^ {2}--> \[approved\] "Process Order"$/m);
  const model = await drawnModel(page, 'UMLActivityDiagram');
  const decision = model.nodes.find(node => node.type === 'decision').id;
  const processOrder = model.nodes.find(node => node.label === 'Process Order').id;
  expect(model.edges.filter(edge => edge.from === decision && edge.to === processOrder).map(edge => edge.guard)).toEqual(['approved']);
});

test('a flow with no line of its own is explained instead of edited', async ({ page }) => {
  await openDiagram(page, 'activity', decisionActivity);
  const implicitRoute = await page.locator('#uml-pg-output .uml-pg-edge-hitbox[data-layout-id^="edge-"]').first().getAttribute('data-layout-id');
  await selectRoute(page, implicitRoute);
  await expect(page.getByText('This connection could not be matched to one line of the source, so it cannot be edited here.', { exact: true })).toBeVisible();
  await deleteSelected(page);
  await expect(page.getByText('Kept 1 connection that could not be matched to one line of the source.', { exact: true })).toBeVisible();
  await expect(sourceInput(page)).toHaveValue(decisionActivity);
});

test('duplicating a state retains links to independent dotted states', async ({ page }) => {
  const original = '@startuml\nstate A {\nstate Child\nChild --> A.Part\n}\nstate A.Part\n@enduml';
  await openDiagram(page, 'state', original);
  await selectElement(page, 'A');
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+d' : 'Control+d');
  await expect(sourceInput(page)).toHaveValue(/Child2 --> A\.Part/);
  await expect(sourceInput(page)).not.toHaveValue(/A2\.Part/);
  await expect(elementTarget(page, 'A.Part')).toBeVisible();
  await undoButton(page).click();
  await expect(sourceInput(page)).toHaveValue(original);
});
