// @ts-check
const { test, expect } = require('@playwright/test');
const { loadTutorialConfig, setTutorialFileContent, expectActiveStep } = require('./tutorial-helpers');
const { a11yCheckpoint } = require('./a11y-helpers');

const config = loadTutorialConfig('playwright');
const tutorialUrl = '/SEBook/tools/playwright-tutorial.html';
const gradeTimeout = 120_000; // Several real preview runs, including intentional failing assertions.

async function openStep(page, index) {
  await page.goto(tutorialUrl);
  await page.getByRole('button', { name: /^Step 1:/ }).waitFor();
  await page.waitForFunction(() => window._tutorial?.editorModels?.['src/App.jsx']);
  // Arrange a later lesson without solving unrelated quiz gates.
  await page.evaluate(async (stepIndex) => {
    window._tutorial._stepsUnlocked.add(stepIndex);
    await window._tutorial.loadStep(stepIndex);
  }, index);
  await expectActiveStep(page, index);
  await expect(page.frameLocator('iframe[title="Live preview"]').getByRole('heading', { name: 'Todo Lab' })).toBeVisible();
}

async function grade(page, expected) {
  await page.getByRole('button', { name: /test my work/i }).click();
  const result = page.getByRole('status').filter({ hasText: /tests passed\./ });
  await expect(result).toHaveText(expected, { timeout: gradeTimeout });
}

const smokeSuite = `import { test, expect } from '@playwright/test';
for (const name of ['first smoke', 'second smoke']) {
  test(name, async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Todo Lab' })).toBeVisible();
  });
}
`;

// Independently authored equivalent solution: different names, import order,
// quote style and count matcher from the lesson's displayed model answer.
const capstoneSuite = `import { expect, test } from "@playwright/test";
async function add(page, names) {
  await page.goto("/");
  for (const name of names) {
    await page.getByLabel("Todo item").fill(name);
    await page.getByRole("button", { name: "Add todo" }).click();
  }
}
test("everything can be completed without losing the tasks", async ({ page }) => {
  const names = ["Read", "Walk", "Cook"];
  await add(page, names);
  for (const name of names) await page.getByRole("button", { name }).click();
  await expect(page.getByRole("status")).toContainText(/\\b0\\b/);
  await expect(page.getByRole("listitem")).toHaveCount(3);
  for (const name of names) {
    const toggle = page.getByRole("button", { name });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
  }
});
test("a completed task can become pending again", async ({ page }) => {
  await add(page, ["Read", "Walk"]);
  const read = page.getByRole("button", { name: "Read" });
  const walk = page.getByRole("button", { name: "Walk" });
  await read.click();
  await walk.click();
  await read.click();
  await expect(page.getByRole("status")).toContainText(/\\b1\\b/);
  await expect(page.getByRole("listitem")).toHaveCount(2);
  await expect(read).toBeVisible();
  await expect(walk).toBeVisible();
  await expect(read).toHaveAttribute("aria-pressed", "false");
  await expect(walk).toHaveAttribute("aria-pressed", "true");
});
`;

