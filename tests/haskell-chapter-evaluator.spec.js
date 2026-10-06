// @ts-check
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');

const chapter = '/SEBook/tools/haskell.html';
const terminal = (page, topic) => page.getByRole('region', { name: `Haskell evaluator: ${topic}`, exact: true });
const PARTIAL = 'Partial application specializes a function';
const RANGES = 'Ranges and infinite lists';

async function evaluate(panel, expression) {
  const input = panel.getByRole('textbox', { name: 'Haskell expression', exact: true });
  await input.fill(expression);
  await input.press('Enter');
  await expect(panel.getByRole('button', { name: 'Evaluate', exact: true })).toBeEnabled({ timeout: 90_000 });
}

test('chapter expressions use adjacent definitions, with a lazy shared runtime', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const runtimeLoads = [];
  const errors = [];
  page.on('request', request => {
    if (request.url().endsWith('/haskell-runtime-frame.html')) runtimeLoads.push(request.url());
  });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(chapter);
  const partial = terminal(page, PARTIAL);
  await expect(partial).toBeVisible();
  expect(runtimeLoads).toHaveLength(0);

  const firstStart = Date.now();
  await evaluate(partial, 'studentPrice 50');
  const firstEvaluationMs = Date.now() - firstStart;
  await expect(partial.getByRole('log').getByText('40', { exact: true })).toBeVisible();
  const warmStart = Date.now();
  await evaluate(partial, 'applyDiscount 50 30');
  const warmEvaluationMs = Date.now() - warmStart;
  await expect(partial.getByRole('log').getByText('15', { exact: true })).toBeVisible();
  await evaluate(partial, ':type applyDiscount');
  await expect(partial.getByRole('log')).toContainText(/Int\s*->\s*Int\s*->\s*Int/);

  const definitions = terminal(page, 'Define and call a function');
  await evaluate(definitions, 'fahrenheit 25');
  await expect(definitions.getByRole('log').getByText('77.0', { exact: true })).toBeVisible();
  await evaluate(definitions, 'studentPrice 2');
  await expect(definitions.getByRole('log')).toContainText(/not in scope|unbound|undefined/i);
  await evaluate(partial, 'studentPrice 15');
  await expect(partial.getByRole('log').getByText('12', { exact: true })).toBeVisible();
  expect(runtimeLoads).toHaveLength(1);
  expect(errors).toEqual([]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('heading', { name: PARTIAL, exact: true }).evaluate(heading => heading.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: testInfo.outputPath('haskell-example.png') });
  await testInfo.attach('local-evaluation-timings', {
    body: JSON.stringify({ firstEvaluationMs, warmEvaluationMs }), contentType: 'application/json',
  });
  console.log('Haskell evaluation timings (ms):', { firstEvaluationMs, warmEvaluationMs });
});

test('history preserves a draft, compiler errors recover, and controls work by keyboard', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(chapter);
  const panel = terminal(page, PARTIAL);
  const input = panel.getByRole('textbox', { name: 'Haskell expression' });
  await evaluate(panel, 'studentPrice 50');
  await expect(input).toBeFocused();
  await input.fill('unfinished');
  await input.press('ArrowUp');
  await expect(input).toHaveValue('studentPrice 50');
  await input.press('ArrowDown');
  await expect(input).toHaveValue('unfinished');
  await input.press('Control+c');
  await expect(input).toHaveValue('');
  await evaluate(panel, '1 + True');
  await expect(panel.getByRole('log')).toContainText(/Bool|type|Num/);
  await evaluate(panel, 'studentPrice 15');
  await expect(panel.getByRole('log').getByText('12', { exact: true })).toBeVisible();
  await input.press('Control+l');
  await expect(panel.getByRole('log')).toBeEmpty();
  await input.press('Tab');
  await expect(panel.getByRole('button', { name: 'Evaluate', exact: true })).toBeFocused();
  await a11yCheckpoint(page, 'Chapter Haskell evaluator', { feature: 'haskell-chapter', include: '[data-haskell-evaluator]' });
});

test('Stop releases an evaluation and the runtime can be used again', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(chapter);
  const panel = terminal(page, RANGES);
  await evaluate(panel, 'take 3 evens');
  await expect(panel.getByRole('log').getByText('[0,2,4]', { exact: true })).toBeVisible();
  await panel.getByRole('textbox').fill('length evens');
  await panel.getByRole('button', { name: 'Evaluate', exact: true }).click();
  await expect(panel.getByRole('progressbar', { name: 'Evaluating Haskell expression' })).toBeVisible();
  const stop = panel.getByRole('button', { name: 'Stop evaluation', exact: true });
  await stop.focus();
  await stop.press('Enter');
  await expect(panel.getByRole('log')).toContainText('Evaluation stopped');
  await expect(panel.getByRole('progressbar')).toHaveCount(0);
  await expect(panel.getByRole('textbox')).toBeFocused();
  await evaluate(panel, 'take 2 evens');
  await expect(panel.getByRole('log').getByText('[0,2]', { exact: true })).toBeVisible();
});

