// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Tests: Missing References
 *
 * Jekyll Scholar renders "(missing reference)" when a {% cite key %} tag cannot
 * be resolved.  These tests ensure nothing slips through into the published HTML.
 */

const PAGES_TO_CHECK = [
  // Blog
  '/blog/',
  '/blog/how-should-i-use-ai-as-a-college-student/',
  // SEBook main sections
  '/SEBook/',
  '/SEBook/requirements.html',
  '/SEBook/userstories.html',
  '/SEBook/software_architecture.html',
  '/SEBook/testing.html',
  '/SEBook/uml.html',
  '/SEBook/designprinciples.html',
  '/SEBook/designpatterns.html',
  '/SEBook/process.html',
];

for (const path of PAGES_TO_CHECK) {
  test(`no "(missing reference)" on ${path}`, async ({ page }) => {
    await page.goto(path);
    const body = await page.locator('body').innerText();
    expect(body, `Found "(missing reference)" on ${path}`).not.toContain('(missing reference)');
  });
}
