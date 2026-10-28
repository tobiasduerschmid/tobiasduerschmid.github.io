const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');

const sourceInput = page => page.getByRole('textbox', { name: 'ArchUML diagram source', exact: true });
const preview = page => page.getByRole('region', { name: 'Diagram preview', exact: true });
const memberEditor = page => page.getByRole('textbox', { name: 'Edit class member', exact: true });
const memberForm = page => page.getByRole('form', { name: 'Add class member', exact: true });
const classTarget = (page, name) => page.getByRole('button', {
  name: `Element ${name} — Enter to select, arrows to nudge, Delete to remove`, exact: true,
});

async function openDiagram(page, source) {
  await page.goto('/SEBook/tools/uml-playground.html');
  await sourceInput(page).fill(source);
  await expect(sourceInput(page)).toHaveValue(source);
}

async function classText(page, className, text, occurrence = 0) {
  await classTarget(page, className).scrollIntoViewIfNeeded();
  const classBox = await classTarget(page, className).boundingBox();
  const candidates = preview(page).getByText(text, { exact: typeof text === 'string' });
  await expect(candidates).not.toHaveCount(0);
  // Two classes can display identical signatures. Match the visible row in
  // the named class's bounds without relying on SVG structure or source order.
  const rows = [];
  for (const candidate of await candidates.all()) {
    const box = await candidate.boundingBox();
    if (box && box.x + box.width / 2 >= classBox.x && box.x + box.width / 2 <= classBox.x + classBox.width
        && box.y + box.height / 2 >= classBox.y && box.y + box.height / 2 <= classBox.y + classBox.height) {
      rows.push({ candidate, top: box.y });
    }
  }
  rows.sort((left, right) => left.top - right.top);
  if (rows[occurrence]) return rows[occurrence].candidate;
  throw new Error(`No visible ${text} row inside class ${className}`);
}

async function doubleClickMember(page, className, text, occurrence = 0) {
  const row = await classText(page, className, text, occurrence);
  await row.scrollIntoViewIfNeeded();
  const box = await row.boundingBox();
  // Real coordinates exercise the class hitbox overlay and manual double-click
  // recognition. A synthetic dblclick bypasses the original failure.
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  await expect(memberEditor(page)).toBeFocused();
  return memberEditor(page);
}

async function openClassMenu(page, name) {
  // The accessible class target identifies the matching visual hitbox, which
  // receives pointer input above the SVG text. This is the same editor
  // integration contract used by uml-editor-student-flows.spec.js. A locator
  // click can re-resolve the hitbox if fullscreen replaces the SVG while
  // Playwright is scrolling it into view.
  const id = await classTarget(page, name).getAttribute('data-layout-id');
  await preview(page).locator(`.uml-pg-edit-hitbox[data-layout-id=${JSON.stringify(id)}]`)
    .click({ button: 'right' });
  await expect(page.getByRole('menu')).toBeVisible();
}

test('double-clicking an attribute edits its source row even when methods precede it in the source', async ({ page }) => {
  const original = [
    '@startuml',
    'class Player {',
    '  +play(): void',
    '  -balance: int',
    '  +getBalance(): int',
    '  -name: String',
    '}',
    'class Game',
    'Player --> Game: plays',
    '@enduml',
  ].join('\n');
  await openDiagram(page, original);
  const edit = await doubleClickMember(page, 'Player', /^-\s*balance:\s*int$/);
  await expect(edit).toHaveValue(/^-\s*balance:\s*int$/);
  await edit.fill('-credits: long');
  await edit.press('Enter');

  await expect(preview(page).getByText(/^-\s*credits:\s*long$/)).toBeVisible();
  await expect(preview(page).getByText(/^\+\s*play\(\):\s*void$/)).toBeVisible();
  await expect(preview(page).getByText(/^\+\s*getBalance\(\):\s*int$/)).toBeVisible();
  await expect(preview(page).getByText(/^-\s*name:\s*String$/)).toBeVisible();
  await expect(sourceInput(page)).not.toHaveValue(/-\s*balance:/);
  await expect(sourceInput(page)).toHaveValue(/^Player --> Game: plays$/m);
  await page.getByRole('button', { name: /Undo$/ }).click();
  await expect(sourceInput(page)).toHaveValue(original);
});

