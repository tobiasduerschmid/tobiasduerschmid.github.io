// @ts-check
const { test, expect } = require('@playwright/test');
const { luminance, paletteOf, textContrast } = require('./print-helpers');

// Print is always light, whatever theme the reader saved. The shared print
// controller (_includes/print-light-controller.html) swaps the dark theme out
// while printing and back in afterwards. Scripts that re-apply the saved theme
// after that swap (a PDF generated from a freshly loaded page) must not undo it.

// Layout pages read the saved theme from the dark-mode cookie. Pop-outs and
// narration readers take it from the URL. A narration reader that is loaded in
// print mode is a print view, so it never turns dark and has nothing to restore.
const PAGES = [
  { name: 'blog post', path: '/blog/evidence-based-study-tips-for-college-students/' },
  { name: 'SEBook chapter', path: '/SEBook/development_practices/debugging.html' },
  { name: 'home page', path: '/' },
  { name: 'tutorial pop-out', path: '/tutorial-output-popup.html?dark=1', hasVisibleHeading: false },
  { name: 'narration reader', path: '/SEBook/designpatterns/observer/read/?theme=dark', restoresAfterPrintLoad: false },
];

// WCAG 1.4.3: large text (a page heading) needs 3:1, body text 4.5:1.
const LARGE_TEXT_CONTRAST = 3;
const BODY_TEXT_CONTRAST = 4.5;
const LIGHT_PAGE = 0.8;
const DARK_PAGE = 0.2;

async function expectReadableLightPage(page, { hasVisibleHeading = true } = {}) {
  // The invariant itself: the theme switch (html.dark-mode) is off for the whole
  // print job. Some pages happen to look light anyway through their own print
  // CSS; this is what guarantees it for everything else on the page.
  await expect(page.locator('html')).not.toHaveClass(/\bdark-mode\b/);

  const body = page.getByRole('main');
  if (hasVisibleHeading) {
    // A chapter has several h1s; any of them shows which palette is in force.
    const heading = page.getByRole('heading', { level: 1 }).first();
    await expect.poll(() => textContrast(heading), { message: 'heading contrast' }).toBeGreaterThanOrEqual(LARGE_TEXT_CONTRAST);
  }
  await expect.poll(() => textContrast(body), { message: 'body text contrast' }).toBeGreaterThanOrEqual(BODY_TEXT_CONTRAST);
  await expect
    .poll(async () => luminance((await paletteOf(body)).background), { message: 'page background' })
    .toBeGreaterThan(LIGHT_PAGE);
}

async function expectDarkPage(page) {
  await expect
    .poll(async () => luminance((await paletteOf(page.getByRole('main'))).background), { message: 'page background' })
    .toBeLessThan(DARK_PAGE);
}

for (const { name, path, hasVisibleHeading, restoresAfterPrintLoad = true } of PAGES) {
  test.describe(`${name} with a saved dark theme`, () => {
    test.beforeEach(async ({ context, baseURL }) => {
      await context.addCookies([{ name: 'dark-mode', value: 'true', url: baseURL }]);
    });

    test('is light and readable in print, even when first loaded in print mode', async ({ page }) => {
      // Loading under print media is how headless PDF export works, and it lets
      // the page's own scripts re-apply the saved theme after print mode began.
      await page.emulateMedia({ media: 'print' });
      await page.goto(path);
      await expectReadableLightPage(page, { hasVisibleHeading });
    });

    test('turns light for printing and returns to dark afterwards', async ({ page }) => {
      await page.goto(path);
      await expectDarkPage(page);

      await page.emulateMedia({ media: 'print' });
      await expectReadableLightPage(page, { hasVisibleHeading });

      await page.emulateMedia({ media: 'screen' });
      await expectDarkPage(page);
    });

    if (restoresAfterPrintLoad) {
      test('still returns to dark after a page that was loaded for print', async ({ page }) => {
        await page.emulateMedia({ media: 'print' });
        await page.goto(path);
        await page.emulateMedia({ media: 'screen' });
        await expectDarkPage(page);
      });
    }
  });
}
