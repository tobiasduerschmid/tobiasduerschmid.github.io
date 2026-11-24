// @ts-check
const { test, expect } = require('@playwright/test');
const { waitForTutorialReady, expectActiveStep } = require('./tutorial-helpers');

// The live class diagram must appear as soon as a step is ready: on a first
// visit, after moving to another step, and after a reload restores saved work.
// Learners should never need the Refresh button to see the starter design.
// The pane is shared by every tutorial with `uml_diagram: true`; the two
// tutorials below cover its two layouts (below the editors, and as a tab in
// the right-hand panel).

const BOOT_TIMEOUT = 90_000;
const RENDER_TIMEOUT = 30_000;

function viewer(page) {
  return page.getByRole('region', { name: /Interactive UML diagram viewer/ });
}

async function expectDiagramShowing(page, className) {
  await expect(viewer(page).getByRole('img')).toHaveAccessibleName(
    new RegExp(`\\b${className}\\b`), { timeout: RENDER_TIMEOUT });
}

async function openFresh(page, url) {
  await page.goto(url);
  await page.evaluate(() => localStorage.clear());
  await page.goto(url);
  await waitForTutorialReady(page, { bootTimeout: BOOT_TIMEOUT });
}

test.describe('live UML diagram renders without pressing Refresh', () => {
  test.setTimeout(240_000);

  test('diagram below the editors: first visit, next step, and reload', async ({ page }) => {
    const url = '/SEBook/designpatterns/observer-tutorial.html';
    await openFresh(page, url);
    await expectDiagramShowing(page, 'WeatherStation');

    // Move on the way a learner would after the step is unlocked.
    await page.evaluate(() => {
      window._tutorial._stepsUnlocked.add(1);
      return window._tutorial.loadStep(1);
    });
    await expectActiveStep(page, 1);
    await expectDiagramShowing(page, 'DataSource');

    // A reload restores saved progress on the same step.
    await page.reload();
    await waitForTutorialReady(page, { bootTimeout: BOOT_TIMEOUT });
    await expectActiveStep(page, 1);
    await expectDiagramShowing(page, 'DataSource');
  });

  test('diagram tab in the right-hand panel: first visit', async ({ page }) => {
    await openFresh(page, '/SEBook/tools/code-smells-refactoring-tutorial.html');
    await expectDiagramShowing(page, 'RoyaltyCalculator');
  });
});
