const { test, expect } = require('@playwright/test');

const source = page => page.getByRole('textbox', { name: 'ArchUML diagram source', exact: true });
const element = (page, name) => page.getByRole('button', {
  name: `Element ${name} — Enter to select, arrows to nudge, Delete to remove`, exact: true,
});
const preview = page => page.getByRole('region', { name: 'Diagram preview', exact: true });
const renderedText = (page, text) => preview(page).locator('svg text')
  .filter({ hasText: new RegExp('^' + text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') });
const relations = page => page.getByRole('button', { name: /^Relation segment/ });
const undo = page => page.getByRole('button', { name: /Undo$/ });
const redo = page => page.getByRole('button', { name: /Redo$/ });
const zoomReadout = page => page.getByRole('group', { name: 'Zoom', exact: true }).getByRole('button', { name: /%$/ });

// Seed the draft before the page loads: choosing the type then renders it at
// once, so a test never acts on the diagram of a previous source.
async function openSource(page, type, text) {
  await page.addInitScript(({ type, text }) => localStorage.setItem('uml-pg-autosave-' + type, text), { type, text });
  await page.goto('/SEBook/tools/uml-playground');
  await page.getByLabel('Diagram type:', { exact: true }).selectOption(type);
  await expect(source(page)).toHaveValue(/\S/);
}

function openDiagram(page, type, body) {
  return openSource(page, type, `@startuml\n${body}\n@enduml`);
}

async function renameInDiagram(page, name, nextName) {
  const heading = renderedText(page, name);
  await heading.scrollIntoViewIfNeeded();
  const box = await heading.boundingBox();
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  const input = page.getByRole('textbox', { name: /^Rename / });
  await input.fill(nextName);
  await input.press('Enter');
}

test.describe('renaming in the diagram', () => {
  test('a use case named with spaces keeps its associations when renamed', async ({ page }) => {
    await openDiagram(page, 'usecase', 'actor User\nusecase "Log In"\nUser -- "Log In"');
    await expect(relations(page)).toHaveCount(1);
    await renameInDiagram(page, 'Log In', 'Sign In');
    await expect(element(page, 'Sign In')).toBeVisible();
    await expect(relations(page)).toHaveCount(1);
    // The new name is the use case's identity: a second rename still finds it.
    await renameInDiagram(page, 'Sign In', 'Enter');
    await expect(element(page, 'Enter')).toBeVisible();
    await expect(relations(page)).toHaveCount(1);
  });

  test('an actor keeps its highlight colour when renamed', async ({ page }) => {
    await openDiagram(page, 'usecase', 'actor User #lightgreen\nusecase Login\nUser -- Login');
    await renameInDiagram(page, 'User', 'Customer');
    await expect(element(page, 'Customer')).toBeVisible();
    await expect(source(page)).toHaveValue(/#lightgreen/);
  });

  test('a class can take a name with non-English letters', async ({ page }) => {
    await openDiagram(page, 'class', 'class Counter\nclass Display\nDisplay --> Counter');
    await renameInDiagram(page, 'Counter', 'Zähler');
    await expect(element(page, 'Zähler')).toBeVisible();
    await expect(source(page)).toHaveValue(/Display --> Zähler/);
  });

  test('a name without letters or digits is refused with an explanation', async ({ page }) => {
    await openDiagram(page, 'class', 'class Counter');
    await renameInDiagram(page, 'Counter', '***');
    await expect(page.getByText(/has no letters or digits/)).toBeVisible();
    await expect(element(page, 'Counter')).toBeVisible();
  });

  test('a refused rename leaves the redo history intact', async ({ page }) => {
    await openDiagram(page, 'class', 'class A\nclass B');
    await element(page, 'A').press('Enter');
    await page.keyboard.press('ArrowRight');
    await undo(page).click();
    await expect(redo(page)).toBeEnabled();
    await renameInDiagram(page, 'B', 'A');
    await expect(element(page, 'B')).toBeVisible();
    await expect(redo(page)).toBeEnabled();
  });
});

test.describe('use-case diagrams', () => {
  test('an actor figure is one element, not a set of relations', async ({ page }) => {
    await openDiagram(page, 'usecase', 'actor User\nusecase "Login" as UC1\nUser -- UC1');
    await expect(element(page, 'User')).toBeVisible();
    await expect(relations(page)).toHaveCount(1);
  });

  test('an association can end at a use case whose name has spaces', async ({ page }) => {
    await openDiagram(page, 'usecase', 'actor User\nusecase "Log In"\nUser -- "Log In"');
    await expect(relations(page)).toHaveCount(1);
  });
});

test.describe('view', () => {
  test('switching diagram type starts the new diagram at 100% zoom', async ({ page }) => {
    await openDiagram(page, 'class', 'class A');
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await expect(zoomReadout(page)).toHaveText('120%');
    await page.getByLabel('Diagram type:', { exact: true }).selectOption('state');
    await expect(zoomReadout(page)).toHaveText('100%');
  });

  test('a trackpad pinch zooms in proportion to the gesture', async ({ page }) => {
    await openDiagram(page, 'class', 'class A');
    await element(page, 'A').scrollIntoViewIfNeeded();
    const box = await element(page, 'A').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.keyboard.down('Control');
    // Ten 2-pixel steps: a short pinch, far less than one mouse-wheel notch.
    for (let step = 0; step < 10; step++) await page.mouse.wheel(0, -2);
    await page.keyboard.up('Control');
    await expect(zoomReadout(page)).toHaveText(/^10[1-9]%$/);
  });

  test('one mouse-wheel notch with Ctrl still zooms by a clear step', async ({ page }) => {
    await openDiagram(page, 'class', 'class A');
    await element(page, 'A').scrollIntoViewIfNeeded();
    const box = await element(page, 'A').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -100);
    await page.keyboard.up('Control');
    await expect(zoomReadout(page)).toHaveText(/^1[12]\d%$/);
  });
});

test.describe('pane splitter', () => {
  const splitter = page => page.getByRole('separator', { name: 'Resize editor pane', exact: true });
  const sourcePane = page => page.getByRole('region', { name: 'ArchUML source editor', exact: true });

  test('reports its position to assistive technology as it moves', async ({ page }) => {
    await openDiagram(page, 'class', 'class A');
    const width = Math.round((await sourcePane(page).boundingBox()).width);
    await expect(splitter(page)).toHaveAttribute('aria-valuenow', String(width));
    await splitter(page).press('ArrowRight');
    await expect(splitter(page)).toHaveAttribute('aria-valuenow', String(width + 10));
  });

  test('resizes the source pane height with Down when panes are stacked', async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 900 });
    await openDiagram(page, 'class', 'class A');
    await expect(splitter(page)).toHaveAttribute('aria-orientation', 'horizontal');
    const height = (await sourcePane(page).boundingBox()).height;
    await splitter(page).press('ArrowDown');
    await expect.poll(async () => (await sourcePane(page).boundingBox()).height).toBeCloseTo(height + 10, 0);
  });

  test('a stored desktop width does not become the stacked pane height', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('uml-pg-editor-size', '640'));
    await page.setViewportSize({ width: 600, height: 900 });
    await openDiagram(page, 'class', 'class A');
    expect((await sourcePane(page).boundingBox()).height).toBeLessThan(400);
  });
});

