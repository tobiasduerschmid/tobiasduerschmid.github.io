// @ts-check
const { test, expect } = require('@playwright/test');
const { loadTutorialConfig } = require('./tutorial-helpers');

async function expectParagraphSizeDiagramText(figures) {
  // Computed font size alone misses SVG scaling, which can shrink readable text.
  const measurements = await figures.evaluateAll(elements => elements.map(figure => {
    const svg = figure.querySelector('svg');
    const transform = svg.getScreenCTM();
    const scale = Math.hypot(transform.a, transform.b);
    const paragraph = figure.parentElement.querySelector('p');
    const paragraphSize = parseFloat(getComputedStyle(paragraph).fontSize);
    const labelSizes = Array.from(svg.querySelectorAll('foreignObject p, text'))
      .map(label => parseFloat(getComputedStyle(label).fontSize) * scale);
    return {
      caption: figure.querySelector('figcaption').textContent,
      paragraphSize,
      smallestLabel: Math.min(...labelSizes),
    };
  }));
  for (const measurement of measurements) {
    expect(Number.isFinite(measurement.smallestLabel), `${measurement.caption}: has rendered text`)
      .toBe(true);
    expect(measurement.smallestLabel, `${measurement.caption}: scaled diagram text`)
      .toBeGreaterThanOrEqual(measurement.paragraphSize - 0.1);
  }
}

test('tutorial autoprint waits for captioned, described diagrams in light mode', async ({ page }) => {
  const tutorial = loadTutorialConfig('python');
  const expectedDiagrams = tutorial.steps.reduce((count, step) =>
    count + (step.instructions.match(/```mermaid\b/g) || []).length, 0);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  // A4 width at 96 CSS px/in, so desktop width cannot hide print scaling.
  await page.setViewportSize({ width: 794, height: 1123 });
  await page.emulateMedia({ media: 'print', colorScheme: 'dark' });
  await page.addInitScript(() => {
    // Observe the actual print boundary without opening a system print dialog.
    window.print = () => {
      const diagrams = Array.from(document.querySelectorAll('[role="img"]'))
        .filter(image => image.querySelector('svg'));
      document.body.dataset.printedDiagrams = String(diagrams.length);
      document.body.dataset.printedSourceBlocks = String(
        document.querySelectorAll('pre > code.language-mermaid').length,
      );
    };
  });

  await page.goto('/SEBook/tools/python-tutorial/print?autoprint=1');

  await expect(page.locator('body')).toHaveAttribute('data-printed-diagrams', String(expectedDiagrams));
  await expect(page.locator('body')).toHaveAttribute('data-printed-source-blocks', '0');
  const caption = 'Rebinding title leaves the printed poster attached to the original string.';
  const diagram = page.getByRole('img', { name: caption, exact: true });
  await expect(diagram).toBeVisible();
  await expect(diagram).not.toHaveAttribute('tabindex', '0');
  // SVG output is the rendering contract; its generated element IDs are not.
  await expect(diagram.locator('svg')).toBeVisible();
  await expect(diagram).toHaveAccessibleDescription(
    'Before the update, title and poster referred to the same Night Session string. '
      + 'After the update, poster still refers to Night Session, while title refers to '
      + 'the new Night Session — Live string.',
  );
  await expect(page.getByText(caption, { exact: true })).toBeVisible();
  const revealedDiagram = page.getByRole('img', {
    name: 'A shallow copy separates the outer list while keeping its member references shared.',
    exact: true,
  });
  await expect(revealedDiagram).toBeVisible();
  await expect(revealedDiagram.locator('svg')).toBeVisible();
  await expectParagraphSizeDiagramText(page.getByRole('figure').filter({ has: page.getByRole('img') }));
  await expect(diagram.locator('svg')).toHaveCSS('filter', 'none');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  expect(pageErrors, 'print diagrams should render without JavaScript errors').toEqual([]);
});

test('Python chapter loads seven described diagrams in light and dark mode', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/SEBook/tools/python');

  const main = page.getByRole('main');
  const hiddenDiagrams = main.getByRole('img', {
    name: /^Inside (extend_locally|append_exposure),/,
    includeHidden: true,
  });
  await expect(hiddenDiagrams).toHaveCount(2);
  for (const diagram of await hiddenDiagrams.all()) {
    await expect(diagram.locator('svg')).toBeAttached();
    await expect(diagram).toBeHidden();
  }
  await main.getByText('Check all six effects', { exact: true }).click();
  const figures = main.getByRole('figure').filter({ has: page.getByRole('img') });
  await expect(figures).toHaveCount(7);
  for (const figure of await figures.all()) {
    const image = figure.getByRole('img');
    await expect(image.locator('svg')).toBeVisible();
    await expect(image).toHaveAccessibleName(/\S/);
    await expect(image).toHaveAccessibleDescription(/\S/);
  }
  await expect(main.locator('code.language-mermaid')).toHaveCount(0);
  await expect(main).not.toContainText('```mermaid');

  const caption = 'Rebinding remaining leaves original referring to 12.';
  const image = main.getByRole('img', { name: caption, exact: true });
  await expect(main.getByText(caption, { exact: true })).toBeVisible();
  await expect(image).toHaveAccessibleDescription(
    'After the subtraction, original refers to the integer object 12, while remaining '
      + 'refers to the integer object 11. Rebinding remaining did not change the object '
      + 'reached through original.',
  );
  await expect(image.locator('svg')).toHaveCSS('filter', 'none');
  await expectParagraphSizeDiagramText(figures);
  const darkMode = page.getByRole('checkbox', { name: 'Toggle dark mode' });
  await darkMode.press('Space');
  await expect(darkMode).toBeChecked();
  await expect(image.locator('svg')).toHaveCSS('filter', 'invert(1) hue-rotate(180deg)');
  await expect(image).toBeVisible();
  await page.setViewportSize({ width: 320, height: 900 });
  await expect(image).toHaveAttribute('tabindex', '0');
  await image.press('ArrowRight');
  await expect.poll(() => image.evaluate(element => element.scrollLeft), {
    message: 'the focused diagram scrolls horizontally with the keyboard',
  }).toBeGreaterThan(0);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(image).not.toHaveAttribute('tabindex', '0');
  expect(pageErrors, 'chapter diagrams should render without JavaScript errors').toEqual([]);
});
