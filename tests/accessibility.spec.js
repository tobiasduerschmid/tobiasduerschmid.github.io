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

for (const { path, name, nextTabInsideMain } of [
  { path: '/', name: 'Home' },
  { path: '/blog/how-should-i-use-ai-as-a-college-student/', name: 'Blog post' },
  { path: '/SEBook/requirements.html', name: 'SEBook chapter' },
  { path: '/settings/', name: 'Settings' },
  { path: '/shortcuts/', name: 'Shortcuts' },
  // This read-only gallery has no focusable descendants inside main.
  { path: '/test-uml.html', name: 'UML renderer gallery', nextTabInsideMain: false },
  { path: '/test-uml-js.html', name: 'JavaScript UML analyzer gallery' },
]) {
  test(`${name}: keyboard skip link moves focus into main content`, async ({ page }) => {
    await page.goto(path);
    const skipLink = page.getByRole('link', { name: 'Skip to main content' });
    const main = page.locator('main#main-content');

    await page.keyboard.press('Tab');
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toHaveAttribute('href', '#main-content');
    await page.keyboard.press('Enter');
    await expect(main).toBeFocused();

    if (nextTabInsideMain !== false) {
      await page.keyboard.press('Tab');
      expect(await main.evaluate((element) => element.contains(document.activeElement)))
        .toBe(true);
    }
  });
}

test('pencil gallery keyboard comparison describes the active image in both states', async ({ page }) => {
  await page.goto('/pencilhatching.html');
  const comparison = page.locator('#carousel-example-generic .item.active img.ph-compare');
  await expect(comparison).toHaveAccessibleName(/pencil drawing.*church/i);
  await expect(comparison).toHaveAttribute('aria-pressed', 'false');
  const drawingSrc = await comparison.getAttribute('src');

  await comparison.focus();
  await page.keyboard.down('Enter');
  await expect(comparison).toHaveAccessibleName(/original photograph.*church/i);
  await expect(comparison).toHaveAttribute('aria-pressed', 'true');
  expect(await comparison.getAttribute('src')).not.toBe(drawingSrc);

  await page.keyboard.up('Enter');
  await expect(comparison).toHaveAccessibleName(/pencil drawing.*church/i);
  await expect(comparison).toHaveAttribute('aria-pressed', 'false');
  await expect(comparison).toHaveAttribute('src', drawingSrc);
});
