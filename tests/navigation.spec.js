// @ts-check
const { test, expect } = require('@playwright/test');
const { loadTutorialConfig } = require('./tutorial-helpers');

/**
 * Tests: Navigation
 *
 * - Navbar links resolve to real pages (no 404s)
 * - Internal anchor links on SEBook pages point at elements that exist
 * - The homepage loads and shows the expected author name
 */

test('homepage loads and shows author name', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toContainText('Tobias');
});

test('navbar links return HTTP 200', async ({ page, request }) => {
  await page.goto('/');

  // Collect all nav links (exclude external, mailto, and fragment-only hrefs)
  const links = await page.locator('nav a[href]').evaluateAll((anchors) =>
    anchors
      .map((a) => a.getAttribute('href'))
      .filter((href) => href && href.startsWith('/') && !href.startsWith('//')
      ),
  );

  for (const href of links) {
    const response = await request.get(href);
    expect(response.status(), `Nav link ${href} returned ${response.status()}`).toBeLessThan(400);
  }
});

test('tutorial navbar shows YAML title without expanding the nav', async ({ page }) => {
  const tutorial = loadTutorialConfig('git');
  await page.goto('/SEBook/tools/git-tutorial');

  const nav = page.locator('#navnav');
  const title = page.locator('#tutorialNavbarTitle');

  await expect(nav).toBeVisible();
  await expect(nav).not.toHaveClass(/tutorial-nav-compact/);
  await expect(title).toHaveText(tutorial.title);
  await expect(title).toBeVisible();
  await expect(page.locator('#tutorialHelpMenuToggle .tutorial-help-menu-icon')).toBeVisible();
  const initialNavHeight = await nav.evaluate((element) => element.offsetHeight);

  await page.locator('#tutorialHelpMenuToggle').click();
  await expect(page.locator('#tutorial-help-menu-links')).toBeVisible();
  await expect(page.locator('#tutorialHelpMenuToggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#tutorial-help-menu-links a')).toHaveText([
    'Glossary',
    'Shortcuts',
    'Settings',
    'Storage',
  ]);

  const readAloud = page.locator('#tts-read-btn');
  await readAloud.click();
  if ((await readAloud.textContent())?.includes('Stop')) {
    await readAloud.click();
    await expect(readAloud).toContainText('Read Aloud');
  }
  await page.mouse.move(20, 100);
  await expect(readAloud).toBeVisible();

  const navHeight = await nav.evaluate((element) => element.offsetHeight);
  expect(navHeight, 'Tutorial navbar should not grow after opening utility controls')
    .toBeLessThanOrEqual(initialNavHeight + 2);
});

test('blog index lists at least one post', async ({ page }) => {
  await page.goto('/blog/');
  const posts = page.locator('.blog-post-card, article, .post-title, h2 a');
  await expect(posts.first()).toBeVisible();
});

test('SEBook index page loads and has section links', async ({ page }) => {
  await page.goto('/SEBook/');
  // The index should have several internal links to SEBook sections
  const internalLinks = page.locator('a[href*="/SEBook/"]');
  const count = await internalLinks.count();
  expect(count, 'SEBook index should have multiple section links').toBeGreaterThan(3);
});

test('SEBook requirements page has correct heading structure', async ({ page }) => {
  await page.goto('/SEBook/requirements.html');
  // Page should have a main heading
  const h1Count = await page.locator('h1').count();
  expect(h1Count).toBeGreaterThanOrEqual(1);
  // And several sub-headings indicating real content
  const h2Count = await page.locator('h2').count();
  expect(h2Count).toBeGreaterThan(0);
});
