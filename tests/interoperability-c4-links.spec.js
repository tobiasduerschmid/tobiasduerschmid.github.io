// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * The interoperability and C4 model chapters link each other (spec §12): the interoperability chapter's
 * "Syntactic vs Semantic Interoperability" section ends by pointing forward to the C4 chapter's
 * "Interface Descriptions" section, and the C4 chapter deep-links back into interoperability sections.
 * A renamed heading on either page silently breaks these anchors, so both directions are checked.
 */

const INTEROPERABILITY = '/SEBook/quality_attributes/interoperability.html';
const C4_CHAPTER = '/SEBook/architecture/c4.html';

test('the semantic-interoperability section ends with a link that lands on the C4 chapter\'s Interface Descriptions', async ({ page }) => {
  await page.goto(INTEROPERABILITY);
  const section = page.locator('section#syntactic-vs-semantic-interoperability');
  const lastParagraph = section.locator('p').last();
  const forwardLink = lastParagraph.getByRole('link', { name: 'Interface Descriptions in the C4 model chapter' });
  await expect(forwardLink).toHaveCount(1);

  await forwardLink.click();
  await expect(page).toHaveURL(/\/SEBook\/architecture\/c4(\.html)?#interface-descriptions$/);
  await expect(page.getByRole('heading', { name: 'Interface Descriptions', exact: true })).toBeInViewport();
});

test('every deep link from the C4 chapter into the interoperability chapter names an existing section', async ({ page }) => {
  await page.goto(C4_CHAPTER);
  const hrefs = await page.locator(`main a[href*="${INTEROPERABILITY}#"]`)
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  expect(hrefs.length).toBeGreaterThan(0);

  await page.goto(INTEROPERABILITY);
  for (const fragment of new Set(hrefs.map((href) => String(href).split('#')[1]))) {
    await expect(page.locator(`[id="${fragment}"]`), `#${fragment} on the interoperability page`).toHaveCount(1);
  }
});
