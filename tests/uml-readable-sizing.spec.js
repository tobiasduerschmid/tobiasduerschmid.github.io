// @ts-check
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

// The renderer measures geometry in SVG units. Readability is a screen-space
// contract: a 14-unit label must not become 5px just to fit a narrow column.
function measureReadability(elements) {
  return elements.flatMap((element) => {
    const svg = element.querySelector('svg');
    if (!svg || !svg.getBoundingClientRect().width) return [];
    const paragraph = element.closest('main')?.querySelector('p') || document.querySelector('p') || document.body;
    const paragraphSize = parseFloat(getComputedStyle(paragraph).fontSize);
    const failures = Array.from(svg.querySelectorAll('text')).filter(label => label.textContent.trim()).flatMap((label) => {
      const matrix = label.getScreenCTM();
      const size = parseFloat(getComputedStyle(label).fontSize) * Math.hypot(matrix.c, matrix.d);
      return size < paragraphSize - 0.1 ? [{ label: label.textContent, size, paragraphSize }] : [];
    });
    return failures.length ? [{ count: failures.length, examples: failures.slice(0, 2) }] : [];
  });
}

for (const width of [1440, 320]) {
  for (const dark of [false, true]) {
    test(`diagram text stays paragraph-sized at ${width}px in ${dark ? 'dark' : 'light'} mode`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      for (const url of ['/test-uml.html', '/SEBook/uml_component_diagram.html']) {
        await page.goto(url);
        await page.evaluate(async (enabled) => {
          await document.fonts.ready;
          document.documentElement.classList.toggle('dark-mode', enabled);
        }, dark);
        const diagrams = page.getByRole('img').and(page.locator('.sebook-figure--archuml > [role="img"]'));
        await expect(diagrams.first()).toBeVisible();
        expect(await diagrams.evaluateAll(measureReadability), `${url}: rendered label sizes`).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${url}: page reflows`).toBe(true);
      }
    });
  }
}

test('wide diagrams scroll with the keyboard while fitting diagrams do not add tab stops', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/test-uml.html');
  const heading = page.getByRole('heading', { name: '27b. Component API Back-Edges with Shared Ports', exact: true });
  const wide = heading.locator('xpath=following-sibling::figure[1]').getByRole('img');
  await expect(wide).toHaveAttribute('tabindex', '0');
  await wide.focus();
  await expect(wide).toBeFocused();
  await expect(wide).toHaveCSS('outline-style', 'solid');
  await wide.press('ArrowRight');
  await expect.poll(() => wide.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  await wide.press('Tab');
  await expect(wide).not.toBeFocused();
  const small = page.getByRole('heading', { name: '1. Shared-Target Inheritance', exact: true })
    .locator('xpath=following-sibling::figure[1]').getByRole('img');
  expect(await small.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await expect(small).not.toHaveAttribute('tabindex', '0');
  await page.setViewportSize({ width: 320, height: 1000 });
  await expect(small).toHaveAttribute('tabindex', '0');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(small).not.toHaveAttribute('tabindex', '0');
});

test('diagram text follows a doubled surrounding font size', async ({ page }) => {
  await page.goto('/SEBook/uml_component_diagram.html');
  const diagrams = page.getByRole('img').and(page.locator('.sebook-figure--archuml > [role="img"]'));
  await expect(diagrams.first()).toBeVisible();
  await page.evaluate(() => { document.body.style.fontSize = `${parseFloat(getComputedStyle(document.body).fontSize) * 2}px`; });
  expect(await diagrams.evaluateAll(measureReadability)).toEqual([]);
});

test('scrollable editor diagrams keep their interactive elements accessible', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 });
  await page.goto('/SEBook/tools/uml-playground.html');
  const output = page.locator('#uml-pg-output');
  await expect(output.locator('svg')).toBeVisible();
  await page.locator('#uml-pg-type').selectOption('class');
  await page.locator('#uml-pg-edit').check();
  expect(await output.evaluate(element => element.scrollWidth > element.clientWidth + 1)).toBe(true);
  const animal = page.getByRole('button', { name: /Element Animal/ });
  await expect(animal).toBeVisible();
  await animal.focus();
  await expect(animal).toBeFocused();
});

test('print fits whole diagrams on the page and removes the dark screen filter', async ({ page }) => {
  await page.goto('/test-uml.html');
  const diagrams = page.getByRole('img').and(page.locator('.sebook-figure--archuml > [role="img"]'));
  await expect(diagrams.first()).toBeVisible();
  await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
  await page.emulateMedia({ media: 'print' });
  const failures = await diagrams.evaluateAll(elements => elements.flatMap(element => {
    const svg = element.querySelector('svg');
    const available = element.clientWidth;
    return svg.getBoundingClientRect().width > available + 1 || getComputedStyle(svg).filter !== 'none'
      ? [{ available, actual: svg.getBoundingClientRect().width, filter: getComputedStyle(svg).filter }] : [];
  }));
  expect(failures).toEqual([]);
});

test('serialized production diagrams remain readable and keyboard-scrollable without JavaScript', async ({ page, browser, baseURL }) => {
  await page.goto('/test-uml.html');
  const wide = page.getByRole('heading', { name: '27b. Component API Back-Edges with Shared Ports', exact: true })
    .locator('xpath=following-sibling::figure[1]').getByRole('img');
  await expect(wide.locator('svg')).toBeVisible();
  const svg = await wide.locator('svg').evaluate(element => element.outerHTML);
  // Exercise the production wrapper around a real renderer result; the Ruby
  // harness only supplies Jekyll's hook/logger and description boundaries.
  const { html } = JSON.parse(execFileSync('ruby', [path.join(__dirname, '../scripts/tests/fixtures/uml-static-harness.rb')], {
    encoding: 'utf8',
    input: JSON.stringify({ operation: 'process_cached_svg', svg, page_identifier: '/readable-static-test',
      content: '<pre><code class="language-uml-component">component Example</code></pre>' }),
  }));
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 800 } });
  try {
    const staticPage = await context.newPage();
    await staticPage.setContent(`<html lang="en"><head><link rel="stylesheet" href="${baseURL}/css/uml-diagram.css"></head><body><p>Surrounding paragraph.</p>${html}</body></html>`);
    const diagram = staticPage.getByRole('img');
    expect(await diagram.evaluateAll(measureReadability)).toEqual([]);
    await diagram.focus();
    await diagram.press('ArrowRight');
    await expect.poll(() => diagram.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
    expect(await staticPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  } finally {
    await context.close();
  }
});
