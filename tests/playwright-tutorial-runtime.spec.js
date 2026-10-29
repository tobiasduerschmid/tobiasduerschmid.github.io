// @ts-check
const { test, expect } = require('@playwright/test');
const { a11yCheckpoint } = require('./a11y-helpers');
const {
  setTutorialFileContent,
  waitForEditorReady,
  waitForTutorialReady,
  clickStep,
} = require('./tutorial-helpers');

const PREVIEW = 'iframe[title="Live preview"]';
const spec = (assertion, after = '') => `import { test, expect } from '@playwright/test';
test('user can add a todo', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: /todo item/i }).fill('Milk');
  await page.getByRole('button', { name: /add todo/i }).click();
  await expect(page.getByRole('listitem')).toHaveText(${JSON.stringify(assertion)});
  ${after}
});`;

async function openTutorial(page) {
  await page.goto('/SEBook/tools/playwright-tutorial.html');
  await waitForTutorialReady(page, { readySelector: PREVIEW, bootTimeout: 30_000 });
  await waitForEditorReady(page);
  await expect(page.frameLocator(PREVIEW).getByRole('button', { name: /add todo/i })).toBeVisible();
}

async function textContrast(locator, pseudo = null) {
  return locator.evaluate((element, pseudoElement) => {
    const rgba = value => {
      const channels = value.match(/[\d.]+/g).map(Number);
      return { rgb: channels.slice(0, 3), alpha: channels[3] ?? 1 };
    };
    const over = (foreground, background) => foreground.rgb.map((channel, index) =>
      channel * foreground.alpha + background[index] * (1 - foreground.alpha));
    const luminance = rgb => rgb.map(channel => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const ancestors = [];
    for (let node = element; node; node = node.parentElement) ancestors.unshift(node);
    // The iframe's solid/transparent surfaces compose over its white canvas.
    const background = ancestors.reduce((color, node) =>
      over(rgba(getComputedStyle(node).backgroundColor), color), [255, 255, 255]);
    const style = getComputedStyle(element, pseudoElement);
    const ink = rgba(style.color);
    ink.alpha *= Number(style.opacity);
    const foreground = over(ink, background);
    const paper = luminance(background), text = luminance(foreground);
    return {
      ratio: (Math.max(paper, text) + 0.05) / (Math.min(paper, text) + 0.05),
      foreground: style.color,
      background,
    };
  }, pseudo);
}

for (const stepIndex of [6, 7]) {
  for (const dark of [false, true]) {
    const mode = dark ? 'dark' : 'light';
    test(`Step ${stepIndex + 1} completed todos remain readable and reversible in ${mode} mode`, async ({ page }, testInfo) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width: 1600, height: 1000 });
      await openTutorial(page);
      const themeToggle = page.getByRole('checkbox', { name: 'Toggle dark mode' });
      await expect(themeToggle).not.toBeChecked();
      if (dark) {
        await themeToggle.focus();
        await themeToggle.press('Space');
        await expect(themeToggle).toBeChecked();
      }
      await expect(page.locator('html')).not.toHaveClass(/dark-mode-transition/);
      // Skip unrelated lesson gates, then navigate through the visible control.
      await page.evaluate(index => {
        window._tutorial._stepsUnlocked.add(index);
        window._tutorial._renderStepNav();
      }, stepIndex);
      await clickStep(page, stepIndex);
      await page.waitForFunction(index => {
        const tutorial = window._tutorial;
        return tutorial.currentStep === index && !tutorial._activeStepLoadRequest &&
          tutorial._reactPreviewReady && tutorial._reactAssertionPort &&
          tutorial._reactAssertionPortGeneration === tutorial._reactPreviewGeneration;
      }, stepIndex);

      const preview = page.frameLocator(PREVIEW);
      await expect(preview.locator('html')).toHaveAttribute('data-bs-theme', mode);
      const input = preview.getByRole('textbox', { name: 'Todo item' });
      await input.fill('Milk');
      // Exercise keyboard access; local Chrome drops pointer events near opaque iframe edges.
      const add = preview.getByRole('button', { name: 'Add todo', exact: true });
      await add.focus();
      await expect(add).toBeFocused();
      await add.press('Enter');
      const toggle = preview.getByRole('button', { name: 'Milk', exact: true });
      await toggle.focus();
      await expect(toggle).toBeFocused();
      await toggle.press('Enter');
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      await expect(toggle).toBeVisible();
      const status = preview.getByRole('status');
      await expect(status).toHaveText(/\b0\b/);
      await expect(input).toHaveValue('');
      await expect(input).toHaveAttribute('placeholder', 'Buy milk');

      const contrasts = [];
      for (const { label, locator, pseudo } of [
        { label: 'completed todo', locator: toggle, pseudo: null },
        { label: 'remaining count', locator: status, pseudo: null },
        { label: 'input placeholder', locator: input, pseudo: '::placeholder' },
      ]) {
        const contrast = await textContrast(locator, pseudo);
        contrasts.push({ label, ...contrast });
        expect(contrast.ratio,
          `Step ${stepIndex + 1} ${mode} ${label}: ${contrast.foreground} over ${contrast.background.join(', ')}`
        ).toBeGreaterThanOrEqual(4.5);
      }
      await testInfo.attach('completed-state-contrast', {
        body: JSON.stringify(contrasts, null, 2),
        contentType: 'application/json',
      });
      await a11yCheckpoint(page, `playwright step ${stepIndex + 1} completed todo in ${mode} mode`, {
        feature: 'playwright-tutorial',
      });
      await page.locator(PREVIEW).screenshot({ path: testInfo.outputPath(`completed-todo-${mode}.png`) });

      await toggle.focus();
      await expect(toggle).toBeFocused();
      await toggle.press('Enter');
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      await expect(toggle).toBeVisible();
      await expect(status).toHaveText(/\b1\b/);
    });
  }
}

