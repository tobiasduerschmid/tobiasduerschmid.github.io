// @ts-check
const { test, expect } = require('@playwright/test');
const {
  loadTutorialConfig,
  waitForTutorialReady,
  setTutorialFileContent,
  answerQuizCorrectly,
  expectActiveStep,
  expectStepCount,
  stepButton,
} = require('./tutorial-helpers');
const { a11yCheckpoint } = require('./a11y-helpers');
const capstonePrograms = require('./fixtures/haskell-capstone-programs');

const TUTORIALS = ['haskell', 'haskell-functions', 'haskell-data'];
const BOOT_TIMEOUT = 90_000;
const RUN_TIMEOUT = 60_000;
const A11Y_FEATURE = 'haskell-tutorial';

function testButton(page) {
  return page.getByRole('button', { name: /test my work/i });
}

async function runGate(page) {
  await testButton(page).click();
  await expect(page.getByRole('button', { name: /running tests/i })).toBeDisabled();
  await expect(testButton(page)).toBeEnabled({ timeout: RUN_TIMEOUT });
}

async function expectPassingGate(page, count) {
  await runGate(page);
  await expect(page.getByRole('status').filter({ hasText: /^All \d+ tests? passed\./ }))
    .toHaveText(`All ${count} ${count === 1 ? 'test' : 'tests'} passed.`);
}

async function expectFailingGate(page, count) {
  await runGate(page);
  await expect(page.getByRole('status').filter({ hasText: /tests passed\. Failures:/ }))
    .toHaveText(new RegExp(`^[0-9]+ of ${count} tests passed\\. Failures:`));
}

async function expectOnlyFailingGate(page, count, description) {
  await runGate(page);
  await expect(page.getByRole('status').filter({ hasText: /tests passed\. Failures:/ }))
    .toHaveText(`${count - 1} of ${count} tests passed. Failures: ${description}.`);
}

async function enterSolution(page, step) {
  for (const file of step.solution.files) {
    expect(await setTutorialFileContent(page, file.path, file.content),
      `the editor should contain the authored ${file.path} workspace file`).toBe(true);
  }
}

/** @param {import('@playwright/test').Page} page
 * @param {string | RegExp} [expectedOutput]
 */
async function runProgram(page, expectedOutput = '✓ Done') {
  await page.getByRole('button', { name: /run$/i }).click();
  await expect(page.getByRole('button', { name: /run$/i })).toBeEnabled({ timeout: RUN_TIMEOUT });
  await expect(page.getByRole('region', { name: 'Program output' }))
    .toContainText(expectedOutput, { timeout: RUN_TIMEOUT });
}

async function rejectOneQuizAnswer(page) {
  const options = page.getByRole('radio');
  const authoredCorrect = await options.first().getAttribute('data-correct');
  for (const option of await options.all()) {
    if (await option.getAttribute('data-index') !== authoredCorrect) {
      await option.click();
      break;
    }
  }
  await page.getByRole('button', { name: 'Next Question', exact: true }).click();
  await answerQuizCorrectly(page);
}

