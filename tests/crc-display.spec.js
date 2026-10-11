// @ts-check
const { test, expect } = require('@playwright/test');

for (const dark of [false, true]) {
  test(`CRC cards keep readable text and keyboard scrolling on narrow ${dark ? 'dark' : 'light'} pages`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/SEBook/tools/uml-reference');
    await page.evaluate((enabled) => document.documentElement.classList.toggle('dark-mode', enabled), dark);
    const diagram = page.getByRole('img', { name: /(?:CRC cards|Class-responsibility-collaborator cards).*Shopping cart/i });
    await expect(diagram).toBeVisible();
    const geometry = await diagram.evaluate((element) => {
      const svg = element.querySelector('svg');
      const labels = [...svg.querySelectorAll('text')];
      return {
        pageFits: document.documentElement.scrollWidth <= innerWidth,
        smallestLabel: Math.min(...labels.map(label => parseFloat(getComputedStyle(label).fontSize) * label.getScreenCTM().a)),
        filter: getComputedStyle(svg).filter,
      };
    });
    expect(geometry.pageFits).toBe(true);
    expect(geometry.smallestLabel).toBeGreaterThanOrEqual(20);
    expect(geometry.filter.includes('invert')).toBe(dark);
    await diagram.focus();
    await diagram.press('ArrowRight');
    await expect.poll(() => diagram.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
    await diagram.press('Tab');
    await expect(diagram).not.toBeFocused();
  });
}

test('CRC cards print within the page in light colors even from dark mode', async ({ page }) => {
  await page.goto('/SEBook/tools/uml-reference');
  const diagram = page.getByRole('img', { name: /(?:CRC cards|Class-responsibility-collaborator cards).*Shopping cart/i });
  await expect(diagram).toBeVisible();
  await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
  await page.emulateMedia({ media: 'print' });
  const geometry = await diagram.evaluate((element) => {
    const svg = element.querySelector('svg');
    return {
      filter: getComputedStyle(svg).filter,
      width: svg.getBoundingClientRect().width,
      available: element.getBoundingClientRect().width,
    };
  });
  expect(geometry.filter).toBe('none');
  expect(geometry.width).toBeLessThanOrEqual(geometry.available + 1);
});
