// @ts-check
const { test, expect } = require('@playwright/test');

for (const darkMode of [false, true]) {
  test(`section navigation keeps readable text through active-link changes (${darkMode ? 'dark' : 'light'} mode)`, async ({ page }) => {
    await page.goto('/SEBook/tools/regex-tutorial.html');
    if (darkMode) {
      await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
    }
    await expect(page.locator('#navnav')).toHaveCSS(
      'background-color', darkMode ? 'rgb(11, 31, 51)' : 'rgb(23, 50, 77)',
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator('#navnav a[href="#literal-matching"]')).toHaveAttribute('aria-current', 'location');

    const { samples, activeHref } = await page.evaluate(async () => {
      const nav = document.querySelector('#navnav');
      const links = [...nav.querySelectorAll('.navbar-nav > li > a')]
        .filter((link) => link.getClientRects().length);
      const color = (value) => {
        const channels = value.match(/[\d.]+/g).map(Number);
        return [...channels.slice(0, 3), channels[3] ?? 1];
      };
      const over = (top, bottom) => top.slice(0, 3).map((channel, index) =>
        channel * top[3] + bottom[index] * (1 - top[3]));
      const luminance = (channels) => {
        const linear = channels.map((channel) => {
          const value = channel / 255;
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
      };
      const contrast = (foreground, background) => {
        const lighter = Math.max(luminance(foreground), luminance(background));
        const darker = Math.min(luminance(foreground), luminance(background));
        return (lighter + 0.05) / (darker + 0.05);
      };
      const result = [];
      const target = document.querySelector('#anchors');
      window.scrollTo(0, target.getBoundingClientRect().top + scrollY - nav.offsetHeight - 20);
      for (let frame = 0; frame < 30; frame++) {
        const navBackground = color(getComputedStyle(nav).backgroundColor);
        for (const link of links) {
          const style = getComputedStyle(link);
          const background = over(color(style.backgroundColor), navBackground);
          const foreground = over(color(style.color), background);
          result.push({ frame, link: link.textContent.trim(), ratio: contrast(foreground, background) });
        }
        await new Promise(requestAnimationFrame);
      }
      return {
        samples: result,
        activeHref: nav.querySelector('a[aria-current="location"]')?.getAttribute('href'),
      };
    });

    expect(samples.length).toBeGreaterThan(0);
    expect(activeHref).not.toBe('#literal-matching');
    const worst = samples.reduce((minimum, sample) => sample.ratio < minimum.ratio ? sample : minimum);
    expect(worst.ratio, `${worst.link} at animation frame ${worst.frame}`).toBeGreaterThanOrEqual(4.5);
  });
}
