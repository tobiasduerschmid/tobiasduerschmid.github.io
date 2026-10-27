const { test, expect } = require('@playwright/test');
const diagrams = require('./fixtures/monopoly-uml');
const { a11yCheckpoint } = require('./a11y-helpers');
const url = '/SEBook/designpatterns/monopoly-state-pattern-uml-homework';

async function prepareStep(page, type, source, saved = diagrams) {
  await page.goto(url);
  // Seed prior learner drafts at the persistence boundary; exercise grading via UI.
  await page.evaluate(saved => {
    for (const [type, source] of Object.entries(saved)) localStorage.setItem('uml-pg-autosave-monopoly-state-pattern-uml-' + type, source);
  }, saved);
  if (type !== 'class') await page.getByRole('button', { name: 'Next →', exact: true }).click();
  if (type === 'sequence') await page.getByRole('button', { name: 'Next →', exact: true }).click();
  // The homework hides the optional source pane; this only supplies the draft,
  // as an import would. No grading or progression internals are replaced.
  await page.getByLabel('ArchUML diagram source').evaluate((input, source) => {
    input.value = source; input.dispatchEvent(new Event('input', { bubbles: true }));
  }, source);
  // Switching away from a blank earlier editor can save it; restore the explicit
  // prior-diagram fixture before exercising the consistency check.
  await page.evaluate(({saved,type}) => {
    for (const [name,source] of Object.entries(saved)) if (name !== type) localStorage.setItem('uml-pg-autosave-monopoly-state-pattern-uml-' + name, source);
  }, {saved,type});
}
async function checkWork(page) {
  await page.getByRole('button', { name: /Test My Work/ }).click();
}
async function expectFailure(page, description) {
  await expect(page.getByRole('listitem').filter({ has: page.getByText(description, { exact: true }) })).toContainText('✗');
}

for (const theme of ['light', 'dark']) {
  test(`empty class diagram results retain criteria without revealing assertion diagnostics in ${theme} mode`, async ({ page }) => {
    await prepareStep(page, 'class', '@startuml\n@enduml');
    await page.evaluate(theme => document.documentElement.classList.toggle('dark-mode', theme === 'dark'), theme);
    await checkWork(page);
    const descriptions = [
      'State-pattern classes are present',
      'Operations support the later sequence diagram',
      'Player owns or aggregates its current state',
      'Concrete states implement the state abstraction',
      'Concrete states implement abstract operations',
    ];
    for (const description of descriptions) {
      const criterion = page.getByRole('listitem').filter({ has: page.getByText(description, { exact: true }) });
      await expect(criterion).toBeVisible();
      await expect(criterion).toHaveText(new RegExp('^\\s*[✓✗]\\s*' + description + '\\s*$'));
    }
    await expectFailure(page, 'State-pattern classes are present');
    await expect(page.getByText('Expected matching "class" "Player".', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Hints', exact: true })).toHaveCount(0);
    await a11yCheckpoint(page, `uml-homework-criterion-results-${theme}`);
  });

  test(`a partial class diagram keeps applicable hints collapsed until requested in ${theme} mode`, async ({ page }) => {
    const source = diagrams.class.replace('setState(state: PlayerState)', 'setState(state: NormalState)');
    await prepareStep(page, 'class', source);
    await page.evaluate(theme => document.documentElement.classList.toggle('dark-mode', theme === 'dark'), theme);
    await checkWork(page);
    await expectFailure(page, 'Operations support the later sequence diagram');
    const disclosure = page.getByRole('button', { name: 'Hints', exact: true });
    const hint = page.getByText(/The state abstraction and Player should share the turn operation name/);
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    await expect(hint).toBeHidden();
    await disclosure.click();
    await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    await expect(hint).toBeVisible();
    await a11yCheckpoint(page, `uml-homework-expanded-hints-${theme}`);
    await disclosure.click();
    await expect(hint).toBeHidden();
  });
}

test('accepts a renamed abstraction with inherited state implementations', async ({ page }) => {
  const source = diagrams.class.replaceAll('PlayerState', 'TurnBehavior').replaceAll('..|> TurnBehavior', '--|> SharedState').replace('@enduml', 'abstract class SharedState\nSharedState ..|> TurnBehavior\n@enduml');
  await prepareStep(page, 'class', source);
  await checkWork(page);
  await expect(page.getByText('All 5 tests passed!', { exact: false })).toBeVisible();
});

test('rejects one class substituted for the three concrete behaviors', async ({ page }) => {
  const source = diagrams.class.replace(/class (NormalState|JailState|BankruptState).*\n/g, '').replace(/(NormalState|JailState|BankruptState) \.\.\|> PlayerState\n/g, '').replace('@enduml', 'class NormalJailBankruptState { +takeTurn(player: Player): void; }\nNormalJailBankruptState ..|> PlayerState\n@enduml');
  await prepareStep(page, 'class', source);
  await checkWork(page);
  await expectFailure(page, 'State-pattern classes are present');
});

for (const type of ['state', 'sequence']) test(type + ' note text cannot satisfy behavior checks', async ({ page }) => {
  const source = type === 'state'
    ? diagrams.state.replace('NormalState --> JailState', 'note right of NormalState\nNormalState --> JailState').replace('@enduml', 'end note\n@enduml')
    : diagrams.sequence.replace('player -> normal', 'note over player\nplayer -> normal').replace('@enduml', 'end note\n@enduml');
  await prepareStep(page, type, source);
  await checkWork(page);
  await expectFailure(page, type === 'state' ? 'Required transitions exist and every transition is labeled' : 'Player calls two state types and changes state on a coherent path');
});

test('accepts a coherent alternative with leftward calls', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const source = diagrams.sequence.replace('player -> normal', 'alt enter jail\nnormal <- player').replace('normal -> player', 'player <- normal').replace('player -> jail', 'jail <- player').replace('@enduml', 'else stay normal\nnormal <- player: takeTurn(player)\nend\n@enduml');
  await prepareStep(page, 'sequence', source);
  await checkWork(page);
  await expect(page.getByText('All 5 tests passed!', { exact: false })).toBeVisible();
  await a11yCheckpoint(page, 'uml-homework-coherent-alternative');
  expect(errors).toEqual([]);
});

test('a missing sequence transition fails its criterion without revealing the assertion diagnostic', async ({ page }) => {
  await prepareStep(page, 'sequence', diagrams.sequence, { ...diagrams, state: diagrams.state.replace('NormalState --> JailState : third double\n', '') });
  await checkWork(page);
  await expectFailure(page, 'State-change call passes the next state object');
  const criterion = page.getByRole('listitem').filter({ has: page.getByText('State-change call passes the next state object', { exact: true }) });
  await expect(criterion).toHaveText(/^\s*✗\s*State-change call passes the next state object\s*$/);
  await expect(page.getByText('The state diagram needs the illustrated transition from NormalState to JailState.', { exact: true })).toHaveCount(0);
  await a11yCheckpoint(page, 'uml-homework-inconsistent-transition');
});

test('responses cannot replace method invocations', async ({ page }) => {
  await prepareStep(page, 'sequence', diagrams.sequence.replaceAll(' -> ', ' --> '));
  await checkWork(page);
  await expectFailure(page, 'Player calls two state types and changes state on a coherent path');
});

test('print instructions expose the same naming and lifecycle requirements', async ({ page }) => {
  await page.goto(url + '/print');
  await expect(page.getByText(/three distinct concrete states/)).toBeVisible();
  await expect(page.getByText(/Include normal→jail, jail→normal, and normal→bankruptcy/)).toBeVisible();
  await expect(page.getByText(/at least one coherent path/)).toBeVisible();
});