test.describe('Playwright tutorial behavioral grading', () => {
  test.setTimeout(180_000);

  test('heading-only smoke tests cannot complete the capstone', async ({ page }) => {
    await openStep(page, 7);
    await setTutorialFileContent(page, 'tests/all-done.spec.js', smokeSuite);
    await grade(page, /Failures:.*nonzero count/);
  });

  test('equivalent capstone tests pass and grading preserves the learner app and spec', async ({ page }) => {
    await openStep(page, 7);
    const app = config.steps[7].files.find(file => file.path === 'src/App.jsx').content
      .replace('<h1>Todo Lab</h1>', '<h1>My draft</h1>');
    await setTutorialFileContent(page, 'src/App.jsx', app);
    await setTutorialFileContent(page, 'tests/all-done.spec.js', capstoneSuite);
    await grade(page, /^All 6 tests passed\.$/);
    await expect(page.frameLocator('iframe[title="Live preview"]').getByRole('heading', { name: 'My draft' })).toBeVisible();
    const files = await page.evaluate(() => Object.fromEntries(
      Object.entries(window._tutorial.editorModels).map(([name, entry]) => [name, entry.model.getValue()])
    ));
    expect(files['src/App.jsx']).toBe(app);
    expect(files['tests/all-done.spec.js']).toBe(capstoneSuite);
    await a11yCheckpoint(page, 'playwright capstone grading complete', { feature: 'playwright-tutorial' });
  });

  for (const [label, source] of [
    ['no collected tests', 'import { test, expect } from "@playwright/test";'],
    ['invalid JavaScript', 'import { test, expect } from "@playwright/test"; test('],
  ]) {
    test(`${label} cannot earn mutant-detection credit`, async ({ page }) => {
      await openStep(page, 7);
      await setTutorialFileContent(page, 'tests/all-done.spec.js', source);
      await grade(page, /^0 of 6 tests passed\. Failures:/);
      await expect(page.frameLocator('iframe[title="Live preview"]').getByRole('heading', { name: 'Todo Lab' })).toBeVisible();
    });
  }

  test('skipped tests do not satisfy the two-test capstone minimum', async ({ page }) => {
    await openStep(page, 7);
    const suite = capstoneSuite.replace('test("a completed task can become pending again"',
      'test.skip("a completed task can become pending again"');
    await setTutorialFileContent(page, 'tests/all-done.spec.js', suite);
    await grade(page, /Failures: At least two tests pass on the correct app/);
  });

  for (const mixed of [false, true]) {
    test(`${mixed ? 'a mixed suite' : 'an entirely skipped suite'} cannot pass a gate without min_tests`, async ({ page }) => {
      await openStep(page, 3);
      const complete = config.steps[3].solution.files.find(file => file.path === 'tests/todo.spec.js').content;
      const suite = mixed
        ? complete + "\ntest.skip('not exercised', async ({ page }) => {});"
        : complete.replace(/\btest\(/g, 'test.skip(');
      await setTutorialFileContent(page, 'tests/todo.spec.js', suite);
      await grade(page, /^0 of 2 tests passed\. Failures:/);
    });
  }

  test('the whitespace partition accepts alternate test names and double quotes', async ({ page }) => {
    await openStep(page, 1);
    const suite = config.steps[1].solution.files.find(file => file.path === 'tests/add-todo.spec.js').content
      .replace(/test\('([^']+)'/g, (_, name) => `test(${JSON.stringify('Contract: ' + name)}`);
    await setTutorialFileContent(page, 'tests/add-todo.spec.js', suite);
    await grade(page, /^All 2 tests passed\.$/);
  });

  test('a wrong expected value cannot masquerade as catching the empty-text bug', async ({ page }) => {
    await openStep(page, 3);
    const suite = `import { test, expect } from '@playwright/test';
      test('an unrelated failure', async ({ page }) => {
        await page.goto('/');
        await page.getByLabel('Todo item').fill('Milk');
        await page.getByRole('button', { name: 'Add todo' }).click();
        await expect(page.getByRole('listitem')).toHaveText('Wrong expected text');
      });`;
    await setTutorialFileContent(page, 'tests/todo.spec.js', suite);
    await grade(page, /^0 of 2 tests passed\. Failures:/);
  });
});

test('each lesson loads its own starter and revisiting restores only that lesson draft', async ({ page }) => {
  test.setTimeout(120_000);
  await openStep(page, 0);
  for (let index = 1; index < config.steps.length; index++) {
    await page.evaluate(async (stepIndex) => {
      window._tutorial._stepsUnlocked.add(stepIndex);
      await window._tutorial.loadStep(stepIndex);
    }, index);
    await expectActiveStep(page, index);
    const app = await page.evaluate(() => window._tutorial.editorModels['src/App.jsx'].model.getValue());
    expect(app, `Step ${index + 1} must use its authored app, not the preceding app`).toBe(
      config.steps[index].files.find(file => file.path === 'src/App.jsx').content
    );
  }
  await page.getByRole('button', { name: /^Step 3:/ }).click();
  await expectActiveStep(page, 2);
  const draft = config.steps[2].files.find(file => file.path === 'src/App.jsx').content
    .replace('<h1>Todo Lab</h1>', '<h1>My locator draft</h1>');
  await setTutorialFileContent(page, 'src/App.jsx', draft);
  await page.getByRole('button', { name: /^Step 4:/ }).click();
  await expectActiveStep(page, 3);
  await expect(page.frameLocator('iframe[title="Live preview"]').getByRole('heading', { name: 'Todo Lab' })).toBeVisible();
  await page.getByRole('button', { name: /^Step 3:/ }).click();
  await expectActiveStep(page, 2);
  await expect(page.frameLocator('iframe[title="Live preview"]').getByRole('heading', { name: 'My locator draft' })).toBeVisible();
  await page.evaluate(() => window._tutorial.saveProgress());
  await page.reload();
  await expectActiveStep(page, 2, { timeout: 30_000 });
  await expect(page.frameLocator('iframe[title="Live preview"]').getByRole('heading', { name: 'My locator draft' })).toBeVisible();
});

// A small browser-level compatibility check isolates text-selector semantics
// from tutorial grading, using installed Playwright itself as the oracle.
test('compat text locators ignore source and metadata while preserving nested and hidden text', async ({ page }) => {
  await page.setContent(`<head><title>Metadata phrase</title>
    <style>/* Add todo and Source-only phrase */</style>
    <script>const label = "Add todo"; const internal = "Source-only phrase";</script>
    </head><body><main><div><button>Add <span>todo</span></button></div>
    <p hidden>Hidden text</p></main></body>`);
  await page.addScriptTag({ path: require('path').resolve(__dirname, '../js/playwright-compat/runner.js') });
  const agent = await page.evaluate(() => window.SEBookPlaywrightCompat.agentScript());
  await page.addScriptTag({ content: agent });
  for (const [text, expected] of [['Add todo', 1], ['todo', 1], ['Source-only phrase', 0], ['Metadata phrase', 0], ['Hidden text', 1]]) {
    await expect(page.getByText(text)).toHaveCount(expected);
    const compatCount = await page.evaluate((value) => window.__sebookPlaywrightCompatCommand({
      type: 'count', payload: { locator: [{ kind: 'text', text: { type: 'string', value }, options: {} }] },
    }), text);
    expect(compatCount, `Compatibility locator for ${text}`).toBe(expected);
  }
});