for (const slug of TUTORIALS) {
  const config = loadTutorialConfig(slug);
  const tutorialUrl = `/SEBook/tools/${slug}-tutorial`;

  test.describe(config.title, () => {
    test('students can visit every lesson and skip checks without recording passes', async ({ page }) => {
      test.setTimeout(150_000);
      await page.goto(tutorialUrl + '?autosave=true');
      await waitForTutorialReady(page, { bootTimeout: BOOT_TIMEOUT });
      await stepButton(page, config.steps.length - 1).click();
      await expectActiveStep(page, config.steps.length - 1);
      await stepButton(page, 0).click();
      await expectActiveStep(page, 0);
      await expectFailingGate(page, config.steps[0].tests.length);

      for (let index = 0; index < config.steps.length; index += 1) {
        await expectActiveStep(page, index);
        await page.getByRole('button', { name: /^Next/ }).click();
        await expect(page.getByRole('heading', { name: `Step ${index + 1} — Knowledge Check`, exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Skip Knowledge Check', exact: true }).click();
      }
      const readProgress = () => page.evaluate(slug =>
        JSON.parse(localStorage.getItem(`tutorial-progress-${slug}`)), slug);
      await expect.poll(async () => (await readProgress()).stepsVisited.length).toBe(config.steps.length);
      const progress = await readProgress();
      expect(progress.stepsPassed).toEqual([]);
      expect(progress.quizPassed).toEqual([]);
      await page.reload();
      await waitForTutorialReady(page, { bootTimeout: BOOT_TIMEOUT });
      await stepButton(page, 0).click();
      await expectActiveStep(page, 0);
      await expect(page.getByRole('button', { name: /^Next/ })).toBeEnabled();
      await a11yCheckpoint(page, `${slug} — optional progression`, { feature: A11Y_FEATURE });
    });

    // Each module is one student journey with a fresh browser context. The
    // optional checks retain their diagnostic feedback and genuine pass records.
    test('every starter needs repair, every solution passes, and quizzes remain optional', async ({ page }) => {
      test.setTimeout(15 * 60_000);
      const browserErrors = [];
      page.on('pageerror', (error) => browserErrors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') browserErrors.push(message.text());
      });
      await page.goto(tutorialUrl);
      await waitForTutorialReady(page, { bootTimeout: BOOT_TIMEOUT });
      await expectStepCount(page, config.steps.length);

      for (let index = 0; index < config.steps.length; index += 1) {
        const step = config.steps[index];
        await test.step(`Step ${index + 1}: ${step.title}`, async () => {
          await expectActiveStep(page, index);
          await expect(page.getByRole('heading', { level: 2, name: step.title, exact: true })).toBeVisible();
          await expect(page.getByRole('button', { name: /^Next/ })).toBeEnabled();

          await runProgram(page);

          await expectFailingGate(page, step.tests.length);
          await expect(page.getByRole('button', { name: /^Next/ })).toBeEnabled();

          await enterSolution(page, step);
          await expectPassingGate(page, step.tests.length);
          await expect(page.getByRole('button', { name: /^Next/ })).toBeEnabled();
          await a11yCheckpoint(page, `${slug} step ${index + 1} — passing checks`, {
            feature: A11Y_FEATURE,
            darkMode: index === 0,
          });

          await page.getByRole('button', { name: /^Next/ }).click();
          await expect(page.getByRole('heading', { name: `Step ${index + 1} — Knowledge Check`, exact: true }))
            .toBeVisible();
          if (index === 0) {
            await a11yCheckpoint(page, `${slug} — active knowledge check`, { feature: A11Y_FEATURE });
          }
          if (slug === 'haskell' && index === 0) {
            await rejectOneQuizAnswer(page);
            await expect(page.getByRole('button', { name: /Continue to Step 2/ })).toBeVisible();
            await expect(stepButton(page, 1)).toBeEnabled();
            await a11yCheckpoint(page, 'Haskell — retry after incorrect reasoning', { feature: A11Y_FEATURE });
            await page.getByRole('button', { name: 'Try Again', exact: true }).click();
          }
          await answerQuizCorrectly(page);
          await expect(page.getByRole('heading', { name: 'Knowledge Check Complete!', exact: true })).toBeVisible();
          if (index < config.steps.length - 1) {
            await page.getByRole('button', { name: new RegExp(`Continue to Step ${index + 2}`) }).click();
            await expectActiveStep(page, index + 1);
          }
        });
      }
      expect(browserErrors, 'the complete learner journey should produce no browser errors').toEqual([]);
    });

    test('capstone checks accept independent algorithms and reject plausible behavioral mistakes', async ({ page }) => {
      test.setTimeout(5 * 60_000);
      const index = config.steps.length - 1;
      const step = config.steps[index];
      await page.goto(`${tutorialUrl}?instructor-mode=true`);
      await waitForTutorialReady(page, { bootTimeout: BOOT_TIMEOUT });
      await stepButton(page, index).click();
      await expectActiveStep(page, index);
      for (const program of capstonePrograms[slug]) {
        await test.step(program.name, async () => {
          expect(await setTutorialFileContent(page, step.run_file, program.source)).toBe(true);
          // A compiler error is not evidence that the gate distinguishes
          // this behavioral mistake from a correct algorithm.
          await runProgram(page);
          if (program.passes) await expectPassingGate(page, step.tests.length);
          else await expectFailingGate(page, step.tests.length);
        });
      }
    });

    test('the print view contains every step and reveals solutions only in instructor mode', async ({ page }) => {
      await page.goto(`${tutorialUrl}/print`);
      await expect(page.getByRole('heading', { level: 1, name: config.title, exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { level: 2 })).toHaveText(config.steps.map((step) => step.title));
      await expect(page.getByText('Starter files', { exact: true })).toHaveCount(config.steps.length);
      await expect(page.getByRole('heading', { name: 'Solution', exact: true })).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Solution', exact: true, includeHidden: true }))
        .toHaveCount(config.steps.length);
      await expect(page.getByRole('heading', { name: /^Step \d+ — Knowledge Check$/ }))
        .toHaveCount(config.steps.length);
      await a11yCheckpoint(page, `${slug} — student print view`, { feature: A11Y_FEATURE });

      await page.goto(`${tutorialUrl}/print?instructor-mode=true`);
      await expect(page.getByRole('heading', { name: 'Solution', exact: true })).toHaveCount(config.steps.length);
      await a11yCheckpoint(page, `${slug} — instructor print view`, { feature: A11Y_FEATURE });
    });
  });
}

test('rechecking Haskell work replaces stale diagnostics and a new run shows fresh output', async ({ page }) => {
  test.setTimeout(120_000);
  const config = loadTutorialConfig('haskell');
  const step = config.steps.find(step => step.key === 'numeric-price-contract');
  const signatureTest = step.tests.find(test => test.signature);
  const solution = step.solution.files.find(file => file.path === step.run_file).content;
  const inferred = solution.replace(/^canAffordPizza ::.*\n/gm, '');
  const output = page.getByRole('region', { name: 'Program output' });
  const declarationDiagnostic = /An explicit top-level declaration for canAffordPizza is required/g;
  const browserErrors = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  await page.goto('/SEBook/tools/haskell-tutorial#numeric-price-contract');
  await waitForTutorialReady(page, { bootTimeout: BOOT_TIMEOUT });
  expect(inferred, 'the regression removes the assessed declaration').not.toBe(solution);
  expect(await setTutorialFileContent(page, step.run_file, inferred)).toBe(true);

  await expectOnlyFailingGate(page, step.tests.length, signatureTest.description);
  await expect(output).toContainText('An explicit top-level declaration for canAffordPizza is required');
  await expectOnlyFailingGate(page, step.tests.length, signatureTest.description);
  expect((await output.textContent()).match(declarationDiagnostic),
    'the current check reports the declaration failure once, without retaining the previous check').toHaveLength(1);
  await a11yCheckpoint(page, 'Haskell prices — current check diagnostics', { feature: A11Y_FEATURE });

  await enterSolution(page, step);
  await runProgram(page);
  await expect(output).toContainText('False');
  await expect(output).not.toContainText('An explicit top-level declaration');
  expect(browserErrors).toEqual([]);
});

test('the price lesson distinguishes text ordering, numeric contracts, and affordability behavior', async ({ page }) => {
  test.setTimeout(180_000);
  const config = loadTutorialConfig('haskell');
  const step = config.steps.find(step => step.key === 'numeric-price-contract');
  const signatureTest = step.tests.find(test => test.signature);
  expect(signatureTest, 'the lesson checks the explicitly declared numeric interface').toBeDefined();
  const starter = step.files.find(file => file.path === step.run_file).content;
  const solution = step.solution.files.find(file => file.path === step.run_file).content;
  const output = page.getByRole('region', { name: 'Program output' });
  await page.goto('/SEBook/tools/haskell-tutorial#numeric-price-contract');
  await waitForTutorialReady(page, { bootTimeout: BOOT_TIMEOUT });

  // The quoted amounts compile, but text ordering gives the wrong decision.
  await runProgram(page);
  await expect(output).toContainText('True');
  await expectFailingGate(page, step.tests.length);
  await a11yCheckpoint(page, 'Haskell prices — runnable text ordering mistake', { feature: A11Y_FEATURE });

  // Adding a numeric requirement does not convert the existing text inputs.
  const signatureOnly = starter.replace(/^canAffordPizza budget price =/m,
    'canAffordPizza :: Double -> Double -> Bool\ncanAffordPizza budget price =');
  expect(signatureOnly, 'the diagnostic adds the intended numeric signature').not.toBe(starter);
  expect(await setTutorialFileContent(page, step.run_file, signatureOnly)).toBe(true);
  await runProgram(page, /Cannot satisfy constraint/);
  await expect(output).not.toContainText('✓ Done');
  await a11yCheckpoint(page, 'Haskell prices — signature rejects quoted amounts', { feature: A11Y_FEATURE });

  // Inference still permits Run, but the assignment asks for an explicit interface.
  const inferred = solution.replace(/^canAffordPizza ::.*\n/gm, '');
  expect(inferred, 'the inference experiment removes the function declaration').not.toBe(solution);
  expect(await setTutorialFileContent(page, step.run_file, inferred)).toBe(true);
  await runProgram(page);
  await expect(output).toContainText('False');
  await expectOnlyFailingGate(page, step.tests.length, signatureTest.description);
  await expect(page.getByRole('button', { name: /^Next/ })).toBeEnabled();
  await a11yCheckpoint(page, 'Haskell prices — inference works but the declaration is required', { feature: A11Y_FEATURE });

  // Describing a declaration in either comment syntax does not declare a type.
  const commented = inferred.replace(/^canAffordPizza budget price =/m,
    '-- canAffordPizza :: Double -> Double -> Bool\n'
    + '{- canAffordPizza :: Double -> Double -> Bool -}\n'
    + 'canAffordPizza budget price =');
  expect(commented, 'the negative case includes declaration-shaped comments').not.toBe(inferred);
  expect(await setTutorialFileContent(page, step.run_file, commented)).toBe(true);
  await runProgram(page);
  await expect(output).toContainText('False');
  await expectOnlyFailingGate(page, step.tests.length, signatureTest.description);

  // A broader interface handles the samples but does not state the requested Double inputs.
  const generic = solution.replace(/^canAffordPizza ::.*$/m,
    'canAffordPizza :: Ord a => a -> a -> Bool');
  expect(generic, 'the negative case declares an explicitly generic comparison').not.toBe(solution);
  expect(await setTutorialFileContent(page, step.run_file, generic)).toBe(true);
  await runProgram(page);
  await expect(output).toContainText('False');
  await expectOnlyFailingGate(page, step.tests.length, signatureTest.description);

  await enterSolution(page, step);
  await runProgram(page);
  await expect(output).toContainText('False');
  await expectPassingGate(page, step.tests.length);
  await a11yCheckpoint(page, 'Haskell prices — numeric amounts satisfy the contract', { feature: A11Y_FEATURE });

  // Layout and explicit right association preserve the required function type.
  const formatted = inferred.replace(/^canAffordPizza budget price =/m,
    'canAffordPizza\n  :: Double\n  -> (Double -> Bool)\ncanAffordPizza budget price =');
  expect(formatted, 'the accepted declaration uses equivalent multiline formatting').not.toBe(inferred);
  expect(await setTutorialFileContent(page, step.run_file, formatted)).toBe(true);
  await runProgram(page);
  await expect(output).toContainText('False');
  await expectPassingGate(page, step.tests.length);
  await expect(page.getByRole('button', { name: /^Next/ })).toBeEnabled();
  await a11yCheckpoint(page, 'Haskell prices — equivalent declaration restores the complete contract', { feature: A11Y_FEATURE });

  // A compiling, type-correct comparison can still implement the wrong rule.
  const reversed = solution.replace('budget >= price', 'budget <= price');
  expect(reversed, 'the negative case reverses the affordability comparison').not.toBe(solution);
  expect(await setTutorialFileContent(page, step.run_file, reversed)).toBe(true);
  await runProgram(page);
  await expect(output).toContainText('True');
  await expectFailingGate(page, step.tests.length);
  await a11yCheckpoint(page, 'Haskell prices — type-correct reversed comparison fails checks', { feature: A11Y_FEATURE });
});

test('detached instructions let students skip the knowledge check without passing tests', async ({ page }) => {
  test.setTimeout(150_000);
  const config = loadTutorialConfig('haskell');
  await page.goto('/SEBook/tools/haskell-tutorial');
  await waitForTutorialReady(page, { bootTimeout: BOOT_TIMEOUT });
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: /Open instructions in separate window/ }).click(),
  ]);
  await expect(popup.getByRole('button', { name: /^Next/ })).toBeEnabled();
  await expect(stepButton(popup, 1)).toBeEnabled();
  await popup.getByRole('button', { name: /^Next/ }).click();
  await expect(popup.getByRole('heading', { name: 'Step 1 — Knowledge Check', exact: true })).toBeVisible();
  await popup.getByRole('button', { name: 'Skip Knowledge Check', exact: true }).click();
  await expect(popup.getByRole('heading', { level: 2, name: config.steps[1].title, exact: true })).toBeVisible();
  await a11yCheckpoint(popup, 'Haskell — detached instructions after skipping optional quiz', { feature: A11Y_FEATURE });
  await popup.close();
  // Detaching instructions selects Debug; reopen Steps to inspect synchronized navigation.
  await page.getByRole('button', { name: /\bSteps$/ }).click();
  await expectActiveStep(page, 1);
});