test('evaluators reflow, support both themes, and leave readable code in print', async ({ page }) => {
  await page.goto(chapter);
  const panel = terminal(page, PARTIAL);
  await expect(panel).toBeVisible();
  for (const dark of [false, true]) {
    await page.evaluate(dark => document.documentElement.classList.toggle('dark-mode', dark), dark);
    await a11yCheckpoint(page, `Chapter evaluator ${dark ? 'dark' : 'light'}`, { feature: 'haskell-chapter', include: '.haskell-example' });
  }
  await page.setViewportSize({ width: 320, height: 800 });
  await panel.getByRole('textbox').scrollIntoViewIfNeeded();
  await expect(panel.getByRole('textbox')).toBeInViewport({ ratio: 1 });
  await expect(panel.getByRole('button', { name: 'Evaluate', exact: true })).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.emulateMedia({ media: 'print' });
  await expect(panel).toBeHidden();
  await expect(page.getByText('applyDiscount percent price', { exact: false }).first()).toBeVisible();
});

test('edited definitions are evaluated and Reset restores the worked example', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(chapter);
  const example = page.getByRole('group', { name: `Haskell example: ${PARTIAL}`, exact: true });
  const editor = example.getByRole('textbox', { name: `Haskell code: ${PARTIAL}` });
  const original = await editor.inputValue();
  await editor.fill(original.replace('applyDiscount 20', 'applyDiscount 50'));
  await editor.press('Tab');
  await expect(editor).not.toBeFocused();
  const panel = terminal(page, PARTIAL);
  await evaluate(panel, 'studentPrice 50');
  await expect(panel.getByRole('log').getByText('25', { exact: true })).toBeVisible();
  await editor.fill('answer = "<script>literal</script>"\n');
  await evaluate(panel, 'answer');
  await expect(panel.getByRole('log').getByText('"<script>literal</script>"', { exact: true })).toBeVisible();
  await evaluate(panel, 'studentPrice 50');
  await expect(panel.getByRole('log')).toContainText(/not in scope|unbound|undefined/i);
  await example.getByRole('button', { name: 'Reset code' }).click();
  await expect(editor).toHaveValue(original);
  await expect(editor).toBeFocused();
  await evaluate(panel, 'studentPrice 50');
  await expect(panel.getByRole('log').getByText('40', { exact: true })).toBeVisible();
});

test('print includes every line of the edited code without editor controls', async ({ page }, testInfo) => {
  await page.goto(chapter);
  const example = page.getByRole('group', { name: `Haskell example: ${PARTIAL}`, exact: true });
  const editor = example.getByRole('textbox');
  const source = Array.from({ length: 40 }, (_, index) => `value${index} = ${index}`).join('\n') + '\nlastValue = "printed in full"';
  await editor.fill(source);
  await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
  await page.emulateMedia({ media: 'print' });
  await expect(editor).toBeHidden();
  await expect(example.getByRole('button', { name: 'Reset code' })).toHaveCount(0);
  // The mirror is the printable source, including text beyond the editor viewport.
  const printed = example.locator('code');
  await expect(printed).toHaveText(source);
  await expect(printed).toHaveCSS('color', 'rgb(0, 0, 0)');
  expect((await printed.boundingBox()).height).toBeGreaterThan(40 * 15);
  await page.pdf({ path: testInfo.outputPath('edited-code.pdf'), format: 'A4' });
  await page.emulateMedia({ media: 'screen' });
  await expect(editor).toBeVisible();
  await expect(editor).toHaveValue(source);
  await editor.fill('answer = 42');
  await expect(editor).toHaveValue('answer = 42');
});

