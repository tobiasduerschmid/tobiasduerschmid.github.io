// @ts-check
const { test, expect } = require('@playwright/test');

const headingAbbrSelector = 'h1 abbr, h2 abbr, h3 abbr, h4 abbr, h5 abbr, h6 abbr';

function cssAttr(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function exactText(value) {
  return new RegExp(`^${String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
}

async function gotoOk(page, url) {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  expect(response && response.ok(), `${url} should load successfully`).toBeTruthy();
}

async function clickSwitch(page, selector) {
  await page.locator('label.switch', { has: page.locator(selector) }).click();
}

async function gotoTutorial(page, url) {
  await gotoOk(page, url);
  await expect(page.locator('.tvm-step-instructions')).toBeVisible({ timeout: 60_000 });
}

function abbr(scope, definition, text) {
  return scope
    .locator(`abbr[title="${cssAttr(definition)}"], abbr[data-original-title="${cssAttr(definition)}"]`)
    .filter({ hasText: exactText(text) })
    .first();
}

async function expectNoHeadingAbbr(scope) {
  await expect(scope.locator(headingAbbrSelector)).toHaveCount(0);
}

async function expectNoTabbableAbbr(scope) {
  await expect(scope.locator('abbr[tabindex]')).toHaveCount(0);
}

/**
 * Phase 1 WCAG-readiness checks. Verifies the new infrastructure added in
 * the WCAG 3 Phase 1 work renders correctly: glossary, abbr include,
 * shortcuts page, diagram <figure> wrapping, and the tutorial progress
 * indicator.
 */

test.describe('Glossary page', () => {
  test('lists terms, has working A–Z jump nav, search filters by term', async ({ page }) => {
    await gotoOk(page, '/glossary/');
    await expect(page.locator('h1')).toHaveText('Glossary');
    const entries = page.locator('.glossary-entry');
    await expect(entries.first()).toBeVisible();
    const totalEntries = await entries.count();
    expect(totalEntries).toBeGreaterThan(0);
    await expect(page.locator('.glossary-entry[data-term="rest"]')).toBeVisible();

    // Search filtering
    await page.fill('#glossary-search', 'rest');
    const visibleAfterFilter = await page
      .locator('.glossary-entry')
      .evaluateAll((els) => els.filter((e) => !e.hasAttribute('hidden')).length);
    expect(visibleAfterFilter).toBeGreaterThan(0);
    expect(visibleAfterFilter).toBeLessThan(totalEntries);
    await expect(page.locator('.glossary-entry[data-term="rest"]')).toBeVisible();

    // Status region updates
    const status = await page.locator('#glossary-search-status').textContent();
    expect(status).toContain('match');
  });

  test('A–Z jump nav marks empty letters as inert', async ({ page }) => {
    await gotoOk(page, '/glossary/');
    const emptyLinks = page.locator('.glossary-jump a.is-empty');
    const count = await emptyLinks.count();
    for (let i = 0; i < count; i++) {
      await expect(emptyLinks.nth(i)).toHaveAttribute('aria-disabled', 'true');
      await expect(emptyLinks.nth(i)).toHaveAttribute('tabindex', '-1');
    }
  });
});

test.describe('Shortcuts page', () => {
  test('renders with sectioned tables, kbd elements, and reporting link', async ({ page }) => {
    await gotoOk(page, '/shortcuts/');
    await expect(page.locator('h1')).toHaveText('Keyboard shortcuts');
    const tables = page.locator('table.shortcuts-table');
    const tableCount = await tables.count();
    expect(tableCount).toBeGreaterThan(0);
    await expect(page.locator('table.shortcuts-table caption')).toHaveCount(tableCount);
    await expect(page.locator('table.shortcuts-table th[scope="col"]')).toHaveCount(tableCount * 2);
    expect(await page.locator('table.shortcuts-table kbd').count()).toBeGreaterThan(0);
    await expect(page.getByRole('link', { name: /open an issue on github/i })).toBeVisible();
  });
});

test.describe('Footer accessibility links', () => {
  test('home page footer links to Glossary, Shortcuts, My Settings, and Browser storage', async ({ page }) => {
    await gotoOk(page, '/');
    const footer = page.locator('footer');
    await expect(footer.getByRole('link', { name: 'Glossary' })).toHaveAttribute('href', /\/glossary\/$/);
    await expect(footer.getByRole('link', { name: 'Keyboard shortcuts' })).toHaveAttribute('href', /\/shortcuts\/$/);
    await expect(footer.getByRole('link', { name: 'My Settings' })).toHaveAttribute('href', /\/settings\/$/);
    await expect(footer.getByRole('link', { name: 'Browser storage' })).toHaveAttribute('href', /\/cookies\/$/);
  });
});

test.describe('Settings page', () => {
  test('renders user-facing settings and writes preferences locally', async ({ page }) => {
    await gotoOk(page, '/settings/');
    await expect(page.locator('h1')).toHaveText('My Settings');
    await expect(page.getByLabel('Dark mode')).toBeVisible();
    await expect(page.getByLabel('Reduced motion')).toBeVisible();
    await expect(page.getByLabel('Underline glossary abbreviations')).toBeVisible();
    await expect(page.getByLabel('Autosave tutorial work')).toBeVisible();
    await expect(page.getByLabel('Timed practice')).toBeVisible();
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

    await clickSwitch(page, '#setting-timed-practice');
    expect(await page.evaluate(() => document.cookie)).toContain('se-gym-timed-practice=true');
    await page.getByLabel('How to set the timer').selectOption('per-question');
    await expect(page.getByLabel('Seconds per card')).toHaveAttribute('min', '1');
    await page.getByLabel('Seconds per card').fill('1');
    await page.getByLabel('Seconds per card').dispatchEvent('change');
    const settingsCookies = await page.evaluate(() => document.cookie);
    expect(settingsCookies).toContain('se-gym-timer-mode=per-question');
    expect(settingsCookies).toContain('se-gym-timer-seconds-per-question=1');
  });
});

test.describe('Automatic glossary abbreviations', () => {
  test('renders SEBook glossary terms and plural forms as abbr elements', async ({ page }) => {
    await gotoOk(page, '/SEBook/userstories.html');
    let main = page.locator('main');
    await expect(abbr(main.locator('p'), 'Independent, Negotiable, Valuable, Estimable, Small, Testable', 'INVEST')).toHaveText('INVEST');
    await expect(abbr(main, 'Application Programming Interface', 'APIs')).toHaveText('APIs');
    await expectNoHeadingAbbr(main);
    await expect(page.locator('main pre abbr')).toHaveCount(0);
    await expectNoTabbableAbbr(main);

    await gotoOk(page, '/SEBook/systems/');
    main = page.locator('main');
    await expect(abbr(main.locator('p'), 'Consistency, Availability, Partition tolerance', 'CAP')).toHaveText('CAP');
    await expectNoHeadingAbbr(main);
    await expectNoTabbableAbbr(main);

    await gotoOk(page, '/SEBook/tools/networking.html');
    main = page.locator('main');
    await expect(abbr(main, 'Internet Protocol', 'IP')).toHaveText('IP');
    await expect(abbr(main, 'Domain Name System', 'DNS')).toHaveText('DNS');
    await expect(abbr(main, 'Operating System', 'OS')).toHaveText('OS');
    await expect(abbr(main, 'HyperText Transfer Protocol Secure', 'HTTPS')).toHaveText('HTTPS');
    await expectNoHeadingAbbr(main);
    await expectNoTabbableAbbr(main);
  });

  test('renders tutorial instructions with glossary abbreviations', async ({ page }) => {
    await gotoTutorial(page, '/SEBook/tools/sql-tutorial.html');
    let instructions = page.locator('.tvm-step-instructions');
    const sql = abbr(instructions.locator('p'), 'Structured Query Language', 'SQL');
    await expect(sql).toHaveText('SQL');
    await expect(sql).toHaveAttribute('data-no-tooltip', 'true');
    await expectNoHeadingAbbr(instructions);
    await expectNoTabbableAbbr(instructions);

    await gotoTutorial(page, '/SEBook/tools/react-tutorial.html');
    instructions = page.locator('.tvm-step-instructions');
    const jsx = abbr(instructions, 'JavaScript XML', 'JSX');
    await expect(jsx).toHaveText('JSX');
    await expectNoHeadingAbbr(instructions);
    await expectNoTabbableAbbr(instructions);
  });

  test('renders blog post glossary abbreviations', async ({ page }) => {
    await gotoOk(page, '/blog/evidence-based-study-tips-for-college-students/');
    const main = page.locator('main');
    await expect(abbr(main.locator('p'), 'HyperText Markup Language', 'HTML')).toHaveText('HTML');
    await expectNoHeadingAbbr(main);
    await expect(page.locator('main code abbr')).toHaveCount(0);
    await expectNoTabbableAbbr(main);
  });

  test('honors abbreviation underline setting without rendering abbreviations in headings', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('abbr-underlines', 'false'));
    await gotoOk(page, '/SEBook/tools/networking.html');

    const main = page.locator('main');
    const ip = abbr(main, 'Internet Protocol', 'IP');
    await expect(ip).toHaveText('IP');
    await expect(page.locator('html')).toHaveClass(/abbr-underlines-disabled/);
    expect(await ip.evaluate((el) => getComputedStyle(el).textDecorationLine)).not.toContain('underline');
    expect(await ip.evaluate((el) => getComputedStyle(el).borderBottomStyle)).toBe('none');
    await expectNoHeadingAbbr(main);
  });
});

test.describe('Diagram <figure> wrapping', () => {
  test('ArchUML diagrams in SEBook are wrapped in <figure> with <figcaption>', async ({ page }) => {
    await gotoOk(page, '/SEBook/tools/networking.html');
    // Wait for the ArchUML auto-init to kick in (fonts.ready + a settle pass).
    await page.waitForSelector('figure.sebook-figure--archuml', { timeout: 15_000 });

    const figures = page.locator('figure.sebook-figure--archuml');
    expect(await figures.count()).toBeGreaterThan(0);

    const figureAudit = await figures.evaluateAll((els) => els.map((figure) => {
      const caption = figure.querySelector('figcaption.sebook-figure__caption');
      const image = figure.querySelector('[role="img"]');
      return {
        hasCaptionText: !!(caption && caption.textContent && caption.textContent.trim()),
        hasImageLabel: !!(image && image.getAttribute('aria-label') && image.getAttribute('aria-label').trim()),
      };
    }));
    expect(figureAudit.every((item) => item.hasCaptionText && item.hasImageLabel)).toBe(true);
  });
});

test.describe('Tutorial step status', () => {
  test('python tutorial nav exposes a status announcement for the current step', async ({ page }) => {
    test.setTimeout(120_000);
    await gotoTutorial(page, '/SEBook/tools/python-tutorial.html');
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
