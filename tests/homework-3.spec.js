// @ts-check
const { test, expect } = require('@playwright/test');
const {
  clickStep,
  loadTutorialConfig,
  setTutorialFileContent,
  waitForEditorReady,
  waitForTutorialReady,
} = require('./tutorial-helpers');

const URL = '/SEBook/tools/homework-3.html?autosave=true';
const PREVIEW = 'iframe[title="Live preview"]';

async function openAssignment(page) {
  await page.goto(URL);
  await waitForTutorialReady(page, { readySelector: PREVIEW });
  await waitForEditorReady(page);
}

test('Homework 3 offers open assignment sections and rejects the unfinished starter', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await openAssignment(page);
  await expect(page.frameLocator(PREVIEW).getByRole('heading', { name: 'Homework 3' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Step \d+:/ })).toHaveCount(3);
  await expect(page.getByRole('link', { name: 'Solution', exact: true })).toBeHidden();

  await clickStep(page, 1);
  await page.getByRole('button', { name: /test my work/i }).click();
  await expect(page.getByText(/0\s*\/\s*9 tests passed/)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('Hints', { exact: true })).toBeHidden();
  await clickStep(page, 2);
  await expect(page.getByRole('heading', { name: 'Part 3: Your Tests' })).toBeVisible();
  await expect(page.getByText('does not execute Python/Selenium', { exact: true })).toBeVisible();
  await clickStep(page, 0);
  await expect(page.getByRole('heading', { name: 'Your Assignment' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('instructor mode and print view contain no assignment solutions', async ({ page }) => {
  const config = loadTutorialConfig('homework-3');
  expect(config.steps.every(step => !step.solution)).toBe(true);
  await page.goto(URL + '&instructor-mode=true');
  await waitForTutorialReady(page, { readySelector: PREVIEW });
  await expect(page.getByRole('link', { name: 'Solution', exact: true })).toHaveCount(0);
  await expect(page.frameLocator(PREVIEW).getByRole('heading', { name: 'Homework 3' })).toBeVisible();
  // Follow the actual navigation target; the printed brief must work in both modes.
  const printURL = await page.getByRole('link', { name: 'Print', exact: true }).getAttribute('href');
  expect(printURL).toContain('/homework-3/print');
  for (const url of [printURL, printURL.split('?')[0]]) {
    await page.goto(url);
    for (const heading of ['Part 1: Tic-Tac-Toe', 'Part 2: Chorus Lapilli', 'Part 3: Your Tests', 'Submission Checklist']) {
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: 'Print / Save as PDF' })).toBeVisible();
    await expect(page.locator('.step-solution, .starter-files')).toHaveCount(0);
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByRole('button', { name: 'Print / Save as PDF' })).toBeHidden();
    await page.emulateMedia({ media: 'screen' });
  }
});

test('game and notebook drafts survive section navigation and reload', async ({ page }) => {
  test.setTimeout(90_000);
  await openAssignment(page);
  await setTutorialFileContent(page, 'src/App.jsx',
    'export default function App() { return <h1>My assignment draft</h1>; }');
  await setTutorialFileContent(page, 'chorus-lapilli.txt', 'Investigated invalid destinations.');
  await clickStep(page, 2);
  await clickStep(page, 1);
  await expect(page.frameLocator(PREVIEW).getByRole('heading', { name: 'My assignment draft' })).toBeVisible();
  // Inspect the notebook through the file tab and editor, as a student would.
  await page.getByRole('button', { name: 'chorus-lapilli.txt', exact: true }).click();
  await expect(page.getByRole('textbox', { name: /^Code pane/ })).toHaveValue('Investigated invalid destinations.');

  await page.reload();
  await waitForTutorialReady(page, { readySelector: PREVIEW });
  await waitForEditorReady(page);
  await expect(page.frameLocator(PREVIEW).getByRole('heading', { name: 'My assignment draft' })).toBeVisible();
  await page.getByRole('button', { name: 'chorus-lapilli.txt', exact: true }).click();
  await expect(page.getByRole('textbox', { name: /^Code pane/ })).toHaveValue('Investigated invalid destinations.');
});
