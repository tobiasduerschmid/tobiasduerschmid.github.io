// @ts-check
const { test, expect } = require('@playwright/test');
const { startRuntime, request, writeSource } = require('./haskell-runtime-helpers');
const { waitForTutorialReady } = require('./tutorial-helpers');
const { a11yCheckpoint } = require('./a11y-helpers');

async function evaluate(page, expression, path = 'Main.hs') {
  return request(page, { type: 'evaluate', path, expression, silent: true });
}

function expectValue(result, value) {
  expect(result.type).toBe('run_done');
  expect(result.exitCode, result.stderr || result.error).toBe(0);
  expect(result.stderr).toBe('');
  expect(result.stdout.trim()).toBe(value);
}

for (const [name, source] of [
  ['an explicit module', 'module Main where\ndouble :: Int -> Int\ndouble x = x * 2\n'],
  ['a file without a module header', 'double :: Int -> Int\ndouble x = x * 2\n'],
]) {
  test(`the interpreter evaluates expressions in ${name} without requiring main`, async ({ page }) => {
    await startRuntime(page);
    await writeSource(page, source);

    expectValue(await evaluate(page, 'double 21'), '42');

    const file = await request(page, { type: 'read', path: 'Main.hs' });
    expect(file.content, 'evaluation must not rewrite learner code').toBe(source);
  });
}

test('each evaluation uses the latest workspace definitions', async ({ page }) => {
  await startRuntime(page);
  await writeSource(page, 'module Main where\nbonus = 3\n');
  expectValue(await evaluate(page, 'bonus + 10'), '13');

  await writeSource(page, 'module Main where\nbonus = 7\n');
  expectValue(await evaluate(page, 'bonus + 10'), '17');
});

for (const command of [':t', ':type']) {
  test(`${command} reports a function type without running the function`, async ({ page }) => {
    await startRuntime(page);
    await writeSource(page, 'module Main where\nloop :: Int -> Int\nloop x = loop x\n');

    const result = await evaluate(page, `${command} loop`);

    expect(result.exitCode, result.stderr || result.error).toBe(0);
    expect(result.stdout.trim()).toMatch(/^(?:Prelude\.)?Int\s*->\s*(?:Prelude\.)?Int$/);
  });
}

test('an expression type error does not prevent later evaluation', async ({ page }) => {
  await startRuntime(page);
  await writeSource(page, 'module Main where\nanswer = 42\n');

  const invalid = await evaluate(page, '1 + True');
  expect(invalid.exitCode).toBe(1);
  expect(invalid.stderr).toMatch(/type|Num|Bool/i);

  expectValue(await evaluate(page, 'answer'), '42');
});

test('a corrected source file can be evaluated after a compiler error', async ({ page }) => {
  await startRuntime(page);
  await writeSource(page, 'module Main where\nanswer :: Int\nanswer = True\n');
  const invalid = await evaluate(page, 'answer');
  expect(invalid.exitCode).toBe(1);
  expect(invalid.stderr).toMatch(/type|Bool|Int/i);

  await writeSource(page, 'module Main where\nanswer :: Int\nanswer = 42\n');
  expectValue(await evaluate(page, 'answer'), '42');
});

test('unsupported interpreter commands cannot change or terminate the workspace', async ({ page }) => {
  await startRuntime(page);
  const source = 'module Main where\nanswer = 42\n';
  await writeSource(page, source);

  for (const expression of [':! echo unsupported', ':load Other.hs', ':quit', '1\n:quit']) {
    const result = await evaluate(page, expression);
    expect(result.exitCode, `${expression} must be rejected`).toBe(1);
    expect(result.stderr || result.error, `${expression} needs an explanatory diagnostic`).toMatch(/unsupported|only|single|one.line/i);
  }

  expectValue(await evaluate(page, 'answer'), '42');
  const file = await request(page, { type: 'read', path: 'Main.hs' });
  expect(file.content).toBe(source);
});

