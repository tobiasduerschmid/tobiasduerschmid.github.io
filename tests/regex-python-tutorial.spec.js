const { test, expect } = require('@playwright/test');
const {
  loadTutorialConfig, setTutorialFileContent, waitForTutorialReady,
  expectActiveStep, expectStepCount,
} = require('./tutorial-helpers');
const { a11yCheckpoint } = require('./a11y-helpers');

const tutorial = loadTutorialConfig('regex-python');
const url = '/SEBook/tools/regex-python-tutorial';
const outputs = [
  "['replay_07.txt', 'replay_2048.txt', 'replay_07.txt']",
  '[7, -12, 42, 0]',
  "[('luna_2', 12), ('max7', -7), ('nova', 0), ('luna_2', 2)]",
];
const answers = ['item_24', '-8', 'zed7 -5'];

async function checkWork(page, count) {
  await page.getByRole('button', { name: /Test My Work/ }).click();
  await expect(page.getByText(`✅ All ${count} tests passed!`, { exact: true })).toBeVisible();
}

async function answerOneQuestion(page, answer) {
  await expect(page.getByRole('radiogroup', { name: 'Answer options' })).toHaveCount(1);
  await expect(page.getByRole('status').filter({ hasText: /^Question 1\s*\/\s*1$/ })).toBeVisible();
  await page.getByRole('radio', { name: new RegExp(`^[A-Z]\\s+${answer}$`) }).click();
  await page.getByRole('button', { name: 'See Results', exact: true }).click();
}

test('learners parse three files using named fields and pass one knowledge check per step', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await waitForTutorialReady(page);
  await expectStepCount(page, 3);

  for (const [index, step] of tutorial.steps.entries()) {
    await expectActiveStep(page, index);
    await expect(page.getByRole('link', { name: 'Solution', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Next →/ })).toBeEnabled();
    const model = step.solution.files.find(file => file.path === step.run_file);
    await setTutorialFileContent(page, step.run_file, model.content);
    await page.getByRole('button', { name: /^▶\s+Run$/ }).click();
    await expect(page.getByRole('region', { name: 'Program output', exact: true })).toContainText(outputs[index]);
    await checkWork(page, step.tests.length);
    await a11yCheckpoint(page, `Regex in Python step ${index + 1} solved`, { feature: 'regex-python-tutorial' });

    if (index < 2) {
      await expect(page.getByRole('button', { name: new RegExp(`^Step ${index + 2}:`) })).toBeEnabled();
    }

    // The second check is taken in the actual detached instructions window.
    let instructions = page;
    if (index === 1) {
      const popup = page.waitForEvent('popup');
      await page.getByRole('button', { name: /Open instructions in separate window$/ }).click();
      instructions = await popup;
      instructions.on('pageerror', error => errors.push(error.message));
    }
    await instructions.getByRole('button', { name: 'Next →', exact: true }).click();
    await a11yCheckpoint(instructions, `Regex in Python knowledge check ${index + 1}`, { feature: 'regex-python-tutorial' });

    if (index === 0) {
      await answerOneQuestion(instructions, 'item_2');
      await expect(instructions.getByText(/You scored 0\/1/)).toBeVisible();
      await expect(page.getByRole('button', { name: /^Step 2:/ })).toBeEnabled();
      await expect(instructions.getByRole('button', { name: 'Continue to Step 2 →', exact: true })).toBeEnabled();
      await instructions.getByRole('button', { name: 'Try Again', exact: true }).click();
    }
    await answerOneQuestion(instructions, answers[index]);
    if (index < 2) {
      await instructions.getByRole('button', { name: `Continue to Step ${index + 2} →`, exact: true }).click();
      await expect(instructions.getByRole('heading', {
        name: tutorial.steps[index + 1].title, exact: true,
      })).toBeVisible();
    } else {
      await expect(page.getByRole('button', { name: 'Finish Review', exact: true })).toBeEnabled();
    }
    if (instructions !== page) await instructions.close();
  }
  expect(errors).toEqual([]);
});

test('a partial regex provides feedback without blocking navigation', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto(url);
  await waitForTutorialReady(page);
  // The intentionally unescaped dot is a runnable attempt: valid names work,
  // but invalid separators also match. The file loop and parser stay real.
  const partial = String.raw`import re
pattern = r"replay_\d{2,4}.txt"
def parse_file(path):
    with open(path, encoding="utf-8") as source:
        return [line.strip() for line in source if re.fullmatch(pattern, line.strip())]
`;
  await setTutorialFileContent(page, 'filter_clips.py', partial);
  await page.getByRole('button', { name: /Test My Work/ }).click();
  await expect(page.getByText(/^2\s*\/\s*3 tests passed$/)).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: tutorial.steps[0].tests[0].description })).toContainText('✓');
  await expect(page.getByRole('listitem').filter({ hasText: tutorial.steps[0].tests[1].description })).toContainText('✗');
  await expect(page.getByRole('button', { name: /^Next →/ })).toBeEnabled();
  await setTutorialFileContent(page, 'filter_clips.py', partial.replace('}.txt', '}\\.txt'));
  await checkWork(page, 3);
  await expect(page.getByRole('button', { name: 'Next →', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: /^Step 2:/ })).toBeEnabled();
});


test('untouched exercises can be skipped and solutions are available immediately', async ({ page }) => {
  await page.goto(url);
  await waitForTutorialReady(page);
  await page.getByRole('button', { name: /^Step 3:/ }).click();
  await expectActiveStep(page, 2);
  await expect(page.getByRole('link', { name: 'Solution', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Step 1:/ }).click();
  await page.getByRole('button', { name: 'Next →', exact: true }).click();
  await page.getByRole('button', { name: 'Skip Knowledge Check', exact: true }).click();
  await expectActiveStep(page, 1);
  await page.getByRole('link', { name: 'Solution', exact: true }).click();
  await page.getByRole('button', { name: /^▶\s+Run$/ }).click();
  await expect(page.getByRole('region', { name: 'Program output', exact: true })).toContainText(outputs[1]);
});
