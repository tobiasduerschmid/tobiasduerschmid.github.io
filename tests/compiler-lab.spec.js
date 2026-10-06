const { test, expect } = require('@playwright/test');
const { a11yCheckpoint, auditInteractiveState } = require('./a11y-helpers');
const { selectAllInMonaco } = require('./helpers/monaco-keyboard');

const chapterURL = '/SEBook/tools/compilers.html';
const tutorialURL = '/SEBook/tools/compilers-tutorial';

function lab(page, title) {
  return page.getByRole('region', { name: 'Compiler lab: ' + title, exact: true });
}

function runButton(page) {
  return page.getByRole('button', { name: /run$/i });
}

async function openTutorial(page, query = '') {
  await page.goto(tutorialURL + query);
  await expect(page.getByRole('heading', { name: 'Identifier Boundaries', exact: true })).toBeVisible();
  await expect(runButton(page)).toBeEnabled({ timeout: 60_000 });
  await expect(page.getByLabel('Token name 1', { exact: true })).toBeVisible();
}

/** Enter text through Monaco's accessible textbox, as a learner would paste it. */
async function editFile(page, filename, text) {
  await page.getByRole('group', { name: /^File tabs/ })
    .getByRole('button', { name: filename.endsWith('grammar.ebnf') ? 'Grammar (EBNF)' : 'Source', exact: true }).click();
  const editor = page.getByRole('textbox', { name: /code editor\./ });
  await editor.focus();
  await selectAllInMonaco(editor);
  await editor.press('Backspace');
  await page.keyboard.insertText(text);
}

async function repairTokenizer(page) {
  await page.getByRole('group', { name: /^File tabs/ }).getByRole('button', { name: 'Tokenizer rules', exact: true }).click();
  await page.getByLabel('Regular expression 2', { exact: true }).fill('[A-Za-z_][A-Za-z0-9_]*');
}

/** Start the native drag before scrolling a distant destination into view. */
async function dragTokenRule(page, scope, from, to) {
  const handle = index => scope.getByTitle('Drag token rule ' + index + ' to reorder', { exact: true });
  await handle(from).scrollIntoViewIfNeeded();
  const start = await handle(from).boundingBox();
  const x = start.x + start.width / 2;
  const y = start.y + start.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 8, y, { steps: 3 });
  await handle(to).scrollIntoViewIfNeeded();
  const end = await handle(to).boundingBox();
  await page.mouse.move(end.x + 10, end.y + 1, { steps: 3 });
  await page.mouse.move(end.x + 10, end.y + 1);
  await page.mouse.up();
}

function arrowAttachmentError(scope) {
  return scope.evaluate(host => {
    const svg = host.querySelector('.compiler-lab-tree-edges');
    const matrix = svg.getScreenCTM();
    const ports = [...host.querySelectorAll('.compiler-lab-child-port')].map(node => node.getBoundingClientRect());
    const cards = [...host.querySelectorAll('.compiler-lab-record')].map(node => node.getBoundingClientRect());
    return Math.max(...[...svg.querySelectorAll('.compiler-lab-tree-edge')].flatMap(path => {
      const start = path.getPointAtLength(0).matrixTransform(matrix);
      const end = path.getPointAtLength(path.getTotalLength()).matrixTransform(matrix);
      const startGap = Math.min(...ports.map(port => Math.hypot(start.x - port.left - port.width / 2, start.y - port.bottom)));
      const endGap = Math.min(...cards.map(card => Math.hypot(end.x - card.left - card.width / 2, end.y - card.top)));
      return [startGap, Math.max(0, endGap - 4)];
    }));
  });
}

