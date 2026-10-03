// @ts-check
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');

const chapter = '/SEBook/tools/haskell.html';
const terminal = (page, topic) => page.getByRole('region', { name: `Haskell evaluator: ${topic}`, exact: true });

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
  const lambdas = terminal(page, 'Lambdas and lexical scope');
  await expect(lambdas).toBeVisible();
  expect(runtimeLoads).toHaveLength(0);

  const firstStart = Date.now();
  await evaluate(lambdas, 'shadowExample');
  const firstEvaluationMs = Date.now() - firstStart;
  await expect(lambdas.getByRole('log').getByText('7', { exact: true })).toBeVisible();
  const warmStart = Date.now();
  await evaluate(lambdas, 'makeAdder 20 3');
  const warmEvaluationMs = Date.now() - warmStart;
  await expect(lambdas.getByRole('log').getByText('23', { exact: true })).toBeVisible();
  await evaluate(lambdas, ':type makeAdder');
  await expect(lambdas.getByRole('log')).toContainText(/Int\s*->\s*Int\s*->\s*Int/);

  const definitions = terminal(page, 'Definitions describe values');
  await evaluate(definitions, 'deliveryCost 8 4');
  await expect(definitions.getByRole('log').getByText('20', { exact: true })).toBeVisible();
  await evaluate(definitions, 'addFive 2');
  await expect(definitions.getByRole('log')).toContainText(/not in scope|unbound|undefined/i);
  await evaluate(lambdas, 'addFive 4');
  await expect(lambdas.getByRole('log').getByText('9', { exact: true })).toBeVisible();
  expect(runtimeLoads).toHaveLength(1);
  expect(errors).toEqual([]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('heading', { name: 'Lambdas and lexical scope', exact: true }).evaluate(heading => heading.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: testInfo.outputPath('haskell-example.png') });
  await testInfo.attach('local-evaluation-timings', {
    body: JSON.stringify({ firstEvaluationMs, warmEvaluationMs }), contentType: 'application/json',
  });
  console.log('Haskell evaluation timings (ms):', { firstEvaluationMs, warmEvaluationMs });
});

test('history preserves a draft, compiler errors recover, and controls work by keyboard', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(chapter);
  const panel = terminal(page, 'Lambdas and lexical scope');
  const input = panel.getByRole('textbox', { name: 'Haskell expression' });
  await evaluate(panel, 'addFive 8');
  await expect(input).toBeFocused();
  await input.fill('unfinished');
  await input.press('ArrowUp');
  await expect(input).toHaveValue('addFive 8');
  await input.press('ArrowDown');
  await expect(input).toHaveValue('unfinished');
  await input.press('Control+c');
  await expect(input).toHaveValue('');
  await evaluate(panel, '1 + True');
  await expect(panel.getByRole('log')).toContainText(/Bool|type|Num/);
  await evaluate(panel, 'addFive 9');
  await expect(panel.getByRole('log').getByText('14', { exact: true })).toBeVisible();
  await input.press('Control+l');
  await expect(panel.getByRole('log')).toBeEmpty();
  await input.press('Tab');
  await expect(panel.getByRole('button', { name: 'Evaluate', exact: true })).toBeFocused();
  await a11yCheckpoint(page, 'Chapter Haskell evaluator', { feature: 'haskell-chapter', include: '[data-haskell-evaluator]' });
});

test('Stop releases an evaluation and the runtime can be used again', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(chapter);
  const panel = terminal(page, 'Demand determines how much work is needed');
  await evaluate(panel, 'take 3 positive');
  await expect(panel.getByRole('log').getByText('[1,2,3]', { exact: true })).toBeVisible();
  await panel.getByRole('textbox').fill('sum positive');
  await panel.getByRole('button', { name: 'Evaluate', exact: true }).click();
  await expect(panel.getByRole('progressbar', { name: 'Evaluating Haskell expression' })).toBeVisible();
  const stop = panel.getByRole('button', { name: 'Stop evaluation', exact: true });
  await stop.focus();
  await stop.press('Enter');
  await expect(panel.getByRole('log')).toContainText('Evaluation stopped');
  await expect(panel.getByRole('progressbar')).toHaveCount(0);
  await expect(panel.getByRole('textbox')).toBeFocused();
  await evaluate(panel, 'take 2 positive');
  await expect(panel.getByRole('log').getByText('[1,2]', { exact: true })).toBeVisible();
});

test('evaluators reflow, support both themes, and leave readable code in print', async ({ page }) => {
  await page.goto(chapter);
  const panel = terminal(page, 'Lambdas and lexical scope');
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
  await expect(page.getByText('makeAdder amount', { exact: false }).first()).toBeVisible();
});

