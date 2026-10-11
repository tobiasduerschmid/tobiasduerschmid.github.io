const { test, expect } = require('@playwright/test');

const source = page => page.getByRole('textbox', { name: 'ArchUML diagram source', exact: true });
const element = (page, name) => page.getByRole('button', { name: `Element ${name} — Enter to select, arrows to nudge, Delete to remove`, exact: true });

async function open(page, type, text) {
  await page.addInitScript(({ type, text }) => localStorage.setItem('uml-pg-autosave-' + type, text), { type, text });
  await page.goto('/SEBook/tools/uml-playground.html');
  await page.getByLabel('Diagram type:', { exact: true }).selectOption(type);
  await page.getByRole('checkbox', { name: 'Visual edit', exact: true }).check();
  await expect(source(page)).toHaveValue(text);
}

async function select(target) { await target.focus(); await target.press('Enter'); }
async function edit(page, label, value) {
  const input = page.getByRole('textbox', { name: label, exact: true });
  await input.fill(value);
  await input.press('Enter');
}

test('keyboard palette activation creates another element on an existing canvas', async ({ page }) => {
  await open(page, 'class', '@startuml\nclass Existing\n@enduml');
  await page.getByRole('button', { name: 'Add element: Class', exact: true }).press('Enter');
  await expect(element(page, 'Class')).toBeVisible();
  await expect(element(page, 'Existing')).toBeVisible();
  await expect(source(page)).toHaveValue(/class Class/);
});

test('a class can be both ends of an association created through the keyboard', async ({ page }) => {
  await open(page, 'class', '@startuml\nclass Person\n@enduml');
  await page.getByRole('button', { name: 'Add relation: Association', exact: true }).click();
  await select(element(page, 'Person'));
  await select(element(page, 'Person'));
  await expect(source(page)).toHaveValue(/Person\s+-->\s+Person/);
  await expect(page.locator('.uml-pg-edge-hitbox')).not.toHaveCount(0);
});

for (const op of ['x--x', 'x-->', '<--x']) {
  test(`editing a label preserves independent association ends: ${op}`, async ({ page }) => {
    await open(page, 'class', `@startuml\nclass A\nclass B\nA ${op} B : before\n@enduml`);
    await select(page.locator('.uml-pg-edge-hitbox').first());
    await edit(page, 'Label', 'after');
    await expect(source(page)).toHaveValue(new RegExp(`A\\s+${op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+B\\s*: after`));
  });
}

test('each association end can be assigned its own navigability', async ({ page }) => {
  await open(page, 'class', '@startuml\nclass A\nclass B\nA -- B\n@enduml');
  await select(page.locator('.uml-pg-edge-hitbox').first());
  await page.getByLabel('Source navigability', { exact: true }).selectOption('nonnav');
  await page.getByLabel('Target navigability', { exact: true }).selectOption('navigable');
  await expect(source(page)).toHaveValue(/A x--> B/);
});

test('association type changes apply their direction while whole-part changes preserve it', async ({ page }) => {
  await open(page, 'class', '@startuml\nclass A\nclass B\nA -- B\n@enduml');
  await select(page.locator('.uml-pg-edge-hitbox').first());
  for (const [kind, op] of [['biassoc', '<-->'], ['compose', '*<-->'], ['aggregate', 'o<-->'], ['assoc', '-->'], ['plain', '--']]) {
    await page.getByLabel('Type', { exact: true }).selectOption(kind);
    expect(await source(page).inputValue()).toContain(`A ${op} B`);
  }
});

test('changing a fragment to par preserves and exposes its first operand guard', async ({ page }) => {
  await open(page, 'sequence', '@startuml\nparticipant A\nparticipant B\nalt [ready]\nA -> B: first\nelse [other]\nB -> A: second\nend\n@enduml');
  await select(page.getByRole('button', { name: /^Fragment .*Enter to select/ }).first());
  await page.getByLabel('Kind', { exact: true }).selectOption('par');
  await expect(page.getByRole('textbox', { name: 'Condition', exact: true })).toHaveValue('ready');
  await edit(page, 'Condition', 'available');
  await expect(source(page)).toHaveValue(/par \[available\]/);
  await expect(source(page)).toHaveValue(/else \[other\]/);
});

