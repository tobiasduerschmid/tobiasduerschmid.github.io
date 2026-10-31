// @ts-check
const { test, expect } = require('@playwright/test');

// Print is always light, whatever theme the reader saved. The shared print
// controller in _includes/head.html swaps the dark theme out while printing and
// back in afterwards. Layout scripts that re-apply the saved theme after that
// swap (a PDF generated from a freshly loaded page) must not undo it.

const PAGES = [
  { name: 'blog post', path: '/blog/evidence-based-study-tips-for-college-students/' },
  { name: 'SEBook chapter', path: '/SEBook/development_practices/debugging.html' },
  { name: 'home page', path: '/' },
];

// WCAG 1.4.3: large text (a page heading) needs 3:1, body text 4.5:1.
const LARGE_TEXT_CONTRAST = 3;
const BODY_TEXT_CONTRAST = 4.5;
const LIGHT_PAGE = 0.8;
const DARK_PAGE = 0.2;

const channel = (value) => {
  const unit = value / 255;
  return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const contrast = (first, second) => {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
};

/** Text colour of an element and the opaque background actually behind it, as [r, g, b]. */
async function paletteOf(locator) {
  return locator.evaluate((element) => {
    const channels = (value) => (value.match(/[\d.]+/g) || []).map(Number);
    let background = [255, 255, 255];
    for (let node = element; node; node = node.parentElement) {
      const [r, g, b, alpha = 1] = channels(getComputedStyle(node).backgroundColor);
      if (alpha > 0.5) {
        background = [r, g, b];
        break;
      }
    }
    return { text: channels(getComputedStyle(element).color).slice(0, 3), background };
  });
}

async function expectReadableLightPage(page) {
  // A chapter has several h1s; any of them shows which palette is in force.
  const heading = page.getByRole('heading', { level: 1 }).first();
  const body = page.getByRole('main');
  const ratio = (locator) => async () => {
    const { text, background } = await paletteOf(locator);
    return contrast(text, background);
  };
  await expect.poll(ratio(heading), { message: 'heading contrast' }).toBeGreaterThanOrEqual(LARGE_TEXT_CONTRAST);
  await expect.poll(ratio(body), { message: 'body text contrast' }).toBeGreaterThanOrEqual(BODY_TEXT_CONTRAST);
  await expect
    .poll(async () => luminance((await paletteOf(body)).background), { message: 'page background' })
    .toBeGreaterThan(LIGHT_PAGE);
}

async function expectDarkPage(page) {
  await expect
    .poll(async () => luminance((await paletteOf(page.getByRole('main'))).background), { message: 'page background' })
    .toBeLessThan(DARK_PAGE);
}

for (const { name, path } of PAGES) {
  test.describe(`${name} with a saved dark theme`, () => {
    test.beforeEach(async ({ context, baseURL }) => {
      await context.addCookies([{ name: 'dark-mode', value: 'true', url: baseURL }]);
    });

    test('is light and readable in print, even when first loaded in print mode', async ({ page }) => {
      // Loading under print media is how headless PDF export works, and it lets
      // the layout's own scripts re-apply the saved theme after print mode began.
      await page.emulateMedia({ media: 'print' });
      await page.goto(path);
      await expectReadableLightPage(page);
    });

    test('turns light for printing and returns to dark afterwards', async ({ page }) => {
      await page.goto(path);
      await expectDarkPage(page);

      await page.emulateMedia({ media: 'print' });
      await expectReadableLightPage(page);

      await page.emulateMedia({ media: 'screen' });
      await expectDarkPage(page);
    });

    test('still returns to dark after a page that was loaded for print', async ({ page }) => {
      await page.emulateMedia({ media: 'print' });
      await page.goto(path);
      await page.emulateMedia({ media: 'screen' });
      await expectDarkPage(page);
    });
  });
}
