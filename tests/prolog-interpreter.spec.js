// @ts-check
const { test, expect } = require('@playwright/test');
const { loadTutorialConfig, waitForTutorialReady } = require('./tutorial-helpers');
const { a11yCheckpoint } = require('./a11y-helpers');

const RUN_TIMEOUT = 30_000;
const firstFile = loadTutorialConfig('prolog').steps[0].run_file;
const queryInput = interpreter => interpreter.getByRole('textbox', { name: 'Prolog query', exact: true });
const transcript = interpreter => interpreter.getByRole('log', { name: 'Prolog interpreter transcript' });

async function openInterpreter(page) {
  await page.goto('/SEBook/tools/prolog-tutorial');
  await waitForTutorialReady(page);
  await page.getByRole('button', { name: 'Interpreter', exact: true }).click();
  const interpreter = page.getByRole('region', { name: 'Prolog interpreter', exact: true });
  await expect(queryInput(interpreter)).toBeFocused();
  return interpreter;
}

async function editSourceWithoutSaving(page, source) {
  // The supported Monaco model API only supplies learner edits. Evaluation
  // must synchronize and consult these current edits through the real UI.
  await page.evaluate(({ source, filename }) => {
    const model = window.monaco.editor.getModels().find(model => model.uri.path.endsWith('/' + filename));
    if (!model) throw new Error('The first Prolog lesson must be open in the editor');
    model.setValue(source);
  }, { source, filename: firstFile });
}

async function submitQuery(interpreter, goal) {
  const input = queryInput(interpreter);
  await input.fill(goal);
  await input.press('Enter');
  await expect(input).toBeEditable({ timeout: RUN_TIMEOUT });
}

test('the interpreter accepts consecutive queries and collects all answers in its transcript', async ({ page }) => {
  const interpreter = await openInterpreter(page);
  const input = queryInput(interpreter);
  const log = transcript(interpreter);
  await editSourceWithoutSaving(page, 'parent(tom, bob).\nparent(tom, mia).\n');

  await submitQuery(interpreter, 'parent(tom, bob)');
  await expect(log.getByText(/^true\.?$/)).toBeVisible();
  await expect(input).toBeFocused();
  await submitQuery(interpreter, 'parent(bob, tom).');
  await expect(log.getByText('false.', { exact: true })).toBeVisible();
  await submitQuery(interpreter, 'parent(tom, Child)');
  await expect(log).toContainText(/Child\s*=\s*bob[\s\S]*Child\s*=\s*mia/);
  await expect(log.getByText(/^true\.?$/)).toBeVisible();
  await expect(log.getByText('false.', { exact: true })).toBeVisible();
  await expect(input).toHaveValue('');
  await expect(input).toBeFocused();
  await input.press('Tab');
  await expect(interpreter.getByRole('button', { name: 'Evaluate query', exact: true })).toBeFocused();
  await a11yCheckpoint(page, 'Prolog interpreter — successful and failed queries', {
    feature: 'prolog-interpreter', darkMode: true,
  });
});

test('each query consults current editor changes and recovers after source and query errors', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const interpreter = await openInterpreter(page);
  const log = transcript(interpreter);
  await editSourceWithoutSaving(page, 'parent(tom, bob).');
  await submitQuery(interpreter, 'parent(tom, Child)');
  await expect(log).toContainText(/Child\s*=\s*bob/);

  await editSourceWithoutSaving(page, 'parent(tom, mia).');
  await submitQuery(interpreter, 'parent(tom, Child)');
  await expect(log).toContainText(/Child\s*=\s*mia/);
  await submitQuery(interpreter, 'parent(');
  await expect(log).toContainText(/syntax|error/i);
  await interpreter.getByRole('button', { name: 'Clear transcript', exact: true }).click();
  await editSourceWithoutSaving(page, 'parent(tom, mia');
  await submitQuery(interpreter, 'parent(tom, Child)');
  await expect(log).toContainText(/syntax|error/i);
  await a11yCheckpoint(page, 'Prolog interpreter — source diagnostic', {
    feature: 'prolog-interpreter', darkMode: true,
  });

  await editSourceWithoutSaving(page, 'parent(tom, jo).');
  await submitQuery(interpreter, 'parent(tom, Child)');
  await expect(log).toContainText(/Child\s*=\s*jo/);
  expect(pageErrors, 'query errors must be learner feedback, not uncaught browser exceptions').toEqual([]);
});

test('query side effects do not add facts to the next freshly consulted query', async ({ page }) => {
  const interpreter = await openInterpreter(page);
  const log = transcript(interpreter);
  await editSourceWithoutSaving(page, ':- dynamic(temporary/1).\ntemporary(original).\n');
  await submitQuery(interpreter, 'assertz(temporary(added)), temporary(added)');
  await expect(log.getByText(/^true\.?$/)).toBeVisible();

  await submitQuery(interpreter, 'temporary(added)');

  await expect(log.getByText('false.', { exact: true })).toBeVisible();
});

