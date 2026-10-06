// @ts-check
const { test, expect } = require('@playwright/test');
const { setEditorContent } = require('./tutorial-helpers');
const { a11yCheckpoint } = require('./a11y-helpers');

const PROGRAMS = [
  {
    backend: 'prolog',
    file: 'family.pl',
    source: 'choice(1).\nchoice(2).\ndoubled(X, Y) :- choice(X), Y is X * 2.\n',
    query: 'doubled(X, Y)',
    output: /X = 1, Y = 2[\s\S]*X = 2, Y = 4/,
    invalid: 'choice(.\n',
    error: /syntax|unexpected/i,
  },
  {
    backend: 'haskell',
    file: 'Main.hs',
    source: 'module Main where\ndouble x = x + x\nmain = print (double 21)\n',
    output: /\b42\b/,
    invalid: 'module Main where\nmain = print missingValue\n',
    error: /missingValue|not in scope|unbound|undefined/i,
  },
];

const startButton = page => page.getByRole('button', { name: 'Start debugger', exact: true });
const runButton = page => page.getByRole('button', { name: /run$/i });
const outputPanel = page => page.getByRole('region', { name: 'Program output' });
const historySlider = page => page.getByRole('slider', { name: 'Execution history position' });
const pausedStatus = page => page.getByRole('status').filter({ hasText: /paused/i });

async function openProgram(page, program) {
  await page.goto(`/SEBook/tools/${program.backend}-tutorial`);
  await expect(runButton(page)).toBeEnabled({ timeout: 90_000 });
  if (program.query) {
    // Prolog Run and Debug use the authored default query. Configure that
    // contract through the author-facing constructor, using the real backend.
    await page.evaluate(async (program) => {
      window._tutorial.destroy();
      window._tutorial = new window.TutorialCode('#tutorial-container', {
        backend: 'prolog', tutorialId: 'prolog-debugger-test', autosaveType: 'none',
        disableQuiz: true, debugger: true,
        steps: [{
          title: 'Debug a Prolog relation', instructions: 'Trace the default query.',
          files: [{ path: program.file, language: 'prolog', content: program.source }],
          run_file: program.file, default_query: program.query,
        }],
      });
      await window._tutorial.start();
    }, program);
  } else {
    // The editor's supported model API is setup only; debugger actions and
    // assertions use the same controls and visible results as a learner.
    expect(await setEditorContent(page, program.source)).toBe(true);
  }
  await expect(startButton(page)).toBeEnabled();
}