test('double-clicking a method distinguishes prefix signatures and the same signature in another class', async ({ page }) => {
  const original = '@startuml\nclass Player { +get(); +get(): int; -balance: int }\nclass Bank { +get(): int }\nPlayer --> Bank: uses\n@enduml';
  await openDiagram(page, original);
  const edit = await doubleClickMember(page, 'Player', /^\+\s*get\(\):\s*int$/);
  await expect(edit).toHaveValue(/^\+\s*get\(\):\s*int$/);
  await edit.fill('+getTotal(): long');
  await edit.press('Enter');

  await expect(await classText(page, 'Player', /^\+\s*get\(\)$/)).toBeVisible();
  await expect(await classText(page, 'Player', /^\+\s*getTotal\(\):\s*long$/)).toBeVisible();
  await expect(await classText(page, 'Bank', /^\+\s*get\(\):\s*int$/)).toBeVisible();
  await expect(sourceInput(page)).toHaveValue(/^class Bank \{ \+get\(\): int \}$/m);
  await expect(sourceInput(page)).toHaveValue(/^Player --> Bank: uses$/m);
  await expect(sourceInput(page)).toHaveValue(/-\s*balance: int/);
  await page.getByRole('button', { name: /Undo$/ }).click();
  await expect(sourceInput(page)).toHaveValue(original);
});

test('double-click editing retains static and abstract member modifiers', async ({ page }) => {
  const original = '@startuml\nabstract class Player { +{abstract} play(): void; -{static} count: int }\n@enduml';
  await openDiagram(page, original);
  const attribute = await doubleClickMember(page, 'Player', /count:\s*int$/);
  await expect(attribute).toHaveValue(/-\s*\{static\}\s*count: int/);
  await attribute.fill('-{static} count: long');
  await attribute.press('Enter');
  const method = await doubleClickMember(page, 'Player', /play\(\):\s*void$/);
  await expect(method).toHaveValue(/\+\s*\{abstract\}\s*play\(\): void/);
  await method.fill('+{abstract} takeTurn(): void');
  await method.press('Enter');

  await expect(sourceInput(page)).toHaveValue(/abstract class Player/);
  await expect(sourceInput(page)).toHaveValue(/-\s*\{static\}\s*count: long/);
  await expect(sourceInput(page)).toHaveValue(/\+\s*\{abstract\}\s*takeTurn\(\): void/);
  await expect(preview(page).getByText(/count:\s*long$/)).toBeVisible();
  await expect(preview(page).getByText(/takeTurn\(\):\s*void$/)).toBeVisible();
});

test('double-clicking the second identical signature edits that occurrence and preserves its static modifier', async ({ page }) => {
  const original = '@startuml\nclass Player { +get(): int; +{static} get(): int }\n@enduml';
  await openDiagram(page, original);
  const edit = await doubleClickMember(page, 'Player', /^\+\s*get\(\):\s*int$/, 1);
  await expect(edit).toHaveValue(/^\+\s*\{static\}\s*get\(\):\s*int$/);
  await edit.fill('+{static} getShared(): int');
  await edit.press('Enter');

  await expect(sourceInput(page)).toHaveValue(/\+\s*get\(\): int;\s*\+\s*\{static\}\s*getShared\(\): int/);
  await expect(preview(page).getByText(/^\+\s*get\(\):\s*int$/)).toHaveCount(1);
  await expect(preview(page).getByText(/^\+\s*getShared\(\):\s*int$/)).toBeVisible();
  await page.getByRole('button', { name: /Undo$/ }).click();
  await expect(sourceInput(page)).toHaveValue(original);
});