test('every authored starting expression evaluates with its own example', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto(chapter);
  const examples = [
    ['ticket 100 3', '103'], ['total 4', '20'], ['shippingNote 2500', '"arrives in 4 days"'],
    ['fahrenheit 25', '77.0'], [':type needsCoat', /Int\s*->\s*Bool\s*->\s*Bool/], ['square (inc 3)', '16'],
    ['(-) 10 4', '6'], ['lateFee 3', '6'], ['windAdvice 45', '"secure loose items"'], ['triangle 4', '10'],
    ['commuteMinutes 30 60', '35'], ['isSquare 49', 'True'], ['fst reading', '"Lima"'], ['length weeks', '3'],
    ['take 2 temps', '[18,21]'], ['take 4 evens', '[0,2,4,6]'], ['"Al" : queue', '["Al","Bo","Cy"]'],
    ['head motto', "'K'"], ['countShort ["fig", "kiwi", "yam"]', '2'], ['oddSquares', '[1,9,25,49,81]'],
    ['sieve [2 .. 30]', '[2,3,5,7,11,13,17,19,23,29]'], ['statusText 404', '"Not Found"'],
    ['splitFirst [10, 20, 30]', '(10,[20,30])'], ['podium ["Ana", "Ben"]', '"Ana beat Ben"'],
    ['countShort ["fig", "kiwi", "yam"]', '2'],
    // The unfinished exercise reports its placeholder until the learner completes it.
    ['stutter "ab"', /undefined/], ['firstOr 0 [7, 8]', '7'], ['clamp 0 10 15', '10'], ['twice addTen 1', '21'],
    ['gradeScale True 75', '"P"'], ['map addShipping [10, 25]', '[14,29]'],
    ['filter isShort ["fig", "kiwi", "yam"]', '["fig","yam"]'], ['foldl longer 0 ["fig", "banana", "kiwi"]', '6'],
    ['shippedTotal', '50'], ['map (\\s -> s + 5) scores', '[77,100,93,66]'], ['inTeens 15', 'True'],
    ['studentPrice 50', '40'], ['rentalCost 20 15 3', '65'], ['boardingGroup (Ticket 12 Window)', '2'],
    ['loanDays (Book "Dune" 600)', '28'], ['countSongs mix', '2'],
    ['insert 5 small', 'Node (Node Leaf 2 Leaf) 4 (Node (Node Leaf 5 Leaf) 8 Leaf)'],
  ];
  const panels = page.getByRole('region', { name: /^Haskell evaluator:/ });
  await expect(panels).toHaveCount(examples.length);
  for (const [index, [expression, expected]] of examples.entries()) {
    const example = panels.nth(index);
    await expect(example.getByRole('textbox'), `Starting expression: ${expression}`).toHaveValue(expression);
    await example.getByRole('button', { name: 'Evaluate', exact: true }).click();
    await expect(example.getByRole('button', { name: 'Evaluate', exact: true })).toBeEnabled({ timeout: 90_000 });
    await expect(example.getByRole('log').getByText(expected, { exact: typeof expected === 'string' }), expression).toBeVisible();
  }
});

test('a timed-out expression releases all prompts and allows another evaluation', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(chapter);
  const panel = terminal(page, RANGES);
  await evaluate(panel, 'take 1 evens');
  await panel.getByRole('textbox').fill('length evens');
  await panel.getByRole('button', { name: 'Evaluate', exact: true }).click();
  await expect(terminal(page, PARTIAL).getByRole('button', { name: 'Evaluate', exact: true })).toBeDisabled();
  await expect(panel.getByRole('log')).toContainText('Evaluation timed out', { timeout: 45_000 });
  await evaluate(panel, 'take 2 evens');
  await expect(panel.getByRole('log').getByText('[0,2]', { exact: true })).toBeVisible();
});

test('loading can be stopped and retried with a fresh runtime', async ({ page }) => {
  test.setTimeout(120_000);
  // Deliberately unavailable runtime: error-path network fault injection only.
  await page.route('**/haskell-runtime-frame.html', route => route.abort());
  await page.goto(chapter);
  const panel = terminal(page, PARTIAL);
  await panel.getByRole('button', { name: 'Evaluate', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'Stop evaluation', exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Stop evaluation', exact: true }).click();
  await expect(panel.getByRole('log')).toContainText('Evaluation stopped');
  await page.unroute('**/haskell-runtime-frame.html');
  await evaluate(panel, 'studentPrice 50');
  await expect(panel.getByRole('log').getByText('40', { exact: true })).toBeVisible();
});

test('the combined book also loads a working expression companion', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/SEBook/all.html', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: PARTIAL, exact: true })).toBeVisible({ timeout: 90_000 });
  const panel = terminal(page, PARTIAL);
  await expect(panel).toBeVisible({ timeout: 90_000 });
  await evaluate(panel, 'studentPrice 50');
  await expect(panel.getByRole('log').getByText('40', { exact: true })).toBeVisible();
});