test('chapter cycles through every distinct syntax tree without a representation switch', async ({ page }) => {
  const browserErrors = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  await page.goto(chapterURL);
  const ambiguity = lab(page, 'One Expression, More Than One Tree');
  await ambiguity.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(ambiguity.getByRole('status').filter({ hasText: /syntax trees? generated\./ }))
    .toContainText('2 possible syntax trees generated.');
  const firstGrouping = await ambiguity.getByText(/^Grouping:/).innerText();
  await ambiguity.getByRole('button', { name: 'Next tree', exact: true }).click();
  await expect(ambiguity.getByRole('status').filter({ hasText: /^Syntax tree [0-9]/ })).toContainText('2 of 2');
  const secondGrouping = await ambiguity.getByText(/^Grouping:/).innerText();
  expect([firstGrouping, secondGrouping].sort()).toEqual(['Grouping: ((x + 3) * 7)', 'Grouping: (x + (3 * 7))'].sort());
  await ambiguity.getByRole('button', { name: 'Next tree', exact: true }).click();
  await expect(ambiguity.getByText(/^Grouping:/)).toHaveText(firstGrouping);
  await ambiguity.getByRole('button', { name: 'Previous tree', exact: true }).click();
  await expect(ambiguity.getByText(/^Grouping:/)).toHaveText(secondGrouping);
  await ambiguity.getByText('Tree outline', { exact: true }).click();
  const outline = ambiguity.getByRole('group', { name: 'Syntax tree outline' });
  await expect(outline.getByRole('code')).toHaveCount(5);
  await expect(outline).toContainText('left of node 1');
  await expect(outline).toContainText('right of node 1');
  await expect(outline).toContainText('identifier: "x"');
  await ambiguity.getByLabel('Syntax tree', { exact: true }).selectOption('0');
  await expect(ambiguity.getByText(/^Grouping:/)).toHaveText(firstGrouping);
  await expect(ambiguity.getByLabel('Tree representation')).toHaveCount(0);
  await a11yCheckpoint(page, 'compiler chapter ambiguity', { feature: 'compiler-lab', include: '[data-compiler-lab]' });
  expect(browserErrors, 'compiler chapter must not produce JavaScript errors').toEqual([]);
});

test('tree arrows stay attached to child fields and nodes across resize, scroll, and zoom', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(chapterURL);
  const expression = lab(page, 'One Expression, More Than One Tree');
  await expression.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(expression.getByLabel('Syntax tree', { exact: true })).toBeVisible();
  const endpointError = () => arrowAttachmentError(expression);
  for (const width of [1440, 1000, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(endpointError, { message: 'each arrow must connect a child field to its node' }).toBeLessThan(3);
  }
  const diagram = expression.getByRole('region', { name: /^Syntax tree diagram/ });
  await diagram.focus();
  await diagram.press('ArrowRight');
  await expect.poll(endpointError).toBeLessThan(3);
  await page.evaluate(() => {
    document.documentElement.classList.add('dark-mode');
    document.documentElement.style.zoom = '1.25';
  });
  await expect.poll(endpointError).toBeLessThan(3);
});

test('chapter reports malformed inputs and replaces errors with a repaired tree', async ({ page }) => {
  await page.goto(chapterURL);
  const expression = lab(page, 'The Same Source, With Precedence');
  const source = expression.getByLabel('Source program');
  await source.fill('3 +');
  await expression.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(expression.getByRole('alert')).toContainText('Syntax');
  await expect(expression.getByRole('region', { name: /^Syntax tree diagram/ })).toHaveCount(0);
  await source.fill('3 @ 4');
  await expression.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(expression.getByRole('alert')).toContainText('Tokenization');
  await source.fill('(3 + 4) * 5');
  await expression.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(expression.getByRole('status').filter({ hasText: /syntax trees? generated\./ })).toContainText('1 syntax tree generated.');
  await expect(expression.getByRole('alert')).toHaveCount(0);
  await expression.locator('summary').filter({ hasText: /^Tokenizer rules$/ }).click();
  await expression.getByLabel('Regular expression 1', { exact: true }).fill('[');
  await expression.locator('summary').filter({ hasText: /^Tokenizer rules$/ }).click();
  await expression.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(expression.getByRole('alert')).toContainText('Tokenizer rules');
  await expect(expression.getByLabel('Regular expression 1', { exact: true })).toBeVisible();
  await expression.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(source).toHaveValue('x + 3 * 7\n');
});