test('individual Haskell checks show progress after fixing one function', async ({ page }) => {
  test.setTimeout(180_000);
  const config = loadTutorialConfig('haskell');
  const stepIndex = config.steps.findIndex(step => step.key === 'stock-adjustment');
  const step = config.steps[stepIndex];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/SEBook/tools/haskell-tutorial');
  await waitForTutorialReady(page, { bootTimeout: BOOT_TIMEOUT });
  await stepButton(page, stepIndex).click();
  await expectActiveStep(page, stepIndex);

  // Independent partial implementations: the reward ignores practice mode;
  // the stock update handles ordinary changes and the lower limit only.
  const partial = `module Main where
matchCoins :: Bool -> Bool -> Int
matchCoins won practiceMode = if won then 12 else 0
adjustStock :: Int -> Int -> Int -> Int
adjustStock stock change capacity = max 0 (stock + change)
main :: IO ()
main = print (matchCoins True True, adjustStock 8 5 10)
`;
  const rewardFixed = partial.replace('if won then 12 else 0',
    'if won && not practiceMode then 12 else 0');
  const bothFixed = rewardFixed.replace('max 0 (stock + change)',
    'min capacity (max 0 (stock + change))');
  const capacityFailures = [
    'adjustStock: at or above the supplied capacity',
    'adjustStock: zero capacity',
  ];
  for (const [source, failures] of [
    [partial, ['matchCoins: practice mode for either outcome', ...capacityFailures]],
    [rewardFixed, capacityFailures],
    [bothFixed, []],
  ]) {
    expect(await setTutorialFileContent(page, step.run_file, source)).toBe(true);
    await runGate(page);
    const passed = step.tests.length - failures.length;
    const announcement = failures.length
      ? `${passed} of ${step.tests.length} tests passed. Failures: ${failures.join('; ')}.`
      : `All ${step.tests.length} tests passed.`;
    await expect(page.getByRole('status').filter({ hasText: /tests passed\./ }))
      .toHaveText(announcement);
    for (const check of step.tests) {
      const result = page.getByRole('listitem').filter({
        has: page.getByText(check.description, { exact: true }),
      });
      await expect(result).toHaveText((failures.includes(check.description) ? '✗' : '✓') + check.description);
    }
    await a11yCheckpoint(page, `Haskell individual progress — ${passed} criteria passed`,
      { feature: A11Y_FEATURE });
  }
  expect(errors, 'the progress feedback remains free of browser errors').toEqual([]);
});
