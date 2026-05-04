// @ts-check
const { test, expect } = require('@playwright/test');

async function visiblePostCategories(page) {
  return page.locator('.blog-post-item:visible').evaluateAll((posts) =>
    posts.map((post) => post.getAttribute('data-category')).filter(Boolean),
  );
}

async function expectOnlyCategoryVisible(page, category) {
  await expect
    .poll(async () => {
      const categories = await visiblePostCategories(page);
      return categories.length > 0 && categories.every((item) => item === category);
    }, {
      message: `Expected only ${category} posts to remain visible`,
    })
    .toBe(true);
}

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

  const allPosts = page.locator('.blog-post-item');
  const initialCount = await allPosts.count();
  expect(initialCount, 'Blog index should render posts before filtering').toBeGreaterThan(0);

  const categoryButtons = page.locator('.filter-btn[data-category]:not([data-category="all"])');
  const catBtnCount = await categoryButtons.count();
  test.skip(catBtnCount === 0, 'No category-specific filter buttons are rendered');

  const firstBtn = categoryButtons.first();
  const categoryName = await firstBtn.getAttribute('data-category');
  expect(categoryName).toBeTruthy();

  await firstBtn.click();
  await expect(firstBtn).toHaveAttribute('aria-pressed', 'true');
  expect(page.url()).toContain('/blog');
  await expectOnlyCategoryVisible(page, categoryName);

  await page.locator('#cat-all').click();
  await expect(page.locator('#cat-all')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.blog-post-item:visible')).toHaveCount(initialCount);
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
  const categoryHref = await categoryLink.getAttribute('href');
  const categoryId = categoryHref?.replace(/^#cat-/, '');
  expect(categoryId).toBeTruthy();

  // Click it
  await categoryLink.click();

  // Verify the filter button for this category is now active
  const filterBtn = page.locator(`.filter-btn[data-category="${categoryId}"]`);
  await expect(filterBtn).toHaveAttribute('aria-pressed', 'true');
  await expectOnlyCategoryVisible(page, categoryId);
});

test('blog index shows post titles linking to posts', async ({ page }) => {
  await page.goto('/blog/');
  // Post links should be inside the blog post titles
  const postLinks = page.locator('.blog-post-title a');
  const count = await postLinks.count();
  expect(count, 'Blog index should link to individual posts').toBeGreaterThan(0);
});
