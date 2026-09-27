// @ts-check
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { buildAuditInventory } = require('./wcag-audit-inventory');

/**
 * Tests: AI training opt-out
 *
 * The site reserves text and data mining, including AI training, for all of
 * its content. Crawlers read the reservation from each page's <head>, from
 * /robots.txt, and from /.well-known/tdmrep.json; people read it in the
 * footer and the RSS feed. Each test checks one of those places the way its
 * reader would.
 */

const ROOT = path.resolve(__dirname, '..');

const TRAINING_CRAWLERS = [
  'GPTBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended', 'Amazonbot', 'meta-externalagent', 'CCBot',
];
const SEARCH_CRAWLERS = ['Googlebot', 'Bingbot'];

// Runs in the browser, which parses the served HTML the way a crawler does:
// without running the page's scripts or fetching its subresources.
function readOptOutMetadata(html) {
  const head = new DOMParser().parseFromString(html, 'text/html').head;
  const contents = (name) => Array.from(head.querySelectorAll(`meta[name="${name}"]`), (meta) => meta.content);
  return {
    tdmReservation: contents('tdm-reservation'),
    robots: contents('robots').flatMap((value) => value.split(',')).map((word) => word.trim().toLowerCase()),
    rights: contents('dcterms.rights').join(' '),
  };
}

function optOutGaps({ tdmReservation, robots, rights }) {
  const gaps = [];
  if (tdmReservation.join() !== '1') gaps.push(`tdm-reservation is [${tdmReservation}], expected [1]`);
  for (const directive of ['noai', 'noimageai', 'noarchive']) {
    if (!robots.includes(directive)) gaps.push(`robots lacks ${directive}`);
  }
  // Bing reads noarchive plus nocache as nocache, which permits training on snippets.
  if (robots.includes('nocache')) gaps.push('robots has nocache');
  if (!rights.includes('text and data mining')) gaps.push('dcterms.rights lacks the plain-language reservation');
  return gaps;
}

// RFC 9309 group selection: the rules of the group that names the product
// token (case-insensitively), or else the rules of the `*` group.
function robotsRulesFor(robotsTxt, productToken) {
  const groups = [];
  let group = null;
  for (const line of robotsTxt.split(/\r?\n/)) {
    const record = line.replace(/#.*/, '').match(/^\s*([A-Za-z-]+)\s*:\s*(.*?)\s*$/);
    if (!record) continue;
    const key = record[1].toLowerCase();
    if (key === 'user-agent') {
      if (!group || group.rules.length > 0) groups.push(group = { agents: [], rules: [] });
      group.agents.push(record[2].toLowerCase());
    } else if (group && ['allow', 'disallow', 'content-usage'].includes(key)) {
      group.rules.push(`${key}: ${record[2]}`);
    }
  }
  const token = productToken.toLowerCase();
  const match = groups.find((g) => g.agents.includes(token)) || groups.find((g) => g.agents.includes('*'));
  return match ? match.rules : [];
}

test.describe('AI training opt-out', () => {
  test('every built page reserves text and data mining in its head metadata', async ({ page, request }) => {
    test.setTimeout(120_000); // one fetch and parse per built page, 200+ in all
    const { groups } = buildAuditInventory({ sourceRoot: ROOT, siteRoot: path.join(ROOT, '_site') });
    const pagesWithGaps = [];
    for (const url of Object.values(groups).flat().sort()) {
      const response = await request.get(url);
      expect(response.ok(), `GET ${url}`).toBe(true);
      const gaps = optOutGaps(await page.evaluate(readOptOutMetadata, await response.text()));
      if (gaps.length > 0) pagesWithGaps.push({ url, gaps });
    }
    expect(pagesWithGaps).toEqual([]);
  });

  test('robots.txt blocks AI training crawlers and asks every other crawler not to train', async ({ request }) => {
    const response = await request.get('/robots.txt');
    expect(response.ok()).toBe(true);
    const robotsTxt = await response.text();

    for (const crawler of TRAINING_CRAWLERS) {
      expect(robotsRulesFor(robotsTxt, crawler), crawler).toContain('disallow: /');
    }
    for (const crawler of SEARCH_CRAWLERS) {
      const rules = robotsRulesFor(robotsTxt, crawler);
      expect(rules, crawler).not.toContain('disallow: /');
      expect(rules, crawler).toContain('content-usage: train-ai=n');
    }
  });

  test('robots.txt still advertises the sitemap', async ({ request }) => {
    const robotsTxt = await (await request.get('/robots.txt')).text();
    expect(robotsTxt).toMatch(/^Sitemap: https?:\/\/\S+\/sitemap\.xml$/m);
  });

  test('tdmrep.json reserves text and data mining on every path', async ({ request }) => {
    const response = await request.get('/.well-known/tdmrep.json');
    expect(response.ok()).toBe(true);
    const rules = await response.json();
    expect(rules).toContainEqual(expect.objectContaining({ location: '/', 'tdm-reservation': 1 }));
    expect(rules.filter((rule) => rule['tdm-reservation'] !== 1)).toEqual([]);
  });

  test('the footer states the reservation in plain language', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('contentinfo')).toContainText(
      /expressly reserves .* for text and data mining, .* pursuant to Article 4\(3\) of Directive \(EU\) 2019\/790/,
    );
  });

  test('the RSS feed carries the reservation', async ({ request }) => {
    const feed = await (await request.get('/feed.xml')).text();
    const copyright = feed.match(/<copyright>([^<]*)<\/copyright>/);
    expect(copyright?.[1]).toMatch(/expressly reserves .* for text and data mining/);
  });
});
