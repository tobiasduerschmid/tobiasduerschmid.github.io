// @ts-check
const { test, expect } = require('@playwright/test');

const LONG_HAIR_CHOICES = [
  'Long layers', 'Straight long layers', 'Long center part', 'Long straight hair',
  'Long and flowing', 'Wavy and long', 'Long locs', 'Long braid',
];

test.use({ colorScheme: 'light', reducedMotion: 'reduce' });
test.skip(process.env.JEKYLL_ENV !== 'production', 'Prerendered previews are generated only for production builds.');

test.beforeEach(async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'se-gym-active', value: 'true', url: baseURL }]);
  await page.goto('/se-gym/');
});

async function loadedHairPreview(page, label) {
  const longHair = page.getByRole('button', { name: `Choose Hair style: ${label}`, exact: true });
  await longHair.scrollIntoViewIfNeeded();
  // The choice label supplies the accessible name; its decorative preview has empty alt text.
  const preview = longHair.locator('img');
  await expect(preview, 'The published customizer must use a built image asset').toHaveCount(1);
  await expect(preview).toHaveJSProperty('complete', true);
  await expect.poll(() => preview.evaluate((image) => image.naturalWidth), {
    message: 'The prerendered long-hair asset must load successfully',
  }).toBeGreaterThan(0);
  return preview;
}

test('The hero customizer loads once after its prerendered image manifest', async ({ page }) => {
  const runtime = page.locator('script[src*="/js/se-gym-hero-avatar.js"]');
  const manifest = page.locator('script[src*="/assets/se-gym-hero-choice-previews/manifest.js"]');
  await expect(runtime, 'Duplicate runtime loads would initialize the customizer twice').toHaveCount(1);
  await expect(manifest).toHaveCount(1);
  const manifestLoadsFirst = await manifest.evaluate((script) => {
    const runtimeScript = document.querySelector('script[src*="/js/se-gym-hero-avatar.js"]');
    return Boolean(script.compareDocumentPosition(runtimeScript) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(manifestLoadsFirst, 'Deferred avatar initialization must see the real image manifest').toBe(true);
});

test('Long hairstyles load prerendered yellow images containing their complete hair', async ({ page, context }) => {
  await page.getByRole('button', { name: 'Customize Hero', exact: true }).click();
  const assetPage = await context.newPage();

  for (const label of LONG_HAIR_CHOICES) {
    await test.step(label, async () => {
      const preview = await loadedHairPreview(page, label);
      const assetUrl = await preview.evaluate((image) => image.src);
      const response = await assetPage.goto(assetUrl);
      expect(response.ok(), `${label}: the image must resolve to a real build asset`).toBe(true);
      const artwork = await assetPage.locator('svg').evaluate((svg) => {
        const viewport = svg.getBoundingClientRect();
        const visibleHair = Array.from(svg.querySelectorAll(
          '[data-hero-slot="hair"], [data-hero-slot="hairline"], [data-hero-slot="hair-root"]'
        )).map((part) => part.getBoundingClientRect()).filter((box) => box.width && box.height);
        return {
          skin: getComputedStyle(svg).getPropertyValue('--hero-skin-light').trim().toLowerCase(),
          visibleHairCount: visibleHair.length,
          clippedHair: visibleHair.filter((box) =>
            box.left < viewport.left || box.right > viewport.right ||
            box.top < viewport.top || box.bottom > viewport.bottom
          ).map((box) => box.toJSON()),
        };
      });
      expect(artwork.skin, `${label}: the built preview uses the original yellow skin`).toBe('#ffd100');
      expect(artwork.visibleHairCount, `${label}: the image includes hair`).toBeGreaterThan(0);
      expect(artwork.clippedHair, `${label}: all hair fits inside the image viewport`).toEqual([]);
    });
  }
  await assetPage.close();
});

for (const width of [1280, 1000, 390]) {
  for (const theme of ['light', 'dark']) {
    test(`Prerendered long hair fits its frame at ${width}px in ${theme} mode`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      if (theme === 'dark') {
        await page.getByRole('checkbox', { name: 'Toggle dark mode', exact: true }).press('Space');
      }
      await page.getByRole('button', { name: 'Customize Hero', exact: true }).click();

      for (const label of LONG_HAIR_CHOICES) {
        const preview = await loadedHairPreview(page, label);
        const bounds = await preview.evaluate((image) => {
          const imageBox = image.getBoundingClientRect();
          const frameBox = image.closest('.hero-cust-choice-preview').getBoundingClientRect();
          return { image: imageBox.toJSON(), frame: frameBox.toJSON() };
        });
        expect(bounds.image.left, `${label}: left edge fits`).toBeGreaterThanOrEqual(bounds.frame.left);
        expect(bounds.image.right, `${label}: right edge fits`).toBeLessThanOrEqual(bounds.frame.right);
        expect(bounds.image.top, `${label}: top edge fits`).toBeGreaterThanOrEqual(bounds.frame.top);
        expect(bounds.image.bottom, `${label}: bottom edge fits`).toBeLessThanOrEqual(bounds.frame.bottom);
      }
    });
  }
}
