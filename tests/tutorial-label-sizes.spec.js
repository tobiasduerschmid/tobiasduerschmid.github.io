// @ts-check
const { test, expect } = require('@playwright/test');
const { waitForTutorialReady, clickStep } = require('./tutorial-helpers');

/**
 * Tutorial workspace labels follow the project's minimum font-size rule
 * (CLAUDE.md, "Minimum font sizes"): text a learner reads or clicks renders at
 * the size of the instructions' paragraphs, and short uppercase status pills
 * at no less than 0.85 of it. Font sizes do not depend on the theme, so one
 * theme is enough here; screenshots cover the look in both.
 */
const READABLE = 1;
const MICRO_LABEL = 0.85;

const fontSize = (locator) => locator.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

async function paragraphSize(page) {
  const paragraph = page.locator('.tvm-step-instructions').getByRole('paragraph').first();
  await expect(paragraph).toBeVisible();
  return fontSize(paragraph);
}

/** Every visible match of `locator` is at least `factor` × the paragraph size. */
async function expectLegible(page, locator, factor, what) {
  const minimum = (await paragraphSize(page)) * factor;
  const shown = locator.filter({ visible: true });
  await expect(shown.first(), `${what} is shown`).toBeVisible();
  // Re-resolve on every poll: tabs and markers are re-rendered as state settles.
  // No match counts as 0 px, so a vanished control fails instead of passing.
  const smallest = () => shown.evaluateAll((elements) => elements.length
    ? Math.min(...elements.map((el) => parseFloat(getComputedStyle(el).fontSize)))
    : 0);
  await expect.poll(smallest, { message: `smallest ${what} font size (px)` })
    .toBeGreaterThanOrEqual(minimum);
}

test('editor, view, and output controls of a split TDD workspace are paragraph-sized', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/SEBook/testing/tdd-tutorial');
  await waitForTutorialReady(page);

  // Tab names may start with an icon glyph, so names are matched at their end.
  const views = page.getByRole('group', { name: 'Workspace view' });
  const layout = page.getByRole('group', { name: 'Editor layout' });
  await expectLegible(page, page.getByRole('button', { name: 'scorer.py', exact: true }), READABLE, 'file tab');
  await expectLegible(page, views.getByRole('button'), READABLE, 'workspace view buttons');
  await expectLegible(page, layout.getByRole('button'), READABLE, 'Tabs / Split buttons');
  await expectLegible(page, page.getByText(/^(Code|Tests)$/), READABLE, 'editor pane labels');
  await expectLegible(page, page.getByRole('button', { name: /(^|\s)(Output|Terminal)$/ }), READABLE, 'output panel tabs');
  await expectLegible(page, page.getByRole('button', { name: 'Clear', exact: true }), READABLE, 'Clear button');

  await views.getByRole('button', { name: 'Git Graph' }).click();
  await expectLegible(page, page.getByText('Git Graph', { exact: true }), READABLE, 'Git Graph panel title');
});

test('program arguments field, its label, and the stream filter are paragraph-sized', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/SEBook/tools/python-tutorial');
  await waitForTutorialReady(page);
  await clickStep(page, 17); // "sys.argv & stderr" shows both controls

  await expectLegible(page, page.getByRole('textbox', { name: 'Command-line arguments (sys.argv)' }), READABLE, 'args field');
  await expectLegible(page, page.getByText('args:', { exact: true }), READABLE, 'args label');
  await expectLegible(page, page.getByRole('combobox', { name: 'Filter output streams' }), READABLE, 'stream filter');
});

test('live UML viewer toolbar is paragraph-sized inline and in full screen', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/SEBook/designpatterns/observer-tutorial');
  await waitForTutorialReady(page);

  const toolbarText = [
    [page.getByRole('button', { name: /(^|\s)(Output|UML Diagram)$/ }), 'panel tabs'],
    [page.getByRole('button', { name: /^(Class|Sequence) Diagram$/ }), 'diagram type buttons'],
    [page.getByText('100%', { exact: true }), 'zoom level'],
    [page.getByRole('button', { name: /Refresh/ }), 'Refresh button'],
  ];
  for (const [locator, what] of toolbarText) await expectLegible(page, locator, READABLE, what);

  await page.getByRole('button', { name: 'Fullscreen' }).filter({ visible: true }).click();
  const close = page.getByRole('button', { name: /Close/ });
  await expectLegible(page, close, READABLE, 'full-screen Close button');
  await expectLegible(page, page.getByText('100%', { exact: true }), READABLE, 'full-screen zoom level');
});

test('detached markers stay legible after popping out a file and the output', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/SEBook/tools/python-tutorial');
  await waitForTutorialReady(page);

  const popOutFile = page.getByRole('button', { name: 'Open hello.py in a separate window' });
  await page.getByRole('button', { name: 'hello.py', exact: true }).hover();
  const [filePopup] = await Promise.all([page.waitForEvent('popup'), popOutFile.click()]);
  await expectLegible(page, page.getByText(/^\(detached\)$/i), MICRO_LABEL, 'file tab "(detached)" pill');

  const [outputPopup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: 'Open output in separate window' }).click(),
  ]);
  await expectLegible(page, page.getByText(/^Output detached$/i), READABLE, 'floating "Output detached" notice');

  await Promise.all([filePopup.close(), outputPopup.close()]);
});