for (const program of PROGRAMS) {
  test.describe(`${program.backend} debugger`, () => {
    test('steps through real execution, rewinds a snapshot, stops, and runs again without isolation', async ({ page }) => {
      test.setTimeout(180_000);
      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(error.message));
      await openProgram(page, program);
      expect(await page.evaluate(() => crossOriginIsolated), 'these backends must work without isolation').toBe(false);

      if (program.backend === 'prolog') {
        await page.getByRole('button', { name: 'Terminal', exact: true }).click();
      }
      await startButton(page).press('Enter');
      await expect(pausedStatus(page)).toBeVisible({ timeout: 90_000 });
      await expect(outputPanel(page)).toBeVisible();
      await expect(historySlider(page)).toHaveValue('0');
      await expect(page.getByRole('region', { name: 'Call Stack', exact: true }))
        .toContainText(new RegExp(program.file.replace('.', '\\.') + ':\\d+'));
      if (program.backend === 'haskell') {
        const variables = page.getByRole('region', { name: 'Variables', exact: true });
        await expect(variables).toBeVisible();
        await expect(variables.getByRole('button', { name: 'Argument bindings', exact: true })).toBeVisible();
        await expect(variables.getByRole('button', { name: 'Local bindings', exact: true })).toBeVisible();
        await expect(page.getByRole('region', { name: 'Watch', exact: true })).toBeHidden();
        await expect(page.getByRole('textbox', { name: /watch/i })).toHaveCount(0);
      } else {
        await expect(page.getByRole('button', { name: 'Variables', exact: true })).toHaveAttribute('aria-expanded', 'true');
        await page.getByRole('button', { name: 'Variables', exact: true }).press('Enter');
        await expect(page.getByRole('button', { name: 'Variables', exact: true })).toHaveAttribute('aria-expanded', 'false');
        await page.getByRole('button', { name: 'Variables', exact: true }).press('Enter');
        await expect(page.getByRole('textbox', { name: 'Query variable to watch' })).toBeVisible();
      }
      await expect(page.getByRole('button', { name: 'Add Exception Breakpoint', exact: true })).toHaveCount(0);
      await a11yCheckpoint(page, `${program.backend} debugger paused`, { feature: 'language-debugger' });

      await page.getByRole('button', { name: 'Step Into', exact: true }).press('Enter');
      await expect(historySlider(page)).toHaveValue('1');
      await page.getByRole('button', { name: 'Step Back', exact: true }).press('Enter');
      await expect(historySlider(page)).toHaveValue('0');
      await page.getByRole('button', { name: 'Step Into', exact: true }).press('Enter');
      await expect(historySlider(page)).toHaveValue('1');
      await page.getByRole('button', { name: 'Stop', exact: true }).press('Enter');
      await expect(startButton(page)).toBeEnabled();
      await expect(runButton(page)).toBeEnabled({ timeout: 90_000 });

      await page.getByRole('button', { name: 'Clear', exact: true }).click();
      await runButton(page).click();
      await expect(outputPanel(page)).toContainText(program.output, { timeout: 90_000 });
      await expect(runButton(page)).toBeEnabled();
      expect(pageErrors, 'debugging and recovery must not raise page errors').toEqual([]);
    });

    test('reports source errors and can debug a corrected program', async ({ page }) => {
      test.setTimeout(180_000);
      await openProgram(page, program);
      expect(await setEditorContent(page, program.invalid)).toBe(true);
      await startButton(page).click();
      await expect(outputPanel(page)).toContainText(program.error, { timeout: 90_000 });
      await expect(startButton(page)).toBeEnabled();
      expect(await setEditorContent(page, program.source)).toBe(true);
      await startButton(page).click();
      await expect(pausedStatus(page)).toBeVisible({ timeout: 90_000 });
      await page.getByRole('button', { name: 'Stop', exact: true }).click();
      await expect(runButton(page)).toBeEnabled({ timeout: 90_000 });
    });
  });
}

test('a Prolog data watchpoint stops when the query variable becomes bound', async ({ page }) => {
  test.setTimeout(90_000);
  await openProgram(page, PROGRAMS[0]);
  await startButton(page).click();
  await expect(pausedStatus(page)).toBeVisible();
  const watchRegion = page.getByRole('region', { name: 'Watch', exact: true });
  await watchRegion.getByRole('textbox', { name: 'Query variable to watch' }).fill('X');
  await watchRegion.getByRole('button', { name: '+ Add', exact: true }).click();
  await watchRegion.getByRole('button', { name: 'Watch for data value changes' }).click();
  const breakpoints = page.getByRole('region', { name: 'Breakpoints', exact: true });
  await breakpoints.getByRole('button', { name: 'Run to Data Change', exact: true }).click();
  await expect(breakpoints).toContainText(/X\s*1/);
  await expect(page.getByRole('status').filter({ hasText: /data watchpoint changed/i })).toBeVisible();
  await a11yCheckpoint(page, 'Prolog debugger paused on a query binding', { feature: 'language-debugger' });
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(runButton(page)).toBeEnabled();
});

test('a completed Prolog trace remains navigable without repeating program output', async ({ page }) => {
  test.setTimeout(90_000);
  await openProgram(page, {
    ...PROGRAMS[0], source: 'announce(X) :- X = 1, write(marker), nl.\n', query: 'announce(X)',
  });
  await startButton(page).click();
  await expect(pausedStatus(page)).toBeVisible();
  await page.getByRole('button', { name: 'Step Into', exact: true }).click();
  await expect(historySlider(page)).toHaveValue('1');
  const callStack = page.getByRole('region', { name: 'Call Stack', exact: true });
  await callStack.getByRole('button', { name: /announce/ }).first().click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(startButton(page)).toBeEnabled();
  await expect(outputPanel(page)).toContainText('marker');
  const variables = page.getByRole('region', { name: 'Variables', exact: true });
  await expect(variables.getByText('X', { exact: true })).toBeVisible();
  await expect(variables.getByText('1', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'History', exact: true })).toContainText('recorded');
  const completedOutput = await outputPanel(page).innerText();
  const lastPosition = await historySlider(page).getAttribute('max');
  expect(Number(lastPosition), 'the completed trace includes resolution after its initial pause').toBeGreaterThan(0);
  await historySlider(page).press('Home');
  await expect(historySlider(page)).toHaveValue('0');
  await expect(historySlider(page)).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(historySlider(page)).toHaveValue('1');
  await page.keyboard.press('End');
  await expect(historySlider(page)).toHaveValue(lastPosition);
  await expect(outputPanel(page)).toHaveText(completedOutput);
});

