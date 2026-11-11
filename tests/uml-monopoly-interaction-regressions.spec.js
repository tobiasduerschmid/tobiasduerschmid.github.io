const { test, expect } = require('@playwright/test');
const diagrams = require('./fixtures/monopoly-uml');
const { a11yCheckpoint } = require('./a11y-helpers');

const homeworkUrl = '/SEBook/designpatterns/monopoly-state-pattern-uml-homework';
const source = page => page.getByLabel('ArchUML diagram source', { exact: true });
const lifelineId = page => page.getByRole('textbox', { name: 'Lifeline 1 identifier', exact: true });
const lifelineLabel = page => page.getByRole('textbox', { name: 'Lifeline 1 display label', exact: true });
const pageErrors = new WeakMap();

test.beforeEach(async ({ page }) => {
  const errors = [];
  pageErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page), 'editing and saving must not raise browser errors').toEqual([]);
});

async function openHomework(page, saved = diagrams) {
  // Seed once so a later reload exercises the real persisted draft.
  await page.addInitScript(saved => {
    for (const [type, text] of Object.entries(saved)) {
      const key = `uml-pg-autosave-monopoly-state-pattern-uml-${type}`;
      if (localStorage.getItem(key) === null) localStorage.setItem(key, text);
    }
  }, saved);
  await page.goto(homeworkUrl);
}

async function openSequenceHomework(page, sequence = diagrams.sequence) {
  await openHomework(page, { ...diagrams, sequence });
  await goToSequence(page);
  await expect(source(page)).toHaveValue(sequence);
  await page.getByText(/^Advanced sequence rows/).click();
}

async function goToSequence(page) {
  await page.getByRole('button', { name: 'Next →', exact: true }).click();
  await page.getByRole('button', { name: 'Next →', exact: true }).click();
}

