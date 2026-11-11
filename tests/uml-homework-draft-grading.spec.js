const { test, expect } = require('@playwright/test');
const diagrams = require('./fixtures/monopoly-uml');
const { a11yCheckpoint } = require('./a11y-helpers');

const url = '/SEBook/designpatterns/monopoly-state-pattern-uml-homework';
const prefix = 'uml-pg-autosave-monopoly-state-pattern-uml-';

// Homework deliberately hides its source field. Supply a draft at the input
// boundary, then exercise actual navigation, persistence, and grading controls.
async function supplyDraft(page, source) {
  await page.getByLabel('ArchUML diagram source').evaluate((input, value) => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, source);
}

test('sequence checks accept lifeline declarations placed after their first message', async ({ page }) => {
  const lines = diagrams.sequence.split('\n');
  const declarations = lines.filter(line => line.startsWith('participant '));
  const source = lines.filter(line => !line.startsWith('participant ')).join('\n')
    .replace('@enduml', declarations.join('\n') + '\n@enduml');
  await page.addInitScript(({ diagrams, prefix }) => {
    for (const [type, source] of Object.entries(diagrams)) localStorage.setItem(prefix + type, source);
  }, { diagrams, prefix });
  await page.goto(url);
  await expect(page.getByLabel('ArchUML diagram source')).toHaveValue(diagrams.class);
  await page.getByRole('button', { name: 'Next →', exact: true }).click();
  await page.getByRole('button', { name: 'Next →', exact: true }).click();
  await supplyDraft(page, source);

  await page.getByRole('button', { name: /Test My Work/ }).click();

  await expect(page.getByText('All 5 tests passed!', { exact: false })).toBeVisible();
});

for (const storageFailure of ['QuotaExceededError', 'SecurityError']) {
  test(`checks use retained session drafts when autosave raises ${storageFailure}`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(({ diagrams, prefix }) => {
      for (const [type, source] of Object.entries(diagrams)) {
        localStorage.setItem(prefix + type, source);
      }
    }, { diagrams, prefix });
    await page.goto(url);
    await expect(page.getByLabel('ArchUML diagram source')).toHaveValue(diagrams.class);
    // Only the platform storage boundary fails. All editing and checking code
    // remains real, and stale saved operations cannot satisfy the new calls.
    await page.evaluate(({ prefix, storageFailure }) => {
      const setItem = Storage.prototype.setItem;
      const getItem = Storage.prototype.getItem;
      Storage.prototype.setItem = function (key, value) {
        if (key.startsWith(prefix)) throw new DOMException('Storage unavailable', storageFailure);
        return setItem.call(this, key, value);
      };
      if (storageFailure === 'SecurityError') {
        Storage.prototype.getItem = function (key) {
          if (key.startsWith(prefix)) throw new DOMException('Storage unavailable', storageFailure);
          return getItem.call(this, key);
        };
      }
    }, { prefix, storageFailure });
    const editedDiagrams = Object.fromEntries(Object.entries(diagrams).map(([type, source]) => [
      type, source.replaceAll('takeTurn', 'advanceTurn').replaceAll('JailState', 'PrisonState')
    ]));
    await supplyDraft(page, editedDiagrams.class);
    await page.getByRole('button', { name: 'Next →', exact: true }).click();
    await supplyDraft(page, editedDiagrams.state);
    await page.getByRole('button', { name: 'Next →', exact: true }).click();
    await supplyDraft(page, editedDiagrams.sequence);

    await page.getByRole('button', { name: /Test My Work/ }).click();

    await expect(page.getByText('All 5 tests passed!', { exact: false })).toBeVisible();
    await a11yCheckpoint(page, `uml-homework-retained-drafts-${storageFailure}`);
    expect(errors).toEqual([]);
  });
}
