// @ts-check
const { test, expect } = require('@playwright/test');
const path = require('path');
const AxeBuilder = require('@axe-core/playwright').default;

async function loadMakeGraph(page) {
  await page.setContent('<main><div id="graph"></div></main>');
  await page.addScriptTag({ path: path.join(__dirname, '..', 'js', 'make-graph.js') });
  await page.waitForFunction(() => !!window.MakeGraph);
}

test('missing Makefile guidance stays readable in both themes and a narrow pane', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.setContent('<main class="tvm-make-dag-panel"><div id="graph" class="tvm-make-dag-container"></div></main>');
  await page.addStyleTag({ path: path.join(__dirname, '..', 'css', 'tutorial.css') });
  await page.addScriptTag({ path: path.join(__dirname, '..', 'js', 'make-graph.js') });
  await page.evaluate(() => {
    new window.MakeGraph(document.getElementById('graph'), {
      dirLabel: '/tutorial/make_project/step1',
    }).render({ nodes: [], edges: [], makefilePresent: false });
  });

  const guidance = page.getByRole('status');
  await expect(guidance).toContainText('No Makefile found');
  for (const dark of [false, true]) {
    await page.evaluate((enabled) => document.documentElement.classList.toggle('dark-mode', enabled), dark);
    const result = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
    expect(result.violations, `Missing Makefile guidance in ${dark ? 'dark' : 'light'} mode`).toEqual([]);
    expect(await guidance.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  }
});

test.describe('MakeGraph parser', () => {
  test('treats GNU Make missing-target sentinel mtimes as missing files', async ({ page }) => {
    await loadMakeGraph(page);

    const app = await page.evaluate(() => {
      const dump = [
        '===FILES===',
        '# Files',
        'app: main.c math.c io.c',
        '#  Last modified 2514-05-30 01:53:04',
        '#  Recipe to execute (from \'Makefile\', line 2):',
        '\tgcc main.c math.c io.c -o app',
        '# files hash-table stats:',
        '===PHONY===',
        '===MTIMES===',
        'Makefile|1778142000.0000000000',
        'main.c|1778142000.0000000000',
        'math.c|1778142000.0000000000',
        'io.c|1778142000.0000000000',
      ].join('\n');
      const data = window.MakeGraph.parseMakeDb(dump);
      return data.nodes.find((node) => node.id === 'app');
    });

    expect(app).toMatchObject({ id: 'app', isStale: true });
    expect(app.mtime).toBeUndefined();
  });

  test('marks only the changed prerequisite edge as stale', async ({ page }) => {
    await loadMakeGraph(page);

    const edgeState = await page.evaluate(() => {
      const dump = [
        '===FILES===',
        '# Files',
        'app: main.c math.c io.c',
        '#  Last modified 2026-05-07 08:20:00',
        '#  Recipe to execute (from \'Makefile\', line 2):',
        '\tgcc main.c math.c io.c -o app',
        '# files hash-table stats:',
        '===PHONY===',
        '===MTIMES===',
        'app|100.0000000000',
        'main.c|200.0000000000',
        'math.c|50.0000000000',
        'io.c|50.0000000000',
      ].join('\n');
      const data = window.MakeGraph.parseMakeDb(dump);
      return Object.fromEntries(data.edges.map((edge) => [
        edge.from + '->' + edge.to,
        edge.isStale === true,
      ]));
    });

    expect(edgeState).toEqual({
      'app->main.c': true,
      'app->math.c': false,
      'app->io.c': false,
    });
  });

  test('renders stale styling only on causal edges', async ({ page }) => {
    await loadMakeGraph(page);

    const staleEdges = await page.evaluate(() => {
      const host = document.getElementById('graph');
      const graph = new window.MakeGraph(host);
      const data = window.MakeGraph.parseSpec([
        'app: main.c math.c io.c',
        '@mtime app = 100',
        '@mtime main.c = 200',
        '@mtime math.c = 50',
        '@mtime io.c = 50',
      ].join('\n'));
      graph.render(data);
      return Array.from(host.querySelectorAll('.tvm-make-dag-edge')).map((edge) =>
        edge.classList.contains('tvm-make-dag-edge-stale')
      );
    });

    expect(staleEdges.filter(Boolean)).toHaveLength(1);
  });
});