test('chapter examples accept each other\'s grammar without hidden rule-name restrictions', async ({ page }) => {
  await page.goto(chapterURL);
  const ambiguity = lab(page, 'One Expression, More Than One Tree');
  const precedence = lab(page, 'The Same Source, With Precedence');
  const ambiguousGrammar = await ambiguity.getByLabel('Grammar (EBNF)').inputValue();
  const precedenceGrammar = await precedence.getByLabel('Grammar (EBNF)').inputValue();
  await ambiguity.getByLabel('Grammar (EBNF)').fill(precedenceGrammar);
  await ambiguity.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(ambiguity.getByText(/^Grouping:/)).toHaveText('Grouping: (x + (3 * 7))');
  await expect(ambiguity.getByRole('alert')).toHaveCount(0);
  await precedence.getByLabel('Grammar (EBNF)').fill(ambiguousGrammar);
  await precedence.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(precedence.getByLabel('Syntax tree', { exact: true }).getByRole('option')).toHaveCount(2);
  await expect(precedence.getByRole('alert')).toHaveCount(0);
});

test('chapter accepts new production and token names while preserving non-expression structure', async ({ page }) => {
  await page.goto(chapterURL);
  const example = lab(page, 'The Same Source, With Precedence');
  await example.getByLabel('Grammar (EBNF)').fill('greeting = word word ; word = NAME ;');
  await example.getByLabel('Source program').fill('hello there');
  await example.locator('summary').filter({ hasText: /^Tokenizer rules$/ }).click();
  await example.getByLabel('Token name 2', { exact: true }).fill('NAME');
  await example.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(example.getByRole('status').filter({ hasText: /syntax tree generated/ })).toContainText('1 syntax tree generated.');
  await expect(example.getByRole('alert')).toHaveCount(0);
  await example.getByText('Tree outline', { exact: true }).click();
  const outline = example.getByRole('group', { name: 'Syntax tree outline' });
  await expect(outline.getByRole('code')).toHaveText(['greeting', 'word', 'NAME: "hello"', 'word', 'NAME: "there"']);
  await example.getByLabel('Grammar (EBNF)').fill('BinaryExpression = NAME NAME ;');
  await example.getByRole('button', { name: 'Run', exact: true }).click();
  await example.getByText('Tree outline', { exact: true }).click();
  await expect(outline.getByRole('code')).toHaveText(['BinaryExpression', 'NAME: "hello"', 'NAME: "there"']);
  await expect(example.getByText(/^Grouping:/)).toHaveCount(0);
  await example.getByLabel('Grammar (EBNF)').fill('greeting = missing ;');
  await example.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(example.getByRole('alert')).toContainText('missing');
});

