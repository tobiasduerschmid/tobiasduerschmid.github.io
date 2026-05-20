// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Tests: Broken Links
 * 
 * Crawls a bounded set of internal pages and verifies discovered internal links
 * do not return errors.
 */

function normalizeInternalHref(href, baseUrl) {
  if (
    typeof href !== 'string' ||
    href.startsWith('#') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:') ||
    href.startsWith('javascript:')
  ) {
    return null;
  }

  const url = new URL(href, baseUrl);
  const base = new URL(baseUrl);
  if (url.origin !== base.origin || url.pathname.includes('/files/')) return null;
  return `${url.pathname}${url.search}`;
}

test.describe('Broken Link Checker', () => {
  test('all internal links return 200 OK', async ({ page, request }) => {
    // The crawl walks up to 50 pages and HEAD/GETs every internal anchor on
    // each, which is many hundreds of requests against the dev Jekyll
    // server. The default 30 s test timeout was tuned for a smaller site
    // and started to flake as more SEBook chapters, tutorials, and lecture
    // pages were added. Two minutes is plenty even on a contended local
    // run while staying inside CI's overall test budget.
    test.setTimeout(120_000);
    const visited = new Set();
    const toVisit = ['/'];
    const brokenLinks = [];

    // Bound crawl size so the test stays useful in local feedback loops.
    let limit = 50;

    while (toVisit.length > 0 && limit > 0) {
      const currentPath = toVisit.pop();
      if (visited.has(currentPath)) continue;
      visited.add(currentPath);
      limit--;

      const currentResponse = await page.goto(currentPath, { waitUntil: 'domcontentloaded' });
      if (!currentResponse || currentResponse.status() >= 400) {
        brokenLinks.push(`${currentPath} - Status: ${currentResponse ? currentResponse.status() : 'no response'}`);
        continue;
      }
      await page.waitForLoadState('load', { timeout: 5_000 }).catch(() => {});
      
      const baseUrl = page.url();
      const links = await page.locator('a[href]').evaluateAll((anchors) =>
        anchors.map((a) => a.getAttribute('href')).filter(Boolean)
      );

      for (const href of links) {
        const resolvedPath = normalizeInternalHref(href, baseUrl);
        if (!resolvedPath) continue;

        const response = await request.get(resolvedPath);
        if (response.status() >= 400) {
          brokenLinks.push(`${resolvedPath} (from ${currentPath}) - Status: ${response.status()}`);
          continue;
        }

        if (!visited.has(resolvedPath) && !toVisit.includes(resolvedPath)) {
          toVisit.push(resolvedPath);
        }
      }
    }

    expect(brokenLinks, `Found broken links:\n${brokenLinks.join('\n')}`).toEqual([]);
  });
});
