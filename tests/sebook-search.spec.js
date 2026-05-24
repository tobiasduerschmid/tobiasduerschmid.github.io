// @ts-check
/**
 * Tests: SE Book homepage section search
 *
 * Acceptance criteria for the user story:
 *
 *   As a CS 35L student using the SE Book, I want a search bar that filters
 *   section/tutorial titles in real time so that I can quickly find the
 *   relevant sections in the book to help with my studying.
 *
 *   AC 1: Given the user is on the SE Book homepage, when the user views the
 *         page, then a search input field is visible.
 *   AC 2: Given the user types into the search bar on the homepage, when
 *         section titles match the search, then only matching titles are
 *         displayed.
 *   AC 3: Given no section titles match the search, when the search is
 *         completed, then a "no results found" message is displayed.
 *
 * Each acceptance criterion is covered by at least one test below. Additional
 * tests cover related WCAG 2.2 AA requirements that fall out of the design:
 * the input must be labelled, the no-results message must be announced to
 * assistive tech via aria-live, and the search must keep working in dark
 * mode (the project rule per CLAUDE.md).
 */

const { test, expect } = require('@playwright/test');

const SEARCH_INPUT = '#sebook-search-input';
const RESULTS_LIST = '#sebook-search-results';
const NO_RESULTS = '#sebook-search-no-results';
const SUMMARY = '#sebook-search-summary';
const CLEAR_BUTTON = '#sebook-search-clear';

test.describe('SE Book homepage search — acceptance criteria', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/SEBook/');
  });

  // AC 1
  test('AC1: a search input field is visible on the SE Book homepage', async ({ page }) => {
    const input = page.locator(SEARCH_INPUT);
    await expect(input, 'search input should exist on the homepage').toHaveCount(1);
    await expect(input, 'search input should be visible without interaction').toBeVisible();
    // The element must be a real form input the user can type into, not just a styled div.
    await expect(input).toHaveAttribute('type', 'search');
    // It must be reachable by keyboard (no tabindex="-1", not disabled).
    await expect(input).toBeEnabled();
    await expect(input).not.toHaveAttribute('tabindex', '-1');
  });

  // AC 2 — matching titles
  test('AC2: typing filters the visible titles to those that match', async ({ page }) => {
    const input = page.locator(SEARCH_INPUT);
    const allResults = page.locator(`${RESULTS_LIST} .sebook-search-result`);
    const visibleResults = page.locator(`${RESULTS_LIST} .sebook-search-result:not([hidden])`);

    const totalBefore = await allResults.count();
    expect(totalBefore, 'homepage should render multiple section titles before filtering').toBeGreaterThan(5);

    // Type a query that should match only the "UML" entries.
    await input.fill('UML');

    const visibleCount = await visibleResults.count();
    expect(visibleCount, 'at least one UML entry should remain visible').toBeGreaterThan(0);
    expect(visibleCount, 'non-matching titles should be hidden').toBeLessThan(totalBefore);

    // Every visible title must contain the query (case-insensitive).
    const visibleTitles = await visibleResults.locator('.sebook-search-result-title').allTextContents();
    for (const title of visibleTitles) {
      expect(title.toLowerCase()).toContain('uml');
    }
  });

  // AC 2 — case-insensitive filtering also works for tutorial titles
  test('AC2: filtering is case-insensitive and matches tutorial titles', async ({ page }) => {
    const input = page.locator(SEARCH_INPUT);
    await input.fill('TUTORIAL');

    const visible = page.locator(`${RESULTS_LIST} .sebook-search-result:not([hidden])`);
    const titles = await visible.locator('.sebook-search-result-title').allTextContents();
    expect(titles.length, 'tutorial-named entries should match a case-insensitive query').toBeGreaterThan(0);
    for (const title of titles) {
      expect(title.toLowerCase()).toContain('tutorial');
    }
  });

  // AC 2 — clearing brings everything back
  test('AC2: clearing the input restores all titles', async ({ page }) => {
    const input = page.locator(SEARCH_INPUT);
    const allResults = page.locator(`${RESULTS_LIST} .sebook-search-result`);
    const visibleResults = page.locator(`${RESULTS_LIST} .sebook-search-result:not([hidden])`);
    const totalBefore = await allResults.count();

    await input.fill('UML');
    const visibleWhileFiltered = await visibleResults.count();
    expect(visibleWhileFiltered).toBeLessThan(totalBefore);

    await input.fill('');
    await expect.poll(async () => visibleResults.count()).toBe(totalBefore);
  });

  // AC 3
  test('AC3: typing a non-matching query shows the "no results found" message', async ({ page }) => {
    const input = page.locator(SEARCH_INPUT);
    const noResults = page.locator(NO_RESULTS);

    // Initially the no-results message is hidden.
    await expect(noResults).toBeHidden();

    // Type a query no section title will ever match.
    await input.fill('zzzzz-nonsense-query-no-section-uses-this');

    await expect(noResults, 'no-results message should appear').toBeVisible();
    await expect(noResults).toHaveText(/no results found/i);

    // The results list should be hidden (or contain zero visible items)
    // since none match.
    const visible = page.locator(`${RESULTS_LIST} .sebook-search-result:not([hidden])`);
    expect(await visible.count()).toBe(0);
  });

  // AC 3 — recovery
  test('AC3: clearing after no-results hides the no-results message', async ({ page }) => {
    const input = page.locator(SEARCH_INPUT);
    const noResults = page.locator(NO_RESULTS);

    await input.fill('zzzzz-nonsense-query-no-section-uses-this');
    await expect(noResults).toBeVisible();

    await input.fill('');
    await expect(noResults).toBeHidden();
  });
});