test('dragging token rows changes tie priority and retains edits, skip flags, and keyboard alternatives', async ({ page }) => {
  await page.goto(chapterURL);
  const example = lab(page, 'The Same Source, With Precedence');
  await example.locator('summary').filter({ hasText: /^Tokenizer rules$/ }).click();
  await example.getByLabel('Grammar (EBNF)').fill('name = RESERVED | IDENTIFIER ;');
  await example.getByLabel('Source program').fill('if');
  await example.getByLabel('Regular expression 2', { exact: true }).fill('[A-Za-z_][A-Za-z0-9_]*');
  const handle = row => example.getByTitle('Drag token rule ' + row + ' to reorder', { exact: true });
  await handle(2).dragTo(handle(1), { targetPosition: { x: 10, y: 1 } });
  await expect(example.getByLabel('Token name 1', { exact: true })).toHaveValue('IDENTIFIER');
  await expect(example.getByLabel('Regular expression 1', { exact: true })).toHaveValue('[A-Za-z_][A-Za-z0-9_]*');
  await expect(example.getByLabel('Token name 1', { exact: true })).toBeFocused();
  await expect(example.getByRole('status').filter({ hasText: /moved to position/ })).toContainText('IDENTIFIER moved to position 1');
  await example.getByRole('button', { name: 'Run', exact: true }).click();
  await example.getByText('Tokens (1)', { exact: true }).click();
  await expect(example.getByRole('table', { name: '1 token', exact: true })).toContainText('IDENTIFIER');
  // The same operation must work without dragging, including for touch users.
  const moveDown = example.getByRole('button', { name: 'Move down token rule 1', exact: true });
  await moveDown.focus();
  await moveDown.press('Enter');
  await expect(example.getByLabel('Token name 2', { exact: true })).toHaveValue('IDENTIFIER');
  await example.getByRole('button', { name: 'Run', exact: true }).click();
  await example.getByText('Tokens (1)', { exact: true }).click();
  await expect(example.getByRole('table', { name: '1 token', exact: true })).toContainText('RESERVED');
  await dragTokenRule(page, example, 10, 1);
  await expect(example.getByLabel('Token name 1', { exact: true })).toHaveValue('SPACE');
  await expect(example.getByLabel('Skip token 1', { exact: true })).toBeChecked();
  await handle(1).dragTo(example.getByLabel('Grammar (EBNF)'));
  await expect(example.getByLabel('Token name 1', { exact: true })).toHaveValue('SPACE');
  await expect(example.getByLabel('Grammar (EBNF)')).toHaveValue('name = RESERVED | IDENTIFIER ;');
  await a11yCheckpoint(page, 'reordered compiler tokenizer', { feature: 'compiler-lab', include: '[data-compiler-lab]' });
});

test('tutorial saves dragged token ordering and Reset restores the original order', async ({ page }) => {
  await openTutorial(page);
  await page.getByTitle('Drag token rule 2 to reorder', { exact: true })
    .dragTo(page.getByTitle('Drag token rule 1 to reorder', { exact: true }), { targetPosition: { x: 10, y: 1 } });
  await expect(page.getByLabel('Token name 1', { exact: true })).toHaveValue('IDENT');
  await page.reload();
  await expect(page.getByLabel('Token name 1', { exact: true })).toHaveValue('IDENT');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('link', { name: 'Reset Current Step', exact: true }).click();
  await expect(page.getByLabel('Token name 1', { exact: true })).toHaveValue('RESERVED');
});

test('token table edits add, order, skip, and remove rules without JSON', async ({ page }) => {
  await page.goto(chapterURL);
  const expression = lab(page, 'The Same Source, With Precedence');
  await expression.locator('summary').filter({ hasText: /^Tokenizer rules$/ }).click();
  const addedRow = await expression.getByRole('textbox', { name: /^Token name \d+$/ }).count() + 1;
  await expression.getByRole('button', { name: 'Add token rule', exact: true }).click();
  await expression.getByLabel('Token name ' + addedRow, { exact: true }).fill('COMMENT');
  await expression.getByLabel('Regular expression ' + addedRow, { exact: true }).fill('#[^\\n]*');
  await expression.getByLabel('Skip token ' + addedRow, { exact: true }).check();
  await expression.getByRole('button', { name: 'Move up token rule ' + addedRow, exact: true }).click();
  await expect(expression.getByLabel('Token name ' + (addedRow - 1), { exact: true })).toHaveValue('COMMENT');
  await expect(expression.getByLabel('Skip token ' + (addedRow - 1), { exact: true })).toBeChecked();
  await expression.getByRole('button', { name: 'Move down token rule ' + (addedRow - 1), exact: true }).click();
  await expect(expression.getByLabel('Regular expression ' + addedRow, { exact: true })).toHaveValue('#[^\\n]*');
  await expression.getByLabel('Source program').fill('x # a comment');
  await expression.getByRole('button', { name: 'Run', exact: true }).click();
  await expression.getByText('Tree outline', { exact: true }).click();
  await expect(expression.getByRole('group', { name: 'Syntax tree outline' })).toContainText('identifier: "x"');
  await expression.getByRole('button', { name: 'Remove token rule ' + addedRow, exact: true }).click();
  await expression.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(expression.getByRole('alert')).toContainText('Tokenization');
});

