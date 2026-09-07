// @ts-check
const { test, expect } = require('@playwright/test');
const {
  loadTutorialConfig, expectActiveStep, expectStepCount,
  passCurrentStepTests, expectRenderedStepTests,
} = require('./tutorial-helpers');

const TUTORIAL_URL = '/SEBook/tools/cs131-refresher-tutorial';
const BOOT_TIMEOUT = 120_000;
const config = loadTutorialConfig('cs131-refresher');
const steps = config.steps;
const runButton = page => page.getByRole('button', { name: /▶ Run/, exact: false });
const output = page => page.locator('.tvm-output-pre');

async function gotoStep(page, index) {
  await page.getByRole('button', { name: new RegExp(`^Step ${index + 1}:`) }).click();
  await expectActiveStep(page, index);
  await expect(page.locator('.tvm-loading')).toBeHidden({ timeout: BOOT_TIMEOUT });
}

async function replaceSource(page, filename, source) {
  // Monaco's public model API edits the same document that the learner types in.
  await page.evaluate(({ filename, source }) => {
    const model = window.monaco.editor.getModels().find(model => model.uri.path.endsWith('/' + filename));
    if (!model) throw new Error('Editor file missing: ' + filename);
    model.setValue(source);
  }, { filename, source });
}

async function expectSource(page, filename, source) {
  await expect.poll(() => page.evaluate(filename => {
    return window.monaco.editor.getModels().find(model => model.uri.path.endsWith('/' + filename))?.getValue();
  }, filename)).toBe(source);
}

const pointFile = 'cs131/param_passing.cpp';
const pointSolution = steps[0].solution.files.find(file => file.path === pointFile).content;

// A compact alternative solution deliberately uses member assignments and new
// parameter names. Logging and the learner's driver are irrelevant to grading.
const alternativePointSolution = `#include <iostream>
struct Point {
  int x_, y_;
  Point(int x=0, int y=0): x_(x), y_(y) {}
};
void modify_by_value(Point copy) { copy = Point(20,30); }
void modify_by_reference(Point &original) { original.x_=20; original.y_=30; }
void modify_by_pointer(Point *address) { *address = Point(20,30); }
int main() { std::cout << "a different driver\\n"; return 0; }
`;