test('local expression bindings do not leak into later expressions, Run, or tests', async ({ page }) => {
  await startRuntime(page);
  await writeSource(page, 'module Main where\nanswer = 42\nmain = print answer\n');

  expectValue(await evaluate(page, 'let answer = 7 in answer'), '7');
  expectValue(await evaluate(page, 'answer'), '42');
  const check = await request(page, { type: 'runTest', path: 'Main.hs', expression: 'answer == 42' });
  expect(check.exitCode, check.stderr || check.error).toBe(0);
  const run = await request(page, { type: 'run', path: 'Main.hs', silent: true });
  expectValue(run, '42');
});

test('switching the evaluated module does not leave conflicting imports', async ({ page }) => {
  await startRuntime(page);
  await writeSource(page, 'module Main where\nanswer = 42\n');
  await writeSource(page, 'module Other where\nanswer = 7\n', 'Other.hs');

  expectValue(await evaluate(page, 'answer'), '42');
  expectValue(await evaluate(page, 'answer', 'Other.hs'), '7');
  expectValue(await evaluate(page, 'answer'), '42');
});

test('type queries do not demand a cyclic value, but evaluating it reports the cycle', async ({ page }) => {
  await startRuntime(page);
  await writeSource(page, 'module Main where\nbad :: Int\nbad = bad\n');

  const type = await evaluate(page, ':type bad');
  expectValue(type, 'Int');
  const forced = await evaluate(page, 'print bad');
  expect(forced.exitCode).toBe(1);
  expect(forced.stderr).toMatch(/cycl|recurs/i);
  expectValue(await evaluate(page, '6 * 7'), '42');
});

async function openInterpreter(page) {
  await page.goto('/SEBook/tools/haskell-tutorial');
  await waitForTutorialReady(page, { bootTimeout: 90_000 });
  await page.getByRole('button', { name: 'Interpreter', exact: true }).click();
  return page.getByRole('region', { name: 'Haskell interpreter', exact: true });
}

async function editMainWithoutSaving(page, source) {
  // Public Monaco API is fixture setup only. No backend write here: the
  // learner-facing Evaluate action is responsible for using current edits.
  await page.evaluate((source) => {
    const model = window.monaco.editor.getModels().find((model) => model.uri.path === '/Main.hs');
    if (!model) throw new Error('Main.hs must be open in the editor');
    model.setValue(source);
  }, source);
}

async function submitExpression(interpreter, expression) {
  await interpreter.getByRole('textbox', { name: 'Haskell expression', exact: true }).fill(expression);
  await interpreter.getByRole('button', { name: 'Evaluate', exact: true }).click();
  await expect(interpreter.getByRole('button', { name: 'Evaluate', exact: true }))
    .toBeEnabled({ timeout: 30_000 });
}

test('the terminal prompt evaluates current editor changes and recovers after an error', async ({ page }) => {
  test.setTimeout(120_000);
  const browserErrors = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  const interpreter = await openInterpreter(page);
  const transcript = interpreter.getByRole('log', { name: 'Haskell interpreter transcript' });
  await editMainWithoutSaving(page, 'module Main where\nboost n = n + 5\n');

  await submitExpression(interpreter, 'boost 10');
  await expect(transcript.getByText('15', { exact: true })).toBeVisible();
  await a11yCheckpoint(page, 'Haskell interpreter — evaluated expression', {
    feature: 'haskell-interpreter', darkMode: true,
  });

  await editMainWithoutSaving(page, 'module Main where\nboost n = n + 8\n');
  await submitExpression(interpreter, 'boost 10');
  await expect(transcript.getByText('18', { exact: true })).toBeVisible();

  await submitExpression(interpreter, '1 + True');
  await expect(transcript).toContainText(/type|Num|Bool/i);
  await a11yCheckpoint(page, 'Haskell interpreter — diagnostic', { feature: 'haskell-interpreter' });
  await submitExpression(interpreter, 'boost 20');
  await expect(transcript.getByText('28', { exact: true })).toBeVisible();
  expect(browserErrors, 'interpreter errors are learner feedback, not uncaught browser exceptions').toEqual([]);
});

