// @ts-check
const { test, expect } = require('@playwright/test');
const {
  loadTutorialConfig,
  answerQuizCorrectly,
  expectActiveStep,
  expectStepCount,
  expectRenderedStepTests,
  stepButton,
} = require('./tutorial-helpers');
const { a11yCheckpoint } = require('./a11y-helpers');

// Drives the five Information Hiding lessons through the real
// editor → Pyodide → pytest → quiz gate path. Grader-only checks cannot catch
// a lesson whose solution fails in the browser runtime, or a quiz gate that
// never unlocks the next lesson.

const TUTORIAL_URL = '/SEBook/designprinciples/information-hiding-tutorial';
const PROGRESS_KEY = 'tutorial-progress-information-hiding';
const BOOT_TIMEOUT = 60_000;
const TEST_RUN_TIMEOUT = 90_000;
// Python class inference starts a type checker in the UML worker; uml-live.js
// allows that first analysis up to 60 s.
const UML_ANALYSIS_TIMEOUT = 60_000;
const A11Y_FEATURE = 'information-hiding-tutorial';

const config = loadTutorialConfig('information-hiding');
const steps = config.steps;

// Authored values from the task brief. They duplicate the YAML on purpose: a
// lesson that silently loses a check or a quiz question must fail here.
const EXPECTED_TEST_COUNTS = [8, 10, 11, 8, 12];
const EXPECTED_QUIZ_SIZES = [4, 4, 4, 4, 5];
const EXPECTED_AUTHORED_DIAGRAMS = [2, 1, 1];

function testMyWork(page) {
  return page.getByRole('button', { name: /test my work/i });
}

// The step instructions panel has no landmark role; `.tvm-step-content` is the
// tutorial runtime's instructions container (also used by the sibling specs).
function authoredDiagrams(page) {
  return page.locator('.tvm-step-content').getByRole('img');
}

function testResult(page, description) {
  return page.getByRole('listitem').filter({ hasText: description });
}

async function waitForTutorialReady(page) {
  await expect(page.getByRole('region', { name: 'Program output', exact: true }))
    .toBeVisible({ timeout: BOOT_TIMEOUT });
  await expect(testMyWork(page)).toBeEnabled({ timeout: BOOT_TIMEOUT });
}

async function expectAuthoredDiagrams(page, count) {
  const diagrams = authoredDiagrams(page);
  await expect(diagrams).toHaveCount(count);
  for (let i = 0; i < count; i++) {
    await expect(diagrams.nth(i)).toHaveAccessibleName(/\S/);
  }
}

