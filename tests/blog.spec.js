// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Tests: Blog category filtering
 *
 * The blog page has JavaScript-powered category filter buttons.
 * These tests verify the filter UI exists and responds to clicks.
 */

test('blog category filter buttons are present', async ({ page }) => {
  await page.goto('/blog/');
  // The "All Posts" button should always be visible
  const allBtn = page.locator('#cat-all');
  await expect(allBtn).toBeVisible();
});

test('clicking a category filter button does not navigate away', async ({ page }) => {
  await page.goto('/blog/');

  // Find any category button other than "All Posts"
  const categoryButtons = page.locator('.filter-btn[data-category]:not([data-category="all"])');
  const count = await categoryButtons.count();

  if (count > 0) {
    const firstBtn = categoryButtons.first();
    await firstBtn.click();
    // Should stay on the /blog/ page after clicking
    expect(page.url()).toContain('/blog');
  } else {
    // If there's only one category (all), skip gracefully
    test.skip();
  }
});

test('blog post pages render content', async ({ page }) => {
  await page.goto('/blog/how-should-i-use-ai-as-a-college-student/');
  // The post should have at least one paragraph of actual content
  const paragraphs = page.locator('article p, .post-content p, main p');
  const count = await paragraphs.count();
  expect(count, 'Blog post should have renderable paragraphs').toBeGreaterThan(0);
});

test('blog post has a references section', async ({ page }) => {
  await page.goto('/blog/how-should-i-use-ai-as-a-college-student/');
  // Jekyll Scholar appends a reference list
  const body = await page.locator('body').innerText();
  expect(body).toContain('References');
});

test('blog index shows post titles linking to posts', async ({ page }) => {
  await page.goto('/blog/');
  // Post links should include /blog/ in their href
  const postLinks = page.locator('a[href*="/blog/how-"]');
  const count = await postLinks.count();
  expect(count, 'Blog index should link to individual posts').toBeGreaterThan(0);
});
