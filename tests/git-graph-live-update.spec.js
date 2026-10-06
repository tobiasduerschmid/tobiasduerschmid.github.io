const { test, expect } = require('@playwright/test');
const { waitForTutorialReady } = require('./tutorial-helpers');

test('Git graph recovers when shell notifications stop', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/SEBook/tools/git-tutorial.html?instructor-mode=true');
  await waitForTutorialReady(page, { readySelector: '.tvm-terminal-container', bootTimeout: 90_000 });
  await page.getByRole('button', { name: 'Git Graph', exact: true }).click();
  // Feed the real interactive VM terminal; observe the rendered graph rather
  // than a cached state or a mocked daemon response.
  await page.evaluate(dir => window._tutorial.sendCommand(
    `mkdir -p /tutorial/myproject; cd ${dir}; git init -q; echo first > graph-check.txt; git add graph-check.txt; git commit -qm graph-first-check`
  ), '/tutorial/myproject');
  await expect(page.getByText('graph-first-check', { exact: true })).toBeVisible({ timeout: 15_000 });
  // Let the initial view refreshes finish while a learner command runs,
  // then remove the optional prompt notifier to exercise recovery.
  await page.evaluate(() => window._tutorial.sendCommand(
    'sleep 3; unset PROMPT_COMMAND; echo second >> graph-check.txt; git add graph-check.txt; git commit -qm graph-second-check'
  ));
  await expect(page.getByText('graph-second-check', { exact: true })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: /Refresh$/ }).click();
  await expect(page.getByText('graph-first-check', { exact: true })).toBeVisible();
  await expect(page.getByText('graph-second-check', { exact: true })).toBeVisible();
});
