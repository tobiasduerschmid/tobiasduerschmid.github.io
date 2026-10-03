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

const config = loadTutorialConfig('java-cs131');
const TUTORIAL_URL = '/SEBook/tools/java-cs131-tutorial';
const A11Y_FEATURE = 'java-cs131-tutorial';
const RUN_TIMEOUT = 30_000;

function testButton(page) {
  return page.getByRole('button', { name: /test my work/i });
}

// This is the documented, exportable tutorial-progress record, not runtime state.
async function readSavedProgress(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('tutorial-progress-java-cs131')));
}

async function enterSolution(page, step) {
  for (const file of step.solution.files) {
    expect(await setTutorialFileContent(page, file.path, file.content),
      `the editor provides the authored ${file.path} file`).toBe(true);
  }
}

test('optional review preserves drafts without crediting failed or skipped checks', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`${TUTORIAL_URL}?autosave=true`);
  await waitForTutorialReady(page);
  await stepButton(page, config.steps.length - 1).click();
  await expectActiveStep(page, config.steps.length - 1);
  await stepButton(page, 0).click();
  await expectActiveStep(page, 0);

  const firstFile = config.steps[0].files[0];
  const draftMarker = 'My saved Java draft';
  const draft = firstFile.content.replace('System.out.println(saved);',
    `System.out.println("${draftMarker}");`);
  expect(draft, 'the draft changes observable program output').not.toBe(firstFile.content);
  expect(await setTutorialFileContent(page, firstFile.path, draft)).toBe(true);
  await testButton(page).click();
  await expect(page.getByRole('status').filter({ hasText: /tests passed\. Failures:/ }))
    .toContainText('0 of 1 tests passed. Failures:', { timeout: RUN_TIMEOUT });
  await expect(page.getByRole('button', { name: /^Next/ })).toBeEnabled();
  await page.getByRole('button', { name: /^Next/ }).click();
  await expect(page.getByRole('heading', { name: 'Step 1 — Knowledge Check', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Skip Knowledge Check', exact: true }).click();
  await expectActiveStep(page, 1);

  await expect.poll(async () => (await readSavedProgress(page))?.files[firstFile.path]?.content)
    .toBe(draft);
  const saved = await readSavedProgress(page);
  expect(saved.stepsPassed, 'a failed check is not recorded as passed').toEqual([]);
  expect(saved.quizPassed, 'a skipped knowledge check is not recorded as passed').toEqual([]);

  await page.reload();
  await waitForTutorialReady(page);
  await stepButton(page, 0).click();
  await expectActiveStep(page, 0);
  await expect(page.getByRole('button', { name: /^Next/ })).toBeEnabled();
  await page.getByRole('button', { name: /run$/i }).click();
  await expect(page.getByRole('region', { name: 'Program output' }))
    .toContainText(draftMarker, { timeout: RUN_TIMEOUT });
  const restored = await readSavedProgress(page);
  expect(restored.stepsPassed).toEqual([]);
  expect(restored.quizPassed).toEqual([]);
});

// One fresh-context journey verifies the authored content, real Java worker,
// browser controls, and saved progress agree across every lesson.
test('all twelve solutions and knowledge checks complete through the student interface', async ({ page }) => {
  test.setTimeout(5 * 60_000);
  const browserErrors = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  await page.goto(`${TUTORIAL_URL}?autosave=true`);
  await waitForTutorialReady(page);
  await expectStepCount(page, 12);
  await a11yCheckpoint(page, 'CS131 Java — first lesson', { feature: A11Y_FEATURE });

  for (const [index, step] of config.steps.entries()) {
    await test.step(`Step ${index + 1}: ${step.title}`, async () => {
      await expectActiveStep(page, index);
      await expect(page.getByRole('heading', { level: 2, name: step.title, exact: true })).toBeVisible();
      await enterSolution(page, step);
      await testButton(page).click();
      const count = step.tests.length;
      await expect(page.getByRole('status').filter({ hasText: /^All \d+ tests? passed\./ }))
        .toHaveText(`All ${count} ${count === 1 ? 'test' : 'tests'} passed.`, { timeout: RUN_TIMEOUT });
      await expect(page.getByRole('button', { name: /^Next/ })).toBeEnabled();
      await page.getByRole('button', { name: /^Next/ }).click();
      await expect(page.getByRole('heading', { name: step.quiz.title, exact: true })).toBeVisible();
      if (index === 0) {
        await a11yCheckpoint(page, 'CS131 Java — active knowledge check', { feature: A11Y_FEATURE });
      }
      await answerQuizCorrectly(page);
      await expect(page.getByRole('heading', { name: 'Knowledge Check Complete!', exact: true })).toBeVisible();
      const questions = step.quiz.questions.length;
      await expect(page.getByText(new RegExp(`Your Score:\\s*${questions}\\s*/\\s*${questions}`)))
        .toBeVisible();
      if (index < config.steps.length - 1) {
        await page.getByRole('button', { name: new RegExp(`Continue to Step ${index + 2}`) }).click();
      }
    });
  }

  await a11yCheckpoint(page, 'CS131 Java — final knowledge-check results', { feature: A11Y_FEATURE });
  await page.getByRole('button', { name: 'Finish Review', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Review Finished', exact: true })).toBeVisible();
  const allSteps = config.steps.map((step, index) => index);
  await expect.poll(async () => (await readSavedProgress(page))?.quizPassed).toEqual(allSteps);
  expect((await readSavedProgress(page)).stepsPassed).toEqual(allSteps);
  expect(browserErrors, 'the complete learner journey produces no browser errors').toEqual([]);
});

test('print includes every lesson and quiz with solutions visible only to instructors', async ({ page }) => {
  await page.goto(`${TUTORIAL_URL}/print`);
  await expect(page.getByRole('heading', { level: 1, name: config.title, exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(config.steps.map(step => step.title));
  await expect(page.getByRole('heading', { name: /^Step \d+ — Knowledge Check$/ })).toHaveCount(12);
  await expect(page.getByText('Starter files', { exact: true })).toHaveCount(12);
  await expect(page.getByRole('heading', { name: 'Solution', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Solution', exact: true, includeHidden: true })).toHaveCount(12);
  await a11yCheckpoint(page, 'CS131 Java — student print view', { feature: A11Y_FEATURE, darkMode: false });

  await page.goto(`${TUTORIAL_URL}/print?instructor-mode=true`);
  await expect(page.getByRole('heading', { name: 'Solution', exact: true })).toHaveCount(12);
  await a11yCheckpoint(page, 'CS131 Java — instructor print view', { feature: A11Y_FEATURE, darkMode: false });
});

test('the tutorial index lists course Java and the existing UML Java tutorial separately', async ({ page }) => {
  await page.goto('/SEBook/tutorials');
  const courseLink = page.getByRole('link', { name: config.title, exact: true });
  const umlLink = page.getByRole('link', { name: loadTutorialConfig('java').title, exact: true });
  await expect(courseLink).toHaveCount(1);
  await expect(courseLink).toHaveAttribute('href', TUTORIAL_URL);
  await expect(umlLink).toHaveCount(1);
  await expect(umlLink).toHaveAttribute('href', '/SEBook/tools/java-tutorial');
});
