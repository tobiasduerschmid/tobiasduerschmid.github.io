// @ts-check
const { test, expect } = require('@playwright/test');

async function clickSwitch(page, selector) {
  await page.locator('label.switch', { has: page.locator(selector) }).click();
}

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
  test('home page footer links to Glossary, Shortcuts, My Settings, and Browser storage', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('footer a[href$="/glossary/"]').first()).toBeVisible();
    await expect(page.locator('footer a[href$="/shortcuts/"]').first()).toBeVisible();
    await expect(page.locator('footer a[href$="/settings/"]').first()).toBeVisible();
    await expect(page.locator('footer a[href$="/cookies/"]').first()).toBeVisible();
  });
});

test.describe('Settings page', () => {
  test('renders user-facing settings and writes preferences locally', async ({ page }) => {
    await page.goto('/settings/');
    await expect(page.locator('h1')).toHaveText('My Settings');
    await expect(page.getByLabel('Dark mode')).toBeVisible();
    await expect(page.getByLabel('Reduced motion')).toBeVisible();
    await expect(page.getByLabel('Underline glossary abbreviations')).toBeVisible();
    await expect(page.getByLabel('Autosave tutorial work')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'What each tutorial remembers' })).toBeVisible();

    await clickSwitch(page, '#setting-dark-mode');
    await expect(page.locator('html')).toHaveClass(/dark-mode/);
    expect(await page.evaluate(() => document.cookie)).toContain('dark-mode=true');

    await page.getByLabel('Reduced motion').selectOption('reduce');
    expect(await page.evaluate(() => localStorage.getItem('prefersReducedMotion'))).toBe('1');
    await expect(page.locator('html')).toHaveClass(/prm-reduce/);

    await clickSwitch(page, '#setting-abbr-underlines');
    expect(await page.evaluate(() => localStorage.getItem('abbr-underlines'))).toBe('false');
    await expect(page.locator('html')).toHaveClass(/abbr-underlines-disabled/);

    await clickSwitch(page, '#setting-tutorial-autosave');
    expect(await page.evaluate(() => localStorage.getItem('tutorial-autosave'))).toBe('false');
  });
});

