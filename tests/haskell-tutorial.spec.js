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

async function enterSolution(page, step) {
  for (const file of step.solution.files) {
    expect(await setTutorialFileContent(page, file.path, file.content),
      `the editor should contain the authored ${file.path} workspace file`).toBe(true);
  }
}

async function runProgram(page) {
  await page.getByRole('button', { name: /run$/i }).click();
  await expect(page.getByRole('button', { name: /run$/i })).toBeEnabled({ timeout: RUN_TIMEOUT });
  await expect(page.getByRole('region', { name: 'Program output' }))
    .toContainText('✓ Done', { timeout: RUN_TIMEOUT });
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
    // Each module is one student journey with a fresh browser context. The
    // steps intentionally depend on the preceding tests and quiz unlocking it.
    test('every runnable starter needs work, every solution passes, and quizzes unlock the path', async ({ page }) => {
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
          await expect(page.getByRole('button', { name: /^Next/ })).toBeDisabled();

          await runProgram(page);

          await expectFailingGate(page, step.tests.length);
          await expect(page.getByRole('button', { name: /^Next/ })).toBeDisabled();

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
            await expect(page.getByRole('button', { name: /Continue to Step 2/ })).toBeHidden();
            await expect(stepButton(page, 1)).toBeDisabled();
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

test('detached instructions open the required quiz without unlocking the next numbered step early', async ({ page }) => {
  test.setTimeout(150_000);
  const config = loadTutorialConfig('haskell');
  await page.goto('/SEBook/tools/haskell-tutorial');
  await waitForTutorialReady(page, { bootTimeout: BOOT_TIMEOUT });
  await enterSolution(page, config.steps[0]);
  await expectPassingGate(page, config.steps[0].tests.length);

  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: /Open instructions in separate window/ }).click(),
  ]);
  await expect(popup.getByRole('button', { name: /^Next/ })).toBeEnabled();
  await expect(stepButton(popup, 1)).toBeDisabled();
  await popup.getByRole('button', { name: /^Next/ }).click();
  await expect(popup.getByRole('heading', { name: 'Step 1 — Knowledge Check', exact: true })).toBeVisible();
  await answerQuizCorrectly(popup);
  await popup.getByRole('button', { name: /Continue to Step 2/ }).click();
  await expect(popup.getByRole('heading', { level: 2, name: config.steps[1].title, exact: true })).toBeVisible();
  await a11yCheckpoint(popup, 'Haskell — detached instructions after quiz completion', { feature: A11Y_FEATURE });
  await popup.close();
  await expectActiveStep(page, 1);
});
