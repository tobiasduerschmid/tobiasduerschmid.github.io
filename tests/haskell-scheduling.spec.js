// @ts-check
const { test, expect } = require('@playwright/test');
const { loadTutorialConfig, waitForTutorialReady, setEditorContent } = require('./tutorial-helpers');
const { a11yCheckpoint } = require('./a11y-helpers');

// Playwright normally disables the browser throttling that caused the hidden
// Haskell frame to spend its execution deadline waiting on compiler yields.
// Keep normal browser scheduling for this regression; use the real tutorial,
// sandbox, compiler and host deadline without replacing any runtime assets.
test.use({ launchOptions: {
  ...(process.env.PLAYWRIGHT_CHROME_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE } : {}),
  ignoreDefaultArgs: [
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
  ],
} });

test('Haskell lesson 1 runs its starter and corrected program within the execution deadline', async ({ page }) => {
  test.setTimeout(120_000); // Real compiler boot plus two bounded Run requests.
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/SEBook/tools/haskell-tutorial');
  await waitForTutorialReady(page, { bootTimeout: 90_000 });
  await expect(page.getByRole('heading', { name: 'Functions as Expressions', exact: true })).toBeVisible();
  const run = page.getByRole('button', { name: /run$/i });
  const output = page.getByRole('region', { name: 'Program output' });

  await run.click();
  // The supplied starter deliberately doubles the balance: (45 - 12) * 2.
  await expect(output).toContainText('66', { timeout: 30_000 });
  await expect(run).toBeEnabled();
  await expect(output).not.toContainText(/timed out|restarted|error/i);

  // Editing forces real compilation again, rather than only testing a cache hit.
  const solution = loadTutorialConfig('haskell').steps[0].solution.files
    .find(file => file.path === 'Main.hs');
  await setEditorContent(page, solution.content);
  await run.click();
  await expect(output).toContainText('21', { timeout: 30_000 });
  await expect(run).toBeEnabled();
  await expect(output).not.toContainText(/timed out|restarted|error/i);
  await a11yCheckpoint(page, 'Haskell Run with normal browser scheduling', {
    feature: 'haskell-tutorial', darkMode: true,
  });
  expect(errors).toEqual([]);
});
