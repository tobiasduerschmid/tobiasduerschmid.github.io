const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');

const source = page => page.getByRole('textbox', { name: 'ArchUML diagram source', exact: true });
const element = (page, name) => page.getByRole('button', {
  name: `Element ${name} — Enter to select, arrows to nudge, Delete to remove`, exact: true,
});
const renderedName = (page, name) => page.getByRole('region', { name: 'Diagram preview', exact: true })
  .locator('svg text').filter({ hasText: new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') });

async function openDiagram(page, type, text) {
  await page.goto('/SEBook/tools/uml-playground');
  await page.getByLabel('Diagram type:', { exact: true }).selectOption(type);
  await source(page).fill(`@startuml\n${text}\n@enduml`);
}

async function editProperty(page, name, value) {
  const input = page.getByRole('textbox', { name, exact: true });
  await input.fill(value);
  await input.press('Enter');
}

// Click the visible heading beneath the pointer overlay, using real pointer
// events so a model-only label change cannot make the test pass.
async function doubleClickElement(page, target) {
  const name = (await target.getAttribute('aria-label')).replace(/^Element /, '').split(' — ')[0];
  const heading = renderedName(page, name);
  await expect(heading).toBeVisible();
  await heading.scrollIntoViewIfNeeded();
  const box = await heading.boundingBox();
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
}

for (const declaration of ['component [Frontend]', '[Frontend]', 'component [Front end] as Frontend']) {
  test(`component identifier rename works for ${declaration}`, async ({ page }) => {
    await openDiagram(page, 'component', `${declaration}\ncomponent Backend\nFrontend --> Backend`);
    const target = page.getByRole('button', { name: /^Element \[?Front/ });
    await target.press('Enter');
    await editProperty(page, 'Identifier', 'Client');
    await expect(source(page)).toHaveValue(/Client --> Backend/);
    await expect(page.getByRole('textbox', { name: 'Identifier', exact: true })).toHaveValue('Client');
    await expect(page.getByRole('button', { name: /^Relation segment/ })).not.toHaveCount(0);
    await page.getByRole('button', { name: /Undo$/ }).click();
    await expect(source(page)).toHaveValue(`@startuml\n${declaration}\ncomponent Backend\nFrontend --> Backend\n@enduml`);
  });

  test(`component diagram rename works for ${declaration}`, async ({ page }) => {
    await openDiagram(page, 'component', `${declaration}\ncomponent Backend\nFrontend --> Backend`);
    await doubleClickElement(page, page.getByRole('button', { name: /^Element \[?Front/ }));
    const rename = page.getByRole('textbox', { name: /^Rename / });
    await expect(rename).toBeFocused();
    await rename.fill('Web client');
    await rename.press('Enter');
    await expect(element(page, 'Web client')).toBeVisible();
    await expect(renderedName(page, 'Web client')).toBeVisible();
    await expect(source(page)).toHaveValue(/Frontend --> Backend/);
    await page.getByRole('button', { name: /Undo$/ }).click();
    await expect(source(page)).toHaveValue(`@startuml\n${declaration}\ncomponent Backend\nFrontend --> Backend\n@enduml`);
  });
}

const aliasedElements = [
  { type: 'component', declaration: 'component "Original label" as Item {\n portout "Requests" as req\n}', extra: 'component Other\nItem.req --> Other', retained: 'portout "Requests" as req' },
  { type: 'deployment', declaration: 'node "Original label" as Item {\n artifact "app.jar" as App\n}', extra: 'node Other\nItem --> Other', retained: 'artifact "app.jar" as App' },
  { type: 'deployment', declaration: 'component "Original label" as Item', extra: 'node Other\nItem --> Other', retained: 'Item --> Other' },
  { type: 'deployment', declaration: 'artifact "Original label" as Item', extra: 'node Other\nItem --> Other', retained: 'Item --> Other' },
  { type: 'class', declaration: 'class "Original label" as Item { +name: String }', extra: 'class Other\nItem --> Other', retained: 'name: String' },
  { type: 'usecase', declaration: 'rectangle "Original label" as Item {\n usecase "Sign in" as Login\n}', extra: '', retained: 'usecase "Sign in" as Login' },
];

for (const fixture of aliasedElements) {
  for (const method of ['properties', 'diagram']) {
    test(`${fixture.type} ${fixture.declaration.split(' ')[0]} display name can be edited through ${method}`, async ({ page }) => {
      await openDiagram(page, fixture.type, fixture.declaration + '\n' + fixture.extra);
      const target = element(page, 'Original label');
      if (method === 'properties') {
        await target.press('Enter');
        await editProperty(page, 'Display label', 'Renamed label');
      } else {
        await doubleClickElement(page, target);
        const rename = page.getByRole('textbox', { name: 'Rename Original label', exact: true });
        await rename.fill('Renamed label');
        await rename.press('Enter');
      }
      await expect(element(page, 'Renamed label')).toBeVisible();
      await expect(renderedName(page, 'Renamed label')).toBeVisible();
      await expect(source(page)).toHaveValue(/"Renamed label" as Item/);
      if (fixture.extra) await expect(page.getByRole('button', { name: /^Relation segment/ })).not.toHaveCount(0);
      await expect(source(page)).toHaveValue(new RegExp(fixture.retained.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      await element(page, 'Renamed label').press('Enter');
      await expect(page.getByRole('textbox', { name: 'Display label', exact: true })).toHaveValue('Renamed label');
      await a11yCheckpoint(page, 'Renamed diagram element properties', { include: '#uml-pg-props-pane' });
    });
  }
}

const otherNames = [
  { type: 'class', text: 'class Before\nclass Other\nBefore --> Other', field: 'Name (id)', reference: 'After --> Other' },
  { type: 'sequence', text: 'participant Before\nparticipant Other\nBefore -> Other: call()', field: 'Identifier', reference: 'After -> Other: call()', diagramLabel: 'After: After' },
  { type: 'state', text: 'state Before\nBefore --> Other', field: 'Identifier', reference: 'After --> Other' },
  { type: 'component', text: 'component Before\ncomponent Other\nBefore --> Other', field: 'Identifier', reference: 'After --> Other' },
  { type: 'deployment', text: 'node Before\nnode Other\nBefore --> Other', field: 'Identifier', reference: 'After --> Other' },
  { type: 'usecase', text: 'actor Before\nusecase "Login" as Login\nBefore -- Login', field: 'Display label', reference: 'Before -- Login' },
  { type: 'activity', text: '(*) --> "Before"\n"Before" --> "Other"', field: 'Action text', reference: '"After" --> "Other"' },
  { type: 'freeform', text: 'box "Before" as Item\nbox "Other" as Other\nItem --> Other', field: 'Display label', reference: 'Item --> Other' },
  { type: 'venn', text: 'set Before\nset Other', field: 'Display label', reference: 'set After' },
  { type: 'er', text: 'entity Before {\n name\n}', field: 'Identifier', reference: 'entity After' },
  { type: 'crc', text: 'card "Before" as Item {\n responsibility: Know name\n collaborator: Other\n}', field: 'Class name', reference: 'Know name' },
];

for (const fixture of otherNames) {
  for (const method of ['properties', 'diagram']) {
    test(`${fixture.type} plain names remain editable through ${method}`, async ({ page }) => {
      await openDiagram(page, fixture.type, fixture.text);
      if (method === 'properties') {
        await element(page, 'Before').press('Enter');
        await editProperty(page, fixture.field, 'After');
      } else {
        await doubleClickElement(page, element(page, 'Before'));
        const rename = page.getByRole('textbox', { name: 'Rename Before', exact: true });
        await rename.fill(fixture.diagramLabel || 'After');
        await rename.press('Enter');
      }
      const display = fixture.type === 'sequence' && method === 'diagram' ? 'After: After' : 'After';
      await expect(element(page, display)).toBeVisible();
      await expect(renderedName(page, display)).toBeVisible();
      const reference = method === 'diagram' && fixture.type === 'component' ? 'Before --> Other' : fixture.reference;
      await expect(source(page)).toHaveValue(new RegExp(reference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    });
  }
}

test('renaming a component rewrites bracketed connector endpoints', async ({ page }) => {
  await openDiagram(page, 'component', 'component [Frontend]\ncomponent [Backend]\n[Frontend] --> [Backend]');
  await element(page, 'Frontend').press('Enter');
  await editProperty(page, 'Identifier', 'Client');
  await expect(source(page)).not.toHaveValue(/Frontend/);
  await expect(element(page, 'Client')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Element / })).toHaveCount(2);
  await expect(page.getByRole('button', { name: /^Relation segment/ })).not.toHaveCount(0);
});

test('components declared only by connectors can be renamed', async ({ page }) => {
  await openDiagram(page, 'component', '[Frontend] --> [Backend]');
  await element(page, 'Frontend').press('Enter');
  await editProperty(page, 'Identifier', 'Client');
  await expect(element(page, 'Client')).toBeVisible();
  await editProperty(page, 'Display label', 'Web client');
  await expect(element(page, 'Web client')).toBeVisible();
  await expect(renderedName(page, 'Web client')).toBeVisible();
  await expect(source(page)).not.toHaveValue(/Frontend/);
  await expect(page.getByRole('button', { name: /^Element / })).toHaveCount(2);
  await expect(page.getByRole('button', { name: /^Relation segment/ })).not.toHaveCount(0);
});

test('a component declared only by a connector can be renamed in the diagram and undone', async ({ page }) => {
  await openDiagram(page, 'component', '[Frontend] --> [Backend]');
  await doubleClickElement(page, element(page, 'Frontend'));
  await editProperty(page, 'Rename Frontend', 'Web client');
  await expect(element(page, 'Web client')).toBeVisible();
  await expect(renderedName(page, 'Web client')).toBeVisible();
  await expect(source(page)).toHaveValue(/\[Frontend\] --> \[Backend\]/);
  await expect(page.getByRole('button', { name: /^Element / })).toHaveCount(2);
  await page.getByRole('button', { name: /Undo$/ }).click();
  await expect(source(page)).toHaveValue('@startuml\n[Frontend] --> [Backend]\n@enduml');
});

for (const fixture of [
  { type: 'gitgraph', text: 'branch main:\n A "Before"', summary: /^Git graph model \(2 rows\)$/, field: 'Commit row 2', value: ' A "After"' },
  { type: 'folder-tree', text: 'project/\n before.txt', summary: /^Folder tree model \(2 rows\)$/, field: 'File row 2', value: ' after.txt' },
]) {
  test(`${fixture.type} names can be edited through its model rows`, async ({ page }) => {
    await openDiagram(page, fixture.type, fixture.text);
    await page.getByText(fixture.summary).click();
    await editProperty(page, fixture.field, fixture.value);
    await expect(source(page)).toHaveValue(new RegExp(fixture.value.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await expect(page.getByRole('region', { name: 'Diagram preview', exact: true })).toContainText(/After|after.txt/);
  });
}

for (const dark of [false, true]) {
  test(`component display names survive repeated edits in ${dark ? 'dark' : 'light'} mode`, async ({ page }) => {
    await openDiagram(page, 'component', 'component "web: Frontend" as Web dashed {\n portout "Requests" as req\n}\ncomponent API\nWeb.req --> API');
    await page.evaluate(dark => document.documentElement.classList.toggle('dark-mode', dark), dark);
    await element(page, 'web: Frontend').press('Enter');
    await editProperty(page, 'Display label', 'browser: Frontend');
    await editProperty(page, 'Identifier', 'Browser');
    await editProperty(page, 'Display label', 'mobile: Frontend');
    await expect(element(page, 'mobile: Frontend')).toBeVisible();
    await expect(renderedName(page, 'mobile: Frontend')).toBeVisible();
    await expect(source(page)).toHaveValue(/"mobile: Frontend" as Browser dashed/);
    await expect(source(page)).toHaveValue(/Browser.req --> API/);
    await expect(source(page)).toHaveValue(/portout "Requests" as req/);
    await a11yCheckpoint(page, 'Component name editing', { include: '#uml-pg-props-pane' });
  });
}