test('token edits preserve supplied syntax-tree settings without exposing extra controls', async ({ page }) => {
  await page.goto(chapterURL);
  const expression = lab(page, 'The Same Source, With Precedence');
  await expression.locator('summary').filter({ hasText: /^Tokenizer rules$/ }).click();
  await expect(expression.getByLabel('Start rule', { exact: true })).toHaveCount(0);
  await expect(expression.getByText('AST construction settings', { exact: true })).toHaveCount(0);
  const tokenNames = expression.getByRole('textbox', { name: /^Token name \d+$/ });
  const names = await tokenNames.evaluateAll(inputs => inputs.map(input => input.value));
  const numberIndex = names.indexOf('LITERAL_NUM') + 1;
  await expression.getByLabel('Regular expression ' + numberIndex, { exact: true }).fill('[0-9]+');
  await expression.getByLabel('Source program').fill('(x + 3) * 7');
  await expression.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(expression.getByText(/^Grouping:/)).toHaveText('Grouping: ((x + 3) * 7)');
  await expect(expression.getByRole('region', { name: /^Syntax tree diagram/ })).toBeVisible();
});

test('tutorial checks the edited tokenizer and runs its source through the real backend', async ({ page }) => {
  const browserErrors = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  await openTutorial(page);
  const checks = page.getByRole('button', { name: /test my work/i });
  await checks.click();
  await expect(page.getByRole('status').filter({ hasText: /tests passed\. Failures:/ })).toBeVisible();
  await repairTokenizer(page);
  await checks.click();
  await expect(page.getByRole('status').filter({ hasText: /^All 4 tests passed\./ })).toBeVisible();
  await runButton(page).click();
  const output = page.getByRole('region', { name: 'Compiler results', exact: true });
  await expect(output.getByRole('table')).toContainText('total2');
  await expect(output.getByRole('table')).toContainText('"7"');
  await expect(output.getByRole('region', { name: /^Syntax tree diagram/ })).toHaveCount(0);
  await a11yCheckpoint(page, 'compiler tutorial repaired tokenizer', { feature: 'compiler-lab', include: '.compiler-tutorial' });
  expect(browserErrors, 'compiler tutorial must not produce JavaScript errors').toEqual([]);
});

test('tutorial grammar repair controls grouping while source, grammar, and tree stay together', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openTutorial(page);
  await page.getByRole('button', { name: /^Step 2:/ }).click();
  await expect(page.getByRole('heading', { name: 'Operator Precedence', exact: true })).toBeVisible();
  await runButton(page).click();
  const output = page.getByRole('region', { name: 'Compiler results', exact: true });
  await expect(output.getByLabel('Syntax tree', { exact: true }).getByRole('option')).toHaveCount(2);
  await expect(page.getByLabel('Source program', { exact: true })).toHaveValue('base + 3 * 7\n');
  await expect(page.getByRole('textbox', { name: /code editor\./ })).toBeVisible();
  await expect.poll(() => output.evaluate(host => {
    const diagram = host.querySelector('.compiler-lab-tree-scroll').getBoundingClientRect();
    return diagram.bottom <= Math.min(host.getBoundingClientRect().bottom, window.innerHeight) + 1;
  }), { message: 'the full expression tree should fit beside source and grammar at desktop size' }).toBe(true);
  await editFile(page, 'grammar.ebnf', [
    'expression = term { addop term } ;',
    'term = factor { STAR factor } ;',
    'factor = IDENT | NUMBER | LPAREN expression RPAREN ;',
    'addop = PLUS | MINUS ;',
    'operator = PLUS | MINUS | STAR ;',
  ].join('\n'));
  await expect(output.getByRole('status').filter({ hasText: 'Inputs changed. Run to update these results.' })).toHaveCount(1);
  await page.getByRole('button', { name: /test my work/i }).click();
  await expect(page.getByRole('status').filter({ hasText: /^All 4 tests passed\./ })).toBeVisible();
  await runButton(page).click();
  await expect(output.getByText(/^Grouping:/)).toHaveText('Grouping: (base + (3 * 7))');
  const divider = page.getByRole('separator', { name: 'Resize editor panes', exact: true });
  const oldValue = await divider.getAttribute('aria-valuenow');
  await divider.focus();
  await divider.press('Shift+ArrowLeft');
  await expect(divider).not.toHaveAttribute('aria-valuenow', oldValue);
  await expect.poll(() => arrowAttachmentError(output)).toBeLessThan(3);
  await page.getByLabel('Source program', { exact: true }).fill('15 - 6 - 2');
  await expect(output.getByRole('status').filter({ hasText: 'Inputs changed. Run to update these results.' })).toHaveCount(1);
  await expect(output.getByText(/^Grouping:/)).toHaveText('Grouping: (base + (3 * 7))');
  await runButton(page).click();
  await expect(output.getByText(/^Grouping:/)).toHaveText('Grouping: ((15 - 6) - 2)');
  await expect(output.getByRole('status').filter({ hasText: 'Inputs changed. Run to update these results.' })).toHaveCount(0);
});