test('overlapping class bodies do not make a member edit target another class or rename the class', async ({ page }) => {
  const original = [
    '@startuml',
    'class Background @pos(100, 100) { -balance: int; +get(): int }',
    'class Foreground @pos(100, 130) { -balance: int; +get(): int }',
    '@enduml',
  ].join('\n');
  await openDiagram(page, original);
  // Both get() rows lie inside Foreground's bounds. Its own visible row is
  // lower; the upper row belongs to the class behind it and must not affect
  // member matching. @pos uses the same authored layout as the alignment tests.
  const edit = await doubleClickMember(page, 'Foreground', /^\+\s*get\(\):\s*int$/, 1);
  await expect(edit).toHaveValue(/^\+\s*get\(\):\s*int$/);
  await edit.fill('+getTotal(): long');
  await edit.press('Enter');

  await expect(sourceInput(page)).toHaveValue(/^class Background @pos\(100, 100\) \{ -balance: int; \+get\(\): int \}$/m);
  await expect(sourceInput(page)).toHaveValue(/class Foreground @pos\(100, 130\)\s*\{\s*-\s*balance: int;\s*\+\s*getTotal\(\): long\s*\}/);
  await expect(preview(page).getByText('Foreground', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Undo$/ }).click();
  await expect(sourceInput(page)).toHaveValue(original);
});

test('cancelling or submitting a blank member edit restores the original visible row and source', async ({ page }) => {
  const original = '@startuml\nclass Player { -balance: int; +play(): void }\n@enduml';
  await openDiagram(page, original);
  const attribute = await doubleClickMember(page, 'Player', /^-\s*balance:\s*int$/);
  await attribute.fill('-discarded: int');
  await attribute.press('Escape');
  await expect(memberEditor(page)).toHaveCount(0);
  await expect(sourceInput(page)).toHaveValue(original);
  await expect(preview(page).getByText(/^-\s*balance:\s*int$/)).toBeVisible();
  await expect(preview(page).getByText(/discarded/)).toHaveCount(0);

  const method = await doubleClickMember(page, 'Player', /^\+\s*play\(\):\s*void$/);
  await method.fill('   ');
  await method.press('Enter');
  await expect(memberEditor(page)).toHaveCount(0);
  await expect(sourceInput(page)).toHaveValue(original);
  await expect(preview(page).getByText(/^\+\s*play\(\):\s*void$/)).toBeVisible();
});

test('right-click member additions target that class rather than the previously selected class', async ({ page }) => {
  const original = '@startuml\nclass Player\nclass Bank\nPlayer --> Bank: uses\n@enduml';
  await openDiagram(page, original);
  await classTarget(page, 'Player').press('Enter');
  await openClassMenu(page, 'Bank');
  await page.getByRole('menuitem', { name: 'Add attribute', exact: true }).click();
  await expect(page.getByRole('menu')).toHaveCount(0);
  const attribute = page.getByRole('textbox', { name: 'Attribute signature', exact: true });
  await expect(attribute).toBeFocused();
  await attribute.fill('-balance: int');
  await attribute.press('Enter');
  const afterAttribute = await sourceInput(page).inputValue();

  await openClassMenu(page, 'Bank');
  await page.getByRole('menuitem', { name: 'Add method', exact: true }).click();
  await page.getByRole('textbox', { name: 'Method signature', exact: true }).fill('+deposit(amount: int): void');
  await memberForm(page).getByRole('button', { name: 'Add', exact: true }).click();
  await expect(sourceInput(page)).toHaveValue(/^class Player$/m);
  await expect(sourceInput(page)).toHaveValue(/class Bank\s*\{\s*-\s*balance: int;\s*\+\s*deposit\(amount: int\): void\s*\}/);
  await expect(sourceInput(page)).toHaveValue(/^Player --> Bank: uses$/m);
  await page.getByRole('button', { name: /Undo$/ }).click();
  await expect(sourceInput(page)).toHaveValue(afterAttribute);
  await page.getByRole('button', { name: /Undo$/ }).click();
  await expect(sourceInput(page)).toHaveValue(original);
});