test.describe('CS131 browser C++ and Python refresher', () => {
  test.setTimeout(360_000);

  test.beforeEach(async ({ page }) => {
    await page.goto(`${TUTORIAL_URL}?instructor-mode=true&autosave=true`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.tvm-loading')).toBeHidden({ timeout: BOOT_TIMEOUT });
    await expect(runButton(page)).toBeEnabled({ timeout: BOOT_TIMEOUT });
  });

  test('all published checks pass and every C++ solution compiles and runs', async ({ page }) => {
    await expectStepCount(page, 8);
    for (const [index, step] of steps.entries()) {
      await test.step(step.title, async () => {
        await gotoStep(page, index);
        await expect(page.locator('.tvm-output-panel')).toBeVisible();
        await expect(page.locator('.tvm-terminal-panel')).toBeHidden();
        if (step.tests?.length) {
          await passCurrentStepTests(page, 60_000);
          await expectRenderedStepTests(page, step);
        } else {
          await page.evaluate(() => window._tutorial.applySolution());
          await expect(page.getByRole('button', { name: /test my work/i })).toHaveCount(0);
          await expect(page.getByRole('heading', { name: /check your work/i })).toBeVisible();
        }
        if (step.backend === 'cpp') {
          await runButton(page).click();
          await expect(output(page)).toContainText('✓ Done', { timeout: 60_000 });
          await expect(output(page)).not.toContainText('Exited with error');
        }
      });
    }
  });

  test('Point checks accept equivalent solutions and detect pointer rebinding and compile errors', async ({ page }) => {
    await replaceSource(page, pointFile, alternativePointSolution);
    const check = page.getByRole('button', { name: /test my work/i });
    await check.click();
    await expect(page.locator('.tvm-test-summary')).toContainText('All 3 tests passed!', { timeout: 60_000 });

    const pointerRebinding = alternativePointSolution.replace('*address = Point(20,30);', 'address = new Point(20,30);');
    await replaceSource(page, pointFile, pointerRebinding);
    await check.click();
    await expect(page.locator('.tvm-test-summary')).toContainText(/2\s*\/\s*3 tests passed/, { timeout: 60_000 });
    await expect(page.getByRole('button', { name: /^Next →$/ })).toBeEnabled();

    await replaceSource(page, pointFile, 'this is not C++');
    await check.click();
    await expect(page.locator('.tvm-test-summary')).toContainText(/0\s*\/\s*3 tests passed/, { timeout: 60_000 });
    await expect(output(page)).toContainText('error:');
    await expect(page.getByRole('button', { name: /^Next →$/ })).toBeEnabled();
  });

  test('switching languages and reloading preserves current source without loading a Linux VM', async ({ page }) => {
    const vmRequests = [];
    page.on('request', request => {
      if (/\/(?:libv86\.js|v86\.wasm|bzImage|rootfs\.cpio\.gz)(?:\?|$)/.test(request.url())) vmRequests.push(request.url());
    });
    const customSource = pointSolution + '\n// Keep this change across languages.\n';
    await replaceSource(page, pointFile, customSource);
    await gotoStep(page, 1);
    await passCurrentStepTests(page, 60_000);
    await gotoStep(page, 0);
    await expectSource(page, pointFile, customSource);
    await runButton(page).click();
    await expect(output(page)).toContainText('✓ Done', { timeout: 60_000 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('.tvm-loading')).toBeHidden({ timeout: BOOT_TIMEOUT });
    await expectSource(page, pointFile, customSource);
    expect(vmRequests).toEqual([]);
  });

  test('Stop interrupts C++ execution and the reconstructed compiler runs the next edit', async ({ page }) => {
    const loopingSource = '#include <iostream>\nint main(){ std::cout << "loop started" << std::endl; while(true){} }\n';
    await replaceSource(page, pointFile, loopingSource);
    await runButton(page).click();
    await expect(output(page)).toContainText('loop started', { timeout: 60_000 });
    const stop = page.getByRole('button', { name: /Stop$/ });
    await stop.focus();
    await page.keyboard.press('Enter');
    await expect(runButton(page)).toBeEnabled({ timeout: BOOT_TIMEOUT });
    await expect(output(page)).toContainText('C++ runtime restarted and ready.');
    await expectSource(page, pointFile, loopingSource);
    await replaceSource(page, pointFile, '#include <iostream>\nint main(){std::cout << "after restart\\n";}\n');
    await runButton(page).click();
    await expect(output(page)).toContainText('after restart', { timeout: 60_000 });
    await expect(output(page)).toContainText('✓ Done');
  });

  test('a hanging Point check times out without earning a pass and leaves navigation available', async ({ page }) => {
    await replaceSource(page, pointFile, alternativePointSolution.replace(
      'original.x_=20; original.y_=30;', 'while(true) {}'
    ));
    await page.getByRole('button', { name: /test my work/i }).click();
    await expect(page.getByRole('button', { name: /^Next →$/ })).toBeEnabled();
    await expect(page.locator('.tvm-test-summary')).toContainText(/1\s*\/\s*3 tests passed/, { timeout: 60_000 });
    await expect(output(page)).toContainText('timed out');
    await expect(runButton(page)).toBeEnabled({ timeout: BOOT_TIMEOUT });
    await replaceSource(page, pointFile, alternativePointSolution);
    await page.getByRole('button', { name: /test my work/i }).click();
    await expect(page.locator('.tvm-test-summary')).toContainText('All 3 tests passed!', { timeout: 60_000 });
  });

  test('leaving an executing C++ program still allows Python to run', async ({ page }) => {
    await replaceSource(page, pointFile, '#include <iostream>\nint main(){std::cout << "running" << std::endl; while(true){}}');
    await runButton(page).click();
    await expect(output(page)).toContainText('running', { timeout: 60_000 });
    await gotoStep(page, 1);
    await expect(runButton(page)).toBeEnabled();
    await page.evaluate(() => window._tutorial.applySolution());
    await runButton(page).click();
    await expect(output(page)).toContainText('(50, 10)', { timeout: 60_000 });
  });
});
