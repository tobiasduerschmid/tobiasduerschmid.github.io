// @ts-check
const { test, expect } = require('@playwright/test');

async function expectNavLinkActive(page, targetId) {
  await expect
    .poll(async () => page.evaluate((href) => {
      const link = document.querySelector(`#navnav .navbar-nav a[href="${href}"]`);
      const item = link && link.closest('li');
      const linkClass = link ? link.className : '';
      const itemClass = item ? item.className : '';
      return /\bactive\b/.test(linkClass) || /\bactive\b/.test(itemClass);
    }, targetId), {
      timeout: 5000,
      message: `Expected nav link ${targetId} or its parent item to become active`
    })
    .toBe(true);
}

async function expectToggleRowVisible(page, toggleId, visible) {
  await expect
    .poll(async () => page.evaluate(({ id }) => {
      const input = document.getElementById(id);
      const row = input && input.closest('div');
      return row ? getComputedStyle(row).display : null;
    }, { id: toggleId }), {
      timeout: 5000,
      message: `Expected ${toggleId} row visibility to be ${visible}`
    })
    .toBe(visible ? 'flex' : 'none');
}

/**
 * Tests: SEBook Navigation Highlighting
 * 
 * Verifies that navigating within the SEBook (via links or scrolling)
 * correctly highlights the active category in the navbar.
 */

test.describe('SEBook Navigation Highlighting', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/SEBook/designpatterns.html');
    await page.waitForLoadState('networkidle');
  });

  test('clicking a navbar link highlights the category', async ({ page }) => {
    const navLinks = page.locator('#navnav .navbar-nav a[href^="#"]');
    const count = await navLinks.count();

    expect(count, 'Navbar should expose internal section links').toBeGreaterThan(2);

    const link = navLinks.nth(1);
    const targetId = await link.getAttribute('href');
    expect(targetId).toBeTruthy();

    await expect(page.locator(targetId), `Expected section ${targetId} to exist`).toHaveCount(1);
    await link.click();
    await expectNavLinkActive(page, targetId);
  });

  test('scrolling manually highlights the category', async ({ page }) => {
    const navLinks = page.locator('#navnav .navbar-nav a[href^="#"]');
    const count = await navLinks.count();

    expect(count, 'Navbar should expose internal section links').toBeGreaterThan(2);

    const targetId = await navLinks.nth(2).getAttribute('href');
    expect(targetId).toBeTruthy();

    const section = page.locator(targetId);
    await expect(section, `Expected section ${targetId} to exist`).toHaveCount(1);

    await page.evaluate((selector) => {
      const el = document.querySelector(selector);
      if (el instanceof HTMLElement) {
        const nav = document.getElementById('navnav');
        const navHeight = nav ? nav.offsetHeight : 50;
        const top = el.getBoundingClientRect().top + window.pageYOffset;
        window.scrollTo(0, Math.max(0, top - navHeight - 8));
      }
    }, targetId);

    await expectNavLinkActive(page, targetId);
  });
});

test.describe('SEBook page toggles', () => {
  test('dark mode toggle updates the document theme state', async ({ page }) => {
    await page.goto('/SEBook/designpatterns.html');

    await expectToggleRowVisible(page, 'darkModeToggle', true);
    await page.locator('#darkModeToggle').setChecked(true, { force: true });

    await expect
      .poll(() => page.evaluate(() => document.documentElement.classList.contains('dark-mode')))
      .toBe(true);
    await expect
      .poll(() => page.evaluate(() => document.cookie.includes('dark-mode=true')))
      .toBe(true);

    await page.locator('#darkModeToggle').setChecked(false, { force: true });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.classList.contains('dark-mode')))
      .toBe(false);
  });

  test('highlights toggle is shown only when marks exist and controls mark styling', async ({ page }) => {
    await page.goto('/SEBook/designpatterns.html');

    await expect(page.locator('#main-content mark').first()).toBeVisible();
    await expectToggleRowVisible(page, 'highlightToggle', true);

    await page.locator('#highlightToggle').setChecked(false, { force: true });

    await expect
      .poll(() => page.evaluate(() => document.documentElement.classList.contains('highlights-disabled')))
      .toBe(true);
    await expect
      .poll(() => page.locator('#main-content mark').first().evaluate((mark) => getComputedStyle(mark).backgroundColor))
      .toBe('rgba(0, 0, 0, 0)');

    await page.goto('/SEBook/uml.html');
    await expect(page.locator('#main-content mark')).toHaveCount(0);
    await expectToggleRowVisible(page, 'highlightToggle', false);
  });

  test('read-aloud toggle is shown only when audio players exist and controls player visibility', async ({ page }) => {
    await page.goto('/SEBook/process/scrum.html');

    await expect(page.locator('#main-content .cap').first()).toBeVisible();
    await expectToggleRowVisible(page, 'readAloudToggle', true);

    await page.locator('#readAloudToggle').setChecked(false, { force: true });

    await expect
      .poll(() => page.evaluate(() => document.documentElement.classList.contains('read-aloud-enabled')))
      .toBe(false);
    await expect
      .poll(() => page.locator('#main-content .cap').first().evaluate((player) => getComputedStyle(player).display))
      .toBe('none');

    await page.goto('/SEBook/uml.html');
    await expect(page.locator('#main-content .cap')).toHaveCount(0);
    await expectToggleRowVisible(page, 'readAloudToggle', false);
  });
});