test('query history restores unfinished input and clearing keeps history available', async ({ page }) => {
  const interpreter = await openInterpreter(page);
  const input = queryInput(interpreter);
  const log = transcript(interpreter);
  await submitQuery(interpreter, 'X is 6 * 7');
  await expect(log).toContainText(/X\s*=\s*42/);
  await submitQuery(interpreter, 'Y is 9 + 1');
  await expect(log).toContainText(/Y\s*=\s*10/);

  await input.fill('unfinished query');
  await input.press('ArrowUp');
  await expect(input).toHaveValue('Y is 9 + 1');
  await interpreter.getByRole('button', { name: 'Previous query', exact: true }).click();
  await expect(input).toHaveValue('X is 6 * 7');
  await interpreter.getByRole('button', { name: 'Next query', exact: true }).click();
  await expect(input).toHaveValue('Y is 9 + 1');
  await input.press('ArrowDown');
  await expect(input).toHaveValue('unfinished query');

  await input.press('Control+l');
  await expect(log).not.toContainText('42');
  await expect(log).not.toContainText('10');
  await input.press('ArrowUp');
  await expect(input).toHaveValue('Y is 9 + 1');
  await input.press('Enter');
  await expect(log).toContainText(/Y\s*=\s*10/);
  await interpreter.getByRole('button', { name: 'Clear transcript', exact: true }).click();
  await expect(log).not.toContainText('10');
});

test('Control+C preserves selected query text for copying and cancels unselected input', async ({ page }) => {
  const interpreter = await openInterpreter(page);
  const input = queryInput(interpreter);
  await input.fill('member(Item, [a,b])');
  await input.press('ControlOrMeta+a');
  await input.press('Control+c');
  await expect(input).toHaveValue('member(Item, [a,b])');
  await expect(transcript(interpreter)).not.toContainText('^C');

  await input.press('ArrowRight');
  await input.press('Control+c');

  await expect(input).toHaveValue('');
  await expect(input).toBeFocused();
  await expect(transcript(interpreter)).toContainText('^C');
});

for (const stopMethod of ['Stop evaluation', 'Control+C']) {
  test(`${stopMethod} stops an endless collected search and permits a fresh query`, async ({ page }) => {
    const interpreter = await openInterpreter(page);
    const input = queryInput(interpreter);
    await editSourceWithoutSaving(page, 'spin :- spin.');
    await input.fill('findall(X, spin, Answers)');
    await interpreter.getByRole('button', { name: 'Evaluate query', exact: true }).click();
    await expect(input).not.toBeEditable();
    await expect(interpreter.getByRole('button', { name: 'Stop evaluation', exact: true })).toBeEnabled();

    if (stopMethod === 'Control+C') await input.press('Control+c');
    else await interpreter.getByRole('button', { name: 'Stop evaluation', exact: true }).press('Enter');

    await expect(input).toBeEditable({ timeout: RUN_TIMEOUT });
    await expect(input).toBeFocused();
    await expect(transcript(interpreter)).toContainText('Evaluation stopped');
    await editSourceWithoutSaving(page, 'parent(tom, mia).');
    await submitQuery(interpreter, 'parent(tom, Child)');
    await expect(transcript(interpreter)).toContainText(/Child\s*=\s*mia/);
    await a11yCheckpoint(page, 'Prolog interpreter — stopped and recovered', {
      feature: 'prolog-interpreter', darkMode: true,
    });
  });
}

test('the interpreter prompt stays reachable and usable on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  const interpreter = await openInterpreter(page);
  const input = queryInput(interpreter);
  await input.scrollIntoViewIfNeeded();
  await expect(input).toBeInViewport({ ratio: 1 });
  await submitQuery(interpreter, 'X is 7 * 6');
  await expect(transcript(interpreter)).toContainText(/X\s*=\s*42/);
  await a11yCheckpoint(page, 'Prolog interpreter — narrow layout', {
    feature: 'prolog-interpreter', darkMode: true,
  });
});

test('changing steps interrupts an endless interpreter query and Run uses the new step', async ({ page }) => {
  const interpreter = await openInterpreter(page);
  const input = queryInput(interpreter);
  await editSourceWithoutSaving(page, 'spin :- spin.');
  await input.fill('findall(X, spin, Answers)');
  await input.press('Enter');
  await expect(input).not.toBeEditable();

  await page.getByRole('button', { name: /^Step 2:/ }).click();

  await expect(page.getByRole('button', { name: /^Step 2:/ })).toHaveAttribute('aria-current', 'step');
  await expect(input).toBeEditable({ timeout: RUN_TIMEOUT });
  await expect(transcript(interpreter)).toContainText('Evaluation stopped');
  const runButton = page.getByRole('button', { name: /run$/i });
  await expect(runButton).toBeEnabled();
  await runButton.click();
  await expect(page.getByRole('region', { name: 'Program output' }))
    .toContainText(/Rate\s*=\s*44100/, { timeout: RUN_TIMEOUT });
  await expect(interpreter).toBeHidden();
});

