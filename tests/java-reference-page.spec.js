// @ts-check
const { test, expect } = require('@playwright/test');

const JAVA_REFERENCE_URL = '/SEBook/tools/java.html';
const SEBOOK_COMBINED_URL = '/SEBook/all.html';
const WCAG_TEXT_SPACING_CSS = `
  * {
    line-height: 1.5 !important;
    letter-spacing: 0.12em !important;
    word-spacing: 0.16em !important;
  }
  p { margin-bottom: 2em !important; }
`;

test.describe('Java reference page', () => {
  test('keeps every practice region inside the main landmark', async ({ page }) => {
    await page.goto(JAVA_REFERENCE_URL);

    const mainContent = page.getByRole('main');
    const practiceRegions = [
      ['Java — What Does This Code Do? flashcards', 'java_syntax_explain'],
      ['Java — Write the Code flashcards', 'java_syntax_generate'],
      ['Java Concepts Quiz quiz', 'java'],
    ];

    for (const [accessibleName, practiceId] of practiceRegions) {
      const region = mainContent.getByRole('region', { name: accessibleName });
      await expect(region).toHaveCount(1);
      await expect(region).toHaveAttribute('data-quiz-id', practiceId);
    }

    await expect(mainContent.locator('.sebook-practice-hero-group')).toHaveCount(1);
    await expect(page.locator('body > .sebook-practice-hero-group')).toHaveCount(0);
  });

  test('keeps the first explanation flashcard prompt and Java code intact', async ({ page }) => {
    await page.goto(JAVA_REFERENCE_URL);

    const explainRegion = page.getByRole('main').getByRole('region', {
      name: 'Java — What Does This Code Do? flashcards',
    });
    const firstCard = explainRegion.locator('.flashcard-card[data-card-id="1"]');
    const firstCodeExample = firstCard.locator('pre code');

    await expect(firstCard).toHaveCount(1);
    await expect(firstCodeExample).toHaveCount(1);
    await expect(firstCodeExample).toContainText('String a = new String("hello");');
    await expect(firstCodeExample).toContainText('System.out.println(a.equals(b));');
    await expect(firstCard)
      .toContainText(/Predict each output\. Then explain why Line A and Line B differ/);
  });

  test('reflows the practice group under WCAG text spacing at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(JAVA_REFERENCE_URL);

    const practiceGroup = page.getByRole('main').locator('.sebook-practice-hero-group');
    await expect(practiceGroup).toHaveCount(1);
    await page.addStyleTag({ content: WCAG_TEXT_SPACING_CSS });

    const metrics = await practiceGroup.evaluate((group) => {
      const groupRect = group.getBoundingClientRect();
      const practiceBoxes = group.querySelector('.sebook-practice-boxes');
      const boxesRect = practiceBoxes ? practiceBoxes.getBoundingClientRect() : null;
      const viewportWidth = window.innerWidth;

      return {
        viewportWidth,
        pageScrollWidth: Math.max(
          document.documentElement.scrollWidth,
          document.body ? document.body.scrollWidth : 0,
        ),
        groupLeft: groupRect.left,
        groupRight: groupRect.right,
        boxesLeft: boxesRect ? boxesRect.left : null,
        boxesRight: boxesRect ? boxesRect.right : null,
      };
    });

    expect(metrics.viewportWidth).toBe(320);
    expect(metrics.pageScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 2);
    expect(metrics.groupLeft).toBeGreaterThanOrEqual(-2);
    expect(metrics.groupRight).toBeLessThanOrEqual(metrics.viewportWidth + 2);
    expect(metrics.boxesLeft).not.toBeNull();
    expect(metrics.boxesRight).not.toBeNull();
    expect(metrics.boxesLeft).toBeGreaterThanOrEqual(metrics.groupLeft - 2);
    expect(metrics.boxesRight).toBeLessThanOrEqual(metrics.groupRight + 2);
  });

  test('preserves the standalone design-principles fragment', async ({ page }) => {
    await page.goto(`${JAVA_REFERENCE_URL}#design-principles`);

    const designPrinciples = page.locator('section#design-principles');
    await expect(designPrinciples).toHaveCount(1);
    await expect(designPrinciples.getByRole('heading', {
      level: 2,
      name: 'Java Design Principles',
    })).toBeVisible();
  });

  test('uses a distinct heading id inside the combined SEBook', async ({ browser }) => {
    // The aggregate is a ~29 MB static document. This contract concerns its
    // generated heading IDs, so avoid loading unrelated CSS, scripts, images,
    // and fonts merely to inspect the semantic HTML.
    const context = await browser.newContext({ javaScriptEnabled: false });
    await context.route('**/*', async (route) => {
      if (route.request().resourceType() === 'document') await route.continue();
      else await route.abort();
    });
    const page = await context.newPage();

    try {
      await page.goto(SEBOOK_COMBINED_URL, { waitUntil: 'domcontentloaded' });

      const designPrinciplesCount = await page.locator('[id="design-principles"]').count();
      expect(
        designPrinciplesCount,
        'the combined book must not duplicate the design-principles fragment',
      ).toBeLessThanOrEqual(1);
      const javaDesignPrinciples = page.locator('h1#java-design-principles');
      await expect(javaDesignPrinciples).toHaveCount(1);
      await expect(javaDesignPrinciples).toHaveText('Java Design Principles');
    } finally {
      await context.close();
    }
  });
});
