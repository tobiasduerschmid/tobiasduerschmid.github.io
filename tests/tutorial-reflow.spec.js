// @ts-check
const { test, expect } = require('@playwright/test');
const { waitForTutorialReady } = require('./tutorial-helpers');

for (const darkMode of [false, true]) {
  test(`tutorial content and controls remain reachable after reflow (${darkMode ? 'dark' : 'light'})`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 320, height: 256 });
    await page.goto('/SEBook/tools/haskell-tutorial');
    await waitForTutorialReady(page, { bootTimeout: 90_000 });
    await page.evaluate((dark) => document.documentElement.classList.toggle('dark-mode', dark), darkMode);

    // Opening a file tab during boot must not jump past unread instructions
    // to the editor. Starting at the toolbar or at the lesson is acceptable.
    const lessonHeading = page.getByRole('heading', { name: 'Functions as Expressions', exact: true });
    await expect.poll(() => lessonHeading.evaluate((heading) =>
      heading.getBoundingClientRect().top
    )).toBeGreaterThanOrEqual(0);

    // 320×256 models 400% zoom on a 1280×1024 display. Also check a tall
    // phone and return to desktop, including the responsive transition.
    for (const viewport of [
      { width: 320, height: 256 },
      { width: 320, height: 900 },
      { width: 1280, height: 720 },
    ]) {
      await page.setViewportSize(viewport);

      for (const target of [
        lessonHeading,
        page.getByRole('button', { name: /test my work/i }),
        page.getByRole('textbox', { name: /Haskell code editor/i }),
        page.getByRole('button', { name: /run$/i }),
        page.getByRole('region', { name: 'Program output', exact: true }),
      ]) {
        await target.scrollIntoViewIfNeeded();
        await expect(target).toBeInViewport();
      }

      await expect.poll(() => page.evaluate(() =>
        document.documentElement.scrollWidth <= window.innerWidth
      )).toBe(true);

      if (viewport.width === 320) {
        // Scrolling the document must reveal content below the full toolbar;
        // a zero-height main panel behind a fixed navbar fails this contract.
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
      }
    }
  });
}