async function openInlineLifelineName(page) {
  // Pointer hitboxes overlay the keyboard target at the same coordinates.
  const target = page.getByRole('button', { name: /^Element player(?::| —)/ });
  await target.scrollIntoViewIfNeeded();
  const bounds = await target.boundingBox();
  await page.mouse.dblclick(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  return page.getByRole('textbox', { name: /^Rename player/ });
}

test('Tab between lifeline fields preserves focus and keeps advanced rows open', async ({ page }) => {
  await openSequenceHomework(page);
  await lifelineId(page).fill('currentPlayer');
  await lifelineId(page).press('Tab');

  await expect(source(page)).toHaveValue(/participant currentPlayer: Player/);
  await expect(lifelineLabel(page)).toBeFocused();
  await lifelineLabel(page).fill('ActivePlayer');
  await lifelineLabel(page).press('Tab');
  await expect(page.getByRole('button', { name: 'Delete lifeline currentPlayer', exact: true })).toBeFocused();
  await expect(source(page)).toHaveValue(/participant currentPlayer: ActivePlayer/);
  await expect(source(page)).toHaveValue(/currentPlayer -> normal: takeTurn\(currentPlayer\)/);
  await a11yCheckpoint(page, 'Monopoly sequence advanced rows', { include: '#uml-pg-sequence-model' });
});

test('clicking an adjacent lifeline field commits the edit without losing the click', async ({ page }) => {
  await openSequenceHomework(page);
  await lifelineId(page).fill('currentPlayer');
  await lifelineLabel(page).click();

  await expect(source(page)).toHaveValue(/participant currentPlayer: Player/);
  await expect(lifelineLabel(page)).toBeFocused();
  await expect(lifelineLabel(page)).toHaveValue('Player');
});

test('a refreshed timeline field can be deliberately changed back to its original text', async ({ page }) => {
  await openSequenceHomework(page);
  const message = page.getByRole('textbox', { name: 'Sync message source line 1', exact: true });
  const originalMessage = 'player -> normal: takeTurn(player)';
  await expect(message).toHaveValue(originalMessage);
  await lifelineId(page).fill('currentPlayer');
  await message.click();
  await expect(message).toHaveValue('currentPlayer -> normal: takeTurn(currentPlayer)');
  await message.fill(originalMessage);
  await message.press('Tab');

  await expect(source(page)).toHaveValue(/^player -> normal: takeTurn\(player\)$/m);
  await expect(source(page)).toHaveValue(/^participant currentPlayer: Player$/m);
  await expect(source(page)).toHaveValue(/^normal -> currentPlayer: setState\(jail\)$/m);
});

test('Tab through lifeline properties retains focus and applies both edits to the renamed lifeline', async ({ page }) => {
  await openSequenceHomework(page);
  const player = page.getByRole('button', { name: /^Element player(?::| —)/ });
  await player.focus();
  await player.press('Enter');
  const identifier = page.getByRole('textbox', { name: 'Identifier', exact: true });
  const displayLabel = page.getByRole('textbox', { name: 'Display label', exact: true });
  await identifier.fill('currentPlayer');
  await identifier.press('Tab');

  await expect(source(page)).toHaveValue(/participant currentPlayer: Player/);
  await expect(identifier).toHaveValue('currentPlayer');
  await expect(displayLabel).toBeFocused();
  await displayLabel.fill('ActivePlayer');
  await displayLabel.press('Tab');
  await expect(page.getByRole('textbox', { name: 'Highlight color (#hex or name)', exact: true })).toBeFocused();
  await expect(source(page)).toHaveValue(/participant currentPlayer: ActivePlayer/);
  await expect(source(page)).toHaveValue(/currentPlayer -> normal: takeTurn\(currentPlayer\)/);
  await expect(source(page)).not.toHaveValue(/participant player:/);
  await a11yCheckpoint(page, 'Monopoly lifeline properties', { include: '#uml-pg-props-pane' });
});

test('a committed lifeline edit survives reload before the autosave delay', async ({ page }) => {
  await openSequenceHomework(page);
  const now = new Date('2026-11-10T12:00:00Z');
  await page.clock.install({ time: now });
  await page.clock.pauseAt(now);
  await lifelineLabel(page).fill('ActivePlayer');
  await lifelineLabel(page).press('Tab');
  await expect(source(page)).toHaveValue(/participant player: ActivePlayer/);

  await page.reload();
  await page.clock.resume();
  await goToSequence(page);
  await expect(source(page)).toHaveValue(/participant player: ActivePlayer/);
  await expect(source(page)).toHaveValue(/player -> normal: takeTurn\(player\)/);
});

test('reloading with a focused lifeline field preserves the text being edited', async ({ page }) => {
  await openSequenceHomework(page);
  await lifelineLabel(page).fill('ActivePlayer');
  await expect(lifelineLabel(page)).toBeFocused();

  await page.reload();
  await goToSequence(page);
  await expect(source(page)).toHaveValue(/participant player: ActivePlayer/);
});

test('reloading during an inline lifeline rename preserves the unfinished edit', async ({ page }) => {
  await openSequenceHomework(page);
  const name = await openInlineLifelineName(page);
  await name.fill('currentPlayer: Player');
  await expect(name).toBeFocused();

  await page.reload();
  await goToSequence(page);
  await expect(source(page)).toHaveValue(/participant currentPlayer: Player/);
  await expect(source(page)).toHaveValue(/currentPlayer -> normal: takeTurn\(currentPlayer\)/);
});

const styledSequence = diagrams.sequence.replace('participant player: Player',
  'participant player: Player #lightblue hatched @pos(40, 100)');

for (const method of ['advanced row', 'inline head']) {
  test(`renaming a lifeline through its ${method} retains its type, appearance, and saved position`, async ({ page }) => {
    await openSequenceHomework(page, styledSequence);
    if (method === 'advanced row') {
      await lifelineId(page).fill('currentPlayer');
      await lifelineId(page).press('Tab');
    } else {
      const name = await openInlineLifelineName(page);
      await name.fill('currentPlayer: Player');
      await name.press('Enter');
    }

    await expect(source(page)).toHaveValue(/participant currentPlayer: Player.*#lightblue.*hatched/);
    const positions = await source(page).evaluate(input => window.UMLShared.extractLayoutMetadata(input.value).layout.positions);
    expect(positions.currentPlayer).toEqual({ x: 40, y: 100 });
    const renamed = page.getByRole('button', { name: /^Element currentPlayer(?::| —)/ });
    await renamed.focus();
    await renamed.press('Enter');
    await expect(page.getByRole('textbox', { name: 'Highlight color (#hex or name)', exact: true })).toHaveValue('lightblue');
    await expect(page.getByRole('combobox', { name: 'Texture', exact: true })).toHaveValue('hatched');
  });
}

test('editing a multiline timeline row keeps later row edits attached to the correct event', async ({ page }) => {
  const sequence = '@startuml\nparticipant player: Player\nparticipant normal: NormalState\nnote over player: initial note\nplayer -> normal: takeTurn(player)\n@enduml';
  await openSequenceHomework(page, sequence);
  const note = page.getByRole('textbox', { name: 'Note source line 1', exact: true });
  const message = page.getByRole('textbox', { name: 'Sync message source line 2', exact: true });
  await note.fill('note over player\nfirst explanation\nsecond explanation\nend note');
  await message.click();
  await expect(message).toBeFocused();
  await message.fill('player -> normal: continueTurn(player)');
  await message.press('Tab');

  await expect(source(page)).toHaveValue('@startuml\nparticipant player: Player\nparticipant normal: NormalState\nnote over player\nfirst explanation\nsecond explanation\nend note\nplayer -> normal: continueTurn(player)\n@enduml');
});

test('clicking Delete while renaming a lifeline removes the renamed lifeline and remains undoable', async ({ page }) => {
  await openSequenceHomework(page);
  await lifelineId(page).fill('currentPlayer');
  await page.getByRole('button', { name: 'Delete lifeline player', exact: true }).click();

  await expect(source(page)).not.toHaveValue(/participant (?:player|currentPlayer):/);
  await expect(source(page)).not.toHaveValue(/currentPlayer\s*->|->\s*currentPlayer/);
  await expect(source(page)).toHaveValue(/participant normal: NormalState/);
  await expect(source(page)).toHaveValue(/participant jail: JailState/);
  await page.getByRole('button', { name: /Undo$/ }).click();
  await expect(source(page)).toHaveValue(/participant currentPlayer: Player/);
  await expect(source(page)).toHaveValue(/currentPlayer -> normal: takeTurn\(currentPlayer\)/);
});

test('an emptied timeline row can be filled again without replacing its following event', async ({ page }) => {
  const sequence = '@startuml\nparticipant player: Player\nparticipant normal: NormalState\nplayer -> normal: takeTurn(player)\nnormal -> player: finish()\n@enduml';
  await openSequenceHomework(page, sequence);
  const first = page.getByRole('textbox', { name: 'Sync message source line 1', exact: true });
  await first.fill('');
  await first.press('Tab');
  await expect(source(page)).not.toHaveValue(/takeTurn\(player\)/);
  await page.keyboard.press('Shift+Tab');
  await expect(first).toBeFocused();
  await first.fill('player -> normal: resumeTurn(player)');
  await first.press('Tab');

  await expect(source(page)).toHaveValue(sequence.replace('takeTurn(player)', 'resumeTurn(player)'));
});

test('refilling two empty timeline rows in reverse order preserves their displayed order', async ({ page }) => {
  const sequence = '@startuml\nparticipant player: Player\nparticipant normal: NormalState\nplayer -> normal: takeTurn(player)\nnormal -> player: finish()\n@enduml';
  await openSequenceHomework(page, sequence);
  const first = page.getByRole('textbox', { name: 'Sync message source line 1', exact: true });
  const second = page.getByRole('textbox', { name: 'Sync message source line 2', exact: true });
  await first.fill('');
  await first.press('Tab');
  await second.fill('');
  await second.press('Tab');
  await second.fill('normal -> player: resumeFinish()');
  await second.press('Tab');
  await first.fill('player -> normal: resumeTurn(player)');
  await first.press('Tab');

  await expect(source(page)).toHaveValue(sequence.replace('takeTurn(player)', 'resumeTurn(player)').replace('finish()', 'resumeFinish()'));
});

test('advanced lifeline edits preserve the class name of an alias declaration', async ({ page }) => {
  await openSequenceHomework(page, diagrams.sequence.replace('participant player: Player', 'participant player as Player'));
  await expect(lifelineId(page)).toHaveValue('player');
  await expect(lifelineLabel(page)).toHaveValue('Player');
  await lifelineId(page).fill('currentPlayer');
  await lifelineId(page).press('Tab');
  await expect(source(page)).toHaveValue(/participant currentPlayer: Player/);
  await lifelineLabel(page).fill('ActivePlayer');
  await lifelineLabel(page).press('Tab');

  await expect(source(page)).toHaveValue(/participant currentPlayer: ActivePlayer/);
  await expect(source(page)).toHaveValue(/currentPlayer -> normal: takeTurn\(currentPlayer\)/);
  await expect(source(page)).not.toHaveValue(/participant player:/);
});

test('inline editing a lifeline declared after its messages starts with the full instance and class name', async ({ page }) => {
  const sequence = '@startuml\nplayer -> normal: takeTurn(player)\nparticipant player: Player\nparticipant normal: NormalState\n@enduml';
  await openSequenceHomework(page, sequence);
  const name = await openInlineLifelineName(page);
  await expect(name).toHaveValue('player: Player');
  await name.fill('currentPlayer: Player');
  await name.press('Enter');

  await expect(source(page)).toHaveValue(/participant currentPlayer: Player/);
  await expect(source(page)).toHaveValue(/currentPlayer -> normal: takeTurn\(currentPlayer\)/);
  await expect(page.getByRole('button', { name: /^Element currentPlayer: Player —/ })).toBeVisible();
});

test('a theme rerender preserves the focused lifeline draft until it is committed', async ({ page }) => {
  await openSequenceHomework(page);
  const now = new Date('2026-11-10T12:00:00Z');
  await page.clock.install({ time: now });
  await page.clock.pauseAt(now);
  await lifelineLabel(page).fill('ActivePlayer');
  await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
  await page.clock.runFor(100);

  await expect(lifelineLabel(page)).toBeFocused();
  await expect(lifelineLabel(page)).toHaveValue('ActivePlayer');
  await lifelineLabel(page).press('Tab');
  await expect(source(page)).toHaveValue(/participant player: ActivePlayer/);
});

test('editing a class member then deleting it keeps focus and Undo restores the edited signature', async ({ page }) => {
  await openHomework(page);
  const player = page.getByRole('button', { name: 'Element Player — Enter to select, arrows to nudge, Delete to remove', exact: true });
  await player.focus();
  await player.press('Enter');
  const member = page.getByRole('textbox', { name: 'Member text (member 1)', exact: true });
  await member.fill('takeTurn(dice: Dice)');
  await member.press('Tab');
  const remove = page.getByRole('button', { name: 'Delete member 1', exact: true });
  await expect(remove).toBeFocused();
  await expect(source(page)).toHaveValue(/takeTurn\(dice: Dice\)/);
  await remove.press('Enter');
  await expect(source(page)).not.toHaveValue(/takeTurn\(dice: Dice\)/);
  await expect(source(page)).toHaveValue(/setState\(state: PlayerState\)/);

  await page.getByRole('button', { name: /Undo$/ }).click();
  await expect(source(page)).toHaveValue(/takeTurn\(dice: Dice\)/);
  await expect(source(page)).toHaveValue(/setState\(state: PlayerState\)/);
});

test('renaming a class keeps updated self-references when the next member is edited', async ({ page }) => {
  await openHomework(page, { ...diagrams, class: '@startuml\nclass Player { +next: Player; +takeTurn(); }\n@enduml' });
  const player = page.getByRole('button', { name: 'Element Player — Enter to select, arrows to nudge, Delete to remove', exact: true });
  await player.focus();
  await player.press('Enter');
  const identifier = page.getByRole('textbox', { name: 'Name (id)', exact: true });
  await identifier.fill('Participant');
  await identifier.press('Tab');
  await expect(page.getByRole('combobox', { name: 'Kind', exact: true })).toBeFocused();
  const reference = page.getByRole('textbox', { name: 'Member text (member 1)', exact: true });
  await expect(source(page)).toHaveValue(/next: Participant/);
  await expect(reference).toHaveValue('next: Participant');
  const operation = page.getByRole('textbox', { name: 'Member text (member 2)', exact: true });
  await operation.fill('takeTurn(dice: Dice)');
  await operation.press('Tab');
  await expect(source(page)).toHaveValue(/class Participant/);
  await expect(source(page)).toHaveValue(/next: Participant/);
  await expect(source(page)).toHaveValue(/takeTurn\(dice: Dice\)/);
});
