// @ts-check
const { test, expect } = require('@playwright/test');
const { loadTutorialConfig, applySolution, setTutorialFileContent } = require('./tutorial-helpers');
const { a11yCheckpoint } = require('./a11y-helpers');

const URL = '/SEBook/tools/python-debugging';
const config = loadTutorialConfig('python-debugging');
const TIMEOUT = 60_000;
const historySlider = page => page.getByRole('slider', { name: 'Execution history position' });

function lineContaining(stepIndex, file, text) {
  const source = config.steps[stepIndex].files.find(entry => entry.path === file).content;
  const line = source.split('\n').findIndex(value => value.includes(text)) + 1;
  if (!line) throw new Error(`Missing lesson anchor ${file}: ${text}`);
  return line;
}

async function openLesson(page, index, breakpoints = []) {
  // Restore the same persisted breakpoint records a returning learner uses.
  await page.addInitScript(records => {
    localStorage.setItem('tutorial-debug-bps-python-debugging', JSON.stringify(records));
  }, breakpoints);
  await page.goto(`${URL}?instructor-mode=true&autosave=false`);
  await expect(page.getByRole('button', { name: 'Start debugger', exact: true })).toBeEnabled({ timeout: TIMEOUT });
  await expect(page.locator('.tvm-loading')).toBeHidden({ timeout: TIMEOUT });
  // Lesson selection is fixture setup; the investigations below use the real UI
  // and the repository's Python debugger rather than a simulated trace.
  await page.evaluate(async step => {
    await window._tutorial.loadStep(step);
  }, index);
  await page.getByRole('button', { name: /\bDebug$/ }).click();
}

async function addWatch(page, expression) {
  await page.getByRole('textbox', { name: 'Watch expression', exact: true }).fill(expression);
  await page.getByRole('button', { name: '+ Add', exact: true }).click();
}

function watchValue(page, expression, value) {
  // A watch row has no separate accessible role. Match the displayed expression
  // and value together, avoiding implementation-specific class selectors.
  return page.getByText(`${expression}→${value}`, { exact: true });
}

async function startAtBreakpoint(page, filename, line) {
  await page.getByRole('button', { name: 'Start debugger', exact: true }).click();
  const proceed = page.getByRole('button', { name: 'Continue', exact: true });
  await expect(proceed).toBeEnabled({ timeout: TIMEOUT });
  await proceed.click();
  await expect(page.getByText(`paused at breakpoint at ${filename}:${line}`, { exact: true }))
    .toBeVisible({ timeout: TIMEOUT });
}

async function seekFirstWatchValue(page, expression, value) {
  const slider = historySlider(page);
  const maximum = Number(await slider.getAttribute('max'));
  await slider.press('Home');
  for (let position = 0; position <= maximum; position++) {
    if (await watchValue(page, expression, value).count()) return;
    if (position < maximum) await slider.press('ArrowRight');
  }
  await expect(watchValue(page, expression, value), 'the recorded trace contains the requested state marker').toBeVisible();
}

test('the forward tour reaches a negative score with a conditional breakpoint', async ({ page }) => {
  test.setTimeout(120_000);
  const line = lineContaining(1, 'tour.py', 'total += score');
  await openLesson(page, 1, [{ path: '/tutorial/tour.py', line }]);
  await addWatch(page, 'score');
  await addWatch(page, 'total');
  await startAtBreakpoint(page, 'tour.py', line);
  await expect(watchValue(page, 'score', '8')).toBeVisible();
  await expect(watchValue(page, 'total', '0')).toBeVisible();

  // The ordinary manager button provides keyboard access to condition editing.
  const edit = page.getByRole('button', { name: 'Edit condition', exact: true });
  await edit.focus();
  await edit.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Breakpoint Condition', exact: true });
  await dialog.getByRole('textbox', { name: 'Python expression', exact: true }).fill('score < 0');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(watchValue(page, 'score', '-5')).toBeVisible({ timeout: TIMEOUT });
  await expect(watchValue(page, 'total', '11')).toBeVisible();
  await page.getByRole('button', { name: 'Step Over', exact: true }).click();
  await expect(watchValue(page, 'total', '6')).toBeVisible({ timeout: TIMEOUT });
});

test('the backward tour retains an end-state anchor and distinguishes events from trace ticks', async ({ page }) => {
  test.setTimeout(120_000);
  const line = lineContaining(4, 'counter.py', 'return state');
  await openLesson(page, 4, [{ path: '/tutorial/counter.py', line }]);
  await addWatch(page, 'state["count"]');
  await addWatch(page, 'len(state["history"])');
  await startAtBreakpoint(page, 'counter.py', line);
  await expect(watchValue(page, 'state["count"]', '2')).toBeVisible();
  await expect(watchValue(page, 'len(state["history"])', '8')).toBeVisible();
  expect(Number(await historySlider(page).getAttribute('max')),
    'one domain event produces multiple trace snapshots').toBeGreaterThan(8);

  await seekFirstWatchValue(page, 'len(state["history"])', '3');
  await expect(watchValue(page, 'state["count"]', '-4')).toBeVisible();
  await seekFirstWatchValue(page, 'len(state["history"])', '5');
  await expect(watchValue(page, 'state["count"]', '-7')).toBeVisible();
  await historySlider(page).press('End');
  await expect(watchValue(page, 'state["count"]', '2')).toBeVisible();
  await expect(watchValue(page, 'len(state["history"])', '8')).toBeVisible();
});