test('parentheses practice changes grouping by editing the grammar alone', async ({ page }) => {
  await openTutorial(page);
  await page.getByRole('button', { name: /^Step 3:/ }).click();
  await expect(page.getByRole('heading', { name: 'Parenthesized Expressions', exact: true })).toBeVisible();
  const output = page.getByRole('region', { name: 'Compiler results', exact: true });
  await runButton(page).click();
  await expect(output.getByRole('alert')).toContainText('Syntax');
  await editFile(page, 'grammar.ebnf', [
    'expression = term { addop term } ;',
    'term = factor { STAR factor } ;',
    'factor = IDENT | NUMBER | LPAREN expression RPAREN ;',
    'addop = PLUS | MINUS ;',
  ].join('\n'));
  await page.getByRole('button', { name: /test my work/i }).click();
  await expect(page.getByRole('status').filter({ hasText: /^All 4 tests passed\./ })).toBeVisible();
  await runButton(page).click();
  await expect(output.getByText(/^Grouping:/)).toHaveText('Grouping: ((base + 3) * 7)');
  await page.getByLabel('Source program', { exact: true }).fill('15 - (6 - 2)');
  await runButton(page).click();
  await expect(output.getByText(/^Grouping:/)).toHaveText('Grouping: (15 - (6 - 2))');
});

test('Stop terminates an expensive regex and the tutorial can run again', async ({ page }) => {
  await openTutorial(page);
  await page.getByLabel('Regular expression 2', { exact: true }).fill('(a+)+b');
  await page.getByLabel('Source program', { exact: true }).fill('a'.repeat(30) + '!');
  await runButton(page).click();
  await page.getByRole('button', { name: /stop$/i }).click();
  const output = page.getByRole('region', { name: 'Compiler results', exact: true });
  await expect(output).toContainText('Compiler run stopped');
  await expect(runButton(page)).toBeEnabled();
  await expect(runButton(page)).toBeFocused();
  await repairTokenizer(page);
  await page.getByLabel('Source program', { exact: true }).fill('clip12 42');
  await runButton(page).click();
  await expect(output.getByRole('table')).toContainText('clip12');
  await expect(output.getByRole('table')).toContainText('"42"');
  await expect(output.getByRole('alert')).toHaveCount(0);
});

