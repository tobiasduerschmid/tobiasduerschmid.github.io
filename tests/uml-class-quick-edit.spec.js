const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');

const PLAYGROUND = '/SEBook/tools/uml-playground.html';
const sourceInput = page => page.getByRole('textbox', { name: 'ArchUML diagram source', exact: true });
const preview = page => page.getByRole('region', { name: 'Diagram preview', exact: true });
const classActions = page => page.getByRole('region', { name: 'Class editing', exact: true });
const memberForm = page => page.getByRole('form', { name: 'Add class member', exact: true });

function classTarget(page, name) {
  return page.getByRole('button', {
    name: `Element ${name} — Enter to select, arrows to nudge, Delete to remove`, exact: true,
  });
}

async function openDiagram(page, source) {
  await page.goto(PLAYGROUND);
  await sourceInput(page).fill(source);
  await expect(sourceInput(page)).toHaveValue(source);
}

async function selectClass(page, name) {
  await classTarget(page, name).press('Enter');
  await expect(classActions(page)).toContainText(`Selected: ${name}`);
}

async function doubleClickHeader(page, name) {
  const label = preview(page).getByText(name, { exact: true });
  await expect(label).toBeVisible();
  await label.scrollIntoViewIfNeeded();
  const box = await label.boundingBox();
  // Real pointer coordinates exercise the rendered header beneath the SVG
  // editing overlay, without preselecting through its keyboard counterpart.
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
}

test('a class placed with palette clicks can immediately be renamed by double-clicking its header', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await openDiagram(page, '@startuml\nclass Existing\n@enduml');
  await expect(preview(page).getByText('Existing', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add element: Class', exact: true }).click();
  const canvas = await preview(page).boundingBox();
  await preview(page).click({ position: { x: canvas.width - 40, y: canvas.height - 40 } });
  await expect(classTarget(page, 'Class')).toBeVisible();
  const before = await sourceInput(page).inputValue();

  await doubleClickHeader(page, 'Class');
  const rename = page.getByRole('textbox', { name: 'Rename Class', exact: true });
  await expect(rename).toBeFocused();
  await rename.fill('Player');
  await rename.press('Enter');

  await expect(preview(page).getByText('Player', { exact: true })).toBeVisible();
  await expect(sourceInput(page)).toHaveValue(/class Player\b/);
  await expect(sourceInput(page)).not.toHaveValue(/class Class\b/);
  await page.getByRole('button', { name: /Undo$/ }).click();
  await expect(sourceInput(page)).toHaveValue(before);
});

test('double-click renaming an unselected class preserves members, relationships and member type references', async ({ page }) => {
  const original = [
    '@startuml',
    'class Player { -name: String; +play(): void }',
    'class Game { -current: Player; +find(players: List<Player>): Player }',
    'Player --> Game: plays',
    '@enduml',
  ].join('\n');
  await openDiagram(page, original);
  await doubleClickHeader(page, 'Player');
  const rename = page.getByRole('textbox', { name: 'Rename Player', exact: true });
  await rename.fill('Participant');
  await rename.press('Enter');

  await expect(sourceInput(page)).toHaveValue(original.replace(/\bPlayer\b/g, 'Participant'));
  await expect(preview(page).getByText('Participant', { exact: true })).toBeVisible();
  await expect(preview(page).getByText(/play\(\).*void/)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Relation segment/ }).first()).toBeAttached();
  await page.getByRole('button', { name: /Undo$/ }).click();
  await expect(sourceInput(page)).toHaveValue(original);
});