test.describe('SE Book homepage search — WCAG 2.2 AA support', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/SEBook/');
  });

  test('search input has an accessible name from a real <label>', async ({ page }) => {
    const input = page.locator(SEARCH_INPUT);
    // The label[for="sebook-search-input"] gives the input its accessible name.
    const labelText = await page.locator('label[for="sebook-search-input"]').innerText();
    expect(labelText.trim().length, 'label must provide a non-empty accessible name').toBeGreaterThan(0);
  });

  test('no-results message uses aria-live so screen readers announce it', async ({ page }) => {
    // The summary region carries aria-live; the message itself is targeted by
    // the summary as new text. Verify the live region is wired up.
    const summary = page.locator(SUMMARY);
    await expect(summary).toHaveAttribute('aria-live', 'polite');
    await expect(summary).toHaveAttribute('role', 'status');

    // Trigger a no-results state and confirm the summary updates.
    await page.locator(SEARCH_INPUT).fill('zzzzz-nonsense-query');
    await expect(summary).toHaveText(/no results found/i);
  });

  test('typing summary announces match counts via the status region', async ({ page }) => {
    const summary = page.locator(SUMMARY);
    await page.locator(SEARCH_INPUT).fill('UML');
    // The status text mentions a count when there are matches.
    await expect(summary).toContainText(/match/i);
  });

  test('clear button becomes operable when there is text and clears the input', async ({ page }) => {
    const clear = page.locator(CLEAR_BUTTON);
    const input = page.locator(SEARCH_INPUT);

    await expect(clear, 'clear button is hidden when input is empty').toBeHidden();

    await input.fill('UML');
    await expect(clear, 'clear button appears when input has content').toBeVisible();

    // The button must meet a minimum target size (≥ 24 CSS px per WCAG 2.5.8).
    const box = await clear.boundingBox();
    expect(box).toBeTruthy();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(24);
      expect(box.height).toBeGreaterThanOrEqual(24);
    }

    await clear.click();
    await expect(input).toHaveValue('');
    await expect(clear).toBeHidden();
  });

  test('Escape clears the input when it has text', async ({ page }) => {
    const input = page.locator(SEARCH_INPUT);
    await input.fill('UML');
    await expect(input).toHaveValue('UML');
    await input.press('Escape');
    await expect(input).toHaveValue('');
  });

  test('search works after enabling dark mode (light/dark mode rule)', async ({ page }) => {
    // Per CLAUDE.md, every CSS change must work in both light and dark mode.
    await page.locator('#darkModeToggle').setChecked(true, { force: true });
    await expect.poll(() => page.evaluate(() =>
      document.documentElement.classList.contains('dark-mode')
    )).toBe(true);

    // The search must still filter and render the no-results message in dark mode.
    const input = page.locator(SEARCH_INPUT);
    await input.fill('UML');
    const visible = page.locator(`${RESULTS_LIST} .sebook-search-result:not([hidden])`);
    expect(await visible.count()).toBeGreaterThan(0);

    await input.fill('zzzzz-nonsense-query');
    await expect(page.locator(NO_RESULTS)).toBeVisible();
  });
});
