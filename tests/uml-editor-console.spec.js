// @ts-check
// Console oracle of the UML editor refactor (spec §9.4 point 4): the three pages that include the
// editor log no console error and throw no page error while they load and draw their first diagram.
const { test, expect } = require('@playwright/test');

const EDITOR_PAGES = [
  '/SEBook/tools/uml-editor',
  '/SEBook/tools/uml-playground',
  '/SEBook/designpatterns/monopoly-state-pattern-uml-homework',
];

// Errors that were already logged at stage R0, each with its reason (PR-5: reported, not fixed).
// A later stage may not add an entry. Shape: { page, text: RegExp, reason }.
const PRESENT_AT_R0 = [];

function isPresentAtR0(error) {
  return PRESENT_AT_R0.some(known => known.page === error.page && known.text.test(error.text));
}

test('the UML editor, the playground, and the Monopoly UML homework load without console errors or page errors', async ({ page }) => {
  const errors = [];
  let currentPage = '';
  page.on('console', message => {
    if (message.type() === 'error') errors.push({ page: currentPage, kind: 'console', text: message.text() });
  });
  page.on('pageerror', error => errors.push({ page: currentPage, kind: 'page error', text: error.message }));

  for (const url of EDITOR_PAGES) {
    currentPage = url;
    await page.goto(url);
    // The editor's script reveals its palette once it has started.
    await expect(page.getByRole('region', { name: 'Visual editor palette', exact: true })).toBeVisible();
    // Failed requests are console errors too, and the first drawing follows a render debounce:
    // wait until the page has stopped loading resources.
    await page.waitForLoadState('networkidle');
  }

  expect(errors.filter(error => !isPresentAtR0(error))).toEqual([]);
});