test('token table drafts survive file switches and reload, while Reset and Solution refresh the table', async ({ page }) => {
  await openTutorial(page, '?autosave=true&instructor-mode=true');
  await repairTokenizer(page);
  await page.getByRole('button', { name: /test my work/i }).click();
  await expect(page.getByRole('status').filter({ hasText: /^All 4 tests passed\./ })).toBeVisible();
  await page.getByLabel('Source program', { exact: true }).fill('clip12 42');
  await runButton(page).click();
  await expect(page.getByRole('region', { name: 'Compiler results', exact: true }).getByRole('table')).toBeVisible();
  await page.getByRole('group', { name: /^File tabs/ }).getByRole('button', { name: 'Grammar (EBNF)', exact: true }).click();
  await expect(page.getByRole('textbox', { name: /code editor\./ })).toBeVisible();
  await expect(page.getByLabel('Source program', { exact: true })).toHaveValue('clip12 42');
  await page.getByRole('group', { name: /^File tabs/ }).getByRole('button', { name: 'Tokenizer rules', exact: true }).click();
  await expect(page.getByLabel('Regular expression 2', { exact: true })).toHaveValue('[A-Za-z_][A-Za-z0-9_]*');
  await page.reload();
  await expect(page.getByLabel('Regular expression 2', { exact: true })).toHaveValue('[A-Za-z_][A-Za-z0-9_]*');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('link', { name: 'Reset Current Step', exact: true }).click();
  await expect(page.getByLabel('Regular expression 2', { exact: true })).toHaveValue('[A-Za-z_]+');
  await expect(page.getByLabel('Source program', { exact: true })).toHaveValue('total2 = base + 3 * 7\n');
  await page.getByRole('link', { name: 'Solution', exact: true }).click();
  await expect(page.getByLabel('Regular expression 2', { exact: true })).toHaveValue('[A-Za-z_][A-Za-z0-9_]*');
});

for (const autosave of [true, false]) {
  test('editing compiler rules and source ' + (autosave ? 'saves immediately' : 'respects disabled autosave'), async ({ page }) => {
    await openTutorial(page, '?autosave=' + autosave);
    await page.getByLabel('Regular expression 2', { exact: true }).fill('[A-Za-z_][A-Za-z0-9_]*');
    await page.getByLabel('Source program', { exact: true }).fill('preview9 = 12');
    // Reload without Run, Test My Work, or navigation: editing is the save trigger.
    await page.reload();
    await expect(page.getByLabel('Regular expression 2', { exact: true }))
      .toHaveValue(autosave ? '[A-Za-z_][A-Za-z0-9_]*' : '[A-Za-z_]+');
    await expect(page.getByLabel('Source program', { exact: true }))
      .toHaveValue(autosave ? 'preview9 = 12' : 'total2 = base + 3 * 7\n');
  });
}

test('chapter results remain readable, keyboard operable, and accessible at 320 pixels in both themes', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(chapterURL);
  const expression = lab(page, 'The Same Source, With Precedence');
  const run = expression.getByRole('button', { name: 'Run', exact: true });
  await run.focus();
  await run.press('Enter');
  await expect(expression.getByRole('region', { name: /^Syntax tree diagram/ })).toBeVisible();
  await expression.locator('summary').filter({ hasText: /^Tokenizer rules$/ }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  const sizes = await expression.evaluate(host => ({
    paragraph: parseFloat(getComputedStyle(host.querySelector('p')).fontSize),
    controls: [...host.querySelectorAll('textarea, input, button, select, td, code')]
      .map(node => parseFloat(getComputedStyle(node).fontSize)),
  }));
  expect(sizes.controls.every(size => size >= sizes.paragraph), 'all compiler text must be at least paragraph size').toBe(true);
  await auditInteractiveState(page, 'narrow compiler results', { include: '[data-compiler-lab]' });
  await page.emulateMedia({ media: 'print' });
  await expect(run).toBeHidden();
  await expect(expression.getByRole('strong').filter({ hasText: 'Source program' })).toBeVisible();
  await expect(expression.getByRole('region', { name: /^Syntax tree diagram/ })).toBeHidden();
  const printedTree = expression.getByRole('group', { name: 'Syntax tree outline' });
  await expect(printedTree.getByRole('code')).toHaveCount(5);
  await expect(printedTree.getByRole('code').last()).toBeVisible();
});
