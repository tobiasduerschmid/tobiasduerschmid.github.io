// @ts-check
const { test, expect } = require('@playwright/test');
const { loadTutorialConfig } = require('./tutorial-helpers');

// Every tutorial can hide its instructions to a narrow rail and show them
// again. The workspace takes the width, focus moves between the two buttons,
// and the choice is remembered in this browser.

const BOOT_TIMEOUT = 120_000;

const TUTORIALS = [
  { name: 'a Python tutorial', url: '/SEBook/tools/python-tutorial', id: 'python' },
  { name: 'the UML design-questions tutorial', url: '/SEBook/tools/uml-design-questions', id: 'uml-design-questions' },
  { name: 'a UML editor tutorial', url: '/SEBook/designpatterns/monopoly-state-pattern-uml-homework', id: 'monopoly-state-pattern-uml' },
];

function hideButton(page) {
  return page.getByRole('button', { name: 'Hide instructions', exact: true });
}

function showButton(page) {
  return page.getByRole('button', { name: 'Show instructions', exact: true });
}

function firstStepHeading(page, tutorialId) {
  return page.getByRole('heading', { name: loadTutorialConfig(tutorialId).steps[0].title, level: 2 });
}

/** The width the workspace beside the instructions has. */
async function workspaceWidth(page) {
  return page.evaluate(() => document.querySelector('.tvm-workspace').getBoundingClientRect().width);
}

async function open(page, tutorial, query = '?autosave=false') {
  await page.goto(tutorial.url + query);
  await expect(firstStepHeading(page, tutorial.id)).toBeVisible({ timeout: BOOT_TIMEOUT });
}

test.describe('hide and show the instructions', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const tutorial of TUTORIALS) {
    test(`in ${tutorial.name}, Hide leaves a rail with Show, and Show brings them back`, async ({ page }) => {
      await open(page, tutorial);
      const shownWidth = await workspaceWidth(page);
      const instructionsWidth = await page.evaluate(() => document.querySelector('.tvm-instructions-panel').getBoundingClientRect().width);

      await hideButton(page).click();
      await expect(firstStepHeading(page, tutorial.id)).toBeHidden();
      await expect(showButton(page)).toBeFocused();
      const rail = await showButton(page).boundingBox();
      expect(rail.x).toBeLessThan(80);
      // The workspace takes the instructions' width, less the rail.
      expect(await workspaceWidth(page)).toBeGreaterThan(shownWidth + instructionsWidth - 80);

      await page.keyboard.press('Enter');
      await expect(firstStepHeading(page, tutorial.id)).toBeVisible();
      await expect(hideButton(page)).toBeFocused();
      expect(await workspaceWidth(page)).toBeCloseTo(shownWidth, 0);
    });
  }

  test('the choice survives a reload, in this and other tutorials', async ({ page }) => {
    const [python, umlQuestions] = TUTORIALS;
    await open(page, python);
    await hideButton(page).focus();
    await page.keyboard.press('Enter');
    await expect(showButton(page)).toBeFocused();

    await page.reload();
    await expect(showButton(page)).toBeVisible({ timeout: BOOT_TIMEOUT });
    await expect(firstStepHeading(page, python.id)).toBeHidden();
    await page.goto(umlQuestions.url + '?autosave=false');
    await expect(showButton(page)).toBeVisible({ timeout: BOOT_TIMEOUT });

    await showButton(page).click();
    await page.reload();
    await expect(firstStepHeading(page, umlQuestions.id)).toBeVisible({ timeout: BOOT_TIMEOUT });
    await expect(hideButton(page)).toBeVisible();
  });

  test('My Settings turns hidden instructions on for every tutorial', async ({ page }) => {
    const [python] = TUTORIALS;
    await page.goto('/settings/');
    // The switch's input is visually replaced by its slider.
    await page.getByRole('checkbox', { name: 'Hide tutorial instructions' }).check({ force: true });
    await page.goto(python.url + '?autosave=false');
    await expect(showButton(page)).toBeVisible({ timeout: BOOT_TIMEOUT });
    await expect(firstStepHeading(page, python.id)).toBeHidden();
  });

  test('in lecture mode the instructions can be hidden too', async ({ page }) => {
    const [python] = TUTORIALS;
    await open(page, python, '?autosave=false&lecture=true');
    await hideButton(page).click();
    await expect(firstStepHeading(page, python.id)).toBeHidden();
    await showButton(page).click();
    await expect(firstStepHeading(page, python.id)).toBeVisible();
  });

  test('print shows hidden instructions', async ({ page }) => {
    const [python] = TUTORIALS;
    await open(page, python);
    await hideButton(page).click();
    await page.emulateMedia({ media: 'print' });
    await expect(firstStepHeading(page, python.id)).toBeVisible();
    await expect(showButton(page)).toBeHidden();
  });
});

test.describe('hide and show the instructions where the panels stack', () => {
  test.use({ viewport: { width: 800, height: 900 } });

  test('the rail is a bar above the workspace, without horizontal scrolling', async ({ page }) => {
    const [python] = TUTORIALS;
    await open(page, python);
    await hideButton(page).click();
    await expect(showButton(page)).toBeFocused();
    await expect(firstStepHeading(page, python.id)).toBeHidden();
    const bar = await showButton(page).boundingBox();
    // The label reads left to right: wider than tall, and inside the viewport.
    expect(bar.width).toBeGreaterThan(bar.height);
    expect(bar.x + bar.width).toBeLessThanOrEqual(800);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

    await showButton(page).click();
    await expect(firstStepHeading(page, python.id)).toBeVisible();
    await expect(hideButton(page)).toBeFocused();
  });
});