test('an output popout keeps the interpreter usable and reattaches the lesson output', async ({ page }) => {
  const interpreter = await openInterpreter(page);
  const input = queryInput(interpreter);
  await editSourceWithoutSaving(page, 'spin :- spin.\ncue(lesson_default, left).');
  // Collecting a large finite answer set leaves time to open the other window;
  // a recursive failure can hit the per-answer inference limit before it loads.
  await input.fill('findall(X, between(1, 10000000, X), Answers)');
  await input.press('Enter');
  await expect(input).not.toBeEditable();
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: /Open output in separate window/ }).click(),
  ]);
  const runButton = popup.getByRole('button', { name: 'Run current file', exact: true });
  const stopButton = popup.getByRole('button', { name: 'Stop execution', exact: true });
  await expect(runButton).toBeDisabled();
  await expect(stopButton).toBeVisible();
  await expect(interpreter).toBeVisible();

  await stopButton.click();

  await expect(runButton).toBeEnabled({ timeout: RUN_TIMEOUT });
  await expect(stopButton).toBeHidden();
  await expect(input).toBeEditable();
  await submitQuery(interpreter, 'X is 6 * 7');
  await expect(transcript(interpreter)).toContainText(/X\s*=\s*42/);
  await expect(runButton).toBeEnabled();
  await runButton.click();
  await expect(popup.getByRole('main', { name: 'Tutorial output popout' }))
    .toContainText(/Clip\s*=\s*lesson_default/, { timeout: RUN_TIMEOUT });
  await expect(runButton).toBeEnabled();
  await expect(stopButton).toBeHidden();
  await expect(page.getByText(/Output is open in a separate window/)).toBeVisible();
  const reattach = page.getByRole('button', { name: 'Reattach Output', exact: true });
  await expect(reattach).toBeVisible();
  await a11yCheckpoint(page, 'Prolog interpreter — output detached notice', {
    feature: 'prolog-interpreter', darkMode: true,
  });
  await a11yCheckpoint(popup, 'Prolog output popout — interpreter stopped and default query run', {
    feature: 'prolog-interpreter', darkMode: true,
  });
  await Promise.all([popup.waitForEvent('close'), reattach.click()]);
  await expect(page.getByRole('button', { name: 'Output', exact: true })).toBeFocused();
  const mainOutput = page.getByRole('region', { name: 'Program output' });
  await expect(mainOutput).toBeVisible();
  await page.getByRole('button', { name: /run$/i }).click();
  await expect(mainOutput).toContainText(/Clip\s*=\s*lesson_default/, { timeout: RUN_TIMEOUT });
  await a11yCheckpoint(page, 'Prolog interpreter — output reattached', {
    feature: 'prolog-interpreter', darkMode: true,
  });
});

test('grading waits for interpreter execution and keeps its output out of the transcript', async ({ page }) => {
  await page.goto('/SEBook/tools/prolog-tutorial');
  await waitForTutorialReady(page);
  // A real author-facing fixture makes grader output distinguishable from
  // interpreter output while retaining the actual worker and grading UI.
  await page.evaluate(async () => {
    window._tutorial.destroy();
    window._tutorial = new window.TutorialCode('#tutorial-container', {
      backend: 'prolog', tutorialId: 'prolog-execution-isolation', autosaveType: 'none', disableQuiz: true,
      steps: [{
        title: 'Execution isolation', instructions: 'Test the relation after querying it.',
        files: [{ path: 'isolation.pl', language: 'prolog', content: 'spin :- spin.\nvalue(ready).' }],
        run_file: 'isolation.pl', default_query: 'value(Value)',
        tests: [{ description: 'The relation is ready',
          command: "assert((await __query('write(grader_marker), nl, value(ready).')).length === 1, 'Expected value(ready).');" }],
      }],
    });
    await window._tutorial.start();
  });
  await page.getByRole('button', { name: 'Interpreter', exact: true }).click();
  const interpreter = page.getByRole('region', { name: 'Prolog interpreter', exact: true });
  const input = queryInput(interpreter);
  const log = transcript(interpreter);
  const testButton = page.getByRole('button', { name: /test my work/i });
  await input.fill('findall(X, between(1, 10000000, X), Answers)');
  await input.press('Enter');
  await expect(input).not.toBeEditable();
  await testButton.click();
  await expect(testButton).toBeEnabled();
  await expect(input).not.toBeEditable();
  await interpreter.getByRole('button', { name: 'Stop evaluation', exact: true }).click();
  await expect(input).toBeEditable({ timeout: RUN_TIMEOUT });
  const queryHistory = await log.innerText();

  await testButton.click();

  await expect(page.getByRole('status').filter({ hasText: /^All 1 test passed\./ }))
    .toHaveText('All 1 test passed.', { timeout: RUN_TIMEOUT });
  await expect(log).toHaveText(queryHistory, { useInnerText: true });
  await page.getByRole('button', { name: 'Output', exact: true }).click();
  const output = page.getByRole('region', { name: 'Program output' });
  await expect(output).toContainText('grader_marker');
  await page.getByRole('button', { name: 'Interpreter', exact: true }).click();
  await submitQuery(interpreter, 'write(learner_marker), nl');
  await expect(log).toContainText('learner_marker');
  await expect(log).not.toContainText('grader_marker');
  await page.getByRole('button', { name: 'Output', exact: true }).click();
  await expect(output).not.toContainText('learner_marker');
});