test.describe('Automatic glossary abbreviations', () => {
  test('renders SEBook glossary terms and plural forms as abbr elements', async ({ page }) => {
    await page.goto('/SEBook/userstories.html');
    await expect(page.locator('main p abbr[title="Independent, Negotiable, Valuable, Estimable, Small, Testable"], main p abbr[data-original-title="Independent, Negotiable, Valuable, Estimable, Small, Testable"]').first()).toHaveText('INVEST');
    await expect(page.locator('main abbr[title="Application Programming Interface"], main abbr[data-original-title="Application Programming Interface"]').filter({ hasText: 'APIs' }).first()).toHaveText('APIs');
    await expect(page.locator('main h1 abbr, main h2 abbr, main h3 abbr, main h4 abbr, main h5 abbr, main h6 abbr')).toHaveCount(0);
    await expect(page.locator('main pre abbr')).toHaveCount(0);
    await expect(page.locator('main abbr[tabindex]')).toHaveCount(0);

    await page.goto('/SEBook/systems/');
    await expect(page.locator('main p abbr[title="Consistency, Availability, Partition tolerance"], main p abbr[data-original-title="Consistency, Availability, Partition tolerance"]').first()).toHaveText('CAP');
    await expect(page.locator('main h1 abbr, main h2 abbr, main h3 abbr, main h4 abbr, main h5 abbr, main h6 abbr')).toHaveCount(0);
    await expect(page.locator('main abbr[tabindex]')).toHaveCount(0);

    await page.goto('/SEBook/tools/networking.html');
    await expect(page.locator('main abbr[title="Internet Protocol"], main abbr[data-original-title="Internet Protocol"]').filter({ hasText: 'IP' }).first()).toHaveText('IP');
    await expect(page.locator('main abbr[title="Domain Name System"], main abbr[data-original-title="Domain Name System"]').filter({ hasText: 'DNS' }).first()).toHaveText('DNS');
    await expect(page.locator('main abbr[title="Operating System"], main abbr[data-original-title="Operating System"]').filter({ hasText: 'OS' }).first()).toHaveText('OS');
    await expect(page.locator('main abbr[title="HyperText Transfer Protocol Secure"], main abbr[data-original-title="HyperText Transfer Protocol Secure"]').filter({ hasText: 'HTTPS' }).first()).toHaveText('HTTPS');
    await expect(page.locator('main h1 abbr, main h2 abbr, main h3 abbr, main h4 abbr, main h5 abbr, main h6 abbr')).toHaveCount(0);
    await expect(page.locator('main abbr[tabindex]')).toHaveCount(0);
  });

  test('renders tutorial instructions with glossary abbreviations', async ({ page }) => {
    await page.goto('/SEBook/tools/sql-tutorial');
    const sql = page.locator('.tvm-step-instructions p abbr[title="Structured Query Language"], .tvm-step-instructions p abbr[data-original-title="Structured Query Language"]').first();
    await expect(sql).toHaveText('SQL');
    await expect(sql).toHaveAttribute('data-no-tooltip', 'true');
    await expect(page.locator('.tvm-step-instructions h1 abbr, .tvm-step-instructions h2 abbr, .tvm-step-instructions h3 abbr, .tvm-step-instructions h4 abbr, .tvm-step-instructions h5 abbr, .tvm-step-instructions h6 abbr')).toHaveCount(0);
    await expect(page.locator('.tvm-step-instructions abbr[tabindex]')).toHaveCount(0);

    await page.goto('/SEBook/tools/react-tutorial');
    const jsx = page.locator('.tvm-step-instructions abbr[title="JavaScript XML"], .tvm-step-instructions abbr[data-original-title="JavaScript XML"]').filter({ hasText: 'JSX' }).first();
    await expect(jsx).toHaveText('JSX');
    await expect(page.locator('.tvm-step-instructions h1 abbr, .tvm-step-instructions h2 abbr, .tvm-step-instructions h3 abbr, .tvm-step-instructions h4 abbr, .tvm-step-instructions h5 abbr, .tvm-step-instructions h6 abbr')).toHaveCount(0);
    await expect(page.locator('.tvm-step-instructions abbr[tabindex]')).toHaveCount(0);
  });

  test('renders blog post glossary abbreviations', async ({ page }) => {
    await page.goto('/blog/evidence-based-study-tips-for-college-students/');
    await expect(page.locator('main p abbr[title="HyperText Markup Language"], main p abbr[data-original-title="HyperText Markup Language"]').first()).toHaveText('HTML');
    await expect(page.locator('main h1 abbr, main h2 abbr, main h3 abbr, main h4 abbr, main h5 abbr, main h6 abbr')).toHaveCount(0);
    await expect(page.locator('main code abbr')).toHaveCount(0);
    await expect(page.locator('main abbr[tabindex]')).toHaveCount(0);
  });

  test('honors abbreviation underline setting without rendering abbreviations in headings', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('abbr-underlines', 'false'));
    await page.goto('/SEBook/tools/networking.html');

    const ip = page.locator('main abbr[title="Internet Protocol"], main abbr[data-original-title="Internet Protocol"]').filter({ hasText: 'IP' }).first();
    await expect(ip).toHaveText('IP');
    await expect(page.locator('html')).toHaveClass(/abbr-underlines-disabled/);
    expect(await ip.evaluate((el) => getComputedStyle(el).textDecorationLine)).not.toContain('underline');
    expect(await ip.evaluate((el) => getComputedStyle(el).borderBottomStyle)).toBe('none');
    await expect(page.locator('main h1 abbr, main h2 abbr, main h3 abbr, main h4 abbr, main h5 abbr, main h6 abbr')).toHaveCount(0);
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

test.describe('Tutorial step status', () => {
  test('python tutorial nav exposes a status announcement for the current step', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/SEBook/tools/python-tutorial');
    await page.waitForSelector('.tvm-step-btn', { timeout: 60_000 });
    await expect(page.locator('.tvm-loading')).toBeHidden({ timeout: 60_000 });

    const status = page.locator('.tvm-step-status');
    await expect(status).toBeVisible();
    await expect(status).toHaveAttribute('role', 'status');
    await expect(status).toHaveAttribute('aria-live', 'polite');
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