test.describe('properties panel edits keep the model intact', () => {
  const highlight = page => page.getByRole('textbox', { name: /^Highlight color/ });
  const relationLabel = page => page.getByRole('textbox', { name: 'Label', exact: true });
  async function select(target) { await target.focus(); await target.press('Enter'); }
  async function commit(field, value) { await field.fill(value); await field.press('Enter'); }

  for (const fixture of [
    { type: 'deployment', name: 'Web Server', body: 'node "Web Server"\nnode DB\n"Web Server" --> DB', relations: 1 },
    { type: 'usecase', name: 'Place Order', body: 'actor User\nusecase "Place Order"\nUser -- "Place Order"', relations: 1 },
    { type: 'er', name: 'Library Member', body: 'entity "Library Member" {\n  # id\n}\nrelationship Borrows\n"Library Member" -- Borrows', relations: 1 },
  ]) {
    test(`highlighting a ${fixture.type} element named "${fixture.name}" keeps its name and relations`, async ({ page }) => {
      await openDiagram(page, fixture.type, fixture.body);
      await expect(relations(page)).toHaveCount(fixture.relations);
      await select(element(page, fixture.name));
      await commit(highlight(page), 'red');
      await expect(source(page)).toHaveValue(/#red/);
      await expect(element(page, fixture.name)).toBeVisible();
      await expect(relations(page)).toHaveCount(fixture.relations);
    });
  }

  test('an activity guard of several words is shown and edited as the guard', async ({ page }) => {
    await openDiagram(page, 'activity', '(*) --> "Check"\n"Check" --> [is valid] "Ship"\n"Ship" --> (*)');
    await select(page.getByRole('button', { name: /^Relation segment 1 of rel:2/ }));
    const guard = page.getByRole('textbox', { name: 'Guard', exact: true });
    await expect(guard).toHaveValue('is valid');
    await commit(guard, 'in stock');
    await expect(source(page)).toHaveValue(/"Check" --> \[in stock\] "Ship"/);
  });

  test('relabelling a connector between bracketed components keeps both components', async ({ page }) => {
    await openDiagram(page, 'component', '[Web App] --> [DB] : uses');
    await expect(element(page, 'Web App')).toBeVisible();
    await select(relations(page).first());
    await commit(relationLabel(page), 'queries');
    await expect(element(page, 'Web App')).toBeVisible();
    await expect(element(page, 'DB')).toBeVisible();
    await expect(relations(page)).toHaveCount(1);
  });

  test('a dashed connector stays dashed when its label changes', async ({ page }) => {
    await openDiagram(page, 'component', 'component A\ncomponent B\nA --> B dashed : x');
    await expect(element(page, 'A')).toBeVisible();
    await select(relations(page).first());
    await expect(page.getByRole('checkbox', { name: 'Dashed connector' })).toBeChecked();
    await commit(relationLabel(page), 'y');
    await expect(source(page)).toHaveValue(/A --> B dashed : y/);
  });

  test('a use-case include can be changed to extend and to a plain association', async ({ page }) => {
    await openDiagram(page, 'usecase', 'usecase "A" as UC1\nusecase "B" as UC2\nUC1 ..> UC2 : <<include>>');
    await expect(element(page, 'A')).toBeVisible();
    await select(relations(page).first());
    await page.getByLabel('Type', { exact: true }).selectOption('extend');
    await expect(source(page)).toHaveValue(/UC1 \.\.> UC2 : <<extend>>/);
    await page.getByLabel('Type', { exact: true }).selectOption('plain');
    await expect(source(page)).toHaveValue(/UC1 -- UC2\n/);
  });

  test('inverting an unlabelled sequence reply does not invent a label', async ({ page }) => {
    await openDiagram(page, 'sequence', 'participant A\nparticipant B\nA -> B: go()\nB --> A');
    await select(page.getByRole('button', { name: /^Relation segment 1 of seqmsg:4/ }));
    await page.getByRole('button', { name: 'Invert direction', exact: true }).click();
    await expect(source(page)).toHaveValue(/\nA --> B\n/);
  });

  test('a sequence message label can be cleared', async ({ page }) => {
    await openDiagram(page, 'sequence', 'participant A\nparticipant B\nA -> B: go()');
    await select(page.getByRole('button', { name: /^Relation segment 1 of seqmsg:3/ }));
    await commit(relationLabel(page), '');
    await expect(source(page)).toHaveValue(/\nA -> B\n/);
  });

  test('editing a generic class keeps the relations that name it', async ({ page }) => {
    await openDiagram(page, 'class', 'class Stack<T> {\n  +push(x: T)\n}\nclass Node\nStack<T> --> Node');
    await select(element(page, 'Stack<T>'));
    await commit(page.getByRole('textbox', { name: /^Stereotype/ }), 'entity');
    await expect(source(page)).toHaveValue(/<<entity>>/);
    await expect(element(page, 'Stack<T>')).toBeVisible();
    await expect(relations(page)).toHaveCount(1);
  });

  test('relabelling a freeform edge keeps its line style', async ({ page }) => {
    await openDiagram(page, 'freeform', 'box "A" as A\nbox "B" as B\nA <..> B : sync');
    await expect(element(page, 'A')).toBeVisible();
    await select(relations(page).first());
    await commit(relationLabel(page), 'mirror');
    await expect(source(page)).toHaveValue(/A <\.\.> B : mirror/);
  });
});

test.describe('edits land on the source line the diagram shows', () => {
  // Fragments and messages are addressed by the source line that opens them.
  const fragment = (page, line) => page.getByRole('button', { name: new RegExp(`^Fragment frag:${line} — `) });
  const message = (page, line) => page.getByRole('button', { name: new RegExp(`^Relation segment 1 of seqmsg:${line} `) });
  async function select(target) { await target.focus(); await target.press('Enter'); }

  test('deleting a relation removes that relation when the source starts with a blank line', async ({ page }) => {
    await openSource(page, 'class', '\n@startuml\nclass A\nclass B\nclass C\nA --> B\nB --> C\n@enduml');
    await expect(element(page, 'C')).toBeVisible();
    await select(relations(page).nth(1));
    await page.keyboard.press('Delete');
    await expect(relations(page)).toHaveCount(1);
    await expect(source(page)).toHaveValue(/class C\nA --> B\n@enduml/);
  });

  test('deleting a message removes that message when the source has no @startuml', async ({ page }) => {
    await openSource(page, 'sequence', 'participant A\nparticipant B\nA -> B: one\nA -> B: two');
    await select(relations(page).nth(1));
    await page.keyboard.press('Delete');
    await expect(relations(page)).toHaveCount(1);
    await expect(source(page)).toHaveValue(/participant B\nA -> B: one\n/);
    await expect(source(page)).not.toHaveValue(/two/);
  });

  test('the first fragment cannot be moved above the diagram start', async ({ page }) => {
    const text = '@startuml\nparticipant A\nparticipant B\nalt [x]\n  A -> B: m\nend\n@enduml';
    await openSource(page, 'sequence', text);
    await select(fragment(page, 3));
    await page.getByRole('button', { name: 'Move earlier', exact: true }).click();
    await expect(page.getByText('Fragment is already first.', { exact: true })).toBeVisible();
    await expect(source(page)).toHaveValue(text);
  });

  test('a fragment moves earlier past the fragment before it', async ({ page }) => {
    await openDiagram(page, 'sequence', 'participant A\nparticipant B\nopt [a]\n  A -> B: one\nend\nalt [x]\n  A -> B: two\nend');
    await select(fragment(page, 6));
    await page.getByRole('button', { name: 'Move earlier', exact: true }).click();
    await expect(source(page)).toHaveValue(/participant B\nalt \[x\]\n  A -> B: two\nend\nopt \[a\]\n  A -> B: one\nend\n/);
  });

  test('a nested fragment stays inside its parent when moved earlier', async ({ page }) => {
    const body = 'participant A\nparticipant B\nalt [x]\n  opt [y]\n    A -> B: m\n  end\nelse [z]\n  A -> B: n\nend';
    await openDiagram(page, 'sequence', body);
    await select(fragment(page, 4));
    await page.getByRole('button', { name: 'Move earlier', exact: true }).click();
    await expect(page.getByText('Fragment is already first inside its parent.', { exact: true })).toBeVisible();
    await expect(source(page)).toHaveValue(`@startuml\n${body}\n@enduml`);
  });

  test('a fragment condition written without brackets can be edited', async ({ page }) => {
    await openDiagram(page, 'sequence', 'participant A\nparticipant B\nloop each item\n  A -> B: m\nend');
    await select(fragment(page, 3));
    await expect(page.getByRole('textbox', { name: 'Condition', exact: true })).toHaveValue('each item');
  });

  test('removing a fragment wrapper keeps the layout of the message after it', async ({ page }) => {
    const layout = '@layout schema=1 renderer="archuml-visual-editor"\nnode "label:seqmsg:6" x=200 y=400\n@endlayout';
    await openSource(page, 'sequence', `@startuml\nparticipant A\nparticipant B\nalt [ready]\nA -> B: first\nend\nA -> B: after\n${layout}\n@enduml`);
    await select(fragment(page, 3));
    await page.getByRole('button', { name: 'Remove fragment (keep inner messages)', exact: true }).click();
    await expect(source(page)).not.toHaveValue(/alt \[ready\]/);
    const saved = await page.evaluate(text => {
      const data = window.UMLShared.extractLayoutMetadata(text);
      return { line: data.text.split('\n').findIndex(line => line.includes('A -> B: after')), positions: data.layout.positions };
    }, await source(page).inputValue());
    expect(saved.positions['label:seqmsg:' + saved.line]).toEqual({ x: 200, y: 400 });
  });

  test('deleting everything selected removes fragments along with the messages before them', async ({ page }) => {
    await openDiagram(page, 'sequence', 'participant A\nparticipant B\nA -> B: one\nalt [x]\n  A -> B: two\nend\nA -> B: three');
    await select(message(page, 3));
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Delete');
    await expect(source(page)).not.toHaveValue(/A -> B/);
    await expect(source(page)).not.toHaveValue(/alt|end\n/);
  });

  test('a class declared with its brace against the name can be selected', async ({ page }) => {
    await openDiagram(page, 'class', 'class Foo{\n  +x: int\n}\nclass Bar\nFoo --> Bar');
    await expect(element(page, 'Foo')).toBeVisible();
  });

  test('a right-to-left message can be reordered like any other', async ({ page }) => {
    await openDiagram(page, 'sequence', 'participant A\nparticipant B\nA <- B: back\nA -> B: go');
    await select(message(page, 3));
    await page.getByRole('button', { name: 'Move later', exact: true }).click();
    await expect(source(page)).toHaveValue(/A -> B: go\nA <- B: back\n/);
  });

  test('an edit does not pin an unplaced class named like a built-in property', async ({ page }) => {
    await openDiagram(page, 'class', 'class A @pos(120, 80)\nclass toString\nA --> toString');
    await select(relations(page).first());
    const label = page.getByRole('textbox', { name: 'Label', exact: true });
    await label.fill('uses');
    await label.press('Enter');
    await expect(source(page)).toHaveValue(/A --> toString : uses/);
    await expect(source(page)).toHaveValue(/class toString\n/);
  });
});

test.describe('connecting elements and using menus', () => {
  const relationTool = (page, name) => page.getByRole('button', { name: `Add relation: ${name}`, exact: true });
  const extendHandle = (page, name) => page.getByRole('button', { name: `Extend a relation from ${name}`, exact: true });
  const chooser = page => page.getByRole('menu', { name: 'Pick a relation type', exact: true });
  const centre = async locator => {
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  // Hover the element so its "+" appears, then drag from the "+" to the target.
  async function dragFromHandle(page, from, to) {
    const start = await centre(element(page, from));
    await page.mouse.move(start.x, start.y);
    const handle = await centre(extendHandle(page, from));
    await page.mouse.move(handle.x, handle.y);
    await page.mouse.down();
    const end = await centre(element(page, to));
    await page.mouse.move((handle.x + end.x) / 2, (handle.y + end.y) / 2);
    await page.mouse.move(end.x, end.y);
  }

  test('a relation tool does not connect to a relation label', async ({ page }) => {
    const text = '@startuml\ncomponent A\ncomponent B\nA --> B : uses\n@enduml';
    await openSource(page, 'component', text);
    await relationTool(page, 'Connector').click();
    await element(page, 'A').press('Enter');
    await page.getByRole('button', { name: /^Label uses/ }).press('Enter');
    await expect(page.getByText(/connects elements/)).toBeVisible();
    await expect(source(page)).toHaveValue(text);
  });

  test('a relation picked after dragging from "+" is undone in one step', async ({ page }) => {
    const text = '@startuml\nclass A\nclass B\n@enduml';
    await openSource(page, 'class', text);
    await dragFromHandle(page, 'A', 'B');
    await page.mouse.up();
    await chooser(page).getByRole('menuitem', { name: /Association$/ }).first().click();
    await expect(relations(page)).toHaveCount(1);
    await undo(page).click();
    await expect(source(page)).toHaveValue(text);
  });

  test('Escape cancels a drag from "+" before it connects anything', async ({ page }) => {
    const text = '@startuml\nclass A\nclass B\n@enduml';
    await openSource(page, 'class', text);
    await dragFromHandle(page, 'A', 'B');
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(source(page)).toHaveValue(text);
  });

  test('clicking "+" without dragging offers a new element, not a self-relation', async ({ page }) => {
    await openDiagram(page, 'component', 'component A\ncomponent B');
    const start = await centre(element(page, 'A'));
    await page.mouse.move(start.x, start.y);
    const handle = await centre(extendHandle(page, 'A'));
    // Left of centre: the half of the handle that overlaps the element itself.
    await page.mouse.click(handle.x - 4, handle.y);
    await expect(page.getByRole('menu', { name: 'Pick an element type to create', exact: true })).toBeVisible();
  });

  test('focus stays on the element after a context-menu action', async ({ page }) => {
    await openDiagram(page, 'class', 'class A\nclass B');
    const target = await centre(element(page, 'A'));
    await page.mouse.click(target.x, target.y, { button: 'right' });
    await page.getByRole('menuitem', { name: /^Edit properties/ }).click();
    await expect(element(page, 'A')).toBeFocused();
  });

  test('a relation source removed by a text edit is forgotten', async ({ page }) => {
    await openDiagram(page, 'class', 'class A\nclass B\nclass C');
    await relationTool(page, 'Association').click();
    await element(page, 'A').press('Enter');
    await source(page).fill('@startuml\nclass B\nclass C\n@enduml');
    await expect(element(page, 'A')).toHaveCount(0);
    await element(page, 'B').press('Enter');
    await element(page, 'C').press('Enter');
    await expect(source(page)).toHaveValue(/B --> C/);
    await expect(element(page, 'A')).toHaveCount(0);
  });
});

test.describe('state diagram modelling', () => {
  async function select(target) { await target.focus(); await target.press('Enter'); }
  async function commit(field, value) { await field.fill(value); await field.press('Enter'); }
  const kind = page => page.getByLabel('Kind', { exact: true });

  test('a state stays in the diagram and shows its stereotype', async ({ page }) => {
    await openDiagram(page, 'state', 'state A\nstate B\nA --> B');
    await select(element(page, 'A'));
    await commit(page.getByRole('textbox', { name: /^Stereotype/ }), 'service');
    await expect(source(page)).toHaveValue(/state A <<service>>/);
    await expect(element(page, 'A')).toBeVisible();
    await expect(renderedText(page, '«service»')).toBeVisible();
  });

  for (const pseudostate of [
    { tool: 'History (H)', declared: 'state History <<history>>', symbol: 'H' },
    { tool: 'Deep history (H*)', declared: 'state DeepHistory <<deepHistory>>', symbol: 'H*' },
  ]) {
    test(`the palette adds a ${pseudostate.tool} pseudostate drawn as ${pseudostate.symbol}`, async ({ page }) => {
      await openDiagram(page, 'state', 'state A');
      await page.getByRole('button', { name: `Add element: ${pseudostate.tool}`, exact: true }).press('Enter');
      await expect(source(page)).toHaveValue(new RegExp(pseudostate.declared.replace(/[<>*]/g, '\\$&')));
      await expect(renderedText(page, pseudostate.symbol)).toBeVisible();
    });
  }

  for (const symbolOnly of ['fork', 'join', 'junction', 'terminate', 'choice']) {
    test(`a state turned into a ${symbolOnly} is drawn as a symbol and stays connected`, async ({ page }) => {
      await openDiagram(page, 'state', 'state A\nstate B\nA --> B');
      await select(element(page, 'A'));
      await kind(page).selectOption(symbolOnly);
      await expect(source(page)).toHaveValue(new RegExp(`state A <<${symbolOnly}>>`));
      await expect(element(page, 'A')).toBeVisible();
      await expect(renderedText(page, 'A')).toHaveCount(0);
      await expect(relations(page)).toHaveCount(1);
      await expect(kind(page)).toHaveValue(symbolOnly);
    });
  }

  test('entry, do and exit actions are edited in the panel and drawn in the state', async ({ page }) => {
    await openDiagram(page, 'state', 'state Heating\nstate Idle\nIdle --> Heating');
    await select(element(page, 'Heating'));
    await commit(page.getByRole('textbox', { name: 'Entry action', exact: true }), 'heaterOn()');
    await commit(page.getByRole('textbox', { name: 'Do activity', exact: true }), 'regulate()');
    await commit(page.getByRole('textbox', { name: 'Exit action', exact: true }), 'heaterOff()');
    for (const row of ['entry / heaterOn()', 'do / regulate()', 'exit / heaterOff()']) {
      await expect(renderedText(page, row)).toBeVisible();
    }
    await expect(relations(page)).toHaveCount(1);
  });

  test('after one state\'s action is edited, editing another state\'s keeps that state selected, so Delete removes it', async ({ page }) => {
    await openDiagram(page, 'state', '[*] --> Idle\nstate Idle\nstate Busy\nIdle --> Busy : start');
    await select(element(page, 'Idle'));
    await commit(page.getByRole('textbox', { name: 'Entry action', exact: true }), 'start()');
    await expect(renderedText(page, 'entry / start()')).toBeVisible();
    await select(element(page, 'Busy'));
    await commit(page.getByRole('textbox', { name: 'Entry action', exact: true }), 'work()');
    await expect(renderedText(page, 'entry / work()')).toBeVisible();

    await page.getByRole('region', { name: 'State — Busy', exact: true }).getByRole('button', { name: '✕ Delete', exact: true }).click();

    await expect(element(page, 'Busy')).toHaveCount(0);
    await expect(element(page, 'Idle')).toBeVisible();
  });

  test('an action replaces the one written on a named row', async ({ page }) => {
    await openDiagram(page, 'state', 'state A\nA : entry / old()');
    await select(element(page, 'A'));
    const entry = page.getByRole('textbox', { name: 'Entry action', exact: true });
    await expect(entry).toHaveValue('old()');
    await commit(entry, 'fresh()');
    await expect(renderedText(page, 'entry / fresh()')).toBeVisible();
    await expect(source(page)).not.toHaveValue(/old\(\)/);
  });

  test('a state that only transitions mention can be given an action without leaving its region', async ({ page }) => {
    await openDiagram(page, 'state', 'state Outer {\n  Idle --> Busy\n}');
    await select(element(page, 'Busy'));
    await commit(page.getByRole('textbox', { name: 'Entry action', exact: true }), 'work()');
    await expect(renderedText(page, 'entry / work()')).toBeVisible();
    const regions = await page.evaluate(text => window.UMLStateDiagram.parse(window.UMLShared.extractLayoutMetadata(text).text)
      .states.filter(state => state.name === 'Busy').map(state => state.parent), await source(page).inputValue());
    expect(regions).toEqual(['Outer']);
  });

  test('internal transitions are edited one per line and an incomplete one is explained', async ({ page }) => {
    await openDiagram(page, 'state', 'state Armed');
    await select(element(page, 'Armed'));
    const internal = page.getByRole('textbox', { name: /^Internal transitions/ });
    await internal.fill('tick [armed] / count()');
    await internal.blur();
    await expect(renderedText(page, 'tick [armed] / count()')).toBeVisible();
    await select(element(page, 'Armed'));
    await page.getByRole('textbox', { name: /^Internal transitions/ }).fill('tick');
    await page.getByRole('textbox', { name: /^Internal transitions/ }).blur();
    await expect(page.getByText(/needs an effect after a slash/)).toBeVisible();
    await expect(source(page)).toHaveValue(/tick \[armed\] \/ count\(\)/);
  });

  test('a composite state can be given its own initial and final pseudostates', async ({ page }) => {
    await openDiagram(page, 'state', 'state Outer {\n  state First\n  state Last\n  First --> Last\n}');
    await select(element(page, 'Outer'));
    await page.getByRole('button', { name: '+ Initial state', exact: true }).click();
    await select(element(page, 'Outer'));
    await page.getByRole('button', { name: '+ Final state', exact: true }).click();
    await expect(source(page)).toHaveValue(/\[\*\] --> First/);
    await expect(source(page)).toHaveValue(/Last --> \[\*\]/);
    const regions = await page.evaluate(text => window.UMLStateDiagram.parse(window.UMLShared.extractLayoutMetadata(text).text)
      .states.filter(state => /^__(initial|final)__/.test(state.name)).map(state => state.parent), await source(page).inputValue());
    expect(regions).toEqual(['Outer', 'Outer']);
  });
});

test.describe('sequence and deployment modelling', () => {
  async function select(target) { await target.focus(); await target.press('Enter'); }

  test('an asynchronous reply keeps its arrow when its label changes', async ({ page }) => {
    await openDiagram(page, 'sequence', 'participant A\nparticipant B\nA -->> B: done');
    await select(relations(page).first());
    await expect(page.getByLabel('Type', { exact: true })).toHaveValue('asyncReply');
    const label = page.getByRole('textbox', { name: 'Label', exact: true });
    await label.fill('finished');
    await label.press('Enter');
    await expect(source(page)).toHaveValue(/A -->> B : finished/);
  });

  test('an artifact can carry a stereotype', async ({ page }) => {
    await openDiagram(page, 'deployment', 'artifact "web.xml" as Config');
    await select(element(page, 'web.xml'));
    const stereotype = page.getByRole('textbox', { name: /^Stereotype/ });
    await stereotype.fill('deployment spec');
    await stereotype.press('Enter');
    await expect(source(page)).toHaveValue(/artifact "web\.xml" as Config <<deployment spec>>/);
    await expect(element(page, 'web.xml')).toBeVisible();
  });
});

test.describe('drafts', () => {
  test('a tab left untouched does not overwrite a newer draft saved from another tab', async ({ context }) => {
    const older = '@startuml\nclass Older\n@enduml';
    const newer = '@startuml\nclass Newer\n@enduml';
    await context.addInitScript(text => {
      if (!localStorage.getItem('uml-pg-autosave-class')) localStorage.setItem('uml-pg-autosave-class', text);
    }, older);
    const idle = await context.newPage();
    await idle.goto('/SEBook/tools/uml-playground');
    await expect(source(idle)).toHaveValue(older);

    const active = await context.newPage();
    await active.goto('/SEBook/tools/uml-playground');
    await source(active).fill(newer);
    await expect(active.getByText('✓ Saved', { exact: true })).toBeVisible();
    await active.close();

    // The idle tab is hidden or closed without having changed anything.
    await idle.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await idle.close();

    const later = await context.newPage();
    await later.goto('/SEBook/tools/uml-playground');
    await expect(source(later)).toHaveValue(newer);
  });
});