test.describe('Playwright tutorial execution lifecycle', () => {
  test.setTimeout(60_000);

  test('a failed learner assertion shows expected and actual text', async ({ page }) => {
    await openTutorial(page);
    await setTutorialFileContent(page, 'tests/todo.spec.js', spec('Bread'));
    await page.getByRole('button', { name: '✓ Test', exact: true }).click();

    const results = page.locator('.tvm-preview-test-panel');
    await expect(results.getByText(/0\s*\/\s*1 tests passed/)).toBeVisible();
    await expect(results).toContainText(/Expected.*Bread.*got.*Milk/s);
    await expect(page.getByRole('button', { name: '✓ Test', exact: true })).toBeEnabled();
  });

  test('learner and assessment runs cannot drive the preview concurrently', async ({ page }) => {
    await openTutorial(page);
    await setTutorialFileContent(page, 'tests/todo.spec.js', spec('Bread'));
    await page.getByRole('button', { name: '✓ Test', exact: true }).click();

    await expect(page.locator('.tvm-btn-test')).toBeDisabled();
    await expect(page.locator('.tvm-preview-test-panel')).toContainText(/0\s*\/\s*1 tests passed/);
    await expect(page.getByRole('button', { name: /test my work/i })).toBeEnabled();
  });

  test('navigating away cancels a learner run without replacing the new preview', async ({ page }) => {
    await openTutorial(page);
    // Unlock navigation as an instructor, then use the ordinary step controls.
    await page.evaluate(() => {
      window._tutorial.instructorMode = true;
      window._tutorial._renderStepNav();
    });
    await setTutorialFileContent(page, 'tests/todo.spec.js', spec('Bread'));
    await page.getByRole('button', { name: '✓ Test', exact: true }).click();
    await expect(page.frameLocator(PREVIEW).getByRole('listitem')).toHaveText('Milk');

    await clickStep(page, 1);

    await expect(page.getByRole('button', { name: '✓ Test', exact: true })).toBeEnabled();
    await expect(page.frameLocator(PREVIEW).getByRole('listitem')).toHaveCount(0);
    await expect(page.locator('.tvm-preview-test-panel')).not.toContainText(/0\s*\/\s*1 tests passed/);
  });

  test('editing during assessment discards results for the old source', async ({ page }) => {
    await openTutorial(page);
    await setTutorialFileContent(page, 'tests/todo.spec.js', spec('Milk',
      'await new Promise(resolve => setTimeout(resolve, 1000));'));
    await page.getByRole('button', { name: /test my work/i }).click();
    // This observable action means the snapshot's test is executing. The delay
    // is learner input under test, not a sleep used to synchronize the test.
    await expect(page.frameLocator(PREVIEW).getByRole('listitem')).toHaveText('Milk');
    await setTutorialFileContent(page, 'tests/todo.spec.js', spec('Bread'));

    await expect(page.locator('.tvm-test-panel')).toContainText(/source changed|code changed/i);
    await expect(page.locator('.tvm-btn-next')).toBeDisabled();
    await expect(page.getByRole('button', { name: /test my work/i })).toBeEnabled();
  });

  test('refresh reports cancellation and a subsequent learner run succeeds', async ({ page }) => {
    await openTutorial(page);
    await setTutorialFileContent(page, 'tests/todo.spec.js', spec('Bread'));
    await page.getByRole('button', { name: '✓ Test', exact: true }).click();
    await expect(page.frameLocator(PREVIEW).getByRole('listitem')).toHaveText('Milk');

    await page.getByRole('button', { name: /refresh/i }).click();

    await expect(page.locator('.tvm-preview-test-panel')).toContainText('Test run cancelled.');
    await expect(page.getByRole('button', { name: '✓ Test', exact: true })).toBeEnabled();
    await setTutorialFileContent(page, 'tests/todo.spec.js', spec('Milk'));
    await page.getByRole('button', { name: '✓ Test', exact: true }).click();
    await expect(page.locator('.tvm-preview-test-panel')).toContainText('All 1 tests passed!');
  });
});
