// @ts-check
const { test, expect } = require('@playwright/test');

test('GitGraph IDs stay unique across static markup and repeated script loads', async ({ page }) => {
  await page.goto('/');
  await page.setContent(`
    <!doctype html>
    <html lang="en">
    <body>
      <svg role="img" aria-label="Pre-rendered graph one" aria-describedby="git-graph-arrow-1-desc">
        <defs><marker id="git-graph-arrow-1"></marker></defs>
        <desc id="git-graph-arrow-1-desc">Pre-rendered graph one details</desc>
      </svg>
      <svg role="img" aria-label="Pre-rendered graph two" aria-describedby="git-graph-arrow-2-desc">
        <defs><marker id="git-graph-arrow-2"></marker></defs>
        <desc id="git-graph-arrow-2-desc">Pre-rendered graph two details</desc>
      </svg>
      <div id="first-runtime-graph"></div>
      <div id="second-runtime-graph"></div>
    </body>
    </html>
  `);

  await page.addScriptTag({ url: '/js/git-graph.js' });
  await page.evaluate(() => { window.__firstGitGraphConstructor = window.GitGraph; });
  await page.addScriptTag({ url: '/js/git-graph.js' });

  await page.evaluate(() => {
    const graphData = window.GitGraph.parseGitState(
      'A0000000||Initial commit|HEAD -> main',
      '* main',
      'refs/heads/main',
    );
    graphData.commits[0].texture = 'hatched';
    // Allocate both instances before either renders. DOM scanning alone cannot
    // prevent a collision here; the two bundle evaluations must share state.
    const firstGraph = new window.__firstGitGraphConstructor(
      document.getElementById('first-runtime-graph'),
    );
    const secondGraph = new window.GitGraph(
      document.getElementById('second-runtime-graph'),
    );
    document.getElementById('first-runtime-graph').innerHTML = firstGraph.toSVG(graphData);
    document.getElementById('second-runtime-graph').innerHTML = secondGraph.toSVG(graphData);
  });

  const idAudit = await page.evaluate(() => {
    const svgElements = Array.from(document.querySelectorAll('svg, svg *'));
    const ids = svgElements.filter((element) => element.id).map((element) => element.id);
    const describedBy = Array.from(document.querySelectorAll('[aria-describedby]'))
      .flatMap((element) => (element.getAttribute('aria-describedby') || '').trim().split(/\s+/))
      .filter(Boolean);
    const localUrlTargets = svgElements.flatMap((element) =>
      Array.from(element.attributes || []).flatMap((attribute) =>
        Array.from(attribute.value.matchAll(/url\(\s*['"]?#([^)'"]+)['"]?\s*\)/g), (match) => match[1])
      )
    );
    const idCounts = (references) => references.map((id) => ({
      id,
      matches: ids.filter((candidate) => candidate === id).length,
    }));
    return {
      ids,
      descriptions: idCounts(describedBy),
      localUrls: idCounts(localUrlTargets),
    };
  });

  expect(new Set(idAudit.ids).size).toBe(idAudit.ids.length);
  expect(idAudit.descriptions).toHaveLength(4);
  expect(idAudit.descriptions.every(({ matches }) => matches === 1)).toBe(true);
  expect(idAudit.localUrls).toHaveLength(2);
  expect(idAudit.localUrls.every(({ matches }) => matches === 1)).toBe(true);
});
