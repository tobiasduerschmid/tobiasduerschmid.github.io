// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Tests: SEO and Social Meta Tags
 * 
 * Verifies that the site has correct meta tags for SEO and social sharing.
 */

test.describe('SEO and Social Metadata', () => {
  test('home page has basic SEO tags', async ({ page }) => {
    await page.goto('/');
    
    // Check for meta description
    const description = page.locator('meta[name="description"]');
    await expect(description).toHaveAttribute('content', /Tobias/);
    
    // Check for Open Graph tags
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /(Home|Tobias)/);
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website');
    
    // Check for Canonical URL
    const canonical = page.locator('link[rel="canonical"]').first();
    await expect(canonical).toHaveAttribute('href', /(tobiasduerschmid\.github\.io|localhost|127\.0\.0\.1)/);
  });

  test('blog posts have specific meta tags', async ({ page }) => {
    // Navigate to a specific blog post
    await page.goto('/blog/how-should-i-use-ai-as-a-college-student/');
    
    // Post title should be in og:title
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /AI/i);
    
    // Should have og:description
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', /AI/i);
    
    // Language attribute
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});
