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
