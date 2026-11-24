// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * The step bar above a tutorial's instructions: where the learner is, how
 * long the step takes, which steps are finished, and why Next is locked.
 * The diagram challenge demo has three steps with estimates; its first two
 * challenges can be seeded as passed.
 */
const DEMO = '/SEBook/tools/diagram-challenge-demo';
const BOOT_TIMEOUT = 90_000;

async function openDemo(page, hash = '') {
  await page.goto(DEMO + '?autosave=false' + hash);
  await expect(page.locator('.tvm-loading')).toBeHidden({ timeout: BOOT_TIMEOUT });
  await expect(page.getByRole('button', { name: /^Step 1:/ })).toBeVisible({ timeout: BOOT_TIMEOUT });
}

// Saved progress: the first two challenges passed (see diagram-challenge-demo.spec.js).
const PASSED = { v: 1, state: 'done', passed: true };
const SAVED_PROGRESS = {
  step: 2, progressVersion: 1, stepKeys: ['explore', 'review', 'choose-view'],
  stepsUnlocked: [0, 1, 2], stepsVisited: [0, 1], stepsPassed: [0, 1], quizPassed: [],
  files: {}, stepFiles: {},
  diagramChallenges: { 'key:explore': PASSED, 'key:review': PASSED },
};

test('the step bar names the current step and its time estimate', async ({ page }) => {
  await openDemo(page);
  await expect(page.getByText('Explore the Project · about 10 minutes', { exact: true })).toBeVisible();

  await openDemo(page, '#review');
  await expect(page.getByText('Review Without Editing · about 8 minutes', { exact: true })).toBeVisible();
});

test('a passed step is marked completed, in its name and not by color alone', async ({ page }) => {
  await page.addInitScript(progress => {
    localStorage.setItem('tutorial-progress-diagram-challenge-demo', JSON.stringify(progress));
  }, SAVED_PROGRESS);
  await page.goto(DEMO);
  await expect(page.locator('.tvm-loading')).toBeHidden({ timeout: BOOT_TIMEOUT });

  const first = page.getByRole('button', { name: 'Step 1: Explore the Project (completed)', exact: true });
  await expect(first).toBeVisible();
  await expect(page.getByRole('button', { name: 'Step 2: Review Without Editing (completed)', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Step 3: Choose the View', exact: true })).toBeVisible();
  const mark = await first.evaluate(element => getComputedStyle(element, '::after').content);
  expect(mark, 'a completed step shows a check mark').toContain('✓');
});

test('a locked Next says why, in text beside it', async ({ page }) => {
  await openDemo(page);
  const next = page.getByRole('button', { name: /^Next →/ });
  const reason = page.getByText('Finish the diagram challenge to continue', { exact: true });

  await expect(next).toBeDisabled();
  await expect(reason).toBeVisible();
  const [reasonBox, nextBox] = [await reason.boundingBox(), await next.boundingBox()];
  expect(reasonBox.x + reasonBox.width, 'the reason sits just before Next').toBeLessThanOrEqual(nextBox.x + 1);
  expect(Math.abs((reasonBox.y + reasonBox.height / 2) - (nextBox.y + nextBox.height / 2))).toBeLessThan(nextBox.height);
});

test('an unlocked Next shows no lock reason', async ({ page }) => {
  await page.goto('/SEBook/tools/diagram-challenge-demo?autosave=false&instructor-mode=true');
  await expect(page.locator('.tvm-loading')).toBeHidden({ timeout: BOOT_TIMEOUT });
  await expect(page.getByRole('button', { name: /^Next →/ })).toBeEnabled();
  await expect(page.getByText('Finish the diagram challenge to continue', { exact: true })).toBeHidden();
});