test('direct controls add an attribute and method while preserving existing members and undo history', async ({ page }) => {
  const original = '@startuml\nclass Player { -name: String; +play(): void }\n@enduml';
  await openDiagram(page, original);
  await selectClass(page, 'Player');
  await classActions(page).getByRole('button', { name: 'Add attribute', exact: true }).click();
  await page.getByRole('textbox', { name: 'Attribute signature', exact: true }).fill('-balance: int');
  await memberForm(page).getByRole('button', { name: 'Add', exact: true }).click();
  await expect(sourceInput(page)).toHaveValue(/-\s*balance: int/);
  const withAttribute = await sourceInput(page).inputValue();

  await classActions(page).getByRole('button', { name: 'Add method', exact: true }).click();
  const signature = page.getByRole('textbox', { name: 'Method signature', exact: true });
  await expect(signature).toBeFocused();
  await signature.fill('+roll(dice: int): int');
  await signature.press('Enter');

  await expect(sourceInput(page)).toHaveValue(/-\s*name: String/);
  await expect(sourceInput(page)).toHaveValue(/\+\s*play\(\): void/);
  await expect(sourceInput(page)).toHaveValue(/-\s*balance: int/);
  await expect(sourceInput(page)).toHaveValue(/\+\s*roll\(dice: int\): int/);
  await expect(preview(page).getByText(/balance\s*:\s*int/)).toBeVisible();
  await expect(preview(page).getByText(/roll\(dice:\s*int\).*int/)).toBeVisible();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await page.getByRole('button', { name: /Undo$/ }).click();
  await expect(sourceInput(page)).toHaveValue(withAttribute);
  await page.getByRole('button', { name: /Undo$/ }).click();
  await expect(sourceInput(page)).toHaveValue(original);
});

test('adding an attribute preserves a quoted semicolon inside an existing multiline member', async ({ page }) => {
  const original = '@startuml\nclass Player {\n -label: String = "a;b"\n}\n@enduml';
  await openDiagram(page, original);
  await selectClass(page, 'Player');
  await expect(preview(page).getByText(/label.*"a;b"/)).toBeVisible();
  await classActions(page).getByRole('button', { name: 'Add attribute', exact: true }).click();
  const signature = page.getByRole('textbox', { name: 'Attribute signature', exact: true });
  await signature.fill('-balance: int');
  await signature.press('Enter');

  await expect(sourceInput(page)).toHaveValue(/-\s*label: String = "a;b"/);
  await expect(preview(page).getByText(/label.*"a;b"/)).toBeVisible();
  await expect(preview(page).getByText(/balance\s*:\s*int/)).toBeVisible();
  await expect(preview(page).getByText('b"', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /Undo$/ }).click();
  await expect(sourceInput(page)).toHaveValue(original);
});

