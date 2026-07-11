// @ts-check
const { test, expect } = require('@playwright/test');
const {
  setEditorContent,
  waitForEditorReady,
  waitForTutorialReady,
} = require('./tutorial-helpers');

const TUTORIAL_URL = '/SEBook/tools/react-tutorial.html';
const PREVIEW_SELECTOR = 'iframe[title="Live preview"]';

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

  test('the preview popout also gives rendered apps an opaque origin', async ({ page }) => {
    await page.goto('/tutorial-output-popup.html?kind=preview');
    const sandbox = sandboxTokens(
      await page.getByTitle('Live tutorial preview').getAttribute('sandbox'));

    expect(sandbox).toContain('allow-scripts');
    expect(sandbox).not.toContain('allow-same-origin');
  });
});
