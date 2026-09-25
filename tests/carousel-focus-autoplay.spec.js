const { test, expect } = require('@playwright/test');

for (const { pagePath, focusSelector } of [
  { pagePath: '/pencilhatching.html', focusSelector: '.item.active img.ph-compare' },
  { pagePath: '/photography.html', focusSelector: '.carousel-indicators button.active' },
]) {
  test(`autoplay pauses while a visitor is focused in the ${pagePath} carousel`, async ({ page }) => {
    await page.clock.install();
    await page.goto(pagePath);

    const carousel = page.locator('#carousel-example-generic');
    const firstSlide = carousel.locator('.item').first();
    const focusedControl = carousel.locator(focusSelector);
    await focusedControl.focus();
    await expect(focusedControl).toBeFocused();
    await expect(firstSlide).toHaveClass(/active/);

    await focusedControl.hover();
    await page.mouse.move(0, 0);
    await page.clock.runFor(6_000);
    await expect(firstSlide).toHaveClass(/active/);
    await expect(focusedControl).toBeFocused();

    await carousel.getByRole('button', { name: 'Resume carousel auto-advance' }).click();
    await page.clock.runFor(6_000);
    await expect(firstSlide).not.toHaveClass(/active/);
  });
}