test('blank or cancelled member entry leaves the diagram unchanged and returns keyboard focus', async ({ page }) => {
  const original = '@startuml\nclass Player { +play(): void }\n@enduml';
  await openDiagram(page, original);
  await selectClass(page, 'Player');
  const addAttribute = classActions(page).getByRole('button', { name: 'Add attribute', exact: true });
  await addAttribute.click();
  const signature = page.getByRole('textbox', { name: 'Attribute signature', exact: true });
  await signature.fill('   ');
  await signature.press('Enter');
  await expect(memberForm(page)).toBeVisible();
  await expect(memberForm(page).getByRole('alert')).toBeVisible();
  await expect(sourceInput(page)).toHaveValue(original);
  await signature.fill('-discarded: int');
  await page.clock.install();
  await page.evaluate(() => document.documentElement.classList.toggle('dark-mode'));
  // Exercise the deferred theme redraw without a wall-clock sleep. Merely
  // asserting immediately after changing the theme would miss draft loss.
  await page.clock.runFor(1000);
  await expect(signature).toHaveValue('-discarded: int');
  await expect(signature).toBeFocused();
  await signature.press('Escape');
  await expect(memberForm(page)).toBeHidden();
  await expect(addAttribute).toBeFocused();
  await expect(sourceInput(page)).toHaveValue(original);

  await classActions(page).getByRole('button', { name: 'Add method', exact: true }).click();
  await page.getByRole('textbox', { name: 'Method signature', exact: true }).fill('+discarded(): void');
  await memberForm(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(sourceInput(page)).toHaveValue(original);
  await expect(classActions(page).getByRole('button', { name: 'Add method', exact: true })).toBeFocused();
});

test('selecting a different class discards a pending signature instead of adding it to the old target', async ({ page }) => {
  const original = '@startuml\nclass Player\nclass Game\n@enduml';
  await openDiagram(page, original);
  await selectClass(page, 'Player');
  await classActions(page).getByRole('button', { name: 'Add attribute', exact: true }).click();
  await page.getByRole('textbox', { name: 'Attribute signature', exact: true }).fill('-discarded: int');

  await selectClass(page, 'Game');
  await expect(memberForm(page)).toBeHidden();
  await expect(sourceInput(page)).toHaveValue(original);
  await classActions(page).getByRole('button', { name: 'Add method', exact: true }).click();
  const signature = page.getByRole('textbox', { name: 'Method signature', exact: true });
  await signature.fill('+start(): void');
  await signature.press('Enter');
  await expect(sourceInput(page)).toHaveValue(/class Game\s*\{\s*\+\s*start\(\): void\s*\}/);
  await expect(sourceInput(page)).toHaveValue(/^class Player$/m);
  await expect(sourceInput(page)).not.toHaveValue(/discarded/);
});

test('changing diagram type cancels member entry without carrying it into either diagram', async ({ page }) => {
  const original = '@startuml\nclass Player\n@enduml';
  await openDiagram(page, original);
  await selectClass(page, 'Player');
  await classActions(page).getByRole('button', { name: 'Add attribute', exact: true }).click();
  await page.getByRole('textbox', { name: 'Attribute signature', exact: true }).fill('-discarded: int');

  await page.getByLabel('Diagram type:', { exact: true }).selectOption('state');
  await expect(classActions(page)).toBeHidden();
  await expect(memberForm(page)).toBeHidden();
  await expect(sourceInput(page)).not.toHaveValue(/discarded/);
  await page.getByLabel('Diagram type:', { exact: true }).selectOption('class');
  await expect(sourceInput(page)).toHaveValue(original);
  await expect(memberForm(page)).toBeHidden();
});

test('the direct Rename class button supports keyboard renaming and rejects name collisions', async ({ page }) => {
  const original = '@startuml\nclass Player\nclass Game { -owner: Player }\nPlayer --> Game\n@enduml';
  await openDiagram(page, original);
  await selectClass(page, 'Player');
  const renameClass = classActions(page).getByRole('button', { name: 'Rename class', exact: true });
  await renameClass.press('Enter');
  const rename = page.getByRole('textbox', { name: 'Rename Player', exact: true });
  await expect(rename).toBeFocused();
  await rename.fill('Game');
  await rename.press('Enter');
  await expect(sourceInput(page)).toHaveValue(original);

  await renameClass.press('Enter');
  await rename.fill('Participant');
  await rename.press('Enter');
  await expect(sourceInput(page)).toHaveValue(original.replace(/\bPlayer\b/g, 'Participant'));
  await expect(preview(page).getByText('Participant', { exact: true })).toBeVisible();
});

for (const theme of ['light', 'dark']) {
  test(`direct class editing is keyboard accessible in narrow fullscreen ${theme} mode`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width: 320, height: 844 });
    await openDiagram(page, '@startuml\nclass Player\n@enduml');
    await page.evaluate(theme => document.documentElement.classList.toggle('dark-mode', theme === 'dark'), theme);
    await page.getByRole('button', { name: '⛶ Full screen', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Exit full screen', exact: true })).toBeVisible();
    await selectClass(page, 'Player');
    const addMethod = classActions(page).getByRole('button', { name: 'Add method', exact: true });
    await addMethod.press('Enter');
    const signature = page.getByRole('textbox', { name: 'Method signature', exact: true });
    await expect(signature).toBeFocused();
    await expect(signature).toBeInViewport({ ratio: 1 });
    await signature.fill('+roll(): int');
    await page.keyboard.press('Tab');
    await expect(memberForm(page).getByRole('button', { name: 'Add', exact: true })).toBeFocused();
    await page.screenshot({ path: test.info().outputPath(`class-member-form-${theme}.png`) });
    await a11yCheckpoint(page, `class member entry in ${theme} narrow fullscreen`, {
      include: '[aria-label="Class editing"]', darkMode: false,
    });
    await page.keyboard.press('Enter');
    await expect(sourceInput(page)).toHaveValue(/\+\s*roll\(\): int/);
    await expect(memberForm(page)).toBeHidden();
    await expect(addMethod).toBeFocused();
    await expect(addMethod).toBeInViewport({ ratio: 1 });
    await expect(preview(page).getByText(/roll\(\).*int/)).toBeVisible();
    await page.getByRole('button', { name: 'Exit full screen', exact: true }).click();
    expect(errors, 'direct class editing must not cause browser JavaScript errors').toEqual([]);
  });
}