test('debugger toolbar keeps keyboard focus when the viewport rearranges its controls', async ({ page }) => {
  test.setTimeout(90_000);
  await openProgram(page, PROGRAMS[0]);
  await startButton(page).click();
  await expect(pausedStatus(page)).toBeVisible();
  const stepInto = page.getByRole('button', { name: 'Step Into', exact: true });
  await stepInto.focus();
  await page.setViewportSize({ width: 640, height: 800 });
  // Let the browser finish its resize paint before checking retained focus.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(stepInto).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(historySlider(page)).toHaveValue('1');
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(runButton(page)).toBeEnabled();
});

test('a Prolog breakpoint comparison dialog is labeled and usable entirely with the keyboard', async ({ page }) => {
  test.setTimeout(90_000);
  await openProgram(page, PROGRAMS[0]);
  await startButton(page).click();
  await expect(pausedStatus(page)).toBeVisible();
  // Arrange a breakpoint through the editor adapter's command interface.
  // The dialog journey below uses only visible, accessible controls.
  await page.evaluate(() => window._tutorial._debuggerCtl.sync.dispatch({
    type: 'toggleBreakpoint', path: '/tutorial/family.pl', line: 3,
  }));
  const editCondition = page.getByRole('button', { name: 'Edit condition', exact: true });
  await editCondition.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Breakpoint Condition' });
  const comparison = dialog.getByRole('textbox', { name: 'Prolog comparison' });
  await expect(comparison).toBeFocused();
  await comparison.fill('X >= 2');
  await comparison.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(comparison).toBeFocused();
  await a11yCheckpoint(page, 'Prolog breakpoint comparison dialog', { feature: 'language-debugger' });
  await comparison.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(editCondition).toBeFocused();
  await editCondition.press('Enter');
  await comparison.fill('X >= 2');
  await dialog.getByRole('button', { name: 'Save', exact: true }).press('Enter');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('region', { name: 'Breakpoints', exact: true })).toContainText('when X >= 2');
  await expect(editCondition).toBeFocused();
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(runButton(page)).toBeEnabled();
});

test('a detached Prolog debugger steps and rewinds the same execution as the tutorial', async ({ page }) => {
  test.setTimeout(90_000);
  await openProgram(page, PROGRAMS[0]);
  await startButton(page).click();
  await expect(pausedStatus(page)).toBeVisible();
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Open debugger in a separate window' }).click();
  const popup = await popupPromise;
  await expect(historySlider(popup)).toHaveValue('0');
  await expect(popup.getByRole('textbox', { name: 'Query variable to watch' })).toBeVisible();
  await popup.getByRole('button', { name: 'Step Into', exact: true }).press('Enter');
  await expect(historySlider(popup)).toHaveValue('1');
  await expect(historySlider(page)).toHaveValue('1');
  await popup.getByRole('button', { name: 'Step Back', exact: true }).press('Enter');
  await expect(historySlider(popup)).toHaveValue('0');
  await expect(historySlider(page)).toHaveValue('0');
  await a11yCheckpoint(popup, 'detached Prolog debugger paused', { feature: 'language-debugger' });
  await popup.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(runButton(page)).toBeEnabled();
  await popup.close();
});


