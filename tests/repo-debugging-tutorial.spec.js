// @ts-check
const { test, expect } = require('@playwright/test');
const { loadTutorialConfig, applySolution, setTutorialFileContent, answerQuiz } = require('./tutorial-helpers');
const { a11yCheckpoint } = require('./a11y-helpers');

// scripts/tests/test_repo_debugging_graders.py replays every check against
// alternative and mistaken submissions on native Python. These tests establish
// the same package, grading asset, and pytest runs in the browser's Pyodide.
const URL = '/SEBook/development_practices/repo-debugging-tutorial';
const config = loadTutorialConfig('repo-debugging');
const TIMEOUT = 90_000;
const stepIndex = key => config.steps.findIndex(step => step.key === key);
const starterFile = (key, path) => config.steps[stepIndex(key)].files.find(file => file.path === path).content;
// Checks each starter already passes, matching the native replay; the rest
// describe that lesson's bug and the learner's still-missing test.
const STARTER_PASSES = {
  orient: 1, reproduce: 2, 'green-bar': 2, 'root-cause': 1, 'ai-patches': 1, 'weakened-test': 3, capstone: 2,
};

async function openLesson(page, index) {
  await page.goto(`${URL}?instructor-mode=true&autosave=false`);
  await expect(page.getByRole('button', { name: 'Start debugger', exact: true })).toBeEnabled({ timeout: TIMEOUT });
  await expect(page.locator('.tvm-loading')).toBeHidden({ timeout: TIMEOUT });
  // Lesson selection is fixture setup; the checks below use the real controls.
  await page.evaluate(async step => window._tutorial.loadStep(step), index);
}

async function editorText(page, path) {
  return page.evaluate(target => window._tutorial.editorModels[target].model.getValue(), path);
}

test('each starter fails its checks and the model solution passes them in Pyodide', async ({ page }) => {
  test.setTimeout(420_000);
  await openLesson(page, 0);
  for (const [index, step] of config.steps.entries()) {
    await test.step(step.title, async () => {
      await page.evaluate(async target => window._tutorial.loadStep(target), index);
      await page.getByRole('button', { name: /Test My Work/ }).click();
      const starterSummary = new RegExp(`^${STARTER_PASSES[step.key]}\\s*/\\s*${step.tests.length} tests passed$`);
      await expect(page.getByText(starterSummary)).toBeVisible({ timeout: TIMEOUT });
      await applySolution(page);
      await page.getByRole('button', { name: /Test My Work/ }).click();
      await expect(page.getByText(`✅ All ${step.tests.length} tests passed!`, { exact: true }))
        .toBeVisible({ timeout: TIMEOUT });
    });
  }
});

test('a learner who misses one question still passes every knowledge check', async ({ page }) => {
  test.setTimeout(420_000);
  await openLesson(page, 0);
  for (const [index, step] of config.steps.entries()) {
    await test.step(step.title, async () => {
      await page.evaluate(async target => window._tutorial.loadStep(target), index);
      await applySolution(page);
      await page.getByRole('button', { name: /Test My Work/ }).click();
      await expect(page.getByText(`✅ All ${step.tests.length} tests passed!`, { exact: true }))
        .toBeVisible({ timeout: TIMEOUT });
      await page.getByRole('button', { name: 'Next →', exact: true }).click();
      await answerQuiz(page, { wrongSingleAnswers: 1 });
      const passed = index === config.steps.length - 1
        ? 'Tutorial complete — great job!'
        : "Great job! You're ready for the next step.";
      await expect(page.getByText(passed, { exact: true })).toBeVisible();
    });
  }
});

test('the toolbar Test runs the team suite and the regression tests from the nested package', async ({ page }) => {
  test.setTimeout(180_000);
  await openLesson(page, stepIndex('green-bar'));
  const output = page.getByRole('region', { name: 'Program output', exact: true });
  await page.getByRole('button', { name: /^▶\s+Test$/ }).click();
  await expect(output).toContainText(/1 failed, 12 passed/, { timeout: TIMEOUT });
  await expect(output).toContainText('test_new_ticket_does_not_overwrite_existing');

  await applySolution(page);
  await page.getByRole('button', { name: /^▶\s+Test$/ }).click();
  await expect(output).toContainText(/14 passed/, { timeout: TIMEOUT });
});

test('a repair stays in its lesson while the code map follows the learner', async ({ page }) => {
  test.setTimeout(180_000);
  const reproduce = stepIndex('reproduce');
  await openLesson(page, reproduce);
  const edited = `${starterFile('reproduce', 'helpdesk/service.py')}\n# learner note\n`;
  expect(await setTutorialFileContent(page, 'helpdesk/service.py', edited)).toBe(true);
  const notes = `${starterFile('reproduce', 'code_map.md')}- save() is called after every change\n`;
  expect(await setTutorialFileContent(page, 'code_map.md', notes)).toBe(true);

  await page.evaluate(async step => window._tutorial.loadStep(step), reproduce + 1);
  expect(await editorText(page, 'helpdesk/service.py'))
    .toBe(starterFile(config.steps[reproduce + 1].key, 'helpdesk/service.py'));
  expect(await editorText(page, 'code_map.md')).toBe(notes);
  await page.evaluate(async step => window._tutorial.loadStep(step), reproduce);
  expect(await editorText(page, 'helpdesk/service.py')).toBe(edited);
});

test('every live lesson states its purpose and objectives before the exercise', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await openLesson(page, 0);
  for (let index = 0; index < config.steps.length; index++) {
    await page.evaluate(async step => window._tutorial.loadStep(step), index);
    await expect(page.getByRole('heading', { name: 'Why this matters', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '🎯 You will learn to', exact: true })).toBeVisible();
    await a11yCheckpoint(page, `Repository debugging lesson ${index + 1}`, {
      feature: 'repo-debugging', include: '.tvm-step-instructions',
    });
  }
  expect(errors).toEqual([]);
});

test('the student print view renders every lesson in light mode with solutions hidden', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => { document.cookie = 'dark-mode=true; path=/'; });
  await page.goto(`${URL}/print`);
  await expect(page.locator('html')).not.toHaveClass(/dark-mode/);
  await expect(page.getByRole('heading', { name: 'Why this matters', exact: true })).toHaveCount(config.steps.length);
  await expect(page.getByRole('heading', { name: '🎯 You will learn to', exact: true })).toHaveCount(config.steps.length);
  await expect(page.getByRole('heading', { name: 'Solution', exact: true })).toHaveCount(0);
  for (const step of config.steps) {
    await expect(page.getByRole('heading', { name: step.title, exact: true })).toBeVisible();
  }
  // A file identical to the previous lesson's copy prints as a note, not again in full.
  const contentAt = (step, path) => step.files.find(file => file.path === path).content;
  for (const path of ['helpdesk/api.py', 'helpdesk/service.py']) {
    const repeats = config.steps.slice(1)
      .filter((step, index) => contentAt(step, path) === contentAt(config.steps[index], path)).length;
    const note = new RegExp(`^${path.replace(/[./]/g, '\\$&')} is unchanged from step \\d+\\.$`);
    await expect(page.getByText(note)).toHaveCount(repeats);
  }
  await a11yCheckpoint(page, 'Repository debugging print instructions', {
    feature: 'repo-debugging', include: '.step-instructions', darkMode: false,
  });
  expect(errors).toEqual([]);
});
