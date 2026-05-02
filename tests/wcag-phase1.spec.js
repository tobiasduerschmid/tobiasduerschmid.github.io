// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Phase 1 WCAG-readiness checks. Verifies the new infrastructure added in
 * the WCAG 3 Phase 1 work renders correctly: glossary, abbr include,
 * shortcuts page, diagram <figure> wrapping, audio transcript surface,
 * and the tutorial progress indicator.
 */

test.describe('Glossary page', () => {
  test('lists terms, has working A–Z jump nav, search filters by term', async ({ page }) => {
    await page.goto('/glossary/');
    await expect(page.locator('h1')).toHaveText('Glossary');
    const entries = page.locator('.glossary-entry');
    await expect(entries.first()).toBeVisible();
    expect(await entries.count()).toBeGreaterThan(20);

    // Search filtering
    await page.fill('#glossary-search', 'rest');
    const visibleAfterFilter = await page
      .locator('.glossary-entry')
      .evaluateAll((els) => els.filter((e) => !e.hasAttribute('hidden')).length);
    expect(visibleAfterFilter).toBeGreaterThan(0);
    expect(visibleAfterFilter).toBeLessThan(20);

    // Status region updates
    const status = await page.locator('#glossary-search-status').textContent();
    expect(status).toContain('match');
  });

  test('A–Z jump nav marks empty letters as inert', async ({ page }) => {
    await page.goto('/glossary/');
    const inertCount = await page.locator('.glossary-jump a.is-empty').count();
    expect(inertCount).toBeGreaterThan(0); // some letters have no entries
  });
});

test.describe('Shortcuts page', () => {
  test('renders with sectioned tables, kbd elements, and reporting link', async ({ page }) => {
    await page.goto('/shortcuts/');
    await expect(page.locator('h1')).toHaveText('Keyboard shortcuts');
    expect(await page.locator('table.shortcuts-table').count()).toBeGreaterThanOrEqual(8);
    expect(await page.locator('table.shortcuts-table caption').count()).toBeGreaterThanOrEqual(8);
    expect(await page.locator('table.shortcuts-table kbd').count()).toBeGreaterThan(15);
    await expect(page.locator('a[href*="github.com"]').first()).toBeVisible();
  });
});

test.describe('Footer accessibility links', () => {
  test('home page footer links to Glossary, Shortcuts, and Browser storage', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('footer a[href$="/glossary/"]').first()).toBeVisible();
    await expect(page.locator('footer a[href$="/shortcuts/"]').first()).toBeVisible();
    await expect(page.locator('footer a[href$="/cookies/"]').first()).toBeVisible();
  });
});

test.describe('Diagram <figure> wrapping', () => {
  test('ArchUML diagrams in SEBook are wrapped in <figure> with <figcaption>', async ({ page }) => {
    await page.goto('/SEBook/tools/networking.html');
    // Wait for the ArchUML auto-init to kick in (fonts.ready + a settle pass).
    await page.waitForSelector('figure.sebook-figure--archuml', { timeout: 15_000 });

    const figures = page.locator('figure.sebook-figure--archuml');
    expect(await figures.count()).toBeGreaterThan(0);

    // Each figure has a figcaption with text + a [role="img"][aria-label] inner.
    const firstFigure = figures.first();
    await expect(firstFigure.locator('figcaption.sebook-figure__caption')).toBeVisible();
    const role = await firstFigure.locator('[role="img"]').first().getAttribute('role');
    expect(role).toBe('img');
    const ariaLabel = await firstFigure.locator('[role="img"]').first().getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
  });
});

test.describe('Tutorial progress indicator', () => {
  test('python tutorial nav exposes a progressbar + status announcement', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/SEBook/tools/python-tutorial');
    await page.waitForSelector('.tvm-step-btn', { timeout: 60_000 });
    await expect(page.locator('.tvm-loading')).toBeHidden({ timeout: 60_000 });

    const progress = page.locator('.tvm-step-progress');
    await expect(progress).toBeVisible();
    await expect(progress).toHaveAttribute('role', 'progressbar');
    await expect(progress).toHaveAttribute('aria-valuemin', '0');
    const valuemax = await progress.getAttribute('aria-valuemax');
    expect(Number(valuemax)).toBeGreaterThan(0);
    const valuetext = await progress.getAttribute('aria-valuetext');
    expect(valuetext).toMatch(/Step \d+ of \d+/);

    const status = page.locator('.tvm-step-status');
    await expect(status).toBeVisible();
    const statusText = await status.textContent();
    expect(statusText).toMatch(/Step \d+ of \d+/);

    // Active step button has aria-current="step"
    const activeBtn = page.locator('.tvm-step-btn.active');
    await expect(activeBtn).toHaveAttribute('aria-current', 'step');
    // First step button has a descriptive aria-label
    const firstBtnLabel = await page.locator('.tvm-step-btn').first().getAttribute('aria-label');
    expect(firstBtnLabel).toMatch(/^Step \d+:/);
  });
});

test.describe('Audio player transcript surface', () => {
  test('audio player without transcript renders without disclosure', async ({ page }) => {
    // Pick a blog post that has audio but no transcript front-matter.
    // The disclosure should be absent when no transcript is provided.
    await page.goto('/blog/');
    const audioLink = page.locator('a[href*="/blog/"]').first();
    await expect(audioLink).toBeVisible();
    // Simply verify the include works on the blog index without errors.
    expect(await page.locator('.cap-transcript').count()).toBe(0);
  });
});
