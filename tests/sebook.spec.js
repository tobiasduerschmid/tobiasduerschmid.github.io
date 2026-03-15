// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Tests: SEBook Navigation Highlighting
 * 
 * Verifies that navigating within the SEBook (via links or scrolling)
 * correctly highlights the active category in the navbar.
 */

test.describe('SEBook Navigation Highlighting', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a page with H1 sections to ensure navbar is populated
    await page.goto('/SEBook/requirements.html');
    await page.waitForLoadState('networkidle');
  });

  test('clicking a navbar link highlights the category', async ({ page }) => {
    // Collect all links in the project navbar that are internal fragments
    const navLinks = page.locator('#navnav .navbar-nav a[href^="#"]');
    const count = await navLinks.count();
    
    expect(count, 'Navbar should have at least one internal link').toBeGreaterThan(0);

    for (let i = 0; i < Math.min(count, 3); i++) {
      const link = navLinks.nth(i);
      const targetId = await link.getAttribute('href');
      if (!targetId || targetId === '#') continue;

      await link.click();
      
      // Use toPass to handle smooth scroll and scrollspy delay
      await expect(async () => {
        const parentLi = page.locator(`#navnav .navbar-nav li`).filter({ has: page.locator(`a[href="${targetId}"]`) });
        await expect(parentLi).toHaveClass(/active/);
      }).toPass({ timeout: 3000 });
    }
  });

  test('scrolling manually highlights the category', async ({ page }) => {
    // Only check sections that are actually linked in the navbar
    const navLinks = page.locator('#navnav .navbar-nav a[href^="#"]');
    const count = await navLinks.count();

    for (let i = 0; i < Math.min(count, 3); i++) {
      const targetId = await navLinks.nth(i).getAttribute('href');
      if (!targetId || targetId === '#') continue;

      const sectionSelector = targetId;
      const section = page.locator(sectionSelector);
      if (await section.count() === 0) continue;

      // Manually scroll to the section top plus a small buffer
      // This ensures we are firmly inside the section for ScrollSpy
      await page.evaluate((selector) => {
        const el = document.querySelector(selector);
        if (el instanceof HTMLElement) {
          const top = el.getBoundingClientRect().top + window.pageYOffset;
          window.scrollTo(0, top + 10);
        }
      }, sectionSelector);

      await expect(async () => {
        const parentLi = page.locator(`#navnav .navbar-nav li`).filter({ has: page.locator(`a[href="${targetId}"]`) });
        
        // If we hit the bottom of the page, Bootstrap might highlight the last section instead
        const isAtBottom = await page.evaluate(() => 
          (window.innerHeight + window.pageYOffset) >= document.body.offsetHeight - 2
        );
        
        if (isAtBottom) {
          // If at bottom, we just check if *some* link is active, or if it's the expected one or later
          const activeAny = await page.locator('#navnav .navbar-nav li.active').count();
          expect(activeAny).toBeGreaterThan(0);
        } else {
          await expect(parentLi, `Section ${targetId} should be active`).toHaveClass(/active/);
        }
      }).toPass({ timeout: 5000 });
    }
  });
});
