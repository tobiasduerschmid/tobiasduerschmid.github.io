// @ts-check
const { test, expect } = require('@playwright/test');

function sectionLink(page, name) {
  return page.getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name, exact: true });
}

async function expectSectionHighlighted(link) {
  await expect(link).toHaveAttribute('aria-current', 'location');
  // The current section has a persistent inset marker in sebook-theme.css;
  // aria-current alone would miss a regression in the visible highlight.
  await expect(link).not.toHaveCSS('box-shadow', 'none');
}

test.describe('Blog Navigation Highlighting', () => {
  test.beforeEach(async ({ page }) => {
    // Navigation must work even while the unrelated third-party math renderer
    // is still loading. Keep its request pending until the context closes.
    await page.route('https://cdn.jsdelivr.net/npm/mathjax@3.2.2/**', () => {});
    await page.goto('/blog/evidence-based-study-tips-for-college-students/', { waitUntil: 'domcontentloaded' });
    await expect(sectionLink(page, 'Desirable Difficulties')).toHaveAttribute('aria-current', 'location');
  });

  test('clicking a navbar link highlights the matching blog section', async ({ page }) => {
    const link = sectionLink(page, 'Retrieval Practice');
    const targetId = await link.getAttribute('href');
    expect(targetId).toBeTruthy();

    await expect(page.locator(targetId), `Expected section ${targetId} to exist`).toHaveCount(1);
    await link.click();
    await expectSectionHighlighted(link);
  });

  test('scrolling into a blog section highlights the matching navbar item', async ({ page }) => {
    const link = sectionLink(page, 'Spaced Practice');
    const targetId = await link.getAttribute('href');
    expect(targetId).toBeTruthy();

    const section = page.locator(targetId);
    await expect(section, `Expected section ${targetId} to exist`).toHaveCount(1);

    await page.evaluate((selector) => {
      const el = document.querySelector(selector);
      if (!(el instanceof HTMLElement)) return;
      const nav = document.getElementById('navnav');
      const navHeight = nav ? nav.offsetHeight : 50;
      const top = el.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo(0, Math.max(0, top - navHeight - 8));
    }, targetId);

    await expectSectionHighlighted(link);
  });
});