test('the waitlist investigation runs pytest and can revisit the first wrong admission', async ({ page }) => {
  test.setTimeout(120_000);
  const line = lineContaining(5, 'test_waitlist.py', 'cs201 = state["CS201"]');
  await openLesson(page, 5, [{ path: '/tutorial/test_waitlist.py', line }]);
  await addWatch(page, 'state["CS201"].enrolled');
  await addWatch(page, 'event.step');
  await startAtBreakpoint(page, 'test_waitlist.py', line);
  await expect(watchValue(page, 'state["CS201"].enrolled', "['Jules Kim', 'Kai Morgan']")).toBeVisible();
  await seekFirstWatchValue(page, 'state["CS201"].enrolled', "['Ava Chen', 'Jules Kim']");
  await expect(watchValue(page, 'event.step', '4')).toBeVisible();
  await historySlider(page).press('End');
  await expect(watchValue(page, 'state["CS201"].enrolled', "['Jules Kim', 'Kai Morgan']")).toBeVisible();
});

test('independent checks reject the seeded faults and accept every model repair in Pyodide', async ({ page }) => {
  test.setTimeout(240_000);
  await openLesson(page, 0);
  await page.getByRole('button', { name: /\bSteps$/ }).click();
  for (const index of [0, 2, 3, 5, 7]) {
    await test.step(config.steps[index].title, async () => {
      await page.evaluate(async step => window._tutorial.loadStep(step), index);
      await page.getByRole('button', { name: /Test My Work/ }).click();
      await expect(page.getByText(/^\d+\s*\/\s*\d+ tests passed$/)).toBeVisible({ timeout: TIMEOUT });
      await applySolution(page);
      await page.getByRole('button', { name: /Test My Work/ }).click();
      await expect(page.getByText(`✅ All ${config.steps[index].tests.length} tests passed!`, { exact: true }))
        .toBeVisible({ timeout: TIMEOUT });
    });
  }
});

test('a deque-backed FIFO repair passes the supplied pytest suite and independent checks', async ({ page }) => {
  test.setTimeout(120_000);
  await openLesson(page, 5);
  await page.getByRole('button', { name: /\bSteps$/ }).click();
  const model = config.steps[5].solution.files.find(file => file.path === 'waitlist.py').content;
  const alternative = model
    .replace('from dataclasses import dataclass, field', 'from dataclasses import dataclass, field\nfrom collections import deque')
    .replace('waitlist: list[str] = field(default_factory=list)', 'waitlist: deque[str] = field(default_factory=deque)')
    .replace('course.waitlist.pop(0)', 'course.waitlist.popleft()');
  expect(alternative).toContain('default_factory=deque');
  expect(alternative).toContain('popleft()');
  expect(await setTutorialFileContent(page, 'waitlist.py', alternative)).toBe(true);
  await page.getByRole('button', { name: /^▶\s+Test$/ }).click();
  await expect(page.getByRole('region', { name: 'Program output', exact: true }))
    .toContainText(/2 passed/, { timeout: TIMEOUT });
  await page.getByRole('button', { name: /Test My Work/ }).click();
  await expect(page.getByText(`✅ All ${config.steps[5].tests.length} tests passed!`, { exact: true }))
    .toBeVisible({ timeout: TIMEOUT });
});

test('every live lesson exposes its purpose and objectives before the exercise', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await openLesson(page, 0);
  await page.getByRole('button', { name: /\bSteps$/ }).click();
  for (let index = 0; index < config.steps.length; index++) {
    await page.evaluate(async step => window._tutorial.loadStep(step), index);
    await expect(page.getByRole('heading', { name: 'Why this matters', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '🎯 You will learn to', exact: true })).toBeVisible();
    await a11yCheckpoint(page, `Python debugging lesson ${index + 1}`, {
      feature: 'python-debugging', include: '.tvm-step-instructions',
    });
  }
  expect(errors).toEqual([]);
});

test('the student print view renders every lesson with solutions hidden', async ({ page }) => {
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
  await a11yCheckpoint(page, 'Python debugging print instructions', {
    feature: 'python-debugging', include: '.step-instructions', darkMode: false,
  });
  expect(errors).toEqual([]);
});

test('Test My Work grades current edits before the automatic save debounce fires', async ({ page }) => {
  test.setTimeout(120_000);
  await openLesson(page, 0);
  await page.getByRole('button', { name: /\bSteps$/ }).click();
  const frozenTime = new Date('2026-10-28T00:00:00Z');
  await page.clock.install({ time: frozenTime });
  await page.clock.pauseAt(frozenTime);
  const repair = config.steps[0].solution.files.find(file => file.path === 'greet.py').content;
  // Prepare an unsaved editor draft while the autosync timer is paused. The
  // public test action must save this draft itself before invoking Python.
  await page.evaluate(source => {
    window._tutorial.editorModels['greet.py'].model.setValue(source);
  }, repair);
  await page.getByRole('button', { name: /Test My Work/ }).click();
  await expect(page.getByText('✅ All 3 tests passed!', { exact: true }))
    .toBeVisible({ timeout: TIMEOUT });
});
