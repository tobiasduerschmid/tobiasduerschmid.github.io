// @ts-check
const { test, expect } = require('@playwright/test');
const {
  loadTutorialConfig,
  waitForTutorialReady,
  setEditorContent,
  expectActiveStep,
  expectStepCount,
} = require('./tutorial-helpers');
const { a11yCheckpoint } = require('./a11y-helpers');

const COURSES = ['prolog', 'prolog-search'];
const RUN_TIMEOUT = 30_000;
const runButton = page => page.getByRole('button', { name: /run$/i });
const testButton = page => page.getByRole('button', { name: /test my work/i });
const nextButton = page => page.getByRole('button', { name: /^Next/ });
const output = page => page.getByRole('region', { name: 'Program output' });
const queryInput = page => page.getByRole('textbox', { name: 'Query (Prolog goal)' });

async function openTutorial(page, id) {
  await page.goto(`/SEBook/tools/${id}-tutorial`);
  await waitForTutorialReady(page);
  await expect(queryInput(page)).toBeVisible();
  await expect(runButton(page)).toBeEnabled();
}

async function runQuery(page, goal) {
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await queryInput(page).fill(goal);
  await runButton(page).click();
  await expect(runButton(page)).toBeEnabled({ timeout: RUN_TIMEOUT });
}

