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

test.describe('Blog Navigation Highlighting', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/blog/evidence-based-study-tips-for-college-students/');
    await page.waitForLoadState('networkidle');
  });

  test('clicking a navbar link highlights the matching blog section', async ({ page }) => {
    const navLinks = page.locator('#navnav .navbar-nav a[href^="#"]');
    const count = await navLinks.count();

    expect(count, 'Blog navbar should expose section links').toBeGreaterThan(2);

    const link = navLinks.nth(1);
    const targetId = await link.getAttribute('href');
    expect(targetId).toBeTruthy();

    await expect(page.locator(targetId), `Expected section ${targetId} to exist`).toHaveCount(1);
    await link.click();
    await expectNavLinkActive(page, targetId);
  });

  test('scrolling into a blog section highlights the matching navbar item', async ({ page }) => {
    const navLinks = page.locator('#navnav .navbar-nav a[href^="#"]');
    const count = await navLinks.count();

    expect(count, 'Blog navbar should expose section links').toBeGreaterThan(2);

    const targetId = await navLinks.nth(2).getAttribute('href');
    expect(targetId).toBeTruthy();

    const section = page.locator(targetId);
    await expect(section, `Expected section ${targetId} to exist`).toHaveCount(1);

    await page.evaluate((selector) => {
      const el = document.querySelector(selector);
      if (!(el instanceof HTMLElement)) return;
      const nav = document.getElementById('navnav');
      const navHeight = nav ? nav.offsetHeight : 50;
      const top = el.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo(0, Math.max(0, top - navHeight - 8));
    }, targetId);

    await expectNavLinkActive(page, targetId);
  });
});