test('the Haskell terminal evaluates during a paused debug session without moving the trace', async ({ page }) => {
  test.setTimeout(180_000);
  await openProgram(page, PROGRAMS[1]);
  await startButton(page).press('Enter');
  await expect(pausedStatus(page)).toBeVisible({ timeout: 90_000 });
  await expect(historySlider(page)).toHaveValue('0');
  await page.getByRole('button', { name: 'Terminal', exact: true }).click();
  const interpreter = page.getByRole('region', { name: 'Haskell terminal', exact: true });
  const input = interpreter.getByRole('textbox', { name: 'Haskell expression', exact: true });
  await expect(input).toBeEditable();
  await input.fill('double 21');
  await input.press('Enter');
  await expect(interpreter.getByRole('log').getByText('42', { exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(historySlider(page)).toHaveValue('0');
  await expect(pausedStatus(page)).toBeVisible();
  await page.getByRole('button', { name: 'Step Into', exact: true }).press('Enter');
  await expect(historySlider(page)).toHaveValue('1');
});

test('Haskell trace explains recursive arguments, equation order, and results in the main view and popout', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await openProgram(page, { ...PROGRAMS[1], source: `module Main where
countAtLeast :: Int -> [Int] -> Int
countAtLeast threshold [] = 0
countAtLeast threshold (x:xs) = contribution + countAtLeast threshold xs
  where contribution = if x >= threshold then 1 else 0
main = print (countAtLeast 60 [60,59,60])
` });
  await startButton(page).press('Enter');
  await expect(pausedStatus(page)).toBeVisible({ timeout: 90_000 });
  await page.getByRole('button', { name: 'Continue', exact: true }).press('Enter');
  await expect(outputPanel(page)).toContainText('2', { timeout: 30_000 });
  const result = page.getByRole('button', { name: /Result of countAtLeast: 2/ });
  await expect(result).toBeVisible();
  await result.press('Enter');
  const variables = page.getByRole('region', { name: 'Variables', exact: true });
  await expect(variables.getByRole('button', { name: 'Argument bindings', exact: true })).toBeVisible();
  await expect(variables.getByRole('button', { name: 'Local bindings', exact: true })).toBeVisible();
  await expect(variables).toContainText('threshold');
  await expect(variables).toContainText('Int');
  await expect(variables).toContainText('contribution');
  await expect(page.getByRole('region', { name: 'Call Stack', exact: true }))
    .toContainText('countAtLeast 60 [60, 59, 60]');
  // Rewinding to the first call shows the supplied arguments in the equation overlay.
  const firstCall = page.getByRole('button', { name: /Find countAtLeast/ }).first();
  await firstCall.press('Enter');
  const equationSearch = page.getByRole('status', { name: /Equations/ });
  await expect(equationSearch).toBeVisible();
  await expect(equationSearch).toContainText('countAtLeast threshold []');
  await expect(equationSearch).toContainText('countAtLeast threshold (x:xs)');
  await expect(equationSearch).toContainText('Line 3 · not reached');
  await expect(equationSearch).toContainText('Line 4 · not reached');
  await expect(equationSearch).toContainText('60');
  await expect(equationSearch).toContainText('[60, 59, 60]');
  await expect(equationSearch).toContainText(':: Int');
  await expect(equationSearch).toContainText(':: [Int]');
  await expect(page.locator('.monaco-editor .tvm-eq-arrow-not-reached')).toHaveCount(2);
  await expect(page.locator('.monaco-editor .tvm-eq-not-reached')).toHaveCount(2);
  await page.getByRole('button', { name: /Try equation 1: countAtLeast threshold \[\]/ }).first().click();
  await expect(equationSearch).toContainText('Line 3 · tried');
  await expect(page.locator('.monaco-editor .tvm-eq-arrow-tried')).toHaveCount(1);
  await expect(page.locator('.monaco-editor .tvm-eq-arrow-not-reached')).toHaveCount(1);
  await page.getByRole('button', { name: /pattern did not match: countAtLeast threshold \[\]/ }).first().click();
  await expect(equationSearch).toContainText('Line 3 · not matched');
  await expect(page.locator('.monaco-editor .tvm-eq-arrow-not-matched')).toHaveCount(1);
  await page.getByRole('button', { name: /Use equation 2: countAtLeast threshold \(x:xs\)/ }).first().click();
  await expect(equationSearch).toContainText('Line 4 · matched');
  await expect(page.locator('.monaco-editor .tvm-eq-arrow-matched')).toHaveCount(1);
  await expect(page.locator('.monaco-editor .tvm-eq-arrow-not-matched')).toHaveCount(1);
  await expect.poll(async () => (await page.locator('.monaco-editor .tvm-debug-current-expression').allTextContents()).join('').replace(/\s/g, ''))
    .toBe('contribution+countAtLeastthresholdxs');
  const threshold = page.locator('.view-line').filter({ hasText: 'threshold (x:xs)' }).getByText('threshold', { exact: true });
  await threshold.hover();
  await expect(page.locator('.monaco-hover')).toContainText('threshold :: Int');
  await expect(page.locator('.monaco-hover')).toContainText('60');
  await page.getByRole('button', { name: /Find local binding contribution/ }).first().click();
  await expect(equationSearch).toHaveCount(0);
  await expect(page.locator('.monaco-editor .tvm-eq-arrow')).toHaveCount(0);
  await result.press('Enter');
  await a11yCheckpoint(page, 'Haskell equation trace and values', { feature: 'language-debugger' });

  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Open debugger in a separate window', exact: true }).click();
  const popup = await popupPromise;
  await expect(popup.getByRole('region', { name: 'Variables', exact: true })).toContainText('threshold');
  await expect(popup.getByRole('region', { name: 'Variables', exact: true })).toContainText('contribution');
  await expect(popup.getByRole('button', { name: /Result of countAtLeast: 2/ })).toBeVisible();
  await expect(popup.getByRole('region', { name: 'Call Stack', exact: true }))
    .toContainText('[60, 59, 60]');
  await popup.close();
  expect(errors).toEqual([]);
});

for (const dark of [false, true]) {
  test(`Haskell expression focus follows history and detached editors in ${dark ? 'dark' : 'light'} mode`, async ({ page }) => {
    test.setTimeout(180_000);
    await openProgram(page, { ...PROGRAMS[1], source: `module Main where
score :: Int -> Int
score n
  | n < 0 = 0
  | otherwise =
      subtotal
        + 1
  where
    subtotal = if n > 4 then n * 2 else n + 2
main = print (score 5)
` });
    const theme = page.getByRole('checkbox', { name: 'Toggle dark mode', exact: true });
    if (dark) await theme.press('Space');
    await expect(theme).toBeChecked({ checked: dark });
    await startButton(page).click();
    await expect(pausedStatus(page)).toBeVisible({ timeout: 90_000 });
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(outputPanel(page)).toContainText('11');
    const demand = page.getByRole('button', { name: /Find score/ }).first();
    await demand.click();
    const equationSearch = page.getByRole('status', { name: /Equations/ });
    await expect(equationSearch).toContainText('score n');
    await expect(equationSearch).toContainText('not reached');
    await expect(equationSearch).toContainText('5');
    await expect(equationSearch).toContainText(':: Int');
    await expect(page.locator('.monaco-editor .tvm-eq-arrow-not-reached')).toHaveCount(1);
    await page.getByRole('button', { name: /Patterns match: score n/ }).click();
    await expect(equationSearch).toContainText('matched');
    await expect(page.locator('.monaco-editor .tvm-eq-arrow-matched')).toHaveCount(1);
    await a11yCheckpoint(page, `Haskell equation search ${dark ? 'dark' : 'light'}`, { feature: 'language-debugger' });
    await page.getByRole('button', { name: /Result of score/ }).click();
    const highlights = target => target.locator('.monaco-editor .tvm-debug-current-expression');
    const highlightedText = async target => (await highlights(target).allTextContents()).join('').replace(/\s/g, '');
    await expect.poll(() => highlightedText(page)).toBe('subtotal+1');
    await page.getByRole('button', { name: /Use equation 1: score n/ }).click();
    await expect(equationSearch).toContainText('matched');
    await expect(equationSearch).toContainText('5');
    await expect.poll(() => highlightedText(page)).toBe('subtotal+1');
    await page.getByRole('button', { name: /Check if: n > 4/ }).click();
    await expect(equationSearch).toHaveCount(0);
    await expect.poll(() => highlightedText(page)).toBe('n>4');
    await a11yCheckpoint(page, `Haskell source focus ${dark ? 'dark' : 'light'}`, { feature: 'language-debugger' });

    const popupPromise = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Open Main.hs in a separate window', exact: true }).click();
    const popup = await popupPromise;
    await expect.poll(() => highlightedText(popup)).toBe('n>4');
    await page.getByRole('button', { name: /Check guard: n < 0/ }).click();
    await expect.poll(() => highlightedText(popup)).toBe('n<0');
    await popup.close();

    // After source edits, an old range must not box unrelated replacement text.
    expect(await setEditorContent(page, 'module Main where\nmain = print (99 :: Int)\n')).toBe(true);
    await page.getByRole('button', { name: /Check if: n > 4/ }).click();
    await expect(highlights(page)).toHaveCount(0);
  });
}
