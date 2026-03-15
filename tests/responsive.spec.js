// @ts-check
const { test, expect, devices } = require('@playwright/test');

/**
 * Tests: Responsive Design
 * 
 * Verifies that the site behaves correctly on different screen sizes,
 * focusing on the mobile navigation menu.
 */

test.use({ ...devices['iPhone 13'] });

test.describe('Responsive Layout', () => {

  test('mobile menu toggles correctly', async ({ page }) => {
    await page.goto('/');
    
    // Check if the hamburger menu button is visible on mobile
    const navToggle = page.locator('.navbar-toggle');
    await expect(navToggle).toBeVisible();
    
    // Check that the menu is initially hidden (or at least not expanded)
    const navMenu = page.locator('.navbar-ex1-collapse');
    
    await navToggle.click();
    
    // Verify that the menu links become visible
    await expect(navMenu).toBeVisible();
  });

  test('no horizontal scroll on small viewports', async ({ page }) => {
    const paths = ['/', '/blog/', '/SEBook/'];
    for (const path of paths) {
      await page.goto(path);
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScroll, `Page ${path} should not have horizontal scroll`).toBe(false);
    }
  });
});