test('tuple-style calls explain separate arguments and preserve compiler details', async ({ page }) => {
  test.setTimeout(120_000);
  const interpreter = await openInterpreter(page);
  const transcript = interpreter.getByRole('log', { name: 'Haskell interpreter transcript' });
  await editMainWithoutSaving(page, 'canAffordPizza budget price = budget >= price\n');

  await submitExpression(interpreter, 'canAffordPizza(9,12)');

  const explanation = transcript.getByText(/one tuple argument/);
  await expect(explanation).toBeVisible();
  await expect(explanation).toContainText('canAffordPizza 9 12');
  await transcript.getByText('Compiler details', { exact: true }).click();
  await expect(transcript.getByText(/Show[\s\S]*Bool/)).toBeVisible();
  await a11yCheckpoint(page, 'Haskell interpreter — tuple call explanation and compiler details', {
    feature: 'haskell-interpreter',
  });

  await submitExpression(interpreter, 'canAffordPizza 9 12');
  await expect(transcript.getByText('False', { exact: true })).toBeVisible();
  await submitExpression(interpreter, 'canAffordPizza 12 9');
  await expect(transcript.getByText('True', { exact: true })).toBeVisible();
});

test('students can recall terminal commands and clear the transcript with keyboard or buttons', async ({ page }) => {
  test.setTimeout(120_000);
  const interpreter = await openInterpreter(page);
  const input = interpreter.getByRole('textbox', { name: 'Haskell expression', exact: true });
  const transcript = interpreter.getByRole('log', { name: 'Haskell interpreter transcript' });
  await submitExpression(interpreter, '6 * 7');
  await expect(transcript.getByText('42', { exact: true })).toBeVisible();
  await submitExpression(interpreter, '9 + 1');
  await expect(transcript.getByText('10', { exact: true })).toBeVisible();

  await input.fill('unfinished expression');
  await input.press('ArrowUp');
  await expect(input).toHaveValue('9 + 1');
  await interpreter.getByRole('button', { name: 'Previous command', exact: true }).click();
  await expect(input).toHaveValue('6 * 7');
  await interpreter.getByRole('button', { name: 'Next command', exact: true }).click();
  await expect(input).toHaveValue('9 + 1');
  await input.press('ArrowDown');
  await expect(input).toHaveValue('unfinished expression');

  await interpreter.getByRole('button', { name: 'Clear transcript', exact: true }).click();
  await expect(transcript).not.toContainText('42');
  await expect(transcript).not.toContainText('10');
});

test('stopping a nonterminating expression restores keyboard focus and permits another evaluation', async ({ page }) => {
  test.setTimeout(120_000);
  const interpreter = await openInterpreter(page);
  const input = interpreter.getByRole('textbox', { name: 'Haskell expression', exact: true });
  const evaluateButton = interpreter.getByRole('button', { name: 'Evaluate', exact: true });
  const stopButton = interpreter.getByRole('button', { name: 'Stop evaluation', exact: true });
  await input.fill('sum [1..]');
  await evaluateButton.click();
  await expect(stopButton).toBeEnabled();

  await stopButton.focus();
  await stopButton.press('Enter');

  await expect(evaluateButton).toBeEnabled({ timeout: 90_000 });
  await expect(input).toBeFocused();
  await submitExpression(interpreter, '6 * 7');
  await expect(interpreter.getByRole('log', { name: 'Haskell interpreter transcript' })
    .getByText('42', { exact: true })).toBeVisible();
  await a11yCheckpoint(page, 'Haskell interpreter — stopped and recovered', {
    feature: 'haskell-interpreter',
  });
});

test('a nonterminating expression times out and the restarted interpreter evaluates another command', async ({ page }) => {
  // Exercise the real 30-second execution deadline, including evaluation and
  // executor restart. An immediate Stop click only tests cancellation at startup.
  test.setTimeout(90_000);
  const interpreter = await openInterpreter(page);
  const transcript = interpreter.getByRole('log', { name: 'Haskell interpreter transcript' });
  const evaluateButton = interpreter.getByRole('button', { name: 'Evaluate', exact: true });
  await interpreter.getByRole('textbox', { name: 'Haskell expression', exact: true }).fill('sum [1..]');

  await evaluateButton.click();

  await expect(transcript).toContainText(/timed out/i, { timeout: 60_000 });
  await expect(evaluateButton).toBeEnabled({ timeout: 30_000 });
  await submitExpression(interpreter, '6 * 7');
  await expect(transcript.getByText('42', { exact: true })).toBeVisible();
});