test('a class context-menu addition can be cancelled without changing its members', async ({ page }) => {
  const original = '@startuml\nclass Player { +play(): void }\n@enduml';
  await openDiagram(page, original);
  await openClassMenu(page, 'Player');
  await page.getByRole('menuitem', { name: 'Add attribute', exact: true }).click();
  await page.getByRole('textbox', { name: 'Attribute signature', exact: true }).fill('-discarded: int');
  await memberForm(page).getByRole('button', { name: 'Cancel', exact: true }).click();

  await expect(memberForm(page)).toBeHidden();
  await expect(sourceInput(page)).toHaveValue(original);
  await expect(page.getByRole('region', { name: 'Class editing', exact: true })
    .getByRole('button', { name: 'Add attribute', exact: true })).toBeFocused();
});

for (const theme of ['light', 'dark']) {
  test(`class context-menu member entry works with the keyboard in narrow fullscreen ${theme} mode`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width: 320, height: 844 });
    await openDiagram(page, '@startuml\nclass Player\n@enduml');
    await page.evaluate(theme => document.documentElement.classList.toggle('dark-mode', theme === 'dark'), theme);
    await page.getByRole('button', { name: '⛶ Full screen', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Exit full screen', exact: true })).toBeVisible();
    await classTarget(page, 'Player').press('Enter');
    await expect(page.getByRole('region', { name: 'Class editing', exact: true })).toContainText('Selected: Player');
    await openClassMenu(page, 'Player');
    const addMethod = page.getByRole('menuitem', { name: 'Add method', exact: true });
    await expect(addMethod).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: test.info().outputPath(`class-context-menu-${theme}.png`) });
    await a11yCheckpoint(page, `class context menu in ${theme} narrow fullscreen`, {
      include: '[role="menu"]', darkMode: false,
    });
    const items = page.getByRole('menu').getByRole('menuitem');
    await expect(items.first()).toBeFocused();
    const methodIndex = (await items.allTextContents()).findIndex(text => text.trim() === 'Add method');
    expect(methodIndex, 'the class menu includes a method addition').toBeGreaterThanOrEqual(0);
    for (let index = 0; index < methodIndex; index++) await page.keyboard.press('ArrowDown');
    await expect(addMethod).toBeFocused();
    await page.keyboard.press('Enter');
    const signature = page.getByRole('textbox', { name: 'Method signature', exact: true });
    await expect(signature).toBeFocused();
    await expect(signature).toBeInViewport({ ratio: 1 });
    await signature.fill('+roll(): int');
    await page.keyboard.press('Tab');
    await expect(memberForm(page).getByRole('button', { name: 'Add', exact: true })).toBeFocused();
    await page.screenshot({ path: test.info().outputPath(`class-context-member-form-${theme}.png`) });
    await a11yCheckpoint(page, `context-menu class member entry in ${theme} narrow fullscreen`, {
      include: '[aria-label="Class editing"]', darkMode: false,
    });
    await page.keyboard.press('Enter');

    await expect(sourceInput(page)).toHaveValue(/\+\s*roll\(\): int/);
    await expect(memberForm(page)).toBeHidden();
    await expect(preview(page).getByText(/^\+\s*roll\(\):\s*int$/)).toBeVisible();
    await openClassMenu(page, 'Player');
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByRole('menu', { includeHidden: true })).toBeHidden();
    await page.emulateMedia({ media: 'screen' });
    await expect(page.getByRole('menu')).toBeVisible();
    expect(errors, 'class context-menu additions must not cause JavaScript errors').toEqual([]);
  });
}