function plainText(markdown) {
  return markdown.replace(/`/g, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\s+/g, ' ').trim();
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function optionFor(page, question, index) {
  const name = new RegExp('^[A-Z]\\s*' + escapeRegex(plainText(question.options[index])) + '$');
  return page.getByRole(question.type === 'multiple' ? 'checkbox' : 'radio', { name });
}

function parsonsLine(page, line) {
  return page.getByRole('button', {
    name: new RegExp('^Line \\d+:\\s*' + escapeRegex(plainText(line)) + '$'),
  });
}

// Authored answers supply test input; interaction uses the same accessible
// controls as a learner, including keyboard movement for Parsons problems.
async function answerAuthoredQuiz(page, quiz) {
  const unanswered = new Set(quiz.questions);
  while (unanswered.size) {
    let question;
    for (const candidate of unanswered) {
      const choices = candidate.type === 'parsons'
        ? candidate.lines.map(line => parsonsLine(page, line))
        : candidate.options.map((_, index) => optionFor(page, candidate, index));
      const visible = await Promise.all(choices.map(choice => choice.isVisible()));
      if (visible.every(Boolean)) {
        question = candidate;
        break;
      }
    }
    expect(question, 'the visible knowledge check must match an authored question').toBeTruthy();
    if (question.type === 'parsons') {
      for (const line of question.lines) await parsonsLine(page, line).press('Space');
      await page.getByRole('button', { name: 'Check Order', exact: true }).click();
    } else if (question.type === 'multiple') {
      for (const index of question.correct_indices) await optionFor(page, question, index).click();
      await page.getByRole('button', { name: 'Submit Answer', exact: true }).click();
    } else {
      await optionFor(page, question, question.correct_index).click();
    }
    unanswered.delete(question);
    await page.getByRole('button', {
      name: unanswered.size ? 'Next Question' : 'See Results', exact: true,
    }).click();
  }
  await expect(page.getByText(new RegExp('^Your Score:\\s*' + quiz.questions.length + '\\s*/\\s*' + quiz.questions.length + '$')))
    .toBeVisible();
}

for (const id of COURSES) {
  const config = loadTutorialConfig(id);
  test.describe(config.title, () => {
    test('a learner completes every coding exercise and knowledge check, including the final check', async ({ page }) => {
      test.setTimeout(300_000);
      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(error.message));
      await openTutorial(page, id);
      await expectStepCount(page, config.steps.length);
      if (config.require_tests) await expect(nextButton(page)).toBeDisabled();
      else await expect(nextButton(page)).toBeEnabled();

      // A starter fails diagnostic checks even when navigation is optional.
      await testButton(page).click();
      await expect(page.getByRole('status').filter({ hasText: /of \d+ tests passed/ }))
        .toContainText(/0 of \d+ tests passed/, { timeout: RUN_TIMEOUT });
      if (config.require_tests) await expect(nextButton(page)).toBeDisabled();
      else await expect(nextButton(page)).toBeEnabled();

      for (const [index, step] of config.steps.entries()) {
        await expectActiveStep(page, index);
        await expect(page.getByRole('heading', { name: step.title, exact: true })).toBeVisible();
        await expect(queryInput(page)).toHaveValue(step.default_query);
        // Monaco's supported model API supplies learner edits; the verdict is
        // observed through the same controls and status messages learners use.
        const entry = step.solution.files.find(file => file.path === step.run_file);
        expect(await setEditorContent(page, entry.content)).toBe(true);
        await testButton(page).click();
        await expect(page.getByRole('status').filter({ hasText: /^All \d+ tests? passed\./ }))
          .toHaveText(`All ${step.tests.length} ${step.tests.length === 1 ? 'test' : 'tests'} passed.`, { timeout: RUN_TIMEOUT });
        await a11yCheckpoint(page, `${id}: step ${index + 1} passing`, {
          feature: 'prolog-tutorial', darkMode: true,
        });
        await nextButton(page).click();
        await a11yCheckpoint(page, `${id}: step ${index + 1} knowledge check`, {
          feature: 'prolog-tutorial', darkMode: true,
        });
        await answerAuthoredQuiz(page, step.quiz);
        if (index < config.steps.length - 1) {
          await page.getByRole('button', { name: /continue/i }).click();
        }
      }
      if (config.require_quiz === false) {
        await page.getByRole('button', { name: 'Finish Review', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Review Finished', exact: true })).toBeVisible();
      } else {
        await expect(page.getByRole('status').filter({ hasText: /Tutorial Complete/i })).toBeVisible();
      }
      await a11yCheckpoint(page, `${id}: completed`, { feature: 'prolog-tutorial', darkMode: true });
      expect(pageErrors).toEqual([]);
    });

    test('print views include every lesson and keep code solutions instructor-only', async ({ page }) => {
      await page.goto(`/SEBook/tools/${id}-tutorial/print`);
      await expect(page).toHaveTitle(`${config.title} — Print View`);
      for (const step of config.steps) {
        await expect(page.getByRole('heading', { name: new RegExp(step.title) })).toBeVisible();
        await expect(page.getByRole('heading', { name: step.quiz.title, exact: true })).toBeVisible();
      }
      await expect(page.getByRole('heading', { name: 'Solution', exact: true })).toHaveCount(0);
      await a11yCheckpoint(page, `${id}: learner print view`, { feature: 'prolog-tutorial' });
      await page.goto(`/SEBook/tools/${id}-tutorial/print?instructor-mode=true`);
      await expect(page.getByRole('heading', { name: 'Solution', exact: true })).toHaveCount(config.steps.length);
      await a11yCheckpoint(page, `${id}: instructor print view`, { feature: 'prolog-tutorial' });
    });
  });
}

test('queries run edited facts, distinguish failure from errors, and recover after invalid source', async ({ page }) => {
  await openTutorial(page, 'prolog');
  expect(await setEditorContent(page, 'parent(tom, bob).')).toBe(true);
  await runQuery(page, 'parent(Who, bob)');
  await expect(output(page)).toContainText(/Who\s*=\s*tom/);
  await runQuery(page, 'parent(bob, tom)');
  await expect(output(page)).toContainText('false.');
  expect(await setEditorContent(page, 'parent(tom, bob')).toBe(true);
  await runQuery(page, 'parent(tom, Who)');
  await expect(output(page)).toContainText(/error/i);
  expect(await setEditorContent(page, 'parent(tom, mia).')).toBe(true);
  await runQuery(page, 'parent(tom, Who)');
  await expect(output(page)).toContainText(/Who\s*=\s*mia/);
  await expect(output(page)).not.toContainText(/error/i);
  await queryInput(page).focus();
  await expect(queryInput(page)).toBeFocused();
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(output(page)).toBeEmpty();
});

function savedPrologProgress(page) {
  // Tutorial exports are the public persistence contract shared with SE Gym.
  return page.evaluate(() => JSON.parse(localStorage.getItem('tutorial-progress-prolog')));
}

test('Prolog review can skip and fail checks without recording passes, including after reload', async ({ page }) => {
  const config = loadTutorialConfig('prolog');
  await page.goto('/SEBook/tools/prolog-tutorial?autosave=true');
  await waitForTutorialReady(page);
  await expect(nextButton(page)).toBeEnabled();
  await testButton(page).click();
  await expect(page.getByRole('status').filter({ hasText: /of \d+ tests passed/ }))
    .toContainText(/0 of \d+ tests passed/, { timeout: RUN_TIMEOUT });
  await nextButton(page).click();
  await page.getByRole('button', { name: 'Skip Knowledge Check', exact: true }).press('Enter');
  await expectActiveStep(page, 1);

  const lastStep = config.steps.length - 1;
  await page.getByRole('button', { name: new RegExp('^Step ' + (lastStep + 1) + ':') }).click();
  await expectActiveStep(page, lastStep);
  await nextButton(page).click();
  await page.getByRole('button', { name: 'Skip Knowledge Check', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Review Finished', exact: true })).toBeVisible();
  await expect.poll(async () => (await savedPrologProgress(page)).step).toBe(lastStep);
  let progress = await savedPrologProgress(page);
  expect(progress.stepsPassed).toEqual([]);
  expect(progress.quizPassed).toEqual([]);
  await page.reload();
  await waitForTutorialReady(page);
  await expectActiveStep(page, lastStep);
  await nextButton(page).click();
  await expect(page.getByRole('button', { name: 'Skip Knowledge Check', exact: true })).toBeVisible();
  progress = await savedPrologProgress(page);
  expect(progress.stepsPassed).toEqual([]);
  expect(progress.quizPassed).toEqual([]);
  await a11yCheckpoint(page, 'Prolog optional review after reload', { feature: 'prolog-tutorial', darkMode: true });
});

test('the replacement preserves legacy drafts without giving old completion credit to new lessons', async ({ page }) => {
  const config = loadTutorialConfig('prolog');
  const files = {
    'family.pl': { content: 'parent(my_saved_parent,my_saved_child).\n', language: 'prolog' },
    'my-notes.pl': { content: '% My independent study notes.\n', language: 'prolog' },
  };
  await page.goto('/');
  await page.evaluate(files => {
    localStorage.setItem('tutorial-progress-prolog', JSON.stringify({
      step: 7, activeFile: 'game-night.pl', files,
      stepsPassed: [0, 1, 2, 3, 4, 5, 6, 7],
      quizPassed: [0, 1, 2, 3, 4, 5, 6, 7],
      stepsVisited: [0, 1, 2, 3, 4, 5, 6, 7],
      stepsUnlocked: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    }));
  }, files);
  await page.goto('/SEBook/tools/prolog-tutorial?autosave=true');
  await waitForTutorialReady(page);
  await expectActiveStep(page, 0);
  await expect(page.getByRole('status', { name: 'Saved progress update' }))
    .toContainText('Your saved code has been preserved');
  await expect.poll(async () => (await savedPrologProgress(page)).progressVersion).toBe(config.progress_version);
  let progress = await savedPrologProgress(page);
  expect(progress.files).toMatchObject(files);
  expect(progress.stepsPassed).toEqual([]);
  expect(progress.quizPassed).toEqual([]);

  await page.getByRole('button', { name: /^Step 2:/ }).click();
  await expectActiveStep(page, 1);
  await page.reload();
  await waitForTutorialReady(page);
  await expectActiveStep(page, 1);
  await expect(page.getByRole('status', { name: 'Saved progress update' })).toHaveCount(0);
  progress = await savedPrologProgress(page);
  expect(progress.files).toMatchObject(files);
  expect(progress.stepsPassed).toEqual([]);
  expect(progress.quizPassed).toEqual([]);
});

test('a learner can stop an endless collected search and run repaired code', async ({ page }) => {
  await openTutorial(page, 'prolog');
  expect(await setEditorContent(page, 'spin :- spin.')).toBe(true);
  await queryInput(page).fill('findall(X, spin, Answers)');
  await runButton(page).click();
  const stopButton = page.getByRole('button', { name: /Stop$/ });
  await expect(stopButton).toBeVisible();
  await stopButton.click();
  await expect(output(page)).toContainText('Execution stopped');
  await expect(runButton(page)).toBeEnabled({ timeout: RUN_TIMEOUT });
  expect(await setEditorContent(page, 'parent(tom, mia).')).toBe(true);
  await runQuery(page, 'parent(tom, Child)');
  await expect(output(page)).toContainText(/Child\s*=\s*mia/);
  await a11yCheckpoint(page, 'Prolog: recovered after Stop', { feature: 'prolog-tutorial', darkMode: true });
});

test('Run and Test My Work use the designated Prolog entry while a different file is open', async ({ page }) => {
  await openTutorial(page, 'prolog');
  // Configure a small two-file tutorial through its author-facing constructor.
  // This fixture is not a mock: it uses the real editor, worker, and grading UI.
  await page.evaluate(async () => {
    window._tutorial.destroy();
    window._tutorial = new window.TutorialCode('#tutorial-container', {
      backend: 'prolog', tutorialId: 'prolog-entry-file-test', requireTests: true,
      autosaveType: 'none', disableQuiz: true,
      steps: [{
        title: 'Entry File Selection', instructions: 'Run the designated entry file.',
        files: [
          { path: '/tutorial/entry.pl', language: 'prolog', content: 'choice(entry).' },
          { path: 'notes.pl', language: 'prolog', content: 'choice(notes).' },
        ],
        run_file: 'entry.pl', open_file: '/tutorial/notes.pl',
        default_query: 'choice(Value)',
        tests: [{ description: 'The entry relation is consulted',
          command: "assert((await __query('findall(X,choice(X),Xs), Xs == [entry].')).length === 1, 'The entry file should supply the relation.');" }],
      }],
    });
    await window._tutorial.start();
  });
  await expect(page.getByRole('button', { name: 'notes.pl', exact: true })).toBeVisible();
  await runButton(page).click();
  await expect(output(page)).toContainText(/Value\s*=\s*entry/, { timeout: RUN_TIMEOUT });
  await expect(output(page)).not.toContainText('notes');
  await testButton(page).click();
  await expect(page.getByRole('status').filter({ hasText: /^All 1 test passed\./ }))
    .toHaveText('All 1 test passed.', { timeout: RUN_TIMEOUT });
});
