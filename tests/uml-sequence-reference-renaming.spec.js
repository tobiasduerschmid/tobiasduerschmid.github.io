const { test, expect } = require('@playwright/test');
const diagrams = require('./fixtures/monopoly-uml');

const source = page => page.getByLabel('ArchUML diagram source', { exact: true });

async function openSequence(page, sequence = diagrams.sequence) {
  await page.addInitScript(drafts => {
    for (const [type, text] of Object.entries(drafts)) {
      localStorage.setItem(`uml-pg-autosave-monopoly-state-pattern-uml-${type}`, text);
    }
  }, { ...diagrams, sequence });
  await page.goto('/SEBook/designpatterns/monopoly-state-pattern-uml-homework');
  await page.getByRole('button', { name: 'Next →', exact: true }).click();
  await page.getByRole('button', { name: 'Next →', exact: true }).click();
  await expect(source(page)).toHaveValue(sequence);
}

async function renameJail(page, interaction) {
  if (interaction === 'advanced rows') {
    await page.getByText(/^Advanced sequence rows/).click();
    const identifier = page.getByRole('textbox', { name: 'Lifeline 3 identifier', exact: true });
    await identifier.fill('prison');
    await identifier.press('Tab');
    return;
  }
  const lifeline = page.getByRole('button', { name: /^Element jail(?::| —)/ });
  if (interaction === 'properties') {
    await lifeline.focus();
    await lifeline.press('Enter');
    const identifier = page.getByRole('textbox', { name: 'Identifier', exact: true });
    await identifier.fill('prison');
    await identifier.press('Tab');
    return;
  }
  // The pointer hitbox and the keyboard target cover the same visible head.
  await lifeline.scrollIntoViewIfNeeded();
  const bounds = await lifeline.boundingBox();
  await page.mouse.dblclick(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  const inlineName = page.getByRole('textbox', { name: /^Rename jail/ });
  await inlineName.fill('prison: JailState');
  await inlineName.press('Enter');
}

for (const interaction of ['advanced rows', 'properties', 'inline name']) {
  test(`renaming a state lifeline through ${interaction} preserves the passing interaction`, async ({ page }) => {
    await openSequence(page);
    await renameJail(page, interaction);

    await expect(source(page)).toHaveValue(/^participant prison: JailState$/m);
    await page.getByRole('button', { name: /Test My Work/ }).click();
    await expect(page.getByText('All 5 tests passed!', { exact: false })).toBeVisible();
    await expect(source(page)).toHaveValue(/^normal -> player: setState\(prison\)$/m);
    await expect(source(page)).toHaveValue(/^player -> prison: takeTurn\(player\)$/m);
  });
}

test('renaming a lifeline updates argument references while preserving strings, methods, and prose', async ({ page }) => {
  const message = String.raw`normal -> player: jail(jail, "jail", 'jail', "escaped \"jail\"", jailer, box.jail, jail(jail))`;
  const note = 'note over jail: jail(jail) is a message example';
  const draft = diagrams.sequence.replace('@enduml', `${message}\n${note}\n@enduml`);
  await openSequence(page, draft);
  await renameJail(page, 'advanced rows');

  const renamed = await source(page).inputValue();
  expect(renamed).toContain(String.raw`normal -> player: jail(prison, "jail", 'jail', "escaped \"jail\"", jailer, box.jail, jail(prison))`);
  expect(renamed).toContain('note over prison: jail(jail) is a message example');
});
