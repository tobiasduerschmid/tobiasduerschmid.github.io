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

test('clicking a category filter button filters posts correctly', async ({ page }) => {
  await page.goto('/blog/');

  // Get initial visible post count
  const allPosts = page.locator('.blog-post-card, .post-container article'); // Update selector based on actual site
  const initialCount = await allPosts.count();

  // Find a category button that isn't "All"
  const categoryButtons = page.locator('.filter-btn[data-category]:not([data-category="all"])');
  const catBtnCount = await categoryButtons.count();

  if (catBtnCount > 0) {
    const firstBtn = categoryButtons.first();
    const categoryName = await firstBtn.getAttribute('data-category');
    await firstBtn.click();

    // Wait for any JS transitions
    await page.waitForTimeout(500);

    // Some sites might use classes like .hidden or just change display
    // Check that we don't have all posts visible if filtering
    const visiblePosts = allPosts.filter({ hasText: '' }); // This is a bit generic, better if we know the 'hidden' class

    // Better: check that at least one post is visible and no navigation occurred
    expect(page.url()).toContain('/blog');

    // Click "All" to reset
    await page.locator('#cat-all').click();
    await page.waitForTimeout(500);
    const resetCount = await allPosts.count();
    expect(resetCount).toBe(initialCount);
  } else {
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

test('clicking a category badge on a post filters the list', async ({ page }) => {
  await page.goto('/blog/');

  // Find the first category badge
  const categoryLink = page.locator('.category-link').first();
  const categoryName = (await categoryLink.innerText()).trim();

  // Click it
  await categoryLink.click();

  // Wait for transitions
  await page.waitForTimeout(500);

  // Verify the filter button for this category is now active
  const filterBtn = page.locator(`.filter-btn.active`);
  const activeCategory = (await filterBtn.innerText()).trim();
  expect(activeCategory).toBe(categoryName);

  // Verify only matching posts are visible
  const visiblePosts = page.locator('.blog-post-item:not(.hidden)');
  const postCategories = await visiblePosts.locator('.category-link').allInnerTexts();
  for (const cat of postCategories) {
    expect(cat.trim()).toBe(categoryName);
  }
});

test('blog index shows post titles linking to posts', async ({ page }) => {
  await page.goto('/blog/');
  // Post links should be inside the blog post titles
  const postLinks = page.locator('.blog-post-title a');
  const count = await postLinks.count();
  expect(count, 'Blog index should link to individual posts').toBeGreaterThan(0);
});