test('edited definitions are evaluated and Reset restores the worked example', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(chapter);
  const example = page.getByRole('group', { name: 'Haskell example: Lambdas and lexical scope', exact: true });
  const editor = example.getByRole('textbox', { name: 'Haskell code: Lambdas and lexical scope' });
  const original = await editor.inputValue();
  await editor.fill(original.replace('makeAdder 5', 'makeAdder 10'));
  await editor.press('Tab');
  await expect(editor).not.toBeFocused();
  const panel = terminal(page, 'Lambdas and lexical scope');
  await evaluate(panel, 'shadowExample');
  await expect(panel.getByRole('log').getByText('12', { exact: true })).toBeVisible();
  await editor.fill('answer = "<script>literal</script>"\n');
  await evaluate(panel, 'answer');
  await expect(panel.getByRole('log').getByText('"<script>literal</script>"', { exact: true })).toBeVisible();
  await evaluate(panel, 'shadowExample');
  await expect(panel.getByRole('log')).toContainText(/not in scope|unbound|undefined/i);
  await example.getByRole('button', { name: 'Reset code' }).click();
  await expect(editor).toHaveValue(original);
  await expect(editor).toBeFocused();
  await evaluate(panel, 'shadowExample');
  await expect(panel.getByRole('log').getByText('7', { exact: true })).toBeVisible();
});

test('print includes every line of the edited code without editor controls', async ({ page }, testInfo) => {
  await page.goto(chapter);
  const example = page.getByRole('group', { name: 'Haskell example: Lambdas and lexical scope', exact: true });
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
  test.setTimeout(120_000);
  await page.goto(chapter);
  const examples = [
    ['deliveryCost 5 2', '11'], ['double (3 + 1)', '8'], ['ticketPrice 17', '8'],
    ['invoice 12 4', '53'], ['fst submission', '"parser.hs"'], ['label 12', '"12"'],
    ['swap (True, 7)', '(7,True)'], ['larger 12 9', '12'], ['[1,2] : [[3]]', '[[1,2],[3]]'],
    ['totalSquares [2,3]', '13'], ['nearbyPairs', '[(1,2),(1,3),(2,3)]'],
    [':type map', /\(\w+ -> \w+\) -> \[\w+\] -> \[\w+\]/],
    ['finalPrices', '[9]'], ['shadowExample', '7'], ['add 5 2', '7'],
    [':type through', /\(\w+ -> \w+\) -> \(\w+ -> \w+\) -> \w+ -> \w+/],
    ['totalFrom 10 [2,3]', '15'], ['foldl (-) 10 [2,3]', '5'],
    ['take 2 (filter even positive)', '[2,4]'], ['deliveryLabel Collect', '"Collect at desk"'],
    ['addCredits 5 (Account "Ada" 20)', /Account.*Ada.*25/],
    ['evaluate exampleExpr', '20'], ['folderCount (Folder "root" [])', '1'],
    ['updated', 'Stop "A" (Stop "C" End)'],
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
  const panel = terminal(page, 'Demand determines how much work is needed');
  await evaluate(panel, 'take 1 positive');
  await panel.getByRole('textbox').fill('sum positive');
  await panel.getByRole('button', { name: 'Evaluate', exact: true }).click();
  await expect(terminal(page, 'Lambdas and lexical scope').getByRole('button', { name: 'Evaluate', exact: true })).toBeDisabled();
  await expect(panel.getByRole('log')).toContainText('Evaluation timed out', { timeout: 45_000 });
  await evaluate(panel, 'take 2 positive');
  await expect(panel.getByRole('log').getByText('[1,2]', { exact: true })).toBeVisible();
});

test('loading can be stopped and retried with a fresh runtime', async ({ page }) => {
  test.setTimeout(120_000);
  // Deliberately unavailable runtime: error-path network fault injection only.
  await page.route('**/haskell-runtime-frame.html', route => route.abort());
  await page.goto(chapter);
  const panel = terminal(page, 'Lambdas and lexical scope');
  await panel.getByRole('button', { name: 'Evaluate', exact: true }).click();
  await expect(panel.getByRole('button', { name: 'Stop evaluation', exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Stop evaluation', exact: true }).click();
  await expect(panel.getByRole('log')).toContainText('Evaluation stopped');
  await page.unroute('**/haskell-runtime-frame.html');
  await evaluate(panel, 'shadowExample');
  await expect(panel.getByRole('log').getByText('7', { exact: true })).toBeVisible();
});

test('the combined book also loads a working expression companion', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/SEBook/all.html', { waitUntil: 'domcontentloaded' });
  const panel = terminal(page, 'Lambdas and lexical scope');
  await evaluate(panel, 'shadowExample');
  await expect(panel.getByRole('log').getByText('7', { exact: true })).toBeVisible();
});