test('invalid fragment drafts retain every operand and show a diagnostic', async ({ page }) => {
  await open(page, 'sequence', '@startuml\nparticipant A\nparticipant B\nalt [ready]\nA -> B: first\nelse [other]\nB -> A: second\nend\n@enduml');
  await select(page.getByRole('button', { name: /^Fragment .*Enter to select/ }).first());
  await page.getByLabel('Kind', { exact: true }).selectOption('opt');
  await expect(source(page)).toHaveValue(/else \[other\]/);
  await expect(page.getByRole('region', { name: 'Draft diagnostics' })).toContainText(/opt.*one operand/i);
  await expect(page.locator('#uml-pg-output svg')).toBeVisible();
});

test('an actor display label never becomes its relationship identifier', async ({ page }) => {
  await open(page, 'usecase', '@startuml\nactor User\nusecase "Sign in" as Login\n@enduml');
  await select(element(page, 'User'));
  await edit(page, 'Display label', 'End User');
  await page.getByRole('button', { name: 'Add relation: Association', exact: true }).click();
  await select(element(page, 'End User'));
  await select(element(page, 'Sign in'));
  await expect(source(page)).toHaveValue(/User\s+--\s+Login/);
  await expect(page.locator('.uml-pg-edge-hitbox')).not.toHaveCount(0);
});

test('system membership can be changed without editing source text', async ({ page }) => {
  await open(page, 'usecase', '@startuml\nusecase "Sign in" as Login\nrectangle "System" { }\n@enduml');
  await select(element(page, 'System'));
  await page.getByRole('checkbox', { name: 'Include Sign in', exact: true }).check();
  await expect(source(page)).toHaveValue(/rectangle "System"\s*\{\s*Login\s*\}/);
  await expect.poll(() => page.evaluate(() => window.UMLUseCaseDiagram.parse(document.getElementById('uml-pg-input').value).systems[0].members)).toEqual(['Login']);
  await page.getByRole('checkbox', { name: 'Include Sign in', exact: true }).uncheck();
  await expect.poll(() => page.evaluate(() => window.UMLUseCaseDiagram.parse(document.getElementById('uml-pg-input').value).systems[0].members)).toEqual([]);
  await expect(element(page, 'Sign in')).toBeVisible();
});

test('deployment artifacts may be created without a deployment node', async ({ page }) => {
  await open(page, 'deployment', '@startuml\nnode Existing\n@enduml');
  await page.getByRole('button', { name: 'Add element: Artifact', exact: true }).press('Enter');
  await expect(element(page, 'Artifact')).toBeVisible();
  const text = await source(page).inputValue();
  expect(text).toMatch(/^artifact /m);
  expect(text.match(/^node /gm)).toHaveLength(1);
});

test('removing nested membership preserves the use case and its existing relationships', async ({ page }) => {
  await open(page, 'usecase', '@startuml\nactor User\nrectangle "System" {\nusecase "Sign in; securely" as Login\n}\nUser -- Login\n@enduml');
  await select(element(page, 'System'));
  await page.getByRole('checkbox', { name: 'Include Sign in; securely', exact: true }).uncheck();
  await expect(element(page, 'Sign in; securely')).toBeVisible();
  await expect(source(page)).toHaveValue(/User -- Login/);
  await expect.poll(() => page.evaluate(() => window.UMLUseCaseDiagram.parse(document.getElementById('uml-pg-input').value).systems[0].members)).toEqual([]);
});

test('changing a system display label retains its identity and members', async ({ page }) => {
  await open(page, 'usecase', '@startuml\nusecase "Sign in" as Login\nrectangle "My System" { Login }\n@enduml');
  await select(element(page, 'My System'));
  await edit(page, 'Display label', 'Account service');
  await expect(element(page, 'Account service')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Identifier', exact: true })).toHaveValue('My System');
  await expect(page.getByRole('checkbox', { name: 'Include Sign in', exact: true })).toBeChecked();
});

test('100 percent zoom preserves readable diagram scale in a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await open(page, 'class', '@startuml\nclass Readable {\n name: String\n operation()\n}\n@enduml');
  await expect(element(page, 'Readable')).toBeAttached();
  const scale = await page.locator('#uml-pg-output svg').evaluate(svg => svg.getScreenCTM().a);
  expect(scale).toBeGreaterThanOrEqual(0.99);
  expect(await page.locator('#uml-pg-output svg').evaluate(svg => {
    const paragraphSize = parseFloat(getComputedStyle(document.querySelector('main p')).fontSize);
    return Array.from(svg.querySelectorAll('text')).filter(label => label.textContent.trim()).flatMap(label => {
      const matrix = label.getScreenCTM();
      const size = parseFloat(getComputedStyle(label).fontSize) * Math.hypot(matrix.c, matrix.d);
      return size < paragraphSize - 0.1 ? [{ text: label.textContent, size, paragraphSize }] : [];
    });
  })).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
