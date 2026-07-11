// @ts-check
const { test, expect } = require('@playwright/test');
const {
  setEditorContent,
  setTutorialFileContent,
  waitForEditorReady,
  waitForTutorialReady,
} = require('./tutorial-helpers');

const TUTORIAL_URL = '/SEBook/tools/react-tutorial.html';
const PLAYWRIGHT_TUTORIAL_URL = '/SEBook/tools/playwright-tutorial.html';
const PREVIEW_SELECTOR = 'iframe[title="Live preview"]';
const WORKING_TODO_SPEC = [
  "import { test, expect } from '@playwright/test';",
  '',
  "test('user can add a todo', async ({ page }) => {",
  "  await page.goto('/');",
  "  await page.getByRole('textbox', { name: /todo item/i }).fill('Milk');",
  "  await page.getByRole('button', { name: /add todo/i }).click();",
  "  await expect(page.getByRole('listitem')).toHaveText('Milk');",
  '});',
].join('\n');

async function openReactTutorial(page) {
  await page.goto(TUTORIAL_URL);
  await waitForTutorialReady(page, {
    readySelector: PREVIEW_SELECTOR,
    bootTimeout: 30_000,
  });
  await waitForEditorReady(page);
  await expect(page.frameLocator(PREVIEW_SELECTOR).getByRole('heading', { level: 1 }))
    .toBeVisible({ timeout: 10_000 });
}

async function openPlaywrightTutorial(page) {
  await page.goto(PLAYWRIGHT_TUTORIAL_URL);
  await waitForTutorialReady(page, {
    readySelector: PREVIEW_SELECTOR,
    bootTimeout: 30_000,
  });
  await waitForEditorReady(page);
  await expect(page.frameLocator(PREVIEW_SELECTOR).locator('body')).toBeVisible({ timeout: 10_000 });
}

function sandboxTokens(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean);
}