// One serial journey on one page: Pyodide and pytest boot once, and each
// lesson is only reachable by passing the one before it.
test.describe.serial('Information Hiding tutorial journey', () => {
  test.setTimeout(240_000);

  /** @type {import('@playwright/test').Page} */
  let page;
  /** @type {import('@playwright/test').BrowserContext} */
  let context;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(120_000);
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await context.newPage();
    await page.goto(TUTORIAL_URL);
    await waitForTutorialReady(page);
  });

  test.afterAll(async () => { await context?.close(); });

  test('has five lessons', async () => {
    await expectStepCount(page, 5);
    await expectActiveStep(page, 0);
  });

  test('the live class diagram shows the lesson\'s classes', async () => {
    // Known product defect (reported, owned by a later task): on a fresh visit
    // loadStep() sets _suppressAutoSave = true, then calls
    // _refreshUMLDiagram(), which returns early while that flag is set. The
    // flag is cleared only after the step's ready promise settles, and nothing
    // schedules another refresh, so the pane stays empty until a watched file
    // changes or the learner presses Refresh. Must run before applySolution(),
    // which edits watched files and therefore refreshes the diagram.
    test.fail();
    const viewer = page.getByRole('region', { name: 'Interactive UML diagram viewer' });
    await expect(viewer).toContainText('Payments', { timeout: UML_ANALYSIS_TIMEOUT });
    await expect(viewer).toContainText('OrderService');
  });

  test('starter fails the analysis checks', async () => {
    await testMyWork(page).click();
    await expect(testResult(page, 'Before: the analysis lists every file that would need an edit'))
      .toHaveText(/^✗/, { timeout: TEST_RUN_TIMEOUT });
    await expect(testResult(page, 'The shop still behaves the same with PayPal'))
      .toHaveText(/^✓/);
    await expect(page.getByRole('button', { name: /^Next/ })).toBeDisabled();
  });

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const lesson = i + 1;
    const isLast = i === steps.length - 1;

    if (i < EXPECTED_AUTHORED_DIAGRAMS.length) {
      test(`lesson ${lesson} shows its authored diagrams`, async () => {
        await expectAuthoredDiagrams(page, EXPECTED_AUTHORED_DIAGRAMS[i]);
      });
    }

    if (i === 0) {
      test('the authored diagrams render class names at a readable size', async () => {
        // Known product defect (reported, owned by a later task): the
        // reference-design diagrams are fitted to the ~420 px instructions
        // pane. At 1440×900 lesson 1's 1100+ px wide SVGs scale to about
        // 0.38, so 16 px class names render at about 6 px.
        test.fail();
        const diagrams = authoredDiagrams(page);
        for (let d = 0; d < EXPECTED_AUTHORED_DIAGRAMS[0]; d++) {
          const sizes = await diagrams.nth(d).evaluate((el) => {
            const paragraph = el.closest('.tvm-step-content').querySelector('p');
            const svg = el.querySelector('svg');
            const label = [...svg.querySelectorAll('text')]
              .find((text) => text.textContent.trim() === 'Payments');
            const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
            return {
              paragraph: parseFloat(getComputedStyle(paragraph).fontSize),
              label: parseFloat(getComputedStyle(label).fontSize) * scale,
            };
          });
          expect(sizes.label, `diagram ${d + 1} class-name size vs paragraph text`)
            .toBeGreaterThanOrEqual(0.85 * sizes.paragraph);
        }
      });
    }

    test(`lesson ${lesson} "${step.title}": solution passes all ${EXPECTED_TEST_COUNTS[i]} tests`, async () => {
      await page.evaluate(() => window._tutorial.applySolution());
      await testMyWork(page).click();
      await expect(page.getByText(`✅ All ${EXPECTED_TEST_COUNTS[i]} tests passed!`, { exact: true }))
        .toBeVisible({ timeout: TEST_RUN_TIMEOUT });
      await expectRenderedStepTests(page, step);
      await a11yCheckpoint(page, `information hiding tutorial — lesson ${lesson} all tests passing`,
        { feature: A11Y_FEATURE, darkMode: true });
    });

    test(`lesson ${lesson} "${step.title}": knowledge check ${isLast ? 'completes the tutorial' : `unlocks lesson ${lesson + 1}`}`, async () => {
      await page.getByRole('button', { name: /^Next/ }).click();
      await answerQuizCorrectly(page);
      await expect(page.getByRole('heading', { name: 'Knowledge Check Complete!' })).toBeVisible();
      const quizSize = EXPECTED_QUIZ_SIZES[i];
      await expect(page.getByText(new RegExp(`^Your Score: ${quizSize}\\s*/\\s*${quizSize}$`)))
        .toBeVisible();
      if (!isLast) {
        await page.getByRole('button', { name: `Continue to Step ${lesson + 1} →` }).click();
        await expectActiveStep(page, i + 1);
      }
    });
  }
});

test('an old save starts over', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  // Seed an unversioned save from the retired playlist tutorial before the
  // tutorial page first loads.
  await page.goto('/');
  await page.evaluate(([key, save]) => localStorage.setItem(key, JSON.stringify(save)), [
    PROGRESS_KEY,
    {
      step: 5,
      stepsPassed: [0, 1, 2, 3, 4, 5],
      quizPassed: [0, 1, 2],
      files: { 'playlist.py': { content: 'x', language: 'python' } },
      activeFile: 'playlist.py',
    },
  ]);

  await page.goto(TUTORIAL_URL);
  await waitForTutorialReady(page);

  await expectActiveStep(page, 0);
  await expect(stepButton(page, 1)).toBeDisabled();
  await expect(stepButton(page, 1)).toHaveAccessibleName(/locked/);
  expect(pageErrors, 'loading an old save must not throw').toEqual([]);
});

test('print view renders', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto(`${TUTORIAL_URL}/print`);

  for (const step of steps) {
    await expect(page.getByRole('heading', { level: 2, name: step.title, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('heading', { level: 2 }).filter({
    hasText: new RegExp(`^(${steps.map((s) => s.title).join('|')})$`),
  })).toHaveCount(5);
  await expect(page.getByRole('img', { name: /^UML class diagram/ })).toHaveCount(4);
  expect(errors, 'print view must load without console errors').toEqual([]);
});
