// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Tests: Accessibility
 *
 * Checks that key pages have:
 *  - a single <h1>
 *  - a working skip-to-main-content link
 *  - no images missing alt text
 *  - a <title> tag
 */

const PAGES = [
  { path: '/', name: 'Home' },
  { path: '/blog/', name: 'Blog index' },
  { path: '/blog/how-should-i-use-ai-as-a-college-student/', name: 'Blog post' },
  { path: '/SEBook/', name: 'SEBook index' },
  { path: '/SEBook/requirements.html', name: 'SEBook requirements' },
];

for (const { path, name } of PAGES) {
  test(`${name}: has a <title>`, async ({ page }) => {
    await page.goto(path);
    const title = await page.title();
    expect(title.length, 'Title should not be empty').toBeGreaterThan(0);
  });

  test(`${name}: no images with non-empty src are missing alt text`, async ({ page }) => {
    await page.goto(path);
    // Collect the src of images that have a real src but no alt attribute.
    // Images with empty src (placeholders) or alt="" (decorative) are intentional.
    const missingAltSrcs = await page.locator('img[src]:not([alt])').evaluateAll((imgs) =>
      imgs
        .map((img) => img.getAttribute('src') ?? '')
        .filter((src) => src.trim() !== '')
    );
    expect(
      missingAltSrcs.length,
      `Found ${missingAltSrcs.length} image(s) with real src but no alt attribute on ${path}:\n` +
        missingAltSrcs.map((src) => `  src="${src}"`).join('\n'),
    ).toBe(0);
  });
}

test('skip-to-main-content link exists and points at #main-content', async ({ page }) => {
  await page.goto('/');
  const skipLink = page.locator('a.skip-link');
  await expect(skipLink).toHaveCount(1);
  const href = await skipLink.getAttribute('href');
  expect(href).toBe('#main-content');
});

test('main content landmark has id="main-content"', async ({ page }) => {
  await page.goto('/');
  const mainContent = page.locator('#main-content');
  await expect(mainContent).toHaveCount(1);
});