test.describe('React preview isolation', () => {
  test.setTimeout(90_000);

  test('learner code renders without access to tutorial DOM or storage', async ({ page }) => {
    await openReactTutorial(page);
    await page.evaluate(() => {
      document.documentElement.dataset.previewIsolation = 'host-only';
      localStorage.setItem('react-preview-isolation-secret', 'host-only');
    });

    await setEditorContent(page, [
      'let documentAccess = "blocked";',
      'let storageAccess = "blocked";',
      'try {',
      '  parent.document.documentElement.dataset.previewIsolation = "mutated";',
      '  documentAccess = "allowed";',
      '} catch (error) {}',
      'try {',
      '  if (parent.localStorage.getItem("react-preview-isolation-secret")) {',
      '    storageAccess = "allowed";',
      '  }',
      '} catch (error) {}',
      'function App() {',
      '  return (',
      '    <h1 data-document-access={documentAccess} data-storage-access={storageAccess}>',
      '      Isolated preview',
      '    </h1>',
      '  );',
      '}',
      'const root = ReactDOM.createRoot(document.getElementById("root"));',
      'root.render(<App />);',
    ].join('\n'));

    await page.getByRole('button', { name: /refresh/i }).click();
    const heading = page.frameLocator(PREVIEW_SELECTOR)
      .getByRole('heading', { name: 'Isolated preview' });
    await expect(heading).toHaveAttribute('data-document-access', 'blocked', { timeout: 10_000 });
    await expect(heading).toHaveAttribute('data-storage-access', 'blocked');
    await expect(page.locator('html')).toHaveAttribute('data-preview-isolation', 'host-only');
    await expect.poll(() => page.evaluate(() =>
      localStorage.getItem('react-preview-isolation-secret'))).toBe('host-only');

    const sandbox = sandboxTokens(await page.getByTitle('Live preview').getAttribute('sandbox'));
    expect(sandbox).toContain('allow-scripts');
    expect(sandbox).not.toContain('allow-same-origin');
  });

  test('repository-authored React assertions run inside the isolated preview', async ({ page }) => {
    await openReactTutorial(page);
    await page.evaluate(() => window._tutorial.applySolution());
    await expect(page.frameLocator(PREVIEW_SELECTOR).getByRole('heading', { level: 1 }))
      .toContainText('CS 35L', { timeout: 10_000 });

    await page.getByRole('button', { name: /test my work/i }).click();
    await expect(page.getByText('All 2 tests passed!')).toBeVisible({ timeout: 20_000 });
  });

  test('learner code cannot observe or forge repository assertion traffic', async ({ page }) => {
    await openReactTutorial(page);
    await setEditorContent(page, [
      'document.documentElement.dataset.assertionMessageCount = "0";',
      'window.addEventListener("message", function(event) {',
      '  const payload = event.data || {};',
      '  if (payload.type !== "sebook-react-assertion-request" && !payload.command) return;',
      '  const count = Number(document.documentElement.dataset.assertionMessageCount) + 1;',
      '  document.documentElement.dataset.assertionMessageCount = String(count);',
      '  parent.postMessage({',
      '    type: "sebook-react-assertion-result",',
      '    id: payload.id,',
      '    passed: true,',
      '  }, "*");',
      '});',
      '// A guessed public result must not authenticate either.',
      'parent.postMessage({',
      '  type: "sebook-react-assertion-result",',
      '  id: "react-assertion-1",',
      '  passed: true,',
      '}, "*");',
      'function App() {',
      '  return <h1 className="greeting">Hello, Student!</h1>;',
      '}',
      'const root = ReactDOM.createRoot(document.getElementById("root"));',
      'root.render(<App />);',
    ].join('\n'));

    await page.getByRole('button', { name: /test my work/i }).click();

    // One genuine assertion passes and one fails. A missing broker would
    // report 0/2; the public-message forgery would report 2/2.
    await expect(page.getByText(/1\s*\/\s*2 tests passed/)).toBeVisible({ timeout: 20_000 });
    await expect(page.frameLocator(PREVIEW_SELECTOR).locator('html'))
      .toHaveAttribute('data-assertion-message-count', '0');
  });

  test('learner code cannot observe or forge Playwright-compat commands', async ({ page }) => {
    await openPlaywrightTutorial(page);
    await setTutorialFileContent(page, 'src/App.jsx', [
      'document.documentElement.dataset.playwrightMessageCount = "0";',
      'window.addEventListener("message", function(event) {',
      '  const payload = event.data || {};',
      '  if (payload.__sebookPlaywrightCompat !== "request") return;',
      '  const count = Number(document.documentElement.dataset.playwrightMessageCount) + 1;',
      '  document.documentElement.dataset.playwrightMessageCount = String(count);',
      '  const value = payload.type === "assert" ? { pass: true, message: "" } : true;',
      '  parent.postMessage({',
      '    __sebookPlaywrightCompat: "response",',
      '    id: payload.id,',
      '    ok: true,',
      '    value,',
      '  }, "*");',
      '});',
      'function App() {',
      '  return <main><h1>Broken Todo app</h1></main>;',
      '}',
      'export default App;',
    ].join('\n'));

    await page.getByRole('button', { name: /test my work/i }).click();

    // The two source checks pass, but the real browser interaction fails.
    // A forged public response would incorrectly report all three as passing.
    await expect(page.getByText(/2\s*\/\s*3 tests passed/)).toBeVisible({ timeout: 20_000 });
    await expect(page.frameLocator(PREVIEW_SELECTOR).locator('html'))
      .toHaveAttribute('data-playwright-message-count', '0');
  });

  test('learner Playwright specs cannot read the tutorial DOM or storage', async ({ page }) => {
    await openPlaywrightTutorial(page);
    await page.evaluate(() => {
      document.documentElement.dataset.playwrightRunnerSecret = 'host-only';
      localStorage.setItem('playwright-runner-secret', 'host-only');
    });
    await setTutorialFileContent(page, 'tests/todo.spec.js', [
      "import { test, expect } from '@playwright/test';",
      '',
      "test('user can add a todo', async ({ page }) => {",
      "  let hostDocumentValue = 'blocked';",
      "  let hostStorageValue = 'blocked';",
      "  let indexedDbAccess = 'blocked';",
      "  let cacheAccess = 'blocked';",
      '  try {',
      '    hostDocumentValue = parent.document.documentElement.dataset.playwrightRunnerSecret;',
      '  } catch (error) {}',
      '  try {',
      "    hostStorageValue = localStorage.getItem('playwright-runner-secret');",
      '  } catch (error) {}',
      '  try {',
      "    indexedDB.open('playwright-runner-secret');",
      "    indexedDbAccess = 'allowed';",
      '  } catch (error) {}',
      '  try {',
      "    if (typeof caches !== 'undefined') {",
      "      await caches.open('playwright-runner-secret');",
      "      cacheAccess = 'allowed';",
      '    }',
      '  } catch (error) {}',
      "  expect(hostDocumentValue).toBe('blocked');",
      "  expect(hostStorageValue).toBe('blocked');",
      "  expect(indexedDbAccess).toBe('blocked');",
      "  expect(cacheAccess).toBe('blocked');",
      '',
      "  await page.goto('/');",
      "  await page.getByRole('textbox', { name: /todo item/i }).fill('Milk');",
      "  await page.getByRole('button', { name: /add todo/i }).click();",
      "  await expect(page.getByRole('listitem')).toHaveText('Milk');",
      '});',
    ].join('\n'));

    await page.getByRole('button', { name: /test my work/i }).click();

    await expect(page.getByText('All 3 tests passed!')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('html')).toHaveAttribute('data-playwright-runner-secret', 'host-only');
    await expect.poll(() => page.evaluate(() =>
      localStorage.getItem('playwright-runner-secret'))).toBe('host-only');
  });

  test('synchronous learner Playwright loops are terminated and later runs recover', async ({ page }) => {
    await openPlaywrightTutorial(page);
    await setTutorialFileContent(page, 'tests/todo.spec.js', [
      "import { test, expect } from '@playwright/test';",
      '',
      'while (true) {}',
      '',
      "test('user can add a todo', async ({ page }) => {",
      "  await page.goto('/');",
      "  await page.getByRole('textbox', { name: /todo item/i }).fill('Milk');",
      "  await page.getByRole('button', { name: /add todo/i }).click();",
      "  await expect(page.getByRole('listitem')).toHaveText('Milk');",
      '});',
    ].join('\n'));

    const testButton = page.getByRole('button', { name: /test my work/i });
    await testButton.click();
    await expect(page.getByText(/2\s*\/\s*3 tests passed/)).toBeVisible({ timeout: 20_000 });
    await expect(testButton).toBeEnabled();

    await setTutorialFileContent(page, 'tests/todo.spec.js', WORKING_TODO_SPEC);
    await testButton.click();
    await expect(page.getByText('All 3 tests passed!')).toBeVisible({ timeout: 20_000 });
  });

  test('a stalled worker-source fetch is aborted and does not poison later runs', async ({ page }) => {
    await openPlaywrightTutorial(page);
    let blockedBootstrap = false;
    let releaseBootstrap;
    const stalledBootstrap = new Promise(resolve => { releaseBootstrap = resolve; });
    const runnerPattern = '**/js/playwright-compat/runner.js';
    const stallRunnerSource = async route => {
      blockedBootstrap = true;
      await stalledBootstrap;
      try {
        await route.continue();
      } catch (error) {
        // The runner's bootstrap watchdog aborts this request before the test
        // releases it. Continuing an already-aborted route is expected to fail.
      }
    };
    await page.route(runnerPattern, stallRunnerSource);

    const testButton = page.getByRole('button', { name: /test my work/i });
    await testButton.click();
    await expect(page.getByText(/2\s*\/\s*3 tests passed/)).toBeVisible({ timeout: 20_000 });
    expect(blockedBootstrap).toBe(true);

    releaseBootstrap();
    await page.unroute(runnerPattern, stallRunnerSource);
    await expect(testButton).toBeEnabled();
    await testButton.click();
    await expect(page.getByText('All 3 tests passed!')).toBeVisible({ timeout: 20_000 });
  });

  test('the preview popout also gives rendered apps an opaque origin', async ({ page }) => {
    await page.goto('/tutorial-output-popup.html?kind=preview');
    const sandbox = sandboxTokens(
      await page.getByTitle('Live tutorial preview').getAttribute('sandbox'));

    expect(sandbox).toContain('allow-scripts');
    expect(sandbox).not.toContain('allow-same-origin');
  });
});
