// @ts-check
const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { auditInteractiveState } = require('./a11y-helpers');

// The authored examples are the contract: each must offer a prediction box
// and execute its displayed source, with the output promised by the chapter.
const chapter = fs.readFileSync(path.join(__dirname, '../SEBook/tools/python.md'), 'utf8');
const puzzles = Array.from(chapter.matchAll(
  /<div data-program-output-lab>\s*<script type="application\/json">\s*([\s\S]*?)\s*<\/script>\s*<\/div>/g
), match => JSON.parse(match[1]));
if (!puzzles.length) throw new Error('No Python puzzle specifications found');

test.setTimeout(150_000);
test.use({ reducedMotion: 'reduce' });

// The documented embed hook scopes each card, which has no landmark role.
const puzzleFor = (page, spec) => page.locator('[data-program-output-lab]')
  .filter({ has: page.getByText('file · ' + spec.file, { exact: true }) });
const predictionFor = (puzzle, spec) => puzzle.getByRole('textbox', { name: spec.predictPrompt, exact: true });
const runFor = (puzzle, spec) => puzzle.getByRole('button', { name: 'python3 ' + spec.file, exact: true })
  .or(puzzle.getByRole('button', { name: 'Reset', exact: true }));
const traceFor = (puzzle, spec) => puzzle.getByRole('region', {
  name: 'Object reference lab: Why this output is correct (' + spec.file + ')', exact: true
});
const action = (trace, name) => trace.getByRole('button', { name, exact: true });

for (const spec of puzzles) {
  test(`${spec.file}: an incorrect prediction traces the exact puzzle inside its notice`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/SEBook/tools/python.html');
    const puzzle = puzzleFor(page, spec);
    const prediction = predictionFor(puzzle, spec);
    await expect(prediction).toBeEditable();
    await prediction.fill('unexpected');
    await runFor(puzzle, spec).click();

    const trace = traceFor(puzzle, spec);
    await expect(trace).toHaveCount(1);
    await expect(trace.getByRole('textbox', { name: 'Python code', exact: true })).toHaveValue(spec.code);
    // The lab belongs to the Explanation box and follows its written explanation.
    const notice = puzzle.getByText('Explanation:', { exact: true }).locator('..');
    await expect(notice).toBeVisible();
    await expect(notice.getByRole('heading', {
      name: 'Why this output is correct (' + spec.file + ')', exact: true
    })).toBeVisible();
    await expect(notice.getByRole('region', {
      name: 'Object reference lab: Why this output is correct (' + spec.file + ')', exact: true
    })).toHaveCount(1);
    await expect(runFor(puzzle, spec)).toBeFocused();
    await expect(action(trace, 'Forward')).toBeEnabled({ timeout: 120_000 });
    await expect(trace.getByRole('status')).toContainText('Step 1 of');
    await action(trace, 'Forward').click();
    await expect(trace.getByRole('status')).toContainText('Step 2 of');
    await action(trace, 'Back').click();
    await expect(trace.getByRole('status')).toContainText('Step 1 of');

    // Traverse the controls students use, including function and exception
    // steps; do not bypass the worker or mutate the lab's playback index.
    const status = await trace.getByRole('status').innerText();
    const stepCount = Number(status.match(/Step 1 of (\d+)/)[1]);
    for (let step = 1; step < stepCount; step++) await action(trace, 'Forward').click();
    await expect(trace.getByRole('status')).toContainText('End of execution');
    await expect(trace.getByRole('region', { name: 'Program output', exact: true }))
      .toHaveText(spec.output.stdout);
    await expect(action(trace, 'Forward')).toBeDisabled();
    expect(errors).toEqual([]);
  });
}

const first = puzzles[0];
for (const [label, answer] of [
  ['empty', ''], ['whitespace only', ' \n\t '],
  ['correct', first.output.stdout], ['correct with surrounding whitespace', ' \n' + first.output.stdout + '\n ']
]) {
  test(`${label} predictions do not open a reference lab`, async ({ page }) => {
    await page.goto('/SEBook/tools/python.html');
    const puzzle = puzzleFor(page, first);
    await predictionFor(puzzle, first).fill(answer);
    await runFor(puzzle, first).click();
    await expect(puzzle.getByText('Explanation:', { exact: true })).toBeVisible();
    await expect(traceFor(puzzle, first)).toHaveCount(0);
    if (label.startsWith('correct')) {
      await expect(puzzle.getByText('Nailed it — your prediction matches stdout', { exact: true })).toBeVisible();
    }
  });
}

test('reset removes pending feedback and a later incorrect attempt starts a fresh, accessible trace', async ({ page }) => {
  await page.goto('/SEBook/tools/python.html');
  const puzzle = puzzleFor(page, first);
  const prediction = predictionFor(puzzle, first);
  const run = runFor(puzzle, first);
  const trace = traceFor(puzzle, first);
  await prediction.fill('0');
  await run.click();
  await expect(trace).toBeVisible();
  await run.click();
  await expect(trace).toHaveCount(0);
  await expect(prediction).toHaveValue('0');
  await expect(prediction).toBeEditable();
  await prediction.fill(first.output.stdout);
  await run.click();
  await expect(trace).toHaveCount(0);
  await expect(puzzle.getByText('Nailed it — your prediction matches stdout', { exact: true })).toBeVisible();

  await run.click();
  await prediction.fill('0');
  await run.focus();
  await page.keyboard.press('Enter');
  await expect(trace).toHaveCount(1);
  await expect(action(trace, 'Forward')).toBeEnabled({ timeout: 120_000 });
  await expect(trace.getByRole('status')).toContainText('Step 1 of');
  await action(trace, 'Forward').click();
  await action(trace, 'Forward').click();
  await expect(trace.getByRole('region', { name: 'Object reference diagram', exact: true }).locator('.orl-graph'))
    .toHaveAttribute('aria-busy', 'false');
  await auditInteractiveState(page, 'Incorrect Python prediction with step-through feedback', { include: '[data-program-output-lab]' });
  await page.emulateMedia({ media: 'print' });
  await expect(trace.locator('.orl-print-step').last()).toContainText('Output:\n' + first.output.stdout);
  await auditInteractiveState(page, 'Printed Python prediction feedback', {
    include: '[data-program-output-lab] [data-object-reference-lab]', darkMode: false
  });
  await page.emulateMedia({ media: 'screen' });
  await run.click();
  await expect(trace).toHaveCount(0);
});

test('printing without submitting a prediction does not create a reference lab', async ({ page }) => {
  await page.goto('/SEBook/tools/python.html');
  const puzzle = puzzleFor(page, first);
  await predictionFor(puzzle, first).fill('0');
  // Media emulation changes CSS only; the browser's print lifecycle event
  // triggers the shared card's print-only reveal.
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await page.emulateMedia({ media: 'print' });
  await expect(puzzle.getByText('Explanation:', { exact: true })).toBeVisible();
  await expect(traceFor(puzzle, first)).toHaveCount(0);
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(traceFor(puzzle, first)).toHaveCount(0);
});

test('incorrect Haskell predictions keep their existing feedback', async ({ page }) => {
  await page.goto('/SEBook/tools/haskell.html');
  const puzzle = puzzleFor(page, { file: 'Apply.hs' });
  await puzzle.getByRole('textbox', { name: 'Write the line this program prints.', exact: true }).fill('unexpected');
  await puzzle.getByRole('button', { name: 'runghc Apply.hs', exact: true }).click();
  await expect(puzzle.getByText('Explanation:', { exact: true })).toBeVisible();
  await expect(puzzle.getByRole('region', { name: /Object reference lab:/ })).toHaveCount(0);
});
