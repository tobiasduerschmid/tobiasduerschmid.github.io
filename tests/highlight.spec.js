// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Highlight Syntax Verification', () => {
  test.beforeEach(async ({ page }) => {
    // We use the dedicated test post created for this purpose
    // The date is 2026-03-15, and title is "Highlight Verification Test"
    // Jekyll URL pattern will likely be /blog/2026/03/15/highlight-verification/ 
    // or just /blog/highlight-verification/ depending on config.
    // Based on blog.spec.js, it seems to be /blog/slug/
    await page.goto('/blog/highlight-verification/');
  });

  test('basic highlight renders as <mark>', async ({ page }) => {
    const mark = page.locator('mark:has-text("this should be highlighted")');
    await expect(mark).toBeVisible();
    
    // Style check
    const styles = await mark.evaluate((node) => {
      const computed = window.getComputedStyle(node);
      return {
        backgroundColor: computed.backgroundColor,
        fontWeight: computed.fontWeight
      };
    });
    
    expect(styles.backgroundColor).toBe('rgb(255, 209, 0)'); // #FFD100
    expect(parseInt(styles.fontWeight)).toBeGreaterThanOrEqual(600); // Bold or Semi-bold
  });

  test('nested italics render inside <mark>', async ({ page }) => {
    const mark = page.locator('mark:has-text("this should be")');
    const em = mark.locator('em');
    await expect(em).toHaveText('italicized and highlighted');
  });

  test('nested bold renders inside <mark>', async ({ page }) => {
    const mark = page.locator('mark:has-text("this should be")');
    const strong = mark.locator('strong');
    await expect(strong).toHaveText('bold and highlighted');
  });

  test('mixed nested italics and bold render inside <mark>', async ({ page }) => {
    const mark = page.locator('mark:has-text("bold and italicized highlighted")');
    const strong = mark.locator('strong');
    const em = strong.locator('em');
    await expect(em).toHaveText('italicized');
  });

  test('highlight with curly quotes renders correctly', async ({ page }) => {
    const mark = page.locator('mark:has-text("this highlight has quotes")');
    await expect(mark).toBeVisible();
  });

  test('highlighting is skipped inside code blocks', async ({ page }) => {
    // Check that there is NO mark tag inside pre code
    const codeBlock = page.locator('pre code');
    const marksInCode = codeBlock.locator('mark');
    await expect(marksInCode).toHaveCount(0);
    
    const textInCode = await codeBlock.innerText();
    expect(textInCode).toContain('==this should NOT be highlighted in a code block==');
  });

  test('highlighting is skipped inside inline code', async ({ page }) => {
    const inlineCode = page.locator('code:has-text("inline code")');
    const marksInInline = inlineCode.locator('mark');
    await expect(marksInInline).toHaveCount(0);
  });

  test('highlighting is skipped inside <pre> tags', async ({ page }) => {
    const preTag = page.locator('pre:has-text("highlighted in a pre tag")');
    const marksInPre = preTag.locator('mark');
    await expect(marksInPre).toHaveCount(0);
  });

  test('highlighting is skipped inside <script> tags', async ({ page }) => {
    // Script tags are not visible, but we can check the page source or DOM
    const scripts = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      return scripts.map(s => s.innerText);
    });
    
    const relevantScript = scripts.find(s => s.includes('this should NOT be highlighted in a script tag'));
    expect(relevantScript).toContain('==this should NOT be highlighted in a script tag==');
    expect(relevantScript).not.toContain('<mark>');
  });
});
