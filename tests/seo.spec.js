// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Tests: SEO and Social Meta Tags
 * 
 * Verifies that the site has correct meta tags for SEO and social sharing.
 */

async function metaContent(page, selector) {
  const locator = page.locator(selector).first();
  await expect(locator).toHaveAttribute('content', /\S/);
  return locator.getAttribute('content');
}

test.describe('SEO and Social Metadata', () => {
  test('home page has basic SEO tags', async ({ page }) => {
    await page.goto('/');
    
    const description = await metaContent(page, 'meta[name="description"]');
    expect(description.trim().length, 'Home meta description should be descriptive').toBeGreaterThan(30);
    
    const ogTitle = await metaContent(page, 'meta[property="og:title"]');
    expect(ogTitle.trim().length, 'Open Graph title should be non-empty').toBeGreaterThan(3);
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website');
    
    const canonical = await page.locator('link[rel="canonical"]').first().getAttribute('href');
    expect(() => new URL(canonical || '')).not.toThrow();
    expect(new URL(canonical || '').pathname).toBe('/');
  });

  test('blog posts have specific meta tags', async ({ page }) => {
    await page.goto('/blog/how-should-i-use-ai-as-a-college-student/');
    const heading = (await page.locator('h1').first().innerText()).trim();
    
    const ogTitle = await metaContent(page, 'meta[property="og:title"]');
    expect(ogTitle).toContain(heading);

    const description = await metaContent(page, 'meta[name="description"]');
    const ogDescription = await metaContent(page, 'meta[property="og:description"]');
    expect(ogDescription).toBe(description);
    
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});
